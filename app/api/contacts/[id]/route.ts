import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every field optional: the review screen patches one or two at a time. */
const Patch = z.object({
  firstName: z.string().max(120).nullish(),
  lastName: z.string().max(120).nullish(),
  company: z.string().max(200).nullish(),
  role: z.string().max(200).nullish(),
  notes: z.string().max(5000).nullish(),
});

type Row = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  role: string | null;
  notes: string | null;
};

/** "" clears the field; omitted leaves it alone. */
function pick(
  incoming: string | null | undefined,
  current: string | null,
): string | null {
  if (incoming === undefined) return current;
  if (incoming === null) return null;
  const trimmed = incoming.trim();
  return trimmed === "" ? null : trimmed;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nothing valid to update" }, { status: 400 });
  }
  const p = parsed.data;

  const [current] = await sql<Row[]>`
    select id, first_name, last_name, company, role, notes
    from contacts where id = ${id}
  `;
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await sql`
    update contacts set
      first_name = ${pick(p.firstName, current.first_name)},
      last_name  = ${pick(p.lastName, current.last_name)},
      company    = ${pick(p.company, current.company)},
      role       = ${pick(p.role, current.role)},
      notes      = ${pick(p.notes, current.notes)},
      updated_at = now()
    where id = ${id}
  `;

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [pending] = await sql<{ count: number }[]>`
    select count(*)::int as count from messages
    where contact_id = ${id} and status in ('draft','scheduled')
  `;
  if (pending.count > 0) {
    return NextResponse.json(
      {
        error: `${pending.count} draft or scheduled message(s) still use this contact`,
      },
      { status: 409 },
    );
  }
  await sql`delete from contacts where id = ${id}`;
  return NextResponse.json({ ok: true });
}
