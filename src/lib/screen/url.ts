// src/lib/screen/url.ts — readable, versioned screen URLs:
//   ?v=1&q=<query>&cols=roce_avg_5y,pe&sort=-roce_avg_5y&u=sector:Cement&t=quality&p=2&ps=50
// Legacy `?sector=X` maps to a sector universe. Defaults are left out of the URL.
import type { ColumnSpec, DisplaySort, ScreenUrlState, UniverseSpec } from "@/lib/contracts";
import { SCREEN_URL_VERSION } from "@/lib/contracts";

const PAGE_SIZES = [25, 50, 100] as const;
const ID = /^[a-z][a-z0-9_]*$/;

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
  if (kind === "sector" && rest.trim()) return { kind: "sector", sector: rest };
  if (kind === "industry" && rest.trim()) return { kind: "industry", industry: rest };
  if (kind === "symbols" && rest.trim()) {
    const symbols = rest.split(",").map((s) => s.trim()).filter(Boolean);
    if (symbols.length > 0) return { kind: "symbols", symbols };
  }
  return { kind: "all" };
}

/** Metric ids stay readable; a formula column is `x:<label>:<expr>` with both parts percent-encoded. */
function encodeColumns(cols: readonly ColumnSpec[]): string {
  return cols.map((c) => (c.kind === "metric" ? c.id : `x:${encodeURIComponent(c.label)}:${encodeURIComponent(c.expr)}`)).join(",");
}

function decodeColumns(text: string): ColumnSpec[] {
  const out: ColumnSpec[] = [];
  for (const part of text.split(",")) {
    const item = part.trim();
    if (!item) continue;
    if (item.startsWith("x:")) {
      const [label, expr] = item.slice(2).split(":");
      try {
        if (expr !== undefined) out.push({ kind: "expr", label: decodeURIComponent(label), expr: decodeURIComponent(expr) });
      } catch {
        /* malformed escape: drop the column */
      }
    } else if (ID.test(item)) {
      out.push({ kind: "metric", id: item });
    }
  }
  return out;
}

function decodeSort(text: string | null): DisplaySort | null {
  if (!text) return null;
  const desc = text.startsWith("-");
  const key = desc ? text.slice(1) : text;
  if (!key || !/^(?:[a-z][a-z0-9_]*|expr:\d+)$/.test(key)) return null;
  return { key, dir: desc ? "desc" : "asc" };
}

export function encodeScreenUrl(s: ScreenUrlState): URLSearchParams {
  const p = new URLSearchParams();
  p.set("v", String(SCREEN_URL_VERSION));
  if (s.query) p.set("q", s.query);
  if (s.columns) p.set("cols", encodeColumns(s.columns));
  if (s.sort) p.set("sort", `${s.sort.dir === "desc" ? "-" : ""}${s.sort.key}`);
  if (s.universe.kind !== "all") p.set("u", encodeUniverse(s.universe));
  if (s.templateId) p.set("t", s.templateId);
  if (s.page > 1) p.set("p", String(s.page));
  if (s.pageSize !== 25) p.set("ps", String(s.pageSize));
  return p;
}

export function decodeScreenUrl(p: URLSearchParams): ScreenUrlState {
  const cols = p.get("cols");
  const legacySector = p.get("sector");
  const page = Number(p.get("p") ?? "1");
  const ps = Number(p.get("ps") ?? "25");
  const t = p.get("t");
  return {
    v: SCREEN_URL_VERSION,
    query: p.get("q") ?? "",
    columns: cols === null ? null : decodeColumns(cols),
    sort: decodeSort(p.get("sort")),
    universe: p.has("u") ? decodeUniverse(p.get("u")) : legacySector && legacySector.trim() ? { kind: "sector", sector: legacySector } : { kind: "all" },
    templateId: t && t.trim() ? t : null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(ps) ? (ps as 25 | 50 | 100) : 25,
  };
}
