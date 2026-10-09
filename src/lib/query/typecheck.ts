// src/lib/query/typecheck.ts — types, units, periods and scopes (§D.5–§D.8).
import type { Expr, MetricDef, MetricStore, QueryAst, QueryIssue, Unit } from "@/lib/contracts";
import { isWindowCall, literalNode, PEER_FNS, WINDOW_MAX, WINDOW_MIN } from "./ast";
import { issue, MSG, trimNumber } from "./errors";
import { printExpr, printSelector } from "./print";

export type UnitTag = Unit | "pctl";
export type ValueType = "bool" | "num" | "text" | "str" | "err";

export interface TypeInfo {
  t: ValueType;
  unit: UnitTag | null;
  /** Display name for messages ("ROCE"), and the full label ("Return on capital employed"). */
  short: string | null;
  label: string | null;
}

interface Ctx {
  /** Innermost window function, when inside one. */
  window: string | null;
  sort: boolean;
  inRank: boolean;
}

const TOP: Ctx = { window: null, sort: false, inRank: false };
const ERR: TypeInfo = { t: "err", unit: null, short: null, label: null };
const BOOL: TypeInfo = { t: "bool", unit: null, short: null, label: null };

const PRICE_LINKED: ReadonlySet<string> = new Set(["market_cap", "price", "enterprise_value", "dividend_yield"]);

export function isPriceLinked(d: MetricDef): boolean {
  return d.category === "Valuation" || PRICE_LINKED.has(d.base) || PRICE_LINKED.has(d.id);
}

export function suffixUnit(suffix: string | null): UnitTag | null {
  if (suffix === "%") return "pct";
  if (suffix === "x") return "x";
  if (suffix === "cr" || suffix === "k" || suffix === "lakh") return "inr_cr";
  return null;
}

export function suffixCompatible(unit: UnitTag, suffix: string): boolean {
  if (suffix === "%") return unit === "pct" || unit === "pp" || unit === "pctl";
  if (suffix === "x") return unit === "x";
  return unit === "inr_cr";
}

/** Unit of a numeric expression, or null when it cannot be stated (no issues are reported). */
export function unitOf(e: Expr, store: MetricStore): UnitTag | null {
  switch (e.k) {
    case "num": return suffixUnit(e.suffix);
    case "ref": return store.def(e.metric)?.unit ?? null;
    case "neg": return unitOf(e.arg, store);
    case "bin": {
      const l = unitOf(e.l, store);
      const r = unitOf(e.r, store);
      if (e.op === "+" || e.op === "-") return l ?? r;
      if (e.op === "*") return e.l.k === "num" && !e.l.suffix ? r : e.r.k === "num" && !e.r.suffix ? l : null;
      return e.r.k === "num" && !e.r.suffix ? l : null;
    }
    case "call":
      switch (e.fn) {
        case "abs": case "min": case "max": case "avg": case "median": case "sum":
        case "sector_median": case "industry_median":
          return e.args[0] ? unitOf(e.args[0], store) : null;
        case "stdev": {
          const u = e.args[0] ? unitOf(e.args[0], store) : null;
          return u === "pct" ? "pp" : u;
        }
        case "cagr": case "growth": return "pct";
        case "pctl": case "sector_pctl": case "industry_pctl": return "pctl";
        case "count": return "count";
        case "streak": return "years";
        default: return null;
      }
    default: return null;
  }
}

export interface CheckResult {
  issues: QueryIssue[];
}

export class Checker {
  readonly issues: QueryIssue[] = [];
  private readonly defaultPeriodSeen = new Set<string>();

  constructor(private readonly store: MetricStore, private readonly source: string) {}

  private report(code: QueryIssue["code"], message: string, e: { span: { start: number; end: number } }, suggestions: QueryIssue["suggestions"] = []): void {
    this.issues.push(issue(code, message, e.span, suggestions));
  }

  private text(e: Expr): string {
    return this.source.slice(e.span.start, e.span.end) || printExpr(e);
  }

  checkQuery(ast: QueryAst): void {
    if (ast.where) this.requireBool(this.check(ast.where, TOP), ast.where);
    for (const s of ast.sort) {
      const info = this.check(s.expr, { ...TOP, sort: true });
      if (info.t !== "num" && info.t !== "err") this.report("E_TYPE_NUMBER_EXPECTED", MSG.sortNeedsNumber, s.expr);
    }
  }

