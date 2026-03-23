import { useNavigate } from "react-router-dom";

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

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">Peer Comparison</h2>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Company</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">CMP</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">P/E</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Market Cap</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">ROCE %</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">NPM %</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">D/E</th>
            </tr>
          </thead>
          <tbody>
            {allPeers.map((p) => {
              const isCurrent = p.symbol === currentSymbol;
              return (
                <tr
                  key={p.symbol}
                  onClick={() => !isCurrent && navigate(`/company/${p.symbol}`)}
                  className={`border-b border-border last:border-0 transition-colors ${isCurrent ? "bg-primary/5" : "hover:bg-accent/50 cursor-pointer"}`}
                >
                  <td className="px-3 py-2">
                    <span className={`font-mono font-semibold ${isCurrent ? "text-primary" : "text-foreground"}`}>{p.symbol}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-foreground">₹{p.price.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-foreground">{p.pe}</td>
                  <td className="px-3 py-2 font-mono text-foreground">{fmt(p.market_cap)}</td>
                  <td className={`px-3 py-2 font-mono ${p.roce > 15 ? "text-positive" : "text-foreground"}`}>{p.roce}%</td>
                  <td className={`px-3 py-2 font-mono ${p.npm > 12 ? "text-positive" : "text-foreground"}`}>{p.npm}%</td>
                  <td className={`px-3 py-2 font-mono ${Number(p.de) < 0.5 ? "text-positive" : Number(p.de) > 1 ? "text-negative" : "text-foreground"}`}>{p.de}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
