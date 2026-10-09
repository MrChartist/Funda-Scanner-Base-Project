import type { TypeFamily } from "@/lib/contracts";
import { nullReasonText } from "@/lib/format/metric-value";
import { cn } from "@/lib/utils";

export interface NotApplicableChipProps {
  family: TypeFamily | null;
  className?: string;
}

/** Inline chip for a metric that does not apply to this type of company ("N/A for lenders"). */
export function NotApplicableChip({ family, className }: NotApplicableChipProps) {
  const text = nullReasonText("not_applicable_financial", family);
  return (
    <span
      className={cn("inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground", className)}
      title={text.long}
      data-null-reason="not_applicable_financial"
    >
      {text.short}
    </span>
  );
}
