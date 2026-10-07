// src/lib/metrics/derive/efficiency.ts — Efficiency metrics (spec §C.3; annual; days metrics use
// closing balances).
import type { AnnualField } from "@/lib/contracts";
import { VF } from "@/lib/contracts";
import { type V, add, ratio, sub, withFlags } from "../values";
import { type DeriveContext, type DeriverTable, annual, avgField, cashLike, fy, hasFy } from "./common";

const revenue = (c: DeriveContext, i: number, k: number): V => fy(c, i, k, "revenue");

/** COGS, or revenue flagged SalesBasis when COGS is not provided (never treated as 0). */
function cogsOrSales(c: DeriveContext, i: number, k: number): V {
  const cogs = fy(c, i, k, "cogs");
  if (cogs.v !== null || !hasFy(c, i, k)) return cogs;
  return withFlags(revenue(c, i, k), VF.SalesBasis);
}

/** balance / COGS × 365 (SalesBasis fallback). An explicit 0 balance gives 0 days. */
const daysOnCogs = (field: AnnualField) => (c: DeriveContext, i: number, k: number): V =>
  ratio(fy(c, i, k, field), cogsOrSales(c, i, k), "non_positive_denominator", 365);

const debtorDays = (c: DeriveContext, i: number, k: number): V =>
  ratio(fy(c, i, k, "trade_receivables"), revenue(c, i, k), "non_positive_denominator", 365);
const inventoryDays = daysOnCogs("inventories");
const payableDays = daysOnCogs("trade_payables");

export const EFFICIENCY_DERIVERS: DeriverTable = {
  asset_turnover: annual((c, i, k) => ratio(revenue(c, i, k), avgField("total_assets")(c, i, k), "non_positive_denominator")),
  fixed_asset_turnover: annual((c, i, k) =>
    ratio(revenue(c, i, k), avgField("net_fixed_assets")(c, i, k), "non_positive_denominator")),
  debtor_days: annual(debtorDays),
  inventory_days: annual(inventoryDays),
  payable_days: annual(payableDays),
  /** debtor + inventory − payable days; Approximate when any part is on a sales basis. */
  cash_conversion_cycle: annual((c, i, k) => {
    const v = sub(add(debtorDays(c, i, k), inventoryDays(c, i, k)), payableDays(c, i, k));
    return (v.flags & VF.SalesBasis) !== 0 ? withFlags(v, VF.Approximate) : v;
  }),
  /** ((TCA − cash_like) − (TCL − borrowings_current)) / revenue × 365. */
  working_capital_days: annual((c, i, k) => {
    const operatingAssets = sub(fy(c, i, k, "total_current_assets"), cashLike(c, i, k));
    const operatingLiabilities = sub(fy(c, i, k, "total_current_liabilities"), fy(c, i, k, "borrowings_current"));
    return ratio(sub(operatingAssets, operatingLiabilities), revenue(c, i, k), "non_positive_denominator", 365);
  }),
};
