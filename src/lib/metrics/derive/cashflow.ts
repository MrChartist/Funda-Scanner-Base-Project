// src/lib/metrics/derive/cashflow.ts — Cash Flow metrics (spec §C.3 "Cash Flow"; annual).
import { type V, inh, nul, ok, ratio, sub } from "../values";
import { type DeriveContext, type DeriverTable, annual, avgField, ebitda, flaggedFy, fy, pat } from "./common";

const cfo = (c: DeriveContext, i: number, k: number): V => fy(c, i, k, "cfo");

/** Σcfo / Σpat over the 5 FYs ending at slot k: TP across a flagged year, IH unless all 10 inputs exist. */
function cumCfoToPat(c: DeriveContext, i: number, k: number): V {
  const years = 5;
  let sumCfo = 0;
  let sumPat = 0;
  let flags = 0;
  let missing = false;
  for (let j = k; j < k + years; j++) if (flaggedFy(c, i, j)) return nul("transition_period");
  for (let j = k; j < k + years; j++) {
    const a = cfo(c, i, j);
    const b = pat(c, i, j);
    if (a.v === null || b.v === null) {
      missing = true;
      continue;
    }
    sumCfo += a.v;
    sumPat += b.v;
    flags |= inh(a) | inh(b);
  }
  if (missing) return nul("insufficient_history");
  if (!(sumPat > 0)) return nul("loss_making", flags);
  return ok(sumCfo / sumPat, flags);
}

export const CASHFLOW_DERIVERS: DeriverTable = {
  fcf: annual((c, i, k) => sub(cfo(c, i, k), fy(c, i, k, "capex"))),
  cfo_to_pat: annual((c, i, k) => ratio(cfo(c, i, k), pat(c, i, k), "loss_making")),
  cum_cfo_to_pat_5y: annual(cumCfoToPat),
  cfo_to_ebitda: annual((c, i, k) => ratio(cfo(c, i, k), ebitda(c, i, k), "non_positive_denominator", 100)),
  capex_to_sales: annual((c, i, k) => ratio(fy(c, i, k, "capex"), fy(c, i, k, "revenue"), "non_positive_denominator", 100)),
  capex_to_depreciation: annual((c, i, k) => ratio(fy(c, i, k, "capex"), fy(c, i, k, "depreciation"), "non_positive_denominator")),
  accruals_ratio: annual((c, i, k) =>
    ratio(sub(pat(c, i, k), cfo(c, i, k)), avgField("total_assets")(c, i, k), "non_positive_denominator", 100)),
};
