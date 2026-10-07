// src/lib/query/index.ts — public API of FSQL (WS4).
// P0 STUB: understands only `metric_id op number` clauses joined by AND (or by new lines).
// Anything else is reported as E_UNEXPECTED_TOKEN (E_UNKNOWN_METRIC for an unknown id).
// WS4 replaces every body here with the full language in §D; the exported types are final.
import type {
  ChipModel, ClauseExplanation, CmpOp, CompileQuery, CompiledClause, CompletionItem, EvaluateExpression,
  EvaluateQuery, ExplainClause, Expr, FromChips, MetricDef, PrintQuery, QueryAst, QueryIssue,
  SimpleClause, Span, SuggestAt, ToChips, Tri,
} from "@/lib/contracts";
import { NULL_REASONS, TRI_FALSE, TRI_TRUE, TRI_UNKNOWN } from "@/lib/contracts";
import { formatUnitValue } from "@/lib/format/metric-value";

const END_NOTE = "Companies with missing data are not counted as matches.";
const NIC_CODE = NULL_REASONS.indexOf("no_interest_cost");

const OP_WORD: Readonly<Record<CmpOp | "between", string>> = {
  ">": "above", ">=": "at least", "<": "below", "<=": "at most", "=": "equal to", "!=": "not equal to", between: "between",
};

function normaliseOp(op: string): CmpOp | null {
  switch (op) {
    case ">": case ">=": case "<": case "<=": case "=": case "!=": return op;
    case "==": return "=";
    case "<>": return "!=";
    default: return null;
  }
}

/**
 * Splits the source into clauses at new lines and top-level AND keywords, keeping character
 * offsets. A `#` comment runs to the end of its line and is dropped before splitting, so words
 * inside a comment (such as "and") never create clauses.
 */
function splitClauses(source: string): { text: string; start: number }[] {
  const parts: { text: string; start: number }[] = [];
  let lineStart = 0;
  for (const rawLine of source.split("\n")) {
    const commentAt = rawLine.indexOf("#");
    const line = (commentAt >= 0 ? rawLine.slice(0, commentAt) : rawLine).replace(/\r$/, "");
    const re = /\s+and\s+/gi;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      parts.push({ text: line.slice(last, m.index), start: lineStart + last });
      last = m.index + m[0].length;
    }
    parts.push({ text: line.slice(last), start: lineStart + last });
    lineStart += rawLine.length + 1;
  }
  return parts
    .map((p) => {
      const lead = p.text.length - p.text.trimStart().length;
      return { text: p.text.trim(), start: p.start + lead };
    })
    .filter((p) => p.text.length > 0);
}

const CLAUSE_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*(>=|<=|!=|<>|==|>|<|=)\s*(-?(?:\d+(?:\.\d+)?|\.\d+))$/;

function decimalsOf(literal: string): number {
  const dot = literal.indexOf(".");
  return dot < 0 ? 0 : literal.length - dot - 1;
}

function unitText(def: MetricDef, value: number): string {
  return formatUnitValue(def.unit, Math.max(def.decimals, decimalsOf(String(value))), value);
}

function clauseEnglish(def: MetricDef, op: CmpOp, value: number): string {
  return `${def.short} (${def.periodTag}) is ${OP_WORD[op]} ${unitText(def, value)}`;
}

function wholeEnglish(clauses: readonly CompiledClause[]): string {
  if (clauses.length === 0) return `All companies. ${END_NOTE}`;
  const body = clauses.map((c) => c.english).join(", and ");
  return `${body.charAt(0).toUpperCase()}${body.slice(1)}. ${END_NOTE}`;
}

function span(start: number, end: number): Span {
  return { start, end };
}

