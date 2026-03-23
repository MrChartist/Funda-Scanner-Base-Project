import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, TrendingUp, TrendingDown, Building2, Activity, Globe, Download, Info, Bookmark } from "lucide-react";
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
    <div className="glass-card-elevated p-4 md:p-5 relative overflow-hidden">
      <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
              {company.name}
            </h1>
            <Badge variant="outline" className="font-mono bg-primary/5 border-primary/20 text-primary" style={{ fontSize: '10px' }}>
              {company.symbol}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="gap-1 font-medium" style={{ fontSize: '10px' }}>
              <Building2 className="h-2.5 w-2.5" />{company.sector}
            </Badge>
            {company.industry && <Badge variant="secondary" className="font-medium" style={{ fontSize: '10px' }}>{company.industry}</Badge>}
            {company.website && (
              <a href={`https://${company.website}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-primary hover:underline" style={{ fontSize: '10px' }}>
                <Globe className="h-2.5 w-2.5" />{company.website}
              </a>
            )}
          </div>
          <div className="flex items-center gap-3 text-muted-foreground" style={{ fontSize: '10px' }}>
            {company.bse_code && <span>BSE: <span className="font-mono text-foreground">{company.bse_code}</span></span>}
            {company.nse_code && <span>NSE: <span className="font-mono text-foreground">{company.nse_code}</span></span>}
            {company.isin && <span>ISIN: <span className="font-mono text-foreground">{company.isin}</span></span>}
          </div>
        </div>

        <div className="text-right space-y-1.5">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-2xl md:text-3xl font-mono font-bold text-foreground tracking-tight">
              ₹{company.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <div className={`flex items-center gap-1 rounded px-2 py-1 font-mono font-bold transition-all ${
              isPositive ? "bg-chart-green/10 text-positive glow-green" : "bg-chart-red/10 text-negative glow-red"
            }`} style={{ fontSize: '11px' }}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isPositive ? "+" : ""}{company.change_pct.toFixed(2)}%
            </div>
          </div>
          <div className="flex items-center gap-3 justify-end text-muted-foreground" style={{ fontSize: '11px' }}>
            <span className="flex items-center gap-1">
              <Activity className="h-2.5 w-2.5" />MCap: <span className="font-mono font-medium text-foreground">₹{(company.market_cap / 100).toFixed(0)}K Cr</span>
            </span>
            <span>P/E: <span className="font-mono font-medium text-foreground">{company.pe}</span></span>
            <span>EPS: <span className="font-mono font-medium text-foreground">₹{company.eps}</span></span>
          </div>
          <div className="flex items-center gap-1.5 justify-end mt-1">
            <button onClick={toggleFollow}
              className={`flex items-center gap-1 font-medium px-2 py-1 rounded transition-all border ${
                isFollowing
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
              }`} style={{ fontSize: '10px' }}>
              <Bookmark className={`h-3 w-3 ${isFollowing ? "fill-primary" : ""}`} />
              {isFollowing ? "Following" : "Follow"}
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1 font-medium px-2 py-1 rounded bg-muted/30 text-muted-foreground border border-border hover:bg-muted/50 transition-all" style={{ fontSize: '10px' }}>
              <Download className="h-3 w-3" />Export
            </button>
          </div>
        </div>
      </div>

      {/* 52W Range */}
      <div className="relative mt-4 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between text-muted-foreground mb-1.5" style={{ fontSize: '10px' }}>
          <span className="font-mono">₹{l52.toLocaleString()} <span className="text-negative" style={{ fontSize: '9px' }}>52W Low</span></span>
          <span className="font-mono"><span className="text-positive" style={{ fontSize: '9px' }}>52W High</span> ₹{h52.toLocaleString()}</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-muted/60 overflow-hidden">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-chart-red/30 via-chart-amber/20 to-chart-green/30" />
          <motion.div initial={{ left: "0%" }} animate={{ left: `${Math.min(Math.max(rangePct, 2), 98)}%` }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="h-3.5 w-3.5 rounded-full bg-primary border-2 border-card shadow-sm" />
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-card border border-border rounded px-1.5 py-0.5 font-mono font-bold text-foreground shadow-sm whitespace-nowrap" style={{ fontSize: '9px' }}>
                ₹{company.price.toFixed(0)}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Toggle buttons */}
      <div className="flex items-center gap-3 mt-3">
        <button onClick={() => setShowAbout(!showAbout)}
          className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors" style={{ fontSize: '11px' }}>
          {showAbout ? "Hide" : "About"} Company
          <motion.div animate={{ rotate: showAbout ? 180 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronDown className="h-3 w-3" />
          </motion.div>
        </button>
        <button onClick={() => setShowKeyInfo(!showKeyInfo)}
          className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors" style={{ fontSize: '11px' }}>
          <Info className="h-3 w-3" />
          {showKeyInfo ? "Hide" : "Key"} Information
          <motion.div animate={{ rotate: showKeyInfo ? 180 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronDown className="h-3 w-3" />
          </motion.div>
        </button>
      </div>

      <AnimatePresence>
        {showAbout && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="mt-2 space-y-2">
              <p className="text-muted-foreground leading-relaxed" style={{ fontSize: '12px' }}>{company.about}</p>
              {company.key_points && company.key_points.length > 0 && (
                <div>
                  <h4 className="font-semibold text-foreground uppercase tracking-wider mb-1.5" style={{ fontSize: '9px' }}>Key Points</h4>
                  <ul className="space-y-1">
                    {company.key_points.map((point, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-muted-foreground" style={{ fontSize: '11px' }}>
                        <span className="text-primary mt-0.5">•</span>{point}
                      </li>
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
            transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
              {keyInfoItems.map((item) => (
                <div key={item.label} className="rounded border border-border bg-muted/20 px-2 py-1.5">
                  <span className="text-muted-foreground block" style={{ fontSize: '9px' }}>{item.label}</span>
                  <span className="font-mono font-semibold text-foreground" style={{ fontSize: '11px' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
