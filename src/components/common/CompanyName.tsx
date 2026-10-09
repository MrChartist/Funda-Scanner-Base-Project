import { cn } from "@/lib/utils";

export interface CompanyNameProps {
  name: string;
  /** dataset.meta.isSynthetic: adds the inline text "(fictional)" so it survives copy and paste. */
  isSynthetic: boolean;
  symbol?: string;
  showSymbol?: boolean;
  className?: string;
}

const FICTIONAL = "(fictional)";

/** A company name; synthetic companies always carry the inline text "(fictional)". */
export function CompanyName({ name, isSynthetic, symbol, showSymbol = false, className }: CompanyNameProps) {
  const alreadyLabelled = name.trim().toLowerCase().endsWith(FICTIONAL);
  return (
    <span className={cn("inline", className)}>
      {name}
      {isSynthetic && !alreadyLabelled && <span className="text-muted-foreground"> {FICTIONAL}</span>}
      {showSymbol && symbol && <span className="ml-1 text-xs text-muted-foreground">{symbol}</span>}
    </span>
  );
}
