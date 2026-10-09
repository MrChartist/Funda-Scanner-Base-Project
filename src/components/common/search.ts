// src/components/common/search.ts — search over the loaded dataset, the metric catalogue and the
// guided screens. Used by the header search box and the command palette.
import type { MetricStore, ScreenTemplate, ScreenUrlState } from "@/lib/contracts";
import { SCREEN_URL_VERSION } from "@/lib/contracts";
// Deep imports on purpose: the barrels ("@/lib/learn", "@/lib/screen") also pull in the query and
// metric engine, and this module is part of the app shell (header search, command palette).
import { hasGlossaryEntry } from "@/lib/learn/glossary-ids";
import { TEMPLATES } from "@/lib/screen/templates";
import { encodeScreenUrl } from "@/lib/screen/url";

export interface CompanyHit {
  symbol: string;
  name: string;
  sector: string;
  index: number;
}

export interface MetricHit {
  id: string;
  label: string;
  short: string;
  category: string;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Companies whose symbol, name or sector matches; best matches first. Empty query gives no hits. */
export function searchCompanies(store: MetricStore, query: string, limit = 8): CompanyHit[] {
  const q = norm(query);
  if (!q) return [];
  const scored: { hit: CompanyHit; score: number }[] = [];
  for (let i = 0; i < store.size; i++) {
    const symbol = store.symbols[i];
    const c = store.company(i);
    const sym = symbol.toLowerCase();
    const name = c.name.toLowerCase();
    let score = -1;
    if (sym === q) score = 0;
    else if (sym.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (name.split(" ").some((w) => w.startsWith(q))) score = 3;
    else if (sym.includes(q) || name.includes(q)) score = 4;
    else if (c.sector.toLowerCase().includes(q) || (c.industry ?? "").toLowerCase().includes(q)) score = 5;
    if (score >= 0) scored.push({ hit: { symbol, name: c.name, sector: c.sector, index: i }, score });
  }
  scored.sort((a, b) => a.score - b.score || a.hit.symbol.localeCompare(b.hit.symbol));
  return scored.slice(0, limit).map((s) => s.hit);
}

/** Base metrics (not variants) whose name, short name, id or alias matches. */
export function searchMetrics(store: MetricStore, query: string, limit = 5): MetricHit[] {
  const q = norm(query);
  if (!q) return [];
  const out: { hit: MetricHit; score: number }[] = [];
  for (const d of store.defs()) {
    if (d.variant !== null) continue;
    const label = d.label.toLowerCase();
    const short = d.short.toLowerCase();
    let score = -1;
    if (short === q || d.id === q) score = 0;
    else if (label.startsWith(q) || short.startsWith(q)) score = 1;
    else if (label.includes(q) || d.aliases.some((a) => a.toLowerCase().includes(q))) score = 2;
    if (score >= 0) out.push({ hit: { id: d.id, label: d.label, short: d.short, category: d.category }, score });
  }
  out.sort((a, b) => a.score - b.score || a.hit.label.localeCompare(b.hit.label));
  return out.slice(0, limit).map((s) => s.hit);
}

export function searchTemplates(query: string, limit = 4): ScreenTemplate[] {
  const q = norm(query);
  if (!q) return [];
  return TEMPLATES.filter((t) => t.title.toLowerCase().includes(q) || t.idea.toLowerCase().includes(q) || t.id.includes(q)).slice(0, limit);
}

export interface SearchItem {
  key: string;
  kind: "company" | "metric" | "template";
  /** Main text; for a company this is the name without the "(fictional)" label. */
  label: string;
  /** Symbol for a company, category for a metric, level for a guided screen. */
  detail: string;
  /** Company sector or a short explanation. */
  note: string;
  href: string;
}

/** Companies, metrics and guided screens for one query, in that order. */
export function buildSearchItems(store: MetricStore, query: string, limits = { companies: 6, metrics: 3, templates: 2 }): SearchItem[] {
  const items: SearchItem[] = [];
  for (const c of searchCompanies(store, query, limits.companies)) {
    items.push({ key: `company:${c.symbol}`, kind: "company", label: c.name, detail: c.symbol, note: c.sector, href: `/company/${encodeURIComponent(c.symbol)}` });
  }
  for (const m of searchMetrics(store, query, limits.metrics)) {
    items.push({ key: `metric:${m.id}`, kind: "metric", label: m.label, detail: m.short, note: `Metric · ${m.category}`, href: learnHref(m.id) });
  }
  for (const t of searchTemplates(query, limits.templates)) {
    items.push({ key: `template:${t.id}`, kind: "template", label: t.title, detail: t.level, note: "Guided screen", href: templateHref(t) });
  }
  return items;
}

/** The Learn page location of a metric: the glossary anchor when there is one, else the page. */
export function learnHref(metricId: string): string {
  return hasGlossaryEntry(metricId) ?`/learn#${metricId}` : "/learn";
}

/** The Screener location that opens a guided screen with its own columns and sort. */
export function templateHref(t: ScreenTemplate): string {
  const state: ScreenUrlState = {
    v: SCREEN_URL_VERSION,
    query: t.query,
    columns: t.columns.map((id) => ({ kind: "metric" as const, id })),
    sort: t.sort,
    universe: { kind: "all" },
    templateId: t.id,
    page: 1,
    pageSize: 25,
  };
  return `/screener?${encodeScreenUrl(state).toString()}`;
}
