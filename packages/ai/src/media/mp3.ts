/**
 * Minimal MPEG audio frame parser (no dependencies): duration from the frame headers, removal of everything that is not
 * an audio frame (ID3v2 at the start — ElevenLabs puts a C2PA manifest there —, the Xing / Info / VBRI header frame,
 * ID3v1 / APE at the end) and concatenation of several files of the same format into one stream with the start time of
 * each part. Durations come from the frames (samples per frame ÷ sample rate), never from the last word.
 */

const BITRATES = {
  // [version][layer] → kbps by index (MPEG-1 / MPEG-2+2.5; layer 1, 2, 3)
  v1: {
    1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  },
  v2: {
    1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  },
} as const;
const SAMPLE_RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

export interface FrameHeader {
  /** 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5 */
  version: number;
  layer: 1 | 2 | 3;
  bitrate: number;
  sampleRate: number;
  padding: number;
  mono: boolean;
  length: number;
  samples: number;
}

/** The frame header at `i`, or null when the 4 bytes are not a valid MPEG audio header. */
export function frameAt(b: Uint8Array, i: number): FrameHeader | null {
  if (i + 4 > b.length) return null;
  if (b[i] !== 0xff || (b[i + 1]! & 0xe0) !== 0xe0) return null;
  const version = (b[i + 1]! >> 3) & 3;
  const layerBits = (b[i + 1]! >> 1) & 3;
  if (version === 1 || layerBits === 0) return null;
  const layer = (4 - layerBits) as 1 | 2 | 3;
  const brIdx = (b[i + 2]! >> 4) & 15;
  const srIdx = (b[i + 2]! >> 2) & 3;
  if (brIdx === 0 || brIdx === 15 || srIdx === 3) return null;
  const padding = (b[i + 2]! >> 1) & 1;
  const mono = ((b[i + 3]! >> 6) & 3) === 3;
  const bitrate = (version === 3 ? BITRATES.v1 : BITRATES.v2)[layer][brIdx]! * 1000;
  const sampleRate = SAMPLE_RATES[version]![srIdx]!;
  let length: number;
  let samples: number;
  if (layer === 1) {
    length = (Math.floor((12 * bitrate) / sampleRate) + padding) * 4;
    samples = 384;
  } else if (layer === 2 || version === 3) {
    length = Math.floor((144 * bitrate) / sampleRate) + padding;
    samples = 1152;
  } else {
    length = Math.floor((72 * bitrate) / sampleRate) + padding;
    samples = 576;
  }
  if (length < 24) return null;
  return { version, layer, bitrate, sampleRate, padding, mono, length, samples };
}

/** Size of an ID3v2 tag at the start (0 when none). */
export function id3v2Size(b: Uint8Array): number {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return 0;
  const size = ((b[6]! & 0x7f) << 21) | ((b[7]! & 0x7f) << 14) | ((b[8]! & 0x7f) << 7) | (b[9]! & 0x7f);
  const footer = (b[5]! & 0x10) !== 0 ? 10 : 0;
  return 10 + size + footer;
}

const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

/** True when the frame at `i` carries a Xing / Info / VBRI header instead of audio. */
function isInfoFrame(b: Uint8Array, i: number, h: FrameHeader): boolean {
  const side = h.version === 3 ? (h.mono ? 17 : 32) : h.mono ? 9 : 17;
  const tag = ascii(b, i + 4 + side, 4);
  return tag === "Xing" || tag === "Info" || ascii(b, i + 36, 4) === "VBRI";
}

export interface Mp3Info {
  /** seconds (audio frames only) */
  duration: number;
  frames: number;
  sampleRate: number;
  bitrate: number;
  mono: boolean;
  /** [start, end) byte ranges of the audio frames, in order (contiguous runs merged) */
  ranges: [number, number][];
}

/**
 * Walks the frames of an MP3. Each frame is accepted only when the next one also has a valid header (or it ends the
 * data), so a stray 0xFFE sync inside a tag is not taken for audio. Garbage between frames is skipped; an ID3v1 /
 * APE tag ends the scan. Throws when no audio frame is found.
 */
export function parseMp3(b: Uint8Array): Mp3Info {
  let i = id3v2Size(b);
  let frames = 0;
  let samples = 0;
  let sampleRate = 0;
  let bitrate = 0;
  let mono = false;
  let first = true;
  const ranges: [number, number][] = [];
  while (i + 4 <= b.length) {
    if (ascii(b, i, 3) === "TAG" || ascii(b, i, 8) === "APETAGEX") break;
    const h = frameAt(b, i);
    if (!h) {
      i++;
      continue;
    }
    const next = i + h.length;
    if (next > b.length) break; // truncated last frame
    const nh = next + 4 <= b.length ? frameAt(b, next) : null;
    const endsHere = next >= b.length || ascii(b, next, 3) === "TAG" || ascii(b, next, 8) === "APETAGEX";
    if (!nh && !endsHere) {
      i++;
      continue;
    }
    if (sampleRate && h.sampleRate !== sampleRate) {
      i++;
      continue;
    }
    if (first && isInfoFrame(b, i, h)) {
      first = false;
      sampleRate = h.sampleRate;
      i = next;
      continue;
    }
    first = false;
    sampleRate = h.sampleRate;
    bitrate = bitrate || h.bitrate;
    mono = h.mono;
    frames++;
    samples += h.samples;
    const last = ranges[ranges.length - 1];
    if (last && last[1] === i) last[1] = next;
    else ranges.push([i, next]);
    i = next;
  }
  if (!frames) throw new Error("mp3: no audio frames");
  return { duration: samples / sampleRate, frames, sampleRate, bitrate, mono, ranges };
}

/** The audio frames only (no ID3 / Xing / trailing tags) and their duration. */
export function stripMp3(b: Uint8Array): { bytes: Uint8Array; duration: number; sampleRate: number } {
  const info = parseMp3(b);
  const total = info.ranges.reduce((n, [s, e]) => n + e - s, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const [s, e] of info.ranges) {
    out.set(b.subarray(s, e), o);
    o += e - s;
  }
  return { bytes: out, duration: info.duration, sampleRate: info.sampleRate };
}

/**
 * Concatenates MP3 files of the same sample rate into one stream. `parts[i]` starts at `offsets[i].start` seconds of
 * the result (sum of the frame durations before it) and lasts `offsets[i].duration`.
 */
export function concatMp3(parts: Uint8Array[]): { bytes: Uint8Array; duration: number; offsets: { start: number; end: number; duration: number }[] } {
  const stripped = parts.map(stripMp3);
  const rate = stripped[0]?.sampleRate;
  if (stripped.some((p) => p.sampleRate !== rate)) throw new Error("mp3: parts have different sample rates");
  const out = new Uint8Array(stripped.reduce((n, p) => n + p.bytes.length, 0));
  const offsets: { start: number; end: number; duration: number }[] = [];
  let o = 0;
  let t = 0;
  for (const p of stripped) {
    out.set(p.bytes, o);
    o += p.bytes.length;
    offsets.push({ start: t, end: t + p.duration, duration: p.duration });
    t += p.duration;
  }
  return { bytes: out, duration: t, offsets };
}
