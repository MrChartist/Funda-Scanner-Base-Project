// src/components/screener/scale.ts — percentile scale for the in-cell data bars.
// A bar shows where a value sits among the companies listed in the results (the whole result set,
// not only the visible page): the longest bar is the highest value, the shortest the lowest.
// It describes position only. It is never a quality score.
import type { ResolvedColumn, ScreenRun } from "@/lib/contracts";

/** Units that get a bar: percentages and percentage-point changes. */
const BAR_UNITS: ReadonlySet<string> = new Set(["pct", "pp"]);

export function hasBar(column: ResolvedColumn): boolean {
  return column.metricId !== null && column.unit !== null && BAR_UNITS.has(column.unit);
}

/** Sorted finite values of one column over the listed companies. */
export type Scale = Float64Array;

export function buildScales(run: ScreenRun): Map<string, Scale> {
  const scales = new Map<string, Scale>();
  for (const c of run.columns) {
    if (!hasBar(c)) continue;
    const values: number[] = [];
    for (const i of run.matched) {
      const v = c.column.values[i];
      if (c.column.reasons[i] === 0 && Number.isFinite(v)) values.push(v);
    }
    scales.set(c.key, Float64Array.from(values).sort());
  }
  return scales;
}

/** Position of v among the sorted values, 0 to 1 (ties share the middle of their run). Null when there is no scale. */
export function percentileIn(sorted: Scale | undefined, v: number): number | null {
  if (!sorted || sorted.length === 0 || !Number.isFinite(v)) return null;
  if (sorted.length === 1) return 0.5;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  const first = lo;
  hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  const last = lo - 1;
  return Math.min(1, Math.max(0, (first + last) / 2 / (sorted.length - 1)));
}

export const BAR_LEGEND =
  "Bar length shows where a value sits among the companies listed here: the longest bar is the highest value, the shortest the lowest. It describes position only, not quality.";
