import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REEL_EXAMPLE,
  REEL_STORYBOARD_RULES,
  TTS_TAGS,
  cleanText,
  displayText,
  fallbackPoints,
  foxContext,
  gradeLabel,
  gradeScaleText,
  itemLabel,
  mediaPath,
  parseChatQuota,
  parseFoxItemLabel,
  parseFoxPointLabel,
  parseItemLabel,
  parseMediaQuota,
  quizCount,
  sanitizeStoryboard,
  sceneTts,
  spokenText,
  storyboardWords,
  stripHtml,
  topicDigest,
  topicPoints,
  ttsMatchesSay,
} from "./media.js";

/* ------------------------------------------------------------------------------------------------ fixture */

function level(id: string, n: { feed?: number; cards?: number; quiz?: number; tasks?: number } = {}) {
  return {
    id,
    title: `Lekcja ${id}: <b>tytuł</b>`,
    emoji: "📘",
    feed: Array.from({ length: n.feed ?? 2 }, (_, i) => ({ title: `Część ${i + 1}`, body: `<p>Treść <b>${id}</b> części ${i + 1} &amp; więcej.</p>` })),
    flashcards: Array.from({ length: n.cards ?? 4 }, (_, i) => ({ t: `pojęcie ${id}.${i}`, d: `definicja ${i}` })),
    quiz: Array.from({ length: n.quiz ?? 5 }, (_, i) => ({ q: `Pytanie ${id}.${i}?`, a: ["A", "B", "C"], c: 1, e: "Bo B." })),
    tasks: Array.from({ length: n.tasks ?? 1 }, () => ({ type: "tf", statements: [{ s: "x", v: true }] })),
  };
}
const refs = (kind: string, lv: string, idx: number[]) => idx.map((index) => ({ kind, level: lv, index }));
export function topicWithPoints() {
  return {
    name: "MSGiP — wykład 1",
    levels: [level("l1"), level("l2"), level("l3")],
    keyPoints: [
      { id: "p1", title: "MSG a MSP", short: "MSG a MSP", levels: ["l1"], items: [...refs("flashcard", "l1", [0, 1]), ...refs("quiz", "l1", [0, 1, 2])] },
      { id: "p2", title: "Globalizacja", short: "Globalizacja", levels: ["l1"], items: [...refs("flashcard", "l1", [2, 3]), ...refs("quiz", "l1", [3, 4]), ...refs("task", "l1", [0])] },
      { id: "p3", title: "MFW: rola Międzynarodowego Funduszu Walutowego", short: "MFW", levels: ["l2"], items: [...refs("flashcard", "l2", [0, 1, 2, 3]), ...refs("quiz", "l2", [0, 1, 2, 3, 4])] },
      { id: "p4", title: "Bank Światowy", short: "Bank Światowy", levels: ["l3"], items: [...refs("flashcard", "l3", [0, 1]), ...refs("quiz", "l3", [0, 1])] },
      { id: "p5", title: "WTO", short: "WTO", levels: ["l3"], items: [...refs("flashcard", "l3", [2, 3]), ...refs("quiz", "l3", [2, 3, 4])] },
    ],
  };
}

/* ------------------------------------------------------------------------------------------- key points */

test("topicPoints: valid keyPoints are kept in order with levels computed from the items", () => {
  const pts = topicPoints(topicWithPoints());
  assert.deepEqual(
    pts.map((p) => p.id),
    ["p1", "p2", "p3", "p4", "p5"],
  );
  assert.equal(pts[2]!.short, "MFW");
  assert.deepEqual(pts[2]!.levels, ["l2"]);
  assert.equal(pts.every((p) => !p.fb), true);
});

test("topicPoints: an old topic (no keyPoints) → one fallback point per level with all its items", () => {
  const t = topicWithPoints();
  delete (t as { keyPoints?: unknown }).keyPoints;
  const pts = topicPoints(t);
  assert.deepEqual(
    pts.map((p) => p.id),
    ["Ll1", "Ll2", "Ll3"],
  );
  assert.equal(pts[0]!.fb, true);
  assert.equal(pts[0]!.items.length, 4 + 5 + 1, "flashcards + quiz + tasks");
  assert.equal(pts[0]!.title, "Lekcja l1: btytuł/b", "title cleaned of <>");
  assert.doesNotMatch(pts[0]!.title, /[<>]/);
  assert.ok(pts[0]!.short.length <= 24);
  assert.deepEqual(topicPoints(t), fallbackPoints(t));
});

