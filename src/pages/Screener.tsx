// src/pages/Screener.tsx — the Screener (WS5, spec §E.7): template gallery, simple rules and query
// mode, plain-English preview, live results with near misses and a funnel, and an explanation for
// every match. State lives in useScreen(); this file only composes the pieces.
import { useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import { PageHeader, PageShell } from "@/components/layout";
import { Upload } from "lucide-react";
import type { ScreenTemplate } from "@/lib/contracts";
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
import { ColumnChooser } from "@/components/screener/ColumnChooser";
import { CompareTray } from "@/components/screener/CompareTray";
import { ExportButton } from "@/components/screener/ExportButton";
import { FunnelPanel } from "@/components/screener/FunnelPanel";
import { NearMissPanel } from "@/components/screener/NearMissPanel";
import { PlainEnglishPreview } from "@/components/screener/PlainEnglishPreview";
import { QueryEditor } from "@/components/screener/QueryEditor";
import { ResultCards } from "@/components/screener/ResultCards";
import { ResultsSummary } from "@/components/screener/ResultsSummary";
import { ResultsTable } from "@/components/screener/ResultsTable";
import { RuleChips } from "@/components/screener/RuleChips";
import { SavedScreensMenu } from "@/components/screener/SavedScreensMenu";
import { ShareButton } from "@/components/screener/ShareButton";
import { TemplateGallery } from "@/components/screener/TemplateGallery";
import { UniverseSelect } from "@/components/screener/UniverseSelect";
import { WhyDrawer } from "@/components/screener/WhyDrawer";
import { MAX_COMPARE, universePositions } from "@/components/screener/helpers";

function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="text-sm text-muted-foreground">Loading data…</p>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function Screener() {
  const s = useScreen();
  const isMobile = useIsMobile();
  const [importOpen, setImportOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(() => s.draft.trim() === "");
  const [mode, setMode] = useState<"simple" | "query">("simple");
  const [pendingTemplate, setPendingTemplate] = useState<ScreenTemplate | null>(null);
  const [whyIndex, setWhyIndex] = useState<number | null>(null);
  const [compared, setCompared] = useState<string[]>([]);

  const { store, run } = s;
  const positions = useMemo(() => (run ? universePositions(run) : new Map<number, number>()), [run]);

  const apply = (t: ScreenTemplate, how: "replace" | "add") => {
    const undo = s.applyTemplate(t, how);
    setGalleryOpen(false);
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

  return (
    <MotionConfig reducedMotion="user">
      <PageShell className={compared.length > 0 ? "pb-32" : "pb-8"}>
        <PageHeader
          title="Screener"
          description="Find companies whose numbers meet rules you choose. Start from a template, or write your own rules."
          actions={<>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1 h-4 w-4" aria-hidden="true" />
              Import data
            </Button>
            {store && (
              <SavedScreensMenu
                draft={{ query: s.draft, columns: s.columns ?? [], sort: s.sort, universe: s.universe, templateId: s.templateId }}
                onLoad={s.loadScreen}
              />
            )}
            {store && <ColumnChooser store={store} columns={s.columns} onChange={s.setColumns} />}
            {store && <ShareButton getUrl={s.shareUrl} />}
            <ExportButton run={run} store={store} />
          </>}
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
            <TemplateGallery open={galleryOpen} onOpenChange={setGalleryOpen} activeId={s.templateId} onUse={useTemplate} />

            <section aria-labelledby="rules-heading" className="space-y-3">
              <h2 id="rules-heading" className="text-lg font-semibold">Your rules</h2>
              <Tabs value={mode} onValueChange={(v) => setMode(v as "simple" | "query")}>
                <TabsList className="h-auto">
                  <TabsTrigger value="simple" className="min-h-11 px-4">Simple rules</TabsTrigger>
                  <TabsTrigger value="query" className="min-h-11 px-4">Query</TabsTrigger>
                </TabsList>
                <TabsContent value="simple" className="mt-3">
                  <RuleChips store={store} draft={s.draft} compiled={s.compiled} onQueryChange={(t) => s.setQuery(t)} onEditAsText={() => setMode("query")} />
                </TabsContent>
                <TabsContent value="query" className="mt-3">
                  <QueryEditor store={store} value={s.draft} issues={s.compiled?.issues ?? []} onChange={(t) => s.setQuery(t)} onRunNow={s.runNow} />
                </TabsContent>
              </Tabs>
              <div className="grid gap-3 md:grid-cols-2">
                <UniverseSelect store={store} value={s.universe} onChange={s.setUniverse} />
                <PlainEnglishPreview compiled={s.compiled} draft={s.draft} />
              </div>
            </section>

            <section aria-labelledby="results-heading" className="space-y-3" aria-busy={s.pending || undefined}>
              <h2 id="results-heading" className="text-lg font-semibold">Results</h2>
              {run ? (
                <>
                  <ResultsSummary run={run} stale={s.stale} />
                  <div className={s.stale ? "opacity-60" : undefined}>
                    <Tabs defaultValue="matches">
                      <TabsList className="h-auto flex-wrap">
                        <TabsTrigger value="matches" className="min-h-11 px-4">Matches ({run.matchCount})</TabsTrigger>
                        <TabsTrigger value="near" className="min-h-11 px-4">Near misses ({run.nearMisses.length})</TabsTrigger>
                        <TabsTrigger value="funnel" className="min-h-11 px-4">Funnel</TabsTrigger>
                      </TabsList>
                      <TabsContent value="matches" className="mt-3">
                        {run.matched.length === 0 ? (
                          <EmptyState
                            title="No companies match these rules"
                            description="Try relaxing a rule. The Near misses tab lists companies that fail only one rule, and the Funnel tab shows which rule removes the most companies."
                          />
                        ) : isMobile && tableProps ? (
                          <ResultCards {...tableProps} />
                        ) : tableProps ? (
                          <ResultsTable {...tableProps} />
                        ) : null}
                      </TabsContent>
                      <TabsContent value="near" className="mt-3">
                        {store && <NearMissPanel run={run} store={store} onWhy={setWhyIndex} />}
                      </TabsContent>
                      <TabsContent value="funnel" className="mt-3">
                        <FunnelPanel run={run} />
                      </TabsContent>
                    </Tabs>
                  </div>
                </>
              ) : (
                <EmptyState title="Results will appear here" description="Fix the issues listed under your query to see results." />
              )}
              <p className="text-xs text-muted-foreground">Rule-based observations on the data you loaded. Not a recommendation.</p>
            </section>

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
