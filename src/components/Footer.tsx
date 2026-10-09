import { Link } from "react-router-dom";

const REPO_URL = "https://github.com/MrChartist/Funda-Scanner-Base-Project";
const DATA_FORMAT_URL = `${REPO_URL}/blob/main/docs/data-format.md`;

const linkClass =
  "rounded underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:text-foreground";

export function Footer() {
  return (
    <footer className="mt-10 border-t border-border bg-card/40">
      <div className="app-container space-y-4 py-8 text-xs leading-relaxed text-muted-foreground">
        <p className="max-w-3xl">
          <strong className="font-semibold text-foreground">Disclaimer:</strong> Funda Scanner is an open-source educational
          project. The figures shown by default are fictional sample data. When you load your own data, its accuracy and
          licensing are your responsibility. Nothing here is investment advice or a recommendation about any security. Please
          verify data independently and consult a SEBI-registered adviser before making any investment decision.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border/70 pt-4">
          <p>
            MIT licensed · Built by{" "}
            <a href="https://github.com/MrChartist" target="_blank" rel="noopener noreferrer" className={linkClass}>
              @MrChartist
            </a>
          </p>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link to="/learn" className={linkClass}>Learn</Link>
            <a href={DATA_FORMAT_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>Data format guide</a>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>Source on GitHub</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
