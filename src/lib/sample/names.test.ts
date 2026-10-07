// Real-name guard (§F.4): generated names and symbols never match the test-only denylist.
import { describe, expect, it } from "vitest";
import {
  DENYLIST_SYMBOLS, DENYLIST_WORDS, denylistSymbolHits, denylistWordHits,
} from "@/test/fixtures/sample/real-name-denylist";
import { forbiddenWordHits } from "@/test/fixtures/sample/forbidden-words";
import { SECTORS, SECTOR_ORDER } from "./archetypes";
import { generateSampleDataset, samplePlans } from "./index";
import { STEMS, companyName, companySymbol, stressName, stressNumber, stressSymbol } from "./names";

describe("denylist fixture", () => {
  it("holds about 250 well-known symbols plus the group and brand words named in the spec", () => {
    expect(DENYLIST_SYMBOLS.length).toBeGreaterThanOrEqual(250);
    expect(new Set(DENYLIST_SYMBOLS).size).toBe(DENYLIST_SYMBOLS.length);
    for (const w of ["Tata", "Reliance", "Adani", "Birla", "Bajaj", "Mahindra", "HDFC", "ICICI", "Infosys", "Wipro",
      "Kotak", "Godrej", "Hero", "Maruti", "Airtel", "Vedanta", "Jindal", "Murugappa", "TVS"]) {
      expect(DENYLIST_WORDS).toContain(w);
    }
  });

  it("catches real names and symbols (the guard itself works)", () => {
    expect(denylistWordHits("Tata Motors Ltd")).toContain("Tata");
    expect(denylistWordHits("Some Sun Pharma Unit")).toContain("Sun Pharma");
    expect(denylistWordHits("HERO cycles")).toContain("Hero");
    expect(denylistWordHits("Heroic Foods Ltd")).toEqual([]);
    expect(denylistSymbolHits("INFY")).toContain("INFY");
    expect(denylistSymbolHits("TATAXYZ")).toContain("TATA");
    expect(denylistSymbolHits("VARNEXPOLY")).toEqual([]);
  });
});

describe("generated names and symbols", () => {
  it("never match the denylist in the 150-company sample", () => {
    const hits: string[] = [];
    for (const c of generateSampleDataset().companies) {
      for (const h of denylistWordHits(c.name)) hits.push(`${c.name}: ${h}`);
      for (const h of denylistSymbolHits(c.symbol)) hits.push(`${c.symbol}: ${h}`);
    }
    expect(hits).toEqual([]);
  });

  it("keep teaching notes and metadata free of real names and forbidden words", () => {
    const ds = generateSampleDataset();
    const texts = [...ds.meta.notes, ds.meta.name, ...ds.companies.flatMap((c) => [c.sample_note ?? "", c.source_note ?? "", c.sector, c.industry ?? ""])];
    for (const t of texts) {
      expect(denylistWordHits(t), t).toEqual([]);
      expect(forbiddenWordHits(t), t).toEqual([]);
    }
  });

  it("never match the denylist for any stem with any sector noun", () => {
    const hits: string[] = [];
    for (const stem of STEMS) {
      for (const key of SECTOR_ORDER) {
        for (const noun of SECTORS[key].nouns) {
          for (const h of denylistWordHits(companyName(stem, noun))) hits.push(`${stem} ${noun.noun}: ${h}`);
          for (const h of denylistSymbolHits(companySymbol(stem, noun))) hits.push(`${companySymbol(stem, noun)}: ${h}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("has enough unique invented stems for the roster", () => {
    expect(new Set(STEMS).size).toBe(STEMS.length);
    expect(STEMS.length).toBeGreaterThanOrEqual(samplePlans().length);
    for (const s of STEMS) expect(s).toMatch(/^[A-Z][a-z]{3,7}$/);
  });

  it("builds names and symbols in the documented form", () => {
    const noun = { noun: "Polymers", code: "POLY" };
    expect(companyName("Varnex", noun)).toBe("Varnex Polymers Ltd");
    expect(companySymbol("Varnex", noun)).toBe("VARNEXPOLY");
    expect(companySymbol("Quelulon", { noun: "Securities", code: "SEC" })).toBe("QUELULSEC");
    expect(stressNumber(7, 5000)).toBe("0007");
    expect(stressNumber(7, 12000)).toBe("00007");
    expect(stressSymbol(42, 5000)).toBe("SYN0042");
    expect(stressName(5000, 5000)).toBe("Synthetic Company 5000 (stress test)");
  });
});
