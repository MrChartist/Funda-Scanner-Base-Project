// src/lib/data/storage.ts — where an imported dataset is kept between visits (WS1).
//
// Order of preference: IndexedDB (database "funda-scanner", store "datasets", key "active"), then
// localStorage when the serialised dataset is 2 MB or smaller, then memory only ("Kept for this
// session only"). Adapters are injectable so tests (and the migration) never need a real browser.
import type { FundamentalsDataset } from "@/lib/contracts";
import { STORAGE_KEYS } from "@/lib/contracts";
import { readEnvelope, readRaw, removeKey, writeEnvelope, writeRaw } from "@/lib/user/storage";
import { makeIssue, normalizeDataset, type IssueSink } from "./normalize";
import { STORED_DATASET_VERSION, storedEnvelopeSchema } from "./schema";
import { utf8Length } from "./import/csv";

export type PersistKind = "indexeddb" | "localstorage" | "memory";

export const IDB_NAME = "funda-scanner";
export const IDB_STORE = "datasets";
export const IDB_KEY = "active";
/** localStorage key for the fallback copy (the dataset contract has no key for it). */
export const LOCAL_DATASET_KEY = "funda-dataset-active";
/** Largest serialised dataset kept in localStorage. */
export const LOCAL_MAX_BYTES = 2 * 1024 * 1024;

/** A place that can hold one stored value. Every method rejects on failure. */
export interface DatasetStorageAdapter {
  readonly kind: PersistKind;
  /** False when the backing store does not exist in this browser. */
  available(): boolean;
  read(): Promise<unknown | null>;
  write(value: unknown): Promise<void>;
  clear(): Promise<void>;
}

// ── IndexedDB ───────────────────────────────────────────────────────────────
function idbFactory(): IDBFactory | null {
  try {
    const f = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    return f ?? null;
  } catch {
    return null;
  }
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(IDB_NAME, 1);
    } catch (e) {
      reject(e instanceof Error ? e : new Error("IndexedDB could not be opened."));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB could not be opened."));
    req.onblocked = () => reject(new Error("IndexedDB is blocked by another tab."));
  });
}

function runTx<T>(factory: IDBFactory, mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest | null): Promise<T | null> {
  return openDb(factory).then((db) => new Promise<T | null>((resolve, reject) => {
    let result: T | null = null;
    let tx: IDBTransaction;
    try {
      tx = db.transaction(IDB_STORE, mode);
    } catch (e) {
      db.close();
      reject(e instanceof Error ? e : new Error("IndexedDB transaction failed."));
      return;
    }
    const req = op(tx.objectStore(IDB_STORE));
    if (req) req.onsuccess = () => { result = (req.result ?? null) as T | null; };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("IndexedDB transaction was aborted.")); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error("IndexedDB transaction failed.")); };
  }));
}

export function createIndexedDbAdapter(factory: IDBFactory | null = idbFactory()): DatasetStorageAdapter {
  return {
    kind: "indexeddb",
    available: () => factory !== null,
    async read() {
      if (!factory) return null;
      return runTx<unknown>(factory, "readonly", (s) => s.get(IDB_KEY));
    },
    async write(value) {
      if (!factory) throw new Error("IndexedDB is not available in this browser.");
      await runTx(factory, "readwrite", (s) => s.put(value, IDB_KEY));
    },
    async clear() {
      if (!factory) return;
      await runTx(factory, "readwrite", (s) => s.delete(IDB_KEY));
    },
  };
}

// ── localStorage (≤ 2 MB) ───────────────────────────────────────────────────
export function createLocalStorageAdapter(key = LOCAL_DATASET_KEY, maxBytes = LOCAL_MAX_BYTES): DatasetStorageAdapter {
  const available = () => {
    try {
      return typeof (globalThis as { localStorage?: Storage }).localStorage !== "undefined";
    } catch {
      return false;
    }
  };
  return {
    kind: "localstorage",
    available,
    async read() {
      const text = readRaw(key);
      if (text === null) return null;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return null;
      }
    },
    async write(value) {
      const text = JSON.stringify(value);
      if (utf8Length(text) > maxBytes) throw new Error("The dataset is larger than 2 MB, the limit for browser local storage.");
      if (!writeRaw(key, text)) throw new Error("Browser local storage is full or unavailable.");
    },
    async clear() {
      removeKey(key);
    },
  };
}

