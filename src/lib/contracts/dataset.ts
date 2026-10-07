// src/lib/contracts/dataset.ts
// Canonical, versioned fundamentals dataset. Frozen after Phase 0 (additive changes only,
// approved by the tech lead).
//
// Conventions (enforced by data/validate.ts and data/normalize.ts):
//  - Missing = null. Persisted and normalised data never contains NaN or undefined values;
//    0 is a real zero.
//  - Money: ₹ crore. Shares: crore shares. Percentages: percent numbers (15.2 means 15.2%).
//  - Every series is stored OLDEST FIRST (ascending by fiscal_year / period_end).
//  - After normalisation every key below is present (optional inputs are null, never absent).

export const DATASET_SCHEMA = "funda-dataset" as const;
export const DATASET_VERSION = 1 as const;

export type Num = number | null;
/** Calendar date "YYYY-MM-DD". */
export type ISODate = string;

export type CompanyType = "non_financial" | "bank" | "nbfc" | "insurance" | "other_financial";
/** Applicability family: decides which metrics apply. other_financial counts as non_financial. */
export type TypeFamily = "non_financial" | "lender" | "insurance";
/** Peer class: percentiles, medians and ranks never mix classes. */
export type PeerClass = "non_financial" | "bank" | "nbfc" | "insurance";
export type StatementBasis = "consolidated" | "standalone";
export type PeriodFlag = "restated" | "transition";
export type DatasetSource = "synthetic_sample" | "user_import" | "custom_provider";
export type ImportFileKind = "canonical_json" | "snapshot" | "companies" | "annual" | "quarterly" | "shareholding";

export const TYPE_FAMILY: Readonly<Record<CompanyType, TypeFamily>> = {
  non_financial: "non_financial",
  other_financial: "non_financial",
  bank: "lender",
  nbfc: "lender",
  insurance: "insurance",
};

export const PEER_CLASS: Readonly<Record<CompanyType, PeerClass>> = {
  non_financial: "non_financial",
  other_financial: "non_financial",
  bank: "bank",
  nbfc: "nbfc",
  insurance: "insurance",
};

export interface DatasetFile {
  name: string;
  kind: ImportFileKind;
  rows: number;
}

export interface DatasetMeta {
  name: string;
  source: DatasetSource;
  /** True for generated sample data. Drives every "Fictional" label, banner and export flag. */
  isSynthetic: boolean;
  /** "Data as of", exactly as supplied by the user. Null unless supplied. Never auto-filled. */
  asOf: ISODate | null;
  /** Real wall-clock time of the user's import action (from time/clock.ts). Null for samples. */
  importedAt: string | null;
  currency: "INR";
  moneyUnit: "crore";
  sharesUnit: "crore";
  files: DatasetFile[];
  /** Present only for synthetic data. */
  generator: { name: "funda-sample"; version: string; seed: number } | null;
  /** Definition notes supplied with the data, e.g. "pledge is % of promoter holding". */
  notes: string[];
}

export interface MarketInputs {
  /** Reference closing price supplied with the data. Not a live quote. */
  price: Num;
  /** Shown exactly as supplied. Null when not supplied; the app never fills it in. */
  price_date: ISODate | null;
  /** Current shares in issue, crore. */
  shares_outstanding: Num;
  /** ₹ per share. */
  face_value: Num;
  /** Market cap supplied by a snapshot file (₹ Cr). Used only when price × shares is unavailable. */
  market_cap_supplied: Num;
}

export interface AnnualRow {
  /** 2026 = financial year ended in 2026 (FY26; year ended 31 Mar 2026 for a March year end). */
  fiscal_year: number;
  period_end: ISODate | null;
  /** Growth, CAGR and averages across a flagged year are null (reason transition_period). */
  flags: PeriodFlag[];
  // ── Profit and loss (₹ Cr) ──
  revenue: Num;
  operating_expenses: Num;
  cogs: Num;
  other_income: Num;
  depreciation: Num;
  finance_cost: Num;
  exceptional_items: Num;
  pbt: Num;
  tax_expense: Num;
  /** PAT including the non-controlling interest share. */
  net_profit: Num;
  /** PAT attributable to owners of the parent. Null → derivers use net_profit. */
  net_profit_owners: Num;
  /** ₹ per share, interim + final declared for the year, adjusted to the current face value. */
  dividend_per_share: Num;
  /** Lenders only. */
  interest_expended: Num;
  /** Lenders only. Excludes income tax. */
  provisions_contingencies: Num;
  // ── Balance sheet at year end (₹ Cr) ──
  equity_share_capital: Num;
  other_equity: Num;
  non_controlling_interest: Num;
  borrowings_non_current: Num;
  borrowings_current: Num;
  lease_liabilities: Num;
  trade_payables: Num;
  total_current_liabilities: Num;
  total_assets: Num;
  net_fixed_assets: Num;
  inventories: Num;
  trade_receivables: Num;
  cash_and_bank: Num;
  current_investments: Num;
  total_current_assets: Num;
  /** Crore shares at year end, adjusted for later splits and bonus issues. */
  shares_outstanding_ye: Num;
  /** Lenders only (net advances). */
  advances: Num;
  /** Lenders only (gross NPA / Stage 3). */
  gross_npa: Num;
  /** Lenders only. */
  net_npa: Num;
  // ── Cash flow (₹ Cr) ──
  cfo: Num;
  /** Gross purchase of PPE, CWIP and intangibles, entered as a positive number. */
  capex: Num;
  /** Proceeds from issue of equity, positive. */
  equity_issuance: Num;
}

