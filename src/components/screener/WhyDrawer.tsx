import { useMemo } from "react";
import type { MetricStore, ScreenRun } from "@/lib/contracts";
import { RESULT_WORD, explainClause } from "@/lib/query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CompanyName } from "@/components/common/CompanyName";
import { PassFailIcon } from "@/components/common/PassFailIcon";
import { useIsMobile } from "@/hooks/use-mobile";
import { evaluationOf } from "./helpers";

export interface WhyDrawerProps {
  run: ScreenRun;
  store: MetricStore;
  /** Store index of the company, or null when closed. */
  index: number | null;
  onClose: () => void;
}

/** Rule-by-rule explanation for one company: Passes, Fails or Not checked, with the numbers behind it. */
export function WhyDrawer({ run, store, index, onClose }: WhyDrawerProps) {
  const mobile = useIsMobile();
  const explanations = useMemo(() => {
    if (index === null) return [];
    const evaluation = evaluationOf(run);
    return run.compiled.clauses.map((_, k) => explainClause(run.compiled, evaluation, k, index, store));
  }, [run, store, index]);
  const matched = explanations.every((e) => e.result === 1);
  const name = index === null ? "" : store.company(index).name;
  return (
    <Sheet open={index !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side={mobile ? "bottom" : "right"} className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {matched ? "Why it matched:" : "Rule results:"}{" "}
            {index !== null && <CompanyName name={name} isSynthetic={store.meta.isSynthetic} symbol={store.symbols[index]} />}
          </SheetTitle>
          <SheetDescription>Each rule is checked on its own. A rule is not checked when the data it needs is missing or does not apply.</SheetDescription>
        </SheetHeader>
        <ul aria-label="Legend" className="mt-3 flex flex-wrap gap-3 rounded-md bg-muted/50 p-2" data-testid="why-legend">
          {([1, 0, 2] as const).map((t) => <li key={t}><PassFailIcon status={t} label={RESULT_WORD[t]} /></li>)}
        </ul>
        {explanations.length === 0 ? (
          <p className="mt-4 text-sm">There are no rules, so every company in the universe is shown.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {explanations.map((ex) => (
              <li key={ex.clause} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <PassFailIcon status={ex.result} label={RESULT_WORD[ex.result]} />
                  <span className="font-medium">Rule {ex.clause + 1}</span>
                </div>
                <p className="mt-1">{ex.english}</p>
                {ex.detail && <p className="mt-1 text-muted-foreground">{ex.detail}</p>}
                {ex.gapText && ex.result === 0 && <p className="mt-1 text-muted-foreground">Gap: {ex.gapText}</p>}
                {ex.peer && (
                  <p className="mt-1 text-muted-foreground">
                    Compared with {ex.peer.groupLabel} ({ex.peer.n} companies with data).
                  </p>
                )}
                {ex.periods && ex.periods.length > 0 && (
                  <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
                    {ex.periods.map((p) => (
                      <li key={p.label} className="flex items-center justify-between gap-2 text-xs">
                        <span>{p.label}: <span className="tabular-nums">{p.display}</span></span>
                        <PassFailIcon status={p.result} label={RESULT_WORD[p.result]} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-xs text-muted-foreground">Rule-based observations on the data you loaded. Not a recommendation.</p>
      </SheetContent>
    </Sheet>
  );
}
