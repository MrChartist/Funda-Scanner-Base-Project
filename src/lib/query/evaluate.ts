// src/lib/query/evaluate.ts — evaluation with Kleene logic and the documented null semantics (§D.6, §D.7).
// Every node is evaluated for every company in the store (peer functions need the whole dataset);
// numeric node columns are memoised per store under `canonical(node)@fy<context>` (LRU of 200).
import type {
  CompiledQuery, EvaluateQuery, Expr, MetricColumn, MetricStore, NullReason, PeerScope, QueryEvaluation, Tri,
} from "@/lib/contracts";
import { MAX_ANNUAL_SLOTS, NULL_REASONS, TRI_FALSE, TRI_TRUE, TRI_UNKNOWN, VF } from "@/lib/contracts";
import { aggregateWindow, cagrColumn } from "@/lib/metrics";
import { literalNode, PEER_SCOPE_OF, walk } from "./ast";
import { printExpr } from "./print";

/** NULL_REASONS index of a reason (0 = none). */
export function reasonCode(reason: NullReason | null): number {
  return reason === null ? 0 : NULL_REASONS.indexOf(reason);
}

/** Flags that describe how inputs were obtained; they carry through calculations. */
const INHERITED_FLAGS: number =
  VF.Approximate | VF.Proxy | VF.ClosingBasis | VF.Provided | VF.InferredType | VF.SalesBasis | VF.AssumedZero | VF.FyFallback;

/** True when entry i holds a usable number. */
export function isPresent(col: MetricColumn, i: number): boolean {
  return col.reasons[i] === 0 && Number.isFinite(col.values[i]);
}

export const CODE_MISSING = reasonCode("missing_input");
export const CODE_NAF = reasonCode("not_applicable_financial");
export const CODE_IH = reasonCode("insufficient_history");
export const CODE_NPD = reasonCode("non_positive_denominator");
export const CODE_NIC = reasonCode("no_interest_cost");
export const CODE_TP = reasonCode("transition_period");

/** Three-valued column. `r` holds the NULL_REASONS code of the dominant null where `t` is unknown. */
export interface BoolColumn {
  t: Uint8Array;
  r: Uint8Array;
}

// ── per-store caches ────────────────────────────────────────────────────────
const CACHE_SIZE = 200;

class Lru<V> {
  private readonly map = new Map<string, V>();
  constructor(private readonly max: number) {}
  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key: string, v: V): void {
    this.map.delete(key);
    this.map.set(key, v);
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }
  get size(): number {
    return this.map.size;
  }
}

const columnCaches = new WeakMap<MetricStore, Lru<MetricColumn>>();
const boolCaches = new WeakMap<MetricStore, Lru<BoolColumn>>();
const historyCaches = new WeakMap<MetricStore, { latest: Int32Array; flagged: (ReadonlySet<number> | null)[] }>();
const keyCache = new WeakMap<Expr, string>();
const rankCache = new WeakMap<Expr, boolean>();

function cacheFor(store: MetricStore): Lru<MetricColumn> {
  let c = columnCaches.get(store);
  if (!c) {
    c = new Lru<MetricColumn>(CACHE_SIZE);
    columnCaches.set(store, c);
  }
  return c;
}

function boolCacheFor(store: MetricStore): Lru<BoolColumn> {
  let c = boolCaches.get(store);
  if (!c) {
    c = new Lru<BoolColumn>(CACHE_SIZE);
    boolCaches.set(store, c);
  }
  return c;
}

/** Number of memoised columns for a store (tests). */
export function cachedColumnCount(store: MetricStore): number {
  return columnCaches.get(store)?.size ?? 0;
}

function nodeKey(e: Expr): string {
  let k = keyCache.get(e);
  if (k === undefined) {
    k = printExpr(e);
    keyCache.set(e, k);
  }
  return k;
}

function hasRank(e: Expr): boolean {
  let v = rankCache.get(e);
  if (v === undefined) {
    let found = false;
    walk(e, (x) => {
      if (x.k === "call" && x.fn === "rank") found = true;
      return !found;
    });
    v = found;
    rankCache.set(e, v);
  }
  return v;
}

