"use client";
/**
 * Plan dnia (Main.html, legacy buildDailyTasks/taskInfo/completeDaily/tickDaily) on the subject → topic → level model.
 * Stored as user_meta.daily = {date, tasks:[{id, done, need?, prog?}]}; labels are derived from data, so storage keeps
 * only ids. Task ids: "<topicId>:lesson:<levelId>" | "<topicId>:review" | "<topicId>:quiz:<levelId>" | "<topicId>:exam" |
 * "<topicId>:weak" (error deck from the last exam). Rewards go through addXp; the whole plan done pays GEMS.dailyGoal.
 */
import { useCallback } from "react";
import { allFlashcards, allQuiz, GEMS, isDue, isLevelUnlocked, levelProgress, pl, todayStr, type Subject, type SubjectProgress, type Topic, type WeakMap } from "@nauka/shared";
import type { SrsMap } from "@/lib/store/progress-store";
import type { DailyPlan, DailyTask } from "@/lib/store/extra";
import { useApp } from "@/lib/store/app-context";
import { noEmoji } from "@/lib/dates";

export const REWARD: Record<string, number> = { lesson: 15, review: 20, quiz: 25, exam: 40, weak: 20 };
export type DailyKind = "lesson" | "review" | "quiz" | "exam" | "weak";

export interface DailyItem {
  t: DailyTask;
  topic: Topic;
  subject: Subject | undefined;
  kind: DailyKind | "test";
  reward: number;
  icon: string;
  title: string;
  sub: string;
  href: string;
}

export function hasProgress(p: SubjectProgress | undefined): boolean {
  return !!p && ((p.xp || 0) > 0 || Object.values(p.levels || {}).some((l) => l && l.done));
}

export function buildDailyTasks(topics: Topic[], progress: Record<string, SubjectProgress>, weak: WeakMap): DailyTask[] {
  let subs = topics.filter((t) => hasProgress(progress[t.id]));
  if (!subs.length) subs = topics.slice(0, 1);
  subs = [...subs].sort((a, b) => (progress[b.id]?.xp || 0) - (progress[a.id]?.xp || 0));
  const tasks: DailyTask[] = [];
  for (const t of subs) {
    const p = progress[t.id] ?? { xp: 0, levels: {} };
    const open = t.levels.find((l) => isLevelUnlocked(t, p, l.id) && !levelProgress(p, l.id).done);
    if (open) tasks.push({ id: `${t.id}:lesson:${open.id}`, done: false });
    const n = Math.min(12, allFlashcards(t).length);
    if (n) tasks.push({ id: `${t.id}:review`, done: false, need: n, prog: 0 });
    const doneLv = [...t.levels].reverse().find((l) => levelProgress(p, l.id).done) || t.levels[0];
    if (doneLv && doneLv.quiz.length) tasks.push({ id: `${t.id}:quiz:${doneLv.id}`, done: false });
    if (allQuiz(t).length >= 5) tasks.push({ id: `${t.id}:exam`, done: false });
    if (Object.values(weak[t.id] ?? {}).some((a) => a.length)) tasks.push({ id: `${t.id}:weak`, done: false });
  }
  return tasks;
}

/** Today's plan (rebuilt on a new day). Pure: returns the stored plan or a fresh one; caller persists when `fresh`. */
export function dailyFor(stored: DailyPlan | null, topics: Topic[], progress: Record<string, SubjectProgress>, weak: WeakMap): { plan: DailyPlan; fresh: boolean } {
  const t = todayStr();
  if (stored && stored.date === t && Array.isArray(stored.tasks)) return { plan: stored, fresh: false };
  return { plan: { date: t, tasks: buildDailyTasks(topics, progress, weak) }, fresh: true };
}

