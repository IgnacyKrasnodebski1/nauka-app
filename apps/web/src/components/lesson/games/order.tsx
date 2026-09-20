"use client";
import { useMemo, useState } from "react";
import { shuffle, type OrderGame } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon } from "@/components/ui/icons";
import type { GameProps } from "@/components/lesson/games";

/** Put steps in order: tap the arrows (touch) or drag with the mouse. One answer = the whole sequence. */
export function OrderGameView({ game, onAnswer, onDone }: GameProps<OrderGame>) {
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
  const check = () => {
    setChecked(true);
    const all = correct === steps.length;
    onAnswer(all, all ? "Idealna kolejność." : <>{correct}/{steps.length} na miejscu. Dobra kolejność: {steps.map((s, i) => `${i + 1}. ${s}`).join(" → ")}</>, () => onDone(correct, steps.length));
  };

  return (
    <div>
      <div className="exprompt">{game.title || "Ułóż w kolejności"}</div>
      <div className="exq !text-[18px]">{game.prompt}</div>
      <ol className="orderlist">
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
                <button type="button" aria-label="W górę" onClick={() => move(pos, pos - 1)} disabled={pos === 0}><Icon name="arrow-up" size={12} /></button>
                <button type="button" aria-label="W dół" onClick={() => move(pos, pos + 1)} disabled={pos === order.length - 1}><Icon name="arrow-down" size={12} /></button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!checked && <Btn3d variant="green" className="mt-4" onClick={check}>Sprawdź</Btn3d>}
    </div>
  );
}
