// src/lib/metrics/values.ts — a tiny value algebra used by every deriver (WS3).
// A value is a MetricValue: a finite number with flags, or null with a reason. Arithmetic on a
// null operand gives that operand's reason (left first), so "why is this missing?" survives every
// step. Only the flags that describe how inputs were obtained (INHERITED_FLAGS) travel through
// arithmetic; outcome flags such as Turnaround or PayoutOver100 are set by the deriver itself.
import type { MetricValue, NullReason } from "@/lib/contracts";
import { VF } from "@/lib/contracts";
import { INHERITED_FLAGS } from "./windows";

export type V = MetricValue;

/** A present value. Non-finite numbers become "not meaningful" so NaN and Infinity never escape. */
export function ok(v: number, flags = 0): V {
  if (!Number.isFinite(v)) return { v: null, reason: "non_positive_denominator", flags };
  return { v: v === 0 ? 0 : v, reason: null, flags };
}

export function nul(reason: NullReason, flags = 0): V {
  return { v: null, reason, flags };
}

export function isOk(x: V): x is V & { v: number } {
  return x.v !== null;
}

/** Inherited flags of a value (how its inputs were obtained). */
export function inh(x: V): number {
  return x.flags & INHERITED_FLAGS;
}

/** Adds flags to a value (present or null). */
export function withFlags(x: V, flags: number): V {
  if (flags === 0) return x;
  return { v: x.v, reason: x.reason, flags: x.flags | flags };
}

/** Keeps the value but drops every flag that is not inherited (used when a value feeds another metric). */
export function asInput(x: V): V {
  const f = inh(x);
  return f === x.flags ? x : { v: x.v, reason: x.reason, flags: f };
}

/** First null operand (left to right) with every operand's inherited flags, or null when all are present. */
function firstNull(xs: readonly V[]): V | null {
  let flags = 0;
  for (const x of xs) flags |= inh(x);
  for (const x of xs) if (x.v === null) return { v: null, reason: x.reason ?? "missing_input", flags };
  return null;
}

function flagsOf(xs: readonly V[]): number {
  let flags = 0;
  for (const x of xs) flags |= inh(x);
  return flags;
}

/** a + b (+ c). Two- and three-operand forms avoid allocating an argument array in hot loops. */
export function add(a: V, b: V, c?: V): V {
  if (c === undefined) {
    if (a.v !== null && b.v !== null) return ok(a.v + b.v, inh(a) | inh(b));
    return firstNull([a, b]) as V;
  }
  if (a.v !== null && b.v !== null && c.v !== null) return ok(a.v + b.v + c.v, inh(a) | inh(b) | inh(c));
  return firstNull([a, b, c]) as V;
}

export function sub(a: V, b: V): V {
  if (a.v !== null && b.v !== null) return ok(a.v - b.v, inh(a) | inh(b));
  return firstNull([a, b]) as V;
}

export function mul(a: V, b: V): V {
  const n = firstNull([a, b]);
  if (n) return n;
  return ok((a.v as number) * (b.v as number), flagsOf([a, b]));
}

/** Multiplies a value by a constant. */
export function scale(a: V, k: number): V {
  if (a.v === null) return asInput(a);
  return ok(a.v * k, inh(a));
}

/**
 * num / den × factor. Null when either side is null (left reason first); `whenNonPositive`
 * when den ≤ 0. Flags: inherited flags of both operands.
 */
export function ratio(num: V, den: V, whenNonPositive: NullReason, factor = 1): V {
  const n = firstNull([num, den]);
  if (n) return n;
  const d = den.v as number;
  const flags = flagsOf([num, den]);
  if (!(d > 0)) return nul(whenNonPositive, flags);
  return ok(((num.v as number) / d) * factor, flags);
}

/** (a / b − 1) × 100 with the YoY rules: NPD when b ≤ 0, flagged Turnaround when b ≤ 0 < a. */
export function growthPct(a: V, b: V): V {
  const n = firstNull([a, b]);
  if (n) return n;
  const av = a.v as number;
  const bv = b.v as number;
  const flags = flagsOf([a, b]);
  if (!(bv > 0)) return nul("non_positive_denominator", av > 0 ? flags | VF.Turnaround : flags);
  return ok((av / bv - 1) * 100, flags);
}
