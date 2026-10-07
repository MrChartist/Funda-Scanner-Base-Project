<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,50:1a1a2e,100:6366f1&height=180&section=header&text=Funda%20Scanner&fontSize=52&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=Open-source%20fundamentals%20research%20for%20Indian%20stocks&descSize=16&descAlignY=55&descColor=8b5cf6" width="100%" />

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite 5" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT" />
  <a href="https://github.com/MrChartist/Funda-Scanner-Base-Project/actions/workflows/ci.yml"><img src="https://github.com/MrChartist/Funda-Scanner-Base-Project/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

<p align="center">
  <strong>An open-source tool for studying the fundamentals of Indian companies.</strong><br />
  A React + TypeScript front-end with a screener that has its own readable query language, company pages that show how each figure is calculated, a Learn page, and a watchlist, portfolio and DCF calculator. It opens with fictional sample data; you bring your own.
</p>

<p align="center">
  Built by <a href="https://github.com/MrChartist"><strong>Mr. Chartist</strong></a> | Part of the <a href="https://mrchartist.com">Mr. Chartist Ecosystem</a>
</p>

<p align="center">
  <a href="#what-is-funda-scanner">What it is</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#bringing-your-own-data">Bring your own data</a> &bull;
  <a href="#honest-labelling">Honest labelling</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

---

## What is Funda Scanner?

Funda Scanner is a fundamentals-only research tool. It works on figures from company financial statements: sales, profit, cash flow, debt, shareholding and the ratios built from them. It has no prices feed, no news, no charts of market movement and no live data.

