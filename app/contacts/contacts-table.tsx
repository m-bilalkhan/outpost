"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { btn, btnDanger, btnGhost, card, field, label } from "../ui";

export type Contact = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  role: string | null;
  notes: string | null;
};

const EDITABLE = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["company", "Company"],
  ["role", "Role"],
] as const;

const KEY_TO_API = {
  first_name: "firstName",
  last_name: "lastName",
  company: "company",
  role: "role",
} as const;

export function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fetchJson("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });
      setNewEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex gap-2">
        <input
          type="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="new@company.com"
          className={field}
        />
        <button className={btn} disabled={busy}>
          Add
        </button>
      </form>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}

      {contacts.length === 0 ? (
        <p className="text-sm opacity-60">No contacts yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {contacts.map((c) => (
            <li key={c.id}>
              <ContactRow
                contact={c}
                open={openId === c.id}
                onToggle={() => setOpenId(openId === c.id ? null : c.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  open,
  onToggle,
}: {
  contact: Contact;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(contact);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—";

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      for (const [key] of EDITABLE) body[KEY_TO_API[key]] = draft[key] ?? "";
      body.notes = draft.notes ?? "";
      await fetchJson(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
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
      await fetchJson(`/api/contacts/${contact.id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <button
        onClick={onToggle}
        className="flex w-full items-baseline gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs opacity-60">
            {contact.email}
            {contact.company ? ` · ${contact.company}` : ""}
            {contact.role ? ` · ${contact.role}` : ""}
          </span>
        </span>
        <span className="text-xs opacity-40">{open ? "close" : "edit"}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3 border-t border-black/10 pt-4 dark:border-white/10">
          <div className="grid gap-3 sm:grid-cols-2">
            {EDITABLE.map(([key, title]) => (
              <label key={key} className="flex flex-col gap-1">
                <span className={label}>{title}</span>
                <input
                  value={draft[key] ?? ""}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  className={field}
                />
              </label>
            ))}
          </div>
          <label className="flex flex-col gap-1">
            <span className={label}>Notes</span>
            <textarea
              rows={3}
              value={draft.notes ?? ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className={field}
            />
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
