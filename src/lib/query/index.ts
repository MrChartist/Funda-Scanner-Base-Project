// src/lib/query/index.ts — public API of FSQL, the Funda Scanner Query Language (WS4, spec §D).
import type { EvaluateExpression } from "@/lib/contracts";
import { DEFAULT_LIMITS } from "./compile";
import { sortIssues } from "./errors";
import { evaluateNumericNode } from "./evaluate";
import { lex } from "./lexer";
import { nameIndexFor } from "./names";
import { parseExpressionSource } from "./parser";
import { printExpr } from "./print";
import { Checker } from "./typecheck";

export { compileQuery, simpleClauseOf, topLevelClauses, DEFAULT_LIMITS } from "./compile";
export {
  evaluateQuery, evaluateSortKeys, cachedColumnCount, cachedMetricColumn, evaluateBoolNode, evaluateNumericNode,
} from "./evaluate";
export { explainClause, RESULT_WORD } from "./explain";
export { printQuery, printExpr, printClause, printSelector, printNumber, printTail } from "./print";
export { toChips, fromChips, chipText, isChipComplete } from "./chips";
export { suggestAt, FUNCTION_DOCS } from "./suggest";
export { END_NOTE, clauseEnglish, metricName } from "./english";
export { FUNCTION_NAMES, TYPE_TESTS } from "./ast";
export { collisions, nameIndexFor, normalisePhrase } from "./names";

/** True when the source has `#` comments (chip mode then shows "Comments are kept only in Query mode."). */
export function hasComments(source: string): boolean {
  return lex(source).hasComments;
}

/** Evaluates a numeric expression for every company (expression columns, custom formulas later). */
export const evaluateExpression: EvaluateExpression = (source, store) => {
  const parsed = parseExpressionSource(source, nameIndexFor(store), { maxDepth: DEFAULT_LIMITS.maxDepth, store });
  const issues = [...parsed.issues];
  if (!parsed.expr) return { column: null, issues: sortIssues(issues) };
  const checker = new Checker(store, source);
  checker.checkNumeric(parsed.expr);
  issues.push(...checker.issues);
  if (issues.some((x) => x.level === "error")) return { column: null, issues: sortIssues(issues) };
  const col = evaluateNumericNode(parsed.expr, store, source);
  const id = parsed.expr.k === "ref" && !parsed.expr.selector ? parsed.expr.metric : printExpr(parsed.expr);
  return { column: { ...col, id }, issues: sortIssues(issues) };
};
