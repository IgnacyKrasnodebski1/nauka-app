/* ============================================================ CRAMFOX — wspólne narzędzia kontroli chmury (cloud-*.mjs)
   Lokalny serwer plików (katalog repo, losowy port), Chrome (puppeteer-core, jak shoot.mjs) w rozmiarze iPhone'a, atrapa backendu z test/dev/.
   Każde żądanie poza localhost jest blokowane i zgłaszane. Opcjonalnie podmiana cloud-config.js (np. linki prawne i e-mail pomocy do testów).
   Użycie: import {start, check, done} from './cloud-lib.mjs' — patrz cloud-*.mjs. Zrzuty: --out KATALOG (domyślnie test/dev/shots/checks). */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
export const ROOT=path.resolve(HERE,'../../..');
const argv=process.argv.slice(2);
const arg=(k,d)=>{const i=argv.indexOf('--'+k);return i>=0?(argv[i+1]&&!argv[i+1].startsWith('--')?argv[i+1]:true):d;};
export const OUT=path.resolve(String(arg('out',process.env.SHOTS_DIR||path.join(HERE,'../shots/checks'))));
const CHROME=String(arg('chrome',process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.woff':'font/woff','.pdf':'application/pdf','.mp3':'audio/mpeg'};

let server=null,PORT=0,browser=null,watchdog=null;const results=[];let current='';
export const TEST_CONFIG={privacyUrl:'https://example.test/polityka',termsUrl:'https://example.test/regulamin',supportEmail:'pomoc@example.test'};

export async function start(){
  fs.mkdirSync(OUT,{recursive:true});
  const min=+arg('timeout',process.env.CHECK_TIMEOUT_MIN||20); // strażnik: zawieszony krok (np. nieistniejący przycisk w pętli) nie blokuje CI w nieskończoność
  watchdog=setTimeout(()=>{console.error(`\n✗ kontrola przekroczyła ${min} min — przerwana`);try{browser&&browser.process()&&browser.process().kill('SIGKILL');}catch(e){}process.exit(2);},min*60000);watchdog.unref();
  server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://localhost');
    if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
    let p=path.normalize(path.join(ROOT,decodeURIComponent(u.pathname)));if(!p.startsWith(ROOT)){res.writeHead(403);return res.end();}
    if(p.endsWith(path.sep))p=path.join(p,'index.html');
    fs.stat(p,(e,st)=>{if(e||!st.isFile()){res.writeHead(404);return res.end('nie ma');}res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(p).pipe(res);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));PORT=server.address().port;
  browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-first-run','--no-default-browser-check','--disable-extensions','--autoplay-policy=no-user-gesture-required','--disable-audio-output'],protocolTimeout:90000}); // audio: podcast i rolki grają bez głośników; zawieszona strona = błąd po 90 s, nie wieczne czekanie
  return {port:PORT};
}
export const base=()=>`http://localhost:${PORT}/`;

/* strona: atrapa backendu z parametrami (query), opcjonalnie inny cloud-config (o.config: pola nadpisujące) */
export async function page(query,o={}){
  const ctx=await browser.createBrowserContext();const pg=await ctx.newPage();
  await pg.setViewport({width:o.w||375,height:o.h||812,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await pg.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await pg.setRequestInterception(true);
  const run={pg,ctx,errors:[],blocked:[],console:[]};
  pg.on('request',r=>{const u=r.url();
    if(o.config&&/\/cloud-config\.js(\?|$)/.test(u)){const src=fs.readFileSync(path.join(ROOT,'cloud-config.js'),'utf8')+`\nObject.assign(window.CRAMFOX_CONFIG,${JSON.stringify(o.config)});`;return r.respond({status:200,contentType:'text/javascript; charset=utf-8',body:src});}
    if(/^(data|blob|file):/.test(u)||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u))return r.continue();
    run.blocked.push(u.slice(0,140));r.abort();});
  pg.on('console',m=>{const t=m.type();const tx=m.text();run.console.push(t+': '+tx);if(t==='error'&&!/favicon|Failed to load resource/.test(tx))run.errors.push(tx.slice(0,300));});
  pg.on('pageerror',e=>run.errors.push('pageerror: '+String(e&&e.message||e).slice(0,300)));
  pg.on('dialog',async d=>{run.errors.push('native dialog: '+d.message());await d.dismiss().catch(()=>{});});
  if(o.csp)await pg.evaluateOnNewDocument(()=>{window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI));});
  if(o.url){await pg.goto(o.url,{waitUntil:'load'});await sleep(o.settle||900);}
  else if(query!=null){await pg.goto(base()+(o.path||'test/dev/')+'?'+query,{waitUntil:'load'});await sleep(o.settle||900);}
  return run;
}
export async function close(run){try{await run.ctx.close();}catch(e){}}

/* akcje */
export async function find(run,sel,text){
  return run.pg.evaluateHandle((sel,text)=>{const N=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
    const vis=e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none';};
    return [...document.querySelectorAll(sel)].find(e=>vis(e)&&(!text||N(e.textContent).includes(N(text))))||null;},sel,text||'').then(h=>h.asElement());
}
export async function waitFor(run,sel,text,timeout=8000){const t0=Date.now();while(Date.now()-t0<timeout){let el=null;try{el=await find(run,sel,text);}catch(e){}if(el)return el;await sleep(120);}throw new Error(`nie pojawiło się: ${sel}${text?' „'+text+'”':''}`);}
export async function has(run,sel,text){try{return !!(await find(run,sel,text));}catch(e){return false;}}
export async function tap(run,sel,text,o={}){const el=await waitFor(run,sel,text,o.timeout||8000);await el.evaluate(e=>e.scrollIntoView({block:'center'}));if(o.real)await el.click();else await el.evaluate(e=>e.click());await sleep(o.settle??300);return el;}
export async function fill(run,sel,v){const el=await waitFor(run,sel);await el.evaluate((e,v)=>{e.focus();e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},v);await sleep(120);}
export async function chooseFiles(run,sel,files,text){const el=await waitFor(run,sel,text);const [ch]=await Promise.all([run.pg.waitForFileChooser({timeout:6000}),el.click()]);await ch.accept(files);await sleep(600);}
export const text=run=>run.pg.evaluate(()=>[...document.querySelectorAll('#app, #sheet, .netbar')].map(e=>e.innerText||'').join('\n').replace(/\u00a0/g,' ')); // twarde spacje („2 z 150”) jak zwykłe
export const view=run=>run.pg.evaluate(()=>({view:window.NaukaEngine&&NaukaEngine.view,sheet:!!document.getElementById('sheet'),lesson:!!document.querySelector('#lesson.open,.lesson.open')}));
export const mockLog=run=>run.pg.evaluate(()=>window.MOCK.log.map(e=>e.method+' '+e.path.split('?')[0]+' '+e.status));
export const mockSet=(run,k,v)=>run.pg.evaluate((k,v)=>window.MOCK.set(k,v),k,v);
export async function shot(run,name){const f=path.join(OUT,name+'.png');await run.pg.screenshot({path:f});return f;}

/* zapisy wyników */
const T0=Date.now();
export function section(name){current=name;console.log('\n== '+name+'  ['+Math.round((Date.now()-T0)/1000)+' s]');}
export function check(cond,label,detail){results.push({ok:!!cond,label:current+': '+label,detail});console.log((cond?'  ok   ':'  FAIL ')+label+(cond||detail==null?'':' — '+String(detail).slice(0,500))+(process.env.CHECK_TIMES?'  ['+Math.round((Date.now()-T0)/1000)+' s]':''));return !!cond;}
export async function done(){
  try{await browser.close();}catch(e){}try{server.close();}catch(e){}
  const bad=results.filter(r=>!r.ok);console.log(`\n${results.length-bad.length}/${results.length} ok`+(bad.length?' — błędy:\n'+bad.map(b=>'  - '+b.label).join('\n'):''));
  process.exitCode=bad.length?1:0;
  clearTimeout(watchdog);setTimeout(()=>process.exit(process.exitCode),300).unref(); // wyniki wypisane — nie czekamy na zalegające połączenia (np. keep-alive serwera plików)
}
/* plik testowy (zdjęcie strony) do wyboru w aparacie / plikach */
export async function testImage(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cramfox-checks-'));const f=path.join(dir,'strona.png');
  const ctx=await browser.createBrowserContext();const p=await ctx.newPage();await p.setViewport({width:600,height:800,deviceScaleFactor:1});
  await p.setContent('<html><body style="margin:0;background:#f4f1e8;font:22px Georgia,serif;padding:40px"><h1>Rozdział 3. Polityka fiskalna</h1><p>Deficyt do 3% PKB, dług do 60% PKB.</p></body></html>');
  await p.screenshot({path:f});await ctx.close();return f;
}

/* ---------- centrum przedmiotu i media (hub.mjs, media.mjs, fox.mjs, keypoints.mjs) ---------- */
export const MS={S:'5b000011-0000-4000-8000-000000000011',T1:'7c000011-0000-4000-8000-000000000011',T2:'7c000012-0000-4000-8000-000000000012',T3:'7c000013-0000-4000-8000-000000000013',
  R1:'ae000001-0000-4000-8000-000000000001',P1:'ae000002-0000-4000-8000-000000000002',R2:'ae000003-0000-4000-8000-000000000003',
  sMakro:'5b000001-0000-4000-8000-000000000001',tMakro:'7c000001-0000-4000-8000-000000000001',sKp:'5b000005-0000-4000-8000-000000000005',
  tKpEdge:'7c000005-0000-4000-8000-000000000005',tKpFew:'7c000006-0000-4000-8000-000000000006',UID:'0c0ffee0-0000-4000-8000-000000000001'}; // = IDS w mock-backend.js
export const LID=(topicId,l)=>'t'+String(topicId).replace(/-/g,'').slice(0,8)+'_'+l; // jak mapLevel() w cloud.js
export const PID=(topicId,raw)=>'t'+String(topicId).replace(/-/g,'').slice(0,8)+'_'+raw; // id punktu w silniku (plan-media §1.2)
/* żądanie przez atrapę z sesją apki (kontrakt atrapy — bez UI) */
export function apiCall(run,method,p,body){
  return run.pg.evaluate(async(m,p,b)=>{const C=window.CRAMFOX_CONFIG,s=JSON.parse(localStorage.getItem('cf_session')||'{}');
    const base=p.startsWith('/api/')?C.apiUrl.replace(/\/$/,''):C.supabaseUrl;
    try{const res=await fetch(base+p,{method:m,headers:{apikey:C.anonKey,Authorization:'Bearer '+(s.access_token||''),'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});
      const ct=res.headers.get('Content-Type')||'';let data=null;if(/json/.test(ct))data=await res.json();else{const bl=await res.blob();data={size:bl.size,type:bl.type||ct};}return {status:res.status,data};}
    catch(e){return {status:0,error:String(e&&e.message||e)};}},method,p,body||null);
}
/* wywołanie funkcji silnika / mediów / chmury: eng(run,'masteryOf',sid) → wynik (JSON) albo {__missing:nazwa} */
export function eng(run,fn,...args){return run.pg.evaluate((fn,args)=>{const [o,k]=fn.includes('.')?fn.split('.'):['NaukaEngine',fn];const obj=window[o];
  if(!obj||typeof obj[k]!=='function')return {__missing:o+'.'+k};try{const v=obj[k](...args);return v===undefined?null:JSON.parse(JSON.stringify(v));}catch(e){return {__error:String(e&&e.message||e)};}},fn,args);}
export async function engAsync(run,fn,...args){return run.pg.evaluate(async(fn,args)=>{const [o,k]=fn.includes('.')?fn.split('.'):['NaukaEngine',fn];const obj=window[o];
  if(!obj||typeof obj[k]!=='function')return {__missing:o+'.'+k};try{const v=await obj[k](...args);return v===undefined?null:JSON.parse(JSON.stringify(v));}catch(e){return {__error:String(e&&e.message||e),code:e&&e.code};}},fn,args);}
export const missing=v=>v&&typeof v==='object'&&(v.__missing||v.__error)?(v.__missing?'brak '+v.__missing:'wyjątek: '+v.__error):'';
/* czekanie, aż funkcja w stronie zwróci prawdę */
export async function until(run,fn,arg,timeout=8000,step=150){const t0=Date.now();let v;while(Date.now()-t0<timeout){try{v=await run.pg.evaluate(fn,arg);}catch(e){v=null;}if(v)return v;await sleep(step);}return v;}
/* start apki na atrapie: czeka na silnik z przedmiotami i widok */
export async function boot(query,o={}){const r=await page(query,{settle:300,...o});
  await until(r,()=>!!(window.NaukaEngine&&NaukaEngine.view&&document.querySelector('#app')&&document.querySelector('#app').children.length&&(NaukaEngine.subjects().length||document.querySelector('#cf-go'))),null,15000);
  await sleep(o.settle2??500);return r;}
/* cały widoczny tekst (także arkusze, toasty i warstwy mediów poza #app) — twarde spacje jak zwykłe */
export const bodyText=run=>run.pg.evaluate(()=>(document.body.innerText||'').replace(/\u00a0|\u202f/g,' '));
export const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
export async function seesText(run,t,timeout=6000){const want=norm(t).toLowerCase();return !!(await until(run,w=>(document.body.innerText||'').replace(/\u00a0|\u202f/g,' ').replace(/\s+/g,' ').toLowerCase().includes(w),want,timeout));}
/* element z tekstem (przycisk, wiersz, chip) — najmniejszy widoczny element, którego tekst albo aria-label zawiera t */
export async function tapText(run,t,o={}){
  const want=norm(t).toLowerCase();const t0=Date.now();let h=null;
  while(Date.now()-t0<(o.timeout||8000)){
    h=await run.pg.evaluateHandle((w,sel)=>{const N=s=>String(s||'').replace(/\u00a0|\u202f/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
      const vis=e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'&&cs.pointerEvents!=='none';};
      const all=[...document.querySelectorAll(sel||'button,[role=button],a,[tabindex],.chip,.pill,label,li,[onclick]')].filter(e=>vis(e)&&(N(e.innerText).includes(w)||N(e.getAttribute('aria-label')).includes(w)));
      const inner=all.filter(e=>!all.some(x=>x!==e&&e.contains(x))); // najgłębszy pasujący element (przycisk w <li>, nie <li>)
      inner.sort((a,b)=>N(a.innerText).length-N(b.innerText).length);return inner[0]||null;},want,o.sel||null).then(x=>x.asElement());
    if(h)break;await sleep(150);}
  if(!h)throw new Error('nie ma elementu „'+t+'”');
  const dis=await h.evaluate(e=>!!(e.disabled||e.getAttribute('aria-disabled')==='true'));
  if(dis&&!o.allowDisabled)throw new Error('element „'+t+'” jest wyłączony');
  await h.evaluate(e=>e.scrollIntoView({block:'center'}));if(o.real)await h.click();else await h.evaluate(e=>e.click());await sleep(o.settle??350);return h;
}
export async function isDisabled(run,t){return run.pg.evaluate(w=>{const N=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
  const e=[...document.querySelectorAll('button,[role=button]')].find(b=>N(b.innerText).includes(w)||N(b.getAttribute('aria-label')).includes(w));return e?!!(e.disabled||e.getAttribute('aria-disabled')==='true'):null;},norm(t).toLowerCase());}
/* reguły dla każdego ekranu (plan-media §6.5): bez emoji, bez słów o płatnościach / planie Pro, bez wykonanego XSS, bez poziomego przewijania, bez UI mikrofonu */
export const BANNED=/(?<![\p{L}\p{N}])(pro|premium|płatn(?:oś\p{L}*|y|a|e|ie|ych|ym|ymi|ego|ej)|cen[aeyą]|kup(?:i\p{L}*|uj\p{L}*|ow\p{L}*|no)?|subskrypc\p{L}*|zł|pln)(?![\p{L}\p{N}])/iu; // „płatniczy” (bilans płatniczy) to treść, nie płatność
export async function uiCheck(run,label){
  const st=await run.pg.evaluate(()=>{const t=(document.body.innerText||'');
    const emoji=[...new Set(t.match(/[\u{1F000}-\u{1FAFF}]|\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/gu)||[])];
    const mic=[...document.querySelectorAll('button,[role=button]')].filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&/mikrofon|powiedz odpowied|nagraj głos|mów do lisa/i.test((b.innerText||'')+' '+(b.getAttribute('aria-label')||''));}).map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim()).slice(0,3);
    return {emoji,text:t,pwned:!!window.__pwned,wide:document.documentElement.scrollWidth>innerWidth+1,mic};});
  const ban=st.text.match(new RegExp(BANNED.source,'giu'))||[];
  check(!st.emoji.length,label+': bez emoji w UI',st.emoji.join(' '));
  check(!ban.length,label+': ani słowa o płatnościach, cenie, planie Pro, kupowaniu (App Store 3.1.1)',[...new Set(ban)].join(', '));
  check(!st.pwned,label+': XSS nie wykonany (window.__pwned)');
  check(!st.wide,label+': bez poziomego przewijania');
  check(!st.mic.length,label+': bez UI mikrofonu (tryb głosowy później)',st.mic.join(' | '));
  return st;
}
export function checkRun(run,label){ // na koniec strony: konsola, żądania poza localhost
  check(!run.errors.length,label+': bez błędów w konsoli',run.errors.slice(0,4).join(' | '));
  check(!run.blocked.length,label+': żadnych żądań poza localhost',run.blocked.slice(0,3).join(' '));
}
export const posts=(run,kind)=>run.pg.evaluate(k=>window.MOCK.posts(k),kind);
