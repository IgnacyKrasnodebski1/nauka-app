import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { TopicContentSchema, keyPointProblems, type KeyPoint, type TopicContent } from "@nauka/shared";
import { setClientForTests } from "./client.js";
import { generateTopic } from "./generate.js";
import { applyReview } from "./review.js";
import { mockAi, outlineWith, quiet, type CallRecord } from "./mock-ai.test-helper.js";

/**
 * Key points inside the lesson generation (docs/plan-media.md §2.1), with a mocked Anthropic client (no network):
 * the outline lists points, every level call tags its cards / questions / tasks with `p`, the review keeps the tags,
 * finalize builds `content.keyPoints` from the final indexes and reports `quality.keyPoints`.
 */

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  setClientForTests(null);
});

/** Outline of `n` levels with three points per level, as the model writes them (level numbers from 1). */
function outlineWithPoints(n: number) {
  const o = outlineWith(n);
  return {
    ...o,
    points: Array.from({ length: n * 3 }, (_, i) => ({
      key: `p${i + 1}`,
      title: `Punkt ${i + 1}`,
      short: `P${i + 1}`,
      summary: `Co umiesz w punkcie ${i + 1}.`,
      levels: [Math.floor(i / 3) + 1],
    })),
  };
}

const ANSWERS = ["chlorofil", "skrobia", "glukoza", "celuloza"];
/** Core answer of level `n` (1-based): 6 cards + 6 questions tagged with the level's three points in turn. */
function taggedCore(n: number) {
  const key = (i: number) => `p${(n - 1) * 3 + (i % 3) + 1}`;
  return {
    feed: [{ title: `Dawka ${n}`, body: "<b>Chlorofil</b> pochłania światło czerwone i niebieskie.", real: "", mnemo: "" }],
    flashcards: Array.from({ length: 6 }, (_, i) => ({ p: key(i), t: `pojęcie ${n}.${i}`, d: "definicja pojęcia" })),
    quiz: Array.from({ length: 6 }, (_, i) => ({ p: key(i), q: `Pytanie ${n}.${i}: co pochłania światło?`, a: ANSWERS, c: 0, e: "Chlorofil to barwnik, który łapie światło.", src_page: 0, src_quote: "" })),
    games: [],
  };
}
/** Tasks answer of level `n`: three compact tasks, tagged with the level's first, third and second point. */
function taggedTasks(n: number) {
  const task = (p: string, answer: string) => ({ p, type: "typeterm", title: "", e: "Bo tak definiuje to dawka.", payload: JSON.stringify({ definition: "Zielony barwnik roślin, który pochłania światło.", answer }), src_page: 0, src_quote: "" });
  const k = (i: number) => `p${(n - 1) * 3 + i}`;
  return { tasks: [task(k(1), "chlorofil"), task(k(3), "barwnik"), task(k(2), "pigment")] };
}
const levelNo = (title: string) => Number(/Poziom (\d+)/.exec(title)?.[1] ?? 0);
const userText = (c: CallRecord) => JSON.stringify(c.params.messages);
const pointByTitle = (c: TopicContent, title: string) => c.keyPoints!.find((p: KeyPoint) => p.title === title)!;

