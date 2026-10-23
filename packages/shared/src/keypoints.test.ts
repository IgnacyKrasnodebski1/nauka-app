import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { blankGenTask, buildKeyPoints, expandGenTask, finalizeGeneratedWithStats, keyPointProblems, normalizeOutlinePoints, type KeyPointDraft, type KeyPointLevel } from "./finalize.js";
import { levelInstructions, OUTLINE_INSTRUCTIONS, VIZ_RULES } from "./prompts.js";
import { taskForReview } from "./review.js";
import {
  GeneratedTopicSchema,
  KeyPointSchema,
  LevelCoreGenLooseSchema,
  LevelCoreGenSchema,
  LevelGenSchema,
  LevelTasksGenLooseSchema,
  LevelTasksGenSchema,
  OutlineLooseSchema,
  OutlineSchema,
  TopicContentSchema,
  type GeneratedTopic,
} from "./schema.js";
import type { KeyPoint, TopicContent } from "./types.js";

/* Key points (docs/plan-media.md §1.1, §2.1): outline points + `p` tags → TopicContent.keyPoints, built in finalize. */

/** A level with `n` flashcards / quiz / tasks, every item tagged by `tag(kind, i)`. */
function lvl(id: string, n: { fc: number; q: number; t?: number }, tag: (kind: "fc" | "q" | "t", i: number) => string | undefined, title = `Poziom ${id}`): KeyPointLevel {
  return {
    id,
    title,
    flashcards: Array.from({ length: n.fc }, (_, i) => tag("fc", i)),
    quiz: Array.from({ length: n.q }, (_, i) => tag("q", i)),
    tasks: Array.from({ length: n.t ?? 0 }, (_, i) => tag("t", i)),
  };
}
const draft = (key: string, levels: string[], title = `Punkt ${key}`): KeyPointDraft => ({ key, title, short: title.slice(0, 20), summary: `O punkcie ${key}.`, levels });
/** Content-shaped view of tag levels (array lengths only), for keyPointProblems. */
const asContent = (levels: KeyPointLevel[], keyPoints?: KeyPoint[]) => ({ levels: levels.map((l) => ({ id: l.id, flashcards: l.flashcards, quiz: l.quiz, tasks: l.tasks })), keyPoints });
/** Every quiz / flashcard exactly once, every task at most once. */
function assertCoverage(levels: KeyPointLevel[], kp: KeyPoint[]) {
  const seen = new Map<string, number>();
  for (const p of kp) for (const it of p.items) seen.set(`${it.kind}:${it.level}:${it.index}`, (seen.get(`${it.kind}:${it.level}:${it.index}`) ?? 0) + 1);
  for (const l of levels) {
    l.flashcards.forEach((_, i) => assert.equal(seen.get(`flashcard:${l.id}:${i}`), 1, `flashcard ${l.id}#${i}`));
    l.quiz.forEach((_, i) => assert.equal(seen.get(`quiz:${l.id}:${i}`), 1, `quiz ${l.id}#${i}`));
    l.tasks.forEach((_, i) => assert.ok((seen.get(`task:${l.id}:${i}`) ?? 0) <= 1, `task ${l.id}#${i}`));
  }
  assert.deepEqual(keyPointProblems(asContent(levels, kp)), []);
}

/* ---------- buildKeyPoints ---------- */

test("buildKeyPoints: every item carries a valid p → points as tagged, ids p1..pN in material order, nothing repaired", () => {
  // two levels, three points each; items alternate between the level's points
  const levels = [
    lvl("l1", { fc: 6, q: 6, t: 3 }, (_, i) => ["a", "b", "c"][i % 3]),
    lvl("l2", { fc: 6, q: 6, t: 3 }, (_, i) => ["d", "e", "f"][i % 3]),
  ];
  const drafts = ["a", "b", "c", "d", "e", "f"].map((k, i) => draft(k, [i < 3 ? "l1" : "l2"]));
  const { keyPoints, stats } = buildKeyPoints(drafts, levels);
  assert.ok(keyPoints);
  assert.deepEqual(stats, { keyPoints: 6, repaired: 0, merged: 0, empty: 0, omitted: false });
  assert.deepEqual(keyPoints.map((p) => p.id), ["p1", "p2", "p3", "p4", "p5", "p6"]);
  assert.deepEqual(keyPoints.map((p) => p.title), ["Punkt a", "Punkt b", "Punkt c", "Punkt d", "Punkt e", "Punkt f"]);
  assert.deepEqual(keyPoints[0]!.levels, ["l1"]);
  assert.deepEqual(keyPoints[0]!.items.slice(0, 3), [
    { kind: "flashcard", level: "l1", index: 0 },
    { kind: "flashcard", level: "l1", index: 3 },
    { kind: "quiz", level: "l1", index: 0 },
  ]);
  assert.equal(keyPoints[0]!.summary, "O punkcie a.");
  assertCoverage(levels, keyPoints);
  assert.ok(z.array(KeyPointSchema).safeParse(keyPoints).success);
});

