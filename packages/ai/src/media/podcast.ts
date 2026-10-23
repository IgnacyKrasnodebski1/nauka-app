import {
  PODCAST_WORDS_PER_SEC,
  PodcastChapterOutSchema,
  PodcastOutlineSchema,
  cleanText,
  countWords,
  mediaPath,
  parseItemLabel,
  quizExists,
  topicDigest,
  topicLevels,
  topicName,
  topicPoints,
  type MediaProgress,
  type PodcastChapter,
  type PodcastChapterOut,
  type PodcastLine,
  type PodcastManifest,
  type PodcastOutline,
  type PodcastScript,
  type QuizRef,
  type TopicPoint,
} from "@nauka/shared";
import type { Deadline } from "../deadline.js";
import type { MediaAi } from "./ai.js";
import { sayable } from "./chapter.js";
import { MediaError, asMediaError } from "./errors.js";
import { PODCAST_CHAPTER_SYSTEM, PODCAST_OUTLINE_SYSTEM, podcastChapterPrompt, podcastOutlinePrompt } from "./prompts.js";
import type { JobTrack } from "./reels.js";

/**
 * Podcast job (plan §2.3): outline (1 call) → 8 chapter dialogues (parallel, shared cached prefix) → `script.json` in
 * Storage → manifest with every chapter in status `script`. No audio here: each chapter is synthesized when the user
 * starts it (`POST /api/media/podcast/chapter`, chapter.ts) and then cached for good.
 */

export const PODCAST_CHAPTERS = 8;
export const MIN_PODCAST_CHAPTERS = 6;
/** chapter dialogue limits: the prompt asks for 350–520 words / 18–40 lines; accepted with some slack */
export const CHAPTER_WORDS = { min: 280, max: 650 } as const;
export const CHAPTER_LINES = { min: 14, max: 48 } as const;
export const LINE_MAX = 400;
/** chapters must be written this long before the job deadline (upload + finish need the rest) */
export const SAVE_RESERVE_MS = 15_000;

export interface PlannedChapter {
  title: string;
  pointIds: string[];
  levelIds: string[];
  quizRef: QuizRef;
  pointId: string;
  szopMistake: string;
  lead: string;
}

const refKey = (r: QuizRef) => `${r.level}#${r.index}`;

/** How many chapters to ask for: 8, or 6–8 when the topic has fewer than 8 points. */
export function chapterTarget(pointCount: number): number {
  return pointCount >= PODCAST_CHAPTERS ? PODCAST_CHAPTERS : Math.max(MIN_PODCAST_CHAPTERS, Math.min(PODCAST_CHAPTERS, pointCount));
}

/**
 * Makes the AI's outline usable (plan §2.3): at most 8 chapters, known point / level ids (levels default to the
 * points' levels), every point in at least one chapter (an uncovered point goes to the first chapter that has one of
 * its levels, else to the chapter with the fewest points), one distinct existing quiz item per chapter (preferably of
 * the chapter's points), the pause's point = the point owning that quiz item. Throws `invalid_output` with fewer than
 * {@link MIN_PODCAST_CHAPTERS} chapters.
 */
