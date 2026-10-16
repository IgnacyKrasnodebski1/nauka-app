/**
 * Test-only mock of the slice of the Anthropic client the generation uses — streams with events (so the
 * prompt-cache warm-up and the deadline can be exercised), a prompt-cache simulation, count_tokens and the Files API.
 * No network. Not a test file itself (the runner only picks *.test.js).
 */
import Anthropic from "@anthropic-ai/sdk";

export type Kind = "outline" | "core" | "tasks" | "review";
type Params = Anthropic.Beta.MessageCreateParams;
type Options = { signal?: AbortSignal; maxRetries?: number; timeout?: number };

export interface CallRecord {
  seq: number;
  kind: Kind;
  title: string;
  params: Params;
  options?: Options;
  /** how many calls had already emitted their first event when this one started */
  firstEventsBefore: number;
  cache: "write" | "read" | "none";
  aborted: boolean;
}

export interface Behavior {
  parsed?: unknown;
  stop_reason?: string;
  /** ms before the first stream event (message_start) */
  firstEventMs?: number;
  /** ms after the first event before the message completes */
  doneMs?: number;
  /** never completes on its own (only an abort ends it); still emits its first event */
  hang?: boolean;
  /** rejects with this error right away (before any event) */
  error?: unknown;
  model?: string;
  usage?: Record<string, unknown>;
  output_tokens?: number;
}

export const OUTLINE = {
  name: "Fotosynteza",
  short: "Fotosynteza",
  emoji: "🌿",
  tagline: "Jak rośliny robią cukier",
  category: "biologia",
  info_html: "",
  levels: [] as { title: string; emoji: string; summary: string; scope: string }[],
};

export function outlineWith(n: number) {
  return { ...OUTLINE, levels: Array.from({ length: n }, (_, i) => ({ title: `Poziom ${i + 1}`, emoji: "📘", summary: "", scope: `- pojęcie ${i + 1}: opis` })) };
}

export function coreLevel(title = "x") {
  return {
    feed: [{ title: `Chlorofil ${title}`, body: "<b>Chlorofil</b> pochłania światło czerwone i niebieskie.", real: "", mnemo: "" }],
    flashcards: [{ t: "chlorofil", d: "zielony barwnik" }],
    quiz: [{ q: "Co pochłania światło?", a: ["chlorofil", "skrobia", "glukoza", "celuloza"], c: 0, e: "Chlorofil to barwnik, który łapie światło.", src_page: 0, src_quote: "" }],
    games: [],
  };
}

const REVIEW_KEEP = { questions: [{ keep: true, drop: false, q: "", a: [], c: 0, e: "" }], feed: [{ keep_mnemo: true, keep_real: true }], tasks: [] };

function kindOf(params: Params): Kind {
  const fmt = params.output_config?.format as { schema?: { properties?: Record<string, unknown> } } | undefined;
  const props = Object.keys(fmt?.schema?.properties ?? {});
  const user = JSON.stringify(params.messages);
  if (props.includes("questions") || /Poziom do sprawdzenia/.test(user)) return "review";
  if (props.includes("info_html") || /FAZA 1/.test(user)) return "outline";
  if (props.includes("feed") || /bez tasks/.test(user)) return "core";
  return "tasks";
}

/** Prompt-cache key of a request: everything up to its last cache_control breakpoint + model + output format; null when uncached. */
function cacheKey(params: Params): string | null {
  const raw = params.messages[0]?.content;
  const content = (Array.isArray(raw) ? raw : []) as unknown as { cache_control?: unknown }[];
  const sys = (Array.isArray(params.system) ? params.system : []) as { cache_control?: unknown }[];
  let last = -1;
  content.forEach((b, i) => {
    if (b && typeof b === "object" && b.cache_control) last = i;
  });
  const sysCached = sys.some((b) => b.cache_control);
  if (last < 0 && !sysCached) return null;
  return JSON.stringify({ model: params.model, system: params.system, prefix: last >= 0 ? content.slice(0, last + 1) : [], format: params.output_config?.format ?? null });
}

export interface MockOptions {
  outlineLevels?: number;
  /** tokens of the cached prefix (system + materials) and of the rest of each prompt */
  prefixTokens?: number;
  restTokens?: number;
  behavior?: (kind: Kind, title: string, call: CallRecord) => Behavior | undefined;
  countTokens?: (params: unknown) => Promise<{ input_tokens: number }>;
  /** true: a plain Error; a function: the error to throw (e.g. an SDK APIError) */
  failUpload?: boolean | (() => unknown);
}

