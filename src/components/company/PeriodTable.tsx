import type { MetricValue, TypeFamily } from "@/lib/contracts";
import type { GridRow, PeriodColumn } from "@/lib/views/company-view";
import { MetricInfo } from "@/components/common/MetricInfo";
import { ValueCell } from "@/components/common/ValueCell";
import { cn } from "@/lib/utils";

type Row = GridRow & { medians?: MetricValue[] | null };

export interface PeriodTableProps {
  caption: string;
  periods: readonly PeriodColumn[];
  rows: readonly Row[];
  family: TypeFamily;
  /** Label for the median line shown under rows that carry medians. */
  medianLabel?: string;
  className?: string;
}

/** Rows of figures across periods. Every cell goes through <ValueCell>. */
export function PeriodTable({ caption, periods, rows, family, medianLabel, className }: PeriodTableProps) {
  return (
    <div className={cn("relative overflow-x-auto rounded-md border", className)} tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b bg-muted/40">
            <th scope="col" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground">Figure</th>
            {periods.map((p) => (
              <th key={p.key} scope="col" className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                {p.label}
                {p.note && <span className="block text-xs font-normal">{p.note}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RowGroup key={row.id} row={row} family={family} medianLabel={medianLabel} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowGroup({ row, family, medianLabel }: { row: Row; family: TypeFamily; medianLabel?: string }) {
  return (
    <>
      <tr className="border-b last:border-0">
        <th scope="row" className={cn("sticky left-0 z-10 bg-card px-3 py-2 text-left text-sm font-normal", row.derived && "italic text-muted-foreground")}>
          <span className="inline-flex items-center gap-1">
            <span className="block w-40 sm:w-64">{row.label}</span>
            <MetricInfo def={row.def} />
          </span>
        </th>
        {row.values.map((v, k) => (
          <td key={k} className="whitespace-nowrap px-3 py-2 text-right">
            <ValueCell def={row.def} value={v} family={family} />
          </td>
        ))}
      </tr>
      {row.medians && (
        <tr className="border-b bg-muted/20 last:border-0">
          <th scope="row" className="sticky left-0 z-10 bg-muted px-3 py-1.5 text-left text-xs font-normal text-muted-foreground">{medianLabel ?? "Industry median"}</th>
          {row.medians.map((v, k) => (
            <td key={k} className="whitespace-nowrap px-3 py-1.5 text-right text-xs text-muted-foreground">
              <ValueCell def={row.def} value={v} family={family} />
            </td>
          ))}
        </tr>
      )}
    </>
  );
}
