"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { allQuiz, dayDiff, markWeak, pl, shuffle, todayStr, type QuizQuestion, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { useDailyActions } from "@/lib/daily-plan";
import { qOf, type ExamEntry, type ExamRec } from "@/lib/store/extra";
import { testDone, type TestPlan } from "@/lib/tests";
import { fmtDate, fmtSecs, inDays, KEYS, noEmoji } from "@/lib/dates";
import { useUi } from "@/components/app/chrome";
import { useMounted } from "@/lib/use-mounted";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { Confetti } from "@/components/ui/confetti";
import { Sheet } from "@/components/ui/sheet";
import { EditSheet, SourceSheet, SrcLine } from "@/components/lesson/sheets";
import { useKeys } from "@/components/tasks/common";

/* ---- grading helpers (legacy exScale / exPass / exGrade) ---- */
export const exScale = (t: Topic): [number, string][] => (t.grading?.scale?.length ? t.grading.scale : [[90, "5"], [70, "4"], [50, "3"]]);
export const exPass = (t: Topic) => t.grading?.pass ?? 50;
export const exFailLabel = (t: Topic) => t.grading?.failLabel || "2 — niezaliczone";
export const examMin = (t: Topic) => t.grading?.examMin || 20;
export function exGrade(t: Topic, pct: number): string {
  for (const [min, lab] of exScale(t)) if (pct >= min) return lab;
  return exFailLabel(t);
}
export function gradeParts(g: string): [string, string] {
  const m = String(g).split(/\s*[—–/]\s*/);
  return [m[0]!, m.slice(1).join(" ")];
}
export const emptyRec = (): ExamRec => ({ n: 0, passed: 0 });

type PoolQ = QuizQuestion & { lvl: string; levelId: string; qi: number; edited?: boolean };
interface RunState {
  pool: PoolQ[];
  idx: number;
  pick: (number | null)[];
  flags: boolean[];
  limit: number;
  left: number;
  started: number;
}
interface ResultState {
  pool: PoolQ[];
  correct: number;
  blank: number;
  wrong: { q: PoolQ; sel: number | null; i: number }[];
  pct: number;
  grade: string;
  pass: number;
  passed: boolean;
  used: number;
  M: number;
  auto: boolean;
  newBest: boolean;
}

export function RingSvg({ pct, R = 48 }: { pct: number; R?: number }) {
  const C = Math.round(2 * Math.PI * R * 10) / 10;
  return (
    <svg viewBox="0 0 124 124" aria-hidden="true">
      <circle className="ring-bg" cx="62" cy="62" r={R} />
      <circle className="ring-fg" cx="62" cy="62" r={R} style={{ strokeDasharray: C, strokeDashoffset: Math.round(C * (1 - Math.max(0, Math.min(100, pct)) / 100) * 10) / 10 }} />
    </svg>
  );
}

