#!/usr/bin/env node
/* ============================================================ CRAMFOX — ZRZUTY EKRANÓW NA ATRAPIE BACKENDU
   Uruchamia lokalny serwer plików (katalog repo), Chrome (puppeteer-core) w rozmiarze iPhone'a (375×812, @2x, dotyk)
   i przechodzi przez wszystkie ekrany apki: rejestracja → etap → cel → pusty Dziś → dodanie materiału → generowanie → lekcja → …,
   konto testowe z postępami, błędy generowania, offline, usuwanie konta, wąski ekran 360×780.
   Wynik: <out>/NN-nazwa.png + <out>/INDEX.md (plik → stan → jak dojść) + lista błędów z konsoli i automatycznych sprawdzeń.

   Użycie (z katalogu test/):  npm install  →  node dev/shoot.mjs [--out KATALOG] [--only fresh,seeded,...] [--port 8790] [--headful] [--no-fonts]
   Chrome: /Applications/Google Chrome.app (albo --chrome ŚCIEŻKA / CHROME=…). Atrapa: test/dev/mock-backend.js — nic nie idzie do Supabase ani do API.
   Scenariusze: fresh, seeded, comeback, monday, errors, boot, nostore, xss, narrow, native (+ lesson4 do debugowania). SHOOT_DEBUG=1 = więcej logów. */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const argv=process.argv.slice(2);
const arg=(k,d)=>{const i=argv.indexOf('--'+k);return i>=0?(argv[i+1]&&!argv[i+1].startsWith('--')?argv[i+1]:true):d;};
const OUT=path.resolve(String(arg('out',process.env.SHOTS_DIR||path.join(HERE,'shots'))));
const PORT=+arg('port',process.env.PORT||8790);
const CHROME=String(arg('chrome',process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
const ONLY=arg('only','')?String(arg('only')).split(','):null;
const FONTS=!arg('no-fonts',false);
const BASE=`http://localhost:${PORT}/test/dev/`;
const DEBUG=!!process.env.SHOOT_DEBUG;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- wiedza z fixtures: poprawne odpowiedzi (do rozwiązywania pytań i zadań) ---------- */
const FX=Object.fromEntries(['topic-makro','topic-krypto','topic-viz','topic-xss'].map(n=>[n,JSON.parse(fs.readFileSync(path.join(ROOT,'test/fixtures',n+'.json'),'utf8'))]));
const NORM=s=>String(s==null?'':s).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const KB={quiz:{},tasks:[],labels:{'prawda czy fałsz':'tf','uzupełnij zdanie':'fill','wpisz pojęcie':'typeterm','dwie kategorie':'swipe','czyja to teza':'thesis','scenariusz':'scenario',
  'znajdź błąd':'finderror','połącz w pary':'match','ustaw kolejność':'order','przypisz do kategorii':'sort','oś czasu':'timeline','łańcuch przyczyn':'chain','wykres':'chart','krok po kroku':'mathsteps','wskaż na schemacie':'hotspot'}};
Object.values(FX).forEach(t=>(t.levels||[]).forEach(l=>{(l.quiz||[]).forEach(q=>{if(Array.isArray(q.a)&&q.a[q.c]!=null)KB.quiz[NORM(q.q)]=NORM(q.a[q.c]);});(l.tasks||[]).forEach(x=>{if(x&&x.type)KB.tasks.push(x);});}));
const TASK_LABEL=Object.fromEntries(Object.entries(KB.labels).map(([k,v])=>[v,k.charAt(0).toUpperCase()+k.slice(1)]));
const TASK_ORDER=['tf','fill','typeterm','swipe','thesis','scenario','finderror','match','order','sort','timeline','chain','chart','mathsteps'];

/* ---------- serwer plików (repo) ---------- */
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.md':'text/markdown; charset=utf-8'};
const serverHits=[];
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
  if(u.pathname.startsWith('/api/')){serverHits.push(req.method+' '+u.pathname);res.writeHead(501,{'Content-Type':'application/json'});return res.end('{"error":"atrapa ominięta — żądanie API doszło do serwera plików"}');}
  let p=path.normalize(path.join(ROOT,decodeURIComponent(u.pathname)));if(!p.startsWith(ROOT)){res.writeHead(403);return res.end();}
  if(p.endsWith(path.sep))p=path.join(p,'index.html');
  fs.stat(p,(e,st)=>{if(e||!st.isFile()){res.writeHead(404);return res.end('nie ma');}res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(p).pipe(res);});
});

/* ---------- zapis wyników ---------- */
const SHOTS=[],ISSUES=[],FAILS=[],UNREACHED=[],NOTES=[];let NN=0,browser=null,ASSETS=null;
function issue(run,kind,text){const k=run.name+'|'+kind+'|'+text;if(ISSUES.some(x=>x.key===k))return;ISSUES.push({key:k,scenario:run.name,kind,text,at:run.last||''});}

/* ---------- przeglądarka i strona ---------- */
const SEED_RANDOM=`(()=>{let s=0x2f6b1d3;Math.random=function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();`;
async function newRun(name,query,o={}){
  const w=o.w||375,h=o.h||812;
  const ctx=await browser.createBrowserContext();const page=await ctx.newPage();
  await page.setViewport({width:w,height:h,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]); // deterministycznie: bez animacji, czat bez „lis pisze…”
  await page.evaluateOnNewDocument(SEED_RANDOM);
  await page.setRequestInterception(true);
  const run={name,page,ctx,w,h,prefix:o.prefix||'',last:''};
  page.on('request',r=>{const u=r.url();
    if(/^(data|blob):/.test(u)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u))return r.continue();
    if(FONTS&&/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u))return r.continue();
    if(!/fonts\.(googleapis|gstatic)/.test(u))issue(run,'blocked-request',u.slice(0,140)); // produkcja nigdy: Supabase/API zatrzymuje atrapa, a to jest druga siatka
    r.abort();});
  page.on('console',m=>{const t=m.type();if(t!=='error'&&t!=='warning')return;const tx=m.text();if(/favicon|fonts\.g/.test(tx))return;
    if(/Failed to load resource: net::ERR_FAILED|ERR_INTERNET_DISCONNECTED/.test(tx)&&run.offline)return;issue(run,'console.'+t,tx.slice(0,400));});
  page.on('pageerror',e=>issue(run,'pageerror',String(e&&e.stack||e).slice(0,600)));
  page.on('dialog',async d=>{issue(run,'native-dialog',d.type()+': '+d.message());await d.dismiss().catch(()=>{});});
  if(query!=null)await go(run,query);
  return run;
}
async function go(run,query){
  run.last='goto '+query;
  await run.page.goto(BASE+'?'+query,{waitUntil:'load'});
  await settle(run,600);
}
async function closeRun(run){try{await run.ctx.close();}catch(e){}}
async function settle(run,ms=300){await sleep(ms);try{await run.page.evaluate(()=>document.fonts&&document.fonts.ready);}catch(e){}}

/* ---------- akcje ---------- */
async function find(run,sel,text,o={}){ // pierwszy widoczny element pasujący do selektora (i tekstu)
  return run.page.evaluateHandle((sel,text,nth,exact,any)=>{
    const N=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
    const vis=e=>{if(any)return true;const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none';};
    const els=[...document.querySelectorAll(sel)].filter(e=>vis(e)&&(!text||(exact?N(e.textContent)===N(text):N(e.textContent).includes(N(text)))));
    return els[nth<0?els.length+nth:nth]||null;},sel,text||'',o.nth||0,!!o.exact,!!o.any).then(h=>h.asElement());
}
async function waitFor(run,sel,text,timeout=8000,o={}){
  const t0=Date.now();while(Date.now()-t0<timeout){let el=null;try{el=await find(run,sel,text,o);}catch(e){} /* przeładowanie strony w trakcie */ if(el)return el;await sleep(120);}
  throw new Error(`nie pojawiło się: ${sel}${text?' „'+text+'”':''} (${run.last})`);
}
async function has(run,sel,text){try{return !!(await find(run,sel,text));}catch(e){return false;}}
async function tap(run,sel,text,o={}){
  run.last=`tap ${sel}${text?' „'+text+'”':''}`;
  const el=o.wait===false?await find(run,sel,text,o):await waitFor(run,sel,text,o.timeout||8000,o);
  if(!el)throw new Error('brak elementu: '+run.last);
  await el.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest'}));
  if(o.real)await el.click();else await el.evaluate(e=>e.click());
  await settle(run,o.settle??250);
  return el;
}
async function fill(run,sel,value){run.last='fill '+sel;const el=await waitFor(run,sel);await el.evaluate((e,v)=>{e.focus();e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},value);await settle(run,120);}
async function typeIn(run,sel,value){run.last='type '+sel;const el=await waitFor(run,sel);await el.click({clickCount:3});await run.page.keyboard.type(value,{delay:5});await settle(run,120);}
async function scrollBy(run,sel,y){await run.page.evaluate((sel,y)=>{const e=document.querySelector(sel);if(e)e.scrollTop=y==='end'?e.scrollHeight:y;},sel,y);await settle(run,250);}
async function scrollMain(run,y){ // największy przewijany kontener na ekranie (lista, wynik, czat)
  await run.page.evaluate(y=>{const c=[...document.querySelectorAll('#app *')].filter(e=>{const cs=getComputedStyle(e);return /(auto|scroll)/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight+10&&e.getBoundingClientRect().height>0;})
    .sort((a,b)=>b.clientHeight-a.clientHeight)[0];if(c)c.scrollTop=y==='end'?c.scrollHeight:y;},y);await settle(run,250);}
async function chooseFiles(run,sel,files,text){ // natywny wybór pliku: prawdziwe kliknięcie (aktywacja użytkownika) + przechwycony dialog
  run.last='choose '+sel;const el=await waitFor(run,sel,text);
  const [ch]=await Promise.all([run.page.waitForFileChooser({timeout:6000}),el.click()]);await ch.accept(files);await settle(run,500);
}
async function view(run){return run.page.evaluate(()=>({view:window.NaukaEngine&&NaukaEngine.view,sheet:!!document.getElementById('sheet'),lesson:!!document.querySelector('#lesson.open,.lesson.open')}));}
async function mockSet(run,k,v){await run.page.evaluate((k,v)=>window.MOCK.set(k,v),k,v);}
async function mockLog(run){return run.page.evaluate(()=>window.MOCK.log.map(e=>e.method+' '+e.path.split('?')[0]+' '+e.status));}
async function nav(run,label){await tap(run,'.nav button',label);}

/* ---------- zrzut + automatyczne sprawdzenia ---------- */
async function shot(run,name,state,how){
  await settle(run,350);
  NN++;const file=String(NN).padStart(2,'0')+'-'+run.prefix+name+'.png';
  await run.page.screenshot({path:path.join(OUT,file)});
  SHOTS.push({file,scenario:run.name,state,how:how||''});
  const chk=await run.page.evaluate(()=>{
    const W=innerWidth,out={emoji:[],wide:[],docWide:document.documentElement.scrollWidth>W+1};
    const txt=[...document.querySelectorAll('#app, #sheet, .netbar')].map(e=>e.innerText||'').join('\n');
    out.emoji=[...new Set((txt.match(/\p{Extended_Pictographic}/gu)||[]))].slice(0,12);
    const scrollX=e=>{for(let p=e.parentElement;p;p=p.parentElement){const cs=getComputedStyle(p);if(/(auto|scroll|hidden|clip)/.test(cs.overflowX))return true;}return false;};
    document.querySelectorAll('#app *').forEach(e=>{if(out.wide.length>=4)return;const r=e.getBoundingClientRect();if(!r.width||!r.height||r.right<=W+2)return;const cs=getComputedStyle(e);
      if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0||cs.position==='fixed')return;if(scrollX(e))return;if(!e.childNodes.length||![...e.childNodes].some(n=>n.nodeType===3&&n.nodeValue.trim()))return;
      out.wide.push((e.className&&e.className.baseVal==null?String(e.className):e.tagName.toLowerCase()).slice(0,40)+' → '+Math.round(r.right)+'px');});
    out.pwned=!!window.__pwned;return out;});
  if(chk.emoji.length)issue(run,'emoji-in-ui',`${file}: ${chk.emoji.join(' ')}`);
  if(chk.docWide)issue(run,'horizontal-scroll',`${file}: dokument szerszy niż ekran ${run.w}px`);
  if(chk.wide.length)issue(run,'text-overflow',`${file}: ${chk.wide.join('; ')}`);
  if(chk.pwned)issue(run,'XSS',`${file}: window.__pwned ustawione`);
  console.log('  ✓',file,'—',state);
  return file;
}

