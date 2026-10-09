// src/lib/metrics/derive/leverage.ts — Leverage & Liquidity metrics (spec §C.3; annual).
import { VF } from "@/lib/contracts";
import { type V, add, inh, nul, ok, ratio, sub, withFlags } from "../values";
import {
  type DeriveContext, type DeriverTable, annual, avgField, avgOf, ebit, ebitda, fy, netDebt, totalDebt, totalEquity,
} from "./common";

function netCash(v: V, nd: V): V {
  return nd.v !== null && nd.v < 0 ? withFlags(v, VF.NetCash) : v;
}

export const LEVERAGE_DERIVERS: DeriverTable = {
  debt_equity: annual((c, i, k) => ratio(totalDebt(c, i, k), totalEquity(c, i, k), "negative_net_worth")),
  debt_equity_ex_leases: annual((c, i, k) =>
    ratio(add(fy(c, i, k, "borrowings_non_current"), fy(c, i, k, "borrowings_current")), totalEquity(c, i, k), "negative_net_worth")),
  net_debt_equity: annual((c, i, k) => {
    const nd = netDebt(c, i, k);
    return netCash(ratio(nd, totalEquity(c, i, k), "negative_net_worth"), nd);
  }),
  /** total_debt / ebitda; 0 when there is no debt; NPD when ebitda ≤ 0 with debt. */
  debt_ebitda: annual((c, i, k) => {
    const td = totalDebt(c, i, k);
    if (td.v === 0) return ok(0, inh(td));
    return ratio(td, ebitda(c, i, k), "non_positive_denominator");
  }),
  net_debt_ebitda: annual((c, i, k) => {
    const nd = netDebt(c, i, k);
    return netCash(ratio(nd, ebitda(c, i, k), "non_positive_denominator"), nd);
  }),
  /** ebit / finance_cost; no_interest_cost when finance cost is 0. */
  interest_coverage: annual((c: DeriveContext, i: number, k: number) => {
    const fc = fy(c, i, k, "finance_cost");
    if (fc.v === 0) return nul("no_interest_cost", inh(fc));
    const e = ebit(c, i, k);
    if (e.v === null) return e;
    return ratio(e, fc, "non_positive_denominator");
  }),
  current_ratio: annual((c, i, k) =>
    ratio(fy(c, i, k, "total_current_assets"), fy(c, i, k, "total_current_liabilities"), "non_positive_denominator")),
  quick_ratio: annual((c, i, k) =>
    ratio(sub(fy(c, i, k, "total_current_assets"), fy(c, i, k, "inventories")), fy(c, i, k, "total_current_liabilities"), "non_positive_denominator")),
  equity_multiplier: annual((c, i, k) => {
    const ta = avgField("total_assets")(c, i, k);
    const te = avgOf(totalEquity, c, i, k);
    if (ta.v !== null && !(ta.v > 0) && te.v !== null && te.v > 0) return nul("non_positive_denominator", inh(ta) | inh(te));
    return ratio(ta, te, "negative_net_worth");
  }),
};
