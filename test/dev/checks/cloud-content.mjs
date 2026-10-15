#!/usr/bin/env node
/* Kontrola integracji Build 7 w warstwie danych (cloud.js), bez UI:
   P2-28 emoji z treści AI (clean / mapper / nazwy: emoji znikają, symbole tekstowe ↔ © ™ zostają, napis z samego emoji zostaje),
   limity konta z backend/0008 → kody klienta (Storage RLS 403 / 23514 materials_daily_limit → upload_daily_limit; 23514 subject_limit → subject_limit),
   aiConsentV w options /api/generate.  Użycie (z test/): node dev/checks/cloud-content.mjs [--out KATALOG] */
import {start,page,close,check,section,done,shot,tap,fill,waitFor,has,text,sleep,mockSet} from './cloud-lib.mjs';

await start();

section('P2-28: emoji z treści AI');
{const r=await page('mock=seeded&reset=1',{settle:2500});
  const t=await r.pg.evaluate(()=>{const C=window.NAUKA_CLOUD;return {
    clean:C.clean('<b>Opady 🌧</b> i ☁️ chmury — nauka↔przemysł © ™'),
    zwj:C.clean('👨‍👩‍👧 rodzina'),
    keycap:C.clean('1️⃣ krok'),
    plain:C.plain('⚠️ Uwaga'),
    only:C.plain('🍩'),
    strip:C._stripEmoji('a 🍩 b',true),
    xss:C.clean('<img src=x onerror="window.__pwned=1">🔥<b>ok</b>')};});
  check(t.clean==='<b>Opady </b> i  chmury — nauka↔przemysł © ™','clean(): emoji znikają, ↔ © ™ zostają',t.clean);
  check(t.zwj.trim()==='rodzina','sekwencja ZWJ (rodzina) znika w całości',t.zwj);
  check(t.keycap==='1 krok','keycap 1️⃣ → „1”',t.keycap);
  check(t.plain==='Uwaga','plain(): bez emoji i bez spacji na brzegu',t.plain);
  check(t.only==='🍩','napis z samego emoji zostaje (nie znika cały element)',t.only);
  check(t.strip==='a b','tekst zwykły: bez podwójnej spacji',t.strip);
  check(!/<img/i.test(t.xss)&&/&lt;img/.test(t.xss)&&/<b>ok<\/b>$/.test(t.xss)&&!/🔥/.test(t.xss)&&!(await r.pg.evaluate(()=>!!window.__pwned)),'sanitizer: <img onerror> zostaje zwykłym tekstem (escapowany), emoji znika',t.xss);
  const ui=await text(r);
  check(!/[\u{1F000}-\u{1FAFF}]|\p{Emoji_Presentation}|\p{Extended_Pictographic}️/u.test(ui),'Dziś (fixtures z emoji) bez emoji w UI');
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

section('limity konta z backend/0008 → kody klienta');
{const r=await page('mock=seeded&reset=1',{settle:2500});
  const m=await r.pg.evaluate(()=>{const C=window.NAUKA_CLOUD,E=C.CloudError;
    const f=e=>{const x=C._upFail(e);return x.code+':'+x.status;};
    return {rls403:f(new E(403,'Unauthorized','new row violates row-level security policy',{statusCode:'403'})),
      rls400:f(new E(400,'Unauthorized','new row violates row-level security policy',{statusCode:'403'})),
      matCap:f(new E(400,'23514','materials_daily_limit',{code:'23514',message:'materials_daily_limit'})),
      other23514:f(new E(400,'23514','new row for relation "materials" violates check constraint "materials_path_owner"',{})),
      big:f(new E(413,'Payload too large','The object exceeded the maximum allowed size',{})),
      net:f(new E(0,'network','Brak połączenia',{}))};});
  check(m.rls403==='upload_daily_limit:429'&&m.rls400==='upload_daily_limit:429','Storage RLS (403 i 400 ze statusCode 403) → upload_daily_limit',JSON.stringify(m));
  check(m.matCap==='upload_daily_limit:429','23514 materials_daily_limit → upload_daily_limit',m.matCap);
  check(m.other23514==='upload_failed:400','inny 23514 → upload_failed (bez udawania limitu)',m.other23514);
  check(m.big==='file_too_big:413'&&m.net==='network:0','413 i brak sieci bez zmian',JSON.stringify(m));
  await mockSet(r,'cap','subjects');
  const s=await r.pg.evaluate(async()=>{try{await window.NAUKA_CLOUD.createSubject({name:'X',stage:'studia',color:0});return 'ok';}catch(e){return e.code;}});
  check(s==='subject_limit','23514 subject_limit przy tworzeniu przedmiotu → subject_limit',s);
  await close(r);}

section('aiConsentV w options /api/generate (zapis w generations.options)');
{const r=await page('mock=seeded&reset=1',{settle:2500});
  await tap(r,'.navplus');await tap(r,'#qa-text');if(await has(r,'#cfc-ok'))await tap(r,'#cfc-ok');
  await waitFor(r,'#cft-in');await fill(r,'#cft-in','Polityka fiskalna to decyzje państwa o wydatkach i podatkach. Pakt Stabilności i Wzrostu: deficyt do 3% PKB, dług do 60% PKB.');
  await tap(r,'#cft-ok');await waitFor(r,'#cfadd-go');await tap(r,'#cfadd-go',null,{settle:300});await waitFor(r,'#cfr-name',null,20000);
  const o=await r.pg.evaluate(()=>{const g=MOCK.db().t.generations;return g[g.length-1]&&g[g.length-1].options||null;});
  check(o&&o.aiConsentV===1&&o.viz===true,'options.aiConsentV = 1 (stara zgoda bez wersji = 1)',JSON.stringify(o));
  await shot(r,'content-ready');
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

await done();
