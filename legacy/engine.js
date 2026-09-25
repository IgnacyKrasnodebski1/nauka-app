/* ============================================================
   NAUKA — silnik wieloprzedmiotowej platformy do nauki
   Dane przedmiotów rejestrują się w window.SUBJECTS (patrz data/*.js)
   Tryby: Ścieżka (Duolingo) + Fiszki + Quiz + Egzamin + Info
   Widoki główne (krok 3): Dziś (plan dnia) · Przedmioty · Profil · Ustawienia · Seria
   Krok 6 (handoff 2.0): nawigacja Dziś · Powtórka · [+] · Fiszki · Profil, arkusz „Dodaj materiał”, „Wyjaśnij inaczej”,
   powtórka SRS (PROGRESS.srs, pudełka 0…4 → 0/1/3/7/21 dni), Review + FlashcardsDone, ton bez slangu.
   ============================================================ */
(function(){
"use strict";

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
  return true;
}

/* ---------- helpers ---------- */
const SUBJECTS = (window.SUBJECTS||[]);
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
  wifi:{d:'M2 8.5a16 16 0 0 1 20 0M5.5 12.5a11 11 0 0 1 13 0M9 16.5a6 6 0 0 1 6 0M12 20v.5'}
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
const TOAST_TONE={check:'acid',flame:'flame',close:'red','x-circle':'red',lock:'muted',info:'cyan',trophy:'gold',bolt:'gold',heart:'red',gem:'cyan'};

function toast(t,ic){const box=document.getElementById('toast');if(!box)return;box.innerHTML=ic?icon(ic,{size:16,cls:'ic-'+(TOAST_TONE[ic]||'acid')}):'';const s=document.createElement('span');s.textContent=t;box.appendChild(s);box.classList.add('show');clearTimeout(box._t);box._t=setTimeout(()=>box.classList.remove('show'),1500);}
function addXP(id,n){const s=subjState(id);s.xp+=n;const d=daily();d.xp+=n;saveProgress();const ext=touchStreak();updateXP();updateStreakUI();if(ext&&META.streak>1)setTimeout(()=>toast('Seria: '+META.streak+' dni z rzędu','flame'),1600);}
function updateXP(){const x=document.getElementById('xpNum');if(x&&current)x.textContent=subjState(current.id).xp;}
function updateStreakUI(){const n=streakDisplay();document.querySelectorAll('[id="streakNum"]').forEach(e=>e.textContent=n);}

/* pula wszystkich elementów danego przedmiotu (ze wszystkich poziomów) */
/* krok 6: każdy element niesie id poziomu i swój indeks (klucz SRS "<subjectId>:<levelId>:<itemId>", pytania z prefiksem q) */
function allCards(s){return s.levels.flatMap(l=>(l.flashcards||[]).map((c,i)=>({...c,lvl:noEmoji(l.title),lid:l.id,i})));}
function allQuiz(s){return s.levels.flatMap(l=>(l.quiz||[]).map((q,i)=>({...q,lvl:noEmoji(l.title),lid:l.id,qi:i})));}
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
const VIEWS={today:renderToday,review:renderReview,cards:renderCardsHub,subjects:renderSubjects,profile:renderProfile,settings:renderSettings,streak:renderStreak};
let view='today';
function go(v){
  view=VIEWS[v]?v:'today';
  current=null;applyTheme(null);
  try{clearInterval(cwInt);clearInterval(exInt);clearInterval(nhInt);}catch(e){}
  keyFn=null;lessonState=null;rvState=null;taskCleanup();
  VIEWS[view]();
}
const renderHome=()=>go('today'); // stary punkt wejścia

/* --- polskie daty i liczebniki --- */
const DAYS=['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'],DAYS_S=['Nd','Pn','Wt','Śr','Cz','Pt','Sb'];
const MONTHS=['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
function dateHeader(){const d=new Date();return DAYS[d.getDay()]+', '+d.getDate()+' '+MONTHS[d.getMonth()];}
function pl(n,one,few,many){n=Math.abs(n);if(n===1)return one;const m10=n%10,m100=n%100;return (m10>=2&&m10<=4&&(m100<12||m100>14))?few:many;}
function fmtNum(n){return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');}
function totalXP(){return SUBJECTS.reduce((a,s)=>a+(((PROGRESS[s.id]||{}).xp)||0),0);} // nie Object.values — PROGRESS.daily też ma xp
function hasProgress(s){const st=PROGRESS[s.id];return !!st&&(((st.xp||0)>0)||Object.values(st.levels||{}).some(l=>l&&l.done));}
function applyMotion(){document.documentElement.classList.toggle('reduce-motion',!!META.reduceMotion);}

/* --- plan dnia: PROGRESS.daily = {date, goal, xp, tasks:[{id, done, need?, prog?}]} (DESIGN.md §4.3, ten sam klucz) --- */
const REWARD={lesson:15,review:20,quiz:25,exam:40};
function daily(){
  const t=todayStr();let d=PROGRESS.daily;
  if(!d||d.date!==t||!Array.isArray(d.tasks)){d=PROGRESS.daily={date:t,goal:100,xp:0,tasks:buildDailyTasks()};saveProgress();}
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
    <button class="qalink a-up d3" id="qa-catalog" data-primary>albo weź gotowy przedmiot z katalogu</button>`);
  sheetBack();
  s.querySelector('#qaclose').onclick=closeSheet;
  s.querySelector('#qa-photo').onclick=()=>openAddInfo('photo');
  s.querySelector('#qa-file').onclick=()=>openAddInfo('file');
  s.querySelector('#qa-text').onclick=()=>openAddInfo('text');
  s.querySelector('#qa-catalog').onclick=()=>{closeSheet();go('subjects');};
  return s;
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
  s.querySelector('#aicat').onclick=()=>{closeSheet();if(SUBJECTS.length)go('subjects');};
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
      ${state==='done'?`<span class="rw">+${x.reward}</span>`:icon('chevron-right',{size:20,cls:'chev'})}`;
    row.setAttribute('aria-label',(state==='done'?'Zrobione: ':'')+x.title);
    row.onclick=x.go;
    card.appendChild(row);
  });
  return card;
}

/* ============================================================ DZIŚ (ekran startowy, Main.html) */
function renderToday(){
  const scroll=shell('today',{blob:true,cls:'today'});
  const d=daily();const items=d.tasks.map(taskInfo).filter(Boolean);
  const done=items.filter(x=>x.t.done).length,total=items.length;
  scroll.appendChild(el('div','',`<div class="eyebrow">${dateHeader()}</div><h1>Plan na dziś</h1>`));
  scroll.appendChild(el('div','planbar',`<div class="bar"><i class="a-grow" style="width:${total?done/total*100:0}%"></i></div><span>${done} z ${total}</span>`));
  const mini=el('div','minitiles');
  mini.appendChild(el('div','minitile gold a-up d1',icon('star',{size:17,fill:false,stroke:2.6,cls:'ic-gold'})+`<span>Misje ${done}/${total}</span>`));
  const n=streakDisplay();
  const m2=el('button','minitile amber a-up d2',icon('flame',{size:17,cls:'ic-flame'})+`<span>Seria ${n} ${pl(n,'dzień','dni','dni')}</span>`);
  m2.onclick=()=>go('streak');mini.appendChild(m2);
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
  sec('Aktywność — 8 tygodni','Wszystkie',()=>go('streak'));
  scroll.appendChild(heatmap());
  sec('Odznaki','Wszystkie',()=>toast('Pełna lista odznak dojdzie w kroku 8','lock'));
  const badges=el('div','badges a-up d3');
  [['star','gold','100 pojęć',all.length>=100],['flame','amber','7 dni',best>=7],['trophy','','Egzamin 90%',false]].forEach(([ic,tone,lab,on])=>{
    badges.appendChild(el('div','badge '+(on?tone:'lock'),icon(on?ic:'lock',{size:28,stroke:2.4,fill:on&&ic!=='trophy'})+lab));
  });
  scroll.appendChild(badges);
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

/* ============================================================ USTAWIENIA (własny przełącznik ruchu, DESIGN.md §2; reset postępów) */
function renderSettings(){
  const scroll=shell('settings',{cls:'settings',title:'Ustawienia',pills:false,back:()=>go('today')});
  scroll.appendChild(el('div','eyebrow sec','Nauka'));
  const c1=el('div','setcard a-up d1');
  c1.innerHTML=`<div class="setrow"><span class="t grow">Cel dzienny</span><span class="v acid">${daily().goal} XP</span></div><div class="setsep"></div>`;
  const rm=el('div','setrow','<div class="grow"><div class="t">Ogranicz animacje</div><div class="s">własny przełącznik, niezależny od ustawień telefonu</div></div>');
  const tg=el('button','toggle'+(META.reduceMotion?' on':''),'<i></i>');
  tg.setAttribute('role','switch');tg.setAttribute('aria-checked',String(!!META.reduceMotion));tg.setAttribute('aria-label','Ogranicz animacje');
  tg.onclick=()=>{META.reduceMotion=!META.reduceMotion;saveMeta();applyMotion();tg.classList.toggle('on',!!META.reduceMotion);tg.setAttribute('aria-checked',String(!!META.reduceMotion));};
  rm.appendChild(tg);c1.appendChild(rm);scroll.appendChild(c1);
  scroll.appendChild(el('div','eyebrow sec','Przedmioty'));
  const c2=el('div','setcard a-up d2');
  SUBJECTS.forEach((s,i)=>{
    if(i)c2.appendChild(el('div','setsep'));
    const r=el('button','setrow themed');r.style.setProperty('--accent',s.accent);if(s.onAccent)r.style.setProperty('--on-accent',s.onAccent);
    r.innerHTML=`${mono(initial(s.short||s.name),'solid xs')}<span class="t grow">${s.short||s.name}</span>${icon('chevron-right',{size:18,cls:'chev'})}`;
    r.onclick=()=>openSubject(s.id);c2.appendChild(r);
  });
  if(SUBJECTS.length)c2.appendChild(el('div','setsep'));
  const allS=el('button','setrow',icon('grid',{size:20,stroke:2.4})+'<span class="t grow">Wszystkie przedmioty</span>'+icon('chevron-right',{size:18,cls:'chev'}));
  allS.onclick=()=>go('subjects');c2.appendChild(allS);c2.appendChild(el('div','setsep'));
  const add=el('button','setrow acid',icon('plus',{size:20,stroke:3})+'<span class="t grow">Dodaj materiał</span>');
  add.onclick=()=>openQuickAdd();c2.appendChild(add);
  scroll.appendChild(c2);
  scroll.appendChild(el('div','eyebrow sec','Dane'));
  const reset=el('button','pill danger a-up d3',icon('refresh',{size:18,stroke:2.8})+' wyzeruj postępy');
  reset.onclick=()=>{
    if(!confirm('Na pewno? Skasuje XP, gwiazdki i plan dnia. Seria zostaje.'))return;
    PROGRESS={};saveProgress();qState=null;fState=null;
    renderSettings();toast('Postępy wyzerowane','refresh');
  };
  scroll.appendChild(reset);
  scroll.appendChild(el('div','version','Nauka 2.0 · legacy · krok 6'));
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
    const ic=d.st==='done'?icon('check',{size:19,stroke:3.6}):(d.st==='todaydone'||d.st==='today')?icon('flame',{size:18}):'';
    return `<div class="day ${d.st}"><div class="dot a-up d${Math.min(6,i+1)}">${ic}</div><span>${d.lab}</span></div>`;
  }).join('')+'</div>';
  scroll.appendChild(week);
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
const HEARTS_MAX=5, HEART_MS=30*60*1000, HEART_REV=10;
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
    ${q.e?`<div class="sbox"><div class="lbl">Dlaczego</div><div>${q.e}</div></div>`:''}
    <button class="pill" id="snext" data-primary>DALEJ</button>`);
  s.querySelector('#snext').onclick=()=>{if(!advOk())return;closeSheet();o.onNext();};
  return s;
}
/* źle: „Nie tym razem”, poprawna litera, wyjaśnienie, [WYJAŚNIJ INACZEJ] DALEJ. o={onNext, onCards?, sub?, subj?, lv?} */
function sheetBad(q,o){
  const sub=o.sub!=null?o.sub:(q.c!=null?'Poprawna: odpowiedź '+keys[q.c]:'');
  const s=openSheet('bad',`<div class="srow"><div class="sico">${icon('close',{size:24,stroke:3.6})}</div>
    <div class="grow"><div class="st">Nie tym razem</div>${sub?`<div class="ss">${sub}</div>`:''}</div></div>
    ${q.e?`<div class="sbox"><div class="lbl">Zapamiętaj</div><div>${q.e}</div></div>`:''}
    <div class="sbtns">${q.q?'<button class="pill ghost red" id="sexpl">WYJAŚNIJ INACZEJ</button>':''}<button class="pill red" id="snext" data-primary>DALEJ</button></div>`);
  s.querySelector('#snext').onclick=()=>{if(!advOk())return;closeSheet();o.onNext();};
  const x=s.querySelector('#sexpl');if(x)x.onclick=()=>openExplain(q,o);
  return s;
}
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
    <div class="sbtns">${o.onCards?'<button class="pill ghost" id="scards">Do fiszek</button>':''}<button class="pill cyan" id="sok" data-primary>ROZUMIEM</button></div>`);
  s.querySelector('#sok').onclick=()=>{sheetBad(q,o);};
  const c=s.querySelector('#scards');if(c)c.onclick=()=>{closeSheet();o.onCards();};
  return s;
}
/* Koniec żyć (NoHearts.html): licznik do następnego życia, „Powtórz N fiszek” (+1 życie), „Wróć później”.
   inLesson=true → lekcja przerwana (poziom niezaliczony); gemy/„Uzupełnij wszystkie” dojdą w kroku 8. */
