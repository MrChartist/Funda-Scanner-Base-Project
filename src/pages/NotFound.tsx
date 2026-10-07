import { Link, useLocation } from "react-router-dom";

const NotFound = () => {
  const { pathname } = useLocation();

  return (
    <div className="container flex min-h-[50vh] items-center justify-center py-16">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-3xl font-bold text-foreground">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          There is no page at <span className="break-all font-mono">{pathname}</span>.
        </p>
        <p className="flex flex-wrap justify-center gap-x-4 text-sm">
          <Link to="/" className="flex min-h-11 items-center text-primary underline hover:text-primary/90">Go to the Dashboard</Link>
          <Link to="/screener" className="flex min-h-11 items-center text-primary underline hover:text-primary/90">Open the Screener</Link>
          <Link to="/learn" className="flex min-h-11 items-center text-primary underline hover:text-primary/90">Read the Learn page</Link>
        </p>
      </div>
    </div>
  );
};

export default NotFound;
