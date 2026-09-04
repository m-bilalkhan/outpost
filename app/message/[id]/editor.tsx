"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { missingVars, substitute, textToHtml } from "@/lib/template";
import { btn, btnDanger, btnGhost, field, label } from "../../ui";

/** Variables Outpost can fill from the contact record. */
const VAR_TO_FIELD = {
  first_name: "firstName",
  last_name: "lastName",
  company: "company",
  role: "role",
} as const;

type FillField = (typeof VAR_TO_FIELD)[keyof typeof VAR_TO_FIELD];

const TITLES: Record<FillField, string> = {
  firstName: "First name",
  lastName: "Last name",
  company: "Company",
  role: "Role",
};

export type ContactFields = Record<FillField, string>;

type Props = {
  id: string;
  contactId: string | null;
  contact: ContactFields;
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
  const [fields, setFields] = useState<ContactFields>(props.contact);
  const [runAt, setRunAt] = useState(props.scheduledLocal ?? props.defaultLocal);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = useMemo(() => missingVars(subject, body), [subject, body]);

  const fillable = useMemo(
    () =>
      (Object.keys(VAR_TO_FIELD) as (keyof typeof VAR_TO_FIELD)[]).filter((v) =>
        missing.includes(v),
      ),
    [missing],
  );
  const unfillable = missing.filter(
    (v) => !(v in VAR_TO_FIELD),
  );

  const locked = props.status === "sent" || props.status === "cancelled";

  async function call(path: string, method: string, payload?: unknown) {
    const res = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `${method} failed`);
    return data;
  }

  async function guarded(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /** Save the values onto the contact, then substitute them in place.
   *  In place, not a re-render -- your manual edits survive. */
  const fillIn = () =>
    guarded(async () => {
      const patch: Partial<Record<FillField, string>> = {};
      const subs: Record<string, string> = {};
      for (const v of fillable) {
        const value = fields[VAR_TO_FIELD[v]].trim();
        if (!value) continue;
        patch[VAR_TO_FIELD[v]] = value;
        subs[v] = value;
      }
      if (Object.keys(subs).length === 0) {
        throw new Error("Type at least one value first");
      }
      if (props.contactId) {
        await call(`/api/contacts/${props.contactId}`, "PATCH", patch);
      }
      setSubject(substitute(subject, subs));
      setBody(substitute(body, subs));
      router.refresh();
    });

  const save = () =>
    guarded(async () => {
      await call(`/api/messages/${props.id}`, "PATCH", { subject, bodyText: body });
      router.refresh();
    });

  const schedule = () =>
    guarded(async () => {
      await call(`/api/messages/${props.id}`, "PATCH", { subject, bodyText: body });
      await call(`/api/messages/${props.id}/schedule`, "POST", { runAtLocal: runAt });
      router.push("/");
    });

  const cancel = () =>
    guarded(async () => {
      await call(`/api/messages/${props.id}`, "DELETE");
      router.push("/");
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs opacity-60">To: {props.toEmail}</div>

      <label className="flex flex-col gap-1">
        <span className={label}>Subject</span>
        <input
          value={subject}
          disabled={locked}
          onChange={(e) => setSubject(e.target.value)}
          className={field}
        />
      </label>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-4">
          <span className={label}>Body</span>
          <div className="flex gap-3 text-xs">
            {(["write", "preview"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  tab === t
                    ? "font-semibold text-emerald-800 dark:text-emerald-400"
                    : "opacity-50 hover:opacity-100"
                }
              >
                {t === "write" ? "Write" : "Preview"}
              </button>
            ))}
          </div>
        </div>

        {tab === "write" ? (
          <textarea
            value={body}
            disabled={locked}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className={`${field} font-mono leading-relaxed`}
          />
        ) : (
          <div className="min-h-[24rem] rounded border border-black/15 bg-white p-4 dark:border-white/15 dark:bg-white/5">
            <div
              className="prose-sm text-[15px] leading-relaxed [&_p]:mb-4"
              // textToHtml escapes every character it does not itself emit.
              dangerouslySetInnerHTML={{ __html: textToHtml(body) }}
            />
          </div>
        )}
      </div>

      {!locked && fillable.length > 0 && (
        <div className="flex flex-col gap-3 rounded border border-amber-400/60 bg-amber-50 p-3 dark:bg-amber-900/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>Not filled in:</strong>{" "}
            {fillable.map((v) => `{{${v}}}`).join(", ")} — fill these and Outpost
            saves them to the contact too, so the next draft has them.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {fillable.map((v) => {
              const f = VAR_TO_FIELD[v];
              return (
                <label key={v} className="flex flex-col gap-1">
                  <span className={label}>{TITLES[f]}</span>
                  <input
                    value={fields[f]}
                    onChange={(e) => setFields({ ...fields, [f]: e.target.value })}
                    className={field}
                  />
                </label>
              );
            })}
          </div>
          <div>
            <button onClick={fillIn} disabled={busy} className={btn}>
              Fill in
            </button>
          </div>
        </div>
      )}

      {!locked && unfillable.length > 0 && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {unfillable.map((v) => `{{${v}}}`).join(", ")} cannot be filled
          automatically — edit the body directly. Scheduling stays blocked until
          they are gone.
        </p>
      )}

      {!locked && (
        <div className="flex flex-wrap items-end gap-3 border-t border-black/10 pt-4 dark:border-white/10">
          <label className="flex flex-col gap-1">
            <span className={label}>Send at ({props.tz})</span>
            <input
              type="datetime-local"
              value={runAt}
              onChange={(e) => setRunAt(e.target.value)}
              className={field}
            />
          </label>
          <button
            onClick={schedule}
            disabled={busy || missing.length > 0}
            className={btn}
          >
            {props.status === "scheduled" ? "Reschedule" : "Approve & schedule"}
          </button>
          <button onClick={save} disabled={busy} className={btnGhost}>
            Save draft
          </button>
          <button onClick={cancel} disabled={busy} className={`${btnDanger} ml-auto`}>
            {props.status === "scheduled" ? "Cancel send" : "Discard"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
