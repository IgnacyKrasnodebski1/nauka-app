import { validAlignment, type Alignment } from "./align.js";
import { scrubSecrets } from "./errors.js";

/**
 * ElevenLabs text-to-speech WITH TIMESTAMPS over REST (server only; the key never leaves the API).
 *
 *   POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_64
 *   header  xi-api-key: <ELEVENLABS_API_KEY>
 *   body    { text, model_id, language_code, apply_text_normalization: "auto" }
 *   200     { audio_base64, alignment: { characters, character_start_times_seconds, character_end_times_seconds },
 *             normalized_alignment: { …same } }
 *   422     validation error ({ detail: [{ loc, msg, type }] })
 * Docs (checked 2026-10-22):
 *   https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps  (endpoint, body, response fields)
 *   https://elevenlabs.io/docs/api-reference/authentication                          (`xi-api-key` header)
 *   https://elevenlabs.io/docs/models          (eleven_v4: 10 000 chars / request; eleven_flash_v2_5: 40 000; both Polish)
 *   https://elevenlabs.io/docs/eleven-api/resources/errors  (401 authentication_error, 402 payment_required /
 *                                              quota_exceeded, 429 rate_limit_exceeded / concurrent_limit_exceeded / system_busy)
 *
 * Error handling (plan §6.2): 401 / 403 / 402 / 404 (voice) and quota answers → `tts_unavailable` (no retry: our
 * configuration or account); 429 / 5xx / network → ONE internal retry, then `tts_unavailable`; 422 (and other 400) →
 * `invalid_output` (the text we sent); the caller's AbortSignal → `timeout`.
 */

export const ELEVEN_BASE_URL = "https://api.elevenlabs.io";
export const TTS_OUTPUT_FORMAT = "mp3_44100_64";

export type TtsErrorCode = "tts_unavailable" | "invalid_output" | "timeout";

export class TtsError extends Error {
  constructor(
    public readonly code: TtsErrorCode,
    public readonly detail: string,
    public readonly status?: number,
  ) {
    super(`${code}: ${detail}`);
  }
}

export interface TtsRequest {
  text: string;
  voiceId: string;
  modelId: string;
  /** ISO 639-1, default "pl" */
  languageCode?: string | null;
  signal?: AbortSignal;
}

export interface TtsResult {
  audio: Uint8Array;
  alignment: Alignment | null;
  normalizedAlignment: Alignment | null;
  /** characters billed for this request (= text length) */
  chars: number;
}

export type TtsFn = (req: TtsRequest) => Promise<TtsResult>;

export interface ElevenOptions {
  apiKey: string;
  fetch?: typeof fetch;
  baseUrl?: string;
  outputFormat?: string;
  /** delay before the one retry (ms), default 800 */
  retryDelayMs?: number;
}

const QUOTA_RE = /quota_exceeded|payment_required|insufficient|credits?|invalid_api_key|unusual_activity|detected_unusual|voice_not_found|subscription/i;

function bodyCode(body: unknown): string {
  const d = (body as { detail?: unknown } | null)?.detail;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const o = d as Record<string, unknown>;
    return [o.status, o.code, o.type, o.message].filter((x) => typeof x === "string").join(" ");
  }
  if (Array.isArray(d)) return d.map((x) => (x && typeof x === "object" ? String((x as { msg?: unknown }).msg ?? "") : "")).join("; ");
  return typeof d === "string" ? d : "";
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new TtsError("timeout", "aborted"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new TtsError("timeout", "aborted"));
      },
      { once: true },
    );
  });

