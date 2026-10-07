// src/lib/screen/near-miss.ts — companies that fail exactly one clause (§D.12 step 5).
import type { CompiledQuery, Expr, MetricStore, NearMiss, QueryEvaluation } from "@/lib/contracts";
import { TRI_FALSE, TRI_TRUE } from "@/lib/contracts";
import { explainClause } from "@/lib/query";
import { evaluateBoolNode } from "@/lib/query";

export const MAX_NEAR_MISSES = 50;

/** The yearly fold inside a clause (every/any, or count()/streak() compared with a number), if any. */
function foldOf(e: Expr): Extract<Expr, { k: "call" }> | null {
  if (e.k === "call" && (e.fn === "every" || e.fn === "any") && e.window) return e;
  if (e.k === "cmp" && e.l.k === "call" && e.l.fn === "count" && e.l.window) return e.l;
  return null;
}

export function findNearMisses(
  compiled: CompiledQuery, ev: QueryEvaluation, store: MetricStore, compareDefault: (a: number, b: number) => number,
): NearMiss[] {
  const C = compiled.clauses.length;
  if (!compiled.ok || C === 0) return [];
  const candidates: { r: number; i: number; clause: number; lhs: number | null; rhs: number | null; relGap: number | null }[] = [];
  for (let r = 0; r < ev.rows.length; r++) {
    let failedClause = -1;
    let ok = true;
    for (let c = 0; c < C && ok; c++) {
      const t = ev.clauseTri[c][r];
      if (t === TRI_TRUE) continue;
      if (t === TRI_FALSE && failedClause < 0) failedClause = c;
      else ok = false;
    }
    if (!ok || failedClause < 0) continue;
    const lhs = ev.clauseLhs[failedClause][r];
    const rhs = ev.clauseRhs[failedClause][r];
    const both = Number.isFinite(lhs) && Number.isFinite(rhs);
    candidates.push({
      r, i: ev.rows[r], clause: failedClause, lhs: Number.isFinite(lhs) ? lhs : null, rhs: Number.isFinite(rhs) ? rhs : null,
      relGap: both ? Math.abs(lhs - rhs) / Math.max(Math.abs(rhs), 1e-9) : null,
    });
  }
  // Window folds: the share of years that failed is the gap (computed once per clause).
  const foldYears = new Map<number, { t: Uint8Array }[]>();
  for (const cand of candidates) {
    if (cand.relGap !== null) continue;
    const fold = foldOf(compiled.clauses[cand.clause].ast);
    if (!fold || !fold.window) continue;
    let years = foldYears.get(cand.clause);
    if (!years) {
      years = Array.from({ length: fold.window.n }, (_, k) => evaluateBoolNode(fold.args[0], store, compiled.source, k));
      foldYears.set(cand.clause, years);
    }
    const failedYears = years.filter((y) => y.t[cand.i] === TRI_FALSE).length;
    cand.relGap = fold.fn === "any" ? 1 : failedYears / years.length;
  }
  candidates.sort((a, b) => {
    if (a.relGap !== null && b.relGap !== null && a.relGap !== b.relGap) return a.relGap - b.relGap;
    if ((a.relGap === null) !== (b.relGap === null)) return a.relGap === null ? 1 : -1;
    return compareDefault(a.i, b.i);
  });
  return candidates.slice(0, MAX_NEAR_MISSES).map((cand) => {
    const ex = explainClause(compiled, ev, cand.clause, cand.i, store);
    let gapText: string;
    if (ex.periods && ex.gapText) gapText = ex.gapText;
    else if (ex.gapText) gapText = `${ex.detail.replace("; needs", ", needs")} (${ex.gapText})`;
    else gapText = ex.detail || compiled.clauses[cand.clause].english;
    return { index: cand.i, clause: cand.clause, lhs: cand.lhs, rhs: cand.rhs, relGap: cand.relGap, gapText };
  });
}
