"use client";
import { useState, type CSSProperties } from "react";
import { ACHIEVEMENTS, layoutPath, MASCOT_LINES, rankFor, SUBJECT_HUES, chestIndexes, type LeaderboardRow, type MascotState, type Quest } from "@nauka/shared";
import { cn } from "@/lib/utils";
import { burst } from "@/lib/confetti";
import { useSfx } from "@/lib/sfx";
import { BadgesGrid } from "@/components/ui/badges-grid";
import { Btn3d } from "@/components/ui/btn3d";
import { Chest, Trophy } from "@/components/ui/chest";
import { ComboBadge } from "@/components/ui/combo-badge";
import { FeedbackSheet, type Feedback } from "@/components/ui/feedback-sheet";
import { Icon } from "@/components/ui/icons";
import { LeaderboardList, LeaderboardTeaser, Podium } from "@/components/ui/leaderboard";
import { Logo } from "@/components/ui/logo";
import { AchievementToast, LevelUpModal, NoHeartsModal } from "@/components/ui/modals";
import { Gems, Hearts, StreakPill, XpPill } from "@/components/ui/pills";
import { QuestsCard } from "@/components/ui/quests-card";
import { RankCard } from "@/components/ui/rank-card";
import { DailyGoalRing, Ring } from "@/components/ui/ring";
import { SegmentedProgress } from "@/components/ui/segmented-progress";
import { StatCard } from "@/components/ui/stat-card";
import { StreakCalendar, WeekStripView } from "@/components/ui/streak-calendar";
import { StreakFlame } from "@/components/ui/streak-flame";
import { SwipeDeck } from "@/components/ui/swipe-deck";
import { Mascot } from "@/components/mascot/mascot";

const STATES: MascotState[] = ["idle", "happy", "cheer", "sad", "think", "sleep"];
const QUESTS: Quest[] = [
  { id: "d:xp", kind: "xp", title: "Zdobądź 50 XP", target: 50, progress: 32, reward: 10, done: false, claimed: false },
  { id: "d:combo", kind: "combo", title: "5 poprawnych z rzędu", target: 5, progress: 5, reward: 15, done: true, claimed: false },
  { id: "d:review", kind: "review", title: "Powtórz 10 fiszek", target: 10, progress: 10, reward: 10, done: true, claimed: true },
];
const LB: LeaderboardRow[] = [
  { rank: 1, displayName: "Ola K.", xp: 640, isMe: false },
  { rank: 2, displayName: "Ty", xp: 520, isMe: true },
  { rank: 3, displayName: "Michał", xp: 410, isMe: false },
  { rank: 4, displayName: "Zuzia", xp: 380, isMe: false },
  { rank: 5, displayName: "Kacper", xp: 220, isMe: false },
];
const WEEK = [
  { day: "2026-09-14", label: "Pn", xp: 60, active: true, isToday: false, future: false },
  { day: "2026-09-15", label: "Wt", xp: 35, active: true, isToday: false, future: false },
  { day: "2026-09-16", label: "Śr", xp: 0, active: false, isToday: false, future: false },
  { day: "2026-09-17", label: "Cz", xp: 90, active: true, isToday: false, future: false },
  { day: "2026-09-18", label: "Pt", xp: 50, active: true, isToday: false, future: false },
  { day: "2026-09-19", label: "So", xp: 20, active: true, isToday: true, future: false },
  { day: "2026-09-20", label: "Nd", xp: 0, active: false, isToday: false, future: true },
];
const ACTIVITY = Object.fromEntries(WEEK.filter((d) => d.xp).map((d) => [d.day, { day: d.day, xp: d.xp, minutes: 5 }]));
const CARDS = [
  { t: "Fotosynteza", d: "Proces, w którym rośliny zamieniają CO₂ i wodę w glukozę i tlen, używając światła." },
  { t: "Chloroplast", d: "Organellum z chlorofilem — tu zachodzi faza jasna i ciemna." },
  { t: "Faza jasna", d: "W tylakoidach: światło → ATP i NADPH, uwalnia się tlen." },
];

