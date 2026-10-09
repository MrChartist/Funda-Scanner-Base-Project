import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import type { MetricStore } from "@/lib/contracts";
import { CompanyName } from "@/components/common/CompanyName";
import { MetricInfo } from "@/components/common/MetricInfo";
import { ValueCell } from "@/components/common/ValueCell";
import { TYPE_LABEL } from "@/lib/views/company-view";
import { cn } from "@/lib/utils";
import type { CompareModel, CompareRow } from "./compare-view";

export interface CompareTableProps {
  store: MetricStore;
  indices: readonly number[];
  model: CompareModel;
}

const rowMax = (row: CompareRow): number =>
  Math.max(0, ...row.cells.map((c) => Math.abs(c.value.v ?? 0)), Math.abs(row.median.v ?? 0));

/** Magnitude bar on the scale of the compared set; the tick marks the industry median. Decorative: the number is above it. */
function RowBar({ value, median, max, lead }: { value: number; median: number | null; max: number; lead: boolean }) {
  const w = Math.max(2, (Math.abs(value) / max) * 100);
  return (
    <span aria-hidden="true" className="relative mt-1 block h-1.5 w-full rounded-full bg-muted">
      <span className={cn("absolute inset-y-0 left-0 rounded-full", lead ? "bg-primary" : "bg-primary/45")} style={{ width: `${w}%` }} />
      {median !== null && <span className="absolute -inset-y-0.5 w-0.5 bg-foreground/70" style={{ left: `${(Math.abs(median) / max) * 100}%` }} />}
    </span>
  );
}

/** Side-by-side figures, an industry-median column and a "Leads on" count per company. */
export function CompareTable({ store, indices, model }: CompareTableProps) {
  const synthetic = store.meta.isSynthetic;
  return (
    <div className="relative overflow-x-auto rounded-md border" tabIndex={0} role="region" aria-label="Comparison table">
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">Companies compared side by side, with the median of the first company's industry</caption>
        <thead>
          <tr className="border-b bg-muted/40 align-top">
            <th scope="col" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground">Figure</th>
            {indices.map((i) => {
              const c = store.company(i);
              const t = store.companyType(i);
              return (
                <th key={c.symbol} scope="col" className="min-w-40 px-3 py-2 text-left font-normal">
                  <Link to={`/company/${encodeURIComponent(c.symbol)}`} className="font-medium underline-offset-2 hover:underline">
                    <CompanyName name={c.name} isSynthetic={synthetic} />
                  </Link>
                  <span className="block text-xs text-muted-foreground">{c.symbol} · {TYPE_LABEL[t.type]}{t.inferred ? " (inferred)" : ""}</span>
                </th>
              );
            })}
            <th scope="col" className="min-w-40 px-3 py-2 text-left font-normal">
              <span className="font-medium">Industry median</span>
              <span className="block text-xs text-muted-foreground">{model.medianLabel ?? "No peer group"}</span>
            </th>
          </tr>
          <tr className="border-b bg-muted/20">
            <th scope="row" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left text-sm font-medium">Leads on</th>
            {indices.map((i, k) => (
              <td key={store.symbols[i]} className="px-3 py-2 font-medium">
                {model.comparable === 0 ? "Not enough figures to compare" : `${model.leads[k]} of ${model.comparable} figures`}
              </td>
            ))}
            <td className="px-3 py-2 text-xs text-muted-foreground">Not counted</td>
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => (
            <tr key={row.def.id} className="border-b last:border-0">
              <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-sm font-normal">
                <span className="inline-flex items-center gap-1"><span className="block w-32 sm:w-52">{row.def.label}</span><MetricInfo def={row.def} /></span>
              </th>
              {row.cells.map((cell, k) => {
                const max = rowMax(row);
                return (
                <td key={store.symbols[indices[k]]} className={cn("min-w-40 px-3 py-2", cell.leads && "bg-primary/5 font-medium")}>
                  <ValueCell def={row.def} value={cell.value} family={store.family(indices[k])} showPeriod />
                  {cell.leads && (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-primary">
                      <Star className="h-3 w-3" aria-hidden="true" /> Leads
                    </span>
                  )}
                  {cell.value.v !== null && max > 0 && <RowBar value={cell.value.v} median={k === 0 ? row.median.v : null} max={max} lead={cell.leads} />}
                </td>
                );
              })}
              <td className="px-3 py-2 text-muted-foreground">
                <ValueCell def={row.def} value={row.median} family={store.family(indices[0])} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
