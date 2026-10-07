// src/lib/metrics/variants.ts — generated period variants (spec §C.5). Written in P0, handed to WS3.
// A variant id is `${base}_${variant}`, e.g. roce_avg_5y, sales_cagr_5y, promoter_holding_chg_1y.
// The store computes variants with the same aggregateWindow/cagrColumn functions that the FSQL
// evaluator uses (metrics/windows.ts), so column("roce_avg_5y") equals avg(roce, 5y) exactly.
import type {
  BaseMetricDef, Direction, HistoryKind, MetricDef, MetricId, Unit, Variant, WindowAggregate,
} from "@/lib/contracts";
import { BASE_METRICS } from "./catalogue";

/** How a variant is computed from its base metric. */
export type VariantRule =
  | { kind: "prev" }
  | { kind: "ttm" }
  | { kind: "window"; aggregate: Extract<WindowAggregate, "avg" | "min" | "stdev" | "sum">; years: number }
  | { kind: "cagr"; years: number }
  | { kind: "change"; quarters: number };

export const VARIANT_RULES: Readonly<Record<Variant, VariantRule>> = {
  prev: { kind: "prev" },
  ttm: { kind: "ttm" },
  avg_3y: { kind: "window", aggregate: "avg", years: 3 },
  avg_5y: { kind: "window", aggregate: "avg", years: 5 },
  avg_10y: { kind: "window", aggregate: "avg", years: 10 },
  min_5y: { kind: "window", aggregate: "min", years: 5 },
  stdev_5y: { kind: "window", aggregate: "stdev", years: 5 },
  cagr_3y: { kind: "cagr", years: 3 },
  cagr_5y: { kind: "cagr", years: 5 },
  cagr_10y: { kind: "cagr", years: 10 },
  cum_3y: { kind: "window", aggregate: "sum", years: 3 },
  cum_5y: { kind: "window", aggregate: "sum", years: 5 },
  cum_10y: { kind: "window", aggregate: "sum", years: 10 },
  chg_1q: { kind: "change", quarters: 1 },
  chg_1y: { kind: "change", quarters: 4 },
  chg_3y: { kind: "change", quarters: 12 },
};

/** Function words used in generated aliases (§C.5); the first entry is the canonical one. */
const FUNCTION_WORDS: Readonly<Record<"avg" | "min" | "stdev" | "sum", readonly string[]>> = {
  avg: ["avg", "average", "mean"],
  min: ["min", "minimum", "lowest"],
  stdev: ["stdev", "std dev"],
  sum: ["total", "sum"],
};

/** Words that end a phrase in FSQL; no alias may contain them (§D.4). */
export const RESERVED_ALIAS_WORDS: readonly string[] = [
  "and", "or", "not", "between", "in", "is", "sort", "by", "asc", "desc", "limit", "where", "order",
];

/** Normalises a phrase the way query/names.ts does (§D.4 step 1). */
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

function hasReservedWord(phrase: string): boolean {
  const words = phrase.split(/[\s_]+/);
  return words.some((w) => RESERVED_ALIAS_WORDS.includes(w));
}

/** Base phrases B for alias generation: label, short, aliases and the id with spaces (keyword-free only). */
export function basePhrases(base: BaseMetricDef): string[] {
  const raw = [base.label, base.short, ...base.aliases, base.id.replace(/_/g, " ")];
  const out: string[] = [];
  for (const r of raw) {
    const p = normalisePhrase(r);
    if (p && !hasReservedWord(p) && !out.includes(p)) out.push(p);
  }
  return out;
}

function isFlowLike(base: BaseMetricDef): boolean {
  return base.history === "annual";
}

/** Whether a variant may be generated for a base metric (§C.5 "Allowed on"). */
export function variantAllowed(base: BaseMetricDef, variant: Variant): boolean {
  const rule = VARIANT_RULES[variant];
  switch (rule.kind) {
    case "prev": return base.history === "annual" || base.history === "quarterly" || base.history === "shareholding";
    case "ttm": return base.ttm;
    case "window": return rule.aggregate === "sum" ? isFlowLike(base) : base.history === "annual";
    case "cagr": return base.growthable && base.history === "annual";
    case "change": return base.history === "shareholding";
  }
}

function labelSuffix(base: BaseMetricDef, variant: Variant): string {
  const rule = VARIANT_RULES[variant];
  switch (rule.kind) {
    case "prev": return base.history === "annual" ? "prev FY" : "prev qtr";
    case "ttm": return "TTM";
    case "window": {
      const word = rule.aggregate === "avg" ? "avg" : rule.aggregate === "min" ? "min" : rule.aggregate === "stdev" ? "std dev" : "total";
      return `${rule.years}Y ${word}`;
    }
    case "cagr": return `${rule.years}Y CAGR`;
    case "change": return `change ${rule.quarters === 1 ? "1Q" : rule.quarters === 4 ? "1Y" : "3Y"}`;
  }
}

function variantUnit(base: BaseMetricDef, variant: Variant): Unit {
  const rule = VARIANT_RULES[variant];
  if (rule.kind === "cagr") return "pct";
  if ((rule.kind === "change" || (rule.kind === "window" && rule.aggregate === "stdev")) && base.unit === "pct") return "pp";
  return base.unit;
}

function variantDirection(base: BaseMetricDef, variant: Variant): Direction {
  const rule = VARIANT_RULES[variant];
  if (rule.kind === "window" && rule.aggregate === "stdev") return "lower";
  if (rule.kind === "cagr") return "higher";
  return base.direction;
}