export const compileQuery: CompileQuery = (source, store) => {
  const issues: QueryIssue[] = [];
  const clauses: CompiledClause[] = [];
  for (const part of splitClauses(source)) {
    const sp = span(part.start, part.start + part.text.length);
    const m = CLAUSE_RE.exec(part.text);
    if (!m) {
      issues.push({
        code: "E_UNEXPECTED_TOKEN", level: "error", span: sp, suggestions: [],
        message: "This part of the query cannot be read yet. Write one condition per line, for example roce > 15.",
      });
      continue;
    }
    const metric = m[1].toLowerCase();
    const def = store.def(metric);
    if (!def) {
      issues.push({
        code: "E_UNKNOWN_METRIC", level: "error", span: span(part.start, part.start + m[1].length), suggestions: [],
        message: `Unknown metric "${m[1]}".`,
      });
      continue;
    }
    const op = normaliseOp(m[2]);
    const value = Number(m[3]);
    if (!op || !Number.isFinite(value)) {
      issues.push({ code: "E_UNEXPECTED_TOKEN", level: "error", span: sp, suggestions: [], message: "This condition cannot be read." });
      continue;
    }
    const ref: Expr = { k: "ref", metric, written: m[1], selector: null, span: span(part.start, part.start + m[1].length) };
    const num: Expr = { k: "num", value, suffix: null, span: span(part.start + part.text.lastIndexOf(m[3]), sp.end) };
    const ast: Expr = { k: "cmp", op, l: ref, r: num, span: sp };
    const simple: SimpleClause = { metric, selector: null, op, value, value2: null };
    clauses.push({
      index: clauses.length, ast, span: sp, text: `${metric} ${op} ${m[3]}`, english: clauseEnglish(def, op, value),
      metrics: [metric], simple,
    });
  }
  const ok = !issues.some((i) => i.level === "error");
  const where: Expr | null = clauses.length === 0 ? null
    : clauses.length === 1 ? clauses[0].ast
      : { k: "and", items: clauses.map((c) => c.ast), implicit: clauses.map(() => false), span: span(0, source.length) };
  const ast: QueryAst = { where, sort: [], limit: null, span: span(0, source.length) };
  const metrics = [...new Set(clauses.map((c) => c.metrics[0]))];
  return {
    ok,
    source,
    canonical: clauses.map((c) => c.text).join(" AND "),
    ast: ok ? ast : null,
    clauses: ok ? clauses : [],
    sort: [],
    limit: null,
    metrics,
    issues,
    english: ok ? wholeEnglish(clauses) : "",
  };
};

function compare(op: CmpOp, a: number, b: number, decimals: number): boolean {
  const tol = 0.5 * Math.pow(10, -decimals);
  switch (op) {
    case ">": return a > b;
    case ">=": return a >= b;
    case "<": return a < b;
    case "<=": return a <= b;
    case "=": return Math.abs(a - b) <= tol;
    case "!=": return Math.abs(a - b) > tol;
  }
}

/** NIC exception (§D.7): no_interest_cost compares as +∞. */
function compareInfinity(op: CmpOp): boolean {
  return op === ">" || op === ">=" || op === "!=";
}

export const evaluateQuery: EvaluateQuery = (query, store, rows) => {
  const n = rows.length;
  const whereTri = new Uint8Array(n).fill(query.ok ? TRI_TRUE : TRI_UNKNOWN);
  const clauseTri: Uint8Array[] = [];
  const clauseReason: Uint8Array[] = [];
  const clauseLhs: Float64Array[] = [];
  const clauseRhs: Float64Array[] = [];
  if (!query.ok) return { rows, clauseTri, clauseReason, clauseLhs, clauseRhs, whereTri };
  for (const clause of query.clauses) {
    const simple = clause.simple;
    const tri = new Uint8Array(n);
    const reason = new Uint8Array(n);
    const lhs = new Float64Array(n).fill(Number.NaN);
    const rhs = new Float64Array(n).fill(Number.NaN);
    if (simple && simple.op !== "between") {
      const col = store.column(simple.metric);
      const def = store.def(simple.metric);
      const literal = clause.text.slice(clause.text.lastIndexOf(" ") + 1); // the number as written
      const decimals = Math.max(def?.decimals ?? 0, decimalsOf(literal));
      for (let r = 0; r < n; r++) {
        const i = rows[r];
        rhs[r] = simple.value;
        const code = col.reasons[i];
        if (code === 0 && Number.isFinite(col.values[i])) {
          lhs[r] = col.values[i];
          tri[r] = compare(simple.op, col.values[i], simple.value, decimals) ? TRI_TRUE : TRI_FALSE;
        } else if (code === NIC_CODE) {
          tri[r] = compareInfinity(simple.op) ? TRI_TRUE : TRI_FALSE;
          reason[r] = code;
        } else {
          tri[r] = TRI_UNKNOWN;
          reason[r] = code || 1;
        }
      }
    } else {
      tri.fill(TRI_UNKNOWN);
      reason.fill(NULL_REASONS.indexOf("missing_input"));
    }
    for (let r = 0; r < n; r++) {
      const w = whereTri[r] as Tri;
      const t = tri[r] as Tri;
      whereTri[r] = w === TRI_FALSE || t === TRI_FALSE ? TRI_FALSE : w === TRI_UNKNOWN || t === TRI_UNKNOWN ? TRI_UNKNOWN : TRI_TRUE;
    }
    clauseTri.push(tri);
    clauseReason.push(reason);
    clauseLhs.push(lhs);
    clauseRhs.push(rhs);
  }
  return { rows, clauseTri, clauseReason, clauseLhs, clauseRhs, whereTri };
};

