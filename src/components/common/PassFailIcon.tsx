import { Check, CircleHelp, X } from "lucide-react";
import type { Tri } from "@/lib/contracts";
import { cn } from "@/lib/utils";

export type PassFailStatus = "pass" | "fail" | "unknown";

export interface PassFailIconProps {
  /** "pass" | "fail" | "unknown", or a Tri (1 true, 0 false, 2 unknown). */
  status: PassFailStatus | Tri;
  /** Visible text; defaults to "Passes", "Fails" or "Not checked". */
  label?: string;
  className?: string;
}

const STYLE: Readonly<Record<PassFailStatus, { text: string; className: string }>> = {
  pass: { text: "Passes", className: "text-emerald-700 dark:text-emerald-400" },
  fail: { text: "Fails", className: "text-red-700 dark:text-red-400" },
  unknown: { text: "Not checked", className: "text-muted-foreground" },
};

function toStatus(s: PassFailStatus | Tri): PassFailStatus {
  if (s === 1) return "pass";
  if (s === 0) return "fail";
  if (s === 2) return "unknown";
  return s;
}

/** Result of a rule: always an icon plus text, never colour alone (spec P7). */
export function PassFailIcon({ status, label, className }: PassFailIconProps) {
  const s = toStatus(status);
  const Icon = s === "pass" ? Check : s === "fail" ? X : CircleHelp;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", STYLE[s].className, className)} data-status={s}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label ?? STYLE[s].text}</span>
    </span>
  );
}
