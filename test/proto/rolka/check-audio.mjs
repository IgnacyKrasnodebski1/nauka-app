#!/usr/bin/env node
/* ============================================================ CRAMFOX — ROLKA: TEST NAGRANIA LEKTORA
   1) Wypisuje wyrównanie napisów (say) do transkrypcji nagrania: każde słowo z czasem, scena po scenie (--table).
   2) Odtwarza nagranie w Chrome (bez głośnika: --mute-audio) i co 150 ms porównuje:
      - zegar rolki (Rolka.state().t) z audio.currentTime,
      - podświetlone słowo napisów z tym, które według transkrypcji jest mówione w audio.currentTime.
   Użycie: node test/proto/rolka/check-audio.mjs [--sb rewolucja] [--secs 20] [--from 0,60] [--rate 1.2] [--table] */
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../..');
const argv=process.argv.slice(2);
const arg=(k,d)=>{const i=argv.indexOf('--'+k);return i>=0&&argv[i+1]&&!argv[i+1].startsWith('--')?argv[i+1]:d;};
const SB=String(arg('sb','rewolucja')).replace(/[^a-z0-9_-]/gi,'');
const SECS=+arg('secs',14);
const FROM=String(arg('from','0,58')).split(',').map(Number);
const RATE=arg('rate',null);
const TABLE=argv.includes('--table');
const PORT=+arg('port',8793);
const CHROME=String(arg('chrome',process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.ttf':'font/ttf','.mp3':'audio/mpeg'};
/* serwer z obsługą Range — bez tego Chrome nie przewija (currentTime) w nagraniu */
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}let p=path.normalize(path.join(ROOT,decodeURIComponent(u.pathname)));
  if(!p.startsWith(ROOT)){res.writeHead(403);return res.end();}if(p.endsWith(path.sep))p=path.join(p,'index.html');
  fs.stat(p,(e,st)=>{if(e||!st.isFile()){res.writeHead(404);return res.end();}const type=MIME[path.extname(p)]||'application/octet-stream';const m=/bytes=(\d*)-(\d*)/.exec(req.headers.range||'');
    if(m){const a=m[1]?+m[1]:0,b=m[2]?+m[2]:st.size-1;res.writeHead(206,{'Content-Type':type,'Content-Range':`bytes ${a}-${b}/${st.size}`,'Accept-Ranges':'bytes','Content-Length':b-a+1,'Cache-Control':'no-store'});fs.createReadStream(p,{start:a,end:b}).pipe(res);}
    else{res.writeHead(200,{'Content-Type':type,'Content-Length':st.size,'Accept-Ranges':'bytes','Cache-Control':'no-store'});fs.createReadStream(p).pipe(res);}});});

