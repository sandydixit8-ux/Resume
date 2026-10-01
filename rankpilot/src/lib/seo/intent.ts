export type Intent = "informational" | "commercial" | "transactional" | "navigational" | "local";

const TRANSACTIONAL = [
  /\b(buy|purchase|order|checkout|pricing|price|cost|discount|coupon|deal|subscribe|sign up|signup|hire|book|get a quote|free trial)\b/i,
];
const COMMERCIAL = [
  /\b(best|top \d+|review|reviews|vs\.?|versus|compare|comparison|alternative|alternatives|which should i|worth it|template|tool|software|service)\b/i,
];
const LOCAL = [/\bnear me\b/i, /\b(in|near|around)\s+[A-Z][a-z]+/];
const NAVIGATIONAL = [/\b(login|sign in|dashboard|contact|support|official site)\b/i];
const INFORMATIONAL = [
  /\b(how|what|why|when|where|who|which|guide|tutorial|tips|ideas|examples|checklist|strategy|meaning|definition|is|are|does|can)\b/i,
];

export function classifyIntent(term: string): Intent {
  if (LOCAL.some((re) => re.test(term))) return "local";
  if (NAVIGATIONAL.some((re) => re.test(term))) return "navigational";
  if (TRANSACTIONAL.some((re) => re.test(term))) return "transactional";
  if (COMMERCIAL.some((re) => re.test(term))) return "commercial";
  if (INFORMATIONAL.some((re) => re.test(term))) return "informational";
  return "informational";
}

const STOPWORDS = new Set([
  "the","and","for","your","with","that","this","from","are","was","were","have","has","will",
  "can","how","what","why","when","where","which","who","into","about","our","their","they",
  "you","your","not","but","all","any","its","it's","a","an","of","to","in","on","at","is",
  "be","do","does","did","i","we","us","or","if","then","than","more","most","best","top",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function meaningfulTokens(text: string): string[] {
  return tokenize(text).filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export interface DerivedTerm {
  term: string;
  occurrences: number;
}

/** Derive candidate topics from real page titles/headings (never invented metrics). */
export function deriveTerms(
  inputs: string[],
  limit = 25
): DerivedTerm[] {
  const counts = new Map<string, number>();
  for (const input of inputs) {
    const words = meaningfulTokens(input);
    const seen = new Set<string>();
    for (const n of [2, 3]) {
      for (let i = 0; i + n <= words.length; i++) {
        const phrase = words.slice(i, i + n).join(" ");
        if (phrase.length < 6 || phrase.length > 60) continue;
        if (seen.has(phrase)) continue;
        seen.add(phrase);
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, occurrences]) => ({ term, occurrences }));
}

export function countPhraseOccurrences(haystack: string, phrase: string): number {
  if (!phrase) return 0;
  const target = phrase.toLowerCase();
  const text = haystack.toLowerCase();
  let count = 0;
  let idx = text.indexOf(target);
  while (idx !== -1) {
    count++;
    idx = text.indexOf(target, idx + target.length);
  }
  return count;
}
