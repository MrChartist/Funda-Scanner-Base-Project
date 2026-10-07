// src/lib/learn/index.ts — glossary and concepts (WS2). Pure data: no clock, no randomness.
// <MetricInfo> looks up GLOSSARY[def.base], so variants (for example roce_avg_5y) inherit the
// entry of their base metric; without an entry it falls back to the catalogue tooltip.
import type { ConceptEntry, GlossaryEntry, MetricId } from "@/lib/contracts";
import { CONCEPTS } from "./concepts";
import { GLOSSARY } from "./glossary";

export { CONCEPTS } from "./concepts";
export { GLOSSARY, GLOSSARY_BASIC_IDS, GLOSSARY_INTERMEDIATE_IDS } from "./glossary";

/** The glossary entry for a metric or one of its variants (looked up by base id). */
export function glossaryFor(base: MetricId): GlossaryEntry | null {
  return GLOSSARY[base] ?? null;
}

/** A concept by id ("ttm", "cagr", …), or null. */
export function conceptById(id: string): ConceptEntry | null {
  return CONCEPTS.find((c) => c.id === id) ?? null;
}

/** Splits a concept body into its plain-text paragraphs. */
export function conceptParagraphs(c: ConceptEntry): string[] {
  return c.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}
