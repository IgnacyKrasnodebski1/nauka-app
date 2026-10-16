import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { classifyAiError, describeAiError } from "./generate.js";

/** Incident 2026-10-16: which Anthropic errors are OUR problem (ai_unavailable) and which are the user's material. */

const headers = () => new Headers({ "request-id": "req_x" });
const http = (status: number, type: string, message: string) => Anthropic.APIError.generate(status, { type: "error", error: { type, message } }, undefined, headers());
/** an `error` event in the middle of a stream: no status, the type in the body */
const midStream = (type: string, message: string) => new Anthropic.APIError(undefined, { type: "error", error: { type, message } }, undefined, headers(), type as ConstructorParameters<typeof Anthropic.APIError>[4]);

test("classifyAiError: our side → unavailable", () => {
  for (const e of [
    http(401, "authentication_error", "invalid x-api-key"),
    http(403, "permission_error", "Your API key does not have permission"),
    http(404, "not_found_error", "model: claude-opus-5 not found"),
    http(429, "rate_limit_error", "Number of request tokens has exceeded your per-minute rate limit"),
    http(500, "api_error", "Internal server error"),
    http(502, "api_error", "Bad gateway"),
    http(504, "timeout_error", "Gateway timeout"),
    http(529, "overloaded_error", "Overloaded"),
    http(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API."),
    midStream("overloaded_error", "Overloaded"),
    midStream("api_error", "Internal server error"),
    new Anthropic.APIConnectionError({ message: "Connection error." }),
    new Anthropic.APIConnectionTimeoutError(),
  ])
    assert.equal(classifyAiError(e), "unavailable", e.message);
});

test("classifyAiError: the material → material / too_long; our request → request; not an API error → null", () => {
  assert.equal(classifyAiError(http(400, "invalid_request_error", "messages.0.content.0.image.source.base64.data: Could not process image")), "material");
  assert.equal(classifyAiError(http(400, "invalid_request_error", "The PDF specified is password protected.")), "material");
  assert.equal(classifyAiError(http(400, "invalid_request_error", "messages.0.content.1: image exceeds 5 MB maximum")), "material");
  assert.equal(classifyAiError(http(400, "invalid_request_error", "prompt is too long: 1200000 tokens > 1000000 maximum")), "too_long");
  assert.equal(classifyAiError(http(413, "request_too_large", "Request exceeds the maximum allowed number of bytes.")), "too_long");
  assert.equal(classifyAiError(http(400, "invalid_request_error", "The compiled grammar is too large")), "request");
  assert.equal(classifyAiError(new Anthropic.APIUserAbortError()), null);
  assert.equal(classifyAiError(new Error("boom")), null);
});

test("describeAiError: status, type and request id for the logs, without key-shaped text", () => {
  const d = describeAiError(http(401, "authentication_error", "invalid x-api-key sk-ant-api03-FAKE0000000000000000"));
  assert.match(d, /^401 authentication_error \[req_x\]: /);
  assert.ok(!d.includes("FAKE0000"), d);
  assert.match(describeAiError(new Anthropic.APIConnectionError({ message: "Connection error.", cause: Object.assign(new Error("x"), { code: "ECONNRESET" }) })), /connection: Connection error\. \(ECONNRESET\)/);
  assert.ok(!describeAiError(new Error("authorization: Bearer abcdefghijklmnopqrstuvwxyz0123")).includes("abcdefghijklmnop"));
});
