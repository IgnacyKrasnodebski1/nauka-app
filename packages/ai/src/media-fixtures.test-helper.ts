/**
 * Test-only fixtures of the media tests: a topic with key points, synthetic MP3 frames, a fake TTS (character alignment
 * spread evenly over the audio), a fake MediaAi dispatching on the call's label, and an in-memory MediaDb. No network.
 * Not a test file itself (the runner only picks *.test.js).
 */
import { REEL_EXAMPLE, type MediaKind, type MediaProgress, type MediaRow, type PodcastChapter, type ChatQuota } from "@nauka/shared";
import type { MediaAi, MediaAiRequest } from "./media/ai.js";
import type { Alignment } from "./media/align.js";
import type { TtsFn, TtsRequest } from "./media/elevenlabs.js";
import type { ChapterClaim, MediaDb, MediaStats, ReserveChatResult, ReserveMediaResult } from "./media/handlers.js";

/* ------------------------------------------------------------------------------------------------ topic */

function level(id: string) {
  return {
    id,
    title: `Lekcja ${id}`,
    emoji: "📘",
    feed: [
      { title: "Część 1", body: `<p>Treść ${id} część 1.</p>` },
      { title: "Część 2", body: `<p>Treść ${id} część 2.</p>` },
    ],
    flashcards: [0, 1, 2, 3].map((i) => ({ t: `pojęcie ${id}.${i}`, d: `definicja ${i}` })),
    quiz: [0, 1, 2, 3, 4].map((i) => ({ q: `Pytanie ${id}.${i}?`, a: ["A", "B", "C"], c: 1, e: "Bo B." })),
    tasks: [{ type: "tf", statements: [{ s: "x", v: true }] }],
  };
}
const refs = (kind: string, lv: string, idx: number[]) => idx.map((index) => ({ kind, level: lv, index }));

/** 3 levels × (4 flashcards, 5 quiz, 1 task); 5 key points p1…p5. */
export function topicContent(): Record<string, unknown> {
  return {
    name: "MSGiP — wykład 1",
    levels: [level("l1"), level("l2"), level("l3")],
    keyPoints: [
      { id: "p1", title: "MSG a MSP", short: "MSG a MSP", levels: ["l1"], items: [...refs("flashcard", "l1", [0, 1]), ...refs("quiz", "l1", [0, 1, 2])] },
      { id: "p2", title: "Globalizacja", short: "Globalizacja", levels: ["l1"], items: [...refs("flashcard", "l1", [2, 3]), ...refs("quiz", "l1", [3, 4]), ...refs("task", "l1", [0])] },
      { id: "p3", title: "MFW", short: "MFW", levels: ["l2"], items: [...refs("flashcard", "l2", [0, 1, 2, 3]), ...refs("quiz", "l2", [0, 1, 2, 3, 4])] },
      { id: "p4", title: "Bank Światowy", short: "Bank Światowy", levels: ["l3"], items: [...refs("flashcard", "l3", [0, 1]), ...refs("quiz", "l3", [0, 1])] },
      { id: "p5", title: "WTO", short: "WTO", levels: ["l3"], items: [...refs("flashcard", "l3", [2, 3]), ...refs("quiz", "l3", [2, 3, 4])] },
    ],
  };
}

/** A topic with 9 key points (one per level for 9 levels) — for the 8-chapter podcast. */
export function bigTopicContent(): Record<string, unknown> {
  const levels = Array.from({ length: 9 }, (_, i) => level(`l${i + 1}`));
  return { name: "Duży materiał", levels, keyPoints: levels.map((l, i) => ({ id: `p${i + 1}`, title: `Punkt ${i + 1}`, short: `P${i + 1}`, levels: [l.id], items: [...refs("flashcard", l.id, [0, 1, 2, 3]), ...refs("quiz", l.id, [0, 1, 2, 3, 4])] })) };
}

/* -------------------------------------------------------------------------------------------------- mp3 */

