import { test } from "node:test";
import assert from "node:assert/strict";
import { elevenLabsTts, mapLimit, TtsError } from "./media/elevenlabs.js";
import { evenAlignment, mp3Frames } from "./media-fixtures.test-helper.js";

type Call = { url: string; init: RequestInit };
function fakeFetch(answers: (() => Response | Promise<Response>)[]) {
  const calls: Call[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = answers.shift();
    if (!next) throw new Error("no more answers");
    return next();
  }) as typeof fetch;
  return { f, calls };
}
const ok = (text: string) => () =>
  new Response(JSON.stringify({ audio_base64: Buffer.from(mp3Frames(20)).toString("base64"), alignment: evenAlignment(text, 1), normalized_alignment: evenAlignment(text, 1) }), { status: 200, headers: { "content-type": "application/json", "request-id": "req-1" } });
const fail = (status: number, detail: unknown = { status: "x", message: "y" }) => () => new Response(JSON.stringify({ detail }), { status, headers: { "content-type": "application/json" } });

test("request: POST …/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_64, xi-api-key, body {text, model_id, language_code, apply_text_normalization}", async () => {
  const { f, calls } = fakeFetch([ok("Cześć!")]);
  const tts = elevenLabsTts({ apiKey: "sk_test_secret_value_123456", fetch: f });
  const res = await tts({ text: "Cześć!", voiceId: "voice/1", modelId: "eleven_v4" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, "https://api.elevenlabs.io/v1/text-to-speech/voice%2F1/with-timestamps?output_format=mp3_44100_64");
  assert.equal(calls[0]!.init.method, "POST");
  assert.equal((calls[0]!.init.headers as Record<string, string>)["xi-api-key"], "sk_test_secret_value_123456");
  assert.deepEqual(JSON.parse(calls[0]!.init.body as string), { text: "Cześć!", model_id: "eleven_v4", apply_text_normalization: "auto", language_code: "pl" });
  assert.equal(res.audio.length, 20 * 208);
  assert.equal(res.alignment!.characters.join(""), "Cześć!");
  assert.equal(res.chars, 6);
});

test("401 / 402 / 403 / 404 and quota answers → tts_unavailable without a retry; the key never appears in the error", async () => {
  for (const [status, detail] of [
    [401, { status: "invalid_api_key", message: "key sk_test_secret_value_123456 invalid" }],
    [402, { code: "payment_required" }],
    [403, "forbidden"],
    [404, { status: "voice_not_found" }],
    [400, { status: "quota_exceeded", message: "You have 0 credits" }],
  ] as const) {
    const { f, calls } = fakeFetch([fail(status, detail)]);
    const tts = elevenLabsTts({ apiKey: "sk_test_secret_value_123456", fetch: f, retryDelayMs: 1 });
    await assert.rejects(
      tts({ text: "x", voiceId: "v", modelId: "m" }),
      (e: unknown) => e instanceof TtsError && e.code === "tts_unavailable" && !/sk_test_secret/.test(e.message + e.detail),
      `status ${status}`,
    );
    assert.equal(calls.length, 1, `no retry on ${status}`);
  }
});

test("429 / 5xx / network: one internal retry, then tts_unavailable", async () => {
  {
    const { f, calls } = fakeFetch([fail(429), ok("x")]);
    const res = await elevenLabsTts({ apiKey: "k", fetch: f, retryDelayMs: 1 })({ text: "x", voiceId: "v", modelId: "m" });
    assert.equal(calls.length, 2);
    assert.ok(res.audio.length > 0);
  }
  {
    const { f, calls } = fakeFetch([fail(503), fail(500)]);
    await assert.rejects(elevenLabsTts({ apiKey: "k", fetch: f, retryDelayMs: 1 })({ text: "x", voiceId: "v", modelId: "m" }), (e: unknown) => e instanceof TtsError && e.code === "tts_unavailable" && e.status === 500);
    assert.equal(calls.length, 2);
  }
  {
    const { f, calls } = fakeFetch([
      () => {
        throw new TypeError("fetch failed");
      },
      ok("x"),
    ]);
    await elevenLabsTts({ apiKey: "k", fetch: f, retryDelayMs: 1 })({ text: "x", voiceId: "v", modelId: "m" });
    assert.equal(calls.length, 2, "network error retried once");
  }
});

test("422 → invalid_output (the text); a language_code complaint → once more without language_code", async () => {
  {
    const { f } = fakeFetch([fail(422, [{ loc: ["body", "text"], msg: "too long", type: "value_error" }])]);
    await assert.rejects(elevenLabsTts({ apiKey: "k", fetch: f })({ text: "x", voiceId: "v", modelId: "m" }), (e: unknown) => e instanceof TtsError && e.code === "invalid_output");
  }
  {
    const { f, calls } = fakeFetch([fail(400, { status: "unsupported_language", message: "language_code not supported for this model" }), ok("x")]);
    await elevenLabsTts({ apiKey: "k", fetch: f })({ text: "x", voiceId: "v", modelId: "m" });
    assert.equal(calls.length, 2);
    assert.equal("language_code" in JSON.parse(calls[1]!.init.body as string), false);
  }
});

test("the caller's abort → timeout; no key → tts_unavailable without a request; an answer without audio → tts_unavailable", async () => {
  const ac = new AbortController();
  ac.abort();
  const { f, calls } = fakeFetch([ok("x")]);
  await assert.rejects(elevenLabsTts({ apiKey: "k", fetch: f })({ text: "x", voiceId: "v", modelId: "m", signal: ac.signal }), (e: unknown) => e instanceof TtsError && e.code === "timeout");
  assert.equal(calls.length, 0);
  await assert.rejects(elevenLabsTts({ apiKey: "", fetch: f })({ text: "x", voiceId: "v", modelId: "m" }), (e: unknown) => e instanceof TtsError && e.code === "tts_unavailable");
  const { f: f2 } = fakeFetch([() => new Response(JSON.stringify({ alignment: null }), { status: 200 })]);
  await assert.rejects(elevenLabsTts({ apiKey: "k", fetch: f2 })({ text: "x", voiceId: "v", modelId: "m" }), (e: unknown) => e instanceof TtsError && e.code === "tts_unavailable");
});

test("mapLimit: at most n at a time, results in order, first error rejects", async () => {
  let active = 0;
  let peak = 0;
  const out = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (x) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    return x * 2;
  });
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14]);
  assert.equal(peak, 3);
  await assert.rejects(
    mapLimit([1, 2, 3], 2, async (x) => {
      if (x === 2) throw new Error("boom");
      return x;
    }),
    /boom/,
  );
});