export function repairOutline(outline: PodcastOutline, content: unknown): { title: string; chapters: PlannedChapter[] } {
  const points = topicPoints(content);
  const byId = new Map(points.map((p) => [p.id, p]));
  const levels = topicLevels(content);
  const levelIds = new Set(levels.map((l) => l.id));
  const order = new Map(levels.map((l, i) => [l.id, i]));
  const chapters: PlannedChapter[] = outline.chapters.slice(0, PODCAST_CHAPTERS).map((c) => {
    const pointIds = [...new Set(c.points.map((p) => p.trim()).filter((p) => byId.has(p)))];
    let lv = [...new Set(c.levels.map((l) => l.trim()).filter((l) => levelIds.has(l)))];
    if (!lv.length) lv = [...new Set(pointIds.flatMap((p) => byId.get(p)!.levels))];
    const q = parseItemLabel(c.quiz);
    return {
      title: cleanText(c.title, 60),
      pointIds,
      levelIds: lv.sort((a, b) => order.get(a)! - order.get(b)!),
      quizRef: q && q.kind === "quiz" ? { level: q.level, index: q.index } : { level: "", index: -1 },
      pointId: "",
      szopMistake: cleanText(c.szopMistake, 300),
      lead: cleanText(c.lead, 160),
    };
  });
  if (chapters.length < MIN_PODCAST_CHAPTERS) throw new MediaError("invalid_output", `outline has ${chapters.length} chapters`);
  chapters.forEach((c, i) => {
    if (!c.title) c.title = `Rozdział ${i + 1}`;
  });
  // coverage
  const covered = new Set(chapters.flatMap((c) => c.pointIds));
  for (const p of points) {
    if (covered.has(p.id)) continue;
    const target = chapters.find((c) => c.levelIds.some((l) => p.levels.includes(l))) ?? chapters.reduce((a, b) => (b.pointIds.length < a.pointIds.length ? b : a));
    target.pointIds.push(p.id);
    for (const l of p.levels) if (!target.levelIds.includes(l)) target.levelIds.push(l);
    covered.add(p.id);
  }
  // quiz items: one distinct existing item per chapter
  const allQuiz: QuizRef[] = levels.flatMap((l) => l.quiz.map((_, index) => ({ level: l.id, index })));
  const used = new Set<string>();
  for (const c of chapters) {
    const own = c.pointIds.flatMap((id) => byId.get(id)!.items.filter((i) => i.kind === "quiz").map((i) => ({ level: i.level, index: i.index })));
    const ownKeys = new Set(own.map(refKey));
    const ok = quizExists(content, c.quizRef) && !used.has(refKey(c.quizRef)) && (!own.length || ownKeys.has(refKey(c.quizRef)));
    if (!ok) {
      const pick = own.find((x) => !used.has(refKey(x))) ?? allQuiz.find((x) => c.levelIds.includes(x.level) && !used.has(refKey(x))) ?? allQuiz.find((x) => !used.has(refKey(x))) ?? own[0] ?? allQuiz[0];
      if (!pick) throw new MediaError("invalid_output", "topic has no quiz item");
      c.quizRef = pick;
    }
    used.add(refKey(c.quizRef));
    c.pointId =
      c.pointIds.find((id) => byId.get(id)!.items.some((i) => i.kind === "quiz" && i.level === c.quizRef.level && i.index === c.quizRef.index)) ??
      points.find((p) => p.items.some((i) => i.kind === "quiz" && i.level === c.quizRef.level && i.index === c.quizRef.index))?.id ??
      c.pointIds[0] ??
      "";
    if (!c.lead) c.lead = cleanText(`Szop twierdzi: ${c.szopMistake}`, 160);
  }
  return { title: cleanText(outline.title, 70) || cleanText(topicName(content), 70) || "Lis i Szop", chapters };
}

