<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite 5" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/shadcn%2Fui-49_Components-000?logo=shadcnui&logoColor=white" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT" />
</p>

<h1 align="center">📊 Funda Scanner — Base Project</h1>

<p align="center">
  <strong>Institutional-grade fundamental analysis platform for 2,229+ NSE-listed companies.</strong><br />
  An open-source, fully-featured financial data dashboard built with React, TypeScript, and modern web technologies.
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-project-structure">Project Structure</a> •
  <a href="#-connecting-a-backend">Backend Integration</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

## 🎯 What is Funda Scanner?

Funda Scanner is a **Bloomberg-terminal-inspired** financial analysis platform designed for the Indian stock market (NSE). It provides deep fundamental data analysis with an institutional-grade UI — including financial statements, ratio trend analysis, DCF valuation, stock screening, portfolio tracking, and peer comparison tools.

**This is the base/frontend project.** It ships with realistic mock data for 20 blue-chip NSE companies and is designed to be easily connected to any backend API for live data.

---

## ✨ Features

### 📈 Dashboard
- **Live Market Ticker** — Real-time index tracking (NIFTY 50, SENSEX, Bank Nifty, NIFTY IT, Pharma, India VIX) with sparkline charts
- **Market Overview** — Total market cap, breadth (advancers vs decliners), average ROCE/ROE/D-E across the universe
- **Fundamental Movers** — YoY ROCE change leaders — improving and deteriorating fundamentals
- **Quality Compounders** — Auto-filtered stocks with ROCE > 15%, ROE > 12%, D/E < 0.5
- **Value Picks** — Auto-filtered stocks with PE < 25, ROCE > 10%
- **Sector Heatmap** — Performance visualization across 11 sectors with market cap weighting
- **FII/DII Flow Tracker** — Bar chart visualization of institutional money flows
- **Market News Feed** — Sentiment-tagged news items (bullish/bearish/neutral)
- **IPO Calendar** — Upcoming and open IPOs with subscription details
- **Top Gainers / Losers / Most Active** — Market pulse cards with live price overlay
- **Recently Viewed** — localStorage-based history tracking
- **Customizable Layout** — Drag-to-reorder widgets, toggle visibility, persist preferences

### 🔍 Stock Screener
- **Real-time TradingView Integration** — Powered by TradingView Scanner API for live NSE data
- **Custom Filter Builder** — Build complex multi-condition filters with AND logic
- **16 Screening Metrics** — Market Cap, Price, P/E, EPS, Volume, ROCE, ROE, D/E, Dividend Yield, Sales Growth, Profit Growth, P/B, Debt/EBITDA, FCF Yield, and more
- **13 Pre-built Presets** — Large Cap, High ROCE, Low Debt, Dividend Stars, Growth Stocks, Value Picks, etc.
- **Export to CSV** — One-click data export
- **Save Custom Screens** — Persist your filter configurations locally

### 📋 Company Deep-Dive (24 Analysis Sections)
- **Company Header** — Price, market cap, 52-week range, key ratios at a glance
- **Key Ratios Grid** — PE, PB, ROCE, ROE, EPS, D/E, NPM, Dividend Yield
- **Fundamental Scoring** — Composite quality score with breakdown
- **Pros & Cons** — Investment thesis summary
- **Interactive Price Chart** — 1Y OHLCV chart with zoom/pan
- **Analyst Ratings** — Buy/Hold/Sell consensus with target price
- **Quarterly Results** — Revenue, EBITDA, Net Profit, OPM% trend table
- **Financial Statements** — 10-year P&L, Balance Sheet, Cash Flow data
- **Cash Flow Quality** — OCF, ICF, FCF analysis
- **Ratio Trend Analysis** — Multi-year ROCE, ROE, margins, D/E trends with charts
- **Shareholding Pattern** — 8-quarter promoter/FII/DII/public holding trend
- **Revenue Segmentation** — Business segment breakdown
- **Mutual Fund Holdings** — Top MF holders
- **Insider Deals** — Promoter buy/sell transactions
- **Management Info** — Key management personnel
- **Dividend Analysis** — Historical dividend data and yield trends
- **Documents** — Announcements, annual reports, credit ratings, concall transcripts
- **Corporate Actions** — Dividends, bonus issues, stock splits
- **Peer Comparison** — Side-by-side peer metrics table
- **Export** — PDF report generation and CSV/Excel export

### ⚖️ Compare Tool
- Side-by-side comparison of any two stocks
- All key metrics compared with visual indicators

### 🧮 DCF Calculator
- Full Discounted Cash Flow valuation model
- Adjustable assumptions (growth rate, discount rate, terminal growth)
- Intrinsic value calculation with margin of safety

