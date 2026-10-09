// Learning content (§E.4): glossary for every basic-level base metric (P0) and every
// intermediate one (P1), plus the 10 concepts. Checks coverage, shape, links and wording.
import { describe, expect, it } from "vitest";
import type { GlossaryEntry } from "@/lib/contracts";
import { CURATED_METRICS, baseMetric } from "@/lib/metrics/catalogue";
import { forbiddenWordHits } from "@/test/fixtures/sample/forbidden-words";
import {
  CONCEPTS, GLOSSARY, GLOSSARY_BASIC_IDS, GLOSSARY_INTERMEDIATE_IDS, conceptById, conceptParagraphs, glossaryFor,
} from "./index";

const ENTRIES: GlossaryEntry[] = Object.values(GLOSSARY);
const CONCEPT_IDS = [
  "ttm", "cagr", "fy", "crore-lakh", "consolidated-standalone", "percentile", "why-lenders-differ", "missing-data",
  "what-a-screen-cannot-tell-you", "fictional-sample",
];

/** Sentence count: a full stop, question or exclamation mark followed by a space and a capital, or the end. */
function sentences(text: string): number {
  return (text.match(/[.?!](?=\s+[A-Z'‘"(₹]|$)/g) ?? []).length;
}

function allText(e: GlossaryEntry): string[] {
  return [
    e.whatItTells, e.howToRead, e.workedExample ?? "", e.notApplicableNote ?? "",
    ...e.rulesOfThumb.flatMap((r) => [r.context, r.text]), ...e.pitfalls,
  ];
}

describe("glossary coverage", () => {
  it("has an entry for every basic-level base metric (P0)", () => {
    const basic = CURATED_METRICS.filter((m) => m.level === "basic").map((m) => m.id);
    expect(basic).toHaveLength(25);
    for (const id of basic) expect(GLOSSARY[id], id).toBeDefined();
    expect([...GLOSSARY_BASIC_IDS].sort()).toEqual([...basic].sort());
  });

  it("has an entry for every intermediate-level base metric (P1)", () => {
    const intermediate = CURATED_METRICS.filter((m) => m.level === "intermediate").map((m) => m.id);
    for (const id of intermediate) expect(GLOSSARY[id], id).toBeDefined();
    expect([...GLOSSARY_INTERMEDIATE_IDS].sort()).toEqual([...intermediate].sort());
  });

  it("keys every entry by an existing base metric id", () => {
    for (const [key, e] of Object.entries(GLOSSARY)) {
      expect(e.base).toBe(key);
      expect(baseMetric(key), key).toBeDefined();
    }
    expect(ENTRIES.length).toBe(GLOSSARY_BASIC_IDS.length + GLOSSARY_INTERMEDIATE_IDS.length);
  });

  it("serves variants through their base id", () => {
    expect(glossaryFor("roce")).toBe(GLOSSARY.roce);
    expect(glossaryFor("not_a_metric")).toBeNull();
  });
});

describe("glossary entries", () => {
  it("explain the metric in 2–3 sentences and say how to read it", () => {
    for (const e of ENTRIES) {
      const k = sentences(e.whatItTells);
      expect(k, `${e.base}: ${e.whatItTells}`).toBeGreaterThanOrEqual(2);
      expect(k, `${e.base}: ${e.whatItTells}`).toBeLessThanOrEqual(3);
      expect(e.howToRead.length, e.base).toBeGreaterThan(20);
      expect(e.howToRead.trim().endsWith("."), e.base).toBe(true);
    }
    for (const id of GLOSSARY_BASIC_IDS) {
      const k = sentences(GLOSSARY[id].whatItTells);
      expect(k >= 2 && k <= 3, `${id}: ${GLOSSARY[id].whatItTells}`).toBe(true);
    }
  });

  it("give a worked example in round ₹ crore figures for every basic metric", () => {
    for (const id of GLOSSARY_BASIC_IDS) {
      const ex = GLOSSARY[id].workedExample;
      expect(ex, id).toBeTruthy();
      expect(ex ?? "", id).toMatch(/\d/);
    }
    // Money examples carry the rupee sign; examples about share counts ("crore shares") need not.
    for (const e of ENTRIES) if (/crore(?! shares)(?! of)/.test(e.workedExample ?? "")) expect(e.workedExample, e.base).toMatch(/₹/);
  });

  it("present rules of thumb as context plus text, never as a standard", () => {
    for (const e of ENTRIES) {
      for (const r of e.rulesOfThumb) {
        expect(r.context.length, e.base).toBeGreaterThan(2);
        expect(r.text.length, e.base).toBeGreaterThan(20);
        expect(`${r.context} ${r.text}`, e.base).not.toMatch(/\bstandard\b|\bthe right\b|\balways good\b/i);
      }
    }
  });

  it("explain non-applicability exactly when a family is excluded", () => {
    for (const e of ENTRIES) {
      const def = baseMetric(e.base);
      if (!def) throw new Error(e.base);
      const excludesSome = def.appliesTo.length < 3;
      if (excludesSome) expect(e.notApplicableNote, e.base).toBeTruthy();
      else expect(e.notApplicableNote, e.base).toBeNull();
      if (!def.appliesTo.includes("lender") && e.notApplicableNote) expect(e.notApplicableNote, e.base).toMatch(/bank|NBFC|lender/i);
      if (def.appliesTo.length === 1 && def.appliesTo[0] === "lender") expect(e.notApplicableNote, e.base).toMatch(/only for banks and NBFCs/);
    }
  });

  it("link only to other existing base metrics", () => {
    for (const e of ENTRIES) {
      expect(new Set(e.related).size, e.base).toBe(e.related.length);
      expect(e.related, e.base).not.toContain(e.base);
      for (const id of e.related) expect(baseMetric(id), `${e.base} → ${id}`).toBeDefined();
    }
  });

  it("use plain text with no HTML and none of the forbidden words", () => {
    for (const e of ENTRIES) {
      for (const t of allText(e)) {
        expect(t, e.base).not.toMatch(/<[a-z/]/i);
        expect(forbiddenWordHits(t), `${e.base}: ${t}`).toEqual([]);
        expect(t, e.base).not.toMatch(/\s{2,}|\bscreener\.in\b/i);
      }
    }
  });
});

describe("concepts", () => {
  it("has exactly the ten documented concepts", () => {
    expect(CONCEPTS.map((c) => c.id)).toEqual(CONCEPT_IDS);
  });

  it("has a title and at least two plain-text paragraphs each", () => {
    for (const c of CONCEPTS) {
      expect(c.title.length, c.id).toBeGreaterThan(3);
      const paragraphs = conceptParagraphs(c);
      expect(paragraphs.length, c.id).toBeGreaterThanOrEqual(2);
      for (const p of paragraphs) expect(p.length, c.id).toBeGreaterThan(40);
      expect(c.body, c.id).not.toMatch(/<[a-z/]/i);
      expect(forbiddenWordHits(`${c.title} ${c.body}`), c.id).toEqual([]);
    }
  });

  it("links to concepts or base metrics only", () => {
    for (const c of CONCEPTS) {
      expect(c.related, c.id).not.toContain(c.id);
      for (const r of c.related) expect(CONCEPT_IDS.includes(r) || baseMetric(r) !== undefined, `${c.id} → ${r}`).toBe(true);
    }
  });

  it("can be looked up by id", () => {
    expect(conceptById("cagr")?.title).toMatch(/Compound annual growth rate/);
    expect(conceptById("nope")).toBeNull();
  });

  it("states the honest facts the app relies on", () => {
    expect(conceptById("fictional-sample")?.body).toMatch(/150 fictional companies/);
    expect(conceptById("fictional-sample")?.body).toMatch(/no date/);
    expect(conceptById("what-a-screen-cannot-tell-you")?.body).toMatch(/not a recommendation|Nothing in this app is a recommendation/);
    expect(conceptById("missing-data")?.body).toMatch(/other income, exceptional items, minority interest, lease liabilities and current investments/);
  });
});
