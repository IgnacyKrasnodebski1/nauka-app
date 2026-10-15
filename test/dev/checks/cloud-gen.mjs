#!/usr/bin/env node
/* Kontrole tworzenia lekcji (atrapa backendu, zero żądań poza localhost):
   P1-12 limit widoczny przed przygotowaniem materiału, blokada przy 0, licznik plików, szkic zachowany przy limit_reached;
   P1-4 (klient) odpowiedź ≥500 bez JSON-a = wynik nieznany → dziennik zostaje i odzyskiwanie (sukces i „lost”), jeden POST na próbę;
   P1-22 ekran tworzenia (teksty faz, WRÓĆ DO DZIŚ, „Duży materiał”, [+] w trakcie, klikalny „Lekcja gotowa”, ZACZNIJ NAUKĘ → poziom 1);
   nowe kody backendu (busy, lost+ai_timeout, too_long z tokens, reserve_failed+ai_upload, download_failed+slow_intake, nieznany) → polskie teksty.  Użycie (z test/): node dev/checks/cloud-gen.mjs [--out KATALOG] */
import {start,page,close,check,section,done,shot,tap,fill,waitFor,has,text,view,sleep,mockLog,mockSet,chooseFiles,testImage} from './cloud-lib.mjs';

const UID='0c0ffee0-0000-4000-8000-000000000001';
const NOTES='Polityka makroekonomiczna — notatki do kolokwium. Polityka fiskalna to decyzje państwa o wydatkach i podatkach. Pakt Stabilności i Wzrostu: deficyt do 3% PKB, dług do 60% PKB.';
const PAY=/\bPro\b|płat|subskryp|premium|zakup/i;
const posts=async r=>(await mockLog(r)).filter(x=>/^POST \/api\/generate/.test(x)).length;
async function addText(r){await tap(r,'.navplus');await tap(r,'#qa-text');if(await has(r,'#cfc-ok'))await tap(r,'#cfc-ok');await waitFor(r,'#cft-in');await fill(r,'#cft-in',NOTES);await tap(r,'#cft-ok');await waitFor(r,'#cfadd-go');}
const jumpClock=(r,ms)=>r.pg.evaluate(ms=>{const real=Date.now.bind(Date);const off=ms;Date.now=()=>real()+off;},ms);

await start();
const IMG=await testImage();

section('P1-12: limit wyczerpany → blokada przed aparatem');
{const r=await page('mock=seeded&reset=1&plan=free&used=3',{settle:3000});
  await tap(r,'.navplus');
  let chooser=false;r.pg.waitForFileChooser({timeout:1500}).then(()=>{chooser=true;}).catch(()=>{});
  await tap(r,'#qa-photo',null,{real:true,settle:1800});
  const t=await text(r);
  check(/Limit na ten miesiąc wykorzystany/.test(t),'arkusz „Limit na ten miesiąc wykorzystany”',t.slice(0,300));
  check(/Utworzono 3 z 3 lekcji w tym miesiącu\. Nowe materiały dodasz od 1 [a-ząćęłńóśźż]+\./.test(t),'liczby i data odnowienia');
  check(!chooser,'aparat się nie otworzył');
  check(!PAY.test(t),'bez słów o płatnościach');
  await shot(r,'gen-limit-sheet');
  await close(r);}

section('P1-12: licznik na ekranie dodawania, liczba plików, szkic przy limit_reached');
{const r=await page('mock=seeded&reset=1&plan=free&used=2',{settle:3000});
  await addText(r);
  const q=await r.pg.evaluate(()=>document.getElementById('cfadd-quota')?.textContent||'');
  check(q==='Możesz utworzyć jeszcze 1 z 3 lekcji w tym miesiącu · do 5 plików naraz','linia limitu na ekranie dodawania',q);
  await chooseFiles(r,'.cfmore .chip',[IMG,IMG,IMG,IMG,IMG,IMG],'Plik');
  const n=await r.pg.evaluate(()=>document.querySelectorAll('.cfthumb:not(.text)').length);
  check(n===5,'szósty plik odpada od razu (5 miniatur)',n);
  check(/Maksymalnie 5 plików w jednej lekcji — pominąłem 1 plik/.test(await text(r)),'komunikat o pominiętym pliku');
  check(await r.pg.evaluate(()=>document.getElementById('cfadd-count')?.textContent)==='Materiał · 5/5','licznik „5/5” nad miniaturami');
  await shot(r,'gen-add-quota-5of5');
  // limit z serwera mimo starego licznika (cache): szkic zostaje
  await mockSet(r,'gen','err:limit_reached'); // /api/me nadal 2 z 3, serwer i tak odmawia (np. drugie urządzenie)
  await tap(r,'#cfadd-go',null,{settle:2500});
  const t1=await text(r);
  check(/Limit na ten miesiąc wykorzystany/.test(t1),'serwer: limit_reached',t1.slice(0,200));
  check(await has(r,'button','WRÓĆ DO MATERIAŁU'),'przy limit_reached jest „WRÓĆ DO MATERIAŁU”');
  await shot(r,'gen-limit-reached-keep-draft');
  await tap(r,'button','WRÓĆ DO MATERIAŁU');
  const back=await r.pg.evaluate(()=>({v:window.NaukaEngine.view,files:document.querySelectorAll('.cfthumb:not(.text)').length,text:!!document.querySelector('.cfthumb.text')}));
  check(back.v==='cfadd'&&back.files===5&&back.text,'szkic wrócił (5 plików i tekst)',JSON.stringify(back));
  // limit znany przed wysyłką: odświeżony licznik blokuje TWÓRZ w miejscu, bez POST
  await mockSet(r,'used','3');await r.pg.evaluate(()=>window.NAUKA_CLOUD.me());const p0=await posts(r);
  await tap(r,'#cfadd-go',null,{settle:1500});
  const e=await r.pg.evaluate(()=>({v:window.NaukaEngine.view,err:document.getElementById('cfadd-err')?.textContent||''}));
  check(e.v==='cfadd'&&/^Limit nowych lekcji na ten miesiąc jest wykorzystany \(3 z 3\)\. Odnowi się 1 /.test(e.err),'TWÓRZ przy 0: komunikat w miejscu, szkic zostaje',JSON.stringify(e));
  check(await posts(r)===p0,'bez wywołania /api/generate');
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
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

section('przegląd Build 7: limit wykorzystany → arkusz [+] z przygaszonymi kaflami i datą odnowienia');
{const r=await page('mock=seeded&reset=1&plan=free&used=3',{settle:3000});
  await tap(r,'.navplus');await sleep(400);
  const q=await r.pg.evaluate(()=>({off:['#qa-photo','#qa-file','#qa-text'].map(id=>document.querySelector(id)?.classList.contains('off')),s:document.querySelector('#qa-photo .s')?.textContent||'',test:document.querySelector('#qa-test')?.classList.contains('off')}));
  check(q.off.every(Boolean)&&/^Nowe lekcje od 1 /.test(q.s)&&!q.test,'aparat, plik i tekst przygaszone; „Mam sprawdzian” aktywny',JSON.stringify(q));
  await shot(r,'gen-quickadd-limit');
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
