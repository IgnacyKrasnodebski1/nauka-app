import { z } from "zod";
import {
  REEL_TYPES,
  mediaPath,
  parseChatQuota,
  parseMediaQuota,
  quizCount,
  topicPoints,
  type ChatQuota,
  type FoxResponse,
  type MediaFeatures,
  type MediaKind,
  type MediaProgress,
  type MediaQuota,
  type MediaRow,
  type PodcastChapter,
  type PodcastManifest,
  type PodcastScript,
  type ReelType,
} from "@nauka/shared";
import { UsageMeter } from "../cost.js";
import { Deadline, GENERATION_DEADLINE_MS, settledOrTimeout } from "../deadline.js";
import type { MediaAi } from "./ai.js";
import { chapterChars, sayable, synthesizeChapter } from "./chapter.js";
import type { MediaConfig } from "./config.js";
import type { TtsFn } from "./elevenlabs.js";
import { MediaError, asMediaError, errorText } from "./errors.js";
import { composeFox, FoxBodySchema, FOX_POINT_ID_RE, foxPlan, localEnd, runFoxTurn, type FoxTopic } from "./fox.js";
import { chapterTarget, runPodcastJob } from "./podcast.js";
import { newTrack, runReelsJob } from "./reels.js";

/**
 * The media and fox endpoints after the route has read the body, without any Supabase code (the route injects it), so
 * the whole sequence — config checks, auth, validation, idempotency, ownership, the charge, the work in `after()` and
 * finish / release / fail — is testable with mocks (plan §2.2–2.7, like pipeline.ts for /api/generate).
 *
 * Every error answer: `{ error: <Polish, may be shown>, code, ...extra }`; errors of the creation endpoints also say
 * `charged: false` (nothing is ever charged before the 202).
 */

/* ------------------------------------------------------------------------------------------------ types */

/** The RPCs of backend/0010 are missing (database without the migration) → 503 `media_unavailable`. */
export class RpcMissingError extends Error {}

export interface MediaStats {
  model: string;
  cost_usd: number;
  /** characters sent to the TTS (the media row's total) */
  tts_chars: number;
  /** of those, characters already in tts_ledger (reserved by tts_budget before each reel) — finish / release add the rest */
  tts_logged: number;
}

export type MediaReject = "busy" | "lifetime" | "month" | "daily" | "global" | "conflict" | "not_found";
export type ReserveMediaResult =
  | { ok: true; media: MediaRow; existing?: boolean }
  | { ok: false; reason: MediaReject; busy?: { id: string; kind: MediaKind; topicId: string | null } | null; used?: number; limit?: number; scope?: "lifetime" | "month" };

/** `failing`: 3 failed recordings of this chapter today (backend/0010) — no more paid tries until tomorrow. */
export type ChapterClaim = "claimed" | "ready" | "busy" | "not_found" | "not_ready" | "failing";
export type ReserveChatResult = { ok: true; quota: ChatQuota } | { ok: false; reason: "chat_daily" | "chat_global"; used: number; limit: number };

export interface LoadedTopic {
  id: string;
  subjectId: string;
  name: string;
  stage: string;
  content: unknown;
}