/** One MPEG-1 Layer III frame header: 44.1 kHz, 64 kbps, mono, no CRC → 208-byte frames of 1152 samples. */
export const FRAME_BYTES = 208;
export const FRAME_SEC = 1152 / 44100;

export function mp3Frames(n: number, opts: { id3?: boolean; info?: boolean; tag?: boolean; garbage?: boolean } = {}): Uint8Array {
  const parts: number[] = [];
  if (opts.id3) {
    const body = Array.from({ length: 300 }, (_, i) => (i % 7 === 0 ? 0xff : 0x41)); // stray 0xFF bytes inside the tag
    const size = body.length;
    parts.push(0x49, 0x44, 0x33, 4, 0, 0, (size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f, ...body);
  }
  if (opts.garbage) parts.push(0x00, 0xff, 0xe0, 0x12, 0x00);
  const frame = (info: boolean) => {
    const f = new Array<number>(FRAME_BYTES).fill(0);
    f[0] = 0xff;
    f[1] = 0xfb;
    f[2] = 0x50;
    f[3] = 0xc4;
    if (info) "Info".split("").forEach((c, i) => (f[4 + 17 + i] = c.charCodeAt(0)));
    return f;
  };
  if (opts.info) parts.push(...frame(true));
  for (let i = 0; i < n; i++) parts.push(...frame(false));
  if (opts.tag) parts.push(0x54, 0x41, 0x47, ...new Array<number>(125).fill(0x20));
  return new Uint8Array(parts);
}

/** Character alignment of `text` spread evenly over `seconds`. */
export function evenAlignment(text: string, seconds: number): Alignment {
  const chars = [...text];
  const step = seconds / Math.max(1, chars.length);
  return {
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => Math.round(i * step * 1000) / 1000),
    character_end_times_seconds: chars.map((_, i) => Math.round((i + 1) * step * 1000) / 1000),
  };
}

/** Fake ElevenLabs: ~1 frame per 2 characters, exact alignment; `fail(req)` may throw instead. */
export function fakeTts(fail?: (req: TtsRequest, call: number) => void): TtsFn & { calls: TtsRequest[] } {
  const calls: TtsRequest[] = [];
  const fn = (async (req: TtsRequest) => {
    calls.push(req);
    fail?.(req, calls.length);
    const frames = Math.max(4, Math.ceil(req.text.length / 2));
    return { audio: mp3Frames(frames, { id3: true }), alignment: evenAlignment(req.text, frames * FRAME_SEC), normalizedAlignment: null, chars: req.text.length };
  }) as TtsFn & { calls: TtsRequest[] };
  fn.calls = calls;
  return fn;
}

/* --------------------------------------------------------------------------------------------- fake AI */

export type AiHandler = (req: MediaAiRequest<unknown>, call: number) => unknown;

/** A MediaAi answering with `handler(req)` (validated by the request's schema, like the real one). */
export function fakeAi(handler: AiHandler): MediaAi & { calls: MediaAiRequest<unknown>[] } {
  const calls: MediaAiRequest<unknown>[] = [];
  const fn = (async <T>(req: MediaAiRequest<T>): Promise<T> => {
    calls.push(req as MediaAiRequest<unknown>);
    req.onFirstEvent?.();
    const out = await handler(req as MediaAiRequest<unknown>, calls.length);
    return req.schema.parse(out);
  }) as MediaAi & { calls: MediaAiRequest<unknown>[] };
  fn.calls = calls;
  return fn;
}

/** A storyboard answer built from the example (valid: 6 scenes, ~100 words). */
export function exampleStoryboardOut(title = "Rolka testowa") {
  return { title, storyboard: REEL_EXAMPLE };
}

export function planOut(types: string[]) {
  const quiz = ["l1#q0", "l1#q3", "l2#q0", "l3#q0", "l3#q2", "l2#q1"];
  const points = [["p1"], ["p2"], ["p3"], ["p4"], ["p5"], ["p3"]];
  return { seriesTitle: "Kto rządzi światową gospodarką?", reels: types.map((type, i) => ({ type, title: `Rolka ${i + 1}`, points: points[i]!, quiz: quiz[i]!, feed: "l1#f0", angle: "hak" })) };
}

