"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { buildDailySession, GEMS, markWeak, newCard, review, XP, type DailySession, type SrsGrade, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { burst } from "@/lib/confetti";
import { AnimatePresence, m } from "@/lib/motion";
import { useSfx } from "@/lib/sfx";
import { fmtTime } from "@/lib/utils";
import { QuestionCard } from "@/components/topic/question";
import { Btn3d } from "@/components/ui/btn3d";
import { FeedbackSheet, type Feedback } from "@/components/ui/feedback-sheet";
import { Icon } from "@/components/ui/icons";
import { DailyGoalRing, Ring } from "@/components/ui/ring";
import { SegmentedProgress } from "@/components/ui/segmented-progress";
import { StatCard } from "@/components/ui/stat-card";
import { SwipeDeck, type SwipeDir } from "@/components/ui/swipe-deck";
import { Mascot } from "@/components/mascot/mascot";

/** `/app/today` — waits for the store, then runs the session (built once, not on every progress write). */
export function TodaySession({ topics }: { topics: Topic[] }) {
  const { ready } = useApp();
  if (!ready)
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <span className="spinner" aria-label="liczę sesję…" />
      </div>
    );
  return <SessionRunner topics={topics} />;
}

type Stage = "intro" | "run" | "done";
/** wall clock for the session timer (event handlers only) */
const nowMs = () => Date.now();

