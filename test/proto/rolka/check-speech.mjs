#!/usr/bin/env node
/* ============================================================ CRAMFOX — ROLKA: TEST SYNCHRONIZACJI Z LEKTOREM
   Podmienia window.speechSynthesis na atrapę, która „czyta” w innym tempie niż szacunek silnika (szybciej i wolniej),
   i sprawdza, czy podświetlone słowo w napisach nadąża za lektorem (zegar czeka na lektora / dogania go), a sceny idą dalej.
   Użycie: node test/proto/rolka/check-speech.mjs [--sb fotosynteza] [--secs 14] */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const argv=process.argv.slice(2);
const arg=(k,d)=>{const i=argv.indexOf('--'+k);return i>=0&&argv[i+1]?argv[i+1]:d;};
const SB=arg('sb','fotosynteza'),SECS=+arg('secs',14),PORT=+arg('port',8792);
const CHROME=arg('chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');let p=path.normalize(path.join(ROOT,decodeURIComponent(u.pathname)));
  if(!p.startsWith(ROOT)){res.writeHead(403);return res.end();}if(p.endsWith(path.sep))p=path.join(p,'index.html');
  fs.stat(p,(e,st)=>{if(e||!st.isFile()){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(res);});});

/* atrapa syntezy: słowo trwa pace×(szacunek silnika); granice słów jak w Chrome (name:'word', charIndex) */
const FAKE=pace=>`(()=>{const T=[];let cur=null;const now=()=>performance.now();
  window.__said={scene:-1,text:'',word:-1,at:0};
  class U{constructor(t){this.text=t;}}window.SpeechSynthesisUtterance=U;
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{name:'Atrapa',lang:'pl-PL',localService:true}],addEventListener(){},pause(){},resume(){},
    cancel(){T.splice(0).forEach(clearTimeout);cur=null;},
    speak(u){this.cancel();cur=u;const words=u.text.split(' ');let ci=0,t=0;window.__said={text:u.text,word:-1,at:now()};
      words.forEach((w,i)=>{const at=t,idx=ci;T.push(setTimeout(()=>{if(cur!==u)return;window.__said.word=i;window.__said.wtext=w;u.onboundary&&u.onboundary({name:'word',charIndex:idx});},at));
        const L=(w.match(/\\p{L}/gu)||[]).length+(w.match(/\\d/g)||[]).length*3.2;t+=${pace}*1000*(Math.max(.2,.09+.053*L)+(/[.!?]$/.test(w)?.36:/[,;]$/.test(w)?.17:/[:]$/.test(w)?.24:0));ci+=w.length+1;});
      T.push(setTimeout(()=>{if(cur!==u)return;cur=null;u.onend&&u.onend();},t+120));}}});})();`;

async function run(browser,pace){
  const page=await browser.newPage();await page.bringToFront(); // trzecia karta w tym samym Chrome bywa dławiona (timery/rAF) — test ma mierzyć silnik, nie kartę w tle
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(FAKE(pace));const errs=[];page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/404|favicon/.test(m.text()))errs.push(m.text());});
  await page.goto(`http://127.0.0.1:${PORT}/test/proto/rolka/?sb=${SB}`,{waitUntil:'load'});await page.waitForFunction(()=>document.documentElement.dataset.ready==='1');
  await page.click('#bPlay');
  const samples=[];const t0=Date.now();
  while(Date.now()-t0<SECS*1000){await new Promise(r=>setTimeout(r,250));
    samples.push(await page.evaluate(()=>{const st=window.Rolka.state(),now=document.querySelector('#cap .w.now');return{t:st.t,mode:st.mode,cap:now?now.textContent:null,said:window.__said.wtext||null};}));}
  await page.close();
  // dopasowanie: słowo w napisach == słowo lektora (lektor czyta formę mówioną — porównujemy tylko gdy obie są zwykłymi słowami)
  const norm=s=>String(s||'').toLowerCase().replace(/[^\p{L}\d]/gu,'');
  const cmp=samples.filter(s=>s.cap&&s.said);const ok=cmp.filter(s=>norm(s.cap)===norm(s.said)).length;
  const mono=samples.every((s,i)=>!i||s.t>=samples[i-1].t-1e-6);
  return{pace,mode:[...new Set(samples.map(s=>s.mode))].join(','),tEnd:samples.at(-1).t.toFixed(1),match:`${ok}/${cmp.length}`,ratio:cmp.length?ok/cmp.length:0,mono,errs};}

(async()=>{await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
  let fail=false;let browser=null;
  // osobny Chrome na każde tempo: trzecia karta w jednym Chrome bywa dławiona (timery w tle), co udaje „zacięty” zegar rolki
  try{for(const pace of [.7,1,1.4]){browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const r=await run(browser,pace);await browser.close();browser=null;console.log(`tempo lektora ×${pace}: tryb=${r.mode}, t po ${SECS}s = ${r.tEnd}, zgodność słowa w napisach z lektorem ${r.match}, zegar monotoniczny: ${r.mono?'tak':'NIE'}${r.errs.length?', błędy: '+r.errs.join(' | '):''}`);
      if(r.ratio<.8||!r.mono||r.errs.length||r.mode!=='speech')fail=true;}}
  finally{if(browser)await browser.close();server.close();}
  console.log(fail?'WYNIK: problem z synchronizacją':'WYNIK: napisy trzymają się lektora');process.exit(fail?1:0);})();
