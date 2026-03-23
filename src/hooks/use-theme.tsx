import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

// CSS variable defaults to restore on theme switch
const LIGHT_DEFAULTS: Record<string, string> = {
  "--background": "220 20% 97%",
  "--foreground": "220 25% 10%",
  "--card": "0 0% 100%",
  "--card-foreground": "220 25% 10%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "220 25% 10%",
  "--primary": "220 70% 50%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "220 15% 92%",
  "--secondary-foreground": "220 25% 10%",
  "--muted": "220 15% 95%",
  "--muted-foreground": "220 10% 46%",
  "--accent": "220 15% 92%",
  "--accent-foreground": "220 25% 10%",
  "--border": "220 13% 91%",
  "--input": "220 13% 91%",
  "--ring": "220 70% 50%",
};

const DARK_DEFAULTS: Record<string, string> = {
  "--background": "225 40% 5%",
  "--foreground": "210 40% 93%",
  "--card": "225 35% 8%",
  "--card-foreground": "210 40% 93%",
  "--popover": "225 35% 8%",
  "--popover-foreground": "210 40% 93%",
  "--primary": "199 89% 48%",
  "--primary-foreground": "225 40% 5%",
  "--secondary": "225 25% 12%",
  "--secondary-foreground": "210 40% 93%",
  "--muted": "225 25% 12%",
  "--muted-foreground": "215 20% 52%",
  "--accent": "225 25% 14%",
  "--accent-foreground": "210 40% 93%",
  "--border": "225 20% 14%",
  "--input": "225 20% 14%",
  "--ring": "199 89% 48%",
};

export { LIGHT_DEFAULTS, DARK_DEFAULTS };

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("funda-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("funda-theme", theme);

    // Clear all inline style overrides so CSS class-based variables take effect cleanly
    const defaults = theme === "dark" ? DARK_DEFAULTS : LIGHT_DEFAULTS;
    Object.entries(defaults).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });

    // Dispatch custom event so AccentColorPicker can re-apply its overrides
    window.dispatchEvent(new CustomEvent("theme-changed", { detail: { theme } }));
  }, [theme]);

  const toggleTheme = () => setThemeState((t) => (t === "dark" ? "light" : "dark"));
  const setTheme = (t: Theme) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
