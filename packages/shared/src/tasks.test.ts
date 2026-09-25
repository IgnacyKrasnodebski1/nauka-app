import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TaskSchema, LevelSchema, TopicContentSchema, LevelGenSchema, GenTaskSchema } from "./schema.js";
import { blankGenTask, convertTask, finalizeGenerated, sourceFrom } from "./finalize.js";
import { gamesAsTasks, levelSession, levelTasks, interleave, checkTypeTerm, checkFill, checkOrder, checkSort, checkTimeline, checkChain, shuffledOrder, foldAnswer, levenshtein, taskPoints, TASK_XP, TASK_META, allTasks } from "./tasks.js";
import { TASK_TYPES, AI_TASK_TYPES, type Task, type Level, type MiniGame } from "./types.js";
import { TOKENS, TOKENS_CSS, MOTION_CLASSES, FONT_LINK, COLORS, PLAY, SUBJECT_HUES, accentVars } from "./theme.js";
import { startBoss, bossAnswer, finishBoss, bossHp, BOSS_HP, bossNodeState } from "./boss.js";
import { recordStep, ghostFinish, ghostStatus, ghostBetter, GHOST_WIN_XP } from "./ghost.js";
import { albumRarity, albumCheck, srsBox, albumCount, albumKey } from "./album.js";
import { GEMS, GEM_COSTS, SHOP_ITEMS, levelGems, applyBoost, boostUntil } from "./gems.js";
import { QUEST_POOL, generateDailyQuests, generateWeeklyQuest, weeklyQuestFor, applyQuestEvent, weekKey, questsForToday } from "./quests.js";
import { HEART_REFILL_GEMS } from "./hearts.js";
import { ACHIEVEMENTS, evaluateAchievements } from "./achievements.js";
import { emptyMeta } from "./gamification.js";

/* ---------------- fixtures: one valid task of every type ---------------- */
const TASKS: Task[] = [
  { type: "match", title: "Pary", pairs: [["PKB", "wartość dóbr"], ["CPI", "wskaźnik cen"], ["Deficyt", "wydatki > dochody"]] },
  { type: "fill", text: "Inflacja to {0} poziomu cen, a deflacja to {1}.", blanks: ["wzrost", "spadek"], bank: ["stagnacja", "wahanie"], hint: "kierunek zmiany" },
  { type: "order", items: ["Podatki", "Budżet", "Wydatki", "Deficyt"] },
  { type: "sort", buckets: [{ name: "Fiskalna", items: ["podatki", "wydatki"] }, { name: "Monetarna", items: ["stopy", "rezerwa"] }] },
  { type: "tf", seconds: 60, statements: [{ s: "NBP ustala stopy.", v: true }, { s: "Sejm ustala stopy.", v: false, e: "To RPP." }, { s: "Inflacja obniża realną wartość pieniądza.", v: true }] },
  { type: "timeline", events: [{ label: "Euro w obiegu", year: 2002 }, { label: "Polska w UE", year: 2004 }, { label: "Kryzys", year: 2008 }] },
  { type: "finderror", sentences: ["PKB mierzy produkcję.", "CPI mierzy bezrobocie.", "Deficyt to nadwyżka wydatków."], wrong: 1, fix: "inflację" },
  { type: "thesis", thesis: "Rynek sam się reguluje.", options: [{ name: "Keynes" }, { name: "Smith", sub: "niewidzialna ręka" }, { name: "Marks" }], c: 1 },
  { type: "chain", steps: ["Wzrost stóp", "Droższy kredyt", "Mniej inwestycji", "Spadek inflacji"], given: [0], bank: ["Wzrost eksportu"] },
  { type: "scenario", scene: "Bank centralny widzi inflację 10%.", q: "Co zrobi?", a: ["Podniesie stopy", "Obniży stopy", "Dodrukuje pieniądz", "Nic"], c: 0, e: "Wyższe stopy studzą popyt." },
  { type: "swipe", left: "Popyt", right: "Podaż", cards: [{ front: "Konsumpcja", side: "left" }, { front: "Produkcja", side: "right" }, { front: "Import", side: "left" }] },
  { type: "typeterm", definition: "Ogólny wzrost poziomu cen.", answer: "inflacja", accept: ["inflacja cenowa"], typo: 1 },
  { type: "chart", chart: { kind: "bar", label: "CPI %", x: ["2021", "2022", "2023"], y: [5.1, 14.4, 11.4] }, q: "Kiedy CPI było najwyższe?", a: ["2021", "2022", "2023"], c: 1 },
  { type: "mathsteps", start: "3x + 7 = 22", steps: [{ expr: "3x = 15", note: "odejmij 7", options: ["3x = 15", "3x = 29"], c: 0 }, { expr: "x = 5", options: ["x = 5", "x = 45"], c: 0 }] },
  { type: "hotspot", image: "<svg viewBox='0 0 100 100'></svg>", targets: [{ name: "blok A", x: 20, y: 30, r: 10 }] },
];

