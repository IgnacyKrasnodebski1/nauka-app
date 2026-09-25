import type { Achievement, UserMeta } from "./types.js";

/**
 * Badges. The first block is the online set; the second mirrors legacy KROK 8 `BADGES` that had no counterpart
 * (100 album cards, exam ≥ 90 %, boss beaten, daily plan ×5, whole topic done). Legacy "first / streak7 / streak30 /
 * missions10 / combo3" already existed as first_level / streak_7 / streak_30 / quests_10 / combo_10.
 */
export const ACHIEVEMENTS: Achievement[] = [
  { key: "first_topic", title: "Pierwszy temat", desc: "Wygenerowałeś pierwszy temat z materiałów.", icon: "sparkles", gems: 10 },
  { key: "first_level", title: "Pierwszy poziom", desc: "Zaliczony pierwszy poziom.", icon: "flag", gems: 10 },
  { key: "perfect_lesson", title: "Bez skazy", desc: "Lekcja na 100%.", icon: "star", gems: 15 },
  { key: "combo_10", title: "Combo ×3", desc: "10 poprawnych odpowiedzi z rzędu.", icon: "zap", gems: 15 },
  { key: "streak_3", title: "Rozgrzewka", desc: "Seria 3 dni.", icon: "flame", gems: 10 },
  { key: "streak_7", title: "7 dni serii", desc: "Seria 7 dni.", icon: "flame", gems: 25 },
  { key: "streak_30", title: "30 dni serii", desc: "Seria 30 dni.", icon: "flame", gems: 100 },
  { key: "cards_100", title: "Setka fiszek", desc: "100 powtórzonych fiszek.", icon: "layers", gems: 20 },
  { key: "cards_500", title: "Maszyna do powtórek", desc: "500 powtórzonych fiszek.", icon: "layers", gems: 50 },
  { key: "xp_1000", title: "Tysiąc", desc: "1000 XP łącznie.", icon: "trophy", gems: 25 },
  { key: "xp_10000", title: "Dziesięć tysięcy", desc: "10 000 XP łącznie.", icon: "trophy", gems: 100 },
  { key: "exam_pass", title: "Zdane!", desc: "Zaliczony egzamin próbny.", icon: "check", gems: 20 },
  { key: "quests_10", title: "10 misji", desc: "10 ukończonych misji.", icon: "target", gems: 25 },
  { key: "chests_5", title: "Poszukiwacz", desc: "5 otwartych skrzynek.", icon: "gift", gems: 25 },
  { key: "night_owl", title: "Nocny marek", desc: "Nauka po 23:00.", icon: "moon", gems: 10 },
  { key: "early_bird", title: "Ranny ptaszek", desc: "Nauka przed 7:00.", icon: "sun", gems: 10 },
  /* ---- legacy KROK 8 parity ---- */
  { key: "album_100", title: "100 pojęć w albumie", desc: "Sto fiszek zebranych w albumie.", icon: "cards", gems: 30 },
  { key: "exam_90", title: "Egzamin 90%", desc: "Egzamin próbny na co najmniej 90%.", icon: "trophy", gems: 30 },
  { key: "boss", title: "Boss pokonany", desc: "Pokonany boss rozdziału.", icon: "boss", gems: 25 },
  { key: "plan_5", title: "Plan dnia 5 razy", desc: "Cały plan dnia wykonany 5 razy.", icon: "calendar", gems: 20 },
  { key: "subject_done", title: "Cały przedmiot", desc: "Każdy poziom tematu zaliczony.", icon: "map", gems: 30 },
];

export interface AchievementInput {
  meta: UserMeta;
  topicsCount: number;
  totalXp: number;
  streak: number;
}

/** Newly unlocked achievements (not in `unlocked`). */
export function evaluateAchievements(input: AchievementInput, unlocked: ReadonlySet<string>): Achievement[] {
  const s = input.meta.stats;
  const ok: Record<string, boolean> = {
    first_topic: input.topicsCount >= 1,
    first_level: s.levelsDone >= 1,
    perfect_lesson: s.perfectLevels >= 1,
    combo_10: s.comboBest >= 10,
    streak_3: input.streak >= 3,
    streak_7: input.streak >= 7,
    streak_30: input.streak >= 30,
    cards_100: s.cardsReviewed >= 100,
    cards_500: s.cardsReviewed >= 500,
    xp_1000: input.totalXp >= 1000,
    xp_10000: input.totalXp >= 10000,
    exam_pass: s.examsPassed >= 1,
    quests_10: s.questsDone >= 10,
    chests_5: s.chestsOpened >= 5,
    night_owl: s.nightOwl,
    early_bird: s.earlyBird,
    album_100: (s.albumCount ?? 0) >= 100,
    exam_90: (s.bestExamPct ?? 0) >= 90,
    boss: (s.bosses ?? 0) >= 1,
    plan_5: (s.planDays ?? 0) >= 5,
    subject_done: (s.subjectsDone ?? 0) >= 1,
  };
  return ACHIEVEMENTS.filter((a) => ok[a.key] && !unlocked.has(a.key));
}

export function achievementByKey(key: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key);
}
