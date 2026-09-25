"use client";
import { useCallback } from "react";
import { albumKey, allFlashcards, allQuiz, dayDiff, isDue, newCard, pl, review, srsBox, todayStr, type QuizQuestion, type SrsCard, type Subject, type Topic, type WeakMap } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { qOf, type Overrides } from "@/lib/store/extra";
import { noEmoji } from "@/lib/dates";
import type { SrsMap } from "@/lib/store/progress-store";

/**
 * SRS entries across topics (legacy srsEntries / srsDue / srsStats). Keys inside `srs_cards`: `<levelId>:<cardIndex>`
 * for flashcards and `<levelId>:q<qi>` for quiz questions (both land in the same per-topic map).
 */
export interface SrsCardEntry {
  kind: "card";
  topic: Topic;
  subject?: Subject;
  levelId: string;
  lvl: string;
  idx: number;
  key: string;
  c: { t: string; d: string };
  e: SrsCard;
}
export interface SrsQuizEntry {
  kind: "quiz";
  topic: Topic;
  subject?: Subject;
  levelId: string;
  lvl: string;
  idx: number;
  key: string;
  q: QuizQuestion;
  e: SrsCard;
}
export type SrsEntry = SrsCardEntry | SrsQuizEntry;

export const cardSrsKey = (levelId: string, idx: number) => `${levelId}:${idx}`;
export const quizSrsKey = (levelId: string, qi: number) => `${levelId}:q${qi}`;

/** Resolve one stored key of a topic into an entry (null when the content no longer has it). */
export function srsResolve(topic: Topic, key: string, e: SrsCard, overrides: Overrides, subject?: Subject): SrsEntry | null {
  const m = /^(.*):(q?)(\d+)$/.exec(key);
  if (!m) return null;
  const lv = topic.levels.find((l) => l.id === m[1]);
  if (!lv) return null;
  const idx = Number(m[3]);
  const lvl = noEmoji(lv.title);
  if (m[2]) {
    const q = lv.quiz[idx];
    if (!q) return null;
    return { kind: "quiz", topic, subject, levelId: lv.id, lvl, idx, key, q: qOf(overrides, topic.id, lv.id, idx, q), e };
  }
  const c = lv.flashcards[idx];
  if (!c) return null;
  return { kind: "card", topic, subject, levelId: lv.id, lvl, idx, key, c: { t: c.t, d: c.d }, e };
}

export function srsEntries(topics: Topic[], srs: Record<string, SrsMap>, overrides: Overrides, subjects: Subject[] = []): SrsEntry[] {
  const out: SrsEntry[] = [];
  for (const t of topics) {
    const map = srs[t.id];
    if (!map) continue;
    const s = subjects.find((x) => x.id === t.subjectId);
    for (const [k, e] of Object.entries(map)) {
      const r = srsResolve(t, k, e, overrides, s);
      if (r) out.push(r);
    }
  }
  return out;
}

/** Due today: cards first, then questions; earliest due first. */
export function srsDue(entries: SrsEntry[], now = new Date()): SrsEntry[] {
  return entries.filter((x) => isDue(x.e, now)).sort((a, b) => (a.kind !== b.kind ? (a.kind === "card" ? -1 : 1) : a.e.due < b.e.due ? -1 : a.e.due > b.e.due ? 1 : 0));
}

/** Memory state (Review.html): box 0 fresh, 1–2 in progress, ≥3 firm. */
export function srsStats(entries: SrsEntry[]): { fresh: number; mid: number; firm: number } {
  const st = { fresh: 0, mid: 0, firm: 0 };
  for (const x of entries) {
    const b = srsBox(x.e);
    if (b === 0) st.fresh++;
    else if (b <= 2) st.mid++;
    else st.firm++;
  }
  return st;
}

/** "jutro" / "za 3 dni" for the next future due date, "" when none. */
export function nextDueText(entries: SrsEntry[], now = new Date()): string {
  const t = todayStr(now);
  const fut = entries.map((x) => x.e.due.slice(0, 10)).filter((d) => d > t).sort();
  if (!fut.length) return "";
  const k = dayDiff(t, fut[0]!);
  if (k <= 0) return "";
  return k === 1 ? "jutro" : `za ${k} ${pl(k, "dzień", "dni", "dni")}`;
}

