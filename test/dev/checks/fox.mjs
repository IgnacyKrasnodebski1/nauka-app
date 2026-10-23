#!/usr/bin/env node
/* ============================================================ CRAMFOX — kontrola: rozmowa z lisem (docs/plan-media.md §0.3, §2.6, §6.4; spec §5.10–5.12)
   A) kontrakt atrapy POST /api/fox: walidacja, licznik wiadomości (reserve_chat / release_chat), tury liczone przez serwer
      (Wytłumacz: start → feedback + dopytanie → koniec; Przepytaj: 5 pytań → wynik; Egzamin: 3 pytania z dopytaniem → pct), błędy;
   B) apka: Lis-Tryby (zakres, 3 tryby, „KTÓRY PUNKT?” tylko dla „Wytłumacz mi”, „Odpowiadasz, pisząc.”, linia limitu tylko przy ≤ 10, przy 0 przycisk wyłączony),
      Wytłumacz mi (feedback DOBRZE / LUKA / POMYŁKA, „Przeczytaj w lekcji 3, część 2”, „Podpowiedz” / „Nie wiem”, bez mikrofonu), błędy bez ponawiania,
      Egzamin ustny: ocena w skali przedmiotu (gradeFor/gradeScale: „4 dobry”, pasek 2–5), PYTANIA, DO POPRAWY („OBEJRZYJ ROLKĘ k/N” albo „ZRÓB ROLKĘ Z TEGO”,
      „DODAJ DO POWTÓRKI” ↔ „W POWTÓRCE”), zapis PROGRESS.fox / oral.
   Użycie (z test/): node dev/checks/fox.mjs [--out KATALOG] [--only A|B] */
import {start,close,check,section,done,shot,sleep,page,boot,apiCall,eng,missing,until,bodyText,norm,seesText,tapText,isDisabled,uiCheck,checkRun,posts,MS,LID,PID} from './cloud-lib.mjs';

const {S,T1,T2,UID}=MS;
const argv=process.argv.slice(2),ONLY=argv.includes('--only')?argv[argv.indexOf('--only')+1]:'';
const has=(t,s)=>norm(t).toLowerCase().includes(norm(s).toLowerCase());
const progress=r=>r.pg.evaluate(u=>{try{return JSON.parse(localStorage.getItem('nauka_progress_v1:'+u)||'{}');}catch(e){return {};}},UID);
/* czekaj, aż lis odpowie (na obciążonej maszynie odpowiedź atrapy przychodzi później niż stała przerwa — wtedy następna odpowiedź by przepadła) */
const idle=r=>r.pg.waitForFunction(()=>{const s=window.NaukaMedia&&NaukaMedia._test&&NaukaMedia._test.state();const c=s&&s.FX&&s.FX.chat;return !c||!c.busy;},{timeout:30000,polling:200}).catch(()=>{});
const LONG=['MSG to gospodarka ponad granicami, a MSP to polityka, władza i bezpieczeństwo.','Na przykład sankcje gospodarcze łączą jedno i drugie wyraźnie.',
  'Pożycza.','Buduje drogi.','Tak, korporacja wpływa na politykę państw przez inwestycje i lobbing.','Np. Apple.'];

await start();