function showNoHearts(o){
  o=o||{};
  const s=openSheet('nohearts',`<div class="nhh">${[0,1,2,3,4].map(()=>icon('heart',{size:30,fill:false,stroke:2.2})).join('')}</div>
    <div class="nht"><div class="st a-pop d1">Koniec żyć</div><div class="ss">Kolejne życie wraca za <b class="a-blink" id="nheta">${etaText(heartEta())}</b>. Możesz też odzyskać je od razu.</div></div>
    <button class="nhcard a-glow" id="nhrev">${'<div class="ico">'+icon('refresh',{size:24,stroke:2.8})+'</div>'}<div class="grow"><div class="t">Powtórz ${HEART_REV} fiszek</div><div class="s">odzyskujesz jedno życie · za darmo</div></div>${icon('chevron-right',{size:20})}</button>
    <button class="pill text" id="nhlater" data-primary>WRÓĆ PÓŹNIEJ</button>`);
  sheetBack(); // tło przyciemniające pod panelem (po openSheet, bo closeSheet je zdejmuje)
  const leave=()=>{closeSheet();if(o.inLesson)closeLesson();};
  s.querySelector('#nhlater').onclick=leave;
  s.querySelector('#nhrev').onclick=()=>{hearts().quest=HEART_REV;saveProgress();closeSheet();goCards(o.lv);toast(`Przejrzyj ${HEART_REV} fiszek — wraca życie`,'heart');};
  nhInt=setInterval(()=>{const e=document.getElementById('nheta');if(!e)return clearInterval(nhInt);if(hearts().n>0){leave();toast('Życie wróciło','heart');return;}e.textContent=etaText(heartEta());},1000);
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
  const qs=shuffle((lv.quiz||[]).map((q,qi)=>({kind:'quiz',q,qi}))).slice(0,Math.min(6,(lv.quiz||[]).length));
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
  e.due=addDays(todayStr(),SRS_INT[e.box]);S[k]=e;saveProgress();return e;
}
/* klucz → dane: {s, lv, kind:'card'|'quiz', c|q, idx, key}; wpisy po nieistniejących przedmiotach/poziomach są pomijane */
function srsResolve(k){
  const p=k.split(':');const s=SUBJECTS.find(x=>x.id===p[0]);if(!s)return null;const lv=s.levels.find(l=>l.id===p[1]);if(!lv)return null;const item=p.slice(2).join(':');
  if(item[0]==='q'){const idx=+item.slice(1);const q=(lv.quiz||[])[idx];return q?{s,lv,kind:'quiz',q,idx,key:k}:null;}
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
  tickDaily(it.s.id,'review',1);
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
      if(ok){body.appendChild(confetti(4));sheetOk(q,{xp:3,mult:1,combo:0,onNext:next});}
      else sheetBad(q,{onNext:next,subj:it.s,lv:it.lv,onCards:()=>{rvState=null;openSubject(it.s.id,'fiszki',()=>{fState={subj:it.s.id,lvl:it.lv.id,idx:0,flipped:false};});}});
    }});
    body.appendChild(blk.body);const foot=el('div','lessonfoot');foot.appendChild(blk.foot);L.appendChild(foot);
  }
}
/* koniec powtórki (FlashcardsDone.html): pierścień celności, umiem / do powtórki / +XP, lista „wracają dziś” albo najbliższy termin, karta serii */
function finishReview(L){
  const rv=rvState;closeSheet();keyFn=null;
  const total=rv.ok+rv.bad;const pct=total?Math.round(rv.ok/total*100):0;
  // plan dnia: „Powtórka” to jedna czynność — zalicz wiersze przedmiotów z sesji, a gdy żaden nie pasuje, pierwszy oczekujący wiersz Powtórki
  let doneAny=false;rv.subs.forEach(sid=>{if(completeDaily(sid,'review'))doneAny=true;});
  if(!doneAny&&total){const t=daily().tasks.find(x=>!x.done&&/:review$/.test(x.id));if(t)completeDaily(t.id.split(':')[0],'review');}
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
  const wrong=rv.wrong.slice();main.onclick=wrong.length?()=>startReview(wrong):()=>go('review');
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
  row.appendChild(heartsPill({iconBeat:true}));
  band.appendChild(row);
  const tabs=el('div','subtabs');
  [['path','map','Ścieżka'],['fiszki','cards','Fiszki'],['quiz','brain','Quiz'],['cwicz','edit','Ćwiczenia'],['egzamin','target','Egzamin']].forEach(([k,ic,lab])=>{
    const b=el('button','subtab'+(curTab===k?' active':''),icon(ic,{size:15})+'<span>'+lab+'</span>');
    if(curTab===k)b.setAttribute('aria-current','page');
    b.onclick=()=>{curTab=k;renderSubject();};
    tabs.appendChild(b);
  });
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
  wrap.appendChild(el('div','chapter a-up',`<i></i><div class="grow"><div class="eyebrow">Rozdział ${all?s.levels.length:curIdx+1}</div><div class="t">${all?'Wszystko zaliczone':noEmoji(s.levels[curIdx].title)}</div></div>${icon('list',{size:18})}`));
  const path=el('div','path');
  const items=[];
  s.levels.forEach((lv,i)=>{items.push({lv,i});if((i+1)%3===0)items.push({chest:true,after:i});});
  const xOf=k=>PATH_OFF[k%PATH_OFF.length];
  const doneOf=it=>it.chest?isDone(s.levels[it.after]):isDone(it.lv);
  path.appendChild(el('div','connector done first'));
  items.forEach((it,k)=>{
    const x=xOf(k);
    if(k>0){const c=el('div','connector'+(doneOf(items[k-1])?' done':''));c.style.setProperty('--x',((xOf(k-1)+x)/2)+'px');path.appendChild(c);}
    const node=el('div','pathnode');node.style.setProperty('--x',x+'px');
    if(it.chest){
      const open=doneOf(it);
      const btn=el('button','nodebtn node-chest a-sway',icon('chest',{size:32,stroke:2.4}));
      btn.setAttribute('aria-label','Skrzynia: '+(open?'do otwarcia':'po zaliczeniu poziomu '+(it.after+1)));
      btn.onclick=()=>toast(open?'Skrzynia: klejnoty dojdą w kroku 8':'Skrzynia otworzy się po zaliczeniu poziomu '+(it.after+1),open?'gem':'lock');
      node.appendChild(btn);node.appendChild(el('div','nodelabel gold','Skrzynia'));
    }else{
      const lv=it.lv,i=it.i;const unlocked=levelUnlocked(s,i),done=isDone(lv),stars=(st.levels[lv.id]||{}).stars||0;
      const cur=unlocked&&!done;
      if(cur){node.classList.add('cur');node.appendChild(el('div','bubble a-bob','ZACZNIJ'));}
      const btn=el('button','nodebtn '+(done?'node-done':cur?'node-open a-pulse':'node-lock'),done?icon('check',{size:34,stroke:3.4}):cur?icon('bolt',{size:40}):icon('lock',{size:28}));
      btn.setAttribute('aria-label',(done?'Powtórz: ':cur?'Zacznij: ':'Zablokowane: ')+lv.title);
      if(done)btn.innerHTML+=`<span class="stars">${starRow(stars,12)}</span>`;
      btn.onclick=unlocked?()=>startLesson(lv):()=>toast('Najpierw zalicz poprzedni poziom','lock');
      node.appendChild(btn);
      node.appendChild(el('div','nodelabel'+(cur?' cur':done?'':' lock'),noEmoji(lv.title)));
    }
    path.appendChild(node);
  });
  wrap.appendChild(path);sc.innerHTML='';sc.appendChild(wrap);
  // auto-scroll do bieżącego węzła (na środek ekranu)
  requestAnimationFrame(()=>{const n=wrap.querySelector('.node-open');if(!n)return;const r=n.getBoundingClientRect(),w=wrap.getBoundingClientRect();wrap.scrollTop=Math.max(0,r.top-w.top+wrap.scrollTop-w.height/2+r.height/2);});
}

