import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { formatInZone } from "@/lib/time";
import { CancelButton } from "./cancel-button";
import { ComposeForm } from "./compose-form";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  sent_at: string | null;
  last_error: string | null;
  run_at: string | null;
  parent_id: string | null;
};

const PILL: Record<string, string> = {
  draft: "bg-black/10 text-black/70 dark:bg-white/10 dark:text-white/70",
  scheduled: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  sent: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  failed: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200",
  cancelled: "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50",
};

export default async function Home() {
  const templates = await sql<{ id: string; name: string }[]>`
    select id, name from templates
    where kind = 'outreach'
    order by is_default desc, name
  `;

  const rows = await sql<Row[]>`
    select m.id, m.to_email, m.subject, m.status, m.sent_at, m.last_error,
           m.parent_id, j.run_at
    from messages m
    left join jobs j
      on j.kind = 'email.send' and j.payload->>'messageId' = m.id::text
    order by m.created_at desc
    limit 40
  `;

  const pending = rows
    .filter((r) => r.status === "scheduled" && r.run_at)
    .sort((a, b) => (a.run_at! < b.run_at! ? -1 : 1));

  return (
    <main className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-sm font-semibold uppercase tracking-widest opacity-60">
          New message
        </h1>
        <ComposeForm templates={templates} />
        <p className="text-xs opacity-50">
          Give an address. Outpost fills your template, then lets you edit before
          anything is scheduled.
        </p>
      </section>

      {pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest opacity-60">
            Going out next
          </h2>
          <ul className="divide-y divide-amber-300/40 rounded border border-amber-300/60 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/15">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <a href={`/message/${r.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {r.parent_id && (
                      <span className="mr-1.5 opacity-50" aria-label="follow-up">
                        &#8627;
                      </span>
                    )}
                    {r.subject || "(no subject)"}
                  </div>
                  <div className="truncate text-xs opacity-70">
                    {r.to_email} &middot; {formatInZone(r.run_at!, env.tz)}
                  </div>
                </a>
                <CancelButton messageId={r.id} />
              </li>
            ))}
          </ul>
          <p className="text-xs opacity-50">
            Outpost cannot see your inbox, so it will send these even if the
            person has already replied. Cancel anything that is no longer needed.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest opacity-60">
          Outbox
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm opacity-60">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-black/10 rounded border border-black/10 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${PILL[r.status] ?? PILL.draft}`}
                >
                  {r.status}
                </span>
                <a href={`/message/${r.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {r.parent_id && (
                      <span className="mr-1.5 opacity-50" aria-label="follow-up">
                        &#8627;
                      </span>
                    )}
                    {r.subject || "(no subject)"}
                  </div>
                  <div className="truncate text-xs opacity-60">
                    {r.to_email}
                    {r.status === "scheduled" && r.run_at
                      ? ` · ${formatInZone(r.run_at, env.tz)}`
                      : ""}
                    {r.status === "sent" && r.sent_at
                      ? ` · sent ${formatInZone(r.sent_at, env.tz)}`
                      : ""}
                    {r.status === "failed" && r.last_error ? ` · ${r.last_error}` : ""}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
