import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/lib/contracts";
import { legacyLocalStorageKey, migrateLegacyImport, readLegacyImport, type LegacyKeyAccess } from "./migrate";
import { createMemoryAdapter, datasetFromStored, setStorageAdapters } from "./storage";

const V0 = JSON.stringify({
  name: "my-file.csv",
  rows: [
    { symbol: "alpha", name: "Alpha Ltd", sector: "IT", industry: "Software", market_cap: 1000, price: 50, pe: 20, eps: null, price_book: 3, roe: 18, roce: 22, debt_equity: 0.1, debt_ebitda: null, dividend_yield: 1, sales_growth: 12, profit_growth: 15, fcf_yield: 4 },
    { symbol: "BETA", name: "Beta Bank", sector: "Banks", industry: "", market_cap: 5000, price: null, pe: 12, eps: 9, price_book: null, roe: 14, roce: null, debt_equity: null, debt_ebitda: null, dividend_yield: null, sales_growth: null, profit_growth: null, fcf_yield: null },
  ],
});

function memoryKey(initial: string | null): LegacyKeyAccess & { value: string | null } {
  const k = {
    value: initial,
    read: () => k.value,
    remove: () => {
      k.value = null;
    },
  };
  return k;
}

beforeEach(() => localStorage.clear());
afterEach(() => setStorageAdapters(null));

describe("migrateLegacyImport (acceptance)", () => {
  it("moves the v0 key into IndexedDB through an injected adapter and removes the key after the write", async () => {
    const idb = createMemoryAdapter("indexeddb");
    const legacy = memoryKey(V0);
    const res = await migrateLegacyImport({ legacy, adapters: [idb] });
    expect(res?.persisted).toBe("indexeddb");
    expect(res?.removedLegacyKey).toBe(true);
    expect(legacy.value).toBeNull();
    const stored = datasetFromStored(idb.value);
    expect(stored?.companies.map((c) => c.symbol)).toEqual(["ALPHA", "BETA"]);
    expect(stored?.companies[0]).toMatchObject({
      market: { price: 50, market_cap_supplied: 1000, price_date: null },
      snapshot: { pe: 20, pb: 3, roe: 18, roce: 22, debt_equity: 0.1, dividend_yield: 1, sales_growth: 12, profit_growth: 15, fcf_yield: 4 },
      annual: [],
    });
    expect(stored?.companies[1]).toMatchObject({ industry: null, market: { price: null, market_cap_supplied: 5000 }, snapshot: { pe: 12, eps: 9, roe: 14 } });
    expect(stored?.meta).toMatchObject({ name: "my-file.csv", source: "user_import", isSynthetic: false, importedAt: null, asOf: null });
    expect(localStorage.getItem(STORAGE_KEYS.activeSource)).toBe(JSON.stringify({ v: 1, data: "imported" }));
  });

  it("keeps the v0 key when the write fails", async () => {
    const idb = createMemoryAdapter("indexeddb");
    idb.failWrites = true;
    const legacy = memoryKey(V0);
    const res = await migrateLegacyImport({ legacy, adapters: [idb] });
    expect(res?.persisted).toBe("memory");
    expect(res?.removedLegacyKey).toBe(false);
    expect(res?.dataset.companies).toHaveLength(2); // still usable for this session
    expect(legacy.value).toBe(V0);
    expect(idb.value).toBeNull();
  });

  it("falls back to the next adapter when IndexedDB fails", async () => {
    const idb = createMemoryAdapter("indexeddb");
    idb.failWrites = true;
    const ls = createMemoryAdapter("localstorage");
    const legacy = memoryKey(V0);
    const res = await migrateLegacyImport({ legacy, adapters: [idb, ls] });
    expect(res?.persisted).toBe("localstorage");
    expect(legacy.value).toBeNull();
  });

  it("does nothing without a v0 key or with an unreadable one", async () => {
    const idb = createMemoryAdapter("indexeddb");
    expect(await migrateLegacyImport({ legacy: memoryKey(null), adapters: [idb] })).toBeNull();
    const junk = memoryKey("not json");
    expect(await migrateLegacyImport({ legacy: junk, adapters: [idb] })).toBeNull();
    expect(junk.value).toBe("not json"); // never deleted when it could not be read
    expect(readLegacyImport('{"name":"x","rows":[]}')).toBeNull();
    expect(readLegacyImport('{"rows":"x"}')).toBeNull();
  });

  it("uses the real localStorage key by default", async () => {
    localStorage.setItem(STORAGE_KEYS.importedLegacy, V0);
    expect(legacyLocalStorageKey.read()).toBe(V0);
    const idb = createMemoryAdapter("indexeddb");
    const res = await migrateLegacyImport({ adapters: [idb] });
    expect(res?.removedLegacyKey).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.importedLegacy)).toBeNull();
  });
});
