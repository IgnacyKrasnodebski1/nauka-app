import { test } from "node:test";
import assert from "node:assert/strict";
import { topicPoints, type ChapterTiming, type MediaProgress, type PodcastScript } from "@nauka/shared";
import { Deadline } from "./deadline.js";
import { synthesizeChapter, chapterChars } from "./media/chapter.js";
import { MediaError } from "./media/errors.js";
import { chapterTarget, checkChapter, cleanLine, repairOutline, runPodcastJob } from "./media/podcast.js";
import { newTrack } from "./media/reels.js";
import { FRAME_SEC, bigTopicContent, chapterOut, fakeAi, fakeTts, outlineOut, topicContent } from "./media-fixtures.test-helper.js";

const quiet = { info() {}, warn() {}, error() {} };

test("chapterTarget: 8 chapters, 6–8 when the topic has fewer than 8 points", () => {
  assert.equal(chapterTarget(13), 8);
  assert.equal(chapterTarget(8), 8);
  assert.equal(chapterTarget(7), 7);
  assert.equal(chapterTarget(3), 6);
});

test("repairOutline: ≤ 8 chapters, every point covered, distinct existing quiz items, the pause's point owns its quiz item", () => {
  const content = bigTopicContent();
  const o = outlineOut(9, (i) => (i === 4 ? [] : [`p${i + 1}`]));
  o.chapters[1]!.quiz = "l1#q2"; // duplicate of chapter 1's
  o.chapters[2]!.quiz = "nonsense";
  const plan = repairOutline(o, content);
  assert.equal(plan.chapters.length, 8);
  const covered = new Set(plan.chapters.flatMap((c) => c.pointIds));
  for (const p of topicPoints(content)) assert.ok(covered.has(p.id), `point ${p.id}`);
  const keys = plan.chapters.map((c) => `${c.quizRef.level}#${c.quizRef.index}`);
  assert.equal(new Set(keys).size, 8, keys.join(","));
  assert.equal(plan.chapters[1]!.quizRef.level, "l2", "replaced by a quiz item of the chapter's point");
  for (const c of plan.chapters) assert.ok(c.pointId && c.pointIds.includes(c.pointId), `pause point of „${c.title}”`);
  assert.throws(() => repairOutline(outlineOut(5), content), (e: unknown) => e instanceof MediaError && e.code === "invalid_output");
});

test("cleanLine / checkChapter: markup and emoji removed, ** kept only balanced, lines ≤ 400; word / line counts; the pause moved onto a Szop line", () => {
  assert.equal(cleanLine("Hej <b>tu</b> 🦊 **MFW** i *coś* [śmiech] `x`"), "Hej btu/b **MFW** i coś x");
  assert.equal(cleanLine("**niedomknięte i tyle"), "niedomknięte i tyle");
  assert.ok(cleanLine(`${"Zdanie numer jeden. ".repeat(40)}`).length <= 400);
  const ok = checkChapter(chapterOut(22, 10)); // line 10 is the fox's → moved to the Szop's line 9
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.pauseAfter, 9);
    assert.equal(ok.lines[ok.pauseAfter]!.s, "szop");
  }
  const out = checkChapter(chapterOut(22, 999));
  assert.ok(out.ok && out.lines[out.pauseAfter]!.s === "szop" && out.pauseAfter >= 2 && out.pauseAfter <= 19, "out of range → middle");
  assert.ok(!checkChapter(chapterOut(8)).ok, "too few lines");
  const short = { lines: Array.from({ length: 20 }, (_, i) => ({ s: (i % 2 ? "szop" : "lis") as "lis" | "szop", t: "Krótko." })), pauseAfter: 9 };
  const r = checkChapter(short);
  assert.ok(!r.ok && /za krótki/.test(r.why));
  const lonely = { lines: Array.from({ length: 20 }, () => ({ s: "lis" as const, t: "Dość długa kwestia lisa, która ma wiele słów, żeby przejść próg długości rozdziału." })), pauseAfter: 9 };
  assert.ok(!checkChapter(lonely).ok);
  // review F4: a line with nothing to say (`** **`, only punctuation) is dropped — it would reach the TTS empty
  const mute = chapterOut(22, 10);
  mute.lines.splice(4, 0, { s: "szop", t: "** **" }, { s: "lis", t: "… !" });
  const m = checkChapter(mute);
  assert.ok(m.ok && m.lines.length === 22 && m.lines.every((l) => /[\p{L}\p{N}]/u.test(l.t.replace(/\*\*/g, ""))), "mute lines dropped");
});

function deps(handler: Parameters<typeof fakeAi>[0]) {
  const uploads = new Map<string, Uint8Array | string>();
  const progress: MediaProgress[] = [];
  const deadline = new Deadline(Date.now() + 270_000);
  const ai = fakeAi(handler);
  return { uploads, progress, deadline, ai, deps: { ai, deadline, upload: async (p: string, b: Uint8Array | string) => void uploads.set(p, b), progress: async (p: MediaProgress) => void progress.push(p), track: newTrack(), log: quiet } };
}

