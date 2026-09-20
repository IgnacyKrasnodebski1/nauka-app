"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buildDailySession, MASCOT_LINES, streakAtRisk, type LeaderboardRow, type MascotState, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { m } from "@/lib/motion";
import { examBadge } from "@/lib/types";
import { TopBar } from "@/components/app/chrome";
import { SubjectTile } from "@/components/app/subject-card";
import { SubjectPicker } from "@/components/app/onboarding";
import { hueStyle } from "@/components/topic/theme";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon } from "@/components/ui/icons";
import { LeaderboardTeaser } from "@/components/ui/leaderboard";
import { Logo } from "@/components/ui/logo";
import { QuestsCard } from "@/components/ui/quests-card";
import { DailyGoalRing } from "@/components/ui/ring";
import { WeekStripView } from "@/components/ui/streak-calendar";
import { Mascot } from "@/components/mascot/mascot";

const pick = <T,>(arr: readonly T[], seed: number) => arr[seed % arr.length]!;

export function Home({ subjects, topics }: { subjects: Subject[]; topics: Topic[] }) {
  const { ready, user, allProgress, allSrs, weak, toast, streak, meta, todayXp, dailyGoal, goalMet, quests, claimQuest, week, fetchLeaderboard, myWeeklyRank, store } = useApp();
  const params = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [lb, setLb] = useState<LeaderboardRow[] | null>(null);
  const [me, setMe] = useState<{ rank: number; xp: number } | null>(null);

  useEffect(() => {
    if (params.get("upgraded")) toast("Witaj w Pro — nieskończone serca odblokowane", "heart");
  }, [params, toast]);
  useEffect(() => {
    if (!ready) return;
    store?.setTopicsCount(topics.length);
    let alive = true;
    fetchLeaderboard(10).then((r) => alive && setLb(r));
    myWeeklyRank().then((r) => alive && setMe(r));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const session = useMemo(() => (ready ? buildDailySession(topics, allProgress(), allSrs(), weak) : null), [ready, topics, allProgress, allSrs, weak]);
  const first = user.name?.split(" ")[0] || null;
  const upcoming = subjects.filter((s) => s.examDate).sort((a, b) => (a.examDate! < b.examDate! ? -1 : 1))[0];
  const sessionTopic = session?.items[0] ? topics.find((t) => t.id === session.items[0]!.topicId) : undefined;
  const sessionSubject = subjects.find((s) => s.id === sessionTopic?.subjectId) ?? subjects[0];

  const mascotState: MascotState = !ready ? "idle" : goalMet ? "cheer" : streakAtRisk(meta) ? "sleep" : "idle";
  const seed = new Date().getDate();
  const line = !ready ? "…" : goalMet ? pick(MASCOT_LINES.cheer, seed) : streakAtRisk(meta) ? pick(MASCOT_LINES.sleep, seed) : first ? `${pick(MASCOT_LINES.idle, seed)}` : pick(MASCOT_LINES.idle, seed);

  return (
    <>
      <TopBar title={<Logo size={26} />} />
      <div className="px-4">
        {/* daily goal + mascot */}
        <div className="home-hero">
          <div className="flex items-center gap-4">
            <DailyGoalRing xp={ready ? todayXp : 0} goal={dailyGoal} size={92} />
            <div className="min-w-0">
              <div className="eyebrow">{new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}</div>
              <h1 className="mt-1" style={{ fontSize: 24 }}>{first ? `Cześć, ${first}!` : "Cześć!"}</h1>
              <p className="text-muted text-[13.5px] font-semibold mt-1 leading-snug">
                {goalMet ? "Cel dzienny zrobiony. Wszystko powyżej to czysty bonus." : `Jeszcze ${Math.max(0, dailyGoal - todayXp)} XP do celu dnia.`}
                {upcoming?.examDate ? ` ${upcoming.name}: ${examBadge(upcoming.examDate, upcoming.examLabel)}.` : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <Mascot state={mascotState} size={104} streak={streak} />
          <m.div className="bubble-say flex-1" style={{ maxWidth: "none" }} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
            {line}
            <span className="block text-[11.5px] text-muted mt-1 font-bold">{streak > 0 ? `Seria ${streak} dni · rekord ${meta.best}` : "Zacznij serię — wystarczy 10 minut."}</span>
          </m.div>
        </div>

        {/* today card */}
        <m.div className="card3d green mb-4" style={sessionSubject ? hueStyle(sessionSubject) : undefined} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.1 }}>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="eyebrow" style={{ color: "rgba(255,255,255,0.8)" }}>Dzienna misja</div>
              {!session ? (
                <div className="flex items-center gap-3 mt-2" style={{ color: "rgba(255,255,255,0.9)" }}><span className="spinner" style={{ borderTopColor: "#fff" }} /> liczę sesję…</div>
              ) : session.items.length === 0 ? (
                <>
                  <h2 className="mt-1" style={{ color: "#fff" }}>Na dziś pusto</h2>
                  <p className="mt-1">Dodaj temat w przedmiocie, a jutro pojawią się tu powtórki.</p>
                </>
              ) : (
                <>
                  <h2 className="mt-1" style={{ color: "#fff", fontSize: 26 }}>~{session.minutes} min nauki</h2>
                  <p className="mt-1">{session.newLevel ? <>Nowy poziom: <b style={{ color: "#fff" }}>{session.newLevel.title}</b></> : "Same powtórki — szybko pójdzie."}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="xpchip green" style={{ background: "rgba(0,0,0,0.25)", boxShadow: "none" }}><Icon name="cards" size={13} />{session.reviewCount} powtórki</span>
                    <span className="xpchip green" style={{ background: "rgba(0,0,0,0.25)", boxShadow: "none" }}><Icon name="target" size={13} />{session.weakCount} słabe</span>
                    <span className="xpchip green" style={{ background: "rgba(0,0,0,0.25)", boxShadow: "none" }}><Icon name="heart" size={13} />+1 serce</span>
                  </div>
                </>
              )}
            </div>
            <Icon name="bolt" size={56} style={{ color: "rgba(255,255,255,0.35)", flex: "none" }} />
          </div>
          {session && session.items.length > 0 && (
            <Btn3d variant="gold" className="mt-4" href="/app/today"><Icon name="play" size={16} />Start</Btn3d>
          )}
          {session && session.items.length === 0 && subjects.length > 0 && (
            <Btn3d variant="gold" className="mt-4" href={`/app/s/${subjects[0]!.id}/new?mode=prompt`}><Icon name="plus" size={16} />Dodaj temat</Btn3d>
          )}
        </m.div>

        {/* quests */}
        {ready && <div className="mb-5"><QuestsCard quests={quests} onClaim={claimQuest} /></div>}

        {/* subjects */}
        <div className="section-title">
          <h3 className="eyebrow" style={{ fontFamily: "var(--font-body)" }}>Twoje przedmioty</h3>
          <button type="button" className="chip" onClick={() => setAdding(true)}><Icon name="plus" size={14} />przedmiot</button>
        </div>
        <div className="subj-grid mb-6">
          {subjects.map((s, i) => <SubjectTile key={s.id} s={s} topics={topics.filter((t) => t.subjectId === s.id)} index={i} />)}
          <button type="button" className="card3d subj-add press" onClick={() => setAdding(true)}>
            <span className="tile neutral" aria-hidden="true"><Icon name="plus" size={24} /></span>
            {subjects.length ? "Nowy przedmiot" : "Dodaj przedmiot"}
          </button>
        </div>

        {/* leaderboard teaser */}
        <div className="card3d soft-gold mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="flex items-center gap-2"><Icon name="trophy" size={18} style={{ color: "var(--play-yellow)" }} />Ranking tygodnia</h3>
            <Btn3d variant="gold" size="sm" href="/app/leaderboard">Cały ranking</Btn3d>
          </div>
          {lb === null ? <div className="flex items-center gap-2 text-muted text-sm py-2"><span className="spinner" />ładuję…</div> : <LeaderboardTeaser rows={lb} me={me} />}
        </div>

        {/* week strip */}
        <div className="card3d soft-orange mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2"><Icon name="flame" size={18} style={{ color: "var(--play-orange)" }} />Seria: {streak} {streak === 1 ? "dzień" : "dni"}</h3>
            <span className="tag badge !mb-0"><Icon name="snow" size={12} style={{ display: "inline", verticalAlign: -1, marginRight: 3 }} />{meta.streakFreezes} zamrożeń</span>
          </div>
          <WeekStripView week={week} />
        </div>
      </div>

      {(subjects.length === 0 || adding) && (
        <SubjectPicker mode={subjects.length === 0 ? "onboarding" : "add"} existing={subjects.map((s) => s.name)} onClose={() => setAdding(false)} />
      )}
    </>
  );
}
