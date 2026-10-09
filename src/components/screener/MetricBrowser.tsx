import { useMemo, useState } from "react";
import type { MetricDef, MetricId, MetricStore } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MetricInfo } from "@/components/common/MetricInfo";
import { groupMetrics, periodOptions } from "./helpers";

export interface MetricBrowserProps {
  store: MetricStore;
  /** Metric ids already in use; their button reads "Added". */
  picked: readonly MetricId[];
  actionLabel: string;
  onPick: (id: MetricId) => void;
}

function matches(d: MetricDef, q: string): boolean {
  if (!q) return true;
  const hay = `${d.label} ${d.short} ${d.id} ${d.aliases.join(" ")}`.toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

/** Searchable list of every metric, grouped, each with an ⓘ card and a period choice. */
export function MetricBrowser({ store, picked, actionLabel, onPick }: MetricBrowserProps) {
  const [query, setQuery] = useState("");
  const [beginner, setBeginner] = useState(true);
  const [period, setPeriod] = useState<Record<string, string>>({});
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => groupMetrics(store, beginner, (d) => matches(d, q)), [store, beginner, q]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <Label htmlFor="metric-search" className="text-sm">Search metrics</Label>
          <Input id="metric-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="For example ROCE or debt" className="min-h-11" />
        </div>
        <div className="flex min-h-11 items-center gap-2">
          <Switch id="browser-beginner" checked={beginner} onCheckedChange={setBeginner} />
          <Label htmlFor="browser-beginner" className="text-sm">Beginner view</Label>
        </div>
      </div>
      {groups.length === 0 && <p className="text-sm text-muted-foreground">No metric matches “{query}”.</p>}
      <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
        {groups.map((g) => (
          <section key={g.label} aria-label={g.label}>
            <h4 className="text-sm font-semibold">{g.label}</h4>
            <ul className="mt-1 divide-y">
              {g.defs.map((d) => {
                const options = periodOptions(store, d.id);
                const chosen = period[d.id] ?? d.id;
                const added = picked.includes(chosen);
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 py-1">
                    <span className="min-w-0 flex-1 text-sm">{d.label}</span>
                    <MetricInfo def={d} />
                    {options.length > 1 && (
                      <select
                        aria-label={`Period for ${d.label}`}
                        value={chosen}
                        onChange={(e) => setPeriod((p) => ({ ...p, [d.id]: e.target.value }))}
                        className="min-h-11 rounded-md border bg-background px-2 text-sm"
                      >
                        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    )}
                    <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={added} onClick={() => onPick(chosen)} aria-label={`${actionLabel} ${d.label}`}>
                      {added ? "Added" : actionLabel}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
