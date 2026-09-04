import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { sendAlert } from "@/lib/mailer";
import {
  getHandler,
  logEvent,
  PermanentError,
  type JobContext,
} from "./registry";

type ClaimedJob = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

export type TickResult = {
  claimed: number;
  done: number;
  retried: number;
  failed: number;
  rateLimited: boolean;
  jobs: { id: string; kind: string; outcome: string }[];
};

/** Exponential-ish backoff, in minutes: 1, 2, 4, 8... */
function backoffMinutes(attempts: number): number {
  return Math.min(2 ** Math.max(0, attempts - 1), 30);
}

/**
 * One pass of the queue. Safe to run concurrently with itself: overlapping
 * ticks skip each other's locked rows rather than fighting over them.
 */
export async function tick(): Promise<TickResult> {
  // Self-imposed sending cap, well under the mailbox's 500/hour ceiling.
  const [{ count: sentLastHour }] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from messages
    where sent_at > now() - interval '1 hour'
  `;
  const emailAllowed = sentLastHour < env.maxSendsPerHour;

  const claimed = await sql<ClaimedJob[]>`
    update jobs set
      status     = 'running',
      locked_at  = now(),
      attempts   = attempts + 1,
      updated_at = now()
    where id in (
      select id from jobs
      where (
              (status = 'pending' and run_at <= now())
              -- reclaim whatever a crashed or killed tick left stranded
           or (status = 'running'
               and locked_at < now() - interval '5 minutes'
               and attempts < max_attempts)
            )
        and (${emailAllowed} or kind <> 'email.send')
      order by run_at
      limit ${env.batchSize}
      for update skip locked
    )
    returning id, kind, payload, attempts, max_attempts
  `;

  const result: TickResult = {
    claimed: claimed.length,
    done: 0,
    retried: 0,
    failed: 0,
    rateLimited: !emailAllowed,
    jobs: [],
  };

  for (const job of claimed) {
    const ctx: JobContext = { jobId: job.id, attempt: job.attempts };
    const handler = getHandler(job.kind);

    if (!handler) {
      await fail(job, ctx, new PermanentError(`No handler for kind "${job.kind}"`));
      result.failed++;
      result.jobs.push({ id: job.id, kind: job.kind, outcome: "failed" });
      continue;
    }

    try {
      const value = await handler.run(job.payload, ctx);
      await sql`
        update jobs set status='done', result=${JSON.stringify(value ?? null)}::jsonb,
                        last_error=null, updated_at=now()
        where id = ${job.id}
      `;
      await logEvent(job.id, "info", "done", value);
      result.done++;
      result.jobs.push({ id: job.id, kind: job.kind, outcome: "done" });
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const permanent =
        error instanceof PermanentError || job.attempts >= job.max_attempts;

      if (permanent) {
        await fail(job, ctx, error);
        result.failed++;
        result.jobs.push({ id: job.id, kind: job.kind, outcome: "failed" });
      } else {
        const wait = backoffMinutes(job.attempts);
        await sql`
          update jobs set status='pending',
                          run_at = now() + (${wait} * interval '1 minute'),
                          last_error=${error.message},
                          updated_at=now()
          where id = ${job.id}
        `;
        await logEvent(job.id, "warn", `attempt ${job.attempts} failed, retrying in ${wait}m`, {
          error: error.message,
        });
        result.retried++;
        result.jobs.push({ id: job.id, kind: job.kind, outcome: `retry in ${wait}m` });
      }
    }
  }

  return result;
}

async function fail(job: ClaimedJob, ctx: JobContext, error: Error) {
  await sql`
    update jobs set status='failed', last_error=${error.message}, updated_at=now()
    where id = ${job.id}
  `;
  await logEvent(job.id, "error", "permanently failed", { error: error.message });

  const handler = getHandler(job.kind);
  if (handler?.onFail) {
    try {
      await handler.onFail(job.payload, ctx, error);
    } catch {
      /* ignore */
    }
  }

  // A scheduler you do not trust is worse than no scheduler.
  try {
    await sendAlert(
      `job failed: ${job.kind}`,
      [
        `Job:      ${job.id}`,
        `Kind:     ${job.kind}`,
        `Attempts: ${job.attempts}/${job.max_attempts}`,
        `Error:    ${error.message}`,
        ``,
        `Payload:  ${JSON.stringify(job.payload)}`,
      ].join("\n"),
    );
  } catch {
    /* if even the alert cannot send, the logs are all we have */
  }
}
