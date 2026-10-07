// src/hooks/use-data-provider.ts — the active provider for legacy (v0) callers (WS1).
// New code uses useDataset() from "./use-dataset". The original Screener page still reads
// provider.getUniverse(); v2 providers (sample, imported) do not have it, so this hook returns a
// stable view of the provider whose getUniverse() reads the dataset through the metric store.
import { useSyncExternalStore } from "react";
import type { DataProvider, StockRow } from "@/lib/contracts";
import { getDataProvider, loadDataset, subscribeDataProvider } from "@/lib/data";
import { createStore } from "@/lib/engine";
import { toStockRows } from "@/lib/metrics";

const views = new WeakMap<DataProvider, DataProvider>();

/** A provider that always has getUniverse(); v0 providers are returned unchanged. */
export function legacyProviderView(p: DataProvider): DataProvider {
  if (typeof p.getUniverse === "function") return p;
  let view = views.get(p);
  if (!view) {
    view = {
      id: p.id,
      name: p.name,
      isDemo: p.isDemo,
      revision: p.revision,
      getDataset: p.getDataset?.bind(p),
      async getUniverse(): Promise<StockRow[]> {
        return toStockRows(createStore(await loadDataset(p)));
      },
    };
    views.set(p, view);
  }
  return view;
}

function snapshot(): DataProvider {
  return legacyProviderView(getDataProvider());
}

/** Current data provider; re-renders when it is swapped (e.g. after an import). */
export function useDataProvider(): DataProvider {
  return useSyncExternalStore(subscribeDataProvider, snapshot, snapshot);
}
