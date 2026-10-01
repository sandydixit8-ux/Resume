/** Claims we never let AI output make, plus numeric metrics not present in the provided context. */

const BANNED_PATTERNS: RegExp[] = [
  /\bguarantee[ds]?\b/i,
  /\bguaranteed (rankings?|traffic|results?)\b/i,
  /\b#1\b|\bnumber one\b/i,
  /\bfirst page of google\b/i,
  /\bfirst-page ranking\b/i,
  /\bgo viral\b|\bgoing viral\b|\bguaranteed viral\b/i,
  /\bboost(?:s|ed)? (?:your )?(?:traffic|rankings?) by \d+/i,
  /\bincrease(?:s|d)? (?:traffic|rankings?) by \d+%/i,
  /\b100% (?:effective|guaranteed|success)\b/i,
];

/** Strip banned guarantee-style claims. Returns cleaned text and the claims that were removed. */
export function scrubClaims(text: string): { text: string; removed: string[] } {
  const removed: string[] = [];
  let out = text;
  for (const re of BANNED_PATTERNS) {
    out = out.replace(re, (m) => {
      removed.push(m);
      return "";
    });
  }
  return { text: out.replace(/\s{2,}/g, " ").trim(), removed };
}

const NUMBER_RE = /\b\d[\d,.]*%?\b/g;

/**
 * Replace metric-looking numbers that are not present in the grounding context with "Data unavailable".
 * Context is the JSON-serialized context pack; any number that appears there is considered grounded.
 */
export function scrubUngroundedNumbers(text: string, contextJson: string): string {
  return text.replace(NUMBER_RE, (m) => {
    if (m.length > 6) return m; // years, ids, long tokens — not treated as metrics
    if (contextJson.includes(m)) return m;
    if (/^\d{4}$/.test(m)) return m; // years
    return "Data unavailable";
  });
}

export interface GuardrailResult {
  text: string;
  removedClaims: string[];
  scrubbedNumbers: boolean;
}

export function guardrailPass(output: string, contextJson: string): GuardrailResult {
  const claims = scrubClaims(output);
  const withNumbers = scrubUngroundedNumbers(claims.text, contextJson);
  return {
    text: withNumbers,
    removedClaims: claims.removed,
    scrubbedNumbers: withNumbers !== claims.text,
  };
}
