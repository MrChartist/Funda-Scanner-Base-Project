// src/lib/query/lexer.ts — FSQL v1 tokens (§D.1). Context-free apart from the slash merge,
// which asks the name index whether `p/e`-style words are known aliases. Spans are character
// offsets into the source (end exclusive).
import type { NumSuffix, QueryIssue, Span } from "@/lib/contracts";
import { issue, MSG } from "./errors";

export type TokenKind = "num" | "str" | "ident" | "dur" | "backtick" | "op" | "bad" | "eof";

export interface Token {
  kind: TokenKind;
  /** Raw source text of the token. */
  text: string;
  start: number;
  end: number;
  /** A newline (or a comment ending in one) separates this token from the previous one. */
  nlBefore: boolean;
  /** Whitespace or a comment separates this token from the previous one. */
  spaceBefore: boolean;
  /** num: scaled value; dur: count. */
  value: number;
  suffix: NumSuffix | null;
  /** Digits written after the decimal point (num), adjusted for k/lakh scaling. */
  decimals: number;
  /** dur only. */
  durUnit: "y" | "q" | null;
  /** str / backtick: the text between the quotes. ident: lower-case word (slash-merged words joined). */
  word: string;
}

export interface LexResult {
  tokens: Token[];
  issues: QueryIssue[];
  hasComments: boolean;
}

const SUFFIX_WORDS: Readonly<Record<string, NumSuffix>> = {
  x: "x", cr: "cr", crore: "cr", crores: "cr", k: "k", lakh: "lakh", lakhs: "lakh",
};
const DUR_WORDS: Readonly<Record<string, "y" | "q">> = {
  y: "y", yr: "y", yrs: "y", year: "y", years: "y", q: "q", qtr: "q", qtrs: "q", quarter: "q", quarters: "q",
};
const SCALE: Readonly<Record<NumSuffix, number>> = { "%": 1, x: 1, cr: 1, k: 1e3, lakh: 1e5 };
const SCALE_DIGITS: Readonly<Record<NumSuffix, number>> = { "%": 0, x: 0, cr: 0, k: 3, lakh: 5 };

const TWO_CHAR_OPS = [">=", "<=", "!=", "<>", "=="];
const ONE_CHAR_OPS = ">=<+-*/()[],";

function isDigit(c: string | undefined): boolean {
  return c !== undefined && c >= "0" && c <= "9";
}
function isIdentStart(c: string | undefined): boolean {
  return c !== undefined && ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_");
}
function isIdentChar(c: string | undefined): boolean {
  return isIdentStart(c) || isDigit(c);
}