/** Latest fiscal year per company and the set of flagged (restated or transition) years. */
function historyInfo(store: MetricStore): { latest: Int32Array; flagged: (ReadonlySet<number> | null)[] } {
  let h = historyCaches.get(store);
  if (!h) {
    const latest = new Int32Array(store.size).fill(-1);
    const flagged: (ReadonlySet<number> | null)[] = [];
    for (let i = 0; i < store.size; i++) {
      let set: Set<number> | null = null;
      for (const row of store.company(i).annual) {
        if (row.fiscal_year > latest[i]) latest[i] = row.fiscal_year;
        if (row.flags.length > 0) (set ??= new Set()).add(row.fiscal_year);
      }
      flagged.push(set);
    }
    h = { latest, flagged };
    historyCaches.set(store, h);
  }
  return h;
}

/** True when any annual slot c..c+span-1 of company i is a restated or transition year. */
export function transitionInWindow(store: MetricStore, i: number, c: number, span: number): boolean {
  const h = historyInfo(store);
  const set = h.flagged[i];
  if (!set || h.latest[i] < 0) return false;
  for (let k = c; k < c + span; k++) if (set.has(h.latest[i] - k)) return true;
  return false;
}

// ── columns ─────────────────────────────────────────────────────────────────
function newColumn(id: string, n: number): MetricColumn {
  return { id, values: new Float64Array(n).fill(Number.NaN), reasons: new Uint8Array(n).fill(CODE_MISSING), flags: new Uint16Array(n) };
}

function put(col: MetricColumn, i: number, v: number, flags: number): void {
  if (Number.isFinite(v)) {
    col.values[i] = v;
    col.reasons[i] = 0;
    col.flags[i] = flags;
  } else {
    col.values[i] = Number.NaN;
    col.reasons[i] = CODE_NPD;
    col.flags[i] = flags;
  }
}

function putNull(col: MetricColumn, i: number, code: number, flags = 0): void {
  col.values[i] = Number.NaN;
  col.reasons[i] = code === 0 ? CODE_MISSING : code;
  col.flags[i] = flags;
}

function copyColumn(c: MetricColumn, id: string): MetricColumn {
  return { id, values: Float64Array.from(c.values), reasons: Uint8Array.from(c.reasons), flags: Uint16Array.from(c.flags) };
}

function newBool(n: number): BoolColumn {
  return { t: new Uint8Array(n).fill(TRI_UNKNOWN), r: new Uint8Array(n).fill(CODE_MISSING) };
}

// ── literal precision for "=" ───────────────────────────────────────────────
/** Digits written after the decimal point in a literal, adjusted for k/lakh scaling. */
export function literalDecimals(e: Expr, source: string): number {
  const node = literalNode(e);
  if (!node) return 0;
  const text = source.slice(node.span.start, node.span.end);
  const m = /^[\d_]*(?:\.([\d_]+))?/.exec(text);
  const frac = m && m[1] ? m[1].replace(/_/g, "").length : 0;
  const scale = node.suffix === "k" ? 3 : node.suffix === "lakh" ? 5 : 0;
  return Math.max(0, frac - scale);
}

/** Display decimals of a numeric expression (the tolerance for "="). */
export function decimalsOf(e: Expr, store: MetricStore, source: string): number {
  switch (e.k) {
    case "num": return literalDecimals(e, source);
    case "ref": return store.def(e.metric)?.decimals ?? 2;
    case "neg": return decimalsOf(e.arg, store, source);
    case "bin": return Math.max(decimalsOf(e.l, store, source), decimalsOf(e.r, store, source));
    case "call":
      switch (e.fn) {
        case "cagr": case "growth": return 1;
        case "pctl": case "sector_pctl": case "industry_pctl": case "count": case "streak": case "rank": return 0;
        default: return e.args[0] ? decimalsOf(e.args[0], store, source) : 2;
      }
    default: return 2;
  }
}

// ── the evaluator ───────────────────────────────────────────────────────────
export interface EvalEnv {
  store: MetricStore;
  n: number;
  source: string;
  cache: Lru<MetricColumn>;
  boolCache: Lru<BoolColumn>;
  /** Set while evaluating SORT BY: rank() ranks only these store indices. */
  rankRows: Int32Array | null;
}

