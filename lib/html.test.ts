import { describe, expect, it } from "vitest";
import { quoteOriginal, sanitizeEmailHtml } from "./html";

describe("quoteOriginal", () => {
  const base = {
    fromName: "Bilal from RRP Vault",
    fromEmail: "bilal@rrpvault.com",
    sentAt: new Date("2026-09-04T11:14:27.000Z"),
    tz: "Asia/Karachi",
    bodyHtml: "<p>Hi there, quick question for you.</p>",
  };

  it("wraps the original body in a blockquote under an attribution line", () => {
    const html = quoteOriginal(base);
    expect(html).toContain("<blockquote><p>Hi there, quick question for you.</p></blockquote>");
    expect(html).toMatch(/^<p>On .+ wrote:<\/p>/);
  });

  it("names who wrote it and their address", () => {
    const html = quoteOriginal(base);
    expect(html).toContain("Bilal from RRP Vault &lt;bilal@rrpvault.com&gt;");
  });

  it("falls back to the bare address when there is no display name", () => {
    const html = quoteOriginal({ ...base, fromName: "" });
    expect(html).toContain(">On ");
    expect(html).toContain("bilal@rrpvault.com wrote:");
    expect(html).not.toContain("&lt;bilal@rrpvault.com&gt;");
  });

  it("escapes a display name so it cannot break out of the attribution line", () => {
    const html = quoteOriginal({ ...base, fromName: '<script>alert(1)</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("survives the same sanitize pass the rest of the body goes through", () => {
    const html = quoteOriginal(base);
    const sanitized = sanitizeEmailHtml(`<p>Following up.</p>${html}`);
    expect(sanitized).toContain("<blockquote>");
    expect(sanitized).toContain("Hi there, quick question for you.");
  });
});
