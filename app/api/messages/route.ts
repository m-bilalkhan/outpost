import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { guessFromEmail, render } from "@/lib/template";
import { htmlToPlainText, sanitizeEmailHtml } from "@/lib/html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email(),
  templateId: z.string().uuid().optional(),
});

type Contact = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  role: string | null;
};

type Template = {
  id: string;
  subject_tpl: string;
  body_tpl: string;
  default_vars: Record<string, string>;
};

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const guess = guessFromEmail(email);

  // Guesses only fill blanks -- anything you have already corrected wins.
  const [contact] = await sql<Contact[]>`
    insert into contacts (email, first_name, last_name, company)
    values (${email}, ${guess.firstName || null}, ${guess.lastName || null}, ${guess.company || null})
    on conflict (email) do update set
      first_name = coalesce(contacts.first_name, excluded.first_name),
      last_name  = coalesce(contacts.last_name,  excluded.last_name),
      company    = coalesce(contacts.company,    excluded.company),
      updated_at = now()
    returning id, email, first_name, last_name, company, role
  `;

  const [template] = parsed.data.templateId
    ? await sql<Template[]>`
        select id, subject_tpl, body_tpl, default_vars from templates
        where id = ${parsed.data.templateId}
      `
    : await sql<Template[]>`
        select id, subject_tpl, body_tpl, default_vars from templates
        order by is_default desc, created_at limit 1
      `;

  if (!template) {
    return NextResponse.json(
      { error: "No template found. Add one to the templates table first." },
      { status: 400 },
    );
  }

  const vars = {
    ...template.default_vars,
    first_name: contact.first_name,
    last_name: contact.last_name,
    company: contact.company,
    role: contact.role,
    email: contact.email,
    my_name: env.mailFromName,
  };

  const subject = render(template.subject_tpl, vars);
  // Template bodies are HTML. body_text is derived, never authored.
  const bodyHtml = sanitizeEmailHtml(render(template.body_tpl, vars));
  const bodyText = htmlToPlainText(bodyHtml);

  const [message] = await sql<{ id: string }[]>`
    insert into messages (contact_id, template_id, to_email, to_name, subject, body_text, body_html)
    values (
      ${contact.id}, ${template.id}, ${contact.email},
      ${[contact.first_name, contact.last_name].filter(Boolean).join(" ") || null},
      ${subject}, ${bodyText}, ${bodyHtml}
    )
    returning id
  `;

  return NextResponse.json({ id: message.id });
}
