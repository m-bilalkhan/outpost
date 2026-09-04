"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const VAR_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

type Props = {
  id: string;
  toEmail: string;
  initialSubject: string;
  initialBody: string;
  status: string;
  defaultLocal: string;
  scheduledLocal: string | null;
  tz: string;
};

export function Editor(props: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState(props.initialSubject);
  const [body, setBody] = useState(props.initialBody);
  const [runAt, setRunAt] = useState(props.scheduledLocal ?? props.defaultLocal);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const missing = useMemo(() => {
    const found = new Set<string>();
    for (const t of [subject, body]) {
      for (const m of t.matchAll(VAR_RE)) found.add(m[1]);
    }
    return [...found];
  }, [subject, body]);

  const locked = props.status === "sent" || props.status === "cancelled";

  async function call(path: string, method: string, payload?: unknown) {
    setBusy(method + path);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `${method} failed`);
      router.refresh();
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    call(`/api/messages/${props.id}`, "PATCH", { subject, bodyText: body }).catch(
      () => {},
    );

  const schedule = async () => {
    try {
      await call(`/api/messages/${props.id}`, "PATCH", { subject, bodyText: body });
      await call(`/api/messages/${props.id}/schedule`, "POST", { runAtLocal: runAt });
      router.push("/");
    } catch {
      /* error already surfaced */
    }
  };

  const cancel = () =>
    call(`/api/messages/${props.id}`, "DELETE").then(() => router.push("/")).catch(
      () => {},
    );

  const field =
    "w-full rounded border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 disabled:opacity-60 dark:border-white/15 dark:bg-white/5";

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs opacity-60">To: {props.toEmail}</div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest opacity-60">
          Subject
        </span>
        <input
          value={subject}
          disabled={locked}
          onChange={(e) => setSubject(e.target.value)}
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest opacity-60">
          Body
        </span>
        <textarea
          value={body}
          disabled={locked}
          onChange={(e) => setBody(e.target.value)}
          rows={16}
          className={`${field} font-mono leading-relaxed`}
        />
      </label>

      {missing.length > 0 && (
        <div className="rounded border border-amber-400/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <strong>Not filled in:</strong>{" "}
          {missing.map((v) => `{{${v}}}`).join(", ")} — scheduling is blocked until
          these are replaced.
        </div>
      )}

      {!locked && (
        <div className="flex flex-wrap items-end gap-3 border-t border-black/10 pt-4 dark:border-white/10">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-widest opacity-60">
              Send at ({props.tz})
            </span>
            <input
              type="datetime-local"
              value={runAt}
              onChange={(e) => setRunAt(e.target.value)}
              className={field}
            />
          </label>
          <button
            onClick={schedule}
            disabled={!!busy || missing.length > 0}
            className="rounded bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {props.status === "scheduled" ? "Reschedule" : "Approve & schedule"}
          </button>
          <button
            onClick={save}
            disabled={!!busy}
            className="rounded border border-black/15 px-4 py-2 text-sm disabled:opacity-40 dark:border-white/20"
          >
            Save draft
          </button>
          <button
            onClick={cancel}
            disabled={!!busy}
            className="ml-auto rounded px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {props.status === "scheduled" ? "Cancel send" : "Discard"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
