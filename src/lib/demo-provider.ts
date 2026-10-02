import type { DataProvider, StockRow } from "./data-provider";
import { MOCK_COMPANIES, getMockCompanyIntelligence } from "./mock-data";

const pct = (a: number, b: number) => (b ? +(((a - b) / b) * 100).toFixed(1) : 0);

function toRow(symbol: string): StockRow {
  const { company, intelligence } = getMockCompanyIntelligence(symbol);
  const fy = intelligence.statement_rows;
  const last = fy[fy.length - 1];
  const prev = fy[fy.length - 2];

  return {
    symbol: company.symbol,
    name: company.name,
    sector: company.sector,
    industry: company.industry,
    market_cap: company.market_cap,
    price: company.price,
    pe: company.pe,
    eps: company.eps,
    price_book: company.pb,
    roe: company.roe,
    roce: company.roce,
    debt_equity: company.de,
    debt_ebitda: last.ebitda ? +(last.debt / last.ebitda).toFixed(2) : 0,
    dividend_yield: company.dividend_yield,
    sales_growth: pct(last.revenue, prev.revenue),
    profit_growth: pct(last.net_profit, prev.net_profit),
    fcf_yield: company.market_cap
      ? +(((last.ocf + last.icf) / 10) / company.market_cap * 100).toFixed(1)
      : 0,
  };
}

/** Built-in provider backed by the synthetic mock data. */
export const demoProvider: DataProvider = {
  id: "demo",
  name: "Demo data",
  isDemo: true,
  async getUniverse() {
    return MOCK_COMPANIES.map((c) => toRow(c.symbol));
  },
};
