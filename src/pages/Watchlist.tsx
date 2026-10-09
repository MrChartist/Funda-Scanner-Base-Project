import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Bookmark, Eye, X } from "lucide-react";
import type { MetricId, MetricStore } from "@/lib/contracts";
import { CompanyName } from "@/components/common/CompanyName";
import { DatasetGate } from "@/components/common/DatasetGate";
import { EmptyState } from "@/components/common/EmptyState";
import { MetricInfo } from "@/components/common/MetricInfo";
import { ValueCell } from "@/components/common/ValueCell";
import { PageHeader, PageShell } from "@/components/layout";
import { useWatchlist } from "@/hooks/use-watchlist";

/** Columns read from the store; ids that the loaded catalogue does not have are left out. */
export const WATCHLIST_COLUMNS: readonly MetricId[] = ["price", "market_cap", "pe", "roce", "debt_equity", "sales_cagr_5y"];

type SortKey = "symbol" | MetricId;

interface Row {
  symbol: string;
  index: number;
}

function WatchlistTable({ store, symbols }: { store: MetricStore; symbols: readonly string[] }) {
  const { unfollow } = useWatchlist();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const columns = useMemo(() => WATCHLIST_COLUMNS.map((id) => store.def(id)).filter((d): d is NonNullable<typeof d> => !!d), [store]);

  const { present, missing } = useMemo(() => {
    const present: Row[] = [];
    const missing: string[] = [];
    for (const symbol of symbols) {
      const index = store.indexOf(symbol);
      if (index >= 0) present.push({ symbol: store.symbols[index], index });
      else missing.push(symbol);
    }
    return { present, missing };
  }, [store, symbols]);

  const sorted = useMemo(() => {
    if (!sortKey) return present;
    const out = [...present];
    if (sortKey === "symbol") {
      out.sort((a, b) => (dir === "asc" ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)));
      return out;
    }
    const col = store.column(sortKey);
    out.sort((a, b) => {
      const av = col.values[a.index];
      const bv = col.values[b.index];
      const an = Number.isNaN(av);
      const bn = Number.isNaN(bv);
      if (an || bn) return an === bn ? 0 : an ? 1 : -1; // missing values always last
      return dir === "asc" ? av - bv : bv - av;
    });
    return out;
  }, [present, sortKey, dir, store]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir(key === "symbol" ? "asc" : "desc");
    }
  };

  const ariaSort = (key: SortKey): "ascending" | "descending" | "none" => (sortKey === key ? (dir === "asc" ? "ascending" : "descending") : "none");
  const Arrow = dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="space-y-6">
      {present.length > 0 && (
        <section aria-labelledby="in-data-title" className="space-y-2">
          <h2 id="in-data-title" className="section-title">In your current data ({present.length})</h2>
          <div className="glass-card overflow-hidden">
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Followed companies with figures from the loaded data. Select a column heading to sort.</caption>
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th scope="col" className="data-header" aria-sort={ariaSort("symbol")}>
                      <button type="button" onClick={() => toggleSort("symbol")} className="flex min-h-11 items-center gap-1 sm:min-h-0">
                        Company {sortKey === "symbol" && <Arrow className="h-3 w-3 text-primary" aria-hidden="true" />}
                      </button>
                    </th>
                    {columns.map((d) => (
                      <th key={d.id} scope="col" className="data-header" aria-sort={ariaSort(d.id)}>
                        <span className="flex items-center gap-1">
                          <button type="button" onClick={() => toggleSort(d.id)} className="flex min-h-11 items-center gap-1 sm:min-h-0">
                            {d.short} <span className="font-normal normal-case text-muted-foreground">{d.periodTag}</span>
                            {sortKey === d.id && <Arrow className="h-3 w-3 text-primary" aria-hidden="true" />}
                          </button>
                          <MetricInfo def={d} />
                        </span>
                      </th>
                    ))}
                    <th scope="col" className="data-header"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, idx) => (
                    <motion.tr
                      key={r.symbol}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(idx, 10) * 0.03 }}
                      className="border-b border-border/20 last:border-0 hover:bg-accent/30"
                    >
                      <th scope="row" className="data-cell text-left font-sans">
                        <Link to={`/company/${encodeURIComponent(r.symbol)}`} className="group block min-h-11 sm:min-h-0">
                          <span className="font-mono font-bold text-foreground group-hover:text-primary">{r.symbol}</span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            <CompanyName name={store.company(r.index).name} isSynthetic={store.meta.isSynthetic} />
                          </span>
                        </Link>
                      </th>
                      {columns.map((d) => (
                        <td key={d.id} className="data-cell text-foreground">
                          <ValueCell def={d} value={store.get(d.id, r.index)} family={store.family(r.index)} />
                        </td>
                      ))}
                      <td className="data-cell">
                        <button
                          type="button"
                          onClick={() => unfollow(r.symbol)}
                          aria-label={`Remove ${r.symbol} from the watchlist`}
                          className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-destructive sm:h-8 sm:w-8"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {missing.length > 0 && (
        <section aria-labelledby="not-in-data-title" className="space-y-2">
          <h2 id="not-in-data-title" className="section-title">Not in your current data ({missing.length})</h2>
          <p className="text-xs text-muted-foreground">
            These symbols are on your list, but the data you have loaded does not include them. They are kept, and will show figures
            again if you load data that has them.
          </p>
          <ul className="glass-card divide-y divide-border/30">
            {missing.map((s) => (
              <li key={s} className="flex items-center justify-between gap-3 px-3 py-1">
                <span className="font-mono text-sm font-semibold text-foreground">{s}</span>
                <button
                  type="button"
                  onClick={() => unfollow(s)}
                  aria-label={`Remove ${s} from the watchlist`}
                  className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-destructive sm:h-9 sm:w-9"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Watchlist() {
  const { symbols } = useWatchlist();

  return (
      <PageShell>
        <PageHeader
          title="Watchlist"
          icon={Eye}
          description={symbols.length === 0 ? "Companies you follow appear here." : `${symbols.length} ${symbols.length === 1 ? "company" : "companies"} followed. The list stays in this browser.`}
        />
        {symbols.length === 0 ? (
          <EmptyState
            icon={<Bookmark className="h-6 w-6" />}
            title="Your watchlist is empty"
            description="Follow a company from its page to see its figures here, side by side, from the data you have loaded."
            action={<Link to="/screener" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">Find companies in the Screener</Link>}
          />
        ) : (
          <DatasetGate>{({ store }) => <WatchlistTable store={store} symbols={symbols} />}</DatasetGate>
        )}
      </PageShell>
  );
}
