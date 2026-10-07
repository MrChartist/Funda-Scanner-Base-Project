// src/lib/screen/funnel.ts — per-clause funnel with drop-one counts (§D.12 step 4) and skipped groups (step 6).
import type {
  CompiledQuery, FunnelStep, MetricId, MetricStore, NullReason, QueryEvaluation, SkippedGroup, TypeFamily,
} from "@/lib/contracts";
import { NULL_REASONS, TRI_FALSE, TRI_TRUE, TRI_UNKNOWN } from "@/lib/contracts";
import { nullReasonText } from "@/lib/format/metric-value";
import { cachedMetricColumn } from "@/lib/query";

export function buildFunnel(compiled: CompiledQuery, ev: QueryEvaluation): FunnelStep[] {
  const C = compiled.clauses.length;
  const m = ev.rows.length;
  if (!compiled.ok || C === 0) return [];
  const passed = new Array<number>(C).fill(0);
  const failed = new Array<number>(C).fill(0);
  const unknown = new Array<number>(C).fill(0);
  const remaining = new Array<number>(C).fill(0);
  const dropOne = new Array<number>(C).fill(0);
  for (let r = 0; r < m; r++) {
    let trueCount = 0;
    let notTrue = -1;
    let prefixTrue = true;
    for (let c = 0; c < C; c++) {
      const t = ev.clauseTri[c][r];
      if (t === TRI_TRUE) {
        passed[c]++;
        trueCount++;
      } else {
        if (t === TRI_FALSE) failed[c]++;
        else unknown[c]++;
        notTrue = c;
        prefixTrue = false;
      }
      if (prefixTrue) remaining[c]++;
    }
    if (trueCount === C) for (let c = 0; c < C; c++) dropOne[c]++;
    else if (trueCount === C - 1 && notTrue >= 0) dropOne[notTrue]++;
  }
  let strictest = -1;
  for (let c = 0; c < C; c++) if (failed[c] > 0 && (strictest < 0 || failed[c] > failed[strictest])) strictest = c;
  return compiled.clauses.map((clause, c) => ({
    clause: c,
    text: clause.text,
    english: clause.english,
    passed: passed[c],
    failed: failed[c],
    unknown: unknown[c],
    remainingAfter: remaining[c],
    dropOneMatches: dropOne[c],
    strictest: c === strictest,
  }));
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function metricList(store: MetricStore, ids: readonly MetricId[]): string {
  return ids.map((id) => store.def(id)?.short ?? id).join(", ");
}

/** Companies where WHERE is unknown, grouped by the reason of their first unknown clause (and family for N/A). */
export function groupSkipped(compiled: CompiledQuery, ev: QueryEvaluation, store: MetricStore): SkippedGroup[] {
  if (!compiled.ok || compiled.clauses.length === 0) return [];
  const groups = new Map<string, { reason: NullReason; clause: number; members: number[]; families: Set<TypeFamily> }>();
  for (let r = 0; r < ev.rows.length; r++) {
    if (ev.whereTri[r] !== TRI_UNKNOWN) continue;
    let c = 0;
    while (c < compiled.clauses.length && ev.clauseTri[c][r] !== TRI_UNKNOWN) c++;
    if (c >= compiled.clauses.length) continue;
    const code = ev.clauseReason[c][r];
    const reason = (code > 0 && code < NULL_REASONS.length ? NULL_REASONS[code] : "missing_input") as NullReason;
    const i = ev.rows[r];
    const family = store.family(i);
    const key = reason === "not_applicable_financial" ? `${reason}|${family}|${c}` : reason;
    let g = groups.get(key);
    if (!g) {
      g = { reason, clause: c, members: [], families: new Set() };
      groups.set(key, g);
    }
    g.members.push(i);
    g.families.add(family);
  }
  const out: SkippedGroup[] = [];
  for (const g of groups.values()) {
    const n = g.members.length;
    const family = g.families.size === 1 ? [...g.families][0] : null;
    const clauseMetrics = compiled.clauses[g.clause].metrics;
    let metrics: MetricId[];
    if (g.reason === "not_applicable_financial") {
      metrics = clauseMetrics.filter((id) => {
        const d = store.def(id);
        return d !== undefined && family !== null && !d.appliesTo.includes(family);
      });
    } else {
      metrics = clauseMetrics.filter((id) => {
        try {
          const col = cachedMetricColumn(store, id);
          return g.members.some((i) => !(col.reasons[i] === 0 && Number.isFinite(col.values[i])));
        } catch {
          return false;
        }
      });
    }
    if (metrics.length === 0) metrics = [...clauseMetrics];
    const names = metricList(store, metrics) || "this rule";
    let message: string;
    switch (g.reason) {
      case "not_applicable_financial":
        if (family === "lender") message = `${plural(n, "lender", "lenders")} not evaluated: ${names} does not apply to banks and NBFCs`;
        else if (family === "insurance") message = `${plural(n, "insurer", "insurers")} not evaluated: ${names} does not apply to insurers`;
        else message = `${plural(n, "company", "companies")} not evaluated: ${names} applies only to banks and NBFCs`;
        break;
      case "missing_input":
        message = `${plural(n, "company", "companies")} skipped: data not provided (${names})`;
        break;
      case "insufficient_history":
        message = `${plural(n, "company", "companies")} skipped: not enough history for ${names}`;
        break;
      default:
        message = `${plural(n, "company", "companies")} skipped: ${nullReasonText(g.reason, family).short.toLowerCase()} (${names})`;
    }
    out.push({ reason: g.reason, count: n, family, metrics, message });
  }
  return out.sort((a, b) => b.count - a.count || (a.message < b.message ? -1 : 1));
}
