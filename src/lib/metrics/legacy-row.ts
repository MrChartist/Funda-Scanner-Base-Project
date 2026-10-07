// src/lib/metrics/legacy-row.ts — v0 StockRow snapshots for legacy consumers (spec §B.2, §B.12).
// Every number comes from the store's default column, so the old Screener and the new pages
// show the same figures. Missing numbers are NaN (the legacy convention), never 0.
import type { LegacyNumericKey, MetricStore, StockRow } from "@/lib/contracts";
import { LEGACY_KEY_TO_METRIC } from "@/lib/contracts";

const LEGACY_NUMERIC_KEYS = Object.keys(LEGACY_KEY_TO_METRIC) as LegacyNumericKey[];

export function toStockRows(store: MetricStore): StockRow[] {
  const columns = LEGACY_NUMERIC_KEYS.map((key) => [key, store.column(LEGACY_KEY_TO_METRIC[key])] as const);
  const rows: StockRow[] = [];
  for (let i = 0; i < store.size; i++) {
    const c = store.company(i);
    const row = { symbol: c.symbol, name: c.name, sector: c.sector, industry: store.industry(i) } as StockRow;
    for (const [key, col] of columns) row[key] = col.reasons[i] === 0 && Number.isFinite(col.values[i]) ? col.values[i] : Number.NaN;
    rows.push(row);
  }
  return rows;
}
