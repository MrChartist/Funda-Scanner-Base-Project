// src/lib/screen/saved.ts — saved screens v2 in localStorage, the v0 migration (§B.12) and the
// JSON screen library (backup and restore). Names are unique (case-insensitive).
import type {
  ColumnSpec, DisplaySort, SavedScreensFile, ScreenDefinition, ScreenLibraryExport, UniverseSpec,
} from "@/lib/contracts";
import { SAVED_SCREENS_VERSION, STORAGE_KEYS } from "@/lib/contracts";
import { CATALOGUE_VERSION } from "@/lib/metrics";
import { nowIso } from "@/lib/time/clock";
import { createId, readEnvelope, readRaw, writeEnvelope, writeRaw } from "@/lib/user/storage";

/** The original v0 value is copied here once, before the v2 file first overwrites it. */
export const V0_BACKUP_KEY = `${STORAGE_KEYS.screens}.v0-backup`;
export const MAX_NAME_LENGTH = 80;

export class ScreenNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScreenNameError";
  }
}

// ── v0 → v2 ─────────────────────────────────────────────────────────────────
interface V0Filter {
  metric: string;
  operator: "gt" | "lt" | "between" | "eq";
  value: number;
  value2?: number;
}

const V0_OPS: Readonly<Record<V0Filter["operator"], string>> = { gt: ">", lt: "<", eq: "=", between: "BETWEEN" };
/** v0 metric keys that were renamed in v1. */
const V0_METRIC_RENAMES: Readonly<Record<string, string>> = { price_book: "pb" };

function isV0Filter(x: unknown): x is V0Filter {
  if (typeof x !== "object" || x === null) return false;
  const f = x as Partial<V0Filter>;
  return typeof f.metric === "string" && /^[a-z][a-z0-9_]*$/.test(f.metric)
    && typeof f.operator === "string" && Object.prototype.hasOwnProperty.call(V0_OPS, f.operator)
    && typeof f.value === "number" && Number.isFinite(f.value)
    && (f.operator !== "between" || f.value2 === undefined || (typeof f.value2 === "number" && Number.isFinite(f.value2)));
}

function num(v: number): string {
  return String(v);
}

/** v0 FilterCondition[] → FSQL text, one condition per line. */
export function v0FiltersToQuery(filters: readonly V0Filter[]): string {
  return filters
    .map((f) => {
      const id = V0_METRIC_RENAMES[f.metric] ?? f.metric;
      if (f.operator === "between") {
        const lo = Math.min(f.value, f.value2 ?? f.value);
        const hi = Math.max(f.value, f.value2 ?? f.value);
        return `${id} BETWEEN ${num(lo)} AND ${num(hi)}`;
      }
      return `${id} ${V0_OPS[f.operator]} ${num(f.value)}`;
    })
    .join("\n");
}

function uniqueName(wanted: string, taken: Set<string>): { name: string; renamed: boolean } {
  const base = wanted.trim().slice(0, MAX_NAME_LENGTH) || "Saved screen";
  let name = base;
  for (let k = 2; taken.has(name.toLowerCase()); k++) name = `${base} (${k})`;
  taken.add(name.toLowerCase());
  return { name, renamed: name !== base };
}

/**
 * v0 came in two shapes: the old Screener page stored `{ name, filters: FilterCondition[] }[]`,
 * and older builds a bare `FilterCondition[]`. Both become v2 screens.
 */
function migrateScreens(raw: unknown): SavedScreensFile | null {
  if (!Array.isArray(raw)) return null;
  const stamp = nowIso();
  const taken = new Set<string>();
  const make = (name: string, filters: readonly V0Filter[]): ScreenDefinition => ({
    v: SAVED_SCREENS_VERSION, id: createId(), name: uniqueName(name, taken).name, description: "", query: v0FiltersToQuery(filters),
    columns: [], sort: null, universe: { kind: "all" }, templateId: null, createdAt: stamp, updatedAt: stamp,
    catalogueVersion: CATALOGUE_VERSION,
  });
  const screens: ScreenDefinition[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null || !Array.isArray((item as { filters?: unknown }).filters)) continue;
    const named = item as { name?: unknown; filters: unknown[] };
    const filters = named.filters.filter(isV0Filter);
    if (filters.length > 0) screens.push(make(typeof named.name === "string" ? named.name : "", filters));
  }
  const bare = raw.filter(isV0Filter);
  if (bare.length > 0) screens.push(make("Saved screen", bare));
  return { v: SAVED_SCREENS_VERSION, screens };
}

