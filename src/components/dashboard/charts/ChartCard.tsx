import { useEffect, useId, useState, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** True after the first client render: charts show a skeleton until then. */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** Width of an element, tracked with ResizeObserver; `fallback` where it is unavailable (tests, old browsers). */
export function useElementWidth<T extends HTMLElement>(fallback = 640): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setW(next);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w];
}

export interface ChartCardProps {
  title: string;
  /** One line computed from the data. */
  takeaway?: ReactNode;
  controls?: ReactNode;
  footnote?: ReactNode;
  className?: string;
  children: ReactNode;
  /** Height reserved for the skeleton. */
  skeletonHeight?: number;
}

/** The frame every Dashboard chart sits in: title, computed takeaway, controls, chart, notes. */
export function ChartCard({ title, takeaway, controls, footnote, className, children, skeletonHeight = 280 }: ChartCardProps) {
  const titleId = useId();
  const mounted = useMounted();
  return (
    <section aria-labelledby={titleId} className={cn("glass-card flex min-w-0 flex-col gap-3 p-4 sm:p-5", className)}>
      <div className="space-y-1">
        <h2 id={titleId} className="section-title">{title}</h2>
        {takeaway && <p className="text-sm leading-snug text-foreground" data-testid="chart-takeaway">{takeaway}</p>}
      </div>
      {controls}
      {mounted ? children : <Skeleton className="w-full" style={{ height: skeletonHeight }} aria-hidden="true" />}
      {footnote && <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">{footnote}</div>}
    </section>
  );
}

/** Segmented single-choice control (radio group semantics) used for chips and metric pickers. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-accent",
            )}
          >
            {o.label}
            {o.hint && <span className={cn("num text-[11px]", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A native disclosure holding the table that says what the chart says. */
export function TableDisclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-md border border-border/60 bg-muted/20">
      <summary className="flex min-h-11 cursor-pointer select-none items-center px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9">
        {summary}
      </summary>
      <div className="max-h-80 overflow-auto border-t border-border/60">{children}</div>
    </details>
  );
}