test("TaskSchema accepts every type and rejects broken ones", () => {
  assert.equal(TASKS.length, 15);
  assert.deepEqual([...new Set(TASKS.map((t) => t.type))].sort(), [...TASK_TYPES].sort());
  for (const t of TASKS) {
    const r = TaskSchema.safeParse(t);
    assert.ok(r.success, `${t.type}: ${r.success ? "" : JSON.stringify(r.error.issues)}`);
    assert.ok(TASK_META[t.type].label);
  }
  assert.equal(TaskSchema.safeParse({ type: "scenario", scene: "s", q: "q", a: ["a", "b"], c: 2 }).success, false);
  assert.equal(TaskSchema.safeParse({ type: "finderror", sentences: ["a", "b"], wrong: 5, fix: "x" }).success, false);
  assert.equal(TaskSchema.safeParse({ type: "fill", text: "no gaps", blanks: ["a"], bank: [] }).success, false);
  assert.equal(TaskSchema.safeParse({ type: "fill", text: "{0} and {3}", blanks: ["a"], bank: [] }).success, false);
  assert.equal(TaskSchema.safeParse({ type: "chain", steps: ["a", "b"], given: [0, 1], bank: [] }).success, false);
  assert.equal(TaskSchema.safeParse({ type: "unknown", foo: 1 }).success, false);
  assert.ok(AI_TASK_TYPES.every((t) => TASK_TYPES.includes(t)) && !(AI_TASK_TYPES as readonly string[]).includes("hotspot"));
});

test("old content stays valid; tasks + src are optional extras", () => {
  const level: Level = { id: "l1", title: "T", emoji: "x", feed: [], flashcards: [], quiz: [{ q: "q", a: ["a", "b"], c: 0, e: "e" }], games: [] };
  assert.ok(LevelSchema.safeParse(level).success);
  const withTasks = { ...level, quiz: [{ ...level.quiz[0]!, src: { material: "m1", page: 3, quote: "zdanie" } }], tasks: TASKS.map((t) => ({ ...t, src: { page: 1 } })) };
  assert.ok(LevelSchema.safeParse(withTasks).success);
  const topic = { name: "N", short: "N", emoji: "x", tagline: "", accent: "a", accent2: "#B4FF3A", grading: { pass: 50, examMin: 20, scale: [[50, "3"]], failLabel: "2" }, info: "", levels: [withTasks] };
  assert.ok(TopicContentSchema.safeParse(topic).success);
});

test("gamesAsTasks maps legacy games onto task renderers", () => {
  const games: MiniGame[] = [
    { type: "match", title: "M", pairs: [{ l: "a", r: "1" }, { l: "b", r: "2" }, { l: "c", r: "3" }] },
    { type: "cloze", items: [{ s: "Woda wrze w ___ °C.", answer: "100", options: ["100", "90", "50"], e: "e1" }, { s: "Lód topi się w ___ °C.", answer: "0", options: ["0", "10"] }, { s: "bez luki", answer: "x", options: ["x", "y"] }] },
    { type: "truefalse", items: [{ s: "a", v: true }, { s: "b", v: false, e: "why" }, { s: "c", v: true }] },
    { type: "order", prompt: "Ułóż", steps: ["1", "2", "3"] },
  ];
  const tasks = gamesAsTasks(games);
  assert.deepEqual(tasks.map((t) => t.type), ["match", "fill", "tf", "order"]);
  const fill = tasks[1] as Extract<Task, { type: "fill" }>;
  assert.equal(fill.text, "Woda wrze w {0} °C.\nLód topi się w {1} °C.");
  assert.deepEqual(fill.blanks, ["100", "0"]);
  assert.deepEqual(fill.bank, ["90", "50", "10"]);
  const order = tasks[3] as Extract<Task, { type: "order" }>;
  assert.equal(order.title, "Ułóż");
  for (const t of tasks) assert.ok(TaskSchema.safeParse(t).success, t.type);
  // levelTasks prefers own tasks, falls back to games
  assert.equal(levelTasks({ games, tasks: [] }).length, 4);
  assert.equal(levelTasks({ games, tasks: [TASKS[0]!] }).length, 1);
  assert.equal(levelTasks({ games, tasks: [{ type: "bogus" } as unknown as Task] }).length, 4);
});