// ── validation ──────────────────────────────────────────────────────────────
function isUniverse(x: unknown): x is UniverseSpec {
  if (typeof x !== "object" || x === null) return false;
  const u = x as { kind?: unknown; sector?: unknown; industry?: unknown; symbols?: unknown };
  switch (u.kind) {
    case "all": case "watchlist": case "portfolio": return true;
    case "sector": return typeof u.sector === "string";
    case "industry": return typeof u.industry === "string";
    case "symbols": return Array.isArray(u.symbols) && u.symbols.every((s) => typeof s === "string");
    default: return false;
  }
}

function isColumnSpec(x: unknown): x is ColumnSpec {
  if (typeof x !== "object" || x === null) return false;
  const c = x as { kind?: unknown; id?: unknown; expr?: unknown; label?: unknown };
  return (c.kind === "metric" && typeof c.id === "string")
    || (c.kind === "expr" && typeof c.expr === "string" && typeof c.label === "string");
}

function isDisplaySort(x: unknown): x is DisplaySort {
  if (typeof x !== "object" || x === null) return false;
  const s = x as { key?: unknown; dir?: unknown };
  return typeof s.key === "string" && (s.dir === "asc" || s.dir === "desc");
}

/** Normalises an untrusted screen object; null when it has no usable name or query. */
function sanitise(x: unknown, fallbackStamp: string): ScreenDefinition | null {
  if (typeof x !== "object" || x === null) return null;
  const s = x as Partial<Record<keyof ScreenDefinition, unknown>>;
  if (typeof s.name !== "string" || !s.name.trim() || typeof s.query !== "string") return null;
  return {
    v: SAVED_SCREENS_VERSION,
    id: typeof s.id === "string" && s.id ? s.id : createId(),
    name: s.name.trim().slice(0, MAX_NAME_LENGTH),
    description: typeof s.description === "string" ? s.description : "",
    query: s.query,
    columns: Array.isArray(s.columns) ? s.columns.filter(isColumnSpec) : [],
    sort: isDisplaySort(s.sort) ? s.sort : null,
    universe: isUniverse(s.universe) ? s.universe : { kind: "all" },
    templateId: typeof s.templateId === "string" ? s.templateId : null,
    createdAt: typeof s.createdAt === "string" ? s.createdAt : fallbackStamp,
    updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : fallbackStamp,
    catalogueVersion: typeof s.catalogueVersion === "string" ? s.catalogueVersion : CATALOGUE_VERSION,
  };
}

// ── storage ─────────────────────────────────────────────────────────────────
function isCurrentEnvelope(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as { v?: unknown; data?: unknown };
    return typeof parsed === "object" && parsed !== null && parsed.v === SAVED_SCREENS_VERSION && "data" in parsed;
  } catch {
    return false;
  }
}

function writeFile(file: SavedScreensFile): boolean {
  const raw = readRaw(STORAGE_KEYS.screens);
  if (raw !== null && !isCurrentEnvelope(raw) && readRaw(V0_BACKUP_KEY) === null) writeRaw(V0_BACKUP_KEY, raw);
  return writeEnvelope(STORAGE_KEYS.screens, SAVED_SCREENS_VERSION, file);
}

function readFile(): SavedScreensFile {
  const raw = readRaw(STORAGE_KEYS.screens);
  const file = readEnvelope<SavedScreensFile>(STORAGE_KEYS.screens, SAVED_SCREENS_VERSION, migrateScreens);
  if (!file || !Array.isArray(file.screens)) return { v: SAVED_SCREENS_VERSION, screens: [] };
  const stamp = "";
  const screens = file.screens.map((s) => sanitise(s, stamp)).filter((s): s is ScreenDefinition => s !== null);
  const result: SavedScreensFile = { v: SAVED_SCREENS_VERSION, screens };
  // Persist a migrated v0 value at once (after backing it up), so screen ids stay stable.
  if (raw !== null && !isCurrentEnvelope(raw)) writeFile(result);
  return result;
}

