import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import type { GenerationOptions } from "@nauka/shared";
import { setClientForTests } from "./client.js";
import { CHARGE_BY_MS, MIN_AI_TIME_MS, RESPOND_BY_MS } from "./deadline.js";
import { MAX_INPUT_TOKENS } from "./generate.js";
import type { IntakeRow } from "./intake.js";
import { DAILY_CAP_SENTINEL, GLOBAL_CAP_SENTINEL, handleGenerationRequest, normalizeOptions, reserveRejection, type FailInput, type FinishInput, type GenerationRequest, type ReserveOutcome } from "./pipeline.js";
import { mockAi, quiet } from "./mock-ai.test-helper.js";

/**
 * The /api/generate sequence with the database injected (route.ts wires the Supabase RPCs):
 * intake → Files upload + count_tokens → reserve (P0-1) → AI with the 270 s deadline (P1-4) → finish / fail with cost (P1-3).
 */

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  setClientForTests(null);
});

const PDF: IntakeRow = { id: "m1", storage_path: "u/1.pdf", mime: "application/pdf", size_bytes: 10, name: "skrypt.pdf" };
const TEXT = "Fotosynteza to proces, w którym rośliny ".repeat(20);

function harness(over: Partial<GenerationRequest> & { reserveWith?: ReserveOutcome | (() => Promise<ReserveOutcome>); finishThrows?: boolean } = {}) {
  const reserved: GenerationOptions[] = [];
  const finished: { id: string; out: FinishInput }[] = [];
  const failed: { id: string; info: FailInput }[] = [];
  const order: string[] = [];
  const req: GenerationRequest = {
    rows: [],
    text: TEXT,
    options: { stage: "liceum", mode: "materials", levels: 8, viz: true },
    startedAt: Date.now(),
    monthlyLimit: 150,
    maxFileMb: 50,
    maxTotalMb: 150,
    download: async () => {
      order.push("download");
      return new Uint8Array(Buffer.from("%PDF-1.4 x"));
    },
    reserve: async (options) => {
      order.push("reserve");
      reserved.push(options);
      const w = over.reserveWith;
      if (typeof w === "function") return w();
      return w ?? { ok: true, generationId: "gen-1", used: 1, limit: 150 };
    },
    finish: async (id, out) => {
      order.push("finish");
      if (over.finishThrows) throw new Error('insert or update on table "topics" violates foreign key constraint');
      finished.push({ id, out });
      return { topicId: "topic-1", topic: { id: "topic-1", name: out.name } };
    },
    fail: async (id, info) => {
      order.push("fail");
      failed.push({ id, info });
    },
    log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    ...over,
  };
  return { req, reserved, finished, failed, order };
}

test("normalizeOptions ignores the client's level count (P1-29)", () => {
  assert.deepEqual(normalizeOptions({ stage: "studia", levels: 8, viz: true }), { stage: "studia", levels: 4, mode: "materials", viz: true });
  assert.equal(normalizeOptions({ stage: "studia", mode: "prompt", hint: "x" }).levels, 4);
});

test("reserveRejection keeps build 6's shapes: 402 limit_reached with the 999999 / 1999999 sentinels; busy is a new 409", () => {
  assert.deepEqual(reserveRejection({ reason: "daily" }, 150), { ok: false, status: 402, code: "limit_reached", message: "Dzienny limit nowych lekcji jest wykorzystany.", extra: { used: 999_999, limit: 150 } });
  assert.equal(reserveRejection({ reason: "global" }, 3).extra!.used, GLOBAL_CAP_SENTINEL);
  assert.equal(DAILY_CAP_SENTINEL, 999_999);
  assert.deepEqual(reserveRejection({ reason: "monthly", used: 3, limit: 3 }, 3), { ok: false, status: 402, code: "limit_reached", message: "Wykorzystano 3/3 generacji w tym miesiącu", extra: { used: 3, limit: 3 } });
  const busy = reserveRejection({ reason: "busy" }, 3);
  assert.equal(busy.status, 409);
  assert.equal(busy.code, "busy");
});

