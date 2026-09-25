"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { markWeak, pl, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { useDailyActions } from "@/lib/daily-plan";
import { srsEntries, nextDueText, useSrsTouch, type SrsEntry } from "@/lib/review";
import { testDone } from "@/lib/tests";
import { noEmoji } from "@/lib/dates";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { Confetti } from "@/components/ui/confetti";
import { themeStyle } from "@/components/ui/mono";
import { QuizBlock } from "@/components/lesson/quiz-block";
import { AnswerSheet, type AnswerFb } from "@/components/lesson/sheets";
import { useKeys } from "@/components/tasks/common";
import { RingSvg } from "@/components/topic/exam";

const CARD_XP = 2, QUIZ_XP = 3;
export interface ReviewOutcome {
  ok: number;
  bad: number;
  xp: number;
  wrong: SrsEntry[];
  done: SrsEntry[];
  topics: Set<string>;
}

/**
 * Review session (legacy renderReviewSession): flashcards first (flip, swipe left/right), then questions with the
 * ok/bad sheets; no hearts, no combo. `deck` = the error deck of a topic (correct answers leave progress.weak).
 */
export function ReviewSession({ items: items0, deck, onExit, topics, onDone, cram }: { items: SrsEntry[]; deck?: string | null; onExit: () => void; topics: Topic[]; onDone?: (o: ReviewOutcome) => void; cram?: boolean }) {
  const { addXp, weak, setWeak, tests, setTests, allProgress, daily } = useApp();
  const router = useRouter();
  const { completeDaily, tickDaily } = useDailyActions();
  const touch = useSrsTouch();
  const sfx = useSfx();
  const [items, setItems] = useState(items0);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [marks, setMarks] = useState<Record<number, "on" | "bad">>({});
  const [o, setO] = useState<ReviewOutcome>({ ok: 0, bad: 0, xp: 0, wrong: [], done: [], topics: new Set() });
  const [pending, setPending] = useState<{ ok: boolean; fb: AnswerFb; it: SrsEntry } | null>(null);
  const [finished, setFinished] = useState(false);
  const [round, setRound] = useState(0);
  const lastAdv = useRef(0);
  const x0 = useRef<number | null>(null);
  const swiped = useRef(false);
  const it = items[idx];

  const answer = (item: SrsEntry, ok: boolean, xp: number) => {
    touch(item.topic, item.key, ok);
    const n: ReviewOutcome = { ...o, topics: new Set(o.topics).add(item.topic.id), done: [...o.done, item] };
    if (ok) { n.ok++; if (xp) { n.xp += xp; addXp(item.topic.id, xp); } } else { n.bad++; n.wrong = [...n.wrong, item]; }
    setO(n);
    setMarks((m) => ({ ...m, [idx]: ok ? "on" : "bad" }));
    tickDaily(item.topic.id, "review", 1);
    return n;
  };
  const finish = (out = o) => {
    if (finished) return;
    setFinished(true);
    const total = out.ok + out.bad;
    if (deck) {
      const t = topics.find((x) => x.id === deck);
      if (t && total) {
        const okByLv: Record<string, number[]> = {};
        for (const w of out.done) if (!out.wrong.includes(w) && w.kind === "quiz") (okByLv[w.levelId] ??= []).push(w.idx);
        let w2 = weak;
        for (const [lv, right] of Object.entries(okByLv)) w2 = markWeak(w2, t.id, lv, [], right);
        if (w2 !== weak) setWeak(w2, t.id);
        completeDaily(t.id, "weak");
        const td = testDone(tests, t.subjectId, "weak", allProgress());
        if (td) setTests(td);
      }
    } else if (total) {
      let doneAny = false;
      for (const tid of out.topics) if (completeDaily(tid, "review")) doneAny = true;
      if (!doneAny && daily) { const row = daily.tasks.find((x) => !x.done && /:review$/.test(x.id)); if (row) completeDaily(row.id.split(":")[0]!, "review"); }
      let ts = tests;
      for (const tid of out.topics) { const t = topics.find((x) => x.id === tid); if (t) { const td = testDone(ts, t.subjectId, "review", allProgress()); if (td) ts = td; } }
      if (ts !== tests) setTests(ts);
    }
    onDone?.(out);
  };
  const advance = (n: ReviewOutcome) => {
    setPending(null);
    setFlipped(false);
    if (idx + 1 >= items.length) finish(n); else setIdx(idx + 1);
  };
  const cardAns = (ok: boolean) => {
    if (!it || it.kind !== "card") return;
    const t = Date.now();
    if (t - lastAdv.current < 350) return;
    lastAdv.current = t;
    sfx.play(ok ? "correct" : "tap");
    advance(answer(it, ok, ok ? CARD_XP : 0));
  };
  const closeX = () => (idx > 0 || o.ok + o.bad > 0 ? finish() : onExit());
  const restartWith = (list: SrsEntry[]) => { setItems(list); setIdx(0); setMarks({}); setO({ ok: 0, bad: 0, xp: 0, wrong: [], done: [], topics: new Set() }); setFinished(false); setFlipped(false); setRound((r) => r + 1); };
  const mainAction = () => (o.wrong.length ? restartWith(o.wrong) : onExit());
  useKeys((e) => {
    if (finished || pending) { if (finished && e.key === "Enter") mainAction(); return; }
    if (it?.kind === "card") {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key === "ArrowLeft" || e.key === "1") cardAns(false);
      else if (e.key === "ArrowRight" || e.key === "2") cardAns(true);
    }
  });

  if (finished) return <ReviewDone o={o} onMain={mainAction} onAlt={onExit} cram={cram} topics={topics} />;
  if (!it) return null;

  return (
    <div className="lesson open rvrun" key={round}>
      <div className="lessonhead">
        <button type="button" className="x" aria-label="Przerwij powtórkę" onClick={closeX}><Icon name="close" size={18} stroke={3} /></button>
        <div className="segbar" aria-label={`${idx + 1} z ${items.length}`}>{items.map((_, i) => <i key={i} className={i < idx ? (marks[i] === "bad" ? "bad" : "on") : ""} />)}</div>
        <div className="rvcount">{idx + 1} z {items.length}</div>
      </div>
      <div className="lessonbody" key={idx}>
        <div className="blob a-float cyan" aria-hidden="true" />
        {it.kind === "card" ? (
          <>
            <div
              className={cn("flip themed a-up", flipped && "flipped")}
              style={themeStyle(it.subject?.accent2 ?? it.topic.accent2)}
              role="button"
              tabIndex={0}
              aria-label={`Fiszka: ${it.c.t}. Dotknij, żeby odwrócić`}
              onClick={() => { if (swiped.current) { swiped.current = false; return; } setFlipped((f) => !f); }}
              onPointerDown={(e) => { x0.current = e.clientX; }}
              onPointerUp={(e) => { if (x0.current == null) return; const dx = e.clientX - x0.current; x0.current = null; if (Math.abs(dx) > 80) { swiped.current = true; cardAns(dx > 0); } }}
            >
              <div className="flipinner">
                <div className="face front"><span className="tag accent">{noEmoji(it.subject?.name ?? it.topic.short)} · {it.lvl}</span><div className="term">{it.c.t}</div><div className="tapomat">dotknij, żeby odwrócić</div></div>
                <div className="face back"><span className="tag">odpowiedź</span><div className="deftxt">{it.c.d}</div><div className="tapomat">dotknij, żeby wrócić</div></div>
              </div>
            </div>
            <div className="swipehint3"><span className="l"><Icon name="back" size={16} stroke={2.8} className="a-bob" />w lewo = jeszcze nie</span><span className="r">w prawo = umiem<Icon name="chevron-right" size={16} stroke={2.8} className="a-bob d2" /></span></div>
          </>
        ) : (
          <QuizBlock
            q={it.q}
            chips={<span className="qn">{noEmoji(it.subject?.name ?? it.topic.short)} · {it.lvl}</span>}
            api={{ footEl: null, finish: () => {} }}
            onAnswer={(_i, ok) => {
              sfx.play(ok ? "correct" : "wrong");
              const n = answer(it, ok, ok ? QUIZ_XP : 0);
              setO(n);
              setPending({ ok, fb: { e: it.q.e, q: it.q, src: it.q.src }, it });
            }}
          />
        )}
        {pending?.ok && <Confetti n={4} />}
      </div>
      {it.kind === "card" && (
        <div className="lessonfoot">
          <div className="fbtns">
            <button type="button" className="fbtn no" onClick={() => cardAns(false)}><Icon name="refresh" size={18} stroke={2.8} /> jeszcze nie</button>
            <button type="button" className="fbtn yes" onClick={() => cardAns(true)}><Icon name="check" size={18} stroke={3.4} /> umiem</button>
          </div>
        </div>
      )}
      {pending && pending.it.kind === "quiz" && (
        <AnswerSheet ok={pending.ok} fb={pending.fb} xp={QUIZ_XP} mult={1} combo={0} ctx={{ topic: pending.it.topic, levelId: pending.it.levelId, qi: pending.it.idx }} onNext={() => advance(o)} onCards={() => { onExit(); router.push(`/app/t/${pending.it.topic.id}?tab=fiszki`); }} />
      )}
    </div>
  );
}