/** Lower-case word with punctuation removed (`p/e` → `pe`), as names.ts normalises tokens. */
export function squashWord(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export interface LexOptions {
  /** Slash merge: is this joined, normalised word a known metric phrase? */
  isKnownWord?: (word: string) => boolean;
}

export function lex(source: string, options: LexOptions = {}): LexResult {
  const tokens: Token[] = [];
  const issues: QueryIssue[] = [];
  let hasComments = false;
  let i = 0;
  let nl = false;
  let space = false;
  const n = source.length;

  const push = (t: Omit<Token, "nlBefore" | "spaceBefore">) => {
    tokens.push({ ...t, nlBefore: nl, spaceBefore: space });
    nl = false;
    space = false;
  };
  const base = { value: 0, suffix: null, decimals: 0, durUnit: null, word: "" } as const;

  while (i < n) {
    const c = source[i];
    if (c === " " || c === "\t" || c === "\r") {
      i++;
      space = true;
      continue;
    }
    if (c === "\n") {
      i++;
      nl = true;
      space = true;
      continue;
    }
    if (c === "#") {
      hasComments = true;
      while (i < n && source[i] !== "\n") i++;
      space = true;
      continue;
    }
    const start = i;

    // ── numbers and durations ──
    if (isDigit(c) || (c === "." && isDigit(source[i + 1]))) {
      let j = i;
      while (isDigit(source[j]) || source[j] === "_") j++;
      let fracDigits = 0;
      let bad = false;
      if (source[j] === ".") {
        if (isDigit(source[j + 1])) {
          j++;
          while (isDigit(source[j]) || source[j] === "_") {
            if (source[j] !== "_") fracDigits++;
            j++;
          }
        } else {
          bad = true;
          j++;
        }
      }
      // A second decimal point: "1.2.3".
      if (source[j] === "." && !bad) {
        bad = true;
        while (isDigit(source[j]) || source[j] === "." || source[j] === "_") j++;
      }
      // Indian or Western digit grouping with commas: "1,00,000", "100,000".
      const grouping = /^\d{1,3}(?:,\d{2,3})*,\d{3}(?:\.\d+)?/.exec(source.slice(i));
      if (!bad && grouping && grouping[0].includes(",") && grouping[0].length > j - i) {
        const text = grouping[0];
        const digits = text.replace(/,/g, "");
        issues.push(issue("E_COMMA_IN_NUMBER", MSG.commaInNumber, { start, end: start + text.length }, [
          { label: `Write ${digits}`, replacement: digits },
        ]));
        const value = Number(digits);
        i = start + text.length;
        push({ ...base, kind: "num", text, start, end: i, value, decimals: (digits.split(".")[1] ?? "").length });
        continue;
      }
      const numText = source.slice(i, j);
      if (bad) {
        issues.push(issue("E_BAD_NUMBER", MSG.badNumber(numText), { start, end: j }));
        i = j;
        push({ ...base, kind: "bad", text: numText, start, end: j });
        continue;
      }
      const value = Number(numText.replace(/_/g, ""));
      // Optional suffix or duration unit, attached or after exactly one space.
      let k = j;
      const attached = source[k] !== " ";
      if (source[k] === " " && (source[k + 1] === "%" || isIdentStart(source[k + 1]))) k++;
      if (source[k] === "%") {
        i = k + 1;
        push({ ...base, kind: "num", text: source.slice(start, i), start, end: i, value, suffix: "%", decimals: fracDigits });
        continue;
      }
      if (isIdentStart(source[k])) {
        let m = k;
        while (isIdentChar(source[m])) m++;
        const word = source.slice(k, m).toLowerCase();
        const suffix = SUFFIX_WORDS[word];
        const dur = DUR_WORDS[word];
        if (suffix) {
          i = m;
          push({
            ...base, kind: "num", text: source.slice(start, i), start, end: i, value: value * SCALE[suffix], suffix,
            decimals: Math.max(0, fracDigits - SCALE_DIGITS[suffix]),
          });
          continue;
        }
        if (dur) {
          i = m;
          const text = source.slice(start, i);
          if (fracDigits > 0 || numText.includes(".")) {
            issues.push(issue("E_BAD_NUMBER", MSG.fractionalPeriod(text), { start, end: i }));
            push({ ...base, kind: "bad", text, start, end: i });
          } else {
            push({ ...base, kind: "dur", text, start, end: i, value, durUnit: dur });
          }
          continue;
        }
        if (attached) {
          i = m;
          issues.push(issue("E_UNKNOWN_SUFFIX", MSG.unknownSuffix(numText, source.slice(k, m)), { start, end: m }, [
            { label: `Remove '${source.slice(k, m)}'`, replacement: numText },
          ]));
          push({ ...base, kind: "bad", text: source.slice(start, m), start, end: m });
          continue;
        }
      }
      i = j;
      push({ ...base, kind: "num", text: numText, start, end: j, value, decimals: fracDigits });
      continue;
    }

    // ── identifiers (with the slash merge) ──
    if (isIdentStart(c)) {
      let j = i;
      while (isIdentChar(source[j])) j++;
      if (source[j] === "/" && isIdentStart(source[j + 1]) && options.isKnownWord) {
        let m = j + 1;
        while (isIdentChar(source[m])) m++;
        const joined = squashWord(source.slice(i, m));
        if (options.isKnownWord(joined)) {
          i = m;
          push({ ...base, kind: "ident", text: source.slice(start, m), start, end: m, word: joined });
          continue;
        }
      }
      i = j;
      const text = source.slice(start, j);
      push({ ...base, kind: "ident", text, start, end: j, word: text.toLowerCase() });
      continue;
    }

    // ── strings and backtick names ──
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && source[j] !== c && source[j] !== "\n") j++;
      if (source[j] === c) {
        i = j + 1;
        push({ ...base, kind: c === "`" ? "backtick" : "str", text: source.slice(start, i), start, end: i, word: source.slice(start + 1, j) });
      } else {
        i = j;
        const text = source.slice(start, j);
        issues.push(issue("E_UNTERMINATED_STRING", c === "`" ? MSG.unterminatedBacktick : MSG.unterminatedString, { start, end: j }, [
          { label: `Add the closing ${c}`, replacement: `${text}${c}` },
        ]));
        push({ ...base, kind: c === "`" ? "backtick" : "str", text, start, end: j, word: source.slice(start + 1, j) });
      }
      continue;
    }

    // ── operators ──
    const two = source.slice(i, i + 2);
    if (TWO_CHAR_OPS.includes(two)) {
      i += 2;
      push({ ...base, kind: "op", text: two, start, end: i });
      continue;
    }
    if (ONE_CHAR_OPS.includes(c)) {
      i += 1;
      push({ ...base, kind: "op", text: c, start, end: i });
      continue;
    }

    // ── anything else ──
    // Take a whole code point so emoji and other astral characters are reported once.
    const cp = source.codePointAt(i) ?? 0;
    const ch = String.fromCodePoint(cp);
    let len = ch.length;
    let message = MSG.unexpectedChar(ch);
    const suggestions = [];
    if (ch === "&") {
      if (source[i + 1] === "&") len = 2;
      message = MSG.ampersand;
      suggestions.push({ label: "Use AND", replacement: "AND" });
    } else if (ch === "|") {
      if (source[i + 1] === "|") len = 2;
      message = MSG.pipe;
      suggestions.push({ label: "Use OR", replacement: "OR" });
    } else if (ch === "₹") {
      message = MSG.rupeeChar;
      suggestions.push({ label: "Remove '₹'", replacement: "" });
    }
    const span: Span = { start, end: start + len };
    issues.push(issue("E_UNEXPECTED_CHAR", message, span, suggestions));
    i += len;
    push({ ...base, kind: "bad", text: source.slice(start, i), start, end: i });
  }
  tokens.push({ ...base, kind: "eof", text: "", start: n, end: n, nlBefore: nl, spaceBefore: space });
  return { tokens, issues, hasComments };
}
