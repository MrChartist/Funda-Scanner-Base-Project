import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Palette, Check, Moon } from "lucide-react";
import { DARK_DEFAULTS } from "@/hooks/use-theme";

const ACCENT_PRESETS = [
  { name: "Ocean Blue", hue: 220, light: "220 70% 50%", dark: "199 89% 48%" },
  { name: "Emerald", hue: 152, light: "152 69% 40%", dark: "160 84% 39%" },
  { name: "Violet", hue: 270, light: "270 70% 55%", dark: "270 80% 60%" },
  { name: "Coral", hue: 12, light: "12 80% 55%", dark: "12 85% 58%" },
  { name: "Amber", hue: 38, light: "38 92% 50%", dark: "38 92% 55%" },
  { name: "Rose", hue: 340, light: "340 75% 55%", dark: "340 80% 60%" },
  { name: "Teal", hue: 175, light: "175 70% 40%", dark: "175 75% 45%" },
  { name: "Slate", hue: 215, light: "215 25% 45%", dark: "215 30% 55%" },
];

export function AccentColorPicker() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAccent, setActiveAccent] = useState(() => localStorage.getItem("funda-accent") || "Ocean Blue");
  const [oledDark, setOledDark] = useState(() => localStorage.getItem("funda-oled") === "true");

  const applyAccent = useCallback(() => {
    const preset = ACCENT_PRESETS.find((p) => p.name === activeAccent);
    if (!preset) return;
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    const val = isDark ? preset.dark : preset.light;
    root.style.setProperty("--primary", val);
    root.style.setProperty("--ring", val);

    // OLED dark mode
    if (oledDark && isDark) {
      root.style.setProperty("--background", "0 0% 0%");
      root.style.setProperty("--card", "0 0% 3%");
      root.style.setProperty("--popover", "0 0% 3%");
    } else if (isDark) {
      root.style.setProperty("--background", DARK_DEFAULTS["--background"]);
      root.style.setProperty("--card", DARK_DEFAULTS["--card"]);
      root.style.setProperty("--popover", DARK_DEFAULTS["--popover"]);
    }
    // Light mode: don't touch --background/--card — ThemeProvider already reset them
  }, [activeAccent, oledDark]);

  // Apply on accent or OLED change
  useEffect(() => {
    applyAccent();
    localStorage.setItem("funda-accent", activeAccent);
    localStorage.setItem("funda-oled", String(oledDark));
  }, [activeAccent, oledDark, applyAccent]);

  // Re-apply when theme toggles
  useEffect(() => {
    const handler = () => {
      // Small delay to let ThemeProvider set defaults first
      requestAnimationFrame(applyAccent);
    };
    window.addEventListener("theme-changed", handler);
    return () => window.removeEventListener("theme-changed", handler);
  }, [applyAccent]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-accent transition-colors"
        title="Accent Color"
      >
        <Palette className="h-4 w-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute right-0 top-full mt-2 z-50 w-56 glass-card-elevated p-3 space-y-3"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accent Color</p>
            <div className="grid grid-cols-4 gap-2">
              {ACCENT_PRESETS.map((preset) => {
                const isActive = activeAccent === preset.name;
                return (
                  <button
                    key={preset.name}
                    onClick={() => setActiveAccent(preset.name)}
                    className="relative group flex flex-col items-center gap-1"
                    title={preset.name}
                  >
                    <div
                      className={`relative h-8 w-8 rounded-full border-2 transition-all ${isActive ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                      style={{ background: `hsl(${preset.light})` }}
                    >
                      {isActive && (
                        <Check className="h-4 w-4 text-white absolute inset-0 m-auto" />
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground">{preset.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border pt-2">
              <button
                onClick={() => setOledDark(!oledDark)}
                className="flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors"
              >
                <span className="flex items-center gap-2 text-xs text-foreground">
                  <Moon className="h-3.5 w-3.5" /> OLED Dark Mode
                </span>
                <div className={`h-4 w-7 rounded-full transition-colors ${oledDark ? "bg-primary" : "bg-border"}`}>
                  <div className={`h-3 w-3 rounded-full bg-white mt-0.5 transition-transform ${oledDark ? "translate-x-3.5" : "translate-x-0.5"}`} />
                </div>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
