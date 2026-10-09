// src/test/fixtures/sample/red-flags.ts — test-only red-flag counter for calibration (§E.4, §G.4).
// It evaluates the §C.9 red-flag rules with the real query engine so that sample calibration and the
// "value" template can be checked before the insights module ships its own red_flag_count provider.
// It is not the production rule set: the insights module (src/lib/insights) owns that.
import type { ColumnProvider, MetricColumn, MetricStore, TypeFamily } from "@/lib/contracts";
import { TRI_TRUE } from "@/lib/contracts";
import { compileQuery, evaluateQuery } from "@/lib/query";

export interface RedFlagRule {
  id: string;
  /** "nf" = non-financial only, "l" = lenders only, "all" = every family. */
  appliesTo: "nf" | "l" | "all";
  query: string;
}

/** The §C.9 red-flag table, verbatim. */
export const RED_FLAG_RULES: readonly RedFlagRule[] = [
  { id: "RF-01", appliesTo: "nf", query: "cum_cfo_to_pat_5y < 0.7" },
  { id: "RF-02", appliesTo: "nf", query: "debtor_days > 1.3 * debtor_days[fy-3] AND sales_cagr_3y < 10" },
  { id: "RF-03", appliesTo: "all", query: "pledged_pct > 25 OR pledged_pct_chg_1y > 5" },
  { id: "RF-04", appliesTo: "all", query: "promoter_holding_chg_1y < -5" },
  { id: "RF-05", appliesTo: "nf", query: "other_income_to_pbt > 30" },
  { id: "RF-06", appliesTo: "nf", query: "interest_coverage < 1.5" },
  { id: "RF-07", appliesTo: "all", query: "net_worth < 0" },
  { id: "RF-08", appliesTo: "all", query: "every(effective_tax_rate < 10, 3y)" },
  { id: "RF-09", appliesTo: "nf", query: "altman_z < 1.1" },
  { id: "RF-10", appliesTo: "all", query: "count(abs(exceptional_items) > 0.2 * abs(pbt), 3y) >= 2" },
  { id: "RF-11", appliesTo: "all", query: "shares_outstanding_ye > 1.05 * shares_outstanding_ye[prev]" },
  { id: "RF-12", appliesTo: "nf", query: "inventory_days > 1.3 * inventory_days[fy-3] AND sales_cagr_3y < 10" },
  { id: "LF-01", appliesTo: "l", query: "gnpa_ratio - gnpa_ratio[prev] > 1" },
  { id: "LF-02", appliesTo: "l", query: "provision_coverage < 50" },
  { id: "LF-03", appliesTo: "l", query: "credit_cost > 2.5" },
  { id: "LF-04", appliesTo: "l", query: "pledged_pct > 25" },
];

function applies(rule: RedFlagRule, family: TypeFamily): boolean {
  if (rule.appliesTo === "all") return true;
  if (rule.appliesTo === "nf") return family === "non_financial";
  return family === "lender";
}

/** Triggered red-flag ids per company (store order). A rule that is UNKNOWN does not count. */
export function triggeredRedFlags(store: MetricStore): string[][] {
  const rows = Int32Array.from({ length: store.size }, (_, i) => i);
  const out: string[][] = Array.from({ length: store.size }, () => []);
  for (const rule of RED_FLAG_RULES) {
    const compiled = compileQuery(rule.query, store);
    const errors = compiled.issues.filter((x) => x.level === "error");
    if (errors.length > 0) throw new Error(`${rule.id} does not compile: ${errors.map((e) => e.code).join(", ")}`);
    const evaluation = evaluateQuery(compiled, store, rows);
    for (let i = 0; i < store.size; i++) {
      if (applies(rule, store.family(i)) && evaluation.whereTri[i] === TRI_TRUE) out[i].push(rule.id);
    }
  }
  return out;
}

/** A red_flag_count column provider built on triggeredRedFlags (test-only). */
export const testRedFlagCountProvider: ColumnProvider = {
  ids: ["red_flag_count"],
  compute(store: MetricStore, id): MetricColumn {
    const flags = triggeredRedFlags(store);
    const values = new Float64Array(store.size);
    for (let i = 0; i < store.size; i++) values[i] = flags[i].length;
    return { id, values, reasons: new Uint8Array(store.size), flags: new Uint16Array(store.size) };
  },
};
