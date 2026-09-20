"use client";
import { ACHIEVEMENTS, type Achievement } from "@nauka/shared";
import { useState } from "react";
import { AnimatePresence, m } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon, type IconName } from "@/components/ui/icons";

export const ACH_ICON = (icon: string): IconName => (["sparkles", "flag", "star", "zap", "flame", "layers", "trophy", "check", "target", "gift", "moon", "sun"].includes(icon) ? (icon as IconName) : "medal");

/** 4-column badge grid; locked badges grey with "?". Tap opens a detail sheet. */
export function BadgesGrid({ unlocked, columns = 4 }: { unlocked: ReadonlySet<string>; columns?: number }) {
  const [open, setOpen] = useState<Achievement | null>(null);
  return (
    <>
      <div className="badgegrid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {ACHIEVEMENTS.map((a, i) => {
          const on = unlocked.has(a.key);
          return (
            <m.button
              type="button"
              key={a.key}
              className={cn("badge-tile", !on && "locked")}
              onClick={() => setOpen(a)}
              aria-label={`${a.title}${on ? "" : " (zablokowana)"}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: Math.min(0.5, i * 0.03) }}
              whileTap={{ scale: 0.94 }}
            >
              {on ? <Icon name={ACH_ICON(a.icon)} size={26} /> : <span className="display" style={{ fontSize: 22, fontWeight: 800 }}>?</span>}
              <span className="bt">{on ? a.title : "?"}</span>
            </m.button>
          );
        })}
      </div>
      <AnimatePresence>
        {open && (
          <m.div className="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label={open.title}>
            <m.div className="card3d soft-gold text-center" initial={{ y: 30, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className={cn("badge-tile mx-auto", !unlocked.has(open.key) && "locked")} style={{ width: 96 }}>
                {unlocked.has(open.key) ? <Icon name={ACH_ICON(open.icon)} size={40} /> : <span className="display" style={{ fontSize: 32, fontWeight: 800 }}>?</span>}
              </div>
              <h2 className="mt-4">{open.title}</h2>
              <p className="mt-1 text-muted">{open.desc}</p>
              <div className="reward justify-center mt-3"><Icon name="gem" size={16} />+{open.gems} za odblokowanie</div>
              <Btn3d variant="gold" className="mt-5" onClick={() => setOpen(null)}>OK</Btn3d>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