/** A {@link TtsFn} calling ElevenLabs. */
export function elevenLabsTts(opts: ElevenOptions): TtsFn {
  const f = opts.fetch ?? fetch;
  const base = (opts.baseUrl ?? ELEVEN_BASE_URL).replace(/\/$/, "");
  const format = opts.outputFormat ?? TTS_OUTPUT_FORMAT;
  return async (req) => {
    if (!opts.apiKey) throw new TtsError("tts_unavailable", "no ELEVENLABS_API_KEY");
    if (!req.text.trim()) throw new TtsError("invalid_output", "empty text");
    const url = `${base}/v1/text-to-speech/${encodeURIComponent(req.voiceId)}/with-timestamps?output_format=${encodeURIComponent(format)}`;
    let lang: string | null = req.languageCode === undefined ? "pl" : req.languageCode;
    let retried = false;
    for (;;) {
      if (req.signal?.aborted) throw new TtsError("timeout", "aborted before the request");
      const body: Record<string, unknown> = { text: req.text, model_id: req.modelId, apply_text_normalization: "auto" };
      if (lang) body.language_code = lang;
      let res: Response;
      try {
        res = await f(url, {
          method: "POST",
          headers: { "xi-api-key": opts.apiKey, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
          signal: req.signal,
        });
      } catch (e) {
        if (req.signal?.aborted) throw new TtsError("timeout", "aborted");
        if (!retried) {
          retried = true;
          await sleep(opts.retryDelayMs ?? 800, req.signal);
          continue;
        }
        throw new TtsError("tts_unavailable", scrubSecrets(`network: ${(e as Error)?.message ?? e}`));
      }
      const rid = res.headers.get("request-id") ?? res.headers.get("x-request-id") ?? "";
      if (res.ok) {
        let json: { audio_base64?: unknown; alignment?: unknown; normalized_alignment?: unknown };
        try {
          json = (await res.json()) as typeof json;
        } catch (e) {
          if (req.signal?.aborted) throw new TtsError("timeout", "aborted while reading");
          throw new TtsError("tts_unavailable", `bad JSON from TTS${rid ? ` [${rid}]` : ""}`, res.status);
        }
        if (typeof json.audio_base64 !== "string" || !json.audio_base64) throw new TtsError("tts_unavailable", `no audio in the answer${rid ? ` [${rid}]` : ""}`, res.status);
        const audio = new Uint8Array(Buffer.from(json.audio_base64, "base64"));
        if (audio.length < 32) throw new TtsError("tts_unavailable", "audio too short", res.status);
        return {
          audio,
          alignment: validAlignment(json.alignment) ? json.alignment : null,
          normalizedAlignment: validAlignment(json.normalized_alignment) ? json.normalized_alignment : null,
          chars: req.text.length,
        };
      }
      let errBody: unknown = null;
      try {
        errBody = await res.json();
      } catch {
        /* not JSON */
      }
      const code = bodyCode(errBody);
      const detail = scrubSecrets(`${res.status}${code ? ` ${code}` : ""}${rid ? ` [${rid}]` : ""}`).slice(0, 300);
      // a model that does not take `language_code`: once more without it
      if ((res.status === 400 || res.status === 422) && lang && /language/i.test(code)) {
        lang = null;
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        if (!retried) {
          retried = true;
          const ra = Number(res.headers.get("retry-after"));
          await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 3000) : (opts.retryDelayMs ?? 800), req.signal);
          continue;
        }
        throw new TtsError("tts_unavailable", detail, res.status);
      }
      if (res.status === 401 || res.status === 402 || res.status === 403 || res.status === 404) throw new TtsError("tts_unavailable", detail, res.status);
      if (QUOTA_RE.test(code)) throw new TtsError("tts_unavailable", detail, res.status);
      throw new TtsError("invalid_output", detail, res.status);
    }
  };
}

/** Runs `fn` over `items` with at most `n` at a time; results in input order. Rejects with the first error. */
export async function mapLimit<T, R>(items: readonly T[], n: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  let failed: unknown = null;
  const worker = async () => {
    while (next < items.length && failed === null) {
      const i = next++;
      try {
        out[i] = await fn(items[i]!, i);
      } catch (e) {
        failed ??= e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, worker));
  if (failed !== null) throw failed;
  return out;
}
