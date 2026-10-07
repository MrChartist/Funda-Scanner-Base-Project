// src/lib/metrics/windows.ts — window aggregates shared by store variants and FSQL functions.
// Written in P0 and handed to WS3. Pure: typed arrays in, typed arrays out.
import type {
  AggregateWindow, CagrColumn, MetricColumn, MetricId, MetricValue, NullReason, NullReasonCode, WindowAggregate,
} from "@/lib/contracts";
import { NULL_REASONS, VF } from "@/lib/contracts";

const CODE: Readonly<Record<NullReasonCode, number>> = Object.fromEntries(
  NULL_REASONS.map((r, i) => [r, i]),
) as Record<NullReasonCode, number>;

/** NULL_REASONS index of a reason (0 = none). */
export function reasonCode(reason: NullReason | null): number {
  return reason === null ? 0 : CODE[reason];
}

/** Reason for a NULL_REASONS index; null for 0 or an unknown index. */
export function reasonFromCode(code: number): NullReason | null {
  if (code <= 0 || code >= NULL_REASONS.length) return null;
  return NULL_REASONS[code] as NullReason;
}

/** Flags that describe how inputs were obtained; they carry through aggregates. */
export const INHERITED_FLAGS: number =
  VF.Approximate | VF.Proxy | VF.ClosingBasis | VF.Provided | VF.InferredType | VF.SalesBasis | VF.AssumedZero | VF.FyFallback;

/** A column of n nulls with one reason (n = number of companies). */
export function nullColumn(id: MetricId, n: number, reason: NullReason): MetricColumn {
  const values = new Float64Array(n).fill(Number.NaN);
  const reasons = new Uint8Array(n).fill(reasonCode(reason));
  return { id, values, reasons, flags: new Uint16Array(n) };
}

/** An empty column ready to be filled with setValue/setNull. */
export function emptyColumn(id: MetricId, n: number): MetricColumn {
  return nullColumn(id, n, "missing_input");
}

export function setValue(col: MetricColumn, i: number, v: number, flags = 0): void {
  if (!Number.isFinite(v)) {
    setNull(col, i, "non_positive_denominator", flags);
    return;
  }
  col.values[i] = v;
  col.reasons[i] = 0;
  col.flags[i] = flags;
}

export function setNull(col: MetricColumn, i: number, reason: NullReason, flags = 0): void {
  col.values[i] = Number.NaN;
  col.reasons[i] = reasonCode(reason);
  col.flags[i] = flags;
}

/** True when entry i holds a usable number. */
export function isPresent(col: MetricColumn, i: number): boolean {
  return col.reasons[i] === 0 && Number.isFinite(col.values[i]);
}

/** Reads entry i as a MetricValue (the store's `get`). */
export function valueAt(col: MetricColumn, i: number): MetricValue {
  if (isPresent(col, i)) return { v: col.values[i], reason: null, flags: col.flags[i] };
  return { v: null, reason: reasonFromCode(col.reasons[i]) ?? "missing_input", flags: col.flags[i] };
}

function checkLengths(columns: readonly MetricColumn[]): number {
  if (columns.length === 0) return 0;
  const n = columns[0].values.length;
  for (const c of columns) {
    if (c.values.length !== n || c.reasons.length !== n || c.flags.length !== n) {
      throw new RangeError("Window columns must all have the same length");
    }
  }
  return n;
}

const NAF = CODE.not_applicable_financial;
const TP = CODE.transition_period;

/** Reason for a window with at least one null input (§B.4 AggregateWindow). */
function windowNullReason(columns: readonly MetricColumn[], i: number): NullReason {
  let sawTp = false;
  for (const c of columns) {
    if (isPresent(c, i)) continue;
    if (c.reasons[i] === NAF) return "not_applicable_financial";
    if (c.reasons[i] === TP) sawTp = true;
  }
  return sawTp ? "transition_period" : "insufficient_history";
}

