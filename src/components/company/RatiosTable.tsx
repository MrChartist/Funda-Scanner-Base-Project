interface RatioRow {
  year: number; roce: number; roe: number; ebitda_margin: number; npm: number;
  debt_equity: number; interest_coverage: number; sales_growth: number; profit_growth: number;
}

function colorClass(val: number, goodThreshold: number, badThreshold: number, invert = false) {
  if (invert) { [goodThreshold, badThreshold] = [badThreshold, goodThreshold]; }
  if (val >= goodThreshold) return "text-positive";
  if (val <= badThreshold) return "text-negative";
  return "text-foreground";
}

export function RatiosTable({ rows }: { rows: RatioRow[] }) {
  const cols = [
    { key: "year", label: "Year", good: 0, bad: 0 },
    { key: "roce", label: "ROCE %", good: 15, bad: 10 },
    { key: "roe", label: "ROE %", good: 15, bad: 10 },
    { key: "ebitda_margin", label: "EBITDA %", good: 20, bad: 10 },
    { key: "npm", label: "NPM %", good: 12, bad: 5 },
    { key: "debt_equity", label: "D/E", good: 0.5, bad: 1, invert: true },
    { key: "interest_coverage", label: "Int. Cover", good: 5, bad: 2 },
    { key: "sales_growth", label: "Sales Gr %", good: 10, bad: 0 },
    { key: "profit_growth", label: "Profit Gr %", good: 10, bad: 0 },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">Ratio Trends (10 Year)</h2>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {cols.map((c) => (
                <th key={c.key} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-accent/30">
                {cols.map((c) => {
                  const val = (r as any)[c.key];
                  return (
                    <td key={c.key} className={`px-3 py-2 font-mono ${c.key === "year" ? "font-medium text-foreground" : colorClass(val, c.good, c.bad, (c as any).invert)}`}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
