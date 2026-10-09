import { useState, useEffect, useCallback } from "react";
import { Check, Moon } from "lucide-react";
import { DARK_DEFAULTS, LIGHT_DEFAULTS } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

interface AccentPreset {
  name: string;
  /** HSL triplets for light and dark mode. The first preset is the brand default and uses the CSS tokens. */
  light: string;
  dark: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { name: "Indigo", light: "243 75% 59%", dark: "243 100% 77%" },
  { name: "Emerald", light: "152 69% 32%", dark: "152 65% 55%" },
  { name: "Violet", light: "270 70% 55%", dark: "270 90% 74%" },
  { name: "Coral", light: "12 80% 48%", dark: "12 90% 68%" },
  { name: "Amber", light: "32 95% 40%", dark: "40 92% 60%" },
  { name: "Rose", light: "340 75% 50%", dark: "340 90% 70%" },
  { name: "Teal", light: "175 80% 30%", dark: "175 70% 52%" },
  { name: "Slate", light: "215 25% 40%", dark: "215 40% 70%" },
];

const DEFAULT_ACCENT = ACCENT_PRESETS[0].name;
const DARK_INK = "224 40% 10%";

/** WCAG relative luminance of an "H S% L%" triplet. */
function luminance(hsl: string): number {
  const [h, s, l] = hsl.split(/\s+/).map((v) => parseFloat(v));
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
}

/** White text when it reaches 4.5:1 on the accent, otherwise the dark ink. */
function foregroundFor(hsl: string): string {
  return 1.05 / (luminance(hsl) + 0.05) >= 4.5 ? "0 0% 100%" : DARK_INK;
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
}

export interface AccentState {
  activeAccent: string;
  setActiveAccent: (name: string) => void;
  oledDark: boolean;
  setOledDark: (on: boolean) => void;
}

/**
 * Applies the chosen accent (and the optional OLED background) to the document root.
 * Mount it once, in the Header, so the accent applies on every page even when the picker is closed.
 * `--ring` and the sidebar tokens are defined in CSS as `var(--primary)`, so they follow automatically.
 */
export function useAccentColor(): AccentState {
  const [activeAccent, setActiveAccent] = useState(() => {
    const stored = readStored("funda-accent");
    return ACCENT_PRESETS.some((p) => p.name === stored) ? (stored as string) : DEFAULT_ACCENT;
  });
  const [oledDark, setOledDark] = useState(() => readStored("funda-oled") === "true");

  const applyAccent = useCallback(() => {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");

    // ThemeProvider writes its own inline colour defaults on every theme switch; drop them so the
    // stylesheet tokens (index.css) are the single source of the palette.
    for (const key of [...Object.keys(LIGHT_DEFAULTS), ...Object.keys(DARK_DEFAULTS)]) root.style.removeProperty(key);

    const preset = ACCENT_PRESETS.find((p) => p.name === activeAccent);
    if (preset && preset.name !== DEFAULT_ACCENT) {
      const val = isDark ? preset.dark : preset.light;
      root.style.setProperty("--primary", val);
      root.style.setProperty("--primary-foreground", foregroundFor(val));
    }

    if (oledDark && isDark) {
      root.style.setProperty("--background", "0 0% 0%");
      root.style.setProperty("--card", "0 0% 5%");
      root.style.setProperty("--popover", "0 0% 5%");
    }
  }, [activeAccent, oledDark]);

  useEffect(() => {
    applyAccent();
    writeStored("funda-accent", activeAccent);
    writeStored("funda-oled", String(oledDark));
  }, [activeAccent, oledDark, applyAccent]);

  // ThemeProvider dispatches this after it switches the theme class.
  useEffect(() => {
    const handler = () => requestAnimationFrame(applyAccent);
    window.addEventListener("theme-changed", handler);
    return () => window.removeEventListener("theme-changed", handler);
  }, [applyAccent]);

  return { activeAccent, setActiveAccent, oledDark, setOledDark };
}

/** The accent swatches and the OLED switch. Rendered inside the header's Appearance popover. */
export function AccentColorPicker({ accent }: { accent: AccentState }) {
  const { activeAccent, setActiveAccent, oledDark, setOledDark } = accent;

  return (
    <div className="space-y-3">
      <p className="type-label">Accent colour</p>
      <div role="radiogroup" aria-label="Accent colour" className="grid grid-cols-4 gap-x-2 gap-y-2.5">
        {ACCENT_PRESETS.map((preset) => {
          const isActive = activeAccent === preset.name;
          return (
            <button
              key={preset.name}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={preset.name}
              onClick={() => setActiveAccent(preset.name)}
              className="group flex flex-col items-center gap-1 rounded-md py-0.5"
              title={preset.name}
            >
              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-popover transition-all group-hover:scale-105",
                  isActive ? "ring-2 ring-foreground" : "ring-1 ring-border",
                )}
                style={{ background: `hsl(${preset.light})` }}
              >
                {isActive && <Check className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
              </span>
              <span className="type-caption">{preset.name}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={oledDark}
        onClick={() => setOledDark(!oledDark)}
        className="flex w-full items-center justify-between rounded-md border border-border px-2.5 py-2 transition-colors hover:bg-accent"
      >
        <span className="flex items-center gap-2 text-xs text-foreground">
          <Moon className="h-3.5 w-3.5" aria-hidden="true" /> OLED Dark Mode
        </span>
        <span className={cn("flex h-4 w-7 items-center rounded-full px-0.5 transition-colors", oledDark ? "bg-primary" : "bg-border")}>
          <span className={cn("h-3 w-3 rounded-full bg-white shadow transition-transform", oledDark ? "translate-x-3" : "translate-x-0")} />
        </span>
      </button>
    </div>
  );
}
