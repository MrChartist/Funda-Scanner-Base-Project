// src/lib/metrics/peers.ts — peer groups, percentiles and medians (spec §C.7).
//  • Groups are formed within a PeerClass only, so statistics never mix classes.
//  • The requested scope falls back industry → sector → class while the group has fewer than
//    PEER_MIN.group (5) members. A company whose whole class is smaller than that has no group
//    (groupOf = −1) and every peer statistic is too_few_peers.
//  • Median needs ≥ PEER_MIN.median (3) non-null values; percentile needs ≥ PEER_MIN.percentile (5).
//  • Percentile = 100 × (average rank − 1) / (n − 1), ascending, ties averaged.
import type { MetricColumn, PeerClass, PeerGroups, PeerScope } from "@/lib/contracts";
import { PEER_MIN, PEER_SCOPES } from "@/lib/contracts";
import { emptyColumn, setNull, setValue } from "./windows";

export interface PeerKeys {
  cls: readonly PeerClass[];
  sector: readonly string[];
  /** Industry, falling back to sector. */
  industry: readonly string[];
}

export interface PeerIndex extends PeerGroups {
  /** members[g] = company indices in group g, ascending. */
  members: readonly Int32Array[];
}

export const CLASS_LABEL: Readonly<Record<PeerClass, string>> = {
  non_financial: "Non-financial companies", bank: "Banks", nbfc: "NBFCs", insurance: "Insurers",
};

const SCOPE_INDEX: Readonly<Record<PeerScope, number>> = { class: 0, sector: 1, industry: 2 };

export function groupLabel(name: string, size: number): string {
  return `${name} · ${size} ${size === 1 ? "company" : "companies"} in your data`;
}

const norm = (s: string): string => s.trim().replace(/\s+/g, " ").toLowerCase();

function naturalKey(keys: PeerKeys, i: number, scope: PeerScope): string {
  const cls = keys.cls[i];
  if (scope === "class") return cls;
  if (scope === "sector") return `${cls}|s|${norm(keys.sector[i])}`;
  return `${cls}|i|${norm(keys.industry[i])}`;
}

function displayName(keys: PeerKeys, i: number, scope: PeerScope): string {
  if (scope === "class") return CLASS_LABEL[keys.cls[i]];
  return (scope === "sector" ? keys.sector[i] : keys.industry[i]).trim();
}

/** Fallback order for a requested scope. */
export function fallbackOrder(scope: PeerScope): readonly PeerScope[] {
  return scope === "industry" ? ["industry", "sector", "class"] : scope === "sector" ? ["sector", "class"] : ["class"];
}

export function buildPeerGroups(keys: PeerKeys, scope: PeerScope): PeerIndex {
  const n = keys.cls.length;
  const order = fallbackOrder(scope);
  /** Natural groups at every scope in the fallback order: "scope#key" → member indices. */
  const natural = new Map<string, number[]>();
  for (const s of order) {
    for (let i = 0; i < n; i++) {
      const k = `${s}#${naturalKey(keys, i, s)}`;
      let list = natural.get(k);
      if (!list) {
        list = [];
        natural.set(k, list);
      }
      list.push(i);
    }
  }
  const groupOf = new Int32Array(n).fill(-1);
  const effectiveScope = new Uint8Array(n);
  const idOf = new Map<string, number>();
  const labels: string[] = [];
  const groupSizes: number[] = [];
  const members: Int32Array[] = [];
  for (let i = 0; i < n; i++) {
    let chosen: PeerScope | null = null;
    let key = "";
    for (const s of order) {
      const k = `${s}#${naturalKey(keys, i, s)}`;
      if ((natural.get(k)?.length ?? 0) >= PEER_MIN.group) {
        chosen = s;
        key = k;
        break;
      }
    }
    effectiveScope[i] = SCOPE_INDEX[chosen ?? "class"];
    if (chosen === null) continue;
    let g = idOf.get(key);
    if (g === undefined) {
      g = labels.length;
      idOf.set(key, g);
      const list = natural.get(key) ?? [];
      labels.push(groupLabel(displayName(keys, i, chosen), list.length));
      groupSizes.push(list.length);
      // A fallback group holds every company of the wider natural group (for example the whole
      // sector), including companies that are themselves grouped at a narrower scope.
      members.push(Int32Array.from(list));
    }
    groupOf[i] = g;
  }
  return { scope, groupOf, effectiveScope, labels, sizes: Int32Array.from(groupSizes), members };
}

export function scopeOf(groups: PeerGroups, i: number): PeerScope {
  return PEER_SCOPES[groups.effectiveScope[i]] ?? "class";
}

/** All companies of the same peer class as i (used when i has no valid group). */
export function classMembers(keys: PeerKeys, i: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < keys.cls.length; j++) if (keys.cls[j] === keys.cls[i]) out.push(j);
  return out;
}

export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function finiteSorted(values: Float64Array, idx: ArrayLike<number>): number[] {
  const xs: number[] = [];
  for (let j = 0; j < idx.length; j++) {
    const v = values[idx[j]];
    if (Number.isFinite(v)) xs.push(v);
  }
  return xs.sort((a, b) => a - b);
}

/** Ascending percentile (ties averaged) within each company's peer group. */
export function percentileColumn(values: Float64Array, groups: PeerIndex, id: string): MetricColumn {
  const n = values.length;
  const out = emptyColumn(id, n);
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(values[i])) setNull(out, i, "missing_input");
    else if (groups.groupOf[i] < 0) setNull(out, i, "too_few_peers");
  }
  // Members of a fallback group can be grouped at a narrower scope themselves, so a group only
  // writes the companies whose own group it is.
  for (let g = 0; g < groups.members.length; g++) {
    const idx = groups.members[g];
    const present: number[] = [];
    for (let j = 0; j < idx.length; j++) if (Number.isFinite(values[idx[j]])) present.push(idx[j]);
    const m = present.length;
    if (m < PEER_MIN.percentile) {
      for (const i of present) if (groups.groupOf[i] === g) setNull(out, i, "too_few_peers");
      continue;
    }
    present.sort((a, b) => values[a] - values[b] || a - b);
    let r = 0;
    while (r < m) {
      let e = r;
      while (e + 1 < m && values[present[e + 1]] === values[present[r]]) e++;
      const avgRank = (r + 1 + e + 1) / 2; // 1-based ranks r+1 … e+1, averaged
      const pct = (100 * (avgRank - 1)) / (m - 1);
      for (let t = r; t <= e; t++) if (groups.groupOf[present[t]] === g) setValue(out, present[t], pct);
      r = e + 1;
    }
  }
  return out;
}

/** Median of each company's peer group (non-null values only; needs ≥ 3). */
export function medianColumn(values: Float64Array, groups: PeerIndex, id: string): MetricColumn {
  const n = values.length;
  const out = emptyColumn(id, n);
  for (let i = 0; i < n; i++) if (groups.groupOf[i] < 0) setNull(out, i, "too_few_peers");
  for (let g = 0; g < groups.members.length; g++) {
    const idx = groups.members[g];
    const xs = finiteSorted(values, idx);
    for (let j = 0; j < idx.length; j++) {
      const i = idx[j];
      if (groups.groupOf[i] !== g) continue;
      if (xs.length < PEER_MIN.median) setNull(out, i, "too_few_peers");
      else setValue(out, i, quantileSorted(xs, 0.5));
    }
  }
  return out;
}

/** Non-null values of a group, sorted ascending. */
export function groupValues(values: Float64Array, idx: ArrayLike<number>): number[] {
  return finiteSorted(values, idx);
}
