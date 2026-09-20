import type { ActivityDay, DailyGoal } from "./types.js";
import { todayStr } from "./gamification.js";

export const DAILY_GOALS: DailyGoal[] = [20, 50, 100];
export const DAILY_GOAL_LABEL: Record<DailyGoal, string> = { 20: "Na luzie", 50: "Solidnie", 100: "Full focus" };

export type ActivityMap = Record<string, ActivityDay>;

export function todayXp(activity: ActivityMap, today = todayStr()): number {
  return activity[today]?.xp ?? 0;
}

export function dailyGoalPct(xp: number, goal: DailyGoal): number {
  return Math.min(100, Math.round((xp / goal) * 100));
}

export function addActivity(activity: ActivityMap, day: string, xp: number, minutes: number): ActivityMap {
  const cur = activity[day] ?? { day, xp: 0, minutes: 0 };
  return { ...activity, [day]: { day, xp: cur.xp + xp, minutes: cur.minutes + minutes } };
}

const DOW = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

/** Monday→Sunday strip for the current week. */
export function weekStrip(activity: ActivityMap, today = todayStr()): { day: string; label: string; xp: number; active: boolean; isToday: boolean; future: boolean }[] {
  const t = new Date(today + "T00:00:00");
  const dow = (t.getDay() + 6) % 7; // 0 = Monday
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(t);
    d.setDate(t.getDate() - dow + i);
    const day = todayStr(d);
    const xp = activity[day]?.xp ?? 0;
    out.push({ day, label: DOW[i]!, xp, active: xp > 0, isToday: day === today, future: i > dow });
  }
  return out;
}