### 💼 Portfolio Tracker
- Add/remove holdings with purchase price and quantity
- Track P&L, returns, and portfolio allocation
- Sector-wise diversification analysis

### 👁 Watchlist
- Create and manage stock watchlists
- Quick access to favorite stocks with live prices

### 🎨 Customization & UX
- **Dark/Light Theme** — System-aware with manual toggle
- **Accent Color Picker** — Customizable primary color
- **Density Settings** — Compact, comfortable, spacious display modes
- **Command Palette** — `Cmd+K` / `Ctrl+K` for quick navigation
- **Keyboard Shortcuts** — Full keyboard navigation support
- **Onboarding Tour** — First-time user guided tour
- **Animated Page Transitions** — Framer Motion powered
- **Mobile Responsive** — Bottom navigation bar on mobile, touch-friendly
- **PWA Ready** — Web app manifest and icons included

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ (recommended: v20+)
- npm, yarn, bun, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/MrChartist/Funda-Scanner-Base-Project.git
cd Funda-Scanner-Base-Project

# Install dependencies
npm install
# or
bun install
```

### Development

```bash
npm run dev
```

The app starts on **http://localhost:8080** with Hot Module Replacement.

### Build for Production

```bash
npm run build
npm run preview  # Preview the production build
```

### Testing

```bash
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
```

### Linting

```bash
npm run lint
```

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Browser (Client)                      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              React 18 + TypeScript                  │  │
│  │                                                    │  │
│  │  ┌──────────┐  ┌───────────┐  ┌────────────────┐  │  │
│  │  │  Pages   │  │Components │  │    Hooks       │  │  │
│  │  │ (9 views)│  │ (73 total)│  │ (7 custom)     │  │  │
│  │  └────┬─────┘  └─────┬─────┘  └───────┬────────┘  │  │
│  │       │              │                │            │  │
│  │  ┌────▼──────────────▼────────────────▼─────────┐  │  │
│  │  │               Lib Layer                       │  │  │
│  │  │  mock-data │ api │ tradingview │ export-utils  │  │  │
│  │  └──────────────────┬────────────────────────────┘  │  │
│  │                     │                               │  │
│  └─────────────────────┼───────────────────────────────┘  │
│                        │                                  │
│  ┌─────────────────────▼──────────────────────────────┐  │
│  │             Vite Dev Proxy                          │  │
│  │  /api/tv → scanner.tradingview.com (CORS bypass)   │  │
│  │  Backend → VITE_API_URL (configurable)             │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Mock data first** | Ships with realistic data for 20 companies, allowing full UI development without a backend |
| **TradingView Scanner API** | Real-time NSE data via Vite proxy, with graceful fallback to mock data |
| **CSS variables + HSL** | Theme-aware design system supporting dark/light modes and custom accent colors |
| **shadcn/ui primitives** | 49 accessible, customizable components — not a dependency, code is in your repo |
| **Framer Motion** | Smooth page transitions and micro-animations for premium feel |
| **localStorage persistence** | Theme, accent color, density, recently viewed, watchlist, and saved screens stored locally |

---

## 📁 Project Structure

```
Funda-Scanner-Base-Project/
├── public/                    # Static assets
│   ├── favicon.ico
│   ├── manifest.json          # PWA manifest
│   ├── robots.txt
│   └── icons/                 # PWA icons
├── src/
│   ├── App.tsx                # Root — providers, routing, app shell
│   ├── main.tsx               # Entry point
│   ├── index.css              # Global styles, CSS variables, design tokens
│   ├── App.css                # App-level styles
│   │
│   ├── pages/                 # Route-level views
│   │   ├── Dashboard.tsx      # Main dashboard (664 lines, 10 widget components)
│   │   ├── CompanyDetail.tsx   # Company deep-dive (24 analysis sections)
│   │   ├── Screener.tsx       # Stock screener with TradingView integration
│   │   ├── Compare.tsx        # Side-by-side stock comparison
│   │   ├── DCFCalculator.tsx  # Discounted Cash Flow calculator
│   │   ├── Portfolio.tsx      # Portfolio tracker
│   │   ├── Watchlist.tsx      # Stock watchlist
│   │   ├── Index.tsx          # Placeholder (redirects to Dashboard)
│   │   └── NotFound.tsx       # 404 page
│   │
│   ├── components/
│   │   ├── Header.tsx         # Desktop header + mobile bottom nav
│   │   ├── SearchBar.tsx      # Global search with autocomplete
│   │   ├── CommandPalette.tsx  # Cmd+K command palette
│   │   ├── DashboardLayout.tsx # Customizable widget layout
│   │   ├── AccentColorPicker.tsx  # Custom accent color selector
│   │   ├── DensityPicker.tsx  # Display density (compact/comfortable/spacious)
│   │   ├── OnboardingTour.tsx # First-time user guided tour
│   │   ├── PageTransition.tsx # Framer Motion page transitions
│   │   ├── AnimatedNumber.tsx # Smooth number transitions
│   │   ├── NavLink.tsx        # Navigation link component
│   │   ├── NotificationSystem.tsx  # Market notifications
│   │   │
│   │   ├── company/           # 24 company analysis components
│   │   │   ├── CompanyHeader.tsx
│   │   │   ├── KeyRatiosGrid.tsx
│   │   │   ├── FundamentalScoring.tsx
│   │   │   ├── PriceChart.tsx
│   │   │   ├── FinancialStatements.tsx
│   │   │   ├── QuarterlyResults.tsx
│   │   │   ├── RatioTrendAnalysis.tsx
│   │   │   ├── ShareholdingPattern.tsx
│   │   │   ├── CashFlowQuality.tsx
│   │   │   ├── DividendAnalysis.tsx
│   │   │   ├── AnalystRatings.tsx
│   │   │   ├── PeerComparison.tsx
│   │   │   ├── CorporateActions.tsx
│   │   │   ├── Documents.tsx
│   │   │   ├── InsiderDeals.tsx
│   │   │   ├── MutualFundHoldings.tsx
│   │   │   ├── RevenueSegmentation.tsx
│   │   │   ├── ManagementInfo.tsx
│   │   │   ├── ProsCons.tsx
│   │   │   ├── CompanyPageNav.tsx
│   │   │   ├── CompanyBreadcrumb.tsx
│   │   │   ├── ShareSection.tsx
│   │   │   ├── DataFreshness.tsx
│   │   │   └── RatiosTable.tsx
│   │   │
│   │   └── ui/                # 49 shadcn/ui primitives
│   │       ├── button.tsx, dialog.tsx, select.tsx, table.tsx,
│   │       ├── tabs.tsx, toast.tsx, tooltip.tsx, chart.tsx,
│   │       └── ... (accordion, card, carousel, etc.)
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── use-live-prices.tsx    # TradingView live price service
│   │   ├── use-theme.tsx          # Dark/light theme provider
│   │   ├── use-density.tsx        # Display density provider
│   │   ├── use-keyboard-nav.tsx   # Keyboard shortcuts
│   │   ├── use-document-title.ts  # Dynamic page titles
│   │   ├── use-mobile.tsx         # Mobile detection
│   │   └── use-toast.ts           # Toast notifications
│   │
│   ├── lib/                   # Utilities and services
│   │   ├── api.ts             # Backend API client (configurable base URL)
│   │   ├── mock-data.ts       # Mock data for 20 NSE blue-chips
│   │   ├── tradingview.ts     # TradingView Scanner API integration
│   │   ├── export-utils.ts    # PDF and CSV export generators
│   │   └── utils.ts           # General utilities (cn helper)
│   │
│   └── test/                  # Test files
│
├── index.html                 # SPA entry — SEO meta, structured data, OG tags
├── package.json               # Dependencies and scripts
├── vite.config.ts             # Vite config — proxy, aliases, plugins
├── tailwind.config.ts         # Tailwind — custom colors, fonts, animations
├── tsconfig.json              # TypeScript config
├── eslint.config.js           # ESLint config
├── vitest.config.ts           # Vitest config
├── playwright.config.ts       # Playwright E2E config
└── components.json            # shadcn/ui component config
```

---

## 🔌 Connecting a Backend

The app is designed to work with **any backend API** that follows the expected data shape. By default, it uses mock data.

### Step 1: Set the API URL

Create a `.env` file in the project root:

```env
VITE_API_URL=https://your-backend-api.com
```

Or pass it inline:

```bash
VITE_API_URL=https://api.fundascanner.com npm run dev
```

### Step 2: API Endpoints Expected

The app's `src/lib/api.ts` expects these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/company/:symbol/intelligence` | GET | Full company data (financials, ratios, shareholding, price history, etc.) |
| `/api/search?q=query` | GET | Search companies by name or symbol |
| `/api/market/dashboard` | GET | Market overview data |