/* ---------- rozwiązywanie pytań i zadań w przeglądarce (dane z fixtures) ---------- */
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

/* ---------- czat lekcji: przejście przez wszystkie dawki ---------- */
async function chatThrough(run,o={}){
  const seenViz=new Set();let parts=0,cloze=0,termDone=false,collapsed=false;
  for(let g=0;g<80;g++){
    run.last='chat step '+g;
    await waitFor(run,'.chatfoot .creply:not([disabled])',null,15000);
    const labels=await run.page.$$eval('.chatfoot .creply',bs=>bs.map(b=>b.textContent.trim()));
    // nowe schematy w czacie
    const viz=await run.page.$$eval('.chat .cviz',bs=>bs.map(b=>[...b.classList].find(c=>/^vz-/.test(c)&&c!=='vz-cause'&&c!=='vz-process')||'vz'));
    for(const v of viz)if(!seenViz.has(v)){seenViz.add(v);
      await run.page.evaluate(v=>{const b=[...document.querySelectorAll('.chat .cviz.'+v)].pop();if(b)b.scrollIntoView({block:'center'});},v);
      if(o.vizShots!==false)await shot(run,'lesson-chat-viz-'+v.replace('vz-',''),`Lekcja, czat: schemat „${v.replace('vz-','')}” pod dawką`,'Ścieżka → bieżący poziom → czat');}
    if(labels.some(l=>/CZAS NA PYTANIA|ZAKOŃCZ/.test(l))){
      if(o.endShot!==false)await shot(run,'lesson-chat-end','Koniec części z lisem: „CZAS NA PYTANIA”','Przejście przez wszystkie dawki');
      await sleep(400); // advOk(): drugie „dalej” w ciągu 350 ms jest ignorowane
      await tap(run,'.chatfoot .creply',labels.find(l=>/CZAS NA PYTANIA|ZAKOŃCZ/.test(l)));
      for(let k=0;k<10&&await has(run,'.chatfoot .creply');k++){await sleep(400);await tap(run,'.chatfoot .creply',null,{wait:false}).catch(()=>{});}
      return {parts,cloze,viz:[...seenViz]};}
    if(labels.length===1){ // „Dalej”
      if(parts===0&&!termDone&&o.shots!==false){
        await shot(run,'lesson-chat-part1','Lekcja: czat z lisem — część 1 (dymki, pogrubione pojęcia, licznik pojęć)','Ścieżka → węzeł „ZACZNIJ”');
        if(await has(run,'.chat .cbub .cterm:not(.demo)')){await tap(run,'.chat .cbub .cterm:not(.demo)');await shot(run,'lesson-chat-term','Czat: stuknięte pojęcie — dymek ze znaczeniem i licznik pojęć','Stuknięcie pogrubionego słowa w dymku');}
        termDone=true;}
      const isAfterCloze=await has(run,'.chat .ccheck .blank.ok, .chat .ccheck .blank.bad');
      await sleep(150);await tap(run,'.chatfoot .creply',labels[0],{settle:300});
      if(!(await has(run,'.chatfoot .creply'))||labels[0]==='Dalej'){}
      // nowa część?
      const n=await run.page.$$eval('.chat .cdose',s=>s.length);
      if(n>parts+1||(n>1&&n!==parts)){parts=n-1;}
      if(o.shots!==false&&!collapsed&&await has(run,'.chat .cdose.done')){
        collapsed=true;await run.page.evaluate(()=>{const b=document.querySelector('.lessonbody.chatbody');if(b)b.scrollTop=0;});
        await shot(run,'lesson-chat-collapsed','Czat: przerobiona część zwinięta do jednej linii (nagłówek z ptaszkiem)','Część 1 → Dalej');
        await tap(run,'.chat .cdose.done .cdhead');await run.page.evaluate(()=>{const b=document.querySelector('.lessonbody.chatbody');if(b)b.scrollTop=0;});
        await shot(run,'lesson-chat-expanded','Czat: zwinięta część rozwinięta stuknięciem w nagłówek','Stuknięcie nagłówka zwiniętej części');
        await tap(run,'.chat .cdose.done .cdhead');}
      void isAfterCloze;continue;}
    // sprawdzian z luką: 3 opcje
    cloze++;
    if(cloze===1&&o.shots!==false)await shot(run,'lesson-cloze','Czat: „uzupełnij lukę” po dawce (pojęcie z dawki + 2 dystraktory)','Część 1 → Dalej');
    await tap(run,'.chatfoot .creply',labels[cloze===1?1:0],{exact:true});
    await waitFor(run,'.chatfoot .creply',null,6000);
    if(cloze===1&&o.shots!==false)await shot(run,'lesson-cloze-answered','Czat: luka sprawdzona (dobrze/źle, +XP, komentarz lisa)','Wybór odpowiedzi w luce');
  }
  throw new Error('czat: za dużo kroków');
}

/* ---------- pytania i zadania w lekcji aż do wyniku ---------- */
async function lessonQuiz(run,o={}){
  const shotKinds=new Set(o.skipKinds||[]);let wrongLeft=o.wrong==null?1:o.wrong,i=0,badDone=!!o.noBadShots,okDone=!!o.noOkShots;
  for(;i<40;i++){
    run.last='lesson item '+i;
    if(await has(run,'.lessonbody.done .lc'))break;
    const kind=await run.page.evaluate(()=>{const t=document.querySelector('.task');if(t){return 'task-'+(t.querySelector('.tchip')||{}).textContent;}const q=document.querySelector('.quiz');return q?(q.classList.contains('qtf')?'quiz-tf':'quiz'):'none';});
    if(DEBUG)console.log('    lesson',i,kind,JSON.stringify(await view(run)));
    if(kind==='none'){if(await has(run,'.chatfoot .creply'))await tap(run,'.chatfoot .creply',null,{wait:false,settle:400}).catch(()=>{});else await sleep(300);continue;}
    const tkey=kind.startsWith('task-')?(KB.labels[NORM(kind.slice(5))]||'task'):kind;
    if(!shotKinds.has(tkey)&&o.shots!==false){shotKinds.add(tkey);
      await shot(run,'lesson-'+(tkey.startsWith('quiz')?tkey.replace('quiz-tf','quiz-truefalse').replace(/^quiz$/,'quiz-abcd'):'task-'+tkey),
        tkey==='quiz'?'Lekcja: pytanie ABCD (kafle z literą, combo, licznik)':tkey==='quiz-tf'?'Lekcja: pytanie w trybie „prawda czy fałsz” (gdy poprawna odpowiedź odstaje długością)':`Lekcja: zadanie „${TASK_LABEL[tkey]||tkey}”`,'Lekcja → po czacie „CZAS NA PYTANIA”');}
    const wrong=wrongLeft>0&&tkey==='quiz'&&i>=1;if(wrong)wrongLeft--;
    await solve(run,{wrong});
    const s=await sheetAfter(run);
    if(s==='ok'&&!okDone){okDone=true;await shot(run,'lesson-sheet-ok','Panel „Dobrze!”: combo, +XP, „Dlaczego”, źródło','Poprawna odpowiedź w lekcji');
      if(await has(run,'#sheet .rsrc')){await tap(run,'#sheet .rsrc');await shot(run,'source-sheet','Arkusz „Skąd to pytanie?”: strona i cytat ze źródła','Panel „Dobrze!” → Źródło');await tap(run,'#srcok');}}
    if(s==='bad'&&!badDone){badDone=true;await shot(run,'lesson-sheet-bad','Panel „Nie tym razem”: dobra odpowiedź (treść), „Dlaczego”, WYJAŚNIJ INACZEJ, „Zgłoś / popraw”, −1 serce','Zła odpowiedź w lekcji');
      if(await has(run,'#sexpl')){await tap(run,'#sexpl');await shot(run,'explain-sheet','Arkusz „Wyjaśnijmy inaczej”: poprawna odpowiedź, fiszka, fragment z lekcji (offline, bez AI)','Panel „Nie tym razem” → WYJAŚNIJ INACZEJ');await tap(run,'#sok');}
      else NOTES.push(`${run.name}: „WYJAŚNIJ INACZEJ” nie pojawiło się dla pierwszej złej odpowiedzi (explainFor nic nie znalazło).`);
      if(await has(run,'#sedit')){await tap(run,'#sedit');await shot(run,'edit-question-sheet','Arkusz „Popraw pytanie” (treść, odpowiedzi, poprawna, wyjaśnienie)','Panel „Nie tym razem” → „Zgłoś / popraw pytanie”');await tap(run,'#edclose');}}
    if(s==='nohearts'){await shot(run,'no-hearts-in-lesson','Koniec żyć w trakcie lekcji','Za dużo złych odpowiedzi');return 'nohearts';}
    await tap(run,'#snext');
    if(await has(run,'#sheet.nohearts')){await shot(run,'no-hearts-in-lesson','Koniec żyć w trakcie lekcji','Za dużo złych odpowiedzi');return 'nohearts';}
  }
  await waitFor(run,'.lessonbody.done .lc',null,8000);
  return 'done';
}

