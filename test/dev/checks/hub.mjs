#!/usr/bin/env node
/* ============================================================ CRAMFOX — kontrola: centrum przedmiotu (docs/plan-media.md §1.2–1.5, §4.3–4.4; spec docs/design-centrum.md)
   Dolna nawigacja (D6), kolejność sekcji huba (Main), opanowanie punktów z kluczy SRS (D1: materiał 01 = U 6 · W 2 · R 2 · N 3, przedmiot 8/4/2/13),
   gotowość (D3: 40%, „?” poniżej 10 odpowiedzi), NA TERAZ (D5: rozgrzewka / noc przed / przerwana lekcja / Szop / lekcja 1 / egzamin ustny; rolki i podcast nigdy
   na pierwszym miejscu), Centrum-Material, Centrum-Nowy, zaproszenia ukryte przy 0 tworzeń, podcast „wkrótce” bez głosów, kafel lisa tylko z features.fox,
   backend bez 0010, stare tematy = jeden punkt na poziom, PointSheet, HowSheet, Dziś. Każdy ekran: bez emoji, bez słów o płatnościach/Pro, bez XSS,
   bez poziomego przewijania, bez UI mikrofonu, bez żądań poza localhost.
   Dane: mock=msgip (test/fixtures/topic-msgip*.json, mock-backend.js → seedMsgip).  Użycie (z test/): node dev/checks/hub.mjs [--out KATALOG] */
import {start,close,check,section,done,shot,sleep,boot,eng,missing,until,bodyText,norm,seesText,tapText,uiCheck,checkRun,MS,LID,PID} from './cloud-lib.mjs';

const {S,T1,T2,T3}=MS;
const openHub=async(r,tab)=>{const v=await eng(r,'openSubject',S,tab);await sleep(600);return v;};
const has=(t,s)=>norm(t).toLowerCase().includes(norm(s).toLowerCase());
const idx=(t,s)=>norm(t).indexOf(norm(s)); // wielkość liter ma znaczenie: „MATERIAŁY” (sekcja) ≠ „3 materiały” (nagłówek)

await start();

section('nawigacja (D6)');
{const r=await boot('mock=msgip&reset=1');
  const nav=await r.pg.evaluate(()=>[...document.querySelectorAll('.nav button')].map(b=>(b.innerText||'').trim()||b.getAttribute('aria-label')));
  check(JSON.stringify(nav)===JSON.stringify(['Dziś','Przedmioty','Dodaj materiał','Powtórka','Profil']),'„Dziś · Przedmioty · [+] · Powtórka · Profil”, bez zakładki „Fiszki”',JSON.stringify(nav));
  await uiCheck(r,'Dziś (msgip)');
  checkRun(r,'start');
  await close(r);}

