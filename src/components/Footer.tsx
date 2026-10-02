const REPO_URL = "https://github.com/MrChartist/Funda-Scanner-Base-Project";

export function Footer() {
  return (
    <footer className="border-t border-border/50 mt-8 px-4 py-6 text-center text-[11px] leading-relaxed text-muted-foreground">
      <p className="mx-auto max-w-3xl">
        <strong className="font-semibold text-foreground">Disclaimer:</strong> Funda Scanner is an open-source educational
        project. Company financials shown by default are synthetic demo data, and live figures (where enabled) come from
        third-party sources that may be delayed or inaccurate. Nothing here is investment advice or a recommendation to
        buy or sell any security. Please verify data independently and consult a SEBI-registered adviser before investing.
      </p>
      <p className="mt-2">
        MIT licensed ·{" "}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
          Source on GitHub
        </a>{" "}
        · Built by{" "}
        <a href="https://github.com/MrChartist" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
          @MrChartist
        </a>
      </p>
    </footer>
  );
}
