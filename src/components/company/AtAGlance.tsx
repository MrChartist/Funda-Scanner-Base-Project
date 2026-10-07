import { useMemo, useState } from "react";
import { Check, ChevronDown, CircleHelp, X } from "lucide-react";
import type { AreaSummary, CheckOutcome, MetricStore } from "@/lib/contracts";
import { INSIGHTS_FOOTER, RED_FLAG_HEADING, summariseAreas, summariseRedFlags } from "@/lib/insights";
import { nullReasonText } from "@/lib/format/metric-value";
import { PassFailIcon } from "@/components/common/PassFailIcon";
import { areaCountText } from "@/lib/views/company-view";
import { cn } from "@/lib/utils";

export interface AtAGlanceProps {
  store: MetricStore;
  index: number;
}

const RESULT_STATUS = { met: "pass", not_met: "fail", not_evaluated: "unknown", not_applicable: "unknown" } as const;
const RESULT_LABEL = { met: "Passes", not_met: "Does not pass", not_evaluated: "Not evaluated", not_applicable: "Not applicable" } as const;

function Dot({ result }: { result: CheckOutcome["result"] }) {
  const Icon = result === "met" ? Check : result === "not_met" ? X : CircleHelp;
  const tone = result === "met" ? "bg-emerald-600 text-white" : result === "not_met" ? "bg-red-600 text-white" : "bg-muted text-muted-foreground";
  return (
    <span aria-hidden="true" className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full", tone)}>
      <Icon className="h-3 w-3" />
    </span>
  );
}

function AreaRow({ area }: { area: AreaSummary }) {
  const [open, setOpen] = useState(false);
  const panelId = `glance-${area.area}`;
  return (
    <li className="rounded-md border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{area.label}</span>
          <span className="block text-sm text-muted-foreground">{areaCountText(area)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {area.outcomes.map((o) => (
            <Dot key={o.ruleId} result={o.result} />
          ))}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul id={panelId} className="space-y-2 border-t px-3 py-3">
          {area.outcomes.map((o) => (
            <li key={o.ruleId} className="text-sm">
              <div className="flex flex-wrap items-center gap-x-2">
                <PassFailIcon status={RESULT_STATUS[o.result]} label={RESULT_LABEL[o.result]} />
                <span className="font-medium">{o.title}</span>
              </div>
              <p className="mt-0.5 text-muted-foreground">
                {o.result === "not_evaluated" ? nullReasonText(o.reason ?? "missing_input").short : o.message}
              </p>
              <p className="text-xs text-muted-foreground">Rule: {o.test}</p>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function AtAGlance({ store, index }: AtAGlanceProps) {
  const areas = useMemo(() => summariseAreas(store, index), [store, index]);
  const flags = useMemo(() => summariseRedFlags(store, index), [store, index]);
  if (areas.length === 0) {
    return <p className="text-sm text-muted-foreground">No checks apply to this company with the data provided.</p>;
  }
  return (
    <div>
      <ul className="space-y-2">
        {areas.map((a) => (
          <AreaRow key={a.area} area={a} />
        ))}
      </ul>
      <p className="mt-3 text-sm">
        <span className="font-medium">{RED_FLAG_HEADING}: </span>
        {flags.evaluated === 0
          ? "no red-flag rule could be evaluated with your data."
          : `${flags.triggered} of ${flags.evaluated} ${flags.evaluated === 1 ? "rule" : "rules"} triggered.`}{" "}
        <a href="#checks" className="underline underline-offset-2">See the details</a>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{INSIGHTS_FOOTER}</p>
    </div>
  );
}
