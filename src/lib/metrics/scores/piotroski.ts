// src/lib/metrics/scores/piotroski.ts — Piotroski F-score (spec §C.6).
// t = latest FY (slot 0), t−1 = slot 1, balance sheets for t, t−1 and t−2. ROA_y = PAT_y /
// total assets at the start of the year (total_assets_y−1). The score is null (too_few_inputs)
// unless all nine criteria can be evaluated.
//   F1 ROA_t > 0                         F6 current ratio_t > current ratio_t−1
//   F2 CFO_t > 0                         F7 equity raised_t ≤ 1% of net worth_t−1 (else shares ≤ +1%)
//   F3 ROA_t > ROA_t−1                   F8 gross margin_t > gross margin_t−1 (OPM proxy, flagged)
//   F4 CFO_t / TA_t−1 > ROA_t            F9 sales_t / TA_t−1 > sales_t−1 / TA_t−2
//   F5 LTD_t / avg TA_t < LTD_t−1 / avg TA_t−1 (also met when both are 0: a documented deviation)
import type { ExplainScore, MetricStore, MetricValue, ScoreCriterion, ScoreExplanation } from "@/lib/contracts";
import { VF } from "@/lib/contracts";
import { SCORE_METHODOLOGY_VERSION, evidenceAt, fyName, fyNum, numText, pctText } from "./shared";

type Result = "met" | "not_met" | "not_evaluated";
type Num = number | null;

/** The numbers behind the nine tests (no text), cheap enough to compute for every company. */
export interface PiotroskiCore {
  value: MetricValue;
  results: Result[];
  proxy: boolean;
  /** F7 basis: equity raised, share count, or neither. */
  f7Basis: "issuance" | "shares" | null;
  roa0: Num; roa1: Num; cfo0: Num; cfoOnAssets: Num; lev0: Num; lev1: Num; cr0: Num; cr1: Num;
  iss0: Num; nw1: Num; sh0: Num; sh1: Num; m0: Num; m1: Num; at0: Num; at1: Num;
}

const test = (cond: boolean): Result => (cond ? "met" : "not_met");
const both = (a: Num, b: Num, cmp: (a: number, b: number) => boolean): Result =>
  a === null || b === null ? "not_evaluated" : test(cmp(a, b));
const over = (a: Num, b: Num): Num => (a !== null && b !== null && b > 0 ? a / b : null);

export function piotroskiCore(store: MetricStore, i: number): PiotroskiCore {
  const n = (id: string, k: number) => fyNum(store, id, i, k);
  const ta0 = n("total_assets", 0), ta1 = n("total_assets", 1), ta2 = n("total_assets", 2);
  const roa0 = over(n("pat", 0), ta1);
  const roa1 = over(n("pat", 1), ta2);
  const cfo0 = n("cfo", 0);
  const cfoOnAssets = over(cfo0, ta1);
  const avg = (a: Num, b: Num): Num => (a !== null && b !== null ? (a + b) / 2 : null);
  const lev0 = over(n("borrowings_non_current", 0), avg(ta0, ta1));
  const lev1 = over(n("borrowings_non_current", 1), avg(ta1, ta2));
  const cr0 = over(n("total_current_assets", 0), n("total_current_liabilities", 0));
  const cr1 = over(n("total_current_assets", 1), n("total_current_liabilities", 1));
  const iss0 = n("equity_issuance", 0);
  const nw1 = n("net_worth", 1);
  const sh0 = n("shares_outstanding_ye", 0), sh1 = n("shares_outstanding_ye", 1);
  let f7: Result = "not_evaluated";
  let f7Basis: PiotroskiCore["f7Basis"] = null;
  if (iss0 !== null && nw1 !== null) {
    f7 = test(iss0 <= 0.01 * nw1);
    f7Basis = "issuance";
  } else if (sh0 !== null && sh1 !== null) {
    f7 = test(sh0 <= 1.01 * sh1);
    f7Basis = "shares";
  }
  const gm0 = n("gross_margin", 0), gm1 = n("gross_margin", 1);
  const proxy = gm0 === null || gm1 === null;
  const m0 = proxy ? n("opm", 0) : gm0;
  const m1 = proxy ? n("opm", 1) : gm1;
  const at0 = over(n("sales", 0), ta1);
  const at1 = over(n("sales", 1), ta2);
  const results: Result[] = [
    roa0 === null ? "not_evaluated" : test(roa0 > 0),
    cfo0 === null ? "not_evaluated" : test(cfo0 > 0),
    both(roa0, roa1, (a, b) => a > b),
    both(cfoOnAssets, roa0, (a, b) => a > b),
    both(lev0, lev1, (a, b) => a < b || (a === 0 && b === 0)),
    both(cr0, cr1, (a, b) => a > b),
    f7,
    both(m0, m1, (a, b) => a > b),
    both(at0, at1, (a, b) => a > b),
  ];
  let met = 0;
  let evaluable = 0;
  for (const r of results) {
    if (r !== "not_evaluated") evaluable++;
    if (r === "met") met++;
  }
  const flags = proxy ? VF.Proxy : 0;
  const value: MetricValue = evaluable === 9 ? { v: met, reason: null, flags } : { v: null, reason: "too_few_inputs", flags };
  return { value, results, proxy, f7Basis, roa0, roa1, cfo0, cfoOnAssets, lev0, lev1, cr0, cr1, iss0, nw1, sh0, sh1, m0, m1, at0, at1 };
}

const NOT_EVALUATED = "Not evaluated: an input for this test is missing from your data.";

