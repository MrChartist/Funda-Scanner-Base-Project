import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { copyFileSync, existsSync } from "node:fs";

/**
 * Normalises VITE_BASE to "/" or "/some/sub/path/" (leading and trailing slash). "./" is kept as is
 * (relative base; deep links then need a root-level host, so docs/deploy.md recommends an absolute one).
 */
export function normaliseBase(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  if (!v || v === "/") return "/";
  if (v === "./") return "./";
  return `/${v.replace(/^\/+|\/+$/g, "")}/`;
}

/**
 * Static hosts without rewrite rules (GitHub Pages) serve 404.html for unknown paths. Copying the
 * built index.html to 404.html makes /screener and /company/XYZ load the app on a direct visit or reload.
 */
function spaFallback(): Plugin {
  let outDir = "dist";
  return {
    name: "funda-spa-fallback-404",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const from = path.join(outDir, "index.html");
      if (existsSync(from)) copyFileSync(from, path.join(outDir, "404.html"));
    },
  };
}

/** Long-lived vendor chunks cache well across deploys; app code stays in route/feature chunks. */
function vendorChunk(id: string): string | undefined {
  // Rollup's CommonJS interop helpers are shared by every vendor chunk; without a home of their own
  // they land in "charts", which would then be preloaded on every page.
  if (id.includes("commonjsHelpers")) return "react";
  if (!id.includes("node_modules")) return undefined;
  const m = id.split("node_modules/").pop() ?? "";
  const pkg = m.startsWith("@") ? m.split("/").slice(0, 2).join("/") : m.split("/")[0];
  if (pkg === "react" || pkg === "react-dom" || pkg === "scheduler") return "react";
  if (pkg === "react-router" || pkg === "react-router-dom" || pkg === "@remix-run/router") return "router";
  if (pkg === "@tanstack/react-query" || pkg === "@tanstack/query-core") return "query";
  // clsx is used by the app and by recharts; keep it out of "charts" so that chunk loads only with charts.
  if (pkg === "clsx" || pkg === "tailwind-merge" || pkg === "class-variance-authority") return "classnames";
  if (pkg === "framer-motion" || pkg === "motion-dom" || pkg === "motion-utils") return "motion";
  if (pkg === "recharts" || pkg.startsWith("d3-") || pkg === "victory-vendor" || pkg === "recharts-scale" || pkg === "decimal.js-light") {
    return "charts";
  }
  if (pkg.startsWith("@radix-ui/") || pkg.startsWith("@floating-ui/") || pkg === "react-remove-scroll"
    || pkg === "react-remove-scroll-bar" || pkg === "aria-hidden" || pkg === "react-style-singleton"
    || pkg === "use-callback-ref" || pkg === "use-sidecar" || pkg === "get-nonce") {
    return "radix";
  }
  return undefined;
}

// https://vitejs.dev/config/
// VITE_BASE sets the public path the site is served from: "/" (default; custom domain, Netlify,
// Vercel, Cloudflare Pages) or "/<repo>/" for a GitHub Pages project site.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const base = normaliseBase(process.env.VITE_BASE ?? env.VITE_BASE);
  return {
    base,
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), spaFallback()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: vendorChunk,
        },
      },
    },
  };
});