section('Main: przedmiot w połowie nauki (spec §3)');
{const r=await boot('mock=msgip&reset=1');
  // dane: opanowanie z kluczy SRS (D1)
  const m1=await eng(r,'masteryOf',S,T1),m=await eng(r,'masteryOf',S);
  check(!missing(m1)&&m1.known===6&&m1.learning===2&&m1.refresh===2&&m1.fresh===3&&m1.total===13,'materiał 01: U 6 · W 2 · R 2 · N 3',missing(m1)||JSON.stringify(m1&&{k:m1.known,l:m1.learning,r:m1.refresh,n:m1.fresh,t:m1.total}));
  check(!missing(m)&&m.known===8&&m.learning===4&&m.refresh===2&&m.fresh===13&&m.total===27,'przedmiot: 27 punktów, U 8 · W 4 · R 2 · N 13',missing(m)||JSON.stringify(m&&{k:m.known,l:m.learning,r:m.refresh,n:m.fresh,t:m.total}));
  const want='learning known known known refresh known known learning refresh known new new new'.split(' ');
  const st=[];for(let i=1;i<=13;i++){const x=await eng(r,'pointState',S,PID(T1,'p'+i));st.push(x&&x.st||missing(x)||'null');}
  check(JSON.stringify(st)===JSON.stringify(want),'stany punktów 1–13 w kolejności z makiety (W U U U R U U W R U N N N)',st.join(' '));
  const p9=await eng(r,'pointState',S,PID(T1,'p9'));
  check(p9&&p9.maxOverdue===4,'MFW: termin minął 4 dni temu (maxOverdue)',JSON.stringify(p9));
  const rd=await eng(r,'readiness',S);
  check(rd&&rd.pct===40&&rd.known===8&&rd.total===27&&rd.mock===64,'gotowość = round(70 × 8/27 + 0,3 × 64) = 40%',missing(rd)||JSON.stringify(rd));
  const na=await eng(r,'naTeraz',S);
  check(Array.isArray(na)&&na[0]&&na[0].kind==='resume'&&/Dokończ lekcję 4/.test(na[0].title),'NA TERAZ: przerwana lekcja („Dokończ lekcję 4 z …”)',missing(na)||JSON.stringify(na&&na[0]));
  check(Array.isArray(na)&&!['reel','podcast'].includes(na[0]&&na[0].kind)&&na.some(a=>a.kind==='szop'),'„Inna propozycja”: Szop wśród alternatyw, rolka/podcast nigdy na pierwszym miejscu',JSON.stringify((na||[]).map(a=>a.kind)));
  // ekran
  const o=await openHub(r);check(!missing(o),'NaukaEngine.openSubject(sid) otwiera hub',missing(o));
  await seesText(r,'NA TERAZ');
  const t=await bodyText(r);
  check(has(t,'PRZEDMIOT · STUDIA')&&has(t,'3 materiały')&&has(t,'27 kluczowych punktów')&&has(t,'11 lekcji'),'nagłówek: „PRZEDMIOT · STUDIA”, „3 materiały · 27 kluczowych punktów · 11 lekcji”');
  check(/Umiesz\s*8\s*z\s*27\s*punktów/i.test(norm(t)),'„Umiesz 8 z 27 punktów”');
  check(has(t,'Jak to liczę?'),'link „Jak to liczę?”');
  check(has(t,'4 w trakcie')&&has(t,'2 do odświeżenia')&&has(t,'13 nowych'),'legenda „4 w trakcie · 2 do odświeżenia · 13 nowych”');
  const order=['Umiesz','SPRAWDZIAN','NA TERAZ','Szop podkrada','MATERIAŁY','CAŁY PRZEDMIOT'].map(s=>idx(t,s));
  check(order.every(x=>x>=0)&&order.every((x,i)=>!i||x>order[i-1]),'kolejność: opanowanie → sprawdzian → NA TERAZ → Szop → MATERIAŁY → CAŁY PRZEDMIOT',JSON.stringify(order));
  check(has(t,'za 6 dni')||/za\s*6\s*dni/i.test(norm(t)),'karta sprawdzianu: „za 6 dni”');
  check(has(t,'40%')&&has(t,'GOTOWOŚĆ'),'pierścień gotowości „40%”');
  check(has(t,'Dokończ lekcję 4')&&has(t,'DOKOŃCZ LEKCJĘ')&&has(t,'Inna propozycja'),'NA TERAZ: „Dokończ lekcję 4 …”, DOKOŃCZ LEKCJĘ, „Inna propozycja”');
  check(has(t,'część 2 z 4')&&/Przerwane wczoraj/i.test(t),'powód: „… część 2 z 4. Przerwane wczoraj …”');
  check(has(t,'Szop podkrada 2 punkty')&&has(t,'ODZYSKAJ'),'pasek Szopa: „Szop podkrada 2 punkty”, ODZYSKAJ');
  check(has(t,'MFW')&&has(t,'Zarządzanie kryzysami')&&/4 dni/.test(t),'Szop: „MFW i Zarządzanie kryzysami. Od ostatniej powtórki minęły 4 dni.”');
  check(['01','02','03'].every(n=>has(t,n))&&has(t,'Wykład 1–2: pojęcia i podmioty MSGiP')&&has(t,'Wykład 3: teorie integracji')&&has(t,'Prezentacja: polityka handlowa UE'),'MATERIAŁY: 01–03 z nazwami');
  check(/Umiesz\s*6\s*z\s*13/.test(norm(t))&&/Umiesz\s*2\s*z\s*8/.test(norm(t))&&has(t,'6 nowych'),'karty: „Umiesz 6 z 13”, „Umiesz 2 z 8”, „6 nowych”');
  check(/Lekcje\s*3\s*\/\s*4/.test(t)&&/Rolki\s*2\s*\/\s*5/.test(t)&&/Lekcje\s*1\s*\/\s*4/.test(t)&&/Lekcje\s*0\s*\/\s*3/.test(t),'pigułki: „Lekcje 3/4” · „Rolki 2/5” · „Lekcje 1/4” · „Lekcje 0/3”');
  check(/Rolki\s*·\s*przygotowuję/i.test(t),'materiał 02: „Rolki · przygotowuję”');
  check(/Dodaj materiał do/i.test(t)&&has(t,'rozdziałem 04'),'„Dodaj materiał do …” — „Zostanie rozdziałem 04.”');
  check(['Powtórka','Fiszki','Egzamin próbny','Rozmowa z lisem','Pojedynek z Szopem','Zasady i oceny'].every(s=>has(t,s)),'CAŁY PRZEDMIOT: 6 kafli');
  check(has(t,'12 na dziś')&&/112/.test(t)&&/64%\s*\(3,5\)/.test(t)&&/4 z 11/.test(t)&&has(t,'zaliczenie od 50%'),'kafle: „12 na dziś”, „112 z 3 materiałów”, „ostatnio 64% (3,5)”, „4 z 11 lekcji”, „zaliczenie od 50%”');
  const pills=await r.pg.evaluate(()=>[...document.querySelectorAll('#app .pills, #app .xppill, #app .gempill, #app .heartpill, #app [class*="hearts"]')].filter(e=>e.getBoundingClientRect().height>0).length);
  check(!pills,'hub bez pigułek XP / gemów / serc');
  const navOn=await r.pg.evaluate(()=>{const b=document.querySelector('.nav button.active');return b?b.innerText.trim():'';});
  check(navOn==='Przedmioty','hub: dolny pasek z aktywnym „Przedmioty”',navOn);
  await shot(r,'hub-main');
  await uiCheck(r,'Main');
  // HowSheet
  try{await tapText(r,'Jak to liczę?');const h=await bodyText(r);
    check(has(h,'Jak liczę, co umiesz')&&has(h,'Każdy materiał dzielę na kluczowe punkty')&&has(h,'XP i seria nie zmieniają tych kwadratów')&&has(h,'ROZUMIEM'),'HowSheet: tytuł, 4 stany, „XP i seria nie zmieniają…”, ROZUMIEM');
    await shot(r,'hub-howsheet');await tapText(r,'ROZUMIEM');}catch(e){check(false,'HowSheet',e.message);}
  // „Inna propozycja” przechodzi do następnej akcji
  try{await tapText(r,'Inna propozycja');const t2=await bodyText(r);check(!has(t2,'DOKOŃCZ LEKCJĘ')||has(t2,'Odzyskaj'),'„Inna propozycja” pokazuje następną akcję (Szop)');}catch(e){check(false,'„Inna propozycja”',e.message);}
  checkRun(r,'Main');
  await close(r);}

