// src/lib/metrics/derive/shareholding.ts — Shareholding metrics (spec §C.3 "Shareholding"; S grid).
// promoter_holding, fii_holding, dii_holding and num_shareholders are line items (raw fields).
import { type V, inh, nul, ok } from "../values";
import { type DeriveContext, type DeriverTable, shField, shareholding } from "./common";

/** Pledge as % of promoter holding: not meaningful when promoters hold nothing. */
function pledgedPct(c: DeriveContext, i: number, k: number): V {
  const pledged = shField(c, i, k, "promoter_pledged_pct");
  if (pledged.v === null) return pledged;
  const promoter = shField(c, i, k, "promoter_pct");
  if (promoter.v === 0) return nul("non_positive_denominator");
  return pledged;
}

export const SHAREHOLDING_DERIVERS: DeriverTable = {
  pledged_pct: shareholding(pledgedPct),
  /** promoter_pct × pledged / 100. */
  pledged_pct_of_total: shareholding((c, i, k) => {
    const promoter = shField(c, i, k, "promoter_pct");
    if (promoter.v === null) return promoter;
    const pledged = shField(c, i, k, "promoter_pledged_pct");
    if (pledged.v === null) return pledged;
    return ok((promoter.v * pledged.v) / 100, inh(promoter) | inh(pledged));
  }),
  /** max(0, 100 − promoter − FII − DII); null when any part is missing. */
  public_holding: shareholding((c, i, k) => {
    const parts = [shField(c, i, k, "promoter_pct"), shField(c, i, k, "fii_pct"), shField(c, i, k, "dii_pct")];
    for (const p of parts) if (p.v === null) return p;
    const rest = 100 - (parts[0].v as number) - (parts[1].v as number) - (parts[2].v as number);
    return ok(Math.max(0, rest));
  }),
};
