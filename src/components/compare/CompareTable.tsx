import { Link } from "react-router-dom";
import { Star, X } from "lucide-react";
import type { MetricStore } from "@/lib/contracts";
import { CompanyName } from "@/components/common/CompanyName";
import { MetricInfo } from "@/components/common/MetricInfo";
import { ValueCell } from "@/components/common/ValueCell";
import { Button } from "@/components/ui/button";
import { TYPE_LABEL } from "@/lib/views/company-view";
import { cn } from "@/lib/utils";
import type { CompareModel } from "./compare-view";

export interface CompareTableProps {
  store: MetricStore;
  indices: readonly number[];
  model: CompareModel;
  onRemove: (symbol: string) => void;
}

/** Side-by-side figures, an industry-median column and a "Leads on" count per company. */
export function CompareTable({ store, indices, model, onRemove }: CompareTableProps) {
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
                  <Button type="button" variant="ghost" size="sm" className="-ml-2 mt-1 min-h-11 gap-1 px-2 text-xs" onClick={() => onRemove(c.symbol)} aria-label={`Remove ${c.name} from the comparison`}>
                    <X className="h-4 w-4" aria-hidden="true" /> Remove
                  </Button>
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
              {row.cells.map((cell, k) => (
                <td key={store.symbols[indices[k]]} className={cn("px-3 py-2", cell.leads && "bg-primary/5 font-medium")}>
                  <ValueCell def={row.def} value={cell.value} family={store.family(indices[k])} showPeriod />
                  {cell.leads && (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-primary">
                      <Star className="h-3 w-3" aria-hidden="true" /> Leads
                    </span>
                  )}
                </td>
              ))}
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
