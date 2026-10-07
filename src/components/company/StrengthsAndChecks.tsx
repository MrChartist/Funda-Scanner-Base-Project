import { useMemo } from "react";
import { AlertTriangle, Check, CircleHelp, X } from "lucide-react";
import type { CheckOutcome, MetricStore } from "@/lib/contracts";
import { evaluateChecks, INSIGHTS_FOOTER, RED_FLAG_HEADING } from "@/lib/insights";
import { nullReasonText } from "@/lib/format/metric-value";
import { NOT_EVALUATED_HEADING } from "@/lib/views/company-view";
import { cn } from "@/lib/utils";

export interface StrengthsAndChecksProps {
  store: MetricStore;
  index: number;
}

function Item({ o, tone }: { o: CheckOutcome; tone: "pass" | "fail" | "flag" | "unknown" }) {
  const Icon = tone === "pass" ? Check : tone === "fail" ? X : tone === "flag" ? AlertTriangle : CircleHelp;
  const colour =
    tone === "pass" ? "text-emerald-700 dark:text-emerald-400" : tone === "fail" ? "text-red-700 dark:text-red-400" : tone === "flag" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground";
  return (
    <li className="flex gap-2 py-2 text-sm">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", colour)} aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-medium">{o.title}</p>
        <p className="text-muted-foreground">
          {o.result === "not_evaluated" ? nullReasonText(o.reason ?? "missing_input").short : o.message}
        </p>
        <p className="text-xs text-muted-foreground">Rule: {o.test}</p>
      </div>
    </li>
  );
}

function Group({ title, count, children, empty }: { title: string; count: number; children: React.ReactNode; empty?: string }) {
  return (
    <section className="rounded-md border p-3" aria-label={title}>
      <h3 className="text-sm font-semibold">
        {title} <span className="font-normal text-muted-foreground">({count})</span>
      </h3>
      {count === 0 && empty ? <p className="mt-1 text-sm text-muted-foreground">{empty}</p> : <ul className="mt-1 divide-y">{children}</ul>}
    </section>
  );
}

/** Checks passed and not met, red flags triggered ("Worth checking"), and everything that could not be evaluated. */
export function StrengthsAndChecks({ store, index }: StrengthsAndChecksProps) {
  const outcomes = useMemo(() => evaluateChecks(store, index).filter((o) => o.result !== "not_applicable"), [store, index]);
  const checks = outcomes.filter((o) => o.kind === "check");
  const flags = outcomes.filter((o) => o.kind === "red_flag");
  const met = checks.filter((o) => o.result === "met");
  const notMet = checks.filter((o) => o.result === "not_met");
  const triggered = flags.filter((o) => o.result === "met");
  const notEvaluated = outcomes.filter((o) => o.result === "not_evaluated");
  const flagsEvaluated = flags.filter((o) => o.result !== "not_evaluated").length;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Group title="Checks passed" count={met.length} empty="No check was passed on the data provided.">
          {met.map((o) => <Item key={o.ruleId} o={o} tone="pass" />)}
        </Group>
        <Group title="Checks not passed" count={notMet.length} empty="Every check that could be evaluated was passed.">
          {notMet.map((o) => <Item key={o.ruleId} o={o} tone="fail" />)}
        </Group>
      </div>
      <Group
        title={RED_FLAG_HEADING}
        count={triggered.length}
        empty={flagsEvaluated === 0 ? "No red-flag rule could be evaluated with your data." : `None of the ${flagsEvaluated} red-flag rules that could be evaluated was triggered.`}
      >
        {triggered.map((o) => <Item key={o.ruleId} o={o} tone="flag" />)}
      </Group>
      <Group title={NOT_EVALUATED_HEADING} count={notEvaluated.length} empty="Every applicable rule could be evaluated.">
        {notEvaluated.map((o) => <Item key={o.ruleId} o={o} tone="unknown" />)}
      </Group>
      <p className="text-xs text-muted-foreground">{INSIGHTS_FOOTER}</p>
    </div>
  );
}
