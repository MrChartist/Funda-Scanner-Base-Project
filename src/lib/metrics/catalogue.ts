// src/lib/metrics/catalogue.ts — the base metric catalogue (spec §C.3 and §C.4).
// Written in P0 and handed to WS3. Pure data: no clock, no randomness, no I/O.
//
// 92 curated base metrics are transcribed from §C.3. Line items (§C.4) are generated from
// ANNUAL_FIELD_INFO, QUARTER_FIELD_INFO and SHAREHOLDING_FIELD_INFO; a curated entry wins
// when ids match (sales, dps, cfo, capex, q_sales, promoter_holding, pledged_pct,
// fii_holding, dii_holding) and keeps its rawField.
import type {
  AnnualField, BaseMetricDef, Direction, FieldInfo, HistoryKind, Level, MetricCategory, MetricId,
  QuarterField, ShareholdingField, TypeFamily, Unit, Variant,
} from "@/lib/contracts";
import { ANNUAL_FIELD_INFO, QUARTER_FIELD_INFO, SHAREHOLDING_FIELD_INFO } from "@/lib/contracts";

/** Bump when a metric is added, removed or its formula changes (stored with saved screens). */
export const CATALOGUE_VERSION = "2026.1";

/** Number of curated base metrics in §C.3. */
export const CURATED_METRIC_COUNT = 92;

// ── Small vocabulary used by the table below ────────────────────────────────
type Applies = "All" | "NF" | "L" | "NF+L";

const APPLIES: Readonly<Record<Applies, readonly TypeFamily[]>> = {
  All: ["non_financial", "lender", "insurance"],
  NF: ["non_financial"],
  L: ["lender"],
  "NF+L": ["non_financial", "lender"],
};

/** Variant shorthand from the §C.3 legend. */
const VARIANT_CODES: Readonly<Record<string, Variant>> = {
  prev: "prev", ttm: "ttm",
  a3: "avg_3y", a5: "avg_5y", a10: "avg_10y", mn5: "min_5y", sd5: "stdev_5y",
  c3: "cagr_3y", c5: "cagr_5y", c10: "cagr_10y",
  s3: "cum_3y", s5: "cum_5y", s10: "cum_10y",
  d1q: "chg_1q", d1y: "chg_1y", d3y: "chg_3y",
};

function variantList(codes: string): readonly Variant[] {
  const out: Variant[] = [];
  for (const code of codes.split(/\s+/).filter(Boolean)) {
    const v = VARIANT_CODES[code];
    if (!v) throw new Error(`Unknown variant code "${code}" in catalogue`);
    out.push(v);
  }
  return out;
}

/** Null-code abbreviations used in §C.3, expanded for formula cards. */
const NULL_CODE_TEXT: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bNPD\b/g, "Not meaningful"],
  [/\bNNW\b/g, "Negative net worth"],
  [/\bEVN\b/g, "EV not positive"],
  [/\bNIC\b/g, "No interest cost"],
  [/\bTFI\b/g, "Too few inputs"],
  [/\bTFP\b/g, "Too few comparable companies"],
  [/\bMI\b/g, "Not provided"],
  [/\bLM\b/g, "Loss-making"],
  [/\bIH\b/g, "Not enough history"],
  [/\bTP\b/g, "Period not comparable"],
  [/\bNP\b/g, "Price not provided"],
];

const APPLIES_NOTE: Readonly<Record<Applies, string>> = {
  All: "",
  NF: " Not applicable to banks, NBFCs and insurers.",
  L: " Applies only to banks and NBFCs.",
  "NF+L": " Not applicable to insurers.",
};

function expandNulls(nulls: string, applies: Applies): string {
  let text = nulls.trim();
  for (const [re, label] of NULL_CODE_TEXT) text = text.replace(re, label);
  if (text && !text.endsWith(".")) text += ".";
  return `${text}${APPLIES_NOTE[applies]}`.trim();
}

interface Spec {
  id: MetricId;
  label: string;
  short: string;
  category: MetricCategory;
  /** "unit·dp·dir" in the §C.3 legend: unit ₹Cr ₹ % pp x d yrs n sc FY; dir ↑ ↓ ↔. */
  u: string;
  level: "B" | "I" | "A";
  applies: Applies;
  history: HistoryKind;
  ttm?: boolean;
  variants?: string;
  formula: string;
  nulls: string;
  tooltip: string;
  aliases?: readonly string[];
  rawField?: AnnualField | QuarterField | ShareholdingField;
  periodTag?: string;
  growthable?: boolean;
  isScore?: boolean;
}

const UNIT_CODES: Readonly<Record<string, Unit>> = {
  "₹Cr": "inr_cr", "₹": "inr", "%": "pct", pp: "pp", x: "x", d: "days", yrs: "years", n: "count", sc: "score", FY: "fy_year",
};
const DIR_CODES: Readonly<Record<string, Direction>> = { "↑": "higher", "↓": "lower", "↔": "neutral" };
const LEVEL_CODES: Readonly<Record<Spec["level"], Level>> = { B: "basic", I: "intermediate", A: "advanced" };

function parseUnitSpec(id: string, u: string): { unit: Unit; decimals: number; direction: Direction } {
  const [uc, dp, dc] = u.split("·");
  const unit = UNIT_CODES[uc];
  const direction = DIR_CODES[dc];
  const decimals = Number(dp);
  if (!unit || !direction || !Number.isInteger(decimals)) throw new Error(`Bad unit spec "${u}" for ${id}`);
  return { unit, decimals, direction };
}

function defaultPeriodTag(history: HistoryKind): string {
  switch (history) {
    case "annual": return "FY";
    case "quarterly": return "Latest qtr";
    case "shareholding": return "Latest qtr";
    case "latest_only": return "Latest";
  }
}

