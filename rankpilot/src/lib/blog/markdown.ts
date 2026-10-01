/**
 * A small Markdown parser producing a plain AST.
 *
 * Why hand-rolled instead of a library: this repository forbids
 * `dangerouslySetInnerHTML` everywhere (see xss-guard.test.ts), which rules out
 * every renderer that works by producing an HTML string. Rather than weaken that
 * guard for a dependency, this parses to a tree and the sibling markdown.tsx
 * renders that tree as React children, which React escapes.
 *
 * Deliberately a documented subset, not CommonMark. Supported: ATX headings,
 * paragraphs, fenced code, blockquotes, ordered/unordered lists (one level of
 * nesting), thematic breaks, and inline code/emphasis/strong/strikethrough/
 * links/images. Unsupported constructs are left as literal text, which is
 * visible and harmless rather than silently misinterpreted.
 *
 * No HTML passthrough. Raw HTML in the source stays escaped text.
 */

export type Inline =
  | { kind: "text"; value: string }
  | { kind: "code"; value: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "strike"; children: Inline[] }
  | { kind: "link"; href: string; title?: string; children: Inline[] }
  | { kind: "image"; src: string; alt: string; title?: string };

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "code"; lang: string; value: string }
  | { kind: "hr" }
  | { kind: "blockquote"; children: Block[] }
  | { kind: "list"; ordered: boolean; start: number; items: Block[][] };

const HR = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const ATX = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
const BLOCKQUOTE = /^ {0,3}>\s?(.*)$/;
const UL_ITEM = /^( {0,7})([-*+])\s+(.*)$/;
const OL_ITEM = /^( {0,7})(\d{1,9})[.)]\s+(.*)$/;

/**
 * Blocks that interrupt a paragraph. Without this, a heading immediately after
 * a line of text is swallowed into the paragraph.
 */
