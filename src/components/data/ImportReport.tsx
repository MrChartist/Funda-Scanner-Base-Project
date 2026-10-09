// src/components/data/ImportReport.tsx — preview of what an import will load, and what looks wrong (WS1).
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ImportOutcome, ValidationIssue } from "@/lib/contracts";
import { FILE_KIND_LABEL } from "@/lib/data";
import { formatNumberIN } from "@/lib/format/indian";
import { cn } from "@/lib/utils";

export interface ImportReportProps {
  outcome: ImportOutcome;
  /** Issues shown per level before "and N more". */
  limit?: number;
  className?: string;
}

const LEVEL_META: Record<ValidationIssue["level"], { title: string; icon: typeof AlertCircle; className: string }> = {
  error: { title: "Errors (the import is blocked until these are fixed)", icon: AlertCircle, className: "text-destructive" },
  warning: { title: "Warnings (the data loads, but please check)", icon: AlertTriangle, className: "text-chart-amber" },
  info: { title: "Notes", icon: Info, className: "text-muted-foreground" },
};

function where(i: ValidationIssue): string {
  const parts: string[] = [];
  if (i.file) parts.push(i.file);
  if (i.row !== null) parts.push(`row ${i.row}`);
  return parts.join(" · ");
}

function plural(n: number, one: string, many: string): string {
  return `${formatNumberIN(n, 0)} ${n === 1 ? one : many}`;
}

export function ImportReport({ outcome, limit = 8, className }: ImportReportProps) {
  const { report, files } = outcome;
  const byLevel = (level: ValidationIssue["level"]) => report.issues.filter((i) => i.level === level);
  const levels = (["error", "warning", "info"] as const).filter((l) => byLevel(l).length > 0);
  const lowCoverage = Object.entries(report.coverage)
    .filter(([field, share]) => share > 0 && share < 0.5 && !field.includes("."))
    .map(([field]) => field);

  return (
    <section aria-label="Import report" className={cn("space-y-3 rounded-md border border-border p-3 text-sm", className)}>
      <div className="flex items-start gap-2" role="status">
        {report.ok
          ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-chart-green" aria-hidden="true" />
          : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />}
        <div>
          <p className="font-medium text-foreground">
            {report.ok ? "Ready to import: " : "Cannot import yet: "}
            {plural(report.companies, "company", "companies")}
            {report.annualRows > 0 && `, ${plural(report.annualRows, "annual row", "annual rows")}`}
            {report.quarterRows > 0 && `, ${plural(report.quarterRows, "quarter", "quarters")}`}
            {report.shareholdingRows > 0 && `, ${plural(report.shareholdingRows, "shareholding quarter", "shareholding quarters")}`}
          </p>
          {report.companiesRejected > 0 && (
            <p className="text-xs text-muted-foreground">
              {plural(report.companiesRejected, "symbol was", "symbols were")} skipped because no company list or dataset file names them.
            </p>
          )}
        </div>
      </div>

      <ul className="space-y-1 text-xs" aria-label="Files">
        {files.map((f, k) => (
          <li key={`${f.name}-${k}`} className="flex flex-wrap justify-between gap-2">
            <span className="break-all font-mono text-foreground">{f.name}</span>
            <span className={f.kind === "unknown" ? "text-destructive" : "text-muted-foreground"}>
              {FILE_KIND_LABEL[f.kind]}{f.kind !== "unknown" && ` · ${plural(f.rows, "row", "rows")}`}
            </span>
          </li>
        ))}
      </ul>

      {levels.map((level) => {
        const list = byLevel(level);
        const meta = LEVEL_META[level];
        const Icon = meta.icon;
        return (
          <div key={level} className="space-y-1">
            <p className={cn("flex items-center gap-1 text-xs font-semibold", meta.className)}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {meta.title}: {list.length}
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto pl-5 text-xs text-muted-foreground">
              {list.slice(0, limit).map((i, n) => (
                <li key={n} className="list-disc">
                  {where(i) && <span className="font-mono text-foreground">{where(i)}: </span>}
                  {i.message} <span className="font-mono opacity-70">({i.code.split("_")[0]})</span>
                </li>
              ))}
              {list.length > limit && <li>{`…and ${list.length - limit} more.`}</li>}
            </ul>
          </div>
        );
      })}

      {report.ok && lowCoverage.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Present in fewer than half of the company-years: {lowCoverage.join(", ")}. Metrics that need them will show "Not provided".
        </p>
      )}
    </section>
  );
}
