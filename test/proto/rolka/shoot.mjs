#!/usr/bin/env node
/* ============================================================ CRAMFOX — ROLKA: ZRZUTY KLATEK
   Serwuje repo statycznie, otwiera test/proto/rolka/ w Chrome (puppeteer-core z test/node_modules) w rozmiarze 390×844 @2x
   i zapisuje klatki każdego scenariusza w wybranych chwilach (deterministycznie: Rolka.seek(t)), plus serie co 0,2 s do oceny ruchu.

   Użycie (z dowolnego katalogu):
     node test/proto/rolka/shoot.mjs [--round 0] [--out KATALOG] [--sb rewolucja,fotosynteza] [--t 1.5,12,30] [--around Bastylia,1793] [--series 74:87:1] [--sheet [nazwa]] [--port 8791]
   Domyślnie: środek każdej sceny, chwile tuż po wejściu akcji, przejścia kamery (seria 5 klatek co 0,2 s), quiz przed i po odpowiedzi.
   --series od:do:krok — dodatkowa seria klatek (np. cała scena co 1 s); --sheet [nazwa] — arkusz wszystkich klatek z tego przebiegu (_sheet-<sb>[-nazwa].png).
   W każdej klatce sprawdza, czy tekst nie wylewa się z ramki (scrollWidth > clientWidth) i czy etykiety/karty/daty nie wychodzą poza ekran.
   Wynik: <out>/<round>/<sb>-<t>.png (+ lista w konsoli). Chrome: /Applications/Google Chrome.app (albo --chrome ŚCIEŻKA). */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const argv=process.argv.slice(2);
const arg=(k,d)=>{const i=argv.indexOf('--'+k);return i>=0&&argv[i+1]&&!argv[i+1].startsWith('--')?argv[i+1]:d;};
const DEF_OUT='/private/tmp/claude-501/-Users-ignacykrasnodebski-nauka-app/d748e67f-76ff-44ab-be43-822bd37cb883/scratchpad/rolka-shots';
const OUT=path.resolve(String(arg('out',process.env.ROLKA_SHOTS||DEF_OUT)),String(arg('round','round2')));
const PORT=+arg('port',8791);
const CHROME=String(arg('chrome',process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
const SBS=String(arg('sb','rewolucja,fotosynteza')).split(',').filter(Boolean);
const ONLY_T=arg('t',null)?String(arg('t')).split(',').map(Number):null;
// --around słowo1,słowo2 — klatki tuż przed i tuż po początku tych słów (sprawdzenie synchronizacji napisów z lektorem)
const AROUND=arg('around',null)?String(arg('around')).split(','):null;
const SERIES=arg('series',null)?String(arg('series')).split(',').map(x=>x.split(':').map(Number)):null;
const SHEET=argv.includes('--sheet'),SHEET_NAME=String(arg('sheet','')).replace(/[^a-z0-9_-]/gi,'');
/* kontrola układu w przeglądarce: tekst wylewający się z ramki i elementy poza ekranem (tylko widoczne) */
const LAYOUT_CHECK=()=>{const out=[];const shown=el=>{for(let p=el;p&&p.id!=='stage';p=p.parentElement){const c=getComputedStyle(p);if(c.display==='none'||c.visibility==='hidden'||+c.opacity<.05)return false;}return true;};
  /* „duchy”: nakładka widoczna, ale półprzezroczysta (0,05–0,9) — dozwolone tylko w przejściu (≤0,25 s), więc zgłaszamy jako uwagę do obejrzenia */
  document.querySelectorAll('#hud .lbl, #hud .card, #chap .chip, #fox').forEach(el=>{if(!shown(el))return;const op=+getComputedStyle(el).opacity;
    if(op>.05&&op<.9)out.push('półprzezroczyste ('+op.toFixed(2)+') '+String(el.className||el.id).split(' ').slice(0,2).join('.')+' „'+(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,30)+'”');});
  document.querySelectorAll('#stage .card .cl, #stage .card .ct, #stage .card, #hud .lbl, #chap .chip, #cap .box, #cut .row, #cut .tile .blk, #cut .zlab, #quiz .a, #quiz .qq').forEach(el=>{if(!shown(el))return;
    const name=String(el.className||el.tagName).split(' ')[0]+' „'+(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,38)+'”';
    if(el.scrollWidth>el.clientWidth+1)out.push('wylewa się ('+el.scrollWidth+' > '+el.clientWidth+') '+name);
    if(el.matches('#hud .lbl, #stage .card, #chap .chip')){const r=el.getBoundingClientRect();if(r.left<-1||r.right>391)out.push('poza ekranem ('+Math.round(r.left)+'…'+Math.round(r.right)+') '+name);}});
  return out;};

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
  let p=path.normalize(path.join(ROOT,decodeURIComponent(u.pathname)));if(!p.startsWith(ROOT)){res.writeHead(403);return res.end();}
  if(p.endsWith(path.sep))p=path.join(p,'index.html');
  fs.stat(p,(e,st)=>{if(e||!st.isFile()){res.writeHead(404);return res.end('nie ma');}res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(p).pipe(res);});});

