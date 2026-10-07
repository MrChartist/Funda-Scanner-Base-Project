// src/hooks/use-keyboard-nav.tsx — global keyboard shortcuts.
// One listener owns every shortcut. Cmd/Ctrl+K asks the command palette to open through a window
// event; the palette does not listen for keys that open it, so a key can never be handled twice.
// Plain keys are ignored while typing in a field and when any modifier other than Shift is held.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export const PALETTE_EVENT = "funda:palette";
export type PaletteRequest = "open" | "toggle";

/** Asks the command palette to open (or toggle). Used by the Header button and the shortcuts. */
export function openCommandPalette(mode: PaletteRequest = "open"): void {
  window.dispatchEvent(new CustomEvent<PaletteRequest>(PALETTE_EVENT, { detail: mode }));
}

/** True for fields where typing must not trigger a shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** The element "/" should focus: the page's own query box, else a visible search field. */
export function findSlashTarget(root: ParentNode = document): HTMLElement | null {
  const own = root.querySelector<HTMLElement>("[data-slash-focus]");
  if (own) return own;
  const fields = Array.from(root.querySelectorAll<HTMLElement>("[data-global-search]"));
  return fields.find((f) => f.getClientRects().length > 0) ?? fields[0] ?? null;
}

const G_ROUTES: Readonly<Record<string, string>> = {
  d: "/",
  s: "/screener",
  c: "/compare",
  w: "/watchlist",
  p: "/portfolio",
  f: "/dcf",
  l: "/learn",
};

export interface KeyboardNavHandlers {
  navigate: (to: string) => void;
  toggleHelp: () => void;
  closeHelp: () => void;
}

/** Creates the keydown handler; kept separate from the hook so it can be tested directly. */
export function createKeyHandler(h: KeyboardNavHandlers): { onKeyDown: (e: KeyboardEvent) => void; dispose: () => void } {
  let gPending = false;
  let gTimer: ReturnType<typeof setTimeout> | undefined;

  const clearG = () => {
    gPending = false;
    if (gTimer !== undefined) clearTimeout(gTimer);
    gTimer = undefined;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing) return;

    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      clearG();
      openCommandPalette("toggle");
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;

    if (gPending) {
      clearG();
      const to = G_ROUTES[e.key.toLowerCase()];
      if (to) {
        e.preventDefault();
        h.navigate(to);
      }
      return;
    }

    switch (e.key) {
      case "g":
        gPending = true;
        gTimer = setTimeout(clearG, 800);
        return;
      case "j":
        window.scrollBy({ top: 120, behavior: "smooth" });
        return;
      case "k":
        window.scrollBy({ top: -120, behavior: "smooth" });
        return;
      case "/": {
        e.preventDefault();
        const target = findSlashTarget();
        if (target) target.focus();
        else openCommandPalette("open");
        return;
      }
      case "?":
        e.preventDefault();
        h.toggleHelp();
        return;
      case "Escape":
        h.closeHelp();
        return;
      default:
        return;
    }
  };

  return { onKeyDown, dispose: clearG };
}

export function useKeyboardNav() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const { onKeyDown, dispose } = createKeyHandler({
      navigate: (to) => navigateRef.current(to),
      toggleHelp: () => setShowHelp((p) => !p),
      closeHelp: () => setShowHelp(false),
    });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      dispose();
    };
  }, []);

  return { showHelp, setShowHelp };
}

const SHORTCUT_GROUPS = [
  {
    title: "Go to",
    shortcuts: [
      { keys: ["g", "d"], desc: "Dashboard" },
      { keys: ["g", "s"], desc: "Screener" },
      { keys: ["g", "c"], desc: "Compare" },
      { keys: ["g", "w"], desc: "Watchlist" },
      { keys: ["g", "p"], desc: "Portfolio" },
      { keys: ["g", "f"], desc: "DCF calculator" },
      { keys: ["g", "l"], desc: "Learn" },
    ],
  },
  {
    title: "Browsing",
    shortcuts: [
      { keys: ["j"], desc: "Scroll down" },
      { keys: ["k"], desc: "Scroll up" },
      { keys: ["/"], desc: "Focus the query box or search" },
      { keys: ["Ctrl or ⌘", "K"], desc: "Command palette" },
    ],
  },
  {
    title: "General",
    shortcuts: [
      { keys: ["?"], desc: "Show or hide this list" },
      { keys: ["Esc"], desc: "Close dialogs" },
    ],
  },
] as const;

export function KeyboardShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Keyboard shortcuts</h2>
            <button type="button" onClick={onClose} className="min-h-11 text-sm text-muted-foreground transition-colors hover:text-foreground">
              Close <span className="kbd ml-1">Esc</span>
            </button>
          </div>
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</h3>
              <ul className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <li key={s.desc} className="flex items-center justify-between gap-3 py-1">
                    <span className="text-sm text-foreground">{s.desc}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {s.keys.map((k, i) => (
                        <span key={k} className="flex items-center gap-1">
                          <span className="kbd">{k}</span>
                          {i < s.keys.length - 1 && <span className="text-xs text-muted-foreground">then</span>}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