function fromSpec(s: Spec): BaseMetricDef {
  const { unit, decimals, direction } = parseUnitSpec(s.id, s.u);
  return {
    id: s.id,
    label: s.label,
    short: s.short,
    aliases: s.aliases ?? [],
    category: s.category,
    unit,
    decimals,
    direction,
    level: LEVEL_CODES[s.level],
    appliesTo: APPLIES[s.applies],
    history: s.history,
    ttm: s.ttm ?? false,
    growthable: s.growthable ?? false,
    variants: variantList(s.variants ?? ""),
    rawField: s.rawField ?? null,
    periodTag: s.periodTag ?? defaultPeriodTag(s.history),
    formula: s.formula,
    tooltip: s.tooltip,
    nullRules: expandNulls(s.nulls, s.applies),
    isScore: s.isScore ?? false,
  };
}

// ── §C.3 curated base metrics (92) ──────────────────────────────────────────
const A: HistoryKind = "annual";
const Q: HistoryKind = "quarterly";
const S: HistoryKind = "shareholding";
const Lt: HistoryKind = "latest_only";

const CURATED_SPECS: readonly Spec[] = [
  // Size (11)
  { id: "market_cap", label: "Market capitalisation", short: "Mkt cap", category: "Size", u: "₹Cr·0·↔", level: "B", applies: "All", history: Lt,
    formula: "price × shares_outstanding; else market_cap_supplied (Provided)", nulls: "NP; MI",
    tooltip: "What the stock market values the whole company at: share price × number of shares.", aliases: ["market cap", "mcap"] },
  { id: "price", label: "Reference price", short: "Price", category: "Size", u: "₹·2·↔", level: "B", applies: "All", history: Lt,
    formula: "market.price as supplied", nulls: "NP",
    tooltip: "Closing price supplied with your data; not a live quote.", aliases: ["share price"] },
  { id: "enterprise_value", label: "Enterprise value", short: "EV", category: "Size", u: "₹Cr·0·↔", level: "I", applies: "NF", history: Lt,
    formula: "market_cap + total_debt + NCI − cash_like (latest FY)", nulls: "NP, MI",
    tooltip: "Market value plus debt, minus spare cash: the rough cost of buying the whole business." },
  { id: "sales", label: "Sales", short: "Sales", category: "Size", u: "₹Cr·0·↑", level: "B", applies: "All", history: A, ttm: true,
    variants: "prev ttm c3 c5 c10", formula: "revenue (rawField); TTM Σ4q", nulls: "MI", rawField: "revenue", growthable: true,
    tooltip: "Money earned from the main business in the period, before any costs.",
    aliases: ["revenue", "revenue from operations", "turnover", "net sales"] },
  { id: "ebitda", label: "Operating profit", short: "EBITDA", category: "Size", u: "₹Cr·0·↑", level: "I", applies: "NF", history: A, ttm: true,
    variants: "prev ttm c3 c5 c10", formula: "revenue − operating_expenses", nulls: "MI", growthable: true,
    tooltip: "Profit from the core business before depreciation, interest and tax; other income is left out." },
  { id: "ebit", label: "EBIT", short: "EBIT", category: "Size", u: "₹Cr·0·↑", level: "I", applies: "NF", history: A,
    variants: "prev", formula: "ebitda + other_income − depreciation", nulls: "MI", growthable: true,
    tooltip: "Profit before interest and tax.", aliases: ["earnings before interest tax"] },
  { id: "net_profit", label: "Net profit", short: "Net profit", category: "Size", u: "₹Cr·0·↑", level: "B", applies: "All", history: A, ttm: true,
    variants: "prev ttm c3 c5 c10 s5", formula: "owners_pat; TTM Σ4q (owners ?? PAT)", nulls: "MI", growthable: true,
    tooltip: "Profit left for shareholders after all expenses, interest and tax.", aliases: ["profit", "earnings"] },
  { id: "net_worth", label: "Net worth", short: "Net worth", category: "Size", u: "₹Cr·0·↑", level: "B", applies: "All", history: A,
    variants: "prev", formula: "equity_share_capital + other_equity", nulls: "MI (negative shown)", growthable: true,
    tooltip: "What shareholders own on paper: assets minus all liabilities.", aliases: ["book value", "shareholders funds"] },
  { id: "total_debt", label: "Total debt incl. leases", short: "Debt", category: "Size", u: "₹Cr·0·↓", level: "B", applies: "NF", history: A,
    variants: "prev", formula: "borrowings_nc + borrowings_c + lease_liabilities", nulls: "MI", growthable: true,
    tooltip: "All borrowings, including lease obligations.", aliases: ["borrowings", "total borrowings"] },
  { id: "net_debt", label: "Net debt", short: "Net debt", category: "Size", u: "₹Cr·0·↓", level: "I", applies: "NF", history: A,
    variants: "prev", formula: "total_debt − cash_like (NetCash if < 0)", nulls: "MI",
    tooltip: "Debt left after using spare cash; a negative figure means net cash." },
  { id: "capital_employed", label: "Capital employed", short: "Capital employed", category: "Size", u: "₹Cr·0·↔", level: "I", applies: "NF", history: A,
    formula: "total_equity + total_debt", nulls: "MI", growthable: true,
    tooltip: "Long-term money from shareholders and lenders." },

  // Valuation (10, all latest only)
  { id: "pe", label: "Price to earnings", short: "P/E", category: "Valuation", u: "x·1·↓", level: "B", applies: "All", history: Lt, periodTag: "TTM",
    formula: "market_cap / net_profit_ttm (FyFallback)", nulls: "LM (≤ 0), NP",
    tooltip: "Years of current profit you pay for the share; lower is cheaper, other things being equal.",
    aliases: ["pe ratio", "price earnings", "price earnings ratio"] },
  { id: "pb", label: "Price to book", short: "P/B", category: "Valuation", u: "x·2·↓", level: "B", applies: "All", history: Lt,
    formula: "market_cap / net_worth (latest FY)", nulls: "NNW, NP",
    tooltip: "Market value compared with shareholders' book value.", aliases: ["pb ratio", "price book", "price to book value"] },
  { id: "price_to_sales", label: "Price to sales", short: "P/S", category: "Valuation", u: "x·2·↓", level: "I", applies: "NF", history: Lt, periodTag: "TTM",
    formula: "market_cap / sales_ttm (FyFallback)", nulls: "NPD, NP",
    tooltip: "Market value for every rupee of yearly sales.", aliases: ["ps ratio", "price sales"] },
  { id: "ev_ebitda", label: "EV / EBITDA", short: "EV/EBITDA", category: "Valuation", u: "x·1·↓", level: "I", applies: "NF", history: Lt, periodTag: "TTM",
    formula: "enterprise_value / ebitda_ttm (FyFallback)", nulls: "EVN, NPD",
    tooltip: "Value of the whole business compared with its operating profit.", aliases: ["ev to ebitda", "enterprise value to ebitda"] },
  { id: "earnings_yield", label: "Earnings yield (EBIT / EV)", short: "Earnings yield", category: "Valuation", u: "%·1·↑", level: "I", applies: "NF", history: Lt, periodTag: "TTM",
    formula: "op_ebit_ttm / EV × 100; op_ebit_ttm = Σ4q (rev − opex − dep), FY fallback", nulls: "EVN; negative kept",
    tooltip: "Operating profit as a percentage of the business's total value.", aliases: ["ebit yield"] },
  { id: "earnings_to_price", label: "Earnings to price", short: "E/P", category: "Valuation", u: "%·1·↑", level: "I", applies: "All", history: Lt, periodTag: "TTM",
    formula: "net_profit_ttm / market_cap × 100", nulls: "NP; negative kept",
    tooltip: "Net profit as a percentage of market value; the inverse of P/E, defined for losses too." },
  { id: "fcf_yield", label: "FCF yield", short: "FCF yield", category: "Valuation", u: "%·1·↑", level: "I", applies: "NF", history: Lt,
    formula: "fcf (latest FY) / market_cap × 100", nulls: "MI, NP; negative kept",
    tooltip: "Latest year's free cash flow as a percentage of market value.", aliases: ["free cash flow yield"] },
  { id: "fcf_yield_3y", label: "FCF yield (3Y average FCF)", short: "FCF yield 3Y", category: "Valuation", u: "%·1·↑", level: "I", applies: "NF", history: Lt, periodTag: "3Y",
    formula: "mean(fcf, latest 3 FY) / market_cap × 100", nulls: "IH (all 3 needed), NP",
    tooltip: "Three-year average free cash flow against market value; steadier than one year." },
  { id: "peg", label: "PEG ratio", short: "PEG", category: "Valuation", u: "x·2·↓", level: "I", applies: "NF+L", history: Lt,
    formula: "pe / eps_cagr_3y", nulls: "null if pe null; NPD if CAGR ≤ 0 or null",
    tooltip: "P/E divided by 3-year EPS growth; around 1 or lower suggests a reasonable price for the growth." },
  { id: "price_to_graham", label: "Price to Graham number", short: "P/Graham", category: "Valuation", u: "x·2·↓", level: "A", applies: "NF", history: Lt,
    formula: "price / √(22.5 × eps_ttm × bvps)", nulls: "LM (eps ≤ 0), NNW (bvps ≤ 0)",
    tooltip: "Below 1 means the price is under Graham's conservative ceiling based on earnings and book value." },

  // Profitability (9, annual)
  { id: "roce", label: "Return on capital employed", short: "ROCE", category: "Profitability", u: "%·1·↑", level: "B", applies: "NF", history: A,
    variants: "prev a3 a5 a10 mn5", formula: "ebit / avg(capital_employed) × 100", nulls: "NPD (avg CE ≤ 0)",
    tooltip: "Pre-tax return on all money from shareholders and lenders." },
  { id: "roic", label: "Return on invested capital", short: "ROIC", category: "Profitability", u: "%·1·↑", level: "I", applies: "NF", history: A,
    variants: "prev a3 a5", formula: "op_ebit × (1 − tax_rate) / avg(invested_capital) × 100", nulls: "NPD (net-cash business)",
    tooltip: "After-tax return on the capital actually used in operations, leaving out spare cash." },
  { id: "roe", label: "Return on equity", short: "ROE", category: "Profitability", u: "%·1·↑", level: "B", applies: "All", history: A,
    variants: "prev a3 a5 a10 mn5", formula: "owners_pat / avg(net_worth) × 100", nulls: "NNW (avg ≤ 0)",
    tooltip: "Profit earned for shareholders on the money they have in the business." },
  { id: "roa", label: "Return on assets", short: "ROA", category: "Profitability", u: "%·2·↑", level: "I", applies: "All", history: A,
    variants: "prev a3 a5", formula: "pat / avg(total_assets) × 100", nulls: "NPD",
    tooltip: "Profit earned on everything the company owns; a key measure for banks." },
  { id: "opm", label: "Operating profit margin", short: "OPM", category: "Profitability", u: "%·1·↑", level: "B", applies: "NF", history: A, ttm: true,
    variants: "prev ttm a3 a5 sd5", formula: "ebitda / revenue × 100; TTM ebitda_ttm / sales_ttm", nulls: "NPD (revenue ≤ 0)",
    tooltip: "Share of sales left as operating profit after running costs.", aliases: ["operating margin", "ebitda margin"] },
  { id: "gross_margin", label: "Gross margin", short: "Gross margin", category: "Profitability", u: "%·1·↑", level: "I", applies: "NF", history: A,
    variants: "prev a5", formula: "(revenue − cogs) / revenue × 100", nulls: "MI if cogs null (never 0)",
    tooltip: "Share of sales left after paying for the goods sold." },
  { id: "npm", label: "Net profit margin", short: "NPM", category: "Profitability", u: "%·1·↑", level: "B", applies: "All", history: A, ttm: true,
    variants: "prev ttm a5", formula: "pat / revenue × 100", nulls: "NPD",
    tooltip: "Share of each rupee of sales that ends up as net profit.", aliases: ["net margin", "profit margin"] },
  { id: "effective_tax_rate", label: "Effective tax rate", short: "Eff. tax rate", category: "Profitability", u: "%·1·↔", level: "I", applies: "All", history: A,
    variants: "prev a3", formula: "tax_expense / pbt × 100", nulls: "LM (pbt ≤ 0)",
    tooltip: "Share of pre-tax profit paid as tax.", aliases: ["tax rate"] },
  { id: "other_income_to_pbt", label: "Other income share of PBT", short: "Other income % PBT", category: "Profitability", u: "%·1·↓", level: "I", applies: "NF", history: A,
    variants: "a3", formula: "other_income / pbt × 100", nulls: "LM (pbt ≤ 0)",
    tooltip: "How much of the profit comes from interest, dividends and other non-core income." },

  // Efficiency (7, annual)
  { id: "asset_turnover", label: "Asset turnover", short: "Asset turnover", category: "Efficiency", u: "x·2·↑", level: "I", applies: "NF", history: A,
    variants: "prev a5", formula: "revenue / avg(total_assets)", nulls: "NPD",
    tooltip: "Sales produced for every rupee of assets." },
  { id: "fixed_asset_turnover", label: "Fixed asset turnover", short: "FA turnover", category: "Efficiency", u: "x·2·↑", level: "A", applies: "NF", history: A,
    variants: "prev", formula: "revenue / avg(net_fixed_assets)", nulls: "MI, NPD",
    tooltip: "Sales for every rupee in plant, machinery and other fixed assets." },
  { id: "debtor_days", label: "Debtor days", short: "Debtor days", category: "Efficiency", u: "d·0·↓", level: "I", applies: "NF", history: A,
    variants: "prev a5", formula: "trade_receivables / revenue × 365", nulls: "MI, NPD",
    tooltip: "Average number of days customers take to pay.", aliases: ["receivable days", "receivables days"] },
  { id: "inventory_days", label: "Inventory days", short: "Inventory days", category: "Efficiency", u: "d·0·↓", level: "I", applies: "NF", history: A,
    variants: "prev", formula: "inventories / cogs × 365; cogs null → on revenue (SalesBasis)", nulls: "MI (inventories null; explicit 0 → 0), NPD",
    tooltip: "Days of stock the company holds.", aliases: ["stock days"] },
  { id: "payable_days", label: "Payable days", short: "Payable days", category: "Efficiency", u: "d·0·↔", level: "I", applies: "NF", history: A,
    variants: "prev", formula: "trade_payables / cogs × 365 (SalesBasis fallback)", nulls: "MI, NPD",
    tooltip: "Average number of days the company takes to pay its suppliers.", aliases: ["creditor days"] },
  { id: "cash_conversion_cycle", label: "Cash conversion cycle", short: "CCC", category: "Efficiency", u: "d·0·↓", level: "I", applies: "NF", history: A,
    variants: "prev", formula: "debtor + inventory − payable days (Approximate if any part on sales basis)", nulls: "MI if any part null",
    tooltip: "Days between paying for inputs and collecting cash from customers; negative is valid." },
  { id: "working_capital_days", label: "Working capital days", short: "WC days", category: "Efficiency", u: "d·0·↓", level: "I", applies: "NF", history: A,
    variants: "prev a3", formula: "((TCA − cash_like) − (TCL − borrowings_current)) / revenue × 365", nulls: "MI, NPD",
    tooltip: "Days of sales tied up in day-to-day operations; negative is valid." },

  // Leverage & Liquidity (9, annual)
  { id: "debt_equity", label: "Debt to equity", short: "D/E", category: "Leverage & Liquidity", u: "x·2·↓", level: "B", applies: "NF", history: A,
    variants: "prev", formula: "total_debt / total_equity", nulls: "NNW (≤ 0); 0 = debt-free",
    tooltip: "Borrowings for every rupee of shareholders' money.", aliases: ["debt to equity ratio", "gearing"] },
  { id: "debt_equity_ex_leases", label: "D/E excl. leases", short: "D/E excl. leases", category: "Leverage & Liquidity", u: "x·2·↓", level: "A", applies: "NF", history: A,
    formula: "(total_debt − lease_liabilities) / total_equity", nulls: "NNW",
    tooltip: "Debt to equity without lease obligations; closer to what companies usually report." },
  { id: "net_debt_equity", label: "Net debt to equity", short: "Net D/E", category: "Leverage & Liquidity", u: "x·2·↓", level: "I", applies: "NF", history: A,
    formula: "net_debt / total_equity", nulls: "NNW",
    tooltip: "Borrowings less spare cash, against shareholders' money; negative means net cash." },
  { id: "debt_ebitda", label: "Debt to EBITDA", short: "Debt/EBITDA", category: "Leverage & Liquidity", u: "x·2·↓", level: "I", applies: "NF", history: A,
    variants: "prev", formula: "total_debt / ebitda; 0 when total_debt = 0", nulls: "NPD (ebitda ≤ 0 with debt > 0)",
    tooltip: "Years of operating profit needed to repay all debt." },
  { id: "net_debt_ebitda", label: "Net debt to EBITDA", short: "Net debt/EBITDA", category: "Leverage & Liquidity", u: "x·2·↓", level: "I", applies: "NF", history: A,
    formula: "net_debt / ebitda", nulls: "NPD (ebitda ≤ 0)",
    tooltip: "Years of operating profit to repay debt after using spare cash; negative means net cash." },
  { id: "interest_coverage", label: "Interest coverage", short: "Int. coverage", category: "Leverage & Liquidity", u: "x·1·↑", level: "B", applies: "NF", history: A,
    variants: "prev", formula: "ebit / finance_cost", nulls: "NIC (finance_cost = 0), MI",
    tooltip: "How many times operating profit covers interest; below 1.5 is a warning sign.", aliases: ["interest cover", "icr"] },
  { id: "current_ratio", label: "Current ratio", short: "Current ratio", category: "Leverage & Liquidity", u: "x·2·↑", level: "B", applies: "NF", history: A,
    variants: "prev", formula: "TCA / TCL", nulls: "MI, NPD",
    tooltip: "Short-term assets compared with bills due within a year." },
  { id: "quick_ratio", label: "Quick ratio", short: "Quick ratio", category: "Leverage & Liquidity", u: "x·2·↑", level: "A", applies: "NF", history: A,
    formula: "(TCA − inventories) / TCL", nulls: "MI (incl. inventories null), NPD",
    tooltip: "Current ratio without stock, which can be slow to turn into cash.", aliases: ["acid test ratio"] },
  { id: "equity_multiplier", label: "Equity multiplier", short: "Equity multiplier", category: "Leverage & Liquidity", u: "x·2·↔", level: "A", applies: "All", history: A,
    formula: "avg(total_assets) / avg(total_equity)", nulls: "NNW",
    tooltip: "Assets for every rupee of equity; part of the DuPont breakdown of ROE." },

  // Growth (7)
  { id: "sales_growth", label: "Sales growth (FY YoY)", short: "Sales growth", category: "Growth", u: "%·1·↑", level: "B", applies: "All", history: A,
    variants: "prev", formula: "(revenue_t / revenue_t−1 − 1) × 100", nulls: "NPD (prev ≤ 0), TP, IH",
    tooltip: "How much sales rose or fell compared with the previous financial year.", aliases: ["revenue growth"] },
  { id: "profit_growth", label: "Net profit growth (FY YoY)", short: "Profit growth", category: "Growth", u: "%·1·↑", level: "B", applies: "All", history: A,
    variants: "prev", formula: "owners_pat YoY", nulls: "NPD (+Turnaround if prev ≤ 0 < now), TP, IH",
    tooltip: "Change in net profit compared with the previous financial year.", aliases: ["earnings growth", "pat growth"] },
  { id: "ttm_sales_growth", label: "Sales growth (TTM vs previous TTM)", short: "Sales growth TTM", category: "Growth", u: "%·1·↑", level: "I", applies: "All", history: Lt, periodTag: "TTM",
    formula: "sales[ttm] / sales[ttm-1] − 1", nulls: "IH (8 consecutive quarters), NPD",
    tooltip: "Sales in the latest 12 months against the 12 months before." },
  { id: "ttm_profit_growth", label: "Net profit growth (TTM)", short: "Profit growth TTM", category: "Growth", u: "%·1·↑", level: "I", applies: "All", history: Lt, periodTag: "TTM",
    formula: "net_profit[ttm] / net_profit[ttm-1] − 1", nulls: "IH, NPD (+Turnaround)",
    tooltip: "Net profit in the latest 12 months against the 12 months before." },
  { id: "q_sales_yoy", label: "Quarterly sales growth (YoY)", short: "Qtr sales YoY", category: "Growth", u: "%·1·↑", level: "I", applies: "All", history: Q,
    formula: "q_sales[q] / q_sales[q-4] − 1 (date-matched)", nulls: "IH, NPD",
    tooltip: "Latest quarter's sales against the same quarter last year." },
  { id: "q_profit_yoy", label: "Quarterly profit growth (YoY)", short: "Qtr profit YoY", category: "Growth", u: "%·1·↑", level: "I", applies: "All", history: Q,
    formula: "q_net_profit YoY", nulls: "IH, NPD (+Turnaround)",
    tooltip: "Latest quarter's net profit against the same quarter last year." },
  { id: "q_opm_change_yoy", label: "Quarterly OPM change (YoY)", short: "Qtr OPM change YoY", category: "Growth", u: "pp·1·↑", level: "A", applies: "NF", history: Q,
    formula: "q_opm[q] − q_opm[q-4]", nulls: "IH",
    tooltip: "Whether the operating margin widened or narrowed against the same quarter last year." },

  // Quarterly results (4, category "Line items")
  { id: "q_sales", label: "Quarterly sales", short: "Qtr sales", category: "Line items", u: "₹Cr·0·↑", level: "I", applies: "All", history: Q,
    variants: "prev", formula: "quarterly revenue (rawField)", nulls: "MI", rawField: "revenue",
    tooltip: "Sales in one quarter." },
  { id: "q_operating_profit", label: "Quarterly operating profit", short: "Qtr op. profit", category: "Line items", u: "₹Cr·0·↑", level: "A", applies: "NF", history: Q,
    variants: "prev", formula: "q revenue − q operating_expenses", nulls: "MI",
    tooltip: "Operating profit in one quarter." },
  { id: "q_opm", label: "Quarterly OPM", short: "Qtr OPM", category: "Line items", u: "%·1·↑", level: "A", applies: "NF", history: Q,
    variants: "prev", formula: "q_operating_profit / q_sales × 100", nulls: "NPD",
    tooltip: "Operating margin in one quarter." },
  { id: "q_net_profit", label: "Quarterly net profit", short: "Qtr net profit", category: "Line items", u: "₹Cr·0·↑", level: "I", applies: "All", history: Q,
    variants: "prev", formula: "q net_profit_owners ?? q net_profit", nulls: "MI",
    tooltip: "Net profit for shareholders in one quarter." },

  // Cash Flow (9, annual)
  { id: "cfo", label: "Cash from operations", short: "CFO", category: "Cash Flow", u: "₹Cr·0·↑", level: "B", applies: "All", history: A,
    variants: "prev s3 s5 s10", formula: "as reported", nulls: "MI; IH for sums", rawField: "cfo", growthable: true,
    tooltip: "Cash produced by day-to-day operations.", aliases: ["operating cash flow", "cash flow from operations"] },
  { id: "capex", label: "Capital expenditure", short: "Capex", category: "Cash Flow", u: "₹Cr·0·↔", level: "A", applies: "NF", history: A,
    variants: "prev s5", formula: "as reported (positive)", nulls: "MI", rawField: "capex", growthable: true,
    tooltip: "Money spent on new fixed assets." },
  { id: "fcf", label: "Free cash flow", short: "FCF", category: "Cash Flow", u: "₹Cr·0·↑", level: "B", applies: "NF", history: A,
    variants: "prev s3 s5 s10", formula: "cfo − capex", nulls: "MI",
    tooltip: "Cash left after the investment needed to keep and grow the business." },
  { id: "cfo_to_pat", label: "CFO to net profit", short: "CFO/PAT", category: "Cash Flow", u: "x·2·↑", level: "I", applies: "NF", history: A,
    variants: "prev", formula: "cfo / pat", nulls: "LM (pat ≤ 0)",
    tooltip: "How much of reported profit came in as cash; around 1 or above is healthy." },
  { id: "cum_cfo_to_pat_5y", label: "CFO to net profit (5Y cumulative)", short: "CFO/PAT 5Y", category: "Cash Flow", u: "x·2·↑", level: "I", applies: "NF", history: A, periodTag: "5Y",
    formula: "Σcfo / Σpat over the 5 FYs ending at the offset", nulls: "IH (all 5 of both needed), LM (Σpat ≤ 0)",
    tooltip: "Over five years, how much of reported profit came in as cash; smooths yearly swings." },
  { id: "cfo_to_ebitda", label: "CFO to EBITDA", short: "CFO/EBITDA", category: "Cash Flow", u: "%·0·↑", level: "A", applies: "NF", history: A,
    formula: "cfo / ebitda × 100", nulls: "NPD (ebitda ≤ 0)",
    tooltip: "Share of operating profit that turned into operating cash." },
  { id: "capex_to_sales", label: "Capex intensity", short: "Capex/Sales", category: "Cash Flow", u: "%·1·↔", level: "A", applies: "NF", history: A,
    variants: "a3", formula: "capex / revenue × 100", nulls: "NPD",
    tooltip: "Share of sales spent on new fixed assets." },
  { id: "capex_to_depreciation", label: "Capex to depreciation", short: "Capex/Dep.", category: "Cash Flow", u: "x·2·↔", level: "A", applies: "NF", history: A,
    formula: "capex / depreciation", nulls: "NPD",
    tooltip: "Whether investment exceeds the wear and tear of existing assets." },
  { id: "accruals_ratio", label: "Accruals ratio", short: "Accruals ratio", category: "Cash Flow", u: "%·1·↓", level: "A", applies: "NF", history: A,
    formula: "(pat − cfo) / avg(total_assets) × 100", nulls: "NPD",
    tooltip: "Profit not backed by cash, as a share of assets; lower suggests better-quality earnings." },

  // Shareholding (6, S grid, all families)
  { id: "promoter_holding", label: "Promoter holding", short: "Promoter", category: "Shareholding", u: "%·2·↔", level: "B", applies: "All", history: S,
    variants: "prev d1q d1y d3y", formula: "promoter_pct", nulls: "MI", rawField: "promoter_pct",
    tooltip: "Share of the company owned by its founders or controlling group.", aliases: ["promoter stake", "promoters"] },
  { id: "pledged_pct", label: "Promoter pledge (% of promoter holding)", short: "Pledge", category: "Shareholding", u: "%·2·↓", level: "B", applies: "All", history: S,
    variants: "d1q d1y", formula: "promoter_pledged_pct", nulls: "MI; NPD when promoter_pct = 0", rawField: "promoter_pledged_pct",
    tooltip: "Share of promoters' holding given as security for loans.", aliases: ["promoter pledge", "pledged"] },
  { id: "pledged_pct_of_total", label: "Pledged shares (% of all shares)", short: "Pledge % total", category: "Shareholding", u: "%·2·↓", level: "A", applies: "All", history: S,
    formula: "promoter_pct × pledged / 100", nulls: "MI",
    tooltip: "Pledged promoter shares as a share of all shares." },
  { id: "fii_holding", label: "FII / FPI holding", short: "FII", category: "Shareholding", u: "%·2·↔", level: "I", applies: "All", history: S,
    variants: "d1q d1y d3y", formula: "fii_pct", nulls: "MI", rawField: "fii_pct",
    tooltip: "Share owned by foreign portfolio investors.", aliases: ["fpi holding", "fii holding"] },
  { id: "dii_holding", label: "DII holding", short: "DII", category: "Shareholding", u: "%·2·↔", level: "I", applies: "All", history: S,
    variants: "d1q d1y d3y", formula: "dii_pct", nulls: "MI", rawField: "dii_pct",
    tooltip: "Share owned by Indian institutions such as mutual funds and insurers." },
  { id: "public_holding", label: "Public and others", short: "Public", category: "Shareholding", u: "%·2·↔", level: "I", applies: "All", history: S,
    formula: "max(0, 100 − promoter − fii − dii)", nulls: "MI if any input null",
    tooltip: "Share held by everyone other than promoters and institutions (approximate).", aliases: ["public holding"] },

  // Dividend and Per Share (6, all families)
  { id: "dps", label: "Dividend per share", short: "DPS", category: "Dividend", u: "₹·2·↑", level: "B", applies: "All", history: A,
    variants: "prev c3 c5 c10", formula: "dividend_per_share", nulls: "MI (missing is never 0)", rawField: "dividend_per_share", growthable: true,
    tooltip: "Cash dividend declared for each share for the year." },
  { id: "dividend_yield", label: "Dividend yield", short: "Div. yield", category: "Dividend", u: "%·2·↑", level: "B", applies: "All", history: Lt,
    formula: "dps (latest FY) / price × 100", nulls: "MI, NP",
    tooltip: "Yearly dividend as a percentage of the share price." },
  { id: "dividend_payout", label: "Dividend payout", short: "Payout", category: "Dividend", u: "%·1·↔", level: "I", applies: "All", history: A,
    variants: "prev a3 a5", formula: "dps × shares_ye / owners_pat × 100 (PayoutOver100)", nulls: "LM, MI",
    tooltip: "Share of profit paid out as dividends.", aliases: ["payout ratio"] },
  { id: "dividend_streak", label: "Years of dividend in a row", short: "Dividend streak", category: "Dividend", u: "yrs·0·↑", level: "I", applies: "All", history: Lt,
    formula: "consecutive latest FYs with dps > 0 (LimitOfData if all supplied years)", nulls: "MI (latest dps null)",
    tooltip: "How many years in a row the company has paid a dividend." },
  { id: "eps", label: "Earnings per share", short: "EPS", category: "Per Share", u: "₹·2·↑", level: "B", applies: "All", history: A, ttm: true,
    variants: "prev ttm c3 c5 c10", formula: "owners_pat / shares_ye; TTM net_profit_ttm / shares_outstanding", nulls: "MI; Approximate if shares_ye missing", growthable: true,
    tooltip: "Profit earned for each share." },
  { id: "bvps", label: "Book value per share", short: "BVPS", category: "Per Share", u: "₹·2·↑", level: "B", applies: "All", history: A,
    variants: "prev c3 c5 c10", formula: "net_worth / shares_ye", nulls: "MI", growthable: true,
    tooltip: "Shareholders' book value for each share." },

  // Banking & NBFC (9, lenders)
  { id: "nii", label: "Net interest income", short: "NII", category: "Banking & NBFC", u: "₹Cr·0·↑", level: "I", applies: "L", history: A,
    variants: "prev c3 c5", formula: "revenue − interest_expended", nulls: "MI", growthable: true,
    tooltip: "Interest earned on loans minus interest paid on deposits and borrowings." },
  { id: "nim_approx", label: "NIM (approx., on total assets)", short: "NIM", category: "Banking & NBFC", u: "%·2·↑", level: "I", applies: "L", history: A,
    variants: "prev a3", formula: "nii / avg(total_assets) × 100 (Approximate always)", nulls: "NPD",
    tooltip: "Interest spread earned on the lender's balance sheet (approximation).", aliases: ["net interest margin"] },
  { id: "ppop", label: "Pre-provision operating profit", short: "PPOP", category: "Banking & NBFC", u: "₹Cr·0·↑", level: "A", applies: "L", history: A,
    variants: "prev", formula: "nii + other_income − operating_expenses", nulls: "MI", growthable: true,
    tooltip: "A lender's operating profit before provisions for bad loans." },
  { id: "cost_to_income", label: "Cost to income", short: "Cost/income", category: "Banking & NBFC", u: "%·1·↓", level: "I", applies: "L", history: A,
    variants: "prev", formula: "operating_expenses / (nii + other_income) × 100", nulls: "NPD",
    tooltip: "Share of a lender's income spent on running costs.", aliases: ["cost income ratio"] },
  { id: "credit_cost", label: "Credit cost", short: "Credit cost", category: "Banking & NBFC", u: "%·2·↓", level: "A", applies: "L", history: A,
    variants: "prev a3", formula: "provisions_contingencies / avg(advances) × 100", nulls: "MI, NPD",
    tooltip: "Money set aside for bad loans as a share of the loan book." },
  { id: "gnpa_ratio", label: "Gross NPA ratio", short: "GNPA", category: "Banking & NBFC", u: "%·2·↓", level: "I", applies: "L", history: A,
    variants: "prev", formula: "gross_npa / (advances + gross_npa − net_npa) × 100", nulls: "MI, NPD",
    tooltip: "Share of loans that have stopped paying." },
  { id: "nnpa_ratio", label: "Net NPA ratio", short: "NNPA", category: "Banking & NBFC", u: "%·2·↓", level: "I", applies: "L", history: A,
    variants: "prev", formula: "net_npa / advances × 100", nulls: "MI, NPD",
    tooltip: "Bad loans left after provisions, as a share of the loan book." },
  { id: "provision_coverage", label: "Provision coverage", short: "PCR", category: "Banking & NBFC", u: "%·1·↑", level: "I", applies: "L", history: A,
    formula: "(gross_npa − net_npa) / gross_npa × 100", nulls: "NPD when gross_npa = 0 (UI \"No NPAs\")",
    tooltip: "How much of the bad loans the lender has already provided for.", aliases: ["provision coverage ratio"] },
  { id: "p_abv", label: "Price to adjusted book value", short: "P/ABV", category: "Banking & NBFC", u: "x·2·↓", level: "A", applies: "L", history: Lt,
    formula: "market_cap / (net_worth − net_npa)", nulls: "NPD, NP",
    tooltip: "P/B after deducting bad loans not yet provided for." },

  // Scores & Checks, and Data (5, latest only)
  { id: "piotroski_f", label: "Piotroski F-score", short: "Piotroski F", category: "Scores & Checks", u: "sc·0·↑", level: "I", applies: "NF", history: Lt,
    formula: "9 criteria (§C.6)", nulls: "TFI unless all 9 evaluable", isScore: true,
    tooltip: "Nine yes/no tests of profitability, balance sheet and efficiency; 8–9 strong, 0–3 weak.", aliases: ["piotroski", "f score"] },
  { id: "altman_z", label: "Altman Z'' score", short: "Altman Z''", category: "Scores & Checks", u: "sc·2·↑", level: "I", applies: "NF", history: Lt,
    formula: "Z'' = 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4 (§C.6)", nulls: "MI, NPD", isScore: true,
    tooltip: "A balance-sheet distress screen; above 2.6 is the safe zone, below 1.1 the distress zone.", aliases: ["altman", "z score"] },
  { id: "red_flag_count", label: "Red flags triggered", short: "Red flags", category: "Scores & Checks", u: "n·0·↓", level: "I", applies: "All", history: Lt,
    formula: "count of the family's red-flag rules that are met (§C.9; provided by WS2)", nulls: "TFI when more than 4 rules are not evaluated",
    tooltip: "Number of warning signs worth checking in the annual report." },
  { id: "latest_fy", label: "Latest financial year", short: "Latest FY", category: "Data", u: "FY·0·↔", level: "I", applies: "All", history: Lt,
    formula: "fiscal_year of annual slot 0", nulls: "IH",
    tooltip: "The most recent financial year in your data for this company." },
  { id: "years_of_history", label: "Years of history", short: "History", category: "Data", u: "yrs·0·↔", level: "A", applies: "All", history: Lt,
    formula: "annual slots with data", nulls: "never null",
    tooltip: "How many financial years of statements your data holds." },
];

