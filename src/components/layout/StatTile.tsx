import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  /** Small line under the value (period, unit, note). */
  hint?: ReactNode;
  tone?: "default" | "positive" | "negative" | "warning";
  className?: string;
}

const TONE: Record<NonNullable<StatTileProps["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning",
};

/** A key number with a label: tabular figures, quiet label, optional tone and hint. */
export function StatTile({ label, value, hint, tone = "default", className }: StatTileProps) {
  return (
    <div className={cn("glass-card flex min-w-0 flex-col gap-1 p-4", className)}>
      <p className="type-label">{label}</p>
      <p className={cn("num text-2xl font-semibold leading-tight tracking-tight", TONE[tone])}>{value}</p>
      {hint && <p className="type-caption">{hint}</p>}
    </div>
  );
}