/** Database and Storage access of one signed-in user (apps/web/src/lib/media-db.ts). */
export interface MediaDb {
  /** media row by id, any owner (service role) — for idempotency and ownership checks */
  findMedia(id: string): Promise<MediaRow | null>;
  /** a topic the user owns (user-scoped client, RLS), with its subject's stage */
  loadTopic(topicId: string): Promise<LoadedTopic | null>;
  /** RPC reserve_media */
  reserve(a: { id: string; subjectId: string; topicId: string; kind: MediaKind; spec: Record<string, unknown>; progress: MediaProgress }): Promise<ReserveMediaResult>;
  progress(id: string, p: MediaProgress): Promise<void>;
  /** RPC finish_media; false when the row is no longer running or is gone (material deleted during the job) */
  finish(id: string, manifest: unknown, stats: MediaStats): Promise<boolean>;
  /** RPC release_media (refund; by media_ledger alone when the row is gone); true when refunded (now or before) */
  release(id: string, reason: string, stats: MediaStats): Promise<boolean>;
  /** RPC fail_media (stays charged) */
  fail(id: string, reason: string, stats: MediaStats): Promise<void>;
  upload(path: string, body: Uint8Array | string, contentType: string): Promise<void>;
  download(path: string): Promise<Uint8Array>;
  remove(paths: string[]): Promise<void>;
  claimChapter(mediaId: string, n: number): Promise<ChapterClaim>;
  setChapter(mediaId: string, n: number, patch: Partial<PodcastChapter>): Promise<PodcastChapter | null>;
  /** the chapter back to `script`; `failed` counts a failed recording (3 a day → `failing`) */
  releaseChapter(mediaId: string, n: number, failed: boolean): Promise<void>;
  ttsBudget(chars: number, mediaId: string, kind: "reel" | "chapter"): Promise<boolean>;
  /** gives characters reserved by ttsBudget but never synthesized back to the global budget */
  ttsRefund(chars: number, mediaId: string, kind: "reel" | "chapter"): Promise<void>;
  /** the subject and these of its topics, owned by the user (RLS); null when any is missing */
  loadSubjectTopics(subjectId: string, topicIds: string[]): Promise<{ stage: string; topics: { id: string; name: string; content: unknown }[] } | null>;
  reserveChat(): Promise<ReserveChatResult>;
  releaseChat(day: string): Promise<void>;
  chatQuota(): Promise<ChatQuota | null>;
}

export interface MediaRequestEnv {
  config: MediaConfig;
  /** Supabase env + service role present */
  serverReady: boolean;
  /** parsed JSON body (undefined when it was not JSON) */
  body: unknown;
  /** Date.now() at the start of the HTTP request */
  startedAt: number;
  authenticate: () => Promise<{ userId: string; db: MediaDb } | null>;
  /** Next's `after()`: the job runs after the 202 */
  after: (job: () => Promise<void>) => void;
  makeAi: (o: { model: string; meter: UsageMeter }) => MediaAi;
  tts: TtsFn;
  now?: () => number;
  log?: Pick<Console, "info" | "warn" | "error">;
  /** tests: job deadline (default 270 s), chapter deadline (default 110 s), fox deadline (default 50 s) */
  deadlineMs?: number;
}

export interface HandlerResponse {
  status: number;
  body: Record<string, unknown>;
}

/* ----------------------------------------------------------------------------------------------- errors */

const MESSAGES: Record<string, string> = {
  no_config: "Serwer nie jest jeszcze skonfigurowany.",
  ai_unavailable: "Przygotowywanie chwilowo nie działa. Spróbuj za kilka minut.",
  tts_unavailable: "Lektor chwilowo nie działa. Spróbuj za kilka minut.",
  voices_missing: "Podcast będzie dostępny wkrótce.",
  unauthorized: "Wymagane logowanie",
  bad_request: "Nieprawidłowe dane żądania.",
  conflict: "Ten identyfikator żądania jest już zajęty.",
  not_found: "Nie znaleziono materiału.",
  no_quiz: "Ten materiał nie ma pytań, a każda rolka i pauza w podcaście kończy się pytaniem.",
  bad_point: "Nie znaleziono tego punktu w materiale.",
  busy: "Przygotowuję już coś innego. Gdy skończę, możesz zlecić kolejne.",
  limit_reached: "Rolek i podcastów na razie nie przygotujesz. Wszystko, co masz w tym przedmiocie, działa bez ograniczeń.",
  limit_daily: "Na dziś to wszystko, co mogę przygotować. Jutro możesz znowu.",
  limit_global: "Dziś przygotowuję bardzo dużo materiałów. Spróbuj jutro — nic nie zostało zużyte.",
  media_unavailable: "Rolki, podcast i rozmowa z lisem nie są jeszcze dostępne.",
  reserve_failed: "Serwer chwilowo nie działa. Nic nie zostało zużyte — spróbuj za kilka minut.",
  not_ready: "Podcast jeszcze się przygotowuje.",
  chapter_busy: "Nagrywam ten rozdział. Chwilę.",
  chapter_failing: "Tego rozdziału dziś nie nagram. Spróbuj jutro.",
  tts_budget: "Dziś nagrałem już bardzo dużo. Spróbuj jutro.",
  synth_failed: "Nie udało się nagrać rozdziału. Spróbuj ponownie.",
  fox_unavailable: "Lis chwilowo nie odpowiada. Spróbuj za chwilę.",
  fox_failed: "Lis zgubił wątek. Spróbuj wysłać jeszcze raz.",
  chat_daily: "Na dziś to wszystkie rozmowy. Jutro możesz znowu.",
  chat_global: "Lis ma dziś bardzo dużo rozmów. Spróbuj później.",
  too_many_turns: "Ta rozmowa już się skończyła.",
  bad_step: "Ten krok rozmowy nie pasuje do jej przebiegu.",
};

