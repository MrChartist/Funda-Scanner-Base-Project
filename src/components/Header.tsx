import { Link, useLocation } from "react-router-dom";
import { Sun, Moon, BarChart3, TrendingUp, LayoutDashboard, GitCompare, Eye, Command, Calculator } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { SearchBar } from "./SearchBar";
import { AccentColorPicker } from "./AccentColorPicker";
import { motion } from "framer-motion";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/screener", label: "Screener", icon: BarChart3 },
    { to: "/compare", label: "Compare", icon: GitCompare },
    { to: "/watchlist", label: "Watchlist", icon: Eye },
  ];

  return (
    <>
      {/* Desktop header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-card/60 backdrop-blur-2xl hidden md:block">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="relative h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <TrendingUp className="h-4.5 w-4.5 text-primary" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Funda<span className="gradient-text">Scanner</span>
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link key={item.to} to={item.to}
                    className={`relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {isActive && (
                      <motion.div layoutId="nav-indicator"
                        className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <SearchBar variant="header" />
            {/* Cmd+K hint */}
            <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/40 transition-colors">
              <Command className="h-3 w-3" />
              <span className="font-mono">K</span>
            </button>
            <button onClick={toggleTheme}
              className="relative rounded-lg p-2.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200"
              aria-label="Toggle theme">
              <motion.div key={theme} initial={{ rotate: -30, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.2 }}>
                {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </motion.div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-card/80 backdrop-blur-2xl md:hidden safe-area-bottom">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}>
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          <button onClick={toggleTheme} className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-muted-foreground">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="text-[10px] font-medium">Theme</span>
          </button>
        </div>
      </nav>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-card/60 backdrop-blur-2xl md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <span className="text-base font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Funda<span className="gradient-text">Scanner</span>
            </span>
          </Link>
          <SearchBar variant="header" />
        </div>
      </header>
    </>
  );
}
