import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { REVIEW_QUESTIONS_PROMPT, REVIEW_VIZ_RULES, VIZ_RULES, TopicContentSchema } from "@nauka/shared";
import { applyReview, reviewLevel, type ReviewOutput } from "./review.js";
import { generateTopic } from "./generate.js";
import { setClientForTests } from "./client.js";

/** Dose visuals (options.viz): grammar + prompt only in viz mode, review keep_viz, finalize stats. Mocked client, no network. */

const FLOW = JSON.stringify({ kind: "cause", steps: ["Susza", "Nieurodzaj", "Drożejący chleb"] });
const BARS = JSON.stringify({ unit: "%", items: [{ label: "Stan trzeci", value: 98 }, { label: "Szlachta", value: 1.5 }] });

function vizLevel() {
  return {
    feed: [
      { title: "Przyczyny", body: "<b>Susza</b> dała nieurodzaj, a chleb drożał.", real: "Głód podgrzał nastroje.", mnemo: "", viz_type: "flow", viz: FLOW },
      { title: "Stany", body: "<b>Stan trzeci</b> to 98% ludności, szlachta 1,5%.", real: "", mnemo: "", viz_type: "bars", viz: BARS },
      { title: "Kosmos", body: "<b>Mars</b> to planeta.", real: "", mnemo: "", viz_type: "cycle", viz: JSON.stringify({ steps: ["Wenus", "Jowisz", "Saturn"] }) },
      { title: "Konwent", body: "<b>Konwent</b> rządził republiką.", real: "", mnemo: "", viz_type: "none", viz: "" },
    ],
    flashcards: [{ t: "stan trzeci", d: "mieszczanie i chłopi" }],
    quiz: [{ q: "Kto stanowił większość?", a: ["stan trzeci", "szlachta", "duchowni", "król"], c: 0, e: "Stan trzeci to 98% ludności.", src_page: 0, src_quote: "" }],
    games: [],
  };
}

const OUTLINE = {
  name: "Rewolucja francuska",
  short: "Rewolucja",
  emoji: "🇫🇷",
  tagline: "",
  category: "historia",
  info_html: "",
  levels: [{ title: "Początki", emoji: "🏰", summary: "", scope: "- przyczyny" }],
};

function message(parsed: unknown) {
  return {
    id: "msg",
    type: "message",
    role: "assistant",
    model: "claude-opus-5",
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(parsed) }],
    usage: { input_tokens: 10, output_tokens: 5 },
    parsed_output: parsed,
  };
}

type Params = Anthropic.Beta.MessageCreateParams;
const props = (p: Params) => Object.keys((p.output_config?.format as { schema?: { properties?: Record<string, unknown> } } | undefined)?.schema?.properties ?? {});
const feedProps = (p: Params) =>
  Object.keys(
    (p.output_config?.format as { schema?: { properties?: { feed?: { items?: { properties?: Record<string, unknown> } } } } } | undefined)?.schema?.properties?.feed?.items?.properties ?? {},
  );

function client(review: (p: Params) => unknown) {
  const calls: { kind: string; params: Params }[] = [];
  const c = {
    beta: {
      messages: {
        stream(params: Params) {
          const pr = props(params);
          const kind = pr.includes("questions") ? "review" : pr.includes("info_html") ? "outline" : pr.includes("feed") ? "core" : "tasks";
          calls.push({ kind, params });
          return {
            async finalMessage() {
              if (kind === "review") return message(review(params));
              return message(kind === "outline" ? OUTLINE : kind === "core" ? vizLevel() : { tasks: [] });
            },
          };
        },
      },
    },
  };
  return { client: c as unknown as Anthropic, calls };
}

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  setClientForTests(null);
});

const KEEP_Q = { keep: true, drop: false, q: "", a: [] as string[], c: 0, e: "" };

