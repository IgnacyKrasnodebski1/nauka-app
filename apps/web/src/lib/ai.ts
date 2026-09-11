/**
 * AI entry point for route handlers — real implementation from `@nauka/ai` (Claude vision + structured outputs;
 * falls back to demo output by itself when ANTHROPIC_API_KEY is missing).
 * `./ai-stub` keeps the same surface and can be swapped in if packages/ai/dist is unavailable.
 */
export { generateSubject, tutorStream } from "@nauka/ai";
