// src/lib/data/import/units.ts — money-scale conversion and unit sniffing (W105) (WS1).
// The dataset stores money in ₹ crore, shares in crore and percentages as percent numbers.
import type { AnnualRow, CompanyRecord, FundamentalsDataset, QuarterRow, ValidationIssue } from "@/lib/contracts";
import { ANNUAL_FIELD_INFO, ANNUAL_FIELDS, QUARTER_FIELD_INFO, QUARTER_FIELDS, SHAREHOLDING_FIELD_INFO, SHAREHOLDING_FIELDS } from "@/lib/contracts";
import { fyLabel } from "@/lib/time/civil";
import { formatInr, formatNumberIN } from "@/lib/format/indian";

export type MoneyScale = "crore" | "lakh" | "rupee" | "million";

export const MONEY_SCALES: readonly MoneyScale[] = ["crore", "lakh", "rupee", "million"];

/** Multiply a figure in the given scale by this factor to get ₹ crore. */
export const MONEY_SCALE_TO_CRORE: Readonly<Record<MoneyScale, number>> = {
  crore: 1,
  lakh: 0.01,       // 100 lakh = 1 crore
  rupee: 1e-7,      // 1 crore = 10,000,000 rupees
  million: 0.1,     // 1 million = 10 lakh = 0.1 crore
};

export const MONEY_SCALE_LABEL: Readonly<Record<MoneyScale, string>> = {
  crore: "₹ crore",
  lakh: "₹ lakh",
  rupee: "₹ (rupees)",
  million: "₹ million",
};

/** Annual and quarterly fields stored in ₹ crore (the ones a money scale applies to). */
export const ANNUAL_MONEY_FIELDS = ANNUAL_FIELDS.filter((f) => ANNUAL_FIELD_INFO[f].unit === "inr_cr");
export const QUARTER_MONEY_FIELDS = QUARTER_FIELDS.filter((f) => QUARTER_FIELD_INFO[f].unit === "inr_cr");
export const SHAREHOLDING_PCT_FIELDS = SHAREHOLDING_FIELDS.filter((f) => SHAREHOLDING_FIELD_INFO[f].unit === "pct");

/** Rounds away binary noise introduced by scaling (12 significant digits). */
function clean(v: number): number {
  return Number.parseFloat(v.toPrecision(12));
}

export function scaleMoney(v: number | null, scale: MoneyScale): number | null {
  if (v === null || scale === "crore") return v;
  return clean(v * MONEY_SCALE_TO_CRORE[scale]);
}

export function scaleAnnualRow(r: AnnualRow, scale: MoneyScale): void {
  if (scale === "crore") return;
  for (const f of ANNUAL_MONEY_FIELDS) r[f] = scaleMoney(r[f], scale);
}

export function scaleQuarterRow(q: QuarterRow, scale: MoneyScale): void {
  if (scale === "crore") return;
  for (const f of QUARTER_MONEY_FIELDS) q[f] = scaleMoney(q[f], scale);
}

/**
 * Converts every ₹-crore field of a company (annual and quarterly money fields, and the supplied
 * market cap) from `scale` to crore, in place. Per-share values (price, DPS), share counts and
 * percentages are not money totals and are left unchanged.
 */
export function applyMoneyScale(c: CompanyRecord, scale: MoneyScale): void {
  if (scale === "crore") return;
  for (const r of c.annual) scaleAnnualRow(r, scale);
  for (const q of c.quarterly) scaleQuarterRow(q, scale);
  c.market.market_cap_supplied = scaleMoney(c.market.market_cap_supplied, scale);
}

function issue(code: string, message: string, extra: Partial<ValidationIssue> = {}): ValidationIssue {
  return { level: "warning", code, message, file: null, row: null, symbol: null, period: null, field: null, ...extra };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Above this median revenue (₹ crore) the figures are probably in ₹ or lakh. */
export const SNIFF_REVENUE_MEDIAN = 1e7;
/** Above this many crore shares the column is probably a plain share count. */
export const SNIFF_SHARES_CRORE = 1e5;

/**
 * Unit sniffing (W105). Never changes data; only warns.
 *  - W105_UNITS_RUPEES: median annual revenue above 1e7 (₹ crore).
 *  - W105_UNITS_FRACTION: every non-zero shareholding percentage is at or below 1.
 *  - W105_UNITS_SHARE_COUNT: shares outstanding above 1e5 crore.
 *  - W105_UNITS_DPS: latest dividend per share above the reference price.
 */
export function sniffUnits(ds: FundamentalsDataset): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const revenues: number[] = [];
  const pcts: number[] = [];
  for (const c of ds.companies) {
    for (const r of c.annual) if (r.revenue !== null) revenues.push(r.revenue);
    for (const s of c.shareholding) {
      for (const f of SHAREHOLDING_PCT_FIELDS) {
        const v = s[f];
        if (v !== null && v !== 0) pcts.push(Math.abs(v));
      }
    }
  }
  const med = median(revenues);
  if (med !== null && med > SNIFF_REVENUE_MEDIAN) {
    out.push(issue(
      "W105_UNITS_RUPEES",
      `The median annual revenue is ${formatNumberIN(med, 0)}, which is too large for ₹ crore. The figures are probably in ₹ or ₹ lakh. Choose the matching unit and import again.`,
      { field: "revenue" },
    ));
  }
  if (pcts.length > 0 && pcts.every((v) => v <= 1)) {
    out.push(issue(
      "W105_UNITS_FRACTION",
      "Every shareholding percentage is 1 or less. They look like fractions (0.45) rather than percentages (45). Multiply them by 100 and import again.",
      { field: "promoter_pct" },
    ));
  }
  for (const c of ds.companies) {
    const shareValues = [c.market.shares_outstanding, ...c.annual.map((r) => r.shares_outstanding_ye)];
    if (shareValues.some((v) => v !== null && v > SNIFF_SHARES_CRORE)) {
      out.push(issue(
        "W105_UNITS_SHARE_COUNT",
        `${c.symbol}: shares outstanding exceed ${formatNumberIN(SNIFF_SHARES_CRORE, 0)} crore. The value is probably a plain share count; enter it in crore shares.`,
        { symbol: c.symbol, field: "shares_outstanding" },
      ));
    }
    const latest = [...c.annual].reverse().find((r) => r.dividend_per_share !== null);
    const price = c.market.price;
    if (latest && latest.dividend_per_share !== null && price !== null && price > 0 && latest.dividend_per_share > price) {
      out.push(issue(
        "W105_UNITS_DPS",
        `${c.symbol}: the dividend per share for ${fyLabel(latest.fiscal_year)} (${formatInr(latest.dividend_per_share)}) is above the reference price (${formatInr(price)}). Check that both are in ₹ per share.`,
        { symbol: c.symbol, field: "dividend_per_share", period: fyLabel(latest.fiscal_year) },
      ));
    }
  }
  return out;
}
