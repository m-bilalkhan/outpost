"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelButton({ messageId }: { messageId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    try {
      await fetch(`/api/messages/${messageId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={cancel}
      disabled={busy}
      className="shrink-0 text-xs text-red-700 underline-offset-2 hover:underline disabled:opacity-40 dark:text-red-400"
    >
      {busy ? "…" : "cancel"}
    </button>
  );
}
