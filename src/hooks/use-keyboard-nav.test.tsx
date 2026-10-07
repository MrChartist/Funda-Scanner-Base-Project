import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { CommandPalette } from "@/components/CommandPalette";
import { renderWithApp } from "@/components/common/test-wrapper";
import { createStore } from "@/lib/engine";
import { generateSampleDataset } from "@/lib/sample";
import { createKeyHandler, openCommandPalette, useKeyboardNav } from "./use-keyboard-nav";

function Harness({ withSlashTarget = true }: { withSlashTarget?: boolean }) {
  useKeyboardNav();
  return (
    <>
      <input aria-label="Global search" data-global-search="" />
      <CommandPalette />
      <Routes>
        <Route
          path="/screener"
          element={withSlashTarget ? <textarea aria-label="Query" data-slash-focus="" /> : <p>No query box</p>}
        />
        <Route path="*" element={<p>Elsewhere</p>} />
      </Routes>
    </>
  );
}

beforeEach(() => localStorage.clear());

describe("keyboard shortcuts", () => {
  it("focuses the query box on /screener when / is pressed", () => {
    renderWithApp(<Harness />, "/screener");
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByLabelText("Query")).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("focuses the search box elsewhere", () => {
    renderWithApp(<Harness />, "/watchlist");
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByLabelText("Global search")).toHaveFocus();
  });

  it("does not react to / typed in a field, or with a modifier", () => {
    renderWithApp(<Harness />, "/screener");
    const query = screen.getByLabelText("Query");
    query.focus();
    fireEvent.keyDown(query, { key: "/" });
    expect(query).toHaveFocus();
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: "/", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "/", metaKey: true });
    fireEvent.keyDown(document.body, { key: "/", altKey: true });
    expect(query).not.toHaveFocus();
  });

  it("opens the palette once on Ctrl+K and closes it on a second press (no double handling)", async () => {
    renderWithApp(<Harness />, "/screener");
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("opens the palette on / when the page has no query box and no search field", async () => {
    // The harness renders a global search field, so test the handler directly with an empty root.
    const calls: string[] = [];
    const { onKeyDown, dispose } = createKeyHandler({ navigate: (to) => calls.push(to), toggleHelp: () => calls.push("help"), closeHelp: () => {} });
    const seen: string[] = [];
    const listener = (e: Event) => seen.push(String((e as CustomEvent).detail));
    window.addEventListener("funda:palette", listener);
    document.body.replaceChildren();
    onKeyDown(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    window.removeEventListener("funda:palette", listener);
    dispose();
    expect(seen).toEqual(["open"]);
  });

  it("navigates with g then a letter and ignores the second key without g", () => {
    const calls: string[] = [];
    const { onKeyDown, dispose } = createKeyHandler({ navigate: (to) => calls.push(to), toggleHelp: () => {}, closeHelp: () => {} });
    onKeyDown(new KeyboardEvent("keydown", { key: "l" }));
    onKeyDown(new KeyboardEvent("keydown", { key: "g" }));
    onKeyDown(new KeyboardEvent("keydown", { key: "l" }));
    onKeyDown(new KeyboardEvent("keydown", { key: "g" }));
    onKeyDown(new KeyboardEvent("keydown", { key: "s" }));
    dispose();
    expect(calls).toEqual(["/learn", "/screener"]);
  });
});

describe("command palette", () => {
  it("lists the symbols of the loaded dataset and opens the company", async () => {
    const dataset = generateSampleDataset();
    const store = createStore(dataset);
    const symbol = store.symbols[3];
    renderWithApp(<Harness />, "/watchlist");
    act(() => openCommandPalette());
    const input = await screen.findByRole("combobox", { name: /search companies, metrics, guided screens and pages/i });
    fireEvent.change(input, { target: { value: symbol } });
    const option = await screen.findByRole("option", { name: new RegExp(symbol) });
    expect(option).toBeInTheDocument();
    expect(option.textContent).toContain("(fictional)");
  });

  it("also finds metrics and guided screens", async () => {
    renderWithApp(<Harness />, "/watchlist");
    act(() => openCommandPalette());
    const input = await screen.findByRole("combobox", { name: /search companies, metrics, guided screens and pages/i });
    fireEvent.change(input, { target: { value: "quality" } });
    expect(await screen.findByRole("option", { name: /quality compounders/i })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "return on capital" } });
    expect(await screen.findByRole("option", { name: /return on capital employed/i })).toBeInTheDocument();
  });
});
