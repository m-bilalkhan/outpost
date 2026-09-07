"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { btn } from "../../ui";

export function FollowUpButton({ messageId }: { messageId: string }) {
  const router = useRouter();
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
          body: "{}",
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
      <div>
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
