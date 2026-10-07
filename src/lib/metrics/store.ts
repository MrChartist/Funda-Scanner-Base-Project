// src/lib/metrics/store.ts — the metric store (spec §B.4, §C).
//
// Columns are lazy typed arrays, computed for every company at once the first time they are
// asked for and cached for the store's lifetime. Two layers of cache exist:
//  • series caches: derived values per metric and grid slot (kind → id → slot), used by derivers and
//    window inputs; they hold statement-derived values only;
//  • public columns: column(id) (the default period) and columnAt(id, sel). The default column is
//    the only place snapshot values fill gaps (flagged Provided): derived values always win.
// The store is pure: the same dataset always gives identical typed arrays.
import type {
  ColumnProvider, CompanyType, CreateMetricStore, FundamentalsDataset, MetricColumn, MetricDef, MetricId, MetricStore,
  MetricValue, PeerClass, PeerScope, PeerStat, PeriodSel, TypeFamily,
} from "@/lib/contracts";
import { PEER_CLASS, PEER_MIN, TYPE_FAMILY, UnknownMetricError, VF } from "@/lib/contracts";
import { fyLabel, quarterLabel, ttmLabel } from "@/lib/time/civil";
import { resolveCompanyType } from "./company-type";
import { type DeriveContext, type Deriver } from "./derive/common";
import { DERIVERS, PROVIDED_IDS } from "./derive/index";
import { type CompanyGrid, buildGrid } from "./grid";
import {
  CLASS_LABEL, type PeerIndex, type PeerKeys, buildPeerGroups, classMembers, groupLabel, groupValues, medianColumn,
  percentileColumn, quantileSorted, scopeOf,
} from "./peers";
import { cagrWindow, windowAggregate } from "./series";
import type { V } from "./values";
import { ALL_METRIC_DEFS, VARIANT_RULES } from "./variants";
import { INHERITED_FLAGS, emptyColumn, isPresent, nullColumn, reasonCode, setNull, setValue, valueAt } from "./windows";

const ALL_FAMILIES = 3;
const NAF_CODE = reasonCode("not_applicable_financial");
/** Null reasons that mean "the statements could not give a value", which a snapshot value may fill. */
const GAP_CODES: ReadonlySet<number> = new Set([
  reasonCode("missing_input"), reasonCode("insufficient_history"), reasonCode("no_price"),
]);

