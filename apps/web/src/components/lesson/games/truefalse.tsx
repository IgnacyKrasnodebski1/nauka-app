"use client";
import { useMemo, useState } from "react";
import { shuffle, type TrueFalseGame } from "@nauka/shared";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon } from "@/components/ui/icons";
import { SwipeDeck, type SwipeDir } from "@/components/ui/swipe-deck";
import type { GameProps } from "@/components/lesson/games";

/** True/false as a swipe deck (right = prawda, left = fałsz) with 3D buttons as an alternative. */
export function TrueFalseGameView({ game, onAnswer, onDone }: GameProps<TrueFalseGame>) {
  const items = useMemo(() => shuffle(game.items).slice(0, 8), [game]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [locked, setLocked] = useState(false);
  const [cmd, setCmd] = useState<{ n: number; dir: SwipeDir } | null>(null);

  const answer = (v: boolean) => {
    if (locked) return;
    setLocked(true);
    const it = items[idx]!;
    const correct = v === it.v;
    const s = score + (correct ? 1 : 0);
    if (correct) setScore(s);
    onAnswer(correct, <>{correct ? "Zgadza się." : <>To <b>{it.v ? "prawda" : "fałsz"}</b>.</>}{it.e ? ` ${it.e}` : ""}</>, () => {
      setLocked(false);
      if (idx + 1 >= items.length) return onDone(s, items.length);
      setIdx((i) => i + 1);
    });
  };

  return (
    <div>
      <div className="exprompt">{game.title || "Prawda czy fałsz?"} · {idx + 1}/{items.length}</div>
      <p className="text-muted text-sm mb-3 font-semibold">Przesuń kartę albo tapnij przycisk.</p>
      <SwipeDeck
        items={items}
        index={idx}
        keyOf={(_, i) => `tf${i}`}
        flippable={false}
        labels={{ left: "Fałsz", right: "Prawda" }}
        command={cmd}
        onSwipe={(dir) => answer(dir === "right")}
        render={(it) => (
          <div className="term" style={{ fontSize: 22 }}>{it.s}</div>
        )}
        className="!h-[240px] !min-h-[240px]"
      />
      <div className="fbtns mt-4">
        <Btn3d variant="red" onClick={() => !locked && setCmd({ n: Date.now(), dir: "left" })} disabled={locked}><Icon name="close" size={16} />Fałsz</Btn3d>
        <Btn3d variant="green" onClick={() => !locked && setCmd({ n: Date.now(), dir: "right" })} disabled={locked}><Icon name="check" size={16} />Prawda</Btn3d>
      </div>
    </div>
  );
}
