import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/lib/contracts";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import {
  clearSavedDatasets, createIndexedDbAdapter, createLocalStorageAdapter, createMemoryAdapter, datasetFromStored, LOCAL_DATASET_KEY,
  loadSavedDataset, readActiveSource, saveDataset, setStorageAdapters, storageAdapters,
} from "./storage";

beforeEach(() => localStorage.clear());
afterEach(() => setStorageAdapters(null));

describe("saveDataset", () => {
  it("prefers the first adapter and clears older copies elsewhere", async () => {
    const idb = createMemoryAdapter("indexeddb");
    const ls = createMemoryAdapter("localstorage");
    ls.value = { v: 1, data: { stale: true } };
    expect(await saveDataset(createTinyDataset(), [idb, ls])).toBe("indexeddb");
    expect(ls.value).toBeNull();
    expect(readActiveSource()).toBe("imported");
    const loaded = await loadSavedDataset([idb, ls]);
    expect(loaded?.kind).toBe("indexeddb");
    expect(loaded?.dataset).toEqual(createTinyDataset());
  });

  it("falls back to localStorage, then memory (and then forgets older copies)", async () => {
    const idb = createMemoryAdapter("indexeddb");
    idb.failWrites = true;
    idb.value = { v: 1, data: createTinyDataset() }; // an older import
    const ls = createLocalStorageAdapter();
    expect(await saveDataset(createTinyDataset(), [idb, ls])).toBe("localstorage");
    expect(localStorage.getItem(LOCAL_DATASET_KEY)).not.toBeNull();
    expect(idb.value).toBeNull();

    const tooSmall = createLocalStorageAdapter(LOCAL_DATASET_KEY, 100); // 100-byte limit
    const failing = createMemoryAdapter("indexeddb");
    failing.failWrites = true;
    expect(await saveDataset(createTinyDataset(), [failing, tooSmall])).toBe("memory");
    expect(localStorage.getItem(LOCAL_DATASET_KEY)).toBeNull();
    expect(readActiveSource()).toBe("sample");
    expect(await loadSavedDataset([failing, tooSmall])).toBeNull();
  });

  it("enforces the 2 MB localStorage limit", async () => {
    const ls = createLocalStorageAdapter();
    const ds = createTinyDataset();
    ds.meta.notes = ["x".repeat(2 * 1024 * 1024)];
    await expect(ls.write({ v: 1, data: ds })).rejects.toThrow(/2 MB/);
    expect(await saveDataset(ds, [ls])).toBe("memory");
  });

  it("skips adapters that are not available", async () => {
    const none = createIndexedDbAdapter(null);
    expect(none.available()).toBe(false);
    expect(await none.read()).toBeNull();
    await expect(none.write({})).rejects.toThrow(/not available/);
    const ls = createMemoryAdapter("localstorage");
    expect(await saveDataset(createTinyDataset(), [none, ls])).toBe("localstorage");
  });
});

describe("loading and clearing", () => {
  it("ignores unreadable stored values and reads the next adapter", async () => {
    const idb = createMemoryAdapter("indexeddb");
    idb.value = { v: 99, data: {} };
    const ls = createMemoryAdapter("localstorage");
    ls.value = { v: 1, data: createTinyDataset() };
    const loaded = await loadSavedDataset([idb, ls]);
    expect(loaded?.kind).toBe("localstorage");
    expect(datasetFromStored(null)).toBeNull();
    expect(datasetFromStored("junk")).toBeNull();
  });

  it("clears every copy and marks the sample as active", async () => {
    const idb = createMemoryAdapter("indexeddb");
    const ls = createLocalStorageAdapter();
    await saveDataset(createTinyDataset(), [ls]);
    idb.value = { v: 1, data: createTinyDataset() };
    await clearSavedDatasets([idb, ls]);
    expect(idb.value).toBeNull();
    expect(localStorage.getItem(LOCAL_DATASET_KEY)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.activeSource)).toBe(JSON.stringify({ v: 1, data: "sample" }));
  });

  it("reads the active-source flag defensively", () => {
    expect(readActiveSource()).toBe("sample");
    localStorage.setItem(STORAGE_KEYS.activeSource, "garbage");
    expect(readActiveSource()).toBe("sample");
    localStorage.setItem(STORAGE_KEYS.activeSource, JSON.stringify({ v: 1, data: "imported" }));
    expect(readActiveSource()).toBe("imported");
  });

  it("builds the default chain (IndexedDB, then localStorage) and lets tests replace it", () => {
    expect(storageAdapters().map((a) => a.kind)).toEqual(["indexeddb", "localstorage"]);
    const only = [createMemoryAdapter("indexeddb")];
    setStorageAdapters(only);
    expect(storageAdapters()).toBe(only);
  });
});