  checkNumeric(e: Expr): TypeInfo {
    const info = this.check(e, TOP);
    if (info.t !== "num" && info.t !== "err") this.report("E_TYPE_NUMBER_EXPECTED", MSG.numberExpected(`'${this.text(e)}'`), e);
    return info;
  }

  private requireBool(info: TypeInfo, e: Expr): void {
    if (info.t === "bool" || info.t === "err") return;
    if (info.t === "num") {
      const name = info.short ?? this.text(e);
      this.report("E_TYPE_BOOL_EXPECTED", MSG.boolExpected(name, `${name} > ${info.unit === "x" ? "1" : "15"}`), e);
    } else {
      this.report("E_TYPE_BOOL_EXPECTED", MSG.boolExpected(this.text(e), `${this.text(e)} = "Cement"`), e);
    }
  }

  private requireNum(info: TypeInfo, e: Expr): boolean {
    if (info.t === "num" || info.t === "err") return info.t === "num";
    if (info.t === "bool") this.report("E_TYPE_NUMBER_EXPECTED", MSG.numberExpected(`'${this.text(e)}'`), e);
    else this.report("E_TEXT_COMPARISON", info.t === "text" ? MSG.textComparison(info.short ?? "Sector") : MSG.textWithNumber, e);
    return false;
  }

  check(e: Expr, ctx: Ctx): TypeInfo {
    switch (e.k) {
      case "error": return ERR;
      case "num": return { t: "num", unit: suffixUnit(e.suffix), short: null, label: null };
      case "str": return { t: "str", unit: null, short: null, label: null };
      case "text": {
        const name = e.field[0].toUpperCase() + e.field.slice(1);
        return { t: "text", unit: null, short: name, label: name };
      }
      case "is": return BOOL;
      case "ref": return this.checkRef(e, ctx);
      case "neg": {
        const a = this.check(e.arg, ctx);
        if (!this.requireNum(a, e.arg)) return a.t === "err" ? ERR : { ...ERR };
        return { t: "num", unit: a.unit, short: null, label: null };
      }
      case "bin": return this.checkBin(e, ctx);
      case "cmp": return this.checkCmp(e, ctx);
      case "between": {
        const x = this.check(e.x, ctx);
        const lo = this.check(e.lo, ctx);
        const hi = this.check(e.hi, ctx);
        if (x.t === "text") {
          this.report("E_TEXT_COMPARISON", MSG.textComparison(x.short ?? "Sector"), e);
          return BOOL;
        }
        this.requireNum(x, e.x);
        this.requireNum(lo, e.lo);
        this.requireNum(hi, e.hi);
        if (x.t === "num") {
          this.checkLiteral(e.lo, x, true);
          this.checkLiteral(e.hi, x, true);
        }
        return BOOL;
      }
      case "in": {
        const x = this.check(e.x, ctx);
        if (x.t !== "text" && x.t !== "err") this.report("E_TEXT_COMPARISON", MSG.textWithNumber, e.x);
        return BOOL;
      }
      case "and":
      case "or":
        for (const item of e.items) this.requireBool(this.check(item, ctx), item);
        return BOOL;
      case "not":
        this.requireBool(this.check(e.arg, ctx), e.arg);
        return BOOL;
      case "call": return this.checkCall(e, ctx);
    }
  }

