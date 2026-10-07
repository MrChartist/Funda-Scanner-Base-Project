// Follow state for one company. Reads the v0 list (string[]) and the v2 envelope ({ v: 2, data: { symbols } });
// always writes v2, so the Watchlist page can read it.
import { useCallback, useState } from "react";
import type { WatchlistData } from "@/lib/contracts";
import { STORAGE_KEYS } from "@/lib/contracts";
import { readRaw, writeEnvelope } from "@/lib/user/storage";

function readSymbols(): string[] {
  const raw = readRaw(STORAGE_KEYS.followed);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === "string");
    const data = (parsed as { data?: Partial<WatchlistData> } | null)?.data;
    if (data && Array.isArray(data.symbols)) return data.symbols.filter((s): s is string => typeof s === "string");
  } catch {
    // unreadable value: treated as an empty list
  }
  return [];
}

export function useFollow(symbol: string): { following: boolean; toggle: () => void } {
  const [following, setFollowing] = useState(() => readSymbols().includes(symbol));
  const toggle = useCallback(() => {
    const current = readSymbols();
    const next = current.includes(symbol) ? current.filter((s) => s !== symbol) : [...current, symbol];
    writeEnvelope<WatchlistData>(STORAGE_KEYS.followed, 2, { symbols: next });
    setFollowing(next.includes(symbol));
  }, [symbol]);
  return { following, toggle };
}
