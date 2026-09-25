import { test } from "node:test";
import assert from "node:assert/strict";
import { comboStep, comboMultiplier, comboXp, emptyCombo, comboTierHit } from "./combo.js";
import { heartsNow, loseHeart, normalizeHearts, refillHearts, HEARTS_MAX, HEART_REGEN_MS } from "./hearts.js";
import { chestIndexes, chestOpenable, openChest, spendGems, addGems } from "./gems.js";
import { generateDailyQuests, applyQuestEvent, claimQuest, questsForToday } from "./quests.js";
import { rankFor, rankChanged } from "./rank.js";
import { layoutPath } from "./path-layout.js";
import { emptyMeta, touchStreak, normalizeMeta, streakAtRisk } from "./gamification.js";
import { evaluateAchievements } from "./achievements.js";
import { weekStrip, addActivity, todayXp } from "./daily.js";
import { hueDeep, hueFromColor, cssVars } from "./theme.js";

test("combo tiers and xp", () => {
  let c = emptyCombo();
  for (let i = 0; i < 5; i++) c = comboStep(c, true);
  assert.equal(c.streak, 5);
  assert.equal(comboMultiplier(5), 2);
  assert.equal(comboMultiplier(10), 3);
  assert.ok(comboTierHit(5) && comboTierHit(10) && !comboTierHit(7));
  assert.deepEqual(comboXp(5, 5), { xp: 10, bonus: 5, mult: 2 });
  c = comboStep(c, false);
  assert.equal(c.streak, 0);
  assert.equal(c.best, 5);
});

test("hearts regenerate one per 30 min and fold partial progress", () => {
  const t0 = Date.parse("2026-01-01T10:00:00Z");
  let m = refillHearts(emptyMeta(), t0);
  m = loseHeart(m, t0);
  m = loseHeart(m, t0);
  assert.equal(heartsNow(m, t0).hearts, 3);
  assert.equal(heartsNow(m, t0 + HEART_REGEN_MS * 1.5).hearts, 4);
  const folded = normalizeHearts(m, t0 + HEART_REGEN_MS * 1.5);
  assert.equal(folded.hearts, 4);
  assert.equal(new Date(folded.heartsUpdatedAt).getTime(), t0 + HEART_REGEN_MS);
  assert.equal(heartsNow(m, t0 + HEART_REGEN_MS * 10).hearts, HEARTS_MAX);
  assert.equal(heartsNow(m, t0, true).unlimited, true);
  const zero = [1, 2, 3].reduce((x) => loseHeart(x, t0), m);
  assert.equal(heartsNow(zero, t0).hearts, 0);
});

test("streak freeze bridges a one-day gap", () => {
  let m = { ...emptyMeta(), streakFreezes: 1 };
  m = touchStreak(m, "2026-01-01").meta;
  m = touchStreak(m, "2026-01-02").meta;
  const r = touchStreak(m, "2026-01-04");
  assert.equal(r.usedFreeze, true);
  assert.equal(r.meta.streak, 3);
  assert.equal(r.meta.streakFreezes, 0);
  assert.equal(r.meta.gems, 0, "spread keeps other fields");
  assert.equal(streakAtRisk(r.meta, new Date("2026-01-05T19:00:00")), true);
  assert.equal(streakAtRisk(r.meta, new Date("2026-01-05T09:00:00")), false);
});

test("normalizeMeta fills defaults from partial rows", () => {
  const m = normalizeMeta({ streak: 4, gems: 30 } as never);
  assert.equal(m.hearts, 5);
  assert.equal(m.dailyGoal, 50);
  assert.equal(m.stats.cardsReviewed, 0);
});

