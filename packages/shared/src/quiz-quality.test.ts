import { test } from "node:test";
import assert from "node:assert/strict";
import { shuffleAnswers, answerLengthBias, needsLengthFix, biasedQuestionIndexes } from "./quiz-quality.js";

const q = { q: "?", a: ["a", "bb", "ccc", "dddd"], c: 2, e: "e" };

test("shuffleAnswers keeps the correct text under the remapped index", () => {
  for (let i = 0; i < 20; i++) {
    const s = shuffleAnswers(q);
    assert.equal(s.a[s.c], "ccc");
    assert.deepEqual([...s.a].sort(), [...q.a].sort());
  }
  const fixed = shuffleAnswers(q, () => 0);
  assert.equal(fixed.a[fixed.c], "ccc");
});

test("length bias detects the longest-is-correct pattern", () => {
  const biased = Array.from({ length: 5 }, () => ({ q: "?", a: ["krótko", "też krótko", "poprawna odpowiedź jest zdecydowanie najdłuższa z nich", "krótka"], c: 2, e: "e" }));
  const b = answerLengthBias(biased);
  assert.equal(b.n, 5);
  assert.equal(b.longest, 1);
  assert.equal(needsLengthFix(biased), true);
  assert.deepEqual(biasedQuestionIndexes(biased), [0, 1, 2, 3, 4]);
  const fair = Array.from({ length: 5 }, () => ({ q: "?", a: ["odpowiedź pierwsza", "odpowiedź druga", "odpowiedź trzecia", "odpowiedź czwarta"], c: 1, e: "e" }));
  assert.equal(needsLengthFix(fair), false);
  assert.equal(needsLengthFix(biased.slice(0, 2)), false, "too few questions to judge");
});
