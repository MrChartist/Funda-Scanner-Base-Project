import { Link, useLocation } from "react-router-dom";
import { Sun, Moon, BarChart3, TrendingUp, LayoutDashboard, GitCompare, Eye } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { SearchBar } from "./SearchBar";
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
    <header className="sticky top-0 z-40 border-b border-border/50 bg-card/60 backdrop-blur-2xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <TrendingUp className="h-4.5 w-4.5 text-primary" />
              <div className="absolute inset-0 rounded-lg glow-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Funda<span className="gradient-text">Scanner</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
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
          <div className="hidden sm:block">
            <SearchBar variant="header" />
          </div>
          <button onClick={toggleTheme}
            className="relative rounded-lg p-2.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200 group"
            aria-label="Toggle theme">
            <motion.div key={theme} initial={{ rotate: -30, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.2 }}>
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </motion.div>
          </button>
        </div>
      </div>
    </header>
  );
}