/** ExamStart.html (tab) → ExamRun.html (full-screen) → Exam.html result. Exam = quiz questions only, no hearts, no SRS. */
export function ExamTab({ topic, subject, test }: { topic: Topic; subject: Subject; test: TestPlan | null }) {
  const { exams, overrides } = useApp();
  const { openTestSheet } = useUi();
  const rec = exams[topic.id] ?? emptyRec();
  const lim0 = examMin(topic);
  const [levels, setLevels] = useState<string[]>(() => topic.levels.map((l) => l.id));
  const [n, setN] = useState<number | "all">(20);
  const [lim, setLim] = useState(lim0);
  const [run, setRun] = useState<RunState | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const all = useMemo(() => allQuiz(topic).map((q) => ({ ...q, ...qOf(overrides, topic.id, q.levelId, q.qi, q) })) as PoolQ[], [topic, overrides]);
  const pool = all.filter((q) => levels.includes(q.levelId));
  const ALL = pool.length, TOTAL = all.length;
  const N = n === "all" ? ALL : Math.min(n, ALL);
  const allOn = levels.length === topic.levels.length;
  const scale = exScale(topic), pass = exPass(topic);
  const nOpts: [number | "all", string][] = ([[10, "10"], [20, "20"], ["all", "wszystkie · " + ALL]] as [number | "all", string][]).filter(([v]) => v === "all" || (v as number) < ALL);
  const lims = [...new Set([Math.max(5, Math.round(lim0 / 2)), lim0, lim0 * 2])].sort((a, b) => a - b).map((m) => [m, m + " min"] as [number, string]).concat([[0, "bez limitu"]]);
  const toggleLevel = (id: string) => {
    if (id === "all") return setLevels(allOn ? [topic.levels[0]!.id] : topic.levels.map((l) => l.id));
    const set = levels.includes(id) ? levels.filter((x) => x !== id) : topic.levels.map((l) => l.id).filter((x) => x === id || levels.includes(x));
    setLevels(set.length ? set : [id]);
  };
  const begin = () => {
    const p = shuffle(pool).slice(0, N);
    if (!p.length) return;
    setResult(null);
    setRun({ pool: p, idx: 0, pick: new Array(p.length).fill(null), flags: new Array(p.length).fill(false), limit: lim * 60, left: lim * 60, started: Date.now() });
  };

  if (result) return <ExamResult topic={topic} r={result} onExit={() => setResult(null)} onDeck={() => {}} />;
  if (run) return <ExamRun topic={topic} subject={subject} state={run} setState={setRun} onFinish={(r) => { setRun(null); setResult(r); }} onExit={() => setRun(null)} />;

  return (
    <>
      <div className="scroll exstart">
        <div className="egspecs a-up">
          <div className="egspec a-pop d1"><b>{N}</b><span>{pl(N, "pytanie", "pytania", "pytań")}</span></div>
          <div className="egspec a-pop d2"><b>{lim || "∞"}</b><span>{lim ? pl(lim, "minuta", "minuty", "minut") : "bez limitu"}</span></div>
          <div className="egspec a-pop d3"><b className="acid">{pass}%</b><span>próg</span></div>
        </div>
        <div className="egcard a-up d2">
          <div className="eglbl">Zakres</div>
          <button type="button" className={cn("egrow all", allOn && "on")} onClick={() => toggleLevel("all")}><span className="box">{allOn && <Icon name="check" size={14} stroke={4} />}</span><span className="t">Wszystkie poziomy</span><span className="n">{TOTAL}</span></button>
          {topic.levels.map((l) => {
            const on = levels.includes(l.id);
            return <button key={l.id} type="button" className={cn("egrow", on && "on")} aria-pressed={on} onClick={() => toggleLevel(l.id)}><span className="box">{on && <Icon name="check" size={14} stroke={4} />}</span><span className="t">{noEmoji(l.title)}</span><span className="n">{l.quiz.length}</span></button>;
          })}
        </div>
        <div className="egcard a-up d3">
          <div className="eglbl">Liczba pytań</div>
          <div className="egchips">{nOpts.map(([v, l]) => <button key={String(v)} type="button" className={cn("egchip", String(n) === String(v) && "on")} onClick={() => setN(v)}>{l}</button>)}</div>
          <div className="eglbl">Limit czasu</div>
          <div className="egchips">{lims.map(([v, l]) => <button key={v} type="button" className={cn("egchip", lim === v && "on")} onClick={() => setLim(v)}>{l}</button>)}</div>
          <div className="eglbl">Siatka ocen</div>
          <div className="egscale">{scale.map(([min, lab]) => <span key={min}><b>{gradeParts(lab)[0]}</b> od {min}%</span>)}<span><b className="fail">{gradeParts(exFailLabel(topic))[0]}</b> pod {pass}%</span></div>
        </div>
        <div className="egwarn a-up d4">
          <div className="eglbl">Warunki jak na prawdziwym</div>
          <div className="r"><Icon name="close" size={16} stroke={3} /><span>Brak żyć i podpowiedzi</span></div>
          <div className="r"><Icon name="close" size={16} stroke={3} /><span>Wyjaśnienia dopiero na końcu</span></div>
          <div className="r"><Icon name="check" size={16} stroke={3.4} className="ok" /><span>Możesz oznaczać pytania i do nich wracać</span></div>
        </div>
        <div className="eglast a-up d5">
          <div className={cn("ico", rec.best && "gold")}><Icon name={rec.best ? "trophy" : "chart"} size={22} stroke={2.4} /></div>
          <div className="grow">
            <div className="t">{rec.last ? "Ostatnie podejście" : "Jeszcze bez podejścia"}</div>
            <div className="s">{rec.last ? `${fmtDate(rec.last.date)} · ${rec.last.pct}% · ocena ${gradeParts(rec.last.grade)[0]}${rec.best && rec.best.pct > rec.last.pct ? ` · najlepiej ${rec.best.pct}%` : ""}` : "Pierwsze zawsze jest próbne. Wynik zapisuje się tutaj."}</div>
          </div>
        </div>
        {test ? (
          <Link href={`/app/testplan/${test.id}?from=topic:${topic.id}`} className="eglast a-up d6"><div className="ico"><Icon name="calendar" size={22} stroke={2.4} /></div><div className="grow"><div className="t">Sprawdzian {inDays(dayDiff(todayStr(), test.date))}</div><div className="s">plan dzień po dniu jest gotowy</div></div><Icon name="chevron-right" size={20} className="chev" /></Link>
        ) : (
          <button type="button" className="eglast a-up d6" onClick={() => openTestSheet(subject.id)}><div className="ico"><Icon name="calendar" size={22} stroke={2.4} /></div><div className="grow"><div className="t">Mam sprawdzian</div><div className="s">ułożę plan dzień po dniu do daty sprawdzianu</div></div><Icon name="chevron-right" size={20} className="chev" /></button>
        )}
        <Link href={`/app/cram/${topic.id}`} className="eglast cram a-up d6"><div className="ico violet"><Icon name="moon" size={22} /></div><div className="grow"><div className="t">Egzamin jutro?</div><div className="s">Noc przed egzaminem — 4 bloki po 5 minut, potem spać</div></div><Icon name="chevron-right" size={20} className="chev" /></Link>
      </div>
      <div className="egfoot">
        <button type="button" className="pill a-glow" disabled={!N} onClick={begin}>ZACZYNAM · {N} {pl(N, "PYTANIE", "PYTANIA", "PYTAŃ")}</button>
      </div>
    </>
  );
}

