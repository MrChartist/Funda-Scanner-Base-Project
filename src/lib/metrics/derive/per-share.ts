// src/lib/metrics/derive/per-share.ts — Per-share metrics (spec §C.3 "Dividend and Per Share").
import { VF } from "@/lib/contracts";
import { type V, nul, ok, ratio } from "../values";
import {
  type DeriveContext, type DeriverTable, annual, netWorth, ownersPat, qOwnersPat, sharesYe, sumQuarters, ttmBlock,
} from "./common";

/** Current shares in issue for TTM per-share values; the latest year-end count is the flagged fallback. */
function currentShares(c: DeriveContext, i: number): V {
  const m = c.company(i).market.shares_outstanding;
  if (m !== null && Number.isFinite(m)) return ok(m);
  const ye = c.grid(i).annual[0]?.shares_outstanding_ye ?? null;
  return ye !== null && Number.isFinite(ye) ? ok(ye, VF.Approximate) : nul("missing_input");
}

export const PER_SHARE_DERIVERS: DeriverTable = {
  /** owners_pat / shares_ye; TTM: Σ4q owners' profit / shares_outstanding. */
  eps: annual(
    (c, i, k) => ratio(ownersPat(c, i, k), sharesYe(c, i, k), "non_positive_denominator"),
    (c, i, b) => {
      const rows = ttmBlock(c, i, b);
      if (!rows) return null;
      const np = sumQuarters(rows, qOwnersPat);
      if (np === null) return null;
      return ratio(ok(np), currentShares(c, i), "non_positive_denominator");
    },
  ),
  bvps: annual((c, i, k) => ratio(netWorth(c, i, k), sharesYe(c, i, k), "non_positive_denominator")),
};
