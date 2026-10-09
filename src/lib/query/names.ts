// src/lib/query/names.ts — metric name resolution (§D.4).
// Ordered-token longest match over normalised phrases (ids, labels, short names, aliases and the
// generated variant aliases). Two definitions sharing a phrase is a build-time test failure.
import type { MetricDef, MetricId, MetricStore, Suggestion } from "@/lib/contracts";
import type { Token } from "./lexer";

export interface NameIndex {
  /** Normalised phrase → metric ids (more than one only on a collision). */
  readonly phrases: ReadonlyMap<string, readonly MetricId[]>;
  readonly defs: ReadonlyMap<MetricId, MetricDef>;
  readonly list: readonly MetricDef[];
}

const indexCache = new WeakMap<object, NameIndex>();

/**
 * Normalises a phrase (§D.4 step 1): lower-case; punctuation other than "_" dropped; years/year/
 * yrs/yr after digits become "y"; average and mean become avg; previous becomes prev.
 */
export function normalisePhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(\d+)\s*(?:years|year|yrs|yr)\b/g, "$1y")
    .replace(/\b(?:average|mean)\b/g, "avg")
    .replace(/\bprevious\b/g, "prev");
}

/** Phrases under which a definition can be written. */
export function phrasesOf(d: MetricDef): string[] {
  const out: string[] = [];
  for (const raw of [d.id, d.id.replace(/_/g, " "), d.label, d.short, ...d.aliases]) {
    const p = normalisePhrase(raw);
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

export function buildNameIndex(defs: readonly MetricDef[]): NameIndex {
  const phrases = new Map<string, MetricId[]>();
  const byId = new Map<MetricId, MetricDef>();
  for (const d of defs) {
    byId.set(d.id, d);
    for (const p of phrasesOf(d)) {
      const ids = phrases.get(p);
      if (!ids) phrases.set(p, [d.id]);
      else if (!ids.includes(d.id)) ids.push(d.id);
    }
  }
  return { phrases, defs: byId, list: defs };
}

/** The index for a store's catalogue (cached per definitions array). */
export function nameIndexFor(store: MetricStore): NameIndex {
  const defs = store.defs();
  let idx = indexCache.get(defs);
  if (!idx) {
    idx = buildNameIndex(defs);
    indexCache.set(defs, idx);
  }
  return idx;
}

/** Phrases claimed by more than one definition (must be empty; see names.test.ts). */
export function collisions(index: NameIndex): { phrase: string; ids: readonly MetricId[] }[] {
  const out: { phrase: string; ids: readonly MetricId[] }[] = [];
  for (const [phrase, ids] of index.phrases) if (ids.length > 1) out.push({ phrase, ids });
  return out;
}

/** Normalised form of one phrase token (§D.4 step 1). */
export function normaliseToken(t: Token): string {
  if (t.kind === "dur") return `${t.value}${t.durUnit ?? ""}`;
  const w = t.word.replace(/[^a-z0-9_]/g, "");
  if (w === "average" || w === "mean") return "avg";
  if (w === "previous") return "prev";
  return w;
}

export type Resolution =
  | { kind: "ok"; id: MetricId; used: number }
  | { kind: "ambiguous"; ids: readonly MetricId[]; used: number }
  | { kind: "unknown" }
  | { kind: "period_word" };

/** Resolves a maximal run of words: full run first, then shrinking from the right. */
export function resolvePhrase(index: NameIndex, words: readonly string[]): Resolution {
  for (let k = 0; k + 1 < words.length; k++) {
    if (words[k] === "last" && (words[k + 1] === "year" || words[k + 1] === "yr" || words[k + 1] === "fy")) {
      return { kind: "period_word" };
    }
  }
  for (let len = words.length; len >= 1; len--) {
    const key = words.slice(0, len).join(" ");
    const ids = index.phrases.get(key);
    if (!ids) continue;
    if (ids.length > 1) return { kind: "ambiguous", ids, used: len };
    return { kind: "ok", id: ids[0], used: len };
  }
  return { kind: "unknown" };
}

/** Backtick names must match a label or alias exactly after normalisation. */
export function resolveExact(index: NameIndex, text: string): Resolution {
  const ids = index.phrases.get(normalisePhrase(text));
  if (!ids) return { kind: "unknown" };
  if (ids.length > 1) return { kind: "ambiguous", ids, used: 1 };
  return { kind: "ok", id: ids[0], used: 1 };
}

export function isKnownWord(index: NameIndex, word: string): boolean {
  return index.phrases.has(word);
}

/** Restricted Damerau-Levenshtein (optimal string alignment) distance. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev2 = new Array<number>(n + 1).fill(0);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let cur = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
    }
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return prev[n];
}

export function suggestionFor(d: MetricDef): Suggestion {
  return { label: `${d.label} (${d.id})`, replacement: d.id };
}

/**
 * Up to `limit` close metrics for an unknown phrase, ranked by edit distance on the normalised
 * phrase, token overlap, a bonus for basic-level metrics and the share of companies with data.
 */
export function suggestMetrics(index: NameIndex, written: string, store: MetricStore | null, limit = 3): MetricDef[] {
  const phrase = normalisePhrase(written);
  if (!phrase) return [];
  const tokens = phrase.split(/[\s_]+/).filter((t) => t.length >= 3);
  const best = new Map<MetricId, number>();
  for (const [key, ids] of index.phrases) {
    if (ids.length !== 1) continue;
    const d = index.defs.get(ids[0]);
    if (!d) continue;
    const dist = editDistance(phrase, key);
    const keyTokens = key.split(/[\s_]+/);
    const overlap = tokens.filter((t) => keyTokens.includes(t)).length;
    const maxDist = Math.max(2, Math.floor(phrase.length * 0.4));
    if (dist > maxDist && overlap === 0) continue;
    let score = dist / Math.max(phrase.length, key.length, 1) - 0.25 * overlap;
    if (d.level === "basic") score -= 0.05;
    if (d.variant !== null) score += 0.05;
    const prev = best.get(d.id);
    if (prev === undefined || score < prev) best.set(d.id, score);
  }
  let ranked = [...best.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).slice(0, Math.max(limit * 3, 8));
  if (store) {
    ranked = ranked.map(([id, s]): [MetricId, number] => {
      try {
        const cov = store.coverage(id);
        return [id, s - (cov.applicable > 0 ? 0.1 * (cov.nonNull / cov.applicable) : 0)];
      } catch {
        return [id, s];
      }
    }).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  }
  return ranked.slice(0, limit).map(([id]) => index.defs.get(id)).filter((d): d is MetricDef => d !== undefined);
}
