import type { DailyGoal, Quest, QuestKind } from "./types.js";

interface Template {
  kind: QuestKind;
  title: (n: number) => string;
  targets: number[];
  reward: number;
  /** progress = max(progress, value) instead of a sum (combo) */
  max?: boolean;
}

/**
 * Daily missions — legacy engine KROK 8 `MISSION_POOL` (values win over the earlier online pool):
 * XP 60/100/150 → 20 gems (target scaled from the daily goal when known), combo 8/10/15 → 30, review 10/15/20 → 25,
 * level → 25, "perfect" (a timed task or a lesson without a mistake, legacy `tftime`) → 30, tasks → 30.
 * `QuestKind` is frozen (both UIs map it exhaustively), so the legacy "plan" mission is paid directly as GEMS.dailyGoal.
 */
export const QUEST_POOL: Template[] = [
  { kind: "xp", title: (n) => `Zdobądź ${n} XP`, targets: [60, 100, 150], reward: 20 },
  { kind: "combo", title: (n) => `${n} poprawnych bez pomyłki`, targets: [8, 10, 15], reward: 30, max: true },
  { kind: "review", title: (n) => `Powtórz ${n} ${pl(n, "pojęcie", "pojęcia", "pojęć")}`, targets: [10, 15, 20], reward: 25 },
  { kind: "levels", title: (n) => (n === 1 ? "Zalicz poziom" : `Zalicz ${n} poziomy`), targets: [1], reward: 25 },
  { kind: "perfect", title: () => "Zadanie na czas albo lekcja bez błędu", targets: [1], reward: 30 },
  { kind: "games", title: (n) => `Rozwiąż ${n} ${pl(n, "zadanie", "zadania", "zadań")}`, targets: [3, 5], reward: 30 },
];

interface WeeklyTemplate {
  id: string;
  kind: QuestKind;
  title: (n: number) => string;
  target: number;
  reward: number;
}
/** Weekly mission — legacy `WEEKLY_POOL`: 5 levels / 300 XP (/ 5 study days, which needs a kind the UIs lack → 60 reviews instead). */
export const WEEKLY_POOL: WeeklyTemplate[] = [
  { id: "wlevels", kind: "levels", title: (n) => `Zalicz ${n} ${pl(n, "poziom", "poziomy", "poziomów")} w tym tygodniu`, target: 5, reward: 100 },
  { id: "wxp", kind: "xp", title: (n) => `Zdobądź ${n} XP w tym tygodniu`, target: 300, reward: 100 },
  { id: "wreview", kind: "review", title: (n) => `Powtórz ${n} pojęć w tym tygodniu`, target: 60, reward: 100 },
];

