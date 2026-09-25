/* ============================================================
   NAUKA — silnik wieloprzedmiotowej platformy do nauki
   Dane przedmiotów rejestrują się w window.SUBJECTS (patrz data/*.js)
   Tryby: Ścieżka (Duolingo) + Fiszki + Quiz + Egzamin + Info
   Widoki główne (krok 3): Dziś (plan dnia) · Przedmioty · Profil · Ustawienia · Seria
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
  upload:{d:'M12 16V4M8 8l4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',w:2.4}
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
function initial(str){const m=String(str||'').match(/[\p{L}\p{N}]/u);return m?m[0].toUpperCase():'?';}
function mono(txt,cls){return '<div class="mono'+(cls?' '+cls:'')+'" aria-hidden="true">'+txt+'</div>';}
/* 3 gwiazdki: zdobyte = pełne złote, reszta = kontur */
function starRow(nStars,size){return [0,1,2].map(i=>icon('star',{size:size||12,fill:i<nStars,stroke:2,cls:i<nStars?'ic-gold':'ic-dim'})).join('');}
/* duży kafel wyniku (.result .big): gold/hot/ok/fail albo '' = kolor przedmiotu */
const BIG_IC={gold:'trophy',hot:'flame',ok:'check',fail:'x-circle'};
function bigTile(kind,ic){return '<div class="big'+(kind?' '+kind:'')+'">'+icon(ic||BIG_IC[kind]||'check',{size:60,stroke:3.2})+'</div>';}
/* etykiety przycisków z ikoną (spacja: w block-layout zostaje odstęp, flex ją ignoruje) */
const LBL={
  next:'dalej '+icon('chevron-right',{size:18,stroke:3}),
  result:'wynik '+icon('flag',{size:18}),
  check:'sprawdź '+icon('check',{size:18,stroke:3.4}),
  again:'jeszcze raz '+icon('refresh',{size:18,stroke:2.8}),
  back:icon('back',{size:18,stroke:3})+' '
};
const TOAST_TONE={check:'acid',flame:'flame',close:'red','x-circle':'red',lock:'muted',info:'cyan',trophy:'gold',bolt:'gold'};

function toast(t,ic){const box=document.getElementById('toast');if(!box)return;box.innerHTML=ic?icon(ic,{size:16,cls:'ic-'+(TOAST_TONE[ic]||'acid')}):'';const s=document.createElement('span');s.textContent=t;box.appendChild(s);box.classList.add('show');clearTimeout(box._t);box._t=setTimeout(()=>box.classList.remove('show'),1500);}
function addXP(id,n){const s=subjState(id);s.xp+=n;const d=daily();d.xp+=n;saveProgress();const ext=touchStreak();updateXP();updateStreakUI();if(ext&&META.streak>1)setTimeout(()=>toast('seria '+META.streak+' dni z rzędu!','flame'),1600);}
function updateXP(){const x=document.getElementById('xpNum');if(x&&current)x.textContent=subjState(current.id).xp;}
function updateStreakUI(){const n=streakDisplay();document.querySelectorAll('[id="streakNum"]').forEach(e=>e.textContent=n);}

