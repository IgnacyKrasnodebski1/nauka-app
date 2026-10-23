import { test } from "node:test";
import assert from "node:assert/strict";
import { REEL_EXAMPLE, topicPoints, type MediaProgress, type ReelsManifest, type ReelType, type Storyboard, type WordsFile } from "@nauka/shared";
import { Deadline } from "./deadline.js";
import { MediaError } from "./media/errors.js";
import { TtsError } from "./media/elevenlabs.js";
import { checkStoryboard, newTrack, repairSeriesPlan, runReelsJob } from "./media/reels.js";
import { exampleStoryboardOut, fakeAi, fakeTts, planOut, topicContent, type AiHandler } from "./media-fixtures.test-helper.js";

const TYPES: ReelType[] = ["czym", "kto", "mit", "porownanie", "sprawdzian"];
const quiet = { info() {}, warn() {}, error() {} };

/* ------------------------------------------------------------------------------------------- plan repair */

test("repairSeriesPlan: one reel per requested type in order, every point covered, distinct existing quiz items of the reel's points", () => {
  const content = topicContent();
  const plan = repairSeriesPlan(
    {
      seriesTitle: "Seria <b>🦊</b>",
      reels: [
        // order shuffled, a duplicate type, an unknown point, a quiz item of another point, a duplicate quiz item, a bad label
        { type: "kto", title: "B", points: ["p3", "p99"], quiz: "l1#q0", feed: "l2#f9", angle: "" },
        { type: "czym", title: "A", points: ["p1"], quiz: "l1#q0", feed: "l1#f1", angle: "hak" },
        { type: "czym", title: "dup", points: [], quiz: "", feed: "", angle: "" },
        { type: "mit", title: "C", points: ["p1"], quiz: "l1#q0", feed: "", angle: "" },
        { type: "sprawdzian", title: "E", points: [], quiz: "zzz", feed: "", angle: "" },
      ],
    },
    { content, types: TYPES, focus: null },
  );
  assert.equal(plan.title, "Seria b/b");
  assert.deepEqual(
    plan.reels.map((r) => r.type),
    TYPES,
  );
  assert.equal(plan.reels[0]!.pointIds[0], "p1");
  assert.deepEqual(plan.reels[1]!.pointIds, ["p3"], "unknown point dropped");
  assert.deepEqual(plan.reels[3]!.pointIds, ["p2"], "uncovered points go to the reels with the fewest");
  const covered = new Set(plan.reels.flatMap((r) => r.pointIds));
  for (const p of topicPoints(content)) assert.ok(covered.has(p.id), `point ${p.id} covered`);
  const keys = plan.reels.map((r) => `${r.quizRef.level}#${r.quizRef.index}`);
  assert.equal(new Set(keys).size, keys.length, `distinct quiz items: ${keys.join(",")}`);
  const pts = new Map(topicPoints(content).map((p) => [p.id, p]));
  for (const r of plan.reels) {
    const own = r.pointIds.flatMap((id) => pts.get(id)!.items.filter((i) => i.kind === "quiz").map((i) => `${i.level}#${i.index}`));
    assert.ok(own.includes(`${r.quizRef.level}#${r.quizRef.index}`), `reel ${r.type}: quiz item of its points`);
  }
  assert.deepEqual(plan.reels[0]!.feedRef, { level: "l1", index: 1 });
  assert.deepEqual(plan.reels[1]!.feedRef, { level: "l2", index: 0 }, "bad feed → part 1 of the quiz item's level");
  assert.ok(plan.reels[3]!.title, "missing type gets a title");
});

test("repairSeriesPlan: single mode keeps only the focus point; a missing plan still gives usable reels", () => {
  const content = topicContent();
  const focus = topicPoints(content).find((p) => p.id === "p4")!;
  const plan = repairSeriesPlan({ seriesTitle: "", reels: [{ type: "mit", title: "X", points: ["p1", "p2"], quiz: "l1#q0", feed: "", angle: "" }] }, { content, types: ["mit"], focus });
  assert.equal(plan.reels.length, 1);
  assert.deepEqual(plan.reels[0]!.pointIds, ["p4"]);
  assert.equal(plan.reels[0]!.quizRef.level, "l3");
  assert.ok([0, 1].includes(plan.reels[0]!.quizRef.index), "quiz item of p4");
  const none = repairSeriesPlan(null, { content, types: ["czym", "kto", "mit"], focus: null });
  assert.equal(none.reels.length, 3);
  assert.ok(none.reels.every((r) => r.quizRef.index >= 0));
  assert.equal(none.title, "MSGiP — wykład 1");
});

/* ---------------------------------------------------------------------------------------- storyboard check */

