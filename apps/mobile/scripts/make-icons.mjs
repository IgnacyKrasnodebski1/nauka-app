#!/usr/bin/env node
/**
 * Generuje assets/icon.png (1024²), adaptive-icon.png (1024²) i splash.png (1284x2778) bez natywnych zależności.
 * Minimalny enkoder PNG: RGBA, filtr 0, deflate przez node:zlib. Rysuje pionowy gradient NAUKA + białą "książkę".
 * Uruchom: npm run icons -w @nauka/mobile
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../assets");
fs.mkdirSync(OUT, { recursive: true });

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const PINK = hex("#ff2d95"), PURPLE = hex("#a855f7"), CYAN = hex("#22d3ee"), BG = hex("#0a0a12");
function gradient(t) {
  // 3-stop: pink → purple → cyan
  const [a, b, u] = t < 0.5 ? [PINK, PURPLE, t * 2] : [PURPLE, CYAN, (t - 0.5) * 2];
  return a.map((v, i) => Math.round(v + (b[i] - v) * u));
}
function mix(a, b, u) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * u));
}

/** Ikona: zaokrąglony kwadrat z gradientem po przekątnej + biała otwarta książka (dwa prostokąty pod kątem) i kropka. */
function drawIcon(size, { transparentCorners, padding = 0 }) {
  const buf = Buffer.alloc(size * size * 4);
  const r = size * 0.22;
  const inner = size - padding * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x - padding, py = y - padding;
      // rounded-rect mask
      const cx = Math.min(Math.max(px, r), inner - r), cy = Math.min(Math.max(py, r), inner - r);
      const d = Math.hypot(px - cx, py - cy);
      const inside = px >= 0 && py >= 0 && px < inner && py < inner && d <= r;
      if (!inside) {
        if (transparentCorners) { buf[i + 3] = 0; continue; }
        [buf[i], buf[i + 1], buf[i + 2]] = BG; buf[i + 3] = 255; continue;
      }
      let col = gradient((px + py) / (2 * inner));
      // książka: dwie "kartki" — jasne trapezy w środku
      const nx = px / inner, ny = py / inner;
      const inLeft = nx > 0.22 && nx < 0.49 && ny > 0.30 + (0.49 - nx) * 0.12 && ny < 0.70 + (0.49 - nx) * 0.12;
      const inRight = nx > 0.51 && nx < 0.78 && ny > 0.30 + (nx - 0.51) * 0.12 && ny < 0.70 + (nx - 0.51) * 0.12;
      if (inLeft || inRight) col = mix(col, [255, 255, 255], 0.92);
      // "linie tekstu" na kartkach
      const lineBand = ((ny * inner) % (inner * 0.07)) < inner * 0.018;
      if ((inLeft || inRight) && lineBand && ny > 0.36 && ny < 0.66) col = mix(col, gradient(0.5), 0.55);
      // kropka "lime" — akcent XP
      if (Math.hypot(nx - 0.80, ny - 0.22) < 0.07) col = [170, 255, 0];
      [buf[i], buf[i + 1], buf[i + 2]] = col; buf[i + 3] = 255;
    }
  }
  return buf;
}

/** Splash: ciemne tło + ikona na środku (przezroczyste rogi, żeby resizeMode=contain nie robił kwadratu). */
function drawSplash(w, h) {
  const buf = Buffer.alloc(w * h * 4);
  buf.fill(0);
  const size = Math.round(Math.min(w, h) * 0.32);
  const icon = drawIcon(size, { transparentCorners: true });
  const ox = Math.round((w - size) / 2), oy = Math.round((h - size) / 2);
  for (let y = 0; y < size; y++) icon.copy(buf, ((oy + y) * w + ox) * 4, y * size * 4, (y + 1) * size * 4);
  return buf;
}

const ICON = 1024;
fs.writeFileSync(path.join(OUT, "icon.png"), encodePng(ICON, ICON, drawIcon(ICON, { transparentCorners: false })));
fs.writeFileSync(path.join(OUT, "adaptive-icon.png"), encodePng(ICON, ICON, drawIcon(ICON, { transparentCorners: true, padding: 160 })));
fs.writeFileSync(path.join(OUT, "splash.png"), encodePng(1024, 1024, drawSplash(1024, 1024)));
console.log("icons written to", OUT);