export function makeEnv(store: MetricStore, source: string, rankRows: Int32Array | null = null): EvalEnv {
  return { store, n: store.size, source, cache: cacheFor(store), boolCache: boolCacheFor(store), rankRows };
}

function safeColumn(env: EvalEnv, get: () => MetricColumn, id: string): MetricColumn {
  try {
    return get();
  } catch {
    return newColumn(id, env.n);
  }
}

function refColumn(e: Extract<Expr, { k: "ref" }>, c: number, env: EvalEnv): MetricColumn {
  const { store } = env;
  const d = store.def(e.metric);
  const id = e.metric;
  const sel = e.selector;
  if (!sel) {
    if (c === 0 || !d || d.history !== "annual") return safeColumn(env, () => store.column(id), id);
    return safeColumn(env, () => store.columnAt(id, { freq: "fy", offset: c }), id);
  }
  switch (sel.kind) {
    case "fy": return safeColumn(env, () => store.columnAt(id, { freq: "fy", offset: sel.offset }), id);
    case "ttm": return safeColumn(env, () => store.columnAt(id, { freq: "ttm", offset: sel.offset }), id);
    case "q": return safeColumn(env, () => store.columnAt(id, { freq: "q", offset: sel.offset }), id);
    case "prev":
      return d && d.history === "annual"
        ? safeColumn(env, () => store.columnAt(id, { freq: "fy", offset: c + 1 }), id)
        : safeColumn(env, () => store.columnAt(id, { freq: "q", offset: 1 }), id);
  }
}

export function evalNum(e: Expr, c: number, env: EvalEnv): MetricColumn {
  const cacheable = e.k !== "num" && e.k !== "error" && !(env.rankRows && hasRank(e));
  const key = cacheable ? `${nodeKey(e)}@fy${c}` : "";
  if (cacheable) {
    const hit = env.cache.get(key);
    if (hit) return hit;
  }
  const col = computeNum(e, c, env, key || nodeKey(e));
  if (cacheable) env.cache.set(key, col);
  return col;
}

function computeNum(e: Expr, c: number, env: EvalEnv, id: string): MetricColumn {
  const n = env.n;
  switch (e.k) {
    case "num": {
      const col = newColumn(id, n);
      for (let i = 0; i < n; i++) put(col, i, e.value, 0);
      return col;
    }
    case "ref": return refColumn(e, c, env);
    case "neg": {
      const a = evalNum(e.arg, c, env);
      const out = newColumn(id, n);
      for (let i = 0; i < n; i++) {
        if (isPresent(a, i)) put(out, i, -a.values[i], a.flags[i] & INHERITED_FLAGS);
        else putNull(out, i, a.reasons[i], a.flags[i] & INHERITED_FLAGS);
      }
      return out;
    }
    case "bin": {
      const l = evalNum(e.l, c, env);
      const r = evalNum(e.r, c, env);
      const out = newColumn(id, n);
      for (let i = 0; i < n; i++) {
        const flags = (l.flags[i] | r.flags[i]) & INHERITED_FLAGS;
        if (!isPresent(l, i)) {
          putNull(out, i, l.reasons[i], flags);
          continue;
        }
        if (!isPresent(r, i)) {
          putNull(out, i, r.reasons[i], flags);
          continue;
        }
        const a = l.values[i];
        const b = r.values[i];
        switch (e.op) {
          case "+": put(out, i, a + b, flags); break;
          case "-": put(out, i, a - b, flags); break;
          case "*": put(out, i, a * b, flags); break;
          case "/":
            if (b === 0) putNull(out, i, CODE_NPD, flags);
            else put(out, i, a / b, flags);
            break;
        }
      }
      return out;
    }
    case "call": return callNum(e, c, env, id);
    default: return newColumn(id, n);
  }
}

