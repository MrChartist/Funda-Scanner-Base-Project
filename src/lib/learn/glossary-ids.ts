// src/lib/learn/glossary-ids.ts - which metrics have a glossary entry, without the glossary text.
// The app shell (header search, command palette) only needs to know whether a Learn anchor exists,
// and importing glossary.ts there would put ~65 KB of learning content in the first-load bundle.
// glossary-ids.test.ts keeps this list in step with GLOSSARY.
const IDS: readonly string[] = [
  "market_cap", "price", "sales", "net_profit", "net_worth", "total_debt", "pe", "pb", "roce",
  "roe", "opm", "npm", "debt_equity", "interest_coverage", "current_ratio", "sales_growth",
  "profit_growth", "cfo", "fcf", "promoter_holding", "pledged_pct", "dps", "dividend_yield", "eps",
  "bvps", "enterprise_value", "ebitda", "ebit", "net_debt", "capital_employed", "price_to_sales",
  "ev_ebitda", "earnings_yield", "earnings_to_price", "fcf_yield", "fcf_yield_3y", "peg", "roic",
  "roa", "gross_margin", "effective_tax_rate", "other_income_to_pbt", "asset_turnover",
  "debtor_days", "inventory_days", "payable_days", "cash_conversion_cycle", "working_capital_days",
  "net_debt_equity", "debt_ebitda", "net_debt_ebitda", "ttm_sales_growth", "ttm_profit_growth",
  "q_sales_yoy", "q_profit_yoy", "q_sales", "q_net_profit", "cfo_to_pat", "cum_cfo_to_pat_5y",
  "fii_holding", "dii_holding", "public_holding", "dividend_payout", "dividend_streak", "nii",
  "nim_approx", "cost_to_income", "gnpa_ratio", "nnpa_ratio", "provision_coverage", "piotroski_f",
  "altman_z", "red_flag_count", "latest_fy"
];

const SET: ReadonlySet<string> = new Set(IDS);

export const GLOSSARY_IDS: readonly string[] = IDS;

/** True when the metric has an entry on the Learn page. */
export function hasGlossaryEntry(metricId: string): boolean {
  return SET.has(metricId);
}
