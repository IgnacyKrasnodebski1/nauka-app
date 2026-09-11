#!/usr/bin/env node
/**
 * Generates PWA icons without any deps: public/icons/icon.svg (+ maskable) and PNGs (192/512)
 * rendered as a rounded gradient tile with a book glyph, encoded by a tiny PNG writer (zlib from node).
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "public", "icons");
fs.mkdirSync(out, { recursive: true });

const svg = (maskable) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff2d95"/><stop offset=".5" stop-color="#a855f7"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>
  <rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="#0a0a12"/>
  <rect x="${maskable ? 64 : 40}" y="${maskable ? 64 : 40}" width="${maskable ? 384 : 432}" height="${maskable ? 384 : 432}" rx="96" fill="url(#g)"/>
  <g fill="#0a0a12">
    <rect x="160" y="150" width="86" height="212" rx="14"/>
    <rect x="266" y="150" width="86" height="212" rx="14"/>
    <rect x="150" y="332" width="212" height="30" rx="10"/>
  </g>
  <g fill="#ffffff" opacity=".92">
    <rect x="176" y="168" width="54" height="10" rx="5"/><rect x="176" y="192" width="54" height="10" rx="5"/><rect x="176" y="216" width="40" height="10" rx="5"/>
    <rect x="282" y="168" width="54" height="10" rx="5"/><rect x="282" y="192" width="54" height="10" rx="5"/><rect x="282" y="216" width="40" height="10" rx="5"/>
  </g>
</svg>`;
fs.writeFileSync(path.join(out, "icon.svg"), svg(false));
fs.writeFileSync(path.join(out, "icon-maskable.svg"), svg(true));

// --- tiny PNG encoder ---
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const lerp = (a, b, t) => a + (b - a) * t;
const STOPS = [[255, 45, 149], [168, 85, 247], [34, 211, 238]];
const grad = (t) => {
  const s = t < 0.5 ? [STOPS[0], STOPS[1], t * 2] : [STOPS[1], STOPS[2], (t - 0.5) * 2];
  return [0, 1, 2].map((i) => Math.round(lerp(s[0][i], s[1][i], s[2])));
};
const inRounded = (x, y, x0, y0, w, h, r) => {
  if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
  const cx = Math.max(x0 + r, Math.min(x, x0 + w - r));
  const cy = Math.max(y0 + r, Math.min(y, y0 + h - r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
for (const [size, maskable] of [[192, false], [512, false], [512, true]]) {
  const s = size / 512;
  const buf = png(size, (x, y) => {
    const X = x / s, Y = y / s;
    const bgR = maskable ? 0 : 112;
    if (!inRounded(X, Y, 0, 0, 512, 512, bgR)) return [0, 0, 0, 0];
    const pad = maskable ? 64 : 40;
    const tile = inRounded(X, Y, pad, pad, 512 - pad * 2, 512 - pad * 2, 96);
    const glyph = inRounded(X, Y, 160, 150, 86, 212, 14) || inRounded(X, Y, 266, 150, 86, 212, 14) || inRounded(X, Y, 150, 332, 212, 30, 10);
    const line = [168, 192, 216].some((ly) => (X >= 176 && X < 230 && Y >= ly && Y < ly + 10) || (X >= 282 && X < 336 && Y >= ly && Y < ly + 10));
    if (line) return [255, 255, 255, 255];
    if (glyph) return [10, 10, 18, 255];
    if (tile) return [...grad((X + Y) / 1024), 255];
    return [10, 10, 18, 255];
  });
  fs.writeFileSync(path.join(out, `icon-${size}${maskable ? "-maskable" : ""}.png`), buf);
}
console.log("icons written to", out);