test("buildKeyPoints: keys match case-insensitively and a bare number means p<number>", () => {
  const levels = [lvl("l1", { fc: 9, q: 9 }, (_, i) => [" P1 ", "2", "p3"][i % 3]), lvl("l2", { fc: 9, q: 9 }, (_, i) => ["p4", "P5", "6"][i % 3])];
  const drafts = ["p1", "p2", "p3", "p4", "p5", "p6"].map((k, i) => draft(k, [i < 3 ? "l1" : "l2"]));
  const { keyPoints, stats } = buildKeyPoints(drafts, levels);
  assert.equal(stats.repaired, 0);
  assert.equal(keyPoints?.length, 6);
  assertCoverage(levels, keyPoints!);
});

test("buildKeyPoints: missing / unknown p → first point planned for that level, else the point with most items there, else a level point", () => {
  // l1: planned for a (and b); untagged items go to a. l2: nothing planned, c holds most items → untagged go to c.
  // l3: nothing planned and nothing tagged → a new point named after the level. l4: plain.
  const levels = [
    lvl("l1", { fc: 6, q: 6 }, (k, i) => (i < 2 ? undefined : k === "fc" ? "a" : i === 2 ? "zzz" : "b")),
    lvl("l2", { fc: 6, q: 6 }, (k, i) => (i === 0 ? "" : k === "fc" ? "c" : i < 4 ? "d" : "c")),
    lvl("l3", { fc: 4, q: 4, t: 2 }, () => undefined, "Instytucje <b>finansowe</b> 🏦"),
    lvl("l4", { fc: 4, q: 4 }, (_, i) => ["e", "f"][i % 2]),
  ];
  const drafts = [draft("a", ["l1"]), draft("b", ["l1"]), draft("c", []), draft("d", []), draft("e", ["l4"]), draft("f", ["l4"])];
  const { keyPoints, stats } = buildKeyPoints(drafts, levels);
  assert.ok(keyPoints, JSON.stringify(stats));
  // l1: 2 untagged cards + 2 untagged questions + 1 "zzz" question; l2: 2 empty tags; l3: 10 untagged
  assert.equal(stats.repaired, 5 + 2 + 10);
  assert.equal(stats.merged, 0);
  assert.equal(keyPoints.length, 7);
  const byTitle = Object.fromEntries(keyPoints.map((p) => [p.title, p]));
  const a = byTitle["Punkt a"]!;
  assert.ok(a.items.some((x) => x.kind === "flashcard" && x.level === "l1" && x.index === 0), "untagged card of l1 → a");
  assert.ok(a.items.some((x) => x.kind === "quiz" && x.level === "l1" && x.index === 2), "unknown key of l1 → a");
  const c = byTitle["Punkt c"]!;
  assert.ok(c.items.some((x) => x.kind === "flashcard" && x.level === "l2" && x.index === 0), "untagged card of l2 → c (most items there)");
  const l3 = keyPoints.find((p) => p.levels.includes("l3"))!;
  assert.equal(l3.title, "Instytucje finansowe", "tags and emoji stripped");
  assert.equal(l3.items.length, 10, "tasks of the level come along");
  assertCoverage(levels, keyPoints);
});

test("buildKeyPoints: a point with < 3 items or < 2 quiz / flashcard is merged into the biggest point sharing a level", () => {
  const levels = [
    lvl("l1", { fc: 8, q: 8, t: 2 }, (k, i) => (k === "t" ? "tiny" : k === "fc" && i === 0 ? "tiny" : i % 2 ? "a" : "b")),
    lvl("l2", { fc: 8, q: 8 }, (_, i) => ["c", "d", "e", "f"][i % 4]),
  ];
  // "tiny" has 3 items but only 1 flashcard / question → merged; b is the biggest point sharing l1
  const drafts = [draft("a", ["l1"]), draft("tiny", ["l1"]), draft("b", ["l1"]), draft("c", ["l2"]), draft("d", ["l2"]), draft("e", ["l2"]), draft("f", ["l2"])];
  const { keyPoints, stats } = buildKeyPoints(drafts, levels);
  assert.ok(keyPoints, JSON.stringify(stats));
  assert.equal(stats.merged, 1);
  assert.equal(keyPoints.length, 6);
  assert.ok(!keyPoints.some((p) => p.title === "Punkt tiny"));
  const sizes = Object.fromEntries(keyPoints.map((p) => [p.title, p.items.length]));
  // a: 4 fc (odd) + 4 q (odd) = 8; b: 3 fc + 4 q = 7 → b had fewer? check which got it: the bigger one (a: 8) wins
  assert.equal(sizes["Punkt a"], 8 + 3);
  assert.equal(sizes["Punkt b"], 7);
  assertCoverage(levels, keyPoints);
});

