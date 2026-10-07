// src/hooks/use-watchlist.ts — the followed symbols, shared by every component that shows or changes
// them (the Watchlist page, the company page's follow button, the screener's watchlist universe).
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { cleanSymbols, saveWatchlist, watchlistStore } from "@/lib/user/watchlist";

export interface UseWatchlist {
  symbols: readonly string[];
  isFollowed: (symbol: string) => boolean;
  follow: (symbol: string) => void;
  unfollow: (symbol: string) => void;
  /** Returns true when the symbol is followed afterwards. */
  toggle: (symbol: string) => boolean;
  clear: () => void;
}

export function useWatchlist(): UseWatchlist {
  const raw = useSyncExternalStore(watchlistStore.subscribe, watchlistStore.snapshot, watchlistStore.snapshot);
  const symbols = useMemo(() => watchlistStore.parse(raw).symbols, [raw]);

  const follow = useCallback((symbol: string) => {
    const current = watchlistStore.load().symbols;
    saveWatchlist({ symbols: cleanSymbols([...current, symbol]) });
  }, []);

  const unfollow = useCallback((symbol: string) => {
    const wanted = symbol.trim().toUpperCase();
    saveWatchlist({ symbols: watchlistStore.load().symbols.filter((s) => s !== wanted) });
  }, []);

  const toggle = useCallback((symbol: string) => {
    const wanted = symbol.trim().toUpperCase();
    const current = watchlistStore.load().symbols;
    const has = current.includes(wanted);
    saveWatchlist({ symbols: has ? current.filter((s) => s !== wanted) : cleanSymbols([...current, wanted]) });
    return !has;
  }, []);

  const clear = useCallback(() => {
    saveWatchlist({ symbols: [] });
  }, []);

  const isFollowed = useCallback((symbol: string) => symbols.includes(symbol.trim().toUpperCase()), [symbols]);

  return { symbols, isFollowed, follow, unfollow, toggle, clear };
}
