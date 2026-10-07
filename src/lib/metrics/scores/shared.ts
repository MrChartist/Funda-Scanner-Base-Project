// src/lib/metrics/scores/shared.ts — helpers shared by the score modules (WS3).
// Scores read line items through the public MetricStore API, so the score column and its
// explanation always use the same inputs.
import type { Evidence, MetricColumn, MetricId, MetricStore, MetricValue, PeriodSel } from "@/lib/contracts";
import { formatMetric } from "@/lib/format/metric-value";
import { formatNumberIN, formatPercent } from "@/lib/format/indian";

export const SCORE_METHODOLOGY_VERSION = "2026.1";

export const fySel = (offset: number): PeriodSel => ({ freq: "fy", offset });

/** Per-store column lookups (id → FY slot → column), so scores computed for every company stay cheap. */
const columnCache = new WeakMap<MetricStore, Map<MetricId, MetricColumn[]>>();

/** Reads a metric at an FY slot as a plain number (null when missing). */
export function fyNum(store: MetricStore, id: MetricId, i: number, k: number): number | null {
  let byId = columnCache.get(store);
  if (!byId) {
    byId = new Map();
    columnCache.set(store, byId);
  }
  let cols = byId.get(id);
  if (!cols) {
    cols = [];
    byId.set(id, cols);
  }
  const col = cols[k] ?? (cols[k] = store.columnAt(id, fySel(k)));
  return col.reasons[i] === 0 && Number.isFinite(col.values[i]) ? col.values[i] : null;
}

/** One piece of evidence: metric value at an FY slot with its label and display text. */
export function evidenceAt(store: MetricStore, id: MetricId, i: number, k: number): Evidence {
  const value: MetricValue = store.at(id, i, fySel(k));
  const def = store.def(id);
  const period = store.periodLabel(i, fySel(k));
  const short = def ? def.short : id;
  return {
    metric: id,
    label: period ? `${short} · ${period}` : short,
    value,
    display: def ? formatMetric(def, value) : value.v === null ? "—" : formatNumberIN(value.v, 2),
    period,
  };
}

/** "FY26" for slot k, or "year k before the latest" when the slot is empty. */
export function fyName(store: MetricStore, i: number, k: number): string {
  return store.periodLabel(i, fySel(k)) ?? (k === 0 ? "the latest year" : `${k} year${k === 1 ? "" : "s"} before the latest`);
}

export const pctText = (fraction: number, decimals = 1): string => formatPercent(fraction * 100, decimals);
export const numText = (v: number, decimals = 2): string => formatNumberIN(v, decimals);
