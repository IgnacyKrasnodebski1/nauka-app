#!/usr/bin/env node
/* ============================================================ CRAMFOX — KONTROLE BUILD 7 (silnik: engine.js + styles.css) NA ATRAPIE BACKENDU
   Regresje dla: P1-7 (poprawka pytania w przeglądzie egzaminu nie psuje wyniku), P1-8 (zamrożenie i zmiana dnia po powrocie z tła),
   P1-9 (pasek „Brak sieci” znika, nie zasłania; pasek pamięci w jednej linii), P1-23 (toasty: kolejka, cisza przy arkuszu, zawijanie),
   P1-24 (kontrast tekstu ≥ 4,5:1 na kluczowych ekranach), P1-10 + „Powiedz prościej” (real w czacie i w „Wyjaśnij inaczej”), P1-11 (przerwanie
   i wznowienie lekcji, powtórka poziomu od pytań), P1-17 (ocena fiszki dopiero po odwróceniu), P1-15 (pełne nazwy, skróty bez kolizji),
   P2-57 (.cram), P2-59 (nagłówek czatu 360 px), P2-9 (konfetti przy ograniczonym ruchu), P2-56 (color-scheme), P2-12 (boss po czasie).
   Użycie (z katalogu test/):  node dev/checks/build7-engine.mjs --out KATALOG [--only exam,resume,…] [--port 8841] [--old-tree KATALOG] [--root KATALOG]
   --old-tree: katalog z wersją sprzed zmian (np. git archive HEAD) — porównanie „Wyjaśnij inaczej” stare vs nowe (plik explain-diff.json).
   Wynik: zrzuty NN-nazwa.png, RESULTS.json i podsumowanie na stdout; kod wyjścia 1, gdy któraś kontrola nie przeszła. Nic nie idzie do sieci. */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const REPO=path.resolve(HERE,'../../..');
const argv=process.argv.slice(2);
const arg=(k,d)=>{const i=argv.indexOf('--'+k);return i>=0?(argv[i+1]&&!argv[i+1].startsWith('--')?argv[i+1]:true):d;};
const OUT=path.resolve(String(arg('out',path.join(HERE,'..','shots','build7')))); // domyślnie test/dev/shots/build7 (w .gitignore)
const PORT=+arg('port',8841);
const OLD=arg('old-tree','')?path.resolve(String(arg('old-tree'))):null;
const ROOT=arg('root','')?path.resolve(String(arg('root'))):REPO; // --root: serwuj inną kopię apki (np. starą wersję, żeby sprawdzić, że kontrola łapie błąd)
const CHROME=String(arg('chrome',process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
const ONLY=arg('only','')?String(arg('only')).split(','):null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- wiedza z fixtures (jak w shoot.mjs) ---------- */
const FX=Object.fromEntries(['topic-makro','topic-krypto','topic-viz','topic-xss'].map(n=>[n,JSON.parse(fs.readFileSync(path.join(REPO,'test/fixtures',n+'.json'),'utf8'))]));
const NORM=s=>String(s==null?'':s).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const KB={quiz:{},tasks:[],labels:{'prawda czy fałsz':'tf','uzupełnij zdanie':'fill','wpisz pojęcie':'typeterm','dwie kategorie':'swipe','czyja to teza':'thesis','scenariusz':'scenario',
  'znajdź błąd':'finderror','połącz w pary':'match','ustaw kolejność':'order','przypisz do kategorii':'sort','oś czasu':'timeline','łańcuch przyczyn':'chain','wykres':'chart','krok po kroku':'mathsteps','wskaż na schemacie':'hotspot'}};
Object.values(FX).forEach(t=>(t.levels||[]).forEach(l=>{(l.quiz||[]).forEach(q=>{if(Array.isArray(q.a)&&q.a[q.c]!=null)KB.quiz[NORM(q.q)]=NORM(q.a[q.c]);});(l.tasks||[]).forEach(x=>{if(x&&x.type)KB.tasks.push(x);});}));

/* ---------- serwery plików: bieżące repo (+ opcjonalnie stara wersja) ---------- */
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
function serve(root,port){
  const srv=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');
    if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
    if(u.pathname.startsWith('/api/')){res.writeHead(501);return res.end('{}');}
    let p=path.normalize(path.join(root,decodeURIComponent(u.pathname)));if(!p.startsWith(root)){res.writeHead(403);return res.end();}
    if(p.endsWith(path.sep))p=path.join(p,'index.html');
    fs.stat(p,(e,st)=>{if(e||!st.isFile()){res.writeHead(404);return res.end('nie ma');}res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(p).pipe(res);});});
  return new Promise((ok,ko)=>{srv.once('error',ko);srv.listen(port,'127.0.0.1',()=>ok(srv));});
}

/* ---------- wyniki ---------- */
const RESULTS=[];let NN=0,browser=null;
function check(scen,name,ok,detail){RESULTS.push({scen,name,ok:!!ok,detail:detail==null?'':String(detail).slice(0,600)});console.log(`  ${ok?'PASS':'FAIL'} [${scen}] ${name}${detail!=null&&detail!==''?' — '+String(detail).slice(0,240):''}`);}

/* ---------- przeglądarka ---------- */
const SEED_RANDOM=`(()=>{let s=0x2f6b1d3;Math.random=function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();`;
async function newRun(name,query,o={}){
  const w=o.w||375,h=o.h||812,port=o.port||PORT;
  const ctx=await browser.createBrowserContext();const page=await ctx.newPage();
  await page.setViewport({width:w,height:h,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:o.motion?'no-preference':'reduce'}]);
  await page.evaluateOnNewDocument(SEED_RANDOM);
  await page.setRequestInterception(true);
  const run={name,page,ctx,w,h,port,last:'',errors:[]};
  page.on('request',r=>{const u=r.url();if(/^(data|blob):/.test(u)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u))return r.continue();r.abort();});
  page.on('console',m=>{if(m.type()!=='error')return;const t=m.text();if(/favicon|fonts\.g|ERR_FAILED|ERR_INTERNET_DISCONNECTED/.test(t))return;run.errors.push(t.slice(0,300));});
  page.on('pageerror',e=>run.errors.push('pageerror: '+String(e&&e.stack||e).slice(0,400)));
  page.on('dialog',async d=>{run.errors.push('dialog: '+d.message());await d.dismiss().catch(()=>{});});
  if(query!=null)await go(run,query);
  return run;
}
async function go(run,query){run.last='goto '+query;await run.page.goto(`http://localhost:${run.port}/test/dev/?`+query,{waitUntil:'load'});await sleep(700);}
async function closeRun(run,scen){if(scen)check(scen,'bez błędów w konsoli',!run.errors.length,run.errors.slice(0,3).join(' | '));try{await run.ctx.close();}catch(e){}}
async function find(run,sel,text,o={}){
  return run.page.evaluateHandle((sel,text,nth,exact)=>{
    const N=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
    const vis=e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none';};
    const els=[...document.querySelectorAll(sel)].filter(e=>vis(e)&&(!text||(exact?N(e.textContent)===N(text):N(e.textContent).includes(N(text)))));
    return els[nth<0?els.length+nth:nth]||null;},sel,text||'',o.nth||0,!!o.exact).then(h=>h.asElement());
}
async function waitFor(run,sel,text,timeout=8000,o={}){const t0=Date.now();while(Date.now()-t0<timeout){let el=null;try{el=await find(run,sel,text,o);}catch(e){}if(el)return el;await sleep(100);}throw new Error(`nie pojawiło się: ${sel}${text?' „'+text+'”':''} (${run.last})`);}
async function has(run,sel,text){try{return !!(await find(run,sel,text));}catch(e){return false;}}
async function tap(run,sel,text,o={}){
  run.last=`tap ${sel}${text?' „'+text+'”':''}`;
  const el=await waitFor(run,sel,text,o.timeout||8000,o);
  await el.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest'}));
  await el.evaluate(e=>e.click());await sleep(o.settle??260);return el;
}
async function shot(run,name){await sleep(300);NN++;const f=String(NN).padStart(2,'0')+'-'+name+'.png';await run.page.screenshot({path:path.join(OUT,f)});console.log('    zrzut',f);return f;}
const ev=(run,fn,...a)=>run.page.evaluate(fn,...a);
const textOf=(run,sel)=>ev(run,sel=>{const e=document.querySelector(sel);return e?e.textContent.replace(/\s+/g,' ').trim():null;},sel);
/* przedmiot: od planu-media (D6) zamiast ścieżki z zakładkami jest centrum przedmiotu (hub); narzędzia (Fiszki, Quiz, Ćwiczenia, Egzamin) otwiera
   NaukaEngine.openSubject(sid, tab) — tak jak kafle „CAŁY PRZEDMIOT”, a lekcję poziomu — openLevel(sid, lid) (pierwszy niezaliczony = dawny węzeł „ZACZNIJ”) */