test("chests: indexes, openable, idempotent", () => {
  assert.deepEqual(chestIndexes(7), [2, 5]);
  assert.deepEqual(chestIndexes(3), []);
  const levels = ["a", "b", "c", "d"].map((id) => ({ id }));
  const p = { xp: 0, levels: { a: { done: true, best: 80, stars: 2, attempts: 1 }, b: { done: true, best: 80, stars: 2, attempts: 1 }, c: { done: true, best: 80, stars: 2, attempts: 1 } } } as never;
  assert.equal(chestOpenable(p, levels, 2), true);
  const o = openChest(p, 2)!;
  assert.equal(o.gems, 10); // legacy GEM.chest
  assert.equal(openChest(o.progress, 2), null);
  assert.equal(chestOpenable(o.progress, levels, 2), false);
  const m = addGems(emptyMeta(), 100);
  assert.equal(spendGems(m, 150), null);
  assert.equal(spendGems(m, 100)!.gems, 0);
});

test("quests deterministic, progress and claim", () => {
  const a = generateDailyQuests("u1", "2026-01-01");
  const b = generateDailyQuests("u1", "2026-01-01");
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((q) => q.kind)).size, 3);
  assert.notDeepEqual(a, generateDailyQuests("u2", "2026-01-01"));
  let qs = applyQuestEvent(a, { type: "xp", amount: 1000 });
  qs = applyQuestEvent(qs, { type: "answer", correct: true, combo: 12 });
  qs = applyQuestEvent(qs, { type: "review", count: 50 });
  const done = qs.filter((q) => q.done);
  assert.ok(done.length >= 1);
  const c = claimQuest(qs, done[0]!.id)!;
  assert.equal(c.gems, done[0]!.reward);
  assert.equal(claimQuest(c.quests, done[0]!.id), null);
  assert.equal(questsForToday(qs, "u1", "2026-01-02")[0]!.progress, 0, "new day regenerates");
});

test("ranks", () => {
  assert.equal(rankFor(0).name, "Nowicjusz");
  assert.equal(rankFor(800).name, "Ogarniacz");
  assert.equal(rankFor(800).next, 1500);
  assert.equal(rankChanged(700, 800)!.name, "Ogarniacz");
  assert.equal(rankChanged(800, 900), null);
  assert.equal(rankFor(99999).pct, 100);
});

test("path layout: levels + chests + trophy, snake x", () => {
  const l = layoutPath(7, { width: 360 });
  assert.equal(l.nodes.length, 7 + 2 + 1);
  assert.equal(l.nodes[0]!.x, 180);
  assert.notEqual(l.nodes[1]!.x, 180);
  assert.equal(l.nodes.at(-1)!.kind, "trophy");
  assert.ok(l.d.startsWith("M 180"));
  assert.ok(l.height > 9 * 100);
});

test("achievements unlock once", () => {
  const meta = { ...emptyMeta(), stats: { ...emptyMeta().stats, levelsDone: 1 } };
  const first = evaluateAchievements({ meta, topicsCount: 1, totalXp: 0, streak: 0 }, new Set());
  assert.deepEqual(first.map((a) => a.key).sort(), ["first_level", "first_topic"]);
  assert.equal(evaluateAchievements({ meta, topicsCount: 1, totalXp: 0, streak: 0 }, new Set(["first_level", "first_topic"])).length, 0);
});

test("daily: week strip and today xp", () => {
  const act = addActivity({}, "2026-01-07", 30, 5); // Wednesday
  assert.equal(todayXp(act, "2026-01-07"), 30);
  const w = weekStrip(act, "2026-01-07");
  assert.equal(w.length, 7);
  assert.equal(w[0]!.day, "2026-01-05");
  assert.equal(w[2]!.isToday, true);
  assert.equal(w[6]!.future, true);
});

test("theme helpers", () => {
  assert.equal(hueDeep("#ffffff", 0.5), "#808080");
  assert.equal(hueFromColor("#22D3EE").deep, "#108CA1"); // curated cyan → tokens cyan-dark
  assert.equal(hueFromColor("#22D3EE").on, "#04232B");
  assert.equal(hueFromColor("#2EB8FF").deep, "#2184b8"); // legacy stored hue → computed edge
  assert.ok(cssVars().includes("--play-green:#B4FF3A") && cssVars().includes("--hard-edge:4px") && cssVars().includes("--acid-dark:#7FC400"));
});
