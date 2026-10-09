// src/test/fixtures/metrics/golden-company.ts — the golden companies (WS3, FICTIONAL).
//
// GOLDMFG "Goldmere Components Ltd" is an invented manufacturer with every non-financial field,
// six financial years (FY2021–FY2026), nine quarters and thirteen shareholding quarters.
// GOLDBNK "Goldmere Lending Bank Ltd" is an invented bank with three years, for lender metrics.
// The figures are round numbers chosen so that every metric can be checked by hand; they hold
// together as accounts (pbt − tax = net profit; the four quarters of each FY sum to the FY).
//
// GOLDEN_EXPECTATIONS lists every expected value as the arithmetic a reviewer checks by hand.
// The test evaluates that text with evaluateArithmetic(), so golden-company.md (generated from
// this table) shows exactly what is compared. Fiscal-year labels are illustrative only.
import type {
  AnnualField, AnnualRow, CompanyRecord, FundamentalsDataset, MetricId, NullReason, PeriodSel, QuarterRow, ShareholdingRow,
} from "@/lib/contracts";
import { ANNUAL_FIELDS, DATASET_SCHEMA, DATASET_VERSION, VF } from "@/lib/contracts";

// ── GOLDMFG raw figures, FY2021 … FY2026 (₹ crore; shares in crore) ─────────
const MFG_YEARS = [2021, 2022, 2023, 2024, 2025, 2026] as const;
const MFG: Partial<Record<AnnualField, readonly number[]>> = {
  revenue: [1000, 1100, 1200, 1300, 1500, 1600],
  operating_expenses: [850, 924, 1008, 1092, 1260, 1328],
  cogs: [600, 660, 720, 780, 900, 928],
  other_income: [10, 10, 12, 12, 15, 16],
  depreciation: [40, 42, 44, 46, 50, 54],
  finance_cost: [20, 20, 22, 22, 24, 24],
  exceptional_items: [0, 0, 0, 0, 0, 0],
  pbt: [100, 124, 138, 152, 181, 210],
  tax_expense: [25, 31, 34.5, 38, 45.25, 52.5],
  net_profit: [75, 93, 103.5, 114, 135.75, 157.5],
  net_profit_owners: [72, 90, 100, 110, 131, 152],
  dividend_per_share: [2, 2, 2.5, 3, 3.5, 4],
  equity_share_capital: [100, 100, 100, 100, 100, 100],
  other_equity: [500, 570, 645, 725, 821, 933],
  non_controlling_interest: [20, 23, 26.5, 30.5, 35.25, 40.75],
  borrowings_non_current: [200, 220, 240, 220, 200, 180],
  borrowings_current: [50, 60, 60, 70, 60, 60],
  lease_liabilities: [30, 30, 30, 30, 30, 30],
  trade_payables: [80, 88, 96, 104, 120, 116],
  total_current_liabilities: [180, 200, 210, 230, 250, 250],
  total_assets: [1100, 1200, 1300, 1400, 1500, 1600],
  net_fixed_assets: [500, 540, 580, 620, 660, 700],
  inventories: [120, 130, 140, 150, 160, 170],
  trade_receivables: [150, 160, 170, 180, 200, 220],
  cash_and_bank: [60, 70, 80, 90, 100, 120],
  current_investments: [20, 20, 30, 30, 40, 40],
  total_current_assets: [400, 440, 480, 520, 580, 640],
  shares_outstanding_ye: [10, 10, 10, 10, 10, 10],
  cfo: [110, 120, 140, 150, 170, 200],
  capex: [60, 80, 85, 90, 90, 100],
  equity_issuance: [0, 0, 0, 0, 0, 0],
};

// ── GOLDBNK raw figures, FY2024 … FY2026 ──────────────────────────────────
const BNK_YEARS = [2024, 2025, 2026] as const;
const BNK: Partial<Record<AnnualField, readonly number[]>> = {
  revenue: [800, 900, 1000],
  interest_expended: [450, 500, 550],
  other_income: [50, 60, 70],
  operating_expenses: [180, 200, 220],
  depreciation: [10, 10, 10],
  provisions_contingencies: [60, 70, 80],
  exceptional_items: [0, 0, 0],
  pbt: [150, 180, 210],
  tax_expense: [37.5, 45, 52.5],
  net_profit: [112.5, 135, 157.5],
  net_profit_owners: [112.5, 135, 157.5],
  dividend_per_share: [1, 1.2, 1.5],
  equity_share_capital: [100, 100, 100],
  other_equity: [900, 1000, 1100],
  non_controlling_interest: [0, 0, 0],
  borrowings_non_current: [500, 600, 700],
  total_assets: [10000, 11000, 12000],
  cash_and_bank: [500, 550, 600],
  shares_outstanding_ye: [50, 50, 50],
  advances: [7000, 8000, 9000],
  gross_npa: [280, 300, 270],
  net_npa: [100, 110, 90],
  cfo: [300, 200, 400],
  equity_issuance: [0, 0, 0],
};

