#!/usr/bin/env node
/* ============================================================ CRAMFOX — fixture'y mediów (rolki, podcast) dla atrapy backendu
   Pisane ręcznie: sb-a.json, sb-b.json (scenariusze rolek w formacie apki: bez `quiz` i `voice`, docs/plan-media.md §2.2),
   podcast-script.json (script.json: 8 rozdziałów, dialog lis/szop, **pojęcia**), fox-msgip.json, xss/*.json.
   Generowane tym skryptem (deterministycznie, bez sieci i bez ElevenLabs):
     sb-a.words.json, sb-b.words.json     czasy słów jak z /with-timestamps po alignToWords: {v:1, duration, words:[{w,start,end,tag?}]}
     sb-a.mp3, sb-b.mp3, c1.mp3, c2.mp3   cisza MPEG-2 Layer III (24 kHz, 8 kb/s, mono, CBR) o długości równej czasom słów — gra w Chrome i WKWebView
     c1.json, c2.json                     czasy rozdziałów podcastu: {v:1, duration, lines:[{i,s,start,end,words}], pauses:[{afterLine,at}]}
     reels-msgip.json, podcast-msgip.json manifesty (media.manifest) dla materiału 01 z test/fixtures/topic-msgip.json; topicId = "TOPIC" (atrapa podmienia)
     xss/*                                to samo z próbami XSS (mediafx=xss)
   Czasy słów: szacunek jak w prototypie (0,09 s + 0,053 s na literę, pauza po interpunkcji) — atrapa liczy tak samo czasy rozdziałów 3–8.
   Manifest rolek ma durSec z makiet (spec §3: 0:52, 0:58, 0:47, 0:55, 0:59 = 4:31), a nagrania fixture'ów są krótkie (ok. 10–15 s).
   Użycie: node test/fixtures/media/make-media.mjs */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const rd=f=>JSON.parse(fs.readFileSync(path.join(HERE,f),'utf8'));
const flat=v=>v&&typeof v==='object'&&Object.values(v).every(x=>x==null||typeof x!=='object'||(Array.isArray(x)&&x.every(y=>y==null||typeof y!=='object')));
function fmt(v,ind=''){ // JSON z wcięciami, ale małe obiekty (słowo, odwołanie) w jednej linii
  if(!v||typeof v!=='object'||flat(v)&&JSON.stringify(v).length<=110)return JSON.stringify(v);const i2=ind+'  ';
  if(Array.isArray(v))return v.length?'[\n'+v.map(x=>i2+fmt(x,i2)).join(',\n')+'\n'+ind+']':'[]';
  return '{\n'+Object.entries(v).map(([k,x])=>i2+JSON.stringify(k)+': '+fmt(x,i2)).join(',\n')+'\n'+ind+'}';}
const wr=(f,v)=>fs.writeFileSync(path.join(HERE,f),typeof v==='string'||Buffer.isBuffer(v)?v:fmt(v)+'\n');
const r3=x=>Math.round(x*1000)/1000;

/* cisza MP3: MPEG-2 LSF Layer III, 24 kHz, 8 kb/s, mono, bez CRC; ramka 24 B = 576 próbek = 24 ms; puste side info = cisza */
const FRAME_SEC=576/24000;
function silentMp3(sec){const n=Math.max(1,Math.round(sec/FRAME_SEC)),len=24,out=Buffer.alloc(n*len);for(let i=0;i<n;i++)out.set([0xFF,0xF3,0x14,0xC0],i*len);return out;}
const mp3Dur=sec=>r3(Math.max(1,Math.round(sec/FRAME_SEC))*FRAME_SEC);

