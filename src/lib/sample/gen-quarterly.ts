// src/lib/sample/gen-quarterly.ts — splits simulated financial years into quarters (§F.3 item 9).
// Work is done in integer paise, and Q4 takes the remainder, so the four quarters of every
// published financial year add up EXACTLY to the annual figure. The generator simulates FY2027
// and publishes only its first quarter (Jun 2026), so TTM differs from FY2026.
import type { AnnualRow, Num, QuarterRow } from "@/lib/contracts";
import type { Seasonality } from "./archetypes";
import { FIRST_QUARTER_FY, QUARTER_COUNT, SIM_LAST_FY, cents, quarterEnds } from "./common";
import { type Rng, noise } from "./prng";

/** Depreciation is spread almost evenly; Q4 takes the remainder. */
const DEPRECIATION_WEIGHTS: readonly number[] = [0.245, 0.25, 0.25];

function fromCents(c: number): number {
  const v = c / 100;
  return v === 0 ? 0 : v;
}

/** Splits a total (in paise) by three weights; the fourth part is the remainder. */
function splitByWeights(total: number, weights: readonly number[]): [number, number, number, number] {
  const q1 = Math.round(total * weights[0]);
  const q2 = Math.round(total * weights[1]);
  const q3 = Math.round(total * weights[2]);
  return [q1, q2, q3, total - q1 - q2 - q3];
}

/** Splits a total (in paise) in proportion to four positive parts; the fourth takes the remainder. */
function splitByParts(total: number, parts: readonly number[]): [number, number, number, number] {
  const sum = parts[0] + parts[1] + parts[2] + parts[3];
  return splitByWeights(total, [parts[0] / sum, parts[1] / sum, parts[2] / sum]);
}

function num(v: Num): number {
  return v ?? 0;
}

/** The four quarters of one simulated financial year. */
export function splitYear(row: AnnualRow, seasonality: Seasonality, rng: Rng): QuarterRow[] {
  const weights = [
    seasonality[0] * (1 + noise(rng, 0.03)),
    seasonality[1] * (1 + noise(rng, 0.03)),
    seasonality[2] * (1 + noise(rng, 0.03)),
  ];
  const revenueC = cents(num(row.revenue));
  const opexC = cents(num(row.operating_expenses));
  const depC = cents(num(row.depreciation));
  const npC = cents(num(row.net_profit));
  const ownersC = cents(num(row.net_profit_owners ?? row.net_profit));

  const rev = splitByWeights(revenueC, weights);
  const opexShare = revenueC !== 0 ? opexC / revenueC : 0;
  const opexParts = [0, 1, 2].map((i) => Math.round(rev[i] * opexShare * (1 + noise(rng, 0.02))));
  const opex: [number, number, number, number] = [
    opexParts[0], opexParts[1], opexParts[2], opexC - opexParts[0] - opexParts[1] - opexParts[2],
  ];
  const dep = splitByWeights(depC, DEPRECIATION_WEIGHTS);

  const earnings = [0, 1, 2, 3].map((i) => rev[i] - opex[i] - dep[i]);
  const np = npC > 0 && earnings.every((e) => e > 0)
    ? splitByParts(npC, earnings)
    : splitByWeights(npC, weights);
  const ownersRatio = npC !== 0 ? ownersC / npC : 1;
  const ownersParts = [0, 1, 2].map((i) => Math.round(np[i] * ownersRatio));
  const owners = npC !== 0
    ? [ownersParts[0], ownersParts[1], ownersParts[2], ownersC - ownersParts[0] - ownersParts[1] - ownersParts[2]]
    : splitByWeights(ownersC, weights);

  const ends = quarterEnds(row.fiscal_year);
  return ends.map((periodEnd, i) => ({
    period_end: periodEnd,
    revenue: fromCents(rev[i]),
    operating_expenses: fromCents(opex[i]),
    depreciation: fromCents(dep[i]),
    net_profit: fromCents(np[i]),
    net_profit_owners: fromCents(owners[i]),
  }));
}

/**
 * The 13 published quarters (Q1 FY24 … Q1 FY27), oldest first, from simulated annual rows.
 * Always consumes the PRNG, even when the caller later drops the block, so traits never
 * change the other figures of a company.
 */
export function generateQuarters(simRows: readonly AnnualRow[], seasonality: Seasonality, rng: Rng): QuarterRow[] {
  const out: QuarterRow[] = [];
  for (let fy = FIRST_QUARTER_FY; fy <= SIM_LAST_FY; fy++) {
    const row = simRows.find((r) => r.fiscal_year === fy);
    if (!row) throw new Error(`Generator has no simulated FY${fy}`);
    out.push(...splitYear(row, seasonality, rng));
  }
  return out.slice(0, QUARTER_COUNT);
}

/** Trailing-twelve-month sum of a quarterly field over the last four quarters. */
export function ttmSum(quarters: readonly QuarterRow[], field: "revenue" | "net_profit" | "net_profit_owners"): number {
  const last4 = quarters.slice(-4);
  let total = 0;
  for (const q of last4) total += num(q[field]);
  return Math.round(total * 100) / 100;
}
