import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { withErrors } from "@/lib/api";
import { sanitizeEmailHtml } from "@/lib/html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Kind = z.enum(["outreach", "followup"]);

const Create = z.object({
  name: z.string().min(1).max(120),
  subjectTpl: z.string().max(998).default(""),
  bodyTpl: z.string().default(""),
  kind: Kind.default("outreach"),
  isDefault: z.boolean().default(false),
});

export const GET = withErrors(async () => {
  const rows = await sql`
    select id, name, subject_tpl, body_tpl, kind, is_default, updated_at
    from templates order by kind, is_default desc, name
  `;
  return NextResponse.json(rows);
});

export const POST = withErrors(async (req: Request) => {
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A template name is required" }, { status: 400 });
  }
  const t = parsed.data;

  const id = await sql.begin(async (tx) => {
    // One default per kind -- there is a unique index enforcing it.
    if (t.isDefault) {
      await tx`update templates set is_default = false where is_default and kind = ${t.kind}`;
    }
    const [row] = await tx<{ id: string }[]>`
      insert into templates (name, subject_tpl, body_tpl, kind, is_default)
      values (${t.name}, ${t.subjectTpl}, ${sanitizeEmailHtml(t.bodyTpl)}, ${t.kind}, ${t.isDefault})
      returning id
    `;
    return row.id;
  });

  return NextResponse.json({ id });
});
