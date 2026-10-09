// src/lib/metrics/grid.ts — the calendar grid (spec §C.1).
//  • Annual slot k holds fiscal year latestFy − k; a missing year is a hole (null).
//  • Quarter slot k holds the period end closest to latestQ − 3k months, within ±15 days
//    (QUARTER_MATCH_TOLERANCE_DAYS), computed with daysFromCivil. Shareholding uses its own grid
//    with the same rule.
//  • Data is never shifted into a hole, and rows are matched by date, never by position.
// The grid is densified: every slot between the latest and the oldest period exists.
import type { AnnualRow, CompanyRecord, QuarterRow, ShareholdingRow } from "@/lib/contracts";
import {
  MAX_ANNUAL_SLOTS, MAX_QUARTER_SLOTS, MAX_SHAREHOLDING_SLOTS, QUARTER_MATCH_TOLERANCE_DAYS,
} from "@/lib/contracts";
import { daysFromCivil, daysInMonth, parseIsoDate } from "@/lib/time/civil";

export interface CompanyGrid {
  /** annual[k] = row of fiscal year latestFy − k, or null for a hole. Oldest slot holds data. */
  annual: (AnnualRow | null)[];
  latestFy: number | null;
  /** quarter[k] = quarter ending about 3k months before the latest quarter, or null. */
  quarter: (QuarterRow | null)[];
  share: (ShareholdingRow | null)[];
}

/** Day number of an ISO date, or null when invalid. */
export function dayNumber(iso: string | null): number | null {
  if (iso === null) return null;
  // Fast path for the canonical "YYYY-MM-DD" shape; anything else goes through the strict parser.
  if (iso.length === 10 && iso.charCodeAt(4) === 45 && iso.charCodeAt(7) === 45) {
    const y = digits(iso, 0, 4);
    const m = digits(iso, 5, 2);
    const d = digits(iso, 8, 2);
    if (y >= 0 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)) return daysFromCivil(y, m, d);
    return null;
  }
  const p = parseIsoDate(iso);
  return p ? daysFromCivil(p.y, p.m, p.d) : null;
}

/** Unsigned decimal digits at s[from … from+len), or −1 when any character is not a digit. */
function digits(s: string, from: number, len: number): number {
  let v = 0;
  for (let j = from; j < from + len; j++) {
    const c = s.charCodeAt(j) - 48;
    if (c < 0 || c > 9) return -1;
    v = v * 10 + c;
  }
  return v;
}

/** Day number of a financial year's end: period_end when valid, else the last day of fy_end_month. */
export function fyEndDay(row: AnnualRow, fyEndMonth: number): number {
  const d = dayNumber(row.period_end);
  if (d !== null) return d;
  const m = fyEndMonth >= 1 && fyEndMonth <= 12 ? Math.floor(fyEndMonth) : 3;
  return daysFromCivil(row.fiscal_year, m, daysInMonth(row.fiscal_year, m));
}

/**
 * Day number of the date k months after a civil date, with the same month-end rule as
 * time/civil.addMonths (a month-end stays a month-end; other days are clamped to the month).
 */
function addMonthsDay(y: number, m: number, d: number, k: number): number {
  const total = y * 12 + (m - 1) + k;
  const ty = Math.floor(total / 12);
  const tm = total - ty * 12 + 1;
  const dim = daysInMonth(ty, tm);
  const td = d === daysInMonth(y, m) ? dim : Math.min(d, dim);
  return daysFromCivil(ty, tm, td);
}

/** Slots dated rows into a quarterly grid from the latest period end backwards. */
export function slotByDate<T extends { period_end: string }>(rows: readonly T[], maxSlots: number): (T | null)[] {
  const dated: { r: T; d: number }[] = [];
  for (const r of rows) {
    const d = dayNumber(r.period_end);
    if (d !== null) dated.push({ r, d });
  }
  if (dated.length === 0) return [];
  dated.sort((a, b) => b.d - a.d);
  const latest = parseIsoDate(dated[0].r.period_end);
  if (!latest) return [];
  const oldest = dated[dated.length - 1].d;
  const used = new Set<number>();
  const out: (T | null)[] = [];
  for (let k = 0; k < maxSlots; k++) {
    const td = addMonthsDay(latest.y, latest.m, latest.d, -3 * k);
    if (td < oldest - QUARTER_MATCH_TOLERANCE_DAYS) break;
    let best = -1;
    let bestGap = Number.POSITIVE_INFINITY;
    for (let j = 0; j < dated.length; j++) {
      if (used.has(j)) continue;
      const gap = Math.abs(dated[j].d - td);
      if (gap <= QUARTER_MATCH_TOLERANCE_DAYS && gap < bestGap) {
        best = j;
        bestGap = gap;
      }
    }
    if (best >= 0) {
      used.add(best);
      out.push(dated[best].r);
    } else {
      out.push(null);
    }
  }
  while (out.length > 0 && out[out.length - 1] === null) out.pop();
  return out;
}

/** Annual slots: latest fiscal year first; the last row given for a year wins. */
export function slotAnnual(rows: readonly AnnualRow[]): { annual: (AnnualRow | null)[]; latestFy: number | null } {
  const byYear = new Map<number, AnnualRow>();
  let latestFy: number | null = null;
  let oldestFy: number | null = null;
  for (const r of rows) {
    if (!Number.isInteger(r.fiscal_year)) continue;
    byYear.set(r.fiscal_year, r);
    if (latestFy === null || r.fiscal_year > latestFy) latestFy = r.fiscal_year;
    if (oldestFy === null || r.fiscal_year < oldestFy) oldestFy = r.fiscal_year;
  }
  const annual: (AnnualRow | null)[] = [];
  if (latestFy !== null && oldestFy !== null) {
    for (let k = 0; k < MAX_ANNUAL_SLOTS && latestFy - k >= oldestFy; k++) annual.push(byYear.get(latestFy - k) ?? null);
  }
  while (annual.length > 0 && annual[annual.length - 1] === null) annual.pop();
  return { annual, latestFy };
}

export function buildGrid(c: CompanyRecord): CompanyGrid {
  const { annual, latestFy } = slotAnnual(c.annual);
  return {
    annual,
    latestFy,
    quarter: slotByDate(c.quarterly, MAX_QUARTER_SLOTS),
    share: slotByDate(c.shareholding, MAX_SHAREHOLDING_SLOTS),
  };
}

/** Slot state of a grid position: present, a hole inside the history, or beyond it. */
export type SlotState = "ok" | "hole" | "beyond";

export function slotState<T>(rows: readonly (T | null)[], k: number): SlotState {
  if (k < 0 || k >= rows.length) return "beyond";
  return rows[k] === null ? "hole" : "ok";
}

/** True when annual slot k is a restated or transition year. */
export function isFlaggedYear(grid: CompanyGrid, k: number): boolean {
  const row = k >= 0 && k < grid.annual.length ? grid.annual[k] : null;
  return row !== null && row.flags.length > 0;
}
