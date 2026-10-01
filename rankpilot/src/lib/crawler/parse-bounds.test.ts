import { describe, expect, it } from "vitest";
import { parseHtml } from "./parse";

/** A page built entirely out of headings: the cheapest way to inflate a field. */
function headingFlood(count: number, text = "spam"): string {
  return `<html><body>${"<h3>".concat(text, "</h3>").repeat(count)}</body></html>`;
}

describe("parseHtml bounds", () => {
  it("caps the number of headings so one page cannot flood storage and prompts", () => {
    const facts = parseHtml(headingFlood(5000));
    expect(facts.headings.length).toBeLessThanOrEqual(200);
  });

  it("keeps the cap well above a real page's heading count", () => {
    // A cap low enough to truncate normal pages would quietly lose observed
    // data, which is worse than storing it.
    expect(parseHtml(headingFlood(40)).headings).toHaveLength(40);
  });

  it("keeps the first headings in document order rather than an arbitrary subset", () => {
    const facts = parseHtml("<h2>first</h2>" + headingFlood(5000));
    expect(facts.headings[0]).toEqual({ level: 2, text: "first" });
    expect(facts.headings[1]?.text).toBe("spam");
  });

  it("still reports the true h1 even when the heading list is capped", () => {
    // The cap must not affect the single most important SEO signal.
    const facts = parseHtml(`<h1>Real Title</h1>${headingFlood(5000)}`);
    expect(facts.h1).toBe("Real Title");
  });

  it("bounds each heading's text", () => {
    const facts = parseHtml(`<h2>${"a".repeat(5000)}</h2>`);
    expect(facts.headings[0].text.length).toBeLessThanOrEqual(300);
  });

  it("bounds the text sample", () => {
    const facts = parseHtml(`<body>${"word ".repeat(20000)}</body>`);
    expect(facts.textSample.length).toBeLessThanOrEqual(4000);
  });

  it("stays fast and bounded on a heading flood", () => {
    const started = Date.now();
    const facts = parseHtml(headingFlood(20000));
    // Loose ceiling: the point is that it does not blow up superlinearly.
    expect(Date.now() - started).toBeLessThan(5000);
    expect(JSON.stringify(facts.headings).length).toBeLessThan(200_000);
  });
});
