// src/lib/screen/index.ts — public API of the screen engine (WS4).
// P0 STUB: runScreen computes matches and display order over the stub query language; the funnel,
// near misses and skipped groups are empty and TEMPLATES is empty. URL state, saved screens, the
// JSON backup and CSV export work in a simple form. WS4 replaces the bodies; signatures are final.
import type {
  ColumnSpec, CompiledQuery, DisplaySort, MetricId, MetricStore, ResolvedColumn, RunScreen, SavedScreensFile,
  ScreenDefinition, ScreenLibraryExport, ScreenRun, ScreenTemplate, ScreenUrlState, ScreenWarning, UniverseSpec,
} from "@/lib/contracts";
import { SAVED_SCREENS_VERSION, SCREEN_URL_VERSION, STORAGE_KEYS, TRI_FALSE, TRI_TRUE } from "@/lib/contracts";
import { CATALOGUE_VERSION } from "@/lib/metrics";
import { compileQuery, evaluateQuery } from "@/lib/query";
import { nowIso } from "@/lib/time/clock";
import { createId, readEnvelope, readRaw, writeEnvelope, writeRaw } from "@/lib/user/storage";

export const TEMPLATES: readonly ScreenTemplate[] = [];

/** Default metric columns after Name and Sector (§D.12). */
export const DEFAULT_COLUMNS: readonly MetricId[] = [
  "market_cap", "pe", "roce", "roe", "debt_equity", "sales_cagr_3y", "dividend_yield",
];

// ── universe ────────────────────────────────────────────────────────────────
function resolveUniverse(store: MetricStore, u: UniverseSpec, ctx: { watchlist: readonly string[]; portfolio: readonly string[] }) {
  const out: number[] = [];
  let unknown = 0;
  const fromSymbols = (symbols: readonly string[]) => {
    const seen = new Set<number>();
    for (const s of symbols) {
      const i = store.indexOf(s);
      if (i < 0) unknown++;
      else if (!seen.has(i)) {
        seen.add(i);
        out.push(i);
      }
    }
  };
  switch (u.kind) {
    case "all":
      for (let i = 0; i < store.size; i++) out.push(i);
      break;
    case "watchlist":
      fromSymbols(ctx.watchlist);
      break;
    case "portfolio":
      fromSymbols(ctx.portfolio);
      break;
    case "symbols":
      fromSymbols(u.symbols);
      break;
    case "sector": {
      const want = u.sector.trim().toLowerCase();
      for (let i = 0; i < store.size; i++) if (store.sector(i).trim().toLowerCase() === want) out.push(i);
      break;
    }
    case "industry": {
      const want = u.industry.trim().toLowerCase();
      for (let i = 0; i < store.size; i++) if (store.industry(i).trim().toLowerCase() === want) out.push(i);
      break;
    }
  }
  out.sort((a, b) => a - b);
  return { universe: Int32Array.from(out), unknown };
}

function numberAt(store: MetricStore, id: MetricId, i: number): number | null {
  try {
    return store.get(id, i).v;
  } catch {
    return null;
  }
}