export function loadSavedScreens(): ScreenDefinition[] {
  return readFile().screens;
}

/** null when the name can be used; otherwise the reason, in formal Indian English. */
export function validateScreenName(name: string, exceptId: string | null = null, screens = loadSavedScreens()): string | null {
  const n = name.trim();
  if (!n) return "Enter a name for the screen.";
  if (n.length > MAX_NAME_LENGTH) return `Keep the name to ${MAX_NAME_LENGTH} characters or fewer.`;
  const clash = screens.find((s) => s.id !== exceptId && s.name.trim().toLowerCase() === n.toLowerCase());
  return clash ? `A saved screen called "${clash.name}" already exists. Choose another name.` : null;
}

/** Creates or updates a screen. Throws ScreenNameError when the name is empty or already used. */
export function saveScreen(
  def: Omit<ScreenDefinition, "v" | "id" | "createdAt" | "updatedAt" | "catalogueVersion"> & { id?: string },
): ScreenDefinition {
  const file = readFile();
  const existing = def.id ? file.screens.find((s) => s.id === def.id) : undefined;
  const problem = validateScreenName(def.name, existing?.id ?? null, file.screens);
  if (problem) throw new ScreenNameError(problem);
  const stamp = nowIso();
  const saved: ScreenDefinition = {
    v: SAVED_SCREENS_VERSION,
    id: existing?.id ?? createId(),
    name: def.name.trim(),
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

export function deleteScreen(id: string): void {
  const file = readFile();
  if (!file.screens.some((s) => s.id === id)) return;
  writeFile({ ...file, screens: file.screens.filter((s) => s.id !== id) });
}

/** Renames a screen. Throws ScreenNameError when the name is empty or already used. */
export function renameScreen(id: string, name: string): ScreenDefinition | null {
  const file = readFile();
  const s = file.screens.find((x) => x.id === id);
  if (!s) return null;
  return saveScreen({ ...s, name });
}

/** Copies a screen under a free name such as "Quality (copy)". */
export function duplicateScreen(id: string): ScreenDefinition | null {
  const file = readFile();
  const s = file.screens.find((x) => x.id === id);
  if (!s) return null;
  const taken = new Set(file.screens.map((x) => x.name.trim().toLowerCase()));
  const { name } = uniqueName(`${s.name} (copy)`, taken);
  const { id: _omit, ...rest } = s;
  return saveScreen({ ...rest, name });
}

// ── library backup ──────────────────────────────────────────────────────────
export function exportScreenLibrary(): ScreenLibraryExport {
  return { kind: "funda-scanner-screens", v: SAVED_SCREENS_VERSION, exportedAt: nowIso(), screens: loadSavedScreens() };
}

/** Adds the screens in a library file; clashing names get " (2)", " (3)", …; ids are always new. */
export function importScreenLibrary(json: string): { added: number; renamed: number; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { added: 0, renamed: 0, errors: ["The file is not valid JSON."] };
  }
  const lib = parsed as Partial<ScreenLibraryExport> | null;
  if (typeof parsed !== "object" || parsed === null || !lib || lib.kind !== "funda-scanner-screens" || !Array.isArray(lib.screens)) {
    return { added: 0, renamed: 0, errors: ["The file is not a Funda Scanner screen library."] };
  }
  const errors: string[] = [];
  if (typeof lib.v === "number" && lib.v > SAVED_SCREENS_VERSION) {
    errors.push("The file was made by a newer version of Funda Scanner; some details may be left out.");
  }
  const file = readFile();
  const taken = new Set(file.screens.map((s) => s.name.trim().toLowerCase()));
  const stamp = nowIso();
  let added = 0;
  let renamed = 0;
  lib.screens.forEach((raw, k) => {
    const s = sanitise(raw, stamp);
    if (!s) {
      errors.push(`Screen ${k + 1} has no name or query and was skipped.`);
      return;
    }
    const u = uniqueName(s.name, taken);
    if (u.renamed) renamed++;
    file.screens.push({ ...s, id: createId(), name: u.name, updatedAt: stamp });
    added++;
  });
  if (added > 0 && !writeFile(file)) errors.push("The screens could not be saved in this browser.");
  return { added, renamed, errors };
}
