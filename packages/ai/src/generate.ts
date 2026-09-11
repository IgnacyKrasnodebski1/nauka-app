import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  GENERATION_SYSTEM_PROMPT,
  TOPIC_SYSTEM_PROMPT,
  GeneratedTopicSchema,
  GenerationOptionsSchema,
  buildGenerationUserPrompt,
  finalizeGenerated,
  type GenerationOptions,
  type TopicContent,
} from "@nauka/shared";
import { aiConfigured, getClient, modelId } from "./client.js";
import { demoGenerated } from "./demo.js";
import { materialsToBlocks, type MaterialInput } from "./materials.js";

export interface GenerateInput {
  materials: MaterialInput[];
  text?: string;
  options: GenerationOptions;
}

export interface GenerateResult {
  content: TopicContent;
  category: string;
  model: string;
  usage: { input: number; output: number };
  demo: boolean;
}

export class GenerationError extends Error {
  constructor(
    message: string,
    public readonly code: "refusal" | "invalid_output" | "no_input" | "api",
  ) {
    super(message);
  }
}

/**
 * Turn uploaded materials (mode "materials") or a typed topic (mode "prompt") into a full topic.
 * Uses Claude vision + PDF + structured outputs. Falls back to a demo topic when no API key is configured.
 */
export async function generateTopic(input: GenerateInput): Promise<GenerateResult> {
  const options = GenerationOptionsSchema.parse(input.options);
  const mode = options.mode ?? (input.materials.length || input.text?.trim() ? "materials" : "prompt");
  if (mode === "materials" && !input.materials.length && !input.text?.trim()) throw new GenerationError("Dodaj przynajmniej jeden plik albo tekst.", "no_input");
  if (mode === "prompt" && !options.hint?.trim()) throw new GenerationError("Wpisz temat, np. „fotosynteza, klasa 7”.", "no_input");

  if (!aiConfigured()) {
    const gen = demoGenerated(options.hint || input.text?.split("\n")[0] || "Demo", options.levels ?? 3);
    return { content: finalizeGenerated(gen, options.stage, { lang: options.lang }), category: gen.category, model: "demo", usage: { input: 0, output: 0 }, demo: true };
  }

  const { blocks, summary } = mode === "materials" ? materialsToBlocks(input.materials, input.text) : { blocks: [], summary: "brak" };
  const client = getClient();
  const model = modelId();

  const stream = client.beta.messages.stream({
    model,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(GeneratedTopicSchema) },
    system: [{ type: "text", text: mode === "materials" ? GENERATION_SYSTEM_PROMPT : TOPIC_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: [...blocks, { type: "text", text: buildGenerationUserPrompt({ ...options, mode }, summary) }] }],
  });

  let msg;
  try {
    msg = await stream.finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.APIError) throw new GenerationError(`AI: ${e.status} ${e.message}`, "api");
    throw e;
  }
  if (msg.stop_reason === "refusal") throw new GenerationError("AI odmówiło przetworzenia tych materiałów.", "refusal");
  if (msg.stop_reason === "max_tokens") throw new GenerationError("Materiał za duży na jeden przedmiot — podziel go na mniejsze części.", "invalid_output");

  const parsed = msg.parsed_output ?? parseFromText(msg.content);
  if (!parsed) throw new GenerationError("AI zwróciło nieprawidłową strukturę. Spróbuj ponownie.", "invalid_output");

  const content = finalizeGenerated(parsed, options.stage, { lang: options.lang });
  return {
    content,
    category: parsed.category || "inne",
    model: msg.model,
    usage: { input: msg.usage.input_tokens + (msg.usage.cache_read_input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0), output: msg.usage.output_tokens },
    demo: false,
  };
}

function parseFromText(content: Anthropic.Beta.BetaContentBlock[]) {
  const text = content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return GeneratedTopicSchema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

/** @deprecated use generateTopic */
export const generateSubject = generateTopic;
