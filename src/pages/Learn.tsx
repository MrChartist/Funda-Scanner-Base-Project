import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import type { ConceptEntry, GlossaryEntry, MetricDef } from "@/lib/contracts";
import { CONCEPTS, GLOSSARY, conceptParagraphs } from "@/lib/learn";
import { allMetricDefs } from "@/lib/metrics";
import { GlossaryCard } from "@/components/learn/GlossaryCard";
import { PageShell } from "@/components/layout";

const SCREEN_LIMITS_ID = "what-a-screen-cannot-tell-you";

function baseDefs(): Map<string, MetricDef> {
  const m = new Map<string, MetricDef>();
  for (const d of allMetricDefs()) if (d.variant === null) m.set(d.id, d);
  return m;
}

function ConceptCard({ concept, labelOf, hideTitle = false }: { concept: ConceptEntry; labelOf: (id: string) => string | null; hideTitle?: boolean }) {
  const links = concept.related.map((id) => ({ id, label: labelOf(id) ?? CONCEPTS.find((c) => c.id === id)?.title ?? null })).filter((l) => l.label);
  return (
    <article id={concept.id} className="space-y-2 rounded-lg border border-border/60 bg-card p-4">
      {!hideTitle && <h3 className="text-base font-semibold text-foreground">{concept.title}</h3>}
      {conceptParagraphs(concept).map((p) => (
        <p key={p} className="text-sm leading-relaxed text-foreground">{p}</p>
      ))}
      {links.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Related:{" "}
          {links.map((l, i) => (
            <span key={l.id}>
              {i > 0 && ", "}
              <Link to={`/learn#${l.id}`} className="text-primary hover:underline">{l.label}</Link>
            </span>
          ))}
        </p>
      )}
    </article>
  );
}

export default function Learn() {
  const { hash } = useLocation();
  const defs = useMemo(baseDefs, []);
  const [filter, setFilter] = useState("");

  const entries = useMemo(() => Object.values(GLOSSARY) as GlossaryEntry[], []);
  const labelOf = (id: string): string | null => (GLOSSARY[id] ? defs.get(id)?.label ?? id : null);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return entries.filter((e) => {
      if (!q) return true;
      const d = defs.get(e.base);
      return e.base.includes(q) || (d?.label.toLowerCase().includes(q) ?? false) || (d?.short.toLowerCase().includes(q) ?? false);
    });
  }, [entries, defs, filter]);

  const byCategory = useMemo(() => {
    const groups = new Map<string, { entry: GlossaryEntry; def: MetricDef | null }[]>();
    for (const entry of visible) {
      const def = defs.get(entry.base) ?? null;
      const cat = def?.category ?? "Other";
      const list = groups.get(cat) ?? [];
      list.push({ entry, def });
      groups.set(cat, list);
    }
    for (const list of groups.values()) list.sort((a, b) => (a.def?.label ?? a.entry.base).localeCompare(b.def?.label ?? b.entry.base));
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible, defs]);

  // Open and scroll to the entry named in the URL (/learn#roce).
  const target = hash.replace(/^#/, "");
  useEffect(() => {
    if (!target) return;
    let id = target;
    try {
      id = decodeURIComponent(target);
    } catch {
      /* use the raw text */
    }
    const el = document.getElementById(id);
    if (!el) return;
    if (el instanceof HTMLDetailsElement) el.open = true;
    el.scrollIntoView?.({ block: "start" });
  }, [target, filter]);

  const concepts = CONCEPTS.filter((c) => c.id !== SCREEN_LIMITS_ID);
  const limits = CONCEPTS.find((c) => c.id === SCREEN_LIMITS_ID) ?? null;

  return (
      <PageShell prose className="space-y-8">
        <header className="space-y-2">
          <h1 className="type-page-title">Learn</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Plain-language notes on the ideas and metrics used in this app. Rules of thumb are for study. They are not standards, and
            nothing here is investment advice.
          </p>
          <nav aria-label="On this page" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a href="#screen-limits" className="flex min-h-11 items-center text-primary hover:underline sm:min-h-0">What a screen cannot tell you</a>
            <a href="#concepts" className="flex min-h-11 items-center text-primary hover:underline sm:min-h-0">Ideas</a>
            <a href="#glossary" className="flex min-h-11 items-center text-primary hover:underline sm:min-h-0">Metric glossary</a>
          </nav>
        </header>

        {limits && (
          <section id="screen-limits" aria-labelledby="screen-limits-title" className="space-y-2">
            <h2 id="screen-limits-title" className="section-title">What a screen cannot tell you</h2>
            <ConceptCard concept={limits} labelOf={labelOf} hideTitle />
          </section>
        )}

        <section id="concepts" aria-labelledby="concepts-title" className="space-y-3">
          <h2 id="concepts-title" className="section-title">Ideas used across the app</h2>
          <div className="space-y-3">
            {concepts.map((c) => <ConceptCard key={c.id} concept={c} labelOf={labelOf} />)}
          </div>
        </section>

        <section id="glossary" aria-labelledby="glossary-title" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="glossary-title" className="section-title">Metric glossary</h2>
              <p className="mt-1 text-xs text-muted-foreground">{entries.length} metrics. Open one to read more.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label="Filter the glossary"
                placeholder="Filter metrics"
                className="min-h-11 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground sm:min-h-9"
              />
            </div>
          </div>
          {byCategory.length === 0 && <p className="text-sm text-muted-foreground">No metric matches that text.</p>}
          {byCategory.map(([category, items]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{category}</h3>
              <div className="space-y-2">
                {items.map(({ entry, def }) => (
                  <GlossaryCard key={entry.base} entry={entry} def={def} labelOf={labelOf} defaultOpen={entry.base === target} />
                ))}
              </div>
            </div>
          ))}
        </section>
      </PageShell>
  );
}
