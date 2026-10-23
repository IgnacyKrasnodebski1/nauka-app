/**
 * Failure codes of a reel / podcast job and of a podcast chapter (stored in `media.error` as `<code>:<detail>`).
 * Plan §2.2: every code except `refusal` is our side (the topic was already processed once) → the creation is given
 * back (`release_media`); `refusal` stays charged (`fail_media`).
 */
export type MediaErrorCode = "ai_unavailable" | "tts_unavailable" | "tts_budget" | "invalid_output" | "refusal" | "timeout" | "storage_failed";

export class MediaError extends Error {
  /** server-side detail for logs and `media.error` (no secrets) */
  readonly detail: string;
  constructor(
    public readonly code: MediaErrorCode,
    detail = "",
  ) {
    super(`${code}${detail ? `: ${detail}` : ""}`);
    this.detail = scrubSecrets(detail).slice(0, 200);
  }
}

/** Never let a key-shaped string reach a log line or `media.error`. */
export function scrubSecrets(s: string): string {
  return String(s ?? "")
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-***")
    .replace(/\bsk_[A-Za-z0-9_]{12,}/g, "sk_***")
    .replace(/\b(xi-api-key|x-api-key|authorization|bearer|apikey|api_key)(["':=\s]+)(?!\*)[A-Za-z0-9._~+/=-]{12,}/gi, "$1$2***");
}

/** `media.error` value: `<code>:<detail ≤ 200>`. */
export function errorText(e: MediaError): string {
  return `${e.code}:${e.detail}`.slice(0, 220);
}

/** Any thrown value as a MediaError (unknown errors are our side: `ai_unavailable` unless told otherwise). */
export function asMediaError(e: unknown, fallback: MediaErrorCode = "ai_unavailable"): MediaError {
  if (e instanceof MediaError) return e;
  return new MediaError(fallback, (e as Error)?.message ?? String(e));
}