/** Criterion texts, inputs and details for an explanation. */
function criteria(store: MetricStore, i: number, c: PiotroskiCore): ScoreCriterion[] {
  const y0 = fyName(store, i, 0);
  const y1 = fyName(store, i, 1);
  const ev = (inputs: readonly (readonly [string, number])[]) => inputs.map(([id, k]) => evidenceAt(store, id, i, k));
  const spec: { id: string; text: string; inputs: readonly (readonly [string, number])[]; detail: () => string }[] = [
    { id: "F1", text: "Return on assets is positive", inputs: [["pat", 0], ["total_assets", 1]],
      detail: () => `ROA ${y0} ${pctText(c.roa0 as number)} (net profit on assets at the start of the year).` },
    { id: "F2", text: "Cash from operations is positive", inputs: [["cfo", 0]],
      detail: () => `Cash from operations ${y0}: ₹${numText(c.cfo0 as number, 0)} Cr.` },
    { id: "F3", text: "Return on assets improved on the previous year", inputs: [["pat", 0], ["total_assets", 1], ["pat", 1], ["total_assets", 2]],
      detail: () => `ROA ${y0} ${pctText(c.roa0 as number)} (${y1} ${pctText(c.roa1 as number)}).` },
    { id: "F4", text: "Cash from operations is higher than net profit, both measured against assets", inputs: [["cfo", 0], ["pat", 0], ["total_assets", 1]],
      detail: () => `Cash from operations ${pctText(c.cfoOnAssets as number)} of opening assets against ROA ${pctText(c.roa0 as number)} in ${y0}.` },
    { id: "F5", text: "Long-term borrowing fell relative to assets",
      inputs: [["borrowings_non_current", 0], ["borrowings_non_current", 1], ["total_assets", 0], ["total_assets", 1], ["total_assets", 2]],
      detail: () => (c.lev0 === 0 && c.lev1 === 0 ? `No long-term borrowings in ${y0} or ${y1}; counted as met.`
        : `Long-term borrowings ${pctText(c.lev0 as number)} of average assets in ${y0} (${y1} ${pctText(c.lev1 as number)}).`) },
    { id: "F6", text: "Current ratio improved",
      inputs: [["total_current_assets", 0], ["total_current_liabilities", 0], ["total_current_assets", 1], ["total_current_liabilities", 1]],
      detail: () => `Current ratio ${y0} ${numText(c.cr0 as number)}x (${y1} ${numText(c.cr1 as number)}x).` },
    { id: "F7", text: "No meaningful issue of new shares",
      inputs: c.f7Basis === "shares" ? [["shares_outstanding_ye", 0], ["shares_outstanding_ye", 1]] : [["equity_issuance", 0], ["net_worth", 1]],
      detail: () => (c.f7Basis === "shares"
        ? `Share count ${y0} ${numText(c.sh0 as number)} Cr against ${numText(c.sh1 as number)} Cr in ${y1} (limit +1%); equity raised was not provided.`
        : `Equity raised in ${y0}: ₹${numText(c.iss0 as number, 0)} Cr against net worth of ₹${numText(c.nw1 as number, 0)} Cr at the start of the year (limit 1%).`) },
    { id: "F8", text: c.proxy ? "Operating margin improved (used because gross margin is not available)" : "Gross margin improved",
      inputs: c.proxy ? [["opm", 0], ["opm", 1]] : [["gross_margin", 0], ["gross_margin", 1]],
      detail: () => `${c.proxy ? "Operating" : "Gross"} margin ${y0} ${numText(c.m0 as number, 1)}% (${y1} ${numText(c.m1 as number, 1)}%).` },
    { id: "F9", text: "Asset turnover improved", inputs: [["sales", 0], ["total_assets", 1], ["sales", 1], ["total_assets", 2]],
      detail: () => `Sales to opening assets ${y0} ${numText(c.at0 as number)}x (${y1} ${numText(c.at1 as number)}x).` },
  ];
  return spec.map((s, j) => ({
    id: s.id,
    text: s.text,
    result: c.results[j],
    detail: c.results[j] === "not_evaluated" ? NOT_EVALUATED : s.detail(),
    inputs: ev(s.inputs),
  }));
}

export function piotroskiBand(score: number): NonNullable<ScoreExplanation["band"]> {
  if (score >= 8) return { label: "Strong", tone: "good" };
  if (score >= 4) return { label: "Moderate", tone: "neutral" };
  return { label: "Weak", tone: "weak" };
}

const BASE_CAVEATS = [
  "Return on assets in this score uses total assets at the start of the year, so it differs from the ROA metric.",
  "The leverage test also counts a company with no long-term borrowings in both years as met, a small departure from the original method.",
];

export const explainPiotroski: ExplainScore = (store, i) => {
  const value = store.get("piotroski_f", i);
  if (value.reason === "not_applicable_financial") {
    return {
      scoreId: "piotroski_f", value, band: null, criteria: [], evaluable: 0, total: 9,
      caveats: ["The F-score is designed for non-financial companies, so it is not calculated for banks, NBFCs and insurers."],
      methodologyVersion: SCORE_METHODOLOGY_VERSION,
    };
  }
  const core = piotroskiCore(store, i);
  const list = criteria(store, i, core);
  const evaluable = list.filter((c) => c.result !== "not_evaluated").length;
  const caveats = [...BASE_CAVEATS];
  if (core.proxy) caveats.push("Gross margin is not available, so operating margin is used for the margin test.");
  if (value.v === null) caveats.push(`Only ${evaluable} of 9 tests can be evaluated with your data, so no score is shown.`);
  return {
    scoreId: "piotroski_f",
    value,
    band: value.v === null ? null : piotroskiBand(value.v),
    criteria: list,
    evaluable,
    total: 9,
    caveats,
    methodologyVersion: SCORE_METHODOLOGY_VERSION,
  };
};
