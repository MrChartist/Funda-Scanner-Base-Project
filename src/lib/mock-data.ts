// Mock data mirroring the /api/company/:symbol/intelligence response structure
// Price data is overlaid with real TradingView data when available via useLivePrices()

function generatePriceHistory(days: number, basePrice: number) {
  const data = [];
  let price = basePrice;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const change = (Math.random() - 0.48) * basePrice * 0.025;
    price = Math.max(price + change, basePrice * 0.6);
    const vol = Math.floor(1000000 + Math.random() * 5000000);
    data.push({
      date: date.toISOString().split("T")[0],
      open: +(price - Math.random() * 10).toFixed(2),
      high: +(price + Math.random() * 15).toFixed(2),
      low: +(price - Math.random() * 15).toFixed(2),
      close: +price.toFixed(2),
      volume: vol,
    });
  }
  return data;
}

function generateYearlyFinancials(years: number) {
  const rows = [];
  let revenue = 150000;
  for (let i = 0; i < years; i++) {
    revenue *= 1 + Math.random() * 0.15;
    const ebitda = revenue * (0.2 + Math.random() * 0.1);
    const depreciation = ebitda * 0.15;
    const interest = revenue * 0.02;
    const pbt = ebitda - depreciation - interest;
    const tax = pbt * 0.25;
    const netProfit = pbt - tax;
    rows.push({
      year: 2015 + i,
      revenue: Math.round(revenue),
      ebitda: Math.round(ebitda),
      depreciation: Math.round(depreciation),
      interest: Math.round(interest),
      pbt: Math.round(pbt),
      tax: Math.round(tax),
      net_profit: Math.round(netProfit),
      total_assets: Math.round(revenue * 1.5),
      total_liabilities: Math.round(revenue * 0.6),
      equity: Math.round(revenue * 0.9),
      reserves: Math.round(revenue * 0.7),
      debt: Math.round(revenue * 0.3),
      ocf: Math.round(netProfit * 1.2),
      icf: Math.round(-revenue * 0.1),
    });
  }
  return rows;
}

function generateQuarterlyResults(quarters: number) {
  const rows = [];
  let revenue = 45000;
  for (let i = 0; i < quarters; i++) {
    revenue *= 1 + (Math.random() - 0.3) * 0.08;
    const opm = 18 + Math.random() * 8;
    const ebitda = revenue * (opm / 100);
    const depreciation = ebitda * 0.15;
    const interest = revenue * 0.02;
    const pbt = ebitda - depreciation - interest;
    const tax = pbt * 0.25;
    const netProfit = pbt - tax;
    const qtr = ((i % 4) + 1);
    const year = 2023 + Math.floor(i / 4);
    rows.push({
      quarter: `Q${qtr} FY${year}`,
      revenue: Math.round(revenue),
      ebitda: Math.round(ebitda),
      depreciation: Math.round(depreciation),
      interest: Math.round(interest),
      pbt: Math.round(pbt),
      tax: Math.round(tax),
      net_profit: Math.round(netProfit),
      opm_pct: +opm.toFixed(1),
    });
  }
  return rows.reverse();
}

function generateRatios(years: number) {
  const rows = [];
  for (let i = 0; i < years; i++) {
    rows.push({
      year: 2015 + i,
      roce: +(14 + Math.random() * 12).toFixed(1),
      roe: +(12 + Math.random() * 10).toFixed(1),
      ebitda_margin: +(18 + Math.random() * 8).toFixed(1),
      npm: +(10 + Math.random() * 8).toFixed(1),
      debt_equity: +(0.1 + Math.random() * 0.6).toFixed(2),
      interest_coverage: +(4 + Math.random() * 8).toFixed(1),
      sales_growth: +(5 + (Math.random() - 0.3) * 20).toFixed(1),
      profit_growth: +(5 + (Math.random() - 0.3) * 25).toFixed(1),
    });
  }
  return rows;
}

