"use client";
import { useState, type ReactNode } from "react";
import type { QuizQuestion } from "@nauka/shared";
import { KEYS } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Foot, OptKey, useKeys, type TaskApi } from "@/components/tasks/common";

export interface SessionChipsOpts {
  combo?: number;
  broken?: boolean;
  tag?: string;
  boost?: boolean;
}
/** Combo / "Combo zerwane" / ×2 XP / tag / "Pytanie N z M" chips (legacy sessionChips). */
export function SessionChips({ o, word, n, total }: { o: SessionChipsOpts; word: string; n: number; total: number }) {
  return (
    <>
      {(o.combo ?? 0) >= 2 ? <span className="combo a-pop">Combo x{o.combo}</span> : o.broken ? <span className="combo bad">Combo zerwane</span> : null}
      {o.boost && <span className="combo boost">×2 XP</span>}
      {o.tag && <span className="qn">{o.tag}</span>}
      <span className="qn">{word} {n} z {total}</span>
    </>
  );
}

/**
 * Question + 3D tiles with a letter + SPRAWDŹ (Quiz.html). Selecting highlights and enables the check; after the check
 * tiles turn correct / wrong (.a-shake) / dim. Keys: 1-5 / A-E, Enter. `noCheck` (exam) = tap toggles selection only.
 */
export function QuizBlock({ q, chips, api, onAnswer, before, sm }: { q: QuizQuestion; chips: ReactNode; api: TaskApi; onAnswer: (i: number, ok: boolean) => void; before?: ReactNode; sm?: boolean }) {
  const [sel, setSel] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const select = (i: number) => {
    if (done || i >= q.a.length) return;
    setSel(i);
  };
  const check = () => {
    if (done || sel == null) return;
    setDone(true);
    onAnswer(sel, sel === q.c);
  };
  useKeys((e) => {
    const k = (e.key || "").toLowerCase();
    const m = /^[1-5]$/.test(k) ? +k - 1 : "abcde".indexOf(k);
    if (k.length === 1 && m >= 0 && m < q.a.length) select(m);
    else if (e.key === "Enter" && sel != null) {
      e.preventDefault();
      check();
    }
  });
  return (
    <>
      <div className="quiz">
        {before}
        <div className="qchips">{chips}</div>
        <div className={cn("qq a-up", done && "muted")}>{q.q}</div>
        <div className="qopts">
          {q.a.map((a, i) => {
            const state = !done ? (sel === i ? "sel" : "") : i === q.c ? "correct" : i === sel ? "wrong" : "dim";
            const anim = !done ? `a-up d${Math.min(6, i + 1)}` : i === q.c ? (sel === q.c ? "a-pop" : "a-glow") : i === sel ? "a-shake" : "";
            return (
              <button key={i} type="button" className={cn("qopt", sm && "sm", state, anim)} disabled={done} data-i={i} onClick={() => select(i)} aria-pressed={sel === i}>
                <OptKey i={i} state={state} />
                <span className="t">{a}</span>
              </button>
            );
          })}
        </div>
      </div>
      <Foot api={api}>
        <button type="button" className={cn("pill qcheck", done && "hide")} disabled={sel == null || done} onClick={check}>SPRAWDŹ</button>
      </Foot>
    </>
  );
}

export { KEYS };