test("topicPoints: bad and duplicate refs are dropped; uncovered quiz/flashcards go to an L-point of their level", () => {
  const t = topicWithPoints();
  t.keyPoints[0]!.items.push({ kind: "quiz", level: "l9", index: 0 }, { kind: "quiz", level: "l1", index: 99 }, { kind: "flashcard", level: "l1", index: 0 });
  // p4 loses its quiz l3#q1 → uncovered → goes to „Ll3”
  t.keyPoints[3]!.items = [...refs("flashcard", "l3", [0, 1]), ...refs("quiz", "l3", [0])];
  const pts = topicPoints(t);
  const p1 = pts.find((p) => p.id === "p1")!;
  assert.equal(p1.items.length, 5, "only the 5 valid refs");
  // the L-point gets the one uncovered item, is too small and, being last, is merged into the previous point (p5)
  assert.equal(pts.find((p) => p.id === "Ll3"), undefined);
  assert.ok(pts.find((p) => p.id === "p5")!.items.some((i) => i.kind === "quiz" && i.level === "l3" && i.index === 1), "uncovered item kept");
  const all = pts.flatMap((p) => p.items.filter((i) => i.kind !== "task").map((i) => `${i.kind}:${i.level}:${i.index}`));
  assert.equal(all.length, new Set(all).size, "every quiz / flashcard in exactly one point");
  assert.equal(all.length, 3 * (4 + 5), "and every one of them is covered");
});

test("topicPoints: a point with < 3 items or < 2 quiz/flashcards is merged into the next one; < 3 points → fallback", () => {
  const t = topicWithPoints();
  t.keyPoints[3]!.items = [...refs("flashcard", "l3", [0]), ...refs("task", "l3", [0])]; // p4: 2 items
  t.keyPoints[4]!.items.push(...refs("flashcard", "l3", [1]), ...refs("quiz", "l3", [0, 1]));
  const pts = topicPoints(t);
  assert.deepEqual(
    pts.map((p) => p.id),
    ["p1", "p2", "p3", "p5"],
  );
  assert.ok(pts.find((p) => p.id === "p5")!.items.some((i) => i.kind === "task"), "merged into the next point");
  const two = { ...topicWithPoints(), keyPoints: topicWithPoints().keyPoints.slice(0, 2) };
  // p1 + p2 cover only l1; the rest becomes Ll2 / Ll3 points → still ≥ 3 points
  assert.deepEqual(
    topicPoints(two).map((p) => p.id),
    ["p1", "p2", "Ll2", "Ll3"],
  );
  const one = { name: "x", levels: [level("l1")], keyPoints: [{ id: "p1", title: "x", short: "x", levels: ["l1"], items: refs("quiz", "l1", [0, 1, 2, 3, 4]) }] };
  assert.equal(topicPoints(one)[0]!.fb, true, "fewer than 3 points → fallback");
});

test("topicPoints: a point without a readable title is dropped like in the app (title falls back to short)", () => {
  const t = topicWithPoints();
  (t.keyPoints[1] as { title: string; short: string }).title = "📘 <>"; // emoji / brackets only → empty after cleaning
  (t.keyPoints[1] as { title: string; short: string }).short = "";
  (t.keyPoints[2] as { title: string }).title = "";
  const pts = topicPoints(t);
  assert.deepEqual(
    pts.map((p) => p.id),
    ["p1", "p3", "p4", "p5", "Ll1"],
    "p2 dropped (its quiz / flashcards go to the level point), p3 keeps its short as title",
  );
  assert.equal(pts[1]!.title, "MFW");
  assert.ok(!pts.find((p) => p.id === "Ll1")!.items.some((i) => i.kind === "task"), "tasks of a dropped point are not re-homed (the app does the same)");
});

test("topicPoints: malformed content never throws", () => {
  for (const c of [null, undefined, 1, "x", { levels: "x" }, { levels: [{}] }, { levels: [level("l1")], keyPoints: [{ id: "bad" }, null, 3] }]) {
    assert.ok(Array.isArray(topicPoints(c)));
  }
  assert.equal(quizCount({ levels: [level("l1", { quiz: 0 })] }), 0);
});

/* ---------------------------------------------------------------------------------------------- labels */

test("item labels round-trip; fox labels parse", () => {
  assert.equal(itemLabel("quiz", "l2", 3), "l2#q3");
  assert.deepEqual(parseItemLabel("l2#q3"), { kind: "quiz", level: "l2", index: 3 });
  assert.deepEqual(parseItemLabel("[l1#f0]"), { kind: "feed", level: "l1", index: 0 });
  assert.equal(parseItemLabel("l2-q3"), null);
  assert.equal(parseItemLabel(""), null);
  assert.deepEqual(parseFoxItemLabel("T1.l3.f1"), { n: 1, level: "l3", kind: "feed", index: 1 });
  assert.deepEqual(parseFoxPointLabel("T2.p9"), { n: 2, point: "p9" });
  assert.deepEqual(parseFoxPointLabel("T1.Ll2"), { n: 1, point: "Ll2" });
  assert.equal(parseFoxPointLabel("p9"), null);
});