export function taskInfo(t: DailyTask, topics: Topic[], subjects: Subject[], srs: Record<string, SrsMap>, weak: WeakMap): DailyItem | null {
  const parts = t.id.split(":");
  const tid = parts[0]!, kind = parts[1] as DailyKind, lvId = parts[2];
  const topic = topics.find((x) => x.id === tid);
  if (!topic) return null;
  const subject = subjects.find((s) => s.id === topic.subjectId);
  const lv = lvId ? topic.levels.find((l) => l.id === lvId) : null;
  const short = noEmoji(topic.short || topic.name);
  const base = { t, topic, subject, kind, reward: REWARD[kind] ?? 0 };
  if (kind === "lesson") {
    if (!lv) return null;
    const nf = lv.feed.length, nq = lv.quiz.length, nt = (lv.tasks ?? lv.games ?? []).length;
    return { ...base, icon: "book", title: "Roladka — " + noEmoji(lv.title), sub: `${nf} ${pl(nf, "dawka", "dawki", "dawek")} · ${nq} ${pl(nq, "pytanie", "pytania", "pytań")}${nt ? ` · ${nt} ${pl(nt, "zadanie", "zadania", "zadań")}` : ""} · +15`, href: `/app/t/${topic.id}/l/${lv.id}` };
  }
  if (kind === "review") {
    const n = t.need || 12, p = t.prog || 0;
    const state = srs[topic.id] ?? {};
    const due = allFlashcards(topic).filter((c) => { const st = state[`${c.levelId}:${c.index}`]; return st && isDue(st); }).length;
    return { ...base, icon: "refresh", title: `Powtórka — ${n} ${pl(n, "fiszka", "fiszki", "fiszek")}`, sub: p ? `${p} z ${n} przejrzane · +20` : `${short} · ${due ? due + " do powtórki dziś" : Math.max(1, Math.round(n / 4)) + " min"} · +20`, href: `/app/review?topic=${topic.id}` };
  }
  if (kind === "quiz") {
    if (!lv) return null;
    const n = lv.quiz.length, m = Math.max(1, Math.round(n * 0.5));
    return { ...base, icon: "question", title: "Quiz — " + noEmoji(lv.title), sub: `${n} ${pl(n, "pytanie", "pytania", "pytań")} · ${short} · ${m} min · +25`, href: `/app/t/${topic.id}?tab=quiz&lvl=${lv.id}` };
  }
  if (kind === "exam") {
    const N = Math.min(20, allQuiz(topic).length);
    return { ...base, icon: "file", title: "Egzamin próbny", sub: `${N} ${pl(N, "pytanie", "pytania", "pytań")} · opcjonalnie · +40`, href: `/app/t/${topic.id}?tab=egzamin` };
  }
  if (kind === "weak") {
    const n = Object.values(weak[topic.id] ?? {}).reduce((a, x) => a + x.length, 0);
    if (!n && !t.done) return null;
    return { ...base, icon: "alert", title: "Powtórz błędy z egzaminu", sub: `${n} ${pl(n, "pytanie", "pytania", "pytań")} · ${short} · +20`, href: `/app/review?deck=${topic.id}` };
  }
  return null;
}

/** Actions on today's plan: complete a task (pays the reward), tick a counter task. Uses the store's `daily`. */
export function useDailyActions() {
  const { daily, setDaily, addXp, toast, addGems, bumpStats, store } = useApp();
  const completeDaily = useCallback(
    (topicId: string, kind: DailyKind, lvId?: string) => {
      const d = store?.getExtra().daily ?? daily;
      if (!d || d.date !== todayStr()) return false;
      const pre = `${topicId}:${kind}`;
      const task = d.tasks.find((x) => !x.done && (lvId ? x.id === `${pre}:${lvId}` : x.id === pre || x.id.startsWith(pre + ":")));
      if (!task) return false;
      const next: DailyPlan = { ...d, tasks: d.tasks.map((x) => (x === task ? { ...x, done: true } : x)) };
      const r = REWARD[kind] ?? 0;
      if (r) addXp(topicId, r);
      setTimeout(() => toast("Plan dnia: +" + r + " XP", "bolt"), 3200);
      // whole plan done → gems + counter (legacy planCheck)
      if (!next.planDone && next.tasks.length && next.tasks.every((x) => x.done)) {
        next.planDone = true;
        addGems(GEMS.dailyGoal);
        bumpStats((s) => ({ planDays: (s.planDays ?? 0) + 1 }));
        setTimeout(() => toast("Plan dnia zrobiony: +" + GEMS.dailyGoal + " gemów", "gem"), 4800);
      }
      setDaily(next);
      return true;
    },
    [daily, setDaily, addXp, toast, addGems, bumpStats, store],
  );
  const tickDaily = useCallback(
    (topicId: string, kind: DailyKind, n = 1) => {
      const d = store?.getExtra().daily ?? daily;
      if (!d || d.date !== todayStr()) return;
      const task = d.tasks.find((x) => !x.done && x.id === `${topicId}:${kind}`);
      if (!task) return;
      const prog = (task.prog || 0) + n;
      if (prog >= (task.need || 1)) completeDaily(topicId, kind);
      else setDaily({ ...d, tasks: d.tasks.map((x) => (x === task ? { ...x, prog } : x)) });
    },
    [daily, setDaily, completeDaily, store],
  );
  return { completeDaily, tickDaily };
}
