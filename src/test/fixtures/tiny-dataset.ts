// src/test/fixtures/tiny-dataset.ts — six FICTIONAL companies for unit tests (P0, frozen).
// Hand-checked, accounting-consistent figures in ₹ crore (shares in crore). Every company is
// invented and describes no real business. Fiscal-year labels are illustrative only.
//
//  TINYMFG  manufacturer with every non-financial field, 7 FYs, 9 quarters, 13 shareholding quarters
//  TINYSOFT IT services: no COGS, inventories 0, finance cost 0 (debt-free), owners' PAT not given,
//           one missing quarter (Sep 2025) so TTM falls back to FY
//  TINYBANK lender whose company_type is not supplied (inferred from sector "Banks")
//  TINYLOSS loss-making, negative net worth from FY2023, FY2024 flagged as a transition year
//  TINYSNAP snapshot-only (legacy StockRow values, no statements)
//  TINYNEW  new listing: FY2023, FY2025 and FY2026 with FY2024 missing (a gap year), standalone
//
// Identities that hold for every non-financial company-year (checked in contracts.smoke.test.ts):
//   pbt − tax_expense = net_profit; cash_and_bank ≤ total_current_assets ≤ total_assets;
//   equity_share_capital = shares_outstanding_ye × face value; quarters of a complete FY sum to it.
import type {
  AnnualRow, CompanyRecord, FundamentalsDataset, MarketInputs, PeriodFlag, QuarterRow, ShareholdingRow,
} from "@/lib/contracts";
import { ANNUAL_FIELDS, DATASET_SCHEMA, DATASET_VERSION } from "@/lib/contracts";

type AnnualValues = Partial<Omit<AnnualRow, "fiscal_year" | "period_end" | "flags">>;

/** One annual row; every field not given is null (never 0). March year end. */
function fy(year: number, flags: PeriodFlag[], values: AnnualValues): AnnualRow {
  const row = { fiscal_year: year, period_end: `${year}-03-31`, flags } as AnnualRow;
  for (const f of ANNUAL_FIELDS) row[f] = values[f] ?? null;
  return row;
}

function qtr(periodEnd: string, v: Partial<Omit<QuarterRow, "period_end">>): QuarterRow {
  return {
    period_end: periodEnd,
    revenue: v.revenue ?? null,
    operating_expenses: v.operating_expenses ?? null,
    depreciation: v.depreciation ?? null,
    net_profit: v.net_profit ?? null,
    net_profit_owners: v.net_profit_owners ?? null,
  };
}

function sh(periodEnd: string, promoter: number, pledged: number, fii: number, dii: number, holders: number): ShareholdingRow {
  return {
    period_end: periodEnd, promoter_pct: promoter, promoter_pledged_pct: pledged, fii_pct: fii, dii_pct: dii,
    num_shareholders: holders,
  };
}

function market(price: number | null, shares: number | null, faceValue: number | null, supplied: number | null = null): MarketInputs {
  return { price, price_date: null, shares_outstanding: shares, face_value: faceValue, market_cap_supplied: supplied };
}

function company(c: Partial<CompanyRecord> & Pick<CompanyRecord, "symbol" | "name" | "sector">): CompanyRecord {
  return {
    symbol: c.symbol,
    name: c.name,
    sector: c.sector,
    industry: c.industry ?? null,
    isin: null,
    company_type: c.company_type ?? null,
    statement_basis: c.statement_basis ?? "consolidated",
    fy_end_month: c.fy_end_month ?? 3,
    market: c.market ?? market(null, null, null),
    annual: c.annual ?? [],
    quarterly: c.quarterly ?? [],
    shareholding: c.shareholding ?? [],
    snapshot: c.snapshot ?? {},
    sample_note: c.sample_note ?? null,
    source_note: c.source_note ?? null,
  };
}

