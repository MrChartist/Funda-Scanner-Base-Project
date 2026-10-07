// src/lib/insights/index.ts — checks, red flags and area summaries (WS2, spec §C.9 and §B.7).
// Every rule is a visible FSQL expression compiled by the real query engine; results are
// rule-based observations on the loaded data, never advice.
export { CHECK_RULES, LENDER_CHECKS, NONFIN_CHECKS, RED_FLAGS } from "./checks";
export { evaluateChecks, evidenceFor, evidencePeriod, outcomeFor, ruleMessage, ruleResult } from "./run";
export {
  AREA_LABELS, AREA_ORDER, INSIGHTS_FOOTER, RED_FLAG_HEADING, summariseAreas, summariseOutcomes, summariseRedFlags,
  type RedFlagSummary,
} from "./summary";
export { computeRedFlagCount, insightColumnProviders, RED_FLAG_MAX_NOT_EVALUATED, redFlagCountProvider } from "./column-providers";
