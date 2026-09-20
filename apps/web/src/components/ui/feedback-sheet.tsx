"use client";
import { MASCOT_LINES } from "@nauka/shared";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { AnimatePresence, m } from "@/lib/motion";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon } from "@/components/ui/icons";
import { Mascot } from "@/components/mascot/mascot";

export interface Feedback {
  ok: boolean;
  /** explanation (HTML allowed via `html`) */
  text?: ReactNode;
  /** XP earned for this answer (after combo), and the multiplier applied */
  xp?: number;
  mult?: 1 | 2 | 3;
  /** hearts lost (wrong answer) */
  heart?: boolean;
  /** override the button label */
  cta?: string;
}

/** Bottom sheet after an answer: mascot happy/sad, title, explanation, "+N XP ×M" chip, 3D DALEJ. */
export function FeedbackSheet({ fb, onNext, streak = 0 }: { fb: Feedback | null; onNext: () => void; streak?: number }) {
  // deterministic pick (no Math.random in render): varies with the answer's XP / text
  const line = useMemo(() => {
    if (!fb) return "";
    const pool = MASCOT_LINES[fb.ok ? "happy" : "sad"];
    const seed = (fb.xp ?? 0) + String(fb.text ?? "").length;
    return pool[seed % pool.length] ?? "";
  }, [fb]);
  // DALEJ fires once per feedback — a second tap during the exit animation must not advance twice
  const fired = useRef(false);
  useEffect(() => {
    fired.current = false;
  }, [fb]);
  const go = () => {
    if (fired.current) return;
    fired.current = true;
    onNext();
  };
  return (
    <AnimatePresence>
      {fb && (
        <m.div
          key="sheet"
          className={`sheet ${fb.ok ? "ok" : "bad"}`}
          role="status"
          aria-live="polite"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%", pointerEvents: "none" }}
          transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.9 }}
        >
          <div className="flex items-start gap-3">
            <Mascot state={fb.ok ? "happy" : "sad"} size={64} streak={streak} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="sh-title">{fb.ok ? "Dobrze!" : "Nie tym razem"}</div>
                <div className="flex gap-1.5">
                  {fb.ok && fb.xp !== undefined && (
                    <m.span className="xpchip" initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 16, delay: 0.15 }}>
                      <Icon name="bolt" size={14} />+{fb.xp} XP{fb.mult && fb.mult > 1 ? ` ×${fb.mult}` : ""}
                    </m.span>
                  )}
                  {!fb.ok && fb.heart && (
                    <m.span className="xpchip heart" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 16, delay: 0.15 }}>
                      <Icon name="heart" size={14} />−1
                    </m.span>
                  )}
                </div>
              </div>
              <div className="sh-text">
                {fb.text ? fb.text : line}
              </div>
            </div>
          </div>
          <Btn3d variant={fb.ok ? "green" : "red"} className="mt-4" onClick={go} autoFocus>
            {fb.cta ?? "Dalej"}
          </Btn3d>
        </m.div>
      )}
    </AnimatePresence>
  );
}
