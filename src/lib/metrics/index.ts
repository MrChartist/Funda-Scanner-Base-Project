// src/lib/metrics/index.ts — public API of the metrics engine (WS3).
// P0 STUB: createMetricStore delegates to the fixture table store (src/test/fixtures/fixture-store.ts),
// which serves line items, snapshot values and simple percentiles. Every derived metric returns
// { v: null, reason: "missing_input" } and the score explainers report "not evaluated" until WS3 lands.
import type {
  CreateMetricStore, ExplainScore, LegacyNumericKey, MetricDef, MetricStore, ScoreExplanation, StockRow,
} from "@/lib/contracts";
import { LEGACY_KEY_TO_METRIC } from "@/lib/contracts";
import { createTableStore } from "@/test/fixtures/fixture-store";
import { ALL_METRIC_DEFS } from "./variants";

export { CATALOGUE_VERSION } from "./catalogue";
export { aggregateWindow, cagrColumn } from "./windows";

export const createMetricStore: CreateMetricStore = (dataset, options) => createTableStore(dataset, options);

export function allMetricDefs(): readonly MetricDef[] {
  return ALL_METRIC_DEFS;
}

const SCORE_FOOTER_CAVEAT = "Scores are not calculated yet in this build.";

function notEvaluated(store: MetricStore, i: number, scoreId: ScoreExplanation["scoreId"], total: number): ScoreExplanation {
  const reason = store.family(i) === "non_financial" ? "too_few_inputs" : "not_applicable_financial";
  return {
    scoreId,
    value: { v: null, reason, flags: 0 },
    band: null,
    criteria: [],
    evaluable: 0,
    total,
    caveats: [SCORE_FOOTER_CAVEAT],
    methodologyVersion: "2026.1",
  };
}

export const explainPiotroski: ExplainScore = (store, i) => notEvaluated(store, i, "piotroski_f", 9);
export const explainAltman: ExplainScore = (store, i) => notEvaluated(store, i, "altman_z", 4);

const LEGACY_NUMERIC_KEYS = Object.keys(LEGACY_KEY_TO_METRIC) as LegacyNumericKey[];

/** v0 snapshot rows for legacy consumers (old Screener, demo provider tests). Missing numbers are NaN. */
export function toStockRows(store: MetricStore): StockRow[] {
  const rows: StockRow[] = [];
  for (let i = 0; i < store.size; i++) {
    const c = store.company(i);
    const row = { symbol: c.symbol, name: c.name, sector: c.sector, industry: store.industry(i) } as StockRow;
    for (const key of LEGACY_NUMERIC_KEYS) {
      const v = store.get(LEGACY_KEY_TO_METRIC[key], i).v;
      row[key] = v === null ? Number.NaN : v;
    }
    rows.push(row);
  }
  return rows;
}
