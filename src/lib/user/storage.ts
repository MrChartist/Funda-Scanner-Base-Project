// src/lib/user/storage.ts — versioned, never-throwing wrappers around localStorage (P0, handed to WS7).
import type { Envelope } from "@/lib/contracts";
import { nowIso } from "@/lib/time/clock";

function storage(): Storage | null {
  try {
    if (typeof globalThis === "undefined") return null;
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s ?? null;
  } catch {
    return null; // access can throw in sandboxed iframes or when storage is disabled
  }
}

function isEnvelope(x: unknown): x is Envelope<unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
    && typeof (x as { v?: unknown }).v === "number" && "data" in (x as object);
}

/** Raw string at a key, or null when absent or unreadable. */
export function readRaw(key: string): string | null {
  const s = storage();
  if (!s) return null;
  try {
    return s.getItem(key);
  } catch {
    return null;
  }
}

/** Writes a raw string; false when storage is unavailable or full. Never throws. */
export function writeRaw(key: string, value: string): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Removes a key; false when storage is unavailable. Never throws. */
export function removeKey(key: string): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads `{ v, data }` at `key`. When `v` equals `version`, returns `data` as stored.
 * Anything else (an older envelope, a bare v0 value, or text that is not JSON) is passed
 * to `migrate`, which returns the current shape or null. The migrated value is NOT written
 * back: callers decide when to persist (and back up the original first, §B.12).
 * Returns null when the key is absent or migration fails. Never throws.
 */
export function readEnvelope<T>(key: string, version: number, migrate: (raw: unknown) => T | null): T | null {
  const text = readRaw(key);
  if (text === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  if (isEnvelope(parsed) && parsed.v === version) return parsed.data as T;
  try {
    return migrate(parsed);
  } catch {
    return null;
  }
}

/** Writes `{ v: version, data }` as JSON. Returns false (never throws) when storage is unavailable or full. */
export function writeEnvelope<T>(key: string, version: number, data: T): boolean {
  let text: string;
  try {
    const envelope: Envelope<T> = { v: version, data };
    text = JSON.stringify(envelope);
  } catch {
    return false; // e.g. a cyclic value
  }
  return writeRaw(key, text);
}

let fallbackCounter = 0;

function hex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += (b < 16 ? "0" : "") + b.toString(16);
  return s;
}

/** A unique id for saved screens and similar records. Works without crypto.randomUUID. */
export function createId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  try {
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    /* fall through */
  }
  try {
    if (c && typeof c.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      c.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const h = hex(bytes);
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
  } catch {
    /* fall through */
  }
  // No crypto at all: unique within this session and across sessions by save time.
  fallbackCounter += 1;
  const stamp = nowIso().replace(/[^0-9]/g, "");
  return `id-${stamp}-${fallbackCounter.toString(36)}`;
}