/** Entries for every flashcard of a topic (SRS state or a fresh card) — used by Fiszki / Cram / topic-scoped review. */
export function topicCardEntries(topic: Topic, srs: SrsMap, subject?: Subject, levelId?: string): SrsCardEntry[] {
  return allFlashcards(topic)
    .filter((c) => !levelId || c.levelId === levelId)
    .map((c) => ({ kind: "card" as const, topic, subject, levelId: c.levelId, lvl: noEmoji(c.lvl), idx: c.index, key: cardSrsKey(c.levelId, c.index), c: { t: c.t, d: c.d }, e: srs[cardSrsKey(c.levelId, c.index)] ?? newCard() }));
}
export function topicQuizEntries(topic: Topic, srs: SrsMap, overrides: Overrides, subject?: Subject, levels?: string[]): SrsQuizEntry[] {
  return allQuiz(topic)
    .filter((q) => !levels || levels.includes(q.levelId))
    .map((q) => ({ kind: "quiz" as const, topic, subject, levelId: q.levelId, lvl: noEmoji(q.lvl), idx: q.qi, key: quizSrsKey(q.levelId, q.qi), q: qOf(overrides, topic.id, q.levelId, q.qi, q), e: srs[quizSrsKey(q.levelId, q.qi)] ?? newCard() }));
}

/** Error deck (legacy examDeck) = `progress.weak` of a topic → quiz entries. */
export function deckEntries(topic: Topic, weak: WeakMap, srs: SrsMap, overrides: Overrides, subject?: Subject): SrsQuizEntry[] {
  const w = weak[topic.id] ?? {};
  const out: SrsQuizEntry[] = [];
  for (const lv of topic.levels) {
    for (const qi of w[lv.id] ?? []) {
      const q = lv.quiz[qi];
      if (!q) continue;
      out.push({ kind: "quiz", topic, subject, levelId: lv.id, lvl: noEmoji(lv.title), idx: qi, key: quizSrsKey(lv.id, qi), q: qOf(overrides, topic.id, lv.id, qi, q), e: srs[quizSrsKey(lv.id, qi)] ?? newCard() });
    }
  }
  return out;
}
export function deckSize(topicId: string, weak: WeakMap): number {
  return Object.values(weak[topicId] ?? {}).reduce((a, x) => a + x.length, 0);
}

/**
 * One SRS answer (legacy srsTouch + albumCheck + heartReview + missionEvent('review')): grade 2 = good, 0 = again.
 * Also counts the stats, quest and the "10 fiszek = +1 serce" quest started from NoHearts.
 */
export function useSrsTouch() {
  const { srsOf, setSrs, progressOf, albumTouch, bumpStats, questEvent, gainHeart, toast, histAdd } = useApp();
  return useCallback(
    (topic: Topic, key: string, ok: boolean) => {
      const map = srsOf(topic.id);
      const prev = map[key] ?? newCard();
      const next = review(prev, ok ? 2 : 0);
      setSrs(topic.id, { ...map, [key]: next });
      bumpStats((s) => ({ cardsReviewed: s.cardsReviewed + 1 }));
      questEvent({ type: "review", count: 1 });
      histAdd("reviews", 1);
      const m = /^(.*):(\d+)$/.exec(key);
      if (m && ok) {
        const lvp = progressOf(topic.id).levels[m[1]!] ?? null;
        const added = albumTouch(albumKey(topic.id, m[1]!, Number(m[2])), next, lvp);
        if (added) {
          const c = topic.levels.find((l) => l.id === m[1])?.flashcards[Number(m[2])];
          setTimeout(() => toast("Do albumu: " + (c?.t ?? "nowe pojęcie"), "cards", "a-pop"), 1000);
        }
      }
      try {
        const q = Number(sessionStorage.getItem("recall_heartquest") || 0);
        if (q > 0) {
          if (q - 1 <= 0) {
            sessionStorage.removeItem("recall_heartquest");
            gainHeart();
            setTimeout(() => toast("Życie odzyskane: +1", "heart"), 350);
          } else sessionStorage.setItem("recall_heartquest", String(q - 1));
        }
      } catch {
        /* private mode */
      }
    },
    [srsOf, setSrs, progressOf, albumTouch, bumpStats, questEvent, gainHeart, toast, histAdd],
  );
}

export function heartQuestLeft(): number {
  try {
    return Number(sessionStorage.getItem("recall_heartquest") || 0);
  } catch {
    return 0;
  }
}
