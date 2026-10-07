// src/components/screener/highlight.ts — splits query text into coloured and squiggled segments.
import type { QueryIssue } from "@/lib/contracts";
import { FUNCTION_NAMES } from "@/lib/query";

export type Kind = "plain" | "keyword" | "function" | "number" | "string" | "comment" | "op" | "ident";

interface Tok {
  start: number;
  end: number;
  kind: Kind;
}

const KEYWORDS = new Set(["and", "or", "not", "between", "in", "is", "sort", "by", "limit", "asc", "desc"]);
const FUNCTIONS = new Set<string>(FUNCTION_NAMES);
const TOKEN = /(#[^\n]*)|("(?:[^"\\\n]|\\.)*"?)|(\d[\d.,]*(?:%|x|cr|k|lakh)?)|([A-Za-z_][A-Za-z0-9_/]*)|([^\s])/g;

function tokenize(source: string): Tok[] {
  const out: Tok[] = [];
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(source)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (m[1]) out.push({ start, end, kind: "comment" });
    else if (m[2]) out.push({ start, end, kind: "string" });
    else if (m[3]) out.push({ start, end, kind: "number" });
    else if (m[4]) {
      const w = m[4].toLowerCase();
      out.push({ start, end, kind: KEYWORDS.has(w) ? "keyword" : FUNCTIONS.has(w) ? "function" : "ident" });
    } else out.push({ start, end, kind: "op" });
  }
  return out;
}

export interface Segment {
  text: string;
  kind: Kind;
  level: "error" | "warning" | null;
}

/** Splits the source at token and issue boundaries. Exported for tests. */
export function buildSegments(source: string, issues: readonly QueryIssue[]): Segment[] {
  const toks = tokenize(source);
  const marks = issues.filter((i) => i.level !== "info" && i.span.end > i.span.start);
  const cuts = new Set<number>([0, source.length]);
  for (const t of toks) {
    cuts.add(t.start);
    cuts.add(t.end);
  }
  for (const i of marks) {
    cuts.add(Math.max(0, Math.min(source.length, i.span.start)));
    cuts.add(Math.max(0, Math.min(source.length, i.span.end)));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: Segment[] = [];
  let ti = 0;
  for (let k = 0; k + 1 < points.length; k++) {
    const a = points[k];
    const b = points[k + 1];
    if (b <= a) continue;
    while (ti < toks.length && toks[ti].end <= a) ti++;
    const tok = ti < toks.length && toks[ti].start <= a ? toks[ti] : null;
    let level: Segment["level"] = null;
    for (const i of marks) {
      if (i.span.start <= a && i.span.end >= b) {
        if (i.level === "error") level = "error";
        else if (level === null) level = "warning";
      }
    }
    out.push({ text: source.slice(a, b), kind: tok ? tok.kind : "plain", level });
  }
  return out;
}

