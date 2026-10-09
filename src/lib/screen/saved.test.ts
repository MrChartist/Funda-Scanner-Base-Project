import { beforeEach, describe, expect, it } from "vitest";
import type { ScreenDefinition } from "@/lib/contracts";
import { STORAGE_KEYS } from "@/lib/contracts";
import {
  deleteScreen, duplicateScreen, exportScreenLibrary, importScreenLibrary, loadSavedScreens, renameScreen, saveScreen,
  ScreenNameError, V0_BACKUP_KEY, v0FiltersToQuery, validateScreenName,
} from "./saved";

type NewScreen = Omit<ScreenDefinition, "v" | "id" | "createdAt" | "updatedAt" | "catalogueVersion">;
const draft = (name: string, query = "roce > 15"): NewScreen => ({
  name, description: "", query, columns: [], sort: null, universe: { kind: "all" }, templateId: null,
});

describe("saved screens v2", () => {
  beforeEach(() => localStorage.clear());

  it("saves, lists, updates (keeping id and createdAt) and deletes", () => {
    const a = saveScreen(draft("Mine"));
    expect(a).toMatchObject({ v: 2, name: "Mine", catalogueVersion: "2026.1" });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.screens) ?? "{}")).toMatchObject({ v: 2, data: { v: 2 } });
    const b = saveScreen({ ...a, query: "roce > 20" });
    expect(b.id).toBe(a.id);
    expect(b.createdAt).toBe(a.createdAt);
    expect(loadSavedScreens().map((s) => s.query)).toEqual(["roce > 20"]);
    deleteScreen("missing");
    deleteScreen(a.id);
    expect(loadSavedScreens()).toEqual([]);
  });

  it("requires unique, non-empty names (case-insensitive)", () => {
    const a = saveScreen(draft("Quality"));
    expect(() => saveScreen(draft("quality "))).toThrow(ScreenNameError);
    expect(() => saveScreen(draft("   "))).toThrow("Enter a name for the screen.");
    expect(validateScreenName("QUALITY")).toBe('A saved screen called "Quality" already exists. Choose another name.');
    expect(validateScreenName("Quality", a.id)).toBeNull();
    expect(validateScreenName("x".repeat(81))).toMatch(/80 characters/);
    // Saving the same screen under its own name is fine.
    expect(saveScreen({ ...a, description: "edited" }).description).toBe("edited");
  });

  it("renames and duplicates", () => {
    const a = saveScreen(draft("Quality"));
    saveScreen(draft("Value"));
    expect(renameScreen(a.id, "Compounders")?.name).toBe("Compounders");
    expect(() => renameScreen(a.id, "value")).toThrow(ScreenNameError);
    expect(renameScreen("missing", "x")).toBeNull();
    const c1 = duplicateScreen(a.id);
    const c2 = duplicateScreen(a.id);
    expect([c1?.name, c2?.name]).toEqual(["Compounders (copy)", "Compounders (copy) (2)"]);
    expect(c1?.id).not.toBe(a.id);
    expect(c1?.query).toBe(a.query);
    expect(duplicateScreen("missing")).toBeNull();
    expect(loadSavedScreens()).toHaveLength(4);
  });

  it("migrates v0 FilterCondition[] (including between) and keeps a one-time backup", () => {
    const v0 = JSON.stringify([
      { metric: "price_book", operator: "lt", value: 3 },
      { metric: "roe", operator: "between", value: 25, value2: 15 },
      { metric: "pe", operator: "eq", value: 12.5 },
      { metric: "roce", operator: "gt", value: 15 },
    ]);
    localStorage.setItem(STORAGE_KEYS.screens, v0);
    const screens = loadSavedScreens();
    expect(screens).toHaveLength(1);
    expect(screens[0]).toMatchObject({ v: 2, name: "Saved screen", query: "pb < 3\nroe BETWEEN 15 AND 25\npe = 12.5\nroce > 15" });
    expect(localStorage.getItem(V0_BACKUP_KEY)).toBe(v0);
    // The migrated file is written at once, so ids stay stable and delete works.
    expect(loadSavedScreens()[0].id).toBe(screens[0].id);
    deleteScreen(screens[0].id);
    expect(loadSavedScreens()).toEqual([]);
    expect(localStorage.getItem(V0_BACKUP_KEY)).toBe(v0);
  });

  it("migrates v0 named screens, renaming clashes and skipping broken filters", () => {
    localStorage.setItem(STORAGE_KEYS.screens, JSON.stringify([
      { name: "Cheap", filters: [{ metric: "pe", operator: "lt", value: 15 }] },
      { name: "cheap", filters: [{ metric: "pb", operator: "lt", value: 2 }] },
      { name: "Broken", filters: [{ metric: "pe", operator: "near", value: 1 }, { metric: "pe", operator: "gt", value: Number.NaN }] },
    ]));
    expect(loadSavedScreens().map((s) => [s.name, s.query])).toEqual([["Cheap", "pe < 15"], ["cheap (2)", "pb < 2"]]);
  });

  it("converts each v0 operator", () => {
    expect(v0FiltersToQuery([
      { metric: "a", operator: "gt", value: 1 }, { metric: "b", operator: "lt", value: -2 }, { metric: "c", operator: "eq", value: 0.5 },
      { metric: "d", operator: "between", value: 1, value2: 2 }, { metric: "price_book", operator: "gt", value: 1 },
    ])).toBe("a > 1\nb < -2\nc = 0.5\nd BETWEEN 1 AND 2\npb > 1");
  });

  it("ignores unreadable storage instead of failing", () => {
    localStorage.setItem(STORAGE_KEYS.screens, "{not json");
    expect(loadSavedScreens()).toEqual([]);
    localStorage.setItem(STORAGE_KEYS.screens, JSON.stringify({ v: 2, data: { v: 2, screens: [{ name: "ok", query: "pe < 1" }, { bad: 1 }] } }));
    expect(loadSavedScreens().map((s) => s.name)).toEqual(["ok"]);
  });
});

