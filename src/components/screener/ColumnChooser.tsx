import { Columns3, X } from "lucide-react";
import type { ColumnSpec, MetricStore } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MetricBrowser } from "./MetricBrowser";

export interface ColumnChooserProps {
  store: MetricStore;
  /** The columns the person added (null = none beyond the defaults). */
  columns: ColumnSpec[] | null;
  onChange: (c: ColumnSpec[] | null) => void;
}

/** Add or remove result columns. Defaults and the metrics used in the rules are always shown. */
export function ColumnChooser({ store, columns, onChange }: ColumnChooserProps) {
  const list = columns ?? [];
  const picked = list.filter((c): c is Extract<ColumnSpec, { kind: "metric" }> => c.kind === "metric").map((c) => c.id);
  const commit = (next: ColumnSpec[]) => onChange(next.length === 0 ? null : next);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11">
          <Columns3 className="mr-1 h-4 w-4" aria-hidden="true" />
          Columns
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose columns</DialogTitle>
          <DialogDescription>
            Market capitalisation, P/E, ROCE and a few more are always shown, together with every metric your rules use. Add more below.
          </DialogDescription>
        </DialogHeader>
        <section aria-label="Added columns">
          <h4 className="text-sm font-semibold">Added columns</h4>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-2">
              {list.map((c, i) => {
                const label = c.kind === "metric" ? store.def(c.id)?.label ?? c.id : c.label;
                return (
                  <li key={`${c.kind}:${i}`} className="inline-flex items-center gap-1 rounded-full border bg-muted pl-3 text-sm">
                    {label}
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Remove column ${label}`} onClick={() => commit(list.filter((_, k) => k !== i))}>
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <MetricBrowser store={store} picked={picked} actionLabel="Add column" onPick={(id) => commit([...list, { kind: "metric", id }])} />
      </DialogContent>
    </Dialog>
  );
}
