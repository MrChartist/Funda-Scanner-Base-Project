// src/lib/data/health.ts — what a company's figures rest on (WS1).
// Lists every zero-default assumption, missing required inputs, provided-versus-derived
// differences above 5% and the validation issues for the company.
import type { AnnualField, DataHealth, MetricStore } from "@/lib/contracts";
import { REQUIRED_ANNUAL_FIELDS, VF, ZERO_DEFAULT_FIELDS } from "@/lib/contracts";
import { fyLabel } from "@/lib/time/civil";
import { validateCompany } from "./validate";

/** Provided and derived values that differ by more than this (percent) are listed. */
export const MISMATCH_THRESHOLD_PCT = 5;

/** Plain-language note for each zero-default assumption, shown by the data-health panel. */
export const ASSUMED_ZERO_TEXT: Readonly<Record<string, string>> = {
  other_income: "Other income not provided; treated as 0 in EBIT and profit figures.",
  exceptional_items: "Exceptional items not provided; treated as 0.",
  non_controlling_interest: "Non-controlling interest not provided; treated as 0 in total equity.",
  lease_liabilities: "Lease liabilities not provided; treated as 0 in debt.",
  current_investments: "Current investments not provided; treated as 0 in cash and investments.",
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function latest(rows: readonly { period_end: string }[]): string | null {
  let best: string | null = null;
  for (const r of rows) if (best === null || r.period_end > best) best = r.period_end;
  return best;
}

export function computeDataHealth(store: MetricStore, i: number): DataHealth {
  const c = store.company(i);
  const years = c.annual.map((r) => r.fiscal_year).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let k = 1; k < years.length; k++) for (let y = years[k - 1] + 1; y < years[k]; y++) gaps.push(y);

  const assumedZero = ZERO_DEFAULT_FIELDS
    .map((field: AnnualField) => ({ field, years: c.annual.filter((r) => r[field] === null).length }))
    .filter((x) => x.years > 0);

  const missingRequired = store.family(i) === "non_financial"
    ? c.annual
      .map((r) => ({ period: fyLabel(r.fiscal_year), fields: REQUIRED_ANNUAL_FIELDS.filter((f) => r[f] === null) as string[] }))
      .filter((x) => x.fields.length > 0)
    : [];

  // Provided (snapshot) versus derived values. Derived values win in the store; when the store's
  // value is not flagged Provided, it was derived from the statements and can be compared.
  const mismatches: DataHealth["mismatches"] = [];
  const compare = (metric: string, provided: number) => {
    if (!store.def(metric)) return;
    let derived: number | null = null;
    try {
      const mv = store.get(metric, i);
      if (mv.v !== null && (mv.flags & VF.Provided) === 0) derived = mv.v;
    } catch {
      return;
    }
    if (derived === null) return;
    const base = Math.abs(derived);
    const pctDiff = base === 0 ? (provided === 0 ? 0 : 100) : (Math.abs(provided - derived) / base) * 100;
    if (pctDiff > MISMATCH_THRESHOLD_PCT) mismatches.push({ metric, provided, derived, pctDiff: round1(pctDiff) });
  };
  for (const [metric, provided] of Object.entries(c.snapshot)) {
    if (Number.isFinite(provided)) compare(metric, provided);
  }
  if (c.market.market_cap_supplied !== null) compare("market_cap", c.market.market_cap_supplied);

  return {
    years: { first: years[0] ?? null, last: years[years.length - 1] ?? null, count: years.length, gaps },
    quarters: { count: c.quarterly.length, last: latest(c.quarterly) },
    shareholding: { count: c.shareholding.length, last: latest(c.shareholding) },
    snapshotOnly: c.annual.length === 0 && c.quarterly.length === 0,
    typeInferred: store.companyType(i).inferred,
    assumedZero,
    missingRequired,
    mismatches,
    issues: validateCompany(c),
  };
}
