// src/lib/query/parser.ts — FSQL v1 recursive-descent parser (§D.2, §D.3) with error recovery (§D.9).
// After an error the parser inserts an `error` node and skips to the next AND, OR or new line at
// depth 0, so several errors are reported in one pass. Metric names are resolved here (§D.4).
import type { CmpOp, Expr, QueryAst, QueryIssue, Selector, SortItem, Span, Suggestion, TypeTest, Window } from "@/lib/contracts";
import { isFnName, isTypeTest } from "./ast";
import { issue, MSG } from "./errors";
import { lex, type Token } from "./lexer";
import {
  isKnownWord, normaliseToken, resolveExact, resolvePhrase, suggestionFor, suggestMetrics, type NameIndex, type Resolution,
} from "./names";
import type { MetricStore } from "@/lib/contracts";

/** Recoverable parse failure: the issue has already been recorded (or came from the lexer). */
class Fail extends Error {}
/** Unrecoverable: nesting too deep. */
class Fatal extends Error {}

const PHRASE_END_WORDS: ReadonlySet<string> = new Set(["and", "or", "not", "between", "sort", "limit", "asc", "desc"]);
const NOT_A_VALUE_WORDS: ReadonlySet<string> = new Set(["and", "or", "between", "sort", "limit", "asc", "desc", "by", "not"]);
const RESERVED_WORDS: ReadonlySet<string> = new Set(["let", "from", "top", "select", "group", "rank"]);
const TEXT_FIELD_WORDS: ReadonlySet<string> = new Set(["sector", "industry", "symbol", "name"]);
const CMP_OPS: Readonly<Record<string, CmpOp>> = {
  ">": ">", ">=": ">=", "<": "<", "<=": "<=", "=": "=", "==": "=", "!=": "!=", "<>": "!=",
};

export interface ParseOptions {
  maxDepth: number;
  /** For suggestions (coverage bonus); optional. */
  store?: MetricStore | null;
}

export interface ParseResult {
  ast: QueryAst | null;
  issues: QueryIssue[];
  hasComments: boolean;
}

class Parser {
  pos = 0;
  nest = 0;
  depth = 0;
  readonly issues: QueryIssue[] = [];

  constructor(
    private readonly toks: Token[],
    private readonly index: NameIndex,
    private readonly source: string,
    private readonly opts: ParseOptions,
  ) {}

  // ── token helpers ──
  peek(k = 0): Token {
    return this.toks[Math.min(this.pos + k, this.toks.length - 1)];
  }
  at(j: number): Token {
    return this.toks[Math.min(j, this.toks.length - 1)];
  }
  next(): Token {
    const t = this.peek();
    if (t.kind !== "eof") this.pos++;
    return t;
  }
  prev(): Token | null {
    return this.pos > 0 ? this.toks[this.pos - 1] : null;
  }
  isKw(t: Token, word: string): boolean {
    return t.kind === "ident" && t.word === word;
  }
  isOp(t: Token, op: string): boolean {
    return t.kind === "op" && t.text === op;
  }
  span(t: Token): Span {
    return { start: t.start, end: t.end };
  }
  report(code: QueryIssue["code"], message: string, span: Span, suggestions: Suggestion[] = []): void {
    this.issues.push(issue(code, message, span, suggestions));
  }
  fail(code: QueryIssue["code"], message: string, span: Span, suggestions: Suggestion[] = []): never {
    this.report(code, message, span, suggestions);
    throw new Fail();
  }
  enter(): void {
    this.depth++;
    if (this.depth > this.opts.maxDepth) throw new Fatal();
  }
  leave(): void {
    this.depth--;
  }

