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
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.ttf':'font/ttf','.woff':'font/woff','.pdf':'application/pdf'};

let server=null,PORT=0,browser=null;const results=[];let current='';
export const TEST_CONFIG={privacyUrl:'https://example.test/polityka',termsUrl:'https://example.test/regulamin',supportEmail:'pomoc@example.test'};

export async function start(){
  fs.mkdirSync(OUT,{recursive:true});
  server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://localhost');
    if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
    let p=path.normalize(path.join(ROOT,decodeURIComponent(u.pathname)));if(!p.startsWith(ROOT)){res.writeHead(403);return res.end();}
    if(p.endsWith(path.sep))p=path.join(p,'index.html');
    fs.stat(p,(e,st)=>{if(e||!st.isFile()){res.writeHead(404);return res.end('nie ma');}res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(p).pipe(res);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));PORT=server.address().port;
  browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-first-run','--no-default-browser-check','--disable-extensions']});
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
export function section(name){current=name;console.log('\n== '+name);}
export function check(cond,label,detail){results.push({ok:!!cond,label:current+': '+label,detail});console.log((cond?'  ok   ':'  FAIL ')+label+(cond||detail==null?'':' — '+String(detail).slice(0,500)));return !!cond;}
export async function done(){
  try{await browser.close();}catch(e){}try{server.close();}catch(e){}
  const bad=results.filter(r=>!r.ok);console.log(`\n${results.length-bad.length}/${results.length} ok`+(bad.length?' — błędy:\n'+bad.map(b=>'  - '+b.label).join('\n'):''));
  process.exitCode=bad.length?1:0;
}
/* plik testowy (zdjęcie strony) do wyboru w aparacie / plikach */
export async function testImage(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cramfox-checks-'));const f=path.join(dir,'strona.png');
  const ctx=await browser.createBrowserContext();const p=await ctx.newPage();await p.setViewport({width:600,height:800,deviceScaleFactor:1});
  await p.setContent('<html><body style="margin:0;background:#f4f1e8;font:22px Georgia,serif;padding:40px"><h1>Rozdział 3. Polityka fiskalna</h1><p>Deficyt do 3% PKB, dług do 60% PKB.</p></body></html>');
  await p.screenshot({path:f});await ctx.close();return f;
}
