import {
  ReelSeriesPlanSchema,
  ReelStoryboardOutSchema,
  REEL_RATE,
  REEL_THUMBS,
  REEL_TYPE_LABELS,
  cleanText,
  feedExists,
  mediaPath,
  parseItemLabel,
  quizExists,
  sanitizeStoryboard,
  sceneTts,
  storyboardWords,
  topicDigest,
  topicLevels,
  topicName,
  topicPoints,
  type FeedRef,
  type MediaProgress,
  type QuizRef,
  type ReelEntry,
  type ReelSeriesPlan,
  type ReelsManifest,
  type ReelType,
  type Storyboard,
  type TopicPoint,
} from "@nauka/shared";
import type { Deadline } from "../deadline.js";
import type { MediaAi } from "./ai.js";
import { alignToWords } from "./align.js";
import { mapLimit, TtsError, type TtsFn, type TtsResult } from "./elevenlabs.js";
import { MediaError, asMediaError } from "./errors.js";
import { parseMp3 } from "./mp3.js";
import { REEL_PLAN_SYSTEM, reelPlanPrompt, reelStoryboardPrompt, reelStoryboardSystem } from "./prompts.js";

/**
 * Reel series job (plan §2.2), pure with injected dependencies: series plan (1 call) → storyboards (N parallel calls,
 * shared cached prefix) → narration (ElevenLabs with timestamps, 3 at a time) → files in Storage → manifest.
 * The caller (handlers.ts) reserves the creation before and finishes / releases / fails the `media` row after.
 */

/** Storyboards must be done this long before the job deadline (narration + upload need the rest). */
export const TTS_RESERVE_MS = 75_000;
export const TTS_CONCURRENCY = 3;
/** Narration of one reel sent to the TTS (eleven_v4 takes 10 000; one reel is 80–130 words). */
export const MAX_REEL_TTS_CHARS = 2000;
const MIN_WORDS = 50;
const MAX_WORDS = 180;
const MIN_SCENES = 4;

export interface PlannedReel {
  type: ReelType;
  title: string;
  pointIds: string[];
  quizRef: QuizRef;
  feedRef: FeedRef | null;
  angle: string;
}

export interface SeriesPlan {
  title: string;
  reels: PlannedReel[];
}

const refKey = (r: QuizRef) => `${r.level}#${r.index}`;

/**
 * Makes the AI's series plan usable (plan §2.2): one reel per requested type in request order (a missing type gets an
 * empty reel), only known point ids, an existing quiz item per reel that belongs to one of the reel's points and is
 * not used by another reel (otherwise the first unused quiz item of the reel's points, then of their levels, then of the
 * topic), an existing lesson part or one of the quiz item's level, and every point in at least one reel (uncovered
 * points go to the reel with the fewest). Single mode: points = [focus]. Never throws.
 */
export function repairSeriesPlan(plan: ReelSeriesPlan | null, ctx: { content: unknown; types: ReelType[]; focus: TopicPoint | null }): SeriesPlan {
  const points = topicPoints(ctx.content);
  const byId = new Map(points.map((p) => [p.id, p]));
  const levels = topicLevels(ctx.content);
  const allQuiz: QuizRef[] = levels.flatMap((l) => l.quiz.map((_, index) => ({ level: l.id, index })));
  const raw = plan?.reels ?? [];
  const reels: PlannedReel[] = ctx.types.map((type) => {
    const r = raw.find((x) => x.type === type) ?? null;
    const pointIds = ctx.focus ? [ctx.focus.id] : [...new Set((r?.points ?? []).map((p) => p.trim()).filter((p) => byId.has(p)))].slice(0, 6);
    const q = parseItemLabel(r?.quiz);
    const f = parseItemLabel(r?.feed);
    return {
      type,
      title: cleanText(r?.title, 60) || REEL_TYPE_LABELS[type].charAt(0) + REEL_TYPE_LABELS[type].slice(1).toLowerCase(),
      pointIds,
      quizRef: q && q.kind === "quiz" ? { level: q.level, index: q.index } : { level: "", index: -1 },
      feedRef: f && f.kind === "feed" && feedExists(ctx.content, { level: f.level, index: f.index }) ? { level: f.level, index: f.index } : null,
      angle: cleanText(r?.angle, 400),
    };
  });
  // coverage: every point in at least one reel (series only)
  if (!ctx.focus) {
    const covered = new Set(reels.flatMap((r) => r.pointIds));
    for (const p of points) {
      if (covered.has(p.id)) continue;
      const target = reels.reduce((a, b) => (b.pointIds.length < a.pointIds.length ? b : a));
      target.pointIds.push(p.id);
      covered.add(p.id);
    }
  }
  // quiz items: existing, of the reel's points, distinct
  const used = new Map<string, number>();
  const quizOf = (r: PlannedReel) =>
    r.pointIds.flatMap((id) => (byId.get(id)?.items ?? []).filter((i) => i.kind === "quiz").map((i) => ({ level: i.level, index: i.index })));
  for (const r of reels) {
    const own = quizOf(r);
    const ownKeys = new Set(own.map(refKey));
    const ok = quizExists(ctx.content, r.quizRef) && (!own.length || ownKeys.has(refKey(r.quizRef))) && !used.has(refKey(r.quizRef));
    if (!ok) {
      const lv = new Set(r.pointIds.flatMap((id) => byId.get(id)?.levels ?? []));
      const pick =
        own.find((x) => !used.has(refKey(x))) ??
        allQuiz.find((x) => lv.has(x.level) && !used.has(refKey(x))) ??
        allQuiz.find((x) => !used.has(refKey(x))) ??
        // fewer quiz items than reels: the least used one of the reel's points (or of the topic)
        [...(own.length ? own : allQuiz)].sort((a, b) => (used.get(refKey(a)) ?? 0) - (used.get(refKey(b)) ?? 0))[0];
      if (pick) r.quizRef = pick;
    }
    used.set(refKey(r.quizRef), (used.get(refKey(r.quizRef)) ?? 0) + 1);
    if (!r.feedRef && quizExists(ctx.content, r.quizRef) && feedExists(ctx.content, { level: r.quizRef.level, index: 0 })) r.feedRef = { level: r.quizRef.level, index: 0 };
  }
  const title = cleanText(plan?.seriesTitle, 60) || cleanText(topicName(ctx.content), 60) || "Rolki";
  return { title, reels };
}

