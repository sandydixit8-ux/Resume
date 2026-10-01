/**
 * CSV export. Report cells contain crawled page titles and keyword terms taken
 * from third-party sites, so they are attacker-controlled: a page titled
 * `=HYPERLINK("http://evil","click")` would otherwise execute as a formula the
 * moment someone opens the export in Excel or LibreOffice.
 */

const FORMULA_LEAD = /^[=+\-@\t\r\n]/;

export function csvCell(v: unknown): string {
  const str = v === null || v === undefined ? "" : String(v);
  // A leading apostrophe marks the cell as text for spreadsheet applications.
  // Numeric-looking values are left alone so negative scores and deltas stay
  // computable in the spreadsheet instead of degrading to text.
  const guarded = FORMULA_LEAD.test(str) && !Number.isFinite(Number(str)) ? `'${str}` : str;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export interface CsvSnapshot {
  meta: { disclaimer: string };
  summary: Array<{ label: string; value: string }>;
  score?: { components: Record<string, number> };
  issues: Array<Record<string, unknown>>;
  keywords: Array<Record<string, unknown>>;
  pages: Array<Record<string, unknown>>;
  usage?: Array<Record<string, unknown>>;
  componentLabels?: Record<string, string>;
}

export function toCsv(s: CsvSnapshot): string {
  const labels = s.componentLabels ?? {};
  const lines: string[] = [`# ${s.meta.disclaimer}`];
  lines.push("section,label,value");
  for (const m of s.summary) lines.push(`summary,${csvCell(m.label)},${csvCell(m.value)}`);
  if (s.score) {
    for (const [k, v] of Object.entries(s.score.components)) {
      lines.push(`component,${csvCell(labels[k] ?? k)},${csvCell(v)}`);
    }
  }
  lines.push("");
  lines.push("issue_code,severity,category,title,status");
  for (const i of s.issues) {
    lines.push([i.code, i.severity, i.category, i.title, i.status].map(csvCell).join(","));
  }
  lines.push("");
  lines.push("keyword,intent,volume,difficulty,rank,occurrences");
  for (const k of s.keywords) {
    lines.push(
      [k.term, k.intent, k.volume, k.difficulty, k.current_rank, k.occurrences].map(csvCell).join(",")
    );
  }
  lines.push("");
  lines.push("page_url,title,words,status,indexable,missing_alt");
  for (const p of s.pages) {
    lines.push(
      [p.url, p.title, p.word_count, p.status_code, p.is_indexable, p.images_missing_alt]
        .map(csvCell)
        .join(",")
    );
  }
  if (s.usage) {
    lines.push("");
    lines.push("task,model,tokens_in,tokens_out,cost_usd,status,created_at");
    for (const u of s.usage) {
      lines.push(
        [u.task, u.model, u.tokens_in, u.tokens_out, u.cost_usd, u.status, u.created_at]
          .map(csvCell)
          .join(",")
      );
    }
  }
  return lines.join("\n");
}
