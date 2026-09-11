"use client";
import { useMemo, useState } from "react";
import { shuffle, type OrderGame } from "@nauka/shared";
import { cn } from "@/lib/utils";

/** Put steps in order: tap ▲/▼ to move (works on touch), or drag with the mouse. */
export function OrderGameView({ game, onDone }: { game: OrderGame; onDone: (correct: number, total: number) => void }) {
  const steps = useMemo(() => game.steps.slice(0, 8), [game]);
  const [order, setOrder] = useState<number[]>(() => {
    let o = shuffle(steps.map((_, i) => i));
    if (steps.length > 1 && o.every((v, i) => v === i)) o = [...o.slice(1), o[0]!];
    return o;
  });
  const [checked, setChecked] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (checked || to < 0 || to >= order.length) return;
    const n = [...order];
    const [x] = n.splice(from, 1);
    n.splice(to, 0, x!);
    setOrder(n);
  };
  const correct = order.filter((v, i) => v === i).length;

  return (
    <div>
      <div className="exprompt">{game.title || "Ułóż w kolejności"}</div>
      <div className="exq !text-[18px]">{game.prompt}</div>
      <ol className="orderlist list-none p-0 m-0">
        {order.map((stepIdx, pos) => (
          <li
            key={stepIdx}
            className={cn("orderitem", checked && (stepIdx === pos ? "ok" : "bad"))}
            draggable={!checked}
            onDragStart={() => setDrag(pos)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (drag !== null) move(drag, pos); setDrag(null); }}
          >
            <span className="n" aria-hidden="true">{pos + 1}</span>
            <span className="flex-1">{steps[stepIdx]}</span>
            {!checked && (
              <span className="mv">
                <button type="button" aria-label="W górę" onClick={() => move(pos, pos - 1)} disabled={pos === 0}>▲</button>
                <button type="button" aria-label="W dół" onClick={() => move(pos, pos + 1)} disabled={pos === order.length - 1}>▼</button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!checked ? (
        <button type="button" className="pill mt-4" onClick={() => setChecked(true)}>sprawdź ✅</button>
      ) : (
        <>
          <div className={cn("exfb", correct === steps.length ? "ok" : "bad")} role="status">{correct === steps.length ? "✅ Idealna kolejność." : `${correct}/${steps.length} na miejscu. Dobra kolejność: ${steps.map((s, i) => `${i + 1}. ${s}`).join(" → ")}`}</div>
          <button type="button" className="pill mt-3 pop" onClick={() => onDone(correct, steps.length)}>dalej →</button>
        </>
      )}
    </div>
  );
}
