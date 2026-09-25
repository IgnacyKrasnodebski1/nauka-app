/**
 * Plan dnia (Main.html „Plan na dziś”, legacy `buildDailyTasks`/`taskInfo`/`completeDaily`), przeniesiony na model
 * przedmiot → tematy → poziomy. W `user_meta.daily` siedzą tylko id + done (+ need/prog dla powtórki); etykiety liczone z danych.
 */
import { allFlashcards, allQuiz, isLevelUnlocked, levelProgress, todayStr, type Subject, type SubjectProgress, type Topic, type WeakMap } from "@nauka/shared";
import type { DailyPlan, DailyTask } from "./extra";
import { noEmoji, npl } from "./format";

export const REWARD = { lesson: 15, review: 20, quiz: 25, exam: 40, weak: 20 } as const;
export type PlanKind = keyof typeof REWARD;

const P = (progress: Record<string, SubjectProgress>, id: string) => progress[id] ?? { xp: 0, levels: {} };

export function subjectHasProgress(topics: Topic[], progress: Record<string, SubjectProgress>): boolean {
  return topics.some((t) => {
    const p = progress[t.id];
    return !!p && (p.xp > 0 || Object.values(p.levels).some((l) => l.done));
  });
}

/** Zadania na dziś dla listy przedmiotów (przedmioty z postępem, posortowane po XP; bez postępu → pierwszy). */
export function buildDailyTasks(subjects: Subject[], topicsOf: (sid: string) => Topic[], progress: Record<string, SubjectProgress>, weak: WeakMap): DailyTask[] {
  let subs = subjects.filter((s) => subjectHasProgress(topicsOf(s.id), progress));
  if (!subs.length) subs = subjects.slice(0, 1);
  const xpOf = (s: Subject) => topicsOf(s.id).reduce((a, t) => a + (progress[t.id]?.xp ?? 0), 0);
  subs = [...subs].sort((a, b) => xpOf(b) - xpOf(a));
  const tasks: DailyTask[] = [];
  for (const s of subs) {
    const topics = topicsOf(s.id);
    if (!topics.length) continue;
    // lekcja: pierwszy odblokowany, niezaliczony poziom
    for (const t of topics) {
      const p = P(progress, t.id);
      const open = t.levels.find((l) => isLevelUnlocked(t, p, l.id) && !levelProgress(p, l.id).done);
      if (open) {
        tasks.push({ id: `${s.id}:lesson:${t.id}:${open.id}`, done: false });
        break;
      }
    }
    const cards = topics.reduce((a, t) => a + allFlashcards(t).length, 0);
    const n = Math.min(12, cards);
    if (n) tasks.push({ id: `${s.id}:review`, done: false, need: n, prog: 0 });
    // quiz: ostatni zaliczony poziom (albo pierwszy) z pytaniami
    let quizPick: { t: Topic; lid: string } | null = null;
    for (const t of [...topics].reverse()) {
      const p = P(progress, t.id);
      const done = [...t.levels].reverse().find((l) => levelProgress(p, l.id).done && l.quiz.length);
      if (done) {
        quizPick = { t, lid: done.id };
        break;
      }
    }
    if (!quizPick) {
      const t = topics.find((x) => x.levels.some((l) => l.quiz.length));
      const l = t?.levels.find((x) => x.quiz.length);
      if (t && l) quizPick = { t, lid: l.id };
    }
    if (quizPick) tasks.push({ id: `${s.id}:quiz:${quizPick.t.id}:${quizPick.lid}`, done: false });
    const nq = topics.reduce((a, t) => a + allQuiz(t).length, 0);
    if (nq >= 5) tasks.push({ id: `${s.id}:exam`, done: false });
    if (topics.some((t) => Object.values(weak[t.id] ?? {}).some((arr) => arr.length))) tasks.push({ id: `${s.id}:weak`, done: false });
  }
  return tasks;
}

export function ensureDaily(daily: DailyPlan | null, build: () => DailyTask[]): DailyPlan {
  const t = todayStr();
  if (daily && daily.date === t && Array.isArray(daily.tasks)) return daily;
  return { date: t, tasks: build() };
}

export interface PlanInfo {
  task: DailyTask;
  subjectId: string;
  kind: PlanKind;
  topicId?: string;
  levelId?: string;
  icon: string;
  title: string;
  sub: string;
  reward: number;
}

/** Opis zadania z jego id. null = przedmiot/poziom już nie istnieje. */
export function taskInfo(task: DailyTask, subjects: Subject[], topicsOf: (sid: string) => Topic[], weak: WeakMap, dueCount: (sid: string) => number): PlanInfo | null {
  const [sid, kind, tid, lid] = task.id.split(":");
  const s = subjects.find((x) => x.id === sid);
  if (!s || !kind) return null;
  const topics = topicsOf(s.id);
  const t = tid ? topics.find((x) => x.id === tid) : undefined;
  const lv = t && lid ? t.levels.find((l) => l.id === lid) : undefined;
  const short = s.name;
  const base = { task, subjectId: s.id, reward: REWARD[kind as PlanKind] ?? 0 };
  if (kind === "lesson") {
    if (!t || !lv) return null;
    const nf = lv.feed.length,
      nq = lv.quiz.length,
      nt = (lv.tasks ?? lv.games ?? []).length;
    return { ...base, kind: "lesson", topicId: t.id, levelId: lv.id, icon: "book", title: "Roladka — " + noEmoji(lv.title), sub: `${npl(nf, "dawka", "dawki", "dawek")} · ${npl(nq, "pytanie", "pytania", "pytań")}${nt ? ` · ${npl(nt, "zadanie", "zadania", "zadań")}` : ""} · +${REWARD.lesson}` };
  }
  if (kind === "review") {
    const n = task.need ?? 12,
      p = task.prog ?? 0;
    const due = dueCount(s.id);
    return { ...base, kind: "review", icon: "refresh", title: `Powtórka — ${npl(n, "fiszka", "fiszki", "fiszek")}`, sub: p ? `${p} z ${n} przejrzane · +${REWARD.review}` : `${short} · ${due ? due + " do powtórki dziś" : Math.max(1, Math.round(n / 4)) + " min"} · +${REWARD.review}` };
  }
  if (kind === "quiz") {
    if (!t || !lv) return null;
    const n = lv.quiz.length,
      m = Math.max(1, Math.round(n * 0.5));
    return { ...base, kind: "quiz", topicId: t.id, levelId: lv.id, icon: "question", title: "Quiz — " + noEmoji(lv.title), sub: `${npl(n, "pytanie", "pytania", "pytań")} · ${short} · ${m} min · +${REWARD.quiz}` };
  }
  if (kind === "exam") {
    const N = Math.min(20, topics.reduce((a, x) => a + allQuiz(x).length, 0));
    return { ...base, kind: "exam", icon: "file", title: "Egzamin próbny", sub: `${npl(N, "pytanie", "pytania", "pytań")} · opcjonalnie · +${REWARD.exam}` };
  }
  if (kind === "weak") {
    const n = topics.reduce((a, x) => a + Object.values(weak[x.id] ?? {}).reduce((b, arr) => b + arr.length, 0), 0);
    if (!n && !task.done) return null;
    return { ...base, kind: "weak", icon: "alert", title: "Powtórz błędy z egzaminu", sub: `${npl(n, "pytanie", "pytania", "pytań")} · ${short} · +${REWARD.weak}` };
  }
  return null;
}