export interface ReelsJobInput {
  mediaId: string;
  ownerId: string;
  content: unknown;
  stage: string;
  types: ReelType[];
  focusPointId?: string | null;
  topicId: string;
}

export interface ReelsJobDeps {
  ai: MediaAi;
  tts: TtsFn;
  voiceId: string;
  ttsModel: string;
  /** keep the [audio tags] in the narration (ELEVENLABS_REEL_TAGS) */
  tags: boolean;
  deadline: Deadline;
  upload: (path: string, body: Uint8Array | string, contentType: string) => Promise<void>;
  progress: (p: MediaProgress) => Promise<void>;
  /** what the job spent and wrote so far (read by the caller also when the job throws: cleanup, stats) */
  track: JobTrack;
  /**
   * The global TTS character budget (RPC tts_budget, backend/0010), asked before each reel's narration: true = the
   * characters are reserved (and already in tts_ledger), false = over today's budget → that reel is dropped. Without
   * it (tests) nothing is checked.
   */
  ttsBudget?: (chars: number) => Promise<boolean>;
  now?: () => number;
  log?: Pick<Console, "info" | "warn" | "error">;
}

export interface JobTrack {
  /** characters sent to the TTS (the media row's total) */
  ttsChars: number;
  /** of those, characters already written to tts_ledger by the budget check (finish / release add only the rest) */
  ttsLogged: number;
  /** a reel was dropped because the global TTS budget was spent */
  budgetRefused?: boolean;
  uploaded: string[];
}

export function newTrack(): JobTrack {
  return { ttsChars: 0, ttsLogged: 0, uploaded: [] };
}

interface Written {
  plan: PlannedReel;
  storyboard: Storyboard;
  title: string;
  tts: string;
}

/** A storyboard as returned by the AI → sanitized, checked, with the narration text for the TTS. */
export function checkStoryboard(json: string, opts: { tags: boolean }): { ok: true; storyboard: Storyboard; tts: string } | { ok: false; why: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    const s = json.indexOf("{");
    const e = json.lastIndexOf("}");
    try {
      raw = s >= 0 && e > s ? JSON.parse(json.slice(s, e + 1)) : null;
    } catch {
      raw = null;
    }
  }
  if (!raw) return { ok: false, why: "storyboard nie jest poprawnym JSON" };
  const sb = sanitizeStoryboard(raw);
  if (!sb) return { ok: false, why: "brak scen z narracją albo mniej niż 2 stacje" };
  if (sb.scenes.length < MIN_SCENES) return { ok: false, why: `za mało scen (${sb.scenes.length}, potrzeba 6–14)` };
  const words = storyboardWords(sb);
  if (words < MIN_WORDS) return { ok: false, why: `za krótka narracja (${words} słów, potrzeba 80–130)` };
  if (words > MAX_WORDS) return { ok: false, why: `za długa narracja (${words} słów, potrzeba 80–130)` };
  const tts = sb.scenes.map((s) => sceneTts(s.say, s.tts, { tags: opts.tags })).join("\n");
  if (tts.length > MAX_REEL_TTS_CHARS) return { ok: false, why: "narracja za długa dla lektora" };
  for (const s of sb.scenes) s.tts = sceneTts(s.say, s.tts, { tags: true });
  return { ok: true, storyboard: sb, tts };
}

