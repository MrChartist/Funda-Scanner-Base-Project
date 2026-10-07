import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import type { DisplaySort, MetricStore, ResolvedColumn, ScreenRun } from "@/lib/contracts";
import { formatUnitValue } from "@/lib/format/metric-value";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyName } from "@/components/common/CompanyName";
import { MetricInfo } from "@/components/common/MetricInfo";
import { PassFailIcon } from "@/components/common/PassFailIcon";
import { ValueCell } from "@/components/common/ValueCell";
import { cn } from "@/lib/utils";
import { MAX_COMPARE, ariaSortOf, clauseResults, companyPath, nextSort } from "./helpers";

export interface ResultRowsProps {
  run: ScreenRun;
  store: MetricStore;
  /** Store indices on the current page. */
  rows: readonly number[];
  positions: ReadonlyMap<number, number>;
  compared: readonly string[];
  onToggleCompare: (symbol: string) => void;
  onWhy: (storeIndex: number) => void;
}

/** One cell for a result column: ValueCell for catalogue metrics, the shared formatter for formula columns. */
export function ColumnValue({ column, store, index }: { column: ResolvedColumn; store: MetricStore; index: number }) {
  const def = column.metricId ? store.def(column.metricId) : undefined;
  if (def && column.metricId) return <ValueCell def={def} value={store.get(column.metricId, index)} family={store.family(index)} />;
  const v = column.column.values[index];
  if (column.column.reasons[index] !== 0 || !Number.isFinite(v)) return <span className="text-muted-foreground">—</span>;
  return <span className="tabular-nums">{formatUnitValue("count", column.decimals, v)}</span>;
}

export interface ResultsTableProps extends ResultRowsProps {
  sort: DisplaySort | null;
  onSort: (s: DisplaySort) => void;
  page: number;
  pageSize: 25 | 50 | 100;
  onPage: (p: number) => void;
  onPageSize: (n: 25 | 50 | 100) => void;
}

function SortHeader({ label, sortKey, text, sort, onSort, className, info }: {
  label: string; sortKey: string; text: boolean; sort: DisplaySort | null; onSort: (s: DisplaySort) => void; className?: string; info?: ReactNode;
}) {
  const state = ariaSortOf(sort, sortKey);
  const Icon = state === "ascending" ? ArrowUp : state === "descending" ? ArrowDown : ArrowUpDown;
  return (
    <th scope="col" aria-sort={state} className={cn("whitespace-nowrap px-3 py-1 text-left text-sm font-semibold", className)}>
      <span className="inline-flex items-center gap-1">
        <button type="button" className="inline-flex min-h-11 items-center gap-1" onClick={() => onSort(nextSort(sort, sortKey, text))}>
          {label}
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {info}
      </span>
    </th>
  );
}

export function PaginationBar({ total, page, pageSize, onPage, onPageSize }: {
  total: number; page: number; pageSize: 25 | 50 | 100; onPage: (p: number) => void; onPageSize: (n: 25 | 50 | 100) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p>Showing {from} to {to} of {total}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="page-size" className="text-sm">Rows per page</label>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v) as 25 | 50 | 100)}>
          <SelectTrigger id="page-size" className="min-h-11 w-24 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[25, 50, 100].map((n) => <SelectItem key={n} value={String(n)} className="min-h-11">{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" className="min-h-11" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span>Page {page} of {pages}</span>
        <Button type="button" variant="outline" className="min-h-11" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </nav>
  );
}