/** FNV-1a 32-bit hash as hex (dataset fingerprint). */
function fnv1a32(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function cloneColumn(col: MetricColumn, id: MetricId): MetricColumn {
  return { id, values: Float64Array.from(col.values), reasons: Uint8Array.from(col.reasons), flags: Uint16Array.from(col.flags) };
}

function relabel(col: MetricColumn, id: MetricId): MetricColumn {
  return col.id === id ? col : { id, values: col.values, reasons: col.reasons, flags: col.flags };
}

const DEF_BY_ID: ReadonlyMap<MetricId, MetricDef> = new Map(ALL_METRIC_DEFS.map((d) => [d.id, d]));

/** True when sel is the default period of def (what column(id) returns). */
function isDefaultSel(def: MetricDef, sel: PeriodSel): boolean {
  if (sel.offset !== 0) return false;
  switch (def.history) {
    case "latest_only": return true;
    case "annual": return sel.freq === "fy";
    case "quarterly":
    case "shareholding": return sel.freq === "q";
  }
}

const DEFAULT_SEL: Readonly<Record<MetricDef["history"], PeriodSel>> = {
  annual: { freq: "fy", offset: 0 },
  quarterly: { freq: "q", offset: 0 },
  shareholding: { freq: "q", offset: 0 },
  latest_only: { freq: "fy", offset: 0 },
};

export const createMetricStore: CreateMetricStore = (dataset: FundamentalsDataset, options) => {
  const companies = dataset.companies;
  const n = companies.length;
  const symbols = companies.map((c) => c.symbol);
  const indexBySymbol = new Map<string, number>();
  symbols.forEach((s, i) => {
    const key = s.trim().toUpperCase();
    if (!indexBySymbol.has(key)) indexBySymbol.set(key, i);
  });
  const grids: CompanyGrid[] = companies.map(buildGrid);
  const types: { type: CompanyType; inferred: boolean }[] = companies.map(resolveCompanyType);
  const families: TypeFamily[] = types.map((t) => TYPE_FAMILY[t.type]);
  const classes: PeerClass[] = types.map((t) => PEER_CLASS[t.type]);
  const industries = companies.map((c) => (c.industry && c.industry.trim() ? c.industry : c.sector));
  const peerKeys: PeerKeys = { cls: classes, sector: companies.map((c) => c.sector), industry: industries };

  const providerFor = new Map<MetricId, ColumnProvider>();
  for (const p of options?.providers ?? []) for (const id of p.ids) providerFor.set(id, p);

  // Modal latest FY (ties go to the later year).
  const fyCounts = new Map<number, number>();
  for (const g of grids) if (g.latestFy !== null) fyCounts.set(g.latestFy, (fyCounts.get(g.latestFy) ?? 0) + 1);
  let modalLatestFy: number | null = null;
  let best = 0;
  for (const [fy, count] of fyCounts) {
    if (count > best || (count === best && modalLatestFy !== null && fy > modalLatestFy)) {
      modalLatestFy = fy;
      best = count;
    }
  }

  const publicCols = new Map<string, MetricColumn>();
  const groupCache = new Map<PeerScope, PeerIndex>();
  const pctlCache = new Map<string, MetricColumn>();

  const applies = (def: MetricDef | undefined, i: number): boolean => !def || def.appliesTo.includes(families[i]);
  /** InferredType marks values (not NAF nulls) of metrics restricted by family when the type was inferred. */
  const typeFlag = (def: MetricDef | undefined, i: number): number =>
    def && types[i].inferred && def.appliesTo.length < ALL_FAMILIES ? VF.InferredType : 0;

  function put(col: MetricColumn, i: number, x: V, extra: number): void {
    if (x.v === null) setNull(col, i, x.reason ?? "missing_input", x.flags | extra);
    else setValue(col, i, x.v, x.flags | extra);
  }

  function deriverOf(id: MetricId, kind: Deriver["kind"]): Deriver {
    const d = DERIVERS[id];
    if (!d) throw new Error(`No deriver for metric "${id}"`);
    if (d.kind !== kind) throw new Error(`Metric "${id}" is ${d.kind}, not ${kind}`);
    return d;
  }

  type SeriesKind = Deriver["kind"] | "ttm";
  /** Series caches: kind → metric id → column per slot (nested maps avoid building string keys in hot loops). */
  const seriesCache: Record<SeriesKind, Map<MetricId, MetricColumn[]>> = {
    annual: new Map(), quarterly: new Map(), shareholding: new Map(), latest: new Map(), ttm: new Map(),
  };
  const cachedSeries = (kind: SeriesKind, id: MetricId, k: number): MetricColumn | undefined => seriesCache[kind].get(id)?.[k];
  function rememberSeries(kind: SeriesKind, id: MetricId, k: number, col: MetricColumn): MetricColumn {
    let list = seriesCache[kind].get(id);
    if (!list) {
      list = [];
      seriesCache[kind].set(id, list);
    }
    list[k] = col;
    return col;
  }

  /** A derived series column: one deriver evaluated at one slot for every company. */
  function derived(id: MetricId, kind: Deriver["kind"], k: number): MetricColumn {
    const hit = cachedSeries(kind, id, k);
    if (hit) return hit;
    const d = deriverOf(id, kind);
    const def = DEF_BY_ID.get(id);
    const col = emptyColumn(id, n);
    const raw = d.kind === "latest" ? undefined : d.rawField;
    for (let i = 0; i < n; i++) {
      if (!applies(def, i)) setNull(col, i, "not_applicable_financial");
      else if (raw !== undefined) rawInto(col, i, kind, raw, k, typeFlag(def, i));
      else put(col, i, d.kind === "latest" ? d.get(ctx, i) : d.at(ctx, i, k), typeFlag(def, i));
    }
    return rememberSeries(kind, id, k, col);
  }

  /** Fast path for line items: the field exactly as supplied (same rules as the raw readers in derive/common). */
  function rawInto(col: MetricColumn, i: number, kind: Deriver["kind"], field: string, k: number, extra: number): void {
    const g = grids[i];
    const rows: readonly (object | null)[] = kind === "annual" ? g.annual : kind === "quarterly" ? g.quarter : g.share;
    if (k < 0 || k >= rows.length) {
      setNull(col, i, "insufficient_history", extra);
      return;
    }
    const row = rows[k] as Record<string, unknown> | null;
    const v = row ? row[field] : null;
    if (typeof v === "number" && Number.isFinite(v)) setValue(col, i, v, extra);
    else setNull(col, i, "missing_input", extra);
  }

  const annualAt = (id: MetricId, k: number): MetricColumn => cachedSeries("annual", id, k) ?? derived(id, "annual", k);
  const quarterAt = (id: MetricId, k: number): MetricColumn => cachedSeries("quarterly", id, k) ?? derived(id, "quarterly", k);
  const shareAt = (id: MetricId, k: number): MetricColumn => cachedSeries("shareholding", id, k) ?? derived(id, "shareholding", k);
  const latestCol = (id: MetricId): MetricColumn => cachedSeries("latest", id, 0) ?? derived(id, "latest", 0);

  /** TTM block b: four grid quarters; block 0 falls back to the latest FY value (FyFallback). */
  function ttmAt(id: MetricId, b: number): MetricColumn {
    const hit = cachedSeries("ttm", id, b);
    if (hit) return hit;
    const d = deriverOf(id, "annual") as Extract<Deriver, { kind: "annual" }>;
    if (!d.ttm) throw new Error(`Metric "${id}" has no TTM form`);
    const ttm = d.ttm;
    const def = DEF_BY_ID.get(id);
    const col = emptyColumn(`${id}[ttm-${b}]`, n);
    for (let i = 0; i < n; i++) {
      const extra = typeFlag(def, i);
      if (!applies(def, i)) {
        setNull(col, i, "not_applicable_financial");
        continue;
      }
      const v = ttm(ctx, i, b);
      if (v !== null) put(col, i, v, extra);
      else if (b === 0) put(col, i, valueAt(annualAt(id, 0), i), extra | VF.FyFallback);
      else setNull(col, i, "insufficient_history", extra);
    }
    return rememberSeries("ttm", id, b, col);
  }

  /** A column of nulls for a period the metric does not have (NAF where it does not apply). */
  function noHistory(def: MetricDef | undefined, id: MetricId): MetricColumn {
    const col = nullColumn(id, n, "insufficient_history");
    for (let i = 0; i < n; i++) if (!applies(def, i)) setNull(col, i, "not_applicable_financial");
    return col;
  }

  /** Shareholding change x − x[q−quarters] at slot k; a missing earlier slot is insufficient history. */
  function changeAt(def: MetricDef, base: MetricDef, quarters: number, k: number): MetricColumn {
    const now = publicAt(base, { freq: "q", offset: k });
    const then = publicAt(base, { freq: "q", offset: k + quarters });
    const col = emptyColumn(def.id, n);
    for (let i = 0; i < n; i++) {
      if (!isPresent(now, i)) {
        put(col, i, valueAt(now, i), 0);
        continue;
      }
      if (!isPresent(then, i)) {
        const rows = base.history === "quarterly" ? grids[i].quarter : grids[i].share;
        const slot = k + quarters;
        const absent = slot >= rows.length || rows[slot] === null;
        const r = valueAt(then, i);
        setNull(col, i, absent ? "insufficient_history" : r.reason ?? "missing_input", r.flags);
        continue;
      }
      setValue(col, i, now.values[i] - then.values[i], (now.flags[i] | then.flags[i]) & INHERITED_FLAGS);
    }
    return col;
  }

  /** Unfilled column of a base metric at a period selector. */
  function baseAt(def: MetricDef, sel: PeriodSel): MetricColumn {
    const k = sel.offset;
    if (PROVIDED_IDS.has(def.id) && !DERIVERS[def.id]) return noHistory(def, def.id);
    switch (def.history) {
      case "annual":
        if (sel.freq === "fy") return annualAt(def.id, k);
        if (sel.freq === "ttm" && def.ttm) return ttmAt(def.id, k);
        return noHistory(def, def.id);
      case "quarterly":
        return sel.freq === "q" ? quarterAt(def.id, k) : noHistory(def, def.id);
      case "shareholding":
        return sel.freq === "q" ? shareAt(def.id, k) : noHistory(def, def.id);
      case "latest_only":
        return k === 0 ? latestCol(def.id) : noHistory(def, def.id);
    }
  }

  /** Unfilled column of a variant at a period selector, computed from its base. */
  function variantAt(def: MetricDef, sel: PeriodSel): MetricColumn {
    const base = DEF_BY_ID.get(def.base);
    if (!base || def.variant === null) throw new UnknownMetricError(def.id);
    const rule = VARIANT_RULES[def.variant];
    const k = sel.offset;
    switch (rule.kind) {
      case "prev": {
        const freq = base.history === "annual" ? "fy" : "q";
        return sel.freq === freq ? relabel(publicAt(base, { freq, offset: k + 1 }), def.id) : noHistory(def, def.id);
      }
      case "ttm":
        return k === 0 ? relabel(publicAt(base, { freq: "ttm", offset: 0 }), def.id) : noHistory(def, def.id);
      case "window":
        return sel.freq === "fy" ? windowAggregate(store, rule.aggregate, base.id, rule.years, k, def.id) : noHistory(def, def.id);
      case "cagr":
        return sel.freq === "fy" ? cagrWindow(store, base.id, rule.years, k, def.id) : noHistory(def, def.id);
      case "change":
        return sel.freq === "q" ? changeAt(def, base, rule.quarters, k) : noHistory(def, def.id);
    }
  }

  function computeAt(def: MetricDef, sel: PeriodSel): MetricColumn {
    if (!Number.isInteger(sel.offset) || sel.offset < 0) return noHistory(def, def.id);
    return def.variant === null ? baseAt(def, sel) : variantAt(def, sel);
  }

  /** columnAt for a known definition (default period → the filled default column). */
  function publicAt(def: MetricDef, sel: PeriodSel): MetricColumn {
    if (isDefaultSel(def, sel)) return column(def.id);
    const key = `${def.id}|${sel.freq}|${sel.offset}`;
    const hit = publicCols.get(key);
    if (hit) return hit;
    const col = relabel(computeAt(def, sel), def.id);
    publicCols.set(key, col);
    return col;
  }

  /** Snapshot values fill gaps in the default column only (derived values win), flagged Provided. */
  function fillFromSnapshot(def: MetricDef, col: MetricColumn): MetricColumn {
    let out: MetricColumn | null = null;
    for (let i = 0; i < n; i++) {
      if (!GAP_CODES.has(col.reasons[i])) continue;
      const v = companies[i].snapshot[def.id];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      out ??= cloneColumn(col, def.id);
      setValue(out, i, v, VF.Provided | typeFlag(def, i));
    }
    return out ?? relabel(col, def.id);
  }

  function column(id: MetricId): MetricColumn {
    const key = `${id}|default`;
    const hit = publicCols.get(key);
    if (hit) return hit;
    let col: MetricColumn;
    const provider = providerFor.get(id);
    const def = DEF_BY_ID.get(id);
    if (provider) {
      col = provider.compute(store, id);
    } else if (!def) {
      throw new UnknownMetricError(id);
    } else if (PROVIDED_IDS.has(id)) {
      // Served by another stream's provider; without one registered there is no value.
      col = nullColumn(id, n, "missing_input");
      for (let i = 0; i < n; i++) if (!applies(def, i)) setNull(col, i, "not_applicable_financial");
    } else {
      col = fillFromSnapshot(def, computeAt(def, DEFAULT_SEL[def.history]));
    }
    publicCols.set(key, col);
    return col;
  }

  function columnAt(id: MetricId, sel: PeriodSel): MetricColumn {
    const def = DEF_BY_ID.get(id);
    if (!def) {
      if (!providerFor.has(id)) throw new UnknownMetricError(id);
      return sel.offset === 0 ? column(id) : nullColumn(id, n, "insufficient_history");
    }
    if (providerFor.has(id)) return sel.offset === 0 ? column(id) : noHistory(def, id);
    return publicAt(def, sel);
  }

  // ── derive context (statement-derived values; no snapshot fill) ──
  /** Variants are computed through the public API (windows, CAGR, prev); base metrics read series caches. */
  const variantDef = (id: MetricId): MetricDef | null => {
    const def = DEF_BY_ID.get(id);
    return def && def.variant !== null ? def : null;
  };

  const ctx: DeriveContext = {
    n,
    get store() {
      return store;
    },
    company: (i) => companies[i],
    grid: (i) => grids[i],
    family: (i) => families[i],
    fy: (id, i, k) => {
      const v = variantDef(id);
      return valueAt(v ? publicAt(v, { freq: "fy", offset: k }) : annualAt(id, k), i);
    },
    ttm: (id, i, b) => valueAt(ttmAt(id, b), i),
    q: (id, i, k) => valueAt(quarterAt(id, k), i),
    sh: (id, i, k) => valueAt(shareAt(id, k), i),
    latest: (id, i) => {
      const v = variantDef(id);
      return valueAt(v ? publicAt(v, { freq: "fy", offset: 0 }) : latestCol(id), i);
    },
  };

  // ── peers ──
  function groups(scope: PeerScope): PeerIndex {
    let g = groupCache.get(scope);
    if (!g) {
      g = buildPeerGroups(peerKeys, scope);
      groupCache.set(scope, g);
    }
    return g;
  }

  function marketCapOrder(list: number[]): number[] {
    const mc = column("market_cap");
    return list.sort((a, b) => {
      const va = isPresent(mc, a) ? mc.values[a] : Number.NEGATIVE_INFINITY;
      const vb = isPresent(mc, b) ? mc.values[b] : Number.NEGATIVE_INFINITY;
      if (va !== vb) return vb - va;
      return symbols[a] < symbols[b] ? -1 : symbols[a] > symbols[b] ? 1 : a - b;
    });
  }

  /** Present values only (NaN elsewhere), so peer statistics never read a null as a number. */
  function presentValues(col: MetricColumn): Float64Array {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = isPresent(col, i) ? col.values[i] : Number.NaN;
    return out;
  }

  let fingerprint: string | null = null;

  const store: MetricStore = {
    get key() {
      fingerprint ??= `${dataset.meta.name}#${n}#${fnv1a32(JSON.stringify(dataset))}`;
      return fingerprint;
    },
    meta: dataset.meta,
    size: n,
    symbols,
    modalLatestFy,
    indexOf: (symbol) => indexBySymbol.get(symbol.trim().toUpperCase()) ?? -1,
    company: (i) => companies[i],
    companyType: (i) => types[i],
    family: (i) => families[i],
    peerClass: (i) => classes[i],
    sector: (i) => companies[i].sector,
    industry: (i) => industries[i],
    def: (id) => DEF_BY_ID.get(id),
    defs: () => ALL_METRIC_DEFS,
    column,
    columnAt,
    get: (id, i): MetricValue => valueAt(column(id), i),
    at: (id, i, sel): MetricValue => valueAt(columnAt(id, sel), i),
    slots(i, grid) {
      const g = grids[i];
      return (grid === "fy" ? g.annual : grid === "q" ? g.quarter : g.share).length;
    },
    periodLabel(i, sel) {
      const g = grids[i];
      const k = sel.offset;
      if (!Number.isInteger(k) || k < 0) return null;
      if (sel.freq === "fy") {
        const row = g.annual[k];
        return row ? fyLabel(row.fiscal_year) : null;
      }
      if (sel.freq === "q") {
        const row = g.quarter[k];
        return row ? quarterLabel(row.period_end, companies[i].fy_end_month) : null;
      }
      const row = g.quarter[4 * k];
      return row ? ttmLabel(row.period_end) : null;
    },
    groups,
    percentileOf: (values, scope) => percentileColumn(values, groups(scope), `pctl:${scope}`),
    medianOf: (values, scope) => medianColumn(values, groups(scope), `median:${scope}`),
    percentile(id, i, scope) {
      const col = column(id);
      if (!isPresent(col, i)) return valueAt(col, i);
      const key = `${id}|${scope}`;
      let p = pctlCache.get(key);
      if (!p) {
        p = percentileColumn(presentValues(col), groups(scope), `pctl:${scope}:${id}`);
        pctlCache.set(key, p);
      }
      return valueAt(p, i);
    },
    peerStat(id, i, scope): PeerStat {
      const col = column(id);
      const g = groups(scope);
      const gi = g.groupOf[i];
      const values = presentValues(col);
      if (gi < 0) {
        const members = classMembers(peerKeys, i);
        return {
          n: groupValues(values, members).length, median: null, p25: null, p75: null,
          groupLabel: groupLabel(CLASS_LABEL[classes[i]], members.length),
          scope: "class", fellBackTo: scope === "class" ? null : "class",
        };
      }
      const xs = groupValues(values, g.members[gi]);
      const enough = xs.length >= PEER_MIN.median;
      const eff = scopeOf(g, i);
      return {
        n: xs.length,
        median: enough ? quantileSorted(xs, 0.5) : null,
        p25: enough ? quantileSorted(xs, 0.25) : null,
        p75: enough ? quantileSorted(xs, 0.75) : null,
        groupLabel: g.labels[gi],
        scope: eff,
        fellBackTo: eff === scope ? null : eff,
      };
    },
    peers(i, scope, limit = 10) {
      const g = groups(scope);
      const gi = g.groupOf[i];
      const members = gi >= 0 ? Array.from(g.members[gi]) : classMembers(peerKeys, i);
      return marketCapOrder(members.filter((j) => j !== i)).slice(0, Math.max(0, Math.floor(limit)));
    },
    coverage(id) {
      const col = column(id);
      const def = DEF_BY_ID.get(id);
      let nonNull = 0;
      let applicable = 0;
      for (let i = 0; i < n; i++) {
        if (col.reasons[i] === NAF_CODE || !applies(def, i)) continue;
        applicable++;
        if (isPresent(col, i)) nonNull++;
      }
      return { nonNull, applicable };
    },
  };
  return store;
};
