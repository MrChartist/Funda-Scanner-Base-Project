import { cn } from "@/lib/utils";

export interface BulletProps {
  value: number;
  min: number;
  max: number;
  median: number;
  p25?: number | null;
  p75?: number | null;
  /** Sentence for assistive technology, built by the caller with the app's formatters. */
  description: string;
  className?: string;
}

const pos = (x: number, min: number, max: number): number => (max > min ? Math.min(100, Math.max(0, ((x - min) / (max - min)) * 100)) : 50);

/**
 * Position bar: where a value sits within a peer group. Track = min to max, band = 25th to 75th percentile,
 * tick = median, dot = this company. The text description carries the same information.
 */
export function Bullet({ value, min, max, median, p25, p75, description, className }: BulletProps) {
  const band = p25 != null && p75 != null;
  return (
    <div role="img" aria-label={description} data-testid="bullet" className={cn("relative h-5 w-full", className)}>
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted-foreground/25" />
      {band && (
        <div
          className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-primary/30"
          style={{ left: `${pos(p25, min, max)}%`, width: `${Math.max(2, pos(p75, min, max) - pos(p25, min, max))}%` }}
        />
      )}
      <div className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-foreground/70" style={{ left: `${pos(median, min, max)}%` }} />
      <div
        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-sm"
        style={{ left: `${pos(value, min, max)}%` }}
      />
    </div>
  );
}
