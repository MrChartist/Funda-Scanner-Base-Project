// src/lib/sample/gen-market.ts — the reference price and share data of one fictional company.
// price = round2(P/E × TTM EPS); companies without positive TTM earnings are priced on sales
// (P/S × TTM sales per share). The price date is never invented: it stays null (§F.1).
import type { MarketInputs } from "@/lib/contracts";
import type { Archetype, Range } from "./archetypes";
import { round2 } from "./common";
import { type Rng, fromRange } from "./prng";

/** Archetype-specific P/E ranges; other archetypes use their sector's range. */
const ARCHETYPE_PE: Partial<Readonly<Record<Archetype, Range>>> = {
  compounder: [40, 60],
  cyclical: [7, 12],
  leveraged_utility: [9, 14],
  value_trap: [4.5, 7.5],
  turnaround: [18, 28],
  expensive_grower: [70, 100],
  dividend_payer: [12, 18],
  stressed_bank: [6, 9],
};

export interface MarketInput {
  archetype: Archetype;
  sectorPe: Range;
  sectorPs: Range;
  /** Crore shares at the latest year end. */
  shares: number;
  faceValue: number;
  /** Owners' net profit over the last four quarters, ₹ crore. */
  ttmOwners: number;
  /** Revenue over the last four quarters, ₹ crore. */
  ttmRevenue: number;
  /** Latest dividend per share, ₹ (the price is kept above it). */
  latestDps: number;
}

export function generateMarket(m: MarketInput, rng: Rng): MarketInputs {
  const goodBankBoost = m.archetype === "good_bank" ? 4 : 0;
  const peRange = ARCHETYPE_PE[m.archetype] ?? m.sectorPe;
  const pe = fromRange(rng, peRange) + goodBankBoost;
  const ps = fromRange(rng, m.sectorPs);
  const eps = m.shares > 0 ? m.ttmOwners / m.shares : 0;
  const priceOnSales = m.archetype === "loss_maker" || m.archetype === "negative_net_worth" || eps <= 0;
  const raw = priceOnSales ? (ps * Math.max(m.ttmRevenue, 1)) / Math.max(m.shares, 0.01) : pe * eps;
  const price = round2(Math.max(1, m.latestDps * 1.5, raw));
  return {
    price,
    price_date: null,
    shares_outstanding: m.shares,
    face_value: m.faceValue,
    market_cap_supplied: null,
  };
}
