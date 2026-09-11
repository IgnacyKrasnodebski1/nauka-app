"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { applyQuizResult, markWeak, shuffle, XP, type MiniGame, type QuizQuestion, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";
import { SubjectTheme } from "@/components/topic/theme";
import { QuestionCard } from "@/components/topic/question";
import { GameView, GAME_LABEL } from "@/components/lesson/games";
import { Confetti } from "@/components/lesson/confetti";
import { XpCounter } from "@/components/lesson/xp-counter";
import { TutorFab } from "@/components/tutor/tutor-drawer";

type Phase = "feed" | "cards" | "games" | "quiz" | "result";
const ORDER: Phase[] = ["feed", "cards", "games", "quiz", "result"];
const PHASE_LABEL: Record<Phase, string> = { feed: "Feed", cards: "Fiszki", games: "Mini-gry", quiz: "Quiz", result: "Wynik" };

export function Lesson({ topic, subject, levelId }: { topic: Topic; subject: Subject; levelId: string }) {
  const level = topic.levels.find((l) => l.id === levelId)!;
  const { addXp, progressOf, setProgress, toast, weak, setWeak, logActivity } = useApp();
  const router = useRouter();
  const mounted = useMounted();
  const backHref = `/app/t/${topic.id}`;
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const feed = level.feed;
  const cards = useMemo(() => level.flashcards.slice(0, 10), [level]);
  const games = useMemo<MiniGame[]>(() => (level.games ?? []).slice(0, 4), [level]);
  const [round, setRound] = useState(0);
  // keep original indices so wrong answers can be stored in progress.weak
  const quiz = useMemo<(QuizQuestion & { qi: number })[]>(() => shuffle(level.quiz.map((q, qi) => ({ ...q, qi }))).slice(0, Math.min(8, level.quiz.length)), [level, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstPhase = (): Phase => (feed.length ? "feed" : cards.length ? "cards" : games.length ? "games" : quiz.length ? "quiz" : "result");
  const [phase, setPhase] = useState<Phase>(firstPhase);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<{ qi: number; ok: boolean }[]>([]);
  const [gained, setGained] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof applyQuizResult> | null>(null);

  const counts: Record<Phase, number> = { feed: feed.length, cards: cards.length, games: games.length, quiz: quiz.length, result: 0 };
  const totalSteps = feed.length + cards.length + games.length + quiz.length;
  const doneSteps = ORDER.slice(0, ORDER.indexOf(phase)).reduce((a, p) => a + counts[p], 0) + i;
  const pct = totalSteps ? Math.min(100, (doneSteps / totalSteps) * 100) : 100;

  const earn = (n: number) => {
    if (!n) return;
    addXp(topic.id, n);
    setGained((g) => g + n);
  };

  const advance = (from: Phase) => {
    let next = ORDER[ORDER.indexOf(from) + 1]!;
    while (next !== "result" && counts[next] === 0) next = ORDER[ORDER.indexOf(next) + 1]!;
    setI(0);
    setFlipped(false);
    setPicked(null);
    if (next === "result") finish();
    else setPhase(next);
  };
  const step = (from: Phase) => {
    if (i + 1 < counts[from]) {
      setI(i + 1);
      setPicked(null);
      setFlipped(false);
    } else advance(from);
  };

  const finish = () => {
    const r = applyQuizResult(progressOf(topic.id), level.id, score, quiz.length);
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    if (quiz.length) {
      setProgress(topic.id, r.progress);
      addXp(topic.id, 0); // touches the streak for today
      setGained((g) => g + r.gained);
      // remember what didn't stick → tomorrow's session
      setWeak(markWeak(weak, topic.id, level.id, answers.filter((a) => !a.ok).map((a) => a.qi), answers.filter((a) => a.ok).map((a) => a.qi)), topic.id);
      logActivity(gained + r.gained, minutes);
    } else {
      // no quiz in this level → passing is automatic
      const p = progressOf(topic.id);
      const prev = p.levels[level.id];
      setProgress(topic.id, { ...p, levels: { ...p.levels, [level.id]: { done: true, best: 100, stars: 3, attempts: (prev?.attempts ?? 0) + 1 } } });
      logActivity(gained, minutes);
    }
    setResult(r);
    setPhase("result");
  };

  const retry = () => {
    setRound((r) => r + 1);
    setScore(0);
    setAnswers([]);
    setGained(0);
    startedAt.current = Date.now();
    setResult(null);
    setI(0);
    setPicked(null);
    setPhase(firstPhase());
  };

  const passed = quiz.length ? !!result?.passed : true;
  const stars = quiz.length ? (result?.stars ?? 0) : 3;
  const rpct = quiz.length ? (result?.pct ?? 0) : 100;

  return (
    <SubjectTheme s={subject} className="min-h-dvh flex flex-col">
      <div className="lessonhead">
        <Link href={backHref} className="x" aria-label="Zamknij lekcję">✕</Link>
        <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
        <span className="eyebrow">{PHASE_LABEL[phase]}</span>
      </div>

      <div className="flex-1 px-4 pb-4 flex flex-col">
        {!mounted && <div className="flex-1 flex items-center justify-center"><span className="spinner" aria-label="ładuję lekcję…" /></div>}
        {mounted && phase === "feed" && feed[i] && (
          <>
            <div className="flex-1 flex flex-col justify-center">
              <div className="fcard pop" key={i}>
                <span className="tag">{level.title} · {i + 1}/{feed.length}</span>
                <div className="ftitle">{feed[i]!.title}</div>
                <div className="fbody" dangerouslySetInnerHTML={{ __html: feed[i]!.body }} />
                {feed[i]!.real && <div className="real"><span className="lbl">Po ludzku</span><span dangerouslySetInnerHTML={{ __html: feed[i]!.real! }} /></div>}
                {feed[i]!.mnemo && <div className="mnemo"><span className="lbl">Zapamiętaj</span><span dangerouslySetInnerHTML={{ __html: feed[i]!.mnemo! }} /></div>}
              </div>
            </div>
            <div className="lessonfoot">
              <button type="button" className="pill" onClick={() => { earn(XP.feedRead); step("feed"); }}>
                {i + 1 < feed.length ? "Dalej" : cards.length ? "Do fiszek" : games.length ? "Do mini-gier" : quiz.length ? "Do quizu" : "Zakończ"}
              </button>
            </div>
          </>
        )}

        {mounted && phase === "cards" && cards[i] && (
          <>
            <div className="progressrow"><div className="counter">Fiszka {i + 1}/{cards.length}</div></div>
            <div className={cn("flip mb-3", flipped && "flipped")}>
              <div className="flipinner" onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), setFlipped((f) => !f))} aria-label="Odwróć fiszkę">
                <div className="face front"><span className="tag">{level.title}</span><div className="term">{cards[i]!.t}</div><div className="tapomat">tapnij, żeby odwrócić</div></div>
                <div className="face back"><span className="tag hue">Odpowiedź</span><div className="deftxt" dangerouslySetInnerHTML={{ __html: cards[i]!.d }} /><div className="tapomat">tapnij, żeby wrócić</div></div>
              </div>
            </div>
            <div className="fbtns">
              <button type="button" className="fbtn no" onClick={() => step("cards")}>Jeszcze nie</button>
              <button type="button" className="fbtn yes" onClick={() => { earn(XP.flashcardKnown); step("cards"); }}>Umiem</button>
            </div>
          </>
        )}

        {mounted && phase === "games" && games[i] && (
          <div className="qcard pop" key={`g${i}`}>
            <span className="tag">{GAME_LABEL[games[i]!.type]} · {i + 1}/{games.length}</span>
            <GameView
              game={games[i]!}
              onDone={(correct, total) => {
                const xp = correct * XP.gameCorrect;
                earn(xp);
                toast(correct === total ? `Bezbłędnie · +${xp} XP` : `+${xp} XP · ${correct}/${total}`);
                step("games");
              }}
            />
          </div>
        )}

        {mounted && phase === "quiz" && quiz[i] && (
          <>
            <div className="flex-1">
              <QuestionCard
                q={quiz[i]!}
                tag={`Pytanie ${i + 1} z ${quiz.length}`}
                picked={picked}
                reveal={picked !== null}
                onPick={(k) => {
                  if (picked !== null) return;
                  setPicked(k);
                  setAnswers((a) => [...a, { qi: quiz[i]!.qi, ok: k === quiz[i]!.c }]);
                  if (k === quiz[i]!.c) {
                    setScore((s) => s + 1);
                    toast(`+${XP.quizCorrect} XP`);
                  } else toast("Nie tym razem — zerknij na wyjaśnienie");
                }}
              />
            </div>
            {picked !== null && (
              <div className="lessonfoot">
                <button type="button" className="pill pop" onClick={() => step("quiz")}>{i + 1 >= quiz.length ? "Zobacz wynik" : "Dalej"}</button>
              </div>
            )}
          </>
        )}

        {mounted && phase === "result" && (
          <>
            {passed && <Confetti />}
            <div className="flex-1 result">
              <span className="tag">{level.title}</span>
              <XpCounter value={gained} />
              {quiz.length > 0 && (
                <div className="starrow" aria-label={`${stars} z 3 gwiazdek`}>
                  {[0, 1, 2].map((k) => <span key={k} className={k < stars ? "" : "off"}>★</span>)}
                </div>
              )}
              <h2>{!passed ? "Poziom niezaliczony" : rpct >= 90 ? "Mistrzowsko" : rpct >= 70 ? "Solidnie" : "Zaliczone"}</h2>
              {quiz.length > 0 && <div className="score">Trafione <b>{score}/{quiz.length}</b> · {rpct}%</div>}
              <p>
                {!passed
                  ? "Poniżej 50%. Przejedź feed jeszcze raz i spróbuj ponownie — to wchodzi za drugim razem."
                  : rpct >= 90
                    ? "Trzy gwiazdki. Ten poziom masz w małym palcu."
                    : rpct >= 70
                      ? "Poziom zaliczony, lecimy dalej."
                      : "Zaliczone na styk — wróć kiedyś po więcej gwiazdek."}
              </p>
            </div>
            <div className="lessonfoot flex flex-col gap-2.5">
              {passed ? (
                <button type="button" className="pill" onClick={() => router.push(backHref)}>Dalej na ścieżkę</button>
              ) : (
                <button type="button" className="pill" onClick={retry}>Spróbuj jeszcze raz</button>
              )}
              {passed && <button type="button" className="pill ghost" onClick={retry}>Jeszcze raz po gwiazdki</button>}
            </div>
          </>
        )}
      </div>

      {phase !== "result" && <TutorFab topic={topic} levelId={level.id} />}
    </SubjectTheme>
  );
}
