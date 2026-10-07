// src/test/contracts.test.ts — WS8 cross-cutting contract tests (spec §G.3).
// These guard the seams between streams: the catalogue, the formatter, the glossary, the rule sets,
// the copy rules (§F.6) and the removal of the old mock data.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NULL_REASONS, COMPANY_SECTION_IDS, type CheckRule, type CompanySectionId, type NullReason } from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { formatMetric, NULL_REASON_TEXT } from "@/lib/format/metric-value";
import { CHECK_RULES, insightColumnProviders } from "@/lib/insights";
import { CONCEPTS, GLOSSARY, GLOSSARY_BASIC_IDS } from "@/lib/learn";
import { allMetricDefs } from "@/lib/metrics";
import { BASE_METRICS } from "@/lib/metrics/catalogue";
import { DERIVERS, PROVIDED_IDS } from "@/lib/metrics/derive";
import { compileQuery } from "@/lib/query";
import { nameIndexFor, resolveExact } from "@/lib/query/names";
import { generateSampleDataset } from "@/lib/sample";
import { TEMPLATES } from "@/lib/screen";
import { denylistSymbolHits, denylistWordHits } from "@/test/fixtures/sample/real-name-denylist";
import { forbiddenWordHits } from "@/test/fixtures/sample/forbidden-words";

const ROOT = resolve(__dirname, "..", "..");
const SRC = join(ROOT, "src");

const DATASET = generateSampleDataset();
const STORE = createStore(DATASET);
const DEFS = allMetricDefs();
const PROVIDER_IDS = new Set(insightColumnProviders.flatMap((p) => [...p.ids]));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe("catalogue contract (§G.3)", () => {
  it("every base metric has a deriver or a column provider", () => {
    for (const d of BASE_METRICS) {
      const served = Object.prototype.hasOwnProperty.call(DERIVERS, d.id) || PROVIDER_IDS.has(d.id);
      expect(served, `${d.id} has neither a deriver nor a provider`).toBe(true);
    }
    for (const id of PROVIDED_IDS) expect(PROVIDER_IDS.has(id), `${id} is declared provided but no provider serves it`).toBe(true);
  });

  it("every catalogue id, variants included, produces a column on the store", () => {
    for (const d of DEFS) {
      const col = STORE.column(d.id);
      expect(col.values.length, d.id).toBe(STORE.size);
      expect(col.reasons.length, d.id).toBe(STORE.size);
    }
  });

  it("every id has a formatter result for the value and for each null reason", () => {
    for (const d of DEFS) {
      const shown = formatMetric(d, { v: 1, reason: null, flags: 0 });
      expect(shown, d.id).not.toBe("—");
      expect(shown, d.id).not.toMatch(/NaN|undefined|Infinity/);
      for (const r of NULL_REASONS) {
        if (r === "none") continue;
        expect(formatMetric(d, { v: null, reason: r as NullReason, flags: 0 }), `${d.id}/${r}`).toBe("—");
      }
    }
    for (const r of NULL_REASONS) {
      if (r === "none") continue;
      const t = NULL_REASON_TEXT[r as NullReason];
      expect(t?.short.length, r).toBeGreaterThan(0);
      expect(t?.long.length, r).toBeGreaterThan(0);
    }
  });

  it("every id has an alias that resolves back to it", () => {
    const index = nameIndexFor(STORE);
    for (const d of DEFS) {
      const phrases = [d.id, d.short, d.label, ...d.aliases];
      const resolving = phrases.filter((p) => {
        const r = resolveExact(index, p);
        return r.kind === "ok" && r.id === d.id;
      });
      expect(resolving.length, `${d.id}: no phrase resolves to it`).toBeGreaterThan(0);
      // The spaced form of the id is always a usable alias.
      const spaced = resolveExact(index, d.id.replace(/_/g, " "));
      expect(spaced.kind === "ok" && spaced.id, d.id).toBe(d.id);
      for (const a of d.aliases) {
        const r = resolveExact(index, a);
        expect(r.kind === "ok" ? r.id : r.kind, `alias "${a}" of ${d.id}`).toBe(d.id);
      }
    }
  });

  it("every tooltip is 120 characters or fewer", () => {
    for (const d of DEFS) {
      expect(d.tooltip.length, d.id).toBeGreaterThan(0);
      expect(d.tooltip.length, d.id).toBeLessThanOrEqual(120);
    }
  });

  it("every basic-level base metric has a glossary entry", () => {
    const basic = BASE_METRICS.filter((d) => d.level === "basic");
    expect(basic).toHaveLength(25);
    for (const d of basic) {
      expect(GLOSSARY[d.id], `${d.id} has no glossary entry`).toBeDefined();
      expect(GLOSSARY_BASIC_IDS).toContain(d.id);
    }
    for (const id of Object.keys(GLOSSARY)) expect(BASE_METRICS.some((d) => d.id === id), `glossary id ${id} is not a base metric`).toBe(true);
    expect(CONCEPTS).toHaveLength(10);
  });
});