function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: CSSProperties }) {
  return (
    <section className="mb-8" style={style}>
      <h2 className="eyebrow mb-3" style={{ fontFamily: "var(--font-body)" }}>{title}</h2>
      {children}
    </section>
  );
}

/** Mock winding path (7 levels: 3 done, 1 active, 3 locked) — same layoutPath() as the real screen. */
function MockPath() {
  const N = 7;
  const lay = layoutPath(N, { width: 360 });
  const chests = chestIndexes(N);
  const activeIdx = 3;
  const activeK = lay.nodes.findIndex((n) => n.kind === "level" && n.levelIndex === activeIdx);
  const titles = ["Podstawy", "Chloroplast", "Faza jasna", "Faza ciemna", "Czynniki", "Doświadczenia", "Znaczenie"];
  return (
    <div className="wpath" style={{ width: 360, maxWidth: "100%", height: lay.height }}>
      <svg className="track" viewBox={`0 0 ${lay.width} ${lay.height}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={lay.d} fill="none" stroke="var(--line-strong)" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 14" />
        <path d={lay.d} fill="none" stroke="var(--hue)" strokeWidth="8" strokeLinecap="round" pathLength={1} strokeDasharray={`${activeK / (lay.nodes.length - 1)} 1`} style={{ opacity: 0.9 }} />
      </svg>
      {lay.nodes.map((n) => {
        if (n.kind === "level") {
          const li = n.levelIndex!;
          const st = li < activeIdx ? "done" : li === activeIdx ? "active" : "locked";
          const left = n.x > lay.width / 2;
          return (
            <div key={n.i}>
              {st === "active" && <div className="tooltip-start" style={{ left: n.x, top: n.y - 82 }}>Start</div>}
              <button type="button" className={cn("node3d", st)} style={{ left: n.x, top: n.y }} aria-label={titles[li]}>
                {st === "done" ? <Icon name="check" size={34} /> : st === "active" ? <Icon name="star" size={30} /> : <Icon name="lock" size={26} />}
              </button>
              {st === "done" && (
                <div className="nodestars" style={{ left: n.x, top: n.y + 40 }}>
                  {[0, 1, 2].map((s) => <Icon key={s} name="star" size={14} style={{ color: s < 3 - li ? "var(--play-yellow)" : "var(--faint)" }} />)}
                </div>
              )}
              <div className={cn("nodelabel", left && "left", st === "locked" && "locked")} style={{ top: n.y, [left ? "right" : "left"]: left ? lay.width - n.x + 48 : n.x + 48 }}>
                {titles[li]}<small>8 pytań · 10 fiszek</small>
              </div>
            </div>
          );
        }
        if (n.kind === "chest") {
          const idx = n.chestIndex!;
          const st = chests.indexOf(idx) === 0 ? "openable" : "closed";
          return (
            <button key={n.i} type="button" className={cn("node3d chest", st)} style={{ left: n.x, top: n.y }} aria-label="Skrzynka" onClick={() => burst("chest")}>
              <Chest state={st} size={40} />
            </button>
          );
        }
        return (
          <button key={n.i} type="button" className="node3d trophy locked" style={{ left: n.x, top: n.y }} aria-label="Trofeum">
            <Trophy state="locked" size={46} />
          </button>
        );
      })}
    </div>
  );
}

export function Gallery() {
  const sfx = useSfx();
  const [fb, setFb] = useState<Feedback | null>(null);
  const [levelUp, setLevelUp] = useState(false);
  const [noHearts, setNoHearts] = useState(false);
  const [toast, setToast] = useState(false);
  const [deckIdx, setDeckIdx] = useState(0);
  const [combo, setCombo] = useState(6);
  const hue = SUBJECT_HUES[2]!;
  const hueStyle = { "--hue": hue.color, "--hue-deep": hue.deep } as CSSProperties;

  return (
    <div className="shell" style={{ maxWidth: 560, ...hueStyle }}>
      <div className="topbar">
        <Logo size={26} />
        <div className="hud">
          <StreakPill days={7} />
          <Gems n={240} />
          <Hearts view={{ hearts: 3, unlimited: false, nextInMs: 900000 }} compact />
        </div>
      </div>
      <div className="px-4 pt-4 pb-10">
        <h1 className="mb-1">UI gallery</h1>
        <p className="text-muted mb-6 font-semibold">Każdy prymityw designu „Duolingo in dark”. Strona tylko do QA (bez logowania).</p>

        <Section title="Przyciski 3D">
          <div className="grid grid-cols-2 gap-2.5">
            {(["green", "blue", "purple", "orange", "gold", "red", "ghost", "hue"] as const).map((v) => (
              <Btn3d key={v} variant={v} onClick={() => sfx.play("tap")}>{v}</Btn3d>
            ))}
          </div>
          <div className="flex gap-2 mt-3 items-center flex-wrap">
            <Btn3d variant="green" size="sm">Mały</Btn3d>
            <Btn3d variant="blue" size="lg" auto>Duży</Btn3d>
            <Btn3d variant="gold" disabled auto>Wyłączony</Btn3d>
            <button type="button" className="btn3d purple pressed wauto">Wciśnięty</button>
          </div>
        </Section>

        <Section title="Pills / HUD">
          <div className="flex flex-wrap gap-2 items-center">
            <StreakPill days={0} /><StreakPill days={3} /><StreakPill days={12} size="lg" /><StreakPill days={45} size="lg" />
            <Gems n={1240} /><XpPill n={860} />
            <Hearts view={{ hearts: 5, unlimited: false, nextInMs: null }} />
            <Hearts view={{ hearts: 2, unlimited: false, nextInMs: 600000 }} showTimer />
            <Hearts view={{ hearts: 5, unlimited: true, nextInMs: null }} />
          </div>
          <div className="flex gap-4 mt-3 items-end">
            {[0, 1, 7, 30].map((s) => <div key={s} className="flex flex-col items-center gap-1 text-[11px] font-bold text-muted"><StreakFlame streak={s} size={40} />{s} dni</div>)}
          </div>
        </Section>

        <Section title="Ringi">
          <div className="flex gap-4 items-center flex-wrap">
            <DailyGoalRing xp={32} goal={50} />
            <DailyGoalRing xp={60} goal={50} />
            <Ring pct={75} size={64} color="var(--hue)"><span className="display text-[13px] font-extrabold text-txt">75%</span></Ring>
            <Ring pct={40} size={48} stroke={6} color="var(--play-red)"><span className="display text-[11px] font-extrabold text-txt">40%</span></Ring>
          </div>
        </Section>

        <Section title="Pasek segmentowy + combo">
          <div className="flex items-center gap-3">
            <SegmentedProgress total={12} done={5} />
            <ComboBadge streak={combo} />
            <Hearts view={{ hearts: 4, unlimited: false, nextInMs: null }} compact />
          </div>
          <div className="flex gap-2 mt-3 items-center">
            {[2, 5, 10].map((n) => <button key={n} type="button" className="chip" onClick={() => { setCombo(n); if (n === 5 || n === 10) sfx.play("combo"); }}>combo {n}</button>)}
            <SegmentedProgress total={60} done={30} />
          </div>
        </Section>

        <Section title="Maskotka Rec — 6 stanów">
          <div className="grid grid-cols-3 gap-3">
            {STATES.map((s) => (
              <div key={s} className="card3d flex flex-col items-center gap-2 !p-3 text-center">
                <Mascot state={s} size={90} streak={s === "cheer" ? 30 : 7} />
                <div className="eyebrow">{s}</div>
                <div className="text-[12px] font-bold text-txt leading-tight">{MASCOT_LINES[s][0]}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between items-center">
            <Mascot state="idle" size={110} streak={7} say="Gotowy na 10 minut?" />
            <Mascot state="sleep" size={90} streak={3} say="Zzz… jeszcze dziś się uczymy?" bubbleSide="top" />
          </div>
        </Section>

        <Section title="Kafle 3D">
          <div className="grid grid-cols-2 gap-3">
            <div className="card3d hue subj-tile press"><span className="emo">🧬</span><h3>Biologia</h3><div className="meta">3 tematy · 6/9</div><div className="foot"><span className="tag badge danger !mb-0 !text-[11px]">kartkówka za 5 dni</span><Icon name="chevron" size={18} /></div></div>
            <div className="card3d green press feature-tile !min-h-0"><span className="ic"><Icon name="play" size={22} /></span><h3 style={{ color: "#fff" }}>Zielony</h3><p>główne CTA</p></div>
            <div className="card3d purple press feature-tile !min-h-0"><span className="ic"><Icon name="camera" size={22} /></span><h3 style={{ color: "#fff" }}>Fiolet</h3><p>AI / generowanie</p></div>
            <div className="card3d soft-gold"><h3>Soft gold</h3><p>tło chipów i zajawek</p></div>
          </div>
        </Section>

        <Section title="Karty statystyk (wynik)">
          <div className="statgrid">
            <StatCard icon="bolt" label="XP" value={86} tone="gold" delay={0} />
            <StatCard icon="target" label="Celność" tone="green">
              <div className="flex items-center gap-3 mt-auto"><Ring pct={88} size={54} stroke={7}><span className="display text-[13px] font-extrabold text-txt">88%</span></Ring><div className="text-[12px] font-bold text-muted leading-tight">7/8 w quizie<br />combo 6</div></div>
            </StatCard>
            <StatCard icon="clock" label="Czas" tone="blue"><div className="big">4:12</div></StatCard>
            <StatCard icon="gem" label="Klejnoty" value={15} tone="gem" />
          </div>
        </Section>

        <Section title="Odpowiedzi quizu (kafle 3D)">
          <div className="opts">
            <button type="button" className="opt"><span className="k">A</span><span>W stromie chloroplastu</span></button>
            <button type="button" className="opt sel"><span className="k">B</span><span>Wybrana</span></button>
            <button type="button" className="opt correct"><span className="k">C</span><span>W błonach tylakoidów</span></button>
            <button type="button" className="opt wrong"><span className="k">D</span><span>W mitochondriach</span></button>
          </div>
        </Section>

        <Section title="Arkusz feedbacku">
          <div className="flex gap-2">
            <Btn3d variant="green" onClick={() => setFb({ ok: true, text: <><b>Dlaczego:</b> Barwniki fotosyntetyczne siedzą w tylakoidach — tam światło zamienia się w ATP i NADPH.</>, xp: 10, mult: 2 })}>Dobrze</Btn3d>
            <Btn3d variant="red" onClick={() => setFb({ ok: false, text: <><b>Dlaczego:</b> Mitochondria robią oddychanie, nie fotosyntezę.</>, heart: true })}>Źle</Btn3d>
          </div>
          <div className="mt-3 grid gap-3">
            <div className="sheet ok" style={{ position: "relative", left: "auto", transform: "none", maxWidth: "none", borderRadius: 22 }}>
              <div className="flex items-start gap-3"><Mascot state="happy" size={64} /><div className="flex-1"><div className="flex items-center justify-between"><div className="sh-title">Dobrze!</div><span className="xpchip"><Icon name="bolt" size={14} />+10 XP ×2</span></div><div className="sh-text"><b>Dlaczego:</b> Barwniki fotosyntetyczne siedzą w tylakoidach.</div></div></div>
              <div className="btn3d green mt-4">Dalej</div>
            </div>
            <div className="sheet bad" style={{ position: "relative", left: "auto", transform: "none", maxWidth: "none", borderRadius: 22 }}>
              <div className="flex items-start gap-3"><Mascot state="sad" size={64} /><div className="flex-1"><div className="flex items-center justify-between"><div className="sh-title">Nie tym razem</div><span className="xpchip heart"><Icon name="heart" size={14} />−1</span></div><div className="sh-text"><b>Dlaczego:</b> Mitochondria robią oddychanie, nie fotosyntezę.</div></div></div>
              <div className="btn3d red mt-4">Dalej</div>
            </div>
          </div>
        </Section>

        <Section title="Ścieżka (mock, 7 poziomów)">
          <div className="card3d hue mb-3"><div className="eyebrow" style={{ color: "var(--hue)" }}>Jednostka · 3/7 poziomów</div><h2 style={{ fontSize: 20 }}>Faza ciemna</h2><div className="bar mt-2.5" style={{ maxWidth: 240 }}><i style={{ width: "43%" }} /></div></div>
          <MockPath />
          <div className="flex gap-4 mt-2 items-center">
            <Chest state="closed" /><Chest state="openable" /><Chest state="opened" /><Trophy state="locked" /><Trophy state="claimable" /><Trophy state="claimed" />
          </div>
        </Section>

        <Section title="Fiszki — swipe deck">
          <SwipeDeck
            items={CARDS}
            index={deckIdx}
            keyOf={(c) => c.t}
            allowUp
            onSwipe={() => setDeckIdx((i) => (i + 1) % CARDS.length)}
            render={(c, { flipped }) => (
              <div className={`flip ${flipped ? "flipped" : ""}`}>
                <div className="flipinner">
                  <div className="face front"><span className="tag">Podstawy</span><div className="term">{c.t}</div><div className="tapomat">tapnij, żeby odwrócić</div></div>
                  <div className="face back"><span className="tag hue">Odpowiedź</span><div className="deftxt">{c.d}</div></div>
                </div>
              </div>
            )}
            className="!h-[260px] !min-h-[260px]"
          />
        </Section>

        <Section title="Misje dnia">
          <QuestsCard quests={QUESTS} onClaim={() => sfx.play("gem")} />
        </Section>

        <Section title="Ranking">
          <div className="card3d mb-3"><Podium rows={LB} /></div>
          <div className="card3d mb-3"><LeaderboardList rows={LB} from={3} /></div>
          <div className="card3d soft-gold"><LeaderboardTeaser rows={LB} me={{ rank: 2, xp: 520 }} /></div>
        </Section>

        <Section title="Ranga + odznaki">
          <RankCard rank={rankFor(1840)} totalXp={1840} name="Ola Kowalska" email="ola@szkola.pl" avatar="🎓" />
          <div className="card3d mt-3"><BadgesGrid unlocked={new Set(ACHIEVEMENTS.slice(0, 6).map((a) => a.key))} /></div>
        </Section>

        <Section title="Seria">
          <div className="card3d soft-orange mb-3"><WeekStripView week={WEEK} /></div>
          <div className="card3d soft-orange"><StreakCalendar activity={ACTIVITY} /></div>
        </Section>

        <Section title="Modale">
          <div className="flex gap-2 flex-wrap">
            <Btn3d variant="gold" auto onClick={() => setLevelUp(true)}>Level-up</Btn3d>
            <Btn3d variant="red" auto onClick={() => setNoHearts(true)}>Brak serc</Btn3d>
            <Btn3d variant="purple" auto onClick={() => setToast(true)}>Odznaka</Btn3d>
            <Btn3d variant="blue" auto onClick={() => burst("level", hue.color)}>Confetti</Btn3d>
          </div>
        </Section>

        <Section title="Dźwięki">
          <div className="flex gap-2 flex-wrap">
            {(["tap", "correct", "wrong", "combo", "levelup", "streak", "chest", "gem"] as const).map((n) => <button key={n} type="button" className="chip" onClick={() => sfx.play(n)}><Icon name="volume" size={14} />{n}</button>)}
          </div>
        </Section>
      </div>

      <FeedbackSheet fb={fb} onNext={() => setFb(null)} streak={7} />
      <LevelUpModal rank={levelUp ? rankFor(800) : null} onClose={() => setLevelUp(false)} streak={7} />
      <NoHeartsModal open={noHearts} hearts={{ hearts: 0, unlimited: false, nextInMs: 1500000 }} gems={120} onRefill={() => false} onClose={() => setNoHearts(false)} />
      <AchievementToast achievement={toast ? ACHIEVEMENTS[3]! : null} onClose={() => setToast(false)} />
    </div>
  );
}