function err(status: number, code: string, extra: Record<string, unknown> = {}, message?: string): HandlerResponse {
  return { status, body: { error: message ?? MESSAGES[code] ?? "Błąd serwera", code, ...extra } };
}
const NC = { charged: false };
const zodMessage = (e: z.ZodError) => e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ").slice(0, 500);
const fail500 = (e: unknown, log: Pick<Console, "error">, where: string): HandlerResponse => {
  log.error(`[media] ${where}:`, (e as Error)?.message ?? e);
  return e instanceof RpcMissingError ? err(503, "media_unavailable", NC) : err(500, "reserve_failed", NC);
};

/* ------------------------------------------------------------------------------------------ request bodies */

const POINT_RAW = /^(p\d{1,2}|L[A-Za-z0-9_-]{1,40})$/;
export const ReelsBodySchema = z
  .object({
    requestId: z.uuid(),
    topicId: z.uuid(),
    types: z.array(z.enum(REEL_TYPES)).min(1).max(6),
    focusPointId: z.string().regex(POINT_RAW).nullish(),
  })
  .superRefine((b, ctx) => {
    if (new Set(b.types).size !== b.types.length) ctx.addIssue({ code: "custom", path: ["types"], message: "rodzaje rolek się powtarzają" });
    if (b.focusPointId && b.types.length !== 1) ctx.addIssue({ code: "custom", path: ["types"], message: "pojedyncza rolka (focusPointId) ma dokładnie jeden rodzaj" });
    if (!b.focusPointId && b.types.length < 3) ctx.addIssue({ code: "custom", path: ["types"], message: "seria ma od 3 do 6 rodzajów" });
  });
export const PodcastBodySchema = z.object({ requestId: z.uuid(), topicId: z.uuid() });
export const ChapterBodySchema = z.object({ mediaId: z.uuid(), chapter: z.number().int().min(1).max(20) });

/* ------------------------------------------------------------------------------------------ media creation */

export const REEL_DEADLINE_MS = GENERATION_DEADLINE_MS;
export const CHAPTER_DEADLINE_MS = 110_000;
export const FOX_DEADLINE_MS = 50_000;

/** `POST /api/media/reels` (plan §2.2). */
export async function handleReelsRequest(env: MediaRequestEnv): Promise<HandlerResponse> {
  if (!env.serverReady) return err(503, "no_config", NC);
  if (!env.config.ai) return err(503, "ai_unavailable", NC);
  if (!env.config.tts) return err(503, "tts_unavailable", NC);
  const user = await env.authenticate();
  if (!user) return err(401, "unauthorized", NC);
  const parsed = ReelsBodySchema.safeParse(env.body);
  if (!parsed.success) return err(400, "bad_request", NC, zodMessage(parsed.error));
  const b = parsed.data;
  return createMedia(env, user, "reels", { requestId: b.requestId, topicId: b.topicId, types: b.types, focusPointId: b.focusPointId ?? null });
}