/* ---------- materiały testowe (zdjęcie strony, PDF, duży plik do TUS) ---------- */
async function makeAssets(){
  ASSETS=fs.mkdtempSync(path.join(os.tmpdir(),'cramfox-shoot-'));
  const ctx=await browser.createBrowserContext();const p=await ctx.newPage();await p.setViewport({width:900,height:1200,deviceScaleFactor:1});
  await p.setContent(`<html><body style="margin:0;background:#f4f1e8;font:22px Georgia,serif;color:#222;padding:60px 70px"><h1 style="font-size:40px">Rozdział 3. Polityka fiskalna</h1>
    <p>Polityka fiskalna to decyzje państwa o <b>wydatkach</b> i <b>podatkach</b>. Magiczny czworokąt Kaldora obejmuje wzrost PKB, pełne zatrudnienie, stabilność cen i równowagę bilansu płatniczego.</p>
    <p>Pakt Stabilności i Wzrostu: deficyt do 3% PKB, dług publiczny do 60% PKB. Deficit bias — politycy wolą wydatki dziś, koszty przerzucają na przyszłe pokolenia.</p>
    <p>Trójkąt wiarygodności fiskalnej: reguły fiskalne, niezależne instytucje (rady fiskalne), przejrzystość budżetu.</p>${'<p>Notatki z wykładu — przykład wypychania długu poza budżet: BGK, PFR, Fundusz COVID.</p>'.repeat(6)}</body></html>`);
  await p.screenshot({path:path.join(ASSETS,'strona-podrecznika.png')});
  await p.pdf({path:path.join(ASSETS,'notatki-wyklad.pdf'),format:'A4'});
  const big=Buffer.alloc(7*1048576+12345,0x20);big.write('%PDF-1.4\n',0);fs.writeFileSync(path.join(ASSETS,'skan-rozdzialu.pdf'),big); // > 6 MB → wysyłka TUS
  await ctx.close();
}
const NOTES_TEXT=`Polityka makroekonomiczna — notatki do kolokwium.
Polityka makroekonomiczna to zarządzanie całą gospodarką państwa: dług publiczny, stopy procentowe, wiarygodność fiskalna.
Polityka społeczna kształtuje warunki życia i łagodzi nierówności. Narzędzia: ekonomiczne (podatki, zasiłki), prawne (Kodeks pracy), informacyjne (kampanie) i kadrowe (pracownicy socjalni).
Zrównoważony rozwój: równowaga sfery ekonomicznej, społecznej i ekologicznej.
Etapy polityki społecznej: diagnoza, analiza przyczyn, propozycje, decyzja, legislacja, wdrożenie, ewaluacja.
Ludzie nie są homo economicus: racjonalność ograniczona, heurystyki, status quo bias.`;

async function addTextMaterial(run,o={}){ // + → Wklej tekst → (zgoda) → tekst → ekran „Dodaj materiał”
  await tap(run,'.navplus');if(o.shotSheet)await shot(run,'quickadd-sheet','Arkusz „Dodaj materiał”: zdjęcie / plik / tekst / „Mam sprawdzian”','Dolna nawigacja → [+]');
  await tap(run,'#qa-text');
  if(await has(run,'#cfc-ok')){if(o.shotConsent)await shot(run,'ai-consent','Zgoda na przetwarzanie przez AI (Claude, Anthropic) przed pierwszym materiałem','[+] → Wklej tekst (pierwszy raz)');await tap(run,'#cfc-ok');}
  await waitFor(run,'#cft-in');
  if(o.shotText){await shot(run,'paste-text-sheet','Arkusz „Wklej tekst” (pusty)','Zgoda → arkusz tekstu');
    await fill(run,'#cft-in','Za krótko.');await tap(run,'#cft-ok');await shot(run,'paste-text-too-short','Arkusz tekstu: walidacja „Wklej trochę więcej…” (< 40 znaków)','Krótki tekst → DALEJ');}
  await fill(run,'#cft-in',o.text||NOTES_TEXT);
  if(o.shotText)await shot(run,'paste-text-filled','Arkusz „Wklej tekst” z notatkami','Wklejone notatki');
  await tap(run,'#cft-ok');await waitFor(run,'#cfadd-go');
}

/* ============================================================ SCENARIUSZE */
const SCEN={};

/* 1) Nowe konto od zera: rejestracja → etap → cel → pusty Dziś → tekst → generowanie → przedmiot → lekcja → Ćwiczenia → wylogowanie */
SCEN.fresh=async()=>{
  const r=await newRun('fresh','mock=fresh&reset=1&gen=slow:30');
  await waitFor(r,'#cf-go');
  await shot(r,'auth-signup','Logowanie: zakładka „Załóż konto” (domyślna), checkbox 16+','Pierwsze uruchomienie bez sesji');
  await tap(r,'.cftab','Zaloguj się');await shot(r,'auth-signin','Logowanie: zakładka „Zaloguj się”','Zakładka „Zaloguj się”');
  await tap(r,'.cftab','Załóż konto');
  await tap(r,'#cf-go');await shot(r,'auth-error-email','Rejestracja: błąd „Wpisz poprawny adres e-mail.”','ZAŁÓŻ KONTO z pustym formularzem');
  await typeIn(r,'#cf-email','nowa.osoba@cramfox.test');await typeIn(r,'#cf-pass','haslo-testowe-1');
  await tap(r,'#cf-go');await shot(r,'auth-error-age','Rejestracja: błąd 16+ (bez zaznaczenia wieku); lis zasłania oczy przy haśle','E-mail i hasło bez checkboxa');
  await tap(r,'#cf-privacy');await shot(r,'privacy-sheet','Arkusz „Twoje dane w Cramfox” (7 punktów)','Logowanie → „Jak przetwarzamy Twoje dane”');await tap(r,'#cfp-ok');
  await tap(r,'#cf-age');await tap(r,'#cf-go',null,{settle:100});
  await waitFor(r,'.levelpick',null,15000);
  await shot(r,'levelpick','Pierwsze uruchomienie, krok 1: „Na jakim etapie jesteś?” (nic nie wybrane, DALEJ nieaktywne)','Po rejestracji (przeładowanie)');
  await tap(r,'.obopt[data-level="studia"]');await shot(r,'levelpick-selected','Krok 1: wybrany etap „Studia” i cele','Wybór „Studia”');
  await tap(r,'#ob-next');await waitFor(r,'.onboarding');
  await shot(r,'goal','Krok 2: „Ile czasu dziennie?” (cel XP)','Etap → DALEJ');
  await tap(r,'.obopt.goal[data-goal="50"]');await tap(r,'#ob-next');await waitFor(r,'#eadd');
  await shot(r,'today-empty','Dziś: puste konto — 3 kroki i „Dodaj materiał”','Cel → USTAW CEL');
  await addTextMaterial(r,{shotSheet:true,shotConsent:true,shotText:true});
  await shot(r,'add-material','Ekran „Dodaj materiał”: tekst, „Gdzie dodać?” (Nowy przedmiot), skupienie, TWÓRZ LEKCJĘ','Arkusz tekstu → DALEJ');
  await tap(r,'.topbar .backbtn');await shot(r,'add-leave-confirm','Pytanie „Porzucić materiał?” przy wyjściu z niezapisanym materiałem','„Dodaj materiał” → Wróć');await tap(r,'#askno');
  await fill(r,'.cfadd-body input.cfin:last-of-type','tylko instrumenty polityki społecznej');
  await shot(r,'add-material-filled','„Dodaj materiał” z podpowiedzią „Na czym się skupić?”','Wpisana podpowiedź');
  await tap(r,'#cfadd-go',null,{settle:1500});
  await shot(r,'generating-start','Tworzenie lekcji: start (pasek, kroki, „DZIAŁAJ W TLE”)','TWÓRZ LEKCJĘ (atrapa: gen=slow:30)');
  await sleep(26000);await shot(r,'generating-progress','Tworzenie lekcji po ~27 s: kolejny krok zaznaczony, pasek ~55%','Czekanie na AI');
  await waitFor(r,'#cfr-name',null,20000);
  await shot(r,'subject-ready','„Lekcja gotowa”: nazwa od AI, kolor, nowe poziomy, ZACZNIJ NAUKĘ / „Mam z tego sprawdzian”','Koniec generowania');
  const log=await mockLog(r);const posts=log.filter(x=>x.startsWith('POST /api/generate')).length;
  if(posts!==1)issue(r,'generate-retry',`POST /api/generate wywołany ${posts} razy przy jednym „TWÓRZ LEKCJĘ”`);
  await tap(r,'.cfadd-foot .pill.a-glow');await waitFor(r,'.pathview');
  await shot(r,'subject-path','Ścieżka nowego przedmiotu: poziom 1 do zrobienia, reszta zablokowana, skrzynia, boss','„Lekcja gotowa” → ZACZNIJ NAUKĘ');
  await tap(r,'.node-open');await waitFor(r,'#lesson.open .chat');
  await chatThrough(r);
  const res=await lessonQuiz(r,{wrong:1});
  if(res==='done'){
    await shot(r,'level-complete','Wynik poziomu: gwiazdki, XP, celność, combo, gemy, duch zapisany','Ostatnie pytanie → DALEJ');
    await tap(r,'#lcont');
    if(await has(r,'.scel'))await shot(r,'streak-celebration','Świętowanie serii po pierwszym poziomie dnia (dzień 1)','Wynik poziomu → DALEJ');
    else UNREACHED.push('fresh: świętowanie serii nie pojawiło się po pierwszym poziomie');
    if(await has(r,'.lessonfoot .pill.amber'))await tap(r,'.lessonfoot .pill.amber');
    await waitFor(r,'.pathview');await shot(r,'subject-path-after','Ścieżka po zaliczeniu poziomu 1 (poziom 2 odblokowany)','Świętowanie → DALEJ');
  }
  // Ćwiczenia: wszystkie typy zadań z poziomów
  await tap(r,'.subtab','Ćwiczenia');await waitFor(r,'.exhub');await shot(r,'cwicz-hub','Zakładka „Ćwiczenia”: gry z fiszek + „Zadania z poziomów” po typach','Przedmiot → Ćwiczenia');
  await scrollBy(r,'#subjscreen .scroll','end');await shot(r,'cwicz-hub-tasks','Ćwiczenia: lista typów zadań (dół)','Przewinięcie');
  for(const type of TASK_ORDER){
    try{
      await tap(r,'.subtab','Ćwiczenia');
      const label=TASK_LABEL[type];if(!(await find(r,'.excard h3',label,{exact:true}))){UNREACHED.push(`zadanie „${type}”: brak w przedmiocie z generowania (fixtures)`);continue;}
      await tap(r,'.excard h3',label,{exact:true});await waitFor(r,'.task');
      await shot(r,'task-'+type,`Zadanie „${label}” (stan początkowy)`,'Ćwiczenia → '+label);
      const pre=['fill','sort','timeline','chain','order'].includes(type);
      if(pre){await solve(r,{submit:false});await shot(r,'task-'+type+'-filled',`Zadanie „${label}”: ułożone, przed sprawdzeniem`,'Ułożenie odpowiedzi');
        await r.page.evaluate(()=>{const b=[...document.querySelectorAll('.tfoot .pill')].find(b=>!b.disabled&&!b.classList.contains('hide'));if(b)b.click();});}
      else await solve(r,{wrong:type==='typeterm'||type==='swipe'});
      await sheetAfter(r,20000);
      await shot(r,'task-'+type+'-result',`Zadanie „${label}”: wynik (panel ${type==='typeterm'||type==='swipe'?'„Nie tym razem”':'„Dobrze!”'})`,'Sprawdzenie');
    }catch(e){FAILS.push(`fresh/zadanie ${type}: ${e.message}`);}
  }
  // gry z fiszek w Ćwiczeniach
  for(const [label,name,state] of [['Pary z fiszek','cwicz-pairs','Ćwiczenie „Pary z fiszek”'],['Szybki quiz na czas','cwicz-speed','Ćwiczenie „Szybki quiz na czas” (60 s)'],['Pojęcie z fiszek','cwicz-typing','Ćwiczenie „Pojęcie z fiszek” (wpisz termin)']]){
    try{await tap(r,'.subtab','Ćwiczenia');await tap(r,'.excard h3',label,{exact:true});await shot(r,name,state,'Ćwiczenia → '+label);}catch(e){FAILS.push(`fresh/${name}: ${e.message}`);}}
  await tap(r,'.subtab','Ścieżka');
  // ustawienia → wylogowanie
  await tap(r,'.brow .backbtn');await nav(r,'Profil');await tap(r,'.topbar .backbtn[aria-label="Ustawienia"]');await waitFor(r,'#set-plan');await settle(r,500);
  await shot(r,'settings-new-account','Ustawienia nowego konta: „Nowe lekcje 1 z 150 · na start większy limit, jeszcze 30 dni”','Profil → Ustawienia');
  await tap(r,'.topbar .backbtn');await tap(r,'.topbar .backbtn[aria-label="Ustawienia"]');await waitFor(r,'#set-logout');
  await tap(r,'#set-logout');await waitFor(r,'#askok');await tap(r,'#askok',null,{settle:100});
  await waitFor(r,'#cf-go',null,15000);await shot(r,'after-logout','Po wylogowaniu: ekran logowania (dane lokalne skasowane)','Ustawienia → Wyloguj → Wyloguj');
  const left=await r.page.evaluate(()=>Object.keys(localStorage).filter(k=>!k.startsWith('mockbe:')&&k!=='cf_legacy_cleared')); // cf_legacy_cleared: globalny znacznik, nie dane konta
  if(left.length)issue(r,'logout-leftovers','Po wylogowaniu w localStorage zostało: '+left.join(', '));
  await closeRun(r);
};

