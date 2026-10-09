import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "react-router-dom";
import type { MetricStore, MetricValue } from "@/lib/contracts";
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

/** Bar length for a value, relative to the largest magnitude in the column (decorative; the number is always shown). */
function barWidth(value: MetricValue, max: number): number {
  return value.v === null || max <= 0 ? 0 : Math.max(2, (Math.abs(value.v) / max) * 100);
}

const SCOPE_TEXT = { class: "all companies of the same type", sector: "the same sector", industry: "the same industry" } as const;

/** The company beside its peers of the same type, with a median row. Peers are only ever drawn from the loaded data. */
export function PeerComparison({ store, index }: PeerComparisonProps) {
  const view = useMemo(() => peerView(store, index), [store, index]);
  const synthetic = store.meta.isSynthetic;
  const mobile = useIsMobile();
  const maxes = view.columns.map((_, k) =>
    Math.max(0, ...view.rows.map((r) => Math.abs(r.values[k].v ?? 0)), Math.abs(view.median[k].v ?? 0)),
  );
  if (view.rows.length <= 1) {
    return <EmptyState title="No comparable companies in your data." description="Peers are chosen from the data you are viewing, among companies of the same type." />;
  }
  const nameCell = (r: (typeof view.rows)[number]) =>
    r.isSelf ? (
      <span><CompanyName name={r.name} isSynthetic={synthetic} /> <span className="text-xs text-muted-foreground">(this company)</span></span>
    ) : (
      <Link to={`/company/${encodeURIComponent(r.symbol)}`} className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
        <CompanyName name={r.name} isSynthetic={synthetic} />
      </Link>
    );
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {view.groupLabel ? `${view.groupLabel}. ` : ""}
        {view.fellBackTo ? `The group was widened to ${SCOPE_TEXT[view.fellBackTo]} because the industry has too few companies. ` : ""}
        Peers are ordered by market capitalisation. Bars show each figure relative to the largest in its column.
      </p>
      {mobile ? (
        <ul className="space-y-2" aria-label="Peer comparison">
          {view.rows.map((r) => (
            <li key={r.symbol} className={cn("rounded-lg border bg-card p-3", r.isSelf && "border-primary/50 bg-primary/5")}>
              <div className="text-sm font-medium">{nameCell(r)}</div>
              <dl className="mt-1 space-y-1.5">
                {view.columns.map((c, k) => (
                  <div key={c.id} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-sm">
                    <dt className="text-xs text-muted-foreground">{c.short}</dt>
                    <dd aria-hidden="true" className="h-2 rounded-full bg-muted">
                      <span className={cn("block h-2 rounded-full", r.isSelf ? "bg-primary" : "bg-primary/45")} style={{ width: `${barWidth(r.values[k], maxes[k])}%` }} />
                    </dd>
                    <dd className="text-right"><ValueCell def={c} value={r.values[k]} family={r.family} /></dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
          <li className="rounded-lg border bg-muted/30 p-3">
            <div className="text-sm font-medium">Median of the group</div>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {view.columns.map((c, k) => (
                <div key={c.id} className="flex justify-between gap-2">
                  <dt className="text-xs text-muted-foreground">{c.short}</dt>
                  <dd><ValueCell def={c} value={view.median[k]} family={store.family(index)} /></dd>
                </div>
              ))}
            </dl>
          </li>
        </ul>
      ) : (
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
                  <th scope="row" className={cn("sticky left-0 z-10 bg-card px-3 py-2 text-left text-sm font-normal", r.isSelf && "border-l-2 border-primary font-medium")}>
                    {nameCell(r)}
                  </th>
                  {view.columns.map((c, k) => (
                    <td key={c.id} className="relative min-w-28 whitespace-nowrap px-3 pb-3 pt-2 text-right">
                      <span aria-hidden="true" className="absolute inset-x-3 bottom-1 h-1 rounded-full bg-muted">
                        <span className={cn("block h-1 rounded-full", r.isSelf ? "bg-primary" : "bg-primary/45")} style={{ width: `${barWidth(r.values[k], maxes[k])}%` }} />
                      </span>
                      <span className="relative"><ValueCell def={c} value={r.values[k]} family={r.family} /></span>
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
      )}
    </div>
  );
}
