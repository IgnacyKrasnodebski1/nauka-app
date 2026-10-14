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

/* ---------------- explanation / option checks (flags for the review pass, fixes in finalize) ---------------- */

const STOP_WORDS = new Set([
  "jest", "są", "był", "była", "było", "były", "to", "ten", "ta", "te", "tego", "tej", "tym", "tych", "który", "która", "które", "którego", "której",
  "oraz", "albo", "lub", "czyli", "przez", "przy", "dla", "jak", "jako", "się", "nie", "tak", "też", "także", "tylko", "więc", "bo", "ponieważ",
  "dlatego", "gdy", "kiedy", "jeśli", "żeby", "aby", "który", "jego", "jej", "ich", "on", "ona", "oni", "może", "można", "musi", "bardzo",
  "odpowiedź", "odpowiedzi", "poprawna", "poprawny", "poprawne", "prawidłowa", "właśnie", "the", "and", "is", "are", "of", "to", "a", "an",
]);

const lower = (s: string) => s.normalize("NFKC").toLowerCase().replace(/<[^>]*>/g, " ");

/** Content words (3+ letters, no stop words) cut to a 5-letter stem — a rough cut through Polish inflection. */
export function contentStems(s: string): string[] {
  return (lower(s).match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w)).map((w) => w.slice(0, 5));
}

/** "odpowiedź B", "opcja C", "B)" at the start, "pierwsza odpowiedź": wrong after the answers are shuffled. */
export const OPTION_REFERENCE = /\b(?:[Oo]dpowied[źzi]\w*|[Oo]pcj\w*|[Ww]ariant\w*|[Aa]nswer|[Oo]ption)\s+\(?([A-E])\)?(?![\p{L}\d])|^\s*\(?([A-E])\)\s|\b(?:[Pp]ierwsz|[Dd]rug|[Tt]rzeci|[Cc]zwart|[Oo]statni)\w*\s+(?:odpowied|opcj)/u;

/**
 * Explanation that adds nothing to the result panel (which already shows the correct answer): refers to an option by
 * letter/position, is very short, or has fewer than 3 content words beyond the question and the correct answer.
 */
export function weakExplanation(q: Pick<QuizQuestion, "q" | "a" | "c" | "e">): boolean {
  const e = (q.e ?? "").trim();
  if (!e || OPTION_REFERENCE.test(e)) return true;
  if (e.replace(/<[^>]*>/g, "").length < 25) return true;
  const known = new Set(contentStems(`${q.q} ${q.a[q.c] ?? ""}`));
  return new Set(contentStems(e).filter((w) => !known.has(w))).size < 3;
}

/** The question shares a word stem with the correct answer that no distractor has ("…kto za co odpowiada?" → "Kryzys odpowiedzialności"). */
export function answerHintInQuestion(q: Pick<QuizQuestion, "q" | "a" | "c">): boolean {
  const long = (s: string) => contentStems(s).filter((w) => w.length >= 5);
  const inQ = new Set(long(q.q));
  const inOthers = new Set(q.a.flatMap((s, i) => (i === q.c ? [] : long(s))));
  return long(q.a[q.c] ?? "").some((w) => inQ.has(w) && !inOthers.has(w));
}

/** Two options differ only by letter case, spacing or punctuation ("Soy polaca." / "Soy Polaca."). */
export function sameOptions(q: Pick<QuizQuestion, "a">): boolean {
  const k = q.a.map((s) => lower(s).replace(/[\s\p{P}\p{S}]+/gu, ""));
  return new Set(k).size !== k.length;
}

/**
 * Replace a reference to an option by letter ("odpowiedź B", "B)") with the option's text, quoted, before the answers
 * are shuffled — after the shuffle the letter would point at a different option.
 */
export function resolveOptionLetters(e: string, a: readonly string[]): string {
  const at = (letter: string) => a["ABCDE".indexOf(letter.toUpperCase())];
  return e
    .replace(/\b([Oo]dpowied[źzi]\w*|[Oo]pcj\w*|[Ww]ariant\w*)\s+\(?([A-E])\)?(?![\p{L}\d])/gu, (m, word: string, letter: string) => {
      const t = at(letter);
      return t ? `${word} „${t.trim()}”` : m;
    })
    .replace(/^\s*\(?([A-E])\)\s+/u, (m, letter: string) => {
      const t = at(letter);
      return t ? `„${t.trim()}” — ` : m;
    });
}

/** "…?." / "…!." / ".." at the end of a sentence (a period added after a quoted question). */
export function tidyPunctuation(s: string): string {
  return s.replace(/([?!…])\.(?=\s|$|<)/g, "$1").replace(/([^.])\.\.(?=\s|$|<)/g, "$1.");
}