// ── §C.4 generated line items ───────────────────────────────────────────────
/** Short column headers for generated line items (labels in FieldInfo are long). */
const LINE_ITEM_SHORT: Readonly<Record<string, string>> = {
  operating_expenses: "Opex", cogs: "COGS", other_income: "Other income", depreciation: "Depreciation",
  finance_cost: "Finance cost", exceptional_items: "Exceptional items", pbt: "PBT", tax_expense: "Tax",
  pat: "PAT", net_profit_owners: "Owners' PAT", interest_expended: "Interest expended",
  provisions_contingencies: "Provisions", equity_share_capital: "Share capital", other_equity: "Other equity",
  non_controlling_interest: "NCI", borrowings_non_current: "Long-term borrowings",
  borrowings_current: "Short-term borrowings", lease_liabilities: "Leases", trade_payables: "Payables",
  total_current_liabilities: "Current liabilities", total_assets: "Total assets", net_fixed_assets: "Net fixed assets",
  inventories: "Inventories", trade_receivables: "Receivables", cash_and_bank: "Cash", current_investments: "Current investments",
  total_current_assets: "Current assets", shares_outstanding_ye: "Shares (YE)", advances: "Advances",
  gross_npa: "Gross NPA", net_npa: "Net NPA", equity_issuance: "Equity issued",
  q_operating_expenses: "Qtr opex", q_depreciation: "Qtr depreciation", q_pat: "Qtr PAT",
  q_net_profit_owners: "Qtr owners' PAT", num_shareholders: "Shareholders",
};

