// src/hooks/use-screen.ts — all state of the Screener page (WS5): query text (draft and debounced),
// universe, columns, header sort, pagination, URL sync, and the last valid ScreenRun.
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  ColumnSpec, CompiledQuery, DatasetState, DisplaySort, MetricStore, ScreenContext, ScreenDefinition, ScreenRun, ScreenTemplate,
  UniverseSpec,
} from "@/lib/contracts";
import { SCREEN_URL_VERSION, STORAGE_KEYS } from "@/lib/contracts";
import { compileQuery, fromChips, toChips } from "@/lib/query";
import { decodeScreenUrl, encodeScreenUrl, runScreen, TEMPLATES } from "@/lib/screen";
import { readRaw } from "@/lib/user/storage";
import { useDataset } from "@/hooks/use-dataset";

export const QUERY_DEBOUNCE_MS = 250;
export const URL_DEBOUNCE_MS = 250;

export interface ScreenSnapshot {
  query: string;
  columns: ColumnSpec[] | null;
  sort: DisplaySort | null;
  universe: UniverseSpec;
  templateId: string | null;
}

export type TemplateMode = "replace" | "add";

function parseJson(text: string | null): unknown {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function symbolsOf(raw: unknown, key: "symbols" | "holdings"): string[] {
  let list: unknown = raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const data = (raw as { data?: unknown }).data;
    list = data && typeof data === "object" ? (data as Record<string, unknown>)[key] : null;
  }
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item === "string") out.push(item);
    else if (item && typeof item === "object" && typeof (item as { symbol?: unknown }).symbol === "string") out.push((item as { symbol: string }).symbol);
  }
  return out;
}

/** Watchlist and portfolio symbols saved in this browser (v2 envelope or the older bare arrays). */
export function readScreenContext(): ScreenContext {
  return {
    watchlist: symbolsOf(parseJson(readRaw(STORAGE_KEYS.followed)), "symbols"),
    portfolio: symbolsOf(parseJson(readRaw(STORAGE_KEYS.portfolio)), "holdings"),
  };
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : 0;
}

function clauseTexts(source: string, store: MetricStore) {
  const compiled = compileQuery(source, store);
  return toChips(compiled);
}

export interface UseScreenResult {
  dataset: DatasetState;
  store: MetricStore | null;
  /** Text in the editor. */
  draft: string;
  /** Compiled draft: issues, English and chips. Null while the data loads. */
  compiled: CompiledQuery | null;
  queryHasError: boolean;
  /** The run on screen: the latest valid one. */
  run: ScreenRun | null;
  /** The run on screen is older than the query text (the text has an error). */
  stale: boolean;
  pending: boolean;
  universe: UniverseSpec;
  columns: ColumnSpec[] | null;
  sort: DisplaySort | null;
  templateId: string | null;
  page: number;
  pageSize: 25 | 50 | 100;
  setQuery: (text: string, options?: { immediate?: boolean; keepTemplate?: boolean }) => void;
  runNow: () => void;
  setUniverse: (u: UniverseSpec) => void;
  setColumns: (c: ColumnSpec[] | null) => void;
  setSort: (s: DisplaySort | null) => void;
  setPage: (p: number) => void;
  setPageSize: (n: 25 | 50 | 100) => void;
  /** Applies a template. Returns a function that restores the previous state. */
  applyTemplate: (t: ScreenTemplate, mode: TemplateMode) => () => void;
  loadScreen: (def: ScreenDefinition) => void;
  snapshot: () => ScreenSnapshot;
  restore: (s: ScreenSnapshot) => void;
  /** The URL query string for the current state (for sharing). */
  shareUrl: () => string;
  /** Watchlist and portfolio symbols in this browser (stable between renders). */
  ctx: ScreenContext;
  /** Removes one top-level rule (0-based) from the query and re-runs at once. No-op while the text has an error. */
  removeRule: (clause: number) => void;
}

