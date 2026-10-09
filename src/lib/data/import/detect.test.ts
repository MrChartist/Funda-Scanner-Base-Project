import { describe, expect, it } from "vitest";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { ANNUAL_FIELD_INFO, ANNUAL_FIELDS, QUARTER_FIELDS, SHAREHOLDING_FIELD_INFO, SHAREHOLDING_FIELDS } from "@/lib/contracts";
import { detectFileKind } from "./detect";
import { ANNUAL_ALIASES, normHeader, normHeaderLoose, QUARTER_ALIASES, resolveHeader, SHAREHOLDING_ALIASES } from "./aliases";

describe("detectFileKind", () => {
  it("detects JSON shapes", () => {
    expect(detectFileKind("x.json", JSON.stringify(createTinyDataset()))).toBe("canonical_json");
    expect(detectFileKind("x.txt", `\uFEFF${JSON.stringify(createTinyDataset())}`)).toBe("canonical_json");
    expect(detectFileKind("x.json", "[]")).toBe("snapshot");
    expect(detectFileKind("x.json", '{"rows":[]}')).toBe("snapshot");
    expect(detectFileKind("x.json", '{"other":1}')).toBe("unknown");
    expect(detectFileKind("x.json", "{bad")).toBe("unknown");
  });

  it("detects CSV kinds from headers and aliases", () => {
    expect(detectFileKind("a.csv", "# comment\nsymbol,fiscal_year,revenue\n")).toBe("annual");
    expect(detectFileKind("a.csv", "Ticker,FY,Sales\n")).toBe("annual");
    expect(detectFileKind("q.csv", "symbol,period_end,revenue\n")).toBe("quarterly");
    expect(detectFileKind("q.csv", "Symbol,Quarter End,Sales,PAT\n")).toBe("quarterly");
    expect(detectFileKind("s.csv", "symbol,period_end,promoter_pct\n")).toBe("shareholding");
    expect(detectFileKind("s.csv", "symbol,date,FII,DII\n")).toBe("shareholding");
    expect(detectFileKind("f.csv", "\uFEFFsymbol,name,sector,pe,roce\n")).toBe("snapshot");
    expect(detectFileKind("f.csv", "Ticker,Company,Market Cap (Cr),P/E,ROCE (%)\n")).toBe("snapshot");
    expect(detectFileKind("c.csv", "symbol,name,sector,isin\n")).toBe("companies");
    expect(detectFileKind("c.csv", "symbol,name,sector\n")).toBe("companies");
    expect(detectFileKind("c.csv", "symbol,name,isin,pe\n")).toBe("companies"); // companies with snapshot ratios
    expect(detectFileKind("z.csv", "foo,bar\n")).toBe("unknown");
    expect(detectFileKind("z.csv", "symbol\n")).toBe("unknown");
    expect(detectFileKind("z.csv", "")).toBe("unknown");
  });
});

describe("aliases", () => {
  it("normalises headers", () => {
    expect(normHeader("ROCE (%)")).toBe("roce");
    expect(normHeaderLoose("Revenue (₹ Cr)")).toBe("revenue");
    expect(normHeaderLoose("Revenue in Rs Cr")).toBe("revenue");
    expect(normHeaderLoose("Total assets [₹ crore]")).toBe("totalassets");
  });

  it("every field resolves from its own name, its FieldInfo label and its metric id", () => {
    for (const f of ANNUAL_FIELDS) {
      expect(resolveHeader(ANNUAL_ALIASES, f)).toBe(f);
      expect(resolveHeader(ANNUAL_ALIASES, ANNUAL_FIELD_INFO[f].label)).toBe(f);
      expect(resolveHeader(ANNUAL_ALIASES, ANNUAL_FIELD_INFO[f].metricId)).toBe(f);
    }
    for (const f of QUARTER_FIELDS) expect(resolveHeader(QUARTER_ALIASES, f)).toBe(f);
    for (const f of SHAREHOLDING_FIELDS) {
      expect(resolveHeader(SHAREHOLDING_ALIASES, f)).toBe(f);
      expect(resolveHeader(SHAREHOLDING_ALIASES, SHAREHOLDING_FIELD_INFO[f].label)).toBe(f);
    }
    expect(resolveHeader(ANNUAL_ALIASES, "Sales")).toBe("revenue");
    expect(resolveHeader(ANNUAL_ALIASES, "colour")).toBeNull();
  });
});
