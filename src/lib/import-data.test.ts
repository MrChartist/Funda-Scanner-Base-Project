import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseCSV, parseFundamentals, parseFundamentalsCSV, parseFundamentalsJSON } from "./import-data";
import { runScreen } from "./data-provider";

describe("parseCSV", () => {
  it("handles quotes, escaped quotes, embedded commas/newlines, CRLF and BOM", () => {
    const t = '﻿a,b\r\n"x, y","say ""hi"""\r\n"line1\nline2",z\r\n';
    expect(parseCSV(t)).toEqual([["a", "b"], ["x, y", 'say "hi"'], ["line1\nline2", "z"]]);
  });
  it("skips blank lines", () => {
    expect(parseCSV("a\n\n\nb\n")).toEqual([["a"], ["b"]]);
  });
});

describe("parseFundamentalsCSV", () => {
  it("maps aliases, units and number formats", () => {
    const { rows, issues } = parseFundamentalsCSV(
      'Ticker,Company,Market Cap (Cr),P/E,ROCE (%),D/E,Div Yield\nabc,"ABC, Ltd","1,20,000",25.5,18%,0.4,₹ 1.5\n',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ symbol: "ABC", name: "ABC, Ltd", pe: 25.5, roce: 18, debt_equity: 0.4, dividend_yield: 1.5 });
    expect(rows[0].market_cap).toBe(120000); // Indian digit grouping "1,20,000" is accepted
    expect(issues.every((i) => i.level === "warning")).toBe(true);
  });

  it("treats blanks and NA as missing, junk as missing with a warning", () => {
    const { rows, issues } = parseFundamentalsCSV("symbol,pe,roce\nA,,NA\nB,abc,10\n");
    expect(rows[0].pe).toBeNaN();
    expect(rows[0].roce).toBeNaN();
    expect(rows[1].pe).toBeNaN();
    expect(issues.some((i) => i.row === 2 && /not a number/.test(i.message))).toBe(true);
  });

  it("errors when symbol column is missing", () => {
    const { rows, issues } = parseFundamentalsCSV("name,pe\nX,1\n");
    expect(rows).toEqual([]);
    expect(issues[0]).toMatchObject({ level: "error" });
  });

  it("skips rows with empty symbol and de-duplicates by symbol", () => {
    const { rows, issues } = parseFundamentalsCSV("symbol,pe\nA,1\n,2\nA,3\n");
    expect(rows).toHaveLength(1);
    expect(rows[0].pe).toBe(3);
    expect(issues.filter((i) => /Duplicate|empty symbol/.test(i.message))).toHaveLength(2);
  });

  it("reports an empty file", () => {
    expect(parseFundamentalsCSV("").issues[0].level).toBe("error");
    expect(parseFundamentalsCSV("symbol,pe\n").issues.some((i) => i.level === "error")).toBe(true);
  });
});

describe("parseFundamentalsJSON", () => {
  it("accepts an array or {rows}", () => {
    expect(parseFundamentalsJSON('[{"symbol":"a","pe":10}]').rows[0]).toMatchObject({ symbol: "A", pe: 10 });
    expect(parseFundamentalsJSON('{"rows":[{"symbol":"a","pe":null}]}').rows[0].pe).toBeNaN();
  });
  it("rejects invalid JSON and wrong shapes", () => {
    expect(parseFundamentalsJSON("{").issues[0].message).toMatch(/Invalid JSON/);
    expect(parseFundamentalsJSON('{"a":1}').issues[0].level).toBe("error");
    expect(parseFundamentalsJSON("[1,2]").issues[0].level).toBe("error");
  });
});

describe("parseFundamentals (auto-detect)", () => {
  it("detects JSON by extension or content, otherwise CSV", () => {
    expect(parseFundamentals('[{"symbol":"A"}]').rows).toHaveLength(1);
    expect(parseFundamentals("symbol\nA\n", "x.csv").rows).toHaveLength(1);
  });
});

describe("shipped samples", () => {
  const csv = readFileSync("public/sample-data/fundamentals-sample.csv", "utf8");
  const json = readFileSync("public/sample-data/fundamentals-sample.json", "utf8");
  const template = readFileSync("public/sample-data/fundamentals-template.csv", "utf8");

  it("parse without errors and agree with each other", () => {
    const a = parseFundamentals(csv, "s.csv");
    const b = parseFundamentals(json, "s.json");
    expect(a.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(b.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(a.rows).toHaveLength(6);
    expect(JSON.stringify(a.rows, (_k, v) => (Number.isNaN(v) ? null : v))).toBe(JSON.stringify(b.rows, (_k, v) => (Number.isNaN(v) ? null : v)));
  });

  it("template has every column with no warnings", () => {
    const r = parseFundamentals(template, "t.csv");
    expect(r.rows).toHaveLength(1);
    expect(r.issues).toEqual([]);
  });

  it("works with the screening engine; missing values are excluded and sorted last", () => {
    const { rows } = parseFundamentals(csv, "s.csv");
    const hiRoce = runScreen(rows, { filters: [{ metric: "roce", operator: "gt", value: 20 }] }).map((r) => r.symbol);
    expect(hiRoce).toEqual(["DELTA", "ALPHA", "ZETA"]); // default sort: market cap, high to low
    const sorted = runScreen(rows, { filters: [], sortKey: "roce", sortDir: "desc" }).map((r) => r.symbol);
    expect(sorted[sorted.length - 1]).toBe("BETA"); // BETA has no ROCE
  });
});