async function openSubj(run,name){await waitFor(run,'.plan',null,15000);
  run.sid=await ev(run,n=>{const s=NaukaEngine.subjects().find(x=>String(x.name).includes(n));return s?s.id:null;},name);if(!run.sid)throw new Error('brak przedmiotu „'+name+'”');
  await ev(run,id=>NaukaEngine.openSubject(id),run.sid);await waitFor(run,'.hhead');}
async function toToday(run){run.last='Dziś';await ev(run,()=>NaukaEngine.go('today'));await waitFor(run,'.plan',null,15000);}
const hubText=run=>ev(run,()=>document.body.innerText||'');
async function openDone(run){run.last='powtórka zaliczonego poziomu (dawny węzeł „zrobione”)';
  await ev(run,id=>{const s=NaukaEngine.subject(id);let P={};try{P=JSON.parse(localStorage.getItem('nauka_progress_v1:'+window.NAUKA_UID)||'{}');}catch(e){}
    const done=((P[id]||{}).levels)||{};const lv=s.levels.find(l=>(done[l.id]||{}).done);if(lv)NaukaEngine.openLevel(id,lv.id);},run.sid);await sleep(500);}
const TABS={'Ścieżka':'hub','Fiszki':'fiszki','Quiz':'quiz','Ćwiczenia':'cwicz','Egzamin':'egzamin','Info':'info'};
async function subTab(run,label){run.last='zakładka '+label;await ev(run,(id,t)=>NaukaEngine.openSubject(id,t),run.sid,TABS[label]||label);await sleep(400);}
async function openNode(run){run.last='lekcja (dawny węzeł ścieżki)';
  const ok=await ev(run,id=>{const s=NaukaEngine.subject(id);if(!s)return false;let P={};try{P=JSON.parse(localStorage.getItem('nauka_progress_v1:'+window.NAUKA_UID)||'{}');}catch(e){}
    const done=((P[id]||{}).levels)||{};const lv=s.levels.find(l=>!(done[l.id]||{}).done)||s.levels[0];NaukaEngine.openLevel(id,lv.id);return true;},run.sid);
  if(!ok)throw new Error('openNode: brak przedmiotu');await sleep(500);}
/* przesunięcie zegara strony o n dni (jak powrót po nocy w tle) */
const shiftDays=(run,n)=>ev(run,n=>{const RD=window.__RD||Date;window.__RD=RD;const off=(window.__off||0)+n*86400000;window.__off=off;
  class D extends RD{constructor(...a){if(a.length)super(...a);else super(RD.now()+off);}static now(){return RD.now()+off;}}window.Date=D;},n);
