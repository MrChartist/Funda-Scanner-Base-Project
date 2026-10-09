// src/pages/Screener.tsx — the Screener (WS5, spec §E.7), results first: a header with grouped actions,
// a template bar with live match counts, the Rules card beside (wide screens) or above (narrow) the
// results, removable rule chips, and a table of data bars. State lives in useScreen(); this file only
// composes the pieces.
import { useEffect, useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import { ChevronDown, SlidersHorizontal, Upload } from "lucide-react";
import { PageHeader, PageShell } from "@/components/layout";
import type { ScreenTemplate } from "@/lib/contracts";
import { TEMPLATES } from "@/lib/screen";
import { useScreen } from "@/hooks/use-screen";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToastAction } from "@/components/ui/toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ImportDataDialog } from "@/components/ImportDataDialog";
import { cn } from "@/lib/utils";
import { ActiveRules } from "@/components/screener/ActiveRules";
import { ColumnChooser } from "@/components/screener/ColumnChooser";
import { CompareTray } from "@/components/screener/CompareTray";
import { ExportButton } from "@/components/screener/ExportButton";
import { FunnelPanel } from "@/components/screener/FunnelPanel";
import { NearMissPanel } from "@/components/screener/NearMissPanel";
import { NoMatches } from "@/components/screener/NoMatches";
import { ResultCards } from "@/components/screener/ResultCards";
import { ResultsSummary } from "@/components/screener/ResultsSummary";
import { ResultsTable } from "@/components/screener/ResultsTable";
import { RulesPanel, type RulesMode } from "@/components/screener/RulesPanel";
import { SavedScreensMenu } from "@/components/screener/SavedScreensMenu";
import { ShareButton } from "@/components/screener/ShareButton";
import { TemplateBar } from "@/components/screener/TemplateBar";
import { TemplateGallery } from "@/components/screener/TemplateGallery";
import { WhyDrawer } from "@/components/screener/WhyDrawer";
import { MAX_COMPARE, universePositions } from "@/components/screener/helpers";
import { ICON_BUTTON, ICON_GROUP, ICON_LABEL } from "@/components/screener/toolbar";
import { useTemplateCounts } from "@/components/screener/use-template-counts";

function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="text-sm text-muted-foreground">Loading data…</p>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9 w-44 shrink-0 rounded-full" />)}
      </div>
      <div className="space-y-2 rounded-xl border bg-card p-3">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    </div>
  );
}

const RESULT_TAB = "inline-flex min-h-11 items-center gap-2 px-3.5 text-sm lg:min-h-0 lg:py-1.5";
const COUNT_PILL = "num rounded-full bg-background/70 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary";