test("generateTopic with options.viz: viz grammar + rules on the dose call, keep_viz review, visuals stored with stats", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = client(() => ({
    questions: [KEEP_Q],
    feed: [
      { keep_mnemo: true, keep_real: true, keep_viz: true },
      { keep_mnemo: true, keep_real: true, keep_viz: false },
      { keep_mnemo: true, keep_real: true, keep_viz: true },
      { keep_mnemo: true, keep_real: true, keep_viz: true },
    ],
  }));
  setClientForTests(m.client);
  const r = await generateTopic({ materials: [], options: { stage: "liceum", mode: "prompt", hint: "rewolucja francuska", levels: 1, viz: true } });
  assert.ok(TopicContentSchema.safeParse(r.content).success);

  const core = m.calls.find((c) => c.kind === "core")!.params;
  assert.deepEqual(feedProps(core), ["title", "body", "real", "mnemo", "viz_type", "viz"]);
  assert.ok(JSON.stringify(core.messages).includes(JSON.stringify(VIZ_RULES).slice(1, -1)), "viz rules on the dose call");
  for (const c of m.calls.filter((c) => c.kind !== "core" && c.kind !== "review")) assert.ok(!JSON.stringify(c.params.messages).includes("WIZUALIZACJE"), `${c.kind}: no viz rules`);
  assert.equal(JSON.stringify(core.system).includes("WIZUALIZACJE"), false, "system prompt (cached prefix) unchanged");

  const review = m.calls.find((c) => c.kind === "review")!.params;
  assert.equal(review.system, `${REVIEW_QUESTIONS_PROMPT}\n\n${REVIEW_VIZ_RULES}`);
  assert.deepEqual(feedProps(review), ["keep_mnemo", "keep_real", "keep_viz"]);
  const sent = JSON.parse((review.messages[0]!.content as string).replace(/^[\s\S]*?(\{"feed")/, "$1")) as { feed: { viz?: { type: string } }[] };
  assert.deepEqual(sent.feed.map((f) => f.viz?.type ?? null), ["flow", "bars", "cycle", null]);

  const feed = r.content.levels[0]!.feed;
  assert.equal(feed[0]!.viz?.type, "flow", "grounded visual kept");
  assert.equal(feed[1]!.viz, undefined, "cleared by the review");
  assert.equal(feed[2]!.viz, undefined, "invented content dropped by grounding");
  assert.equal(feed[3]!.viz, undefined);
  assert.equal(r.quality.vizCleared, 1);
  assert.equal(r.quality.vizKept, 1);
  assert.deepEqual(r.quality.vizDropped, { schema: 0, grounding: 1, cap: 0 });
  assert.equal(r.quality.levelsFixed, 1);
});

test("generateTopic without options.viz: no viz fields asked, no visuals stored, zero viz stats", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const m = client(() => ({ questions: [KEEP_Q], feed: [0, 1, 2, 3].map(() => ({ keep_mnemo: true, keep_real: true })) }));
  setClientForTests(m.client);
  const r = await generateTopic({ materials: [], options: { stage: "liceum", mode: "prompt", hint: "rewolucja francuska", levels: 1 } });
  const core = m.calls.find((c) => c.kind === "core")!.params;
  assert.deepEqual(feedProps(core), ["title", "body", "real", "mnemo"]);
  const review = m.calls.find((c) => c.kind === "review")!.params;
  assert.equal(review.system, REVIEW_QUESTIONS_PROMPT);
  assert.deepEqual(feedProps(review), ["keep_mnemo", "keep_real"]);
  assert.ok(!JSON.stringify(m.calls.map((c) => c.params)).includes("WIZUALIZACJE"));
  assert.ok(r.content.levels[0]!.feed.every((f) => !("viz" in f)));
  assert.equal(r.quality.vizKept, 0);
  assert.equal(r.quality.vizCleared, 0);
});

// ---------- review keep_viz ----------

test("applyReview clears a visual only on keep_viz: false and only when the dose has one", () => {
  const lv = vizLevel();
  const before = JSON.stringify(lv);
  const out: ReviewOutput = {
    questions: [KEEP_Q],
    feed: [
      { keep_mnemo: true, keep_real: true, keep_viz: false },
      { keep_mnemo: true, keep_real: true, keep_viz: true },
      { keep_mnemo: true, keep_real: false, keep_viz: true },
      { keep_mnemo: true, keep_real: true, keep_viz: false },
    ],
  };
  const { level: next, stats } = applyReview(lv, out);
  assert.equal(next.feed[0]!.viz_type, "none");
  assert.equal(next.feed[0]!.viz, "");
  assert.equal(next.feed[0]!.body, lv.feed[0]!.body, "text kept");
  assert.equal(next.feed[1], lv.feed[1], "kept visual: same object");
  assert.equal(next.feed[3], lv.feed[3], "keep_viz false on a dose without a visual changes nothing");
  assert.equal(stats.vizCleared, 1);
  assert.equal(stats.realCleared, 0, "empty real is not counted");
  assert.equal(JSON.stringify(lv), before, "input not mutated");

  // non-viz output (no keep_viz key) never touches visuals
  const plain = applyReview(lv, { questions: [KEEP_Q], feed: [0, 1, 2, 3].map(() => ({ keep_mnemo: true, keep_real: true })) });
  assert.equal(plain.level, lv);
  assert.equal(plain.stats.vizCleared, 0);
});

