"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  applyQuizResult,
  comboStep,
  comboTierHit,
  comboXp,
  emptyCombo,
  ghostFinish,
  ghostRun,
  levelGems,
  levelSession,
  markWeak,
  pl,
  recordStep,
  todayStr,
  TYPETERM_HINT_XP,
  XP,
  type ComboState,
  type GhostResult,
  type GhostStep,
  type LevelSessionItem,
  type Subject,
  type Topic,
} from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { useDailyActions } from "@/lib/daily-plan";
import { overridesFor } from "@/lib/store/extra";
import { testDone } from "@/lib/tests";
import { noEmoji } from "@/lib/dates";
import { useMounted } from "@/lib/use-mounted";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { themeStyle } from "@/components/ui/mono";
import { Icon } from "@/components/ui/icons";
import { Confetti } from "@/components/ui/confetti";
import { HeartsPill } from "@/components/app/chrome";
import { QuizBlock, SessionChips } from "@/components/lesson/quiz-block";
import { TaskBlock, type TaskFeedback } from "@/components/tasks";
import { useKeys } from "@/components/tasks/common";
import { AnswerSheet, NoHeartsSheet, type AnswerFb, type QCtx } from "@/components/lesson/sheets";
import { GhostCard } from "@/components/lesson/ghost-card";

type Phase = "feed" | "quiz" | "done";
interface Pending {
  ok: boolean;
  fb: AnswerFb;
  xp: number;
  mult: number;
  combo: number;
  qi: number | null;
}

