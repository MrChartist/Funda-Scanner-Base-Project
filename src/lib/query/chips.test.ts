import { describe, expect, it } from "vitest";
import type { ChipModel } from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { chipText, fromChips, hasComments, isChipComplete, toChips } from "./index";
import { compileQuery } from "./compile";

const store = createStore(createTinyDataset());
const chipsOf = (q: string) => toChips(compileQuery(q, store));

describe("chips (§D.10)", () => {
  it("turns simple clauses into editable chips and keeps SORT BY / LIMIT as the tail", () => {
    const m = chipsOf("roce > 15\nsales[prev] >= 1.5lakh\nroe BETWEEN 15 AND 25\npe < -2 SORT BY roce DESC LIMIT 10");
    expect(m.chips).toEqual([
      { kind: "simple", id: "c0", metric: "roce", selector: null, op: ">", value: "15", value2: "" },
      { kind: "simple", id: "c1", metric: "sales", selector: { kind: "prev" }, op: ">=", value: "150000", value2: "" },
      { kind: "simple", id: "c2", metric: "roe", selector: null, op: "between", value: "15", value2: "25" },
      { kind: "simple", id: "c3", metric: "pe", selector: null, op: "<", value: "-2", value2: "" },
    ]);
    expect(m.tail).toBe("SORT BY roce DESC LIMIT 10");
  });

  it("makes type chips from IS tests and NOT IS tests", () => {
    const m = chipsOf("is lender\nNOT is bank\nIS NOT insurer");
    expect(m.chips.map((c) => (c.kind === "type" ? [c.test, c.negated] : null))).toEqual([
      ["lender", false], ["bank", true], ["insurer", true],
    ]);
  });

  it("shows anything else as an advanced rule with its English text", () => {
    const m = chipsOf("every(roce > 15, 5y)\n(roe > 20 OR roce > 20)\nroe > pe");
    expect(m.chips.map((c) => c.kind)).toEqual(["advanced", "advanced", "advanced"]);
    const adv = m.chips[0];
    expect(adv.kind === "advanced" && adv.english).toBe("ROCE was above 15% in each of the last 5 financial years");
    expect(adv.kind === "advanced" && adv.text).toBe("every(roce > 15, 5y)");
    // An OR group keeps its brackets so that a new line (AND) cannot regroup it.
    expect(m.chips[1].kind === "advanced" && m.chips[1].text).toBe("(roe > 20 OR roce > 20)");
  });

  it("round-trips: chips → text → chips", () => {
    const queries = [
      "roce > 15\nsales[fy-3] < 100\nroe BETWEEN 15 AND 25",
      "is lender\nroa_avg_3y > 1\n(roe > 20 OR roce > 20)\nNOT is bank",
      "every(roce > 15, 5y)\ndebt_equity < 0.5 SORT BY rank(pe) ASC LIMIT 5",
      "pe < industry_median(pe)\nmarket_cap > 500",
    ];
    for (const q of queries) {
      const a = chipsOf(q);
      const text = fromChips(a);
      const b = toChips(compileQuery(text, store));
      expect(compileQuery(text, store).ok).toBe(true);
      expect(b).toEqual(a);
      expect(fromChips(b)).toBe(text);
    }
  });

  it("prints one clause per line and leaves incomplete chips out", () => {
    const model: ChipModel = {
      chips: [
        { kind: "simple", id: "a", metric: "roce", selector: { kind: "fy", offset: 1 }, op: ">", value: "15", value2: "" },
        { kind: "simple", id: "b", metric: "pe", selector: null, op: "<", value: "", value2: "" },
        { kind: "simple", id: "c", metric: "roe", selector: null, op: "between", value: "10", value2: "x" },
        { kind: "type", id: "t", test: "lender", negated: true },
        { kind: "advanced", id: "d", text: "every(roce > 15, 5y)", english: "" },
      ],
      tail: "LIMIT 5",
    };
    expect(fromChips(model)).toBe("roce[fy-1] > 15\nIS NOT lender\nevery(roce > 15, 5y)\nLIMIT 5");
    expect(isChipComplete(model.chips[1])).toBe(false);
    expect(isChipComplete(model.chips[2])).toBe(false);
    expect(chipText(model.chips[1])).toBe("");
    expect(fromChips({ chips: [], tail: "" })).toBe("");
  });

  it("reports whether a query has comments (kept only in Query mode)", () => {
    expect(hasComments("roce > 15 # strong")).toBe(true);
    expect(hasComments('sector = "#1 Cement"')).toBe(false);
  });
});