test("runPodcastJob: outline → 8 chapters in parallel (cached prefix) → script.json → manifest (all chapters `script`, no audio)", async () => {
  const h = deps((req) => (req.label === "podcast outline" ? outlineOut(8) : chapterOut(24, 11)));
  try {
    const m = await runPodcastJob({ mediaId: "m1", ownerId: "u1", topicId: "t1", content: bigTopicContent(), stage: "studia" }, h.deps);
    assert.equal(m.kind, "podcast");
    assert.equal(m.chapters.length, 8);
    assert.deepEqual(m.files, { script: "script.json" });
    assert.ok(m.chapters.every((c) => c.status === "script" && c.files === null && c.durSec === null && c.pauses.length === 1));
    assert.equal(m.chapters[0]!.pauses[0]!.afterLine, 11);
    assert.deepEqual(m.chapters[0]!.pauses[0]!.quizRef, { level: "l1", index: 2 });
    assert.equal(m.chapters[0]!.pauses[0]!.pointId, "p1");
    assert.equal(m.estSec, m.chapters.reduce((n, c) => n + c.estSec, 0));
    const script = JSON.parse(h.uploads.get("u1/m1/script.json") as string) as PodcastScript;
    assert.equal(script.chapters.length, 8);
    assert.equal(script.chapters[0]!.lines.length, 24);
    const chapterCalls = h.ai.calls.filter((c) => c.label.startsWith("chapter "));
    assert.equal(chapterCalls.length, 8);
    assert.ok(chapterCalls.every((c) => c.cacheSystem && c.blocks[0]!.cache));
    assert.match(chapterCalls[0]!.blocks[1]!.text, /To pierwszy rozdział/);
    assert.match(chapterCalls[7]!.blocks[1]!.text, /To ostatni rozdział/);
  } finally {
    h.deadline.dispose();
  }
});

test("runPodcastJob: chapters invalid twice are dropped and the rest renumbered; fewer than 6 → invalid_output", async () => {
  const h = deps((req) => (req.label === "podcast outline" ? outlineOut(8) : req.label === "chapter 3" ? chapterOut(5) : chapterOut()));
  try {
    const m = await runPodcastJob({ mediaId: "m1", ownerId: "u1", topicId: "t1", content: bigTopicContent(), stage: "studia" }, h.deps);
    assert.equal(m.chapters.length, 7);
    assert.deepEqual(
      m.chapters.map((c) => c.n),
      [1, 2, 3, 4, 5, 6, 7],
    );
    assert.equal(h.ai.calls.filter((c) => c.label === "chapter 3").length, 2);
  } finally {
    h.deadline.dispose();
  }
  const bad = deps((req) => (req.label === "podcast outline" ? outlineOut(8) : chapterOut(4)));
  await assert.rejects(runPodcastJob({ mediaId: "m1", ownerId: "u1", topicId: "t1", content: bigTopicContent(), stage: "studia" }, bad.deps), (e: unknown) => e instanceof MediaError && e.code === "invalid_output");
  bad.deadline.dispose();
  // a small topic (5 points) → 6 chapters asked
  const small = deps((req) => (req.label === "podcast outline" ? outlineOut(6, (i) => [`p${(i % 5) + 1}`]) : chapterOut()));
  try {
    const m = await runPodcastJob({ mediaId: "m1", ownerId: "u1", topicId: "t1", content: topicContent(), stage: "liceum" }, small.deps);
    assert.match(small.ai.calls[0]!.blocks[1]!.text, /w 6 rozdziałach/);
    assert.equal(m.chapters.length, 6);
  } finally {
    small.deadline.dispose();
  }
});

test("synthesizeChapter: one TTS call per line with the speaker's voice, joined audio, line offsets from frames, words shifted, pause at the end of its line", async () => {
  const lines = [
    { s: "lis" as const, t: "Cześć, tu **Lis**." },
    { s: "szop" as const, t: "A ja jestem Szop!" },
    { s: "lis" as const, t: "Zaczynamy." },
  ];
  const tts = fakeTts();
  const ac = new AbortController();
  const out = await synthesizeChapter({ lines, pauses: [{ afterLine: 1, quizRef: { level: "l1", index: 0 }, pointId: "p1", lead: "x" }] }, { tts, voices: { lis: "V_FOX", szop: "V_SZOP" }, modelId: "eleven_flash_v2_5", signal: ac.signal });
  assert.deepEqual(
    tts.calls.map((c) => [c.voiceId, c.text, c.modelId]),
    [
      ["V_FOX", "Cześć, tu Lis.", "eleven_flash_v2_5"],
      ["V_SZOP", "A ja jestem Szop!", "eleven_flash_v2_5"],
      ["V_FOX", "Zaczynamy.", "eleven_flash_v2_5"],
    ],
  );
  const t: ChapterTiming = out.timing;
  const frames = lines.map((l) => Math.max(4, Math.ceil(l.t.replace(/\*\*/g, "").length / 2)));
  assert.ok(Math.abs(t.lines[1]!.start - frames[0]! * FRAME_SEC) < 0.002);
  assert.ok(Math.abs(t.duration - frames.reduce((a, b) => a + b, 0) * FRAME_SEC) < 0.002);
  assert.equal(t.lines[1]!.words[0]!.w, "A");
  assert.ok(t.lines[1]!.words[0]!.start >= t.lines[1]!.start);
  assert.deepEqual(t.pauses, [{ afterLine: 1, at: t.lines[1]!.end }]);
  assert.equal(out.chars, chapterChars(lines));
  assert.equal(out.audio.length, frames.reduce((a, b) => a + b, 0) * 208, "ID3 of every part stripped");
});