test("demo mode: one reservation with levels forced to 4, then finish with the topic and zero cost", async () => {
  const h = harness();
  const res = await quiet(() => handleGenerationRequest(h.req));
  assert.equal(res.value.status, 200);
  assert.deepEqual(Object.keys(res.value.body).sort(), ["demo", "generationId", "topic", "topicId"], "same 200 shape as before");
  assert.equal(res.value.body.generationId, "gen-1");
  assert.equal(res.value.body.topicId, "topic-1");
  assert.equal(res.value.body.demo, true);
  assert.equal(h.reserved.length, 1);
  assert.equal(h.reserved[0]!.levels, 4, "client asked for 8");
  assert.equal(h.finished.length, 1);
  const out = h.finished[0]!.out;
  assert.equal(out.source, "materials");
  assert.equal(out.model, "demo");
  assert.equal(out.content.levels.length, 4);
  assert.match(out.content.tagline, /DEMO/);
  assert.equal(out.cost.cost_usd, 0);
  assert.equal(h.failed.length, 0);
});

test("with the AI: files uploaded and counted before the charge, cost and cache columns written by finish, uploads deleted", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ outlineLevels: 3 });
  setClientForTests(m.client);
  const h = harness({ rows: [PDF], text: undefined });
  const res = await quiet(() => handleGenerationRequest(h.req));
  assert.equal(res.value.status, 200, JSON.stringify(res.value.body));
  assert.deepEqual(h.order, ["download", "reserve", "finish"]);
  assert.equal(m.uploads.length, 1);
  assert.equal(m.counted.length, 1, "count_tokens before the charge");
  const { cost, quality } = h.finished[0]!.out;
  assert.equal(cost.opus_cache_write, 2 * 10_000);
  assert.equal(cost.opus_cache_read, 4 * 10_000);
  assert.ok(cost.opus_output > 0 && cost.review_input > 0 && cost.review_output > 0);
  assert.ok(cost.cost_usd > 0);
  assert.equal(cost.input_tokens, cost.opus_input + cost.opus_cache_write + cost.opus_cache_read + cost.review_input);
  assert.equal(quality.inputTokensCounted, 10_100);
  assert.equal(quality.levelsFailed, 0);
  assert.equal(typeof quality.calls, "number");
  assert.deepEqual(m.deleted, m.uploads, "Files API uploads deleted after the generation");
});

test("too many tokens: 400 too_long BEFORE the charge (no generationId), uploads deleted (P1-29)", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ countTokens: async () => ({ input_tokens: MAX_INPUT_TOKENS + 1 }) });
  setClientForTests(m.client);
  const h = harness({ rows: [PDF], text: undefined });
  const res = await handleGenerationRequest(h.req);
  assert.equal(res.status, 400);
  assert.equal(res.body.code, "too_long");
  assert.equal(res.body.generationId, undefined, "Cramfox shows „Limit się nie zmienił” without generationId");
  assert.equal(res.body.tokens, MAX_INPUT_TOKENS + 1);
  assert.deepEqual(h.order, ["download"], "never reserved");
  assert.equal(m.calls.length, 0, "no paid call");
  assert.deepEqual(m.deleted, m.uploads);
});

test("count_tokens answering 'prompt is too long' is also too_long without a charge; any other count failure lets the generation go on", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({
    countTokens: async () => {
      throw new Anthropic.APIError(400, undefined, "prompt is too long: 1200000 tokens > 1000000 maximum", undefined);
    },
  });
  setClientForTests(m.client);
  const h = harness({ rows: [PDF], text: undefined });
  const res = await handleGenerationRequest(h.req);
  assert.equal(res.body.code, "too_long");
  assert.deepEqual(h.order, ["download"]);

  const m2 = mockAi({
    outlineLevels: 1,
    countTokens: async () => {
      throw new Anthropic.APIError(529, undefined, "overloaded", undefined);
    },
  });
  setClientForTests(m2.client);
  const h2 = harness({ rows: [PDF], text: undefined });
  const res2 = await quiet(() => handleGenerationRequest(h2.req));
  assert.equal(res2.value.status, 200);
  assert.ok(res2.logs.some((l) => /count_tokens failed/.test(l)));
  assert.equal(h2.finished[0]!.out.quality.inputTokensCounted, null);
});

