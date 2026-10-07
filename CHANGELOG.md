# Changelog

All notable changes are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Rebuild: a fundamentals research tool that explains itself

The app was rebuilt around one data engine. Every page now reads the same metric store, so a figure is
formatted the same way on the Screener, the company page, Compare and the Watchlist (an integration test
checks this). This is a large, breaking change; read "Breaking changes" below before upgrading.

#### Added
- **Dataset format v1** (`funda-dataset`): companies with annual statements, quarterly results and
  shareholding history, validated with a report of coded errors and warnings, normalised, and kept in
  IndexedDB with localStorage and in-memory fallbacks. Import canonical JSON, the old one-row snapshot
  files, or the four wide CSV files (`companies`, `annual`, `quarterly`, `shareholding`), dropped together
  and joined by symbol. Unit sniffing for lakh/crore/rupee files. See `docs/data-format.md`.
- **Metrics engine**: 129 base metrics (92 ratios and scores plus 37 line items) and generated variants
  (previous year, TTM, 3/5/10-year averages, CAGR and cumulative sums, changes). Every metric has a formula, a
  period tag, a unit and a null-reason; a missing value is never zero. Piotroski F-score and Altman Z''
  with a "why this score" breakdown. Peer groups (industry, then sector, then class) with minimum sizes, and
  separate peer classes for banks, NBFCs and insurers. `docs/metrics.md` is generated from the catalogue.
- **FSQL**, a small readable query language: windows (`every(roce > 15, 5y)`), period selectors
  (`debt_equity[fy-3]`), peer functions (`industry_median(pe)`), `SORT BY`, `LIMIT`, rank, plain-English
  rendering of every query, positioned diagnostics with suggestions, and two-way sync with rule chips.
  See `docs/query-language.md`.
- **Screener**: guided screens (7 templates, each with its idea, a note per rule and what it will not
  find), a funnel, near misses, "why it matched", skipped-company groups with reasons, coverage warnings,
  column chooser, compare tray, universe selector, share links, saved screens, CSV export with a provenance
  header.
- **Company page**: key metrics by company type, 26 rule-based checks and 16 "worth checking" red flags
  (each a visible FSQL rule), the two scores with working, statements, quarterly results, ratio trends,
  shareholding, dividends, peers with a median row, and a data-health panel. A real not-found state.
- **Learn page**: a glossary entry for each of the 25 basic-level metrics and 10 short concept notes, with
  the ⓘ card on every figure.
- **Sample data**: 150 fictional companies generated deterministically (seed 24301), including lenders and
  insurers, every one labelled "(fictional)". A stress set of 5,000 companies for performance tests. Public
  sample files in `public/sample-data/`.
- **Tests**: contract tests for the catalogue, formatter, glossary, rules, forbidden words, real-name
  denylist and the absence of mock data; integration tests for one source of truth across pages, legacy
  snapshot import, wide statement CSVs, share links, legacy upgrade and lenders; performance budgets
  (`npm run test:perf`, strict with `PERF=1`). `docs/release-checklist.md` lists the manual checks.
- ESLint rules: no raw `toFixed` in the metric pages, no HTML sinks, no clock or randomness in core code.

#### Changed
- Dashboard, Watchlist, Portfolio and DCF calculator read the loaded dataset. The DCF takes cash flow,
  shares and net debt from your data; the rates are labelled as your assumptions. Portfolio is valued at
  the reference price in your data, with its date shown only if the data has one.
- Saved screens, the followed list and the portfolio are versioned and migrated on first load. A v0
  `funda-imported-data` import is moved into the new storage once and then removed; the old saved-screens
  list is kept as a one-time backup. Followed symbols that are not in the data stay on your list under
  "Not in your current data".
- Lenders (banks, NBFCs, insurers) get lender metrics; measures that do not apply say "not applicable"
  and are reported as skipped, never as a failure.
- Honest labelling everywhere: a banner says what is loaded, no timestamps or prices are invented, and
  exports carry a provenance header, an `is_synthetic` column and a `SAMPLE-` file name for sample data.
  A test rejects words that read as advice (for example "buy", "avoid", "target price").

#### Removed
- Sections that need data this project does not hold or cannot honestly generate: analyst ratings, insider
  deals, management, mutual-fund holdings, documents, price chart, segments, corporate actions and price
  alerts.
- Dashboard ticker, market flows, news and IPO widgets, and the market-movement widgets.
- `src/lib/mock-data.ts` and everything that used it. All figures on screen now come from the loaded
  dataset; with no import, that is the fictional sample.
- The `export-utils` lint exemption (it now follows the same rules as the rest of the code).

#### Breaking changes
- **Mock data is gone.** Code that imported `mock-data` (`getMockCompanyIntelligence`, `MOCK_COMPANIES`)
  must read from a `DataProvider` or the metric store instead.
- **New dataset format.** Providers should return a `FundamentalsDataset` (`src/lib/contracts/dataset.ts`).
  Old providers that return a list of rows still work: they are wrapped into a snapshot-only dataset, and
  history-based metrics, checks and scores are then unavailable.
- **FSQL replaces the old filter list.** Saved screens in the old format are converted to FSQL on first
  load. The query language is original: phrases from other screeners ("preceding year", "N years back")
  are rejected with a hint, by design.
- Stored data moved to versioned envelopes under the same `funda-*` keys. Downgrading to an older build
  after upgrading is not supported.

### Earlier unreleased changes (before the rebuild)

### Added
- Unit tests for DCF maths, mock data and the screening engine; GitHub Actions CI.
- `DataProvider` interface (`src/lib/data-provider.ts`) with a pure `runScreen()` engine and a built-in demo provider; "Demo data" badge.
- Footer with investment disclaimer; `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, issue/PR templates, `.env.example`.
- Route-level code splitting and vendor chunks.

- **Import your own data:** CSV/JSON import in the Screener with validation feedback, template and sample files, and `docs/data-format.md`. Imported data persists in the browser.

### Changed
- DCF calculations moved to `src/lib/dcf.ts`; perpetuity method now reports an invalid state instead of nonsense when terminal growth ≥ discount rate.
- Mock data is deterministic per symbol.
- Screening sorts missing values last; table cells show "—" for missing numbers.
- Demo notifications are opt-in (`VITE_DEMO_ALERTS=true`) and labelled as demo.
- Standardised on npm (`package-lock.json`); ESLint reports zero errors.

### Removed
- TradingView integration (client, live-price hook, dev proxy) and all price-action screener metrics/presets (change %, volume, relative volume). The project is now fundamentals-only.
- Lovable tooling and placeholders, broken Playwright config, stray lockfiles, third-party OG image.
