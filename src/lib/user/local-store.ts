// src/lib/user/local-store.ts — a small versioned store over one localStorage key (WS7).
// Reads are tolerant (v0 values are migrated), writes are enveloped `{ v, data }`, the v0 value is
// copied to a backup key once before it is first overwritten (§B.12), and subscribers are told about
// every write in this tab and every change made in another tab. When storage is unavailable the
// latest value is kept in memory for the session, so the page keeps working.
import type { Envelope } from "@/lib/contracts";
import { readRaw, writeRaw } from "./storage";

export interface LocalStoreOptions<T> {
  key: string;
  version: number;
  /** Cleans a value of the current version (drops invalid entries). */
  normalise: (data: unknown) => T;
  /** Converts a bare, older or foreign value to the current shape; null when it cannot. */
  migrate: (raw: unknown) => T | null;
  empty: () => T;
  /** Where the original v0 text is copied before the first write; null for no backup. */
  backupKey: string | null;
}

export interface LocalStore<T> {
  readonly key: string;
  /** The stored text (or the session copy); stable between writes, so usable as a snapshot. */
  snapshot(): string | null;
  parse(text: string | null): T;
  load(): T;
  save(data: T): boolean;
  subscribe(listener: () => void): () => void;
}

function isEnvelope(x: unknown): x is Envelope<unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
    && typeof (x as { v?: unknown }).v === "number" && "data" in (x as object);
}

export function createLocalStore<T>(o: LocalStoreOptions<T>): LocalStore<T> {
  const listeners = new Set<() => void>();
  let session: string | null | undefined;
  let storageListening = false;

  const notify = () => listeners.forEach((l) => l());

  const snapshot = (): string | null => {
    const stored = readRaw(o.key);
    if (stored !== null) return stored;
    return session === undefined ? null : session;
  };

  const parse = (text: string | null): T => {
    if (text === null) return o.empty();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    try {
      if (isEnvelope(parsed) && parsed.v === o.version) return o.normalise(parsed.data);
      return o.migrate(parsed) ?? o.empty();
    } catch {
      return o.empty();
    }
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === o.key) notify();
  };

  return {
    key: o.key,
    snapshot,
    parse,
    load: () => parse(snapshot()),
    save(data) {
      const before = readRaw(o.key);
      if (before !== null && o.backupKey) {
        let isCurrent = false;
        try {
          const p: unknown = JSON.parse(before);
          isCurrent = isEnvelope(p) && p.v === o.version;
        } catch {
          isCurrent = false;
        }
        if (!isCurrent && readRaw(o.backupKey) === null) writeRaw(o.backupKey, before);
      }
      const text = JSON.stringify({ v: o.version, data } satisfies Envelope<T>);
      const ok = writeRaw(o.key, text);
      session = ok ? undefined : text; // keep a session copy only when the browser would not store it
      notify();
      return ok;
    },
    subscribe(listener) {
      listeners.add(listener);
      if (!storageListening && typeof window !== "undefined") {
        window.addEventListener("storage", onStorage);
        storageListening = true;
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && storageListening && typeof window !== "undefined") {
          window.removeEventListener("storage", onStorage);
          storageListening = false;
        }
      };
    },
  };
}
