

# Funda Scanner — Premium Financial Data Platform

## Overview
A complete redesign of the Funda Scanner frontend — an institutional-grade financial data presenter for 2,229 NSE companies that surpasses Screener.in in design, interactivity, and data density.

## Pages & Features

### 1. Dashboard (Home Page)
- **Search bar** with instant fuzzy search (symbol + company name), keyboard navigable
- **Market pulse cards**: Top gainers, losers, most active (from mock data)
- **Sector heatmap**: Interactive treemap showing sector performance with color-coded gains/losses
- **Recently viewed** companies (localStorage)

### 2. Company Detail Page (11 Sections — Redesigned)
- **Header**: Company name, live price with change badge, market cap, sector tag, 52-week range as an interactive slider bar, collapsible business summary
- **Key Ratios Grid**: 12 metric cards with sparkline trends (P/E, ROCE, ROE, EPS, D/E, etc.) — color coded green/red based on quality
- **Pros & Cons**: Clean card layout with icons
- **Price Chart**: Interactive area chart with 1M/3M/6M/1Y/3Y/5Y/MAX toggles, volume bars overlay, SMA-50/200 toggle lines, crosshair with tooltip
- **Analyst Ratings**: Horizontal stacked bar (Buy/Hold/Sell) + target price with upside percentage
- **Quarterly Results**: Sortable table with revenue/profit trend sparklines in the header, OPM% highlighted
- **Financial Statements**: Tabbed view (P&L / Balance Sheet / Cash Flow) with 10-year data, expandable rows, and a Revenue vs Profit bar chart
- **Ratios Table**: 10-year ratio trends with conditional formatting (green for improving, red for deteriorating)
- **Shareholding Pattern**: Animated donut chart + quarterly stacked area chart showing promoter/FII/DII/public trends
- **Corporate Actions**: Timeline view with dividend, split, bonus events
- **Peer Comparison**: Sortable table with 5 peers, clickable rows, highlighted current company

### 3. Advanced Stock Screener (New — Beats Screener.in)
- **Query builder UI**: Add multiple filter conditions with dropdowns (metric → operator → value), e.g., "ROCE > 20% AND D/E < 0.5 AND Market Cap > 1000 Cr"
- **Preset screens**: "High ROCE Low Debt", "Dividend Champions", "Growth Stocks", "Undervalued Large Caps"
- **Results table**: Sortable, filterable with key metrics columns, click to navigate to company detail
- **Save custom screens** to localStorage

### 4. Global UI & Design System
- **Dark/Light theme** with smooth transitions (CSS variables)
- **Bloomberg-inspired dark theme**: Deep navy background, neon green/cyan accents for positive, red for negative
- **Clean light theme**: White background with professional typography
- **Responsive**: Desktop-first but fully usable on mobile with collapsible tables
- **Navigation**: Sticky header with search, theme toggle, and screener link
- **Loading states**: Content-shaped skeleton loaders

### Data Layer
- Mock data service mirroring your API's `/api/company/:symbol/intelligence` response structure
- Centralized API config so you only change one URL to connect your real backend
- React Query for caching and loading states