test("mediaPath only accepts plain file names", () => {
  assert.equal(mediaPath("u", "m", "r1.mp3"), "u/m/r1.mp3");
  assert.throws(() => mediaPath("u", "m", "../x.mp3"));
  assert.throws(() => mediaPath("u", "m", "R1.mp3"));
});

/* ----------------------------------------------------------------------------------------- text helpers */

test("stripHtml / cleanText: tags and entities, no <>, no emoji, cut with …", () => {
  assert.equal(stripHtml("<p>Ala <b>ma</b>&nbsp;kota &amp; psa</p>"), "Ala ma kota & psa");
  assert.equal(cleanText("<img src=x onerror=alert(1)> Hej 🦊🎉", 100), "img src=x onerror=alert(1) Hej");
  assert.equal(cleanText("a".repeat(30), 10).length, 10);
  assert.ok(cleanText("a".repeat(30), 10).endsWith("…"));
});

test("topicDigest: labels for points, parts, flashcards and quiz with the correct answer; fits maxChars", () => {
  const d = topicDigest(topicWithPoints(), { stage: "studia" });
  assert.match(d, /p3: MFW: rola Międzynarodowego Funduszu Walutowego \[MFW\] — lekcje l2; l2#k0/);
  assert.match(d, /\[l2#q4\] Pytanie l2\.4\? \| odpowiedź: B \| wyjaśnienie: Bo B\./);
  assert.match(d, /\[l1#f0\] Część 1: Treść l1 części 1 & więcej\./);
  assert.doesNotMatch(d, /<|>/);
  const big = { ...topicWithPoints(), levels: [level("l1", { feed: 30 })].map((l) => ({ ...l, feed: l.feed.map((f) => ({ ...f, body: "słowo ".repeat(800) })) })) };
  assert.ok(topicDigest(big, { maxChars: 20_000 }).length <= 20_000);
});

test("foxContext: whole topics or only the chosen points' items; labels T<n>; ≤ maxChars", () => {
  const t = topicWithPoints();
  const all = foxContext([{ topicId: "aaaa", n: 1, content: t }]);
  assert.match(all, /\[T1\.p3\] MFW/);
  assert.match(all, /\[T1\.l2\.f1\] część 2: Część 2/);
  assert.match(all, /\[T1\.l3\.q4\] Pytanie l3\.4\? Poprawnie: B\./);
  const one = foxContext([{ topicId: "aaaa", n: 1, content: t }], ["aaaa:p3"]);
  assert.match(one, /\[T1\.p3\]/);
  assert.doesNotMatch(one, /\[T1\.p1\]/, "other points left out");
  assert.doesNotMatch(one, /Lekcja 1:/, "levels without the point left out");
  assert.match(one, /Lekcja 2:/);
  const big = { ...t, levels: Array.from({ length: 6 }, (_, i) => ({ ...level(`l${i + 1}`, { feed: 20 }), feed: Array.from({ length: 20 }, () => ({ title: "x", body: "słowo ".repeat(600) })) })) };
  assert.ok(foxContext([{ topicId: "a", n: 1, content: big }, { topicId: "b", n: 2, content: big }], [], 60_000).length <= 60_000);
});

/* ------------------------------------------------------------------------------------------- storyboard */

test("REEL_EXAMPLE is a valid storyboard: survives the sanitizer unchanged in scenes, 80–130 words, only allowed tags", () => {
  const raw = JSON.parse(REEL_EXAMPLE);
  const sb = sanitizeStoryboard(raw)!;
  assert.ok(sb, "sanitized");
  assert.equal(sb.scenes.length, raw.scenes.length);
  assert.equal(sb.world.stations.length, raw.world.stations.length);
  assert.equal(
    sb.scenes.reduce((n, s) => n + s.actions.length, 0),
    raw.scenes.reduce((n: number, s: { actions: unknown[] }) => n + s.actions.length, 0),
    "no action dropped",
  );
  const words = storyboardWords(sb);
  assert.ok(words >= 80 && words <= 130, `words ${words}`);
  for (const s of sb.scenes) {
    for (const tag of s.tts!.match(/\[[^\]]+\]/g) ?? []) assert.ok((TTS_TAGS as readonly string[]).includes(tag), tag);
    assert.ok(ttsMatchesSay(s.say, s.tts!), s.say);
  }
  assert.equal(sb.audio, undefined, "audio is the server's");
  assert.doesNotMatch(REEL_STORYBOARD_RULES, /\p{Extended_Pictographic}/u);
});

test("sanitizeStoryboard: XSS strings become plain text, javascript: colours and ids dropped, unknown kinds → house, unknown actions dropped, numbers clamped, emoji stripped", () => {
  const sb = sanitizeStoryboard({
    title: '<img src=x onerror="window.__pwned=1">Tytuł 🦊',
    quiz: { q: "x" },
    voice: { voice_id: "secret" },
    cover: { title: "c" },
    audio: { src: "https://evil.example/x.mp3" },
    evil: "<script>",
    maxLabels: 99,
    camDur: 1e9,
    world: {
      seed: 1e12,
      theme: "javascript:alert(1)",
      stations: [
        { id: "a", kind: "vault", label: "<b>MFW</b>", x: 1e6, y: -1e6, color: "javascript:alert(1)", onclick: "x" },
        { id: "b", kind: "<svg/onload=alert(1)>", label: "Bank 💰", x: 1, y: 2, color: "#2F6BFF", colors: ["#fff", "red", "url(x)"] },
        { id: "a", kind: "house", x: 0, y: 0 },
        { id: "<x>", kind: "house", x: 0, y: 0 },
      ],
      roads: [["a", "b"], ["a", "nope"], { from: "a", to: "b", style: "laser", color: "expression(x)" }],
      zones: [{ id: "z", x: 0, y: 0, r: 999, color: "#abc" }],
    },
    scenes: [
      {
        say: "Hej <script>alert(1)</script> 🎉 to jest test.",
        tts: "[excited] Hej script alert(1) /script to jest test.",
        cam: { to: "a", zoom: 99, y: 5, dur: 100, ease: "bounce", evil: 1 },
        hold: 100,
        actions: [
          { type: "label", at: "a", text: "x".repeat(200), on: "Hej", dx: 9999, onload: "alert(1)" },
          { type: "label", at: "nope", text: "bez kotwicy" },
          { type: "script", src: "x" },
          { type: "packet", from: "a", to: "b", color: "javascript:x", n: 500, style: "missile" },
          { type: "cutaway", kind: "iframe", src: "https://evil" },
          { type: "cutaway", kind: "phone", title: "<i>x</i>", rows: ["a", { t: "b", on: "Hej" }, { t: "" }, 5], evil: 1 },
          { type: "fox", pose: "dance" },
          { type: "card", lines: ["y".repeat(100)], at: [1, 2, 99] },
          { type: "chapter", n: 1 },
        ],
      },
      { say: "" },
    ],
  })!;
  assert.ok(sb);
  const json = JSON.stringify(sb);
  assert.doesNotMatch(json, /[<>]/);
  assert.doesNotMatch(json, /javascript:|expression\(|onclick|onload|evil|secret|__pwned=1"/);
  assert.doesNotMatch(json, /\p{Extended_Pictographic}/u);
  assert.equal(sb.title.includes("img"), true, "text kept as plain text");
  assert.ok(sb.title.length <= 60);
  assert.equal("quiz" in sb || "voice" in sb || "cover" in sb || "audio" in sb || "evil" in sb, false);
  assert.equal(sb.maxLabels, 4);
  assert.equal(sb.camDur, 3);
  assert.equal(sb.world.seed, 100000);
  assert.equal(sb.world.theme, undefined);
  assert.deepEqual(
    sb.world.stations.map((s) => [s.id, s.kind, s.x, s.y]),
    [
      ["a", "vault", 30, -30],
      ["b", "house", 1, 2],
    ],
  );
  assert.equal(sb.world.stations[0]!.color, undefined);
  assert.deepEqual(sb.world.stations[1]!.colors, ["#fff"]);
  assert.deepEqual(sb.world.roads, [["a", "b"], { from: "a", to: "b" }]);
  assert.equal((sb.world.zones[0] as { r: number }).r, 15);
  const sc = sb.scenes[0]!;
  assert.equal(sb.scenes.length, 1, "scene without say dropped");
  assert.deepEqual(sc.cam, { to: "a", zoom: 3, y: 1, dur: 8 });
  assert.equal(sc.hold, 4);
  assert.deepEqual(
    sc.actions.map((a) => a.type),
    ["label", "packet", "cutaway", "fox", "card"],
  );
  const label = sc.actions[0]!;
  assert.equal((label.text as string).length, 40);
  assert.equal(label.dx, 400);
  assert.equal("onload" in label, false);
  const packet = sc.actions[1]!;
  assert.equal(packet.n, 12);
  assert.equal(packet.color, undefined);
  assert.equal(packet.style, undefined);
  const phone = sc.actions[2]!;
  assert.deepEqual(phone.rows, ["a", { t: "b", on: "Hej" }], "empty and non-text rows dropped");
  assert.equal(sc.actions[3]!.pose, "point", "unknown pose → point");
  const card = sc.actions[4]!;
  assert.equal((card.lines as string[])[0]!.length, 60);
  assert.deepEqual(card.at, [1, 2, 12]);
});

test("sanitizeStoryboard: nothing playable → null", () => {
  assert.equal(sanitizeStoryboard(null), null);
  assert.equal(sanitizeStoryboard({ world: { stations: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 1, y: 1 }] }, scenes: [] }), null);
  assert.equal(sanitizeStoryboard({ world: { stations: [{ id: "a", x: 0, y: 0 }] }, scenes: [{ say: "x" }] }), null, "one station");
});

test("narration: {pokaz|wymowa}, tts with the same words keeps allowed tags; a mismatch or unknown tags fall back to the spoken say", () => {
  const say = "Energia ląduje w {ATP|a te pe} i {NADPH.|en a de pe ha.} Super!";
  assert.equal(spokenText(say), "Energia ląduje w a te pe i en a de pe ha. Super!");
  assert.equal(displayText(say), "Energia ląduje w ATP i NADPH. Super!");
  assert.equal(sceneTts(say, "[excited] Energia LĄDUJE w a te pe i en a de pe ha. [laughs softly] Super!", { tags: true }), "[excited] Energia LĄDUJE w a te pe i en a de pe ha. [laughs softly] Super!");
  assert.equal(sceneTts(say, "[excited] Energia ląduje w ATP i NADPH. Super!", { tags: true }), spokenText(say), "words differ → spoken say");
  assert.equal(sceneTts(say, "[curious] Energia ląduje w a te pe i en a de pe ha. [Excited] Super!", { tags: true }), "Energia ląduje w a te pe i en a de pe ha. [excited] Super!", "unknown tag removed, known one normalized");
  assert.equal(sceneTts(say, "[excited] Energia ląduje w a te pe i en a de pe ha. Super!", { tags: false }), "Energia ląduje w a te pe i en a de pe ha. Super!");
  assert.equal(sceneTts(say, undefined, { tags: true }), spokenText(say));
});

/* ----------------------------------------------------------------------------------------- quotas, grades */

test("parseMediaQuota / parseChatQuota", () => {
  assert.deepEqual(parseMediaQuota({ plan: "free", scope: "lifetime", used: 1, limit: 3, remaining: 2, dailyLeft: 4, globalOpen: true, busy: null }), {
    plan: "free",
    scope: "lifetime",
    used: 1,
    limit: 3,
    remaining: 2,
    dailyLeft: 4,
    globalOpen: true,
    busy: null,
  });
  assert.deepEqual(parseMediaQuota({ plan: "pro", scope: "month", used: 31, limit: 30, busy: { id: "m", kind: "podcast", topicId: "t" }, globalOpen: false })?.busy, { id: "m", kind: "podcast", topicId: "t" });
  // the material was deleted during the job: the reservation still holds (backend/0010 media_busy), topicId null
  assert.deepEqual(parseMediaQuota({ plan: "free", scope: "lifetime", used: 1, limit: 3, busy: { id: "m", kind: "reels", topicId: null } })?.busy, { id: "m", kind: "reels", topicId: null });
  assert.equal(parseMediaQuota({ plan: "pro", scope: "month", used: 31, limit: 30 })?.remaining, 0);
  assert.equal(parseMediaQuota({ scope: "x", used: 1, limit: 2 }), null);
  assert.equal(parseMediaQuota(null), null);
  assert.deepEqual(parseChatQuota({ day: "2026-10-22", used: 12, limit: 30, remaining: 18, globalOpen: true }), { day: "2026-10-22", used: 12, limit: 30, remaining: 18, globalOpen: true });
  assert.equal(parseChatQuota({ day: "22.10", used: 1, limit: 2 }), null);
});

test("grades: Polish scale per stage", () => {
  assert.equal(gradeLabel("studia", 72), "4");
  assert.equal(gradeLabel("studia", 49), "2");
  assert.equal(gradeLabel("liceum", 96), "6");
  assert.equal(gradeLabel("liceum", 10), "1");
  assert.equal(gradeLabel("nieznany", 50), "3", "unknown stage → liceum");
  assert.equal(gradeScaleText("studia"), "2 / 3 / 3,5 / 4 / 4,5 / 5");
});
