import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("quotes cells containing separators per RFC 4180", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("neutralises a formula in a crawled page title", () => {
    // This is the attack: a third-party page sets its <title> to a formula and
    // the victim's spreadsheet executes it when the report is opened.
    const payload = '=HYPERLINK("http://evil.example/steal","Click for report")';
    const cell = csvCell(payload);
    // The guard is the leading apostrophe on the field value; RFC-4180 quoting
    // may wrap the whole cell around it.
    expect(cell.replace(/^"/, "")).toMatch(/^'/);
    expect(cell.replace(/^"/, "")).not.toMatch(/^=/);
  });

  it("neutralises every spreadsheet formula trigger", () => {
    for (const payload of [
      "=1+1",
      "+1+1",
      "-1+1",
      "@SUM(A1:A9)",
      "\t=1+1",
      "\r=1+1",
      "=cmd|'/c calc'!A0",
      "=HYPERLINK(\"http://x\",\"y\")",
    ]) {
      expect(csvCell(payload), payload).not.toMatch(/^[=+\-@\t\r]/);
    }
  });

  it("neutralises a payload hidden behind quoting", () => {
    const payload = '="a"&"b"';
    expect(csvCell(payload)).toContain("'=");
    expect(csvCell(payload).replace(/^"/, "")).toMatch(/^'/);
  });

  it("keeps real numbers numeric so spreadsheet maths still works", () => {
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(-0.5)).toBe("-0.5");
    expect(csvCell("+3")).toBe("+3");
  });

  it("still blocks a formula that merely looks numeric", () => {
    expect(csvCell("-2+3")).not.toMatch(/^-/);
    expect(csvCell("+1+1")).not.toMatch(/^\+/);
  });
});

describe("toCsv", () => {
  const snapshot = {
    meta: { disclaimer: "Observed crawl data only." },
    summary: [{ label: "Pages crawled", value: "12" }],
    score: { components: { content: 80, technical: 60 } },
    issues: [
      { code: "missing_title", severity: "critical", category: "content", title: '=HYPERLINK("http://evil","x")', status: "open" },
    ],
    keywords: [{ term: "=cmd|'/c calc'!A0", intent: "informational", volume: 10, difficulty: 5, current_rank: null, occurrences: 1 }],
    pages: [{ url: "https://shop.example/p", title: '=1+1', word_count: 100, status_code: 200, is_indexable: 1, images_missing_alt: 0 }],
  };

  it("guards every cell that came from a crawled page", () => {
    const csv = toCsv({ ...snapshot, componentLabels: { content: "Content" } });
    expect(csv).not.toMatch(/^.*,=HYPERLINK/m);
    expect(csv).not.toMatch(/,=cmd/m);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'=cmd");
    expect(csv).toContain("'=1+1");
  });

  it("keeps the report structure and friendly labels", () => {
    const csv = toCsv({ ...snapshot, componentLabels: { content: "Content Quality" } });
    expect(csv).toContain("# Observed crawl data only.");
    expect(csv).toContain("summary,Pages crawled,12");
    expect(csv).toContain("component,Content Quality,80");
    expect(csv).toContain("keyword,intent,volume,difficulty,rank,occurrences");
    expect(csv).toContain("page_url,title,words,status,indexable,missing_alt");
  });

  it("leaves an unlabelled component using its key rather than dropping it", () => {
    const csv = toCsv(snapshot);
    expect(csv).toContain("component,technical,60");
  });

  it("omits the usage section unless requested", () => {
    expect(toCsv(snapshot)).not.toContain("cost_usd");
    const withUsage = toCsv({ ...snapshot, usage: [{ task: "content.generate", model: "stub", tokens_in: 10, tokens_out: 20, cost_usd: 0.01, status: "ok", created_at: "2026-01-01" }] });
    expect(withUsage).toContain("cost_usd");
    expect(withUsage).toContain("content.generate");
  });
});
