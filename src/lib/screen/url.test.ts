import { describe, expect, it } from "vitest";
import type { ScreenUrlState } from "@/lib/contracts";
import { decodeScreenUrl, encodeScreenUrl } from "./url";

const base: ScreenUrlState = {
  v: 1, query: "", columns: null, sort: null, universe: { kind: "all" }, templateId: null, page: 1, pageSize: 25,
};
const roundTrip = (s: ScreenUrlState) => decodeScreenUrl(new URLSearchParams(encodeScreenUrl(s).toString()));

describe("screen URL codec", () => {
  it("writes a short, readable, versioned URL and leaves defaults out", () => {
    expect(encodeScreenUrl(base).toString()).toBe("v=1");
    const s: ScreenUrlState = {
      ...base, query: "roce > 15", columns: [{ kind: "metric", id: "roce_avg_5y" }, { kind: "metric", id: "pe" }],
      sort: { key: "roce_avg_5y", dir: "desc" }, universe: { kind: "sector", sector: "Cement" }, templateId: "quality", page: 2, pageSize: 50,
    };
    expect(encodeScreenUrl(s).toString()).toBe("v=1&q=roce+%3E+15&cols=roce_avg_5y%2Cpe&sort=-roce_avg_5y&u=sector%3ACement&t=quality&p=2&ps=50");
  });

  it("round-trips every field, including Unicode, new lines, comments and formula columns", () => {
    const states: ScreenUrlState[] = [
      base,
      {
        ...base, query: "roce > 15\npe < 20 # ₹ and “quotes”, commas", columns: [
          { kind: "metric", id: "roce" }, { kind: "expr", expr: "max(roe, roce) / 2", label: "Best: return, halved" },
        ], sort: { key: "expr:1", dir: "asc" }, universe: { kind: "symbols", symbols: ["TINYMFG", "TINYSOFT"] }, templateId: "value",
        page: 7, pageSize: 100,
      },
      { ...base, universe: { kind: "industry", industry: "Metals & Mining: rolled" } },
      { ...base, universe: { kind: "watchlist" } },
      { ...base, universe: { kind: "portfolio" } },
      { ...base, columns: [] },
    ];
    for (const s of states) expect(roundTrip(s)).toEqual(s);
  });

  it("maps the legacy ?sector= parameter to a sector universe", () => {
    expect(decodeScreenUrl(new URLSearchParams("sector=Cement")).universe).toEqual({ kind: "sector", sector: "Cement" });
    expect(decodeScreenUrl(new URLSearchParams("sector=Cement&u=all")).universe).toEqual({ kind: "all" });
  });

  it("falls back to defaults for malformed values", () => {
    const d = decodeScreenUrl(new URLSearchParams("ps=7&p=-1&u=planet:Mars&sort=-&cols=,ROCE,roce,x:%E0"));
    expect(d).toMatchObject({ page: 1, pageSize: 25, universe: { kind: "all" }, sort: null, templateId: null, query: "" });
    expect(d.columns).toEqual([{ kind: "metric", id: "roce" }]);
    expect(decodeScreenUrl(new URLSearchParams("u=symbols:,,")).universe).toEqual({ kind: "all" });
    expect(decodeScreenUrl(new URLSearchParams("p=2.5")).page).toBe(1);
  });
});
