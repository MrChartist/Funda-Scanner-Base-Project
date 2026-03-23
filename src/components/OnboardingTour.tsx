import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Sparkles, Search, GitCompare, Star, BarChart3, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_STEPS = [
  {
    title: "Welcome to Funda Scanner",
    description: "Institutional-grade financial data for 2,229 NSE companies. Let's take a quick tour of the key features.",
    icon: Sparkles,
  },
  {
    title: "Quick Search (⌘K)",
    description: "Press ⌘K or / to instantly search any company. Navigate with arrow keys and Enter.",
    icon: Search,
  },
  {
    title: "Company Deep Dive",
    description: "Click any stock to see full fundamentals: ratios, charts, shareholding, quarterly results, and more.",
    icon: BarChart3,
  },
  {
    title: "Stock Screener",
    description: "Build custom filters to find stocks matching your criteria. Save presets for quick access.",
    icon: Star,
  },
  {
    title: "Compare Stocks",
    description: "Compare up to 4 stocks side-by-side with radar charts, price overlays, and metric tables.",
    icon: GitCompare,
  },
  {
    title: "DCF Calculator",
    description: "Estimate intrinsic value with sensitivity analysis. Adjust growth, WACC, and projection years.",
    icon: Calculator,
  },
];

export function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem("funda-tour-seen");
    if (!seen) {
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setIsOpen(false);
    localStorage.setItem("funda-tour-seen", "true");
  };

  const next = () => {
    if (step < TOUR_STEPS.length - 1) setStep(step + 1);
    else dismiss();
  };

  if (!isOpen) return null;

  const current = TOUR_STEPS[step];
  const Icon = current.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm"
        onClick={dismiss}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card-elevated p-6 max-w-md w-full mx-4 space-y-4"
        >
          <div className="flex items-start justify-between">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <h3 className="text-lg font-display font-bold text-foreground">{current.title}</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{current.description}</p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={dismiss} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Skip tour
            </button>
            <Button size="sm" onClick={next} className="gap-1.5">
              {step < TOUR_STEPS.length - 1 ? (
                <>Next <ArrowRight className="h-3.5 w-3.5" /></>
              ) : (
                "Get Started"
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