export interface QuarterRow {
  /** Matching is by date (± 15 days), never by label or array position. */
  period_end: ISODate;
  revenue: Num;
  operating_expenses: Num;
  depreciation: Num;
  net_profit: Num;
  net_profit_owners: Num;
}

export interface ShareholdingRow {
  period_end: ISODate;
  promoter_pct: Num;
  /** Pledged or encumbered, as % of PROMOTER holding (not of total shares). */
  promoter_pledged_pct: Num;
  fii_pct: Num;
  dii_pct: Num;
  num_shareholders: Num;
}

export interface CompanyRecord {
  /** Upper-case, unique within the dataset; the join key across files. */
  symbol: string;
  name: string;
  sector: string;
  industry: string | null;
  /** Display only; a format mismatch is a warning, never a rejection. */
  isin: string | null;
  /** As supplied. Null → inferred from sector/industry keywords by metrics/company-type.ts. */
  company_type: CompanyType | null;
  /** Default "consolidated". Must not change within one company. */
  statement_basis: StatementBasis;
  /** 1–12; default 3 (March year end). */
  fy_end_month: number;
  market: MarketInputs;
  annual: AnnualRow[];
  quarterly: QuarterRow[];
  shareholding: ShareholdingRow[];
  /** Values supplied directly by a snapshot file, keyed by metric id. Absent key = not supplied. */
  snapshot: Record<string, number>;
  /** Synthetic data only: why this fictional company is in the sample (teaching note). */
  sample_note: string | null;
  /** Free-text provenance note supplied with the data. */
  source_note: string | null;
}

export interface FundamentalsDataset {
  schema: typeof DATASET_SCHEMA;
  version: typeof DATASET_VERSION;
  meta: DatasetMeta;
  companies: CompanyRecord[];
}

// ── Field key unions and exhaustive runtime lists ───────────────────────────
export type AnnualField = Exclude<keyof AnnualRow, "fiscal_year" | "period_end" | "flags">;
export type QuarterField = Exclude<keyof QuarterRow, "period_end">;
export type ShareholdingField = Exclude<keyof ShareholdingRow, "period_end">;

const ANNUAL_FIELD_SET: Record<AnnualField, true> = {
  revenue: true, operating_expenses: true, cogs: true, other_income: true, depreciation: true,
  finance_cost: true, exceptional_items: true, pbt: true, tax_expense: true, net_profit: true,
  net_profit_owners: true, dividend_per_share: true, interest_expended: true, provisions_contingencies: true,
  equity_share_capital: true, other_equity: true, non_controlling_interest: true,
  borrowings_non_current: true, borrowings_current: true, lease_liabilities: true, trade_payables: true,
  total_current_liabilities: true, total_assets: true, net_fixed_assets: true, inventories: true,
  trade_receivables: true, cash_and_bank: true, current_investments: true, total_current_assets: true,
  shares_outstanding_ye: true, advances: true, gross_npa: true, net_npa: true,
  cfo: true, capex: true, equity_issuance: true,
};
const QUARTER_FIELD_SET: Record<QuarterField, true> = {
  revenue: true, operating_expenses: true, depreciation: true, net_profit: true, net_profit_owners: true,
};
const SHAREHOLDING_FIELD_SET: Record<ShareholdingField, true> = {
  promoter_pct: true, promoter_pledged_pct: true, fii_pct: true, dii_pct: true, num_shareholders: true,
};

export const ANNUAL_FIELDS = Object.keys(ANNUAL_FIELD_SET) as readonly AnnualField[];
export const QUARTER_FIELDS = Object.keys(QUARTER_FIELD_SET) as readonly QuarterField[];
export const SHAREHOLDING_FIELDS = Object.keys(SHAREHOLDING_FIELD_SET) as readonly ShareholdingField[];

/** Required within the annual block for non-financial companies (import warns, never invents). */
export const REQUIRED_ANNUAL_FIELDS: readonly AnnualField[] = [
  "revenue", "operating_expenses", "depreciation", "finance_cost", "pbt", "tax_expense", "net_profit",
  "equity_share_capital", "other_equity", "borrowings_non_current", "borrowings_current",
  "total_assets", "cash_and_bank", "cfo", "capex",
];

