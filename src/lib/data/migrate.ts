// src/lib/data/migrate.ts — one-time move of the v0 "funda-imported-data" key (WS1, §B.12).
// The v0 key held { name, rows: StockRow[] } with null for missing numbers. It is converted to a
// snapshot-only dataset and written to persistent storage; the old key is removed ONLY after the
// write succeeds, so a failure never loses the user's data.
import type { FundamentalsDataset } from "@/lib/contracts";
import { STORAGE_KEYS } from "@/lib/contracts";
import { readRaw, removeKey } from "@/lib/user/storage";
import { datasetFromStockRows, stockRowsFromStored } from "./providers/legacy-adapter";
import { saveDataset, storageAdapters, type DatasetStorageAdapter, type PersistKind } from "./storage";

/** Access to the legacy key; injectable for tests. */
export interface LegacyKeyAccess {
  read(): string | null;
  remove(): void;
}

export const legacyLocalStorageKey: LegacyKeyAccess = {
  read: () => readRaw(STORAGE_KEYS.importedLegacy),
  remove: () => {
    removeKey(STORAGE_KEYS.importedLegacy);
  },
};

export interface LegacyMigration {
  /** The converted dataset (usable even when it could not be saved). */
  dataset: FundamentalsDataset;
  /** Where it was saved; "memory" means the write failed and the old key was kept. */
  persisted: PersistKind;
  /** True when the old key was removed. */
  removedLegacyKey: boolean;
}

/** Parses the v0 value; null when it is absent, unreadable or empty. */
export function readLegacyImport(text: string | null): FundamentalsDataset | null {
  if (text === null) return null;
  let saved: unknown;
  try {
    saved = JSON.parse(text);
  } catch {
    return null;
  }
  const o = saved as { name?: unknown; rows?: unknown } | null;
  if (!o || !Array.isArray(o.rows)) return null;
  const rows = o.rows.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null && !Array.isArray(r));
  const ds = datasetFromStockRows(stockRowsFromStored(rows), {
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : "Imported data",
    isSynthetic: false,
    source: "user_import",
  });
  return ds.companies.length ? ds : null;
}

/**
 * Moves the v0 key into persistent storage. Returns null when there is nothing to migrate.
 * importedAt stays null: the original import time was never recorded.
 */
export async function migrateLegacyImport(
  o: { legacy?: LegacyKeyAccess; adapters?: readonly DatasetStorageAdapter[] } = {},
): Promise<LegacyMigration | null> {
  const legacy = o.legacy ?? legacyLocalStorageKey;
  const dataset = readLegacyImport(legacy.read());
  if (!dataset) return null;
  dataset.meta.files = [{ name: dataset.meta.name, kind: "snapshot", rows: dataset.companies.length }];
  dataset.meta.notes = ["Moved from an earlier version of Funda Scanner; the original import time was not recorded."];
  const persisted = await saveDataset(dataset, o.adapters ?? storageAdapters());
  if (persisted === "memory") return { dataset, persisted, removedLegacyKey: false };
  legacy.remove();
  return { dataset, persisted, removedLegacyKey: true };
}