test("generateTopic: the outline's points + p tags become valid content.keyPoints; the review keeps the tags", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({
    behavior: (kind, title, call) => {
      if (kind === "outline") return { parsed: outlineWithPoints(2) };
      if (kind === "core") return { parsed: taggedCore(levelNo(title)) };
      if (kind === "tasks") return { parsed: taggedTasks(levelNo(title)) };
      if (kind === "review" && userText(call).includes("Poziom: „Poziom 1”")) {
        // level 1: rewrite question 0 (same answers and c), drop question 1, drop the first task
        const q0 = { keep: false, drop: false, q: "Który barwnik pochłania światło w liściu?", a: ANSWERS, c: 0, e: "Chlorofil pochłania światło czerwone i niebieskie, dlatego liść jest zielony." };
        const keep = { keep: true, drop: false, q: "", a: [], c: 0, e: "" };
        return { parsed: { questions: [q0, { ...keep, keep: false, drop: true }, keep, keep, keep, keep], feed: [{ keep_mnemo: true, keep_real: true }], tasks: [{ keep: false }, { keep: true }, { keep: true }] } };
      }
      return undefined;
    },
  });
  setClientForTests(m.client);
  const { value: r, logs } = await quiet(() => generateTopic({ materials: [], options: { stage: "liceum", mode: "prompt", hint: "fotosynteza", levels: 2 } }));
  const c = r.content;
  assert.ok(TopicContentSchema.safeParse(c).success);
  assert.deepEqual(keyPointProblems(c), []);
  assert.equal(c.keyPoints!.length, 6);
  assert.deepEqual(r.quality.keyPoints, { keyPoints: 6, repaired: 0, merged: 0, empty: 0, omitted: false });
  assert.ok(logs.some((l) => l.startsWith("[generate] keyPoints ") && l.includes('"outline":6')), "one log line per generation");

  // level 1 after the review: questions [rewritten 0, 2, 3, 4, 5] (1 dropped), tasks [orig 1, orig 2] (orig 0 dropped)
  const l1 = c.levels[0]!;
  assert.equal(l1.quiz.length, 5);
  assert.equal(l1.quiz[0]!.q, "Który barwnik pochłania światło w liściu?");
  assert.equal(l1.tasks!.length, 2);
  const quizOf = (title: string) => pointByTitle(c, title).items.filter((x) => x.kind === "quiz" && x.level === "l1").map((x) => x.index);
  assert.deepEqual(quizOf("Punkt 1"), [0, 2], "rewritten q0 keeps p1; orig q3 → index 2");
  assert.deepEqual(quizOf("Punkt 2"), [3], "orig q1 (p2) dropped; orig q4 → index 3");
  assert.deepEqual(quizOf("Punkt 3"), [1, 4]);
  const tasksOf = (title: string) => pointByTitle(c, title).items.filter((x) => x.kind === "task").map((x) => `${x.level}#${x.index}`);
  assert.deepEqual(tasksOf("Punkt 1"), [], "p1's task was dropped by the review");
  assert.deepEqual(tasksOf("Punkt 3"), ["l1#0"], "orig task 1 (p3) is now index 0");
  assert.deepEqual(tasksOf("Punkt 2"), ["l1#1"], "orig task 2 (p2) is now index 1");
  assert.deepEqual(tasksOf("Punkt 4"), ["l2#0"]);
  assert.deepEqual(pointByTitle(c, "Punkt 1").levels, ["l1"]);
  assert.equal(pointByTitle(c, "Punkt 4").short, "P4");
  assert.equal(pointByTitle(c, "Punkt 4").summary, "Co umiesz w punkcie 4.");

  // the level prompts list their own points and require p; the outline asks for the points
  const core1 = m.calls.find((x) => x.kind === "core" && x.title === "Poziom 1")!;
  assert.match(userText(core1), /PUNKTY DO OPANOWANIA \(pole p\) na tym poziomie:\\n- p1: Punkt 1 — Co umiesz w punkcie 1\.\\n- p2: Punkt 2/);
  assert.ok(!userText(core1).includes("- p4:"));
  assert.match(userText(core1), /Klucz punktu z innego poziomu \(p4, p5, p6\)/);
  const tasks2 = m.calls.find((x) => x.kind === "tasks" && x.title === "Poziom 2")!;
  assert.match(userText(tasks2), /Każde zadanie ma p = klucz punktu, który sprawdza \(np\. \\"p4\\"\)/);
  const outline = m.calls.find((x) => x.kind === "outline")!;
  assert.equal(outline.params.max_tokens, 10000);
  assert.match(userText(outline), /points = 6–15 punktów do opanowania/);
});

