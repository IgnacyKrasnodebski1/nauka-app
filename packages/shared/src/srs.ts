/**
 * Spaced repetition — SM-2 lite. Grades: 0 = again, 1 = hard, 2 = good, 3 = easy.
 * State is per (user, subject, card). Both apps call `review()` and persist the result.
 */
export interface SrsCard {
  /** interval in days */
  interval: number;
  /** ease factor, default 2.5 */
  ease: number;
  reps: number;
  /** ISO date when the card is due */
  due: string;
  lapses: number;
}

export type SrsGrade = 0 | 1 | 2 | 3;

export function newCard(now = new Date()): SrsCard {
  return { interval: 0, ease: 2.5, reps: 0, due: now.toISOString(), lapses: 0 };
}

export function review(card: SrsCard, grade: SrsGrade, now = new Date()): SrsCard {
  let { interval, ease, reps, lapses } = card;
  if (grade === 0) {
    reps = 0;
    interval = 0;
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    if (reps === 0) interval = grade === 3 ? 3 : 1;
    else if (reps === 1) interval = grade === 3 ? 7 : 4;
    else interval = Math.round(interval * ease * (grade === 1 ? 0.8 : grade === 3 ? 1.3 : 1));
    reps += 1;
    ease = Math.max(1.3, ease + (grade === 3 ? 0.15 : grade === 1 ? -0.15 : 0));
  }
  const due = new Date(now.getTime());
  if (interval === 0) due.setMinutes(due.getMinutes() + 10);
  else due.setDate(due.getDate() + interval);
  return { interval, ease: Math.round(ease * 100) / 100, reps, due: due.toISOString(), lapses };
}

export function isDue(card: SrsCard, now = new Date()): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}

/** Stable id for a flashcard inside a subject. */
export function cardKey(levelId: string, index: number): string {
  return `${levelId}:${index}`;
}
