"use client";
import { useMemo, useRef, useState } from "react";
import { shuffle, type TrueFalseGame } from "@nauka/shared";
import { cn } from "@/lib/utils";

/** True/false: tap the buttons or swipe the card (right = prawda, left = fałsz). */
export function TrueFalseGameView({ game, onDone }: { game: TrueFalseGame; onDone: (correct: number, total: number) => void }) {
  const items = useMemo(() => shuffle(game.items).slice(0, 8), [game]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [swipe, setSwipe] = useState<"left" | "right" | null>(null);
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const it = items[idx]!;
  const ok = answer !== null && answer === it.v;

  const pick = (v: boolean) => {
    if (answer !== null) return;
    setSwipe(v ? "right" : "left");
    setAnswer(v);
    if (v === it.v) setScore((s) => s + 1);
  };
  const next = () => {
    if (idx + 1 >= items.length) return onDone(score, items.length);
    setIdx((i) => i + 1);
    setAnswer(null);
    setSwipe(null);
    setDx(0);
  };

  return (
    <div>
      <div className="exprompt">{game.title || "Prawda czy fałsz?"} · {idx + 1}/{items.length}</div>
      <p className="text-muted text-sm mb-3">Przesuń kartę albo tapnij.</p>
      <div
        className={cn("tfcard", swipe && `swipe-${swipe}`)}
        style={!swipe ? { transform: `translateX(${dx}px) rotate(${dx / 20}deg)` } : undefined}
        onPointerDown={(e) => { if (answer === null) { startX.current = e.clientX; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } }}
        onPointerMove={(e) => { if (startX.current !== null && answer === null) setDx(e.clientX - startX.current); }}
        onPointerUp={() => { if (startX.current === null) return; const d = dx; startX.current = null; if (Math.abs(d) > 80) pick(d > 0); else setDx(0); }}
        onPointerCancel={() => { startX.current = null; setDx(0); }}
      >
        {it.s}
      </div>
      <div className="fbtns mt-3">
        <button type="button" className="fbtn no" onClick={() => pick(false)} disabled={answer !== null}>← Fałsz</button>
        <button type="button" className="fbtn yes" onClick={() => pick(true)} disabled={answer !== null}>Prawda →</button>
      </div>
      {answer !== null && (
        <>
          <div className={cn("exfb", ok ? "ok" : "bad")} role="status">{ok ? "Zgadza się." : `To ${it.v ? "prawda" : "fałsz"}.`}{it.e ? ` ${it.e}` : ""}</div>
          <button type="button" className="pill mt-3 pop" onClick={next}>{idx + 1 >= items.length ? "Dalej" : "Następne"}</button>
        </>
      )}
    </div>
  );
}
