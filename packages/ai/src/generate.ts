import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  GENERATION_SYSTEM_PROMPT,
  TOPIC_SYSTEM_PROMPT,
  OUTLINE_INSTRUCTIONS,
  levelInstructions,
  GenerationOptionsSchema,
  OutlineSchema,
  LevelGenSchema,
  FIX_DISTRACTORS_PROMPT,
  needsLengthFix,
  biasedQuestionIndexes,
  answerLengthBias,
  buildGenerationUserPrompt,
  finalizeGenerated,
  type GeneratedTopic,
  type GenerationOptions,
  type Outline,
  type LevelGen,
  type TopicContent,
} from "@nauka/shared";
import { aiConfigured, getClient, modelId } from "./client.js";
import { demoGenerated } from "./demo.js";
import { materialsToBlocks, type MaterialInput } from "./materials.js";

export interface GenerateInput {
  materials: MaterialInput[];
  text?: string;
  options: GenerationOptions;
  /** optional progress callback: phase "outline" | "levels" | "done" */
  onProgress?: (phase: "outline" | "levels" | "done", detail?: string) => void;
}

export interface GenerateResult {
  content: TopicContent;
  category: string;
  model: string;
  usage: { input: number; output: number };
  demo: boolean;
  /** quiz quality: how many levels needed a distractor rewrite and the residual length bias */
  quality: { levelsFixed: number; lengthBias: number };
}

export class GenerationError extends Error {
  constructor(
    message: string,
    public readonly code: "refusal" | "invalid_output" | "no_input" | "api",
  ) {
    super(message);
  }
}

type Usage = { input: number; output: number };

function addUsage(u: Usage, m: Anthropic.Beta.BetaMessage): Usage {
  return {
    input: u.input + m.usage.input_tokens + (m.usage.cache_read_input_tokens ?? 0) + (m.usage.cache_creation_input_tokens ?? 0),
    output: u.output + m.usage.output_tokens,
  };
}

/**
 * Turn uploaded materials (mode "materials") or a typed topic (mode "prompt") into a full topic.
 *
 * Two phases so wall-clock stays ~2 min regardless of level count:
 *  1. outline (metadata + per-level scope) — small, fast;
 *  2. every level generated in parallel from the same materials + its scope.
 * Falls back to a demo topic when no API key is configured.
 */
