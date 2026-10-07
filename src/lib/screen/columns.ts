// src/lib/screen/columns.ts — result columns (§D.12 step 8): defaults, metrics from the query
// (at most 8, marked "from query"), then the user's columns; plus the median footer row.
import type { ColumnSpec, CompiledQuery, MetricColumn, MetricId, MetricStore, ResolvedColumn } from "@/lib/contracts";
import { cachedMetricColumn, evaluateExpression } from "@/lib/query";

/** Default metric columns after Name and Sector. */
export const DEFAULT_COLUMNS: readonly MetricId[] = [
  "market_cap", "pe", "roce", "roe", "debt_equity", "sales_cagr_3y", "dividend_yield",
];

export const MAX_QUERY_COLUMNS = 8;

function metricColumn(store: MetricStore, id: MetricId, fromQuery: boolean): ResolvedColumn | null {
  const d = store.def(id);
  if (!d) return null;
  let column: MetricColumn;
  try {
    column = cachedMetricColumn(store, id);
  } catch {
    return null;
  }
  return {
    key: id, metricId: id, label: d.label, short: d.short, unit: d.unit, decimals: d.decimals, direction: d.direction,
    periodTag: d.periodTag, fromQuery, column,
  };
}

export function resolveColumns(store: MetricStore, specs: readonly ColumnSpec[] | null, compiled: CompiledQuery | null): ResolvedColumn[] {
  const out: ResolvedColumn[] = [];
  const seen = new Set<string>();
  const add = (col: ResolvedColumn | null) => {
    if (!col || seen.has(col.key)) return;
    seen.add(col.key);
    out.push(col);
  };
  for (const id of DEFAULT_COLUMNS) add(metricColumn(store, id, false));
  if (compiled && compiled.ok) {
    let added = 0;
    for (const id of compiled.metrics) {
      if (added >= MAX_QUERY_COLUMNS) break;
      if (seen.has(id)) continue;
      const col = metricColumn(store, id, true);
      if (col) {
        add(col);
        added++;
      }
    }
  }
  (specs ?? []).forEach((spec, k) => {
    if (spec.kind === "metric") {
      add(metricColumn(store, spec.id, false));
      return;
    }
    const res = evaluateExpression(spec.expr, store);
    if (!res.column) return;
    add({
      key: `expr:${k}`, metricId: null, label: spec.label || spec.expr, short: spec.label || spec.expr, unit: null, decimals: 2,
      direction: "neutral", periodTag: "Formula", fromQuery: false, column: res.column,
    });
  });
  return out;
}

/** Median of a column over the given store indices (non-null values only); null when none. */
export function medianOver(column: MetricColumn, indices: Int32Array): number | null {
  const xs: number[] = [];
  for (const i of indices) {
    const v = column.values[i];
    if (column.reasons[i] === 0 && Number.isFinite(v)) xs.push(v);
  }
  if (xs.length === 0) return null;
  xs.sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}