/** FlashcardsDone.html: accuracy ring, umiem / do powtórki / +XP, "Wracają dziś" or next due, streak card. */
function ReviewDone({ o, onMain, onAlt, cram, topics }: { o: ReviewOutcome; onMain: () => void; onAlt: () => void; cram?: boolean; topics: Topic[] }) {
  const { streak, daily, allSrs, overrides, srsOf } = useApp();
  const total = o.ok + o.bad, pct = total ? Math.round((o.ok / total) * 100) : 0;
  const cards = o.done.filter((x) => x.kind === "card").length, qs = o.done.length - cards;
  const subsTxt = [...o.topics].map((id) => { const t = topics.find((x) => x.id === id); return t ? noEmoji(t.short || t.name) : ""; }).filter(Boolean).join(" · ");
  const nd = nextDueText(srsEntries(topics, allSrs(), overrides));
  const dd = daily?.tasks.filter((t) => t.done).length ?? 0, dt = daily?.tasks.length ?? 0;
  return (
    <div className={cn("lesson open rvrun", cram && "cramdone")}>
      <div className="lessonbody done">
        <div className="blob a-float cyan" aria-hidden="true" />
        {pct >= 50 && <Confetti n={6} />}
        <div className="lc">
          <div className="rvring a-pop"><RingSvg pct={pct} R={52} /><div className="rvpct"><b>{pct}%</b><span>umiem</span></div></div>
          <div className="lctxt a-up d2"><div className="lct">Powtórka skończona</div><div className="lcs">{subsTxt ? subsTxt + " · " : ""}{cards} {pl(cards, "pojęcie", "pojęcia", "pojęć")}{qs ? ` · ${qs} ${pl(qs, "pytanie", "pytania", "pytań")}` : ""}</div></div>
          <div className="lcstats a-up d3"><div className="lcstat acid"><div className="v">{o.ok}</div><div className="k under">umiem</div></div><div className="lcstat red"><div className="v">{o.bad}</div><div className="k under">do powtórki</div></div><div className="lcstat gold"><div className="v">+{o.xp}</div><div className="k under">XP</div></div></div>
          <div className="setcard rvlist a-up d4">
            {o.wrong.length ? (
              <>
                <div className="eyebrow sec">Wracają dziś</div>
                {o.wrong.slice(0, 3).map((w, i) => { const e = srsOf(w.topic.id)[w.key]; return <div key={w.topic.id + w.key} className="contents">{i > 0 && <div className="setsep" />}<div className="setrow"><i className="rdot red" /><span className="t grow">{w.kind === "card" ? w.c.t : w.q.q}</span><span className="v">{(e?.reps ?? 0) + (e?.lapses ?? 0) || 1}. raz</span></div></div>; })}
                {o.wrong.length > 3 && <><div className="setsep" /><div className="setrow"><span className="t muted">i {o.wrong.length - 3} {pl(o.wrong.length - 3, "kolejne", "kolejne", "kolejnych")}</span></div></>}
              </>
            ) : (
              <div className="setrow"><i className="rdot gold" /><span className="t grow">Najbliższa powtórka</span><span className="v acid">{nd || "gdy dojdą nowe pojęcia"}</span></div>
            )}
          </div>
          <Link href="/app/streak" className="lcstreak a-up d5"><div className="ico"><Icon name="flame" size={24} /></div><div className="grow"><div className="t">{streak} {pl(streak, "dzień", "dni", "dni")} z rzędu</div><div className="s">{dt && dd >= dt ? "Plan dnia zrobiony" : `Plan dnia: ${dd} z ${dt}`}{nd ? " · następna powtórka " + nd : ""}</div></div><Icon name="chevron-right" size={20} /></Link>
        </div>
      </div>
      <div className="lessonfoot col">
        <button type="button" className="pill cyan a-glow" onClick={onMain}>{o.wrong.length ? `POWTÓRZ TE ${o.wrong.length}` : "GOTOWE"}</button>
        <button type="button" className="pill text" onClick={onAlt}>NA DZIŚ WYSTARCZY</button>
      </div>
    </div>
  );
}
