"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { albumCount, dayDiff, pl, subjectCompletion, todayStr, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { dateHeader, inDays, noEmoji } from "@/lib/dates";
import { dailyFor, taskInfo, type DailyItem } from "@/lib/daily-plan";
import { syncTests, tpSub, tpTitle, TP_ICON } from "@/lib/tests";
import { useUi, Shell, SecLink, useThemeBlob } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { Mono, themeStyle } from "@/components/ui/mono";
import { EmptyState } from "@/components/screens/empty";
import { cn } from "@/lib/utils";

/** Main.html — „Dziś”: date, plan bar, daily goal bar, mission/streak/album mini-tiles, plan rows, subject tiles. */
export function MainScreen({ subjects, topics }: { subjects: Subject[]; topics: Topic[] }) {
  const app = useApp();
  const { ready, store, daily, setDaily, allProgress, allSrs, weak, todayXp, dailyGoal, quests, streak, album, tests, setTests, goal, meta, toast } = app;
  const { openQuickAdd } = useUi();
  const router = useRouter();
  const params = useSearchParams();
  const blob = useThemeBlob();

  useEffect(() => {
    if (params.get("upgraded")) toast("Witaj w Pro — nieskończone życia", "heart");
  }, [params, toast]);
  useEffect(() => {
    if (ready) store?.setTopicsCount(topics.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, topics.length]);

  // first run → LevelPick; ≥ 3 days away → ComeBack (once a day); Monday → WeeklyStory (once a week)
  useEffect(() => {
    if (!ready) return;
    if (!goal && subjects.length === 0) {
      router.replace("/app/levelpick?from=first");
      return;
    }
    const t = todayStr();
    try {
      if (meta.lastDay && dayDiff(meta.lastDay, t) >= 3 && localStorage.getItem("recall_comeback") !== t) {
        localStorage.setItem("recall_comeback", t);
        router.replace("/app/comeback");
        return;
      }
      if (new Date().getDay() === 1 && localStorage.getItem("recall_weekly") !== t.slice(0, 10) && Object.keys(app.activity).length) {
        const seen = localStorage.getItem("recall_weekly");
        if (!seen || dayDiff(seen, t) >= 7) {
          localStorage.setItem("recall_weekly", t);
          router.replace("/app/weekly?mode=last");
        }
      }
    } catch {
      /* private mode */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // tests: rebuild once a day; daily plan: rebuild on a new day
  const progress = allProgress();
  useEffect(() => {
    if (!ready) return;
    const synced = syncTests(tests, (sid) => topics.filter((x) => x.subjectId === sid), progress, weak);
    if (synced !== tests) setTests(synced);
    const d = dailyFor(daily, topics, progress, weak);
    if (d.fresh) setDaily(d.plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, topics.length]);

  const plan = useMemo(() => dailyFor(daily, topics, progress, weak).plan, [daily, topics, progress, weak]);
  const items = useMemo<DailyItem[]>(() => {
    const srs = allSrs();
    const testItems: DailyItem[] = tests.map((t) => {
      const subject = subjects.find((s) => s.id === t.subjectId);
      const subTopics = topics.filter((x) => x.subjectId === t.subjectId);
      const topic = subTopics[0];
      if (!subject || !topic) return null;
      const N = dayDiff(todayStr(), t.date);
      if (N < 0) return null;
      const short = noEmoji(subject.name);
      if (N === 0) return { t: { id: "test:" + t.id, done: false }, topic, subject, kind: "test", reward: 0, icon: "calendar", title: "Sprawdzian dziś — powodzenia", sub: short + " · plan zrobiony, teraz spokojnie", href: `/app/testplan/${t.id}` } as DailyItem;
      const r = t.plan.find((x) => x.date === todayStr());
      if (!r) return null;
      return { t: { id: "test:" + t.id, done: !!r.done }, topic, subject, kind: "test", reward: 0, icon: TP_ICON[r.kind], title: "Do sprawdzianu — " + tpTitle(r, subTopics), sub: `${short} · ${inDays(N)} · ${tpSub(r)}`, href: `/app/testplan/${t.id}` } as DailyItem;
    }).filter((x): x is DailyItem => !!x);
    return testItems.concat(plan.tasks.map((t) => taskInfo(t, topics, subjects, srs, weak)).filter((x): x is DailyItem => !!x));
  }, [plan, topics, subjects, weak, tests, allSrs]);

  if (ready && subjects.length === 0) return <EmptyState />;

  const done = items.filter((x) => x.t.done).length, total = items.length;
  const missionsDone = quests.filter((q) => !q.weekly).filter((q) => q.done).length, missionsTotal = quests.filter((q) => !q.weekly).length;
  const alb = albumCount(album, topics);
  const withP = subjects.filter((s) => topics.some((t) => t.subjectId === s.id && ((progress[t.id]?.xp ?? 0) > 0 || Object.values(progress[t.id]?.levels ?? {}).some((l) => l.done))));
  const rest = subjects.filter((s) => !withP.includes(s));
  const shown = withP.concat(rest).slice(0, 3);
  const curIdx = items.findIndex((x) => !x.t.done);

  return (
    <Shell nav blob={blob || "th-violet"} cls="today">
      <div>
        <div className="eyebrow">{dateHeader()}</div>
        <h1>Plan na dziś</h1>
      </div>
      <div className="planbar">
        <div className="bar"><i className="a-grow" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
        <span>{done} z {total}</span>
      </div>
      <Link href="/app/onboarding?from=today" className="goalrow a-up d1" aria-label={`Cel dzienny: ${todayXp} z ${dailyGoal} XP`}>
        <Icon name="bolt" size={15} className="ic-gold" />
        <div className="bar"><i className="a-grow d2" style={{ width: `${Math.min(100, (todayXp / dailyGoal) * 100)}%` }} /></div>
        <span>{todayXp} / {dailyGoal} XP</span>
      </Link>
      <div className="minitiles">
        <Link href="/app/missions" className="minitile gold a-up d1"><Icon name="star" size={17} fill={false} stroke={2.6} className="ic-gold" /><span>Misje {missionsDone}/{missionsTotal || 3}</span></Link>
        <Link href="/app/streak" className="minitile amber a-up d2" aria-label={`Seria: ${streak} ${pl(streak, "dzień", "dni", "dni")}`}><Icon name="flame" size={17} className="ic-flame" /><span>Seria {streak}</span></Link>
        <Link href="/app/album" className="minitile cyan a-up d3" aria-label={`Album pojęć: ${alb.n} z ${alb.m}`}><Icon name="cards" size={17} stroke={2.6} className="ic-cyan" /><span>Album {alb.n}</span></Link>
      </div>

      <div className="plan a-up d2">
        {!items.length && (
          <div className="plan-row later">
            <div className="plan-tile"><Icon name="bulb" size={18} /></div>
            <div className="pt"><div className="t">Brak zadań na dziś</div><div className="s">dodaj materiał, a plan ułoży się sam</div></div>
          </div>
        )}
        {items.map((x, i) => {
          const state: "done" | "cur" | "later" = x.t.done ? "done" : i === curIdx ? "cur" : "later";
          return (
            <div key={x.t.id} className="contents">
              {i > 0 && <div className="plan-sep" />}
              <Link href={x.href} className={cn("plan-row", state, "themed")} style={themeStyle(x.subject?.accent2)} aria-label={(state === "done" ? "Zrobione: " : "") + x.title}>
                <div className={cn("plan-tile", state === "cur" && "a-pulse")}>{state === "done" ? <Icon name="check" size={19} stroke={3.4} /> : <Icon name={x.icon} size={19} stroke={state === "cur" ? 3 : 2.6} />}</div>
                <div className="pt"><div className="t">{x.title}</div>{state !== "done" && <div className="s">{x.sub}</div>}</div>
                {state === "done" ? (x.reward ? <span className="rw">+{x.reward}</span> : null) : <Icon name="chevron-right" size={20} className="chev" />}
              </Link>
            </div>
          );
        })}
      </div>

      <div className="sechdr">
        <span className="eyebrow">Twoje przedmioty</span>
        <SecLink href="/app/catalog">Wszystkie</SecLink>
      </div>
      <div className="grid2">
        {shown.map((s, i) => {
          const mine = topics.filter((t) => t.subjectId === s.id);
          let total = 0, done = 0;
          for (const t of mine) {
            const c = subjectCompletion(t, progress[t.id] ?? { xp: 0, levels: {} });
            total += c.total;
            done += c.done;
          }
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <Link key={s.id} href={`/app/s/${s.id}`} className="subjtile themed" style={themeStyle(s.accent2)} aria-label={`${s.name}, ${done} z ${total} poziomów`}>
              <Mono text={s.name} cls="solid" />
              <div className="name">{noEmoji(s.name)}</div>
              <div className="bar"><i className={`a-grow d${Math.min(6, i + 2)}`} style={{ width: `${pct}%` }} /></div>
              <small>{done}/{total} {pl(total, "poziom", "poziomy", "poziomów")}</small>
            </Link>
          );
        })}
        <button type="button" className="subjtile add" aria-label="Dodaj materiał" onClick={openQuickAdd}>
          <div className="mono"><Icon name="plus" size={22} stroke={3} className="a-bob" /></div>
          <div className="name">Dodaj<br />materiał</div>
        </button>
      </div>
    </Shell>
  );
}