test("pasted text alone is not counted (capped at 200k characters by the route)", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ outlineLevels: 1 });
  setClientForTests(m.client);
  const h = harness();
  const res = await quiet(() => handleGenerationRequest(h.req));
  assert.equal(res.value.status, 200);
  assert.equal(m.counted.length, 0);
});

test("refused reservations answer like before and delete the uploads; reserve errors are reserve_failed", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  for (const [reason, status, used] of [
    ["busy", 409, undefined],
    ["daily", 402, DAILY_CAP_SENTINEL],
    ["global", 402, GLOBAL_CAP_SENTINEL],
    ["monthly", 402, 3],
  ] as const) {
    const m = mockAi();
    setClientForTests(m.client);
    const h = harness({ rows: [PDF], text: undefined, monthlyLimit: 3, reserveWith: { ok: false, reason, used: 3, limit: 3 } });
    const res = await handleGenerationRequest(h.req);
    assert.equal(res.status, status, reason);
    assert.equal(res.body.code, reason === "busy" ? "busy" : "limit_reached");
    assert.equal(res.body.used, used);
    assert.equal(res.body.generationId, undefined);
    assert.equal(m.calls.length, 0);
    assert.deepEqual(m.deleted, m.uploads, `${reason}: uploads deleted`);
    assert.equal(h.failed.length, 0);
  }
  const h = harness({
    reserveWith: async () => {
      throw new Error("function public.reserve_generation does not exist");
    },
  });
  const res = await handleGenerationRequest(h.req);
  assert.equal(res.status, 500);
  assert.equal(res.body.code, "reserve_failed");
  assert.ok(!String(res.body.error).includes("reserve_generation"), "no database error text to the client");
});

test("a Files API failure happens before the charge now: 500 reserve_failed (build 6: „Limit się nie zmienił”), reason ai_upload", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ failUpload: true });
  setClientForTests(m.client);
  const h = harness({ rows: [PDF], text: undefined });
  const res = await handleGenerationRequest(h.req);
  assert.equal(res.status, 500);
  assert.equal(res.body.code, "reserve_failed");
  assert.equal(res.body.reason, "ai_upload");
  assert.deepEqual(h.order, ["download"]);
});

test("slow intake: when the downloads ate the AI's time, nothing is charged (download_failed, reason slow_intake)", async () => {
  const h = harness({ startedAt: Date.now() - 200_000 });
  const res = await handleGenerationRequest(h.req);
  assert.equal(res.status, 500);
  assert.equal(res.body.code, "download_failed");
  assert.equal(res.body.reason, "slow_intake");
  assert.deepEqual(h.order, [], "not reserved");
});

test("deadline after the charge: failed row with the cost spent so far; answer `lost` + reason ai_timeout + generationId (P1-4)", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ behavior: (kind) => (kind === "outline" ? { hang: true } : undefined) });
  setClientForTests(m.client);
  const h = harness({ deadlineMs: 100, minAiTimeMs: 0 });
  const t0 = Date.now();
  const res = await handleGenerationRequest(h.req);
  assert.ok(Date.now() - t0 < 2000);
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { error: res.body.error, code: "lost", reason: "ai_timeout", generationId: "gen-1" });
  assert.match(String(res.body.error), /za długo/);
  assert.equal(h.failed.length, 1);
  const f = h.failed[0]!.info;
  assert.equal(f.code, "ai_timeout");
  assert.ok(f.cost.opus_input > 0, "the aborted outline's input tokens are recorded");
  assert.ok(f.cost.cost_usd > 0);
  assert.equal(f.quality.failedPhase, "ai");
  assert.deepEqual(h.order, ["reserve", "fail"]);
});

