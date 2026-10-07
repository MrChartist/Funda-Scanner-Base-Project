const REPO_URL = "https://github.com/MrChartist/Funda-Scanner-Base-Project";

export function Footer() {
  return (
    <footer className="mt-8 border-t border-border/50 px-4 py-6 text-center text-xs leading-relaxed text-muted-foreground">
      <p className="mx-auto max-w-3xl">
        <strong className="font-semibold text-foreground">Disclaimer:</strong> Funda Scanner is an open-source educational
        project. The figures shown by default are fictional sample data. When you load your own data, its accuracy and
        licensing are your responsibility. Nothing here is investment advice or a recommendation about any security. Please
        verify data independently and consult a SEBI-registered adviser before making any investment decision.
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
