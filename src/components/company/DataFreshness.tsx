import { useMemo } from "react";

interface DataFreshnessProps {
  /** "live" | ISO date string | minutes-ago number */
  updatedAt?: string | number;
  label?: string;
}

export function DataFreshness({ updatedAt, label }: DataFreshnessProps) {
  const { text, dotClass } = useMemo(() => {
    if (updatedAt === "live" || updatedAt === undefined) {
      return { text: label || "Live", dotClass: "freshness-dot freshness-dot-live" };
    }
    if (typeof updatedAt === "number") {
      if (updatedAt < 60) return { text: `${updatedAt}m ago`, dotClass: "freshness-dot freshness-dot-live" };
      if (updatedAt < 1440) return { text: `${Math.floor(updatedAt / 60)}h ago`, dotClass: "freshness-dot freshness-dot-recent" };
      return { text: `${Math.floor(updatedAt / 1440)}d ago`, dotClass: "freshness-dot freshness-dot-stale" };
    }
    // ISO date string
    const diff = Date.now() - new Date(updatedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return { text: `${mins}m ago`, dotClass: "freshness-dot freshness-dot-live" };
    if (mins < 1440) return { text: `${Math.floor(mins / 60)}h ago`, dotClass: "freshness-dot freshness-dot-recent" };
    return { text: `${Math.floor(mins / 1440)}d ago`, dotClass: "freshness-dot freshness-dot-stale" };
  }, [updatedAt, label]);

  return (
    <span className="freshness-badge" title={`Last updated: ${text}`}>
      <span className={dotClass} />
      {text}
    </span>
  );
}
