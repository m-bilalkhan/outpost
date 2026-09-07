import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { withErrors } from "@/lib/api";
import { htmlToPlainText, sanitizeEmailHtml } from "@/lib/html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  subject: z.string().max(998),
  bodyHtml: z.string().max(500_000),
});

export const PATCH = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "subject and bodyHtml are required" }, { status: 400 });
  }

  // Never trust what the browser sends: sanitize here, not in the editor.
  const bodyHtml = sanitizeEmailHtml(parsed.data.bodyHtml);

  const rows = await sql<{ id: string }[]>`
    update messages set
      subject    = ${parsed.data.subject},
      body_html  = ${bodyHtml},
      body_text  = ${htmlToPlainText(bodyHtml)},
      updated_at = now()
    where id = ${id} and status in ('draft','scheduled','failed')
    returning id
  `;
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "This message can no longer be edited" },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
});

export const DELETE = withErrors(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;

  const rows = await sql<{ id: string }[]>`
    update messages set status='cancelled', updated_at=now()
    where id = ${id} and status <> 'sent'
    returning id
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Already sent" }, { status: 409 });
  }

  // Stand the job down too, unless it is mid-flight or finished.
  await sql`
    update jobs set status='cancelled', updated_at=now()
    where dedupe_key = ${`email:${id}`} and status in ('pending','running')
  `;

  return NextResponse.json({ ok: true });
});
