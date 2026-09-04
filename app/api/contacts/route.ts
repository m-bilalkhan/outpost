import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { guessFromEmail } from "@/lib/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Create = z.object({
  email: z.string().email(),
  firstName: z.string().max(120).optional(),
  lastName: z.string().max(120).optional(),
  company: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
});

export async function GET() {
  const rows = await sql`
    select id, email, first_name, last_name, company, role, notes, created_at
    from contacts order by created_at desc
  `;
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const guess = guessFromEmail(email);

  const [row] = await sql<{ id: string }[]>`
    insert into contacts (email, first_name, last_name, company, role, notes)
    values (
      ${email},
      ${parsed.data.firstName || guess.firstName || null},
      ${parsed.data.lastName || guess.lastName || null},
      ${parsed.data.company || guess.company || null},
      ${parsed.data.role || null},
      ${parsed.data.notes || null}
    )
    on conflict (email) do update set updated_at = now()
    returning id
  `;
  return NextResponse.json({ id: row.id });
}
