import type { CheckOutcome, Category } from "@/lib/seo/types";

export interface ComponentMethodology {
  name: string;
  category: Category | "authority";
  weight: number;
  score: number | null;
  checks: Array<{
    code: string;
    title: string;
    severity: string;
    weight: number;
    applicable: number;
    failed: number;
  }>;
}

export interface ScoreResult {
  overall: number;
  components: Record<string, { score: number; weight: number; weightApplied: number }>;
  methodology: {
    formula: string;
    componentFormula: string;
    weights: Record<string, number>;
    components: ComponentMethodology[];
    unavailable: string[];
  };
}

export const COMPONENT_WEIGHTS: Record<string, number> = {
  technical: 0.2,
  onpage: 0.2,
  content: 0.15,
  aeo: 0.15,
  geo: 0.1,
  performance: 0.1,
  authority: 0.1,
};

export const COMPONENT_LABELS: Record<string, string> = {
  technical: "Technical SEO",
  onpage: "On-Page SEO",
  content: "Content",
  aeo: "AEO",
  geo: "GEO",
  performance: "Performance",
  authority: "Authority",
};

const FORMULA =
  "Growth Score = weighted average of available component scores, weights renormalized over components with data. Missing components are excluded, never guessed.";
const COMPONENT_FORMULA =
  "Component score = 100 × Σ(weight × passRatio) / Σ(weight), where passRatio = (applicable − failed) / applicable for each applicable check.";

function passRatio(applicable: number, failed: number): number {
  if (applicable <= 0) return 1;
  return Math.max(0, Math.min(1, (applicable - Math.min(failed, applicable)) / applicable));
}

export function computeScore(
  outcomes: CheckOutcome[],
  authority: { linked: number; total: number } | null
): ScoreResult {
  const byCategory = new Map<string, CheckOutcome[]>();
  for (const o of outcomes) {
    const arr = byCategory.get(o.category);
    if (arr) arr.push(o);
    else byCategory.set(o.category, [o]);
  }

  const components: ComponentMethodology[] = [];

  for (const [category, checks] of byCategory) {
    const applicableChecks = checks.filter((c) => c.applicable > 0);
    if (applicableChecks.length === 0) continue;
    let weighted = 0;
    let totalWeight = 0;
    for (const c of applicableChecks) {
      const ratio = passRatio(c.applicable, c.failures.length);
      weighted += c.weight * ratio;
      totalWeight += c.weight;
    }
    const score = totalWeight > 0 ? Math.round((100 * weighted) / totalWeight) : null;
    components.push({
      name: COMPONENT_LABELS[category] ?? category,
      category: category as Category,
      weight: COMPONENT_WEIGHTS[category] ?? 0.1,
      score,
      checks: applicableChecks.map((c) => ({
        code: c.code,
        title: c.title,
        severity: c.severity,
        weight: c.weight,
        applicable: c.applicable,
        failed: c.failures.length,
      })),
    });
  }

  if (authority && authority.total > 0) {
    const score = Math.round((100 * authority.linked) / authority.total);
    components.push({
      name: COMPONENT_LABELS.authority,
      category: "authority",
      weight: COMPONENT_WEIGHTS.authority,
      score,
      checks: [
        {
          code: "AUTH01",
          title: "Indexable pages with at least one internal inbound link",
          severity: "medium",
          weight: 10,
          applicable: authority.total,
          failed: authority.total - authority.linked,
        },
      ],
    });
  }

  const measured = components.filter((c) => c.score !== null);
  const unavailable = components.filter((c) => c.score === null).map((c) => c.name);
  const weightSum = measured.reduce((s, c) => s + c.weight, 0);
  const overall =
    weightSum > 0
      ? Math.round(measured.reduce((s, c) => s + (c.score ?? 0) * c.weight, 0) / weightSum)
      : 0;

  const componentMap: ScoreResult["components"] = {};
  for (const c of measured) {
    componentMap[c.category] = {
      score: c.score ?? 0,
      weight: c.weight,
      weightApplied: weightSum > 0 ? c.weight / weightSum : 0,
    };
  }

  return {
    overall,
    components: componentMap,
    methodology: {
      formula: FORMULA,
      componentFormula: COMPONENT_FORMULA,
      weights: COMPONENT_WEIGHTS,
      components,
      unavailable,
    },
  };
}