function callNum(e: Extract<Expr, { k: "call" }>, c: number, env: EvalEnv, id: string): MetricColumn {
  const { store, n } = env;
  const fn = e.fn;
  const w = e.window;
  switch (fn) {
    case "abs": {
      const a = evalNum(e.args[0], c, env);
      const out = newColumn(id, n);
      for (let i = 0; i < n; i++) {
        if (isPresent(a, i)) put(out, i, Math.abs(a.values[i]), a.flags[i] & INHERITED_FLAGS);
        else putNull(out, i, a.reasons[i]);
      }
      return out;
    }
    case "growth": {
      const a = evalNum(e.args[0], c, env);
      const b = evalNum(e.args[1], c, env);
      const out = newColumn(id, n);
      for (let i = 0; i < n; i++) {
        if (!isPresent(a, i)) {
          putNull(out, i, a.reasons[i]);
          continue;
        }
        if (!isPresent(b, i)) {
          putNull(out, i, b.reasons[i]);
          continue;
        }
        const x = a.values[i];
        const y = b.values[i];
        const flags = (a.flags[i] | b.flags[i]) & INHERITED_FLAGS;
        if (y <= 0) putNull(out, i, CODE_NPD, x > 0 ? flags | VF.Turnaround : flags);
        else put(out, i, (x / y - 1) * 100, flags);
      }
      return out;
    }
    case "min":
    case "max":
    case "avg":
    case "median":
    case "sum":
    case "stdev": {
      if ((fn === "min" || fn === "max") && !w) {
        const cols = e.args.map((a) => evalNum(a, c, env));
        const out = newColumn(id, n);
        for (let i = 0; i < n; i++) {
          let v = fn === "min" ? Infinity : -Infinity;
          let ok = true;
          let flags = 0;
          for (const col of cols) {
            if (!isPresent(col, i)) {
              putNull(out, i, col.reasons[i]);
              ok = false;
              break;
            }
            v = fn === "min" ? Math.min(v, col.values[i]) : Math.max(v, col.values[i]);
            flags |= col.flags[i] & INHERITED_FLAGS;
          }
          if (ok) put(out, i, v, flags);
        }
        return out;
      }
      const N = w ? w.n : 1;
      const cols = Array.from({ length: N }, (_, k) => evalNum(e.args[0], c + k, env));
      const out = copyColumn(aggregateWindow(fn, cols, id), id);
      markTransition(out, env, c, N);
      return out;
    }
    case "cagr": {
      const N = w ? w.n : 1;
      const end = evalNum(e.args[0], c, env);
      const start = evalNum(e.args[0], c + N, env);
      const out = copyColumn(cagrColumn(end, start, N, id), id);
      markTransition(out, env, c, N + 1);
      return out;
    }
    case "count": {
      const N = w ? w.n : 1;
      const years = Array.from({ length: N }, (_, k) => evalBool(e.args[0], c + k, env));
      const out = newColumn(id, n);
      for (let i = 0; i < n; i++) {
        let count = 0;
        let unknown = 0;
        for (const y of years) {
          if (y.t[i] === TRI_TRUE) count++;
          else if (y.t[i] === TRI_UNKNOWN && unknown === 0) unknown = y.r[i] || CODE_MISSING;
        }
        if (unknown) putNull(out, i, unknown);
        else if (store.slots(i, "fy") < c + N) putNull(out, i, CODE_IH);
        else put(out, i, count, 0);
      }
      return out;
    }
    case "streak": return streakColumn(e, c, env, id);
    case "pctl":
    case "sector_pctl":
    case "industry_pctl":
    case "sector_median":
    case "industry_median": {
      const scope = PEER_SCOPE_OF[fn] as PeerScope;
      const x = evalNum(e.args[0], 0, env);
      const values = new Float64Array(n);
      for (let i = 0; i < n; i++) values[i] = isPresent(x, i) ? x.values[i] : Number.NaN;
      const isPctl = fn.endsWith("pctl");
      let peer: MetricColumn;
      try {
        peer = isPctl ? store.percentileOf(values, scope) : store.medianOf(values, scope);
      } catch {
        return newColumn(id, n);
      }
      const out = copyColumn(peer, id);
      for (let i = 0; i < n; i++) {
        if (isPresent(x, i)) continue;
        if (isPctl || x.reasons[i] === CODE_NAF) putNull(out, i, x.reasons[i]);
      }
      return out;
    }
    case "rank": return rankColumn(e, env, id);
    default: return newColumn(id, n);
  }
}

function markTransition(out: MetricColumn, env: EvalEnv, c: number, span: number): void {
  for (let i = 0; i < env.n; i++) {
    if (out.reasons[i] === CODE_NAF) continue;
    if (transitionInWindow(env.store, i, c, span)) putNull(out, i, CODE_TP, out.flags[i]);
  }
}