export default function Screener() {
  const s = useScreen();
  const isMobile = useIsMobile();
  const [importOpen, setImportOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [mode, setMode] = useState<RulesMode>("simple");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [resultTab, setResultTab] = useState("matches");
  const [pendingTemplate, setPendingTemplate] = useState<ScreenTemplate | null>(null);
  const [whyIndex, setWhyIndex] = useState<number | null>(null);
  const [compared, setCompared] = useState<string[]>([]);
  const [slashTick, setSlashTick] = useState(0);

  const { store, run } = s;
  const positions = useMemo(() => (run ? universePositions(run) : new Map<number, number>()), [run]);
  const counts = useTemplateCounts(store, s.universe, s.ctx);

  // "/" jumps to the query editor: switch to the Query tab, open the Rules card if it is folded, then focus.
  useEffect(() => {
    if (!store) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      e.preventDefault();
      setMode("query");
      setRulesOpen(true);
      setSlashTick((n) => n + 1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [store]);
  // The editor mounts a moment after the tab changes (inside the tabs component, not this page), so retry for a few frames.
  useEffect(() => {
    if (slashTick === 0) return undefined;
    let tries = 0;
    let frame = 0;
    const attempt = () => {
      const box = document.querySelector<HTMLElement>("[data-slash-focus]");
      // The Rules card is folded with the "hidden" class on narrow screens; wait until it is open.
      if (box && !box.closest(".hidden")) {
        box.focus();
        box.scrollIntoView?.({ block: "nearest" });
        return;
      }
      if (tries++ < 20) frame = window.requestAnimationFrame(attempt);
    };
    attempt();
    return () => window.cancelAnimationFrame(frame);
  }, [slashTick]);

  const apply = (t: ScreenTemplate, how: "replace" | "add") => {
    const undo = s.applyTemplate(t, how);
    setGalleryOpen(false);
    setResultTab("matches");
    toast({
      title: how === "add" ? `${t.title} added to your rules` : `${t.title} applied`,
      description: "The rules and columns were updated.",
      action: <ToastAction altText="Undo this change" onClick={undo}>Undo</ToastAction>,
    });
  };
  const useTemplate = (t: ScreenTemplate) => {
    if (s.draft.trim() === "") apply(t, "replace");
    else setPendingTemplate(t);
  };
  const toggleCompare = (symbol: string) =>
    setCompared((c) => (c.includes(symbol) ? c.filter((x) => x !== symbol) : c.length >= MAX_COMPARE ? c : [...c, symbol]));

  const pages = run ? Math.max(1, Math.ceil(run.matched.length / s.pageSize)) : 1;
  const pageNo = Math.min(s.page, pages);
  const rows = run ? Array.from(run.matched.subarray((pageNo - 1) * s.pageSize, pageNo * s.pageSize)) : [];
  const rowProps = run && store
    ? { run, store, rows, positions, compared, onToggleCompare: toggleCompare, onWhy: setWhyIndex }
    : null;
  const tableProps = rowProps
    ? { ...rowProps, sort: s.sort, onSort: s.setSort, page: pageNo, pageSize: s.pageSize, onPage: s.setPage, onPageSize: s.setPageSize }
    : null;

  const ruleCount = (s.compiled?.ok ? s.compiled.clauses : run?.compiled.clauses ?? []).length;
  const templateTitle = s.templateId ? TEMPLATES.find((t) => t.id === s.templateId)?.title ?? null : null;
  const queryOk = s.compiled?.ok === true;

  return (
    <MotionConfig reducedMotion="user">
      <PageShell className={cn("space-y-4 md:space-y-5", compared.length > 0 ? "pb-32" : "pb-8")}>
        <PageHeader
          title="Screener"
          description={isMobile ? undefined : "Every company is listed below. Narrow the list with a template or your own rules."}
          actions={
            <div className="flex items-center gap-2">
              {store && (
                <SavedScreensMenu
                  part="save"
                  draft={{ query: s.draft, columns: s.columns ?? [], sort: s.sort, universe: s.universe, templateId: s.templateId }}
                  onLoad={s.loadScreen}
                />
              )}
              {store && <ShareButton getUrl={s.shareUrl} />}
              <div className={ICON_GROUP} role="group" aria-label="More actions">
                <Button type="button" variant="ghost" className={ICON_BUTTON} title="Import data" onClick={() => setImportOpen(true)}>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span className={ICON_LABEL}>Import data</span>
                </Button>
                {store && (
                  <SavedScreensMenu
                    part="list"
                    draft={{ query: s.draft, columns: s.columns ?? [], sort: s.sort, universe: s.universe, templateId: s.templateId }}
                    onLoad={s.loadScreen}
                  />
                )}
                {store && <ColumnChooser store={store} columns={s.columns} onChange={s.setColumns} />}
                <ExportButton run={run} store={store} />
              </div>
            </div>
          }
        />

        {s.dataset.status === "loading" && <LoadingState />}

        {s.dataset.status === "error" && (
          <div role="alert" className="space-y-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4">
            <p className="font-medium">The data could not be loaded.</p>
            <p className="text-sm">{s.dataset.message}</p>
            <Button type="button" className="min-h-11" onClick={s.dataset.retry}>Retry</Button>
          </div>
        )}

        {store && (
          <>
            <TemplateBar counts={counts} activeId={s.templateId} onUse={useTemplate} galleryOpen={galleryOpen} onToggleGallery={() => setGalleryOpen((o) => !o)} />
            <TemplateGallery open={galleryOpen} activeId={s.templateId} counts={counts} onUse={useTemplate} detailsId={detailsId} onDetailsChange={setDetailsId} />

            <div className={cn("grid items-start gap-3 md:gap-4", rulesOpen && "xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]")}>
              <div className={cn("space-y-2", rulesOpen && "xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:pr-1")}>
                <button
                  type="button"
                  aria-expanded={rulesOpen}
                  aria-controls="rules-panel"
                  onClick={() => setRulesOpen((o) => !o)}
                  className={cn("flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border bg-card px-3 text-left text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:min-h-9", !rulesOpen && "xl:w-fit xl:gap-4")}
                >
                  <span className="inline-flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
                    {rulesOpen ? "Hide rules" : "Edit rules"}
                    <span className="num rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{ruleCount} {ruleCount === 1 ? "rule" : "rules"}</span>
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", rulesOpen && "rotate-180")} aria-hidden="true" />
                </button>
                <div id="rules-panel" className={rulesOpen ? "block" : "hidden"}>
                  <RulesPanel
                    store={store}
                    draft={s.draft}
                    compiled={s.compiled}
                    mode={mode}
                    onModeChange={setMode}
                    onQueryChange={(t) => s.setQuery(t)}
                    onRunNow={s.runNow}
                    universe={s.universe}
                    onUniverseChange={s.setUniverse}
                  />
                </div>
              </div>

              <section aria-labelledby="results-heading" className="min-w-0 space-y-3" aria-busy={s.pending || undefined}>
                <h2 id="results-heading" className="sr-only">Results</h2>
                <ActiveRules
                  compiled={queryOk ? s.compiled : run?.compiled ?? null}
                  total={run?.universe.length ?? store.size}
                  editable={queryOk}
                  templateTitle={templateTitle}
                  onRemove={s.removeRule}
                  onClear={() => s.setQuery("", { immediate: true })}
                  onTemplateDetails={() => setDetailsId(s.templateId)}
                  onAddRule={() => { setMode("simple"); setRulesOpen(true); }}
                />
                {run ? (
                  <Tabs value={resultTab} onValueChange={setResultTab}>
                    <ResultsSummary
                      run={run}
                      stale={s.stale}
                      trailing={
                        <TabsList className="h-auto" aria-label="Result views">
                          <TabsTrigger value="matches" className={cn("group", RESULT_TAB)}>Matches <span className={COUNT_PILL}>{run.matchCount}</span></TabsTrigger>
                          <TabsTrigger value="near" className={cn("group", RESULT_TAB)}>Near misses <span className={COUNT_PILL}>{run.nearMisses.length}</span></TabsTrigger>
                          <TabsTrigger value="funnel" className={cn("group", RESULT_TAB)}>Funnel</TabsTrigger>
                        </TabsList>
                      }
                    />
                    <div className={s.stale ? "opacity-60" : undefined}>
                      <TabsContent value="matches" className="mt-3">
                        {run.matched.length === 0 ? (
                          <NoMatches
                            run={run}
                            onRemoveRule={queryOk ? s.removeRule : undefined}
                            onShowNearMisses={() => setResultTab("near")}
                            onShowFunnel={() => setResultTab("funnel")}
                          />
                        ) : isMobile && tableProps ? (
                          <ResultCards {...tableProps} />
                        ) : tableProps ? (
                          <ResultsTable {...tableProps} />
                        ) : null}
                      </TabsContent>
                      <TabsContent value="near" className="mt-3">
                        <NearMissPanel run={run} store={store} onWhy={setWhyIndex} />
                      </TabsContent>
                      <TabsContent value="funnel" className="mt-3">
                        <FunnelPanel run={run} />
                      </TabsContent>
                    </div>
                  </Tabs>
                ) : (
                  <EmptyState title="Results will appear here" description="Fix the issues listed under your query to see results." />
                )}
                <p className="text-xs text-muted-foreground">Rule-based observations on the data you loaded. Not a recommendation.</p>
              </section>
            </div>

            {run && <WhyDrawer run={run} store={store} index={whyIndex} onClose={() => setWhyIndex(null)} />}
            <CompareTray store={store} symbols={compared} onRemove={toggleCompare} onClear={() => setCompared([])} />
          </>
        )}

        <ImportDataDialog open={importOpen} onOpenChange={setImportOpen} />

        <AlertDialog open={pendingTemplate !== null} onOpenChange={(o) => { if (!o) setPendingTemplate(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>You already have rules</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingTemplate ? `Do you want to replace your rules with “${pendingTemplate.title}”, or add its rules to yours?` : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="min-h-11">Cancel</AlertDialogCancel>
              <AlertDialogAction className="min-h-11" onClick={() => pendingTemplate && apply(pendingTemplate, "add")}>Add to my rules</AlertDialogAction>
              <AlertDialogAction className="min-h-11" onClick={() => pendingTemplate && apply(pendingTemplate, "replace")}>Replace my rules</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageShell>
    </MotionConfig>
  );
}