/** A chapter dialogue of `lines` lines (alternating, ~20 words each), the Szop's mistake at line 9. */
export function chapterOut(lines = 22, pauseAfter = 9) {
  return {
    lines: Array.from({ length: lines }, (_, i) => ({ s: (i % 2 === 0 ? "lis" : "szop") as "lis" | "szop", t: `Kwestia ${i + 1}: to jest **pojęcie** i jeszcze kilka słów, żeby rozmowa miała sensowną długość dla słuchacza w podcaście.` })),
    pauseAfter,
  };
}

export function outlineOut(n: number, pointsPer: (i: number) => string[] = (i) => [`p${i + 1}`]) {
  return {
    title: "Kto naprawdę rządzi gospodarką świata?",
    chapters: Array.from({ length: n }, (_, i) => ({ title: `Rozdział ${i + 1}`, points: pointsPer(i), levels: [`l${i + 1}`], quiz: `l${i + 1}#q2`, szopMistake: "Szop myli pojęcia", lead: "Szop twierdzi, że…" })),
  };
}

/* ------------------------------------------------------------------------------------------- fake db */

export interface FakeDb extends MediaDb {
  rows: Map<string, MediaRow>;
  files: Map<string, Uint8Array | string>;
  log: string[];
  reserveWith?: (a: Parameters<MediaDb["reserve"]>[0]) => ReserveMediaResult | Promise<ReserveMediaResult>;
  topics: Map<string, { id: string; subjectId: string; name: string; stage: string; content: unknown }>;
  claimWith?: ChapterClaim;
  budget: boolean;
  chat: ReserveChatResult;
  chatQuotaValue: ChatQuota | null;
  progressLog: MediaProgress[];
  released: { id: string; reason: string; stats: MediaStats }[];
  failed: { id: string; reason: string }[];
  finished: { id: string; manifest: unknown; stats: MediaStats }[];
  /** finish_media's answer (false: the row is gone or no longer running) */
  finishOk: boolean;
  /** budget answers in order (then `budget`) */
  budgetSeq: boolean[];
  /** characters reserved / given back */
  budgeted: number[];
  refunds: number[];
  /** releaseChapter calls with `failed` */
  chapterFails: number;
}

export const USER = "11111111-1111-4111-8111-111111111111";
export const OTHER = "22222222-2222-4222-8222-222222222222";
export const SUBJECT = "33333333-3333-4333-8333-333333333333";
export const TOPIC = "44444444-4444-4444-8444-444444444444";

export function mediaRow(over: Partial<MediaRow> & { id: string; kind: MediaKind }): MediaRow {
  return {
    owner_id: USER,
    subject_id: SUBJECT,
    topic_id: TOPIC,
    status: "running",
    phase: "plan",
    progress: { step: "plan", done: 0, total: 3 },
    title: null,
    spec: {},
    manifest: null,
    error: null,
    charged: true,
    created_at: new Date().toISOString(),
    finished_at: null,
    ...over,
  };
}