/* 2) Konto z postępami: wszystkie ekrany grywalizacji, nauki, egzaminu, planu, bossa, konta */
SCEN.seeded=async()=>{
  const r=await newRun('seeded','mock=seeded&reset=1&gen=slow:10');
  await waitFor(r,'.plan');
  await shot(r,'today','Dziś (konto z postępami): plan dnia, cel XP, misje/seria/album, przedmioty','Start zalogowanego konta');
  await scrollBy(r,'.screen.active .scroll','end');await shot(r,'today-bottom','Dziś: dół (kafle przedmiotów + „Dodaj”)','Przewinięcie');
  await tap(r,'.link','Wszystkie');await waitFor(r,'.subjects');await shot(r,'subjects','Przedmioty: siatka wszystkich przedmiotów','Dziś → „Wszystkie ›”');await nav(r,'Dziś');
  await tap(r,'.topbar .streak');await waitFor(r,'.streakview');await shot(r,'streak','Seria: lis z płomieniem, licznik, kamień milowy, tydzień, zamrożenia','Pigułka serii w górnym pasku');
  await tap(r,'.streakclose');
  await tap(r,'.minitile','Misje');await waitFor(r,'.missions');await shot(r,'missions','Misje: 3 dzienne + tygodniowa','Dziś → kafel „Misje”');await tap(r,'.topbar .backbtn');
  await tap(r,'.minitile','Album');await waitFor(r,'.albgrid');await shot(r,'album','Album pojęć: zebrane (zwykłe/trudne/mistrzowskie) i zablokowane','Dziś → kafel „Album”');
  await tap(r,'.alb:not(.lock)');await shot(r,'album-flip','Album: odwrócona karta z definicją','Stuknięcie karty');await tap(r,'.topbar .backbtn');
  await waitFor(r,'.plan');await tap(r,'.topbar .streak.gems');await waitFor(r,'.shoprow');await shot(r,'shop','Plecak (sklep): zamrożenie, serca, podwójne XP, okulary','Pigułka gemów');
  await tap(r,'.topbar .backbtn');
  await nav(r,'Profil');await waitFor(r,'.prof');await shot(r,'profile','Profil: poziom konta, statystyki, aktywność','Dolna nawigacja → Profil');
  await scrollBy(r,'.screen.active .scroll','end');await shot(r,'profile-badges','Profil: odznaki i XP w przedmiotach','Przewinięcie');
  await tap(r,'.sechdr .link','Ten tydzień');await waitFor(r,'.wk');await shot(r,'weekly','Podsumowanie tygodnia (bieżący vs zeszły)','Profil → „Ten tydzień”');await tap(r,'#wk-close');
  await tap(r,'.topbar .backbtn[aria-label="Ustawienia"]');await waitFor(r,'#set-logout');await settle(r,600);
  await shot(r,'settings','Ustawienia: karta „Konto” (limit lekcji, trial), Profil','Profil → koło zębate');
  await scrollBy(r,'.screen.active .scroll',560);await shot(r,'settings-middle','Ustawienia: Nauka, Przedmioty, Dane','Przewinięcie');
  await tap(r,'#set-whatsnew');await scrollBy(r,'.screen.active .scroll','end');await shot(r,'settings-bottom','Ustawienia: O aplikacji + rozwinięte „Co nowego”','Przewinięcie + „Co nowego”');
  await tap(r,'#set-privacy');await shot(r,'privacy-sheet-settings','Arkusz „Twoje dane” z ustawień','Ustawienia → Twoje dane');await tap(r,'#cfp-ok');
  await tap(r,'#set-logout');await shot(r,'logout-confirm','Potwierdzenie wylogowania','Ustawienia → Wyloguj');await tap(r,'#askno');
  await tap(r,'#set-delete');await shot(r,'delete-account-sheet','Arkusz „Usunąć konto?”','Ustawienia → Usuń konto');await tap(r,'#cfdel-no');
  await tap(r,'#set-reset');await shot(r,'reset-progress-confirm','Potwierdzenie „Wyzerować postępy?”','Ustawienia → Wyzeruj postępy');await tap(r,'#askno');
  await tap(r,'#set-level');await waitFor(r,'.levelpick');await shot(r,'levelpick-from-settings','Etap i cel z ustawień (ZAPISZ / Wróć bez zmian)','Ustawienia → Etap i cel');await tap(r,'#ob-back');
  await tap(r,'#set-goal');await waitFor(r,'.onboarding');await shot(r,'goal-from-settings','Cel dzienny z ustawień','Ustawienia → Cel dzienny');await tap(r,'#ob-back');
  // powtórka SRS
  await nav(r,'Powtórka');await waitFor(r,'.rvhero');await shot(r,'review','Powtórka: ile na dziś, z czego, stan pamięci','Dolna nawigacja → Powtórka');
  await tap(r,'#rvstart');await waitFor(r,'.rvrun');await shot(r,'review-card','Powtórka: fiszka (przód), jeszcze nie / umiem','ZACZNIJ POWTÓRKĘ');
  await tap(r,'.rvrun .flip');await shot(r,'review-card-back','Powtórka: fiszka odwrócona (definicja)','Stuknięcie fiszki');
  let rq=false;
  for(let k=0;k<20;k++){if(await has(r,'#rvmain'))break;
    if(await has(r,'#rvyes')){await tap(r,k%3===1?'#rvno':'#rvyes',null,{settle:420});continue;}
    if(await has(r,'.rvrun .quiz')){if(!rq){rq=true;await shot(r,'review-quiz','Powtórka: pytanie z quizu (bez serc i combo)','Po fiszkach w sesji');}
      await solve(r,{wrong:k%2===0});await sheetAfter(r);await tap(r,'#snext',null,{settle:420});continue;}
    await sleep(300);}
  await waitFor(r,'#rvmain');await shot(r,'review-done','Koniec powtórki: % umiem, wracają dziś, seria','Ostatni element powtórki');await tap(r,'#rvdone');
  // fiszki
  await nav(r,'Fiszki');await waitFor(r,'.cards');await shot(r,'cards-hub','Fiszki (hub): powtórka na dziś + przedmioty','Dolna nawigacja → Fiszki');
  await tap(r,'.setrow','Polityka');await waitFor(r,'#subjscreen .flip');await shot(r,'flashcards','Fiszki przedmiotu: filtr poziomów, licznik, karta','Fiszki → przedmiot');
  await tap(r,'#subjscreen .flip');await shot(r,'flashcards-back','Fiszka odwrócona','Stuknięcie karty');
  await tap(r,'.chips .chip','Podstawy');
  for(let k=0;k<12&&!(await has(r,'.fdone'));k++)await tap(r,k%3===2?'.fbtn.no':'.fbtn.yes',null,{settle:420});
  await waitFor(r,'.fdone');await shot(r,'flashcards-done','Koniec talii: % umiem, „Wracają dziś”, POWTÓRZ TE N','Przejście talii „Podstawy”');
  // ścieżka, skrzynia, info
  await tap(r,'.subtab','Ścieżka');await waitFor(r,'.pathview');await shot(r,'path-progress','Ścieżka w trakcie: 3 zaliczone (gwiazdki), bieżący poziom 4, skrzynia do otwarcia','Przedmiot → Ścieżka');
  if(await has(r,'.node-chest.a-sway')){await tap(r,'.node-chest.a-sway',null,{settle:120});await shot(r,'path-chest-opened','Skrzynia otwarta: +10 gemów (toast)','Stuknięcie skrzyni');}else UNREACHED.push('seeded: skrzynia do otwarcia nie była widoczna');
  await tap(r,'.infobtn');await waitFor(r,'.info');await shot(r,'subject-info','Info przedmiotu: kafle z info (emoji z danych!), siatka ocen','Przedmiot → (i)');
  await scrollBy(r,'#subjscreen .scroll','end');await shot(r,'subject-info-scale','Info: siatka ocen z „tu jesteś”, egzamin, sprawdzian','Przewinięcie');
  // quiz w zakładce
  await tap(r,'.subtab','Quiz');await waitFor(r,'.quizview .quiz');await shot(r,'quiz-tab','Zakładka Quiz: pytanie (filtr poziomów, licznik)','Przedmiot → Quiz');
  await solve(r,{wrong:true});await sheetAfter(r);await shot(r,'quiz-wrong-sheet','Quiz: panel „Nie tym razem”','Zła odpowiedź w zakładce Quiz');
  if(await has(r,'#sexpl')){await tap(r,'#sexpl');await shot(r,'quiz-explain-sheet','Quiz: „Wyjaśnijmy inaczej”','WYJAŚNIJ INACZEJ');await tap(r,'#sok');}
  await tap(r,'#snext');
  let tfSeen=false;
  for(let k=0;k<30&&!tfSeen;k++){if(!(await has(r,'.quizview .quiz')))break;
    if(await has(r,'.quizview .quiz.qtf')){tfSeen=true;await shot(r,'quiz-truefalse','Quiz: pytanie jako „prawda czy fałsz” (ochrona przed „najdłuższa jest dobra”)','Kolejne pytania w zakładce Quiz');}
    await solve(r);const s=await sheetAfter(r);if(k===0&&s==='ok')await shot(r,'quiz-ok-sheet','Quiz: panel „Dobrze!” (+3 XP)','Dobra odpowiedź');await tap(r,'#snext');}
  if(!tfSeen)UNREACHED.push('seeded: pytanie w trybie prawda/fałsz nie wypadło w 30 pytaniach zakładki Quiz');
  // egzamin
  await tap(r,'.subtab','Egzamin');await waitFor(r,'#exstart');await shot(r,'exam-setup','Egzamin: ustawienia (pytania, czas, próg), zakres, siatka ocen','Przedmiot → Egzamin');
  await scrollBy(r,'#subjscreen .scroll','end');await shot(r,'exam-setup-bottom','Egzamin: warunki, ostatnie podejście, „Mam sprawdzian”, „Egzamin jutro?”','Przewinięcie');
  await tap(r,'#egn .egchip[data-n="10"]');await tap(r,'#exstart');await waitFor(r,'.egrun');
  await shot(r,'exam-run','Egzamin w trakcie: pytanie, czas, siatka, flaga','ZACZYNAM · 10 PYTAŃ');
  await tap(r,'.egrun .qopt');await tap(r,'#egflag');await shot(r,'exam-run-flagged','Egzamin: wybrana odpowiedź i flaga „Do wrócenia”','Wybór + flaga');
  await tap(r,'#eggrid');await shot(r,'exam-grid','Egzamin: arkusz z siatką pytań','Przycisk siatki');await tap(r,'#eggclose');
  for(let k=0;k<12;k++){
    const last=await r.page.evaluate(()=>{const b=document.getElementById('egnext');return b?b.textContent.trim():'';});
    if(k>0&&k!==4){await r.page.evaluate((kb,k)=>{const N=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();const q=N(document.querySelector('.egrun .qq').textContent);const ans=kb.quiz[q];
      const os=[...document.querySelectorAll('.egrun .qopt')];let o=os.find(x=>N(x.querySelector('.t').textContent)===ans);if(k%3===0)o=os.find(x=>x!==o)||o;(o||os[0]).click();},KB,k);}
    if(last==='ZAKOŃCZ'){await tap(r,'#egnext');break;}
    await tap(r,'#egnext',null,{settle:380});}
  await waitFor(r,'#egfin');await shot(r,'exam-confirm','Egzamin: „Zakończyć egzamin?” (puste / do wrócenia / z odpowiedzią)','Ostatnie pytanie → ZAKOŃCZ');
  await tap(r,'#egfin');await waitFor(r,'.egres');await shot(r,'exam-result','Wynik egzaminu: % i ocena, statystyki, „Gdzie tracisz punkty”','ZAKOŃCZ I SPRAWDŹ');
  await scrollMain(r,760);await shot(r,'exam-result-review','Wynik egzaminu: siatka ocen, talia błędów, przegląd pytań','Przewinięcie');
  if(await has(r,'#egmain','TALIA')){await tap(r,'#egmain');await waitFor(r,'.rvrun');await shot(r,'exam-error-deck','Talia błędów z egzaminu (sesja powtórki)','Wynik → TALIA BŁĘDÓW');await tap(r,'.rvrun .lessonhead .x');await nav(r,'Dziś');}
  else{await tap(r,'#egalt');await tap(r,'.brow .backbtn');}
  // noc przed egzaminem + plan do sprawdzianu
  await waitFor(r,'.plan');await tap(r,'.subjtile','Polityka');await tap(r,'.subtab','Egzamin');await waitFor(r,'#excram');
  await tap(r,'#excram');await waitFor(r,'#cram-start');await shot(r,'cram','Noc przed egzaminem: 4 bloki po 5 minut','Egzamin → „Egzamin jutro?”');
  await tap(r,'#cram-start');await waitFor(r,'.cramrun');await shot(r,'cram-run','Noc przed egzaminem: blok 1 (fiszka, czas bloku)','ZACZYNAM');
  for(let k=0;k<6&&!(await has(r,'#cram-done'));k++)await tap(r,'#cram-skip',null,{settle:300,timeout:3000}).catch(()=>{});
  await waitFor(r,'#cram-done');await shot(r,'cram-done','Noc przed egzaminem: „Idź spać”, plan na jutro','Pominięcie bloków');await tap(r,'#cram-alt');
  await waitFor(r,'#extest');await tap(r,'#extest');await waitFor(r,'#tpgo');await shot(r,'testplan-sheet','Arkusz „Mam sprawdzian”: przedmiot, data, zakres, podsumowanie','Egzamin → „Mam sprawdzian”');
  await tap(r,'#tpgo');await waitFor(r,'.tplan');await shot(r,'testplan','Plan do sprawdzianu: gotowość, dni, akcje','UŁÓŻ PLAN');
  await scrollBy(r,'.screen.active .scroll','end');await shot(r,'testplan-bottom','Plan do sprawdzianu: dół (sprawdzian, Usuń plan)','Przewinięcie');
  await tap(r,'.topbar .backbtn');await waitFor(r,'.plan');await shot(r,'today-with-test','Dziś z wierszem „Do sprawdzianu — …” na górze planu','Plan → Dziś');
  // lekcja z konta z postępami → wynik → kamień milowy serii (7 dni)
  await tap(r,'.subjtile','Polityka');await waitFor(r,'.node-open');await tap(r,'.node-open');await waitFor(r,'#lesson.open .chat');
  await chatThrough(r,{shots:false,endShot:false,vizShots:false});
  if(await lessonQuiz(r,{wrong:0,shots:false,noBadShots:true,noOkShots:true})==='done'){
    await shot(r,'level-complete-seeded','Wynik poziomu (konto z postępami)','Lekcja poziomu 4');
    await tap(r,'#lcont');if(await has(r,'.scel.ms'))await shot(r,'streak-milestone','Kamień milowy serii: 7 dni (gemy, odznaka, nowy wygląd lisa)','Pierwszy poziom dnia przy serii 6 → 7');
    else if(await has(r,'.scel'))await shot(r,'streak-celebration-seeded','Świętowanie serii','Pierwszy poziom dnia');
    if(await has(r,'.lessonfoot .pill.amber'))await tap(r,'.lessonfoot .pill.amber');}
  // boss (Krypto: wszystkie poziomy zaliczone)
  await tap(r,'.brow .backbtn');await waitFor(r,'.plan');await tap(r,'.subjtile','Krypto');await waitFor(r,'.node-boss');
  await r.page.evaluate(()=>{const n=document.querySelector('.node-boss');if(n)n.scrollIntoView({block:'center'});});await shot(r,'path-boss','Ścieżka: wszystkie poziomy zaliczone, boss „WALKA”','Krypto → Ścieżka');
  await tap(r,'.node-boss');await waitFor(r,'.bossrun');await shot(r,'boss-run','Boss Szop Zapominalski: pasek życia, cios, czas 20 s','Węzeł bossa');
  let hitShot=false;
  const turn=()=>r.page.evaluate(()=>{const e=document.querySelector('.bossq .eyebrow');return e?e.textContent:'';}).catch(()=>'');
  for(let k=0;k<30;k++){if(await has(r,'.bossres'))break;if(!(await has(r,'.bossrun .quiz, .bossrun .task'))){await sleep(250);continue;}
    const before=await turn();
    await solve(r,{wrong:k===1});
    if(!hitShot&&k===0){await sleep(120);hitShot=true;await shot(r,'boss-hit','Boss: trafienie (−1 życia szopa, +XP)','Dobra odpowiedź u bossa');}
    if(k===1){await sleep(150);await shot(r,'boss-miss','Boss: pudło (szop się śmieje, −1 serce, „Zapamiętaj”)','Zła odpowiedź u bossa');}
    for(let w=0;w<60;w++){await sleep(150);if(await has(r,'.bossres')||(await turn())!==before)break;}}
  if(await has(r,'.bossres')){await shot(r,'boss-result','Wynik walki z bossem','Koniec walki');await tap(r,'#bossmain');}else FAILS.push('seeded: walka z bossem nie skończyła się w 30 ruchach');
  // brak żyć
  await r.page.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('nauka_progress_v1:'));const p=JSON.parse(localStorage.getItem(k));p.hearts={n:0,refillAt:Date.now()+25*60000};localStorage.setItem(k,JSON.stringify(p));NaukaEngine.reload();});
  await waitFor(r,'.plan');await tap(r,'.subjtile','Polityka');await waitFor(r,'.node-open');await tap(r,'.node-open');await waitFor(r,'#sheet.nohearts');
  await shot(r,'no-hearts','Koniec żyć: licznik, „Powtórz 10 fiszek”, „Uzupełnij wszystkie” za gemy','Węzeł poziomu przy 0 sercach (stan ustawiony w localStorage)');
  await tap(r,'#nhgems',null,{settle:100});await shot(r,'no-hearts-refilled','Życia uzupełnione za 50 gemów (toast)','Koniec żyć → Uzupełnij wszystkie');
  // duch: powtórka zaliczonego dziś poziomu
  try{await tap(r,'.nodebtn.node-done[aria-label*="Polska: demografia"]');await waitFor(r,'#lesson.open .chat');await chatThrough(r,{shots:false,endShot:false,vizShots:false});
    await waitFor(r,'.ghostcard',null,8000);await sleep(1200);await shot(r,'lesson-ghost','Powtórka poziomu: wyścig z duchem (własny najlepszy przebieg)','Ścieżka → zaliczony dziś poziom → czat → pytania');
    await tap(r,'#lesson .lessonhead .x');}catch(e){FAILS.push('seeded/duch: '+e.message);}
  // plecak: zakup
  await tap(r,'.brow .streak.gems');await waitFor(r,'#shop-freeze');await tap(r,'#shop-freeze .buy',null,{settle:150});await shot(r,'shop-bought','Plecak: kupione zamrożenie (toast, gemy w górę)','Plecak → Zamrożenie serii');
  await tap(r,'.topbar .backbtn');await tap(r,'.brow .backbtn');
  // zdjęcie strony → istniejący przedmiot → generowanie w tle
  await mockSet(r,'upload','slow');
  await waitFor(r,'.plan');await tap(r,'.navplus');await shot(r,'quickadd-sheet-seeded','Arkusz „Dodaj materiał” (konto z przedmiotami)','[+]');
  await chooseFiles(r,'#qa-photo',[path.join(ASSETS,'strona-podrecznika.png')]);await waitFor(r,'#cfadd-go');
  await tap(r,'.cfwhere .obopt','Polityka');await shot(r,'add-photo','„Dodaj materiał”: miniatura zdjęcia, wybrany istniejący przedmiot','[+] → Zrób zdjęcie (wybór pliku)');
  await tap(r,'.cfthumb-x');await shot(r,'add-photo-removed','„Dodaj materiał” po usunięciu zdjęcia (pusty materiał)','Usunięcie miniatury');
  await chooseFiles(r,'.cfmore .chip',[path.join(ASSETS,'skan-rozdzialu.pdf'),path.join(ASSETS,'strona-podrecznika.png')],'Plik').catch(e=>FAILS.push('seeded: + Plik: '+e.message));
  await shot(r,'add-files','„Dodaj materiał”: PDF 7 MB + zdjęcie','„+ Plik” (wybór dwóch plików)');
  await tap(r,'#cfadd-go',null,{settle:900});await shot(r,'generating-upload','Tworzenie lekcji: wysyłka pliku (MB z MB; PDF > 6 MB idzie kawałkami TUS)','TWÓRZ LEKCJĘ (upload=slow)');
  await waitFor(r,'.cfstep.cur',null,20000);await shot(r,'generating-ai','Tworzenie lekcji: faza AI','Po wysłaniu plików');
  await tap(r,'.cfadd-foot .pill.ghost');await waitFor(r,'.plan');await shot(r,'generating-background-today','Dziś w trakcie generowania w tle','DZIAŁAJ W TLE');
  const tl=await mockLog(r);if(!tl.some(x=>x.startsWith('PATCH /storage/v1/upload/resumable')))issue(r,'tus','Plik 7 MB nie poszedł przez TUS (brak PATCH /upload/resumable)');
  await waitFor(r,'#toast.show','Lekcja gotowa',30000);await shot(r,'generation-done-toast','Toast „Lekcja gotowa: …” po generowaniu w tle','Czekanie na koniec generowania');
  await tap(r,'.subjtile','Polityka');await waitFor(r,'.pathview');await scrollBy(r,'.pathview','end');await shot(r,'path-new-chapter','Ścieżka po dodaniu materiału: nowy rozdział na końcu (pierwszy poziom od razu odblokowany)','Dziś → Polityka');
  // usunięcie konta (atrapa)
  await tap(r,'.brow .backbtn');await nav(r,'Profil');await tap(r,'.topbar .backbtn[aria-label="Ustawienia"]');await tap(r,'#set-delete');
  await mockSet(r,'lat','900');await tap(r,'#cfdel-go',null,{settle:300});await shot(r,'delete-account-busy','Usuwanie konta w toku („USUWAM…”)','Usuń konto → USUŃ KONTO NA ZAWSZE');
  await waitFor(r,'#cf-notice',null,15000);await shot(r,'account-deleted','Po usunięciu konta: logowanie z podziękowaniem','Koniec usuwania');
  const st=await r.page.evaluate(()=>{const d=MOCK.db();return {users:d.users.length,objects:Object.keys(d.objects).length,rows:Object.fromEntries(Object.entries(d.t).map(([k,v])=>[k,v.length]))};});
  if(st.users||st.objects||st.rows.subjects||st.rows.topics||st.rows.app_state)issue(r,'delete-leftovers','Po usunięciu konta w atrapie zostało: '+JSON.stringify(st));
  await closeRun(r);
};

