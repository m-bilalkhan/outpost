import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { defaultLocalValue, formatInZone } from "@/lib/time";
import { Editor } from "./editor";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  to_email: string;
  subject: string;
  body_text: string;
  status: string;
  sent_at: string | null;
  last_error: string | null;
  run_at: string | null;
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
    select m.id, m.to_email, m.subject, m.body_text, m.status, m.sent_at,
           m.last_error, j.run_at
    from messages m
    left join jobs j
      on j.kind = 'email.send' and j.payload->>'messageId' = m.id::text
    where m.id = ${id}
  `;
  if (!row) notFound();

  return (
    <main className="flex flex-col gap-6">
      <div>
        <a href="/" className="text-xs opacity-60 hover:opacity-100">
          &larr; Outbox
        </a>
        <h1 className="mt-2 text-sm font-semibold uppercase tracking-widest opacity-60">
          {row.status === "sent"
            ? `Sent ${row.sent_at ? formatInZone(row.sent_at, env.tz) : ""}`
            : row.status === "failed"
              ? "Failed"
              : "Review"}
        </h1>
        {row.last_error && (
          <p className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
            {row.last_error}
          </p>
        )}
      </div>

      <Editor
        id={row.id}
        toEmail={row.to_email}
        initialSubject={row.subject}
        initialBody={row.body_text}
        status={row.status}
        tz={env.tz}
        defaultLocal={defaultLocalValue(env.tz, 10)}
        scheduledLocal={row.run_at ? toLocalInput(row.run_at, env.tz) : null}
      />
    </main>
  );
}
