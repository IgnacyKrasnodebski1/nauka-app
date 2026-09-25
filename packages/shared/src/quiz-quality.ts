import type { QuizQuestion } from "./types.js";

/**
 * Quiz quality helpers.
 * LLM-written quizzes tend to make the correct option the longest / most precise one, and to keep it at a
 * fixed position. Both are guessable. We (1) shuffle answer positions, (2) measure the length bias so the
 * generator can ask for a rewrite when it is too strong.
 */

/** Return a copy of the question with answer positions permuted and `c` remapped. */
export function shuffleAnswers<T extends QuizQuestion>(q: T, rand: () => number = Math.random): T {
  const idx = q.a.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return { ...q, a: idx.map((i) => q.a[i]!), c: idx.indexOf(q.c) };
}

export interface LengthBias {
  /** fraction of questions where the correct option is the longest by more than `margin` */
  longest: number;
  /** fraction where the correct option is the shortest by more than `margin` */
  shortest: number;
  /** questions checked (only those with >= 3 options) */
  n: number;
}

/** How often the correct answer stands out by length. `margin` = relative difference vs the runner-up. */
export function answerLengthBias(quiz: QuizQuestion[], margin = 0.25): LengthBias {
  let longest = 0, shortest = 0, n = 0;
  for (const q of quiz) {
    if (q.a.length < 3) continue;
    n++;
    const lens = q.a.map((s) => s.trim().length);
    const c = lens[q.c]!;
    const others = lens.filter((_, i) => i !== q.c);
    const maxO = Math.max(...others), minO = Math.min(...others);
    if (c > maxO * (1 + margin)) longest++;
    if (c < minO * (1 - margin)) shortest++;
  }
  return { longest: n ? longest / n : 0, shortest: n ? shortest / n : 0, n };
}

/** True when the quiz is guessable by length and deserves a distractor rewrite. */
export function needsLengthFix(quiz: QuizQuestion[], threshold = 0.3): boolean {
  const b = answerLengthBias(quiz);
  return b.n >= 4 && (b.longest >= threshold || b.shortest >= threshold);
}

/** Indices of the questions whose correct option stands out by length (for a targeted rewrite). */
export function biasedQuestionIndexes(quiz: QuizQuestion[], margin = 0.25): number[] {
  const out: number[] = [];
  quiz.forEach((q, i) => {
    if (q.a.length < 3) return;
    const lens = q.a.map((s) => s.trim().length);
    const c = lens[q.c]!;
    const others = lens.filter((_, k) => k !== q.c);
    if (c > Math.max(...others) * (1 + margin) || c < Math.min(...others) * (1 - margin)) out.push(i);
  });
  return out;
}