/* 3) Powrót po przerwie */
SCEN.comeback=async()=>{
  const r=await newRun('comeback','mock=seeded&reset=1&away=5');
  await waitFor(r,'.comeback');await shot(r,'comeback','Powrót po 5 dniach: seria od nowa, co czeka na powtórkę, „ZACZNIJ OD 5 MINUT”','Konto z ostatnią nauką 5 dni temu (away=5)');
  await tap(r,'#cbplan');await waitFor(r,'.plan');await shot(r,'today-after-break','Dziś po przerwie (seria 0)','Powrót → NORMALNY PLAN DNIA');
  await closeRun(r);
};

/* 4) Błędy generowania i sieci (konto z postępami, zgoda na AI już dana) */
const GEN_ERRORS=[
  ['err:limit_reached','err-limit-month','Limit na ten miesiąc (402 z serwera)'],
  ['err:limit_reached:999999','err-limit-day','Limit dzienny konta (used=999999)'],
  ['err:limit_reached:1999999','err-limit-global','Globalny bezpiecznik serwera (used=1999999)'],
  ['err:generation_failed','err-generation-failed','AI nie dało rady (+ „liczy się do limitu”)'],
  ['err:refusal','err-refusal','Odmowa modelu'],
  ['err:invalid_output','err-invalid-output','Nie dało się ułożyć lekcji'],
  ['err:api','err-api-overloaded','Serwer AI przeciążony'],
  ['err:too_long','err-too-long','Za dużo materiału na jedną lekcję (pobrany limit)'],
  ['err:reserve_failed','err-reserve-failed','Naliczenie limitu się nie udało'],
  ['err:no_config','err-no-config','Serwer bez konfiguracji (503)'],
  ['html504','err-vercel-504','504 bez JSON (Vercel zabił funkcję) → generation_failed'],
  ['err:bad_request','err-unknown-400','Błąd 400 bez znanego kodu → „Coś poszło nie tak”']
];
SCEN.errors=async()=>{
  const r=await newRun('errors','mock=seeded&reset=1');
  await waitFor(r,'.plan');
  for(const [gen,name,what] of GEN_ERRORS){
    try{await mockSet(r,'gen',gen);await addTextMaterial(r);await tap(r,'#cfadd-go');await waitFor(r,'.errv',null,15000);
      await shot(r,name,'Błąd generowania: '+what,`gen=${gen} → [+] → Wklej tekst → TWÓRZ LEKCJĘ`);
      const lbl=await r.page.$$eval('.errfoot .pill',bs=>bs.map(b=>b.textContent.trim()));
      if(lbl.includes('WRÓĆ DO MATERIAŁU')){await tap(r,'.errfoot .pill','WRÓĆ DO MATERIAŁU');await waitFor(r,'#cfadd-go');await tap(r,'.topbar .backbtn');if(await has(r,'#askok'))await tap(r,'#askok');}
      else await tap(r,'.errfoot .pill');
      await waitFor(r,'.plan',null,8000);
    }catch(e){FAILS.push(`errors/${name}: ${e.message}`);await go(r,'mock=seeded');}
  }
  // limit sprawdzony w kliencie (z /api/me), zanim cokolwiek zostanie wysłane
  try{await mockSet(r,'gen','ok');await mockSet(r,'used','150');await addTextMaterial(r);const n0=(await mockLog(r)).length;await tap(r,'#cfadd-go');await waitFor(r,'.errv',null,10000);
    await shot(r,'err-limit-client','Limit miesięczny wykryty w kliencie (/api/me: 150 z 150) — bez tworzenia przedmiotu','used=150 → TWÓRZ LEKCJĘ');
    const lg=await mockLog(r);if(lg.slice(n0).some(x=>x.startsWith('POST /rest/v1/subjects')||x.startsWith('POST /api/generate')))issue(r,'limit-client','Przy wyczerpanym limicie klient i tak utworzył przedmiot albo wywołał generowanie');
    await tap(r,'.errfoot .pill');await mockSet(r,'used','');}catch(e){FAILS.push('errors/limit-client: '+e.message);}
  // plik za duży (serwer, z nazwą pliku) i błąd wysyłki
  try{await mockSet(r,'gen','err:file_too_big');await tap(r,'.navplus');await chooseFiles(r,'#qa-file',[path.join(ASSETS,'notatki-wyklad.pdf')]);await waitFor(r,'#cfadd-go');
    await shot(r,'add-pdf','„Dodaj materiał” z plikiem PDF (miniatura pliku)','[+] → Wgraj plik');
    await tap(r,'#cfadd-go');await waitFor(r,'.errv',null,10000);await shot(r,'err-file-too-big','Plik za duży (błąd serwera z nazwą pliku)','gen=err:file_too_big → PDF → TWÓRZ LEKCJĘ');
    await tap(r,'.errfoot .pill','WRÓĆ DO MATERIAŁU');await mockSet(r,'gen','ok');await mockSet(r,'upload','413');await tap(r,'#cfadd-go');await waitFor(r,'.errv',null,10000);
    await shot(r,'err-upload-413','Storage odrzucił plik (413) → „Plik jest za duży”','upload=413 → TWÓRZ LEKCJĘ');
    await tap(r,'.errfoot .pill','WRÓĆ DO MATERIAŁU');await mockSet(r,'upload','500');await tap(r,'#cfadd-go');await waitFor(r,'.errv',null,10000);
    await shot(r,'err-upload-failed','Wysyłka pliku nieudana (500) → „Nie udało się wysłać pliku”','upload=500 → TWÓRZ LEKCJĘ');
    await mockSet(r,'upload','');await tap(r,'.errfoot .pill','WRÓĆ DO MATERIAŁU');await tap(r,'.topbar .backbtn');if(await has(r,'#askok'))await tap(r,'#askok');await waitFor(r,'.plan');}
  catch(e){FAILS.push('errors/file: '+e.message);await go(r,'mock=seeded');}
  // zerwane połączenie po wysłaniu → odzyskiwanie przez tabelę generations
  try{await mockSet(r,'gen','drop:9');await addTextMaterial(r);await tap(r,'#cfadd-go');await sleep(2600);
    await shot(r,'generating-recover','Połączenie zerwane po wysłaniu: „Sprawdzam, czy lekcja powstała…”','gen=drop:9 → TWÓRZ LEKCJĘ');
    await waitFor(r,'#cfr-name',null,40000);await shot(r,'recovered-ready','Odzyskana lekcja (temat powstał na serwerze mimo zerwanego połączenia)','Odzyskiwanie co 8 s');
    await tap(r,'.topbar .backbtn');await waitFor(r,'.plan');
    await mockSet(r,'gen','dropfail:5');await addTextMaterial(r);await tap(r,'#cfadd-go');await waitFor(r,'.errv',null,40000);
    await shot(r,'err-recover-failed','Odzyskiwanie: generowanie na serwerze się nie udało','gen=dropfail:5');await tap(r,'.errfoot .pill','Wróć',{exact:true});await waitFor(r,'.plan');}
  catch(e){FAILS.push('errors/drop: '+e.message);await go(r,'mock=seeded');}
  // offline: pasek, błąd przy dodawaniu, pasek po powrocie sieci
  try{await mockSet(r,'gen','ok');r.offline=true;await r.page.setOfflineMode(true);await settle(r,400);
    await shot(r,'offline-banner','Brak sieci: pasek „Brak sieci — nauka działa dalej…”','Tryb offline (navigator.onLine=false + zdarzenie offline)');
    await addTextMaterial(r);await tap(r,'#cfadd-go');await waitFor(r,'.errv',null,15000);await shot(r,'err-network','Tworzenie lekcji bez sieci: „Brak połączenia”','Offline → TWÓRZ LEKCJĘ');
    await r.page.setOfflineMode(false);r.offline=false;await settle(r,1200);
    const stuck=await r.page.evaluate(()=>{const b=document.getElementById('netbar');return !!b&&b.classList.contains('on');});
    await shot(r,'online-again','Sieć wróciła: czy pasek „Brak sieci” zniknął?','setOfflineMode(false) → zdarzenie online');
    if(stuck)issue(r,'BUG netbar',"Pasek „Brak sieci” zostaje po zdarzeniu 'online' (nasłuch online/resize w komentarzu, engine.js:3752)");
    await tap(r,'.errfoot .pill','Wróć',{exact:true}).catch(()=>{});}
  catch(e){FAILS.push('errors/offline: '+e.message);}
  // każde „TWÓRZ LEKCJĘ” = najwyżej jedno POST /api/generate (CLAUDE.md: bez automatycznego ponawiania)
  try{const posts=(await mockLog(r)).filter(x=>x.startsWith('POST /api/generate')).length;const want=GEN_ERRORS.length+3;
    NOTES.push(`errors: POST /api/generate wywołany ${posts} razy przy ${want} próbach, które doszły do generowania`);
    if(posts>want)issue(r,'generate-retry',`POST /api/generate: ${posts} wywołań przy ${want} próbach`);}catch(e){}
  // wylogowanie z niewysłanymi postępami
  try{await go(r,'mock=seeded');await waitFor(r,'.plan');await mockSet(r,'sync','fail');
    await nav(r,'Profil');await tap(r,'.topbar .backbtn[aria-label="Ustawienia"]');await tap(r,'.toggle');await sleep(300);
    await tap(r,'#set-logout');await tap(r,'#askok');await waitFor(r,'#askok','Wyloguj mimo to',15000);
    await shot(r,'logout-unsynced','Wylogowanie: „Postępy nie są zapisane na koncie” (Wyloguj mimo to / Zostaję)','sync=fail → zmiana ustawienia → Wyloguj');
    await tap(r,'#askno');}
  catch(e){FAILS.push('errors/logout-unsynced: '+e.message);}
  await closeRun(r);
};

