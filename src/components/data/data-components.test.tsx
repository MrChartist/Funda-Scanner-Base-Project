import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import type { DataProvider, FundamentalsDataset } from "@/lib/contracts";
import {
  activateImportedDataset, clearImportedData, exportDatasetJson, getDataProvider, importFiles, setDataProvider, setStorageAdapters,
} from "@/lib/data";
import { createMemoryAdapter } from "@/lib/data/storage";
import { createStore } from "@/lib/engine";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { useDataProvider } from "@/hooks/use-data-provider";
import { ImportDataDialog } from "@/components/ImportDataDialog";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { DatasetBanner, SESSION_ONLY_TEXT, SNAPSHOT_ONLY_TEXT } from "./DatasetBanner";
import { DataHealthPanel } from "./DataHealthPanel";
import { ImportReport } from "./ImportReport";

const FORBIDDEN = /\b(buy|sell|strong buy|avoid|fraud|multibagger|target price|guaranteed|sure shot|will go bankrupt)\b/i;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function providerFor(ds: FundamentalsDataset, id = "custom"): DataProvider {
  return { id, name: "Custom feed", isDemo: ds.meta.isSynthetic, revision: 0, getDataset: async () => ds };
}

let idb = createMemoryAdapter("indexeddb");

beforeEach(() => {
  localStorage.clear();
  idb = createMemoryAdapter("indexeddb");
  setStorageAdapters([idb]);
  setDataProvider(createSampleProvider());
});

afterEach(() => {
  setStorageAdapters(null);
  setDataProvider(createSampleProvider());
});

describe("ImportReport", () => {
  it("summarises a good import with file kinds and notes", async () => {
    const outcome = await importFiles([
      { name: "companies.csv", text: "symbol,name,sector\nA,Alpha,IT\n" },
      { name: "annual.csv", text: "symbol,fiscal_year,revenue\nA,2025,10\nA,2026,12\n" },
    ]);
    render(<ImportReport outcome={outcome} />);
    expect(screen.getByText(/Ready to import: 1 company, 2 annual rows/)).toBeInTheDocument();
    expect(screen.getByText("Company list · 1 row")).toBeInTheDocument();
    expect(screen.getByText("Annual statements · 2 rows")).toBeInTheDocument();
    expect(screen.getByText(/Notes: 1/)).toBeInTheDocument();
    expect(screen.getByText(/inferred from the sector/)).toBeInTheDocument();
  });

  it("explains a blocked import with the file and row", async () => {
    const outcome = await importFiles([{ name: "bad.csv", text: "name,pe\nX,1\n" }, { name: "x.json", text: "{" }]);
    render(<ImportReport outcome={outcome} />);
    expect(screen.getByText(/Cannot import yet/)).toBeInTheDocument();
    expect(screen.getByText(/Errors \(the import is blocked until these are fixed\): 2/)).toBeInTheDocument();
    expect(screen.getAllByText("Not recognised")).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(FORBIDDEN);
  });

  it("limits long lists", async () => {
    const rows = Array.from({ length: 12 }, (_, k) => `S${k},abc`).join("\n");
    const outcome = await importFiles([{ name: "s.csv", text: `symbol,pe\n${rows}\n` }]);
    render(<ImportReport outcome={outcome} limit={5} />);
    expect(screen.getByText(/^…and \d+ more\.$/)).toBeInTheDocument();
  });
});

