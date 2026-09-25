"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { dayDiff, pl, shuffle, srsBox, todayStr, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { useDailyActions } from "@/lib/daily-plan";
import { deckEntries, srsEntries, topicCardEntries, topicQuizEntries, useSrsTouch, type SrsEntry } from "@/lib/review";
import { splitKey, testDone } from "@/lib/tests";
import { etaText, fmtDate, fmtSecs, inDays, noEmoji } from "@/lib/dates";
import { Shell } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { Confetti } from "@/components/ui/confetti";
import { themeStyle } from "@/components/ui/mono";
import { QuizBlock } from "@/components/lesson/quiz-block";
import { AnswerSheet, type AnswerFb } from "@/components/lesson/sheets";
import { useKeys } from "@/components/tasks/common";
import { useMounted } from "@/lib/use-mounted";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

const BLOCK = 300;
const TONE: Record<string, string> = { weak: "red", cards: "gold", quiz: "cyan", errors: "violet" };
interface Block { id: string; t: string; s: string; items: SrsEntry[] }

/** Cram.html — night before the exam: 4 five-minute blocks (weakest, cards in scope, 10 questions, exam errors), then "Idź spać". */
export function CramScreen({ topic, subject }: { topic: Topic; subject: Subject }) {
  const { ready, allSrs, overrides, weak, tests, setTests, allProgress, addXp, toast } = useApp();
  const { completeDaily } = useDailyActions();
  const touch = useSrsTouch();
  const router = useRouter();
  const sfx = useSfx();
  const mounted = useMounted();
  const test = tests.find((t) => t.subjectId === subject.id) ?? null;
  const scope = useMemo(() => { const lv = test ? test.levels.filter((k) => splitKey(k).topicId === topic.id).map((k) => splitKey(k).levelId) : []; return lv.length ? lv : topic.levels.map((l) => l.id); }, [test, topic]);
  const blocks = useMemo<Block[]>(() => {
    if (!ready || !mounted) return [];
    const srs = allSrs()[topic.id] ?? {};
    const mine = srsEntries([topic], allSrs(), overrides, [subject]).filter((x) => scope.includes(x.levelId));
    const weakest = mine.filter((x) => x.e.lapses > 0 || srsBox(x.e) <= 1).sort((a, b) => b.e.lapses - a.e.lapses || srsBox(a.e) - srsBox(b.e)).slice(0, 10);
    const cards = shuffle(topicCardEntries(topic, srs, subject).filter((c) => scope.includes(c.levelId))).slice(0, 12);
    const qs = shuffle(topicQuizEntries(topic, srs, overrides, subject, scope)).slice(0, 10);
    const deck = deckEntries(topic, weak, srs, overrides, subject);
    const errs = deck.length ? deck.slice(0, 10) : mine.filter((x) => x.kind === "quiz" && srsBox(x.e) === 0).slice(0, 10);
    const lvNames = scope.map((id) => noEmoji(topic.levels.find((l) => l.id === id)?.title)).filter(Boolean);
    const scopeTxt = scope.length === topic.levels.length ? "cały temat" : lvNames.slice(0, 2).join(", ") + (lvNames.length > 2 ? " +" + (lvNames.length - 2) : "");
    return [
      { id: "weak", t: "Najsłabsze pojęcia", s: weakest.length ? `${weakest.length} ${pl(weakest.length, "pojęcie, które", "pojęcia, które", "pojęć, które")} najczęściej mylisz` : "bez historii pomyłek — biorę fiszki z zakresu", items: weakest.length ? weakest : cards.slice(0, 8) },
      { id: "cards", t: "Fiszki z zakresu", s: `${cards.length} ${pl(cards.length, "fiszka", "fiszki", "fiszek")} · ${scopeTxt}`, items: cards },
      { id: "quiz", t: `${qs.length} ${pl(qs.length, "pytanie", "pytania", "pytań")}`, s: "jak na egzaminie, z wyjaśnieniami po każdym", items: qs },
      { id: "errors", t: "Błędy z egzaminu", s: deck.length ? `${errs.length} ${pl(errs.length, "pytanie", "pytania", "pytań")} z talii błędów` : errs.length ? "talia pusta — pytania, które ostatnio poszły źle" : "talia pusta i bez pomyłek — blok pominięty", items: errs },
    ].filter((b) => b.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mounted, topic.id, scope]);
  const [run, setRun] = useState<{ bi: number; ii: number; left: number; ok: number; bad: number; xp: number; marks: Record<number, "on" | "bad">; t0: number; done: boolean; doneAt?: number } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [pending, setPending] = useState<{ ok: boolean; fb: AnswerFb; it: SrsEntry } | null>(null);
  const x0 = useRef<number | null>(null);
  const swiped = useRef(false);
  const lastAdv = useRef(0);
  const back = `/app/t/${topic.id}?tab=egzamin`;
  const [toMid] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime(); });
  const total = blocks.length * 5;


  const finish = () => {
    if (!run || run.done) return;
    const totalA = run.ok + run.bad;
    if (totalA) { completeDaily(topic.id, "review"); const td = testDone(tests, subject.id, "review", allProgress()); if (td) setTests(td); }
    setRun({ ...run, done: true, doneAt: Date.now() });
    setPending(null);
    setTimeout(() => toast("Powtórka zapisana — dobranoc", "moon"), 400);
  };
  const nextBlock = (msg?: string) => {
    if (!run) return;
    setPending(null);
    setFlipped(false);
    if (run.bi + 1 >= blocks.length) return finish();
    setRun({ ...run, bi: run.bi + 1, ii: 0, left: BLOCK, marks: {} });
    toast(msg ?? "Blok gotowy", "check");
  };
  const answer = (it: SrsEntry, ok: boolean, xp: number) => {
    if (!run) return;
    touch(topic, it.key, ok);
    if (ok && xp) addXp(topic.id, xp);
    setRun({ ...run, ok: run.ok + (ok ? 1 : 0), bad: run.bad + (ok ? 0 : 1), xp: run.xp + (ok ? xp : 0), marks: { ...run.marks, [run.ii]: ok ? "on" : "bad" } });
  };
  const advance = () => {
    if (!run) return;
    setPending(null);
    setFlipped(false);
    const b = blocks[run.bi]!;
    if (run.ii + 1 >= b.items.length) nextBlock(); else setRun((r) => (r ? { ...r, ii: r.ii + 1 } : r));
  };
  const cardAns = (it: SrsEntry, ok: boolean) => { const t = Date.now(); if (t - lastAdv.current < 350) return; lastAdv.current = t; sfx.play(ok ? "correct" : "tap"); answer(it, ok, ok ? 2 : 0); setTimeout(advance, 0); };
  const start = () => setRun({ bi: 0, ii: 0, left: BLOCK, ok: 0, bad: 0, xp: 0, marks: {}, t0: Date.now(), done: false });
  const latest = useRef({ run, nextBlock });
  useEffect(() => {
    latest.current = { run, nextBlock };
  });
  const running = !!run && !run.done;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const r = latest.current.run;
      if (!r || r.done) return;
      if (r.left <= 1) latest.current.nextBlock("Czas na ten blok minął");
      else setRun({ ...r, left: r.left - 1 });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);
  useKeys((e) => {
    if (!run) { if (e.key === "Enter" && blocks.length) start(); return; }
    if (run.done) { if (e.key === "Enter") router.push("/app"); return; }
    const it = blocks[run.bi]?.items[run.ii];
    if (it?.kind === "card" && !pending) {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key === "ArrowLeft" || e.key === "1") cardAns(it, false);
      else if (e.key === "ArrowRight" || e.key === "2") cardAns(it, true);
    }
  });
  const style = themeStyle(subject.accent2);

  if (run?.done) {
    const doneAt = run.doneAt ?? run.t0;
    const totalA = run.ok + run.bad, pct = totalA ? Math.round((run.ok / totalA) * 100) : 0;
    const nb = Math.min(blocks.length, run.bi + (run.ii > 0 ? 1 : 0)) || blocks.length;
    const rows: [string, string, string][] = [["clock", "Rano: 5 minut", run.bad ? `${run.bad} ${pl(run.bad, "pojęcie, które", "pojęcia, które", "pojęć, które")} dziś nie weszło — wracają w powtórce` : "tylko fiszki z najsłabszych, bez nowych rzeczy"], ["close", "Przed egzaminem: nic nowego", "przejrzyj notatki, nie ucz się nowych rzeczy"], test ? ["calendar", "Sprawdzian: " + fmtDate(test.date), inDays(dayDiff(todayStr(), test.date)) + " · powodzenia"] : ["moon", "Teraz sen", "7–8 godzin robi więcej niż kolejna godzina nauki"]];
    return (
      <div className="lesson open rvrun cramdone" style={style}>
        <div className="lessonbody done">
          <div className="blob a-float" aria-hidden="true" />
          {pct >= 50 && <Confetti n={5} />}
          <div className="lc">
            <div className="lcbig moon a-pop"><Icon name="moon" size={64} /></div>
            <div className="lctxt a-up d2"><div className="lct">Idź spać</div><div className="lcs">{noEmoji(topic.short || topic.name)} · {nb} z {blocks.length} {pl(blocks.length, "bloku", "bloków", "bloków")} · {fmtSecs(Math.round((doneAt - run.t0) / 1000))}</div></div>
            <div className="lcstats a-up d3"><div className="lcstat acid"><div className="v">{run.ok}</div><div className="k under">umiem</div></div><div className="lcstat red"><div className="v">{run.bad}</div><div className="k under">do rana</div></div><div className="lcstat gold"><div className="v">+{run.xp}</div><div className="k under">XP</div></div></div>
            <div className="setcard rvlist a-up d4"><div className="eyebrow sec">Plan na jutro</div>{rows.map(([ic, tt, ss], i) => <div key={tt} className="contents">{i > 0 && <div className="setsep" />}<div className="setrow"><Icon name={ic} size={18} stroke={2.6} /><div className="grow"><div className="t">{tt}</div><div className="s">{ss}</div></div></div></div>)}</div>
          </div>
        </div>
        <div className="lessonfoot col"><Link href="/app" className="pill violet a-glow">DOBRANOC</Link><Link href={back} className="pill text">WRÓĆ DO EGZAMINU</Link></div>
      </div>
    );
  }
  if (run) {
    const b = blocks[run.bi]!, it = b.items[run.ii]!, warn = run.left <= 30;
    return (
      <div className="lesson open rvrun cramrun" style={style}>
        <div className="lessonhead cramhead">
          <button type="button" className="x" aria-label="Przerwij" onClick={() => (run.ok + run.bad > 0 ? finish() : setRun(null))}><Icon name="close" size={18} stroke={3} /></button>
          <div className="cramlbl"><div className="eyebrow">Blok {run.bi + 1} z {blocks.length}</div><div className="t">{b.t}</div></div>
          <div className={cn("egtimer cramclock", warn && "warn a-blink")}><Icon name="clock" size={15} /><span>{fmtSecs(Math.max(0, run.left))}</span></div>
        </div>
        <div className="egdrain cram"><i style={{ width: `${(Math.max(0, run.left) / BLOCK) * 100}%` }} /></div>
        <div className="segbar cramseg" aria-label={`${run.ii + 1} z ${b.items.length}`}>{b.items.map((_, i) => <i key={i} className={i < run.ii ? (run.marks[i] === "bad" ? "bad" : "on") : ""} />)}</div>
        <div className="lessonbody" key={`${run.bi}-${run.ii}`}>
          <div className="blob a-float" aria-hidden="true" />
          {it.kind === "card" ? (
            <div className={cn("flip themed a-up", flipped && "flipped")} role="button" tabIndex={0} aria-label={`Fiszka: ${it.c.t}`} onClick={() => { if (swiped.current) { swiped.current = false; return; } setFlipped((f) => !f); }} onPointerDown={(e) => { x0.current = e.clientX; }} onPointerUp={(e) => { if (x0.current == null) return; const dx = e.clientX - x0.current; x0.current = null; if (Math.abs(dx) > 80) { swiped.current = true; cardAns(it, dx > 0); } }}>
              <div className="flipinner"><div className="face front"><span className="tag accent">{it.lvl}</span><div className="term">{it.c.t}</div><div className="tapomat">dotknij, żeby odwrócić</div></div><div className="face back"><span className="tag">odpowiedź</span><div className="deftxt">{it.c.d}</div><div className="tapomat">dotknij, żeby wrócić</div></div></div>
            </div>
          ) : (
            <QuizBlock q={it.q} chips={<span className="qn">{it.lvl}</span>} api={{ footEl: null, finish: () => {} }} onAnswer={(_i, ok) => { sfx.play(ok ? "correct" : "wrong"); answer(it, ok, ok ? 3 : 0); setPending({ ok, fb: { e: it.q.e, q: it.q, src: it.q.src }, it }); }} />
          )}
          {pending?.ok && <Confetti n={4} />}
        </div>
        <div className="lessonfoot">
          {it.kind === "card" && <div className="fbtns"><button type="button" className="fbtn no" onClick={() => cardAns(it, false)}><Icon name="refresh" size={18} stroke={2.8} /> jeszcze nie</button><button type="button" className="fbtn yes" onClick={() => cardAns(it, true)}><Icon name="check" size={18} stroke={3.4} /> umiem</button></div>}
          <button type="button" className="pill text sm cramskip" onClick={() => nextBlock("Blok pominięty")}>Pomiń blok</button>
        </div>
        {pending && pending.it.kind === "quiz" && <AnswerSheet ok={pending.ok} fb={pending.fb} xp={3} mult={1} combo={0} ctx={{ topic, levelId: pending.it.levelId, qi: pending.it.idx }} onNext={advance} />}
      </div>
    );
  }
  return (
    <div className="contents" style={style}>
      <Shell title="Noc przed egzaminem" pills={false} backHref={back} cls="cram">
        {[0, 1, 2, 3, 4].map((i) => <i key={i} className={`cramstar a-blink d${(i % 6) + 1}`} />)}
        <div className="cramhero a-up"><Icon name="moon" size={64} className="ic-moon" /><div className="eyebrow">{noEmoji(topic.short || topic.name)} · {test ? "sprawdzian " + inDays(dayDiff(todayStr(), test.date)) : "ostatnia powtórka przed egzaminem"}</div><div className="cramtime a-blink">{total} min</div><div className="crams">do północy {etaText(toMid)} — potem sen utrwala to, co dziś powtórzysz</div></div>
        <div className="eyebrow sec">Plan na {total} minut</div>
        <div className="cramrows">
          {blocks.map((b, i) => <div key={b.id} className={cn("cramrow", TONE[b.id], "a-up", "d" + (i + 1))}><div className="num"><span>{i + 1}</span></div><div className="grow"><div className="t">{b.t}</div><div className="s">{b.s}</div></div><span className="min">5 min</span></div>)}
          {mounted && !blocks.length && <div className="sp">Brak fiszek i pytań w tym temacie.</div>}
        </div>
        <div className="cramnote a-up d5"><Icon name="info" size={18} stroke={2.4} /><span>Blok kończy się po 5 minutach albo gdy przejrzysz wszystko. Potem idź spać — sen utrwala to, czego się właśnie nauczyłeś.</span></div>
        <div className="cramfoot"><button type="button" className="pill violet a-glow" disabled={!blocks.length} onClick={start}>ZACZYNAM</button></div>
      </Shell>
    </div>
  );
}
