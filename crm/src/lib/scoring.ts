/**
 * Deterministic, transparent lead scoring.
 *
 * Returns a 0-100 score plus the reason breakdown so the recommendation can be
 * shown to the user (score is an algorithmic recommendation, not a guarantee).
 *
 * Signals (weights configurable in the future via settings):
 *   - source weight
 *   - value potential
 *   - interaction count (activity recency)
 *   - priority boost
 *   - follow-up presence
 */

export interface ScoreInput {
  source: string;
  value?: number | null;
  interactions: number;
  lastContactedDaysAgo: number | null;
  isHighValue?: boolean;
  priority?: string | null;
  hasNextFollowup?: boolean;
}

export interface ScoreResult {
  score: number;
  band: "HOT" | "WARM" | "COLD";
  reasons: string[];
}

const SOURCE_WEIGHTS: Record<string, number> = {
  Referral: 12,
  "Walk-in": 10,
  Phone: 8,
  WhatsApp: 7,
  IndiaMART: 9,
  Website: 6,
  Facebook: 4,
  Email: 5,
  Import: 5,
  "Manual Entry": 5,
  API: 5,
};

export function computeLeadScore(input: ScoreInput): ScoreResult {
  let score = 0;
  const reasons: string[] = [];

  // Source
  const sourceW = SOURCE_WEIGHTS[input.source] ?? 5;
  score += sourceW;
  reasons.push(`Source ${input.source || "unknown"}: +${sourceW}`);

  // Value potential (assume value is in INR)
  if (input.value && input.value > 0) {
    if (input.value >= 500000) {
      score += 25;
      reasons.push("High deal value: +25");
    } else if (input.value >= 100000) {
      score += 18;
      reasons.push("Good deal value: +18");
    } else if (input.value >= 25000) {
      score += 10;
      reasons.push("Moderate deal value: +10");
    } else {
      score += 5;
      reasons.push("Small deal value: +5");
    }
  }

  // Interactions
  if (input.interactions >= 6) {
    score += 20;
    reasons.push("6+ interactions: +20");
  } else if (input.interactions >= 3) {
    score += 14;
    reasons.push("3+ interactions: +14");
  } else if (input.interactions >= 1) {
    score += 6;
    reasons.push("Some interactions: +6");
  }

  // Recency
  if (input.lastContactedDaysAgo !== null) {
    if (input.lastContactedDaysAgo <= 2) {
      score += 15;
      reasons.push("Contacted recently: +15");
    } else if (input.lastContactedDaysAgo <= 7) {
      score += 8;
      reasons.push("Contacted within a week: +8");
    } else if (input.lastContactedDaysAgo > 30) {
      score -= 10;
      reasons.push("Stale (30d+): -10");
    }
  }

  // Next follow-up scheduled
  if (input.hasNextFollowup) {
    score += 8;
    reasons.push("Follow-up scheduled: +8");
  }

  // Priority
  if (input.priority === "HOT") {
    score += 10;
    reasons.push("Marked HOT: +10");
  } else if (input.priority === "WARM") {
    score += 5;
    reasons.push("Marked WARM: +5");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const band: ScoreResult["band"] =
    score >= 80 ? "HOT" : score >= 50 ? "WARM" : "COLD";

  return { score, band, reasons };
}