describe("DatasetBanner (§F.6 copy)", () => {
  it("labels the sample as fictional and offers the import", async () => {
    render(<DatasetBanner />, { wrapper });
    await waitFor(() => expect(screen.getByText(/fictional companies with generated figures/)).toBeInTheDocument());
    const text = screen.getByLabelText("About the data").textContent ?? "";
    expect(text).toContain("Sample data: 6 fictional companies with generated figures. They describe no real business. Fiscal-year labels are for illustration only.");
    expect(screen.getByRole("button", { name: /Import your data/ })).toBeInTheDocument();
    expect(text).not.toContain(SNAPSHOT_ONLY_TEXT);
    expect(text).not.toMatch(FORBIDDEN);
  });

  it("shows the user's name, real import time and as-of date for imported data", async () => {
    const ds = createTinyDataset();
    ds.meta = { ...ds.meta, isSynthetic: false, source: "user_import", name: "My statements", asOf: "2026-06-30", importedAt: "2026-10-07T09:30:00.000Z" };
    setDataProvider(providerFor(ds, "imported"));
    render(<DatasetBanner />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Your data:/)).toBeInTheDocument());
    const text = screen.getByLabelText("About the data").textContent ?? "";
    expect(text).toMatch(/^Your data: My statements · imported .*2026.* · as of 2026-06-30\. You are responsible for its accuracy and licence\.$/);
  });

  it("says 'not provided' when no as-of date was supplied, and adds the snapshot-only line", async () => {
    const ds = createTinyDataset();
    ds.companies = ds.companies.filter((c) => c.symbol === "TINYSNAP");
    ds.meta = { ...ds.meta, isSynthetic: false, source: "user_import", name: "snap.csv", asOf: null, importedAt: null };
    setDataProvider(providerFor(ds, "imported"));
    render(<DatasetBanner />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Your data:/)).toBeInTheDocument());
    const text = screen.getByLabelText("About the data").textContent ?? "";
    expect(text).toContain("as of not provided");
    expect(text).toContain("time not recorded");
    expect(text).toContain(SNAPSHOT_ONLY_TEXT);
  });

  it("warns when the data is kept for this session only and offers a JSON export", async () => {
    idb.failWrites = true;
    const outcome = await importFiles([{ name: "s.csv", text: "symbol,name,sector,pe\nA,Alpha,IT,10\n" }]);
    await activateImportedDataset(outcome);
    render(<DatasetBanner />, { wrapper });
    await waitFor(() => expect(screen.getByText(new RegExp(SESSION_ONLY_TEXT))).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Export as JSON/ })).toBeInTheDocument();
  });

  it("names a custom provider and shows load errors with a retry", async () => {
    const ds = createTinyDataset();
    ds.meta = { ...ds.meta, isSynthetic: false, source: "custom_provider", name: "Feed" };
    setDataProvider(providerFor(ds));
    const { unmount } = render(<DatasetBanner />, { wrapper });
    await waitFor(() => expect(screen.getByText(/Data from Custom feed:/)).toBeInTheDocument());
    unmount();
    setDataProvider({ id: "broken", name: "Broken", isDemo: false, getDataset: async () => { throw new Error("No connection."); } });
    render(<DatasetBanner />, { wrapper });
    await waitFor(() => expect(screen.getByText(/The data could not be loaded: No connection\./)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("DataHealthPanel", () => {
  it("lists coverage, assumptions and missing inputs", () => {
    const ds = createTinyDataset();
    ds.companies[0].annual[6].lease_liabilities = null;
    ds.companies[0].annual[6].capex = null;
    const store = createStore(ds);
    render(<DataHealthPanel store={store} index={store.indexOf("TINYMFG")} />);
    expect(screen.getByText("FY20 to FY26 · 7 years")).toBeInTheDocument();
    expect(screen.getByText("9 quarters · latest Q1 FY27")).toBeInTheDocument();
    expect(screen.getByText(/Lease liabilities not provided; treated as 0 in debt\. \(1 year\)/)).toBeInTheDocument();
    expect(screen.getByText("FY26:")).toBeInTheDocument();
    expect(screen.getByText(/Capital expenditure/)).toBeInTheDocument();
  });

  it("explains a snapshot-only company and an inferred type", () => {
    const store = createStore(createTinyDataset());
    const { unmount } = render(<DataHealthPanel store={store} index={store.indexOf("TINYSNAP")} />);
    expect(screen.getByText(/Only a snapshot was provided/)).toBeInTheDocument();
    expect(screen.getAllByText("Not provided")).toHaveLength(3);
    unmount();
    render(<DataHealthPanel store={store} index={store.indexOf("TINYBANK")} />);
    expect(screen.getByText(/Bank \(inferred from the sector\)/)).toBeInTheDocument();
  });

  it("shows provided-versus-derived differences in a table", () => {
    const ds = createTinyDataset();
    ds.companies[0].snapshot = { sales: 2000 };
    const store = createStore(ds);
    render(<DataHealthPanel store={store} index={0} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("13.6%")).toBeInTheDocument();
  });

  it("says when there is nothing to report", () => {
    const store = createStore(createTinyDataset());
    render(<DataHealthPanel store={store} index={store.indexOf("TINYMFG")} />);
    expect(screen.getByText(/found nothing to report/)).toBeInTheDocument();
  });
});

describe("DataSourceBadge", () => {
  it("names the source", async () => {
    const { rerender } = render(<DataSourceBadge />);
    expect(screen.getByText("Sample data")).toBeInTheDocument();
    act(() => setDataProvider({ id: "x", name: "My CSV", isDemo: false, getUniverse: async () => [] }));
    rerender(<DataSourceBadge />);
    expect(screen.getByText("My CSV")).toBeInTheDocument();
  });
});

describe("useDataProvider (legacy view for the original Screener)", () => {
  it("gives v2 providers a getUniverse() that reads through the store, and keeps the view stable", async () => {
    const { result, rerender } = renderHook(() => useDataProvider());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(first.isDemo).toBe(true);
    const rows = await first.getUniverse?.();
    expect(rows?.map((r) => r.symbol)).toContain("TINYSNAP");
    expect(rows?.find((r) => r.symbol === "TINYSNAP")?.pe).toBe(22.4);
    const v0: DataProvider = { id: "v0", name: "Old", isDemo: false, getUniverse: async () => [] };
    act(() => setDataProvider(v0));
    expect(result.current).toBe(v0);
  });
});

describe("ImportDataDialog", () => {
  function files(): File[] {
    return ["companies", "annual", "quarterly", "shareholding"].map((n) =>
      new File([readFileSync(`public/sample-data/templates/${n}-template.csv`, "utf8")], `${n}-template.csv`, { type: "text/csv" }));
  }

  it("previews several files, imports them and switches the provider", async () => {
    let open = true;
    render(<ImportDataDialog open onOpenChange={(o) => { open = o; }} />, { wrapper });
    expect(screen.getByText("Import your data")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
    const input = document.getElementById("import-files") as HTMLInputElement;
    fireEvent.change(input, { target: { files: files() } });
    await waitFor(() => expect(screen.getByText(/Ready to import: 1 company/)).toBeInTheDocument());
    expect(screen.getByRole("list", { name: "Chosen files" }).children).toHaveLength(4);
    fireEvent.change(screen.getByLabelText("Data as of (optional)"), { target: { value: "2026-03-31" } });
    const button = screen.getByRole("button", { name: "Import 1 company" });
    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(getDataProvider().id).toBe("imported"));
    expect(open).toBe(false);
    const ds = await getDataProvider().getDataset?.();
    expect(ds?.meta.asOf).toBe("2026-03-31");
    expect(ds?.companies[0].symbol).toBe("EXAMPLE");
    expect(idb.value).not.toBeNull();
  });

  it("accepts pasted text, blocks on errors, and removes files", async () => {
    render(<ImportDataDialog open onOpenChange={() => undefined} />, { wrapper });
    fireEvent.change(screen.getByLabelText("Or paste CSV or JSON"), { target: { value: "name,pe\nX,1\n" } });
    await waitFor(() => expect(screen.getByText(/Cannot import yet/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Or paste CSV or JSON"), { target: { value: JSON.stringify(createTinyDataset()) } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Import 6 companies" })).toBeEnabled());
    const input = document.getElementById("import-files") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["symbol,name\nZ,Zed\n"], "extra.csv")] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove extra.csv" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Remove extra.csv" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove extra.csv" })).not.toBeInTheDocument());
  });

  it("returns to the sample data", async () => {
    await activateImportedDataset(await importFiles([{ name: "t.json", text: exportDatasetJson(createTinyDataset()) }]));
    let open = true;
    render(<ImportDataDialog open onOpenChange={(o) => { open = o; }} />, { wrapper });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Use sample data/ }));
    });
    await waitFor(() => expect(getDataProvider().id).toBe("sample"));
    expect(open).toBe(false);
    expect(idb.value).toBeNull();
    await clearImportedData();
  });

  it("offers every template for download and uses formal copy", () => {
    render(<ImportDataDialog open onOpenChange={() => undefined} />, { wrapper });
    for (const name of ["Company list", "Annual statements", "Quarterly results", "Shareholding", "One-row snapshot"]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("download");
    }
    expect(screen.getByRole("link", { name: "Company list" })).toHaveAttribute("href", "/sample-data/templates/companies-template.csv");
    expect(document.body.textContent).not.toMatch(FORBIDDEN);
  });
});