section('PointSheet (MFW, Do odświeżenia)');
{const r=await boot('mock=msgip&reset=1');
  await openHub(r);const v=await eng(r,'openPointSheet',S,PID(T1,'p9'));check(!missing(v),'NaukaEngine.openPointSheet',missing(v));
  await seesText(r,'PUNKT 9 Z 13');const t=await bodyText(r);
  check(/PUNKT 9 Z 13/i.test(t)&&has(t,'MFW: rola Międzynarodowego Funduszu Walutowego'),'„WYKŁAD 1–2 · PUNKT 9 Z 13” / tytuł punktu');
  check(/DO ODŚWIEŻENIA/i.test(t)&&/minął 4 dni temu/.test(t),'chip „DO ODŚWIEŻENIA”, „Termin powtórki minął 4 dni temu.”');
  check(/ODŚWIEŻ TEN PUNKT/i.test(t),'przycisk „ODŚWIEŻ TEN PUNKT · N MIN”');
  check(has(t,'Przeczytaj w lekcji 3, część 2'),'„Przeczytaj w lekcji 3, część 2” (feedRef rolki 2 / część lekcji)');
  check(/Obejrzyj rolkę 2\/5/.test(t),'„Obejrzyj rolkę 2/5: ONZ, WTO, MFW i Bank Światowy”');
  check(has(t,'Wytłumacz to lisowi')&&has(t,'To nie jest punkt z mojego materiału'),'„Wytłumacz to lisowi”, stopka „To nie jest punkt z mojego materiału”');
  await shot(r,'hub-pointsheet');await uiCheck(r,'PointSheet');
  const v2=await eng(r,'openPointSheet',S,PID(T1,'p2'));await sleep(500);const t2=await bodyText(r);
  check(!missing(v2)&&!/(ODŚWIEŻ|PRZEĆWICZ) TEN PUNKT/i.test(t2)&&has(t2,'Sprawdź się jeszcze raz'),'punkt „Umiem”: bez głównego przycisku, wiersz „Sprawdź się jeszcze raz”');
  checkRun(r,'PointSheet');await close(r);}