test("levelSession: first item is a question, tasks spread evenly, deterministic with rand", () => {
  const quiz = Array.from({ length: 10 }, (_, i) => ({ q: `q${i}`, a: ["a", "b", "c", "d"], c: i % 4, e: "e" }));
  const level = { quiz, tasks: TASKS.slice(0, 4), games: [] as MiniGame[] };
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const items = levelSession(level, { rand });
  assert.equal(items.length, 10); // 6 quiz + 4 tasks
  assert.equal(items[0]!.kind, "quiz");
  assert.equal(items.filter((i) => i.kind === "quiz").length, 6);
  assert.equal(items.filter((i) => i.kind === "task").length, 4);
  // no two tasks adjacent when there are enough questions
  for (let i = 1; i < items.length; i++) assert.ok(!(items[i]!.kind === "task" && items[i - 1]!.kind === "task"), `adjacent tasks at ${i}`);
  // quiz answers are shuffled but still consistent
  for (const it of items) if (it.kind === "quiz") assert.equal(it.q.a[it.q.c], quiz[it.qi]!.a[quiz[it.qi]!.c]);
  // xp per item
  assert.ok(items.every((i) => i.xp === (i.kind === "quiz" ? 5 : TASK_XP)));
  assert.equal(taskPoints(TASKS[0]!), TASK_XP);
  // legacy games converted when the level has no tasks
  const games: MiniGame[] = [{ type: "order", prompt: "p", steps: ["1", "2", "3"] }];
  assert.equal(levelSession({ quiz, tasks: [], games }).filter((i) => i.kind === "task").length, 1);
  assert.equal(levelSession({ quiz, tasks: [], games }, { games: "keep" }).filter((i) => i.kind === "game").length, 1);
  assert.equal(levelSession({ quiz, tasks: [], games }, { games: "skip" }).length, 6);
  // only tasks / only quiz
  assert.equal(levelSession({ quiz: [], tasks: TASKS.slice(0, 2) }).length, 2);
  assert.deepEqual(interleave([1, 2, 3, 4, 5], ["a", "b"]), [1, "a", 2, 3, "b", 4, 5]); // legacy levelSession order
  assert.deepEqual(interleave([1], ["a", "b"]), [1, "a", "b"]);
});

