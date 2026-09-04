const VAR_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export type Vars = Record<string, string | null | undefined>;

/** Replace {{var}} with its value. Unknown vars are left in place on purpose,
 *  so the approve guard can refuse to send a half-rendered message. */
export function render(tpl: string, vars: Vars): string {
  return tpl.replace(VAR_RE, (whole, key: string) => {
    const v = vars[key];
    return v === undefined || v === null || v === "" ? whole : v;
  });
}

/**
 * Replace only the named variables, leaving every other placeholder alone.
 * Used when filling one blank on the review screen: a full re-render from the
 * template would throw away whatever you had already edited by hand.
 */
export function substitute(text: string, subs: Record<string, string>): string {
  return text.replace(VAR_RE, (whole, key: string) => subs[key] ?? whole);
}

/** Every {{var}} still present in the text. */
export function missingVars(...texts: string[]): string[] {
  const found = new Set<string>();
  for (const t of texts) {
    for (const m of t.matchAll(VAR_RE)) found.add(m[1]);
  }
  return [...found];
}

const FREE_MAIL = new Set([
  "gmail", "googlemail", "outlook", "hotmail", "live", "yahoo", "ymail",
  "proton", "protonmail", "icloud", "me", "aol", "gmx", "zoho", "mail",
  "yandex", "fastmail", "hey",
]);

function titleCase(s: string): string {
  const clean = s.replace(/[0-9]+/g, "").trim();
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

/** Best-effort guesses from an address alone. Always shown to the user as
 *  editable defaults -- never used silently. */
export function guessFromEmail(email: string): {
  firstName: string;
  lastName: string;
  company: string;
} {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  const parts = local.split(/[._\-+]/).filter(Boolean);
  const firstName = titleCase(parts[0] ?? "");
  const lastName = parts.length > 1 ? titleCase(parts[parts.length - 1]) : "";
  const root = domain.split(".")[0] ?? "";
  const company = FREE_MAIL.has(root) ? "" : titleCase(root);
  return { firstName, lastName, company };
}

/** Minimal, safe text -> html. No markdown engine, no injection surface. */
export function textToHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paras = esc
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111">\n${paras}\n</div>`;
}