if(ONLY!=='B'){
section('A. atrapa: POST /api/fox');
{const r=await page('mock=msgip&reset=1',{settle:1500});
  const P=T1+':p9',base={subjectId:S,topicIds:[T1]};
  const fox=b=>apiCall(r,'POST','/api/fox',{...base,...b});
  const bad=async(b,label,code='bad_request')=>{const x=await fox(b);check(x.status===400&&x.data.code===code&&x.data.charged===false,label+' ('+code+')',x.status+' '+JSON.stringify(x.data));};
  await bad({mode:'explain',step:'start',messages:[]},'„Wytłumacz mi” bez punktu → 400');
  await bad({pointIds:[P,T1+':p8'],mode:'explain',step:'start',messages:[]},'„Wytłumacz mi” z 2 punktami → 400');
  await bad({mode:'debate',step:'start',messages:[]},'nieznany tryb → 400');
  await bad({mode:'quiz',step:'answer',messages:[]},'„answer” bez wiadomości użytkownika → 400','bad_step');
  await bad({mode:'quiz',step:'start',messages:Array(31).fill({role:'user',text:'x'})},'> 30 wiadomości → 400');
  await bad({mode:'quiz',step:'start',messages:[{role:'user',text:'x'.repeat(1501)}]},'wiadomość > 1500 znaków → 400');
  await bad({pointIds:[T1+':p99'],mode:'explain',step:'start',messages:[]},'nieznany punkt → 400','bad_point');
  await bad({mode:'quiz',step:'start',messages:[{role:'fox',text:'Pytanie 1 z 5: …'},{role:'user',text:'Odpowiedź'}]},'„start” w trwającej rozmowie → 400','bad_step');
  await bad({pointIds:[P],mode:'explain',step:'answer',messages:[{role:'fox',text:'a'},{role:'user',text:'b'},{role:'fox',text:'c'},{role:'user',text:'d'},{role:'fox',text:'e'},{role:'user',text:'f'}]},'„Wytłumacz mi” po końcu → 400','too_many_turns');
  {const lx=await fox({mode:'quiz',step:'finish',messages:[]});check(lx.status===200&&lx.data.next==='end'&&!lx.data.result,'„finish” przed pierwszą odpowiedzią → koniec bez AI',JSON.stringify(lx.data));}
  const nf=await apiCall(r,'POST','/api/fox',{subjectId:S,topicIds:['7c0000ff-0000-4000-8000-0000000000ff'],mode:'quiz',step:'start',messages:[]});check(nf.status===404,'cudzy temat → 404',nf.status);
  const me0=(await apiCall(r,'GET','/api/me')).data.chat;check(me0.used===0,'odrzucone przed rezerwacją nie zużywają wiadomości',JSON.stringify(me0));
  let msgs=[];let x=await fox({pointIds:[P],mode:'explain',step:'start',messages:[]});
  check(x.status===200&&/czym zajmuje się MFW/.test(x.data.reply+' '+(x.data.question&&x.data.question.text))&&x.data.pointId===P&&x.data.quota&&x.data.quota.used===1&&x.data.quota.remaining===29,'explain start: prośba o wyjaśnienie punktu, quota w odpowiedzi',JSON.stringify(x.data));
  msgs.push({role:'fox',text:x.data.question.text},{role:'user',text:'MFW to organizacja, która pożycza pieniądze krajom w kryzysie i pilnuje kursów walut.'});
  x=await fox({pointIds:[P],mode:'explain',step:'answer',messages:msgs});
  const fb=x.data.feedback||{};
  check(x.data.next==='followup'&&fb.good&&fb.good.length&&fb.gap.length&&fb.wrong.length&&fb.source&&fb.source.topicId===T1&&fb.source.level==='l3'&&fb.source.feed===1&&x.data.question&&/Czego MFW zwykle oczekuje/.test(x.data.question.text),'1. odpowiedź: feedback (dobrze / luka / pomyłka + źródło l3 część 2) i dopytanie',JSON.stringify(x.data).slice(0,300));
  msgs.push({role:'fox',text:x.data.question.text},{role:'user',text:'Reform, na przykład cięcia deficytu budżetowego.'});
  x=await fox({pointIds:[P],mode:'explain',step:'answer',messages:msgs});check(x.data.next==='end'&&x.data.verdict==='ok','2. odpowiedź: werdykt i koniec (serwer liczy tury)',JSON.stringify(x.data));
  const h=await fox({pointIds:[P],mode:'explain',step:'hint',messages:msgs.slice(0,1)});check(h.data.next==='question'&&!/kwot|MFW pożycza/.test(h.data.reply),'„Podpowiedz” bez odpowiedzi');
  const i=await fox({pointIds:[P],mode:'explain',step:'idk',messages:msgs.slice(0,1)});check(i.data.next==='end'&&i.data.verdict==='wrong','„Nie wiem” → krótkie wyjaśnienie, koniec');
  // przepytaj: 5 pytań
  msgs=[];x=await fox({mode:'quiz',step:'start',messages:[]});check(x.data.question&&x.data.question.n===1,'quiz: pytanie 1 z 5');
  const ansQ=['MSG to gospodarka, MSP to polityka i bezpieczeństwo państw.','Nie wiem','Do MFW, bo pożycza w kryzysie płatniczym.','Handel.','NGO nie zrzesza państw, w przeciwieństwie do ONZ.'];
  for(let k=0;k<5;k++){msgs.push({role:'fox',text:x.data.reply},{role:'user',text:ansQ[k]});x=await fox({mode:'quiz',step:'answer',messages:msgs});
    if(k<4)check(x.data.next==='question'&&x.data.question.n===k+2&&x.data.verdict,`quiz: odpowiedź ${k+1} → werdykt + pytanie ${k+2}`,JSON.stringify(x.data).slice(0,160));}
  check(x.data.next==='finish'&&x.data.result&&x.data.result.score&&x.data.result.score.ok===3&&x.data.result.score.total===5,'quiz: po 5. odpowiedzi wynik 3 z 5',JSON.stringify(x.data.result));
  {const m2=[{role:'fox',text:'P1'},{role:'user',text:'Podpowiedz'},{role:'fox',text:'Podpowiem…'},{role:'user',text:'Nie wiem'}];
    const y=await fox({mode:'quiz',step:'idk',messages:m2});check(y.status===200&&y.data.question&&y.data.question.n===2&&y.data.verdict==='wrong','„Podpowiedz” nie jest odpowiedzią, „Nie wiem” w transkrypcji liczy się raz (jak foxPlan na serwerze)',JSON.stringify(y.data).slice(0,200));}
  // egzamin: 3 pytania × dopytanie
  msgs=[];x=await fox({mode:'exam',step:'start',messages:[]});const seq=[];
  for(const a of LONG){msgs.push({role:'fox',text:x.data.reply},{role:'user',text:a});x=await fox({mode:'exam',step:'answer',messages:msgs});seq.push(x.data.next);}
  check(JSON.stringify(seq)===JSON.stringify(['followup','question','followup','question','followup','finish']),'egzamin: pytanie → dopytanie ×3, potem wynik',seq.join(','));
  const res=x.data.result||{};
  check(res.pct===73&&res.score&&res.score.total===3&&res.perQuestion.map(q=>q.verdict).join(',')==='DOBRZE,PRAWIE,PRAWIE','egzamin: pct 73 (średnia z pytań), werdykty DOBRZE / PRAWIE / PRAWIE',JSON.stringify(res).slice(0,300));
  check(res.gaps&&res.gaps.length===2&&res.gaps[0].pointId===T1+':p9'&&res.gaps[0].level==='l3'&&res.gaps[0].feed===1,'egzamin: luki z punktem i częścią lekcji',JSON.stringify(res.gaps));
  check(!('grade' in res),'serwer zwraca tylko pct — ocenę liczy klient (gradeFor)');
  const me=(await apiCall(r,'GET','/api/me')).data.chat;check(me.used===x.data.quota.used&&me.used===19,'licznik: jedno POST /api/fox = jedna wiadomość',JSON.stringify(me));
  await close(r);}
{const r=await page('mock=msgip&reset=1&chat=1',{settle:1200});
  const a=await apiCall(r,'POST','/api/fox',{subjectId:S,topicIds:[T1],mode:'quiz',step:'start',messages:[]});
  const b=await apiCall(r,'POST','/api/fox',{subjectId:S,topicIds:[T1],mode:'quiz',step:'start',messages:[]});
  check(a.status===200&&a.data.quota.remaining===0&&b.status===402&&b.data.code==='limit_reached'&&b.data.reason==='chat_daily'&&b.data.used===30&&b.data.limit===30,'chat=1: druga wiadomość → 402 limit_reached chat_daily',JSON.stringify(b.data));
  await close(r);}
{for(const [q,st,code,usedAfter] of [['foxerr=ai_unavailable',503,'ai_unavailable',0],['foxerr=fox_failed',500,'fox_failed',0],['foxerr=limit_reached:chat_global',402,'limit_reached',0],['fox=0',503,'ai_unavailable',0],['nomedia=1',503,'media_unavailable',null]]){
    const r=await page('mock=msgip&reset=1&'+q,{settle:1200});const x=await apiCall(r,'POST','/api/fox',{subjectId:S,topicIds:[T1],mode:'quiz',step:'start',messages:[]});
    const me=(await apiCall(r,'GET','/api/me')).data;
    check(x.status===st&&x.data.code===code&&x.data.charged===false&&(usedAfter==null||me.chat.used===usedAfter),`${q} → ${st} ${code}, wiadomość zwrócona (release_chat)`,x.status+' '+JSON.stringify(x.data)+' '+JSON.stringify(me.chat));
    if(q==='fox=0')check(me.features.fox===false,'fox=0: features.fox = false');await close(r);}}
}