### Step 3: Replace Mock Data with API Calls

In each page/component, replace `getMockCompanyIntelligence(symbol)` calls with the API client:

```typescript
import { api } from "@/lib/api";

// Instead of:
const data = getMockCompanyIntelligence(symbol);

// Use:
const data = await api.getCompanyIntelligence(symbol);
```

### TradingView Integration

The Screener page and live prices already use TradingView's Scanner API via a Vite dev proxy:

```
/api/tv → https://scanner.tradingview.com
```

For production deployment, set up a server-side proxy (e.g., Vercel serverless function, Nginx reverse proxy, or Cloudflare Worker) to bypass CORS restrictions.

---

## 🎨 Design System

### Theme Tokens (CSS Variables)

The design system is built on HSL-based CSS custom properties defined in `src/index.css`:

| Token | Purpose |
|-------|---------|
| `--background` | Page background |
| `--foreground` | Primary text |
| `--card` | Card backgrounds |
| `--primary` | Brand accent color |
| `--muted-foreground` | Secondary text |
| `--chart-green/red/blue/cyan/amber` | Financial chart colors |
| `--positive` / `--negative` | Gain/loss indicators |

### Typography

- **Sans**: Inter (system-ui fallback)
- **Monospace**: JetBrains Mono (for financial data)
- **Display**: Inter

