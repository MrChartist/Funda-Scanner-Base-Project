// src/lib/metrics/derive/index.ts — the deriver registry: one deriver per catalogue base metric.
// Line items (metrics with a rawField) are generated from the catalogue; curated derivers win.
// Ids starting with "_" are internal building blocks with no catalogue entry.
import type { AnnualField, BaseMetricDef, QuarterField, ShareholdingField } from "@/lib/contracts";
import { BASE_METRICS } from "../catalogue";
import { ok, nul } from "../values";
import { evaluateAltman } from "../scores/altman";
import { piotroskiCore } from "../scores/piotroski";
import { type Deriver, type DeriverTable, annual, fyAsGiven, latest, qField, quarterly, shField, shareholding } from "./common";
import { BANKING_DERIVERS } from "./banking";
import { CASHFLOW_DERIVERS } from "./cashflow";
import { DIVIDEND_DERIVERS } from "./dividend";
import { EFFICIENCY_DERIVERS } from "./efficiency";
import { GROWTH_DERIVERS } from "./growth";
import { LEVERAGE_DERIVERS } from "./leverage";
import { PER_SHARE_DERIVERS } from "./per-share";
import { PROFITABILITY_DERIVERS } from "./profitability";
import { QUARTERLY_DERIVERS } from "./quarterly";
import { SHAREHOLDING_DERIVERS } from "./shareholding";
import { SIZE_DERIVERS } from "./size";
import { VALUATION_DERIVERS } from "./valuation";

const SCORE_AND_DATA_DERIVERS: DeriverTable = {
  piotroski_f: latest((c, i) => piotroskiCore(c.store, i).value),
  altman_z: latest((c, i) => evaluateAltman(c.store, i).value),
  latest_fy: latest((c, i) => {
    const fy = c.grid(i).latestFy;
    return fy === null ? nul("insufficient_history") : ok(fy);
  }),
  years_of_history: latest((c, i) => ok(c.grid(i).annual.reduce((s, r) => s + (r === null ? 0 : 1), 0))),
};

/** Ids served by column providers from other streams (never derived here). */
export const PROVIDED_IDS: ReadonlySet<string> = new Set(["red_flag_count"]);

/** A line-item deriver that exposes a raw field exactly as supplied. */
function lineItemDeriver(def: BaseMetricDef): Deriver | null {
  const field = def.rawField;
  if (field === null) return null;
  switch (def.history) {
    case "annual": return { ...annual((c, i, k) => fyAsGiven(c, i, k, field as AnnualField)), rawField: field as AnnualField };
    case "quarterly": return { ...quarterly((c, i, k) => qField(c, i, k, field as QuarterField)), rawField: field as QuarterField };
    case "shareholding": return { ...shareholding((c, i, k) => shField(c, i, k, field as ShareholdingField)), rawField: field as ShareholdingField };
    case "latest_only": return null;
  }
}

function buildDerivers(): Readonly<Record<string, Deriver>> {
  const curated: Record<string, Deriver> = {
    ...SIZE_DERIVERS, ...VALUATION_DERIVERS, ...PROFITABILITY_DERIVERS, ...EFFICIENCY_DERIVERS, ...LEVERAGE_DERIVERS,
    ...GROWTH_DERIVERS, ...QUARTERLY_DERIVERS, ...CASHFLOW_DERIVERS, ...SHAREHOLDING_DERIVERS, ...DIVIDEND_DERIVERS,
    ...PER_SHARE_DERIVERS, ...BANKING_DERIVERS, ...SCORE_AND_DATA_DERIVERS,
  };
  const out: Record<string, Deriver> = {};
  for (const def of BASE_METRICS) {
    const d = curated[def.id] ?? lineItemDeriver(def);
    if (d) out[def.id] = d;
  }
  for (const [id, d] of Object.entries(curated)) if (id.startsWith("_")) out[id] = d;
  return out;
}

/** Deriver per base metric id (plus internal "_" building blocks). */
export const DERIVERS: Readonly<Record<string, Deriver>> = buildDerivers();

/** Curated deriver ids, for the catalogue bijection test. */
export const CURATED_DERIVER_IDS: readonly string[] = Object.keys({
  ...SIZE_DERIVERS, ...VALUATION_DERIVERS, ...PROFITABILITY_DERIVERS, ...EFFICIENCY_DERIVERS, ...LEVERAGE_DERIVERS,
  ...GROWTH_DERIVERS, ...QUARTERLY_DERIVERS, ...CASHFLOW_DERIVERS, ...SHAREHOLDING_DERIVERS, ...DIVIDEND_DERIVERS,
  ...PER_SHARE_DERIVERS, ...BANKING_DERIVERS, ...SCORE_AND_DATA_DERIVERS,
});

export function hasDeriver(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(DERIVERS, id);
}

/** The history kind a deriver serves must match the catalogue (checked by tests). */
export function deriverKind(id: string): Deriver["kind"] | null {
  return hasDeriver(id) ? DERIVERS[id].kind : null;
}
