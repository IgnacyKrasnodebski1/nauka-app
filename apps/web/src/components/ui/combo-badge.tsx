"use client";
import { comboMultiplier } from "@nauka/shared";
import { AnimatePresence, m } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";

/** Combo badge: appears from 2 in a row, "×2" at 5 (blue), "×3" at 10 (purple). `pulse` (counter) pops it on a tier hit. */
export function ComboBadge({ streak, pulse = 0 }: { streak: number; pulse?: number }) {
  const mult = comboMultiplier(streak);
  return (
    <AnimatePresence>
      {streak >= 2 && (
        <m.span
          key="combo"
          className={cn("combo-badge", mult === 2 && "x2", mult === 3 && "x3")}
          initial={{ scale: 0.4, opacity: 0, y: -6 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
          aria-label={`combo ${streak}${mult > 1 ? `, mnożnik ×${mult}` : ""}`}
        >
          <m.span key={`p${pulse}`} initial={{ scale: pulse ? 1.6 : 1, rotate: pulse ? -8 : 0 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 14 }} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Icon name="zap" size={14} />
            <m.b key={streak} initial={{ scale: 1.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 20 }}>
              {streak}
            </m.b>
            {mult > 1 && <span>×{mult}</span>}
          </m.span>
        </m.span>
      )}
    </AnimatePresence>
  );
}
