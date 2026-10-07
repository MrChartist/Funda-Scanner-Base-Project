// src/lib/metrics/derive/growth.ts — Growth metrics (spec §C.3 "Growth").
// Year-on-year growth needs both years in the grid (else insufficient_history) and is not
// comparable across a restated or transition year (transition_period). The year-ago quarter is
// the grid slot four places back, which is matched by date, never by array position.
import type { QuarterRow } from "@/lib/contracts";
import { type V, growthPct, inh, nul, ok, sub } from "../values";
import {
  type DeriveContext, type DeriverTable, flaggedFy, fy, hasFy, hasQ, latest, ownersPat, qOwnersPat, qRevenue, quarterly,
  sumQuarters, ttmBlock, annual,
} from "./common";

type SlotFn = (c: DeriveContext, i: number, k: number) => V;

/** YoY growth of an annual quantity at slot k versus slot k + 1. */
export function yoyAnnual(fn: SlotFn): SlotFn {
  return (c, i, k) => {
    const cur = fn(c, i, k);
    if (cur.v === null) return cur;
    if (!hasFy(c, i, k + 1)) return nul("insufficient_history", inh(cur));
    if (flaggedFy(c, i, k) || flaggedFy(c, i, k + 1)) return nul("transition_period", inh(cur));
    return growthPct(cur, fn(c, i, k + 1));
  };
}

/** Growth of the latest twelve months against the twelve before; needs 8 consecutive quarters. */
function ttmGrowth(fn: (r: QuarterRow) => number | null) {
  return (c: DeriveContext, i: number): V => {
    const now = ttmBlock(c, i, 0);
    const before = ttmBlock(c, i, 1);
    if (!now || !before) return nul("insufficient_history");
    const a = sumQuarters(now, fn);
    const b = sumQuarters(before, fn);
    if (a === null || b === null) return nul("missing_input");
    return growthPct(ok(a), ok(b));
  };
}

/** YoY change of a quarterly metric against the date-matched quarter a year earlier (slot k + 4). */
function yoyQuarter(id: string, combine: (a: V, b: V) => V) {
  return (c: DeriveContext, i: number, k: number): V => {
    const cur = c.q(id, i, k);
    if (cur.v === null) return cur;
    if (!hasQ(c, i, k + 4)) return nul("insufficient_history", inh(cur));
    return combine(cur, c.q(id, i, k + 4));
  };
}

export const GROWTH_DERIVERS: DeriverTable = {
  sales_growth: annual(yoyAnnual((c, i, k) => fy(c, i, k, "revenue"))),
  profit_growth: annual(yoyAnnual(ownersPat)),
  ttm_sales_growth: latest(ttmGrowth(qRevenue)),
  ttm_profit_growth: latest(ttmGrowth(qOwnersPat)),
  q_sales_yoy: quarterly(yoyQuarter("q_sales", growthPct)),
  q_profit_yoy: quarterly(yoyQuarter("q_net_profit", growthPct)),
  q_opm_change_yoy: quarterly(yoyQuarter("q_opm", sub)),
};
