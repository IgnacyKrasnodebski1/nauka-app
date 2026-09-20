"use client";
import { todayStr, type ActivityMap } from "@nauka/shared";
import type { WeekStrip } from "@/lib/store/app-context";
import { m } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";

/** Monday→Sunday strip: flame dot on active days, today outlined. */
export function WeekStripView({ week }: { week: WeekStrip }) {
  return (
    <div className="weekstrip" aria-label="Aktywność w tym tygodniu">
      {week.map((d, i) => (
        <m.div key={d.day} className={cn("wday", d.active && "on", d.isToday && "today", d.future && "future")} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
          <span>{d.label}</span>
          <div className="dot" title={`${d.xp} XP`}>{d.active ? <Icon name="flame" size={18} /> : d.isToday ? <Icon name="target" size={16} /> : <span style={{ width: 6, height: 6, borderRadius: 3, background: "currentColor" }} />}</div>
        </m.div>
      ))}
    </div>
  );
}

/** 5-week calendar grid (Mon-first), coloured by activity. */
export function StreakCalendar({ activity, weeks = 5 }: { activity: ActivityMap; weeks?: number }) {
  const today = todayStr();
  const t = new Date(today + "T00:00:00");
  const dow = (t.getDay() + 6) % 7;
  const start = new Date(t);
  start.setDate(t.getDate() - dow - (weeks - 1) * 7);
  const cells: { day: string; n: number; on: boolean; today: boolean; future: boolean }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const day = todayStr(d);
    cells.push({ day, n: d.getDate(), on: (activity[day]?.xp ?? 0) > 0, today: day === today, future: day > today });
  }
  return (
    <div>
      <div className="calgrid mb-1">
        {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((l) => (
          <div key={l} className="text-center text-[10px] font-extrabold text-muted uppercase tracking-wider">{l}</div>
        ))}
      </div>
      <div className="calgrid">
        {cells.map((c) => (
          <div key={c.day} className={cn("calcell", c.on && "on", c.today && "today", c.future && "future")} title={`${c.day}: ${activity[c.day]?.xp ?? 0} XP`}>{c.n}</div>
        ))}
      </div>
    </div>
  );
}