export const MOCK_COMPANIES = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", sector: "Energy", industry: "Oil & Gas Refining", market_cap: 1920000, price: 2845.60, change_pct: 1.24 },
  { symbol: "TCS", name: "Tata Consultancy Services Ltd", sector: "IT", industry: "IT Services", market_cap: 1540000, price: 4210.30, change_pct: -0.56 },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Banking", industry: "Private Banks", market_cap: 1380000, price: 1820.45, change_pct: 0.89 },
  { symbol: "INFY", name: "Infosys Ltd", sector: "IT", industry: "IT Services", market_cap: 780000, price: 1890.25, change_pct: -1.12 },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd", sector: "Banking", industry: "Private Banks", market_cap: 920000, price: 1280.50, change_pct: 0.45 },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", sector: "Telecom", industry: "Telecom Services", market_cap: 850000, price: 1720.80, change_pct: 2.15 },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd", sector: "FMCG", industry: "Personal Products", market_cap: 620000, price: 2640.90, change_pct: -0.34 },
  { symbol: "ITC", name: "ITC Ltd", sector: "FMCG", industry: "Tobacco", market_cap: 580000, price: 465.20, change_pct: 0.78 },
  { symbol: "SBIN", name: "State Bank of India", sector: "Banking", industry: "Public Banks", market_cap: 720000, price: 808.15, change_pct: -0.92 },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd", sector: "Finance", industry: "NBFC", market_cap: 510000, price: 8420.75, change_pct: 1.67 },
  { symbol: "LT", name: "Larsen & Toubro Ltd", sector: "Capital Goods", industry: "Construction", market_cap: 490000, price: 3580.40, change_pct: 0.23 },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd", sector: "Banking", industry: "Private Banks", market_cap: 420000, price: 2120.65, change_pct: -0.45 },
  { symbol: "MARUTI", name: "Maruti Suzuki India Ltd", sector: "Automobile", industry: "Passenger Vehicles", market_cap: 410000, price: 13450.30, change_pct: 1.89 },
  { symbol: "TITAN", name: "Titan Company Ltd", sector: "Consumer Durables", industry: "Jewellery", market_cap: 320000, price: 3610.20, change_pct: -1.45 },
  { symbol: "ASIANPAINT", name: "Asian Paints Ltd", sector: "Consumer Durables", industry: "Paints", market_cap: 280000, price: 2920.50, change_pct: 0.12 },
  { symbol: "WIPRO", name: "Wipro Ltd", sector: "IT", industry: "IT Services", market_cap: 270000, price: 520.80, change_pct: -0.67 },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries Ltd", sector: "Pharma", industry: "Pharmaceuticals", market_cap: 390000, price: 1650.40, change_pct: 0.56 },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Automobile", industry: "Commercial Vehicles", market_cap: 350000, price: 950.60, change_pct: 2.34 },
  { symbol: "HCLTECH", name: "HCL Technologies Ltd", sector: "IT", industry: "IT Services", market_cap: 450000, price: 1680.90, change_pct: -0.23 },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement Ltd", sector: "Cement", industry: "Cement", market_cap: 310000, price: 10750.25, change_pct: 0.45 },
];

export const SECTOR_DATA = [
  { name: "IT", change: -0.85, marketCap: 3040000, companies: 4 },
  { name: "Banking", change: 0.32, marketCap: 3440000, companies: 4 },
  { name: "Energy", change: 1.24, marketCap: 1920000, companies: 1 },
  { name: "FMCG", change: 0.22, marketCap: 1200000, companies: 2 },
  { name: "Telecom", change: 2.15, marketCap: 850000, companies: 1 },
  { name: "Finance", change: 1.67, marketCap: 510000, companies: 1 },
  { name: "Capital Goods", change: 0.23, marketCap: 490000, companies: 1 },
  { name: "Automobile", change: 2.12, marketCap: 760000, companies: 2 },
  { name: "Consumer Durables", change: -0.67, marketCap: 600000, companies: 2 },
  { name: "Pharma", change: 0.56, marketCap: 390000, companies: 1 },
  { name: "Cement", change: 0.45, marketCap: 310000, companies: 1 },
];

