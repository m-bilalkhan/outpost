import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { withErrors } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnosis in one request: open /api/health.
 *
 * Reports only whether each secret is *present* -- never its value -- plus
 * whether the database answers and whether each migration has landed. Enough
 * to tell a missing Vercel env var from an unapplied migration without
 * reading a log.
 */
const REQUIRED = [
  "DATABASE_URL",
  "MAIL_USER",
  "MAIL_APP_PASSWORD",
  "CRON_SHARED_SECRET",
] as const;

const OPTIONAL = ["MAIL_FROM_NAME", "ALERT_TO", "APP_TZ"] as const;

export const GET = withErrors(async () => {
  const env: Record<string, boolean> = {};
  for (const key of [...REQUIRED, ...OPTIONAL]) env[key] = !!process.env[key];
  const missing = REQUIRED.filter((k) => !process.env[k]);

  const report: Record<string, unknown> = {
    ok: false,
    env,
    missingRequiredEnv: missing,
  };

  if (missing.length) {
    report.hint = `Set ${missing.join(", ")} in your Vercel project settings, then redeploy.`;
    return NextResponse.json(report, { status: 503 });
  }

  const started = Date.now();
  try {
    await sql`select 1`;
    report.database = { reachable: true, ms: Date.now() - started };
  } catch (e) {
    report.database = {
      reachable: false,
      error: e instanceof Error ? e.message : String(e),
    };
    report.hint =
      "The app cannot reach Postgres. Check DATABASE_URL uses the Supabase " +
      "pooler host on port 6543, and that the project is not paused.";
    return NextResponse.json(report, { status: 503 });
  }

  // Which migrations have landed.
  const [cols] = await sql<{ thread: number; kind: number }[]>`
    select
      count(*) filter (where table_name='messages'  and column_name='thread_id')::int as thread,
      count(*) filter (where table_name='templates' and column_name='kind')::int      as kind
    from information_schema.columns
    where table_schema = 'public'
  `;
  const [tpl] = await sql<{ total: number; html: number }[]>`
    select count(*)::int as total,
           count(*) filter (where body_tpl like '<%')::int as html
    from templates
  `;

  const migrations = {
    "001_followups": cols.thread > 0 && cols.kind > 0,
    "002_rich_text": tpl.total > 0 && tpl.total === tpl.html,
  };
  const pending = Object.entries(migrations)
    .filter(([, done]) => !done)
    .map(([name]) => name);

  report.migrations = migrations;
  report.templates = { total: tpl.total, withHtmlBodies: tpl.html };

  if (pending.length) {
    report.pendingMigrations = pending;
    report.hint = `Run db/migrations/${pending[0]}.sql in the Supabase SQL editor.`;
    return NextResponse.json(report, { status: 503 });
  }

  report.ok = true;
  return NextResponse.json(report);
});
