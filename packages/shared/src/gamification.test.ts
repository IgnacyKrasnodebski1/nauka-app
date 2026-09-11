import { test } from "node:test";
import assert from "node:assert/strict";
import { applyQuizResult, emptyProgress, starsFor, touchStreak, streakDisplay, emptyMeta, unlockedIndex } from "./gamification.js";
import { review, newCard, isDue } from "./srs.js";
import { finalizeGenerated } from "./finalize.js";
import { SubjectContentSchema } from "./schema.js";

test("stars thresholds", () => {
  assert.equal(starsFor(49), 0);
  assert.equal(starsFor(50), 1);
  assert.equal(starsFor(70), 2);
  assert.equal(starsFor(90), 3);
});

test("quiz result passes level and grants XP", () => {
  const r = applyQuizResult(emptyProgress(), "l1", 8, 10);
  assert.equal(r.passed, true);
  assert.equal(r.pct, 80);
  assert.equal(r.progress.levels.l1?.done, true);
  assert.ok(r.gained > 0);
  const subj = { levels: [{ id: "l1" }, { id: "l2" }, { id: "l3" }] } as never;
  assert.equal(unlockedIndex(subj, r.progress), 1);
});

test("streak extends on consecutive days and resets on gap", () => {
  let m = emptyMeta();
  m = touchStreak(m, "2026-01-01").meta;
  m = touchStreak(m, "2026-01-02").meta;
  assert.equal(m.streak, 2);
  assert.equal(streakDisplay(m, "2026-01-03"), 2);
  assert.equal(streakDisplay(m, "2026-01-05"), 0);
  m = touchStreak(m, "2026-01-05").meta;
  assert.equal(m.streak, 1);
  assert.equal(m.best, 2);
});

test("srs schedules forward", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const c1 = review(newCard(now), 2, now);
  assert.equal(c1.interval, 1);
  assert.equal(isDue(c1, now), false);
  const c2 = review(c1, 0, now);
  assert.equal(c2.reps, 0);
  assert.equal(c2.lapses, 1);
});

test("finalizeGenerated produces valid content and drops broken items", () => {
  const out = finalizeGenerated(
    {
      name: "Test",
      short: "T",
      emoji: "🧪",
      tagline: "x",
      category: "inne",
      info_html: "",
      levels: [
        {
          title: "A",
          emoji: "",
          summary: "",
          feed: [{ title: "f", body: "b", real: "", mnemo: "" }],
          flashcards: [{ t: "a", d: "b" }],
          quiz: [
            { q: "q", a: ["1", "2", "3", "4"], c: 1, e: "e" },
            { q: "broken", a: ["1", "2"], c: 5, e: "e" },
          ],
          games: [
            { type: "match", title: "", pairs: [{ l: "a", r: "b" }, { l: "c", r: "d" }, { l: "e", r: "f" }], cloze: [], tf: [], prompt: "", steps: [] },
            { type: "order", title: "", pairs: [], cloze: [], tf: [], prompt: "", steps: ["a"] },
          ],
        },
      ],
    },
    "liceum",
  );
  assert.equal(out.levels[0]!.quiz.length, 1);
  assert.equal(out.levels[0]!.games!.length, 1);
  assert.equal(out.levels[0]!.emoji, "📘");
  assert.ok(SubjectContentSchema.safeParse(out).success);
});