This is the **front-end project**. It ships with **150 fictional companies with generated figures**. They describe no real business, and their fiscal-year labels are for illustration only. It contains no third-party market-data integration. You load your own data (files or a small provider you write), and the app works on whatever you load. See [Bringing your own data](#bringing-your-own-data).

> **Disclaimer:** For education and research only. Nothing here is investment advice or a recommendation about any security. Data may be synthetic, delayed or inaccurate. Verify it independently and consult a SEBI-registered adviser before making any investment decision.

---

## Features

### Dashboard
- **About your data**: what is loaded, how many companies and sectors, the latest common year, the price date and the "as of" date, exactly as supplied.
- **Guided screens**: ready-made study screens with live match counts, worked out on the data you have loaded. Each opens in the Screener.
- **Sector medians**: the median of a chosen metric by sector, always with n (the number of companies behind it). Banks, NBFCs and insurers are never mixed with other companies.
- **Learn one metric** and **Recently viewed**. The layout can be reordered and sections hidden.

### Screener and FSQL
- Write conditions in **FSQL**, a small readable language, for example `every(roce > 15, 5y)` and `pe < industry_median(pe)`. See [docs/query-language.md](docs/query-language.md).
- Results explain themselves: which rule each company passed or missed, near misses, and why a company was not evaluated.
- Guided screens (templates) with the idea, a note on every rule, and what the screen will not find.
- Save screens in your browser and export them with their provenance.

### Company page, Compare
- Figures with their period, unit and formula. A missing figure shows its reason; it is never shown as zero.
- Lenders (banks, NBFCs, insurers) get lender metrics, and metrics that do not apply say so.
- Rule-based observations on the data you loaded, with their inputs. They are not recommendations.
- Side-by-side comparison of companies.

### Learn
- A glossary with an entry for each metric (what it tells, how to read it, a worked example, rules of thumb, pitfalls). Every entry has an anchor, for example `/learn#roce`.
- Short notes on the ideas the app relies on, and **What a screen cannot tell you**.

### Watchlist, Portfolio, DCF calculator
- **Watchlist**: followed companies with figures from the loaded data. Symbols that are not in the data stay on your list under *Not in your current data*.
- **Portfolio**: holdings valued at the reference price in your data, with the price date shown. The annual return (XIRR) is shown only when it can be worked out. Symbols that are not in the data are reported, not rejected.
- **DCF calculator**: a two-stage model for study. Cash flow (three-year average), shares outstanding and net debt come from your data; the rates are labelled **Your assumptions**. The Monte Carlo range is repeatable for a given symbol. Open it for a company with `/dcf?symbol=<SYMBOL>`.

### Using the app
- Dark and light themes, accent colour, density settings, mobile bottom navigation.
- Command palette (`Ctrl+K` or `⌘K`) that searches companies, metrics and guided screens. `/` jumps to the query box on the Screener, or to the search box on other pages. `?` lists the shortcuts.
- Animations follow your system's reduced-motion setting.
- Everything you enter (watchlist, portfolio, saved screens, preferences) stays in your browser's local storage.

---

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ (recommended v20+, see `.nvmrc`)
- npm (the repo ships `package-lock.json`)

### Install and run

```bash
git clone https://github.com/MrChartist/Funda-Scanner-Base-Project.git
cd Funda-Scanner-Base-Project
npm install
npm run dev
```

The app starts on **http://localhost:8080**.

### Build, test and check

```bash
npm run build          # production build to dist/
npm run preview        # preview the production build
npm run test           # Vitest + Testing Library
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run check          # typecheck, strict typecheck, lint, test and build (same as CI)
```

---

## Bringing your own data

### Quickest way: import files

Use **Import your data** in the banner under the header. Choose CSV or JSON files (or paste them). Files are read in your browser and never uploaded. Start from the templates in [`public/sample-data/`](public/sample-data/); column names, units and rules are in the [data format guide](docs/data-format.md). Statements are optional: with a snapshot file alone the app still works, but history-based metrics, checks and scores are unavailable, and it says so.

### For developers: write a provider

The app reads data through a `DataProvider`, not from any vendor. **Step 3 is to implement `DataProvider.getDataset()`**, which returns a `FundamentalsDataset` (the canonical format in `src/lib/contracts/dataset.ts`).

```typescript
// src/main.tsx (before rendering)
import { setDataProvider } from "@/lib/data";
import type { DataProvider, FundamentalsDataset } from "@/lib/contracts";

const myProvider: DataProvider = {
  id: "my-data",
  name: "My data",
  isDemo: false,
  revision: 0, // bump it whenever the data behind the provider changes
  async getDataset(signal?: AbortSignal): Promise<FundamentalsDataset> {
    const res = await fetch("/my/dataset.json", { signal }); // or a CSV you convert, an API, a database
    return res.json();
  },
};
setDataProvider(myProvider);
```

1. Describe your companies, annual statements, quarterly results and shareholding in the dataset format ([docs/data-format.md](docs/data-format.md)).
2. Check the shape with the import report (import the same data as files once) and the data health panel on a company page.
3. Implement `DataProvider.getDataset()` and register it with `setDataProvider()`.

Older providers that implement only `getUniverse()` keep working; the app wraps them into a snapshot-only dataset.

You are responsible for the licence and accuracy of any data you connect.

### How the numbers are built

The metrics engine derives each metric from the statements and shows its formula, period and unit ([docs/metrics.md](docs/metrics.md), [docs/methodology.md](docs/methodology.md)). Everything runs in the browser.

---

## Honest labelling

- A banner under the header says what is loaded: sample data, or your data with its name, import time and "as of" date.
- Fictional companies always carry the text "(fictional)" next to their names.
- The app never invents a date or a price. A price date or "as of" date is shown only if your data has one, exactly as supplied.
- A missing figure is never shown as zero. The reason is shown instead.
- Exports carry a provenance header, an `is_synthetic` column and a `SAMPLE-` file name for sample data.
- Scores and checks are rule-based observations on the data you loaded, not recommendations.

---

## Project structure

```
src/
├── App.tsx, main.tsx, index.css
├── pages/                 Dashboard, Screener, CompanyDetail, Compare, Watchlist, Portfolio, DCFCalculator, Learn, NotFound
├── components/
│   ├── common/            Shared building blocks: ValueCell, CompanyName, EmptyState, MetricInfo, search
│   ├── data/              DatasetBanner, ImportReport, DataHealthPanel
│   ├── dashboard/, learn/ Dashboard widgets and the glossary card
│   ├── company/, screener/, compare/
│   └── ui/                shadcn/ui primitives
├── hooks/                 use-dataset, use-watchlist, use-portfolio, use-keyboard-nav, theme and density
└── lib/
    ├── contracts/         Shared types (dataset, metrics, query, screen, insights, learn, provider, user)
    ├── data/              Providers, import, validation, data health
    ├── metrics/           Metric catalogue and the column store
    ├── query/             FSQL: lexer, parser, evaluator
    ├── screen/            Screen runs, templates, saved screens, URLs, CSV export
    ├── insights/          Rule-based checks and red flags
    ├── learn/             Glossary and concept notes
    ├── sample/            The fictional sample generator
    ├── format/            en-IN number and metric formatting
    ├── user/              Versioned browser storage: watchlist, portfolio, layout
    └── dcf.ts             Pure DCF, WACC and Monte Carlo maths
docs/                      data-format.md, metrics.md, methodology.md, query-language.md
```

---

## Tech stack

React 18, TypeScript 5, Vite 5, Tailwind CSS, shadcn/ui (Radix), Recharts, Framer Motion, React Router, TanStack Query, Vitest and Testing Library. CI runs typecheck, lint, tests and build on Node 20 and 22.

---

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues: [SECURITY.md](SECURITY.md).

1. Fork the repository and create a branch.
2. Make your change and run `npm run check`.
3. Open a pull request.

Content and copy are written in simple, formal Indian English. Words that read as advice or hype (for example "guaranteed" or "target price") are not used, and a test enforces it.

### Adding a page

1. Create the page in `src/pages/` and add its route in `src/App.tsx`.
2. Add a link in `src/components/Header.tsx`.
3. Read data through `useDataset()` or `useStore()`, and render numbers with `ValueCell` or `formatMetric`, so each figure keeps its period, unit and reason for being missing.

---

## License

Released under the [MIT License](LICENSE).

### Data and trademarks

- The company figures bundled in this repo are generated and fictional. They are not sourced from any exchange or vendor.
- This repository bundles no third-party market data. If you connect a data source, you are responsible for complying with its licence and any exchange data-redistribution rules.
- All product names and trademarks belong to their respective owners; this project is not affiliated with NSE or BSE.

---

<p align="center">
  <b>Made with care by <a href="https://github.com/MrChartist">Mr. Chartist</a></b><br />
  <a href="https://mrchartist.com"><img src="https://img.shields.io/badge/mrchartist.com-6366f1?style=flat-square&logo=safari&logoColor=white" alt="Website"/></a>
  <a href="https://github.com/MrChartist"><img src="https://img.shields.io/badge/More_Projects-0d1117?style=flat-square&logo=github&logoColor=white" alt="GitHub"/></a>
</p>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,50:1a1a2e,100:6366f1&height=100&section=footer" width="100%" />
