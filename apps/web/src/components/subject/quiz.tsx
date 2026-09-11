"use client";
import { useMemo, useState } from "react";
import { allQuiz, shuffle, XP } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { useMounted } from "@/lib/use-mounted";
import type { AppSubject } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QuestionCard } from "@/components/subject/question";

export function QuizTab({ subject }: { subject: AppSubject }) {
  const { addXp, toast } = useApp();
  const mounted = useMounted();
  const [sel, setSel] = useState<Set<string>>(new Set(subject.levels.map((l) => l.id)));
  const [round, setRound] = useState(0);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  // shuffled only after mount so server and client markup match (round bumps re-shuffle)
  const list = useMemo(() => (mounted ? shuffle(allQuiz(subject).filter((q) => sel.has(q.levelId))) : []), [subject, sel, round, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    if (!n.size) return;
    setSel(n);
    setIdx(0);
    setScore(0);
    setPicked(null);
  };
  const allOn = sel.size === subject.levels.length;

  const q = list[idx];
  const pick = (i: number) => {
    if (picked !== null || !q) return;
    setPicked(i);
    if (i === q.c) {
      setScore((s) => s + 1);
      addXp(subject, XP.quizCorrect);
      toast(`GIT +${XP.quizCorrect}xp 🟢`);
    } else toast("mid, czytaj wyjaśnienie 👇");
  };
  const next = () => {
    setPicked(null);
    setIdx((i) => i + 1);
  };
  const restart = () => {
    setRound((r) => r + 1);
    setIdx(0);
    setScore(0);
    setPicked(null);
  };

  return (
    <div>
      <div className="chips" role="group" aria-label="Poziomy w quizie">
        <button type="button" className={cn("chip", allOn && "active")} onClick={() => { setSel(new Set(subject.levels.map((l) => l.id))); restart(); }}>Wszystko 🌀</button>
        {subject.levels.map((l) => (
          <button type="button" key={l.id} className={cn("chip", !allOn && sel.has(l.id) && "active")} onClick={() => toggle(l.id)} aria-pressed={sel.has(l.id)}>{l.title}</button>
        ))}
      </div>
      <div className="progressrow">
        <div className="bar"><i style={{ width: `${list.length ? (idx / list.length) * 100 : 0}%` }} /></div>
        <div className="counter">{Math.min(idx + 1, list.length)}/{list.length}</div>
      </div>
      {!mounted ? (
        <div className="qcard items-center"><span className="spinner" aria-label="losuję pytania…" /></div>
      ) : !q ? (
        <div className="qcard">
          <div className="result">
            <div className="big">{list.length && score / list.length >= 0.7 ? "🔥" : score / Math.max(1, list.length) >= 0.5 ? "😎" : "💀"}</div>
            <h2>Wynik</h2>
            <div className="score">Trafione <b>{score}/{list.length}</b> ({list.length ? Math.round((score / list.length) * 100) : 0}%)</div>
            <p>{score / Math.max(1, list.length) >= 0.7 ? "Solidnie ogarniasz ten przedmiot." : score / Math.max(1, list.length) >= 0.5 ? "Spoko, ale przejedź jeszcze fiszki." : "Wróć do fiszek i ścieżki, potem tu wróć."}</p>
            <button type="button" className="pill" onClick={restart}>jeszcze raz 🔁</button>
          </div>
        </div>
      ) : (
        <QuestionCard q={q} tag={q.lvl} picked={picked} reveal={picked !== null} onPick={pick}>
          {picked !== null && (
            <button type="button" className="pill mt-4 pop" onClick={next}>{idx + 1 >= list.length ? "wynik 🏁" : "dalej →"}</button>
          )}
        </QuestionCard>
      )}
    </div>
  );
}