/** Runs the whole reel job; throws a MediaError. */
export async function runReelsJob(input: ReelsJobInput, deps: ReelsJobDeps): Promise<ReelsManifest> {
  const log = deps.log ?? console;
  const now = deps.now ?? Date.now;
  const points = topicPoints(input.content);
  const focus = input.focusPointId ? (points.find((p) => p.id === input.focusPointId) ?? null) : null;
  if (input.focusPointId && !focus) throw new MediaError("invalid_output", `unknown point ${input.focusPointId}`);
  const single = !!focus;
  const digest = topicDigest(input.content, { stage: input.stage });
  const levels = topicLevels(input.content);
  const N = input.types.length;
  const track = deps.track;

  // 1) series plan
  await deps.progress({ step: "plan", done: 0, total: N });
  const planned = await deps.ai({
    label: "reels plan",
    system: REEL_PLAN_SYSTEM,
    blocks: [{ text: digest }, { text: reelPlanPrompt({ types: input.types, single: focus }) }],
    schema: ReelSeriesPlanSchema,
    maxTokens: 8000,
    effort: "low",
    signal: deps.deadline.signal,
  });
  const plan = repairSeriesPlan(planned, { content: input.content, types: input.types, focus });

  // 2) storyboards: the first call alone until it streams (prompt cache), then the rest; all bound to the script phase
  await deps.progress({ step: "script", done: 0, total: N });
  const phase = new AbortController();
  const onJobAbort = () => phase.abort();
  deps.deadline.signal.addEventListener("abort", onJobAbort, { once: true });
  const phaseTimer = setTimeout(() => phase.abort(), Math.max(0, deps.deadline.at - TTS_RESERVE_MS - now()));
  const system = reelStoryboardSystem();
  let done = 0;
  const write = async (r: PlannedReel, i: number, onFirst?: () => void): Promise<Written | null> => {
    const q = levels.find((l) => l.id === r.quizRef.level)?.quiz[r.quizRef.index];
    const brief = {
      seriesTitle: plan.title,
      n: i + 1,
      total: N,
      type: r.type,
      title: r.title,
      angle: r.angle,
      points: r.pointIds.map((id) => points.find((p) => p.id === id)).filter((p): p is TopicPoint => !!p),
      quiz: { q: q?.q ?? "", answer: q?.a[q.c] ?? "", e: q?.e ?? "" },
      others: plan.reels.filter((_, k) => k !== i).map((x) => x.title),
    };
    let retry: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (phase.signal.aborted) return null;
      try {
        const out = await deps.ai({
          label: `reel ${i + 1}`,
          system,
          cacheSystem: true,
          blocks: [{ text: digest, cache: true }, { text: reelStoryboardPrompt({ ...brief, retry }) }],
          schema: ReelStoryboardOutSchema,
          maxTokens: 24000,
          effort: "medium",
          signal: phase.signal,
          onFirstEvent: attempt === 0 ? onFirst : undefined,
        });
        const checked = checkStoryboard(out.storyboard, { tags: deps.tags });
        if (checked.ok) {
          done++;
          void deps.progress({ step: "script", done, total: N }).catch(() => undefined);
          return { plan: r, storyboard: checked.storyboard, title: cleanText(out.title, 60) || r.title, tts: checked.tts };
        }
        retry = checked.why;
        log.warn(`[media] reel ${i + 1}: invalid storyboard (${checked.why})${attempt === 0 ? " — asking once more" : " — dropped"}`);
      } catch (e) {
        const me = asMediaError(e);
        // a refusal or the AI being down fails the whole job; a timeout or bad output only loses this reel
        if (me.code === "refusal" || me.code === "ai_unavailable") {
          phase.abort(); // the job fails anyway: stop the other calls instead of paying for them
          throw me;
        }
        log.warn(`[media] reel ${i + 1}: ${me.code} ${me.detail}`);
        if (me.code === "timeout") return null;
        retry = me.detail;
      }
    }
    onFirst?.();
    return null;
  };
  let written: (Written | null)[];
  try {
    let firstStarted!: () => void;
    const started = new Promise<void>((r) => (firstStarted = r));
    const first = write(plan.reels[0]!, 0, firstStarted).finally(() => firstStarted());
    await Promise.race([started, new Promise((r) => setTimeout(r, 20_000))]);
    const rest = plan.reels.slice(1).map((r, k) => write(r, k + 1));
    written = await Promise.all([first, ...rest]);
  } finally {
    clearTimeout(phaseTimer);
    deps.deadline.signal.removeEventListener("abort", onJobAbort);
  }
  const ok = written.filter((w): w is Written => !!w);
  const need = single ? 1 : Math.min(3, N);
  if (ok.length < need) {
    if (deps.deadline.expired() || phase.signal.aborted) throw new MediaError("timeout", `${ok.length}/${N} storyboards before the deadline`);
    throw new MediaError("invalid_output", `${ok.length}/${N} valid storyboards`);
  }

  // 3) narration (3 at a time) + files
  await deps.progress({ step: "voice", done: 0, total: ok.length });
  let voiced = 0;
  const entries = await mapLimit(ok, TTS_CONCURRENCY, async (w, k): Promise<ReelEntry | null> => {
    const n = k + 1;
    let res: TtsResult;
    if (deps.ttsBudget) {
      let allowed: boolean;
      try {
        allowed = await deps.ttsBudget(w.tts.length);
      } catch (e) {
        throw new MediaError("tts_unavailable", `budget check: ${(e as Error)?.message ?? e}`);
      }
      if (!allowed) {
        track.budgetRefused = true;
        log.warn(`[media] reel ${n}: over the global TTS budget — dropped`);
        return null;
      }
      track.ttsLogged += w.tts.length;
    }
    try {
      track.ttsChars += w.tts.length;
      res = await deps.tts({ text: w.tts, voiceId: deps.voiceId, modelId: deps.ttsModel, signal: deps.deadline.signal });
    } catch (e) {
      if (e instanceof TtsError && e.code === "invalid_output") {
        log.warn(`[media] reel ${n}: TTS rejected the text (${e.detail}) — dropped`);
        return null;
      }
      if (e instanceof TtsError) throw new MediaError(e.code === "timeout" ? "timeout" : "tts_unavailable", e.detail);
      throw asMediaError(e, "tts_unavailable");
    }
    let duration: number;
    try {
      duration = parseMp3(res.audio).duration;
    } catch {
      throw new MediaError("tts_unavailable", `reel ${n}: the TTS answer is not MP3`);
    }
    const words = alignToWords(w.tts, res.alignment, res.normalizedAlignment, duration);
    const files = { storyboard: `r${n}.json`, audio: `r${n}.mp3`, words: `r${n}.words.json` };
    const storyboard: Storyboard = { ...w.storyboard, title: w.title, audio: { src: files.audio, words: files.words, rate: REEL_RATE } };
    try {
      for (const [file, body, type] of [
        [files.audio, res.audio, "audio/mpeg"],
        [files.words, JSON.stringify(words), "application/json"],
        [files.storyboard, JSON.stringify(storyboard), "application/json"],
      ] as const) {
        const path = mediaPath(input.ownerId, input.mediaId, file);
        track.uploaded.push(path);
        await deps.upload(path, body, type);
      }
    } catch (e) {
      throw new MediaError("storage_failed", (e as Error)?.message ?? String(e));
    }
    voiced++;
    void deps.progress({ step: "voice", done: voiced, total: ok.length }).catch(() => undefined);
    return {
      n,
      type: w.plan.type,
      title: w.title,
      durSec: Math.round((duration / REEL_RATE) * 10) / 10,
      pointIds: w.plan.pointIds,
      quizRef: w.plan.quizRef,
      feedRef: w.plan.feedRef,
      files,
      rate: REEL_RATE,
      thumb: REEL_THUMBS[k % REEL_THUMBS.length]!,
    };
  });
  const reels = entries.filter((e): e is ReelEntry => !!e);
  if (reels.length < need) throw new MediaError(track.budgetRefused ? "tts_budget" : "invalid_output", `${reels.length}/${N} reels with narration`);
  // renumber after drops (file names keep their original numbers, so they stay unique)
  reels.forEach((r, i) => (r.n = i + 1));
  await deps.progress({ step: "save", done: reels.length, total: reels.length });
  const allPoints = single ? [focus!.id] : points.map((p) => p.id);
  const covered = new Set(reels.flatMap((r) => r.pointIds));
  const manifest: ReelsManifest = {
    v: 1,
    kind: "reels",
    title: plan.title,
    topicId: input.topicId,
    coverage: { points: allPoints.length, covered: allPoints.filter((p) => covered.has(p)).length },
    reels,
  };
  return manifest;
}