  isSortStart(j = this.pos): boolean {
    const t = this.at(j);
    return (this.isKw(t, "sort") && this.isKw(this.at(j + 1), "by")) || (this.isKw(t, "order") && this.isKw(this.at(j + 1), "by"));
  }
  isTailStart(j = this.pos): boolean {
    return this.isSortStart(j) || this.isKw(this.at(j), "limit");
  }
  /** Tokens that end an AND chain without being an error. */
  isChainStop(t: Token): boolean {
    return t.kind === "eof" || this.isKw(t, "or") || this.isOp(t, ")") || this.isOp(t, ",") || this.isTailStart();
  }
  canEndOperand(t: Token | null): boolean {
    if (!t) return false;
    return t.kind === "num" || t.kind === "str" || t.kind === "ident" || t.kind === "dur" || t.kind === "backtick"
      || this.isOp(t, ")") || this.isOp(t, "]");
  }
  canStartPredicate(t: Token): boolean {
    if (t.kind === "num" || t.kind === "str" || t.kind === "backtick") return true;
    if (this.isOp(t, "(") || this.isOp(t, "-")) return true;
    if (t.kind === "ident") return !["and", "or", "between", "sort", "limit", "asc", "desc", "by"].includes(t.word);
    return false;
  }

  /** Skips to the next AND, OR, new line or tail keyword at depth 0 (or the enclosing ")" / ","). */
  skipToSync(startPos: number): void {
    let depth = 0;
    let guard = 0;
    while (guard++ < 100000) {
      const t = this.peek();
      if (t.kind === "eof") return;
      if (depth === 0) {
        if (this.isKw(t, "and") || this.isKw(t, "or")) return;
        if (this.nest === 0 && t.nlBefore && this.pos > startPos) return;
        if (this.isTailStart()) return;
        if (this.nest > 0 && (this.isOp(t, ")") || this.isOp(t, ","))) return;
      }
      if (this.isOp(t, "(") || this.isOp(t, "[")) depth++;
      else if ((this.isOp(t, ")") || this.isOp(t, "]")) && depth > 0) depth--;
      this.next();
    }
  }

  errorNode(start: number, end: number): Expr {
    return { k: "error", span: { start, end: Math.max(start, end) } };
  }

  // ── query ──
  parseQuery(): QueryAst {
    const first = this.peek();
    if (this.isKw(first, "where")) {
      this.next();
      this.report("I_KEYWORD_SYNONYM", MSG.leadingWhere, this.span(first));
    }
    let where: Expr | null = null;
    if (this.peek().kind !== "eof" && !this.isTailStart()) where = this.parseOr();
    // Junk at the top level (a stray ")" or a token that cannot follow a value).
    let guard = 0;
    while (this.peek().kind !== "eof" && !this.isTailStart() && guard++ < 10000) {
      const t = this.peek();
      if (this.isKw(t, "and") || this.isKw(t, "or")) {
        const isOr = this.isKw(t, "or");
        this.next();
        const more = this.parseOr();
        where = where ? combine(isOr ? "or" : "and", where, more) : more;
        continue;
      }
      if (t.kind !== "bad") {
        if (this.isOp(t, ")")) this.report("E_UNBALANCED_PAREN", MSG.unbalancedClose, this.span(t));
        else this.report("E_UNEXPECTED_TOKEN", MSG.unexpectedAfterValue(t.text), this.span(t));
      }
      const before = this.pos;
      this.next();
      this.skipToSync(before);
      if (this.peek().kind !== "eof" && !this.isTailStart() && this.canStartPredicate(this.peek())
        && !this.isKw(this.peek(), "and") && !this.isKw(this.peek(), "or")) {
        const more = this.parseOr();
        where = where ? combine("and", where, more) : more;
      }
    }
    const sort = this.isSortStart() ? this.parseSort() : [];
    let limit: number | null = null;
    if (this.isKw(this.peek(), "limit")) limit = this.parseLimit();
    const rest = this.peek();
    if (rest.kind !== "eof") {
      if (rest.kind !== "bad") this.report("E_UNEXPECTED_TOKEN", MSG.unexpectedToken(rest.text), this.span(rest));
      while (this.peek().kind !== "eof") this.next();
    }
    return { where, sort, limit, span: { start: 0, end: this.source.length } };
  }

