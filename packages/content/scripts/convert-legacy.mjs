#!/usr/bin/env node
/**
 * Converts legacy/data/*.js (window.SUBJECTS.push({...})) into packages/content/subjects/*.json
 * validated against @nauka/shared SubjectContentSchema. Run: npm run content:convert
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { SubjectContentSchema } from "@nauka/shared";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../..");
const LEGACY = path.join(ROOT, "legacy", "data");
const OUT = path.join(here, "..", "subjects");
fs.mkdirSync(OUT, { recursive: true });

// stage + category mapping for the seed subjects (all came from university classes)
const META = {
  makro: { stage: "studia", category: "ekonomia" },
  makrokolos: { stage: "studia", category: "ekonomia" },
  krypto: { stage: "studia", category: "ekonomia" },
  hiszpanski: { stage: "studia", category: "inny-język" },
  angielski: { stage: "studia", category: "angielski" },
  psychologia: { stage: "studia", category: "psychologia" },
  globalizacja: { stage: "studia", category: "ekonomia" },
};

const files = fs.readdirSync(LEGACY).filter((f) => f.endsWith(".js"));
const index = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(LEGACY, f), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: f });
  for (const s of sandbox.window.SUBJECTS ?? []) {
    const { id, ...rest } = s;
    const content = {
      ...rest,
      levels: rest.levels.map((l) => ({ ...l, feed: l.feed ?? [], flashcards: l.flashcards ?? [], quiz: l.quiz ?? [], games: l.games ?? [] })),
    };
    const parsed = SubjectContentSchema.safeParse(content);
    if (!parsed.success) {
      console.error(`✗ ${id}:`, parsed.error.issues.slice(0, 5));
      process.exitCode = 1;
      continue;
    }
    const meta = META[id] ?? { stage: "inne", category: "inne" };
    const doc = { id, ...meta, isPublic: true, content: parsed.data };
    fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(doc, null, 1));
    const q = parsed.data.levels.reduce((a, l) => a + l.quiz.length, 0);
    index.push({ id, name: parsed.data.name, emoji: parsed.data.emoji, stage: meta.stage, category: meta.category, levels: parsed.data.levels.length, questions: q });
    console.log(`✓ ${id}: ${parsed.data.levels.length} poziomów, ${q} pytań`);
  }
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1));
