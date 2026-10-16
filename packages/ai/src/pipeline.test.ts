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
  const released: { id: string; reason: string }[] = [];
  const logs: string[] = [];
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
    release: async (id, reason) => {
      order.push("release");
      released.push({ id, reason });
      return true;
    },
    log: { info: (...a: unknown[]) => void logs.push(a.map(String).join(" ")), warn: (...a: unknown[]) => void logs.push(a.map(String).join(" ")), error: (...a: unknown[]) => void logs.push(a.map(String).join(" ")) },
    ...over,
  };
  return { req, reserved, finished, failed, released, logs, order };
}

test("normalizeOptions ignores the client's level count (P1-29)", () => {
  assert.deepEqual(normalizeOptions({ stage: "studia", levels: 8, viz: true }), { stage: "studia", levels: 4, mode: "materials", viz: true });
  assert.equal(normalizeOptions({ stage: "studia", mode: "prompt", hint: "x" }).levels, 4);
});

test("reserveRejection keeps build 6's shapes: 402 limit_reached with the 999999 / 1999999 sentinels; busy is a new 409", () => {
  assert.deepEqual(reserveRejection({ reason: "daily" }, 150), { ok: false, status: 402, code: "limit_reached", message: "Dzienny limit nowych lekcji jest wykorzystany.", extra: { used: 999_999, limit: 150 } });
  assert.equal(reserveRejection({ reason: "global" }, 3).extra!.used, GLOBAL_CAP_SENTINEL);
  assert.equal(DAILY_CAP_SENTINEL, 999_999);
  assert.deepEqual(reserveRejection({ reason: "monthly", used: 3, limit: 3 }, 3), { ok: false, status: 402, code: "limit_reached", message: "Wykorzystano 3/3 generacji w tym miesiącu", extra: { used: 3, limit: 3, scope: "month" } });
  const busy = reserveRejection({ reason: "busy" }, 3);
  assert.equal(busy.status, 409);
  assert.equal(busy.code, "busy");
});

test("reserveRejection: the free plan's generations for life (D3) → 402 limit_reached with used / limit (build 6 reads only those) + scope lifetime", () => {
  assert.deepEqual(reserveRejection({ reason: "lifetime", used: 2, limit: 2 }, 2), {
    ok: false,
    status: 402,
    code: "limit_reached",
    message: "Wykorzystano 2/2 darmowych lekcji",
    extra: { used: 2, limit: 2, scope: "lifetime" },
  });
  // limit lowered in app_config below what was used: the message never says "3/1", the payload keeps the real count
  const lowered = reserveRejection({ reason: "lifetime", used: 3, limit: 1 }, 2);
  assert.equal(lowered.message, "Wykorzystano 1/1 darmowych lekcji");
  assert.deepEqual(lowered.extra, { used: 3, limit: 1, scope: "lifetime" });
  // never a sentinel: build 6 must not read it as the daily / server limit
  assert.ok((lowered.extra!.used as number) < DAILY_CAP_SENTINEL);
  assert.doesNotMatch(lowered.message, /miesiąc|Pro|płat|subskryp|zakup/);
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
    ["lifetime", 402, 3],
  ] as const) {
    const m = mockAi();
    setClientForTests(m.client);
    const h = harness({ rows: [PDF], text: undefined, monthlyLimit: 3, reserveWith: { ok: false, reason, used: 3, limit: 3 } });
    const res = await handleGenerationRequest(h.req);
    assert.equal(res.status, status, reason);
    assert.equal(res.body.code, reason === "busy" ? "busy" : "limit_reached");
    assert.equal(res.body.used, used);
    assert.equal(res.body.scope, reason === "lifetime" ? "lifetime" : reason === "monthly" ? "month" : undefined, `${reason}: scope`);
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
  assert.deepEqual(res.body, { error: res.body.error, code: "lost", reason: "ai_timeout", generationId: "gen-1", charged: true });
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
  // the deadline passed before any AI call answered: the AI part never ran — ai_unavailable (refunded), not `lost`
  assert.equal(res2.value.status, 503);
  assert.equal(res2.value.body.code, "ai_unavailable");
  assert.equal(res2.value.body.generationId, "gen-2");
  assert.ok(Date.now() - t1 < 1500, "a hung `fail` past the budget does not hold the answer");
});

/* ---------- incident 2026-10-16: the AI failing on OUR side is `ai_unavailable`, refunded when nothing was produced ---------- */

