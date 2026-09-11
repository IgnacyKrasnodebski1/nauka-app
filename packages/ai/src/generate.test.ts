import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSubject } from "./generate.js";
import { materialsToBlocks } from "./materials.js";
import { tutorStream } from "./tutor.js";
import { SubjectContentSchema } from "@nauka/shared";

test("demo generation without API key yields valid subject", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  const r = await generateSubject({ materials: [], text: "Fotosynteza\nRośliny...", options: { stage: "liceum", levels: 2 } });
  assert.equal(r.demo, true);
  assert.equal(r.content.levels.length, 2);
  assert.ok(SubjectContentSchema.safeParse(r.content).success);
  assert.ok(r.content.levels[0]!.games!.length >= 2);
});

test("materials map to content blocks", () => {
  const { blocks, summary } = materialsToBlocks([
    { mime: "image/png", data: Buffer.from("x"), name: "notatki.png" },
    { mime: "application/pdf", data: "QUJD", name: "skrypt.pdf" },
    { mime: "text/plain", data: Buffer.from("hej") },
  ], "wklejone");
  assert.equal(blocks.filter((b) => b.type === "image").length, 1);
  assert.equal(blocks.filter((b) => b.type === "document").length, 3);
  assert.match(summary, /1 zdj\./);
});

test("materials reject unknown mime", () => {
  assert.throws(() => materialsToBlocks([{ mime: "application/zip", data: "" }]));
});

test("tutor demo streams text", async () => {
  let out = "";
  for await (const c of tutorStream({ subject: { name: "X", levels: [] }, question: "co?" })) out += c;
  assert.ok(out.length > 10);
});
