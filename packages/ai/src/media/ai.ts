import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { getClient } from "../client.js";
import type { UsageMeter } from "../cost.js";
import { observeStream } from "../deadline.js";
import { classifyAiError, describeAiError } from "../generate.js";
import { MediaError } from "./errors.js";

/**
 * One structured Claude call of the media pipelines (reel plan and storyboards, podcast outline and chapters, the fox).
 * Same patterns as generate.ts: streaming + `finalMessage()`, adaptive thinking, `output_config.format` from a zod
 * schema (`betaZodOutputFormat`, with a plain-JSON retry when the API rejects the grammar), every request bound to the
 * caller's AbortSignal, the usage recorded in a {@link UsageMeter} (also for aborted calls).
 */
export interface MediaAiRequest<T> {
  /** short name for logs (`plan`, `reel 3`, `chapter 2`, `fox`) */
  label: string;
  system: string;
  /** user content blocks; `cache: true` puts a prompt-cache breakpoint after that block */
  blocks: { text: string; cache?: boolean }[];
  /** also cache the system prompt (it is the stable prefix shared by parallel calls) */
  cacheSystem?: boolean;
  schema: z.ZodType<T>;
  maxTokens: number;
  effort?: "low" | "medium" | "high";
  /** aborts this request (the job deadline, or a phase deadline) */
  signal: AbortSignal;
  /** called on the first stream event (the request is being answered: its cache entry is readable) */
  onFirstEvent?: () => void;
}

export type MediaAi = <T>(req: MediaAiRequest<T>) => Promise<T>;

/**
 * Models that take the server-side refusal fallback (`fallbacks: "default"`, claude-api skill). Not Sonnet 5: like the
 * question review (review.ts), a 400 there would fail every media call — a refusal there is simply `refusal`.
 */
const FALLBACK_MODELS = /^(claude-opus-5|claude-opus-5-5|claude-fable-5|claude-fable-5-1|claude-sonnet-5-5)$/;

const RAW_JSON = "Odpowiedz WYŁĄCZNIE jednym obiektem JSON zgodnym z opisanym schematem, bez komentarzy i bez bloków ```.";

export function parseJsonLoose(text: string): unknown {
  const candidates = [text, text.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/```[\s\S]*$/, ""), text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* next */
    }
  }
  return null;
}

/** A {@link MediaAi} over the Anthropic SDK (`client` defaults to the shared lazy client). */
export function anthropicMediaAi(opts: { model: string; meter: UsageMeter; client?: Anthropic }): MediaAi {
  const client = opts.client ?? getClient();
  const model = opts.model;
  const fallback = FALLBACK_MODELS.test(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {};

  async function once<T>(req: MediaAiRequest<T>, structured: boolean): Promise<T> {
    if (req.signal.aborted) throw new MediaError("timeout", `${req.label}: no time left`);
    const content: Anthropic.Beta.BetaContentBlockParam[] = req.blocks.map((b) => ({ type: "text" as const, text: b.text, ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}) }));
    if (!structured) content.push({ type: "text", text: RAW_JSON });
    let stream: ReturnType<typeof client.beta.messages.stream>;
    try {
      stream = client.beta.messages.stream(
        {
          model,
          max_tokens: req.maxTokens,
          ...fallback,
          thinking: { type: "adaptive" },
          output_config: structured ? { effort: req.effort ?? "medium", format: betaZodOutputFormat(req.schema) } : { effort: req.effort ?? "medium" },
          system: [{ type: "text", text: req.system, ...(req.cacheSystem ? { cache_control: { type: "ephemeral" as const } } : {}) }],
          messages: [{ role: "user", content }],
        } as Anthropic.Beta.MessageCreateParamsStreaming,
        { signal: req.signal, maxRetries: 1 },
      );
    } catch (e) {
      throw mapError(e, req);
    }
    const observer = observeStream(stream);
    if (req.onFirstEvent) void observer.firstEvent.then(req.onFirstEvent);
    let msg: Anthropic.Beta.BetaMessage & { parsed_output?: unknown };
    try {
      msg = (await stream.finalMessage()) as typeof msg;
    } catch (e) {
      const last = observer.lastUsage();
      if (last) opts.meter.recordPartial("gen", last.usage, last.model || model);
      throw mapError(e, req);
    }
    opts.meter.record("gen", msg.usage, msg.model || model);
    if (msg.stop_reason === "refusal") throw new MediaError("refusal", `${req.label}: stop_reason refusal`);
    if (msg.stop_reason === "max_tokens") throw new MediaError("invalid_output", `${req.label}: max_tokens`);
    const text = msg.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const raw = msg.parsed_output ?? parseJsonLoose(text);
    const parsed = req.schema.safeParse(raw);
    if (!parsed.success) throw new MediaError("invalid_output", `${req.label}: output does not match the schema`);
    return parsed.data;
  }

  return async <T>(req: MediaAiRequest<T>): Promise<T> => {
    try {
      return await once(req, true);
    } catch (e) {
      // the API rejects a too large output grammar: same request without the format, JSON parsed from the text
      if (e instanceof MediaError && e.code === "ai_unavailable" && /grammar/i.test(e.detail)) return once(req, false);
      throw e;
    }
  };
}

function mapError(e: unknown, req: { label: string; signal: AbortSignal }): MediaError {
  if (e instanceof MediaError) return e;
  if (req.signal.aborted || e instanceof Anthropic.APIUserAbortError) return new MediaError("timeout", `${req.label}: deadline`);
  // unavailable (key, 429, 5xx, network) and our own request errors (a bad parameter, the grammar) alike: not the
  // user's fault, so the creation is given back (`classifyAiError` only adds the kind to the log line)
  return new MediaError("ai_unavailable", `${req.label}: ${classifyAiError(e) ?? "error"} ${describeAiError(e)}`);
}