test("AI failure after the charge keeps the old answer (500 + code + generationId); a save failure does not leak the database error", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  setClientForTests(mockAi({ behavior: (kind) => (kind === "outline" ? { stop_reason: "refusal" } : undefined) }).client);
  const h = harness();
  const res = await handleGenerationRequest(h.req);
  assert.equal(res.status, 500);
  assert.equal(res.body.code, "refusal");
  assert.equal(res.body.generationId, "gen-1");
  assert.equal(h.failed[0]!.info.code, "refusal");

  setClientForTests(mockAi({ outlineLevels: 1 }).client);
  const h2 = harness({ finishThrows: true });
  const res2 = await quiet(() => handleGenerationRequest(h2.req));
  assert.equal(res2.value.status, 500);
  assert.equal(res2.value.body.code, "generation_failed");
  assert.equal(res2.value.body.error, "Nie udało się zapisać lekcji.");
  assert.match(h2.failed[0]!.info.error, /foreign key/, "the real reason stays in generations.error");
  assert.equal(h2.failed[0]!.info.quality.failedPhase, "save");
  assert.ok(h2.failed[0]!.info.cost.cost_usd > 0, "a generation that failed at the save is still costed");
});

test("a failing `fail` update does not change the answer", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  setClientForTests(mockAi({ behavior: (kind) => (kind === "outline" ? { stop_reason: "refusal" } : undefined) }).client);
  const h = harness({
    fail: async () => {
      throw new Error("db down");
    },
  });
  const res = await handleGenerationRequest(h.req);
  assert.equal(res.body.code, "refusal");
});

test("intake failures keep their codes and never reach the reservation", async () => {
  const h = harness({ rows: [{ ...PDF, mime: "application/zip" }], text: undefined });
  const res = await handleGenerationRequest(h.req);
  assert.equal(res.status, 400);
  assert.equal(res.body.code, "bad_materials");
  assert.deepEqual(h.order, []);
  const h2 = harness({ rows: [PDF], text: undefined, precheck: async () => reserveRejection({ reason: "busy" }, 3) });
  const res2 = await handleGenerationRequest(h2.req);
  assert.equal(res2.status, 409);
  assert.deepEqual(h2.order, [], "the read-only pre-check stops before any download");
});

test("charge window: the Files API upload eating the time is caught right before the charge (download_failed / slow_intake, nothing charged, uploads deleted)", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi();
  let clock = 1_000_000;
  const files = m.client.files as unknown as { upload: (...a: unknown[]) => Promise<unknown> };
  const upload = files.upload.bind(files);
  // first check passes (10 s spent), then the upload takes 100 s: 110 s after the start is past CHARGE_BY_MS (75 s)
  files.upload = async (...a: unknown[]) => {
    clock += 100_000;
    return upload(...a);
  };
  setClientForTests(m.client);
  const h = harness({ rows: [PDF], text: undefined, startedAt: clock - 10_000, now: () => clock });
  const res = await handleGenerationRequest(h.req);
  assert.equal(res.status, 500);
  assert.equal(res.body.code, "download_failed");
  assert.equal(res.body.reason, "slow_intake");
  assert.equal(res.body.generationId, undefined);
  assert.deepEqual(h.order, ["download"], "never reserved");
  assert.equal(m.uploads.length, 1);
  assert.deepEqual(m.deleted, m.uploads, "uploads deleted");
  assert.equal(m.calls.length, 0, "no paid call");
});