test("checkStoryboard: the example passes; bad JSON, too few words or scenes fail with a reason for the re-ask", () => {
  const ok = checkStoryboard(REEL_EXAMPLE, { tags: true });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.match(ok.tts, /^\[excited\] Czekaj…/);
    assert.equal(ok.tts.split("\n").length, ok.storyboard.scenes.length, "one line per scene");
    assert.doesNotMatch(ok.tts, /\{|\}/, "spoken form of {a|b}");
  }
  const noTags = checkStoryboard(REEL_EXAMPLE, { tags: false });
  assert.ok(noTags.ok && !/\[/.test(noTags.tts));
  assert.deepEqual(checkStoryboard("{nope", { tags: true }), { ok: false, why: "storyboard nie jest poprawnym JSON" });
  const sb = JSON.parse(REEL_EXAMPLE) as Storyboard;
  const short = { ...sb, scenes: sb.scenes.slice(0, 4).map((s) => ({ ...s, say: "Krótko.", tts: "Krótko." })) };
  const r = checkStoryboard(JSON.stringify(short), { tags: true });
  assert.ok(!r.ok && /za krótka narracja/.test(r.why));
  const few = { ...sb, scenes: sb.scenes.slice(0, 2) };
  const r2 = checkStoryboard(`Oto scenariusz: ${JSON.stringify(few)} koniec`, { tags: true });
  assert.ok(!r2.ok && /za mało scen/.test(r2.why), "JSON found inside text, then judged");
});

/* ------------------------------------------------------------------------------------------- the job */

function jobDeps(ai: AiHandler, opts: { tts?: ReturnType<typeof fakeTts>; deadlineMs?: number } = {}) {
  const uploads = new Map<string, Uint8Array | string>();
  const progress: MediaProgress[] = [];
  const track = newTrack();
  const deadline = new Deadline(Date.now() + (opts.deadlineMs ?? 270_000));
  const tts = opts.tts ?? fakeTts();
  const aiFn = fakeAi(ai);
  return {
    uploads,
    progress,
    track,
    tts,
    ai: aiFn,
    deadline,
    deps: {
      ai: aiFn,
      tts,
      voiceId: "dawid",
      ttsModel: "eleven_v4",
      tags: true,
      deadline,
      upload: async (p: string, b: Uint8Array | string) => void uploads.set(p, b),
      progress: async (p: MediaProgress) => void progress.push(p),
      track,
      log: quiet,
    },
  };
}
const input = (types: ReelType[] = TYPES, focusPointId: string | null = null) => ({ mediaId: "m1", ownerId: "u1", topicId: "t1", content: topicContent(), stage: "studia", types, focusPointId });

