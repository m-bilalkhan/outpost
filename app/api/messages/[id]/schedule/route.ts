import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { withErrors } from "@/lib/api";
import { env } from "@/lib/env";
import { missingVars } from "@/lib/template";
import { zonedToUtc } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  runAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
});

export const POST = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A send time is required" }, { status: 400 });
  }

  const [msg] = await sql<
    { id: string; subject: string; body_text: string; status: string }[]
  >`select id, subject, body_text, status from messages where id = ${id}`;

  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (msg.status === "sent") {
    return NextResponse.json({ error: "Already sent" }, { status: 409 });
  }

  // The guard. Nothing half-rendered ever gets scheduled.
  const unresolved = missingVars(msg.subject, msg.body_text);
  if (unresolved.length) {
    return NextResponse.json(
      {
        error: `Still unfilled: ${unresolved.map((v) => `{{${v}}}`).join(", ")}`,
      },
      { status: 422 },
    );
  }
  if (!msg.subject.trim()) {
    return NextResponse.json({ error: "Subject is empty" }, { status: 422 });
  }

  const runAt = zonedToUtc(parsed.data.runAtLocal, env.tz);
  if (Number.isNaN(runAt.getTime())) {
    return NextResponse.json({ error: "Could not read that time" }, { status: 400 });
  }
  if (runAt.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: "That time is in the past" }, { status: 422 });
  }

  const [job] = await sql<{ id: string; run_at: string }[]>`
    insert into jobs (kind, payload, run_at, dedupe_key)
    values ('email.send', jsonb_build_object('messageId', ${id}::text), ${runAt}, ${`email:${id}`})
    on conflict (dedupe_key) do update set
      run_at     = excluded.run_at,
      status     = 'pending',
      attempts   = 0,
      locked_at  = null,
      last_error = null,
      updated_at = now()
    where jobs.status <> 'done'
    returning id, run_at
  `;

  if (!job) {
    return NextResponse.json(
      { error: "This message has already been dispatched" },
      { status: 409 },
    );
  }

  await sql`
    update messages set status='scheduled', last_error=null, updated_at=now()
    where id = ${id}
  `;

  return NextResponse.json({ ok: true, jobId: job.id, runAt: job.run_at });
});
