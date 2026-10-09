// src/test/fixtures/fixture-store.ts — P0 stand-in MetricStore (frozen).
//
// createTableStore(dataset): a real MetricStore over any dataset that serves
//   • line items (rawField metrics) through the calendar grid (§C.1), with their prev,
//     window, CAGR and change variants computed by metrics/windows.ts;
//   • market_cap, price, latest_fy and years_of_history (direct inputs, no derivation);
//   • snapshot values (flagged Provided) for any other id;
//   • percentiles and medians by simple sort within peer groups (§C.7 minimums and fallback).
//   Every other derived metric is { v: null, reason: "missing_input" } until WS3 lands.
//
// createFixtureStore(table): the same store over a literal table of metric values, for UI tests.
import type {
  AnnualField, AnnualRow, ColumnProvider, CompanyRecord, CompanyType, CreateStoreOptions, DatasetMeta,
  FundamentalsDataset, MetricColumn, MetricDef, MetricId, MetricStore, MetricValue, NullReason, PeerClass,
  PeerGroups, PeerScope, PeerStat, PeriodSel, QuarterField, QuarterRow, ShareholdingField, ShareholdingRow, TypeFamily,
} from "@/lib/contracts";
import {
  DATASET_SCHEMA, DATASET_VERSION, MAX_ANNUAL_SLOTS, MAX_QUARTER_SLOTS, MAX_SHAREHOLDING_SLOTS, PEER_CLASS, PEER_MIN,
  QUARTER_MATCH_TOLERANCE_DAYS, TYPE_FAMILY, UnknownMetricError, VF,
} from "@/lib/contracts";
import { ALL_METRIC_DEFS, VARIANT_RULES } from "@/lib/metrics/variants";
import {
  aggregateWindow, cagrColumn, emptyColumn, isPresent, nullColumn, setNull, setValue, valueAt,
} from "@/lib/metrics/windows";
import { addMonths, daysFromCivil, fyLabel, parseIsoDate, quarterLabel, ttmLabel } from "@/lib/time/civil";

