// src/lib/data/registry.ts — the active data provider (WS1).
// Accepts v2 providers (getDataset) and v0 providers (getUniverse only, wrapped by the legacy
// adapter). Listeners are told about every switch; the React Query key in useDataset is
// ["dataset", provider.id, provider.revision ?? 0], so a switch mid-load always shows the latest
// provider's data.
import type { DataProvider, FundamentalsDataset } from "@/lib/contracts";
import { createSampleProvider, SAMPLE_PROVIDER_ID } from "@/lib/sample/sample-provider";
import { normalizeDataset } from "./normalize";
import { datasetFromStockRows } from "./providers/legacy-adapter";
import { IMPORTED_PROVIDER_ID } from "./providers/imported";

let active: DataProvider = createSampleProvider();
let switches = 0;
const listeners = new Set<() => void>();

export function getDataProvider(): DataProvider {
  return active;
}

/** Number of provider switches so far; changes whenever listeners are notified. */
export function getProviderSwitchCount(): number {
  return switches;
}

/** Accepts v2 providers (getDataset) and v0 providers (getUniverse only). Throws if neither is present. */
export function setDataProvider(p: DataProvider): void {
  if (!p || (typeof p.getDataset !== "function" && typeof p.getUniverse !== "function")) {
    throw new TypeError(`Data provider "${p?.id ?? "(none)"}" must implement getDataset() or getUniverse().`);
  }
  active = p;
  switches += 1;
  listeners.forEach((l) => l());
}

export function subscribeDataProvider(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Built-in providers already serve normalised data; anything else is normalised on load. */
function isBuiltIn(p: DataProvider): boolean {
  return p.id === SAMPLE_PROVIDER_ID || p.id === IMPORTED_PROVIDER_ID;
}

/** Loads a provider's data as a canonical dataset (v2 loader preferred, v0 rows adapted). */
export async function loadDataset(p: DataProvider, signal?: AbortSignal): Promise<FundamentalsDataset> {
  if (typeof p.getDataset === "function") {
    const ds = await p.getDataset(signal);
    if (isBuiltIn(p)) return ds;
    const meta = { ...ds.meta, source: ds.meta.source ?? "custom_provider" };
    return normalizeDataset({ ...ds, meta }, { file: null, issues: [] }, p.name);
  }
  if (typeof p.getUniverse === "function") {
    const rows = await p.getUniverse();
    return datasetFromStockRows(rows, { name: p.name, isSynthetic: p.isDemo });
  }
  throw new TypeError(`Data provider "${p.id}" has no loader.`);
}
