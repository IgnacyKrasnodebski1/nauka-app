#!/usr/bin/env node
/* ============================================================ CRAMFOX — kontrola: kluczowe punkty i sanitizacja treści mediów (docs/plan-media.md §1.1–1.2, §4.2, §4.6)
   1) mapowanie keyPoints → punkty silnika (cloud.js mapPoints): id „t<8 znaków tematu>_p3”, raw, n, fc/q/tk w id poziomów silnika, każda fiszka i pytanie
      w dokładnie jednym punkcie, zadanie w najwyżej jednym;
   2) przypadki brzegowe (test/fixtures/topic-kp-edge.json): XSS i emoji w tytułach (zwykły tekst), złe i zdublowane odwołania odpadają, punkt < 3 elementów
      scalony, niepokryte pytania → punkt zastępczy poziomu („La1”), < 3 poprawne punkty (topic-kp-few.json) → cały temat na punktach zastępczych;
   3) treść z bazy i Storage z próbami XSS (mediafx=xss, foxfx=xss): manifest po mediaList() oczyszczony, nazwy plików tylko /^[a-z0-9.]+$/, odwołania
      do pytań sprawdzone, ekrany rolek, podcastu i lisa bez wykonanego kodu i bez emoji;
   4) build: CSP z „media-src blob:”, media.js między engine.js a cloud-ui.js (index.html, test/dev/index.html, build), media.css w stylach.
   Użycie (z test/): node dev/checks/keypoints.mjs [--out KATALOG] */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {start,close,check,section,done,shot,sleep,boot,eng,engAsync,missing,until,bodyText,seesText,tapText,uiCheck,checkRun,MS,LID,PID,ROOT} from './cloud-lib.mjs';

const {S,T1}=MS;
const FX=n=>JSON.parse(fs.readFileSync(path.join(ROOT,'test/fixtures',n+'.json'),'utf8'));
/* każdy element z SRS tematu dokładnie raz, zadania najwyżej raz */
function coverage(points,topic,topicId){
  const seen={};const bump=(k)=>{seen[k]=(seen[k]||0)+1;};
  points.forEach(p=>{(p.fc||[]).forEach(([l,i])=>bump('f:'+l+':'+i));(p.q||[]).forEach(([l,i])=>bump('q:'+l+':'+i));(p.tk||[]).forEach(([l,i])=>bump('t:'+l+':'+i));});
  const miss=[],dup=[];
  topic.levels.forEach(L=>{const lid=LID(topicId,L.id);
    (L.flashcards||[]).forEach((_,i)=>{const n=seen['f:'+lid+':'+i]|0;if(n===0)miss.push('f '+L.id+'#'+i);if(n>1)dup.push('f '+L.id+'#'+i);});
    (L.quiz||[]).forEach((_,i)=>{const n=seen['q:'+lid+':'+i]|0;if(n===0)miss.push('q '+L.id+'#'+i);if(n>1)dup.push('q '+L.id+'#'+i);});
    (L.tasks||[]).forEach((_,i)=>{if((seen['t:'+lid+':'+i]|0)>1)dup.push('t '+L.id+'#'+i);});});
  return {miss,dup};
}

await start();

