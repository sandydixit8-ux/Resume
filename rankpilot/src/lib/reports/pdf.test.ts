import { describe, expect, it } from "vitest";
import { toPdf, toWinAnsi } from "./pdf";

const base = {
  website: "shop.example",
  generatedAt: "2026-01-01T00:00:00.000Z",
  disclaimer: "Observed crawl data only.",
  summary: [{ label: "Pages crawled", value: "12" }],
  issues: [{ severity: "critical", title: "Missing meta description" }],
  keywords: [{ term: "buy running shoes", current_rank: 3 }],
};

/** Reads the declared /Length of the content stream object. */
function declaredLength(pdf: string): number {
  const m = pdf.match(/\/Length (\d+) >>\nstream\n/);
  if (!m) throw new Error("no stream length declared");
  return Number(m[1]);
}

/** Actual byte length between "stream\n" and "\nendstream". */
function actualStreamBytes(pdf: string): number {
  const start = pdf.indexOf("stream\n") + "stream\n".length;
  const end = pdf.indexOf("\nendstream");
  return Buffer.byteLength(pdf.slice(start, end), "utf8");
}

function xrefOffsets(pdf: string): number[] {
  const table = pdf.slice(pdf.indexOf("xref\n"));
  return [...table.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
}

describe("toWinAnsi", () => {
  it("keeps plain ascii untouched", () => {
    expect(toWinAnsi("Title - with (parens)")).toBe("Title - with (parens)");
  });

  it("folds typographic characters WinAnsiEncoding can represent", () => {
    expect(toWinAnsi("it\u2019s \u201cfine\u201d \u2014 really")).toBe("it's \"fine\" - really");
  });

  it("replaces characters the base font cannot display", () => {
    expect(toWinAnsi("caf\u00e9")).toBe("caf\u00e9");
    expect(toWinAnsi("\u5bff\u53f8")).toBe("??");
    // A surrogate pair is a single code point, so it folds to one "?" not two.
    expect(toWinAnsi("emoji \ud83d\ude00")).toBe("emoji ?");
  });
});

describe("toPdf", () => {
  it("produces a well-formed single-page document", () => {
    const pdf = toPdf(base);
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("/Type /Catalog");
    expect(pdf).toContain("startxref");
  });

  it("declares the true byte length of the content stream", () => {
    for (const keyword of ["plain ascii", "caf\u00e9 na\u00efve", "it\u2019s \u201cfine\u201d", "\u5bff\u53f8", "emoji \ud83d\ude00"]) {
      const pdf = toPdf({ ...base, keywords: [{ term: keyword, current_rank: 1 }] });
      expect(declaredLength(pdf), keyword).toBe(actualStreamBytes(pdf));
    }
  });

  it("keeps every xref offset pointing at its object after multibyte text", () => {
    // The bug this guards: offsets computed on JS string length while the file
    // is written UTF-8, so one multibyte character invalidates the whole table.
    const pdf = toPdf({
      ...base,
      keywords: [{ term: "\u5bff\u53f8\u5bff\u53f8", current_rank: 1 }],
      issues: [{ severity: "high", title: "caf\u00e9 \u2014 na\u00efve \ud83d\ude00" }],
    });
    const offsets = xrefOffsets(pdf);
    expect(offsets.length).toBe(5);
    offsets.forEach((off, i) => {
      const at = Buffer.from(pdf, "utf8").subarray(off).toString("utf8");
      expect(at, `object ${i + 1} offset ${off}`).toMatch(new RegExp(`^${i + 1} 0 obj`));
    });
  });

  it("points startxref at the xref table", () => {
    const pdf = toPdf({ ...base, keywords: [{ term: "\u00e9\u00e9\u00e9", current_rank: 1 }] });
    const declared = pdf.match(/startxref\s+(\d+)/);
    expect(declared).not.toBeNull();
    const bytes = Buffer.from(pdf, "utf8");
    expect(bytes.subarray(Number(declared![1])).toString("utf8").startsWith("xref\n")).toBe(true);
  });

  it("escapes characters that would otherwise close the string early", () => {
    const pdf = toPdf({ ...base, keywords: [{ term: "shoes) Tj ET (injected", current_rank: 1 }] });
    expect(pdf).toContain("shoes\\) Tj ET \\(injected");
  });

  it("keeps a numeric rank readable and falls back honestly when missing", () => {
    const withRank = toPdf(base);
    expect(withRank).toContain("rank: 3");
    const without = toPdf({ ...base, keywords: [{ term: "x", current_rank: null }] });
    expect(without).toContain("Data unavailable");
  });

  it("caps the content to a single page", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ term: `kw ${i}`, current_rank: i }));
    const pdf = toPdf({ ...base, keywords: many });
    expect(pdf.match(/\) Tj T\*/g)?.length).toBeLessThanOrEqual(60);
  });
});
