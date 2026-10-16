#!/usr/bin/env node
/* Kontrole tworzenia lekcji (atrapa backendu, zero żądań poza localhost):
   P1-12 limit widoczny przed przygotowaniem materiału, blokada przy 0, licznik plików, szkic zachowany przy limit_reached;
   D3 (decyzja z 2026-10-15): darmowe lekcje na zawsze (2), teksty bez daty odnowienia, okres startowy starych kont, nowe konto bez triala;
   P1-4 (klient) odpowiedź ≥500 bez JSON-a = wynik nieznany → dziennik zostaje i odzyskiwanie (sukces i „lost”), jeden POST na próbę;
   P1-22 ekran tworzenia (teksty faz, WRÓĆ DO DZIŚ, „Duży materiał”, [+] w trakcie, klikalny „Lekcja gotowa”, ZACZNIJ NAUKĘ → poziom 1);
   nowe kody backendu (busy, lost+ai_timeout, too_long z tokens, reserve_failed+ai_upload, download_failed+slow_intake, nieznany) → polskie teksty;
   incydent 2026-10-16 (backend/0009): ai_unavailable → „Tworzenie lekcji chwilowo nie działa”, „Limit się nie zmienił” tylko przy charged:false,
   „plik za duży albo zabezpieczony” tylko, gdy serwer mówi, że problemem jest materiał; stary backend (oldbe=1) bez pola charged.  Użycie (z test/): node dev/checks/cloud-gen.mjs [--out KATALOG] */
import {start,page,close,check,section,done,shot,tap,fill,waitFor,has,text,view,sleep,mockLog,mockSet,chooseFiles,testImage} from './cloud-lib.mjs';

const UID='0c0ffee0-0000-4000-8000-000000000001';
const NOTES='Polityka makroekonomiczna — notatki do kolokwium. Polityka fiskalna to decyzje państwa o wydatkach i podatkach. Pakt Stabilności i Wzrostu: deficyt do 3% PKB, dług do 60% PKB.';
const PAY=/\bPro\b|płat|subskryp|premium|zakup/i;
const posts=async r=>(await mockLog(r)).filter(x=>/^POST \/api\/generate/.test(x)).length;
const tc=(r,sel)=>r.pg.evaluate(sel=>(document.querySelector(sel)?.textContent||'').replace(/\u00a0/g,' '),sel); // textContent, twarde spacje jak zwykłe
async function addText(r){await tap(r,'.navplus');await tap(r,'#qa-text');if(await has(r,'#cfc-ok'))await tap(r,'#cfc-ok');await waitFor(r,'#cft-in');await fill(r,'#cft-in',NOTES);await tap(r,'#cft-ok');await waitFor(r,'#cfadd-go');}
const jumpClock=(r,ms)=>r.pg.evaluate(ms=>{const real=Date.now.bind(Date);const off=ms;Date.now=()=>real()+off;},ms);

await start();
const IMG=await testImage();

section('D3: darmowe lekcje wykorzystane → blokada przed aparatem (bez daty odnowienia)');
{const r=await page('mock=seeded&reset=1&plan=free&used=3',{settle:3000});
  await tap(r,'.navplus');
  let chooser=false;r.pg.waitForFileChooser({timeout:1500}).then(()=>{chooser=true;}).catch(()=>{});
  await tap(r,'#qa-photo',null,{real:true,settle:1800});
  const t=await text(r);
  const sh={h:await tc(r,'#cflim-h'),t:await tc(r,'#cflim-t')};
  check(sh.h==='Wykorzystano obie darmowe lekcje','tytuł arkusza: „Wykorzystano obie darmowe lekcje”',JSON.stringify(sh));
  check(sh.t==='Możesz dalej uczyć się z przedmiotów, które masz.','treść: „Możesz dalej uczyć się…” (bez powtórzenia tytułu)',JSON.stringify(sh));
  check(!/odnowi|w tym miesiącu|Nowe materiały dodasz od/i.test(t),'bez daty odnowienia i bez „w tym miesiącu”');
  check(!chooser,'aparat się nie otworzył');
  check(!PAY.test(t),'bez słów o płatnościach');
  await shot(r,'gen-limit-sheet');
  await close(r);}

section('P1-12: limit miesięczny (konto z okresem startowym) wyczerpany → blokada przed aparatem z datą odnowienia');
{const r=await page('mock=seeded&reset=1&plan=pro&trial=-2&used=150',{settle:3000});
  await tap(r,'.navplus');await tap(r,'#qa-photo',null,{real:true,settle:1800});
  const t=await text(r);
  check(/Limit na ten miesiąc wykorzystany/.test(t),'arkusz „Limit na ten miesiąc wykorzystany”',t.slice(0,300));
  check(/Utworzono 150 z 150 lekcji w tym miesiącu\. Nowe lekcje od 1 [a-ząćęłńóśźż]+\./.test(t),'liczby i data odnowienia',t.slice(0,300));
  check(!PAY.test(t),'bez słów o płatnościach');
  await shot(r,'gen-limit-sheet-month');
  await close(r);}

