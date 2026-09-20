import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/** True when a real API key (or an `ant auth` profile via env token) is configured. */
export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ timeout: 10 * 60 * 1000, maxRetries: 2 });
  }
  return _client;
}

/** Model used for generation & tutor. Override with RECALL_AI_MODEL (legacy alias NAUKA_AI_MODEL). */
export function modelId(): string {
  return process.env.RECALL_AI_MODEL || process.env.NAUKA_AI_MODEL || "claude-opus-5";
}