function annualRows(years: readonly number[], data: Partial<Record<AnnualField, readonly number[]>>): AnnualRow[] {
  return years.map((year, j) => {
    const row = { fiscal_year: year, period_end: `${year}-03-31`, flags: [] } as unknown as AnnualRow;
    for (const f of ANNUAL_FIELDS) row[f] = data[f]?.[j] ?? null;
    return row;
  });
}

function q(period_end: string, revenue: number, operating_expenses: number, depreciation: number, net_profit: number, net_profit_owners: number): QuarterRow {
  return { period_end, revenue, operating_expenses, depreciation, net_profit, net_profit_owners };
}

function sh(period_end: string, promoter_pct: number, promoter_pledged_pct: number, fii_pct: number, dii_pct: number, num_shareholders: number): ShareholdingRow {
  return { period_end, promoter_pct, promoter_pledged_pct, fii_pct, dii_pct, num_shareholders };
}

/** Quarters Jun 2024 … Jun 2026: FY2025 = Jun 24 … Mar 25, FY2026 = Jun 25 … Mar 26, then Q1 FY27. */
const MFG_QUARTERS: QuarterRow[] = [
  q("2024-06-30", 360, 303, 12, 32, 31),
  q("2024-09-30", 370, 311, 12.5, 33.5, 32.25),
  q("2024-12-31", 380, 319, 12.5, 34.25, 33),
  q("2025-03-31", 390, 327, 13, 36, 34.75),
  q("2025-06-30", 380, 316, 13, 37, 35.75),
  q("2025-09-30", 395, 328, 13.5, 38.5, 37.25),
  q("2025-12-31", 405, 336, 13.5, 40, 38.5),
  q("2026-03-31", 420, 348, 14, 42, 40.5),
  q("2026-06-30", 440, 364, 14.5, 44, 42.5),
];

const MFG_SHAREHOLDING: ShareholdingRow[] = [
  sh("2023-06-30", 62, 0, 10, 8, 40000),
  sh("2023-09-30", 62, 0, 10.2, 8.1, 41000),
  sh("2023-12-31", 62, 0, 10.4, 8.2, 42000),
  sh("2024-03-31", 61.5, 0, 10.6, 8.3, 43000),
  sh("2024-06-30", 61.5, 0, 10.8, 8.4, 44000),
  sh("2024-09-30", 61.5, 0, 11, 8.5, 45000),
  sh("2024-12-31", 61, 0, 11.2, 8.6, 46000),
  sh("2025-03-31", 61, 2, 11.4, 8.7, 47000),
  sh("2025-06-30", 61, 2, 11.6, 8.8, 48000),
  sh("2025-09-30", 60.5, 3, 11.8, 8.9, 49000),
  sh("2025-12-31", 60.5, 3, 12, 9, 50000),
  sh("2026-03-31", 60, 4, 12.2, 9.1, 51000),
  sh("2026-06-30", 60, 5, 12.4, 9.2, 52000),
];

function record(c: Pick<CompanyRecord, "symbol" | "name" | "sector" | "industry" | "company_type" | "market" | "annual" | "quarterly" | "shareholding">): CompanyRecord {
  return {
    ...c, isin: null, statement_basis: "consolidated", fy_end_month: 3, snapshot: {},
    sample_note: "Golden test company: invented round figures for checking every formula by hand.", source_note: null,
  };
}

export function goldenCompanies(): CompanyRecord[] {
  return [
    record({
      symbol: "GOLDMFG", name: "Goldmere Components Ltd", sector: "Capital goods", industry: "Industrial components",
      company_type: "non_financial",
      market: { price: 300, price_date: null, shares_outstanding: 10, face_value: 10, market_cap_supplied: null },
      annual: annualRows(MFG_YEARS, MFG), quarterly: MFG_QUARTERS, shareholding: MFG_SHAREHOLDING,
    }),
    record({
      symbol: "GOLDBNK", name: "Goldmere Lending Bank Ltd", sector: "Banks", industry: "Private sector bank",
      company_type: "bank",
      market: { price: 60, price_date: null, shares_outstanding: 50, face_value: 2, market_cap_supplied: null },
      annual: annualRows(BNK_YEARS, BNK), quarterly: [], shareholding: [],
    }),
  ];
}