section('D3: darmowe lekcje — licznik na ekranie dodawania, liczba plików, blokada TWÓRZ w miejscu, 402 z serwera');
{const r=await page('mock=seeded&reset=1&plan=free&used=1',{settle:3000});
  await addText(r);
  const q=await tc(r,'#cfadd-quota');
  check(q==='Darmowe tworzenie lekcji: zostało 1 z 2 · do 5 plików naraz','linia limitu na ekranie dodawania',q);
  await chooseFiles(r,'.cfmore .chip',[IMG,IMG,IMG,IMG,IMG,IMG],'Plik');
  const n=await r.pg.evaluate(()=>document.querySelectorAll('.cfthumb:not(.text)').length);
  check(n===5,'szósty plik odpada od razu (5 miniatur)',n);
  check(/Maksymalnie 5 plików w jednej lekcji — pominąłem 1 plik/.test(await text(r)),'komunikat o pominiętym pliku');
  check(await r.pg.evaluate(()=>document.getElementById('cfadd-count')?.textContent)==='Materiał · 5/5','licznik „5/5” nad miniaturami');
  await shot(r,'gen-add-quota-5of5');
  // limit znany przed wysyłką (np. druga lekcja z innego urządzenia): odświeżony licznik blokuje TWÓRZ w miejscu, bez POST
  await mockSet(r,'used','2');await r.pg.evaluate(()=>window.NAUKA_CLOUD.me());let p0=await posts(r);
  await tap(r,'#cfadd-go',null,{settle:1500});
  const e=await r.pg.evaluate(()=>({v:window.NaukaEngine.view,err:document.getElementById('cfadd-err')?.textContent||''}));
  check(e.v==='cfadd'&&e.err==='Wykorzystano obie darmowe lekcje. Możesz dalej uczyć się z przedmiotów, które masz.','TWÓRZ przy 0: komunikat w miejscu, szkic zostaje',JSON.stringify(e));
  check(await posts(r)===p0,'bez wywołania /api/generate');
  const g0=await r.pg.evaluate(()=>{const b=document.getElementById('cfadd-go');return {dis:b.disabled,glow:b.classList.contains('a-glow')};});
  check(g0.dis&&!g0.glow,'po odmowie TWÓRZ wyłączone i bez poświaty',JSON.stringify(g0));
  // serwer odmawia mimo starego licznika (cache): 402 limit_reached ze scope lifetime
  await mockSet(r,'used','1');await r.pg.evaluate(()=>window.NAUKA_CLOUD.me());await mockSet(r,'gen','err:limit_reached');
  await r.pg.evaluate(()=>window.NaukaEngine.go('cfadd'));await sleep(400); // ekran od nowa z licznikiem 1 z 2 (np. po powrocie do apki)
  check(await r.pg.evaluate(()=>!document.getElementById('cfadd-go').disabled),'przy 1 z 2 TWÓRZ znowu aktywne');
  p0=await posts(r);await tap(r,'#cfadd-go',null,{settle:2500});
  const t1=await text(r);
  check(await posts(r)===p0+1,'jedno POST /api/generate');
  check(/Wykorzystano obie darmowe lekcje/.test(t1)&&/Możesz dalej uczyć się z przedmiotów, które masz\./.test(t1),'serwer: limit_reached (lifetime) → „Wykorzystano obie darmowe lekcje” + „Możesz dalej…”',t1.slice(0,240));
  check(await r.pg.evaluate(()=>!!document.querySelector('.errico.calm')&&!document.querySelector('.errico b')),'spokojna ikona (bez czerwieni i „!”) — to stan, nie awaria');
  check(!/odnowi|w tym miesiącu/i.test(t1)&&!PAY.test(t1),'bez daty odnowienia i bez słów o płatnościach');
  check(!(await has(r,'button','WRÓĆ DO MATERIAŁU'))&&await has(r,'.errfoot .pill','WRÓĆ'),'bez „WRÓĆ DO MATERIAŁU” (do szkicu nie ma po co wracać), jest „WRÓĆ”');
  await shot(r,'gen-limit-reached-lifetime');
  await tap(r,'.errfoot .pill','WRÓĆ');check((await view(r)).view==='today','„WRÓĆ” → Dziś');
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

section('P1-12: limit miesięczny — licznik, szkic przy limit_reached, blokada TWÓRZ w miejscu');
{const r=await page('mock=seeded&reset=1&plan=pro&trial=-2&used=149',{settle:3000});
  await addText(r);
  const q=await tc(r,'#cfadd-quota');
  check(q==='Możesz utworzyć jeszcze 1 z 150 lekcji w tym miesiącu · do 20 plików naraz','linia limitu na ekranie dodawania',q);
  // limit z serwera mimo starego licznika (cache): szkic zostaje
  await mockSet(r,'gen','err:limit_reached'); // /api/me nadal 149 z 150, serwer i tak odmawia (np. drugie urządzenie)
  await tap(r,'#cfadd-go',null,{settle:2500});
  const t1=await text(r);
  check(/Limit na ten miesiąc wykorzystany/.test(t1)&&/Wykorzystano 150 z 150 lekcji w tym miesiącu/.test(t1),'serwer: limit_reached (month)',t1.slice(0,200));
  check(await has(r,'button','WRÓĆ DO MATERIAŁU'),'przy limit_reached jest „WRÓĆ DO MATERIAŁU”');
  await shot(r,'gen-limit-reached-keep-draft');
  await tap(r,'button','WRÓĆ DO MATERIAŁU');
  const back=await r.pg.evaluate(()=>({v:window.NaukaEngine.view,text:!!document.querySelector('.cfthumb.text')}));
  check(back.v==='cfadd'&&back.text,'szkic wrócił',JSON.stringify(back));
  // limit znany przed wysyłką: odświeżony licznik blokuje TWÓRZ w miejscu, bez POST
  await mockSet(r,'used','150');await r.pg.evaluate(()=>window.NAUKA_CLOUD.me());const p0=await posts(r);
  await tap(r,'#cfadd-go',null,{settle:1500});
  const e=await r.pg.evaluate(()=>({v:window.NaukaEngine.view,err:document.getElementById('cfadd-err')?.textContent||''}));
  check(e.v==='cfadd'&&/^Limit nowych lekcji na ten miesiąc jest wykorzystany \(150 z 150\)\. Nowe lekcje od 1 /.test(e.err.replace(/\u00a0/g,' ')),'TWÓRZ przy 0: komunikat w miejscu, szkic zostaje',JSON.stringify(e));
  check(await posts(r)===p0,'bez wywołania /api/generate');
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

section('D3: konto z okresem startowym (sprzed zmiany) — data końca bez słowa o planie');
{const r=await page('mock=seeded&reset=1&trial=12',{settle:3000});
  const d=await r.pg.evaluate(()=>{const t=new Date(Date.now()+12*86400000);return t.getDate();});
  await tap(r,'.navplus');await sleep(600);
  const a=await tc(r,'#cf-qa-quota');
  check(new RegExp('^Do '+d+' [a-ząćęłńóśźż]+: zostało 148 z 150 w tym miesiącu, potem 2 darmowe lekcje · do 20 plików naraz$').test(a),'arkusz [+]: „Do <data>: zostało 148 z 150 w tym miesiącu, potem 2 darmowe lekcje”',a);
  check(await r.pg.evaluate(()=>/\u00a0z\u00a0/.test(document.getElementById('cf-qa-quota')?.textContent||'')),'„148 z 150” z twardymi spacjami (bez łamania „2 z / 150”)');
  await r.pg.evaluate(()=>{window.NaukaEngine.closeSheet();window.NaukaEngine.go('settings');});await sleep(800);
  const s=await tc(r,'#set-plan .s');
  check(new RegExp('^Do '+d+' [a-ząćęłńóśźż]+: 2 z 150 w tym miesiącu, potem 2 darmowe lekcje$').test(s),'Ustawienia → Nowe lekcje (bez sprzecznego „bez limitu”)',s);
  check(!/bez limitu/.test(a+s),'bez „bez limitu”');
  check(!PAY.test(a+s),'bez słów o płatnościach');
  await shot(r,'gen-trial-settings');
  await close(r);}

section('D3: okres startowy kończy się przed odnowieniem, limit miesięczny wyczerpany → „Po <data>: 2 darmowe lekcje”');
{const r=await page('mock=seeded&reset=1&trial=3&used=150',{settle:3000});
  const d=await r.pg.evaluate(()=>new Date(Date.now()+3*86400000).getDate());
  const ok=await r.pg.evaluate(()=>{const t=new Date(Date.now()+3*86400000),n=new Date();return t<=new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth()+1,1));});
  await tap(r,'.navplus');await tap(r,'#qa-photo',null,{real:true,settle:1500});
  const t=await tc(r,'#cflim-t');
  if(ok)check(new RegExp('^Utworzono 150 z 150 lekcji w tym miesiącu\\. Po '+d+' [a-ząćęłńóśźż]+: 2 darmowe lekcje\\. Gotowe lekcje').test(t),'arkusz: po końcu okresu startowego, nie „od 1.”',t);
  else check(/Nowe lekcje od 1 /.test(t),'okres startowy po odnowieniu: data odnowienia',t);
  await close(r);}