/* pula wszystkich elementów danego przedmiotu (ze wszystkich poziomów) */
function allCards(s){return s.levels.flatMap(l=>(l.flashcards||[]).map(c=>({...c,lvl:l.title})));}
function allQuiz(s){return s.levels.flatMap(l=>(l.quiz||[]).map(q=>({...q,lvl:l.title})));}
function allFeed(s){return s.levels.flatMap(l=>(l.feed||[]).map(f=>({...f,lvl:l.title})));}

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
const VIEWS={today:renderToday,subjects:renderSubjects,profile:renderProfile,settings:renderSettings,streak:renderStreak};
let view='today';
function go(v){
  view=VIEWS[v]?v:'today';
  current=null;applyTheme(null);
  try{clearInterval(cwInt);clearInterval(exInt);}catch(e){}
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
  if(kind==='lesson'){if(!lv)return null;const nf=(lv.feed||[]).length,nq=(lv.quiz||[]).length;
    return {...base,icon:'book',title:'Roladka — '+lv.title,sub:`${nf} ${pl(nf,'dawka','dawki','dawek')} · ${nq} ${pl(nq,'pytanie','pytania','pytań')} · +15`,go:openAt('path')};}
  if(kind==='review'){const n=t.need||12,p=t.prog||0;
    return {...base,icon:'cards',title:`Powtórka — ${n} ${pl(n,'fiszka','fiszki','fiszek')}`,sub:p?`${p} z ${n} przejrzane · +20`:`${short} · ${Math.max(1,Math.round(n/4))} min · +20`,go:openAt('fiszki')};}
  if(kind==='quiz'){if(!lv)return null;const n=(lv.quiz||[]).length,m=Math.max(1,Math.round(n*0.5));
    return {...base,icon:'question',title:'Quiz — '+lv.title,sub:`${n} ${pl(n,'pytanie','pytania','pytań')} · ${short} · ${m} min · +25`,
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
  setTimeout(()=>toast('plan dnia: +'+r+'xp','bolt'),3200);
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
  [['today','home','Dziś'],['subjects','grid','Przedmioty'],['profile','user','Profil'],['settings','settings','Ustawienia']].forEach(([k,ic,lab])=>{
    const b=el('button',k===active?'active':'',icon(ic,{size:24,stroke:2.4})+'<span>'+lab+'</span>');
    if(k===active)b.setAttribute('aria-current','page');
    b.onclick=()=>go(k);nav.appendChild(b);
  });
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
function addHint(){return '<div class="subjemoji">'+icon('plus',{size:26,stroke:3})+'</div><div>Kolejny przedmiot?<br><span class="hint">Dodaj plik w <b>data/</b> (patrz README) — pojawi się tutaj. Kreator przedmiotów dojdzie w kolejnym kroku.</span></div>';}
function toggleAddHint(after){
  const n=after.nextElementSibling;
  if(n&&n.classList.contains('addcard')){n.remove();return;}
  const h=el('div','addcard a-up',addHint());
  after.insertAdjacentElement('afterend',h);
  try{h.scrollIntoView({block:'nearest',behavior:'smooth'});}catch(e){}
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
    const a=el('button','subjtile add',`<div class="mono">${icon('plus',{size:22,stroke:3,cls:'a-bob'})}</div><div class="name">Dodaj<br>przedmiot</div>`);
    a.setAttribute('aria-label','Dodaj przedmiot');a.onclick=()=>toggleAddHint(grid);grid.appendChild(a);
  }
  return grid;
}
/* karta „Plan na dziś”: zrobione (przekreślone, check), bieżące (tint przedmiotu, pulsujący kafel), późniejsze (wyciszone) */
function renderPlan(items){
  const card=el('div','plan a-up d2');
  if(!items.length){card.innerHTML=`<div class="plan-row later"><div class="plan-tile">${icon('bulb',{size:18})}</div><div class="pt"><div class="t">Brak zadań na dziś</div><div class="s">dodaj przedmiot, a plan ułoży się sam</div></div></div>`;return card;}
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
  scroll.appendChild(el('div','prof',`<div class="avatar a-pop">${icon('user',{size:34,stroke:2.6})}</div>
    <div class="pmeta"><h2>Twój profil</h2><div class="s">lokalnie, bez konta</div>
    <div class="planbar"><div class="bar"><i class="a-grow d2" style="width:${lvlPct}%"></i></div><span>lvl ${lvlNum}</span></div></div>`));
  const stats=el('div','grid2 stats');
  const stat=(cls,ic,k,v,s,onclick)=>{const d=el(onclick?'button':'div','stat a-up '+cls,`<div class="k">${ic}<span>${k}</span></div><div class="v">${v}</div><div class="s">${s}</div>`);if(onclick)d.onclick=onclick;stats.appendChild(d);};
  stat('d1',icon('flame',{size:16,cls:'ic-flame a-beat'}),'Seria',`${n} ${pl(n,'dzień','dni','dni')}`,'rekord '+best,()=>go('streak'));
  stat('d2',icon('bolt',{size:16,cls:'ic-gold'}),'XP łącznie',fmtNum(tot),'+'+daily().xp+' dzisiaj');
  stat('d3',icon('check',{size:16,stroke:2.8,cls:'ic-acid'}),'Poziomy',lvls,'z '+lvTotal+' zaliczone');
  stat('d4',icon('grid',{size:16,cls:'ic-cyan'}),'Przedmioty',started.length,'z '+SUBJECTS.length+' zaczęte');
  scroll.appendChild(stats);
  scroll.appendChild(el('div','eyebrow sec','XP w przedmiotach'));
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
  const add=el('button','setrow acid',icon('plus',{size:20,stroke:3})+'<span class="t grow">Dodaj przedmiot</span>');
  add.onclick=()=>toast('Dodaj plik w data/ — patrz README','info');c2.appendChild(add);
  scroll.appendChild(c2);
  scroll.appendChild(el('div','eyebrow sec','Dane'));
  const reset=el('button','pill danger a-up d3',icon('refresh',{size:18,stroke:2.8})+' wyzeruj postępy');
  reset.onclick=()=>{
    if(!confirm('Na pewno? Skasuje XP, gwiazdki i plan dnia. Seria zostaje.'))return;
    PROGRESS={};saveProgress();qState=null;fState=null;
    renderSettings();toast('postępy wyzerowane','refresh');
  };
  scroll.appendChild(reset);
  scroll.appendChild(el('div','version','Nauka 2.0 · legacy · krok 3'));
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
  const b=el('button','pill amber a-glow','wracam do nauki');b.onclick=()=>go('today');foot.appendChild(b);
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
  const steps=[['Wrzucasz prezentacje i notatki','PDF, PPTX, zdjęcia, wklejony tekst'],['Powstają poziomy, fiszki i pytania','możesz wszystko poprawić przed startem'],['Uczysz się po 10 minut dziennie','materiał wraca tuż przed zapomnieniem']];
  scroll.innerHTML=`<div class="logo brand">NAUKA<span class="g">.</span></div>
    <div class="art"><div class="art-a a-sway"></div><div class="art-b a-sway d2"></div><div class="art-c a-bob">${icon('upload',{size:58,stroke:2.4})}</div></div>
    <div class="a-up d1"><h1>Zacznij od pierwszego przedmiotu</h1><p>Wrzuć materiały z zajęć. Reszta zrobi się sama.</p></div>
    <div class="steps">${steps.map((s,i)=>`<div class="step a-up d${i+2}"><div class="num">${i+1}</div><div><div class="t">${s[0]}</div><div class="s">${s[1]}</div></div></div>`).join('')}</div>
    <div class="efoot"><button class="pill a-glow" id="eadd">dodaj przedmiot</button></div>`;
  sc.appendChild(scroll);app.appendChild(sc);
  app.appendChild(el('div','toast',''));app.lastChild.id='toast';
  document.getElementById('eadd').onclick=()=>{
    const f=scroll.querySelector('.efoot');
    if(!f.previousElementSibling.classList.contains('addcard'))f.insertAdjacentElement('beforebegin',el('div','addcard a-up',addHint()));
    toast('Dodaj plik w data/ — patrz README','info');
  };
}

/* ============================================================ SUBJECT shell */
function openSubject(id,tab,setup){
  current=SUBJECTS.find(s=>s.id===id);
  if(!current)return go('today');
  applyTheme(current);
  curTab=tab||'path';
  if(setup)setup();
  renderSubject();
}
function renderSubject(){
  const s=current;
  try{clearInterval(cwInt);clearInterval(exInt);}catch(e){}
  app.innerHTML='';
  const top=el('div','topbar');
  const back=el('button','backbtn',icon('back',{size:20,stroke:3}));back.setAttribute('aria-label','Wróć do planu dnia');back.onclick=()=>go('today');
  top.appendChild(back);
  top.appendChild(el('div','logo',`${mono(initial(s.short||s.name),'sm')}<span class="g">${s.short||s.name}</span>`));
  const pills=el('div','pills');
  pills.appendChild(el('div','streak',`${icon('flame',{size:16,cls:'ic-flame a-beat'})}<span id="streakNum">${streakDisplay()}</span> <small>dni</small>`));
  pills.appendChild(el('div','streak',`${icon('bolt',{size:16,cls:'ic-gold'})}<span id="xpNum">${subjState(s.id).xp}</span> <small>xp</small>`));
  top.appendChild(pills);
  app.appendChild(top);

  const tabs=el('div','subtabs');
  [['path','map','Ścieżka'],['fiszki','cards','Fiszki'],['quiz','brain','Quiz'],['cwicz','edit','Ćwiczenia'],['egzamin','target','Egzamin'],['info','info','Info']].forEach(([k,ic,lab])=>{
    const b=el('div','subtab'+(curTab===k?' active':''),icon(ic,{size:15})+'<span>'+lab+'</span>');
    b.onclick=()=>{curTab=k;renderSubject();};
    tabs.appendChild(b);
  });
  app.appendChild(tabs);

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

/* ---------- ŚCIEŻKA (Duolingo) ---------- */
function levelUnlocked(s,idx){
  if(idx===0)return true;
  const prev=s.levels[idx-1];
  const st=subjState(s.id);
  return !!(st.levels[prev.id]&&st.levels[prev.id].done);
}
function renderPath(sc){
  const s=current;const st=subjState(s.id);
  const wrap=el('div','scroll');
  const path=el('div','path');
  s.levels.forEach((lv,i)=>{
    if(i>0){const c=el('div','connector'+( (st.levels[s.levels[i-1].id]||{}).done?' done':''));path.appendChild(c);}
    const unlocked=levelUnlocked(s,i);
    const done=(st.levels[lv.id]||{}).done;
    const stars=(st.levels[lv.id]||{}).stars||0;
    const node=el('div','pathnode pathzig');
    const cls = done?'node-done':(unlocked?'node-open':'node-lock');
    const btn=el('button','nodebtn '+cls, done?icon('check',{size:34,stroke:3.4}):(unlocked?icon('bolt',{size:40}):icon('lock',{size:28})));
    btn.setAttribute('aria-label',(done?'Powtórz: ':unlocked?'Zacznij: ':'Zablokowane: ')+lv.title);
    if(done){btn.innerHTML+=`<span class="stars">${starRow(stars,12)}</span>`;}
    if(unlocked){btn.onclick=()=>startLesson(lv);}else{btn.onclick=()=>toast('Najpierw zalicz poprzedni poziom','lock');}
    node.appendChild(btn);
    node.appendChild(el('div','nodelabel',`${lv.title}<small>${(lv.quiz||[]).length} pytań · ${(lv.flashcards||[]).length} fiszek</small>`));
    path.appendChild(node);
  });
  wrap.appendChild(path);sc.appendChild(wrap);
}

/* ---------- LEKCJA: feed -> quiz bramka ---------- */
let lessonState=null;
function startLesson(lv){
  lessonState={lv,phase:'feed',feedIdx:0,quiz:shuffle(lv.quiz||[]).slice(0,Math.min(6,(lv.quiz||[]).length)),qIdx:0,score:0,answered:false};
  if(!lessonState.quiz.length){ // brak quizu — sam feed
    lessonState.quiz=[];
  }
  const L=document.getElementById('lesson');L.classList.add('open');
  renderLesson();
}
function closeLesson(){document.getElementById('lesson').classList.remove('open');renderSubject();}
function renderLesson(){
  const L=document.getElementById('lesson');const s=current;const ls=lessonState;const lv=ls.lv;
  const totalFeed=(lv.feed||[]).length;
  let progPct;
  if(ls.phase==='feed') progPct = totalFeed?ls.feedIdx/(totalFeed+ls.quiz.length)*100:0;
  else progPct = (totalFeed+ls.qIdx)/(totalFeed+ls.quiz.length)*100;
  L.innerHTML='';
  const head=el('div','lessonhead');
  const x=el('button','x',icon('close',{size:18,stroke:3}));x.setAttribute('aria-label','Zamknij');x.onclick=closeLesson;head.appendChild(x);
  head.appendChild(el('div','bar',`<i style="width:${progPct}%"></i>`));
  L.appendChild(head);
  const body=el('div','lessonbody');L.appendChild(body);

  if(ls.phase==='feed'){
    const f=lv.feed[ls.feedIdx];
    const fw=el('div');fw.style.cssText='flex:1;display:flex;flex-direction:column;justify-content:center;overflow-y:auto';
    const card=el('div','fcard');
    card.innerHTML=`<span class="tag">${lv.title} · ${ls.feedIdx+1}/${totalFeed}</span>
      <div class="ftitle">${f.title}</div><div class="fbody">${f.body}</div>
      ${f.real?`<div class="real"><span class="lbl">${icon('bulb',{size:14})}po ludzku</span>${f.real}</div>`:''}
      ${f.mnemo?`<div class="mnemo"><span class="lbl">${icon('bookmark',{size:14})}zapamiętaj</span>${f.mnemo}</div>`:''}`;
    fw.appendChild(card);body.appendChild(fw);
    const foot=el('div','lessonfoot');
    const b=el('button','pill', ls.feedIdx+1<totalFeed?LBL.next:(ls.quiz.length?'lecimy z quizem '+icon('brain',{size:18}):'zakończ '+icon('check',{size:18,stroke:3.4})));
    b.onclick=()=>{ if(ls.feedIdx+1<totalFeed){ls.feedIdx++;renderLesson();} else if(ls.quiz.length){ls.phase='quiz';renderLesson();} else finishLesson(); };
    foot.appendChild(b);L.appendChild(foot);
  } else if(ls.phase==='quiz'){
    if(ls.qIdx>=ls.quiz.length)return finishLesson();
    const q=ls.quiz[ls.qIdx];ls.answered=false;
    const qc=el('div','qcard');qc.style.cssText='flex:1;overflow-y:auto';
    qc.innerHTML=`<span class="tag">pytanie ${ls.qIdx+1}/${ls.quiz.length}</span>
      <div class="qq">${q.q}</div>
      <div class="opts">${q.a.map((o,i)=>`<button class="opt" data-i="${i}"><span class="k">${keys[i]}</span><span>${o}</span></button>`).join('')}</div>
      <div class="explain" id="lexp"><b>czemu:</b> ${q.e||''}</div>`;
    body.appendChild(qc);
    const foot=el('div','lessonfoot');
    const nb=el('button','pill qnext',LBL.next);nb.id='lnext';
    nb.onclick=()=>{ls.qIdx++;renderLesson();};
    foot.appendChild(nb);L.appendChild(foot);
    qc.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{
      if(ls.answered)return;ls.answered=true;const i=+o.dataset.i;
      qc.querySelectorAll('.opt').forEach(x=>{const xi=+x.dataset.i;if(xi===q.c)x.classList.add('correct');else if(xi===i)x.classList.add('wrong');else x.classList.add('dim');});
      if(i===q.c){ls.score++;addXP(s.id,5);toast('GIT +5xp','check');}else{toast('mid, czytaj wyjaśnienie','info');}
      document.getElementById('lexp').classList.add('show');
      const nx=document.getElementById('lnext');nx.classList.add('show');nx.innerHTML=(ls.qIdx+1>=ls.quiz.length)?'zobacz '+LBL.result:LBL.next;
    });
  }
}
function finishLesson(){
  const s=current;const ls=lessonState;const lv=ls.lv;
  const total=ls.quiz.length||1;const pct=ls.quiz.length?Math.round(ls.score/ls.quiz.length*100):100;
  const stars = pct>=90?3:(pct>=70?2:(pct>=50?1:0));
  const passed = ls.quiz.length?pct>=50:true;
  const st=subjState(s.id);const prev=st.levels[lv.id]||{};
  if(passed){
    st.levels[lv.id]={done:true,stars:Math.max(stars,prev.stars||0),best:Math.max(pct,prev.best||0)};
    if(!prev.done)addXP(s.id,15);
    saveProgress();
    completeDaily(s.id,'lesson',lv.id);
  }
  const L=document.getElementById('lesson');
  const kind = !passed?'fail':(pct>=90?'gold':pct>=70?'hot':'ok');
  const verdict = !passed?'Poniżej 50% — poziom niezaliczony. Przejedź feed jeszcze raz i spróbuj ponownie, dasz radę.':
    (pct>=90?'Mistrzostwo. Trzy gwiazdki, profesor by płakał ze szczęścia.':pct>=70?'Solidnie! Poziom zaliczony, lecimy dalej.':'Zaliczone na styk — wróć kiedyś po więcej gwiazdek.');
  L.innerHTML=`<div class="lessonhead"><button class="x" id="lx" aria-label="Zamknij">${icon('close',{size:18,stroke:3})}</button><div class="bar"><i style="width:100%"></i></div></div>
   <div class="lessonbody"><div class="result">
     ${bigTile(kind)}
     <h2>${lv.title}</h2>
     ${ls.quiz.length?`<div class="score">Trafione <b>${ls.score}/${ls.quiz.length}</b> (${pct}%) ${passed?'<span class="starrow">'+starRow(stars,18)+'</span>':''}</div>`:''}
     <p>${verdict}</p>
   </div></div>
   <div class="lessonfoot">${passed?'<button class="pill" id="lcont">dalej na ścieżkę '+icon('map',{size:18})+'</button>':'<button class="pill" id="lretry">spróbuj '+LBL.again+'</button>'}</div>`;
  document.getElementById('lx').onclick=closeLesson;
  const cont=document.getElementById('lcont');if(cont)cont.onclick=closeLesson;
  const retry=document.getElementById('lretry');if(retry)retry.onclick=()=>startLesson(lv);
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
  s.levels.forEach(l=>chips.appendChild(mk(l.id,l.title)));
  wrap.appendChild(chips);
  const list = fState.lvl==='all'?allCards(s):(s.levels.find(l=>l.id===fState.lvl).flashcards||[]).map(c=>({...c,lvl:s.levels.find(l=>l.id===fState.lvl).title}));
  if(fState.idx>=list.length)fState.idx=0;
  const c=list[fState.idx]||{t:'—',d:'Brak fiszek'};
  wrap.appendChild(el('div','progressrow',`<div class="bar"><i style="width:${list.length?fState.idx/list.length*100:0}%"></i></div><div class="counter">${list.length?fState.idx+1:0}/${list.length}</div>`));
  const flip=el('div','flip'+(fState.flipped?' flipped':''));flip.style.height='calc(100dvh - 320px)';
  flip.innerHTML=`<div class="flipinner">
    <div class="face front"><span class="tag">${c.lvl||''}</span><div class="term">${c.t}</div><div class="tapomat">tapnij = odpowiedź</div></div>
    <div class="face back"><span class="tag">odpowiedź</span><div class="deftxt">${c.d}</div><div class="tapomat">tapnij = wróć</div></div></div>`;
  flip.onclick=()=>{fState.flipped=!fState.flipped;flip.classList.toggle('flipped');};
  wrap.appendChild(flip);
  const btns=el('div','fbtns');
  const no=el('button','fbtn no',icon('refresh',{size:18,stroke:2.8})+' jeszcze nie');const yes=el('button','fbtn yes',icon('check',{size:18,stroke:3.4})+' umiem');
  const next=(known)=>{if(known){addXP(s.id,2);toast('+2xp','check');}tickDaily(s.id,'review',1);fState.flipped=false;fState.idx=(fState.idx+1)%Math.max(1,list.length);renderFiszki(sc);};
  no.onclick=()=>next(false);yes.onclick=()=>next(true);
  btns.appendChild(no);btns.appendChild(yes);wrap.appendChild(btns);
  sc.innerHTML='';sc.appendChild(wrap);
}

/* ---------- QUIZ (cały przedmiot, filtr po poziomach) ---------- */
let qState=null;
function renderQuiz(sc){
  const s=current;
  if(!qState||qState.subj!==s.id)qState={subj:s.id,lvl:'all',list:null,idx:0,score:0,answered:false};
  if(!qState.list){
    qState.list = qState.lvl==='all'?shuffle(allQuiz(s)):shuffle((s.levels.find(l=>l.id===qState.lvl).quiz||[]));
    qState.idx=0;qState.score=0;
  }
  const wrap=el('div','scroll');
  const chips=el('div','chips');
  const mk=(id,name)=>{const c=el('div','chip'+(qState.lvl===id?' active':''),name);c.onclick=()=>{qState.lvl=id;qState.list=null;renderQuiz(sc);};return c;};
  chips.appendChild(mk('all','Wszystko'));
  s.levels.forEach(l=>chips.appendChild(mk(l.id,l.title)));
  wrap.appendChild(chips);
  wrap.appendChild(el('div','progressrow',`<div class="bar"><i style="width:${qState.list.length?qState.idx/qState.list.length*100:0}%"></i></div><div class="counter">${Math.min(qState.idx+1,qState.list.length)}/${qState.list.length}</div>`));
  const card=el('div','qcard');
  if(qState.idx>=qState.list.length){
    const pct=qState.list.length?Math.round(qState.score/qState.list.length*100):0;
    if(qState.list.length)completeDaily(s.id,'quiz');
    card.innerHTML=`<div class="result">${bigTile(pct>=70?'hot':pct>=50?'ok':'fail')}<h2>Wynik</h2>
      <div class="score">Trafione <b>${qState.score}/${qState.list.length}</b> (${pct}%)</div>
      <p>${pct>=70?'Solidnie ogarniasz ten przedmiot.':pct>=50?'Spoko, ale przejedź jeszcze fiszki.':'Wróć do fiszek i ścieżki, potem tu wróć.'}</p>
      <button class="pill" id="qre">${LBL.again}</button></div>`;
    wrap.appendChild(card);sc.innerHTML='';sc.appendChild(wrap);
    document.getElementById('qre').onclick=()=>{qState.list=null;renderQuiz(sc);};
    return;
  }
  const q=qState.list[qState.idx];qState.answered=false;
  card.innerHTML=`<span class="tag">${q.lvl||''}</span><div class="qq">${q.q}</div>
    <div class="opts">${q.a.map((o,i)=>`<button class="opt" data-i="${i}"><span class="k">${keys[i]}</span><span>${o}</span></button>`).join('')}</div>
    <div class="explain" id="qexp"><b>czemu:</b> ${q.e||''}</div>
    <button class="pill qnext" id="qnext" style="margin-top:14px">${LBL.next}</button>`;
  wrap.appendChild(card);sc.innerHTML='';sc.appendChild(wrap);
  card.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{
    if(qState.answered)return;qState.answered=true;const i=+o.dataset.i;
    card.querySelectorAll('.opt').forEach(x=>{const xi=+x.dataset.i;if(xi===q.c)x.classList.add('correct');else if(xi===i)x.classList.add('wrong');else x.classList.add('dim');});
    if(i===q.c){qState.score++;addXP(s.id,3);toast('GIT +3xp','check');}else toast('mid','info');
    document.getElementById('qexp').classList.add('show');
    const n=document.getElementById('qnext');n.classList.add('show');n.innerHTML=(qState.idx+1>=qState.list.length)?LBL.result:LBL.next;
  });
  document.getElementById('qnext').onclick=()=>{qState.idx++;renderQuiz(sc);};
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
    <button class="pill" id="exstart">${icon('bolt',{size:18})} symulacja — ${N} losowych</button>
    <button class="pill" id="exfull" style="margin-top:10px">${icon('list',{size:18})} Test końcowy — WSZYSTKIE ${ALL} pytań</button>
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
        ${ex.idx>0?'<button class="pill ghost" style="flex:1" id="exprev">'+LBL.back+'wstecz</button>':''}
        <button class="pill" style="flex:2" id="exnext">${last?'zakończ i sprawdź '+icon('flag',{size:18}):LBL.next}</button></div></div>`;
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
      <div class="rsrc">${w.q.lvl||''} · ${w.q.e||''}</div></div>`).join('') : '<div class="ritem rgood">'+icon('check',{size:16,stroke:3.4})+' Zero błędów. Clean sweep.</div>';
  const wrap=el('div','scroll');
  wrap.innerHTML=`<div class="result">${bigTile(kind)}<h2>Ocena: ${grade}</h2>
    <div class="score">Trafione <b>${correct}/${ex.pool.length}</b> (${pct}%)</div>
    <p>${pct>=pass?'Zdane!':'Poniżej progu — wróć do ścieżki i fiszek.'}</p>
    <button class="pill" id="exagain">${LBL.again}</button></div>
    <div class="review"><h3>Przegląd błędów (${wrong.length})</h3>${rev}</div>`;
  sc.innerHTML='';sc.appendChild(wrap);
  document.getElementById('exagain').onclick=()=>renderEgzamin(sc);
  if(pct>=pass)toast('zdane! ocena '+grade,'trophy');else toast('niezaliczone','x-circle');
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
  clearInterval(cwInt);cw=null;
  const s=current;const wrap=el('div','scroll');
  const hub=el('div','exhub');
  const items = s.lang
   ? [['typing','edit','Wpisywanie','Po polsku → '+(s.short||'język')+'. Wpisz słowo z klawiatury.'],
      ['tiles','grid','Klocki — ułóż słowo','Poukładaj literki/wyrazy w poprawne słowo.'],
      ['match','link','Połącz w pary','Dopasuj słowo do tłumaczenia.']]
   : [['match','link','Połącz w pary','Dopasuj pojęcie do definicji.'],
      ['speed','bolt','Szybki quiz na czas','60 sekund — ile zdążysz trafić?'],
      ['typing','edit','Wpisz pojęcie','Z definicji wpisz właściwy termin.']];
  hub.appendChild(el('div','exprompt','Wybierz ćwiczenie'));
  items.forEach(([k,em,t,p])=>{
    const c=el('div','excard',`<div class="eemoji">${icon(em,{size:26,stroke:2.4})}</div><div class="emeta"><h3>${t}</h3><p>${p}</p></div>`);
    c.onclick=()=>{ if(k==='typing')cwStartTyping(sc); else if(k==='tiles')cwStartTiles(sc); else if(k==='match')cwStartMatch(sc); else cwStartSpeed(sc); };
    hub.appendChild(c);
  });
  wrap.appendChild(hub);sc.innerHTML='';sc.appendChild(wrap);
}
function cwBackBtn(sc){const b=el('button','pill ghost',LBL.back+'ćwiczenia');b.style.marginTop='12px';b.onclick=()=>renderCwicz(sc);return b;}
function cwResult(sc,kind,score,total,retry){
  clearInterval(cwInt);
  const wrap=el('div','scroll');const pct=total?Math.round(score/total*100):0;
  wrap.innerHTML=`<div class="result">${bigTile(kind)}<h2>Wynik</h2>
    <div class="score">Dobrze: <b>${score}/${total}</b> (${pct}%)</div>
    <p>${pct>=80?'Świetnie! Masz to w małym palcu.':pct>=50?'Niezłe, jeszcze runda i będzie czysto.':'Spoko, powtórz — od tego jest ćwiczenie.'}</p></div>`;
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
  card.innerHTML=`<span class="tag">${it.lvl||''}</span><div class="exprompt">przetłumacz / wpisz</div><div class="exq">${it.prompt}</div>
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
    if(ok){cw.score++;addXP(current.id,4);toast('GIT +4xp','check');fb.className='exfb ok show';fb.innerHTML=icon('check',{size:16,stroke:3.4,cls:'ic-acid'})+' Dobrze: <b>'+it.ans+'</b>';}
    else{toast('prawie!');fb.className='exfb bad show';fb.innerHTML='Poprawnie: <b>'+it.ans+'</b>';}
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
  card.innerHTML=`<span class="tag">${it.lvl||''}</span><div class="exprompt">ułóż: ${it.prompt}</div>
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
    if(ok){cw.score++;addXP(current.id,4);toast('GIT +4xp','check');fb.className='exfb ok show';fb.innerHTML=icon('check',{size:16,stroke:3.4,cls:'ic-acid'})+' <b>'+it.ans+'</b>';}
    else{toast('nie tak');fb.className='exfb bad show';fb.innerHTML='Poprawnie: <b>'+it.ans+'</b>';}
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
  wrap.appendChild(el('div','exprompt','Połącz w pary (tapnij z lewej, potem z prawej)'));
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
  if(cw.selL===cw.selR){cw.matched.add('L'+cw.selL);cw.matched.add('R'+cw.selR);cw.done++;cw.selL=null;cw.selR=null;addXP(current.id,3);toast('para! +3xp','check');cwRenderMatch(sc);}
  else{toast('nie pasuje','close');cw.selL=null;cw.selR=null;cwRenderMatch(sc);}
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
  if(!SUBJECTS.length)return renderEmpty();
  go('today');
});
})();
