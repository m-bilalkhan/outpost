import { describe, expect, it } from "vitest";
import { quoteOriginal, sanitizeEmailHtml, toEmailHtml } from "./html";

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

describe("video thumbnail", () => {
  const loom = `<a href="https://www.loom.com/share/abc"><img style="max-width:300px;" src="https://www.loom.com/v1/videos/abc/thumbnail.gif"></a>`;

  it("keeps an https image inside its link and drops style", () => {
    const out = sanitizeEmailHtml(loom);
    expect(out).toContain('<img src="https://www.loom.com/v1/videos/abc/thumbnail.gif"');
    expect(out).toContain('<a href="https://www.loom.com/share/abc">');
    expect(out).not.toContain("style=");
  });

  it("drops non-https image sources", () => {
    expect(sanitizeEmailHtml('<img src="data:image/gif;base64,AAAA">')).not.toContain("<img");
    expect(sanitizeEmailHtml('<img src="http://x.test/a.gif">')).not.toContain("<img");
  });

  it("sizes the image at send time", () => {
    const out = toEmailHtml(sanitizeEmailHtml(loom));
    expect(out).toContain("width:100%;max-width:720px;height:auto");
    expect(out).toContain('width="720"');
  });

  it("centres a lone Loom text link, but not a link inside a sentence", () => {
    const link = '<a href="https://www.loom.com/share/abc">Watch the video</a>';
    const out = toEmailHtml(sanitizeEmailHtml(`<p>${link}</p><p>See ${link} and <a href="https://x.test/">this</a></p>`));
    expect(out).toMatch(/text-align:center"><a [^>]*>Watch the video<\/a><\/p>/);
    expect(out.match(/text-align:center/g)).toHaveLength(1);
  });

  it("centres a paragraph that holds only the thumbnail, not text", () => {
    const out = toEmailHtml(sanitizeEmailHtml(`<p>Hello</p><p>${loom}</p>`));
    expect(out).toContain('<p style="margin:0 0 1em 0">Hello</p>');
    expect(out).toMatch(/<p style="margin:0 0 1em 0;text-align:center"><a [^>]*><img /);
  });
});