// ── helpers ─────────────────────────────────────────────────────────────────
/** FNV-1a 32-bit hash, hex. Deterministic dataset fingerprint. */
export function fnv1a32(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function dayNumber(iso: string): number | null {
  const p = parseIsoDate(iso);
  return p ? daysFromCivil(p.y, p.m, p.d) : null;
}

const LENDER_WORDS = ["bank", "nbfc", "finance", "financial services", "housing finance", "microfinance", "lending"];

/** Simple keyword inference (§C.7). WS3's metrics/company-type.ts replaces this. */
export function inferCompanyType(sector: string, industry: string | null): CompanyType {
  const text = `${sector} ${industry ?? ""}`.toLowerCase();
  if (/\binsurance\b|\binsurer\b/.test(text)) return "insurance";
  if (/\bbank(s|ing)?\b/.test(text) && !/\binvestment bank/.test(text)) return "bank";
  if (LENDER_WORDS.some((w) => text.includes(w))) return "nbfc";
  return "non_financial";
}

interface Grids {
  /** annual[k] = row for latestFy − k, or null (a hole). */
  annual: (AnnualRow | null)[];
  latestFy: number | null;
  quarter: (QuarterRow | null)[];
  share: (ShareholdingRow | null)[];
}

function slotByDate<T extends { period_end: string }>(rows: readonly T[], maxSlots: number): (T | null)[] {
  const dated = rows
    .map((r) => ({ r, d: dayNumber(r.period_end) }))
    .filter((x): x is { r: T; d: number } => x.d !== null)
    .sort((a, b) => b.d - a.d);
  if (dated.length === 0) return [];
  const latest = dated[0].r.period_end;
  const oldest = dated[dated.length - 1].d;
  const out: (T | null)[] = [];
  for (let k = 0; k < maxSlots; k++) {
    const target = addMonths(latest, -3 * k);
    const td = target ? dayNumber(target) : null;
    if (td === null || td < oldest - QUARTER_MATCH_TOLERANCE_DAYS) break;
    let best: T | null = null;
    let bestGap = Infinity;
    for (const x of dated) {
      const gap = Math.abs(x.d - td);
      if (gap <= QUARTER_MATCH_TOLERANCE_DAYS && gap < bestGap) {
        best = x.r;
        bestGap = gap;
      }
    }
    out.push(best);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

function buildGrids(c: CompanyRecord): Grids {
  let latestFy: number | null = null;
  const byYear = new Map<number, AnnualRow>();
  for (const r of c.annual) {
    byYear.set(r.fiscal_year, r);
    if (latestFy === null || r.fiscal_year > latestFy) latestFy = r.fiscal_year;
  }
  const annual: (AnnualRow | null)[] = [];
  if (latestFy !== null) {
    const oldest = Math.min(...byYear.keys());
    for (let k = 0; k < MAX_ANNUAL_SLOTS && latestFy - k >= oldest; k++) annual.push(byYear.get(latestFy - k) ?? null);
  }
  return {
    annual,
    latestFy,
    quarter: slotByDate(c.quarterly, MAX_QUARTER_SLOTS),
    share: slotByDate(c.shareholding, MAX_SHAREHOLDING_SLOTS),
  };
}

function quantile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function median(sorted: readonly number[]): number {
  return quantile(sorted, 0.5);
}

const SCOPE_INDEX: Readonly<Record<PeerScope, number>> = { class: 0, sector: 1, industry: 2 };
const CLASS_LABEL: Readonly<Record<PeerClass, string>> = {
  non_financial: "Non-financial companies", bank: "Banks", nbfc: "NBFCs", insurance: "Insurers",
};

// ── fixture value overrides ─────────────────────────────────────────────────
export type FixtureValue = number | null | { v: number | null; reason?: NullReason | null; flags?: number };

function toMetricValue(x: FixtureValue): MetricValue {
  if (x === null) return { v: null, reason: "missing_input", flags: 0 };
  if (typeof x === "number") {
    return Number.isFinite(x) ? { v: x, reason: null, flags: 0 } : { v: null, reason: "missing_input", flags: 0 };
  }
  if (x.v === null || !Number.isFinite(x.v)) return { v: null, reason: x.reason ?? "missing_input", flags: x.flags ?? 0 };
  return { v: x.v, reason: null, flags: x.flags ?? 0 };
}

interface TableStoreOptions extends Partial<CreateStoreOptions> {
  /** overrides[i][metricId] = literal value for company i (createFixtureStore). */
  overrides?: ReadonlyArray<Readonly<Record<MetricId, FixtureValue>>>;
  key?: string;
}

const DEF_BY_ID: ReadonlyMap<MetricId, MetricDef> = new Map(ALL_METRIC_DEFS.map((d) => [d.id, d]));

// ── the store ───────────────────────────────────────────────────────────────
export function createTableStore(dataset: FundamentalsDataset, options: TableStoreOptions = {}): MetricStore {
  const companies = dataset.companies;
  const n = companies.length;
  const symbols = companies.map((c) => c.symbol);
  const indexBySymbol = new Map<string, number>();
  symbols.forEach((s, i) => {
    if (!indexBySymbol.has(s.toUpperCase())) indexBySymbol.set(s.toUpperCase(), i);
  });
  const grids = companies.map(buildGrids);
  const types = companies.map((c) =>
    c.company_type ? { type: c.company_type, inferred: false } : { type: inferCompanyType(c.sector, c.industry), inferred: true },
  );
  const providers: readonly ColumnProvider[] = options.providers ?? [];
  const providerFor = new Map<MetricId, ColumnProvider>();
  for (const p of providers) for (const id of p.ids) providerFor.set(id, p);
  const overrides = options.overrides ?? [];

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

  const columnCache = new Map<string, MetricColumn>();
  const groupCache = new Map<PeerScope, PeerGroups>();

  const family = (i: number): TypeFamily => TYPE_FAMILY[types[i].type];
  const peerClass = (i: number): PeerClass => PEER_CLASS[types[i].type];
  const industryOf = (i: number): string => companies[i].industry ?? companies[i].sector;

  function requireDef(id: MetricId): MetricDef | null {
    const def = DEF_BY_ID.get(id);
    if (def) return def;
    if (providerFor.has(id)) return null;
    if (overrides.some((o) => Object.prototype.hasOwnProperty.call(o, id))) return null;
    throw new UnknownMetricError(id);
  }

  // Raw value of a line item at a grid slot. "hole" = slot inside history but empty.
  function rawAt(i: number, def: MetricDef, slot: number): { v: number | null; state: "ok" | "hole" | "beyond" | "transition" } {
    const g = grids[i];
    if (def.history === "annual") {
      if (slot < 0 || slot >= g.annual.length) return { v: null, state: "beyond" };
      const row = g.annual[slot];
      if (!row) return { v: null, state: "hole" };
      const v = row[def.rawField as AnnualField];
      return { v, state: row.flags.length > 0 ? "transition" : "ok" };
    }
    const rows = def.history === "quarterly" ? g.quarter : g.share;
    if (slot < 0 || slot >= rows.length) return { v: null, state: "beyond" };
    const row = rows[slot];
    if (!row) return { v: null, state: "hole" };
    const v = def.history === "quarterly"
      ? (row as QuarterRow)[def.rawField as QuarterField]
      : (row as ShareholdingRow)[def.rawField as ShareholdingField];
    return { v, state: "ok" };
  }

  function override(i: number, id: MetricId): MetricValue | null {
    const o = overrides[i];
    if (o && Object.prototype.hasOwnProperty.call(o, id)) return toMetricValue(o[id]);
    return null;
  }

  function snapshotValue(i: number, id: MetricId): number | null {
    const v = companies[i].snapshot[id];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }

  /** Line-item column at a slot. `window` marks transition years as transition_period. */
  function lineItemColumn(def: MetricDef, slot: number, window: boolean, colId: MetricId): MetricColumn {
    const col = emptyColumn(colId, n);
    for (let i = 0; i < n; i++) {
      if (!def.appliesTo.includes(family(i))) {
        setNull(col, i, "not_applicable_financial");
        continue;
      }
      const r = rawAt(i, def, slot);
      if (window && r.state === "transition") {
        setNull(col, i, "transition_period");
        continue;
      }
      if (r.v !== null && Number.isFinite(r.v)) {
        setValue(col, i, r.v);
        continue;
      }
      const snap = slot === 0 ? snapshotValue(i, def.id) : null;
      if (snap !== null) setValue(col, i, snap, VF.Provided);
      else setNull(col, i, r.state === "beyond" ? "insufficient_history" : "missing_input");
    }
    return col;
  }

  function baseDefOf(def: MetricDef): MetricDef | undefined {
    return def.variant ? DEF_BY_ID.get(def.base) : def;
  }

  function computeDefault(def: MetricDef): MetricColumn {
    const base = baseDefOf(def);
    // Line items and their variants come from the grid.
    if (base && base.rawField !== null) {
      if (def.variant === null) return lineItemColumn(def, 0, false, def.id);
      const rule = VARIANT_RULES[def.variant];
      switch (rule.kind) {
        case "prev":
          return lineItemColumn(base, 1, false, def.id);
        case "window": {
          const cols = Array.from({ length: rule.years }, (_, k) => lineItemColumn(base, k, true, `${base.id}@${k}`));
          return aggregateWindow(rule.aggregate, cols, def.id);
        }
        case "cagr": {
          const cols = Array.from({ length: rule.years + 1 }, (_, k) => lineItemColumn(base, k, true, `${base.id}@${k}`));
          const out = cagrColumn(cols[0], cols[rule.years], rule.years, def.id);
          // A transition year anywhere in the span makes the CAGR not comparable.
          for (let i = 0; i < n; i++) {
            if (cols.some((c) => c.reasons[i] !== 0 && valueAt(c, i).reason === "transition_period")) setNull(out, i, "transition_period");
          }
          return out;
        }
        case "change": {
          const now = lineItemColumn(base, 0, false, def.id);
          const then = lineItemColumn(base, rule.quarters, false, `${base.id}@q${rule.quarters}`);
          const out = emptyColumn(def.id, n);
          for (let i = 0; i < n; i++) {
            if (isPresent(now, i) && isPresent(then, i)) setValue(out, i, now.values[i] - then.values[i]);
            else setNull(out, i, valueAt(isPresent(now, i) ? then : now, i).reason ?? "missing_input");
          }
          return out;
        }
        case "ttm":
          break; // derived (sum of quarters): served by WS3
      }
    }
    const col = emptyColumn(def.id, n);
    for (let i = 0; i < n; i++) {
      if (!def.appliesTo.includes(family(i))) {
        setNull(col, i, "not_applicable_financial");
        continue;
      }
      const c = companies[i];
      const g = grids[i];
      switch (def.id) {
        case "price":
          if (c.market.price !== null) setValue(col, i, c.market.price);
          else setNull(col, i, "no_price");
          continue;
        case "market_cap":
          if (c.market.price !== null && c.market.shares_outstanding !== null) {
            setValue(col, i, c.market.price * c.market.shares_outstanding);
          } else if (c.market.market_cap_supplied !== null) {
            setValue(col, i, c.market.market_cap_supplied, VF.Provided);
          } else {
            setNull(col, i, c.market.price === null ? "no_price" : "missing_input");
          }
          continue;
        case "latest_fy":
          if (g.latestFy !== null) setValue(col, i, g.latestFy);
          else setNull(col, i, "insufficient_history");
          continue;
        case "years_of_history":
          setValue(col, i, g.annual.filter((r) => r !== null).length);
          continue;
      }
      const snap = snapshotValue(i, def.id);
      if (snap !== null) setValue(col, i, snap, VF.Provided);
      else setNull(col, i, "missing_input");
    }
    return col;
  }

  function applyOverrides(id: MetricId, col: MetricColumn): MetricColumn {
    if (overrides.length === 0) return col;
    for (let i = 0; i < n; i++) {
      const o = override(i, id);
      if (!o) continue;
      if (o.v === null) setNull(col, i, o.reason ?? "missing_input", o.flags);
      else setValue(col, i, o.v, o.flags);
    }
    return col;
  }

  function column(id: MetricId): MetricColumn {
    const cached = columnCache.get(id);
    if (cached) return cached;
    let col: MetricColumn;
    const provider = providerFor.get(id);
    if (provider) {
      col = provider.compute(store, id);
    } else {
      const def = requireDef(id);
      col = def ? computeDefault(def) : nullColumn(id, n, "missing_input");
    }
    col = applyOverrides(id, col);
    columnCache.set(id, col);
    return col;
  }

  function columnAt(id: MetricId, sel: PeriodSel): MetricColumn {
    const key = `${id}@${sel.freq}${sel.offset}`;
    const cached = columnCache.get(key);
    if (cached) return cached;
    const def = requireDef(id);
    let col: MetricColumn;
    const matchesFreq = def !== null && (
      (sel.freq === "fy" && def.history === "annual")
      || (sel.freq === "q" && (def.history === "quarterly" || def.history === "shareholding"))
    );
    if (def && def.rawField !== null && def.variant === null && matchesFreq) {
      col = lineItemColumn(def, sel.offset, false, id);
    } else if (sel.offset === 0 && (matchesFreq || def === null)) {
      col = column(id);
    } else {
      // TTM blocks, derived history and latest-only metrics at past periods: not served by the stub.
      col = nullColumn(id, n, sel.offset === 0 ? "missing_input" : "insufficient_history");
      if (def) for (let i = 0; i < n; i++) if (!def.appliesTo.includes(family(i))) setNull(col, i, "not_applicable_financial");
    }
    columnCache.set(key, col);
    return col;
  }

  // ── peer groups ──
  function naturalKey(i: number, scope: PeerScope): string {
    const cls = peerClass(i);
    if (scope === "class") return cls;
    if (scope === "sector") return `${cls}|s|${companies[i].sector.trim().toLowerCase()}`;
    return `${cls}|i|${industryOf(i).trim().toLowerCase()}`;
  }

  const naturalSizeCache = new Map<PeerScope, Map<string, number>>();
  function naturalSizes(scope: PeerScope): Map<string, number> {
    let m = naturalSizeCache.get(scope);
    if (!m) {
      m = new Map();
      for (let i = 0; i < n; i++) {
        const k = naturalKey(i, scope);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      naturalSizeCache.set(scope, m);
    }
    return m;
  }

  function effectiveScope(i: number, scope: PeerScope): PeerScope {
    const order: PeerScope[] = scope === "industry" ? ["industry", "sector", "class"] : scope === "sector" ? ["sector", "class"] : ["class"];
    for (const s of order) {
      if ((naturalSizes(s).get(naturalKey(i, s)) ?? 0) >= PEER_MIN.group || s === "class") return s;
    }
    return "class";
  }

  function groups(scope: PeerScope): PeerGroups {
    const cached = groupCache.get(scope);
    if (cached) return cached;
    const groupOf = new Int32Array(n);
    const eff = new Uint8Array(n);
    const keyToId = new Map<string, number>();
    const labels: string[] = [];
    const sizes: number[] = [];
    for (let i = 0; i < n; i++) {
      const s = effectiveScope(i, scope);
      const k = naturalKey(i, s);
      let id = keyToId.get(k);
      if (id === undefined) {
        id = labels.length;
        keyToId.set(k, id);
        const size = naturalSizes(s).get(k) ?? 0;
        const name = s === "class" ? CLASS_LABEL[peerClass(i)] : s === "sector" ? companies[i].sector : industryOf(i);
        labels.push(`${name} · ${size} ${size === 1 ? "company" : "companies"} in your data`);
        sizes.push(size);
      }
      groupOf[i] = id;
      eff[i] = SCOPE_INDEX[s];
    }
    const g: PeerGroups = { scope, groupOf, effectiveScope: eff, labels, sizes: Int32Array.from(sizes) };
    groupCache.set(scope, g);
    return g;
  }

  /** Members of company i's effective peer group (natural group at the effective scope). */
  function members(i: number, scope: PeerScope): number[] {
    const s = effectiveScope(i, scope);
    const k = naturalKey(i, s);
    const out: number[] = [];
    for (let j = 0; j < n; j++) if (naturalKey(j, s) === k) out.push(j);
    return out;
  }

  function percentileOf(values: Float64Array, scope: PeerScope): MetricColumn {
    const out = emptyColumn(`pctl:${scope}`, n);
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(values[i])) {
        setNull(out, i, "missing_input");
        continue;
      }
      const xs = members(i, scope).map((j) => values[j]).filter((v) => Number.isFinite(v));
      if (xs.length < PEER_MIN.percentile) {
        setNull(out, i, "too_few_peers");
        continue;
      }
      const v = values[i];
      let below = 0;
      let equal = 0;
      for (const x of xs) {
        if (x < v) below++;
        else if (x === v) equal++;
      }
      const avgRank = below + (equal + 1) / 2; // 1-based, ties averaged
      setValue(out, i, (100 * (avgRank - 1)) / (xs.length - 1));
    }
    return out;
  }

  function medianOf(values: Float64Array, scope: PeerScope): MetricColumn {
    const out = emptyColumn(`median:${scope}`, n);
    for (let i = 0; i < n; i++) {
      const xs = members(i, scope).map((j) => values[j]).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
      if (xs.length < PEER_MIN.median) setNull(out, i, "too_few_peers");
      else setValue(out, i, median(xs));
    }
    return out;
  }

  const store: MetricStore = {
    key: options.key ?? `${dataset.meta.name}#${n}#${fnv1a32(JSON.stringify(dataset))}`,
    meta: dataset.meta,
    size: n,
    symbols,
    modalLatestFy,
    indexOf: (symbol) => indexBySymbol.get(symbol.trim().toUpperCase()) ?? -1,
    company: (i) => companies[i],
    companyType: (i) => types[i],
    family,
    peerClass,
    sector: (i) => companies[i].sector,
    industry: industryOf,
    def: (id) => DEF_BY_ID.get(id),
    defs: () => ALL_METRIC_DEFS,
    column,
    columnAt,
    get: (id, i) => valueAt(column(id), i),
    at: (id, i, sel) => valueAt(columnAt(id, sel), i),
    slots(i, grid) {
      const g = grids[i];
      const rows = grid === "fy" ? g.annual : grid === "q" ? g.quarter : g.share;
      return rows.length;
    },
    periodLabel(i, sel) {
      const g = grids[i];
      const c = companies[i];
      if (sel.freq === "fy") {
        const row = g.annual[sel.offset];
        return row ? fyLabel(row.fiscal_year) : null;
      }
      if (sel.freq === "q") {
        const row = g.quarter[sel.offset];
        return row ? quarterLabel(row.period_end, c.fy_end_month) : null;
      }
      const row = g.quarter[sel.offset * 4];
      return row ? ttmLabel(row.period_end) : null;
    },
    groups,
    percentileOf,
    medianOf,
    percentile(id, i, scope) {
      const col = column(id);
      if (!isPresent(col, i)) return valueAt(col, i);
      return valueAt(percentileOf(col.values, scope), i);
    },
    peerStat(id, i, scope): PeerStat {
      const col = column(id);
      const eff = effectiveScope(i, scope);
      const g = groups(scope);
      const xs = members(i, scope).map((j) => col.values[j]).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
      const enough = xs.length >= PEER_MIN.median;
      return {
        n: xs.length,
        median: enough ? median(xs) : null,
        p25: enough ? quantile(xs, 0.25) : null,
        p75: enough ? quantile(xs, 0.75) : null,
        groupLabel: g.labels[g.groupOf[i]],
        scope: eff,
        fellBackTo: eff !== scope ? eff : null,
      };
    },
    peers(i, scope, limit = 10) {
      const mc = column("market_cap");
      return members(i, scope)
        .filter((j) => j !== i)
        .sort((a, b) => {
          const va = isPresent(mc, a) ? mc.values[a] : -Infinity;
          const vb = isPresent(mc, b) ? mc.values[b] : -Infinity;
          return vb - va || (symbols[a] < symbols[b] ? -1 : symbols[a] > symbols[b] ? 1 : 0);
        })
        .slice(0, Math.max(0, limit));
    },
    coverage(id) {
      const col = column(id);
      const def = DEF_BY_ID.get(id);
      let nonNull = 0;
      let applicable = 0;
      for (let i = 0; i < n; i++) {
        if (def && !def.appliesTo.includes(family(i))) continue;
        applicable++;
        if (isPresent(col, i)) nonNull++;
      }
      return { nonNull, applicable };
    },
  };
  return store;
}

// ── createFixtureStore: a literal table of values for UI tests ──────────────
export interface FixtureCompany {
  symbol: string;
  name?: string;
  sector?: string;
  industry?: string | null;
  /** Defaults to "non_financial". Pass null to have the type inferred from the sector. */
  type?: CompanyType | null;
  /** Literal metric values; anything not listed behaves as in createTableStore (usually missing_input). */
  values?: Readonly<Record<MetricId, FixtureValue>>;
  /** Optional annual rows, for components that read statements. */
  annual?: AnnualRow[];
}

export interface FixtureTable {
  companies: readonly FixtureCompany[];
  meta?: Partial<DatasetMeta>;
}

export function fixtureDataset(table: FixtureTable): FundamentalsDataset {
  const meta: DatasetMeta = {
    name: "Fixture table (fictional)",
    source: "synthetic_sample",
    isSynthetic: true,
    asOf: null,
    importedAt: null,
    currency: "INR",
    moneyUnit: "crore",
    sharesUnit: "crore",
    files: [],
    generator: null,
    notes: [],
    ...table.meta,
  };
  return {
    schema: DATASET_SCHEMA,
    version: DATASET_VERSION,
    meta,
    companies: table.companies.map((c): CompanyRecord => ({
      symbol: c.symbol.toUpperCase(),
      name: c.name ?? c.symbol,
      sector: c.sector ?? "Unclassified",
      industry: c.industry ?? null,
      isin: null,
      company_type: c.type === undefined ? "non_financial" : c.type,
      statement_basis: "consolidated",
      fy_end_month: 3,
      market: { price: null, price_date: null, shares_outstanding: null, face_value: null, market_cap_supplied: null },
      annual: c.annual ?? [],
      quarterly: [],
      shareholding: [],
      snapshot: {},
      sample_note: null,
      source_note: null,
    })),
  };
}

export function createFixtureStore(table: FixtureTable, options: Partial<CreateStoreOptions> = {}): MetricStore {
  const dataset = fixtureDataset(table);
  return createTableStore(dataset, {
    ...options,
    overrides: table.companies.map((c) => c.values ?? {}),
    key: `fixture#${fnv1a32(JSON.stringify(table))}`,
  });
}