test("buildKeyPoints: a point with only 2 items and no shared level goes to its neighbour", () => {
  const levels = [
    lvl("l1", { fc: 6, q: 6 }, (_, i) => ["a", "b"][i % 2]),
    lvl("l2", { fc: 1, q: 1 }, () => "lonely"),
    lvl("l3", { fc: 6, q: 6 }, (_, i) => ["c", "d"][i % 2]),
    lvl("l4", { fc: 6, q: 6 }, (_, i) => ["e", "f"][i % 2]),
  ];
  const drafts = ["a", "b", "lonely", "c", "d", "e", "f"].map((k) => draft(k, []));
  const { keyPoints, stats } = buildKeyPoints(drafts, levels);
  assert.ok(keyPoints, JSON.stringify(stats));
  assert.equal(stats.merged, 1);
  const c = keyPoints.find((p) => p.title === "Punkt c")!;
  assert.deepEqual(c.levels, ["l2", "l3"], "the next point in material order took it");
  assertCoverage(levels, keyPoints);
});

test("buildKeyPoints: 17 points → the smallest are merged into neighbours down to 15", () => {
  const keys = Array.from({ length: 17 }, (_, i) => `k${i + 1}`);
  // one level per point; points k5 and k12 are the smallest (3 items) and merge first
  const levels = keys.map((k, i) => lvl(`l${i + 1}`, { fc: i === 4 || i === 11 ? 1 : 3, q: 2 }, () => k));
  const drafts = keys.map((k, i) => draft(k, [`l${i + 1}`]));
  const { keyPoints, stats } = buildKeyPoints(drafts, levels);
  assert.ok(keyPoints, JSON.stringify(stats));
  assert.equal(keyPoints.length, 15);
  assert.equal(stats.merged, 2);
  assert.ok(!keyPoints.some((p) => p.title === "Punkt k5" || p.title === "Punkt k12"));
  // neighbours (no shared level) → the smaller neighbour, the previous one on a tie
  assert.deepEqual(keyPoints.find((p) => p.title === "Punkt k4")!.levels, ["l4", "l5"]);
  assert.deepEqual(keyPoints.find((p) => p.title === "Punkt k11")!.levels, ["l11", "l12"]);
  assert.deepEqual(keyPoints.map((p) => p.id), Array.from({ length: 15 }, (_, i) => `p${i + 1}`));
  assertCoverage(levels, keyPoints);
});

test("buildKeyPoints: a tiny topic (< 18 quiz + flashcard) keeps 3–5 points; ≥ 18 needs 6", () => {
  const tiny = [lvl("l1", { fc: 8, q: 8 }, (_, i) => ["a", "b", "c", "d"][i % 4])];
  const small = buildKeyPoints(["a", "b", "c", "d"].map((k) => draft(k, ["l1"])), tiny);
  assert.equal(small.keyPoints?.length, 4);
  assert.equal(small.stats.omitted, false);
  assertCoverage(tiny, small.keyPoints!);

  const big = [lvl("l1", { fc: 9, q: 9 }, (_, i) => ["a", "b", "c", "d"][i % 4])];
  const r = buildKeyPoints(["a", "b", "c", "d"].map((k) => draft(k, ["l1"])), big);
  assert.equal(r.keyPoints, undefined);
  assert.deepEqual(r.stats, { keyPoints: 0, repaired: 0, merged: 0, empty: 0, omitted: true, reason: "too_few" });
});

test("buildKeyPoints: impossible inputs → omitted, never a throw", () => {
  const levels = [lvl("l1", { fc: 6, q: 6 }, () => "a"), lvl("l2", { fc: 6, q: 6 }, () => "b")];
  assert.equal(buildKeyPoints([], levels).stats.reason, "no_points");
  assert.equal(buildKeyPoints([{ key: "", title: "x", levels: [] }, { key: "a", title: "  ", levels: [] }], levels).stats.reason, "no_points");
  // one point holds everything
  assert.equal(buildKeyPoints([draft("a", ["l1"])], levels).stats.reason, "too_few");
  // a topic with fewer than 3 quiz + flashcard items cannot have 3 points of ≥ 2
  const r = buildKeyPoints([draft("a", ["l1"]), draft("b", ["l1"]), draft("c", ["l1"])], [lvl("l1", { fc: 1, q: 1, t: 4 }, (_, i) => ["a", "b", "c"][i % 3])]);
  assert.equal(r.keyPoints, undefined);
  assert.equal(r.stats.omitted, true);
  // a point over 120 items
  const huge = [lvl("l1", { fc: 60, q: 60, t: 20 }, (k, i) => (k === "t" || i < 58 ? "a" : i === 58 ? "b" : "c")), lvl("l2", { fc: 2, q: 2 }, () => "d")];
  const h = buildKeyPoints(["a", "b", "c", "d"].map((k) => draft(k, [])), huge);
  assert.equal(h.stats.reason, "too_few", "4 points for 124 items");
  // garbage in
  assert.equal(buildKeyPoints([{ key: 5, title: null, levels: "l1" } as unknown as KeyPointDraft], levels).stats.omitted, true);
});