/* czat: przejście przez części, aż w czacie będzie `until` części albo przycisk „CZAS NA PYTANIA” (wtedy go stuka) */
async function chatTo(run,until){
  for(let g=0;g<80;g++){
    await waitFor(run,'.chatfoot .creply:not([disabled])',null,15000);
    const labels=await run.page.$$eval('.chatfoot .creply',bs=>bs.map(b=>b.textContent.trim()));
    const parts=await run.page.$$eval('.chat .cdose',s=>s.length);
    if(until&&parts>=until)return parts;
    if(labels.some(l=>/CZAS NA PYTANIA|ZAKOŃCZ/.test(l))){await sleep(400);await tap(run,'.chatfoot .creply',labels.find(l=>/CZAS NA PYTANIA|ZAKOŃCZ/.test(l)));return -1;}
    await sleep(380);await tap(run,'.chatfoot .creply',labels[0],{exact:true,settle:250});
  }
  throw new Error('czat: za dużo kroków');
}
async function solve(run,o={}){
  run.last='solve';
  return run.page.evaluate(async(kb,o)=>{
    const N=s=>String(s==null?'':s).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().toLowerCase();
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
    const wrong=!!o.wrong,submit=o.submit!==false;
    const taskEl=document.querySelector('.task'),quizEl=document.querySelector('.quiz');
    const checkBtn=()=>$$('#qcheck, .tfoot .pill, .lessonfoot .pill').find(b=>!b.disabled&&!b.classList.contains('hide')&&/SPRAWDŹ|PRZYPISZ|POŁĄCZ/i.test(b.textContent));
    const check=async()=>{if(!submit)return;await sleep(80);const b=checkBtn();if(b)b.click();};
    if(quizEl&&!taskEl){
      const q=N(quizEl.querySelector('.qq')&&quizEl.querySelector('.qq').textContent),ans=kb.quiz[q];
      if(quizEl.classList.contains('qtf')){const cand=N(quizEl.querySelector('.qtfcand .t').textContent);let yes=ans==null?true:cand===ans;if(wrong)yes=!yes;
        quizEl.querySelector(yes?'.tfyes':'.tfno').click();await check();return {kind:'quiz-tf',known:ans!=null};}
      const opts=$$('.qopt',quizEl);let pick=opts.find(x=>N(x.querySelector('.t').textContent)===ans);
      if(wrong)pick=opts.find(x=>x!==pick)||opts[0];if(!pick)pick=opts[0];
      pick.click();await check();return {kind:'quiz',known:ans!=null};
    }
    if(!taskEl)return {kind:'none'};
    const type=kb.labels[N(taskEl.querySelector('.tchip')&&taskEl.querySelector('.tchip').textContent)]||'?';
    const T=kb.tasks.filter(t=>t.type===type);
    const same=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
    const waitChange=async(get,ms)=>{const b=get();const t0=Date.now();while(Date.now()-t0<ms){await sleep(80);if(!taskEl.isConnected||document.getElementById('sheet')||get()!==b)return;}};
    if(type==='tf'){
      const all=T.flatMap(t=>t.statements||[]);
      for(let k=0;k<20;k++){const c=taskEl.querySelector('.tfq');if(!c||!taskEl.isConnected||document.getElementById('sheet'))break;
        const st=all.find(x=>N(x.s)===N(c.textContent));let v=st?!!st.v:true;if(wrong&&k===0)v=!v;
        const b=document.querySelector(v?'.tfbtn.yes':'.tfbtn.no');if(!b)break;b.click();await waitChange(()=>N((taskEl.querySelector('.tfq')||{}).textContent),2600);}
      return {kind:type};}
    if(type==='fill'){
      const txt=N(taskEl.querySelector('.filltxt').textContent);const t=T.find(x=>N(String(x.text).replace(/\{\d+\}/g,'?'))===txt)||T[0];
      const blanks=(t.blanks||[]).slice();
      for(let k=0;k<blanks.length;k++){const tiles=$$('.bank .wordtile:not(.used)',taskEl);let tile=tiles.find(x=>N(x.textContent)===N(blanks[k]));if(wrong&&k===0)tile=tiles.find(x=>x!==tile)||tile;if(!tile)tile=tiles[0];if(!tile)break;tile.click();await sleep(30);}
      await check();return {kind:type};}
    if(type==='match'){
      const lefts=$$('.mbtn.l',taskEl).map(b=>N(b.textContent));const t=T.find(x=>same((x.pairs||[]).map(p=>N(p[0])),lefts))||T[0];
      if(wrong&&t.pairs.length>1){$$('.mbtn.l',taskEl).find(b=>N(b.textContent)===N(t.pairs[0][0])).click();$$('.mbtn.r',taskEl).find(b=>N(b.textContent)===N(t.pairs[1][1])).click();await sleep(1100);}
      for(const [l,r] of t.pairs){const L=$$('.mbtn.l:not(.done)',taskEl).find(b=>N(b.textContent)===N(l));const R=$$('.mbtn.r:not(.done)',taskEl).find(b=>N(b.textContent)===N(r));if(!L||!R)continue;L.click();R.click();await sleep(60);}
      return {kind:type};}
    if(type==='order'){
      const set=$$('.otxt',taskEl).map(e=>N(e.textContent));const t=T.find(x=>same((x.items||[]).map(N),set))||T[0];
      const target=wrong?t.items.slice().reverse():t.items;
      for(let i=0;i<target.length;i++){let idx=$$('.orderitem',taskEl).findIndex(r=>N(r.querySelector('.otxt').textContent)===N(target[i]));for(let k=idx;k>i;k--){$$('.orderitem',taskEl)[k].querySelectorAll('.ud')[0].click();await sleep(10);}}
      if(submit){await sleep(80);const b=$$('.tfoot .pill, .lessonfoot .pill').find(b=>/KOLEJNOŚĆ/.test(b.textContent));if(b)b.click();}
      return {kind:type};}
    if(type==='sort'){
      const names=$$('.bhead',taskEl).map(e=>N(e.textContent));const t=T.find(x=>same((x.buckets||[]).map(b=>N(b.name)),names))||T[0];
      const map={};t.buckets.forEach(b=>(b.items||[]).forEach(it=>{map[N(it)]=N(b.name);}));
      for(let k=0;k<30;k++){const tile=$$('.bank.pool .wordtile',taskEl)[0];if(!tile)break;const want=map[N(tile.textContent)];tile.click();await sleep(20);
        const bs=$$('.bucket',taskEl);let bx=bs.find(b=>N(b.querySelector('.bhead').textContent)===want);if(wrong&&k===0)bx=bs.find(b=>b!==bx)||bx;(bx||bs[0]).click();await sleep(20);}
      await check();return {kind:type};}
    if(type==='typeterm'){
      const def=N(taskEl.querySelector('.deftext').textContent);const t=T.find(x=>N(x.definition)===def)||T[0];
      const inp=taskEl.querySelector('input.terminput');inp.value=wrong?'nie pamiętam tego':t.answer;inp.dispatchEvent(new Event('input',{bubbles:true}));await check();return {kind:type};}
    if(type==='swipe'){
      const cards=T.flatMap(t=>t.cards||[]);
      for(let k=0;k<20;k++){const f=taskEl.querySelector('.sfront');if(!f||!taskEl.isConnected||document.getElementById('sheet'))break;const c=cards.find(x=>N(x.front)===N(f.textContent));
        let right=c?c.side==='right':true;if(wrong&&k===0)right=!right;const b=document.querySelector(right?'.swbtn.r':'.swbtn.l');if(!b)break;b.click();await waitChange(()=>N((taskEl.querySelector('.sfront')||{}).textContent)+'|'+(taskEl.querySelector('.tcount')||{}).textContent,1600);}
      return {kind:type};}
    if(type==='thesis'){
      const th=N(taskEl.querySelector('.thtext').textContent);const t=T.find(x=>N(x.thesis)===th)||T[0];const good=N((t.options[t.c]||{}).name);
      const bs=$$('.thopt',taskEl);let b=bs.find(x=>N(x.querySelector('.n').textContent)===good);if(wrong)b=bs.find(x=>x!==b)||b;(b||bs[0]).click();await check();return {kind:type};}
    if(type==='scenario'||type==='chart'){
      const key=type==='scenario'?N(taskEl.querySelector('.scenetext').textContent):N(taskEl.querySelector('.ttitle.sm').textContent);
      const t=T.find(x=>N(type==='scenario'?x.scene:x.q)===key)||T[0];const good=N((t.a||[])[t.c]);
      const bs=$$('.qopt',taskEl);let b=bs.find(x=>N(x.querySelector('.t').textContent)===good);if(wrong)b=bs.find(x=>x!==b)||b;(b||bs[0]).click();await check();return {kind:type};}
    if(type==='finderror'){
      const sents=$$('.errsent',taskEl).map(e=>N(e.textContent));const t=T.find(x=>same((x.sentences||[]).map(N),sents))||T[0];
      const bs=$$('.errsent',taskEl);const w=t.wrong|0;(bs[wrong?(w+1)%bs.length:w]||bs[0]).click();await check();return {kind:type};}
    if(type==='timeline'){
      const pool=()=>$$('.bank.pool .wordtile',taskEl);const labels=pool().map(e=>N(e.textContent));const t=T.find(x=>labels.every(l=>(x.events||[]).some(e=>N(e.label)===l)))||T[0];
      for(let k=0;k<12;k++){const slot=taskEl.querySelector('.tlslot.empty');if(!slot)break;const year=N(slot.closest('.tlrow').querySelector('.tlyear').textContent);
        const cands=t.events.filter(e=>N(String(e.year))===year).map(e=>N(e.label));let tile=pool().find(x=>cands.includes(N(x.textContent)));if(wrong&&k===0)tile=pool().find(x=>x!==tile)||tile;if(!tile)tile=pool()[0];if(!tile)break;
        tile.click();await sleep(20);const s2=taskEl.querySelector('.tlslot.empty.cur')||taskEl.querySelector('.tlslot.empty');if(s2)s2.click();await sleep(20);}
      await check();return {kind:type};}
    if(type==='chain'){
      const given=$$('.chstep.given',taskEl).map(e=>N(e.textContent));const t=T.find(x=>given.every(g=>(x.steps||[]).map(N).includes(g)))||T[0];
      const gs=new Set((t.given||[]).map(Number));const need=t.steps.filter((s,k)=>!gs.has(k));if(wrong&&need.length>1)need.reverse();
      for(const s of need){const tile=$$('.bank.pool .wordtile:not(.used)',taskEl).find(x=>N(x.textContent)===N(s))||$$('.bank.pool .wordtile:not(.used)',taskEl)[0];if(!tile)break;tile.click();await sleep(20);}
      await check();return {kind:type};}
    if(type==='mathsteps'){
      const st=N(taskEl.querySelector('.mrow.start .mexpr').textContent);const t=T.find(x=>N(x.start)===st)||T[0];
      for(let k=0;k<20;k++){const opts=$$('.mopt:not([disabled])',taskEl);if(!opts.length||!taskEl.isConnected)break;const i=$$('.mathcard .mrow.ok',taskEl).length;const s=t.steps[i];if(!s)break;
        let b=opts.find(x=>N(x.textContent)===N(s.options[s.c]));if(wrong&&k===0)b=opts.find(x=>x!==b)||b;(b||opts[0]).click();await sleep(30);
        const c=$$('.tfoot .pill, .lessonfoot .pill').find(x=>!x.disabled&&/SPRAWDŹ/.test(x.textContent));if(c)c.click();await sleep(60);}
      return {kind:type};}
    // hotspot / nieznane: „pokaż” albo pierwszy przycisk
    const any=$$('.tfoot .pill, .lessonfoot .pill').find(b=>!b.disabled);if(any)any.click();return {kind:type,unknown:true};
  },KB,o);
}
async function sheetAfter(run,timeout=15000){ // czeka na panel dobrze/źle (lekcja, quiz, Ćwiczenia)
  const el=await waitFor(run,'#sheet.ok, #sheet.bad, #sheet.nohearts',null,timeout);return el.evaluate(e=>e.classList.contains('ok')?'ok':e.classList.contains('bad')?'bad':'nohearts');
}


/* ============================================================ scenariusze */
const SCEN={};

