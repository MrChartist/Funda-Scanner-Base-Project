// src/lib/metrics/series.ts — window inputs shared by store variants and FSQL functions (WS3).
//
// AggregateWindow and CagrColumn (metrics/windows.ts) report transition_period only when an
// input column carries it. A year-level value in a restated or transition year is still shown
// as it is, so these helpers build the window inputs: the store's column at each FY slot with
// flagged years marked transition_period. The store computes every windowed and CAGR variant
// through these functions, and FSQL can call them too, so column("roce_avg_5y") equals
// avg(roce, 5y) exactly. They read only the public MetricStore API and the company records.
import type { MetricColumn, MetricId, MetricStore, WindowAggregate } from "@/lib/contracts";
import { NULL_REASONS } from "@/lib/contracts";
import { aggregateWindow, cagrColumn, setNull } from "./windows";

const NAF = NULL_REASONS.indexOf("not_applicable_financial");

interface SeriesCache {
  /** flagged[i] = fiscal years of company i that are restated or transition years. */
  flagged: (ReadonlySet<number> | null)[];
  latestFy: (number | null)[];
  windowInputs: Map<string, MetricColumn>;
}

const caches = new WeakMap<MetricStore, SeriesCache>();

function cacheFor(store: MetricStore): SeriesCache {
  let c = caches.get(store);
  if (!c) {
    const flagged: (ReadonlySet<number> | null)[] = [];
    const latestFy: (number | null)[] = [];
    for (let i = 0; i < store.size; i++) {
      let latest: number | null = null;
      let set: Set<number> | null = null;
      for (const r of store.company(i).annual) {
        if (!Number.isInteger(r.fiscal_year)) continue;
        if (latest === null || r.fiscal_year > latest) latest = r.fiscal_year;
        if (r.flags.length > 0) (set ??= new Set()).add(r.fiscal_year);
      }
      flagged.push(set);
      latestFy.push(latest);
    }
    c = { flagged, latestFy, windowInputs: new Map() };
    caches.set(store, c);
  }
  return c;
}

/** True when FY slot k of company i is a restated or transition year. */
export function isTransitionSlot(store: MetricStore, i: number, k: number): boolean {
  const c = cacheFor(store);
  const latest = c.latestFy[i];
  const set = c.flagged[i];
  return latest !== null && set !== null && set.has(latest - k);
}

/** The store's column at FY slot k with restated and transition years marked transition_period. */
export function windowInput(store: MetricStore, id: MetricId, k: number): MetricColumn {
  const c = cacheFor(store);
  const key = `${id}@fy${k}`;
  const hit = c.windowInputs.get(key);
  if (hit) return hit;
  const src = store.columnAt(id, { freq: "fy", offset: k });
  let out: MetricColumn | null = null;
  for (let i = 0; i < store.size; i++) {
    if (src.reasons[i] === NAF || !isTransitionSlot(store, i, k)) continue;
    out ??= { id: key, values: Float64Array.from(src.values), reasons: Uint8Array.from(src.reasons), flags: Uint16Array.from(src.flags) };
    setNull(out, i, "transition_period");
  }
  const result = out ?? { id: key, values: src.values, reasons: src.reasons, flags: src.flags };
  c.windowInputs.set(key, result);
  return result;
}

/** Window inputs for FY slots offset … offset + years − 1 (k = 0 is the most recent year). */
export function windowColumns(store: MetricStore, id: MetricId, years: number, offset = 0): MetricColumn[] {
  const out: MetricColumn[] = [];
  for (let j = 0; j < years; j++) out.push(windowInput(store, id, offset + j));
  return out;
}

/** aggregateWindow over windowColumns: avg(x, Ny), min(x, Ny), … ending at FY slot `offset`. */
export function windowAggregate(
  store: MetricStore, kind: WindowAggregate, id: MetricId, years: number, offset = 0, outId: MetricId = `${kind}(${id},${years}y)`,
): MetricColumn {
  return aggregateWindow(kind, windowColumns(store, id, years, offset), outId);
}

/**
 * cagr(x, Ny) ending at FY slot `offset`: cagrColumn over the window inputs at both ends, then
 * transition_period when any year in between is restated or a transition year.
 */
export function cagrWindow(store: MetricStore, id: MetricId, years: number, offset = 0, outId: MetricId = `cagr(${id},${years}y)`): MetricColumn {
  const end = windowInput(store, id, offset);
  const start = windowInput(store, id, offset + years);
  const out = cagrColumn(end, start, years, outId);
  for (let i = 0; i < store.size; i++) {
    if (out.reasons[i] === NAF) continue;
    for (let k = offset; k <= offset + years; k++) {
      if (isTransitionSlot(store, i, k)) {
        setNull(out, i, "transition_period");
        break;
      }
    }
  }
  return out;
}