test("buildKeyPoints: texts become plain single lines within the limits; short falls back to the title", () => {
  const levels = [lvl("l1", { fc: 6, q: 6 }, (_, i) => ["a", "b", "c"][i % 3]), lvl("l2", { fc: 6, q: 6 }, (_, i) => ["d", "e", "f"][i % 3])];
  const drafts: KeyPointDraft[] = ["a", "b", "c", "d", "e", "f"].map((k, i) => draft(k, [i < 3 ? "l1" : "l2"]));
  drafts[0] = { key: "a", title: `<img src=x onerror=alert(1)>MFW: rola\nMiędzynarodowego Funduszu 🌍 ${"x".repeat(200)}`, short: "Korporacje transnarodowe i ich rola", summary: "", levels: ["l1"] };
  drafts[1] = { key: "b", title: "Bank Światowy", levels: ["l1"] };
  const { keyPoints } = buildKeyPoints(drafts, levels);
  assert.ok(keyPoints);
  const [a, b] = keyPoints;
  assert.ok(!/[<>]/.test(a!.title) && !a!.title.includes("🌍") && !a!.title.includes("\n"));
  assert.ok(a!.title.startsWith("MFW: rola Międzynarodowego Funduszu x"));
  assert.equal([...a!.title].length, 120);
  assert.ok(a!.title.endsWith("…"));
  assert.equal(a!.short, "Korporacje transnarodow…");
  assert.equal(a!.short.length, 24);
  assert.ok(!("summary" in a!), "empty summary left out");
  assert.equal(b!.short, "Bank Światowy");
  assert.ok(z.array(KeyPointSchema).safeParse(keyPoints).success);
});

/* ---------- keyPointProblems ---------- */

test("keyPointProblems: catches bad refs, duplicates, uncovered items, ids out of order, wrong levels, small points", () => {
  const content = { levels: [{ id: "l1", flashcards: [1, 2, 3], quiz: [1, 2, 3], tasks: [1, 2, 3] }, { id: "l2", flashcards: [1, 2, 3], quiz: [1, 2, 3] }] };
  const item = (kind: "quiz" | "flashcard" | "task", level: string, index: number) => ({ kind, level, index });
  const good: KeyPoint[] = [
    { id: "p1", title: "A", short: "A", levels: ["l1"], items: [item("flashcard", "l1", 0), item("flashcard", "l1", 1), item("quiz", "l1", 0), item("task", "l1", 0)] },
    { id: "p2", title: "B", short: "B", levels: ["l1"], items: [item("flashcard", "l1", 2), item("quiz", "l1", 1), item("quiz", "l1", 2)] },
    { id: "p3", title: "C", short: "C", levels: ["l2"], items: [item("flashcard", "l2", 0), item("flashcard", "l2", 1), item("flashcard", "l2", 2), item("quiz", "l2", 0), item("quiz", "l2", 1), item("quiz", "l2", 2)] },
  ];
  assert.deepEqual(keyPointProblems({ ...content, keyPoints: good }), []);
  assert.deepEqual(keyPointProblems(content), [], "no keyPoints = nothing to check");
  const bad = structuredClone(good);
  bad[0]!.items[3] = item("task", "l1", 5);
  bad[1]!.id = "p7";
  bad[2]!.items[5] = item("quiz", "l1", 2);
  bad[2]!.levels = ["l2", "l1"];
  const problems = keyPointProblems({ ...content, keyPoints: bad });
  assert.ok(problems.some((p) => p.includes("no task l1#5")), problems.join("\n"));
  assert.ok(problems.some((p) => p.includes("has id p7")));
  assert.ok(problems.some((p) => p.includes("quiz l1#2 is in p7 and p3")));
  assert.ok(problems.some((p) => p.includes("quiz l2#2 is in no point")));
  assert.ok(problems.some((p) => p.includes("p3: levels")));
  // 3 items but only 1 quiz / flashcard (the schema already rejects < 3 items)
  const small = structuredClone(good);
  small[1]!.items = [item("quiz", "l1", 1), item("task", "l1", 1), item("task", "l1", 2)];
  small[0]!.items.push(item("flashcard", "l1", 2), item("quiz", "l1", 2));
  assert.deepEqual(keyPointProblems({ ...content, keyPoints: small }), ["p2: 3 items, 1 quiz / flashcard"]);
  assert.match(keyPointProblems({ ...content, keyPoints: good.slice(0, 2) })[0]!, /^shape:/, "fewer than 3 points");
  assert.match(keyPointProblems({ ...content, keyPoints: "nope" })[0]!, /^shape:/);
});