describe("templates and rules (§G.3)", () => {
  const ids = new Set(DEFS.map((d) => d.id));

  it("every template parses, uses only catalogue ids and never uses coalesce", () => {
    expect(TEMPLATES.length).toBe(7);
    for (const t of TEMPLATES) {
      expect(t.query, t.id).not.toMatch(/\bcoalesce\b/i);
      const c = compileQuery(t.query, STORE);
      expect(c.issues.filter((x) => x.level === "error"), t.id).toEqual([]);
      expect(c.metrics.length, t.id).toBeGreaterThan(0);
      for (const m of c.metrics) expect(ids.has(m), `${t.id} uses unknown id ${m}`).toBe(true);
      for (const col of t.columns) expect(ids.has(col), `${t.id} column ${col}`).toBe(true);
    }
  });

  it("every insight rule parses, uses only catalogue ids, never uses coalesce and never references red_flag_count", () => {
    expect(CHECK_RULES.length).toBeGreaterThanOrEqual(42);
    for (const r of CHECK_RULES) {
      expect(r.query, r.id).not.toMatch(/\bcoalesce\b/i);
      expect(r.query, r.id).not.toMatch(/\bred_flag_count\b/);
      const c = compileQuery(r.query, STORE);
      expect(c.issues.filter((x) => x.level === "error"), r.id).toEqual([]);
      for (const m of c.metrics) expect(ids.has(m), `${r.id} uses unknown id ${m}`).toBe(true);
      for (const e of r.evidence) expect(ids.has(e), `${r.id} evidence ${e}`).toBe(true);
      for (const l of r.learn) expect(ids.has(l), `${r.id} learn ${l}`).toBe(true);
    }
  });

  it("every rule points at a known company section (rendering is checked in the company-page integration test)", () => {
    const sections = new Set<CompanySectionId>(COMPANY_SECTION_IDS);
    for (const r of CHECK_RULES as readonly CheckRule[]) expect(sections.has(r.section), `${r.id}: ${r.section}`).toBe(true);
  });
});

// Forbidden words (§F.6 rule 5). The scan reads the raw source of every file named in §G.3, so a
// hit in a comment or identifier would fail too. None exists today; if one appears for a
// legitimate reason, scope the scan to string literals and JSX text and write the reason here.
describe("forbidden words (§F.6 rule 5)", () => {
  const isTestFile = (p: string) => /\.(test|spec)\.tsx?$/.test(p);
  const inDir = (dir: string, ext: RegExp) => walk(join(SRC, dir)).filter((p) => ext.test(p) && !isTestFile(p));

  const scanned: string[] = [
    ...inDir("lib/learn", /\.tsx?$/),
    ...inDir("lib/insights", /\.tsx?$/),
    join(SRC, "lib/screen/templates.ts"),
    join(SRC, "lib/format/metric-value.ts"),
    join(SRC, "lib/query/errors.ts"),
    ...["screener", "company", "compare", "dashboard", "learn", "common"].flatMap((d) => inDir(`components/${d}`, /\.tsx$/)),
    ...walk(join(SRC, "pages")).filter((p) => /\.tsx$/.test(p) && !isTestFile(p)),
    join(SRC, "components/Footer.tsx"),
  ];

  it("scans a meaningful number of files", () => {
    expect(scanned.length).toBeGreaterThan(60);
    for (const p of scanned) expect(statSync(p).isFile(), p).toBe(true);
  });

  it("no scanned file contains a forbidden word", () => {
    const hits: string[] = [];
    for (const p of scanned) {
      const found = forbiddenWordHits(readFileSync(p, "utf8"));
      if (found.length) hits.push(`${relative(ROOT, p)}: ${found.join(", ")}`);
    }
    expect(hits).toEqual([]);
  });

  it("the scanner itself catches each forbidden word and respects word boundaries", () => {
    for (const w of ["buy", "SELL", "Strong  Buy", "avoid", "fraud", "multibagger", "target price", "guaranteed", "sure shot", "will go bankrupt"]) {
      expect(forbiddenWordHits(`text ${w} text`).length, w).toBeGreaterThan(0);
    }
    expect(forbiddenWordHits("Buyback, seller, avoidance and sellers are different words")).toEqual([]);
  });

  it("rendered rule and template copy is clean", () => {
    for (const r of CHECK_RULES) expect(forbiddenWordHits(`${r.title} ${r.test}`), r.id).toEqual([]);
    for (const t of TEMPLATES) {
      expect(forbiddenWordHits([t.title, t.idea, ...t.clauseNotes, ...t.misses, ...t.notFor, t.tryChanging].join(" ")), t.id).toEqual([]);
    }
  });
});

describe("real-name denylist over sample output (§F.4)", () => {
  it("no generated name, symbol or note matches a real name", () => {
    const hits: string[] = [];
    for (const c of DATASET.companies) {
      for (const h of denylistSymbolHits(c.symbol)) hits.push(`${c.symbol} symbol: ${h}`);
      for (const h of denylistWordHits(c.name)) hits.push(`${c.symbol} name: ${h}`);
      for (const h of denylistWordHits(c.sample_note ?? "")) hits.push(`${c.symbol} note: ${h}`);
    }
    expect(hits).toEqual([]);
    expect(DATASET.companies.length).toBe(150);
  });

  it("the stress set (SYN symbols) is clean too", () => {
    const ds = generateSampleDataset({ count: 300 });
    for (const c of ds.companies) {
      expect(denylistSymbolHits(c.symbol), c.symbol).toEqual([]);
      expect(denylistWordHits(c.name), c.symbol).toEqual([]);
    }
  });
});

describe("no mock data (§E.10 task 1)", () => {
  it("nothing under src imports or names mock-data", () => {
    // Test files are skipped because several of them assert the absence of the old module by name.
    const files = walk(SRC).filter((p) => /\.(tsx?|css|json)$/.test(p) && !/\.test\.tsx?$/.test(p));
    const offenders = files.filter((p) => /mock-data|getMockCompanyIntelligence|MOCK_COMPANIES/.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => relative(ROOT, p))).toEqual([]);
    expect(files.some((p) => /mock-data/.test(p))).toBe(false);
  });
});
