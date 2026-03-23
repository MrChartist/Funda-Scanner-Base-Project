import { motion } from "framer-motion";
import { UserCircle, Briefcase, Calendar } from "lucide-react";

interface Executive {
  name: string; title: string; since: string; compensation?: string;
}

const MOCK_MANAGEMENT: Executive[] = [
  { name: "Mukesh D. Ambani", title: "Chairman & Managing Director", since: "2002", compensation: "₹15.00 Cr" },
  { name: "V. Srikanth", title: "Joint CFO", since: "2018", compensation: "₹8.50 Cr" },
  { name: "Anshuman Thakur", title: "Head of Strategy", since: "2019" },
  { name: "Kiran Thomas", title: "President", since: "2020", compensation: "₹12.00 Cr" },
  { name: "Savithri Parekh", title: "Company Secretary", since: "2017" },
  { name: "Srikanth Venkatachari", title: "Joint CFO", since: "2014", compensation: "₹7.20 Cr" },
];

export function ManagementInfo() {
  return (
    <div className="glass-card p-5">
      <h2 className="section-title mb-4">
        <Briefcase className="h-4 w-4 text-primary inline mr-2" />
        Key Management
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {MOCK_MANAGEMENT.map((exec, i) => (
          <motion.div key={exec.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <UserCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">{exec.name}</p>
                <p className="text-[11px] text-primary font-medium">{exec.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />Since {exec.since}</span>
              {exec.compensation && (
                <span className="font-mono text-foreground">{exec.compensation}</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