const HEADERS = () => new Headers({ "request-id": "req_test_1" });
/** An SDK error as the client raises it for an HTTP answer (the right subclass for the status). */
const apiError = (status: number, type: string, message: string) => Anthropic.APIError.generate(status, { type: "error", error: { type, message } }, undefined, HEADERS());
// clearly fake, only to prove that a key-shaped string never reaches a log line or generations.error
const FAKE_KEY = "sk-ant-api03-FAKE0000000000000000000000";

const UNAVAILABLE_CASES: [string, () => unknown][] = [
  ["401 invalid x-api-key (the incident)", () => apiError(401, "authentication_error", `invalid x-api-key ${FAKE_KEY}`)],
  ["403 permission_error", () => apiError(403, "permission_error", "Your API key does not have permission to use the specified resource.")],
  ["429 rate_limit_error", () => apiError(429, "rate_limit_error", "Number of request tokens has exceeded your per-minute rate limit")],
  ["529 overloaded_error", () => apiError(529, "overloaded_error", "Overloaded")],
  ["500 api_error", () => apiError(500, "api_error", "Internal server error")],
  ["400 credit balance too low", () => apiError(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.")],
  ["connection error", () => new Anthropic.APIConnectionError({ message: "Connection error.", cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }) })],
];

test("AI unavailable at the first call (401, 403, 429, 529, 500, billing, connection): 503 ai_unavailable, refunded (release called), charged: false", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  for (const [label, make] of UNAVAILABLE_CASES) {
    const m = mockAi({ behavior: (kind) => (kind === "outline" ? { error: make() } : undefined) });
    setClientForTests(m.client);
    const h = harness();
    const res = await handleGenerationRequest(h.req);
    assert.equal(res.status, 503, label);
    assert.equal(res.body.code, "ai_unavailable", label);
    assert.equal(res.body.charged, false, `${label}: the client shows „Limit się nie zmienił”`);
    assert.equal(res.body.refunded, true, `${label}: build 7 reads \`refunded\` (its „Limit się nie zmienił”)`);
    assert.equal(res.body.generationId, "gen-1", label);
    assert.match(String(res.body.error), /po naszej stronie/, label);
    assert.match(String(res.body.error), /Limit się nie zmienił/, label);
    assert.doesNotMatch(String(res.body.error), /za duży|zabezpiecz|plik|PDF/i, `${label}: never blames the material`);
    assert.doesNotMatch(String(res.body.error), /^AI: \d/, `${label}: not the old text build 7 maps to „file too big”`);
    // release INSTEAD of fail: the RPC closes the row as failed + refunded in one transaction, so a client polling the row
    // (recoverJob) never sees a failed row that is not refunded yet
    assert.deepEqual(h.order, ["reserve", "release"], label);
    assert.equal(h.failed.length, 0, `${label}: fail not called after a refund`);
    assert.equal(h.released.length, 1, label);
    assert.equal(h.released[0]!.id, "gen-1", label);
    // the reason carries the original error (stored as "released:ai_unavailable: …", which the client reads)
    assert.match(h.released[0]!.reason, /^ai_unavailable: /, label);
    assert.ok(h.released[0]!.reason.length <= 200, `${label}: reason fits release_generation's 200 characters`);
    assert.equal(m.calls.length, 1, `${label}: no level calls after a failed outline`);
    // the original error is logged server-side, without secrets
    assert.ok(h.logs.some((l) => /\[generate\] failed gen-1 ai_unavailable/.test(l)), `${label}: logged`);
    for (const text of [...h.logs, h.released[0]!.reason, JSON.stringify(res.body)]) assert.ok(!text.includes("FAKE0000"), `${label}: key-shaped text leaked: ${text}`);
  }
  // the log line says what happened (status, type, request id)
  const m = mockAi({ behavior: (kind) => (kind === "outline" ? { error: apiError(401, "authentication_error", "invalid x-api-key") } : undefined) });
  setClientForTests(m.client);
  const h = harness();
  await handleGenerationRequest(h.req);
  assert.ok(h.logs.some((l) => /401 authentication_error \[req_test_1\]: 401 .*invalid x-api-key/.test(l)), h.logs.join("\n"));
  assert.match(h.released[0]!.reason, /^ai_unavailable: 401 authentication_error \[req_test_1\]/);
});

