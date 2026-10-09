import type { MetricDef, MetricValue, TypeFamily } from "@/lib/contracts";
import { VF } from "@/lib/contracts";
import { formatMetric } from "@/lib/format/metric-value";
import { cn } from "@/lib/utils";
import { NotApplicableChip } from "./NotApplicableChip";
import { NullReasonHint } from "./NullReasonHint";

export interface ValueCellProps {
  def: MetricDef;
  value: MetricValue;
  /** Company family, used to word the not-applicable chip. */
  family?: TypeFamily | null;
  /** Show the period tag ("FY", "TTM", "5Y") after the value. */
  showPeriod?: boolean;
  className?: string;
}

const FLAG_NOTES: ReadonlyArray<readonly [number, string]> = [
  [VF.Provided, "Value supplied in your file, not derived from statements."],
  [VF.FyFallback, "Latest four quarters not available; latest financial year used."],
  [VF.Approximate, "Approximate figure."],
  [VF.SalesBasis, "Calculated on sales because cost of goods sold is not provided."],
  [VF.AssumedZero, "A missing input was treated as 0."],
  [VF.InferredType, "Company type inferred from sector."],
];

/** The only renderer for metric values on Screener, Company and Compare (spec P1). */
export function ValueCell({ def, value, family, showPeriod = false, className }: ValueCellProps) {
  if (value.v === null) {
    if (value.reason === "not_applicable_financial") return <NotApplicableChip family={family ?? null} className={className} />;
    return <NullReasonHint reason={value.reason} family={family} className={className} />;
  }
  const notes = FLAG_NOTES.filter(([flag]) => (value.flags & flag) !== 0).map(([, note]) => note);
  const periodTag = value.flags & VF.FyFallback ? "FY" : def.periodTag;
  return (
    <span className={cn("tabular-nums", className)} title={notes.length ? notes.join(" ") : undefined} data-metric={def.id}>
      {formatMetric(def, value)}
      {notes.length > 0 && (
        <span aria-hidden="true" className="ml-0.5 text-xs text-muted-foreground">*</span>
      )}
      {notes.length > 0 && <span className="sr-only"> ({notes.join(" ")})</span>}
      {showPeriod && <span className="ml-1 text-xs text-muted-foreground">{periodTag}</span>}
    </span>
  );
}
