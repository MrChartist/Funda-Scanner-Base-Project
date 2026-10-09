// src/lib/query/errors.ts — every FSQL diagnostic message (WS4, §D.9).
// Formal Indian English. Messages describe the query, never the person ("Unknown metric", not "You typed").
import type { IssueCode, MetricDef, QueryIssue, Span, Suggestion, Unit } from "@/lib/contracts";
import { FUNCTION_NAMES } from "./ast";

export function levelOf(code: IssueCode): QueryIssue["level"] {
  return code.startsWith("E_") ? "error" : code.startsWith("W_") ? "warning" : "info";
}

export function issue(code: IssueCode, message: string, span: Span, suggestions: Suggestion[] = []): QueryIssue {
  return { code, level: levelOf(code), message, span: { start: span.start, end: span.end }, suggestions };
}

/** Orders issues by position, then errors before warnings before info. */
export function sortIssues(issues: QueryIssue[]): QueryIssue[] {
  const rank = { error: 0, warning: 1, info: 2 } as const;
  return issues
    .map((x, k) => ({ x, k }))
    .sort((a, b) => a.x.span.start - b.x.span.start || rank[a.x.level] - rank[b.x.level] || a.k - b.k)
    .map(({ x }) => x);
}

// ── lexical ─────────────────────────────────────────────────────────────────
export const MSG = {
  emptyQuery: "The expression is empty. Enter a metric or a calculation, for example roce or net_profit / sales.",
  unexpectedChar: (ch: string) => `The character '${ch}' cannot be used in a query.`,
  rupeeChar: "The character '₹' cannot be used in a query. Amounts are already in ₹ crore; write 500 or 500cr.",
  ampersand: "The character '&' cannot be used in a query. Write AND to join conditions.",
  pipe: "The character '|' cannot be used in a query. Write OR for alternatives.",
  unterminatedString: "This text has no closing quote.",
  unterminatedBacktick: "This name has no closing backtick (`).",
  badNumber: (text: string) => `'${text}' is not a valid number.`,
  fractionalPeriod: (text: string) => `'${text}' is not a valid period. Periods are whole numbers, for example 5y.`,
  commaInNumber: "Commas cannot be used inside numbers in a query. Write 100000, 1_00_000 or 1 lakh.",
  unknownSuffix: (num: string, word: string) =>
    `Unknown unit '${word}' after ${num}. Use %, x, cr, crore, k or lakh, or leave a space before a word.`,

  // ── syntax ──
  unexpectedEnd: (after: string | null) =>
    after ? `The query ends too early. A value is expected after '${after}'.` : "The query ends too early.",
  unbalancedOpen: "This '(' has no matching ')'.",
  unbalancedClose: "This ')' has no matching '('.",
  unexpectedToken: (text: string) => `'${text}' is not expected here.`,
  valueExpectedAfter: (text: string, after: string) => `'${text}' is not expected here. A value is expected after '${after}'.`,
  unexpectedAfterValue: (text: string) =>
    `'${text}' is not expected here. Join conditions with AND or OR, or start a new line.`,
  leftoverWords: (rest: string, used: string, label: string) =>
    `'${rest}' is not understood after '${used}' (${label}).`,
  durationOutsideWindow: (text: string) =>
    `A period such as ${text} can be used only as the last input of a window function, for example avg(roce, 5y).`,
  betweenNeedsAnd: "BETWEEN needs AND between its two limits, for example roe BETWEEN 15 AND 25.",
  inNeedsText: "IN takes a list of text values in quotes, for example sector IN (\"Cement\", \"Pharma\").",
  chained: "Comparisons cannot be chained. Use BETWEEN for a range.",
  reservedWord: (word: string) => {
    const w = word.toUpperCase();
    if (w === "FROM") return "FROM is not used in queries. Use the Universe selector above the query.";
    if (w === "RANK") return "RANK is not a clause. Use SORT BY rank(x).";
    if (w === "TOP") return "TOP is not available. Use SORT BY with LIMIT, for example SORT BY roce DESC LIMIT 20.";
    if (w === "SELECT") return "SELECT is not used. Choose columns with the column picker.";
    if (w === "GROUP") return "GROUP is not available in this version.";
    return `${w} is reserved for a later version of the query language.`;
  },
  tooLong: (max: number) => `The query is too long. Keep it under ${max} characters.`,
  tooManyClauses: (max: number) => `The query has too many conditions. Keep it to ${max} or fewer.`,
  tooDeep: (max: number) => `The query is nested too deeply. Keep brackets and functions to ${max} levels.`,
  limitRange: "LIMIT must be between 1 and 1000.",
  badTypeWord: (word: string) =>
    `'${word}' is not a company type. Use bank, nbfc, insurer, lender, financial, non_financial, consolidated or standalone.`,
  orderOnlyInRank: "ASC and DESC can be used inside rank() or after a SORT BY item only.",

  // ── names ──
  unknownMetric: (written: string, best: string | null) =>
    best ? `Unknown metric "${written}". Did you mean ${best}?` : `Unknown metric "${written}".`,
  ambiguousMetric: (written: string) => `"${written}" could mean more than one metric. Choose one of the suggestions.`,
  lastYear:
    "'last year' is ambiguous here. Write sales[fy] for the latest financial year or sales[prev] for the year before.",
  unknownFunction: (name: string) => `Unknown function '${name}'. Available: ${FUNCTION_NAMES.join(", ")}.`,
  backtickUnknown: (written: string) =>
    `Unknown metric \`${written}\`. Inside backticks, write a metric's exact name or alias.`,

  // ── selectors ──
  badSelector: (text: string) =>
    `Unknown period selector '${text}'. Use [fy], [fy-1], [ttm], [ttm-1], [q], [q-1] or [prev].`,
  selectorOnExpression: "A period selector such as [prev] can follow a metric only, not a calculation.",
  noTtm: (d: MetricDef) => `${d.short} has no TTM form. Use ${d.id} for the latest financial year.`,
  quarterOnAnnual: (d: MetricDef) => `${d.short} is reported yearly. Use [fy-1] or [prev] instead of a quarter selector.`,
  annualOnQuarterly: (d: MetricDef) => `${d.short} is reported by quarter. Use [q-1] or [prev] instead.`,
  selectorInWindow: (fn: string, sel: string) => `Inside ${fn}(), metrics are read year by year; remove ${sel}.`,

  // ── types and periods ──
  boolExpected: (name: string, example: string) => `'${name}' is a number. Compare it with something, for example ${example}.`,
  boolExpectedArg: (fn: string) => `${fn}() needs a condition as its first input, for example ${fn}(roce > 15, 5y).`,
  numberExpected: (what: string) => `${what} is a condition, not a number. Use a metric or a calculation here.`,
  sortNeedsNumber: "SORT BY needs a number, for example SORT BY roce_avg_5y DESC.",
  textComparison: (field: string) =>
    `${field} is text. Check it with =, != or IN against text in quotes, for example ${field.toLowerCase()} = "Cement".`,
  textWithNumber: "Text in quotes can be compared only with sector, industry, symbol or name.",
  unitMismatch: (label: string, unit: Unit | "pctl", suffix: string, fix: string, written: string) =>
    `${label} is ${unitPhrase(unit)}, not ${suffixPhrase(suffix)}. Write ${fix}, not ${written}.`,
  windowRequired: (fn: string) => `${fn}() needs a period as its last input, for example ${fn}(${fn === "every" || fn === "any" || fn === "count" ? "roce > 15" : "roce"}, 5y).`,
  windowRange: "The period must be between 2 and 15 years.",
  quarterWindow: (text: string) => `Quarterly windows such as ${text} are not available yet. Use years, for example 5y.`,
  noHistoryPrice: (d: MetricDef) =>
    `${d.short} has no yearly history because past prices are not stored. Use earnings growth or ROCE instead.`,
  noHistoryLatest: (d: MetricDef) => `${d.short} is a single latest value with no stored history, so a period cannot be chosen for it.`,
  noHistoryQuarterly: (d: MetricDef, fn: string) =>
    `${d.short} is reported by quarter; inside ${fn}() metrics are read financial year by financial year.`,
  peerInWindow: (peerFn: string, fn: string) =>
    `${peerFn}() cannot be used inside ${fn}(), because peer values are calculated for the latest period only.`,
  rankOutsideSort: "rank() can be used only after SORT BY, for example SORT BY rank(roce) + rank(earnings_yield) ASC.",
  notGrowthable: (d: MetricDef, n: number) =>
    `CAGR suits amounts and per-share values, not ratios such as ${d.short}. Compare ${d.id} with ${d.id}[fy-${n}] instead.`,
  notGrowthableExpr: "CAGR can be calculated only for a single amount or per-share metric, for example cagr(sales, 5y).",
  wrongArgs: (fn: string): string => {
    switch (fn) {
      case "avg": case "median": case "sum": case "stdev": case "cagr":
        return `${fn}() needs two inputs: a metric and a period, for example ${fn}(${fn === "cagr" ? "sales" : "roce"}, 5y).`;
      case "every": case "any": case "count":
        return `${fn}() needs two inputs: a condition and a period, for example ${fn}(roce > 15, 5y).`;
      case "min": case "max":
        return `${fn}() needs either a metric and a period, for example ${fn}(roce, 5y), or two or more values, for example ${fn}(roce, roe).`;
      case "streak": return "streak() needs one condition, for example streak(dps > 0).";
      case "growth": return "growth() needs two values, for example growth(q_sales[q], q_sales[q-4]).";
      case "abs": return "abs() needs one value, for example abs(exceptional_items).";
      case "has": return "has() needs one metric, for example has(gross_margin).";
      case "rank": return "rank() needs one value and, optionally, ASC or DESC, for example rank(roce) or rank(pe, ASC).";
      default: return `${fn}() needs one value, for example ${fn}(roce).`;
    }
  },

  // ── warnings and info ──
  likelyFraction: (label: string, v: number) =>
    `${label} is stored in percent. Did you mean ${trimNumber(v * 100)} instead of ${trimNumber(v)}?`,
  mixedUnits: "This adds or subtracts an amount in ₹ crore and a percentage; the result may not mean much.",
  notApplicable: (label: string, families: string, counts: string) =>
    `${label} does not apply to ${families}; ${counts} in your data will not be evaluated.`,
  lowCoverage: (what: string, have: number, of: number) =>
    `Only ${have} of ${of} applicable companies in your data have a value for ${what}.`,
  noCoverageRef: (what: string) => `No company in your data has a value for ${what}.`,
  noCoverageHistory: (text: string) =>
    `Your data does not have enough yearly history, so ${text} cannot be calculated for any company.`,
  noCoverageExpr: (text: string) => `${text} cannot be calculated for any company in your data.`,
  implicitAnd: "A new line is read as AND.",
  orderBy: "ORDER BY is read as SORT BY.",
  leadingWhere: "A leading WHERE is not needed and is ignored.",
  defaultPeriod: (d: MetricDef) =>
    `${d.short} here means the latest financial year. Write ${d.id}[ttm] for the trailing twelve months.`,
} as const;

export function trimNumber(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  const r = Math.round(v * 1e9) / 1e9;
  return String(r);
}

export function unitPhrase(unit: Unit | "pctl"): string {
  switch (unit) {
    case "pct": return "a percentage (%)";
    case "pp": return "a change in percentage points";
    case "x": return "a multiple (x)";
    case "inr_cr": return "an amount in ₹ crore";
    case "inr": return "an amount in ₹ per share";
    case "days": return "a number of days";
    case "years": return "a number of years";
    case "count": return "a count";
    case "score": return "a score";
    case "crore_shares": return "a number of shares in crore";
    case "fy_year": return "a financial year";
    case "pctl": return "a percentile (0 to 100)";
  }
}

export function suffixPhrase(suffix: string): string {
  switch (suffix) {
    case "%": return "a percentage";
    case "x": return "a multiple";
    default: return "an amount in ₹ crore";
  }
}
