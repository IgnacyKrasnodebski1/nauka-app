import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { UsageMeter } from "./cost.js";
import { anthropicMediaAi, parseJsonLoose } from "./media/ai.js";
import { MediaError } from "./media/errors.js";
import { mockAi } from "./mock-ai.test-helper.js";

const Schema = z.object({ title: z.string(), n: z.number() });
const req = (signal = new AbortController().signal) => ({
  label: "reel 1",
  system: "SYSTEM",
  cacheSystem: true,
  blocks: [{ text: "TOPIC", cache: true }, { text: "TASK" }],
  schema: Schema,
  maxTokens: 1000,
  effort: "low" as const,
  signal,
});

test("request shape: streaming, adaptive thinking, effort + zod format, cache breakpoints on the system and the topic block, no fallbacks on Sonnet 5", async () => {
  const m = mockAi({ behavior: () => ({ parsed: { title: "x", n: 1 } }) });
  const meter = new UsageMeter();
  const out = await anthropicMediaAi({ model: "claude-sonnet-5", meter, client: m.client })(req());
  assert.deepEqual(out, { title: "x", n: 1 });
  const p = m.calls[0]!.params as unknown as Record<string, unknown> & { output_config: { effort: string; format: { type: string } }; system: { cache_control?: unknown }[]; messages: { content: { text: string; cache_control?: unknown }[] }[] };
  assert.equal(p.model, "claude-sonnet-5");
  assert.deepEqual(p.thinking, { type: "adaptive" });
  assert.equal(p.output_config.effort, "low");
  assert.equal(p.output_config.format.type, "json_schema");
  assert.deepEqual(p.system[0]!.cache_control, { type: "ephemeral" });
  assert.deepEqual(p.messages[0]!.content[0]!.cache_control, { type: "ephemeral" });
  assert.equal(p.messages[0]!.content[1]!.cache_control, undefined);
  assert.equal("fallbacks" in p, false);
  assert.equal(meter.summary().calls, 1);
  const o = mockAi({ behavior: () => ({ parsed: { title: "x", n: 1 } }) });
  await anthropicMediaAi({ model: "claude-opus-5", meter, client: o.client })(req());
  const po = o.calls[0]!.params as unknown as { fallbacks?: string; betas?: string[] };
  assert.equal(po.fallbacks, "default");
  assert.deepEqual(po.betas, ["server-side-fallback-2026-07-01"]);
});

test("refusal → refusal; max_tokens or a wrong shape → invalid_output; API 401 / 529 → ai_unavailable; the abort → timeout", async () => {
  const run = async (behavior: NonNullable<Parameters<typeof mockAi>[0]>["behavior"], signal?: AbortSignal) => anthropicMediaAi({ model: "claude-sonnet-5", meter: new UsageMeter(), client: mockAi({ behavior }).client })(req(signal));
  await assert.rejects(run(() => ({ stop_reason: "refusal", parsed: null })), (e: unknown) => e instanceof MediaError && e.code === "refusal");
  await assert.rejects(run(() => ({ stop_reason: "max_tokens", parsed: null })), (e: unknown) => e instanceof MediaError && e.code === "invalid_output");
  await assert.rejects(run(() => ({ parsed: { title: 5 } })), (e: unknown) => e instanceof MediaError && e.code === "invalid_output");
  const http = (status: number, type: string) => Anthropic.APIError.generate(status, { type: "error", error: { type, message: "x" } }, undefined, new Headers());
  await assert.rejects(run(() => ({ error: http(401, "authentication_error") })), (e: unknown) => e instanceof MediaError && e.code === "ai_unavailable" && /401/.test(e.detail));
  await assert.rejects(run(() => ({ error: http(529, "overloaded_error") })), (e: unknown) => e instanceof MediaError && e.code === "ai_unavailable");
  const ac = new AbortController();
  const p = run(() => ({ hang: true }), ac.signal);
  setTimeout(() => ac.abort(), 10);
  await assert.rejects(p, (e: unknown) => e instanceof MediaError && e.code === "timeout");
});

test("a too large output grammar (400 grammar) → the same request once more without the format, JSON read from the text", async () => {
  let n = 0;
  const m = mockAi({
    behavior: () => {
      n++;
      return n === 1 ? { error: Anthropic.APIError.generate(400, { type: "error", error: { type: "invalid_request_error", message: "The compiled grammar is too large" } }, undefined, new Headers()) } : { parsed: { title: "ok", n: 2 } };
    },
  });
  const out = await anthropicMediaAi({ model: "claude-sonnet-5", meter: new UsageMeter(), client: m.client })(req());
  assert.deepEqual(out, { title: "ok", n: 2 });
  assert.equal(m.calls.length, 2);
  const second = m.calls[1]!.params as unknown as { output_config: { format?: unknown }; messages: { content: { text: string }[] }[] };
  assert.equal(second.output_config.format, undefined);
  assert.match(second.messages[0]!.content.at(-1)!.text, /WYŁĄCZNIE jednym obiektem JSON/);
});

test("parseJsonLoose: plain, fenced, embedded", () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoose('Oto: {"a":1} koniec'), { a: 1 });
  assert.equal(parseJsonLoose("nic"), null);
});
