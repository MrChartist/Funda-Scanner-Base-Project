import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, RefreshCw } from "lucide-react";
import type { MetricStore } from "@/lib/contracts";
import { GLOSSARY, GLOSSARY_BASIC_IDS } from "@/lib/learn";
import { Button } from "@/components/ui/button";

/** One short metric explanation at a time; "Show another" moves to the next. No clock or randomness. */
export function LearnOneMetric({ store }: { store: MetricStore }) {
  const ids = GLOSSARY_BASIC_IDS.filter((id) => GLOSSARY[id] && store.def(id));
  const [i, setI] = useState(0);
  if (ids.length === 0) return null;
  const id = ids[i % ids.length];
  const entry = GLOSSARY[id];
  const def = store.def(id);
  if (!entry || !def) return null;

  return (
    <section aria-labelledby="learn-one-title" className="glass-card space-y-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 id="learn-one-title" className="section-title">Learn one metric</h2>
        <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-1 text-xs sm:min-h-9" onClick={() => setI((n) => (n + 1) % ids.length)}>
          <RefreshCw className="h-3 w-3" aria-hidden="true" /> Show another
        </Button>
      </div>
      <h3 className="text-base font-semibold text-foreground">{def.label}</h3>
      <p className="text-sm leading-relaxed text-foreground">{entry.whatItTells}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{entry.howToRead}</p>
      <Link to={`/learn#${id}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline sm:min-h-0">
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Read more on the Learn page
      </Link>
    </section>
  );
}
