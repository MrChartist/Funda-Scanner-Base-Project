import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard — Funda Scanner",
  "/screener": "Stock Screener — Funda Scanner",
  "/compare": "Compare Stocks — Funda Scanner",
  "/watchlist": "Watchlist — Funda Scanner",
  "/dcf": "DCF Calculator — Funda Scanner",
};

export function useDocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const companyMatch = pathname.match(/^\/company\/(.+)$/);
    if (companyMatch) {
      document.title = `${companyMatch[1]} — Company Detail — Funda Scanner`;
    } else {
      document.title = PAGE_TITLES[pathname] || "Funda Scanner";
    }
  }, [pathname]);
}
