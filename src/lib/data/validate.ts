// src/lib/data/validate.ts — content checks on a normalised dataset and the import report (WS1).
// Checks never change data; they only describe what looks inconsistent.
//
//  W100 pbt − tax differs from net profit by more than max(1%, ₹1 Cr)
//  W101 four quarters differ from the FY figure by more than 2%
//  W102 cash and bank ≤ total current assets ≤ total assets is violated
//  W103 shareholding total above 100.5
//  W104 negative revenue, inventories, receivables or capex
//  W105 unit sniffing (import/units.ts)
//  W106 statement basis changes within one company (raised while joining CSV files)
//  W107 fiscal_year and period_end disagree
//  W108 a gap year (info)
//  W109 a lender with industrial fields (info)
//  W110 ISIN format
//  I001 company type will be inferred (info)
import type {
  AnnualField, AnnualRow, CompanyRecord, FundamentalsDataset, QuarterField, QuarterRow, ValidationIssue, ValidationReport,
} from "@/lib/contracts";
import {
  ANNUAL_FIELD_INFO, ANNUAL_FIELDS, QUARTER_FIELDS, QUARTER_MATCH_TOLERANCE_DAYS, SHAREHOLDING_FIELDS,
} from "@/lib/contracts";
import { addMonths, daysBetween, fiscalYearOf, fyLabel, parseIsoDate } from "@/lib/time/civil";
import { fiscalYearEnd, makeIssue } from "./normalize";
import { sniffUnits } from "./import/units";

export const ISIN_PATTERN = /^IN[A-Z0-9]{9}[0-9]$/;

/** Tolerances, exported for tests and the data-format guide. */
export const TOLERANCE = {
  /** W100: relative and absolute (₹ Cr) tolerance for pbt − tax = net profit. */
  pnlRelative: 0.01,
  pnlAbsolute: 1,
  /** W101: relative tolerance for the sum of four quarters against the FY figure. */
  quarterRelative: 0.02,
  /** W102: rounding allowance (₹ Cr) for the balance-sheet ordering. */
  balanceAbsolute: 0.01,
  /** W103: largest acceptable shareholding total. */
  shareholdingTotal: 100.5,
} as const;

const NON_FINANCIAL_ONLY: readonly AnnualField[] = ANNUAL_FIELDS.filter((f) => ANNUAL_FIELD_INFO[f].appliesTo === "non_financial");

function w(code: string, c: CompanyRecord, message: string, extra: Partial<ValidationIssue> = {}): ValidationIssue {
  return makeIssue("warning", code, `${c.symbol}: ${message}`, { symbol: c.symbol, ...extra });
}

function info(code: string, c: CompanyRecord, message: string, extra: Partial<ValidationIssue> = {}): ValidationIssue {
  return makeIssue("info", code, `${c.symbol}: ${message}`, { symbol: c.symbol, ...extra });
}

function fmt(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/** The four quarters that make up a fiscal year, matched by date (± 15 days); null if any is missing. */
export function quartersOfYear(c: CompanyRecord, r: AnnualRow): QuarterRow[] | null {
  const end = r.period_end ?? fiscalYearEnd(r.fiscal_year, c.fy_end_month);
  const out: QuarterRow[] = [];
  for (let k = 0; k < 4; k++) {
    const target = addMonths(end, -3 * k);
    if (!target) return null;
    let best: QuarterRow | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const q of c.quarterly) {
      const gap = daysBetween(target, q.period_end);
      if (gap === null) continue;
      const g = Math.abs(gap);
      if (g <= QUARTER_MATCH_TOLERANCE_DAYS && g < bestGap) {
        best = q;
        bestGap = g;
      }
    }
    if (!best) return null;
    out.push(best);
  }
  return out;
}

