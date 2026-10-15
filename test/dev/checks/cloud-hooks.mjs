#!/usr/bin/env node
/* Kontrola hooków, które cloud-ui.js wystawia dla silnika (NAUKA_HOOKS): todayTop („Tworzę lekcję…” / nieudana próba na Dziś),
   addOpen ([+] w trakcie tworzenia → ekran postępu), addSheet (limit w arkuszu „Dodaj materiał”), settingsAbout (pomoc i licencje w „O aplikacji”).
   Od Build 7 woła je sam silnik (openQuickAdd, renderToday / renderEmpty, renderSettings) — tu sprawdzamy efekt bez ręcznego wołania.
   Użycie (z test/): node dev/checks/cloud-hooks.mjs [--out KATALOG] */
import {start,page,close,check,section,done,shot,tap,fill,waitFor,has,text,view,sleep,mockSet,TEST_CONFIG} from './cloud-lib.mjs';

const NOTES='Polityka makroekonomiczna — notatki do kolokwium. Polityka fiskalna to decyzje państwa o wydatkach i podatkach. Pakt Stabilności i Wzrostu: deficyt do 3% PKB.';
async function addText(r){await tap(r,'.navplus');await tap(r,'#qa-text');if(await has(r,'#cfc-ok'))await tap(r,'#cfc-ok');await waitFor(r,'#cft-in');await fill(r,'#cft-in',NOTES);await tap(r,'#cft-ok');await waitFor(r,'#cfadd-go');}
await start();

section('addSheet: limit w arkuszu „Dodaj materiał”');
{const r=await page('mock=seeded&reset=1&plan=free&used=1',{settle:3000});
  await tap(r,'.navplus');await sleep(800); // silnik woła addSheet po otwarciu arkusza
  const t=await r.pg.evaluate(()=>(document.getElementById('cf-qa-quota')?.textContent||'').replace(/\u00a0/g,' '));
  check(t==='Darmowe tworzenie lekcji: zostało 1 z 2 · do 5 plików naraz','linia limitu w arkuszu (darmowe lekcje na zawsze)',t);
  check(await r.pg.evaluate(()=>typeof window.NAUKA_HOOKS.emptyToday==='function'),'hook emptyToday (pusty „Dziś” bez darmowych lekcji)');
  await shot(r,'hooks-addsheet');
  check(await r.pg.evaluate(()=>window.NAUKA_HOOKS.addOpen(null))===false,'addOpen bez trwającej generacji → false (arkusz się otwiera)');
  await close(r);}

section('todayTop + addOpen w trakcie tworzenia lekcji');
{const r=await page('mock=seeded&reset=1&gen=slow:10',{settle:3000});
  await addText(r);await tap(r,'#cfadd-go',null,{settle:800});await tap(r,'#cfgen-bg');
  check(await has(r,'#cf-today-genrow','Tworzę lekcję'),'wiersz „Tworzę lekcję…” na Dziś (silnik woła todayTop)');
  check(await r.pg.evaluate(()=>{const h=document.querySelector('.todayhead'),g=document.getElementById('cf-today-gen');return !!h&&!!g&&h.nextElementSibling===g;}),'wiersz tuż pod nagłówkiem „Plan na dziś”');
  await shot(r,'hooks-today-generating');
  await tap(r,'#cf-today-genrow');check((await view(r)).view==='cfgen','wiersz → ekran postępu');
  await tap(r,'#cfgen-bg');
  await tap(r,'.navplus');await sleep(300);
  const v=await view(r);check(v.view==='cfgen'&&!v.sheet,'[+] w trakcie → ekran postępu, bez arkusza',JSON.stringify(v));
  await close(r);}

section('todayTop po nieudanej próbie poza ekranem postępu');
{const r=await page('mock=seeded&reset=1&gen=err:generation_failed',{settle:3000});
  await addText(r);await tap(r,'#cfadd-go',null,{settle:300});await tap(r,'#cfgen-bg');await sleep(3500);
  check(await has(r,'#cf-today-genrow','Nie udało się utworzyć lekcji'),'karta nieudanej próby na Dziś');
  await r.pg.evaluate(()=>{window.__subs=window.NaukaEngine.subjects();window.NaukaEngine.setSubjects([]);window.NaukaEngine.go('today');});await sleep(300);
  check(await has(r,'#emptytop #cf-today-genrow','Nie udało się utworzyć lekcji'),'karta także na pustym Dziś (pierwszy przedmiot)');
  await shot(r,'hooks-today-empty-failed');
  await r.pg.evaluate(()=>{window.NaukaEngine.setSubjects(window.__subs);window.NaukaEngine.go('today');});await sleep(300);
  await shot(r,'hooks-today-failed');
  await tap(r,'#cf-today-genrow');
  check(/AI nie dało rady z tym materiałem/.test(await text(r)),'karta → ekran błędu z powodem');
  check(await has(r,'.errfoot .pill','WRÓĆ DO MATERIAŁU'),'„WRÓĆ DO MATERIAŁU” (szkic zachowany)');
  await tap(r,'.errfoot .pill','WRÓĆ DO MATERIAŁU');check(await has(r,'.cfthumb.text'),'szkic z tekstem wrócił');
  await close(r);}

section('settingsAbout: wiersze przenoszą się do „O aplikacji”');
{const r=await page('mock=seeded&reset=1',{config:TEST_CONFIG,settle:3000});
  await r.pg.evaluate(()=>window.NaukaEngine.go('settings'));await sleep(400);
  check(!(await has(r,'#cf-help')),'bez osobnej karty „Pomoc i informacje” (silnik woła settingsAbout)');
  const ab=await r.pg.evaluate(()=>{const eb=[...document.querySelectorAll('.eyebrow.sec')].find(e=>e.textContent==='O aplikacji');const c=eb&&eb.nextElementSibling;
    return c?{rows:[...c.querySelectorAll('.setrow .t')].map(t=>t.textContent),lic:document.querySelectorAll('#set-licenses').length}:null;});
  check(!!ab&&/^Cramfox /.test(ab.rows[0])&&['Polityka prywatności','Regulamin','Pomoc i kontakt','Licencje'].every(t=>ab.rows.includes(t))&&ab.rows[ab.rows.length-1]==='Co nowego','wiersze w karcie „O aplikacji” (wersja → pomoc i licencje → Co nowego)',JSON.stringify(ab));
  check(ab&&ab.lic===1,'jeden wiersz „Licencje”');
  await r.pg.evaluate(()=>window.NaukaEngine.go('settings'));await sleep(300);
  check(await r.pg.evaluate(()=>document.querySelectorAll('#set-licenses').length)===1,'po ponownym wejściu nadal jeden zestaw wierszy');
  await shot(r,'hooks-settings-about');
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

await done();
