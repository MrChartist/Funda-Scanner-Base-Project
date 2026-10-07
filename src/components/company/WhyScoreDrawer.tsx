import { useMemo } from "react";
import type { MetricStore, ScoreExplanation } from "@/lib/contracts";
import { INSIGHTS_FOOTER } from "@/lib/insights";
import { explainAltman, explainPiotroski } from "@/lib/metrics";
import { PassFailIcon } from "@/components/common/PassFailIcon";
import { ValueCell } from "@/components/common/ValueCell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BandBadge } from "./BandBadge";

export interface WhyScoreDrawerProps {
  store: MetricStore;
  index: number;
  scoreId: ScoreExplanation["scoreId"];
}

const TITLE: Readonly<Record<ScoreExplanation["scoreId"], string>> = {
  piotroski_f: "Piotroski F-score",
  altman_z: "Altman Z'' score",
};

const RESULT_STATUS = { met: "pass", not_met: "fail", not_evaluated: "unknown" } as const;
const RESULT_LABEL = { met: "Met", not_met: "Not met", not_evaluated: "Not evaluated" } as const;

/** Slide-over listing every input behind a score: all nine Piotroski tests, or the four Altman terms. */
export function WhyScoreDrawer({ store, index, scoreId }: WhyScoreDrawerProps) {
  const explanation = useMemo(() => (scoreId === "piotroski_f" ? explainPiotroski(store, index) : explainAltman(store, index)), [store, index, scoreId]);
  const def = store.def(scoreId);
  const family = store.family(index);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-11" data-no-print>
          Why this score?
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{TITLE[scoreId]}: how it was worked out</SheetTitle>
          <SheetDescription>
            {explanation.criteria.length === 0
              ? "This score is not calculated for this company."
              : scoreId === "piotroski_f"
                ? `${explanation.evaluable} of ${explanation.total} tests could be evaluated.`
                : `${explanation.evaluable} of ${explanation.total} terms could be evaluated.`}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Result:</span>
            {def && <ValueCell def={def} value={explanation.value} family={family} className="text-base font-semibold" />}
            {explanation.band && <BandBadge band={explanation.band} />}
          </p>
          {explanation.criteria.length > 0 && (
            <ol className="space-y-3" aria-label={scoreId === "piotroski_f" ? "The nine Piotroski tests" : "The Altman terms"}>
              {explanation.criteria.map((c) => (
                <li key={c.id} className="rounded-md border p-3" data-criterion={c.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                    {scoreId === "piotroski_f" && <PassFailIcon status={RESULT_STATUS[c.result]} label={RESULT_LABEL[c.result]} />}
                  </div>
                  <p className="mt-1 font-medium">{c.text}</p>
                  <p className="mt-0.5 text-muted-foreground">{c.detail}</p>
                  {c.inputs.length > 0 && (
                    <ul className="mt-1 text-xs text-muted-foreground">
                      {c.inputs.map((e, k) => (
                        <li key={`${e.metric}-${k}`}>
                          {e.label}
                          {e.period ? ` (${e.period})` : ""}: {e.display}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
          {explanation.caveats.length > 0 && (
            <div>
              <h3 className="font-semibold">Things to keep in mind</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {explanation.caveats.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Method version {explanation.methodologyVersion}. {INSIGHTS_FOOTER}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
