// src/lib/user/watchlist.ts — the user's followed symbols (§B.8). v0 stored a bare string[] under
// "funda-followed"; v2 stores { v: 2, data: { symbols } }. Symbols are upper-cased and unique.
import type { WatchlistData } from "@/lib/contracts";
import { STORAGE_KEYS } from "@/lib/contracts";
import { createLocalStore } from "./local-store";

export const WATCHLIST_VERSION = 2;
export const WATCHLIST_V0_BACKUP_KEY = `${STORAGE_KEYS.followed}.v0-backup`;

export function cleanSymbols(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const s = item.trim().toUpperCase();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function normalise(data: unknown): WatchlistData {
  const symbols = typeof data === "object" && data !== null ? (data as { symbols?: unknown }).symbols : undefined;
  return { symbols: cleanSymbols(symbols) };
}

/** v0 string[] (or a bare { symbols } object) → current shape. */
export function migrateWatchlist(raw: unknown): WatchlistData | null {
  if (Array.isArray(raw)) return { symbols: cleanSymbols(raw) };
  if (typeof raw === "object" && raw !== null && "symbols" in raw) return normalise(raw);
  return null;
}

export const watchlistStore = createLocalStore<WatchlistData>({
  key: STORAGE_KEYS.followed,
  version: WATCHLIST_VERSION,
  normalise,
  migrate: migrateWatchlist,
  empty: () => ({ symbols: [] }),
  backupKey: WATCHLIST_V0_BACKUP_KEY,
});

export function loadWatchlist(): WatchlistData {
  return watchlistStore.load();
}

export function saveWatchlist(data: WatchlistData): boolean {
  return watchlistStore.save({ symbols: cleanSymbols(data.symbols) });
}