/** Lesson.html → Quiz/Task session → LevelComplete.html (legacy startLesson / renderLesson / finishLesson). */
export function Lesson({ topic, subject, levelId }: { topic: Topic; subject: Subject; levelId: string }) {
  const level = topic.levels.find((l) => l.id === levelId)!;
  const app = useApp();
  const { ready, hearts, unlimitedHearts, loseHeart, addXp, progressOf, setProgress, weak, setWeak, logActivity, questEvent, bumpStats, addGems, histAdd, histMax, boostOn, overrides, tests, setTests, allProgress, toast } = app;
  const { completeDaily } = useDailyActions();
  const router = useRouter();
  const sfx = useSfx();
  const mounted = useMounted();
  const backHref = `/app/t/${topic.id}`;
  const feed = level.feed;
  const [items] = useState<LevelSessionItem[]>(() => levelSession(level, { maxQuiz: 6, overrides: overridesFor(overrides, topic.id, level.id) }));
  const [phase, setPhase] = useState<Phase>(feed.length ? "feed" : "quiz");
  const [feedIdx, setFeedIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [marks, setMarks] = useState<Record<number, "bad">>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [noHearts, setNoHearts] = useState<"start" | "mid" | null>(null);
  const [combo, setCombo] = useState<ComboState>(emptyCombo);
  const [broken, setBroken] = useState(false);
  const [xp, setXp] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<{ pct: number; stars: number; passed: boolean; bonus: number; gem: number; gh: Exclude<GhostResult, { kind: "none" }> | null } | null>(null);
  const [footEl, setFootEl] = useState<HTMLDivElement | null>(null);
  const run = useRef<GhostStep[]>([]);
  const [runView, setRunView] = useState<GhostStep[]>([]);
  const [t0, setT0] = useState<number | null>(() => (feed.length ? null : Date.now()));
  const answers = useRef<{ qi: number; ok: boolean }[]>([]);
  const finished = useRef(false);
  const [startedAt] = useState(() => Date.now());
  const ghostRec = progressOf(topic.id).ghost?.[level.id];
  const ghost = ghostRec && ghostRun(ghostRec).length ? ghostRec : null;
  const ctx: QCtx = { topic, levelId: level.id, qi: null };
  const totalFeed = feed.length, steps = totalFeed + items.length;
  const cur = phase === "feed" ? feedIdx : totalFeed + qIdx;

  // hearts gate at the start (legacy startLesson): derived, not stored
  const gateStart = ready && !unlimitedHearts && hearts.hearts <= 0 && phase !== "done" && qIdx === 0 && !pending && noHearts == null;

  const close = () => router.push(backHref);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    const total = items.length;
    const pct = total ? Math.round((score / total) * 100) : 100;
    const passed = total ? pct >= 50 : true;
    const prevP = progressOf(topic.id);
    const prev = prevP.levels[level.id];
    let bonus = 0, gem = 0;
    let np = prevP;
    if (total) {
      const r = applyQuizResult(prevP, level.id, score, total);
      np = r.progress;
      if (passed) {
        bonus = r.gained - score * XP.quizCorrect;
        addXp(topic.id, bonus);
      } else {
        np = { ...np, xp: prevP.xp };
      }
    } else {
      np = { ...prevP, levels: { ...prevP.levels, [level.id]: { done: true, best: 100, stars: 3, attempts: (prev?.attempts ?? 0) + 1 } } };
    }
    const ans = answers.current;
    setWeak(markWeak(weak, topic.id, level.id, ans.filter((a) => !a.ok).map((a) => a.qi), ans.filter((a) => a.ok).map((a) => a.qi)), topic.id);
    const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 50 ? 1 : 0;
    if (passed) {
      if (!prev?.done) {
        gem = levelGems(stars);
        addGems(gem);
      } else if (stars >= 3 && (prev.stars | 0) < 3) {
        gem = levelGems(3) - levelGems(2);
        addGems(gem);
      }
      completeDaily(topic.id, "lesson", level.id);
      histAdd("levels", 1);
      questEvent({ type: "level", perfect: pct === 100 });
    }
    // ghost
    const gh = ghostFinish(prevP.ghost?.[level.id], run.current, passed, total, todayStr());
    if (gh.kind !== "none") {
      np = { ...np, ghost: { ...(np.ghost ?? {}), [level.id]: gh.record } };
      if (gh.xp) { addXp(topic.id, gh.xp); bonus += gh.xp; }
    }
    setProgress(topic.id, np);
    if (passed) {
      const td = testDone(tests, subject.id, "learn", { ...allProgress(), [topic.id]: np });
      if (td) { setTests(td); setTimeout(() => toast("Plan do sprawdzianu: dzień zaliczony", "calendar"), 4400); }
    }
    histMax("combo", combo.best);
    const mins = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    logActivity(0, mins);
    const allDone = topic.levels.every((l) => np.levels[l.id]?.done);
    bumpStats((s) => ({
      levelsDone: s.levelsDone + (passed && !prev?.done ? 1 : 0),
      perfectLevels: s.perfectLevels + (pct === 100 && (prev?.best ?? 0) < 100 ? 1 : 0),
      comboBest: Math.max(s.comboBest, combo.best),
      subjectsDone: (s.subjectsDone ?? 0) + (allDone && !topic.levels.every((l) => prevP.levels[l.id]?.done) ? 1 : 0),
    }));
    setResult({ pct, stars, passed, bonus, gem, gh: gh.kind === "none" ? null : gh });
    setPhase("done");
    if (passed) sfx.play("levelup");
  };

  const onAnswer = (ok: boolean, fb: AnswerFb, item: LevelSessionItem) => {
    run.current = recordStep(run.current, ok, t0 ?? Date.now());
    setRunView(run.current);
    const c = comboStep(combo, ok);
    setCombo(c);
    const isTask = item.kind !== "quiz";
    let gained = 0, mult: 1 | 2 | 3 = 1;
    if (ok) {
      setScore((s) => s + 1);
      setBroken(false);
      const r = comboXp(item.xp, c.streak);
      gained = r.xp;
      mult = r.mult;
      setXp((x) => x + gained);
      addXp(topic.id, gained);
      if (comboTierHit(c.streak)) sfx.play("combo"); else sfx.play("correct");
      if (isTask) { questEvent({ type: "task", won: true, timed: item.kind === "task" && item.task.type === "tf" && !!item.task.seconds }); bumpStats((s) => ({ tasksDone: (s.tasksDone ?? 0) + 1, timedPerfect: (s.timedPerfect ?? 0) + (item.kind === "task" && item.task.type === "tf" && item.task.seconds ? 1 : 0) })); }
    } else {
      setBroken(combo.streak >= 2);
      setMarks((m) => ({ ...m, [totalFeed + qIdx]: "bad" }));
      sfx.play("wrong");
      if (isTask) questEvent({ type: "task", won: false });
    }
    questEvent({ type: "answer", correct: ok, combo: c.streak });
    if (item.kind === "quiz") answers.current.push({ qi: item.qi, ok });
    let lost = false;
    if (!ok) {
      const v = loseHeart();
      lost = !v.unlimited && v.hearts <= 0;
    }
    setPending({ ok, fb, xp: gained, mult, combo: c.streak, qi: item.kind === "quiz" ? item.qi : null });
    if (lost) setTimeout(() => {}, 0);
  };
  const next = () => {
    setPending(null);
    if (!unlimitedHearts && hearts.hearts <= 0) { setNoHearts("mid"); return; }
    advance();
  };
  const advance = () => {
    if (qIdx + 1 >= items.length) finish();
    else setQIdx(qIdx + 1);
  };
  const feedNext = () => {
    if (feedIdx + 1 < totalFeed) { addXp(topic.id, XP.feedRead); setXp((x) => x + XP.feedRead); setFeedIdx(feedIdx + 1); }
    else if (items.length) { addXp(topic.id, XP.feedRead); setXp((x) => x + XP.feedRead); setT0(Date.now()); setPhase("quiz"); }
    else finish();
  };
  const feedPrev = () => feedIdx > 0 && setFeedIdx(feedIdx - 1);
  useKeys((e) => {
    if (phase === "feed") {
      if (e.key === "Enter" || e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); feedNext(); }
      else if (e.key === "ArrowLeft") feedPrev();
    } else if (phase === "done" && e.key === "Enter") {
      if (result?.passed) close(); else location.reload();
    }
  });

  if (!mounted || !ready) return <div className="lesson open" style={themeStyle(subject.accent2)}><div className="lessonbody" style={{ alignItems: "center", justifyContent: "center" }}><span className="spinner" aria-label="ładuję lekcję…" /></div></div>;

  const item = items[qIdx];
  const f = feed[feedIdx];
  const last = feedIdx + 1 >= totalFeed;

  return (
    <div className="lesson open" style={themeStyle(subject.accent2)}>
      {phase !== "done" && (
        <div className="lessonhead">
          <button type="button" className="x" aria-label="Zamknij lekcję" onClick={close}><Icon name="close" size={18} stroke={3} /></button>
          <div className="segbar" aria-label={`krok ${Math.min(cur + 1, steps)} z ${steps}`}>{Array.from({ length: steps }, (_, i) => <i key={i} className={i < cur ? (marks[i] ? "bad" : "on") : ""} />)}</div>
          <HeartsPill />
        </div>
      )}

      {phase === "feed" && f && (
        <>
          <div className="lessonbody">
            <div className="blob a-float cyan" aria-hidden="true" />
            <div className="fcard a-up" key={feedIdx}>
              <div className="fin">
                <span className="tag accent">Mikro-dawka {feedIdx + 1}/{totalFeed}</span>
                <div className="ftitle">{noEmoji(f.title)}</div>
                <div className="fbody" dangerouslySetInnerHTML={{ __html: f.body }} />
                {f.real && <div className="real a-up d2"><span className="lbl"><Icon name="bulb" size={15} />prościej</span><span dangerouslySetInnerHTML={{ __html: f.real }} /></div>}
                {f.mnemo && <div className="mnemo a-up d3"><span className="lbl"><Icon name="bookmark" size={15} />zapamiętaj</span><span dangerouslySetInnerHTML={{ __html: f.mnemo }} /></div>}
              </div>
            </div>
          </div>
          <div className="lessonfoot col">
            <div className="swipehint2"><Icon name="arrow-up" size={16} className="a-bob" /><span>przesuń w górę, żeby przejść dalej</span></div>
            <button type="button" className="pill a-glow" onClick={feedNext}>{last ? (items.length ? "CZAS NA PYTANIA" : "ZAKOŃCZ") : "KONTYNUUJ"}</button>
          </div>
        </>
      )}

      {phase === "quiz" && item && (
        <>
          <div className="lessonbody" key={qIdx}>
            {ghost && t0 != null && <GhostCard ghost={ghost} run={runView} youIdx={qIdx} total={items.length} t0={t0} />}
            {pending?.ok && <Confetti n={4} />}
            {item.kind === "quiz" ? (
              <QuizBlock q={item.q} api={{ footEl, finish: () => {} }} chips={<SessionChips o={{ combo: combo.streak, broken, boost: boostOn }} word="Pytanie" n={qIdx + 1} total={items.length} />} onAnswer={(i, ok) => onAnswer(ok, { e: item.q.e, q: item.q, src: item.q.src }, item)} />
            ) : item.kind === "task" ? (
              <TaskBlock task={item.task} api={{ footEl, finish: (ok, fb: TaskFeedback) => onAnswer(ok, fb, item), onHintXp: () => { if (progressOf(topic.id).xp >= TYPETERM_HINT_XP) { addXp(topic.id, -TYPETERM_HINT_XP); toast(`Podpowiedź: −${TYPETERM_HINT_XP} XP`, "bolt"); } } }} chips={<SessionChips o={{ combo: combo.streak, broken, boost: boostOn }} word="Zadanie" n={qIdx + 1} total={items.length} />} />
            ) : null}
          </div>
          <div className="lessonfoot" ref={setFootEl} />
        </>
      )}

      {phase === "done" && result && <LevelComplete topic={topic} levelTitle={level.title} r={result} xp={xp} combo={combo.best} onClose={close} onRetry={() => location.reload()} />}

      {pending && <AnswerSheet ok={pending.ok} fb={pending.fb} xp={pending.xp} mult={pending.mult} combo={pending.combo} onNext={next} ctx={{ ...ctx, qi: pending.qi }} onCards={() => router.push(`${backHref}?tab=fiszki&lvl=${level.id}`)} />}
      {(noHearts || gateStart) && <NoHeartsSheet inLesson={noHearts === "mid"} cardsHref={`${backHref}?tab=fiszki&lvl=${level.id}`} onLeave={close} onResume={noHearts === "mid" ? () => { setNoHearts(null); advance(); } : undefined} />}
    </div>
  );
}