/** ExamRun.html: timer (blink under 2 min + draining bar), question grid sheet, flag, prev/next, finish sheet. */
function ExamRun({ topic, subject, state, setState, onFinish, onExit }: { topic: Topic; subject: Subject; state: RunState; setState: (s: RunState) => void; onFinish: (r: ResultState) => void; onExit: () => void }) {
  const { addXp, setWeak, weak, exams, setExam, bumpStats, tests, setTests, allProgress, setDaily, daily, toast } = useApp();
  const { completeDaily } = useDailyActions();
  const [sheet, setSheet] = useState<"grid" | "confirm" | null>(null);
  const ref = useRef(state);
  useEffect(() => {
    ref.current = state;
  }, [state]);
  const M = state.pool.length, q = state.pool[state.idx]!, sel = state.pick[state.idx], flag = state.flags[state.idx], last = state.idx + 1 >= M, warn = !!state.limit && state.left <= 120;
  const finished = useRef(false);

  const finish = (auto: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const ex = ref.current;
    let correct = 0, blank = 0;
    const wrong: ResultState["wrong"] = [];
    ex.pool.forEach((qq, i) => { const p = ex.pick[i]; if (p === qq.c) correct++; else { if (p == null) blank++; wrong.push({ q: qq, sel: p ?? null, i }); } });
    const pct = Math.round((correct / ex.pool.length) * 100), grade = exGrade(topic, pct), pass = exPass(topic), passed = pct >= pass;
    const used = ex.limit ? ex.limit - Math.max(0, ex.left) : Math.round((Date.now() - ex.started) / 1000);
    addXp(topic.id, correct * 3);
    completeDaily(topic.id, "exam");
    const td = testDone(tests, subject.id, "mock", allProgress());
    if (td) setTests(td);
    const rec = exams[topic.id] ?? emptyRec();
    const entry: ExamEntry = { pct, grade, correct, total: ex.pool.length, date: todayStr() };
    const newBest = !rec.best || pct > rec.best.pct;
    setExam(topic.id, { n: rec.n + 1, passed: rec.passed + (passed ? 1 : 0), best: newBest ? entry : rec.best, last: entry });
    bumpStats((s) => ({ examsPassed: s.examsPassed + (passed ? 1 : 0), bestExamPct: Math.max(s.bestExamPct ?? 0, pct) }));
    // error deck: wrong answers → progress.weak (one deck per topic, last exam replaces); Today gets "Powtórz błędy"
    let w = weak;
    const byLevel: Record<string, { wrong: number[]; right: number[] }> = {};
    ex.pool.forEach((qq, i) => { const b = (byLevel[qq.levelId] ??= { wrong: [], right: [] }); (ex.pick[i] === qq.c ? b.right : b.wrong).push(qq.qi); });
    for (const [lv, b] of Object.entries(byLevel)) w = markWeak(w, topic.id, lv, b.wrong, b.right);
    setWeak(w, topic.id);
    if (wrong.length && daily && daily.date === todayStr() && !daily.tasks.some((t) => t.id === topic.id + ":weak")) setDaily({ ...daily, tasks: [...daily.tasks, { id: topic.id + ":weak", done: false }] });
    onFinish({ pool: ex.pool, correct, blank, wrong, pct, grade, pass, passed, used, M: ex.pool.length, auto, newBest });
    if (auto) setTimeout(() => toast("Czas minął — egzamin zakończony", "clock"), 400);
  };
  // timer
  useEffect(() => {
    if (!state.limit) return;
    const t = setInterval(() => {
      const ex = ref.current;
      if (ex.left <= 1) { clearInterval(t); setState({ ...ex, left: 0 }); finish(true); return; }
      setState({ ...ex, left: ex.left - 1 });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.limit]);
  const select = (i: number) => setState({ ...state, pick: state.pick.map((p, k) => (k === state.idx ? (p === i ? null : i) : p)) });
  const goTo = (i: number) => { setSheet(null); setState({ ...ref.current, idx: Math.max(0, Math.min(M - 1, i)) }); };
  const next = () => (last ? setSheet("confirm") : goTo(state.idx + 1));
  useKeys((e) => {
    if (sheet) return;
    const k = (e.key || "").toLowerCase();
    const m = /^[1-5]$/.test(k) ? +k - 1 : "abcde".indexOf(k);
    if (k.length === 1 && m >= 0 && m < q.a.length) select(m);
    else if (k === "f") setState({ ...state, flags: state.flags.map((f, i) => (i === state.idx ? !f : f)) });
    else if (e.key === "ArrowLeft" && state.idx > 0) goTo(state.idx - 1);
    else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
  });
  const un = state.pick.filter((p) => p == null).length, fl = state.flags.filter(Boolean).length, firstUn = state.pick.findIndex((p) => p == null);

  return (
    <div className="lesson open egrun">
      <div className="eghead">
        <div className="egtop">
          <button type="button" className="x" aria-label="Zakończ egzamin" onClick={() => setSheet("confirm")}><Icon name="close" size={18} stroke={3} /></button>
          <div className="grow"><div className="egn">Pytanie {state.idx + 1} z {M}</div><div className="bar"><i style={{ width: `${Math.round((state.idx / M) * 100)}%` }} /></div></div>
          <button type="button" className={cn("egtimer", warn && "warn")} aria-label="Pozostały czas" onClick={() => toast(state.limit ? "Zostało " + fmtSecs(Math.max(0, state.left)) : "Egzamin bez limitu czasu", "clock")}><Icon name="clock" size={15} /><span className={cn(warn && "a-blink")}>{state.limit ? fmtSecs(Math.max(0, state.left)) : "—"}</span></button>
          <button type="button" className="eggridbtn" aria-label="Siatka pytań" onClick={() => setSheet("grid")}><Icon name="grid" size={20} stroke={2.4} /></button>
        </div>
        <div className={cn("egdrain", warn && "warn")}><i style={{ width: `${state.limit ? (Math.max(0, state.left) / state.limit) * 100 : 100}%` }} /></div>
      </div>
      <div className="lessonbody" key={state.idx}>
        <div className="quiz">
          <div className="qchips"><span className="qn">{noEmoji(q.lvl)}</span>{flag && <span className="combo">Do wrócenia</span>}</div>
          <div className="egqrow a-up"><div className="qq">{q.q}</div><button type="button" className={cn("egflag", flag && "on")} aria-pressed={flag} aria-label="Oznacz do wrócenia" onClick={() => setState({ ...state, flags: state.flags.map((f, i) => (i === state.idx ? !f : f)) })}><Icon name="bookmark" size={18} fill={flag} /></button></div>
          <div className="qopts">{q.a.map((a, i) => <button key={i} type="button" className={cn("qopt a-up", "d" + Math.min(6, i + 1), sel === i && "sel")} onClick={() => select(i)}><span className="k">{KEYS[i]}</span><span className="t">{a}</span></button>)}</div>
        </div>
      </div>
      <div className="lessonfoot egnav">
        <button type="button" className="pill ghost egprev" aria-label="Poprzednie pytanie" disabled={state.idx === 0} onClick={() => goTo(state.idx - 1)}><Icon name="back" size={20} stroke={3} /></button>
        <button type="button" className="pill violet a-glow" onClick={next}>{last ? "ZAKOŃCZ" : "DALEJ"}</button>
      </div>
      {sheet === "grid" && (
        <Sheet kind="eggrid" onClose={() => setSheet(null)} label="Pytania">
          <div className="shandle" />
          <div className="shead"><div className="st2">Pytania</div><button type="button" className="backbtn sclose" aria-label="Zamknij" onClick={() => setSheet(null)}><Icon name="close" size={18} stroke={3} /></button></div>
          <div className="egsquares">
            {state.pool.map((_, i) => {
              const st = i === state.idx ? "cur a-pulse" : state.flags[i] ? "flag" : state.pick[i] != null ? "ans" : "";
              return <button key={i} type="button" className={cn("egsq", st)} aria-label={`Pytanie ${i + 1}${state.flags[i] ? ", do wrócenia" : state.pick[i] != null ? ", z odpowiedzią" : ", bez odpowiedzi"}${i === state.idx ? ", bieżące" : ""}`} onClick={() => goTo(i)}>{i + 1}</button>;
            })}
          </div>
          <div className="eglegend"><span><i className="ans" />z odpowiedzią</span><span><i className="flag" />do wrócenia</span><span><i className="cur" />bieżące</span><span><i />puste</span></div>
        </Sheet>
      )}
      {sheet === "confirm" && (
        <Sheet kind="egconfirm" onClose={() => setSheet(null)} label="Zakończyć egzamin?">
          <div className="shandle" />
          <div className="shead"><div className="st2">Zakończyć egzamin?</div></div>
          <div className="egsum"><div className="egsumtile red a-pop d1"><b>{un}</b><span>bez odpowiedzi</span></div><div className="egsumtile gold a-pop d2"><b>{fl}</b><span>do wrócenia</span></div><div className="egsumtile acid a-pop d3"><b>{M - un}</b><span>z odpowiedzią</span></div></div>
          <p className="sp">{un ? "Pytania bez odpowiedzi liczą się jako błędne." : "Każde pytanie ma odpowiedź."}{fl ? " Oznaczone możesz jeszcze sprawdzić." : ""}</p>
          <div className="sbtns"><button type="button" className="pill ghost" onClick={() => (un > 0 && firstUn >= 0 ? goTo(firstUn) : setSheet(null))}>{un > 0 ? "DO PUSTYCH" : "WRÓĆ"}</button><button type="button" className="pill" data-primary onClick={() => finish(false)}>ZAKOŃCZ I SPRAWDŹ</button></div>
          <button type="button" className="pill text" onClick={() => { onExit(); toast("Egzamin przerwany", "close"); }}>Przerwij bez wyniku</button>
        </Sheet>
      )}
    </div>
  );
}

/** Exam.html: ring, grade from the scale (highlighted row), stats, "Gdzie tracisz punkty", error deck, question review with edit/source. */
function ExamResult({ topic, r: r0, onExit }: { topic: Topic; r: ResultState; onExit: () => void; onDeck: () => void }) {
  const { overrides, toast } = useApp();
  const router = useRouter();
  const sfx = useSfx();
  const mounted = useMounted();
  const [r, setR] = useState(r0);
  const [sub, setSub] = useState<{ kind: "edit" | "src"; i: number } | null>(null);
  useEffect(() => {
    if (!mounted) return;
    if (r0.passed) { sfx.play("levelup"); toast("Zdane, ocena " + gradeParts(r0.grade)[0], "trophy"); } else { sfx.play("wrong"); toast("Niezaliczone", "x-circle"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);
  const scale = exScale(topic);
  const [gMain, gRest] = gradeParts(r.grade);
  const nextG = scale.slice().reverse().find(([min]) => min > r.pct);
  const need = nextG ? Math.max(1, Math.ceil((nextG[0] / 100) * r.M) - r.correct) : 0;
  const needPass = Math.max(1, Math.ceil((r.pass / 100) * r.M) - r.correct);
  const note = (r.auto ? "Czas minął. " : "") + (r.passed ? (nextG ? `Do ${gradeParts(nextG[1])[0]} brakuje ${need} ${pl(need, "pytania", "pytań", "pytań")}.` : "Najwyższa ocena w siatce.") : `Do progu ${r.pass}% brakuje ${needPass} ${pl(needPass, "pytania", "pytań", "pytań")}.`) + (r.newBest && r.correct ? " Nowy rekord." : "");
  const nw = r.wrong.length;
  const byLv: Record<string, { t: string; n: number; ok: number }> = {};
  r.pool.forEach((q, i) => { const b = (byLv[q.levelId] ??= { t: noEmoji(q.lvl), n: 0, ok: 0 }); b.n++; if (!r.wrong.some((w) => w.i === i)) b.ok++; });
  const lvRows = Object.values(byLv).map((x) => ({ ...x, pct: Math.round((x.ok / x.n) * 100) })).sort((a, b) => a.pct - b.pct);
  const deckHref = `/app/review?deck=${topic.id}`;
  const goDeck = () => router.push(deckHref);
  useKeys((e) => { if (e.key === "Enter" && !sub) (nw ? goDeck : onExit)(); });
  const redraw = (i: number) => {
    const q = r.pool[i]!;
    const nq = { ...q, ...qOf(overrides, topic.id, q.levelId, q.qi, topic.levels.find((l) => l.id === q.levelId)!.quiz[q.qi]!) } as PoolQ;
    const pool = r.pool.map((x, k) => (k === i ? nq : x));
    setR({ ...r, pool, wrong: r.wrong.map((w) => (w.i === i ? { ...w, q: nq } : w)) });
  };
  const editBtn = (q: PoolQ, i: number) => <button type="button" className="egedit" onClick={() => setSub({ kind: "edit", i })}><Icon name="edit" size={14} /><span>{q.edited ? "Poprawione · edytuj" : "Zgłoś / popraw"}</span></button>;
  return (
    <div className="lesson open egres">
      <div className="lessonbody done">
        <div className={cn("blob a-float", r.passed ? "acid" : "red")} aria-hidden="true" />
        {r.passed && <Confetti n={6} />}
        <div className="lc egl">
          <div className={cn("eghero a-up", r.passed ? "ok" : "bad")}>
            <div className="rvring a-pop"><RingSvg pct={r.pct} /><div className="rvpct"><b>{r.pct}%</b><span>{r.correct}/{r.M}</span></div></div>
            <div className="grow"><div className="eglbl">{r.passed ? "Twoja ocena" : "Poniżej progu"}</div><div className="eggrade">{gMain}{gRest && <small>{gRest}</small>}</div><div className="egnote">{note}</div></div>
          </div>
          <div className="egstats a-up d2"><div className="egstat acid"><b>{r.correct}</b><span>poprawne</span></div><div className="egstat red"><b>{nw - r.blank}</b><span>błędne</span></div><div className="egstat gold"><b>{r.blank}</b><span>puste</span></div><div className="egstat cyan"><b>{fmtSecs(r.used)}</b><span>czas</span></div></div>
          {lvRows.length > 1 && (
            <div className="egcard a-up d3"><div className="eglbl">Gdzie tracisz punkty</div><div className="eglv">{lvRows.map((x, i) => <div key={x.t} className={cn("eglvrow", x.pct < 50 ? "red" : x.pct < 75 ? "gold" : "acid")}><span className="lb">{x.t}</span><div className="bar"><i className={`a-grow d${Math.min(6, i + 1)}`} style={{ width: `${x.pct}%` }} /></div><span className="p">{x.pct}%</span></div>)}</div></div>
          )}
          <div className="egcard a-up d3">
            <div className="eglbl">Siatka ocen</div>
            <div className="egscalelist">
              {scale.map(([min, lab]) => <div key={min} className={cn("egsrow", r.passed && lab === r.grade && "on")}><span className="g">{gradeParts(lab)[0]}</span><div className="bar"><i style={{ width: `${min}%` }} /></div><span className="p">od {min}%</span></div>)}
              <div className={cn("egsrow fail", !r.passed && "on")}><span className="g">{gradeParts(exFailLabel(topic))[0]}</span><div className="bar"><i style={{ width: `${Math.max(0, r.pass - 1)}%` }} /></div><span className="p">pod {r.pass}%</span></div>
            </div>
          </div>
          {nw ? (
            <button type="button" className="egdeck a-up d4" onClick={goDeck}><div className="ico"><Icon name="alert" size={24} stroke={2.8} /></div><div className="grow"><div className="t">{nw} {pl(nw, "błąd do powtórki", "błędy do powtórki", "błędów do powtórki")}</div><div className="s">W osobnej talii — wraca też na ekranie Dziś</div></div><Icon name="chevron-right" size={20} /></button>
          ) : (
            <div className="egdeck ok a-up d4"><div className="ico"><Icon name="check" size={24} stroke={3.4} /></div><div className="grow"><div className="t">Bez błędów</div><div className="s">Cały zakres opanowany</div></div></div>
          )}
          <div className="egrev a-up d5">
            <div className="eyebrow sec">Przegląd pytań{nw ? " — błędy najpierw" : ""}</div>
            {r.wrong.map((w) => (
              <div key={w.i} className="egitem bad a-up">
                <div className="qh"><span className="num">{w.i + 1}</span><span>{w.q.q}</span></div>
                <div className="rbad">Twoja: {w.sel == null ? "bez odpowiedzi" : KEYS[w.sel] + ". " + w.q.a[w.sel]}</div>
                <div className="rgood">Dobra: {KEYS[w.q.c]}. {w.q.a[w.q.c]}</div>
                {w.q.e && <div className="re">{w.q.e}</div>}
                <SrcLine src={w.q.src} onClick={() => setSub({ kind: "src", i: w.i })} />
                {editBtn(w.q, w.i)}
              </div>
            ))}
            {r.pool.map((q, i) => r.wrong.some((w) => w.i === i) ? null : (
              <div key={i} className="egitem ok">
                <div className="qh"><span className="num">{i + 1}</span><span>{q.q}</span></div>
                <div className="rgood">{KEYS[q.c]}. {q.a[q.c]}</div>
                <SrcLine src={q.src} onClick={() => setSub({ kind: "src", i })} />
                {editBtn(q, i)}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="lessonfoot col">
        <button type="button" className="pill a-glow" onClick={nw ? goDeck : onExit}>{nw ? `TALIA BŁĘDÓW · ${nw}` : "GOTOWE"}</button>
        <button type="button" className="pill ghost" onClick={onExit}>{nw ? "WRÓĆ DO EGZAMINU" : "JESZCZE RAZ"}</button>
      </div>
      {sub?.kind === "edit" && <EditSheet topic={topic} levelId={r.pool[sub.i]!.levelId} qi={r.pool[sub.i]!.qi} onBack={() => setSub(null)} onSaved={() => { redraw(sub.i); setSub(null); }} />}
      {sub?.kind === "src" && <SourceSheet src={r.pool[sub.i]!.src} ctx={{ topic, levelId: r.pool[sub.i]!.levelId, qi: r.pool[sub.i]!.qi }} onBack={() => setSub(null)} onBad={() => setSub({ kind: "edit", i: sub.i })} />}
    </div>
  );
}
