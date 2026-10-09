import { describe, expect, it } from "vitest";
import { createStore } from "@/lib/engine";
import { allMetricDefs } from "@/lib/metrics";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { compileQuery } from "./compile";
import {
  buildNameIndex, collisions, editDistance, normalisePhrase, phrasesOf, resolveExact, resolvePhrase, suggestMetrics,
} from "./names";

const index = buildNameIndex(allMetricDefs());
const store = createStore(createTinyDataset());
const resolve = (text: string) => resolvePhrase(index, normalisePhrase(text).split(" "));

describe("metric name index (§D.4)", () => {
  it("has no phrase claimed by two definitions (build-time collision test)", () => {
    expect(collisions(index)).toEqual([]);
  });

  it("has no alias that contains and, or, not or between", () => {
    for (const d of allMetricDefs()) {
      for (const alias of d.aliases) {
        const words = normalisePhrase(alias).split(" ");
        for (const kw of ["and", "or", "not", "between"]) expect(words.includes(kw), `${d.id}: ${alias}`).toBe(false);
      }
    }
  });

  it("makes every id, label and short name resolvable", () => {
    for (const d of allMetricDefs()) {
      expect(resolveExact(index, d.id)).toMatchObject({ kind: "ok", id: d.id });
      expect(resolveExact(index, d.label)).toMatchObject({ kind: "ok", id: d.id });
      expect(phrasesOf(d).length).toBeGreaterThan(0);
    }
  });

  it("resolves ordered tokens, so word order matters", () => {
    expect(resolve("price to earnings")).toMatchObject({ kind: "ok", id: "pe" });
    expect(resolve("earnings to price")).toMatchObject({ kind: "ok", id: "earnings_to_price" });
    expect(resolve("debt to equity")).toMatchObject({ kind: "ok", id: "debt_equity" });
  });

  it("normalises years, average/mean and previous", () => {
    expect(normalisePhrase("Average ROCE 5 years")).toBe("avg roce 5y");
    expect(normalisePhrase("mean roe 3 yrs")).toBe("avg roe 3y");
    expect(normalisePhrase("Previous sales")).toBe("prev sales");
    expect(resolve("roce 5y avg")).toMatchObject({ kind: "ok", id: "roce_avg_5y" });
    expect(resolve("average roce 5 years")).toMatchObject({ kind: "ok", id: "roce_avg_5y" });
    expect(resolve("sales cagr 5y")).toMatchObject({ kind: "ok", id: "sales_cagr_5y" });
  });

  it("takes the longest match and reports the words left over", () => {
    expect(resolve("roce foo")).toMatchObject({ kind: "ok", id: "roce", used: 1 });
    const q = compileQuery("roce foo > 15", store);
    expect(q.issues.filter((i) => i.level === "error").map((i) => i.code)).toEqual(["E_UNEXPECTED_TOKEN"]);
    expect(q.issues[0].span.start).toBe(5);
  });

  it("does not accept Screener-style idioms as aliases", () => {
    // "sales growth 5y" is not an alias of the 5-year CAGR: only "sales growth" (FY YoY) matches.
    expect(resolve("sales growth 5years")).toMatchObject({ kind: "ok", id: "sales_growth", used: 2 });
    expect(resolve("sales preceding year")).toMatchObject({ kind: "ok", id: "sales", used: 1 });
    expect(compileQuery("sales preceding year > 100", store).ok).toBe(false);
    expect(resolve("sales last year").kind).toBe("period_word");
  });

  it("matches backtick names exactly, including words such as and", () => {
    expect(resolveExact(index, "Cash and bank balances")).toMatchObject({ kind: "ok", id: "cash_and_bank" });
    expect(resolveExact(index, "cash and bank")).toMatchObject({ kind: "ok", id: "cash_and_bank" });
    expect(resolveExact(index, "Cash and bank bal")).toMatchObject({ kind: "unknown" });
    const q = compileQuery("`Cash and bank bal` > 0", store);
    expect(q.issues[0].code).toBe("E_UNKNOWN_METRIC");
  });

  it("suggests up to three close metrics", () => {
    const s = suggestMetrics(index, "debt equty", store);
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(3);
    expect(s[0].id).toBe("debt_equity");
    expect(suggestMetrics(index, "rcoe", null)[0].id).toBe("roce");
    expect(suggestMetrics(index, "zzzzzzzzzz", null)).toEqual([]);
  });

  it("computes the Damerau-Levenshtein distance with transpositions", () => {
    expect(editDistance("roce", "roce")).toBe(0);
    expect(editDistance("rcoe", "roce")).toBe(1);
    expect(editDistance("debt_equty", "debt_equity")).toBe(1);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("kitten", "sitting")).toBe(3);
  });

  it("reports an ambiguous phrase with both definitions", () => {
    const defs = allMetricDefs();
    const a = { ...defs[0], id: "aaa_one", aliases: ["shared phrase"] };
    const b = { ...defs[0], id: "aaa_two", aliases: ["shared phrase"] };
    const idx = buildNameIndex([a, b]);
    expect(collisions(idx).map((c) => c.phrase)).toContain("shared phrase");
    expect(resolvePhrase(idx, ["shared", "phrase"])).toMatchObject({ kind: "ambiguous", ids: ["aaa_one", "aaa_two"] });
  });
});