export function fakeDb(over: Partial<FakeDb> = {}): FakeDb {
  const db: FakeDb = {
    rows: new Map(),
    files: new Map(),
    log: [],
    topics: new Map([[TOPIC, { id: TOPIC, subjectId: SUBJECT, name: "Wykład 1", stage: "studia", content: topicContent() }]]),
    budget: true,
    chat: { ok: true, quota: { day: "2026-10-22", used: 1, limit: 30, remaining: 29 } },
    chatQuotaValue: { day: "2026-10-22", used: 0, limit: 30, remaining: 30, globalOpen: true },
    progressLog: [],
    released: [],
    failed: [],
    finished: [],
    finishOk: true,
    budgetSeq: [],
    budgeted: [],
    refunds: [],
    chapterFails: 0,
    async findMedia(id) {
      db.log.push(`findMedia ${id}`);
      return db.rows.get(id) ?? null;
    },
    async loadTopic(id) {
      db.log.push("loadTopic");
      return db.topics.get(id) ?? null;
    },
    async reserve(a) {
      db.log.push(`reserve ${a.kind}`);
      if (db.reserveWith) return db.reserveWith(a);
      const media = mediaRow({ id: a.id, kind: a.kind, spec: a.spec, progress: a.progress });
      db.rows.set(a.id, media);
      return { ok: true, media };
    },
    async progress(id, p) {
      db.progressLog.push(p);
      const r = db.rows.get(id);
      if (r) r.progress = p;
    },
    async finish(id, manifest, stats) {
      db.log.push("finish");
      db.finished.push({ id, manifest, stats });
      if (!db.finishOk) return false;
      const r = db.rows.get(id);
      if (r) Object.assign(r, { status: "ready", manifest });
      return true;
    },
    async release(id, reason, stats) {
      db.log.push("release");
      db.released.push({ id, reason, stats });
      const r = db.rows.get(id);
      if (r) Object.assign(r, { status: "failed", charged: false, error: `released:${reason}` });
      return true;
    },
    async fail(id, reason) {
      db.log.push("fail");
      db.failed.push({ id, reason });
      const r = db.rows.get(id);
      if (r) Object.assign(r, { status: "failed", error: reason });
    },
    async upload(path, body) {
      db.files.set(path, body);
    },
    async download(path) {
      const f = db.files.get(path);
      if (f === undefined) throw new Error(`no file ${path}`);
      return typeof f === "string" ? new Uint8Array(Buffer.from(f)) : f;
    },
    async remove(paths) {
      db.log.push(`remove ${paths.length}`);
      for (const p of paths) db.files.delete(p);
    },
    async claimChapter(mediaId, n) {
      db.log.push(`claim ${n}`);
      if (db.claimWith) return db.claimWith;
      const ch = (db.rows.get(mediaId)?.manifest as { chapters: PodcastChapter[] } | null)?.chapters.find((c) => c.n === n);
      if (!ch) return "not_found";
      if (ch.status === "ready") return "ready";
      if (ch.status === "synth") return "busy";
      ch.status = "synth";
      return "claimed";
    },
    async setChapter(mediaId, n, patch) {
      db.log.push(`set ${n}`);
      const ch = (db.rows.get(mediaId)?.manifest as { chapters: PodcastChapter[] } | null)?.chapters.find((c) => c.n === n);
      if (!ch) return null;
      Object.assign(ch, patch);
      return { ...ch };
    },
    async releaseChapter(mediaId, n, failed) {
      db.log.push(`releaseChapter ${n}`);
      if (failed) db.chapterFails++;
      const ch = (db.rows.get(mediaId)?.manifest as { chapters: PodcastChapter[] } | null)?.chapters.find((c) => c.n === n);
      if (ch && ch.status === "synth") ch.status = "script";
    },
    async ttsBudget(chars) {
      db.log.push(`budget ${chars}`);
      const ok = db.budgetSeq.length ? db.budgetSeq.shift()! : db.budget;
      if (ok) db.budgeted.push(chars);
      return ok;
    },
    async ttsRefund(chars) {
      db.log.push(`refund ${chars}`);
      db.refunds.push(chars);
    },
    async loadSubjectTopics(subjectId, ids) {
      db.log.push("loadSubjectTopics");
      if (subjectId !== SUBJECT) return null;
      const topics = ids.map((id) => db.topics.get(id)).filter((t): t is NonNullable<typeof t> => !!t);
      return topics.length === ids.length ? { stage: "studia", topics: topics.map((t) => ({ id: t.id, name: t.name, content: t.content })) } : null;
    },
    async reserveChat() {
      db.log.push("reserveChat");
      return db.chat;
    },
    async releaseChat(day) {
      db.log.push(`releaseChat ${day}`);
    },
    async chatQuota() {
      return db.chatQuotaValue;
    },
    ...over,
  };
  return db;
}
