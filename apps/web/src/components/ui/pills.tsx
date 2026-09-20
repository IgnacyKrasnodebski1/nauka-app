"use client";
import { HEARTS_MAX, formatCountdown, type HeartsView } from "@nauka/shared";
import { AnimatePresence, m } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { StreakFlame } from "@/components/ui/streak-flame";

/** Streak pill: animated flame + day count (grey when no streak). */
export function StreakPill({ days, size = "md" }: { days: number; size?: "md" | "lg" }) {
  return (
    <span className={cn("hudpill pill-flame", days === 0 && "off", size === "lg" && "lg")} title="seria dni">
      <StreakFlame streak={days} size={size === "lg" ? 26 : 20} />
      <b>{days}</b>
    </span>
  );
}

/** Gems pill with a pop on change. */
export function Gems({ n, size = "md" }: { n: number; size?: "md" | "lg" }) {
  return (
    <span className={cn("hudpill pill-gem", size === "lg" && "lg")} title="klejnoty">
      <Icon name="gem" size={size === "lg" ? 22 : 18} />
      <AnimatePresence mode="popLayout" initial={false}>
        <m.b key={n} initial={{ scale: 1.5, y: -6, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
          {n}
        </m.b>
      </AnimatePresence>
    </span>
  );
}

/** Hearts: 5 hearts or ∞ for Pro. `compact` = count only. */
export function Hearts({ view, compact, size = "md", showTimer }: { view: HeartsView; compact?: boolean; size?: "md" | "lg"; showTimer?: boolean }) {
  const s = size === "lg" ? 22 : 18;
  if (view.unlimited)
    return (
      <span className={cn("hudpill pill-heart", size === "lg" && "lg")} title="nieskończone serca (Pro)">
        <Icon name="heart" size={s} />
        <Icon name="infinity" size={s} />
      </span>
    );
  if (compact)
    return (
      <span className={cn("hudpill pill-heart", size === "lg" && "lg")} title="serca">
        <Icon name="heart" size={s} />
        <AnimatePresence mode="popLayout" initial={false}>
          <m.b key={view.hearts} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
            {view.hearts}
          </m.b>
        </AnimatePresence>
      </span>
    );
  return (
    <span className={cn("hudpill pill-heart", size === "lg" && "lg")} title={`${view.hearts} z ${HEARTS_MAX} serc`}>
      <span className="hearts-row" aria-label={`${view.hearts} z ${HEARTS_MAX} serc`}>
        {Array.from({ length: HEARTS_MAX }, (_, i) => (
          <m.span key={i} animate={{ scale: i < view.hearts ? 1 : 0.85, opacity: i < view.hearts ? 1 : 0.28 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} style={{ display: "inline-flex" }}>
            <Icon name="heart" size={s} />
          </m.span>
        ))}
      </span>
      {showTimer && view.nextInMs !== null && <small style={{ color: "var(--muted)", fontSize: 11, fontWeight: 800 }}>+1 za {formatCountdown(view.nextInMs)}</small>}
    </span>
  );
}

export function XpPill({ n, size = "md" }: { n: number; size?: "md" | "lg" }) {
  return (
    <span className={cn("hudpill pill-xp", size === "lg" && "lg")} title="XP">
      <Icon name="bolt" size={size === "lg" ? 22 : 18} />
      <b>{n}</b>
    </span>
  );
}