/* 5) Start apki: offline przy pierwszym uruchomieniu, błąd pobrania postępów, odwołana sesja, logowanie na nowym urządzeniu */
SCEN.boot=async()=>{
  let r=await newRun('boot',null);
  await go(r,'mock=seeded&reset=1&net=off');await waitFor(r,'.errv',null,40000);
  await shot(r,'err-first-run-offline','Pierwsze uruchomienie bez sieci: „Potrzebuję internetu…”','Zalogowane konto, brak cache, net=off');
  await go(r,'mock=seeded&reset=1&fail=app_state');await waitFor(r,'.errv',null,40000);
  await shot(r,'err-sync-failed','Nowe urządzenie: „Nie mogę pobrać Twoich postępów” (blokada, żeby nie nadpisać konta)','fail=app_state (500)');
  await go(r,'mock=seeded&reset=1&fail=subjects');await waitFor(r,'.errv',null,40000);
  await shot(r,'err-server-down','Pierwsze uruchomienie: serwer nie odpowiada (500 przy pobraniu przedmiotów)','fail=subjects');
  r.last='goto mock=seeded&reset=1&auth=revoked';await r.page.goto(BASE+'?mock=seeded&reset=1&auth=revoked',{waitUntil:'load'});await sleep(500);
  await shot(r,'session-revoked-flash','Odwołana sesja przy starcie: co widać zanim apka przeładuje się do logowania','auth=revoked (token i refresh odrzucone)');
  const txt1=await r.page.evaluate(()=>document.getElementById('app').innerText.slice(0,200));
  await waitFor(r,'#cf-go',null,15000);await shot(r,'session-revoked-login','Po odwołanej sesji: ekran logowania','Przeładowanie po „Sesja wygasła”');
  if(/Serwer chwilowo nie odpowiada|Potrzebuję internetu/.test(txt1))issue(r,'session-revoked-ui','Odwołana sesja przy starcie pokazuje najpierw ekran błędu serwera („'+txt1.replace(/\s+/g,' ').slice(0,80)+'…”), dopiero potem logowanie');
  await closeRun(r);
  r=await newRun('boot-login','mock=seeded&reset=1&login=0&lat=1500');
  await waitFor(r,'#cf-go');await tap(r,'.cftab','Zaloguj się');
  await typeIn(r,'#cf-email','test@cramfox.test');await typeIn(r,'#cf-pass','zle-haslo');await tap(r,'#cf-go');await waitFor(r,'#cf-err','Zły',8000);
  await shot(r,'auth-wrong-password','Logowanie: „Zły e-mail albo hasło.”','Złe hasło');
  await tap(r,'.cftab','Załóż konto');await typeIn(r,'#cf-email','test@cramfox.test');await typeIn(r,'#cf-pass','cramfox-test-1');await tap(r,'#cf-age');await tap(r,'#cf-go');
  await waitFor(r,'#cf-err','istnieje',8000);await shot(r,'auth-user-exists','Rejestracja na istniejący e-mail: „To konto już istnieje — zaloguj się.”','Załóż konto z e-mailem konta testowego');
  await mockSet(r,'signup','confirm');await typeIn(r,'#cf-email','inna.osoba@cramfox.test');await tap(r,'#cf-go');await waitFor(r,'#cf-err','potwierdzenia',8000);
  await shot(r,'auth-needs-confirm','Rejestracja wymagająca potwierdzenia e-maila (nieobsługiwana)','signup=confirm');
  await tap(r,'.cftab','Zaloguj się');await typeIn(r,'#cf-email','test@cramfox.test');await typeIn(r,'#cf-pass','cramfox-test-1');await tap(r,'#cf-go',null,{settle:100});
  await waitFor(r,'.cfsplash',null,15000);await shot(r,'splash-loading','Logowanie na nowym urządzeniu: „Wczytuję Twoje przedmioty…”','Poprawne logowanie (lat=1500)');
  await waitFor(r,'.plan',null,40000);await shot(r,'today-after-login','Dziś po zalogowaniu na nowym urządzeniu (postępy z konta)','Koniec wczytywania');
  await closeRun(r);
  r=await newRun('boot-free','mock=seeded&reset=1&trial=-2&used=3');
  await waitFor(r,'.plan');await nav(r,'Profil');await tap(r,'.topbar .backbtn[aria-label="Ustawienia"]');await waitFor(r,'#set-plan');await settle(r,600);
  await shot(r,'settings-free-plan','Karta „Konto” po okresie próbnym: „3 z 3 w tym miesiącu · odnawia się 1. dnia miesiąca”','trial=-2, used=3');
  await addTextMaterial(r);await tap(r,'#cfadd-go');await waitFor(r,'.errv',null,10000);
  await shot(r,'err-limit-free','Plan free: limit 3 z 3 wyczerpany (sprawdzone w kliencie)','trial=-2, used=3 → TWÓRZ LEKCJĘ');
  await closeRun(r);
  r=await newRun('boot-delete','mock=seeded&reset=1&del=active_subscription');
  await waitFor(r,'.plan');await nav(r,'Profil');await tap(r,'.topbar .backbtn[aria-label="Ustawienia"]');await tap(r,'#set-delete');await tap(r,'#cfdel-go');await waitFor(r,'#cfdel-err','subskrypc',10000);
  await shot(r,'delete-account-error','Usuwanie konta zablokowane: aktywna subskrypcja „kupiona poza aplikacją”','del=active_subscription');
  await closeRun(r);
};

