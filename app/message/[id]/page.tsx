import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { defaultLocalValue, formatInZone } from "@/lib/time";
import { Editor } from "./editor";
import { FollowUpButton } from "./follow-up-button";
import { ThreadHistory, type ThreadEntry } from "./thread-history";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  contact_id: string | null;
  to_email: string;
  subject: string;
  body_text: string;
  status: string;
  sent_at: string | null;
  last_error: string | null;
  run_at: string | null;
  thread_id: string | null;
  parent_id: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  role: string | null;
};

function toLocalInput(iso: string, tz: string): string {
  const p: Record<string, string> = {};
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  for (const part of dtf.formatToParts(new Date(iso))) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return `${p.year}-${p.month}-${p.day}T${String(Number(p.hour) % 24).padStart(2, "0")}:${p.minute}`;
}

export default async function MessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [row] = await sql<Row[]>`
    select m.id, m.contact_id, m.to_email, m.subject, m.body_text, m.status,
           m.sent_at, m.last_error, m.thread_id, m.parent_id, j.run_at,
           c.first_name, c.last_name, c.company, c.role
    from messages m
    left join contacts c on c.id = m.contact_id
    left join jobs j
      on j.kind = 'email.send' and j.payload->>'messageId' = m.id::text
    where m.id = ${id}
  `;
  if (!row) notFound();

  const thread = await sql<ThreadEntry[]>`
    select m.id, m.subject, m.status, m.sent_at, m.created_at, j.run_at
    from messages m
    left join jobs j
      on j.kind = 'email.send' and j.payload->>'messageId' = m.id::text
    where m.thread_id = ${row.thread_id ?? row.id}
      and m.status <> 'cancelled'
    order by m.created_at
  `;

  const heading =
    row.status === "sent"
      ? `Sent ${row.sent_at ? formatInZone(row.sent_at, env.tz) : ""}`
      : row.status === "failed"
        ? "Failed"
        : row.status === "scheduled" && row.run_at
          ? `Scheduled for ${formatInZone(row.run_at, env.tz)}`
          : row.parent_id
            ? "Review follow-up"
            : "Review";

  return (
    <main className="flex flex-col gap-6">
      <div>
        <a href="/" className="text-xs opacity-60 hover:opacity-100">
          &larr; Outbox
        </a>
        <h1 className="mt-2 text-sm font-semibold uppercase tracking-widest opacity-60">
          {heading}
        </h1>
        {row.last_error && (
          <p className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
            {row.last_error}
          </p>
        )}
      </div>

      <ThreadHistory entries={thread} currentId={row.id} tz={env.tz} />

      <Editor
        id={row.id}
        contactId={row.contact_id}
        contact={{
          firstName: row.first_name ?? "",
          lastName: row.last_name ?? "",
          company: row.company ?? "",
          role: row.role ?? "",
        }}
        toEmail={row.to_email}
        initialSubject={row.subject}
        initialBody={row.body_text}
        status={row.status}
        tz={env.tz}
        defaultLocal={defaultLocalValue(env.tz, 10)}
        scheduledLocal={row.run_at ? toLocalInput(row.run_at, env.tz) : null}
      />

      {row.status === "sent" && (
        <div className="border-t border-black/10 pt-5 dark:border-white/10">
          <FollowUpButton messageId={row.id} />
        </div>
      )}
    </main>
  );
}
