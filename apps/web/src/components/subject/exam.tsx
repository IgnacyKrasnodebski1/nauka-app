"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { allQuiz, gradeFor, pickExam, shuffle, XP } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import type { AppSubject } from "@/lib/types";
import { KEYS, cn, fmtTime } from "@/lib/utils";
import { QuestionCard } from "@/components/subject/question";
import { Confetti } from "@/components/lesson/confetti";

type Phase = "intro" | "run" | "done";

export function ExamTab({ subject }: { subject: AppSubject }) {
  const { addXp, toast, progressOf, setProgress } = useApp();
  const total = useMemo(() => allQuiz(subject).length, [subject]);
  const N = Math.min(20, total);
  const lim = subject.grading.examMin || 20;
  const fullLim = Math.max(lim, Math.ceil(total * 0.75));
  const [phase, setPhase] = useState<Phase>("intro");
  const [pool, setPool] = useState<ReturnType<typeof pickExam>>([]);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>([]);
  const [left, setLeft] = useState(0);
  const finished = useRef(false);

  const begin = (n: number, minutes: number) => {
    const p = n >= total ? shuffle(allQuiz(subject)) : pickExam(subject, n);
    setPool(p);
    setPicks(new Array(p.length).fill(null));
    setIdx(0);
    setLeft(minutes * 60);
    finished.current = false;
    setPhase("run");
  };

  useEffect(() => {
    if (phase !== "run") return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => {
    if (phase === "run" && left <= 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase]);

  const result = useMemo(() => {
    if (phase !== "done") return null;
    let correct = 0;
    const wrong: { q: (typeof pool)[number]; sel: number | null }[] = [];
    pool.forEach((q, i) => (picks[i] === q.c ? correct++ : wrong.push({ q, sel: picks[i] ?? null })));
    const pct = pool.length ? Math.round((correct / pool.length) * 100) : 0;
    return { correct, wrong, pct, grade: gradeFor(pct, subject.grading), pass: pct >= subject.grading.pass };
  }, [phase, pool, picks, subject.grading]);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    let correct = 0;
    pool.forEach((q, i) => picks[i] === q.c && correct++);
    const pct = pool.length ? Math.round((correct / pool.length) * 100) : 0;
    const pass = pct >= subject.grading.pass;
    const gained = correct * 3 + (pass ? XP.examPass : 0);
    addXp(subject, gained);
    const p = progressOf(subject);
    if ((p.bestExam ?? 0) < pct) setProgress(subject, { ...progressOf(subject), bestExam: pct });
    toast(pass ? `zdane! ocena ${gradeFor(pct, subject.grading)} 🎉 +${gained}xp` : "niezaliczone 💀");
    setPhase("done");
  }

  if (!total) return <div className="zbox"><p>Ten przedmiot nie ma jeszcze pytań.</p></div>;

  if (phase === "intro")
    return (
      <div className="result">
        <div className="big">🎯</div>
        <h2>Egzamin</h2>
        <div className="specs">
          <div className="spec">{N}<small>losowych</small></div>
          <div className="spec">{lim}:00<small>na czas</small></div>
          <div className="spec">{subject.grading.pass}%<small>zalicza</small></div>
        </div>
        <p>Bez podpowiedzi w trakcie. Na końcu % i ocena wg siatki + przegląd błędów.</p>
        <button type="button" className="pill" onClick={() => begin(N, lim)}>symulacja — {N} losowych 🎲</button>
        <button type="button" className="pill ghost" onClick={() => begin(total, fullLim)}>📋 Test końcowy — WSZYSTKIE {total} pytań</button>
        <p className="!text-[13px]">Test końcowy = każde pytanie z przedmiotu, w losowej kolejności ({fullLim}:00).</p>
      </div>
    );

  if (phase === "run") {
    const q = pool[idx]!;
    const last = idx + 1 >= pool.length;
    return (
      <div>
        <div className="examhead">
          <div className="counter">Pytanie {idx + 1}/{pool.length}</div>
          <div className={cn("timer", left <= 60 && "warn")} role="timer" aria-live="off">⏱ {fmtTime(Math.max(0, left))}</div>
        </div>
        <div className="progressrow"><div className="bar"><i style={{ width: `${(idx / pool.length) * 100}%` }} /></div></div>
        <QuestionCard q={q} tag={q.lvl} picked={picks[idx] ?? null} reveal={false} onPick={(i) => setPicks((p) => p.map((v, j) => (j === idx ? i : v)))}>
          <div className="flex gap-2.5 mt-4">
            {idx > 0 && <button type="button" className="pill ghost flex-1" onClick={() => setIdx((i) => i - 1)}>← wstecz</button>}
            <button type="button" className="pill flex-[2]" onClick={() => (last ? finish() : setIdx((i) => i + 1))}>{last ? "zakończ i sprawdź 🏁" : "dalej →"}</button>
          </div>
        </QuestionCard>
      </div>
    );
  }

  const r = result!;
  return (
    <div>
      {r.pass && <Confetti />}
      <div className="result">
        <div className="big">{r.pct >= 90 ? "👑" : r.pct >= 70 ? "🔥" : r.pass ? "😮‍💨" : "💀"}</div>
        <h2>Ocena: {r.grade}</h2>
        <div className="score">Trafione <b>{r.correct}/{pool.length}</b> ({r.pct}%)</div>
        <p>{r.pass ? "Zdane! 🎉" : "Poniżej progu — wróć do ścieżki i fiszek."}</p>
        <button type="button" className="pill" onClick={() => setPhase("intro")}>jeszcze raz 🔁</button>
      </div>
      <div className="review">
        <h3>Przegląd błędów ({r.wrong.length})</h3>
        {r.wrong.length === 0 ? (
          <div className="ritem rgood">Zero błędów. Clean sweep 🧼</div>
        ) : (
          r.wrong.map((w, i) => (
            <div className="ritem" key={i}>
              <div className="rq">{w.q.q}</div>
              <div className="rbad">Twoja: {w.sel == null ? "— (brak)" : `${KEYS[w.sel]}. ${w.q.a[w.sel]}`}</div>
              <div className="rgood">Dobra: {KEYS[w.q.c]}. {w.q.a[w.q.c]}</div>
              <div className="rsrc">{w.q.lvl} · {w.q.e}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
