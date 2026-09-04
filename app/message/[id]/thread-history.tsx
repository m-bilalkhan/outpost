import { formatInZone } from "@/lib/time";

export type ThreadEntry = {
  id: string;
  subject: string;
  status: string;
  sent_at: string | null;
  run_at: string | null;
  created_at: string;
};

export function ThreadHistory({
  entries,
  currentId,
  tz,
}: {
  entries: ThreadEntry[];
  currentId: string;
  tz: string;
}) {
  if (entries.length <= 1) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-widest opacity-50">
        Thread &middot; {entries.length} messages
      </h2>
      <ol className="flex flex-col gap-1 border-l-2 border-black/10 pl-3 dark:border-white/10">
        {entries.map((e, i) => {
          const when =
            e.status === "sent" && e.sent_at
              ? `sent ${formatInZone(e.sent_at, tz)}`
              : e.status === "scheduled" && e.run_at
                ? `scheduled ${formatInZone(e.run_at, tz)}`
                : e.status;
          const isCurrent = e.id === currentId;
          return (
            <li key={e.id} className="text-xs">
              {isCurrent ? (
                <span className="font-semibold">
                  {i === 0 ? "Original" : `Follow-up ${i}`} · {when} · this one
                </span>
              ) : (
                <a href={`/message/${e.id}`} className="opacity-60 hover:opacity-100">
                  {i === 0 ? "Original" : `Follow-up ${i}`} · {when}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