section('D3: ostatnia darmowa lekcja zużyta przez nieudaną próbę → bez „spróbuj jeszcze raz” i bez powrotu do materiału');
{const r=await page('mock=seeded&reset=1&plan=free&gen=err:generation_failed',{settle:3000});
  await addText(r);await tap(r,'#cfadd-go',null,{settle:3800});
  let t=await text(r);
  check(/Ta próba zużyła jedną z darmowych lekcji — zostało 1 z 2\./.test(t),'pierwsza nieudana: „zostało 1 z 2”',t.slice(0,300));
  check(await has(r,'button','WRÓĆ DO MATERIAŁU'),'pierwsza: jest „WRÓĆ DO MATERIAŁU”');
  await tap(r,'button','WRÓĆ DO MATERIAŁU');await waitFor(r,'#cfadd-go');
  await tap(r,'#cfadd-go',null,{settle:3800});await sleep(800);
  t=await text(r);
  check(/AI nie dało rady z tym materiałem/.test(t)&&/Ta próba zużyła ostatnią darmową lekcję\. Możesz dalej uczyć się z przedmiotów, które masz\./.test(t),'druga: „zużyła ostatnią darmową lekcję” + co dalej',t.slice(0,300));
  check(!/Spróbuj jeszcze raz/.test(t),'bez „Spróbuj jeszcze raz”');
  check(!(await has(r,'button','WRÓĆ DO MATERIAŁU'))&&await has(r,'.errfoot .pill','WRÓĆ'),'bez „WRÓĆ DO MATERIAŁU”, jest „WRÓĆ”');
  check(!PAY.test(t),'bez słów o płatnościach');
  await shot(r,'gen-last-free-failed');
  await tap(r,'.errfoot .pill','WRÓĆ');await tap(r,'.navplus');await sleep(700);
  check(/^Wykorzystano obie darmowe lekcje\./.test(await tc(r,'#cf-qa-quota')),'[+] potem: limit wykorzystany',await tc(r,'#cf-qa-quota'));
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

section('D3: konto bez przedmiotów i bez darmowych lekcji (np. dwie nieudane próby) → pusty „Dziś” bez obietnic, uczciwy arkusz');
for(const withMail of [false,true]){
  const r=await page('mock=seeded&reset=1&plan=free&used=2',{settle:3000,config:withMail?{supportEmail:'pomoc@example.test'}:undefined});
  await r.pg.evaluate(()=>window.NAUKA_CLOUD.me());
  await r.pg.evaluate(()=>{window.NaukaEngine.setSubjects([]);window.NaukaEngine.go('today');});await sleep(900);
  const e=await r.pg.evaluate(()=>({h:document.querySelector('.today.empty h1, .empty h1')?.textContent||'',p:document.querySelector('.empty h1')?.nextElementSibling?.textContent||'',
    steps:getComputedStyle(document.querySelector('.steps')||document.body).display,btn:document.getElementById('eadd')?.textContent||null,glow:!!document.querySelector('#eadd.a-glow')}));
  check(e.h==='Wykorzystano obie darmowe lekcje','pusty Dziś: tytuł'+(withMail?' (z adresem pomocy)':''),JSON.stringify(e));
  check(e.p==='Na tym koncie nie da się teraz utworzyć nowej lekcji.'&&!/Reszta powstanie sama/.test(e.p),'pusty Dziś: bez „Reszta powstanie sama” i bez „przedmiotów, które masz”',JSON.stringify(e));
  check(e.steps==='none'&&!e.glow,'kroki ukryte, bez świecącego przycisku',JSON.stringify(e));
  check(withMail?e.btn==='Napisz do nas':e.btn===null,withMail?'przycisk „Napisz do nas”':'bez adresu pomocy: bez przycisku',JSON.stringify(e));
  await tap(r,'.navplus');await tap(r,'#qa-text',null,{settle:600});
  const t=await tc(r,'#cflim-t');
  check(withMail?t==='Na tym koncie nie da się teraz utworzyć nowej lekcji. Jeśli lekcja nie powstała przez błąd, napisz do nas: pomoc@example.test.':t==='Na tym koncie nie da się teraz utworzyć nowej lekcji.','arkusz limitu bez „przedmiotów, które masz”',t);
  if(withMail)await shot(r,'gen-empty-no-lessons');
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

section('D3: limit serwera na dobę pełny (quota.globalOpen=false) → powiedziane przed aparatem, „później”, nie „jutro”');
{const r=await page('mock=seeded&reset=1&plan=free&global=full',{settle:3000});
  await tap(r,'.navplus');await sleep(700);
  const a=await tc(r,'#cf-qa-quota');
  check(a==='Serwer ma teraz bardzo dużo pracy. Nowych lekcji nie da się teraz tworzyć. Spróbuj później — Twój limit się nie zmienił.','arkusz [+]: serwer pełny',a);
  check(await tc(r,'#qa-photo .s')==='Spróbuj później','pod aparatem: „Spróbuj później”',await tc(r,'#qa-photo .s'));
  let chooser=false;r.pg.waitForFileChooser({timeout:1500}).then(()=>{chooser=true;}).catch(()=>{});
  await tap(r,'#qa-photo',null,{real:true,settle:1800});
  check(!chooser&&await tc(r,'#cflim-h')==='Serwer ma teraz bardzo dużo pracy','aparat się nie otworzył, arkusz „Serwer ma teraz bardzo dużo pracy”');
  check(!/jutro/.test(await text(r)),'bez „jutro” (okno kroczące, 0 = wstrzymane)');
  await tap(r,'#cflim-ok');
  // serwer odmawia (402 used=1999999) mimo otwartego licznika w cache
  await mockSet(r,'global','');await r.pg.evaluate(()=>window.NAUKA_CLOUD.me());await mockSet(r,'global','full');
  await addText(r);
  await r.pg.evaluate(()=>{window.NAUKA_CLOUD.me=(o=>{const f=window.NAUKA_CLOUD.me;return async(x)=>{const v=await f(x);return {...v,quota:{...v.quota,globalOpen:true}};};})();}); // TWÓRZ widzi „otwarte”
  await tap(r,'#cfadd-go',null,{settle:2500});
  const t=await text(r);
  check(/Serwer ma teraz bardzo dużo pracy/.test(t)&&/Nowe lekcje będzie można tworzyć później\. Twój limit się nie zmienił\./.test(t),'402 1999999: „później”',t.slice(0,240));
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

section('D3: nowe konto — bez okresu startowego, 2 darmowe lekcje na zawsze');
{const r=await page('mock=fresh&reset=1',{settle:2000});
  const m=await r.pg.evaluate(async()=>{await window.NAUKA_CLOUD.signUp('nowa.osoba@cramfox.test','haslo-testowe-1');const m=await window.NAUKA_CLOUD.me();return {q:m.quota,trial:m.trialUntil,lim:m.limits.generationsPerMonth,used:m.usage.generations};});
  check(m.q&&m.q.scope==='lifetime'&&m.q.limit===2&&m.q.used===0&&m.q.remaining===2&&!m.q.trialUntil&&!m.trial,'quota: lifetime 0 z 2, bez trialUntil',JSON.stringify(m));
  check(m.lim===2&&m.used===0,'pola dla starszych klientów: 0 z 2',JSON.stringify(m));
  await close(r);}

section('P1-4: 504 bez JSON-a → odzyskiwanie, temat jednak powstał');
{const r=await page('mock=seeded&reset=1&gen=html504',{settle:3000});
  await addText(r);await tap(r,'#cfadd-go',null,{settle:500});
  await sleep(4500); // 504 przychodzi po ok. 3 s
  const st=await r.pg.evaluate(uid=>({job:!!localStorage.getItem('cf_job:'+uid),s:document.getElementById('cfgen-s')?.textContent||'',v:window.NaukaEngine.view}),UID);
  check(st.job,'dziennik cf_job zostaje po 504',JSON.stringify(st));
  check(st.v==='cfgen'&&/Sprawdzam, czy lekcja powstała/.test(st.s),'ekran: „Sprawdzam, czy lekcja powstała…”',JSON.stringify(st));
  const subj=await r.pg.evaluate(()=>{const g=window.MOCK.db().t.generations.find(x=>x.status==='running');return g&&g.subject_id;});
  check(!!subj&&await r.pg.evaluate(id=>window.MOCK.db().t.subjects.some(s=>s.id===id),subj),'nowy przedmiot nie został skasowany');
  await r.pg.evaluate(()=>{const D=window.MOCK.db();const g=D.t.generations.find(x=>x.status==='running');g._finishAt=Date.now()-1;g._outcome='ok';g._content=JSON.parse(JSON.stringify(D.t.topics[0].content));window.MOCK.save();}); // serwer jednak skończył
  await waitFor(r,'.cfready-body',null,20000);
  check(true,'odzyskany temat → „Gotowe!”');
  check(await posts(r)===1,'dokładnie jeden POST /api/generate',await posts(r));
  check(!(await r.pg.evaluate(uid=>localStorage.getItem('cf_job:'+uid),UID)),'dziennik usunięty po odzyskaniu');
  await shot(r,'gen-504-recovered-ready');
  await tap(r,'.cfadd-foot .pill','ZACZNIJ NAUKĘ',{settle:1200});
  const v=await view(r);
  check(v.lesson,'„ZACZNIJ NAUKĘ” od razu otwiera lekcję poziomu 1',JSON.stringify(v));
  await shot(r,'gen-start-level1');
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

section('P1-4: 504 bez JSON-a, generacja wisi → po czasie „lost”, sprzątanie tylko pustego przedmiotu');
{const r=await page('mock=seeded&reset=1&gen=html504',{settle:3000});
  await addText(r);await tap(r,'#cfadd-go',null,{settle:500});await sleep(4500);
  const subj=await r.pg.evaluate(()=>{const g=window.MOCK.db().t.generations.find(x=>x.status==='running');return g&&g.subject_id;});
  await jumpClock(r,400000); // 400 s później (odzyskiwanie pyta co 8 s)
  await waitFor(r,'.errscreen, .err, h1, .cfgen-t','Tworzenie lekcji się nie zakończyło',20000).catch(()=>{});
  const t=await text(r);
  check(/Tworzenie lekcji się nie zakończyło/.test(t),'komunikat „Tworzenie lekcji się nie zakończyło”',t.slice(0,200));
  check(/Ta próba liczy się do miesięcznego limitu/.test(t),'uczciwie: liczy się do limitu');
  await sleep(1500);
  check(!(await r.pg.evaluate(id=>window.MOCK.db().t.subjects.some(s=>s.id===id),subj)),'pusty nowy przedmiot posprzątany');
  check(await posts(r)===1,'dokładnie jeden POST /api/generate (bez ponowień)',await posts(r));
  await shot(r,'gen-504-lost');
  await close(r);}

section('nowe kody backendu → polskie teksty');
for(const [code,re] of [['busy',/Tworzę już inną lekcję/],['ai_timeout',/Tworzenie lekcji trwało za długo/],['lost:ai_timeout',/Tworzenie lekcji trwało za długo[\s\S]*liczy się do miesięcznego limitu/],
  ['too_long',/ok\. 3 razy więcej[\s\S]*Limit się nie zmienił/],['reserve_failed:ai_upload',/Nie udało się przekazać materiału do AI/],['download_failed:slow_intake',/Przygotowanie materiału trwało za długo/],
  ['cos_nowego',/Coś poszło nie tak po stronie serwera/]]){
  const r=await page('mock=seeded&reset=1&gen=err:'+code,{settle:3000});
  await addText(r);await tap(r,'#cfadd-go',null,{settle:4500});
  const t=await text(r);check(re.test(t),`${code} → „${re.source}”`,t.slice(0,200));
  check(!PAY.test(t)&&!/[a-z]+_[a-z]+/.test(t.replace(/@\S+/g,'')),`${code}: bez surowego kodu i bez słów o płatnościach`);
  if(code==='busy')await shot(r,'gen-err-busy');
  await close(r);}

section('incydent 2026-10-16: AI nie działa po naszej stronie (ai_unavailable, limit zwrócony) → uczciwy tekst, szkic zostaje, bez ponawiania');
const AIU_T='Tworzenie lekcji chwilowo nie działa',AIU_B='To problem po naszej stronie, nie z Twoim materiałem. Limit się nie zmienił — spróbuj ponownie za kilka minut.';
{const r=await page('mock=seeded&reset=1&gen=err:ai_unavailable',{settle:3000});
  const u0=await r.pg.evaluate(async()=>(await window.NAUKA_CLOUD.me({maxAge:0})).quota.used);
  await addText(r);await tap(r,'#cfadd-go',null,{settle:300});
  await waitFor(r,'.errv',null,15000);await sleep(300);
  const t=await text(r);
  check(t.includes(AIU_T),'tytuł „Tworzenie lekcji chwilowo nie działa”',t.slice(0,300));
  check(t.includes(AIU_B),'treść: „To problem po naszej stronie, nie z Twoim materiałem. Limit się nie zmienił — spróbuj ponownie za kilka minut.”',t.slice(0,300));
  check(!/za duży|zabezpiecz|PDF|liczy się do|zużyła/i.test(t),'bez rady o pliku i bez „liczy się do limitu”',t.slice(0,300));
  check(!PAY.test(t)&&!/[a-z]+_[a-z]+/.test(t.replace(/@\S+/g,'')),'bez surowego kodu i bez słów o płatnościach');
  check(await has(r,'button','WRÓĆ DO MATERIAŁU'),'jest „WRÓĆ DO MATERIAŁU”');
  await shot(r,'gen-err-ai-unavailable');
  await sleep(6000); // żadnego automatycznego ponowienia (każdy POST zjada limit)
  check(await posts(r)===1,'dokładnie jeden POST /api/generate, bez ponawiania',await posts(r));
  const u1=await r.pg.evaluate(async()=>(await window.NAUKA_CLOUD.me({maxAge:0})).quota.used);
  check(u1===u0,'limit na serwerze bez zmian (zwrot)',JSON.stringify({u0,u1}));
  await tap(r,'button','WRÓĆ DO MATERIAŁU');await waitFor(r,'#cfadd-go');
  const thumbs=await r.pg.evaluate(()=>document.querySelectorAll('.cfthumb').length);
  check((await view(r)).view==='cfadd'&&thumbs>=1,'szkic zachowany (materiał na ekranie dodawania)',thumbs);
  check(await posts(r)===1,'powrót do materiału nie wysyła niczego',await posts(r));
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

section('ai_unavailable: darmowe konto — limit bez zmian, bez „zużyła jedną z darmowych lekcji”');
{const r=await page('mock=seeded&reset=1&plan=free&gen=err:ai_unavailable',{settle:3000});
  await addText(r);await tap(r,'#cfadd-go',null,{settle:300});await waitFor(r,'.errv',null,15000);await sleep(800);
  const t=await text(r);
  check(t.includes(AIU_T)&&t.includes(AIU_B),'ten sam tekst co na koncie z limitem miesięcznym',t.slice(0,300));
  check(!/zużyła|zostało/.test(t),'bez „zużyła … zostało”',t.slice(0,300));
  check(await has(r,'button','WRÓĆ DO MATERIAŁU'),'jest „WRÓĆ DO MATERIAŁU”');
  check(await r.pg.evaluate(async()=>(await window.NAUKA_CLOUD.me({maxAge:0})).quota.used)===0,'darmowa lekcja wróciła (0 z 2 zużyte)');
  await close(r);}

section('ai_unavailable: naliczenie zostało (AI zdążyło coś wyprodukować) albo nie doszło do niego → tekst zgodny z polem charged');
for(const [qs,re,not,label] of [
  ['gen=err:ai_unavailable:charged',/To problem po naszej stronie, nie z Twoim materiałem\. Ta próba liczy się do miesięcznego limitu\. Spróbuj ponownie za kilka minut\./,/Limit się nie zmienił/,'charged:true → „liczy się do miesięcznego limitu”'],
  ['gen=err:ai_unavailable:precharge',/To problem po naszej stronie, nie z Twoim materiałem\. Limit się nie zmienił — spróbuj ponownie za kilka minut\./,/liczy się do/,'przed naliczeniem (nieważny klucz przy wgraniu PDF-u albo count_tokens 401) → „Limit się nie zmienił”']]){
  const r=await page('mock=seeded&reset=1&'+qs,{settle:3000});
  await addText(r);await tap(r,'#cfadd-go',null,{settle:300});await waitFor(r,'.errv',null,15000);await sleep(300);
  const t=await text(r);
  check(t.includes(AIU_T)&&re.test(t)&&!not.test(t),label,t.slice(0,300));
  check(await has(r,'button','WRÓĆ DO MATERIAŁU'),qs+': jest „WRÓĆ DO MATERIAŁU”');
  await close(r);}

section('kod api: „plik za duży albo zabezpieczony” tylko, gdy serwer mówi, że problemem jest materiał (backend z 0009 i stary)');
for(const [qs,re,not,label] of [
  ['oldbe=1&gen=err:api:401',/Tworzenie lekcji chwilowo nie działa[\s\S]*To problem po naszej stronie, nie z Twoim materiałem\. Ta próba liczy się do miesięcznego limitu\./,/za duży|zabezpiecz/,'stary backend, „AI: 401 invalid x-api-key” (incydent) → awaria po naszej stronie (naliczone przez stary backend)'],
  ['oldbe=1&gen=err:api',/Tworzenie lekcji chwilowo nie działa[\s\S]*liczy się do miesięcznego limitu/,/za duży|zabezpiecz/,'stary backend, „AI: 529 overloaded” → awaria po naszej stronie'],
  ['gen=err:api:material',/Tego materiału nie da się przetworzyć[\s\S]*Plik jest za duży albo zabezpieczony[\s\S]*liczy się do miesięcznego limitu/,/po naszej stronie/,'reason material → tekst o pliku'],
  ['oldbe=1&gen=err:api:material',/Tego materiału nie da się przetworzyć/,/po naszej stronie/,'stary backend: 400 o PDF z hasłem → tekst o pliku'],
  ['gen=err:api:400',/Nie udało się utworzyć lekcji/,/za duży|zabezpiecz|Tego materiału/,'400 o naszym zapytaniu (bez reason) → bez obwiniania pliku']]){
  const r=await page('mock=seeded&reset=1&'+qs,{settle:3000});
  await addText(r);await tap(r,'#cfadd-go',null,{settle:300});await waitFor(r,'.errv',null,15000);await sleep(300);
  const t=await text(r);
  check(re.test(t)&&!not.test(t),label,t.slice(0,300));
  check(!PAY.test(t)&&!/[a-z]+_[a-z]+/.test(t.replace(/@\S+/g,'')),qs+': bez surowego kodu i bez słów o płatnościach');
  await close(r);}

section('ai_unavailable przy odzyskiwaniu (odpowiedź zginęła, serwer zwrócił limit: error „released:ai_unavailable …”) → ten sam tekst, sprzątanie');
{const r=await page('mock=seeded&reset=1&gen=droprelease:2',{settle:3000});
  await addText(r);await tap(r,'#cfadd-go',null,{settle:300});
  await waitFor(r,'.errv',null,30000);await sleep(800);
  const t=await text(r);
  check(t.includes(AIU_T)&&t.includes(AIU_B)&&!/liczy się do/.test(t),'„Tworzenie lekcji chwilowo nie działa … Limit się nie zmienił”',t.slice(0,300));
  check(!(await r.pg.evaluate(uid=>localStorage.getItem('cf_job:'+uid),UID)),'dziennik usunięty');
  check(await posts(r)===1,'dokładnie jeden POST /api/generate',await posts(r));
  const fresh=await r.pg.evaluate(()=>{const D=window.MOCK.db();const g=D.t.generations.slice(-1)[0];return {id:g.subject_id,known:['5b000001-0000-4000-8000-000000000001','5b000002-0000-4000-8000-000000000002'].includes(g.subject_id),left:D.t.subjects.some(s=>s.id===g.subject_id)};});
  check(fresh.known||!fresh.left,'pusty nowy przedmiot posprzątany (albo materiał dodany do istniejącego)',JSON.stringify(fresh));
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

section('P1-22: ekran tworzenia, [+] w trakcie, klikalny „Lekcja gotowa”');
{const r=await page('mock=seeded&reset=1&gen=slow:12&upload=slow',{settle:3000});
  await tap(r,'.navplus');await chooseFiles(r,'#qa-photo',[IMG]);await waitFor(r,'#cfadd-go');
  await tap(r,'#cfadd-go',null,{settle:200});
  let up=null;for(let i=0;i<30&&!up;i++){const s=await r.pg.evaluate(()=>({s:document.getElementById('cfgen-s')?.textContent||'',n:document.getElementById('cfgen-note')?.textContent||'',foot:getComputedStyle(document.getElementById('cfgen-foot')||document.body).display}));if(/Wysyłam|Przygotowuję/.test(s.s))up=s;else await sleep(100);}
  check(up&&up.n==='Nie zamykaj aplikacji, dopóki pliki się wysyłają.','faza wysyłki: „Nie zamykaj aplikacji…”',JSON.stringify(up));
  check(up&&up.foot==='none','faza wysyłki: bez przycisku wyjścia');
  await shot(r,'gen-upload-phase');
  await waitFor(r,'#cfgen-s','AI czyta',15000);
  const ai=await r.pg.evaluate(()=>({n:document.getElementById('cfgen-note')?.textContent,b:document.getElementById('cfgen-bg')?.textContent,foot:getComputedStyle(document.getElementById('cfgen-foot')).display}));
  check(/Możesz zamknąć ten ekran — lekcja pojawi się na Dziś/.test(ai.n),'faza AI: „Możesz zamknąć ten ekran — lekcja pojawi się na Dziś”',ai.n);
  check(ai.b==='WRÓĆ DO DZIŚ'&&ai.foot!=='none','przycisk „WRÓĆ DO DZIŚ”',JSON.stringify(ai));
  await shot(r,'gen-ai-phase');
  await jumpClock(r,160000);await sleep(1200);
  check(/^Duży materiał — jeszcze chwila · 2:4\d$/.test(await r.pg.evaluate(()=>document.getElementById('cfgen-s').textContent)),'po 150 s: „Duży materiał — jeszcze chwila” i czas');
  await jumpClock(r,0);
  await tap(r,'#cfgen-bg');
  check((await view(r)).view==='today','WRÓĆ DO DZIŚ → Dziś');
  const row=await has(r,'#cf-today-genrow','Tworzę lekcję');
  console.log('  info  wiersz „Tworzę lekcję…” na Dziś: '+(row?'jest':'brak — silnik jeszcze nie woła hooka todayTop (CROSS-SCOPE)'));
  if(row)await shot(r,'gen-today-row');
  await tap(r,'.navplus');if(await has(r,'#qa-photo'))await tap(r,'#qa-photo');
  check((await view(r)).view==='cfgen','[+] w trakcie → ekran postępu (zamiast toastu)');
  await tap(r,'#cfgen-bg');
  let toast=null;for(let i=0;i<60&&!toast;i++){toast=await r.pg.evaluate(()=>{const t=[...document.querySelectorAll('#toast.show,#cf-toast.show')].find(x=>/Lekcja gotowa/.test(x.textContent));return t?{id:t.id,role:t.getAttribute('role'),pe:getComputedStyle(t).pointerEvents}:null;});if(!toast)await sleep(250);}
  check(toast&&toast.role==='button'&&toast.pe!=='none','„Lekcja gotowa” klikalny',JSON.stringify(toast));
  await shot(r,'gen-ready-toast');
  if(toast){await r.pg.evaluate(id=>document.getElementById(id).click(),toast.id);await sleep(600);}
  check((await view(r)).view==='cfready','dotknięcie → ekran „Gotowe!”');
  check(await posts(r)===1,'dokładnie jeden POST /api/generate',await posts(r));
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

section('przegląd Build 7: wiersz na Dziś — podpis według fazy, „Lekcja gotowa” zostaje po przegapionym toaście');
{const r=await page('mock=seeded&reset=1&gen=slow:6&upload=slow',{settle:3000});
  await tap(r,'.navplus');await chooseFiles(r,'#qa-photo',[IMG]);await waitFor(r,'#cfadd-go');
  await tap(r,'#cfadd-go',null,{settle:200});
  await r.pg.evaluate(()=>window.NaukaEngine.go('today')); // wyjście w trakcie wysyłki (strzałka wstecz)
  const s1=await r.pg.evaluate(()=>document.querySelector('#cf-today-genrow .s')?.textContent||'');
  let s2='';for(let i=0;i<60;i++){s2=await r.pg.evaluate(()=>document.querySelector('#cf-today-genrow .s')?.textContent||'');if(/2 minuty/.test(s2))break;await sleep(200);}
  check(/wysyłam pliki/.test(s1)&&/zwykle ok\. 2 minuty/.test(s2),'podpis wiersza zmienia się z wysyłki na fazę AI bez przerysowania Dziś',JSON.stringify({s1,s2}));
  let t='';for(let i=0;i<80;i++){t=await r.pg.evaluate(()=>document.querySelector('#cf-today-genrow .t')?.textContent||'');if(/Lekcja gotowa/.test(t))break;await sleep(250);}
  check(/Lekcja gotowa/.test(t),'po zakończeniu: wiersz „Lekcja gotowa” na Dziś (nie tylko toast)',t);
  const ms=await r.pg.evaluate(()=>{const b=document.getElementById('toast');return b&&b.classList.contains('act')?1:0;});
  await shot(r,'gen-today-ready-row');
  await tap(r,'#cf-today-genrow');await sleep(500);
  check((await view(r)).view==='cfready','wiersz → ekran „Gotowe!”');
  await r.pg.evaluate(()=>window.NaukaEngine.go('today'));await sleep(400);
  check(!(await has(r,'#cf-today-genrow')),'po otwarciu ekranu gotowej lekcji wiersz znika');
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

section('przegląd Build 7: limit wykorzystany → arkusz [+] z przygaszonymi kaflami (darmowe: powód, miesięczny: data odnowienia)');
for(const [qs,re,name] of [['plan=free&used=3',/^Darmowe lekcje wykorzystane$/,'gen-quickadd-limit'],['plan=pro&trial=-2&used=150',/^Nowe lekcje od 1 /,'gen-quickadd-limit-month']]){
  const r=await page('mock=seeded&reset=1&'+qs,{settle:3000});
  await tap(r,'.navplus');await sleep(400);
  const q=await r.pg.evaluate(()=>({off:['#qa-photo','#qa-file','#qa-text'].map(id=>document.querySelector(id)?.classList.contains('off')),s:document.querySelector('#qa-photo .s')?.textContent||'',line:document.getElementById('cf-qa-quota')?.textContent||'',test:document.querySelector('#qa-test')?.classList.contains('off')}));
  check(q.off.every(Boolean)&&re.test(q.s)&&!q.test,`${qs}: aparat, plik i tekst przygaszone; „Mam sprawdzian” aktywny`,JSON.stringify(q));
  await shot(r,name);
  await close(r);}

section('D3: błąd po naliczeniu na darmowym koncie → uczciwie „zużyła jedną z darmowych lekcji”');
{const r=await page('mock=seeded&reset=1&plan=free&used=0&gen=err:generation_failed',{settle:3000});
  await addText(r);await tap(r,'#cfadd-go',null,{settle:4500});
  const t=await text(r);
  check(/AI nie dało rady z tym materiałem/.test(t)&&/Ta próba zużyła jedną z darmowych lekcji — zostało 1 z 2\./.test(t)&&!/miesięcznego/.test(t),'tekst o darmowej lekcji („zostało 1 z 2”), bez „miesięcznego limitu”',t.slice(0,240));
  check(await has(r,'button','WRÓĆ DO MATERIAŁU'),'„WRÓĆ DO MATERIAŁU” zostaje (zostało jeszcze 1 z 2)');
  await close(r);}

section('przegląd Build 7: zgoda wycofana po nieudanej próbie → TWÓRZ najpierw pyta o zgodę');
{const r=await page('mock=seeded&reset=1&gen=err:api',{settle:3000});
  await addText(r);await tap(r,'#cfadd-go',null,{settle:4000});
  check(await has(r,'button','WRÓĆ DO MATERIAŁU'),'porażka z „WRÓĆ DO MATERIAŁU”');
  const p0=await posts(r);
  await r.pg.evaluate(()=>{const M=window.NaukaEngine.meta();delete M.aiConsent;delete M.aiConsentV;window.NaukaEngine.saveMeta();}); // „Wycofaj” w Ustawieniach
  await mockSet(r,'gen','ok');
  await tap(r,'button','WRÓĆ DO MATERIAŁU');await waitFor(r,'#cfadd-go');
  await tap(r,'#cfadd-go',null,{settle:800});
  check(await has(r,'#cfc-ok'),'arkusz zgody zamiast wysyłki');
  check(await posts(r)===p0,'bez POST /api/generate przed zgodą',await posts(r));
  await tap(r,'#cfc-ok',null,{settle:4000});
  const opts=await r.pg.evaluate(()=>{const g=window.MOCK.db().t.generations.slice(-1)[0];return g&&g.options;});
  check(await posts(r)===p0+1&&opts&&opts.aiConsentV===1,'po zgodzie: jedna wysyłka z aiConsentV',JSON.stringify({n:await posts(r),opts}));
  await close(r);}

section('przegląd Build 7: dziennik generowania nie zapisał się (pełna pamięć) → bez POST, uczciwy komunikat');
{const r=await page('mock=seeded&reset=1',{settle:3000});
  await addText(r);
  await r.pg.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(String(k).startsWith('cf_job:'))throw new DOMException('atrapa: pełna pamięć','QuotaExceededError');return set.call(this,k,v);};});
  await tap(r,'#cfadd-go',null,{settle:3000});
  const t=await text(r);
  check(/Pełna pamięć aplikacji/.test(t)&&/Limit się nie zmienił/.test(t),'komunikat o pełnej pamięci, limit bez zmian',t.slice(0,200));
  check(await posts(r)===0,'zero POST /api/generate',await posts(r));
  await close(r);}

section('przegląd Build 7: odzyskiwanie po 330 s nie bierze poprzedniego materiału za nową lekcję');
{const r=await page('mock=seeded&reset=1',{settle:3000});
  const out=await r.pg.evaluate(async()=>{
    const DB=MOCK.db();const uid=NAUKA_CLOUD.uid;const subj=DB.t.subjects.find(s=>s.owner_id===uid);const iso=t=>new Date(t).toISOString();
    const startedAt=Date.now()-400000;const prev=DB.t.topics.find(t=>t.subject_id===subj.id);prev.created_at=iso(startedAt-60000);
    DB.t.generations.push({id:'g-prev',owner_id:uid,subject_id:subj.id,status:'done',topic_id:prev.id,material_ids:['m1'],created_at:iso(startedAt-180000)});
    DB.t.generations.push({id:'g-cur',owner_id:uid,subject_id:subj.id,status:'running',material_ids:['m2'],created_at:iso(startedAt+500)});
    MOCK.save();
    localStorage.setItem('cf_job:'+uid,JSON.stringify({subjectId:subj.id,startedAt,materialIds:['m2'],prevAt:iso(startedAt-180000),prevOk:true,created:null,materials:[],known:[prev.id]}));
    let res,err;try{res=await NAUKA_CLOUD.recoverJob();}catch(e){err=e.code;}
    return {prevId:prev.id,got:res&&res.id,err};});
  check(out.got!==out.prevId&&out.err==='lost','zawieszona próba kończy się „lost”, a nie poprzednią lekcją',JSON.stringify(out));
  await close(r);}

await done();
