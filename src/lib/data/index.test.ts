import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { STORAGE_KEYS } from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { toStockRows } from "@/lib/metrics";
import { runScreen } from "@/lib/data-provider";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import {
  activateImportedDataset, clearImportedData, exportDatasetJson, getDataProvider, importFiles, loadDataset, persistenceOf,
  providerInfo, restoreActiveProvider, RESTORE_MISSING_MESSAGE, setDataProvider, setStorageAdapters,
} from "./index";
import { createMemoryAdapter } from "./storage";
import type { LegacyKeyAccess } from "./migrate";

function memoryKey(initial: string | null): LegacyKeyAccess & { value: string | null } {
  const k = { value: initial, read: () => k.value, remove: () => { k.value = null; } };
  return k;
}

let idb = createMemoryAdapter("indexeddb");

beforeEach(() => {
  localStorage.clear();
  idb = createMemoryAdapter("indexeddb");
  setStorageAdapters([idb]);
});

afterEach(async () => {
  await clearImportedData({ legacy: memoryKey(null) });
  setStorageAdapters(null);
});

async function importTiny() {
  return importFiles([{ name: "tiny.json", text: exportDatasetJson(createTinyDataset()) }]);
}

describe("activateImportedDataset", () => {
  it("activates the dataset with the real import time, saves it and keeps the report", async () => {
    const out = await importTiny();
    const before = getDataProvider();
    expect(await activateImportedDataset(out)).toEqual({ persisted: "indexeddb" });
    const p = getDataProvider();
    expect(p).not.toBe(before);
    expect(p).toMatchObject({ id: "imported", name: out.dataset?.meta.name, isDemo: true });
    expect(persistenceOf(p)).toBe("indexeddb");
    expect(providerInfo(p).report).toBe(out.report);
    const ds = await loadDataset(p);
    expect(ds.meta.source).toBe("user_import");
    expect(ds.meta.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(ds.companies).toEqual(createTinyDataset().companies);
    expect(localStorage.getItem(STORAGE_KEYS.activeSource)).toBe(JSON.stringify({ v: 1, data: "imported" }));
  });

  it("bumps the revision on every import so React Query reloads", async () => {
    const out = await importTiny();
    await activateImportedDataset(out);
    const r1 = getDataProvider().revision ?? 0;
    await activateImportedDataset(out);
    expect(getDataProvider().revision).toBe(r1 + 1);
  });

  it("falls back to memory when storage refuses the write", async () => {
    idb.failWrites = true;
    expect(await activateImportedDataset(await importTiny())).toEqual({ persisted: "memory" });
    expect(persistenceOf(getDataProvider())).toBe("memory");
    expect(localStorage.getItem(STORAGE_KEYS.activeSource)).toBe(JSON.stringify({ v: 1, data: "sample" }));
  });

  it("refuses an outcome with errors", async () => {
    const bad = await importFiles([{ name: "x.json", text: "{" }]);
    await expect(activateImportedDataset(bad)).rejects.toThrow(/no dataset/);
  });

  it("keeps a user-supplied as-of date exactly as entered", async () => {
    const out = await importTiny();
    if (!out.dataset) throw new Error("fixture");
    await activateImportedDataset({ ...out, dataset: { ...out.dataset, meta: { ...out.dataset.meta, asOf: "2026-06-30" } } });
    expect((await loadDataset(getDataProvider())).meta.asOf).toBe("2026-06-30");
  });
});

describe("restoreActiveProvider", () => {
  it("uses the sample provider when nothing was imported", () => {
    const p = restoreActiveProvider({ legacy: memoryKey(null) });
    expect(p.id).toBe("sample");
    expect(getDataProvider()).toBe(p);
  });

  it("restores a saved import on the next visit", async () => {
    await activateImportedDataset(await importTiny());
    setDataProvider({ id: "other", name: "x", isDemo: false, getUniverse: async () => [] }); // simulate a fresh page
    const p = restoreActiveProvider({ legacy: memoryKey(null) });
    expect(p).toMatchObject({ id: "imported", isDemo: false });
    const ds = await loadDataset(p);
    expect(ds.companies).toHaveLength(6);
    expect(ds.meta.importedAt).not.toBeNull();
    expect(persistenceOf(p)).toBe("indexeddb");
  });

  it("migrates the v0 key on first load and removes it only after saving", async () => {
    const v0 = memoryKey(JSON.stringify({ name: "old.csv", rows: [{ symbol: "RELIANCE", name: "x", sector: "Energy", industry: "", market_cap: 100, price: 10, pe: 12 }] }));
    const p = restoreActiveProvider({ legacy: v0 });
    expect(p.id).toBe("imported");
    const ds = await loadDataset(p);
    expect(ds.companies.map((c) => c.symbol)).toEqual(["RELIANCE"]);
    expect(ds.meta.importedAt).toBeNull();
    expect(v0.value).toBeNull();
    expect(idb.value).not.toBeNull();
    expect(persistenceOf(p)).toBe("indexeddb");
  });

  it("keeps the v0 key and still shows its data when saving fails", async () => {
    idb.failWrites = true;
    const text = JSON.stringify({ name: "old.csv", rows: [{ symbol: "ABC", pe: 12 }] });
    const v0 = memoryKey(text);
    const p = restoreActiveProvider({ legacy: v0 });
    const ds = await loadDataset(p);
    expect(ds.companies[0].symbol).toBe("ABC");
    expect(v0.value).toBe(text);
    expect(persistenceOf(p)).toBe("memory");
  });

  it("falls back to the sample, with a message, when the remembered import has gone", async () => {
    localStorage.setItem(STORAGE_KEYS.activeSource, JSON.stringify({ v: 1, data: "imported" }));
    const p = restoreActiveProvider({ legacy: memoryKey(null) });
    expect(p.id).toBe("imported");
    await expect(loadDataset(p)).rejects.toThrow(RESTORE_MISSING_MESSAGE);
    expect(getDataProvider().id).toBe("sample");
    expect(localStorage.getItem(STORAGE_KEYS.activeSource)).toBe(JSON.stringify({ v: 1, data: "sample" }));
  });
});

describe("clearImportedData", () => {
  it("forgets every copy, the v0 key, and returns to the sample", async () => {
    await activateImportedDataset(await importTiny());
    const v0 = memoryKey("{}");
    await clearImportedData({ legacy: v0 });
    expect(getDataProvider().id).toBe("sample");
    expect(idb.value).toBeNull();
    expect(v0.value).toBeNull();
    expect(restoreActiveProvider({ legacy: memoryKey(null) }).id).toBe("sample");
  });
});

describe("legacy snapshot import through the new pipeline", () => {
  it("imports the shipped sample CSV and JSON identically; roce > 20 returns DELTA, ALPHA, ZETA", async () => {
    const csv = await importFiles([{ name: "s.csv", text: readFileSync("public/sample-data/fundamentals-sample.csv", "utf8") }]);
    const json = await importFiles([{ name: "s.json", text: readFileSync("public/sample-data/fundamentals-sample.json", "utf8") }]);
    expect(csv.report.ok).toBe(true);
    expect(csv.files[0].kind).toBe("snapshot");
    expect(json.files[0].kind).toBe("snapshot");
    expect(csv.dataset?.companies).toEqual(json.dataset?.companies);
    expect(csv.report.issues.filter((i) => i.level !== "info")).toEqual([]);
    if (!csv.dataset) throw new Error("import failed");
    const rows = toStockRows(createStore(csv.dataset));
    expect(runScreen(rows, { filters: [{ metric: "roce", operator: "gt", value: 20 }] }).map((r) => r.symbol)).toEqual(["DELTA", "ALPHA", "ZETA"]);
  });

  it("skips rows without a symbol with a warning instead of blocking", async () => {
    const out = await importFiles([{ name: "s.csv", text: "symbol,pe\nA,1\n,2\n" }]);
    expect(out.report.ok).toBe(true);
    expect(out.report.issues.map((i) => i.code)).toContain("W120_EMPTY_SYMBOL");
  });

  it("skips # lines in snapshot CSVs and flags fictional sample files", async () => {
    const out = await importFiles([{ name: "s.csv", text: "# Fictional sample data generated by Funda Scanner.\nsymbol,name,sector,pe\nA,Alpha,IT,10\n" }]);
    expect(out.dataset?.companies.map((c) => c.symbol)).toEqual(["A"]);
    expect(out.dataset?.meta.isSynthetic).toBe(true);
  });
});