test("generateTopic: a failed level takes its planned points with it; the rest keep valid keyPoints", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({
    behavior: (kind, title) => {
      if (kind === "outline") return { parsed: outlineWithPoints(3) };
      if (kind === "core" && levelNo(title) === 2) return { stop_reason: "max_tokens" };
      if (kind === "core") return { parsed: taggedCore(levelNo(title)) };
      if (kind === "tasks") return { parsed: taggedTasks(levelNo(title)) };
      return undefined;
    },
  });
  setClientForTests(m.client);
  const { value: r } = await quiet(() => generateTopic({ materials: [], options: { stage: "studia", mode: "prompt", hint: "fotosynteza", levels: 3 } }));
  const c = r.content;
  assert.equal(r.quality.levelsFailed, 1);
  assert.deepEqual(c.levels.map((l) => l.title), ["Poziom 1", "Poziom 3"]);
  assert.deepEqual(keyPointProblems(c), []);
  assert.deepEqual(c.keyPoints!.map((p) => p.title), ["Punkt 1", "Punkt 2", "Punkt 3", "Punkt 7", "Punkt 8", "Punkt 9"]);
  assert.deepEqual(pointByTitle(c, "Punkt 7").levels, ["l2"], "level 3 of the outline is level l2 of the topic");
  assert.deepEqual(c.keyPoints!.map((p) => p.id), ["p1", "p2", "p3", "p4", "p5", "p6"]);
  assert.equal(r.quality.keyPoints.empty, 3, "the failed level's points had no items");
  assert.equal(r.quality.keyPoints.omitted, false);
});

test("generateTopic: untagged items are repaired (repaired count in quality), the topic still gets keyPoints", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({
    behavior: (kind, title) => {
      if (kind === "outline") return { parsed: outlineWithPoints(2) };
      if (kind === "core") {
        const core = taggedCore(levelNo(title));
        core.flashcards[0]!.p = ""; // the model left it empty
        core.quiz[3]!.p = "p99"; // unknown key
        return { parsed: core };
      }
      if (kind === "tasks") return { parsed: taggedTasks(levelNo(title)) };
      return undefined;
    },
  });
  setClientForTests(m.client);
  const { value: r } = await quiet(() => generateTopic({ materials: [], options: { stage: "liceum", mode: "prompt", hint: "fotosynteza", levels: 2 } }));
  assert.deepEqual(keyPointProblems(r.content), []);
  assert.equal(r.quality.keyPoints.repaired, 4);
  assert.equal(r.quality.keyPoints.omitted, false);
  // both went to the first point planned for their level (they were p1 / p4 anyway)
  assert.ok(pointByTitle(r.content, "Punkt 4").items.some((x) => x.kind === "flashcard" && x.level === "l2" && x.index === 0));
});

test("generateTopic: an outline without points still generates — no keyPoints, p = \"\" in the level prompts", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = mockAi({ outlineLevels: 2 }); // outlineWith(): no `points` at all (as an older mock / a raw answer)
  setClientForTests(m.client);
  const { value: r } = await quiet(() => generateTopic({ materials: [], options: { stage: "liceum", mode: "prompt", hint: "fotosynteza", levels: 2 } }));
  assert.ok(TopicContentSchema.safeParse(r.content).success);
  assert.ok(!("keyPoints" in r.content));
  assert.equal(r.quality.keyPoints.omitted, true);
  assert.equal(r.quality.keyPoints.reason, "no_points");
  const core = m.calls.find((x) => x.kind === "core")!;
  assert.match(userText(core), /Pole p: każda fiszka i każde pytanie quizu ma p = \\"\\" \(pusty string\)/);
});