function variantHistory(base: BaseMetricDef, variant: Variant): HistoryKind {
  const rule = VARIANT_RULES[variant];
  switch (rule.kind) {
    case "prev": return base.history;
    case "ttm": return "latest_only";
    case "window":
    case "cagr": return "annual";
    case "change": return "shareholding";
  }
}

function variantPeriodTag(base: BaseMetricDef, variant: Variant): string {
  const rule = VARIANT_RULES[variant];
  switch (rule.kind) {
    case "prev": return base.history === "annual" ? "Prev FY" : "Prev qtr";
    case "ttm": return "TTM";
    case "window":
    case "cagr": return `${rule.years}Y`;
    case "change": return rule.quarters === 1 ? "1Q change" : rule.quarters === 4 ? "1Y change" : "3Y change";
  }
}

/** FSQL text the variant is shorthand for. */
export function variantExpansion(baseId: MetricId, variant: Variant): string {
  const rule = VARIANT_RULES[variant];
  switch (rule.kind) {
    case "prev": return `${baseId}[prev]`;
    case "ttm": return `${baseId}[ttm]`;
    case "window": return `${rule.aggregate}(${baseId}, ${rule.years}y)`;
    case "cagr": return `cagr(${baseId}, ${rule.years}y)`;
    case "change": return `${baseId} - ${baseId}[q-${rule.quarters}]`;
  }
}

/** Generated aliases for one variant (§C.5): `B F`/`F B` or `B W F`/`B F W`/`F B W`. */
export function variantAliases(base: BaseMetricDef, variant: Variant): string[] {
  const rule = VARIANT_RULES[variant];
  const phrases = basePhrases(base);
  const out: string[] = [];
  const push = (s: string) => {
    const p = normalisePhrase(s);
    if (!hasReservedWord(p) && !out.includes(p)) out.push(p);
  };
  const plain = (words: readonly string[]) => {
    for (const b of phrases) for (const f of words) { push(`${b} ${f}`); push(`${f} ${b}`); }
  };
  const windowed = (words: readonly string[], w: string) => {
    for (const b of phrases) for (const f of words) { push(`${b} ${w} ${f}`); push(`${b} ${f} ${w}`); push(`${f} ${b} ${w}`); }
  };
  switch (rule.kind) {
    case "prev":
      plain(["prev", "previous", base.history === "annual" ? "previous year" : "previous quarter"]);
      break;
    case "ttm":
      plain(["ttm"]);
      break;
    case "window":
      windowed(FUNCTION_WORDS[rule.aggregate], `${rule.years}y`);
      break;
    case "cagr":
      windowed(["cagr"], `${rule.years}y`);
      break;
    case "change":
      // chg_1q, chg_1y and chg_3y share a base, so the window token is required to keep them apart.
      windowed(["change", "chg"], rule.quarters === 1 ? "1q" : rule.quarters === 4 ? "1y" : "3y");
      break;
  }
  return out;
}

/** Builds the full definition of `${base.id}_${variant}`. */
export function makeVariantDef(base: BaseMetricDef, variant: Variant): MetricDef {
  const suffix = labelSuffix(base, variant);
  const rule = VARIANT_RULES[variant];
  return {
    id: `${base.id}_${variant}`,
    label: `${base.label} · ${suffix}`,
    short: `${base.short} · ${suffix}`,
    aliases: variantAliases(base, variant),
    category: base.category,
    unit: variantUnit(base, variant),
    decimals: rule.kind === "cagr" ? 1 : base.decimals,
    direction: variantDirection(base, variant),
    level: base.level,
    appliesTo: base.appliesTo,
    history: variantHistory(base, variant),
    ttm: false,
    growthable: false,
    variants: [],
    rawField: null,
    periodTag: variantPeriodTag(base, variant),
    formula: `${variantExpansion(base.id, variant)}, where ${base.id} = ${base.formula}`,
    tooltip: base.tooltip,
    nullRules: rule.kind === "window" || rule.kind === "cagr"
      ? `${base.nullRules} Every year in the window must have a value; a restated or transition year makes it not comparable.`
      : base.nullRules,
    isScore: base.isScore,
    base: base.id,
    variant,
    expandsTo: variantExpansion(base.id, variant),
  };
}

/** A base metric as a full MetricDef (no variant). */
export function asMetricDef(base: BaseMetricDef): MetricDef {
  return { ...base, base: base.id, variant: null, expandsTo: null };
}

/** Every metric definition: each base metric followed by its generated variants. */
export function buildMetricDefs(bases: readonly BaseMetricDef[] = BASE_METRICS): MetricDef[] {
  const out: MetricDef[] = [];
  for (const base of bases) {
    out.push(asMetricDef(base));
    for (const variant of base.variants) {
      if (!variantAllowed(base, variant)) {
        throw new Error(`Variant ${variant} is not allowed on ${base.id}`);
      }
      out.push(makeVariantDef(base, variant));
    }
  }
  return out;
}

/** All definitions, built once (pure; same output every time). */
export const ALL_METRIC_DEFS: readonly MetricDef[] = buildMetricDefs();

const DEF_BY_ID: ReadonlyMap<MetricId, MetricDef> = new Map(ALL_METRIC_DEFS.map((d) => [d.id, d]));

export function metricDef(id: MetricId): MetricDef | undefined {
  return DEF_BY_ID.get(id);
}
