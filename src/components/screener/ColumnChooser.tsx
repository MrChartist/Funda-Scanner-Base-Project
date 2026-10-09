import { Columns3, X } from "lucide-react";
import type { ColumnSpec, MetricStore } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { COLUMN_PRESETS, activePreset, presetColumns } from "./column-presets";
import { MetricBrowser } from "./MetricBrowser";
import { ICON_BUTTON, ICON_LABEL } from "./toolbar";

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
  const current = activePreset(columns, store);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" className={ICON_BUTTON} title="Columns">
          <Columns3 className="h-4 w-4" aria-hidden="true" />
          <span className={ICON_LABEL}>Columns</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose columns</DialogTitle>
          <DialogDescription>
            Market capitalisation, P/E, ROCE and a few more are always shown, together with every metric your rules use. Pick a set below, or add single metrics.
          </DialogDescription>
        </DialogHeader>
        <section aria-labelledby="column-presets-heading">
          <h4 id="column-presets-heading" className="text-sm font-semibold">Quick sets</h4>
          <ul className="mt-2 flex flex-wrap gap-2">
            {COLUMN_PRESETS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={current === p.id}
                  title={p.hint}
                  onClick={() => onChange(presetColumns(p, store))}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border bg-card px-3.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                    current === p.id && "border-primary bg-primary/10 text-primary",
                  )}
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
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
