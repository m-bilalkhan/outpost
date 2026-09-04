/** Offset of `tz` from UTC, in ms, at the given instant. */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/**
 * Turn a `datetime-local` value ("2026-09-08T21:32") that the user meant in
 * `tz` into a real UTC instant. This is the only place local time exists.
 */
export function zonedToUtc(local: string, tz: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) throw new Error(`Not a datetime-local value: ${local}`);
  const [, Y, Mo, D, h, mi] = m;
  const naive = Date.UTC(+Y, +Mo - 1, +D, +h, +mi);
  // Two passes so the result is right across a DST boundary.
  let guess = new Date(naive - tzOffsetMs(new Date(naive), tz));
  guess = new Date(naive - tzOffsetMs(guess, tz));
  return guess;
}

/** Format an instant for display in `tz`. */
export function formatInZone(d: Date | string, tz: string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** A `datetime-local` string for "now + minutes", expressed in `tz`. */
export function defaultLocalValue(tz: string, plusMinutes = 10): string {
  const target = new Date(Date.now() + plusMinutes * 60_000);
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(target)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return `${p.year}-${p.month}-${p.day}T${String(Number(p.hour) % 24).padStart(2, "0")}:${p.minute}`;
}