test("answer checkers", () => {
  const tt = TASKS.find((t) => t.type === "typeterm") as Extract<Task, { type: "typeterm" }>;
  assert.ok(checkTypeTerm(tt, "Inflacja"));
  assert.ok(checkTypeTerm(tt, "inflacia")); // 1 typo
  assert.ok(checkTypeTerm(tt, "INFLACJA CENOWA!"));
  assert.ok(!checkTypeTerm(tt, "deflacja"));
  assert.ok(!checkTypeTerm(tt, ""));
  assert.equal(foldAnswer("Żółć, Łódź!"), "zolc lodz");
  assert.equal(levenshtein("kot", "kod"), 1);
  const fill = TASKS.find((t) => t.type === "fill") as Extract<Task, { type: "fill" }>;
  assert.deepEqual(checkFill(fill, ["Wzrost", "spadek"]), { ok: true, per: [true, true] });
  assert.equal(checkFill(fill, ["spadek", "wzrost"]).ok, false);
  const order = TASKS.find((t) => t.type === "order") as Extract<Task, { type: "order" }>;
  assert.ok(checkOrder(order, [0, 1, 2, 3]).ok && !checkOrder(order, [1, 0, 2, 3]).ok);
  for (let i = 0; i < 20; i++) assert.ok(!shuffledOrder(4).every((v, k) => v === k));
  const sort = TASKS.find((t) => t.type === "sort") as Extract<Task, { type: "sort" }>;
  assert.ok(checkSort(sort, { podatki: 0, wydatki: 0, stopy: 1, rezerwa: 1 }).ok);
  assert.deepEqual(checkSort(sort, { podatki: 1, wydatki: 0, stopy: 1, rezerwa: 1 }).wrong, ["podatki"]);
  const tl = TASKS.find((t) => t.type === "timeline") as Extract<Task, { type: "timeline" }>;
  assert.ok(checkTimeline(tl, [0, 1, 2]).ok && !checkTimeline(tl, [2, 1, 0]).ok);
  const chain = TASKS.find((t) => t.type === "chain") as Extract<Task, { type: "chain" }>;
  assert.ok(checkChain(chain, { 1: "Droższy kredyt", 2: "Mniej inwestycji", 3: "Spadek inflacji" }).ok);
  assert.ok(!checkChain(chain, { 1: "Wzrost eksportu", 2: "Mniej inwestycji", 3: "Spadek inflacji" }).ok);
});

test("finalizeGenerated converts flat AI tasks, drops invalid, keeps games, passes src", () => {
  const gen = {
    name: "Makro",
    short: "Makro",
    emoji: "📊",
    tagline: "",
    category: "ekonomia",
    info_html: "",
    levels: [
      {
        title: "L1",
        emoji: "1",
        summary: "",
        feed: [{ title: "a", body: "b", real: "", mnemo: "" }],
        flashcards: [{ t: "t", d: "d" }],
        quiz: [{ q: "q", a: ["a", "b", "c", "d"], c: 2, e: "e", src_page: 4, src_quote: "cytat" }],
        games: [{ type: "order" as const, title: "", pairs: [], cloze: [], tf: [], prompt: "p", steps: ["1", "2", "3"] }],
        tasks: [
          blankGenTask({ type: "tf", statements: [{ s: "a", v: true, e: "" }, { s: "b", v: false, e: "x" }], seconds: 45, src_page: 2, src_quote: "zdanie" }),
          blankGenTask({ type: "fill", text: "Woda wrze w ___ stopniach, lód topnieje w ___.", blanks: ["100", "0"], bank: ["50", "100", " "] }),
          blankGenTask({ type: "typeterm", definition: "d", answer: "a", accept: [] }),
          blankGenTask({ type: "scenario", scene: "s", q: "q", a: ["x", "y"], c: 5 }), // invalid c → dropped
          blankGenTask({ type: "match", pairs: [{ l: "a", r: "" }] }), // too few → dropped
          blankGenTask({ type: "chain", steps: ["a", "b", "c"], given: [9], bank: ["a", "zz"] }),
          blankGenTask({ type: "swipe", left: "L", right: "R", cards: [{ front: "1", sub: "", side: "left" as const, e: "" }, { front: "2", sub: "", side: "right" as const, e: "" }] }),
          blankGenTask({ type: "order", items: [], steps: ["1", "2"] }),
        ],
      },
    ],
  };
  const c = finalizeGenerated(gen, "liceum", { materialId: "mat-1" });
  const l = c.levels[0]!;
  assert.equal(l.games!.length, 1);
  const types = l.tasks!.map((t) => t.type);
  assert.deepEqual(types, ["tf", "fill", "typeterm", "chain", "swipe", "order"]);
  const tf = l.tasks![0] as Extract<Task, { type: "tf" }>;
  assert.equal(tf.seconds, 45);
  assert.deepEqual(tf.src, { material: "mat-1", page: 2, quote: "zdanie" });
  const fill = l.tasks![1] as Extract<Task, { type: "fill" }>;
  assert.equal(fill.text, "Woda wrze w {0} stopniach, lód topnieje w {1}.");
  assert.deepEqual(fill.bank, ["50"]);
  assert.deepEqual(fill.src, { material: "mat-1" });
  const chain = l.tasks![3] as Extract<Task, { type: "chain" }>;
  assert.deepEqual(chain.given, [0]);
  assert.deepEqual(chain.bank, ["zz"]);
  assert.equal((l.tasks![2] as Extract<Task, { type: "typeterm" }>).accept, undefined);
  assert.deepEqual(l.quiz[0]!.src, { material: "mat-1", page: 4, quote: "cytat" });
  assert.ok(TopicContentSchema.safeParse(c).success);
  // without tasks the field is absent (old shape)
  const c2 = finalizeGenerated({ ...gen, levels: [{ ...gen.levels[0]!, tasks: undefined, quiz: [{ q: "q", a: ["a", "b"], c: 0, e: "e" }] }] }, "studia");
  assert.equal("tasks" in c2.levels[0]!, false);
  assert.equal(c2.levels[0]!.quiz[0]!.src, undefined);
  assert.equal(sourceFrom("", 0), undefined);
  assert.equal(convertTask(blankGenTask({ type: "tf" })), null);
  // the flat gen shapes themselves validate
  assert.ok(GenTaskSchema.safeParse(blankGenTask({ type: "tf" })).success);
  assert.ok(LevelGenSchema.safeParse({ feed: [], flashcards: [], quiz: [], games: [], tasks: [] }).success);
  assert.equal(allTasks(c).length, 6);
});

