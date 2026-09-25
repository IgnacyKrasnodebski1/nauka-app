"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyQuizResult, comboMultiplier, comboStep, comboTierHit, comboXp, emptyCombo, GEMS, markWeak, nextComboAt, shuffle, shuffleAnswers, XP, type ComboState, type MiniGame, type QuizQuestion, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { useMounted } from "@/lib/use-mounted";
import { burst } from "@/lib/confetti";
import { AnimatePresence, m } from "@/lib/motion";
import { useSfx } from "@/lib/sfx";
import { hueOf } from "@/lib/hue";
import { fmtTime } from "@/lib/utils";
import { SubjectTheme } from "@/components/topic/theme";
import { QuestionCard } from "@/components/topic/question";
import { GameView, GAME_LABEL } from "@/components/lesson/games";
import { TutorFab } from "@/components/tutor/tutor-drawer";
import { Btn3d } from "@/components/ui/btn3d";
import { ComboBadge } from "@/components/ui/combo-badge";
import { FeedbackSheet, type Feedback } from "@/components/ui/feedback-sheet";
import { Icon } from "@/components/ui/icons";
import { NoHeartsModal } from "@/components/ui/modals";
import { Hearts } from "@/components/ui/pills";
import { Ring } from "@/components/ui/ring";
import { SegmentedProgress } from "@/components/ui/segmented-progress";
import { StatCard } from "@/components/ui/stat-card";
import { SwipeDeck, type SwipeDir } from "@/components/ui/swipe-deck";
import { Mascot } from "@/components/mascot/mascot";

type Phase = "feed" | "cards" | "games" | "quiz" | "result";
const ORDER: Phase[] = ["feed", "cards", "games", "quiz", "result"];
const PHASE_LABEL: Record<Phase, string> = { feed: "Feed", cards: "Fiszki", games: "Mini-gry", quiz: "Quiz", result: "Wynik" };

const slide = { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40 }, transition: { type: "spring", stiffness: 320, damping: 30 } } as const;

