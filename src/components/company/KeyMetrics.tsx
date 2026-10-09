import { useMemo } from "react";
import type { MetricDef, MetricStore, MetricValue } from "@/lib/contracts";
import { MetricInfo } from "@/components/common/MetricInfo";
import { ValueCell } from "@/components/common/ValueCell";
import { formatMetric } from "@/lib/format/metric-value";
import {
  bulletPlacement, groupCaption, hasHistory, HISTORY_IDS, keyMetricGroups, metricHistory, PLAIN, type BulletPlacement, type MetricHistory,
} from "@/lib/views/company-view";
import { Bullet } from "./viz/Bullet";
import { Sparkline } from "./viz/Sparkline";

export interface KeyMetricsProps {
  store: MetricStore;
  index: number;
}

interface Kpi {
  def: MetricDef;
  value: MetricValue;
  placement: BulletPlacement;
  history: MetricHistory | null;
}

const SCOPE_WORD = { class: "same-type companies", sector: "sector peers", industry: "industry peers" } as const;

function describePlacement(def: MetricDef, value: number, p: Extract<BulletPlacement, { kind: "ok" }>): string {
  const f = (n: number) => formatMetric(def, PLAIN(n));
  const rel = value > p.median ? "above" : value < p.median ? "below" : "equal to";
  return `${def.label}: ${f(value)}, ${rel} the ${SCOPE_WORD[p.scope]} median of ${f(p.median)}. Range across ${p.n} companies: ${f(p.min)} to ${f(p.max)}.`;
}

function Position({ kpi }: { kpi: Kpi }) {
  const p = kpi.placement;
  if (p.kind === "none") return null;
  if (p.kind === "hidden") return <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>;
  const { def } = kpi;
  return (
    <div className="mt-1.5" data-testid="kpi-position">
      <Bullet
        value={p.value}
        min={p.min}
        max={p.max}
        median={p.median}
        p25={p.p25}
        p75={p.p75}
        description={describePlacement(def, p.value, p)}
      />
      <div className="mt-0.5 flex items-baseline justify-between gap-2 whitespace-nowrap text-xs text-muted-foreground">
        <ValueCell def={def} value={PLAIN(p.min)} family={null} />
        <ValueCell def={def} value={PLAIN(p.max)} family={null} />
      </div>
      <p className="text-xs text-muted-foreground">
        Industry median <ValueCell def={def} value={PLAIN(p.median)} family={null} />
        {p.fellBackTo && <span> ({SCOPE_WORD[p.scope]})</span>}
      </p>
    </div>
  );
}

/** Headline figures by company type, in cards: value, ten-year trend and position within the peer group. */
export function KeyMetrics({ store, index }: KeyMetricsProps) {
  const family = store.family(index);
  const groups = useMemo(
    () =>
      keyMetricGroups(family).map((g) => ({
        ...g,
        caption: groupCaption(store, index, g.title),
        kpis: g.ids.flatMap((id): Kpi[] => {
          const def = store.def(id);
          if (!def) return [];
          const value = store.get(id, index);
          const placement: BulletPlacement = value.reason === "not_applicable_financial" ? { kind: "none" } : bulletPlacement(store, index, id);
          const h = HISTORY_IDS.has(id) && value.reason !== "not_applicable_financial" ? metricHistory(store, index, id) : null;
          return [{ def, value, placement, history: h && hasHistory(h) ? h : null }];
        }),
      })),
    [store, index, family],
  );
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Each position bar runs from the lowest to the highest value among comparable companies in your data. The shaded band is the middle half (25th to 75th percentile), the vertical tick is the median and the dot is this company. It is shown only when at least three companies can be compared.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} aria-label={g.title} className="rounded-lg border bg-card p-3">
            <h3 className="text-sm font-semibold">{g.title}</h3>
            {g.caption && <p className="mt-0.5 text-sm text-muted-foreground">{g.caption}</p>}
            {g.note && <p className="mt-0.5 text-sm text-muted-foreground">{g.note}</p>}
            <dl className="mt-2 grid gap-x-4 sm:grid-cols-2">
              {g.kpis.map((k) => (
                <div key={k.def.id} className="border-t py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{k.def.label}</span>
                        <MetricInfo def={k.def} />
                      </dt>
                      <dd className="mt-0.5 text-lg font-semibold leading-tight">
                        <ValueCell def={k.def} value={k.value} family={family} showPeriod />
                      </dd>
                    </div>
                    {k.history && (
                      <div className="flex flex-col items-end gap-0.5">
                        <Sparkline values={k.history.values.map((v) => v.v)} />
                        <span aria-hidden="true" className="text-xs text-muted-foreground">
                          {k.history.labels[0]} to {k.history.labels[k.history.labels.length - 1]}
                        </span>
                      </div>
                    )}
                  </div>
                  <Position kpi={k} />
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
