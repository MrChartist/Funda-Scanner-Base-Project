// src/lib/screen/templates.ts — guided screens (§D.13). Original wording, written for learners.
// Templates never default missing values: a company without the data is "not evaluated".
// Thresholds are rules of thumb for study (see docs/methodology.md), not standards.
import type { ScreenTemplate } from "@/lib/contracts";

export const TEMPLATES: readonly ScreenTemplate[] = [
  {
    id: "quality",
    title: "Quality compounders",
    level: "Beginner",
    idea:
      "Businesses that have earned a high return on their capital year after year without leaning on borrowed money, and whose reported profits turn into cash.",
    query: ["every(roce > 15, 5y)", "debt_equity < 0.5", "cum_cfo_to_pat_5y > 0.8", "sales_cagr_5y > 10"].join("\n"),
    clauseNotes: [
      "ROCE above 15% in each of the last five financial years shows returns that held up through good and bad years, not one strong year.",
      "Debt below half of shareholders' funds keeps the returns from being driven by borrowing.",
      "Cash from operations of at least 80% of net profit over five years suggests the profits arrived as cash, not only as accounting entries.",
      "Sales growing faster than 10% a year over five years shows the business is still expanding.",
    ],
    misses: [
      "Companies with less than six years of history, because the five-year tests need it.",
      "Banks and NBFCs, for which ROCE and debt to equity do not apply. Use the Lenders template for them.",
      "Businesses that improved recently and have not yet built a five-year record.",
    ],
    notFor: [
      "Finding companies that are inexpensive today: this screen does not look at valuation.",
      "Short-term ideas: every rule describes several years of history.",
    ],
    tryChanging: "Lower 15 to 12 in the first rule to see near misses become matches.",
    columns: ["roce_avg_5y", "debt_equity", "cum_cfo_to_pat_5y", "sales_cagr_5y", "pe"],
    sort: { key: "roce_avg_5y", dir: "desc" },
    inspiredBy: null,
  },
  {
    id: "value",
    title: "Value with a safety check",
    level: "Intermediate",
    idea:
      "Companies priced low relative to their operating profit and to their industry, kept only when interest is well covered, the Piotroski score is decent and no red flag is triggered.",
    query: ["earnings_yield > 8", "pe < industry_median(pe)", "interest_coverage > 4", "piotroski_f >= 6", "red_flag_count = 0"].join("\n"),
    clauseNotes: [
      "An earnings yield (EBIT divided by enterprise value) above 8% means operating profit is high relative to the value of the whole business, debt included.",
      "A P/E below the median of its industry, among companies in your data, compares the price with similar businesses.",
      "Operating profit of at least four times the interest bill leaves room if profits fall.",
      "A Piotroski F-score of 6 or more out of 9 points to improving profitability, funding and efficiency in the latest year.",
      "None of the rule-based red flags in this app is triggered.",
    ],
    misses: [
      "Cyclical companies near a peak, whose high profits can make them look inexpensive for a while.",
      "Banks and NBFCs, for which EBIT-based measures do not apply.",
      "Industries with fewer than three comparable companies in your data, where the industry median is not available.",
    ],
    notFor: [
      "Readers looking for growth: a low price often comes with slow growth.",
      "Treating a low price as a conclusion on its own; read why the price is low before going further.",
    ],
    tryChanging: "Change industry_median(pe) to sector_median(pe) to compare with a wider group of companies.",
    columns: ["earnings_yield", "pe", "interest_coverage", "piotroski_f", "red_flag_count"],
    sort: { key: "earnings_yield", dir: "desc" },
    inspiredBy:
      "Piotroski, J. D. (2000), Value Investing: The Use of Historical Financial Statement Information to Separate Winners from Losers",
  },
  {
    id: "growth",
    title: "Steady growers",
    level: "Beginner",
    idea:
      "Companies whose sales and profits have both compounded at a healthy pace for five years, with growth in most individual years and a fair return on equity.",
    query: ["sales_cagr_5y > 15", "net_profit_cagr_5y > 15", "count(sales_growth > 0, 5y) >= 4", "roe_avg_3y > 15"].join("\n"),
    clauseNotes: [
      "Sales compounding faster than 15% a year over five years.",
      "Net profit compounding faster than 15% a year, so the growth reaches the bottom line.",
      "Sales grew in at least four of the last five years, which separates steady growth from a single large jump.",
      "An average ROE above 15% over three years shows the growth earns a good return for shareholders.",
    ],
    misses: [
      "Young companies without five years of history.",
      "Turnarounds: when the starting profit was zero or negative, a CAGR is not meaningful.",
      "Growth that came from one large acquisition, which a five-year CAGR can hide.",
    ],
    notFor: ["Judging whether the growth is already reflected in the price; add a valuation rule for that."],
    tryChanging: "Lower 15 to 12 in the first two rules to include slower but steady growers, or lower the count to 3 to allow one more weak year.",
    columns: ["sales_cagr_5y", "net_profit_cagr_5y", "sales_growth", "roe_avg_3y", "pe"],
    sort: { key: "sales_cagr_5y", dir: "desc" },
    inspiredBy: null,
  },
  {
    id: "dividend",
    title: "Reliable dividend payers",
    level: "Beginner",
    idea:
      "Companies that have paid a dividend every year for at least five years, at a meaningful yield, from a payout that leaves money in the business and is backed by cash.",
    query: ["dividend_streak >= 5", "dividend_yield > 3", "dividend_payout_avg_3y BETWEEN 20 AND 80", "cum_cfo_to_pat_5y > 0.8"].join("\n"),
    clauseNotes: [
      "A dividend in each of at least the last five financial years.",
      "A dividend yield above 3% at the reference price in your data.",
      "Paying out between 20% and 80% of profit on average over three years: enough to matter, but not more than the business earns.",
      "Profits that turn into cash, so the dividend comes from cash rather than from borrowing.",
    ],
    misses: [
      "Companies that reinvest all their profit and pay little or no dividend.",
      "Companies that started paying dividends only recently.",
    ],
    notFor: [
      "Anyone who needs a fixed income: a company can reduce or stop its dividend in any year.",
      "Comparing yields without checking the price date in your data.",
    ],
    tryChanging: "Lower the yield from 3 to 2 to widen the list, or raise the streak to 8 for longer records.",
    columns: ["dividend_streak", "dividend_yield", "dividend_payout_avg_3y", "cum_cfo_to_pat_5y", "dps"],
    sort: { key: "dividend_yield", dir: "desc" },
    inspiredBy: null,
  },
  {
    id: "turnaround",
    title: "Turnaround watch",
    level: "Intermediate",
    idea:
      "Companies that are profitable again over the last twelve months after at least one recent loss year, with margins above their own five-year average and manageable debt.",
    query: [
      "net_profit[ttm] > 0", "count(net_profit < 0, 3y) >= 1", "opm > opm_avg_5y", "debt_ebitda < 3", "promoter_holding_chg_1y >= 0",
    ].join("\n"),
    clauseNotes: [
      "Net profit is positive over the trailing twelve months.",
      "At least one loss year in the last three financial years, which is what makes this a turnaround.",
      "Operating margin above its own five-year average, a sign that operations are improving.",
      "Debt below three times EBITDA, so the recovery does not rest on heavy borrowing.",
      "Promoters have not reduced their holding over the last year.",
    ],
    misses: [
      "Recoveries that have not yet reached the reported figures.",
      "Companies without quarterly data, for which TTM falls back to the latest financial year.",
    ],
    notFor: [
      "A shortlist: recoveries often stall. Use the results to study what changed.",
      "Readers who are not comfortable with higher risk.",
    ],
    tryChanging: "Change debt_ebitda < 3 to debt_ebitda < 2 for a stricter balance-sheet test.",
    columns: ["net_profit_ttm", "opm", "opm_avg_5y", "debt_ebitda", "promoter_holding_chg_1y"],
    sort: null,
    inspiredBy: null,
  },
  {
    id: "lenders",
    title: "Lenders with clean books",
    level: "Intermediate",
    idea:
      "Banks and NBFCs that have earned a steady return on assets, report few bad loans, have set aside enough for the bad loans they do have, and run efficiently.",
    query: ["is lender", "roa_avg_3y > 1", "gnpa_ratio < 3", "provision_coverage > 60", "cost_to_income < 50"].join("\n"),
    clauseNotes: [
      "Banks and NBFCs only; insurers and non-financial companies are left out.",
      "Return on assets above 1% on average over three years, a common yardstick for lenders.",
      "Gross NPAs below 3% of loans.",
      "Provisions covering more than 60% of gross NPAs.",
      "Operating costs below half of operating income.",
    ],
    misses: [
      "Insurers, which need different measures.",
      "Lenders whose data does not include NPA figures.",
      "Net interest margin: in this app it is an approximation (calculated on total assets), so it is not used as a rule here.",
    ],
    notFor: ["Comparing lenders with non-financial companies; their accounts are built differently."],
    tryChanging: "Change gnpa_ratio < 3 to gnpa_ratio < 2 to keep only the cleanest books.",
    columns: ["roa_avg_3y", "gnpa_ratio", "nnpa_ratio", "provision_coverage", "cost_to_income", "pb"],
    sort: { key: "roa_avg_3y", dir: "desc" },
    inspiredBy: null,
  },
  {
    id: "ey_roc_rank",
    title: "Earnings yield and return on capital rank",
    level: "Intermediate",
    idea:
      "Ranks non-financial companies on two measures at once, how much operating profit they earn for their price and how well they use their capital, and keeps the 20 with the best combined rank.",
    query: [
      "is non_financial", "market_cap > 500", "earnings_yield > 0", "roic > 0", "SORT BY rank(earnings_yield) + rank(roic) ASC", "LIMIT 20",
    ].join("\n"),
    clauseNotes: [
      "Non-financial companies only, because EBIT and invested capital do not apply to lenders.",
      "Market cap above ₹500 crore, to leave out the smallest companies.",
      "A positive earnings yield, which leaves out loss-making companies.",
      "A positive return on invested capital.",
    ],
    misses: [
      "Growth, governance and debt: the ranking is mechanical and looks at only two numbers.",
      "Banks, NBFCs and insurers.",
    ],
    notFor: ["Readers who want a reason for each company; read each result's statements before drawing conclusions."],
    tryChanging: "Change LIMIT 20 to LIMIT 50, or add debt_equity < 1 as a new rule.",
    columns: ["earnings_yield", "roic", "market_cap", "pe"],
    sort: null,
    inspiredBy: "Greenblatt, J. (2005), The Little Book That Beats the Market",
  },
];

export function templateById(id: string | null | undefined): ScreenTemplate | undefined {
  return id ? TEMPLATES.find((t) => t.id === id) : undefined;
}
