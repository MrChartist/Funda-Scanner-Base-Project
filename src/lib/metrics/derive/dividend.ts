// src/lib/metrics/derive/dividend.ts — Dividend metrics (spec §C.3 "Dividend and Per Share").
// dps itself is a line item (dividend_per_share as supplied; missing is never 0).
import { VF } from "@/lib/contracts";
import { type V, inh, mul, nul, ok, ratio, withFlags } from "../values";
import { type DeriveContext, type DeriverTable, annual, fyAsGiven, latest, ownersPat, sharesYe } from "./common";

const dps = (c: DeriveContext, i: number, k: number): V => fyAsGiven(c, i, k, "dividend_per_share");

/** Consecutive latest FYs with dps > 0. LimitOfData when the run reaches the end of the supplied years. */
function dividendStreak(c: DeriveContext, i: number): V {
  const first = dps(c, i, 0);
  if (first.v === null) return first;
  const rows = c.grid(i).annual;
  let streak = 0;
  for (let k = 0; k < rows.length; k++) {
    const row = rows[k];
    const v = row ? row.dividend_per_share : null;
    if (v === null || !Number.isFinite(v)) return ok(streak, VF.LimitOfData);
    if (!(v > 0)) return ok(streak);
    streak++;
  }
  return ok(streak, VF.LimitOfData);
}

export const DIVIDEND_DERIVERS: DeriverTable = {
  dividend_yield: latest((c, i) => {
    const price = c.latest("price", i);
    if (price.v === null) return price;
    const d = c.fy("dps", i, 0);
    if (d.v === null) return d;
    if (!(price.v > 0)) return nul("non_positive_denominator", inh(d));
    return ok((d.v / price.v) * 100, inh(d) | inh(price));
  }),
  /** dps × shares_ye / owners_pat × 100, flagged PayoutOver100 above 100%. */
  dividend_payout: annual((c, i, k) => {
    const v = ratio(mul(dps(c, i, k), sharesYe(c, i, k)), ownersPat(c, i, k), "loss_making", 100);
    return v.v !== null && v.v > 100 ? withFlags(v, VF.PayoutOver100) : v;
  }),
  dividend_streak: latest(dividendStreak),
};