// ── memory ──────────────────────────────────────────────────────────────────
export function createMemoryAdapter(kind: PersistKind = "memory"): DatasetStorageAdapter & { value: unknown | null; failWrites: boolean } {
  const a = {
    kind,
    value: null as unknown | null,
    failWrites: false,
    available: () => true,
    async read() {
      return a.value;
    },
    async write(value: unknown) {
      if (a.failWrites) throw new Error("Simulated write failure.");
      a.value = structuredCloneSafe(value);
    },
    async clear() {
      a.value = null;
    },
  };
  return a;
}

function structuredCloneSafe(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

// ── the active adapter chain ────────────────────────────────────────────────
let configured: readonly DatasetStorageAdapter[] | null = null;

/** Persistent adapters in order of preference (memory is the implicit last resort). */
export function storageAdapters(): readonly DatasetStorageAdapter[] {
  if (!configured) configured = [createIndexedDbAdapter(), createLocalStorageAdapter()];
  return configured;
}

/** Replaces the adapter chain (tests, or a host app with its own storage). Pass null for the default. */
export function setStorageAdapters(adapters: readonly DatasetStorageAdapter[] | null): void {
  configured = adapters;
}

export interface StoredEnvelope {
  v: typeof STORED_DATASET_VERSION;
  data: FundamentalsDataset;
}

/**
 * Saves the dataset to the first adapter that accepts it and removes older copies elsewhere, so a
 * reload never brings back a previous import. Returns "memory" when no persistent store accepted it
 * (older copies are then removed too). Never throws.
 */
export async function saveDataset(ds: FundamentalsDataset, adapters: readonly DatasetStorageAdapter[] = storageAdapters()): Promise<PersistKind> {
  const envelope: StoredEnvelope = { v: STORED_DATASET_VERSION, data: ds };
  let saved: DatasetStorageAdapter | null = null;
  for (const a of adapters) {
    if (!a.available()) continue;
    try {
      await a.write(envelope);
      saved = a;
      break;
    } catch {
      /* try the next one */
    }
  }
  for (const a of adapters) {
    if (a === saved || !a.available()) continue;
    try {
      await a.clear();
    } catch {
      /* best effort */
    }
  }
  if (saved && saved.kind !== "memory") {
    writeEnvelope(STORAGE_KEYS.activeSource, 1, "imported");
    return saved.kind;
  }
  writeEnvelope(STORAGE_KEYS.activeSource, 1, "sample");
  return "memory";
}

/** Reads a stored envelope back as a normalised dataset; null when absent or unreadable. */
export function datasetFromStored(value: unknown, sink: IssueSink = { file: null, issues: [] }): FundamentalsDataset | null {
  if (value === null || value === undefined) return null;
  const parsed = storedEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    sink.issues.push(makeIssue("warning", "W121_STORED_UNREADABLE", "The saved dataset in this browser could not be read."));
    return null;
  }
  return normalizeDataset(parsed.data.data, sink, "Imported data");
}

/** Loads the saved dataset from the first adapter that has a readable one. */
export async function loadSavedDataset(
  adapters: readonly DatasetStorageAdapter[] = storageAdapters(),
): Promise<{ dataset: FundamentalsDataset; kind: PersistKind } | null> {
  for (const a of adapters) {
    if (!a.available()) continue;
    try {
      const ds = datasetFromStored(await a.read());
      if (ds) return { dataset: ds, kind: a.kind };
    } catch {
      /* try the next one */
    }
  }
  return null;
}

/** Removes every saved copy and marks the sample as the active source. */
export async function clearSavedDatasets(adapters: readonly DatasetStorageAdapter[] = storageAdapters()): Promise<void> {
  for (const a of adapters) {
    if (!a.available()) continue;
    try {
      await a.clear();
    } catch {
      /* best effort */
    }
  }
  writeEnvelope(STORAGE_KEYS.activeSource, 1, "sample");
}

/** The source the user last chose ("sample" when nothing is stored). */
export function readActiveSource(): "sample" | "imported" {
  const v = readEnvelope<"sample" | "imported">(STORAGE_KEYS.activeSource, 1, () => null);
  return v === "imported" ? "imported" : "sample";
}
