"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { missingVars } from "@/lib/template";
import { RichEditor } from "../rich-editor";
import { btn, btnDanger, btnGhost, card, field, label } from "../ui";

export type TemplateKind = "outreach" | "followup";

export type Template = {
  id: string;
  name: string;
  subject_tpl: string;
  body_tpl: string;
  kind: TemplateKind;
  is_default: boolean;
};

const KNOWN = ["first_name", "last_name", "company", "role", "email", "my_name"];

const SECTIONS: { kind: TemplateKind; title: string; blurb: string }[] = [
  {
    kind: "outreach",
    title: "Outreach",
    blurb: "Used when you compose from an address on the Compose page.",
  },
  {
    kind: "followup",
    title: "Follow-up",
    blurb:
      "Used by Write follow-up on a sent message. Leave the subject blank to inherit “Re: …”, which is what keeps it in the same thread.",
  },
];

export function TemplatesEditor({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(kind: TemplateKind) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          kind === "followup"
            ? {
                name: "New follow-up",
                subjectTpl: "",
                bodyTpl:
                  "<p>Hi {{first_name}},</p><p>Quick follow-up on my note below.</p><p>Best,<br>{{my_name}}</p>",
                kind,
                isDefault: !templates.some((t) => t.kind === "followup"),
              }
            : {
                name: "New template",
                subjectTpl: "Quick question, {{first_name}}",
                bodyTpl:
                  "<p>Hi {{first_name}},</p><p></p><p>Best,<br>{{my_name}}</p>",
                kind,
                isDefault: !templates.some((t) => t.kind === "outreach"),
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create");
      setOpenId(data.id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-xs opacity-50">
        Variables: {KNOWN.map((v) => `{{${v}}}`).join("  ")}
      </p>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}

      {SECTIONS.map(({ kind, title, blurb }) => {
        const list = templates.filter((t) => t.kind === kind);
        return (
          <section key={kind} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">{title}</h2>
              <button onClick={() => create(kind)} disabled={busy} className={btnGhost}>
                New {title.toLowerCase()} template
              </button>
            </div>
            <p className="text-xs opacity-50">{blurb}</p>
            {list.length === 0 ? (
              <p className="text-sm opacity-60">None yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {list.map((t) => (
                  <li key={t.id}>
                    <TemplateCard
                      template={t}
                      open={openId === t.id}
                      onToggle={() => setOpenId(openId === t.id ? null : t.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TemplateCard({
  template,
  open,
  onToggle,
}: {
  template: Template;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject_tpl);
  const [body, setBody] = useState(template.body_tpl);
  const [isDefault, setIsDefault] = useState(template.is_default);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unknown = useMemo(
    () => missingVars(subject, body).filter((v) => !KNOWN.includes(v)),
    [subject, body],
  );

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          subjectTpl: subject,
          bodyTpl: body,
          kind: template.kind,
          isDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      onToggle();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <button onClick={onToggle} className="flex w-full items-baseline gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {template.name}
            {template.is_default && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
                default
              </span>
            )}
          </span>
          <span className="block truncate text-xs opacity-60">
            {template.subject_tpl || "Re: … (inherits the original subject)"}
          </span>
        </span>
        <span className="text-xs opacity-40">{open ? "close" : "edit"}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3 border-t border-black/10 pt-4 dark:border-white/10">
          <label className="flex flex-col gap-1">
            <span className={label}>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>
              Subject
              {template.kind === "followup" && " — blank inherits “Re: …”"}
            </span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={field}
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className={label}>Body</span>
            <RichEditor value={body} onChange={setBody} minHeight="14rem" />
          </div>

          {unknown.length > 0 && (
            <p className="rounded border border-amber-400/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
              Outpost cannot fill {unknown.map((v) => `{{${v}}}`).join(", ")} — you
              will have to type those by hand on every draft.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Use this {template.kind === "followup" ? "follow-up" : "outreach"} template
            by default
          </label>

          <div className="flex items-center gap-2">
            <button onClick={save} disabled={busy} className={btn}>
              Save
            </button>
            <button onClick={onToggle} disabled={busy} className={btnGhost}>
              Cancel
            </button>
            <button onClick={remove} disabled={busy} className={`${btnDanger} ml-auto`}>
              Delete
            </button>
          </div>
          {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