  parseSort(): SortItem[] {
    const kw = this.next();
    const by = this.next();
    if (this.isKw(kw, "order")) this.report("I_KEYWORD_SYNONYM", MSG.orderBy, { start: kw.start, end: by.end });
    const items: SortItem[] = [];
    let guard = 0;
    while (guard++ < 1000) {
      const startTok = this.peek();
      const startPos = this.pos;
      const depth0 = this.depth;
      try {
        if (startTok.kind === "eof") this.fail("E_UNEXPECTED_END", MSG.unexpectedEnd(this.prev()?.text ?? null), this.span(this.prev() ?? startTok));
        const expr = this.parseAdd();
        let dir: "asc" | "desc" = "desc";
        let end = expr.span.end;
        const d = this.peek();
        if (this.isKw(d, "asc") || this.isKw(d, "desc")) {
          this.next();
          dir = d.word === "asc" ? "asc" : "desc";
          end = d.end;
        }
        items.push({ expr, dir, span: { start: expr.span.start, end } });
      } catch (e) {
        if (!(e instanceof Fail)) throw e;
        this.depth = depth0;
        this.nest++;
        this.skipToSync(startPos);
        this.nest--;
        items.push({ expr: this.errorNode(startTok.start, this.prev()?.end ?? startTok.end), dir: "desc", span: { start: startTok.start, end: this.prev()?.end ?? startTok.end } });
      }
      if (this.isOp(this.peek(), ",")) {
        this.next();
        continue;
      }
      const t = this.peek();
      if (t.kind === "eof" || this.isKw(t, "limit")) break;
      if (t.kind !== "bad") this.report("E_UNEXPECTED_TOKEN", MSG.unexpectedToken(t.text), this.span(t));
      while (this.peek().kind !== "eof" && !this.isKw(this.peek(), "limit") && !this.isOp(this.peek(), ",")) this.next();
      if (this.isOp(this.peek(), ",")) {
        this.next();
        continue;
      }
      break;
    }
    return items;
  }

  parseLimit(): number | null {
    const kw = this.next();
    const t = this.peek();
    if (t.kind === "eof") {
      this.report("E_UNEXPECTED_END", MSG.unexpectedEnd(kw.text), this.span(kw));
      return null;
    }
    if (t.kind !== "num") {
      if (t.kind !== "bad") this.report("E_UNEXPECTED_TOKEN", MSG.limitRange, this.span(t));
      this.next();
      return null;
    }
    this.next();
    if (t.suffix !== null || !Number.isInteger(t.value) || t.value < 1 || t.value > 1000) {
      this.report("E_LIMIT_RANGE", MSG.limitRange, this.span(t));
      return null;
    }
    return t.value;
  }

  // ── boolean layers ──
  parseOr(): Expr {
    const items = [this.parseAnd()];
    while (this.isKw(this.peek(), "or")) {
      this.next();
      items.push(this.parseAnd());
    }
    if (items.length === 1) return items[0];
    return { k: "or", items, span: { start: items[0].span.start, end: items[items.length - 1].span.end } };
  }

  parseAnd(): Expr {
    const items: Expr[] = [this.parseItem()];
    const implicit: boolean[] = [];
    let guard = 0;
    while (guard++ < 100000) {
      const t = this.peek();
      if (this.isKw(t, "and")) {
        this.next();
        implicit.push(false);
        items.push(this.parseItem());
        continue;
      }
      if (this.nest === 0 && t.nlBefore && this.canEndOperand(this.prev()) && this.canStartPredicate(t) && !this.isTailStart()) {
        this.report("I_IMPLICIT_AND", MSG.implicitAnd, { start: t.start, end: t.start });
        implicit.push(true);
        items.push(this.parseItem());
        continue;
      }
      if (this.isChainStop(t)) break;
      // Junk after a complete operand: report it and fold the clause into an error node.
      if (t.kind !== "bad") this.report("E_UNEXPECTED_TOKEN", MSG.unexpectedAfterValue(t.text), this.span(t));
      const last = items.pop() as Expr;
      const before = this.pos;
      this.skipToSync(before);
      if (this.pos === before) this.next();
      items.push(this.errorNode(last.span.start, this.prev()?.end ?? t.end));
    }
    if (items.length === 1) return items[0];
    return { k: "and", items, implicit, span: { start: items[0].span.start, end: items[items.length - 1].span.end } };
  }