function streakColumn(e: Extract<Expr, { k: "call" }>, c: number, env: EvalEnv, id: string): MetricColumn {
  const { store, n } = env;
  const out = newColumn(id, n);
  let maxSlots = 0;
  const slots = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    slots[i] = Math.min(store.slots(i, "fy"), MAX_ANNUAL_SLOTS);
    if (slots[i] > maxSlots) maxSlots = slots[i];
  }
  const years: BoolColumn[] = [];
  for (let k = c; k < maxSlots; k++) years.push(evalBool(e.args[0], k, env));
  for (let i = 0; i < n; i++) {
    if (slots[i] <= c) {
      putNull(out, i, CODE_IH);
      continue;
    }
    let count = 0;
    let flags = 0;
    let unknownAtStart = 0;
    let k = c;
    for (; k < slots[i]; k++) {
      const y = years[k - c];
      const t = y.t[i];
      if (t === TRI_TRUE) {
        count++;
        continue;
      }
      if (t === TRI_UNKNOWN) {
        if (count === 0) unknownAtStart = y.r[i] || CODE_MISSING;
        else flags |= VF.LimitOfData;
      }
      break;
    }
    if (k >= slots[i]) flags |= VF.LimitOfData;
    if (unknownAtStart) putNull(out, i, unknownAtStart);
    else put(out, i, count, flags);
  }
  return out;
}

function rankColumn(e: Extract<Expr, { k: "call" }>, env: EvalEnv, id: string): MetricColumn {
  const n = env.n;
  const out = newColumn(id, n);
  const x = evalNum(e.args[0], 0, env);
  const rows = env.rankRows ?? new Int32Array(0);
  for (let i = 0; i < n; i++) if (!isPresent(x, i)) putNull(out, i, x.reasons[i]);
  const present: number[] = [];
  for (const i of rows) if (isPresent(x, i)) present.push(i);
  const desc = e.order !== "asc";
  present.sort((a, b) => (desc ? x.values[b] - x.values[a] : x.values[a] - x.values[b]));
  // Average ranks for ties (1 = best).
  let k = 0;
  while (k < present.length) {
    let j = k;
    while (j + 1 < present.length && x.values[present[j + 1]] === x.values[present[k]]) j++;
    const avg = (k + 1 + j + 1) / 2;
    for (let m = k; m <= j; m++) put(out, present[m], avg, 0);
    k = j + 1;
  }
  return out;
}

// ── boolean evaluation ──────────────────────────────────────────────────────
function textValues(env: EvalEnv, field: "sector" | "industry" | "symbol" | "name"): string[] {
  const out: string[] = [];
  for (let i = 0; i < env.n; i++) {
    const v = field === "sector" ? env.store.sector(i)
      : field === "industry" ? env.store.industry(i)
      : field === "symbol" ? env.store.symbols[i]
      : env.store.company(i).name;
    out.push((v ?? "").trim().toLowerCase());
  }
  return out;
}

function typeTest(env: EvalEnv, i: number, test: Extract<Expr, { k: "is" }>["test"]): boolean {
  const { store } = env;
  const type = store.companyType(i).type;
  switch (test) {
    case "bank": return type === "bank";
    case "nbfc": return type === "nbfc";
    case "insurer": return type === "insurance";
    case "lender": return store.family(i) === "lender";
    case "financial": return store.family(i) !== "non_financial";
    case "non_financial": return store.family(i) === "non_financial";
    case "consolidated": return store.company(i).statement_basis === "consolidated";
    case "standalone": return store.company(i).statement_basis === "standalone";
  }
}

/** Value of operand i for a comparison: NaN when unknown; +∞ for "no interest cost" on a metric. */
function operand(col: MetricColumn, i: number, nicAllowed: boolean): number {
  if (isPresent(col, i)) return col.values[i];
  if (nicAllowed && col.reasons[i] === CODE_NIC) return Infinity;
  return Number.NaN;
}

function compare(op: Extract<Expr, { k: "cmp" }>["op"], a: number, b: number, tol: number | null): boolean {
  const equal = (): boolean => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
    const t = tol ?? 1e-9 * Math.max(Math.abs(a), Math.abs(b));
    return Math.abs(a - b) <= t + 1e-12;
  };
  switch (op) {
    case ">": return a > b;
    case ">=": return a >= b;
    case "<": return a < b;
    case "<=": return a <= b;
    case "=": return equal();
    case "!=": return !equal();
  }
}

