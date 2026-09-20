"use client";
import { useMemo, useState } from "react";
import { shuffle, type MatchGame } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { useSfx } from "@/lib/sfx";
import type { GameProps } from "@/components/lesson/games";

/** Tap-to-match pairs: pick left, pick right. Each matched pair counts as a correct answer (combo); misses shake. */
export function MatchGameView({ game, onAnswer, onDone }: GameProps<MatchGame>) {
  const sfx = useSfx();
  const pairs = useMemo(() => game.pairs.slice(0, 6), [game]);
  const left = useMemo(() => shuffle(pairs.map((p, i) => ({ i, t: p.l }))), [pairs]);
  const right = useMemo(() => shuffle(pairs.map((p, i) => ({ i, t: p.r }))), [pairs]);
  const [selL, setSelL] = useState<number | null>(null);
  const [selR, setSelR] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [bad, setBad] = useState<[number, number] | null>(null);
  const [misses, setMisses] = useState(0);

  const attempt = (l: number | null, r: number | null) => {
    if (l === null || r === null) return;
    if (l === r) {
      const n = new Set(done);
      n.add(l);
      setDone(n);
      setSelL(null);
      setSelR(null);
      onAnswer(true, null, () => {});
      if (n.size === pairs.length) setTimeout(() => onDone(Math.max(0, pairs.length - misses), pairs.length), 380);
    } else {
      sfx.play("wrong");
      setMisses((m) => m + 1);
      setBad([l, r]);
      setTimeout(() => {
        setBad(null);
        setSelL(null);
        setSelR(null);
      }, 350);
    }
  };
  const trunc = (t: string) => (t.length > 70 ? t.slice(0, 68) + "…" : t);

  return (
    <div>
      <div className="exprompt">{game.title || "Połącz w pary"}</div>
      <p className="text-muted text-sm mb-3 font-semibold">Tapnij z lewej, potem z prawej.</p>
      <div className="matchwrap">
        <div className="mcol">
          {left.map((o) => (
            <button type="button" key={"l" + o.i} className={cn("mitem", done.has(o.i) && "done", selL === o.i && "sel", bad?.[0] === o.i && "bad")} onClick={() => { sfx.play("tap"); setSelL(o.i); attempt(o.i, selR); }} disabled={done.has(o.i)}>{trunc(o.t)}</button>
          ))}
        </div>
        <div className="mcol">
          {right.map((o) => (
            <button type="button" key={"r" + o.i} className={cn("mitem", done.has(o.i) && "done", selR === o.i && "sel", bad?.[1] === o.i && "bad")} onClick={() => { sfx.play("tap"); setSelR(o.i); attempt(selL, o.i); }} disabled={done.has(o.i)}>{trunc(o.t)}</button>
          ))}
        </div>
      </div>
      <div className="counter mt-3">{done.size}/{pairs.length} par · pomyłki: {misses}</div>
    </div>
  );
}
