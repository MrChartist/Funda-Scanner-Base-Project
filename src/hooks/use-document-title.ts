import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SUFFIX = "Funda Scanner";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/screener": "Screener",
  "/compare": "Compare",
  "/watchlist": "Watchlist",
  "/portfolio": "Portfolio",
  "/dcf": "DCF calculator",
  "/learn": "Learn",
};

export function titleForPath(pathname: string): string {
  const company = pathname.match(/^\/company\/([^/]+)/);
  if (company) {
    let symbol = company[1];
    try {
      symbol = decodeURIComponent(symbol);
    } catch {
      /* keep the raw text */
    }
    return `${symbol.toUpperCase()} · Company · ${SUFFIX}`;
  }
  const page = PAGE_TITLES[pathname.replace(/\/+$/, "") || "/"];
  return page ? `${page} · ${SUFFIX}` : SUFFIX;
}

export function useDocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = titleForPath(pathname);
  }, [pathname]);
}