/** Desktop results: sortable headers, a sticky name column, a Checks column and a median footer. */
export function ResultsTable(props: ResultsTableProps) {
  const { run, store, rows, positions, compared, onToggleCompare, onWhy, sort, onSort, page, pageSize, onPage, onPageSize } = props;
  const synthetic = store.meta.isSynthetic;
  const sortLabel = sort ? `sorted by ${sort.key === "name" ? "name" : run.columns.find((c) => c.key === sort.key)?.label ?? sort.key}, ${sort.dir === "asc" ? "ascending" : "descending"}` : "largest market capitalisation first";
  const full = compared.length >= MAX_COMPARE;
  return (
    <div className="space-y-3">
      <div className="relative overflow-x-auto rounded-lg border">
        <table className="w-full min-w-max border-collapse text-sm">
          <caption className="caption-top px-3 py-2 text-left text-sm text-muted-foreground">
            Companies that match your rules, {sortLabel}. The last row shows the median of all {run.matched.length} listed matches.
          </caption>
          <thead className="bg-muted/60">
            <tr>
              <SortHeader label="Company" sortKey="name" text sort={sort} onSort={onSort} className="sticky left-0 z-20 bg-muted" />
              <SortHeader label="Sector" sortKey="sector" text sort={sort} onSort={onSort} />
              <th scope="col" className="whitespace-nowrap px-3 py-1 text-left text-sm font-semibold">Checks</th>
              {run.columns.map((c) => {
                const def = c.metricId ? store.def(c.metricId) : undefined;
                return (
                  <SortHeader
                    key={c.key}
                    label={c.short}
                    sortKey={c.key}
                    text={false}
                    sort={sort}
                    onSort={onSort}
                    info={def ? <MetricInfo def={def} /> : undefined}
                  />
                );
              })}
              <th scope="col" className="whitespace-nowrap px-3 py-1 text-left text-sm font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const symbol = store.symbols[i];
              const name = store.company(i).name;
              const results = clauseResults(run, positions.get(i));
              const checked = compared.includes(symbol);
              return (
                <tr key={symbol} className="border-t hover:bg-muted/30">
                  <th scope="row" className="sticky left-0 z-10 bg-background px-3 py-1 text-left font-normal">
                    <span className="flex min-w-[14rem] items-center gap-2">
                      <Checkbox
                        checked={checked}
                        disabled={!checked && full}
                        onCheckedChange={() => onToggleCompare(symbol)}
                        aria-label={`Add ${name} to compare`}
                        className="h-5 w-5 shrink-0 before:absolute before:-inset-3 before:content-[''] relative"
                      />
                      <Link to={companyPath(symbol)} className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-2 hover:underline">
                        <CompanyName name={name} isSynthetic={synthetic} symbol={symbol} showSymbol />
                      </Link>
                    </span>
                  </th>
                  <td className="px-3 py-1">{store.sector(i)}</td>
                  <td className="px-3 py-1">
                    {results.length === 0 ? (
                      <span className="text-muted-foreground">No rules</span>
                    ) : (
                      <span className="flex flex-wrap gap-x-2 gap-y-1">
                        {results.map((t, k) => <PassFailIcon key={k} status={t} label={`${k + 1}: ${t === 1 ? "Passes" : t === 0 ? "Fails" : "Not checked"}`} />)}
                      </span>
                    )}
                  </td>
                  {run.columns.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-3 py-1 text-right"><ColumnValue column={c} store={store} index={i} /></td>
                  ))}
                  <td className="px-3 py-1">
                    <Button type="button" variant="ghost" size="sm" className="min-h-11" aria-label={`Why ${name} matched`} onClick={() => onWhy(i)}>
                      Why it matched
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 bg-muted/40 font-medium">
            <tr>
              <th scope="row" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left">Median of matches</th>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
              {run.columns.map((c) => {
                const m = run.medians[c.key] ?? null;
                const def = c.metricId ? store.def(c.metricId) : undefined;
                return (
                  <td key={c.key} className="whitespace-nowrap px-3 py-2 text-right">
                    {def ? <ValueCell def={def} value={{ v: m, reason: m === null ? "missing_input" : null, flags: 0 }} /> : m === null ? "—" : formatUnitValue("count", c.decimals, m)}
                  </td>
                );
              })}
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
      {full && <p className="text-sm text-muted-foreground">You can compare up to {MAX_COMPARE} companies at a time.</p>}
      <PaginationBar total={run.matched.length} page={page} pageSize={pageSize} onPage={onPage} onPageSize={onPageSize} />
    </div>
  );
}
