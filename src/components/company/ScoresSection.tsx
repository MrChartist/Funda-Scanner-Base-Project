import { useMemo } from "react";
import type { MetricStore, ScoreExplanation } from "@/lib/contracts";
import { INSIGHTS_FOOTER } from "@/lib/insights";
import { explainAltman, explainPiotroski } from "@/lib/metrics";
import { MetricInfo } from "@/components/common/MetricInfo";
import { ValueCell } from "@/components/common/ValueCell";
import { BandBadge } from "./BandBadge";
import { WhyScoreDrawer } from "./WhyScoreDrawer";

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
    <div className="rounded-md border p-3">
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
      {!isF && explanation.value.v !== null && <p className="mt-1 text-sm text-muted-foreground">A distress screen, not a prediction of default.</p>}
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
