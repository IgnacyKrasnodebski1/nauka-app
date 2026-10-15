import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { TopicContentSchema } from "@nauka/shared";
import { setClientForTests } from "./client.js";
import { UsageMeter, priceFor } from "./cost.js";
import { GenerationError, generateTopic } from "./generate.js";
import { mockAi, quiet } from "./mock-ai.test-helper.js";

/**
 * AUDYT P1-2: the prompt cache must actually be read. The outline call is not cached (another output format, nobody
 * reads it); level 1 starts first and the other levels start only once its two calls stream, so they read the
 * cache entries level 1 wrote. Measured with a mock that simulates the API cache (a request reads an entry only if
 * an identical prefix + output format started streaming before it).
 */

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  setClientForTests(null);
});

const TEXT = "Fotosynteza to proces, w którym rośliny ".repeat(20);

test("outline uncached; levels 2..N start after level 1 streams and read its cache entries (core and tasks)", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ outlineLevels: 6 });
  setClientForTests(m.client);
  const meter = new UsageMeter();
  const { value: r } = await quiet(() => generateTopic({ materials: [], text: TEXT, options: { stage: "liceum", levels: 4 }, meter }));
  assert.equal(r.content.levels.length, 6);
  assert.ok(TopicContentSchema.safeParse(r.content).success);

  const outline = m.calls.filter((c) => c.kind === "outline");
  assert.equal(outline.length, 1);
  assert.equal(outline[0]!.cache, "none");
  assert.ok(!JSON.stringify(outline[0]!.params.system).includes("cache_control"), "outline system prompt has no breakpoint");
  assert.ok(!JSON.stringify(outline[0]!.params.messages).includes("cache_control"), "outline materials have no breakpoint");

  for (const kind of ["core", "tasks"] as const) {
    const calls = m.calls.filter((c) => c.kind === kind);
    assert.equal(calls.length, 6, kind);
    const first = calls.find((c) => c.title === "Poziom 1")!;
    assert.equal(first.cache, "write", `${kind}: level 1 writes the entry`);
    const content = first.params.messages[0]!.content as Anthropic.Beta.BetaContentBlockParam[];
    assert.deepEqual((content[content.length - 2] as { cache_control?: unknown }).cache_control, { type: "ephemeral" }, "breakpoint on the last material block");
    for (const c of calls.filter((x) => x.title !== "Poziom 1")) {
      assert.equal(c.cache, "read", `${kind} ${c.title} reads the cache`);
      assert.ok(c.firstEventsBefore >= 3, `${kind} ${c.title} started after level 1's core and tasks streamed (outline + 2 events)`);
    }
  }

  // input cost relative to one uncached pass over the prefix: outline 1× + 2 writes × 1.25 + 10 reads × 0.1 ≈ 4.5×
  // (before: every one of the 13 calls wrote its own entry ≈ 16×)
  const s = r.cost;
  assert.equal(s.genCacheWrite, 2 * 10_000);
  assert.equal(s.genCacheRead, 10 * 10_000);
  const p = priceFor("claude-opus-5")!;
  const prefixInputUsd = (s.genInput * p.input + s.genCacheWrite * p.cacheWrite + s.genCacheRead * p.cacheRead) / 1e6;
  const onePass = (10_000 * p.input) / 1e6;
  const multiple = prefixInputUsd / onePass;
  assert.ok(multiple > 4.4 && multiple < 4.8, `input ≈ 4.5× the prefix, got ${multiple.toFixed(2)}×`);
  assert.deepEqual(meter.summary(), s, "the caller's meter got the same numbers");
  assert.ok((r.quality.warmupMs ?? -1) >= 0);
});

test("a level-1 error that fails the generation stops it before the other levels start (no paid calls for nothing)", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const tooLong = new Anthropic.APIError(413, undefined, "prompt is too long", undefined);
  const m = mockAi({ outlineLevels: 4, behavior: (kind, title) => (kind === "core" && title === "Poziom 1" ? { error: tooLong } : undefined) });
  setClientForTests(m.client);
  await assert.rejects(
    quiet(() => generateTopic({ materials: [], text: TEXT, options: { stage: "liceum" } })),
    (e: unknown) => e instanceof GenerationError && e.code === "too_long",
  );
  assert.deepEqual(
    m.calls.filter((c) => c.kind === "core" || c.kind === "tasks").map((c) => c.title),
    ["Poziom 1", "Poziom 1"],
    "levels 2–4 never started",
  );
});

test("a non-fatal level-1 error (API 500) does not hold the other levels back; the level is left out", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const boom = new Anthropic.APIError(500, undefined, "overloaded", undefined);
  const m = mockAi({ outlineLevels: 3, behavior: (kind, title) => (kind === "core" && title === "Poziom 1" ? { error: boom } : undefined) });
  setClientForTests(m.client);
  const { value: r } = await quiet(() => generateTopic({ materials: [], text: TEXT, options: { stage: "liceum" } }));
  assert.deepEqual(r.content.levels.map((l) => l.title), ["Poziom 2", "Poziom 3"]);
  assert.equal(r.quality.levelsFailed, 1);
});

test("level 2 waits for level 1 to start streaming even when its prefill is slow (bounded by WARM_UP_CAP_MS)", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ outlineLevels: 2, behavior: (kind, title) => ((kind === "core" || kind === "tasks") && title === "Poziom 1" ? { firstEventMs: 200 } : undefined) });
  setClientForTests(m.client);
  const { WARM_UP_CAP_MS } = await import("./generate.js");
  assert.equal(WARM_UP_CAP_MS, 30_000);
  const { value: r } = await quiet(() => generateTopic({ materials: [], text: TEXT, options: { stage: "liceum" }, deadlineAt: Date.now() + 60_000 }));
  assert.equal(r.content.levels.length, 2);
  const l2 = m.calls.find((c) => c.kind === "core" && c.title === "Poziom 2")!;
  assert.ok(l2.firstEventsBefore >= 3, "level 2 waited for level 1's events (200 ms < cap)");
});
