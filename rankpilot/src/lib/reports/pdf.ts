/**
 * Minimal single-page PDF (Helvetica text) — no external dependency.
 *
 * PDF offsets and stream `/Length` are **byte** counts, so they must be computed
 * on the encoded bytes. Computing them on JavaScript string lengths silently
 * corrupts the file as soon as the report contains a non-ASCII character — which
 * crawled titles and keywords routinely do (accents, curly quotes, em dashes).
 *
 * Helvetica uses WinAnsiEncoding, which cannot represent arbitrary Unicode, so
 * text is folded to that encoding here rather than emitting bytes a viewer will
 * mis-render or reject.
 */

const WINANSI_EXTRA: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201a": ",",
  "\u201c": '"',
  "\u201d": '"',
  "\u201e": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2022": "\u2022",
  "\u2026": "...",
  "\u00a0": " ",
};

/** Fold text to the single-byte range WinAnsiEncoding can actually display. */
export function toWinAnsi(text: string): string {
  let out = "";
  for (const ch of text) {
    const mapped = WINANSI_EXTRA[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    const printable = code === 9 || (code >= 0x20 && code !== 0x7f);
    out += printable && code <= 0xff ? ch : "?";
  }
  return out;
}

export interface PdfInput {
  website: string;
  generatedAt: string;
  disclaimer: string;
  summary: Array<{ label: string; value: string }>;
  issues: Array<Record<string, unknown>>;
  keywords: Array<Record<string, unknown>>;
}

export function toPdf(s: PdfInput): string {
  const textLines: string[] = [
    "RankPilot AI Report",
    `Website: ${s.website}`,
    `Generated: ${s.generatedAt}`,
    "",
    s.disclaimer,
    "",
    ...s.summary.map((m) => `${m.label}: ${m.value}`),
    "",
    "Top issues:",
    ...s.issues.slice(0, 15).map((i) => `- [${i.severity}] ${i.title}`),
    "",
    "Keywords (first 10):",
    ...s.keywords
      .slice(0, 10)
      .map((k) => `- ${k.term} (rank: ${k.current_rank ?? "Data unavailable"})`),
  ];

  const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  let stream = "BT /F1 11 Tf 50 780 Td 16 TL\n";
  for (const line of textLines.slice(0, 60)) {
    stream += `(${esc(toWinAnsi(line).slice(0, 95))}) Tj T*\n`;
  }
  stream += "ET";

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [i, obj] of objects.entries()) {
    // Byte offset, not string index: the file is written as UTF-8.
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}