/** `POST /api/media/podcast` (plan §2.3): voices are checked before auth (nothing to do without them). */
export async function handlePodcastRequest(env: MediaRequestEnv): Promise<HandlerResponse> {
  if (!env.serverReady) return err(503, "no_config", NC);
  if (!env.config.ai) return err(503, "ai_unavailable", NC);
  if (!env.config.tts) return err(503, "tts_unavailable", NC);
  if (!env.config.voices) return err(503, "voices_missing", NC);
  const user = await env.authenticate();
  if (!user) return err(401, "unauthorized", NC);
  const parsed = PodcastBodySchema.safeParse(env.body);
  if (!parsed.success) return err(400, "bad_request", NC, zodMessage(parsed.error));
  return createMedia(env, user, "podcast", { requestId: parsed.data.requestId, topicId: parsed.data.topicId, types: [], focusPointId: null });
}

async function createMedia(
  env: MediaRequestEnv,
  user: { userId: string; db: MediaDb },
  kind: MediaKind,
  b: { requestId: string; topicId: string; types: ReelType[]; focusPointId: string | null },
): Promise<HandlerResponse> {
  const log = env.log ?? console;
  const db = user.db;
  // idempotency: the requestId is the media row's id
  let existing: MediaRow | null;
  try {
    existing = await db.findMedia(b.requestId);
  } catch (e) {
    return fail500(e, log, "media read");
  }
  if (existing) return existing.owner_id === user.userId && existing.kind === kind ? { status: 200, body: { media: existing } } : err(409, "conflict", NC);
  let topic: LoadedTopic | null;
  try {
    topic = await db.loadTopic(b.topicId);
  } catch (e) {
    return fail500(e, log, "topic read");
  }
  if (!topic) return err(404, "not_found", NC);
  if (quizCount(topic.content) === 0) return err(400, "no_quiz", NC);
  const points = topicPoints(topic.content);
  if (b.focusPointId && !points.some((p) => p.id === b.focusPointId)) return err(400, "bad_point", NC);
  const spec: Record<string, unknown> = kind === "reels" ? { types: b.types, focusPointId: b.focusPointId } : {};
  const total = kind === "reels" ? b.types.length : chapterTarget(points.length);
  let r: ReserveMediaResult;
  try {
    r = await db.reserve({ id: b.requestId, subjectId: topic.subjectId, topicId: topic.id, kind, spec, progress: { step: "plan", done: 0, total } });
  } catch (e) {
    return fail500(e, log, "reserve_media");
  }
  if (!r.ok) {
    switch (r.reason) {
      case "busy":
        return err(409, "busy", { ...NC, busy: r.busy ?? null });
      case "lifetime":
      case "month":
        return err(402, "limit_reached", { ...NC, reason: r.reason, scope: r.reason === "month" ? "month" : "lifetime", used: r.used ?? r.limit ?? 0, limit: r.limit ?? 0 });
      case "daily":
        return err(402, "limit_reached", { ...NC, reason: "daily", ...(r.limit !== undefined ? { limit: r.limit } : {}) }, MESSAGES.limit_daily);
      case "global":
        return err(402, "limit_reached", { ...NC, reason: "global" }, MESSAGES.limit_global);
      case "conflict":
        return err(409, "conflict", NC);
      default:
        return err(404, "not_found", NC);
    }
  }
  if (r.existing) return { status: 200, body: { media: r.media } };
  const media = r.media;
  const loaded = topic;
  env.after(() => runMediaJob(env, user, kind, media, loaded, b));
  return { status: 202, body: { media } };
}

