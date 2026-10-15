import { test } from "node:test";
import assert from "node:assert/strict";
import { MODEL_PRICES, UsageMeter, costColumns, costOf, priceFor, tokensFromUsage } from "./cost.js";

test("priceFor: known ids, date-suffixed snapshots and provider prefixes; unknown → null", () => {
  assert.deepEqual(priceFor("claude-opus-5"), { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 });
  assert.deepEqual(priceFor("claude-sonnet-5"), MODEL_PRICES["claude-sonnet-5"]);
  assert.deepEqual(priceFor("claude-haiku-4-5-20251001"), MODEL_PRICES["claude-haiku-4-5"]);
  assert.deepEqual(priceFor("anthropic.claude-opus-5-5"), MODEL_PRICES["claude-opus-5-5"]);
  // the longest matching id wins (claude-opus-5-5 is not priced as claude-opus-5)
  assert.equal(priceFor("claude-opus-5-5")!.cacheRead, 0.2);
  assert.equal(priceFor("gpt-x"), null);
  assert.equal(priceFor(undefined), null);
});

test("cache prices are 1.25× input (5-minute write) and the documented read rates", () => {
  for (const [id, p] of Object.entries(MODEL_PRICES)) assert.equal(p.cacheWrite, p.input * 1.25, id);
  assert.equal(MODEL_PRICES["claude-opus-5"]!.cacheRead, 0.5, "0.1× on Opus 5");
  assert.equal(MODEL_PRICES["claude-opus-5-5"]!.cacheRead, 0.2, "0.05× on Opus 5.5");
});

test("tokensFromUsage: top-level usage belongs to the served model; iterations split hops by model", () => {
  assert.deepEqual(tokensFromUsage({ input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: null }, "claude-opus-5"), [
    { model: "claude-opus-5", input: 10, cacheWrite: 100, cacheRead: 0, output: 5 },
  ]);
  const withFallback = tokensFromUsage(
    {
      input_tokens: 999,
      output_tokens: 999,
      iterations: [
        { type: "message", model: "claude-opus-5", input_tokens: 20, output_tokens: 3, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        { type: "compaction", input_tokens: 7, output_tokens: 7 },
        { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 20, output_tokens: 40, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      ],
    },
    "claude-opus-4-8",
  );
  assert.deepEqual(
    withFallback.map((t) => [t.model, t.input, t.output]),
    [
      ["claude-opus-5", 20, 3],
      ["claude-opus-4-8", 20, 40],
    ],
    "top-level fields are not added on top of the hops; compaction entries are skipped",
  );
  assert.deepEqual(tokensFromUsage(null, "x"), []);
});

test("costOf prices every token class", () => {
  // 1M of each class on Opus 5: 5 + 6.25 + 0.5 + 25
  assert.equal(costOf({ model: "claude-opus-5", input: 1e6, cacheWrite: 1e6, cacheRead: 1e6, output: 1e6 }), 36.75);
  assert.equal(costOf({ model: "nope", input: 1, cacheWrite: 0, cacheRead: 0, output: 0 }), null);
});

test("UsageMeter keeps the generation model and the review apart and sums the cost", () => {
  const m = new UsageMeter();
  m.record("gen", { input_tokens: 100_000, output_tokens: 10_000 }, "claude-opus-5"); // outline: 0.5 + 0.25
  m.record("gen", { input_tokens: 1_000, cache_creation_input_tokens: 100_000, output_tokens: 20_000 }, "claude-opus-5"); // 0.005 + 0.625 + 0.5
  m.record("gen", { input_tokens: 1_000, cache_read_input_tokens: 100_000, output_tokens: 20_000 }, "claude-opus-5"); // 0.005 + 0.05 + 0.5
  m.record("review", { input_tokens: 5_000, output_tokens: 2_000 }, "claude-sonnet-5"); // 0.01 + 0.02
  m.recordPartial("review", null, "claude-sonnet-5");
  const s = m.summary();
  assert.equal(s.genInput, 102_000);
  assert.equal(s.genCacheWrite, 100_000);
  assert.equal(s.genCacheRead, 100_000);
  assert.equal(s.genOutput, 50_000);
  assert.equal(s.reviewInput, 5_000);
  assert.equal(s.reviewOutput, 2_000);
  assert.equal(s.calls, 4, "a partial record without usage is not a call");
  assert.equal(s.input, 307_000, "legacy total counts cached input too");
  assert.equal(s.output, 52_000);
  assert.equal(s.costUsd, 2.465);
  assert.deepEqual(s.unpriced, []);
});

test("UsageMeter: partial usage of an aborted call is costed; unknown models use the role's fallback price and are listed", () => {
  const m = new UsageMeter();
  m.recordPartial("gen", { input_tokens: 1_000_000, output_tokens: 0 }, "claude-opus-5");
  m.record("gen", { input_tokens: 1_000_000, output_tokens: 0 }, "claude-mystery-9");
  const s = m.summary();
  assert.equal(s.partialCalls, 1);
  assert.equal(s.costUsd, 10, "both priced like Opus 5 ($5/MTok input)");
  assert.deepEqual(s.unpriced, ["claude-mystery-9"]);
});

test("costColumns maps the summary to the generations columns (migration 0007) and caps cost_usd at numeric(8,4)", () => {
  const m = new UsageMeter();
  m.record("gen", { input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: 3, output_tokens: 4 }, "claude-opus-5");
  m.record("review", { input_tokens: 5, output_tokens: 6 }, "claude-sonnet-5");
  const c = costColumns(m.summary());
  assert.deepEqual(Object.keys(c).sort(), ["cost_usd", "input_tokens", "opus_cache_read", "opus_cache_write", "opus_input", "opus_output", "output_tokens", "review_input", "review_output"]);
  assert.deepEqual([c.opus_input, c.opus_cache_write, c.opus_cache_read, c.opus_output, c.review_input, c.review_output, c.input_tokens, c.output_tokens], [1, 2, 3, 4, 5, 6, 11, 10]);
  const huge = new UsageMeter();
  huge.record("gen", { input_tokens: 0, output_tokens: 1e9 }, "claude-fable-5-1");
  assert.equal(costColumns(huge.summary()).cost_usd, 9999.9999);
});
