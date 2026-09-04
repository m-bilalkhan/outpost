import { sql } from "@/lib/db";

/** Throw this when retrying could never help (bad payload, missing row). */
export class PermanentError extends Error {
  readonly permanent = true;
}

export type JobContext = { jobId: string; attempt: number };

export type Handler = {
  run: (payload: Record<string, unknown>, ctx: JobContext) => Promise<unknown>;
  /** Called once, after the job has permanently failed. */
  onFail?: (
    payload: Record<string, unknown>,
    ctx: JobContext,
    error: Error,
  ) => Promise<void>;
};

const handlers = new Map<string, Handler>();

export function register(kind: string, handler: Handler): void {
  handlers.set(kind, handler);
}

export function getHandler(kind: string): Handler | undefined {
  return handlers.get(kind);
}

export function registeredKinds(): string[] {
  return [...handlers.keys()];
}

export async function logEvent(
  jobId: string,
  level: "info" | "warn" | "error",
  message: string,
  meta?: unknown,
): Promise<void> {
  try {
    await sql`
      insert into job_events (job_id, level, message, meta)
      values (${jobId}, ${level}, ${message}, ${meta ? JSON.stringify(meta) : null}::jsonb)
    `;
  } catch {
    // never let the audit trail take down the job
  }
}