export const explainClause: ExplainClause = (query, evaluation, clause, storeIndex, store) => {
  const c = query.clauses[clause];
  const r = evaluation.rows.indexOf(storeIndex);
  const result: Tri = r >= 0 && evaluation.clauseTri[clause] ? (evaluation.clauseTri[clause][r] as Tri) : TRI_UNKNOWN;
  const lhsRaw = r >= 0 ? evaluation.clauseLhs[clause]?.[r] : Number.NaN;
  const rhsRaw = r >= 0 ? evaluation.clauseRhs[clause]?.[r] : Number.NaN;
  const lhs = lhsRaw !== undefined && Number.isFinite(lhsRaw) ? lhsRaw : null;
  const rhs = rhsRaw !== undefined && Number.isFinite(rhsRaw) ? rhsRaw : null;
  const code = r >= 0 ? evaluation.clauseReason[clause]?.[r] ?? 0 : 0;
  const reasonName = code > 0 ? NULL_REASONS[code] : null;
  const reason = reasonName && reasonName !== "none" ? reasonName : null;
  const def = c?.simple ? store.def(c.simple.metric) : undefined;
  let detail = c?.english ?? "";
  let gap: number | null = null;
  let gapText: string | null = null;
  if (def && c?.simple && c.simple.op !== "between") {
    const shown = lhs === null ? "—" : unitText(def, lhs);
    detail = `${def.short} · ${shown}; needs ${OP_WORD[c.simple.op]} ${unitText(def, c.simple.value)}`;
    if (result === TRI_FALSE && lhs !== null && rhs !== null) {
      gap = (rhs - lhs) / Math.max(Math.abs(rhs), 1e-9);
      if (c.simple.op === "<" || c.simple.op === "<=") gap = -gap;
      const diff = Math.abs(rhs - lhs);
      gapText = def.unit === "pct" || def.unit === "pp"
        ? `${formatUnitValue("pp", def.decimals, diff).replace(/^\+/, "").replace(/ pp$/, "")} points short`
        : `${unitText(def, diff)} short`;
    }
  }
  const explanation: ClauseExplanation = {
    clause, result, english: c?.english ?? "", detail, lhs, rhs, periods: null, peer: null, reason, gap, gapText,
  };
  return explanation;
};

export const evaluateExpression: EvaluateExpression = (source, store) => {
  const id = source.trim().toLowerCase();
  if (/^[a-z][a-z0-9_]*$/.test(id) && store.def(id)) return { column: store.column(id), issues: [] };
  return {
    column: null,
    issues: [{
      code: "E_UNEXPECTED_TOKEN", level: "error", span: span(0, source.length), suggestions: [],
      message: "Only a single metric id can be used as a column in this build.",
    }],
  };
};