section('mapowanie keyPoints (materiał 01, 13 punktów)');
{const r=await boot('mock=msgip&reset=1');const T=FX('topic-msgip');
  const pts=await eng(r,'pointsOf',S,T1);
  check(Array.isArray(pts)&&pts.length===13,'13 punktów materiału 01',missing(pts)||(pts&&pts.length));
  if(Array.isArray(pts)&&pts.length){
    check(pts.every((p,i)=>p.id===PID(T1,'p'+(i+1))&&p.raw==='p'+(i+1)&&p.n===i+1&&p.topicId===T1&&!p.fb),'id „t7c000011_pN”, raw „pN”, n = pozycja, topicId, bez fb',JSON.stringify(pts.slice(0,2).map(p=>({id:p.id,raw:p.raw,n:p.n,topicId:p.topicId,fb:p.fb}))));
    check(pts.every((p,i)=>p.s===T.keyPoints[i].short&&p.t===T.keyPoints[i].title),'t / s z keyPoints (plain)');
    const want=T.keyPoints.map(p=>[p.items.filter(x=>x.kind==='flashcard').length,p.items.filter(x=>x.kind==='quiz').length,p.items.filter(x=>x.kind==='task').length].join('/'));
    const got=pts.map(p=>[(p.fc||[]).length,(p.q||[]).length,(p.tk||[]).length].join('/'));
    check(JSON.stringify(got)===JSON.stringify(want),'fc/q/tk każdego punktu jak w fixturze',got.join(' '));
    check(pts.every(p=>(p.fc||[]).concat(p.q||[],p.tk||[]).every(([l])=>/^t7c000011_l[1-4]$/.test(l))),'odwołania w id poziomów silnika (t7c000011_l1…)');
    const c=coverage(pts,T,T1);check(!c.miss.length&&!c.dup.length,'każda fiszka i pytanie w dokładnie jednym punkcie, zadanie w najwyżej jednym',JSON.stringify(c));
    const tp=await eng(r,'topicOf',S,T1);check(tp&&tp.n===1&&Array.isArray(tp.points)&&tp.points.length===13,'topicOf(): n = 1, 13 punktów',missing(tp)||JSON.stringify(tp&&{n:tp.n,points:tp.points&&tp.points.length}));
    const lid=await eng(r,'levelId',T1,'l3'),pid=await eng(r,'pointId',T1,'p9'),raw=await eng(r,'pointRaw',PID(T1,'p9'));
    check(lid===LID(T1,'l3')&&pid===PID(T1,'p9')&&raw&&raw.topicId===T1&&raw.raw==='p9','levelId / pointId / pointRaw',JSON.stringify({lid,pid,raw}));}
  const all=await eng(r,'pointsOf',S);check(Array.isArray(all)&&all.length===27,'przedmiot: 27 punktów (13 + 8 + 6) w kolejności materiałów',missing(all)||(all&&all.length));
  if(Array.isArray(all)&&all.length===27)check(all[13].topicId===MS.T2&&all[13].n===1&&all[21].topicId===MS.T3,'kolejność: materiał 01, 02, 03; n liczone w materiale');
  checkRun(r,'msgip');await close(r);}

