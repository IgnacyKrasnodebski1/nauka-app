import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { TopicContentSchema, blankGenTask } from "@nauka/shared";
import { applyReview, reviewLevel, MIN_TASKS } from "./review.js";
import { generateTopic } from "./generate.js";
import { setClientForTests } from "./client.js";
import { materialsToBlocks, pdfPageCount } from "./materials.js";

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  setClientForTests(null);
});

const Q = { q: "Co robi gwarancja ratunku?", a: ["zwiększa ryzyko", "zmniejsza ryzyko", "nie zmienia ryzyka", "przenosi ryzyko"], c: 0, e: "Odpowiedź A.", src_page: 0, src_quote: "" };
const KEEP = { keep: true, drop: false, q: "", a: [] as string[], c: 0, e: "" };
const dose = { title: "Pokusa nadużycia", body: "<b>Pokusa nadużycia</b>: kto wie, że ktoś pokryje straty, ryzykuje bardziej.", real: "", mnemo: "" };
const task = (title: string) => blankGenTask({ type: "tf", title, statements: [{ s: "Zdanie", v: true, e: "" }] });

test("applyReview drops tasks on keep:false, never below MIN_TASKS, and ignores a verdict of the wrong length", () => {
  const lv = { feed: [dose], quiz: [Q], tasks: [task("a"), task("b"), task("c"), task("d")] };
  const r = applyReview(lv, { questions: [KEEP], feed: [{ keep_mnemo: true, keep_real: true }], tasks: [{ keep: false }, { keep: true }, { keep: false }, { keep: false }] });
  assert.equal(MIN_TASKS, 2);
  assert.deepEqual(r.level.tasks!.map((t) => t.title), ["b", "d"], "first two drops applied, the third would go below the floor");
  assert.equal(r.stats.tasksDropped, 2);
  assert.equal(lv.tasks.length, 4, "input not mutated");
  const wrong = applyReview(lv, { questions: [KEEP], feed: [{ keep_mnemo: true, keep_real: true }], tasks: [{ keep: false }] });
  assert.equal(wrong.level, lv);
  const older = applyReview(lv, { questions: [KEEP], feed: [{ keep_mnemo: true, keep_real: true }] });
  assert.equal(older.level, lv, "an answer without tasks keeps every task");
});

test("reviewLevel sends the tasks and the question flags; the grammar asks for a task verdict", async () => {
  const calls: Anthropic.Beta.MessageCreateParams[] = [];
  const answer = { questions: [{ keep: false, drop: false, q: Q.q, a: Q.a, c: 0, e: "Gdy ktoś inny pokrywa straty, bardziej opłaca się ryzykować — to pokusa nadużycia." }], feed: [{ keep_mnemo: true, keep_real: true }], tasks: [{ keep: true }, { keep: true }, { keep: false }] };
  const client = {
    beta: {
      messages: {
        stream(params: Anthropic.Beta.MessageCreateParams) {
          calls.push(params);
          return { finalMessage: async () => ({ id: "m", type: "message", role: "assistant", model: "claude-sonnet-5", stop_reason: "end_turn", content: [], usage: { input_tokens: 1, output_tokens: 1 }, parsed_output: answer }) };
        },
      },
    },
  } as unknown as Anthropic;
  const r = await reviewLevel(client, { feed: [dose], quiz: [{ ...Q }], tasks: [task("a"), task("b"), task("c")] }, { stage: "studia" });
  const user = calls[0]!.messages[0]!.content as string;
  const sent = JSON.parse(user.slice(user.indexOf("{"))) as { questions: { weak_e: boolean }[]; tasks: { type: string; title: string; statements?: unknown[] }[] };
  assert.equal(sent.questions[0]!.weak_e, true, "'Odpowiedź A.' is flagged");
  assert.deepEqual(sent.tasks.map((t) => t.title), ["a", "b", "c"]);
  assert.ok(sent.tasks.every((t) => !("src_page" in t) && !("pairs" in t)), "compact task view");
  const schema = (calls[0]!.output_config?.format as unknown as { schema: { properties: Record<string, unknown> } }).schema;
  assert.ok("tasks" in schema.properties);
  assert.equal(r.reviewed, true);
  assert.equal(r.level.quiz[0]!.e, answer.questions[0]!.e, "weak e rewritten");
  assert.deepEqual(r.level.tasks!.map((t) => t.title), ["a", "b"]);
  assert.equal(r.stats.tasksDropped, 1);
});

