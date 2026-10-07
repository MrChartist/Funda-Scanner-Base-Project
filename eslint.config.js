import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// Core libraries must be deterministic and must never build HTML from strings (spec §G.2).
const CORE = "src/lib/{contracts,time,format,data,metrics,query,screen,insights,learn,sample,user,engine}/**/*.ts";
const NO_HTML_SINK = [
  { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "Render text through React, never HTML strings." },
  { selector: "AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]", message: "Never assign HTML strings." },
];
const DOC_WRITE = { object: "document", property: "write", message: "Build print views with DOM methods and textContent." };

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Existing code still has loose typing; keep visible as warnings and tighten over time.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // shadcn/ui primitives intentionally co-export variants/hooks next to components.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**", "src/lib/export-utils.ts" /* removed by WS8 */],
    rules: { "no-restricted-syntax": ["error", ...NO_HTML_SINK], "no-restricted-properties": ["error", DOC_WRITE] },
  },
  {
    files: [CORE],
    ignores: ["src/lib/time/clock.ts"],
    rules: {
      "no-restricted-properties": ["error", DOC_WRITE,
        { object: "Math", property: "random", message: "Core code must be deterministic. Use src/lib/sample/prng.ts." },
        { object: "Date", property: "now", message: "Core code must not read the clock. Use src/lib/time/clock.ts." }],
      "no-restricted-syntax": ["error", ...NO_HTML_SINK,
        { selector: "NewExpression[callee.name='Date']", message: "Core code must not read the clock. Use src/lib/time/clock.ts." },
        { selector: "CallExpression[callee.name='Date']", message: "Core code must not read the clock. Use src/lib/time/clock.ts." }],
    },
  },
);
