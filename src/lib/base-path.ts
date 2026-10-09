// src/lib/base-path.ts - where the site is served from (Vite `base`, set with VITE_BASE at build time).
// "/" on a custom domain, "/<repo>/" on a GitHub Pages project site. Use ROUTER_BASENAME for
// <BrowserRouter basename> and assetUrl() for files in /public (never a hard-coded "/path").

const RAW_BASE: string = (import.meta.env?.BASE_URL as string | undefined) ?? "/";

/** BASE_URL with a trailing slash, e.g. "/" or "/Funda-Scanner-Base-Project/". */
export const BASE_URL: string = RAW_BASE.endsWith("/") ? RAW_BASE : `${RAW_BASE}/`;

/** Value for <BrowserRouter basename>: no trailing slash, and undefined at the site root. */
export const ROUTER_BASENAME: string | undefined = (() => {
  const trimmed = BASE_URL.replace(/\/+$/, "");
  return trimmed === "" || trimmed === "." ? undefined : trimmed;
})();

/** URL of a file in /public that works under any base, e.g. assetUrl("sample-data/x.csv"). */
export function assetUrl(path: string): string {
  return `${BASE_URL}${path.replace(/^\/+/, "")}`;
}