/** Absolute tolerance for "=" when one side is a literal, else null (relative 1e-9). */
export function equalityTolerance(e: Extract<Expr, { k: "cmp" }>, env: EvalEnv): number | null {
  const litL = literalNode(e.l);
  const litR = literalNode(e.r);
  if (!litL && !litR) return null;
  const other = litR ? e.l : e.r;
  const lit = litR ? e.r : e.l;
  const d = Math.max(decimalsOf(other, env.store, env.source), literalDecimals(lit, env.source));
  return 0.5 * Math.pow(10, -d);
}

/**
 * "=" compares at the precision written in the source (15 vs 15.00), which the canonical text
 * does not keep; the tolerances of every "=" and "!=" are therefore part of a condition's key.
 */
function precisionSignature(e: Expr, env: EvalEnv): string {
  let sig = "";
  walk(e, (x) => {
    if (x.k === "cmp" && (x.op === "=" || x.op === "!=") && x.l.k !== "text" && x.r.k !== "text") {
      sig += `~${equalityTolerance(x, env) ?? "rel"}`;
    }
  });
  return sig;
}

/** Three-valued column of a condition at context year c (memoised per store, like numeric nodes). */
export function evalBool(e: Expr, c: number, env: EvalEnv): BoolColumn {
  const cacheable = e.k !== "error" && !(env.rankRows && hasRank(e));
  if (!cacheable) return computeBool(e, c, env);
  const key = `${nodeKey(e)}@fy${c}${precisionSignature(e, env)}`;
  const hit = env.boolCache.get(key);
  if (hit) return hit;
  const col = computeBool(e, c, env);
  env.boolCache.set(key, col);
  return col;
}