function compareSymbols(store: MetricStore, a: number, b: number): number {
  const sa = store.symbols[a];
  const sb = store.symbols[b];
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** Market cap descending, nulls last, then symbol. */
function defaultOrder(store: MetricStore, a: number, b: number): number {
  const va = numberAt(store, "market_cap", a);
  const vb = numberAt(store, "market_cap", b);
  if (va !== null && vb !== null && va !== vb) return vb - va;
  if ((va === null) !== (vb === null)) return va === null ? 1 : -1;
  return compareSymbols(store, a, b);
}

function displayOrder(store: MetricStore, sort: DisplaySort, a: number, b: number): number {
  const dir = sort.dir === "asc" ? 1 : -1;
  if (sort.key === "name") {
    const na = store.company(a).name.toLowerCase();
    const nb = store.company(b).name.toLowerCase();
    return (na < nb ? -1 : na > nb ? 1 : 0) * dir || defaultOrder(store, a, b);
  }
  const va = numberAt(store, sort.key, a);
  const vb = numberAt(store, sort.key, b);
  if (va === null || vb === null) {
    if (va === vb) return defaultOrder(store, a, b);
    return va === null ? 1 : -1; // nulls last whatever the direction
  }
  return (va - vb) * dir || defaultOrder(store, a, b);
}

function resolveColumns(store: MetricStore, specs: ColumnSpec[] | null, compiled: CompiledQuery): ResolvedColumn[] {
  const ids: { id: MetricId; fromQuery: boolean }[] = [];
  const seen = new Set<string>();
  const add = (id: MetricId, fromQuery: boolean) => {
    if (seen.has(id) || !store.def(id)) return;
    seen.add(id);
    ids.push({ id, fromQuery });
  };
  for (const id of DEFAULT_COLUMNS) add(id, false);
  for (const id of compiled.metrics.slice(0, 8)) add(id, true);
  for (const spec of specs ?? []) if (spec.kind === "metric") add(spec.id, false);
  return ids.map(({ id, fromQuery }) => {
    const def = store.def(id);
    if (!def) throw new Error(`Unreachable: ${id}`);
    return {
      key: id, metricId: id, label: def.label, short: def.short, unit: def.unit, decimals: def.decimals,
      direction: def.direction, periodTag: def.periodTag, fromQuery, column: store.column(id),
    };
  });
}

function medianOfMatches(col: ResolvedColumn, matched: Int32Array): number | null {
  const xs: number[] = [];
  for (const i of matched) {
    const v = col.column.values[i];
    if (col.column.reasons[i] === 0 && Number.isFinite(v)) xs.push(v);
  }
  if (xs.length === 0) return null;
  xs.sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export const runScreen: RunScreen = (store, input, ctx, compiledArg) => {
  const compiled = compiledArg ?? compileQuery(input.query, store);
  const { universe, unknown } = resolveUniverse(store, input.universe, ctx);
  const evaluation = evaluateQuery(compiled, store, universe);
  const matchedList: number[] = [];
  for (let r = 0; r < universe.length; r++) if (evaluation.whereTri[r] === TRI_TRUE) matchedList.push(universe[r]);
  matchedList.sort((a, b) => defaultOrder(store, a, b));
  const matchCount = matchedList.length;
  const limited = compiled.limit !== null ? matchedList.slice(0, compiled.limit) : matchedList;
  const sort = input.sort;
  if (sort) limited.sort((a, b) => displayOrder(store, sort, a, b));
  const matched = Int32Array.from(limited);
  const warnings: ScreenWarning[] = [];
  if (unknown > 0) {
    warnings.push({
      code: "W_UNKNOWN_SYMBOLS", count: unknown,
      message: `${unknown} ${unknown === 1 ? "symbol is" : "symbols are"} not in the data you are viewing.`,
    });
  }
  const columns = compiled.ok ? resolveColumns(store, input.columns, compiled) : [];
  const medians: Record<string, number | null> = {};
  for (const c of columns) medians[c.key] = medianOfMatches(c, matched);
  const run: ScreenRun = {
    ok: compiled.ok,
    compiled,
    universe,
    matched,
    matchCount,
    sortValues: null,
    clauseTri: evaluation.clauseTri,
    clauseReason: evaluation.clauseReason,
    clauseLhs: evaluation.clauseLhs,
    clauseRhs: evaluation.clauseRhs,
    funnel: [],
    nearMisses: [],
    skipped: [],
    warnings,
    columns,
    medians,
    durationMs: 0,
  };
  return run;
};

// ── URL state ───────────────────────────────────────────────────────────────
const PAGE_SIZES = [25, 50, 100] as const;

function encodeUniverse(u: UniverseSpec): string {
  switch (u.kind) {
    case "all": return "all";
    case "watchlist": return "watchlist";
    case "portfolio": return "portfolio";
    case "sector": return `sector:${u.sector}`;
    case "industry": return `industry:${u.industry}`;
    case "symbols": return `symbols:${u.symbols.join(",")}`;
  }
}

function decodeUniverse(text: string | null): UniverseSpec {
  if (!text || text === "all") return { kind: "all" };
  if (text === "watchlist") return { kind: "watchlist" };
  if (text === "portfolio") return { kind: "portfolio" };
  const colon = text.indexOf(":");
  const kind = colon < 0 ? text : text.slice(0, colon);
  const rest = colon < 0 ? "" : text.slice(colon + 1);
  if (kind === "sector" && rest) return { kind: "sector", sector: rest };
  if (kind === "industry" && rest) return { kind: "industry", industry: rest };
  if (kind === "symbols" && rest) return { kind: "symbols", symbols: rest.split(",").map((s) => s.trim()).filter(Boolean) };
  return { kind: "all" };
}

export function encodeScreenUrl(s: ScreenUrlState): URLSearchParams {
  const p = new URLSearchParams();
  p.set("v", String(SCREEN_URL_VERSION));
  if (s.query) p.set("q", s.query);
  if (s.columns) p.set("cols", s.columns.flatMap((c) => (c.kind === "metric" ? [c.id] : [])).join(","));
  if (s.sort) p.set("sort", `${s.sort.dir === "desc" ? "-" : ""}${s.sort.key}`);
  if (s.universe.kind !== "all") p.set("u", encodeUniverse(s.universe));
  if (s.templateId) p.set("t", s.templateId);
  if (s.page > 1) p.set("p", String(s.page));
  if (s.pageSize !== 25) p.set("ps", String(s.pageSize));
  return p;
}

export function decodeScreenUrl(p: URLSearchParams): ScreenUrlState {
  const cols = p.get("cols");
  const sortText = p.get("sort");
  const legacySector = p.get("sector");
  const page = Number(p.get("p") ?? "1");
  const ps = Number(p.get("ps") ?? "25");
  return {
    v: SCREEN_URL_VERSION,
    query: p.get("q") ?? "",
    columns: cols === null ? null : cols.split(",").map((s) => s.trim()).filter(Boolean).map((id) => ({ kind: "metric" as const, id })),
    sort: sortText ? { key: sortText.replace(/^-/, ""), dir: sortText.startsWith("-") ? "desc" : "asc" } : null,
    universe: p.has("u") ? decodeUniverse(p.get("u")) : legacySector ? { kind: "sector", sector: legacySector } : { kind: "all" },
    templateId: p.get("t"),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(ps) ? (ps as 25 | 50 | 100) : 25,
  };
}

// ── saved screens ───────────────────────────────────────────────────────────
const V0_BACKUP_KEY = `${STORAGE_KEYS.screens}.v0-backup`;

interface V0Filter {
  metric: string;
  operator: "gt" | "lt" | "between" | "eq";
  value: number;
  value2?: number;
}

function v0ToQuery(filters: readonly V0Filter[]): string {
  const ops = { gt: ">", lt: "<", eq: "=" } as const;
  return filters
    .map((f) => {
      const id = f.metric === "price_book" ? "pb" : f.metric;
      if (f.operator === "between") return `${id} BETWEEN ${f.value} AND ${f.value2 ?? f.value}`;
      return `${id} ${ops[f.operator]} ${f.value}`;
    })
    .join("\n");
}

function isV0Filter(x: unknown): x is V0Filter {
  return typeof x === "object" && x !== null && typeof (x as V0Filter).metric === "string"
    && typeof (x as V0Filter).operator === "string" && typeof (x as V0Filter).value === "number";
}

function migrateScreens(raw: unknown): SavedScreensFile | null {
  // v0: a bare FilterCondition[] (the old Screener kept only the current filters).
  if (Array.isArray(raw)) {
    const filters = raw.filter(isV0Filter);
    if (filters.length === 0) return { v: SAVED_SCREENS_VERSION, screens: [] };
    const stamp = nowIso();
    return {
      v: SAVED_SCREENS_VERSION,
      screens: [{
        v: SAVED_SCREENS_VERSION, id: createId(), name: "Saved screen", description: "", query: v0ToQuery(filters),
        columns: [], sort: null, universe: { kind: "all" }, templateId: null, createdAt: stamp, updatedAt: stamp,
        catalogueVersion: CATALOGUE_VERSION,
      }],
    };
  }
  return null;
}

function readFile(): SavedScreensFile {
  const file = readEnvelope<SavedScreensFile>(STORAGE_KEYS.screens, SAVED_SCREENS_VERSION, migrateScreens);
  return file && Array.isArray(file.screens) ? file : { v: SAVED_SCREENS_VERSION, screens: [] };
}

function writeFile(file: SavedScreensFile): boolean {
  // Keep a one-time copy of a v0 value before it is overwritten (§B.12).
  const raw = readRaw(STORAGE_KEYS.screens);
  if (raw !== null && readRaw(V0_BACKUP_KEY) === null) {
    let isCurrent = false;
    try {
      const parsed = JSON.parse(raw) as { v?: unknown };
      isCurrent = typeof parsed === "object" && parsed !== null && parsed.v === SAVED_SCREENS_VERSION;
    } catch {
      isCurrent = false;
    }
    if (!isCurrent) writeRaw(V0_BACKUP_KEY, raw);
  }
  return writeEnvelope(STORAGE_KEYS.screens, SAVED_SCREENS_VERSION, file);
}

export function loadSavedScreens(): ScreenDefinition[] {
  return readFile().screens;
}

export function deleteScreen(id: string): void {
  const file = readFile();
  writeFile({ ...file, screens: file.screens.filter((s) => s.id !== id) });
}

export function saveScreen(
  def: Omit<ScreenDefinition, "v" | "id" | "createdAt" | "updatedAt" | "catalogueVersion"> & { id?: string },
): ScreenDefinition {
  const file = readFile();
  const stamp = nowIso();
  const existing = def.id ? file.screens.find((s) => s.id === def.id) : undefined;
  const saved: ScreenDefinition = {
    v: SAVED_SCREENS_VERSION,
    id: existing?.id ?? createId(),
    name: def.name,
    description: def.description,
    query: def.query,
    columns: def.columns,
    sort: def.sort,
    universe: def.universe,
    templateId: def.templateId,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
    catalogueVersion: CATALOGUE_VERSION,
  };
  const screens = existing ? file.screens.map((s) => (s.id === saved.id ? saved : s)) : [...file.screens, saved];
  writeFile({ v: SAVED_SCREENS_VERSION, screens });
  return saved;
}

export function exportScreenLibrary(): ScreenLibraryExport {
  return { kind: "funda-scanner-screens", v: SAVED_SCREENS_VERSION, exportedAt: nowIso(), screens: loadSavedScreens() };
}

function isScreenDefinition(x: unknown): x is ScreenDefinition {
  const s = x as ScreenDefinition;
  return typeof x === "object" && x !== null && typeof s.name === "string" && typeof s.query === "string";
}

export function importScreenLibrary(json: string): { added: number; renamed: number; errors: string[] } {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { added: 0, renamed: 0, errors: ["The file is not valid JSON."] };
  }
  const lib = parsed as Partial<ScreenLibraryExport>;
  if (typeof parsed !== "object" || parsed === null || lib.kind !== "funda-scanner-screens" || !Array.isArray(lib.screens)) {
    return { added: 0, renamed: 0, errors: ["The file is not a Funda Scanner screen library."] };
  }
  const file = readFile();
  const names = new Set(file.screens.map((s) => s.name));
  let added = 0;
  let renamed = 0;
  const stamp = nowIso();
  lib.screens.forEach((s, k) => {
    if (!isScreenDefinition(s)) {
      errors.push(`Screen ${k + 1} is missing a name or a query and was skipped.`);
      return;
    }
    let name = s.name;
    if (names.has(name)) {
      let n = 2;
      while (names.has(`${s.name} (${n})`)) n++;
      name = `${s.name} (${n})`;
      renamed++;
    }
    names.add(name);
    file.screens.push({
      v: SAVED_SCREENS_VERSION, id: createId(), name, description: typeof s.description === "string" ? s.description : "",
      query: s.query, columns: Array.isArray(s.columns) ? s.columns : [], sort: s.sort ?? null,
      universe: s.universe ?? { kind: "all" }, templateId: s.templateId ?? null,
      createdAt: typeof s.createdAt === "string" ? s.createdAt : stamp, updatedAt: stamp, catalogueVersion: CATALOGUE_VERSION,
    });
    added++;
  });
  if (added > 0 && !writeFile(file)) errors.push("The screens could not be saved in this browser.");
  return { added, renamed, errors };
}

// ── CSV export ──────────────────────────────────────────────────────────────
const CSV_INJECTION = /^[=+\-@\t\r]/;

/** One CSV cell: null → empty; numbers never prefixed; risky text gets a leading apostrophe. */
export function toCsvCell(v: string | number | null): string {
  if (v === null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  const text = CSV_INJECTION.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function screenToCsv(run: ScreenRun, store: MetricStore): string {
  const meta = store.meta;
  const header = [
    "# Funda Scanner screen export",
    `# Dataset: ${meta.name}`,
    `# Synthetic: ${meta.isSynthetic ? "yes (fictional companies)" : "no"}`,
    `# Imported at: ${meta.importedAt ?? "not applicable"}`,
    `# As of: ${meta.asOf ?? "not provided"}`,
    `# Query: ${run.compiled.canonical.replace(/[\r\n]+/g, " ")}`,
    `# In plain English: ${run.compiled.english.replace(/[\r\n]+/g, " ")}`,
    `# Catalogue version: ${CATALOGUE_VERSION}`,
    "# Blank cells mean missing or not applicable",
  ];
  const cols = run.columns;
  const titleRow = ["Symbol", "Name", "Sector", ...cols.map((c) => `${c.label} (${c.unit ?? ""}, ${c.periodTag})`), "is_synthetic"];
  const lines = [titleRow.map(toCsvCell).join(",")];
  for (const i of run.matched) {
    const c = store.company(i);
    const cells: (string | number | null)[] = [c.symbol, c.name, c.sector];
    for (const col of cols) {
      const v = col.column.values[i];
      cells.push(col.column.reasons[i] === 0 && Number.isFinite(v) ? v : null);
    }
    cells.push(meta.isSynthetic ? "true" : "false");
    lines.push(cells.map(toCsvCell).join(","));
  }
  return `\uFEFF${[...header, ...lines].join("\r\n")}\r\n`;
}

// ── screens a company passes ────────────────────────────────────────────────
export function screensPassedBy(
  store: MetricStore, index: number, screens: readonly { id: string; name: string; query: string }[],
): { id: string; name: string; passed: boolean | null }[] {
  const rows = Int32Array.of(index);
  return screens.map((s) => {
    const compiled = compileQuery(s.query, store);
    if (!compiled.ok) return { id: s.id, name: s.name, passed: null };
    const tri = evaluateQuery(compiled, store, rows).whereTri[0];
    return { id: s.id, name: s.name, passed: tri === TRI_TRUE ? true : tri === TRI_FALSE ? false : null };
  });
}
