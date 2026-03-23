import { Link, useParams } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { MOCK_COMPANIES } from "@/lib/mock-data";

export function CompanyBreadcrumb() {
  const { symbol } = useParams<{ symbol: string }>();
  const company = MOCK_COMPANIES.find(c => c.symbol === symbol);

  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground py-3 overflow-x-auto scrollbar-thin">
      <Link to="/" className="flex items-center gap-1 hover:text-foreground transition-colors flex-shrink-0">
        <Home className="h-3 w-3" />
        <span>Home</span>
      </Link>
      <ChevronRight className="h-3 w-3 flex-shrink-0" />
      {company?.sector && (
        <>
          <Link to={`/screener?sector=${company.sector}`}
            className="hover:text-foreground transition-colors flex-shrink-0 max-w-[120px] truncate">
            {company.sector}
          </Link>
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
        </>
      )}
      <span className="font-medium text-foreground flex-shrink-0">
        {company?.name || symbol}
      </span>
      {symbol && (
        <span className="font-mono text-muted-foreground ml-1 flex-shrink-0">
          ({symbol})
        </span>
      )}
    </nav>
  );
}
