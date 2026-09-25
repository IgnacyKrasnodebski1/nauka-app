"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ACHIEVEMENTS, RANKS, dayDiff, pl, subjectCompletion, todayStr, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { srsEntries, srsStats } from "@/lib/review";
import { hasProgress } from "@/lib/daily-plan";
import { fmtNum, initial, initials, noEmoji } from "@/lib/dates";
import { Shell, SecLink } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { themeStyle } from "@/components/ui/mono";
import { cn } from "@/lib/utils";

const BADGE_TONE: Record<string, string> = { flame: "amber", star: "gold", zap: "pink", bolt: "pink", trophy: "gold", check: "acid", flag: "acid", layers: "cyan", cards: "cyan", target: "gold", gift: "gold", chest: "gold", moon: "violet", sun: "amber", sparkles: "cyan", boss: "violet", calendar: "cyan", map: "acid" };
const FILL = new Set(["flame", "star", "bolt", "zap", "boss"]);

/** Profile.html: avatar + rank bar, 4 stats, 8-week heatmap (activity), badges, social, XP per subject. */
export function ProfileScreen({ subjects, topics }: { subjects: Subject[]; topics: Topic[] }) {
  const { ready, user, displayName, totalXp, todayXp, streak, meta, rank, achievements, activity, allProgress, allSrs, overrides, version } = useApp();
  const progress = allProgress();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => (ready ? srsEntries(topics, allSrs(), overrides, subjects) : []), [ready, topics, subjects, version]);
  const mem = srsStats(all);
  let lvls = 0, lvTotal = 0;
  for (const t of topics) { const c = subjectCompletion(t, progress[t.id] ?? { xp: 0, levels: {} }); lvls += c.done; lvTotal += c.total; }
  const started = subjects.filter((s) => topics.some((t) => t.subjectId === s.id && hasProgress(progress[t.id])));
  const best = Math.max(meta.best || 0, streak);
  const name = displayName || user.name || (user.email ? user.email.split("@")[0] : "Ty") || "Ty";
  const pct = rank.pct;
  const nextName = rank.next != null ? RANKS[rank.tier + 1]?.name : null;
  return (
    <Shell nav title="Profil" pills={false} blob cls="profile" right={<Link href="/app/settings" className="backbtn" aria-label="Ustawienia"><Icon name="settings" size={19} stroke={2.4} /></Link>}>
      <div className="prof">
        <div className="avatar ini a-pop">{initials(name)}</div>
        <div className="pmeta">
          <h2>{name}</h2>
          <div className="s">{rank.name} · {fmtNum(totalXp)} xp</div>
          <div className="planbar"><div className="bar"><i className="a-grow d2" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div><span>{rank.next != null ? `do ${nextName}: ${fmtNum(rank.next - totalXp)}` : "lvl max"}</span></div>
        </div>
      </div>
      <div className="grid2 stats">
        <Link href="/app/streak" className="stat a-up d1"><div className="k"><Icon name="flame" size={16} className="ic-flame a-beat" /><span>Seria</span></div><div className="v">{streak} {pl(streak, "dzień", "dni", "dni")}</div><div className="s">rekord {best}</div></Link>
        <div className="stat a-up d2"><div className="k"><Icon name="bolt" size={16} className="ic-gold" /><span>XP łącznie</span></div><div className="v">{fmtNum(totalXp)}</div><div className="s">+{todayXp} dzisiaj</div></div>
        <Link href="/app/review" className="stat a-up d3"><div className="k"><Icon name="refresh" size={16} stroke={2.8} className="ic-cyan" /><span>Utrwalone</span></div><div className="v">{mem.firm}</div><div className="s">{all.length ? `z ${all.length} ${pl(all.length, "pojęcia", "pojęć", "pojęć")} w powtórce` : "pojęć w powtórce"}</div></Link>
        <div className="stat a-up d4"><div className="k"><Icon name="check" size={16} stroke={2.8} className="ic-acid" /><span>Poziomy</span></div><div className="v">{lvls}</div><div className="s">z {lvTotal} zaliczone</div></div>
      </div>
      <div className="sechdr"><span className="eyebrow sec">Aktywność — 8 tygodni</span><SecLink href="/app/weekly?mode=this">Ten tydzień</SecLink></div>
      <Heatmap activity={activity} />
      <div className="sechdr"><span className="eyebrow sec">Odznaki</span><SecLink href="/app/album">Album pojęć</SecLink></div>
      <div className="badgegrid a-up d3">
        {ACHIEVEMENTS.map((b) => {
          const on = achievements.has(b.key);
          const tone = BADGE_TONE[b.icon] ?? "acid";
          return <div key={b.key} className={cn("badge", on ? tone : "lock")} aria-label={b.title + (on ? ": zdobyta" : ": zablokowana")} title={b.desc}><Icon name={on ? b.icon : "lock"} size={26} stroke={2.4} fill={on && FILL.has(b.icon)} /><span>{b.title}</span></div>;
        })}
      </div>
      <div className="eyebrow sec">Razem z innymi</div>
      <div className="setcard a-up d4">
        <Link href="/app/league" className="setrow"><Icon name="trophy" size={20} stroke={2.4} className="ic-gold" /><div className="grow"><div className="t">Liga tygodniowa</div><div className="s">ranking XP z tego tygodnia</div></div><Icon name="chevron-right" size={18} className="chev" /></Link>
        <div className="setsep" />
        <Link href="/app/friends" className="setrow"><Icon name="users" size={20} stroke={2.4} className="ic-pink" /><div className="grow"><div className="t">Znajomi</div><div className="s">kody, zaproszenia, wspólny tydzień · wkrótce</div></div><Icon name="chevron-right" size={18} className="chev" /></Link>
      </div>
      <div className="sechdr"><span className="eyebrow sec">XP w przedmiotach</span><SecLink href="/app/catalog">Wszystkie</SecLink></div>
      <div className="setcard a-up d5">
        {started.map((s, i) => {
          const xp = topics.filter((t) => t.subjectId === s.id).reduce((a, t) => a + (progress[t.id]?.xp ?? 0), 0);
          return (
            <div key={s.id} className="contents">
              {i > 0 && <div className="setsep" />}
              <Link href={`/app/s/${s.id}`} className="setrow themed" style={themeStyle(s.accent2)}><div className="mono solid xs" aria-hidden="true">{initial(s.name)}</div><span className="t grow">{noEmoji(s.name)}</span><span className="v">{fmtNum(xp)} xp</span><Icon name="chevron-right" size={18} className="chev" /></Link>
            </div>
          );
        })}
        {!started.length && <div className="setrow"><span className="t grow muted">Jeszcze nic — zacznij od planu na dziś.</span></div>}
      </div>
    </Shell>
  );
}

/** 8 columns (weeks, oldest first) × 7 days (Mon–Sun): "on" = day with XP, future greyed. */
function Heatmap({ activity }: { activity: Record<string, { xp: number }> }) {
  const t = todayStr(), now = new Date(), dow = (now.getDay() + 6) % 7;
  const cols: string[][] = [];
  for (let w = 0; w < 8; w++) {
    const col: string[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - (7 - w) * 7 + d);
      const ds = todayStr(dt), toToday = dayDiff(ds, t);
      let cls = "";
      if (toToday < 0) cls = "future";
      else if ((activity[ds]?.xp ?? 0) > 0) cls = "on";
      if (toToday === 0) cls += " today";
      col.push(cls.trim());
    }
    cols.push(col);
  }
  return <div className="heat a-up d2" aria-label="Aktywność w ostatnich 8 tygodniach">{cols.map((c, w) => <div key={w} className="col">{c.map((cls, d) => <i key={d} className={cls} />)}</div>)}</div>;
}
