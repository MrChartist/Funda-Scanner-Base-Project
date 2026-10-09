// Pure data preparation for the Dashboard charts. Every number comes from the loaded store;
// nothing is invented, and every company left out is counted so the page can say why.
import type { MetricStore } from "@/lib/contracts";

/** Fewer plotted companies than this and a distribution chart says little: show what is needed instead. */
export const MIN_PLOTTED = 8;
/** Scatter points above this are thinned (highlighted companies are always kept). */
export const MAX_SCATTER_POINTS = 1500;

export function quantile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function sortedFinite(values: Iterable<number>): number[] {
  const out: number[] = [];
  for (const v of values) if (Number.isFinite(v)) out.push(v);
  return out.sort((a, b) => a - b);
}

/** ROCE as a five-year average when the data supports it, else the latest value. */
export function pickRoceId(store: MetricStore): { id: string; label: string } | null {
  for (const [id, label] of [["roce_avg_5y", "ROCE (5-year average)"], ["roce", "ROCE (latest year)"]] as const) {
    if (!store.def(id)) continue;
    const col = store.column(id);
    let any = 0;
    for (let i = 0; i < store.size && any < MIN_PLOTTED; i++) if (store.family(i) === "non_financial" && Number.isFinite(col.values[i])) any++;
    if (any >= MIN_PLOTTED) return { id, label };
  }
  return null;
}

export interface ScatterPoint {
  i: number;
  x: number;
  y: number;
}

export interface UniverseData {
  xId: string;
  xLabel: string;
  yId: string;
  yLabel: string;
  /** Non-financial companies with both values. */
  eligible: number;
  nonFinancial: number;
  /** Companies of other types (lenders, insurers): not plotted. */
  otherTypes: number;
  /** Non-financial companies lacking either value. */
  missing: number;
  medianX: number;
  medianY: number;
  xDomain: [number, number];
  yDomain: [number, number];
  xTicks: number[];
  yTicks: number[];
  /** Inside both axis ranges (before thinning). */
  inRange: ScatterPoint[];
  /** Outside the axis range: counted, not drawn. */
  outliers: number;
  /** Points above both medians (high return, high yield). */
  topRight: number;
}

/** Round axis bounds and ticks on 1, 2 or 5 times a power of ten. */
export function niceAxis(lo: number, hi: number, target = 5): { domain: [number, number]; ticks: number[] } {
  const span = hi - lo || 1;
  const raw = span / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((c) => c >= raw) ?? 10 * pow;
  const a = Math.floor(lo / step) * step;
  const b = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = a; t <= b + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { domain: [a, b], ticks };
}

export function buildUniverse(store: MetricStore): UniverseData | null {
  const x = pickRoceId(store);
  if (!x || !store.def("earnings_yield")) return null;
  const xs = store.column(x.id);
  const ys = store.column("earnings_yield");
  const pts: ScatterPoint[] = [];
  let nonFinancial = 0;
  for (let i = 0; i < store.size; i++) {
    if (store.family(i) !== "non_financial") continue;
    nonFinancial++;
    const a = xs.values[i];
    const b = ys.values[i];
    if (Number.isFinite(a) && Number.isFinite(b)) pts.push({ i, x: a, y: b });
  }
  if (pts.length < MIN_PLOTTED) return null;
  const sx = sortedFinite(pts.map((p) => p.x));
  const sy = sortedFinite(pts.map((p) => p.y));
  // Winsorise the view, not the data: the axes span the 2nd to 98th percentile; the rest is counted.
  const xa = niceAxis(quantile(sx, 0.02) ?? 0, quantile(sx, 0.98) ?? 1);
  const ya = niceAxis(quantile(sy, 0.02) ?? 0, quantile(sy, 0.98) ?? 1);
  const xDomain = xa.domain;
  const yDomain = ya.domain;
  const inRange = pts.filter((p) => p.x >= xDomain[0] && p.x <= xDomain[1] && p.y >= yDomain[0] && p.y <= yDomain[1]);
  const medianX = quantile(sx, 0.5) ?? 0;
  const medianY = quantile(sy, 0.5) ?? 0;
  return {
    xId: x.id,
    xLabel: x.label,
    yId: "earnings_yield",
    yLabel: "Earnings yield",
    eligible: pts.length,
    nonFinancial,
    otherTypes: store.size - nonFinancial,
    missing: nonFinancial - pts.length,
    medianX,
    medianY,
    xDomain,
    yDomain,
    xTicks: xa.ticks,
    yTicks: ya.ticks,
    inRange,
    outliers: pts.length - inRange.length,
    topRight: pts.filter((p) => p.x > medianX && p.y > medianY).length,
  };
}

/** Keeps every highlighted point and an even spread of the rest, up to `max` in all. */
export function thin(points: ScatterPoint[], highlighted: ReadonlySet<number> | null, max = MAX_SCATTER_POINTS): { shown: ScatterPoint[]; thinned: boolean } {
  if (points.length <= max) return { shown: points, thinned: false };
  const keep = highlighted ? points.filter((p) => highlighted.has(p.i)) : [];
  const rest = highlighted ? points.filter((p) => !highlighted.has(p.i)) : points;
  const room = Math.max(0, max - keep.length);
  const stride = rest.length / Math.max(1, room);
  const picked: ScatterPoint[] = [];
  for (let k = 0; k < room && Math.floor(k * stride) < rest.length; k++) picked.push(rest[Math.floor(k * stride)]);
  return { shown: [...keep, ...picked], thinned: true };
}

export interface HistBin {
  lo: number;
  hi: number;
  count: number;
  /** End bins absorb values beyond the visible range. */
  open: "low" | "high" | null;
}

export interface HistogramData {
  id: string;
  label: string;
  n: number;
  nonFinancial: number;
  missing: number;
  bins: HistBin[];
  q1: number;
  median: number;
  q3: number;
  above25: number;
  negative: number;
  lo: number;
  hi: number;
}

export function buildHistogram(store: MetricStore, bins = 20): HistogramData | null {
  const x = pickRoceId(store);
  if (!x) return null;
  const col = store.column(x.id);
  const vals: number[] = [];
  let nonFinancial = 0;
  for (let i = 0; i < store.size; i++) {
    if (store.family(i) !== "non_financial") continue;
    nonFinancial++;
    if (Number.isFinite(col.values[i])) vals.push(col.values[i]);
  }
  if (vals.length < MIN_PLOTTED) return null;
  vals.sort((a, b) => a - b);
  const lo = Math.floor(quantile(vals, 0.02) ?? 0);
  let hi = Math.ceil(quantile(vals, 0.98) ?? 1);
  if (hi <= lo) hi = lo + 1;
  const step = (hi - lo) / bins;
  const out: HistBin[] = Array.from({ length: bins }, (_, k) => ({
    lo: lo + k * step,
    hi: lo + (k + 1) * step,
    count: 0,
    open: k === 0 ? "low" : k === bins - 1 ? "high" : null,
  }));
  for (const v of vals) out[Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / step)))].count++;
  return {
    id: x.id,
    label: x.label,
    n: vals.length,
    nonFinancial,
    missing: nonFinancial - vals.length,
    bins: out,
    q1: quantile(vals, 0.25) ?? 0,
    median: quantile(vals, 0.5) ?? 0,
    q3: quantile(vals, 0.75) ?? 0,
    above25: vals.filter((v) => v > 25).length,
    negative: vals.filter((v) => v < 0).length,
    lo,
    hi,
  };
}