/* ---------- finalize ---------- */

const card = (t: string, p?: string) => ({ t, d: `Definicja ${t}`, ...(p === undefined ? {} : { p }) });
const question = (q: string, p?: string, ok = true) => ({ q, a: ["A", "B", "C", "D"], c: ok ? 0 : 7, e: `Bo ${q}.`, ...(p === undefined ? {} : { p }) });
function genTopic(points?: GeneratedTopic["points"]): GeneratedTopic {
  const level = (n: number, keys: string[]) => ({
    title: `Poziom ${n}`,
    emoji: "📘",
    summary: "",
    feed: [{ title: "Dawka", body: "<b>Pojęcie</b> wyjaśnione.", real: "", mnemo: "" }],
    flashcards: Array.from({ length: 6 }, (_, i) => card(`k${n}.${i}`, keys[i % keys.length])),
    // question 1 is broken (c out of range) → dropped by finalize: later questions shift down by one
    quiz: Array.from({ length: 7 }, (_, i) => question(`q${n}.${i}`, keys[i % keys.length], i !== 1)),
    games: [],
    tasks: [
      blankGenTask({ type: "typeterm", p: keys[0], definition: "Definicja", answer: "Pojęcie" }),
      blankGenTask({ type: "match", p: keys[1], pairs: [{ l: "a", r: "" }] }), // invalid → dropped
      blankGenTask({ type: "typeterm", p: keys[2], definition: "Inna definicja", answer: "Inne" }),
    ],
  });
  return { name: "MSGiP", short: "MSGiP", emoji: "🌍", tagline: "", category: "ekonomia", info_html: "", levels: [level(1, ["p1", "p2", "p3"]), level(2, ["p4", "p5", "p6"])], ...(points ? { points } : {}) };
}
const POINTS: NonNullable<GeneratedTopic["points"]> = ["p1", "p2", "p3", "p4", "p5", "p6"].map((key, i) => ({ key, title: `Punkt ${key}`, short: key.toUpperCase(), summary: "", levels: [i < 3 ? 0 : 1] }));

test("finalize: keyPoints refs follow the filtering (a dropped question shifts the indexes, a dropped task too)", () => {
  const { content, keyPoints } = finalizeGeneratedWithStats(genTopic(POINTS), "studia");
  assert.ok(TopicContentSchema.safeParse(content).success);
  assert.equal(content.levels[0]!.quiz.length, 6, "question 1 dropped");
  assert.equal(content.levels[0]!.tasks!.length, 2, "the match task dropped");
  assert.equal(keyPoints.omitted, false);
  assert.equal(keyPoints.keyPoints, 6);
  const kp = content.keyPoints!;
  assert.deepEqual(keyPointProblems(content), []);
  // original questions 0..6 tagged p1,p2,p3,p1,p2,p3,p1; question 1 (p2) dropped → final 0..5 = orig 0,2,3,4,5,6
  const quizOf = (id: string) => kp.find((p) => p.title === `Punkt ${id}`)!.items.filter((x) => x.kind === "quiz" && x.level === "l1").map((x) => x.index);
  assert.deepEqual(quizOf("p1"), [0, 2, 5]);
  assert.deepEqual(quizOf("p2"), [3]);
  assert.deepEqual(quizOf("p3"), [1, 4]);
  // tasks: orig 0 (p1), 1 dropped (p2), 2 (p3) → final 0 → p1, 1 → p3
  const taskOf = (id: string) => kp.find((p) => p.title === `Punkt ${id}`)!.items.filter((x) => x.kind === "task" && x.level === "l1").map((x) => x.index);
  assert.deepEqual(taskOf("p1"), [0]);
  assert.deepEqual(taskOf("p3"), [1]);
  // the stored items never carry the tag
  for (const l of content.levels) {
    for (const x of [...l.flashcards, ...l.quiz, ...(l.tasks ?? [])]) assert.ok(!("p" in x), "no p in stored items");
  }
});

