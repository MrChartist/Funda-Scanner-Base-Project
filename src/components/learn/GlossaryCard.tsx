import { Link } from "react-router-dom";
import type { GlossaryEntry, MetricDef } from "@/lib/contracts";

const LEVEL_TEXT: Readonly<Record<MetricDef["level"], string>> = {
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export interface GlossaryCardProps {
  entry: GlossaryEntry;
  def: MetricDef | null;
  /** Label for a related metric id, or null when it has no entry on this page. */
  labelOf: (id: string) => string | null;
  /** Start expanded (the page opens the entry named in the URL hash). */
  defaultOpen?: boolean;
}

/** One metric: what it tells, how to read it, a worked example, rules of thumb and pitfalls. */
export function GlossaryCard({ entry, def, labelOf, defaultOpen = false }: GlossaryCardProps) {
  const label = def?.label ?? entry.base;
  return (
    <details id={entry.base} open={defaultOpen || undefined} className="group rounded-lg border border-border/60 bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <h4 className="text-sm font-semibold text-foreground">{label}</h4>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {def && <span>{LEVEL_TEXT[def.level]}</span>}
          {def && <span className="font-mono">{def.short}</span>}
          <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-border/40 px-4 py-3 text-sm leading-relaxed">
        <p className="text-foreground">{entry.whatItTells}</p>
        <p className="text-muted-foreground">{entry.howToRead}</p>
        {def && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Formula:</span> <span className="font-mono">{def.formula}</span>
          </p>
        )}
        {entry.workedExample && (
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Worked example</p>
            <p className="mt-1 text-foreground">{entry.workedExample}</p>
          </div>
        )}
        {entry.rulesOfThumb.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rules of thumb</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground">
              {entry.rulesOfThumb.map((r) => (
                <li key={r.context + r.text}>
                  <span className="font-medium">{r.context}:</span> {r.text}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">These are rules of thumb for study, not standards.</p>
          </div>
        )}
        {entry.pitfalls.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Common pitfalls</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground">
              {entry.pitfalls.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        )}
        {entry.notApplicableNote && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">When it does not apply:</span> {entry.notApplicableNote}
          </p>
        )}
        {entry.related.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Related:{" "}
            {entry.related.map((id, i) => {
              const text = labelOf(id);
              return (
                <span key={id}>
                  {i > 0 && ", "}
                  {text ? <Link to={`/learn#${id}`} className="text-primary hover:underline">{text}</Link> : <span className="font-mono">{id}</span>}
                </span>
              );
            })}
          </p>
        )}
      </div>
    </details>
  );
}
