import type { UsageLike } from "./cost.js";

/**
 * One internal deadline for a whole generation (AUDYT P1-4).
 *
 * Vercel kills `/api/generate` after 300 s (maxDuration). Without our own clock a slow call (the SDK allows 10 min
 * per attempt and retries) ran past that: the function died, the `generations` row stayed `running` forever, Files
 * API uploads were not deleted and the client got an HTML 504. Now every AI request of a generation gets the same
 * AbortSignal, fired at request start + 270 s, and a retry budget that shrinks as the deadline nears — so the route
 * always has time to record the failure, clean up and answer with JSON.
 */
export const GENERATION_DEADLINE_MS = 270_000;
/** Retry an AI request at most once, and only while more than this is left before the deadline. */
export const RETRY_IF_LEFT_MS = 120_000;
/**
 * Latest moment after the request start at which a generation may still be charged (`reserve_generation`).
 * Cramfox (build 6 and 7) reads "no `generations` row 90 s after sending" as "the server never started"
 * (recoverJob → `not_started`: „Limit się nie zmienił”, then discard() deletes the materials and the new empty
 * subject). A later charge would be invisible to that check, and a deleted subject makes finish_generation fail
 * after the charge. The client's clock also counts the network and a cold start before our `startedAt`, so 75 s keeps a
 * ~15 s margin below its 90 s, and leaves the AI 195 s of the 270 s deadline.
 */
export const CHARGE_BY_MS = 75_000;
/**
 * Do not charge a generation when less than this is left for the AI part (slow downloads, PPTX parsing, Files API
 * upload, token count). Checked before the Files API upload and again right before the charge. = deadline − CHARGE_BY_MS.
 */
export const MIN_AI_TIME_MS = GENERATION_DEADLINE_MS - CHARGE_BY_MS;
/**
 * The answer must leave before Vercel kills the function (300 s, counted from the invocation — a cold start comes on
 * top of our `startedAt`). Work after the result (Files API cleanup, marking a failure) gets only what is left until
 * request start + this; the uploads expire on their own and the sweeper closes rows left `running`.
 */
export const RESPOND_BY_MS = 285_000;

export interface AiRequestOptions {
  signal: AbortSignal;
  maxRetries: number;
  /** per-attempt timeout (ms) = what is left before the deadline */
  timeout: number;
}

export class Deadline {
  readonly at: number;
  private readonly controller = new AbortController();
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly now: () => number;

  constructor(at: number, now: () => number = Date.now) {
    this.at = at;
    this.now = now;
    // a ref'd timer on purpose: a generation waiting only for a hung request must still wake up at the deadline
    // (every owner calls dispose() in a finally)
    this.timer = setTimeout(() => this.controller.abort(), Math.max(0, at - now()));
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /** ms left before the deadline (0 when passed) */
  left(): number {
    return Math.max(0, this.at - this.now());
  }

  expired(): boolean {
    return this.controller.signal.aborted || this.left() <= 0;
  }

  /** Options for one SDK request: the shared signal, a retry only when there is time for it, a timeout capped by the deadline. */
  requestOptions(extra: { maxRetries?: number; timeoutMs?: number } = {}): AiRequestOptions {
    const left = this.left();
    const retries = left > RETRY_IF_LEFT_MS ? 1 : 0;
    return {
      signal: this.signal,
      maxRetries: Math.min(retries, extra.maxRetries ?? retries),
      timeout: Math.max(1, Math.min(left, extra.timeoutMs ?? left)),
    };
  }

  dispose(): void {
    clearTimeout(this.timer);
  }
}

/** What {@link observeStream} learns from a Messages stream. */
export interface StreamObserver {
  /** resolves on the first stream event (the request is being answered — its prompt cache entry is readable) */
  firstEvent: Promise<void>;
  /** false when the stream object has no event API (test mocks): `firstEvent` then never resolves on its own */
  hasEvents: boolean;
  /** last usage snapshot seen on the stream (input tokens from message_start, running output tokens from message_delta) */
  lastUsage(): { usage: UsageLike; model: string | null } | null;
}

type Listener = (event: { type?: string } | undefined, snapshot: { usage?: UsageLike; model?: string } | undefined) => void;

/**
 * Watches a `client.beta.messages.stream(...)` object without consuming it: the first event (used to stagger
 * parallel calls so they read the prompt cache) and the running usage (used to cost aborted calls).
 */
export function observeStream(stream: unknown): StreamObserver {
  let resolveFirst!: () => void;
  const firstEvent = new Promise<void>((r) => (resolveFirst = r));
  let last: { usage: UsageLike; model: string | null } | null = null;
  const s = stream as { on?: (event: string, listener: Listener) => unknown } | null;
  const hasEvents = !!s && typeof s.on === "function";
  if (hasEvents) {
    s!.on!("streamEvent", (_event, snapshot) => {
      resolveFirst();
      if (snapshot?.usage) last = { usage: { ...snapshot.usage }, model: snapshot.model ?? null };
    });
  }
  return { firstEvent, hasEvents, lastUsage: () => last };
}

/** `p`'s value, or `undefined` when it does not settle within `ms` (a rejection still rejects). */
export function valueOrTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    const t = setTimeout(() => resolve(undefined), Math.max(0, ms));
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Resolves when `p` settles or after `ms`, whichever is first; never rejects. */
export function settledOrTimeout(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, Math.max(0, ms));
    p.then(
      () => {
        clearTimeout(t);
        resolve();
      },
      () => {
        clearTimeout(t);
        resolve();
      },
    );
  });
}