export function goldenDataset(extra: readonly CompanyRecord[] = []): FundamentalsDataset {
  return {
    schema: DATASET_SCHEMA,
    version: DATASET_VERSION,
    meta: {
      name: "Golden companies (fictional)", source: "synthetic_sample", isSynthetic: true, asOf: null, importedAt: null,
      currency: "INR", moneyUnit: "crore", sharesUnit: "crore", files: [], generator: null,
      notes: ["Hand-checked test figures. Both companies are fictional and describe no real business."],
    },
    companies: [...goldenCompanies(), ...extra],
  };
}

// ── Expectations ─────────────────────────────────────────────────────────────
export interface GoldenExpectation {
  symbol: "GOLDMFG" | "GOLDBNK";
  id: MetricId;
  /** Period selector; the default column when absent. */
  sel?: PeriodSel;
  /** The arithmetic from the raw figures above (or from the building blocks table). */
  arithmetic?: string;
  /** Expected null reason when the value is null. */
  reason?: NullReason;
  /** Flags that must be set. */
  flags?: number;
  note?: string;
}

const fy = (offset: number): PeriodSel => ({ freq: "fy", offset });
const qq = (offset: number): PeriodSel => ({ freq: "q", offset });
const ttm = (offset: number): PeriodSel => ({ freq: "ttm", offset });

/**
 * Building blocks per year (each is also a metric, checked at its FY slot). FY26 = slot 0.
 * total equity = net worth + NCI; capital employed = total equity + total debt.
 */