/* P1-7: „Popraw pytanie” w przeglądzie egzaminu — zapis bez zmian nie zmienia wyniku; prawdziwa poprawka przelicza */
SCEN.exam=async()=>{
  const S='exam';const r=await newRun(S,'mock=seeded&reset=1');
  await openSubj(r,'Polityka');await subTab(r,'Egzamin');await waitFor(r,'#exstart');
  await tap(r,'#egn .egchip[data-n="10"]');await tap(r,'#exstart');await waitFor(r,'.egrun');
  const picks=[];
  for(let k=0;k<12;k++){
    const p=await ev(r,(kb,k)=>{const N=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().toLowerCase();
      const q=N(document.querySelector('.egrun .qq').textContent),ans=kb.quiz[q];const os=[...document.querySelectorAll('.egrun .qopt')];
      let o=os.find(x=>N(x.querySelector('.t').textContent)===ans);const good=o;if(k%3===1||!o)o=os.find(x=>x!==good)||os[0];o.click();
      const t=N(o.querySelector('.t').textContent);return {q,picked:t,ok:t===ans,known:ans!=null};},KB,k);
    picks.push(p);
    const last=await textOf(r,'#egnext');await sleep(380);await tap(r,'#egnext',null,{settle:380});
    if(/ZAKOŃCZ/.test(last||''))break;
  }
  await waitFor(r,'#egfin');await tap(r,'#egfin');await waitFor(r,'.egres');
  const score=async()=>(await textOf(r,'.eghero .rvpct span'))||'';
  const s0=await score(),M=picks.length,exp=picks.filter(p=>p.ok).length;
  check(S,'wynik = liczba dobrych odpowiedzi',s0===exp+'/'+M&&picks.every(p=>p.known),`${s0} (oczekiwane ${exp}/${M})`);
  const yours=await ev(r,()=>[...document.querySelectorAll('.egitem.bad .rbad')].map(e=>e.textContent.replace(/\s+/g,' ').trim().toLowerCase()));
  const wrongPicks=picks.filter(p=>!p.ok).map(p=>p.picked);
  check(S,'„Twoja:” pokazuje wybraną odpowiedź',yours.length===wrongPicks.length&&yours.every(y=>wrongPicks.some(w=>y.includes(w))),yours.join(' | ').slice(0,300));
  await shot(r,'exam-result');
  const drift=[];
  for(let i=0;i<M;i++){
    await tap(r,`.egedit[data-i="${i}"]`);await waitFor(r,'#edsave');await tap(r,'#edsave',null,{settle:350});
    const s=await score();if(s!==s0)drift.push(`po pytaniu ${i+1}: ${s}`);
  }
  check(S,`ZAPISZ ZMIANY bez edycji w ${M} pytaniach nie zmienia wyniku`,!drift.length,drift.join('; ')||s0);
  const yours2=await ev(r,()=>[...document.querySelectorAll('.egitem.bad .rbad')].map(e=>e.textContent.replace(/\s+/g,' ').trim().toLowerCase()));
  check(S,'po zapisach „Twoja:” nadal ta sama',JSON.stringify(yours2)===JSON.stringify(yours),yours2.join(' | ').slice(0,300));
  if(await has(r,'.egitem .rsrc')){await tap(r,'.egitem .rsrc');await tap(r,'#srcbad');await waitFor(r,'#edsave');await tap(r,'#edsave',null,{settle:350});
    const s=await score();check(S,'„Źródło → Pytanie jest złe → zapis” bez zmian nie zmienia wyniku',s===s0,s);}
  const okIdx=await ev(r,()=>{const e=document.querySelector('.egitem.ok');return e?+e.dataset.i:-1;});
  if(okIdx>=0){
    await tap(r,`.egedit[data-i="${okIdx}"]`);await waitFor(r,'#edsave');
    await ev(r,()=>{const rs=[...document.querySelectorAll('.edradio')];const on=rs.findIndex(x=>x.getAttribute('aria-checked')==='true');rs[(on+1)%rs.length].click();});
    await tap(r,'#edsave',null,{settle:350});const s1=await score();
    check(S,'zmiana poprawnej odpowiedzi przelicza wynik (−1)',s1===(exp-1)+'/'+M,s1);
    await shot(r,'exam-after-real-edit');
    await tap(r,`.egedit[data-i="${okIdx}"]`);await waitFor(r,'#edreset');await tap(r,'#edreset',null,{settle:350});const s2=await score();
    check(S,'„Przywróć oryginał” przywraca wynik',s2===s0,s2);
  }
  await closeRun(r,S);
};

/* P1-8: zamrożenie i zmiana dnia po powrocie z tła */
SCEN.day=async()=>{
  const S='day';let r=await newRun(S,'mock=seeded&reset=1');await waitFor(r,'.plan',null,15000);await sleep(1500);
  const m0=await ev(r,()=>({...NaukaEngine.meta()}));const h0=await textOf(r,'.todayhead .eyebrow');
  await shiftDays(r,1);
  await ev(r,()=>document.dispatchEvent(new Event('visibilitychange')));await sleep(700);
  const m1=await ev(r,()=>({...NaukaEngine.meta()}));const h1=await textOf(r,'.todayhead .eyebrow');const v1=await ev(r,()=>NaukaEngine.view);
  check(S,'powrót z tła po nocy: zamrożenie zużyte, seria zostaje',m1.freezes===(m0.freezes|0)-1&&m1.streak===m0.streak&&(m1.frozenDays||[]).length===(m0.frozenDays||[]).length+1,
    JSON.stringify({przed:{seria:m0.streak,zamr:m0.freezes,ostatni:m0.lastDay},po:{seria:m1.streak,zamr:m1.freezes,ostatni:m1.lastDay,dni:m1.frozenDays}}));
  check(S,'ekran główny przerysowany na nowy dzień',v1==='weekly'||(h1&&h1!==h0),`${h0} → ${h1} (${v1})`);
  await sleep(1200);await shot(r,'day-rollover-today');
  await openSubj(r,'Polityka');await subTab(r,'Fiszki');await waitFor(r,'#subjscreen .flip');
  await tap(r,'#subjscreen .flip');await sleep(1000);await tap(r,'.fbtn.yes',null,{settle:600});
  const m2=await ev(r,()=>({...NaukaEngine.meta()}));
  check(S,'pierwsze XP nowego dnia przedłuża serię',m2.streak===m0.streak+1,`seria ${m0.streak} → ${m2.streak}`);
  await closeRun(r,S);
  r=await newRun(S,'mock=seeded&reset=1');await waitFor(r,'.plan',null,15000);await sleep(1500);
  const n0=await ev(r,()=>({...NaukaEngine.meta()}));
  await openSubj(r,'Polityka');await subTab(r,'Fiszki');await waitFor(r,'#subjscreen .flip');
  await shiftDays(r,1);
  await tap(r,'#subjscreen .flip');await sleep(1000);await tap(r,'.fbtn.yes',null,{settle:600});
  const n1=await ev(r,()=>({...NaukaEngine.meta()}));
  check(S,'XP po nocy bez zdarzenia z tła: zamrożenie działa w touchStreak (seria +1, nie od 1)',n1.streak===n0.streak+1&&n1.freezes===(n0.freezes|0)-1,
    JSON.stringify({seria:`${n0.streak} → ${n1.streak}`,zamr:`${n0.freezes} → ${n1.freezes}`,ostatni:n1.lastDay}));
  await closeRun(r,S);
};

/* P1-9: pasek „Brak sieci” i pasek pamięci */
SCEN.offline=async()=>{
  const S='offline';const r=await newRun(S,'mock=seeded&reset=1');await waitFor(r,'.plan',null,15000);await sleep(1200);
  await r.page.setOfflineMode(true);await sleep(700);
  const g=()=>ev(r,()=>{const b=document.getElementById('netbar');const br=b.getBoundingClientRect(),ar=document.getElementById('app').getBoundingClientRect();
    return {on:b.classList.contains('on'),h:Math.round(br.height),bottom:Math.round(br.bottom),appTop:Math.round(ar.top),barOn:document.body.classList.contains('bar-on'),text:b.textContent.trim()};});
  const a=await g();
  check(S,'offline: pasek widoczny, jedna linia',a.on&&a.h<=40,JSON.stringify(a));
  check(S,'offline: #app zaczyna się pod paskiem',a.appTop>=a.bottom-1,JSON.stringify(a));
  await shot(r,'offline-today');
  await openSubj(r,'Polityka');await sleep(300);await shot(r,'offline-subject');
  const bk=await ev(r,()=>{const b=(document.querySelector('.brow .backbtn')||document.querySelector('.htop .hicon')).getBoundingClientRect();const n=document.getElementById('netbar').getBoundingClientRect();return {back:Math.round(b.top),bar:Math.round(n.bottom)};});
  check(S,'offline: „Wróć” w przedmiocie nie jest pod paskiem',bk.back>=bk.bar,JSON.stringify(bk));
  await r.page.setOfflineMode(false);await sleep(900);
  const b=await g();const t=await textOf(r,'#toast.show span');
  check(S,'online: pasek znika, #app wraca na górę',!b.on&&!b.barOn&&b.appTop<=2,JSON.stringify(b));
  check(S,'online: toast „Sieć wróciła”',/Sieć wróciła/.test(t||''),t);
  await shot(r,'online-again');
  await closeRun(r,S);
  const q=await newRun(S,'mock=fresh&reset=1&nostore=1');await waitFor(q,'#cf-go',null,15000);await sleep(400);
  const sb=()=>ev(q,()=>{const b=document.getElementById('storebar');const br=b.getBoundingClientRect();return {h:Math.round(br.height),bottom:Math.round(br.bottom),appTop:Math.round(document.getElementById('app').getBoundingClientRect().top),txt:b.textContent.replace(/\s+/g,' ').trim().slice(0,80)};});
  const s1=await sb();
  check(S,'pasek pamięci: jedna linia, #app pod nim',s1.h<=44&&s1.appTop>=s1.bottom-1,JSON.stringify(s1));
  await shot(q,'storebar-collapsed');
  await tap(q,'#storebar .sbm');const s2=await sb();
  check(S,'pasek pamięci: „Więcej” rozwija, #app nadal pod paskiem',s2.h>s1.h&&s2.appTop>=s2.bottom-1,JSON.stringify(s2));
  await shot(q,'storebar-open');
  await closeRun(q);
};

