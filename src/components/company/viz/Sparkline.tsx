import { cn } from "@/lib/utils";

export interface SparklineProps {
  values: readonly (number | null)[];
  width?: number;
  height?: number;
  className?: string;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * A tiny trend line. Purely decorative (aria-hidden): the figures it summarises are always present as text beside it.
 * Gaps (null) break the line; the latest point is marked with a dot.
 */
export function Sparkline({ values, width = 88, height = 24, className }: SparklineProps) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return null;
  const pad = 3;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  const x = (k: number) => r1(pad + (k / (values.length - 1)) * (width - pad * 2));
  const y = (v: number) => r1(height - pad - ((v - lo) / span) * (height - pad * 2));
  let d = "";
  let pen = false;
  values.forEach((v, k) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(k)} ${y(v)}`;
    pen = true;
  });
  let last = values.length - 1;
  while (values[last] === null) last -= 1;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      data-testid="sparkline"
      className={cn("shrink-0 overflow-visible text-primary", className)}
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last] as number)} r={2.5} fill="currentColor" stroke="hsl(var(--card))" strokeWidth={1.5} />
    </svg>
  );
}
