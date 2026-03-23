import { motion } from "framer-motion";

export function SectionSkeleton({ type = "card" }: { type?: "card" | "chart" | "table" | "grid" }) {
  const shimmer = "animate-pulse bg-muted/40 rounded";

  if (type === "chart") {
    return (
      <div className="glass-card p-5 space-y-4">
        <div className={`h-4 w-32 ${shimmer}`} />
        <div className={`h-64 ${shimmer} rounded-lg`} />
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className="glass-card p-5 space-y-3">
        <div className={`h-4 w-40 ${shimmer}`} />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className={`h-4 w-20 ${shimmer}`} />
              <div className={`h-4 flex-1 ${shimmer}`} />
              <div className={`h-4 w-16 ${shimmer}`} />
              <div className={`h-4 w-16 ${shimmer}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "grid") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass-card p-4 space-y-2">
            <div className={`h-3 w-16 ${shimmer}`} />
            <div className={`h-6 w-20 ${shimmer}`} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="glass-card p-5 space-y-3">
      <div className={`h-4 w-36 ${shimmer}`} />
      <div className={`h-3 w-full ${shimmer}`} />
      <div className={`h-3 w-3/4 ${shimmer}`} />
    </div>
  );
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