/** LevelComplete.html */
export function LevelComplete({ topic, levelTitle, r, xp, combo, onClose, onRetry }: { topic: Topic; levelTitle: string; r: { pct: number; stars: number; passed: boolean; bonus: number; gem: number; gh: Exclude<GhostResult, { kind: "none" }> | null }; xp: number; combo: number; onClose: () => void; onRetry: () => void }) {
  const { streak, daily, boostOn } = useApp();
  const dd = daily?.tasks.filter((t) => t.done).length ?? 0, dt = daily?.tasks.length ?? 0;
  const star = (size: number, cls: string, on: boolean) => <Icon name="star" size={size} fill={on} stroke={2} className={cn(cls, on ? "ic-gold" : "ic-dim")} />;
  return (
    <>
      <div className="lessonbody done">
        <div className={cn("blob a-float", r.passed ? "acid" : "red")} aria-hidden="true" />
        {r.passed && <Confetti n={7} />}
        <div className="lc">
          <div className="lcstars">{star(34, "a-pop d1", r.stars >= 2)}{star(46, "a-pop", r.stars >= 1)}{star(34, "a-pop d3", r.stars >= 3)}</div>
          <div className={cn("lcbig a-pop d2", !r.passed && "fail")}>{r.passed ? <Icon name="check" size={66} stroke={3.2} /> : <Icon name="close" size={60} stroke={3.4} />}</div>
          <div className="lctxt"><div className="lct a-up d3">{r.passed ? "Poziom zaliczony!" : "Poziom niezaliczony"}</div><div className="lcs">{noEmoji(topic.short || topic.name)} · {noEmoji(levelTitle)}</div></div>
          <div className="lcstats">
            <div className="lcstat a-up d4"><div className="k">XP</div><div className="v gold">+{xp + r.bonus}</div></div>
            <div className="lcstat a-up d5"><div className="k">Celność</div><div className="v acid">{r.pct}%</div></div>
            <div className="lcstat a-up d6"><div className="k">Combo</div><div className="v pink">x{combo}</div></div>
          </div>
          {r.gem > 0 && <div className="lcrewards a-up d5"><span className="lcreward cyan"><Icon name="gem" size={15} />+{r.gem} {pl(r.gem, "gem", "gemy", "gemów")}</span>{boostOn && <span className="lcreward gold"><Icon name="bolt" size={15} />podwójne XP</span>}</div>}
          {r.gh && <div className={cn("lcghost a-up d5", r.gh.kind)}><div className="ico"><Icon name={r.gh.kind === "win" ? "bolt" : "ghost"} size={24} /></div><div className="grow"><div className="t">{r.gh.title}</div><div className="s">{r.gh.sub}</div></div></div>}
          {!r.passed && <p className="lcp">Poniżej 50%. Przejrzyj roladkę jeszcze raz i spróbuj ponownie.</p>}
          <Link href="/app/streak" className="lcstreak a-up d6">
            <div className="ico"><Icon name="flame" size={24} /></div>
            <div className="grow"><div className="t">{streak} {pl(streak, "dzień", "dni", "dni")} z rzędu</div><div className="s">{dt && dd >= dt ? "Plan dnia zrobiony" : `Plan dnia: ${dd} z ${dt}`}</div></div>
            <Icon name="chevron-right" size={20} />
          </Link>
        </div>
      </div>
      <div className="lessonfoot col">
        <button type="button" className="pill a-glow" onClick={r.passed ? onClose : onRetry}>{r.passed ? "DALEJ" : "SPRÓBUJ JESZCZE RAZ"}</button>
        <button type="button" className="pill text" onClick={r.passed ? onRetry : onClose}>{r.passed ? "POWTÓRZ POZIOM" : "WRÓĆ NA ŚCIEŻKĘ"}</button>
      </div>
    </>
  );
}