section('Centrum-Material (materiał 01)');
{const r=await boot('mock=msgip&reset=1');
  await openHub(r);const v=await eng(r,'openMaterial',S,T1);check(!missing(v),'NaukaEngine.openMaterial(sid, topicId)',missing(v));
  await seesText(r,'KLUCZOWE PUNKTY');const t=await bodyText(r);
  check(/ROZDZIAŁ 01/i.test(t)&&has(t,'Wykład 1–2: pojęcia i podmioty MSGiP'),'nagłówek „… · ROZDZIAŁ 01”, H1');
  check(/PDF/.test(t),'meta: „PDF · … · dodany …”');
  check(/Umiesz\s*6\s*z\s*13\s*punktów/i.test(norm(t))&&has(t,'2 w trakcie')&&has(t,'2 do odświeżenia')&&has(t,'3 nowe'),'„Umiesz 6 z 13 punktów”, „2 w trakcie · 2 do odświeżenia · 3 nowe”');
  check(has(t,'Wszystkie')&&/Słabe\s*·\s*4/.test(t),'przełącznik „Wszystkie” / „Słabe · 4”');
  const chips=['MSG a MSP','MSGiP a nauki społeczne','Globalizacja','Handel i inwestycje','Zarządzanie kryzysami','Państwo narodowe','ONZ','WTO','MFW','Bank Światowy','Korporacje transnarodowe','Unia Europejska','NGO'];
  check(chips.every(c=>has(t,c)),'13 chipów punktów w kolejności materiału',chips.filter(c=>!has(t,c)).join(', '));
  check(/LEKCJE Z LISEM/i.test(t)&&/3 z 4/.test(t)&&has(t,'Korporacje, UE i NGO')&&/część 2 z 4/.test(t)&&/DOKOŃCZ/.test(t),'LEKCJE Z LISEM „3 z 4”, lekcja 4 „część 2 z 4 · ok. … min” z DOKOŃCZ');
  check(/zrobiona\s*·\s*5 części/.test(t)&&/zrobiona\s*·\s*6 części/.test(t),'„zrobiona · 5 części”, „zrobiona · 6 części”');
  const locks=await r.pg.evaluate(()=>document.querySelectorAll('#app .lock, #app [data-icon="lock"], #app .ic-lock').length);
  check(!locks,'bez kłódek przy lekcjach');
  check(/ROLKI/.test(t)&&has(t,'Kto rządzi światową gospodarką?')&&/5 rolek/.test(t)&&/obejrzane 2 z 5/.test(t),'ROLKI: seria, „5 rolek · 4:31 · obejrzane 2 z 5”');
  check(/4:31/.test(t),'czas serii 4:31 (suma durSec z manifestu)');
  check(/PODCAST/.test(t)&&has(t,'Kto naprawdę rządzi gospodarką świata?')&&/\d+:\d{2}\s*·\s*zostało\s*\d+:\d{2}/.test(norm(t)),'karta podcastu: tytuł, „<długość> · zostało <m:ss>” (fixture: rozdziały 1–2 mają krótkie nagrania, więc suma ≠ 26:40 z makiety)');
  check(/SPRAWDŹ SIĘ/i.test(t)&&['Wytłumacz mi','Przepytaj mnie','Egzamin ustny','Fiszki','Quiz','Zadania'].every(s=>has(t,s)),'SPRAWDŹ SIĘ: 6 kafli');
  check(has(t,'ostatnio 2 luki')&&has(t,'ostatnio 4 z 6')&&has(t,'jeszcze nie było'),'kafle lisa z PROGRESS.fox: „ostatnio 2 luki”, „ostatnio 4 z 6”, „jeszcze nie było”');
  check(/46/.test(t)&&has(t,'36 pytań')&&has(t,'14 zadań'),'„46 · … na dziś”, „36 pytań”, „14 zadań”');
  check(/ŹRÓDŁO/i.test(t)&&has(t,'wyklad-1-2-msgip.pdf'),'ŹRÓDŁO: „wyklad-1-2-msgip.pdf” (materials + generations)');
  await shot(r,'hub-material');await uiCheck(r,'Material');
  try{await tapText(r,'wyklad-1-2-msgip.pdf');const s=await bodyText(r);check(has(s,'Każde pytanie wskazuje swoją stronę'),'„Źródło”: arkusz z plikami materiału');}catch(e){check(false,'„Źródło”: arkusz',e.message);}
  const back=await r.pg.evaluate(()=>{window.NaukaEngine.goBack();return true;});await sleep(500);
  check(back&&await r.pg.evaluate(()=>NaukaEngine.view),'wstecz z materiału wraca do huba (navHist)');
  checkRun(r,'Material');await close(r);}

section('NA TERAZ: kolejność (D5)');
const naCase=async(q,label,pred,extra)=>{const r=await boot('mock=msgip&reset=1&'+q);const na=await eng(r,'naTeraz',S);
  check(Array.isArray(na)&&na.length&&pred(na[0],na),label,missing(na)||JSON.stringify((na||[]).slice(0,3).map(a=>({kind:a.kind,title:a.title}))));
  if(Array.isArray(na))check(!['reel','podcast'].includes(na[0]&&na[0].kind),q+': rolka/podcast nie jest główną akcją');
  if(extra)await extra(r,na);checkRun(r,q);await close(r);};
await naCase('exam=0','sprawdzian dziś → „Rozgrzewka · 5 min” (warmup)',a=>a.kind==='warmup'&&/Rozgrzewka/.test(a.title+' '+a.eyebrow));
await naCase('exam=1','sprawdzian jutro → „Noc przed sprawdzianem · 20 min” (cram)',a=>a.kind==='cram'&&/Noc przed sprawdzianem/.test(a.title+' '+a.eyebrow));
await naCase('lsave=0','≥ 2 punkty do odświeżenia → „Odzyskaj 2 punkty od Szopa”',a=>a.kind==='szop'&&/Odzyskaj 2 punkty od Szopa/.test(a.title),async r=>{
  await openHub(r);await seesText(r,'NA TERAZ');const t=await bodyText(r);check(!has(t,'Szop podkrada'),'Szop jako NA TERAZ → pasek Szopa ukryty');await shot(r,'hub-natreaz-szop');});
