// src/lib/user/xirr.ts — annualised internal rate of return for dated cash flows (WS7).
// Pure and deterministic. Returns null, never NaN or Infinity, when the rate is undefined: no sign
// change in the flows, a single date, non-finite input or no root in the searched range.
import { daysBetween } from "@/lib/time/civil";

export interface DatedFlow {
  /** Negative for money paid in, positive for money received. */
  amount: number;
  /** YYYY-MM-DD. */
  date: string;
}

const DAYS_PER_YEAR = 365;
const LOWEST = -0.999999;
const HIGHEST = 1e6;

/** Annual rate as a fraction (0.12 = 12% a year), or null. */
export function xirr(flows: readonly DatedFlow[]): number | null {
  if (flows.length < 2) return null;
  const first = flows.reduce<string | null>((min, f) => (min === null || f.date < min ? f.date : min), null);
  if (first === null) return null;
  const terms: { amount: number; years: number }[] = [];
  let anyNegative = false;
  let anyPositive = false;
  let longest = 0;
  for (const f of flows) {
    if (!Number.isFinite(f.amount)) return null;
    const days = daysBetween(first, f.date);
    if (days === null) return null;
    if (f.amount < 0) anyNegative = true;
    if (f.amount > 0) anyPositive = true;
    longest = Math.max(longest, days);
    terms.push({ amount: f.amount, years: days / DAYS_PER_YEAR });
  }
  if (!anyNegative || !anyPositive || longest === 0) return null;

  const npv = (rate: number): number => {
    let sum = 0;
    for (const t of terms) sum += t.amount / Math.pow(1 + rate, t.years);
    return sum;
  };

  let lo = LOWEST;
  let hi = HIGHEST;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo === 0 || fHi === 0 || Math.sign(fLo) === Math.sign(fHi)) {
    return null;
  }
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const f = npv(mid);
    if (!Number.isFinite(f)) return null;
    if (Math.sign(f) === Math.sign(fLo)) {
      lo = mid;
      fLo = f;
    } else {
      hi = mid;
    }
    if (hi - lo < 1e-12) break;
  }
  const rate = (lo + hi) / 2;
  return Number.isFinite(rate) ? rate : null;
}
