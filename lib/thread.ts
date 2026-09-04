/**
 * RFC 5322 threading. Two small rules, both easy to get subtly wrong, so they
 * live here on their own and are tested directly.
 */

/** "Re: x" exactly once, whatever the original looked like. */
export function replySubject(original: string): string {
  const trimmed = original.trim();
  if (!trimmed) return "Re:";
  // Strips any run of Re:/RE:/re : prefixes, including "Re[2]:" from older clients.
  const bare = trimmed.replace(/^(\s*re\s*(\[\d+\])?\s*:\s*)+/i, "");
  return `Re: ${bare}`;
}

/** Max ancestors to carry. Real clients trim; unbounded headers get rejected. */
const MAX_REFERENCES = 20;

/**
 * References for a reply = the parent's References, then the parent's own
 * Message-Id. When the chain grows too long, keep the root (which is what
 * clients thread on) and the most recent links.
 */
export function buildReferences(
  parentReferences: string | null | undefined,
  parentMessageId: string,
): string {
  const parts = (parentReferences ?? "").split(/\s+/).filter(Boolean);
  if (parentMessageId && !parts.includes(parentMessageId)) {
    parts.push(parentMessageId);
  }
  if (parts.length <= MAX_REFERENCES) return parts.join(" ");
  return [parts[0], ...parts.slice(-(MAX_REFERENCES - 1))].join(" ");
}
