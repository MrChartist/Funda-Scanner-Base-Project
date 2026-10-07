// src/lib/user/portfolio.ts — the user's holdings (§B.8). v0 stored a bare PortfolioHolding[] under
// "funda-portfolio"; v2 stores { v: 2, data: { holdings } }. Invalid rows are dropped on read.
import type { PortfolioData, PortfolioHolding } from "@/lib/contracts";
import { STORAGE_KEYS } from "@/lib/contracts";
import { parseIsoDate } from "@/lib/time/civil";
import { createLocalStore } from "./local-store";

export const PORTFOLIO_VERSION = 2;
export const PORTFOLIO_V0_BACKUP_KEY = `${STORAGE_KEYS.portfolio}.v0-backup`;

/** A holding with a symbol, a positive finite quantity, a non-negative finite cost and a valid date. */
export function cleanHolding(x: unknown): PortfolioHolding | null {
  if (typeof x !== "object" || x === null) return null;
  const h = x as Partial<PortfolioHolding>;
  const symbol = typeof h.symbol === "string" ? h.symbol.trim().toUpperCase() : "";
  const qty = typeof h.qty === "number" ? h.qty : Number.NaN;
  const avgCost = typeof h.avgCost === "number" ? h.avgCost : Number.NaN;
  const buyDate = typeof h.buyDate === "string" ? h.buyDate.trim().slice(0, 10) : "";
  if (!symbol || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(avgCost) || avgCost < 0) return null;
  if (!parseIsoDate(buyDate)) return null;
  return { symbol, qty, avgCost, buyDate };
}

export function cleanHoldings(list: unknown): PortfolioHolding[] {
  if (!Array.isArray(list)) return [];
  const out: PortfolioHolding[] = [];
  for (const item of list) {
    const h = cleanHolding(item);
    if (h) out.push(h);
  }
  return out;
}

function normalise(data: unknown): PortfolioData {
  const holdings = typeof data === "object" && data !== null ? (data as { holdings?: unknown }).holdings : undefined;
  return { holdings: cleanHoldings(holdings) };
}

export function migratePortfolio(raw: unknown): PortfolioData | null {
  if (Array.isArray(raw)) return { holdings: cleanHoldings(raw) };
  if (typeof raw === "object" && raw !== null && "holdings" in raw) return normalise(raw);
  return null;
}

export const portfolioStore = createLocalStore<PortfolioData>({
  key: STORAGE_KEYS.portfolio,
  version: PORTFOLIO_VERSION,
  normalise,
  migrate: migratePortfolio,
  empty: () => ({ holdings: [] }),
  backupKey: PORTFOLIO_V0_BACKUP_KEY,
});

export function loadPortfolio(): PortfolioData {
  return portfolioStore.load();
}

export function savePortfolio(data: PortfolioData): boolean {
  return portfolioStore.save({ holdings: cleanHoldings(data.holdings) });
}