if(ONLY!=='A'){
section('B. Lis-Tryby');
{const r=await boot('mock=msgip&reset=1');
  const o=await eng(r,'NaukaMedia.openFox',S,{topicId:T1});check(!missing(o),'NaukaMedia.openFox(sid, {topicId})',missing(o));
  await seesText(r,'Rozmowa z lisem');await sleep(500);const t=await bodyText(r);
  check(has(t,'Wybierz, jak chcesz ćwiczyć. Odpowiadasz własnymi słowami'),'dymek lisa');
  check(/Z CZEGO\?/i.test(t)&&has(t,'Cały przedmiot')&&has(t,'Wykład 1–2')&&has(t,'Wykład 3')&&/Słabe punkty\s*·\s*\d+/.test(t),'Z CZEGO?: przedmiot, materiały, „Słabe punkty · N”');
  check(/TRYB/.test(t)&&has(t,'Wytłumacz mi')&&has(t,'Przepytaj mnie')&&has(t,'Egzamin ustny'),'TRYB: 3 karty');
  check(has(t,'Tłumaczysz punkt własnymi słowami. Lis dopytuje i pokazuje, czego zabrakło.')&&has(t,'Lis zadaje pytania otwarte i ocenia każdą odpowiedź.')&&/ocena w skali 2–5/.test(t),'opisy trybów (skala 2–5 dla studiów)');
  check(/OK\. 5 MIN\s*·\s*JEDEN PUNKT/i.test(norm(t))&&/OK\. 8 MIN\s*·\s*5 PYTAŃ/i.test(norm(t))&&/OK\. 10 MIN\s*·\s*3 PYTANIA/i.test(norm(t)),'meta trybów');
  check(/KTÓRY PUNKT\?/i.test(t)&&/najpierw słabe/.test(t),'„KTÓRY PUNKT?” — „najpierw słabe”');
  const order=['MFW','Zarządzanie kryzysami','MSG a MSP','WTO'].map(s=>norm(t).indexOf(s,norm(t).indexOf('KTÓRY PUNKT')));
  check(order.every(x=>x>0),'punkty najsłabsze najpierw (R, potem W)',JSON.stringify(order));
  check(has(t,'Odpowiadasz, pisząc.')&&!has(t,'Możesz też mówić'),'notka „Odpowiadasz, pisząc.” (bez mikrofonu)');
  check(!/Dziś możesz wysłać lisowi/.test(t),'linia limitu ukryta przy > 10 wiadomościach');
  check(/ZACZNIJ ROZMOWĘ/.test(t),'„ZACZNIJ ROZMOWĘ”');
  await shot(r,'fox-modes');await uiCheck(r,'Lis-Tryby');
  try{await tapText(r,'Przepytaj mnie');await sleep(300);check(!/KTÓRY PUNKT\?/i.test(await bodyText(r)),'„KTÓRY PUNKT?” tylko dla „Wytłumacz mi”');}catch(e){check(false,'wybór trybu',e.message);}
  checkRun(r,'Lis-Tryby');await close(r);}
{const r=await boot('mock=msgip&reset=1&chat=5');await eng(r,'NaukaMedia.openFox',S,{topicId:T1});await sleep(900);
  check(has(await bodyText(r),'Dziś możesz wysłać lisowi jeszcze 5 wiadomości.'),'chat=5: „Dziś możesz wysłać lisowi jeszcze 5 wiadomości.”');await close(r);}
{const r=await boot('mock=msgip&reset=1&chat=0');await eng(r,'NaukaMedia.openFox',S,{topicId:T1});await sleep(900);
  check(has(await bodyText(r),'Na dziś to wszystkie rozmowy. Jutro możesz znowu.')&&await isDisabled(r,'ZACZNIJ ROZMOWĘ')===true,'chat=0: „Na dziś to wszystkie rozmowy…”, przycisk wyłączony');
  await shot(r,'fox-modes-chat0');check(await posts(r,'fox')===0,'chat=0: żadnego POST /api/fox');await close(r);}

section('B. Wytłumacz mi (MFW)');
{const r=await boot('mock=msgip&reset=1');
  await eng(r,'NaukaMedia.openFox',S,{topicId:T1,mode:'explain',pointId:PID(T1,'p9')});await sleep(700);
  const srs0=JSON.stringify((await progress(r)).srs||{});
  try{await tapText(r,'ZACZNIJ ROZMOWĘ',{settle:1500});
    check(await seesText(r,'czym zajmuje się MFW',5000),'lis prosi o wyjaśnienie punktu');
    const t=await bodyText(r);check(has(t,'Wytłumacz mi')&&/MFW\s*·\s*Wykład 1–2/.test(norm(t))&&has(t,'Zakończ'),'górny pasek: „Wytłumacz mi”, „MFW · Wykład 1–2”, „Zakończ”');
    check(has(t,'Podpowiedz')&&has(t,'Nie wiem'),'szybkie chipy „Podpowiedz”, „Nie wiem”');
    const inp=await r.pg.$('textarea, input[type="text"], input:not([type])');check(!!inp,'pole „Napisz odpowiedź…”');
    if(inp){await inp.type('MFW to organizacja, która pożycza pieniądze krajom w kryzysie i pilnuje kursów walut. Finansuje też drogi i szkoły w biednych krajach.');
      const send=await r.pg.$('button[aria-label*="Wyślij"], button[aria-label*="wyślij"]');if(send)await send.evaluate(b=>b.click());else await r.pg.keyboard.press('Enter');
      const fb=await seesText(r,'POMYŁKA',8000);const a=await bodyText(r);
      check(fb&&/DOBRZE/.test(a)&&/LUKA/.test(a)&&/POMYŁKA/.test(a),'karta feedbacku: DOBRZE / LUKA / POMYŁKA');
      check(has(a,'Przeczytaj w lekcji 3, część 2'),'źródło: „Przeczytaj w lekcji 3, część 2”');
      check(has(a,'Czego MFW zwykle oczekuje w zamian?'),'dopytanie lisa');
      check(await posts(r,'fox')===2,'2 wiadomości = 2 POST /api/fox',await posts(r,'fox'));
      const inp2=await r.pg.$('textarea, input[type="text"], input:not([type])');if(inp2){await inp2.click({clickCount:3});await inp2.type('W zamian MFW oczekuje reform, na przykład ograniczenia deficytu budżetowego.');
        const send2=await r.pg.$('button[aria-label*="Wyślij"], button[aria-label*="wyślij"]');if(send2)await send2.evaluate(b=>b.click());else await r.pg.keyboard.press('Enter');await sleep(1800);}
      check(await posts(r,'fox')===3,'dopytanie → 3. POST, potem koniec rozmowy (serwer liczy tury)',await posts(r,'fox'));
      await shot(r,'fox-explain-end');
      const P=await progress(r),k=S+':'+PID(T1,'p9');
      check(P.oral&&P.oral[k]&&P.oral[k].ok===true&&P.oral[k].at,'koniec „Wytłumacz mi” z dobrą odpowiedzią → PROGRESS.oral["sid:pid"] = {at, ok:true} (markOral)',JSON.stringify(P.oral||null));
      check(JSON.stringify(P.srs||{})===srs0,'rozmowa z lisem nie zapisuje SRS (plan §0.3)');
      await shot(r,'fox-explain');await uiCheck(r,'Lis-Wytłumacz');}}
  catch(e){check(false,'Wytłumacz mi',e.message);}
  checkRun(r,'Wytłumacz');await close(r);}
{const r=await boot('mock=msgip&reset=1&foxerr=ai_unavailable');
  await eng(r,'NaukaMedia.openFox',S,{topicId:T1,mode:'explain',pointId:PID(T1,'p9')});await sleep(700);
  try{await tapText(r,'ZACZNIJ ROZMOWĘ',{settle:2500});const t=await bodyText(r);
    check(/po naszej stronie|nie odpowiedział|Spróbuj/i.test(t),'błąd AI: uczciwy komunikat',t.slice(-200));
    await sleep(4000);check(await posts(r,'fox')===1,'błąd: jeden POST, bez automatycznego ponawiania',await posts(r,'fox'));
    await shot(r,'fox-error');}catch(e){check(false,'błąd AI',e.message);}
  checkRun(r,'błąd lisa');await close(r);}

section('B. Egzamin ustny: ocena w skali przedmiotu, luki');
{const r=await boot('mock=msgip&reset=1');
  const g=await eng(r,'gradeFor',S,73),sc=await eng(r,'gradeScale',S);
  check(g&&g.label==='4'&&g.name==='dobry','gradeFor(sid, 73) = „4 dobry” (studia)',missing(g)||JSON.stringify(g));
  check(JSON.stringify(sc)==='["2","3","3,5","4","4,5","5"]','gradeScale(sid) = 2 · 3 · 3,5 · 4 · 4,5 · 5',missing(sc)||JSON.stringify(sc));
  await eng(r,'NaukaMedia.openFox',S,{topicId:T1,mode:'exam'});await sleep(700);
  try{await tapText(r,'ZACZNIJ ROZMOWĘ',{settle:1500});
    for(const a of LONG){await idle(r);const inp=await r.pg.$('textarea, input[type="text"], input:not([type])');if(!inp)break;await inp.click({clickCount:3});await inp.type(a);
      const send=await r.pg.$('button[aria-label*="Wyślij"], button[aria-label*="wyślij"]');if(send)await send.evaluate(b=>b.click());else await r.pg.keyboard.press('Enter');await sleep(1300);}
    const res=await seesText(r,'DO POPRAWY',8000);const t=await bodyText(r);
    check(res&&/EGZAMIN USTNY\s*·\s*WYKŁAD 1–2/i.test(norm(t)),'wynik: „EGZAMIN USTNY · WYKŁAD 1–2”');
    check(/\b4\b/.test(t)&&has(t,'dobry')&&/3 pytania z dopytaniem/.test(t),'ocena „4 dobry”, „3 pytania z dopytaniem · … min”');
    check(['2','3','3,5','4','4,5','5'].every(x=>new RegExp('(^|\\s)'+x.replace(',','\\,')+'(\\s|$)').test(t)),'pasek skali 2 · 3 · 3,5 · 4 · 4,5 · 5');
    check(/PYTANIA/.test(t)&&has(t,'Czym różnią się MSG od MSP?')&&/DOBRZE/.test(t)&&/PRAWIE/.test(t),'PYTANIA: pytania z werdyktami');
    check(has(t,'MFW a Bank Światowy: kto co robi')&&/Lekcja 3, część 2/.test(t),'DO POPRAWY: luka z „Lekcja 3, część 2”');
    check(/OBEJRZYJ ROLKĘ 2\/5/.test(t),'luka pokryta gotową rolką → „OBEJRZYJ ROLKĘ 2/5”');
    check(/DODAJ DO POWTÓRKI|W POWTÓRCE/.test(t)&&/GOTOWE/.test(t),'„DODAJ DO POWTÓRKI”, „GOTOWE”');
    await shot(r,'fox-exam-result');await uiCheck(r,'Lis-Egzamin');
    if(/DODAJ DO POWTÓRKI/.test(t)){await tapText(r,'DODAJ DO POWTÓRKI',{settle:600});
      check(/W POWTÓRCE/.test(await bodyText(r))&&await eng(r,'isDue',S,PID(T1,'p9'))===true,'„DODAJ DO POWTÓRKI” → „W POWTÓRCE”, punkt na dziś (makeDue / isDue)');}
    const P=await progress(r),fx=(P.fox||{})[T1]||{};
    check(fx.exam&&fx.exam.pct===73&&fx.exam.at,'PROGRESS.fox[topicId].exam = {at, pct}',JSON.stringify(fx));
  }catch(e){check(false,'egzamin ustny',e.message);}
  checkRun(r,'egzamin');await close(r);}
{const r=await boot('mock=msgip&reset=1&media=ready');
  await eng(r,'NaukaMedia.openFox',S,{topicId:T2,mode:'exam'});await sleep(700);
  try{await tapText(r,'ZACZNIJ ROZMOWĘ',{settle:1500});
    for(const a of LONG){await idle(r);const inp=await r.pg.$('textarea, input[type="text"], input:not([type])');if(!inp)break;await inp.click({clickCount:3});await inp.type(a);
      const send=await r.pg.$('button[aria-label*="Wyślij"], button[aria-label*="wyślij"]');if(send)await send.evaluate(b=>b.click());else await r.pg.keyboard.press('Enter');await sleep(1300);}
    await seesText(r,'DO POPRAWY',8000);const t=await bodyText(r);
    check(/ZRÓB ROLKĘ Z TEGO/.test(t),'materiał bez gotowych rolek: „ZRÓB ROLKĘ Z TEGO” (zostały tworzenia)');
    await tapText(r,'ZRÓB ROLKĘ Z TEGO',{settle:800});const s=await bodyText(r);
    check(/Przygotuj rolkę o punkcie „/.test(s)&&has(s,'Zostało: 2 z 3'),'„ZRÓB ROLKĘ Z TEGO” → arkusz pojedynczej rolki z licznikiem',s.slice(-300));
    check(await posts(r,'reels')===0,'samo otwarcie arkusza nie wysyła POST');
    await shot(r,'fox-exam-make-reel');}catch(e){check(false,'„ZRÓB ROLKĘ Z TEGO”',e.message);}
  checkRun(r,'egzamin 02');await close(r);}
}

await done();