export const GOLDEN_BLOCKS: readonly GoldenExpectation[] = [
  // ebitda = revenue − operating_expenses
  ...([[0, "1600 - 1328"], [1, "1500 - 1260"], [2, "1300 - 1092"], [3, "1200 - 1008"], [4, "1100 - 924"], [5, "1000 - 850"]] as const)
    .map(([k, a]): GoldenExpectation => ({ symbol: "GOLDMFG", id: "ebitda", sel: fy(k), arithmetic: a })),
  // ebit = ebitda + other income − depreciation
  ...([[0, "272 + 16 - 54"], [1, "240 + 15 - 50"], [2, "208 + 12 - 46"], [3, "192 + 12 - 44"], [4, "176 + 10 - 42"], [5, "150 + 10 - 40"]] as const)
    .map(([k, a]): GoldenExpectation => ({ symbol: "GOLDMFG", id: "ebit", sel: fy(k), arithmetic: a })),
  // net worth = equity share capital + other equity
  ...([[0, "100 + 933"], [1, "100 + 821"], [2, "100 + 725"], [3, "100 + 645"], [4, "100 + 570"], [5, "100 + 500"]] as const)
    .map(([k, a]): GoldenExpectation => ({ symbol: "GOLDMFG", id: "net_worth", sel: fy(k), arithmetic: a })),
  // total debt = non-current + current borrowings + leases
  ...([[0, "180 + 60 + 30"], [1, "200 + 60 + 30"], [2, "220 + 70 + 30"], [3, "240 + 60 + 30"], [4, "220 + 60 + 30"], [5, "200 + 50 + 30"]] as const)
    .map(([k, a]): GoldenExpectation => ({ symbol: "GOLDMFG", id: "total_debt", sel: fy(k), arithmetic: a })),
  // capital employed = net worth + NCI + total debt
  ...([[0, "1033 + 40.75 + 270"], [1, "921 + 35.25 + 290"], [2, "825 + 30.5 + 320"], [3, "745 + 26.5 + 330"], [4, "670 + 23 + 310"], [5, "600 + 20 + 280"]] as const)
    .map(([k, a]): GoldenExpectation => ({ symbol: "GOLDMFG", id: "capital_employed", sel: fy(k), arithmetic: a })),
  // net debt = total debt − (cash and bank + current investments)
  ...([[0, "270 - (120 + 40)"], [1, "290 - (100 + 40)"], [2, "320 - (90 + 30)"], [3, "330 - (80 + 30)"], [4, "310 - (70 + 20)"], [5, "280 - (60 + 20)"]] as const)
    .map(([k, a]): GoldenExpectation => ({ symbol: "GOLDMFG", id: "net_debt", sel: fy(k), arithmetic: a })),
  // ROCE per year = ebit / avg(capital employed) × 100 (FY21 uses its closing balance)
  { symbol: "GOLDMFG", id: "roce", sel: fy(0), arithmetic: "234 / ((1343.75 + 1246.25) / 2) * 100" },
  { symbol: "GOLDMFG", id: "roce", sel: fy(1), arithmetic: "205 / ((1246.25 + 1175.5) / 2) * 100" },
  { symbol: "GOLDMFG", id: "roce", sel: fy(2), arithmetic: "174 / ((1175.5 + 1101.5) / 2) * 100" },
  { symbol: "GOLDMFG", id: "roce", sel: fy(3), arithmetic: "160 / ((1101.5 + 1003) / 2) * 100" },
  { symbol: "GOLDMFG", id: "roce", sel: fy(4), arithmetic: "144 / ((1003 + 900) / 2) * 100" },
  { symbol: "GOLDMFG", id: "roce", sel: fy(5), arithmetic: "120 / 900 * 100", flags: VF.ClosingBasis, note: "first year: closing capital employed" },
  // EPS per year = owners' profit / shares
  ...([[0, "152 / 10"], [1, "131 / 10"], [2, "110 / 10"], [3, "100 / 10"], [4, "90 / 10"], [5, "72 / 10"]] as const)
    .map(([k, a]): GoldenExpectation => ({ symbol: "GOLDMFG", id: "eps", sel: fy(k), arithmetic: a })),
  // dividend payout per year = dps × shares / owners' profit × 100
  { symbol: "GOLDMFG", id: "dividend_payout", sel: fy(0), arithmetic: "4 * 10 / 152 * 100" },
  { symbol: "GOLDMFG", id: "dividend_payout", sel: fy(1), arithmetic: "3.5 * 10 / 131 * 100" },
  { symbol: "GOLDMFG", id: "dividend_payout", sel: fy(2), arithmetic: "3 * 10 / 110 * 100" },
  // OPM per year
  ...([[0, "272 / 1600 * 100"], [1, "240 / 1500 * 100"], [2, "208 / 1300 * 100"], [3, "192 / 1200 * 100"], [4, "176 / 1100 * 100"]] as const)
    .map(([k, a]): GoldenExpectation => ({ symbol: "GOLDMFG", id: "opm", sel: fy(k), arithmetic: a })),
  // TTM blocks: block 0 = Sep 25 … Jun 26, block 1 = Sep 24 … Jun 25
  { symbol: "GOLDMFG", id: "sales", sel: ttm(0), arithmetic: "440 + 420 + 405 + 395" },
  { symbol: "GOLDMFG", id: "sales", sel: ttm(1), arithmetic: "380 + 390 + 380 + 370" },
  { symbol: "GOLDMFG", id: "net_profit", sel: ttm(0), arithmetic: "42.5 + 40.5 + 38.5 + 37.25" },
  { symbol: "GOLDMFG", id: "net_profit", sel: ttm(1), arithmetic: "35.75 + 34.75 + 33 + 32.25" },
  { symbol: "GOLDMFG", id: "ebitda", sel: ttm(0), arithmetic: "(440 - 364) + (420 - 348) + (405 - 336) + (395 - 328)" },
  { symbol: "GOLDMFG", id: "sales", sel: ttm(2), reason: "insufficient_history", note: "only 9 quarters" },
];