  private checkRef(e: Extract<Expr, { k: "ref" }>, ctx: Ctx): TypeInfo {
    const d = this.store.def(e.metric);
    if (!d) return ERR;
    const info: TypeInfo = { t: "num", unit: d.unit, short: d.short, label: d.label };
    const sel = e.selector;
    if (ctx.window) {
      if (d.history !== "annual") {
        let msg: string;
        if (d.history === "latest_only") msg = isPriceLinked(d) ? MSG.noHistoryPrice(d) : MSG.noHistoryLatest(d);
        else msg = MSG.noHistoryQuarterly(d, ctx.window);
        this.report("E_NO_HISTORY", msg, e);
      } else if (sel && sel.kind !== "prev") {
        this.report("E_SELECTOR_IN_WINDOW", MSG.selectorInWindow(ctx.window, printSelector(sel)), e, [
          { label: `Remove ${printSelector(sel)}`, replacement: e.metric },
        ]);
      }
      return info;
    }
    if (!sel) {
      if (d.history === "annual" && d.ttm && d.variant === null && !this.defaultPeriodSeen.has(d.id)) {
        this.defaultPeriodSeen.add(d.id);
        this.report("I_DEFAULT_PERIOD", MSG.defaultPeriod(d), e);
      }
      return info;
    }
    if (d.history === "latest_only") {
      this.report("E_NO_HISTORY", isPriceLinked(d) ? MSG.noHistoryPrice(d) : MSG.noHistoryLatest(d), e);
      return info;
    }
    if (d.history === "annual") {
      if (sel.kind === "q") this.report("E_BAD_SELECTOR", MSG.quarterOnAnnual(d), e);
      else if (sel.kind === "ttm" && !d.ttm) this.report("E_BAD_SELECTOR", MSG.noTtm(d), e, [{ label: d.id, replacement: d.id }]);
    } else if (sel.kind === "fy" || sel.kind === "ttm") {
      this.report("E_BAD_SELECTOR", MSG.annualOnQuarterly(d), e);
    }
    return info;
  }

  private checkBin(e: Extract<Expr, { k: "bin" }>, ctx: Ctx): TypeInfo {
    const l = this.check(e.l, ctx);
    const r = this.check(e.r, ctx);
    const lok = this.requireNum(l, e.l);
    const rok = this.requireNum(r, e.r);
    if (!lok || !rok) return l.t === "err" || r.t === "err" ? ERR : { t: "num", unit: null, short: null, label: null };
    if (e.op === "+" || e.op === "-") {
      this.checkLiteral(e.l, r, false);
      this.checkLiteral(e.r, l, false);
      const lu = l.unit;
      const ru = r.unit;
      const money = (u: UnitTag | null) => u === "inr_cr";
      const pct = (u: UnitTag | null) => u === "pct" || u === "pp";
      if ((money(lu) && pct(ru)) || (pct(lu) && money(ru))) this.report("W_MIXED_UNITS", MSG.mixedUnits, e);
    }
    return { t: "num", unit: unitOf(e, this.store), short: null, label: null };
  }

  private checkCmp(e: Extract<Expr, { k: "cmp" }>, ctx: Ctx): TypeInfo {
    const l = this.check(e.l, ctx);
    const r = this.check(e.r, ctx);
    if (l.t === "err" || r.t === "err") return BOOL;
    if (l.t === "text" || r.t === "text") {
      const field = l.t === "text" ? l : r;
      const other = l.t === "text" ? r : l;
      if (other.t !== "str" || (e.op !== "=" && e.op !== "!=")) {
        this.report("E_TEXT_COMPARISON", MSG.textComparison(field.short ?? "Sector"), e);
      }
      return BOOL;
    }
    if (l.t === "str" || r.t === "str") {
      this.report("E_TEXT_COMPARISON", MSG.textWithNumber, e);
      return BOOL;
    }
    const lok = this.requireNum(l, e.l);
    const rok = this.requireNum(r, e.r);
    if (lok && rok) {
      this.checkLiteral(e.r, l, true);
      this.checkLiteral(e.l, r, true);
    }
    return BOOL;
  }

  /** Unit check of a literal (`n` or `-n`) against the other side (§D.8). */
  private checkLiteral(lit: Expr, other: TypeInfo, comparison: boolean): void {
    const node = literalNode(lit);
    if (!node || other.t !== "num" || other.unit === null) return;
    if (node.suffix && !suffixCompatible(other.unit, node.suffix)) {
      const sign = lit.k === "neg" ? -1 : 1;
      let fixValue = node.value;
      if (node.suffix === "%" && other.unit === "x") fixValue = node.value / 100;
      if (node.suffix === "k" || node.suffix === "lakh") fixValue = node.value;
      const fix = trimNumber(sign * fixValue);
      const written = this.text(lit);
      this.report("E_UNIT_MISMATCH", MSG.unitMismatch(other.label ?? "This value", other.unit, node.suffix, fix, written), lit, [
        { label: `Write ${fix}`, replacement: fix },
      ]);
      return;
    }
    if (comparison && !node.suffix && other.unit === "pct" && lit.k === "num" && node.value > 0 && node.value < 1) {
      const fixed = trimNumber(node.value * 100);
      this.report("W_LIKELY_FRACTION", MSG.likelyFraction(other.short ?? "This value", node.value), lit, [
        { label: `Write ${fixed}`, replacement: fixed },
      ]);
    }
  }