  parseItem(): Expr {
    const startPos = this.pos;
    const startTok = this.peek();
    const depth0 = this.depth;
    try {
      return this.parseNot();
    } catch (e) {
      if (!(e instanceof Fail)) throw e;
      this.depth = depth0;
      this.skipToSync(startPos);
      const end = this.pos > startPos ? (this.prev()?.end ?? startTok.end) : startTok.start;
      return this.errorNode(startTok.start, end);
    }
  }

  parseNot(): Expr {
    const t = this.peek();
    if (this.isKw(t, "not")) {
      this.next();
      this.enter();
      const arg = this.parseNot();
      this.leave();
      return { k: "not", arg, span: { start: t.start, end: arg.span.end } };
    }
    return this.parsePredicate();
  }

  parsePredicate(): Expr {
    const t = this.peek();
    if (this.isKw(t, "is") && (this.isKw(this.peek(1), "not") || this.peek(1).kind === "ident")) return this.parseIs();
    if (t.kind === "ident" && RESERVED_WORDS.has(t.word) && !(t.word === "rank" && this.isOp(this.peek(1), "("))) {
      this.fail("E_RESERVED_WORD", MSG.reservedWord(t.text), this.span(t));
    }
    const left = this.parseAdd();
    const opTok = this.peek();
    const op = opTok.kind === "op" ? CMP_OPS[opTok.text] : undefined;
    if (op) {
      this.next();
      const right = this.parseAdd();
      const opTok2 = this.peek();
      if (opTok2.kind === "op" && CMP_OPS[opTok2.text]) {
        this.next();
        const third = this.parseAdd();
        const span = { start: left.span.start, end: third.span.end };
        const lo = this.source.slice(left.span.start, left.span.end);
        const mid = this.source.slice(right.span.start, right.span.end);
        const hi = this.source.slice(third.span.start, third.span.end);
        const ascending = (op === "<" || op === "<=") && (CMP_OPS[opTok2.text] === "<" || CMP_OPS[opTok2.text] === "<=");
        const descending = (op === ">" || op === ">=") && (CMP_OPS[opTok2.text] === ">" || CMP_OPS[opTok2.text] === ">=");
        const fix = ascending ? `${mid} BETWEEN ${lo} AND ${hi}` : descending ? `${mid} BETWEEN ${hi} AND ${lo}` : null;
        this.report("E_CHAINED_COMPARISON", MSG.chained, span, fix ? [{ label: `Write ${fix}`, replacement: fix }] : []);
        return this.errorNode(span.start, span.end);
      }
      return { k: "cmp", op, l: left, r: right, span: { start: left.span.start, end: right.span.end } };
    }
    let negated = false;
    if (this.isKw(opTok, "not") && (this.isKw(this.peek(1), "between") || (this.isKw(this.peek(1), "in") && this.isOp(this.peek(2), "(")))) {
      this.next();
      negated = true;
    }
    const kw = this.peek();
    if (this.isKw(kw, "between")) {
      this.next();
      const lo = this.parseAdd();
      const andTok = this.peek();
      if (!this.isKw(andTok, "and")) {
        if (andTok.kind === "eof") this.fail("E_UNEXPECTED_END", MSG.betweenNeedsAnd, this.span(kw));
        this.fail("E_UNEXPECTED_TOKEN", MSG.betweenNeedsAnd, this.span(andTok));
      }
      this.next();
      const hi = this.parseAdd();
      return { k: "between", x: left, lo, hi, negated, span: { start: left.span.start, end: hi.span.end } };
    }
    if (this.isKw(kw, "in") && this.isOp(this.peek(1), "(")) {
      this.next();
      const open = this.next();
      const items: string[] = [];
      let guard = 0;
      while (guard++ < 10000) {
        const s = this.peek();
        if (s.kind !== "str") {
          if (s.kind === "eof") this.fail("E_UNBALANCED_PAREN", MSG.unbalancedOpen, this.span(open));
          if (s.kind === "bad") throw new Fail();
          this.fail("E_UNEXPECTED_TOKEN", MSG.inNeedsText, this.span(s));
        }
        this.next();
        items.push(s.word);
        if (this.isOp(this.peek(), ",")) {
          this.next();
          continue;
        }
        if (this.isOp(this.peek(), ")")) break;
        if (this.peek().kind === "eof") this.fail("E_UNBALANCED_PAREN", MSG.unbalancedOpen, this.span(open));
        this.fail("E_UNEXPECTED_TOKEN", MSG.inNeedsText, this.span(this.peek()));
      }
      const close = this.next();
      return { k: "in", x: left, items, negated, span: { start: left.span.start, end: close.end } };
    }
    return left;
  }

