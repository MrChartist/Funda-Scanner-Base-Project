// src/lib/metrics/derive/quarterly.ts — Quarterly results (spec §C.3 "Quarterly results").
import { type V, ratio, sub } from "../values";
import { type DeriveContext, type DeriverTable, isRow, qField, qRow, quarterly } from "./common";

const qOperatingProfit = (c: DeriveContext, i: number, k: number): V =>
  sub(qField(c, i, k, "revenue"), qField(c, i, k, "operating_expenses"));

/** q net_profit_owners ?? q net_profit. */
function qNetProfit(c: DeriveContext, i: number, k: number): V {
  const row = qRow(c, i, k);
  if (!isRow(row)) return row;
  const owners = qField(c, i, k, "net_profit_owners");
  return owners.v !== null ? owners : qField(c, i, k, "net_profit");
}

export const QUARTERLY_DERIVERS: DeriverTable = {
  q_sales: quarterly((c, i, k) => qField(c, i, k, "revenue")),
  q_operating_profit: quarterly(qOperatingProfit),
  q_opm: quarterly((c, i, k) => ratio(qOperatingProfit(c, i, k), qField(c, i, k, "revenue"), "non_positive_denominator", 100)),
  q_net_profit: quarterly(qNetProfit),
};
