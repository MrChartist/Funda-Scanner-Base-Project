import type { NullReason, TypeFamily } from "@/lib/contracts";
import { DASH, nullReasonText } from "@/lib/format/metric-value";
import { cn } from "@/lib/utils";

export interface NullReasonHintProps {
  reason: NullReason | null;
  family?: TypeFamily | null;
  className?: string;
}

/** A missing value: "—" with the reason as a tooltip and as text for screen readers. */
export function NullReasonHint({ reason, family, className }: NullReasonHintProps) {
  const text = nullReasonText(reason ?? "missing_input", family);
  return (
    <span className={cn("text-muted-foreground", className)} title={`${text.short}. ${text.long}`} data-null-reason={reason ?? "missing_input"}>
      <span aria-hidden="true">{DASH}</span>
      <span className="sr-only">{text.short}</span>
    </span>
  );
}