test("AI unavailable: a failed or missing refund keeps the attempt charged and says so (charged: true, no `refunded`)", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  for (const release of [
    undefined,
    async () => {
      throw new Error("release_generation: function does not exist");
    },
    async () => false,
  ]) {
    setClientForTests(mockAi({ behavior: (kind) => (kind === "outline" ? { error: apiError(529, "overloaded_error", "Overloaded") } : undefined) }).client);
    const h = harness({ release });
    const res = await handleGenerationRequest(h.req);
    assert.equal(res.status, 503);
    assert.equal(res.body.code, "ai_unavailable");
    assert.equal(res.body.charged, true);
    // no refund: the row is closed by `fail` (after the refund attempt), with the original error
    assert.equal(h.order.at(-1), "fail");
    assert.equal(h.failed.length, 1);
    assert.equal(h.failed[0]!.info.code, "ai_unavailable");
    assert.match(h.failed[0]!.info.error, /^ai_unavailable: 529 overloaded_error/);
    assert.equal(res.body.refunded, undefined);
    assert.equal(res.body.generationId, "gen-1");
    assert.doesNotMatch(String(res.body.error), /Limit się nie zmienił/);
    assert.match(String(res.body.error), /po naszej stronie/);
  }
});

test("AI unavailable AFTER output was produced (outline done, every level 529): charged as today, no refund, code ai_unavailable", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ outlineLevels: 2, behavior: (kind) => (kind === "core" || kind === "tasks" ? { error: apiError(529, "overloaded_error", "Overloaded") } : undefined) });
  setClientForTests(m.client);
  const h = harness();
  const res = await handleGenerationRequest(h.req);
  assert.equal(res.status, 503);
  assert.equal(res.body.code, "ai_unavailable");
  assert.equal(res.body.charged, true);
  assert.equal(h.released.length, 0, "the outline was produced (and paid): not refunded");
  assert.deepEqual(h.order, ["reserve", "fail"]);
  assert.ok(h.failed[0]!.info.cost.cost_usd > 0, "the outline is costed");

  // one level unavailable, the other fine: the topic is saved without it (as with `api` before)
  const m2 = mockAi({ outlineLevels: 2, behavior: (kind, title) => (kind === "core" && title === "Poziom 2" ? { error: apiError(500, "api_error", "Internal server error") } : undefined) });
  setClientForTests(m2.client);
  const h2 = harness();
  const res2 = await quiet(() => handleGenerationRequest(h2.req));
  assert.equal(res2.value.status, 200);
  assert.equal(h2.finished[0]!.out.content.levels.length, 1);
  assert.equal(h2.finished[0]!.out.quality.levelsFailed, 1);
  // the skipped level is logged with the original API error (status, type, request id), not only the Polish user text
  assert.ok(res2.logs.some((l) => /levels failed and were left out — poziom 2: 500 api_error \[req_test_1\]/.test(l)), res2.logs.join("\n"));
});

test("Files API upload failing on our side (invalid key with a PDF — the incident, 403, 429, 529, connection): 503 ai_unavailable BEFORE the charge, not reserve_failed", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  for (const [label, make] of UNAVAILABLE_CASES) {
    const m = mockAi({ failUpload: make });
    setClientForTests(m.client);
    const h = harness({ rows: [PDF], text: undefined });
    const res = await handleGenerationRequest(h.req);
    assert.equal(res.status, 503, label);
    assert.equal(res.body.code, "ai_unavailable", label);
    assert.equal(res.body.charged, false, label);
    assert.equal(res.body.reason, undefined, `${label}: not ai_upload`);
    assert.equal(res.body.generationId, undefined, `${label}: nothing reserved`);
    assert.match(String(res.body.error), /po naszej stronie/, label);
    assert.match(String(res.body.error), /Limit się nie zmienił/, label);
    assert.deepEqual(h.order, ["download"], `${label}: never reserved`);
    assert.equal(m.calls.length, 0, label);
    // the original SDK error (the MaterialUploadError's cause) is logged, without secrets
    assert.ok(h.logs.some((l) => /AI unavailable before the charge/.test(l)), `${label}: logged`);
    for (const text of [...h.logs, JSON.stringify(res.body)]) assert.ok(!text.includes("FAKE0000"), `${label}: key-shaped text leaked: ${text}`);
  }
  const m = mockAi({ failUpload: () => apiError(401, "authentication_error", "invalid x-api-key") });
  setClientForTests(m.client);
  const h = harness({ rows: [PDF], text: undefined });
  await handleGenerationRequest(h.req);
  assert.ok(h.logs.some((l) => /AI unavailable before the charge.*401 authentication_error \[req_test_1\]: 401 .*invalid x-api-key/.test(l)), h.logs.join("\n"));
});