class FakeStream {
  private listeners: ((event: unknown, snapshot: unknown) => void)[] = [];
  readonly finished: Promise<unknown>;
  constructor(run: (emit: (snapshot: unknown) => void) => Promise<unknown>) {
    this.finished = run((snapshot) => {
      for (const l of this.listeners) l({ type: "message_start" }, snapshot);
    });
    this.finished.catch(() => undefined);
  }
  on(event: string, listener: (event: unknown, snapshot: unknown) => void) {
    if (event === "streamEvent") this.listeners.push(listener);
    return this;
  }
  finalMessage() {
    return this.finished;
  }
}

export function mockAi(opts: MockOptions = {}) {
  const calls: CallRecord[] = [];
  const cache = new Map<string, "writing" | "ready">();
  const uploads: string[] = [];
  const deleted: string[] = [];
  const counted: unknown[] = [];
  let firstEvents = 0;
  let seq = 0;
  const P = opts.prefixTokens ?? 10_000;
  const R = opts.restTokens ?? 100;
  const client = {
    files: {
      async upload(_p: unknown, _o?: Options) {
        if (opts.failUpload) throw typeof opts.failUpload === "function" ? opts.failUpload() : new Error("upload boom");
        const id = `file_${uploads.length + 1}`;
        uploads.push(id);
        return { id };
      },
      async delete(id: string) {
        deleted.push(id);
        return { id };
      },
    },
    beta: {
      messages: {
        async countTokens(params: unknown) {
          counted.push(params);
          if (opts.countTokens) return opts.countTokens(params);
          return { input_tokens: P + R };
        },
        stream(params: Params, options?: Options) {
          const kind = kindOf(params);
          const user = JSON.stringify(params.messages);
          const title = /Generujesz WYŁĄCZNIE poziom \d+ z \d+: „([^”]+)”/.exec(user)?.[1] ?? "";
          const key = cacheKey(params);
          const state = key ? cache.get(key) : undefined;
          const record: CallRecord = { seq: ++seq, kind, title, params, options, firstEventsBefore: firstEvents, cache: !key ? "none" : state === "ready" ? "read" : "write", aborted: false };
          calls.push(record);
          if (key && !state) cache.set(key, "writing");
          const b = opts.behavior?.(kind, title, record) ?? {};
          const model = b.model ?? (kind === "review" ? "claude-sonnet-5" : "claude-opus-5");
          const usage =
            b.usage ??
            (record.cache === "read"
              ? { input_tokens: R, cache_read_input_tokens: P, cache_creation_input_tokens: 0, output_tokens: b.output_tokens ?? 50 }
              : record.cache === "write"
                ? { input_tokens: R, cache_read_input_tokens: 0, cache_creation_input_tokens: P, output_tokens: b.output_tokens ?? 50 }
                : { input_tokens: kind === "review" ? 1000 : P + R, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: b.output_tokens ?? 50 });
          const parsed =
            b.parsed !== undefined ? b.parsed : kind === "outline" ? outlineWith(opts.outlineLevels ?? 3) : kind === "core" ? coreLevel(title) : kind === "tasks" ? { tasks: [] } : REVIEW_KEEP;
          const stop = b.stop_reason ?? "end_turn";
          return new FakeStream(
            (emit) =>
              new Promise((resolve, reject) => {
                const timers: ReturnType<typeof setTimeout>[] = [];
                const abort = () => {
                  record.aborted = true;
                  timers.forEach(clearTimeout);
                  reject(new Anthropic.APIUserAbortError());
                };
                if (options?.signal?.aborted) return abort();
                options?.signal?.addEventListener("abort", abort, { once: true });
                if (b.error) return reject(b.error);
                timers.push(
                  setTimeout(() => {
                    firstEvents++;
                    if (key) cache.set(key, "ready");
                    emit({ model, usage: { ...usage, output_tokens: 1 } });
                    if (b.hang) return;
                    timers.push(
                      setTimeout(() => {
                        options?.signal?.removeEventListener("abort", abort);
                        resolve({ id: `msg_${record.seq}`, type: "message", role: "assistant", model, stop_reason: stop, content: [{ type: "text", text: JSON.stringify(parsed) }], usage, parsed_output: stop === "end_turn" ? parsed : null });
                      }, b.doneMs ?? 5),
                    );
                  }, b.firstEventMs ?? 2),
                );
              }),
          );
        },
      },
    },
  };
  return { client: client as unknown as Anthropic, calls, uploads, deleted, counted };
}

/** Silences console.info / console.warn / console.error of the code under test; returns what was logged. */
export async function quiet<T>(f: () => Promise<T>): Promise<{ value: T; logs: string[] }> {
  const logs: string[] = [];
  const saved = { info: console.info, warn: console.warn, error: console.error };
  console.info = console.warn = console.error = (...a: unknown[]) => void logs.push(a.map(String).join(" "));
  try {
    return { value: await f(), logs };
  } finally {
    Object.assign(console, saved);
  }
}
