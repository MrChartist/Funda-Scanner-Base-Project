// src/lib/metrics/derive/banking.ts — Banking & NBFC metrics (spec §C.3; lenders only).
import { VF } from "@/lib/contracts";
import { type V, add, ratio, sub, withFlags } from "../values";
import { type DeriveContext, type DeriverTable, annual, avgField, avgOf, fy, latest, netWorth } from "./common";

/** nii = revenue (interest earned) − interest_expended. */
const nii = (c: DeriveContext, i: number, k: number): V => sub(fy(c, i, k, "revenue"), fy(c, i, k, "interest_expended"));
/** Total income = nii + other_income. */
const totalIncome = (c: DeriveContext, i: number, k: number): V => add(nii(c, i, k), fy(c, i, k, "other_income"));

export const BANKING_DERIVERS: DeriverTable = {
  nii: annual(nii),
  /** nii / avg(total_assets) × 100; always Approximate (total assets stand in for earning assets). */
  nim_approx: annual((c, i, k) =>
    withFlags(ratio(nii(c, i, k), avgField("total_assets")(c, i, k), "non_positive_denominator", 100), VF.Approximate)),
  ppop: annual((c, i, k) => sub(totalIncome(c, i, k), fy(c, i, k, "operating_expenses"))),
  cost_to_income: annual((c, i, k) =>
    ratio(fy(c, i, k, "operating_expenses"), totalIncome(c, i, k), "non_positive_denominator", 100)),
  credit_cost: annual((c, i, k) =>
    ratio(fy(c, i, k, "provisions_contingencies"), avgOf((cc, ii, kk) => fy(cc, ii, kk, "advances"), c, i, k), "non_positive_denominator", 100)),
  /** gross_npa / (advances + gross_npa − net_npa) × 100 (gross advances). */
  gnpa_ratio: annual((c, i, k) => {
    const gross = fy(c, i, k, "gross_npa");
    const grossAdvances = sub(add(fy(c, i, k, "advances"), gross), fy(c, i, k, "net_npa"));
    return ratio(gross, grossAdvances, "non_positive_denominator", 100);
  }),
  nnpa_ratio: annual((c, i, k) => ratio(fy(c, i, k, "net_npa"), fy(c, i, k, "advances"), "non_positive_denominator", 100)),
  /** (gross_npa − net_npa) / gross_npa × 100; not meaningful when there are no NPAs. */
  provision_coverage: annual((c, i, k) => {
    const gross = fy(c, i, k, "gross_npa");
    return ratio(sub(gross, fy(c, i, k, "net_npa")), gross, "non_positive_denominator", 100);
  }),
  /** market_cap / (net_worth − net_npa), latest FY. */
  p_abv: latest((c, i) => {
    const mcap = c.latest("market_cap", i);
    if (mcap.v === null) return mcap;
    return ratio(mcap, sub(netWorth(c, i, 0), fy(c, i, 0, "net_npa")), "non_positive_denominator");
  }),
};
