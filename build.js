#!/usr/bin/env node
/* ============================================================
   build.js — składa jednoplikową apkę (to ją pakuje Capacitor: native/www/index.html)
   Użycie:  node build.js
   Wynik:   build/nauka-all.html  (konfiguracja chmury + chmura + silnik + UI chmury, style i fonty w środku)
   Przedmioty nie są już wbudowane — przychodzą z konta (cloud.js). CSP: tylko nasze skrypty (hashe), połączenia tylko do Supabase i API,
   fonty tylko z data: (fonts/*.ttf → WOFF w base64; bez Google Fonts — działa offline i nie wysyła IP do Google).
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const ROOT = __dirname;
const OUT  = path.join(ROOT, 'build');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* TTF/OTF → WOFF 1.0: każda tabela sfnt osobno przez zlib (deterministycznie, bez zmian w samych tabelach). Obsługuje go każdy WebKit na iOS. */
function ttfToWoff(ttf) {
  const flavor = ttf.readUInt32BE(0), n = ttf.readUInt16BE(4);
  if (flavor !== 0x00010000 && flavor !== 0x4F54544F) throw new Error('to nie jest plik TTF/OTF');
  const pad4 = x => (x + 3) & ~3;
  const tables = [];
  for (let i = 0; i < n; i++) {
    const o = 12 + 16 * i, t = { tag: ttf.readUInt32BE(o), sum: ttf.readUInt32BE(o + 4), off: ttf.readUInt32BE(o + 8), len: ttf.readUInt32BE(o + 12) };
    if (t.off + t.len > ttf.length) throw new Error('uszkodzona tabela w pliku fontu');
    tables.push(t);
  }
  tables.sort((a, b) => a.tag - b.tag);
  let off = 44 + 20 * n, sfntSize = 12 + 16 * n;
  const blobs = tables.map(t => {
    const raw = ttf.subarray(t.off, t.off + t.len), z = zlib.deflateSync(raw, { level: 9 }); // format zlib (RFC 1950), jak wymaga WOFF
    const data = z.length < raw.length ? z : raw, at = off;
    off += pad4(data.length); sfntSize += pad4(t.len);
    return { ...t, data, at };
  });
  const out = Buffer.alloc(off); // zera = wyrównanie tabel do 4 bajtów, brak metadanych i danych prywatnych
  out.writeUInt32BE(0x774F4646, 0); out.writeUInt32BE(flavor, 4); out.writeUInt32BE(off, 8); out.writeUInt16BE(n, 12);
  out.writeUInt32BE(sfntSize, 16); out.writeUInt16BE(1, 20);
  blobs.forEach((b, i) => {
    const o = 44 + 20 * i;
    out.writeUInt32BE(b.tag, o); out.writeUInt32BE(b.at, o + 4); out.writeUInt32BE(b.data.length, o + 8); out.writeUInt32BE(b.len, o + 12); out.writeUInt32BE(b.sum, o + 16);
    b.data.copy(out, b.at);
  });
  return out;
}
/* fonts/fonts.css (to samo czyta index.html) z plikami TTF zamienionymi na WOFF w data: */
const fontsCss = (() => {
  const dir = path.join(ROOT, 'fonts'), f = path.join(dir, 'fonts.css');
  if (!fs.existsSync(f)) { console.warn('UWAGA: brak fonts/fonts.css — apka użyje fontów systemowych.'); return ''; }
  let n = 0;
  const out = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').trim()
    .replace(/url\((['"]?)([^'")]+\.ttf)\1\)\s*format\((['"])truetype\3\)/g, (m, q, file) => {
      n++; return `url(data:font/woff;base64,${ttfToWoff(fs.readFileSync(path.join(dir, path.basename(file)))).toString('base64')}) format('woff')`;
    });
  if (!n) console.warn('UWAGA: fonts/fonts.css nie wskazuje żadnego pliku .ttf.');
  return out;
})();

const css = read('styles.css');
const scripts = ['cloud-config.js', 'cloud.js', 'engine.js', 'cloud-ui.js'].map(read);
const cfg = (() => { const w = {}; require('vm').runInNewContext(scripts[0], { window: w }); return w.CRAMFOX_CONFIG || {}; })();
if (!cfg.anonKey || /__SUPABASE_ANON_KEY__/.test(cfg.anonKey)) console.warn('UWAGA: brak klucza anon w cloud-config.js — logowanie nie zadziała.');
const missing = ['privacyUrl', 'termsUrl', 'supportEmail'].filter(k => !cfg[k]);
if (missing.length) console.warn('UWAGA: puste w cloud-config.js: ' + missing.join(', ') + ' — linki „Polityka prywatności / Regulamin / Pomoc i kontakt” są ukryte (wymagane przed zgłoszeniem do App Store).');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const body = s => `\n${s}\n`;
const sha = s => "'sha256-" + crypto.createHash('sha256').update(body(s), 'utf8').digest('base64') + "'";
const origin = u => { try { return new URL(u).origin; } catch (e) { return ''; } };
const csp = [
  "default-src 'none'",
  'script-src ' + scripts.map(sha).join(' '),
  "style-src 'unsafe-inline'",
  "font-src data:",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${origin(cfg.supabaseUrl)} ${origin(cfg.apiUrl)}`,
  "base-uri 'none'", "form-action 'none'", "object-src 'none'"
].join('; ');

const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0E0C1C">
<meta name="color-scheme" content="dark">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>Cramfox — nauka z Twoich materiałów</title>
<style>
${fontsCss}
${css}
</style>
</head>
<body>
<div id="app"></div>
${scripts.map(s => `<script>${body(s)}</script>`).join('\n')}
</body>
</html>`;
fs.writeFileSync(path.join(OUT, 'nauka-all.html'), html);
console.log('zbudowano:', 'build/nauka-all.html', `(${Math.round(html.length / 1024)} KB, w tym fonty ${Math.round(fontsCss.length / 1024)} KB)`);
console.log('\nGotowe. Apka na iOS: cd native && npm run sync');