test("finalize: a level dropped as empty takes its planned points with it; level ids stay as before", () => {
  const gen = genTopic(POINTS);
  gen.levels.splice(1, 0, { title: "Pusty", emoji: "📘", summary: "", feed: [], flashcards: [], quiz: [], games: [] });
  const points = POINTS.map((p, i) => ({ ...p, levels: [i < 3 ? 0 : 2] }));
  const { content, keyPoints } = finalizeGeneratedWithStats({ ...gen, points }, "liceum");
  assert.deepEqual(content.levels.map((l) => l.id), ["l1", "l3"]);
  assert.equal(keyPoints.omitted, false);
  assert.deepEqual([...new Set(content.keyPoints!.flatMap((p) => p.levels))], ["l1", "l3"]);
  assert.deepEqual(keyPointProblems(content), []);
});

test("finalize: no points (older callers, fixtures) → no keyPoints key, stats say why; content otherwise unchanged", () => {
  const without = finalizeGeneratedWithStats(genTopic(), "studia");
  assert.ok(!("keyPoints" in without.content));
  assert.deepEqual(without.keyPoints, { keyPoints: 0, repaired: 0, merged: 0, empty: 0, omitted: true, reason: "no_points" });
  const withPoints = finalizeGeneratedWithStats(genTopic(POINTS), "studia");
  const { keyPoints: _drop, ...rest } = withPoints.content;
  // answer order is shuffled on every finalize: compare questions by their correct answer
  const stable = (c: Omit<TopicContent, "keyPoints">) => ({ ...c, levels: c.levels.map((l) => ({ ...l, quiz: l.quiz.map((q) => ({ q: q.q, a: [...q.a].sort(), ok: q.a[q.c], e: q.e })) })) });
  assert.deepEqual(stable(rest), stable(without.content), "key points add one field and change nothing else");
});

test("finalize: untagged items (old shape, model forgot p) are repaired, not dropped", () => {
  const gen = genTopic(POINTS);
  for (const l of gen.levels) {
    // the items tagged with the level's first point lose their tag (or get an unknown one): repaired to that point
    delete (l.flashcards[0] as { p?: string }).p;
    delete (l.flashcards[3] as { p?: string }).p;
    l.quiz[0]!.p = "nieznany";
  }
  const { content, keyPoints } = finalizeGeneratedWithStats(gen, "studia");
  assert.equal(keyPoints.omitted, false, JSON.stringify(keyPoints));
  assert.equal(keyPoints.repaired, 2 * 3);
  assert.deepEqual(keyPointProblems(content), []);
  assert.deepEqual(content.keyPoints, finalizeGeneratedWithStats(genTopic(POINTS), "studia").content.keyPoints, "same points as fully tagged");

  // all cards untagged: they pile onto the first planned point and starve the others → merged, then too few → omitted
  const starved = genTopic(POINTS);
  for (const l of starved.levels) for (const c of l.flashcards) delete (c as { p?: string }).p;
  const r = finalizeGeneratedWithStats(starved, "studia");
  assert.equal(r.keyPoints.omitted, true);
  assert.equal(r.keyPoints.reason, "too_few");
  assert.ok(!("keyPoints" in r.content));
  assert.ok(TopicContentSchema.safeParse(r.content).success, "the topic itself is fine");
});

/* ---------- normalizeOutlinePoints ---------- */

test("normalizeOutlinePoints: level numbers from 1 → 0-based, dedupes keys, drops unusable points, plain texts", () => {
  const raw = [
    { key: "p1", title: "MFW: rola <b>Funduszu</b> 💰", short: "MFW", summary: "Wie, co robi MFW.", levels: [1] },
    { key: "p2", title: "Bank Światowy", short: "", summary: "", levels: [2, 2, 9, 1.5] },
    { key: "P1", title: "duplikat", short: "x", summary: "", levels: [3] },
    { key: "", title: "Bez klucza", short: "BK", summary: "", levels: [3] },
    { key: "p5", title: "", short: "", summary: "", levels: [1] },
    { key: "p6", title: "Poza zakresem", short: "", summary: "", levels: [7] },
    "śmieć",
  ];
  const out = normalizeOutlinePoints(raw, 3);
  assert.deepEqual(out, [
    { key: "p1", title: "MFW: rola Funduszu", short: "MFW", summary: "Wie, co robi MFW.", levels: [0, 2] },
    { key: "p2", title: "Bank Światowy", levels: [1] },
    { key: "p4", title: "Bez klucza", short: "BK", levels: [2] },
  ]);
  assert.deepEqual(normalizeOutlinePoints(undefined, 3), []);
  assert.deepEqual(normalizeOutlinePoints({ points: [] }, 3), []);
  assert.deepEqual(normalizeOutlinePoints(raw, 0), []);
});

