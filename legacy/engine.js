/* ============================================================
   NAUKA — silnik wieloprzedmiotowej platformy do nauki
   Dane przedmiotów rejestrują się w window.SUBJECTS (patrz data/*.js)
   Tryby: Ścieżka (Duolingo) + Fiszki + Quiz + Egzamin + Info
   Widoki główne (krok 3): Dziś (plan dnia) · Przedmioty · Profil · Ustawienia · Seria
   Krok 6 (handoff 2.0): nawigacja Dziś · Powtórka · [+] · Fiszki · Profil, arkusz „Dodaj materiał”, „Wyjaśnij inaczej”,
   powtórka SRS (PROGRESS.srs, pudełka 0…4 → 0/1/3/7/21 dni), Review + FlashcardsDone, ton bez slangu.
   Krok 7: egzamin (ExamStart → ExamRun z siatką i flagami → wynik z oceną i talią błędów) i plan do sprawdzianu (PROGRESS.tests, TestPlan).
   Krok 8: gamifikacja — gemy i plecak (Shop), misje, zamrożenia serii + ComeBack, album pojęć, boss rozdziału, duch (wyścig z własnym przebiegiem), odznaki.
   Krok 9 (domknięcie, wersja 2.0): pierwsze uruchomienie (LevelPick → Onboarding), katalog przedmiotów, pełne ustawienia (eksport/import),
   ekran błędu + pasek offline, Info przedmiotu z siatką ocen, podsumowanie tygodnia (PROGRESS.history), noc przed egzaminem (Cram),
   poprawianie pytań (PROGRESS.overrides), źródło pytania (SourceView), uczciwe ekrany „wymaga wersji online” (skaner, liga, znajomi, klasa, AI).
   ============================================================ */
(function(){
"use strict";
const ENGINE_SCRIPT=document.currentScript; // krok 9: wykrywanie, czy skrypty z danymi w ogóle się wykonały

/* ---------- bezpieczny storage (iOS file:// potrafi rzucać) ---------- */
const STORE=(()=>{try{const ls=globalThis['localStorage'];const t='__nk_t';ls.setItem(t,'1');ls.removeItem(t);return ls;}catch(e){const m={};return{getItem:k=>k in m?m[k]:null,setItem:(k,v)=>{m[k]=String(v);},removeItem:k=>{delete m[k];}};}})();
const PKEY='nauka_progress_v1';
let PROGRESS=(()=>{try{return JSON.parse(STORE.getItem(PKEY)||'{}');}catch(e){return {};}})();
function saveProgress(){try{STORE.setItem(PKEY,JSON.stringify(PROGRESS));}catch(e){}}
function subjState(id){ if(!PROGRESS[id])PROGRESS[id]={xp:0,levels:{}}; return PROGRESS[id]; }

/* ---------- daily streak (osobny klucz, nie rusza postępów) ---------- */
const MKEY='nauka_meta_v1';
let META=(()=>{try{return JSON.parse(STORE.getItem(MKEY)||'{}');}catch(e){return {};}})();
function saveMeta(){try{STORE.setItem(MKEY,JSON.stringify(META));}catch(e){}}
function dstr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function todayStr(){return dstr(new Date());}
function dayDiff(a,b){const pa=a.split('-').map(Number),pb=b.split('-').map(Number);return Math.round((Date.UTC(pb[0],pb[1]-1,pb[2])-Date.UTC(pa[0],pa[1]-1,pa[2]))/86400000);}
/* aktualna „żywa” seria do wyświetlenia (0 jeśli wygasła) */
function streakDisplay(){ if(!META.lastDay)return 0; const d=dayDiff(META.lastDay,todayStr()); return (d===0||d===1)?(META.streak||0):0; }
/* odnotuj aktywność dziś; zwraca true gdy seria została dziś przedłużona/zaczęta */
function touchStreak(){
  const t=todayStr();
  if(META.lastDay===t)return false; // już policzone dzisiaj
  if(META.lastDay){const d=dayDiff(META.lastDay,t); META.streak=(d===1)?(META.streak||0)+1:1;}
  else META.streak=1;
  META.lastDay=t; META.best=Math.max(META.best||0,META.streak); saveMeta();
  missionEvent('day',1);checkBadges(); // krok 8
  return true;
}

/* ---------- krok 9: wersja, dziennik dni (podsumowanie tygodnia), cel dzienny, poprawki pytań ----------
   PROGRESS.history["yyyy-mm-dd"]={xp,levels,cards,reviews,combo,missions} — dopisują addXP / finishLesson / srsTouch / albumCheck / claimMission.
   PROGRESS.goal = cel dzienny XP (50/100/200), kopiowany do PROGRESS.daily.goal przy układaniu dnia. PROGRESS.overrides["sid:lid:qi"]={q,a,c,e}. */
const VERSION='2.0';
function history(){if(!PROGRESS.history||typeof PROGRESS.history!=='object')PROGRESS.history={};return PROGRESS.history;}
function histDay(ds){const H=history();const d=ds||todayStr();if(!H[d]){H[d]={xp:0,levels:0,cards:0,reviews:0,combo:0,missions:0};const ks=Object.keys(H).sort();if(ks.length>120)ks.slice(0,ks.length-120).forEach(k=>{delete H[k];});}return H[d];}
function histAdd(k,n){const h=histDay();h[k]=(h[k]|0)+(n==null?1:n);saveProgress();}
function histMax(k,n){const h=histDay();if(n>(h[k]|0)){h[k]=n;saveProgress();}}
const GOALS_XP=[[50,'Spokojnie','5 minut'],[100,'Normalnie','10 minut'],[200,'Solidnie','20 minut']];
function goalXP(){const g=PROGRESS.goal|0;return g>0?g:100;}
function setGoal(g){PROGRESS.goal=g;if(PROGRESS.daily)PROGRESS.daily.goal=g;saveProgress();}
function overrides(){if(!PROGRESS.overrides||typeof PROGRESS.overrides!=='object')PROGRESS.overrides={};return PROGRESS.overrides;}
function ovKey(sid,lid,qi){return sid+':'+lid+':'+qi;}
/* pytanie z poziomu z nałożoną poprawką użytkownika (EditContent) — jedno źródło dla lekcji, quizu, egzaminu, bossa, powtórki i cramu */
function qOf(s,lv,qi){const q=(lv.quiz||[])[qi];if(!q)return q;const o=overrides()[ovKey(s.id,lv.id,qi)];return o?{...q,q:o.q,a:o.a.slice(),c:o.c,e:o.e,edited:true}:q;}

/* ---------- helpers ---------- */
const SUBJECTS = (window.SUBJECTS||[]).filter(s=>s&&s.id&&s.name&&Array.isArray(s.levels)); // krok 9: wpisy bez id/nazwy/poziomów są pomijane
const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;};
const shuffle=a=>[...a].sort(()=>Math.random()-0.5);
const keys=['A','B','C','D','E'];
let app, current=null, curTab='path';

/* ---------- ikony: inline SVG (ścieżki z design/preview/*.html), zero emoji w UI ----------
   icon(name,{size,stroke,fill,cls}) → string <svg class="ic" …>. 24×24 viewBox,
   stroke=currentColor 2.4–3.4 (round caps/joins) albo fill=currentColor dla glifów pełnych. */
const ICONS={
  back:{d:'M15 5l-7 7 7 7',w:3},
  close:{d:'M6 6l12 12M18 6L6 18',w:3},
  check:{d:'M5 13l4.5 4.5L19 7',w:3.4},
  lock:{d:'<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>'},
  bolt:{d:'M13 2L4 14h6l-1 8 9-12h-6z',fill:true},
  flame:{d:'M12 2c2.6 3.6 1.1 5.7 0 6.8C10.4 7.2 9 5.6 9 3.5 6.4 5.6 5 8.6 5 12a7 7 0 0 0 14 0c0-3.1-1.6-6.6-7-10z',fill:true},
  gem:{d:'M12 2l7 6-7 14-7-14z',fill:true},
  heart:{d:'M12 20.5S4 15.6 4 10.4A4.4 4.4 0 0 1 12 7.9a4.4 4.4 0 0 1 8 2.5c0 5.2-8 10.1-8 10.1z',fill:true},
  star:{d:'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',fill:true},
  book:{d:'M4 4h5a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-5a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h6z'},
  cards:{d:'<rect x="3" y="6" width="14" height="13" rx="3"/><path d="M8 3h10a3 3 0 0 1 3 3v10"/>'},
  brain:{d:'M11 4.5A3 3 0 0 0 5.5 7a3 3 0 0 0-1.4 5 3 3 0 0 0 1.4 5.3A3 3 0 0 0 11 19zM13 4.5A3 3 0 0 1 18.5 7a3 3 0 0 1 1.4 5 3 3 0 0 1-1.4 5.3A3 3 0 0 1 13 19zM11 4.5V19M13 4.5V19',w:2.4},
  target:{d:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>'},
  info:{d:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>'},
  list:{d:'M4 6h16M4 12h16M4 18h10'},
  clock:{d:'<circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l4 2.5"/>'},
  'chevron-right':{d:'M9 5l7 7-7 7'},
  plus:{d:'M12 5v14M5 12h14',w:3},
  refresh:{d:'M4 12a8 8 0 1 1 2.5 5.8M4 12V7M4 12h5'},
  trophy:{d:'M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M9 20h6',w:2.4},
  chest:{d:'<rect x="3" y="9" width="18" height="11" rx="2.5"/><path d="M3 13h18M12 9v11M7 9V7a5 5 0 0 1 5 2 5 5 0 0 1 5-2v2"/>',w:2.4},
  home:{d:'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z',w:2.4},
  calendar:{d:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',w:2.4},
  settings:{d:'<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2L5.6 5.6"/>',w:2.4},
  user:{d:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',w:2.4},
  search:{d:'<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>'},
  'x-circle':{d:'<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>'},
  alert:{d:'M12 8v5M12 16.5v.5M12 3l9 17H3z',w:2.8},
  bulb:{d:'M12 3a6 6 0 0 0-3 11v3h6v-3a6 6 0 0 0-3-11zM9.5 21h5'},
  bookmark:{d:'M5 5h14v14l-7-4-7 4z'},
  file:{d:'M6 4h9l4 4v12H6zM14 4v5h5'},
  question:{d:'M9.2 9a3 3 0 1 1 4 2.8c-.8.3-1.2 1-1.2 1.8v.4M12 17.5v.5',w:3},
  edit:{d:'M4 20h4L19 9l-4-4L4 16zM13 7l4 4'},
  link:{d:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5'},
  map:{d:'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',w:2.4},
  grid:{d:'<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',w:2.4},
  flag:{d:'M5 21V4M5 4h12l-2 4 2 4H5'},
  upload:{d:'M12 16V4M8 8l4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',w:2.4},
  'arrow-up':{d:'M12 19V5M6 11l6-6 6 6'},
  'chevron-up':{d:'M5 15l7-7 7 7',w:3},
  'chevron-down':{d:'M5 9l7 7 7-7',w:3},
  grip:{d:'M8 9h8M8 15h8'},
  /* krok 5b: nowe typy zadań */
  quote:{d:'M4 18v-5c0-4 2-7 6-8l1 2c-2 1-3 3-3 5h3v6zm9 0v-5c0-4 2-7 6-8l1 2c-2 1-3 3-3 5h3v6z',fill:true},
  'arrow-down':{d:'M12 4v16M6 14l6 6 6-6',w:3},
  chart:{d:'M5 20v-8M11 20V5M17 20v-5M3 20h18',w:2.8},
  calc:{d:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 7.5h6M9 12h.5M12 12h.5M15 12h.5M9 16h.5M12 16h.5M15 16h.5"/>',w:2.4},
  keyboard:{d:'<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7 10h.5M11 10h.5M15 10h.5M8 14h8"/>',w:2.4},
  swipe:{d:'M3 12h18M8 7l-5 5 5 5M16 7l5 5-5 5',w:2.8},
  pointer:{d:'M9 11V5.5a1.5 1.5 0 0 1 3 0V11l4 .8a3 3 0 0 1 2.4 3l-.5 3.3A3.5 3.5 0 0 1 14.4 21H12a4 4 0 0 1-3-1.4L5.4 15a1.6 1.6 0 0 1 2.4-2.1L9 14',w:2.4},
  /* krok 6: arkusz „Dodaj materiał”, notka o AI w „Wyjaśnij inaczej” */
  camera:{d:'<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M9 7l1.5-3h3L15 7"/>',w:2.4},
  wifi:{d:'M2 8.5a16 16 0 0 1 20 0M5.5 12.5a11 11 0 0 1 13 0M9 16.5a6 6 0 0 1 6 0M12 20v.5'},
  /* krok 8: zamrożenie serii, motyw, boss, duch */
  snow:{d:'M12 3v18M3 12h18M6 6l12 12M18 6L6 18',w:2.6},
  palette:{d:'<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17"/>',w:2.4},
  boss:{d:'<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"/><circle class="eye" cx="9" cy="11.5" r="1.9"/><circle class="eye" cx="15" cy="11.5" r="1.9"/><path class="mouth" d="M9 16.5q3 2.2 6 0"/>',fill:true},
  ghost:{d:'<path d="M5 20V11a7 7 0 0 1 14 0v9l-2.3-1.6L14.3 20 12 18.4 9.7 20 7.3 18.4z"/><circle class="eye" cx="9.5" cy="11" r="1.5"/><circle class="eye" cx="14.5" cy="11" r="1.5"/>',fill:true},
  /* krok 9: etap nauki, cram, przypomnienie, eksport, znajomi, udostępnianie, trend */
  cap:{d:'M2 9l10-4 10 4-10 4zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v5',w:2.4},
  globe:{d:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',w:2.4},
  moon:{d:'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',fill:true},
  bell:{d:'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4',w:2.4},
  download:{d:'M12 4v12M8 12l4 4 4-4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2',w:2.4},
  users:{d:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.2.6 3.5 2.3 3.5 5.2"/>',w:2.4},
  share:{d:'<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>',w:2.4},
  trend:{d:'M3 17l6-6 4 4 8-8M15 7h6v6',w:2.8}
};
function icon(name,o){
  o=o||{};const ic=ICONS[name]||ICONS.alert;
  const size=o.size||20, sw=o.stroke||ic.w||2.6;
  const filled=(o.fill!=null)?!!o.fill:!!ic.fill;
  const body=ic.d.indexOf('<')>=0?ic.d:'<path d="'+ic.d+'"/>';
  const paint=filled?'fill="currentColor" stroke="none"':'fill="none" stroke="currentColor" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round"';
  return '<svg class="ic'+(o.cls?' '+o.cls:'')+'" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" '+paint+' aria-hidden="true">'+body+'</svg>';
}
/* monogram zamiast emoji z danych: pierwsza litera/cyfra nazwy w kafelku w kolorze --accent */
/* tytuły z danych bez emoji (zero emoji w UI; treść HTML roladki/Info zostaje) */
function noEmoji(t){return String(t||'').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').replace(/\s+/g,' ').trim();}
function initial(str){const m=String(str||'').match(/[\p{L}\p{N}]/u);return m?m[0].toUpperCase():'?';}
function mono(txt,cls){return '<div class="mono'+(cls?' '+cls:'')+'" aria-hidden="true">'+txt+'</div>';}
/* 3 gwiazdki: zdobyte = pełne złote, reszta = kontur */
function starRow(nStars,size){return [0,1,2].map(i=>icon('star',{size:size||12,fill:i<nStars,stroke:2,cls:i<nStars?'ic-gold':'ic-dim'})).join('');}
/* duży kafel wyniku (.result .big): gold/hot/ok/fail albo '' = kolor przedmiotu */
const BIG_IC={gold:'trophy',hot:'flame',ok:'check',fail:'x-circle'};
function bigTile(kind,ic){return '<div class="big'+(kind?' '+kind:'')+'">'+icon(ic||BIG_IC[kind]||'check',{size:60,stroke:3.2})+'</div>';}
/* etykiety przycisków z ikoną (spacja: w block-layout zostaje odstęp, flex ją ignoruje) */
const LBL={
  next:'Dalej '+icon('chevron-right',{size:18,stroke:3}),
  result:'Wynik '+icon('flag',{size:18}),
  check:'Sprawdź '+icon('check',{size:18,stroke:3.4}),
  again:'Jeszcze raz '+icon('refresh',{size:18,stroke:2.8}),
  back:icon('back',{size:18,stroke:3})+' '
};
const TOAST_TONE={check:'acid',flame:'flame',close:'red','x-circle':'red',lock:'muted',info:'cyan',trophy:'gold',bolt:'gold',heart:'red',gem:'cyan',snow:'cyan',cards:'cyan',star:'gold',boss:'violet',calendar:'gold',map:'acid',clock:'cyan',alert:'red',refresh:'cyan',palette:'violet',chest:'gold'};

function toast(t,ic,anim){const box=document.getElementById('toast');if(!box)return;box.innerHTML=ic?icon(ic,{size:16,cls:'ic-'+(TOAST_TONE[ic]||'acid')+(anim?' '+anim:'')}):'';const s=document.createElement('span');s.textContent=t;box.appendChild(s);box.classList.add('show');clearTimeout(box._t);box._t=setTimeout(()=>box.classList.remove('show'),1500);}
function addXP(id,n){const s=subjState(id);if(n>0&&boostActive())n*=2;s.xp+=n;const d=daily();d.xp+=n;if(n>0)histAdd('xp',n);saveProgress();const ext=touchStreak();updateXP();updateStreakUI();updateGoalUI();if(n>0)missionEvent('xp',n);if(ext&&META.streak>1)setTimeout(()=>toast('Seria: '+META.streak+' dni z rzędu','flame'),1600);}
function updateGoalUI(){const d=PROGRESS.daily;if(!d)return;const g=d.goal||goalXP();document.querySelectorAll('.goalrow').forEach(r=>{const i=r.querySelector('.bar i');if(i)i.style.width=Math.min(100,d.xp/g*100)+'%';const sp=r.querySelector('span');if(sp)sp.textContent=d.xp+' / '+g+' XP';});}
function updateXP(){const x=document.getElementById('xpNum');if(x&&current)x.textContent=subjState(current.id).xp;}
function updateStreakUI(){const n=streakDisplay();document.querySelectorAll('[id="streakNum"]').forEach(e=>e.textContent=n);}

/* pula wszystkich elementów danego przedmiotu (ze wszystkich poziomów) */
/* krok 6: każdy element niesie id poziomu i swój indeks (klucz SRS "<subjectId>:<levelId>:<itemId>", pytania z prefiksem q) */
function allCards(s){return s.levels.flatMap(l=>(l.flashcards||[]).map((c,i)=>({...c,lvl:noEmoji(l.title),lid:l.id,i})));}
function allQuiz(s){return s.levels.flatMap(l=>(l.quiz||[]).map((q,i)=>({...qOf(s,l,i),lvl:noEmoji(l.title),lid:l.id,qi:i})));} // krok 9: z poprawkami użytkownika
function allFeed(s){return s.levels.flatMap(l=>(l.feed||[]).map(f=>({...f,lvl:noEmoji(l.title)})));}

function applyTheme(s){
  const r=document.documentElement.style;
  const set=(k,v)=>{if(v)r.setProperty(k,v);else r.removeProperty(k);};
  set('--accent', s&&s.accent);            // brak = domyślny --acid z :root
  set('--accent2', s&&(s.accent2||s.accent));
  set('--accent-dark', s&&s.accentDark);   // brak = color-mix z --accent w styles.css
  set('--on-accent', s&&s.onAccent);
}

/* ============================================================ KROK 3: „Dziś”, plan dnia, kafle, dolna nawigacja
   Router widoków głównych: today (start) · subjects · profile · settings · streak.
   Widok przedmiotu (renderSubject) zostaje bez nawigacji — ma własne zakładki i przycisk wstecz. */
const VIEWS={today:renderToday,review:renderReview,cards:renderCardsHub,subjects:renderSubjects,profile:renderProfile,settings:renderSettings,streak:renderStreak,testplan:renderTestPlan,
  shop:renderShop,missions:renderMissions,album:renderAlbum,comeback:renderComeBack, // krok 8
  levelpick:renderLevelPick,onboarding:renderOnboarding,catalog:renderCatalog,weekly:renderWeekly,cram:renderCram,coming:renderComing,error:renderErrorView}; // krok 9
let view='today';
function go(v){
  view=VIEWS[v]?v:'today';
  current=null;applyTheme(null);
  try{clearInterval(cwInt);clearInterval(exInt);clearInterval(nhInt);clearInterval(bossInt);clearInterval(ghostInt);clearInterval(cramInt);}catch(e){}
  keyFn=null;lessonState=null;rvState=null;exState=null;bossState=null;cramState=null;taskCleanup();
  VIEWS[view]();
}
const renderHome=()=>go('today'); // stary punkt wejścia

/* --- polskie daty i liczebniki --- */
const DAYS=['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'],DAYS_S=['Nd','Pn','Wt','Śr','Cz','Pt','Sb'];
const MONTHS=['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
const MONTHS_S=['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru']; // krok 7: nagłówek planu do sprawdzianu
function dateHeader(){const d=new Date();return DAYS[d.getDay()]+', '+d.getDate()+' '+MONTHS[d.getMonth()];}
function pl(n,one,few,many){n=Math.abs(n);if(n===1)return one;const m10=n%10,m100=n%100;return (m10>=2&&m10<=4&&(m100<12||m100>14))?few:many;}
function fmtNum(n){return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');}
function totalXP(){return SUBJECTS.reduce((a,s)=>a+(((PROGRESS[s.id]||{}).xp)||0),0);} // nie Object.values — PROGRESS.daily też ma xp
function hasProgress(s){const st=PROGRESS[s.id];return !!st&&(((st.xp||0)>0)||Object.values(st.levels||{}).some(l=>l&&l.done));}
function applyMotion(){document.documentElement.classList.toggle('reduce-motion',!!META.reduceMotion);}

/* --- plan dnia: PROGRESS.daily = {date, goal, xp, tasks:[{id, done, need?, prog?}]} (DESIGN.md §4.3, ten sam klucz) --- */
const REWARD={lesson:15,review:20,quiz:25,exam:40,weak:20};
function daily(){
  const t=todayStr();let d=PROGRESS.daily;
  if(!d||d.date!==t||!Array.isArray(d.tasks)){syncTests();d=PROGRESS.daily={date:t,goal:goalXP(),xp:0,tasks:buildDailyTasks()};saveProgress();} // krok 7: nowy dzień = przeliczenie planów do sprawdzianu; krok 9: cel z PROGRESS.goal
  return d;
}
function buildDailyTasks(){
  let subs=SUBJECTS.filter(hasProgress);
  if(!subs.length)subs=SUBJECTS.slice(0,1);
  subs=[...subs].sort((a,b)=>((PROGRESS[b.id]||{}).xp||0)-((PROGRESS[a.id]||{}).xp||0));
  const tasks=[];
  subs.forEach(s=>{
    const st=subjState(s.id);
    const open=s.levels.find((l,i)=>levelUnlocked(s,i)&&!(st.levels[l.id]||{}).done);
    if(open)tasks.push({id:s.id+':lesson:'+open.id,done:false});
    const n=Math.min(12,allCards(s).length);
    if(n)tasks.push({id:s.id+':review',done:false,need:n,prog:0});
    const doneLv=[...s.levels].reverse().find(l=>(st.levels[l.id]||{}).done)||s.levels[0];
    if(doneLv&&(doneLv.quiz||[]).length)tasks.push({id:s.id+':quiz:'+doneLv.id,done:false});
    if(allQuiz(s).length>=5)tasks.push({id:s.id+':exam',done:false});
    if(hasDeck(s.id))tasks.push({id:s.id+':weak',done:false}); // krok 7: talia błędów z ostatniego egzaminu
  });
  return tasks;
}
/* opis zadania z jego id (etykiety liczone z danych, więc w storage siedzi tylko id + done) */
function taskInfo(t){
  const parts=t.id.split(':');const sid=parts[0],kind=parts[1],lvId=parts[2];
  const s=SUBJECTS.find(x=>x.id===sid);if(!s)return null;
  const lv=lvId?s.levels.find(l=>l.id===lvId):null;
  const short=s.short||s.name;const base={t,s,kind,reward:REWARD[kind]||0};
  const openAt=(tab,setup)=>()=>openSubject(sid,tab,setup);
  if(kind==='lesson'){if(!lv)return null;const nf=(lv.feed||[]).length,nq=(lv.quiz||[]).length,nt=(lv.tasks||[]).length;
    return {...base,icon:'book',title:'Roladka — '+noEmoji(lv.title),sub:`${nf} ${pl(nf,'dawka','dawki','dawek')} · ${nq} ${pl(nq,'pytanie','pytania','pytań')}${nt?` · ${nt} ${pl(nt,'zadanie','zadania','zadań')}`:''} · +15`,go:openAt('path')};}
  if(kind==='review'){const n=t.need||12,p=t.prog||0;const due=srsDue().filter(x=>x.s.id===sid).length;
    return {...base,icon:'refresh',title:`Powtórka — ${n} ${pl(n,'fiszka','fiszki','fiszek')}`,sub:p?`${p} z ${n} przejrzane · +20`:`${short} · ${due?due+' do powtórki dziś':Math.max(1,Math.round(n/4))+' min'} · +20`,go:()=>go('review')};}
  if(kind==='quiz'){if(!lv)return null;const n=(lv.quiz||[]).length,m=Math.max(1,Math.round(n*0.5));
    return {...base,icon:'question',title:'Quiz — '+noEmoji(lv.title),sub:`${n} ${pl(n,'pytanie','pytania','pytań')} · ${short} · ${m} min · +25`,
      go:openAt('quiz',()=>{qState={subj:sid,lvl:lv.id,list:null,idx:0,score:0,answered:false};})};}
  if(kind==='exam'){const N=Math.min(20,allQuiz(s).length);
    return {...base,icon:'file',title:'Egzamin próbny',sub:`${N} ${pl(N,'pytanie','pytania','pytań')} · opcjonalnie · +40`,go:openAt('egzamin')};}
  if(kind==='weak'){const n=deckKeys(sid).filter(k=>srsResolve(k)).length;if(!n&&!t.done)return null; // krok 7: talia błędów z egzaminu
    return {...base,icon:'alert',title:'Powtórz błędy z egzaminu',sub:`${n} ${pl(n,'pytanie','pytania','pytań')} · ${short} · +20`,go:()=>startExamDeck(sid)};}
  return null;
}
/* zaliczenie zadania: lesson (z id poziomu), quiz / exam / review (po przedmiocie); nagroda idzie przez addXP */
function completeDaily(sid,kind,lvId){
  const d=daily();const pre=sid+':'+kind;
  const t=d.tasks.find(x=>!x.done&&(lvId?x.id===pre+':'+lvId:(x.id===pre||x.id.indexOf(pre+':')===0)));
  if(!t)return false;
  t.done=true;saveProgress();
  const r=REWARD[kind]||0;if(r)addXP(sid,r);
  setTimeout(()=>toast('Plan dnia: +'+r+' XP','bolt'),3200);
  planCheck(d); // krok 8: cały plan zrobiony → +5 gemów, misja „plan”
  return true;
}
function tickDaily(sid,kind,n){
  const d=daily();const t=d.tasks.find(x=>!x.done&&x.id===sid+':'+kind);if(!t)return;
  t.prog=(t.prog||0)+(n||1);
  if(t.prog>=(t.need||1))completeDaily(sid,kind);else saveProgress();
}

/* --- wspólna skorupa widoków głównych: topbar + ekran + dolna nawigacja + toast --- */
function renderNav(active){
  const nav=el('nav','nav');nav.setAttribute('aria-label','Nawigacja');
  const tab=(k,ic,lab)=>{const b=el('button',k===active?'active':'',icon(ic,{size:24,stroke:2.4})+'<span>'+lab+'</span>');if(k===active)b.setAttribute('aria-current','page');b.onclick=()=>go(k);return b;};
  nav.appendChild(tab('today','home','Dziś'));nav.appendChild(tab('review','refresh','Powtórka'));
  // krok 6: uniesiony plus 62 px na środku — „Dodaj materiał” z każdego ekranu (DESIGN.md §0)
  const plus=el('button','navplus a-pulse',icon('plus',{size:30,stroke:3.2}));plus.setAttribute('aria-label','Dodaj materiał');plus.onclick=()=>openQuickAdd();nav.appendChild(plus);
  nav.appendChild(tab('cards','cards','Fiszki'));nav.appendChild(tab('profile','user','Profil'));
  return nav;
}
function shell(active,o){
  o=o||{};app.innerHTML='';
  if(o.blob)app.appendChild(el('div','blob a-float'+(o.blob===true?'':' '+o.blob)));
  const top=el('div','topbar');
  if(o.back){const b=el('button','backbtn',icon('back',{size:20,stroke:3}));b.setAttribute('aria-label','Wróć');b.onclick=o.back;top.appendChild(b);}
  top.appendChild(el('div',o.title?'logo ttl':'logo brand',o.title||'NAUKA<span class="g">.</span>'));
  if(o.pills!==false){
    const pills=el('div','pills');
    const st=el('button','streak',`${icon('flame',{size:16,cls:'ic-flame a-beat'})}<span id="streakNum">${streakDisplay()}</span> <small>dni</small>`);
    st.setAttribute('aria-label','Seria dni');st.onclick=()=>go('streak');pills.appendChild(st);
    pills.appendChild(el('div','streak',`${icon('bolt',{size:16,cls:'ic-gold'})}<span>${fmtNum(totalXP())}</span> <small>xp</small>`));
    pills.appendChild(gemPill()); // krok 8: gemy → Plecak
    top.appendChild(pills);
  }
  if(o.right)top.appendChild(o.right);
  app.appendChild(top);
  const sc=el('div','screen active');
  const scroll=el('div','scroll'+(o.cls?' '+o.cls:''));
  sc.appendChild(scroll);app.appendChild(sc);
  if(active)app.appendChild(renderNav(active));
  app.appendChild(el('div','toast',''));app.lastChild.id='toast';
  return scroll;
}
/* arkusz „Dodaj materiał” (QuickAdd.html): zdjęcie strony / plik / tekst / gotowy przedmiot. Ta wersja działa offline, bez AI (DESIGN.md §5),
   więc trzy pierwsze opcje prowadzą do uczciwego arkusza informacyjnego (openAddInfo), a „gotowy przedmiot” do siatki przedmiotów. */
function openQuickAdd(){
  const s=openSheet('quickadd',`<div class="shandle"></div>
    <div class="shead"><div class="st2">Dodaj materiał</div><button class="backbtn sclose" id="qaclose" aria-label="Zamknij">${icon('close',{size:18,stroke:3})}</button></div>
    <button class="qabig a-pop" id="qa-photo"><div class="ico a-bob">${icon('camera',{size:32,stroke:2.4})}</div><div class="grow"><div class="t">Zrób zdjęcie</div><div class="s">strona z podręcznika, zeszyt, tablica</div></div></button>
    <div class="qagrid">
      <button class="qatile pink a-up d1" id="qa-file">${icon('upload',{size:24,stroke:2.6})}<div><div class="t">Wgraj plik</div><div class="s">PDF, prezentacja, Word</div></div></button>
      <button class="qatile cyan a-up d2" id="qa-text">${icon('list',{size:24,stroke:2.6})}<div><div class="t">Wklej tekst</div><div class="s">notatki, konspekt, zagadnienia</div></div></button>
    </div>
    <button class="qatest a-up d3" id="qa-test">${icon('calendar',{size:20,stroke:2.4})}<span>Mam sprawdzian — ułóż mi plan</span>${icon('chevron-right',{size:18,stroke:2.6,cls:'chev'})}</button>
    <button class="qalink a-up d4" id="qa-catalog" data-primary>albo weź gotowy przedmiot z katalogu</button>`);
  sheetBack();
  s.querySelector('#qaclose').onclick=closeSheet;
  s.querySelector('#qa-test').onclick=()=>{if(!SUBJECTS.length){openAddInfo('any');return;}openTestSheet(current?current.id:null);}; // krok 7
  s.querySelector('#qa-photo').onclick=()=>openComing('scanner'); // krok 9: skaner = wersja online
  s.querySelector('#qa-file').onclick=()=>openFileError(); // krok 9: ekran błędu „format nieobsługiwany offline”
  s.querySelector('#qa-text').onclick=()=>openAddInfo('text');
  s.querySelector('#qa-catalog').onclick=()=>{closeSheet();go(SUBJECTS.length?'catalog':'subjects');}; // krok 9: katalog
  return s;
}
/* krok 9: „Wgraj plik” offline → ekran błędu (ErrorState.html) z uczciwym powodem i wyjściami */
function openFileError(){
  const from=current?{sid:current.id,tab:curTab}:{view};
  const back=()=>from.sid?openSubject(from.sid,from.tab):go(from.view);
  renderError({head:'Dodaj materiał',title:'Ten format nie jest jeszcze obsługiwany offline',
    reason:'PDF, prezentacje i Word czyta AI w wersji online. Ta wersja działa bez połączenia, więc nie ma jak zamienić pliku w poziomy i pytania.',
    rows:[['file','PDF','wymaga wersji online'],['file','PPTX · prezentacja','wymaga wersji online'],['file','DOCX · Word','wymaga wersji online']],
    can:[['list','Wklej najważniejsze fragmenty tekstem — zobacz, jak dodać przedmiot w tej wersji'],['grid','Weź gotowy przedmiot z katalogu']],
    actions:[{label:'GOTOWE PRZEDMIOTY',primary:true,go:()=>go('catalog')},{label:'JAK DODAĆ PRZEDMIOT',go:()=>{back();openAddInfo('file');}},{label:'Wróć',text:true,go:back}],back});
}
const ADD_KIND={photo:['zdjęcia','Zdjęcie strony'],file:['pliku','Plik'],text:['wklejonego tekstu','Wklejony tekst'],any:['materiałów','Materiał']};
function openAddInfo(kind){
  const k=ADD_KIND[kind]||ADD_KIND.any;const fromSheet=kind!=='any';
  const s=openSheet('addinfo',`<div class="shandle"></div>
    <div class="shead"><div class="st2">Skąd wziąć materiał?</div><button class="backbtn sclose" id="aiclose" aria-label="Zamknij">${icon('close',{size:18,stroke:3})}</button></div>
    <p class="sp">${k[1]} zamienia się w poziomy, fiszki i pytania — w wersji online, z pomocą AI. Każde pytanie wskazuje wtedy fragment źródła i da się je poprawić.</p>
    <div class="infobox a-up d1">${icon('wifi',{size:18})}<span>Ta wersja działa offline, bez połączenia z AI, więc nie przetworzy jeszcze ${k[0]}. Gotowe przedmioty działają w całości.</span></div>
    <div class="eyebrow sec">Jak dodać przedmiot w tej wersji</div>
    <div class="steps">
      <div class="step a-up d2"><div class="num">1</div><div><div class="t">Skopiuj <code>data/makro.js</code> pod nową nazwą</div><div class="s">np. <code>data/historia.js</code></div></div></div>
      <div class="step a-up d3"><div class="num">2</div><div><div class="t">Wpisz poziomy, fiszki i pytania</div><div class="s">schemat danych jest w README</div></div></div>
      <div class="step a-up d4"><div class="num">3</div><div><div class="t">Dodaj plik w <code>index.html</code> i uruchom <code>node build.js</code></div><div class="s">przedmiot pojawi się na liście</div></div></div>
    </div>
    <div class="sbtns">${fromSheet?'<button class="pill ghost" id="aiback">Wróć</button>':''}<button class="pill" id="aicat" data-primary>Gotowe przedmioty</button></div>`);
  sheetBack();
  s.querySelector('#aiclose').onclick=closeSheet;
  const b=s.querySelector('#aiback');if(b)b.onclick=()=>openQuickAdd();
  s.querySelector('#aicat').onclick=()=>{closeSheet();if(SUBJECTS.length)go('catalog');}; // krok 9: katalog
  return s;
}
/* siatka kafli przedmiotów (Main.html): tint przedmiotu, monogram na pełnym akcencie, pasek poziomów */
function subjectGrid(list,withAdd){
  const grid=el('div','grid2');
  list.forEach((s,i)=>{
    const st=subjState(s.id);const total=s.levels.length;
    const done=s.levels.filter(l=>(st.levels[l.id]||{}).done).length;const pct=total?Math.round(done/total*100):0;
    const t=el('button','subjtile themed');
    t.style.setProperty('--accent',s.accent);if(s.onAccent)t.style.setProperty('--on-accent',s.onAccent);
    t.innerHTML=`${mono(initial(s.short||s.name),'solid')}<div class="name">${s.short||s.name}</div>
      <div class="bar"><i class="a-grow d${Math.min(6,i+2)}" style="width:${pct}%"></i></div><small>${done}/${total} ${pl(total,'poziom','poziomy','poziomów')}</small>`;
    t.setAttribute('aria-label',s.name+', '+done+' z '+total+' poziomów');
    t.onclick=()=>openSubject(s.id);
    grid.appendChild(t);
  });
  if(withAdd){
    const a=el('button','subjtile add',`<div class="mono">${icon('plus',{size:22,stroke:3,cls:'a-bob'})}</div><div class="name">Dodaj<br>materiał</div>`);
    a.setAttribute('aria-label','Dodaj materiał');a.onclick=()=>openQuickAdd();grid.appendChild(a);
  }
  return grid;
}
/* karta „Plan na dziś”: zrobione (przekreślone, check), bieżące (tint przedmiotu, pulsujący kafel), późniejsze (wyciszone) */
function renderPlan(items){
  const card=el('div','plan a-up d2');
  if(!items.length){card.innerHTML=`<div class="plan-row later"><div class="plan-tile">${icon('bulb',{size:18})}</div><div class="pt"><div class="t">Brak zadań na dziś</div><div class="s">dodaj materiał, a plan ułoży się sam</div></div></div>`;return card;}
  let cur=false;
  items.forEach((x,i)=>{
    if(i)card.appendChild(el('div','plan-sep'));
    let state='later';if(x.t.done)state='done';else if(!cur){cur=true;state='cur';}
    const row=el('button','plan-row '+state+' themed');
    row.style.setProperty('--accent',x.s.accent);if(x.s.onAccent)row.style.setProperty('--on-accent',x.s.onAccent);
    row.dataset.task=x.t.id;
    row.innerHTML=`<div class="plan-tile${state==='cur'?' a-pulse':''}">${state==='done'?icon('check',{size:19,stroke:3.4}):icon(x.icon,{size:19,stroke:state==='cur'?3:2.6})}</div>
      <div class="pt"><div class="t">${x.title}</div>${state==='done'?'':`<div class="s">${x.sub}</div>`}</div>
      ${state==='done'?(x.reward?`<span class="rw">+${x.reward}</span>`:''):icon('chevron-right',{size:20,cls:'chev'})}`;
    row.setAttribute('aria-label',(state==='done'?'Zrobione: ':'')+x.title);
    row.onclick=x.go;
    card.appendChild(row);
  });
  return card;
}

/* ============================================================ DZIŚ (ekran startowy, Main.html) */
function renderToday(){
  const scroll=shell('today',{blob:themeBlob(),cls:'today'}); // krok 8: kolor tła z motywu (Plecak)
  syncTests();
  const d=daily();const items=tests().map(testTodayItem).filter(Boolean).concat(d.tasks.map(taskInfo).filter(Boolean)); // krok 7: wiersz „Do sprawdzianu” na górze
  const done=items.filter(x=>x.t.done).length,total=items.length;
  scroll.appendChild(el('div','',`<div class="eyebrow">${dateHeader()}</div><h1>Plan na dziś</h1>`));
  scroll.appendChild(el('div','planbar',`<div class="bar"><i class="a-grow" style="width:${total?done/total*100:0}%"></i></div><span>${done} z ${total}</span>`));
  const g=d.goal||goalXP(); // krok 9: cel dzienny XP (Onboarding) — pasek pod planem, tap = zmiana celu
  const gr=el('button','goalrow a-up d1',icon('bolt',{size:15,cls:'ic-gold'})+`<div class="bar"><i class="a-grow d2" style="width:${Math.min(100,d.xp/g*100)}%"></i></div><span>${d.xp} / ${g} XP</span>`);
  gr.setAttribute('aria-label',`Cel dzienny: ${d.xp} z ${g} XP`);gr.onclick=()=>openOnboarding('today');scroll.appendChild(gr);
  const mini=el('div','minitiles'); // krok 8: Misje → ekran misji, Album → album pojęć
  const m1=el('button','minitile gold a-up d1',icon('star',{size:17,fill:false,stroke:2.6,cls:'ic-gold'})+`<span id="missionTile">${missionLabel()}</span>`);
  m1.onclick=()=>go('missions');mini.appendChild(m1);
  const n=streakDisplay();
  const m2=el('button','minitile amber a-up d2',icon('flame',{size:17,cls:'ic-flame'})+`<span>Seria ${n}</span>`);
  m2.setAttribute('aria-label',`Seria: ${n} ${pl(n,'dzień','dni','dni')}`);m2.onclick=()=>go('streak');mini.appendChild(m2);
  const alb=albumCount();
  const m3=el('button','minitile cyan a-up d3',icon('cards',{size:17,stroke:2.6,cls:'ic-cyan'})+`<span>Album ${alb.n}</span>`);
  m3.setAttribute('aria-label',`Album pojęć: ${alb.n} z ${alb.m}`);m3.onclick=()=>go('album');mini.appendChild(m3);
  scroll.appendChild(mini);
  scroll.appendChild(renderPlan(items));
  const hdr=el('div','sechdr','<span class="eyebrow">Twoje przedmioty</span>');
  const all=el('button','link','Wszystkie '+icon('chevron-right',{size:14,stroke:3}));all.onclick=()=>go('subjects');hdr.appendChild(all);
  scroll.appendChild(hdr);
  const withP=SUBJECTS.filter(hasProgress),rest=SUBJECTS.filter(s=>!hasProgress(s));
  scroll.appendChild(subjectGrid(withP.concat(rest).slice(0,3),true));
}

/* ============================================================ PRZEDMIOTY (dawny wybór przedmiotu → kafle) */
function renderSubjects(){
  const scroll=shell('subjects',{blob:true,cls:'subjects'});
  const n=SUBJECTS.length;
  scroll.appendChild(el('div','',`<div class="eyebrow">${n} ${pl(n,'przedmiot','przedmioty','przedmiotów')}</div><h1>Przedmioty</h1>`));
  scroll.appendChild(subjectGrid(SUBJECTS,true));
}

/* ============================================================ PROFIL (statystyki z postępów; pełna wersja w kroku 8–9) */
function renderProfile(){
  const gear=el('button','backbtn',icon('settings',{size:19,stroke:2.4}));gear.setAttribute('aria-label','Ustawienia');gear.onclick=()=>go('settings');
  const scroll=shell('profile',{blob:true,cls:'profile',title:'Profil',pills:false,right:gear});
  const tot=totalXP();
  const lvls=SUBJECTS.reduce((a,s)=>{const st=PROGRESS[s.id];return a+s.levels.filter(l=>st&&st.levels&&st.levels[l.id]&&st.levels[l.id].done).length;},0);
  const lvTotal=SUBJECTS.reduce((a,s)=>a+s.levels.length,0);
  const started=SUBJECTS.filter(hasProgress);
  const n=streakDisplay(),best=Math.max(META.best||0,n);
  const lvlNum=Math.floor(tot/100)+1,lvlPct=tot%100;
  const all=srsEntries(),mem=srsStats(all);
  scroll.appendChild(el('div','prof',`<div class="avatar a-pop">${icon('user',{size:34,stroke:2.6})}</div>
    <div class="pmeta"><h2>Twój profil</h2><div class="s">lokalnie, bez konta</div>
    <div class="planbar"><div class="bar"><i class="a-grow d2" style="width:${lvlPct}%"></i></div><span>lvl ${lvlNum}</span></div></div>`));
  const stats=el('div','grid2 stats');
  const stat=(cls,ic,k,v,s,onclick)=>{const d=el(onclick?'button':'div','stat a-up '+cls,`<div class="k">${ic}<span>${k}</span></div><div class="v">${v}</div><div class="s">${s}</div>`);if(onclick)d.onclick=onclick;stats.appendChild(d);};
  stat('d1',icon('flame',{size:16,cls:'ic-flame a-beat'}),'Seria',`${n} ${pl(n,'dzień','dni','dni')}`,'rekord '+best,()=>go('streak'));
  stat('d2',icon('bolt',{size:16,cls:'ic-gold'}),'XP łącznie',fmtNum(tot),'+'+daily().xp+' dzisiaj');
  stat('d3',icon('refresh',{size:16,stroke:2.8,cls:'ic-cyan'}),'Utrwalone',mem.firm,all.length?`z ${all.length} ${pl(all.length,'pojęcia','pojęć','pojęć')} w powtórce`:'pojęć w powtórce',()=>go('review'));
  stat('d4',icon('check',{size:16,stroke:2.8,cls:'ic-acid'}),'Poziomy',lvls,'z '+lvTotal+' zaliczone');
  scroll.appendChild(stats);
  // nagłówek sekcji z linkiem „Wszystkie ›” (Profile.html)
  const sec=(t,lab,go_)=>{const h=el('div','sechdr','<span class="eyebrow sec">'+t+'</span>');const a=el('button','link',lab+' '+icon('chevron-right',{size:14,stroke:3}));a.onclick=go_;h.appendChild(a);scroll.appendChild(h);};
  sec('Aktywność — 8 tygodni','Ten tydzień',()=>openWeekly('this')); // krok 9: podsumowanie tygodnia
  scroll.appendChild(heatmap());
  sec('Odznaki','Album pojęć',()=>go('album')); // krok 8
  checkBadges();scroll.appendChild(badgeGrid());
  // krok 9: liga i znajomi wymagają konta — uczciwe ekrany „wersja online”
  scroll.appendChild(el('div','eyebrow sec','Razem z innymi'));
  const soc=el('div','setcard a-up d4');
  [['trophy','ic-gold','Liga tygodniowa','dywizje i ranking XP','league'],['users','ic-pink','Znajomi','kody, zaproszenia, wspólny tydzień','friends']].forEach(([ic,cls,t,s_,key],i)=>{
    if(i)soc.appendChild(el('div','setsep'));
    const r=el('button','setrow',icon(ic,{size:20,stroke:2.4,cls})+`<div class="grow"><div class="t">${t}</div><div class="s">${s_} · wersja online</div></div>`+icon('chevron-right',{size:18,cls:'chev'}));
    r.id='soc-'+key;r.onclick=()=>openComing(key);soc.appendChild(r);
  });
  scroll.appendChild(soc);
  sec('XP w przedmiotach','Wszystkie',()=>go('subjects'));
  const card=el('div','setcard a-up d5');
  started.forEach((s,i)=>{
    if(i)card.appendChild(el('div','setsep'));
    const r=el('button','setrow themed');r.style.setProperty('--accent',s.accent);if(s.onAccent)r.style.setProperty('--on-accent',s.onAccent);
    r.innerHTML=`${mono(initial(s.short||s.name),'solid xs')}<span class="t grow">${s.short||s.name}</span><span class="v">${fmtNum(subjState(s.id).xp)} xp</span>${icon('chevron-right',{size:18,cls:'chev'})}`;
    r.onclick=()=>openSubject(s.id);card.appendChild(r);
  });
  if(!started.length)card.appendChild(el('div','setrow','<span class="t grow muted">Jeszcze nic — zacznij od planu na dziś.</span>'));
  scroll.appendChild(card);
}
/* kostki aktywności: 8 kolumn (tygodnie, od najstarszego) × 7 dni (pn–nd); „on” = dzień w bieżącej serii z nauka_meta_v1, przyszłość wyszarzona */
function heatmap(){
  const t=todayStr();const now=new Date();const dow=(now.getDay()+6)%7;
  const n=streakDisplay(),last=META.lastDay;
  const box=el('div','heat a-up d2');box.setAttribute('aria-label','Aktywność w ostatnich 8 tygodniach');
  for(let w=0;w<8;w++){
    const col=el('div','col');
    for(let d=0;d<7;d++){
      const dt=new Date(now.getFullYear(),now.getMonth(),now.getDate()-dow-(7-w)*7+d);const ds=dstr(dt);const toToday=dayDiff(ds,t);
      let cls='';if(toToday<0)cls='future';else if(n>0&&last){const off=dayDiff(ds,last);if(off>=0&&off<n)cls='on';}
      if(toToday===0)cls+=' today';
      col.appendChild(el('i',cls.trim()));
    }
    box.appendChild(col);
  }
  return box;
}

/* ============================================================ USTAWIENIA (Settings.html, krok 9: pełna wersja)
   Profil (etap i cel → LevelPick, cel dzienny → Onboarding, motyw → Plecak) · Nauka (dźwięk, animacje, życia) · Powiadomienia (godzina zapisana lokalnie —
   powiadomienia wymagają aplikacji mobilnej) · Przedmioty · Dane (eksport JSON przez Blob, import z pliku, reset) · O aplikacji (wersja, co nowego). */
const CHANGELOG=[
  ['2.0','Pierwsze uruchomienie, katalog, pełne ustawienia z eksportem, tydzień w liczbach, noc przed egzaminem, poprawianie pytań, źródła, tryb offline'],
  ['krok 8','Gemy i plecak, misje, zamrożenia serii, album pojęć, boss rozdziału, duch, odznaki'],
  ['krok 7','Egzamin z siatką pytań, flagami i oceną; plan do sprawdzianu dzień po dniu'],
  ['krok 6','Nawigacja z plusem, arkusz „Dodaj materiał”, wyjaśnij inaczej, powtórka na interwałach'],
  ['krok 5','Szesnaście typów zadań: od prawda/fałsz po schematy i równania krok po kroku'],
  ['krok 4','Ścieżka ze skrzyniami, roladka, quiz z panelem dobrze/źle, życia i combo'],
  ['krok 3','Ekran Dziś z planem dnia, kafle przedmiotów, profil i seria'],
  ['krok 1–2','Nowa skóra na tokenach i ikony SVG zamiast emoji']
];
const LEVEL_NAME={podstawowka:'Podstawówka',liceum:'Liceum / technikum',studia:'Studia',inne:'Inne'};
const LEVEL_CHIP={podstawowka:'Podstawówka',liceum:'Liceum',studia:'Studia',inne:'Inne'}; // krok 9: krótkie nazwy na chipach katalogu
const GOAL_NAME={sprawdziany:'kartkówki i sprawdziany','matura-p':'matura podstawowa','matura-r':'matura rozszerzona',olimpiada:'olimpiada',sesja:'sesja i kolokwia',wlasny:'własny cel'};
function toggleBtn(on,label,onChange){const tg=el('button','toggle'+(on?' on':''),'<i></i>');tg.setAttribute('role','switch');tg.setAttribute('aria-checked',String(!!on));tg.setAttribute('aria-label',label);
  tg.onclick=()=>{const v=!tg.classList.contains('on');tg.classList.toggle('on',v);tg.setAttribute('aria-checked',String(v));onChange(v);};return tg;}
function renderSettings(){
  const scroll=shell('settings',{cls:'settings',title:'Ustawienia',pills:false,back:()=>go('profile'),blob:'acid'});
  const card=(cls)=>el('div','setcard a-up '+(cls||''));
  const linkRow=(ic,t,v,go_,id)=>{const r=el('button','setrow',(ic?icon(ic,{size:20,stroke:2.4}):'')+`<div class="grow"><div class="t">${t}</div>${v&&v.s?`<div class="s">${v.s}</div>`:''}</div>${v&&v.v?`<span class="v acid">${v.v}</span>`:''}`+icon('chevron-right',{size:18,cls:'chev'}));if(id)r.id=id;r.onclick=go_;return r;};
  const sep=()=>el('div','setsep');
  // Profil
  scroll.appendChild(el('div','eyebrow sec','Profil'));
  const c0=card('d1');
  const lvl=META.level?LEVEL_NAME[META.level]||META.level:'nie wybrano';const gl=META.goal?GOAL_NAME[META.goal]||META.goal:'';
  c0.appendChild(linkRow('cap','Etap i cel',{s:lvl+(gl?' · '+gl:'')},()=>openLevelPick('settings'),'set-level'));c0.appendChild(sep());
  c0.appendChild(linkRow('bolt','Cel dzienny',{v:goalXP()+' XP',s:'plan dnia, pasek XP i misja XP'},()=>openOnboarding('settings'),'set-goal'));c0.appendChild(sep());
  const th=THEMES.find(t=>t[0]===(PROGRESS.theme||'violet'))||THEMES[0];
  c0.appendChild(linkRow('palette','Motyw',{v:th[1],s:themes().length+' z '+THEMES.length+' zestawów · kolejne w plecaku'},()=>go('shop'),'set-theme'));
  scroll.appendChild(c0);
  // Nauka
  scroll.appendChild(el('div','eyebrow sec','Nauka'));
  const c1=card('d2');
  const snd=el('div','setrow','<div class="grow"><div class="t">Dźwięk</div><div class="s">ta wersja nie ma jeszcze efektów dźwiękowych — ustawienie zostaje zapisane</div></div>');
  snd.appendChild(toggleBtn(META.sound!==false,'Dźwięk',v=>{META.sound=v;saveMeta();}));c1.appendChild(snd);c1.appendChild(sep());
  const rm=el('div','setrow','<div class="grow"><div class="t">Ogranicz animacje</div><div class="s">własny przełącznik, niezależny od ustawień telefonu</div></div>');
  rm.appendChild(toggleBtn(!!META.reduceMotion,'Ogranicz animacje',v=>{META.reduceMotion=v;saveMeta();applyMotion();}));c1.appendChild(rm);c1.appendChild(sep());
  const h=hearts();const eta=heartEta();
  const hr=el('button','setrow',icon('heart',{size:20,cls:'ic-red'})+`<div class="grow"><div class="t">Życia</div><div class="s">${h.n} z ${HEARTS_MAX} · jedno wraca co 30 min${eta?' · następne za '+etaText(eta):''} · ${HEART_REV} fiszek = +1</div></div>`);
  hr.onclick=()=>toast(eta?'Kolejne życie za '+etaText(eta):'Pełne życia','heart');c1.appendChild(hr);
  scroll.appendChild(c1);
  // Powiadomienia
  scroll.appendChild(el('div','eyebrow sec','Powiadomienia'));
  const c2=card('d3');
  const rem=META.reminder||{on:false,at:'19:30'};
  const rr=el('div','setrow','<div class="grow"><div class="t">Przypomnienie o nauce</div><div class="s">codziennie o wybranej godzinie</div></div>');
  const ti=el('input');ti.type='time';ti.value=rem.at||'19:30';ti.className='settime';ti.setAttribute('aria-label','Godzina przypomnienia');ti.id='set-remtime';
  ti.onchange=()=>{META.reminder={on:!!(META.reminder||{}).on,at:ti.value||'19:30'};saveMeta();};rr.appendChild(ti);
  rr.appendChild(toggleBtn(!!rem.on,'Przypomnienie o nauce',v=>{META.reminder={on:v,at:ti.value||'19:30'};saveMeta();if(v)toast('Godzina zapisana','bell');}));
  c2.appendChild(rr);c2.appendChild(sep());
  c2.appendChild(el('div','setrow note',icon('info',{size:18,stroke:2.4})+'<div class="grow"><div class="s">Powiadomienia wymagają aplikacji mobilnej. Ta wersja zapisuje tylko godzinę — na tym urządzeniu.</div></div>'));
  scroll.appendChild(c2);
  // Przedmioty
  scroll.appendChild(el('div','eyebrow sec','Przedmioty'));
  const c3=card('d4');
  SUBJECTS.forEach((s,i)=>{
    if(i)c3.appendChild(sep());
    const r=el('button','setrow themed');r.style.setProperty('--accent',s.accent);if(s.onAccent)r.style.setProperty('--on-accent',s.onAccent);
    r.innerHTML=`${mono(initial(s.short||s.name),'solid xs')}<span class="t grow">${s.short||s.name}</span>${icon('chevron-right',{size:18,cls:'chev'})}`;
    r.onclick=()=>openSubject(s.id);c3.appendChild(r);
  });
  if(SUBJECTS.length)c3.appendChild(sep());
  c3.appendChild(linkRow('grid','Katalog przedmiotów',{s:'gotowe przedmioty według etapu'},()=>go('catalog'),'set-catalog'));c3.appendChild(sep());
  const add=el('button','setrow acid',icon('plus',{size:20,stroke:3})+'<span class="t grow">Dodaj materiał</span>');
  add.onclick=()=>openQuickAdd();c3.appendChild(add);
  scroll.appendChild(c3);
  // Dane
  scroll.appendChild(el('div','eyebrow sec','Dane'));
  const c4=card('d5');
  const n=Object.keys(history()).length;
  c4.appendChild(linkRow('download','Eksportuj postępy',{s:'plik JSON: XP, poziomy, powtórki, plany, ustawienia'},exportData,'set-export'));c4.appendChild(sep());
  const imp=linkRow('upload','Importuj z pliku',{s:'zastąpi obecne postępy tym z pliku'},()=>fileInp.click(),'set-import');
  const fileInp=el('input');fileInp.type='file';fileInp.accept='.json,application/json';fileInp.id='set-importfile';fileInp.className='hiddenfile';fileInp.setAttribute('aria-label','Plik z postępami');
  fileInp.onchange=()=>{const f=fileInp.files&&fileInp.files[0];if(f)importData(f);fileInp.value='';};
  imp.appendChild(fileInp);c4.appendChild(imp);c4.appendChild(sep());
  const reset=el('button','setrow',icon('refresh',{size:20,stroke:2.6,cls:'ic-red'})+`<div class="grow"><div class="t red">Wyzeruj postępy</div><div class="s">XP, gwiazdki, gemy, album, odznaki, plany${n?' · dziennik: '+n+' '+pl(n,'dzień','dni','dni'):''}. Seria zostaje.</div></div>`);
  reset.id='set-reset';
  reset.onclick=()=>{
    if(!confirm('Na pewno? Skasuje XP, gwiazdki, gemy, album, odznaki, plan dnia, wyniki egzaminów i plany do sprawdzianów. Seria zostaje.'))return;
    PROGRESS={};saveProgress();qState=null;fState=null;exCfg=null;tpId=null;
    renderSettings();toast('Postępy wyzerowane','refresh');
  };
  c4.appendChild(reset);scroll.appendChild(c4);
  // O aplikacji
  scroll.appendChild(el('div','eyebrow sec','O aplikacji'));
  const c5=card('d6');
  c5.appendChild(el('div','setrow',icon('info',{size:20,stroke:2.4})+`<div class="grow"><div class="t">Nauka ${VERSION}</div><div class="s">wersja ${VERSION} · offline, bez konta · dane tylko na tym urządzeniu</div></div>`));
  c5.appendChild(sep());
  const wn=el('button','setrow',icon('list',{size:20,stroke:2.4})+'<div class="grow"><div class="t">Co nowego</div><div class="s">kroki wdrożenia designu 2.0</div></div>'+icon('chevron-down',{size:18,cls:'chev'}));wn.id='set-whatsnew';
  const log=el('div','changelog');log.hidden=true;
  CHANGELOG.forEach(([v,t])=>log.appendChild(el('div','chrow',`<b>${v}</b><span>${t}</span>`)));
  wn.onclick=()=>{log.hidden=!log.hidden;wn.querySelector('.chev').outerHTML=icon(log.hidden?'chevron-down':'chevron-up',{size:18,cls:'chev'});};
  c5.appendChild(wn);c5.appendChild(log);scroll.appendChild(c5);
  scroll.appendChild(el('div','version',`Nauka ${VERSION} · legacy · wersja ${VERSION}`));
}
/* eksport = plik JSON przez Blob URL (działa z file://); import = FileReader + potwierdzenie; format: {app:"nauka", version, exportedAt, progress, meta} */
function exportData(){
  const data={app:'nauka',version:VERSION,exportedAt:new Date().toISOString(),progress:PROGRESS,meta:META};
  const blob=new Blob([JSON.stringify(data,null,1)],{type:'application/json'});const url=URL.createObjectURL(blob);
  const a=el('a');a.href=url;a.download='nauka-postepy-'+todayStr()+'.json';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Plik z postępami zapisany','download');
}
function importData(file){
  const r=new FileReader();
  r.onload=()=>{try{
      const d=JSON.parse(String(r.result||''));const p=d&&d.app==='nauka'?d.progress:(d&&typeof d==='object'&&!Array.isArray(d)&&('daily' in d||'srs' in d||SUBJECTS.some(s=>s.id in d))?d:null);
      if(!p||typeof p!=='object')throw new Error('format');
      if(!confirm('Wczytać postępy z pliku? Obecne zostaną zastąpione.'))return;
      PROGRESS=p;if(d.meta&&typeof d.meta==='object')META=d.meta;saveProgress();saveMeta();applyMotion();
      qState=null;fState=null;exCfg=null;tpId=null;syncTests();
      renderSettings();toast('Postępy wczytane','check');
    }catch(e){toast('To nie jest plik z postępami Nauki','alert');}};
  r.onerror=()=>toast('Nie udało się odczytać pliku','alert');
  r.readAsText(file);
}

/* ============================================================ SERIA (Streak.html: płomień, licznik, kropki tygodnia z nauka_meta_v1) */
function weekDots(){
  const t=todayStr();const now=new Date();const dow=(now.getDay()+6)%7; // 0 = poniedziałek
  const mon=new Date(now.getFullYear(),now.getMonth(),now.getDate()-dow);
  const n=streakDisplay(),last=META.lastDay;const out=[];
  for(let i=0;i<7;i++){
    const d=new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+i);const ds=dstr(d);
    const toToday=dayDiff(ds,t); // >0 przeszłość, 0 dziś, <0 przyszłość
    let st='miss';
    if(toToday<0)st='future';
    else if(n>0&&last){const off=dayDiff(ds,last);if(off>=0&&off<n)st='done';}
    if(toToday===0)st=(st==='done')?'todaydone':'today';
    if(toToday>0&&(META.frozenDays||[]).indexOf(ds)>=0)st='frozen'; // krok 8: dzień uratowany zamrożeniem
    out.push({lab:DAYS_S[(i+1)%7],st});
  }
  return out;
}
function renderStreak(){
  app.innerHTML='';
  const sc=el('div','screen active');
  sc.appendChild(el('div','streakbg'));sc.appendChild(el('div','blob a-float amber'));
  const scroll=el('div','scroll streakview');
  const close=el('button','streakclose',icon('close',{size:18,stroke:3}));close.setAttribute('aria-label','Zamknij');close.onclick=()=>go('today');
  scroll.appendChild(close);
  const n=streakDisplay(),best=Math.max(META.best||0,n);
  const left=best-n+1;
  const msg=n===0?'Zrób dziś jedno zadanie z planu i seria startuje.':(n>=best?'To twój rekord. Nie przerywaj.':`Rekord to ${best}. Jeszcze ${left} ${pl(left,'dzień','dni','dni')} i bijesz swój wynik.`);
  scroll.appendChild(el('div','streakhero',`${icon('flame',{size:118,cls:'ic-flame a-beat'})}<div class="streakn a-pop">${n}</div><div class="streakt">${n===1?'dzień z rzędu':'dni z rzędu'}</div><div class="streakp">${msg}</div>`));
  const week=el('div','week');
  week.innerHTML='<div class="eyebrow">Ten tydzień</div><div class="days">'+weekDots().map((d,i)=>{
    const ic=d.st==='done'?icon('check',{size:19,stroke:3.6}):d.st==='frozen'?icon('snow',{size:18,stroke:2.8}):(d.st==='todaydone'||d.st==='today')?icon('flame',{size:18}):'';
    return `<div class="day ${d.st}"><div class="dot a-up d${Math.min(6,i+1)}">${ic}</div><span>${d.lab}</span></div>`;
  }).join('')+'</div>';
  scroll.appendChild(week);
  scroll.appendChild(freezeCard()); // krok 8
  const foot=el('div','streakfoot');
  const b=el('button','pill amber a-glow','Wracam do nauki');b.onclick=()=>go('today');foot.appendChild(b);
  scroll.appendChild(foot);
  sc.appendChild(scroll);app.appendChild(sc);
  app.appendChild(el('div','toast',''));app.lastChild.id='toast';
}

/* ============================================================ PUSTY STAN (EmptyState.html — brak plików w data/) */
function renderEmpty(){
  app.innerHTML='';
  const sc=el('div','screen active');
  sc.appendChild(el('div','blob a-float acid'));sc.appendChild(el('div','blob a-float d3 pink'));
  const scroll=el('div','scroll empty');
  const steps=[['Dodajesz zdjęcia, pliki i notatki','strona z podręcznika, PDF, PPTX, wklejony tekst'],['Powstają poziomy, fiszki i pytania','możesz wszystko poprawić przed startem'],['Uczysz się po 10 minut dziennie','materiał wraca tuż przed zapomnieniem']];
  scroll.innerHTML=`<div class="logo brand">NAUKA<span class="g">.</span></div>
    <div class="art"><div class="art-a a-sway"></div><div class="art-b a-sway d2"></div><div class="art-c a-bob">${icon('upload',{size:58,stroke:2.4})}</div></div>
    <div class="a-up d1"><h1>Zacznij od pierwszego przedmiotu</h1><p>Dodaj materiały z zajęć. Reszta powstanie sama.</p></div>
    <div class="steps">${steps.map((s,i)=>`<div class="step a-up d${i+2}"><div class="num">${i+1}</div><div><div class="t">${s[0]}</div><div class="s">${s[1]}</div></div></div>`).join('')}</div>
    <div class="efoot"><button class="pill a-glow" id="eadd">Dodaj materiał</button></div>`;
  sc.appendChild(scroll);app.appendChild(sc);
  app.appendChild(el('div','toast',''));app.lastChild.id='toast';
  document.getElementById('eadd').onclick=()=>openAddInfo('any');
}

/* ============================================================ KROK 4: życia, combo, panel dobrze/źle, kafle quizu, konfetti
   Życia (DESIGN.md §4.3) w tym samym kluczu: PROGRESS.hearts={n, refillAt, quest?}.
   −1 za błąd w quizie lekcji (nie w zakładce Quiz, nie w egzaminie); regeneracja 1/30 min liczona z refillAt przy odczycie. */
const HEARTS_MAX=5, HEART_MS=30*60*1000, HEART_REV=10, REFILL_GEMS=50; // krok 8: uzupełnienie serc za gemy
function hearts(){
  let h=PROGRESS.hearts;
  if(!h||typeof h.n!=='number'){h=PROGRESS.hearts={n:HEARTS_MAX,refillAt:null};saveProgress();}
  const now=Date.now();let ch=false;
  while(h.n<HEARTS_MAX&&h.refillAt&&now>=h.refillAt){h.n++;h.refillAt+=HEART_MS;ch=true;}
  if(h.n>=HEARTS_MAX&&h.refillAt){h.refillAt=null;ch=true;}
  if(ch)saveProgress();
  return h;
}
function loseHeart(){const h=hearts();if(h.n>0){h.n--;if(!h.refillAt)h.refillAt=Date.now()+HEART_MS;saveProgress();}updateHearts();return h.n;}
function gainHeart(n){const h=hearts();h.n=Math.min(HEARTS_MAX,h.n+(n||1));if(h.n>=HEARTS_MAX)h.refillAt=null;saveProgress();updateHearts();return h.n;}
function heartEta(){const h=hearts();return (h.n>=HEARTS_MAX||!h.refillAt)?0:Math.max(0,h.refillAt-Date.now());}
function etaText(ms){const m=Math.max(1,Math.ceil(ms/60000));return m>=60?`${Math.floor(m/60)} h ${m%60} min`:`${m} ${pl(m,'minutę','minuty','minut')}`;}
/* „serce za N fiszek”: zadanie odzyskania życia (z panelu Koniec żyć), liczone w renderFiszki */
function heartReview(){const h=hearts();if(!h.quest)return;h.quest--;if(h.quest<=0){delete h.quest;gainHeart();setTimeout(()=>toast('Życie odzyskane: +1','heart'),350);}saveProgress();}
/* pigułka serc (przycisk: tap = kiedy wraca życie); .n aktualizowane przez updateHearts() */
function heartsPill(o){
  o=o||{};const h=hearts();
  const b=el('button','hearts'+(o.beat?' a-beat':'')+(h.n===0?' zero':''),icon('heart',{size:o.size||16,cls:o.iconBeat?'a-beat':''})+`<span class="n">${h.n}</span>`);
  b.setAttribute('aria-label','Życia: '+h.n+' z '+HEARTS_MAX);
  b.onclick=()=>{const e=heartEta();toast(e?'Kolejne życie za '+etaText(e):'Pełne życia','heart');};
  return b;
}
function updateHearts(){const n=hearts().n;document.querySelectorAll('.hearts').forEach(p=>{const s=p.querySelector('.n');if(s)s.textContent=n;p.classList.toggle('zero',n===0);});}
/* combo: kolejne poprawne w lekcji; mnożnik XP ×2 od 5, ×3 od 10 */
function comboMult(c){return c>=10?3:c>=5?2:1;}
const ORD=['','Pierwsza','Druga','Trzecia','Czwarta','Piąta','Szósta','Siódma','Ósma','Dziewiąta','Dziesiąta'];
function comboText(c){return c>=2?((ORD[c]||c+'.')+' poprawna z rzędu'):'Tak trzymaj';}

/* klawiatura: jeden nasłuch (INIT), bieżący widok podstawia keyFn; advOk = ochrona przed podwójnym „dalej” (tap + Enter) */
let keyFn=null,lastAdv=0,nhInt=null;
function advOk(){const t=Date.now();if(t-lastAdv<350)return false;lastAdv=t;return true;}

/* konfetti: n kawałków .a-fall z różnym opóźnieniem (d1…d6) i kolorem tylko z tokenów (--c) */
const CONF=['pink','cyan','gold','acid'];
function confetti(n){
  const c=el('div','confetti');c.setAttribute('aria-hidden','true');
  for(let i=0;i<n;i++){const p=el('i','a-fall'+(i%7?' d'+(i%7):'')+(i%3===1?' round':''));p.style.cssText=`left:${(i*37+11)%92}%;top:${(i*53+40)%300}px;--c:var(--${CONF[i%4]});--s:${7+(i*5)%7}px`;c.appendChild(p);}
  return c;
}

/* panel od dołu (.sheet.ok / .bad / .nohearts): jeden na raz, [data-primary] = przycisk pod Enter */
function openSheet(kind,html){
  closeSheet();
  const s=el('div','sheet a-rise '+kind,html);s.id='sheet';s.setAttribute('role','dialog');
  app.appendChild(s);
  keyFn=e=>{if(e.key==='Enter'||e.key===' '){const b=s.querySelector('[data-primary]');if(b){e.preventDefault();b.click();}}};
  return s;
}
function closeSheet(){const s=document.getElementById('sheet');if(s)s.remove();const b=document.getElementById('sheetback');if(b)b.remove();clearInterval(nhInt);keyFn=null;}
function sheetBack(){if(!document.getElementById('sheetback')){const b=el('div','sheetback');b.id='sheetback';app.appendChild(b);}}
/* dobrze: ikona, „Dobrze!”, combo, chip +XP (z mnożnikiem), wyjaśnienie e, DALEJ */
function sheetOk(q,o){
  const s=openSheet('ok',`<div class="srow"><div class="sico a-pop d2">${icon('check',{size:26,stroke:3.6})}</div>
    <div class="grow"><div class="st">Dobrze!</div><div class="ss">${comboText(o.combo)}</div></div>
    <span class="xpchip a-pop d3">+${o.xp} XP${o.mult>1?' ×'+o.mult:''}</span></div>
    ${q.e?`<div class="sbox"><div class="lbl">Dlaczego</div><div>${q.e}</div>${srcLine(q)}</div>`:srcLine(q)}
    <button class="pill" id="snext" data-primary>DALEJ</button>`);
  s.querySelector('#snext').onclick=()=>{if(!advOk())return;closeSheet();o.onNext();};
  wireSrc(s,q,o,()=>sheetOk(q,o)); // krok 9: „Źródło” → arkusz SourceView
  return s;
}
/* źle: „Nie tym razem”, poprawna litera, wyjaśnienie, [WYJAŚNIJ INACZEJ] DALEJ. o={onNext, onCards?, sub?, subj?, lv?} */
function sheetBad(q,o){
  const sub=o.sub!=null?o.sub:(q.c!=null?'Poprawna: odpowiedź '+keys[q.c]:'');
  const s=openSheet('bad',`<div class="srow"><div class="sico">${icon('close',{size:24,stroke:3.6})}</div>
    <div class="grow"><div class="st">Nie tym razem</div>${sub?`<div class="ss">${sub}</div>`:''}</div></div>
    ${q.e?`<div class="sbox"><div class="lbl">Zapamiętaj</div><div>${q.e}</div>${srcLine(q)}</div>`:srcLine(q)}
    <div class="sbtns">${q.q?'<button class="pill ghost red" id="sexpl">WYJAŚNIJ INACZEJ</button>':''}<button class="pill red" id="snext" data-primary>DALEJ</button></div>
    ${q.q&&o.subj&&o.lv&&o.qi!=null?`<button class="pill text sm" id="sedit">${icon('edit',{size:15})} Zgłoś / popraw pytanie</button>`:''}`);
  s.querySelector('#snext').onclick=()=>{if(!advOk())return;closeSheet();o.onNext();};
  const x=s.querySelector('#sexpl');if(x)x.onclick=()=>openExplain(q,o);
  const ed=s.querySelector('#sedit');if(ed)ed.onclick=()=>openEditContent(o.subj,o.lv,o.qi,{onBack:()=>sheetBad(q,o),onSaved:nq=>sheetBad({...q,...nq},o)}); // krok 9: EditContent
  wireSrc(s,q,o,()=>sheetBad(q,o)); // krok 9: „Źródło” → arkusz SourceView
  return s;
}
/* krok 9: linia „Źródło” (src:{material,page,quote}) jako przycisk → arkusz SourceView; wireSrc podpina ją w panelach dobrze/źle */
function srcLine(q){const src=q&&q.src;if(!src)return '';const parts=[src.material?'materiał '+src.material:'',src.page?'s. '+src.page:''].filter(Boolean).join(' · ');
  return `<button class="rsrc" type="button">${icon('file',{size:14})}<span>${parts?'<b>Źródło:</b> '+parts:'<b>Źródło</b>'}${src.quote?' — „'+src.quote+'”':''}</span>${icon('chevron-right',{size:14,cls:'chev'})}</button>`;}
function wireSrc(sheet,q,o,back){const b=sheet.querySelector('.rsrc');if(b)b.onclick=()=>openSourceView(q,{s:o.subj,lv:o.lv,qi:o.qi},back);}
/* „Wyjaśnijmy inaczej” (Explain.html) — offline: alternatywne wyjaśnienia, które już są w danych (fiszka z poziomu, „prościej”/„zapamiętaj” z roladki,
   dobrane po wspólnych słowach z pytaniem), w ostateczności wyjaśnienie e innymi słowami. Świeże wyjaśnienie AI wymaga wersji online (DESIGN.md §5). */
const STOP=new Set(['jest','jak','czym','ktore','ktory','ktora','jaki','jaka','jakie','oraz','albo','lub','nie','tak','dla','sie','przez','tego','tym','ten','czy','ile','kto','gdzie','kiedy','moze','jego','jej','ich','tylko','bardzo','oznacza','polega','rozni','przyklad','wedlug','miedzy','pod','nad','przy','bez','jako','tzw','jakiego','jakiej','jakim','wobec','ktorych','ktorym','czego','czemu','dlaczego','zawsze','nigdy','wszystkie','wszystkich','nazywa','nazywamy','ktora','byla','byly','beda','bedzie','jednak','wtedy','niz','ktorego','robi','ma','ile','sa']);
function words(str){return fold(String(str||'').replace(/<[^>]+>/g,' ')).split(' ').filter(w=>w.length>=4&&!STOP.has(w));}
function stem(w){return w.length>6?w.slice(0,w.length-2):w.length>4?w.slice(0,w.length-1):w;} // prosty rdzeń: obcina końcówkę fleksyjną
function overlap(qs,txt){const t=new Set(words(txt).map(stem));let k=0;qs.forEach(w=>{if(t.has(w))k++;});return k;}
function explainFor(q,subj,lv){
  const s=subj||current;if(!s)return {};
  const qs=[...new Set(words(q.q+' '+(q.c!=null&&q.a?q.a[q.c]:'')).map(stem))];
  const pick=(lvls,list,score)=>{let best=null,bs=0;lvls.forEach(l=>list(l).forEach(x=>{const sc=score(x);if(sc>bs){bs=sc;best=x;}}));return best;};
  const lvOrder=lv?[lv].concat(s.levels.filter(l=>l!==lv)):s.levels;
  const card=pick(lvOrder,l=>l.flashcards||[],c=>overlap(qs,c.t)*3+overlap(qs,c.d));
  const feed=pick(lvOrder,l=>(l.feed||[]).filter(f=>f.real||f.mnemo),f=>overlap(qs,f.title)*3+overlap(qs,f.body)+overlap(qs,f.real)+overlap(qs,f.mnemo));
  return {card,feed};
}
function openExplain(q,o){
  const {card,feed}=explainFor(q,o.subj,o.lv);
  const parts=[];const chips=[];
  if(q.c!=null&&q.a)parts.push(`<span class="lbl">Poprawna odpowiedź</span><b>${q.a[q.c]}</b>`);
  if(card){parts.push(`<span class="lbl">Fiszka</span><b>${card.t}</b> — ${card.d}`);chips.push('Fiszka');}
  if(feed&&feed.real){parts.push(`<span class="lbl">Prościej</span>${feed.real}`);chips.push('Prościej');}
  if(feed&&feed.mnemo){parts.push(`<span class="lbl">Zapamiętaj</span>${feed.mnemo}`);chips.push('Zapamiętaj');}
  if(!card&&!feed){parts.push(`<span class="lbl">Innymi słowy</span>${q.e||'Zapamiętaj poprawną odpowiedź i wróć do fiszek z tego poziomu.'}`);chips.push('Wyjaśnienie');}
  const s=openSheet('explain',`<div class="exhead"><div class="ico a-pop">${icon('bulb',{size:24,stroke:2.6})}</div><div class="grow"><div class="st2">Wyjaśnijmy inaczej</div></div></div>
    <div class="exchips">${chips.map((c,i)=>`<span class="exchip${i?'':' on'}">${c}</span>`).join('')}</div>
    <div class="exbox a-up d2">${parts.join('<div class="exsep"></div>')}</div>
    <div class="exnote a-up d3">${icon('wifi',{size:15})}<span>To wyjaśnienia z materiałów. Nowe, dopasowane do ciebie tworzy AI na bieżąco — wymaga wersji online.</span></div>
    <div class="sbtns">${o.onCards?'<button class="pill ghost" id="scards">Do fiszek</button>':''}<button class="pill cyan" id="sok" data-primary>ROZUMIEM</button></div>
    <button class="pill text sm" id="sai">${icon('bulb',{size:15})} Jeszcze inaczej — z AI (wersja online)</button>`);
  s.querySelector('#sok').onclick=()=>{sheetBad(q,o);};
  const c=s.querySelector('#scards');if(c)c.onclick=()=>{closeSheet();o.onCards();};
  s.querySelector('#sai').onclick=()=>openComingSheet('explain',()=>openExplain(q,o)); // krok 9: uczciwy arkusz „wymaga wersji online”
  return s;
}
/* Koniec żyć (NoHearts.html): licznik do następnego życia, „Powtórz N fiszek” (+1 życie), „Wróć później”.
   inLesson=true → lekcja przerwana (poziom niezaliczony); gemy/„Uzupełnij wszystkie” dojdą w kroku 8. */
function showNoHearts(o){
  o=o||{};
  const s=openSheet('nohearts',`<div class="nhh">${[0,1,2,3,4].map(()=>icon('heart',{size:30,fill:false,stroke:2.2})).join('')}</div>
    <div class="nht"><div class="st a-pop d1">Koniec żyć</div><div class="ss">Kolejne życie wraca za <b class="a-blink" id="nheta">${etaText(heartEta())}</b>. Możesz też odzyskać je od razu.</div></div>
    <button class="nhcard a-glow" id="nhrev">${'<div class="ico">'+icon('refresh',{size:24,stroke:2.8})+'</div>'}<div class="grow"><div class="t">Powtórz ${HEART_REV} fiszek</div><div class="s">odzyskujesz jedno życie · za darmo</div></div>${icon('chevron-right',{size:20})}</button>
    <button class="nhcard cyan${gems()>=REFILL_GEMS?'':' short'}" id="nhgems">${'<div class="ico">'+icon('gem',{size:24})+'</div>'}<div class="grow"><div class="t">Uzupełnij wszystkie</div><div class="s">${REFILL_GEMS} gemów · ${gems()>=REFILL_GEMS?'zostanie '+(gems()-REFILL_GEMS):'masz '+gems()+' — brakuje '+(REFILL_GEMS-gems())}</div></div>${icon('chevron-right',{size:20})}</button>
    <button class="pill text" id="nhlater" data-primary>WRÓĆ PÓŹNIEJ</button>`);
  sheetBack(); // tło przyciemniające pod panelem (po openSheet, bo closeSheet je zdejmuje)
  const leave=()=>{closeSheet();if(o.inLesson)closeLesson();};
  const resume=()=>{closeSheet();if(o.inLesson&&o.onContinue)o.onContinue();}; // krok 8: życia wróciły w trakcie lekcji → gramy dalej
  s.querySelector('#nhlater').onclick=leave;
  s.querySelector('#nhrev').onclick=()=>{hearts().quest=HEART_REV;saveProgress();closeSheet();goCards(o.lv);toast(`Przejrzyj ${HEART_REV} fiszek — wraca życie`,'heart');};
  s.querySelector('#nhgems').onclick=()=>{if(gems()<REFILL_GEMS){toast(`Brakuje ${REFILL_GEMS-gems()} gemów`,'gem');return;}addGems(-REFILL_GEMS);gainHeart(HEARTS_MAX);resume();toast('Życia uzupełnione: −'+REFILL_GEMS+' gemów','heart','a-pop');};
  nhInt=setInterval(()=>{const e=document.getElementById('nheta');if(!e)return clearInterval(nhInt);if(hearts().n>0){resume();toast('Życie wróciło','heart');return;}e.textContent=etaText(heartEta());},1000);
  return s;
}
/* fiszki przefiltrowane do poziomu (z lekcji: zamyka ją bez wyniku) */
function goCards(lv){
  const L=document.getElementById('lesson');if(L)L.classList.remove('open');
  lessonState=null;fState={subj:current.id,lvl:lv?lv.id:'all',idx:0,flipped:false};curTab='fiszki';renderSubject();
}

/* pytanie + kafle 3D z literą + SPRAWDŹ (Quiz.html). o={n,total,combo,broken,tag,onAnswer(i,ok)} → {body,foot}.
   Wybór podświetla kafel i odblokowuje SPRAWDŹ; po sprawdzeniu kafle: correct / wrong (.a-shake) / dim. Klawisze: 1-5 / A-E, Enter. */
function sessionChips(o,word){
  const chips=[];
  if(o.combo>=2)chips.push(`<span class="combo a-pop">Combo x${o.combo}</span>`);else if(o.broken)chips.push('<span class="combo bad">Combo zerwane</span>');
  if(boostActive())chips.push('<span class="combo boost">×2 XP</span>'); // krok 8
  if(o.tag)chips.push(`<span class="qn">${o.tag}</span>`);
  chips.push(`<span class="qn">${word} ${o.n} z ${o.total}</span>`);
  return chips.join('');
}
function quizBlock(q,o){
  const body=el('div','quiz');
  body.innerHTML=`<div class="qchips">${sessionChips(o,'Pytanie')}</div><div class="qq a-up">${q.q}</div>
    <div class="qopts">${q.a.map((a,i)=>`<button class="qopt a-up d${Math.min(6,i+1)}" data-i="${i}"><span class="k">${keys[i]}</span><span class="t">${a}</span></button>`).join('')}</div>`;
  const btn=el('button','pill qcheck','SPRAWDŹ');btn.disabled=true;btn.id='qcheck';
  let sel=null,done=false;
  const opts=[...body.querySelectorAll('.qopt')];
  const select=i=>{if(done||!opts[i])return;sel=i;opts.forEach(x=>x.classList.toggle('sel',+x.dataset.i===i));btn.disabled=false;};
  const check=()=>{
    if(done||sel==null)return;done=true;
    const ok=sel===q.c;
    opts.forEach(x=>{const xi=+x.dataset.i;x.disabled=true;x.classList.remove('sel','a-up','d1','d2','d3','d4','d5','d6');
      if(xi===q.c){x.classList.add('correct',ok?'a-pop':'a-glow');x.querySelector('.k').innerHTML=icon('check',{size:18,stroke:3.6});}
      else if(xi===sel){x.classList.add('wrong','a-shake');x.querySelector('.k').innerHTML=icon('close',{size:17,stroke:3.6});}
      else x.classList.add('dim');});
    body.querySelector('.qq').classList.add('muted');
    btn.classList.add('hide');btn.disabled=true;keyFn=null;
    o.onAnswer(sel,ok);
  };
  opts.forEach(x=>x.onclick=()=>select(+x.dataset.i));
  btn.onclick=check;
  keyFn=e=>{const k=(e.key||'').toLowerCase();const m=/^[1-5]$/.test(k)?+k-1:'abcde'.indexOf(k);if(k.length===1&&m>=0&&m<opts.length)select(m);else if(e.key==='Enter'&&sel!=null){e.preventDefault();check();}};
  return {body,foot:btn};
}


/* ============================================================ KROK 5: nowe typy zadań (DESIGN.md §4.1 / §5.5)
   level.tasks (opcjonalne): tf | fill | match | order | sort. Pola src:{material,page,quote} są przepuszczane bez zmian (SourceView później).
   TASKS[type].render(task, api): buduje treść w api.body i przyciski w api.foot; kończy api.finish(ok, {e, sub}).
   taskBlock(task, o) → {body, foot} jak quizBlock: te same chipy (combo / „Zadanie N z M”), te same panele dobrze/źle
   (sheetOk/sheetBad), serca i XP obsługuje wywołujący przez o.onAnswer(ok, fb). Sesja poziomu: levelSession(lv). */
const QUIZ_XP=5, TASK_XP=8; // baza XP za poprawne (× mnożnik combo); zadania są dłuższe niż jedno pytanie
let taskInt=null; // licznik rundy na czas (tf)
function taskCleanup(){if(taskInt){clearInterval(taskInt);taskInt=null;}}
const TASK_META={ // kolejność = kolejność kart w Ćwiczeniach (DESIGN.md §6: proste → przeciągane → chart/mathsteps/hotspot)
  tf:{label:'Prawda czy fałsz',tone:'gold',icon:'check',desc:'seria zdań, czasem na czas'},
  fill:{label:'Uzupełnij zdanie',tone:'pink',icon:'edit',desc:'wstaw brakujące słowa'},
  typeterm:{label:'Wpisz pojęcie',tone:'acid',icon:'keyboard',desc:'od definicji do nazwy'},
  swipe:{label:'Dwie kategorie',tone:'cyan',icon:'swipe',desc:'przesuń kartę w lewo albo w prawo'},
  thesis:{label:'Czyja to teza',tone:'violet',icon:'quote',desc:'dopasuj myśl do autora lub szkoły'},
  scenario:{label:'Scenariusz',tone:'red',icon:'bulb',desc:'sytuacja i jej wyjaśnienie'},
  finderror:{label:'Znajdź błąd',tone:'red',icon:'search',desc:'jedno zdanie jest fałszywe'},
  match:{label:'Połącz w pary',tone:'cyan',icon:'link',desc:'pojęcie i jego sedno'},
  order:{label:'Ustaw kolejność',tone:'gold',icon:'list',desc:'ułóż etapy po kolei'},
  sort:{label:'Przypisz do kategorii',tone:'acid',icon:'grid',desc:'rozdziel przykłady do grup'},
  timeline:{label:'Oś czasu',tone:'gold',icon:'calendar',desc:'przypnij wydarzenia do dat'},
  chain:{label:'Łańcuch przyczyn',tone:'cyan',icon:'arrow-down',desc:'co z czego wynika'},
  chart:{label:'Wykres',tone:'violet',icon:'chart',desc:'odczytaj dane z wykresu'},
  mathsteps:{label:'Krok po kroku',tone:'gold',icon:'calc',desc:'rozwiąż zadanie etapami'},
  hotspot:{label:'Wskaż na schemacie',tone:'acid',icon:'pointer',desc:'dotknij właściwego miejsca'}
};
function allTasks(s){return s.levels.flatMap(l=>(l.tasks||[]).filter(t=>t&&TASKS[t.type]).map(t=>({...t,lvl:noEmoji(l.title)})));}
function norm(str){return String(str||'').trim().toLowerCase().replace(/\s+/g,' ');}
/* porównanie odpowiedzi wpisanej z klawiatury: bez wielkości liter, ogonków i interpunkcji (typeterm) */
function fold(str){return norm(str).replace(/ł/g,'l').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\p{L}\p{N}\s]/gu,'').replace(/\s+/g,' ').trim();}
/* odległość edycyjna (Levenshtein) — tolerancja literówki typo:1 */
function lev(a,b){if(a===b)return 0;const m=a.length,n=b.length;if(!m||!n)return m||n;let prev=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const cur=[i];for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur;}return prev[n];}
function listBox(rows){return '<div class="tflist">'+rows.join('')+'</div>';}
function leftText(n){return `${n===1?'Zostało':(n>=2&&n<=4)?'Zostały':'Zostało'} ${n}`;}
/* wybór jednej opcji + SPRAWDŹ (thesis, scenario, chart): btns = przyciski z data-i; po sprawdzeniu .correct (a-pop / a-glow) / .wrong.a-shake / .dim,
   litera w .k zamienia się na check/close jak w quizBlock. Klawisze 1-5 / A-E, Enter. fb(sel, ok) → {e, sub} do api.finish. */
function chooser(api,btns,c,fb){
  const btn=el('button','pill','SPRAWDŹ');btn.disabled=true;api.foot.appendChild(btn);
  let sel=null,done=false;
  const select=i=>{if(done||!btns[i])return;sel=i;btns.forEach((x,k)=>x.classList.toggle('sel',k===i));btn.disabled=false;};
  const check=()=>{if(done||sel==null)return;done=true;const ok=sel===c;
    btns.forEach((x,k)=>{x.disabled=true;x.classList.remove('sel','a-up','a-pop','d1','d2','d3','d4','d5','d6');const kk=x.querySelector('.k');
      if(k===c){x.classList.add('correct',ok?'a-pop':'a-glow');if(kk)kk.innerHTML=icon('check',{size:18,stroke:3.6});}
      else if(k===sel){x.classList.add('wrong','a-shake');if(kk)kk.innerHTML=icon('close',{size:17,stroke:3.6});}
      else x.classList.add('dim');});
    api.finish(ok,fb(sel,ok));};
  btns.forEach((x,k)=>x.onclick=()=>select(k));btn.onclick=check;
  keyFn=e=>{const k=(e.key||'').toLowerCase();const m=/^[1-5]$/.test(k)?+k-1:'abcde'.indexOf(k);if(k.length===1&&m>=0&&m<btns.length)select(m);else if(e.key==='Enter'&&sel!=null){e.preventDefault();check();}};
  return btn;
}
/* przeciąganie kafelka .wordtile z puli na strefę (sort, timeline, chain): pointer events, strefa pod palcem przez elementFromPoint.
   o.targets = selektor stref (dostają .hot w trakcie i .over pod palcem), o.onDrop(i, strefa|null), o.locked(). Zwykły tap (< 8 px) zostawia onclick kafelka. */
function tileDrag(pool,o){
  pool.onpointerdown=e=>{const t=e.target.closest('.wordtile');if(!t||t.disabled||o.locked())return;const i=+t.dataset.i;const r=t.getBoundingClientRect();const gx=e.clientX-r.left,gy=e.clientY-r.top;let moved=false;
    // przewijany kontener (lekcja: .task; Ćwiczenia: .scroll) — przy krawędzi auto-przewijanie, kafelek zostaje pod palcem (korekta o przesunięcie scrolla)
    const sc=[pool.closest('.task'),pool.closest('.scroll')].find(x=>x&&x.scrollHeight>x.clientHeight+2);const st0=sc?sc.scrollTop:0;let lx=e.clientX,ly=e.clientY,autoInt=null;
    const zones=()=>[...document.querySelectorAll(o.targets)];
    const zoneAt=(x,y)=>{const u=document.elementFromPoint(x,y);return u&&u.closest(o.targets);};
    const place=()=>{const ds=sc?sc.scrollTop-st0:0;t.style.transform=`translate(${lx-(r.left+gx)}px,${ly-(r.top+gy)+ds}px)`;const z=zoneAt(lx,ly);zones().forEach(b=>b.classList.toggle('over',b===z));};
    const onMove=ev=>{lx=ev.clientX;ly=ev.clientY;const dx=lx-(r.left+gx),dy=ly-(r.top+gy);if(!moved&&Math.hypot(dx,dy)<8)return;
      if(!moved){moved=true;t.classList.add('drag');t.classList.remove('a-bob');t.style.pointerEvents='none';zones().forEach(z=>z.classList.add('hot'));try{pool.setPointerCapture(ev.pointerId);}catch(x){}
        if(sc)autoInt=setInterval(()=>{const cr=sc.getBoundingClientRect();const d=ly<cr.top+70?-10:ly>cr.bottom-70?10:0;if(d){sc.scrollTop+=d;place();}},16);}
      place();};
    const onUp=ev=>{pool.removeEventListener('pointermove',onMove);pool.removeEventListener('pointerup',onUp);pool.removeEventListener('pointercancel',onUp);clearInterval(autoInt);
      if(!moved)return; // zwykły tap → onclick kafelka
      const z=zoneAt(ev.clientX,ev.clientY);t.style.transform='';t.style.pointerEvents='';t.classList.remove('drag');zones().forEach(b=>b.classList.remove('hot','over'));o.onDrop(i,z);};
    pool.addEventListener('pointermove',onMove);pool.addEventListener('pointerup',onUp);pool.addEventListener('pointercancel',onUp);};
}
/* wykres słupkowy / liniowy jako inline SVG (ChartRead.html): jedna seria, kolory przez klasy z tokenów, wartości nad znacznikami, etykiety x pod osią */
function chartSvg(kind,xs,ys,fmtV){
  const W=330,H=178,top=22,base=150,left=14,right=320;const n=Math.max(1,xs.length);const max=Math.max(1e-9,...ys);const step=(right-left)/n;
  const yOf=v=>base-(Math.max(0,v)/max)*(base-top);const xOf=i=>left+step*i+step/2;const r1=v=>Math.round(v*10)/10;
  const grid=[0.5,1].map(f=>`<line class="cgrid" x1="${left-4}" y1="${r1(yOf(max*f))}" x2="${right+5}" y2="${r1(yOf(max*f))}"/>`).join('');
  let marks;
  if(kind==='line'){marks=`<polyline class="cline" points="${ys.map((v,i)=>r1(xOf(i))+','+r1(yOf(v))).join(' ')}"/>`
    +ys.map((v,i)=>`<circle class="cdot" cx="${r1(xOf(i))}" cy="${r1(yOf(v))}" r="5"/><text class="cval" x="${r1(xOf(i))}" y="${r1(yOf(v))-11}" text-anchor="middle">${fmtV(v)}</text>`).join('');}
  else{const bw=Math.min(34,step*.66);marks=ys.map((v,i)=>`<rect class="cbar" x="${r1(xOf(i)-bw/2)}" y="${r1(yOf(v))}" width="${r1(bw)}" height="${r1(base-yOf(v))}" rx="7"/><text class="cval" x="${r1(xOf(i))}" y="${r1(yOf(v))-7}" text-anchor="middle">${fmtV(v)}</text>`).join('');}
  const labs=xs.map((x,i)=>`<text class="clab" x="${r1(xOf(i))}" y="${base+20}" text-anchor="middle">${x}</text>`).join('');
  const desc=xs.map((x,i)=>x+': '+fmtV(ys[i])).join(', ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${kind==='line'?'Wykres liniowy':'Wykres słupkowy'}: ${desc}">${grid}<line class="caxis" x1="${left-4}" y1="${base}" x2="${right+5}" y2="${base}"/>${marks}${labs}</svg>`;
}
/* sesja poziomu: pytania quizu (max 6, losowo) i zadania w jednym strumieniu — pierwsze zawsze pytanie, zadania rozłożone równo między resztę */
function levelSession(lv){
  const qs=shuffle((lv.quiz||[]).map((q,qi)=>({kind:'quiz',q:qOf(current,lv,qi),qi}))).slice(0,Math.min(6,(lv.quiz||[]).length)); // krok 9: z poprawkami
  const ts=shuffle((lv.tasks||[]).filter(t=>t&&TASKS[t.type])).map(task=>({kind:'task',task}));
  if(!ts.length||!qs.length)return qs.concat(ts);
  const out=[qs[0]],rest=qs.slice(1);let qi=0,ti=0;
  while(qi<rest.length||ti<ts.length){
    const pickTask=ti<ts.length&&(qi>=rest.length||ti*rest.length<=qi*ts.length);
    out.push(pickTask?ts[ti++]:rest[qi++]);
  }
  return out;
}
function taskBlock(task,o){
  const meta=TASK_META[task.type]||{label:task.type,tone:'acid'};
  const body=el('div','task');
  body.innerHTML=`<div class="qchips"><span class="tchip ${meta.tone}">${meta.label}</span>${sessionChips(o,'Zadanie')}</div>`;
  const foot=el('div','tfoot');
  let done=false;
  const api={body,foot,
    finish(ok,fb){if(done)return;done=true;taskCleanup();keyFn=null;
      foot.querySelectorAll('button').forEach(b=>{b.disabled=true;b.classList.add('hide');});
      o.onAnswer(ok,fb||{});}
  };
  TASKS[task.type].render(task,api);
  return {body,foot};
}
const TASKS={
  /* PRAWDA / FAŁSZ (TaskTrueFalse.html): zdanie po zdaniu, PRAWDA/FAŁSZ, kropki postępu, opcjonalna runda na czas (seconds).
     Po każdej odpowiedzi krótkie wyjaśnienie e pod kartą; zadanie zaliczone, gdy wszystkie zdania trafione. Koniec czasu = reszta źle. */
  tf:{render(task,api){
    const sts=shuffle(task.statements||[]);const n=sts.length;const total=task.seconds||0;
    let i=0,left=total,busy=false,ended=false;const results=[],wrong=[];
    if(total){const head=el('div','timerbar',`<div class="grow"><div class="eyebrow">Runda na czas</div><div class="bar"><i style="width:100%"></i></div></div><span class="ttime">${icon('clock',{size:17})}<b>${fmt(left)}</b></span>`);api.body.appendChild(head);}
    const card=el('div','tfcard a-up');api.body.appendChild(card);
    const dots=el('div','dots');dots.setAttribute('aria-hidden','true');api.body.appendChild(dots);
    const exp=el('div','tfexp');api.body.appendChild(exp);
    const yes=el('button','tfbtn yes',icon('check',{size:24,stroke:3.4})+'<span>PRAWDA</span>'),no=el('button','tfbtn no',icon('close',{size:24,stroke:3.4})+'<span>FAŁSZ</span>');
    const row=el('div','tfbtns');row.appendChild(yes);row.appendChild(no);api.foot.appendChild(row);
    const drawDots=()=>{dots.innerHTML=sts.map((s,k)=>`<i class="${results[k]===true?'ok':results[k]===false?'bad':''}"></i>`).join('');};
    const show=()=>{if(ended)return;const s=sts[i];card.className='tfcard a-up';card.innerHTML=`<div class="tfq">${s.s}</div><span class="tfmeta">${i+1} z ${n}</span>`;exp.className='tfexp';exp.innerHTML='';drawDots();};
    const end=()=>{if(ended)return;ended=true;const bad=wrong.length;
      api.finish(bad===0,{e:bad?listBox(wrong.map(w=>`<div><b>${w.s}</b> — ${w.v?'prawda':'fałsz'}${w.e?'. '+w.e:''}</div>`)):(task.e||''),
        sub:bad?`Nietrafione: ${bad} z ${n}`:''});};
    const answer=v=>{if(busy||ended||i>=n)return;const s=sts[i];const ok=(!!s.v)===v;results[i]=ok;if(!ok)wrong.push(s);
      card.classList.add(ok?'okk':'badd');exp.className='tfexp show '+(ok?'ok':'bad');
      exp.innerHTML=(ok?'Zgadza się':'Nie — to '+(s.v?'prawda':'fałsz'))+(s.e?'. '+s.e:'.');drawDots();busy=true;
      setTimeout(()=>{busy=false;i++;if(i>=n)end();else show();},s.e?1700:800);};
    yes.onclick=()=>answer(true);no.onclick=()=>answer(false);
    if(total)taskInt=setInterval(()=>{left--;const b=api.body.querySelector('.timerbar .bar i'),t=api.body.querySelector('.ttime b');
      if(b)b.style.width=Math.max(0,left/total*100)+'%';if(t){t.textContent=fmt(Math.max(0,left));if(left<=10)t.classList.add('a-blink');}
      if(left<=0){taskCleanup();for(;i<n;i++){if(results[i]==null){results[i]=false;wrong.push(sts[i]);}}drawDots();end();}},1000);
    keyFn=e=>{const k=(e.key||'').toLowerCase();if(k==='p'||k==='1'||k==='arrowleft')answer(true);else if(k==='f'||k==='2'||k==='arrowright')answer(false);};
    show();
  }},
  /* UZUPEŁNIJ ZDANIE (TaskFill.html): luki {0},{1} jako kafelki-sloty, bank = blanks + bank wymieszane; tap kafelek → pierwsza wolna luka, tap luka → wraca. */
  fill:{render(task,api){
    const blanks=task.blanks||[];const parts=String(task.text||'').split(/\{(\d+)\}/);
    const tiles=shuffle(blanks.concat(task.bank||[])).map((w,k)=>({w,k,used:false}));
    const slots=blanks.map(()=>null);let locked=false,lastFilled=-1,first=true;
    api.body.appendChild(el('div','',`<div class="ttitle">${task.title||'Wstaw brakujące słowa'}</div>`));
    const card=el('div','fillcard a-up d1');api.body.appendChild(card);
    api.body.appendChild(el('div','eyebrow','Do wyboru'));
    const bank=el('div','bank');api.body.appendChild(bank);
    if(task.hint)api.body.appendChild(el('div','hintbox a-up d3',icon('bookmark',{size:18})+'<span>Podpowiedź: '+task.hint+'</span>'));
    const btn=el('button','pill','SPRAWDŹ');btn.disabled=true;api.foot.appendChild(btn);
    const draw=()=>{
      const firstEmpty=slots.indexOf(null);
      card.innerHTML='<div class="filltxt">'+parts.map((p,idx)=>{if(idx%2===0)return p;const si=+p;const t=slots[si];
        return `<button class="slot${t!=null?' filled'+(si===lastFilled?' a-pop':''):(si===firstEmpty?' a-blink':'')}" data-s="${si}" aria-label="Luka ${si+1}">${t!=null?tiles[t].w:'?'}</button>`;}).join('')+'</div>';
      bank.innerHTML='';tiles.forEach((t,k)=>{const b=el('button','wordtile'+(first?' a-up d'+Math.min(6,k+1):'')+(t.used?' used':''),t.w);b.disabled=t.used;
        b.onclick=()=>{if(locked||t.used)return;const free=slots.indexOf(null);if(free<0)return;slots[free]=t.k;t.used=true;lastFilled=free;draw();};bank.appendChild(b);});
      card.querySelectorAll('.slot').forEach(sl=>sl.onclick=()=>{if(locked)return;const si=+sl.dataset.s;const t=slots[si];if(t==null)return;tiles[t].used=false;slots[si]=null;lastFilled=-1;draw();});
      btn.disabled=slots.some(x=>x==null);first=false;
    };
    const check=()=>{if(locked||btn.disabled)return;locked=true;let ok=true;
      card.querySelectorAll('.slot').forEach(sl=>{const si=+sl.dataset.s;const good=norm(tiles[slots[si]].w)===norm(blanks[si]);if(!good)ok=false;sl.classList.remove('a-pop');sl.classList.add(...(good?['ok']:['bad','a-shake']));});
      const full=parts.map((p,idx)=>idx%2===0?p:'<b>'+blanks[+p]+'</b>').join('');
      api.finish(ok,{e:ok?(task.e||''):(task.e?task.e+'<br><br>':'')+full,sub:ok?'':'Poprawne zdanie niżej'});};
    btn.onclick=check;keyFn=e=>{if(e.key==='Enter'){e.preventDefault();check();}};
    draw();
  }},
  /* POŁĄCZ W PARY (TaskMatch.html): dwie wymieszane kolumny, tap-tap; trafiona para gaśnie, chybiona trzęsie się.
     Koniec, gdy wszystkie połączone; pomyłki po drodze = jedno „źle” (serce tylko raz). */
  match:{render(task,api){
    const pairs=(task.pairs||[]).filter(p=>p&&p.length>=2);const n=pairs.length;
    const L=shuffle(pairs.map((p,i)=>({i,t:p[0]}))),R=shuffle(pairs.map((p,i)=>({i,t:p[1]})));
    let selL=null,selR=null,doneN=0,mistakes=0,busy=false;
    const head=el('div','',`<div class="ttitle">${task.title||'Połącz w pary'}</div><div class="tsub"></div>`);api.body.appendChild(head);
    const sub=head.querySelector('.tsub');
    const cols=el('div','matchcols');const lc=el('div','mcol'),rc=el('div','mcol');cols.appendChild(lc);cols.appendChild(rc);api.body.appendChild(cols);
    const btn=el('button','pill','POŁĄCZ WSZYSTKIE PARY');btn.disabled=true;api.foot.appendChild(btn);
    const mk=(o,side,k)=>{const b=el('button','mbtn '+side+' a-up d'+Math.min(6,k+1),o.t);b.dataset.i=o.i;b.dataset.side=side;return b;};
    L.forEach((o,k)=>lc.appendChild(mk(o,'l',k)));R.forEach((o,k)=>rc.appendChild(mk(o,'r',k)));
    const btnOf=(side,i)=>cols.querySelector(`.mbtn[data-side="${side}"][data-i="${i}"]`);
    const refresh=()=>{const left=n-doneN;sub.textContent=left?`${left===1?'Została':'Zostały'} ${left} ${pl(left,'para','pary','par')} z ${n}.`:'Wszystkie pary połączone.';
      cols.querySelectorAll('.mbtn').forEach(b=>b.classList.toggle('sel',(b.dataset.side==='l'&&+b.dataset.i===selL)||(b.dataset.side==='r'&&+b.dataset.i===selR)));};
    const tryPair=()=>{if(selL==null||selR==null)return;const a=btnOf('l',selL),b=btnOf('r',selR);
      if(selL===selR){doneN++;[a,b].forEach(x=>{x.classList.remove('sel','a-up');x.classList.add('done','a-pop');x.disabled=true;x.innerHTML=icon('check',{size:16,stroke:3.4})+'<span>'+x.textContent+'</span>';});selL=selR=null;refresh();
        if(doneN>=n){btn.textContent='GOTOWE';setTimeout(()=>api.finish(mistakes===0,{e:mistakes?listBox(pairs.map(p=>`<div><b>${p[0]}</b> — ${p[1]}</div>`)):(task.e||''),sub:mistakes?`${mistakes} ${pl(mistakes,'pomyłka','pomyłki','pomyłek')} po drodze`:''}),500);}}
      else{mistakes++;busy=true;[a,b].forEach(x=>{x.classList.remove('a-up');x.classList.add('bad','a-shake');});setTimeout(()=>{[a,b].forEach(x=>x.classList.remove('bad','a-shake'));selL=selR=null;busy=false;refresh();},900);}};
    cols.onclick=e=>{const b=e.target.closest('.mbtn');if(!b||busy||b.disabled)return;const i=+b.dataset.i;if(b.dataset.side==='l')selL=(selL===i?null:i);else selR=(selR===i?null:i);refresh();tryPair();};
    refresh();
  }},
  /* USTAW KOLEJNOŚĆ (TaskOrder.html): items w poprawnej kolejności, mieszane na starcie. Przeciąganie za uchwyt przez pointer events
     (pozycja docelowa wg środka wiersza), do tego strzałki ▲▼ na każdym wierszu. Sprawdzenie = dokładna kolejność. */
  order:{render(task,api){
    const items=(task.items||[]).slice();const n=items.length;
    let order=shuffle(items.map((_,i)=>i));if(n>1&&order.every((v,i)=>v===i))order=order.slice(1).concat(order[0]);
    let locked=false;
    api.body.appendChild(el('div','',`<div class="ttitle">${task.title||'Ustaw kolejność'}</div><div class="tsub">Przeciągnij za uchwyt albo użyj strzałek, żeby ułożyć od pierwszego do ostatniego.</div>`));
    const list=el('div','orderlist');api.body.appendChild(list);
    const btn=el('button','pill','SPRAWDŹ KOLEJNOŚĆ');api.foot.appendChild(btn);
    const rows=()=>[...list.children];
    const move=(from,to)=>{if(locked||to<0||to>=n)return;const [x]=order.splice(from,1);order.splice(to,0,x);draw();};
    const draw=()=>{list.innerHTML='';order.forEach((it,pos)=>{const row=el('div','orderitem');row.dataset.i=it;
        row.innerHTML=`<span class="onum">${pos+1}</span><span class="otxt">${items[it]}</span>
          <button class="ud" aria-label="Przesuń wyżej"${pos===0?' disabled':''}>${icon('chevron-up',{size:18})}</button>
          <button class="ud" aria-label="Przesuń niżej"${pos===n-1?' disabled':''}>${icon('chevron-down',{size:18})}</button>
          <span class="handle" aria-hidden="true">${icon('grip',{size:18})}</span>`;
        const ud=row.querySelectorAll('.ud');ud[0].onclick=()=>move(pos,pos-1);ud[1].onclick=()=>move(pos,pos+1);
        list.appendChild(row);});};
    list.onpointerdown=e=>{const h=e.target.closest('.handle');if(!h||locked)return;const row=h.closest('.orderitem');e.preventDefault();
      const grab=e.clientY-row.getBoundingClientRect().top;row.classList.add('drag');
      try{list.setPointerCapture(e.pointerId);}catch(x){}
      const place=top=>{row.style.transform='';const nat=row.getBoundingClientRect();row.style.transform=`translateY(${top-nat.top}px)`;return nat.height;};
      const onMove=ev=>{const top=ev.clientY-grab;const h2=place(top);const mid=top+h2/2;
        const others=rows().filter(r=>r!==row);let idx=others.findIndex(r=>{const rc=r.getBoundingClientRect();return mid<rc.top+rc.height/2;});if(idx<0)idx=others.length;
        if(idx!==rows().indexOf(row)){if(idx>=others.length)list.appendChild(row);else list.insertBefore(row,others[idx]);place(top);}};
      const onUp=()=>{list.removeEventListener('pointermove',onMove);list.removeEventListener('pointerup',onUp);list.removeEventListener('pointercancel',onUp);
        row.classList.remove('drag');row.style.transform='';order=rows().map(r=>+r.dataset.i);draw();};
      list.addEventListener('pointermove',onMove);list.addEventListener('pointerup',onUp);list.addEventListener('pointercancel',onUp);};
    const check=()=>{if(locked)return;locked=true;let ok=true;
      rows().forEach((row,pos)=>{const good=+row.dataset.i===pos;if(!good)ok=false;row.classList.add(good?'ok':'bad');row.querySelectorAll('.ud').forEach(b=>b.disabled=true);});
      api.finish(ok,{e:ok?(task.e||''):(task.e?task.e+'<br><br>':'')+listBox(items.map((t,i)=>`<div><b>${i+1}.</b> ${t}</div>`)),sub:ok?'':'Poprawna kolejność niżej'});};
    btn.onclick=check;keyFn=e=>{if(e.key==='Enter'){e.preventDefault();check();}};
    draw();
  }},
  /* PRZYPISZ DO KATEGORII (TaskSort.html): 2–4 koszyki jako strefy + pula kafelków. Tap kafelek, potem koszyk (tap kafelka w koszyku = wraca);
     przeciąganie kafelka na koszyk przez pointer events (elementFromPoint). Sprawdzenie = każdy w swoim koszyku. */
  sort:{render(task,api){
    const buckets=(task.buckets||[]).slice(0,4);const items=[];buckets.forEach((b,bi)=>(b.items||[]).forEach(t=>items.push({t,b:bi,at:null})));
    const poolOrder=shuffle(items.map((_,i)=>i));let sel=null,locked=false;
    api.body.appendChild(el('div','',`<div class="ttitle">${task.title||'Przypisz do kategorii'}</div><div class="tsub">Wybierz kafelek, potem kategorię — albo przeciągnij.</div>`));
    const grid=el('div','buckets');api.body.appendChild(grid);
    api.body.appendChild(el('div','tsep'));
    const ph=el('div','eyebrow');api.body.appendChild(ph);
    const pool=el('div','bank pool');api.body.appendChild(pool);
    const btn=el('button','pill','PRZYPISZ WSZYSTKIE');btn.disabled=true;api.foot.appendChild(btn);
    const draw=()=>{
      grid.innerHTML='';buckets.forEach((b,bi)=>{const bx=el('div','bucket'+(sel!=null?' hot':''));bx.dataset.b=bi;bx.setAttribute('role','button');
        bx.innerHTML=`<div class="bhead">${b.name}</div>`;
        items.forEach((it,i)=>{if(it.at!==bi)return;const t=el('button','bitem',it.t);t.dataset.i=i;t.onclick=e=>{e.stopPropagation();if(locked)return;it.at=null;sel=null;draw();};bx.appendChild(t);});
        bx.appendChild(el('div','bdrop',sel!=null?'<span>upuść tutaj</span>':''));
        bx.onclick=()=>{if(locked||sel==null)return;items[sel].at=bi;sel=null;draw();};grid.appendChild(bx);});
      const left=items.filter(it=>it.at==null).length;ph.textContent=left?`Zostało ${left}`:'Wszystko przypisane';
      pool.innerHTML='';poolOrder.forEach(i=>{const it=items[i];if(it.at!=null)return;const t=el('button','wordtile'+(sel===i?' sel a-bob':''),it.t);t.dataset.i=i;t.onclick=()=>{if(locked)return;sel=(sel===i?null:i);draw();};pool.appendChild(t);});
      btn.disabled=left>0;btn.textContent=left?'PRZYPISZ WSZYSTKIE':'SPRAWDŹ';
    };
    tileDrag(pool,{targets:'.bucket',locked:()=>locked,onDrop:(i,bx)=>{if(bx){items[i].at=+bx.dataset.b;sel=null;}draw();}});
    const check=()=>{if(locked||btn.disabled)return;locked=true;let ok=true;
      grid.querySelectorAll('.bitem').forEach(t=>{const it=items[+t.dataset.i];const good=it&&it.at===it.b;if(!good)ok=false;t.classList.add(...(good?['ok']:['bad','a-shake']));t.disabled=true;});
      api.finish(ok,{e:ok?(task.e||''):(task.e?task.e+'<br><br>':'')+listBox(buckets.map(b=>`<div><b>${b.name}:</b> ${(b.items||[]).join(', ')}</div>`)),sub:ok?'':'Poprawny podział niżej'});};
    btn.onclick=check;keyFn=e=>{if(e.key==='Enter'){e.preventDefault();check();}};
    draw();
  }},

  /* ===== krok 5b: pozostałe typy z DESIGN.md §4.1 ===== */
  /* WPISZ POJĘCIE (TypeTerm.html): definicja w karcie, pole tekstowe (Bricolage), kreski = litery odpowiedzi (wypełniają się w trakcie pisania),
     „Pierwsza litera · −2 XP” (podpowiedź, XP przez addXP), „Nie pamiętam” (= źle, pokazuje odpowiedź). Porównanie po fold(): bez wielkości liter i ogonków,
     answer + accept; typo:1 = jedna literówka (odległość edycyjna ≤ 1). Enter w polu = SPRAWDŹ. */
  typeterm:{render(task,api){
    const ans=String(task.answer||'');const acc=[ans].concat(task.accept||[]).map(fold).filter(Boolean);const tol=task.typo|0;
    const letters=ans.replace(/\s+/g,'').length;let locked=false,hinted=false;
    api.body.appendChild(el('div','',`<div class="ttitle">${task.title||'Jak to się nazywa?'}</div>`));
    api.body.appendChild(el('div','defcard a-up d1',`<div class="eyebrow">Definicja</div><div class="deftext">${task.definition||''}</div>`));
    const wrap=el('div','a-up d2');
    wrap.innerHTML=`<label class="eyebrow" for="term">Twoja odpowiedź</label><div class="termbox"><input id="term" class="terminput" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Twoja odpowiedź"></div>
      <div class="letters" aria-hidden="true">${ans.split('').map(ch=>/\s/.test(ch)?'<b></b>':'<i></i>').join('')}</div>
      <div class="termmeta">${letters} ${pl(letters,'litera','litery','liter')}${tol?' · literówka w jednym miejscu jest akceptowana':''}</div>`;
    api.body.appendChild(wrap);
    const inp=wrap.querySelector('input'),box=wrap.querySelector('.termbox'),dots=[...wrap.querySelectorAll('.letters i')];
    const btns=el('div','termbtns a-up d3');const hint=el('button','hintbtn gold','Pierwsza litera · −2 XP'),giveup=el('button','hintbtn','Nie pamiętam');btns.appendChild(hint);btns.appendChild(giveup);api.body.appendChild(btns);
    const btn=el('button','pill','SPRAWDŹ');btn.disabled=true;api.foot.appendChild(btn);
    const paint=()=>{const n=inp.value.replace(/\s+/g,'').length;dots.forEach((d,k)=>d.classList.toggle('on',k<n));btn.disabled=!inp.value.trim();};
    inp.oninput=paint;
    const check=()=>{if(locked||!inp.value.trim())return;locked=true;inp.disabled=true;const got=fold(inp.value);
      const ok=acc.some(a=>a===got||(tol>0&&lev(a,got)<=tol));
      box.classList.add(ok?'ok':'bad');if(!ok)box.classList.add('a-shake');
      api.finish(ok,{e:task.e||'',sub:ok?'':'Poprawnie: '+ans});};
    hint.onclick=()=>{if(locked||hinted)return;hinted=true;hint.disabled=true;hint.textContent='Zaczyna się na „'+ans.charAt(0).toUpperCase()+'”';if(!inp.value)inp.value=ans.charAt(0);paint();
      if(subjState(current.id).xp>=2&&daily().xp>=2){addXP(current.id,-2);toast('Podpowiedź: −2 XP','bolt');}try{inp.focus();}catch(e){}};
    giveup.onclick=()=>{if(locked)return;locked=true;inp.value=ans;inp.disabled=true;paint();box.classList.add('bad');api.finish(false,{e:task.e||'',sub:'Poprawnie: '+ans});};
    btn.onclick=check;inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();check();}});
    setTimeout(()=>{try{inp.focus();}catch(e){}},80);
  }},
  /* DWIE KATEGORIE (Swipe.html): strefy left/right po bokach, stos kart (front + tło), przeciąganie karty przez pointer events z przechyłem (dx/14°),
     stempel z nazwą strefy od 30 px, odpowiedź od 80 px; do tego dwa przyciski pod spodem i strzałki ←/→. Kropki = wynik kolejnych kart.
     Zadanie zaliczone, gdy wszystkie karty trafione; w panelu „źle” lista nietrafionych (serce raz na zadanie). */
  swipe:{render(task,api){
    const cards=shuffle(task.cards||[]);const n=cards.length;const L=task.left||'Lewo',R=task.right||'Prawo';
    let i=0,busy=false;const results=[],wrong=[];
    const head=el('div','trow',`<div class="ttitle">${task.title||L+' czy '+R+'?'}</div><span class="tcount">1 / ${n}</span>`);api.body.appendChild(head);
    const stage=el('div','swipestage');api.body.appendChild(stage);
    stage.innerHTML=`<div class="szone l"><span>${L}</span></div><div class="szone r"><span>${R}</span></div><div class="scard back"></div>
      <div class="scard front"><div class="stamp l">${L}</div><div class="stamp r">${R}</div><div class="sfront"></div><div class="ssub"></div></div><div class="dots" aria-hidden="true"></div>`;
    const card=stage.querySelector('.scard.front'),back=stage.querySelector('.scard.back'),zl=stage.querySelector('.szone.l'),zr=stage.querySelector('.szone.r'),dots=stage.querySelector('.dots'),cnt=head.querySelector('.tcount');
    const bl=el('button','swbtn l',icon('back',{size:18,stroke:3})+'<span>'+L+'</span>'),br=el('button','swbtn r','<span>'+R+'</span>'+icon('chevron-right',{size:18,stroke:3}));
    bl.setAttribute('aria-label',L);br.setAttribute('aria-label',R);
    const row=el('div','swbtns');row.appendChild(bl);row.appendChild(br);api.foot.appendChild(row);
    const drawDots=()=>{dots.innerHTML=cards.map((c,k)=>`<i class="${results[k]===true?'ok':results[k]===false?'bad':k===i?'cur a-blink':''}"></i>`).join('');};
    const show=()=>{const c=cards[i];card.className='scard front a-pop';card.style.transform='';const sf=card.querySelector('.sfront');sf.textContent=c.front;sf.classList.toggle('long',String(c.front).length>14);
      card.querySelector('.ssub').textContent=c.sub||'';cnt.textContent=(i+1)+' / '+n;back.style.visibility=i+1<n?'':'hidden';drawDots();};
    const end=()=>{const bad=wrong.length;api.finish(bad===0,{e:bad?listBox(wrong.map(c=>`<div><b>${c.front}</b> — ${c.side==='left'?L:R}${c.e?'. '+c.e:''}</div>`)):(task.e||''),sub:bad?`Nietrafione: ${bad} z ${n}`:''});};
    const answer=side=>{if(busy||i>=n)return;busy=true;const c=cards[i];const ok=(c.side==='right')===(side==='right');results[i]=ok;if(!ok)wrong.push(c);
      const zone=side==='left'?zl:zr;zone.classList.add(ok?'okk':'badd');card.classList.remove('a-pop','grab','to-l','to-r');card.style.transform='';card.classList.add(ok?'okk':'badd','fly-'+(side==='left'?'l':'r'));drawDots();
      setTimeout(()=>{zone.classList.remove('okk','badd');i++;busy=false;if(i>=n)end();else show();},ok?420:800);};
    card.onpointerdown=e=>{if(busy)return;const x0=e.clientX,y0=e.clientY;let dx=0;card.classList.add('grab');card.classList.remove('a-pop');try{card.setPointerCapture(e.pointerId);}catch(x){}
      const onMove=ev=>{dx=ev.clientX-x0;const dy=(ev.clientY-y0)*.25;card.style.transform=`translate(${dx}px,${dy}px) rotate(${dx/14}deg)`;card.classList.toggle('to-l',dx<-30);card.classList.toggle('to-r',dx>30);zl.classList.toggle('near',dx<-30);zr.classList.toggle('near',dx>30);};
      const onUp=()=>{card.removeEventListener('pointermove',onMove);card.removeEventListener('pointerup',onUp);card.removeEventListener('pointercancel',onUp);zl.classList.remove('near');zr.classList.remove('near');
        if(Math.abs(dx)>80)answer(dx<0?'left':'right');else{card.classList.remove('grab','to-l','to-r');card.style.transform='';}};
      card.addEventListener('pointermove',onMove);card.addEventListener('pointerup',onUp);card.addEventListener('pointercancel',onUp);};
    bl.onclick=()=>answer('left');br.onclick=()=>answer('right');
    keyFn=e=>{if(e.key==='ArrowLeft'||e.key==='1')answer('left');else if(e.key==='ArrowRight'||e.key==='2')answer('right');};
    show();
  }},
  /* CZYJA TO TEZA (WhoSaid.html): karta z cudzysłowem i tezą, siatka 2×N opcji {name, sub}; wybrana = fiolet; SPRAWDŹ przez chooser(). */
  thesis:{render(task,api){
    const opts=task.options||[];
    api.body.appendChild(el('div','thcard a-pop d1',icon('quote',{size:34})+`<div class="thtext">${task.thesis||''}</div>`));
    api.body.appendChild(el('div','eyebrow',task.q||'Kto tak twierdzi?'));
    const grid=el('div','thgrid');api.body.appendChild(grid);
    const btns=opts.map((o,k)=>{const b=el('button','thopt a-up d'+Math.min(6,k+1),`<span class="n">${o.name}</span>${o.sub?`<span class="s">${o.sub}</span>`:''}`);b.dataset.i=k;grid.appendChild(b);return b;});
    chooser(api,btns,task.c,(sel,ok)=>({e:task.e||'',sub:ok?'':'Poprawnie: '+((opts[task.c]||{}).name||'')}));
  }},
  /* SCENARIUSZ (Scenario.html): karta „Sytuacja” z opisem, pytanie, opcje A–D jak w quizie (.qopt.sm), SPRAWDŹ przez chooser(). */
  scenario:{render(task,api){
    api.body.appendChild(el('div','scenecard a-up d1',`<div class="eyebrow">Sytuacja</div><div class="scenetext">${task.scene||''}</div>`));
    api.body.appendChild(el('div','ttitle sm a-up d2',task.q||'Co najlepiej to wyjaśnia?'));
    const list=el('div','qopts');api.body.appendChild(list);
    const btns=(task.a||[]).map((a,k)=>{const b=el('button','qopt sm a-up d'+Math.min(6,k+2),`<span class="k">${keys[k]}</span><span class="t">${a}</span>`);b.dataset.i=k;list.appendChild(b);return b;});
    chooser(api,btns,task.c,(sel,ok)=>({e:task.e||'',sub:ok?'':'Poprawna: odpowiedź '+keys[task.c]}));
  }},
  /* ZNAJDŹ BŁĄD (FindError.html): zdania jako kafelki w karcie, wybrane = czerwień; po SPRAWDŹ fałszywe zdanie przekreślone, pod spodem poprawka fix;
     chybiony wybór = bursztynowa ramka (to zdanie było prawdziwe). */
  finderror:{render(task,api){
    const sents=task.sentences||[];const w=task.wrong|0;
    api.body.appendChild(el('div','',`<div class="ttitle">${task.title||'Jedno zdanie jest fałszywe. Które?'}</div>`));
    const card=el('div','errcard');api.body.appendChild(card);
    const btns=sents.map((s,k)=>{const b=el('button','errsent a-up d'+Math.min(6,k+1),s);b.dataset.i=k;card.appendChild(b);return b;});
    const fixBox=el('div','errfix');card.appendChild(fixBox);
    api.body.appendChild(el('div','notebox a-up d5',icon('info',{size:18})+'<span>Po sprawdzeniu zobaczysz poprawione zdanie.</span>'));
    chooser(api,btns,w,(sel,ok)=>{fixBox.className='errfix show '+(ok?'ok':'bad');
      fixBox.innerHTML=`<div class="lbl">${ok?'Trafione':'Fałszywe było zdanie '+(w+1)}</div><div>${task.fix?`Poprawnie: <b>${task.fix}</b>`:'Zdanie '+(w+1)+' jest fałszywe.'}</div>`;
      return {e:task.e||'',sub:ok?'':'Fałszywe było zdanie '+(w+1)};});
  }},
  /* OŚ CZASU (Timeline.html): wiersze = lata rosnąco (oś pionowa, kropki), wydarzenia wymieszane w puli kafelków. Tap kafelek (fiolet + a-bob) → tap pusty slot;
     tap przypięte wydarzenie = wraca do puli; przeciąganie kafelka na slot przez tileDrag(). Pierwszy pusty slot mruga. Sprawdzenie po roku (równe lata = zamienne). */
  timeline:{render(task,api){
    const evs=(task.events||[]).map((e,k)=>({label:e.label,year:e.year,k}));const rows=[...evs].sort((a,b)=>+a.year-+b.year);const n=rows.length;
    const poolOrder=shuffle(evs.map(e=>e.k));const slots=rows.map(()=>null);let sel=null,locked=false,first=true;
    api.body.appendChild(el('div','',`<div class="ttitle">${task.title||'Przypnij wydarzenia do dat'}</div>`));
    const tl=el('div','tl');api.body.appendChild(tl);
    api.body.appendChild(el('div','tsep'));const ph=el('div','eyebrow');api.body.appendChild(ph);
    const pool=el('div','bank pool');api.body.appendChild(pool);
    const btn=el('button','pill','SPRAWDŹ');btn.disabled=true;api.foot.appendChild(btn);
    const draw=()=>{const firstEmpty=slots.indexOf(null);
      tl.innerHTML='<i class="tlaxis"></i>'+rows.map((r,si)=>{const t=slots[si];const cur=si===firstEmpty;
        return `<div class="tlrow"><span class="tlyear">${r.year}</span><i class="tldot${t!=null?' on':cur?' cur a-pulse':''}"></i>
          ${t!=null?`<button class="tlev a-pop" data-s="${si}" aria-label="${r.year}: ${evs[t].label}, dotknij, żeby cofnąć">${icon('check',{size:16,stroke:3.4})}<span>${evs[t].label}</span></button>`
          :`<div class="tlslot empty${cur?' cur a-blink':''}" data-s="${si}" role="button" aria-label="Miejsce na wydarzenie z roku ${r.year}">${cur?'<span>'+(sel!=null?'upuść tutaj':'tu trafi wydarzenie')+'</span>':''}</div>`}</div>`;}).join('');
      tl.querySelectorAll('.tlev').forEach(b=>b.onclick=()=>{if(locked)return;slots[+b.dataset.s]=null;sel=null;draw();});
      tl.querySelectorAll('.tlslot').forEach(z=>z.onclick=()=>{if(locked||sel==null)return;slots[+z.dataset.s]=sel;sel=null;draw();});
      const left=slots.filter(x=>x==null).length;ph.textContent=left?leftText(left):'Wszystko przypięte';
      pool.innerHTML='';poolOrder.forEach((k,pos)=>{if(slots.includes(k))return;const t=el('button','wordtile'+(sel===k?' sel a-bob':first?' a-up d'+Math.min(6,pos+1):''),evs[k].label);t.dataset.i=k;t.onclick=()=>{if(locked)return;sel=(sel===k?null:k);draw();};pool.appendChild(t);});
      btn.disabled=left>0;first=false;};
    tileDrag(pool,{targets:'.tlslot.empty',locked:()=>locked,onDrop:(k,z)=>{if(z){slots[+z.dataset.s]=k;sel=null;}draw();}});
    const check=()=>{if(locked||btn.disabled)return;locked=true;let ok=true;
      tl.querySelectorAll('.tlev').forEach(b=>{const si=+b.dataset.s;const good=+evs[slots[si]].year===+rows[si].year;if(!good)ok=false;b.classList.remove('a-pop');b.classList.add(...(good?['ok']:['bad','a-shake']));b.disabled=true;});
      api.finish(ok,{e:ok?(task.e||''):(task.e?task.e+'<br><br>':'')+listBox(rows.map(r=>`<div><b>${r.year}</b> — ${r.label}</div>`)),sub:ok?'':'Poprawna oś czasu niżej'});};
    btn.onclick=check;keyFn=e=>{if(e.key==='Enter'){e.preventDefault();check();}};
    draw();
  }},
  /* ŁAŃCUCH PRZYCZYN (CauseChain.html): kolumna kroków ze strzałkami; given = widoczne od startu, reszta = sloty („co dalej?”, pierwszy mruga).
     Tap kafelek → pierwszy wolny slot, tap wstawiony krok = wraca; przeciąganie na konkretny slot przez tileDrag(). Bank = brakujące kroki + dystraktory. */
  chain:{render(task,api){
    const steps=task.steps||[];const given=new Set((task.given||[]).map(Number));
    const tiles=shuffle(steps.filter((s,k)=>!given.has(k)).concat(task.bank||[]));
    const slots=steps.map((s,k)=>given.has(k)?-1:null);let locked=false,first=true;
    api.body.appendChild(el('div','',`<div class="ttitle">${task.title||'Co się dzieje po kolei?'}</div>`));
    const col=el('div','chain');api.body.appendChild(col);
    const pool=el('div','bank pool');api.body.appendChild(pool);
    const btn=el('button','pill','SPRAWDŹ');btn.disabled=true;api.foot.appendChild(btn);
    const draw=()=>{const firstEmpty=slots.indexOf(null);
      col.innerHTML=steps.map((s,k)=>{const t=slots[k];let h;
        if(t===-1)h=`<div class="chstep given${first?' a-up d'+Math.min(6,k+1):''}">${s}</div>`;
        else if(t!=null)h=`<button class="chstep filled a-pop" data-s="${k}" aria-label="${tiles[t]}, dotknij, żeby cofnąć">${icon('check',{size:16,stroke:3.4})}<span>${tiles[t]}</span></button>`;
        else h=`<div class="chslot empty${k===firstEmpty?' cur a-blink':''}" data-s="${k}" role="button" aria-label="Krok ${k+1}">${k===firstEmpty?'<span>co dalej?</span>':''}</div>`;
        return (k?`<div class="charrow">${icon('arrow-down',{size:22,stroke:3})}</div>`:'')+h;}).join('');
      col.querySelectorAll('.chstep.filled').forEach(b=>b.onclick=()=>{if(locked)return;slots[+b.dataset.s]=null;draw();});
      pool.innerHTML='';tiles.forEach((w,i)=>{const used=slots.includes(i);const t=el('button','wordtile'+(used?' used':first?' a-up d'+Math.min(6,i+1):''),w);t.dataset.i=i;t.disabled=used;
        t.onclick=()=>{if(locked||used)return;const free=slots.indexOf(null);if(free<0)return;slots[free]=i;draw();};pool.appendChild(t);});
      btn.disabled=slots.some(x=>x==null);first=false;};
    tileDrag(pool,{targets:'.chslot.empty',locked:()=>locked,onDrop:(i,z)=>{if(z)slots[+z.dataset.s]=i;draw();}});
    const check=()=>{if(locked||btn.disabled)return;locked=true;let ok=true;
      col.querySelectorAll('.chstep.filled').forEach(b=>{const k=+b.dataset.s;const good=norm(tiles[slots[k]])===norm(steps[k]);if(!good)ok=false;b.classList.remove('a-pop');b.classList.add(...(good?['ok']:['bad','a-shake']));b.disabled=true;});
      api.finish(ok,{e:ok?(task.e||''):(task.e?task.e+'<br><br>':'')+listBox(steps.map((s,k)=>`<div><b>${k+1}.</b> ${s}</div>`)),sub:ok?'':'Poprawny łańcuch niżej'});};
    btn.onclick=check;keyFn=e=>{if(e.key==='Enter'){e.preventDefault();check();}};
    draw();
  }},
  /* WYKRES (ChartRead.html): karta z podpisem i wykresem (chartSvg: bar | line, jedna seria), pytanie, opcje A–D, SPRAWDŹ przez chooser(). */
  chart:{render(task,api){
    const ch=task.chart||{};const xs=ch.x||[],ys=(ch.y||[]).map(Number);const fmtV=v=>String(v).replace('.',',');
    api.body.appendChild(el('div','chartcard a-up d1',`<div class="chartlbl">${ch.label||''}</div>${chartSvg(ch.kind,xs,ys,fmtV)}`));
    api.body.appendChild(el('div','ttitle sm a-up d2',task.q||''));
    const list=el('div','qopts');api.body.appendChild(list);
    const btns=(task.a||[]).map((a,k)=>{const b=el('button','qopt sm a-up d'+Math.min(6,k+2),`<span class="k">${keys[k]}</span><span class="t">${a}</span>`);b.dataset.i=k;list.appendChild(b);return b;});
    chooser(api,btns,task.c,(sel,ok)=>({e:task.e||'',sub:ok?'':'Poprawna: odpowiedź '+keys[task.c]}));
  }},
  /* KROK PO KROKU (MathSteps.html): karta z wyrażeniem startowym i kolejnymi krokami; każdy krok = wybór przekształcenia z opcji (siatka 2 kolumny, wymieszane) + SPRAWDŹ.
     Dobry wybór → wiersz limonkowy z note; zły → wiersz czerwony (przekreślony) i ramka z note (wyjaśnienie), opcja gaśnie, wybierasz dalej.
     Zaliczone = całość bez pomyłek (serce raz na zadanie). Klawisze 1-4, Enter. */
  mathsteps:{render(task,api){
    const steps=task.steps||[];let i=0,sel=null,mistakes=0,locked=false,order=[];const hist=[];let tried=new Set();
    api.body.appendChild(el('div','',`<div class="ttitle">${task.title||'Rozwiąż krok po kroku'}</div>`));
    const card=el('div','mathcard');api.body.appendChild(card);
    const ph=el('div','eyebrow','Wybierz następny krok');api.body.appendChild(ph);
    const grid=el('div','mgrid');api.body.appendChild(grid);
    const btn=el('button','pill','SPRAWDŹ');btn.disabled=true;api.foot.appendChild(btn);
    const drawCard=()=>{const last=hist[hist.length-1];
      card.innerHTML=`<div class="mrow start"><span class="mexpr">${task.start||''}</span><span class="mnote">zadanie</span></div>`
        +hist.map((h,k)=>`<div class="mrow ${h.ok?'ok':'bad'}${k===hist.length-1?(h.ok?' a-pop':' a-shake'):''}"><span class="mexpr">${h.expr}</span><span class="mnote">${h.ok?h.note:'nie tak'}</span>${icon(h.ok?'check':'close',{size:16,stroke:3.4})}</div>`).join('')
        +(last&&!last.ok?`<div class="mexp">${icon('bulb',{size:16})}<span>${last.note}</span></div>`:'')
        +(i<steps.length?`<div class="mrow next a-blink"><span>następny krok?</span></div>`:'');};
    const drawOpts=()=>{grid.innerHTML='';sel=null;btn.disabled=true;const s=steps[i];order=shuffle((s.options||[]).map((_,k)=>k));
      order.forEach((k,pos)=>{const b=el('button','mopt a-up d'+Math.min(6,pos+1),s.options[k]);b.dataset.i=k;if(tried.has(k)){b.disabled=true;b.classList.add('dim');}
        b.onclick=()=>{if(locked||b.disabled)return;sel=k;grid.querySelectorAll('.mopt').forEach(x=>x.classList.toggle('sel',+x.dataset.i===k));btn.disabled=false;};grid.appendChild(b);});};
    const check=()=>{if(locked||sel==null)return;const s=steps[i];const ok=sel===s.c;
      if(ok){hist.push({ok:true,expr:s.expr||s.options[s.c],note:s.note||''});tried=new Set();i++;
        if(i>=steps.length){locked=true;drawCard();grid.innerHTML='';ph.textContent='Rozwiązane';
          api.finish(mistakes===0,{e:task.e||'',sub:mistakes?`${mistakes} ${pl(mistakes,'pomyłka','pomyłki','pomyłek')} po drodze`:''});return;}}
      else{mistakes++;tried.add(sel);hist.push({ok:false,expr:s.options[sel],note:s.note||'Spróbuj inaczej.'});}
      drawCard();drawOpts();};
    btn.onclick=check;
    keyFn=e=>{const k=e.key||'';const m=/^[1-5]$/.test(k)?+k-1:-1;if(m>=0){const b=grid.querySelectorAll('.mopt')[m];if(b&&!b.disabled)b.click();}else if(k==='Enter'&&sel!=null){e.preventDefault();check();}};
    drawCard();drawOpts();
  }},
  /* WSKAŻ NA SCHEMACIE (Hotspot.html): obraz (inline <svg …> albo ścieżka <img>) w karcie, warstwa dotyku nad nim; targets:[{name,x,y,r}] w % (x, y = środek,
     r = promień w % szerokości obrazka). Pytania po kolei („Dotknij: …”), trafienie = limonkowy pierścień + etykieta, chybienie = czerwony punkt + a-shake karty.
     „POKAŻ, GDZIE TO JEST” = pomyłka + podświetlenie celu. Zaliczone = wszystkie cele bez pomyłek (serce raz na zadanie). */
  hotspot:{render(task,api){
    const tg=task.targets||[];const n=tg.length;let i=0,mistakes=0,locked=false,busy=false;
    const title=el('div','ttitle');api.body.appendChild(title);
    const card=el('div','hotcard a-up d1');api.body.appendChild(card);
    const img=el('div','hotimg');const src=String(task.image||'');
    if(/^\s*<svg/i.test(src))img.innerHTML=src;else if(src){const im=el('img');im.src=src;im.alt=task.alt||'';im.draggable=false;img.appendChild(im);}
    const layer=el('div','hotlayer');layer.setAttribute('aria-label','Dotknij właściwego miejsca na schemacie');img.appendChild(layer);card.appendChild(img);
    const chips=el('div','hotchips a-up d2');api.body.appendChild(chips);
    const show=el('button','pill ghost','POKAŻ, GDZIE TO JEST');api.foot.appendChild(show);
    const draw=()=>{title.textContent=i<n?'Dotknij: '+tg[i].name:'Wszystko wskazane';
      chips.innerHTML=tg.map((t,k)=>`<span class="hotchip${k<i?' done':k===i?' cur':''}">${k<i?icon('check',{size:13,stroke:3.4}):''}${k===i+1?'Kolejne: ':''}${t.name}</span>`).join('');};
    const pin=(t,cls,label)=>{const p=el('div','hotpin');p.style.left=t.x+'%';p.style.top=t.y+'%';p.style.width=(t.r*2)+'%';
      p.innerHTML=`<i class="hotring ${cls}"></i>${label?`<b class="hottag ${cls}">${label}</b>`:''}`;layer.appendChild(p);return p;};
    const end=()=>{locked=true;api.finish(mistakes===0,{e:task.e||'',sub:mistakes?`${mistakes} ${pl(mistakes,'pomyłka','pomyłki','pomyłek')} po drodze`:''});};
    const hit=t=>{pin(t,'ok a-pop',t.name);i++;draw();if(i>=n)setTimeout(end,500);};
    layer.onclick=e=>{if(locked||busy||i>=n)return;const r=img.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*100,y=(e.clientY-r.top)/r.height*100;const t=tg[i];
      const dx=(x-t.x)*r.width/100,dy=(y-t.y)*r.height/100;
      if(Math.hypot(dx,dy)<=t.r*r.width/100)hit(t);
      else{mistakes++;busy=true;card.classList.add('a-shake');const m=pin({x,y,r:4},'miss a-pop');setTimeout(()=>{m.remove();card.classList.remove('a-shake');busy=false;},700);}};
    show.onclick=()=>{if(locked||busy||i>=n)return;mistakes++;busy=true;const t=tg[i];const p=pin(t,'reveal a-blink',t.name);
      setTimeout(()=>{p.querySelectorAll('.reveal').forEach(x=>x.classList.remove('a-blink'));busy=false;i++;draw();if(i>=n)end();},1100);};
    draw();
  }}
};

/* ============================================================ KROK 6: POWTÓRKA NA INTERWAŁACH (DESIGN.md §4.4, ten sam klucz nauka_progress_v1)
   PROGRESS.srs = { "<subjectId>:<levelId>:<itemId>": {box:0..4, due:"yyyy-mm-dd", seen, lapses} }; itemId = indeks fiszki albo "q"+indeks pytania.
   Pudełka 0→1→3→7→21 dni: dobra odpowiedź podnosi pudełko, zła zrzuca do 0 (+1 lapses). Zapis: fiszki (umiem / jeszcze nie), quiz w lekcji, zakładka Quiz, sesja powtórki. */
const SRS_INT=[0,1,3,7,21];
function srs(){if(!PROGRESS.srs||typeof PROGRESS.srs!=='object')PROGRESS.srs={};return PROGRESS.srs;}
function addDays(ds,k){const p=ds.split('-').map(Number);return dstr(new Date(p[0],p[1]-1,p[2]+k));}
function srsTouch(sid,lid,item,ok){
  const S=srs();const k=sid+':'+lid+':'+item;const e=S[k]||{box:0,due:todayStr(),seen:0,lapses:0};
  e.seen=(e.seen|0)+1;if(ok)e.box=Math.min(4,(e.box|0)+1);else{e.box=0;e.lapses=(e.lapses|0)+1;}
  e.due=addDays(todayStr(),SRS_INT[e.box]);S[k]=e;histAdd('reviews',1); // krok 9: dziennik dnia (podsumowanie tygodnia)
  albumCheck(sid,lid,item,e); // krok 8: fiszka z pudełkiem ≥ 3 trafia do albumu
  return e;
}
/* klucz → dane: {s, lv, kind:'card'|'quiz', c|q, idx, key}; wpisy po nieistniejących przedmiotach/poziomach są pomijane */
function srsResolve(k){
  const p=k.split(':');const s=SUBJECTS.find(x=>x.id===p[0]);if(!s)return null;const lv=s.levels.find(l=>l.id===p[1]);if(!lv)return null;const item=p.slice(2).join(':');
  if(item[0]==='q'){const idx=+item.slice(1);const q=qOf(s,lv,idx);return q?{s,lv,kind:'quiz',q,idx,key:k}:null;} // krok 9: z poprawką
  const idx=+item;const c=(lv.flashcards||[])[idx];return c?{s,lv,kind:'card',c,idx,key:k}:null;
}
function srsEntries(){const S=srs();return Object.keys(S).map(k=>{const r=srsResolve(k);return r?{...r,e:S[k]}:null;}).filter(Boolean);}
/* do powtórki dziś: fiszki najpierw, potem pytania; w obrębie rodzaju najstarsze terminy pierwsze */
function srsDue(){const t=todayStr();return srsEntries().filter(x=>x.e.due<=t).sort((a,b)=>a.kind!==b.kind?(a.kind==='card'?-1:1):(a.e.due<b.e.due?-1:a.e.due>b.e.due?1:0));}
/* stan pamięci: świeże (pudełko 0) · w trakcie (1–2) · utrwalone (3–4) */
function srsStats(all){const st={fresh:0,mid:0,firm:0};(all||srsEntries()).forEach(x=>{const b=x.e.box|0;if(b===0)st.fresh++;else if(b<=2)st.mid++;else st.firm++;});return st;}
function nextDueText(){const t=todayStr();const fut=srsEntries().map(x=>x.e.due).filter(d=>d>t).sort();if(!fut.length)return '';const k=dayDiff(t,fut[0]);return k===1?'jutro':`za ${k} ${pl(k,'dzień','dni','dni')}`;}

/* ============================================================ POWTÓRKA (Review.html): licznik na dziś, z czego, stan pamięci, start */
function renderReview(){
  const scroll=shell('review',{blob:'cyan',cls:'review',title:'Powtórka',pills:false,back:()=>go('today')});
  const all=srsEntries(),due=srsDue(),n=due.length,st=srsStats(all),tot=all.length,nd=nextDueText();
  const hero=el('div','rvhero a-up');
  hero.innerHTML=`<div class="grow"><div class="rvn a-pop">${n}</div><div class="rvt">${n?pl(n,'pojęcie na dziś','pojęcia na dziś','pojęć na dziś'):'nic na dziś'}</div>
    <div class="rvs">${n?'Zaplanowane tak, żeby wróciły tuż przed zapomnieniem.':tot?'Wszystko na dziś przejrzane.'+(nd?' Najbliższa powtórka '+nd+'.':''):'Ucz się z fiszek i lekcji — pojęcia wrócą tu we właściwym dniu.'}</div></div>
    ${icon('refresh',{size:58,stroke:1.8,cls:n?'a-spin':''})}`;
  scroll.appendChild(hero);
  if(n){
    scroll.appendChild(el('div','eyebrow sec','Z czego'));
    const rows=el('div','rvrows');
    const bySubj=SUBJECTS.map(s=>({s,mine:due.filter(x=>x.s.id===s.id)})).filter(x=>x.mine.length).sort((a,b)=>b.mine.length-a.mine.length);
    bySubj.forEach(({s,mine},i)=>{
      const lv=[...new Set(mine.map(x=>noEmoji(x.lv.title)))];
      const r=el('button','rvrow themed a-up d'+Math.min(6,i+1));r.style.setProperty('--accent',s.accent);if(s.onAccent)r.style.setProperty('--on-accent',s.onAccent);
      r.innerHTML=`${mono(initial(s.short||s.name),'solid')}<div class="grow"><div class="t">${s.short||s.name}</div><div class="s">${lv.slice(0,2).join(' · ')}${lv.length>2?' · +'+(lv.length-2):''}</div></div><span class="n">${mine.length}</span>`;
      r.setAttribute('aria-label',(s.short||s.name)+': '+mine.length+' do powtórki');
      r.onclick=()=>startReview(mine);rows.appendChild(r);
    });
    scroll.appendChild(rows);
  }
  scroll.appendChild(el('div','eyebrow sec','Stan pamięci'));
  const mem=el('div','memcard a-up d3');
  [['Świeże','red',st.fresh,1],['W trakcie','gold',st.mid,2],['Utrwalone','acid',st.firm,3]].forEach(([lab,tone,v,d])=>{
    mem.appendChild(el('div','memrow '+tone,`<span class="lb">${lab}</span><div class="bar"><i class="a-grow d${d}" style="width:${tot?Math.round(v/tot*100):0}%"></i></div><span class="n">${v}</span>`));
  });
  if(!tot)mem.appendChild(el('div','memnote','Jeszcze nic w powtórce. Każda fiszka i każde pytanie, na które odpowiesz, trafia tutaj.'));
  scroll.appendChild(mem);
  const foot=el('div','rvfoot');
  if(n){const b=el('button','pill cyan a-glow','ZACZNIJ POWTÓRKĘ');b.id='rvstart';b.onclick=()=>startReview(due);foot.appendChild(b);}
  else{const b=el('button','pill ghost','Przejrzyj fiszki');b.id='rvcards';b.onclick=()=>go('cards');foot.appendChild(b);}
  scroll.appendChild(foot);
}
/* sesja powtórki: najpierw fiszki (odwracane, umiem / jeszcze nie), potem pytania (kafle + panele dobrze/źle); bez serc i combo */
let rvState=null;
function startReview(items){
  rvState={items:items.slice(),idx:0,flipped:false,ok:0,bad:0,xp:0,wrong:[],marks:[],subs:new Set()};
  renderReviewSession();
}
function rvAnswer(it,ok,xp){
  const rv=rvState;rv.subs.add(it.s.id);rv.marks[rv.idx]=ok?'on':'bad';
  srsTouch(it.s.id,it.lv.id,it.kind==='quiz'?'q'+it.idx:String(it.idx),ok);
  if(ok){rv.ok++;if(xp){rv.xp+=xp;addXP(it.s.id,xp);}}else{rv.bad++;rv.wrong.push(it);}
  tickDaily(it.s.id,'review',1);missionEvent('review',1);
}
function renderReviewSession(){
  const rv=rvState;closeSheet();keyFn=null;
  app.innerHTML='';
  const L=el('div','lesson open rvrun');app.appendChild(L);
  app.appendChild(el('div','toast',''));app.lastChild.id='toast';
  if(rv.idx>=rv.items.length)return finishReview(L);
  const it=rv.items[rv.idx];
  const head=el('div','lessonhead');
  const x=el('button','x',icon('close',{size:18,stroke:3}));x.setAttribute('aria-label','Przerwij powtórkę');x.onclick=()=>{if(rv.idx>0)finishReview(L);else go('review');};head.appendChild(x);
  const seg=el('div','segbar');seg.setAttribute('aria-label',`${rv.idx+1} z ${rv.items.length}`);
  for(let i=0;i<rv.items.length;i++)seg.appendChild(el('i',i<rv.idx?(rv.marks[i]==='bad'?'bad':'on'):''));head.appendChild(seg);
  head.appendChild(el('div','rvcount',`${rv.idx+1} z ${rv.items.length}`));
  L.appendChild(head);
  const body=el('div','lessonbody');L.appendChild(body);
  body.appendChild(el('div','blob a-float cyan'));
  if(it.kind==='card'){
    const c=it.c;
    // karta w kolorze przedmiotu (Flashcards.html): tap = odwróć, przeciągnięcie w lewo = jeszcze nie, w prawo = umiem
    const flip=el('div','flip themed a-up'+(rv.flipped?' flipped':''));flip.style.setProperty('--accent',it.s.accent);if(it.s.onAccent)flip.style.setProperty('--on-accent',it.s.onAccent);
    flip.innerHTML=`<div class="flipinner">
      <div class="face front"><span class="tag accent">${it.s.short||it.s.name} · ${noEmoji(it.lv.title)}</span><div class="term">${c.t}</div><div class="tapomat">dotknij, żeby odwrócić</div></div>
      <div class="face back"><span class="tag">odpowiedź</span><div class="deftxt">${c.d}</div><div class="tapomat">dotknij, żeby wrócić</div></div></div>`;
    let swiped=false;
    flip.onclick=()=>{if(swiped){swiped=false;return;}rv.flipped=!rv.flipped;flip.classList.toggle('flipped');};
    body.appendChild(flip);
    body.appendChild(el('div','swipehint3',`<span class="l">${icon('back',{size:16,stroke:2.8,cls:'a-bob'})}w lewo = jeszcze nie</span><span class="r">w prawo = umiem${icon('chevron-right',{size:16,stroke:2.8,cls:'a-bob d2'})}</span>`));
    const foot=el('div','lessonfoot');const btns=el('div','fbtns');
    const no=el('button','fbtn no',icon('refresh',{size:18,stroke:2.8})+' jeszcze nie'),yes=el('button','fbtn yes',icon('check',{size:18,stroke:3.4})+' umiem');
    no.id='rvno';yes.id='rvyes';
    const ans=ok=>{if(!advOk())return;rvAnswer(it,ok,ok?2:0);rv.flipped=false;rv.idx++;renderReviewSession();};
    no.onclick=()=>ans(false);yes.onclick=()=>ans(true);
    let x0=null;flip.onpointerdown=e=>{x0=e.clientX;};
    flip.onpointerup=e=>{if(x0==null)return;const dx=e.clientX-x0;x0=null;if(Math.abs(dx)>80){swiped=true;ans(dx>0);}};
    btns.appendChild(no);btns.appendChild(yes);foot.appendChild(btns);L.appendChild(foot);
    keyFn=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();flip.click();}else if(e.key==='ArrowLeft'||e.key==='1')ans(false);else if(e.key==='ArrowRight'||e.key==='2')ans(true);};
  }else{
    const q=it.q;
    const blk=quizBlock(q,{n:rv.idx+1,total:rv.items.length,tag:it.s.short||it.s.name,onAnswer:(i,ok)=>{
      rvAnswer(it,ok,ok?3:0);
      const next=()=>{rv.idx++;renderReviewSession();};
      if(ok){body.appendChild(confetti(4));sheetOk(q,{xp:3,mult:1,combo:0,onNext:next,subj:it.s,lv:it.lv,qi:it.idx});}
      else sheetBad(q,{onNext:next,subj:it.s,lv:it.lv,qi:it.idx,onCards:()=>{rvState=null;openSubject(it.s.id,'fiszki',()=>{fState={subj:it.s.id,lvl:it.lv.id,idx:0,flipped:false};});}}); // krok 9: qi
    }});
    body.appendChild(blk.body);const foot=el('div','lessonfoot');foot.appendChild(blk.foot);L.appendChild(foot);
  }
}
/* koniec powtórki (FlashcardsDone.html): pierścień celności, umiem / do powtórki / +XP, lista „wracają dziś” albo najbliższy termin, karta serii */
function finishReview(L){
  const rv=rvState;closeSheet();keyFn=null;
  const total=rv.ok+rv.bad;const pct=total?Math.round(rv.ok/total*100):0;
  // plan dnia: „Powtórka” to jedna czynność — zalicz wiersze przedmiotów z sesji, a gdy żaden nie pasuje, pierwszy oczekujący wiersz Powtórki
  const deck=rv.deck||null;
  if(deck){ // krok 7: talia błędów z egzaminu — trafione wypadają z PROGRESS.examDeck; wiersz „Powtórz błędy” i dzień „słabe punkty” zaliczone
    const okKeys=new Set(rv.items.slice(0,rv.idx).filter((it,i)=>rv.marks[i]==='on').map(it=>it.key));
    const left=(PROGRESS.examDeck||[]).filter(k=>!okKeys.has(k));if(left.length)PROGRESS.examDeck=left;else delete PROGRESS.examDeck;saveProgress();
    if(total){completeDaily(deck,'weak');testDone(deck,'weak');}
  }else{
    let doneAny=false;rv.subs.forEach(sid=>{if(completeDaily(sid,'review'))doneAny=true;});
    if(!doneAny&&total){const t=daily().tasks.find(x=>!x.done&&/:review$/.test(x.id));if(t)completeDaily(t.id.split(':')[0],'review');}
    if(total)rv.subs.forEach(sid=>testDone(sid,'review'));
  }
  if(!L){app.innerHTML='';L=el('div','lesson open rvrun');app.appendChild(L);app.appendChild(el('div','toast',''));app.lastChild.id='toast';}else L.innerHTML='';
  const body=el('div','lessonbody done');body.appendChild(el('div','blob a-float cyan'));if(pct>=50)body.appendChild(confetti(6));
  const done=rv.items.slice(0,rv.idx);const cards=done.filter(x=>x.kind==='card').length,qs=done.length-cards; // tylko to, co przejrzane (sesję można przerwać)
  const subsTxt=[...rv.subs].map(id=>{const s=SUBJECTS.find(x=>x.id===id);return s?(s.short||s.name):'';}).filter(Boolean).join(' · ');
  const R=52,C=Math.round(2*Math.PI*R*10)/10;const nd=nextDueText();const n=streakDisplay();
  const lc=el('div','lc');
  lc.innerHTML=`<div class="rvring a-pop"><svg viewBox="0 0 124 124" aria-hidden="true"><circle class="ring-bg" cx="62" cy="62" r="${R}"/><circle class="ring-fg" cx="62" cy="62" r="${R}" style="stroke-dasharray:${C};stroke-dashoffset:${Math.round(C*(1-pct/100)*10)/10}"/></svg><div class="rvpct"><b>${pct}%</b><span>umiem</span></div></div>
    <div class="lctxt a-up d2"><div class="lct">Powtórka skończona</div><div class="lcs">${subsTxt?subsTxt+' · ':''}${cards} ${pl(cards,'pojęcie','pojęcia','pojęć')}${qs?` · ${qs} ${pl(qs,'pytanie','pytania','pytań')}`:''}</div></div>
    <div class="lcstats a-up d3"><div class="lcstat acid"><div class="v">${rv.ok}</div><div class="k under">umiem</div></div><div class="lcstat red"><div class="v">${rv.bad}</div><div class="k under">do powtórki</div></div><div class="lcstat gold"><div class="v">+${rv.xp}</div><div class="k under">XP</div></div></div>`;
  const card=el('div','setcard rvlist a-up d4');
  if(rv.wrong.length){
    card.innerHTML='<div class="eyebrow sec">Wracają dziś</div>'+rv.wrong.slice(0,3).map(w=>{const e=srs()[w.key]||{};const nm=w.kind==='card'?w.c.t:w.q.q;return `<div class="setrow"><i class="rdot red"></i><span class="t grow">${nm}</span><span class="v">${e.seen||1}. raz</span></div>`;}).join('<div class="setsep"></div>')
      +(rv.wrong.length>3?`<div class="setsep"></div><div class="setrow"><span class="t muted">i ${rv.wrong.length-3} ${pl(rv.wrong.length-3,'kolejne','kolejne','kolejnych')}</span></div>`:'');
  }else card.innerHTML=`<div class="setrow"><i class="rdot gold"></i><span class="t grow">Najbliższa powtórka</span><span class="v acid">${nd||'gdy dojdą nowe pojęcia'}</span></div>`;
  lc.appendChild(card);
  const d=daily();const dd=d.tasks.filter(t=>t.done).length;
  const sk=el('button','lcstreak a-up d5',`<div class="ico">${icon('flame',{size:24})}</div><div class="grow"><div class="t">${n} ${pl(n,'dzień','dni','dni')} z rzędu</div><div class="s">${d.tasks.length&&dd>=d.tasks.length?'Plan dnia zrobiony':'Plan dnia: '+dd+' z '+d.tasks.length}${nd?' · następna powtórka '+nd:''}</div></div>${icon('chevron-right',{size:20})}`);
  sk.onclick=()=>go('streak');lc.appendChild(sk);
  body.appendChild(lc);L.appendChild(body);
  const foot=el('div','lessonfoot col');
  const main=el('button','pill cyan a-glow',rv.wrong.length?`POWTÓRZ TE ${rv.wrong.length}`:'GOTOWE');main.id='rvmain';
  const wrong=rv.wrong.slice();main.onclick=wrong.length?()=>{startReview(wrong);if(deck)rvState.deck=deck;}:()=>go('review');
  const alt=el('button','pill text','NA DZIŚ WYSTARCZY');alt.id='rvdone';alt.onclick=()=>go('review');
  foot.appendChild(main);foot.appendChild(alt);L.appendChild(foot);
  rvState=null;
  keyFn=e=>{if(e.key==='Enter')main.click();};
}
/* zakładka „Fiszki” w nawigacji: przedmioty z liczbą fiszek i pojęć do powtórki → zakładka Fiszki przedmiotu */
function renderCardsHub(){
  const scroll=shell('cards',{blob:true,cls:'cards',title:'Fiszki',pills:false});
  const due=srsDue();const totalC=SUBJECTS.reduce((a,s)=>a+allCards(s).length,0);
  scroll.appendChild(el('div','',`<div class="eyebrow">${totalC} ${pl(totalC,'pojęcie','pojęcia','pojęć')} · ${SUBJECTS.length} ${pl(SUBJECTS.length,'przedmiot','przedmioty','przedmiotów')}</div><p class="sp">Wybierz przedmiot i przeglądaj fiszki. Każda odpowiedź trafia do powtórki na interwałach.</p>`));
  if(due.length){const r=el('button','rvrow a-up d1',`<div class="mono solid">${icon('refresh',{size:22,stroke:2.6})}</div><div class="grow"><div class="t">Powtórka na dziś</div><div class="s">${due.length} ${pl(due.length,'pojęcie czeka','pojęcia czekają','pojęć czeka')}</div></div><span class="n">${due.length}</span>`);r.onclick=()=>go('review');scroll.appendChild(r);}
  const card=el('div','setcard a-up d2');
  SUBJECTS.forEach((s,i)=>{
    if(i)card.appendChild(el('div','setsep'));
    const nc=allCards(s).length,nd=due.filter(x=>x.s.id===s.id).length;
    const r=el('button','setrow themed');r.style.setProperty('--accent',s.accent);if(s.onAccent)r.style.setProperty('--on-accent',s.onAccent);
    r.innerHTML=`${mono(initial(s.short||s.name),'solid xs')}<div class="grow"><div class="t">${s.short||s.name}</div><div class="s">${nc} ${pl(nc,'fiszka','fiszki','fiszek')}${nd?' · '+nd+' do powtórki':''}</div></div>${icon('chevron-right',{size:18,cls:'chev'})}`;
    r.onclick=()=>openSubject(s.id,'fiszki');card.appendChild(r);
  });
  scroll.appendChild(card);
}

/* ============================================================ SUBJECT shell (Path.html: pas nagłówka w --surface-2 + chipy zakładek) */
function openSubject(id,tab,setup){
  current=SUBJECTS.find(s=>s.id===id);
  if(!current)return go('today');
  applyTheme(current);
  curTab=tab||'path';
  if(setup)setup();
  renderSubject();
}
function renderSubject(){
  const s=current;const st=subjState(s.id);
  try{clearInterval(cwInt);clearInterval(exInt);}catch(e){}
  closeSheet();keyFn=null;taskCleanup();
  app.innerHTML='';
  const total=s.levels.length,done=s.levels.filter(l=>(st.levels[l.id]||{}).done).length,pct=total?Math.round(done/total*100):0;
  const band=el('div','band');
  const row=el('div','brow');
  const back=el('button','backbtn',icon('back',{size:20,stroke:3}));back.setAttribute('aria-label','Wróć do planu dnia');back.onclick=()=>go('today');row.appendChild(back);
  row.appendChild(el('div','bmeta',`<div class="bname">${mono(initial(s.short||s.name),'xs solid')}<span>${s.short||s.name}</span></div>
    <div class="bprog"><div class="bar"><i class="a-grow" style="width:${pct}%"></i></div><span>${done}/${total} · <b id="xpNum">${st.xp}</b> xp</span></div>`));
  const info=el('button','infobtn'+(curTab==='info'?' active':''),icon('info',{size:19}));info.setAttribute('aria-label','Zasady zaliczenia');info.onclick=()=>{curTab='info';renderSubject();};row.appendChild(info);
  row.appendChild(gemPill());row.appendChild(heartsPill({iconBeat:true})); // krok 8: gemy w pasie przedmiotu
  band.appendChild(row);
  // krok 7: chip „Sprawdzian za N dni” z dzisiejszym punktem planu → ekran planu
  const tst=testFor(s.id);
  if(tst){syncTests();const N=dayDiff(todayStr(),tst.date);const r=(tst.plan||[]).find(x=>x.date===todayStr());
    const chip=el('button','bandtest',icon('calendar',{size:15,stroke:2.6})+`<span>Sprawdzian ${inDays(N)}</span>`+(N>0&&r?`<small>· dziś: ${tpTitle(tst,r).toLowerCase()}${r.done?' (zrobione)':''}</small>`:'<small></small>')+icon('chevron-right',{size:16,cls:'chev'}));
    chip.onclick=()=>openTestPlan(tst.id,'subject');band.appendChild(chip);}
  const tabs=el('div','subtabs');
  [['path','map','Ścieżka'],['fiszki','cards','Fiszki'],['quiz','brain','Quiz'],['cwicz','edit','Ćwiczenia'],['egzamin','target','Egzamin']].forEach(([k,ic,lab])=>{
    const b=el('button','subtab'+(curTab===k?' active':''),icon(ic,{size:15})+'<span>'+lab+'</span>');
    if(curTab===k)b.setAttribute('aria-current','page');
    b.onclick=()=>{curTab=k;renderSubject();};
    tabs.appendChild(b);
  });
  const share=el('button','subtab share',icon('share',{size:15})+'<span>Klasa</span>');share.setAttribute('aria-label','Udostępnij klasie — wymaga wersji online');share.onclick=()=>openComing('share');tabs.appendChild(share); // krok 9
  band.appendChild(tabs);app.appendChild(band);

  const sc=el('div','screen active');sc.id='subjscreen';
  app.appendChild(sc);
  if(curTab==='path')renderPath(sc);
  else if(curTab==='fiszki')renderFiszki(sc);
  else if(curTab==='quiz')renderQuiz(sc);
  else if(curTab==='cwicz')renderCwicz(sc);
  else if(curTab==='egzamin')renderEgzamin(sc);
  else if(curTab==='info')renderInfo(sc);

  // toast + lesson container
  app.appendChild(el('div','toast',''));app.lastChild.id='toast';
  const lesson=el('div','lesson');lesson.id='lesson';app.appendChild(lesson);
}

/* ---------- ŚCIEŻKA (Path.html): karta rozdziału, wężyk węzłów (offset --x per węzeł, łączniki w połowie drogi), skrzynia co 3 poziomy ---------- */
function levelUnlocked(s,idx){
  if(idx===0)return true;
  const prev=s.levels[idx-1];
  const st=subjState(s.id);
  return !!(st.levels[prev.id]&&st.levels[prev.id].done);
}
const PATH_OFF=[-104,8,96,-28]; // poziome przesunięcia kolejnych węzłów (px), cyklicznie
function renderPath(sc){
  const s=current;const st=subjState(s.id);
  const isDone=lv=>!!(st.levels[lv.id]||{}).done;
  const wrap=el('div','scroll pathview');
  wrap.appendChild(el('div','blob a-float mid'));
  const curIdx=s.levels.findIndex((l,i)=>levelUnlocked(s,i)&&!isDone(l));
  const all=curIdx<0;
  const brec=bossRec(s.id);
  wrap.appendChild(el('div','chapter a-up',`<i></i><div class="grow"><div class="eyebrow">Rozdział ${all?s.levels.length:curIdx+1}</div><div class="t">${all?(brec.done?'Wszystko zaliczone':'Boss rozdziału czeka'):noEmoji(s.levels[curIdx].title)}</div></div>${icon(all&&!brec.done?'boss':'list',{size:18})}`));
  const path=el('div','path');
  const items=[];
  // krok 8: skrzynia po co trzecim poziomie (poza ostatnim), boss jako ostatni węzeł ścieżki
  s.levels.forEach((lv,i)=>{items.push({lv,i});if((i+1)%3===0&&i+1<s.levels.length)items.push({chest:true,after:i});});
  items.push({boss:true});
  const xOf=k=>PATH_OFF[k%PATH_OFF.length];
  const chests=st.chests||(st.chests={});
  const chestOpen=it=>s.levels.slice(Math.max(0,it.after-2),it.after+1).every(isDone);
  const doneOf=it=>it.chest?!!chests[String(it.after)]:it.boss?!!brec.done:isDone(it.lv);
  path.appendChild(el('div','connector done first'));
  items.forEach((it,k)=>{
    const x=xOf(k);
    if(k>0){const c=el('div','connector'+(doneOf(items[k-1])?' done':''));c.style.setProperty('--x',((xOf(k-1)+x)/2)+'px');path.appendChild(c);}
    const node=el('div','pathnode');node.style.setProperty('--x',x+'px');
    if(it.chest){
      const opened=!!chests[String(it.after)],open=chestOpen(it);
      const btn=el('button','nodebtn node-chest'+(opened?' opened':open?' a-sway':''),icon('chest',{size:32,stroke:2.4}));
      btn.setAttribute('aria-label','Skrzynia: '+(opened?'otwarta':open?'do otwarcia':'po zaliczeniu poziomu '+(it.after+1)));
      btn.onclick=()=>{
        if(opened)return toast('Skrzynia już otwarta','chest');
        if(!open)return toast('Skrzynia otworzy się po zaliczeniu poziomu '+(it.after+1),'lock');
        chests[String(it.after)]=true;saveProgress();btn.classList.remove('a-sway');btn.classList.add('a-pop');
        addGems(GEM.chest);toast('Skrzynia: +'+GEM.chest+' gemów','gem','a-pop');setTimeout(()=>{if(current===s&&curTab==='path')renderPath(sc);},900);};
      node.appendChild(btn);node.appendChild(el('div','nodelabel gold',opened?'Otwarta':'Skrzynia'));
    }else if(it.boss){
      const beaten=!!brec.done,open=all;
      const btn=el('button','nodebtn node-boss'+(beaten?' beaten':open?' open a-pulse':' locked'),bossSvg(52)+(beaten?'<span class="won">'+icon('check',{size:14,stroke:4})+'</span>':''));
      btn.setAttribute('aria-label','Boss rozdziału: '+(beaten?'pokonany, powtórz walkę':open?'zacznij walkę':'po zaliczeniu wszystkich poziomów'));
      btn.onclick=()=>{if(open)startBoss();else toast('Boss czeka, aż zaliczysz wszystkie poziomy','lock');};
      if(open&&!beaten)node.classList.add('cur'),node.appendChild(el('div','bubble a-bob','WALKA'));
      node.appendChild(btn);node.appendChild(el('div','nodelabel'+(beaten?'':open?' cur':' lock'),beaten?'Boss pokonany':'Boss rozdziału'));
    }else{
      const lv=it.lv,i=it.i;const unlocked=levelUnlocked(s,i),done=isDone(lv),stars=(st.levels[lv.id]||{}).stars||0;
      const cur=unlocked&&!done;
      if(cur){node.classList.add('cur');node.appendChild(el('div','bubble a-bob','ZACZNIJ'));}
      const btn=el('button','nodebtn '+(done?'node-done':cur?'node-open a-pulse':'node-lock'),done?icon('check',{size:34,stroke:3.4}):cur?icon('bolt',{size:40}):icon('lock',{size:28}));
      btn.setAttribute('aria-label',(done?'Powtórz: ':cur?'Zacznij: ':'Zablokowane: ')+noEmoji(lv.title));
      if(done)btn.innerHTML+=`<span class="stars">${starRow(stars,12)}</span>`;
      btn.onclick=unlocked?()=>startLesson(lv):()=>toast('Najpierw zalicz poprzedni poziom','lock');
      node.appendChild(btn);
      node.appendChild(el('div','nodelabel'+(cur?' cur':done?'':' lock'),noEmoji(lv.title)));
    }
    path.appendChild(node);
  });
  wrap.appendChild(path);sc.innerHTML='';sc.appendChild(wrap);
  // auto-scroll do bieżącego węzła (na środek ekranu)
  requestAnimationFrame(()=>{const n=wrap.querySelector('.node-open,.node-boss.open');if(!n)return;const r=n.getBoundingClientRect(),w=wrap.getBoundingClientRect();wrap.scrollTop=Math.max(0,r.top-w.top+wrap.scrollTop-w.height/2+r.height/2);});
}

/* ---------- LEKCJA: roladka (Lesson.html) -> quiz z panelem dobrze/źle, życiami i combo -> LevelComplete ---------- */
let lessonState=null;
function startLesson(lv){
  if(hearts().n<=0){showNoHearts({inLesson:false,lv});return;} // bez życia nie zaczynasz
  lessonState={lv,phase:(lv.feed||[]).length?'feed':'quiz',feedIdx:0,items:levelSession(lv),qIdx:0,score:0,answered:false,combo:0,maxCombo:0,broken:false,xp:0,marks:[],run:[],t0:null};
  const g=ghosts()[ghostKey(lv)];if(g){lessonState.ghost=Array.isArray(g)?g:g.run;lessonState.ghostAt=Array.isArray(g)?null:g.at;} // krok 8: duch = najlepszy przebieg tego poziomu
  const L=document.getElementById('lesson');L.classList.add('open');
  renderLesson();
}
function closeLesson(){closeSheet();keyFn=null;taskCleanup();clearInterval(bossInt);clearInterval(ghostInt);lessonState=null;bossState=null;const L=document.getElementById('lesson');if(L)L.classList.remove('open');renderSubject();}
/* nagłówek lekcji: zamknij, pasek segmentowy (krok = dawka albo pytanie; zły = czerwony), serca */
function lessonHead(ls){
  const totalFeed=(ls.lv.feed||[]).length,steps=totalFeed+ls.items.length;
  const cur=ls.phase==='feed'?ls.feedIdx:totalFeed+ls.qIdx;
  const head=el('div','lessonhead');
  const x=el('button','x',icon('close',{size:18,stroke:3}));x.setAttribute('aria-label','Zamknij lekcję');x.onclick=closeLesson;head.appendChild(x);
  const seg=el('div','segbar');seg.setAttribute('aria-label',`krok ${Math.min(cur+1,steps)} z ${steps}`);
  for(let i=0;i<steps;i++)seg.appendChild(el('i',i<cur?(ls.marks[i]==='bad'?'bad':'on'):''));
  head.appendChild(seg);
  head.appendChild(heartsPill());
  return head;
}
function renderLesson(){
  const L=document.getElementById('lesson');const s=current;const ls=lessonState;const lv=ls.lv;
  const totalFeed=(lv.feed||[]).length;
  closeSheet();taskCleanup();
  L.innerHTML='';
  L.appendChild(lessonHead(ls));
  const body=el('div','lessonbody');L.appendChild(body);

  if(ls.phase==='feed'){
    const f=lv.feed[ls.feedIdx];
    body.appendChild(el('div','blob a-float cyan'));
    const card=el('div','fcard a-up');
    card.innerHTML=`<div class="fin"><span class="tag accent">Mikro-dawka ${ls.feedIdx+1}/${totalFeed}</span>
      <div class="ftitle">${noEmoji(f.title)}</div><div class="fbody">${f.body}</div>
      ${f.real?`<div class="real a-up d2"><span class="lbl">${icon('bulb',{size:15})}prościej</span>${f.real}</div>`:''}
      ${f.mnemo?`<div class="mnemo a-up d3"><span class="lbl">${icon('bookmark',{size:15})}zapamiętaj</span>${f.mnemo}</div>`:''}</div>`;
    body.appendChild(card);
    const last=ls.feedIdx+1>=totalFeed;
    const next=()=>{if(!advOk())return;if(!last){ls.feedIdx++;renderLesson();}else if(ls.items.length){ls.phase='quiz';renderLesson();}else finishLesson();};
    const prev=()=>{if(ls.feedIdx>0&&advOk()){ls.feedIdx--;renderLesson();}};
    const foot=el('div','lessonfoot col');
    foot.appendChild(el('div','swipehint2',icon('arrow-up',{size:16,cls:'a-bob'})+'<span>przesuń w górę, żeby przejść dalej</span>'));
    const b=el('button','pill a-glow',last?(ls.items.length?'CZAS NA PYTANIA':'ZAKOŃCZ'):'KONTYNUUJ');b.id='lnext';b.onclick=next;foot.appendChild(b);
    L.appendChild(foot);
    // swipe: w górę = dalej (gdy karta przewinięta do końca), w dół = wstecz
    let y0=null,x0=0;
    body.onpointerdown=e=>{y0=e.clientY;x0=e.clientX;};
    body.onpointerup=e=>{if(y0==null)return;const dy=e.clientY-y0,dx=Math.abs(e.clientX-x0);y0=null;if(dx>60)return;
      const fin=card.querySelector('.fin');const atEnd=fin.scrollTop+fin.clientHeight>=fin.scrollHeight-6;
      if(dy<-70&&atEnd)next();else if(dy>70&&fin.scrollTop<=0)prev();};
    keyFn=e=>{if(e.key==='Enter'||e.key==='ArrowRight'||e.key===' '){e.preventDefault();next();}else if(e.key==='ArrowLeft')prev();};
  } else if(ls.phase==='quiz'){
    // sesja poziomu: pytania quizu i zadania (krok 5) w jednym strumieniu; panel dobrze/źle, serca i combo wspólne
    if(ls.qIdx>=ls.items.length)return finishLesson();
    const it=ls.items[ls.qIdx];ls.answered=false;
    const stepIdx=totalFeed+ls.qIdx;
    if(ls.t0==null)ls.t0=Date.now(); // krok 8: czas przebiegu liczony od pierwszego pytania (duch)
    clearInterval(ghostInt);
    if(ls.ghost){body.appendChild(ghostCard(ls));ghostInt=setInterval(ghostTick,400);setTimeout(ghostTick,0);}
    const onAnswer=(ok,fb)=>{ // fb = {e, sub} — dla pytania quizu to samo pytanie (e + litera z c)
      ls.answered=true;ls.broken=false;
      ls.run.push({t:Date.now()-ls.t0,correct:!!ok}); // krok 8: przebieg do ducha
      const next=()=>{ls.qIdx++;renderLesson();};
      if(ok){
        ls.score++;ls.combo++;ls.maxCombo=Math.max(ls.maxCombo,ls.combo);
        missionEvent('streakok',ls.combo);if(ls.combo>(stats().maxCombo|0)){stats().maxCombo=ls.combo;saveProgress();if(ls.combo>=10)checkBadges();}
        if(it.kind==='task'&&it.task.type==='tf'&&it.task.seconds)missionEvent('tftime',1);
        const m=comboMult(ls.combo),xp=(it.kind==='task'?TASK_XP:QUIZ_XP)*m;ls.xp+=xp;addXP(s.id,xp);
        body.appendChild(confetti(4));
        sheetOk(fb,{xp,mult:m,combo:ls.combo,onNext:next,subj:s,lv,qi:it.kind==='quiz'?it.qi:null});
      }else{
        ls.broken=ls.combo>=2;ls.combo=0;ls.marks[stepIdx]='bad';
        loseHeart();
        const hp=L.querySelector('.hearts');if(hp){hp.classList.add('a-beat');hp.appendChild(el('span','minus a-blink','−1'));}
        const seg=L.querySelectorAll('.segbar i')[stepIdx];if(seg)seg.className='bad';
        sheetBad(fb,{sub:fb.sub,subj:s,lv,qi:it.kind==='quiz'?it.qi:null,onNext:()=>{if(hearts().n<=0)showNoHearts({inLesson:true,lv,onContinue:next});else next();},onCards:()=>goCards(lv)}); // krok 9: qi → „popraw pytanie”
      }
    };
    const o={n:ls.qIdx+1,total:ls.items.length,combo:ls.combo,broken:ls.broken};
    const blk=it.kind==='task'?taskBlock(it.task,{...o,onAnswer}):quizBlock(it.q,{...o,onAnswer:(i,ok)=>{srsTouch(s.id,lv.id,'q'+it.qi,ok);onAnswer(ok,it.q);}});
    body.appendChild(blk.body);
    const foot=el('div','lessonfoot');foot.appendChild(blk.foot);L.appendChild(foot);
  }
}
/* wynik poziomu (LevelComplete.html); logika XP/gwiazdek/zaliczenia jak dotąd + bonus combo w XP z quizu */
function finishLesson(){
  const s=current;const ls=lessonState;const lv=ls.lv;
  const pct=ls.items.length?Math.round(ls.score/ls.items.length*100):100;
  const stars = pct>=90?3:(pct>=70?2:(pct>=50?1:0));
  const passed = ls.items.length?pct>=50:true;
  const st=subjState(s.id);const prev=st.levels[lv.id]||{};
  let bonus=0,gem=0;
  clearInterval(ghostInt);
  if(passed){
    st.levels[lv.id]={done:true,stars:Math.max(stars,prev.stars||0),best:Math.max(pct,prev.best||0)};
    if(!prev.done){bonus=15;addXP(s.id,15);}
    saveProgress();
    completeDaily(s.id,'lesson',lv.id);
    testDone(s.id,'learn',lv.id); // krok 7: dzień „nauka” w planie do sprawdzianu
    gem=GEM.level+(stars>=3?GEM.stars3:0);addGems(gem); // krok 8: gemy za poziom (+5 za 3 gwiazdki), misja „poziom”
    missionEvent('level',1);histAdd('levels',1); // krok 9: dziennik dnia
  }
  histMax('combo',ls.maxCombo);
  const gh=ghostFinish(ls,passed);if(gh&&gh.xp)bonus+=gh.xp; // krok 8: duch (zapis / pokonany +10 XP / lepszy)
  checkBadges();
  const L=document.getElementById('lesson');closeSheet();
  const d=daily();const dd=d.tasks.filter(t=>t.done).length;const n=streakDisplay();
  L.innerHTML='';
  const body=el('div','lessonbody done');
  body.appendChild(el('div','blob a-float '+(passed?'acid':'red')));
  if(passed)body.appendChild(confetti(7));
  const starIc=(size,cls,on)=>icon('star',{size,fill:on,stroke:2,cls:cls+(on?' ic-gold':' ic-dim')});
  const lc=el('div','lc');
  lc.innerHTML=`<div class="lcstars">${starIc(34,'a-pop d1',stars>=2)}${starIc(46,'a-pop',stars>=1)}${starIc(34,'a-pop d3',stars>=3)}</div>
    <div class="lcbig a-pop d2${passed?'':' fail'}">${passed?icon('check',{size:66,stroke:3.2}):icon('close',{size:60,stroke:3.4})}</div>
    <div class="lctxt"><div class="lct a-up d3">${passed?'Poziom zaliczony!':'Poziom niezaliczony'}</div><div class="lcs">${s.short||s.name} · ${noEmoji(lv.title)}</div></div>
    <div class="lcstats"><div class="lcstat a-up d4"><div class="k">XP</div><div class="v gold">+${ls.xp+bonus}</div></div>
      <div class="lcstat a-up d5"><div class="k">Celność</div><div class="v acid">${pct}%</div></div>
      <div class="lcstat a-up d6"><div class="k">Combo</div><div class="v pink">x${ls.maxCombo}</div></div></div>
    ${gem?`<div class="lcrewards a-up d5"><span class="lcreward cyan">${icon('gem',{size:15})}+${gem} ${pl(gem,'gem','gemy','gemów')}</span>${boostActive()?'<span class="lcreward gold">'+icon('bolt',{size:15})+'podwójne XP</span>':''}</div>`:''}
    ${gh?`<div class="lcghost ${gh.kind} a-up d5"><div class="ico">${icon(gh.kind==='win'?'bolt':'ghost',{size:24})}</div><div class="grow"><div class="t">${gh.t}</div><div class="s">${gh.s}</div></div></div>`:''}
    ${passed?'':'<p class="lcp">Poniżej 50%. Przejrzyj roladkę jeszcze raz i spróbuj ponownie.</p>'}`;
  const sk=el('button','lcstreak a-up d6',`<div class="ico">${icon('flame',{size:24})}</div><div class="grow"><div class="t">${n} ${pl(n,'dzień','dni','dni')} z rzędu</div><div class="s">${d.tasks.length&&dd>=d.tasks.length?'Plan dnia zrobiony':'Plan dnia: '+dd+' z '+d.tasks.length}</div></div>${icon('chevron-right',{size:20})}`);
  sk.onclick=()=>{closeLesson();go('streak');};
  lc.appendChild(sk);body.appendChild(lc);L.appendChild(body);
  const foot=el('div','lessonfoot col');
  const main=el('button','pill a-glow',passed?'DALEJ':'SPRÓBUJ JESZCZE RAZ');main.id=passed?'lcont':'lretry';
  main.onclick=passed?closeLesson:()=>startLesson(lv);
  const alt=el('button','pill text',passed?'POWTÓRZ POZIOM':'WRÓĆ NA ŚCIEŻKĘ');alt.id=passed?'lretry':'lcont';
  alt.onclick=passed?()=>startLesson(lv):closeLesson;
  foot.appendChild(main);foot.appendChild(alt);L.appendChild(foot);
  keyFn=e=>{if(e.key==='Enter')main.click();};
}

/* ---------- FISZKI (cały przedmiot, filtr po poziomach) ---------- */
let fState=null;
function renderFiszki(sc){
  const s=current;
  if(!fState||fState.subj!==s.id)fState={subj:s.id,lvl:'all',idx:0,flipped:false};
  const wrap=el('div','scroll');
  const chips=el('div','chips');
  const mk=(id,name)=>{const c=el('div','chip'+(fState.lvl===id?' active':''),name);c.onclick=()=>{fState.lvl=id;fState.idx=0;renderFiszki(sc);};return c;};
  chips.appendChild(mk('all','Wszystko'));
  s.levels.forEach(l=>chips.appendChild(mk(l.id,noEmoji(l.title))));
  wrap.appendChild(chips);
  const list = fState.lvl==='all'?allCards(s):allCards(s).filter(c=>c.lid===fState.lvl); // krok 6: elementy z lid/i (klucz SRS) także po filtrze poziomu
  if(fState.idx>=list.length)fState.idx=0;
  const c=list[fState.idx]||{t:'—',d:'Brak fiszek'};
  const hq=hearts().quest||0;
  wrap.appendChild(el('div','progressrow',`<div class="bar"><i style="width:${list.length?fState.idx/list.length*100:0}%"></i></div><div class="counter">${list.length?fState.idx+1:0}/${list.length}</div>${hq?`<div class="counter red">${icon('heart',{size:12})} za ${hq}</div>`:''}`));
  const flip=el('div','flip'+(fState.flipped?' flipped':''));flip.style.height='calc(100dvh - 340px)';
  flip.innerHTML=`<div class="flipinner">
    <div class="face front"><span class="tag">${c.lvl||''}</span><div class="term">${c.t}</div><div class="tapomat">dotknij, żeby odwrócić</div></div>
    <div class="face back"><span class="tag">odpowiedź</span><div class="deftxt">${c.d}</div><div class="tapomat">dotknij, żeby wrócić</div></div></div>`;
  flip.onclick=()=>{fState.flipped=!fState.flipped;flip.classList.toggle('flipped');};
  wrap.appendChild(flip);
  const btns=el('div','fbtns');
  const no=el('button','fbtn no',icon('refresh',{size:18,stroke:2.8})+' jeszcze nie');const yes=el('button','fbtn yes',icon('check',{size:18,stroke:3.4})+' umiem');
  const next=(known)=>{if(!list.length)return;srsTouch(s.id,c.lid,c.i,known);if(known){addXP(s.id,2);toast('+2 XP','check');}tickDaily(s.id,'review',1);missionEvent('review',1);heartReview();fState.flipped=false;fState.idx=(fState.idx+1)%Math.max(1,list.length);renderFiszki(sc);};
  no.onclick=()=>next(false);yes.onclick=()=>next(true);
  btns.appendChild(no);btns.appendChild(yes);wrap.appendChild(btns);
  sc.innerHTML='';sc.appendChild(wrap);
}

/* ---------- QUIZ (cały przedmiot, filtr po poziomach): kafle 3D + panel dobrze/źle; bez serc i combo (to tylko w lekcji) ---------- */
let qState=null;
function renderQuiz(sc){
  const s=current;closeSheet();
  if(!qState||qState.subj!==s.id)qState={subj:s.id,lvl:'all',list:null,idx:0,score:0,answered:false};
  if(!qState.list){
    qState.list = shuffle(qState.lvl==='all'?allQuiz(s):allQuiz(s).filter(q=>q.lid===qState.lvl)); // krok 9: także po filtrze poziomu elementy niosą lid/qi (klucz SRS, poprawki)
    qState.idx=0;qState.score=0;
  }
  const wrap=el('div','scroll quizview');
  const chips=el('div','chips');
  const mk=(id,name)=>{const c=el('div','chip'+(qState.lvl===id?' active':''),name);c.onclick=()=>{qState.lvl=id;qState.list=null;renderQuiz(sc);};return c;};
  chips.appendChild(mk('all','Wszystko'));
  s.levels.forEach(l=>chips.appendChild(mk(l.id,noEmoji(l.title))));
  wrap.appendChild(chips);
  wrap.appendChild(el('div','progressrow',`<div class="bar"><i style="width:${qState.list.length?qState.idx/qState.list.length*100:0}%"></i></div><div class="counter">${Math.min(qState.idx+1,qState.list.length)}/${qState.list.length}</div>`));
  if(qState.idx>=qState.list.length){
    const pct=qState.list.length?Math.round(qState.score/qState.list.length*100):0;
    if(qState.list.length)completeDaily(s.id,'quiz');
    const card=el('div','qcard');
    card.innerHTML=`<div class="result">${bigTile(pct>=70?'hot':pct>=50?'ok':'fail')}<h2>Wynik</h2>
      <div class="score">Trafione <b>${qState.score}/${qState.list.length}</b> (${pct}%)</div>
      <p>${pct>=70?'Dobrze znasz ten materiał.':pct>=50?'Nieźle. Przejrzyj jeszcze fiszki.':'Wróć do fiszek i ścieżki, a potem spróbuj ponownie.'}</p>
      <button class="pill" id="qre">${LBL.again}</button></div>`;
    wrap.appendChild(card);sc.innerHTML='';sc.appendChild(wrap);
    document.getElementById('qre').onclick=()=>{qState.list=null;renderQuiz(sc);};
    return;
  }
  const q=qState.list[qState.idx];qState.answered=false;
  const qb=quizBlock(q,{n:qState.idx+1,total:qState.list.length,tag:qState.lvl==='all'?(q.lvl||''):'',onAnswer:(i,ok)=>{
    qState.answered=true;
    const next=()=>{qState.idx++;renderQuiz(sc);};
    srsTouch(s.id,q.lid,'q'+q.qi,ok);
    const lv=s.levels.find(l=>l.id===q.lid);
    if(ok){qState.score++;addXP(s.id,3);wrap.appendChild(confetti(4));sheetOk(q,{xp:3,mult:1,combo:0,onNext:next,subj:s,lv,qi:q.qi});}
    else sheetBad(q,{onNext:next,subj:s,lv,qi:q.qi,onCards:()=>goCards(lv)}); // krok 9: qi → „popraw pytanie”
  }});
  wrap.appendChild(qb.body);wrap.appendChild(qb.foot);
  sc.innerHTML='';sc.appendChild(wrap);
}

/* ============================================================ KROK 7: EGZAMIN (ExamStart.html → ExamRun.html → Exam.html)
   ExamStart w zakładce „Egzamin”: zakres (poziomy), liczba pytań, limit czasu z grading.examMin, próg i siatka ocen, ostatnie/najlepsze podejście.
   ExamRun na pełnym ekranie (#lesson.egrun): timer (.a-blink pod 2 min, pasek opadający), siatka pytań w arkuszu (skok), flaga, kafle bez oceny w trakcie,
   wstecz/dalej, „Zakończ” z podsumowaniem; koniec czasu = automatyczne zakończenie. Egzamin = tylko pytania quizu (bez zadań), bez serc i SRS.
   Wynik: pierścień, ocena z siatki (podświetlony wiersz), zdane/nie, kafle, przegląd pytań (złe najpierw, z wyjaśnieniem i źródłem src),
   „Talia błędów” → sesja powtórki tylko z błędów + PROGRESS.examDeck (Dziś: „Powtórz błędy z egzaminu”).
   Zapis w subjState(id).exam = {n, passed, best:{pct,grade,correct,total,date}, last:{…}} i PROGRESS.examsPassed (odznaki w kroku 8). */
let exState=null,exInt=null,exCfg=null;
function fmt(s){const m=Math.floor(s/60),x=s%60;return m+':'+String(x).padStart(2,'0');}
function exScale(s){return (s.grading&&s.grading.scale)||[[90,'5'],[70,'4'],[50,'3']];} // [[min,label],...] malejąco
function exPass(s){return (s.grading&&s.grading.pass)||50;}
function exFailLabel(s){return (s.grading&&s.grading.failLabel)||'2 — niezaliczone';}
function exGrade(s,pct){for(const[min,lab]of exScale(s)){if(pct>=min)return lab;}return exFailLabel(s);}
function examMin(s){return (s.grading&&s.grading.examMin)||20;}
function examRec(sid){const st=subjState(sid);if(!st.exam||typeof st.exam!=='object')st.exam={n:0,passed:0};return st.exam;}
function exQuizFor(s,levels){return allQuiz(s).filter(q=>!levels||levels.indexOf(q.lid)>=0);}
/* etykieta oceny: „5 / bdb” → [„5”, „bdb”], „2 — niezaliczone” → [„2”, „niezaliczone”] */
function gradeParts(g){const m=String(g).split(/\s*[—–\/]\s*/);return [m[0],m.slice(1).join(' ')];}
function dateOf(ds){const p=ds.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function fmtDate(ds){const d=dateOf(ds);return d.getDate()+' '+MONTHS[d.getMonth()];}
function inDays(n){return n===0?'dziś':n===1?'jutro':`za ${n} ${pl(n,'dzień','dni','dni')}`;}
/* ustawienia egzaminu (na czas sesji, per przedmiot): levels = id poziomów w zakresie, n = 10 | 20 | 'all', lim = minuty (0 = bez limitu) */
function examConfig(s,o){
  if(!exCfg||exCfg.subj!==s.id)exCfg={subj:s.id,levels:s.levels.map(l=>l.id),n:20,lim:examMin(s)};
  if(o){if(o.levels)exCfg.levels=o.levels.slice();if(o.n!=null)exCfg.n=o.n;if(o.lim!=null)exCfg.lim=o.lim;}
  return exCfg;
}
function renderEgzamin(sc){
  const s=current;clearInterval(exInt);exState=null;
  const cfg=examConfig(s);const lim0=examMin(s);
  const pool=exQuizFor(s,cfg.levels);const ALL=pool.length;const TOTAL=allQuiz(s).length;
  const N=cfg.n==='all'?ALL:Math.min(cfg.n,ALL);
  const allOn=cfg.levels.length===s.levels.length;
  const rec=examRec(s.id);const scale=exScale(s);const pass=exPass(s);
  const nOpts=[[10,'10'],[20,'20'],['all','wszystkie · '+ALL]].filter(([v])=>v==='all'||v<ALL);
  const lims=[...new Set([Math.max(5,Math.round(lim0/2)),lim0,lim0*2])].sort((a,b)=>a-b).map(m=>[m,m+' min']).concat([[0,'bez limitu']]);
  const t=testFor(s.id);
  const wrap=el('div','scroll exstart');
  wrap.innerHTML=`<div class="egspecs a-up">
      <div class="egspec a-pop d1"><b>${N}</b><span>${pl(N,'pytanie','pytania','pytań')}</span></div>
      <div class="egspec a-pop d2"><b>${cfg.lim||'∞'}</b><span>${cfg.lim?pl(cfg.lim,'minuta','minuty','minut'):'bez limitu'}</span></div>
      <div class="egspec a-pop d3"><b class="acid">${pass}%</b><span>próg</span></div></div>
    <div class="egcard a-up d2"><div class="eglbl">Zakres</div>
      <button class="egrow all${allOn?' on':''}" data-lv="all"><span class="box">${allOn?icon('check',{size:14,stroke:4}):''}</span><span class="t">Wszystkie poziomy</span><span class="n">${TOTAL}</span></button>
      ${s.levels.map(l=>{const on=cfg.levels.indexOf(l.id)>=0,n=(l.quiz||[]).length;return `<button class="egrow${on?' on':''}" data-lv="${l.id}" aria-pressed="${on}"><span class="box">${on?icon('check',{size:14,stroke:4}):''}</span><span class="t">${noEmoji(l.title)}</span><span class="n">${n}</span></button>`;}).join('')}</div>
    <div class="egcard a-up d3"><div class="eglbl">Liczba pytań</div><div class="egchips" id="egn">${nOpts.map(([v,l])=>`<button class="egchip${String(cfg.n)===String(v)?' on':''}" data-n="${v}">${l}</button>`).join('')}</div>
      <div class="eglbl">Limit czasu</div><div class="egchips" id="eglim">${lims.map(([v,l])=>`<button class="egchip${cfg.lim===v?' on':''}" data-lim="${v}">${l}</button>`).join('')}</div>
      <div class="eglbl">Siatka ocen</div><div class="egscale">${scale.map(([min,lab])=>`<span><b>${gradeParts(lab)[0]}</b> od ${min}%</span>`).join('')}<span><b class="fail">${gradeParts(exFailLabel(s))[0]}</b> pod ${pass}%</span></div></div>
    <div class="egwarn a-up d4"><div class="eglbl">Warunki jak na prawdziwym</div>
      <div class="r">${icon('close',{size:16,stroke:3})}<span>Brak żyć i podpowiedzi</span></div>
      <div class="r">${icon('close',{size:16,stroke:3})}<span>Wyjaśnienia dopiero na końcu</span></div>
      <div class="r">${icon('check',{size:16,stroke:3.4,cls:'ok'})}<span>Możesz oznaczać pytania i do nich wracać</span></div></div>
    <div class="eglast a-up d5"><div class="ico${rec.best?' gold':''}">${icon(rec.best?'trophy':'chart',{size:22,stroke:2.4})}</div><div class="grow">
      <div class="t">${rec.last?'Ostatnie podejście':'Jeszcze bez podejścia'}</div>
      <div class="s">${rec.last?`${fmtDate(rec.last.date)} · ${rec.last.pct}% · ocena ${gradeParts(rec.last.grade)[0]}${rec.best&&rec.best.pct>rec.last.pct?` · najlepiej ${rec.best.pct}%`:''}`:'Pierwsze zawsze jest próbne. Wynik zapisuje się tutaj.'}</div></div></div>
    <div class="eglast a-up d6"><div class="ico">${icon('calendar',{size:22,stroke:2.4})}</div><div class="grow"><div class="t">${t?`Sprawdzian ${inDays(dayDiff(todayStr(),t.date))}`:'Mam sprawdzian'}</div><div class="s">${t?'plan dzień po dniu jest gotowy':'ułożę plan dzień po dniu do daty sprawdzianu'}</div></div>${icon('chevron-right',{size:20,cls:'chev'})}</div>
    <div class="eglast cram a-up d6" id="excram" role="button" tabindex="0"><div class="ico violet">${icon('moon',{size:22})}</div><div class="grow"><div class="t">Egzamin jutro?</div><div class="s">Noc przed egzaminem — 4 bloki po 5 minut, potem spać</div></div>${icon('chevron-right',{size:20,cls:'chev'})}</div>`;
  // przypięta stopka ze startem (ExamStart.html): lista poziomów bywa długa, przycisk ma być zawsze pod ręką
  const foot=el('div','egfoot');
  foot.innerHTML=`<button class="pill a-glow" id="exstart"${N?'':' disabled'}>ZACZYNAM · ${N} ${pl(N,'PYTANIE','PYTANIA','PYTAŃ')}</button>`;
  sc.innerHTML='';sc.appendChild(wrap);sc.appendChild(foot);
  const tb=wrap.querySelector('.eglast.d6');tb.id='extest';tb.setAttribute('role','button');tb.tabIndex=0;
  wrap.querySelectorAll('.egrow').forEach(b=>b.onclick=()=>{
    const id=b.dataset.lv;
    if(id==='all')examConfig(s,{levels:allOn?[s.levels[0].id]:s.levels.map(l=>l.id)});
    else{const set=cfg.levels.indexOf(id)>=0?cfg.levels.filter(x=>x!==id):s.levels.map(l=>l.id).filter(x=>x===id||cfg.levels.indexOf(x)>=0);examConfig(s,{levels:set.length?set:[id]});}
    renderEgzamin(sc);});
  wrap.querySelectorAll('#egn .egchip').forEach(b=>b.onclick=()=>{examConfig(s,{n:b.dataset.n==='all'?'all':+b.dataset.n});renderEgzamin(sc);});
  wrap.querySelectorAll('#eglim .egchip').forEach(b=>b.onclick=()=>{examConfig(s,{lim:+b.dataset.lim});renderEgzamin(sc);});
  foot.querySelector('#exstart').onclick=()=>beginExam();
  tb.onclick=()=>{if(t)openTestPlan(t.id,'subject');else openTestSheet(s.id);};
  wrap.querySelector('#excram').onclick=()=>openCram(s.id); // krok 9: Cram.html
}
function beginExam(){
  const s=current;const cfg=examConfig(s);
  const pool=shuffle(exQuizFor(s,cfg.levels));const N=cfg.n==='all'?pool.length:Math.min(cfg.n,pool.length);
  if(!N){toast('Brak pytań w tym zakresie','alert');return;}
  const lim=cfg.lim*60;
  exState={pool:pool.slice(0,N),idx:0,pick:new Array(N).fill(null),flags:new Array(N).fill(false),limit:lim,left:lim,started:Date.now(),levels:cfg.levels.slice()};
  clearInterval(exInt);
  if(lim)exInt=setInterval(()=>{const ex=exState;if(!ex)return clearInterval(exInt);ex.left--;exTick();if(ex.left<=0){clearInterval(exInt);examFinish(true);}},1000);
  renderExamQ();
}
function exTick(){
  const ex=exState;if(!ex)return;const warn=ex.left<=120;
  const t=document.getElementById('egtime');if(t){t.textContent=fmt(Math.max(0,ex.left));t.classList.toggle('a-blink',warn);}
  const p=document.getElementById('egtimer');if(p)p.classList.toggle('warn',warn);
  const d=document.getElementById('egdrain');if(d){d.classList.toggle('warn',warn);d.firstChild.style.width=(ex.limit?Math.max(0,ex.left)/ex.limit*100:100)+'%';}
}
function renderExamQ(){
  const L=document.getElementById('lesson');const ex=exState;if(!L||!ex)return;
  closeSheet();keyFn=null;
  const M=ex.pool.length,q=ex.pool[ex.idx],sel=ex.pick[ex.idx],flag=ex.flags[ex.idx],last=ex.idx+1>=M,warn=ex.left<=120&&ex.limit;
  L.className='lesson open egrun';L.innerHTML='';
  const head=el('div','eghead');
  head.innerHTML=`<div class="egtop"><button class="x" id="egclose" aria-label="Zakończ egzamin">${icon('close',{size:18,stroke:3})}</button>
      <div class="grow"><div class="egn">Pytanie ${ex.idx+1} z ${M}</div><div class="bar"><i style="width:${Math.round(ex.idx/M*100)}%"></i></div></div>
      <button class="egtimer${warn?' warn':''}" id="egtimer" aria-label="Pozostały czas">${icon('clock',{size:15})}<span id="egtime"${warn?' class="a-blink"':''}>${ex.limit?fmt(Math.max(0,ex.left)):'—'}</span></button>
      <button class="eggridbtn" id="eggrid" aria-label="Siatka pytań">${icon('grid',{size:20,stroke:2.4})}</button></div>
    <div class="egdrain${warn?' warn':''}" id="egdrain"><i style="width:${ex.limit?Math.max(0,ex.left)/ex.limit*100:100}%"></i></div>`;
  L.appendChild(head);
  const body=el('div','lessonbody');const quiz=el('div','quiz');
  quiz.innerHTML=`<div class="qchips"><span class="qn">${q.lvl||''}</span>${flag?'<span class="combo">Do wrócenia</span>':''}</div>
    <div class="egqrow a-up"><div class="qq">${q.q}</div><button class="egflag${flag?' on':''}" id="egflag" aria-pressed="${flag}" aria-label="Oznacz do wrócenia">${icon('bookmark',{size:18,fill:flag})}</button></div>
    <div class="qopts">${q.a.map((a,i)=>`<button class="qopt a-up d${Math.min(6,i+1)}${sel===i?' sel':''}" data-i="${i}"><span class="k">${keys[i]}</span><span class="t">${a}</span></button>`).join('')}</div>`;
  body.appendChild(quiz);L.appendChild(body);
  const foot=el('div','lessonfoot egnav');
  const prev=el('button','pill ghost egprev',icon('back',{size:20,stroke:3}));prev.id='egprev';prev.setAttribute('aria-label','Poprzednie pytanie');prev.disabled=ex.idx===0;
  const next=el('button','pill violet a-glow',last?'ZAKOŃCZ':'DALEJ');next.id='egnext';
  foot.appendChild(prev);foot.appendChild(next);L.appendChild(foot);
  const opts=[...quiz.querySelectorAll('.qopt')];
  const select=i=>{if(!opts[i])return;ex.pick[ex.idx]=ex.pick[ex.idx]===i?null:i;opts.forEach(x=>x.classList.toggle('sel',+x.dataset.i===ex.pick[ex.idx]));};
  const goTo=i=>{ex.idx=Math.max(0,Math.min(M-1,i));renderExamQ();};
  opts.forEach(x=>x.onclick=()=>select(+x.dataset.i));
  prev.onclick=()=>{if(ex.idx>0&&advOk())goTo(ex.idx-1);};
  next.onclick=()=>{if(!advOk())return;if(last)confirmExamFinish();else goTo(ex.idx+1);};
  quiz.querySelector('#egflag').onclick=()=>{ex.flags[ex.idx]=!ex.flags[ex.idx];renderExamQ();};
  head.querySelector('#egclose').onclick=confirmExamFinish;
  head.querySelector('#eggrid').onclick=openExamGrid;
  head.querySelector('#egtimer').onclick=()=>toast(ex.limit?'Zostało '+fmt(Math.max(0,ex.left)):'Egzamin bez limitu czasu','clock');
  keyFn=e=>{const k=(e.key||'').toLowerCase();const m=/^[1-5]$/.test(k)?+k-1:'abcde'.indexOf(k);
    if(k.length===1&&m>=0&&m<opts.length)select(m);else if(k==='f')quiz.querySelector('#egflag').click();
    else if(e.key==='ArrowLeft')prev.click();else if(e.key==='ArrowRight'||e.key==='Enter'){e.preventDefault();next.click();}};
}
/* arkusz z siatką pytań: z odpowiedzią / do wrócenia / bieżące; tap = skok */
function openExamGrid(){
  const ex=exState;if(!ex)return;
  const s=openSheet('eggrid',`<div class="shandle"></div><div class="shead"><div class="st2">Pytania</div><button class="backbtn sclose" id="eggclose" aria-label="Zamknij">${icon('close',{size:18,stroke:3})}</button></div>
    <div class="egsquares">${ex.pool.map((q,i)=>{const st=i===ex.idx?'cur a-pulse':ex.flags[i]?'flag':ex.pick[i]!=null?'ans':'';
      return `<button class="egsq ${st}" data-i="${i}" aria-label="Pytanie ${i+1}${ex.flags[i]?', do wrócenia':ex.pick[i]!=null?', z odpowiedzią':', bez odpowiedzi'}${i===ex.idx?', bieżące':''}">${i+1}</button>`;}).join('')}</div>
    <div class="eglegend"><span><i class="ans"></i>z odpowiedzią</span><span><i class="flag"></i>do wrócenia</span><span><i class="cur"></i>bieżące</span><span><i></i>puste</span></div>`);
  sheetBack();
  s.querySelector('#eggclose').onclick=()=>renderExamQ();
  s.querySelectorAll('.egsq').forEach(b=>b.onclick=()=>{ex.idx=+b.dataset.i;renderExamQ();});
  document.getElementById('sheetback').onclick=()=>renderExamQ();
  keyFn=e=>{if(e.key==='Escape'||e.key==='Enter')renderExamQ();};
}
/* „Zakończ”: ile bez odpowiedzi / oznaczonych / z odpowiedzią; wróć do pytań, zakończ i sprawdź, przerwij bez wyniku */
function confirmExamFinish(){
  const ex=exState;if(!ex)return;
  const M=ex.pool.length,un=ex.pick.filter(p=>p==null).length,fl=ex.flags.filter(Boolean).length;
  const firstUn=ex.pick.findIndex(p=>p==null);
  const s=openSheet('egconfirm',`<div class="shandle"></div><div class="shead"><div class="st2">Zakończyć egzamin?</div></div>
    <div class="egsum"><div class="egsumtile red a-pop d1"><b>${un}</b><span>bez odpowiedzi</span></div><div class="egsumtile gold a-pop d2"><b>${fl}</b><span>do wrócenia</span></div><div class="egsumtile acid a-pop d3"><b>${M-un}</b><span>z odpowiedzią</span></div></div>
    <p class="sp">${un?'Pytania bez odpowiedzi liczą się jako błędne.':'Każde pytanie ma odpowiedź.'}${fl?' Oznaczone możesz jeszcze sprawdzić.':''}</p>
    <div class="sbtns"><button class="pill ghost" id="egback">${un>0?'DO PUSTYCH':'WRÓĆ'}</button><button class="pill" id="egfin" data-primary>ZAKOŃCZ I SPRAWDŹ</button></div>
    <button class="pill text" id="egabort">Przerwij bez wyniku</button>`);
  sheetBack();
  s.querySelector('#egback').onclick=()=>{if(un>0&&firstUn>=0)ex.idx=firstUn;renderExamQ();};
  s.querySelector('#egfin').onclick=()=>examFinish(false);
  s.querySelector('#egabort').onclick=()=>{exitExam();toast('Egzamin przerwany','close');};
  document.getElementById('sheetback').onclick=()=>renderExamQ();
}
function exitExam(){clearInterval(exInt);exState=null;closeSheet();keyFn=null;renderSubject();}
function examFinish(auto){
  clearInterval(exInt);closeSheet();keyFn=null;const s=current;const ex=exState;if(!ex)return;
  const M=ex.pool.length;let correct=0,blank=0;const wrong=[];
  ex.pool.forEach((q,i)=>{const p=ex.pick[i];if(p===q.c)correct++;else{if(p==null)blank++;wrong.push({q,sel:p,i});}});
  const pct=Math.round(correct/M*100);const grade=exGrade(s,pct),pass=exPass(s),passed=pct>=pass;
  const used=ex.limit?ex.limit-Math.max(0,ex.left):Math.round((Date.now()-ex.started)/1000);
  // XP jak dotąd (3 za poprawne), plan dnia, plan do sprawdzianu (dzień „próbny”), rekord i liczniki (odznaki w kroku 8)
  addXP(s.id,correct*3);completeDaily(s.id,'exam');testDone(s.id,'mock');
  const rec=examRec(s.id);rec.n=(rec.n|0)+1;if(passed)rec.passed=(rec.passed|0)+1;
  const entry={pct,grade,correct,total:M,date:todayStr()};const newBest=!rec.best||pct>rec.best.pct;rec.last=entry;if(newBest)rec.best=entry;
  if(passed)PROGRESS.examsPassed=(PROGRESS.examsPassed|0)+1;
  // talia błędów: klucze SRS złych odpowiedzi w PROGRESS.examDeck (jedna talia, ostatni egzamin zastępuje); Dziś dostaje wiersz „Powtórz błędy z egzaminu”
  const deck=wrong.map(w=>s.id+':'+w.q.lid+':q'+w.q.qi);
  PROGRESS.examDeck=((PROGRESS.examDeck||[]).filter(k=>k.indexOf(s.id+':')!==0)).concat(deck);if(!PROGRESS.examDeck.length)delete PROGRESS.examDeck;
  const d=daily();if(deck.length&&!d.tasks.some(x=>x.id===s.id+':weak'))d.tasks.push({id:s.id+':weak',done:false});
  saveProgress();checkBadges(); // krok 8
  exState=null;
  renderExamResult({s,pool:ex.pool,correct,blank,wrong,pct,grade,pass,passed,used,M,auto,newBest,deck});
  if(auto)setTimeout(()=>toast('Czas minął — egzamin zakończony','clock'),400);
}
function ringSvg(pct,R){const C=Math.round(2*Math.PI*R*10)/10;return `<svg viewBox="0 0 124 124" aria-hidden="true"><circle class="ring-bg" cx="62" cy="62" r="${R}"/><circle class="ring-fg" cx="62" cy="62" r="${R}" style="stroke-dasharray:${C};stroke-dashoffset:${Math.round(C*(1-Math.max(0,Math.min(100,pct))/100)*10)/10}"/></svg>`;}
function renderExamResult(r){
  const s=r.s;const L=document.getElementById('lesson');if(!L)return;
  L.className='lesson open egres';L.innerHTML='';
  const body=el('div','lessonbody done');body.appendChild(el('div','blob a-float '+(r.passed?'acid':'red')));if(r.passed)body.appendChild(confetti(6));
  const scale=exScale(s);const [gMain,gRest]=gradeParts(r.grade);
  const nextG=scale.slice().reverse().find(([min])=>min>r.pct);
  const need=nextG?Math.max(1,Math.ceil(nextG[0]/100*r.M)-r.correct):0;
  const needPass=Math.max(1,Math.ceil(r.pass/100*r.M)-r.correct);
  const note=(r.auto?'Czas minął. ':'')+(r.passed?(nextG?`Do ${gradeParts(nextG[1])[0]} brakuje ${need} ${pl(need,'pytania','pytań','pytań')}.`:'Najwyższa ocena w siatce.'):`Do progu ${r.pass}% brakuje ${needPass} ${pl(needPass,'pytania','pytań','pytań')}.`)+(r.newBest&&r.correct?' Nowy rekord.':'');
  const nw=r.wrong.length;
  // „Gdzie tracisz punkty” (Exam.html): celność per poziom, od najsłabszego; tylko gdy zakres ma więcej niż jeden poziom
  const byLv={};r.pool.forEach((q,i)=>{const k=q.lid;if(!byLv[k])byLv[k]={t:q.lvl||k,n:0,ok:0};byLv[k].n++;if(!r.wrong.some(w=>w.i===i))byLv[k].ok++;});
  const lvRows=Object.values(byLv).map(x=>({...x,pct:Math.round(x.ok/x.n*100)})).sort((a,b)=>a.pct-b.pct);
  const lvCard=lvRows.length>1?`<div class="egcard a-up d3"><div class="eglbl">Gdzie tracisz punkty</div><div class="eglv">${lvRows.map((x,i)=>`<div class="eglvrow ${x.pct<50?'red':x.pct<75?'gold':'acid'}"><span class="lb">${x.t}</span><div class="bar"><i class="a-grow d${Math.min(6,i+1)}" style="width:${x.pct}%"></i></div><span class="p">${x.pct}%</span></div>`).join('')}</div></div>`:'';
  // krok 9: każde pytanie ma przycisk „Zgłoś / popraw” (EditContent) i klikalne źródło (SourceView); poprawione = plakietka
  const editBtn=(q,i)=>`<button class="egedit" type="button" data-i="${i}">${icon('edit',{size:14})}<span>${q.edited?'Poprawione · edytuj':'Zgłoś / popraw'}</span></button>`;
  const items=r.wrong.map(w=>`<div class="egitem bad a-up" data-i="${w.i}"><div class="qh"><span class="num">${w.i+1}</span><span>${w.q.q}</span></div>
      <div class="rbad">Twoja: ${w.sel==null?'bez odpowiedzi':keys[w.sel]+'. '+w.q.a[w.sel]}</div><div class="rgood">Dobra: ${keys[w.q.c]}. ${w.q.a[w.q.c]}</div>
      ${w.q.e?`<div class="re">${w.q.e}</div>`:''}${srcLine(w.q)}${editBtn(w.q,w.i)}</div>`)
    .concat(r.pool.map((q,i)=>r.wrong.some(w=>w.i===i)?'':`<div class="egitem ok" data-i="${i}"><div class="qh"><span class="num">${i+1}</span><span>${q.q}</span></div><div class="rgood">${keys[q.c]}. ${q.a[q.c]}</div>${srcLine(q)}${editBtn(q,i)}</div>`)).join('');
  const lc=el('div','lc egl');
  lc.innerHTML=`<div class="eghero ${r.passed?'ok':'bad'} a-up"><div class="rvring a-pop">${ringSvg(r.pct,48)}<div class="rvpct"><b>${r.pct}%</b><span>${r.correct}/${r.M}</span></div></div>
      <div class="grow"><div class="eglbl">${r.passed?'Twoja ocena':'Poniżej progu'}</div><div class="eggrade">${gMain}${gRest?`<small>${gRest}</small>`:''}</div><div class="egnote">${note}</div></div></div>
    <div class="egstats a-up d2"><div class="egstat acid"><b>${r.correct}</b><span>poprawne</span></div><div class="egstat red"><b>${nw-r.blank}</b><span>błędne</span></div><div class="egstat gold"><b>${r.blank}</b><span>puste</span></div><div class="egstat cyan"><b>${fmt(r.used)}</b><span>czas</span></div></div>
    ${lvCard}
    <div class="egcard a-up d3"><div class="eglbl">Siatka ocen</div><div class="egscalelist">${scale.map(([min,lab])=>`<div class="egsrow${r.passed&&lab===r.grade?' on':''}"><span class="g">${gradeParts(lab)[0]}</span><div class="bar"><i style="width:${min}%"></i></div><span class="p">od ${min}%</span></div>`).join('')}
      <div class="egsrow fail${r.passed?'':' on'}"><span class="g">${gradeParts(exFailLabel(s))[0]}</span><div class="bar"><i style="width:${Math.max(0,r.pass-1)}%"></i></div><span class="p">pod ${r.pass}%</span></div></div></div>
    ${nw?`<button class="egdeck a-up d4" id="egdeck2"><div class="ico">${icon('alert',{size:24,stroke:2.8})}</div><div class="grow"><div class="t">${nw} ${pl(nw,'błąd do powtórki','błędy do powtórki','błędów do powtórki')}</div><div class="s">W osobnej talii — wraca też na ekranie Dziś</div></div>${icon('chevron-right',{size:20})}</button>`
        :`<div class="egdeck ok a-up d4"><div class="ico">${icon('check',{size:24,stroke:3.4})}</div><div class="grow"><div class="t">Bez błędów</div><div class="s">Cały zakres opanowany</div></div></div>`}
    <div class="egrev a-up d5"><div class="eyebrow sec">Przegląd pytań${nw?' — błędy najpierw':''}</div>${items}</div>`;
  body.appendChild(lc);L.appendChild(body);
  const foot=el('div','lessonfoot col');
  const main=el('button','pill a-glow',nw?`TALIA BŁĘDÓW · ${nw}`:'GOTOWE');main.id='egmain';
  main.onclick=nw?()=>startExamDeck(s.id):()=>exitExam();
  const alt=el('button','pill ghost',nw?'WRÓĆ DO EGZAMINU':'JESZCZE RAZ');alt.id='egalt';alt.onclick=()=>exitExam();
  foot.appendChild(main);foot.appendChild(alt);L.appendChild(foot);
  const d2=lc.querySelector('#egdeck2');if(d2)d2.onclick=()=>startExamDeck(s.id);
  keyFn=e=>{if(e.key==='Enter')main.click();};
  // krok 9: popraw pytanie / źródło z przeglądu; po zapisie przegląd rysuje się na nowo z poprawką (bez toastu wyniku)
  lc.querySelectorAll('.egitem').forEach(item=>{
    const i=+item.dataset.i;const q=r.pool[i];const lv=s.levels.find(l=>l.id===q.lid);const ctx={s,lv,qi:q.qi};
    const redraw=()=>{r.pool[i]={...q,...qOf(s,lv,q.qi)};r.wrong.forEach(w=>{if(w.i===i)w.q=r.pool[i];});renderExamResult({...r,quiet:true});};
    const eb=item.querySelector('.egedit');if(eb)eb.onclick=()=>openEditContent(s,lv,q.qi,{onBack:()=>{closeSheet();},onSaved:redraw});
    const sb=item.querySelector('.rsrc');if(sb)sb.onclick=()=>openSourceView(q,ctx,()=>closeSheet());
  });
  if(r.quiet)return;
  if(r.passed)toast('Zdane, ocena '+gMain,'trophy');else toast('Niezaliczone','x-circle');
}
/* talia błędów: sesja powtórki tylko z pytań z PROGRESS.examDeck danego przedmiotu; trafione wypadają z talii (finishReview) */
function deckKeys(sid){return (PROGRESS.examDeck||[]).filter(k=>k.indexOf(sid+':')===0);}
function hasDeck(sid){return deckKeys(sid).some(k=>srsResolve(k));}
function startExamDeck(sid){
  const items=deckKeys(sid).map(srsResolve).filter(Boolean);
  if(!items.length){toast('Talia błędów jest pusta','check');return;}
  clearInterval(exInt);exState=null;closeSheet();keyFn=null;current=null;applyTheme(null);
  startReview(shuffle(items));rvState.deck=sid;
}

/* ============================================================ KROK 7: PLAN DO SPRAWDZIANU (DESIGN.md §4.3, TestPlan.html)
   PROGRESS.tests = [{id, subjectId, levels:[id…], date:"yyyy-mm-dd", plan:[{date, kind:"learn"|"review"|"mock"|"weak"|"rest", minutes, lv?, n?, short?, done?}], built}]
   Układ: dni przed końcówką = nauka niezaliczonych poziomów (learn) i powtórka (co trzeci wolny dzień odpoczynek); końcówka: próbny sprawdzian (−3),
   słabe punkty (−2, gdy jest talia błędów albo próbny przed nim), krótka powtórka (−1). Przeliczenie: raz dziennie (syncTests) od dziś — pominięty dzień
   zostaje w historii jako „pominięte”, a niezaliczone poziomy rozkładają się na nowo. Jeden plan na przedmiot. */
const TP_LABEL={learn:'Nauka',review:'Powtórka + zadania',mock:'Próbny sprawdzian',weak:'Tylko słabe punkty',rest:'Wolne'};
const TP_ICON={learn:'book',review:'refresh',mock:'target',weak:'alert',rest:'clock'};
let tpId=null,tpFrom=null;
function tests(){if(!Array.isArray(PROGRESS.tests))PROGRESS.tests=[];return PROGRESS.tests;}
function testFor(sid){return tests().find(t=>t.subjectId===sid)||null;}
function testSubject(t){return SUBJECTS.find(s=>s.id===t.subjectId)||null;}
function unfinishedLevels(s,levels){const st=subjState(s.id);return levels.filter(id=>s.levels.some(l=>l.id===id)&&!(st.levels[id]||{}).done);}
function buildTestPlan(t){
  const s=testSubject(t);if(!s)return [];
  const today=todayStr();const N=dayDiff(today,t.date);
  const past=(t.plan||[]).filter(r=>r.date<today);
  if(N<=0)return past;
  const left=unfinishedLevels(s,t.levels);const nq=exQuizFor(s,t.levels).length;
  const tail=[];
  tail.unshift({date:addDays(t.date,-1),kind:'review',minutes:20,short:true}); // krok 9: ostatni dzień = „Noc przed egzaminem” (Cram, 20 min)
  if(N>=2)tail.unshift({date:addDays(t.date,-2),kind:(N>=3||hasDeck(s.id))?'weak':'review',minutes:8});
  if(N>=3)tail.unshift({date:addDays(t.date,-3),kind:'mock',minutes:Math.max(8,Math.min(20,nq)),n:Math.min(20,nq)});
  const D=N-tail.length,L=left.length;const head=[];
  if(D>0){
    if(L>=D){const per=Math.ceil(L/D);for(let i=0;i<D;i++){const lv=left.slice(i*per,(i+1)*per);head.push(lv.length?{date:addDays(today,i),kind:'learn',lv,minutes:4+6*lv.length}:{date:addDays(today,i),kind:'review',minutes:10});}}
    else{const learnDays=[];for(let i=0;i<L;i++)learnDays.push(Math.floor(i*D/L));let free=0;
      for(let i=0;i<D;i++){const date=addDays(today,i);const k=learnDays.indexOf(i);
        if(k>=0){head.push({date,kind:'learn',lv:[left[k]],minutes:10});free=0;}
        else{free++;if(free===3){head.push({date,kind:'rest',minutes:0});free=0;}else head.push({date,kind:'review',minutes:10});}}}
  }
  const rows=head.concat(tail);
  const prev=(t.plan||[]).find(r=>r.date===today);if(prev&&prev.done&&rows[0]&&rows[0].kind===prev.kind)rows[0].done=true;
  return past.concat(rows);
}
/* raz dziennie: usuń plany po terminie, przelicz dni od dziś (pominięte dni zostają w historii) */
function syncTests(){
  const today=todayStr();const list=tests();let ch=false;
  for(let i=list.length-1;i>=0;i--){const t=list[i];
    if(!t||!testSubject(t)||t.date<today){list.splice(i,1);ch=true;continue;}
    if(t.built!==today){t.plan=buildTestPlan(t);t.built=today;ch=true;}}
  if(ch)saveProgress();
}
function createTest(sid,date,levels){
  const list=tests();const i=list.findIndex(t=>t.subjectId===sid);
  const t={id:'t'+Date.now().toString(36),subjectId:sid,levels:levels.slice(),date,plan:[],built:null};
  if(i>=0)list.splice(i,1,t);else list.push(t);
  t.plan=buildTestPlan(t);t.built=todayStr();saveProgress();return t;
}
function removeTest(id){const list=tests();const i=list.findIndex(t=>t.id===id);if(i>=0){list.splice(i,1);saveProgress();}}
/* zaliczenie dzisiejszego wiersza planu: learn (wszystkie poziomy wiersza zaliczone), review, mock, weak */
function testDone(sid,kind,lvId){
  const t=testFor(sid);if(!t)return false;const r=(t.plan||[]).find(x=>x.date===todayStr());
  if(!r||r.done||r.kind!==kind)return false;
  if(kind==='learn'&&r.lv){const st=subjState(sid);if(!r.lv.every(id=>(st.levels[id]||{}).done))return false;}
  r.done=true;saveProgress();setTimeout(()=>toast('Plan do sprawdzianu: dzień zaliczony','calendar'),4400);return true;
}
function tpTitle(t,r){
  const s=testSubject(t);
  if(r.kind==='learn'){const n=(r.lv||[]).length;if(n===1&&s){const lv=s.levels.find(l=>l.id===r.lv[0]);if(lv)return 'Nauka: '+noEmoji(lv.title);}return `Nauka: ${n} ${pl(n,'poziom','poziomy','poziomów')}`;}
  if(r.kind==='review')return r.short?'Noc przed egzaminem':TP_LABEL.review;
  return TP_LABEL[r.kind]||r.kind;
}
function tpSub(r){
  if(r.kind==='learn')return `${r.minutes} min · nowe pojęcia`;
  if(r.kind==='review')return r.short?'20 min · 4 bloki, bez nowych rzeczy, potem spać':`${r.minutes} min`;
  if(r.kind==='mock')return `${r.minutes} min · ${r.n} ${pl(r.n,'pytanie','pytania','pytań')}`;
  if(r.kind==='weak')return `${r.minutes} min · błędy z próbnego`;
  return 'odpoczynek też się liczy';
}
/* pojęcia do powtórki z zakresu: najpierw zaległe SRS, potem wszystkie wpisy SRS, na końcu fiszki z poziomów (max 15) */
function reviewItemsFor(s,levels){
  const inScope=x=>levels.indexOf(x.lv.id)>=0;
  const due=srsDue().filter(x=>x.s.id===s.id&&inScope(x));if(due.length)return due;
  const all=srsEntries().filter(x=>x.s.id===s.id&&inScope(x));if(all.length)return shuffle(all).slice(0,15);
  const cards=allCards(s).filter(c=>levels.indexOf(c.lid)>=0).map(c=>({s,lv:s.levels.find(l=>l.id===c.lid),kind:'card',c,idx:c.i,key:s.id+':'+c.lid+':'+c.i}));
  return shuffle(cards).slice(0,15);
}
function testAction(t,r){
  const s=testSubject(t);if(!s)return;
  if(r.kind==='rest'){toast('Dziś wolne. Odpoczynek też się liczy','check');return;}
  if(r.kind==='learn'){const st=subjState(s.id);const id=(r.lv||[]).find(x=>!(st.levels[x]||{}).done)||(r.lv||[])[0];const lv=s.levels.find(l=>l.id===id);
    openSubject(s.id,'path');if(lv){if(levelUnlocked(s,s.levels.indexOf(lv)))startLesson(lv);else toast('Najpierw zalicz poprzedni poziom','lock');}return;}
  if(r.kind==='review'&&r.short){openCram(s.id);return;} // krok 9: ostatni dzień planu = Cram
  if(r.kind==='review'){const items=reviewItemsFor(s,t.levels);if(!items.length){toast('Brak fiszek w tym zakresie','alert');return;}current=null;applyTheme(null);startReview(items);return;}
  if(r.kind==='weak'&&hasDeck(s.id)){startExamDeck(s.id);return;}
  openSubject(s.id,'egzamin',()=>examConfig(s,{levels:t.levels,n:r.n||20})); // mock (i weak bez talii = próbny)
}
/* wiersz planu na Dziś: „Do sprawdzianu: …” (dzień sprawdzianu = powodzenia) */
function testTodayItem(t){
  const s=testSubject(t);if(!s)return null;const today=todayStr();const N=dayDiff(today,t.date);if(N<0)return null;
  const short=s.short||s.name;
  if(N===0)return {t:{id:'test:'+t.id,done:false},s,kind:'test',reward:0,icon:'calendar',title:'Sprawdzian dziś — powodzenia',sub:short+' · plan zrobiony, teraz spokojnie',go:()=>openTestPlan(t.id)};
  const r=(t.plan||[]).find(x=>x.date===today);if(!r)return null;
  return {t:{id:'test:'+t.id,done:!!r.done},s,kind:'test',reward:0,icon:TP_ICON[r.kind],title:'Do sprawdzianu — '+tpTitle(t,r),sub:`${short} · ${inDays(N)} · ${tpSub(r)}`,go:()=>r.done?openTestPlan(t.id):testAction(t,r)};
}
/* arkusz „Mam sprawdzian” (z QuickAdd, zakładki Egzamin): przedmiot, data (natywne pole, min jutro), zakres poziomów → createTest → ekran planu */
function openTestSheet(sid){
  if(!SUBJECTS.length)return;
  let sel=sid||(SUBJECTS.find(hasProgress)||SUBJECTS[0]).id;let date=addDays(todayStr(),7);let levels=null; // null = wszystkie
  const s=openSheet('testplan',`<div class="shandle"></div>
    <div class="shead"><div class="st2">Mam sprawdzian</div><button class="backbtn sclose" id="tpclose" aria-label="Zamknij">${icon('close',{size:18,stroke:3})}</button></div>
    <div class="eyebrow sec">Przedmiot</div><div class="tpchips" id="tpsub"></div>
    <div class="eyebrow sec">Kiedy</div><label class="tpdate">${icon('calendar',{size:18,stroke:2.4})}<input type="date" id="tpdate" min="${addDays(todayStr(),1)}" value="${date}" aria-label="Data sprawdzianu"><span id="tpin"></span></label>
    <div class="eyebrow sec">Zakres</div><div class="tpchips" id="tplv"></div>
    <div class="tpsum" id="tpsum"></div>
    <button class="pill a-glow" id="tpgo" data-primary>UŁÓŻ PLAN</button>`);
  sheetBack();
  const subBox=s.querySelector('#tpsub'),lvBox=s.querySelector('#tplv'),sum=s.querySelector('#tpsum'),inp=s.querySelector('#tpdate'),inEl=s.querySelector('#tpin');
  const draw=()=>{
    const subj=SUBJECTS.find(x=>x.id===sel);const all=subj.levels.map(l=>l.id);const lv=levels||all;
    subBox.innerHTML='';SUBJECTS.forEach(x=>{const c=el('button','tpchip themed'+(x.id===sel?' on':''),mono(initial(x.short||x.name),'solid')+(x.short||x.name));c.style.setProperty('--accent',x.accent);if(x.onAccent)c.style.setProperty('--on-accent',x.onAccent);c.onclick=()=>{sel=x.id;levels=null;draw();};subBox.appendChild(c);});
    lvBox.innerHTML='';
    const allC=el('button','tpchip'+(lv.length===all.length?' on':''),'wszystkie');allC.onclick=()=>{levels=null;draw();};lvBox.appendChild(allC);
    subj.levels.forEach(l=>{const on=lv.indexOf(l.id)>=0;const c=el('button','tpchip'+(on?' on':''),noEmoji(l.title));c.setAttribute('aria-pressed',String(on));
      c.onclick=()=>{const next=on?lv.filter(x=>x!==l.id):all.filter(x=>x===l.id||lv.indexOf(x)>=0);levels=next.length?next:[l.id];if(levels.length===all.length)levels=null;draw();};lvBox.appendChild(c);});
    const N=dayDiff(todayStr(),date);const left=unfinishedLevels(subj,lv).length;const nq=exQuizFor(subj,lv).length;const ex=testFor(sel);
    inEl.textContent=inDays(N);
    sum.innerHTML=icon('bulb',{size:16})+`<span>${N} ${pl(N,'dzień','dni','dni')} · ${left?`${left} ${pl(left,'poziom','poziomy','poziomów')} do nauki`:'wszystko zaliczone, zostają powtórki'} · ${nq} ${pl(nq,'pytanie','pytania','pytań')} na próbny${ex?' · zastąpi obecny plan':''}</span>`;
  };
  inp.onchange=inp.oninput=()=>{const v=inp.value;if(v&&dayDiff(todayStr(),v)>=1)date=v;else{date=addDays(todayStr(),1);inp.value=date;}draw();};
  s.querySelector('#tpclose').onclick=closeSheet;
  s.querySelector('#tpgo').onclick=()=>{const subj=SUBJECTS.find(x=>x.id===sel);const t=createTest(sel,date,levels||subj.levels.map(l=>l.id));closeSheet();openTestPlan(t.id);toast('Plan gotowy','calendar');};
  draw();
  return s;
}
function openTestPlan(id,from){tpId=id;tpFrom=from||null;go('testplan');}
function renderTestPlan(){
  syncTests();const t=tests().find(x=>x.id===tpId)||tests()[0];const s=t&&testSubject(t);
  if(!t||!s)return go('today');
  applyTheme(s);
  const back=()=>{if(tpFrom==='subject')openSubject(s.id,'egzamin');else go('today');};
  const scroll=shell(null,{cls:'tplan',title:'Plan do sprawdzianu',pills:false,back});
  const today=todayStr(),N=dayDiff(today,t.date);const st=subjState(s.id);
  const total=t.levels.length,done=t.levels.filter(id=>(st.levels[id]||{}).done).length;const rec=examRec(s.id);
  const ready=Math.round(((total?done/total:0)*0.6+((rec.best?rec.best.pct:0)/100)*0.4)*100);
  const d=dateOf(t.date);const scope=total===s.levels.length?'cały przedmiot':t.levels.map(id=>{const l=s.levels.find(x=>x.id===id);return l?noEmoji(l.title):'';}).filter(Boolean).join(', ');
  scroll.appendChild(el('div','tphero a-up',`<div class="rvring a-pop">${ringSvg(ready,48)}<div class="rvpct"><b>${ready}%</b><span>gotowość</span></div></div>
    <div class="grow"><div class="s">${s.short||s.name} · ${scope}</div><div class="d">${DAYS[d.getDay()].toLowerCase()}, ${d.getDate()} ${MONTHS_S[d.getMonth()]}</div><div class="in a-blink">${inDays(N)}</div></div>`));
  const rows=el('div','tprows');
  const todayRow=(t.plan||[]).find(r=>r.date===today);
  (t.plan||[]).forEach((r,i)=>{
    const dd=dateOf(r.date);let state=r.date<today?(r.done?'tp-done':'tp-missed'):r.date===today?(r.done?'tp-now tp-done':'tp-now'):'tp-future';if(r.kind==='rest')state+=' tp-rest';
    const row=el('button','tprow '+state+(r.date===today?' a-pop':' a-up d'+Math.min(6,i+1)));
    row.innerHTML=`<div class="dy"><small>${DAYS_S[dd.getDay()]}</small><b>${dd.getDate()}</b></div><div class="ico">${icon(r.done?'check':TP_ICON[r.kind],{size:18,stroke:r.done?3.4:2.4})}</div>
      <div class="grow"><div class="t">${tpTitle(t,r)}</div><div class="s">${r.date<today&&!r.done?'pominięte — plan przeliczony':tpSub(r)}</div></div>${r.date===today?'<span class="badge2'+(r.done?'':' a-blink')+'">'+(r.done?'zrobione':'dziś')+'</span>':''}`;
    row.setAttribute('aria-label',`${fmtDate(r.date)}: ${tpTitle(t,r)}`);
    row.onclick=()=>{if(r.date<today)return toast(r.done?'Zrobione':'Ten dzień minął — plan przeliczony','calendar');testAction(t,r);};
    rows.appendChild(row);
  });
  const ed=dateOf(t.date);
  rows.appendChild(el('div','tprow tp-exam a-up d6',`<div class="dy"><small>${DAYS_S[ed.getDay()]}</small><b>${ed.getDate()}</b></div><div class="ico">${icon('flag',{size:18})}</div><div class="grow"><div class="t">Sprawdzian</div><div class="s">powodzenia</div></div>${N===0?'<span class="badge2">dziś</span>':''}`));
  scroll.appendChild(rows);
  scroll.appendChild(el('div','tpnote','Opuścisz dzień? Plan sam się przeliczy. Nauka i powtórki z planu liczą się też do planu dnia.'));
  const foot=el('div','tpfoot');
  if(todayRow&&!todayRow.done&&todayRow.kind!=='rest'){const b=el('button','pill a-glow','ZACZNIJ DZISIEJSZE');b.id='tpstart';b.onclick=()=>testAction(t,todayRow);foot.appendChild(b);}
  else{const b=el('button','pill ghost',N===0?'POWODZENIA':'NA DZIŚ WSZYSTKO');b.id='tpstart';b.onclick=back;foot.appendChild(b);}
  const del=el('button','pill text','Usuń plan');del.id='tpdel';del.onclick=()=>{if(!confirm('Usunąć plan do sprawdzianu?'))return;removeTest(t.id);toast('Plan usunięty','close');go('today');};
  foot.appendChild(del);scroll.appendChild(foot);
}

/* ---------- INFO (SubjectInfo.html, krok 9) ----------
   Bloki .zbox z pola info → kafle z ikoną dobraną po nagłówku (tabela .gradetbl z danych jest pomijana — zastępuje ją siatka z grading.scale
   z podświetlonym wierszem ostatniego wyniku egzaminu); do tego podsumowanie egzaminu, „Mam sprawdzian”, „Udostępnij klasie”. Info bez .zbox = surowy HTML jak dotąd. */
const INFO_ICON=[[/cheat|najwa|priorytet|klucz|motyw/i,'bolt','hot'],[/ocen|zalicz|punkt/i,'target','pink'],[/zakres|unit|materia/i,'book','cyan'],[/egzamin|test|kolokw|termin|deadline|homework|zadanie/i,'calendar','gold'],[/regulac|prawo|kontekst/i,'file','violet'],[/powt/i,'refresh','cyan'],[/gramat|słow|slow/i,'edit','gold']];
function infoBlocks(s){
  const tmp=el('div','',s.info||'');const boxes=[...tmp.querySelectorAll('.zbox')];if(!boxes.length)return null;
  return boxes.map(b=>{const h=b.querySelector('h3');const title=h?noEmoji(h.textContent):'';if(h)h.remove();const grade=!!b.querySelector('.gradetbl');
    const m=INFO_ICON.find(([re])=>re.test(title))||[null,'info',''];return {title,html:b.innerHTML.trim(),grade,icon:m[1],tone:m[2]};}).filter(x=>!x.grade&&(x.title||x.html));
}
function scaleRows(s){const sc=exScale(s).slice().sort((a,b)=>b[0]-a[0]);const rows=[];for(let i=sc.length-1;i>=0;i--){const min=sc[i][0],max=i>0?sc[i-1][0]-1:100;rows.push({min,max,lab:gradeParts(sc[i][1])[0]});}return rows;}
function renderInfo(sc){
  const s=current;const wrap=el('div','scroll info');
  const rec=examRec(s.id);const last=rec.last;const t=testFor(s.id);
  wrap.appendChild(el('div','infhead a-up',`<div class="eyebrow">Zasady zaliczenia</div><h2>${s.name}</h2>${s.tagline?`<p>${s.tagline}</p>`:''}`));
  const blocks=infoBlocks(s);
  if(blocks){blocks.forEach((b,i)=>{
    wrap.appendChild(el('div',`inftile ${b.tone} a-up d${Math.min(6,i+1)}`,`<div class="infh">${icon(b.icon,{size:18,stroke:2.6})}<span>${b.title||'Informacje'}</span></div><div class="infb">${b.html}</div>`));});}
  else wrap.appendChild(el('div','zbox a-up d1',s.info||'<p>Brak dodatkowych informacji o zaliczeniu.</p>'));
  // siatka ocen z grading.scale + podświetlony wiersz ostatniego wyniku
  const rows=scaleRows(s);const pass=exPass(s);const d=blocks?Math.min(6,blocks.length+1):2;
  const sc_=el('div',`infscale a-up d${d}`);
  sc_.innerHTML=`<div class="infh"><span>${icon('chart',{size:18,stroke:2.6})}Siatka ocen</span><b class="${last?'acid':''}">${last?'twój wynik: '+last.pct+'%':'jeszcze bez podejścia'}</b></div>
    <div class="infrows"><div class="infrow fail${last&&last.pct<pass?' on a-glow':''}"><span class="r">pod ${pass}%</span>${last&&last.pct<pass?'<span class="here">tu jesteś</span>':''}<span class="g">${gradeParts(exFailLabel(s))[0]}</span></div>
    ${rows.map(r=>{const on=last&&last.pct>=r.min&&last.pct<=r.max;return `<div class="infrow${on?' on a-glow':''}"><span class="r">${r.min}–${r.max}%</span>${on?'<span class="here">tu jesteś</span>':''}<span class="g">${r.lab}</span></div>`;}).join('')}</div>`;
  wrap.appendChild(sc_);
  const N=Math.min(20,allQuiz(s).length);
  const ex=el('button',`inflink a-up d${Math.min(6,d+1)}`,`<div class="ico">${icon('target',{size:20,stroke:2.6})}</div><div class="grow"><div class="t">Egzamin próbny</div><div class="s">${N} ${pl(N,'pytanie','pytania','pytań')} · ${examMin(s)} min · próg ${pass}%${rec.best?' · najlepiej '+rec.best.pct+'%':''}</div></div>${icon('chevron-right',{size:18,cls:'chev'})}`);
  ex.id='inf-exam';ex.onclick=()=>{curTab='egzamin';renderSubject();};wrap.appendChild(ex);
  const tb=el('button',`inflink a-up d${Math.min(6,d+2)}`,`<div class="ico red">${icon('calendar',{size:20,stroke:2.4})}</div><div class="grow"><div class="t">${t?'Sprawdzian '+inDays(dayDiff(todayStr(),t.date)):'Mam sprawdzian'}</div><div class="s">${t?'plan dzień po dniu jest gotowy':'ułożę plan dzień po dniu do daty'}</div></div>${icon('chevron-right',{size:18,cls:'chev'})}`);
  tb.id='inf-test';tb.onclick=()=>{if(t)openTestPlan(t.id,'subject');else openTestSheet(s.id);};wrap.appendChild(tb);
  const sh=el('button',`inflink a-up d6`,`<div class="ico cyan">${icon('share',{size:20,stroke:2.4})}</div><div class="grow"><div class="t">Udostępnij klasie</div><div class="s">kod dla klasy · wymaga wersji online</div></div>${icon('chevron-right',{size:18,cls:'chev'})}`);
  sh.id='inf-share';sh.onclick=()=>openComing('share');wrap.appendChild(sh);
  const foot=el('div','inffoot');const b=el('button','pill a-glow','WRÓĆ DO NAUKI');b.id='inf-back';b.onclick=()=>{curTab='path';renderSubject();};foot.appendChild(b);wrap.appendChild(foot);
  sc.innerHTML='';sc.appendChild(wrap);
}

/* ================= ĆWICZENIA (wpisywanie, klocki, pary, speed) ================= */
let cw=null, cwInt=null;
function exNorm(str){return (str||'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\b(the|a|an|to|el|la|los|las|un|una|unos|unas)\b/g,' ').replace(/\s+/g,' ').trim();}
function exClean(str){return (str||'').replace(/\([^)]*\)/g,'').replace(/…|\.\.\./g,'').replace(/\s+/g,' ').trim();}
function typePool(s){return allCards(s).map(c=>({prompt:exClean(c.d),ans:exClean(c.t),lvl:c.lvl})).filter(c=>c.prompt&&c.ans&&c.ans.length<=30&&!/\//.test(c.ans));}
function tilePool(s){return typePool(s).filter(c=>c.ans.replace(/\s/g,'').length<=18);}
function matchPool(s){return allCards(s).map(c=>({a:exClean(c.t),b:exClean(c.d)})).filter(c=>c.a&&c.b);}

function renderCwicz(sc){
  clearInterval(cwInt);cw=null;taskCleanup();closeSheet();
  const s=current;const wrap=el('div','scroll');
  const hub=el('div','exhub');
  const items = s.lang
   ? [['typing','edit','Wpisywanie','Po polsku → '+(s.short||'język')+'. Wpisz słowo z klawiatury.'],
      ['tiles','grid','Klocki — ułóż słowo','Ułóż litery lub wyrazy w poprawne słowo.'],
      ['match','link','Pary słówek','Dopasuj słowo do tłumaczenia (z fiszek).']]
   : [['match','link','Pary z fiszek','Dopasuj pojęcie do definicji.'],
      ['speed','bolt','Szybki quiz na czas','60 sekund — ile zdążysz trafić?'],
      ['typing','edit','Pojęcie z fiszek','Z definicji wpisz właściwy termin.']]; // krok 5b: dawne „Wpisz pojęcie” — nazwa zajęta przez typ zadania typeterm
  hub.appendChild(el('div','exprompt','Wybierz ćwiczenie'));
  items.forEach(([k,em,t,p])=>{
    const c=el('div','excard',`<div class="eemoji">${icon(em,{size:26,stroke:2.4})}</div><div class="emeta"><h3>${t}</h3><p>${p}</p></div>`);
    c.onclick=()=>{ if(k==='typing')cwStartTyping(sc); else if(k==='tiles')cwStartTiles(sc); else if(k==='match')cwStartMatch(sc); else cwStartSpeed(sc); };
    hub.appendChild(c);
  });
  // krok 5: zadania z pola tasks całego przedmiotu, pogrupowane po typie (bez serc i combo, +4 XP)
  const tasks=allTasks(s);
  if(tasks.length){
    hub.appendChild(el('div','exprompt','Zadania z poziomów'));
    Object.keys(TASK_META).forEach(type=>{
      const list=tasks.filter(t=>t.type===type);if(!list.length)return;
      const meta=TASK_META[type];
      const c=el('div','excard',`<div class="eemoji">${icon(meta.icon,{size:26,stroke:2.4})}</div><div class="emeta"><h3>${meta.label}</h3><p>${list.length} ${pl(list.length,'zadanie','zadania','zadań')} · ${meta.desc}</p></div>`);
      c.onclick=()=>cwStartTasks(sc,type);hub.appendChild(c);
    });
  }
  wrap.appendChild(hub);sc.innerHTML='';sc.appendChild(wrap);
}
/* --- ZADANIA Z POZIOMÓW (krok 5): ten sam taskBlock i panele co w lekcji --- */
function cwStartTasks(sc,type){
  const list=shuffle(allTasks(current).filter(t=>t.type===type));
  if(!list.length){toast('Brak zadań tego typu');return renderCwicz(sc);}
  cw={type:'tasks',ttype:type,list,idx:0,score:0};cwRenderTasks(sc);
}
function cwRenderTasks(sc){
  taskCleanup();closeSheet();
  const it=cw.list[cw.idx];
  if(!it)return cwResult(sc,(cw.score/cw.list.length>=0.8)?'gold':'ok',cw.score,cw.list.length,()=>cwStartTasks(sc,cw.ttype));
  const wrap=el('div','scroll quizview');
  wrap.appendChild(el('div','progressrow',`<div class="bar"><i style="width:${cw.idx/cw.list.length*100}%"></i></div><div class="counter">${cw.idx+1}/${cw.list.length}</div>`));
  const tb=taskBlock(it,{n:cw.idx+1,total:cw.list.length,tag:it.lvl||'',onAnswer:(ok,fb)=>{
    const next=()=>{cw.idx++;cwRenderTasks(sc);};
    if(ok){cw.score++;addXP(current.id,4);wrap.appendChild(confetti(4));sheetOk(fb,{xp:4,mult:1,combo:0,onNext:next});}
    else sheetBad(fb,{sub:fb.sub,subj:current,onNext:next});
  }});
  wrap.appendChild(tb.body);wrap.appendChild(tb.foot);
  sc.innerHTML='';sc.appendChild(wrap);
}
function cwBackBtn(sc){const b=el('button','pill ghost',LBL.back+'Ćwiczenia');b.style.marginTop='12px';b.onclick=()=>renderCwicz(sc);return b;}
function cwResult(sc,kind,score,total,retry){
  clearInterval(cwInt);
  const wrap=el('div','scroll');const pct=total?Math.round(score/total*100):0;
  wrap.innerHTML=`<div class="result">${bigTile(kind)}<h2>Wynik</h2>
    <div class="score">Dobrze: <b>${score}/${total}</b> (${pct}%)</div>
    <p>${pct>=80?'Świetnie. Znasz to bardzo dobrze.':pct>=50?'Nieźle. Jeszcze jedna runda i będzie pewnie.':'Powtórz jeszcze raz — od tego jest ćwiczenie.'}</p></div>`;
  const f=el('div');f.style.cssText='display:flex;gap:10px;padding:0 0 8px';
  const r=el('button','pill',LBL.again);r.onclick=retry;
  f.appendChild(r);f.appendChild(cwBackBtn(sc));wrap.appendChild(f);
  sc.innerHTML='';sc.appendChild(wrap);
}
/* --- TYPING --- */
function cwStartTyping(sc){const pool=shuffle(typePool(current)).slice(0,12);
  if(!pool.length){toast('Brak danych do wpisywania');return renderCwicz(sc);}
  cw={type:'typing',list:pool,idx:0,score:0};cwRenderTyping(sc);}
function cwRenderTyping(sc){
  const it=cw.list[cw.idx];
  if(!it)return cwResult(sc,(cw.score/cw.list.length>=0.8)?'gold':'ok',cw.score,cw.list.length,()=>cwStartTyping(sc));
  const wrap=el('div','scroll');
  wrap.appendChild(el('div','progressrow',`<div class="bar"><i style="width:${cw.idx/cw.list.length*100}%"></i></div><div class="counter">${cw.idx+1}/${cw.list.length}</div>`));
  const card=el('div','qcard');
  card.innerHTML=`<span class="tag">${it.lvl||''}</span><div class="exprompt">Przetłumacz albo wpisz</div><div class="exq">${it.prompt}</div>
    <input class="winput" id="win" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="wpisz odpowiedź…">
    <div class="exfb" id="wfb"></div>
    <button class="pill qnext" id="wnext" style="margin-top:14px">${LBL.check}</button>`;
  wrap.appendChild(card);sc.innerHTML='';sc.appendChild(wrap);
  const inp=document.getElementById('win'),btn=document.getElementById('wnext'),fb=document.getElementById('wfb');
  setTimeout(()=>{try{inp.focus();}catch(e){}},50);
  let checked=false;
  const check=()=>{
    if(checked){cw.idx++;cwRenderTyping(sc);return;}
    checked=true;
    const ok=inp.value.trim()!=='' && exNorm(inp.value)===exNorm(it.ans);
    inp.classList.add(ok?'ok':'bad');inp.disabled=true;
    if(ok){cw.score++;addXP(current.id,4);toast('Dobrze: +4 XP','check');fb.className='exfb ok show';fb.innerHTML=icon('check',{size:16,stroke:3.4,cls:'ic-acid'})+' Dobrze: <b>'+it.ans+'</b>';}
    else{toast('Nie tym razem','close');fb.className='exfb bad show';fb.innerHTML='Poprawnie: <b>'+it.ans+'</b>';}
    btn.innerHTML=(cw.idx+1>=cw.list.length)?LBL.result:LBL.next;
  };
  btn.onclick=check;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')check();});
}
/* --- TILES --- */
function cwStartTiles(sc){const pool=shuffle(tilePool(current)).slice(0,10);
  if(!pool.length){toast('Brak danych');return renderCwicz(sc);}
  cw={type:'tiles',list:pool,idx:0,score:0,_n:-1};cwRenderTiles(sc);}
function cwRenderTiles(sc){
  const it=cw.list[cw.idx];
  if(!it)return cwResult(sc,(cw.score/cw.list.length>=0.8)?'gold':'ok',cw.score,cw.list.length,()=>cwStartTiles(sc));
  const phrase=/\s/.test(it.ans.trim());
  const sep=phrase?' ':'';
  if(cw._n!==cw.idx){cw._n=cw.idx;const units=phrase?it.ans.trim().split(/\s+/):it.ans.replace(/\s/g,'').split('');cw.tiles=shuffle(units.map(ch=>({ch,used:false})));cw.build=[];cw.checked=false;}
  const wrap=el('div','scroll');
  wrap.appendChild(el('div','progressrow',`<div class="bar"><i style="width:${cw.idx/cw.list.length*100}%"></i></div><div class="counter">${cw.idx+1}/${cw.list.length}</div>`));
  const card=el('div','qcard');
  card.innerHTML=`<span class="tag">${it.lvl||''}</span><div class="exprompt">Ułóż: ${it.prompt}</div>
    <div class="build" id="build"></div><div class="tiles" id="bank"></div>
    <div class="exfb" id="tfb"></div>
    <button class="pill qnext" id="tnext" style="margin-top:8px">${LBL.check}</button>`;
  wrap.appendChild(card);sc.innerHTML='';sc.appendChild(wrap);
  const bankEl=document.getElementById('bank'),buildEl=document.getElementById('build'),fb=document.getElementById('tfb'),btn=document.getElementById('tnext');
  cw.build.forEach((ti,pos)=>{const b=el('button','tile',cw.tiles[ti].ch);b.onclick=()=>{if(cw.checked)return;cw.tiles[ti].used=false;cw.build.splice(pos,1);cwRenderTiles(sc);};buildEl.appendChild(b);});
  cw.tiles.forEach((tl,ti)=>{const b=el('button','tile'+(tl.used?' used':''),tl.ch);b.onclick=()=>{if(cw.checked||tl.used)return;tl.used=true;cw.build.push(ti);cwRenderTiles(sc);};bankEl.appendChild(b);});
  btn.onclick=()=>{
    if(cw.checked){cw.idx++;cwRenderTiles(sc);return;}
    const got=cw.build.map(i=>cw.tiles[i].ch).join(sep);
    const ok=exNorm(got)===exNorm(it.ans);cw.checked=true;
    if(ok){cw.score++;addXP(current.id,4);toast('Dobrze: +4 XP','check');fb.className='exfb ok show';fb.innerHTML=icon('check',{size:16,stroke:3.4,cls:'ic-acid'})+' <b>'+it.ans+'</b>';}
    else{toast('Nie tak','close');fb.className='exfb bad show';fb.innerHTML='Poprawnie: <b>'+it.ans+'</b>';}
    btn.innerHTML=(cw.idx+1>=cw.list.length)?LBL.result:LBL.next;
  };
}
/* --- MATCH --- */
function cwStartMatch(sc){const pool=shuffle(matchPool(current)).slice(0,5);
  if(pool.length<2){toast('Za mało danych');return renderCwicz(sc);}
  cw={type:'match',pairs:pool,left:shuffle(pool.map((p,i)=>({i,t:p.a}))),right:shuffle(pool.map((p,i)=>({i,t:p.b}))),selL:null,selR:null,done:0,matched:new Set()};
  cwRenderMatch(sc);}
function cwRenderMatch(sc){
  if(cw.done>=cw.pairs.length)return cwResult(sc,'ok',cw.pairs.length,cw.pairs.length,()=>cwStartMatch(sc));
  const wrap=el('div','scroll');
  wrap.appendChild(el('div','exprompt','Połącz w pary (wybierz z lewej, potem z prawej)'));
  const mw=el('div','matchwrap');const lc=el('div','mcol'),rc=el('div','mcol');
  const trunc=t=>t.length>64?t.slice(0,62)+'…':t;
  cw.left.forEach(o=>{const it=el('div','mitem'+(cw.matched.has('L'+o.i)?' done':'')+(cw.selL===o.i?' sel':''),o.t);it.onclick=()=>{if(cw.matched.has('L'+o.i))return;cw.selL=o.i;tryMatch(sc);};lc.appendChild(it);});
  cw.right.forEach(o=>{const it=el('div','mitem'+(cw.matched.has('R'+o.i)?' done':'')+(cw.selR===o.i?' sel':''),trunc(o.t));it.onclick=()=>{if(cw.matched.has('R'+o.i))return;cw.selR=o.i;tryMatch(sc);};rc.appendChild(it);});
  mw.appendChild(lc);mw.appendChild(rc);wrap.appendChild(mw);
  const f=el('div');f.style.cssText='margin-top:14px';f.appendChild(cwBackBtn(sc));wrap.appendChild(f);
  sc.innerHTML='';sc.appendChild(wrap);
}
function tryMatch(sc){
  if(cw.selL==null||cw.selR==null){cwRenderMatch(sc);return;}
  if(cw.selL===cw.selR){cw.matched.add('L'+cw.selL);cw.matched.add('R'+cw.selR);cw.done++;cw.selL=null;cw.selR=null;addXP(current.id,3);toast('Para: +3 XP','check');cwRenderMatch(sc);}
  else{toast('To nie ta para','close');cw.selL=null;cw.selR=null;cwRenderMatch(sc);}
}
/* --- SPEED --- */
function cwStartSpeed(sc){cw={type:'speed',list:shuffle(allQuiz(current)),idx:0,score:0,left:60};
  clearInterval(cwInt);cwInt=setInterval(()=>{cw.left--;const t=document.getElementById('spdt');if(t){t.lastChild.textContent=cw.left+'s';t.classList.toggle('warn',cw.left<=10);}if(cw.left<=0){clearInterval(cwInt);cwResult(sc,(cw.score>=10)?'hot':'ok',cw.score,cw.idx,()=>cwStartSpeed(sc));}},1000);
  cwRenderSpeed(sc);}
function cwRenderSpeed(sc){
  if(cw.idx>=cw.list.length){clearInterval(cwInt);return cwResult(sc,'hot',cw.score,cw.idx,()=>cwStartSpeed(sc));}
  const q=cw.list[cw.idx];const wrap=el('div','scroll');
  wrap.innerHTML=`<div class="examhead"><div class="counter">Trafione: ${cw.score}</div><div class="timer" id="spdt">${icon('clock',{size:16})}<span>${cw.left}s</span></div></div>
    <div class="qcard"><span class="tag">${q.lvl||''}</span><div class="qq">${q.q}</div>
    <div class="opts">${q.a.map((o,i)=>`<button class="opt" data-i="${i}"><span class="k">${keys[i]}</span><span>${o}</span></button>`).join('')}</div></div>`;
  sc.innerHTML='';sc.appendChild(wrap);
  let locked=false;
  wrap.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{
    if(locked)return;locked=true;const i=+o.dataset.i;
    wrap.querySelectorAll('.opt').forEach(x=>{const xi=+x.dataset.i;if(xi===q.c)x.classList.add('correct');else if(xi===i)x.classList.add('wrong');});
    if(i===q.c){cw.score++;addXP(current.id,2);}
    setTimeout(()=>{cw.idx++;cwRenderSpeed(sc);},450);
  });
}

/* ============================================================ KROK 8: GAMIFIKACJA (DESIGN.md §4.5, §6 pkt 8) — wszystko offline, ten sam klucz nauka_progress_v1
   PROGRESS.gems (int) · PROGRESS.missions={date, daily:[{id,progress,target,reward,done}], weekly:{week,id,progress,target,reward,done}}
   PROGRESS.album={"<sid>:<lid>:<idx>":{rarity:"common"|"rare"|"epic", at}} · PROGRESS.ghost={"<sid>:<lid>":[{t,correct}]} (najlepszy przebieg poziomu)
   PROGRESS.boost={until} · PROGRESS.themes=[id…], PROGRESS.theme · PROGRESS.badges={id:date} · PROGRESS.stats={missions,maxCombo,planDays,bosses}
   PROGRESS[sid].chests={"<after>":true} · PROGRESS[sid].boss={done,n,at} · META.freezes (0–2), META.frozenDays, META.comebackShown (seria zostaje w nauka_meta_v1).
   Gemy: poziom +10 (+5 za 3 gwiazdki), skrzynia +10, misja +20…30 / tygodniowa +100, plan dnia +5, boss +25. addXP = jedyny lejek XP (podwaja przy boostcie). */
const GEM={level:10,stars3:5,chest:10,plan:5,boss:25};
function gems(){if(typeof PROGRESS.gems!=='number'||!isFinite(PROGRESS.gems))PROGRESS.gems=0;return PROGRESS.gems;}
function addGems(n,why){gems();PROGRESS.gems=Math.max(0,PROGRESS.gems+n);saveProgress();updateGems();
  if(why)setTimeout(()=>toast((n>0?'+':'')+n+' '+pl(Math.abs(n),'gem','gemy','gemów')+(why===true?'':' · '+why),'gem','a-pop'),n>0?400:0);}
function updateGems(){document.querySelectorAll('[id="gemNum"]').forEach(e=>{e.textContent=fmtNum(gems());e.classList.remove('a-pop');void e.offsetWidth;e.classList.add('a-pop');});}
function gemPill(o){o=o||{};const b=el('button','streak gems'+(o.cls?' '+o.cls:''),icon('gem',{size:16,cls:'ic-cyan'})+`<span id="gemNum">${fmtNum(gems())}</span>`);b.setAttribute('aria-label','Gemy: '+gems()+'. Otwórz plecak');b.onclick=()=>go('shop');return b;}
function stats(){const s=PROGRESS.stats;if(!s||typeof s!=='object')PROGRESS.stats={missions:0,maxCombo:0,planDays:0,bosses:0};return PROGRESS.stats;}
/* podwójne XP: znacznik czasu w PROGRESS.boost.until */
function boostActive(){const b=PROGRESS.boost;return !!(b&&b.until&&b.until>Date.now());}
function boostLeft(){return boostActive()?PROGRESS.boost.until-Date.now():0;}
/* plan dnia zrobiony w całości: +5 gemów, misja „plan”, licznik do odznaki (raz dziennie) */
function planCheck(d){
  d=d||daily();if(d.planDone||!d.tasks.length||!d.tasks.every(t=>t.done))return false;
  d.planDone=true;stats().planDays++;saveProgress();addGems(GEM.plan);missionEvent('plan',1);
  setTimeout(()=>toast('Plan dnia zrobiony: +'+GEM.plan+' gemów','gem'),4800);checkBadges();return true;
}

/* ---------- PLECAK (Shop.html): zamrożenie serii, uzupełnienie serc, podwójne XP, motyw ---------- */
const THEMES=[['violet','Fiolet'],['cyan','Cyjan'],['pink','Róż'],['gold','Złoto'],['amber','Bursztyn']];
function themes(){if(!Array.isArray(PROGRESS.themes)||!PROGRESS.themes.length)PROGRESS.themes=['violet'];return PROGRESS.themes;}
function themeBlob(){const t=PROGRESS.theme||'violet';return THEMES.some(x=>x[0]===t)?'th-'+t:true;}
const FREEZE_MAX=2;
const SHOP=[
  {id:'freeze',name:'Zamrożenie serii',price:100,icon:'snow',tone:'cyan',anim:'a-sway',
    sub:()=>{const n=META.freezes|0;return n>=FREEZE_MAX?`masz ${FREEZE_MAX} z ${FREEZE_MAX} — komplet`:`masz ${n} z ${FREEZE_MAX} — ratuje serię w wolny dzień`;},
    can:()=>(META.freezes|0)<FREEZE_MAX,buy:()=>{META.freezes=(META.freezes|0)+1;saveMeta();return 'Zamrożenie w plecaku';}},
  {id:'refill',name:'Uzupełnienie serc',price:50,icon:'heart',tone:'red',anim:'a-beat',
    sub:()=>{const h=hearts();return h.n>=HEARTS_MAX?`masz komplet ${HEARTS_MAX} z ${HEARTS_MAX}`:`masz ${h.n} z ${HEARTS_MAX} — wróć do nauki od razu`;},
    can:()=>hearts().n<HEARTS_MAX,buy:()=>{gainHeart(HEARTS_MAX);return 'Życia uzupełnione';}},
  {id:'boost',name:'Podwójne XP na 15 min',price:80,icon:'bolt',tone:'gold',anim:'a-pulse',
    sub:()=>boostActive()?`aktywne jeszcze ${etaText(boostLeft())}`:'przydaje się przed sesją nauki',
    can:()=>!boostActive(),buy:()=>{PROGRESS.boost={until:Date.now()+15*60*1000};saveProgress();return 'Podwójne XP przez 15 minut';}},
  {id:'theme',name:'Motyw',price:150,icon:'palette',tone:'violet',anim:'',
    sub:()=>{const o=themes();return o.length>=THEMES.length?'wszystkie zestawy odblokowane':`${o.length} z ${THEMES.length} zestawów · kolor tła na ekranie Dziś`;},
    can:()=>themes().length<THEMES.length,buy:()=>{const o=themes();const nx=THEMES.find(t=>o.indexOf(t[0])<0);o.push(nx[0]);PROGRESS.theme=nx[0];saveProgress();return 'Nowy motyw: '+nx[1];}}
];
function renderShop(){
  const scroll=shell(null,{blob:'cyan',cls:'shop',title:'Plecak',pills:false,back:()=>go('today'),right:gemPill({cls:'a-pop'})});
  const g=gems();
  SHOP.forEach((it,i)=>{
    const can=it.can(),afford=g>=it.price;
    const row=el('div',`shoprow ${it.tone} a-up d${i+1}`);row.id='shop-'+it.id;
    row.innerHTML=`<div class="ico ${it.anim}">${icon(it.icon,{size:28,stroke:2.6})}</div><div class="grow"><div class="t">${it.name}</div><div class="s">${it.sub()}</div></div>`;
    const b=el('button','buy'+(can?(afford?'':' short'):' owned'),can?icon('gem',{size:14})+`<span>${it.price}</span>`:icon('check',{size:16,stroke:3.4}));
    b.setAttribute('aria-label',can?`Kup: ${it.name} za ${it.price} gemów`:it.name+': masz komplet');
    b.onclick=()=>{
      if(!can)return toast('Masz już komplet','check');
      if(!afford){const br=it.price-g;return toast(`Brakuje ${br} ${pl(br,'gema','gemów','gemów')}`,'gem');}
      addGems(-it.price);const msg=it.buy();row.classList.remove('a-up');row.classList.add('a-pop');toast(msg,it.icon==='heart'?'heart':it.icon,'a-pop');checkBadges();setTimeout(()=>renderShop(),700);};
    row.appendChild(b);scroll.appendChild(row);
    if(it.id==='theme'&&themes().length>1){ // posiadane zestawy: tap = aktywuj
      const chips=el('div','themechips a-up d5');const cur=PROGRESS.theme||'violet';
      THEMES.filter(t=>themes().indexOf(t[0])>=0).forEach(([id,name])=>{const c=el('button','themechip'+(id===cur?' on':''),`<i></i>${name}`);c.style.setProperty('--sw','var(--'+id+')');c.setAttribute('aria-pressed',String(id===cur));
        c.onclick=()=>{PROGRESS.theme=id;saveProgress();toast('Motyw: '+name,'palette');renderShop();};chips.appendChild(c);});
      scroll.appendChild(chips);
    }
  });
  scroll.appendChild(el('div','eyebrow sec','Skąd brać gemy'));
  const card=el('div','setcard a-up d5');
  [['check','ic-acid','Zaliczony poziom','+'+GEM.level+' (+'+GEM.stars3+' za 3 gwiazdki)'],['chest','ic-gold','Skrzynia na ścieżce','+'+GEM.chest],['star','ic-gold','Misja dzienna / tygodniowa','+20–30 / +100'],['calendar','ic-cyan','Cały plan dnia','+'+GEM.plan],['boss','ic-violet','Boss rozdziału','+'+GEM.boss]].forEach(([ic,cls,lab,v],i)=>{
    if(i)card.appendChild(el('div','setsep'));
    card.appendChild(el('div','setrow',icon(ic,{size:18,stroke:2.8,cls})+`<span class="t grow">${lab}</span><span class="v cyan">${v}</span>`));
  });
  scroll.appendChild(card);
}

/* ---------- MISJE (Missions.html): 3 dzienne z puli (deterministycznie z daty) + 1 tygodniowa ---------- */
const MISSION_POOL={
  xp:{t:n=>`Zdobądź ${n} XP`,targets:[60,100,150],reward:20,icon:'bolt',tone:'acid'},
  streakok:{t:n=>`${n} poprawnych bez pomyłki`,targets:[8,10,15],reward:30,icon:'star',tone:'pink',max:true},
  review:{t:n=>`Powtórz ${n} ${pl(n,'pojęcie','pojęcia','pojęć')}`,targets:[10,15,20],reward:25,icon:'refresh',tone:'cyan'},
  level:{t:()=>'Zalicz poziom',targets:[1],reward:25,icon:'check',tone:'acid'},
  tftime:{t:()=>'Zadanie na czas bez błędu',targets:[1],reward:30,icon:'clock',tone:'gold'},
  plan:{t:()=>'Wykonaj cały plan dnia',targets:[1],reward:30,icon:'calendar',tone:'amber'}
};
const WEEKLY_POOL={
  wlevels:{t:n=>`Zalicz ${n} ${pl(n,'poziom','poziomy','poziomów')} w tym tygodniu`,target:5,reward:100,icon:'chest',tone:'gold',ev:'level'},
  wxp:{t:n=>`Zdobądź ${n} XP w tym tygodniu`,target:300,reward:100,icon:'bolt',tone:'gold',ev:'xp'},
  wdays:{t:n=>`${n} dni nauki w tym tygodniu`,target:5,reward:100,icon:'flame',tone:'gold',ev:'day'}
};
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function weekKey(){const now=new Date();const dow=(now.getDay()+6)%7;return dstr(new Date(now.getFullYear(),now.getMonth(),now.getDate()-dow));}
function missions(){
  const t=todayStr();let m=PROGRESS.missions;let ch=false;
  if(!m||typeof m!=='object')m=PROGRESS.missions={};
  if(m.date!==t||!Array.isArray(m.daily)){
    const ids=Object.keys(MISSION_POOL).map(id=>[hashStr(t+':'+id),id]).sort((a,b)=>a[0]-b[0]).slice(0,3);
    m.daily=ids.map(([h,id])=>{const P=MISSION_POOL[id];const target=id==='xp'?Math.max(10,Math.round(goalXP()*[0.6,1,1.5][h%3]/10)*10):P.targets[h%P.targets.length];return {id,progress:0,target,reward:P.reward,done:false};}); // krok 9: misja XP liczona z celu dziennego
    m.date=t;ch=true;
  }
  const wk=weekKey();
  if(!m.weekly||m.weekly.week!==wk||!WEEKLY_POOL[m.weekly.id]){const ids=Object.keys(WEEKLY_POOL);const id=ids[hashStr('w'+wk)%ids.length];const P=WEEKLY_POOL[id];m.weekly={week:wk,id,progress:0,target:P.target,reward:P.reward,done:false};ch=true;}
  if(ch)saveProgress();
  return m;
}
/* zdarzenie postępu: xp (n), streakok (combo, max), review (1), level (1), tftime (1), plan (1), day (1 — z touchStreak) */
function missionEvent(kind,n){
  const m=missions();let ch=false;const ready=[];
  const bump=(x,P)=>{if(x.done||x.progress>=x.target)return;x.progress=P.max?Math.max(x.progress,n):Math.min(x.target,x.progress+n);ch=true;if(x.progress>=x.target)ready.push(x);};
  m.daily.forEach(x=>{if(x.id===kind&&MISSION_POOL[x.id])bump(x,MISSION_POOL[x.id]);});
  const W=WEEKLY_POOL[m.weekly.id];if(W&&W.ev===kind)bump(m.weekly,W);
  if(ch)saveProgress();
  if(ready.length)setTimeout(()=>toast('Misja gotowa — odbierz nagrodę','star','a-pop'),2400);
  const tile=document.getElementById('missionTile');if(tile)tile.textContent=missionLabel();
}
function missionLabel(){const m=missions();return `Misje ${m.daily.filter(x=>x.progress>=x.target).length}/${m.daily.length}`;}
function claimMission(x,row){
  if(x.done||x.progress<x.target)return;
  x.done=true;stats().missions++;histAdd('missions',1);addGems(x.reward,'misja'); // krok 9: dziennik dnia
  if(row){row.classList.remove('a-up');row.classList.add('a-pop');}
  checkBadges();setTimeout(()=>{if(view==='missions')renderMissions();},700);
}
function missionRow(x,P,d,weekly){
  const ready=x.progress>=x.target&&!x.done;const pct=Math.round(Math.min(1,x.progress/x.target)*100);
  const row=el('div',`msrow ${P.tone||'gold'}${weekly?' weekly':''}${x.done?' done':ready?' ready':''} a-up d${d}`);
  row.innerHTML=`<div class="mstop"><div class="ico${x.done?' a-pop':weekly?' a-sway':''}">${icon(x.done?'check':P.icon,{size:weekly?28:24,stroke:x.done?3.4:2.6})}</div>
      <div class="grow"><div class="t">${P.t(x.target)}</div><div class="s">${x.done?'zrobione':x.target>1?`${x.progress} z ${x.target}`:(ready?'gotowe — odbierz nagrodę':'jeszcze nie')}${weekly&&!x.done?' · duża nagroda':''}</div></div>
      ${ready?'<button class="claim a-pop">Odbierz</button>':`<span class="rw">${icon('gem',{size:15})}${x.reward}</span>`}</div>
    ${x.done?'':`<div class="bar"><i class="a-grow d${d}" style="width:${pct}%"></i></div>`}`;
  const c=row.querySelector('.claim');if(c){c.setAttribute('aria-label','Odbierz nagrodę: '+x.reward+' gemów');c.onclick=()=>claimMission(x,row);}
  return row;
}
function renderMissions(){
  const scroll=shell(null,{blob:'gold',cls:'missions',title:'Misje',pills:false,back:()=>go('today'),right:gemPill()});
  const m=missions();
  const now=new Date();const left=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1)-now;
  scroll.appendChild(el('div','sechdr msh a-up',`<span class="eyebrow sec">Dzienne</span><span class="msleft">${icon('clock',{size:14,stroke:2.6})}<b class="a-blink">zostało ${etaText(left)}</b></span>`));
  const list=el('div','msrows');m.daily.forEach((x,i)=>list.appendChild(missionRow(x,MISSION_POOL[x.id],i+1,false)));scroll.appendChild(list);
  scroll.appendChild(el('div','eyebrow sec','Tygodniowa'));
  scroll.appendChild(missionRow(m.weekly,WEEKLY_POOL[m.weekly.id],4,true));
  scroll.appendChild(el('div','msnote a-up d5',icon('info',{size:20,stroke:2.4})+'<span>Misje odświeżają się o północy, niedokończone przepadają. Tygodniowa trwa do niedzieli.</span>'));
  const foot=el('div','msfoot');const b=el('button','pill a-glow','DOKOŃCZ MISJE');b.onclick=()=>go('today');foot.appendChild(b);scroll.appendChild(foot);
}

/* ---------- SERIA: zamrożenia (META.freezes) i powrót (ComeBack.html) ---------- */
/* na starcie: opuszczone dni pokryte zamrożeniami → seria zostaje (lastDay = wczoraj), dni dopisane do META.frozenDays */
function applyFreeze(){
  if(!META.lastDay)return false;const t=todayStr();const d=dayDiff(META.lastDay,t);
  if(d<=1)return false;const missed=d-1,fz=META.freezes|0;
  if(fz<missed||!(META.streak|0))return false;
  META.freezes=fz-missed;const days=[];for(let i=1;i<=missed;i++)days.push(addDays(META.lastDay,i));
  META.frozenDays=(META.frozenDays||[]).concat(days).slice(-14);META.lastDay=addDays(t,-1);saveMeta();
  setTimeout(()=>toast(missed===1?'Zamrożenie uratowało serię':`Zamrożenia uratowały serię (${missed})`,'snow','a-pop'),900);
  return true;
}
const DAY_IN=['w niedzielę','w poniedziałek','we wtorek','w środę','w czwartek','w piątek','w sobotę'],DAY_OF=['niedzieli','poniedziałku','wtorku','środy','czwartku','piątku','soboty'];
function frozenText(){const fd=(META.frozenDays||[]);if(!fd.length)return '';const last=fd[fd.length-1];const k=dayDiff(last,todayStr());if(k>7||k<0)return '';return `jedno poszło ${k===0?'dziś':k===1?'wczoraj':DAY_IN[dateOf(last).getDay()]}`;}
function freezeCard(){
  const n=META.freezes|0;const ft=frozenText();
  const c=el('button','freezecard a-up d3',`<div class="ico">${icon('snow',{size:24,stroke:2.6})}</div><div class="grow"><div class="t">Zamrożenie serii</div><div class="s">${n?`Masz ${n} z ${FREEZE_MAX}`:'Nie masz żadnego'}${ft?' — '+ft:n?' — ratuje serię w wolny dzień':' — 100 gemów w plecaku'}</div></div>${icon('chevron-right',{size:20,cls:'chev'})}`);
  c.setAttribute('aria-label','Zamrożenia serii: '+n+'. Otwórz plecak');c.onclick=()=>go('shop');return c;
}
function needComeBack(){if(!META.lastDay)return false;return dayDiff(META.lastDay,todayStr())>=3&&META.comebackShown!==todayStr();}
function renderComeBack(){
  META.comebackShown=todayStr();saveMeta();
  app.innerHTML='';const sc=el('div','screen active');sc.appendChild(el('div','blob a-float mid'));
  const scroll=el('div','scroll comeback');
  const d=dayDiff(META.lastDay,todayStr());const old=META.streak|0;
  const due=srsDue();const bySub=SUBJECTS.map(s=>({s,n:due.filter(x=>x.s.id===s.id).length})).filter(x=>x.n).sort((a,b)=>b.n-a.n).slice(0,3);
  const first=daily().tasks.map(taskInfo).filter(Boolean).find(x=>!x.t.done);
  scroll.innerHTML=`<div class="cbart"><div class="cbico a-sway">${icon('clock',{size:50,stroke:2})}</div></div>
    <div class="cbtxt a-up d1"><h1>Nie było cię ${d} ${pl(d,'dzień','dni','dni')}</h1><p>Bez dramatu — wracamy od małego kroku. Pięć minut dziś znaczy więcej niż godzina kiedyś.</p></div>`;
  if(old>0)scroll.appendChild(el('div','cbstreak a-up d2',icon('flame',{size:42})+`<div class="grow"><div class="t">Seria zaczyna się od nowa</div><div class="nums"><span class="old">${old}</span>${icon('chevron-right',{size:16,stroke:2.8})}<span class="new a-pop d3">0</span></div></div>`));
  const box=el('div','cbdue a-up d3');
  if(bySub.length){const max=bySub[0].n;box.innerHTML=`<div class="hd"><span class="eyebrow sec">Czeka na powtórkę</span><b>${due.length} ${pl(due.length,'pojęcie','pojęcia','pojęć')}</b></div>`+bySub.map((x,i)=>`<div class="row r${i+1}"><span class="lb">${x.s.short||x.s.name}</span><div class="bar"><i class="a-grow d${i+2}" style="width:${Math.round(x.n/max*100)}%"></i></div><span class="n">${x.n}</span></div>`).join('');}
  else box.innerHTML=`<div class="hd"><span class="eyebrow sec">Nic nie przepadło</span></div><p class="sp">Pojęcia wrócą do powtórki we właściwym dniu. Zacznij od planu na dziś.</p>`;
  scroll.appendChild(box);
  const warm=el('div','cbwarm a-up d4',`<div class="ico a-pulse">${icon('bolt',{size:24})}</div><div class="grow"><div class="t">Zacznij od 5 minut</div><div class="s">${due.length?`${Math.min(15,due.length)} ${pl(Math.min(15,due.length),'pojęcie','pojęcia','pojęć')} z powtórki — bez nowych rzeczy`:first?first.title:'jedno zadanie z planu dnia'}</div></div>`);
  scroll.appendChild(warm);
  const foot=el('div','cbfoot');
  const b=el('button','pill a-glow','ZACZNIJ OD 5 MINUT');b.id='cbstart';b.onclick=()=>{if(due.length){startReview(due.slice(0,15));}else if(first)first.go();else go('today');};
  const alt=el('button','pill text','NORMALNY PLAN DNIA');alt.id='cbplan';alt.onclick=()=>go('today');
  foot.appendChild(b);foot.appendChild(alt);scroll.appendChild(foot);
  sc.appendChild(scroll);app.appendChild(sc);app.appendChild(el('div','toast',''));app.lastChild.id='toast';
}

/* ---------- ALBUM POJĘĆ (Album.html): fiszka z pudełkiem SRS ≥ 3 trafia do kolekcji ---------- */
function album(){if(!PROGRESS.album||typeof PROGRESS.album!=='object')PROGRESS.album={};return PROGRESS.album;}
/* rzadkość: epic = poziom zaliczony na 3 gwiazdki, rare = zebrana bez ani jednej pomyłki, common = reszta */
function albumCheck(sid,lid,item,e){
  if((e.box|0)<3||String(item)[0]==='q')return;const A=album();const k=sid+':'+lid+':'+item;if(A[k])return;
  const lv=(subjState(sid).levels||{})[lid]||{};
  const rarity=lv.done&&(lv.stars|0)>=3?'epic':(e.lapses|0)===0?'rare':'common';
  A[k]={rarity,at:todayStr()};histAdd('cards',1); // krok 9: dziennik dnia
  const r=srsResolve(k);setTimeout(()=>toast('Do albumu: '+(r?r.c.t:'nowe pojęcie'),'cards','a-pop'),1000);
  checkBadges();
}
function albumCount(sid){const A=album();let n=0,m=0;SUBJECTS.forEach(s=>{if(sid&&s.id!==sid)return;const cards=allCards(s);m+=cards.length;cards.forEach(c=>{if(A[s.id+':'+c.lid+':'+c.i])n++;});});return {n,m};}
let albumFilter='all';
function renderAlbum(){
  const scroll=shell(null,{cls:'album',title:'Album pojęć',pills:false,back:()=>go('profile')});
  const A=album();const tot=albumCount();const t=todayStr();
  if(albumFilter!=='all'&&!SUBJECTS.some(s=>s.id===albumFilter))albumFilter='all';
  scroll.appendChild(el('div','albhead a-up',`<div class="sechdr msh"><span class="eyebrow">${tot.n} z ${tot.m} zebrane</span><span class="albpct">${tot.m?Math.round(tot.n/tot.m*100):0}%</span></div><div class="bar"><i class="a-grow" style="width:${tot.m?tot.n/tot.m*100:0}%"></i></div>`));
  const chips=el('div','albchips a-up d1');
  const mk=(id,name,s)=>{const c=el('button','albchip'+(albumFilter===id?' on':'')+(s?' themed':''),name);if(s){c.style.setProperty('--accent',s.accent);if(s.onAccent)c.style.setProperty('--on-accent',s.onAccent);}c.setAttribute('aria-pressed',String(albumFilter===id));c.onclick=()=>{albumFilter=id;renderAlbum();};return c;};
  chips.appendChild(mk('all','Wszystkie'));
  SUBJECTS.forEach(s=>{const c=albumCount(s.id);chips.appendChild(mk(s.id,(s.short||s.name)+(c.n?' · '+c.n:''),s));});
  scroll.appendChild(chips);
  const subs=albumFilter==='all'?SUBJECTS:SUBJECTS.filter(s=>s.id===albumFilter);
  const got=[],lock=[];
  subs.forEach(s=>allCards(s).forEach(c=>{const k=s.id+':'+c.lid+':'+c.i;const e=A[k];if(e)got.push({s,c,e,k});else lock.push({s,c,k});}));
  got.sort((a,b)=>a.e.at<b.e.at?1:a.e.at>b.e.at?-1:0);
  const grid=el('div','albgrid');
  got.forEach((x,i)=>{
    const tile=el('button',`alb ${x.e.rarity} themed${i<9?' a-up d'+Math.min(6,Math.floor(i/3)+1):''}`);
    tile.style.setProperty('--accent',x.s.accent);
    tile.innerHTML=`${x.e.at===t?'<span class="new a-pop d3">NOWA</span>':''}<span class="sw"></span><span class="t">${x.c.t}</span><span class="d">${x.c.d}</span>`;
    tile.setAttribute('aria-label',x.c.t+' — '+(x.e.rarity==='epic'?'mistrzowska':x.e.rarity==='rare'?'trudna':'zwykła')+', dotknij, żeby zobaczyć definicję');
    tile.onclick=()=>tile.classList.toggle('flip');grid.appendChild(tile);
  });
  lock.forEach((x,i)=>{const tile=el('div','alb lock'+(got.length+i<9?' a-up d'+Math.min(6,Math.floor((got.length+i)/3)+1):''),icon('lock',{size:20,stroke:2.4}));tile.setAttribute('aria-label','Nieodkryte pojęcie');grid.appendChild(tile);});
  if(!got.length&&!lock.length)grid.appendChild(el('div','sp','Brak fiszek w tym przedmiocie.'));
  scroll.appendChild(grid);
  scroll.appendChild(el('div','alblegend a-up d5','<span><i></i>zwykłe</span><span><i class="rare"></i>trudne</span><span><i class="epic"></i>mistrzowskie</span>'));
  if(!got.length)scroll.appendChild(el('p','sp albnote','Pojęcie trafia do albumu, gdy trzy razy z rzędu odpowiesz dobrze w powtórce (pudełko 3). Bez pomyłek = trudne, z poziomu na 3 gwiazdki = mistrzowskie.'));
}

/* ---------- BOSS ROZDZIAŁU (Boss.html): węzeł na końcu ścieżki, pytania + zadania na czas, pasek życia bossa ---------- */
let bossState=null,bossInt=null;
const BOSS_HP=10,BOSS_SEC=20;
function bossRec(sid){const st=subjState(sid);if(!st.boss||typeof st.boss!=='object')st.boss={};return st.boss;}
function bossName(s){return s.boss||('Strażnik: '+(s.short||s.name));}
/* potwór jako inline SVG w kolorze przedmiotu (klasy b1…b6 → tokeny w styles.css) */
function bossSvg(size,cls){return `<svg class="boss${cls?' '+cls:''}" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true"><polygon class="b1" points="60,6 108,33 108,87 60,114 12,87 12,33"/><polygon class="b2" points="60,22 94,41 94,79 60,98 26,79 26,41"/><path class="b3" d="M34 44l18 8M86 44l-18 8"/><circle class="b4" cx="45" cy="60" r="10"/><circle class="b4" cx="75" cy="60" r="10"/><circle class="b6" cx="47" cy="62" r="5"/><circle class="b6" cx="73" cy="62" r="5"/><path class="b5" d="M46 84q14-10 28 0"/></svg>`;}
function startBoss(){
  const s=current;if(!s)return;
  if(hearts().n<=0){showNoHearts({inLesson:false});return;}
  const pool=shuffle(allQuiz(s).map(q=>({kind:'quiz',q})).concat(allTasks(s).map(task=>({kind:'task',task}))));
  const hp=Math.min(BOSS_HP,pool.length);if(!hp){toast('Brak pytań do walki','alert');return;}
  bossState={hp,max:hp,items:pool,idx:0,hits:0,miss:0,n:0,t0:Date.now(),done:false};
  const L=document.getElementById('lesson');L.className='lesson open bossrun';renderBoss();
}
function renderBoss(){
  const L=document.getElementById('lesson');const s=current;const bs=bossState;if(!L||!bs)return;
  closeSheet();taskCleanup();clearInterval(bossInt);keyFn=null;
  if(bs.hp<=0)return finishBoss(true);
  if(hearts().n<=0)return finishBoss(false);
  if(bs.idx>=bs.items.length){bs.items=shuffle(bs.items);bs.idx=0;}
  const it=bs.items[bs.idx];bs.n++;
  L.innerHTML='';
  const head=el('div','lessonhead bosshead');
  const x=el('button','x',icon('close',{size:18,stroke:3}));x.setAttribute('aria-label','Uciekaj z walki');x.onclick=()=>{bossState=null;closeLesson();toast('Boss czeka na ścieżce','boss');};head.appendChild(x);
  head.appendChild(el('div','bosslbl','Boss rozdziału'));head.appendChild(heartsPill({iconBeat:true}));L.appendChild(head);
  const hero=el('div','bosshero');
  hero.innerHTML=`<div class="bossav" id="bossav">${bossSvg(112)}</div><div class="bossname">${bossName(s)}</div>
    <div class="bosshp"><div class="bar"><i id="bosshp" style="width:${bs.hp/bs.max*100}%"></i></div><span id="bosshpn">${bs.hp} / ${bs.max}</span></div>`;
  L.appendChild(hero);
  const body=el('div','lessonbody');L.appendChild(body);body.appendChild(el('div','blob a-float'));
  const timed=it.kind==='quiz';
  const qrow=el('div','bossq',`<span class="eyebrow">Cios ${bs.n}</span>${timed?`<span class="bosstime" id="bosstime">${icon('clock',{size:14,stroke:2.8})}<b>${fmt(BOSS_SEC)}</b></span>`:''}`);
  let answered=false;
  const onAnswer=(ok,fb)=>{
    if(answered||!bossState)return;answered=true;clearInterval(bossInt);taskCleanup();keyFn=null;
    if(ok){bs.hp--;bs.hits++;const av=L.querySelector('#bossav');if(av){av.classList.add('a-shake');av.appendChild(el('span','bosshit a-pop','−1'));}
      const bar=L.querySelector('#bosshp'),n=L.querySelector('#bosshpn');if(bar)bar.style.width=(bs.hp/bs.max*100)+'%';if(n)n.textContent=bs.hp+' / '+bs.max;
      addXP(s.id,QUIZ_XP);body.appendChild(confetti(3));}
    else{bs.miss++;loseHeart();const hp=L.querySelector('.hearts');if(hp){hp.classList.add('a-beat');hp.appendChild(el('span','minus a-blink','−1'));}
      if(fb&&fb.e)body.appendChild(el('div','bossexp a-up',`<b>Zapamiętaj:</b> ${fb.sub?fb.sub+'. ':''}${fb.e}`));}
    setTimeout(()=>{if(!bossState)return;bs.idx++;renderBoss();},ok?900:(fb&&fb.e?2300:1100));
  };
  const o={n:bs.n,total:bs.max,combo:0,broken:false,tag:it.kind==='quiz'?(it.q.lvl||''):(it.task.lvl||'')};
  const blk=it.kind==='task'?taskBlock(it.task,{...o,onAnswer}):quizBlock(it.q,{...o,onAnswer:(i,ok)=>onAnswer(ok,it.q)});
  blk.body.insertBefore(qrow,blk.body.firstChild);
  body.appendChild(blk.body);
  const foot=el('div','lessonfoot');foot.appendChild(blk.foot);foot.appendChild(el('div','bossnote',`Dobra odpowiedź = cios. Zła = tracisz serce. Boss ma ${bs.max} ${pl(bs.max,'życie','życia','żyć')}.`));L.appendChild(foot);
  if(timed){let left=BOSS_SEC;bossInt=setInterval(()=>{if(!bossState||answered)return clearInterval(bossInt);left--;const t=L.querySelector('#bosstime');if(t){t.querySelector('b').textContent=fmt(Math.max(0,left));t.classList.toggle('warn',left<=5);t.classList.toggle('a-blink',left<=5);}
    if(left<=0){clearInterval(bossInt);blk.body.querySelectorAll('.qopt').forEach(b=>{b.disabled=true;if(+b.dataset.i===it.q.c)b.classList.add('correct','a-glow');else b.classList.add('dim');});blk.foot.classList.add('hide');onAnswer(false,{e:it.q.e,sub:'Czas minął. Poprawna: odpowiedź '+keys[it.q.c]});}},1000);}
}
function finishBoss(win){
  clearInterval(bossInt);closeSheet();keyFn=null;taskCleanup();
  const s=current;const bs=bossState;if(!s||!bs)return;bs.done=true;bossState=null;
  const rec=bossRec(s.id);const first=win&&!rec.done;const used=Math.round((Date.now()-bs.t0)/1000);
  let xp=0;
  if(win){rec.done=true;rec.n=(rec.n|0)+1;rec.at=todayStr();if(first){stats().bosses++;xp=50;addXP(s.id,50);addGems(GEM.boss);}else{xp=15;addXP(s.id,15);}if(!rec.best||used<rec.best)rec.best=used;saveProgress();checkBadges();}
  const L=document.getElementById('lesson');L.className='lesson open bossres';L.innerHTML='';
  const body=el('div','lessonbody done');body.appendChild(el('div','blob a-float '+(win?'acid':'red')));if(win)body.appendChild(confetti(8));
  const lc=el('div','lc');
  lc.innerHTML=`<div class="lcbig boss a-pop${win?'':' lost'}">${bossSvg(96,win?'':'a-shake')}${win?'<span class="won">'+icon('check',{size:22,stroke:4})+'</span>':''}</div>
    <div class="lctxt"><div class="lct a-up d2">${win?'Boss pokonany':'Boss wygrał tym razem'}</div><div class="lcs">${bossName(s)} · ${s.short||s.name}</div></div>
    <div class="lcstats"><div class="lcstat a-up d3"><div class="k">Ciosy</div><div class="v acid">${bs.hits}</div></div><div class="lcstat a-up d4"><div class="k">Pudła</div><div class="v ${bs.miss?'pink':'acid'}">${bs.miss}</div></div><div class="lcstat a-up d5"><div class="k">Czas</div><div class="v gold">${fmt(used)}</div></div></div>
    ${win?`<div class="lcrewards a-up d5">${xp?`<span class="lcreward gold">${icon('bolt',{size:15})}+${xp} XP</span>`:''}${first?`<span class="lcreward cyan">${icon('gem',{size:15})}+${GEM.boss} gemów</span><span class="lcreward violet">${icon('boss',{size:16})}odznaka</span>`:'<span class="lcreward">powtórka walki · bez gemów</span>'}</div>`
        :`<p class="lcp">${hearts().n<=0?'Skończyły się życia. Odzyskaj je (powtórka fiszek albo plecak) i spróbuj ponownie.':'Boss został z '+bs.hp+' życia. Przejrzyj fiszki z tego przedmiotu i wróć.'}</p>`}`;
  body.appendChild(lc);L.appendChild(body);
  const foot=el('div','lessonfoot col');
  const main=el('button','pill a-glow',win?'WRACAM NA ŚCIEŻKĘ':'SPRÓBUJ PONOWNIE');main.id='bossmain';
  main.onclick=win?closeLesson:()=>{if(hearts().n<=0)showNoHearts({inLesson:false});else startBoss();};
  const alt=el('button','pill text',win?'JESZCZE RAZ':'WRÓĆ NA ŚCIEŻKĘ');alt.id='bossalt';alt.onclick=win?startBoss:closeLesson;
  foot.appendChild(main);foot.appendChild(alt);L.appendChild(foot);
  keyFn=e=>{if(e.key==='Enter')main.click();};
  if(win)setTimeout(()=>toast(first?'Boss pokonany: +'+GEM.boss+' gemów':'Boss pokonany ponownie','boss','a-pop'),300);
}

/* ---------- DUCH (Ghost.html): najlepszy przebieg poziomu w PROGRESS.ghost; przy powtórce wyścig z własnym czasem ---------- */
let ghostInt=null;
function ghosts(){if(!PROGRESS.ghost||typeof PROGRESS.ghost!=='object')PROGRESS.ghost={};return PROGRESS.ghost;}
function ghostKey(lv){return current.id+':'+lv.id;}
function runScore(run){return run.filter(x=>x.correct).length;}
function runTime(run){return run.length?run[run.length-1].t:0;}
function ghostBetter(run,old){const a=runScore(run),b=runScore(old);return a>b||(a===b&&runTime(run)<runTime(old));}
function ghostIdx(ghost,elapsed){let k=0;while(k<ghost.length&&ghost[k].t<=elapsed)k++;return k;}
function ghostCard(ls){
  const N=ls.items.length;const g=ls.ghost;
  const card=el('div','ghostcard a-up');
  card.innerHTML=`<div class="ghrow"><div class="av">Ty</div><div class="grow"><div class="lab"><b>Ty</b><span id="ghyou">${ls.qIdx} / ${N}</span></div><div class="bar"><i id="ghyoubar" style="width:${ls.qIdx/N*100}%"></i></div></div></div>
    <div class="ghrow ghost"><div class="av">${icon('ghost',{size:20})}</div><div class="grow"><div class="lab"><b>Ty z ${ghostWhen(ls)}</b><span id="ghg">0 / ${N}</span></div><div class="bar"><i id="ghgbar" style="width:0%"></i></div></div></div>
    <div class="ghnote" id="ghnote">${icon('ghost',{size:16})}<span>Duch rusza razem z tobą — ${runScore(g)} z ${N} w ${fmt(Math.round(runTime(g)/1000))}.</span></div>`;
  return card;
}
function ghostWhen(ls){const at=ls.ghostAt;if(!at)return 'ostatnio';const k=dayDiff(at,todayStr());if(k===0)return 'dzisiaj';if(k===1)return 'wczoraj';if(k>6)return fmtDate(at);return DAY_OF[dateOf(at).getDay()];}
function ghostTick(){
  const ls=lessonState;if(!ls||!ls.ghost||ls.phase!=='quiz'){clearInterval(ghostInt);return;}
  const N=ls.items.length;const el_=id=>document.getElementById(id);
  const elapsed=Date.now()-ls.t0;const gi=Math.min(N,ghostIdx(ls.ghost,elapsed));const you=ls.qIdx;
  const gb=el_('ghgbar'),gn=el_('ghg');if(gb)gb.style.width=(gi/N*100)+'%';if(gn)gn.textContent=gi+' / '+N;
  const note=el_('ghnote');if(!note)return;
  let txt,lead=you>gi;
  if(you>gi){const dt=ls.ghost[you-1]&&ls.run[you-1]?Math.round((ls.ghost[you-1].t-ls.run[you-1].t)/100)/10:0;txt=`Prowadzisz${dt>0?' o '+String(dt).replace('.',',')+' s':''}${ls.ghost[you]&&!ls.ghost[you].correct?' — duch pomylił się tu na pytaniu '+(you+1)+'.':'.'}`;}
  else if(you<gi){const gt=ls.ghost[you]?ls.ghost[you].t:0;txt=`Duch prowadzi — odpowiedział na to pytanie w ${fmt(Math.round(gt/1000))}.`;}
  else txt='Łeb w łeb. Odpowiedz, zanim duch ruszy dalej.';
  note.className='ghnote'+(lead?' lead':'');note.innerHTML=icon(lead?'bolt':'ghost',{size:16})+'<span>'+txt+'</span>';
}
/* wynik: zapis najlepszego przebiegu (tylko zaliczone), porównanie z duchem; +10 XP za pokonanie ducha */
function ghostFinish(ls,passed){
  const s=current;const lv=ls.lv;const run=ls.run||[];if(!run.length||!ls.items.length)return null;
  const G=ghosts();const k=ghostKey(lv);const old=G[k];
  if(!old){if(!passed)return null;G[k]={run,at:todayStr()};saveProgress();return {kind:'saved',t:'Przebieg zapisany jako duch',s:'Następnym razem ścigasz się z sobą — z '+ls.score+' z '+ls.items.length+' w '+fmt(Math.round(runTime(run)/1000))+'.'};}
  const oldRun=Array.isArray(old)?old:old.run;
  if(ghostBetter(run,oldRun)){G[k]={run,at:todayStr()};saveProgress();addXP(s.id,10);return {kind:'win',xp:10,t:'Pokonany duch: +10 XP',s:`${ls.score} z ${ls.items.length} w ${fmt(Math.round(runTime(run)/1000))} — poprzednio ${runScore(oldRun)} w ${fmt(Math.round(runTime(oldRun)/1000))}. Ten przebieg jest nowym duchem.`};}
  const dt=Math.round((runTime(run)-runTime(oldRun))/1000);
  return {kind:'lose',t:'Duch był lepszy tym razem',s:runScore(oldRun)>ls.score?`Duch miał ${runScore(oldRun)} z ${ls.items.length}, ty ${ls.score}.`:`Duch był szybszy o ${Math.max(1,dt)} s. Spróbuj jeszcze raz.`};
}

/* ---------- ODZNAKI (Profile.html): sprawdzane po każdym istotnym zdarzeniu, toast .a-pop przy odblokowaniu ---------- */
const BADGES=[
  {id:'first',name:'Pierwszy poziom',icon:'check',tone:'acid',test:()=>SUBJECTS.some(s=>Object.values((PROGRESS[s.id]||{}).levels||{}).some(l=>l&&l.done))},
  {id:'streak7',name:'7 dni serii',icon:'flame',tone:'amber',test:()=>Math.max(META.best|0,streakDisplay())>=7},
  {id:'streak30',name:'30 dni serii',icon:'flame',tone:'amber',test:()=>Math.max(META.best|0,streakDisplay())>=30},
  {id:'album100',name:'100 pojęć w albumie',icon:'cards',tone:'cyan',test:()=>albumCount().n>=100},
  {id:'exam90',name:'Egzamin 90%',icon:'trophy',tone:'gold',test:()=>SUBJECTS.some(s=>{const e=(PROGRESS[s.id]||{}).exam;return !!(e&&e.best&&e.best.pct>=90);})},
  {id:'boss',name:'Boss pokonany',icon:'boss',tone:'violet',test:()=>SUBJECTS.some(s=>!!(((PROGRESS[s.id]||{}).boss||{}).done))},
  {id:'missions10',name:'10 misji',icon:'star',tone:'gold',test:()=>stats().missions>=10},
  {id:'combo3',name:'Combo ×3',icon:'bolt',tone:'pink',test:()=>stats().maxCombo>=10},
  {id:'plan5',name:'Plan dnia 5 razy',icon:'calendar',tone:'cyan',test:()=>stats().planDays>=5},
  {id:'subject',name:'Cały przedmiot',icon:'map',tone:'acid',test:()=>SUBJECTS.some(s=>{const st=PROGRESS[s.id];return !!st&&s.levels.length>0&&s.levels.every(l=>!!((st.levels||{})[l.id]||{}).done);})}
];
function badges(){if(!PROGRESS.badges||typeof PROGRESS.badges!=='object')PROGRESS.badges={};return PROGRESS.badges;}
function checkBadges(){
  const B=badges();const fresh=[];
  BADGES.forEach(b=>{if(B[b.id])return;let on=false;try{on=!!b.test();}catch(e){}if(on){B[b.id]=todayStr();fresh.push(b);}});
  if(!fresh.length)return;
  saveProgress();fresh.forEach((b,i)=>setTimeout(()=>toast('Odznaka: '+b.name,b.icon,'a-pop'),2800+i*1700));
  const g=document.getElementById('badgegrid');if(g)g.replaceWith(badgeGrid());
}
function badgeGrid(){
  const B=badges();const g=el('div','badgegrid a-up d3');g.id='badgegrid';
  BADGES.forEach((b,i)=>{const on=!!B[b.id];const t=el('div','badge '+(on?b.tone:'lock'),icon(on?b.icon:'lock',{size:26,stroke:2.4,fill:on&&['flame','star','bolt','boss'].indexOf(b.icon)>=0})+'<span>'+b.name+'</span>');t.setAttribute('aria-label',b.name+(on?': zdobyta '+fmtDate(B[b.id]):': zablokowana'));g.appendChild(t);});
  return g;
}

/* ============================================================ KROK 9: PIERWSZE URUCHOMIENIE (LevelPick.html → Onboarding.html)
   META.level ("podstawowka"|"liceum"|"studia"|"inne") i META.goal ("sprawdziany"|"matura-p"|"matura-r"|"olimpiada"|"sesja"|"wlasny") w nauka_meta_v1;
   cel dzienny w PROGRESS.goal (+ PROGRESS.daily.goal). Oba ekrany wracają z Ustawień (obFrom='settings') i z paska celu na Dziś. */
const LEVELS=[['podstawowka','Szkoła podstawowa','klasy 4–8','edit','amber'],['liceum','Liceum lub technikum','klasy 1–5','book','acid'],['studia','Studia','licencjat, magisterka','cap','pink'],['inne','Coś innego','języki, kursy, certyfikaty','globe','cyan']];
const GOALS=[['sprawdziany','Kartkówki i sprawdziany',['podstawowka','liceum','inne']],['matura-p','Matura podstawowa',['liceum']],['matura-r','Matura rozszerzona',['liceum']],['olimpiada','Olimpiada',['podstawowka','liceum']],['sesja','Sesja i kolokwia',['studia']],['wlasny','Własny cel',['podstawowka','liceum','studia','inne']]];
const GOAL_DEFAULT={podstawowka:'sprawdziany',liceum:'matura-r',studia:'sesja',inne:'wlasny'};
let obFrom='first';
function openLevelPick(from){obFrom=from||'first';go('levelpick');}
function openOnboarding(from){obFrom=from||'first';go('onboarding');}
function obShell(step,cls){
  app.innerHTML='';const sc=el('div','screen active');sc.appendChild(el('div','blob a-float acid'));
  const scroll=el('div','scroll ob '+(cls||''));
  const dots=el('div','obdots');dots.setAttribute('aria-label',`Krok ${step} z 3`);
  for(let i=1;i<=3;i++)dots.appendChild(el('i',i<step?'on':i===step?'cur a-blink':''));
  scroll.appendChild(dots);sc.appendChild(scroll);app.appendChild(sc);app.appendChild(el('div','toast',''));app.lastChild.id='toast';
  return scroll;
}
function renderLevelPick(){
  const scroll=obShell(1,'levelpick');
  let level=META.level||null,goal=META.goal||null;
  scroll.appendChild(el('div','obhead a-up','<h1>Na jakim etapie jesteś?</h1><p>Dopasujemy poziom trudności, język wyjaśnień i gotowe przedmioty.</p>'));
  const opts=el('div','obopts');scroll.appendChild(opts);
  scroll.appendChild(el('div','eyebrow sec obeye','Do czego się przygotowujesz?'));
  const chips=el('div','obchips');scroll.appendChild(chips);
  const foot=el('div','obfoot');const next=el('button','pill a-glow',obFrom==='first'?'DALEJ':'ZAPISZ');next.id='ob-next';foot.appendChild(next);
  if(obFrom!=='first'){const back=el('button','pill text','Wróć bez zmian');back.id='ob-back';back.onclick=()=>go('settings');foot.appendChild(back);}
  scroll.appendChild(foot);
  let first=true;
  const draw=()=>{
    opts.innerHTML='';LEVELS.forEach(([id,t,s,ic,tone],i)=>{const on=level===id;
      const b=el('button','obopt '+tone+(on?' on'+(first?'':' a-pop'):first?' a-up d'+(i+1):''),`<div class="ico">${icon(ic,{size:24,stroke:2.6})}</div><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div><span class="ck">${on?icon('check',{size:16,stroke:4}):''}</span>`);
      b.dataset.level=id;b.setAttribute('aria-pressed',String(on));b.onclick=()=>{level=id;if(!goal||!GOALS.find(g=>g[0]===goal)[2].includes(id))goal=GOAL_DEFAULT[id];draw();};opts.appendChild(b);});
    chips.innerHTML='';GOALS.filter(g=>!level||g[2].includes(level)).forEach(([id,t],i)=>{const on=goal===id;const c=el('button','obchip'+(on?' on':'')+(first?' a-up d'+Math.min(6,i+3):''),t);c.dataset.goal=id;c.setAttribute('aria-pressed',String(on));c.onclick=()=>{goal=id;draw();};chips.appendChild(c);});
    next.disabled=!level;first=false;
  };
  next.onclick=()=>{if(!level)return;META.level=level;META.goal=goal||GOAL_DEFAULT[level];saveMeta();if(obFrom==='first')openOnboarding('first');else{toast('Zapisane: '+LEVEL_NAME[level],'check');go('settings');}};
  keyFn=e=>{if(e.key==='Enter')next.click();};
  draw();
}
function renderOnboarding(){
  const scroll=obShell(2,'onboarding');
  let goal=goalXP();const rem=META.reminder||{on:false,at:'19:30'};let remOn=!!rem.on;
  scroll.appendChild(el('div','obhead a-up','<h1>Ile czasu dziennie?</h1><p>Cel możesz zmienić w każdej chwili. Lepiej zacząć niżej i utrzymać serię.</p>'));
  const opts=el('div','obopts');scroll.appendChild(opts);
  let first=true;
  const draw=()=>{opts.innerHTML='';GOALS_XP.forEach(([xp,t,mins],i)=>{const on=goal===xp;
    const b=el('button','obopt goal'+(on?' on'+(first?'':' a-pop'):first?' a-up d'+(i+1):''),`<i class="obbar"></i><div class="grow"><div class="t">${t}</div><div class="s">${mins} · ${xp} XP</div></div><span class="ck">${on?icon('check',{size:16,stroke:4}):''}</span>`);
    b.dataset.goal=xp;b.setAttribute('aria-pressed',String(on));b.onclick=()=>{goal=xp;draw();};opts.appendChild(b);});first=false;};
  draw();
  const rr=el('div','obrem a-up d5',`<div class="ico">${icon('bell',{size:22,stroke:2.4})}</div><div class="grow"><div class="t">Przypomnienie</div><div class="s">codziennie o <b id="obtime">${rem.at||'19:30'}</b> · wymaga aplikacji mobilnej</div></div>`);
  rr.appendChild(toggleBtn(remOn,'Przypomnienie',v=>{remOn=v;}));scroll.appendChild(rr);
  scroll.appendChild(el('div','obnote a-up d6',icon('flame',{size:20,cls:'ic-flame'})+'<span>Seria rośnie każdego dnia, w którym dobijesz cel.</span>'));
  const foot=el('div','obfoot');const next=el('button','pill a-glow',obFrom==='first'?'USTAW CEL':'ZAPISZ CEL');next.id='ob-next';
  next.onclick=()=>{setGoal(goal);META.reminder={on:remOn,at:rem.at||'19:30'};saveMeta();
    if(obFrom==='first'){go('today');setTimeout(()=>toast('Cel dzienny: '+goal+' XP','bolt'),500);}else{toast('Cel dzienny: '+goal+' XP','bolt');go(obFrom==='today'?'today':'settings');}};
  foot.appendChild(next);
  if(obFrom!=='first'){const back=el('button','pill text','Wróć bez zmian');back.id='ob-back';back.onclick=()=>go(obFrom==='today'?'today':'settings');foot.appendChild(back);}
  scroll.appendChild(foot);
  keyFn=e=>{if(e.key==='Enter')next.click();};
}

/* ============================================================ KROK 9: KATALOG (Catalog.html) — gotowe przedmioty pogrupowane po subject.level */
let catQuery='',catLevel=null;
function subjLevel(s){return LEVEL_NAME[s.level]?s.level:'inne';}
function renderCatalog(){
  const close=el('button','backbtn',icon('close',{size:18,stroke:3}));close.setAttribute('aria-label','Zamknij');close.onclick=()=>go('today');
  const scroll=shell(null,{cls:'catalog',title:'Odkrywaj',pills:false,right:close});
  const levelsHere=[...new Set(SUBJECTS.map(subjLevel))];const order=['podstawowka','liceum','studia','inne'];levelsHere.sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  if(catLevel==null)catLevel=levelsHere.includes(META.level)?META.level:'all';
  if(catLevel!=='all'&&!levelsHere.includes(catLevel))catLevel='all';
  const box=el('label','catsearch a-up',icon('search',{size:20,stroke:2.6})+'<span class="sr">Szukaj przedmiotu</span>');
  const inp=el('input');inp.type='search';inp.id='cat-search';inp.placeholder='Przedmiot, dział albo temat';inp.value=catQuery;inp.autocomplete='off';inp.setAttribute('aria-label','Szukaj przedmiotu');
  box.appendChild(inp);scroll.appendChild(box);
  const chips=el('div','catchips a-up d1');
  const mk=(id,name)=>{const c=el('button','catchip'+(catLevel===id?' on':''),name);c.dataset.level=id;c.setAttribute('aria-pressed',String(catLevel===id));c.onclick=()=>{catLevel=id;draw();};chips.appendChild(c);};
  mk('all','Wszystkie');levelsHere.forEach(l=>mk(l,LEVEL_CHIP[l]));scroll.appendChild(chips);
  const cta=el('button','catcta a-up d2',`<div class="ico a-bob">${icon('upload',{size:26,stroke:2.6})}</div><div class="grow"><div class="t">Masz notatki od nauczyciela?</div><div class="s">Zrób z nich przedmiot w 3 minuty</div></div>`);
  cta.id='cat-cta';cta.onclick=()=>openQuickAdd();scroll.appendChild(cta);
  const list=el('div','catlist');scroll.appendChild(list);
  const hay=s=>fold([s.name,s.short,s.tagline,LEVEL_NAME[subjLevel(s)],...s.levels.map(l=>noEmoji(l.title))].filter(Boolean).join(' '));
  const draw=()=>{
    chips.querySelectorAll('.catchip').forEach(c=>{const on=c.dataset.level===catLevel;c.classList.toggle('on',on);c.setAttribute('aria-pressed',String(on));});
    const q=fold(catQuery);const words_=q.split(' ').filter(Boolean);
    let subs=SUBJECTS.filter(s=>catLevel==='all'||subjLevel(s)===catLevel);
    if(words_.length)subs=subs.filter(s=>{const h=hay(s);return words_.every(w=>h.indexOf(w)>=0);});
    list.innerHTML='';
    if(!subs.length){list.appendChild(el('div','catempty a-up',icon('search',{size:26,stroke:2.2})+`<div class="t">Nic nie znaleziono</div><div class="s">${words_.length?'Spróbuj krócej albo innym słowem — szukam też w tytułach poziomów.':'Brak przedmiotów na tym etapie.'}</div>`));return;}
    const groups=catLevel==='all'?levelsHere.filter(l=>subs.some(s=>subjLevel(s)===l)):[catLevel];
    groups.forEach(l=>{
      const mine=subs.filter(s=>subjLevel(s)===l);
      list.appendChild(el('div','eyebrow sec',LEVEL_NAME[l]+' · '+mine.length));
      const grid=el('div','grid2 catgrid');
      mine.forEach((s,i)=>{const st=PROGRESS[s.id]||{};const done=s.levels.filter(l=>((st.levels||{})[l.id]||{}).done).length;const n=s.levels.length;
        const c=el('button','catcard themed a-up d'+Math.min(6,i+1));c.style.setProperty('--accent',s.accent);if(s.onAccent)c.style.setProperty('--on-accent',s.onAccent);
        c.innerHTML=`${mono(initial(s.short||s.name),'solid')}<div class="t">${s.short||s.name}</div><div class="s">${s.tagline||s.name}</div><div class="catmeta"><span>${done?done+'/':''}${n} ${pl(n,'poziom','poziomy','poziomów')}</span><span class="open">Otwórz ${icon('chevron-right',{size:13,stroke:3.2})}</span></div>`;
        c.setAttribute('aria-label',s.name+', '+n+' poziomów, otwórz');c.onclick=()=>openSubject(s.id);grid.appendChild(c);});
      list.appendChild(grid);
    });
  };
  inp.oninput=()=>{catQuery=inp.value;draw();};
  draw();
}

/* ============================================================ KROK 9: TWÓJ TYDZIEŃ (WeeklyStory.html) — z PROGRESS.history
   Poniedziałek, pierwsze otwarcie (raz, META.weeklyShown = klucz tygodnia): zeszły tydzień vs poprzedni. Z Profilu („Ten tydzień ›”): bieżący vs zeszły. */
let weeklyMode='this';
function openWeekly(mode){weeklyMode=mode||'this';go('weekly');}
function weekRange(offset){const now=new Date();const dow=(now.getDay()+6)%7;const mon=new Date(now.getFullYear(),now.getMonth(),now.getDate()-dow+offset*7);return Array.from({length:7},(_,i)=>dstr(new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+i)));}
function weekStats(days){const H=history();const st={xp:0,levels:0,cards:0,reviews:0,combo:0,missions:0,days:0,perDay:[]};
  days.forEach(d=>{const h=H[d]||{};const x=h.xp|0;st.xp+=x;st.levels+=h.levels|0;st.cards+=h.cards|0;st.reviews+=h.reviews|0;st.missions+=h.missions|0;st.combo=Math.max(st.combo,h.combo|0);if(x>0||(h.levels|0)>0||(h.reviews|0)>0)st.days++;st.perDay.push(x);});return st;}
function needWeekly(){if(new Date().getDay()!==1||META.weeklyShown===weekKey())return false;const st=weekStats(weekRange(-1));return st.xp>0||st.days>0;}
function renderWeekly(){
  const last=weeklyMode==='last';if(last){META.weeklyShown=weekKey();saveMeta();}
  const cur=weekStats(weekRange(last?-1:0)),prev=weekStats(weekRange(last?-2:-1));
  app.innerHTML='';const sc=el('div','screen active weekly');sc.appendChild(el('div','wkblob a-float'));sc.appendChild(el('div','wkblob two a-float d3'));
  const scroll=el('div','scroll wk');sc.appendChild(scroll);app.appendChild(sc);app.appendChild(el('div','toast',''));app.lastChild.id='toast';
  scroll.appendChild(el('div','wksegs','<i class="on"></i><i class="on"></i><i><b class="a-grow"></b></i><i></i><i></i>'));
  const head=el('div','wkhead',`<span>${last?'Twój tydzień':'Ten tydzień'}</span>`);
  const x=el('button','wkclose',icon('close',{size:20,stroke:3.4}));x.setAttribute('aria-label','Zamknij podsumowanie');x.id='wk-close';x.onclick=()=>go(last?'today':'profile');head.appendChild(x);scroll.appendChild(head);
  const diff=prev.xp>0?Math.round((cur.xp-prev.xp)/prev.xp*100):null;
  const trend=diff==null?(cur.xp?'pierwszy tydzień z historią':'jeszcze bez XP w tym tygodniu'):diff>=0?`o ${diff}% więcej niż tydzień temu`:`o ${-diff}% mniej niż tydzień temu`;
  const days=weekRange(last?-1:0);const t=todayStr();const max=Math.max(1,...cur.perDay);const bi=cur.perDay.indexOf(Math.max(...cur.perDay));
  scroll.appendChild(el('div','wkbody',`<div class="wkl a-up">${last?'W zeszłym tygodniu zdobyte':'W tym tygodniu zdobyte'}</div><div class="wkn a-pop d1">${fmtNum(cur.xp)} XP</div>
    <div class="wkchip a-up d2">${icon('trend',{size:16,cls:diff!=null&&diff<0?'':'ic-acid'})}<span>${trend}</span></div>
    <div class="wkbars">${days.map((d,i)=>`<div class="wkcol${d===t?' today':''}${i===bi&&cur.perDay[i]>0?' best':''}${d>t?' future':''}"><div class="wkbar"><i class="a-up d${Math.min(6,i+1)}" style="height:${Math.max(6,Math.round(cur.perDay[i]/max*100))}%"></i></div><span>${DAYS_S[(i+1)%7]}</span></div>`).join('')}</div>
    <div class="wkbest a-up d6">${cur.xp?`Najmocniejszy dzień: ${DAYS[(bi+1)%7].toLowerCase()} — ${cur.perDay[bi]} XP.`:'Zacznij od jednego zadania z planu dnia.'}</div>`));
  const grid=el('div','wkgrid a-up d4');
  [['flame',cur.days,pl(cur.days,'dzień nauki','dni nauki','dni nauki')],['check',cur.levels,pl(cur.levels,'poziom zaliczony','poziomy zaliczone','poziomów zaliczonych')],['refresh',cur.reviews,pl(cur.reviews,'pojęcie powtórzone','pojęcia powtórzone','pojęć powtórzonych')],['cards',cur.cards,pl(cur.cards,'karta w albumie','karty w albumie','kart w albumie')],['bolt','×'+cur.combo,'najlepsze combo'],['star',cur.missions,pl(cur.missions,'misja odebrana','misje odebrane','misji odebranych')]].forEach(([ic,v,lab])=>grid.appendChild(el('div','wkstat',`${icon(ic,{size:18,stroke:2.6})}<b>${v}</b><span>${lab}</span>`)));
  scroll.appendChild(grid);
  const foot=el('div','wkfoot');
  const main=el('button','pill dark a-glow',last?'WRACAM DO NAUKI':'WRÓĆ DO PROFILU');main.id='wk-main';main.onclick=()=>go(last?'today':'profile');foot.appendChild(main);
  if(navigator.share){const sh=el('button','pill text dark',icon('upload',{size:16})+' Udostępnij');sh.onclick=()=>{navigator.share({title:'Nauka — mój tydzień',text:`${cur.xp} XP, ${cur.days} ${pl(cur.days,'dzień','dni','dni')} nauki, ${cur.levels} ${pl(cur.levels,'poziom','poziomy','poziomów')} — Nauka ${VERSION}`}).catch(()=>{});};foot.appendChild(sh);}
  scroll.appendChild(foot);
  keyFn=e=>{if(e.key==='Enter'||e.key==='Escape')main.click();};
}

/* ============================================================ KROK 9: NOC PRZED EGZAMINEM (Cram.html) — 4 bloki po 5 minut, potem „Idź spać”
   Wejścia: karta „Egzamin jutro?” na ExamStart, ostatni dzień planu do sprawdzianu. Bloki: najsłabsze pojęcia (SRS lapses), fiszki z zakresu,
   10 pytań, błędy z egzaminu (talia; bez talii — pytania z pudełka 0). Zapis jak w powtórce: srsTouch, +2/+3 XP, plan dnia „review”, dzień planu. */
const CRAM_BLOCK=300,CRAM_TONE={weak:'red',cards:'gold',quiz:'cyan',errors:'violet'};
let cramState=null,cramInt=null,cramSid=null;
function openCram(sid){cramSid=sid;go('cram');}
function cramBlocks(s){
  const t=testFor(s.id);const scope=t?t.levels:s.levels.map(l=>l.id);const lvOf=id=>s.levels.find(l=>l.id===id);
  const inScope=x=>scope.indexOf(x.lv.id)>=0;
  const mine=srsEntries().filter(x=>x.s.id===s.id&&inScope(x));
  const weak=mine.filter(x=>(x.e.lapses|0)>0||(x.e.box|0)<=1).sort((a,b)=>((b.e.lapses|0)-(a.e.lapses|0))||((a.e.box|0)-(b.e.box|0))).slice(0,10);
  const cards=shuffle(allCards(s).filter(c=>scope.indexOf(c.lid)>=0)).slice(0,12).map(c=>({s,lv:lvOf(c.lid),kind:'card',c,idx:c.i,key:s.id+':'+c.lid+':'+c.i}));
  const qs=shuffle(exQuizFor(s,scope)).slice(0,10).map(q=>({s,lv:lvOf(q.lid),kind:'quiz',q,idx:q.qi,key:s.id+':'+q.lid+':q'+q.qi}));
  const deck=deckKeys(s.id).map(srsResolve).filter(Boolean);
  const errs=deck.length?deck.slice(0,10):mine.filter(x=>x.kind==='quiz'&&(x.e.box|0)===0).slice(0,10);
  const lvNames=scope.map(id=>{const l=lvOf(id);return l?noEmoji(l.title):'';}).filter(Boolean);
  const scopeTxt=scope.length===s.levels.length?'cały przedmiot':lvNames.slice(0,2).join(', ')+(lvNames.length>2?' +'+(lvNames.length-2):'');
  return [
    {id:'weak',t:'Najsłabsze pojęcia',s:weak.length?`${weak.length} ${pl(weak.length,'pojęcie, które','pojęcia, które','pojęć, które')} najczęściej mylisz`:'bez historii pomyłek — biorę fiszki z zakresu',items:weak.length?weak:cards.slice(0,8)},
    {id:'cards',t:'Fiszki z zakresu',s:`${cards.length} ${pl(cards.length,'fiszka','fiszki','fiszek')} · ${scopeTxt}`,items:cards},
    {id:'quiz',t:`${qs.length} ${pl(qs.length,'pytanie','pytania','pytań')}`,s:'jak na egzaminie, z wyjaśnieniami po każdym',items:qs},
    {id:'errors',t:'Błędy z egzaminu',s:deck.length?`${errs.length} ${pl(errs.length,'pytanie','pytania','pytań')} z talii błędów`:errs.length?'talia pusta — pytania, które ostatnio poszły źle':'talia pusta i bez pomyłek — blok pominięty',items:errs}
  ].filter(b=>b.items.length);
}
function renderCram(){
  const s=SUBJECTS.find(x=>x.id===cramSid);if(!s)return go('today');
  applyTheme(s);
  const blocks=cramBlocks(s);const t=testFor(s.id);
  const back=()=>openSubject(s.id,'egzamin');
  const scroll=shell(null,{cls:'cram',title:'Noc przed egzaminem',pills:false,back});
  for(let i=0;i<5;i++)scroll.appendChild(el('i','cramstar a-blink d'+(i%6+1)));
  const now=new Date();const toMid=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1)-now;
  const total=blocks.length*5;
  scroll.appendChild(el('div','cramhero a-up',`${icon('moon',{size:64,cls:'ic-moon'})}<div class="eyebrow">${s.short||s.name} · ${t?'sprawdzian '+inDays(dayDiff(todayStr(),t.date)):'ostatnia powtórka przed egzaminem'}</div><div class="cramtime a-blink">${total} min</div><div class="crams">do północy ${etaText(toMid)} — potem sen utrwala to, co dziś powtórzysz</div>`));
  scroll.appendChild(el('div','eyebrow sec','Plan na '+total+' minut'));
  const list=el('div','cramrows');
  blocks.forEach((b,i)=>list.appendChild(el('div',`cramrow ${CRAM_TONE[b.id]} a-up d${i+1}`,`<div class="num"><span>${i+1}</span></div><div class="grow"><div class="t">${b.t}</div><div class="s">${b.s}</div></div><span class="min">5 min</span>`)));
  if(!blocks.length)list.appendChild(el('div','sp','Brak fiszek i pytań w tym przedmiocie.'));
  scroll.appendChild(list);
  scroll.appendChild(el('div','cramnote a-up d5',icon('info',{size:18,stroke:2.4})+'<span>Blok kończy się po 5 minutach albo gdy przejrzysz wszystko. Potem idź spać — sen utrwala to, czego się właśnie nauczyłeś.</span>'));
  const foot=el('div','cramfoot');const b=el('button','pill violet a-glow','ZACZYNAM');b.id='cram-start';b.disabled=!blocks.length;
  b.onclick=()=>{cramState={s,blocks,bi:0,ii:0,left:CRAM_BLOCK,ok:0,bad:0,xp:0,flipped:false,marks:[],t0:Date.now()};cramTimer();cramRender();};
  foot.appendChild(b);scroll.appendChild(foot);
  keyFn=e=>{if(e.key==='Enter')b.click();};
}
function cramTimer(){clearInterval(cramInt);cramInt=setInterval(()=>{const cs=cramState;if(!cs||cs.done)return clearInterval(cramInt);cs.left--;
  const t=document.getElementById('cramleft');if(t){t.textContent=fmt(Math.max(0,cs.left));t.parentElement.classList.toggle('warn',cs.left<=30);t.parentElement.classList.toggle('a-blink',cs.left<=30);}
  const bar=document.getElementById('cramdrain');if(bar)bar.style.width=Math.max(0,cs.left/CRAM_BLOCK*100)+'%';
  if(cs.left<=0)cramNextBlock('Czas na ten blok minął');},1000);}
function cramNextBlock(msg){const cs=cramState;if(!cs)return;closeSheet();cs.bi++;cs.ii=0;cs.left=CRAM_BLOCK;cs.marks=[];cs.flipped=false;
  if(cs.bi>=cs.blocks.length)return cramFinish();cramRender();toast(msg||'Blok gotowy','check');}
function cramAnswer(it,ok,xp){const cs=cramState;cs.marks[cs.ii]=ok?'on':'bad';srsTouch(it.s.id,it.lv.id,it.kind==='quiz'?'q'+it.idx:String(it.idx),ok);
  if(ok){cs.ok++;if(xp){cs.xp+=xp;addXP(it.s.id,xp);}}else cs.bad++;missionEvent('review',1);}
function cramRender(){
  const cs=cramState;if(!cs)return;closeSheet();keyFn=null;
  const b=cs.blocks[cs.bi];if(cs.ii>=b.items.length)return cramNextBlock();
  const it=b.items[cs.ii];
  app.innerHTML='';const L=el('div','lesson open rvrun cramrun');app.appendChild(L);app.appendChild(el('div','toast',''));app.lastChild.id='toast';
  const head=el('div','lessonhead cramhead');
  const x=el('button','x',icon('close',{size:18,stroke:3}));x.setAttribute('aria-label','Przerwij');x.onclick=()=>{if(cs.ok+cs.bad>0)cramFinish();else{cramState=null;clearInterval(cramInt);renderCram();}};head.appendChild(x);
  head.appendChild(el('div','cramlbl',`<div class="eyebrow">Blok ${cs.bi+1} z ${cs.blocks.length}</div><div class="t">${b.t}</div>`));
  head.appendChild(el('button','egtimer cramclock'+(cs.left<=30?' warn a-blink':''),icon('clock',{size:15})+`<span id="cramleft">${fmt(cs.left)}</span>`));
  L.appendChild(head);
  L.appendChild(el('div','egdrain cram',`<i id="cramdrain" style="width:${cs.left/CRAM_BLOCK*100}%"></i>`));
  const seg=el('div','segbar cramseg');seg.setAttribute('aria-label',`${cs.ii+1} z ${b.items.length}`);for(let i=0;i<b.items.length;i++)seg.appendChild(el('i',i<cs.ii?(cs.marks[i]==='bad'?'bad':'on'):''));L.appendChild(seg);
  const body=el('div','lessonbody');L.appendChild(body);body.appendChild(el('div','blob a-float'));
  const next=()=>{cs.ii++;cramRender();};
  if(it.kind==='card'){
    const c=it.c;
    const flip=el('div','flip themed a-up'+(cs.flipped?' flipped':''));flip.style.setProperty('--accent',it.s.accent);if(it.s.onAccent)flip.style.setProperty('--on-accent',it.s.onAccent);
    flip.innerHTML=`<div class="flipinner"><div class="face front"><span class="tag accent">${noEmoji(it.lv.title)}</span><div class="term">${c.t}</div><div class="tapomat">dotknij, żeby odwrócić</div></div>
      <div class="face back"><span class="tag">odpowiedź</span><div class="deftxt">${c.d}</div><div class="tapomat">dotknij, żeby wrócić</div></div></div>`;
    let swiped=false;flip.onclick=()=>{if(swiped){swiped=false;return;}cs.flipped=!cs.flipped;flip.classList.toggle('flipped');};body.appendChild(flip);
    const foot=el('div','lessonfoot');const btns=el('div','fbtns');
    const no=el('button','fbtn no',icon('refresh',{size:18,stroke:2.8})+' jeszcze nie'),yes=el('button','fbtn yes',icon('check',{size:18,stroke:3.4})+' umiem');no.id='rvno';yes.id='rvyes';
    const ans=ok=>{if(!advOk())return;cramAnswer(it,ok,ok?2:0);cs.flipped=false;next();};
    no.onclick=()=>ans(false);yes.onclick=()=>ans(true);
    let x0=null;flip.onpointerdown=e=>{x0=e.clientX;};flip.onpointerup=e=>{if(x0==null)return;const dx=e.clientX-x0;x0=null;if(Math.abs(dx)>80){swiped=true;ans(dx>0);}};
    btns.appendChild(no);btns.appendChild(yes);foot.appendChild(btns);L.appendChild(foot);
    keyFn=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();flip.click();}else if(e.key==='ArrowLeft'||e.key==='1')ans(false);else if(e.key==='ArrowRight'||e.key==='2')ans(true);};
  }else{
    const q=it.q;
    const blk=quizBlock(q,{n:cs.ii+1,total:b.items.length,tag:noEmoji(it.lv.title),onAnswer:(i,ok)=>{
      cramAnswer(it,ok,ok?3:0);
      if(ok){body.appendChild(confetti(4));sheetOk(q,{xp:3,mult:1,combo:0,onNext:next,subj:it.s,lv:it.lv,qi:it.idx});}
      else sheetBad(q,{onNext:next,subj:it.s,lv:it.lv,qi:it.idx});
    }});
    body.appendChild(blk.body);const foot=el('div','lessonfoot');foot.appendChild(blk.foot);L.appendChild(foot);
  }
  const skip=el('button','pill text sm cramskip','Pomiń blok');skip.id='cram-skip';skip.onclick=()=>cramNextBlock('Blok pominięty');L.lastChild.appendChild(skip);
}
function cramFinish(){
  const cs=cramState;if(!cs)return;cs.done=true;clearInterval(cramInt);closeSheet();keyFn=null;
  const s=cs.s;const total=cs.ok+cs.bad;const pct=total?Math.round(cs.ok/total*100):0;const t=testFor(s.id);
  if(total){completeDaily(s.id,'review');testDone(s.id,'review');}
  app.innerHTML='';const L=el('div','lesson open rvrun cramdone');app.appendChild(L);app.appendChild(el('div','toast',''));app.lastChild.id='toast';
  const body=el('div','lessonbody done');body.appendChild(el('div','blob a-float'));if(pct>=50)body.appendChild(confetti(5));
  const lc=el('div','lc');
  lc.innerHTML=`<div class="lcbig moon a-pop">${icon('moon',{size:64})}</div>
    <div class="lctxt a-up d2"><div class="lct">Idź spać</div><div class="lcs">${s.short||s.name} · ${cs.bi+(cs.ii>0?1:0)>cs.blocks.length?cs.blocks.length:Math.min(cs.blocks.length,cs.bi+(cs.ii>0?1:0))} z ${cs.blocks.length} ${pl(cs.blocks.length,'bloku','bloków','bloków')} · ${fmt(Math.round((Date.now()-cs.t0)/1000))}</div></div>
    <div class="lcstats a-up d3"><div class="lcstat acid"><div class="v">${cs.ok}</div><div class="k under">umiem</div></div><div class="lcstat red"><div class="v">${cs.bad}</div><div class="k under">do rana</div></div><div class="lcstat gold"><div class="v">+${cs.xp}</div><div class="k under">XP</div></div></div>`;
  const card=el('div','setcard rvlist a-up d4');
  card.innerHTML='<div class="eyebrow sec">Plan na jutro</div>'+[['clock','Rano: 5 minut',cs.bad?cs.bad+' '+pl(cs.bad,'pojęcie, które','pojęcia, które','pojęć, które')+' dziś nie weszło — wracają w powtórce':'tylko fiszki z najsłabszych, bez nowych rzeczy'],['close','Przed egzaminem: nic nowego','przejrzyj notatki, nie ucz się nowych rzeczy'],t?['calendar','Sprawdzian: '+fmtDate(t.date),inDays(dayDiff(todayStr(),t.date))+' · powodzenia']:['moon','Teraz sen','7–8 godzin robi więcej niż kolejna godzina nauki']].map(([ic,tt,ss])=>`<div class="setrow">${icon(ic,{size:18,stroke:2.6})}<div class="grow"><div class="t">${tt}</div><div class="s">${ss}</div></div></div>`).join('<div class="setsep"></div>');
  lc.appendChild(card);body.appendChild(lc);L.appendChild(body);
  const foot=el('div','lessonfoot col');const main=el('button','pill violet a-glow','DOBRANOC');main.id='cram-done';main.onclick=()=>go('today');
  const alt=el('button','pill text','WRÓĆ DO EGZAMINU');alt.id='cram-alt';alt.onclick=()=>openSubject(s.id,'egzamin');foot.appendChild(main);foot.appendChild(alt);L.appendChild(foot);
  cramState=null;keyFn=e=>{if(e.key==='Enter')main.click();};
  setTimeout(()=>toast('Powtórka zapisana — dobranoc','moon'),400);
}

/* ============================================================ KROK 9: POPRAW PYTANIE (EditContent.html) — arkusz; PROGRESS.overrides["sid:lid:qi"]={q,a,c,e}
   Nakładane przez qOf() wszędzie: lekcja, zakładka Quiz, egzamin, boss, powtórka, cram. „Przywróć oryginał” kasuje nadpisanie. */
function openEditContent(s,lv,qi,o){
  o=o||{};const base=(lv.quiz||[])[qi];if(!base)return;
  const ov=overrides()[ovKey(s.id,lv.id,qi)];const cur=ov?{q:ov.q,a:ov.a.slice(),c:ov.c,e:ov.e}:{q:base.q,a:base.a.slice(),c:base.c,e:base.e||''};
  let c=cur.c;
  const sh=openSheet('edit',`<div class="shandle"></div>
    <div class="shead"><div><div class="st2">Popraw pytanie</div><div class="ssub">${s.short||s.name} · ${noEmoji(lv.title)} · pytanie ${qi+1} z ${(lv.quiz||[]).length}</div></div><button class="backbtn sclose" id="edclose" aria-label="Zamknij">${icon('close',{size:18,stroke:3})}</button></div>
    <div class="infobox a-up">${icon('edit',{size:18})}<span>${ov?'To pytanie ma już twoją poprawkę.':'Poprawka zostanie zapisana na tym urządzeniu.'} Zastąpi pytanie w lekcji, quizie, egzaminie i powtórce.</span></div>
    <label class="edlbl a-up d1" for="edq">Treść pytania</label><textarea class="edta" id="edq" rows="2">${cur.q}</textarea>
    <div class="edlbl a-up d2">Odpowiedzi — zaznacz poprawną</div>
    <div class="edopts a-up d2">${cur.a.map((a,i)=>`<div class="edopt${i===c?' on':''}"><button class="edradio" type="button" data-i="${i}" role="radio" aria-checked="${i===c}" aria-label="Poprawna: ${keys[i]}"><i></i></button><span class="k">${keys[i]}</span><input class="edin" type="text" data-i="${i}" value="${String(a).replace(/"/g,'&quot;')}" aria-label="Odpowiedź ${keys[i]}"></div>`).join('')}</div>
    <label class="edlbl a-up d3" for="ede">Wyjaśnienie</label><textarea class="edta" id="ede" rows="2">${cur.e||''}</textarea>
    ${ov?'<button class="pill ghost sm" id="edreset">'+icon('refresh',{size:16,stroke:2.8})+' Przywróć oryginał</button>':''}
    <button class="pill" id="edsave">ZAPISZ ZMIANY</button>`);
  sheetBack();
  const close=()=>{closeSheet();if(o.onBack)o.onBack();};
  sh.querySelector('#edclose').onclick=close;document.getElementById('sheetback').onclick=close;
  const rows=[...sh.querySelectorAll('.edopt')];
  sh.querySelectorAll('.edradio').forEach(r=>r.onclick=()=>{c=+r.dataset.i;rows.forEach((row,i)=>{row.classList.toggle('on',i===c);row.querySelector('.edradio').setAttribute('aria-checked',String(i===c));});});
  sh.querySelector('#edsave').onclick=()=>{
    const q=sh.querySelector('#edq').value.trim();const a=[...sh.querySelectorAll('.edin')].map(i=>i.value.trim());const e=sh.querySelector('#ede').value.trim();
    if(!q||a.some(x=>!x)){toast('Uzupełnij pytanie i wszystkie odpowiedzi','alert');return;}
    const same=q===base.q&&e===(base.e||'')&&c===base.c&&a.every((x,i)=>x===base.a[i]);
    const O=overrides();if(same)delete O[ovKey(s.id,lv.id,qi)];else O[ovKey(s.id,lv.id,qi)]={q,a,c,e,at:todayStr()};saveProgress();
    closeSheet();toast(same?'Bez zmian — oryginał':'Poprawka zapisana','check');if(o.onSaved)o.onSaved(qOf(s,lv,qi));
  };
  const rs=sh.querySelector('#edreset');if(rs)rs.onclick=()=>{delete overrides()[ovKey(s.id,lv.id,qi)];saveProgress();closeSheet();toast('Przywrócono oryginał','refresh');if(o.onSaved)o.onSaved(qOf(s,lv,qi));};
  keyFn=null;setTimeout(()=>{try{sh.querySelector('#edq').focus();}catch(e){}},80);
  return sh;
}

/* ============================================================ KROK 9: ŹRÓDŁO PYTANIA (SourceView.html) — offline: materiał, strona, cytat; podgląd zdjęcia = wersja online */
function openSourceView(q,ctx,onBack){
  const src=q.src||{};ctx=ctx||{};
  const sub=[src.material?'materiał '+src.material:'',src.page?'strona '+src.page:''].filter(Boolean).join(' · ')||'materiał źródłowy';
  const sh=openSheet('source',`<div class="shandle"></div>
    <div class="shead"><div><div class="st2">Skąd to pytanie?</div><div class="ssub">${sub}</div></div><button class="backbtn sclose" id="srcclose" aria-label="Zamknij">${icon('close',{size:18,stroke:3})}</button></div>
    <div class="srcpage a-up d1"><div class="pg"><i class="h"></i>${[70,58,72,46,64,60].map(w=>`<i style="width:${w}%"></i>`).join('')}<i class="hl a-glow" style="width:54%"></i>${[66,52,62,50].map(w=>`<i style="width:${w}%"></i>`).join('')}</div>
      <div class="srcnote">${icon('wifi',{size:15})}<span>Podgląd zdjęcia strony wymaga wersji online</span></div></div>
    <div class="srcquote a-up d2"><div class="eyebrow">Zaznaczony fragment</div><div class="qt">${src.quote?'„'+src.quote+'”':'Brak cytatu w danych — jest tylko odnośnik do materiału.'}</div></div>
    <div class="sbtns">${ctx.s&&ctx.lv&&ctx.qi!=null?'<button class="pill ghost" id="srcbad">Pytanie jest złe</button>':''}<button class="pill gold" id="srcok" data-primary>WRACAM</button></div>`);
  sheetBack();
  const back=()=>{closeSheet();if(onBack)onBack();};
  sh.querySelector('#srcclose').onclick=back;sh.querySelector('#srcok').onclick=back;document.getElementById('sheetback').onclick=back;
  const bad=sh.querySelector('#srcbad');if(bad)bad.onclick=()=>openEditContent(ctx.s,ctx.lv,ctx.qi,{onBack:onBack,onSaved:onBack});
  return sh;
}

/* ============================================================ KROK 9: „WYMAGA WERSJI ONLINE” — jeden ekran dla ShareClass, League, Friends, Scanner, Detected, Generating, Explain-AI */
const COMING={
  scanner:{t:'Zrób zdjęcie strony',icon:'camera',tone:'acid',blurb:'Aparat z wykrywaniem rogów, wiele stron naraz. AI czyta tekst ze zdjęcia i zamienia go w poziomy, fiszki i pytania — każde ze wskazaniem fragmentu źródła.',
    steps:[['camera','Strona po stronie','aparat sam robi zdjęcie, gdy kadr jest ostry',null],['search','Rozpoznanie przedmiotu i działu','ty tylko potwierdzasz','detected'],['bolt','Budowanie przedmiotu','pierwsze pytania po kilkunastu sekundach','generating']]},
  detected:{t:'Rozpoznałem materiał',icon:'search',tone:'cyan',blurb:'AI rozpoznaje przedmiot, dział i poziom ze zdjęć. Nowy materiał domyślnie dokleja się jako kolejny poziom do istniejącego przedmiotu — albo zakłada nowy.'},
  generating:{t:'Buduję przedmiot',icon:'bolt',tone:'gold',blurb:'Odczyt plików, wyciąganie pojęć, układanie poziomów, pisanie pytań i mnemotechnik. Pierwsze pytania są gotowe po kilkunastu sekundach, reszta powstaje w tle.'},
  share:{t:'Udostępnij klasie',icon:'share',tone:'cyan',blurb:'Kod dla klasy — ktoś go wpisuje i ma całą lekcję u siebie. Udostępniane są poziomy, pytania i fiszki, nigdy skany stron. Inni mogą zgłaszać poprawki, ty je zatwierdzasz.'},
  league:{t:'Liga tygodniowa',icon:'trophy',tone:'gold',blurb:'Dywizje, awanse i ranking XP z innymi uczącymi się. Tydzień kończy się w niedzielę, najlepsi awansują.'},
  friends:{t:'Znajomi',icon:'users',tone:'pink',blurb:'Twój kod, zaproszenia i wspólny tydzień — kto ile XP, czyja seria dłuższa, kto uczy się tego samego przedmiotu.'},
  explain:{t:'Wyjaśnij inaczej',icon:'bulb',tone:'cyan',blurb:'Analogia, przykład, krok po kroku — nowe wyjaśnienie tworzone przez AI na bieżąco, dopasowane do pytania, które właśnie poszło źle.'}
};
let comingKey='scanner',comingBack=null;
function openComing(key){comingKey=COMING[key]?key:'scanner';comingBack=current?{sid:current.id,tab:curTab}:{view:view==='coming'?(comingBack&&comingBack.view)||'today':view};closeSheet();go('coming');}
function comingBody(key,inSheet){
  const c=COMING[key];
  return `<div class="cmhero ${c.tone} a-up"><div class="ico a-sway">${icon(c.icon,{size:34,stroke:2.4})}</div><div class="grow"><div class="eyebrow">Wersja online</div><h2>${c.t}</h2></div></div>
    <p class="cmblurb a-up d1">${c.blurb}</p>
    <div class="infobox online a-up d2">${icon('wifi',{size:18})}<span>Ta funkcja wymaga wersji online (konto + AI). Ta wersja działa w całości offline — wszystko, co masz, jest na tym urządzeniu.</span></div>
    ${c.steps?`<div class="eyebrow sec a-up d3">Jak to działa online</div><div class="cmsteps a-up d3">${c.steps.map(([ic,t,s,k],i)=>`<${k?'button':'div'} class="cmstep${k?' link':''}" ${k?`data-key="${k}"`:''}><div class="num">${i+1}</div><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div>${k?icon('chevron-right',{size:18,cls:'chev'}):''}</${k?'button':'div'}>`).join('')}</div>`:''}
    ${inSheet?'':`<div class="eyebrow sec a-up d4">Co działa offline</div><div class="setcard a-up d4" id="cmalt">
      <button class="setrow" data-alt="catalog">${icon('grid',{size:20,stroke:2.4})}<div class="grow"><div class="t">Gotowe przedmioty z katalogu</div><div class="s">${SUBJECTS.length} ${pl(SUBJECTS.length,'przedmiot','przedmioty','przedmiotów')} z poziomami, fiszkami i pytaniami</div></div>${icon('chevron-right',{size:18,cls:'chev'})}</button><div class="setsep"></div>
      <button class="setrow" data-alt="addinfo">${icon('list',{size:20,stroke:2.4})}<div class="grow"><div class="t">Własny przedmiot z pliku danych</div><div class="s">trzy kroki, schemat w README</div></div>${icon('chevron-right',{size:18,cls:'chev'})}</button></div>`}`;
}
function renderComing(){
  const c=COMING[comingKey];const b=comingBack||{view:'today'};
  const back=()=>b.sid?openSubject(b.sid,b.tab):go(b.view||'today');
  const scroll=shell(null,{cls:'coming',title:'Wersja online',pills:false,back,blob:c.tone==='gold'?'gold':c.tone==='cyan'?'cyan':true});
  scroll.innerHTML=comingBody(comingKey,false);
  scroll.querySelectorAll('.cmstep.link').forEach(st=>st.onclick=()=>{comingKey=st.dataset.key;renderComing();});
  scroll.querySelectorAll('[data-alt]').forEach(r=>r.onclick=()=>r.dataset.alt==='catalog'?go('catalog'):openAddInfo('any'));
  const foot=el('div','cmfoot');const ok=el('button','pill a-glow','WRACAM');ok.id='cm-back';ok.onclick=back;foot.appendChild(ok);scroll.appendChild(foot);
  keyFn=e=>{if(e.key==='Enter'||e.key==='Escape')back();};
}
/* wariant w arkuszu (w trakcie lekcji: „Jeszcze inaczej — z AI”); onBack przywraca poprzedni arkusz */
function openComingSheet(key,onBack){
  const sh=openSheet('coming',`<div class="shandle"></div><div class="shead"><div class="st2">Wersja online</div><button class="backbtn sclose" id="cmclose" aria-label="Zamknij">${icon('close',{size:18,stroke:3})}</button></div>${comingBody(key,true)}
    <button class="pill cyan" id="cmok" data-primary>WRACAM</button>`);
  sheetBack();const back=()=>{closeSheet();if(onBack)onBack();};
  sh.querySelector('#cmclose').onclick=back;sh.querySelector('#cmok').onclick=back;document.getElementById('sheetback').onclick=back;
  return sh;
}

/* ============================================================ KROK 9: EKRAN BŁĘDU (ErrorState.html) + PASEK OFFLINE
   renderError({head, title, reason, rows:[[icon,t,s]], can:[[icon,t]], actions:[{label,primary,text,go}], back}) — używany, gdy dane przedmiotów
   nie dały się wczytać (skrypt z danymi się wykonał, ale nic nie zarejestrował), gdy start silnika rzuci wyjątek i dla „Wgraj plik” offline. */
let errState=null;
function renderError(o){errState=o;view='error';current=null;applyTheme(null);keyFn=null;try{closeSheet();}catch(e){}renderErrorView();}
function renderErrorView(){
  const o=errState||{title:'Coś poszło nie tak',reason:'',actions:[{label:'ODŚWIEŻ',primary:true,go:()=>location.reload()}]};
  app.innerHTML='';const top=el('div','topbar');
  if(o.back){const b=el('button','backbtn',icon('back',{size:20,stroke:3}));b.setAttribute('aria-label','Wróć');b.onclick=o.back;top.appendChild(b);}
  top.appendChild(el('div','logo ttl',o.head||'Nauka'));app.appendChild(top);
  const sc=el('div','screen active');const scroll=el('div','scroll errv');sc.appendChild(scroll);app.appendChild(sc);
  scroll.appendChild(el('div','errart',`<div class="errico a-shake">${icon(o.icon||'file',{size:44,stroke:2.4})}<b>!</b></div>`));
  scroll.appendChild(el('div','errtxt',`<h1 class="a-up d1">${o.title}</h1>${o.reason?`<p>${o.reason}</p>`:''}`));
  if(o.rows&&o.rows.length){const card=el('div','errlist a-up d2');o.rows.forEach(([ic,t,s,ok])=>card.appendChild(el('div','errrow'+(ok?' ok':' bad'),icon(ic,{size:18,stroke:2.4})+`<div class="grow"><div class="t">${t}</div>${s?`<div class="s">${s}</div>`:''}</div>`)));scroll.appendChild(card);}
  if(o.can&&o.can.length){const card=el('div','errcan a-up d3','<div class="eyebrow sec">Co możesz zrobić</div>');o.can.forEach(([ic,t])=>card.appendChild(el('div','r',icon(ic,{size:18,stroke:2.4})+`<span>${t}</span>`)));scroll.appendChild(card);}
  const foot=el('div','errfoot');
  (o.actions||[]).forEach((a,i)=>{const b=el('button','pill'+(a.primary?' a-glow':a.text?' text':' ghost'),a.label);b.id='err-'+i;b.onclick=a.go;foot.appendChild(b);});
  scroll.appendChild(foot);
  app.appendChild(el('div','toast',''));app.lastChild.id='toast';
  keyFn=e=>{if(e.key==='Enter'){const p=foot.querySelector('.a-glow');if(p)p.click();}};
}
/* pasek „Brak sieci” nad aplikacją (poza #app — nie kasuje go żaden render); navigator.onLine + zdarzenia offline/online */
function netbar(){
  let b=document.getElementById('netbar');
  if(!b){b=el('div','netbar',icon('wifi',{size:16})+'<span>Brak sieci — działasz offline, wszystko jest zapisane na tym urządzeniu</span>');b.id='netbar';b.setAttribute('role','status');document.body.appendChild(b);}
  const off=navigator.onLine===false;b.classList.toggle('on',off);b.classList.toggle('a-up',off);
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded',()=>{
  app=document.getElementById('app');
  applyMotion();
  netbar();window.addEventListener('offline',netbar);window.addEventListener('online',()=>{netbar();toast('Sieć wróciła','wifi');}); // krok 9
  // klawiatura (lekcja, quiz, panele): jeden nasłuch, widok podstawia keyFn; pola tekstowe (ćwiczenia) pomijane
  document.addEventListener('keydown',e=>{if(!keyFn)return;const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'))return;keyFn(e);});
  try{
    if(!SUBJECTS.length){
      // krok 9: skrypty z danymi były w dokumencie (data/*.js albo blok w buildzie), ale nic nie zarejestrowały → błąd składni albo zły kształt danych
      const dataScripts=[...document.scripts].filter(sc=>sc!==ENGINE_SCRIPT&&(/data\//.test(sc.getAttribute('src')||'')||/window\.SUBJECTS/.test(sc.textContent||'')));
      const raw=(window.SUBJECTS||[]).length;
      if(dataScripts.length)return renderError({head:'Dane przedmiotów',icon:'file',title:raw?'Dane przedmiotów mają zły kształt':'Nie udało się wczytać przedmiotów',
        reason:raw?`${raw} ${pl(raw,'wpis','wpisy','wpisów')} bez id, nazwy albo listy poziomów — silnik je pominął.`:'Plik z danymi ma błąd składni albo nie wywołał window.SUBJECTS.push(...), więc nie ma z czego zbudować ścieżki.',
        rows:dataScripts.map(sc=>['file',sc.getAttribute('src')||'dane wbudowane w build',raw?'zły kształt wpisu':'nic nie zarejestrował']),
        can:[['edit','Otwórz plik data/*.js i sprawdź składnię — musi zaczynać się od window.SUBJECTS.push({'],['list','Każdy przedmiot potrzebuje id, name i levels — schemat jest w README'],['refresh','Uruchom node build.js jeszcze raz i odśwież']],
        actions:[{label:'ODŚWIEŻ',primary:true,go:()=>location.reload()}]});
      return renderEmpty();
    }
    syncTests(); // krok 7: plany do sprawdzianu — usuń po terminie, przelicz od dziś
    applyFreeze(); // krok 8: opuszczone dni pokryte zamrożeniami → seria zostaje
    // krok 9: pierwsze uruchomienie (bez etapu) → LevelPick → Onboarding; poniedziałek → podsumowanie tygodnia (raz); ≥ 3 dni przerwy → ComeBack (krok 8)
    if(!META.level)return openLevelPick('first');
    if(needComeBack())return go('comeback');
    if(needWeekly())return openWeekly('last');
    go('today');
  }catch(e){
    renderError({head:'Nauka',icon:'alert',title:'Coś poszło nie tak',reason:'Silnik zatrzymał się przy starcie: '+String(e&&e.message||e)+'. Postępy są zapisane na tym urządzeniu.',
      can:[['refresh','Odśwież stronę — zwykle to wystarcza'],['download','Jeśli błąd wraca, wyzeruj postępy (seria zostaje)']],
      actions:[{label:'ODŚWIEŻ',primary:true,go:()=>location.reload()},{label:'Wyzeruj postępy',text:true,go:()=>{if(confirm('Wyzerować postępy?')){PROGRESS={};saveProgress();location.reload();}}}]});
  }
});
})();
