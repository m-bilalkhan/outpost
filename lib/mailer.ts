import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { ImapFlow } from "imapflow";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __outpostSmtp: nodemailer.Transporter | undefined;
}

export function smtp(): nodemailer.Transporter {
  if (globalThis.__outpostSmtp) return globalThis.__outpostSmtp;
  const t = nodemailer.createTransport({
    host: "mail.privateemail.com",
    port: 465,
    secure: true, // implicit TLS
    auth: { user: env.mailUser, pass: env.mailPassword },
    pool: true,
    maxConnections: 1,
    rateDelta: 1000,
    rateLimit: 2,
  });
  globalThis.__outpostSmtp = t;
  return t;
}

export type OutgoingMail = {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
  messageId: string;
};

/** Build the exact bytes once, so SMTP and the Sent folder agree. */
export async function buildRaw(mail: OutgoingMail): Promise<Buffer> {
  const composer = new MailComposer({
    from: { name: env.mailFromName, address: env.mailUser },
    to: mail.toName ? { name: mail.toName, address: mail.to } : mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    messageId: mail.messageId,
  });
  return await new Promise<Buffer>((resolve, reject) => {
    composer.compile().build((err, message) => {
      if (err) reject(err);
      else resolve(message);
    });
  });
}

export async function sendRaw(raw: Buffer, to: string): Promise<void> {
  await smtp().sendMail({
    envelope: { from: env.mailUser, to: [to] },
    raw,
  });
}

/**
 * File a copy in the Sent folder. Best effort: the mail has already gone out,
 * so a failure here is logged, never fatal.
 */
export async function appendToSent(raw: Buffer): Promise<string> {
  const client = new ImapFlow({
    host: "mail.privateemail.com",
    port: 993,
    secure: true,
    auth: { user: env.mailUser, pass: env.mailPassword },
    logger: false,
  });
  await client.connect();
  try {
    let target: string | null = null;
    for (const box of await client.list()) {
      const special = (box as { specialUse?: string }).specialUse;
      if (special === "\\Sent") {
        target = box.path;
        break;
      }
      if (!target && /^(sent|inbox\.sent|sent items)$/i.test(box.path)) {
        target = box.path;
      }
    }
    if (!target) throw new Error("no Sent mailbox found");
    await client.append(target, raw, ["\\Seen"], new Date());
    return target;
  } finally {
    await client.logout().catch(() => {});
  }
}

/** Failure notices to yourself. Deliberately does not go through the queue. */
export async function sendAlert(subject: string, body: string): Promise<void> {
  await smtp().sendMail({
    from: { name: env.mailFromName || "Outpost", address: env.mailUser },
    to: env.alertTo,
    subject: `[Outpost] ${subject}`,
    text: body,
  });
}
