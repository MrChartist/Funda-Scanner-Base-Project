import { Link } from "react-router-dom";
import type { MetricStore } from "@/lib/contracts";
import { STORAGE_KEYS } from "@/lib/contracts";
import { CompanyName } from "@/components/common/CompanyName";
import { readRaw } from "@/lib/user/storage";

/** Recently opened symbols, read leniently: a bare list (v0) or { v, data: list } / { v, data: { symbols } }. */
export function readRecentSymbols(): string[] {
  const text = readRaw(STORAGE_KEYS.recent);
  if (text === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  let list: unknown = parsed;
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) && "data" in parsed) list = (parsed as { data: unknown }).data;
  if (typeof list === "object" && list !== null && !Array.isArray(list) && "symbols" in list) list = (list as { symbols: unknown }).symbols;
  if (!Array.isArray(list)) return [];
  return list.filter((s): s is string => typeof s === "string").map((s) => s.toUpperCase());
}

export function RecentlyViewed({ store }: { store: MetricStore }) {
  const found = readRecentSymbols().filter((s) => store.indexOf(s) >= 0).slice(0, 8);
  return (
    <section aria-labelledby="recent-title" className="glass-card flex h-full flex-col gap-3 p-4 sm:p-5">
      <h2 id="recent-title" className="section-title">Recently viewed</h2>
      {found.length === 0 ? (
        <p className="text-sm text-muted-foreground">Companies you open will appear here. The list stays in this browser.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {found.map((s) => (
            <li key={s}>
              <Link
                to={`/company/${encodeURIComponent(s)}`}
                className="flex min-h-11 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm hover:bg-accent sm:min-h-9"
              >
                <span className="font-mono font-semibold">{s}</span>
                <CompanyName name={store.company(store.indexOf(s)).name} isSynthetic={store.meta.isSynthetic} className="text-xs text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