async function main(){
  await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
  /* --disable-audio-output: atrapa wyjścia audio z własnym zegarem — bez niej nagranie stoi na 0 s, gdy macOS nie oddaje urządzenia (np. głośniki uśpione) */
  const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--mute-audio','--disable-audio-output','--autoplay-policy=no-user-gesture-required']});
  const problems=[];
  try{
    const page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1});
    page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')problems.push('console.'+m.type()+' '+m.text().slice(0,200));});
    page.on('pageerror',e=>problems.push('pageerror '+String(e).slice(0,300)));
    await page.goto(`http://127.0.0.1:${PORT}/test/proto/rolka/?sb=${SB}&cover=0${RATE?'&rate='+RATE:''}`,{waitUntil:'load'});
    await page.waitForFunction(()=>document.documentElement.dataset.ready==='1',{timeout:15000});
    const info=await page.evaluate(()=>{const TL=window.Rolka.timeline;return{T:TL.T,align:TL.align,scenes:TL.scenes.map(S=>({start:S.start,end:S.end,speechEnd:S.speechEnd,words:S.words.map(w=>[w.d,+w.t0.toFixed(3),+w.t1.toFixed(3)]),chunks:S.chunks.map(c=>c.map(k=>S.words[k].d).join(' '))}))};});
    console.log(`${SB}: oś czasu ${info.T.toFixed(2)} s, wyrównanie:`,info.align);
    info.scenes.forEach((S,i)=>{console.log(`scena ${i}: ${S.start.toFixed(2)}–${S.end.toFixed(2)} (mowa do ${S.speechEnd.toFixed(2)})`);
      if(TABLE)console.log('   '+S.words.map(([d,a,b])=>`${d} ${a.toFixed(2)}–${b.toFixed(2)}`).join(' | '));
      if(TABLE)console.log('   napisy: '+S.chunks.join(' / '));});
    if(!info.align){console.log('Ten scenariusz nie ma nagrania lektora.');return;}
    const words=info.scenes.flatMap(S=>S.words);
    const spokenAt=t=>{let j=-1;for(let k=0;k<words.length;k++)if(words[k][1]<=t)j=k;return j<0?null:words[j][0];};
    for(const from of FROM){
      await page.evaluate(f=>{window.Rolka.play();if(f>0)window.Rolka.seekPlay(f);},from);
      await page.waitForFunction(()=>{const s=window.Rolka.state();return s.mode==='audio'&&s.audioTime>0.05;},{timeout:8000}).catch(()=>problems.push('nagranie nie ruszyło (from '+from+')'));
      const st0=await page.evaluate(()=>window.Rolka.state());console.log(`\nodtwarzanie od ${from} s: tryb ${st0.mode}, ${st0.voice}, tempo ×${st0.rate}`);
      let n=0,ok=0,maxD=0,sumD=0,miss=[];const wall0=Date.now(),a0=st0.audioTime;
      const until=Date.now()+SECS*1000;
      while(Date.now()<until){await new Promise(r=>setTimeout(r,150));
        const s=await page.evaluate(()=>{const st=window.Rolka.state();const now=document.querySelector('#cap .w.now');const box=document.querySelector('#cap .box');
          return{t:st.t,a:st.audioTime,now:now&&box.style.display!=='none'?now.textContent:null,playing:st.playing};});
        if(!s.playing)break;const d=s.t-s.a;maxD=Math.max(maxD,Math.abs(d));sumD+=Math.abs(d);n++;
        const exp=spokenAt(s.a);if(s.now===exp||s.now==null)ok++;else miss.push(`${s.a.toFixed(2)}s: napis „${s.now}”, mówi „${exp}”`);}
      const a1=await page.evaluate(()=>window.Rolka.state().audioTime);const wall=(Date.now()-wall0)/1000;
      console.log(`  próbek ${n}: podświetlone słowo zgodne z mową ${ok}/${n}; |zegar rolki − audio| średnio ${(sumD/Math.max(1,n)*1000).toFixed(0)} ms, maks. ${(maxD*1000).toFixed(0)} ms`);
      console.log(`  tempo: ${(a1-a0).toFixed(2)} s nagrania w ${wall.toFixed(2)} s zegarowych (×${((a1-a0)/wall).toFixed(2)})`);
      miss.slice(0,6).forEach(m=>console.log('   - '+m));
      // efekty dźwiękowe (WebAudio): ile zaplanowano w tym odcinku i z jakim wyprzedzeniem względem zegara rolki
      const fx=await page.evaluate(()=>window.Rolka.sfx?window.Rolka.sfx():null);
      if(fx){const L=fx.log.filter(e=>e.t>=a0-.05&&e.t<=a1+.2);const lead=L.map(e=>e.t-e.clock);const by={};L.forEach(e=>by[e.kind]=(by[e.kind]||0)+1);
        const exp=fx.events.filter(e=>e.t>=a0+.1&&e.t<=a1-.2).length;
        console.log(`  efekty: AudioContext ${fx.ctx}, zaplanowano ${L.length} (oczekiwano ≥ ${exp}), wyprzedzenie ${lead.length?Math.min(...lead).toFixed(2):'-'}…${lead.length?Math.max(...lead).toFixed(2):'-'} s, rodzaje ${JSON.stringify(by)}`);}
      await page.evaluate(()=>window.Rolka.pause());}
  }finally{await browser.close();server.close();}
  if(problems.length){console.log('\nUWAGI:');[...new Set(problems)].forEach(p=>console.log('  - '+p));}else console.log('\nBez błędów w konsoli.');
}
main().catch(e=>{console.error(e);server.close();process.exit(1);});