function startsBlock(line: string): boolean {
  return (
    line.trim() === "" ||
    HR.test(line) ||
    ATX.test(line) ||
    FENCE.test(line) ||
    BLOCKQUOTE.test(line) ||
    UL_ITEM.test(line) ||
    OL_ITEM.test(line)
  );
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (HR.test(line)) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    const atx = ATX.exec(line);
    if (atx) {
      const level = atx[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ kind: "heading", level, children: parseInline(atx[2]) });
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const len = fence[1].length;
      const lang = fence[2] ?? "";
      const body: string[] = [];
      i++;
      // An unclosed fence runs to the end of the document, which is what every
      // real implementation does and is the safe failure mode.
      while (i < lines.length) {
        const closing = new RegExp(`^ {0,3}${marker === "`" ? "`" : "~"}{${len},}\\s*$`);
        if (closing.test(lines[i])) {
          i++;
          break;
        }
        body.push(lines[i]);
        i++;
      }
      blocks.push({ kind: "code", lang, value: body.join("\n") });
      continue;
    }

    if (BLOCKQUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && (BLOCKQUOTE.test(lines[i]) || lines[i].trim() !== "")) {
        const m = BLOCKQUOTE.exec(lines[i]);
        body.push(m ? m[1] : lines[i]);
        i++;
      }
      blocks.push({ kind: "blockquote", children: parseBlocks(body) });
      continue;
    }

    const ul = UL_ITEM.exec(line);
    const ol = OL_ITEM.exec(line);
    if (ul || ol) {
      const ordered = Boolean(ol);
      const start = ol ? Number(ol[2]) : 1;
      const items: Block[][] = [];

      while (i < lines.length) {
        const m = ordered ? OL_ITEM.exec(lines[i]) : UL_ITEM.exec(lines[i]);
        if (!m) break;
        // Gather the item's first line plus any indented continuation lines.
        const indent = m[1].length;
        const itemLines = [ordered ? m[3] : m[3]];
        i++;
        while (i < lines.length) {
          const next = lines[i];
          if (next.trim() === "") {
            // A blank line only continues the item if more indented text follows.
            const following = lines[i + 1] ?? "";
            if (/^\s{2,}\S/.test(following)) {
              itemLines.push("");
              i++;
              continue;
            }
            break;
          }
          const lead = /^\s*/.exec(next)?.[0].length ?? 0;
          const isItem = ordered ? OL_ITEM.test(next) : UL_ITEM.test(next);
          if (isItem && lead <= indent) break;
          if (lead > indent || UL_ITEM.test(next) || OL_ITEM.test(next)) {
            itemLines.push(next.slice(indent + 2 > 0 ? indent + 2 : 0));
            i++;
            continue;
          }
          // Lazy continuation of the item's paragraph.
          itemLines.push(next);
          i++;
        }
        items.push(parseBlocks(itemLines));
      }
      blocks.push({ kind: "list", ordered, start, items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && !startsBlock(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    // A paragraph that ran to the end of the document never hits the loop guard
    // above, so it would loop forever. Consume whatever is left.
    if (para.length === 0) para.push(lines[i++]);
    blocks.push({ kind: "paragraph", children: parseInline(para.join("\n").trim()) });
  }

  return blocks;
}

/**
 * Inline patterns.
 *
 * Code spans are ordered first so a `*` inside backticks is literal text.
 *
 * The emphasis patterns carry flanking guards, which is what separates emphasis
 * from multiplication: an opening delimiter must not be FOLLOWED by whitespace,
 * and a closing delimiter must not be PRECEDED by whitespace. Without them
 * "2 * 3 * 4" renders as italics around the 3 and "a ** b" as bold. Note the
 * direction: an opener is allowed to be preceded by a space ("a **b**" is bold),
 * it just may not be followed by one. Same rule CommonMark uses, reduced to the
 * cases that matter for prose.
 */
const INLINE_SOURCE = [
  "`([^`]+)`", // 1: code
  "!\\[([^\\]]*)\\]\\(([^)\\s]+)(?:\\s+\"([^\"]*)\")?\\)", // 2 alt, 3 src, 4 title
  "\\[([^\\]]+)\\]\\(([^)\\s]+)(?:\\s+\"([^\"]*)\")?\\)", // 5 text, 6 href, 7 title
  "(?<!\\*)\\*\\*(?!\\s)([^*]+?)(?<!\\s)\\*\\*(?!\\*)", // 8 strong
  "(?<!~)~~(?!\\s)([^~]+?)(?<!\\s)~~(?!~)", // 9 strike
  "(?<!\\*)\\*(?!\\s)([^*]+?)(?<!\\s)\\*(?![*\\w])", // 10 em
  "(?<![A-Za-z0-9_])_(?!\\s|_)([^_]+?)(?<!\\s)_(?![A-Za-z0-9_])", // 11 em
].join("|");

export function parseInline(src: string): Inline[] {
  // A fresh RegExp per call, not a shared module-level one. parseInline is
  // recursive (emphasis contains inline content), and a /g regex carries
  // `lastIndex` as state on the object: a nested call would move it and the
  // outer loop would resume from the wrong offset, which is an infinite loop
  // rather than a wrong result. Allocating here is what makes recursion safe.
  const re = new RegExp(INLINE_SOURCE, "g");

  const out: Inline[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(src)) !== null) {
    if (match.index > last) out.push({ kind: "text", value: src.slice(last, match.index) });
    last = match.index + match[0].length;

    if (match[1] !== undefined) {
      out.push({ kind: "code", value: match[1] });
    } else if (match[3] !== undefined) {
      out.push({
        kind: "image",
        alt: match[2] ?? "",
        // Unsanitised on purpose: the renderer decides whether to emit it, and
        // a rejected URL renders as inert alt text rather than a broken image.
        src: match[3],
        title: match[4],
      });
    } else if (match[6] !== undefined) {
      out.push({
        kind: "link",
        href: match[6],
        title: match[7],
        children: parseInline(match[5]),
      });
    } else if (match[8] !== undefined) {
      out.push({ kind: "strong", children: parseInline(match[8]) });
    } else if (match[9] !== undefined) {
      out.push({ kind: "strike", children: parseInline(match[9]) });
    } else if (match[10] !== undefined) {
      out.push({ kind: "em", children: parseInline(match[10]) });
    } else if (match[11] !== undefined) {
      out.push({ kind: "em", children: parseInline(match[11]) });
    }
  }

  if (last < src.length) out.push({ kind: "text", value: src.slice(last) });
  return out;
}

export function parseMarkdown(src: string): Block[] {
  return parseBlocks(src.replace(/\r\n?/g, "\n").replace(/\t/g, "  ").split("\n"));
}
