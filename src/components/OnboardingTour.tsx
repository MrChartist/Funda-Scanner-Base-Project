import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Sparkles, Search, GitCompare, Star, BarChart3, Calculator, Keyboard, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const TOUR_STEPS = [
  {
    title: "Welcome to FundaScanner",
    description: "Your institutional-grade financial data platform for 2,229 NSE companies. Here's what you can do:",
    icon: Sparkles,
    features: ["10-year financial data", "Live market tracking", "Advanced stock screening"],
  },
  {
    title: "Search Any Company",
    description: "Press ⌘K or / to instantly search. Navigate results with arrow keys.",
    icon: Search,
    action: "Try it: Press / now",
  },
  {
    title: "Deep Company Analysis",
    description: "Each company page has 15+ sections: ratios, charts, shareholding, insider activity, and peer comparisons.",
    icon: BarChart3,
    action: "Click any stock to explore",
  },
  {
    title: "Advanced Stock Screener",
    description: "Build custom filters like \"ROCE > 20% AND D/E < 0.5\" or use presets like High ROCE Low Debt.",
    icon: Star,
    action: "Navigate to Screener →",
    navTo: "/screener",
  },
  {
    title: "Compare & DCF",
    description: "Compare up to 4 stocks side-by-side, or estimate intrinsic value with the DCF calculator.",
    icon: GitCompare,
  },
  {
    title: "Keyboard Power User",
    description: "Use j/k to scroll, g+d for Dashboard, g+s for Screener. Press ? anytime for all shortcuts.",
    icon: Keyboard,
    action: "Press ? for full list",
  },
];

export function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const seen = localStorage.getItem("funda-tour-seen");
    if (!seen) {
      const timer = setTimeout(() => setIsOpen(true), 1000);
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

  const handleAction = () => {
    const current = TOUR_STEPS[step];
    if (current.navTo) {
      dismiss();
      navigate(current.navTo);
    }
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
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-background/50 backdrop-blur-sm p-4"
        onClick={dismiss}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card-elevated p-6 max-w-md w-full space-y-4"
        >
          {/* Step indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {step + 1} / {TOUR_STEPS.length}
              </span>
            </div>
            <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground tracking-tight">{current.title}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{current.description}</p>
          </div>

          {/* Feature list if present */}
          {current.features && (
            <div className="space-y-1.5">
              {current.features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          )}

          {/* Action button if present */}
          {current.action && (
            <button onClick={handleAction}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
              {current.action}
              <ChevronRight className="h-3 w-3" />
            </button>
          )}

          {/* Progress bar */}
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button onClick={dismiss} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Skip tour
            </button>
            <Button size="sm" onClick={next} className="gap-1.5 rounded-full px-4">
              {step < TOUR_STEPS.length - 1 ? (
                <>Next <ArrowRight className="h-3 w-3" /></>
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