describe("screen library backup", () => {
  beforeEach(() => localStorage.clear());

  it("exports and re-imports with new ids, renaming clashes", () => {
    const a = saveScreen(draft("Quality"));
    const lib = exportScreenLibrary();
    expect(lib).toMatchObject({ kind: "funda-scanner-screens", v: 2 });
    expect(typeof lib.exportedAt).toBe("string");
    expect(importScreenLibrary(JSON.stringify(lib))).toEqual({ added: 1, renamed: 1, errors: [] });
    const screens = loadSavedScreens();
    expect(screens.map((s) => s.name)).toEqual(["Quality", "Quality (2)"]);
    expect(screens[1].id).not.toBe(a.id);
  });

  it("validates the file and each screen", () => {
    expect(importScreenLibrary("not json")).toEqual({ added: 0, renamed: 0, errors: ["The file is not valid JSON."] });
    expect(importScreenLibrary("{}").errors).toEqual(["The file is not a Funda Scanner screen library."]);
    const res = importScreenLibrary(JSON.stringify({
      kind: "funda-scanner-screens", v: 2, exportedAt: "x",
      screens: [{ name: "Good", query: "pe < 20", universe: { kind: "planet" }, columns: [{ kind: "metric", id: "pe" }, 5], sort: { key: 1 } }, { query: "x" }],
    }));
    expect(res).toEqual({ added: 1, renamed: 0, errors: ["Screen 2 has no name or query and was skipped."] });
    expect(loadSavedScreens()[0]).toMatchObject({ name: "Good", universe: { kind: "all" }, columns: [{ kind: "metric", id: "pe" }], sort: null });
    expect(importScreenLibrary(JSON.stringify({ kind: "funda-scanner-screens", v: 9, screens: [] })).errors[0]).toMatch(/newer version/);
  });
});
