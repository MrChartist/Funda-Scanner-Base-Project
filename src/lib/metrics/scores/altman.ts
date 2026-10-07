// src/lib/metrics/scores/altman.ts — Altman Z'' score, the non-manufacturer / emerging-market
// form (spec §C.6), on the latest FY balance sheet:
//   X1 = (TCA − TCL) / TA          X2 = other_equity / TA (proxy for retained earnings)
//   X3 = EBIT / TA                 X4 = total_equity / (TA − total_equity)
//   Z'' = 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4
import type { Evidence, ExplainScore, MetricStore, MetricValue, NullReason, ScoreCriterion, ScoreExplanation } from "@/lib/contracts";
import { SCORE_METHODOLOGY_VERSION, evidenceAt, fyName, fyNum, numText } from "./shared";

export const ALTMAN_WEIGHTS = { x1: 6.56, x2: 3.26, x3: 6.72, x4: 1.05 } as const;

interface Component {
  id: "X1" | "X2" | "X3" | "X4";
  text: string;
  weight: number;
  value: number | null;
  reason: NullReason | null;
  inputs: readonly string[];
}

export interface AltmanResult {
  value: MetricValue;
  components: Component[];
}

/** Total equity = net worth + non-controlling interest (0 when not provided). */
function totalEquity(store: MetricStore, i: number): number | null {
  const nw = fyNum(store, "net_worth", i, 0);
  if (nw === null) return null;
  const nci = fyNum(store, "non_controlling_interest", i, 0);
  return nw + (nci ?? 0);
}

export function evaluateAltman(store: MetricStore, i: number): AltmanResult {
  const n = (id: string) => fyNum(store, id, i, 0);
  const ta = n("total_assets");
  const tca = n("total_current_assets");
  const tcl = n("total_current_liabilities");
  const oe = n("other_equity");
  const ebit = n("ebit");
  const te = totalEquity(store, i);
  const taOk = ta !== null && ta > 0;
  const over = (num: number | null, den: number | null, denOk: boolean): { value: number | null; reason: NullReason | null } => {
    if (num === null || den === null) return { value: null, reason: "missing_input" };
    if (!denOk) return { value: null, reason: "non_positive_denominator" };
    return { value: num / den, reason: null };
  };
  const x1 = over(tca !== null && tcl !== null ? tca - tcl : null, ta, taOk);
  const x2 = over(oe, ta, taOk);
  const x3 = over(ebit, ta, taOk);
  const liabilities = ta !== null && te !== null ? ta - te : null;
  const x4 = over(te, liabilities, liabilities !== null && liabilities > 0);
  const components: Component[] = [
    { id: "X1", text: "Working capital is positive (current assets exceed current liabilities)", weight: ALTMAN_WEIGHTS.x1, ...x1, inputs: ["total_current_assets", "total_current_liabilities", "total_assets"] },
    { id: "X2", text: "Accumulated reserves are positive (other equity, a proxy for retained earnings)", weight: ALTMAN_WEIGHTS.x2, ...x2, inputs: ["other_equity", "total_assets"] },
    { id: "X3", text: "Operating profit (EBIT) is positive", weight: ALTMAN_WEIGHTS.x3, ...x3, inputs: ["ebit", "total_assets"] },
    { id: "X4", text: "Shareholders' equity is positive against total liabilities", weight: ALTMAN_WEIGHTS.x4, ...x4, inputs: ["net_worth", "non_controlling_interest", "total_assets"] },
  ];
  const missing = components.find((c) => c.value === null);
  const value: MetricValue = missing
    ? { v: null, reason: missing.reason ?? "missing_input", flags: 0 }
    : { v: components.reduce((s, c) => s + c.weight * (c.value as number), 0), reason: null, flags: 0 };
  return { value, components };
}

export function altmanZone(z: number): NonNullable<ScoreExplanation["band"]> {
  if (z > 2.6) return { label: "Safe zone", tone: "good" };
  if (z >= 1.1) return { label: "Grey zone", tone: "neutral" };
  return { label: "Distress zone", tone: "weak" };
}

const CAVEATS = [
  "A distress screen, not a prediction of default.",
  "Retained earnings are approximated by other equity (reserves and surplus).",
];

export const explainAltman: ExplainScore = (store, i) => {
  const value = store.get("altman_z", i);
  if (value.reason === "not_applicable_financial") {
    return {
      scoreId: "altman_z", value, band: null, criteria: [], evaluable: 0, total: 4,
      caveats: ["The Z'' score is designed for non-financial companies, so it is not calculated for banks, NBFCs and insurers.", CAVEATS[0]],
      methodologyVersion: SCORE_METHODOLOGY_VERSION,
    };
  }
  const r = evaluateAltman(store, i);
  const year = fyName(store, i, 0);
  const criteria: ScoreCriterion[] = r.components.map((c) => ({
    id: c.id,
    text: c.text,
    result: c.value === null ? "not_evaluated" : c.value > 0 ? "met" : "not_met",
    detail: c.value === null
      ? "Not evaluated: an input for this ratio is missing from your data or not meaningful."
      : `${c.id} ${year} = ${numText(c.value, 3)}; weight ${numText(c.weight, 2)} adds ${numText(c.weight * c.value, 2)} to the score.`,
    inputs: c.inputs.map((id): Evidence => evidenceAt(store, id, i, 0)),
  }));
  return {
    scoreId: "altman_z",
    value,
    band: value.v === null ? null : altmanZone(value.v),
    criteria,
    evaluable: criteria.filter((c) => c.result !== "not_evaluated").length,
    total: 4,
    caveats: [...CAVEATS],
    methodologyVersion: SCORE_METHODOLOGY_VERSION,
  };
};
