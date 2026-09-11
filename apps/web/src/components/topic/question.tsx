"use client";
import type { QuizQuestion } from "@nauka/shared";
import { KEYS, cn } from "@/lib/utils";

/** Multiple-choice card. `reveal` shows correct/wrong state (lesson & quiz); exam uses reveal=false. */
export function QuestionCard({ q, tag, picked, reveal, onPick, children }: { q: QuizQuestion; tag?: string; picked: number | null; reveal: boolean; onPick: (i: number) => void; children?: React.ReactNode }) {
  return (
    <div className="qcard">
      {tag && <span className="tag">{tag}</span>}
      <div className="qq">{q.q}</div>
      <div className="opts" role="group" aria-label="Odpowiedzi">
        {q.a.map((o, i) => {
          const state = reveal ? (i === q.c ? "correct" : i === picked ? "wrong" : "dim") : picked === i ? "sel" : "";
          return (
            <button key={i} type="button" className={cn("opt", state)} disabled={reveal} onClick={() => onPick(i)} aria-pressed={picked === i}>
              <span className="k" aria-hidden="true">{KEYS[i]}</span>
              <span>{o}</span>
            </button>
          );
        })}
      </div>
      {reveal && <div className="explain" role="status"><b>czemu:</b> {q.e}</div>}
      {children}
    </div>
  );
}
