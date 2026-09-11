#!/usr/bin/env node
/* ============================================================
   build.js — składa jednoplikowe wersje apki (do odpalenia na telefonie)
   Użycie:  node build.js
   Wynik:   build/<przedmiot>.html  (każdy przedmiot osobno)
            build/nauka-all.html    (wszystkie przedmioty razem)
   ============================================================ */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const OUT  = path.join(ROOT, 'build');

const css    = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const engine = fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const dataFiles = fs.readdirSync(DATA).filter(f => f.endsWith('.js'));

function page(title, dataScripts) {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${title}</title>
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<script>
${dataScripts.join('\n')}
</script>
<script>
${engine}
</script>
</body>
</html>`;
}

// per-subject builds
dataFiles.forEach(f => {
  const data = fs.readFileSync(path.join(DATA, f), 'utf8');
  const id = f.replace(/\.js$/, '');
  const out = page(`NAUKA — ${id}`, [data]);
  fs.writeFileSync(path.join(OUT, `${id}.html`), out);
  console.log('zbudowano:', `build/${id}.html`, `(${Math.round(out.length/1024)} KB)`);
});

// all-in-one build
const allData = dataFiles.map(f => fs.readFileSync(path.join(DATA, f), 'utf8'));
const all = page('NAUKA — wszystkie przedmioty', allData);
fs.writeFileSync(path.join(OUT, 'nauka-all.html'), all);
console.log('zbudowano:', 'build/nauka-all.html', `(${Math.round(all.length/1024)} KB)`);
console.log('\nGotowe. Otwórz dowolny plik z build/ w przeglądarce lub wrzuć na telefon.');