/**
 * Fields whose absence conventionally means zero. Derivers treat null as 0 for these
 * ONLY, and the data-health panel lists every such assumption ("Lease liabilities not
 * provided; treated as 0 in debt"). No other field is ever defaulted.
 */
export const ZERO_DEFAULT_FIELDS: readonly AnnualField[] = [
  "other_income", "exceptional_items", "non_controlling_interest", "lease_liabilities", "current_investments",
];

/** Meaningful only for banks and NBFCs. */
export const LENDER_ONLY_FIELDS: readonly AnnualField[] = [
  "interest_expended", "provisions_contingencies", "advances", "gross_npa", "net_npa",
];

/** Grid caps. Older periods beyond these are dropped with an import warning. */
export const MAX_ANNUAL_SLOTS = 20;
export const MAX_QUARTER_SLOTS = 16;
export const MAX_SHAREHOLDING_SLOTS = 16;
/** Quarter slotting tolerance around each 3-month step from the latest quarter. */
export const QUARTER_MATCH_TOLERANCE_DAYS = 15;

// ── Field information: labels, statement grouping and the metric id that exposes each field ──
export type FieldStatement = "pnl" | "balance_sheet" | "cash_flow" | "quarterly" | "shareholding";
export type FieldUnit = "inr_cr" | "inr" | "crore_shares" | "pct" | "count";
export type FieldAppliesTo = "all" | "non_financial" | "lender";

export interface FieldInfo {
  label: string;
  statement: FieldStatement;
  unit: FieldUnit;
  appliesTo: FieldAppliesTo;
  /** Metric id that exposes this field in queries, columns and statement tables. */
  metricId: string;
}