export function pl(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (n === 1) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 3 distinct quests, deterministic for (userId, day). With `dailyGoal` the XP target is derived from it
 * (0.6× / 1× / 1.5×, rounded to 10, min 10) like legacy krok 9.
 */
export function generateDailyQuests(userId: string, day: string, dailyGoal?: DailyGoal | number): Quest[] {
  let seed = hash(userId + "|" + day);
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pool = [...QUEST_POOL];
  const out: Quest[] = [];
  while (out.length < 3 && pool.length) {
    const t = pool.splice(Math.floor(next() * pool.length), 1)[0]!;
    const k = Math.floor(next() * t.targets.length);
    let target = t.targets[k]!;
    if (t.kind === "xp" && dailyGoal) target = Math.max(10, Math.round((dailyGoal * [0.6, 1, 1.5][k % 3]!) / 10) * 10);
    out.push({ id: `${day}:${t.kind}`, kind: t.kind, title: t.title(target), target, progress: 0, reward: t.reward, done: false, claimed: false });
  }
  return out;
}

/** Monday (YYYY-MM-DD) of the week `day` belongs to — the weekly mission key. */
export function weekKey(day: string): string {
  const d = new Date(day + "T00:00:00");
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The one weekly quest for (userId, week of `day`), deterministic. Id = `w:<monday>:<kind>`. */
export function generateWeeklyQuest(userId: string, day: string): Quest {
  const wk = weekKey(day);
  const t = WEEKLY_POOL[hash(userId + "|w|" + wk) % WEEKLY_POOL.length]!;
  return { id: `w:${wk}:${t.kind}`, kind: t.kind, title: t.title(t.target), target: t.target, progress: 0, reward: t.reward, done: false, claimed: false, weekly: true };
}

/** Use the stored weekly quest when it belongs to this week, else regenerate. */
export function weeklyQuestFor(stored: Quest | null | undefined, userId: string, day: string): Quest {
  if (stored && stored.weekly && stored.id.startsWith(`w:${weekKey(day)}:`)) return stored;
  return generateWeeklyQuest(userId, day);
}

export type QuestEvent =
  | { type: "xp"; amount: number }
  | { type: "answer"; correct: boolean; combo: number }
  | { type: "review"; count: number }
  | { type: "level"; perfect: boolean }
  | { type: "game"; won: boolean }
  /** a task 2.0 solved (won) — also counts for the "games" mission */
  | { type: "task"; won: boolean; timed?: boolean; perfect?: boolean }
  | { type: "minutes"; n: number };

const MAX_KINDS: QuestKind[] = ["combo"];

/** Advance quests (daily and weekly alike) by one event. Pure. */
export function applyQuestEvent(qs: Quest[], ev: QuestEvent): Quest[] {
  return qs.map((q) => {
    if (q.done) return q;
    let p = q.progress;
    switch (q.kind) {
      case "xp": if (ev.type === "xp") p += ev.amount; break;
      case "combo": if (ev.type === "answer") p = ev.correct ? Math.max(p, ev.combo) : p; break;
      case "correct": if (ev.type === "answer" && ev.correct) p += 1; break;
      case "review": if (ev.type === "review") p += ev.count; break;
      case "levels": if (ev.type === "level") p += 1; break;
      case "perfect":
        if ((ev.type === "level" && ev.perfect) || (ev.type === "task" && ev.won && ev.timed && ev.perfect !== false)) p += 1;
        break;
      case "games": if ((ev.type === "game" || ev.type === "task") && ev.won) p += 1; break;
      case "minutes": if (ev.type === "minutes") p += ev.n; break;
    }
    if (!MAX_KINDS.includes(q.kind)) p = Math.min(q.target, p);
    p = Math.min(q.target, p);
    return { ...q, progress: p, done: p >= q.target };
  });
}

export function claimQuest(qs: Quest[], id: string): { quests: Quest[]; gems: number } | null {
  const q = qs.find((x) => x.id === id);
  if (!q || !q.done || q.claimed) return null;
  return { quests: qs.map((x) => (x.id === id ? { ...x, claimed: true } : x)), gems: q.reward };
}

/** Use stored quests when they belong to today, else regenerate. Weekly quests (`w:` ids) are ignored here. */
export function questsForToday(stored: Quest[] | null | undefined, userId: string, day: string, dailyGoal?: DailyGoal | number): Quest[] {
  const daily = (stored ?? []).filter((q) => !q.weekly && !q.id.startsWith("w:"));
  if (daily.length && daily.every((q) => q.id.startsWith(day + ":"))) return daily;
  return generateDailyQuests(userId, day, dailyGoal);
}

export function questsSummary(qs: Quest[]): { done: number; total: number; claimable: number } {
  return { done: qs.filter((q) => q.done).length, total: qs.length, claimable: qs.filter((q) => q.done && !q.claimed).length };
}

/** "zostało X h Y min" until midnight (missions reset). */
export function untilMidnight(now = new Date()): { h: number; m: number; text: string } {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const min = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return { h, m, text: h ? `zostało ${h} h ${m} min` : `zostało ${m} min` };
}
