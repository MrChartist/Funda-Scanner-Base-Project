// src/components/data/DataHealthPanel.tsx — what one company's figures rest on (WS1).
// Used by the company page (WS6). Lists coverage, zero-default assumptions, missing required
// inputs, provided-versus-derived differences and validation notes. Facts only; no judgement.
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { DataHealth, MetricStore, ValidationIssue } from "@/lib/contracts";
import { ANNUAL_FIELD_INFO, type AnnualField } from "@/lib/contracts";
import { ASSUMED_ZERO_TEXT, computeDataHealth, MISMATCH_THRESHOLD_PCT } from "@/lib/data";
import { formatNumberIN } from "@/lib/format/indian";
import { formatUnitValue } from "@/lib/format/metric-value";
import { fyLabel, monthYearLabel, quarterLabel } from "@/lib/time/civil";
import { cn } from "@/lib/utils";

export interface DataHealthPanelProps {
  store: MetricStore;
  index: number;
  /** Precomputed health (otherwise computed here). */
  health?: DataHealth;
  className?: string;
}

const TYPE_LABEL: Record<string, string> = {
  non_financial: "Non-financial company",
  other_financial: "Other financial company (treated as non-financial)",
  bank: "Bank",
  nbfc: "NBFC",
  insurance: "Insurer",
};

function fieldLabel(field: string): string {
  return (ANNUAL_FIELD_INFO as Record<string, { label: string } | undefined>)[field]?.label ?? field;
}

function plural(n: number, one: string, many: string): string {
  return `${formatNumberIN(n, 0)} ${n === 1 ? one : many}`;
}

function IssueLine({ issue }: { issue: ValidationIssue }) {
  const Icon = issue.level === "info" ? Info : AlertTriangle;
  return (
    <li className="flex items-start gap-1.5">
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", issue.level === "info" ? "text-muted-foreground" : "text-chart-amber")} aria-hidden="true" />
      <span>{issue.message}</span>
    </li>
  );
}

export function DataHealthPanel({ store, index, health, className }: DataHealthPanelProps) {
  const h = health ?? computeDataHealth(store, index);
  const c = store.company(index);
  const type = store.companyType(index);
  const nothingToReport = h.assumedZero.length === 0 && h.missingRequired.length === 0 && h.mismatches.length === 0
    && h.issues.length === 0 && !h.snapshotOnly && h.years.gaps.length === 0;

  return (
    <section aria-label="Data coverage and checks" className={cn("space-y-4 text-sm", className)}>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Annual statements</dt>
          <dd>
            {h.years.count === 0
              ? "Not provided"
              : `${fyLabel(h.years.first ?? 0)} to ${fyLabel(h.years.last ?? 0)} · ${plural(h.years.count, "year", "years")}`}
            {h.years.gaps.length > 0 && <span className="text-chart-amber"> · missing {h.years.gaps.map(fyLabel).join(", ")}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Quarterly results</dt>
          <dd>{h.quarters.count === 0 || !h.quarters.last ? "Not provided" : `${plural(h.quarters.count, "quarter", "quarters")} · latest ${quarterLabel(h.quarters.last, c.fy_end_month)}`}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Shareholding</dt>
          <dd>{h.shareholding.count === 0 || !h.shareholding.last ? "Not provided" : `${plural(h.shareholding.count, "quarter", "quarters")} · latest ${monthYearLabel(h.shareholding.last)}`}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Company type and basis</dt>
          <dd>
            {TYPE_LABEL[type.type] ?? type.type}{h.typeInferred ? " (inferred from the sector)" : ""} · {c.statement_basis}
          </dd>
        </div>
      </dl>

      {h.snapshotOnly && (
        <p className="flex items-start gap-1.5 text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Only a snapshot was provided for this company: no statements or quarterly results. Values shown come from the file as supplied.
        </p>
      )}

      {h.assumedZero.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-foreground">Assumptions</h4>
          <ul className="space-y-1 text-muted-foreground">
            {h.assumedZero.map((a) => (
              <li key={a.field}>{ASSUMED_ZERO_TEXT[a.field] ?? `${fieldLabel(a.field)} not provided; treated as 0.`} ({plural(a.years, "year", "years")})</li>
            ))}
          </ul>
        </div>
      )}

      {h.missingRequired.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-foreground">Inputs not provided</h4>
          <ul className="space-y-1 text-muted-foreground">
            {h.missingRequired.map((m) => (
              <li key={m.period}><span className="font-medium text-foreground">{m.period}:</span> {m.fields.map((f) => fieldLabel(f as AnnualField)).join(", ")}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Metrics that need these inputs show "Not provided" for those years.</p>
        </div>
      )}

      {h.mismatches.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-foreground">Supplied values that differ from the statements by more than {MISMATCH_THRESHOLD_PCT}%</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr><th scope="col" className="py-1 pr-2 font-medium">Metric</th><th scope="col" className="py-1 pr-2 font-medium">In your file</th><th scope="col" className="py-1 pr-2 font-medium">From statements (used)</th><th scope="col" className="py-1 font-medium">Difference</th></tr>
              </thead>
              <tbody>
                {h.mismatches.map((m) => {
                  const def = store.def(m.metric);
                  const fmt = (v: number) => (def ? formatUnitValue(def.unit, def.decimals, v) : formatNumberIN(v, 2));
                  return (
                    <tr key={m.metric} className="border-t border-border">
                      <td className="py-1 pr-2">{def?.label ?? m.metric}</td>
                      <td className="py-1 pr-2">{fmt(m.provided)}</td>
                      <td className="py-1 pr-2">{fmt(m.derived)}</td>
                      <td className="py-1">{formatNumberIN(m.pctDiff, 1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {h.issues.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-foreground">Checks on the figures</h4>
          <ul className="space-y-1 text-muted-foreground">
            {h.issues.map((i, k) => <IssueLine key={`${i.code}-${k}`} issue={i} />)}
          </ul>
        </div>
      )}

      {nothingToReport && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-chart-green" aria-hidden="true" />
          The data checks found nothing to report for this company.
        </p>
      )}
    </section>
  );
}
