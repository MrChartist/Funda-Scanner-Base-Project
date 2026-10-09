import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { DisplaySort, MetricStore, ResolvedColumn, ScreenRun, Tri } from "@/lib/contracts";
import { formatUnitValue, nullReasonText } from "@/lib/format/metric-value";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyName } from "@/components/common/CompanyName";
import { MetricInfo } from "@/components/common/MetricInfo";
import { ValueCell } from "@/components/common/ValueCell";
import { cn } from "@/lib/utils";
import { MAX_COMPARE, ariaSortOf, clauseResults, companyPath, nextSort, passCount } from "./helpers";
import { BAR_LEGEND, buildScales, percentileIn, type Scale } from "./scale";

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

/** A missing value as a muted chip with the reason in words ("Not provided"). */
export function NullChip({ reason, family }: { reason: Parameters<typeof nullReasonText>[0]; family: Parameters<typeof nullReasonText>[1] }) {
  const text = nullReasonText(reason, family);
  return (
    <span
      className="inline-flex max-w-[9rem] items-center truncate rounded-full border border-dashed border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground"
      title={`${text.short}. ${text.long}`}
      data-null-reason={reason}
    >
      <span className="truncate">{text.short}</span>
    </span>
  );
}

/** One cell for a result column: ValueCell for catalogue metrics, the shared formatter for formula columns. */
export function ColumnValue({ column, store, index }: { column: ResolvedColumn; store: MetricStore; index: number }) {
  const def = column.metricId ? store.def(column.metricId) : undefined;
  if (def && column.metricId) {
    const value = store.get(column.metricId, index);
    // "Not applicable" already has its own chip inside ValueCell; other reasons get the muted chip here.
    if (value.v === null && value.reason !== "not_applicable_financial") {
      return <NullChip reason={value.reason ?? "missing_input"} family={store.family(index)} />;
    }
    return <ValueCell def={def} value={value} family={store.family(index)} />;
  }
  const v = column.column.values[index];
  if (column.column.reasons[index] !== 0 || !Number.isFinite(v)) return <span className="text-muted-foreground">—</span>;
  return <span className="tabular-nums">{formatUnitValue("count", column.decimals, v)}</span>;
}

/** Growth-type columns (and point changes) read as up or down with an arrow as well as a colour. */
function isSigned(column: ResolvedColumn, store: MetricStore): boolean {
  const def = column.metricId ? store.def(column.metricId) : undefined;
  return !!def && (def.category === "Growth" || def.unit === "pp" || (def.variant !== null && (def.variant.startsWith("cagr_") || def.variant.startsWith("chg_"))));
}

/**
 * A value with its data bar. The bar is decoration drawn behind the number (aria-hidden, no text), so a
 * screen reader reads the value once. The arrow repeats the sign visually; the sign itself is in the text.
 */
export function BarValue({ column, store, index, scale }: { column: ResolvedColumn; store: MetricStore; index: number; scale: Scale | undefined }) {
  const v = column.column.values[index];
  const present = column.column.reasons[index] === 0 && Number.isFinite(v);
  const pct = present ? percentileIn(scale, v) : null;
  const signed = present && isSigned(column, store);
  const negative = present && v < 0;
  const arrow = negative ? "▼" : signed && v > 0 ? "▲" : null;
  return (
    <span className="relative flex h-6 min-w-[5.5rem] items-center justify-end">
      {pct !== null && (
        <span
          aria-hidden="true"
          data-bar={Math.round(pct * 100)}
          className={cn("absolute inset-y-[3px] left-0 rounded-[3px]", negative ? "bg-destructive/20" : "bg-primary/20")}
          style={{ width: `${Math.max(4, Math.round(pct * 100))}%` }}
        />
      )}
      <span className={cn("relative z-[1] inline-flex items-center gap-1 px-1", negative && "text-negative", signed && !negative && "text-positive")}>
        {arrow && <span aria-hidden="true" className="text-[9px] leading-none">{arrow}</span>}
        <ColumnValue column={column} store={store} index={index} />
      </span>
    </span>
  );
}

/** Rule results: an icon and a pass count; each rule result in words for screen readers and in the tooltip. */
export function ChecksCell({ results }: { results: readonly Tri[] }) {
  const pass = passCount(results);
  const all = pass === results.length;
  const Summary = all ? Check : X;
  return (
    <span className="inline-flex items-center gap-2" title={results.map((t, k) => `Rule ${k + 1}: ${t === 1 ? "Passes" : t === 0 ? "Fails" : "Not checked"}`).join("; ")}>
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium", all ? "text-positive" : "text-muted-foreground")}>
        <Summary className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="num">{pass}/{results.length}</span>
        <span className="sr-only">rules passed</span>
      </span>
      <ul className="sr-only">
        {results.map((t, k) => (
          <li key={k}>Rule {k + 1}: {t === 1 ? "Passes" : t === 0 ? "Fails" : "Not checked"}</li>
        ))}
      </ul>
    </span>
  );
}