test("normalizeOutlinePoints: a plainly 0-based list (uses 0, never the last number) is read as indexes; at most 20 points", () => {
  const zero = normalizeOutlinePoints([{ key: "a", title: "A", short: "", summary: "", levels: [0] }, { key: "b", title: "B", short: "", summary: "", levels: [1] }], 3);
  assert.deepEqual(zero.map((p) => p.levels), [[0], [1]]);
  const many = normalizeOutlinePoints(Array.from({ length: 30 }, (_, i) => ({ key: `p${i + 1}`, title: `T${i}`, short: "", summary: "", levels: [1] })), 2);
  assert.equal(many.length, 20);
});

/* ---------- prompts ---------- */

test("outline prompt asks for 6–15 points with key, title, short ≤ 24, summary and 1-based level numbers", () => {
  assert.match(OUTLINE_INSTRUCTIONS, /points = 6–15 punktów do opanowania/);
  assert.match(OUTLINE_INSTRUCTIONS, /key = "p1", "p2"/);
  assert.match(OUTLINE_INSTRUCTIONS, /short = etykieta, najwyżej 24 znaki/);
  assert.match(OUTLINE_INSTRUCTIONS, /levels = numery poziomów \(od 1\)/);
  assert.match(OUTLINE_INSTRUCTIONS, /nie pokrywają/);
  assert.match(OUTLINE_INSTRUCTIONS, /kolejności materiału/);
  assert.match(OUTLINE_INSTRUCTIONS, /Bez emoji/);
});

test("level prompts list the level's own points, the other keys as allowed values, and require p", () => {
  const outline = {
    name: "MSGiP",
    levels: [{ title: "Pojęcia", scope: "- MSG\n- MSP" }, { title: "Instytucje", scope: "- MFW\n- Bank Światowy" }],
    points: [
      { key: "p1", title: "MSG a MSP", summary: "Odróżniasz MSG od MSP.", levels: [0] },
      { key: "p2", title: "MFW", levels: [1] },
      { key: "p3", title: "Bank Światowy", summary: "x".repeat(300), levels: [1] },
    ],
  };
  const core = levelInstructions(outline, 1, "core");
  assert.match(core, /PUNKTY DO OPANOWANIA \(pole p\) na tym poziomie:\n- p2: MFW\n- p3: Bank Światowy — x+…\n/);
  assert.ok(!core.includes("- p1:"), "other levels' points are not listed");
  assert.match(core, /Każda fiszka i każde pytanie quizu ma p = klucz punktu, który sprawdza \(np\. "p2"\)/);
  assert.match(core, /co najmniej 3 fiszki i pytania quizu razem, w tym co najmniej 1 pytanie/);
  assert.match(core, /Klucz punktu z innego poziomu \(p1\)/);
  assert.ok(core.indexOf("PUNKTY DO OPANOWANIA") < core.indexOf("Zwróć TYLKO"), "the rules come before the return line");
  const tasks = levelInstructions(outline, 1, "tasks");
  assert.match(tasks, /Każde zadanie ma p = klucz punktu/);
  assert.ok(!tasks.includes("co najmniej 3 fiszki"), "the coverage rule is for cards and questions");
  assert.match(tasks, /\{p, type, title, e, payload, src_page, src_quote\}/);
  assert.match(levelInstructions(outline, 0, "all"), /Każda fiszka, każde pytanie quizu i każde zadanie ma p/);
  // viz rules stay the last block
  assert.equal(levelInstructions(outline, 0, "core", { viz: true }), `${levelInstructions(outline, 0, "core")}\n\n${VIZ_RULES}`);
  // a level no point was planned for: every point is a candidate
  const orphan = levelInstructions({ ...outline, points: outline.points.filter((p) => p.levels[0] === 1) }, 0, "core");
  assert.match(orphan, /PUNKTY DO OPANOWANIA \(pole p\) całego materiału:\n- p2: MFW/);
  assert.match(orphan, /najbliższego z listy/);
  // no points at all: p stays empty
  assert.match(levelInstructions({ name: "X", levels: outline.levels }, 0, "core"), /Pole p: każda fiszka i każde pytanie quizu ma p = "" \(pusty string\)\./);
});

/* ---------- schemas ---------- */

test("grammars: p is required on cards, questions and compact tasks; outline has points after levels", () => {
  type Obj = { properties: Record<string, Obj>; required: string[]; items: Obj };
  const core = z.toJSONSchema(LevelCoreGenSchema) as unknown as Obj;
  for (const k of ["flashcards", "quiz"]) {
    const item = core.properties[k]!.items;
    assert.equal(Object.keys(item.properties)[0], "p", `${k}: p first`);
    assert.deepEqual(item.properties.p, { type: "string" });
    assert.ok(item.required.includes("p"));
  }
  assert.ok(!("p" in core.properties.feed!.items.properties), "doses have no p");
  const tasks = z.toJSONSchema(LevelTasksGenSchema) as unknown as Obj;
  assert.ok(tasks.properties.tasks!.items.required.includes("p"));
  const outline = z.toJSONSchema(OutlineSchema) as unknown as Obj;
  assert.deepEqual(Object.keys(outline.properties).slice(-2), ["levels", "points"]);
  assert.deepEqual(outline.properties.points!.items.required, ["key", "title", "short", "summary", "levels"]);
});