export function useScreen(): UseScreenResult {
  const dataset = useDataset();
  const store = dataset.status === "ready" ? dataset.store : null;
  const [searchParams, setSearchParams] = useSearchParams();

  const initial = useMemo(() => {
    const decoded = decodeScreenUrl(searchParams);
    // A link that names a template but carries no rules loads that template, so the highlighted
    // chip and the results always agree.
    if (decoded.templateId && !decoded.query.trim()) {
      const t = TEMPLATES.find((x) => x.id === decoded.templateId);
      if (t) {
        return {
          ...decoded,
          query: t.query,
          columns: decoded.columns ?? t.columns.map((id): ColumnSpec => ({ kind: "metric", id })),
          sort: decoded.sort ?? t.sort,
        };
      }
    }
    return decoded;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState(initial.query);
  const [committed, setCommitted] = useState(initial.query);
  const [universe, setUniverseState] = useState<UniverseSpec>(initial.universe);
  const [columns, setColumnsState] = useState<ColumnSpec[] | null>(initial.columns);
  const [sort, setSortState] = useState<DisplaySort | null>(initial.sort);
  const [templateId, setTemplateId] = useState<string | null>(initial.templateId);
  const [page, setPageState] = useState(initial.page);
  const [pageSize, setPageSizeState] = useState<25 | 50 | 100>(initial.pageSize);

  // ── debounce: the editor is instant, the screen runs 250 ms after the last keystroke ──
  useEffect(() => {
    if (draft === committed) return undefined;
    const id = setTimeout(() => setCommitted(draft), QUERY_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [draft, committed]);
  const deferred = useDeferredValue(committed);

  const compiledDraft = useMemo(() => (store ? compileQuery(draft, store) : null), [store, draft]);
  const compiledRun = useMemo(
    () => (store ? (deferred === draft && compiledDraft ? compiledDraft : compileQuery(deferred, store)) : null),
    [store, deferred, draft, compiledDraft],
  );

  const ctx = useMemo(() => readScreenContext(), [universe.kind, store]); // eslint-disable-line react-hooks/exhaustive-deps

  const candidate = useMemo<ScreenRun | null>(() => {
    if (!store || !compiledRun || !compiledRun.ok) return null;
    const t0 = now();
    const result = runScreen(store, { query: deferred, columns, sort, universe }, ctx, compiledRun);
    return { ...result, durationMs: Math.max(0, now() - t0) };
  }, [store, compiledRun, deferred, columns, sort, universe, ctx]);

  const [last, setLast] = useState<{ store: MetricStore; run: ScreenRun } | null>(null);
  useEffect(() => {
    if (store && candidate) setLast({ store, run: candidate });
  }, [store, candidate]);
  const run = candidate ?? (last && last.store === store ? last.run : null);

  // ── setters ──
  const setQuery = useCallback((text: string, options?: { immediate?: boolean; keepTemplate?: boolean }) => {
    setDraft(text);
    if (options?.immediate) setCommitted(text);
    if (!options?.keepTemplate) setTemplateId(null);
    setPageState(1);
  }, []);
  const runNow = useCallback(() => setCommitted(draft), [draft]);
  const setUniverse = useCallback((u: UniverseSpec) => {
    setUniverseState(u);
    setPageState(1);
  }, []);
  const setColumns = useCallback((c: ColumnSpec[] | null) => setColumnsState(c), []);
  const setSort = useCallback((s: DisplaySort | null) => setSortState(s), []);
  const setPage = useCallback((p: number) => setPageState(Math.max(1, Math.floor(p))), []);
  const setPageSize = useCallback((n: 25 | 50 | 100) => {
    setPageSizeState(n);
    setPageState(1);
  }, []);

  const snapshot = useCallback((): ScreenSnapshot => ({ query: draft, columns, sort, universe, templateId }), [draft, columns, sort, universe, templateId]);
  const restore = useCallback((s: ScreenSnapshot) => {
    setDraft(s.query);
    setCommitted(s.query);
    setColumnsState(s.columns);
    setSortState(s.sort);
    setUniverseState(s.universe);
    setTemplateId(s.templateId);
    setPageState(1);
  }, []);

  const applyTemplate = useCallback((t: ScreenTemplate, mode: TemplateMode) => {
    const before: ScreenSnapshot = { query: draft, columns, sort, universe, templateId };
    let text = t.query;
    if (mode === "add" && store && draft.trim() !== "") {
      const mine = clauseTexts(draft, store);
      const theirs = clauseTexts(t.query, store);
      text = fromChips({ chips: [...mine.chips, ...theirs.chips], tail: mine.tail || theirs.tail });
    }
    setDraft(text);
    setCommitted(text);
    setTemplateId(mode === "replace" || before.query.trim() === "" ? t.id : null);
    if (mode === "replace" || before.query.trim() === "") {
      setColumnsState(t.columns.map((id): ColumnSpec => ({ kind: "metric", id })));
      setSortState(t.sort);
    }
    setPageState(1);
    return () => restore(before);
  }, [draft, columns, sort, universe, templateId, store, restore]);

  const loadScreen = useCallback((def: ScreenDefinition) => {
    setDraft(def.query);
    setCommitted(def.query);
    setColumnsState(def.columns.length > 0 ? def.columns : null);
    setSortState(def.sort);
    setUniverseState(def.universe);
    setTemplateId(def.templateId);
    setPageState(1);
  }, []);

  // ── URL: replace mode, debounced; external navigation re-reads the URL ──
  const buildParams = useCallback(
    () => encodeScreenUrl({ v: SCREEN_URL_VERSION, query: committed, columns, sort, universe, templateId, page, pageSize }),
    [committed, columns, sort, universe, templateId, page, pageSize],
  );
  const lastWritten = useRef(searchParams.toString());
  const paramsText = buildParams().toString();
  useEffect(() => {
    if (paramsText === lastWritten.current) return undefined;
    const id = setTimeout(() => {
      lastWritten.current = paramsText;
      setSearchParams(new URLSearchParams(paramsText), { replace: true });
    }, URL_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [paramsText, setSearchParams]);

  const urlText = searchParams.toString();
  useEffect(() => {
    if (urlText === lastWritten.current) return;
    lastWritten.current = urlText;
    const s = decodeScreenUrl(new URLSearchParams(urlText));
    setDraft(s.query);
    setCommitted(s.query);
    setColumnsState(s.columns);
    setSortState(s.sort);
    setUniverseState(s.universe);
    setTemplateId(s.templateId);
    setPageState(s.page);
    setPageSizeState(s.pageSize);
  }, [urlText]);

  const shareUrl = useCallback(() => {
    const p = encodeScreenUrl({ v: SCREEN_URL_VERSION, query: draft, columns, sort, universe, templateId, page, pageSize });
    const base = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";
    return `${base}?${p.toString()}`;
  }, [draft, columns, sort, universe, templateId, page, pageSize]);

  const removeRule = useCallback((clause: number) => {
    if (!compiledDraft || !compiledDraft.ok) return;
    const model = toChips(compiledDraft);
    setQuery(fromChips({ ...model, chips: model.chips.filter((_, k) => k !== clause) }), { immediate: true });
  }, [compiledDraft, setQuery]);

  const queryHasError = compiledDraft ? !compiledDraft.ok : false;
  return {
    dataset, store, draft, compiled: compiledDraft, queryHasError, run,
    stale: queryHasError && run !== null,
    pending: draft !== committed || committed !== deferred,
    universe, columns, sort, templateId, page, pageSize,
    setQuery, runNow, setUniverse, setColumns, setSort, setPage, setPageSize,
    applyTemplate, loadScreen, snapshot, restore, shareUrl, ctx, removeRule,
  };
}