/* P1-23: toasty — kolejka, cisza przy arkuszu, pozycja nad arkuszem i paskiem, zawijanie */
SCEN.toasts=async()=>{
  const S='toasts';const r=await newRun(S,'mock=seeded&reset=1');await waitFor(r,'.plan',null,15000);await sleep(3000);
  await ev(r,()=>{NaukaEngine.openQuickAdd();NaukaEngine._notify('Nagroda A','star');NaukaEngine._notify('Nagroda B','gem');NaukaEngine._notify('Nagroda A','star');});
  await sleep(1000);
  const t1=await textOf(r,'#toast.show span');
  check(S,'nagroda czeka, gdy arkusz jest otwarty',!/Nagroda/.test(t1||''),t1);
  await ev(r,()=>NaukaEngine.toast('Odpowiedź na gest — od razu','info'));await sleep(450);
  const pos=await ev(r,()=>{const t=document.getElementById('toast').getBoundingClientRect(),s=document.getElementById('sheet').getBoundingClientRect();return {tb:Math.round(t.bottom),st:Math.round(s.top),show:document.getElementById('toast').classList.contains('show')};});
  check(S,'toast z gestu: od razu i nad arkuszem',pos.show&&pos.tb<=pos.st,JSON.stringify(pos));
  await shot(r,'toast-over-sheet');
  await ev(r,()=>NaukaEngine.closeSheet());
  const seen=[];const t0=Date.now();
  while(Date.now()-t0<11000){const t=await textOf(r,'#toast.show span');if(t&&seen[seen.length-1]!==t)seen.push(t);await sleep(120);}
  check(S,'po zamknięciu arkusza nagrody po kolei, bez powtórek',seen.filter(t=>/Nagroda/.test(t)).join('|')==='Nagroda A|Nagroda B',seen.join(' → '));
  const long='Plik „bardzo-dlugi-skan-rozdzialu-z-podrecznika-do-historii.pdf” jest za duży — maksymalnie 50 MB na plik. Zmniejsz go albo podziel na części.';
  await ev(r,t=>NaukaEngine.toast(t,'alert'),long);await sleep(450);
  const w=await ev(r,()=>{const e=document.getElementById('toast');const b=e.getBoundingClientRect(),a=document.getElementById('app').getBoundingClientRect(),n=document.querySelector('.nav').getBoundingClientRect();return {l:Math.round(b.left),r:Math.round(b.right),h:Math.round(b.height),al:Math.round(a.left),ar:Math.round(a.right),tb:Math.round(b.bottom),nt:Math.round(n.top)};});
  check(S,'długi toast zawija się w ekranie (bez ucięcia)',w.l>=w.al+15&&w.r<=w.ar-15&&w.h>40,JSON.stringify(w));
  check(S,'toast nad dolnym paskiem',w.tb<=w.nt,JSON.stringify(w));
  await shot(r,'toast-long');
  const ms=await ev(r,()=>{const t0=performance.now();return new Promise(res=>{const e=document.getElementById('toast');const iv=setInterval(()=>{if(!e.classList.contains('show')){clearInterval(iv);res(Math.round(performance.now()-t0));}},50);});});
  check(S,'długi toast widoczny dłużej (≈ 1,5 s + 40 ms/znak, maks. 5 s)',ms>=4000&&ms<=5600,ms+' ms');
  await closeRun(r,S);
};

/* P1-11: przerwanie i wznowienie lekcji; powtórka zaliczonego poziomu od pytań */
SCEN.resume=async()=>{
  const S='resume';const r=await newRun(S,'mock=seeded&reset=1');
  await openSubj(r,'Polityka');await openNode(r);await waitFor(r,'#lesson.open .chat');
  await chatTo(r,3);
  const tl=await textOf(r,'#toast.show span');check(S,'w trakcie lekcji bez toastów z nagrodami',!/Seria|Misja|Plan dnia|Odznaka|albumu/.test(tl||''),tl);
  await tap(r,'#lesson .lessonhead .x',null,{settle:500});
  const t=await textOf(r,'#toast.show span');
  check(S,'X: lekcja zamknięta, komunikat o zapisanym miejscu',!(await has(r,'#lesson.open'))&&/Miejsce zapisane/.test(t||''),t);
  const bub=/DOKOŃCZ LEKCJĘ/.test(await hubText(r));check(S,'centrum: NA TERAZ „DOKOŃCZ LEKCJĘ” (dawny dymek DOKOŃCZ na ścieżce)',bub,'');
  await shot(r,'hub-resume-card');
  await openNode(r);await waitFor(r,'#sheet.resume');const sp=await textOf(r,'#sheet .sp');
  check(S,'arkusz „Dokończyć lekcję?” mówi, gdzie się zatrzymało',/części 3 z/.test(sp||''),sp);
  await shot(r,'resume-sheet');
  await tap(r,'#rsgo');await waitFor(r,'#lesson.open .chat');await sleep(900);
  const head=await ev(r,()=>[...document.querySelectorAll('.cdhead .cdn')].map(e=>e.textContent));const cdiv=await textOf(r,'.chat .cdiv');
  check(S,'wznowienie: czat od zapisanej części',/Część 3 z/.test(head[0]||'')&&/Wracamy od części 3/.test(cdiv||''),head.join(',')+' | '+cdiv);
  await shot(r,'resume-chat');
  await chatTo(r,0);
  await waitFor(r,'#lesson.open .quiz, #lesson.open .task',null,8000);
  for(let k=0;k<2;k++){await solve(r);await sheetAfter(r);await sleep(400);await tap(r,'#snext',null,{settle:500});}
  await go(r,'mock=seeded'); // jak zabicie apki w tle
  await openSubj(r,'Polityka');check(S,'po przeładowaniu: NA TERAZ „DOKOŃCZ LEKCJĘ”',/DOKOŃCZ LEKCJĘ/.test(await hubText(r)),'');
  await openNode(r);await waitFor(r,'#sheet.resume');const sp2=await textOf(r,'#sheet .sp');
  check(S,'po przeładowaniu zapis przetrwał (pytanie 3)',/pytaniu 3 z/.test(sp2||''),sp2);
  await tap(r,'#rsgo');await waitFor(r,'#lesson.open .quiz, #lesson.open .task',null,8000);
  const c2=await textOf(r,'#lesson .qchips');const steps=await ev(r,()=>document.querySelectorAll('#lesson .segbar i.on, #lesson .segbar i.bad').length);
  check(S,'wznowienie w pytaniach: „… 3 z …”, pasek z przerobionymi krokami',/ 3 z /.test(c2||'')&&steps>=2,c2+' | kroki '+steps);
  await shot(r,'resume-quiz');
  await tap(r,'#lesson .lessonhead .x',null,{settle:400});
  await openNode(r);await waitFor(r,'#sheet.resume');await tap(r,'#rsnew');await waitFor(r,'#lesson.open .chat');await sleep(700);
  const h3=await ev(r,()=>[...document.querySelectorAll('.cdhead .cdn')].map(e=>e.textContent));
  check(S,'„Od nowa”: czat od części 1',/Część 1 z/.test(h3[0]||''),h3.join(','));
  await tap(r,'#lesson .lessonhead .x',null,{settle:400});
  check(S,'X w pierwszej części: bez zapisu',!/DOKOŃCZ LEKCJĘ/.test(await hubText(r)),'');
  await openDone(r);await waitFor(r,'#lesson.open .quiz, #lesson.open .task',null,8000);
  check(S,'powtórka zaliczonego poziomu zaczyna się od pytań, z „Przeczytaj jeszcze raz”',!(await has(r,'#lesson .chat'))&&await has(r,'#lreread'),'');
  await shot(r,'replay-from-questions');
  await tap(r,'#lreread');await waitFor(r,'#lesson.open .chat');check(S,'„Przeczytaj jeszcze raz” otwiera czat',true,'');
  await tap(r,'#lesson .lessonhead .x',null,{settle:400});
  // lekcja do końca: zapis znika, a nagroda (seria) pokazuje się na ekranie wyniku
  await openNode(r);if(await has(r,'#sheet.resume'))await tap(r,'#rsnew');await waitFor(r,'#lesson.open .chat');
  await chatTo(r,0);
  for(let k=0;k<20&&!(await has(r,'.lessonbody.done .lc'));k++){await waitFor(r,'#lesson.open .quiz, #lesson.open .task, .lessonbody.done .lc',null,8000);if(await has(r,'.lessonbody.done .lc'))break;await solve(r);await sheetAfter(r);await sleep(400);await tap(r,'#snext',null,{settle:500});}
  await waitFor(r,'.lessonbody.done .lc',null,8000);
  const seen=[];const t0=Date.now();while(Date.now()-t0<6000){const x=await textOf(r,'#toast.show span');if(x&&seen[seen.length-1]!==x)seen.push(x);await sleep(150);}
  check(S,'nagrody z lekcji pokazują się na ekranie wyniku',seen.length>0,seen.join(' → '));
  await shot(r,'level-complete-toasts');
  const left=await ev(r,()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('nauka_progress_v1:'));const p=JSON.parse(localStorage.getItem(k)||'{}');return p.lessonSave||'';});
  check(S,'po wyniku poziomu zapis miejsca usunięty',!/t[0-9a-f]{8}_l4/.test(left),left.slice(0,120));
  await closeRun(r,S);
};