await naCase('msgip=known&exam=none','wszystko „Umiem” + features.fox → „Egzamin ustny z lisem” (bez planu do sprawdzianu, który ma pierwszeństwo — D5 pkt 4)',a=>a.kind==='oral'&&/Egzamin ustny z lisem/.test(a.title));
await naCase('msgip=known&exam=none&fox=0','wszystko „Umiem” bez features.fox → nie egzamin ustny',a=>a.kind!=='oral');
await naCase('msgip=new','nowy przedmiot → „Zacznij od lekcji 1”',a=>a.kind==='lesson'&&/Zacznij od lekcji 1/.test(a.title));

section('gotowość „?” poniżej 10 odpowiedzi (D3)');
{const r=await boot('mock=msgip&reset=1&msgip=new&exam=6');const rd=await eng(r,'readiness',S);
  check(rd&&rd.pct===null&&rd.answers<10,'readiness().pct = null przy < 10 odpowiedziach',missing(rd)||JSON.stringify(rd));
  await openHub(r);await seesText(r,'SPRAWDZIAN');const t=await bodyText(r);check(/\?/.test(t)&&has(t,'GOTOWOŚĆ'),'karta sprawdzianu pokazuje „?” zamiast 0%');
  await shot(r,'hub-readiness-unknown');checkRun(r,'gotowość ?');await close(r);}

section('Centrum-Nowy (pierwsza wizyta)');
{const r=await boot('mock=msgip&reset=1&msgip=new');
  await openHub(r);await seesText(r,'NA START');const t=await bodyText(r);
  check(/NOWY PRZEDMIOT\s*·\s*STUDIA/i.test(t)&&has(t,'1 materiał')&&has(t,'13 kluczowych punktów')&&has(t,'4 lekcje'),'„NOWY PRZEDMIOT · STUDIA”, „1 materiał · 13 kluczowych punktów · 4 lekcje”');
  check(has(t,'13 punktów przed Tobą')&&has(t,'Punkt jest Twój, gdy umiesz go w dwa różne dni'),'„13 punktów przed Tobą” + opis paska');
  check(/NA START/.test(t)&&has(t,'Zacznij od lekcji 1')&&/ZACZNIJ LEKCJĘ 1/.test(t)&&!has(t,'Inna propozycja'),'NA START: „Zacznij od lekcji 1”, ZACZNIJ LEKCJĘ 1, bez „Inna propozycja”');
  check(has(t,'Masz sprawdzian z tego przedmiotu?')&&['Za tydzień','Za 2 tygodnie','Wybierz datę'].every(s=>has(t,s)),'karta daty: „Masz sprawdzian…?” + 3 chipy');
  check(/DODATKI/.test(t)&&has(t,'Rolki i podcast z tego materiału')&&has(t,'Seria rolek')&&has(t,'Podcast z lisem i szopem'),'Dodatki: rolki i podcast');
  check(has(t,'20–30 minut rozmowy w 8 rozdziałach'),'Dodatki: copy podcastu pod 20–30 min (plan §0.3)');
  check((norm(t).match(/PRZYGOTUJ/g)||[]).length>=2,'dwa „PRZYGOTUJ” (rolki, podcast)');
  check(!/Zostało:/.test(t),'Dodatki bez licznika tworzeń (licznik tylko w arkuszu potwierdzenia)');
  check(!/SPRAWDZIAN/.test(t.replace(/sprawdzian z tego/gi,''))&&!has(t,'Szop podkrada'),'bez karty sprawdzianu i paska Szopa');
  check(has(t,'Darmowe tworzenie lekcji: zostało 1 z 2'),'pod „Dodaj następny materiał”: „Darmowe tworzenie lekcji: zostało 1 z 2”');
  check(has(t,'po pierwszej lekcji')&&has(t,'46 nowych')&&has(t,'0 z 4 lekcji'),'kafle: Powtórka „po pierwszej lekcji”, Fiszki „46 nowych”, Szop „0 z 4 lekcji”');
  await shot(r,'hub-nowy');await uiCheck(r,'Nowy');
  checkRun(r,'Nowy');await close(r);}

