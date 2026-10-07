// src/test/integration/share-link.test.ts — §G.4 #5.
// A screen built from chips survives encode -> URL string -> decode unchanged, gives the same
// result when re-run on the same data, and when re-run on a different dataset it reports the
// coverage problems that dataset really has (no statements, symbols that are not there).
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Chip, FundamentalsDataset, MetricStore, ScreenContext } from "@/lib/contracts";
import { importFiles } from "@/lib/data";
import { createStore } from "@/lib/engine";
import { compileQuery, fromChips, toChips } from "@/lib/query";
import { generateSampleDataset } from "@/lib/sample";
import { decodeScreenUrl, encodeScreenUrl, runScreen } from "@/lib/screen";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";

const CTX: ScreenContext = { watchlist: [], portfolio: [] };

let sample: MetricStore;
let snapshot: MetricStore;
let tiny: MetricStore;

beforeAll(async () => {
  sample = createStore(generateSampleDataset());
  const out = await importFiles([{ name: "fundamentals-sample.csv", text: readFileSync("public/sample-data/fundamentals-sample.csv", "utf8") }]);
  snapshot = createStore(out.dataset as FundamentalsDataset);
  tiny = createStore(createTinyDataset());
});

/** The user adds two rules as chips to a screen that already has a sort and a limit. */
function buildQuery(): string {
  const base = toChips(compileQuery("roce_avg_5y > 15\nSORT BY roce_avg_5y DESC\nLIMIT 10", sample));
  const added: Chip[] = [
    { kind: "simple", id: "n1", metric: "debt_equity", selector: null, op: "<", value: "0.5", value2: "" },
    { kind: "simple", id: "n2", metric: "sales_cagr_5y", selector: null, op: ">", value: "8", value2: "" },
  ];
  return fromChips({ chips: [...base.chips, ...added], tail: base.tail });
}

describe("share link (§G.4 #5)", () => {
  it("builds a query from chips and keeps the sort and limit tail", () => {
    const q = buildQuery();
    expect(q).toContain("roce_avg_5y > 15");
    expect(q).toContain("debt_equity < 0.5");
    expect(q).toContain("sales_cagr_5y > 8");
    expect(q).toMatch(/SORT BY roce_avg_5y DESC/i);
    expect(q).toMatch(/LIMIT 10/i);
    expect(compileQuery(q, sample).ok).toBe(true);
  });

  it("round-trips through a URL string and reproduces the same matches on the same data", () => {
    const query = buildQuery();
    const state = {
      v: 1 as const, query, columns: [{ kind: "metric" as const, id: "roce_avg_5y" }, { kind: "metric" as const, id: "pe" }],
      sort: { key: "pe", dir: "asc" as const }, universe: { kind: "all" as const }, templateId: null, page: 2, pageSize: 50 as const,
    };
    const url = `?${encodeScreenUrl(state).toString()}`;
    const decoded = decodeScreenUrl(new URLSearchParams(url));
    expect(decoded).toEqual(state);

    const before = runScreen(sample, { query: state.query, columns: state.columns, sort: state.sort, universe: state.universe }, CTX);
    const after = runScreen(sample, { query: decoded.query, columns: decoded.columns, sort: decoded.sort, universe: decoded.universe }, CTX);
    expect(before.ok).toBe(true);
    expect(before.matchCount).toBeGreaterThan(0);
    expect(Array.from(after.matched)).toEqual(Array.from(before.matched));
    expect(after.warnings.map((w) => w.code)).toEqual(before.warnings.map((w) => w.code));
  });

  it("re-run on a snapshot-only dataset warns that history is missing and matches nothing", () => {
    const query = buildQuery();
    const decoded = decodeScreenUrl(encodeScreenUrl({
      v: 1, query, columns: null, sort: null, universe: { kind: "all" }, templateId: null, page: 1, pageSize: 25,
    }));
    const run = runScreen(snapshot, { query: decoded.query, columns: decoded.columns, sort: decoded.sort, universe: decoded.universe }, CTX);
    expect(run.ok).toBe(true);
    expect(run.matchCount).toBe(0);
    const w = run.warnings.find((x) => x.code === "W_SNAPSHOT_ONLY");
    expect(w?.count).toBe(snapshot.size);
    // The same screen on the sample has no coverage warning of that kind.
    const onSample = runScreen(sample, { query: decoded.query, columns: decoded.columns, sort: decoded.sort, universe: decoded.universe }, CTX);
    expect(onSample.warnings.map((x) => x.code)).not.toContain("W_SNAPSHOT_ONLY");
  });

  it("a shared symbol list reports the symbols the other dataset does not contain", () => {
    const symbols = [sample.symbols[0], sample.symbols[1], "TINYMFG", "TINYSOFT"];
    const decoded = decodeScreenUrl(encodeScreenUrl({
      v: 1, query: "roce > 5", columns: null, sort: null, universe: { kind: "symbols", symbols }, templateId: null, page: 1, pageSize: 25,
    }));
    expect(decoded.universe).toEqual({ kind: "symbols", symbols });
    const run = runScreen(tiny, { query: decoded.query, columns: decoded.columns, sort: decoded.sort, universe: decoded.universe }, CTX);
    expect(run.universe.length).toBe(2);
    expect(run.warnings.find((x) => x.code === "W_UNKNOWN_SYMBOLS")?.count).toBe(2);
    const here = runScreen(sample, { query: decoded.query, columns: null, sort: null, universe: decoded.universe }, CTX);
    expect(here.warnings.map((x) => x.code)).toContain("W_UNKNOWN_SYMBOLS");
  });

  it("a malformed or hostile query parameter decodes to text and never throws", () => {
    const d = decodeScreenUrl(new URLSearchParams("v=1&q=%3Cscript%3E&cols=x%3A%25E0%3A1&sort=--&p=-4&ps=7&u=symbols%3A"));
    expect(d.query).toBe("<script>");
    expect(d.page).toBe(1);
    expect(d.pageSize).toBe(25);
    expect(d.universe).toEqual({ kind: "all" });
    expect(runScreen(sample, { query: d.query, columns: d.columns, sort: d.sort, universe: d.universe }, CTX).ok).toBe(false);
  });
});
