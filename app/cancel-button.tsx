"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchJson } from "@/lib/fetch-json";

export function CancelButton({ messageId }: { messageId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/messages/${messageId}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <button
        onClick={cancel}
        disabled={busy}
        className="text-xs text-red-700 underline-offset-2 hover:underline disabled:opacity-40 dark:text-red-400"
      >
        {busy ? "…" : "cancel"}
      </button>
      {error && (
        <span className="max-w-60 text-right text-[10px] text-red-700 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
