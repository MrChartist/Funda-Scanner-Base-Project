import { Check, CircleHelp, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SegmentKind = "pass" | "fail" | "unknown";

const STYLE: Record<SegmentKind, string> = {
  pass: "bg-success text-success-foreground",
  fail: "bg-destructive text-destructive-foreground",
  unknown: "border border-dashed border-muted-foreground/60 bg-muted text-muted-foreground",
};

/** One block per item. Each carries an icon as well as a fill, so colour is never the only signal. */
export function SegmentedBar({ segments, className }: { segments: readonly SegmentKind[]; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex w-full gap-0.5", className)}>
      {segments.map((kind, k) => {
        const Icon = kind === "pass" ? Check : kind === "fail" ? X : CircleHelp;
        return (
          <span key={k} className={cn("flex h-5 min-w-0 flex-1 items-center justify-center first:rounded-l-md last:rounded-r-md", STYLE[kind])}>
            <Icon className="h-3 w-3" />
          </span>
        );
      })}
    </span>
  );
}
