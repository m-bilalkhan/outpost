import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { appendToSent, buildRaw, sendRaw } from "@/lib/mailer";
import { missingVars } from "@/lib/template";
import { logEvent, PermanentError, register } from "../registry";

type MessageRow = {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  body_html: string;
  body_text: string;
  status: string;
  smtp_message_id: string | null;
  in_reply_to: string | null;
  rfc_references: string | null;
};

register("email.send", {
  async run(payload, ctx) {
    const messageId = String(payload.messageId ?? "");
    if (!messageId) throw new PermanentError("payload.messageId is required");

    const [msg] = await sql<MessageRow[]>`
      select id, to_email, to_name, subject, body_html, body_text, status,
             smtp_message_id, in_reply_to, rfc_references
      from messages where id = ${messageId}
    `;
    if (!msg) throw new PermanentError(`message ${messageId} not found`);
    if (msg.status === "cancelled") return { skipped: "message cancelled" };

    // Idempotency: if SMTP already accepted this, a retry must not resend.
    if (msg.smtp_message_id) {
      return { skipped: "already sent", smtpMessageId: msg.smtp_message_id };
    }

    // Last line of defence -- the UI blocks this, but a job could be older
    // than an edit that reintroduced a placeholder.
    const unresolved = missingVars(msg.subject, msg.body_text);
    if (unresolved.length) {
      throw new PermanentError(
        `unrendered variables: ${unresolved.map((v) => `{{${v}}}`).join(", ")}`,
      );
    }

    const domain = env.mailUser.split("@")[1] ?? "localhost";
    const rfcMessageId = `<${randomUUID()}@${domain}>`;

    const raw = await buildRaw({
      to: msg.to_email,
      toName: msg.to_name,
      subject: msg.subject,
      html: msg.body_html,
      text: msg.body_text,
      messageId: rfcMessageId,
      inReplyTo: msg.in_reply_to,
      references: msg.rfc_references,
    });

    await sendRaw(raw, msg.to_email);

    // Record the send before anything else can throw.
    await sql`
      update messages set status='sent', sent_at=now(),
                          smtp_message_id=${rfcMessageId},
                          last_error=null, updated_at=now()
      where id = ${messageId}
    `;

    // Best effort -- the mail is already gone, so this never fails the job.
    let sentFolder: string | null = null;
    try {
      sentFolder = await appendToSent(raw);
    } catch (e) {
      await logEvent(ctx.jobId, "warn", "IMAP append to Sent failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    return { smtpMessageId: rfcMessageId, sentFolder, to: msg.to_email };
  },

  async onFail(payload, _ctx, error) {
    const messageId = String(payload.messageId ?? "");
    if (!messageId) return;
    await sql`
      update messages set status='failed', last_error=${error.message}, updated_at=now()
      where id = ${messageId} and status <> 'sent'
    `;
  },
});
