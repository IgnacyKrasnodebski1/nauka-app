"use client";
import { animate, useMotionValue, useTransform } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m, useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type SwipeDir = "left" | "right" | "up";

export interface SwipeDeckProps<T> {
  items: T[];
  /** current index; the deck renders `items[index]` on top and the next two behind */
  index: number;
  keyOf: (item: T, i: number) => string;
  render: (item: T, opts: { top: boolean; flipped: boolean; flip: () => void }) => ReactNode;
  onSwipe: (dir: SwipeDir, item: T) => void;
  /** allow swiping up (third grade) */
  allowUp?: boolean;
  labels?: { left: string; right: string; up?: string };
  className?: string;
  /** programmatic swipe (buttons) — pass a counter+dir */
  command?: { n: number; dir: SwipeDir } | null;
  /** flip card on tap (default true) */
  flippable?: boolean;
}

const OUT = 560;

/**
 * Swipeable card stack (motion drag). Right = yes, left = no, up = easy. Tint + stamp follow the drag,
 * the card flies out and the next one springs into place. Also drives from `command` for on-screen buttons.
 */
export function SwipeDeck<T>({ items, index, keyOf, render, onSwipe, allowUp, labels = { left: "Jeszcze nie", right: "Umiem", up: "Łatwe" }, className, command, flippable = true }: SwipeDeckProps<T>) {
  const reduced = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const [leaving, setLeaving] = useState<{ key: string; dir: SwipeDir } | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const yesOp = useTransform(x, [30, 120], [0, 1]);
  const noOp = useTransform(x, [-30, -120], [0, 1]);
  const upOp = useTransform(y, [-30, -110], [0, 1]);
  const tintYes = useTransform(x, [0, 120], ["rgba(88,204,2,0)", "rgba(88,204,2,0.22)"]);
  const tintNo = useTransform(x, [0, -120], ["rgba(255,75,75,0)", "rgba(255,75,75,0.22)"]);
  const tintUp = useTransform(y, [0, -110], ["rgba(28,176,246,0)", "rgba(28,176,246,0.22)"]);
  const item = items[index];
  const key = item !== undefined ? keyOf(item, index) : "";
  const lastCmd = useRef(0);
  const dragging = useRef(false);

  // new top card: unflip (adjust-state-during-render) and reset the drag offsets before paint
  const [seenKey, setSeenKey] = useState(key);
  if (seenKey !== key) {
    setSeenKey(key);
    setFlipped(false);
  }
  useLayoutEffect(() => {
    x.set(0);
    y.set(0);
  }, [key, x, y]);

  const fly = (dir: SwipeDir) => {
    if (item === undefined || leaving) return;
    setLeaving({ key, dir });
    // drive the shared motion values off-screen, then snap them back before the next card takes over
    const dur = reduced ? 0 : 0.22;
    if (dir === "up") animate(y, -OUT, { duration: dur, ease: "easeIn" });
    else animate(x, dir === "right" ? OUT : -OUT, { duration: dur, ease: "easeIn" });
    setTimeout(() => {
      x.stop();
      y.stop();
      x.jump(0);
      y.jump(0);
      onSwipe(dir, item);
      setLeaving(null);
    }, dur * 1000 + 10);
  };

  useEffect(() => {
    if (!command || command.n === lastCmd.current) return;
    lastCmd.current = command.n;
    fly(command.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  if (item === undefined) return <div className={cn("deck", className)} />;

  return (
    <div className={cn("deck", className)}>
      {/* two ghost cards behind */}
      {[2, 1].map((k) => (items[index + k] !== undefined ? <m.div key={`ghost${k}`} className="deckcard" style={{ pointerEvents: "none" }} animate={{ scale: 1 - k * 0.04, y: k * 12, opacity: 1 - k * 0.3 }} transition={{ type: "spring", stiffness: 300, damping: 26 }} /> : null))}
      <AnimatePresence initial={false}>
        <m.div
          key={key}
          className="deckcard"
          style={{ x, y, rotate, zIndex: 3 }}
          initial={{ scale: 0.94, opacity: 0.9 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.06 } }}
          transition={{ type: "spring", stiffness: 340, damping: 26 }}
          drag={leaving ? false : allowUp ? true : "x"}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.9}
          dragMomentum={false}
          onDragStart={() => (dragging.current = true)}
          onDragEnd={(_, info) => {
            setTimeout(() => (dragging.current = false), 50);
            const dx = info.offset.x, dy = info.offset.y;
            if (allowUp && dy < -110 && Math.abs(dy) > Math.abs(dx)) return fly("up");
            if (dx > 110) return fly("right");
            if (dx < -110) return fly("left");
            animate(x, 0, { type: "spring", stiffness: 400, damping: 28 });
            animate(y, 0, { type: "spring", stiffness: 400, damping: 28 });
          }}
          onClick={() => {
            if (dragging.current || !flippable) return;
            setFlipped((f) => !f);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              if (flippable) setFlipped((f) => !f);
            }
            if (e.key === "ArrowRight") fly("right");
            if (e.key === "ArrowLeft") fly("left");
            if (e.key === "ArrowUp" && allowUp) fly("up");
          }}
          aria-label="Karta — przeciągnij w prawo (umiem), w lewo (jeszcze nie)"
        >
          <m.div className="tint" style={{ background: tintYes, opacity: yesOp }} />
          <m.div className="tint" style={{ background: tintNo, opacity: noOp }} />
          {allowUp && <m.div className="tint" style={{ background: tintUp, opacity: upOp }} />}
          <m.div className="stamp yes" style={{ opacity: yesOp }}>{labels.right}</m.div>
          <m.div className="stamp no" style={{ opacity: noOp }}>{labels.left}</m.div>
          {allowUp && <m.div className="stamp easy" style={{ opacity: upOp }}>{labels.up}</m.div>}
          {render(item, { top: true, flipped, flip: () => setFlipped((f) => !f) })}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
