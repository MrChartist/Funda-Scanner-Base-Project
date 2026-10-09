// src/lib/insights/checks/red-flags.ts — red flags (spec §C.9). "met" means the flag is triggered.
// The UI heading for these is "Worth checking": each flag is a prompt to read the annual report,
// not a verdict on the company. Thresholds are rules of thumb documented in docs/methodology.md §3.
// No rule may reference red_flag_count (that column is computed from these rules).
import type { CheckRule } from "@/lib/contracts";
import { LENDERS } from "./lender";
import { ALL_FAMILIES, NF } from "./nonfin";

export const RED_FLAGS: readonly CheckRule[] = [
  {
    id: "RF-01", kind: "red_flag", area: "cash_conversion", appliesTo: NF,
    title: "Profit not backed by cash",
    test: "Operating cash flow over the last 5 financial years is less than 0.7 times net profit over the same years",
    query: "cum_cfo_to_pat_5y < 0.7",
    evidence: ["cum_cfo_to_pat_5y", "cfo", "net_profit"], section: "cash-flow", learn: ["cum_cfo_to_pat_5y", "cfo_to_pat"],
  },
  {
    id: "RF-02", kind: "red_flag", area: "cash_conversion", appliesTo: NF,
    title: "Receivables rising faster than sales",
    test: "Debtor days are more than 1.3 times their level 3 financial years earlier, while sales grew by less than 10% a year over the last 3 financial years",
    query: "debtor_days > 1.3 * debtor_days[fy-3] AND sales_cagr_3y < 10",
    evidence: ["debtor_days", "sales_cagr_3y", "trade_receivables"], section: "ratios", learn: ["debtor_days"],
  },
  {
    id: "RF-03", kind: "red_flag", area: "shareholder_returns", appliesTo: ALL_FAMILIES,
    title: "High or rising pledge",
    test: "More than 25% of the promoters' holding is pledged, or the pledged share rose by more than 5 percentage points over the last year",
    query: "pledged_pct > 25 OR pledged_pct_chg_1y > 5",
    evidence: ["pledged_pct", "pledged_pct_chg_1y", "promoter_holding"], section: "shareholding", learn: ["pledged_pct"],
  },
  {
    id: "RF-04", kind: "red_flag", area: "shareholder_returns", appliesTo: ALL_FAMILIES,
    title: "Promoters cut stake sharply",
    test: "Promoter holding fell by more than 5 percentage points over the last year",
    query: "promoter_holding_chg_1y < -5",
    evidence: ["promoter_holding_chg_1y", "promoter_holding"], section: "shareholding", learn: ["promoter_holding"],
  },
  {
    id: "RF-05", kind: "red_flag", area: "profitability", appliesTo: NF,
    title: "Large other income",
    test: "Other income is more than 30% of profit before tax in the latest financial year",
    query: "other_income_to_pbt > 30",
    evidence: ["other_income_to_pbt", "other_income", "pbt"], section: "pnl", learn: ["other_income_to_pbt"],
  },
  {
    id: "RF-06", kind: "red_flag", area: "balance_sheet", appliesTo: NF,
    title: "Weak interest cover",
    test: "Operating profit covers the interest cost less than 1.5 times in the latest financial year",
    query: "interest_coverage < 1.5",
    evidence: ["interest_coverage", "total_debt"], section: "pnl", learn: ["interest_coverage"],
  },
  {
    id: "RF-07", kind: "red_flag", area: "balance_sheet", appliesTo: ALL_FAMILIES,
    title: "Negative net worth",
    test: "Net worth (shareholders' funds) is below ₹0 in the latest financial year",
    query: "net_worth < 0",
    evidence: ["net_worth"], section: "balance-sheet", learn: ["net_worth"],
  },
  {
    id: "RF-08", kind: "red_flag", area: "profitability", appliesTo: ALL_FAMILIES,
    title: "Persistently low tax",
    test: "The effective tax rate was below 10% in each of the last 3 financial years",
    query: "every(effective_tax_rate < 10, 3y)",
    evidence: ["effective_tax_rate"], section: "pnl", learn: ["effective_tax_rate"],
  },
  {
    id: "RF-09", kind: "red_flag", area: "balance_sheet", appliesTo: NF,
    title: "Distress zone",
    test: "The Altman Z'' score is below 1.1, the distress zone of that model",
    query: "altman_z < 1.1",
    evidence: ["altman_z"], section: "scores", learn: ["altman_z"],
  },
  {
    id: "RF-10", kind: "red_flag", area: "profitability", appliesTo: ALL_FAMILIES,
    title: "Repeated exceptional items",
    test: "Exceptional items, gains or losses, were larger than 0.2 times profit before tax (both taken as absolute values) in at least 2 of the last 3 financial years",
    query: "count(abs(exceptional_items) > 0.2 * abs(pbt), 3y) >= 2",
    evidence: ["exceptional_items", "pbt"], section: "pnl", learn: ["net_profit"],
  },
  {
    id: "RF-11", kind: "red_flag", area: "shareholder_returns", appliesTo: ALL_FAMILIES,
    title: "Equity dilution",
    test: "Shares outstanding at year end are more than 1.05 times the previous year's count (a rise of more than 5%)",
    query: "shares_outstanding_ye > 1.05 * shares_outstanding_ye[prev]",
    evidence: ["shares_outstanding_ye", "equity_issuance"], section: "balance-sheet", learn: ["eps"],
  },
  {
    id: "RF-12", kind: "red_flag", area: "cash_conversion", appliesTo: NF,
    title: "Inventory building up",
    test: "Inventory days are more than 1.3 times their level 3 financial years earlier, while sales grew by less than 10% a year over the last 3 financial years",
    query: "inventory_days > 1.3 * inventory_days[fy-3] AND sales_cagr_3y < 10",
    evidence: ["inventory_days", "sales_cagr_3y", "inventories"], section: "ratios", learn: ["inventory_days"],
  },
  {
    id: "LF-01", kind: "red_flag", area: "asset_quality", appliesTo: LENDERS,
    title: "Bad loans rising",
    test: "The gross NPA ratio rose by more than 1 percentage point over the previous financial year",
    query: "gnpa_ratio - gnpa_ratio[prev] > 1",
    evidence: ["gnpa_ratio", "gross_npa"], section: "ratios", learn: ["gnpa_ratio"],
  },
  {
    id: "LF-02", kind: "red_flag", area: "asset_quality", appliesTo: LENDERS,
    title: "Thin provisions",
    test: "Provisions cover less than 50% of gross NPAs in the latest financial year",
    query: "provision_coverage < 50",
    evidence: ["provision_coverage", "gross_npa", "net_npa"], section: "ratios", learn: ["provision_coverage"],
  },
  {
    id: "LF-03", kind: "red_flag", area: "asset_quality", appliesTo: LENDERS,
    title: "High credit cost",
    test: "Provisions for bad loans are more than 2.5% of average advances (credit cost) in the latest financial year",
    query: "credit_cost > 2.5",
    evidence: ["credit_cost", "advances"], section: "ratios", learn: ["credit_cost", "gnpa_ratio"],
  },
  {
    id: "LF-04", kind: "red_flag", area: "shareholder_returns", appliesTo: LENDERS,
    title: "High pledge (lenders)",
    test: "More than 25% of the promoters' holding is pledged",
    query: "pledged_pct > 25",
    evidence: ["pledged_pct", "promoter_holding"], section: "shareholding", learn: ["pledged_pct"],
  },
];
