import { Info, X } from "lucide-react";
import type { CompiledQuery } from "@/lib/contracts";
import { cn } from "@/lib/utils";

export interface ActiveRulesProps {
  /** The query the chips describe (the last valid one when the text has an error). */
  compiled: CompiledQuery | null;
  /** Companies in the universe, for the empty line. */
  total: number;
  /** Chips can be removed only while the query text is valid. */
  editable: boolean;
  templateTitle: string | null;
  onRemove: (clause: number) => void;
  onClear: () => void;
  onTemplateDetails: () => void;
  /** Opens the Rules card on the Simple tab. */
  onAddRule: () => void;
}

/** The rules summary line: removable chips for each active rule, or a hint when there are none. */
export function ActiveRules({ compiled, total, editable, templateTitle, onRemove, onClear, onTemplateDetails, onAddRule }: ActiveRulesProps) {
  const clauses = compiled?.clauses ?? [];
  if (clauses.length === 0) {
    return (
      <p className="hidden items-start gap-2 text-sm text-muted-foreground sm:flex" data-testid="rules-summary">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          No rules yet: all {total} companies, largest first. Pick a template, or{" "}
          <button type="button" onClick={onAddRule} className="relative rounded text-primary underline underline-offset-2 before:absolute before:-inset-2 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">add a rule</button>.
        </span>
      </p>
    );
  }
  return (
    <div className="space-y-1.5" data-testid="rules-summary">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="type-label">Active rules ({clauses.length})</span>
        {templateTitle && (
          <span>
            from {templateTitle}
            <button type="button" onClick={onTemplateDetails} className="relative ml-1.5 rounded text-primary underline-offset-2 before:absolute before:-inset-2 before:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Details
            </button>
          </span>
        )}
        {editable && (
          <button type="button" onClick={onClear} className="relative ml-auto rounded text-primary underline-offset-2 before:absolute before:-inset-2 before:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Clear all rules
          </button>
        )}
      </div>
      <ul aria-label="Active rules" className="scrollbar-thin -mx-4 flex scroll-px-4 snap-x gap-1.5 overflow-x-auto px-4 pb-1.5 sm:mx-0 sm:px-0">
        {clauses.map((c, i) => (
          <li
            key={`${c.index}:${c.text}`}
            className={cn(
              "inline-flex min-h-8 max-w-[22rem] shrink-0 snap-start items-center rounded-full border border-primary/25 bg-primary/10 pl-3 text-xs font-medium text-foreground",
              !editable && "opacity-70",
            )}
          >
            <span className="truncate" title={c.english}>{c.english}</span>
            <button
              type="button"
              disabled={!editable}
              aria-label={`Remove rule: ${c.english}`}
              onClick={() => onRemove(i)}
              className="relative ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground before:absolute before:-inset-1.5 before:content-[''] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
