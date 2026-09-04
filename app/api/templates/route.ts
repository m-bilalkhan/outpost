import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Create = z.object({
  name: z.string().min(1).max(120),
  subjectTpl: z.string().max(998).default(""),
  bodyTpl: z.string().default(""),
  isDefault: z.boolean().default(false),
});

export async function GET() {
  const rows = await sql`
    select id, name, subject_tpl, body_tpl, is_default, updated_at
    from templates order by is_default desc, name
  `;
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A template name is required" }, { status: 400 });
  }
  const t = parsed.data;

  const id = await sql.begin(async (tx) => {
    // Only one row may carry is_default -- there is a unique index on it.
    if (t.isDefault) {
      await tx`update templates set is_default = false where is_default`;
    }
    const [row] = await tx<{ id: string }[]>`
      insert into templates (name, subject_tpl, body_tpl, is_default)
      values (${t.name}, ${t.subjectTpl}, ${t.bodyTpl}, ${t.isDefault})
      returning id
    `;
    return row.id;
  });

  return NextResponse.json({ id });
}
