# Contributing to Funda Scanner

Thanks for helping out. This is a small project, so the process is light.

## Setup

```bash
git clone https://github.com/MrChartist/Funda-Scanner-Base-Project.git
cd Funda-Scanner-Base-Project
npm install
npm run dev        # http://localhost:8080
```

Use Node 18+ (`.nvmrc` pins 20). The repository uses **npm** and `package-lock.json`; please do not add other lockfiles.

## Before opening a pull request

```bash
npm run check      # typecheck, strict typecheck, lint, tests and production build
```

CI runs the same steps. Pull requests should be small and focused, with tests for any logic change.

Other commands you may need:

```bash
PERF=1 npm run test:perf   # strict performance budgets (run on a quiet machine); plain `npm run test:perf` uses loose ceilings
npm run sample:files       # only when the sample generator changes; commit the regenerated files in public/sample-data/
npm run docs:metrics       # only when the metric catalogue changes; commit the regenerated docs/metrics.md
```

Before a release, go through [docs/release-checklist.md](docs/release-checklist.md).

## Originality and provenance

This project must stay original work. Please do not copy from other screeners or research sites,
whether code, text, layout, screenshots, example queries, metric names or phrase spellings, and do
not paste in anything you cannot show you wrote or that is not under a licence compatible with MIT.

- Write metric descriptions, glossary entries, template notes and check wording yourself, in simple,
  formal Indian English. Do not paraphrase another site line by line.
- Metric ids, the FSQL syntax and its error messages are this project's own. Do not add aliases or
  syntax whose only purpose is to imitate another product (the language deliberately rejects such
  phrases with a hint).
- Public ideas (for example the Piotroski F-score or the Altman Z-score) may be implemented from the
  published paper or textbook definition. Cite the idea generically (a book or paper, never a website)
  and write the code and the explanation from your own understanding.
- Sample data stays generated and fictional. Do not use real company names, symbols or figures; a test
  checks generated names against a denylist of real ones.
- Say where anything non-trivial came from in the pull request description. Reviewers will ask.

## Changing metrics and contracts

- **Metrics need a golden test.** A new or changed metric must come with a hand-computed expectation in
  the golden company tests (`src/lib/metrics/golden.test.ts`, `src/test/fixtures/metrics/golden-company.ts`),
  with the arithmetic written out, not copied from the code under test. Existing metric values do not
  change without a note in `CHANGELOG.md`.
- **Contracts are frozen and additive.** The types and constants in `src/lib/contracts/` (dataset,
  metric ids, null reasons, storage keys, URL parameters, saved screen format) are used in saved data,
  share links and files that people keep. Ids and codes are never renamed or removed. New fields,
  ids and codes may be added at the end, with a migration if stored data needs one. A change to a
  contract needs the maintainers' agreement before you start.
- Every metric id needs a deriver (or column provider), a formatter result for each null reason, an alias,
  a tooltip of 120 characters or fewer and, for basic-level metrics, a glossary entry. `src/test/contracts.test.ts`
  checks all of this.
- Never write the words "buy", "sell", "avoid", "target price" and the like in user-facing text; a test enforces it.

## Guidelines

- **Data sources:** Keep the app vendor-neutral. New data sources belong behind `DataProvider`, not in pages or components.
- **Fundamentals only:** No technical indicators or live price-action features.
- **Data:** Do not commit scraped or licensed market data, API keys or personal information. Sample data must stay clearly synthetic and labelled "(fictional)".
- **Finance logic:** Keep calculations pure and in `src/lib/` (see `src/lib/metrics/` and `src/lib/dcf.ts`) so they can be unit tested. Handle empty, zero and non-finite inputs explicitly. A missing value is `null` with a reason, never `0`. Core code does not read the clock or use `Math.random` (ESLint enforces it).
- **Showing numbers:** Render metric values with `<ValueCell>` or `formatMetric()`; do not format them with `toFixed` in pages.
- **Types:** Avoid `any`. ESLint reports it as a warning today; do not add new ones, and feel free to remove existing ones.
- **UI:** Use the existing Tailwind tokens (`--primary`, `--positive`, etc.) so light/dark themes and accent colours keep working. Check mobile width.
- **shadcn/ui:** Files in `src/components/ui/` are generated primitives; change them only when necessary.
- **Accessibility:** Interactive elements need labels and keyboard support.

## Commit messages

Short imperative summary, e.g. `fix: guard DCF when terminal growth exceeds discount rate`.
Conventional prefixes (`feat`, `fix`, `docs`, `test`, `chore`) are appreciated.

## Reporting issues

Use the issue templates. For security problems see [SECURITY.md](SECURITY.md).
