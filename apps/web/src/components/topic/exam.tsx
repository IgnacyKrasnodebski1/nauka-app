"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_GRADING, GEMS, allQuiz, gradeFor, shuffle, XP, type Grading, type QuizQuestion, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { burst } from "@/lib/confetti";
import { useSfx } from "@/lib/sfx";
import { KEYS, cn, fmtTime } from "@/lib/utils";
import { QuestionCard } from "@/components/topic/question";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon } from "@/components/ui/icons";
import { Ring } from "@/components/ui/ring";
import { StatCard } from "@/components/ui/stat-card";
import { Mascot } from "@/components/mascot/mascot";

type Phase = "intro" | "run" | "done";
type Q = QuizQuestion & { lvl: string; topicId: string };

/** Timed exam over one topic (topic shell) or all topics of a subject. */
export function ExamTab({ topics, grading: gradingProp }: { topics: Topic[]; grading?: Grading }) {
  const { addXp, toast, progressOf, setProgress, logActivity, addGems, bumpStats, streak } = useApp();
  const sfx = useSfx();
  const grading = gradingProp ?? topics[0]?.grading ?? DEFAULT_GRADING;
  const pool_all = useMemo<Q[]>(() => topics.flatMap((t) => allQuiz(t).map((q) => ({ ...q, lvl: topics.length > 1 ? `${t.name} · ${q.lvl}` : q.lvl, topicId: t.id }))), [topics]);
  const total = pool_all.length;
  const N = Math.min(20, total);
  const lim = grading.examMin || 20;
  const fullLim = Math.max(lim, Math.ceil(total * 0.75));
  const [phase, setPhase] = useState<Phase>("intro");
  const [pool, setPool] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>([]);
  const [left, setLeft] = useState(0);
  const [gained, setGained] = useState(0);
  const startedAt = useRef(0);
  const finished = useRef(false);

  const begin = (n: number, minutes: number) => {
    const p = shuffle(pool_all).slice(0, n);
    setPool(p);
    setPicks(new Array(p.length).fill(null));
    setIdx(0);
    setLeft(minutes * 60);
    startedAt.current = Date.now();
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
    const wrong: { q: Q; sel: number | null }[] = [];
    pool.forEach((q, i) => (picks[i] === q.c ? correct++ : wrong.push({ q, sel: picks[i] ?? null })));
    const pct = pool.length ? Math.round((correct / pool.length) * 100) : 0;
    return { correct, wrong, pct, grade: gradeFor(pct, grading), pass: pct >= grading.pass };
  }, [phase, pool, picks, grading]);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    let correct = 0;
    pool.forEach((q, i) => picks[i] === q.c && correct++);
    const pct = pool.length ? Math.round((correct / pool.length) * 100) : 0;
    const pass = pct >= grading.pass;
    const g = correct * 3 + (pass ? XP.examPass : 0);
    setGained(g);
    const target = topics[0]?.id;
    if (target) {
      addXp(target, g);
      if (topics.length === 1 && (progressOf(target).bestExam ?? 0) < pct) setProgress(target, { ...progressOf(target), bestExam: pct });
    }
    logActivity(0, Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)));
    if (pass) {
      addGems(GEMS.examPass);
      bumpStats((s) => ({ examsPassed: s.examsPassed + 1 }));
      sfx.play("levelup");
      burst("levelup");
    } else sfx.play("wrong");
    toast(pass ? `Zdane · ocena ${gradeFor(pct, grading)}` : "Niezaliczone", pass ? "xp" : "info");
    setPhase("done");
  }

  if (!total)
    return (
      <div className="empty mt-4">
        <Mascot state="think" size={100} />
        <p>Nie ma jeszcze pytań — dodaj temat.</p>
      </div>
    );

  if (phase === "intro")
    return (
      <div className="pb-6">
        <div className="card3d soft-purple mt-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <span className="tag" style={{ color: "var(--play-purple)" }}>Egzamin próbny</span>
              <h2>{topics.length > 1 ? "Cały przedmiot" : "Ten temat"}</h2>
              <p className="mt-1">Bez podpowiedzi w trakcie. Na końcu procent, ocena wg siatki i przegląd błędów.</p>
            </div>
            <Mascot state="think" size={84} streak={streak} />
          </div>
          <div className="specs mt-4">
            <div className="spec"><b>{N}</b><small>pytań</small></div>
            <div className="spec"><b>{lim}:00</b><small>czas</small></div>
            <div className="spec"><b>{grading.pass}%</b><small>zalicza</small></div>
            <div className="spec"><b style={{ color: "var(--play-gem)" }}>+{GEMS.examPass}</b><small>klejnotów</small></div>
          </div>
          <Btn3d variant="purple" size="lg" className="mt-5" onClick={() => begin(N, lim)}><Icon name="exam" size={18} />Symulacja · {N} losowych</Btn3d>
          <Btn3d variant="ghost" className="mt-2.5" onClick={() => begin(total, fullLim)}>Test końcowy · {total} pytań ({fullLim}:00)</Btn3d>
        </div>
      </div>
    );

  if (phase === "run") {
    const q = pool[idx]!;
    const last = idx + 1 >= pool.length;
    return (
      <div className="pb-6">
        <div className="examhead mt-3">
          <div className="counter">Pytanie {idx + 1}/{pool.length}</div>
          <div className={cn("timer", left <= 60 && "warn")} role="timer"><Icon name="clock" size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />{fmtTime(Math.max(0, left))}</div>
        </div>
        <div className="progressrow"><div className="bar" style={{ ["--hue" as string]: "var(--play-purple)" }}><i style={{ width: `${(idx / pool.length) * 100}%` }} /></div></div>
        <QuestionCard q={q} tag={q.lvl} picked={picks[idx] ?? null} reveal={false} onPick={(i) => setPicks((p) => p.map((v, j) => (j === idx ? i : v)))} animKey={idx}>
          <div className="flex gap-2.5 mt-4">
            {idx > 0 && <Btn3d variant="ghost" className="flex-1" onClick={() => setIdx((i) => i - 1)}>Wstecz</Btn3d>}
            <Btn3d variant="purple" className="flex-[2]" onClick={() => (last ? finish() : setIdx((i) => i + 1))}>{last ? "Zakończ i sprawdź" : "Dalej"}</Btn3d>
          </div>
        </QuestionCard>
      </div>
    );
  }

  const r = result!;
  return (
    <div className="pb-6">
      <div className="result">
        <Mascot state={r.pass ? "cheer" : "sad"} size={120} streak={streak} say={r.pass ? "Zdane!" : "Poniżej progu."} bubbleSide="top" />
        <h2>Ocena: {r.grade}</h2>
        <p>{r.pass ? "Zdane. Tak wygląda gotowość na sprawdzian." : "Poniżej progu — wróć do ścieżki i fiszek."}</p>
        <div className="statgrid mt-2">
          <StatCard icon="target" label="Wynik" tone="green" delay={0.1}>
            <div className="flex items-center gap-3 mt-auto">
              <Ring pct={r.pct} size={54} stroke={7} color={r.pass ? "var(--play-green)" : "var(--play-red)"}><span className="display text-[13px] font-extrabold text-txt">{r.pct}%</span></Ring>
              <div className="text-[12px] font-bold text-muted leading-tight">{r.correct}/{pool.length}<br />trafionych</div>
            </div>
          </StatCard>
          <StatCard icon="bolt" label="XP" value={gained} tone="gold" delay={0.2} />
          <StatCard icon="gem" label="Klejnoty" value={r.pass ? GEMS.examPass : 0} tone="gem" delay={0.3} />
          <StatCard icon="clock" label="Czas" tone="blue" delay={0.4}><div className="big">{fmtTime(Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)))}</div></StatCard>
        </div>
        <Btn3d variant="purple" onClick={() => setPhase("intro")}>Jeszcze raz</Btn3d>
      </div>
      <div className="review">
        <h3>Przegląd błędów ({r.wrong.length})</h3>
        {r.wrong.length === 0 ? (
          <div className="ritem rgood">Zero błędów.</div>
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
