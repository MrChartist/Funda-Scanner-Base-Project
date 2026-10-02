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
npm run check      # typecheck + lint + tests + production build
```

CI runs the same steps. Pull requests should be small and focused, with tests for any logic change.

## Guidelines

- **Data sources:** Keep the app vendor-neutral. New data sources belong behind `DataProvider`, not in pages or components.
- **Fundamentals only:** No technical indicators or live price-action features.
- **Data:** Do not commit scraped or licensed market data, API keys or personal information. Mock data must stay clearly synthetic.
- **Finance logic:** Keep calculations pure and in `src/lib/` (see `src/lib/dcf.ts`) so they can be unit tested. Handle empty, zero and non-finite inputs explicitly.
- **Types:** Avoid `any`. ESLint reports it as a warning today; do not add new ones, and feel free to remove existing ones.
- **UI:** Use the existing Tailwind tokens (`--primary`, `--positive`, etc.) so light/dark themes and accent colours keep working. Check mobile width.
- **shadcn/ui:** Files in `src/components/ui/` are generated primitives; change them only when necessary.
- **Accessibility:** Interactive elements need labels and keyboard support.

## Commit messages

Short imperative summary, e.g. `fix: guard DCF when terminal growth exceeds discount rate`.
Conventional prefixes (`feat`, `fix`, `docs`, `test`, `chore`) are appreciated.

## Reporting issues

Use the issue templates. For security problems see [SECURITY.md](SECURITY.md).