/* ---------------- tokens 2.0 ---------------- */

test("TOKENS mirror tokens.css and legacy names re-point to the new palette", () => {
  const root = /:root\{([\s\S]*?)\n\}/.exec(TOKENS_CSS)![1]!;
  const vars = new Map<string, string>();
  for (const m of root.matchAll(/--([a-z0-9-]+):([^;]+);/g)) vars.set(m[1]!, m[2]!.trim());
  assert.ok(vars.size >= 50, `parsed ${vars.size} vars`);
  for (const [k, v] of vars) assert.equal((TOKENS as Record<string, string>)[k], v, `token ${k}`);
  assert.equal(Object.keys(TOKENS).length, vars.size);
  // the embedded CSS equals the file when the repo is around (dist test runs from packages/shared)
  const file = path.resolve(process.cwd(), "../../design/tokens.css");
  if (fs.existsSync(file)) assert.equal(TOKENS_CSS, fs.readFileSync(file, "utf8"));
  for (const c of MOTION_CLASSES) assert.ok(TOKENS_CSS.includes(`.${c}{`), c);
  assert.ok(FONT_LINK.includes("Bricolage+Grotesque") && FONT_LINK.includes("Plus+Jakarta+Sans"));
  assert.equal(COLORS.bg0, "#0E0C1C");
  assert.equal(COLORS.bg2, "#1B1836");
  assert.equal(COLORS.bg3, "#15122B");
  assert.equal(COLORS.line, "#2C2850");
  assert.equal(PLAY.green, "#B4FF3A");
  assert.equal(PLAY.blue, "#22D3EE");
  assert.equal(PLAY.purple, "#A855F7");
  assert.equal(PLAY.orange, "#FFA023");
  assert.equal(PLAY.yellow, "#FFC043");
  assert.equal(PLAY.flame, "#FF7A1A");
  assert.equal(SUBJECT_HUES.length, 6);
  assert.deepEqual(SUBJECT_HUES.map((h) => h.name), ["acid", "pink", "amber", "cyan", "gold", "violet"]);
  assert.ok(SUBJECT_HUES.every((h) => h.color && h.deep && h.soft && h.on));
  assert.ok(accentVars("#FF2E93").includes("--accent-dark:#B01460"));
});

/* ---------------- gamification parity ---------------- */

test("gems / shop / hearts follow legacy KROK 8 values", () => {
  assert.equal(GEMS.levelPass, 10);
  assert.equal(GEMS.levelPerfect, 5);
  assert.equal(GEMS.chest, 10);
  assert.equal(GEMS.dailyGoal, 5);
  assert.equal(GEMS.boss, 25);
  assert.equal(levelGems(3), 15);
  assert.equal(levelGems(2), 10);
  assert.deepEqual(SHOP_ITEMS.map((i) => i.price), [100, 50, 80, 150]);
  assert.equal(GEM_COSTS.heartRefill, HEART_REFILL_GEMS);
  const until = boostUntil(1000);
  assert.equal(applyBoost(5, until, 2000), 10);
  assert.equal(applyBoost(-2, until, 2000), -2);
  assert.equal(applyBoost(5, until, until + 1), 5);
});