/** Content checks for one company (everything except W105 dataset-level sniffing and W106). */
export function validateCompany(c: CompanyRecord): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const isLender = c.company_type === "bank" || c.company_type === "nbfc";

  if (c.company_type === null) {
    out.push(info("I001_TYPE_INFERRED", c, `company type was not supplied, so it will be inferred from the sector "${c.sector}".`, { field: "company_type" }));
  }
  if (c.isin !== null && !ISIN_PATTERN.test(c.isin)) {
    out.push(w("W110_ISIN_FORMAT", c, `ISIN "${c.isin}" does not match the usual format (IN followed by 9 letters or digits and a check digit). It is kept for display only.`, { field: "isin" }));
  }

  // Gap years (W108)
  for (let k = 1; k < c.annual.length; k++) {
    for (let y = c.annual[k - 1].fiscal_year + 1; y < c.annual[k].fiscal_year; y++) {
      out.push(info("W108_GAP_YEAR", c, `${fyLabel(y)} is missing between ${fyLabel(c.annual[k - 1].fiscal_year)} and ${fyLabel(c.annual[k].fiscal_year)}. Growth across the gap is not calculated.`, { period: fyLabel(y) }));
    }
  }

  let industrialFieldsOnLender: string[] = [];
  for (const r of c.annual) {
    const period = fyLabel(r.fiscal_year);

    // W100: pbt − tax = net profit
    if (r.pbt !== null && r.tax_expense !== null && r.net_profit !== null) {
      const diff = Math.abs(r.pbt - r.tax_expense - r.net_profit);
      const tol = Math.max(TOLERANCE.pnlRelative * Math.abs(r.net_profit), TOLERANCE.pnlAbsolute);
      if (diff > tol) {
        out.push(w("W100_PNL_IDENTITY", c, `in ${period}, profit before tax (${fmt(r.pbt)}) minus tax (${fmt(r.tax_expense)}) differs from net profit (${fmt(r.net_profit)}) by ₹${fmt(diff)} Cr.`, { period, field: "net_profit" }));
      }
    }

    // W101: four quarters against the FY figure
    const quarters = c.quarterly.length >= 4 ? quartersOfYear(c, r) : null;
    if (quarters) {
      const bad: string[] = [];
      for (const f of QUARTER_FIELDS) {
        const fyValue = r[f as QuarterField & AnnualField];
        if (fyValue === null) continue;
        const values = quarters.map((q) => q[f]);
        if (values.some((v) => v === null)) continue;
        const sum = (values as number[]).reduce((a, b) => a + b, 0);
        const tol = Math.max(TOLERANCE.quarterRelative * Math.abs(fyValue), 0.01);
        if (Math.abs(sum - fyValue) > tol) bad.push(`${f} (quarters ${fmt(sum)}, year ${fmt(fyValue)})`);
      }
      if (bad.length) {
        out.push(w("W101_QUARTER_SUM", c, `in ${period}, the four quarters do not add up to the annual figure for ${bad.join("; ")}.`, { period, field: bad[0].split(" ")[0] }));
      }
    }

    // W102: cash ≤ TCA ≤ TA
    const cash = r.cash_and_bank;
    const tca = r.total_current_assets;
    const ta = r.total_assets;
    const eps = TOLERANCE.balanceAbsolute;
    if ((cash !== null && tca !== null && cash > tca + eps) || (tca !== null && ta !== null && tca > ta + eps) || (cash !== null && ta !== null && cash > ta + eps)) {
      out.push(w("W102_BALANCE_ORDER", c, `in ${period}, cash and bank ≤ total current assets ≤ total assets does not hold (${[cash, tca, ta].map((v) => (v === null ? "—" : fmt(v))).join(" / ")}).`, { period, field: "total_current_assets" }));
    }

    // W104: negative values that cannot be negative
    for (const f of ["revenue", "inventories", "trade_receivables", "capex"] as const) {
      const v = r[f];
      if (v !== null && v < 0) {
        out.push(w("W104_NEGATIVE", c, `${ANNUAL_FIELD_INFO[f].label.toLowerCase()} is negative (${fmt(v)}) in ${period}.${f === "capex" ? " Enter capital expenditure as a positive number." : ""}`, { period, field: f }));
      }
    }

    // W107: fiscal_year and period_end disagree
    if (r.period_end !== null) {
      const p = parseIsoDate(r.period_end);
      if (p) {
        const implied = fiscalYearOf(p.y, p.m, c.fy_end_month);
        if (implied !== r.fiscal_year) {
          out.push(w("W107_PERIOD_MISMATCH", c, `the row for ${period} has period end ${r.period_end}, which falls in ${fyLabel(implied)} for a year ending in month ${c.fy_end_month}.`, { period, field: "period_end" }));
        } else if (p.m !== c.fy_end_month && !r.flags.includes("transition")) {
          out.push(w("W107_PERIOD_MISMATCH", c, `the row for ${period} ends on ${r.period_end}, but the year-end month is ${c.fy_end_month}. Flag it as a transition year if the year end changed.`, { period, field: "period_end" }));
        }
      }
    }

    if (isLender) {
      const present = NON_FINANCIAL_ONLY.filter((f) => r[f] !== null);
      industrialFieldsOnLender = [...new Set([...industrialFieldsOnLender, ...present])];
    }
  }

  // W109: lender with industrial fields
  if (industrialFieldsOnLender.length) {
    out.push(info("W109_LENDER_FIELDS", c, `this lender has fields that apply to non-financial companies (${industrialFieldsOnLender.join(", ")}). They are kept but not used by lender metrics.`, { field: industrialFieldsOnLender[0] }));
  }

  // W104 for quarterly revenue
  for (const q of c.quarterly) {
    if (q.revenue !== null && q.revenue < 0) {
      out.push(w("W104_NEGATIVE", c, `quarterly revenue is negative (${fmt(q.revenue)}) for the quarter ending ${q.period_end}.`, { period: q.period_end, field: "revenue" }));
    }
  }

  // W103: shareholding total
  for (const s of c.shareholding) {
    const parts = [s.promoter_pct, s.fii_pct, s.dii_pct].filter((v): v is number => v !== null);
    const total = parts.reduce((a, b) => a + b, 0);
    if (total > TOLERANCE.shareholdingTotal) {
      out.push(w("W103_SHAREHOLDING_TOTAL", c, `promoter, FII and DII holdings add up to ${fmt(total)}% for ${s.period_end}, which is above 100%.`, { period: s.period_end, field: "promoter_pct" }));
    }
  }
  return out;
}