/** Line items for which cagr() is not meaningful (they are routinely zero or negative). */
const NOT_GROWTHABLE_LINE_ITEMS: ReadonlySet<string> = new Set(["exceptional_items", "other_equity"]);

const STATEMENT_NAME: Readonly<Record<FieldInfo["statement"], string>> = {
  pnl: "profit and loss statement",
  balance_sheet: "balance sheet",
  cash_flow: "cash flow statement",
  quarterly: "quarterly results",
  shareholding: "shareholding pattern",
};

const FIELD_UNIT: Readonly<Record<FieldInfo["unit"], { unit: Unit; decimals: number; text: string }>> = {
  inr_cr: { unit: "inr_cr", decimals: 0, text: "₹ crore" },
  inr: { unit: "inr", decimals: 2, text: "₹ per share" },
  crore_shares: { unit: "crore_shares", decimals: 2, text: "crore shares" },
  pct: { unit: "pct", decimals: 2, text: "percent" },
  count: { unit: "count", decimals: 0, text: "count" },
};

const FIELD_APPLIES: Readonly<Record<FieldInfo["appliesTo"], Applies>> = {
  all: "All", non_financial: "NF", lender: "L",
};

const ZERO_DEFAULT_NOTE = new Set(["other_income", "exceptional_items", "non_controlling_interest", "lease_liabilities", "current_investments"]);