test("missions: legacy pool values, weekly quest, task events", () => {
  const byKind = Object.fromEntries(QUEST_POOL.map((t) => [t.kind, t]));
  assert.deepEqual(byKind.xp!.targets, [60, 100, 150]);
  assert.equal(byKind.xp!.reward, 20);
  assert.deepEqual(byKind.combo!.targets, [8, 10, 15]);
  assert.equal(byKind.combo!.reward, 30);
  assert.equal(byKind.review!.reward, 25);
  assert.equal(byKind.levels!.reward, 25);
  const qs = generateDailyQuests("u", "2026-03-02", 50);
  assert.equal(qs.length, 3);
  assert.deepEqual(qs, generateDailyQuests("u", "2026-03-02", 50));
  const xpq = generateDailyQuests("u", "2026-03-02", 100).find((q) => q.kind === "xp");
  if (xpq) assert.ok([60, 100, 150].includes(xpq.target));
  assert.equal(weekKey("2026-03-04"), "2026-03-02");
  const w = generateWeeklyQuest("u", "2026-03-04");
  assert.ok(w.weekly && w.id.startsWith("w:2026-03-02:") && w.reward === 100);
  assert.equal(weeklyQuestFor(w, "u", "2026-03-08"), w);
  assert.notEqual(weeklyQuestFor(w, "u", "2026-03-09").id, w.id);
  assert.equal(questsForToday([w, ...qs], "u", "2026-03-02").length, 3);
  const games = applyQuestEvent([{ id: "x", kind: "games", title: "", target: 2, progress: 0, reward: 30, done: false, claimed: false }], { type: "task", won: true });
  assert.equal(games[0]!.progress, 1);
  const perf = applyQuestEvent([{ id: "y", kind: "perfect", title: "", target: 1, progress: 0, reward: 30, done: false, claimed: false }], { type: "task", won: true, timed: true });
  assert.equal(perf[0]!.done, true);
});

test("boss: hp rule, hits, rewards", () => {
  const quiz = Array.from({ length: 4 }, (_, i) => ({ q: `q${i}`, a: ["a", "b"], c: 0, e: "e" }));
  const topic = { levels: [{ id: "l1", title: "L", emoji: "x", feed: [], flashcards: [], quiz, tasks: TASKS.slice(0, 3) }] };
  assert.equal(bossHp(30), BOSS_HP);
  assert.equal(bossHp(0), 0);
  let s = startBoss(topic, 0)!;
  assert.equal(s.max, 7);
  assert.equal(startBoss({ levels: [{ id: "l1", title: "L", emoji: "x", feed: [], flashcards: [], quiz: [] }] }), null);
  let won = false;
  for (let i = 0; i < 7; i++) {
    const r = bossAnswer(s, i !== 2);
    s = r.state;
    if (i === 2) assert.ok(r.loseHeart && r.xp === 0);
    won = r.won;
  }
  assert.equal(won, false);
  const r = bossAnswer(s, true);
  assert.ok(r.won);
  const out = finishBoss(undefined, r.state, true, "2026-03-02", 65_000);
  assert.deepEqual([out.xp, out.gems, out.first, out.seconds], [50, 25, true, 65]);
  const again = finishBoss(out.record, r.state, true, "2026-03-03", 40_000);
  assert.deepEqual([again.xp, again.gems, again.first, again.record.n, again.record.best], [15, 0, false, 2, 40]);
  assert.equal(finishBoss(out.record, r.state, false, "2026-03-03").xp, 0);
  const p = { xp: 0, levels: { l1: { done: true, best: 90, stars: 3 as const, attempts: 1 } } };
  assert.equal(bossNodeState(topic, p), "open");
  assert.equal(bossNodeState(topic, { ...p, boss: out.record }), "beaten");
  assert.equal(bossNodeState(topic, { xp: 0, levels: {} }), "locked");
});

