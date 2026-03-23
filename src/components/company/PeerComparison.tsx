import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, ExternalLink } from "lucide-react";

interface Peer {
  symbol: string; name: string; price: number; pe: number;
  market_cap: number; roce: number; npm: number; de: string | number;
}

interface Props {
  peers: Peer[];
  currentSymbol: string;
  company: { symbol: string; name: string; price: number; pe: number; market_cap: number; roce: number; npm: number; de: string | number };
}

export function PeerComparison({ peers, currentSymbol, company }: Props) {
  const navigate = useNavigate();
  const allPeers = [
    { ...company, symbol: company.symbol, name: company.name },
    ...peers.filter((p) => p.symbol !== currentSymbol),
  ];

  const fmt = (v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L Cr` : `₹${(v / 1000).toFixed(0)}K Cr`;

  // Find best values for highlighting
  const bestRoce = Math.max(...allPeers.map((p) => p.roce));
  const bestNpm = Math.max(...allPeers.map((p) => p.npm));
  const bestDe = Math.min(...allPeers.map((p) => Number(p.de)));

  return (
    <div className="glass-card p-5">
      <h2 className="section-title mb-4">Peer Comparison</h2>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th className="data-header">Company</th>
              <th className="data-header">CMP</th>
              <th className="data-header">P/E</th>
              <th className="data-header">Market Cap</th>
              <th className="data-header">ROCE %</th>
              <th className="data-header">NPM %</th>
              <th className="data-header">D/E</th>
              <th className="data-header w-8"></th>
            </tr>
          </thead>
          <tbody>
            {allPeers.map((p, idx) => {
              const isCurrent = p.symbol === currentSymbol;
              return (
                <motion.tr
                  key={p.symbol}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => !isCurrent && navigate(`/company/${p.symbol}`)}
                  className={`border-b border-border/20 last:border-0 transition-all duration-200 ${
                    isCurrent
                      ? "bg-primary/5 border-l-2 border-l-primary"
                      : "hover:bg-accent/30 cursor-pointer group"
                  }`}
                >
                  <td className="data-cell">
                    <div>
                      <span className={`font-semibold ${isCurrent ? "text-primary" : "text-foreground"}`}>{p.symbol}</span>
                      {isCurrent && <span className="ml-1.5 text-[9px] uppercase tracking-wider text-primary font-bold">You</span>}
                    </div>
                  </td>
                  <td className="data-cell text-foreground">₹{p.price.toLocaleString()}</td>
                  <td className="data-cell text-foreground">{p.pe}</td>
                  <td className="data-cell text-foreground">{fmt(p.market_cap)}</td>
                  <td className={`data-cell font-semibold ${p.roce === bestRoce ? "text-positive" : p.roce > 15 ? "text-positive" : "text-foreground"}`}>
                    {p.roce}%
                    {p.roce === bestRoce && <span className="ml-1 text-[9px] text-positive">★</span>}
                  </td>
                  <td className={`data-cell font-semibold ${p.npm === bestNpm ? "text-positive" : p.npm > 12 ? "text-positive" : "text-foreground"}`}>
                    {p.npm}%
                    {p.npm === bestNpm && <span className="ml-1 text-[9px] text-positive">★</span>}
                  </td>
                  <td className={`data-cell font-semibold ${Number(p.de) === bestDe ? "text-positive" : Number(p.de) < 0.5 ? "text-positive" : Number(p.de) > 1 ? "text-negative" : "text-foreground"}`}>
                    {p.de}
                    {Number(p.de) === bestDe && <span className="ml-1 text-[9px] text-positive">★</span>}
                  </td>
                  <td className="data-cell">
                    {!isCurrent && (
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