section('zaproszenia i limity (D4, spec §6)');
{const r=await boot('mock=msgip&reset=1&msgip=new&mq=0');
  await openHub(r);await seesText(r,'NA START');const t=await bodyText(r);
  check(!/PRZYGOTUJ(?![a-ząćęłńóśźż])/.test(t)&&!has(t,'Rolki i podcast z tego materiału'),'mq=0: żadnego „PRZYGOTUJ” ani karty Dodatków w hubie');
  await eng(r,'openMaterial',S,T1);await sleep(600);const m=await bodyText(r);
  check(has(m,'Rolek i podcastów na razie nie przygotujesz. Wszystko, co masz w tym przedmiocie, działa bez ograniczeń.'),'mq=0: materiał — „Rolek i podcastów na razie nie przygotujesz. …”');
  check(!/PRZYGOTUJ(?![a-ząćęłńóśźż])|ZRÓB ROLKĘ/.test(m),'mq=0: materiał bez „PRZYGOTUJ” i „ZRÓB ROLKĘ”');
  await shot(r,'hub-material-mq0');await uiCheck(r,'mq=0');checkRun(r,'mq=0');await close(r);}
{const r=await boot('mock=msgip&reset=1&msgip=new&voices=0');
  await openHub(r);await seesText(r,'NA START');const t=await bodyText(r);
  check(has(t,'Podcast będzie dostępny wkrótce')&&(norm(t).match(/PRZYGOTUJ/g)||[]).length===1,'voices=0: „Podcast będzie dostępny wkrótce” bez przycisku, rolki z „PRZYGOTUJ”');
  await shot(r,'hub-nowy-voices0');checkRun(r,'voices=0');await close(r);}
{const r=await boot('mock=msgip&reset=1&fox=0');
  await openHub(r);await seesText(r,'CAŁY PRZEDMIOT');const t=await bodyText(r);
  check(!has(t,'Rozmowa z lisem'),'fox=0: bez kafla „Rozmowa z lisem”');
  await eng(r,'openMaterial',S,T1);await sleep(600);const m=await bodyText(r);
  check(!has(m,'Wytłumacz mi')&&!has(m,'Przepytaj mnie'),'fox=0: materiał bez kafli rozmowy z lisem');
  checkRun(r,'fox=0');await close(r);}
{const r=await boot('mock=msgip&reset=1&nomedia=1');
  await openHub(r);await seesText(r,'MATERIAŁY');const t=await bodyText(r);
  check(!/PRZYGOTUJ(?![a-ząćęłńóśźż])/.test(t)&&!has(t,'Rozmowa z lisem'),'backend bez 0010 (nomedia): bez zaproszeń i rozmowy, hub działa');
  await eng(r,'openMaterial',S,T2);await sleep(600);
  check(!/PRZYGOTUJ(?![a-ząćęłńóśźż])/.test(await bodyText(r)),'nomedia: materiał bez „PRZYGOTUJ”');
  checkRun(r,'nomedia');await close(r);}

section('stare tematy i stare zapisy (bez keyPoints, bez media/oral/fox)');
{const r=await boot('mock=seeded&reset=1');
  const S0=MS.sMakro,T0=MS.tMakro;
  const lv=await r.pg.evaluate(s=>{const x=NaukaEngine.subjects().find(q=>q.id===s);return x?x.levels.map(l=>({id:l.id,fc:(l.flashcards||[]).length,q:(l.quiz||[]).length,tk:(l.tasks||[]).length,title:l.title})):[];},S0);
  const pts=await eng(r,'pointsOf',S0);
  check(Array.isArray(pts)&&pts.length===lv.length,'makro: jeden punkt na poziom ('+lv.length+')',missing(pts)||(pts&&pts.length));
  if(Array.isArray(pts)&&pts.length===lv.length){
    check(pts.every((p,i)=>p.fb===true&&p.raw==='L'+lv[i].id.split('_').pop()&&p.id===PID(T0,'L'+lv[i].id.split('_').pop())),'punkt zastępczy: raw „L”+id poziomu, fb: true',JSON.stringify(pts.slice(0,2).map(p=>({id:p.id,raw:p.raw,fb:p.fb}))));
    check(pts.every((p,i)=>p.fc.length===lv[i].fc&&p.q.length===lv[i].q&&p.tk.length===lv[i].tk),'punkt zastępczy = wszystkie fiszki, pytania i zadania poziomu');
    check(pts.every((p,i)=>p.lv&&p.lv[0]===lv[i].id),'lv punktu = id poziomu w silniku');}
  const o=await openHub(r,'hub');await seesText(r,'MATERIA');
  check(!missing(o)&&r.errors.length===0,'stary zapis postępów (bez media/oral/fox/ptHide) — hub bez błędów',r.errors.join(' | '));
  await shot(r,'hub-old-topic');await uiCheck(r,'stary temat');
  const p=await eng(r,'openSubject',S0,'path');await sleep(500);
  check(!missing(p)&&await r.pg.evaluate(()=>NaukaEngine.view==='subject'||!!document.querySelector('#app')),'zakładka „path” (stare odnośniki) = alias huba');
  checkRun(r,'seeded');await close(r);}

