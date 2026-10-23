#!/usr/bin/env node
/* ============================================================ CRAMFOX — kontrola: rolki i podcast (docs/plan-media.md §2.2–2.5, §4.5–4.6, §6.4; spec §5.4–5.9, §6)
   A) kontrakt atrapy (bez UI — to samo, co ma robić backend z 0010): /api/me media/chat/features, kolumny tabeli media, bucket media (RLS), walidacja
      i idempotencja POST /api/media/reels|podcast, busy, limity, zwrot przy porażce, rozdział podcastu (pamięć podręczna, busy), nomedia;
   B) apka: przygotowanie → dokładnie jeden POST na stuknięcie, bez ponawiania po błędzie i po przeładowaniu, copy busy/limitów/porażki/„Nie wiem jeszcze…”,
      kroki postępu, toast gotowości; seria → odtwarzacz → pytanie końcowe zapisane do SRS (klucz sid:lid:qN) i stan „obejrzana”; przewijanie; „Do powtórki”;
      podcast: rozdział nagrywany tylko po stuknięciu (jeden POST), pauza z pytaniem zapisuje SRS, pozycja zapisana, mini-odtwarzacz na innych zakładkach;
      usunięcie konta kasuje pliki z bucketu media.
   Użycie (z test/): node dev/checks/media.mjs [--out KATALOG] [--only A|B] */
import fs from 'node:fs';
import path from 'node:path';
import {start,close,check,section,done,shot,sleep,page,boot,apiCall,eng,engAsync,missing,until,bodyText,norm,seesText,tapText,isDisabled,uiCheck,checkRun,posts,MS,LID,PID,ROOT} from './cloud-lib.mjs';

const {S,T1,T2,T3,R1,P1,R2,UID}=MS;
const argv=process.argv.slice(2),ONLY=argv.includes('--only')?argv[argv.indexOf('--only')+1]:'';
const C1=JSON.parse(fs.readFileSync(path.join(ROOT,'test/fixtures/media/c1.json'),'utf8'));
const rid=r=>r.pg.evaluate(()=>crypto.randomUUID());
const has=(t,s)=>norm(t).toLowerCase().includes(norm(s).toLowerCase());
const progress=r=>r.pg.evaluate(u=>{try{return JSON.parse(localStorage.getItem('nauka_progress_v1:'+u)||'{}');}catch(e){return {};}},UID);
const SEL='id,owner_id,subject_id,topic_id,kind,status,phase,progress,title,spec,manifest,error,charged,created_at,finished_at';

await start();

