import type { ChapterTiming, PodcastLine, PodcastPause, Speaker } from "@nauka/shared";
import { alignToWords } from "./align.js";
import { mapLimit, TtsError, type TtsFn } from "./elevenlabs.js";
import { MediaError } from "./errors.js";
import { concatMp3 } from "./mp3.js";

/**
 * Audio of one podcast chapter (plan §2.4): one TTS request per line (4 at a time, the speaker's voice), the MP3
 * parts joined into one stream (ID3 / Xing frames stripped), each line's start from the frame durations before it,
 * word times from the line's character alignment shifted by that start, and each pause at the end of its line.
 */
export const CHAPTER_TTS_CONCURRENCY = 4;

/** What a line is said as (`**term**` → `term`). */
export const spokenLine = (t: string) => t.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

/** A line the TTS can say: at least one letter or digit once the markup is gone (`** **` is not). */
export const sayable = (t: string) => /[\p{L}\p{N}]/u.test(spokenLine(t));

/** Characters of a chapter's narration (for the TTS budget). */
export function chapterChars(lines: PodcastLine[]): number {
  return lines.reduce((n, l) => n + spokenLine(l.t).length, 0);
}

export interface ChapterAudio {
  audio: Uint8Array;
  timing: ChapterTiming;
  chars: number;
}

export async function synthesizeChapter(
  chapter: { lines: PodcastLine[]; pauses: PodcastPause[] },
  deps: {
    tts: TtsFn;
    voices: Record<Speaker, string>;
    modelId: string;
    signal: AbortSignal;
    concurrency?: number;
    /** characters sent to the TTS so far — readable when this throws (the caller gives the rest back to the budget) */
    spent?: { chars: number };
  },
): Promise<ChapterAudio> {
  const texts = chapter.lines.map((l) => spokenLine(l.t));
  let chars = 0;
  const spent = deps.spent ?? { chars: 0 };
  const parts = await mapLimit(chapter.lines, deps.concurrency ?? CHAPTER_TTS_CONCURRENCY, async (line, i) => {
    try {
      chars += texts[i]!.length;
      spent.chars += texts[i]!.length;
      return await deps.tts({ text: texts[i]!, voiceId: deps.voices[line.s], modelId: deps.modelId, signal: deps.signal });
    } catch (e) {
      if (e instanceof TtsError) throw new MediaError(e.code === "timeout" ? "timeout" : e.code === "invalid_output" ? "invalid_output" : "tts_unavailable", `line ${i}: ${e.detail}`);
      throw e;
    }
  });
  let joined: ReturnType<typeof concatMp3>;
  try {
    joined = concatMp3(parts.map((p) => p.audio));
  } catch (e) {
    throw new MediaError("tts_unavailable", `audio parts: ${(e as Error).message}`);
  }
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const lines = chapter.lines.map((line, i) => {
    const off = joined.offsets[i]!;
    const words = alignToWords(texts[i]!, parts[i]!.alignment, parts[i]!.normalizedAlignment, off.duration)
      .words.filter((w) => !w.tag)
      .map((w) => ({ w: w.w, start: r3(off.start + w.start), end: r3(off.start + w.end) }));
    return { i, s: line.s, start: r3(off.start), end: r3(off.end), words };
  });
  const pauses = chapter.pauses
    .filter((p) => p.afterLine >= 0 && p.afterLine < lines.length)
    .map((p) => ({ afterLine: p.afterLine, at: lines[p.afterLine]!.end }));
  return { audio: joined.bytes, timing: { v: 1, duration: r3(joined.duration), lines, pauses }, chars };
}
