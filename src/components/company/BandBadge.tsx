import { AlertTriangle, Check, Minus } from "lucide-react";
import type { ScoreExplanation } from "@/lib/contracts";
import { cn } from "@/lib/utils";

/** Band label with an icon and text, never colour alone. */
export function BandBadge({ band }: { band: NonNullable<ScoreExplanation["band"]> }) {
  const Icon = band.tone === "good" ? Check : band.tone === "weak" ? AlertTriangle : Minus;
  const tone =
    band.tone === "good"
      ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-400"
      : band.tone === "weak"
        ? "border-amber-600/40 text-amber-700 dark:text-amber-400"
        : "border-border text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", tone)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {band.label}
    </span>
  );
}
