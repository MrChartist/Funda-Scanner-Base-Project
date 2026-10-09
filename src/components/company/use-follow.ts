// Follow state for one company, backed by the shared watchlist store so that the Watchlist page,
// the screener's watchlist universe and this button always agree (including within the same tab).
import { useCallback } from "react";
import { useWatchlist } from "@/hooks/use-watchlist";

export function useFollow(symbol: string): { following: boolean; toggle: () => void } {
  const { isFollowed, toggle: toggleSymbol } = useWatchlist();
  const toggle = useCallback(() => {
    toggleSymbol(symbol);
  }, [toggleSymbol, symbol]);
  return { following: isFollowed(symbol), toggle };
}