/** Fresh copy on every call, so tests can mutate it freely. */
export function createTinyDataset(): FundamentalsDataset {
  const companies: CompanyRecord[] = [
    company({
      symbol: "TINYMFG",
      name: "Tinymill Engineering Ltd",
      sector: "Capital goods",
      industry: "Industrial components",
      company_type: "non_financial",
      market: market(420, 10, 10),
      sample_note: "A steady manufacturer with every statement field filled in, including leases, minority interest and current investments.",
      annual: [
        fy(2020, [], { revenue: 1000, operating_expenses: 850, cogs: 578, other_income: 10, depreciation: 46.5, finance_cost: 32.4, exceptional_items: 0, pbt: 81.1, tax_expense: 20.28, net_profit: 60.82, net_profit_owners: 58.39, dividend_per_share: 3, equity_share_capital: 100, other_equity: 548.39, non_controlling_interest: 22.43, borrowings_non_current: 260, borrowings_current: 60, lease_liabilities: 35, trade_payables: 87.1, total_current_liabilities: 187.1, total_assets: 1177.92, net_fixed_assets: 643.5, inventories: 123.52, trade_receivables: 169.86, cash_and_bank: 64.04, current_investments: 40, total_current_assets: 422.42, shares_outstanding_ye: 10, cfo: 94.04, capex: 70, equity_issuance: 0 }),
        fy(2021, [], { revenue: 1085, operating_expenses: 913.57, cogs: 621.23, other_income: 10.85, depreciation: 48.26, finance_cost: 31.5, exceptional_items: 0, pbt: 102.52, tax_expense: 25.63, net_profit: 76.89, net_profit_owners: 73.81, dividend_per_share: 3.5, equity_share_capital: 100, other_equity: 587.2, non_controlling_interest: 25.51, borrowings_non_current: 250, borrowings_current: 60, lease_liabilities: 35, trade_payables: 93.61, total_current_liabilities: 197.01, total_assets: 1219.72, net_fixed_assets: 675.24, inventories: 132.76, trade_receivables: 184.3, cash_and_bank: 47.02, current_investments: 40, total_current_assets: 431.21, shares_outstanding_ye: 10, cfo: 107.98, capex: 80, equity_issuance: 0 }),
        fy(2022, [], { revenue: 1210, operating_expenses: 1004.3, cogs: 682.92, other_income: 12.1, depreciation: 50.64, finance_cost: 33.53, exceptional_items: 0, pbt: 133.63, tax_expense: 33.41, net_profit: 100.22, net_profit_owners: 96.21, dividend_per_share: 4, equity_share_capital: 100, other_equity: 643.41, non_controlling_interest: 29.52, borrowings_non_current: 290, borrowings_current: 75, lease_liabilities: 35, trade_payables: 102.91, total_current_liabilities: 226.31, total_assets: 1349.24, net_fixed_assets: 734.6, inventories: 145.94, trade_receivables: 205.53, cash_and_bank: 77.77, current_investments: 40, total_current_assets: 499.49, shares_outstanding_ye: 10, cfo: 125.75, capex: 110, equity_issuance: 0 }),
        fy(2023, [], { revenue: 1335, operating_expenses: 1118.73, cogs: 760.74, other_income: 13.35, depreciation: 55.1, finance_cost: 37.8, exceptional_items: -12, pbt: 124.72, tax_expense: 31.18, net_profit: 93.54, net_profit_owners: 89.8, dividend_per_share: 4, equity_share_capital: 100, other_equity: 693.21, non_controlling_interest: 33.26, borrowings_non_current: 320, borrowings_current: 85, lease_liabilities: 35, trade_payables: 114.63, total_current_liabilities: 253.03, total_assets: 1459.5, net_fixed_assets: 799.5, inventories: 162.57, trade_receivables: 226.77, cash_and_bank: 80.26, current_investments: 40, total_current_assets: 542.98, shares_outstanding_ye: 10, cfo: 122.49, capex: 120, equity_issuance: 0 }),
        fy(2024, [], { revenue: 1450, operating_expenses: 1200.6, cogs: 816.41, other_income: 14.5, depreciation: 59.96, finance_cost: 38.48, exceptional_items: 0, pbt: 165.46, tax_expense: 41.37, net_profit: 124.09, net_profit_owners: 119.13, dividend_per_share: 4.5, equity_share_capital: 100, other_equity: 767.34, non_controlling_interest: 38.22, borrowings_non_current: 300, borrowings_current: 80, lease_liabilities: 35, trade_payables: 123.02, total_current_liabilities: 261.02, total_assets: 1526.58, net_fixed_assets: 834.54, inventories: 174.47, trade_receivables: 246.3, cash_and_bank: 76.27, current_investments: 40, total_current_assets: 573.29, shares_outstanding_ye: 10, cfo: 161.01, capex: 95, equity_issuance: 0 }),
        fy(2025, [], { revenue: 1600, operating_expenses: 1312, cogs: 892.16, other_income: 16, depreciation: 62.59, finance_cost: 36.23, exceptional_items: 6, pbt: 211.18, tax_expense: 52.8, net_profit: 158.38, net_profit_owners: 152.04, dividend_per_share: 5.5, equity_share_capital: 100, other_equity: 864.38, non_controlling_interest: 44.56, borrowings_non_current: 280, borrowings_current: 75, lease_liabilities: 35, trade_payables: 134.44, total_current_liabilities: 273.44, total_assets: 1622.38, net_fixed_assets: 901.95, inventories: 190.65, trade_receivables: 271.78, cash_and_bank: 57, current_investments: 40, total_current_assets: 599.43, shares_outstanding_ye: 10, cfo: 190.73, capex: 130, equity_issuance: 0 }),
        fy(2026, [], { revenue: 1760, operating_expenses: 1439.68, cogs: 978.98, other_income: 17.6, depreciation: 67.65, finance_cost: 33.53, exceptional_items: 0, pbt: 236.74, tax_expense: 59.19, net_profit: 177.55, net_profit_owners: 170.45, dividend_per_share: 6, equity_share_capital: 100, other_equity: 974.83, non_controlling_interest: 51.66, borrowings_non_current: 250, borrowings_current: 70, lease_liabilities: 35, trade_payables: 147.52, total_current_liabilities: 287.92, total_assets: 1724.41, net_fixed_assets: 974.3, inventories: 209.21, trade_receivables: 298.96, cash_and_bank: 34.54, current_investments: 40, total_current_assets: 626.71, shares_outstanding_ye: 10, cfo: 212.54, capex: 140, equity_issuance: 0 }),
      ],
      quarterly: [
        qtr("2024-06-30", { revenue: 368, operating_expenses: 301.76, depreciation: 14.4, net_profit: 36.43, net_profit_owners: 34.97 }),
        qtr("2024-09-30", { revenue: 392, operating_expenses: 321.44, depreciation: 15.33, net_profit: 38.8, net_profit_owners: 37.25 }),
        qtr("2024-12-31", { revenue: 416, operating_expenses: 341.12, depreciation: 16.27, net_profit: 41.18, net_profit_owners: 39.53 }),
        qtr("2025-03-31", { revenue: 424, operating_expenses: 347.68, depreciation: 16.59, net_profit: 41.97, net_profit_owners: 40.29 }),
        qtr("2025-06-30", { revenue: 404.8, operating_expenses: 331.13, depreciation: 15.56, net_profit: 40.84, net_profit_owners: 39.2 }),
        qtr("2025-09-30", { revenue: 431.2, operating_expenses: 352.72, depreciation: 16.57, net_profit: 43.5, net_profit_owners: 41.76 }),
        qtr("2025-12-31", { revenue: 457.6, operating_expenses: 374.32, depreciation: 17.59, net_profit: 46.16, net_profit_owners: 44.32 }),
        qtr("2026-03-31", { revenue: 466.4, operating_expenses: 381.51, depreciation: 17.93, net_profit: 47.05, net_profit_owners: 45.17 }),
        qtr("2026-06-30", { revenue: 448.8, operating_expenses: 366.22, depreciation: 17.25, net_profit: 46.01, net_profit_owners: 44.17 }),
      ],
      shareholding: [
        sh("2023-06-30", 62.5, 0, 11.2, 9.8, 41250),
        sh("2023-09-30", 62.5, 0, 11.35, 9.9, 42100),
        sh("2023-12-31", 62.5, 0, 11.5, 10.05, 43600),
        sh("2024-03-31", 62.5, 0, 11.6, 10.2, 44100),
        sh("2024-06-30", 62.4, 0, 11.8, 10.35, 45020),
        sh("2024-09-30", 62.4, 0, 12.05, 10.5, 46350),
        sh("2024-12-31", 62.1, 0, 12.2, 10.6, 47100),
        sh("2025-03-31", 62.1, 0, 12.4, 10.8, 48200),
        sh("2025-06-30", 62.1, 0, 12.55, 10.95, 49010),
        sh("2025-09-30", 61.9, 1.5, 12.7, 11.05, 49900),
        sh("2025-12-31", 61.9, 1.5, 12.8, 11.2, 50750),
        sh("2026-03-31", 61.9, 1.5, 12.9, 11.3, 51300),
        sh("2026-06-30", 61.9, 1.5, 13.0, 11.4, 52040),
      ],
    }),
    company({
      symbol: "TINYSOFT",
      name: "Tinysoft Infotech Ltd",
      sector: "IT services",
      industry: "IT services",
      company_type: "non_financial",
      market: market(138, 50, 2),
      sample_note: "A debt-free services company: no cost of goods sold, no inventories and no finance cost.",
      annual: [
        fy(2021, [], { revenue: 820, operating_expenses: 639.6, other_income: 20.5, depreciation: 21, finance_cost: 0, exceptional_items: 0, pbt: 179.9, tax_expense: 44.98, net_profit: 134.92, dividend_per_share: 2.4, equity_share_capital: 100, other_equity: 654.92, non_controlling_interest: 0, borrowings_non_current: 0, borrowings_current: 0, lease_liabilities: 0, trade_payables: 44.93, total_current_liabilities: 94.13, total_assets: 864.05, net_fixed_assets: 144, inventories: 0, trade_receivables: 161.75, cash_and_bank: 262.1, current_investments: 120, total_current_assets: 576.65, shares_outstanding_ye: 50, cfo: 147.1, capex: 25, equity_issuance: 0 }),
        fy(2022, [], { revenue: 905, operating_expenses: 696.85, other_income: 22.63, depreciation: 21.6, finance_cost: 0, exceptional_items: 0, pbt: 209.18, tax_expense: 52.3, net_profit: 156.88, dividend_per_share: 2.8, equity_share_capital: 100, other_equity: 671.8, non_controlling_interest: 0, borrowings_non_current: 0, borrowings_current: 0, lease_liabilities: 0, trade_payables: 49.59, total_current_liabilities: 103.89, total_assets: 890.69, net_fixed_assets: 152.4, inventories: 0, trade_receivables: 178.52, cash_and_bank: 258.47, current_investments: 120, total_current_assets: 593.19, shares_outstanding_ye: 50, cfo: 166.37, capex: 30, equity_issuance: 0 }),
        fy(2023, [], { revenue: 1030, operating_expenses: 787.95, other_income: 25.75, depreciation: 22.86, finance_cost: 0, exceptional_items: 0, pbt: 244.94, tax_expense: 61.24, net_profit: 183.7, dividend_per_share: 3.2, equity_share_capital: 100, other_equity: 695.5, non_controlling_interest: 0, borrowings_non_current: 0, borrowings_current: 0, lease_liabilities: 0, trade_payables: 56.44, total_current_liabilities: 118.24, total_assets: 928.74, net_fixed_assets: 164.54, inventories: 0, trade_receivables: 203.18, cash_and_bank: 252.22, current_investments: 120, total_current_assets: 616.6, shares_outstanding_ye: 50, cfo: 188.75, capex: 35, equity_issuance: 0 }),
        fy(2024, [], { revenue: 1110, operating_expenses: 865.8, other_income: 27.75, depreciation: 24.68, finance_cost: 0, exceptional_items: 0, pbt: 247.27, tax_expense: 61.82, net_profit: 185.45, dividend_per_share: 3.4, equity_share_capital: 100, other_equity: 710.95, non_controlling_interest: 0, borrowings_non_current: 0, borrowings_current: 0, lease_liabilities: 0, trade_payables: 60.82, total_current_liabilities: 127.42, total_assets: 953.37, net_fixed_assets: 169.86, inventories: 0, trade_receivables: 218.96, cash_and_bank: 250.95, current_investments: 120, total_current_assets: 634.31, shares_outstanding_ye: 50, cfo: 198.73, capex: 30, equity_issuance: 0 }),
        fy(2025, [], { revenue: 1190, operating_expenses: 922.25, other_income: 29.75, depreciation: 25.48, finance_cost: 0, exceptional_items: 0, pbt: 272.02, tax_expense: 68.01, net_profit: 204.01, dividend_per_share: 3.8, equity_share_capital: 100, other_equity: 724.96, non_controlling_interest: 0, borrowings_non_current: 0, borrowings_current: 0, lease_liabilities: 0, trade_payables: 65.21, total_current_liabilities: 136.61, total_assets: 976.57, net_fixed_assets: 176.38, inventories: 0, trade_receivables: 234.74, cash_and_bank: 247.05, current_investments: 120, total_current_assets: 649.39, shares_outstanding_ye: 50, cfo: 218.1, capex: 32, equity_issuance: 0 }),
        fy(2026, [], { revenue: 1300, operating_expenses: 1001, other_income: 32.5, depreciation: 26.46, finance_cost: 0, exceptional_items: 0, pbt: 305.04, tax_expense: 76.26, net_profit: 228.78, dividend_per_share: 4.2, equity_share_capital: 100, other_equity: 743.74, non_controlling_interest: 0, borrowings_non_current: 0, borrowings_current: 0, lease_liabilities: 0, trade_payables: 71.23, total_current_liabilities: 149.23, total_assets: 1007.97, net_fixed_assets: 185.92, inventories: 0, trade_receivables: 256.44, cash_and_bank: 240.61, current_investments: 120, total_current_assets: 669.05, shares_outstanding_ye: 50, cfo: 239.56, capex: 36, equity_issuance: 0 }),
      ],
      quarterly: [
        qtr("2024-06-30", { revenue: 285.6, operating_expenses: 221.34, depreciation: 6.12, net_profit: 48.96 }),
        qtr("2024-09-30", { revenue: 297.5, operating_expenses: 230.56, depreciation: 6.37, net_profit: 51 }),
        qtr("2024-12-31", { revenue: 303.45, operating_expenses: 235.17, depreciation: 6.5, net_profit: 52.02 }),
        qtr("2025-03-31", { revenue: 303.45, operating_expenses: 235.18, depreciation: 6.49, net_profit: 52.03 }),
        qtr("2025-06-30", { revenue: 312, operating_expenses: 240.24, depreciation: 6.35, net_profit: 54.91 }),
        qtr("2025-12-31", { revenue: 331.5, operating_expenses: 255.26, depreciation: 6.75, net_profit: 58.34 }),
        qtr("2026-03-31", { revenue: 331.5, operating_expenses: 255.25, depreciation: 6.74, net_profit: 58.33 }),
        qtr("2026-06-30", { revenue: 338, operating_expenses: 260.26, depreciation: 6.62, net_profit: 59.68 }),
      ],
      shareholding: [
        sh("2025-06-30", 54.2, 0, 18.1, 14.0, 182300),
        sh("2025-09-30", 54.2, 0, 18.4, 14.3, 185100),
        sh("2025-12-31", 54.2, 0, 18.0, 14.9, 188400),
        sh("2026-03-31", 54.2, 0, 17.6, 15.4, 190050),
        sh("2026-06-30", 54.2, 0, 17.9, 15.6, 193200),
      ],
    }),
    company({
      symbol: "TINYBANK",
      name: "Tinyvault Bank Ltd",
      sector: "Banks",
      industry: "Private sector bank",
      company_type: null,
      market: market(39.8, 75, 2),
      sample_note: "A lender whose company type is not supplied, so it is inferred from the sector.",
      annual: [
        fy(2021, [], { revenue: 856.8, operating_expenses: 207.62, other_income: 91.8, depreciation: 15.3, exceptional_items: 0, pbt: 113.68, tax_expense: 28.61, net_profit: 85.07, net_profit_owners: 85.07, dividend_per_share: 0.2, interest_expended: 474.3, provisions_contingencies: 137.7, equity_share_capital: 150, other_equity: 1270.07, non_controlling_interest: 0, borrowings_non_current: 640, total_assets: 11740.07, cash_and_bank: 480, shares_outstanding_ye: 75, advances: 8000, gross_npa: 277.18, net_npa: 124.73, cfo: 420, equity_issuance: 0 }),
        fy(2022, [], { revenue: 946.4, operating_expenses: 229.33, other_income: 101.4, depreciation: 16.9, exceptional_items: 0, pbt: 150.92, tax_expense: 37.99, net_profit: 112.93, net_profit_owners: 112.93, dividend_per_share: 0.3, interest_expended: 523.9, provisions_contingencies: 126.75, equity_share_capital: 150, other_equity: 1360.5, non_controlling_interest: 0, borrowings_non_current: 712, total_assets: 12991.5, cash_and_bank: 534, shares_outstanding_ye: 75, advances: 8900, gross_npa: 281.13, net_npa: 112.45, cfo: -150, equity_issuance: 0 }),
        fy(2023, [], { revenue: 1052.8, operating_expenses: 255.12, other_income: 112.8, depreciation: 18.8, exceptional_items: 0, pbt: 205.48, tax_expense: 51.72, net_profit: 153.76, net_profit_owners: 153.76, dividend_per_share: 0.4, interest_expended: 582.8, provisions_contingencies: 103.4, equity_share_capital: 150, other_equity: 1484.26, non_controlling_interest: 0, borrowings_non_current: 792, total_assets: 14405.26, cash_and_bank: 594, shares_outstanding_ye: 75, advances: 9900, gross_npa: 272.07, net_npa: 95.22, cfo: 610, equity_issuance: 0 }),
        fy(2024, [], { revenue: 1164.8, operating_expenses: 282.26, other_income: 124.8, depreciation: 20.8, exceptional_items: 0, pbt: 248.14, tax_expense: 62.46, net_profit: 185.68, net_profit_owners: 185.68, dividend_per_share: 0.5, interest_expended: 644.8, provisions_contingencies: 93.6, equity_share_capital: 150, other_equity: 1632.44, non_controlling_interest: 0, borrowings_non_current: 872, total_assets: 15843.44, cash_and_bank: 654, shares_outstanding_ye: 75, advances: 10900, gross_npa: 265.94, net_npa: 85.1, cfo: 280, equity_issuance: 0 }),
        fy(2025, [], { revenue: 1276.8, operating_expenses: 309.4, other_income: 136.8, depreciation: 22.8, exceptional_items: 0, pbt: 283.4, tax_expense: 71.33, net_profit: 212.07, net_profit_owners: 212.07, dividend_per_share: 0.6, interest_expended: 706.8, provisions_contingencies: 91.2, equity_share_capital: 150, other_equity: 1799.51, non_controlling_interest: 0, borrowings_non_current: 952, total_assets: 17300.51, cash_and_bank: 714, shares_outstanding_ye: 75, advances: 11900, gross_npa: 265.89, net_npa: 79.77, cfo: 520, equity_issuance: 0 }),
        fy(2026, [], { revenue: 1394.4, operating_expenses: 337.89, other_income: 149.4, depreciation: 24.9, exceptional_items: 0, pbt: 321.96, tax_expense: 81.04, net_profit: 240.92, net_profit_owners: 240.92, dividend_per_share: 0.8, interest_expended: 771.9, provisions_contingencies: 87.15, equity_share_capital: 150, other_equity: 1980.43, non_controlling_interest: 0, borrowings_non_current: 1040, total_assets: 18900.43, cash_and_bank: 780, shares_outstanding_ye: 75, advances: 13000, gross_npa: 263.8, net_npa: 73.86, cfo: 380, equity_issuance: 0 }),
      ],
      quarterly: [
        qtr("2025-06-30", { revenue: 334.66, operating_expenses: 81.09, depreciation: 5.98, net_profit: 57.82, net_profit_owners: 57.82 }),
        qtr("2025-09-30", { revenue: 341.63, operating_expenses: 82.78, depreciation: 6.1, net_profit: 59.03, net_profit_owners: 59.03 }),
        qtr("2025-12-31", { revenue: 348.6, operating_expenses: 84.47, depreciation: 6.23, net_profit: 60.23, net_profit_owners: 60.23 }),
        qtr("2026-03-31", { revenue: 369.51, operating_expenses: 89.55, depreciation: 6.59, net_profit: 63.84, net_profit_owners: 63.84 }),
        qtr("2026-06-30", { revenue: 365.33, operating_expenses: 86.16, depreciation: 6.23, net_profit: 65.05, net_profit_owners: 65.05 }),

      ],
      shareholding: [
        sh("2025-06-30", 26.0, 0, 34.2, 22.1, 312000),
        sh("2025-09-30", 26.0, 0, 33.8, 22.6, 318500),
        sh("2025-12-31", 26.0, 0, 33.5, 23.0, 322400),
        sh("2026-03-31", 26.0, 0, 33.9, 23.2, 327900),
        sh("2026-06-30", 26.0, 0, 34.4, 23.1, 331600),
      ],
    }),
    company({
      symbol: "TINYLOSS",
      name: "Tinyloom Textiles Ltd",
      sector: "Textiles",
      industry: "Textile mills",
      company_type: "non_financial",
      market: market(12.5, 5, 10),
      sample_note: "A loss-making company whose net worth turned negative; FY2024 is a transition year.",
      annual: [
        fy(2021, [], { revenue: 420, operating_expenses: 394.8, cogs: 284.26, other_income: 3.36, depreciation: 22.8, finance_cost: 54.73, exceptional_items: 0, pbt: -48.97, tax_expense: 0, net_profit: -48.97, net_profit_owners: -48.97, dividend_per_share: 0, equity_share_capital: 50, other_equity: 11.03, non_controlling_interest: 0, borrowings_non_current: 420, borrowings_current: 90, lease_liabilities: 0, trade_payables: 62.3, total_current_liabilities: 173.3, total_assets: 664.33, net_fixed_assets: 372.2, inventories: 93.46, trade_receivables: 109.32, cash_and_bank: 23.35, current_investments: 0, total_current_assets: 234.53, shares_outstanding_ye: 5, cfo: -11.65, capex: 15, equity_issuance: 0 }),
        fy(2022, [], { revenue: 400, operating_expenses: 382, cogs: 275.04, other_income: 3.2, depreciation: 22.33, finance_cost: 57.75, exceptional_items: 0, pbt: -58.88, tax_expense: 0, net_profit: -58.88, net_profit_owners: -58.88, dividend_per_share: 0, equity_share_capital: 50, other_equity: -47.85, non_controlling_interest: 0, borrowings_non_current: 440, borrowings_current: 100, lease_liabilities: 0, trade_payables: 60.28, total_current_liabilities: 180.28, total_assets: 632.43, net_fixed_assets: 359.87, inventories: 90.42, trade_receivables: 104.11, cash_and_bank: 13.03, current_investments: 0, total_current_assets: 215.56, shares_outstanding_ye: 5, cfo: -30.32, capex: 10, equity_issuance: 0 }),
        fy(2023, [], { revenue: 365, operating_expenses: 357.7, cogs: 257.54, other_income: 2.92, depreciation: 21.59, finance_cost: 61.05, exceptional_items: -18, pbt: -90.42, tax_expense: 0, net_profit: -90.42, net_profit_owners: -90.42, dividend_per_share: 0, equity_share_capital: 50, other_equity: -138.27, non_controlling_interest: 0, borrowings_non_current: 460, borrowings_current: 140.77, lease_liabilities: 0, trade_payables: 56.45, total_current_liabilities: 215.47, total_assets: 597.2, net_fixed_assets: 346.28, inventories: 84.67, trade_receivables: 95, cash_and_bank: 8, current_investments: 0, total_current_assets: 194.97, shares_outstanding_ye: 5, cfo: -57.8, capex: 8, equity_issuance: 0 }),
        fy(2024, ["transition"], { revenue: 330, operating_expenses: 326.7, cogs: 235.22, other_income: 2.64, depreciation: 20.78, finance_cost: 66.04, exceptional_items: -10, pbt: -90.88, tax_expense: 0, net_profit: -90.88, net_profit_owners: -90.88, dividend_per_share: 0, equity_share_capital: 50, other_equity: -229.15, non_controlling_interest: 0, borrowings_non_current: 480, borrowings_current: 184.31, lease_liabilities: 0, trade_payables: 51.56, total_current_liabilities: 252.37, total_assets: 563.22, net_fixed_assets: 330.5, inventories: 77.33, trade_receivables: 85.89, cash_and_bank: 8, current_investments: 0, total_current_assets: 177.82, shares_outstanding_ye: 5, cfo: -58.54, capex: 5, equity_issuance: 0 }),
        fy(2025, [], { revenue: 310, operating_expenses: 313.1, cogs: 225.43, other_income: 2.48, depreciation: 19.83, finance_cost: 71.19, exceptional_items: 0, pbt: -91.64, tax_expense: 0, net_profit: -91.64, net_profit_owners: -91.64, dividend_per_share: 0, equity_share_capital: 50, other_equity: -320.79, non_controlling_interest: 0, borrowings_non_current: 500, borrowings_current: 234.84, lease_liabilities: 0, trade_payables: 49.41, total_current_liabilities: 299.75, total_assets: 538.96, net_fixed_assets: 315.67, inventories: 74.11, trade_receivables: 80.68, cash_and_bank: 8, current_investments: 0, total_current_assets: 168.99, shares_outstanding_ye: 5, cfo: -65.53, capex: 5, equity_issuance: 0 }),
        fy(2026, [], { revenue: 295, operating_expenses: 290.57, cogs: 209.21, other_income: 2.36, depreciation: 18.94, finance_cost: 75.89, exceptional_items: 0, pbt: -88.04, tax_expense: 0, net_profit: -88.04, net_profit_owners: -88.04, dividend_per_share: 0, equity_share_capital: 50, other_equity: -408.83, non_controlling_interest: 0, borrowings_non_current: 510, borrowings_current: 292.27, lease_liabilities: 0, trade_payables: 45.85, total_current_liabilities: 352.87, total_assets: 514.04, net_fixed_assets: 300.73, inventories: 68.78, trade_receivables: 76.78, cash_and_bank: 8, current_investments: 0, total_current_assets: 159.46, shares_outstanding_ye: 5, cfo: -63.43, capex: 4, equity_issuance: 0 }),
      ],
      shareholding: [
        sh("2025-06-30", 48.0, 38.0, 1.2, 0.8, 21400),
        sh("2025-09-30", 46.5, 40.5, 1.1, 0.7, 21900),
        sh("2025-12-31", 44.2, 42.0, 0.9, 0.7, 22650),
        sh("2026-03-31", 42.6, 44.0, 0.8, 0.6, 23100),
        sh("2026-06-30", 41.0, 45.0, 0.8, 0.5, 23800),
      ],
    }),
    company({
      symbol: "TINYSNAP",
      name: "Tinysnap Consumer Ltd",
      sector: "FMCG",
      industry: "Packaged foods",
      company_type: "non_financial",
      market: market(250, null, null, 5000),
      snapshot: {
        pe: 22.4, eps: 11.16, pb: 3.1, roe: 14.2, roce: 17.8, debt_equity: 0.35, debt_ebitda: 1.2,
        dividend_yield: 1.1, sales_growth: 9.5, profit_growth: 11.2, fcf_yield: 3.4,
      },
      sample_note: "Only a one-row snapshot was supplied: no statements, quarters or shareholding.",
    }),
    company({
      symbol: "TINYNEW",
      name: "Tinynova Chemicals Ltd",
      sector: "Specialty chemicals",
      industry: "Specialty chemicals",
      company_type: "non_financial",
      statement_basis: "standalone",
      market: market(66, 10, 10),
      sample_note: "A recent listing with three financial years and a missing year (FY2024).",
      annual: [
        fy(2023, [], { revenue: 140, operating_expenses: 120.4, cogs: 90.3, other_income: 1.4, depreciation: 8.4, finance_cost: 7.65, exceptional_items: 0, pbt: 4.95, tax_expense: 1.24, net_profit: 3.71, net_profit_owners: 3.71, dividend_per_share: 0, equity_share_capital: 80, other_equity: 73.71, non_controlling_interest: 0, borrowings_non_current: 60, borrowings_current: 26.21, lease_liabilities: 0, trade_payables: 12.37, total_current_liabilities: 44.18, total_assets: 262.89, net_fixed_assets: 126.6, inventories: 14.84, trade_receivables: 26.85, cash_and_bank: 6, current_investments: 0, total_current_assets: 50.49, shares_outstanding_ye: 8, cfo: 10.79, capex: 30, equity_issuance: 0 }),
        fy(2025, [], { revenue: 215, operating_expenses: 180.6, cogs: 135.45, other_income: 2.15, depreciation: 11.32, finance_cost: 7.32, exceptional_items: 0, pbt: 17.91, tax_expense: 4.48, net_profit: 13.43, net_profit_owners: 13.43, dividend_per_share: 1, equity_share_capital: 100, other_equity: 184.78, non_controlling_interest: 0, borrowings_non_current: 30, borrowings_current: 15, lease_liabilities: 0, trade_payables: 18.55, total_current_liabilities: 42.15, total_assets: 361.93, net_fixed_assets: 170.15, inventories: 22.27, trade_receivables: 41.23, cash_and_bank: 36.68, current_investments: 0, total_current_assets: 104.48, shares_outstanding_ye: 10, cfo: 17.04, capex: 40, equity_issuance: 120 }),
        fy(2026, [], { revenue: 262, operating_expenses: 217.46, cogs: 163.1, other_income: 2.62, depreciation: 13.61, finance_cost: 4.25, exceptional_items: 0, pbt: 29.3, tax_expense: 7.33, net_profit: 21.97, net_profit_owners: 21.97, dividend_per_share: 1.5, equity_share_capital: 100, other_equity: 191.75, non_controlling_interest: 0, borrowings_non_current: 25, borrowings_current: 15, lease_liabilities: 0, trade_payables: 22.34, total_current_liabilities: 47.82, total_assets: 369.57, net_fixed_assets: 191.54, inventories: 26.81, trade_receivables: 50.25, cash_and_bank: 7.49, current_investments: 0, total_current_assets: 89.79, shares_outstanding_ye: 10, cfo: 25.81, capex: 35, equity_issuance: 0 }),
      ],
      quarterly: [
        qtr("2025-12-31", { revenue: 66.81, operating_expenses: 55.45, depreciation: 3.47, net_profit: 5.6, net_profit_owners: 5.6 }),
        qtr("2026-03-31", { revenue: 69.43, operating_expenses: 57.63, depreciation: 3.61, net_profit: 5.83, net_profit_owners: 5.83 }),
        qtr("2026-06-30", { revenue: 70.4, operating_expenses: 58.08, depreciation: 3.4, net_profit: 6.42, net_profit_owners: 6.42 }),
      ],
      shareholding: [
        sh("2026-03-31", 68.4, 0, 3.1, 6.2, 64200),
        sh("2026-06-30", 68.4, 0, 3.6, 6.8, 61800),
      ],
    }),
  ];
  return {
    schema: DATASET_SCHEMA,
    version: DATASET_VERSION,
    meta: {
      name: "Tiny fixture (six fictional companies)",
      source: "synthetic_sample",
      isSynthetic: true,
      asOf: null,
      importedAt: null,
      currency: "INR",
      moneyUnit: "crore",
      sharesUnit: "crore",
      files: [],
      generator: null,
      notes: [
        "Hand-written test fixture. Every company is fictional and describes no real business.",
        "Fiscal-year labels are illustrative and describe no real period.",
      ],
    },
    companies,
  };
}

/** Shared read-only instance. Use createTinyDataset() when a test needs to modify the data. */
export const TINY_DATASET: FundamentalsDataset = createTinyDataset();

export const TINY_SYMBOLS = ["TINYMFG", "TINYSOFT", "TINYBANK", "TINYLOSS", "TINYSNAP", "TINYNEW"] as const;
export type TinySymbol = (typeof TINY_SYMBOLS)[number];

/** Face value per share, used by identity checks (equity_share_capital = shares × face value). */
export const TINY_FACE_VALUE: Readonly<Record<TinySymbol, number | null>> = {
  TINYMFG: 10, TINYSOFT: 2, TINYBANK: 2, TINYLOSS: 10, TINYSNAP: null, TINYNEW: 10,
};
