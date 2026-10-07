import type { QueryIssue } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { lineColumn } from "./helpers";

export interface IssueListProps {
  id: string;
  source: string;
  issues: readonly QueryIssue[];
  /** Replaces the text of the issue with a suggested one. */
  onFix: (issue: QueryIssue, replacement: string) => void;
}

const LEVEL_WORD: Readonly<Record<QueryIssue["level"], string>> = { error: "Error", warning: "Warning", info: "Note" };

/** Every issue with line and column, in words (not colour alone), and one-click suggestions. */
export function IssueList({ id, source, issues, onFix }: IssueListProps) {
  if (issues.length === 0) return <div id={id} />;
  return (
    <ul id={id} aria-label="Query issues" className="space-y-2">
      {issues.map((issue, i) => {
        const { line, column } = lineColumn(source, issue.span.start);
        return (
          <li key={`${issue.code}:${issue.span.start}:${i}`} className="rounded-md border bg-card p-2 text-sm" data-level={issue.level}>
            <p>
              <span className="font-semibold">{LEVEL_WORD[issue.level]}</span>
              <span className="text-muted-foreground"> · line {line}, column {column} · </span>
              {issue.message}
            </p>
            {issue.suggestions.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {issue.suggestions.slice(0, 3).map((s) => (
                  <Button key={s.replacement} type="button" variant="outline" size="sm" className="min-h-11" onClick={() => onFix(issue, s.replacement)}>
                    Use {s.label}
                  </Button>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
