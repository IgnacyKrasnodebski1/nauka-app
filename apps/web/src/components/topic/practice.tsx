"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { allFlashcards, allQuiz, allTasks, foldAnswer, pl, PRACTICE_TASK_XP, shuffle, TASK_META, TASK_TYPES, type Subject, type Task, type TaskType, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { qOf } from "@/lib/store/extra";
import { KEYS, noEmoji } from "@/lib/dates";
import { useMounted } from "@/lib/use-mounted";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import { Confetti } from "@/components/ui/confetti";
import { TaskBlock, type TaskFeedback } from "@/components/tasks";
import { AnswerSheet } from "@/components/lesson/sheets";

type Mode = { kind: "hub" } | { kind: "tasks"; type: TaskType } | { kind: "typing" } | { kind: "tiles" } | { kind: "match" } | { kind: "speed" };

const exNorm = (s: string) => foldAnswer(s).replace(/\b(the|a|an|to|el|la|los|las|un|una|unos|unas)\b/g, " ").replace(/\s+/g, " ").trim();
const exClean = (s: string) => (s || "").replace(/\([^)]*\)/g, "").replace(/…|\.\.\./g, "").replace(/\s+/g, " ").trim();
const typePool = (t: Topic) => allFlashcards(t).map((c) => ({ prompt: exClean(c.d), ans: exClean(c.t), lvl: noEmoji(c.lvl) })).filter((c) => c.prompt && c.ans && c.ans.length <= 30 && !/\//.test(c.ans));
const tilePool = (t: Topic) => typePool(t).filter((c) => c.ans.replace(/\s/g, "").length <= 18);
const matchPool = (t: Topic) => allFlashcards(t).map((c) => ({ a: exClean(c.t), b: exClean(c.d) })).filter((c) => c.a && c.b);

/** Ćwiczenia (legacy renderCwicz): typing / tiles / pairs / speed quiz + every task type of the topic (no hearts, +4 XP). */
export function PracticeTab({ topic, subject }: { topic: Topic; subject: Subject }) {
  const [mode, setMode] = useState<Mode>({ kind: "hub" });
  const [round, setRound] = useState(0);
  const back = () => setMode({ kind: "hub" });
  const again = () => setRound((r) => r + 1);
  if (mode.kind === "hub") return <Hub topic={topic} subject={subject} onPick={(m) => { setMode(m); setRound((r) => r + 1); }} />;
  const key = `${mode.kind}-${round}`;
  if (mode.kind === "tasks") return <TasksRun key={key} topic={topic} type={mode.type} onBack={back} onAgain={again} />;
  if (mode.kind === "typing") return <TypingRun key={key} topic={topic} onBack={back} onAgain={again} />;
  if (mode.kind === "tiles") return <TilesRun key={key} topic={topic} onBack={back} onAgain={again} />;
  if (mode.kind === "match") return <MatchRun key={key} topic={topic} onBack={back} onAgain={again} />;
  return <SpeedRun key={key} topic={topic} onBack={back} onAgain={again} />;
}

function Hub({ topic, subject, onPick }: { topic: Topic; subject: Subject; onPick: (m: Mode) => void }) {
  const items: [Mode, string, string, string][] = topic.lang
    ? [[{ kind: "typing" }, "edit", "Wpisywanie", `Po polsku → ${noEmoji(topic.short || subject.name)}. Wpisz słowo z klawiatury.`], [{ kind: "tiles" }, "grid", "Klocki — ułóż słowo", "Ułóż litery lub wyrazy w poprawne słowo."], [{ kind: "match" }, "link", "Pary słówek", "Dopasuj słowo do tłumaczenia (z fiszek)."]]
    : [[{ kind: "match" }, "link", "Pary z fiszek", "Dopasuj pojęcie do definicji."], [{ kind: "speed" }, "bolt", "Szybki quiz na czas", "60 sekund — ile zdążysz trafić?"], [{ kind: "typing" }, "edit", "Pojęcie z fiszek", "Z definicji wpisz właściwy termin."]];
  const tasks = allTasks(topic);
  return (
    <div className="scroll">
      <div className="exhub">
        <div className="exprompt">Wybierz ćwiczenie</div>
        {items.map(([m, ic, t, p]) => (
          <button key={t} type="button" className="excard a-up" onClick={() => onPick(m)}>
            <div className="eemoji"><Icon name={ic} size={26} stroke={2.4} /></div>
            <div className="emeta"><h3>{t}</h3><p>{p}</p></div>
          </button>
        ))}
        {tasks.length > 0 && (
          <>
            <div className="exprompt">Zadania z poziomów</div>
            {TASK_TYPES.map((type) => {
              const n = tasks.filter((x) => x.task.type === type).length;
              if (!n) return null;
              const meta = TASK_META[type];
              return (
                <button key={type} type="button" className="excard a-up" onClick={() => onPick({ kind: "tasks", type })}>
                  <div className="eemoji"><Icon name={meta.icon} size={26} stroke={2.4} /></div>
                  <div className="emeta"><h3>{meta.label}</h3><p>{n} {pl(n, "zadanie", "zadania", "zadań")} · {meta.desc}</p></div>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function Progress({ i, n }: { i: number; n: number }) {
  return (
    <div className="progressrow">
      <div className="bar"><i style={{ width: `${n ? (i / n) * 100 : 0}%` }} /></div>
      <div className="counter">{Math.min(i + 1, n)}/{n}</div>
    </div>
  );
}
function Result({ kind, score, total, onAgain, onBack, label }: { kind: "gold" | "ok" | "hot"; score: number; total: number; onAgain: () => void; onBack: () => void; label?: string }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  return (
    <div className="scroll">
      <div className="result">
        <div className={cn("big", kind)}><Icon name={kind === "hot" ? "flame" : kind === "gold" ? "trophy" : "check"} size={60} stroke={3.2} /></div>
        <h2>Wynik</h2>
        <div className="score">{label ?? "Dobrze:"} <b>{score}/{total}</b> ({pct}%)</div>
        <p>{pct >= 80 ? "Świetnie. Znasz to bardzo dobrze." : pct >= 50 ? "Nieźle. Jeszcze jedna runda i będzie pewnie." : "Powtórz jeszcze raz — od tego jest ćwiczenie."}</p>
      </div>
      <div style={{ display: "flex", gap: 10, padding: "0 0 8px" }}>
        <button type="button" className="pill" onClick={onAgain}>JESZCZE RAZ</button>
        <button type="button" className="pill ghost" onClick={onBack}><Icon name="back" size={16} stroke={3} /> Ćwiczenia</button>
      </div>
    </div>
  );
}

/* ---- tasks of one type: same TaskBlock + sheets as the lesson ---- */
function TasksRun({ topic, type, onBack, onAgain }: { topic: Topic; type: TaskType; onBack: () => void; onAgain: () => void }) {
  const { addXp, toast, questEvent, bumpStats } = useApp();
  const sfx = useSfx();
  const mounted = useMounted();
  const list = useMemo(() => (mounted ? shuffle(allTasks(topic).filter((x) => x.task.type === type)) : []), [topic, type, mounted]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [pending, setPending] = useState<{ ok: boolean; fb: TaskFeedback } | null>(null);
  const [footEl, setFootEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => { if (mounted && !list.length) { toast("Brak zadań tego typu"); onBack(); } }, [mounted, list.length, toast, onBack]);
  if (!mounted || !list.length) return <div className="scroll" />;
  if (idx >= list.length) return <Result kind={score / list.length >= 0.8 ? "gold" : "ok"} score={score} total={list.length} onAgain={onAgain} onBack={onBack} />;
  const it = list[idx]!;
  const task: Task = it.task;
  return (
    <div className="scroll quizview">
      <Progress i={idx} n={list.length} />
      <TaskBlock
        key={idx}
        task={task}
        chips={<span className="qn">{noEmoji(it.lvl)}</span>}
        api={{
          footEl,
          finish: (ok, fb) => {
            if (ok) { setScore((s) => s + 1); addXp(topic.id, PRACTICE_TASK_XP); sfx.play("correct"); questEvent({ type: "task", won: true, timed: task.type === "tf" && !!task.seconds }); bumpStats((s) => ({ tasksDone: (s.tasksDone ?? 0) + 1 })); } else { sfx.play("wrong"); questEvent({ type: "task", won: false }); }
            setPending({ ok, fb });
          },
        }}
      />
      <div ref={setFootEl} className="tfoot" />
      {pending?.ok && <Confetti n={4} />}
      {pending && <AnswerSheet ok={pending.ok} fb={pending.fb} xp={PRACTICE_TASK_XP} mult={1} combo={0} onNext={() => { setPending(null); setIdx((i) => i + 1); }} />}
    </div>
  );
}

/* ---- typing ---- */
function TypingRun({ topic, onBack, onAgain }: { topic: Topic; onBack: () => void; onAgain: () => void }) {
  const { addXp, toast } = useApp();
  const sfx = useSfx();
  const mounted = useMounted();
  const list = useMemo(() => (mounted ? shuffle(typePool(topic)).slice(0, 12) : []), [topic, mounted]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [val, setVal] = useState("");
  const [checked, setChecked] = useState<null | boolean>(null);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { if (mounted && !list.length) { toast("Brak danych do wpisywania"); onBack(); } }, [mounted, list.length, toast, onBack]);
  useEffect(() => { const t = setTimeout(() => inp.current?.focus(), 50); return () => clearTimeout(t); }, [idx]);
  if (!mounted || !list.length) return <div className="scroll" />;
  if (idx >= list.length) return <Result kind={score / list.length >= 0.8 ? "gold" : "ok"} score={score} total={list.length} onAgain={onAgain} onBack={onBack} />;
  const it = list[idx]!;
  const check = () => {
    if (checked != null) { setIdx((i) => i + 1); setVal(""); setChecked(null); return; }
    const ok = val.trim() !== "" && exNorm(val) === exNorm(it.ans);
    setChecked(ok);
    if (ok) { setScore((s) => s + 1); addXp(topic.id, PRACTICE_TASK_XP); toast("Dobrze: +4 XP", "check"); sfx.play("correct"); } else { toast("Nie tym razem", "close"); sfx.play("wrong"); }
  };
  return (
    <div className="scroll">
      <Progress i={idx} n={list.length} />
      <div className="qcard">
        <span className="tag">{it.lvl}</span>
        <div className="exprompt">Przetłumacz albo wpisz</div>
        <div className="exq">{it.prompt}</div>
        <input ref={inp} className={cn("winput", checked === true && "ok", checked === false && "bad")} value={val} disabled={checked != null} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="wpisz odpowiedź…" aria-label="Odpowiedź" onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") check(); }} />
        <div className={cn("exfb", checked != null && "show", checked === true && "ok", checked === false && "bad")}>{checked === true ? <><Icon name="check" size={16} stroke={3.4} className="ic-acid" /> Dobrze: <b>{it.ans}</b></> : checked === false ? <>Poprawnie: <b>{it.ans}</b></> : null}</div>
        <button type="button" className="pill" style={{ marginTop: 14 }} onClick={check}>{checked == null ? "SPRAWDŹ" : idx + 1 >= list.length ? "WYNIK" : "DALEJ"}</button>
      </div>
    </div>
  );
}

/* ---- tiles (letters / words) ---- */
function TilesRun({ topic, onBack, onAgain }: { topic: Topic; onBack: () => void; onAgain: () => void }) {
  const { toast } = useApp();
  const mounted = useMounted();
  const list = useMemo(() => (mounted ? shuffle(tilePool(topic)).slice(0, 10) : []), [topic, mounted]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  useEffect(() => { if (mounted && !list.length) { toast("Brak danych"); onBack(); } }, [mounted, list.length, toast, onBack]);
  if (!mounted || !list.length) return <div className="scroll" />;
  const it = list[idx];
  if (!it) return <Result kind={score / list.length >= 0.8 ? "gold" : "ok"} score={score} total={list.length} onAgain={onAgain} onBack={onBack} />;
  return (
    <div className="scroll">
      <Progress i={idx} n={list.length} />
      <TileItem key={idx} topic={topic} it={it} last={idx + 1 >= list.length} onDone={(ok) => { if (ok) setScore((s) => s + 1); }} onNext={() => setIdx((i) => i + 1)} />
    </div>
  );
}
function TileItem({ topic, it, last, onDone, onNext }: { topic: Topic; it: { prompt: string; ans: string; lvl: string }; last: boolean; onDone: (ok: boolean) => void; onNext: () => void }) {
  const { addXp, toast } = useApp();
  const sfx = useSfx();
  const phrase = /\s/.test(it.ans.trim());
  const [tiles, setTiles] = useState(() => shuffle((phrase ? it.ans.trim().split(/\s+/) : it.ans.replace(/\s/g, "").split("")).map((ch) => ({ ch, used: false }))));
  const [build, setBuild] = useState<number[]>([]);
  const [checked, setChecked] = useState<null | boolean>(null);
  const check = () => {
    if (checked != null) { onNext(); return; }
    const got = build.map((i) => tiles[i]!.ch).join(phrase ? " " : "");
    const ok = exNorm(got) === exNorm(it.ans);
    setChecked(ok);
    onDone(ok);
    if (ok) { addXp(topic.id, PRACTICE_TASK_XP); toast("Dobrze: +4 XP", "check"); sfx.play("correct"); } else { toast("Nie tak", "close"); sfx.play("wrong"); }
  };
  return (
    <div className="qcard">
      <span className="tag">{it.lvl}</span>
      <div className="exprompt">Ułóż: {it.prompt}</div>
      <div className="build">{build.map((ti, pos) => <button key={pos} type="button" className="tile" onClick={() => { if (checked != null) return; setTiles((t) => t.map((x, i) => (i === ti ? { ...x, used: false } : x))); setBuild((b) => b.filter((_, i) => i !== pos)); }}>{tiles[ti]!.ch}</button>)}</div>
      <div className="tiles">{tiles.map((tl, ti) => <button key={ti} type="button" className={cn("tile", tl.used && "used")} onClick={() => { if (checked != null || tl.used) return; setTiles((t) => t.map((x, i) => (i === ti ? { ...x, used: true } : x))); setBuild((b) => [...b, ti]); }}>{tl.ch}</button>)}</div>
      <div className={cn("exfb", checked != null && "show", checked === true && "ok", checked === false && "bad")}>{checked === true ? <><Icon name="check" size={16} stroke={3.4} className="ic-acid" /> <b>{it.ans}</b></> : checked === false ? <>Poprawnie: <b>{it.ans}</b></> : null}</div>
      <button type="button" className="pill" style={{ marginTop: 8 }} onClick={check}>{checked == null ? "SPRAWDŹ" : last ? "WYNIK" : "DALEJ"}</button>
    </div>
  );
}

/* ---- pairs ---- */
function MatchRun({ topic, onBack, onAgain }: { topic: Topic; onBack: () => void; onAgain: () => void }) {
  const { addXp, toast } = useApp();
  const sfx = useSfx();
  const mounted = useMounted();
  const pairs = useMemo(() => (mounted ? shuffle(matchPool(topic)).slice(0, 5) : []), [topic, mounted]);
  const left = useMemo(() => shuffle(pairs.map((p, i) => ({ i, t: p.a }))), [pairs]);
  const right = useMemo(() => shuffle(pairs.map((p, i) => ({ i, t: p.b }))), [pairs]);
  const [selL, setSelL] = useState<number | null>(null);
  const [selR, setSelR] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  useEffect(() => { if (mounted && pairs.length < 2) { toast("Za mało danych"); onBack(); } }, [mounted, pairs.length, toast, onBack]);
  const tryMatch = (l: number | null, r: number | null) => {
    if (l == null || r == null) return;
    if (l === r) { setMatched((m) => new Set(m).add(l)); addXp(topic.id, 3); toast("Para: +3 XP", "check"); sfx.play("correct"); }
    else { toast("To nie ta para", "close"); sfx.play("wrong"); }
    setSelL(null);
    setSelR(null);
  };
  const pickL = (i: number) => { setSelL(i); tryMatch(i, selR); };
  const pickR = (i: number) => { setSelR(i); tryMatch(selL, i); };
  if (!mounted || pairs.length < 2) return <div className="scroll" />;
  if (matched.size >= pairs.length) return <Result kind="ok" score={pairs.length} total={pairs.length} onAgain={onAgain} onBack={onBack} />;
  const trunc = (t: string) => (t.length > 64 ? t.slice(0, 62) + "…" : t);
  return (
    <div className="scroll">
      <div className="exprompt">Połącz w pary (wybierz z lewej, potem z prawej)</div>
      <div className="matchwrap">
        <div className="mcol">{left.map((o) => <button key={o.i} type="button" className={cn("mitem", matched.has(o.i) && "done", selL === o.i && "sel")} disabled={matched.has(o.i)} onClick={() => pickL(o.i)}>{o.t}</button>)}</div>
        <div className="mcol">{right.map((o) => <button key={o.i} type="button" className={cn("mitem", matched.has(o.i) && "done", selR === o.i && "sel")} disabled={matched.has(o.i)} onClick={() => pickR(o.i)}>{trunc(o.t)}</button>)}</div>
      </div>
      <div style={{ marginTop: 14 }}><button type="button" className="pill ghost" onClick={onBack}><Icon name="back" size={16} stroke={3} /> Ćwiczenia</button></div>
    </div>
  );
}

/* ---- speed quiz (60 s) ---- */
function SpeedRun({ topic, onBack, onAgain }: { topic: Topic; onBack: () => void; onAgain: () => void }) {
  const { addXp, overrides } = useApp();
  const sfx = useSfx();
  const mounted = useMounted();
  const list = useMemo(() => (mounted ? shuffle(allQuiz(topic).map((q) => ({ ...q, ...qOf(overrides, topic.id, q.levelId, q.qi, q) }))) : []), [topic, mounted, overrides]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(60);
  const [picked, setPicked] = useState<number | null>(null);
  const over = left <= 0 || (mounted && idx >= list.length);
  useEffect(() => {
    if (!mounted || over) return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [mounted, over]);
  if (!mounted || !list.length) return <div className="scroll" />;
  if (over) return <Result kind={score >= 10 ? "hot" : "ok"} score={score} total={idx} onAgain={onAgain} onBack={onBack} label="Trafione:" />;
  const q = list[idx]!;
  const pick = (i: number) => {
    if (picked != null) return;
    setPicked(i);
    if (i === q.c) { setScore((s) => s + 1); addXp(topic.id, 2); sfx.play("correct"); } else sfx.play("wrong");
    setTimeout(() => { setIdx((x) => x + 1); setPicked(null); }, 450);
  };
  return (
    <div className="scroll">
      <div className="examhead">
        <div className="counter">Trafione: {score}</div>
        <div className={cn("timer", left <= 10 && "warn")}><Icon name="clock" size={16} /><span> {left}s</span></div>
      </div>
      <div className="qcard">
        <span className="tag">{noEmoji(q.lvl)}</span>
        <div className="qq">{q.q}</div>
        <div className="opts">
          {q.a.map((o, i) => (
            <button key={i} type="button" className={cn("opt", picked != null && i === q.c && "correct", picked === i && i !== q.c && "wrong")} onClick={() => pick(i)}><span className="k">{KEYS[i]}</span><span>{o}</span></button>
          ))}
        </div>
      </div>
    </div>
  );
}
