"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchJson } from "@/lib/fetch-json";

type Template = { id: string; name: string };

export function ComposeForm({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await fetchJson<{ id: string }>("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, templateId: templateId || undefined }),
      });
      router.push(`/message/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          className="flex-1 rounded border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 dark:border-white/15 dark:bg-white/5"
        />
        {templates.length > 1 && (
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="rounded border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Drafting…" : "Draft"}
        </button>
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </form>
  );
}