export const ANNUAL_FIELD_INFO: Readonly<Record<AnnualField, FieldInfo>> = {
  revenue: { label: "Revenue from operations", statement: "pnl", unit: "inr_cr", appliesTo: "all", metricId: "sales" },
  operating_expenses: { label: "Operating expenses (excl. interest and depreciation)", statement: "pnl", unit: "inr_cr", appliesTo: "all", metricId: "operating_expenses" },
  cogs: { label: "Cost of goods sold", statement: "pnl", unit: "inr_cr", appliesTo: "non_financial", metricId: "cogs" },
  other_income: { label: "Other income", statement: "pnl", unit: "inr_cr", appliesTo: "all", metricId: "other_income" },
  depreciation: { label: "Depreciation and amortisation", statement: "pnl", unit: "inr_cr", appliesTo: "all", metricId: "depreciation" },
  finance_cost: { label: "Finance costs", statement: "pnl", unit: "inr_cr", appliesTo: "non_financial", metricId: "finance_cost" },
  exceptional_items: { label: "Exceptional items (gain +, loss −)", statement: "pnl", unit: "inr_cr", appliesTo: "all", metricId: "exceptional_items" },
  pbt: { label: "Profit before tax", statement: "pnl", unit: "inr_cr", appliesTo: "all", metricId: "pbt" },
  tax_expense: { label: "Tax expense", statement: "pnl", unit: "inr_cr", appliesTo: "all", metricId: "tax_expense" },
  net_profit: { label: "Net profit (PAT, incl. minority share)", statement: "pnl", unit: "inr_cr", appliesTo: "all", metricId: "pat" },
  net_profit_owners: { label: "Net profit attributable to owners", statement: "pnl", unit: "inr_cr", appliesTo: "all", metricId: "net_profit_owners" },
  dividend_per_share: { label: "Dividend per share", statement: "pnl", unit: "inr", appliesTo: "all", metricId: "dps" },
  interest_expended: { label: "Interest expended", statement: "pnl", unit: "inr_cr", appliesTo: "lender", metricId: "interest_expended" },
  provisions_contingencies: { label: "Provisions and contingencies (excl. tax)", statement: "pnl", unit: "inr_cr", appliesTo: "lender", metricId: "provisions_contingencies" },
  equity_share_capital: { label: "Equity share capital", statement: "balance_sheet", unit: "inr_cr", appliesTo: "all", metricId: "equity_share_capital" },
  other_equity: { label: "Other equity (reserves and surplus)", statement: "balance_sheet", unit: "inr_cr", appliesTo: "all", metricId: "other_equity" },
  non_controlling_interest: { label: "Non-controlling interest", statement: "balance_sheet", unit: "inr_cr", appliesTo: "all", metricId: "non_controlling_interest" },
  borrowings_non_current: { label: "Non-current borrowings", statement: "balance_sheet", unit: "inr_cr", appliesTo: "all", metricId: "borrowings_non_current" },
  borrowings_current: { label: "Current borrowings (incl. current maturities)", statement: "balance_sheet", unit: "inr_cr", appliesTo: "all", metricId: "borrowings_current" },
  lease_liabilities: { label: "Lease liabilities", statement: "balance_sheet", unit: "inr_cr", appliesTo: "all", metricId: "lease_liabilities" },
  trade_payables: { label: "Trade payables", statement: "balance_sheet", unit: "inr_cr", appliesTo: "non_financial", metricId: "trade_payables" },
  total_current_liabilities: { label: "Total current liabilities", statement: "balance_sheet", unit: "inr_cr", appliesTo: "non_financial", metricId: "total_current_liabilities" },
  total_assets: { label: "Total assets", statement: "balance_sheet", unit: "inr_cr", appliesTo: "all", metricId: "total_assets" },
  net_fixed_assets: { label: "Net fixed assets (PPE and right-of-use)", statement: "balance_sheet", unit: "inr_cr", appliesTo: "non_financial", metricId: "net_fixed_assets" },
  inventories: { label: "Inventories", statement: "balance_sheet", unit: "inr_cr", appliesTo: "non_financial", metricId: "inventories" },
  trade_receivables: { label: "Trade receivables", statement: "balance_sheet", unit: "inr_cr", appliesTo: "non_financial", metricId: "trade_receivables" },
  cash_and_bank: { label: "Cash and bank balances", statement: "balance_sheet", unit: "inr_cr", appliesTo: "all", metricId: "cash_and_bank" },
  current_investments: { label: "Current investments", statement: "balance_sheet", unit: "inr_cr", appliesTo: "all", metricId: "current_investments" },
  total_current_assets: { label: "Total current assets", statement: "balance_sheet", unit: "inr_cr", appliesTo: "non_financial", metricId: "total_current_assets" },
  shares_outstanding_ye: { label: "Shares outstanding at year end", statement: "balance_sheet", unit: "crore_shares", appliesTo: "all", metricId: "shares_outstanding_ye" },
  advances: { label: "Advances (loan book, net)", statement: "balance_sheet", unit: "inr_cr", appliesTo: "lender", metricId: "advances" },
  gross_npa: { label: "Gross NPA (Stage 3)", statement: "balance_sheet", unit: "inr_cr", appliesTo: "lender", metricId: "gross_npa" },
  net_npa: { label: "Net NPA", statement: "balance_sheet", unit: "inr_cr", appliesTo: "lender", metricId: "net_npa" },
  cfo: { label: "Cash from operating activities", statement: "cash_flow", unit: "inr_cr", appliesTo: "all", metricId: "cfo" },
  capex: { label: "Capital expenditure", statement: "cash_flow", unit: "inr_cr", appliesTo: "non_financial", metricId: "capex" },
  equity_issuance: { label: "Proceeds from issue of equity", statement: "cash_flow", unit: "inr_cr", appliesTo: "all", metricId: "equity_issuance" },
};

export const QUARTER_FIELD_INFO: Readonly<Record<QuarterField, FieldInfo>> = {
  revenue: { label: "Quarterly revenue from operations", statement: "quarterly", unit: "inr_cr", appliesTo: "all", metricId: "q_sales" },
  operating_expenses: { label: "Quarterly operating expenses", statement: "quarterly", unit: "inr_cr", appliesTo: "all", metricId: "q_operating_expenses" },
  depreciation: { label: "Quarterly depreciation", statement: "quarterly", unit: "inr_cr", appliesTo: "all", metricId: "q_depreciation" },
  net_profit: { label: "Quarterly net profit (PAT)", statement: "quarterly", unit: "inr_cr", appliesTo: "all", metricId: "q_pat" },
  net_profit_owners: { label: "Quarterly net profit attributable to owners", statement: "quarterly", unit: "inr_cr", appliesTo: "all", metricId: "q_net_profit_owners" },
};

export const SHAREHOLDING_FIELD_INFO: Readonly<Record<ShareholdingField, FieldInfo>> = {
  promoter_pct: { label: "Promoter and promoter group holding", statement: "shareholding", unit: "pct", appliesTo: "all", metricId: "promoter_holding" },
  promoter_pledged_pct: { label: "Promoter shares pledged (% of promoter holding)", statement: "shareholding", unit: "pct", appliesTo: "all", metricId: "pledged_pct" },
  fii_pct: { label: "FII / FPI holding", statement: "shareholding", unit: "pct", appliesTo: "all", metricId: "fii_holding" },
  dii_pct: { label: "DII holding", statement: "shareholding", unit: "pct", appliesTo: "all", metricId: "dii_holding" },
  num_shareholders: { label: "Number of shareholders", statement: "shareholding", unit: "count", appliesTo: "all", metricId: "num_shareholders" },
};