### Color Customization

Users can change the accent color at runtime via the **Accent Color Picker** in the header. Color changes are persisted in `localStorage`.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18.3 |
| **Language** | TypeScript 5.8 |
| **Build Tool** | Vite 5 (SWC plugin) |
| **Styling** | Tailwind CSS 3.4 + tailwindcss-animate |
| **UI Components** | shadcn/ui (49 Radix primitives) |
| **Charts** | Recharts 2.15 |
| **Animations** | Framer Motion 12 |
| **Routing** | React Router DOM 6.30 |
| **State Management** | TanStack React Query 5 |
| **Form Handling** | React Hook Form + Zod validation |
| **Testing** | Vitest + Testing Library + Playwright |

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 8080 |
| `npm run build` | Production build to `dist/` |
| `npm run build:dev` | Development build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Ways to Contribute

- 🐛 **Bug Reports** — Found a bug? Open an issue
- 💡 **Feature Requests** — Have an idea? Let's discuss it
- 🔧 **Code Contributions** — Submit a PR  
- 📝 **Documentation** — Improve docs, add examples
- 🎨 **Design** — UI/UX improvements and new components

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Make** your changes
4. **Test** your changes: `npm run test && npm run lint`
5. **Commit** with clear messages: `git commit -m "feat: add sector drill-down"`
6. **Push** to your fork: `git push origin feature/your-feature`
7. **Open** a Pull Request

### Code Style

- TypeScript strict mode enabled
- ESLint configured with React hooks and refresh plugins
- Tailwind CSS for styling (no inline styles for layout)
- Component files: PascalCase (e.g., `CompanyHeader.tsx`)
- Hook files: kebab-case (e.g., `use-live-prices.tsx`)
- Utility files: kebab-case (e.g., `mock-data.ts`)

### Adding a New Feature

**New Page:**
1. Create the page component in `src/pages/`
2. Add the route in `src/App.tsx` inside `AnimatedRoutes`
3. Add a nav link in `src/components/Header.tsx`

**New Company Section:**
1. Create the component in `src/components/company/`
2. Import and add it in `src/pages/CompanyDetail.tsx` using the `section()` helper
3. Add the section ID to `CompanyPageNav.tsx` for sidebar navigation

**New Screener Metric:**
1. Add the metric definition to the `METRICS` array in `src/pages/Screener.tsx`
2. Map it to the corresponding TradingView field name

---

## 🌟 Extending the Project

Here are some ideas for extending and improving this base project:

### Backend Ideas
- **Node.js/Express API** — Scrape NSE data, calculate ratios, serve via REST
- **Python/FastAPI** — Use libraries like yfinance for data collection
- **Supabase** — Use as a real-time database for watchlists and portfolios

### Feature Ideas
- 📊 **Technical Analysis** — Add technical indicators (RSI, MACD, Bollinger Bands)
- 🔔 **Price Alerts** — Push notifications when price targets are hit
- 📰 **News Integration** — Live news feed from financial APIs
- 🤖 **AI Analysis** — GPT-powered company analysis and recommendations
- 📱 **Mobile App** — React Native or Capacitor wrapper
- 🧪 **Backtesting** — Historical strategy testing
- 📈 **Options Chain** — Option pricing and Greeks calculator
- 🌐 **Multi-Exchange** — Support BSE, global markets

---

## 📄 License

This project is open source and free to use. Feel free to use it for personal projects, learning, or as a foundation for your own financial platform.

---

## 🙏 Credits

Built with love by [MrChartist](https://github.com/MrChartist) using:
- [Lovable](https://lovable.dev) — AI-powered web development
- [shadcn/ui](https://ui.shadcn.com) — Beautiful UI components
- [Recharts](https://recharts.org) — Composable charting library
- [TradingView](https://tradingview.com) — Real-time market data

---

<p align="center">
  <strong>⭐ Star this repo if you find it useful! ⭐</strong><br />
  <sub>Questions? Open an issue or reach out on GitHub.</sub>
</p>
