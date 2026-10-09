// src/lib/data/index.ts — data platform public API (WS1).
//
//  • Registry: getDataProvider / setDataProvider / subscribeDataProvider (v0 and v2 providers).
//  • Import: importFiles (canonical JSON, legacy snapshot, companies/annual/quarterly/shareholding CSV),
//    detectFileKind, validation report with E/W/I codes.
//  • Storage: activateImportedDataset (IndexedDB → localStorage → memory), restoreActiveProvider
//    (boot, including the one-time v0 migration), clearImportedData.
//  • Health: computeDataHealth.
import type { DataProvider, FundamentalsDataset, ImportOutcome } from "@/lib/contracts";
import type { ImportFileInput, ImportOptions } from "./import";
import { STORAGE_KEYS } from "@/lib/contracts";
import { nowIso } from "@/lib/time/clock";
import { readRaw } from "@/lib/user/storage";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import { getDataProvider, setDataProvider } from "./registry";
import { createImportedProvider, IMPORTED_PROVIDER_ID, providerInfo, setProviderInfo } from "./providers/imported";
import {
  clearSavedDatasets, loadSavedDataset, readActiveSource, saveDataset, storageAdapters, type PersistKind,
} from "./storage";
import { legacyLocalStorageKey, migrateLegacyImport, type LegacyKeyAccess } from "./migrate";

export { getDataProvider, setDataProvider, subscribeDataProvider, loadDataset, getProviderSwitchCount } from "./registry";
export { datasetFromStockRows, companyFromStockRow } from "./providers/legacy-adapter";
export { FILE_KIND_LABEL } from "./import/kind-labels";
export type { ImportFileInput, ImportOptions } from "./import";
export { detectFileKind } from "./import/detect";
export { exportDatasetJson, exportFileName } from "./import/canonical-export";
export { MONEY_SCALES, MONEY_SCALE_LABEL, type MoneyScale } from "./import/units";
export { computeDataHealth, ASSUMED_ZERO_TEXT, MISMATCH_THRESHOLD_PCT } from "./health";
export { validateCompany, validateDataset, ISIN_PATTERN } from "./validate";
export { normalizeDataset } from "./normalize";
export { providerInfo, IMPORTED_PROVIDER_ID, type ProviderInfo } from "./providers/imported";
export { setStorageAdapters, type PersistKind, type DatasetStorageAdapter } from "./storage";

/**
 * Reads, checks and joins the dropped files into a dataset plus a validation report. The importer
 * (parsers, zod schemas, validation) is a separate chunk fetched on the first call, so the app
 * opens without it.
 */
export async function importFiles(files: readonly ImportFileInput[], o: ImportOptions = {}): Promise<ImportOutcome> {
  const { importFiles: run } = await import("./import");
  return run(files, o);
}

let importRevision = 0;

function nextRevision(): number {
  importRevision += 1;
  return importRevision;
}

/**
 * Makes an imported dataset the active provider. Records the real import time, keeps the file's
 * own "synthetic" flag (a re-imported sample stays labelled fictional) and saves the dataset:
 * IndexedDB first, then localStorage (2 MB or smaller), else memory only.
 */
export async function activateImportedDataset(o: ImportOutcome): Promise<{ persisted: PersistKind }> {
  if (!o.dataset) throw new Error("There is no dataset to activate. Fix the errors in the import report first.");
  const dataset: FundamentalsDataset = {
    ...o.dataset,
    meta: { ...o.dataset.meta, source: "user_import", importedAt: nowIso() },
  };
  const persisted = await saveDataset(dataset, storageAdapters());
  setDataProvider(createImportedProvider(dataset, { revision: nextRevision(), persisted, report: o.report }));
  return { persisted };
}

/** Message used when a remembered import is no longer in this browser's storage. */
export const RESTORE_MISSING_MESSAGE =
  "Your imported data is no longer saved in this browser, so the sample data is shown. Import your files again to use them.";

/**
 * Chooses the provider at start-up, synchronously. When the user's last choice was an import (or
 * a v0 import is still stored), the active provider loads it from storage on first use, migrating
 * the v0 key once. Otherwise the sample provider is used.
 */
export function restoreActiveProvider(o: { legacy?: LegacyKeyAccess } = {}): DataProvider {
  const legacy = o.legacy ?? legacyLocalStorageKey;
  const hasLegacy = (() => {
    try {
      return legacy.read() !== null;
    } catch {
      return false;
    }
  })();
  if (readActiveSource() !== "imported" && !hasLegacy) {
    const current = getDataProvider();
    if (current.id === IMPORTED_PROVIDER_ID) setDataProvider(createSampleProvider());
    return getDataProvider();
  }
  const provider: DataProvider = {
    id: IMPORTED_PROVIDER_ID,
    name: "Your imported data",
    isDemo: false,
    revision: 0,
    async getDataset() {
      if (hasLegacy) {
        const migrated = await migrateLegacyImport({ legacy, adapters: storageAdapters() });
        if (migrated) {
          setProviderInfo(provider, { persisted: migrated.persisted });
          return migrated.dataset;
        }
      }
      const saved = await loadSavedDataset(storageAdapters());
      if (saved) {
        setProviderInfo(provider, { persisted: saved.kind });
        return saved.dataset;
      }
      await clearSavedDatasets(storageAdapters());
      if (getDataProvider() === provider) setDataProvider(createSampleProvider());
      throw new Error(RESTORE_MISSING_MESSAGE);
    },
  };
  setDataProvider(provider);
  return provider;
}

/** Forgets the imported dataset (every stored copy and the v0 key) and returns to the sample data. */
export async function clearImportedData(o: { legacy?: LegacyKeyAccess } = {}): Promise<void> {
  const legacy = o.legacy ?? legacyLocalStorageKey;
  await clearSavedDatasets(storageAdapters());
  try {
    legacy.remove();
  } catch {
    /* ignore */
  }
  setDataProvider(createSampleProvider());
}

/** Where the active provider's data is kept (null for the sample and custom providers). */
export function persistenceOf(p: DataProvider): PersistKind | null {
  return providerInfo(p).persisted;
}

/** True when a v0 import is still stored under the old key (it is migrated on the next load). */
export function hasLegacyImport(): boolean {
  return readRaw(STORAGE_KEYS.importedLegacy) !== null;
}
