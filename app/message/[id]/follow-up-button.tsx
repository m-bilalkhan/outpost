"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { btn } from "../../ui";

type Template = { id: string; name: string };

export function FollowUpButton({
  messageId,
  templates,
}: {
  messageId: string;
  templates: Template[];
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const data = await fetchJson<{ id: string }>(
        `/api/messages/${messageId}/reply`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ templateId: templateId || undefined }),
        },
      );
      router.push(`/message/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
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
        <button onClick={start} disabled={busy} className={btn}>
          {busy ? "Drafting…" : "Write follow-up"}
        </button>
      </div>
      <p className="text-xs opacity-50">
        Drafts a reply in this thread from your follow-up template. Check they
        haven&rsquo;t already replied — Outpost cannot see your inbox.
      </p>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
