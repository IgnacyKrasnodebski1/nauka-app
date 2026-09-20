"use client";
import { useEffect, useState, type ReactNode } from "react";
import { m, useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/ui/icons";

/** Count-up number (ease-out cubic, ~900 ms; instant under reduced motion). */
export function CountUp({ value, duration = 900, className }: { value: number; duration?: number; className?: string }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);
  return <span className={className}>{reduced ? value : n}</span>;
}

export type StatTone = "gold" | "gem" | "green" | "blue" | "orange" | "red" | "purple";
const SOFT: Record<StatTone, string> = { gold: "soft-gold", gem: "soft-gem", green: "soft-green", blue: "soft-blue", orange: "soft-orange", red: "soft-red", purple: "soft-purple" };

/** 3D stat tile: icon + label + big animated number (or custom centre). `delay` for spring-in stagger. */
export function StatCard({ icon, label, value, suffix, tone = "gold", delay = 0, children, className }: { icon: IconName; label: string; value?: number; suffix?: string; tone?: StatTone; delay?: number; children?: ReactNode; className?: string }) {
  return (
    <m.div className={cn("card3d statcard", SOFT[tone], tone, className)} initial={{ opacity: 0, y: 22, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20, delay }}>
      <div className="lbl">
        <Icon name={icon} size={14} />
        {label}
      </div>
      {children ?? (
        <div className="big">
          {value !== undefined && <CountUp value={value} />}
          {suffix && <small>{suffix}</small>}
        </div>
      )}
    </m.div>
  );
}
