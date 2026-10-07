// src/lib/learn/concepts.ts — ten short explanations of ideas used across the app (§E.4).
// Original text in plain, formal Indian English. Bodies are plain text: paragraphs separated by
// a blank line, rendered as text (never as HTML).
import type { ConceptEntry } from "@/lib/contracts";

export const CONCEPTS: readonly ConceptEntry[] = [
  {
    id: "ttm",
    title: "Trailing twelve months (TTM)",
    body: [
      "TTM figures add up the latest four quarters, so they are more recent than the last annual report. If the latest quarter ends in June 2026, TTM sales are the sales from July 2025 to June 2026.",
      "This app builds a TTM figure only from four consecutive quarters, matched by their dates. If any of them is missing, it uses the latest financial year instead and labels the value 'FY' rather than 'TTM'.",
      "Valuation ratios such as P/E and price to sales use TTM figures, because the price is recent. Ratios built from the balance sheet use the latest financial year.",
    ].join("\n\n"),
    related: ["fy", "pe", "ttm_sales_growth", "missing-data"],
  },
  {
    id: "cagr",
    title: "Compound annual growth rate (CAGR)",
    body: [
      "CAGR is the steady yearly growth rate that would take a figure from its starting value to its ending value over a number of years. For example, sales that grow from ₹100 crore to ₹161 crore in five years have a 5-year CAGR of about 10%, because 100 × 1.1 × 1.1 × 1.1 × 1.1 × 1.1 is about 161.",
      "CAGR looks only at the two end points and hides the path between them. A company with a sharp fall in the middle can show the same CAGR as one that grew smoothly, so check the yearly figures as well.",
      "CAGR is not meaningful when the starting or ending value is zero or negative. The app then shows the reason instead of a number.",
    ].join("\n\n"),
    related: ["sales_growth", "profit_growth", "fy"],
  },
  {
    id: "fy",
    title: "Financial years",
    body: [
      "Most Indian companies follow a financial year from 1 April to 31 March. 'FY26' means the year that ended on 31 March 2026.",
      "Some companies close their books in another month. The app keeps each company's own year-end month and labels a year by the calendar year in which it ends.",
      "If a company changes its year end, or a merger changes the scope of its accounts, one year may not be comparable with the others. Such a year is flagged as a transition period, and growth rates and averages that span it are not calculated.",
    ].join("\n\n"),
    related: ["ttm", "cagr", "latest_fy"],
  },
  {
    id: "crore-lakh",
    title: "Lakh and crore",
    body: [
      "Indian figures use the lakh (1,00,000) and the crore (1,00,00,000, which is 100 lakh). One crore equals ten million.",
      "All money in this app is in ₹ crore unless stated otherwise, and share counts are in crore shares. Very large amounts are shown in lakh crore: ₹1.92 lakh Cr means ₹1,92,000 crore.",
      "When you import your own data, make sure the figures are in crore. If your file is in rupees, lakh or millions, the numbers will be out of scale; the import report warns you when they look that way.",
    ].join("\n\n"),
    related: ["market_cap", "sales"],
  },
  {
    id: "consolidated-standalone",
    title: "Consolidated and standalone accounts",
    body: [
      "Standalone statements cover the listed company on its own. Consolidated statements add its subsidiaries, so they show the whole group.",
      "Consolidated figures are usually the better guide when a company has significant subsidiaries. Consolidated profit includes a share that belongs to the minority (non-controlling) shareholders of the subsidiaries; earnings per share and ROE in this app use only the share that belongs to the parent company's owners.",
      "Do not mix the two bases when comparing years or companies. Each company page shows which basis its data uses.",
    ].join("\n\n"),
    related: ["net_profit", "roe", "eps"],
  },
  {
    id: "percentile",
    title: "Percentiles and peer groups",
    body: [
      "A percentile tells you where a company stands within a group. A percentile of 80 for ROCE means the company's ROCE is higher than that of about 80% of the comparable companies in your data.",
      "Peers are always of the same kind: banks are compared with banks, NBFCs with NBFCs and non-financial companies with non-financial companies. The app starts with the company's industry; if fewer than five companies are available, it widens the group to the sector and then to all companies of the same kind, and it says which group it used.",
      "Percentiles describe the data you loaded, not the whole market. In a small or unusual dataset, a high percentile may still be an ordinary figure.",
    ].join("\n\n"),
    related: ["why-lenders-differ", "missing-data"],
  },
  {
    id: "why-lenders-differ",
    title: "Why banks and NBFCs are read differently",
    body: [
      "For a manufacturer, borrowing funds the business. For a bank or an NBFC, deposits and borrowings are the raw material: it lends the money on at a higher rate. Ratios such as debt to equity, ROCE, the current ratio and EBITDA therefore say little about a lender, and the app shows them as 'N/A for lenders'.",
      "Lenders are read through other measures: net interest income and margin, cost to income, credit cost, the gross and net NPA ratios, provision coverage, return on assets and return on equity. Price to book often matters more than price to earnings, because a lender's assets are mostly loans.",
      "Insurers are different again. The sample includes only four insurers, fewer than the five needed for peer statistics, so their percentiles show 'Too few comparable companies in your data'.",
    ].join("\n\n"),
    related: ["nii", "gnpa_ratio", "roa", "cost_to_income", "pb"],
  },
  {
    id: "missing-data",
    title: "Why some values are missing",
    body: [
      "When a value cannot be calculated honestly, the app shows a dash and the reason, never a zero or a guess. Common reasons are that an input was not provided, the figure it divides by is zero or negative, the company made a loss (so P/E is not meaningful), the metric does not apply to lenders, there is not enough history for a 5-year figure, or there are too few comparable companies.",
      "A screen treats a missing value as unknown, not as a failure. Companies that cannot be checked are listed separately as 'not evaluated', with the reason, so you can see who was left out and why.",
      "A few fields are conventionally treated as zero when they are absent: other income, exceptional items, minority interest, lease liabilities and current investments. Whenever this happens, the data health panel says so.",
    ].join("\n\n"),
    related: ["percentile", "fictional-sample", "what-a-screen-cannot-tell-you"],
  },
  {
    id: "what-a-screen-cannot-tell-you",
    title: "What a screen cannot tell you",
    body: [
      "A screen filters companies on numbers from past financial statements. It cannot judge the quality of management, the strength of a brand, changes in regulation, pending litigation, dealings with related parties or the risks described in the notes to the accounts.",
      "Past returns and growth do not ensure future results. A company that passes every check can still disappoint, and one that fails a check may have a good explanation that only its annual report gives.",
      "Use a screen to build a short list of companies worth studying. Then read their annual reports, notes to the accounts and shareholding disclosures before forming a view. Nothing in this app is a recommendation.",
    ].join("\n\n"),
    related: ["missing-data", "red_flag_count"],
  },
  {
    id: "fictional-sample",
    title: "About the fictional sample",
    body: [
      "The sample data contains 150 fictional companies produced by a fixed formula. Their names, symbols and figures are invented and describe no real business, and every sample company carries the label '(fictional)'.",
      "The figures are built so that the accounts hold together: profit, cash flow and the balance sheet agree with each other, and the quarterly figures add up to the yearly ones. Each company is in the sample to illustrate something, such as a steady compounder, a cyclical business or a red-flag case, and its page explains why.",
      "The financial-year labels (FY2016 to FY2026) are for illustration only, and the reference prices have no date. To study real companies, import your own data from a source you are licensed to use.",
    ].join("\n\n"),
    related: ["missing-data", "what-a-screen-cannot-tell-you"],
  },
];
