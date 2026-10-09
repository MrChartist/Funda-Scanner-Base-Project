// src/lib/insights/checks/nonfin.ts — checks for non-financial companies, plus the shareholder-return
// checks that apply to every family (spec §C.9). Each rule is a visible FSQL expression; "met" is a pass.
// Thresholds are rules of thumb documented in docs/methodology.md §3, not standards.
import type { CheckRule, TypeFamily } from "@/lib/contracts";

export const NF: readonly TypeFamily[] = ["non_financial"];
export const ALL_FAMILIES: readonly TypeFamily[] = ["non_financial", "lender", "insurance"];

export const NONFIN_CHECKS: readonly CheckRule[] = [
  // ── Profitability ──────────────────────────────────────────────────────────
  {
    id: "PR-01", kind: "check", area: "profitability", appliesTo: NF,
    title: "Earns well on its capital",
    test: "ROCE averaged above 15% over the last 5 financial years",
    query: "roce_avg_5y > 15",
    evidence: ["roce_avg_5y", "roce"], section: "ratios", learn: ["roce"],
  },
  {
    id: "PR-02", kind: "check", area: "profitability", appliesTo: NF,
    title: "Return held up every year",
    test: "ROCE was above 12% in each of the last 5 financial years",
    query: "every(roce > 12, 5y)",
    evidence: ["roce", "roce_min_5y"], section: "ratios", learn: ["roce"],
  },
  {
    id: "PR-03", kind: "check", area: "profitability", appliesTo: NF,
    title: "Margin is steady",
    test: "The operating margin moved by less than 4 percentage points (standard deviation) over the last 5 financial years",
    query: "opm_stdev_5y < 4",
    evidence: ["opm_stdev_5y", "opm", "opm_avg_5y"], section: "ratios", learn: ["opm"],
  },
  {
    id: "PR-04", kind: "check", area: "profitability", appliesTo: NF,
    title: "Margin not falling",
    test: "The latest operating margin is at most 1 percentage point below its 5-year average",
    query: "opm >= opm_avg_5y - 1",
    evidence: ["opm", "opm_avg_5y"], section: "ratios", learn: ["opm"],
  },
  // ── Growth record ──────────────────────────────────────────────────────────
  {
    id: "GR-01", kind: "check", area: "growth", appliesTo: NF,
    title: "Sales compounding",
    test: "Sales grew by more than 10% a year (CAGR) over the last 5 financial years",
    query: "sales_cagr_5y > 10",
    evidence: ["sales_cagr_5y", "sales"], section: "pnl", learn: ["sales", "sales_growth"],
  },
  {
    id: "GR-02", kind: "check", area: "growth", appliesTo: NF,
    title: "Profit compounding",
    test: "Net profit grew by more than 10% a year (CAGR) over the last 5 financial years",
    query: "net_profit_cagr_5y > 10",
    evidence: ["net_profit_cagr_5y", "net_profit"], section: "pnl", learn: ["net_profit", "profit_growth"],
  },
  {
    id: "GR-03", kind: "check", area: "growth", appliesTo: NF,
    title: "Grew in most years",
    test: "Sales growth was above 0% in at least 4 of the last 5 financial years",
    query: "count(sales_growth > 0, 5y) >= 4",
    evidence: ["sales_growth", "sales_cagr_5y"], section: "pnl", learn: ["sales_growth"],
  },
  {
    id: "GR-04", kind: "check", area: "growth", appliesTo: NF,
    title: "Growth not diluted",
    test: "EPS growth (CAGR) over the last 5 financial years is at most 2 percentage points below net profit growth",
    query: "eps_cagr_5y >= net_profit_cagr_5y - 2",
    evidence: ["eps_cagr_5y", "net_profit_cagr_5y"], section: "pnl", learn: ["eps", "net_profit"],
  },
  // ── Balance-sheet strength ─────────────────────────────────────────────────
  {
    id: "BS-01", kind: "check", area: "balance_sheet", appliesTo: NF,
    title: "Modest borrowing",
    test: "Debt to equity is below 0.5x in the latest financial year",
    query: "debt_equity < 0.5",
    evidence: ["debt_equity", "total_debt", "net_worth"], section: "balance-sheet", learn: ["debt_equity"],
  },
  {
    id: "BS-02", kind: "check", area: "balance_sheet", appliesTo: NF,
    title: "Interest well covered",
    test: "Operating profit covers the interest cost more than 4 times in the latest financial year",
    query: "interest_coverage > 4",
    evidence: ["interest_coverage"], section: "pnl", learn: ["interest_coverage"],
  },
  {
    id: "BS-03", kind: "check", area: "balance_sheet", appliesTo: NF,
    title: "Short-term bills covered",
    test: "Current assets are more than 1.2 times current liabilities in the latest financial year",
    query: "current_ratio > 1.2",
    evidence: ["current_ratio"], section: "balance-sheet", learn: ["current_ratio"],
  },
  {
    id: "BS-04", kind: "check", area: "balance_sheet", appliesTo: NF,
    title: "Outside the distress zone",
    test: "The Altman Z'' score is above 2.6, the safe zone of that model",
    query: "altman_z > 2.6",
    evidence: ["altman_z"], section: "scores", learn: ["altman_z"],
  },
  // ── Cash conversion ────────────────────────────────────────────────────────
  {
    id: "CC-01", kind: "check", area: "cash_conversion", appliesTo: NF,
    title: "Profit backed by cash",
    test: "Operating cash flow over the last 5 financial years is more than 0.8 times net profit over the same years",
    query: "cum_cfo_to_pat_5y > 0.8",
    evidence: ["cum_cfo_to_pat_5y", "cfo", "net_profit"], section: "cash-flow", learn: ["cum_cfo_to_pat_5y", "cfo_to_pat"],
  },
  {
    id: "CC-02", kind: "check", area: "cash_conversion", appliesTo: NF,
    title: "Positive free cash in most years",
    test: "Free cash flow was above ₹0 in at least 3 of the last 5 financial years",
    query: "count(fcf > 0, 5y) >= 3",
    evidence: ["fcf", "cfo"], section: "cash-flow", learn: ["fcf"],
  },
  {
    id: "CC-03", kind: "check", area: "cash_conversion", appliesTo: NF,
    title: "Low accruals",
    test: "Profit not backed by operating cash is below 5% of average total assets (accruals ratio) in the latest financial year",
    query: "accruals_ratio < 5",
    evidence: ["accruals_ratio", "cfo", "net_profit"], section: "cash-flow", learn: ["accruals_ratio", "cfo_to_pat"],
  },
  {
    id: "CC-04", kind: "check", area: "cash_conversion", appliesTo: NF,
    title: "Collections not slowing",
    test: "Debtor days are at most 1.2 times their level 3 financial years earlier",
    query: "debtor_days <= 1.2 * debtor_days[fy-3]",
    evidence: ["debtor_days"], section: "ratios", learn: ["debtor_days"],
  },
  // ── Valuation vs peers ─────────────────────────────────────────────────────
  {
    id: "VA-01", kind: "check", area: "valuation", appliesTo: NF,
    title: "P/E below industry median",
    test: "The P/E is below the median P/E of its industry among the companies in your data",
    query: "pe < industry_median(pe)",
    evidence: ["pe"], section: "peers", learn: ["pe"],
  },
  {
    id: "VA-02", kind: "check", area: "valuation", appliesTo: NF,
    title: "Earnings yield above industry median",
    test: "The earnings yield (EBIT to EV) is above the median of its industry among the companies in your data",
    query: "earnings_yield > industry_median(earnings_yield)",
    evidence: ["earnings_yield"], section: "peers", learn: ["earnings_yield"],
  },
  {
    id: "VA-03", kind: "check", area: "valuation", appliesTo: NF,
    title: "Reasonable FCF yield",
    test: "The free cash flow yield, on 3-year average free cash flow, is above 3%",
    query: "fcf_yield_3y > 3",
    evidence: ["fcf_yield_3y", "fcf"], section: "peers", learn: ["fcf_yield_3y", "fcf_yield"],
  },
  // ── Shareholder returns (every family) ─────────────────────────────────────
  {
    id: "SR-01", kind: "check", area: "shareholder_returns", appliesTo: ALL_FAMILIES,
    title: "Dividend paid 5 years in a row",
    test: "A dividend was paid in each of at least the last 5 financial years",
    query: "dividend_streak >= 5",
    evidence: ["dividend_streak", "dps"], section: "dividends", learn: ["dividend_streak", "dps"],
  },
  {
    id: "SR-02", kind: "check", area: "shareholder_returns", appliesTo: ALL_FAMILIES,
    title: "Shares part of profit",
    test: "Dividends averaged at least 15% of profit (payout ratio) over the last 3 financial years",
    query: "dividend_payout_avg_3y >= 15",
    evidence: ["dividend_payout_avg_3y", "dividend_payout"], section: "dividends", learn: ["dividend_payout"],
  },
  {
    id: "SR-03", kind: "check", area: "shareholder_returns", appliesTo: ALL_FAMILIES,
    title: "Book value per share compounding",
    test: "Book value per share grew by more than 10% a year (CAGR) over the last 5 financial years",
    query: "bvps_cagr_5y > 10",
    evidence: ["bvps_cagr_5y", "bvps"], section: "ratios", learn: ["bvps"],
  },
];