/* P1-17: ocena fiszki dopiero po odwróceniu */
SCEN.cards=async()=>{
  const S='cards';const r=await newRun(S,'mock=seeded&reset=1');
  await openSubj(r,'Polityka');await subTab(r,'Fiszki');await waitFor(r,'#subjscreen .flip');
  const cnt=()=>textOf(r,'#subjscreen .counter');const c0=await cnt();
  check(S,'przyciski oceny przygaszone przed odwróceniem',await has(r,'.fbtns.wait'),'');
  await shot(r,'card-front-wait');
  await tap(r,'.fbtn.yes',null,{settle:150});
  const a=await ev(r,()=>({flipped:document.querySelector('#subjscreen .flip').classList.contains('flipped'),counter:document.querySelector('#subjscreen .counter').textContent}));
  check(S,'„umiem” na nieodwróconej karcie tylko ją odwraca',a.flipped&&a.counter===c0,JSON.stringify(a));
  await shot(r,'card-flipped-wait');
  await tap(r,'.fbtn.yes',null,{settle:50});const b=await cnt();
  await sleep(1100);const c=await cnt();
  check(S,'stuknięcie tuż po odwróceniu: ocena po chwili, jeden raz',b===c0&&parseInt(c)===parseInt(c0)+1,`${c0} → ${b} → ${c}`);
  const sw=await ev(r,async()=>{const f=document.querySelector('#subjscreen .flip');const rr=f.getBoundingClientRect();const y=rr.top+rr.height/2;
    f.dispatchEvent(new PointerEvent('pointerdown',{clientX:rr.left+40,clientY:y,bubbles:true}));f.dispatchEvent(new PointerEvent('pointerup',{clientX:rr.left+240,clientY:y,bubbles:true}));
    await new Promise(r=>setTimeout(r,120));return {flipped:document.querySelector('#subjscreen .flip').classList.contains('flipped'),counter:document.querySelector('#subjscreen .counter').textContent};});
  check(S,'przesunięcie nieodwróconej karty ją odwraca (bez oceny)',sw.flipped&&sw.counter===c,JSON.stringify(sw));
  await toToday(r);await tap(r,'.nav button','Powtórka');await tap(r,'#rvstart');await waitFor(r,'.rvrun .flip');
  const r0=await textOf(r,'.rvcount');await tap(r,'#rvyes',null,{settle:150});const r1=await textOf(r,'.rvcount');
  check(S,'powtórka: „umiem” bez odwrócenia nie ocenia',r0===r1&&await has(r,'.rvrun .flip.flipped'),`${r0} → ${r1}`);
  await sleep(1000);await tap(r,'#rvyes',null,{settle:300});const r2=await textOf(r,'.rvcount');
  check(S,'powtórka: po odwróceniu i chwili ocena działa',r2!==r0,`${r0} → ${r2}`);
  await closeRun(r,S);
};

/* P1-10 + „Powiedz prościej”: „Wyjaśnij inaczej” (stare vs nowe) i real w czacie */
async function explainDump(run){
  return ev(run,()=>{const out=[];const T=h=>{const t=document.createElement('template');t.innerHTML=String(h||'');return t.content.textContent.replace(/\s+/g,' ').trim();};
    NaukaEngine.subjects().forEach(s=>s.levels.forEach(lv=>(lv.quiz||[]).forEach((q,qi)=>{let ex={};try{ex=NaukaEngine._explainFor(q,s,lv)||{};}catch(e){ex={err:String(e)};}
      out.push({s:T(s.name),lv:T(lv.title),qi,q:T(q.q),a:T((q.a||[])[q.c]),card:ex.card?T(ex.card.t):null,frag:ex.frag?T(ex.frag).slice(0,160):null,real:ex.real?T(ex.real).slice(0,160):null,err:ex.err||null});})));return out;});
}
SCEN.explain=async()=>{
  const S='explain';const r=await newRun(S,'mock=seeded&reset=1&extra=viz');await waitFor(r,'.plan',null,15000);await sleep(1500);
  const now=await explainDump(r);
  check(S,'explainFor bez wyjątków',!now.some(x=>x.err),now.filter(x=>x.err).slice(0,2).map(x=>x.err).join(' | '));
  const st={pyt:now.length,karta:now.filter(x=>x.card).length,fragment:now.filter(x=>x.frag).length,prosciej:now.filter(x=>x.real).length,cokolwiek:now.filter(x=>x.card||x.frag||x.real).length};
  check(S,'statystyka (informacyjnie)',true,JSON.stringify(st));
  let diff=null;
  if(OLD){const o=await newRun(S+'-old','mock=seeded&reset=1&extra=viz',{port:PORT+1});await waitFor(o,'.plan',null,15000);await sleep(1500);
    const old=await explainDump(o);await closeRun(o);
    diff=now.map((x,i)=>({...x,oldCard:(old[i]||{}).card||null,oldFrag:(old[i]||{}).frag||null})).filter(x=>x.card!==x.oldCard||x.frag!==x.oldFrag);
    const ost={karta:old.filter(x=>x.card).length,fragment:old.filter(x=>x.frag).length,cokolwiek:old.filter(x=>x.card||x.frag).length};
    check(S,'porównanie ze starą wersją (informacyjnie)',true,`stare ${JSON.stringify(ost)} · zmienione pytania: ${diff.length}`);}
  fs.writeFileSync(path.join(OUT,'explain-now.json'),JSON.stringify(now,null,1));if(diff)fs.writeFileSync(path.join(OUT,'explain-diff.json'),JSON.stringify(diff,null,1));
  // UI: zła odpowiedź w zakładce Quiz → „Wyjaśnijmy inaczej” z „Prościej” na pierwszym miejscu
  await openSubj(r,'Polityka');await subTab(r,'Quiz');
  let shown=false;
  for(let k=0;k<12&&!shown;k++){await waitFor(r,'.quizview .quiz');await solve(r,{wrong:true});await sheetAfter(r);
    if(await has(r,'#sexpl')){await tap(r,'#sexpl');const lbls=await ev(r,()=>[...document.querySelectorAll('.exbox .lbl')].map(e=>e.textContent));
      if(lbls.includes('Prościej')){shown=true;check(S,'„Prościej” w arkuszu zaraz po poprawnej odpowiedzi',lbls[1]==='Prościej',lbls.join(' · '));await shot(r,'explain-sheet-real');}
      await tap(r,'#sok');}
    await tap(r,'#snext');}
  if(!shown)check(S,'„Prościej” w arkuszu „Wyjaśnijmy inaczej”',false,'nie wypadło w 12 złych odpowiedziach');
  await closeRun(r,S);
};
async function chatUntil(run,sel,maxParts=8){for(let g=0;g<40;g++){if(await has(run,sel))return true;
  await waitFor(run,'.chatfoot .creply:not([disabled])',null,15000);if(await has(run,sel))return true;const labels=await run.page.$$eval('.chatfoot .creply',bs=>bs.map(b=>b.textContent.trim()));
  if(labels.some(l=>/CZAS NA PYTANIA|ZAKOŃCZ/.test(l)))return false;await sleep(380);await tap(run,'.chatfoot .creply',labels[0],{exact:true,settle:250});}return false;}