function aggregate(kind: WindowAggregate, xs: number[]): number {
  const n = xs.length;
  switch (kind) {
    case "sum": {
      let s = 0;
      for (const x of xs) s += x;
      return s;
    }
    case "avg": {
      let s = 0;
      for (const x of xs) s += x;
      return s / n;
    }
    case "min": {
      let m = xs[0];
      for (const x of xs) if (x < m) m = x;
      return m;
    }
    case "max": {
      let m = xs[0];
      for (const x of xs) if (x > m) m = x;
      return m;
    }
    case "median": {
      const sorted = [...xs].sort((a, b) => a - b);
      const mid = Math.floor(n / 2);
      return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    case "stdev": {
      let s = 0;
      for (const x of xs) s += x;
      const mean = s / n;
      let ss = 0;
      for (const x of xs) ss += (x - mean) * (x - mean);
      return Math.sqrt(ss / n); // population standard deviation
    }
  }
}

/**
 * columns[k] = value column at window offset k (k = 0 is the most recent year of the window).
 * Non-null only when all N inputs are present. Otherwise not_applicable_financial or
 * transition_period if any input carries it, else insufficient_history. stdev is the
 * population standard deviation. Inherited input flags (Approximate, Provided, …) are OR-ed.
 */
export const aggregateWindow: AggregateWindow = (kind, columns, id) => {
  const n = checkLengths(columns);
  const out = emptyColumn(id, n);
  if (columns.length === 0) {
    for (let i = 0; i < n; i++) setNull(out, i, "insufficient_history");
    return out;
  }
  const xs: number[] = new Array<number>(columns.length);
  for (let i = 0; i < n; i++) {
    let complete = true;
    let flags = 0;
    for (let k = 0; k < columns.length; k++) {
      const c = columns[k];
      if (!isPresent(c, i)) {
        complete = false;
        break;
      }
      xs[k] = c.values[i];
      flags |= c.flags[i] & INHERITED_FLAGS;
    }
    if (!complete) {
      setNull(out, i, windowNullReason(columns, i));
      continue;
    }
    const v = aggregate(kind, xs);
    if (Number.isFinite(v)) setValue(out, i, v, flags);
    else setNull(out, i, "too_few_inputs", flags);
  }
  return out;
};

/**
 * ((end / start)^(1/years) − 1) × 100. When either end is null the input's reason carries
 * (not_applicable_financial, then transition_period, then the end's, then the start's reason).
 * When both are present but not both > 0 the result is non_positive_denominator, flagged
 * Turnaround when start ≤ 0 < end.
 */
export const cagrColumn: CagrColumn = (end, start, years, id) => {
  if (!Number.isFinite(years) || years <= 0) throw new RangeError(`cagrColumn: years must be positive, got ${years}`);
  const n = checkLengths([end, start]);
  const out = emptyColumn(id, n);
  for (let i = 0; i < n; i++) {
    const endOk = isPresent(end, i);
    const startOk = isPresent(start, i);
    if (!endOk || !startOk) {
      const codes = [endOk ? 0 : end.reasons[i], startOk ? 0 : start.reasons[i]];
      let reason: NullReason;
      if (codes.includes(NAF)) reason = "not_applicable_financial";
      else if (codes.includes(TP)) reason = "transition_period";
      else reason = reasonFromCode(codes[0] || codes[1]) ?? "missing_input";
      setNull(out, i, reason);
      continue;
    }
    const e = end.values[i];
    const s = start.values[i];
    const flags = (end.flags[i] | start.flags[i]) & INHERITED_FLAGS;
    if (!(e > 0 && s > 0)) {
      setNull(out, i, "non_positive_denominator", s <= 0 && e > 0 ? flags | VF.Turnaround : flags);
      continue;
    }
    const v = (Math.pow(e / s, 1 / years) - 1) * 100;
    if (Number.isFinite(v)) setValue(out, i, v, flags);
    else setNull(out, i, "non_positive_denominator", flags);
  }
  return out;
};