/** The work after the 202: the pipeline, then finish (ready) — or release (refund) / fail (refusal). Never throws. */
async function runMediaJob(
  env: MediaRequestEnv,
  user: { userId: string; db: MediaDb },
  kind: MediaKind,
  media: MediaRow,
  topic: LoadedTopic,
  b: { types: ReelType[]; focusPointId: string | null },
): Promise<void> {
  const log = env.log ?? console;
  const db = user.db;
  const deadline = new Deadline(env.startedAt + (env.deadlineMs ?? REEL_DEADLINE_MS), env.now);
  const meter = new UsageMeter();
  const model = env.config.mediaModel;
  const track = newTrack();
  const stats = (): MediaStats => ({ model, cost_usd: Math.min(meter.summary().costUsd, 9999.9999), tts_chars: track.ttsChars, tts_logged: track.ttsLogged });
  const progress = (p: MediaProgress) =>
    db.progress(media.id, p).catch((e: unknown) => {
      log.warn("[media] progress update failed", media.id, (e as Error)?.message ?? e);
    });
  const cleanup = () => (track.uploaded.length ? settledOrTimeout(db.remove(track.uploaded), 8000) : Promise.resolve());
  const startedAt = (env.now ?? Date.now)();
  try {
    const ai = env.makeAi({ model, meter });
    const common = { ai, deadline, upload: (p: string, body: Uint8Array | string, type: string) => db.upload(p, body, type), progress, track, now: env.now, log };
    const manifest =
      kind === "reels"
        ? await runReelsJob(
            { mediaId: media.id, ownerId: user.userId, topicId: topic.id, content: topic.content, stage: topic.stage, types: b.types, focusPointId: b.focusPointId },
            {
              ...common,
              tts: env.tts,
              voiceId: env.config.reelVoice,
              ttsModel: env.config.reelModel,
              tags: env.config.reelTags,
              // the global TTS budget before each reel's narration (eleven_v4 is the expensive one; review F3)
              ttsBudget: (chars: number) => db.ttsBudget(chars, media.id, "reel"),
            },
          )
        : await runPodcastJob({ mediaId: media.id, ownerId: user.userId, topicId: topic.id, content: topic.content, stage: topic.stage }, common);
    let finished = false;
    try {
      finished = await db.finish(media.id, manifest, stats());
    } catch (e) {
      log.error("[media] finish_media failed", media.id, (e as Error)?.message ?? e);
    }
    if (!finished) {
      // the row is no longer running (swept → already refunded), is gone (the material was deleted during the job) or
      // the write failed: the files are of no use; release refunds by media_ledger when the row is gone (idempotent
      // when the sweeper already did it), so the user never pays for a result they cannot get
      log.error("[media] job done but the row was not finished — files removed", media.id);
      await cleanup();
      await db
        .release(media.id, "not_finished:the row was gone or no longer running", stats())
        .catch((x: unknown) => log.error("[media] release_media failed", media.id, (x as Error)?.message ?? x));
      return;
    }
    log.info(`[media] ${kind} ready ${media.id} in ${Math.round(((env.now ?? Date.now)() - startedAt) / 1000)} s — ${JSON.stringify(stats())}`);
  } catch (e) {
    let me = asMediaError(e);
    if (deadline.expired() && me.code !== "refusal") me = new MediaError("timeout", me.detail || "deadline");
    log.error(`[media] ${kind} failed ${media.id}: ${me.code} ${me.detail}`);
    await cleanup();
    if (me.code === "refusal") {
      await db.fail(media.id, errorText(me), stats()).catch((x: unknown) => log.error("[media] fail_media failed", media.id, (x as Error)?.message ?? x));
      return;
    }
    // our side (AI or TTS unavailable, invalid output after one re-ask, the deadline, Storage): the creation comes back
    let released = false;
    try {
      released = await db.release(media.id, errorText(me), stats());
    } catch (x) {
      log.error("[media] release_media failed", media.id, (x as Error)?.message ?? x);
    }
    if (!released) await db.fail(media.id, errorText(me), stats()).catch((x: unknown) => log.error("[media] fail_media failed", media.id, (x as Error)?.message ?? x));
  } finally {
    deadline.dispose();
  }
}

