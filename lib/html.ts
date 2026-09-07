import sanitizeHtml from "sanitize-html";
import { convert } from "html-to-text";

/**
 * Email HTML is not web HTML. Clients strip <style> blocks, ignore classes and
 * mangle layout, so the allowlist here is deliberately tiny: the marks a person
 * actually uses when writing an email, and nothing else. Everything outside it
 * is dropped, which is also what defuses a paste from Word or a web page.
 */
const ALLOWED: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li", "blockquote",
  ],
  allowedAttributes: { a: ["href"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  // No classes, no inline styles, no ids -- that is the whole point.
  allowedClasses: {},
  transformTags: {
    b: "strong",
    i: "em",
    strike: "s",
    del: "s",
    // Headings and divs collapse to paragraphs rather than vanishing.
    h1: "p", h2: "p", h3: "p", h4: "p", h5: "p", h6: "p", div: "p",
  },
  nonTextTags: ["style", "script", "textarea", "option", "noscript"],
};

/**
 * A rich-text editor can split a placeholder across markup when you bold half
 * of it: {{first<strong>_name}}</strong>. The template renderer would then miss
 * it and the email would go out saying "Hi {{first_name}}". Tags never contain
 * "}", so a non-greedy match between braces reliably finds the broken ones.
 */
function repairPlaceholders(html: string): string {
  return html.replace(/\{\{[^}]*?\}\}/g, (match) =>
    match.replace(/<[^>]+>/g, ""),
  );
}

/** Sanitize, repair placeholders, then sanitize again to rebalance any tag
 *  the repair pass orphaned. */
export function sanitizeEmailHtml(dirty: string): string {
  const once = sanitizeHtml(dirty ?? "", ALLOWED);
  const repaired = repairPlaceholders(once);
  return repaired === once ? once : sanitizeHtml(repaired, ALLOWED);
}

/** The text/plain alternative. Always sent alongside the HTML -- a message
 *  with no plain-text part looks like bulk mail to spam filters. */
export function htmlToPlainText(html: string): string {
  return convert(html ?? "", {
    wordwrap: 78,
    selectors: [
      { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
      { selector: "ul", options: { itemPrefix: "- " } },
    ],
  }).trim();
}

/** Legacy plain text -> HTML, for anything written before rich text existed. */
export function plainTextToHtml(text: string): string {
  const esc = (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .split(/\r?\n\r?\n/)
    .map((p) => `<p>${p.replace(/\r?\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Styles must be inline by the time an email leaves: <style> blocks are
 * stripped by Gmail and most webmail. Applied at send time only, so what is
 * stored stays clean and re-editable.
 */
const INLINE: [RegExp, string][] = [
  [/<p>/g, '<p style="margin:0 0 1em 0">'],
  [/<ul>/g, '<ul style="margin:0 0 1em 0;padding-left:1.5em">'],
  [/<ol>/g, '<ol style="margin:0 0 1em 0;padding-left:1.5em">'],
  [/<li>/g, '<li style="margin:0 0 .25em 0">'],
  [
    /<blockquote>/g,
    '<blockquote style="margin:0 0 1em 0;padding-left:1em;border-left:3px solid #d0d7d5;color:#555">',
  ],
  [/<a /g, '<a style="color:#0e6b58" '],
];

export function toEmailHtml(storedHtml: string): string {
  let body = storedHtml ?? "";
  for (const [pattern, replacement] of INLINE) body = body.replace(pattern, replacement);
  return `<div style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111">${body}</div>`;
}