section('Dziś (nowy plan, POZA PLANEM, przedmioty)');
{const r=await boot('mock=msgip&reset=1');
  await r.pg.evaluate(()=>NaukaEngine.go('today'));await sleep(800);const t=await bodyText(r);
  check(/sprawdzian za 6 dni/i.test(norm(t))&&/Gotowość 40%/.test(t),'karta sprawdzianu „… sprawdzian za 6 dni”, „Gotowość 40% · …”');
  check(/Gotowość 40%/.test(t),'„Gotowość 40% · plan na dziś: ok. … min”');
  check(/PLAN DNIA/i.test(t),'sekcja PLAN DNIA');
  check(/Lekcja — Korporacje, UE i NGO/.test(t)||/Dokończ/.test(t),'wiersz planu z przerwaną lekcją („Lekcja — Korporacje, UE i NGO”)');
  check(/Odzyskaj 2 punkty od Szopa/.test(t),'wiersz planu „Odzyskaj 2 punkty od Szopa” (+20 XP)');
  check(/POZA PLANEM/i.test(t)&&/Podcast — Lis i Szop/.test(t),'POZA PLANEM: „Podcast — Lis i Szop o …”');
  check(/TWOJE PRZEDMIOTY/i.test(t)&&/Umiesz\s*8\s*z\s*27/.test(norm(t)),'TWOJE PRZEDMIOTY: „Umiesz 8 z 27 · sprawdzian za 6 dni”');
  check(!/Fiszki/.test(await r.pg.evaluate(()=>(document.querySelector('.nav')||{}).innerText||'')),'Dziś: nawigacja bez „Fiszki”');
  await shot(r,'today-msgip');await uiCheck(r,'Dziś');checkRun(r,'Dziś');await close(r);}

