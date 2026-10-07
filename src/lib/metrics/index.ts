// src/lib/metrics/index.ts — public API of the metrics engine (WS3).
// metrics imports only contracts, time and format (spec §B.9).
import type { MetricDef } from "@/lib/contracts";
import { ALL_METRIC_DEFS } from "./variants";

export { CATALOGUE_VERSION } from "./catalogue";
export { aggregateWindow, cagrColumn } from "./windows";
export { createMetricStore } from "./store";
export { explainPiotroski } from "./scores/piotroski";
export { explainAltman } from "./scores/altman";
export { toStockRows } from "./legacy-row";
export { inferCompanyType, resolveCompanyType } from "./company-type";
/** Window inputs with restated/transition years marked, shared with FSQL window functions. */
export { cagrWindow, isTransitionSlot, windowAggregate, windowColumns, windowInput } from "./series";

export function allMetricDefs(): readonly MetricDef[] {
  return ALL_METRIC_DEFS;
}
