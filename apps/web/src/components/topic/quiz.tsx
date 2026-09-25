"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { allQuiz, shuffle, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { useDailyActions } from "@/lib/daily-plan";
import { quizSrsKey, useSrsTouch } from "@/lib/review";
import { qOf } from "@/lib/store/extra";
import { noEmoji } from "@/lib/dates";
import { useMounted } from "@/lib/use-mounted";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { Confetti } from "@/components/ui/confetti";
import { QuizBlock } from "@/components/lesson/quiz-block";
import { AnswerSheet, type AnswerFb } from "@/components/lesson/sheets";
import { useKeys } from "@/components/tasks/common";

const QUIZ_TAB_XP = 3;

/** Quiz.html (topic tab): whole topic or one level, 3D option tiles, ok/bad sheets; no hearts, no combo. */
export function QuizTab({ topic, subject, levelId }: { topic: Topic; subject: Subject; levelId?: string | null }) {
  const { addXp, overrides } = useApp();
  const { completeDaily } = useDailyActions();
  const touch = useSrsTouch();
  const sfx = useSfx();
  const router = useRouter();
  const mounted = useMounted();
  const [lvl, setLvl] = useState(levelId && topic.levels.some((l) => l.id === levelId) ? levelId : "all");
  const [round, setRound] = useState(0);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [pending, setPending] = useState<{ ok: boolean; fb: AnswerFb; qi: number; levelId: string } | null>(null);
  const [burst, setBurst] = useState(0);
  const list = useMemo(() => {
    if (!mounted) return [];
    const all = allQuiz(topic).map((q) => ({ ...q, ...qOf(overrides, topic.id, q.levelId, q.qi, q) }));
    return shuffle(lvl === "all" ? all : all.filter((q) => q.levelId === lvl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, lvl, round, mounted]);
  const restart = (l = lvl) => { setLvl(l); setRound((r) => r + 1); setIdx(0); setScore(0); setPending(null); };
  const done = mounted && idx >= list.length;
  useKeys((e) => { if (done && e.key === "Enter") restart(); });
  const q = list[idx];
  const pct = list.length ? Math.round((score / list.length) * 100) : 0;

  return (
    <div className="scroll quizview">
      <div className="chips" role="tablist" aria-label="Poziom">
        <button type="button" className={cn("chip", lvl === "all" && "active")} onClick={() => restart("all")}>Wszystko</button>
        {topic.levels.map((l) => (
          <button key={l.id} type="button" className={cn("chip", lvl === l.id && "active")} onClick={() => restart(l.id)}>{noEmoji(l.title)}</button>
        ))}
      </div>
      <div className="progressrow">
        <div className="bar"><i style={{ width: `${list.length ? (Math.min(idx, list.length) / list.length) * 100 : 0}%` }} /></div>
        <div className="counter">{Math.min(idx + 1, list.length)}/{list.length}</div>
      </div>
      {done ? (
        <QuizResult pct={pct} score={score} total={list.length} onAgain={() => restart()} onMount={() => list.length && completeDaily(topic.id, "quiz")} />
      ) : q ? (
        <QuizBlock
          key={`${round}-${idx}`}
          q={q}
          sm
          chips={<span className="qn">{lvl === "all" ? noEmoji(q.lvl) : `Pytanie ${idx + 1}`}</span>}
          api={{ footEl: null, finish: () => {} }}
          onAnswer={(_i, ok) => {
            touch(topic, quizSrsKey(q.levelId, q.qi), ok);
            if (ok) { setScore((s) => s + 1); addXp(topic.id, QUIZ_TAB_XP); setBurst((b) => b + 1); sfx.play("correct"); } else sfx.play("wrong");
            setPending({ ok, fb: { e: q.e, q, src: q.src }, qi: q.qi, levelId: q.levelId });
          }}
        />
      ) : (
        <div className="result"><h2>Brak pytań</h2><p>Ten temat nie ma jeszcze pytań w tym zakresie.</p></div>
      )}
      {burst > 0 && pending?.ok && <Confetti key={burst} n={4} />}
      {pending && (
        <AnswerSheet
          ok={pending.ok}
          fb={pending.fb}
          xp={QUIZ_TAB_XP}
          mult={1}
          combo={0}
          ctx={{ topic, levelId: pending.levelId, qi: pending.qi }}
          onNext={() => { setPending(null); setIdx((i) => i + 1); }}
          onCards={() => router.replace(`/app/t/${topic.id}?tab=fiszki&lvl=${pending.levelId}`)}
        />
      )}
      <span hidden>{subject.name}</span>
    </div>
  );
}

/** Result card (legacy renderQuiz end): big tile, score, hint, "JESZCZE RAZ". */
export function QuizResult({ pct, score, total, onAgain, onMount, label = "Trafione" }: { pct: number; score: number; total: number; onAgain: () => void; onMount?: () => void; label?: string }) {
  const [fired, setFired] = useState(false);
  if (!fired) { setFired(true); setTimeout(() => onMount?.(), 0); }
  const kind = pct >= 70 ? "hot" : pct >= 50 ? "ok" : "fail";
  return (
    <div className="qcard">
      <div className="result">
        <div className={cn("big", kind)}><Icon name={kind === "hot" ? "flame" : kind === "ok" ? "check" : "refresh"} size={60} stroke={3.2} /></div>
        <h2>Wynik</h2>
        <div className="score">{label} <b>{score}/{total}</b> ({pct}%)</div>
        <p>{pct >= 70 ? "Dobrze znasz ten materiał." : pct >= 50 ? "Nieźle. Przejrzyj jeszcze fiszki." : "Wróć do fiszek i ścieżki, a potem spróbuj ponownie."}</p>
        <button type="button" className="pill" onClick={onAgain}>JESZCZE RAZ</button>
      </div>
    </div>
  );
}
