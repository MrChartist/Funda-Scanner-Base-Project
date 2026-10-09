import { Info } from "lucide-react";
import type { GlossaryEntry, MetricDef } from "@/lib/contracts";
import { GLOSSARY } from "@/lib/learn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MetricInfoProps {
  def: MetricDef;
  /** Defaults to the glossary entry of the base metric, when there is one. */
  glossary?: GlossaryEntry | null;
  className?: string;
}

const UNIT_TEXT: Readonly<Record<MetricDef["unit"], string>> = {
  inr_cr: "₹ crore", inr: "₹", pct: "percent", pp: "percentage points", x: "times (x)", days: "days", years: "years",
  count: "count", score: "score", crore_shares: "crore shares", fy_year: "financial year",
};

/** The ⓘ formula card: what the metric means, how it is calculated and when it is missing. */
export function MetricInfo({ def, glossary, className }: MetricInfoProps) {
  const entry = glossary === undefined ? GLOSSARY[def.base] ?? null : glossary;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`About ${def.label}`}
          className={cn(
            "relative inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring before:absolute before:-inset-3 before:content-['']",
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm" aria-label={`${def.label}: how it is calculated`}>
        <p className="font-semibold">{def.label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{def.periodTag} · {UNIT_TEXT[def.unit]}</p>
        <p className="mt-2">{entry?.whatItTells ?? def.tooltip}</p>
        {entry?.howToRead && <p className="mt-2">{entry.howToRead}</p>}
        <dl className="mt-3 space-y-2 text-xs">
          <div>
            <dt className="font-medium">Formula</dt>
            <dd className="font-mono text-muted-foreground">{def.formula}</dd>
          </div>
          <div>
            <dt className="font-medium">When it is missing</dt>
            <dd className="text-muted-foreground">{def.nullRules}</dd>
          </div>
          {entry?.notApplicableNote && (
            <div>
              <dt className="font-medium">Not applicable</dt>
              <dd className="text-muted-foreground">{entry.notApplicableNote}</dd>
            </div>
          )}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Id in queries: <code>{def.id}</code></p>
      </PopoverContent>
    </Popover>
  );
}