function computeBool(e: Expr, c: number, env: EvalEnv): BoolColumn {
  const n = env.n;
  switch (e.k) {
    case "cmp": {
      if (e.l.k === "text" || e.r.k === "text") {
        const out = newBool(n);
        const field = e.l.k === "text" ? e.l.field : (e.r as Extract<Expr, { k: "text" }>).field;
        const other = e.l.k === "text" ? e.r : e.l;
        if (other.k !== "str") return out;
        const want = other.value.trim().toLowerCase();
        const vals = textValues(env, field);
        for (let i = 0; i < n; i++) {
          const eq = vals[i] === want;
          out.t[i] = (e.op === "=" ? eq : e.op === "!=" ? !eq : false) ? TRI_TRUE : TRI_FALSE;
          out.r[i] = 0;
        }
        return out;
      }
      const l = evalNum(e.l, c, env);
      const r = evalNum(e.r, c, env);
      const tol = e.op === "=" || e.op === "!=" ? equalityTolerance(e, env) : null;
      const out = newBool(n);
      const nicL = e.l.k === "ref";
      const nicR = e.r.k === "ref";
      for (let i = 0; i < n; i++) {
        const a = operand(l, i, nicL);
        const b = operand(r, i, nicR);
        if (Number.isNaN(a)) {
          out.r[i] = l.reasons[i] || CODE_MISSING;
          continue;
        }
        if (Number.isNaN(b)) {
          out.r[i] = r.reasons[i] || CODE_MISSING;
          continue;
        }
        out.t[i] = compare(e.op, a, b, tol) ? TRI_TRUE : TRI_FALSE;
        out.r[i] = 0;
      }
      return out;
    }
    case "between": {
      const x = evalNum(e.x, c, env);
      const lo = evalNum(e.lo, c, env);
      const hi = evalNum(e.hi, c, env);
      const nic = e.x.k === "ref";
      const out = newBool(n);
      for (let i = 0; i < n; i++) {
        const a = operand(x, i, nic);
        const l = operand(lo, i, false);
        const h = operand(hi, i, false);
        if (Number.isNaN(a)) out.r[i] = x.reasons[i] || CODE_MISSING;
        else if (Number.isNaN(l)) out.r[i] = lo.reasons[i] || CODE_MISSING;
        else if (Number.isNaN(h)) out.r[i] = hi.reasons[i] || CODE_MISSING;
        else {
          const inside = a >= l && a <= h;
          out.t[i] = inside !== e.negated ? TRI_TRUE : TRI_FALSE;
          out.r[i] = 0;
        }
      }
      return out;
    }
    case "in": {
      const out = newBool(n);
      if (e.x.k !== "text") return out;
      const vals = textValues(env, e.x.field);
      const set = new Set(e.items.map((s) => s.trim().toLowerCase()));
      for (let i = 0; i < n; i++) {
        out.t[i] = set.has(vals[i]) !== e.negated ? TRI_TRUE : TRI_FALSE;
        out.r[i] = 0;
      }
      return out;
    }
    case "and":
    case "or": {
      const parts = e.items.map((x) => evalBool(x, c, env));
      const out = newBool(n);
      const dominant = e.k === "and" ? TRI_FALSE : TRI_TRUE;
      const other = e.k === "and" ? TRI_TRUE : TRI_FALSE;
      for (let i = 0; i < n; i++) {
        let res: Tri = other;
        let reason = 0;
        for (const p of parts) {
          const t = p.t[i] as Tri;
          if (t === dominant) {
            res = dominant;
            reason = 0;
            break;
          }
          if (t === TRI_UNKNOWN && res !== TRI_UNKNOWN) {
            res = TRI_UNKNOWN;
            reason = p.r[i] || CODE_MISSING;
          }
        }
        out.t[i] = res;
        out.r[i] = res === TRI_UNKNOWN ? reason : 0;
      }
      return out;
    }
    case "not": {
      const a = evalBool(e.arg, c, env);
      const out = newBool(n);
      for (let i = 0; i < n; i++) {
        out.t[i] = a.t[i] === TRI_TRUE ? TRI_FALSE : a.t[i] === TRI_FALSE ? TRI_TRUE : TRI_UNKNOWN;
        out.r[i] = a.t[i] === TRI_UNKNOWN ? a.r[i] || CODE_MISSING : 0;
      }
      return out;
    }
    case "is": {
      const out = newBool(n);
      for (let i = 0; i < n; i++) {
        out.t[i] = typeTest(env, i, e.test) !== e.negated ? TRI_TRUE : TRI_FALSE;
        out.r[i] = 0;
      }
      return out;
    }
    case "call":
      return callBool(e, c, env);
    default:
      return newBool(n);
  }
}

function callBool(e: Extract<Expr, { k: "call" }>, c: number, env: EvalEnv): BoolColumn {
  const { store, n } = env;
  const out = newBool(n);
  if (e.fn === "has") {
    const x = evalNum(e.args[0], c, env);
    for (let i = 0; i < n; i++) {
      out.t[i] = isPresent(x, i) ? TRI_TRUE : TRI_FALSE;
      out.r[i] = 0;
    }
    return out;
  }
  if ((e.fn === "every" || e.fn === "any") && e.window) {
    const N = e.window.n;
    const years = Array.from({ length: N }, (_, k) => evalBool(e.args[0], c + k, env));
    const every = e.fn === "every";
    for (let i = 0; i < n; i++) {
      let sawFalse = false;
      let sawTrue = false;
      let unknown = 0;
      for (const y of years) {
        if (y.t[i] === TRI_FALSE) sawFalse = true;
        else if (y.t[i] === TRI_TRUE) sawTrue = true;
        else if (!unknown) unknown = y.r[i] || CODE_MISSING;
      }
      const short = store.slots(i, "fy") < c + N;
      if (every) {
        if (sawFalse) out.t[i] = TRI_FALSE;
        else if (unknown || short) out.r[i] = unknown || CODE_IH;
        else out.t[i] = TRI_TRUE;
      } else if (sawTrue) out.t[i] = TRI_TRUE;
      else if (unknown || short) out.r[i] = unknown || CODE_IH;
      else out.t[i] = TRI_FALSE;
      if (out.t[i] !== TRI_UNKNOWN) out.r[i] = 0;
    }
    return out;
  }
  return out;
}