  parseIs(): Expr {
    const kw = this.next();
    let negated = false;
    if (this.isKw(this.peek(), "not")) {
      this.next();
      negated = true;
    }
    const w = this.peek();
    if (w.kind !== "ident" || !isTypeTest(w.word)) {
      if (w.kind === "eof") this.fail("E_UNEXPECTED_END", MSG.unexpectedEnd(this.prev()?.text ?? null), this.span(this.prev() ?? kw));
      if (w.kind === "bad") throw new Fail();
      this.fail("E_UNEXPECTED_TOKEN", MSG.badTypeWord(w.text), this.span(w));
    }
    this.next();
    return { k: "is", test: w.word as TypeTest, negated, span: { start: kw.start, end: w.end } };
  }

  // ── arithmetic layers ──
  parseAdd(): Expr {
    let left = this.parseMul();
    while (this.isOp(this.peek(), "+") || this.isOp(this.peek(), "-")) {
      const op = this.next().text as "+" | "-";
      const right = this.parseMul();
      left = { k: "bin", op, l: left, r: right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  }

  parseMul(): Expr {
    let left = this.parseUnary();
    while (this.isOp(this.peek(), "*") || this.isOp(this.peek(), "/")) {
      const op = this.next().text as "*" | "/";
      const right = this.parseUnary();
      left = { k: "bin", op, l: left, r: right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  }

  parseUnary(): Expr {
    const t = this.peek();
    if (this.isOp(t, "-")) {
      this.next();
      this.enter();
      const arg = this.parseUnary();
      this.leave();
      return { k: "neg", arg, span: { start: t.start, end: arg.span.end } };
    }
    return this.parsePostfix();
  }

  parsePostfix(): Expr {
    const e = this.parsePrimary();
    if (!this.isOp(this.peek(), "[")) return e;
    return this.parseSelector(e);
  }

  parseSelector(e: Expr): Expr {
    const open = this.next();
    // Find the closing bracket on the same stretch of tokens, for spans and recovery.
    let j = this.pos;
    while (this.at(j).kind !== "eof" && !this.isOp(this.at(j), "]") && !this.isOp(this.at(j), "[") && j - this.pos < 8) j++;
    const closeTok = this.isOp(this.at(j), "]") ? this.at(j) : null;
    const end = closeTok ? closeTok.end : this.at(j - 1).end;
    const text = this.source.slice(open.start, end);
    const bad = (): Expr => {
      if (!closeTok) this.fail("E_BAD_SELECTOR", MSG.badSelector(text), { start: open.start, end });
      this.report("E_BAD_SELECTOR", MSG.badSelector(text), { start: open.start, end });
      this.pos = j + 1;
      return this.errorNode(e.span.start, end);
    };
    const kTok = this.peek();
    if (kTok.kind !== "ident" || !["fy", "ttm", "q", "prev"].includes(kTok.word)) return bad();
    this.next();
    let offset = 0;
    if (kTok.word !== "prev" && this.isOp(this.peek(), "-")) {
      this.next();
      const num = this.peek();
      if (num.kind !== "num" || num.suffix !== null || !Number.isInteger(num.value) || num.value < 0 || num.value > 99) return bad();
      this.next();
      offset = num.value;
    }
    if (!this.isOp(this.peek(), "]")) return bad();
    const close = this.next();
    const selector: Selector = kTok.word === "prev" ? { kind: "prev" } : { kind: kTok.word as "fy" | "ttm" | "q", offset };
    if (e.k !== "ref") {
      if (e.k !== "error") this.report("E_BAD_SELECTOR", MSG.selectorOnExpression, { start: open.start, end: close.end });
      return this.errorNode(e.span.start, close.end);
    }
    return { ...e, selector, span: { start: e.span.start, end: close.end } };
  }

  parsePrimary(): Expr {
    const t = this.peek();
    switch (t.kind) {
      case "num":
        this.next();
        return { k: "num", value: t.value, suffix: t.suffix, span: this.span(t) };
      case "str":
        this.next();
        return { k: "str", value: t.word, span: this.span(t) };
      case "backtick": {
        this.next();
        return this.refFrom(resolveExact(this.index, t.word), [t], t.word, true);
      }
      case "dur":
        this.fail("E_UNEXPECTED_TOKEN", MSG.durationOutsideWindow(t.text), this.span(t));
        break;
      case "bad":
        throw new Fail();
      case "eof": {
        const p = this.prev();
        this.fail("E_UNEXPECTED_END", MSG.unexpectedEnd(p?.text ?? null), p ? this.span(p) : this.span(t));
        break;
      }
      case "op": {
        if (this.isOp(t, "(")) {
          this.next();
          this.nest++;
          this.enter();
          let inner: Expr;
          try {
            inner = this.parseOr();
          } finally {
            this.nest--;
            this.leave();
          }
          const close = this.peek();
          if (this.isOp(close, ")")) {
            this.next();
            return inner;
          }
          if (close.kind === "eof" || this.isTailStart()) {
            this.report("E_UNBALANCED_PAREN", MSG.unbalancedOpen, this.span(t));
            return inner;
          }
          if (close.kind === "bad") throw new Fail();
          this.fail("E_UNEXPECTED_TOKEN", MSG.unexpectedToken(close.text), this.span(close));
        }
        const p = this.prev();
        if (p && p.kind === "op" && p.text !== ")" && p.text !== "]") {
          this.fail("E_UNEXPECTED_TOKEN", MSG.valueExpectedAfter(t.text, p.text), this.span(t));
        }
        if (this.isOp(t, ")") && this.nest === 0) this.fail("E_UNBALANCED_PAREN", MSG.unbalancedClose, this.span(t));
        this.fail("E_UNEXPECTED_TOKEN", MSG.unexpectedToken(t.text), this.span(t));
        break;
      }
      case "ident":
        return this.parseIdent(t);
    }
    throw new Fail();
  }

  parseIdent(t: Token): Expr {
    const after = this.peek(1);
    if (this.isOp(after, "(") && (!after.spaceBefore || isFnName(t.word))) return this.parseCall();
    if (NOT_A_VALUE_WORDS.has(t.word) || (t.word === "in" && this.isOp(after, "("))) {
      const p = this.prev();
      if (p && p.kind === "op" && p.text !== ")" && p.text !== "]") {
        this.fail("E_UNEXPECTED_TOKEN", MSG.valueExpectedAfter(t.text, p.text), this.span(t));
      }
      this.fail("E_UNEXPECTED_TOKEN", MSG.unexpectedToken(t.text), this.span(t));
    }
    // Maximal run of words on this line.
    const run: Token[] = [t];
    let j = this.pos + 1;
    for (;;) {
      const u = this.at(j);
      if (u.nlBefore) break;
      if (u.kind === "dur") {
        run.push(u);
        j++;
        continue;
      }
      if (u.kind === "ident" && !this.isPhraseEnd(j)) {
        run.push(u);
        j++;
        continue;
      }
      break;
    }
    if (run.length === 1 && TEXT_FIELD_WORDS.has(t.word)) {
      this.next();
      return { k: "text", field: t.word as "sector" | "industry" | "symbol" | "name", span: this.span(t) };
    }
    const words = run.map(normaliseToken);
    const res = resolvePhrase(this.index, words);
    const written = this.source.slice(run[0].start, run[run.length - 1].end);
    if (res.kind === "ok" && res.used < run.length) {
      const used = run.slice(0, res.used);
      const rest = run.slice(res.used);
      const d = this.index.defs.get(res.id);
      this.pos += res.used;
      const restText = this.source.slice(rest[0].start, rest[rest.length - 1].end);
      const usedText = this.source.slice(used[0].start, used[used.length - 1].end);
      const sugg = suggestMetrics(this.index, written, this.opts.store ?? null).map(suggestionFor);
      this.fail("E_UNEXPECTED_TOKEN", MSG.leftoverWords(restText, usedText, d ? d.label : res.id),
        { start: rest[0].start, end: rest[rest.length - 1].end }, sugg);
    }
    this.pos += run.length;
    return this.refFrom(res, run, written, false);
  }

  isPhraseEnd(j: number): boolean {
    const u = this.at(j);
    if (PHRASE_END_WORDS.has(u.word)) return true;
    const nxt = this.at(j + 1);
    if (u.word === "in" && this.isOp(nxt, "(")) return true;
    if (u.word === "order" && this.isKw(nxt, "by")) return true;
    if (this.isOp(nxt, "(") && (!nxt.spaceBefore || isFnName(u.word))) return true;
    return false;
  }

  refFrom(res: Resolution, run: Token[], written: string, backtick: boolean): Expr {
    const span = { start: run[0].start, end: run[run.length - 1].end };
    switch (res.kind) {
      case "ok":
        return { k: "ref", metric: res.id, written: backtick ? this.source.slice(span.start, span.end) : written, selector: null, span };
      case "ambiguous": {
        const sugg = res.ids.map((id) => this.index.defs.get(id)).filter((d) => d !== undefined).map((d) => suggestionFor(d));
        this.report("E_AMBIGUOUS_METRIC", MSG.ambiguousMetric(written), span, sugg);
        return this.errorNode(span.start, span.end);
      }
      case "period_word":
        this.report("E_AMBIGUOUS_PERIOD_WORD", MSG.lastYear, span);
        return this.errorNode(span.start, span.end);
      case "unknown": {
        const found = suggestMetrics(this.index, written, this.opts.store ?? null);
        const sugg = found.map(suggestionFor);
        const best = found[0] ? `${found[0].label} (${found[0].id})` : null;
        this.report("E_UNKNOWN_METRIC", backtick && !best ? MSG.backtickUnknown(written) : MSG.unknownMetric(written, best), span, sugg);
        return this.errorNode(span.start, span.end);
      }
    }
  }

  parseCall(): Expr {
    const nameTok = this.next();
    const open = this.next();
    const fn = nameTok.word;
    const args: Expr[] = [];
    let windowTok: Token | null = null;
    let order: "asc" | "desc" | null = null;
    let closeEnd = open.end;
    this.nest++;
    this.enter();
    try {
      if (this.isOp(this.peek(), ")")) {
        closeEnd = this.next().end;
      } else {
        let guard = 0;
        while (guard++ < 1000) {
          const u = this.peek();
          const after = this.peek(1);
          const argEnds = this.isOp(after, ",") || this.isOp(after, ")");
          if (u.kind === "dur" && argEnds) {
            this.next();
            if (windowTok) this.fail("E_UNEXPECTED_TOKEN", MSG.wrongArgs(fn), this.span(u));
            windowTok = u;
          } else if ((this.isKw(u, "asc") || this.isKw(u, "desc")) && argEnds) {
            this.next();
            if (fn !== "rank") this.fail("E_UNEXPECTED_TOKEN", MSG.orderOnlyInRank, this.span(u));
            order = u.word === "asc" ? "asc" : "desc";
          } else {
            if (windowTok || order) this.fail("E_UNEXPECTED_TOKEN", MSG.wrongArgs(fn), this.span(u));
            args.push(this.parseOr());
          }
          const sep = this.peek();
          if (this.isOp(sep, ",")) {
            this.next();
            continue;
          }
          if (this.isOp(sep, ")")) {
            closeEnd = this.next().end;
            break;
          }
          if (sep.kind === "eof" || this.isTailStart()) {
            this.report("E_UNBALANCED_PAREN", MSG.unbalancedOpen, this.span(open));
            closeEnd = this.prev()?.end ?? open.end;
            break;
          }
          if (sep.kind === "bad") throw new Fail();
          this.fail("E_UNEXPECTED_TOKEN", MSG.unexpectedToken(sep.text), this.span(sep));
        }
      }
    } finally {
      this.nest--;
      this.leave();
    }
    const span = { start: nameTok.start, end: closeEnd };
    if (!isFnName(fn)) {
      this.report("E_UNKNOWN_FUNCTION", MSG.unknownFunction(nameTok.text), this.span(nameTok));
      return this.errorNode(span.start, span.end);
    }
    let window: Window | null = null;
    if (windowTok) {
      if (windowTok.durUnit === "q") {
        this.report("E_QUARTER_WINDOW", MSG.quarterWindow(windowTok.text), this.span(windowTok), [
          { label: "Use years", replacement: `${Math.max(1, Math.round(windowTok.value / 4))}y` },
        ]);
        return this.errorNode(span.start, span.end);
      }
      window = { n: windowTok.value, unit: "y" };
    }
    return { k: "call", fn, args, window, order, span };
  }
}

function combine(kind: "and" | "or", a: Expr, b: Expr): Expr {
  const span = { start: a.span.start, end: b.span.end };
  if (kind === "and") return { k: "and", items: [a, b], implicit: [false], span };
  return { k: "or", items: [a, b], span };
}

export function parseSource(source: string, index: NameIndex, opts: ParseOptions): ParseResult {
  const lexed = lex(source, { isKnownWord: (w) => isKnownWord(index, w) });
  const p = new Parser(lexed.tokens, index, source, opts);
  try {
    const ast = p.parseQuery();
    return { ast, issues: [...lexed.issues, ...p.issues], hasComments: lexed.hasComments };
  } catch (e) {
    if (!(e instanceof Fatal)) throw e;
    return {
      ast: null,
      issues: [...lexed.issues, ...p.issues, issue("E_TOO_COMPLEX", MSG.tooDeep(opts.maxDepth), { start: 0, end: source.length })],
      hasComments: lexed.hasComments,
    };
  }
}

/** Parses a lone numeric expression (expression columns). */
export function parseExpressionSource(source: string, index: NameIndex, opts: ParseOptions): { expr: Expr | null; issues: QueryIssue[] } {
  const lexed = lex(source, { isKnownWord: (w) => isKnownWord(index, w) });
  const p = new Parser(lexed.tokens, index, source, opts);
  try {
    if (p.peek().kind === "eof") {
      return { expr: null, issues: [issue("E_EMPTY_QUERY", MSG.emptyQuery, { start: 0, end: source.length })] };
    }
    const expr = p.parseItem();
    const rest = p.peek();
    if (rest.kind !== "eof" && rest.kind !== "bad") {
      p.issues.push(issue("E_UNEXPECTED_TOKEN", MSG.unexpectedToken(rest.text), { start: rest.start, end: rest.end }));
    }
    return { expr, issues: [...lexed.issues, ...p.issues] };
  } catch (e) {
    if (!(e instanceof Fatal)) throw e;
    return { expr: null, issues: [...lexed.issues, ...p.issues, issue("E_TOO_COMPLEX", MSG.tooDeep(opts.maxDepth), { start: 0, end: source.length })] };
  }
}
