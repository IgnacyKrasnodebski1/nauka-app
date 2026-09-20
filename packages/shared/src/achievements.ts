import type { Achievement, UserMeta } from "./types.js";

export const ACHIEVEMENTS: Achievement[] = [
  { key: "first_topic", title: "Pierwszy temat", desc: "Wygenerowałeś pierwszy temat z materiałów.", icon: "sparkles", gems: 10 },
  { key: "first_level", title: "Pierwszy krok", desc: "Zaliczony pierwszy poziom.", icon: "flag", gems: 10 },
  { key: "perfect_lesson", title: "Bez skazy", desc: "Lekcja na 100%.", icon: "star", gems: 15 },
  { key: "combo_10", title: "Na fali", desc: "10 poprawnych odpowiedzi z rzędu.", icon: "zap", gems: 15 },
  { key: "streak_3", title: "Rozgrzewka", desc: "Seria 3 dni.", icon: "flame", gems: 10 },
  { key: "streak_7", title: "Tydzień w ogniu", desc: "Seria 7 dni.", icon: "flame", gems: 25 },
  { key: "streak_30", title: "Nie do zatrzymania", desc: "Seria 30 dni.", icon: "flame", gems: 100 },
  { key: "cards_100", title: "Setka fiszek", desc: "100 powtórzonych fiszek.", icon: "layers", gems: 20 },
  { key: "cards_500", title: "Maszyna do powtórek", desc: "500 powtórzonych fiszek.", icon: "layers", gems: 50 },
  { key: "xp_1000", title: "Tysiąc", desc: "1000 XP łącznie.", icon: "trophy", gems: 25 },
  { key: "xp_10000", title: "Dziesięć tysięcy", desc: "10 000 XP łącznie.", icon: "trophy", gems: 100 },
  { key: "exam_pass", title: "Zdane!", desc: "Zaliczony egzamin próbny.", icon: "check", gems: 20 },
  { key: "quests_10", title: "Zadaniowiec", desc: "10 ukończonych misji dziennych.", icon: "target", gems: 25 },
  { key: "chests_5", title: "Poszukiwacz", desc: "5 otwartych skrzynek.", icon: "gift", gems: 25 },
  { key: "night_owl", title: "Nocny marek", desc: "Nauka po 23:00.", icon: "moon", gems: 10 },
  { key: "early_bird", title: "Ranny ptaszek", desc: "Nauka przed 7:00.", icon: "sun", gems: 10 },
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
  };
  return ACHIEVEMENTS.filter((a) => ok[a.key] && !unlocked.has(a.key));
}

export function achievementByKey(key: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key);
}