const fmt=t=>(Math.round(t*100)/100).toFixed(2).replace(/\.?0+$/,'')||'0';
async function frame(page,t){await page.evaluate(t=>window.Rolka.seek(t),t);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}

async function main(){
  fs.mkdirSync(OUT,{recursive:true});
  await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
  const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--font-render-hinting=none','--disable-features=Translate']});
  const problems=[],written=[],series={},sheets={};
  try{
    for(const sb of SBS){
      const page=await browser.newPage();
      await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
      await page.setRequestInterception(true);
      page.on('request',r=>{const u=r.url();if(/^(data|blob):/.test(u)||u.startsWith(`http://127.0.0.1:${PORT}/`))return r.continue();problems.push(sb+': zablokowane żądanie '+u.slice(0,120));r.abort();});
      page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')problems.push(sb+': console.'+m.type()+' '+m.text().slice(0,300));});
      page.on('pageerror',e=>problems.push(sb+': pageerror '+String(e&&e.stack||e).slice(0,500)));
      await page.goto(`http://127.0.0.1:${PORT}/test/proto/rolka/?sb=${sb}&t=0&paused=1&mute=1`,{waitUntil:'load'});
      await page.waitForFunction(()=>document.documentElement.dataset.ready==='1'||document.getElementById('err').classList.contains('on'),{timeout:15000});
      const st=await page.evaluate(()=>window.Rolka?window.Rolka.state():null);if(!st){problems.push(sb+': nie wystartowało');await page.close();continue;}
      const T=await page.evaluate(()=>window.Rolka.duration);
      console.log(`\n${sb}: ${st.scenes.length} scen, ${T.toFixed(1)} s`);st.scenes.forEach((s,i)=>console.log(`  scena ${i}: ${s.start}–${s.end} s (${s.words} słów)`));
      const al=await page.evaluate(()=>window.Rolka.state().align);if(al)console.log(`  lektor z nagrania: dopasowano ${al.matched}/${al.tokens} słów napisów do ${al.transcript} słów transkrypcji, poprawione liczby: ${al.fixed}`);
      let times=[];
      if(AROUND){const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9]+/g,'');
        const ws=await page.evaluate(()=>window.Rolka.timeline.scenes.flatMap(S=>S.words.map(w=>({d:w.d,t0:w.t0,t1:w.t1}))));
        AROUND.forEach(q=>{const w=ws.find(x=>norm(x.d).startsWith(norm(q)));if(!w){problems.push(sb+': nie ma słowa '+q);return;}
          console.log(`  „${w.d}”: ${w.t0.toFixed(3)}–${w.t1.toFixed(3)} s`);times.push({t:w.t0-.06,tag:'przed-'+norm(q)},{t:w.t0+.06,tag:'po-'+norm(q)});});}
      else if(ONLY_T)times=ONLY_T.map(t=>({t}));
      else if(SERIES){}
      else{
        st.scenes.forEach((s,i)=>{times.push({t:s.start+(s.end-s.start)*.62});if(i===0)times.push({t:.6},{t:s.end-.3});});
        // seria ruchu: przejście kamery do sceny 2 i do ostatniej sceny
        [2,Math.min(st.scenes.length-1,6)].forEach(i=>{const s0=st.scenes[i].start;for(let k=0;k<5;k++)times.push({t:s0+.3+k*.2,tag:'ruch'});});
        times.push({t:T+.9,tag:'quiz'});times.push({t:T+2.4,tag:'odp',answer:true});
      }
      if(SERIES)SERIES.forEach(([a,b,k])=>{for(let t=a;t<=b+1e-6;t+=(k||1))times.push({t:+t.toFixed(2)});});
      for(const it of times){
        if(it.answer){await frame(page,T+.8);await page.evaluate(()=>window.Rolka.answer(0));}
        await frame(page,it.t);
        const name=`${sb}-${fmt(it.t)}${it.tag?'-'+it.tag:''}.png`;const file=path.join(OUT,name);
        await page.screenshot({path:file});written.push(file);if(it.tag==='ruch')(series[sb]=series[sb]||[]).push(file);(sheets[sb]=sheets[sb]||[]).push(file);
        const lay=await page.evaluate(LAYOUT_CHECK);lay.forEach(m=>problems.push(`${sb} @${fmt(it.t)}: ${m}`));
      }
      // poprawna odpowiedź też
      if(!ONLY_T&&!AROUND&&!SERIES){await page.goto(`http://127.0.0.1:${PORT}/test/proto/rolka/?sb=${sb}&t=0&paused=1&mute=1`,{waitUntil:'load'});
        await page.waitForFunction(()=>document.documentElement.dataset.ready==='1',{timeout:15000});
        const c=await page.evaluate(async()=>{const r=await fetch(location.pathname+'storyboards/'+new URLSearchParams(location.search).get('sb')+'.json').then(r=>r.json());return r.quiz?r.quiz.c:0;});
        await frame(page,T+.8);await page.evaluate(c=>window.Rolka.answer(c),c);await frame(page,T+2.0);
        const file=path.join(OUT,`${sb}-${fmt(T+2)}-dobrze.png`);await page.screenshot({path:file});written.push(file);
        // okładka (przed pierwszym odtworzeniem)
        await page.goto(`http://127.0.0.1:${PORT}/test/proto/rolka/?sb=${sb}&mute=1`,{waitUntil:'load'});await page.waitForFunction(()=>document.documentElement.dataset.ready==='1',{timeout:15000});
        await page.evaluate(()=>new Promise(r=>setTimeout(r,150)));const fc=path.join(OUT,`${sb}-okladka.png`);await page.screenshot({path:fc});written.push(fc);}
      await page.close();
    }
    // paski ruchu: kolejne klatki co 0,2 s obok siebie (po 5 w rzędzie) — szybka ocena płynności kamery; --sheet: wszystkie klatki po 6 w rzędzie
    const strip=async(files,file,cols)=>{const pg=await browser.newPage();await pg.setViewport({width:cols*200+(cols+1)*10,height:Math.ceil(files.length/cols)*(433+28)+10,deviceScaleFactor:1});
      const imgs=files.map(f=>`<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${path.basename(f,'.png')}</figcaption></figure>`).join('');
      await pg.setContent(`<style>body{margin:5px;display:flex;flex-wrap:wrap;gap:10px;font:12px sans-serif;background:#fff}figure{margin:0;width:200px}img{width:200px;height:433px;display:block}</style>${imgs}`,{waitUntil:'load'});
      await pg.screenshot({path:file,fullPage:true});written.push(file);await pg.close();};
    if(SHEET)for(const [sb,files] of Object.entries(sheets))await strip(files,path.join(OUT,`_sheet-${sb}${SHEET_NAME?'-'+SHEET_NAME:''}.png`),6);
    for(const [sb,files] of Object.entries(series)){const pg=await browser.newPage();await pg.setViewport({width:5*200+60,height:Math.ceil(files.length/5)*(433+28)+10,deviceScaleFactor:1});
      const imgs=files.map(f=>`<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${path.basename(f,'.png')}</figcaption></figure>`).join('');
      await pg.setContent(`<style>body{margin:5px;display:flex;flex-wrap:wrap;gap:10px;font:12px sans-serif;background:#fff}figure{margin:0;width:200px}img{width:200px;height:433px;display:block}</style>${imgs}`,{waitUntil:'load'});
      const file=path.join(OUT,`_ruch-${sb}.png`);await pg.screenshot({path:file,fullPage:true});written.push(file);await pg.close();}
  }finally{await browser.close();server.close();}
  console.log('\nZapisano '+written.length+' klatek w '+OUT);
  if(problems.length){console.log('\nUWAGI ('+problems.length+'):');[...new Set(problems)].forEach(p=>console.log('  - '+p));}else console.log('Bez błędów w konsoli.');
}
main().catch(e=>{console.error(e);server.close();process.exit(1);});