if(ONLY!=='B'){
section('A. atrapa: /api/me, tabela media, bucket media');
{const r=await page('mock=msgip&reset=1',{settle:1500});
  const me=await apiCall(r,'GET','/api/me');const m=me.data||{};
  check(me.status===200&&m.media&&m.media.plan==='free'&&m.media.scope==='lifetime'&&m.media.used===1&&m.media.limit===3&&m.media.remaining===2,'/api/me media: free, lifetime, „Zostało: 2 z 3”',JSON.stringify(m.media));
  check(m.media&&m.media.busy&&m.media.busy.id===R2&&m.media.busy.topicId===T2&&typeof m.media.dailyLeft==='number'&&m.media.globalOpen===true,'media.busy = rolki 02 w toku, dailyLeft, globalOpen',JSON.stringify(m.media));
  check(m.chat&&m.chat.limit===30&&m.chat.remaining===30&&/^\d{4}-\d{2}-\d{2}$/.test(m.chat.day),'/api/me chat: 30 wiadomości na dobę',JSON.stringify(m.chat));
  check(m.features&&m.features.reels===true&&m.features.podcast===true&&m.features.fox===true,'/api/me features',JSON.stringify(m.features));
  check(m.quota&&m.quota.scope==='lifetime'&&m.quota.remaining===0,'stare pola (quota lekcji) bez zmian',JSON.stringify(m.quota));
  const star=await apiCall(r,'GET','/rest/v1/media?select=*');check(star.status===403&&star.data&&star.data.code==='42501','select=* → 42501 (GRANT tylko na kolumny z §2.5)',star.status);
  const cost=await apiCall(r,'GET','/rest/v1/media?select=id,cost_usd');check(cost.status===403,'kolumna spoza listy (cost_usd) → 42501');
  const rows=await apiCall(r,'GET','/rest/v1/media?select='+SEL+'&order=created_at.asc');
  check(rows.status===200&&rows.data.length===3&&rows.data.map(x=>x.kind+':'+x.status).join(',')==='reels:ready,podcast:ready,reels:running','3 wiersze: rolki 01, podcast 01, rolki 02 w toku',JSON.stringify((rows.data||[]).map(x=>x.kind+':'+x.status)));
  check(rows.status===200&&rows.data.every(x=>Object.keys(x).length===15&&!JSON.stringify(x).includes('"_')),'wiersz = dokładnie wybrane kolumny, bez pól wewnętrznych');
  const run=rows.data&&rows.data[2];check(run&&run.phase==='voice'&&run.progress&&run.progress.step==='voice'&&run.progress.done===2&&run.progress.total===5,'w toku: progress {step:"voice", done:2, total:5}',JSON.stringify(run&&run.progress));
  const one=await apiCall(r,'GET','/rest/v1/media?select=id,status&id=eq.'+P1);check(one.status===200&&one.data.length===1&&one.data[0].status==='ready','filtr id=eq.X');
  const write=await apiCall(r,'POST','/rest/v1/media',{id:await rid(r),owner_id:UID});check(write.status===403,'klient nie zapisuje do media (brak polityk INSERT)',write.status);
  const sb=await apiCall(r,'GET',`/storage/v1/object/authenticated/media/${UID}/${R1}/r2.json`);
  check(sb.status===200&&sb.data&&sb.data.audio&&sb.data.audio.src==='r2.mp3'&&sb.data.audio.words==='r2.words.json'&&!('quiz' in sb.data)&&!('voice' in sb.data),'r2.json: scenariusz bez quiz/voice, audio = r2.mp3 / r2.words.json',JSON.stringify(sb.data&&sb.data.audio));
  const mp=await apiCall(r,'GET',`/storage/v1/object/authenticated/media/${UID}/${R1}/r5.mp3`);check(mp.status===200&&mp.data.type==='audio/mpeg'&&mp.data.size>1000,'r5.mp3: audio/mpeg',JSON.stringify(mp.data));
  const wd=await apiCall(r,'GET',`/storage/v1/object/authenticated/media/${UID}/${R1}/r1.words.json`);check(wd.status===200&&wd.data.v===1&&wd.data.duration>5&&wd.data.words.some(w=>w.tag),'r1.words.json: {v:1, duration, words:[{w,start,end,tag?}]}');
  const other=await apiCall(r,'GET',`/storage/v1/object/authenticated/media/0c0ffee0-0000-4000-8000-0000000000ff/${R1}/r1.json`);check(other.status===400||other.status===404,'cudzy folder → Object not found',other.status);
  const up=await apiCall(r,'POST',`/storage/v1/object/media/${UID}/${R1}/x.json`,{a:1});check(up.status===400&&up.data&&up.data.statusCode==='403','zapis do bucketu media przez klienta → RLS 403',JSON.stringify(up.data));
  const scr=await apiCall(r,'GET',`/storage/v1/object/authenticated/media/${UID}/${P1}/script.json`);check(scr.status===200&&scr.data.chapters.length===8,'script.json: 8 rozdziałów');
  const c1=await apiCall(r,'GET',`/storage/v1/object/authenticated/media/${UID}/${P1}/c1.json`);check(c1.status===200&&c1.data.lines.length&&c1.data.pauses[0].afterLine===1,'c1.json: linie z czasami słów i pauza');
  const c3=await apiCall(r,'GET',`/storage/v1/object/authenticated/media/${UID}/${P1}/c3.mp3`);check(c3.status===400||c3.status===404,'c3.mp3 nie istnieje przed nagraniem rozdziału');
  await close(r);}

section('A. atrapa: POST /api/media/reels i /podcast');
{const r=await page('mock=msgip&reset=1',{settle:1500});
  const bad=async(body,label)=>{const x=await apiCall(r,'POST','/api/media/reels',body);check(x.status===400&&x.data&&x.data.code==='bad_request'&&x.data.charged===false,label,x.status+' '+JSON.stringify(x.data));};
  await bad({requestId:'x',topicId:T3,types:['czym','kto','mit']},'requestId nie-UUID → 400 bad_request');
  await bad({requestId:await rid(r),topicId:T3,types:['czym','kto']},'seria < 3 rodzaje → 400');
  await bad({requestId:await rid(r),topicId:T3,types:['czym','kto','hack']},'nieznany rodzaj → 400');
  await bad({requestId:await rid(r),topicId:T3,types:['czym','kto','mit'],focusPointId:'p1'},'focusPointId z > 1 rodzajem → 400');
  const bp=await apiCall(r,'POST','/api/media/reels',{requestId:await rid(r),topicId:T3,types:['czym'],focusPointId:'p99'});check(bp.status===400&&bp.data.code==='bad_point','nieznany punkt → 400 bad_point',JSON.stringify(bp.data));
  const nf=await apiCall(r,'POST','/api/media/reels',{requestId:await rid(r),topicId:'7c0000ff-0000-4000-8000-0000000000ff',types:['czym','kto','mit']});check(nf.status===404&&nf.data.code==='not_found','obcy / brak tematu → 404');
  const busy=await apiCall(r,'POST','/api/media/reels',{requestId:await rid(r),topicId:T3,types:['czym','kto','mit']});
  check(busy.status===409&&busy.data.code==='busy'&&busy.data.busy&&busy.data.busy.id===R2&&busy.data.busy.kind==='reels'&&busy.data.busy.topicId===T2&&busy.data.charged===false,'jedno tworzenie naraz → 409 busy {id, kind, topicId}',JSON.stringify(busy.data));
  check(await posts(r,'reels')===7,'MOCK.posts("reels") liczy każde żądanie',await posts(r,'reels'));
  await close(r);}
{const r=await page('mock=msgip&reset=1&media=ready',{settle:1500});
  const id=await rid(r);
  const a=await apiCall(r,'POST','/api/media/reels',{requestId:id,topicId:T2,types:['czym','kto','mit','porownanie','sprawdzian']});
  check(a.status===202&&a.data.media&&a.data.media.id===id&&a.data.media.status==='running'&&a.data.media.progress.step==='plan','202 {media} — status running, krok plan',a.status+' '+JSON.stringify(a.data).slice(0,200));
  const b=await apiCall(r,'POST','/api/media/reels',{requestId:id,topicId:T2,types:['czym','kto','mit']});check(b.status===200&&b.data.media&&b.data.media.id===id,'to samo requestId → 200 ten sam wiersz (bez naliczenia)');
  const me=await apiCall(r,'GET','/api/me');check(me.data.media.used===2&&me.data.media.remaining===1&&me.data.media.busy&&me.data.media.busy.id===id,'naliczone jedno tworzenie; busy = nowe rolki',JSON.stringify(me.data.media));
  const seen=new Set();for(let i=0;i<30;i++){const q=await apiCall(r,'GET','/rest/v1/media?select=id,status,progress&id=eq.'+id);const x=q.data[0];seen.add(x.progress.step);if(x.status==='ready')break;await sleep(250);}
  check(['plan','script','voice','save'].every(s=>seen.has(s))||seen.size>=3,'wiersz idzie plan → script → voice → save',[...seen].join(' → '));
  const fin=(await apiCall(r,'GET','/rest/v1/media?select='+SEL+'&id=eq.'+id)).data[0];
  const man=fin&&fin.manifest;
  check(fin&&fin.status==='ready'&&man&&man.kind==='reels'&&man.v===1&&man.reels.length===5&&man.topicId===T2,'ready: ReelsManifest (5 rolek, topicId)',fin&&fin.status);
  check(man&&man.coverage&&man.coverage.points===8&&man.coverage.covered===8&&man.reels.every(x=>x.quizRef&&x.files&&/^r\d\.json$/.test(x.files.storyboard)&&x.rate===1.15),'manifest: pokrycie 8/8, quizRef, files rN.*, rate 1,15');
  const f=await apiCall(r,'GET',`/storage/v1/object/authenticated/media/${UID}/${id}/r4.json`);check(f.status===200&&f.data.audio.src==='r4.mp3','pliki nowych rolek w buckecie');
  const pod=await apiCall(r,'POST','/api/media/podcast',{requestId:await rid(r),topicId:T3});check(pod.status===202,'podcast 03 → 202 (rolki już gotowe, nie busy)',pod.status+' '+JSON.stringify(pod.data).slice(0,120));
  const lim=await apiCall(r,'POST','/api/media/reels',{requestId:await rid(r),topicId:T3,types:['czym','kto','mit']});
  check(lim.status===409&&lim.data.code==='busy','w trakcie podcastu kolejne tworzenie → busy',lim.status);
  for(let i=0;i<40;i++){const q=await apiCall(r,'GET','/rest/v1/media?select=status&kind=eq.podcast&topic_id=eq.'+T3);if(q.data[0]&&q.data[0].status==='ready')break;await sleep(250);}
  const pm=(await apiCall(r,'GET','/rest/v1/media?select=manifest&kind=eq.podcast&topic_id=eq.'+T3)).data[0].manifest;
  check(pm&&pm.kind==='podcast'&&pm.chapters.length>=6&&pm.chapters.every(c=>c.status==='script'&&c.files===null&&c.pauses.length===1)&&pm.files.script==='script.json','PodcastManifest: rozdziały „script”, bez audio (nagrywane na żądanie), jedna pauza na rozdział');
  const lim2=await apiCall(r,'POST','/api/media/reels',{requestId:await rid(r),topicId:T3,types:['czym','kto','mit']});
  check(lim2.status===402&&lim2.data.code==='limit_reached'&&lim2.data.reason==='lifetime'&&lim2.data.scope==='lifetime'&&lim2.data.used===3&&lim2.data.limit===3&&lim2.data.charged===false,'4. tworzenie na planie free → 402 limit_reached lifetime 3/3',JSON.stringify(lim2.data));
  await close(r);}
{const r=await page('mock=msgip&reset=1&media=ready&mediagen=fail:invalid_output:1',{settle:1500});
  const id=await rid(r);await apiCall(r,'POST','/api/media/reels',{requestId:id,topicId:T2,types:['czym','kto','mit']});
  await sleep(1600);const x=(await apiCall(r,'GET','/rest/v1/media?select=status,error,charged&id=eq.'+id)).data[0];
  const me=(await apiCall(r,'GET','/api/me')).data.media;
  check(x.status==='failed'&&x.charged===false&&/^released:invalid_output/.test(x.error)&&me.remaining===2,'porażka po naszej stronie → failed, charged:false, tworzenie wraca (release_media)',JSON.stringify({x,me}));
  await r.pg.evaluate(()=>MOCK.set('mediagen','fail:refusal:1'));const id2=await rid(r);await apiCall(r,'POST','/api/media/reels',{requestId:id2,topicId:T3,types:['czym','kto','mit']});
  await sleep(1600);const y=(await apiCall(r,'GET','/rest/v1/media?select=status,error,charged&id=eq.'+id2)).data[0];
  check(y.status==='failed'&&y.charged===true&&/^refusal/.test(y.error),'odmowa AI (refusal) → failed, charged:true (fail_media)',JSON.stringify(y));
  await close(r);}
{for(const [q,code,st,extra] of [['mediaerr=limit_reached:daily','limit_reached',402,d=>d.reason==='daily'],['mediaerr=limit_reached:global','limit_reached',402,d=>d.reason==='global'],
    ['mediaerr=limit_reached:month&mplan=pro','limit_reached',402,d=>d.scope==='month'],['mediaerr=tts_unavailable','tts_unavailable',503],['mediaerr=ai_unavailable','ai_unavailable',503],
    ['reels=0','tts_unavailable',503],['nomedia=1','media_unavailable',503],['mediaerr=reserve_failed','reserve_failed',500]]){
    const r=await page('mock=msgip&reset=1&media=ready&'+q,{settle:1200});const x=await apiCall(r,'POST','/api/media/reels',{requestId:await rid(r),topicId:T2,types:['czym','kto','mit']});
    check(x.status===st&&x.data&&x.data.code===code&&x.data.charged===false&&(!extra||extra(x.data)),`${q} → ${st} ${code}, charged:false`,x.status+' '+JSON.stringify(x.data));await close(r);}
  const r=await page('mock=msgip&reset=1&media=ready&voices=0',{settle:1200});
  const x=await r.pg.evaluate(async(t)=>{const C=window.CRAMFOX_CONFIG;const res=await fetch(C.apiUrl.replace(/\/$/,'')+'/api/media/podcast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),topicId:t})});return {status:res.status,data:await res.json()};},T2);
  check(x.status===503&&x.data.code==='voices_missing','voices=0: podcast → 503 voices_missing (jeszcze przed logowaniem)',JSON.stringify(x));
  const me=(await apiCall(r,'GET','/api/me')).data;check(me.features.reels===true&&me.features.podcast===false,'voices=0: features.podcast = false, reels = true');
  await close(r);
  const n=await page('mock=msgip&reset=1&nomedia=1',{settle:1200});const nm=(await apiCall(n,'GET','/api/me')).data;const tb=await apiCall(n,'GET','/rest/v1/media?select=id');
  check(nm.media===null&&nm.chat===null&&nm.features.reels===false&&nm.features.podcast===false&&nm.features.fox===false&&tb.status===404,'nomedia=1: media:null, chat:null, funkcje wyłączone, tabela media nie istnieje (PGRST205)');await close(n);}

section('A. atrapa: POST /api/media/podcast/chapter');
{const r=await page('mock=msgip&reset=1&media=ready',{settle:1500});
  const t0=Date.now();const a=await apiCall(r,'POST','/api/media/podcast/chapter',{mediaId:P1,chapter:2});
  check(a.status===200&&a.data.chapter.status==='ready'&&Date.now()-t0<1200,'rozdział nagrany → 200 od razu (bez syntezy)',a.status);
  const b=await apiCall(r,'POST','/api/media/podcast/chapter',{mediaId:P1,chapter:4});
  check(b.status===200&&b.data.chapter.status==='ready'&&b.data.chapter.files&&b.data.chapter.files.audio==='c4.mp3'&&b.data.chapter.durSec>0,'rozdział 4: synteza → 200 {chapter: ready, files c4.*, durSec}',JSON.stringify(b.data).slice(0,200));
  const tm=await apiCall(r,'GET',`/storage/v1/object/authenticated/media/${UID}/${P1}/c4.json`);
  check(tm.status===200&&tm.data.v===1&&tm.data.lines.length===5&&tm.data.pauses[0].afterLine===1&&tm.data.pauses[0].at<=tm.data.duration,'c4.json: czasy linii ze skryptu, pauza po linijce Szopa');
  const row=(await apiCall(r,'GET','/rest/v1/media?select=manifest&id=eq.'+P1)).data[0].manifest.chapters[3];check(row.status==='ready','wiersz media: rozdział 4 ready (set_podcast_chapter)');
  const nr=await apiCall(r,'POST','/api/media/podcast/chapter',{mediaId:R1,chapter:1});check(nr.status===404,'rolki zamiast podcastu → 404');
  const oor=await apiCall(r,'POST','/api/media/podcast/chapter',{mediaId:P1,chapter:9});check(oor.status===404,'rozdział poza zakresem → 404');
  await r.pg.evaluate(()=>MOCK.set('chapter','busy'));const c=await apiCall(r,'POST','/api/media/podcast/chapter',{mediaId:P1,chapter:5});
  check(c.status===409&&c.data.code==='chapter_busy','chapter=busy → 409 chapter_busy');
  await sleep(5300);const rr=(await apiCall(r,'GET','/rest/v1/media?select=manifest&id=eq.'+P1)).data[0].manifest.chapters[4];check(rr.status==='ready','po ok. 5 s rozdział jest gotowy w wierszu (klient odpytuje co 3 s)',rr.status);
  await r.pg.evaluate(()=>MOCK.set('chapter','err:tts_budget'));const d=await apiCall(r,'POST','/api/media/podcast/chapter',{mediaId:P1,chapter:6});check(d.status===429&&d.data.code==='tts_budget','err:tts_budget → 429');
  await r.pg.evaluate(()=>MOCK.set('chapter','err:synth_failed'));const e=await apiCall(r,'POST','/api/media/podcast/chapter',{mediaId:P1,chapter:6});
  const r6=(await apiCall(r,'GET','/rest/v1/media?select=manifest&id=eq.'+P1)).data[0].manifest.chapters[5];check(e.status===500&&r6.status==='script','err:synth_failed → 500, rozdział wraca do „script”');
  check(await posts(r,'chapter')===7,'MOCK.posts("chapter")',await posts(r,'chapter'));
  await close(r);}
}

if(ONLY!=='A'){
section('B. przygotowanie rolek: jedno stuknięcie = jeden POST, kroki, toast');
{const r=await boot('mock=msgip&reset=1&media=ready&mediagen=slow:8');
  await eng(r,'openSubject',S);await sleep(500);await eng(r,'openMaterial',S,T2);await sleep(700);
  let ok=true;try{await tapText(r,'PRZYGOTUJ',{sel:'button'});}catch(e){ok=false;check(false,'„PRZYGOTUJ” w materiale 02',e.message);}
  if(ok){const t=await bodyText(r);
    check(has(t,'Przygotuj serię rolek')&&/JAKIE ROLKI/i.test(t)&&has(t,'5 wybranych'),'arkusz A: „Przygotuj serię rolek”, „JAKIE ROLKI”, „5 wybranych”');
    check(['Czym to jest','Kto jest kim','Mit czy fakt','Porównanie','Pułapki na egzaminie','Na sprawdzian'].every(s=>has(t,s))&&has(t,'Rolek będzie tyle, ile rodzajów wybierzesz: od 3 do 6.'),'6 rodzajów + „od 3 do 6”');
    check(has(t,'To jedno tworzenie rolek lub podcastu. Zostało: 2 z 3.'),'licznik tylko tu: „To jedno tworzenie rolek lub podcastu. Zostało: 2 z 3.”');
    check(/5 rolek\s*·\s*ok\. 5 min oglądania/.test(norm(t))&&has(t,'Nie teraz'),'podsumowanie „5 rolek · ok. 5 min oglądania”, „Nie teraz”');
    await shot(r,'media-prepare-a');await uiCheck(r,'Przygotuj A');
    // 2 rodzaje → przycisk wyłączony
    await tapText(r,'Czym to jest');await tapText(r,'Kto jest kim');await tapText(r,'Mit czy fakt');
    check(await isDisabled(r,'PRZYGOTUJ ROLKI')===true,'2 rodzaje → „PRZYGOTUJ ROLKI” wyłączony');
    await tapText(r,'Czym to jest');await tapText(r,'Kto jest kim');await tapText(r,'Mit czy fakt');
    await tapText(r,'PRZYGOTUJ ROLKI',{settle:900});
    check(await posts(r,'reels')===1,'jedno stuknięcie = dokładnie jeden POST /api/media/reels',await posts(r,'reels'));
    const jr=await r.pg.evaluate(()=>MOCK.log.filter(e=>e.method==='POST'&&/\/api\/media\/reels/.test(e.path)).map(e=>e.journal));
    check(jr.length===1&&jr[0]===true,'dziennik cf_media_job:<uid> zapisany przed POST (odzyskanie po zerwanym połączeniu)',JSON.stringify(jr));
    await seesText(r,'Przygotowuję rolki',4000);const b=await bodyText(r);
    check(has(b,'Przygotowuję rolki')&&has(b,'Piszę scenariusze')&&/Nagrywam lektora/.test(b)&&has(b,'Składam rolki'),'arkusz B: „Przygotowuję rolki”, kroki „Piszę scenariusze” / „Nagrywam lektora · k z N” / „Składam rolki”');
    check(has(b,'Możesz zamknąć ten ekran')&&/UCZ SIĘ DALEJ/.test(b),'„Możesz zamknąć ten ekran…”, „UCZ SIĘ DALEJ”');
    await sleep(2500);await shot(r,'media-prepare-b');await uiCheck(r,'Przygotuj B');
    // toast żyje kilka sekund: obserwator zapamiętuje go, nawet gdy zniknie między odpytaniami (obciążona maszyna)
    await r.pg.evaluate(()=>{window.__readyToast=false;const f=()=>{if(/Rolki z „Wykład 3.*” są gotowe/.test(document.body.innerText))window.__readyToast=true;};
      new MutationObserver(f).observe(document.body,{subtree:true,childList:true,characterData:true});f();});
    await tapText(r,'UCZ SIĘ DALEJ');
    const toast=await until(r,()=>window.__readyToast===true,null,45000,300);
    check(!!toast,'toast „Rolki z „Wykład 3…” są gotowe. Stuknij, żeby obejrzeć.”');
    check(await posts(r,'reels')===1,'po gotowości nadal jeden POST (bez ponowień)',await posts(r,'reels'));}
  checkRun(r,'przygotowanie');await close(r);}

section('B. błędy i limity: copy, bez automatycznych ponowień');
const errCase=async(q,label,copy,o={})=>{const r=await boot('mock=msgip&reset=1&media=ready&'+q);
  await eng(r,'openSubject',S);await sleep(400);await eng(r,'openMaterial',S,o.topic||T2);await sleep(700);
  try{await tapText(r,'PRZYGOTUJ',{sel:'button'});if(!o.noConfirm&&!(await seesText(r,copy,1200)))await tapText(r,'PRZYGOTUJ ROLKI',{settle:1500});}catch(e){check(false,label+': przyciski',e.message);await close(r);return;}
  const ok=await seesText(r,copy,o.wait||6000);check(ok,label+': „'+copy+'”',(await bodyText(r)).slice(-300));
  if(o.extra)await o.extra(r);
  await sleep(o.after||4000);const n=await posts(r,'reels');check(o.posts!=null?n===o.posts:n<=1,label+': '+(o.posts??'najwyżej 1')+' POST, bez ponawiania',n);
  if(o.shot)await shot(r,o.shot);await uiCheck(r,label);
  if(o.reload){await r.pg.reload({waitUntil:'load'});await sleep(4000);check(await posts(r,'reels')===0,label+': po przeładowaniu żadnego nowego POST');}
  checkRun(r,label);await close(r);};
await errCase('mediaerr=ai_unavailable','503 ai_unavailable (charged:false)','Nie udało się przygotować rolek. To błąd po naszej stronie i nie zużył tworzenia.',{reload:true,shot:'media-err-failed',extra:async r=>{check(/SPRÓBUJ PONOWNIE/i.test(await bodyText(r)),'ręczne „SPRÓBUJ PONOWNIE”');}});
await errCase('mediaerr=limit_reached:daily','limit dzienny','Na dziś to wszystko, co mogę przygotować. Jutro możesz znowu.',{shot:'media-err-daily'});
await errCase('mediaerr=limit_reached:global','limit serwera','Dziś przygotowuję bardzo dużo materiałów. Spróbuj jutro — nic nie zostało zużyte.');
await errCase('mediagen=fail:invalid_output:2','porażka w tle (zwrot)','Nie udało się przygotować rolek. To błąd po naszej stronie i nie zużył tworzenia.',{wait:15000});
await errCase('mediagen=fail:refusal:2','porażka z naliczeniem','Nie udało się przygotować rolek. Ta próba zużyła jedno tworzenie.',{wait:15000});
await errCase('mediaerr=unknown','nieznany wynik (zerwane połączenie)','Nie wiem jeszcze, czy przygotowanie ruszyło. Sprawdzam',{reload:true,shot:'media-err-unknown',after:1500});
{const r=await boot('mock=msgip&reset=1&media=running');
  await eng(r,'openSubject',S);await sleep(400);await eng(r,'openMaterial',S,T3);await sleep(700);
  const t=await bodyText(r);let shown=has(t,'Przygotowuję już coś innego');
  if(!shown){try{await tapText(r,'PRZYGOTUJ',{sel:'button'});await sleep(800);shown=await seesText(r,'Przygotowuję już coś innego',4000);}catch(e){}}
  check(shown,'busy: „Przygotowuję już coś innego (Wykład 3). Gdy skończę, możesz zlecić kolejne.”');
  check(/\(Wykład 3/.test(await bodyText(r)),'busy: nazwa materiału, który się przygotowuje');
  check(await posts(r,'reels')<=1,'busy: najwyżej jeden POST',await posts(r,'reels'));
  await shot(r,'media-busy');checkRun(r,'busy');await close(r);}

section('B. seria rolek → odtwarzacz → pytanie końcowe (D2)');
{const r=await boot('mock=msgip&reset=1');
  const o=await eng(r,'NaukaMedia.openReels',S,T1);check(!missing(o),'NaukaMedia.openReels(sid, topicId)',missing(o));
  await seesText(r,'Kto rządzi światową gospodarką?');const t=await bodyText(r);
  check(/SERIA ROLEK/i.test(t)&&/5 rolek\s*·\s*4:31\s*·\s*obejrzane 2 z 5/.test(norm(t)),'Rolki-Seria: „WYKŁAD 1–2 · SERIA ROLEK”, „5 rolek · 4:31 · obejrzane 2 z 5”');
  check(has(t,'Razem obejmują wszystkie 13 punktów'),'„Razem obejmują wszystkie 13 punktów z wykładu”');
  check(['CZYM TO JEST','KTO JEST KIM','MIT CZY FAKT','PORÓWNANIE','NA SPRAWDZIAN'].every(s=>t.toUpperCase().includes(s)),'chipy rodzajów');
  check(/do poprawy/.test(t)&&/dobrze/.test(t)&&/Następna\s*·\s*0:47/.test(norm(t))&&/Nie ?obejrzana\s*·\s*0:55/i.test(norm(t)),'stany: „pytanie: do poprawy” / „dobrze”, „Następna · 0:47”, „Nieobejrzana · 0:55”');
  check(/OGLĄDAJ DALEJ\s*·\s*ROLKA 3/.test(norm(t)),'„OGLĄDAJ DALEJ · ROLKA 3”');
  await shot(r,'reels-series');await uiCheck(r,'Rolki-Seria');
  const key=S+':'+LID(T1,'l2')+':q2',before=((await progress(r)).srs||{})[key];
  await tapText(r,'OGLĄDAJ DALEJ',{settle:200});
  check(await seesText(r,'Stuknij, żeby zatrzymać',4000),'podpowiedź pauzy przy pierwszym użyciu');
  await sleep(1000);await shot(r,'reels-player');await uiCheck(r,'Rolki-Odtwarzacz');
  const pl=await bodyText(r);check(/3\s*\/\s*5/.test(pl),'odtwarzacz: licznik „3/5”');
  check(['Do powtórki','Wyjaśnij','Następna'].every(s=>has(pl,s)),'akcje boczne: Do powtórki, Wyjaśnij, Następna');
  const q=await seesText(r,'PYTANIE',90000); // ok. 14 s narracji; na obciążonej maszynie (symulatory iOS) zegar audio w headless Chrome bywa kilka razy wolniejszy
  check(q,'po narracji: karta „PYTANIE” (Rolki-Pytanie)',q?'':JSON.stringify(await r.pg.evaluate(()=>{const s=window.NaukaMedia&&NaukaMedia._test.state();return s&&s.PL;}).catch(()=>null)));
  if(q){const qt=await bodyText(r);check(has(qt,'Globalizacja to tylko handel — prawda?'),'pytanie końcowe = istniejące pytanie quizu (quizRef l2#2)');
    await tapText(r,'Nie, obejmuje też politykę, kulturę i finanse',{settle:800});const a=await bodyText(r);
    check(has(a,'Dobrze!')&&/Zapisane do punktu „Globalizacja”/.test(a)&&/w powtórce/.test(a),'„Dobrze!”, „Zapisane do punktu „Globalizacja” · wróci … w powtórce”');
    check(/NASTĘPNA ROLKA\s*·\s*4\/5/.test(norm(a)),'„NASTĘPNA ROLKA · 4/5”');
    await shot(r,'reels-question');await uiCheck(r,'Rolki-Pytanie');
    const P=await progress(r),after=(P.srs||{})[key];
    check(after&&(!before||after.seen===(before.seen|0)+1),'odpowiedź zapisana do SRS pod kluczem '+key,JSON.stringify({before,after}));
    const ms=(P.media||{})[R1]||{};check(Array.isArray(ms.w)&&ms.w.includes(3)&&ms.q&&ms.q['3']===1,'PROGRESS.media: rolka 3 obejrzana (w), pierwsza odpowiedź dobra (q)',JSON.stringify(ms));
    await tapText(r,'NASTĘPNA ROLKA',{settle:1500});check(/4\s*\/\s*5/.test(await bodyText(r)),'następna rolka: „4/5”');
    // przewijanie w górę = następna, w dół = poprzednia
    await r.pg.touchscreen.touchStart(190,600);await r.pg.touchscreen.touchMove(190,380);await r.pg.touchscreen.touchMove(190,200);await r.pg.touchscreen.touchEnd();await sleep(1200);
    check(/5\s*\/\s*5/.test(await bodyText(r)),'przewinięcie w górę → rolka 5/5');
    await r.pg.touchscreen.touchStart(190,200);await r.pg.touchscreen.touchMove(190,420);await r.pg.touchscreen.touchMove(190,620);await r.pg.touchscreen.touchEnd();await sleep(1200);
    check(/4\s*\/\s*5/.test(await bodyText(r)),'przewinięcie w dół → rolka 4/5');
    try{await tapText(r,'Do powtórki',{settle:700});check(/Dodano do powtórki:/.test(await bodyText(r)),'„Do powtórki” → toast „Dodano do powtórki: …”');}catch(e){check(false,'„Do powtórki”',e.message);}
    try{await tapText(r,'Wyjaśnij',{settle:700});check(/Przeczytaj w lekcji \d, część \d/.test(await bodyText(r)),'„Wyjaśnij” → arkusz z częścią lekcji i „Przeczytaj w lekcji N, część M”');await shot(r,'reels-explain');}catch(e){check(false,'„Wyjaśnij”',e.message);}}
  checkRun(r,'rolki');await close(r);}

section('B. podcast: rozdział nagrywany tylko po stuknięciu, pauza z pytaniem, pozycja, mini-odtwarzacz');
{const r=await boot('mock=msgip&reset=1');
  const o=await eng(r,'NaukaMedia.openPodcast',S,T1);check(!missing(o),'NaukaMedia.openPodcast(sid, topicId)',missing(o));
  await seesText(r,'PODCAST Z LISEM');await sleep(800);const t=await bodyText(r);
  check(/PODCAST Z LISEM/i.test(t)&&has(t,'Kto naprawdę rządzi gospodarką świata?')&&/\d+:\d{2}\s*·\s*8 rozdziałów\s*·\s*8 pauz na pytanie/.test(norm(t)),'„PODCAST Z LISEM”, tytuł, „<długość> · 8 rozdziałów · 8 pauz na pytanie” (fixture: krótkie nagrania rozdziałów 1–2, więc nie 26:40)');
  check(/ROZDZIAŁY/i.test(t)&&['Czym są MSGiP','Globalizacja i kryzysy','Handel i inwestycje'].every(s=>has(t,s))&&/z 8/.test(t),'lista rozdziałów (z 8)');
  check(['1,0×','1,25×','1,5×'].every(s=>has(t,s))&&has(t,'Pauzy na pytania'),'tempo „1,0× 1,25× 1,5×” i „Pauzy na pytania”');
  check(has(t,'NA ŻYWO'),'transkrypcja „NA ŻYWO”');
  check(await posts(r,'chapter')===0,'otwarcie odtwarzacza (rozdział 2 już nagrany) nie nagrywa niczego',await posts(r,'chapter'));
  await shot(r,'podcast-player');await uiCheck(r,'Podcast-Odtwarzacz');
  try{await tapText(r,'Handel i inwestycje',{settle:400});
    check(await seesText(r,'Nagrywam rozdział 3',3000),'rozdział 3: „Nagrywam rozdział 3… zwykle ok. 30 s”');
    await sleep(2500);check(await posts(r,'chapter')===1,'stuknięcie rozdziału 3 = jeden POST /api/media/podcast/chapter',await posts(r,'chapter'));}catch(e){check(false,'rozdział 3',e.message);}
  // 3 nieudane nagrania rozdziału dziś (0010: claim → failing) → 429 chapter_failing: komunikat bez „SPRÓBUJ PONOWNIE”, jeden POST
  try{await r.pg.evaluate(()=>MOCK.set('chapter','err:chapter_failing'));const n0=await posts(r,'chapter');
    await eng(r,'NaukaMedia.openPodcast',S,T1,{chapter:6,play:true});
    const seen=await seesText(r,'Tego rozdziału dziś nie nagram',5000);await sleep(800);const ft=await bodyText(r);
    check(seen&&!/SPRÓBUJ PONOWNIE/i.test(ft),'chapter_failing → „Tego rozdziału dziś nie nagram. Spróbuj jutro.” bez „SPRÓBUJ PONOWNIE”');
    check(await posts(r,'chapter')===n0+1,'chapter_failing: jeden POST, bez ponowień',(await posts(r,'chapter'))-n0);
    await r.pg.evaluate(()=>MOCK.set('chapter',''));}catch(e){check(false,'chapter_failing',e.message);}
  // pauza z pytaniem: rozdział 1, przewinięcie tuż przed pauzę
  await eng(r,'NaukaMedia.openPodcast',S,T1,{chapter:1,play:true});await sleep(1500);
  const seek=await r.pg.evaluate(at=>{const a=document.querySelector('audio');if(!a)return false;a.currentTime=Math.max(0,at-1.2);a.play&&a.play().catch(()=>{});return true;},C1.pauses[0].at);
  check(seek,'jeden element <audio> (poza #app) do odtwarzania');
  const pz=await seesText(r,'PAUZA NA PYTANIE',12000);check(pz,'pauza: „PAUZA NA PYTANIE” po linijce Szopa');
  if(pz){const pt=await bodyText(r);check(has(pt,'Szop twierdzi, że MSG i MSP to to samo')&&has(pt,'Pomiń')&&/Odpowiedź zapisze się do punktu „MSG a MSP”/.test(pt),'„lead” Szopa, „Pomiń”, „Odpowiedź zapisze się do punktu „MSG a MSP”.”');
    check(await isDisabled(r,'SŁUCHAJ DALEJ')===true,'„SŁUCHAJ DALEJ” wyłączony do odpowiedzi');
    check(!/POWIEDZ ODPOWIEDŹ/i.test(pt),'bez „POWIEDZ ODPOWIEDŹ” (głos później)');
    await shot(r,'podcast-pause');await uiCheck(r,'Podcast-Pauza');
    const key=S+':'+LID(T1,'l1')+':q1',before=((await progress(r)).srs||{})[key];
    await tapText(r,'MSG dotyczą wymiany gospodarczej, MSP relacji władzy i bezpieczeństwa',{settle:700});
    check(await isDisabled(r,'SŁUCHAJ DALEJ')===false,'po odpowiedzi „SŁUCHAJ DALEJ” aktywny');
    const after=((await progress(r)).srs||{})[key];check(after&&after.seen===((before&&before.seen)|0)+1,'odpowiedź w pauzie zapisana do SRS ('+key+')',JSON.stringify({before,after}));
    await tapText(r,'SŁUCHAJ DALEJ',{settle:1200});}
  await r.pg.evaluate(()=>{const a=document.querySelector('audio');if(a)a.pause();});await sleep(600);
  const pm=((await progress(r)).media||{})[P1]||{};check(/^1:\d+$/.test(pm.cp||'')&&+pm.cp.split(':')[1]>0&&pm.ch===undefined&&pm.pos===undefined,'pozycja zapisana przy pauzie jako jedna wartość (PROGRESS.media.cp = „rozdział:sekunda”)',JSON.stringify(pm));
  try{await tapText(r,'Zwiń',{settle:800});await r.pg.evaluate(()=>NaukaEngine.go('today'));await sleep(900);
    const mt=await bodyText(r);check(has(mt,'Lis i Szop')&&/Rozdział \d z 8/.test(mt),'mini-odtwarzacz na Dziś: „Lis i Szop · Rozdział N z 8”');
    const mini=await eng(r,'NaukaMedia.miniPlayer');check(mini!==null,'NaukaMedia.miniPlayer() zwraca element');
    await shot(r,'podcast-mini');}catch(e){check(false,'mini-odtwarzacz',e.message);}
  checkRun(r,'podcast');await close(r);}

section('B. usunięcie konta kasuje pliki z bucketu media');
{const r=await boot('mock=msgip&reset=1');
  const before=(await r.pg.evaluate(()=>MOCK.mobjects())).filter(k=>k.startsWith(MS.UID+'/')).length;
  const del=await engAsync(r,'NAUKA_CLOUD.deleteAccount');
  const left=(await r.pg.evaluate(()=>MOCK.mobjects())).filter(k=>k.startsWith(MS.UID+'/')).length;
  check(before>10&&!missing(del)&&left===0,'deleteAccount(): wszystkie pliki rolek i podcastu usunięte z bucketu media przed RPC',JSON.stringify({before,left,del}));
  const rows=await r.pg.evaluate(()=>MOCK.media().length);check(rows===0,'wiersze media znikają kaskadą z kontem');
  await close(r);}
{const r=await boot('mock=msgip&reset=1');
  // plik bez wiersza media (przerwane sprzątanie po usunięciu materiału): delete_my_account z 0010 odmówiłby (files_remaining) — apka kasuje cały folder {uid}/
  const orphan=MS.UID+'/0d0d0d0d-0000-4000-8000-00000000000d/r1.mp3';
  await r.pg.evaluate(k=>{MOCK.db().mobjects[k]=MOCK.db().mobjects[Object.keys(MOCK.db().mobjects)[0]];MOCK.save();},orphan);
  const del=await engAsync(r,'NAUKA_CLOUD.deleteAccount');
  const left=(await r.pg.evaluate(()=>MOCK.mobjects())).filter(k=>k.startsWith(MS.UID+'/'));
  check(!missing(del)&&!left.length,'deleteAccount(): także osierocone pliki w buckecie media (bez wiersza) — inaczej files_remaining',JSON.stringify({left,del}));
  await close(r);}
{const r=await boot('mock=msgip&reset=1');
  // usunięcie materiału: najpierw wiersze w bazie, pliki dopiero potem (zerwany DELETE nie zostawia gotowych mediów bez plików)
  const before=(await r.pg.evaluate(()=>MOCK.mobjects())).filter(k=>k.includes('/'+MS.R1+'/')).length;
  await r.pg.evaluate(()=>MOCK.set('fail','topics')); // DELETE topics → 500 (zerwane usunięcie po liście plików)
  const failed=await r.pg.evaluate(async t=>{try{await NAUKA_CLOUD.deleteTopic(t);return 'ok';}catch(e){return String(e&&e.code||e);}},MS.T1);
  await r.pg.evaluate(()=>{MOCK.set('fail','');MOCK.cfg.fail=[];});
  const after=(await r.pg.evaluate(()=>MOCK.mobjects())).filter(k=>k.includes('/'+MS.R1+'/')).length;
  check(failed!=='ok'&&before>0&&after===before,'deleteTopic, gdy DELETE w bazie się nie uda: pliki rolek zostają (nic nie skasowane przed wierszami)',JSON.stringify({failed,before,after}));
  const ok=await r.pg.evaluate(async t=>{try{await NAUKA_CLOUD.deleteTopic(t);return 'ok';}catch(e){return String(e&&e.code||e);}},MS.T1);await sleep(800);
  const gone=(await r.pg.evaluate(()=>MOCK.mobjects())).filter(k=>k.includes('/'+MS.R1+'/')).length,rows=await r.pg.evaluate(r1=>MOCK.media().some(m=>m.id===r1),MS.R1);
  check(ok==='ok'&&!gone&&!rows,'deleteTopic: wiersz media (kaskada) i jego pliki usunięte',JSON.stringify({ok,gone,rows}));
  await close(r);}
}

await done();