export async function generateTopic(input: GenerateInput): Promise<GenerateResult> {
  const options = GenerationOptionsSchema.parse(input.options);
  const mode = options.mode ?? (input.materials.length || input.text?.trim() ? "materials" : "prompt");
  if (mode === "materials" && !input.materials.length && !input.text?.trim()) throw new GenerationError("Dodaj przynajmniej jeden plik albo tekst.", "no_input");
  if (mode === "prompt" && !options.hint?.trim()) throw new GenerationError("Wpisz temat, np. „fotosynteza, klasa 7”.", "no_input");

  if (!aiConfigured()) {
    const gen = demoGenerated(options.hint || input.text?.split("\n")[0] || "Demo", options.levels ?? 3);
    return { content: finalizeGenerated(gen, options.stage, { lang: options.lang }), category: gen.category, model: "demo", usage: { input: 0, output: 0 }, demo: true, quality: { levelsFixed: 0, lengthBias: 0 } };
  }

  const { blocks, summary } = mode === "materials" ? materialsToBlocks(input.materials, input.text) : { blocks: [] as Anthropic.Beta.BetaContentBlockParam[], summary: "brak" };
  // cache the (possibly large) materials prefix so the parallel level calls reuse it
  if (blocks.length) {
    const last = blocks[blocks.length - 1]!;
    (last as { cache_control?: { type: "ephemeral" } }).cache_control = { type: "ephemeral" };
  }
  const client = getClient();
  const model = modelId();
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: mode === "materials" ? GENERATION_SYSTEM_PROMPT : TOPIC_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];
  const basePrompt = buildGenerationUserPrompt({ ...options, mode }, summary);
  let usage: Usage = { input: 0, output: 0 };
  let servedModel = model;

  async function call<T>(userText: string, format: ReturnType<typeof betaZodOutputFormat<any>>, maxTokens: number, parse: (text: string) => T | null): Promise<T> {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format },
      system,
      messages: [{ role: "user", content: [...blocks, { type: "text", text: userText }] }],
    });
    let msg: Anthropic.Beta.BetaMessage & { parsed_output?: unknown };
    try {
      msg = await stream.finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.APIError) throw new GenerationError(`AI: ${e.status} ${e.message}`, "api");
      throw e;
    }
    usage = addUsage(usage, msg);
    servedModel = msg.model;
    if (msg.stop_reason === "refusal") throw new GenerationError("AI odmówiło przetworzenia tych materiałów.", "refusal");
    if (msg.stop_reason === "max_tokens") throw new GenerationError("Materiał za duży na jeden temat — podziel go na mniejsze części.", "invalid_output");
    const text = msg.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = (msg.parsed_output as T | null | undefined) ?? parse(text);
    if (!parsed) throw new GenerationError("AI zwróciło nieprawidłową strukturę. Spróbuj ponownie.", "invalid_output");
    return parsed;
  }

  // ---- phase 1: outline
  input.onProgress?.("outline");
  const outline = await call<Outline>(`${basePrompt}\n\n${OUTLINE_INSTRUCTIONS}`, betaZodOutputFormat(OutlineSchema), 8000, (t) => safeParse(OutlineSchema, t));
  const want = options.levels ?? 4;
  outline.levels = outline.levels.slice(0, Math.max(1, want));
  if (!outline.levels.length) throw new GenerationError("AI nie znalazło w materiałach treści do nauki.", "invalid_output");

  // ---- phase 2: levels in parallel
  input.onProgress?.("levels", `${outline.levels.length} poziomów`);
  const levels = await Promise.all(
    outline.levels.map((_, i) => call<LevelGen>(`${basePrompt}\n\n${levelInstructions(outline, i)}`, betaZodOutputFormat(LevelGenSchema), 16000, (t) => safeParse(LevelGenSchema, t))),
  );

  // ---- phase 3: anti-guessing — rewrite distractors where the correct option stands out by length
  input.onProgress?.("levels", "sprawdzam pytania");
  let levelsFixed = 0;
  await Promise.all(
    levels.map(async (lv) => {
      if (!needsLengthFix(lv.quiz)) return;
      const idxs = biasedQuestionIndexes(lv.quiz);
      const fixed = await fixDistractors(client, lv.quiz.filter((_, i) => idxs.includes(i)));
      if (!fixed) return;
      idxs.forEach((qi, k) => {
        const f = fixed[k];
        const orig = lv.quiz[qi]!;
        // accept only when the correct text is intact and option count unchanged
        if (f && f.a.length === orig.a.length && f.a[orig.c] === orig.a[orig.c]) lv.quiz[qi] = { ...orig, a: f.a };
      });
      levelsFixed++;
    }),
  );
  const lengthBias = Math.max(0, ...levels.map((lv) => answerLengthBias(lv.quiz).longest));

  const gen: GeneratedTopic = {
    name: outline.name,
    short: outline.short,
    emoji: outline.emoji,
    tagline: outline.tagline,
    category: outline.category,
    info_html: outline.info_html,
    levels: outline.levels.map((l, i) => ({ title: l.title, emoji: l.emoji, summary: l.summary, ...levels[i]! })),
  };
  input.onProgress?.("done");
  const content = finalizeGenerated(gen, options.stage, { lang: options.lang });
  return { content, category: outline.category || "inne", model: servedModel, usage, demo: false, quality: { levelsFixed, lengthBias } };

  /** Cheap targeted rewrite of distractors (keeps q/c/e). Returns null on any failure — the original quiz stays. */
  async function fixDistractors(c: Anthropic, questions: { q: string; a: string[]; c: number; e: string }[]) {
    if (!questions.length) return null;
    const FixSchema = z.object({ questions: z.array(z.object({ q: z.string(), a: z.array(z.string()), c: z.number(), e: z.string() })) });
    try {
      const msg = await c.beta.messages
        .stream({
          model: process.env.RECALL_AI_FIX_MODEL || "claude-sonnet-5",
          max_tokens: 8000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          output_config: { effort: "low", format: betaZodOutputFormat(FixSchema) },
          system: FIX_DISTRACTORS_PROMPT,
          messages: [{ role: "user", content: JSON.stringify({ questions }) }],
        })
        .finalMessage();
      usage = addUsage(usage, msg);
      const out = (msg.parsed_output as z.infer<typeof FixSchema> | null)?.questions;
      return out && out.length === questions.length ? out : null;
    } catch {
      return null;
    }
  }
}

function safeParse<T>(schema: { parse: (v: unknown) => T }, text: string): T | null {
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

/** @deprecated use generateTopic */
export const generateSubject = generateTopic;
