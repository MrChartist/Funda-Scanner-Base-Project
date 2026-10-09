import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import type { MetricValue, TypeFamily } from "@/lib/contracts";
import type { GridRow, PeriodColumn } from "@/lib/views/company-view";
import { MetricInfo } from "@/components/common/MetricInfo";
import { ValueCell } from "@/components/common/ValueCell";
import { cn } from "@/lib/utils";
import { Sparkline } from "./viz/Sparkline";

type Row = GridRow & { medians?: MetricValue[] | null };

export interface PeriodTableProps {
  caption: string;
  periods: readonly PeriodColumn[];
  rows: readonly Row[];
  family: TypeFamily;
  /** Label for the median line shown under rows that carry medians. */
  medianLabel?: string;
  /** "annual" shows the last 5 periods first; "quarterly" the last 8. */
  kind?: "annual" | "quarterly";
  /** Show the "vs previous" arrow column and sparkline column. Off for tables that are changes themselves. */
  trend?: boolean;
  className?: string;
}

/** Rows that get a sparkline: revenue, net profit, operating margin, ROCE, debt to equity, free cash flow. */
const SPARK_IDS: ReadonlySet<string> = new Set([
  "sales", "pat", "net_profit", "opm", "roce", "debt_equity", "fcf", "q_sales", "q_pat", "q_net_profit", "q_opm",
]);

const OPTIONS = {
  annual: [5, 10],
  quarterly: [4, 8],
} as const;
const DEFAULT_COUNT = { annual: 5, quarterly: 8 } as const;

const ALL = 0;