/* 6) Treść z próbami XSS i wszystkie typy schematów */
SCEN.xss=async()=>{
  const r=await newRun('xss','mock=seeded&reset=1&extra=viz,xss&lang=1');
  await waitFor(r,'.plan');await tap(r,'.link','Wszystkie');await waitFor(r,'.subjects');
  await shot(r,'subjects-xss','Przedmioty: nazwa z „<img onerror>” wyświetlona jako tekst','Konto z extra=viz,xss → Wszystkie');
  await tap(r,'.subjtile','Test');await waitFor(r,'.pathview');await shot(r,'path-xss','Przedmiot z danymi XSS: ścieżka','Przedmiot „Test<img…>”');
  await tap(r,'.infobtn');await shot(r,'info-xss','Info przedmiotu z danymi XSS (sanitizer)','(i)');
  await tap(r,'.subtab','Ćwiczenia');await shot(r,'cwicz-xss','Ćwiczenia przedmiotu XSS (zadanie hotspot pominięte)','Ćwiczenia');
  await tap(r,'.brow .backbtn');await tap(r,'.link','Wszystkie');await tap(r,'.subjtile','Wizualizacje');await waitFor(r,'.node-open');
  await tap(r,'.node-open');await waitFor(r,'#lesson.open .chat');
  const c=await chatThrough(r,{shots:false,endShot:false,vizShots:true});
  NOTES.push('xss: schematy pokazane w czacie topic-viz: '+c.viz.join(', '));
  const pw=await r.page.evaluate(()=>!!window.__pwned);if(pw)issue(r,'XSS','window.__pwned ustawione po czacie z topic-viz.json');
  await tap(r,'#lesson .lessonhead .x');await tap(r,'.subtab','Ćwiczenia');await waitFor(r,'.exhub');
  await shot(r,'cwicz-lang','Ćwiczenia przedmiotu z lang:true (Wpisywanie, Klocki, Pary słówek) — w produkcji nieosiągalne (serwer nie zapisuje lang)','Przedmiot „Wizualizacje” z lang=1 (atrapa)');
  await tap(r,'.excard h3','Klocki');await shot(r,'cwicz-tiles','Ćwiczenie „Klocki — ułóż słowo”','Ćwiczenia → Klocki');
  await tap(r,'.subtab','Ćwiczenia');await tap(r,'.excard h3','Wpisywanie');await shot(r,'cwicz-typing','Ćwiczenie „Wpisywanie”','Ćwiczenia → Wpisywanie');
  await closeRun(r);
};

