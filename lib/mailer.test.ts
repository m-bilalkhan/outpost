import { beforeAll, describe, expect, it } from "vitest";

// buildRaw() reads env.mailUser/env.mailFromName lazily (on each call), so
// these just need to be set before the assertions run, not before import.
beforeAll(() => {
  process.env.MAIL_USER = "sender@example.com";
  process.env.MAIL_FROM_NAME = "Outpost Test";
});

const { buildRaw } = await import("./mailer");

describe("buildRaw", () => {
  it("sends a first-touch email with no threading headers at all", async () => {
    const raw = await buildRaw({
      to: "lead@example.com",
      subject: "Quick question",
      html: "<p>Hi</p>",
      text: "Hi",
      messageId: "<root-id@example.com>",
    });
    const message = raw.toString("utf8");

    expect(message).toMatch(/^Message-ID: <root-id@example\.com>\r?$/m);
    expect(message).not.toMatch(/^In-Reply-To:/m);
    expect(message).not.toMatch(/^References:/m);
  });

  it("threads a follow-up onto the original via In-Reply-To and References", async () => {
    const raw = await buildRaw({
      to: "lead@example.com",
      subject: "Re: Quick question",
      html: "<p>Following up</p>",
      text: "Following up",
      messageId: "<followup-id@example.com>",
      inReplyTo: "<root-id@example.com>",
      references: "<root-id@example.com>",
    });
    const message = raw.toString("utf8");

    expect(message).toMatch(/^Subject: Re: Quick question\r?$/m);
    expect(message).toMatch(/^In-Reply-To: <root-id@example\.com>\r?$/m);
    expect(message).toMatch(/^References: <root-id@example\.com>\r?$/m);
  });

  it("carries a multi-hop References chain through as a space-separated list", async () => {
    const raw = await buildRaw({
      to: "lead@example.com",
      subject: "Re: Quick question",
      html: "<p>Second follow-up</p>",
      text: "Second follow-up",
      messageId: "<followup-2-id@example.com>",
      inReplyTo: "<followup-id@example.com>",
      references: "<root-id@example.com> <followup-id@example.com>",
    });
    const message = raw.toString("utf8");

    expect(message).toMatch(
      /^References: <root-id@example\.com> <followup-id@example\.com>\r?$/m,
    );
  });
});
