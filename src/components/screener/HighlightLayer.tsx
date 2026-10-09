import { useMemo } from "react";
import type { QueryIssue } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { buildSegments, type Kind } from "./highlight";

const KIND_CLASS: Readonly<Record<Kind, string>> = {
  plain: "",
  keyword: "font-semibold text-violet-700 dark:text-violet-300",
  function: "text-sky-700 dark:text-sky-300",
  number: "text-emerald-700 dark:text-emerald-300",
  string: "text-amber-700 dark:text-amber-300",
  comment: "italic text-muted-foreground",
  op: "text-muted-foreground",
  ident: "",
};

export interface HighlightLayerProps {
  source: string;
  issues: readonly QueryIssue[];
  className?: string;
}

/** Coloured copy of the query text drawn behind the textarea. Only React text nodes: no HTML strings. */
export function HighlightLayer({ source, issues, className }: HighlightLayerProps) {
  const segments = useMemo(() => buildSegments(source, issues), [source, issues]);
  return (
    <div aria-hidden="true" data-testid="highlight-layer" className={cn("pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words", className)}>
      {segments.map((s, i) => (
        <span
          key={i}
          data-kind={s.kind}
          data-issue={s.level ?? undefined}
          className={cn(
            KIND_CLASS[s.kind],
            s.level === "error" && "underline decoration-red-600 decoration-wavy underline-offset-4 dark:decoration-red-400",
            s.level === "warning" && "underline decoration-amber-600 decoration-wavy underline-offset-4 dark:decoration-amber-400",
          )}
        >
          {s.text}
        </span>
      ))}
      {source.endsWith("\n") ? "​" : ""}
    </div>
  );
}