/** Every content check for a dataset, including unit sniffing. */
export function validateDataset(ds: FundamentalsDataset): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const inferred: ValidationIssue[] = [];
  for (const c of ds.companies) {
    for (const i of validateCompany(c)) (i.code === "I001_TYPE_INFERRED" ? inferred : out).push(i);
  }
  // One line for many companies keeps the report readable; the data-health panel lists it per company.
  if (inferred.length <= 3) out.push(...inferred);
  else {
    const symbols = inferred.map((i) => i.symbol ?? "");
    out.push(makeIssue("info", "I001_TYPE_INFERRED",
      `Company type was not supplied for ${symbols.length} companies (${symbols.slice(0, 5).join(", ")}${symbols.length > 5 ? ", …" : ""}); it will be inferred from each sector.`,
      { field: "company_type" }));
  }
  out.push(...sniffUnits(ds));
  return out;
}

/** Field → share (0–1) of company-years (or company-quarters) where the field is present. */
export function computeCoverage(ds: FundamentalsDataset): Record<string, number> {
  const coverage: Record<string, number> = {};
  const annual = ds.companies.flatMap((c) => c.annual);
  if (annual.length) {
    for (const f of ANNUAL_FIELDS) coverage[f] = annual.filter((r) => r[f] !== null).length / annual.length;
  }
  const quarters = ds.companies.flatMap((c) => c.quarterly);
  if (quarters.length) {
    for (const f of QUARTER_FIELDS) coverage[`quarterly.${f}`] = quarters.filter((r) => r[f] !== null).length / quarters.length;
  }
  const holdings = ds.companies.flatMap((c) => c.shareholding);
  if (holdings.length) {
    for (const f of SHAREHOLDING_FIELDS) coverage[`shareholding.${f}`] = holdings.filter((r) => r[f] !== null).length / holdings.length;
  }
  return coverage;
}

const LEVEL_ORDER: Readonly<Record<ValidationIssue["level"], number>> = { error: 0, warning: 1, info: 2 };

/** Errors first, then warnings, then information; stable within a level. */
export function sortIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return issues.map((i, k) => ({ i, k })).sort((a, b) => LEVEL_ORDER[a.i.level] - LEVEL_ORDER[b.i.level] || a.k - b.k).map((x) => x.i);
}

export function buildReport(ds: FundamentalsDataset | null, issues: readonly ValidationIssue[], companiesRejected: number): ValidationReport {
  const sorted = sortIssues(issues);
  const report: ValidationReport = {
    ok: !sorted.some((i) => i.level === "error"),
    issues: sorted,
    companies: ds?.companies.length ?? 0,
    companiesRejected,
    annualRows: 0,
    quarterRows: 0,
    shareholdingRows: 0,
    coverage: ds ? computeCoverage(ds) : {},
  };
  if (ds) {
    for (const c of ds.companies) {
      report.annualRows += c.annual.length;
      report.quarterRows += c.quarterly.length;
      report.shareholdingRows += c.shareholding.length;
    }
  }
  return report;
}