/* ---------- LEKCJA: roladka (Lesson.html) -> quiz z panelem dobrze/źle, życiami i combo -> LevelComplete ---------- */
let lessonState=null;
function startLesson(lv){
  if(hearts().n<=0){showNoHearts({inLesson:false,lv});return;} // bez życia nie zaczynasz
  lessonState={lv,phase:(lv.feed||[]).length?'feed':'quiz',feedIdx:0,items:levelSession(lv),qIdx:0,score:0,answered:false,combo:0,maxCombo:0,broken:false,xp:0,marks:[]};
  const L=document.getElementById('lesson');L.classList.add('open');
  renderLesson();
}
function closeLesson(){closeSheet();keyFn=null;taskCleanup();lessonState=null;const L=document.getElementById('lesson');if(L)L.classList.remove('open');renderSubject();}
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
      <div class="ftitle">${f.title}</div><div class="fbody">${f.body}</div>
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
    const onAnswer=(ok,fb)=>{ // fb = {e, sub} — dla pytania quizu to samo pytanie (e + litera z c)
      ls.answered=true;ls.broken=false;
      const next=()=>{ls.qIdx++;renderLesson();};
      if(ok){
        ls.score++;ls.combo++;ls.maxCombo=Math.max(ls.maxCombo,ls.combo);
        const m=comboMult(ls.combo),xp=(it.kind==='task'?TASK_XP:QUIZ_XP)*m;ls.xp+=xp;addXP(s.id,xp);
        body.appendChild(confetti(4));
        sheetOk(fb,{xp,mult:m,combo:ls.combo,onNext:next});
      }else{
        ls.broken=ls.combo>=2;ls.combo=0;ls.marks[stepIdx]='bad';
        loseHeart();
        const hp=L.querySelector('.hearts');if(hp){hp.classList.add('a-beat');hp.appendChild(el('span','minus a-blink','−1'));}
        const seg=L.querySelectorAll('.segbar i')[stepIdx];if(seg)seg.className='bad';
        sheetBad(fb,{sub:fb.sub,subj:s,lv,onNext:()=>{if(hearts().n<=0)showNoHearts({inLesson:true,lv});else next();},onCards:()=>goCards(lv)});
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
  let bonus=0;
  if(passed){
    st.levels[lv.id]={done:true,stars:Math.max(stars,prev.stars||0),best:Math.max(pct,prev.best||0)};
    if(!prev.done){bonus=15;addXP(s.id,15);}
    saveProgress();
    completeDaily(s.id,'lesson',lv.id);
  }
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
  const next=(known)=>{if(!list.length)return;srsTouch(s.id,c.lid,c.i,known);if(known){addXP(s.id,2);toast('+2 XP','check');}tickDaily(s.id,'review',1);heartReview();fState.flipped=false;fState.idx=(fState.idx+1)%Math.max(1,list.length);renderFiszki(sc);};
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
    qState.list = qState.lvl==='all'?shuffle(allQuiz(s)):shuffle((s.levels.find(l=>l.id===qState.lvl).quiz||[]));
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
    if(ok){qState.score++;addXP(s.id,3);wrap.appendChild(confetti(4));sheetOk(q,{xp:3,mult:1,combo:0,onNext:next});}
    else sheetBad(q,{onNext:next,subj:s,lv:s.levels.find(l=>l.id===q.lid),onCards:()=>goCards(s.levels.find(l=>l.id===q.lid))});
  }});
  wrap.appendChild(qb.body);wrap.appendChild(qb.foot);
  sc.innerHTML='';sc.appendChild(wrap);
}

