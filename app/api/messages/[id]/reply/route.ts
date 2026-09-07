import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { withErrors } from "@/lib/api";
import { env } from "@/lib/env";
import { render } from "@/lib/template";
import { htmlToPlainText, sanitizeEmailHtml } from "@/lib/html";
import { buildReferences, replySubject } from "@/lib/thread";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ templateId: z.string().uuid().optional() }).default({});

type Source = {
  id: string;
  contact_id: string | null;
  template_id: string | null;
  to_email: string;
  to_name: string | null;
  subject: string;
  status: string;
  smtp_message_id: string | null;
  thread_id: string | null;
  rfc_references: string | null;
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

export const POST = withErrors(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const templateId = parsed.success ? parsed.data.templateId : undefined;

  const [source] = await sql<Source[]>`
    select m.id, m.contact_id, m.template_id, m.to_email, m.to_name, m.subject,
           m.status, m.smtp_message_id, m.thread_id, m.rfc_references,
           c.first_name, c.last_name, c.company, c.role
    from messages m
    left join contacts c on c.id = m.contact_id
    where m.id = ${id}
  `;
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // You can only follow up on something that actually went out -- the
  // Message-Id it earned is what threads the reply.
  if (source.status !== "sent" || !source.smtp_message_id) {
    return NextResponse.json(
      { error: "You can only follow up on a message that has been sent" },
      { status: 409 },
    );
  }

  const [template] = templateId
    ? await sql<Template[]>`
        select id, subject_tpl, body_tpl, default_vars
        from templates where id = ${templateId}
      `
    : await sql<Template[]>`
        select id, subject_tpl, body_tpl, default_vars
        from templates
        where kind = 'followup'
        order by is_default desc, created_at
        limit 1
      `;

  if (!template) {
    return NextResponse.json(
      { error: "No follow-up template found. Create one on the Templates page." },
      { status: 400 },
    );
  }

  const vars = {
    ...template.default_vars,
    first_name: source.first_name,
    last_name: source.last_name,
    company: source.company,
    role: source.role,
    email: source.to_email,
    my_name: env.mailFromName,
  };

  // A follow-up template with a blank subject inherits "Re: <original>",
  // which is what keeps it in the same conversation.
  const subject = template.subject_tpl.trim()
    ? render(template.subject_tpl, vars)
    : replySubject(source.subject);

  const bodyHtml = sanitizeEmailHtml(render(template.body_tpl, vars));
  const bodyText = htmlToPlainText(bodyHtml);
  const references = buildReferences(source.rfc_references, source.smtp_message_id);

  const [message] = await sql<{ id: string }[]>`
    insert into messages (
      contact_id, template_id, to_email, to_name,
      subject, body_text, body_html,
      thread_id, parent_id, in_reply_to, rfc_references
    )
    values (
      ${source.contact_id}, ${template.id}, ${source.to_email}, ${source.to_name},
      ${subject}, ${bodyText}, ${bodyHtml},
      ${source.thread_id ?? source.id}, ${source.id},
      ${source.smtp_message_id}, ${references}
    )
    returning id
  `;

  return NextResponse.json({ id: message.id });
});
