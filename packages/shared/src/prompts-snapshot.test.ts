import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import {
  GENERATION_SYSTEM_PROMPT,
  TOPIC_SYSTEM_PROMPT,
  OUTLINE_INSTRUCTIONS,
  RAW_JSON_INSTRUCTION,
  buildGenerationUserPrompt,
  levelInstructions,
} from "./prompts.js";
import { REVIEW_QUESTIONS_PROMPT, buildReviewUserPrompt } from "./review.js";
import { LevelCoreGenSchema, LevelTasksGenSchema, OutlineSchema } from "./schema.js";
import type { GenerationOptions } from "./types.js";

/**
 * Viz rollout guard (plan C2): with `options.viz` not set, every prompt and every structured-output grammar must stay
 * byte-for-byte what was recorded. Recorded from the pre-viz code; re-recorded deliberately on 2026-10-22 for key
 * points (docs/plan-media.md §2.1: outline step 4 + `points`, the „PUNKTY DO OPANOWANIA” block of the level prompts,
 * `p` on cards / questions / tasks) — nothing else changed. UPDATE_SNAPSHOTS=1 rewrites it — only do that for an
 * intentional change of the non-viz prompt.
 */
const SNAP = new URL("../src/__snapshots__/prompts-viz-off.json", import.meta.url);

const outline = {
  name: "Fotosynteza",
  levels: [
    { title: "Faza jasna", scope: "- chlorofil\n- ATP" },
    { title: "Cykl Calvina", scope: "- RuBisCO\n- 3 CO2" },
  ],
  // key points as generate.ts passes them (0-based levels, after normalizeOutlinePoints)
  points: [
    { key: "p1", title: "Chlorofil i pochłanianie światła", summary: "Wiesz, które światło pochłania chlorofil.", levels: [0] },
    { key: "p2", title: "ATP i NADPH z fazy jasnej", levels: [0] },
    { key: "p3", title: "Cykl Calvina: RuBisCO i wiązanie CO2", summary: "", levels: [1] },
  ],
};

const OPTION_SETS: GenerationOptions[] = [
  { stage: "podstawowa" },
  { stage: "liceum", subjectName: "Biologia", hint: "notatki z lekcji", levels: 3 },
  { stage: "studia", mode: "prompt", hint: "polityka \"fiskalna\"", lang: false },
  { stage: "inne", mode: "materials", lang: true, levels: 8, locale: "pl" },
];

function snapshot() {
  const userPrompts = OPTION_SETS.flatMap((o) => [
    buildGenerationUserPrompt(o, "2 zdj., 1 PDF"),
    buildGenerationUserPrompt({ ...o, viz: false } as GenerationOptions, "2 zdj., 1 PDF"),
  ]);
  const levelPrompts = [0, 1].flatMap((i) => (["core", "tasks", "all"] as const).map((p) => levelInstructions(outline, i, p)));
  // an outline without usable points (raw-JSON fallback, old callers): `p` stays ""
  const noPoints = { name: outline.name, levels: outline.levels };
  const levelPromptsNoPoints = (["core", "tasks", "all"] as const).map((p) => levelInstructions(noPoints, 0, p));
  const review = buildReviewUserPrompt({
    stage: "liceum",
    lang: true,
    title: "Faza jasna",
    feed: [{ title: "Chlorofil", body: "<b>Chlorofil</b> pochłania światło.<br>Odbija zieleń.", real: "Zielony barwnik łapie światło.", mnemo: "" }],
    questions: [{ q: "Co pochłania światło?", a: ["chlorofil", "skrobia", "tlen", "woda"], c: 0, e: "Chlorofil to barwnik.", length_bias: false }],
  });
  return {
    system: [GENERATION_SYSTEM_PROMPT, TOPIC_SYSTEM_PROMPT],
    outline: OUTLINE_INSTRUCTIONS,
    raw: RAW_JSON_INSTRUCTION,
    userPrompts,
    levelPrompts,
    levelPromptsNoPoints,
    reviewSystem: REVIEW_QUESTIONS_PROMPT,
    review,
    grammars: {
      outline: z.toJSONSchema(OutlineSchema),
      core: z.toJSONSchema(LevelCoreGenSchema),
      tasks: z.toJSONSchema(LevelTasksGenSchema),
    },
  };
}

test("viz off: prompts and grammars are byte-for-byte the recorded ones (pre-viz + key points)", () => {
  const now = JSON.stringify(snapshot(), null, 1);
  if (process.env.UPDATE_SNAPSHOTS === "1") writeFileSync(SNAP, now + "\n");
  const want = readFileSync(SNAP, "utf8").trimEnd();
  assert.equal(now, want);
});

test("deck present: the user prompt asks for slide numbers as src_page (only then)", async () => {
  const { buildGenerationUserPrompt } = await import("./prompts.js");
  const o = { stage: "liceum" as const, mode: "materials" as const };
  const plain = buildGenerationUserPrompt(o, "1 tekst.");
  assert.ok(!plain.includes("numer slajdu"));
  assert.equal(buildGenerationUserPrompt(o, "1 tekst.", {}), plain);
  const deck = buildGenerationUserPrompt(o, "1 tekst.", { decks: true });
  assert.match(deck, /src_page = numer slajdu/);
  assert.equal(deck.replace(/\nWśród materiałów jest prezentacja[^\n]*/, ""), plain);
});
