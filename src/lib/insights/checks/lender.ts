// src/lib/insights/checks/lender.ts — checks for lenders (banks, NBFCs, housing finance), spec §C.9.
// Lenders are read on returns on assets and equity, asset quality and cost, not on ROCE or debt to
// equity. Thresholds are rules of thumb documented in docs/methodology.md §3.
import type { CheckRule, TypeFamily } from "@/lib/contracts";

export const LENDERS: readonly TypeFamily[] = ["lender"];

export const LENDER_CHECKS: readonly CheckRule[] = [
  {
    id: "LP-01", kind: "check", area: "profitability", appliesTo: LENDERS,
    title: "Earns well on its assets",
    test: "Return on assets averaged above 1% over the last 3 financial years",
    query: "roa_avg_3y > 1",
    evidence: ["roa_avg_3y", "roa"], section: "ratios", learn: ["roa"],
  },
  {
    id: "LP-02", kind: "check", area: "profitability", appliesTo: LENDERS,
    title: "Earns well on shareholders' equity",
    test: "Return on equity averaged above 12% over the last 3 financial years",
    query: "roe_avg_3y > 12",
    evidence: ["roe_avg_3y", "roe"], section: "ratios", learn: ["roe"],
  },
  {
    id: "AQ-01", kind: "check", area: "asset_quality", appliesTo: LENDERS,
    title: "Few bad loans",
    test: "Gross NPAs are below 4% of gross advances in the latest financial year",
    query: "gnpa_ratio < 4",
    evidence: ["gnpa_ratio", "gross_npa", "advances"], section: "ratios", learn: ["gnpa_ratio"],
  },
  {
    id: "AQ-02", kind: "check", area: "asset_quality", appliesTo: LENDERS,
    title: "Few bad loans after provisions",
    test: "Net NPAs, after provisions, are below 1.5% of net advances in the latest financial year",
    query: "nnpa_ratio < 1.5",
    evidence: ["nnpa_ratio", "net_npa"], section: "ratios", learn: ["nnpa_ratio"],
  },
  {
    id: "AQ-03", kind: "check", area: "asset_quality", appliesTo: LENDERS,
    title: "Bad loans well provided for",
    test: "Provisions cover more than 60% of gross NPAs in the latest financial year",
    query: "provision_coverage > 60",
    evidence: ["provision_coverage", "gross_npa", "net_npa"], section: "ratios", learn: ["provision_coverage"],
  },
  {
    id: "EF-01", kind: "check", area: "efficiency", appliesTo: LENDERS,
    title: "Runs at a reasonable cost",
    test: "Operating expenses are below 50% of net operating income (cost to income) in the latest financial year",
    query: "cost_to_income < 50",
    evidence: ["cost_to_income"], section: "ratios", learn: ["cost_to_income"],
  },
  {
    id: "EF-02", kind: "check", area: "efficiency", appliesTo: LENDERS,
    title: "Loan losses kept low",
    test: "Provisions for bad loans are below 1.5% of average advances (credit cost) in the latest financial year",
    query: "credit_cost < 1.5",
    evidence: ["credit_cost", "advances"], section: "ratios", learn: ["credit_cost", "provision_coverage"],
  },
];
