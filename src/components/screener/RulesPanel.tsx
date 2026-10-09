import type { CompiledQuery, MetricStore, UniverseSpec } from "@/lib/contracts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlainEnglishPreview } from "./PlainEnglishPreview";
import { QueryEditor } from "./QueryEditor";
import { RuleChips } from "./RuleChips";
import { UniverseSelect } from "./UniverseSelect";

export type RulesMode = "simple" | "query";

export interface RulesPanelProps {
  store: MetricStore;
  draft: string;
  compiled: CompiledQuery | null;
  mode: RulesMode;
  onModeChange: (m: RulesMode) => void;
  onQueryChange: (text: string) => void;
  onRunNow: () => void;
  universe: UniverseSpec;
  onUniverseChange: (u: UniverseSpec) => void;
}

const TRIGGER = "min-h-11 px-3 text-sm lg:min-h-0 lg:py-1";

/** The Rules card: Simple and Query tabs, the universe, and the rules in plain English. */
export function RulesPanel({ store, draft, compiled, mode, onModeChange, onQueryChange, onRunNow, universe, onUniverseChange }: RulesPanelProps) {
  return (
    <section aria-labelledby="rules-heading" className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Tabs value={mode} onValueChange={(v) => onModeChange(v as RulesMode)}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
          {/* Visible "Rules"; the longer accessible name keeps the page landmark stable for other suites and screen readers. */}
          <h2 id="rules-heading" aria-label="Your rules" className="type-section-title">Rules</h2>
          <TabsList className="h-auto">
            <TabsTrigger value="simple" className={TRIGGER}>Simple rules</TabsTrigger>
            <TabsTrigger value="query" className={TRIGGER}>Query</TabsTrigger>
          </TabsList>
        </div>
        <div className="space-y-3 p-3">
          <TabsContent value="simple" className="mt-0">
            <RuleChips store={store} draft={draft} compiled={compiled} onQueryChange={onQueryChange} onEditAsText={() => onModeChange("query")} />
          </TabsContent>
          <TabsContent value="query" className="mt-0">
            <QueryEditor store={store} value={draft} issues={compiled?.issues ?? []} onChange={onQueryChange} onRunNow={onRunNow} />
          </TabsContent>
          <UniverseSelect store={store} value={universe} onChange={onUniverseChange} />
          <PlainEnglishPreview compiled={compiled} draft={draft} />
        </div>
      </Tabs>
    </section>
  );
}
