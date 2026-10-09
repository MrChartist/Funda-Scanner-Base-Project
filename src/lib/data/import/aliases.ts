// src/lib/data/import/aliases.ts — header recognition for every importable CSV kind (WS1).
// Aliases are generated from the field names, the FieldInfo labels and the metric ids in the
// dataset contract, plus a short list of plain alternatives. No other site's column names are used.
import type { AnnualField, QuarterField, ShareholdingField } from "@/lib/contracts";
import {
  ANNUAL_FIELD_INFO, ANNUAL_FIELDS, LEGACY_KEY_TO_METRIC, QUARTER_FIELD_INFO, QUARTER_FIELDS, SHAREHOLDING_FIELD_INFO,
  SHAREHOLDING_FIELDS,
} from "@/lib/contracts";

/** Lower-case, letters and digits only: "ROCE (%)" → "roce", "Market Cap (₹ Cr)" → "marketcapcr". */
export function normHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The same with any bracketed unit and a trailing unit word removed: "Revenue (₹ Cr)" → "revenue". */
export function normHeaderLoose(s: string): string {
  const stripped = s
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(?:in\s+)?(?:rs|inr|₹)?\s*(?:crores?|cr)\b\.?\s*$/i, " ")
    .replace(/[%₹]/g, " ");
  return normHeader(stripped);
}

// ── shared identity columns ─────────────────────────────────────────────────
export type IdentityColumn = "symbol" | "fiscal_year" | "period_end";

const IDENTITY_ALIASES: Readonly<Record<IdentityColumn, readonly string[]>> = {
  symbol: ["symbol", "ticker", "nse_code", "nse_symbol", "code", "company_symbol", "scrip"],
  fiscal_year: ["fiscal_year", "fy", "year", "financial_year", "fiscal year", "year_ended"],
  period_end: ["period_end", "quarter_end", "quarter_ended", "period_ended", "date", "as_on", "period_end_date"],
};

// ── companies.csv ───────────────────────────────────────────────────────────
export type CompanyColumn =
  | "symbol" | "name" | "sector" | "industry" | "isin" | "company_type" | "statement_basis" | "fy_end_month"
  | "price" | "price_date" | "shares_outstanding" | "face_value" | "market_cap" | "source_note" | "sample_note";

const COMPANY_ALIASES: Readonly<Record<CompanyColumn, readonly string[]>> = {
  symbol: IDENTITY_ALIASES.symbol,
  name: ["name", "company", "company_name", "name_of_company"],
  sector: ["sector"],
  industry: ["industry", "sub_sector", "subsector"],
  isin: ["isin", "isin_code"],
  company_type: ["company_type", "type", "entity_type"],
  statement_basis: ["statement_basis", "basis", "consolidation"],
  fy_end_month: ["fy_end_month", "year_end_month", "fiscal_year_end_month", "fy_end"],
  price: ["price", "reference_price", "close", "closing_price", "cmp", "last_price"],
  price_date: ["price_date", "price_as_of", "close_date"],
  shares_outstanding: ["shares_outstanding", "shares", "shares_in_issue", "shares_crore", "no_of_shares"],
  face_value: ["face_value", "fv", "par_value"],
  market_cap: ["market_cap", "mcap", "market_capitalisation", "market_capitalization", "market cap (cr)"],
  source_note: ["source_note", "source", "data_source", "notes"],
  sample_note: ["sample_note"],
};

/** Columns that only a companies file has; their presence decides "companies" over "snapshot". */
export const COMPANY_ONLY_COLUMNS: readonly CompanyColumn[] = [
  "isin", "company_type", "statement_basis", "fy_end_month", "shares_outstanding", "face_value", "price_date",
];

/** Legacy snapshot ratio keys (v0 StockRow) that a companies file may also carry as snapshot values. */
export const SNAPSHOT_RATIO_KEYS: readonly string[] = (Object.keys(LEGACY_KEY_TO_METRIC) as (keyof typeof LEGACY_KEY_TO_METRIC)[])
  .filter((k) => k !== "price" && k !== "market_cap");