// ── public evaluation ───────────────────────────────────────────────────────
function lhsRhs(e: Expr, env: EvalEnv): { l: MetricColumn | null; r: MetricColumn | null; between: boolean } {
  if (e.k === "cmp" && e.l.k !== "text" && e.r.k !== "text") return { l: evalNum(e.l, 0, env), r: evalNum(e.r, 0, env), between: false };
  if (e.k === "between") return { l: evalNum(e.x, 0, env), r: null, between: true };
  return { l: null, r: null, between: false };
}

export const evaluateQuery: EvaluateQuery = (query, store, rows) => {
  const env = makeEnv(store, query.source);
  const m = rows.length;
  const clauseTri: Uint8Array[] = [];
  const clauseReason: Uint8Array[] = [];
  const clauseLhs: Float64Array[] = [];
  const clauseRhs: Float64Array[] = [];
  for (const clause of query.clauses) {
    const tri = new Uint8Array(m).fill(TRI_UNKNOWN);
    const reason = new Uint8Array(m);
    const lhs = new Float64Array(m).fill(Number.NaN);
    const rhs = new Float64Array(m).fill(Number.NaN);
    if (query.ok) {
      const b = evalBool(clause.ast, 0, env);
      const sides = lhsRhs(clause.ast, env);
      let lo: MetricColumn | null = null;
      let hi: MetricColumn | null = null;
      if (sides.between && clause.ast.k === "between") {
        lo = evalNum(clause.ast.lo, 0, env);
        hi = evalNum(clause.ast.hi, 0, env);
      }
      for (let k = 0; k < m; k++) {
        const i = rows[k];
        tri[k] = b.t[i];
        reason[k] = b.t[i] === TRI_UNKNOWN ? b.r[i] || CODE_MISSING : 0;
        if (sides.l && isPresent(sides.l, i)) lhs[k] = sides.l.values[i];
        if (sides.r && isPresent(sides.r, i)) rhs[k] = sides.r.values[i];
        if (lo && hi && isPresent(lo, i) && isPresent(hi, i)) {
          const x = lhs[k];
          rhs[k] = Number.isFinite(x) && x > hi.values[i] ? hi.values[i] : lo.values[i];
        }
      }
    }
    clauseTri.push(tri);
    clauseReason.push(reason);
    clauseLhs.push(lhs);
    clauseRhs.push(rhs);
  }
  const whereTri = new Uint8Array(m).fill(query.ok ? TRI_TRUE : TRI_UNKNOWN);
  if (query.ok) {
    for (let k = 0; k < m; k++) {
      let res: Tri = TRI_TRUE;
      for (const tri of clauseTri) {
        if (tri[k] === TRI_FALSE) {
          res = TRI_FALSE;
          break;
        }
        if (tri[k] === TRI_UNKNOWN) res = TRI_UNKNOWN;
      }
      whereTri[k] = res;
    }
  }
  return { rows: Int32Array.from(rows), clauseTri, clauseReason, clauseLhs, clauseRhs, whereTri };
};

/** SORT BY keys for the matching companies: one column per sort item (rank() ranks only `matched`). */
export function evaluateSortKeys(query: CompiledQuery, store: MetricStore, matched: Int32Array): MetricColumn[] {
  if (!query.ok || !query.ast) return [];
  const env = makeEnv(store, query.source, matched);
  return query.ast.sort.map((s) => evalNum(s.expr, 0, env));
}

/** Numeric column of an expression over every company (cached). */
export function evaluateNumericNode(e: Expr, store: MetricStore, source: string, c = 0): MetricColumn {
  return evalNum(e, c, makeEnv(store, source));
}

export function evaluateBoolNode(e: Expr, store: MetricStore, source: string, c = 0): BoolColumn {
  return evalBool(e, c, makeEnv(store, source));
}

export function reasonOf(code: number): NullReason | null {
  if (code <= 0 || code >= NULL_REASONS.length) return null;
  return NULL_REASONS[code] as NullReason;
}

/**
 * Default-period column of a metric through the same per-store memo the evaluator uses, so
 * re-running a screen does not ask the store again. Throws UnknownMetricError for unknown ids.
 */
export function cachedMetricColumn(store: MetricStore, id: string): MetricColumn {
  const env = makeEnv(store, "");
  const key = `${id}@fy0`;
  const hit = env.cache.get(key);
  if (hit) return hit;
  const col = store.column(id);
  env.cache.set(key, col);
  return col;
}
