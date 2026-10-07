import { describe, expect, it } from "vitest";
import type { FundamentalsDataset } from "@/lib/contracts";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import {
  ANNUAL_MONEY_FIELDS, applyMoneyScale, MONEY_SCALE_TO_CRORE, QUARTER_MONEY_FIELDS, scaleMoney, sniffUnits,
  SNIFF_REVENUE_MEDIAN, SNIFF_SHARES_CRORE,
} from "./units";

const codes = (ds: FundamentalsDataset) => sniffUnits(ds).map((i) => i.code);

describe("money scale", () => {
  it("converts lakh, rupees and million to crore", () => {
    expect(MONEY_SCALE_TO_CRORE).toEqual({ crore: 1, lakh: 0.01, rupee: 1e-7, million: 0.1 });
    expect(scaleMoney(150, "lakh")).toBe(1.5);
    expect(scaleMoney(52_140_000_000, "rupee")).toBe(5214);
    expect(scaleMoney(1234.5, "million")).toBe(123.45);
    expect(scaleMoney(0.07, "lakh")).toBe(0.0007);
    expect(scaleMoney(null, "lakh")).toBeNull();
    expect(scaleMoney(42, "crore")).toBe(42);
  });

  it("scales only ₹ crore fields: never DPS, shares, prices or percentages", () => {
    expect(ANNUAL_MONEY_FIELDS).not.toContain("dividend_per_share");
    expect(ANNUAL_MONEY_FIELDS).not.toContain("shares_outstanding_ye");
    expect(ANNUAL_MONEY_FIELDS).toContain("revenue");
    expect(QUARTER_MONEY_FIELDS).toHaveLength(5);
    const ds = createTinyDataset();
    const c = ds.companies[0];
    const before = structuredClone(c);
    applyMoneyScale(c, "lakh");
    expect(c.annual[0].revenue).toBe((before.annual[0].revenue ?? 0) / 100);
    expect(c.quarterly[0].revenue).toBe((before.quarterly[0].revenue ?? 0) / 100);
    expect(c.annual[0].dividend_per_share).toBe(before.annual[0].dividend_per_share);
    expect(c.annual[0].shares_outstanding_ye).toBe(before.annual[0].shares_outstanding_ye);
    expect(c.market).toEqual(before.market);
    expect(c.shareholding).toEqual(before.shareholding);
    const snap = ds.companies.find((x) => x.symbol === "TINYSNAP");
    if (!snap) throw new Error("fixture");
    applyMoneyScale(snap, "million");
    expect(snap.market.market_cap_supplied).toBe(500);
    expect(snap.market.price).toBe(250);
    const untouched = createTinyDataset().companies[0];
    applyMoneyScale(untouched, "crore");
    expect(untouched).toEqual(createTinyDataset().companies[0]);
  });
});

describe("unit sniffing (W105)", () => {
  it("raises nothing for data in the right units", () => {
    expect(sniffUnits(createTinyDataset())).toEqual([]);
  });

  it("median revenue above 1e7 means rupees or lakh", () => {
    const ds = createTinyDataset();
    for (const c of ds.companies) for (const r of c.annual) if (r.revenue !== null) r.revenue *= 1e5; // lakh
    expect(codes(ds)).toEqual(["W105_UNITS_RUPEES"]);
    // A single huge company does not move the median.
    const one = createTinyDataset();
    one.companies[0].annual[0].revenue = SNIFF_REVENUE_MEDIAN * 10;
    expect(codes(one)).toEqual([]);
  });

  it("every non-zero shareholding percentage at or below 1 means fractions", () => {
    const ds = createTinyDataset();
    for (const c of ds.companies) {
      for (const s of c.shareholding) {
        for (const f of ["promoter_pct", "promoter_pledged_pct", "fii_pct", "dii_pct"] as const) {
          const v = s[f];
          if (v !== null) s[f] = v / 100;
        }
      }
    }
    expect(codes(ds)).toEqual(["W105_UNITS_FRACTION"]);
    // Zero pledges alone (all 0) are not fractions.
    const zeros = createTinyDataset();
    for (const c of zeros.companies) for (const s of c.shareholding) {
      s.promoter_pct = 0;
      s.fii_pct = 0;
      s.dii_pct = 0;
      s.promoter_pledged_pct = 0;
    }
    expect(codes(zeros)).toEqual([]);
  });

  it("shares outstanding above 1e5 crore means a plain share count", () => {
    const ds = createTinyDataset();
    ds.companies[0].market.shares_outstanding = 100_000_000; // 10 crore shares entered as a count
    expect(sniffUnits(ds)).toMatchObject([{ code: "W105_UNITS_SHARE_COUNT", symbol: "TINYMFG" }]);
    const ye = createTinyDataset();
    ye.companies[1].annual[0].shares_outstanding_ye = SNIFF_SHARES_CRORE + 1;
    expect(codes(ye)).toEqual(["W105_UNITS_SHARE_COUNT"]);
    const edge = createTinyDataset();
    edge.companies[0].market.shares_outstanding = SNIFF_SHARES_CRORE;
    expect(codes(edge)).toEqual([]);
  });

  it("dividend per share above the price means mixed units", () => {
    const ds = createTinyDataset();
    const mfg = ds.companies[0];
    mfg.annual[mfg.annual.length - 1].dividend_per_share = 500; // price 420
    expect(sniffUnits(ds)).toMatchObject([{ code: "W105_UNITS_DPS", symbol: "TINYMFG", period: "FY26" }]);
    const noPrice = createTinyDataset();
    noPrice.companies[0].market.price = null;
    noPrice.companies[0].annual[6].dividend_per_share = 500;
    expect(codes(noPrice)).toEqual([]);
  });
});
