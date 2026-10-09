// src/lib/metrics/derive/profitability.ts — Profitability metrics (spec §C.3; annual).
import type { NullReason, QuarterRow } from "@/lib/contracts";
import { type V, nul, ok, ratio, scale, sub } from "../values";
import {
  type DeriveContext, type DeriverTable, annual, avgField, avgOf, capitalEmployedCached, ebitda, fy, investedCapital,
  netWorthCached, opEbit, ownersPat, pat, qEbitda, qPat, qRevenue, sumQuarters, taxRate, ttmBlock,
} from "./common";

/** TTM ratio Σnum / Σden × factor over block b; null when the quarters are incomplete. */
export function ttmRatio(
  num: (r: QuarterRow) => number | null, den: (r: QuarterRow) => number | null, whenNonPositive: NullReason, factor: number,
) {
  return (c: DeriveContext, i: number, b: number): V | null => {
    const rows = ttmBlock(c, i, b);
    if (!rows) return null;
    const n = sumQuarters(rows, num);
    const d = sumQuarters(rows, den);
    if (n === null || d === null) return null;
    if (!(d > 0)) return nul(whenNonPositive);
    return ok((n / d) * factor);
  };
}

const revenue = (c: DeriveContext, i: number, k: number): V => fy(c, i, k, "revenue");

export const PROFITABILITY_DERIVERS: DeriverTable = {
  roce: annual((c, i, k) => ratio(c.fy("ebit", i, k), avgOf(capitalEmployedCached, c, i, k), "non_positive_denominator", 100)),
  roic: annual((c, i, k) => {
    const nopat = scale(opEbit(c, i, k), 1 - taxRate(c, i, k));
    return ratio(nopat, avgOf(investedCapital, c, i, k), "non_positive_denominator", 100);
  }),
  roe: annual((c, i, k) => ratio(ownersPat(c, i, k), avgOf(netWorthCached, c, i, k), "negative_net_worth", 100)),
  roa: annual((c, i, k) => ratio(pat(c, i, k), avgField("total_assets")(c, i, k), "non_positive_denominator", 100)),
  opm: annual(
    (c, i, k) => ratio(ebitda(c, i, k), revenue(c, i, k), "non_positive_denominator", 100),
    ttmRatio(qEbitda, qRevenue, "non_positive_denominator", 100),
  ),
  gross_margin: annual((c, i, k) =>
    ratio(sub(revenue(c, i, k), fy(c, i, k, "cogs")), revenue(c, i, k), "non_positive_denominator", 100)),
  npm: annual(
    (c, i, k) => ratio(pat(c, i, k), revenue(c, i, k), "non_positive_denominator", 100),
    ttmRatio(qPat, qRevenue, "non_positive_denominator", 100),
  ),
  effective_tax_rate: annual((c, i, k) => ratio(fy(c, i, k, "tax_expense"), fy(c, i, k, "pbt"), "loss_making", 100)),
  other_income_to_pbt: annual((c, i, k) => ratio(fy(c, i, k, "other_income"), fy(c, i, k, "pbt"), "loss_making", 100)),
};
