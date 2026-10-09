import { useMemo } from "react";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import type { DisplaySort, ResolvedColumn } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyName } from "@/components/common/CompanyName";
import { cn } from "@/lib/utils";
import { MAX_COMPARE, clauseResults, companyPath, passCount } from "./helpers";
import { BarLegend, ColumnValue, PaginationBar, type ResultRowsProps } from "./ResultsTable";
import { buildScales, hasBar, percentileIn } from "./scale";

export interface ResultCardsProps extends ResultRowsProps {
  sort: DisplaySort | null;
  onSort: (s: DisplaySort) => void;
  page: number;
  pageSize: 25 | 50 | 100;
  onPage: (p: number) => void;
  onPageSize: (n: 25 | 50 | 100) => void;
}

/** The three columns a card shows: the ones your rules use first, then bar columns, then the rest. */
function keyColumns(columns: readonly ResolvedColumn[]): ResolvedColumn[] {
  const ranked = [
    ...columns.filter((c) => c.fromQuery),
    ...columns.filter((c) => !c.fromQuery && hasBar(c)),
    ...columns,
  ];
  const seen = new Set<string>();
  return ranked.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true))).slice(0, 3);
}

/** Mobile results (below 768 px): one card per company, never a wide table. */
export function ResultCards(props: ResultCardsProps) {
  const { run, store, rows, positions, compared, onToggleCompare, onWhy, sort, onSort, page, pageSize, onPage, onPageSize } = props;
  const synthetic = store.meta.isSynthetic;
  const keys = [{ key: "name", label: "Name" }, ...run.columns.map((c) => ({ key: c.key, label: c.short }))];
  const full = compared.length >= MAX_COMPARE;
  const scales = useMemo(() => buildScales(run), [run]);
  const key3 = useMemo(() => keyColumns(run.columns), [run.columns]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="card-sort" className="shrink-0 text-xs text-muted-foreground">Sort by</Label>
          <Select value={sort?.key} onValueChange={(v) => onSort({ key: v, dir: v === "name" ? "asc" : "desc" })}>
            <SelectTrigger id="card-sort" className="min-h-11 w-44 text-sm"><SelectValue placeholder="Market cap" /></SelectTrigger>
            <SelectContent>
              {keys.map((k) => <SelectItem key={k.key} value={k.key} className="min-h-11">{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {sort && (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onSort({ ...sort, dir: sort.dir === "asc" ? "desc" : "asc" })}>
            {sort.dir === "asc" ? "Ascending" : "Descending"}
          </Button>
        )}
      </div>
      <ul className="space-y-3">
        {rows.map((i) => {
          const symbol = store.symbols[i];
          const name = store.company(i).name;
          const results = clauseResults(run, positions.get(i));
          const checked = compared.includes(symbol);
          return (
            <li key={symbol} className="rounded-xl border bg-card p-4 shadow-sm" aria-label={name}>
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={checked}
                  disabled={!checked && full}
                  onCheckedChange={() => onToggleCompare(symbol)}
                  aria-label={`Add ${name} to compare`}
                  className="relative mt-1.5 h-5 w-5 shrink-0 before:absolute before:-inset-3 before:content-['']"
                />
                <div className="min-w-0 flex-1">
                  <Link to={companyPath(symbol)} className="inline-flex min-h-11 items-center rounded text-base font-semibold leading-snug text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <CompanyName name={name} isSynthetic={synthetic} />
                  </Link>
                  <p className="-mt-1 truncate text-sm text-muted-foreground">{store.sector(i)} · <span className="text-xs">{symbol}</span></p>
                </div>
                {results.length > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-positive/10 px-2 py-1 text-sm font-medium text-positive">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>{passCount(results)}/{results.length}</span>
                    <span className="sr-only"> rules passed</span>
                  </span>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                {key3.map((c) => {
                  const raw = c.column.values[i];
                  const pct = scales.has(c.key) && c.column.reasons[i] === 0 ? percentileIn(scales.get(c.key), raw) : null;
                  return (
                    <div key={c.key} className="min-w-0">
                      <dt className="truncate text-xs text-muted-foreground">{c.short}</dt>
                      <dd className="num font-medium"><ColumnValue column={c} store={store} index={i} /></dd>
                      {scales.has(c.key) && (
                        <div aria-hidden="true" className="mt-1.5 h-1 rounded-full bg-muted">
                          {pct !== null && (
                            <div
                              data-bar={Math.round(pct * 100)}
                              className={cn("h-full rounded-full", raw < 0 ? "bg-destructive/70" : "bg-primary/70")}
                              style={{ width: `${Math.max(6, Math.round(pct * 100))}%` }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </dl>
              <Button type="button" variant="ghost" className="-mb-2 mt-1 min-h-11 gap-0 px-0 text-primary hover:bg-transparent" onClick={() => onWhy(i)} aria-label={`Why it matched: ${name}`}>
                Why it matched ▸
              </Button>
            </li>
          );
        })}
      </ul>
      {scales.size > 0 && <BarLegend count={run.matched.length} />}
      <PaginationBar total={run.matched.length} page={page} pageSize={pageSize} onPage={onPage} onPageSize={onPageSize} />
    </div>
  );
}