  private checkCall(e: Extract<Expr, { k: "call" }>, ctx: Ctx): TypeInfo {
    const fn = e.fn;
    const n = e.args.length;
    const wrongArgs = (): TypeInfo => {
      this.report("E_WRONG_ARG_COUNT", MSG.wrongArgs(fn), e);
      return ERR;
    };
    const num = (unit: UnitTag | null): TypeInfo => ({ t: "num", unit, short: null, label: null });

    if (fn === "rank") {
      if (!ctx.sort || ctx.inRank) {
        this.report("E_RANK_OUTSIDE_SORT", MSG.rankOutsideSort, e);
        return ERR;
      }
      if (n !== 1 || e.window) return wrongArgs();
      this.requireNum(this.check(e.args[0], { ...ctx, inRank: true }), e.args[0]);
      return num(null);
    }
    if (PEER_FNS.has(fn)) {
      if (ctx.window) {
        this.report("E_PEER_IN_WINDOW", MSG.peerInWindow(fn, ctx.window), e);
        return ERR;
      }
      if (n !== 1 || e.window) return wrongArgs();
      const a = this.check(e.args[0], ctx);
      this.requireNum(a, e.args[0]);
      return num(fn.endsWith("pctl") ? "pctl" : a.unit);
    }
    // Window forms.
    if (isWindowCall(e)) {
      if (fn === "streak") {
        if (n !== 1 || e.window) return wrongArgs();
        const a = this.check(e.args[0], { ...ctx, window: fn });
        if (a.t !== "bool" && a.t !== "err") this.report("E_TYPE_BOOL_EXPECTED", MSG.boolExpectedArg(fn), e.args[0]);
        return num("years");
      }
      if (!e.window) {
        if (n === 1) {
          this.report("E_WINDOW_REQUIRED", MSG.windowRequired(fn), e);
          return ERR;
        }
        return wrongArgs();
      }
      if (n !== 1) return wrongArgs();
      if (e.window.n < WINDOW_MIN || e.window.n > WINDOW_MAX || !Number.isInteger(e.window.n)) {
        this.report("E_WINDOW_RANGE", MSG.windowRange, e);
      }
      const inner: Ctx = { ...ctx, window: fn };
      const a = this.check(e.args[0], inner);
      if (fn === "every" || fn === "any" || fn === "count") {
        if (a.t !== "bool" && a.t !== "err") {
          this.report("E_TYPE_BOOL_EXPECTED", MSG.boolExpectedArg(fn), e.args[0]);
          return ERR;
        }
        return fn === "count" ? num("count") : BOOL;
      }
      if (!this.requireNum(a, e.args[0])) return ERR;
      if (fn === "cagr") {
        const arg = e.args[0];
        if (arg.k === "ref") {
          const d = this.store.def(arg.metric);
          if (d && !d.growthable) this.report("E_NOT_GROWTHABLE", MSG.notGrowthable(d, e.window.n), e);
        } else {
          this.report("E_NOT_GROWTHABLE", MSG.notGrowthableExpr, e);
        }
        return num("pct");
      }
      return num(unitOf(e, this.store));
    }
    if (e.window) return wrongArgs();
    switch (fn) {
      case "min":
      case "max": {
        if (n < 2) {
          if (n === 1) {
            this.report("E_WINDOW_REQUIRED", MSG.wrongArgs(fn), e);
            return ERR;
          }
          return wrongArgs();
        }
        let unit: UnitTag | null = null;
        for (const a of e.args) {
          const info = this.check(a, ctx);
          this.requireNum(info, a);
          unit = unit ?? info.unit;
        }
        return num(unit);
      }
      case "abs": {
        if (n !== 1) return wrongArgs();
        const a = this.check(e.args[0], ctx);
        this.requireNum(a, e.args[0]);
        return num(a.unit);
      }
      case "growth": {
        if (n !== 2) return wrongArgs();
        for (const a of e.args) this.requireNum(this.check(a, ctx), a);
        return num("pct");
      }
      case "has": {
        if (n !== 1) return wrongArgs();
        this.requireNum(this.check(e.args[0], ctx), e.args[0]);
        return BOOL;
      }
      default:
        return wrongArgs();
    }
  }
}
