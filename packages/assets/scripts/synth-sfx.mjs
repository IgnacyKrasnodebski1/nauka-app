#!/usr/bin/env node
/**
 * Synthesizes Recall's sound effects as 16-bit mono WAV (44.1 kHz). Zero dependencies.
 * Output: packages/assets/sfx/*.wav + copies into apps/web/public/sfx and apps/mobile/assets/sfx.
 * Run: npm run sfx
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../..");
const OUTS = [path.join(here, "..", "sfx"), path.join(ROOT, "apps/web/public/sfx"), path.join(ROOT, "apps/mobile/assets/sfx")];

const clamp = (x) => Math.max(-1, Math.min(1, x));
const soft = (x) => Math.tanh(x * 1.2);
function env(t, dur, a = 0.005, d = 0.05, s = 0.6, r = 0.08) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < dur - r) return s;
  return Math.max(0, s * (1 - (t - (dur - r)) / r));
}
function render(dur, fn) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = clamp(soft(fn(i / SR, i)));
  // 5 ms fades to avoid clicks
  const f = Math.floor(SR * 0.005);
  for (let i = 0; i < f; i++) { out[i] *= i / f; out[n - 1 - i] *= i / f; }
  return out;
}
const sine = (f, t) => Math.sin(2 * Math.PI * f * t);
const tri = (f, t) => 2 * Math.abs(2 * ((f * t) % 1) - 1) - 1;
const square = (f, t) => ((f * t) % 1) < 0.5 ? 1 : -1;
let seed = 7;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
function note(freq, start, dur, wave = sine, gain = 0.5) {
  return (t) => (t < start || t > start + dur ? 0 : gain * env(t - start, dur, 0.004, 0.04, 0.7, 0.06) * wave(freq, t - start));
}
const sum = (...fs) => (t) => fs.reduce((a, f) => a + f(t), 0);

const SOUNDS = {
  tap: render(0.05, (t) => 0.35 * env(t, 0.05, 0.002, 0.01, 0.4, 0.02) * sine(1200, t)),
  correct: render(0.24, sum(note(523.25, 0, 0.11, tri, 0.45), note(659.25, 0.1, 0.14, tri, 0.5), note(1318.5, 0.1, 0.14, sine, 0.12))),
  wrong: render(0.28, (t) => 0.42 * env(t, 0.28, 0.005, 0.08, 0.5, 0.1) * square(220 - 60 * (t / 0.28), t) * (1 / (1 + 4 * t))),
  combo: render(0.2, sum(note(783.99, 0, 0.08, tri, 0.4), note(1046.5, 0.07, 0.13, tri, 0.5), note(2093, 0.07, 0.13, sine, 0.1))),
  levelup: render(0.62, sum(note(523.25, 0, 0.14, tri, 0.42), note(659.25, 0.12, 0.14, tri, 0.42), note(783.99, 0.24, 0.14, tri, 0.42), note(1046.5, 0.36, 0.26, tri, 0.5), (t) => (t > 0.36 ? 0.08 * env(t - 0.36, 0.26) * sine(2093 + 300 * Math.sin(40 * t), t) : 0))),
  streak: render(0.45, (t) => 0.25 * env(t, 0.45, 0.02, 0.1, 0.6, 0.15) * rnd() * (1 - t / 0.45) + 0.4 * env(t, 0.45, 0.05, 0.1, 0.7, 0.15) * sine(300 + 600 * (t / 0.45), t)),
  chest: render(0.55, (t) => [1568, 1975.5, 2349.3, 2637, 3136].reduce((a, f, i) => a + 0.16 * (t > i * 0.07 ? env(t - i * 0.07, 0.3, 0.003, 0.05, 0.4, 0.15) * sine(f, t) : 0), 0)),
  gem: render(0.22, (t) => 0.4 * env(t, 0.22, 0.002, 0.06, 0.35, 0.1) * (sine(1760, t) + 0.35 * sine(3520, t))),
};

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2);
  return buf;
}

for (const dir of OUTS) fs.mkdirSync(dir, { recursive: true });
let total = 0;
for (const [name, s] of Object.entries(SOUNDS)) {
  const b = wav(s);
  total += b.length;
  for (const dir of OUTS) fs.writeFileSync(path.join(dir, `${name}.wav`), b);
  console.log(`${name}.wav ${(b.length / 1024).toFixed(1)} KB`);
}
console.log(`total ${(total / 1024).toFixed(0)} KB → ${OUTS.length} dirs`);
