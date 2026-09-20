"use client";
import type { QuizQuestion } from "@nauka/shared";
import { m } from "@/lib/motion";
import { KEYS, cn } from "@/lib/utils";

/** Multiple-choice: 3D answer tiles. `reveal` shows correct/wrong state (lesson & quiz); exam uses reveal=false. `explain` shows the inline explanation (off when a feedback sheet handles it). */
export function QuestionCard({ q, tag, picked, reveal, onPick, children, explain = true, animKey }: { q: QuizQuestion; tag?: string; picked: number | null; reveal: boolean; onPick: (i: number) => void; children?: React.ReactNode; explain?: boolean; animKey?: string | number }) {
  return (
    <m.div className="qcard" key={animKey} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}>
      {tag && <span className="tag">{tag}</span>}
      <div className="qq">{q.q}</div>
      <div className="opts" role="group" aria-label="Odpowiedzi">
        {q.a.map((o, i) => {
          const state = reveal ? (i === q.c ? "correct" : i === picked ? "wrong" : "dim") : picked === i ? "sel" : "";
          return (
            <m.button key={i} type="button" className={cn("opt", state)} disabled={reveal} onClick={() => onPick(i)} aria-pressed={picked === i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}>
              <span className="k" aria-hidden="true">{KEYS[i]}</span>
              <span>{o}</span>
            </m.button>
          );
        })}
      </div>
      {reveal && explain && <div className="explain pop" role="status"><b>Dlaczego:</b> {q.e}</div>}
      {children}
    </m.div>
  );
}