/* --------------------------------------------------------------------------------------- podcast chapter */

/** `POST /api/media/podcast/chapter` (plan §2.4): synchronous, never charged to the user's pool. */
export async function handleChapterRequest(env: MediaRequestEnv): Promise<HandlerResponse> {
  const log = env.log ?? console;
  if (!env.serverReady) return err(503, "no_config");
  if (!env.config.tts) return err(503, "tts_unavailable");
  if (!env.config.voices) return err(503, "voices_missing");
  const user = await env.authenticate();
  if (!user) return err(401, "unauthorized");
  const parsed = ChapterBodySchema.safeParse(env.body);
  if (!parsed.success) return err(400, "bad_request", {}, zodMessage(parsed.error));
  const { mediaId, chapter: n } = parsed.data;
  const db = user.db;
  let media: MediaRow | null;
  try {
    media = await db.findMedia(mediaId);
  } catch (e) {
    return fail500(e, log, "media read");
  }
  const manifest = media?.manifest as PodcastManifest | null | undefined;
  if (!media || media.owner_id !== user.userId || media.kind !== "podcast") return err(404, "not_found");
  if (media.status !== "ready" || !manifest || manifest.kind !== "podcast") return err(409, "not_ready");
  if (!manifest.chapters.some((c) => c.n === n)) return err(404, "not_found");
  let claim: ChapterClaim;
  try {
    claim = await db.claimChapter(mediaId, n);
  } catch (e) {
    return fail500(e, log, "claim_podcast_chapter");
  }
  if (claim === "not_found") return err(404, "not_found");
  if (claim === "not_ready") return err(409, "not_ready");
  if (claim === "busy") return err(409, "chapter_busy");
  if (claim === "failing") return err(429, "chapter_failing");
  if (claim === "ready") {
    const fresh = await db.findMedia(mediaId).catch(() => null);
    const ch = (fresh?.manifest as PodcastManifest | null)?.chapters.find((c) => c.n === n) ?? manifest.chapters.find((c) => c.n === n)!;
    return { status: 200, body: { chapter: ch } };
  }
  // claimed: this request synthesizes the chapter
  const deadline = new Deadline(env.startedAt + (env.deadlineMs ?? CHAPTER_DEADLINE_MS), env.now);
  const releaseClaim = (failed: boolean) =>
    db.releaseChapter(mediaId, n, failed).catch((e: unknown) => {
      log.error("[media] release_podcast_chapter failed", mediaId, n, (e as Error)?.message ?? e);
    });
  const written: string[] = [];
  // characters reserved in the global budget and how many of them went to the TTS (the rest goes back on failure)
  let budgeted = 0;
  const spent = { chars: 0 };
  try {
    const raw = await db.download(mediaPath(media.owner_id, mediaId, manifest.files.script)).catch((e: unknown) => {
      throw new MediaError("storage_failed", (e as Error)?.message ?? String(e));
    });
    let script: PodcastScript;
    try {
      script = JSON.parse(Buffer.from(raw).toString("utf8")) as PodcastScript;
    } catch {
      throw new MediaError("storage_failed", "script.json is not JSON");
    }
    const lines = script.chapters?.find((c) => c.n === n)?.lines;
    if (!Array.isArray(lines) || !lines.length) throw new MediaError("invalid_output", `script has no chapter ${n}`);
    // a line with nothing to say would fail at the TTS after the other lines were paid for (review F4): refuse before
    // spending anything (counts as a failed recording, so it cannot be retried without end)
    const mute = lines.findIndex((l) => !sayable(l.t));
    if (mute >= 0) throw new MediaError("invalid_output", `chapter ${n} line ${mute} has nothing to say`);
    const meta = manifest.chapters.find((c) => c.n === n)!;
    const chars = chapterChars(lines);
    if (!(await db.ttsBudget(chars, mediaId, "chapter"))) {
      await releaseClaim(false);
      return err(429, "tts_budget");
    }
    budgeted = chars;
    const out = await synthesizeChapter(
      { lines, pauses: meta.pauses },
      { tts: env.tts, voices: { lis: env.config.foxVoice, szop: env.config.szopVoice }, modelId: env.config.podcastModel, signal: deadline.signal, spent },
    );
    const files = { audio: `c${n}.mp3`, timing: `c${n}.json` };
    try {
      for (const [file, body, type] of [
        [files.audio, out.audio, "audio/mpeg"],
        [files.timing, JSON.stringify(out.timing), "application/json"],
      ] as const) {
        const path = mediaPath(media.owner_id, mediaId, file);
        written.push(path);
        await db.upload(path, body, type);
      }
    } catch (e) {
      throw new MediaError("storage_failed", (e as Error)?.message ?? String(e));
    }
    const updated = await db.setChapter(mediaId, n, { status: "ready", durSec: Math.round(out.timing.duration * 10) / 10, files });
    if (!updated) throw new MediaError("storage_failed", "set_podcast_chapter returned nothing");
    log.info(`[media] podcast ${mediaId} chapter ${n} ready: ${out.chars} chars, ${Math.round(out.timing.duration)} s`);
    return { status: 200, body: { chapter: updated } };
  } catch (e) {
    let me = asMediaError(e, "tts_unavailable");
    if (deadline.expired()) me = new MediaError("timeout", me.detail);
    log.error(`[media] podcast ${mediaId} chapter ${n} failed: ${me.code} ${me.detail}`);
    // a failure counts toward the chapter's 3 a day when it cost characters or will fail the same way again
    await releaseClaim(spent.chars > 0 || me.code === "invalid_output");
    const unspent = Math.max(0, budgeted - spent.chars);
    if (unspent > 0)
      await db.ttsRefund(unspent, mediaId, "chapter").catch((x: unknown) => log.error("[media] tts_refund failed", mediaId, n, (x as Error)?.message ?? x));
    if (written.length) await settledOrTimeout(db.remove(written), 5000);
    return me.code === "tts_unavailable" || me.code === "timeout" || me.code === "ai_unavailable" ? err(503, "tts_unavailable") : err(500, "synth_failed");
  } finally {
    deadline.dispose();
  }
}

