// Generates docs/metrics.md from the catalogue (spec §E.5). Regenerate with `npm run docs:metrics`.
import { describe, expect, it } from "vitest";
import type { BaseMetricDef, MetricCategory, NullReason, TypeFamily, Unit } from "@/lib/contracts";
import { NULL_REASONS } from "@/lib/contracts";
import { NULL_REASON_TEXT } from "@/lib/format/metric-value";
import { BASE_METRICS, CATALOGUE_VERSION } from "./catalogue";
import { FALLBACK_TAX_RATE } from "./derive/common";
import { VARIANT_RULES, variantExpansion } from "./variants";

const CATEGORY_ORDER: readonly MetricCategory[] = [
  "Size", "Valuation", "Profitability", "Efficiency", "Leverage & Liquidity", "Growth", "Cash Flow", "Shareholding",
  "Dividend", "Per Share", "Banking & NBFC", "Scores & Checks", "Data", "Line items",
];

const UNIT_TEXT: Readonly<Record<Unit, string>> = {
  inr_cr: "₹ crore", inr: "₹", pct: "%", pp: "percentage points", x: "times (x)", days: "days", years: "years",
  count: "count", score: "score", crore_shares: "crore shares", fy_year: "financial year",
};

const DIRECTION_TEXT = { higher: "higher is better", lower: "lower is better", neutral: "neutral" } as const;

function appliesText(families: readonly TypeFamily[]): string {
  if (families.length === 3) return "all companies";
  if (families.length === 2) return "non-financial companies and lenders";
  return families[0] === "lender" ? "banks and NBFCs" : families[0] === "insurance" ? "insurers" : "non-financial companies";
}

function historyText(d: BaseMetricDef): string {
  switch (d.history) {
    case "annual": return d.ttm ? "yearly, with a TTM form" : "yearly";
    case "quarterly": return "quarterly";
    case "shareholding": return "shareholding quarters";
    case "latest_only": return "latest only";
  }
}

const cell = (s: string): string => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function metricSection(d: BaseMetricDef): string[] {
  const lines = [
    `### ${d.label} (${"`"}${d.id}${"`"})`,
    "",
    d.tooltip,
    "",
    `| | |`,
    `|---|---|`,
    `| Short label | ${cell(d.short)} |`,
    `| Unit | ${UNIT_TEXT[d.unit]}, ${d.decimals} decimal${d.decimals === 1 ? "" : "s"}, ${DIRECTION_TEXT[d.direction]} |`,
    `| Applies to | ${appliesText(d.appliesTo)} |`,
    `| History | ${historyText(d)}; period tag "${cell(d.periodTag)}" |`,
    `| Level | ${d.level} |`,
    `| Formula | ${cell(d.formula)} |`,
    `| When it is missing | ${cell(d.nullRules)} |`,
  ];
  if (d.aliases.length) lines.push(`| Other names | ${cell(d.aliases.join(", "))} |`);
  if (d.variants.length) lines.push(`| Variants | ${d.variants.map((v) => `${"`"}${d.id}_${v}${"`"} = ${cell(variantExpansion(d.id, v))}`).join("; ")} |`);
  lines.push("");
  return lines;
}

function renderMetricsDoc(): string {
  const out: string[] = [
    "# Metrics reference",
    "",
    "<!-- Generated from src/lib/metrics/catalogue.ts by src/lib/metrics/docs.test.ts. Do not edit by hand; run `npm run docs:metrics`. -->",
    "",
    `Catalogue version ${CATALOGUE_VERSION}. ${BASE_METRICS.length} base metrics (including line items that expose a field of your data directly).`,
    "Every figure is calculated only from the data you load; nothing is estimated or filled in.",
    "",
    "## Conventions",
    "",
    "- Money is in ₹ crore; per-share values in ₹; percentages are percent numbers (15.2 means 15.2%).",
    "- A bare yearly metric means the latest financial year (FY). TTM (trailing twelve months) is the sum of the latest four",
    "  quarters, matched by date; when any of them is missing, the latest FY figure is used and marked as such.",
    "- avg(X) is the average of the opening and closing balance; in the first available year the closing balance is used and marked.",
    "- owners' profit = net profit attributable to owners, or net profit when that is not given. EBITDA = revenue − operating expenses;",
    "  EBIT = EBITDA + other income − depreciation; net worth = equity share capital + other equity; total equity = net worth + minority",
    "  interest; total debt = borrowings (non-current and current) + lease liabilities; spare cash = cash and bank + current investments.",
    `- The tax rate for ROIC is tax / PBT when PBT is positive and the ratio is between 0 and 50%; otherwise ${(FALLBACK_TAX_RATE * 100).toFixed(2)}% (Section 115BAA).`,
    "- Only other income, exceptional items, minority interest, lease liabilities and current investments are treated as 0 when",
    "  missing, and every such assumption is marked. Every other missing input leaves the figure empty, with a reason.",
    "- Growth, CAGR, averages and totals across a restated or transition year are not calculated.",
    "- Banks and NBFCs get lender metrics; metrics built for non-financial companies show \"N/A for lenders\".",
    "- Peer statistics (percentiles, medians) never mix banks, NBFCs, insurers and non-financial companies. A group smaller than 5",
    "  companies falls back from industry to sector to all companies of the same class; a median needs 3 values and a percentile 5.",
    "",
    "## Why a figure can be empty",
    "",
    "| Reason | Short text | Meaning |",
    "|---|---|---|",
    ...NULL_REASONS.filter((r): r is NullReason => r !== "none").map((r) => `| ${"`"}${r}${"`"} | ${NULL_REASON_TEXT[r].short} | ${cell(NULL_REASON_TEXT[r].long)} |`),
    "",
    "## Period variants",
    "",
    "| Suffix | Meaning |",
    "|---|---|",
    ...Object.keys(VARIANT_RULES).map((v) => `| ${"`"}_${v}${"`"} | ${cell(variantExpansion("x", v as keyof typeof VARIANT_RULES))} |`),
    "",
  ];
  for (const cat of CATEGORY_ORDER) {
    const defs = BASE_METRICS.filter((d) => d.category === cat);
    if (defs.length === 0) continue;
    out.push(`## ${cat}`, "");
    for (const d of defs) out.push(...metricSection(d));
  }
  return out.join("\n");
}

const FORBIDDEN = ["buy", "sell", "strong buy", "avoid", "fraud", "multibagger", "target price", "guaranteed", "sure shot", "will go bankrupt"];

describe("docs/metrics.md", () => {
  it("lists every base metric once", () => {
    const doc = renderMetricsDoc();
    for (const d of BASE_METRICS) expect(doc.split(`(\`${d.id}\`)`).length - 1, d.id).toBe(1);
  });

  it("uses no forbidden words", () => {
    const doc = renderMetricsDoc().toLowerCase();
    for (const w of FORBIDDEN) expect(new RegExp(`\\b${w}\\b`).test(doc), w).toBe(false);
  });

  it("matches the committed file (regenerate with npm run docs:metrics)", async () => {
    await expect(renderMetricsDoc()).toMatchFileSnapshot("../../../docs/metrics.md");
  });
});
