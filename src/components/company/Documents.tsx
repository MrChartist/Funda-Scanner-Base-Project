import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, ExternalLink, Star, Calendar, Mic, FileSpreadsheet, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Announcement {
  title: string; date: string; summary: string; type: "Recent" | "Important";
}

interface Props {
  documents: {
    announcements: Announcement[];
    annual_reports: { year: string; source: string }[];
    credit_ratings: { title: string; date: string }[];
    concalls: { date: string; transcript: boolean; ai_summary: boolean; ppt: boolean; rec: boolean }[];
  };
}

export function Documents({ documents }: Props) {
  const [announcementTab, setAnnouncementTab] = useState<"Recent" | "Important">("Recent");
  const filtered = documents.announcements.filter((a) => a.type === announcementTab);

  return (
    <div className="glass-card p-5">
      <h2 className="section-title mb-5">
        <FileText className="h-5 w-5 text-primary inline mr-2" />
        Documents
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Announcements */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Announcements</h3>
          <div className="flex gap-1 mb-3">
            {(["Recent", "Important"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setAnnouncementTab(tab)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                  announcementTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="space-y-3 max-h-48 overflow-y-auto scrollbar-thin">
            {filtered.map((a, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="group cursor-pointer">
                <p className="text-xs font-medium text-primary hover:underline leading-tight">{a.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(a.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — {a.summary}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Annual Reports */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Annual Reports</h3>
          <div className="space-y-2.5 max-h-48 overflow-y-auto scrollbar-thin">
            {documents.annual_reports.map((r, i) => (
              <div key={i} className="group cursor-pointer flex items-start gap-2">
                <ExternalLink className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-primary hover:underline">{r.year}</p>
                  <p className="text-[10px] text-muted-foreground">from {r.source}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Credit Ratings */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Credit Ratings</h3>
          <div className="space-y-2.5 max-h-48 overflow-y-auto scrollbar-thin">
            {documents.credit_ratings.map((r, i) => (
              <div key={i} className="group cursor-pointer flex items-start gap-2">
                <Star className="h-3 w-3 text-chart-amber mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-primary hover:underline">{r.title}</p>
                  <p className="text-[10px] text-muted-foreground">{r.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Concalls */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Concalls</h3>
          <div className="space-y-2.5 max-h-48 overflow-y-auto scrollbar-thin">
            {documents.concalls.map((c, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono w-16 flex-shrink-0">{c.date}</span>
                <div className="flex gap-1 flex-wrap">
                  <ConcallBadge active={c.transcript} icon={<Mic className="h-2.5 w-2.5" />} label="Transcript" />
                  <ConcallBadge active={c.ai_summary} icon={<FileText className="h-2.5 w-2.5" />} label="AI Summary" />
                  <ConcallBadge active={c.ppt} icon={<FileSpreadsheet className="h-2.5 w-2.5" />} label="PPT" />
                  {c.rec && <ConcallBadge active={c.rec} icon={<Play className="h-2.5 w-2.5" />} label="REC" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConcallBadge({ active, icon, label }: { active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Badge
      variant={active ? "default" : "outline"}
      className={`text-[9px] px-1.5 py-0.5 gap-0.5 cursor-pointer ${
        active
          ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
          : "text-muted-foreground/40 border-border/30"
      }`}
    >
      {icon}
      {label}
    </Badge>
  );
}