/** Removes markup other than `**term**` (and unbalanced `**`), emoji, `<>`; cuts a line at a sentence end ≤ 400. */
export function cleanLine(t: string): string {
  let s = cleanText(t, 2000)
    .replace(/__|`|#{1,6}\s|\[[^\]]{0,40}\]/g, "")
    .replace(/(?<!\*)\*(?!\*)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if ((s.match(/\*\*/g) ?? []).length % 2) s = s.replace(/\*\*/g, "");
  if (s.length > LINE_MAX) {
    const head = s.slice(0, LINE_MAX);
    const end = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "));
    s = end > LINE_MAX / 2 ? head.slice(0, end + 1) : `${head.slice(0, LINE_MAX - 1).trimEnd()}…`;
    if ((s.match(/\*\*/g) ?? []).length % 2) s = s.replace(/\*\*/g, "");
  }
  return s;
}

/**
 * Validates one generated chapter: words and lines within limits, speakers known, `pauseAfter` inside the chapter
 * (not in the first / last 2 lines) and on a Szop line (moved to the nearest Szop line before it when not), followed by
 * a line. Returns the cleaned lines and the pause index, or why it is invalid.
 */
export function checkChapter(out: PodcastChapterOut): { ok: true; lines: PodcastLine[]; pauseAfter: number } | { ok: false; why: string } {
  // a line must have something to say once the markup is gone (`** **` would reach the TTS as an empty text)
  const lines = out.lines.map((l) => ({ s: l.s, t: cleanLine(l.t) })).filter((l) => sayable(l.t) && (l.s === "lis" || l.s === "szop"));
  if (lines.length < CHAPTER_LINES.min) return { ok: false, why: `za mało kwestii (${lines.length})` };
  if (lines.length > CHAPTER_LINES.max) return { ok: false, why: `za dużo kwestii (${lines.length})` };
  const words = lines.reduce((n, l) => n + countWords(l.t.replace(/\*\*/g, "")), 0);
  if (words < CHAPTER_WORDS.min) return { ok: false, why: `za krótki rozdział (${words} słów)` };
  if (words > CHAPTER_WORDS.max) return { ok: false, why: `za długi rozdział (${words} słów)` };
  if (!lines.some((l) => l.s === "lis") || !lines.some((l) => l.s === "szop")) return { ok: false, why: "rozmowa jednej postaci" };
  let p = Math.round(out.pauseAfter);
  if (!Number.isFinite(p) || p < 2 || p > lines.length - 3) p = Math.floor(lines.length / 2);
  if (lines[p]!.s !== "szop") {
    let k = p;
    while (k > 1 && lines[k]!.s !== "szop") k--;
    if (lines[k]!.s !== "szop") {
      k = p;
      while (k < lines.length - 2 && lines[k]!.s !== "szop") k++;
    }
    if (lines[k]!.s !== "szop") return { ok: false, why: "brak kwestii Szopa na pauzę" };
    p = k;
  }
  return { ok: true, lines, pauseAfter: p };
}

export interface PodcastJobInput {
  mediaId: string;
  ownerId: string;
  topicId: string;
  content: unknown;
  stage: string;
}

export interface PodcastJobDeps {
  ai: MediaAi;
  deadline: Deadline;
  upload: (path: string, body: Uint8Array | string, contentType: string) => Promise<void>;
  progress: (p: MediaProgress) => Promise<void>;
  track: JobTrack;
  now?: () => number;
  log?: Pick<Console, "info" | "warn" | "error">;
}

/** Runs the whole podcast job (script only); throws a MediaError. */
export async function runPodcastJob(input: PodcastJobInput, deps: PodcastJobDeps): Promise<PodcastManifest> {
  const log = deps.log ?? console;
  const now = deps.now ?? Date.now;
  const points = topicPoints(input.content);
  const levels = topicLevels(input.content);
  const digest = topicDigest(input.content, { stage: input.stage });
  const target = chapterTarget(points.length);

  // 1) outline (one re-ask when it cannot be repaired)
  await deps.progress({ step: "plan", done: 0, total: target });
  let planned: { title: string; chapters: PlannedChapter[] } | null = null;
  let retry: string | undefined;
  for (let attempt = 0; attempt < 2 && !planned; attempt++) {
    const outline = await deps.ai({
      label: "podcast outline",
      system: PODCAST_OUTLINE_SYSTEM,
      blocks: [{ text: digest }, { text: podcastOutlinePrompt({ chapters: target, retry }) }],
      schema: PodcastOutlineSchema,
      maxTokens: 8000,
      effort: "low",
      signal: deps.deadline.signal,
    });
    try {
      planned = repairOutline(outline, input.content);
    } catch (e) {
      retry = asMediaError(e, "invalid_output").detail;
      log.warn(`[media] podcast outline invalid (${retry})${attempt === 0 ? " — asking once more" : ""}`);
    }
  }
  if (!planned) throw new MediaError("invalid_output", `outline: ${retry ?? "invalid"}`);
  const plan = planned;

  // 2) chapters in parallel (first alone until it streams: prompt cache)
  const total = plan.chapters.length;
  await deps.progress({ step: "script", done: 0, total });
  const phase = new AbortController();
  const onJobAbort = () => phase.abort();
  deps.deadline.signal.addEventListener("abort", onJobAbort, { once: true });
  const timer = setTimeout(() => phase.abort(), Math.max(0, deps.deadline.at - SAVE_RESERVE_MS - now()));
  let done = 0;
  const write = async (c: PlannedChapter, i: number, onFirst?: () => void): Promise<{ lines: PodcastLine[]; pauseAfter: number } | null> => {
    const q = levels.find((l) => l.id === c.quizRef.level)?.quiz[c.quizRef.index];
    let why: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (phase.signal.aborted) return null;
      try {
        const out = await deps.ai({
          label: `chapter ${i + 1}`,
          system: PODCAST_CHAPTER_SYSTEM,
          cacheSystem: true,
          blocks: [
            { text: digest, cache: true },
            {
              text: podcastChapterPrompt({
                podcastTitle: plan.title,
                n: i + 1,
                total,
                title: c.title,
                prev: plan.chapters[i - 1]?.title ?? null,
                next: plan.chapters[i + 1]?.title ?? null,
                points: c.pointIds.map((id) => points.find((p) => p.id === id)).filter((p): p is TopicPoint => !!p),
                szopMistake: c.szopMistake,
                quiz: { q: q?.q ?? "", answer: q?.a[q.c] ?? "" },
                retry: why,
              }),
            },
          ],
          schema: PodcastChapterOutSchema,
          maxTokens: 16000,
          effort: "medium",
          signal: phase.signal,
          onFirstEvent: attempt === 0 ? onFirst : undefined,
        });
        const checked = checkChapter(out);
        if (checked.ok) {
          done++;
          void deps.progress({ step: "script", done, total }).catch(() => undefined);
          return { lines: checked.lines, pauseAfter: checked.pauseAfter };
        }
        why = checked.why;
        log.warn(`[media] podcast chapter ${i + 1}: ${checked.why}${attempt === 0 ? " — asking once more" : " — dropped"}`);
      } catch (e) {
        const me = asMediaError(e);
        if (me.code === "refusal" || me.code === "ai_unavailable") {
          phase.abort(); // the job fails anyway: stop the other calls instead of paying for them
          throw me;
        }
        log.warn(`[media] podcast chapter ${i + 1}: ${me.code} ${me.detail}`);
        if (me.code === "timeout") return null;
        why = me.detail;
      }
    }
    onFirst?.();
    return null;
  };
  let written: ({ lines: PodcastLine[]; pauseAfter: number } | null)[];
  try {
    let firstStarted!: () => void;
    const started = new Promise<void>((r) => (firstStarted = r));
    const first = write(plan.chapters[0]!, 0, firstStarted).finally(() => firstStarted());
    await Promise.race([started, new Promise((r) => setTimeout(r, 20_000))]);
    written = await Promise.all([first, ...plan.chapters.slice(1).map((c, k) => write(c, k + 1))]);
  } finally {
    clearTimeout(timer);
    deps.deadline.signal.removeEventListener("abort", onJobAbort);
  }
  const kept = plan.chapters.map((c, i) => ({ c, w: written[i] })).filter((x): x is { c: PlannedChapter; w: { lines: PodcastLine[]; pauseAfter: number } } => !!x.w);
  if (kept.length < MIN_PODCAST_CHAPTERS) {
    if (deps.deadline.expired() || phase.signal.aborted) throw new MediaError("timeout", `${kept.length}/${total} chapters before the deadline`);
    throw new MediaError("invalid_output", `${kept.length}/${total} valid chapters`);
  }

  // 3) script.json + manifest (chapters renumbered 1..N after drops)
  await deps.progress({ step: "save", done: kept.length, total: kept.length });
  const script: PodcastScript = { v: 1, title: plan.title, chapters: kept.map(({ c, w }, i) => ({ n: i + 1, title: c.title, lines: w.lines })) };
  const chapters: PodcastChapter[] = kept.map(({ c, w }, i) => {
    const words = w.lines.reduce((n, l) => n + countWords(l.t.replace(/\*\*/g, "")), 0);
    return {
      n: i + 1,
      title: c.title,
      pointIds: c.pointIds,
      levelIds: c.levelIds,
      estSec: Math.round(words / PODCAST_WORDS_PER_SEC),
      durSec: null,
      status: "script",
      pauses: [{ afterLine: w.pauseAfter, quizRef: c.quizRef, pointId: c.pointId, lead: c.lead }],
      files: null,
    };
  });
  const path = mediaPath(input.ownerId, input.mediaId, "script.json");
  try {
    deps.track.uploaded.push(path);
    await deps.upload(path, JSON.stringify(script), "application/json");
  } catch (e) {
    throw new MediaError("storage_failed", (e as Error)?.message ?? String(e));
  }
  return {
    v: 1,
    kind: "podcast",
    title: plan.title,
    topicId: input.topicId,
    estSec: chapters.reduce((n, c) => n + c.estSec, 0),
    files: { script: "script.json" },
    chapters,
  };
}
