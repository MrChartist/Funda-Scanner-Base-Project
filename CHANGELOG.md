# Changelog

All notable changes are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Unit tests for DCF maths, mock data and the screening engine; GitHub Actions CI.
- `DataProvider` interface (`src/lib/data-provider.ts`) with a pure `runScreen()` engine and a built-in demo provider; "Demo data" badge.
- Footer with investment disclaimer; `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, issue/PR templates, `.env.example`.
- Route-level code splitting and vendor chunks.

### Changed
- DCF calculations moved to `src/lib/dcf.ts`; perpetuity method now reports an invalid state instead of nonsense when terminal growth ≥ discount rate.
- Mock data is deterministic per symbol.
- Demo notifications are opt-in (`VITE_DEMO_ALERTS=true`) and labelled as demo.
- Standardised on npm (`package-lock.json`); ESLint reports zero errors.

### Removed
- TradingView integration (client, live-price hook, dev proxy) and all price-action screener metrics/presets (change %, volume, relative volume). The project is now fundamentals-only.
- Lovable tooling and placeholders, broken Playwright config, stray lockfiles, third-party OG image.
