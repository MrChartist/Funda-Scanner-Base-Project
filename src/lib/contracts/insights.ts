// src/lib/contracts/insights.ts
import type { TypeFamily } from "./dataset";
import type { MetricId, MetricStore, MetricValue, NullReason } from "./metrics";

export type Area =
  | "profitability" | "growth" | "balance_sheet" | "cash_conversion" | "valuation"
  | "shareholder_returns" | "asset_quality" | "efficiency";

/** DOM ids of company-page sections; also deep-link hashes. */
export type CompanySectionId =
  | "summary" | "checks" | "scores" | "screens" | "quarterly" | "pnl" | "balance-sheet" | "cash-flow"
  | "ratios" | "shareholding" | "dividends" | "peers" | "data-health";

export const COMPANY_SECTION_IDS: readonly CompanySectionId[] = [
  "summary", "checks", "scores", "screens", "quarterly", "pnl", "balance-sheet", "cash-flow",
  "ratios", "shareholding", "dividends", "peers", "data-health",
];

export interface Evidence {
  metric: MetricId;
  label: string;           // "ROCE · 5Y avg"
  value: MetricValue;
  display: string;         // "22.4%"
  period: string | null;   // "FY22–FY26"
}

/**
 * A check or red flag is a visible FSQL boolean expression. "met" means the expression is
 * TRUE: for a check that is a pass; for a red flag it means the flag is triggered.
 */
export interface CheckRule {
  id: string;              // "PR-01", "RF-03", "LF-02"
  kind: "check" | "red_flag";
  area: Area;
  appliesTo: readonly TypeFamily[];
  title: string;           // "Earns well on its capital" / "Profit not backed by cash"
  test: string;            // "ROCE averaged above 15% over the last 5 financial years"
  query: string;           // "roce_avg_5y > 15"
  evidence: readonly MetricId[];
  section: CompanySectionId;
  learn: readonly MetricId[];
}

export type CheckResult = "met" | "not_met" | "not_evaluated" | "not_applicable";

export interface CheckOutcome {
  ruleId: string;
  kind: "check" | "red_flag";
  area: Area;
  result: CheckResult;
  title: string;
  test: string;
  query: string;
  /** Filled template with values: "ROCE averaged 22.4% over FY22–FY26." */
  message: string;
  evidence: Evidence[];
  reason: NullReason | null;  // when not_evaluated
  section: CompanySectionId;
  learn: readonly MetricId[];
}

export interface AreaSummary {
  area: Area;
  label: string;           // "Balance-sheet strength"
  met: number;
  evaluated: number;
  total: number;
  outcomes: CheckOutcome[];
}

export interface ScoreCriterion {
  id: string;              // "F1"
  text: string;            // "Return on assets is positive"
  result: "met" | "not_met" | "not_evaluated";
  detail: string;          // "ROA FY26 6.2% (FY25 5.1%)"
  inputs: Evidence[];
}

export interface ScoreExplanation {
  scoreId: "piotroski_f" | "altman_z";
  value: MetricValue;
  band: { label: string; tone: "good" | "neutral" | "weak" } | null;  // tone always shown with icon + text
  criteria: ScoreCriterion[];
  evaluable: number;
  total: number;
  caveats: string[];
  methodologyVersion: string;   // "2026.1"
}

/** Deterministic one-sentence data caption (P2). */
export interface Caption {
  id: string;
  text: string;            // "Sales grew in 9 of the last 10 years; FY21 fell 6%."
  metrics: MetricId[];
}

// ── Function types (WS2 insights/index.ts; WS3 metrics/scores) ───────────────
export type EvaluateChecks = (store: MetricStore, i: number) => CheckOutcome[];
export type SummariseAreas = (store: MetricStore, i: number) => AreaSummary[];
export type ExplainScore = (store: MetricStore, i: number) => ScoreExplanation;
