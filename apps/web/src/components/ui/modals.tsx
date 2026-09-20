"use client";
import { GEM_COSTS, formatCountdown, type Achievement, type HeartsView, type Rank } from "@nauka/shared";
import { useEffect, useRef } from "react";
import { AnimatePresence, m } from "@/lib/motion";
import { burst } from "@/lib/confetti";
import { useSfx } from "@/lib/sfx";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon } from "@/components/ui/icons";
import { ACH_ICON } from "@/components/ui/badges-grid";
import { Mascot } from "@/components/mascot/mascot";

function Overlay({ children, onClose, label }: { children: React.ReactNode; onClose?: () => void; label: string }) {
  return (
    <m.div className="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} role="dialog" aria-modal="true" aria-label={label}>
      <m.div initial={{ y: 40, scale: 0.94, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 24 }} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440 }}>
        {children}
      </m.div>
    </m.div>
  );
}

/** New rank reached. */
export function LevelUpModal({ rank, onClose, streak = 0 }: { rank: Rank | null; onClose: () => void; streak?: number }) {
  const sfx = useSfx();
  const tier = rank?.tier ?? null;
  const color = rank?.color;
  useEffect(() => {
    if (tier === null) return;
    sfx.play("levelup");
    burst("levelup", color);
  }, [tier, color, sfx]);
  return (
    <AnimatePresence>
      {rank && (
        <Overlay label="Nowa ranga" onClose={onClose}>
          <div className="card3d soft-gold text-center" style={{ "--cd": rank.color } as React.CSSProperties}>
            <Mascot state="cheer" size={110} streak={streak} />
            <div className="eyebrow mt-2" style={{ color: rank.color }}>Nowa ranga</div>
            <h2 className="mt-1" style={{ fontSize: 32 }}>{rank.name}</h2>
            <p className="mt-2 text-muted">Twoje XP przebiło próg {rank.min}. Tak trzymaj, następny poziom już się ładuje.</p>
            <Btn3d variant="gold" className="mt-5" onClick={onClose}>Lecimy dalej</Btn3d>
          </div>
        </Overlay>
      )}
    </AnimatePresence>
  );
}

/** No hearts: wait / refill for gems / go Pro. */
export function NoHeartsModal({ open, hearts, gems, onRefill, onClose, proHref = "/app/account", backHref }: { open: boolean; hearts: HeartsView; gems: number; onRefill: () => boolean; onClose: () => void; proHref?: string; backHref?: string }) {
  const canRefill = gems >= GEM_COSTS.heartRefill;
  return (
    <AnimatePresence>
      {open && (
        <Overlay label="Brak serc">
          <div className="card3d soft-red text-center">
            <Mascot state="sad" size={100} />
            <h2 className="mt-2" style={{ fontSize: 26 }}>Serca się skończyły</h2>
            <p className="mt-2 text-muted">{hearts.nextInMs !== null ? `Następne serce za ${formatCountdown(hearts.nextInMs)}. Możesz poczekać, uzupełnić za klejnoty albo przejść na Pro.` : "Uzupełnij serca, żeby zacząć lekcję."}</p>
            <div className="flex justify-center gap-1.5 my-4" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <Icon key={i} name="heart" size={26} style={{ color: i < hearts.hearts ? "var(--play-red)" : "var(--bg4)" }} />
              ))}
            </div>
            <Btn3d variant="red" onClick={() => onRefill() && onClose()} disabled={!canRefill}>
              <Icon name="gem" size={16} />Uzupełnij za {GEM_COSTS.heartRefill}{!canRefill ? ` (masz ${gems})` : ""}
            </Btn3d>
            <Btn3d variant="purple" className="mt-2.5" href={proHref}>
              <Icon name="infinity" size={18} />Pro: nieskończone serca
            </Btn3d>
            <Btn3d variant="ghost" className="mt-2.5" href={backHref} onClick={backHref ? undefined : onClose}>
              Poczekam
            </Btn3d>
          </div>
        </Overlay>
      )}
    </AnimatePresence>
  );
}

/** Unlocked badge toast (bottom sheet style, tap to dismiss, auto-dismiss 4 s). */
export function AchievementToast({ achievement, onClose }: { achievement: Achievement | null; onClose: () => void }) {
  const sfx = useSfx();
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  const key = achievement?.key ?? null;
  useEffect(() => {
    if (!key) return;
    sfx.play("chest");
    burst("small", "#FFC800");
    const t = setTimeout(() => close.current(), 4200);
    return () => clearTimeout(t);
  }, [key, sfx]);
  return (
    <AnimatePresence>
      {achievement && (
        <m.button
          type="button"
          key={achievement.key}
          className="card3d soft-gold press"
          style={{ position: "fixed", left: "50%", top: 16, x: "-50%", zIndex: 95, width: "calc(100% - 32px)", maxWidth: 420, display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}
          initial={{ y: -80, opacity: 0, x: "-50%" }}
          animate={{ y: 0, opacity: 1, x: "-50%" }}
          exit={{ y: -80, opacity: 0, x: "-50%" }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          onClick={onClose}
          aria-live="polite"
        >
          <span className="badge-tile" style={{ width: 56, flex: "none", aspectRatio: "1" }}>
            <Icon name={ACH_ICON(achievement.icon)} size={26} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="eyebrow block" style={{ color: "var(--play-yellow)" }}>Odznaka odblokowana</span>
            <span className="display block font-extrabold text-txt text-[17px] leading-tight">{achievement.title}</span>
            <span className="block text-muted text-[12.5px] mt-0.5 truncate">{achievement.desc}</span>
          </span>
          <span className="reward"><Icon name="gem" size={14} />+{achievement.gems}</span>
        </m.button>
      )}
    </AnimatePresence>
  );
}
