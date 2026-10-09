/** Colours come from the theme tokens, so charts follow light and dark without branching. Series are also told apart by label or dash, never colour alone. */
export const CHART = {
  blue: "hsl(var(--chart-blue))",
  cyan: "hsl(var(--chart-cyan))",
  amber: "hsl(var(--chart-amber))",
  green: "hsl(var(--chart-green))",
  grid: "hsl(var(--border))",
  muted: "hsl(var(--muted-foreground))",
  surface: "hsl(var(--card))",
} as const;

export const AXIS_TICK = { fontSize: 12, fill: "hsl(var(--muted-foreground))" } as const;

/** Whether charts can render here. Where ResizeObserver is missing (old browsers, jsdom) the text and table carry the information. */
export const canChart = (): boolean => typeof ResizeObserver !== "undefined";

