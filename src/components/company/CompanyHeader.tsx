import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, TrendingUp, TrendingDown, Building2, Activity, Globe, Heart, Download, ExternalLink, Info, Bookmark } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CompanyHeaderProps {
  company: {
    name: string; symbol: string; sector: string; industry: string;
    price: number; change_pct: number; market_cap: number;
    high_52w: string | number; low_52w: string | number; about: string;
    pe: number; eps: number; pb?: number; roce: number; roe: number;
    de: string | number; dividend_yield: string | number; book_value: string | number; face_value: number;
    website?: string; bse_code?: string; nse_code?: string; isin?: string;
    registrar?: string; incorporated?: string; listed?: string; promoter_group?: string;
    key_points?: string[];
  };
  onExportExcel?: () => void;
}

export function CompanyHeader({ company, onExportExcel }: CompanyHeaderProps) {
  const [showAbout, setShowAbout] = useState(false);
  const [showKeyInfo, setShowKeyInfo] = useState(false);
  const [isFollowing, setIsFollowing] = useState(() => {
    try {
      const followed: string[] = JSON.parse(localStorage.getItem("funda-followed") || "[]");
      return followed.includes(company.symbol);
    } catch { return false; }
  });
  const isPositive = company.change_pct >= 0;
  const h52 = Number(company.high_52w);
  const l52 = Number(company.low_52w);
  const rangePct = h52 !== l52 ? ((company.price - l52) / (h52 - l52)) * 100 : 50;

  const toggleFollow = () => {
    try {
      const followed: string[] = JSON.parse(localStorage.getItem("funda-followed") || "[]");
      const updated = isFollowing ? followed.filter((s) => s !== company.symbol) : [...followed, company.symbol];
      localStorage.setItem("funda-followed", JSON.stringify(updated));
      setIsFollowing(!isFollowing);
    } catch {}
  };

  const handleExport = () => {
    // Simple CSV export of company data
    const rows = [
      ["Metric", "Value"],
      ["Name", company.name], ["Symbol", company.symbol], ["Sector", company.sector],
      ["Price", `₹${company.price}`], ["Market Cap", `₹${company.market_cap} Cr`],
      ["P/E", String(company.pe)], ["P/B", String(company.pb || "")],
      ["ROCE", `${company.roce}%`], ["ROE", `${company.roe}%`],
      ["EPS", `₹${company.eps}`], ["D/E", String(company.de)],
      ["Dividend Yield", `${company.dividend_yield}%`],
      ["Book Value", `₹${company.book_value}`], ["Face Value", `₹${company.face_value}`],
      ["BSE Code", company.bse_code || ""], ["NSE Code", company.nse_code || ""],
      ["ISIN", company.isin || ""],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${company.symbol}_data.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const keyInfoItems = [
    { label: "Market Cap", value: `₹${(company.market_cap / 100).toFixed(0)}K Cr` },
    { label: "P/E Ratio", value: String(company.pe) },
    { label: "P/B Ratio", value: String(company.pb || "N/A") },
    { label: "ROCE", value: `${company.roce}%` },
    { label: "ROE", value: `${company.roe}%` },
    { label: "EPS", value: `₹${company.eps}` },
    { label: "D/E Ratio", value: String(company.de) },
    { label: "Div. Yield", value: `${company.dividend_yield}%` },
    { label: "Book Value", value: `₹${company.book_value}` },
    { label: "Face Value", value: `₹${company.face_value}` },
    { label: "BSE Code", value: company.bse_code || "N/A" },
    { label: "NSE Code", value: company.nse_code || company.symbol },
    { label: "ISIN", value: company.isin || "N/A" },
    { label: "Registrar", value: company.registrar || "N/A" },
    { label: "Incorporated", value: company.incorporated || "N/A" },
    { label: "Listed Since", value: company.listed || "N/A" },
    { label: "Promoter Group", value: company.promoter_group || "N/A" },
  ];

  return (
    <div className="glass-card-elevated p-6 md:p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {company.name}
            </h1>
            <Badge variant="outline" className="font-mono text-xs bg-primary/5 border-primary/20 text-primary">
              {company.symbol}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1.5 font-medium">
              <Building2 className="h-3 w-3" />{company.sector}
            </Badge>
            {company.industry && <Badge variant="secondary" className="font-medium">{company.industry}</Badge>}
            {company.website && (
              <a href={`https://${company.website}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                <Globe className="h-3 w-3" />{company.website}
              </a>
            )}
          </div>
          {/* BSE/NSE codes inline */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {company.bse_code && <span>BSE: <span className="font-mono text-foreground">{company.bse_code}</span></span>}
            {company.nse_code && <span>NSE: <span className="font-mono text-foreground">{company.nse_code}</span></span>}
            {company.isin && <span>ISIN: <span className="font-mono text-foreground">{company.isin}</span></span>}
          </div>
        </div>

        <div className="text-right space-y-2">
          <div className="flex items-center gap-3 justify-end">
            <span className="text-3xl md:text-4xl font-mono font-bold text-foreground tracking-tight">
              ₹{company.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-mono font-bold transition-all ${
              isPositive ? "bg-chart-green/10 text-positive glow-green" : "bg-chart-red/10 text-negative glow-red"
            }`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {isPositive ? "+" : ""}{company.change_pct.toFixed(2)}%
            </div>
          </div>
          <div className="flex items-center gap-4 justify-end text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />MCap: <span className="font-mono font-medium text-foreground">₹{(company.market_cap / 100).toFixed(0)}K Cr</span>
            </span>
            <span>P/E: <span className="font-mono font-medium text-foreground">{company.pe}</span></span>
            <span>EPS: <span className="font-mono font-medium text-foreground">₹{company.eps}</span></span>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-2 justify-end mt-2">
            <button onClick={toggleFollow}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all border ${
                isFollowing
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50"
              }`}>
              <Bookmark className={`h-3.5 w-3.5 ${isFollowing ? "fill-primary" : ""}`} />
              {isFollowing ? "Following" : "Follow"}
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-muted/30 text-muted-foreground border border-border/40 hover:bg-muted/50 transition-all">
              <Download className="h-3.5 w-3.5" />Export
            </button>
          </div>
        </div>
      </div>

      {/* 52W Range */}
      <div className="relative mt-6 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span className="font-mono">₹{l52.toLocaleString()} <span className="text-negative text-[10px]">52W Low</span></span>
          <span className="font-mono"><span className="text-positive text-[10px]">52W High</span> ₹{h52.toLocaleString()}</span>
        </div>
        <div className="relative h-2.5 rounded-full bg-muted/60 overflow-hidden">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-chart-red/40 via-chart-amber/30 to-chart-green/40" />
          <motion.div initial={{ left: "0%" }} animate={{ left: `${Math.min(Math.max(rangePct, 2), 98)}%` }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.8 }} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="h-5 w-5 rounded-full bg-primary border-2 border-card shadow-lg" />
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-card border border-border rounded-md px-2 py-0.5 text-[10px] font-mono font-bold text-foreground shadow-sm whitespace-nowrap">
                ₹{company.price.toFixed(0)}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Toggle buttons row */}
      <div className="flex items-center gap-4 mt-4">
        <button onClick={() => setShowAbout(!showAbout)}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors">
          {showAbout ? "Hide" : "About"} Company
          <motion.div animate={{ rotate: showAbout ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </button>
        <button onClick={() => setShowKeyInfo(!showKeyInfo)}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors">
          <Info className="h-3.5 w-3.5" />
          {showKeyInfo ? "Hide" : "Key"} Information
          <motion.div animate={{ rotate: showKeyInfo ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </button>
      </div>

      <AnimatePresence>
        {showAbout && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{company.about}</p>
              {company.key_points && company.key_points.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Key Points</h4>
                  <ul className="space-y-1.5">
                    {company.key_points.map((point, i) => (
                      <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-primary mt-1">•</span>{point}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showKeyInfo && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {keyInfoItems.map((item, i) => (
                <motion.div key={item.label} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                  <span className="text-[10px] text-muted-foreground block">{item.label}</span>
                  <span className="text-sm font-mono font-semibold text-foreground">{item.value}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