export interface ResultsTableProps extends ResultRowsProps {
  sort: DisplaySort | null;
  onSort: (s: DisplaySort) => void;
  page: number;
  pageSize: 25 | 50 | 100;
  onPage: (p: number) => void;
  onPageSize: (n: 25 | 50 | 100) => void;
}

const HEAD = "sticky top-0 z-20 whitespace-nowrap bg-muted px-[var(--density-cell-px)] py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const CELL = "bg-[var(--row-bg)] px-[var(--density-cell-px)] py-[var(--density-cell-py)]";

function SortHeader({ label, sortKey, text, sort, onSort, className, info }: {
  label: string; sortKey: string; text: boolean; sort: DisplaySort | null; onSort: (s: DisplaySort) => void; className?: string; info?: ReactNode;
}) {
  const state = ariaSortOf(sort, sortKey);
  const Icon = state === "ascending" ? ArrowUp : state === "descending" ? ArrowDown : ArrowUpDown;
  return (
    <th scope="col" aria-sort={state} className={cn(HEAD, text ? "text-left" : "text-right", state !== "none" && "text-foreground", className)}>
      <span className="inline-flex items-center gap-0.5">
        <button
          type="button"
          className={cn("inline-flex min-h-9 items-center gap-1 rounded px-1 uppercase tracking-wide hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-11")}
          onClick={() => onSort(nextSort(sort, sortKey, text))}
        >
          {label}
          <Icon className={cn("h-3.5 w-3.5", state === "none" ? "opacity-40" : "text-primary")} aria-hidden="true" />
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
      <p className="num text-muted-foreground">Showing {from} to {to} of {total}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="page-size" className="text-sm text-muted-foreground">Rows per page</label>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v) as 25 | 50 | 100)}>
          <SelectTrigger id="page-size" className="min-h-11 w-24 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[25, 50, 100].map((n) => <SelectItem key={n} value={String(n)} className="min-h-11">{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" className="min-h-11" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span className="num">Page {page} of {pages}</span>
        <Button type="button" variant="outline" className="min-h-11" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </nav>
  );
}

/** The bar scale, in words, with a sample bar. Shown above the table and in the card list. */
export function BarLegend({ count }: { count: number }) {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground" data-testid="bar-legend" title={BAR_LEGEND}>
      <span aria-hidden="true" className="mt-0.5 inline-block h-2.5 w-8 shrink-0 rounded-[3px] bg-primary/20" />
      <span>
        Bars: where a value ranks among the {count} companies listed (longer is higher). Position, not quality.
      </span>
    </p>
  );
}