SCEN.real=async()=>{
  const S='real';const r=await newRun(S,'mock=seeded&reset=1&extra=viz,xss');await waitFor(r,'.plan',null,15000);
  await openSubj(r,'Wizualizacje');await openNode(r);await waitFor(r,'#lesson.open .chat');
  const got=await chatUntil(r,'.chat .creal');
  if(got){const o=await ev(r,()=>{const c=document.querySelector('.chat .creal');return {open:c.classList.contains('open'),txt:c.querySelector('.crealtx').textContent};});
    check(S,'schemat z liczbami tylko w real: „Prościej” od razu rozwinięte',o.open&&/1918/.test(o.txt),JSON.stringify(o));
    await ev(r,()=>{const c=[...document.querySelectorAll('.chat .cviz')].pop()||document.querySelector('.chat .creal');c.scrollIntoView({block:'end'});});await shot(r,'chat-real-open-viz');}
  else check(S,'„Prościej” w czacie poziomu ze schematem',false,'nie pojawiło się');
  await tap(r,'#lesson .lessonhead .x');await toToday(r);
  await openSubj(r,'Polityka');await openNode(r);if(await has(r,'#sheet.resume'))await tap(r,'#rsnew');await waitFor(r,'#lesson.open .chat');
  const got2=await chatUntil(r,'.chat .creal');
  if(got2){const c1=await ev(r,()=>{const c=document.querySelector('.chat .creal');return {open:c.classList.contains('open'),hidden:c.querySelector('.crealtx').hidden,foot:[...document.querySelectorAll('.chatfoot .creply')].map(b=>b.textContent.trim())};});
    check(S,'„Prościej” zwinięte pod dawką, stopka bez nowych przycisków',!c1.open&&c1.hidden&&!c1.foot.some(f=>/prości/i.test(f)),JSON.stringify(c1));
    await ev(r,()=>document.querySelector('.chat .creal').scrollIntoView({block:'center'}));await shot(r,'chat-real-collapsed');
    await tap(r,'.chat .crealbtn');const c2=await ev(r,()=>!document.querySelector('.chat .crealtx').hidden);
    check(S,'stuknięcie rozwija „Prościej”',c2,'');await shot(r,'chat-real-expanded');}
  else check(S,'„Prościej” w czacie (makro)',false,'nie pojawiło się');
  await tap(r,'#lesson .lessonhead .x');await toToday(r);
  await openSubj(r,'Test');await openNode(r);await waitFor(r,'#lesson.open .chat');await chatUntil(r,'.chat .creal');
  if(await has(r,'.chat .crealbtn'))await tap(r,'.chat .crealbtn');await sleep(500);
  const pw=await ev(r,()=>!!window.__pwned);check(S,'real z próbą XSS: nic się nie wykonało',!pw,'');
  await shot(r,'chat-real-xss');
  await closeRun(r,S);
};

/* P2-12: boss po upływie czasu */
SCEN.boss=async()=>{
  const S='boss';const r=await newRun(S,'mock=seeded&reset=1');
  await openSubj(r,'Krypto');await tap(r,'#subjscreen button','Pojedynek z Szopem');await waitFor(r,'.bossrun');
  let done=false;
  for(let k=0;k<5&&!done;k++){
    await waitFor(r,'.bossrun .quiz, .bossrun .task',null,8000);
    if(await has(r,'#bosstime')){await sleep(21500);const t=await textOf(r,'.bossexp');
      check(S,'po upływie czasu: treść dobrej odpowiedzi, nie litera',/Dobra odpowiedź:/.test(t||'')&&!/odpowiedź [A-E]\b/.test(t||''),t);await shot(r,'boss-timeout');done=true;break;}
    await solve(r);await sleep(1600);
  }
  if(!done)check(S,'boss: pytanie na czas',false,'nie wypadło');
  await closeRun(r,S);
};

/* P1-15: pełne nazwy, skróty bez kolizji, monogramy */
SCEN.names=async()=>{
  const S='names';const r=await newRun(S,'mock=seeded&reset=1');await waitFor(r,'.plan',null,15000);await sleep(2500);
  await ev(r,()=>{const E=NaukaEngine,base=E.subjects().slice();const k=base.find(s=>/Krypto/.test(s.name));const mk=(id,name,acc)=>({...k,id,name,short:name.split(' ')[0],accent:acc,accent2:acc});
    E.setSubjects(base.concat([mk('t-pc','Prawo cywilne i rodzinne','#FF2E93'),mk('t-pk','Prawo karne wykonawcze','#A855F7'),mk('t-ps','Polityka społeczna','#FFC043')]));E.go('subjects');});
  await waitFor(r,'.subjects');await shot(r,'names-subjects');
  const tiles=await ev(r,()=>[...document.querySelectorAll('.subjtile .name')].map(e=>e.textContent));
  check(S,'kafle: pełne nazwy',tiles.includes('Prawo cywilne i rodzinne')&&tiles.includes('Polityka makroekonomiczna')&&tiles.includes('Polityka społeczna'),tiles.join(' | '));
  const clipped=await ev(r,()=>[...document.querySelectorAll('.subjtile .name')].filter(e=>e.scrollHeight>e.clientHeight+2).map(e=>e.textContent));
  check(S,'kafle: nazwy mieszczą się w 2 liniach',!clipped.length,clipped.join(' | '));
  const mono=await ev(r,()=>[...document.querySelectorAll('.subjtile .mono')].map(e=>e.textContent));
  check(S,'monogramy z dwóch liter, różne dla „Prawo …”',mono.includes('PC')&&mono.includes('PK'),mono.join(','));
  const sh=await ev(r,()=>NaukaEngine.subjects().map(s=>NaukaEngine.subjShort(s)));
  check(S,'skróty bez kolizji (P. cywilne / P. karne, P. makro… / P. społeczna)',new Set(sh).size===sh.length&&sh.some(x=>/^P\. cywilne/.test(x))&&sh.some(x=>/^P\. społeczna/.test(x)),sh.join(' | '));
  await ev(r,()=>NaukaEngine.go('album'));await waitFor(r,'.albchips');await shot(r,'names-album-chips');
  await ev(r,()=>NaukaEngine.openTestSheet(null));await waitFor(r,'.tpchip');await shot(r,'names-test-sheet');
  await ev(r,()=>{NaukaEngine.closeSheet();NaukaEngine.openSubject('t-pc');});await waitFor(r,'.hhead h1');await shot(r,'names-subject-header');
  const bn=await ev(r,()=>{const e=document.querySelector('.hhead h1');const lh=parseFloat(getComputedStyle(e).lineHeight);return {t:e.textContent,lines:Math.round(e.getBoundingClientRect().height/lh)};});
  check(S,'nagłówek przedmiotu: pełna nazwa w najwyżej 2 liniach (ciasny pas — reszta to P2-55)',bn.t==='Prawo cywilne i rodzinne'&&bn.lines<=2,JSON.stringify(bn));
  await closeRun(r,S);
};

/* P2-57, P2-59, P2-9, P2-56 */
SCEN.misc=async()=>{
  const S='misc';let r=await newRun(S,'mock=seeded&reset=1');await waitFor(r,'.plan',null,15000);
  check(S,'color-scheme: dark',(await ev(r,()=>getComputedStyle(document.documentElement).colorScheme))==='dark','');
  check(S,'ograniczony ruch z telefonu → html.reduce-motion',await ev(r,()=>document.documentElement.classList.contains('reduce-motion')),'');
  await openSubj(r,'Polityka');await subTab(r,'Egzamin');await waitFor(r,'#excram');
  const fd=await ev(r,()=>getComputedStyle(document.getElementById('excram')).flexDirection);
  check(S,'karta „Egzamin jutro?” bez stylu ekranu nocy (.cram)',fd==='row',fd);
  await ev(r,()=>document.getElementById('excram').scrollIntoView({block:'center'}));await shot(r,'exam-cram-card');
  await subTab(r,'Quiz');await waitFor(r,'.quizview .quiz');await solve(r);await sheetAfter(r);
  const cf=await ev(r,()=>document.querySelectorAll('.confetti i').length);check(S,'konfetti przy ograniczonym ruchu: bez kawałków',cf===0,cf);
  await closeRun(r,S);
  r=await newRun(S,'mock=seeded&reset=1',{motion:true});await waitFor(r,'.plan',null,15000);
  await openSubj(r,'Polityka');await subTab(r,'Quiz');await waitFor(r,'.quizview .quiz');await solve(r);await sheetAfter(r);
  const cf2=await ev(r,()=>document.querySelectorAll('.confetti i').length);check(S,'konfetti bez ograniczenia ruchu: są',cf2>0,cf2);
  await closeRun(r,S);
  r=await newRun(S,'mock=seeded&reset=1&extra=viz',{w:360,h:780});
  await openSubj(r,'Wizualizacje');await openNode(r);await waitFor(r,'#chatterms');
  const ct=await ev(r,()=>Math.round(document.getElementById('chatterms').getBoundingClientRect().right));
  check(S,'360 px: licznik pojęć w nagłówku czatu na ekranie',ct<=360,ct);
  await shot(r,'chat-header-360');
  await closeRun(r,S);
  r=await newRun(S,'mock=fresh&reset=1');await waitFor(r,'#cf-go',null,15000);await shot(r,'signup-checkbox-off');await tap(r,'#cf-age');await shot(r,'signup-checkbox-on');await closeRun(r);
};