function SessionRunner({ topics }: { topics: Topic[] }) {
  const { allProgress, allSrs, weak, srsOf, setSrs, setWeak, addXp, logActivity, todayXp, dailyGoal, streak, gainHeart, addGems, questEvent, bumpStats, hearts, unlimitedHearts } = useApp();
  const sfx = useSfx();
  const [session] = useState<DailySession>(() => buildDailySession(topics, allProgress(), allSrs(), weak));
  const [stage, setStage] = useState<Stage>("intro");
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [gained, setGained] = useState(0);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [cmd, setCmd] = useState<{ n: number; dir: SwipeDir } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const logged = useRef(false);
  const [counts, setCounts] = useState({ reviewed: 0, correct: 0, answered: 0 });
  const countsRef = useRef(counts);
  const bumpCounts = (p: Partial<typeof counts>) => {
    countsRef.current = { reviewed: countsRef.current.reviewed + (p.reviewed ?? 0), correct: countsRef.current.correct + (p.correct ?? 0), answered: countsRef.current.answered + (p.answered ?? 0) };
    setCounts(countsRef.current);
  };

  const byId = Object.fromEntries(topics.map((t) => [t.id, t]));
  const items = session.items.filter((it) => it.kind !== "new");
  const item = items[i];
  const total = items.length;
  const earn = (topicId: string, n: number) => {
    addXp(topicId, n);
    setGained((g) => g + n);
  };
  const begin = () => {
    startedAt.current = nowMs();
    if (!total) return finish();
    setStage("run");
  };
  const next = () => {
    setPicked(null);
    setFb(null);
    if (i + 1 < items.length) setI(i + 1);
    else finish();
  };
  const finish = () => {
    if (!logged.current) {
      logged.current = true;
      const minutes = Math.max(1, Math.round((nowMs() - startedAt.current) / 60000));
      setElapsed(Math.round((nowMs() - startedAt.current) / 1000));
      logActivity(0, minutes);
      if (total > 0) {
        const t0 = items[0]!.topicId;
        earn(t0, XP.sessionDone);
        addGems(GEMS.sessionDone);
        gainHeart();
        const rv = countsRef.current.reviewed;
        if (rv) {
          questEvent({ type: "review", count: rv });
          bumpStats((s) => ({ cardsReviewed: s.cardsReviewed + rv }));
        }
        sfx.play("levelup");
        burst("level");
      }
    }
    setStage("done");
  };
  const grade = (g: SrsGrade) => {
    if (!item?.card) return;
    const srs = srsOf(item.topicId);
    setSrs(item.topicId, { ...srs, [item.card.key]: review(srs[item.card.key] ?? newCard(), g) });
    bumpCounts({ reviewed: 1 });
    if (g >= 2) {
      earn(item.topicId, XP.flashcardKnown);
      sfx.play("correct");
    } else sfx.play("tap");
    next();
  };
  const answer = (k: number) => {
    if (!item?.question || picked !== null) return;
    setPicked(k);
    const q = item.question;
    const qi = byId[item.topicId]?.levels.find((l) => l.id === q.levelId)?.quiz.findIndex((x) => x.q === q.q) ?? -1;
    const ok = k === q.c;
    bumpCounts({ answered: 1, correct: ok ? 1 : 0 });
    if (qi >= 0) setWeak(markWeak(weak, item.topicId, q.levelId, ok ? [] : [qi], ok ? [qi] : []), item.topicId);
    questEvent({ type: "answer", correct: ok, combo: 0 });
    if (ok) {
      earn(item.topicId, XP.quizCorrect);
      sfx.play("correct");
    } else sfx.play("wrong");
    setFb({ ok, text: <><b>Dlaczego:</b> {q.e}</>, xp: XP.quizCorrect, mult: 1 });
  };

  const acc = counts.answered ? Math.round((counts.correct / counts.answered) * 100) : 100;

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="lessonhead">
        <Link href="/app" className="x" aria-label="Zamknij sesję" onClick={() => sfx.play("tap")}><Icon name="close" size={22} /></Link>
        <SegmentedProgress total={total} done={stage === "done" ? total : stage === "intro" ? 0 : i} label="Dzienna misja" />
        <span className="eyebrow">Dziś</span>
      </div>
      <div className="flex-1 px-4 pb-4 flex flex-col" style={{ paddingBottom: fb ? 260 : undefined }}>
        <AnimatePresence mode="wait">
          {stage === "intro" && (
            <m.div key="intro" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} className="flex-1 flex flex-col">
              <div className="flex items-center gap-4 mt-3">
                <DailyGoalRing xp={todayXp} goal={dailyGoal} size={96} />
                <div className="min-w-0">
                  <div className="eyebrow">Dzienna misja</div>
                  <h1 className="mt-1" style={{ fontSize: 26 }}>{total ? `~${session.minutes} min` : "Na dziś pusto"}</h1>
                  <p className="text-muted text-[13.5px] font-semibold mt-1">{total ? "Powtórki, słabe pytania i nowy poziom — w jednej paczce." : "Dodaj temat w przedmiocie, a jutro pojawią się tu powtórki."}</p>
                </div>
              </div>
              <div className="card3d mt-5">
                <h3 className="mb-2">Checklista</h3>
                {[
                  { ic: "cards" as const, t: `${session.reviewCount} fiszek do powtórki`, on: session.reviewCount > 0 },
                  { ic: "target" as const, t: `${session.weakCount} pytań, które nie weszły`, on: session.weakCount > 0 },
                  { ic: "flag" as const, t: session.newLevel ? `Nowy poziom: ${session.newLevel.title}` : "Nowy poziom: brak (wszystko zaliczone)", on: !!session.newLevel },
                ].map((r, k) => (
                  <div key={k} className="quest-row" style={{ opacity: r.on ? 1 : 0.5 }}>
                    <div className="quest-ic"><Icon name={r.ic} size={20} /></div>
                    <div className="quest-title flex-1">{r.t}</div>
                    {r.on && <Icon name="check" size={18} style={{ color: "var(--play-green)" }} />}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2.5 mt-3">
                <div className="card3d soft-gold statcard !min-h-[86px]"><div className="lbl"><Icon name="bolt" size={12} />bonus</div><div className="big !text-[22px]">+{XP.sessionDone}<small>XP</small></div></div>
                <div className="card3d soft-gem statcard !min-h-[86px]"><div className="lbl"><Icon name="gem" size={12} />klejnoty</div><div className="big !text-[22px]">+{GEMS.sessionDone}</div></div>
                <div className="card3d soft-red statcard !min-h-[86px]"><div className="lbl"><Icon name="heart" size={12} />serce</div><div className="big !text-[22px]">+1</div></div>
              </div>
              <div className="flex-1 flex items-end justify-center py-4">
                <Mascot state="idle" size={110} streak={streak} say={total ? "Gotowy? To będzie szybkie." : "Wróć jutro po powtórki."} />
              </div>
              <div className="lessonfoot">
                {total > 0 ? <Btn3d variant="green" size="lg" onClick={begin}><Icon name="play" size={18} />Start misji</Btn3d> : session.newLevel ? <Btn3d variant="green" size="lg" href={`/app/t/${session.newLevel.topicId}/l/${session.newLevel.levelId}`}>Nowy poziom: {session.newLevel.title}</Btn3d> : <Btn3d variant="green" size="lg" href="/app">Wróć na start</Btn3d>}
                {total > 0 && session.newLevel && <Btn3d variant="ghost" href={`/app/t/${session.newLevel.topicId}/l/${session.newLevel.levelId}`}>Od razu nowy poziom</Btn3d>}
              </div>
            </m.div>
          )}

          {stage === "run" && item?.kind === "review" && item.card && (
            <m.div key={`r${i}`} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="tag !mb-0">Powtórka {i + 1}/{total} · {byId[item.topicId]?.name}</span>
                <span className="text-muted text-[12px] font-bold">góra = łatwe</span>
              </div>
              <SwipeDeck
                items={items.slice(i, i + 3)}
                index={0}
                keyOf={(it) => `${it.topicId}|${it.card?.key ?? it.question?.q}`}
                allowUp
                command={cmd}
                onSwipe={(dir) => grade(dir === "up" ? 3 : dir === "right" ? 2 : 0)}
                render={(it, { flipped }) => (
                  <div className={`flip ${flipped ? "flipped" : ""}`}>
                    <div className="flipinner">
                      <div className="face front"><span className="tag">{byId[it.topicId]?.name}</span><div className="term">{it.card?.t}</div><div className="tapomat">tapnij, żeby odwrócić</div></div>
                      <div className="face back"><span className="tag hue">Odpowiedź</span><div className="deftxt" dangerouslySetInnerHTML={{ __html: it.card?.d ?? "" }} /><div className="tapomat">tapnij, żeby wrócić</div></div>
                    </div>
                  </div>
                )}
              />
              <div className="fbtns mt-4">
                <Btn3d variant="red" onClick={() => setCmd({ n: Date.now(), dir: "left" })}>Nie</Btn3d>
                <Btn3d variant="orange" onClick={() => grade(1)}>Trudne</Btn3d>
                <Btn3d variant="green" onClick={() => setCmd({ n: Date.now(), dir: "right" })}>Dobrze</Btn3d>
                <Btn3d variant="blue" onClick={() => setCmd({ n: Date.now(), dir: "up" })}>Łatwe</Btn3d>
              </div>
            </m.div>
          )}

          {stage === "run" && item?.question && (
            <m.div key={`q${i}`} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="flex-1">
              <QuestionCard q={item.question} tag={`Słabe ${i + 1}/${total} · ${byId[item.topicId]?.name ?? ""}`} picked={picked} reveal={picked !== null} explain={false} onPick={answer} />
            </m.div>
          )}

          {stage === "done" && (
            <m.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col">
              <div className="result">
                <Mascot state={total ? "cheer" : "think"} size={130} streak={streak} say={total ? "Misja zrobiona!" : "Na dziś pusto."} bubbleSide="top" />
                <h2>{total === 0 && !session.newLevel ? "Na dziś pusto" : "Sesja zrobiona"}</h2>
                <p>{total === 0 && !session.newLevel ? "Dodaj temat w przedmiocie — jutro pojawią się tu powtórki." : session.newLevel ? "Zostało jeszcze jedno: nowy poziom. Wchodzisz?" : "Powtórki zaliczone. Do zobaczenia jutro."}</p>
                {total > 0 && (
                  <div className="statgrid mt-2">
                    <StatCard icon="bolt" label="XP" value={gained} tone="gold" delay={0.1} />
                    <StatCard icon="target" label="Celność" tone="green" delay={0.2}>
                      <div className="flex items-center gap-3 mt-auto">
                        <Ring pct={acc} size={54} stroke={7} color={acc >= 70 ? "var(--play-green)" : "var(--play-orange)"}><span className="display text-[13px] font-extrabold text-txt">{acc}%</span></Ring>
                        <div className="text-[12px] font-bold text-muted leading-tight">{counts.reviewed} fiszek<br />{counts.answered} pytań</div>
                      </div>
                    </StatCard>
                    <StatCard icon="clock" label="Czas" tone="blue" delay={0.3}><div className="big">{fmtTime(elapsed)}</div></StatCard>
                    <StatCard icon="heart" label="Serce" tone="red" delay={0.4}><div className="big">+1<small>{unlimitedHearts ? "∞" : `→ ${hearts.hearts}`}</small></div></StatCard>
                  </div>
                )}
              </div>
              <div className="lessonfoot mt-auto">
                {session.newLevel && <Btn3d variant="green" size="lg" href={`/app/t/${session.newLevel.topicId}/l/${session.newLevel.levelId}`}>Nowy poziom: {session.newLevel.title}</Btn3d>}
                <Btn3d variant={session.newLevel ? "ghost" : "green"} href="/app">Wróć na start</Btn3d>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
      <FeedbackSheet fb={fb} onNext={next} streak={streak} />
    </div>
  );
}