/* --------------------------------------------------------------------------------------------------- fox */

/** `POST /api/fox` (plan §2.6). */
export async function handleFoxRequest(env: MediaRequestEnv): Promise<HandlerResponse> {
  const log = env.log ?? console;
  if (!env.serverReady) return err(503, "no_config", NC);
  if (!env.config.ai) return err(503, "ai_unavailable", NC, MESSAGES.fox_unavailable);
  const user = await env.authenticate();
  if (!user) return err(401, "unauthorized", NC);
  const parsed = FoxBodySchema.safeParse(env.body);
  if (!parsed.success) return err(400, "bad_request", NC, zodMessage(parsed.error));
  const b = parsed.data;
  const plan = foxPlan(b.mode, b.step, b.messages);
  if (!plan.ok) return err(400, plan.code, NC, plan.message);
  const db = user.db;
  if (plan.plan.action.kind === "local_end") {
    const quota = await db.chatQuota().catch(() => null);
    return { status: 200, body: { ...localEnd(b.mode), quota } };
  }
  let loaded: Awaited<ReturnType<MediaDb["loadSubjectTopics"]>>;
  try {
    loaded = await db.loadSubjectTopics(b.subjectId, b.topicIds);
  } catch (e) {
    return fail500(e, log, "fox topics read");
  }
  if (!loaded) return err(404, "not_found", NC);
  const topics: FoxTopic[] = b.topicIds.map((id, i) => {
    const t = loaded!.topics.find((x) => x.id.toLowerCase() === id.toLowerCase())!;
    return { topicId: t.id, n: i + 1, name: t.name, content: t.content };
  });
  // every point must exist in its topic (before the charge)
  for (const pid of b.pointIds) {
    const m = FOX_POINT_ID_RE.exec(pid)!;
    const t = topics.find((x) => x.topicId.toLowerCase() === m[1]!.toLowerCase());
    if (!t || !topicPoints(t.content).some((p) => p.id === m[2])) return err(400, "bad_point", NC);
  }
  const pointIds = b.pointIds.map((pid) => {
    const m = FOX_POINT_ID_RE.exec(pid)!;
    return `${topics.find((x) => x.topicId.toLowerCase() === m[1]!.toLowerCase())!.topicId}:${m[2]}`;
  });
  let r: ReserveChatResult;
  try {
    r = await db.reserveChat();
  } catch (e) {
    return fail500(e, log, "reserve_chat");
  }
  if (!r.ok) return err(402, "limit_reached", { ...NC, reason: r.reason, used: r.used, limit: r.limit }, MESSAGES[r.reason]);
  const quota = r.quota;
  const deadline = new Deadline(env.startedAt + (env.deadlineMs ?? FOX_DEADLINE_MS), env.now);
  const meter = new UsageMeter();
  try {
    const out = await runFoxTurn({
      ai: env.makeAi({ model: env.config.foxModel, meter }),
      mode: b.mode,
      plan: plan.plan,
      topics,
      pointIds,
      messages: b.messages,
      stage: loaded.stage,
      signal: deadline.signal,
    });
    const body: FoxResponse = { ...composeFox(plan.plan, out, { mode: b.mode, topics, pointIds }), quota };
    return { status: 200, body: body as unknown as Record<string, unknown> };
  } catch (e) {
    const me = asMediaError(e);
    log.error(`[fox] ${b.mode}/${b.step} failed: ${me.code} ${me.detail} (cost ${meter.summary().costUsd} USD)`);
    await db.releaseChat(quota.day).catch((x: unknown) => log.error("[fox] release_chat failed", (x as Error)?.message ?? x));
    return me.code === "ai_unavailable" || me.code === "timeout" ? err(503, "ai_unavailable", NC, MESSAGES.fox_unavailable) : err(500, "fox_failed", NC);
  } finally {
    deadline.dispose();
  }
}