test("parsers: answers without p (raw-JSON fallback, older fixtures) stay valid; a non-string p is dropped", () => {
  const level = { feed: [], flashcards: [{ t: "a", d: "b" }, { t: "c", d: "d", p: 3 }], quiz: [{ q: "q", a: ["a", "b"], c: 0, e: "e", src_page: 0, src_quote: "" }], games: [] };
  assert.equal(LevelCoreGenSchema.safeParse(level).success, false, "the grammar schema requires p");
  const loose = LevelCoreGenLooseSchema.parse(level);
  assert.equal(loose.flashcards[1]!.p, undefined);
  assert.ok(LevelGenSchema.safeParse({ ...level, tasks: [] }).success);
  const t = { type: "tf", title: "", e: "", payload: "{}", src_page: 0, src_quote: "" };
  assert.equal(LevelTasksGenSchema.safeParse({ tasks: [t] }).success, false);
  assert.ok(LevelTasksGenLooseSchema.safeParse({ tasks: [t] }).success);
  const outline = { name: "n", short: "s", emoji: "e", tagline: "", category: "inne", info_html: "", levels: [] };
  assert.equal(OutlineSchema.safeParse(outline).success, false);
  assert.equal(OutlineLooseSchema.parse(outline).points, undefined);
  assert.equal(OutlineLooseSchema.parse({ ...outline, points: "zle" }).points, undefined);
  assert.ok(GeneratedTopicSchema.safeParse({ ...outline, info_html: "", levels: [{ title: "t", emoji: "e", summary: "", feed: [], flashcards: [{ t: "a", d: "b" }], quiz: [], games: [] }] }).success);
});

test("expandGenTask carries p from the compact task (never from the payload); the reviewer never sees p", () => {
  const t = expandGenTask({ p: "p3", type: "typeterm", title: "", e: "", payload: JSON.stringify({ definition: "d", answer: "a", p: "p9" }), src_page: 0, src_quote: "" });
  assert.equal(t?.p, "p3");
  assert.equal(expandGenTask({ type: "typeterm", title: "", e: "", payload: "{}" })?.p, undefined);
  const view = taskForReview(blankGenTask({ type: "typeterm", p: "p3", definition: "d", answer: "a" }) as unknown as Record<string, unknown> & { type: string });
  assert.ok(!("p" in view));
});

test("TopicContentSchema: keyPoints optional; malformed points rejected", () => {
  const base = finalizeGeneratedWithStats(genTopic(POINTS), "studia").content;
  assert.ok(TopicContentSchema.safeParse(base).success);
  const { keyPoints, ...old } = base;
  assert.ok(TopicContentSchema.safeParse(old).success, "old topic without keyPoints");
  const bad = (kp: unknown) => TopicContentSchema.safeParse({ ...base, keyPoints: kp }).success;
  assert.equal(bad([{ ...keyPoints![0]!, id: "x1" }, ...keyPoints!.slice(1)]), false, "id");
  assert.equal(bad([{ ...keyPoints![0]!, short: "x".repeat(25) }, ...keyPoints!.slice(1)]), false, "short > 24");
  assert.equal(bad([{ ...keyPoints![0]!, items: keyPoints![0]!.items.slice(0, 2) }, ...keyPoints!.slice(1)]), false, "< 3 items");
  assert.equal(bad([{ ...keyPoints![0]!, items: [{ kind: "game", level: "l1", index: 0 }, ...keyPoints![0]!.items] }, ...keyPoints!.slice(1)]), false, "kind");
  assert.equal(bad(keyPoints!.slice(0, 2)), false, "< 3 points");
  assert.equal(bad([...keyPoints!, ...keyPoints!, ...keyPoints!]), false, "> 15 points");
});

test("old fixtures (nauka-app/test/fixtures, when present) still parse and have no keyPoints problems", (t) => {
  const dir = new URL("../../../../nauka-app/test/fixtures/", import.meta.url);
  const files = ["topic-makro.json", "topic-krypto.json"].filter((f) => existsSync(new URL(f, dir)));
  if (!files.length) return t.skip("nauka-app fixtures not found");
  for (const f of files) {
    const c = JSON.parse(readFileSync(new URL(f, dir), "utf8")) as TopicContent;
    assert.ok(TopicContentSchema.safeParse(c).success, f);
    assert.equal(c.keyPoints, undefined, f);
    assert.deepEqual(keyPointProblems(c), [], f);
  }
});