export function Lesson({ topic, subject, levelId }: { topic: Topic; subject: Subject; levelId: string }) {
  const level = topic.levels.find((l) => l.id === levelId)!;
  const app = useApp();
  const { addXp, progressOf, setProgress, toast, weak, setWeak, logActivity, hearts, unlimitedHearts, loseHeart, gems, refillHearts, ready, streak, soundOn, setSoundOn, questEvent, bumpStats } = app;
  const router = useRouter();
  const sfx = useSfx();
  const mounted = useMounted();
  const backHref = `/app/t/${topic.id}`;
  const hue = hueOf({ name: subject.name, accent2: subject.accent2 });
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const feed = level.feed;
  const cards = useMemo(() => level.flashcards.slice(0, 10), [level]);
  const games = useMemo<MiniGame[]>(() => (level.games ?? []).slice(0, 4), [level]);
  const [round, setRound] = useState(0);
  // keep original indices so wrong answers can be stored in progress.weak
  const quiz = useMemo<(QuizQuestion & { qi: number })[]>(() => shuffle(level.quiz.map((q, qi) => ({ ...shuffleAnswers(q), qi }))).slice(0, Math.min(8, level.quiz.length)), [level, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstPhase = (): Phase => (feed.length ? "feed" : cards.length ? "cards" : games.length ? "games" : quiz.length ? "quiz" : "result");
  const [phase, setPhase] = useState<Phase>(firstPhase);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<{ qi: number; ok: boolean }[]>([]);
  const [gained, setGained] = useState(0);
  const [gemsWon, setGemsWon] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof applyQuizResult> | null>(null);
  const [combo, setCombo] = useState<ComboState>(emptyCombo);
  const [comboPulse, setComboPulse] = useState(0);
  const [fb, setFb] = useState<Feedback | null>(null);
  const fbNext = useRef<() => void>(() => {});
  const [outOfHearts, setOutOfHearts] = useState(false);
  const [deckCmd, setDeckCmd] = useState<{ n: number; dir: SwipeDir } | null>(null);
  const cardsReviewed = useRef(0);
  const cardsKnown = useRef(0);
  const [cardMarks, setCardMarks] = useState<("yes" | "no")[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const gamesWon = useRef(0);
  const finished = useRef(false);
  // refs mirror state that `finish()` reads from inside stale closures (feedback sheet → next → advance → finish)
  const scoreRef = useRef(0);
  const answersRef = useRef<{ qi: number; ok: boolean }[]>([]);
  const comboRef = useRef<ComboState>(emptyCombo());

  const counts: Record<Phase, number> = { feed: feed.length, cards: cards.length, games: games.length, quiz: quiz.length, result: 0 };
  const totalSteps = feed.length + cards.length + games.length + quiz.length;
  const doneSteps = ORDER.slice(0, ORDER.indexOf(phase)).reduce((a, p) => a + counts[p], 0) + i;
  // gate only the START of a lesson; losing the last heart mid-quiz ends via the feedback sheet ("Koniec lekcji")
  const blocked = ready && !unlimitedHearts && hearts.hearts === 0 && phase !== "result" && !outOfHearts && !fb && (phase !== "quiz" || answers.length === 0);

  const earn = (n: number) => {
    if (!n) return;
    addXp(topic.id, n);
    setGained((g) => g + n);
  };

  /** One answer anywhere in the lesson: combo, XP (with multiplier), hearts, sfx, quest events, feedback sheet. */
  const registerAnswer = (correct: boolean, base: number, text: ReactNode | null, next: () => void, opts: { heart?: boolean } = {}) => {
    const c = comboStep(comboRef.current, correct);
    comboRef.current = c;
    setCombo(c);
    let xp = 0, mult: 1 | 2 | 3 = 1;
    if (correct) {
      const r = comboXp(base, c.streak);
      xp = r.xp;
      mult = r.mult;
      earn(xp);
      if (comboTierHit(c.streak)) {
        setComboPulse((p) => p + 1);
        sfx.play("combo");
      } else sfx.play("correct");
    } else sfx.play("wrong");
    questEvent({ type: "answer", correct, combo: c.streak });
    let lostAll = false;
    if (!correct && opts.heart) {
      const v = loseHeart();
      lostAll = !v.unlimited && v.hearts === 0;
    }
    if (text === null) {
      next();
      return;
    }
    fbNext.current = () => {
      setFb(null);
      if (lostAll) {
        setOutOfHearts(true);
        finish(true);
      } else next();
    };
    setFb({ ok: correct, text, xp, mult, heart: !correct && opts.heart && !unlimitedHearts, cta: lostAll ? "Koniec lekcji" : undefined });
  };

  const advance = (from: Phase) => {
    let next = ORDER[ORDER.indexOf(from) + 1]!;
    while (next !== "result" && counts[next] === 0) next = ORDER[ORDER.indexOf(next) + 1]!;
    setI(0);
    setPicked(null);
    if (next === "result") finish();
    else setPhase(next);
  };
  const step = (from: Phase) => {
    if (i + 1 < counts[from]) {
      setI(i + 1);
      setPicked(null);
    } else advance(from);
  };

  const finish = (failedByHearts = false) => {
    if (finished.current) return;
    finished.current = true;
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
    let r: ReturnType<typeof applyQuizResult>;
    const prevP = progressOf(topic.id);
    const prevLp = prevP.levels[level.id];
    const sc = failedByHearts ? 0 : scoreRef.current;
    const ans = answersRef.current;
    if (quiz.length) {
      r = applyQuizResult(prevP, level.id, sc, quiz.length);
      setProgress(topic.id, r.progress);
      // per-answer XP was granted live (with combo) — add only the level bonuses here
      const bonus = r.gained - sc * XP.quizCorrect;
      addXp(topic.id, bonus);
      setGained((g) => g + bonus);
      setWeak(markWeak(weak, topic.id, level.id, ans.filter((a) => !a.ok).map((a) => a.qi), ans.filter((a) => a.ok).map((a) => a.qi)), topic.id);
    } else {
      const prev = prevP.levels[level.id];
      const np = { ...prevP, levels: { ...prevP.levels, [level.id]: { done: true, best: 100, stars: 3 as const, attempts: (prev?.attempts ?? 0) + 1 } } };
      setProgress(topic.id, np);
      addXp(topic.id, 0);
      r = { progress: np, gained: 0, passed: true, pct: 100, stars: 3 };
    }
    logActivity(0, minutes);
    // gems + stats + quests
    let g = 0;
    const newlyPassed = r.passed && !prevLp?.done;
    const newlyPerfect = r.pct === 100 && (prevLp?.best ?? 0) < 100;
    if (newlyPassed) g += GEMS.levelPass;
    if (newlyPerfect) g += GEMS.levelPerfect;
    if (g) {
      app.addGems(g);
      setGemsWon(g);
    }
    bumpStats((s) => ({
      levelsDone: s.levelsDone + (newlyPassed ? 1 : 0),
      perfectLevels: s.perfectLevels + (newlyPerfect ? 1 : 0),
      comboBest: Math.max(s.comboBest, comboRef.current.best),
      cardsReviewed: s.cardsReviewed + cardsReviewed.current,
    }));
    if (cardsReviewed.current) questEvent({ type: "review", count: cardsReviewed.current });
    if (r.passed) questEvent({ type: "level", perfect: r.pct === 100 });
    setResult(r);
    setPhase("result");
    if (r.passed) {
      sfx.play("levelup");
      burst(r.pct === 100 ? "perfect" : "level", hue);
    }
  };

  const retry = () => {
    finished.current = false;
    setRound((r) => r + 1);
    setScore(0);
    setAnswers([]);
    setGained(0);
    setGemsWon(0);
    setCombo(emptyCombo());
    comboRef.current = emptyCombo();
    scoreRef.current = 0;
    answersRef.current = [];
    setOutOfHearts(false);
    cardsReviewed.current = 0;
    cardsKnown.current = 0;
    setCardMarks([]);
    gamesWon.current = 0;
    startedAt.current = Date.now();
    setResult(null);
    setI(0);
    setPicked(null);
    setPhase(firstPhase());
  };

  const passed = quiz.length ? !!result?.passed : true;
  const stars = quiz.length ? (result?.stars ?? 0) : 3;
  const rpct = quiz.length ? (result?.pct ?? 0) : 100;
  const acc = answers.length ? Math.round((answers.filter((a) => a.ok).length / answers.length) * 100) : rpct;

  return (
    <SubjectTheme s={subject} className="min-h-dvh flex flex-col">
      <div className="lessonhead">
        <Link href={backHref} className="x" aria-label="Zamknij lekcję" onClick={() => sfx.play("tap")}><Icon name="close" size={22} /></Link>
        <SegmentedProgress total={totalSteps} done={phase === "result" ? totalSteps : doneSteps} label={PHASE_LABEL[phase]} />
        <ComboBadge streak={combo.streak} pulse={comboPulse} />
        <Hearts view={hearts} compact />
        <button type="button" className="mutebtn" aria-label={soundOn ? "Wycisz dźwięki" : "Włącz dźwięki"} aria-pressed={!soundOn} onClick={() => setSoundOn(!soundOn)}>
          <Icon name={soundOn ? "volume" : "volume-off"} size={20} />
        </button>
        {phase !== "result" && <TutorFab topic={topic} levelId={level.id} compact />}
      </div>

      <div className="flex-1 px-4 pb-4 flex flex-col" style={{ paddingBottom: fb ? 260 : undefined }}>
        {!mounted && <div className="flex-1 flex items-center justify-center"><span className="spinner" aria-label="ładuję lekcję…" /></div>}
        <AnimatePresence mode="wait">
          {mounted && phase === "feed" && feed[i] && (
            <m.div key={`feed${i}`} {...slide} className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="tag !mb-0">{level.title} · {i + 1}/{feed.length}</span>
                <span className="xpchip"><Icon name="bolt" size={12} />+{XP.feedRead} XP</span>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <div className="fcard">
                  <div className="ftitle">{feed[i]!.title}</div>
                  <div className="fbody" dangerouslySetInnerHTML={{ __html: feed[i]!.body }} />
                  {feed[i]!.real && <div className="real"><span className="lbl">Po ludzku</span><span dangerouslySetInnerHTML={{ __html: feed[i]!.real! }} /></div>}
                  {feed[i]!.mnemo && <div className="mnemo"><span className="lbl">Zapamiętaj</span><span dangerouslySetInnerHTML={{ __html: feed[i]!.mnemo! }} /></div>}
                </div>
              </div>
              <div className="lessonfoot">
                <Btn3d variant="green" size="lg" onClick={() => { earn(XP.feedRead); step("feed"); }}>
                  {i + 1 < feed.length ? "Dalej" : cards.length ? "Do fiszek" : games.length ? "Do mini-gier" : quiz.length ? "Do quizu" : "Zakończ"}
                </Btn3d>
              </div>
            </m.div>
          )}

          {mounted && phase === "cards" && cards[i] && (
            <m.div key="cards" {...slide} className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="tag !mb-0">Fiszka {i + 1}/{cards.length}</span>
                <span className="text-muted text-[12px] font-bold">w prawo = umiem · w lewo = jeszcze nie</span>
              </div>
              <SwipeDeck
                items={cards}
                index={i}
                keyOf={(_, k) => `c${round}-${k}`}
                command={deckCmd}
                onSwipe={(dir) => {
                  cardsReviewed.current += 1;
                  setCardMarks((mk) => [...mk, dir === "left" ? "no" : "yes"]);
                  if (dir !== "left") {
                    cardsKnown.current += 1;
                    earn(XP.flashcardKnown);
                    sfx.play("correct");
                  } else sfx.play("tap");
                  step("cards");
                }}
                render={(c, { flipped }) => (
                  <div className={`flip ${flipped ? "flipped" : ""}`}>
                    <div className="flipinner">
                      <div className="face front"><span className="tag">{level.title}</span><div className="term">{c.t}</div><div className="tapomat">tapnij, żeby odwrócić</div></div>
                      <div className="face back"><span className="tag hue">Odpowiedź</span><div className="deftxt" dangerouslySetInnerHTML={{ __html: c.d }} /><div className="tapomat">tapnij, żeby wrócić</div></div>
                    </div>
                  </div>
                )}
              />
              <div className="fbtns mt-4">
                <Btn3d variant="red" onClick={() => setDeckCmd({ n: Date.now(), dir: "left" })}><Icon name="close" size={16} />Jeszcze nie</Btn3d>
                <Btn3d variant="green" onClick={() => setDeckCmd({ n: Date.now(), dir: "right" })}><Icon name="check" size={16} />Umiem</Btn3d>
              </div>
              <div className="card3d mt-4 flex items-center gap-3 !p-3.5">
                <Mascot state={cardMarks.length && cardMarks[cardMarks.length - 1] === "no" ? "think" : "idle"} size={56} streak={streak} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-txt">Talia: {cardMarks.filter((x) => x === "yes").length} umiem · {cardMarks.filter((x) => x === "no").length} do powtórki</div>
                  <div className="flex gap-1.5 mt-2 flex-wrap" aria-hidden="true">
                    {cards.map((_, k) => (
                      <span key={k} style={{ width: 14, height: 14, borderRadius: 5, background: cardMarks[k] === "yes" ? "var(--play-green)" : cardMarks[k] === "no" ? "var(--play-red)" : k === i ? "var(--play-blue)" : "var(--bg4)", boxShadow: "0 2px 0 rgba(0,0,0,0.4)" }} />
                    ))}
                  </div>
                  <div className="text-[11.5px] text-muted font-semibold mt-1.5">Każda znana fiszka = +{XP.flashcardKnown} XP. „Jeszcze nie” wraca w dziennej misji.</div>
                </div>
              </div>
            </m.div>
          )}

          {mounted && phase === "games" && games[i] && (
            <m.div key={`g${round}-${i}`} {...slide} className="fcard">
              <span className="tag">{GAME_LABEL[games[i]!.type]} · {i + 1}/{games.length}</span>
              <GameView
                game={games[i]!}
                onAnswer={(correct, text, next) => registerAnswer(correct, XP.gameCorrect, text, next)}
                onDone={(correct, total) => {
                  const won = correct === total;
                  if (won) gamesWon.current += 1;
                  questEvent({ type: "game", won });
                  toast(won ? "Bezbłędnie!" : `${correct}/${total}`, won ? "xp" : "info");
                  step("games");
                }}
              />
            </m.div>
          )}

          {mounted && phase === "quiz" && quiz[i] && (
            <m.div key={`q${round}-${i}`} {...slide} className="flex-1 flex flex-col">
              <QuestionCard
                q={quiz[i]!}
                tag={`Pytanie ${i + 1} z ${quiz.length}`}
                picked={picked}
                reveal={picked !== null}
                explain={false}
                onPick={(k) => {
                  if (picked !== null) return;
                  const q = quiz[i]!;
                  const ok = k === q.c;
                  setPicked(k);
                  answersRef.current = [...answersRef.current, { qi: q.qi, ok }];
                  setAnswers(answersRef.current);
                  if (ok) {
                    scoreRef.current += 1;
                    setScore(scoreRef.current);
                  }
                  registerAnswer(ok, XP.quizCorrect, <><b>Dlaczego:</b> {q.e}</>, () => step("quiz"), { heart: true });
                }}
              />
              <div className="card3d mt-auto flex items-center gap-3 !p-3.5" style={{ marginTop: "auto" }}>
                <Mascot state={combo.streak >= 5 ? "cheer" : combo.streak >= 2 ? "happy" : "think"} size={56} streak={streak} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-extrabold text-txt">
                    {combo.streak >= 2 ? `Combo ${combo.streak} — XP ×${comboMultiplier(combo.streak)}` : "Każda poprawna = +5 XP"}
                    {nextComboAt(combo.streak) ? ` · jeszcze ${nextComboAt(combo.streak)! - combo.streak} do ×${comboMultiplier(nextComboAt(combo.streak)!)}` : " · maks. mnożnik!"}
                  </div>
                  <div className="text-[11.5px] text-muted font-semibold mt-0.5">{unlimitedHearts ? "Pro: nieskończone serca." : `Błąd = −1 serce (masz ${hearts.hearts}). Zero serc kończy quiz.`} Trafione: {score}/{answers.length}.</div>
                </div>
              </div>
            </m.div>
          )}

          {mounted && phase === "result" && (
            <m.div key="result" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col">
              <div className="result">
                <Mascot state={passed ? "cheer" : "sad"} size={130} streak={streak} say={passed ? (rpct === 100 ? "Bezbłędnie!" : "Poziom zaliczony!") : outOfHearts ? "Serca się skończyły…" : "Prawie. Jeszcze raz?"} bubbleSide="top" />
                {quiz.length > 0 && (
                  <div className="starrow" aria-label={`${stars} z 3 gwiazdek`}>
                    {[0, 1, 2].map((k) => (
                      <m.span key={k} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.3 + k * 0.15 }} style={{ color: k < stars ? "var(--play-yellow)" : "var(--faint)", display: "inline-flex" }}>
                        <Icon name="star" size={38} />
                      </m.span>
                    ))}
                  </div>
                )}
                <h2>{!passed ? "Poziom niezaliczony" : rpct >= 90 ? "Mistrzowsko" : rpct >= 70 ? "Solidnie" : "Zaliczone"}</h2>
                <p>
                  {outOfHearts
                    ? "Zero serc = koniec quizu. Poczekaj na regenerację albo uzupełnij za klejnoty i wróć."
                    : !passed
                      ? "Poniżej 50%. Przejedź feed jeszcze raz i spróbuj ponownie — to wchodzi za drugim razem."
                      : rpct >= 90
                        ? "Trzy gwiazdki. Ten poziom masz w małym palcu."
                        : rpct >= 70
                          ? "Poziom zaliczony, lecimy dalej."
                          : "Zaliczone na styk — wróć kiedyś po więcej gwiazdek."}
                </p>
                <div className="statgrid mt-2">
                  <StatCard icon="bolt" label="XP" value={gained} tone="gold" delay={0.1} />
                  <StatCard icon="target" label="Celność" tone="green" delay={0.2}>
                    <div className="flex items-center gap-3 mt-auto">
                      <Ring pct={acc} size={54} stroke={7} color={acc >= 70 ? "var(--play-green)" : acc >= 50 ? "var(--play-orange)" : "var(--play-red)"}>
                        <span className="display text-[13px] font-extrabold text-txt">{acc}%</span>
                      </Ring>
                      <div className="text-[12px] font-bold text-muted leading-tight">{quiz.length ? `${score}/${quiz.length} w quizie` : "bez quizu"}<br />combo {combo.best}</div>
                    </div>
                  </StatCard>
                  <StatCard icon="clock" label="Czas" tone="blue" delay={0.3}>
                    <div className="big">{fmtTime(elapsed)}</div>
                  </StatCard>
                  <StatCard icon="gem" label="Klejnoty" value={gemsWon} tone="gem" delay={0.4} />
                </div>
              </div>
              <div className="lessonfoot mt-auto">
                {passed ? (
                  <Btn3d variant="green" size="lg" onClick={() => router.push(backHref)}>Dalej na ścieżkę</Btn3d>
                ) : (
                  <Btn3d variant="green" size="lg" onClick={retry} disabled={outOfHearts && !unlimitedHearts && hearts.hearts === 0}>Spróbuj jeszcze raz</Btn3d>
                )}
                {passed ? <Btn3d variant="ghost" onClick={retry}>Jeszcze raz po gwiazdki</Btn3d> : <Btn3d variant="ghost" href={backHref}>Wróć na ścieżkę</Btn3d>}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <FeedbackSheet fb={fb} onNext={() => fbNext.current()} streak={streak} />
      <NoHeartsModal open={blocked} hearts={hearts} gems={gems} onRefill={refillHearts} onClose={() => {}} backHref={backHref} />
    </SubjectTheme>
  );
}