test("reviewLevel: the short-circuit counts visuals in viz mode only", async () => {
  const onlyViz = { feed: [{ title: "a", body: "b", real: "", mnemo: "", viz_type: "flow", viz: FLOW }], quiz: [] };
  const m = client(() => ({ questions: [], feed: [{ keep_mnemo: true, keep_real: true, keep_viz: false }] }));
  const off = await reviewLevel(m.client, onlyViz, { stage: "liceum" });
  assert.equal(off.error, "nothing to review");
  assert.equal(m.calls.length, 0);

  const on = await reviewLevel(m.client, onlyViz, { stage: "liceum", viz: true });
  assert.equal(m.calls.length, 1, "a dose with only a visual is reviewed");
  assert.equal(on.reviewed, true);
  assert.equal(on.level.feed[0]!.viz_type, "none");
  assert.equal(on.stats.vizCleared, 1);

  const none = { feed: [{ title: "a", body: "b", real: "", mnemo: "", viz_type: "none", viz: "" }], quiz: [] };
  const r = await reviewLevel(m.client, none, { stage: "liceum", viz: true });
  assert.equal(r.error, "nothing to review");
});

test("reviewLevel in viz mode rejects an answer without keep_viz (keeps the level)", async () => {
  const lv = vizLevel();
  const m = client(() => ({ questions: [KEEP_Q], feed: [0, 1, 2, 3].map(() => ({ keep_mnemo: true, keep_real: true })) }));
  const r = await reviewLevel(m.client, lv, { stage: "liceum", viz: true });
  assert.equal(r.reviewed, false);
  assert.equal(r.level, lv);
});

test("viz mode, grammar rejected: the raw-JSON fallback keeps doses without viz fields or with an unknown viz_type", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const { default: AnthropicSdk } = await import("@anthropic-ai/sdk");
  const level = vizLevel();
  const raw = {
    ...level,
    feed: [
      level.feed[0], // valid visual
      { title: "Stany", body: "<b>Stan trzeci</b> to większość.", real: "", mnemo: "" }, // no viz fields at all
      { title: "Konwent", body: "<b>Konwent</b> rządził.", real: "", mnemo: "", viz_type: "chart", viz: "{}" }, // outside the enum
    ],
  };
  const calls: string[] = [];
  const c = {
    beta: {
      messages: {
        stream(params: Params) {
          const pr = props(params);
          const kind = !params.output_config?.format ? "raw" : pr.includes("questions") ? "review" : pr.includes("info_html") ? "outline" : pr.includes("feed") ? "core" : "tasks";
          calls.push(kind);
          return {
            async finalMessage() {
              if (kind === "core") throw new AnthropicSdk.BadRequestError(400, { error: { message: "compiled grammar is too large" } }, "compiled grammar is too large", new Headers());
              if (kind === "raw") return { ...message(raw), parsed_output: undefined };
              if (kind === "review") throw new Error("review offline");
              return message(kind === "outline" ? OUTLINE : { tasks: [] });
            },
          };
        },
      },
    },
  };
  setClientForTests(c as unknown as Anthropic);
  const r = await generateTopic({ materials: [], options: { stage: "liceum", mode: "prompt", hint: "rewolucja francuska", levels: 1, viz: true } });
  assert.ok(calls.includes("raw"), `fallback used: ${calls}`);
  const feed = r.content.levels[0]!.feed;
  assert.equal(feed.length, 3);
  assert.equal(feed[0]!.viz?.type, "flow");
  assert.equal(feed[1]!.viz, undefined);
  assert.equal(feed[2]!.viz, undefined);
});
