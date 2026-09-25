import { allFlashcards, shuffle, shuffleAnswers, type Level, type QuizQuestion, type Topic } from "@nauka/shared";
import { hideKey, qOf, type Overrides } from "./extra";
import { noEmoji } from "./format";

/** Pytanie quizu z kontekstem poziomu (legacy `allQuiz` z `qOf`): poprawka użytkownika nałożona, odpowiedzi przetasowane. */
export interface QuizRef {
  topicId: string;
  levelId: string;
  lvl: string;
  qi: number;
  q: QuizQuestion & { edited?: boolean };
}

export const isHidden = (overrides: Overrides, topicId: string, levelId: string) => overrides[hideKey(topicId, levelId)] === true;

/** Poziomy bez wyłączonych w SubjectReady (`hide:` w overrides). */
export function visibleLevels(topic: Pick<Topic, "id" | "levels">, overrides: Overrides): Level[] {
  return topic.levels.filter((l) => !isHidden(overrides, topic.id, l.id));
}

/** Poziom z nałożonymi poprawkami pytań (dla `levelSession`, quizu, egzaminu, bossa). */
export function levelWithOverrides(topic: Pick<Topic, "id">, level: Level, overrides: Overrides): Level {
  return { ...level, quiz: level.quiz.map((q, i) => qOf(overrides, topic.id, level.id, i, q)) };
}

/** Pula pytań tematu (opcjonalnie tylko z podanych poziomów). Odpowiedzi tasowane przy każdym wywołaniu (anty-zgadywanie). */
export function quizPool(topic: Pick<Topic, "id" | "levels">, overrides: Overrides, levelIds?: readonly string[] | null): QuizRef[] {
  const out: QuizRef[] = [];
  for (const l of topic.levels) {
    if (levelIds && !levelIds.includes(l.id)) continue;
    if (isHidden(overrides, topic.id, l.id)) continue;
    l.quiz.forEach((raw, qi) => {
      const q = qOf(overrides, topic.id, l.id, qi, raw);
      out.push({ topicId: topic.id, levelId: l.id, lvl: noEmoji(l.title), qi, q: { ...shuffleAnswers(q), edited: q.edited } });
    });
  }
  return out;
}

/** Fiszki tematu z kluczem SRS (`${levelId}:${index}`), bez wyłączonych poziomów. */
export interface CardRef {
  topicId: string;
  levelId: string;
  lvl: string;
  index: number;
  key: string;
  t: string;
  d: string;
}
export function cardPool(topic: Pick<Topic, "id" | "levels">, overrides: Overrides, levelIds?: readonly string[] | null): CardRef[] {
  return allFlashcards({ levels: visibleLevels(topic, overrides) })
    .filter((c) => !levelIds || levelIds.includes(c.levelId))
    .map((c) => ({ topicId: topic.id, levelId: c.levelId, lvl: noEmoji(c.lvl), index: c.index, key: `${c.levelId}:${c.index}`, t: c.t, d: c.d }));
}

/** Krótka nazwa tematu do nagłówków (`short` z AI, inaczej nazwa bez emoji). */
export const topicShort = (t: Pick<Topic, "name" | "short">) => noEmoji(t.short || t.name);

export { shuffle };
