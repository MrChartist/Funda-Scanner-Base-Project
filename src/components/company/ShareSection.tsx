import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { ROUTER_BASENAME } from "@/lib/base-path";

export interface ShareSectionProps {
  symbol: string;
  sectionId?: string;
  sectionLabel?: string;
}

/** Copies the link to this company (or one section of it). No external sharing. */
export function ShareSection({ symbol, sectionId, sectionLabel }: ShareSectionProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const base = `${window.location.origin}${ROUTER_BASENAME ?? ""}/company/${encodeURIComponent(symbol)}`;
    const url = sectionId ? `${base}#${sectionId}` : base;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the address bar still holds the link.
    }
  };

  return (
    <button
      type="button"
      onClick={copyLink}
      data-no-print
      aria-label={`Copy link to ${sectionLabel ?? "this company"}`}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
      <span className="hidden sm:inline">{copied ? "Link copied" : "Copy link"}</span>
    </button>
  );
}
