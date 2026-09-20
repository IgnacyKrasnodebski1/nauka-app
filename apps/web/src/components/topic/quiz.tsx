"use client";
import { useMemo, useState } from "react";
import { allQuiz, shuffle, XP, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { useMounted } from "@/lib/use-mounted";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { QuestionCard } from "@/components/topic/question";
import { Btn3d } from "@/components/ui/btn3d";
import { FeedbackSheet, type Feedback } from "@/components/ui/feedback-sheet";
import { Ring } from "@/components/ui/ring";
import { Mascot } from "@/components/mascot/mascot";

/** Free practice quiz over chosen levels — no hearts, no combo, XP per correct answer. */
export function QuizTab({ topic }: { topic: Topic }) {
  const { addXp, questEvent, streak } = useApp();
  const sfx = useSfx();
  const mounted = useMounted();
  const [sel, setSel] = useState<Set<string>>(new Set(topic.levels.map((l) => l.id)));
  const [round, setRound] = useState(0);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  // shuffled only after mount so server and client markup match (round bumps re-shuffle)
  const list = useMemo(() => (mounted ? shuffle(allQuiz(topic).filter((q) => sel.has(q.levelId))) : []), [topic, sel, round, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  const restart = () => {
    setRound((r) => r + 1);
    setIdx(0);
    setScore(0);
    setPicked(null);
    setFb(null);
  };
  const toggle = (id: string) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    if (!n.size) return;
    setSel(n);
    restart();
  };
  const allOn = sel.size === topic.levels.length;
  const q = list[idx];
  const pick = (i: number) => {
    if (picked !== null || !q) return;
    setPicked(i);
    const ok = i === q.c;
    questEvent({ type: "answer", correct: ok, combo: 0 });
    if (ok) {
      setScore((s) => s + 1);
      addXp(topic.id, XP.quizCorrect);
      sfx.play("correct");
    } else sfx.play("wrong");
    setFb({ ok, text: <><b>Dlaczego:</b> {q.e}</>, xp: XP.quizCorrect, mult: 1, cta: idx + 1 >= list.length ? "Zobacz wynik" : undefined });
  };
  const pct = list.length ? Math.round((score / list.length) * 100) : 0;

  return (
    <div className="pb-6" style={{ paddingBottom: fb ? 260 : undefined }}>
      <div className="chips mt-2" role="group" aria-label="Poziomy w quizie">
        <button type="button" className={cn("chip", allOn && "active")} onClick={() => { setSel(new Set(topic.levels.map((l) => l.id))); restart(); }}>Wszystko</button>
        {topic.levels.map((l) => (
          <button type="button" key={l.id} className={cn("chip", !allOn && sel.has(l.id) && "active")} onClick={() => toggle(l.id)} aria-pressed={sel.has(l.id)}>{l.title}</button>
        ))}
      </div>
      <div className="progressrow">
        <div className="bar green"><i style={{ width: `${list.length ? (idx / list.length) * 100 : 0}%` }} /></div>
        <div className="counter">{Math.min(idx + 1, list.length)}/{list.length}</div>
      </div>
      {!mounted ? (
        <div className="qcard items-center"><span className="spinner" aria-label="losuję pytania…" /></div>
      ) : !q ? (
        <div className="result">
          <Mascot state={pct >= 70 ? "cheer" : pct >= 50 ? "happy" : "think"} size={120} streak={streak} say={pct >= 70 ? "Solidnie!" : "Jeszcze raz?"} bubbleSide="top" />
          <Ring pct={pct} size={110} stroke={12} color={pct >= 70 ? "var(--play-green)" : pct >= 50 ? "var(--play-orange)" : "var(--play-red)"}>
            <span className="display text-[28px] font-extrabold text-txt">{pct}%</span>
          </Ring>
          <h2>Wynik</h2>
          <p>Trafione <b>{score}/{list.length}</b>. {pct >= 70 ? "Solidnie ogarniasz ten temat." : pct >= 50 ? "Spoko, ale przejedź jeszcze fiszki." : "Wróć do fiszek i ścieżki, potem tu wróć."}</p>
          <Btn3d variant="green" onClick={restart}>Jeszcze raz</Btn3d>
        </div>
      ) : (
        <QuestionCard q={q} tag={q.lvl} picked={picked} reveal={picked !== null} explain={false} onPick={pick} animKey={`${round}-${idx}`} />
      )}
      <FeedbackSheet fb={fb} onNext={() => { setFb(null); setPicked(null); setIdx((i) => i + 1); }} streak={streak} />
    </div>
  );
}