/* 7) Wąski ekran 360×780: kluczowe ekrany */
SCEN.narrow=async()=>{
  let r=await newRun('narrow','mock=fresh&reset=1',{w:360,h:780,prefix:'360-'});
  await waitFor(r,'#cf-go');await shot(r,'auth-signup','360×780: logowanie / rejestracja','Pierwsze uruchomienie');await closeRun(r);
  r=await newRun('narrow','mock=seeded&reset=1&extra=viz',{w:360,h:780,prefix:'360-'});
  await waitFor(r,'.plan');await shot(r,'today','360×780: Dziś','Konto z postępami');
  await tap(r,'.subjtile','Polityka');await waitFor(r,'.pathview');await shot(r,'subject-path','360×780: ścieżka przedmiotu','Dziś → Polityka');
  await tap(r,'.subtab','Quiz');await waitFor(r,'.quizview .quiz');await shot(r,'quiz','360×780: pytanie quizu','Przedmiot → Quiz');
  await tap(r,'.subtab','Egzamin');await waitFor(r,'#exstart');await shot(r,'exam-setup','360×780: ustawienia egzaminu','Przedmiot → Egzamin');
  await tap(r,'.brow .backbtn');await tap(r,'.link','Wszystkie');await tap(r,'.subjtile','Wizualizacje');await tap(r,'.node-open');await waitFor(r,'#lesson.open .chat');
  await waitFor(r,'.chatfoot .creply',null,10000);await scrollBy(r,'.lessonbody.chatbody','end');await shot(r,'lesson-chat-viz','360×780: czat lekcji ze schematem','Wizualizacje → poziom 1');
  await tap(r,'#lesson .lessonhead .x');await tap(r,'.brow .backbtn');
  await nav(r,'Profil');await tap(r,'.topbar .backbtn[aria-label="Ustawienia"]');await waitFor(r,'#set-logout');await shot(r,'settings','360×780: ustawienia (karta Konto)','Profil → Ustawienia');
  await addTextMaterial(r);await shot(r,'add-material','360×780: „Dodaj materiał”','[+] → Wklej tekst');
  await closeRun(r);
};

/* 8) Ścieżka natywna (udawany Capacitor + CapacitorHttp) */
SCEN.native=async()=>{
  const r=await newRun('native','mock=seeded&reset=1&native=1');
  await waitFor(r,'.plan');await addTextMaterial(r);await tap(r,'#cfadd-go');await waitFor(r,'#cfr-name',null,20000);
  await shot(r,'native-subject-ready','Tryb „natywny” (CapacitorHttp): generowanie zakończone','native=1 → tekst → TWÓRZ LEKCJĘ');
  await closeRun(r);
};

/* 9) Poniedziałek: podsumowanie zeszłego tygodnia na starcie (zegar przesunięty atrapą) */
SCEN.monday=async()=>{
  const d=new Date();d.setDate(d.getDate()+((8-d.getDay())%7||7));const ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const r=await newRun('monday',`mock=seeded&reset=1&weekly=1&clock=${ds}`);
  await waitFor(r,'.wk',null,15000);await shot(r,'weekly-last','Poniedziałek: „Twój tydzień” — zeszły tydzień vs poprzedni (raz na tydzień)',`clock=${ds} (poniedziałek), weekly=1, konto z historią`);
  await tap(r,'#wk-main');await waitFor(r,'.plan');await shot(r,'today-monday','Dziś po podsumowaniu tygodnia (poniedziałek)','WRACAM DO NAUKI');
  await closeRun(r);
};
/* 10) Zablokowany localStorage (tryb prywatny / zablokowane dane witryn) */
SCEN.nostore=async()=>{
  const r=await newRun('nostore','mock=fresh&reset=1&nostore=1');
  await waitFor(r,'#cf-go');await shot(r,'storebar','localStorage zablokowany: pasek „Postępy nie zapisują się na tym urządzeniu…”','nostore=1 (zapisy apki rzucają QuotaExceededError)');
  await typeIn(r,'#cf-email','prywatny@cramfox.test');await typeIn(r,'#cf-pass','haslo-testowe-1');await tap(r,'#cf-age');await tap(r,'#cf-go',null,{settle:100});
  await sleep(2500);await waitFor(r,'#cf-go',null,10000);
  await shot(r,'storebar-after-signup','Po rejestracji bez localStorage: sesja nie przetrwała przeładowania — znowu ekran logowania','ZAŁÓŻ KONTO przy nostore=1');
  if(await has(r,'#cf-go'))issue(r,'nostore-login-loop','Bez działającego localStorage logowanie/rejestracja kończy się przeładowaniem i powrotem do ekranu logowania (sesja tylko w pamięci, location.reload ją gubi) — bez komunikatu');
  await closeRun(r);
};

/* pomocniczy (tylko --only lesson4): lekcja poziomu 4 na koncie z postępami — do debugowania pętli pytań */
SCEN.lesson4=async()=>{
  const r=await newRun('lesson4','mock=seeded&reset=1');await waitFor(r,'.plan');
  await tap(r,'.subjtile','Polityka');await waitFor(r,'.node-open');await tap(r,'.node-open');await waitFor(r,'#lesson.open .chat');
  await chatThrough(r,{shots:false,endShot:false,vizShots:false});
  console.log('  wynik:',await lessonQuiz(r,{wrong:0,shots:false,noBadShots:true,noOkShots:true}));await shot(r,'lesson4-end','koniec','');await closeRun(r);
};

/* ============================================================ uruchomienie */
const KNOWN_UNREACHED=[ // ekrany/stany, których ten skrypt świadomie nie pokazuje (i dlaczego)
  'Ekran „Silnik zatrzymał się przy starcie” (engine.js start → renderError): wymaga wyjątku w start(); fixProgress/fixMeta czyszczą każdy zapisany stan, więc żadne realne dane go nie wywołują.',
  'Zadanie „Wskaż na schemacie” (hotspot): dane z chmury zawsze dostają type:_skip (cloud.js TASK_OK) — celowo nieosiągalne.',
  'Gry językowe (Wpisywanie, Klocki, Pary słówek): produkcja nigdy nie ustawia lang (BIBLIA §3.7); pokazane tylko z parametrem atrapy lang=1.',
  'Odzyskiwanie: not_started (≥ 90 s bez wiersza generations) i lost (> 330 s) — za długie na zrzuty; failed i udane odzyskanie są pokazane.',
  'Pozostałe kody błędów generowania (too_many_files, too_much_material, bad_materials, bad_pptx, pptx_protected, pptx_empty, download_failed, not_found, unauthorized): ten sam szablon ekranu, osiągalne przez gen=err:KOD.',
  'HEIC na iOS 16 („Zdjęcie w formacie HEIC”): Chrome dekoduje obrazy inaczej niż WebKit iOS 16 — do sprawdzenia w symulatorze.',
  'Rzeczy natywne: aparat i Pliki iOS, safe area, zdarzenia resume/pause, timeouty CapacitorHttp — tylko symulator/urządzenie.',
  'Kamienie milowe 14/30/50/100/365 dni i ratowanie serii zamrożeniem: osiągalne edycją stanu, w zrzutach tylko 7 dni.',
  'Usuwanie konta z błędem files_remaining: osiągalne przez del=files_remaining, nie w domyślnym przebiegu.',
  'Synchronizacja dwóch urządzeń (merge3, konflikt rev): bez zmian na ekranie, nie testowana zrzutami.'];
function writeIndex(t0){
  const L=[];
  L.push('# Cramfox — zrzuty ekranów (atrapa backendu)','',`Wygenerowano: ${new Date().toISOString()} · czas: ${Math.round((Date.now()-t0)/1000)} s · ${SHOTS.length} zrzutów · viewport 375×812 @2x (dotyk, prefers-reduced-motion), część 360×780.`,
    '',`Skrypt: \`test/dev/shoot.mjs\` · atrapa: \`test/dev/mock-backend.js\` · strona: \`test/dev/index.html\`. Nic nie trafia do Supabase ani do API (atrapa podmienia fetch; Chrome blokuje wszystko poza localhost i Google Fonts).`,'');
  let sc='';
  L.push('| Plik | Stan | Jak dojść |','|---|---|---|');
  SHOTS.forEach(s=>{if(s.scenario!==sc){sc=s.scenario;L.push(`| **${sc}** | | |`);}L.push(`| ${s.file} | ${s.state.replace(/\|/g,'\\|')} | ${s.how.replace(/\|/g,'\\|')} |`);});
  L.push('','## Problemy wykryte automatycznie','');
  if(!ISSUES.length)L.push('Brak.');
  const byKind={};ISSUES.forEach(i=>{(byKind[i.kind]=byKind[i.kind]||[]).push(i);});
  Object.entries(byKind).forEach(([k,list])=>{L.push(`### ${k} (${list.length})`,'');list.slice(0,40).forEach(i=>L.push(`- [${i.scenario}] ${i.text.replace(/\n/g,' ')}${i.at?` — _(${i.at})_`:''}`));if(list.length>40)L.push(`- … i ${list.length-40} więcej`);L.push('');});
  L.push('## Kroki, które się nie udały','',FAILS.length?FAILS.map(f=>'- '+f).join('\n'):'Brak.','');
  L.push('## Ekrany nieosiągnięte / uwagi','',UNREACHED.concat(NOTES).length?UNREACHED.concat(NOTES).map(f=>'- '+f).join('\n'):'Brak.','');
  L.push('## Świadomie pominięte (stałe)','',KNOWN_UNREACHED.map(f=>'- '+f).join('\n'),'');
  if(serverHits.length)L.push('## Żądania API, które ominęły atrapę','',serverHits.map(h=>'- '+h).join('\n'),'');
  fs.writeFileSync(path.join(OUT,'INDEX.md'),L.join('\n'));
}
(async()=>{
  const t0=Date.now();
  fs.mkdirSync(OUT,{recursive:true});
  fs.readdirSync(OUT).filter(f=>/\.png$/.test(f)||f==='INDEX.md').forEach(f=>fs.unlinkSync(path.join(OUT,f)));
  await new Promise((res,rej)=>{server.once('error',rej);server.listen(PORT,'127.0.0.1',res);});
  browser=await puppeteer.launch({executablePath:CHROME,headless:arg('headful',false)?false:true,args:['--no-first-run','--no-default-browser-check','--lang=pl-PL','--disable-features=Translate'],defaultViewport:null});
  try{
    await makeAssets();
    const order=ONLY?ONLY.filter(n=>SCEN[n]):['fresh','seeded','comeback','monday','errors','boot','nostore','xss','narrow','native'];
    for(const n of order){
      console.log('▶',n);const s0=Date.now();
      try{await SCEN[n]();}catch(e){FAILS.push(`${n}: ${e.message}`);console.log('  ✗',n,e.message);
        try{const pages=await Promise.all(browser.browserContexts().map(c=>c.pages()));const p=pages.flat().pop();if(p){NN++;const f=String(NN).padStart(2,'0')+'-FAIL-'+n+'.png';await p.screenshot({path:path.join(OUT,f)});SHOTS.push({file:f,scenario:n,state:'Stan w chwili błędu: '+e.message.slice(0,140),how:''});}}catch(x){console.log('  (zrzut błędu się nie udał: '+x.message+')');}
        for(const c of browser.browserContexts())if(c!==browser.defaultBrowserContext())await c.close().catch(()=>{});}
      console.log('  ⏱',n,Math.round((Date.now()-s0)/1000)+' s');
    }
  }finally{
    writeIndex(t0);
    await browser.close().catch(()=>{});server.close();
    try{fs.rmSync(ASSETS,{recursive:true,force:true});}catch(e){}
    console.log(`\n${SHOTS.length} zrzutów → ${OUT}\nProblemy: ${ISSUES.length}, nieudane kroki: ${FAILS.length}\nIndeks: ${path.join(OUT,'INDEX.md')}`);
  }
})();
