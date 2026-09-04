import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  name: z.string().min(1).max(120),
  subjectTpl: z.string().max(998),
  bodyTpl: z.string(),
  isDefault: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Name, subject and body are required" }, { status: 400 });
  }
  const t = parsed.data;

  const updated = await sql.begin(async (tx) => {
    if (t.isDefault) {
      await tx`update templates set is_default = false where is_default and id <> ${id}`;
    }
    const rows = await tx<{ id: string }[]>`
      update templates set
        name        = ${t.name},
        subject_tpl = ${t.subjectTpl},
        body_tpl    = ${t.bodyTpl},
        is_default  = ${t.isDefault},
        updated_at  = now()
      where id = ${id}
      returning id
    `;
    return rows.length > 0;
  });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from templates
  `;
  if (count <= 1) {
    return NextResponse.json(
      { error: "This is your only template. Create another one first." },
      { status: 409 },
    );
  }

  const rows = await sql<{ is_default: boolean }[]>`
    delete from templates where id = ${id} returning is_default
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Never leave the app with no default to fall back on.
  if (rows[0].is_default) {
    await sql`
      update templates set is_default = true
      where id = (select id from templates order by created_at limit 1)
    `;
  }

  return NextResponse.json({ ok: true });
}
