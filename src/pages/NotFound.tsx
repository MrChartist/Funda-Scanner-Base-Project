import { Link, useLocation } from "react-router-dom";
import { PageShell } from "@/components/layout";

const NotFound = () => {
  const { pathname } = useLocation();

  return (
    <PageShell className="flex min-h-[50vh] items-center justify-center py-16">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="type-page-title">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          There is no page at <span className="break-all font-mono">{pathname}</span>.
        </p>
        <p className="flex flex-wrap justify-center gap-x-4 text-sm">
          <Link to="/" className="flex min-h-11 items-center text-primary underline underline-offset-4 hover:text-primary/80">Go to the Dashboard</Link>
          <Link to="/screener" className="flex min-h-11 items-center text-primary underline underline-offset-4 hover:text-primary/80">Open the Screener</Link>
          <Link to="/learn" className="flex min-h-11 items-center text-primary underline underline-offset-4 hover:text-primary/80">Read the Learn page</Link>
        </p>
      </div>
    </PageShell>
  );
};

export default NotFound;