test("generateTopic: grammar rejected → raw JSON without points / without p still generates", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const { default: AnthropicSdk } = await import("@anthropic-ai/sdk");
  const kinds: string[] = [];
  const message = (parsed: unknown, structured: boolean) => ({
    id: "msg",
    type: "message",
    role: "assistant",
    model: "claude-opus-5",
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(parsed) }],
    usage: { input_tokens: 10, output_tokens: 5 },
    parsed_output: structured ? parsed : undefined,
  });
  const c = {
    beta: {
      messages: {
        stream(params: Anthropic.Beta.MessageCreateParams) {
          const user = JSON.stringify(params.messages);
          const props = Object.keys((params.output_config?.format as { schema?: { properties?: object } } | undefined)?.schema?.properties ?? {});
          const kind = props.includes("questions") || /Poziom do sprawdzenia/.test(user) ? "review" : /FAZA 1/.test(user) ? "outline" : /bez tasks/.test(user) ? "core" : "tasks";
          const raw = !params.output_config?.format;
          kinds.push(raw ? `${kind}:raw` : kind);
          return {
            async finalMessage() {
              if (!raw && (kind === "outline" || kind === "core")) throw new AnthropicSdk.BadRequestError(400, { error: { message: "compiled grammar is too large" } }, "compiled grammar is too large", new Headers());
              if (kind === "review") throw new Error("review offline");
              if (kind === "outline") return message(outlineWith(1), false); // no points
              if (kind === "core") {
                const core = taggedCore(1);
                for (const x of [...core.flashcards, ...core.quiz]) delete (x as { p?: string }).p;
                return message(core, false);
              }
              return message({ tasks: [] }, !raw);
            },
          };
        },
      },
    },
  };
  setClientForTests(c as unknown as Anthropic);
  const { value: r } = await quiet(() => generateTopic({ materials: [], options: { stage: "liceum", mode: "prompt", hint: "fotosynteza", levels: 1 } }));
  assert.ok(kinds.includes("outline:raw") && kinds.includes("core:raw"), kinds.join(","));
  assert.equal(r.content.levels[0]!.quiz.length, 6);
  assert.equal(r.content.keyPoints, undefined);
  assert.equal(r.quality.keyPoints.reason, "no_points");
});

test("demo topic (no API key) carries valid keyPoints for 1–4 levels", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  for (const levels of [1, 2, 3, 4]) {
    const r = await generateTopic({ materials: [], options: { stage: "liceum", mode: "prompt", hint: "Makroekonomia", levels } });
    assert.equal(r.demo, true);
    assert.ok(TopicContentSchema.safeParse(r.content).success, `levels ${levels}`);
    assert.deepEqual(keyPointProblems(r.content), [], `levels ${levels}`);
    assert.equal(r.content.keyPoints!.length, 3 * levels);
    assert.deepEqual(r.quality.keyPoints, { keyPoints: 3 * levels, repaired: 0, merged: 0, empty: 0, omitted: false });
    for (const p of r.content.keyPoints!) assert.ok(p.short.length <= 24 && !/\p{Extended_Pictographic}/u.test(p.title + p.short), p.title);
  }
});

test("applyReview keeps p: a rewritten question keeps its tag, dropped items take theirs, kept tasks keep theirs", () => {
  const q = (p: string, i: number) => ({ p, q: `Pytanie ${i} o barwnik?`, a: ANSWERS, c: 0, e: "Chlorofil to barwnik, który łapie światło.", src_page: 0, src_quote: "" });
  const level = {
    feed: [{ title: "d", body: "b", real: "", mnemo: "" }],
    quiz: ["p1", "p2", "p3", "p1", "p2", "p3"].map(q),
    tasks: [
      { type: "tf", p: "p1", statements: [] },
      { type: "fill", p: "p2", text: "" },
      { type: "order", p: "p3", items: [] },
    ],
  };
  const keep = { keep: true, drop: false, q: "", a: [], c: 0, e: "" };
  const { level: out, stats } = applyReview(level, {
    questions: [keep, { keep: false, drop: false, q: "Jaki barwnik łapie światło w liściach?", a: ANSWERS, c: 0, e: "Chlorofil pochłania światło czerwone i niebieskie." }, { ...keep, keep: false, drop: true }, keep, keep, keep],
    feed: [{ keep_mnemo: true, keep_real: true }],
    tasks: [{ keep: true }, { keep: false }, { keep: true }],
  });
  assert.equal(stats.questionsRewritten, 1);
  assert.equal(stats.questionsDropped, 1);
  assert.deepEqual(out.quiz.map((x) => x.p), ["p1", "p2", "p1", "p2", "p3"]);
  assert.equal(out.quiz[1]!.q, "Jaki barwnik łapie światło w liściach?");
  assert.deepEqual(out.tasks!.map((t) => t.p), ["p1", "p3"]);
});