/** Rows of figures across periods, newest on the right and in view. Every cell goes through <ValueCell>. */
export function PeriodTable({ caption, periods, rows, family, medianLabel, kind = "annual", trend = true, className }: PeriodTableProps) {
  const total = periods.length;
  const [count, setCount] = useState<number>(DEFAULT_COUNT[kind]);
  const visible = count === ALL || count >= total ? total : count;
  const start = total - visible;
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const showControl = total > OPTIONS[kind][0];

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  // Newest period is the right-most column: start scrolled to it.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
    measure();
  }, [visible, rows, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const cols = periods.slice(start);
  const options: { label: string; value: number }[] = [
    ...OPTIONS[kind].filter((n) => n < total).map((n) => ({ label: `Last ${n}`, value: n })),
    { label: "All", value: ALL },
  ];
  const active = count === ALL || count >= total ? ALL : count;
  const selected = options.some((o) => o.value === active) ? active : (options[options.length - 2]?.value ?? ALL);

  return (
    <div className={cn("space-y-2", className)}>
      {showControl && (
        <div className="flex flex-wrap items-center justify-between gap-2" data-no-print>
          <div role="group" aria-label={`Periods shown: ${caption}`} className="inline-flex rounded-md border bg-muted/40 p-0.5">
            {options.map((o) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={selected === o.value}
                onClick={() => setCount(o.value)}
                className={cn(
                  "min-h-11 rounded px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8",
                  selected === o.value ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Newest on the right</span>
          <span role="status" className="sr-only">
            Showing the latest {visible} of {total} periods
          </span>
        </div>
      )}
      <div className="relative rounded-md border">
        <div
          ref={scroller}
          onScroll={measure}
          className="relative overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={caption}
          data-testid="period-scroll"
        >
          <table className="w-full min-w-max border-collapse text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b bg-muted/40">
                <th scope="col" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground">Figure</th>
                {cols.map((p, k) => (
                  <th
                    key={p.key}
                    scope="col"
                    aria-current={k === cols.length - 1 ? "true" : undefined}
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right text-xs font-medium text-muted-foreground",
                      k === cols.length - 1 && "bg-primary/10 font-semibold text-foreground",
                    )}
                  >
                    {p.label}
                    {p.note && <span className="block text-xs font-normal">{p.note}</span>}
                  </th>
                ))}
                {trend && <th scope="col" className="hidden whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground md:table-cell">Vs previous</th>}
                {trend && <th scope="col" className="hidden whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground md:table-cell">Trend</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <RowGroup key={row.id} row={row} family={family} medianLabel={medianLabel} start={start} trend={trend} />
              ))}
            </tbody>
          </table>
        </div>
        {edges.left && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card to-transparent" />}
        {edges.right && <div aria-hidden="true" data-testid="fade-right" className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-md bg-gradient-to-l from-card to-transparent" />}
      </div>
    </div>
  );
}

function lastTwo(values: readonly MetricValue[]): [number, number] | null {
  const nums: number[] = [];
  for (let k = values.length - 1; k >= 0 && nums.length < 2; k--) {
    const v = values[k].v;
    if (v === null) return null; // latest or previous period missing: no direction to show
    nums.push(v);
  }
  return nums.length === 2 ? [nums[0], nums[1]] : null;
}

function Direction({ values }: { values: readonly MetricValue[] }) {
  const pair = lastTwo(values);
  if (!pair) return <span className="text-xs text-muted-foreground">Not enough data</span>;
  const [now, before] = pair;
  const Icon = now > before ? ArrowUp : now < before ? ArrowDown : ArrowRight;
  const text = now > before ? "Higher" : now < before ? "Lower" : "Unchanged";
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {text}
    </span>
  );
}

/** Direction of the latest figure on narrow screens, where the "Vs previous" column is hidden. */
function MobileArrow({ values }: { values: readonly MetricValue[] }) {
  const pair = lastTwo(values);
  if (!pair) return null;
  const Icon = pair[0] > pair[1] ? ArrowUp : pair[0] < pair[1] ? ArrowDown : ArrowRight;
  const text = pair[0] > pair[1] ? "Higher" : pair[0] < pair[1] ? "Lower" : "Unchanged";
  return (
    <span className="mr-1 md:hidden">
      <Icon className="inline h-3 w-3 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{text} than previous period. </span>
    </span>
  );
}

function RowGroup({ row, family, medianLabel, start, trend }: { row: Row; family: TypeFamily; medianLabel?: string; start: number; trend: boolean }) {
  const shown = row.values.slice(start);
  const spark = trend && SPARK_IDS.has(row.id);
  return (
    <>
      <tr className="border-b last:border-0">
        <th scope="row" className={cn("sticky left-0 z-10 bg-card px-3 py-2 text-left text-sm font-normal", row.derived && "italic text-muted-foreground")}>
          <span className="inline-flex items-center gap-1">
            <span className="block w-36 sm:w-60">{row.label}</span>
            <MetricInfo def={row.def} />
          </span>
        </th>
        {shown.map((v, k) => (
          <td key={k} className={cn("whitespace-nowrap px-3 py-2 text-right", k === shown.length - 1 && "bg-primary/5 font-medium")}>
            {trend && k === shown.length - 1 && <MobileArrow values={row.values} />}
            <ValueCell def={row.def} value={v} family={family} />
          </td>
        ))}
        {trend && (
          <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">
            <Direction values={row.values} />
          </td>
        )}
        {trend && (
          <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">
            {spark && (
              <>
                <Sparkline values={row.values.map((v) => v.v)} />
                <span className="sr-only">Trend line across all {row.values.length} periods, oldest to newest. The figures are in the row.</span>
              </>
            )}
          </td>
        )}
      </tr>
      {row.medians && (
        <tr className="border-b bg-muted/20 last:border-0">
          <th scope="row" className="sticky left-0 z-10 bg-muted px-3 py-1.5 text-left text-xs font-normal text-muted-foreground">{medianLabel ?? "Industry median"}</th>
          {row.medians.slice(start).map((v, k, arr) => (
            <td key={k} className={cn("whitespace-nowrap px-3 py-1.5 text-right text-xs text-muted-foreground", k === arr.length - 1 && "bg-primary/5")}>
              <ValueCell def={row.def} value={v} family={family} />
            </td>
          ))}
          {trend && <td className="hidden md:table-cell" />}
          {trend && <td className="hidden md:table-cell" />}
        </tr>
      )}
    </>
  );
}
