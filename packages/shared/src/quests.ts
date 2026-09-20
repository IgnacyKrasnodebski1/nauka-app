import type { Quest, QuestKind } from "./types.js";

interface Template {
  kind: QuestKind;
  title: (n: number) => string;
  targets: number[];
  reward: number;
}

export const QUEST_POOL: Template[] = [
  { kind: "xp", title: (n) => `Zdobądź ${n} XP`, targets: [30, 50, 80], reward: 10 },
  { kind: "combo", title: (n) => `${n} poprawnych z rzędu`, targets: [5, 8, 10], reward: 15 },
  { kind: "review", title: (n) => `Powtórz ${n} fiszek`, targets: [10, 15, 20], reward: 10 },
  { kind: "levels", title: (n) => (n === 1 ? "Zalicz 1 poziom" : `Zalicz ${n} poziomy`), targets: [1, 2, 3], reward: 20 },
  { kind: "perfect", title: () => "Bezbłędna lekcja", targets: [1], reward: 25 },
  { kind: "games", title: (n) => `Wygraj ${n} mini-gry`, targets: [2, 3, 4], reward: 10 },
  { kind: "minutes", title: (n) => `Ucz się ${n} minut`, targets: [5, 10, 15], reward: 10 },
  { kind: "correct", title: (n) => `${n} poprawnych odpowiedzi`, targets: [10, 15, 25], reward: 10 },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 3 distinct quests, deterministic for (userId, day). */
export function generateDailyQuests(userId: string, day: string): Quest[] {
  let seed = hash(userId + "|" + day);
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pool = [...QUEST_POOL];
  const out: Quest[] = [];
  while (out.length < 3 && pool.length) {
    const t = pool.splice(Math.floor(next() * pool.length), 1)[0]!;
    const target = t.targets[Math.floor(next() * t.targets.length)]!;
    out.push({ id: `${day}:${t.kind}`, kind: t.kind, title: t.title(target), target, progress: 0, reward: t.reward, done: false, claimed: false });
  }
  return out;
}

export type QuestEvent =
  | { type: "xp"; amount: number }
  | { type: "answer"; correct: boolean; combo: number }
  | { type: "review"; count: number }
  | { type: "level"; perfect: boolean }
  | { type: "game"; won: boolean }
  | { type: "minutes"; n: number };

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
      case "perfect": if (ev.type === "level" && ev.perfect) p += 1; break;
      case "games": if (ev.type === "game" && ev.won) p += 1; break;
      case "minutes": if (ev.type === "minutes") p += ev.n; break;
    }
    p = Math.min(q.target, p);
    return { ...q, progress: p, done: p >= q.target };
  });
}

export function claimQuest(qs: Quest[], id: string): { quests: Quest[]; gems: number } | null {
  const q = qs.find((x) => x.id === id);
  if (!q || !q.done || q.claimed) return null;
  return { quests: qs.map((x) => (x.id === id ? { ...x, claimed: true } : x)), gems: q.reward };
}

/** Use stored quests when they belong to today, else regenerate. */
export function questsForToday(stored: Quest[] | null | undefined, userId: string, day: string): Quest[] {
  if (stored && stored.length && stored.every((q) => q.id.startsWith(day + ":"))) return stored;
  return generateDailyQuests(userId, day);
}

export function questsSummary(qs: Quest[]): { done: number; total: number; claimable: number } {
  return { done: qs.filter((q) => q.done).length, total: qs.length, claimable: qs.filter((q) => q.done && !q.claimed).length };
}
