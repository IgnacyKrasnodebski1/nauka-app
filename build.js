#!/usr/bin/env node
/* ============================================================
   build.js — składa jednoplikową apkę (to ją pakuje Capacitor: native/www/index.html)
   Użycie:  node build.js
   Wynik:   build/nauka-all.html  (konfiguracja chmury + chmura + silnik + UI chmury, style w środku)
   Przedmioty nie są już wbudowane — przychodzą z konta (cloud.js). CSP: tylko nasze skrypty (hashe), połączenia tylko do Supabase i API.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = __dirname;
const OUT  = path.join(ROOT, 'build');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const css = read('styles.css');
const scripts = ['cloud-config.js', 'cloud.js', 'engine.js', 'cloud-ui.js'].map(read);
const cfg = (() => { const w = {}; require('vm').runInNewContext(scripts[0], { window: w }); return w.CRAMFOX_CONFIG || {}; })();
if (!cfg.anonKey || /__SUPABASE_ANON_KEY__/.test(cfg.anonKey)) console.warn('UWAGA: brak klucza anon w cloud-config.js — logowanie nie zadziała.');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const body = s => `\n${s}\n`;
const sha = s => "'sha256-" + crypto.createHash('sha256').update(body(s), 'utf8').digest('base64') + "'";
const origin = u => { try { return new URL(u).origin; } catch (e) { return ''; } };
const csp = [
  "default-src 'none'",
  'script-src ' + scripts.map(sha).join(' '),
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${origin(cfg.supabaseUrl)} ${origin(cfg.apiUrl)}`,
  "base-uri 'none'", "form-action 'none'", "object-src 'none'"
].join('; ');

const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>Cramfox — nauka z Twoich materiałów</title>
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
${scripts.map(s => `<script>${body(s)}</script>`).join('\n')}
</body>
</html>`;
fs.writeFileSync(path.join(OUT, 'nauka-all.html'), html);
console.log('zbudowano:', 'build/nauka-all.html', `(${Math.round(html.length / 1024)} KB)`);
console.log('\nGotowe. Apka na iOS: cd native && npm run sync');
