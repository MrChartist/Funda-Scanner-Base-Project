import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts: KeyboardShortcut[] = [
    { key: "/", description: "Focus search", action: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true })) },
    { key: "?", shift: true, description: "Show keyboard shortcuts", action: () => setShowHelp(p => !p) },
    { key: "g", description: "Go to Dashboard (press g then d)", action: () => {} }, // handled separately
    { key: "Escape", description: "Close dialogs", action: () => setShowHelp(false) },
  ];

  useEffect(() => {
    let gPressed = false;
    let gTimeout: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      
      if (isInput) return;

      // G-prefix navigation
      if (gPressed) {
        gPressed = false;
        clearTimeout(gTimeout);
        e.preventDefault();
        switch (e.key) {
          case "d": navigate("/"); break;
          case "s": navigate("/screener"); break;
          case "c": navigate("/compare"); break;
          case "w": navigate("/watchlist"); break;
          case "f": navigate("/dcf"); break;
        }
        return;
      }

      if (e.key === "g" && !e.ctrlKey && !e.metaKey) {
        gPressed = true;
        gTimeout = setTimeout(() => { gPressed = false; }, 500);
        return;
      }

      // J/K scroll
      if (e.key === "j") {
        window.scrollBy({ top: 120, behavior: "smooth" });
        return;
      }
      if (e.key === "k") {
        window.scrollBy({ top: -120, behavior: "smooth" });
        return;
      }

      // / to search
      if (e.key === "/" && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
        return;
      }

      // ? for help
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        setShowHelp(p => !p);
        return;
      }

      if (e.key === "Escape") {
        setShowHelp(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return { showHelp, setShowHelp };
}

export function KeyboardShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const groups = [
    {
      title: "Navigation",
      shortcuts: [
        { keys: ["g", "d"], desc: "Go to Dashboard" },
        { keys: ["g", "s"], desc: "Go to Screener" },
        { keys: ["g", "c"], desc: "Go to Compare" },
        { keys: ["g", "w"], desc: "Go to Watchlist" },
        { keys: ["g", "f"], desc: "Go to DCF Calculator" },
      ],
    },
    {
      title: "Browsing",
      shortcuts: [
        { keys: ["j"], desc: "Scroll down" },
        { keys: ["k"], desc: "Scroll up" },
        { keys: ["/"], desc: "Focus search" },
        { keys: ["⌘", "K"], desc: "Command palette" },
      ],
    },
    {
      title: "General",
      shortcuts: [
        { keys: ["?"], desc: "Toggle this help" },
        { keys: ["Esc"], desc: "Close dialogs" },
      ],
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl p-6 space-y-5"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Close <span className="kbd ml-1">Esc</span>
            </button>
          </div>
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.title}</h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <div key={s.desc} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-foreground">{s.desc}</span>
                    <div className="flex gap-1">
                      {s.keys.map((k, i) => (
                        <span key={i}>
                          <span className="kbd">{k}</span>
                          {i < s.keys.length - 1 && <span className="text-muted-foreground mx-0.5 text-xs">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
