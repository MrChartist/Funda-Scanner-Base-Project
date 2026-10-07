import { useMemo } from "react";
import type { MetricDef, MetricStore, MetricValue } from "@/lib/contracts";
import { MetricInfo } from "@/components/common/MetricInfo";
import { ValueCell } from "@/components/common/ValueCell";
import { keyMetricGroups, NO_VALUE, PLAIN } from "@/lib/views/company-view";

export interface KeyMetricsProps {
  store: MetricStore;
  index: number;
}

/** Per-share amounts are not comparable across companies, so they carry no industry median. */
const NO_MEDIAN: ReadonlySet<string> = new Set(["price", "eps", "bvps"]);

interface Tile {
  def: MetricDef;
  value: MetricValue;
  median: MetricValue | null;
}

/** Headline figures by company type. Lenders see lender measures, and the non-lender measures as "not applicable". */
export function KeyMetrics({ store, index }: KeyMetricsProps) {
  const family = store.family(index);
  const groups = useMemo(
    () =>
      keyMetricGroups(family).map((g) => ({
        ...g,
        tiles: g.ids.flatMap((id): Tile[] => {
          const def = store.def(id);
          if (!def) return [];
          const value = store.get(id, index);
          let median: MetricValue | null = null;
          if (value.reason !== "not_applicable_financial" && !NO_MEDIAN.has(id)) {
            const stat = store.peerStat(id, index, "industry");
            median = stat.median === null ? NO_VALUE("too_few_peers") : PLAIN(stat.median);
          }
          return [{ def, value, median }];
        }),
      })),
    [store, index, family],
  );
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.title}>
          <h3 className="text-sm font-semibold">{g.title}</h3>
          {g.note && <p className="mt-0.5 text-sm text-muted-foreground">{g.note}</p>}
          <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {g.tiles.map((t) => (
              <div key={t.def.id} className="rounded-md border p-2">
                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{t.def.label}</span>
                  <MetricInfo def={t.def} />
                </dt>
                <dd className="mt-1 text-base font-semibold">
                  <ValueCell def={t.def} value={t.value} family={family} showPeriod />
                </dd>
                {t.median && t.median.v !== null && (
                  <dd className="mt-0.5 text-xs text-muted-foreground">
                    Industry median <ValueCell def={t.def} value={t.median} family={family} />
                  </dd>
                )}
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
