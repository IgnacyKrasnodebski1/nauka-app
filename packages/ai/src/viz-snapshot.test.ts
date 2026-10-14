import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import type Anthropic from "@anthropic-ai/sdk";
import { generateTopic } from "./generate.js";
import { setClientForTests } from "./client.js";

/**
 * Viz rollout guard (plan C2): a generation WITHOUT `options.viz` sends exactly the same requests (system prompt,
 * user text, output grammar, model params) as before the viz feature. Recorded from the pre-viz code; the Anthropic
 * client is mocked (no network). UPDATE_SNAPSHOTS=1 rewrites the snapshot — only for an intentional non-viz change.
 */
const SNAP = new URL("../src/__snapshots__/generate-viz-off.json", import.meta.url);

const OUTLINE = {
  name: "Fotosynteza",
  short: "Fotosynteza",
  emoji: "🌿",
  tagline: "Jak rośliny robią cukier",
  category: "biologia",
  info_html: "",
  levels: [
    { title: "Faza jasna", emoji: "☀️", summary: "światło", scope: "- chlorofil\n- ATP" },
    { title: "Cykl Calvina", emoji: "🔁", summary: "CO2", scope: "- RuBisCO" },
  ],
};

export function coreLevel() {
  return {
    feed: [
      { title: "Chlorofil", body: "<b>Chlorofil</b> pochłania światło czerwone i niebieskie.", real: "Zielony barwnik łapie światło.", mnemo: "" },
      { title: "ATP", body: "W fazie jasnej powstaje <b>ATP</b> i NADPH.", real: "", mnemo: "" },
    ],
    flashcards: [{ t: "chlorofil", d: "zielony barwnik" }],
    quiz: [{ q: "Co pochłania światło?", a: ["chlorofil", "skrobia", "glukoza", "celuloza"], c: 0, e: "Chlorofil to barwnik.", src_page: 0, src_quote: "" }],
    games: [],
  };
}

type Params = Anthropic.Beta.MessageCreateParams;

/** Mock client: answers by the structured-output schema (outline / core / tasks / review) and records every request. */
export function mockClient(answer: (kind: "outline" | "core" | "tasks" | "review", params: Params) => unknown = () => undefined) {
  const calls: { kind: string; params: Params }[] = [];
  const client = {
    beta: {
      messages: {
        stream(params: Params) {
          const fmt = params.output_config?.format as { schema?: { properties?: Record<string, unknown> } } | undefined;
          const props = Object.keys(fmt?.schema?.properties ?? {});
          const user = JSON.stringify(params.messages);
          const kind = props.includes("questions") || /Poziom do sprawdzenia/.test(user)
            ? "review"
            : props.includes("info_html") || /FAZA 1/.test(user)
              ? "outline"
              : props.includes("feed") || /bez tasks/.test(user)
                ? "core"
                : "tasks";
          calls.push({ kind, params });
          return {
            async finalMessage() {
              const custom = answer(kind, params);
              const parsed =
                custom !== undefined
                  ? custom
                  : kind === "outline"
                    ? OUTLINE
                    : kind === "core"
                      ? coreLevel()
                      : kind === "tasks"
                        ? { tasks: [] }
                        : { questions: [{ keep: true, drop: false, q: "", a: [], c: 0, e: "" }], feed: [{ keep_mnemo: true, keep_real: true }, { keep_mnemo: true, keep_real: true }] };
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
            },
          };
        },
      },
    },
  };
  return { client: client as unknown as Anthropic, calls };
}

/** Stable view of a request: everything the model sees + the call parameters. */
export function requestView(params: Params) {
  return JSON.parse(
    JSON.stringify({
      model: params.model,
      max_tokens: params.max_tokens,
      thinking: params.thinking,
      output_config: params.output_config,
      system: params.system,
      messages: params.messages,
    }),
  );
}

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  setClientForTests(null);
});

test("viz off: generation requests are byte-for-byte the pre-viz ones", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  const runs: unknown[] = [];
  for (const options of [
    { stage: "liceum" as const, mode: "prompt" as const, hint: "fotosynteza", levels: 2 },
    { stage: "studia" as const, mode: "prompt" as const, hint: "fotosynteza", levels: 2, subjectName: "Biologia", viz: false },
  ]) {
    const m = mockClient();
    setClientForTests(m.client);
    await generateTopic({ materials: [], options });
    const order = ["outline", "core", "tasks", "review"];
    const sorted = [...m.calls].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || JSON.stringify(a.params).localeCompare(JSON.stringify(b.params)));
    runs.push(sorted.map((c) => ({ kind: c.kind, request: requestView(c.params) })));
  }
  const now = JSON.stringify(runs, null, 1);
  if (process.env.UPDATE_SNAPSHOTS === "1") writeFileSync(SNAP, now + "\n");
  assert.equal(now, readFileSync(SNAP, "utf8").trimEnd());
});
