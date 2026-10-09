import { useDensity } from "@/hooks/use-density";

export function DensityPicker() {
  const { density, setDensity } = useDensity();

  const options = [
    { mode: "compact" as const, label: "Compact" },
    { mode: "comfortable" as const, label: "Comfortable" },
    { mode: "spacious" as const, label: "Spacious" },
  ];

  return (
    <div className="space-y-2">
      <p className="type-label">Table density</p>
      <div role="group" aria-label="Table density" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {options.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            onClick={() => setDensity(mode)}
            title={label}
            aria-label={label}
            aria-pressed={density === mode}
            className={`flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-all duration-150 ${
              density === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
