// src/lib/data/providers/imported.ts — the provider behind a dataset the user imported (WS1).
import type { DataProvider, FundamentalsDataset, ValidationReport } from "@/lib/contracts";
import type { PersistKind } from "../storage";

export const IMPORTED_PROVIDER_ID = "imported";

/** Facts about a provider that the contract does not carry: where its data is kept and its import report. */
export interface ProviderInfo {
  persisted: PersistKind | null;
  report: ValidationReport | null;
}

const info = new WeakMap<DataProvider, ProviderInfo>();

export function providerInfo(p: DataProvider): ProviderInfo {
  return info.get(p) ?? { persisted: null, report: null };
}

export function setProviderInfo(p: DataProvider, patch: Partial<ProviderInfo>): void {
  info.set(p, { ...providerInfo(p), ...patch });
}

/** A provider serving one already-normalised dataset. isDemo mirrors meta.isSynthetic. */
export function createImportedProvider(
  dataset: FundamentalsDataset, o: { revision: number; persisted: PersistKind; report?: ValidationReport | null },
): DataProvider {
  const p: DataProvider = {
    id: IMPORTED_PROVIDER_ID,
    name: dataset.meta.name || "Imported data",
    isDemo: dataset.meta.isSynthetic,
    revision: o.revision,
    async getDataset() {
      return dataset;
    },
  };
  setProviderInfo(p, { persisted: o.persisted, report: o.report ?? null });
  return p;
}
