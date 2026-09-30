import { describe, expect, it } from "vitest";
import { buildReferences, replySubject } from "./thread";

describe("replySubject", () => {
  it("prefixes a plain subject", () => {
    expect(replySubject("Quick question")).toBe("Re: Quick question");
  });

  it("falls back to a bare 'Re:' for an empty subject", () => {
    expect(replySubject("")).toBe("Re:");
    expect(replySubject("   ")).toBe("Re:");
  });

  it("does not double a subject that is already a reply", () => {
    expect(replySubject("Re: Quick question")).toBe("Re: Quick question");
    expect(replySubject("RE: Quick question")).toBe("Re: Quick question");
    expect(replySubject("re : Quick question")).toBe("Re: Quick question");
  });

  it("collapses a stacked chain of Re: prefixes into one", () => {
    expect(replySubject("Re: Re: Quick question")).toBe("Re: Quick question");
    expect(replySubject("RE: Re: RE: Quick question")).toBe("Re: Quick question");
  });

  it("strips numbered Re[n]: prefixes from older clients", () => {
    expect(replySubject("Re[2]: Quick question")).toBe("Re: Quick question");
  });

  it("does not mangle a subject that merely starts with letters 're'", () => {
    expect(replySubject("Reheat the leftovers")).toBe("Re: Reheat the leftovers");
  });
});

describe("buildReferences", () => {
  it("starts a fresh chain from just the parent's Message-Id", () => {
    expect(buildReferences(null, "<root@x>")).toBe("<root@x>");
    expect(buildReferences(undefined, "<root@x>")).toBe("<root@x>");
  });

  it("appends the parent's Message-Id to its own References", () => {
    expect(buildReferences("<root@x>", "<mid@x>")).toBe("<root@x> <mid@x>");
  });

  it("does not duplicate a Message-Id already present in the chain", () => {
    expect(buildReferences("<root@x> <mid@x>", "<mid@x>")).toBe("<root@x> <mid@x>");
  });

  it("keeps the root plus the most recent links once the chain is too long", () => {
    const oldest = Array.from({ length: 25 }, (_, i) => `<r${i}@x>`);
    const parentReferences = oldest.join(" ");
    const result = buildReferences(parentReferences, "<r25@x>");

    const parts = result.split(" ");
    expect(parts).toHaveLength(20);
    // The root is what clients thread the whole conversation on -- never drop it.
    expect(parts[0]).toBe("<r0@x>");
    // The newest link (the message actually being replied to) must survive.
    expect(parts[parts.length - 1]).toBe("<r25@x>");
    expect(parts).toEqual(["<r0@x>", ...oldest.slice(-18), "<r25@x>"]);
  });
});
