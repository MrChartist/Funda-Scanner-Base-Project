// src/hooks/use-dataset.ts — React access to the active dataset and its metric store (WS1).
// React Query keyed by ["dataset", provider.id, provider.revision ?? 0] with staleTime Infinity:
// a provider switch mid-load always shows the latest provider's data, and a dataset is turned
// into a store once (createStore caches one store per dataset object).
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CompanyState, DataProvider, DatasetState, FundamentalsDataset, MetricStore } from "@/lib/contracts";
import { getDataProvider, loadDataset, providerInfo, subscribeDataProvider } from "@/lib/data";
import { createStore } from "@/lib/engine";

interface Loaded {
  dataset: FundamentalsDataset;
  store: MetricStore;
}

/** The React Query key for a provider's dataset. */
export function datasetQueryKey(p: DataProvider): readonly [string, string, number] {
  return ["dataset", p.id, p.revision ?? 0] as const;
}

/** The active provider; re-renders when it is swapped. */
export function useActiveProvider(): DataProvider {
  return useSyncExternalStore(subscribeDataProvider, getDataProvider, getDataProvider);
}

export function useDataset(): DatasetState {
  const provider = useActiveProvider();
  const query = useQuery<Loaded, Error>({
    queryKey: datasetQueryKey(provider),
    staleTime: Infinity,
    retry: false,
    queryFn: async ({ signal }) => {
      const dataset = await loadDataset(provider, signal);
      return { dataset, store: createStore(dataset) };
    },
  });
  if (query.data) {
    return { status: "ready", provider, dataset: query.data.dataset, store: query.data.store, report: providerInfo(provider).report };
  }
  if (query.error) {
    return {
      status: "error",
      provider,
      message: query.error.message || "The data could not be loaded.",
      retry: () => {
        void query.refetch();
      },
    };
  }
  return { status: "loading", provider };
}

export function useStore(): MetricStore | null {
  const state = useDataset();
  return state.status === "ready" ? state.store : null;
}

export function useCompany(symbol: string | undefined): CompanyState {
  const state = useDataset();
  if (state.status === "loading") return { status: "loading" };
  if (state.status === "error") return { status: "error", message: state.message, retry: state.retry };
  const wanted = (symbol ?? "").trim().toUpperCase();
  const index = wanted ? state.store.indexOf(wanted) : -1;
  if (index < 0) return { status: "not_found", symbol: wanted };
  return { status: "ready", symbol: state.store.symbols[index], index, store: state.store };
}
