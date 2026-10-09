// src/components/data/DatasetBanner.tsx — honest labelling of the loaded data on every page (WS1, §F.6).
// WS7 renders it below the Header. Copy:
//  • Synthetic: "Sample data: 150 fictional companies with generated figures. They describe no real
//    business. Fiscal-year labels are for illustration only. [Import your data]"
//  • Imported: "Your data: {name} · imported {real time} · as of {asOf or 'not provided'}. You are
//    responsible for its accuracy and licence."
//  • Snapshot-only, added line: "Statements were not provided, so history-based metrics, checks and
//    scores are unavailable."
//  • Memory only, added line: "Kept for this session only." with a JSON export.
import { lazy, Suspense, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, Download, FlaskConical, Info, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/hooks/use-dataset";
import type { FundamentalsDataset } from "@/lib/contracts";
import { clearImportedData, exportDatasetJson, exportFileName, persistenceOf } from "@/lib/data";
import { formatNumberIN } from "@/lib/format/indian";
import { localDateStamp } from "@/lib/time/clock";
import { cn } from "@/lib/utils";

// The import dialog (file readers, report, select) is fetched the first time it is opened, so it
// stays out of the first-load bundle; once opened it stays mounted so closing still animates.
const ImportDataDialog = lazy(() => import("@/components/ImportDataDialog").then((m) => ({ default: m.ImportDataDialog })));

export const SNAPSHOT_ONLY_TEXT = "Statements were not provided, so history-based metrics, checks and scores are unavailable.";
export const SESSION_ONLY_TEXT = "Kept for this session only.";

/** Real import time in Indian English, e.g. "7 Oct 2026, 2:05 pm"; the stored text when unreadable. */
function formatImportTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch {
    return iso;
  }
}

function isSnapshotOnly(ds: FundamentalsDataset): boolean {
  return ds.companies.length > 0 && ds.companies.every((c) => c.annual.length === 0 && c.quarterly.length === 0);
}

function downloadJson(ds: FundamentalsDataset): void {
  const blob = new Blob([exportDatasetJson(ds)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName(ds, localDateStamp());
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface DatasetBannerProps {
  className?: string;
}

export function DatasetBanner({ className }: DatasetBannerProps) {
  const state = useDataset();
  const [importOpen, setImportOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [importRequested, setImportRequested] = useState(false);

  if (state.status === "loading") return null;

  const shell = (tone: "sample" | "user" | "error", children: ReactNode) => (
    <aside
      aria-label="About the data"
      className={cn(
        "border-b py-1.5 text-xs sm:text-[13px]",
        tone === "sample" && "border-primary/15 bg-primary/[0.06]",
        tone === "user" && "border-border bg-muted/50",
        tone === "error" && "border-destructive/30 bg-destructive/10",
        className,
      )}
    >
      <div className="app-container flex flex-col gap-0.5">{children}</div>
      {importRequested && (
        <Suspense fallback={null}>
          <ImportDataDialog open={importOpen} onOpenChange={setImportOpen} />
        </Suspense>
      )}
    </aside>
  );

  const importButton = (
    <Button type="button" variant="link" size="sm" className="h-auto min-h-9 shrink-0 p-0 text-xs font-semibold sm:min-h-0 sm:text-[13px]" onClick={() => { setImportRequested(true); setImportOpen(true); }}>
      <Upload className="mr-1 h-3.5 w-3.5" aria-hidden="true" />Import your data
    </Button>
  );

  if (state.status === "error") {
    return shell("error", (
      <p className="flex flex-wrap items-center gap-x-2 text-foreground">
        <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
        <span>The data could not be loaded: {state.message}</span>
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={state.retry}>Try again</Button>
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void clearImportedData()}>Use sample data</Button>
      </p>
    ));
  }

  const { dataset, provider } = state;
  const meta = dataset.meta;
  const n = dataset.companies.length;
  const snapshotOnly = isSnapshotOnly(dataset);
  const sessionOnly = persistenceOf(provider) === "memory";

  const extraLines = (
    <>
      {snapshotOnly && (
        <p className="flex items-start gap-1 text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{SNAPSHOT_ONLY_TEXT}
        </p>
      )}
      {sessionOnly && (
        <p className="flex flex-wrap items-center gap-x-2 text-chart-amber">
          <span>{SESSION_ONLY_TEXT} This browser did not allow the data to be saved.</span>
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs sm:text-sm" onClick={() => downloadJson(dataset)}>
            <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" />Export as JSON
          </Button>
        </p>
      )}
    </>
  );

  if (meta.isSynthetic) {
    const full = `Sample data: ${formatNumberIN(n, 0)} fictional ${n === 1 ? "company" : "companies"} with generated figures. They describe no real business. Fiscal-year labels are for illustration only.`;
    return shell("sample", (
      <>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0 text-foreground" title={full}>
          <FlaskConical className="hidden h-3.5 w-3.5 shrink-0 text-primary sm:block" aria-hidden="true" />
          <p className="hidden sm:block">
            <strong>Sample data:</strong> {formatNumberIN(n, 0)} fictional {n === 1 ? "company" : "companies"} with generated figures.
            They describe no real business. Fiscal-year labels are for illustration only.
          </p>
          <p className="flex items-center gap-1.5 sm:hidden">
            <FlaskConical className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span><strong>Sample data</strong> · {formatNumberIN(n, 0)} fictional {n === 1 ? "company" : "companies"}</span>
          </p>
          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            aria-expanded={detailsOpen}
            className="flex min-h-9 items-center gap-0.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground sm:hidden"
          >
            Details<ChevronDown className={cn("h-3.5 w-3.5 transition-transform", detailsOpen && "rotate-180")} aria-hidden="true" />
          </button>
          <span className="sm:ml-auto">{importButton}</span>
        </div>
        {detailsOpen && <p className="pb-1 text-muted-foreground sm:hidden">{full}</p>}
        {extraLines}
      </>
    ));
  }

  const asOf = meta.asOf ?? "not provided";
  if (meta.source === "user_import") {
    const when = meta.importedAt ? formatImportTime(meta.importedAt) : "at an earlier visit (time not recorded)";
    return shell("user", (
      <>
        <p className="text-foreground">
          <strong>Your data:</strong> {meta.name} · imported {when} · as of {asOf}. You are responsible for its accuracy and licence.
        </p>
        {extraLines}
      </>
    ));
  }

  return shell("user", (
    <>
      <p className="text-foreground">
        <strong>Data from {provider.name}:</strong> {meta.name} · as of {asOf}. The provider of this data is responsible for its accuracy and licence.
      </p>
      {extraLines}
    </>
  ));
}