/* ---------- EGZAMIN ---------- */
let exState=null,exInt=null;
function fmt(s){const m=Math.floor(s/60),x=s%60;return m+':'+String(x).padStart(2,'0');}
function exGrade(s,pct){
  const sc=s.grading&&s.grading.scale; // [[min,label],...] malejąco
  if(sc){for(const[min,lab]of sc){if(pct>=min)return lab;}return s.grading.failLabel||'2 — niezaliczone';}
  if(pct>=90)return'5';if(pct>=70)return'4';if(pct>=50)return'3';return'2 — niezaliczone';
}
function renderEgzamin(sc){
  const s=current;clearInterval(exInt);exState=null;
  const wrap=el('div','scroll');
  const ALL=allQuiz(s).length;
  const N=Math.min(20,ALL);
  const lim=(s.grading&&s.grading.examMin)||20;
  const fullLim=Math.max(lim,Math.ceil(ALL*0.75)); // ~45s na pytanie
  wrap.innerHTML=`<div class="result">${bigTile('','target')}<h2>Egzamin</h2>
    <div class="specs"><div class="spec">${N}<small>losowych</small></div><div class="spec">${lim}:00<small>na czas</small></div><div class="spec">${(s.grading&&s.grading.pass)||50}%<small>zalicza</small></div></div>
    <p>Bez podpowiedzi w trakcie. Na końcu % i ocena wg siatki + przegląd błędów.</p>
    <button class="pill" id="exstart">${icon('bolt',{size:18})} Symulacja — ${N} losowych pytań</button>
    <button class="pill" id="exfull" style="margin-top:10px">${icon('list',{size:18})} Test końcowy — wszystkie ${ALL} pytań</button>
    <p style="font-size:13px;margin-top:6px">Test końcowy = każde pytanie z przedmiotu, w losowej kolejności (${fullLim}:00).</p></div>`;
  sc.innerHTML='';sc.appendChild(wrap);
  document.getElementById('exstart').onclick=()=>beginExam(sc,N,lim*60);
  document.getElementById('exfull').onclick=()=>beginExam(sc,ALL,fullLim*60);
}
function beginExam(sc,N,limit){
  const s=current;
  exState={pool:shuffle(allQuiz(s)).slice(0,N),idx:0,pick:[],left:limit};
  exState.pick=new Array(exState.pool.length).fill(null);
  clearInterval(exInt);
  exInt=setInterval(()=>{exState.left--;const t=document.getElementById('extimer');if(t){t.lastChild.textContent=fmt(exState.left);t.classList.toggle('warn',exState.left<=60);}if(exState.left<=0){clearInterval(exInt);examFinish(sc);}},1000);
  renderExamQ(sc);
}
function renderExamQ(sc){
  const s=current;const ex=exState;
  if(ex.idx>=ex.pool.length)return examFinish(sc);
  const q=ex.pool[ex.idx];const sel=ex.pick[ex.idx];const last=ex.idx+1>=ex.pool.length;
  const wrap=el('div','scroll');
  wrap.innerHTML=`<div class="examhead"><div class="counter">Pytanie ${ex.idx+1}/${ex.pool.length}</div><div class="timer" id="extimer">${icon('clock',{size:16})}<span>${fmt(ex.left)}</span></div></div>
    <div class="progressrow"><div class="bar"><i style="width:${ex.idx/ex.pool.length*100}%"></i></div></div>
    <div class="qcard"><span class="tag">${q.lvl||''}</span><div class="qq">${q.q}</div>
      <div class="opts">${q.a.map((o,i)=>`<button class="opt${sel===i?' sel':''}" data-i="${i}"><span class="k">${keys[i]}</span><span>${o}</span></button>`).join('')}</div>
      <div style="display:flex;gap:10px;margin-top:16px">
        ${ex.idx>0?'<button class="pill ghost" style="flex:1" id="exprev">'+LBL.back+'Wstecz</button>':''}
        <button class="pill" style="flex:2" id="exnext">${last?'Zakończ i sprawdź '+icon('flag',{size:18}):LBL.next}</button></div></div>`;
  sc.innerHTML='';sc.appendChild(wrap);
  wrap.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{ex.pick[ex.idx]=+o.dataset.i;wrap.querySelectorAll('.opt').forEach(x=>x.classList.toggle('sel',+x.dataset.i===ex.pick[ex.idx]));});
  const nx=document.getElementById('exnext');nx.onclick=()=>{if(last)examFinish(sc);else{ex.idx++;renderExamQ(sc);}};
  const pv=document.getElementById('exprev');if(pv)pv.onclick=()=>{ex.idx--;renderExamQ(sc);};
}
function examFinish(sc){
  clearInterval(exInt);const s=current;const ex=exState;
  let correct=0;const wrong=[];
  ex.pool.forEach((q,i)=>{if(ex.pick[i]===q.c)correct++;else wrong.push({q,sel:ex.pick[i]});});
  const pct=Math.round(correct/ex.pool.length*100);
  const grade=exGrade(s,pct);const pass=(s.grading&&s.grading.pass)||50;
  const kind=pct>=90?'gold':pct>=70?'hot':pct>=pass?'ok':'fail';
  addXP(s.id,correct*3);
  completeDaily(s.id,'exam');
  const rev = wrong.length? wrong.map(w=>`<div class="ritem"><div class="rq">${w.q.q}</div>
      <div class="rbad">Twoja: ${w.sel==null?'— (brak)':keys[w.sel]+'. '+w.q.a[w.sel]}</div>
      <div class="rgood">Dobra: ${keys[w.q.c]}. ${w.q.a[w.q.c]}</div>
      <div class="rsrc">${w.q.lvl||''} · ${w.q.e||''}</div></div>`).join('') : '<div class="ritem rgood">'+icon('check',{size:16,stroke:3.4})+' Bez błędów.</div>';
  const wrap=el('div','scroll');
  wrap.innerHTML=`<div class="result">${bigTile(kind)}<h2>Ocena: ${grade}</h2>
    <div class="score">Trafione <b>${correct}/${ex.pool.length}</b> (${pct}%)</div>
    <p>${pct>=pass?'Zdane.':'Poniżej progu — wróć do ścieżki i fiszek.'}</p>
    <button class="pill" id="exagain">${LBL.again}</button></div>
    <div class="review"><h3>Przegląd błędów (${wrong.length})</h3>${rev}</div>`;
  sc.innerHTML='';sc.appendChild(wrap);
  document.getElementById('exagain').onclick=()=>renderEgzamin(sc);
  if(pct>=pass)toast('Zdane, ocena '+grade,'trophy');else toast('Niezaliczone','x-circle');
}

/* ---------- INFO ---------- */
function renderInfo(sc){
  const s=current;const wrap=el('div','scroll');
  wrap.innerHTML=`<div class="hero" style="padding-bottom:8px"><h1>${mono(initial(s.short||s.name),'sm')}<span>${s.name}</span></h1><p>${s.tagline||''}</p></div>${s.info||'<div class="zbox"><p>Brak dodatkowych informacji.</p></div>'}`;
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

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded',()=>{
  app=document.getElementById('app');
  applyMotion();
  // klawiatura (lekcja, quiz, panele): jeden nasłuch, widok podstawia keyFn; pola tekstowe (ćwiczenia) pomijane
  document.addEventListener('keydown',e=>{if(!keyFn)return;const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'))return;keyFn(e);});
  if(!SUBJECTS.length)return renderEmpty();
  go('today');
});
})();
