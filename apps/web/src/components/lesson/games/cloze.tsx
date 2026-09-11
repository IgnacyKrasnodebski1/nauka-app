"use client";
import { useMemo, useState } from "react";
import { shuffle, type ClozeGame } from "@nauka/shared";
import { cn } from "@/lib/utils";

/** Fill the gap: pick one option. */
export function ClozeGameView({ game, onDone }: { game: ClozeGame; onDone: (correct: number, total: number) => void }) {
  const items = useMemo(() => game.items.slice(0, 8), [game]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const it = items[idx]!;
  const options = useMemo(() => shuffle([...new Set([it.answer, ...it.options])]), [it]);
  const ok = picked !== null && picked.trim().toLowerCase() === it.answer.trim().toLowerCase();
  const parts = it.s.split("___");

  const next = () => {
    if (idx + 1 >= items.length) return onDone(score, items.length);
    setIdx((i) => i + 1);
    setPicked(null);
  };

  return (
    <div>
      <div className="exprompt">{game.title || "Uzupełnij lukę"} · {idx + 1}/{items.length}</div>
      <div className="exq">
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < parts.length - 1 && (
              <span className={cn("inline-block min-w-[70px] border-b-2 px-1 mx-1 text-center", picked === null ? "border-white/40" : ok ? "border-green text-green" : "border-red text-red")}>{picked ?? " "}</span>
            )}
          </span>
        ))}
      </div>
      <div className="tiles" role="group" aria-label="Opcje">
        {options.map((o) => (
          <button type="button" key={o} className={cn("tile", picked !== null && o === it.answer && "ok", picked === o && !ok && "bad")} disabled={picked !== null} onClick={() => { setPicked(o); if (o.trim().toLowerCase() === it.answer.trim().toLowerCase()) setScore((s) => s + 1); }}>{o}</button>
        ))}
      </div>
      {picked !== null && (
        <>
          <div className={cn("exfb", ok ? "ok" : "bad")} role="status">{ok ? "✅ Dokładnie tak." : <>Poprawnie: <b>{it.answer}</b></>}{it.e ? ` ${it.e}` : ""}</div>
          <button type="button" className="pill mt-3 pop" onClick={next}>{idx + 1 >= items.length ? "dalej →" : "następne →"}</button>
        </>
      )}
    </div>
  );
}