export function getMockCompanyIntelligence(symbol: string) {
  const company = MOCK_COMPANIES.find((c) => c.symbol === symbol) || MOCK_COMPANIES[0];
  const priceHistory = generatePriceHistory(365, company.price);
  const lastPrice = priceHistory[priceHistory.length - 1];

  return {
    company: {
      name: company.name,
      symbol: company.symbol,
      sector: company.sector,
      industry: company.industry || company.sector,
      market_cap: company.market_cap,
      price: lastPrice.close,
      change_pct: company.change_pct,
      pe: +(15 + Math.random() * 30).toFixed(1),
      pb: +(1.5 + Math.random() * 6).toFixed(1),
      roce: +(12 + Math.random() * 18).toFixed(1),
      roe: +(10 + Math.random() * 15).toFixed(1),
      eps: +(50 + Math.random() * 200).toFixed(1),
      de: +(0.05 + Math.random() * 0.8).toFixed(2),
      dividend_yield: +(0.5 + Math.random() * 3).toFixed(2),
      book_value: +(200 + Math.random() * 1000).toFixed(1),
      face_value: 10,
      npm: +(8 + Math.random() * 15).toFixed(1),
      high_52w: +(lastPrice.close * 1.2).toFixed(2),
      low_52w: +(lastPrice.close * 0.75).toFixed(2),
      website: `www.${company.symbol.toLowerCase()}.com`,
      bse_code: `${500000 + Math.floor(Math.random() * 10000)}`,
      nse_code: company.symbol,
      isin: `INE${Math.random().toString(36).substring(2, 5).toUpperCase()}${Math.floor(10000 + Math.random() * 90000)}`,
      registrar: "KFin Technologies Ltd",
      incorporated: `${1980 + Math.floor(Math.random() * 30)}`,
      listed: `${1990 + Math.floor(Math.random() * 20)}`,
      promoter_group: company.name.split(" ")[0] + " Group",
      about: `${company.name} is one of India's leading companies in the ${company.sector} sector. Founded in ${1980 + Math.floor(Math.random() * 30)}, the company has grown to become a market leader with operations spanning across multiple verticals. It has consistently delivered strong financial performance, driven by innovation, strategic acquisitions, and a focus on operational excellence. The company serves millions of customers across India and has been expanding its international footprint.`,
      key_points: [
        `Market leader in the ${company.sector} sector with dominant market share`,
        `Revenue CAGR of ${(8 + Math.random() * 12).toFixed(0)}% over the last 5 years`,
        `Strong R&D focus with ${Math.floor(2 + Math.random() * 8)}% of revenue invested in innovation`,
        `Pan-India presence with operations in ${Math.floor(15 + Math.random() * 15)} states`,
        `${Math.floor(10000 + Math.random() * 90000)}+ employees across ${Math.floor(5 + Math.random() * 20)} countries`,
      ],
      pros: [
        "Strong revenue growth over the last 5 years",
        "Healthy return on equity (ROE) above industry average",
        "Low debt-to-equity ratio indicating strong balance sheet",
        "Consistent dividend payout history",
      ],
      cons: [
        "Trading at premium valuation compared to peers",
        "Promoter holding has decreased slightly in recent quarters",
        "Working capital days have increased",
      ],
    },
    intelligence: {
      tags: [company.sector, company.industry || "", "Large Cap", "Nifty 50"].filter(Boolean),
      business_summary: `${company.name} is one of India's leading companies in the ${company.sector} sector, with operations spanning across multiple verticals. The company has demonstrated resilient financial performance and continues to invest in growth opportunities.`,
      statement_rows: generateYearlyFinancials(10),
      quarterly_rows: generateQuarterlyResults(8),
      ratio_rows: generateRatios(10),
      peers: MOCK_COMPANIES.filter((c) => c.sector === company.sector && c.symbol !== symbol)
        .slice(0, 5)
        .map((p) => ({
          symbol: p.symbol,
          name: p.name,
          price: p.price,
          pe: +(15 + Math.random() * 30).toFixed(1),
          market_cap: p.market_cap,
          roce: +(12 + Math.random() * 18).toFixed(1),
          npm: +(8 + Math.random() * 12).toFixed(1),
          de: +(0.1 + Math.random() * 0.5).toFixed(2),
        })),
      shareholding: [
        { quarter: "Q4 FY2024", promoter_pct: 50.3, fii_pct: 23.1, dii_pct: 15.2, public_pct: 11.4 },
        { quarter: "Q3 FY2024", promoter_pct: 50.3, fii_pct: 22.8, dii_pct: 15.5, public_pct: 11.4 },
        { quarter: "Q2 FY2024", promoter_pct: 50.6, fii_pct: 22.5, dii_pct: 15.1, public_pct: 11.8 },
        { quarter: "Q1 FY2024", promoter_pct: 50.6, fii_pct: 22.2, dii_pct: 14.9, public_pct: 12.3 },
        { quarter: "Q4 FY2023", promoter_pct: 50.8, fii_pct: 21.9, dii_pct: 14.6, public_pct: 12.7 },
        { quarter: "Q3 FY2023", promoter_pct: 51.0, fii_pct: 21.5, dii_pct: 14.3, public_pct: 13.2 },
        { quarter: "Q2 FY2023", promoter_pct: 51.2, fii_pct: 21.2, dii_pct: 14.0, public_pct: 13.6 },
        { quarter: "Q1 FY2023", promoter_pct: 51.4, fii_pct: 20.8, dii_pct: 13.8, public_pct: 14.0 },
      ],
      documents: {
        announcements: [
          { title: "Disclosure Under Regulation 30 Of The SEBI (LODR) Regulations, 2015", date: "2026-03-18", summary: "Customs redemption fine; company to appeal; no operational impact.", type: "Recent" as const },
          { title: `Media Release - ${company.name} SIGNS LANDMARK GREEN AMMONIA BINDING LONG-TERM OFFTAKE AGREEMENT`, date: "2026-03-16", summary: "Signs 15-year binding green ammonia SPA.", type: "Important" as const },
          { title: "Board Meeting Outcome - Quarterly Results Approved", date: "2026-01-25", summary: "Board approved Q3 FY2026 results.", type: "Important" as const },
          { title: "Investor Presentation - Q3 FY2026", date: "2026-01-26", summary: "Quarterly investor presentation released.", type: "Recent" as const },
        ],
        annual_reports: [
          { year: "Financial Year 2025", source: "bse" },
          { year: "Financial Year 2024", source: "bse" },
          { year: "Financial Year 2023", source: "bse" },
          { year: "Financial Year 2022", source: "bse" },
          { year: "Financial Year 2021", source: "bse" },
        ],
        credit_ratings: [
          { title: "Rating update", date: "30 Jan from crisil" },
          { title: "Rating update", date: "29 Jan from icra" },
          { title: "Rating update", date: "30 Oct 2025 from crisil" },
          { title: "Rating update", date: "30 Jul 2025 from crisil" },
        ],
        concalls: [
          { date: "Jan 2026", transcript: true, ai_summary: true, ppt: false, rec: false },
          { date: "Jan 2026", transcript: true, ai_summary: true, ppt: true, rec: false },
          { date: "Oct 2025", transcript: true, ai_summary: true, ppt: true, rec: true },
          { date: "Oct 2025", transcript: false, ai_summary: false, ppt: true, rec: false },
        ],
      },
      price_history: priceHistory,
      corporate_actions: [
        { type: "DIVIDEND", date: "2024-08-15", details: "₹8.00 per share", ratio: "" },
        { type: "DIVIDEND", date: "2024-02-10", details: "₹6.50 per share", ratio: "" },
        { type: "BONUS", date: "2023-09-20", details: "1:1 Bonus Issue", ratio: "1:1" },
        { type: "DIVIDEND", date: "2023-07-12", details: "₹7.00 per share", ratio: "" },
        { type: "SPLIT", date: "2022-11-05", details: "Stock Split", ratio: "1:5" },
        { type: "DIVIDEND", date: "2022-08-18", details: "₹5.00 per share", ratio: "" },
      ],
      analyst_ratings: {
        buy_count: 28,
        hold_count: 8,
        sell_count: 3,
        target_price: +(lastPrice.close * 1.18).toFixed(2),
      },
      snapshot_metrics: [
        { label: "Market Cap", value: `₹${(company.market_cap / 100).toFixed(0)}K Cr`, type: "neutral" },
        { label: "Current Price", value: `₹${lastPrice.close.toFixed(2)}`, type: "neutral" },
        { label: "52W High/Low", value: `₹${(lastPrice.close * 1.2).toFixed(0)} / ₹${(lastPrice.close * 0.75).toFixed(0)}`, type: "neutral" },
      ],
    },
  };
}

export function searchCompanies(query: string) {
  const q = query.toLowerCase();
  return MOCK_COMPANIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
  ).slice(0, 15);
}