function lineItem(
  field: AnnualField | QuarterField | ShareholdingField, info: FieldInfo, history: HistoryKind,
): BaseMetricDef {
  const u = FIELD_UNIT[info.unit];
  const applies = FIELD_APPLIES[info.appliesTo];
  const short = LINE_ITEM_SHORT[info.metricId];
  if (!short) throw new Error(`Missing short label for line item ${info.metricId}`);
  const growthable = history === "annual" && (u.unit === "inr_cr" || u.unit === "inr" || u.unit === "crore_shares")
    && !NOT_GROWTHABLE_LINE_ITEMS.has(field);
  const zeroNote = history === "annual" && ZERO_DEFAULT_NOTE.has(field)
    ? " When it is missing, calculations that use it treat it as 0 and data health lists the assumption; the line itself shows Not provided."
    : "";
  return {
    id: info.metricId,
    label: info.label,
    short,
    aliases: [],
    category: "Line items",
    unit: u.unit,
    decimals: u.decimals,
    direction: "neutral",
    level: "advanced",
    appliesTo: APPLIES[applies],
    history,
    ttm: false,
    growthable,
    variants: ["prev"],
    rawField: field,
    periodTag: defaultPeriodTag(history),
    formula: `${field}, as reported in the ${STATEMENT_NAME[info.statement]} (${u.text}).`,
    tooltip: `${info.label}, as given in your data (${u.text}).`,
    nullRules: `Not provided when the field is missing from your data.${zeroNote}${APPLIES_NOTE[applies]}`,
    isScore: false,
  };
}

