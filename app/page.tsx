import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { formatInZone } from "@/lib/time";
import { CancelButton } from "./cancel-button";
import { ComposeForm } from "./compose-form";
import { btn, btnGhost, field } from "./ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const MAX_QUERY_LENGTH = 200;

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

type PendingRow = Pick<Row, "id" | "to_email" | "subject" | "parent_id"> & {
  run_at: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

const PILL: Record<string, string> = {
  draft: "bg-black/10 text-black/70 dark:bg-white/10 dark:text-white/70",
  scheduled: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  sent: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  failed: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200",
  cancelled: "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50",
};

function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** `/?q=acme&page=2#outbox`, leaving out whatever is still at its default. */
function outboxHref(q: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/${qs ? `?${qs}` : ""}#outbox`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  // Control characters are stripped: Postgres rejects a NUL byte in text.
  const q = firstParam(sp.q)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
  const requestedPage = Number.parseInt(firstParam(sp.page), 10);

  // Escape LIKE wildcards so a search for "50%_off" means those characters.
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const where = q
    ? sql`where m.subject ilike ${like}
            or m.to_email ilike ${like}
            or m.to_name ilike ${like}`
    : sql``;

  const [templates, pending, [{ total }]] = await Promise.all([
    sql<{ id: string; name: string }[]>`
      select id, name from templates
      where kind = 'outreach'
      order by is_default desc, name
    `,
    // The send queue is its own query: it must not shrink to the current
    // page or the current search.
    sql<PendingRow[]>`
      select m.id, m.to_email, m.subject, m.parent_id, j.run_at
      from messages m
      join jobs j
        on j.kind = 'email.send' and j.dedupe_key = 'email:' || m.id::text
      where m.status = 'scheduled'
      order by j.run_at
    `,
    sql<{ total: number }[]>`
      select count(*)::int as total from messages m ${where}
    `,
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageCount,
  );

  const rows = await sql<Row[]>`
    select m.id, m.to_email, m.subject, m.status, m.sent_at, m.last_error,
           m.parent_id, j.run_at
    from messages m
    left join jobs j
      on j.kind = 'email.send' and j.dedupe_key = 'email:' || m.id::text
    ${where}
    order by m.created_at desc, m.id desc
    limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}
  `;

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = (page - 1) * PAGE_SIZE + rows.length;

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
                    {r.to_email} &middot; {formatInZone(r.run_at, env.tz)}
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

      <section id="outbox" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest opacity-60">
          Outbox
        </h2>

        <form action="/#outbox" method="get" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={MAX_QUERY_LENGTH}
            placeholder="Search subject, name or address"
            aria-label="Search the outbox"
            className={field}
          />
          <button className={btn}>Search</button>
          {q && (
            <a href="/#outbox" className={`${btnGhost} whitespace-nowrap`}>
              Clear
            </a>
          )}
        </form>

        {total > 0 && (
          <p className="text-xs opacity-50">
            {q
              ? `${total} ${total === 1 ? "match" : "matches"} for "${q}"`
              : `${total} ${total === 1 ? "message" : "messages"}`}
            {pageCount > 1 ? ` · showing ${from}–${to}` : ""}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="text-sm opacity-60">
            {q ? `Nothing matches "${q}".` : "Nothing yet."}
          </p>
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

        {pageCount > 1 && (
          <nav
            aria-label="Outbox pages"
            className="flex items-center justify-between gap-3 text-sm"
          >
            {page > 1 ? (
              <a href={outboxHref(q, page - 1)} rel="prev" className={btnGhost}>
                &larr; Newer
              </a>
            ) : (
              <span className={`${btnGhost} opacity-40`}>&larr; Newer</span>
            )}
            <span className="text-xs opacity-60">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <a href={outboxHref(q, page + 1)} rel="next" className={btnGhost}>
                Older &rarr;
              </a>
            ) : (
              <span className={`${btnGhost} opacity-40`}>Older &rarr;</span>
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