/* -------------------------------------------------------------------------------------------- /api/me */

/**
 * The additive `media`, `chat` and `features` fields of `GET /api/me` (plan §2.7). Without backend/0010 (an RPC fails)
 * `media` / `chat` are null and the matching features are off — the app then hides creation and the fox.
 */
export async function buildMeMedia(deps: {
  config: MediaConfig;
  mediaQuota: (() => Promise<unknown>) | null;
  chatQuota: (() => Promise<unknown>) | null;
  log?: Pick<Console, "warn">;
}): Promise<{ media: MediaQuota | null; chat: ChatQuota | null; features: MediaFeatures }> {
  const log = deps.log ?? console;
  const read = async <T>(f: (() => Promise<unknown>) | null, parse: (raw: unknown) => T | null, name: string): Promise<T | null> => {
    if (!f) return null;
    try {
      const v = parse(await f());
      if (!v) log.warn(`[me] ${name}: unexpected answer`);
      return v;
    } catch (e) {
      log.warn(`[me] ${name} unavailable:`, (e as Error)?.message ?? e);
      return null;
    }
  };
  const [media, chat] = await Promise.all([read(deps.mediaQuota, parseMediaQuota, "media_quota"), read(deps.chatQuota, parseChatQuota, "chat_quota")]);
  const reels = deps.config.ai && deps.config.tts && !!media;
  return { media, chat, features: { reels, podcast: reels && deps.config.voices, fox: deps.config.ai && !!chat } };
}
