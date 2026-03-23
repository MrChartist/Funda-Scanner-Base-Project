import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";

interface ShareholdingData {
  quarter: string; promoter_pct: number; fii_pct: number; dii_pct: number; public_pct: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-green))",
  "hsl(var(--chart-amber))",
  "hsl(var(--chart-cyan))",
];

export function ShareholdingPattern({ data }: { data: ShareholdingData[] }) {
  const latest = data[0];
  const pieData = [
    { name: "Promoters", value: latest.promoter_pct },
    { name: "FII", value: latest.fii_pct },
    { name: "DII", value: latest.dii_pct },
    { name: "Public", value: latest.public_pct },
  ];

  const trendData = [...data].reverse();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-4">Shareholding Pattern</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Donut */}
        <div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name} ${value}%`} labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(v: any) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i] }} />
                <span className="text-muted-foreground">{d.name}: <span className="font-mono font-semibold text-foreground">{d.value}%</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* Trend */}
        <div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(v: any) => `${v}%`} />
                <Area type="monotone" dataKey="promoter_pct" stackId="1" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.6} name="Promoters" />
                <Area type="monotone" dataKey="fii_pct" stackId="1" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.6} name="FII" />
                <Area type="monotone" dataKey="dii_pct" stackId="1" stroke={COLORS[2]} fill={COLORS[2]} fillOpacity={0.6} name="DII" />
                <Area type="monotone" dataKey="public_pct" stackId="1" stroke={COLORS[3]} fill={COLORS[3]} fillOpacity={0.6} name="Public" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
