import { useMemo } from "react";
import type { MetricStore, ScoreExplanation } from "@/lib/contracts";
import { INSIGHTS_FOOTER } from "@/lib/insights";
import { explainAltman, explainPiotroski } from "@/lib/metrics";
import { MetricInfo } from "@/components/common/MetricInfo";
import { ValueCell } from "@/components/common/ValueCell";
import { BandBadge } from "./BandBadge";
import { WhyScoreDrawer } from "./WhyScoreDrawer";
import { SegmentedBar, type SegmentKind } from "./viz/SegmentedBar";

const CRITERION_KIND = { met: "pass", not_met: "fail", not_evaluated: "unknown" } as const;

/** Nine tests, one segment each, in the order of the published score. Icon and fill; the drawer lists the working. */
function PiotroskiMeter({ explanation }: { explanation: ScoreExplanation }) {
  if (explanation.criteria.length === 0) return null;
  const segments: SegmentKind[] = explanation.criteria.map((c) => CRITERION_KIND[c.result]);
  const met = explanation.criteria.filter((c) => c.result === "met").length;
  const notMet = explanation.criteria.filter((c) => c.result === "not_met").length;
  const unknown = explanation.criteria.length - met - notMet;
  return (
    <div className="mt-3" role="img" aria-label={`${met} of ${explanation.criteria.length} tests met, ${notMet} not met, ${unknown} not evaluated`}>
      <SegmentedBar segments={segments} />
      <p aria-hidden="true" className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span>{met} met</span>
        <span>{notMet} not met</span>
        {unknown > 0 && <span>{unknown} not evaluated</span>}
      </p>
    </div>
  );
}

const ALTMAN_MAX = 5;
const pct = (n: number): number => Math.min(100, Math.max(0, (n / ALTMAN_MAX) * 100));

/** The published Z'' cut-offs (1.1 and 2.6) as a labelled scale with a marker for this company. */
function AltmanScale({ value }: { value: number | null }) {
  const bands = [
    { label: "Distress zone", range: "below 1.1", from: 0, to: 1.1, tone: "bg-destructive/15" },
    { label: "Grey zone", range: "1.1 to 2.6", from: 1.1, to: 2.6, tone: "bg-warning/15" },
    { label: "Safe zone", range: "above 2.6", from: 2.6, to: ALTMAN_MAX, tone: "bg-success/15" },
  ];
  return (
    <div className="mt-3" data-testid="altman-scale">
      <div className="relative flex h-3 gap-0.5" aria-hidden="true">
        {bands.map((b) => (
          <div key={b.label} className={`${b.tone} first:rounded-l last:rounded-r`} style={{ width: `${pct(b.to) - pct(b.from)}%` }} />
        ))}
        {value !== null && (
          <div className="absolute -top-1 h-5 w-1 -translate-x-1/2 rounded bg-foreground ring-2 ring-card" style={{ left: `${pct(value)}%` }} />
        )}
      </div>
      {value !== null && value > ALTMAN_MAX && <p className="mt-1 text-xs text-muted-foreground">The scale is drawn up to {ALTMAN_MAX}; this score is above it.</p>}
      <ul className="mt-1.5 flex gap-0.5 text-xs text-muted-foreground">
        {bands.map((b) => (
          <li key={b.label} style={{ width: `${pct(b.to) - pct(b.from)}%` }} className="min-w-0">
            <span className="block font-medium text-foreground">{b.label}</span>
            <span className="block">{b.range}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface ScoresSectionProps {
  store: MetricStore;
  index: number;
}

function ScoreCard({ store, index, explanation }: { store: MetricStore; index: number; explanation: ScoreExplanation }) {
  const def = store.def(explanation.scoreId);
  const family = store.family(index);
  const isF = explanation.scoreId === "piotroski_f";
  const title = isF ? "Piotroski F-score" : "Altman Z'' score";
  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {def && <MetricInfo def={def} />}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        {def && <ValueCell def={def} value={explanation.value} family={family} className="text-2xl font-semibold" />}
        {isF && explanation.value.v !== null && <span className="text-sm text-muted-foreground">out of 9</span>}
        {explanation.band && <BandBadge band={explanation.band} />}
      </div>
      {explanation.value.v === null && explanation.criteria.length > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          {isF ? `${explanation.evaluable} of ${explanation.total} tests could be evaluated, so no score is shown.` : "An input is missing, so no score is shown."}
        </p>
      )}
      {explanation.value.v === null && explanation.criteria.length === 0 && explanation.caveats[0] && (
        <p className="mt-1 text-sm text-muted-foreground">{explanation.caveats[0]}</p>
      )}
      {isF && <PiotroskiMeter explanation={explanation} />}
      {!isF && explanation.value.v !== null && <p className="mt-1 text-sm text-muted-foreground">A distress screen, not a prediction of default.</p>}
      {!isF && <AltmanScale value={explanation.value.v} />}
      <div className="mt-3">
        <WhyScoreDrawer store={store} index={index} scoreId={explanation.scoreId} />
      </div>
    </div>
  );
}

/** The two published scores, each with its working. There is no combined "overall" score. */
export function ScoresSection({ store, index }: ScoresSectionProps) {
  const piotroski = useMemo(() => explainPiotroski(store, index), [store, index]);
  const altman = useMemo(() => explainAltman(store, index), [store, index]);
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ScoreCard store={store} index={index} explanation={piotroski} />
        <ScoreCard store={store} index={index} explanation={altman} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Each score stands on its own; they are not added together. {INSIGHTS_FOOTER}</p>
    </div>
  );
}
