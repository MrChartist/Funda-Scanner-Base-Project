// src/lib/metrics/derive/size.ts — Size metrics (spec §C.3 "Size").
import { VF } from "@/lib/contracts";
import { type V, add, nul, ok, sub, withFlags } from "../values";
import {
  type DeriveContext, type DeriverTable, annual, capitalEmployed, cashLike, ebit, ebitda, fy, latest, netDebt,
  netWorth, ownersPat, qEbitda, qOwnersPat, qRevenue, sumQuarters, totalDebt, ttmBlock,
} from "./common";
import type { QuarterRow } from "@/lib/contracts";

/** TTM helper: Σ over the four grid quarters of block b; null when incomplete. */
export function ttmSum(fn: (r: QuarterRow) => number | null) {
  return (c: DeriveContext, i: number, b: number): V | null => {
    const rows = ttmBlock(c, i, b);
    if (!rows) return null;
    const s = sumQuarters(rows, fn);
    return s === null ? null : ok(s);
  };
}

/** market_cap = price × shares_outstanding; else market_cap_supplied (Provided). */
export function marketCap(c: DeriveContext, i: number): V {
  const m = c.company(i).market;
  if (m.price !== null && m.shares_outstanding !== null && Number.isFinite(m.price) && Number.isFinite(m.shares_outstanding)) {
    return ok(m.price * m.shares_outstanding);
  }
  if (m.market_cap_supplied !== null && Number.isFinite(m.market_cap_supplied)) return ok(m.market_cap_supplied, VF.Provided);
  return nul(m.price === null ? "no_price" : "missing_input");
}

export const SIZE_DERIVERS: DeriverTable = {
  market_cap: latest(marketCap),
  price: latest((c, i) => {
    const p = c.company(i).market.price;
    return p !== null && Number.isFinite(p) ? ok(p) : nul("no_price");
  }),
  /** EV = market_cap + total_debt + NCI − cash_like, balance sheet of the latest FY. */
  enterprise_value: latest((c, i) =>
    sub(add(c.latest("market_cap", i), totalDebt(c, i, 0), fy(c, i, 0, "non_controlling_interest")), cashLike(c, i, 0))),
  sales: { ...annual((c, i, k) => fy(c, i, k, "revenue"), ttmSum(qRevenue)), rawField: "revenue" },
  ebitda: annual(ebitda, ttmSum(qEbitda)),
  ebit: annual(ebit),
  net_profit: annual(ownersPat, ttmSum(qOwnersPat)),
  net_worth: annual(netWorth),
  total_debt: annual(totalDebt),
  net_debt: annual((c, i, k) => {
    const v = netDebt(c, i, k);
    return v.v !== null && v.v < 0 ? withFlags(v, VF.NetCash) : v;
  }),
  capital_employed: annual(capitalEmployed),
};
