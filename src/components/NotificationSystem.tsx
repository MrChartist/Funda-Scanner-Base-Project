import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Bell, AlertTriangle } from "lucide-react";
import { MOCK_COMPANIES } from "@/lib/mock-data";

const NOTIFICATION_TYPES = [
  {
    gen: () => {
      const c = MOCK_COMPANIES[Math.floor(Math.random() * MOCK_COMPANIES.length)];
      const isUp = Math.random() > 0.4;
      const pct = (2 + Math.random() * 5).toFixed(1);
      return {
        title: `${c.symbol} ${isUp ? "surges" : "drops"} ${pct}%`,
        description: `${c.name.split(" ").slice(0, 2).join(" ")} is ${isUp ? "up" : "down"} ₹${(c.price * Number(pct) / 100).toFixed(0)} today`,
        type: isUp ? "positive" as const : "negative" as const,
      };
    },
  },
  {
    gen: () => {
      const c = MOCK_COMPANIES[Math.floor(Math.random() * MOCK_COMPANIES.length)];
      return {
        title: `${c.symbol} near 52-week high`,
        description: `Trading within 2% of its 52-week high of ₹${(c.price * 1.02).toFixed(0)}`,
        type: "warning" as const,
      };
    },
  },
  {
    gen: () => {
      const sectors = ["IT", "Banking", "Pharma", "Auto", "FMCG"];
      const sector = sectors[Math.floor(Math.random() * sectors.length)];
      return {
        title: `${sector} sector alert`,
        description: `${sector} index moved ${(1 + Math.random() * 3).toFixed(1)}% in the last hour`,
        type: "info" as const,
      };
    },
  },
];

export function useMarketNotifications(enabled = true) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Show first notification after 15s, then every 45-90s
    const showNotification = () => {
      const template = NOTIFICATION_TYPES[Math.floor(Math.random() * NOTIFICATION_TYPES.length)];
      const notif = template.gen();

      const iconMap = {
        positive: <TrendingUp className="h-4 w-4 text-positive" />,
        negative: <TrendingDown className="h-4 w-4 text-negative" />,
        warning: <AlertTriangle className="h-4 w-4 text-warning" />,
        info: <Bell className="h-4 w-4 text-primary" />,
      };

      toast(notif.title, {
        description: notif.description,
        icon: iconMap[notif.type],
        duration: 5000,
      });
    };

    const firstTimer = setTimeout(showNotification, 15000);

    timerRef.current = setInterval(() => {
      showNotification();
    }, 45000 + Math.random() * 45000);

    return () => {
      clearTimeout(firstTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled]);
}
