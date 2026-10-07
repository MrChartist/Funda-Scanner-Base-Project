// src/lib/time/civil.ts — pure calendar arithmetic (P0, frozen).
// No Date objects: every function here is deterministic and time-zone independent.

export interface CivilDate {
  y: number;
  m: number;
  d: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

/** Strict "YYYY-MM-DD" parser. Returns null for anything else, including impossible dates. */
export function parseIsoDate(s: string): CivilDate | null {
  if (typeof s !== "string") return null;
  const match = ISO_DATE.exec(s.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

/** Days since 1970-01-01 in the proleptic Gregorian calendar (Hinnant's algorithm). */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of daysFromCivil. */
export function civilFromDays(days: number): CivilDate {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return { y, m, d };
}

function pad(n: number, width: number): string {
  const s = String(Math.abs(n));
  return (n < 0 ? "-" : "") + (s.length >= width ? s : "0".repeat(width - s.length) + s);
}

export function formatIsoDate(c: CivilDate): string {
  return `${pad(c.y, 4)}-${pad(c.m, 2)}-${pad(c.d, 2)}`;
}

/** Days from a to b (b − a) for two ISO dates; null when either is invalid. */
export function daysBetween(a: string, b: string): number | null {
  const pa = parseIsoDate(a);
  const pb = parseIsoDate(b);
  if (!pa || !pb) return null;
  return daysFromCivil(pb.y, pb.m, pb.d) - daysFromCivil(pa.y, pa.m, pa.d);
}

/**
 * Month-end arithmetic: moves to the same day k months later (negative k goes back),
 * clamped to the end of the target month. A month-end input stays a month-end
 * ("2026-06-30" − 3 months = "2026-03-31").
 */
export function addMonths(iso: string, k: number): string | null {
  const p = parseIsoDate(iso);
  if (!p) return null;
  const total = p.y * 12 + (p.m - 1) + k;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  const wasMonthEnd = p.d === daysInMonth(p.y, p.m);
  const d = wasMonthEnd ? daysInMonth(y, m) : Math.min(p.d, daysInMonth(y, m));
  return formatIsoDate({ y, m, d });
}

/** 2026 → "FY26". */
export function fyLabel(fiscalYear: number): string {
  const yy = ((fiscalYear % 100) + 100) % 100;
  return `FY${yy < 10 ? "0" : ""}${yy}`;
}

/** Fiscal year (the calendar year in which it ends) that contains a calendar month. */
export function fiscalYearOf(y: number, m: number, fyEndMonth: number): number {
  return m > fyEndMonth ? y + 1 : y;
}

/** "2026-06-30", 3 → "Q1 FY27". Returns the input unchanged when it is not a valid date. */
export function quarterLabel(periodEnd: string, fyEndMonth: number): string {
  const p = parseIsoDate(periodEnd);
  if (!p) return periodEnd;
  const end = fyEndMonth >= 1 && fyEndMonth <= 12 ? Math.floor(fyEndMonth) : 3;
  const monthsIntoYear = (p.m - end - 1 + 24) % 12; // 0 = first month of the fiscal year
  const quarter = Math.floor(monthsIntoYear / 3) + 1;
  return `Q${quarter} ${fyLabel(fiscalYearOf(p.y, p.m, end))}`;
}

/** "2026-06-30" → "Jun 2026"; the input unchanged when invalid. */
export function monthYearLabel(iso: string): string {
  const p = parseIsoDate(iso);
  if (!p) return iso;
  return `${MONTH_SHORT[p.m - 1]} ${p.y}`;
}

/** "2026-06-30" → "TTM to Jun 2026". */
export function ttmLabel(lastQuarterEnd: string): string {
  return `TTM to ${monthYearLabel(lastQuarterEnd)}`;
}
