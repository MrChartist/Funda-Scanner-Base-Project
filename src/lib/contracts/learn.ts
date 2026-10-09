// src/lib/contracts/learn.ts
import type { MetricId } from "./metrics";

/** Hand-written learning content for one BASE metric (variants inherit with a period note). */
export interface GlossaryEntry {
  base: MetricId;
  whatItTells: string;     // 2–3 sentences
  howToRead: string;       // "Higher is better. As a rule of thumb, …"
  workedExample: string | null;   // round numbers in ₹ crore
  rulesOfThumb: { context: string; text: string }[];  // always labelled "rule of thumb", never a standard
  pitfalls: string[];
  notApplicableNote: string | null;  // e.g. why ROCE does not apply to lenders
  related: MetricId[];
}

export interface ConceptEntry {
  id: string;              // "ttm", "cagr", "fy", "crore-lakh", "consolidated-standalone", "percentile",
                           // "why-lenders-differ", "missing-data", "what-a-screen-cannot-tell-you", "fictional-sample"
  title: string;
  body: string;            // plain text paragraphs separated by blank lines (rendered as text, never HTML)
  related: string[];       // concept ids or metric ids
}