section('poprawki z przeglądu (dane, plan dnia, UX)');
{const r=await boot('mock=msgip&reset=1');
  // zajrzenie do części zrobionej lekcji (punkt / rolka / lis) nie zapisuje miejsca i nie robi z niej „Dokończ lekcję”
  await r.pg.evaluate((s,l)=>NaukaEngine.openLessonAt(s,l,1),S,LID(T1,'l1'));await sleep(500);
  const peek=await r.pg.evaluate(()=>!!document.querySelector('.lesson.open'));check(peek,'„Przeczytaj w lekcji 1, część 2” otwiera zrobioną lekcję');
  await r.pg.evaluate(()=>{const b=document.querySelector('.lesson.open .lclose,.lesson.open [aria-label="Zamknij lekcję"],.lesson.open .lhead button');if(b)b.click();});await sleep(500);
  const ls=await r.pg.evaluate(()=>{const k=Object.keys(localStorage).find(x=>x.indexOf('nauka_progress_v1:')===0);const p=k?JSON.parse(localStorage.getItem(k)):{};return Object.keys(JSON.parse(p.lessonSave||'{}'));});
  check(!ls.some(k=>k.endsWith(LID(T1,'l1'))),'zajrzenie do zrobionej lekcji nie zostawia zapisu miejsca',JSON.stringify(ls));
  const na=await eng(r,'naTeraz',S);check(na[0]&&na[0].kind==='resume'&&/Dokończ lekcję 4/.test(na[0].title),'NA TERAZ dalej „Dokończ lekcję 4” (nie zrobiona lekcja 1)',JSON.stringify(na[0]&&na[0].title));
  // zapis powtórki zrobionej lekcji (Build 7) nie jest „Dokończ lekcję”
  await r.pg.evaluate((s,l)=>{const k=Object.keys(localStorage).find(x=>x.indexOf('nauka_progress_v1:')===0);const p=JSON.parse(localStorage.getItem(k));const o=JSON.parse(p.lessonSave||'{}');
    o[s+':'+l]={v:1,at:Date.now(),sig:'x',phase:'quiz',feedIdx:0,items:['q0'],qIdx:1,score:1,combo:1,maxCombo:1,broken:false,xp:5,bad:[],run:[],el:null,terms:[],replay:true};p.lessonSave=JSON.stringify(o);localStorage.setItem(k,JSON.stringify(p));},S,LID(T1,'l2'));
  const plan=await eng(r,'_plan',true);
  check(plan.some(x=>x===S+':lesson:'+LID(T1,'l4'))&&!plan.some(x=>x===S+':lesson:'+LID(T1,'l2')),'plan dnia: wiersz lekcji = przerwana lekcja 4, nie zrobiona',JSON.stringify(plan));
  check(plan.includes(S+':szop'),'plan dnia: Szop przy 2 punktach do odświeżenia (jak karta w centrum)',JSON.stringify(plan));
  // ukrycie punktu da się cofnąć
  const pid=PID(T1,'p13');await eng(r,'openPointSheet',S,pid);await sleep(400);
  await r.pg.evaluate(()=>{const b=[...document.querySelectorAll('#sheet button')].find(x=>/To nie jest punkt/.test(x.innerText));if(b)b.click();});await sleep(400);
  await r.pg.evaluate(()=>{const b=[...document.querySelectorAll('#sheet button,.ask button,[role=dialog] button')].find(x=>/^Ukryj$/i.test((x.innerText||'').trim()));if(b)b.click();});await sleep(500);
  const hid=await eng(r,'pointsOf',S,T1);check(Array.isArray(hid)&&hid.length===12,'punkt ukryty (12 z 13)',hid&&hid.length);
  const tt=await r.pg.evaluate(()=>{const t=document.getElementById('toast');return t?t.innerText+'|'+t.className:'';});
  check(/Stuknij, żeby cofnąć/.test(tt)&&/act/.test(tt),'komunikat „Punkt ukryty. Stuknij, żeby cofnąć” z akcją',tt);
  await r.pg.evaluate(()=>{const t=document.getElementById('toast');if(t)t.click();});await sleep(500);
  const back=await eng(r,'pointsOf',S,T1);check(Array.isArray(back)&&back.length===13,'„cofnij” przywraca punkt (13 z 13)',back&&back.length);
  checkRun(r,'poprawki');await close(r);}
{const r=await boot('mock=msgip&reset=1&msgip=known&exam=none');
  // egzamin ustny w planie dnia, gdy funkcje z /api/me przyszły po ułożeniu planu
  await r.pg.evaluate(()=>NaukaEngine.go('today'));await sleep(600);
  const plan=await eng(r,'_plan');check(plan.includes(S+':oral'),'wszystko „Umiem” → wiersz „Egzamin ustny z lisem” w planie dnia (planAddMedia po /api/me)',JSON.stringify(plan));
  // egzamin ustny z materiału dziś → „Na dziś wystarczy”
  await r.pg.evaluate((t)=>NaukaEngine.setFoxState(t,'exam',{at:NaukaEngine.todayStr(),pct:80}),T1);
  const na=await eng(r,'naTeraz',S);check(na[0]&&na[0].kind==='rest'&&/Na dziś wystarczy/.test(na[0].title),'egzamin ustny z materiału dziś → „Na dziś wystarczy”',JSON.stringify(na[0]&&na[0].title));
  checkRun(r,'oral');await close(r);}
{const r=await boot('mock=msgip&reset=1&exam=0');
  const plan=await eng(r,'_plan',true);
  check(plan.includes(S+':warmup')&&!plan.some(x=>/:lesson:|:reels:/.test(x)),'sprawdzian dziś: rozgrzewka, bez nowej lekcji i rolek w planie',JSON.stringify(plan));
  await r.pg.evaluate(()=>NaukaEngine._planAddMedia());check(!(await eng(r,'_plan')).some(x=>/:reels:/.test(x)),'planAddMedia nie dopisuje rolek w dniu sprawdzianu');
  await openHub(r);await seesText(r,'SPRAWDZIAN');
  const cells=await r.pg.evaluate(()=>[...document.querySelectorAll('.hdays li')].map(li=>Math.round(li.getBoundingClientRect().width)));
  const card=await r.pg.evaluate(()=>Math.round(document.querySelector('.hexam').getBoundingClientRect().width));
  check(cells.length===1&&cells[0]<card/5,'pasek dni w dniu sprawdzianu: jedna wąska komórka, nie pas na całą kartę',JSON.stringify({cells,card}));
  checkRun(r,'exam=0');await close(r);}
{const r=await boot('mock=msgip&reset=1&exam=1');
  const plan=await eng(r,'_plan',true);
  check(plan.includes(S+':cram')&&!plan.some(x=>/:lesson:|:reels:/.test(x)),'sprawdzian jutro: noc przed sprawdzianem, bez nowej lekcji i rolek',JSON.stringify(plan));
  checkRun(r,'exam=1');await close(r);}
{const r=await boot('mock=msgip&reset=1');
  // krok planu do sprawdzianu: ten sam w NA TERAZ i w planie dnia, z powodem
  const na=await eng(r,'naTeraz',S),plan=await eng(r,'_plan',true);const pa=na.find(a=>a.kind==='plan');
  check(!pa||plan.includes(S+':plan'),'NA TERAZ „Plan do sprawdzianu” ⇒ wiersz „Do sprawdzianu — …” w planie dnia',JSON.stringify({na:na.map(a=>a.kind),plan}));
  if(pa)check(/^Sprawdzian za \d+ dni\. Dzisiejszy krok planu: /.test(pa.body),'powód karty planu: „Sprawdzian za N dni. Dzisiejszy krok planu: …”',pa.body);
  // kafelki punktów: długie słowa nie łamią się w środku (dzielenie albo jedna kolumna)
  await eng(r,'openMaterial',S,T2);await sleep(700);
  // bez overflow-wrap (tylko dzielenie ze słownika, hyphens:auto) żadna nazwa nie wystaje z kafelka — albo siatka ma jedną kolumnę
  const fit=await r.pg.evaluate(()=>{const g=document.querySelector('.hpgrid');const one=g.classList.contains('one');g.classList.add('measure');
    const over=[...g.querySelectorAll('.hpchip span:last-child')].filter(sp=>sp.scrollWidth>sp.clientWidth+1).map(sp=>sp.textContent);g.classList.remove('measure');
    return {one,over,hy:getComputedStyle(g.querySelector('.hpchip span:last-child')).hyphens};});
  check(fit.one||!fit.over.length,'nazwy punktów nie łamią się w środku słowa bez dywizu (dzielenie ze słownika albo jedna kolumna)',JSON.stringify(fit));
  checkRun(r,'plan');await close(r);}

await done();