/* P1-24: kontrast tekstu na kluczowych ekranach */
async function contrastScan(run){
  return ev(run,()=>{
    const parse=c=>{let m=String(c).match(/rgba?\(([^)]+)\)/);if(m){const p=m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};}
      m=String(c).match(/color\(srgb ([^)]+)\)/);if(m){const p=m[1].split(/[\s\/]+/).filter(Boolean).map(Number);return {r:p[0]*255,g:p[1]*255,b:p[2]*255,a:p.length>3?p[3]:1};}return null;};
    const lin=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};const lum=c=>.2126*lin(c.r)+.7152*lin(c.g)+.0722*lin(c.b);
    const blend=(t,b)=>({r:t.r*t.a+b.r*(1-t.a),g:t.g*t.a+b.g*(1-t.a),b:t.b*t.a+b.b*(1-t.a),a:1});
    const bgOf=e=>{const L=[];for(let p=e;p;p=p.parentElement){const c=parse(getComputedStyle(p).backgroundColor);if(c&&c.a>0){L.push(c);if(c.a>=1)break;}}let col={r:14,g:12,b:28,a:1};for(let i=L.length-1;i>=0;i--)col=blend(L[i],col);return col;};
    const opa=e=>{let o=1;for(let p=e;p;p=p.parentElement)o*=+getComputedStyle(p).opacity;return o;};
    const out=[];
    document.querySelectorAll('#app *').forEach(e=>{if(!e.childNodes.length||![...e.childNodes].some(n=>n.nodeType===3&&n.nodeValue.trim()))return;
      if(e.closest('[aria-hidden="true"],.confetti,svg'))return;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none')return;
      const r=e.getBoundingClientRect();if(!r.width||!r.height||r.bottom<0||r.top>innerHeight)return;if(opa(e)<.95)return;
      const fg=parse(cs.color);if(!fg)return;const bg=bgOf(e);const f=blend(fg,bg);const L1=lum(f),L2=lum(bg);const ratio=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
      const fs=parseFloat(cs.fontSize),fw=+cs.fontWeight||400;const large=fs>=24||(fs>=18.66&&fw>=700);const need=large?3:4.5;
      if(ratio<need)out.push({cls:(typeof e.className==='string'?e.className:e.tagName).slice(0,40),txt:e.textContent.replace(/\s+/g,' ').trim().slice(0,40),ratio:Math.round(ratio*100)/100,fs,color:cs.color});});
    return out;});
}
SCEN.contrast=async()=>{
  const S='contrast';const r=await newRun(S,'mock=seeded&reset=1');await waitFor(r,'.plan',null,15000);await sleep(800);
  const all=[];const scan=async name=>{await sleep(500);const f=await contrastScan(r);f.forEach(x=>all.push({screen:name,...x}));};
  await scan('today');
  await tap(r,'.nav button','Profil');await waitFor(r,'.prof');await scan('profile');
  await ev(r,()=>{const s=document.querySelector('.screen.active .scroll');s.scrollTop=s.scrollHeight;});await scan('profile-bottom');await shot(r,'contrast-profile-badges');
  await tap(r,'.topbar .backbtn[aria-label="Ustawienia"]');await waitFor(r,'#set-logout');await ev(r,()=>{const s=document.querySelector('.screen.active .scroll');s.scrollTop=s.scrollHeight;});await scan('settings-bottom');await shot(r,'contrast-settings-bottom');
  await ev(r,()=>NaukaEngine.go('streak'));await waitFor(r,'.streakview');await scan('streak');await shot(r,'contrast-streak');
  await ev(r,()=>NaukaEngine.go('today'));await openSubj(r,'Polityka');await scan('path');await shot(r,'contrast-path');
  await toToday(r);await tap(r,'.nav button','Profil');await tap(r,'.sechdr .link','Ten tydzień');await waitFor(r,'.wk');await scan('weekly');await shot(r,'contrast-weekly');
  fs.writeFileSync(path.join(OUT,'contrast.json'),JSON.stringify(all,null,1));
  const muted=all.filter(x=>/rgb\(134, 128, 190\)|rgb\(78, 71, 120\)|rgb\(110, 103, 168\)/.test(x.color));
  check(S,'tekst w --muted-2 / --muted-3 spełnia 4,5:1',!muted.length,muted.slice(0,6).map(x=>`${x.screen}:${x.cls}„${x.txt}” ${x.ratio}`).join(' | '));
  check(S,'wszystkie elementy < progu (informacyjnie)',true,all.length+': '+all.slice(0,8).map(x=>`${x.screen}:${x.cls}„${x.txt}” ${x.ratio}`).join(' | '));
  await ev(r,()=>NaukaEngine.go('today'));await waitFor(r,'.nav');
  const nav=await ev(r,()=>parseFloat(getComputedStyle(document.querySelector('.nav button:not(.navplus)')).fontSize));
  check(S,'etykiety dolnego paska 11,5 px',nav===11.5,nav+' px');
  await closeRun(r,S);
};

/* przegląd Build 7: X przy otwartym „Dobrze!”/„Nie tym razem” zapisuje NASTĘPNE pytanie (odpowiedź już policzona) — DOKOŃCZ nie powtarza pytania ani XP */
SCEN.xsheet=async()=>{
  const S='xsheet';const r=await newRun(S,'mock=seeded&reset=1');
  await openSubj(r,'Polityka');await openNode(r);await waitFor(r,'#lesson.open .chat');
  await chatTo(r,0);
  await waitFor(r,'#lesson.open .quiz, #lesson.open .task',null,8000);
  const st=()=>ev(r,()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('nauka_progress_v1:'));const p=JSON.parse(localStorage.getItem(k)||'{}');
    const sid=NaukaEngine.current&&NaukaEngine.current.id;let ls={};try{ls=JSON.parse(p.lessonSave||'{}');}catch(e){}const ent=Object.values(ls)[0]||{};
    return {xp:sid&&p[sid]?p[sid].xp:null,daily:p.daily&&p.daily.xp,q:ent.qIdx,run:(ent.run||[]).length};});
  const q1=await textOf(r,'#lesson .qq')||await textOf(r,'#lesson .task .ttitle');
  await solve(r);await sheetAfter(r);await sleep(500);
  const afterAns=await st();
  await r.page.mouse.click(...(await ev(r,()=>{const rc=document.querySelector('#lesson .lessonhead .x').getBoundingClientRect();return [rc.left+rc.width/2,rc.top+rc.height/2];})));await sleep(600);
  const afterX=await st();
  check(S,'X przy otwartym panelu: zapis wskazuje następne pytanie',afterX.q===afterAns.q&&afterX.q===1,JSON.stringify({afterAns,afterX}));
  await openNode(r);await waitFor(r,'#sheet.resume');
  await tap(r,'#rsgo');await waitFor(r,'#lesson.open .quiz, #lesson.open .task',null,8000);
  const q2=await textOf(r,'#lesson .qq')||await textOf(r,'#lesson .task .ttitle');const chips=await textOf(r,'#lesson .qchips');
  check(S,'DOKOŃCZ: następne pytanie, a nie to samo jeszcze raz',q1!==q2&&/ 2 z /.test(chips),JSON.stringify({q1,q2,chips}));
  const back=await st();
  check(S,'XP i dzienny cel bez podwójnego liczenia',back.xp===afterAns.xp&&back.daily===afterAns.daily,JSON.stringify({afterAns,back}));
  await closeRun(r,S);
};

/* ============================================================ uruchomienie */
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});fs.readdirSync(OUT).filter(f=>/\.png$/.test(f)).forEach(f=>fs.unlinkSync(path.join(OUT,f)));
  const srv=await serve(ROOT,PORT);const srvOld=OLD?await serve(OLD,PORT+1):null;
  browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-first-run','--no-default-browser-check','--lang=pl-PL','--disable-features=Translate'],defaultViewport:null});
  const order=ONLY?ONLY.filter(n=>SCEN[n]):Object.keys(SCEN);
  try{for(const n of order){console.log('▶',n);const t0=Date.now();
    try{await SCEN[n]();}catch(e){check(n,'scenariusz przeszedł do końca',false,e.message);
      for(const c of browser.browserContexts())if(c!==browser.defaultBrowserContext())await c.close().catch(()=>{});}
    console.log('  ⏱',Math.round((Date.now()-t0)/1000)+' s');}}
  finally{await browser.close().catch(()=>{});srv.close();if(srvOld)srvOld.close();}
  fs.writeFileSync(path.join(OUT,'RESULTS.json'),JSON.stringify(RESULTS,null,1));
  const bad=RESULTS.filter(x=>!x.ok);
  console.log(`\n${RESULTS.length-bad.length}/${RESULTS.length} kontroli OK${bad.length?'\nNIE PRZESZŁY:\n'+bad.map(x=>` - [${x.scen}] ${x.name}: ${x.detail}`).join('\n'):''}\nZrzuty i wyniki: ${OUT}`);
  process.exit(bad.length?1:0);
})();
