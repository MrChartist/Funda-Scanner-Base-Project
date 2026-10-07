import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { MetricStore } from "@/lib/contracts";
import { CompanyName } from "@/components/common/CompanyName";
import { EmptyState } from "@/components/common/EmptyState";
import { MetricInfo } from "@/components/common/MetricInfo";
import { ValueCell } from "@/components/common/ValueCell";
import { peerView } from "@/lib/views/company-view";
import { cn } from "@/lib/utils";

export interface PeerComparisonProps {
  store: MetricStore;
  index: number;
}

const SCOPE_TEXT = { class: "all companies of the same type", sector: "the same sector", industry: "the same industry" } as const;

/** The company beside its peers of the same type, with a median row. Peers are only ever drawn from the loaded data. */
export function PeerComparison({ store, index }: PeerComparisonProps) {
  const view = useMemo(() => peerView(store, index), [store, index]);
  const synthetic = store.meta.isSynthetic;
  if (view.rows.length <= 1) {
    return <EmptyState title="No comparable companies in your data." description="Peers are chosen from the data you are viewing, among companies of the same type." />;
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {view.groupLabel ? `${view.groupLabel}. ` : ""}
        {view.fellBackTo ? `The group was widened to ${SCOPE_TEXT[view.fellBackTo]} because the industry has too few companies. ` : ""}
        Peers are ordered by market capitalisation.
      </p>
      <div className="relative overflow-x-auto rounded-md border" tabIndex={0} role="region" aria-label="Peer comparison">
        <table className="w-full min-w-max border-collapse text-sm">
          <caption className="sr-only">Peer comparison, ordered by market capitalisation, with the median of the group</caption>
          <thead>
            <tr className="border-b bg-muted/40">
              <th scope="col" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground">Company</th>
              {view.columns.map((c) => (
                <th key={c.id} scope="col" className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1">{c.short}<MetricInfo def={c} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.symbol} className={cn("border-b", r.isSelf && "bg-primary/5 font-medium")}>
                <th scope="row" className={cn("sticky left-0 z-10 px-3 py-2 text-left text-sm font-normal", r.isSelf ? "bg-card font-medium" : "bg-card")}>
                  {r.isSelf ? (
                    <span><CompanyName name={r.name} isSynthetic={synthetic} /> <span className="text-xs text-muted-foreground">(this company)</span></span>
                  ) : (
                    <Link to={`/company/${encodeURIComponent(r.symbol)}`} className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
                      <CompanyName name={r.name} isSynthetic={synthetic} />
                    </Link>
                  )}
                </th>
                {view.columns.map((c, k) => (
                  <td key={c.id} className="whitespace-nowrap px-3 py-2 text-right">
                    <ValueCell def={c} value={r.values[k]} family={r.family} />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-muted/30">
              <th scope="row" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left text-sm font-medium">Median of the group</th>
              {view.columns.map((c, k) => (
                <td key={c.id} className="whitespace-nowrap px-3 py-2 text-right">
                  <ValueCell def={c} value={view.median[k]} family={store.family(index)} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
