import type { WordsFile, WordTiming } from "@nauka/shared";

/**
 * ElevenLabs character alignment → word timings (`words.json` of the reel prototype: `{ v, duration, words: [{ w, start,
 * end, tag? }] }`). The text-to-speech-with-timestamps answer carries `alignment` (characters of the text we sent, with
 * start / end seconds) and `normalized_alignment` (of the text after normalization, e.g. numbers spelled out).
 * Docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
 */
export interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

const TAG_RE = /\[[^[\]]{1,30}\]/g;
const LETTER = /[\p{L}\p{N}]/u;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function validAlignment(a: unknown): a is Alignment {
  const x = a as Alignment | null | undefined;
  return (
    !!x &&
    Array.isArray(x.characters) &&
    Array.isArray(x.character_start_times_seconds) &&
    Array.isArray(x.character_end_times_seconds) &&
    x.characters.length > 0 &&
    x.characters.length === x.character_start_times_seconds.length &&
    x.characters.length === x.character_end_times_seconds.length &&
    x.character_start_times_seconds.every((t) => typeof t === "number" && Number.isFinite(t)) &&
    x.character_end_times_seconds.every((t) => typeof t === "number" && Number.isFinite(t))
  );
}

interface Token {
  w: string;
  s: number;
  e: number;
  tag: boolean;
  start?: number;
  end?: number;
}

function tokenize(text: string): Token[] {
  const tags: [number, number][] = [];
  for (const m of text.matchAll(TAG_RE)) tags.push([m.index!, m.index! + m[0].length]);
  const out: Token[] = [];
  for (const m of text.matchAll(/\S+/g)) {
    const s = m.index!;
    const e = s + m[0].length;
    out.push({ w: m[0], s, e, tag: tags.some(([a, b]) => s < b && e > a) });
  }
  return out;
}

const letters = (s: string) => [...s.normalize("NFC").toLowerCase()].filter((c) => LETTER.test(c));

/**
 * Word timings for `text` (exactly what was sent to the TTS). Tokens are split on whitespace; audio tags (`[excited]`,
 * `[laughs softly]` → two tokens) get `tag: true` and no duration. When `alignment` spells exactly `text`, each word
 * takes the times of its first and last character; otherwise the letters of each word are matched greedily, in order,
 * against `alignment` (or `normalized_alignment`), and words without a match (a number read as words, an abbreviation)
 * share the time between their matched neighbours in proportion to their length. `duration` (from the MP3 frames)
 * becomes the file's duration; without it the last word's end.
 */
export function alignToWords(text: string, alignment: Alignment | null | undefined, normalized?: Alignment | null, duration?: number): WordsFile {
  const tokens = tokenize(text);
  const exact = validAlignment(alignment) && alignment.characters.join("") === text;
  if (exact) {
    for (const t of tokens) {
      t.start = alignment.character_start_times_seconds[t.s]!;
      t.end = alignment.character_end_times_seconds[t.e - 1]!;
    }
  } else {
    const src = validAlignment(alignment) ? alignment : validAlignment(normalized) ? normalized : null;
    if (src) {
      // the letters of the alignment, each with the index of its character entry
      const flat: { c: string; k: number }[] = [];
      src.characters.forEach((ch, k) => {
        for (const c of letters(ch)) flat.push({ c, k });
      });
      let cursor = 0;
      for (const t of tokens) {
        if (t.tag) continue;
        const ls = letters(t.w);
        if (!ls.length) continue;
        const limit = Math.min(flat.length - ls.length, cursor + 80);
        for (let p = cursor; p <= limit; p++) {
          let ok = true;
          for (let j = 0; j < ls.length; j++)
            if (flat[p + j]!.c !== ls[j]) {
              ok = false;
              break;
            }
          if (!ok) continue;
          t.start = src.character_start_times_seconds[flat[p]!.k]!;
          t.end = src.character_end_times_seconds[flat[p + ls.length - 1]!.k]!;
          cursor = p + ls.length;
          break;
        }
      }
    }
    // words without a match: share the gap between matched neighbours by letter count
    const total = duration ?? Math.max(0, ...tokens.map((t) => t.end ?? 0));
    let i = 0;
    while (i < tokens.length) {
      if (tokens[i]!.tag || tokens[i]!.start !== undefined) {
        i++;
        continue;
      }
      let j = i;
      while (j < tokens.length && (tokens[j]!.tag || tokens[j]!.start === undefined)) j++;
      const run = tokens.slice(i, j).filter((t) => !t.tag);
      const prevEnd = [...tokens.slice(0, i)].reverse().find((t) => !t.tag && t.end !== undefined)?.end ?? 0;
      const nextStart = tokens[j]?.start ?? Math.max(prevEnd, total);
      const weights = run.map((t) => Math.max(1, letters(t.w).length));
      const sum = weights.reduce((a, b) => a + b, 0);
      let at = prevEnd;
      run.forEach((t, k) => {
        const d = ((nextStart - prevEnd) * weights[k]!) / sum;
        t.start = at;
        t.end = at + Math.max(0, d);
        at = t.end;
      });
      i = j;
    }
  }
  // tags: no duration, at the start of the next spoken word (else the end of the previous one)
  tokens.forEach((t, i) => {
    if (!t.tag || exact) return;
    const next = tokens.slice(i + 1).find((x) => !x.tag && x.start !== undefined);
    const prev = [...tokens.slice(0, i)].reverse().find((x) => !x.tag && x.end !== undefined);
    t.start = t.end = next?.start ?? prev?.end ?? 0;
  });
  // monotonic, non-negative
  let last = 0;
  const words: WordTiming[] = tokens.map((t) => {
    const start = Math.max(last, t.start ?? last);
    const end = Math.max(start, t.end ?? start);
    last = start;
    return { w: t.w, start: r3(start), end: r3(end), ...(t.tag ? { tag: true as const } : {}) };
  });
  const dur = duration ?? Math.max(0, ...words.map((w) => w.end));
  return { v: 1, duration: r3(dur), words };
}
