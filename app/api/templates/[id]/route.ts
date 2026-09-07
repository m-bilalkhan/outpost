import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { sanitizeEmailHtml } from "@/lib/html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  name: z.string().min(1).max(120),
  subjectTpl: z.string().max(998),
  bodyTpl: z.string(),
  kind: z.enum(["outreach", "followup"]),
  isDefault: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Name, subject, body and kind are required" },
      { status: 400 },
    );
  }
  const t = parsed.data;

  const updated = await sql.begin(async (tx) => {
    if (t.isDefault) {
      await tx`
        update templates set is_default = false
        where is_default and kind = ${t.kind} and id <> ${id}
      `;
    }
    const rows = await tx<{ id: string }[]>`
      update templates set
        name        = ${t.name},
        subject_tpl = ${t.subjectTpl},
        body_tpl    = ${sanitizeEmailHtml(t.bodyTpl)},
        kind        = ${t.kind},
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

  const [target] = await sql<{ kind: string; is_default: boolean }[]>`
    select kind, is_default from templates where id = ${id}
  `;
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Composing needs an outreach template; following up needs a follow-up one.
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from templates where kind = ${target.kind}
  `;
  if (count <= 1) {
    return NextResponse.json(
      {
        error: `This is your only ${target.kind === "followup" ? "follow-up" : "outreach"} template. Create another one first.`,
      },
      { status: 409 },
    );
  }

  await sql`delete from templates where id = ${id}`;

  // Never leave a kind without a default to fall back on.
  if (target.is_default) {
    await sql`
      update templates set is_default = true
      where id = (
        select id from templates where kind = ${target.kind}
        order by created_at limit 1
      )
    `;
  }

  return NextResponse.json({ ok: true });
}