/** Mock client for generateTopic: outline with `n` levels; `failCore` = level titles whose core call fails. */
function genClient(n: number, opts: { failCore?: string[]; category?: string; failCode?: "max_tokens" | "refusal" } = {}) {
  const calls: { kind: string; user: string; system: string }[] = [];
  const outline = {
    name: "Makro", short: "Makro", emoji: "📈", tagline: "", category: opts.category ?? "ekonomia", info_html: "",
    levels: Array.from({ length: n }, (_, i) => ({ title: `Poziom ${i + 1}`, emoji: "📘", summary: "", scope: `- pojęcie ${i + 1}: opis` })),
  };
  const client = {
    beta: {
      messages: {
        stream(params: Anthropic.Beta.MessageCreateParams) {
          const props = Object.keys((params.output_config?.format as { schema?: { properties?: Record<string, unknown> } } | undefined)?.schema?.properties ?? {});
          const user = JSON.stringify(params.messages);
          const kind = props.includes("questions") ? "review" : props.includes("info_html") ? "outline" : props.includes("feed") ? "core" : "tasks";
          calls.push({ kind, user, system: JSON.stringify(params.system) });
          return {
            async finalMessage() {
              const title = /Generujesz WYŁĄCZNIE poziom \d+ z \d+: „([^”]+)”/.exec(user)?.[1] ?? "";
              let parsed: unknown;
              let stop = "end_turn";
              if (kind === "outline") parsed = outline;
              else if (kind === "core") {
                if (opts.failCore?.includes(title)) stop = opts.failCode ?? "max_tokens";
                parsed = { feed: [{ ...dose, title: `Dawka ${title}` }], flashcards: [{ t: "pokusa nadużycia", d: "ryzyko, gdy straty pokrywa ktoś inny" }], quiz: [{ ...Q, e: "Gdy ktoś inny pokrywa straty, ryzyko się opłaca." }], games: [] };
              } else if (kind === "tasks") parsed = { tasks: [] };
              else parsed = { questions: [KEEP], feed: [{ keep_mnemo: true, keep_real: true }], tasks: [] };
              return { id: "m", type: "message", role: "assistant", model: "claude-opus-5", stop_reason: stop, content: [{ type: "text", text: JSON.stringify(parsed) }], usage: { input_tokens: 10, output_tokens: 5 }, parsed_output: stop === "end_turn" ? parsed : null };
            },
          };
        },
      },
    },
  };
  return { client: client as unknown as Anthropic, calls };
}

async function quiet<T>(f: () => Promise<T>): Promise<{ value: T; warns: string[]; infos: string[] }> {
  const warns: string[] = [];
  const infos: string[] = [];
  const w = console.warn;
  const i = console.info;
  console.warn = (...a: unknown[]) => void warns.push(a.join(" "));
  console.info = (...a: unknown[]) => void infos.push(a.join(" "));
  try {
    return { value: await f(), warns, infos };
  } finally {
    console.warn = w;
    console.info = i;
  }
}

test("a long material may use up to levels + 2; more is cut with a warning", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = genClient(9);
  setClientForTests(m.client);
  const { value: r, warns } = await quiet(() => generateTopic({ materials: [], text: "x ".repeat(50), options: { stage: "studia", levels: 4 } }));
  assert.equal(r.content.levels.length, 6);
  assert.ok(warns.some((w) => /outline had 9 levels, cut to 6/.test(w)));
  const core = m.calls.find((c) => c.kind === "core")!;
  assert.match(core.user, /Pozostałe poziomy/);
});

test("one failed level is left out instead of failing the whole (already charged) generation", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = genClient(3, { failCore: ["Poziom 2"] });
  setClientForTests(m.client);
  const { value: r, warns, infos } = await quiet(() => generateTopic({ materials: [], text: "x ".repeat(50), options: { stage: "studia", levels: 3 } }));
  assert.deepEqual(r.content.levels.map((l) => l.title), ["Poziom 1", "Poziom 3"]);
  assert.equal(r.quality.levelsFailed, 1);
  assert.ok(TopicContentSchema.safeParse(r.content).success);
  assert.ok(warns.some((w) => /1\/3 levels failed/.test(w)));
  assert.ok(infos.some((w) => /\[generate\] coverage/.test(w)), "coverage line logged");
  assert.equal(r.quality.scopePoints, 2);
});

test("every level failing, or a refusal, still fails the generation", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  setClientForTests(genClient(2, { failCore: ["Poziom 1", "Poziom 2"] }).client);
  await assert.rejects(quiet(() => generateTopic({ materials: [], text: "x", options: { stage: "studia", levels: 2 } })), /za duży/);
  setClientForTests(genClient(2, { failCore: ["Poziom 2"], failCode: "refusal" }).client);
  await assert.rejects(quiet(() => generateTopic({ materials: [], text: "x", options: { stage: "studia", levels: 2 } })), /odmówiło/);
});

test("a language topic recognised by the outline category gets the language rules in level calls and review", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = genClient(1, { category: "inny-język" });
  setClientForTests(m.client);
  const { value: r } = await quiet(() => generateTopic({ materials: [], text: "Hola", options: { stage: "liceum", levels: 1 } }));
  assert.doesNotMatch(m.calls.find((c) => c.kind === "outline")!.user, /To jest temat językowy/);
  assert.match(m.calls.find((c) => c.kind === "core")!.user, /To jest temat językowy/);
  assert.match(m.calls.find((c) => c.kind === "review")!.user, /Temat językowy/);
  assert.equal(r.content.lang, undefined, "stored flag unchanged (client behaviour unchanged)");
});

test("materials summary carries a size signal (PDF pages, words of text)", () => {
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj <</Type /Pages /Count 2>>\n2 0 obj <</Type /Page>>\n3 0 obj <</Type/Page /Parent 1 0 R>>\n%%EOF", "latin1");
  assert.equal(pdfPageCount(pdf), 2);
  const { summary } = materialsToBlocks([{ mime: "application/pdf", data: pdf, name: "w.pdf" }], "słowo ".repeat(1234));
  assert.equal(summary, "1 PDF, 1 tekst.; objętość: ok. 2 str. PDF, ok. 1200 słów tekstu");
  assert.equal(materialsToBlocks([], "krótki tekst").summary, "1 tekst.");
});
