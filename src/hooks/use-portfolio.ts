// src/hooks/use-portfolio.ts — the user's holdings, shared by the Portfolio page and the screener's
// portfolio universe. Symbols that are not in the loaded data are kept, never rejected.
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { PortfolioHolding } from "@/lib/contracts";
import { cleanHolding, portfolioStore, savePortfolio } from "@/lib/user/portfolio";

export interface UsePortfolio {
  holdings: readonly PortfolioHolding[];
  /** False when the values are not valid (non-positive quantity, bad date); nothing is saved then. */
  add: (holding: PortfolioHolding) => boolean;
  remove: (index: number) => void;
  clear: () => void;
}

export function usePortfolio(): UsePortfolio {
  const raw = useSyncExternalStore(portfolioStore.subscribe, portfolioStore.snapshot, portfolioStore.snapshot);
  const holdings = useMemo(() => portfolioStore.parse(raw).holdings, [raw]);

  const add = useCallback((holding: PortfolioHolding) => {
    const clean = cleanHolding(holding);
    if (!clean) return false;
    savePortfolio({ holdings: [...portfolioStore.load().holdings, clean] });
    return true;
  }, []);

  const remove = useCallback((index: number) => {
    savePortfolio({ holdings: portfolioStore.load().holdings.filter((_, i) => i !== index) });
  }, []);

  const clear = useCallback(() => {
    savePortfolio({ holdings: [] });
  }, []);

  return { holdings, add, remove, clear };
}
