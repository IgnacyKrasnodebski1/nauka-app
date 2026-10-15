import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { setClientForTests } from "./client.js";
import { UsageMeter } from "./cost.js";
import { Deadline, GENERATION_DEADLINE_MS, RETRY_IF_LEFT_MS, observeStream, settledOrTimeout } from "./deadline.js";
import { GenerationError, generateTopic } from "./generate.js";
import { reviewLevel } from "./review.js";
import { coreLevel, mockAi, quiet } from "./mock-ai.test-helper.js";

/** AUDYT P1-4: one deadline (request start + 270 s) for every AI request, a shrinking retry budget, `ai_timeout`. */

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  setClientForTests(null);
});

const TEXT = "Fotosynteza to proces, w którym rośliny ".repeat(20);

test("deadline constants: 270 s, retries only while more than 120 s are left", () => {
  assert.equal(GENERATION_DEADLINE_MS, 270_000);
  assert.equal(RETRY_IF_LEFT_MS, 120_000);
});

test("Deadline.requestOptions: one retry with time to spare, none near the end; timeout never past the deadline", () => {
  let now = 1_000_000;
  const d = new Deadline(now + 270_000, () => now);
  try {
    assert.deepEqual(d.requestOptions(), { signal: d.signal, maxRetries: 1, timeout: 270_000 });
    assert.equal(d.requestOptions({ maxRetries: 0 }).maxRetries, 0, "a caller can lower the retries");
    assert.equal(d.requestOptions({ timeoutMs: 20_000 }).timeout, 20_000);
    now += 150_001; // 119 999 ms left
    assert.equal(d.requestOptions().maxRetries, 0);
    assert.equal(d.requestOptions({ maxRetries: 1 }).maxRetries, 0, "never more than the deadline allows");
    assert.equal(d.requestOptions().timeout, 119_999);
    assert.equal(d.expired(), false);
    now += 200_000;
    assert.equal(d.left(), 0);
    assert.equal(d.expired(), true);
  } finally {
    d.dispose();
  }
});

test("Deadline aborts its signal when the time is up", async () => {
  const d = new Deadline(Date.now() + 20);
  assert.equal(d.signal.aborted, false);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(d.signal.aborted, true);
  d.dispose();
});

test("observeStream: first event and the last usage snapshot; objects without events are tolerated", async () => {
  const listeners: ((e: unknown, s: unknown) => void)[] = [];
  const stream = { on: (_ev: string, l: (e: unknown, s: unknown) => void) => listeners.push(l) };
  const o = observeStream(stream);
  assert.equal(o.hasEvents, true);
  assert.equal(o.lastUsage(), null);
  listeners[0]!({ type: "message_start" }, { model: "claude-opus-5", usage: { input_tokens: 7, output_tokens: 1 } });
  await o.firstEvent;
  assert.deepEqual(o.lastUsage(), { model: "claude-opus-5", usage: { input_tokens: 7, output_tokens: 1 } });
  const bare = observeStream({ finalMessage: async () => ({}) });
  assert.equal(bare.hasEvents, false);
  // settledOrTimeout never rejects and returns at the earlier of the two
  await settledOrTimeout(Promise.reject(new Error("x")), 1000);
  const t0 = Date.now();
  await settledOrTimeout(new Promise(() => undefined), 15);
  assert.ok(Date.now() - t0 >= 10);
});

test("an outline that never finishes is aborted at the deadline: GenerationError ai_timeout, aborted call costed from its stream", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ behavior: (kind) => (kind === "outline" ? { hang: true } : undefined) });
  setClientForTests(m.client);
  const meter = new UsageMeter();
  const t0 = Date.now();
  await assert.rejects(
    quiet(() => generateTopic({ materials: [], text: TEXT, options: { stage: "liceum" }, deadlineAt: Date.now() + 60, meter })),
    (e: unknown) => e instanceof GenerationError && e.code === "ai_timeout" && /za długo/.test(e.message),
  );
  assert.ok(Date.now() - t0 < 1000, "returns right after the deadline");
  const outline = m.calls.find((c) => c.kind === "outline")!;
  assert.equal(outline.aborted, true);
  assert.ok(outline.options?.signal instanceof AbortSignal);
  assert.equal(outline.options?.maxRetries, 0, "under 120 s left: no SDK retry");
  const s = meter.summary();
  assert.equal(s.partialCalls, 1, "the aborted outline is recorded");
  assert.ok(s.genInput > 0);
  assert.ok(s.costUsd > 0);
});

