import { useState } from "react";
import { Share2, Link2, Check, Twitter } from "lucide-react";
import { useParams } from "react-router-dom";

interface ShareSectionProps {
  sectionId?: string;
  sectionLabel?: string;
}

export function ShareSection({ sectionId, sectionLabel }: ShareSectionProps) {
  const { symbol } = useParams<{ symbol: string }>();
  const [copied, setCopied] = useState(false);

  const getUrl = () => {
    const base = `${window.location.origin}/company/${symbol}`;
    return sectionId ? `${base}#${sectionId}` : base;
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(getUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareTwitter = () => {
    const text = sectionLabel
      ? `Check out ${symbol} - ${sectionLabel} on FundaScanner`
      : `Check out ${symbol} on FundaScanner`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getUrl())}`, "_blank");
  };

  return (
    <div className="flex items-center gap-1" data-no-print>
      <button onClick={copyLink}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-secondary"
        title="Copy link">
        {copied ? <Check className="h-3 w-3 text-positive" /> : <Link2 className="h-3 w-3" />}
        {copied ? "Copied!" : "Link"}
      </button>
      <button onClick={shareTwitter}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-secondary"
        title="Share on Twitter">
        <Twitter className="h-3 w-3" />
      </button>
    </div>
  );
}
