// src/lib/insights/summary.ts — per-area summaries of the checks ("3 of 4 checks passed") and the
// red-flag tally for one company, plus the fixed copy every check or score block carries (§F.6).
import type { Area, AreaSummary, CheckOutcome, MetricStore, SummariseAreas } from "@/lib/contracts";
import { evaluateChecks } from "./run";

/** Footer shown under every score and check block (§F.6 rule 6). */
export const INSIGHTS_FOOTER = "Rule-based observations on the data you loaded. Not a recommendation.";

/** Heading used for the red-flag list in the UI (§C.9). */
export const RED_FLAG_HEADING = "Worth checking";

/** Display order of areas. */
export const AREA_ORDER: readonly Area[] = [
  "profitability", "growth", "balance_sheet", "cash_conversion", "valuation", "shareholder_returns", "asset_quality",
  "efficiency",
];

export const AREA_LABELS: Readonly<Record<Area, string>> = {
  profitability: "Profitability",
  growth: "Growth record",
  balance_sheet: "Balance-sheet strength",
  cash_conversion: "Cash conversion",
  valuation: "Valuation vs peers",
  shareholder_returns: "Shareholder returns",
  asset_quality: "Asset quality",
  efficiency: "Efficiency",
};

/** Checks that apply to the company, grouped by area in AREA_ORDER; areas with no applicable check are left out. */
export function summariseOutcomes(outcomes: readonly CheckOutcome[]): AreaSummary[] {
  const out: AreaSummary[] = [];
  for (const area of AREA_ORDER) {
    const list = outcomes.filter((o) => o.kind === "check" && o.area === area && o.result !== "not_applicable");
    if (list.length === 0) continue;
    const met = list.filter((o) => o.result === "met").length;
    const evaluated = list.filter((o) => o.result === "met" || o.result === "not_met").length;
    out.push({ area, label: AREA_LABELS[area], met, evaluated, total: list.length, outcomes: list });
  }
  return out;
}

/** Area summaries of the checks (red flags are summarised separately by summariseRedFlags). */
export const summariseAreas: SummariseAreas = (store, i) => summariseOutcomes(evaluateChecks(store, i));

export interface RedFlagSummary {
  /** Red flags that are triggered. */
  triggered: number;
  /** Applicable red flags that could be evaluated (triggered or not). */
  evaluated: number;
  /** Applicable red flags. */
  total: number;
  /** Applicable red-flag outcomes, triggered ones first, otherwise in rule order. */
  outcomes: CheckOutcome[];
}

const RANK: Readonly<Record<CheckOutcome["result"], number>> = { met: 0, not_evaluated: 1, not_met: 2, not_applicable: 3 };

export function summariseRedFlags(store: MetricStore, i: number): RedFlagSummary {
  const list = evaluateChecks(store, i).filter((o) => o.kind === "red_flag" && o.result !== "not_applicable");
  const ordered = list.map((o, k) => ({ o, k })).sort((a, b) => RANK[a.o.result] - RANK[b.o.result] || a.k - b.k).map((x) => x.o);
  return {
    triggered: list.filter((o) => o.result === "met").length,
    evaluated: list.filter((o) => o.result === "met" || o.result === "not_met").length,
    total: list.length,
    outcomes: ordered,
  };
}
