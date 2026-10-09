import { cn } from "@/lib/utils";

export interface FictionalBadgeProps {
  className?: string;
}

/** Marks generated sample data. Pair it with <CompanyName>, which also writes "(fictional)" inline. */
export function FictionalBadge({ className }: FictionalBadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300", className)}
      title="Generated sample data. It describes no real company."
    >
      Fictional
    </span>
  );
}
