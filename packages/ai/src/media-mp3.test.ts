import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { concatMp3, frameAt, id3v2Size, parseMp3, stripMp3 } from "./media/mp3.js";
import { FRAME_BYTES, FRAME_SEC, mp3Frames } from "./media-fixtures.test-helper.js";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("frame header: MPEG-1 Layer III 44.1 kHz 64 kbps mono = 208 bytes, 1152 samples", () => {
  const h = frameAt(mp3Frames(1), 0)!;
  assert.deepEqual({ v: h.version, l: h.layer, br: h.bitrate, sr: h.sampleRate, len: h.length, s: h.samples, mono: h.mono }, { v: 3, l: 3, br: 64000, sr: 44100, len: FRAME_BYTES, s: 1152, mono: true });
  assert.equal(frameAt(new Uint8Array([0xff, 0xff, 0xff, 0xff]), 0), null, "bad bitrate / sample rate");
});

test("duration from the frames; ID3v2 (with stray sync bytes), the Info frame, garbage and an ID3v1 tag are not audio", () => {
  const plain = parseMp3(mp3Frames(100));
  assert.equal(plain.frames, 100);
  close(plain.duration, 100 * FRAME_SEC);
  const wrapped = mp3Frames(100, { id3: true, info: true, garbage: true, tag: true });
  assert.ok(id3v2Size(wrapped) > 300);
  const info = parseMp3(wrapped);
  assert.equal(info.frames, 100, "Info frame and junk skipped");
  close(info.duration, 100 * FRAME_SEC);
  const s = stripMp3(wrapped);
  assert.equal(s.bytes.length, 100 * FRAME_BYTES);
  assert.deepEqual([...s.bytes.subarray(0, 4)], [0xff, 0xfb, 0x50, 0xc4]);
  assert.throws(() => parseMp3(new Uint8Array(500)), /no audio frames/);
});

test("concat: offsets are the summed frame durations; the result is one clean stream", () => {
  const out = concatMp3([mp3Frames(10, { id3: true }), mp3Frames(25, { info: true }), mp3Frames(5, { tag: true })]);
  assert.equal(out.bytes.length, 40 * FRAME_BYTES);
  close(out.offsets[0]!.start, 0);
  close(out.offsets[1]!.start, 10 * FRAME_SEC);
  close(out.offsets[2]!.start, 35 * FRAME_SEC);
  close(out.offsets[2]!.end, 40 * FRAME_SEC);
  close(out.duration, 40 * FRAME_SEC);
  assert.equal(parseMp3(out.bytes).frames, 40);
});

test("a real ElevenLabs file (prototype narration, ID3 with a C2PA manifest): 104.05 s", { skip: !existsSync(realFile()) && "rewolucja.mp3 not found" }, () => {
  const info = parseMp3(new Uint8Array(readFileSync(realFile())));
  assert.equal(info.sampleRate, 44100);
  assert.ok(Math.abs(info.duration - 104.046) < 0.06, `duration ${info.duration}`);
});

function realFile() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../../nauka-app/test/proto/rolka/audio/rewolucja.mp3");
}