test("a level that runs past the deadline is aborted and left out; finished levels are kept (the user is charged either way)", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ outlineLevels: 3, behavior: (kind, title) => (kind === "core" && title === "Poziom 3" ? { hang: true } : undefined) });
  setClientForTests(m.client);
  const { value: r } = await quiet(() => generateTopic({ materials: [], text: TEXT, options: { stage: "liceum" }, deadlineAt: Date.now() + 150 }));
  assert.deepEqual(r.content.levels.map((l) => l.title), ["Poziom 1", "Poziom 2"]);
  assert.equal(r.quality.levelsFailed, 1);
  assert.equal(m.calls.find((c) => c.kind === "core" && c.title === "Poziom 3")!.aborted, true);
  // no time left for the review: the levels are kept unreviewed instead of starting calls past the deadline
  assert.equal(m.calls.filter((c) => c.kind === "review").length, 0);
  assert.equal(r.quality.reviewFailed, 2);
});

test("every level hanging: ai_timeout (not api), even though each level failed separately", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ outlineLevels: 2, behavior: (kind) => (kind === "core" ? { hang: true } : undefined) });
  setClientForTests(m.client);
  await assert.rejects(
    quiet(() => generateTopic({ materials: [], text: TEXT, options: { stage: "liceum" }, deadlineAt: Date.now() + 80 })),
    (e: unknown) => e instanceof GenerationError && e.code === "ai_timeout",
  );
});

test("Files API uploads get the deadline's signal and retry budget", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const seen: unknown[] = [];
  const m = mockAi({ outlineLevels: 1 });
  const upload = m.client.files.upload.bind(m.client.files);
  (m.client.files as { upload: unknown }).upload = async (p: unknown, o: unknown) => {
    seen.push(o);
    return upload(p as never, o as never);
  };
  setClientForTests(m.client);
  await quiet(() => generateTopic({ materials: [{ mime: "application/pdf", data: Buffer.from("%PDF-1.4"), name: "a.pdf" }], options: { stage: "liceum", mode: "materials" } }));
  assert.equal(seen.length, 1);
  const o = seen[0] as { signal?: AbortSignal; maxRetries?: number };
  assert.ok(o.signal instanceof AbortSignal);
  assert.equal(o.maxRetries, 1, "270 s left at the start: one retry allowed");
  assert.deepEqual(m.deleted, m.uploads);
});

test("reviewLevel follows the generation's signal and records its tokens in the meter (also when aborted)", async () => {
  const m = mockAi({ behavior: () => ({ hang: true }) });
  const meter = new UsageMeter();
  const outer = new AbortController();
  const lv = { feed: coreLevel().feed, quiz: coreLevel().quiz, tasks: [] };
  setTimeout(() => outer.abort(), 30);
  const r = await reviewLevel(m.client, lv, { stage: "liceum", signal: outer.signal, maxRetries: 0, meter, timeoutMs: 5_000 });
  assert.equal(r.reviewed, false);
  assert.equal(m.calls[0]!.aborted, true);
  assert.equal(m.calls[0]!.options?.maxRetries, 0);
  const s = meter.summary();
  assert.equal(s.partialCalls, 1);
  assert.ok(s.reviewInput > 0, "input tokens from message_start are costed");
  // an already aborted signal: no call at all
  const m2 = mockAi();
  const r2 = await reviewLevel(m2.client, lv, { stage: "liceum", signal: AbortSignal.abort() });
  assert.equal(r2.error, "no time left");
  assert.equal(m2.calls.length, 0);
});
