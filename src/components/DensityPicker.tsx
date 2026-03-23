import { useDensity } from "@/hooks/use-density";
import { AlignJustify, AlignCenter, AlignLeft } from "lucide-react";

export function DensityPicker() {
  const { density, setDensity } = useDensity();

  const options = [
    { mode: "compact" as const, icon: AlignJustify, label: "Compact" },
    { mode: "comfortable" as const, icon: AlignCenter, label: "Comfortable" },
    { mode: "spacious" as const, icon: AlignLeft, label: "Spacious" },
  ];

  return (
    <div className="flex items-center rounded-full border border-border/60 bg-secondary/50 p-0.5">
      {options.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => setDensity(mode)}
          title={label}
          className={`rounded-full p-1.5 transition-all duration-200 ${
            density === mode
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
