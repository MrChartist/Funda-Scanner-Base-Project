import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, BookOpen, Calculator, ChevronRight, Keyboard, Search, Sparkles, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const SEEN_KEY = "funda-tour-seen";

interface TourStep {
  title: string;
  description: string;
  icon: LucideIcon;
  points?: string[];
  action?: { label: string; to: string };
}

/** Every step describes a feature that exists in this app. */
export const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Funda Scanner",
    description:
      "An open-source tool for studying company fundamentals. It opens with 150 fictional companies, so you can learn the tools before using real figures.",
    icon: Sparkles,
    points: ["Sample data is clearly labelled as fictional", "Import your own files to study real companies", "Every figure shows its period, unit and formula"],
  },
  {
    title: "Search anywhere",
    description: "Press Ctrl+K (⌘K on a Mac) to search companies, metrics and guided screens, or press / to jump to the search box.",
    icon: Search,
  },
  {
    title: "Screener and guided screens",
    description:
      "Write a rule such as roce > 15 AND debt_equity < 0.5, or start from a guided screen that explains each rule. The results show why each company passed or missed.",
    icon: BarChart3,
    action: { label: "Open the Screener", to: "/screener" },
  },
  {
    title: "Learn the metrics",
    description:
      "The Learn page explains every metric in plain language, with worked examples, common pitfalls and a note on what a screen cannot tell you.",
    icon: BookOpen,
    action: { label: "Open Learn", to: "/learn" },
  },
  {
    title: "Watchlist, Portfolio and DCF",
    description:
      "Follow companies, record holdings and try a two-stage discounted cash flow model. Everything you enter stays in this browser.",
    icon: Calculator,
  },
  {
    title: "Keyboard shortcuts",
    description: "Press ? at any time for the list. For example, g then s opens the Screener and g then l opens Learn.",
    icon: Keyboard,
  },
];

function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return true; // no storage: do not interrupt on every visit
  }
}

function markTourSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "true");
  } catch {
    /* storage unavailable; the tour may show again */
  }
}

export function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (hasSeenTour()) return;
    const timer = setTimeout(() => setIsOpen(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setIsOpen(false);
    markTourSeen();
  };

  const current = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;
  const Icon = current.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => (o ? setIsOpen(true) : dismiss())}>
      <DialogContent className="max-w-md space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            Step {step + 1} of {TOUR_STEPS.length}
          </span>
        </div>

        <div>
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground">{current.title}</DialogTitle>
          <DialogDescription className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{current.description}</DialogDescription>
        </div>

        {current.points && (
          <ul className="space-y-1.5">
            {current.points.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-foreground">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        )}

        {current.action && (
          <button
            type="button"
            onClick={() => {
              dismiss();
              navigate(current.action!.to);
            }}
            className="flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
          >
            {current.action.label}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}

        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={dismiss} className="min-h-11 text-sm text-muted-foreground hover:text-foreground">
            Skip tour
          </button>
          <Button type="button" onClick={() => (last ? dismiss() : setStep(step + 1))} className="min-h-11 gap-1.5 rounded-full px-5">
            {last ? "Get started" : (
              <>
                Next <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
