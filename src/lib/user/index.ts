// src/lib/user/index.ts — browser-local user data (WS7).
export * from "./storage";
export { createLocalStore, type LocalStore } from "./local-store";
export { watchlistStore, loadWatchlist, saveWatchlist, migrateWatchlist, cleanSymbols } from "./watchlist";
export { portfolioStore, loadPortfolio, savePortfolio, migratePortfolio, cleanHolding, cleanHoldings } from "./portfolio";
export {
  layoutStore, DASHBOARD_WIDGETS, cleanLayout, defaultLayout, type DashboardLayoutItem, type DashboardWidgetDef,
} from "./dashboard-layout";
export { learnModeStore } from "./learn-mode";
export { xirr, type DatedFlow } from "./xirr";
