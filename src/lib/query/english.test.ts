import { describe, expect, it } from "vitest";
import { createStore } from "@/lib/engine";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { VALID_QUERIES } from "@/test/fixtures/query/golden-queries";
import { compileQuery } from "./compile";

const store = createStore(createTinyDataset());
const clause = (q: string) => compileQuery(q, store).clauses[0].english;
const whole = (q: string) => compileQuery(q, store).english;

const FORBIDDEN = /\b(buy|sell|strong buy|avoid|fraud|multibagger|target price|guaranteed|sure shot|will go bankrupt)\b/i;

describe("plain-English rendering (§D.10)", () => {
  it("renders the examples in the spec", () => {
    expect(clause("every(roce > 15, 5y)")).toBe("ROCE was above 15% in each of the last 5 financial years");
    expect(clause("pe < industry_median(pe)")).toBe(
      "P/E (TTM) is below the median P/E of its industry (among companies in your data)",
    );
    expect(clause("count(net_profit > 0, 10y) >= 8")).toMatch(/^In at least 8 of the last 10 financial years, net profit was above/);
    expect(clause("NOT is lender")).toBe("The company is not a bank or NBFC");
    expect(whole("is non_financial AND earnings_yield > 0 SORT BY rank(earnings_yield) + rank(roic) ASC LIMIT 30")).toContain(
      "ordered by the sum of their ranks on earnings yield (EBIT / EV) and ROIC among the matching companies (lowest sum first), keeping the top 30",
    );
  });

  it("joins clauses with ', and' and alternatives with 'either … or'", () => {
    expect(whole("roce > 15 AND debt_equity < 0.5")).toBe(
      "Companies where ROCE (latest FY) is above 15%, and D/E (latest FY) is below 0.5x. Companies with missing data are not counted as matches.",
    );
    expect(clause("roe > 20 OR roce > 20")).toBe("Either ROE (latest FY) is above 20% or ROCE (latest FY) is above 20%");
    expect(clause("roe > 1 OR pe < 2 OR roce > 3")).toMatch(/^At least one of these holds: /);
  });

  it("always states the period, and never implies TTM", () => {
    expect(clause("sales > 100")).toBe("Sales (latest FY) is above ₹100 Cr");
    expect(clause("sales[ttm] > 100")).toBe("Sales (TTM) is above ₹100 Cr");
    expect(clause("sales[fy-2] > 100")).toBe("Sales (2 financial years before the latest) is above ₹100 Cr");
    expect(clause("sales[prev] > 100")).toBe("Sales (previous financial year) is above ₹100 Cr");
    expect(clause("q_sales[q-4] > 1")).toBe("Quarterly sales (4 quarters before the latest) is above ₹1 Cr");
    expect(clause("roce_avg_5y > 15")).toBe("ROCE averaged over the last 5 financial years is above 15%");
    expect(clause("sales_cagr_5y > 12")).toBe("Sales growth (CAGR) over the last 5 financial years is above 12%");
  });

  it("states the scope of peer functions and rank", () => {
    expect(clause("sector_pctl(roce_avg_5y) >= 80")).toBe(
      "ROCE averaged over the last 5 financial years is at least the 80th percentile within its sector (among companies in your data)",
    );
    expect(whole("pe < 20 SORT BY rank(roce)")).toContain("the rank of ROCE (latest FY) among the matching companies (1 = highest)");
  });

  it("renders units of literals from the other side", () => {
    expect(clause("market_cap BETWEEN 500cr AND 20k")).toBe("Market capitalisation is between ₹500 Cr and ₹20,000 Cr");
    expect(clause("debt_equity < 0.5")).toBe("D/E (latest FY) is below 0.5x");
    expect(clause("opm > avg(opm, 5y) + 2")).toBe(
      "OPM (latest FY) is above the average of OPM over the last 5 financial years plus 2 percentage points",
    );
    expect(clause('sector IN ("Cement", "Metals & Mining")')).toBe("The sector is one of Cement or Metals & Mining");
    expect(clause('sector != "IT services"')).toBe("The sector is not IT services");
  });

  it("ends every rendering with the missing-data note and uses no forbidden words", () => {
    for (const q of VALID_QUERIES) {
      const e = whole(q);
      expect(e).toMatch(/Companies with missing data are not counted as matches\.$/);
      expect(FORBIDDEN.test(e)).toBe(false);
    }
    expect(whole("")).toBe("All companies in the selected universe. Companies with missing data are not counted as matches.");
  });
});