test("charge window: never charged later than CHARGE_BY_MS (75 s) after the start — Cramfox reads no row after 90 s as `not_started`", async () => {
  assert.equal(CHARGE_BY_MS, 75_000);
  assert.equal(MIN_AI_TIME_MS, 195_000);
  const late = harness({ startedAt: Date.now() - 80_000 });
  const res = await handleGenerationRequest(late.req);
  assert.equal(res.body.reason, "slow_intake", "80 s after the start: refused (the old 150 s gate allowed 120 s)");
  assert.deepEqual(late.order, []);
  const ok = harness({ startedAt: Date.now() - 60_000 });
  const res2 = await quiet(() => handleGenerationRequest(ok.req));
  assert.equal(res2.value.status, 200, "60 s after the start: charged");
});

test("finish committed but its reply was lost: lookup finds the topic → 200 with it, no `fail` (a paid lesson is not reported as a failure)", async () => {
  setClientForTests(null);
  const looked: string[] = [];
  const h = harness({
    finishThrows: true,
    lookup: async (id) => {
      looked.push(id);
      return { topicId: "topic-9", topic: { id: "topic-9", name: "Fotosynteza" } };
    },
  });
  const res = await quiet(() => handleGenerationRequest(h.req));
  assert.equal(res.value.status, 200);
  assert.deepEqual(res.value.body, { generationId: "gen-1", topicId: "topic-9", topic: { id: "topic-9", name: "Fotosynteza" }, demo: true });
  assert.deepEqual(looked, ["gen-1"]);
  assert.equal(h.failed.length, 0, "not marked failed");

  const h2 = harness({ finishThrows: true, lookup: async () => null });
  const res2 = await quiet(() => handleGenerationRequest(h2.req));
  assert.equal(res2.value.status, 500);
  assert.equal(res2.value.body.code, "generation_failed");
  assert.equal(h2.failed.length, 1, "really not saved → failed as before");

  const h3 = harness({
    finishThrows: true,
    lookup: async () => {
      throw new Error("db down");
    },
  });
  const res3 = await quiet(() => handleGenerationRequest(h3.req));
  assert.equal(res3.value.status, 500, "a failing lookup keeps the old answer");
  assert.equal(h3.failed.length, 1);
});

test("the answer leaves by RESPOND_BY_MS: hung Files API deletes and a hung `fail` do not hold it (Vercel would answer 504)", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  assert.equal(RESPOND_BY_MS, 285_000);
  const m = mockAi({ outlineLevels: 1 });
  (m.client.files as unknown as { delete: unknown }).delete = () => new Promise(() => undefined);
  setClientForTests(m.client);
  let clock = 1_000_000;
  const h = harness({
    rows: [PDF],
    text: undefined,
    startedAt: clock,
    now: () => clock,
    finish: async (_id, out) => {
      clock += 284_000; // the review used up the time: 1 s left for the cleanup
      return { topicId: "topic-1", topic: { id: "topic-1", name: out.name } };
    },
  });
  const t0 = Date.now();
  const res = await quiet(() => handleGenerationRequest(h.req));
  assert.equal(res.value.status, 200);
  assert.ok(Date.now() - t0 < 2500, `answered in ${Date.now() - t0} ms despite hung deletes`);

  setClientForTests(mockAi({ behavior: (kind) => (kind === "outline" ? { stop_reason: "refusal" } : undefined) }).client);
  let clock2 = 1_000_000;
  const h2 = harness({
    startedAt: clock2,
    now: () => clock2,
    // charged in time, then the AI used the time: 500 ms left when the failure is recorded
    reserveWith: async () => {
      clock2 += 284_500;
      return { ok: true, generationId: "gen-2", used: 1, limit: 150 };
    },
    fail: () => new Promise(() => undefined),
  });
  const t1 = Date.now();
  const res2 = await quiet(() => handleGenerationRequest(h2.req));
  assert.equal(res2.value.status, 500);
  assert.equal(res2.value.body.generationId, "gen-2");
  assert.ok(Date.now() - t1 < 1500, "a hung `fail` past the budget does not hold the answer");
});
