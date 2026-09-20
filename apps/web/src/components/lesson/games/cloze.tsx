"use client";
import { useMemo, useState } from "react";
import { shuffle, type ClozeGame } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { m } from "@/lib/motion";
import type { GameProps } from "@/components/lesson/games";

/** Fill the gap: pick one 3D tile. Feedback goes through the lesson sheet. */
export function ClozeGameView({ game, onAnswer, onDone }: GameProps<ClozeGame>) {
  const items = useMemo(() => game.items.slice(0, 8), [game]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const it = items[idx]!;
  const options = useMemo(() => shuffle([...new Set([it.answer, ...it.options])]), [it]);
  const ok = picked !== null && picked.trim().toLowerCase() === it.answer.trim().toLowerCase();
  const parts = it.s.split("___");

  const pick = (o: string) => {
    if (picked !== null) return;
    setPicked(o);
    const correct = o.trim().toLowerCase() === it.answer.trim().toLowerCase();
    const s = score + (correct ? 1 : 0);
    if (correct) setScore(s);
    onAnswer(correct, <>{correct ? "Dokładnie tak." : <>Poprawnie: <b>{it.answer}</b>.</>}{it.e ? ` ${it.e}` : ""}</>, () => {
      if (idx + 1 >= items.length) return onDone(s, items.length);
      setIdx((i) => i + 1);
      setPicked(null);
    });
  };

  return (
    <div>
      <div className="exprompt">{game.title || "Uzupełnij lukę"} · {idx + 1}/{items.length}</div>
      <m.div key={idx} className="exq" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < parts.length - 1 && <span className={cn("gap", picked !== null && (ok ? "ok" : "bad"))}>{picked ?? " "}</span>}
          </span>
        ))}
      </m.div>
      <div className="tiles" role="group" aria-label="Opcje">
        {options.map((o, i) => (
          <m.button type="button" key={o} className={cn("gtile", picked !== null && o === it.answer && "ok", picked === o && !ok && "bad")} disabled={picked !== null} onClick={() => pick(o)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            {o}
          </m.button>
        ))}
      </div>
    </div>
  );
}