export const suggestAt: SuggestAt = (source, cursor, store) => {
  const at = Math.max(0, Math.min(cursor, source.length));
  let start = at;
  while (start > 0 && /[A-Za-z0-9_]/.test(source.charAt(start - 1))) start--;
  const prefix = source.slice(start, at).toLowerCase();
  const items: CompletionItem[] = [];
  for (const d of store.defs()) {
    if (items.length >= 20) break;
    if (prefix && !d.id.startsWith(prefix)) continue;
    if (!prefix && d.variant !== null) continue;
    items.push({ kind: "metric", label: d.short, insert: d.id, detail: `${d.unit} · ${d.category}`, doc: d.tooltip });
  }
  return { span: span(start, at), items };
};

export const toChips: ToChips = (query) => {
  if (!query.ok) {
    return { chips: [{ kind: "advanced", id: "c0", text: query.source, english: "" }], tail: "" };
  }
  return {
    chips: query.clauses.map((c) =>
      c.simple
        ? { kind: "simple" as const, id: `c${c.index}`, metric: c.simple.metric, selector: c.simple.selector, op: c.simple.op,
          value: String(c.simple.value), value2: c.simple.value2 === null ? "" : String(c.simple.value2) }
        : { kind: "advanced" as const, id: `c${c.index}`, text: c.text, english: c.english }),
    tail: "",
  };
};

export const fromChips: FromChips = (model: ChipModel) => {
  const lines = model.chips.map((chip) => {
    switch (chip.kind) {
      case "simple":
        return chip.op === "between"
          ? `${chip.metric} BETWEEN ${chip.value} AND ${chip.value2}`
          : `${chip.metric} ${chip.op} ${chip.value}`;
      case "type":
        return `IS ${chip.negated ? "NOT " : ""}${chip.test}`;
      case "advanced":
        return chip.text;
    }
  });
  if (model.tail.trim()) lines.push(model.tail.trim());
  return lines.join("\n");
};

function printExpr(e: Expr): string {
  switch (e.k) {
    case "num": return String(e.value);
    case "str": return JSON.stringify(e.value);
    case "ref": {
      if (!e.selector) return e.metric;
      const s = e.selector;
      const sel = s.kind === "prev" ? "prev" : s.offset === 0 ? s.kind : `${s.kind}-${s.offset}`;
      return `${e.metric}[${sel}]`;
    }
    case "text": return e.field;
    case "call": {
      const args = e.args.map(printExpr);
      if (e.window) args.push(`${e.window.n}${e.window.unit}`);
      if (e.order) args.push(e.order.toUpperCase());
      return `${e.fn}(${args.join(", ")})`;
    }
    case "neg": return `-${printExpr(e.arg)}`;
    case "bin": return `(${printExpr(e.l)} ${e.op} ${printExpr(e.r)})`;
    case "cmp": return `${printExpr(e.l)} ${e.op} ${printExpr(e.r)}`;
    case "between": return `${printExpr(e.x)} ${e.negated ? "NOT " : ""}BETWEEN ${printExpr(e.lo)} AND ${printExpr(e.hi)}`;
    case "in": return `${printExpr(e.x)} ${e.negated ? "NOT " : ""}IN (${e.items.map((s) => JSON.stringify(s)).join(", ")})`;
    case "and": return e.items.map((x) => (x.k === "or" ? `(${printExpr(x)})` : printExpr(x))).join(" AND ");
    case "or": return e.items.map(printExpr).join(" OR ");
    case "not": return `NOT ${e.arg.k === "and" || e.arg.k === "or" ? `(${printExpr(e.arg)})` : printExpr(e.arg)}`;
    case "is": return `IS ${e.negated ? "NOT " : ""}${e.test}`;
    case "error": return "";
  }
}

export const printQuery: PrintQuery = (ast) => {
  const parts: string[] = [];
  if (ast.where) parts.push(printExpr(ast.where));
  if (ast.sort.length) parts.push(`SORT BY ${ast.sort.map((s) => `${printExpr(s.expr)} ${s.dir.toUpperCase()}`).join(", ")}`);
  if (ast.limit !== null) parts.push(`LIMIT ${ast.limit}`);
  return parts.join(" ");
};
