import { test } from "node:test";
import assert from "node:assert/strict";
import { GENERATION_SYSTEM_PROMPT, TOPIC_SYSTEM_PROMPT, buildGenerationUserPrompt } from "./prompts.js";
import type { Stage } from "./types.js";

const SYSTEM = [GENERATION_SYSTEM_PROMPT, TOPIC_SYSTEM_PROMPT];
const STAGES: Stage[] = ["podstawowa", "liceum", "studia", "inne"];

test("system prompts carry the question-quality rules", () => {
  for (const p of SYSTEM) {
    assert.match(p, /JAKOŚĆ PYTAŃ/);
    assert.match(p, /ANTY-ZGADYWANIE/);
    assert.match(p, /IPA/, "bans unexplained phonetic notation");
    assert.match(p, /polskie »ch«/, "bad→good pronunciation example");
    assert.match(p, /mnemo = domyślnie pusty string/);
  }
});

test("no slang tone or trick-question wording in any prompt", () => {
  const all = [...SYSTEM, ...STAGES.map((stage) => buildGenerationUserPrompt({ stage }, ""))];
  for (const p of all) {
    assert.doesNotMatch(p, /gen-z/i);
    assert.doesNotMatch(p, /podchwytliw/i);
    assert.doesNotMatch(p, /luźn/i);
  }
});