test("runReelsJob: plan → 5 storyboards (cached shared prefix) → narration → files → manifest", async () => {
  const h = jobDeps((req) => (req.label === "reels plan" ? planOut(TYPES) : exampleStoryboardOut(`Tytuł ${req.label}`)));
  try {
    const m: ReelsManifest = await runReelsJob(input(), h.deps);
    assert.equal(m.kind, "reels");
    assert.equal(m.title, "Kto rządzi światową gospodarką?");
    assert.equal(m.reels.length, 5);
    assert.deepEqual(m.coverage, { points: 5, covered: 5 });
    const r1 = m.reels[0]!;
    assert.deepEqual(r1.files, { storyboard: "r1.json", audio: "r1.mp3", words: "r1.words.json" });
    assert.equal(r1.rate, 1.15);
    assert.ok(r1.durSec > 0);
    assert.match(r1.thumb, /^#[0-9A-F]{6}$/);
    assert.deepEqual(r1.quizRef, { level: "l1", index: 0 });
    // files: 3 per reel under {uid}/{mediaId}/
    assert.deepEqual([...h.uploads.keys()].sort().slice(0, 3), ["u1/m1/r1.json", "u1/m1/r1.mp3", "u1/m1/r1.words.json"]);
    assert.equal(h.uploads.size, 15);
    const sb = JSON.parse(h.uploads.get("u1/m1/r1.json") as string) as Storyboard;
    assert.deepEqual(sb.audio, { src: "r1.mp3", words: "r1.words.json", rate: 1.15 });
    assert.equal("quiz" in sb, false);
    const words = JSON.parse(h.uploads.get("u1/m1/r1.words.json") as string) as WordsFile;
    assert.equal(words.v, 1);
    assert.equal(words.words[0]!.w, "[excited]");
    assert.equal(words.words[0]!.tag, true);
    // narration: one TTS call per reel, the scenes' tts joined with "\n", the reel voice and model
    assert.equal(h.tts.calls.length, 5);
    assert.equal(h.tts.calls[0]!.voiceId, "dawid");
    assert.equal(h.tts.calls[0]!.modelId, "eleven_v4");
    assert.ok(h.track.ttsChars > 0);
    // prompt cache: the storyboard calls share the cached system + topic block
    const sbCalls = h.ai.calls.filter((c) => c.label.startsWith("reel "));
    assert.equal(sbCalls.length, 5);
    assert.ok(sbCalls.every((c) => c.cacheSystem && c.blocks[0]!.cache && c.blocks[0]!.text === sbCalls[0]!.blocks[0]!.text));
    assert.match(sbCalls[1]!.blocks[1]!.text, /PYTANIE KOŃCOWE .*Pytanie l1\.3\?/);
    // progress walks plan → script → voice → save
    assert.deepEqual([...new Set(h.progress.map((p) => p.step))], ["plan", "script", "voice", "save"]);
  } finally {
    h.deadline.dispose();
  }
});

test("runReelsJob: a storyboard invalid twice is dropped (one re-ask), the series keeps the rest, renumbered", async () => {
  const h = jobDeps((req) => {
    if (req.label === "reels plan") return planOut(TYPES);
    if (req.label === "reel 2") return { title: "x", storyboard: "{zły json" };
    return exampleStoryboardOut();
  });
  try {
    const m = await runReelsJob(input(), h.deps);
    assert.equal(h.ai.calls.filter((c) => c.label === "reel 2").length, 2, "one re-ask");
    assert.match(h.ai.calls.filter((c) => c.label === "reel 2")[1]!.blocks[1]!.text, /poprzednia wersja była niepoprawna/);
    assert.equal(m.reels.length, 4);
    assert.deepEqual(
      m.reels.map((r) => r.n),
      [1, 2, 3, 4],
    );
    assert.deepEqual(
      m.reels.map((r) => r.type),
      ["czym", "mit", "porownanie", "sprawdzian"],
    );
    assert.equal(m.coverage.covered, 4, "p2 (only in the dropped reel) not covered");
  } finally {
    h.deadline.dispose();
  }
});

test("runReelsJob: fewer than 3 valid storyboards → invalid_output; a refusal → refusal; TTS 401 → tts_unavailable", async () => {
  const bad = jobDeps((req) => (req.label === "reels plan" ? planOut(TYPES) : req.label === "reel 1" ? exampleStoryboardOut() : { title: "x", storyboard: "[]" }));
  await assert.rejects(runReelsJob(input(), bad.deps), (e: unknown) => e instanceof MediaError && e.code === "invalid_output");
  bad.deadline.dispose();
  const refusal = jobDeps((req) => {
    if (req.label === "reels plan") return planOut(TYPES);
    throw new MediaError("refusal", "stop_reason refusal");
  });
  await assert.rejects(runReelsJob(input(), refusal.deps), (e: unknown) => e instanceof MediaError && e.code === "refusal");
  refusal.deadline.dispose();
  const tts401 = jobDeps((req) => (req.label === "reels plan" ? planOut(TYPES) : exampleStoryboardOut()), {
    tts: fakeTts(() => {
      throw new TtsError("tts_unavailable", "401 invalid_api_key", 401);
    }),
  });
  await assert.rejects(runReelsJob(input(), tts401.deps), (e: unknown) => e instanceof MediaError && e.code === "tts_unavailable");
  assert.ok(tts401.track.ttsChars > 0, "spent characters tracked for the release stats");
  tts401.deadline.dispose();
});

test("runReelsJob: single reel for a focus point; a TTS 422 for one reel of a series drops only that reel", async () => {
  const one = jobDeps((req) => (req.label === "reels plan" ? { seriesTitle: "MFW w minutę", reels: [{ type: "mit", title: "MFW", points: ["p3"], quiz: "l2#q2", feed: "", angle: "" }] } : exampleStoryboardOut()));
  try {
    const m = await runReelsJob(input(["mit"], "p3"), one.deps);
    assert.equal(m.reels.length, 1);
    assert.deepEqual(m.reels[0]!.pointIds, ["p3"]);
    assert.deepEqual(m.coverage, { points: 1, covered: 1 });
    assert.match(one.ai.calls[0]!.blocks[1]!.text, /JEDNĄ rolkę rodzaju „mit” o kluczowym punkcie p3/);
  } finally {
    one.deadline.dispose();
  }
  const drop = jobDeps((req) => (req.label === "reels plan" ? planOut(TYPES) : exampleStoryboardOut()), {
    tts: fakeTts((_req, call) => {
      if (call === 2) throw new TtsError("invalid_output", "422 text", 422);
    }),
  });
  try {
    const m = await runReelsJob(input(), drop.deps);
    assert.equal(m.reels.length, 4);
  } finally {
    drop.deadline.dispose();
  }
});

test("runReelsJob: the deadline aborts the storyboards → timeout (nothing narrated)", async () => {
  const h = jobDeps(
    (req) =>
      req.label === "reels plan"
        ? planOut(TYPES)
        : new Promise((_, reject) => {
            req.signal.addEventListener("abort", () => reject(new MediaError("timeout", "aborted")));
          }),
    { deadlineMs: 76_000 },
  );
  try {
    await assert.rejects(runReelsJob(input(), h.deps), (e: unknown) => e instanceof MediaError && e.code === "timeout");
    assert.equal(h.tts.calls.length, 0);
  } finally {
    h.deadline.dispose();
  }
});
