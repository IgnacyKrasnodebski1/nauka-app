"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { applyQuizResult, shuffle, XP, type MiniGame, type QuizQuestion } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { useMounted } from "@/lib/use-mounted";
import type { AppSubject } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SubjectTheme } from "@/components/subject/theme";
import { QuestionCard } from "@/components/subject/question";
import { GameView, GAME_LABEL } from "@/components/lesson/games";
import { Confetti } from "@/components/lesson/confetti";
import { TutorFab } from "@/components/tutor/tutor-drawer";

type Phase = "feed" | "cards" | "games" | "quiz" | "result";
const ORDER: Phase[] = ["feed", "cards", "games", "quiz", "result"];
const PHASE_LABEL: Record<Phase, string> = { feed: "📖 feed", cards: "🎴 fiszki", games: "🎮 mini-gry", quiz: "🧠 quiz", result: "🏁" };

export function Lesson({ subject, levelId }: { subject: AppSubject; levelId: string }) {
  const level = subject.levels.find((l) => l.id === levelId)!;
  const { addXp, progressOf, setProgress, toast } = useApp();
  const router = useRouter();
  const mounted = useMounted();
  const backHref = `/app/s/${subject.slug ?? subject.id}`;

  const feed = level.feed;
  const cards = useMemo(() => level.flashcards.slice(0, 10), [level]);
  const games = useMemo<MiniGame[]>(() => (level.games ?? []).slice(0, 4), [level]);
  const [round, setRound] = useState(0);
  const quiz = useMemo<QuizQuestion[]>(() => shuffle(level.quiz).slice(0, Math.min(8, level.quiz.length)), [level, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstPhase = (): Phase => (feed.length ? "feed" : cards.length ? "cards" : games.length ? "games" : quiz.length ? "quiz" : "result");
  const [phase, setPhase] = useState<Phase>(firstPhase);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [gained, setGained] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof applyQuizResult> | null>(null);

  const counts: Record<Phase, number> = { feed: feed.length, cards: cards.length, games: games.length, quiz: quiz.length, result: 0 };
  const totalSteps = feed.length + cards.length + games.length + quiz.length;
  const doneSteps = ORDER.slice(0, ORDER.indexOf(phase)).reduce((a, p) => a + counts[p], 0) + i;
  const pct = totalSteps ? Math.min(100, (doneSteps / totalSteps) * 100) : 100;

  const earn = (n: number) => {
    if (!n) return;
    addXp(subject, n);
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
    const r = applyQuizResult(progressOf(subject), level.id, score, quiz.length);
    if (quiz.length) {
      setProgress(subject, r.progress);
      addXp(subject, 0); // touches the streak for today
      setGained((g) => g + r.gained);
    } else {
      // no quiz in this level → passing is automatic
      const p = progressOf(subject);
      const prev = p.levels[level.id];
      setProgress(subject, { ...p, levels: { ...p.levels, [level.id]: { done: true, best: 100, stars: 3, attempts: (prev?.attempts ?? 0) + 1 } } });
    }
    setResult(r);
    setPhase("result");
  };

  const retry = () => {
    setRound((r) => r + 1);
    setScore(0);
    setGained(0);
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
        <span className="counter">{PHASE_LABEL[phase]}</span>
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
                {feed[i]!.real && <div className="real"><span className="lbl">po ludzku 🗣️</span><span dangerouslySetInnerHTML={{ __html: feed[i]!.real! }} /></div>}
                {feed[i]!.mnemo && <div className="mnemo"><span className="lbl">zapamiętaj 🧠</span><span dangerouslySetInnerHTML={{ __html: feed[i]!.mnemo! }} /></div>}
              </div>
            </div>
            <div className="lessonfoot !px-0">
              <button type="button" className="pill" onClick={() => { earn(XP.feedRead); step("feed"); }}>
                {i + 1 < feed.length ? "dalej →" : cards.length ? "lecimy z fiszkami 🎴" : games.length ? "czas na gry 🎮" : quiz.length ? "lecimy z quizem 🧠" : "zakończ ✅"}
              </button>
            </div>
          </>
        )}

        {mounted && phase === "cards" && cards[i] && (
          <>
            <div className="progressrow"><div className="counter">fiszka {i + 1}/{cards.length}</div></div>
            <div className={cn("flip mb-3", flipped && "flipped")}>
              <div className="flipinner" onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), setFlipped((f) => !f))} aria-label="Odwróć fiszkę">
                <div className="face front"><span className="tag">{level.title}</span><div className="term">{cards[i]!.t}</div><div className="tapomat">tapnij = odpowiedź 👀</div></div>
                <div className="face back"><span className="tag">odpowiedź ✅</span><div className="deftxt" dangerouslySetInnerHTML={{ __html: cards[i]!.d }} /><div className="tapomat">tapnij = wróć ↩</div></div>
              </div>
            </div>
            <div className="fbtns">
              <button type="button" className="fbtn no" onClick={() => step("cards")}>jeszcze nie 😵</button>
              <button type="button" className="fbtn yes" onClick={() => { earn(XP.flashcardKnown); step("cards"); }}>umiem 💪</button>
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
                toast(correct === total ? `perfekcyjnie! +${xp}xp 🟢` : `+${xp}xp · ${correct}/${total}`);
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
                tag={`pytanie ${i + 1}/${quiz.length}`}
                picked={picked}
                reveal={picked !== null}
                onPick={(k) => {
                  if (picked !== null) return;
                  setPicked(k);
                  if (k === quiz[i]!.c) {
                    setScore((s) => s + 1);
                    toast(`GIT +${XP.quizCorrect}xp 🟢`);
                  } else toast("mid, czytaj wyjaśnienie 👇");
                }}
              />
            </div>
            {picked !== null && (
              <div className="lessonfoot !px-0">
                <button type="button" className="pill pop" onClick={() => step("quiz")}>{i + 1 >= quiz.length ? "zobacz wynik 🏁" : "dalej →"}</button>
              </div>
            )}
          </>
        )}

        {mounted && phase === "result" && (
          <>
            {passed && <Confetti />}
            <div className="flex-1 result">
              <div className="big pop">{!passed ? "😵" : rpct >= 90 ? "👑" : rpct >= 70 ? "🔥" : "✅"}</div>
              <h2>{level.title}</h2>
              {quiz.length > 0 && (
                <div className="score">Trafione <b>{score}/{quiz.length}</b> ({rpct}%){passed ? ` · ${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}` : ""}</div>
              )}
              <div className="streak">⚡ +{gained} <small>xp</small></div>
              <p>
                {!passed
                  ? "Poniżej 50% — poziom niezaliczony. Przejedź feed jeszcze raz i spróbuj ponownie, dasz radę."
                  : rpct >= 90
                    ? "Mistrzostwo. Trzy gwiazdki, profesor by płakał ze szczęścia."
                    : rpct >= 70
                      ? "Solidnie! Poziom zaliczony, lecimy dalej."
                      : "Zaliczone na styk — wróć kiedyś po więcej gwiazdek."}
              </p>
            </div>
            <div className="lessonfoot !px-0 flex flex-col gap-2.5">
              {passed ? (
                <button type="button" className="pill" onClick={() => router.push(backHref)}>dalej na ścieżkę 🗺️</button>
              ) : (
                <button type="button" className="pill" onClick={retry}>spróbuj jeszcze raz 🔁</button>
              )}
              {passed && <button type="button" className="pill ghost" onClick={retry}>jeszcze raz po gwiazdki ⭐</button>}
            </div>
          </>
        )}
      </div>

      {phase !== "result" && <TutorFab subject={subject} levelId={level.id} />}
    </SubjectTheme>
  );
}