const SNAPSHOT_EXTRA_ALIASES: Readonly<Record<string, readonly string[]>> = {
  pe: ["pe", "p/e", "pe_ratio", "price_to_earnings"],
  eps: ["eps"],
  price_book: ["price_book", "pb", "p/b", "pb_ratio", "price_to_book"],
  roe: ["roe"],
  roce: ["roce"],
  debt_equity: ["debt_equity", "de", "d/e", "debt_to_equity"],
  debt_ebitda: ["debt_ebitda", "debt_to_ebitda"],
  dividend_yield: ["dividend_yield", "div_yield"],
  sales_growth: ["sales_growth", "revenue_growth"],
  profit_growth: ["profit_growth", "pat_growth", "earnings_growth"],
  fcf_yield: ["fcf_yield", "free_cash_flow_yield"],
};

// ── statement files ─────────────────────────────────────────────────────────
const ANNUAL_EXTRA: Partial<Record<AnnualField, readonly string[]>> = {
  revenue: ["revenue", "sales", "net_sales", "revenue_from_operations", "total_revenue_from_operations"],
  operating_expenses: ["operating_expenses", "opex", "expenses_excluding_interest_and_depreciation"],
  cogs: ["cogs", "cost_of_materials", "cost_of_goods_sold"],
  depreciation: ["depreciation", "d_and_a", "depreciation_and_amortization"],
  finance_cost: ["finance_cost", "finance_costs", "interest", "interest_cost"],
  exceptional_items: ["exceptional_items", "exceptional"],
  pbt: ["pbt", "profit_before_tax"],
  tax_expense: ["tax_expense", "tax", "total_tax"],
  net_profit: ["net_profit", "pat", "profit_after_tax"],
  net_profit_owners: ["net_profit_owners", "pat_owners", "profit_attributable_to_owners"],
  dividend_per_share: ["dividend_per_share", "dps"],
  equity_share_capital: ["equity_share_capital", "share_capital", "equity_capital"],
  other_equity: ["other_equity", "reserves", "reserves_and_surplus"],
  non_controlling_interest: ["non_controlling_interest", "nci", "minority_interest"],
  borrowings_non_current: ["borrowings_non_current", "long_term_borrowings", "non_current_borrowings"],
  borrowings_current: ["borrowings_current", "short_term_borrowings", "current_borrowings"],
  lease_liabilities: ["lease_liabilities", "leases"],
  total_assets: ["total_assets"],
  net_fixed_assets: ["net_fixed_assets", "net_block", "fixed_assets"],
  trade_receivables: ["trade_receivables", "receivables", "debtors"],
  cash_and_bank: ["cash_and_bank", "cash", "cash_and_equivalents"],
  shares_outstanding_ye: ["shares_outstanding_ye", "shares_outstanding", "shares_year_end"],
  cfo: ["cfo", "cash_from_operations", "operating_cash_flow"],
  capex: ["capex", "capital_expenditure"],
};

const QUARTER_EXTRA: Partial<Record<QuarterField, readonly string[]>> = {
  revenue: ["revenue", "sales", "net_sales"],
  net_profit: ["net_profit", "pat"],
  net_profit_owners: ["net_profit_owners", "pat_owners"],
};

const SHAREHOLDING_EXTRA: Partial<Record<ShareholdingField, readonly string[]>> = {
  promoter_pct: ["promoter_pct", "promoter", "promoters", "promoter_holding"],
  promoter_pledged_pct: ["promoter_pledged_pct", "pledged", "pledge", "pledged_pct", "promoter_pledge"],
  fii_pct: ["fii_pct", "fii", "fpi", "fii_holding", "fpi_holding"],
  dii_pct: ["dii_pct", "dii", "dii_holding"],
  num_shareholders: ["num_shareholders", "shareholders", "number_of_shareholders", "no_of_shareholders"],
};

/** Columns that annual rows may carry besides the fields. */
export type AnnualExtraColumn = "flags" | "statement_basis";
const ANNUAL_ROW_EXTRAS: Readonly<Record<AnnualExtraColumn, readonly string[]>> = {
  flags: ["flags", "period_flags", "flag"],
  statement_basis: ["statement_basis", "basis"],
};

// ── alias tables ────────────────────────────────────────────────────────────
export type AliasTable<K extends string> = ReadonlyMap<string, K>;

function addAll<K extends string>(map: Map<string, K>, target: K, names: readonly string[]): void {
  for (const name of names) {
    const key = normHeader(name);
    if (key && !map.has(key)) map.set(key, target);
  }
}