/* szacunek czasu słowa (jak lektor przeglądarki w prototypie) — ta sama funkcja jest w mock-backend.js (estWords) */
const letters=w=>(w.match(/[\p{L}\p{N}]/gu)||[]).length;
function estTokens(text,t0){
  const out=[];let t=t0;
  for(const m of String(text).matchAll(/\[[^\]]+\]|\S+/g)){const w=m[0];
    if(w[0]==='['){out.push({w,start:r3(t),end:r3(t+0.05),tag:true});t+=0.06;continue;}
    const d=0.09+0.053*letters(w);out.push({w,start:r3(t),end:r3(t+d*0.92)});t+=d;
    if(/[.?!…]["”]?$/.test(w))t+=0.32;else if(/[,;:—–]$/.test(w))t+=0.18;}
  return {words:out,t};
}
function wordsFor(sb){
  const text=sb.scenes.map(s=>s.tts||s.say).join('\n');const {words,t}=estTokens(text,0.12);
  const duration=mp3Dur(t+0.35);return {v:1,duration,words};
}
function chapterTiming(ch,pauses){
  let t=0.2;const lines=ch.lines.map((L,i)=>{const {words,t:t1}=estTokens(String(L.t).replace(/\*\*/g,''),t);const o={i,s:L.s,start:r3(t),end:r3(t1),words};t=t1+0.45;return o;});
  const duration=mp3Dur(t+0.3);
  return {v:1,duration,lines,pauses:pauses.map(p=>({afterLine:p.afterLine,at:lines[p.afterLine]?lines[p.afterLine].end:duration}))};
}

/* ---------- rolki ---------- */
const A=rd('sb-a.json'),B=rd('sb-b.json'),X=rd('xss/sb-xss.json');
const wA=wordsFor(A),wB=wordsFor(B),wX=wordsFor(X);
wr('sb-a.words.json',wA);wr('sb-b.words.json',wB);wr('xss/sb-xss.words.json',wX);
wr('sb-a.mp3',silentMp3(wA.duration));wr('sb-b.mp3',silentMp3(wB.duration));wr('xss/sb-xss.mp3',silentMp3(wX.duration));
const REELS=[ // spec §3: seria „Kto rządzi światową gospodarką?”; sb-a = rolki nieparzyste, sb-b = parzyste (atrapa podaje te same pliki pod rN.*)
  {n:1,type:'czym',title:'MSG i MSP w minutę',durSec:52.1,pointIds:['p1','p2'],quizRef:{level:'l1',index:1},feedRef:{level:'l1',index:0},thumb:'#2F6BFF'},
  {n:2,type:'kto',title:'ONZ, WTO, MFW i Bank Światowy',durSec:58.1,pointIds:['p7','p8','p9','p10'],quizRef:{level:'l3',index:6},feedRef:{level:'l3',index:1},thumb:'#1F8A5B'},
  {n:3,type:'mit',title:'Globalizacja to tylko handel?',durSec:47.1,pointIds:['p3','p4','p5'],quizRef:{level:'l2',index:2},feedRef:{level:'l2',index:0},thumb:'#E9A23B'},
  {n:4,type:'porownanie',title:'Korporacja kontra państwo',durSec:55.1,pointIds:['p6','p11'],quizRef:{level:'l4',index:1},feedRef:{level:'l4',index:1},thumb:'#E0483F'},
  {n:5,type:'sprawdzian',title:'5 rzeczy na sprawdzian',durSec:59.0,pointIds:['p12','p13'],quizRef:{level:'l4',index:6},feedRef:{level:'l4',index:2},thumb:'#2F6BFF'}];
const reelsManifest={v:1,kind:'reels',title:'Kto rządzi światową gospodarką?',topicId:'TOPIC',coverage:{points:13,covered:13},
  reels:REELS.map(r=>({...r,files:{storyboard:`r${r.n}.json`,audio:`r${r.n}.mp3`,words:`r${r.n}.words.json`},rate:1.15}))};
wr('reels-msgip.json',reelsManifest);
const reelsX=JSON.parse(JSON.stringify(reelsManifest));
reelsX.title='Seria <img src=x onerror="window.__pwned=1"> 🔥';
reelsX.reels[0].title='Rolka <img src=x onerror="window.__pwned=1">';
reelsX.reels[1].title='"><svg onload=window.__pwned=1> 🔥';
reelsX.reels[1].type='<b>hack</b>';
reelsX.reels[2].files={storyboard:'../../evil.json',audio:'javascript:alert(1)',words:'r3.words.json'};
reelsX.reels[3].quizRef={level:'l1"><img src=x onerror=window.__pwned=1>',index:1e9};
reelsX.reels[3].thumb='javascript:window.__pwned=1';
reelsX.reels[4].pointIds=['<img src=x onerror="window.__pwned=1">','p12'];
reelsX.evil='<script>window.__pwned=1</script>';
wr('xss/reels-xss.json',reelsX);

/* ---------- podcast ---------- */
const S=rd('podcast-script.json'),SX=rd('xss/script-xss.json');
const PAUSES={ // jedna pauza na rozdział (spec D2: istniejące pytanie quizu); afterLine = indeks linijki (od 0) z pomyłką Szopa
  1:{afterLine:1,quizRef:{level:'l1',index:1},pointId:'p1',lead:'Szop twierdzi, że MSG i MSP to to samo. Czym się różnią?'},
  2:{afterLine:3,quizRef:{level:'l2',index:6},pointId:'p5',lead:'Szop twierdzi, że w kryzysie płatniczym pomaga Bank Światowy. Kogo powinien był wymienić?'},
  3:{afterLine:1,quizRef:{level:'l2',index:3},pointId:'p4',lead:'Szop myśli, że każdy kraj powinien robić wszystko sam. Co mówi przewaga komparatywna?'},
  4:{afterLine:1,quizRef:{level:'l3',index:0},pointId:'p6',lead:'Szop dorzucił flagę do elementów państwa. Jakie są naprawdę?'},
  5:{afterLine:1,quizRef:{level:'l3',index:3},pointId:'p7',lead:'Szop twierdzi, że sankcje nakłada Zgromadzenie Ogólne. Kto naprawdę?'},
  6:{afterLine:1,quizRef:{level:'l3',index:9},pointId:'p10',lead:'Szop pomieszał MFW z Bankiem Światowym. Kto finansuje drogi i szkoły?'},
  7:{afterLine:1,quizRef:{level:'l4',index:1},pointId:'p11',lead:'Szop twierdzi, że polityka korporacji nie dotyczy. Jak jest naprawdę?'},
  8:{afterLine:1,quizRef:{level:'l4',index:7},pointId:'p13',lead:'Szop myśli, że NGO to agenda rządu. Czym różni się od organizacji międzyrządowej?'}};
const CH={1:{pointIds:['p1','p2'],levelIds:['l1'],estSec:190},2:{pointIds:['p3','p5'],levelIds:['l2'],estSec:205},3:{pointIds:['p4'],levelIds:['l2'],estSec:200},
  4:{pointIds:['p6'],levelIds:['l3'],estSec:210},5:{pointIds:['p7','p8'],levelIds:['l3'],estSec:195},6:{pointIds:['p9','p10'],levelIds:['l3'],estSec:200},
  7:{pointIds:['p11'],levelIds:['l4'],estSec:205},8:{pointIds:['p12','p13'],levelIds:['l4'],estSec:195}};
const c1=chapterTiming(S.chapters[0],[PAUSES[1]]),c2=chapterTiming(S.chapters[1],[PAUSES[2]]);
wr('c1.json',c1);wr('c2.json',c2);wr('c1.mp3',silentMp3(c1.duration));wr('c2.mp3',silentMp3(c2.duration));
const podcastManifest={v:1,kind:'podcast',title:S.title,topicId:'TOPIC',estSec:1600,files:{script:'script.json'},
  chapters:S.chapters.map(ch=>{const n=ch.n,syn=n<=2,tm=n===1?c1:c2;
    return {n,title:ch.title,pointIds:CH[n].pointIds,levelIds:CH[n].levelIds,estSec:CH[n].estSec,durSec:syn?tm.duration:null,status:syn?'ready':'script',
      pauses:[PAUSES[n]],files:syn?{audio:`c${n}.mp3`,timing:`c${n}.json`}:null};})};
wr('podcast-msgip.json',podcastManifest);
const cx=chapterTiming(SX.chapters[0],[{afterLine:1}]);
cx.lines[1].words.push({w:'<img src=x onerror="window.__pwned=1">',start:cx.lines[1].end,end:cx.lines[1].end});
wr('xss/c-xss.json',cx);wr('xss/c-xss.mp3',silentMp3(cx.duration));
const podX=JSON.parse(JSON.stringify(podcastManifest));
podX.title=SX.title;podX.chapters[0].title=SX.chapters[0].title;podX.chapters[0].durSec=cx.duration;
podX.chapters[0].pauses=[{afterLine:1,quizRef:{level:'l1',index:1},pointId:'p1',lead:'Szop <img src=x onerror="window.__pwned=1"> się myli 🔥'}];
podX.chapters[1].title='<svg onload=window.__pwned=1>';podX.chapters[1].status='<b>ready</b>';
podX.chapters[2].files={audio:'../x.mp3',timing:'javascript:1'};
wr('xss/podcast-xss.json',podX);

/* ---------- kontrola odwołań względem topic-msgip.json ---------- */
const T=JSON.parse(fs.readFileSync(path.join(HERE,'..','topic-msgip.json'),'utf8'));
const err=[];const lv=id=>T.levels.find(l=>l.id===id);const pids=new Set(T.keyPoints.map(p=>p.id));
const inPoint=(pid,ref)=>T.keyPoints.find(p=>p.id===pid).items.some(x=>x.kind==='quiz'&&x.level===ref.level&&x.index===ref.index);
reelsManifest.reels.forEach(r=>{if(!lv(r.quizRef.level)||!lv(r.quizRef.level).quiz[r.quizRef.index])err.push('rolka '+r.n+': brak pytania');
  if(!r.pointIds.every(p=>pids.has(p)))err.push('rolka '+r.n+': nieznany punkt');if(!r.pointIds.some(p=>inPoint(p,r.quizRef)))err.push('rolka '+r.n+': pytanie spoza punktów rolki');
  if(!lv(r.feedRef.level).feed[r.feedRef.index])err.push('rolka '+r.n+': brak części lekcji');});
const cov=new Set(reelsManifest.reels.flatMap(r=>r.pointIds));if(cov.size!==13)err.push('rolki: pokrycie '+cov.size+'/13');
const qr=new Set();podcastManifest.chapters.forEach(c=>c.pauses.forEach(p=>{const k=p.quizRef.level+'#'+p.quizRef.index;if(qr.has(k))err.push('podcast: powtórzone pytanie '+k);qr.add(k);
  if(!lv(p.quizRef.level).quiz[p.quizRef.index])err.push('podcast '+c.n+': brak pytania');if(!inPoint(p.pointId,p.quizRef))err.push('podcast '+c.n+': pytanie spoza punktu pauzy');
  if(!S.chapters[c.n-1].lines[p.afterLine])err.push('podcast '+c.n+': afterLine poza zakresem');}));
const pcov=new Set(podcastManifest.chapters.flatMap(c=>c.pointIds));if(pcov.size!==13)err.push('podcast: pokrycie '+pcov.size+'/13');
const est=podcastManifest.chapters.reduce((a,c)=>a+c.estSec,0);if(est!==podcastManifest.estSec)err.push('podcast: estSec '+est);
[A,B].forEach((sb,i)=>sb.scenes.forEach((s,k)=>{const W=x=>String(x).replace(/\[[^\]]+\]/g,' ').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,'').split(/\s+/).filter(Boolean).join(' ');
  if(W(s.say)!==W(s.tts))err.push(`sb-${'ab'[i]} scena ${k+1}: tts ≠ say`);}));
if(err.length){console.error(err.join('\n'));process.exitCode=1;}
else console.log(`ok: sb-a ${wA.duration}s (${wA.words.length} słów), sb-b ${wB.duration}s, c1 ${c1.duration}s, c2 ${c2.duration}s, xss ${wX.duration}s/${cx.duration}s`);