test("ghost: record, compare, finish", () => {
  let run = recordStep([], true, 1000, 3000);
  run = recordStep(run, false, 1000, 6000);
  run = recordStep(run, true, 1000, 9000);
  assert.deepEqual(run, [{ t: 2000, correct: true }, { t: 5000, correct: false }, { t: 8000, correct: true }]);
  const saved = ghostFinish(undefined, run, true, 3, "2026-03-02");
  assert.equal(saved.kind, "saved");
  assert.equal(ghostFinish(undefined, run, false, 3, "2026-03-02").kind, "none");
  const better = run.map((s) => ({ ...s, correct: true }));
  assert.ok(ghostBetter(better, run));
  const win = ghostFinish(saved.kind === "saved" ? saved.record : undefined, better, true, 3, "2026-03-03");
  assert.equal(win.kind, "win");
  assert.equal(win.xp, GHOST_WIN_XP);
  const lose = ghostFinish(win.kind === "win" ? win.record : undefined, run, true, 3, "2026-03-04");
  assert.equal(lose.kind, "lose");
  // legacy bare array shape accepted
  assert.equal(ghostFinish(run, better, true, 3, "2026-03-04").kind, "win");
  assert.equal(ghostStatus(run, better, 2, 4000, 3).state, "lead");
  assert.equal(ghostStatus(run, [], 0, 9000, 3).state, "behind");
  assert.equal(ghostStatus(run, [], 0, 0, 3).state, "tie");
});

test("album: rarity from SRS box >= 3, lapses, stars", () => {
  assert.equal(srsBox({ interval: 0 }), 0);
  assert.equal(srsBox({ interval: 4 }), 2);
  assert.equal(srsBox({ interval: 7 }), 3);
  assert.equal(srsBox({ interval: 30 }), 4);
  assert.equal(albumRarity({ interval: 3, lapses: 0 }), null);
  assert.equal(albumRarity({ interval: 7, lapses: 0 }), "rare");
  assert.equal(albumRarity({ interval: 7, lapses: 2 }), "common");
  assert.equal(albumRarity({ interval: 7, lapses: 2 }, { done: true, stars: 3 }), "epic");
  assert.equal(albumRarity({ box: 3, lapses: 0 }), "rare");
  const r1 = albumCheck({}, "t:l1:0", { interval: 8, lapses: 0 }, null, "2026-03-02");
  assert.equal(r1.added?.rarity, "rare");
  const r2 = albumCheck(r1.album, "t:l1:0", { interval: 8, lapses: 0 }, null, "2026-03-03");
  assert.equal(r2.added, null);
  assert.equal(r2.album, r1.album);
  const topic = { id: "t", levels: [{ id: "l1", title: "L", emoji: "x", feed: [], flashcards: [{ t: "a", d: "1" }, { t: "b", d: "2" }], quiz: [] }] };
  assert.deepEqual(albumCount(r1.album, [topic]), { n: 1, m: 2 });
  assert.equal(albumKey("t", "l1", 0), "t:l1:0");
});

test("achievements: legacy badges added, optional stats tolerated", () => {
  for (const k of ["album_100", "exam_90", "boss", "plan_5", "subject_done"]) assert.ok(ACHIEVEMENTS.some((a) => a.key === k), k);
  const meta = emptyMeta();
  const none = evaluateAchievements({ meta, topicsCount: 0, totalXp: 0, streak: 0 }, new Set());
  assert.equal(none.length, 0);
  const got = evaluateAchievements({ meta: { ...meta, stats: { ...meta.stats, bosses: 1, bestExamPct: 92 } }, topicsCount: 0, totalXp: 0, streak: 0 }, new Set());
  assert.deepEqual(got.map((a) => a.key).sort(), ["boss", "exam_90"]);
  // a stats row from an older client (no 2.0 counters) still evaluates
  const old = { ...meta, stats: { cardsReviewed: 0, levelsDone: 1, perfectLevels: 0, examsPassed: 0, comboBest: 0, questsDone: 0, chestsOpened: 0, nightOwl: false, earlyBird: false } };
  assert.deepEqual(evaluateAchievements({ meta: old, topicsCount: 0, totalXp: 0, streak: 0 }, new Set()).map((a) => a.key), ["first_level"]);
});