export const GOLDEN_EXPECTATIONS: readonly GoldenExpectation[] = [
  // ── Size ──
  { symbol: "GOLDMFG", id: "market_cap", arithmetic: "300 * 10" },
  { symbol: "GOLDMFG", id: "price", arithmetic: "300" },
  { symbol: "GOLDMFG", id: "enterprise_value", arithmetic: "3000 + 270 + 40.75 - (120 + 40)" },
  { symbol: "GOLDMFG", id: "sales", arithmetic: "1600" },
  { symbol: "GOLDMFG", id: "ebitda", arithmetic: "1600 - 1328" },
  { symbol: "GOLDMFG", id: "ebit", arithmetic: "1600 - 1328 + 16 - 54" },
  { symbol: "GOLDMFG", id: "net_profit", arithmetic: "152", note: "owners' share" },
  { symbol: "GOLDMFG", id: "net_worth", arithmetic: "100 + 933" },
  { symbol: "GOLDMFG", id: "total_debt", arithmetic: "180 + 60 + 30" },
  { symbol: "GOLDMFG", id: "net_debt", arithmetic: "180 + 60 + 30 - (120 + 40)" },
  { symbol: "GOLDMFG", id: "capital_employed", arithmetic: "100 + 933 + 40.75 + 270" },
  // ── Valuation (TTM = Sep 25 … Jun 26) ──
  { symbol: "GOLDMFG", id: "pe", arithmetic: "3000 / (42.5 + 40.5 + 38.5 + 37.25)" },
  { symbol: "GOLDMFG", id: "pb", arithmetic: "3000 / 1033" },
  { symbol: "GOLDMFG", id: "price_to_sales", arithmetic: "3000 / 1660" },
  { symbol: "GOLDMFG", id: "ev_ebitda", arithmetic: "3150.75 / 284" },
  { symbol: "GOLDMFG", id: "earnings_yield", arithmetic: "(1660 - 1376 - (14.5 + 14 + 13.5 + 13.5)) / 3150.75 * 100" },
  { symbol: "GOLDMFG", id: "earnings_to_price", arithmetic: "158.75 / 3000 * 100" },
  { symbol: "GOLDMFG", id: "fcf_yield", arithmetic: "(200 - 100) / 3000 * 100" },
  { symbol: "GOLDMFG", id: "fcf_yield_3y", arithmetic: "((200 - 100) + (170 - 90) + (150 - 90)) / 3 / 3000 * 100" },
  { symbol: "GOLDMFG", id: "peg", arithmetic: "(3000 / 158.75) / (((15.2 / 10) ^ (1 / 3) - 1) * 100)", note: "EPS CAGR FY23→FY26" },
  { symbol: "GOLDMFG", id: "price_to_graham", arithmetic: "300 / sqrt(22.5 * (158.75 / 10) * (1033 / 10))" },
  // ── Profitability ──
  { symbol: "GOLDMFG", id: "roce", arithmetic: "234 / ((1343.75 + 1246.25) / 2) * 100" },
  { symbol: "GOLDMFG", id: "roic", arithmetic: "(272 - 54) * (1 - 52.5 / 210) / (((1343.75 - 160) + (1246.25 - 140)) / 2) * 100" },
  { symbol: "GOLDMFG", id: "roe", arithmetic: "152 / ((1033 + 921) / 2) * 100" },
  { symbol: "GOLDMFG", id: "roa", arithmetic: "157.5 / ((1600 + 1500) / 2) * 100" },
  { symbol: "GOLDMFG", id: "opm", arithmetic: "272 / 1600 * 100" },
  { symbol: "GOLDMFG", id: "gross_margin", arithmetic: "(1600 - 928) / 1600 * 100" },
  { symbol: "GOLDMFG", id: "npm", arithmetic: "157.5 / 1600 * 100" },
  { symbol: "GOLDMFG", id: "effective_tax_rate", arithmetic: "52.5 / 210 * 100" },
  { symbol: "GOLDMFG", id: "other_income_to_pbt", arithmetic: "16 / 210 * 100" },
  // ── Efficiency ──
  { symbol: "GOLDMFG", id: "asset_turnover", arithmetic: "1600 / ((1600 + 1500) / 2)" },
  { symbol: "GOLDMFG", id: "fixed_asset_turnover", arithmetic: "1600 / ((700 + 660) / 2)" },
  { symbol: "GOLDMFG", id: "debtor_days", arithmetic: "220 / 1600 * 365" },
  { symbol: "GOLDMFG", id: "inventory_days", arithmetic: "170 / 928 * 365" },
  { symbol: "GOLDMFG", id: "payable_days", arithmetic: "116 / 928 * 365" },
  { symbol: "GOLDMFG", id: "cash_conversion_cycle", arithmetic: "220 / 1600 * 365 + 170 / 928 * 365 - 116 / 928 * 365" },
  { symbol: "GOLDMFG", id: "working_capital_days", arithmetic: "((640 - (120 + 40)) - (250 - 60)) / 1600 * 365" },
  // ── Leverage & Liquidity ──
  { symbol: "GOLDMFG", id: "debt_equity", arithmetic: "270 / (1033 + 40.75)" },
  { symbol: "GOLDMFG", id: "debt_equity_ex_leases", arithmetic: "(180 + 60) / (1033 + 40.75)" },
  { symbol: "GOLDMFG", id: "net_debt_equity", arithmetic: "110 / 1073.75" },
  { symbol: "GOLDMFG", id: "debt_ebitda", arithmetic: "270 / 272" },
  { symbol: "GOLDMFG", id: "net_debt_ebitda", arithmetic: "110 / 272" },
  { symbol: "GOLDMFG", id: "interest_coverage", arithmetic: "234 / 24" },
  { symbol: "GOLDMFG", id: "current_ratio", arithmetic: "640 / 250" },
  { symbol: "GOLDMFG", id: "quick_ratio", arithmetic: "(640 - 170) / 250" },
  { symbol: "GOLDMFG", id: "equity_multiplier", arithmetic: "((1600 + 1500) / 2) / ((1073.75 + 956.25) / 2)" },
  // ── Growth ──
  { symbol: "GOLDMFG", id: "sales_growth", arithmetic: "(1600 / 1500 - 1) * 100" },
  { symbol: "GOLDMFG", id: "profit_growth", arithmetic: "(152 / 131 - 1) * 100" },
  { symbol: "GOLDMFG", id: "ttm_sales_growth", arithmetic: "(1660 / 1520 - 1) * 100" },
  { symbol: "GOLDMFG", id: "ttm_profit_growth", arithmetic: "(158.75 / 135.75 - 1) * 100" },
  { symbol: "GOLDMFG", id: "q_sales_yoy", arithmetic: "(440 / 380 - 1) * 100", note: "Jun 26 against Jun 25" },
  { symbol: "GOLDMFG", id: "q_profit_yoy", arithmetic: "(42.5 / 35.75 - 1) * 100" },
  { symbol: "GOLDMFG", id: "q_opm_change_yoy", arithmetic: "(440 - 364) / 440 * 100 - (380 - 316) / 380 * 100" },
  // ── Quarterly results ──
  { symbol: "GOLDMFG", id: "q_sales", arithmetic: "440" },
  { symbol: "GOLDMFG", id: "q_operating_profit", arithmetic: "440 - 364" },
  { symbol: "GOLDMFG", id: "q_opm", arithmetic: "(440 - 364) / 440 * 100" },
  { symbol: "GOLDMFG", id: "q_net_profit", arithmetic: "42.5" },
  { symbol: "GOLDMFG", id: "q_sales", sel: qq(4), arithmetic: "380", note: "Q1 FY26 (Jun 25)" },
  // ── Cash Flow ──
  { symbol: "GOLDMFG", id: "cfo", arithmetic: "200" },
  { symbol: "GOLDMFG", id: "capex", arithmetic: "100" },
  { symbol: "GOLDMFG", id: "fcf", arithmetic: "200 - 100" },
  { symbol: "GOLDMFG", id: "cfo_to_pat", arithmetic: "200 / 157.5" },
  { symbol: "GOLDMFG", id: "cum_cfo_to_pat_5y", arithmetic: "(120 + 140 + 150 + 170 + 200) / (93 + 103.5 + 114 + 135.75 + 157.5)" },
  { symbol: "GOLDMFG", id: "cfo_to_ebitda", arithmetic: "200 / 272 * 100" },
  { symbol: "GOLDMFG", id: "capex_to_sales", arithmetic: "100 / 1600 * 100" },
  { symbol: "GOLDMFG", id: "capex_to_depreciation", arithmetic: "100 / 54" },
  { symbol: "GOLDMFG", id: "accruals_ratio", arithmetic: "(157.5 - 200) / ((1600 + 1500) / 2) * 100" },
  // ── Shareholding (Jun 26) ──
  { symbol: "GOLDMFG", id: "promoter_holding", arithmetic: "60" },
  { symbol: "GOLDMFG", id: "pledged_pct", arithmetic: "5" },
  { symbol: "GOLDMFG", id: "pledged_pct_of_total", arithmetic: "60 * 5 / 100" },
  { symbol: "GOLDMFG", id: "fii_holding", arithmetic: "12.4" },
  { symbol: "GOLDMFG", id: "dii_holding", arithmetic: "9.2" },
  { symbol: "GOLDMFG", id: "public_holding", arithmetic: "100 - 60 - 12.4 - 9.2" },
  { symbol: "GOLDMFG", id: "num_shareholders", arithmetic: "52000" },
  // ── Dividend and Per Share ──
  { symbol: "GOLDMFG", id: "dps", arithmetic: "4" },
  { symbol: "GOLDMFG", id: "dividend_yield", arithmetic: "4 / 300 * 100" },
  { symbol: "GOLDMFG", id: "dividend_payout", arithmetic: "4 * 10 / 152 * 100" },
  { symbol: "GOLDMFG", id: "dividend_streak", arithmetic: "6", flags: VF.LimitOfData, note: "every supplied year paid" },
  { symbol: "GOLDMFG", id: "eps", arithmetic: "152 / 10" },
  { symbol: "GOLDMFG", id: "bvps", arithmetic: "1033 / 10" },
  // ── Scores and Data ──
  { symbol: "GOLDMFG", id: "piotroski_f", arithmetic: "8", note: "all but F9 (asset turnover) met" },
  { symbol: "GOLDMFG", id: "altman_z", arithmetic: "6.56 * ((640 - 250) / 1600) + 3.26 * (933 / 1600) + 6.72 * (234 / 1600) + 1.05 * (1073.75 / (1600 - 1073.75))" },
  { symbol: "GOLDMFG", id: "latest_fy", arithmetic: "2026" },
  { symbol: "GOLDMFG", id: "years_of_history", arithmetic: "6" },
  { symbol: "GOLDMFG", id: "red_flag_count", reason: "missing_input", note: "served by the insights provider; none registered here" },
  // ── Variants ──
  { symbol: "GOLDMFG", id: "sales_prev", arithmetic: "1500" },
  { symbol: "GOLDMFG", id: "sales_ttm", arithmetic: "440 + 420 + 405 + 395" },
  { symbol: "GOLDMFG", id: "sales_cagr_3y", arithmetic: "((1600 / 1200) ^ (1 / 3) - 1) * 100" },
  { symbol: "GOLDMFG", id: "sales_cagr_5y", arithmetic: "((1600 / 1000) ^ (1 / 5) - 1) * 100" },
  { symbol: "GOLDMFG", id: "sales_cagr_10y", reason: "insufficient_history" },
  { symbol: "GOLDMFG", id: "net_profit_cagr_5y", arithmetic: "((152 / 72) ^ (1 / 5) - 1) * 100" },
  { symbol: "GOLDMFG", id: "net_profit_cum_5y", arithmetic: "90 + 100 + 110 + 131 + 152" },
  { symbol: "GOLDMFG", id: "net_profit_ttm", arithmetic: "158.75" },
  { symbol: "GOLDMFG", id: "eps_ttm", arithmetic: "158.75 / 10" },
  { symbol: "GOLDMFG", id: "eps_cagr_3y", arithmetic: "((15.2 / 10) ^ (1 / 3) - 1) * 100" },
  { symbol: "GOLDMFG", id: "opm_ttm", arithmetic: "284 / 1660 * 100" },
  { symbol: "GOLDMFG", id: "npm_ttm", arithmetic: "(44 + 42 + 40 + 38.5) / 1660 * 100" },
  { symbol: "GOLDMFG", id: "roce_prev", arithmetic: "205 / ((1246.25 + 1175.5) / 2) * 100" },
  {
    symbol: "GOLDMFG", id: "roce_avg_5y",
    arithmetic: "(234 / 1295 * 100 + 205 / 1210.875 * 100 + 174 / 1138.5 * 100 + 160 / 1052.25 * 100 + 144 / 951.5 * 100) / 5",
  },
  { symbol: "GOLDMFG", id: "roce_avg_3y", arithmetic: "(234 / 1295 * 100 + 205 / 1210.875 * 100 + 174 / 1138.5 * 100) / 3" },
  { symbol: "GOLDMFG", id: "roce_min_5y", arithmetic: "144 / 951.5 * 100", note: "FY22 is the lowest" },
  { symbol: "GOLDMFG", id: "roce_avg_10y", reason: "insufficient_history" },
  { symbol: "GOLDMFG", id: "opm_stdev_5y", arithmetic: "sqrt(((17 - 16.2) ^ 2 + 4 * (16 - 16.2) ^ 2) / 5)", note: "OPM 16, 16, 16, 16, 17" },
  { symbol: "GOLDMFG", id: "roe_prev", arithmetic: "131 / ((921 + 825) / 2) * 100" },
  { symbol: "GOLDMFG", id: "dividend_payout_avg_3y", arithmetic: "(4 * 10 / 152 * 100 + 3.5 * 10 / 131 * 100 + 3 * 10 / 110 * 100) / 3" },
  { symbol: "GOLDMFG", id: "dps_cagr_5y", arithmetic: "((4 / 2) ^ (1 / 5) - 1) * 100" },
  { symbol: "GOLDMFG", id: "cfo_cum_3y", arithmetic: "150 + 170 + 200" },
  { symbol: "GOLDMFG", id: "cfo_cum_5y", arithmetic: "120 + 140 + 150 + 170 + 200" },
  { symbol: "GOLDMFG", id: "fcf_cum_5y", arithmetic: "(120 - 80) + (140 - 85) + (150 - 90) + (170 - 90) + (200 - 100)" },
  { symbol: "GOLDMFG", id: "promoter_holding_chg_1q", arithmetic: "60 - 60" },
  { symbol: "GOLDMFG", id: "promoter_holding_chg_1y", arithmetic: "60 - 61" },
  { symbol: "GOLDMFG", id: "promoter_holding_chg_3y", arithmetic: "60 - 62" },
  { symbol: "GOLDMFG", id: "pledged_pct_chg_1y", arithmetic: "5 - 2" },
  { symbol: "GOLDMFG", id: "fii_holding_chg_3y", arithmetic: "12.4 - 10" },
  { symbol: "GOLDMFG", id: "q_sales_prev", arithmetic: "420" },
  // ── Lender (GOLDBNK, FY26; no quarters, so TTM falls back to FY) ──
  { symbol: "GOLDBNK", id: "nii", arithmetic: "1000 - 550" },
  { symbol: "GOLDBNK", id: "nim_approx", arithmetic: "450 / ((12000 + 11000) / 2) * 100", flags: VF.Approximate },
  { symbol: "GOLDBNK", id: "ppop", arithmetic: "450 + 70 - 220" },
  { symbol: "GOLDBNK", id: "cost_to_income", arithmetic: "220 / (450 + 70) * 100" },
  { symbol: "GOLDBNK", id: "credit_cost", arithmetic: "80 / ((9000 + 8000) / 2) * 100" },
  { symbol: "GOLDBNK", id: "gnpa_ratio", arithmetic: "270 / (9000 + 270 - 90) * 100" },
  { symbol: "GOLDBNK", id: "nnpa_ratio", arithmetic: "90 / 9000 * 100" },
  { symbol: "GOLDBNK", id: "provision_coverage", arithmetic: "(270 - 90) / 270 * 100" },
  { symbol: "GOLDBNK", id: "p_abv", arithmetic: "3000 / (1200 - 90)" },
  { symbol: "GOLDBNK", id: "nii_prev", arithmetic: "900 - 500" },
  { symbol: "GOLDBNK", id: "nii_cagr_3y", reason: "insufficient_history" },
  { symbol: "GOLDBNK", id: "roe", arithmetic: "157.5 / ((1200 + 1100) / 2) * 100" },
  { symbol: "GOLDBNK", id: "roa", arithmetic: "157.5 / ((12000 + 11000) / 2) * 100" },
  { symbol: "GOLDBNK", id: "pe", arithmetic: "3000 / 157.5", flags: VF.FyFallback, note: "no quarters: latest FY used" },
  { symbol: "GOLDBNK", id: "pb", arithmetic: "3000 / 1200" },
  { symbol: "GOLDBNK", id: "dividend_yield", arithmetic: "1.5 / 60 * 100" },
  { symbol: "GOLDBNK", id: "eps", arithmetic: "157.5 / 50" },
  { symbol: "GOLDBNK", id: "sales_growth", arithmetic: "(1000 / 900 - 1) * 100" },
  { symbol: "GOLDBNK", id: "roce", reason: "not_applicable_financial" },
  { symbol: "GOLDBNK", id: "debt_equity", reason: "not_applicable_financial" },
  { symbol: "GOLDBNK", id: "piotroski_f", reason: "not_applicable_financial" },
  { symbol: "GOLDBNK", id: "altman_z", reason: "not_applicable_financial" },
  { symbol: "GOLDBNK", id: "q_sales", reason: "insufficient_history", note: "no quarterly block" },
  { symbol: "GOLDBNK", id: "promoter_holding", reason: "insufficient_history", note: "no shareholding block" },
  { symbol: "GOLDMFG", id: "nii", reason: "not_applicable_financial" },
];
