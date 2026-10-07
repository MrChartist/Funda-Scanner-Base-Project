// src/lib/sample/common.ts — shared constants and helpers for the synthetic sample generator.
// Allowed maths only (§F.3): + − × ÷ and Math.round/floor/min/max/abs/sqrt. Cycles come from
// integer-indexed tables, never from trigonometric or exponential functions.
import type { AnnualRow, Num, PeriodFlag } from "@/lib/contracts";
import { ANNUAL_FIELDS } from "@/lib/contracts";

/** First published financial year (FY2016). */
export const FIRST_FY = 2016;
/** Latest published financial year (FY2026). */
export const LAST_FY = 2026;
/** The generator simulates one more year internally and publishes only its first quarter. */
export const SIM_LAST_FY = 2027;
/** Number of simulated years (FY2016 … FY2027). */
export const SIM_YEARS = SIM_LAST_FY - FIRST_FY + 1;
/** New listings publish only the last four financial years (FY2023 … FY2026). */
export const NEW_LISTING_FIRST_FY = 2023;
/** The single transition year of the "transition" trait. */
export const TRANSITION_FY = 2021;
/** Published quarters: Q1 FY24 (Jun 2023) … Q1 FY27 (Jun 2026). */
export const QUARTER_COUNT = 13;
/** First financial year whose four quarters are published. */
export const FIRST_QUARTER_FY = 2024;

/** Rounds money to 2 decimals (paise); never returns −0. */
export function round2(v: number): number {
  const r = Math.round(v * 100) / 100;
  return r === 0 ? 0 : r;
}

/** Integer hundredths (paise) of a 2-decimal value. */
export function cents(v: number): number {
  return Math.round(v * 100);
}

/** Clamp into [lo, hi]. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Integer-indexed cycle tables (length 12, one entry per simulated year after a phase shift).
 * Values are in units of the company's cycle amplitude.
 */
export const GROWTH_CYCLE: readonly number[] = [0.6, 1, 0.4, -0.6, -1, -0.2, 0.8, 1.2, 0.5, -0.4, -0.8, 0.2];
export const MARGIN_CYCLE: readonly number[] = [0.5, 1, 0.6, -0.4, -1, -0.6, 0.4, 1, 0.8, -0.2, -0.8, -0.2];
/** Capacity-expansion capex multipliers for cement, metals and power. */
export const CAPEX_SPIKE: readonly number[] = [1, 0.9, 1.3, 1.6, 1.4, 0.8, 0.7, 0.9, 1.3, 1.6, 1.2, 0.9];

/** Table value for simulated year y with a phase shift. */
export function cycleAt(table: readonly number[], y: number, phase: number): number {
  return table[(y + phase) % table.length];
}

/** "YYYY-03-31" for a March year end. */
export function fyEnd(fy: number): string {
  return `${fy}-03-31`;
}

/** Period ends of the four quarters of a March-ending financial year. */
export function quarterEnds(fy: number): [string, string, string, string] {
  return [`${fy - 1}-06-30`, `${fy - 1}-09-30`, `${fy - 1}-12-31`, `${fy}-03-31`];
}

/** An annual row with every field null (never 0); callers fill what the company reports. */
export function emptyAnnualRow(fy: number, flags: PeriodFlag[] = []): AnnualRow {
  const row = { fiscal_year: fy, period_end: fyEnd(fy), flags } as AnnualRow;
  for (const f of ANNUAL_FIELDS) row[f] = null;
  return row;
}

/** Reads a numeric field that the generator itself filled (throws if it is null). */
export function req(v: Num, what: string): number {
  if (v === null) throw new Error(`Generator expected ${what} to be set`);
  return v;
}
