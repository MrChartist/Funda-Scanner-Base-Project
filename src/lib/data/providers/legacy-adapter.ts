// src/lib/data/providers/legacy-adapter.ts — v0 StockRow snapshots → canonical dataset (WS1, §B.12).
// Each row becomes a snapshot-only CompanyRecord: market_cap → market.market_cap_supplied,
// price → market.price, every other key → snapshot[LEGACY_KEY_TO_METRIC[key]]; NaN values are omitted.
import type { CompanyRecord, DatasetSource, FundamentalsDataset, LegacyNumericKey, StockRow } from "@/lib/contracts";
import { DATASET_SCHEMA, DATASET_VERSION, LEGACY_KEY_TO_METRIC } from "@/lib/contracts";
import { defaultMeta, emptyCompany, UNCLASSIFIED_SECTOR } from "../normalize";

const LEGACY_KEYS = Object.keys(LEGACY_KEY_TO_METRIC) as LegacyNumericKey[];

function finiteOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim();
}

/** One snapshot-only CompanyRecord for a legacy row; null when the row has no symbol. */
export function companyFromStockRow(r: StockRow): CompanyRecord | null {
  const symbol = text(r.symbol).toUpperCase();
  if (!symbol) return null;
  const c = emptyCompany(symbol);
  c.name = text(r.name) || symbol;
  c.sector = text(r.sector) || UNCLASSIFIED_SECTOR;
  c.industry = text(r.industry) || null;
  c.market.price = finiteOrNull(r.price);
  c.market.market_cap_supplied = finiteOrNull(r.market_cap);
  for (const k of LEGACY_KEYS) {
    if (k === "price" || k === "market_cap") continue;
    const v = finiteOrNull(r[k]);
    if (v !== null) c.snapshot[LEGACY_KEY_TO_METRIC[k]] = v;
  }
  return c;
}

/** Legacy rows → a snapshot-only dataset. Duplicate symbols: the later row wins. */
export function datasetFromStockRows(
  rows: readonly StockRow[], o: { name: string; isSynthetic: boolean; source?: DatasetSource },
): FundamentalsDataset {
  const bySymbol = new Map<string, CompanyRecord>();
  for (const r of rows) {
    const c = companyFromStockRow(r);
    if (c) bySymbol.set(c.symbol, c);
  }
  const meta = defaultMeta(o.name, o.source ?? (o.isSynthetic ? "synthetic_sample" : "custom_provider"));
  meta.isSynthetic = o.isSynthetic;
  return { schema: DATASET_SCHEMA, version: DATASET_VERSION, meta, companies: [...bySymbol.values()] };
}

/** JSON cannot hold NaN, so stored legacy rows use null; this restores the v0 NaN convention. */
export function stockRowsFromStored(rows: readonly Record<string, unknown>[]): StockRow[] {
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null ? Number.NaN : v])) as unknown as StockRow);
}
