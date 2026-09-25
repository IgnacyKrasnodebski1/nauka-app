"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bossAnswer, bossName, bossNext, BOSS_SEC, BOSS_WARN_SEC, finishBoss, GEMS, pl, startBoss, todayStr, type BossItem, type BossState, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { fmtSecs, noEmoji, KEYS } from "@/lib/dates";
import { useMounted } from "@/lib/use-mounted";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { themeStyle } from "@/components/ui/mono";
import { Icon } from "@/components/ui/icons";
import { Confetti } from "@/components/ui/confetti";
import { HeartsPill } from "@/components/app/chrome";
import { QuizBlock } from "@/components/lesson/quiz-block";
import { TaskBlock } from "@/components/tasks";
import { BossSvg } from "@/components/tasks/common";
import { NoHeartsSheet } from "@/components/lesson/sheets";

/** Boss.html — chapter boss: pool of questions + tasks, HP bar, 20 s per question, miss = heart. */
export function BossFight({ topic, subject }: { topic: Topic; subject: Subject }) {
  const { ready, hearts, unlimitedHearts, loseHeart, addXp, addGems, progressOf, setProgress, bumpStats, toast } = useApp();
  const router = useRouter();
  const sfx = useSfx();
  const mounted = useMounted();
  const back = `/app/t/${topic.id}`;
  const [bs, setBs] = useState<BossState | null>(null);
  const [item, setItem] = useState<BossItem | null>(null);
  const [answered, setAnswered] = useState(false);
  const [hit, setHit] = useState(false);
  const [exp, setExp] = useState<{ e?: string; sub?: string } | null>(null);
  const [outcome, setOutcome] = useState<{ win: boolean; xp: number; gems: number; first: boolean; seconds: number; hits: number; miss: number; hp: number } | null>(null);
  const [footEl, setFootEl] = useState<HTMLDivElement | null>(null);
  const [noHearts, setNoHearts] = useState(false);
  const [round, setRound] = useState(0);
  const bsRef = useRef<BossState | null>(null);

  const begin = () => {
    const s = startBoss(topic);
    if (!s) { toast("Brak pytań do walki", "alert"); router.push(back); return; }
    const n = bossNext(s);
    bsRef.current = n.state;
    setBs(n.state);
    setItem(n.item);
    setOutcome(null);
    setAnswered(false);
    setExp(null);
    setRound((r) => r + 1);
  };
  const gate = ready && mounted && !unlimitedHearts && hearts.hearts <= 0 && !bs && !outcome;
  useEffect(() => {
    if (!ready || !mounted || gate || bsRef.current) return;
    begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mounted, gate]);

  const end = (win: boolean) => {
    const s = bsRef.current!;
    const prev = progressOf(topic.id);
    const o = finishBoss(prev.boss, s, win, todayStr());
    if (win) {
      setProgress(topic.id, { ...prev, boss: o.record });
      if (o.xp) addXp(topic.id, o.xp);
      if (o.gems) addGems(o.gems);
      if (o.first) bumpStats((st) => ({ bosses: (st.bosses ?? 0) + 1 }));
      sfx.play("levelup");
      setTimeout(() => toast(o.first ? "Boss pokonany: +" + GEMS.boss + " gemów" : "Boss pokonany ponownie", "boss", "a-pop"), 300);
    }
    setOutcome({ win, xp: o.xp, gems: o.gems, first: o.first, seconds: o.seconds, hits: s.hits, miss: s.miss, hp: s.hp });
    setItem(null);
  };
  const onAnswer = (ok: boolean, fb: { e?: React.ReactNode; sub?: string }) => {
    if (answered || !bsRef.current) return;
    setAnswered(true);
    const r = bossAnswer(bsRef.current, ok);
    bsRef.current = r.state;
    setBs(r.state);
    if (ok) { addXp(topic.id, r.xp); setHit(true); sfx.play("correct"); }
    else {
      sfx.play("wrong");
      const v = loseHeart();
      if (fb.e || fb.sub) setExp({ e: typeof fb.e === "string" ? fb.e : undefined, sub: fb.sub });
      if (!v.unlimited && v.hearts <= 0) { setTimeout(() => end(false), 900); return; }
    }
    setTimeout(() => {
      setHit(false);
      setExp(null);
      if (r.won) return end(true);
      const n = bossNext(bsRef.current!);
      bsRef.current = n.state;
      setBs(n.state);
      setItem(n.item);
      setAnswered(false);
    }, ok ? 900 : fb.e ? 2300 : 1100);
  };

  const style = themeStyle(subject.accent2);
  if (!mounted || !ready) return <div className="lesson open bossrun" style={style} />;

  if (outcome) {
    const w = outcome.win;
    return (
      <div className="lesson open bossres" style={style}>
        <div className="lessonbody done">
          <div className={cn("blob a-float", w ? "acid" : "red")} aria-hidden="true" />
          {w && <Confetti n={8} />}
          <div className="lc">
            <div className={cn("lcbig boss a-pop", !w && "lost")}><BossSvg size={96} cls={w ? "" : "a-shake"} />{w && <span className="won"><Icon name="check" size={22} stroke={4} /></span>}</div>
            <div className="lctxt"><div className="lct a-up d2">{w ? "Boss pokonany" : "Boss wygrał tym razem"}</div><div className="lcs">{bossName(topic)} · {noEmoji(topic.short || topic.name)}</div></div>
            <div className="lcstats">
              <div className="lcstat a-up d3"><div className="k">Ciosy</div><div className="v acid">{outcome.hits}</div></div>
              <div className="lcstat a-up d4"><div className="k">Pudła</div><div className={cn("v", outcome.miss ? "pink" : "acid")}>{outcome.miss}</div></div>
              <div className="lcstat a-up d5"><div className="k">Czas</div><div className="v gold">{fmtSecs(outcome.seconds)}</div></div>
            </div>
            {w ? (
              <div className="lcrewards a-up d5">{outcome.xp > 0 && <span className="lcreward gold"><Icon name="bolt" size={15} />+{outcome.xp} XP</span>}{outcome.first ? <><span className="lcreward cyan"><Icon name="gem" size={15} />+{GEMS.boss} gemów</span><span className="lcreward violet"><Icon name="boss" size={16} />odznaka</span></> : <span className="lcreward">powtórka walki · bez gemów</span>}</div>
            ) : (
              <p className="lcp">{hearts.hearts <= 0 && !unlimitedHearts ? "Skończyły się życia. Odzyskaj je (powtórka fiszek albo plecak) i spróbuj ponownie." : `Boss został z ${outcome.hp} ${pl(outcome.hp, "życiem", "życiami", "życiami")}. Przejrzyj fiszki z tego przedmiotu i wróć.`}</p>
            )}
          </div>
        </div>
        <div className="lessonfoot col">
          <button type="button" className="pill a-glow" onClick={w ? () => router.push(back) : () => (!unlimitedHearts && hearts.hearts <= 0 ? setNoHearts(true) : begin())}>{w ? "WRACAM NA ŚCIEŻKĘ" : "SPRÓBUJ PONOWNIE"}</button>
          <button type="button" className="pill text" onClick={w ? begin : () => router.push(back)}>{w ? "JESZCZE RAZ" : "WRÓĆ NA ŚCIEŻKĘ"}</button>
        </div>
        {noHearts && <NoHeartsSheet inLesson={false} cardsHref={`${back}?tab=fiszki`} onLeave={() => router.push(back)} />}
      </div>
    );
  }

  return (
    <div className="lesson open bossrun" style={style}>
      <div className="lessonhead bosshead">
        <button type="button" className="x" aria-label="Uciekaj z walki" onClick={() => { toast("Boss czeka na ścieżce", "boss"); router.push(back); }}><Icon name="close" size={18} stroke={3} /></button>
        <div className="bosslbl">Boss rozdziału</div>
        <HeartsPill iconBeat />
      </div>
      {bs && (
        <div className="bosshero">
          <div className={cn("bossav", hit && "a-shake")}><BossSvg size={112} />{hit && <span className="bosshit a-pop">−1</span>}</div>
          <div className="bossname">{bossName(topic)}</div>
          <div className="bosshp"><div className="bar"><i style={{ width: `${(bs.hp / bs.max) * 100}%` }} /></div><span>{bs.hp} / {bs.max}</span></div>
        </div>
      )}
      <div className="lessonbody" key={`${round}-${bs?.n}`}>
        <div className="blob a-float" aria-hidden="true" />
        {hit && <Confetti n={3} />}
        {item && bs && (
          item.kind === "quiz" ? (
            <QuizBlock q={item.q} api={{ footEl, finish: () => {} }} before={<div className="bossq"><span className="eyebrow">Cios {bs.n}</span><BossTimer key={`${round}-${bs.n}`} stopped={answered} onExpire={() => onAnswer(false, { e: item.q.e, sub: "Czas minął. Poprawna: odpowiedź " + KEYS[item.q.c] })} /></div>} chips={<span className="qn">{noEmoji(item.lvl)}</span>} onAnswer={(i, ok) => onAnswer(ok, { e: item.q.e, sub: ok ? "" : "Poprawna: odpowiedź " + KEYS[item.q.c] })} />
          ) : (
            <>
              <div className="bossq"><span className="eyebrow">Cios {bs.n}</span></div>
              <TaskBlock task={item.task} api={{ footEl, finish: (ok, fb) => onAnswer(ok, { e: typeof fb.e === "string" ? fb.e : undefined, sub: fb.sub }) }} chips={<span className="qn">{noEmoji(item.lvl)}</span>} />
            </>
          )
        )}
        {exp && <div className="bossexp a-up"><b>Zapamiętaj:</b> {exp.sub ? exp.sub + ". " : ""}{exp.e}</div>}
      </div>
      <div className="lessonfoot">
        <div ref={setFootEl} />
        {bs && <div className="bossnote">Dobra odpowiedź = cios. Zła = tracisz serce. Boss ma {bs.max} {pl(bs.max, "życie", "życia", "żyć")}.</div>}
      </div>
      {(noHearts || gate) && <NoHeartsSheet inLesson={false} cardsHref={`${back}?tab=fiszki`} onLeave={() => router.push(back)} />}
    </div>
  );
}

/** 20 s per quiz question (legacy bossInt): blinks under 5 s, fires once at 0. */
function BossTimer({ stopped, onExpire }: { stopped: boolean; onExpire: () => void }) {
  const [left, setLeft] = useState(BOSS_SEC);
  const fired = useRef(false);
  useEffect(() => {
    if (stopped) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [stopped]);
  useEffect(() => {
    if (left <= 0 && !stopped && !fired.current) { fired.current = true; onExpire(); }
  }, [left, stopped, onExpire]);
  const warn = left <= BOSS_WARN_SEC;
  return <span className={cn("bosstime", warn && "warn a-blink")}><Icon name="clock" size={14} stroke={2.8} /><b>{fmtSecs(Math.max(0, left))}</b></span>;
}