/** Desktop results: sortable headers, a sticky name column and header, data bars, a Checks column and a median footer. */
export function ResultsTable(props: ResultsTableProps) {
  const { run, store, rows, positions, compared, onToggleCompare, onWhy, sort, onSort, page, pageSize, onPage, onPageSize } = props;
  const synthetic = store.meta.isSynthetic;
  const sortLabel = sort ? `sorted by ${sort.key === "name" ? "name" : run.columns.find((c) => c.key === sort.key)?.label ?? sort.key}, ${sort.dir === "asc" ? "ascending" : "descending"}` : "largest market capitalisation first";
  const full = compared.length >= MAX_COMPARE;
  const scales = useMemo(() => buildScales(run), [run]);
  const hasRules = run.compiled.clauses.length > 0;
  const hasBars = scales.size > 0;

  // A soft fade on the right edge tells people the table scrolls sideways.
  const scroller = useRef<HTMLDivElement>(null);
  const [moreRight, setMoreRight] = useState(false);
  const measure = useCallback(() => {
    const el = scroller.current;
    if (el) setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);
  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, rows, run]);

  return (
    <div className="space-y-3">
      {hasBars && <BarLegend count={run.matched.length} />}
      <div className="relative">
      <div ref={scroller} onScroll={measure} className="scrollbar-thin relative max-h-[calc(100vh-7rem)] min-h-[16rem] overflow-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <caption className="sr-only">
            Companies that match your rules, {sortLabel}. The last row shows the median of all {run.matched.length} listed matches.
          </caption>
          <thead>
            <tr>
              <SortHeader label="Company" sortKey="name" text sort={sort} onSort={onSort} className="left-0 z-30 border-r border-border/60" />
              <SortHeader label="Sector" sortKey="sector" text sort={sort} onSort={onSort} />
              {hasRules && <th scope="col" className={cn(HEAD, "text-left")}>Checks</th>}
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
              <th scope="col" className={cn(HEAD, "text-left")}>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const symbol = store.symbols[i];
              const name = store.company(i).name;
              const results = clauseResults(run, positions.get(i));
              const checked = compared.includes(symbol);
              return (
                <tr
                  key={symbol}
                  className="group [--row-bg:hsl(var(--card))] even:[--row-bg:color-mix(in_srgb,hsl(var(--muted))_45%,hsl(var(--card)))] hover:[--row-bg:hsl(var(--accent))] focus-within:[--row-bg:hsl(var(--accent))]"
                >
                  <th scope="row" className={cn(CELL, "sticky left-0 z-10 border-t border-r border-border/60 text-left font-normal")}>
                    <span className="flex min-w-[13rem] max-w-[19rem] items-center gap-2">
                      <Checkbox
                        checked={checked}
                        disabled={!checked && full}
                        onCheckedChange={() => onToggleCompare(symbol)}
                        aria-label={`Add ${name} to compare`}
                        className="relative h-5 w-5 shrink-0 before:absolute before:-inset-3 before:content-['']"
                      />
                      <Link to={companyPath(symbol)} className="group/name flex min-w-0 flex-col rounded leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:py-2">
                        <span className="font-medium text-primary underline-offset-2 group-hover/name:underline"><CompanyName name={name} isSynthetic={synthetic} /></span>
                        <span className="text-[11px] text-muted-foreground">{symbol}</span>
                      </Link>
                    </span>
                  </th>
                  <td className={cn(CELL, "border-t text-xs text-muted-foreground")}>
                    <span className="block max-w-[11rem] truncate" title={store.sector(i)}>{store.sector(i)}</span>
                  </td>
                  {hasRules && (
                    <td className={cn(CELL, "border-t")}>
                      <ChecksCell results={results} />
                    </td>
                  )}
                  {run.columns.map((c) => (
                    <td key={c.key} className={cn(CELL, "num whitespace-nowrap border-t text-right")}>
                      {scales.has(c.key)
                        ? <BarValue column={c} store={store} index={i} scale={scales.get(c.key)} />
                        : <ColumnValue column={c} store={store} index={i} />}
                    </td>
                  ))}
                  <td className={cn(CELL, "border-t")}>
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-primary [@media(pointer:coarse)]:min-h-11" aria-label={`Why ${name} matched`} onClick={() => onWhy(i)}>
                      Why it matched
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="[--row-bg:hsl(var(--muted))]">
              <th scope="row" className={cn(CELL, "sticky bottom-0 left-0 z-20 border-t-2 border-r border-border/60 py-2 text-left font-semibold")}>Median of matches</th>
              <td className={cn(CELL, "sticky bottom-0 z-10 border-t-2 py-2")} />
              {hasRules && <td className={cn(CELL, "sticky bottom-0 z-10 border-t-2 py-2")} />}
              {run.columns.map((c) => {
                const m = run.medians[c.key] ?? null;
                const def = c.metricId ? store.def(c.metricId) : undefined;
                return (
                  <td key={c.key} className={cn(CELL, "num sticky bottom-0 z-10 whitespace-nowrap border-t-2 py-2 pr-[calc(var(--density-cell-px)+0.25rem)] text-right font-semibold")}>
                    {def ? <ValueCell def={def} value={{ v: m, reason: m === null ? "missing_input" : null, flags: 0 }} /> : m === null ? "—" : formatUnitValue("count", c.decimals, m)}
                  </td>
                );
              })}
              <td className={cn(CELL, "sticky bottom-0 z-10 border-t-2 py-2")} />
            </tr>
          </tfoot>
        </table>
      </div>
      {moreRight && (
        <div aria-hidden="true" data-testid="table-fade-right" className="pointer-events-none absolute inset-y-px right-px z-[2] w-10 rounded-r-xl bg-gradient-to-l from-card via-card/70 to-transparent" />
      )}
      </div>
      {full && <p className="text-sm text-muted-foreground">You can compare up to {MAX_COMPARE} companies at a time.</p>}
      <PaginationBar total={run.matched.length} page={page} pageSize={pageSize} onPage={onPage} onPageSize={onPageSize} />
    </div>
  );
}
