// src/lib/sample/gen-shareholding.ts — 13 quarters of fictional shareholding (Jun 2023 … Jun 2026).
// Promoter, FII and DII holdings move slowly; their total never exceeds 100 (the rest is public).
// Pledge is a percentage of the PROMOTER holding, as in the dataset contract.
import type { ShareholdingRow } from "@/lib/contracts";
import type { Archetype, PromoterKind } from "./archetypes";
import { FIRST_QUARTER_FY, QUARTER_COUNT, SIM_LAST_FY, clamp, quarterEnds, round2 } from "./common";
import { type Rng, between, chance, intBetween, noise } from "./prng";

/** Institutions plus promoters never hold more than this share; the public holds the rest. */
const MAX_NON_PUBLIC = 97;

function promoterStart(kind: PromoterKind, rng: Rng): number {
  switch (kind) {
    case "family": return between(rng, 45, 65);
    case "mnc": return between(rng, 60, 75);
    case "psu": return between(rng, 60, 88);
    case "professional": return 0;
  }
}

/** Quarter ends of the shareholding grid, oldest first. */
export function shareholdingDates(): string[] {
  const out: string[] = [];
  for (let fy = FIRST_QUARTER_FY; fy <= SIM_LAST_FY; fy++) out.push(...quarterEnds(fy));
  return out.slice(0, QUARTER_COUNT);
}

/**
 * Generates the shareholding block. `scale` (₹ crore of revenue) sets the number of shareholders.
 * Always consumes the PRNG in the same order, whatever the archetype.
 */
export function generateShareholding(kind: PromoterKind, archetype: Archetype, scale: number, rng: Rng): ShareholdingRow[] {
  let promoter = promoterStart(kind, rng);
  const smallPledge = kind === "family" && chance(rng, 0.15) ? between(rng, 1, 6) : 0;
  let pledge = archetype === "rf_pledge" ? between(rng, 28, 35) : smallPledge;
  const pledgeStep = between(rng, 1.6, 2.4);
  let fii = kind === "professional" ? between(rng, 25, 45) : between(rng, 5, 25);
  let dii = kind === "professional" ? between(rng, 20, 35) : between(rng, 5, 20);
  const excess = promoter + fii + dii - 92;
  if (excess > 0) {
    const cut = excess / (fii + dii);
    fii *= 1 - cut;
    dii *= 1 - cut;
  }
  let holders = intBetween(rng, 15000, 120000) + Math.floor(Math.min(scale, 200000) * 4);

  const rows: ShareholdingRow[] = [];
  for (const periodEnd of shareholdingDates()) {
    const step = noise(rng, 1);
    if (promoter > 0) {
      if (archetype === "serial_diluter") promoter = Math.max(20, promoter - 0.75);
      else if (Math.abs(step) > 0.85) promoter = clamp(promoter + step * 0.5, 1, 90);
    }
    if (archetype === "rf_pledge") pledge = Math.min(95, pledge + pledgeStep);
    fii = Math.max(0.5, fii + noise(rng, 0.6));
    dii = Math.max(0.5, dii + noise(rng, 0.5));
    const over = promoter + fii + dii - MAX_NON_PUBLIC;
    if (over > 0) {
      fii = Math.max(0.5, fii - over / 2);
      dii = Math.max(0.5, dii - over / 2);
    }
    holders = Math.max(1000, Math.round(holders * (1.01 + noise(rng, 0.03))));
    const promoterPct = round2(promoter);
    rows.push({
      period_end: periodEnd,
      promoter_pct: promoterPct,
      promoter_pledged_pct: promoterPct > 0 ? round2(pledge) : 0,
      fii_pct: round2(fii),
      dii_pct: round2(dii),
      num_shareholders: holders,
    });
  }
  return rows;
}