function generateLineItems(curatedIds: ReadonlySet<string>): BaseMetricDef[] {
  const out: BaseMetricDef[] = [];
  const add = (field: AnnualField | QuarterField | ShareholdingField, info: FieldInfo, history: HistoryKind) => {
    if (!curatedIds.has(info.metricId)) out.push(lineItem(field, info, history));
  };
  for (const [field, info] of Object.entries(ANNUAL_FIELD_INFO) as [AnnualField, FieldInfo][]) add(field, info, "annual");
  for (const [field, info] of Object.entries(QUARTER_FIELD_INFO) as [QuarterField, FieldInfo][]) add(field, info, "quarterly");
  for (const [field, info] of Object.entries(SHAREHOLDING_FIELD_INFO) as [ShareholdingField, FieldInfo][]) add(field, info, "shareholding");
  return out;
}

// ── Public catalogue ────────────────────────────────────────────────────────
/** The 92 curated base metrics of §C.3, in table order. */
export const CURATED_METRICS: readonly BaseMetricDef[] = CURATED_SPECS.map(fromSpec);

const CURATED_IDS: ReadonlySet<string> = new Set(CURATED_METRICS.map((d) => d.id));

/** Generated line items (§C.4) whose ids are not already curated. */
export const LINE_ITEM_METRICS: readonly BaseMetricDef[] = generateLineItems(CURATED_IDS);

/** Every base metric: curated first, then generated line items. */
export const BASE_METRICS: readonly BaseMetricDef[] = [...CURATED_METRICS, ...LINE_ITEM_METRICS];

const BASE_BY_ID: ReadonlyMap<MetricId, BaseMetricDef> = new Map(BASE_METRICS.map((d) => [d.id, d]));

export function baseMetric(id: MetricId): BaseMetricDef | undefined {
  return BASE_BY_ID.get(id);
}
