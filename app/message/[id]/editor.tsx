"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { missingVars, substitute } from "@/lib/template";
import { RichEditor } from "../../rich-editor";
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
  initialBodyHtml: string;
  status: string;
  defaultLocal: string;
  scheduledLocal: string | null;
  tz: string;
};

export function Editor(props: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState(props.initialSubject);
  const [body, setBody] = useState(props.initialBodyHtml);
  const [fields, setFields] = useState<ContactFields>(props.contact);
  const [runAt, setRunAt] = useState(props.scheduledLocal ?? props.defaultLocal);
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
    return fetchJson(path, {
      method,
      headers: { "content-type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
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
      await call(`/api/messages/${props.id}`, "PATCH", { subject, bodyHtml: body });
      router.refresh();
    });

  const schedule = () =>
    guarded(async () => {
      await call(`/api/messages/${props.id}`, "PATCH", { subject, bodyHtml: body });
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
        <span className={label}>Body</span>
        <RichEditor value={body} onChange={setBody} editable={!locked} />
        <p className="text-xs opacity-50">
          What you see is what gets sent. A plain-text version is generated
          automatically and sent alongside it.
        </p>
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