function buildFieldTable<F extends string>(
  identity: readonly IdentityColumn[],
  fields: readonly F[],
  info: Readonly<Record<F, { label: string; metricId: string }>>,
  extras: Partial<Record<F, readonly string[]>>,
  rowExtras: Readonly<Record<string, readonly string[]>> = {},
): AliasTable<F | IdentityColumn | string> {
  const map = new Map<string, F | IdentityColumn | string>();
  for (const id of identity) addAll(map, id, IDENTITY_ALIASES[id]);
  for (const [k, names] of Object.entries(rowExtras)) addAll(map, k, names);
  // Exact field names first, then extras, then labels and metric ids, so a field name always wins.
  for (const f of fields) addAll(map, f, [f]);
  for (const f of fields) addAll(map, f, extras[f] ?? []);
  for (const f of fields) addAll(map, f, [info[f].label, info[f].metricId]);
  return map;
}

export const ANNUAL_ALIASES = buildFieldTable<AnnualField>(
  ["symbol", "fiscal_year", "period_end"], ANNUAL_FIELDS, ANNUAL_FIELD_INFO, ANNUAL_EXTRA, ANNUAL_ROW_EXTRAS,
) as AliasTable<AnnualField | AnnualExtraColumn | IdentityColumn>;

export const QUARTER_ALIASES = buildFieldTable<QuarterField>(
  ["symbol", "period_end"], QUARTER_FIELDS, QUARTER_FIELD_INFO, QUARTER_EXTRA,
) as AliasTable<QuarterField | IdentityColumn>;

export const SHAREHOLDING_ALIASES = buildFieldTable<ShareholdingField>(
  ["symbol", "period_end"], SHAREHOLDING_FIELDS, SHAREHOLDING_FIELD_INFO, SHAREHOLDING_EXTRA,
) as AliasTable<ShareholdingField | IdentityColumn>;

/** Snapshot ratio columns in a companies file map to "snapshot:<legacy key>". */
export type SnapshotColumn = `snapshot:${string}`;

export const COMPANY_ALIASES_TABLE: AliasTable<CompanyColumn | SnapshotColumn> = (() => {
  const map = new Map<string, CompanyColumn | SnapshotColumn>();
  for (const [k, names] of Object.entries(COMPANY_ALIASES) as [CompanyColumn, readonly string[]][]) addAll(map, k, names);
  for (const key of SNAPSHOT_RATIO_KEYS) addAll(map, `snapshot:${key}` as SnapshotColumn, SNAPSHOT_EXTRA_ALIASES[key] ?? [key]);
  return map;
})();

/** Resolves a header against a table: exact normalised match first, then with units removed. */
export function resolveHeader<K extends string>(table: AliasTable<K>, header: string): K | null {
  return table.get(normHeader(header)) ?? table.get(normHeaderLoose(header)) ?? null;
}

export const SYMBOL_HEADER_KEYS: ReadonlySet<string> = new Set(IDENTITY_ALIASES.symbol.map(normHeader));
export const FISCAL_YEAR_HEADER_KEYS: ReadonlySet<string> = new Set(IDENTITY_ALIASES.fiscal_year.map(normHeader));
export const PERIOD_END_HEADER_KEYS: ReadonlySet<string> = new Set(IDENTITY_ALIASES.period_end.map(normHeader));

/** True when the header names one of the shareholding fields (not the identity columns). */
export function isShareholdingHeader(header: string): boolean {
  const k = resolveHeader(SHAREHOLDING_ALIASES, header);
  return k !== null && k !== "symbol" && k !== "period_end";
}

/** True when the header names a legacy snapshot ratio column (pe, roce, …). */
export function isSnapshotRatioHeader(header: string): boolean {
  const k = resolveHeader(COMPANY_ALIASES_TABLE, header);
  return k !== null && k.startsWith("snapshot:");
}

/** True when the header names a column that only a companies file carries. */
export function isCompanyOnlyHeader(header: string): boolean {
  const k = resolveHeader(COMPANY_ALIASES_TABLE, header);
  return k !== null && (COMPANY_ONLY_COLUMNS as readonly string[]).includes(k);
}

export function headerIs(header: string, keys: ReadonlySet<string>): boolean {
  return keys.has(normHeader(header)) || keys.has(normHeaderLoose(header));
}
