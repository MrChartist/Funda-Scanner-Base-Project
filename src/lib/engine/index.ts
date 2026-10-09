// src/lib/engine/index.ts — composition root (lead-owned). The only module that wires
// metrics (WS3) and insight column providers (WS2) together.
import type { FundamentalsDataset, MetricStore } from "@/lib/contracts";
import { createMetricStore } from "@/lib/metrics";
import { insightColumnProviders } from "@/lib/insights";

const stores = new WeakMap<FundamentalsDataset, MetricStore>();

/** One store per dataset object; a new import creates a new dataset object and so a new store. */
export function createStore(dataset: FundamentalsDataset): MetricStore {
  let store = stores.get(dataset);
  if (!store) {
    store = createMetricStore(dataset, { providers: insightColumnProviders });
    stores.set(dataset, store);
  }
  return store;
}
