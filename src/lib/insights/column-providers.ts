// src/lib/insights/column-providers.ts — latest-only columns contributed to the metric store (§B.4
// ColumnProvider). red_flag_count = number of the company family's red flags that are triggered.
// It is null (too_few_inputs) when more than RED_FLAG_MAX_NOT_EVALUATED applicable flags could not
// be evaluated, so a company with little data never looks clean by default.
import type { ColumnProvider, MetricColumn, MetricId, MetricStore } from "@/lib/contracts";
import { NULL_REASONS, TRI_TRUE, TRI_UNKNOWN } from "@/lib/contracts";
import { RED_FLAGS } from "./checks";
import { appliesToFamily, rulePlan } from "./run";

/** More applicable red flags than this not evaluated → red_flag_count is null (catalogue: "TFI when more than 4"). */
export const RED_FLAG_MAX_NOT_EVALUATED = 4;

const TOO_FEW_INPUTS = NULL_REASONS.indexOf("too_few_inputs");

export function computeRedFlagCount(store: MetricStore, id: MetricId = "red_flag_count"): MetricColumn {
  const n = store.size;
  const values = new Float64Array(n);
  const reasons = new Uint8Array(n);
  const met = new Int32Array(n);
  const unknown = new Int32Array(n);
  const families = Array.from({ length: n }, (_, i) => store.family(i));
  for (const rule of RED_FLAGS) {
    const plan = rulePlan(store, rule);
    const where = plan.evaluation ? plan.evaluation.whereTri : null;
    for (let i = 0; i < n; i++) {
      if (!appliesToFamily(rule, families[i])) continue;
      const t = where ? where[i] : TRI_UNKNOWN;
      if (t === TRI_TRUE) met[i]++;
      else if (t === TRI_UNKNOWN) unknown[i]++;
    }
  }
  for (let i = 0; i < n; i++) {
    if (unknown[i] > RED_FLAG_MAX_NOT_EVALUATED) {
      values[i] = NaN;
      reasons[i] = TOO_FEW_INPUTS;
    } else {
      values[i] = met[i];
    }
  }
  return { id, values, reasons, flags: new Uint16Array(n) };
}

export const redFlagCountProvider: ColumnProvider = {
  ids: ["red_flag_count"],
  compute: (store, id) => computeRedFlagCount(store, id),
};

/** Latest-only columns contributed to the metric store (wired in src/lib/engine). */
export const insightColumnProviders: readonly ColumnProvider[] = [redFlagCountProvider];
