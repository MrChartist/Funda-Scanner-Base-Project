// src/lib/metrics/derive/valuation.ts — Valuation metrics (spec §C.3 "Valuation"; all latest only).
// Price-linked metrics report a missing price (no_price) before anything else, because that is
// the input the user can most easily supply.
import { type V, inh, nul, ok, ratio } from "../values";
import {
  type DeriveContext, type DeriverTable, annual, flaggedFy, latest, opEbit, qOpEbit,
} from "./common";
import { ttmSum } from "./size";

/** Enterprise value that must be positive: EV's own reason when null, ev_not_positive when ≤ 0. */
function positiveEv(c: DeriveContext, i: number): V {
  const ev = c.latest("enterprise_value", i);
  if (ev.v === null) return ev;
  if (!(ev.v > 0)) return nul("ev_not_positive", inh(ev));
  return ev;
}

/** x / market_cap × 100 with market cap checked first; negative x is kept. */
function yieldOnMarketCap(c: DeriveContext, i: number, x: V): V {
  const mcap = c.latest("market_cap", i);
  if (mcap.v === null) return mcap;
  if (x.v === null) return { v: null, reason: x.reason ?? "missing_input", flags: inh(x) | inh(mcap) };
  if (!(mcap.v > 0)) return nul("non_positive_denominator", inh(x) | inh(mcap));
  return ok((x.v / mcap.v) * 100, inh(x) | inh(mcap));
}

/** Market cap divided by a denominator: market cap's reason first, then the denominator's rule. */
function onMarketCap(c: DeriveContext, i: number, den: V, whenNonPositive: Parameters<typeof ratio>[2]): V {
  const mcap = c.latest("market_cap", i);
  if (mcap.v === null) return mcap;
  return ratio(mcap, den, whenNonPositive);
}

/** Mean of fcf over the latest `years` FYs: TP if any year is flagged, IH unless all are present. */
function meanFcf(c: DeriveContext, i: number, years: number): V {
  let sum = 0;
  let flags = 0;
  let missing = false;
  for (let k = 0; k < years; k++) {
    if (flaggedFy(c, i, k)) return nul("transition_period");
    const v = c.fy("fcf", i, k);
    if (v.v === null) missing = true;
    else {
      sum += v.v;
      flags |= inh(v);
    }
  }
  return missing ? nul("insufficient_history") : ok(sum / years, flags);
}

export const VALUATION_DERIVERS: DeriverTable = {
  /** Internal: op_ebit = revenue − opex − depreciation, with a TTM form (earnings yield). */
  _op_ebit: annual(opEbit, ttmSum(qOpEbit)),
  pe: latest((c, i) => onMarketCap(c, i, c.ttm("net_profit", i, 0), "loss_making")),
  pb: latest((c, i) => onMarketCap(c, i, c.fy("net_worth", i, 0), "negative_net_worth")),
  price_to_sales: latest((c, i) => onMarketCap(c, i, c.ttm("sales", i, 0), "non_positive_denominator")),
  ev_ebitda: latest((c, i) => {
    const ev = positiveEv(c, i);
    if (ev.v === null) return ev;
    return ratio(ev, c.ttm("ebitda", i, 0), "non_positive_denominator");
  }),
  earnings_yield: latest((c, i) => {
    const ev = positiveEv(c, i);
    if (ev.v === null) return ev;
    const e = c.ttm("_op_ebit", i, 0);
    if (e.v === null) return { v: null, reason: e.reason ?? "missing_input", flags: inh(e) | inh(ev) };
    return ok((e.v / ev.v) * 100, inh(e) | inh(ev));
  }),
  earnings_to_price: latest((c, i) => yieldOnMarketCap(c, i, c.ttm("net_profit", i, 0))),
  fcf_yield: latest((c, i) => yieldOnMarketCap(c, i, c.fy("fcf", i, 0))),
  fcf_yield_3y: latest((c, i) => yieldOnMarketCap(c, i, meanFcf(c, i, 3))),
  /** pe / eps_cagr_3y: null with P/E's reason when P/E is null; NPD when the CAGR is null or ≤ 0. */
  peg: latest((c, i) => {
    const pe = c.latest("pe", i);
    if (pe.v === null) return pe;
    const g = c.fy("eps_cagr_3y", i, 0);
    if (g.v === null || !(g.v > 0)) return nul("non_positive_denominator", inh(pe) | inh(g));
    return ok(pe.v / g.v, inh(pe) | inh(g));
  }),
  /** price / √(22.5 × eps_ttm × bvps). */
  price_to_graham: latest((c, i) => {
    const price = c.latest("price", i);
    if (price.v === null) return price;
    const eps = c.ttm("eps", i, 0);
    if (eps.v === null) return eps;
    if (!(eps.v > 0)) return nul("loss_making", inh(eps));
    const bvps = c.fy("bvps", i, 0);
    if (bvps.v === null) return bvps;
    if (!(bvps.v > 0)) return nul("negative_net_worth", inh(eps) | inh(bvps));
    return ok(price.v / Math.sqrt(22.5 * eps.v * bvps.v), inh(price) | inh(eps) | inh(bvps));
  }),
};
