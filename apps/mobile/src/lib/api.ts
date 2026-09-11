import type { GenerationOptions, Plan, PLANS, Stage, Topic } from "@nauka/shared";
import { rowToTopic, type TopicRow } from "./data";
import { ENV, hasApi } from "./env";

/** Klient API weba (apps/web) — patrz docs/API.md. Wszystko z Bearer tokenem Supabase. */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

function url(path: string): string {
  if (!hasApi) throw new ApiError("Brak EXPO_PUBLIC_API_URL — API weba nie jest skonfigurowane.", 0, "no_api");
  return `${ENV.apiUrl}${path}`;
}

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url(path), {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let body: { error?: string; code?: string; [k: string]: unknown } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      /* not json */
    }
    throw new ApiError(body.error ?? `Błąd API (${res.status})`, res.status, body.code, body);
  }
  return (await res.json()) as T;
}

export interface MeResponse {
  profile: { id: string; email: string | null; display_name: string | null; stage: Stage; plan: Plan } | null;
  plan: Plan;
  usage: { month: string; generations: number; tutorMessages: number };
  limits: (typeof PLANS)[Plan];
  subscription: { status: string | null; interval: string | null; current_period_end: string | null; cancel_at_period_end: boolean } | null;
}

export function getMe(token: string): Promise<MeResponse> {
  return request<MeResponse>("/api/me", token);
}

export interface GenerateBody {
  subjectId: string;
  materialIds?: string[];
  text?: string;
  options: GenerationOptions;
}

/** POST /api/generate → nowy temat w przedmiocie. API może zwrócić wiersz DB (`content`) albo gotowy `Topic`. */
export async function generate(token: string, body: GenerateBody): Promise<{ generationId: string; topicId: string; topic: Topic | null }> {
  const r = await request<{ generationId: string; topicId: string; topic?: TopicRow | Topic }>("/api/generate", token, { method: "POST", body: JSON.stringify(body) });
  let topic: Topic | null = null;
  if (r.topic) topic = "content" in r.topic && typeof r.topic.content === "object" ? rowToTopic(r.topic as TopicRow) : (r.topic as Topic);
  return { generationId: r.generationId, topicId: r.topicId, topic };
}

export function generationStatus(token: string, id: string): Promise<{ status: string; topicId?: string; error?: string }> {
  return request(`/api/generate?id=${encodeURIComponent(id)}`, token);
}

export function stripeCheckout(token: string, interval: "month" | "year"): Promise<{ url: string }> {
  return request<{ url: string }>("/api/stripe/checkout", token, { method: "POST", body: JSON.stringify({ interval, platform: "mobile" }) });
}

export function stripePortal(token: string): Promise<{ url: string }> {
  return request<{ url: string }>("/api/stripe/portal", token, { method: "POST", body: "{}" });
}

export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Tutor: `text/plain` streamowany. RN fetch nie zawsze wystawia `body.getReader()` — wtedy czytamy całość.
 * `onChunk` dostaje kolejne fragmenty; zwraca pełny tekst.
 */
export async function tutorAsk(
  token: string,
  body: { topicId: string; levelId: string; question: string; history: TutorMessage[] },
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(url("/api/tutor"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, Accept: "text/plain" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let msg = `Błąd tutora (${res.status})`;
    let code: string | undefined;
    try {
      const j = (await res.json()) as { error?: string; code?: string };
      msg = j.error ?? msg;
      code = j.code;
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status, code);
  }
  const reader = (res.body as ReadableStream<Uint8Array> | null | undefined)?.getReader?.();
  if (reader) {
    const dec = new TextDecoder();
    let full = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = dec.decode(value, { stream: true });
      full += chunk;
      onChunk?.(full);
    }
    return full;
  }
  const text = await res.text();
  onChunk?.(text);
  return text;
}
