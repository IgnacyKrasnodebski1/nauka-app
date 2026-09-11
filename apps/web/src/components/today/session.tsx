"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buildDailySession, markWeak, newCard, review, XP, type DailySession, type SrsGrade, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { QuestionCard } from "@/components/topic/question";
import { Confetti } from "@/components/lesson/confetti";
import { cn } from "@/lib/utils";

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

function SessionRunner({ topics }: { topics: Topic[] }) {
  const { allProgress, allSrs, weak, srsOf, setSrs, setWeak, addXp, logActivity, toast } = useApp();
  const [session] = useState<DailySession>(() => buildDailySession(topics, allProgress(), allSrs(), weak));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [gained, setGained] = useState(0);
  const [done, setDone] = useState(false);
  const startedAt = useRef(0);
  const logged = useRef(false);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const byId = Object.fromEntries(topics.map((t) => [t.id, t]));
  const items = session.items.filter((it) => it.kind !== "new");
  const item = items[i];
  const earn = (topicId: string, n: number) => {
    addXp(topicId, n);
    setGained((g) => g + n);
  };
  const next = () => {
    setFlipped(false);
    setPicked(null);
    if (i + 1 < items.length) setI(i + 1);
    else finish();
  };
  const finish = () => {
    if (!logged.current) {
      logged.current = true;
      logActivity(gained, Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)));
    }
    setDone(true);
  };
  const grade = (g: SrsGrade) => {
    if (!item?.card) return;
    const srs = srsOf(item.topicId);
    setSrs(item.topicId, { ...srs, [item.card.key]: review(srs[item.card.key] ?? newCard(), g) });
    if (g >= 2) earn(item.topicId, XP.flashcardKnown);
    next();
  };
  const answer = (k: number) => {
    if (!item?.question || picked !== null) return;
    setPicked(k);
    const q = item.question;
    const qi = byId[item.topicId]?.levels.find((l) => l.id === q.levelId)?.quiz.findIndex((x) => x.q === q.q) ?? -1;
    const ok = k === q.c;
    if (qi >= 0) setWeak(markWeak(weak, item.topicId, q.levelId, ok ? [] : [qi], ok ? [qi] : []), item.topicId);
    if (ok) {
      earn(item.topicId, XP.quizCorrect);
      toast(`GIT +${XP.quizCorrect}xp 🟢`);
    } else toast("jeszcze raz jutro 👇");
  };

  const total = items.length;
  const pct = total ? (Math.min(i, total) / total) * 100 : 100;

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="lessonhead">
        <Link href="/app" className="x" aria-label="Zamknij sesję">✕</Link>
        <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${done ? 100 : pct}%` }} /></div>
        <span className="counter">⚡ dziś</span>
      </div>
      <div className="flex-1 px-4 pb-4 flex flex-col">
        {done || (!item && !session.newLevel) ? (
          <>
            {gained > 0 && <Confetti n={40} />}
            <div className="flex-1 result">
              <div className="big pop">{total === 0 && !session.newLevel ? "🫥" : "🎉"}</div>
              <h2>{total === 0 && !session.newLevel ? "Na dziś pusto" : "Sesja zrobiona"}</h2>
              {total > 0 && <div className="streak">⚡ +{gained} <small>xp</small></div>}
              <p>{total === 0 && !session.newLevel ? "Dodaj temat w przedmiocie — jutro pojawią się tu powtórki." : session.newLevel ? "Zostało jeszcze jedno: nowy poziom. Wchodzisz?" : "Powtórki zaliczone. Do zobaczenia jutro 🔥"}</p>
            </div>
            <div className="lessonfoot !px-0 flex flex-col gap-2.5">
              {session.newLevel && <Link href={`/app/t/${session.newLevel.topicId}/l/${session.newLevel.levelId}`} className="pill">🆕 {session.newLevel.title} →</Link>}
              <Link href="/app" className="pill ghost">wróć na start</Link>
            </div>
          </>
        ) : !item ? (
          <>
            <div className="flex-1 result">
              <div className="big">🆕</div>
              <h2>Nowy poziom</h2>
              <p>Powtórek dziś brak — czas na coś nowego: <b>{session.newLevel!.title}</b>.</p>
            </div>
            <div className="lessonfoot !px-0"><Link href={`/app/t/${session.newLevel!.topicId}/l/${session.newLevel!.levelId}`} className="pill">lecimy →</Link></div>
          </>
        ) : item.kind === "review" && item.card ? (
          <>
            <div className="progressrow"><div className="counter">🎴 powtórka {i + 1}/{total} · {byId[item.topicId]?.name}</div></div>
            <div className={cn("flip mb-3", flipped && "flipped")}>
              <div className="flipinner" onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), setFlipped((f) => !f))} aria-label="Odwróć fiszkę">
                <div className="face front"><span className="tag">{byId[item.topicId]?.name}</span><div className="term">{item.card.t}</div><div className="tapomat">tapnij = odpowiedź 👀</div></div>
                <div className="face back"><span className="tag">odpowiedź ✅</span><div className="deftxt" dangerouslySetInnerHTML={{ __html: item.card.d }} /><div className="tapomat">tapnij = wróć ↩</div></div>
              </div>
            </div>
            <div className="fbtns">
              <button type="button" className="fbtn no" onClick={() => grade(0)}>nie 😵</button>
              <button type="button" className="fbtn mid" onClick={() => grade(1)}>trudne 🤔</button>
              <button type="button" className="fbtn yes" onClick={() => grade(2)}>dobrze 👍</button>
              <button type="button" className="fbtn yes" onClick={() => grade(3)}>easy 😎</button>
            </div>
          </>
        ) : item.question ? (
          <>
            <div className="flex-1">
              <QuestionCard q={item.question} tag={`🎯 słabe ${i + 1}/${total} · ${byId[item.topicId]?.name ?? ""}`} picked={picked} reveal={picked !== null} onPick={answer} />
            </div>
            {picked !== null && <div className="lessonfoot !px-0"><button type="button" className="pill pop" onClick={next}>{i + 1 >= total ? "koniec 🏁" : "dalej →"}</button></div>}
          </>
        ) : null}
      </div>
    </div>
  );
}