test("Files API rejecting the material itself (400 about the PDF): the old path — 500 reserve_failed / ai_upload, original error logged", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ failUpload: () => apiError(400, "invalid_request_error", "The PDF specified is password protected.") });
  setClientForTests(m.client);
  const h = harness({ rows: [PDF], text: undefined });
  const res = await handleGenerationRequest(h.req);
  assert.equal(res.status, 500);
  assert.equal(res.body.code, "reserve_failed");
  assert.equal(res.body.reason, "ai_upload");
  assert.equal(res.body.charged, false);
  assert.deepEqual(h.order, ["download"]);
  assert.ok(h.logs.some((l) => /could not be handed to the AI.*400 invalid_request_error \[req_test_1\]/.test(l)), h.logs.join("\n"));
});

test("deadline with no answer at all (the outline never starts streaming) = the AI not answering: ai_unavailable, refunded", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ behavior: (kind) => (kind === "outline" ? { firstEventMs: 60_000 } : undefined) });
  setClientForTests(m.client);
  const h = harness({ deadlineMs: 100, minAiTimeMs: 0 });
  const t0 = Date.now();
  const res = await handleGenerationRequest(h.req);
  assert.ok(Date.now() - t0 < 2000);
  assert.equal(res.status, 503);
  assert.equal(res.body.code, "ai_unavailable");
  assert.equal(res.body.charged, false);
  assert.deepEqual(h.released, [{ id: "gen-1", reason: "ai_unavailable: no answer from the AI before the deadline" }]);
  assert.equal(h.failed.length, 0);
});

test("the material is the problem (400 invalid image / password-protected PDF): old path — 500 api, charged, no refund, plus reason material", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  for (const msg of ["messages.0.content.0.image.source.base64.data: Could not process image", "The PDF specified is password protected."]) {
    const m = mockAi({ behavior: (kind) => (kind === "outline" ? { error: apiError(400, "invalid_request_error", msg) } : undefined) });
    setClientForTests(m.client);
    const h = harness();
    const res = await handleGenerationRequest(h.req);
    assert.equal(res.status, 500, msg);
    assert.equal(res.body.code, "api", msg);
    assert.match(String(res.body.error), /^AI: 400 /, "the old text (build 7 maps AI: 4xx to „Tego materiału nie da się przetworzyć”)");
    assert.equal(res.body.reason, "material", msg);
    assert.equal(res.body.charged, true, msg);
    assert.equal(res.body.generationId, "gen-1");
    assert.equal(h.released.length, 0, "never refunded");
    assert.deepEqual(h.order, ["reserve", "fail"]);
  }
  // a 400 about our request (not the material): still `api`, but the client is not told to blame the file
  setClientForTests(mockAi({ behavior: (kind) => (kind === "outline" ? { error: apiError(400, "invalid_request_error", "thinking: unexpected value") } : undefined) }).client);
  const h = harness();
  const res = await handleGenerationRequest(h.req);
  assert.equal(res.body.code, "api");
  assert.equal(res.body.reason, undefined);
  assert.equal(res.body.charged, true);
  assert.equal(h.released.length, 0);
});

test("count_tokens answering 401 (invalid key): 503 ai_unavailable BEFORE the charge — nothing reserved, uploads deleted, charged: false", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({
    countTokens: async () => {
      throw apiError(401, "authentication_error", "invalid x-api-key");
    },
  });
  setClientForTests(m.client);
  const h = harness({ rows: [PDF], text: undefined });
  const res = await handleGenerationRequest(h.req);
  assert.equal(res.status, 503);
  assert.equal(res.body.code, "ai_unavailable");
  assert.equal(res.body.charged, false);
  assert.equal(res.body.generationId, undefined, "build 7 adds „liczy się do limitu” only with a generationId");
  assert.equal(res.body.refunded, undefined, "nothing was charged, nothing refunded");
  assert.match(String(res.body.error), /Limit się nie zmienił/);
  assert.deepEqual(h.order, ["download"], "never reserved");
  assert.equal(m.calls.length, 0);
  assert.deepEqual(m.deleted, m.uploads);
});

test("every error answer says `charged`: false before the charge, true after it", async () => {
  const pre = harness({ rows: [{ ...PDF, mime: "application/zip" }], text: undefined });
  assert.equal((await handleGenerationRequest(pre.req)).body.charged, false);
  const limit = harness({ reserveWith: { ok: false, reason: "lifetime", used: 2, limit: 2 } });
  assert.equal((await handleGenerationRequest(limit.req)).body.charged, false);
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  setClientForTests(mockAi({ behavior: (kind) => (kind === "outline" ? { stop_reason: "refusal" } : undefined) }).client);
  const post = harness();
  const res = await handleGenerationRequest(post.req);
  assert.equal(res.body.code, "refusal");
  assert.equal(res.body.charged, true);
  assert.equal(post.released.length, 0, "a refusal is never refunded");
});
