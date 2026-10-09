// src/test/fixtures/query/golden-queries.ts — the FSQL golden suite (spec §D.11), WS4.
// Every query in VALID_QUERIES must compile with no error-level issue; every entry in
// INVALID_QUERIES must produce exactly the listed error codes (warnings and info may accompany
// them unless `onlyIssues` says otherwise).
import type { IssueCode } from "@/lib/contracts";

export const VALID_QUERIES: readonly string[] = [
  "roce > 15",
  "ROCE > 15%",
  "Return on capital employed > 15 AND debt to equity < 0.5",
  "roce_avg_5y > 15 and de < 0.5",
  "roce 5y avg > 15",
  "average roce 5 years > 15",
  "every(roce > 15, 5y)",
  "every(sales > sales[prev], 5y)",
  "count(net_profit > 0, 10y) >= 8",
  "cagr(sales, 5y) > 12 AND sales_cagr_5y > 12",
  "pe < industry_median(pe)",
  "sector_pctl(roce_avg_5y) >= 80",
  "market_cap > 1.5lakh",
  "market_cap BETWEEN 500cr AND 20k",
  "net_profit[ttm] > 0 AND net_profit[ttm-1] < 0",
  "q_net_profit[q] > q_net_profit[q-1] AND q_net_profit[q-1] > q_net_profit[q-2]",
  "growth(q_sales[q], q_sales[q-4]) > 15",
  "total_debt < 0.7 * total_debt[fy-3] AND interest_coverage > 3",
  "(roe > 20 OR roce > 20) AND NOT is lender",
  "is lender AND roa_avg_3y > 1 AND gnpa_ratio < 3",
  "sector IN (\"Cement\", \"Metals & Mining\") AND ev_ebitda < 10",
  "sector != \"IT services\"",
  "`Cash and bank balances` > 0.2 * market_cap",
  "ev/ebitda < 12",
  "p/e < 25 AND p/b < 3",
  "has(gross_margin) AND gross_margin > 40",
  "promoter_holding_chg_1y >= 0 AND pledged_pct = 0",
  "red_flag_count = 0",
  "streak(dps > 0) >= 8",
  "opm > avg(opm, 5y) + 2",
  "abs(exceptional_items) < 0.1 * abs(pbt)",
  "roe BETWEEN 15 AND 25 AND pe < 30",
  "pe < 20 SORT BY roce_avg_5y DESC, pe ASC LIMIT 50",
  "is non_financial AND market_cap > 500 AND earnings_yield > 0 SORT BY rank(earnings_yield) + rank(roic) ASC LIMIT 30",
  "# Quality compounders (multi-line, comments, implicit AND)\nevery(roce > 15, 5y)\ndebt_equity < 0.5   # conservative balance sheet\ncum_cfo_to_pat_5y > 0.8",
];

export interface InvalidQuery {
  query: string;
  /** Exact list of error-level codes, in source order. */
  errors: readonly IssueCode[];
  /** When set, the complete list of issue codes (any level) must equal this. */
  onlyIssues?: readonly IssueCode[];
  /** A suggestion replacement that must be offered. */
  suggestion?: string;
}

export const INVALID_QUERIES: readonly InvalidQuery[] = [
  { query: "roce >", errors: ["E_UNEXPECTED_END"] },
  { query: "roce > 15 AND (pe < 20", errors: ["E_UNBALANCED_PAREN"] },
  { query: "debt_equty < 0.5", errors: ["E_UNKNOWN_METRIC"], suggestion: "debt_equity" },
  { query: "roce", errors: ["E_TYPE_BOOL_EXPECTED"] },
  { query: "10 < roce < 20", errors: ["E_CHAINED_COMPARISON"] },
  { query: "debt_equity < 50%", errors: ["E_UNIT_MISMATCH"] },
  { query: "roe > 15 x", errors: ["E_UNIT_MISMATCH"] },
  { query: "roe > 0.15", errors: [], onlyIssues: ["W_LIKELY_FRACTION"] },
  { query: "market_cap > 1,00,000", errors: ["E_COMMA_IN_NUMBER"] },
  { query: "every(pe < 20, 5y)", errors: ["E_NO_HISTORY"] },
  { query: "every(roce[fy-1] > 15, 5y)", errors: ["E_SELECTOR_IN_WINDOW"] },
  { query: "every(roce > industry_median(roce), 3y)", errors: ["E_PEER_IN_WINDOW"] },
  { query: "rank(roce) > 10", errors: ["E_RANK_OUTSIDE_SORT"] },
  { query: "avg(roce) > 10", errors: ["E_WINDOW_REQUIRED"] },
  { query: "avg(roce, 30y) > 10", errors: ["E_WINDOW_RANGE"] },
  { query: "every(roce > 15, 8q)", errors: ["E_QUARTER_WINDOW"] },
  { query: "cagr(roce, 5y) > 5", errors: ["E_NOT_GROWTHABLE"] },
  { query: "sales last year > 100", errors: ["E_AMBIGUOUS_PERIOD_WORD"] },
  { query: "pe[fy-1] < 20", errors: ["E_NO_HISTORY"] },
  { query: "roce[ttm] > 10", errors: ["E_BAD_SELECTOR"] },
  { query: "sector > 5", errors: ["E_TEXT_COMPARISON"] },
  { query: "FROM watchlist roce > 15", errors: ["E_RESERVED_WORD"] },
  { query: "pe < 20 LIMIT 0", errors: ["E_LIMIT_RANGE"] },
  { query: "pe < 20 AND AND roe > 10", errors: ["E_UNEXPECTED_TOKEN"] },
  { query: "roce >> 15 AND debt_equty < 0.5", errors: ["E_UNEXPECTED_TOKEN", "E_UNKNOWN_METRIC"] },
  { query: "sector = \"cement", errors: ["E_UNTERMINATED_STRING"] },
  { query: "roce @ 5", errors: ["E_UNEXPECTED_CHAR"] },
  { query: "foo(roce) > 1", errors: ["E_UNKNOWN_FUNCTION"] },
];
