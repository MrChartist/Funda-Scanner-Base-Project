// Centralized API configuration
// Change this single URL to point to your real backend
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5580";

export const api = {
  baseUrl: API_BASE_URL,

  async getCompanyIntelligence(symbol: string) {
    const res = await fetch(`${API_BASE_URL}/api/company/${symbol}/intelligence`);
    if (!res.ok) throw new Error(`Failed to fetch ${symbol}`);
    return res.json();
  },

  async search(query: string) {
    const res = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("Search failed");
    return res.json();
  },

  async getDashboard() {
    const res = await fetch(`${API_BASE_URL}/api/market/dashboard`);
    if (!res.ok) throw new Error("Dashboard fetch failed");
    return res.json();
  },
};