section('przypadki brzegowe keyPoints (extra=kp)');
{const r=await boot('mock=seeded&reset=1&extra=kp');const E=FX('topic-kp-edge');
  const pts=await eng(r,'pointsOf',MS.sKp,MS.tKpEdge);
  check(Array.isArray(pts)&&pts.length>=3,'kp-edge: punkty zostają (≥ 3 poprawne)',missing(pts)||JSON.stringify(pts&&pts.map(p=>p.raw)));
  if(Array.isArray(pts)&&pts.length){
    const p1=pts.find(p=>p.raw==='p1');
    check(p1&&!/<img|<b>|<script/i.test(p1.t+p1.s+(p1.sum||''))&&/&lt;img/.test(p1.t),'XSS w tytule / short / summary → zwykły tekst (escapowany)',p1&&JSON.stringify({t:p1.t,s:p1.s,sum:p1.sum}));
    check(p1&&!/[\u{1F000}-\u{1FAFF}]/u.test(p1.t+p1.s),'emoji z tytułów punktów usunięte',p1&&p1.t);
    check(p1&&[...p1.s.replace(/&[a-z]+;|&#\d+;/g,'x')].length<=24,'short przycięty do 24 znaków');
    const p2=pts.find(p=>p.raw==='p2');
    check(p2&&(p2.fc||[]).length===1&&(p2.q||[]).length===2,'złe odwołania (nieznany poziom, indeks poza zakresem, ujemny) odpadają',p2&&JSON.stringify({fc:p2.fc,q:p2.q}));
    check(!pts.some(p=>p.raw==='p3'),'punkt z 1 elementem po usunięciu duplikatu → scalony (nie ma go osobno)');
    check(!pts.some(p=>p.raw==='p6')&&!pts.some(p=>p.raw==='p7'),'punkt z samym zadaniem i punkt bez poprawnych elementów → nie ma ich osobno');
    const fb=pts.filter(p=>/^La[12]$/.test(p.raw));
    check(fb.length>=1&&fb.every(p=>p.fb===true),'niepokryte pytania i fiszki → punkt zastępczy poziomu („La1”/„La2”, fb)',JSON.stringify(pts.map(p=>p.raw)));
    check(pts.every(p=>(p.fc||[]).length+(p.q||[]).length>=2&&(p.fc||[]).length+(p.q||[]).length+(p.tk||[]).length>=3),'każdy punkt: ≥ 3 elementy, ≥ 2 z SRS');
    const c=coverage(pts,E,MS.tKpEdge);check(!c.miss.length&&!c.dup.length,'kp-edge: każda fiszka i pytanie dokładnie raz (pierwszy punkt wygrywa)',JSON.stringify(c));}
  const few=await eng(r,'pointsOf',MS.sKp,MS.tKpFew),F=FX('topic-kp-few');
  check(Array.isArray(few)&&few.length===F.levels.length&&few.every(p=>p.fb===true&&/^L/.test(p.raw)),'kp-few: < 3 poprawne punkty → cały temat na punktach zastępczych (jeden na poziom)',missing(few)||JSON.stringify(few&&few.map(p=>p.raw)));
  // zgodność surowych id z serwerem: atrapa ma kopię topicPoints() z nauka-backend packages/shared/src/media.ts (focusPointId, pointIds w /api/fox, manifesty)
  const par=await r.pg.evaluate(()=>{const out=[];for(const t of MOCK.db().t.topics){const srv=MOCK.topicPoints(t.content).map(p=>p.id);
    const cli=(NaukaEngine.pointsOf(t.subject_id,t.id)||[]).map(p=>p.raw);out.push({name:String(t.name||'').slice(0,30),srv,cli,ok:JSON.stringify(srv)===JSON.stringify(cli)});}return out;});
  check(par.length>=2&&par.every(x=>x.ok),'surowe id punktów w apce = topicPoints() serwera (każdy temat konta, też przypadki brzegowe)',JSON.stringify(par.filter(x=>!x.ok)).slice(0,400));
  await eng(r,'openSubject',MS.sKp);await sleep(700);await eng(r,'openMaterial',MS.sKp,MS.tKpEdge);await sleep(700);
  await shot(r,'kp-edge-material');await uiCheck(r,'kp-edge: materiał');
  checkRun(r,'kp');await close(r);}

section('treść mediów z XSS (mediafx=xss): manifest, scenariusz, transkrypcja');
{const r=await boot('mock=msgip&reset=1&mediafx=xss&media=ready');
  const rows=await engAsync(r,'NAUKA_CLOUD.mediaList');
  check(Array.isArray(rows)&&rows.length===2,'mediaList(): 2 wiersze',missing(rows)||JSON.stringify(rows).slice(0,200));
  if(Array.isArray(rows)&&rows.length){
    const s=JSON.stringify(rows);
    check(!/<img|<svg|<script|<b>/i.test(s),'mediaList(): żaden napis nie ma znaczników HTML (plain)',(s.match(/<(img|svg|script|b)[^>]{0,40}/i)||[''])[0]);
    check(!/[\u{1F000}-\u{1FAFF}]/u.test(s),'mediaList(): bez emoji');
    const reels=rows.find(x=>x.kind==='reels'),man=reels&&reels.manifest;
    const files=man&&Array.isArray(man.reels)?man.reels.flatMap(x=>x&&x.files?Object.values(x.files):[]):[];
    check(files.length&&files.every(f=>/^[a-z0-9.]+$/.test(f)),'nazwy plików tylko /^[a-z0-9.]+$/ (../ i javascript: odrzucone)',JSON.stringify(files));
    const refs=man&&Array.isArray(man.reels)?man.reels.map(x=>x&&x.quizRef).filter(Boolean):[];
    check(refs.every(q=>/^[A-Za-z0-9_-]{1,40}$/.test(q.level)&&Number.isInteger(q.index)&&q.index>=0&&q.index<=59),'quizRef: poziom /^[A-Za-z0-9_-]{1,40}$/, indeks 0–59 (zły odrzucony)',JSON.stringify(refs));
    check(!s.includes('evil'),'nieznane klucze manifestu odrzucone');
    check(!man||!man.reels||!man.reels.some(x=>x&&/javascript/i.test(String(x.thumb))),'thumb tylko #hex');}
  const o=await eng(r,'NaukaMedia.openReels',S,T1);check(!missing(o),'NaukaMedia.openReels',missing(o));await sleep(1200);
  await shot(r,'xss-reels-series');await uiCheck(r,'XSS: seria rolek');
  const o2=await eng(r,'NaukaMedia.openReels',S,T1,{reel:1});await sleep(2500);
  check(!missing(o2),'rolka z XSS w scenariuszu (stacje, etykiety, karty, przerywniki, kolory) otwiera się',missing(o2));
  const dom=await r.pg.evaluate(()=>({img:document.querySelectorAll('img[src="x"],img[onerror]').length,script:[...document.querySelectorAll('script')].filter(s=>/__pwned/.test(s.textContent)).length,
    styleJs:[...document.querySelectorAll('[style]')].filter(e=>/javascript:|expression\(/i.test(e.getAttribute('style'))).length,onattr:[...document.querySelectorAll('*')].filter(e=>[...e.attributes].some(a=>/^on/i.test(a.name))).length}));
  check(!dom.img&&!dom.script&&!dom.styleJs,'scenariusz: żadnego <img onerror>, <script>, stylu z javascript:',JSON.stringify(dom));
  await shot(r,'xss-reel-player');await uiCheck(r,'XSS: odtwarzacz rolki');
  const o3=await eng(r,'NaukaMedia.openPodcast',S,T1,{chapter:1});await sleep(2500);
  check(!missing(o3),'podcast z XSS w skrypcie i czasach otwiera się',missing(o3));
  await shot(r,'xss-podcast');await uiCheck(r,'XSS: podcast');
  checkRun(r,'mediafx=xss');await close(r);}

section('odpowiedzi lisa z XSS (foxfx=xss)');
{const r=await boot('mock=msgip&reset=1&foxfx=xss');
  const o=await eng(r,'NaukaMedia.openFox',S,{topicId:T1,mode:'explain',pointId:PID(T1,'p9')});check(!missing(o),'NaukaMedia.openFox',missing(o));
  await sleep(800);
  try{await tapText(r,'ZACZNIJ ROZMOWĘ');await sleep(1500);
    const inp=await r.pg.$('textarea, input[type="text"]');if(inp){await inp.type('MFW pożycza państwom w kryzysie i pilnuje stabilności walut na świecie.');await r.pg.keyboard.press('Enter');}
    await sleep(500);const send=await r.pg.$('button[aria-label*="Wyślij"]');if(send)await send.evaluate(b=>b.click());await sleep(2000);}
  catch(e){check(false,'XSS: rozmowa',e.message);}
  await shot(r,'xss-fox');await uiCheck(r,'XSS: rozmowa z lisem');
  checkRun(r,'foxfx=xss');await close(r);}

section('build: CSP media-src blob:, kolejność skryptów, media.css');
{const idx=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),dev=fs.readFileSync(path.join(ROOT,'test/dev/index.html'),'utf8');
  for(const [name,h] of [['index.html',idx],['test/dev/index.html',dev]]){
    const src=[...h.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m=>m[1].split('/').pop()).filter(f=>f!=='mock-backend.js');
    check(JSON.stringify(src)===JSON.stringify(['cloud-config.js','cloud.js','engine.js','media.js','cloud-ui.js']),name+': cloud-config → cloud → engine → media → cloud-ui',src.join(' → '));
    check(/media\.css/.test(h),name+': <link> do media.css');}
  const need=['build.js','cloud-config.js','cloud.js','engine.js','media.js','cloud-ui.js','styles.css','media.css'];
  const lack=need.filter(f=>!fs.existsSync(path.join(ROOT,f)));
  if(lack.length)check(false,'pliki do buildu',lack.join(', ')+' — brak');
  else{
    const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cramfox-build-'));need.forEach(f=>fs.copyFileSync(path.join(ROOT,f),path.join(tmp,f)));fs.cpSync(path.join(ROOT,'fonts'),path.join(tmp,'fonts'),{recursive:true});
    let html='';try{execFileSync(process.execPath,['build.js'],{cwd:tmp,stdio:'pipe'});html=fs.readFileSync(path.join(tmp,'build','nauka-all.html'),'utf8');}catch(e){check(false,'node build.js',String(e.stderr||e.message).slice(0,300));}
    if(html){const csp=(html.match(/Content-Security-Policy" content="([^"]*)"/)||[])[1]||'';
      check(/media-src blob:(;|$| )/.test(csp),'CSP: media-src blob:',csp.replace(/'sha256-[^']*'/g,'…'));
      check(!/media-src[^;]*(https?:|\*)/.test(csp),'CSP: media-src bez zewnętrznych źródeł');
      const pos=['cloud-config.js','cloud.js','engine.js','media.js','cloud-ui.js'].map(f=>html.indexOf(fs.readFileSync(path.join(ROOT,f),'utf8').slice(0,400))); // skrypty wklejone w całości — szukamy początku każdego pliku
      check(pos.every(x=>x>=0)&&pos.every((x,i)=>!i||x>pos[i-1]),'build: cloud-config → cloud → engine → media → cloud-ui',JSON.stringify(pos));
      const css=fs.readFileSync(path.join(ROOT,'media.css'),'utf8').trim().slice(0,60);check(css&&html.includes(css),'build: media.css wklejony do <style>');}
    fs.rmSync(tmp,{recursive:true,force:true});}}

await done();
