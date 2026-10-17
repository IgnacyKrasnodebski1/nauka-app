/* ============================================================
   Cramfox — silnik wieloprzedmiotowej platformy do nauki
   Przedmioty przychodzą z konta (cloud.js → toEngine() → NaukaEngine.setSubjects); dawne window.SUBJECTS zostaje tylko dla testów
   Tryby: Ścieżka (Duolingo) + Fiszki + Quiz + Egzamin + Info
   Widoki główne (krok 3): Dziś (plan dnia) · Przedmioty · Profil · Ustawienia · Seria
   Krok 6 (handoff 2.0): nawigacja Dziś · Powtórka · [+] · Fiszki · Profil, arkusz „Dodaj materiał”, „Wyjaśnij inaczej”,
   powtórka SRS (PROGRESS.srs, pudełka 0…4 → 0/1/3/7/21 dni), Review + FlashcardsDone, ton bez slangu.
   Krok 7: egzamin (ExamStart → ExamRun z siatką i flagami → wynik z oceną i talią błędów) i plan do sprawdzianu (PROGRESS.tests, TestPlan).
   Krok 8: gamifikacja — gemy i plecak (Shop), misje, zamrożenia serii + ComeBack, album pojęć, boss rozdziału, duch (wyścig z własnym przebiegiem), odznaki.
   Krok 9 (domknięcie, wersja 2.0): pierwsze uruchomienie (LevelPick → Onboarding), pełne ustawienia,
   ekran błędu + pasek offline, Info przedmiotu z siatką ocen, podsumowanie tygodnia (PROGRESS.history), noc przed egzaminem (Cram),
   poprawianie pytań (PROGRESS.overrides), źródło pytania (SourceView).
   Wersja 3.0: konta i własne przedmioty z materiałów — sesja, dane i generowanie w cloud.js / cloud-ui.js.
   Kontrakt danych (cloud.js): pola HTML (feed[].body/real/mnemo, flashcards[].d, subject.info) przechodzą przez clean();
   każdy inny napis (nazwy, tytuły, fiszka t, quiz q/a/e, src, cała tablica tasks[]) to ZWYKŁY TEKST ESCAPOWANY encjami (&amp; &lt; &gt; &quot; &#39;):
   wolno go wstawić do innerHTML i do atrybutu w cudzysłowie, ale do porównań z wpisanym tekstem, .value, .textContent i setAttribute → txt().
   PROGRESS / META przychodzą z synchronizacji konta — traktowane jako niezaufane (fixProgress / fixMeta).
   ============================================================ */
(function(){
"use strict";
// fonty są wbudowane: fonts/fonts.css (dev: <link> w index.html; build.js wkleja je jako data: WOFF) — bez Google Fonts, działa offline i nie wysyła IP (AUDYT P1-27)
// natywna apka (Capacitor / WKWebView) — część tekstów i funkcji różni się od podglądu w przeglądarce
const NATIVE=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
/* tekst ↔ HTML: esc = zwykły tekst do innerHTML / atrybutu (ten sam escaper co cloud.js); txt = napis escapowany (albo HTML) → surowy tekst
   (porównania z wpisanym tekstem, .value, .textContent, setAttribute); attr = treść z danych do atrybutu w cudzysłowie. Zdekodowany tekst nigdy nie wraca do innerHTML bez esc(). */
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const txt=h=>{const t=document.createElement('template');t.innerHTML=String(h==null?'':h);return t.content.textContent;};
const attr=h=>esc(txt(h));
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;const isDate=v=>typeof v==='string'&&DATE_RE.test(v);const num=v=>typeof v==='number'&&isFinite(v); // walidacja danych z synchronizacji
const own=(o,k)=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(o,k); // klucz słownika (bez „constructor” itp. z prototypu)
// punkty zaczepienia dla warstwy chmury (cloud-ui.js): wywoływane leniwie, więc kolejność skryptów nie ma znaczenia
function hook(n,...a){const h=window.NAUKA_HOOKS;return h&&typeof h[n]==='function'?h[n](...a):undefined;}

/* ---------- bezpieczny storage (iOS file:// potrafi rzucać) ---------- */
const STORE=(()=>{try{const ls=globalThis['localStorage'];const t='__nk_t';ls.setItem(t,'1');ls.removeItem(t);return ls;}catch(e){const m={};return{volatile:true,getItem:k=>k in m?m[k]:null,setItem:(k,v)=>{m[k]=String(v);},removeItem:k=>{delete m[k];}};}})();
// postępy per konto: cloud.js ustawia NAUKA_UID przed silnikiem (bez konta klucz bez sufiksu — tylko testy)
const UID_SFX=window.NAUKA_UID?':'+window.NAUKA_UID:'';
const PKEY='nauka_progress_v1'+UID_SFX;
function loadProgress(){try{const p=JSON.parse(STORE.getItem(PKEY)||'{}');return p&&typeof p==='object'&&!Array.isArray(p)?p:{};}catch(e){return {};}} // "null", "42", [] → {}
let PROGRESS=loadProgress();
function saveProgress(){try{STORE.setItem(PKEY,JSON.stringify(PROGRESS));}catch(e){}hook('saved');}
function subjState(id){ let st=PROGRESS[id]; if(!st||typeof st!=='object'||Array.isArray(st))st=PROGRESS[id]={xp:0,levels:{}}; if(!st.levels||typeof st.levels!=='object'||Array.isArray(st.levels))st.levels={}; if(typeof st.xp!=='number')st.xp=+st.xp||0; return st; }
/* naprawa kształtu po synchronizacji / ręcznej edycji storage — PROGRESS z konta jest niezaufany: złe wpisy wypadają albo liczą się od nowa, liczby i daty
   są sprawdzane, a napisy, które trafiają do innerHTML, są liczone z danych (ocena z %, etykiety z TP_LABEL / MISSION_POOL), nie brane z zapisu. Reszta postępów zostaje. */
function fixProgress(){
  const P=PROGRESS,isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v),objOr=k=>{if(P[k]!=null&&!isObj(P[k]))delete P[k];return P[k];};
  if(P.epoch!=null&&!num(P.epoch))delete P.epoch; // znacznik wyzerowania postępów (cloud.js: większy epoch wygrywa w całości)
  ['goal','gems','examsPassed'].forEach(k=>{if(P[k]!=null&&!num(P[k]))delete P[k];});
  SUBJECTS.forEach(s=>{if(P[s.id]==null)return;const st=subjState(s.id);
    Object.keys(st.levels).forEach(k=>{const l=st.levels[k];if(!isObj(l))delete st.levels[k];else{l.done=!!l.done;l.stars=Math.max(0,Math.min(3,l.stars|0));if(l.best!=null)l.best=+l.best||0;}});
    if(st.exam!=null){const e=st.exam;if(!isObj(e))delete st.exam;else{e.n=e.n|0;e.passed=e.passed|0;['best','last'].forEach(k=>{const r=e[k];if(r==null)return;
      if(!isObj(r)||!num(r.pct)||!isDate(r.date))delete e[k];else{r.pct=Math.max(0,Math.min(100,Math.round(r.pct)));r.correct=r.correct|0;r.total=r.total|0;r.grade=exGrade(s,r.pct);}});}}
    if(st.boss!=null){const b=st.boss;if(!isObj(b))delete st.boss;else{b.done=!!b.done;b.n=b.n|0;if(b.at!=null&&!isDate(b.at))delete b.at;if(b.best!=null&&!num(b.best))delete b.best;}}
    if(st.chests!=null&&!isObj(st.chests))delete st.chests;
  });
  if(P.examDeck!=null){const d=Array.isArray(P.examDeck)?P.examDeck.filter(k=>typeof k==='string'):[];if(d.length)P.examDeck=d;else delete P.examDeck;}
  const O=objOr('overrides');if(O)Object.keys(O).forEach(k=>{if(!ovOk(O[k]))delete O[k];});
  const d=objOr('daily');if(d&&(!isDate(d.date)||!Array.isArray(d.tasks)))delete P.daily;
  else if(d){d.xp=num(d.xp)?d.xp:0;if(d.goal!=null&&!num(d.goal))delete d.goal;d.tasks=d.tasks.filter(t=>isObj(t)&&typeof t.id==='string');d.tasks.forEach(t=>{t.done=!!t.done;if(t.need!=null)t.need=Math.max(1,t.need|0);if(t.prog!=null)t.prog=Math.max(0,t.prog|0);});}
  const h=objOr('hearts');if(h){if(!num(h.n))delete P.hearts;else{h.n=Math.max(0,Math.min(HEARTS_MAX,Math.round(h.n)));if(!num(h.refillAt))h.refillAt=null;if(h.quest!=null){if(num(h.quest)&&h.quest>0)h.quest=Math.min(HEART_REV,Math.ceil(h.quest));else delete h.quest;}}}
  const S=objOr('srs');if(S)Object.keys(S).forEach(k=>{const e=S[k];if(!isObj(e)||!isDate(e.due))delete S[k];else{e.box=Math.max(0,Math.min(4,e.box|0));e.seen=Math.max(0,e.seen|0);e.lapses=Math.max(0,e.lapses|0);}});
  if(P.tests!=null){if(!Array.isArray(P.tests))delete P.tests;else P.tests=P.tests.filter(t=>isObj(t)&&typeof t.id==='string'&&typeof t.subjectId==='string'&&isDate(t.date)&&Array.isArray(t.levels)).map(t=>{
    t.levels=t.levels.filter(x=>typeof x==='string');if(t.built!=null&&!isDate(t.built))t.built=null;
    t.plan=(Array.isArray(t.plan)?t.plan:[]).filter(r=>isObj(r)&&isDate(r.date)&&own(TP_LABEL,r.kind)).map(r=>{r.minutes=Math.max(0,r.minutes|0);if(r.n!=null)r.n=Math.max(0,r.n|0);
      if(r.lv!=null)r.lv=Array.isArray(r.lv)?r.lv.filter(x=>typeof x==='string'):[];if(r.done!=null)r.done=!!r.done;if(r.short!=null)r.short=!!r.short;return r;});return t;});}
  const M=objOr('missions');if(M){const okM=(x,pool)=>isObj(x)&&own(pool,x.id)&&num(x.progress)&&num(x.target)&&x.target>0;
    if(!Array.isArray(M.daily)||!M.daily.every(x=>okM(x,MISSION_POOL))||(M.weekly!=null&&!okM(M.weekly,WEEKLY_POOL)))delete P.missions;
    else{[...M.daily,M.weekly].filter(Boolean).forEach(x=>{const pool=own(MISSION_POOL,x.id)?MISSION_POOL:WEEKLY_POOL;x.reward=pool[x.id].reward;x.target=Math.ceil(x.target);x.progress=Math.max(0,Math.floor(x.progress));x.done=!!x.done;});M.run=M.run|0;}}
  const A=objOr('album');if(A)Object.keys(A).forEach(k=>{const e=A[k];if(!isObj(e)||['common','rare','epic'].indexOf(e.rarity)<0)delete A[k];else if(!isDate(e.at))e.at='';});
  const B=objOr('badges');if(B)Object.keys(B).forEach(k=>{if(!isDate(B[k]))delete B[k];});
  const G=objOr('ghost');if(G)Object.keys(G).forEach(k=>{const g=G[k];const run=Array.isArray(g)?g:isObj(g)?g.run:null;
    if(!Array.isArray(run)||!run.every(x=>isObj(x)&&num(x.t)))delete G[k];else if(isObj(g)&&g.at!=null&&!isDate(g.at))delete g.at;});
  const st=objOr('stats');if(st)['missions','maxCombo','planDays','bosses'].forEach(k=>{st[k]=Math.max(0,st[k]|0);});
  const bo=objOr('boost');if(bo&&!num(bo.until))delete P.boost;
  if(P.theme!=null&&!own(GLASSES,P.theme))delete P.theme;
  if(P.themes!=null)P.themes=Array.isArray(P.themes)?P.themes.filter(t=>own(GLASSES,t)):[];
  const H=objOr('history');if(H)Object.keys(H).forEach(k=>{if(!isDate(k)||!isObj(H[k]))delete H[k];});
  if(P.lessonSave!=null&&(typeof P.lessonSave!=='string'||P.lessonSave.length>40000))delete P.lessonSave; // P1-11: przerwane lekcje (napis JSON, wpisy sprawdza lessonLoad)
}
/* poprawka pytania (PROGRESS.overrides) — surowy tekst wpisany przez użytkownika; z synchronizacji niezaufana, więc kształt sprawdzany przy każdym użyciu */
function ovOk(o){return !!o&&typeof o==='object'&&typeof o.q==='string'&&Array.isArray(o.a)&&o.a.length>=2&&o.a.length<=5&&o.a.every(x=>typeof x==='string')&&Number.isInteger(o.c)&&o.c>=0&&o.c<o.a.length&&(o.e==null||typeof o.e==='string');}

/* ---------- daily streak (osobny klucz, nie rusza postępów) ---------- */
const MKEY='nauka_meta_v1'+UID_SFX;
// etap i cel (LevelPick): słowniki przed loadMeta — META.level / META.goal są renderowane tylko przez te słowniki
const LEVEL_NAME={podstawowka:'Podstawówka',liceum:'Liceum / technikum',studia:'Studia',inne:'Inne'}; // podstawowka: tylko dla starych zapisów (w wyborze jej nie ma, 16+)
const GOAL_NAME={sprawdziany:'kartkówki i sprawdziany','matura-p':'matura podstawowa','matura-r':'matura rozszerzona',olimpiada:'olimpiada',sesja:'sesja i kolokwia',wlasny:'własny cel'};
/* META z konta jest niezaufany: etap i cel tylko z kluczy słowników, liczby jako liczby, daty jako yyyy-mm-dd (inaczej wpis wypada) */
function fixMeta(m){
  if(m.level==='podstawowka')m.level='inne'; // od 3.0 apka jest 16+ — stary etap „podstawówka” traktujemy jak „coś innego”
  if(m.level!=null&&!own(LEVEL_NAME,m.level))delete m.level;if(m.goal!=null&&!own(GOAL_NAME,m.goal))delete m.goal;
  ['streak','best','bestWas','freezes'].forEach(k=>{if(m[k]!=null){if(num(m[k]))m[k]=Math.max(0,Math.floor(m[k]));else delete m[k];}});
  ['lastDay','streakCeleb','comebackShown','weeklyShown'].forEach(k=>{if(m[k]!=null&&!isDate(m[k]))delete m[k];});
  if(m.frozenDays!=null)m.frozenDays=Array.isArray(m.frozenDays)?m.frozenDays.filter(isDate).slice(-14):[];
  if(m.ms!=null&&(typeof m.ms!=='object'||Array.isArray(m.ms)))delete m.ms;
  if(m.reduceMotion!=null)m.reduceMotion=!!m.reduceMotion;
  return m;
}
function loadMeta(){try{const m=JSON.parse(STORE.getItem(MKEY)||'{}');return m&&typeof m==='object'&&!Array.isArray(m)?fixMeta(m):{};}catch(e){return {};}}
let META=loadMeta();
function saveMeta(){try{STORE.setItem(MKEY,JSON.stringify(META));}catch(e){}hook('saved');}
function dstr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function todayStr(){return dstr(new Date());}
function dayDiff(a,b){const pa=a.split('-').map(Number),pb=b.split('-').map(Number);return Math.round((Date.UTC(pb[0],pb[1]-1,pb[2])-Date.UTC(pa[0],pa[1]-1,pa[2]))/86400000);}
/* aktualna „żywa” seria do wyświetlenia (0 jeśli wygasła) */
function streakDisplay(){ if(!META.lastDay)return 0; const d=dayDiff(META.lastDay,todayStr()); return (d===0||d===1)?(META.streak|0):0; }
/* odnotuj aktywność dziś; zwraca true gdy seria została dziś przedłużona/zaczęta */
function touchStreak(){
  const t=todayStr();
  if(META.lastDay===t)return false; // już policzone dzisiaj
  applyFreeze(); // P1-8: WebView przeżył w tle dzień przerwy — zamrożenie musi zadziałać przed pierwszym XP dnia, nie dopiero przy starcie
  if(META.lastDay){const d=dayDiff(META.lastDay,t); META.streak=(d===1)?(META.streak||0)+1:1;}
  else META.streak=1;
  META.bestWas=META.best||0; META.lastDay=t; META.best=Math.max(META.bestWas,META.streak); saveMeta();
  msAward(); // kamienie milowe: gemy/zamrożenia raz na próg
  missionEvent('day',1);checkBadges(); // krok 8
  return true;
}

/* ---------- krok 9: wersja, dziennik dni (podsumowanie tygodnia), cel dzienny, poprawki pytań ----------
   PROGRESS.history["yyyy-mm-dd"]={xp,levels,cards,reviews,combo,missions} — dopisują addXP / finishLesson / srsTouch / albumCheck / claimMission.
   PROGRESS.goal = cel dzienny XP (50/100/200), kopiowany do PROGRESS.daily.goal przy układaniu dnia. PROGRESS.overrides["sid:lid:qi"]={q,a,c,e}. */
const VERSION='3.0';
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
function qOf(s,lv,qi,pm){const q=(lv.quiz||[])[qi];if(!q)return q;const o=overrides()[ovKey(s.id,lv.id,qi)];
  // poprawka to surowy tekst (także z synchronizacji — niezaufana): zawsze escapowana przy nakładaniu, c sprawdzone względem liczby odpowiedzi
  return mixQ(ovOk(o)?{...q,q:esc(o.q),a:o.a.map(esc),c:o.c,e:esc(o.e||''),edited:true}:q,pm);}
/* odpowiedzi w losowej kolejności (w danych poprawna to zwykle B); pm = permutacja — podana zachowuje układ z ekranu (np. po poprawce) */
function mixQ(q,pm){const a=q.a;if(!Array.isArray(a)||!(q.c>=0&&q.c<a.length))return q;
  if(!Array.isArray(pm)||pm.length!==a.length){pm=a.map((_,i)=>i);for(let i=pm.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pm[i],pm[j]]=[pm[j],pm[i]];}}
  return {...q,a:pm.map(i=>a[i]),c:pm.indexOf(q.c),pm};}

/* ---------- helpers ---------- */
const SUBJECTS = (window.SUBJECTS||[]).filter(s=>s&&s.id&&s.name&&Array.isArray(s.levels)); // krok 9: wpisy bez id/nazwy/poziomów są pomijane
const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;};
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}; // Fisher–Yates (sort z losowym porównaniem nie tasuje równo)
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
  trend:{d:'M3 17l6-6 4 4 8-8M15 7h6v6',w:2.8},
  trash:{d:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',w:2.4},
  slides:{d:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8M7 12l3-3 2 2 4-4"/>',w:2.4}
};
function icon(name,o){
  o=o||{};const ic=own(ICONS,name)?ICONS[name]:ICONS.alert;
  const size=o.size||20, sw=o.stroke||ic.w||2.6;
  const filled=(o.fill!=null)?!!o.fill:!!ic.fill;
  const body=ic.d.indexOf('<')>=0?ic.d:'<path d="'+ic.d+'"/>';
  const paint=filled?'fill="currentColor" stroke="none"':'fill="none" stroke="currentColor" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round"';
  return '<svg class="ic'+(o.cls?' '+o.cls:'')+'" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" '+paint+' aria-hidden="true">'+body+'</svg>';
}
/* ============================================================ MASKOTKA — lis Cramfox
   Cramfox — animowany lis. fox(mood,size) zwraca <svg>; foxLive(svg) daje mu „mózg”: mruganie, wzrok, miny, akcje, nuda i drzemka, reakcje na dotyk i pisanie.
// Nastroje: idle, happy, oops, fire, sleep, think. Części z klasami fx-* animuje CSS (fox.css); zagnieżdżone <g>, bo transform z CSS nadpisuje atrybut.
   Wygląd zależy od serii (foxLook): dodatki acc, kolor płomienia, emotka kamienia milowego. */
const FXC={o:'#FF7A2F',d:'#B8431A',k:'#7A2A10',c:'#FFF1E6',ink:'#0E0C1C',g:'#B4FF3A'};
const FX_PUP=(ry)=>`<g class="fx-look"><ellipse cx="-19" cy="-13" rx="4.5" ry="${ry}" fill="${FXC.ink}"/><ellipse cx="19" cy="-13" rx="4.5" ry="${ry}" fill="${FXC.ink}"/><circle cx="-17.5" cy="-15.5" r="1.6" fill="#fff"/><circle cx="20.5" cy="-15.5" r="1.6" fill="#fff"/></g>`;
const FX_EYES={
idle:`<g class="fx-eyes">${FX_PUP(6)}</g>`,
happy:`<g fill="none" stroke="${FXC.ink}" stroke-width="3.5" stroke-linecap="round"><path d="M-25 -11 Q-19 -20 -13 -11"/><path d="M13 -11 Q19 -20 25 -11"/></g>`,
oops:`<g class="fx-eyes"><g class="fx-look"><circle cx="-19" cy="-11" r="3.6" fill="${FXC.ink}"/><circle cx="19" cy="-11" r="3.6" fill="${FXC.ink}"/></g></g>`,
fire:`<g class="fx-eyes">${FX_PUP(5)}</g>`,
sleep:`<g fill="none" stroke="${FXC.ink}" stroke-width="3.2" stroke-linecap="round"><path d="M-25 -13 Q-19 -8 -13 -13"/><path d="M13 -13 Q19 -8 25 -13"/></g>`,
think:`<g class="fx-eyes">${FX_PUP(6)}</g>`};
const FX_BROW0={oops:`<g stroke="${FXC.k}" stroke-width="3.5" stroke-linecap="round"><line x1="-27" y1="-30" x2="-13" y2="-34"/><line x1="27" y1="-30" x2="13" y2="-34"/></g>`,
fire:`<g stroke="${FXC.k}" stroke-width="3.5" stroke-linecap="round"><line x1="-28" y1="-21" x2="-11" y2="-17"/><line x1="28" y1="-21" x2="11" y2="-17"/></g>`}; // brwi nastroju osobno: nad powiekami (mruganie ich nie chowa)
const FX_MOUTH={
idle:`<path d="M-5 32 Q-2.5 35 0 32 Q2.5 35 5 32" fill="none" stroke="${FXC.ink}" stroke-width="2" stroke-linecap="round"/>`,
happy:`<path d="M-8 30 Q0 43 8 30 Z" fill="${FXC.ink}"/><path d="M-4 35.5 Q0 40 4 35.5 Z" fill="#FF6B8B"/>`,
oops:`<path d="M-6 34 Q-3 31 0 34 Q3 37 6 34" fill="none" stroke="${FXC.ink}" stroke-width="2" stroke-linecap="round"/>`,
fire:`<path d="M-7 30 Q0 39 7 30 Z" fill="${FXC.ink}"/>`,
sleep:`<ellipse class="fx-snore" cx="0" cy="33" rx="2.4" ry="2" fill="${FXC.ink}"/>`,
think:`<ellipse cx="2.5" cy="33.5" rx="2.6" ry="2.2" fill="${FXC.ink}"/>`};
const fxStar=(x,y,r,d)=>`<path class="fx-spark" style="animation-delay:${d}s" fill="${FXC.g}" d="M${x} ${y-r}L${x+r*.28} ${y-r*.28}L${x+r} ${y}L${x+r*.28} ${y+r*.28}L${x} ${y+r}L${x-r*.28} ${y+r*.28}L${x-r} ${y}L${x-r*.28} ${y-r*.28}Z"/>`;
const FX_EXTRA={
idle:'',
happy:fxStar(20,40,9,0)+fxStar(140,24,7,.3)+fxStar(146,78,6,.6)+fxStar(14,92,5,.45),
oops:'<path class="fx-drop" d="M126 40 Q133 51 126 56 Q119 51 126 40 Z" fill="#3FD8F5"/>',
fire:'<g transform="translate(-4 100) scale(.85)"><path class="fx-flame" d="M14 60 Q-8 48 2 22 Q8 34 14 30 Q10 6 28 -8 Q26 14 40 28 Q50 46 32 60 Z" fill="FL0"/><path class="fx-flame in" d="M18 60 Q6 52 12 38 Q16 44 20 42 Q19 30 27 24 Q28 38 33 44 Q38 56 28 60 Z" fill="FL1"/></g>',
sleep:[0,1,2].map(i=>`<path class="fx-z" style="animation-delay:${i}s" d="M${116+i*9} ${34-i*11}h${7+i*2}l-${7+i*2} ${7+i*2}h${7+i*2}" fill="none" stroke="#9C95C9" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`).join(''),
think:''};
/* części do „życia” (ukryte, pokazują je klasy na svg): powieki, miny ex-*, usta mo-*, rumieńce bl, brwi br-*, znaki nad głową mk-* */
const fxStarD=(x,y,r)=>`M${x} ${y-r}L${x+r*.3} ${y-r*.3}L${x+r} ${y}L${x+r*.3} ${y+r*.3}L${x} ${y+r}L${x-r*.3} ${y+r*.3}L${x-r} ${y}L${x-r*.3} ${y-r*.3}Z`;
const FX_LIFE=`<g class="fx-lids" fill="${FXC.o}"><path d="M-28 -24 H-10 V-8 Q-19 -2 -28 -8 Z"/><path d="M10 -24 H28 V-8 Q19 -2 10 -8 Z"/></g>
<g class="fx-x fxe-happy" fill="none" stroke="${FXC.ink}" stroke-width="3.5" stroke-linecap="round"><path d="M-25 -11 Q-19 -20 -13 -11"/><path d="M13 -11 Q19 -20 25 -11"/></g>
<g class="fx-x fxe-closed" fill="none" stroke="${FXC.ink}" stroke-width="3.2" stroke-linecap="round"><path d="M-25 -13 Q-19 -8 -13 -13"/><path d="M13 -13 Q19 -8 25 -13"/></g>
<g class="fx-x fxe-wide"><circle cx="-19" cy="-13" r="7.6" fill="#fff"/><circle cx="19" cy="-13" r="7.6" fill="#fff"/><circle cx="-19" cy="-12" r="3.6" fill="${FXC.ink}"/><circle cx="19" cy="-12" r="3.6" fill="${FXC.ink}"/></g>
<g class="fx-x fxe-dizzy" fill="none" stroke="${FXC.ink}" stroke-width="2.3" stroke-linecap="round"><path class="fx-spin" d="M-19 -13 a1.6 1.6 0 1 1 1.6 1.6 a3.4 3.4 0 1 1 -3.4 -3.4 a5.4 5.4 0 1 1 5.4 5.4"/><path class="fx-spin" d="M19 -13 a1.6 1.6 0 1 1 1.6 1.6 a3.4 3.4 0 1 1 -3.4 -3.4 a5.4 5.4 0 1 1 5.4 5.4"/></g>
<g class="fx-x fxe-wink"><ellipse cx="-19" cy="-13" rx="4.5" ry="6" fill="${FXC.ink}"/><circle cx="-17.5" cy="-15.5" r="1.6" fill="#fff"/><path d="M13 -11 Q19 -19 25 -11" fill="none" stroke="${FXC.ink}" stroke-width="3.5" stroke-linecap="round"/></g>
<g class="fx-x fxo-o"><ellipse cx="0" cy="34" rx="4" ry="5" fill="${FXC.ink}"/></g>
<g class="fx-x fxo-yawn"><ellipse cx="0" cy="35" rx="6.5" ry="8.5" fill="${FXC.ink}"/><ellipse cx="0" cy="39.5" rx="4" ry="3" fill="#FF6B8B"/></g>
<g class="fx-x fxo-grin"><path d="M-8 30 Q0 42 8 30 Z" fill="${FXC.ink}"/><path d="M-4 35 Q0 39.5 4 35 Z" fill="#FF6B8B"/></g>
<g class="fx-x fxo-blep"><path d="M-1 33 Q2 42 5.5 33 Z" fill="#FF6B8B"/><path d="M-5 32 Q-2.5 35 0 32 Q2.5 35 5 32" fill="none" stroke="${FXC.ink}" stroke-width="2" stroke-linecap="round"/></g>
<g class="fx-x fxo-wavy"><path d="M-7.5 34 Q-5 31 -2.5 34 Q0 37 2.5 34 Q5 31 7.5 34" fill="none" stroke="${FXC.ink}" stroke-width="2" stroke-linecap="round"/></g>
<g class="fx-x fx-blush" fill="#FF6B8B"><ellipse cx="-33" cy="8" rx="7" ry="4"/><ellipse cx="33" cy="8" rx="7" ry="4"/></g>`;
const FX_BROWS=`<g class="fx-x fxb-q" stroke="${FXC.k}" stroke-width="3.5" stroke-linecap="round"><line x1="-27" y1="-31" x2="-12" y2="-32"/><line x1="12" y1="-38" x2="27" y2="-33"/></g>
<g class="fx-x fxb-mad" stroke="${FXC.k}" stroke-width="3.8" stroke-linecap="round"><line x1="-28" y1="-35" x2="-12" y2="-29"/><line x1="28" y1="-35" x2="12" y2="-29"/></g>`; // brwi min — po akcesoriach (opaska ich nie zasłania)
const FX_MK=`<g class="fxm fxm-ex" fill="#FFC043"><rect x="46" y="-98" width="8.5" height="23" rx="4.25"/><circle cx="50.25" cy="-66" r="4.6"/></g>
<g class="fxm fxm-q"><path d="M42 -88 Q42 -100 52.5 -100 Q63 -100 63 -90 Q63 -83 54 -80 L54 -75" fill="none" stroke="#22D3EE" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="54" cy="-65" r="4.4" fill="#22D3EE"/></g>
<g class="fxm fxm-heart" fill="#FF2E93"><path class="h1" d="M-4 -76 C-10 -86 -24 -79 -14 -68 L-4 -59 L6 -68 C16 -79 2 -86 -4 -76 Z"/><path class="h2" d="M34 -88 C30 -94 21 -90 27 -83 L34 -77 L41 -83 C47 -90 38 -94 34 -88 Z"/></g>
<g class="fxm fxm-note"><g class="n1"><path d="M45 -72 V-93 L58 -98 V-77" fill="none" stroke="#B4FF3A" stroke-width="3.6" stroke-linejoin="round"/><ellipse cx="40.5" cy="-72" rx="5.5" ry="4.3" fill="#B4FF3A"/><ellipse cx="53.5" cy="-77" rx="5.5" ry="4.3" fill="#B4FF3A"/></g></g>
<g class="fxm fxm-dots" fill="#E4E0F7"><circle class="d1" cx="36" cy="-66" r="3.6"/><circle class="d2" cx="47" cy="-78" r="4.6"/><circle class="d3" cx="60" cy="-93" r="6"/></g>
<g class="fxm fxm-bulb"><g stroke="#FFC043" stroke-width="3.6" stroke-linecap="round"><line x1="53" y1="-114" x2="53" y2="-121"/><line x1="36" y1="-106" x2="31" y2="-111"/><line x1="70" y1="-106" x2="75" y2="-111"/></g><circle cx="53" cy="-93" r="12" fill="#FFE27A"/><rect x="47" y="-83" width="12" height="9" rx="2.5" fill="#9C95C9"/></g>
<g class="fxm fxm-angry" fill="none" stroke="#FF4D6D" stroke-width="4" stroke-linecap="round"><path d="M41 -82 Q47 -80 46 -74 M55 -82 Q49 -80 50 -74 M41 -66 Q47 -68 46 -74 M55 -66 Q49 -68 50 -74"/></g>
<g class="fxm fxm-sweat"><path d="M57 -48 Q64 -37 57 -32 Q50 -37 57 -48 Z" fill="#3FD8F5"/></g>
<g class="fxm fxm-stars" fill="#FFC043">${[0,1,2,3].map(i=>`<path class="st st${i}" d="${fxStarD(0,-86,7)}"/>`).join('')}</g>`;
const FX_ZZ=`<g class="fxm fxm-zz">${[0,1,2].map(i=>`<path class="fx-z" style="animation-delay:${i}s" d="M${116+i*9} ${34-i*11}h${7+i*2}l-${7+i*2} ${7+i*2}h${7+i*2}" fill="none" stroke="#9C95C9" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</g>`;
const FX_ARM=(cls,x)=>`<g class="${cls}"><rect x="${x+2}" y="118" width="13" height="34" rx="6.5" fill="${FXC.d}"/><rect x="${x}" y="116" width="13" height="34" rx="6.5" fill="${FXC.o}"/><ellipse cx="${x+6.5}" cy="148" rx="7.5" ry="5" fill="${FXC.k}"/></g>`;
const FLAME={base:['#FF5A1F','#FFC53D'],gold:['#FFA023','#FFE27A'],blue:['#2F7BFF','#8FE9FF'],violet:['#A855F7','#F5B8FF'],magenta:['#FF2E93','#FFE27A']};
// dodatki za serię: band(14) scarf(30) medal(50) crown(100) gold+cape(365)
const ACC={
 cape:'<g class="fx-cape"><path d="M56 112 Q34 146 30 164 L130 164 Q126 146 104 112 Z" fill="#7C3AED"/><path d="M56 112 Q44 140 42 164 L52 164 Q54 140 62 116 Z" fill="#5B21B6"/></g>',
 scarf:'<path d="M56 110 Q80 124 104 110 L106 121 Q80 136 54 121 Z" fill="#22D3EE"/><path d="M62 114 l4 10M72 118 l3 10M84 119 l2 10M95 116 l1 10" stroke="#0E7490" stroke-width="3"/><g class="fx-scarfe"><path d="M90 122 l9 28 l-11 3 l-7 -29 z" fill="#22D3EE"/><path d="M88 146 l11 -3 l2 6 l-11 3 z" fill="#0E7490"/></g>',
 medal:'<g class="fx-medal"><path d="M70 112 L80 132 L90 112" fill="none" stroke="#A855F7" stroke-width="6" stroke-linejoin="round"/><circle cx="80" cy="138" r="11" fill="#B3820E"/><circle cx="80" cy="136" r="11" fill="#FFC043"/><path d="M80 130 l1.8 4 l4.4 .4 l-3.3 2.9 l1 4.3 l-3.9 -2.3 l-3.9 2.3 l1 -4.3 l-3.3 -2.9 l4.4 -.4 z" fill="#B3820E"/><path class="fx-glint" d="M86 131 l2 -2" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></g>',
};
const ACC_HEAD={
 band:'<path d="M-50 -22 Q0 -52 50 -22 L49 -14 Q0 -44 -49 -14 Z" fill="#FF2E93"/><path d="M-49 -16 Q0 -46 49 -16" fill="none" stroke="#B0105E" stroke-width="2"/><g class="fx-bandt"><path d="M48 -20 l15 -7 l-3 10 z M48 -17 l13 6 l-7 3 z" fill="#FF2E93"/></g>',
 crown:'<g class="fx-crown"><path d="M-23 -39 L-23 -58 L-11.5 -47 L0 -63 L11.5 -47 L23 -58 L23 -39 Z" transform="translate(0 4)" fill="#B3820E"/><path d="M-23 -39 L-23 -58 L-11.5 -47 L0 -63 L11.5 -47 L23 -58 L23 -39 Z" fill="#FFC043"/><circle cx="0" cy="-45" r="3.4" fill="#FF2E93"/><circle cx="-13" cy="-43" r="2.6" fill="#22D3EE"/><circle cx="13" cy="-43" r="2.6" fill="#22D3EE"/></g>',
};
function fox(m,size,o){m=FX_EYES[m]?m:'idle';o=o||{};if(!o.acc){const L=foxLook();o={...o,acc:L.acc,flame:o.flame||L.flame};}const w=size||112;const acc=o.acc||[],fl=FLAME[o.flame]||FLAME.base,gl=acc.includes('gold')?'#FFC043':foxGlasses();
  const has=a=>acc.includes(a);return `<svg class="fx ${m}${o.emote?' emo-'+o.emote:''}" width="${w}" height="${Math.round(w*170/160)}" viewBox="0 0 160 170" aria-hidden="true">
<ellipse class="fx-ground" cx="80" cy="162" rx="42" ry="5" fill="${FXC.ink}" opacity=".6"/>
<g class="fx-all"><g class="fx-sway">
${has('cape')?ACC.cape:''}<g class="fx-tail"><path d="M100 152 C132 162 156 136 148 106 C144 90 128 88 124 98 C134 112 126 132 102 134 Z" transform="translate(0 4)" fill="${FXC.d}"/><path d="M100 152 C132 162 156 136 148 106 C144 90 128 88 124 98 C134 112 126 132 102 134 Z" fill="${FXC.o}"/><path d="M148 106 C144 90 128 88 124 98 C132 100 140 102 148 106 Z" fill="${FXC.c}"/></g>
<path d="M50 158 Q46 116 80 106 Q114 116 110 158 Z" transform="translate(0 4)" fill="${FXC.d}"/>
<path d="M50 158 Q46 116 80 106 Q114 116 110 158 Z" fill="${FXC.o}"/>
<path d="M64 158 Q62 128 80 120 Q98 128 96 158 Z" fill="${FXC.c}"/>
<ellipse cx="68" cy="158" rx="10" ry="5" fill="${FXC.k}"/><ellipse cx="92" cy="158" rx="10" ry="5" fill="${FXC.k}"/>
${has('medal')?ACC.medal:''}
<g transform="translate(80 72) scale(.82)"><g class="fx-hgaze"><g class="fx-head">
<g class="fx-earl"><polygon points="-44,-16 -32,-64 -8,-34" fill="${FXC.o}"/><polygon points="-36,-25 -31,-50 -17,-33" fill="${FXC.k}"/></g>
<g class="fx-earr"><polygon points="44,-16 32,-64 8,-34" fill="${FXC.o}"/><polygon points="36,-25 31,-50 17,-33" fill="${FXC.k}"/></g>
<path d="M-52 -12 Q-48 -42 0 -42 Q48 -42 52 -12 L22 30 Q0 44 -22 30 Z" transform="translate(0 6)" fill="${FXC.d}"/>
<path d="M-52 -12 Q-48 -42 0 -42 Q48 -42 52 -12 L22 30 Q0 44 -22 30 Z" fill="${FXC.o}"/>
<path d="M-52 -12 Q-30 -8 -12 10 L0 30 L12 10 Q30 -8 52 -12 L22 30 Q0 44 -22 30 Z" fill="${FXC.c}"/>
<path class="fx-nose" d="M-6 23 Q0 20 6 23 L0 29 Z" fill="${FXC.ink}"/>
<g class="fx-e0">${FX_EYES[m]}</g><g class="fx-m0">${FX_MOUTH[m]}</g>${FX_LIFE}<g class="fx-b0">${FX_BROW0[m]||''}</g>
<g class="fx-glasses" fill="none" stroke="${gl}" stroke-width="4"><circle cx="-19" cy="-13" r="13"/><circle cx="19" cy="-13" r="13"/><line x1="-6" y1="-14" x2="6" y2="-14"/></g>
${has('band')?ACC_HEAD.band:''}${has('crown')?ACC_HEAD.crown:''}${FX_BROWS}
</g></g>${FX_MK}</g>
${has('scarf')?ACC.scarf:''}
${FX_ARM('fx-arml',47)}${FX_ARM('fx-armr',100)}
</g></g>${m==='sleep'?'':FX_ZZ}${(FX_EXTRA[m]+(o.emote&&m!=='fire'?FX_EXTRA.fire:'')).replace(/FL0/g,fl[0]).replace(/FL1/g,fl[1])}</svg>`;}
/* ---------- życie lisa: każdy lis na ekranie ma mały „mózg” ----------
   Jeden wspólny zegar (200 ms) dla wszystkich lisów; każdy ma własne, losowe terminy: mrugnięcie, spojrzenie, ucho, akcja.
   Wzrok idzie za palcem i za polem, w którym piszesz; przy haśle lis zasłania oczy (i czasem podgląda).
   Nuda: bez dotyku ekranu robi się senny, potem drzemie; dotyk go budzi. Stuknięcie: reakcja zależy od miejsca
   (czubek głowy = głaskanie, nos = kichnięcie/języczek, ogon = zdziwienie), zaczepiany za często złości się, a potem kręci mu się w głowie.
   Akcja = klasy na svg (act-* ruch, ex-* oczy, mo-* usta, mk-* znak nad głową, br-* brwi, bl rumieńce) na określony czas. */
const FXL=new Set();let fxTimer=null,fxPtr=null,fxPtrAt=0,fxUserAt=Date.now(),fxField=null,fxRaf=0,fxHiAt=0,fxEmAt=0;
const fxR=(a,b)=>a+Math.random()*(b-a);
const fxW=l=>{let t=0;l.forEach(x=>t+=x[1]);let r=Math.random()*t;for(const x of l){r-=x[1];if(r<=0)return x[0];}return l[0][0];};
const fxRM=()=>document.documentElement.classList.contains('reduce-motion')||!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const FX_A={ // [czas ms, klasy]
  hop:[900,'act-hop'],wave:[1700,'act-wave'],stretch:[1500,'act-stretch'],look:[2200,'act-look'],
  tilt:[1800,'act-tilt br-q'],yawn:[2300,'act-yawn ex-closed mo-yawn'],scratch:[1700,'act-scratch ex-happy'],glasses:[1400,'act-glasses'],
  sniff:[1500,'act-sniff'],sneeze:[1500,'act-sneeze ex-closed mo-o'],hum:[2600,'act-hum ex-happy mk-note'],wiggle:[1400,'act-wiggle mo-grin'],
  blep:[1300,'act-blep ex-happy mo-blep'],nod:[1000,'act-nod'],wink:[900,'act-wink ex-wink mo-grin'],giggle:[1200,'act-giggle ex-happy mo-grin'],
  startle:[1000,'act-startle ex-wide mo-o mk-ex'],angry:[1700,'act-angry br-mad mo-wavy mk-angry'],pet:[1700,'act-pet ex-happy bl mk-heart'],
  dizzy:[2800,'act-dizzy ex-dizzy mo-wavy mk-stars'],idea:[1400,'act-idea ex-wide mk-bulb'],think:[3000,'act-think mk-dots'],
  sigh:[1600,'act-sigh ex-closed mk-sweat'],tailpeek:[1500,'act-tailpeek ex-wide mk-q']};
const FX_POOL={
  idle:[['tilt',3],['scratch',2],['glasses',2],['sniff',2],['look',1.6],['stretch',1.2],['yawn',1],['hum',1.2],['wiggle',1.2],['wave',1],['hop',1],['nod',.8],['wink',.7],['blep',.6],['think',.6],['sneeze',.35]],
  sleepy:[['yawn',1.5],['nod',1.5],['stretch',.5],['scratch',.5]],
  happy:[['wink',2],['giggle',1.5],['blep',1],['hum',1]],
  oops:[['sigh',2],['scratch',1.5],['glasses',1],['nod',.6]],
  fire:[['wink',2],['nod',1],['hop',1]],
  think:[['scratch',2],['glasses',1.5],['look',1.2],['nod',.8],['sniff',.6],['idea',.2]],
  sleep:[]};
const FX_TMP=/^(act-|ex-|mo-|mk-|br-|bl$|bk$|tw-|peek$|cover-in$|uncover$|emo-)/;
const fxMood=F=>['happy','oops','fire','sleep','think'].find(m=>F.svg.classList.contains(m))||'idle';
function fxClear(F){Object.keys(F.t).forEach(k=>clearTimeout(F.t[k]));F.t={};[...F.svg.classList].forEach(k=>{if(FX_TMP.test(k)&&k!==F.em0)F.svg.classList.remove(k);});} // em0 = emotka kamienia milowego z renderu — zostaje
function fxFlag(F,c,ms){const s=F.svg;s.classList.remove(c);void s.getBoundingClientRect();s.classList.add(c);clearTimeout(F.t[c]);F.t[c]=setTimeout(()=>s.classList.remove(c),ms);}
function fxDo(F,a,force){const A=FX_A[a];if(!A)return;const now=Date.now();if(!force&&now<F.busy)return;
  fxClear(F);F.busy=now+A[0];F.last=a;const s=F.svg,cs=A[1].split(' ');void s.getBoundingClientRect();cs.forEach(k=>s.classList.add(k));
  if(a==='think'||a==='idea')fxGaze(F,-3.4,-3.2,-5);else if(a==='tailpeek')fxGaze(F,4.4,1.5,9);else if(a==='look')fxGaze(F,0,0,0);
  F.t.a=setTimeout(()=>cs.forEach(k=>s.classList.remove(k)),A[0]);}
function fxEmo(F,em){fxClear(F);F.busy=Date.now()+2600;F.svg.classList.add('emo-'+em);F.t.e=setTimeout(()=>F.svg.classList.remove('emo-'+em),2600);}
function fxBlink(F){fxFlag(F,'bk',190);}
function fxGaze(F,gx,gy,hr){if(fxRM())gx=gy=hr=0; // ograniczony ruch: lis patrzy prosto
  const st=F.svg.style;st.setProperty('--gx',gx.toFixed(2)+'px');st.setProperty('--gy',gy.toFixed(2)+'px');st.setProperty('--hr',(hr||0).toFixed(1)+'deg');st.setProperty('--hx',((hr||0)*.3).toFixed(2)+'px');}
function fxAim(F,x,y){const r=F.svg.getBoundingClientRect();if(!r.width)return;const cx=r.left+r.width*.5,cy=r.top+r.height*.36,dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy)||1,m=Math.min(1,d/(r.width*.8));
  fxGaze(F,dx/d*4.6*m,dy/d*3.4*m,Math.max(-9,Math.min(9,dx/(r.width*1.4)*9)));}
function fxAimField(F){const f=fxField;if(!f||!f.isConnected)return;const r=f.getBoundingClientRect();
  fxAim(F,f.tagName==='TEXTAREA'?r.left+r.width*.5:r.left+Math.min(r.width-12,16+String(f.value||'').length*7.5),r.top+r.height*.5);}
function fxSaccade(F,mood){
  if(mood==='think'&&Math.random()<.75)return fxGaze(F,fxR(-4,-2.4),fxR(-3.6,-2.4),fxR(-7,-3));
  if(Math.random()<.42)return fxGaze(F,fxR(-1,1),fxR(-.8,.8),0);
  const gx=fxR(-4.4,4.4);fxGaze(F,gx,fxR(-3,2.4),Math.random()<.35?gx*1.8:0);}
function fxCover(F,on){const c=F.svg.classList;if(on){if(c.contains('cover'))return;fxClear(F);fxGaze(F,0,0,0);c.add('cover');fxFlag(F,'cover-in',450);F.np=Date.now()+fxR(1600,3000);}
  else if(c.contains('cover')){c.remove('cover','peek');fxFlag(F,'uncover',450);F.busy=Date.now()+500;}}
function fxWake(F){const c=F.svg.classList,doze=F.st==='doze',tapped=Date.now()-(F.tapAt||0)<120;F.st='awake';c.remove('st-sleepy','st-doze');
  if(doze&&!fxRM()){if(tapped){fxDo(F,'startle',true);clearTimeout(F.t.w);F.t.w=setTimeout(()=>{if(F.svg.isConnected)fxDo(F,'yawn',true);},1150);}else fxDo(F,'stretch',true);}} // stuknięty lis podskakuje z „!”, obudzony dotykiem gdzie indziej tylko się przeciąga
function fxSeen(){fxUserAt=Date.now();FXL.forEach(F=>{if(F.st!=='awake')fxWake(F);F.na=Math.max(F.na,fxUserAt+fxR(2500,4000));});} // gdy coś robisz, lis chwilę nie wyskakuje z akcją
function fxZone(F,e){const r=F.svg.getBoundingClientRect();if(!r.width)return 'body';const x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  if(Math.abs(x-.5)<.1&&Math.abs(y-.54)<.075)return 'nose';
  if(x>.7&&y>.55)return 'tail';
  if(y<.6&&x>.16&&x<.84)return y<.3?'top':'face';
  return 'body';}
function fxTap(F,e,st0){const now=Date.now();fxUserAt=now;
  if(st0&&st0!=='awake')return; // obudzony przy dotknięciu (fxSeen) — to stuknięcie było pobudką
  if(F.st!=='awake'){fxWake(F);return;}
  F.pk=now-F.pkAt<800?F.pk+1:1;F.pkAt=now;
  if(fxRM()){fxFlag(F,'ex-happy',700);return;}
  const z=fxZone(F,e),mood=fxMood(F);let a;
  if(F.cool>now)a='giggle';
  else if(F.pk>=8){a='dizzy';F.pk=0;F.cool=now+3200;}
  else if(F.pk>=5&&mood==='idle')a='angry';
  else if(mood==='sleep')a='startle';
  else if(mood==='oops')a=fxW([['sigh',1],['nod',1],['wink',.5]]);
  else if(mood==='think')a=Math.random()<.6?'idea':'startle';
  else if(z==='nose')a=Math.random()<.55?'sneeze':'blep';
  else if(z==='top')a='pet';
  else if(z==='tail')a='tailpeek';
  else if(z==='face')a=fxW([['giggle',2],['wink',1.4],['startle',1],['blep',.6]]);
  else a=fxW([['hop',2],['giggle',1.5],['wave',1],['wiggle',1]]);
  fxDo(F,a,true);F.na=now+fxR(4500,8000);
}
function fxTick(){
  const now=Date.now();if(document.hidden)return;
  const night=(h=>h>=22||h<6)(new Date().getHours()),idleMs=now-fxUserAt;
  FXL.forEach(F=>{const s=F.svg,c=s.classList;
    if(!s.isConnected){fxClear(F);clearTimeout(F.lp);clearInterval(F.pet);FXL.delete(F);return;}
    const mood=fxMood(F),rm=fxRM(),cover=c.contains('cover');
    if(mood==='idle'&&!rm&&!cover){ // nuda → senność → drzemka (w nocy szybciej)
      if(F.st==='awake'&&idleMs>(night?20000:40000)&&now>F.busy){F.st='sleepy';c.add('st-sleepy');}
      else if(F.st==='sleepy'&&idleMs>(night?45000:80000)&&now>F.busy){F.st='doze';fxClear(F);fxGaze(F,0,0,0);c.add('st-doze');}}
    if(F.st==='doze')return;
    if(now>F.nb){F.nb=now+fxR(2200,5600);if(/^(idle|oops|fire|think)$/.test(mood)&&!cover&&!/ (ex|mo)-/.test(' '+s.getAttribute('class'))){fxBlink(F);if(Math.random()<.2)F.t.b2=setTimeout(()=>fxBlink(F),300);}}
    const follow=!cover&&(fxField&&fxField.isConnected?fxField.type!=='password':now-fxPtrAt<2500);
    c.toggle('follow',!!follow);
    if(follow){if(fxField&&now>F.ng){F.ng=now+350;fxAimField(F);}}
    else if(now>F.ng&&!cover){F.ng=now+fxR(700,2600);if(now>F.busy||!/act-(think|idea|tailpeek|look)/.test(s.getAttribute('class')))fxSaccade(F,mood);}
    if(now>F.ne&&!rm&&/^(idle|think)$/.test(mood)){F.ne=now+fxR(3500,9500);const k=Math.random();if(k<.45)fxFlag(F,'tw-l',520);else if(k<.9)fxFlag(F,'tw-r',520);else{fxFlag(F,'tw-l',520);fxFlag(F,'tw-r',520);}}
    if(cover){if(now>F.np){F.np=now+fxR(2400,4600);fxFlag(F,'peek',900);}return;}
    if(now>F.na&&!rm){const sl=F.st==='sleepy';F.na=now+(sl?fxR(8000,16000):mood==='think'?fxR(4500,9000):fxR(5000,11000));
      const pool=FX_POOL[sl?'sleepy':mood];if(pool&&pool.length){const em=mood==='idle'&&foxLook().emote;
        if(em&&Math.random()<.15&&now>F.busy&&now-fxEmAt>60000){fxEmAt=now;fxEmo(F,em);}
        else{const p=pool.length>1?pool.filter(x=>x[0]!==F.last):pool;fxDo(F,fxW(p));}}} // bez tej samej akcji dwa razy z rzędu
  });
  if(!FXL.size){clearInterval(fxTimer);fxTimer=null;}
}
function foxLive(svg){
  if(!svg||svg._fxLive)return;svg._fxLive=1;const now=Date.now();
  const F={svg,t:{},st:'awake',busy:0,pk:0,pkAt:0,cool:0,nb:now+fxR(600,2500),ng:now+fxR(300,1200),ne:now+fxR(1500,5000),na:now+fxR(2500,5000),np:0,em0:[...svg.classList].find(k=>k.indexOf('emo-')===0)||''};
  FXL.add(F);svg.classList.add('alive');svg.style.setProperty('--sw',fxR(3,4.2).toFixed(2)+'s');svg.style.setProperty('--tl',fxR(1.3,1.9).toFixed(2)+'s');
  if(fxField&&fxField.isConnected&&fxField.type==='password')fxCover(F,true);
  else if(fxMood(F)==='idle'&&!fxRM()&&now-fxHiAt>6e5&&Math.random()<.85)F.t.hi=setTimeout(()=>{if(svg.isConnected&&!svg.classList.contains('cover')&&Date.now()-fxHiAt>6e5){fxHiAt=Date.now();fxDo(F,'wave');}},fxR(1600,2200)); // przywitanie: najwyżej raz na 10 min
  svg.style.cursor='pointer';
  const stop=()=>{clearTimeout(F.lp);clearInterval(F.pet);F.pet=null;};
  // stuknięcie liczy się po puszczeniu palca (przewijanie zaczęte na lisie nie jest zaczepką); przytrzymanie = głaskanie
  svg.addEventListener('pointerdown',e=>{F.tapAt=Date.now();F.dn={x:e.clientX,y:e.clientY,t:F.tapAt,st:F.st};stop();
    F.lp=setTimeout(()=>{if(!F.dn||F.dn.st!=='awake'||fxRM())return;F.dn=null;fxUserAt=Date.now();fxDo(F,'pet',true);F.pet=setInterval(()=>{if(!F.svg.isConnected)return clearInterval(F.pet);fxDo(F,'pet',true);},1500);},500);});
  svg.addEventListener('pointermove',e=>{if(F.dn&&Math.hypot(e.clientX-F.dn.x,e.clientY-F.dn.y)>10){F.dn=null;stop();}});
  svg.addEventListener('pointercancel',()=>{F.dn=null;stop();});
  svg.addEventListener('pointerleave',stop);
  svg.addEventListener('pointerup',e=>{const d=F.dn;F.dn=null;stop();if(d&&Date.now()-d.t<450)fxTap(F,e,d.st);});
  if(!fxTimer)fxTimer=setInterval(fxTick,200);
}
function liveFoxes(root){(root||document).querySelectorAll('svg.fx:not(.rc)').forEach(foxLive);}
// globalnie (raz): palec, pisanie, hasło, przewijanie — wszystko budzi lisa i przyciąga jego wzrok
(function(){
  const point=e=>{fxPtr=[e.clientX,e.clientY];fxPtrAt=Date.now();if(!fxRaf&&FXL.size)fxRaf=requestAnimationFrame(()=>{fxRaf=0;FXL.forEach(F=>{if(F.st!=='doze'&&!F.svg.classList.contains('cover'))fxAim(F,fxPtr[0],fxPtr[1]);});});};
  document.addEventListener('pointermove',point,{passive:true});
  document.addEventListener('pointerdown',e=>{point(e);fxSeen();},{passive:true});
  ['keydown','wheel'].forEach(ev=>document.addEventListener(ev,fxSeen,{passive:true}));
  document.addEventListener('scroll',fxSeen,{passive:true,capture:true});
  document.addEventListener('focusin',e=>{const t=e.target;if(!t||!/^(INPUT|TEXTAREA)$/.test(t.tagName)||/^(checkbox|radio|file|button|submit)$/.test(t.type))return;
    fxField=t;fxSeen();FXL.forEach(F=>{fxCover(F,t.type==='password');if(t.type!=='password')fxAimField(F);});});
  document.addEventListener('focusout',e=>{if(e.target!==fxField)return;fxField=null;FXL.forEach(F=>fxCover(F,false));});
  document.addEventListener('input',e=>{if(e.target!==fxField)return;fxUserAt=Date.now();FXL.forEach(F=>{if(F.st!=='doze'&&!F.svg.classList.contains('cover'))fxAimField(F);});},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)fxUserAt=Date.now();}); // powrót do apki: lis nie zasypia od razu
  document.addEventListener('resume',()=>{fxUserAt=Date.now();});
})();
/* ============================================================ BOSS — Szop Zapominalski (kradnie notatki), te same klasy fx-* co lis.
   raccoon(mood,size): idle, hit, laugh, angry, dizzy, win */
// Szop Zapominalski — boss w stylu lisa (te same klasy fx-* do animacji części). raccoon(mood,size): idle, hit, laugh, angry, dizzy, win
const RC={b:'#8A82B8',d:'#4B4570',k:'#1B1836',l:'#E4E0F7',s:'#2A2548',eye:'#FF4D6D',n:'#FFF1E6',cv:'#A855F7'};
const RC_EYES={
 idle:`<g class="fx-eyes"><ellipse cx="-19" cy="-12" rx="6" ry="5.5" fill="${RC.eye}"/><ellipse cx="19" cy="-12" rx="6" ry="5.5" fill="${RC.eye}"/><rect x="-20.2" y="-16" width="2.4" height="8" rx="1.2" fill="${RC.k}"/><rect x="17.8" y="-16" width="2.4" height="8" rx="1.2" fill="${RC.k}"/></g>`,
 angry:`<g class="fx-eyes"><ellipse cx="-19" cy="-11" rx="6" ry="4.5" fill="${RC.eye}"/><ellipse cx="19" cy="-11" rx="6" ry="4.5" fill="${RC.eye}"/><rect x="-20.2" y="-14" width="2.4" height="6" rx="1.2" fill="${RC.k}"/><rect x="17.8" y="-14" width="2.4" height="6" rx="1.2" fill="${RC.k}"/></g>`,
 hit:`<g fill="none" stroke="${RC.eye}" stroke-width="3.4" stroke-linecap="round"><path d="M-25 -16 L-15 -12 L-25 -8"/><path d="M25 -16 L15 -12 L25 -8"/></g>`,
 laugh:`<g fill="none" stroke="${RC.eye}" stroke-width="3.4" stroke-linecap="round"><path d="M-25 -10 Q-19 -18 -13 -10"/><path d="M13 -10 Q19 -18 25 -10"/></g>`,
 dizzy:`<g class="rc-spin" fill="none" stroke="${RC.eye}" stroke-width="2.6" stroke-linecap="round"><path d="M-19 -12 m-5 0 a5 5 0 1 1 5 5 a3 3 0 1 1 -3 -3"/></g><g class="rc-spin r2" fill="none" stroke="${RC.eye}" stroke-width="2.6" stroke-linecap="round"><path d="M19 -12 m-5 0 a5 5 0 1 1 5 5 a3 3 0 1 1 -3 -3"/></g>`,
 win:`<g fill="none" stroke="${RC.eye}" stroke-width="3.4" stroke-linecap="round"><path d="M-25 -10 Q-19 -18 -13 -10"/><path d="M13 -10 Q19 -18 25 -10"/></g>`};
const RC_MOUTH={
 idle:`<path d="M-12 27 Q0 34 14 24" fill="none" stroke="${RC.k}" stroke-width="2.6" stroke-linecap="round"/><path d="M6 28.5 l2 5 l2.4 -5.6 z" fill="#fff"/>`,
 angry:`<path d="M-11 31 Q0 25 11 31" fill="none" stroke="${RC.k}" stroke-width="2.8" stroke-linecap="round"/><path d="M-4 28.4 l1.6 4 l2 -4.6 z M4 28.4 l1.6 4 l2 -4.6 z" fill="#fff"/>`,
 hit:`<ellipse cx="0" cy="30" rx="6" ry="5" fill="${RC.k}"/>`,
 laugh:`<path d="M-13 24 Q0 42 13 24 Z" fill="${RC.k}"/><path d="M-6 31 Q0 38 6 31 Z" fill="#FF6B8B"/><path d="M-8 24.5 l2 4 l2 -4 z M4 24.5 l2 4 l2 -4 z" fill="#fff"/>`,
 dizzy:`<path d="M-8 30 Q-4 26 0 30 Q4 34 8 30" fill="none" stroke="${RC.k}" stroke-width="2.4" stroke-linecap="round"/><path class="rc-tongue" d="M2 31 q3 7 7 1" fill="#FF6B8B"/>`,
 win:`<path d="M-13 24 Q0 42 13 24 Z" fill="${RC.k}"/><path d="M-6 31 Q0 38 6 31 Z" fill="#FF6B8B"/><path d="M-8 24.5 l2 4 l2 -4 z M4 24.5 l2 4 l2 -4 z" fill="#fff"/>`};
const rcStar=(x,y,r,d)=>`<path class="rc-orb" style="animation-delay:${d}s" fill="#FFC043" d="M${x} ${y-r}L${x+r*.3} ${y-r*.3}L${x+r} ${y}L${x+r*.3} ${y+r*.3}L${x} ${y+r}L${x-r*.3} ${y+r*.3}L${x-r} ${y}L${x-r*.3} ${y-r*.3}Z"/>`;
const NOTE=(x,y,cls)=>`<g class="${cls||''}"><rect x="${x}" y="${y+3}" width="26" height="32" rx="4" fill="${RC.d}"/><rect x="${x}" y="${y}" width="26" height="32" rx="4" fill="${RC.cv}"/><rect x="${x+4}" y="${y+4}" width="18" height="24" rx="2" fill="${RC.n}"/><path d="M${x+7} ${y+10}h12M${x+7} ${y+15}h12M${x+7} ${y+20}h8" stroke="${RC.cv}" stroke-width="2" stroke-linecap="round"/></g>`;
const PAGE=(i)=>`<g class="rc-page p${i}"><rect x="-7" y="-9" width="14" height="18" rx="2" fill="${RC.n}"/><path d="M-4 -4h8M-4 0h8M-4 4h5" stroke="${RC.cv}" stroke-width="1.6"/></g>`;
const RC_EXTRA={
 idle:'',laugh:'',
 hit:`<g transform="translate(40 96)">${PAGE(1)}${PAGE(2)}${PAGE(3)}</g><path class="rc-bang" d="M126 40 l6 8 l9 -3 l-4 9 l7 6 l-10 1 l-2 10 l-6 -8 l-9 3 l4 -9 l-7 -6 l10 -1 z" fill="#FFC043"/>`,
 angry:`<path class="rc-vein" d="M-2 0 l4 0 M0 -2 l0 4" transform="translate(98 34) scale(2.2)" stroke="${RC.eye}" stroke-width="1.6" stroke-linecap="round"/><path class="fx-drop" d="M30 44 Q37 55 30 60 Q23 55 30 44 Z" fill="#3FD8F5"/>`,
 dizzy:rcStar(58,14,6,0)+rcStar(80,8,7,.4)+rcStar(102,14,6,.8)+NOTE(96,136,'rc-dropped'),
 win:''};
function raccoon(m,size){m=RC_EYES[m]?m:'idle';const w=size||112;
 const holds=m!=='dizzy'; // zeszyt w łapie (pokonany go upuszcza)
 return `<svg class="fx rc ${m}" width="${w}" height="${Math.round(w*170/160)}" viewBox="0 0 160 170" aria-hidden="true">
<ellipse class="fx-ground" cx="80" cy="162" rx="44" ry="5" fill="${RC.k}" opacity=".6"/>
<g class="fx-all"><g class="fx-sway">
<g class="fx-tail">
 <ellipse cx="116" cy="146" rx="17" ry="13" transform="rotate(-25 116 146)" fill="#B5AEDB"/><ellipse cx="130" cy="131" rx="16" ry="12" transform="rotate(-50 130 131)" fill="#3A3460"/>
 <ellipse cx="140" cy="113" rx="15" ry="12" transform="rotate(-70 140 113)" fill="#B5AEDB"/><ellipse cx="144" cy="95" rx="14" ry="11" transform="rotate(-82 144 95)" fill="#3A3460"/>
 <ellipse cx="143" cy="79" rx="12" ry="10" transform="rotate(-95 143 79)" fill="#B5AEDB"/><ellipse cx="140" cy="66" rx="9" ry="8" fill="#3A3460"/></g>
<path d="M48 158 Q42 112 80 102 Q118 112 112 158 Z" transform="translate(0 4)" fill="${RC.d}"/>
<path d="M48 158 Q42 112 80 102 Q118 112 112 158 Z" fill="${RC.b}"/>
<path d="M63 158 Q60 126 80 118 Q100 126 97 158 Z" fill="${RC.l}"/>
<ellipse cx="66" cy="158" rx="11" ry="5.5" fill="${RC.s}"/><ellipse cx="94" cy="158" rx="11" ry="5.5" fill="${RC.s}"/>
<g transform="translate(80 70) scale(.84)"><g class="fx-head">
 <g class="fx-earl"><path d="M-46 -20 Q-54 -58 -26 -46 Z" fill="${RC.b}"/><path d="M-42 -26 Q-46 -50 -30 -43 Z" fill="${RC.s}"/></g>
 <g class="fx-earr"><path d="M46 -20 Q54 -58 26 -46 Z" fill="${RC.b}"/><path d="M42 -26 Q46 -50 30 -43 Z" fill="${RC.s}"/></g>
 <path d="M-56 -6 Q-52 -46 0 -46 Q52 -46 56 -6 Q52 26 0 40 Q-52 26 -56 -6 Z" transform="translate(0 6)" fill="${RC.d}"/>
 <path d="M-56 -6 Q-52 -46 0 -46 Q52 -46 56 -6 Q52 26 0 40 Q-52 26 -56 -6 Z" fill="${RC.b}"/>
 <path d="M-42 8 Q-20 0 0 14 Q20 0 42 8 Q34 32 0 40 Q-34 32 -42 8 Z" fill="${RC.l}"/>
 <path d="M-6 -46 L6 -46 L3 -22 L-3 -22 Z" fill="${RC.d}"/>
 <g class="rc-brows"><path d="M-34 -28 Q-22 -36 -10 -30" fill="none" stroke="${RC.l}" stroke-width="4" stroke-linecap="round"/><path d="M34 -28 Q22 -36 10 -30" fill="none" stroke="${RC.l}" stroke-width="4" stroke-linecap="round"/></g>
 <path d="M-54 -12 Q-38 -28 -12 -18 Q0 -12 12 -18 Q38 -28 54 -12 Q44 6 16 0 Q0 6 -16 0 Q-44 6 -54 -12 Z" fill="${RC.k}"/>
 ${RC_EYES[m]}
 <ellipse cx="0" cy="17" rx="7" ry="5" fill="${RC.k}"/><ellipse cx="-2" cy="15.5" rx="2" ry="1.2" fill="#fff" opacity=".6"/>
 ${RC_MOUTH[m]}
</g></g>
<g class="fx-arml"><rect x="47" y="118" width="14" height="34" rx="7" transform="translate(2 2)" fill="${RC.d}"/><rect x="45" y="116" width="14" height="34" rx="7" fill="${RC.b}"/><ellipse cx="52" cy="148" rx="8" ry="5.5" fill="${RC.s}"/></g>
<g class="fx-armr"><rect x="101" y="118" width="14" height="34" rx="7" transform="translate(2 2)" fill="${RC.d}"/><rect x="99" y="116" width="14" height="34" rx="7" fill="${RC.b}"/><ellipse cx="106" cy="148" rx="8" ry="5.5" fill="${RC.s}"/>${holds?NOTE(94,140,'rc-note'):''}</g>
</g></g>${RC_EXTRA[m]}</svg>`;}
/* ============================================================ KAMIENIE MILOWE SERII — nagrody raz na próg (META.ms["<dni>"]=data), dodatki lisa i emotki */
const STREAK_MS=[
  {d:3,gems:20,emote:'pump'},
  {d:7,gems:50,emote:'dance',flame:'gold',badge:true},
  {d:14,gems:75,emote:'flex',item:'band',name:'opaska'},
  {d:30,gems:150,freezes:1,emote:'wind',item:'scarf',name:'szalik',flame:'blue',badge:true},
  {d:50,gems:250,emote:'medal',item:'medal',name:'medal',badge:true},
  {d:100,gems:500,freezes:2,emote:'royal',item:'crown',name:'korona',flame:'violet',badge:true},
  {d:365,emote:'hero',item:'cape',name:'peleryna i złote okulary',flame:'magenta',badge:true}];
function foxLook(n){n=n==null?streakDisplay():n;const acc=[];let flame='base',emote='';
  STREAK_MS.forEach(m=>{if(n>=m.d){if(m.item)acc.push(m.item);if(m.flame)flame=m.flame;emote=m.emote;}});
  if(n>=365){acc.push('gold');const i=acc.indexOf('band');if(i>=0)acc.splice(i,1);} // korona zamiast opaski
  return {acc,flame,emote};}
function msToday(n){return STREAK_MS.find(m=>m.d===n);}
function msAward(){const n=META.streak|0,m=msToday(n);if(!m)return;if(!META.ms||typeof META.ms!=='object')META.ms={};if(META.ms[n])return;
  META.ms[n]=todayStr();if(m.freezes)META.freezes=Math.min(FREEZE_MAX,(META.freezes|0)+m.freezes);saveMeta();if(m.gems)addGems(m.gems);}
function msNextBar(n){const nx=STREAK_MS.find(x=>x.d>n);if(!nx)return '';const prev=[...STREAK_MS].reverse().find(x=>x.d<=n);const from=prev?prev.d:0;
  const what=[nx.gems?'+'+nx.gems+' gemów':'',nx.freezes?'+'+nx.freezes+' '+pl(nx.freezes,'zamrożenie','zamrożenia','zamrożeń'):'',nx.item?nx.name:'',nx.badge?'odznaka':''].filter(Boolean).join(' · ');
  return `<div class="msnext"><div class="t"><span>Następny kamień: <b>${nx.d} dni</b></span><span>zostało ${nx.d-n}</span></div><div class="bar"><i class="a-grow" style="width:${Math.round((n-from)/(nx.d-from)*100)}%"></i></div><div class="s">czeka: ${what}</div></div>`;}
/* monogram zamiast emoji z danych: pierwsze litery nazwy w kafelku w kolorze --accent (initials niżej) */
/* tytuły z danych bez emoji (zero emoji w UI; treść HTML roladki/Info zostaje) */
function noEmoji(t){return String(t||'').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').replace(/\s+/g,' ').trim();}
function mono(label,cls){return '<div class="mono'+(cls?' '+cls:'')+'" aria-hidden="true">'+label+'</div>';}
/* P1-15: nazwy przedmiotów. Kafle i wiersze pokazują pełną nazwę (s.name, obcięcie do 2 linii w CSS); skrót tylko tam, gdzie miejsca brak (chipy, etykiety),
   i bez kolizji: w grupie przedmiotów z tym samym skrótem wspólny początek nazwy skraca się do inicjałów („P. cywilne” / „P. karne”).
   Monogram z pierwszych liter dwóch pierwszych słów (bez krótkich spójników): „Prawo cywilne” → PC, „Prawo karne” → PK. */
const nameTxt=s=>noEmoji(txt(s&&s.name));
function initials(s){const ws=nameTxt(s).split(' ').map(w=>w.replace(/[^\p{L}\p{N}]/gu,'')).filter(Boolean);const pick=[ws[0],...ws.slice(1).filter(w=>w.length>2)].filter(Boolean).slice(0,2);
  return esc(pick.length?pick.map(w=>w.charAt(0)).join('').toUpperCase():'?');}
function shortCand(s){const t=nameTxt(s);if(t.length<=16)return t;const sh=txt(s.short||'').replace(/\s+/g,' ').trim();return sh&&sh.length<t.length?sh:t.split(' ')[0];}
function sshort(s){
  const t=nameTxt(s);if(t.length<=16&&!SUBJECTS.some(x=>x!==s&&x.id!==s.id&&fold(shortCand(x))===fold(t)))return esc(t);
  const mine=shortCand(s),grp=SUBJECTS.filter(x=>x===s||x.id===s.id||fold(shortCand(x))===fold(mine));
  if(grp.length<2)return esc(mine);
  const ws=grp.map(x=>nameTxt(x).split(' ')),w=t.split(' ');let k=0; // wspólny początek nazw w grupie kolizji
  while(ws.every(a=>a.length>k+1&&fold(a[k])===fold(ws[0][k])))k++;
  if(!k)return esc(t);
  return esc(w.slice(0,k).map(x=>x.charAt(0).toUpperCase()+'.').join(' ')+' '+w.slice(k).join(' '));
}
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

/* toasty (P1-23): kolejka zamiast nadpisywania.
   toast(t, ic, anim, {go}) = odpowiedź na gest użytkownika — od razu (zastępuje bieżący; nagroda przerwana zaraz po pokazaniu wraca do kolejki).
   notify(t, ic, anim, {go}) = nagroda / zdarzenie w tle — czeka w kolejce i w „ciszy” (otwarty arkusz, trwające pytania lekcji, egzaminu, bossa,
   powtórki, cramu) aż do ekranu wyniku albo zamknięcia arkusza; potem po kolei. Czas: 1,5 s + 40 ms na znak, maks. 5 s.
   Pozycja nad dolnym paskiem (styles.css), a przy otwartym arkuszu nad nim. {go} = toast klikalny (akcja). */
let toastBox=null; // jeden trwały #toast: shell() wstawia go z powrotem, więc komunikat przeżywa przerysowanie ekranu
const toastQ=[];let toastCur=null,toastTimer=null,toastWake=null;
const TOAST_AVOID='.nav,.lesson.open .lessonfoot,.egfoot,.cfadd-foot,.today.empty .efoot,#subjscreen .fbtns,.quizview .qcheck:not(.hide)';
function toastEl(){if(!toastBox){toastBox=el('div','toast','');toastBox.id='toast';}return toastBox;}
function toastMs(t,act){return act?8000:Math.min(5000,1500+40*String(t).length);} // z akcją (np. „Lekcja gotowa — dotknij”) dłużej: to często jedyna droga do ekranu
function toastQuiet(){return !!(document.getElementById('sheet')||(lessonState&&!lessonState.done)||exState||bossState||rvState||(cramState&&!cramState.done)||view==='cfadd'||view==='cfgen');} // „Dodaj materiał” / „Tworzę lekcję”: klikalna nagroda wyprowadzała ze szkicu bez pytania
function toastShow(it){
  const ph=document.getElementById('toast');if(!ph)return false;const box=toastEl();if(ph!==box)ph.replaceWith(box);
  box.innerHTML=it.ic?icon(it.ic,{size:16,cls:'ic-'+(TOAST_TONE[it.ic]||'acid')+(it.anim?' '+it.anim:'')}):'';const s=document.createElement('span');s.textContent=it.t;box.appendChild(s);
  box.classList.toggle('act',!!it.go);box.onclick=it.go?()=>{toastHide();it.go();}:null;
  if(it.go){box.setAttribute('role','button');box.tabIndex=0;}else{box.setAttribute('role','status');box.removeAttribute('tabindex');}
  toastPlace();
  box.classList.remove('show');void box.offsetWidth;box.classList.add('show');
  toastCur={...it,at:Date.now()};clearTimeout(toastTimer);toastTimer=setTimeout(toastHide,toastMs(it.t,!!it.go));return true;
}
function toastPlace(){ // nad arkuszem albo nad najwyższym przyciskiem przy dole ekranu (stopka lekcji, ocena fiszki, nawigacja) — nie na nich
  const box=toastBox;if(!box)return;box.style.bottom='';if(!app||!box.parentNode)return;
  const ar=app.getBoundingClientRect(),sh=document.getElementById('sheet');let top=Infinity;
  if(sh){const t=sh.offsetParent===app?ar.top+sh.offsetTop:sh.getBoundingClientRect().top;if(sh.offsetHeight&&t>ar.top+80)top=t;} // offsetTop: bez przesunięcia z animacji wjazdu
  else document.querySelectorAll(TOAST_AVOID).forEach(e=>{const r=e.getBoundingClientRect();if(r.height&&r.top>ar.top+ar.height*.45&&r.top<top)top=r.top;});
  if(top<Infinity)box.style.bottom=Math.round(ar.bottom-top+12)+'px';
}
function toastHide(){clearTimeout(toastTimer);if(toastBox)toastBox.classList.remove('show');toastCur=null;clearTimeout(toastWake);toastWake=setTimeout(toastPump,320);}
function toastPump(){
  clearTimeout(toastWake);toastWake=null;if(toastCur||!toastQ.length)return;
  if(toastQuiet()){toastWake=setTimeout(toastPump,500);return;} // nagrody czekają na ekran wyniku / zamknięcie arkusza
  const it=toastQ.shift();if(!toastShow(it)){toastQ.unshift(it);toastWake=setTimeout(toastPump,400);}
}
function toast(t,ic,anim,o){
  const it={t:String(t),ic,anim,go:o&&typeof o.go==='function'?o.go:null};
  const cur=toastCur;
  if(toastShow(it)&&cur&&cur.soft&&Date.now()-cur.at<1200&&!toastQ.includes(cur))toastQ.unshift({...cur}); // nagroda ledwo widoczna — pokaże się jeszcze raz po tym komunikacie
}
function notify(t,ic,anim,o){
  const it={t:String(t),ic,anim,go:o&&typeof o.go==='function'?o.go:null,soft:true};
  if((toastCur&&toastCur.t===it.t)||toastQ.some(x=>x.t===it.t))return; // bez powtórek tego samego komunikatu
  toastQ.push(it);if(toastQ.length>8)toastQ.splice(0,toastQ.length-8);
  if(!toastCur&&!toastWake)toastPump();
}
function addXP(id,n){const s=subjState(id);if(n>0&&boostActive())n*=2;s.xp+=n;const d=daily();d.xp+=n;if(n>0)histAdd('xp',n);else if(n<0){const h=histDay();h.xp=Math.max(0,(h.xp|0)+n);}saveProgress();const ext=touchStreak();updateXP();updateStreakUI();updateGoalUI();if(n>0)missionEvent('xp',n);if(ext&&META.streak>1)notify('Seria: '+META.streak+' dni z rzędu','flame');return n;} // zwraca faktycznie dodane XP (po boostcie)
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
  levelpick:renderLevelPick,onboarding:renderOnboarding,weekly:renderWeekly,cram:renderCram,error:renderErrorView}; // krok 9
let view='today';const navHist=[]; // skąd przyszedł użytkownik: {view} albo {sid,tab} (wstecz w Albumie, Plecaku, Serii)
function go(v,back){
  if(!back&&(current||v!==view)){const top=navHist[navHist.length-1]; // przejście na poprzedni ekran = powrót; ekran błędu ma własny powrót, więc nie trafia na stos
    if(top&&!top.sid&&top.view===v)navHist.pop();else if(current||view!=='error'){navHist.push(current?{sid:current.id,tab:curTab}:{view});if(navHist.length>20)navHist.shift();}}
  view=VIEWS[v]?v:'today';
  if(/^(today|review|cards|profile|subjects)$/.test(view))navHist.length=0; // ekran z dolnej nawigacji = początek ścieżki (bez starych wpisów, np. przedmiotu po jego „wstecz”)
  current=null;applyTheme(null);
  try{clearInterval(cwInt);clearInterval(exInt);clearInterval(nhInt);clearInterval(bossInt);clearInterval(ghostInt);clearInterval(cramInt);}catch(e){}
  keyFn=null;lessonState=null;rvState=null;exState=null;bossState=null;cramState=null;taskCleanup();
  VIEWS[view]();
}
function goBack(fb){const p=navHist.pop();if(p&&p.sid)openSubject(p.sid,p.tab);else go(p&&VIEWS[p.view]?p.view:fb,true);}
const renderHome=()=>go('today'); // stary punkt wejścia

/* --- polskie daty i liczebniki --- */
const DAYS=['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'],DAYS_S=['Nd','Pn','Wt','Śr','Cz','Pt','Sb'];
const MONTHS=['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
const MONTHS_S=['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru']; // krok 7: nagłówek planu do sprawdzianu
function dateHeader(){const d=new Date();return DAYS[d.getDay()]+', '+d.getDate()+' '+MONTHS[d.getMonth()];}
function pl(n,one,few,many){n=Math.abs(n);if(n===1)return one;const m10=n%10,m100=n%100;return (m10>=2&&m10<=4&&(m100<12||m100>14))?few:many;}
function fmtNum(n){return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');}
function totalXP(){return SUBJECTS.reduce((a,s)=>a+(((PROGRESS[s.id]||{}).xp)||0),0);} // nie Object.values — PROGRESS.daily też ma xp
function subjLevel(s){return LEVEL_NAME[s.level]?s.level:'inne';} // etap przedmiotu (z konta: stage) — plan dnia i kolejność kafli
function hasProgress(s){const st=PROGRESS[s.id];return !!st&&(((st.xp||0)>0)||Object.values(st.levels||{}).some(l=>l&&l.done));}
function applyMotion(){let sys=false;try{sys=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){}document.documentElement.classList.toggle('reduce-motion',!!META.reduceMotion||sys);} // P2-9: przełącznik w apce albo ustawienie telefonu

/* --- plan dnia: PROGRESS.daily = {date, goal, xp, tasks:[{id, done, need?, prog?}]} (DESIGN.md §4.3, ten sam klucz) --- */
const REWARD={lesson:15,review:20,quiz:25,exam:40,weak:20};
function daily(){
  const t=todayStr();let d=PROGRESS.daily;
  if(!d||d.date!==t||!Array.isArray(d.tasks)){syncTests();d=PROGRESS.daily={date:t,goal:goalXP(),xp:0,tasks:buildDailyTasks()};saveProgress();} // krok 7: nowy dzień = przeliczenie planów do sprawdzianu; krok 9: cel z PROGRESS.goal
  else if(SUBJECTS.length){ // plan z innego pliku (build/<id>.html) albo zastępczy (bez postępów), a użytkownik zaczął inny przedmiot → zadania bieżących przedmiotów
    const here=d.tasks.map(x=>SUBJECTS.find(s=>s.id===x.id.split(':')[0])).filter(Boolean);
    if(!here.length||(!here.some(hasProgress)&&SUBJECTS.some(hasProgress))){const add=buildDailyTasks().filter(x=>!d.tasks.some(y=>y.id===x.id));
      if(add.length){d.tasks=d.tasks.filter(x=>{const s=SUBJECTS.find(z=>z.id===x.id.split(':')[0]);return x.done||!s||hasProgress(s);}).concat(add);saveProgress();}}
  }
  return d;
}
function buildDailyTasks(){
  let subs=SUBJECTS.filter(hasProgress);
  if(!subs.length){const mine=SUBJECTS.filter(s=>subjLevel(s)===META.level);subs=(mine.length?mine:SUBJECTS).slice(0,1);} // bez postępów: pierwszy przedmiot z etapu użytkownika
  subs=[...subs].sort((a,b)=>((PROGRESS[b.id]||{}).xp||0)-((PROGRESS[a.id]||{}).xp||0)).slice(0,2); // plan z 2 przedmiotów o największym XP
  const tasks=[];
  subs.forEach((s,i)=>{
    const st=subjState(s.id);
    const open=s.levels.find((l,i)=>levelUnlocked(s,i)&&!(st.levels[l.id]||{}).done);
    if(open)tasks.push({id:s.id+':lesson:'+open.id,done:false});
    const n=Math.min(12,allCards(s).length);
    if(n)tasks.push({id:s.id+':review',done:false,need:n,prog:0});
    const doneLv=[...s.levels].reverse().find(l=>(st.levels[l.id]||{}).done)||s.levels[0];
    if(doneLv&&(doneLv.quiz||[]).length)tasks.push({id:s.id+':quiz:'+doneLv.id,done:false});
    if(!i&&allQuiz(s).length>=5)tasks.push({id:s.id+':exam',done:false}); // egzamin tylko dla głównego przedmiotu
    if(hasDeck(s.id))tasks.push({id:s.id+':weak',done:false}); // krok 7: talia błędów z ostatniego egzaminu
  });
  return tasks;
}
/* opis zadania z jego id (etykiety liczone z danych, więc w storage siedzi tylko id + done) */
function taskInfo(t){
  const parts=t.id.split(':');const sid=parts[0],kind=parts[1],lvId=parts[2];
  const s=SUBJECTS.find(x=>x.id===sid);if(!s)return null;
  const lv=lvId?s.levels.find(l=>l.id===lvId):null;
  const short=sshort(s);const base={t,s,kind,reward:REWARD[kind]||0};
  const openAt=(tab,setup)=>()=>openSubject(sid,tab,setup);
  if(kind==='lesson'){if(!lv)return null;const nf=(lv.feed||[]).length,nq=(lv.quiz||[]).length,nt=(lv.tasks||[]).filter(t=>t&&TASKS[t.type]).length;
    return {...base,icon:'book',title:'Lekcja — '+noEmoji(lv.title),sub:`${nf} ${pl(nf,'dawka','dawki','dawek')} · ${nq} ${pl(nq,'pytanie','pytania','pytań')}${nt?` · ${nt} ${pl(nt,'zadanie','zadania','zadań')}`:''} · +15`,go:openAt('path')};}
  if(kind==='review'){const n=t.need||12,p=t.prog||0;const due=srsDue().filter(x=>x.s.id===sid).length;
    return {...base,icon:'refresh',title:`Powtórka — ${n} ${pl(n,'fiszka','fiszki','fiszek')}`,sub:p?`${p} z ${n} przejrzane · +20`:`${short} · ${due?due+' do powtórki dziś':Math.max(1,Math.round(n/4))+' min'} · +20`,
      go:()=>{const mine=srsDue().filter(x=>x.s.id===sid);if(mine.length)startReview(mine);else openAt('fiszki')();}};} // powtórka albo fiszki tego przedmiotu
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
  notify('Plan dnia: +'+r+' XP','bolt');
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
  const top=el('div','topbar');
  if(o.back){const b=el('button','backbtn',icon('back',{size:20,stroke:3}));b.setAttribute('aria-label','Wróć');b.onclick=o.back;top.appendChild(b);}
  top.appendChild(el('div',o.title?'logo ttl':'logo brand',o.title||'Cramfox<span class="g">.</span>'));
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
  app.appendChild(toastEl());
  return scroll;
}
/* arkusz „Dodaj materiał” (QuickAdd.html): zdjęcie strony / plik / tekst → przepływ w cloud-ui.js (hooki addPhoto/addFile/addText) */
function openQuickAdd(){
  const into=current?current.id:null; // z widoku przedmiotu: domyślnie dokładamy do niego
  if(hook('addOpen',into))return null; // cloud-ui.js: trwa tworzenie lekcji → ekran postępu zamiast arkusza
  const s=openSheet('quickadd',`<div class="shandle"></div>
    <div class="shead"><div class="st2">Dodaj materiał</div><button class="backbtn sclose" id="qaclose" aria-label="Zamknij">${icon('close',{size:18,stroke:3})}</button></div>
    <button class="qabig a-pop" id="qa-photo"><div class="ico a-bob">${icon('camera',{size:32,stroke:2.4})}</div><div class="grow"><div class="t">Zrób zdjęcie</div><div class="s">strona z podręcznika, zeszyt, tablica</div></div></button>
    <div class="qagrid">
      <button class="qatile pink a-up d1" id="qa-file">${icon('upload',{size:24,stroke:2.6})}<div><div class="t">Wgraj plik</div><div class="s">PDF, prezentacja albo zdjęcia</div></div></button>
      <button class="qatile cyan a-up d2" id="qa-text">${icon('list',{size:24,stroke:2.6})}<div><div class="t">Wklej tekst</div><div class="s">notatki, konspekt, zagadnienia</div></div></button>
    </div>
    <button class="qatest a-up d3" id="qa-test">${icon('calendar',{size:20,stroke:2.4})}<span>Mam sprawdzian — ułóż mi plan</span>${icon('chevron-right',{size:18,stroke:2.6,cls:'chev'})}</button>`);
  sheetBack();document.getElementById('sheetback').onclick=closeSheet;
  s.querySelector('#qaclose').onclick=closeSheet;
  s.querySelector('#qa-test').onclick=()=>{if(!SUBJECTS.length){toast('Najpierw dodaj materiał — plan układa się z poziomów','info');return;}openTestSheet(current?current.id:null);}; // krok 7
  s.querySelector('#qa-photo').onclick=()=>{closeSheet();hook('addPhoto',into);};
  s.querySelector('#qa-file').onclick=()=>{closeSheet();hook('addFile',into);};
  s.querySelector('#qa-text').onclick=()=>{closeSheet();hook('addText',into);};
  hook('addSheet',s); // cloud-ui.js: ile nowych lekcji zostało — darmowe na zawsze albo w tym miesiącu (P1-12)
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
    t.innerHTML=`${mono(initials(s),'solid')}<div class="name">${noEmoji(s.name)}</div>
      <div class="bar"><i class="a-grow d${Math.min(6,i+2)}" style="width:${pct}%"></i></div><small>${done}/${total} ${pl(total,'poziom','poziomy','poziomów')}</small>`;
    t.setAttribute('aria-label',txt(s.name)+', '+done+' z '+total+' poziomów');
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
    let state='later';if(x.t.done)state='done';else if(!cur&&!x.info){cur=true;state='cur';} // info = wiersz „Sprawdzian dziś” (nie jest zadaniem)
    const row=el('button','plan-row '+state+' themed');
    row.style.setProperty('--accent',x.s.accent);if(x.s.onAccent)row.style.setProperty('--on-accent',x.s.onAccent);
    row.dataset.task=x.t.id;
    row.innerHTML=`<div class="plan-tile${state==='cur'?' a-pulse':''}">${state==='done'?icon('check',{size:19,stroke:3.4}):icon(x.icon,{size:19,stroke:state==='cur'?3:2.6})}</div>
      <div class="pt"><div class="t">${x.title}</div>${state==='done'?'':`<div class="s">${x.sub}</div>`}</div>
      ${state==='done'?(x.reward?`<span class="rw">+${x.reward}</span>`:''):icon('chevron-right',{size:20,cls:'chev'})}`;
    row.setAttribute('aria-label',(state==='done'?'Zrobione: ':'')+txt(x.title));
    row.onclick=x.go;
    card.appendChild(row);
  });
  return card;
}

/* ============================================================ DZIŚ (ekran startowy, Main.html) */
function renderToday(){
  if(!SUBJECTS.length)return renderEmpty();
  const scroll=shell('today',{cls:'today'});
  syncTests();
  const d=daily();const items=tests().map(testTodayItem).filter(Boolean).concat(d.tasks.map(taskInfo).filter(Boolean)); // krok 7: wiersz „Do sprawdzianu” na górze
  const done=items.filter(x=>x.t.done).length,total=items.filter(x=>!x.info).length;
  scroll.appendChild(el('div','todayhead',`<div class="eyebrow">${dateHeader()}</div><h1>Plan na dziś</h1><div class="todayfox">${fox('idle',66)}</div>`));liveFoxes(scroll);
  hook('todayTop',scroll); // cloud-ui.js: wiersz „Tworzę lekcję…” albo karta nieudanej próby (P1-22)
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
  const withP=SUBJECTS.filter(hasProgress),rest=SUBJECTS.filter(s=>!hasProgress(s)).sort((a,b)=>(subjLevel(b)===META.level)-(subjLevel(a)===META.level)); // bez postępu: najpierw z etapu użytkownika
  scroll.appendChild(subjectGrid(withP.concat(rest).slice(0,3),true));
}

/* ============================================================ PRZEDMIOTY (dawny wybór przedmiotu → kafle) */
function renderSubjects(){
  const scroll=shell('subjects',{cls:'subjects'});
  const n=SUBJECTS.length;
  scroll.appendChild(el('div','',`<div class="eyebrow">${n} ${pl(n,'przedmiot','przedmioty','przedmiotów')}</div><h1>Przedmioty</h1>`));
  scroll.appendChild(subjectGrid(SUBJECTS,true));
}

/* ============================================================ PROFIL (statystyki z postępów; pełna wersja w kroku 8–9) */
function renderProfile(){
  const gear=el('button','backbtn',icon('settings',{size:19,stroke:2.4}));gear.setAttribute('aria-label','Ustawienia');gear.onclick=()=>go('settings');
  const scroll=shell('profile',{cls:'profile',title:'Profil',pills:false,right:gear});
  const tot=totalXP();
  const lvls=SUBJECTS.reduce((a,s)=>{const st=PROGRESS[s.id];return a+s.levels.filter(l=>st&&st.levels&&st.levels[l.id]&&st.levels[l.id].done).length;},0);
  const lvTotal=SUBJECTS.reduce((a,s)=>a+s.levels.length,0);
  const started=SUBJECTS.filter(hasProgress);
  const n=streakDisplay(),best=Math.max(META.best||0,n);
  const lvlNum=Math.floor(tot/100)+1,lvlPct=tot%100;
  const all=srsEntries(),mem=srsStats(all);
  scroll.appendChild(el('div','prof',`<div class="avatar a-pop">${icon('user',{size:34,stroke:2.6})}</div>
    <div class="pmeta"><h2>Twój profil</h2><div class="s">${hook('profileSub')||'Twoje konto'}</div>
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
  sec('XP w przedmiotach','Wszystkie',()=>go('subjects'));
  const card=el('div','setcard a-up d5');
  started.forEach((s,i)=>{
    if(i)card.appendChild(el('div','setsep'));
    const r=el('button','setrow themed');r.style.setProperty('--accent',s.accent);if(s.onAccent)r.style.setProperty('--on-accent',s.onAccent);
    r.innerHTML=`${mono(initials(s),'solid xs')}<span class="t grow nm">${noEmoji(s.name)}</span><span class="v">${fmtNum(subjState(s.id).xp)} xp</span>${icon('chevron-right',{size:18,cls:'chev'})}`;
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
   Konto (cloud-ui.js) · Profil (etap i cel → LevelPick, cel dzienny → Onboarding, motyw → Plecak) · Nauka (animacje, życia) · Przedmioty ·
   Dane (reset — postępy synchronizują się z kontem, więc bez eksportu/importu plików) · O aplikacji (wersja, co nowego). */
const CHANGELOG=[
  ['3.0','Konto i przedmioty z własnych materiałów: zdjęcia, PDF i tekst zamieniane w lekcje'],
  ['2.0','Egzamin próbny z oceną, plan do sprawdzianu, noc przed egzaminem, gemy, misje, album pojęć i boss rozdziału'],
  ['1.0','Ścieżka poziomów, lekcje z lisem, fiszki, quiz, zadania i powtórka na interwałach']
];
function toggleBtn(on,label,onChange){const tg=el('button','toggle'+(on?' on':''),'<i></i>');tg.setAttribute('role','switch');tg.setAttribute('aria-checked',String(!!on));tg.setAttribute('aria-label',label);
  tg.onclick=()=>{const v=!tg.classList.contains('on');tg.classList.toggle('on',v);tg.setAttribute('aria-checked',String(v));onChange(v);};return tg;}
function renderSettings(){
  const scroll=shell('settings',{cls:'settings',title:'Ustawienia',pills:false,back:()=>go('profile')});
  const card=(cls)=>el('div','setcard a-up '+(cls||''));
  const linkRow=(ic,t,v,go_,id)=>{const r=el('button','setrow',(ic?icon(ic,{size:20,stroke:2.4}):'')+`<div class="grow"><div class="t">${t}</div>${v&&v.s?`<div class="s">${v.s}</div>`:''}</div>${v&&v.v?`<span class="v acid">${v.v}</span>`:''}`+icon('chevron-right',{size:18,cls:'chev'}));if(id)r.id=id;r.onclick=go_;return r;};
  const sep=()=>el('div','setsep');
  hook('settingsTop',scroll); // karta „Konto” (cloud-ui.js)
  // Profil
  scroll.appendChild(el('div','eyebrow sec','Profil'));
  const c0=card('d1');
  const lvl=own(LEVEL_NAME,META.level)?LEVEL_NAME[META.level]:'nie wybrano';const gl=own(GOAL_NAME,META.goal)?GOAL_NAME[META.goal]:''; // tylko ze słowników (META z synchronizacji)
  c0.appendChild(linkRow('cap','Etap i cel',{s:lvl+(gl?' · '+gl:'')},()=>openLevelPick('settings'),'set-level'));c0.appendChild(sep());
  c0.appendChild(linkRow('bolt','Cel dzienny',{v:goalXP()+' XP',s:'plan dnia, pasek XP i misja XP'},()=>openOnboarding('settings'),'set-goal'));c0.appendChild(sep());
  const th=THEMES.find(t=>t[0]===(PROGRESS.theme||'acid'))||THEMES[0];
  c0.appendChild(linkRow('palette','Okulary lisa',{v:th[1],s:themes().length+' z '+THEMES.length+' kolorów · kolejne w plecaku'},()=>go('shop'),'set-theme'));
  scroll.appendChild(c0);
  // Nauka
  scroll.appendChild(el('div','eyebrow sec','Nauka'));
  const c1=card('d2');
  let sysRM=false;try{sysRM=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){}
  const rm=el('div','setrow','<div class="grow"><div class="t">Ogranicz animacje</div><div class="s">'+(sysRM?'telefon ma włączone ograniczenie ruchu — animacje są ograniczone zawsze':'działa też wtedy, gdy telefon ma animacje włączone')+'</div></div>');
  rm.appendChild(toggleBtn(!!META.reduceMotion,'Ogranicz animacje',v=>{META.reduceMotion=v;saveMeta();applyMotion();}));c1.appendChild(rm);c1.appendChild(sep());
  const h=hearts();const eta=heartEta();
  const hr=el('button','setrow',icon('heart',{size:20,cls:'ic-red'})+`<div class="grow"><div class="t">Życia</div><div class="s">${h.n} z ${HEARTS_MAX} · jedno wraca co 30 min${eta?' · następne za '+etaText(eta):''} · ${HEART_REV} fiszek = +1</div></div>`);
  hr.onclick=()=>toast(eta?'Kolejne życie za '+etaText(eta):'Pełne życia','heart');c1.appendChild(hr);
  scroll.appendChild(c1);
  // Przedmioty
  scroll.appendChild(el('div','eyebrow sec','Przedmioty'));
  const c3=card('d3');
  SUBJECTS.forEach((s,i)=>{
    if(i)c3.appendChild(sep());
    const r=el('button','setrow themed');r.style.setProperty('--accent',s.accent);if(s.onAccent)r.style.setProperty('--on-accent',s.onAccent);
    r.innerHTML=`${mono(initials(s),'solid xs')}<span class="t grow nm">${noEmoji(s.name)}</span>${icon('chevron-right',{size:18,cls:'chev'})}`;
    r.onclick=()=>openSubject(s.id);c3.appendChild(r);
  });
  if(SUBJECTS.length)c3.appendChild(sep());
  const add=el('button','setrow acid',icon('plus',{size:20,stroke:3})+'<span class="t grow">Dodaj materiał</span>');
  add.onclick=()=>openQuickAdd();c3.appendChild(add);
  scroll.appendChild(c3);
  // Dane: postępy synchronizują się z kontem — zostaje tylko reset (epoch = nowszy stan wygrywa w całości przy scalaniu w cloud.js)
  scroll.appendChild(el('div','eyebrow sec','Dane'));
  const c4=card('d4');
  const n=Object.keys(history()).length;
  const reset=el('button','setrow',icon('refresh',{size:20,stroke:2.6,cls:'ic-red'})+`<div class="grow"><div class="t red">Wyzeruj postępy</div><div class="s">XP, gwiazdki, gemy, album, odznaki, plany${n?' · dziennik: '+n+' '+pl(n,'dzień','dni','dni'):''}. Seria zostaje.</div></div>`);
  reset.id='set-reset';
  reset.onclick=async()=>{
    if(!await ask({title:'Wyzerować postępy?',text:'Skasuje XP, gwiazdki, gemy, album, odznaki, plan dnia, wyniki egzaminów i plany do sprawdzianów — także na innych urządzeniach z tym kontem. Seria zostaje.',ok:'Wyzeruj',danger:true}))return;
    const keep={epoch:Date.now()};if(PROGRESS.goal)keep.goal=PROGRESS.goal;if(PROGRESS.overrides)keep.overrides=PROGRESS.overrides; // cel dzienny i poprawki pytań to ustawienia, nie postęp
    PROGRESS=keep;saveProgress();qState=null;fState=null;exCfg=null;tpId=null;
    renderSettings();toast('Postępy wyzerowane','refresh');
  };
  c4.appendChild(reset);scroll.appendChild(c4);
  // O aplikacji
  scroll.appendChild(el('div','eyebrow sec','O aplikacji'));
  const c5=card('d5');
  c5.appendChild(el('div','setrow',icon('info',{size:20,stroke:2.4})+`<div class="grow"><div class="t">Cramfox ${VERSION}</div><div class="s">konto w chmurze, nauka działa też bez internetu</div></div>`));
  hook('settingsAbout',c5); // cloud-ui.js: pomoc i kontakt, polityka prywatności, regulamin, licencje (każdy wiersz z własnym separatorem)
  c5.appendChild(sep());
  const wn=el('button','setrow',icon('list',{size:20,stroke:2.4})+'<div class="grow"><div class="t">Co nowego</div><div class="s">zmiany w aplikacji</div></div>'+icon('chevron-down',{size:18,cls:'chev'}));wn.id='set-whatsnew';
  const log=el('div','changelog');log.hidden=true;
  CHANGELOG.forEach(([v,t])=>log.appendChild(el('div','chrow',`<b>${v}</b><span>${t}</span>`)));
  wn.onclick=()=>{log.hidden=!log.hidden;wn.querySelector('.chev').outerHTML=icon(log.hidden?'chevron-down':'chevron-up',{size:18,cls:'chev'});};
  c5.appendChild(wn);c5.appendChild(log);scroll.appendChild(c5);
  scroll.appendChild(el('div','version',`Cramfox · wersja ${VERSION}`));
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
  sc.appendChild(el('div','streakbg'));
  const scroll=el('div','scroll streakview');
  const close=el('button','streakclose',icon('close',{size:18,stroke:3}));close.setAttribute('aria-label','Zamknij');close.onclick=()=>goBack('today');
  scroll.appendChild(close);
  const n=streakDisplay(),best=Math.max(META.best||0,n);
  const left=best-n+1;
  const msg=n===0?'Zrób dziś jedno zadanie z planu i seria startuje.':(n>=best?'To Twój rekord. Nie przerywaj.':`Rekord to ${best}. Jeszcze ${left} ${pl(left,'dzień','dni','dni')} i bijesz swój wynik.`);
  scroll.appendChild(el('div','streakhero',`<div class="streakfox">${fox('fire',150)}</div><div class="streakn a-pop">${n}</div><div class="streakt">${n===1?'dzień z rzędu':'dni z rzędu'}</div><div class="streakp">${msg}</div>`));
  scroll.appendChild(el('div','a-up d2',msNextBar(n)));
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

/* ============================================================ PUSTY STAN (EmptyState.html) — nowe konto bez przedmiotów; część ekranu Dziś, z dolną nawigacją */
function renderEmpty(){
  const scroll=shell('today',{cls:'today empty'});
  const steps=[['Dodajesz zdjęcia, pliki i notatki','strona z podręcznika, PDF, wklejony tekst'],['Powstają poziomy, fiszki i pytania','pytania poprawisz w trakcie nauki'],['Uczysz się po 10 minut dziennie','materiał wraca tuż przed zapomnieniem']];
  scroll.innerHTML=`<div class="emptyfox">${fox('idle',150)}</div>
    <div class="a-up d1"><h1>Zacznij od pierwszego przedmiotu</h1><p>Dodaj materiały z zajęć. Reszta powstanie sama.</p></div>
    <div id="emptytop"></div>
    <div class="steps">${steps.map((s,i)=>`<div class="step a-up d${i+2}"><div class="num">${i+1}</div><div><div class="t">${s[0]}</div><div class="s">${s[1]}</div></div></div>`).join('')}</div>
    <div class="efoot"><button class="pill a-glow" id="eadd">Dodaj materiał</button></div>`;
  document.getElementById('eadd').onclick=()=>openQuickAdd();
  const top=document.getElementById('emptytop');hook('todayTop',top);if(!top.children.length)top.remove(); // pierwsza lekcja w trakcie albo nieudana — też na pustym Dziś
  hook('emptyToday',scroll); // cloud-ui.js: darmowe lekcje wykorzystane → inny tekst i bez świecącego „Dodaj materiał”
  liveFoxes(scroll);
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
function heartReview(){const h=hearts();if(!h.quest)return;h.quest--;if(h.quest<=0){delete h.quest;gainHeart();notify('Życie odzyskane: +1','heart');}saveProgress();}
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
  if(calmMotion())return c; // P2-9: przy ograniczonym ruchu bez kawałków (inaczej zostają jako kolorowe kwadraty na pytaniach i tytułach)
  for(let i=0;i<n;i++){const p=el('i','a-fall'+(i%7?' d'+(i%7):'')+(i%3===1?' round':''));p.style.cssText=`left:${(i*37+11)%92}%;top:${(i*53+40)%300}px;--c:var(--${CONF[i%4]});--s:${7+(i*5)%7}px`;c.appendChild(p);}
  return c;
}

/* panel od dołu (.sheet.ok / .bad / .nohearts): jeden na raz, [data-primary] = przycisk pod Enter */
function openSheet(kind,html){
  closeSheet();
  const s=el('div','sheet a-rise '+kind,html);s.id='sheet';s.setAttribute('role','dialog');
  app.appendChild(s);if(toastCur)requestAnimationFrame(toastPlace); // widoczny toast przeskakuje nad arkusz
  keyFn=e=>{if(e.key==='Enter'||e.key===' '){const b=s.querySelector('[data-primary]');if(b){e.preventDefault();b.click();}}};
  return s;
}
function closeSheet(){const s=document.getElementById('sheet');if(s)s.remove();const b=document.getElementById('sheetback');if(b)b.remove();clearInterval(nhInt);keyFn=null;if(s&&toastCur)toastPlace();}
function sheetBack(){if(!document.getElementById('sheetback')){const b=el('div','sheetback');b.id='sheetback';app.appendChild(b);}}
/* potwierdzenie w stylu aplikacji zamiast confirm()/alert() (na iOS systemowe okno ma angielskie „Cancel”/„OK”).
   ask({title, text, ok='OK', cancel='Anuluj', danger=false}) → Promise<boolean>; cancel:null = tylko jeden przycisk (zamiast alert()).
   Tło, „Anuluj” i Escape = false. Tekst jest zwykłym tekstem (escapowany tutaj). Dostępne dla cloud-ui.js jako NaukaEngine.ask. */
function ask(o){o=o||{};return new Promise(res=>{
  if(!app){res(false);return;}
  const prevKey=document.getElementById('sheet')?null:keyFn; // klawiatura ekranu pod spodem wraca po zamknięciu (nie z innego, zastąpionego arkusza)
  const cancel=o.cancel===null?'':(o.cancel||'Anuluj');
  const sh=openSheet('ask'+(o.danger?' danger':''),`<div class="shandle"></div><div class="shead"><div class="st2">${esc(o.title||'Na pewno?')}</div></div>
    ${o.text?`<p class="sp">${esc(o.text)}</p>`:''}
    <div class="sbtns">${cancel?`<button class="pill ghost" id="askno"${o.danger?' data-primary':''}>${esc(cancel)}</button>`:''}<button class="pill${o.danger?' red':''}" id="askok"${o.danger&&cancel?'':' data-primary'}>${esc(o.ok||'OK')}</button></div>`);
  sh.setAttribute('aria-modal','true');sheetBack();let done=false;
  const fin=v=>{if(done)return;done=true;closeSheet();keyFn=prevKey;res(v);};
  sh.querySelector('#askok').onclick=()=>fin(true);const no=sh.querySelector('#askno');if(no)no.onclick=()=>fin(false);
  document.getElementById('sheetback').onclick=()=>fin(!cancel);
  const kf=keyFn;keyFn=e=>{if(e.key==='Escape'){e.preventDefault();fin(!cancel);}else kf(e);};
});}
function sheetFox(s,pool){liveFoxes(s);const sv=s.querySelector('svg.fx');if(sv)setTimeout(()=>{if(sv.isConnected)foxAct(sv,fxW(pool));},350);} // lis w panelu reaguje, nie tylko pętla
/* dobrze: ikona, „Dobrze!”, combo, chip +XP (z mnożnikiem; o.xp to kwota przed boostem, addXP ją podwaja), wyjaśnienie e, DALEJ */
function sheetOk(q,o){
  const s=openSheet('ok',`<div class="sfox">${fox('happy',84)}</div><div class="srow"><div class="sico a-pop d2">${icon('check',{size:26,stroke:3.6})}</div>
    <div class="grow"><div class="st">Dobrze!</div><div class="ss">${comboText(o.combo)}</div></div>
    <span class="xpchip a-pop d3">+${o.xp*(boostActive()?2:1)} XP${o.mult>1?' ×'+o.mult:''}</span></div>
    ${q.e?`<div class="sbox"><div class="lbl">Dlaczego</div><div>${q.e}</div>${srcLine(q)}</div>`:srcLine(q)}
    <button class="pill" id="snext" data-primary>DALEJ</button>`);
  s.querySelector('#snext').onclick=()=>{if(!advOk())return;closeSheet();o.onNext();};
  wireSrc(s,q,o,()=>sheetOk(q,o)); // krok 9: „Źródło” → arkusz SourceView
  sheetFox(s,o.combo>=3?[['wiggle',1]]:[['wink',1],['giggle',1],['blep',.6],['hum',.5]]);
  return s;
}
/* źle: „Nie tym razem”, poprawna litera, wyjaśnienie, [WYJAŚNIJ INACZEJ] DALEJ. o={onNext, onCards?, sub?, subj?, lv?} */
function sheetBad(q,o){
  const ex=q.q?explainFor(q,o.subj,o.lv):{},canEx=!!(ex.card||ex.frag||ex.real); // „Wyjaśnij inaczej” tylko, gdy jest coś pewnego do pokazania
  const sub=o.sub!=null?o.sub:(q.c!=null&&q.a&&q.a[q.c]!=null?'Dobra odpowiedź: '+q.a[q.c]:''); // treść, nie litera — odpowiedzi są tasowane
  const s=openSheet('bad',`<div class="sfox">${fox('oops',84)}</div><div class="srow"><div class="sico">${icon('close',{size:24,stroke:3.6})}</div>
    <div class="grow"><div class="st">Nie tym razem</div>${sub?`<div class="ss">${sub}</div>`:''}</div></div>
    ${q.e?`<div class="sbox"><div class="lbl">Dlaczego</div><div>${q.e}</div>${srcLine(q)}</div>`:srcLine(q)}
    <div class="sbtns">${canEx?'<button class="pill ghost red" id="sexpl">WYJAŚNIJ INACZEJ</button>':''}<button class="pill red" id="snext" data-primary>DALEJ</button></div>
    ${q.q&&o.subj&&o.lv&&o.qi!=null?`<button class="pill text sm" id="sedit">${icon('edit',{size:15})} Popraw pytanie</button>`:''}`);
  s.querySelector('#snext').onclick=()=>{if(!advOk())return;closeSheet();o.onNext();};
  const x=s.querySelector('#sexpl');if(x)x.onclick=()=>openExplain(q,o);
  const ed=s.querySelector('#sedit');if(ed)ed.onclick=()=>openEditContent(o.subj,o.lv,o.qi,{onBack:()=>sheetBad(q,o),onSaved:()=>sheetBad({...q,...qOf(o.subj,o.lv,o.qi,q.pm||q.a.map((_,k)=>k))},o)}); // krok 9: EditContent (ten sam układ odpowiedzi co na ekranie)
  wireSrc(s,q,o,()=>sheetBad(q,o)); // krok 9: „Źródło” → arkusz SourceView
  sheetFox(s,[['sigh',1],['scratch',1],['nod',.6]]);
  return s;
}
/* krok 9: linia „Źródło” (src:{material,page,quote}) jako przycisk → arkusz SourceView; wireSrc podpina ją w panelach dobrze/źle */
function srcLine(q){const src=q&&q.src;if(!src)return '';const parts=[src.material?'materiał '+src.material:'',src.page?'s. '+src.page:''].filter(Boolean).join(' · ');
  return `<button class="rsrc" type="button">${icon('file',{size:14})}<span>${parts?'<b>Źródło:</b> '+parts:'<b>Źródło</b>'}${src.quote?' — „'+src.quote+'”':''}</span>${icon('chevron-right',{size:14,cls:'chev'})}</button>`;}
function wireSrc(sheet,q,o,back){const b=sheet.querySelector('.rsrc');if(b)b.onclick=()=>openSourceView(q,{s:o.subj,lv:o.lv,qi:o.qi},back);}
/* „Wyjaśnijmy inaczej” (Explain.html) — z Twoich materiałów, bez AI: poprawna odpowiedź, „Prościej” (pole real najlepiej pasującej dawki — zatwierdzone
   „Powiedz prościej”, BIBLIA §10.3), fiszka z tym hasłem i fragment lekcji z tego poziomu. P1-10: dopasowanie ostrzejsze — hasło fiszki z ≤ 2 słowami
   kluczowymi musi mieć w odpowiedzi wszystkie, dłuższe ≥ 2 i ≥ 2/3; rdzenie obecne w ponad 25% haseł przedmiotu („polityka”, „społeczna”) się nie liczą.
   Nic pewnego → przycisk się nie pokazuje. */
const STOP=new Set(['jest','jak','czym','ktore','ktory','ktora','jaki','jaka','jakie','oraz','albo','lub','nie','tak','dla','sie','przez','tego','tym','ten','czy','ile','kto','gdzie','kiedy','moze','jego','jej','ich','tylko','bardzo','oznacza','polega','rozni','przyklad','wedlug','miedzy','pod','nad','przy','bez','jako','tzw','jakiego','jakiej','jakim','wobec','ktorych','ktorym','czego','czemu','dlaczego','zawsze','nigdy','wszystkie','wszystkich','nazywa','nazywamy','ktora','byla','byly','beda','bedzie','jednak','wtedy','niz','ktorego','robi','ma','ile','sa']);
function words(str){return fold(txt(String(str||'').replace(/<[^>]+>/g,' '))).split(' ').filter(w=>w.length>=4&&!STOP.has(w));}
function stem(w){return w.length>6?w.slice(0,w.length-2):w.length>4?w.slice(0,w.length-1):w;} // prosty rdzeń: obcina końcówkę fleksyjną
function overlap(qs,str){const t=new Set(words(str).map(stem));let k=0;qs.forEach(w=>{if(t.has(w))k++;});return k;}
function keyWords(str){const t=txt(String(str||'').replace(/<[^>]+>/g,' '));return [...words(t),...(t.match(/[\p{L}\p{N}]+/gu)||[]).filter(w=>w.length>=2&&w.length<=3&&/[A-Z0-9]/.test(w)&&!/^\d+$/.test(w)).map(fold)].map(stem);} // + krótkie skróty: ATP, DNA, pH, CO2 (same liczby nie)
const ANT=[['zwieksz','zmniejsz'],['wzrost','spad'],['wiecej','mniej'],['wyzsz','nizsz'],['dodatn','ujemn'],['rosn','malej'],['przyspiesz','spowalni'],['pobudz','hamuj']]; // pary przeciwieństw: fragment o „zmniejszeniu” nie tłumaczy „zwiększenia”
function sides(str){const f=' '+fold(txt(String(str||'')))+' ';return ANT.map(([a,b])=>(f.includes(' '+a)?1:0)|(f.includes(' '+b)?2:0));}
function explainFor(q,subj,lv){ // tylko rzeczy naprawdę związane z poprawną odpowiedzią — jedno wspólne słowo (np. imię) to za mało
  const s=subj||current;if(!s||q.c==null||!q.a||q.a[q.c]==null)return {};
  const cards=s.levels.flatMap(l=>l.flashcards||[]),df=new Map(); // rdzenie wspólne dla wielu haseł przedmiotu (ponad ok. 25%) nie odróżniają pojęć
  cards.forEach(c=>new Set(keyWords(c.t)).forEach(w=>df.set(w,(df.get(w)||0)+1)));
  const common=new Set(cards.length>=4?[...df].filter(([,n])=>n/cards.length>.25).map(([w])=>w):[]);
  const awAll=[...new Set(keyWords(q.a[q.c]))],aw=awAll.filter(w=>!common.has(w));if(!aw.length)return {};
  const apos=words(q.a[q.c]).map(stem); // kolejność słów odpowiedzi
  const qw=new Set(keyWords(q.q));
  const dw=new Set(q.a.flatMap((x,i)=>i===q.c?[]:keyWords(x)).filter(w=>!awAll.includes(w)&&!qw.has(w)&&!common.has(w))); // słowa tylko z błędnych opcji
  const as=sides(q.a[q.c]),aNeg=/(^| )(nie|bez|brak)( |$)/.test(fold(txt(q.a[q.c])));
  const lvOrder=lv?[lv].concat(s.levels.filter(l=>l!==lv)):s.levels;
  let card=null,cs=0; // fiszka: hasło krótkie (≤ 2 słowa kluczowe) — wszystkie w odpowiedzi; dłuższe — co najmniej 2 i 2/3
  const variants=t=>{const v=txt(t).replace(/\s+/g,' ').trim(),m=v.match(/^(.+?)\s*\(([^()]+)\)\s*$/);return m?[v,m[1],m[2]]:[v];}; // „Seed phrase (BIP-39)”: nawias to drugi zapis hasła
  // druga droga (przegląd Build 7): pytanie wprost o pojęcie z fiszki („Co to dekomodyfikacja?”, „Czym jest deficit bias?”) — wszystkie słowa hasła są
  // w pytaniu, a definicja mówi to samo co poprawna odpowiedź (≥ 2 wspólne rzadkie słowa, bez słów z błędnych opcji i bez przeciwnego kierunku);
  // nie przy pytaniach z przeczeniem („Co NIE jest cechą…”), gdzie definicja pojęcia nie tłumaczy wybranej opcji
  const qNeg=/(^| )(nie|bez|brak)( |$)/.test(fold(txt(q.q))),need=Math.min(2,aw.length);
  const defOk=d=>{const dws=new Set(keyWords(d));if([...dws].some(w=>dw.has(w)))return 0;const ps=sides(d);if(ps.some((v,i)=>v&&as[i]&&!(v&as[i])))return 0;const sh=aw.filter(w=>dws.has(w)).length;return sh>=need&&sh>=1?sh:0;};
  lvOrder.forEach(l=>(l.flashcards||[]).forEach(c=>variants(c.t).forEach(t=>{const tw=[...new Set(keyWords(esc(t)))].filter(w=>!common.has(w));if(!tw.length)return;const hits=tw.filter(w=>aw.includes(w)),hit=hits.length;
    const rare=Math.min(...tw.map(w=>df.get(w)||0)),ord=hits.map(w=>apos.indexOf(w)); // dłuższe hasło: trafione też najrzadsze słowo i w tej samej kolejności („Społeczna Gospodarka Rynkowa” ≠ „gospodarką … społeczna”)
    const pass=tw.length<=2?hit===tw.length:(hit>=2&&hit/tw.length>=2/3&&hits.some(w=>(df.get(w)||0)===rare)&&ord.every((p,i)=>!i||p>ord[i-1]));if(pass&&hit>cs){cs=hit;card=c;return;}
    if(pass||qNeg||!tw.every(w=>qw.has(w)))return;const sh=defOk(c.d);if(sh&&sh>cs){cs=sh;card=c;}})));
  let frag=null,fs=0,fdose=null;const key=card?fold(txt(card.t)):''; // fragment lekcji (tylko z tego poziomu): punkt listy albo zdanie z hasłem fiszki (tylko tej, która przeszła) albo z co najmniej połową słów odpowiedzi
  const fits=t=>{const pw=new Set(keyWords(t));if([...pw].some(w=>dw.has(w)))return null; // mówi o błędnej opcji — mógłby ją „potwierdzić”
    const ps=sides(t);if(ps.some((v,i)=>v&&as[i]&&!(v&as[i])))return null; // odpowiedź „zwiększa”, tekst „zmniejsza”
    const hit=aw.filter(w=>pw.has(w)).length,hasKey=!!key&&fold(t).includes(key);return (hasKey||hit>=Math.max(2,Math.ceil(aw.length*.5)))?hit+(hasKey?2:0):null;};
  (lv?[lv]:s.levels).forEach(l=>(l.feed||[]).forEach(f=>doseChunks(f).forEach(h=>h.split(/\s*•\s*|(?<=[.!?])\s+(?=(?:<[a-z0-9]+>)*[A-ZĄĆĘŁŃÓŚŹŻÁÉÍÓÚÑ¿¡„"])/).forEach(p=>{
    const pt=txt(p).trim();if(pt.length<4||pt.length>260)return;
    if(aNeg&&!/(^| )(nie|bez|brak)( |$)/.test(fold(pt)))return; // odpowiedź z przeczeniem, fragment bez niego
    const sc=fits(pt);if(sc!=null&&sc>fs){fs=sc;frag=p.trim();fdose=f;}}))));
  // „Prościej”: pole real dawki, z której jest fragment, a bez fragmentu — dawki najlepiej pasującej do odpowiedzi (tekst dawki + real + schemat);
  // samo real nie może mówić o błędnej opcji ani mieć przeciwnego kierunku („zmniejsza” przy „zwiększa”)
  const realSafe=r=>{const rt=txt(r||'').trim();if(!rt)return false;const pw=new Set(keyWords(rt));if([...pw].some(w=>dw.has(w)))return false;const ps=sides(rt);return !ps.some((v,i)=>v&&as[i]&&!(v&as[i]));};
  let real=fdose&&realSafe(fdose.real)?fdose.real:null;
  if(!real){let rs=0;(lv?[lv]:s.levels).forEach(l=>(l.feed||[]).forEach(f=>{if(!f||!realSafe(f.real))return;
    const rw=new Set(keyWords(f.real));if(!aw.some(w=>rw.has(w)))return; // bez fragmentu: samo real też musi dotyczyć odpowiedzi (choć jedno słowo kluczowe)
    const sc=fits(txt(f.body||'')+' '+txt(f.real)+' '+txt(vizPlain(f.viz)));if(sc!=null&&sc>rs){rs=sc;real=f.real;}}));}
  return {card,frag,real};
}
function openExplain(q,o){
  const {card,frag,real}=explainFor(q,o.subj,o.lv);
  const parts=[];
  if(q.c!=null&&q.a)parts.push(`<span class="lbl">Poprawna odpowiedź</span><b>${q.a[q.c]}</b>`);
  if(real)parts.push(`<span class="lbl">Prościej</span>${real}`); // P1-10: „Powiedz prościej” na pierwszym miejscu wśród wyjaśnień
  if(card)parts.push(`<span class="lbl">Fiszka</span><b>${card.t}</b> — ${card.d}`);
  if(frag)parts.push(`<span class="lbl">W lekcji było</span>${frag}`);
  const s=openSheet('explain',`<div class="exhead"><div class="ico a-pop">${icon('bulb',{size:24,stroke:2.6})}</div><div class="grow"><div class="st2">Wyjaśnijmy inaczej</div></div></div>
    <div class="exbox a-up d2">${parts.join('<div class="exsep"></div>')}</div>
    <div class="exnote a-up d3">${icon('book',{size:15})}<span>To wyjaśnienia z Twoich materiałów.</span></div>
    <div class="sbtns">${o.onCards?'<button class="pill ghost" id="scards">Do fiszek</button>':''}<button class="pill cyan" id="sok" data-primary>ROZUMIEM</button></div>`);
  s.querySelector('#sok').onclick=()=>{sheetBad(q,o);};
  const c=s.querySelector('#scards');if(c)c.onclick=()=>{closeSheet();o.onCards();};
  return s;
}
/* Koniec żyć (NoHearts.html): licznik do następnego życia, „Powtórz N fiszek” (+1 życie), „Wróć później”.
   inLesson=true → lekcja przerwana (poziom niezaliczony); gemy/„Uzupełnij wszystkie” dojdą w kroku 8. */
function showNoHearts(o){
  o=o||{};
  const s=openSheet('nohearts',`<div class="nhfox">${fox('oops',92)}</div><div class="nhh">${[0,1,2,3,4].map(()=>icon('heart',{size:30,fill:false,stroke:2.2})).join('')}</div>
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
  if(lessonState)chatStop(lessonState.chat);clearInterval(ghostInt); // miejsce w lekcji zostaje w PROGRESS.lessonSave — powrót z węzła (P1-11)
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
/* pytanie ABCD: odpowiedzi w losowej kolejności (data-i = indeks w q.a, litera = pozycja na ekranie).
   AI lubi robić poprawną odpowiedź najdłuższą — gdy wyraźnie odstaje długością, pytanie idzie jako „prawda czy fałsz” z jedną propozycją. */
function lengthCue(q){const L=q.a.map(x=>txt(x).trim().length),c=L[q.c],rest=L.filter((_,i)=>i!==q.c);if(rest.length<2)return false;const mx=Math.max(...rest),mn=Math.min(...rest);return (c>mx*1.3&&c-mx>=12)||(c<mn*.7&&mn-c>=12);}
function quizBlock(q,o){
  if(!o.noTf&&q.a.length>=3&&lengthCue(q))return quizTf(q,o);
  const order=shuffle(q.a.map((_,i)=>i));
  const body=el('div','quiz');
  body.innerHTML=`<div class="qchips">${sessionChips(o,'Pytanie')}</div><div class="qq a-up">${q.q}</div>
    <div class="qopts">${order.map((i,pos)=>`<button class="qopt a-up d${Math.min(6,pos+1)}" data-i="${i}"><span class="k">${keys[pos]}</span><span class="t">${q.a[i]}</span></button>`).join('')}</div>`;
  const btn=el('button','pill qcheck','SPRAWDŹ');btn.disabled=true;btn.id='qcheck';
  let sel=null,done=false;
  const opts=[...body.querySelectorAll('.qopt')];
  const select=i=>{if(done||i==null)return;sel=i;opts.forEach(x=>x.classList.toggle('sel',+x.dataset.i===i));btn.disabled=false;};
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
  keyFn=e=>{const k=(e.key||'').toLowerCase();const m=/^[1-5]$/.test(k)?+k-1:'abcde'.indexOf(k);if(k.length===1&&m>=0&&m<opts.length)select(+opts[m].dataset.i);else if(e.key==='Enter'&&sel!=null){e.preventDefault();check();}};
  return {body,foot:btn};
}
function quizTf(q,o){
  const others=q.a.map((_,i)=>i).filter(i=>i!==q.c),isTrue=Math.random()<.5,cand=isTrue?q.c:others[Math.floor(Math.random()*others.length)];
  const body=el('div','quiz qtf');
  body.innerHTML=`<div class="qchips">${sessionChips(o,'Tak czy nie')}</div><div class="qq a-up">${q.q}</div>
    <div class="qtfcand a-up d2"><span class="lbl">Czy to dobra odpowiedź?</span><div class="t">${q.a[cand]}</div></div>
    <div class="qtfbtns a-up d3"><button class="qopt tfno" data-v="0"><span class="k">${icon('close',{size:17,stroke:3.6})}</span><span class="t">Nie</span></button><button class="qopt tfyes" data-v="1"><span class="k">${icon('check',{size:18,stroke:3.6})}</span><span class="t">Tak</span></button></div>`;
  const btn=el('button','pill qcheck','SPRAWDŹ');btn.disabled=true;btn.id='qcheck';
  let sel=null,done=false;const opts=[...body.querySelectorAll('.qopt')];
  const select=v=>{if(done)return;sel=v;opts.forEach(x=>x.classList.toggle('sel',+x.dataset.v===v));btn.disabled=false;};
  const check=()=>{if(done||sel==null)return;done=true;const ok=(sel===1)===isTrue;
    opts.forEach(x=>{const v=+x.dataset.v;x.disabled=true;x.classList.remove('sel');if((v===1)===isTrue)x.classList.add('correct',ok?'a-pop':'a-glow');else if(v===sel)x.classList.add('wrong','a-shake');else x.classList.add('dim');});
    if(!isTrue)body.appendChild(el('div','qtfright a-up',`<span class="lbl">Dobra odpowiedź</span><div class="t">${q.a[q.c]}</div>`));
    body.querySelector('.qq').classList.add('muted');btn.classList.add('hide');btn.disabled=true;keyFn=null;o.onAnswer(ok?q.c:-1,ok);};
  opts.forEach(x=>x.onclick=()=>select(+x.dataset.v));btn.onclick=check;
  keyFn=e=>{const k=(e.key||'').toLowerCase();if(k==='t'||k==='p'||k==='1')select(1);else if(k==='n'||k==='f'||k==='2')select(0);else if(e.key==='Enter'&&sel!=null){e.preventDefault();check();}};
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
  const idx=k=>btns[k]&&btns[k].dataset.i!=null?+btns[k].dataset.i:k; // przyciski mogą być przetasowane: data-i = indeks odpowiedzi
  const check=()=>{if(done||sel==null)return;done=true;const ok=idx(sel)===c;
    btns.forEach((x,k)=>{x.disabled=true;x.classList.remove('sel','a-up','a-pop','d1','d2','d3','d4','d5','d6');const kk=x.querySelector('.k');
      if(idx(k)===c){x.classList.add('correct',ok?'a-pop':'a-glow');if(kk)kk.innerHTML=icon('check',{size:18,stroke:3.6});}
      else if(k===sel){x.classList.add('wrong','a-shake');if(kk)kk.innerHTML=icon('close',{size:17,stroke:3.6});}
      else x.classList.add('dim');});
    api.finish(ok,fb(idx(sel),ok));};
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
  const labs=xs.map((x,i)=>`<text class="clab" x="${r1(xOf(i))}" y="${base+20}" text-anchor="middle">${attr(x)}</text>`).join('');
  const desc=xs.map((x,i)=>attr(x)+': '+fmtV(ys[i])).join(', ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${kind==='line'?'Wykres liniowy':'Wykres słupkowy'}: ${desc}">${grid}<line class="caxis" x1="${left-4}" y1="${base}" x2="${right+5}" y2="${base}"/>${marks}${labs}</svg>`;
}
/* sesja poziomu: pytania quizu (max 6, losowo) i zadania w jednym strumieniu — pierwsze zawsze pytanie, zadania rozłożone równo między resztę */
function levelSession(lv){
  const qs=shuffle((lv.quiz||[]).map((q,qi)=>({kind:'quiz',q:qOf(current,lv,qi),qi}))).slice(0,Math.min(6,(lv.quiz||[]).length)); // krok 9: z poprawkami
  const ts=shuffle((lv.tasks||[]).map((task,ti)=>({kind:'task',task,ti})).filter(x=>x.task&&TASKS[x.task.type])); // ti = indeks w lv.tasks (zapis przerwanej lekcji)
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
    finish(ok,fb){if(done||!body.isConnected)return;done=true;taskCleanup();keyFn=null; // odłączone = użytkownik już wyszedł (opóźnione end() w tf/match/swipe/hotspot)
      foot.querySelectorAll('button').forEach(b=>{b.disabled=true;b.classList.add('hide');});
      o.onAnswer(ok,Object.assign({src:task.src},fb||{}));}
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
      if(selL===selR){doneN++;[a,b].forEach(x=>{x.classList.remove('sel','a-up');x.classList.add('done','a-pop');x.disabled=true;const sp=el('span');sp.append(...x.childNodes);x.innerHTML=icon('check',{size:16,stroke:3.4});x.appendChild(sp);});selL=selR=null;refresh();
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
    const ans=txt(task.answer||'');const acc=[ans].concat(Array.isArray(task.accept)?task.accept.map(txt):[]).map(fold).filter(Boolean);const tol=task.typo|0; // ans = surowy tekst (dane są escapowane)
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
      api.finish(ok,{e:task.e||'',sub:ok?'':'Poprawnie: '+esc(ans)});};
    hint.onclick=()=>{if(locked||hinted)return;hinted=true;hint.disabled=true;hint.textContent='Zaczyna się na „'+ans.charAt(0).toUpperCase()+'”';if(!inp.value)inp.value=ans.charAt(0);paint();
      if(subjState(current.id).xp>=2&&daily().xp>=2){addXP(current.id,-2);toast('Podpowiedź: −2 XP','bolt');}try{inp.focus();}catch(e){}};
    giveup.onclick=()=>{if(locked)return;locked=true;inp.value=ans;inp.disabled=true;paint();box.classList.add('bad');api.finish(false,{e:task.e||'',sub:'Poprawnie: '+esc(ans)});};
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
    bl.setAttribute('aria-label',txt(L));br.setAttribute('aria-label',txt(R));
    const row=el('div','swbtns');row.appendChild(bl);row.appendChild(br);api.foot.appendChild(row);
    const drawDots=()=>{dots.innerHTML=cards.map((c,k)=>`<i class="${results[k]===true?'ok':results[k]===false?'bad':k===i?'cur a-blink':''}"></i>`).join('');};
    const show=()=>{const c=cards[i];card.className='scard front a-pop';card.style.transform='';const sf=card.querySelector('.sfront');const front=txt(c.front);sf.textContent=front;sf.classList.toggle('long',front.length>14);
      card.querySelector('.ssub').textContent=txt(c.sub||'');cnt.textContent=(i+1)+' / '+n;back.style.visibility=i+1<n?'':'hidden';drawDots();};
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
    const btns=shuffle(opts.map((_,k)=>k)).map((k,pos)=>{const o=opts[k];const b=el('button','thopt a-up d'+Math.min(6,pos+1),`<span class="n">${o.name}</span>${o.sub?`<span class="s">${o.sub}</span>`:''}`);b.dataset.i=k;grid.appendChild(b);return b;});
    chooser(api,btns,task.c,(sel,ok)=>({e:task.e||'',sub:ok?'':'Poprawnie: '+((opts[task.c]||{}).name||'')}));
  }},
  /* SCENARIUSZ (Scenario.html): karta „Sytuacja” z opisem, pytanie, opcje A–D jak w quizie (.qopt.sm), SPRAWDŹ przez chooser(). */
  scenario:{render(task,api){
    api.body.appendChild(el('div','scenecard a-up d1',`<div class="eyebrow">Sytuacja</div><div class="scenetext">${task.scene||''}</div>`));
    api.body.appendChild(el('div','ttitle sm a-up d2',task.q||'Co najlepiej to wyjaśnia?'));
    const list=el('div','qopts');api.body.appendChild(list);
    const btns=shuffle((task.a||[]).map((_,k)=>k)).map((k,pos)=>{const b=el('button','qopt sm a-up d'+Math.min(6,pos+2),`<span class="k">${keys[pos]}</span><span class="t">${task.a[k]}</span>`);b.dataset.i=k;list.appendChild(b);return b;});
    chooser(api,btns,task.c,(sel,ok)=>({e:task.e||'',sub:ok?'':'Dobra odpowiedź: '+((task.a||[])[task.c]||'')}));
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
          ${t!=null?`<button class="tlev a-pop" data-s="${si}" aria-label="${attr(r.year)}: ${attr(evs[t].label)}, dotknij, żeby cofnąć">${icon('check',{size:16,stroke:3.4})}<span>${evs[t].label}</span></button>`
          :`<div class="tlslot empty${cur?' cur a-blink':''}" data-s="${si}" role="button" aria-label="Miejsce na wydarzenie z roku ${attr(r.year)}">${cur?'<span>'+(sel!=null?'upuść tutaj':'tu trafi wydarzenie')+'</span>':''}</div>`}</div>`;}).join('');
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
        else if(t!=null)h=`<button class="chstep filled a-pop" data-s="${k}" aria-label="${attr(tiles[t])}, dotknij, żeby cofnąć">${icon('check',{size:16,stroke:3.4})}<span>${tiles[t]}</span></button>`;
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
    const ch=task.chart||{};const xs=Array.isArray(ch.x)?ch.x:[],ys=(Array.isArray(ch.y)?ch.y:[]).map(Number);const fmtV=v=>String(v).replace('.',',');
    api.body.appendChild(el('div','chartcard a-up d1',`<div class="chartlbl">${ch.label||''}</div>${chartSvg(ch.kind,xs,ys,fmtV)}`));
    api.body.appendChild(el('div','ttitle sm a-up d2',task.q||''));
    const list=el('div','qopts');api.body.appendChild(list);
    const btns=shuffle((task.a||[]).map((_,k)=>k)).map((k,pos)=>{const b=el('button','qopt sm a-up d'+Math.min(6,pos+2),`<span class="k">${keys[pos]}</span><span class="t">${task.a[k]}</span>`);b.dataset.i=k;list.appendChild(b);return b;});
    chooser(api,btns,task.c,(sel,ok)=>({e:task.e||'',sub:ok?'':'Dobra odpowiedź: '+((task.a||[])[task.c]||'')}));
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
    const tg=(Array.isArray(task.targets)?task.targets:[]).map(t=>({...t,x:+t.x||0,y:+t.y||0,r:+t.r||0}));const n=tg.length;let i=0,mistakes=0,locked=false,busy=false;
    const title=el('div','ttitle');api.body.appendChild(title);
    const card=el('div','hotcard a-up d1');api.body.appendChild(card);
    const img=el('div','hotimg');const src=txt(task.image||'').trim(); // nigdy innerHTML: schemat SVG jako obraz (data: URL w <img> nie wykonuje skryptów)
    const url=/^<svg[\s>]/i.test(src)?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(src):/^(data:image\/|blob:)/i.test(src)||/^[\w./-]+\.(png|jpe?g|gif|webp|svg)$/i.test(src)?src:'';
    if(url){const im=el('img');im.src=url;im.alt=txt(task.alt||'');im.draggable=false;img.appendChild(im);}
    const layer=el('div','hotlayer');layer.setAttribute('aria-label','Dotknij właściwego miejsca na schemacie');img.appendChild(layer);card.appendChild(img);
    const chips=el('div','hotchips a-up d2');api.body.appendChild(chips);
    const show=el('button','pill ghost','POKAŻ, GDZIE TO JEST');api.foot.appendChild(show);
    const draw=()=>{title.textContent=i<n?'Dotknij: '+txt(tg[i].name):'Wszystko wskazane';
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
  const early=ok&&S[k]&&e.due>todayStr(); // „umiem” przed terminem: tylko seen — pudełko rośnie najwyżej raz na termin
  e.seen=(e.seen|0)+1;if(!early){if(ok)e.box=Math.min(4,(e.box|0)+1);else{e.box=0;e.lapses=(e.lapses|0)+1;}
  e.due=addDays(todayStr(),SRS_INT[e.box]);}S[k]=e;histAdd('reviews',1); // krok 9: dziennik dnia (podsumowanie tygodnia)
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
  const scroll=shell('review',{cls:'review',title:'Powtórka',pills:false,back:()=>go('today')});
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
      r.innerHTML=`${mono(initials(s),'solid')}<div class="grow"><div class="t nm">${noEmoji(s.name)}</div><div class="s">${lv.slice(0,2).join(' · ')}${lv.length>2?' · +'+(lv.length-2):''}</div></div><span class="n">${mine.length}</span>`;
      r.setAttribute('aria-label',txt(s.name)+': '+mine.length+' do powtórki');
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
  if(ok){rv.ok++;if(xp){rv.xp+=addXP(it.s.id,xp);}}else{rv.bad++;rv.wrong.push(it);}
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
  if(it.kind==='card'){
    const c=it.c;
    // karta w kolorze przedmiotu (Flashcards.html): tap = odwróć, przeciągnięcie w lewo = jeszcze nie, w prawo = umiem
    const flip=el('div','flip themed a-up'+(rv.flipped?' flipped':''));flip.style.setProperty('--accent',it.s.accent);if(it.s.onAccent)flip.style.setProperty('--on-accent',it.s.onAccent);
    flip.innerHTML=`<div class="flipinner">
      <div class="face front"><span class="tag accent">${sshort(it.s)} · ${noEmoji(it.lv.title)}</span><div class="term">${c.t}</div><div class="tapomat">dotknij, żeby odwrócić</div></div>
      <div class="face back"><span class="tag">odpowiedź</span><div class="deftxt">${c.d}</div><div class="tapomat">dotknij, żeby wrócić</div></div></div>`;
    let swiped=false,g=null;
    flip.onclick=()=>{if(swiped){swiped=false;return;}rv.flipped=!rv.flipped;flip.classList.toggle('flipped');if(rv.flipped&&g)g.seen();};
    body.appendChild(flip);
    body.appendChild(el('div','swipehint3',`<span class="l">${icon('back',{size:16,stroke:2.8,cls:'a-bob'})}w lewo = jeszcze nie</span><span class="r">w prawo = umiem${icon('chevron-right',{size:16,stroke:2.8,cls:'a-bob d2'})}</span>`));
    const foot=el('div','lessonfoot');const btns=el('div','fbtns');
    const no=el('button','fbtn no',icon('refresh',{size:18,stroke:2.8})+' jeszcze nie'),yes=el('button','fbtn yes',icon('check',{size:18,stroke:3.4})+' umiem');
    no.id='rvno';yes.id='rvyes';
    const ans=ok=>{if(rvState!==rv||!advOk())return;rvAnswer(it,ok,ok?2:0);rv.flipped=false;rv.seenAt=null;rv.idx++;renderReviewSession();};
    g=cardGate(rv,flip,btns,ans);
    no.onclick=()=>g.ask(false);yes.onclick=()=>g.ask(true);
    let x0=null;flip.onpointerdown=e=>{x0=e.clientX;};
    flip.onpointerup=e=>{if(x0==null)return;const dx=e.clientX-x0;x0=null;if(Math.abs(dx)>80){swiped=true;g.ask(dx>0);}};
    btns.appendChild(no);btns.appendChild(yes);foot.appendChild(btns);L.appendChild(foot);
    keyFn=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();flip.click();}else if(e.key==='ArrowLeft'||e.key==='1')g.ask(false);else if(e.key==='ArrowRight'||e.key==='2')g.ask(true);};
  }else{
    const q=it.q;
    const blk=quizBlock(q,{n:rv.idx+1,total:rv.items.length,tag:sshort(it.s),onAnswer:(i,ok)=>{
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
    let doneAny=false;rv.subs.forEach(sid=>{if(completeDaily(sid,'review')||daily().tasks.some(x=>x.done&&x.id===sid+':review'))doneAny=true;}); // wiersz zaliczony już przez tickDaily też pasuje
    if(!doneAny&&total){const t=daily().tasks.find(x=>!x.done&&/:review$/.test(x.id));if(t)completeDaily(t.id.split(':')[0],'review');}
    if(total)rv.subs.forEach(sid=>testDone(sid,'review'));
  }
  if(!L){app.innerHTML='';L=el('div','lesson open rvrun');app.appendChild(L);app.appendChild(el('div','toast',''));app.lastChild.id='toast';}else L.innerHTML='';
  const body=el('div','lessonbody done');if(pct>=50)body.appendChild(confetti(6));
  const done=rv.items.slice(0,rv.idx);const cards=done.filter(x=>x.kind==='card').length,qs=done.length-cards; // tylko to, co przejrzane (sesję można przerwać)
  const subsTxt=[...rv.subs].map(id=>{const s=SUBJECTS.find(x=>x.id===id);return s?sshort(s):'';}).filter(Boolean).join(' · ');
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
  const scroll=shell('cards',{cls:'cards',title:'Fiszki',pills:false});
  const due=srsDue();const totalC=SUBJECTS.reduce((a,s)=>a+allCards(s).length,0);
  scroll.appendChild(el('div','',`<div class="eyebrow">${totalC} ${pl(totalC,'pojęcie','pojęcia','pojęć')} · ${SUBJECTS.length} ${pl(SUBJECTS.length,'przedmiot','przedmioty','przedmiotów')}</div><p class="sp">Wybierz przedmiot i przeglądaj fiszki. Każda odpowiedź trafia do powtórki na interwałach.</p>`));
  if(due.length){const r=el('button','rvrow a-up d1',`<div class="mono solid">${icon('refresh',{size:22,stroke:2.6})}</div><div class="grow"><div class="t">Powtórka na dziś</div><div class="s">${due.length} ${pl(due.length,'pojęcie czeka','pojęcia czekają','pojęć czeka')}</div></div><span class="n">${due.length}</span>`);r.onclick=()=>go('review');scroll.appendChild(r);}
  const card=el('div','setcard a-up d2');
  SUBJECTS.forEach((s,i)=>{
    if(i)card.appendChild(el('div','setsep'));
    const nc=allCards(s).length,nd=due.filter(x=>x.s.id===s.id).length;
    const r=el('button','setrow themed');r.style.setProperty('--accent',s.accent);if(s.onAccent)r.style.setProperty('--on-accent',s.onAccent);
    r.innerHTML=`${mono(initials(s),'solid xs')}<div class="grow"><div class="t nm">${noEmoji(s.name)}</div><div class="s">${nc} ${pl(nc,'fiszka','fiszki','fiszek')}${nd?' · '+nd+' do powtórki':''}</div></div>${icon('chevron-right',{size:18,cls:'chev'})}`;
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
/* cloud-ui.js „ZACZNIJ NAUKĘ” (P1-22): ścieżka przedmiotu i od razu ten poziom — tylko gdy jest odblokowany (inaczej sama ścieżka) */
function openLevel(sid,lid){
  const s=SUBJECTS.find(x=>x.id===sid);if(!s)return go('today');
  openSubject(sid,'path');
  const i=s.levels.findIndex(l=>l.id===lid);
  if(i>=0&&current===s&&levelUnlocked(s,i))startLesson(s.levels[i]);
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
  row.appendChild(el('div','bmeta',`<div class="bname">${mono(initials(s),'xs solid')}<span>${noEmoji(s.name)}</span></div>
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
  if(idx===0||(s.levels[idx]&&s.levels[idx].chapter))return true; // nowy materiał = nowy rozdział, dostępny od razu
  const prev=s.levels[idx-1];
  const st=subjState(s.id);
  return !!(st.levels[prev.id]&&st.levels[prev.id].done);
}
const PATH_OFF=[-104,8,96,-28]; // poziome przesunięcia kolejnych węzłów (px), cyklicznie
/* droga ścieżki: gładka krzywa przez środki węzłów (po layoucie), przebyty odcinek w kolorze przedmiotu */
function drawTrail(path){
  if(!path.isConnected)return;const old=path.querySelector('svg.trail');if(old)old.remove();
  const btns=[...path.querySelectorAll('.nodebtn')];if(btns.length<2)return;
  const pr=path.getBoundingClientRect();
  const pts=btns.map(b=>{const r=b.getBoundingClientRect();return {x:r.left-pr.left+r.width/2,y:r.top-pr.top+r.height/2,done:/node-done|opened|beaten/.test(b.className)};});
  const seg=(a,b)=>{const dy=(b.y-a.y)/2;return `C${a.x.toFixed(1)} ${(a.y+dy).toFixed(1)} ${b.x.toFixed(1)} ${(b.y-dy).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;};
  let all=`M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`,done=all,k=0;
  for(let i=1;i<pts.length;i++){all+=seg(pts[i-1],pts[i]);if(pts[i-1].done&&k===i-1){done+=seg(pts[i-1],pts[i]);k=i;}}
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','trail');svg.setAttribute('aria-hidden','true');
  svg.setAttribute('width',Math.ceil(pr.width));svg.setAttribute('height',Math.ceil(path.scrollHeight));
  svg.innerHTML=`<path class="tr-sh" d="${all}"/><path class="tr-base" d="${all}"/><path class="tr-dash" d="${all}"/>${k?`<path class="tr-done" d="${done}"/><path class="tr-dash done" d="${done}"/>`:''}`;
  path.insertBefore(svg,path.firstChild);
}
function renderPath(sc){
  const s=current;const st=subjState(s.id);
  const isDone=lv=>!!(st.levels[lv.id]||{}).done;
  const wrap=el('div','scroll pathview');
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
  const saves=lsaves(); // P1-11: poziomy z przerwaną lekcją — dymek DOKOŃCZ
  const chestOpen=it=>s.levels.slice(Math.max(0,it.after-2),it.after+1).every(isDone);
  const doneOf=it=>it.chest?!!chests[String(it.after)]:it.boss?!!brec.done:isDone(it.lv);
  items.forEach((it,k)=>{
    const x=xOf(k);
    const node=el('div','pathnode');node.style.setProperty('--x',x+'px');
    if(it.chest){
      const opened=!!chests[String(it.after)],open=chestOpen(it);
      const btn=el('button','nodebtn node-chest'+(opened?' opened':open?' a-sway':''),icon('chest',{size:32,stroke:2.4}));
      btn.setAttribute('aria-label','Skrzynia: '+(opened?'otwarta':open?'do otwarcia':'po zaliczeniu poziomu '+(it.after+1)));
      btn.onclick=()=>{
        if(chests[String(it.after)])return toast('Skrzynia już otwarta','chest'); // stan z chwili tapu (przerysowanie po 900 ms)
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
      const cur=unlocked&&!done,saved=unlocked&&!!lessonLoad(s,lv,saves);
      if(cur){node.classList.add('cur');node.appendChild(el('div','bubble a-bob'+(saved?' resume':''),saved?'DOKOŃCZ':'ZACZNIJ'));const pf=el('div','pathfox',fox('idle',86));pf.style.setProperty('--fx',(x<0?118:-118)+'px');node.appendChild(pf);}
      else if(saved){node.classList.add('resume');node.appendChild(el('div','bubble resume a-bob','DOKOŃCZ'));}
      const btn=el('button','nodebtn '+(done?'node-done':cur?'node-open a-pulse':'node-lock'),done?icon('check',{size:34,stroke:3.4}):cur?icon('bolt',{size:40}):icon('lock',{size:28}));
      btn.setAttribute('aria-label',(saved?'Dokończ: ':done?'Powtórz: ':cur?'Zacznij: ':'Zablokowane: ')+txt(noEmoji(lv.title)));
      if(done)btn.innerHTML+=`<span class="stars">${starRow(stars,12)}</span>`;
      btn.onclick=unlocked?()=>startLesson(lv):()=>toast('Najpierw zalicz poprzedni poziom','lock');
      node.appendChild(btn);
      node.appendChild(el('div','nodelabel'+(cur?' cur':done?'':' lock'),noEmoji(lv.title)));
    }
    path.appendChild(node);
  });
  wrap.appendChild(path);sc.innerHTML='';sc.appendChild(wrap);liveFoxes(path);
  requestAnimationFrame(()=>drawTrail(path));
  // auto-scroll do bieżącego węzła (na środek ekranu)
  requestAnimationFrame(()=>{const n=wrap.querySelector('.node-open,.node-boss.open');if(!n)return;const r=n.getBoundingClientRect(),w=wrap.getBoundingClientRect();wrap.scrollTop=Math.max(0,r.top-w.top+wrap.scrollTop-w.height/2+r.height/2);});
}

/* ---------- NAUKA W CZACIE (zamiast karty roladki z przesuwaniem): lis tłumaczy dawkę po kawałku ----------
   Każda dawka to „część” z dużym nagłówkiem; po przejściu dalej zwija się do jednej linii (stuknięcie rozwija). Kawałki tekstu pokazujemy wg rodzaju:
   nagłówek, lista słówek „X — znaczenie” jako kafelki (stuknięcie = pamiętam → licznik), etykieta z chipsami, zwykły dymek z „lis pisze…”.
   Pogrubione pojęcia w dymkach da się stuknąć (znaczenie z fiszek albo z tekstu — tylko gdy nie stoi już obok). Po dawce jeden przycisk „Dalej”,
   potem mini-sprawdzian z luką (pojęcie z dawki, dystraktory podobnej długości). Bez utraty życia. */
function foxAct(svg,a){if(fxRM())return;const F=[...FXL].find(f=>f.svg===svg);if(F)fxDo(F,a,true);}
function feedChunks(html){ // dzieli HTML dawki (już po clean()) na krótkie kawałki: akapity, punkty listy, zdania
  const t=document.createElement('template');t.innerHTML=String(html||'');const out=[];let cur=document.createElement('div');
  const flush=()=>{if(cur.textContent.trim())out.push(cur.innerHTML.trim());cur=document.createElement('div');};
  const walk=nodes=>[...nodes].forEach(n=>{
    if(n.nodeType===1&&n.tagName==='BR'){flush();return;}
    if(n.nodeType===1&&(n.tagName==='UL'||n.tagName==='OL')){flush();[...n.children].forEach(li=>{cur.innerHTML='• '+li.innerHTML;flush();});return;}
    if(n.nodeType===1&&/^(P|DIV|LI|H3|H4|BLOCKQUOTE|TABLE)$/.test(n.tagName)){flush();walk(n.childNodes);flush();return;}
    if(n.nodeType===3){String(n.nodeValue).split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ0-9„"(])/).forEach((p,k)=>{if(k>0&&cur.textContent.length>70)flush();cur.appendChild(document.createTextNode((k>0&&cur.textContent?' ':'')+p));});return;}
    cur.appendChild(n.cloneNode(true));});
  walk(t.content.childNodes);flush();
  const solo=h=>{const t=txt(h).trim();return /:$/.test(t)||/•/.test(t)||/\s[—–-]\s/.test(t);}; // nagłówek, lista, para „X — Y” zostają osobno
  const res=[];out.forEach(h=>{const pv=res[res.length-1];if(pv&&txt(h).length<40&&txt(pv).length<150&&!solo(h)&&!solo(pv))res[res.length-1]+=' '+h;else res.push(h);});
  return res.length?res:[String(html||'')];
}
const boldTerms=html=>{const t=document.createElement('template');t.innerHTML=String(html||'');return [...t.content.querySelectorAll('b,strong')].map(b=>b.textContent.replace(/\s+/g,' ').trim()).filter(x=>x.length>=3&&x.length<=40&&!/[.!?:]$/.test(x));};
function doseCheck(lv,idx){ // zdanie z dawki z luką w miejscu pogrubionego pojęcia + 2 dystraktory (inne pojęcia z poziomu, podobnej długości)
  const f=lv.feed[idx],terms=boldTerms(f.body);if(!terms.length)return null;
  const sents=[];doseChunks(f).forEach(h=>txt(h).replace(/\s+/g,' ').trim().split(/(?<=[.!?])\s+/).forEach(x=>{if(x)sents.push(x.replace(/^•\s*/,''));})); // te same kawałki co w dymkach (bez sklejania przez <br>)
  for(const T of shuffle(terms)){
    const sent=sents.find(x=>x.includes(T)&&x.length<=220);if(!sent)continue;
    const pool=new Set();lv.feed.forEach((g,k)=>{if(k!==idx)boldTerms(g.body).forEach(x=>pool.add(x));});(lv.flashcards||[]).forEach(c=>{const x=txt(c.t).trim();if(x.length<=40)pool.add(x);});
    const cand=[...pool].filter(x=>x.length>=3&&fold(x)!==fold(T)&&!fold(sent).includes(fold(x))).sort((a,b)=>Math.abs(a.length-T.length)-Math.abs(b.length-T.length));
    const ds=shuffle(cand.slice(0,5)).slice(0,2);if(ds.length<2)continue;
    const at=sent.indexOf(T);return {term:T,before:sent.slice(0,at),after:sent.slice(at+T.length),opts:shuffle([T,...ds])};}
  return null;
}
/* ---------- WIZUALIZACJE W CZACIE (feed[].viz, opcjonalne) ----------
   Dane przychodzą z cloud.js → mapViz(): znane typy, przycięte i już escapowane teksty, liczby przez Number. vizOk() sprawdza to jeszcze raz
   (liczności, brak surowych < > "), a renderer składa wyłącznie własny HTML/CSS z tych tekstów — żadnego HTML ani SVG z AI.
   Szerokość słupków tylko z liczb. Strzałki i pętla cyklu to CSS. Bez wizualizacji (stare tematy, starsze buildy) czat wygląda jak dotąd. */
const VZ_N={timeline:[3,7],compare:[2,5],cycle:[3,6],flow:[2,6],tree:[2,4],bars:[2,7],numbers:[1,4]};
const VZ_META={timeline:['Oś czasu','calendar'],compare:['Porównanie','grid'],cycle:['Cykl','refresh'],process:['Krok po kroku','list'],cause:['Przyczyna i skutek','trend'],tree:['Podział','grid'],bars:['Wykres','chart'],numbers:['W liczbach','target']};
function vizOk(v){
  if(!v||typeof v!=='object'||!own(VZ_N,v.type))return false;
  const S=s=>typeof s==='string'&&!!s.trim()&&s.length<=800&&!/[<>"]/.test(s),[lo,hi]=VZ_N[v.type],n=a=>Array.isArray(a)&&a.length>=lo&&a.length<=hi;
  if(v.caption!=null&&v.caption!==''&&!S(v.caption))return false;
  switch(v.type){
    case 'timeline':return n(v.items)&&v.items.every(x=>x&&S(x.when)&&S(x.label));
    case 'compare':return S(v.a)&&S(v.b)&&n(v.rows)&&v.rows.every(x=>x&&S(x.k)&&S(x.a)&&S(x.b));
    case 'cycle':return n(v.steps)&&v.steps.every(S);
    case 'flow':return (v.kind==='cause'||v.kind==='process')&&n(v.steps)&&v.steps.every(S);
    case 'tree':return S(v.root)&&n(v.groups)&&v.groups.every(g=>g&&S(g.name)&&Array.isArray(g.items)&&g.items.length>=1&&g.items.length<=5&&g.items.every(S));
    case 'bars':return (v.unit==null||v.unit===''||S(v.unit))&&n(v.items)&&v.items.every(x=>x&&S(x.label)&&typeof x.value==='number'&&isFinite(x.value)&&x.value>=0)&&v.items.some(x=>x.value>0);
    case 'numbers':return n(v.items)&&v.items.every(x=>x&&S(x.value)&&S(x.label));
  }
  return false;
}
const vzNum=x=>{const r=Math.round(x*100)/100;if(!(r<1e15))return String(r);const p=String(r).split('.');return p[0].replace(/\B(?=(\d{3})+(?!\d))/g,' ')+(p[1]?','+p[1]:'');}; // 12 500,5
function vizSteps(steps,cls,kind){ // kroki z numerem (proces, cykl) albo z etykietą „przyczyna” / „skutek”
  const last=steps.length-1;
  return `<ol class="vz-steps ${cls}">`+steps.map((s,i)=>`<li class="vz-step${kind==='cause'&&i===last?' end':''}" style="--i:${i}">`+
    (kind==='cause'?(i===0?'<em>przyczyna</em>':i===last?'<em>skutek</em>':''):`<i>${i+1}</i>`)+`<span>${s}</span></li>`).join('')+'</ol>';
}
function vizHtml(v){
  const kind=v.type==='flow'?v.kind:v.type,[name,ic]=VZ_META[kind]||VZ_META[v.type];
  let h='';
  if(v.type==='timeline')h='<ol class="vz-tl">'+v.items.map((x,i)=>`<li style="--i:${i}"><b class="vz-when">${x.when}</b><span>${x.label}</span></li>`).join('')+'</ol>';
  else if(v.type==='compare')h=`<div class="vz-cmp"><div class="vz-cmph"><b class="vz-ca">${v.a}</b><b class="vz-cb">${v.b}</b></div>`+
    v.rows.map((x,i)=>`<div class="vz-cmpr" style="--i:${i}"><div class="vz-k">${x.k}</div><div class="vz-ca">${x.a}</div><div class="vz-cb">${x.b}</div></div>`).join('')+'</div>';
  else if(v.type==='cycle')h='<div class="vz-cyc">'+vizSteps(v.steps,'cyc')+`<div class="vz-loop" aria-hidden="true"></div><div class="vz-again">${icon('refresh',{size:14,stroke:3})}<span>i od nowa</span></div></div>`;
  else if(v.type==='flow')h=vizSteps(v.steps,v.kind,v.kind);
  else if(v.type==='tree')h=`<div class="vz-tree"><div class="vz-root">${v.root}</div><div class="vz-grps">`+
    v.groups.map((g,i)=>`<div class="vz-grp" style="--i:${i}"><div class="vz-gn">${g.name}</div><ul>${g.items.map(x=>`<li>${x}</li>`).join('')}</ul></div>`).join('')+'</div></div>';
  else if(v.type==='bars'){const mx=Math.max(...v.items.map(x=>x.value));
    h='<div class="vz-bars">'+v.items.map((x,i)=>{const w=x.value>0?Math.max(2,Math.round(x.value/mx*1000)/10):0;
      return `<div class="vz-bar${x.value===mx?' top':''}" style="--i:${i}"><div class="vz-bl"><span>${x.label}</span><b>${vzNum(x.value)}${v.unit?' '+v.unit:''}</b></div><div class="vz-bt"><i style="width:${w}%"></i></div></div>`;}).join('')+'</div>';}
  else if(v.type==='numbers'){const wide=v.items.length===1||v.items.some(x=>txt(x.value).length>9);
    h=`<div class="vz-nums${wide?' wide':''}">`+v.items.map((x,i)=>`<div class="vz-num" style="--i:${i}"><b>${x.value}</b><span>${x.label}</span></div>`).join('')+'</div>';}
  return `<span class="lbl">${icon(ic,{size:14,stroke:2.8})}${name}</span>`+(v.caption?`<div class="vz-cap">${v.caption}</div>`:'')+h;
}
const vizPlain=v=>{try{const C=window.NAUKA_CLOUD;return vizOk(v)&&C&&typeof C.vizText==='function'?String(C.vizText(v)||''):'';}catch(e){return '';}}; // escapowany tekst z cloud.js
function doseChunks(f){const c=feedChunks(f&&f.body),vt=f?vizPlain(f.viz):'';return vt?c.concat(feedChunks(vt)):c;} // tekst dawki + to, co stoi tylko na wizualizacji (wyjaśnienia, znaczenia pojęć, luka)
async function chatViz(C,v){
  if(!chatAlive(C))return false;
  const typing=el('div','cbub fox typing','<i></i><i></i><i></i>');chatBox(C).appendChild(typing);chatShow(C,typing);
  await chatWait(C,650);typing.remove();if(!chatAlive(C))return false;
  const b=el('div','cbub fox cviz vz-'+v.type+(v.type==='flow'?' vz-'+v.kind:'')+' a-up',vizHtml(v));b.setAttribute('role','figure');
  b.setAttribute('aria-label',txt((VZ_META[v.type==='flow'?v.kind:v.type]||[''])[0]+(v.caption?': '+v.caption:'')));
  chatBox(C).appendChild(b);chatShow(C,b,'fit');
  if(C.fox)foxAct(C.fox,'idea');
  await chatWait(C,Math.min(1600,500+b.textContent.length*4));
  return chatAlive(C);
}
const chatAlive=C=>lessonState===C.ls&&C.ls.phase==='feed'&&C.list.isConnected;
function chatStop(C){if(!C)return;C.t.forEach(clearTimeout);C.t=[];C.skip=null;}
function chatWait(C,ms){return new Promise(r=>{if(calmMotion()||ms<=0)return r();const id=setTimeout(()=>{C.skip=null;r();},ms);C.t.push(id);C.skip=()=>{clearTimeout(id);C.skip=null;r();};});}
const chatBox=C=>C.cur||C.list; // bieżąca część (sekcja dawki)
function chatShow(C,elm,top){ // nowy element ma być widoczny; nagłówek części — na samą górę (pod paskiem z lisem); 'fit': wysoki element (wizualizacja) od góry, niski jak zwykle
  requestAnimationFrame(()=>{const b=C.body;if(!b||!b.isConnected||!elm||!elm.isConnected)return;const hd=b.querySelector('.chattop'),off=(hd?hd.offsetHeight:0)+10;
    const r=elm.getBoundingClientRect(),br=b.getBoundingClientRect();let y=null;
    if(top==='fit')top=r.height>br.height-off-28;
    if(top)y=b.scrollTop+(r.top-br.top)-off;else if(r.bottom>br.bottom-10)y=b.scrollTop+(r.bottom-br.bottom)+18;
    if(y==null)return;y=Math.max(0,y);if(b.scrollTo)b.scrollTo({top:y,behavior:calmMotion()?'auto':'smooth'});else b.scrollTop=y;});}
function chatFoot(C,items){ // items: [[label, fn, main?]] albo null = lis pisze
  C.foot.innerHTML='';if(!items){C.foot.appendChild(el('div','chatwait',`<i></i><i></i><i></i><span>lis pisze…</span>`));keyFn=e=>{if(e.key==='Enter'&&C.skip){e.preventDefault();C.skip();}};return;}
  const row=el('div','creplies'+(items.length===1&&items[0][2]?' solo':''));items.forEach(([l,fn,main])=>{const b=el('button','creply a-pop'+(main?' main':''),l);b.onclick=()=>{if(b.disabled||!advOk())return;row.querySelectorAll('button').forEach(x=>x.disabled=true);fn(b);};row.appendChild(b);});
  C.foot.appendChild(row);const main=items.find(x=>x[2]);keyFn=e=>{if(e.key==='Enter'&&main){e.preventDefault();main[1]();}};
}
/* kawałek dawki → jak go pokazać: nagłówek („DESPEDIRSE (pożegnania):”), lista słówek („X — znaczenie • Y — …” jako kafelki),
   etykieta z chipsami („CORTESÍA: Por favor, Muchas gracias, …”) albo zwykły dymek lisa */
const PAIR=/\s+[—–]\s+|\s+-\s+/;
const tagsOk=h=>{const st=[];for(const m of h.matchAll(/<(\/?)([a-z0-9]+)[^>]*>/gi)){const n=m[2].toLowerCase();if(n==='br'||n==='hr')continue;if(!m[1])st.push(n);else if(st.pop()!==n)return false;}return !st.length;}; // para nie może przecinać znacznika
function splitPair(h){const m=PAIR.exec(h);if(!m)return null;const l=h.slice(0,m.index).replace(/^\s*•\s*/,'').trim(),r=h.slice(m.index+m[0].length).trim(),lt=txt(l).replace(/\s+/g,' ').trim();
  if(!lt||lt.length>60||!txt(r).trim()||!tagsOk(l)||!tagsOk(r)||/:/.test(lt))return null;return {l,r,lt};}
function chunkView(h){
  const t=txt(h).replace(/\s+/g,' ').trim();
  if(/:$/.test(t)&&t.length<=70&&!PAIR.test(t))return {k:'sub',h:esc(t.replace(/:$/,''))};
  const ci=h.indexOf(':');
  if(ci>0){const lab=txt(h.slice(0,ci)).trim(),rest=h.slice(ci+1).trim(),letters=lab.replace(/[^\p{L}]/gu,'');
    if(lab.length<=30&&letters.length>=3&&letters===letters.toUpperCase()&&txt(rest).trim()){
      const bits=rest.replace(/\.\s*$/,'').split(/,\s*/).filter(x=>txt(x).trim());
      if(bits.length>=3&&bits.every(x=>txt(x).trim().length<=34))return {k:'bubble',lbl:esc(lab),h:'<div class="cchips">'+bits.map(x=>'<span class="cchip">'+x.trim()+'</span>').join('')+'</div>'};
      return {k:'bubble',lbl:esc(lab),h:rest};}}
  const parts=h.split(/\s*•\s*/).map(x=>x.trim()).filter(x=>txt(x).trim());
  const pairs=parts.map(splitPair),np=pairs.filter(Boolean).length;
  if(np&&(np>=2||(parts.length===1&&t.length<=140))&&np>=Math.ceil(parts.length*.6))return {k:'vocab',items:parts.map((p,i)=>pairs[i]||{x:p})};
  if(parts.length===1){ // pary w zdaniach: „Hola — cześć. Buenos días — dzień dobry.”
    const ss=h.split(/(?<=[.!?])\s+(?=(?:<[a-z0-9]+>)*[A-ZĄĆĘŁŃÓŚŹŻÁÉÍÓÚÑ¿¡„"])/).map(x=>x.trim()).filter(x=>txt(x).trim()),sp=ss.map(splitPair),ns=sp.filter(Boolean).length;
    if(ss.length>=2&&ns>=2&&ns>=Math.ceil(ss.length*.6))return {k:'vocab',items:ss.map((x,i)=>sp[i]?{...sp[i],r:sp[i].r.replace(/\.\s*$/,'')}:{x})};}
  return {k:'bubble',h};
}
async function chatPut(C,v){
  if(v.k==='sub'){const d=el('div','csub a-up',v.h);chatBox(C).appendChild(d);chatShow(C,d);await chatWait(C,300);return chatAlive(C);}
  if(v.k==='vocab'){const box=el('div','cvocab');chatBox(C).appendChild(box);
    for(const it of v.items){if(!chatAlive(C))return false;
      let row;if(it.x)row=el('div','cvx a-up',it.x);
      else{row=el('button','cvi a-up',`<span class="cvt">${it.l}</span><span class="cvm">${it.r}</span><span class="cvk">${icon('check',{size:14,stroke:3.6})}</span>`);row.type='button';row.onclick=e=>{e.stopPropagation();chatGot(C,row,it.lt);};}
      box.appendChild(row);chatShow(C,row);await chatWait(C,Math.min(900,280+txt(it.r||it.x||'').length*8));}
    return chatAlive(C);}
  return !!await chatSay(C,v.h,'',v.lbl);
}
async function chatSay(C,html,cls,label){
  if(!chatAlive(C))return null;const typing=el('div','cbub fox typing','<i></i><i></i><i></i>');chatBox(C).appendChild(typing);chatShow(C,typing);
  await chatWait(C,Math.min(1500,380+txt(html).length*10));
  typing.remove();if(!chatAlive(C))return null;
  const b=el('div','cbub fox a-up'+(cls?' '+cls:''),(label?`<span class="lbl">${label}</span>`:'')+html);chatBox(C).appendChild(b);chatTerms(C,b);chatShow(C,b);
  if(C.fox&&Math.random()<.22)foxAct(C.fox,Math.random()<.5?'nod':'tilt');
  return b;
}
function chatTerms(C,b){b.querySelectorAll('b,strong').forEach(t=>{const term=t.textContent.replace(/\s+/g,' ').trim();if(term.length<3||term.length>40)return;
  t.classList.add('cterm');t.setAttribute('role','button');t.tabIndex=0;t.onclick=e=>{e.stopPropagation();chatTerm(C,t,term);};});}
function chatCount(C,fresh){const k=document.getElementById('chatterms');if(!k)return;k.querySelector('b').textContent=C.terms.size+(C.allTerms?'/'+C.allTerms:'');
  if(fresh){k.classList.remove('pop');void k.offsetWidth;k.classList.add('pop');if(C.allTerms&&C.terms.size>=C.allTerms){toast('Wszystkie pojęcia zebrane','check','a-pop');if(C.fox)foxAct(C.fox,'hop');}}}
function chatGot(C,row,term){const k=fold(term),fresh=!C.terms.has(k);C.terms.add(k);row.classList.remove('a-up');row.classList.add('got','a-pop');chatCount(C,fresh);if(C.fox&&fresh)foxAct(C.fox,Math.random()<.5?'wink':'nod');}
/* znaczenie stukniętego pojęcia: 1) fiszka (hasło albo tłumaczenie — w językowych bywa odwrotnie), 2) tekst lekcji: „X — znaczenie”, „X = …”, „X: …”,
   „X (…)” albo „znaczenie — X”, 3) brak → bez dymku (pojęcie i tak trafia do licznika) */
function termFromText(term,texts){
  for(const t of texts){let i=t.indexOf(term);
    while(i>=0){
      const rest=t.slice(i+term.length).replace(/^[\s)\]”"]*/,'');
      const m=rest.match(/^(?:[—–=:]|-(?=\s)|->|→)\s*([^•\n]+?)(?=\s*(?:•|$|\.\s+[A-ZĄĆĘŁŃÓŚŹŻ¿¡„"]))/);
      if(m&&m[1].trim().length>=2)return m[1].trim().replace(/[.;,]\s*$/,'');
      const p=rest.match(/^\(([^)]{2,90})\)/);if(p)return p[1].trim();
      const b=t.slice(0,i).match(/(?:^|•|[.!?]\s)\s*([^•\n.!?]{2,90}?)\s*(?:[—–=]|->|→)\s*$/);if(b&&b[1].trim().length>=2)return b[1].trim();
      i=t.indexOf(term,i+term.length);}}
  return null;
}
function termDef(C,term,host){
  const k=fold(term),fcs=C.ls.lv.flashcards||[];
  const hit=x=>{const a=fold(txt(x));return a&&(a===k||(k.length>=4&&a.includes(k))||(a.length>=4&&k.includes(a)));};
  const fc=fcs.find(c=>hit(c.t));if(fc)return fc.d;
  const rv=fcs.find(c=>hit(c.d));if(rv)return rv.t; // fiszka „tłumaczenie → zwrot”
  const texts=[host.textContent.replace(/\s+/g,' ')];(C.ls.lv.feed||[]).forEach(f=>doseChunks(f).forEach(h=>texts.push(txt(h).replace(/\s+/g,' '))));
  const ctx=termFromText(term,texts);return ctx?esc(ctx):null;
}
function chatTerm(C,t,term){
  const k=fold(term),fresh=!C.terms.has(k);C.terms.add(k);t.classList.add('got');chatCount(C,fresh);
  const host=t.closest('.cbub');if(!host)return;let nx=host.nextElementSibling;while(nx&&nx.classList.contains('cdef')){if(nx.dataset.k===k)return;nx=nx.nextElementSibling;}
  let def=termDef(C,term,host);if(def&&fold(host.textContent).includes(fold(txt(def))))def=null; // znaczenie stoi już obok — bez powtórki
  if(def){const d=el('div','cbub fox cdef a-pop',`<span class="lbl">${icon('bookmark',{size:14})}${esc(term)}</span>${def}`);d.dataset.k=k;host.after(d);}
  if(C.fox)foxAct(C.fox,fresh?(def?'wink':'nod'):'nod');
}
/* „Powiedz prościej” (BIBLIA §10.3, P1-10): pole real dawki jako mały, zwinięty „Prościej” pod jej tekstem — stuknięcie rozwija; bez przycisków w stopce.
   Tylko gdy real nie jest pusty i nie powtarza dawki. Liczby, które są tylko w real (nie w tekście dawki), zawsze widoczne: wtedy „Prościej” jest nawet przy
   podobnym tekście, a gdy opiera się na nich schemat (vizText) — od razu rozwinięte (kontrola ugruntowania schematów przyjmuje liczby z real). */
const numsIn=t=>new Set((String(t).match(/\d+(?:[.,]\d+)?/g)||[]).map(x=>x.replace(',','.')));
function nearCopy(real,body){const r=fold(txt(real)),b=fold(txt(body));if(!r||b.includes(r))return true;const rw=[...new Set(words(real).map(stem))];if(rw.length<3)return false;const bw=new Set(words(body).map(stem));return rw.filter(w=>bw.has(w)).length/rw.length>=.8;}
function doseReal(f){
  const r=f&&f.real;if(!r||typeof r!=='string'||!txt(r).trim())return null;
  const rn=numsIn(txt(r)),bn=numsIn(txt(f.body||'')),vn=numsIn(vizPlain(f.viz));
  const only=[...rn].filter(x=>!bn.has(x));
  if(!only.length&&nearCopy(r,f.body||''))return null;
  return {h:r,open:[...vn].some(x=>rn.has(x)&&!bn.has(x))};
}
function chatReal(C,rl){
  if(!chatAlive(C))return false;
  const box=el('div','creal a-up'+(rl.open?' open':''));
  const b=el('button','crealbtn',`${icon('bulb',{size:14,stroke:2.6})}<span>Prościej</span>${icon('chevron-down',{size:14,stroke:2.8,cls:'chev'})}`);b.type='button';b.setAttribute('aria-expanded',String(!!rl.open));
  const tx=el('div','crealtx',rl.h);tx.hidden=!rl.open;
  b.onclick=e=>{e.stopPropagation();const o=box.classList.toggle('open');tx.hidden=!o;b.setAttribute('aria-expanded',String(o));if(o){chatShow(C,tx);if(C.fox)foxAct(C.fox,'nod');}};
  box.appendChild(b);box.appendChild(tx);chatBox(C).appendChild(box);chatShow(C,box);
  return true;
}
function chatHead(C){const L=C.L,h=L.querySelector('.lessonhead');if(h)h.replaceWith(lessonHead(C.ls));}
async function chatDose(C){
  const ls=C.ls,lv=ls.lv,i=ls.feedIdx,f=lv.feed[i],n=lv.feed.length;
  chatHead(C);chatFoot(C,null);
  const sec=el('section','cdose'),head=el('button','cdhead a-up',`<span class="cdn">Część ${i+1} z ${n}</span><span class="cdt">${noEmoji(f.title)}</span><span class="cdk">${icon('check',{size:15,stroke:3.6})}</span>`);
  head.type='button';head.onclick=e=>{e.stopPropagation();if(sec.classList.contains('done'))sec.classList.toggle('open');};
  sec.appendChild(head);C.list.appendChild(sec);C.cur=sec;chatShow(C,head,true);
  await chatWait(C,500);
  for(const h of feedChunks(f.body)){if(!txt(h).trim())continue;if(!await chatPut(C,chunkView(h)))return;} // pusty kawałek (np. dawka z samą wizualizacją) — bez pustego dymka
  const rl=doseReal(f);if(rl&&!chatReal(C,rl))return; // „Prościej” pod tekstem dawki (zwinięte)
  if(vizOk(f.viz)&&!await chatViz(C,f.viz))return;
  chatOffer(C);
}
function chatOffer(C){if(!chatAlive(C))return;chatFoot(C,[['Dalej',()=>{const ck=doseCheck(C.ls.lv,C.ls.feedIdx);if(ck)chatCheck(C,ck);else chatNext(C);},true]]);}
async function chatCheck(C,ck){
  chatFoot(C,null);
  const b=await chatSay(C,`${esc(ck.before)}<span class="blank">?</span>${esc(ck.after)}`,'ccheck',icon('target',{size:14})+'uzupełnij lukę');if(!b)return;
  const PRAISE=['Dokładnie!','Tak jest!','O to chodziło.','Brawo!'];
  chatFoot(C,ck.opts.map(o=>[esc(o),btn=>{
    const ok=o===ck.term,bl=b.querySelector('.blank');C.foot.querySelectorAll('.creply').forEach(x=>{x.disabled=true;if(x.textContent===ck.term)x.classList.add('ok');});
    if(bl){bl.textContent=ck.term;bl.classList.add(ok?'ok':'bad');}
    if(ok){btn.classList.add('ok','a-pop');const xp=addXP(current.id,2);b.appendChild(el('span','cxp a-pop','+'+xp+' XP'));if(C.fox)foxAct(C.fox,Math.random()<.5?'giggle':'hop');}
    else{btn.classList.add('bad','a-shake');if(C.fox)foxAct(C.fox,'sigh');}
    const t=setTimeout(async()=>{if(!chatAlive(C))return;chatFoot(C,null);if(await chatSay(C,ok?PRAISE[Math.floor(Math.random()*PRAISE.length)]:`Prawie. Tu pasuje „${esc(ck.term)}”.`))chatFoot(C,[['Dalej',()=>chatNext(C),true]]);},650);C.t.push(t);
  }]));
}
async function chatNext(C){
  const ls=C.ls;if(C.cur){C.cur.classList.add('done');C.cur.classList.remove('open');}C.cur=null; // przerobiona część zwija się do jednej linii
  ls.feedIdx++;
  if(ls.feedIdx<ls.lv.feed.length){lessonSave(ls);return chatDose(C);} // P1-11: miejsce w czacie zapisane po każdej części
  ls.feedIdx=ls.lv.feed.length-1;chatHead(C);chatFoot(C,null);
  const has=ls.items.length;
  if(!await chatSay(C,has?'To wszystko na start. Sprawdźmy, co zostało w głowie.':'To wszystko w tym poziomie. Dobra robota!'))return;
  if(C.fox)foxAct(C.fox,'wave');
  chatFoot(C,[[has?'CZAS NA PYTANIA':'ZAKOŃCZ',()=>{chatStop(C);if(has){ls.phase='quiz';ls.replay=false;lessonSave(ls);renderLesson();}else finishLesson();},true]]);
}
function startChat(ls,L,body){
  const C={ls,L,body,list:el('div','chat'),foot:el('div','lessonfoot chatfoot'),t:[],terms:new Set(Array.isArray(ls.terms)?ls.terms:[]),cur:null,fox:null};ls.chat=C;
  const all=new Set();(ls.lv.feed||[]).forEach(f=>{boldTerms(f.body).forEach(x=>all.add(fold(x)));feedChunks(f.body).forEach(h=>{const v=chunkView(h);if(v.k==='vocab')v.items.forEach(it=>{if(it.lt)all.add(fold(it.lt));});});});C.allTerms=all.size;
  const top=el('div','chattop',`<div class="chatfox">${fox('idle',56)}</div><div class="grow"><div class="chatname">Lis tłumaczy</div><div class="chatsub">${noEmoji(ls.lv.title)}</div></div>`+
    (C.allTerms?`<div class="chatterms" id="chatterms" title="Zebrane pojęcia">${icon('bookmark',{size:15})}<b>${Math.min(C.terms.size,C.allTerms)}/${C.allTerms}</b></div>`:''));
  body.classList.add('chatbody');body.appendChild(top);body.appendChild(C.list);L.appendChild(C.foot);
  body.onclick=e=>{if(C.skip&&!e.target.closest('button,.cterm'))C.skip();}; // stuknięcie w czat = szybciej
  liveFoxes(top);C.fox=top.querySelector('svg.fx');
  if(ls.feedIdx>0)C.list.appendChild(el('div','cdiv a-up',`<span>${icon('bookmark',{size:14})}</span>Wracamy od części ${ls.feedIdx+1} z ${(ls.lv.feed||[]).length}`)); // P1-11: wznowiona lekcja
  else if(C.allTerms)C.list.appendChild(el('div','chint a-up',icon('bookmark',{size:15})+'<span>Stuknij słówko albo <b class="cterm demo">wyróżnione pojęcie</b>, kiedy już je pamiętasz — trafi do licznika.</span>'));
  chatDose(C);
}
/* ---------- PRZERWANA LEKCJA (P1-11): zapis miejsca w czacie / pytaniach, powrót z węzła ścieżki ----------
   PROGRESS.lessonSave = napis JSON {"<sid>:<lid>": {v:1, at, sig, phase, feedIdx, items:["q3","t0",…], qIdx, score, combo, maxCombo, broken, xp,
   bad:[indeksy kroków], run:[[ms,0|1]], el, terms:[…], replay}} — opcjonalne (stare zapisy go nie mają). Napis, bo scalanie w cloud.js bierze
   tekst w całości (obiekt scalałby się pole po polu i mieszał kolejność pytań z dwóch urządzeń). Najwyżej LS_MAX przerwanych lekcji; wpis znika
   po wyniku poziomu, przy „Od nowa” i gdy treść poziomu się zmieniła (sig). Każdy wpis jest sprawdzany przy odczycie (dane z synchronizacji). */
const LS_MAX=6;
function lsaves(){try{const o=JSON.parse(typeof PROGRESS.lessonSave==='string'?PROGRESS.lessonSave:'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{};}catch(e){return {};}}
function lsavesPut(o){
  const ks=Object.keys(o).filter(k=>o[k]&&typeof o[k]==='object').sort((a,b)=>(+o[b].at||0)-(+o[a].at||0)).slice(0,LS_MAX);
  if(!ks.length)delete PROGRESS.lessonSave;else{const out={};ks.forEach(k=>{out[k]=o[k];});PROGRESS.lessonSave=JSON.stringify(out);}
  saveProgress();
}
function lvSig(lv){return [(lv.feed||[]).length,(lv.quiz||[]).length,(lv.tasks||[]).length].join('.');}
function lessonDrop(sid,lid){const all=lsaves(),k=sid+':'+lid;if(all[k]){delete all[k];lsavesPut(all);}}
/* zapis bieżącej lekcji; q = indeks następnego pytania (po odpowiedzi: qIdx+1). Bez postępu (pierwsza część czatu, powtórka przed pierwszą odpowiedzią) — bez wpisu */
function lessonSave(ls,q){
  if(!current||!ls||ls.done)return false;
  q=q==null?(ls.phase==='quiz'&&ls.answered?ls.qIdx+1:ls.qIdx):q;const k=current.id+':'+ls.lv.id; // X przy otwartym „Dobrze!”/„Nie tym razem”: odpowiedź już policzona → następne pytanie
  const worth=ls.phase==='feed'?ls.feedIdx>0:(q>0||(!ls.replay&&(ls.lv.feed||[]).length>0)); // pytania po przeczytanym czacie też się liczą
  const all=lsaves();
  if(!worth){if(all[k]){delete all[k];lsavesPut(all);}return false;}
  const terms=ls.chat?[...ls.chat.terms]:(ls.terms||[]);
  all[k]={v:1,at:Date.now(),sig:lvSig(ls.lv),phase:ls.phase,feedIdx:ls.feedIdx,items:ls.items.map(it=>it.kind==='quiz'?'q'+it.qi:'t'+it.ti),qIdx:q,
    score:ls.score,combo:ls.combo,maxCombo:ls.maxCombo,broken:!!ls.broken,xp:ls.xp,bad:ls.marks.map((m,i)=>m==='bad'?i:-1).filter(i=>i>=0),
    run:ls.run.map(r=>[Math.max(0,Math.round(r.t)),r.correct?1:0]),el:ls.t0!=null?Math.max(0,Date.now()-ls.t0):null,terms:terms.filter(x=>typeof x==='string').slice(0,200),replay:!!ls.replay};
  lsavesPut(all);return true;
}
/* odczyt zapisu poziomu: pełna walidacja (indeksy pytań i zadań muszą istnieć, liczby w zakresie) — zły wpis = brak wpisu */
function lessonLoad(s,lv,all){
  const sv=(all||lsaves())[s.id+':'+lv.id];if(!sv||typeof sv!=='object'||sv.v!==1||sv.sig!==lvSig(lv))return null;
  const I=v=>Number.isInteger(v)&&v>=0,nf=(lv.feed||[]).length;
  if(!Array.isArray(sv.items)||sv.items.length>60||(sv.phase!=='feed'&&sv.phase!=='quiz'))return null;
  const items=[];
  for(const r of sv.items){if(typeof r!=='string')return null;const n=+r.slice(1);if(!I(n))return null;
    if(r[0]==='q'){if(!(lv.quiz||[])[n])return null;items.push({kind:'quiz',q:qOf(s,lv,n),qi:n});}
    else if(r[0]==='t'){const t=(lv.tasks||[])[n];if(!t||!TASKS[t.type])return null;items.push({kind:'task',task:t,ti:n});}
    else return null;}
  if(!I(sv.qIdx)||sv.qIdx>items.length||!I(sv.feedIdx)||(nf?sv.feedIdx>=nf:sv.feedIdx!==0))return null;
  if(sv.phase==='feed'&&!nf)return null;if(sv.phase==='quiz'&&!items.length)return null;
  const num0=v=>I(v)?v:0;
  const run=Array.isArray(sv.run)?sv.run.filter(x=>Array.isArray(x)&&num(x[0])&&x[0]>=0).slice(0,items.length).map(x=>({t:x[0],correct:!!x[1]})):[];
  return {phase:sv.phase,feedIdx:sv.feedIdx,items,qIdx:sv.qIdx,score:Math.min(num0(sv.score),sv.qIdx),combo:num0(sv.combo),maxCombo:num0(sv.maxCombo),broken:!!sv.broken,
    xp:num0(sv.xp),bad:Array.isArray(sv.bad)?sv.bad.filter(I):[],run,el:num(sv.el)&&sv.el>=0?sv.el:null,
    terms:Array.isArray(sv.terms)?sv.terms.filter(x=>typeof x==='string'&&x.length<=80).slice(0,200):[],replay:!!sv.replay};
}
function lessonGhost(ls){const g=ghosts()[ghostKey(ls.lv)];if(g){ls.ghost=Array.isArray(g)?g:g.run;ls.ghostAt=Array.isArray(g)?null:g.at;}} // krok 8: duch = najlepszy przebieg tego poziomu
/* arkusz „Dokończyć lekcję?” z węzła: DOKOŃCZ wraca do zapisanego miejsca, „Od nowa” kasuje wpis */
function openResume(lv,sv){
  const n=sv.items.length,nf=(lv.feed||[]).length;
  const where=sv.phase==='feed'?`Lekcja przerwana na części ${sv.feedIdx+1} z ${nf}.`:sv.qIdx>=n?'Wszystkie pytania za Tobą — zostało podsumowanie.':
    `Lekcja przerwana na pytaniu ${sv.qIdx+1} z ${n}${sv.qIdx?` · dobrze ${sv.score} z ${sv.qIdx}`:''}.`;
  const sh=openSheet('ask resume',`<div class="shandle"></div><div class="shead"><div class="st2">Dokończyć lekcję?</div></div>
    <p class="sp"><b>${noEmoji(lv.title)}</b><br>${where}</p>
    <div class="sbtns"><button class="pill ghost" id="rsnew">Od nowa</button><button class="pill" id="rsgo" data-primary>DOKOŃCZ</button></div>`);
  sh.setAttribute('aria-modal','true');sheetBack();document.getElementById('sheetback').onclick=closeSheet;
  sh.querySelector('#rsgo').onclick=()=>{if(!advOk())return;closeSheet();resumeLesson(lv,sv);};
  sh.querySelector('#rsnew').onclick=()=>{if(!advOk())return;closeSheet();lessonDrop(current.id,lv.id);startLesson(lv,{fresh:true});};
  const kf=keyFn;keyFn=e=>{if(e.key==='Escape'){e.preventDefault();closeSheet();}else if(kf)kf(e);};
}
function resumeLesson(lv,sv){
  if(hearts().n<=0){showNoHearts({inLesson:false,lv});return;}
  const ls={lv,phase:sv.phase,feedIdx:sv.feedIdx,items:sv.items,qIdx:sv.qIdx,score:sv.score,answered:false,combo:sv.combo,maxCombo:Math.max(sv.maxCombo,sv.combo),broken:sv.broken,
    xp:sv.xp,marks:[],run:sv.run,t0:sv.el!=null?Date.now()-sv.el:null,replay:sv.replay,terms:sv.terms,resumed:true};
  sv.bad.forEach(i=>{ls.marks[i]='bad';});
  lessonState=ls;lessonGhost(ls);
  const L=document.getElementById('lesson');L.classList.add('open');
  renderLesson();
}
/* ---------- LEKCJA: nauka w czacie -> quiz z panelem dobrze/źle, życiami i combo -> LevelComplete ---------- */
let lessonState=null;
function startLesson(lv,o){
  o=o||{};
  if(hearts().n<=0){showNoHearts({inLesson:false,lv});return;} // bez życia nie zaczynasz
  if(!o.fresh){const sv=lessonLoad(current,lv);if(sv)return openResume(lv,sv);} // przerwana wcześniej → „Dokończyć lekcję?”
  const items=levelSession(lv),nf=(lv.feed||[]).length;
  const replay=!!(subjState(current.id).levels[lv.id]||{}).done&&nf>0&&items.length>0; // powtórka zaliczonego poziomu: od pytań, czat pod „Przeczytaj jeszcze raz”
  lessonState={lv,phase:nf&&!replay?'feed':'quiz',feedIdx:0,items,qIdx:0,score:0,answered:false,combo:0,maxCombo:0,broken:false,xp:0,marks:[],run:[],t0:null,replay};
  lessonGhost(lessonState);
  const L=document.getElementById('lesson');L.classList.add('open');
  renderLesson();
}
function closeLesson(){closeSheet();keyFn=null;taskCleanup();if(lessonState)chatStop(lessonState.chat);clearInterval(bossInt);clearInterval(ghostInt);lessonState=null;bossState=null;const L=document.getElementById('lesson');if(L)L.classList.remove('open');renderSubject();}
/* X w lekcji: miejsce jest zapisane na bieżąco, więc bez pytania — zamyka i mówi, że da się wrócić */
function leaveLesson(){const ls=lessonState;const kept=!!ls&&!ls.done&&lessonSave(ls);closeLesson();if(kept)toast('Miejsce zapisane — dokończysz z węzła na ścieżce','bookmark');}
/* nagłówek lekcji: zamknij, pasek segmentowy (krok = dawka albo pytanie; zły = czerwony), serca */
function lessonHead(ls){
  const totalFeed=(ls.lv.feed||[]).length,steps=totalFeed+ls.items.length;
  const cur=ls.phase==='feed'?ls.feedIdx:totalFeed+ls.qIdx;
  const head=el('div','lessonhead');
  const x=el('button','x',icon('close',{size:18,stroke:3}));x.setAttribute('aria-label','Zamknij lekcję');x.onclick=leaveLesson;head.appendChild(x);
  const seg=el('div','segbar');seg.setAttribute('aria-label',`krok ${Math.min(cur+1,steps)} z ${steps}`);
  for(let i=0;i<steps;i++)seg.appendChild(el('i',i<cur?(ls.marks[i]==='bad'?'bad':'on'):''));
  head.appendChild(seg);
  head.appendChild(heartsPill());
  return head;
}
function renderLesson(){
  const L=document.getElementById('lesson');const s=current;const ls=lessonState;const lv=ls.lv;
  const totalFeed=(lv.feed||[]).length;
  closeSheet();taskCleanup();chatStop(ls.chat);
  L.innerHTML='';
  L.appendChild(lessonHead(ls));
  const body=el('div','lessonbody');L.appendChild(body);

  if(ls.phase==='feed'){
    startChat(ls,L,body);
  } else if(ls.phase==='quiz'){
    // sesja poziomu: pytania quizu i zadania (krok 5) w jednym strumieniu; panel dobrze/źle, serca i combo wspólne
    if(ls.qIdx>=ls.items.length)return finishLesson();
    const it=ls.items[ls.qIdx];ls.answered=false;
    const stepIdx=totalFeed+ls.qIdx;
    if(ls.t0==null)ls.t0=Date.now(); // krok 8: czas przebiegu liczony od pierwszego pytania (duch)
    clearInterval(ghostInt);
    if(ls.replay&&ls.qIdx===0&&!ls.run.length){ // powtórka zaliczonego poziomu zaczyna się od pytań; czat na życzenie
      const rr=el('button','pill text sm lreread',icon('book',{size:16})+'<span>Przeczytaj jeszcze raz</span>');rr.id='lreread';
      rr.onclick=()=>{if(!advOk())return;ls.phase='feed';ls.feedIdx=0;ls.replay=false;ls.t0=null;clearInterval(ghostInt);renderLesson();};body.appendChild(rr);}
    if(ls.ghost){body.appendChild(ghostCard(ls));ghostInt=setInterval(ghostTick,400);setTimeout(ghostTick,0);}
    const onAnswer=(ok,fb)=>{ // fb = {e, sub} — dla pytania quizu to samo pytanie (e + litera z c)
      if(lessonState!==ls)return; // lekcja zamknięta, zanim zadanie skończyło się z opóźnieniem
      ls.answered=true;ls.broken=false;
      ls.run.push({t:Date.now()-ls.t0,correct:!!ok}); // krok 8: przebieg do ducha
      const next=()=>{ls.qIdx++;renderLesson();};
      if(ok){
        ls.score++;ls.combo++;ls.maxCombo=Math.max(ls.maxCombo,ls.combo);
        okRun(true);if(ls.combo>(stats().maxCombo|0)){stats().maxCombo=ls.combo;saveProgress();if(ls.combo>=10)checkBadges();}
        if(it.kind==='task'&&it.task.type==='tf'&&it.task.seconds)missionEvent('tftime',1);
        const m=comboMult(ls.combo),xp=(it.kind==='task'?TASK_XP:QUIZ_XP)*m;ls.xp+=addXP(s.id,xp);
        body.appendChild(confetti(4));
        lessonSave(ls,ls.qIdx+1); // P1-11: odpowiedź zapisana — po powrocie następne pytanie
        sheetOk(fb,{xp,mult:m,combo:ls.combo,onNext:next,subj:s,lv,qi:it.kind==='quiz'?it.qi:null});
      }else{
        ls.broken=ls.combo>=2;ls.combo=0;ls.marks[stepIdx]='bad';okRun(false);
        loseHeart();
        const hp=L.querySelector('.hearts');if(hp){hp.classList.add('a-beat');hp.appendChild(el('span','minus a-blink','−1'));}
        const seg=L.querySelectorAll('.segbar i')[stepIdx];if(seg)seg.className='bad';
        lessonSave(ls,ls.qIdx+1);
        sheetBad(fb,{sub:fb.sub,subj:s,lv,qi:it.kind==='quiz'?it.qi:null,onNext:()=>{if(hearts().n<=0&&ls.qIdx+1<ls.items.length)showNoHearts({inLesson:true,lv,onContinue:next});else next();}}); // krok 9: qi → „popraw pytanie”; bez „Do fiszek” w lekcji (P1-11: wyglądało jak pomoc, a zamykało lekcję)
      }
    };
    const o={n:ls.qIdx+1,total:ls.items.length,combo:ls.combo,broken:ls.broken};
    const blk=it.kind==='task'?taskBlock(it.task,{...o,onAnswer}):quizBlock(it.q,{...o,onAnswer:(i,ok)=>{srsTouch(s.id,lv.id,'q'+it.qi,ok);onAnswer(ok,it.q);}});
    body.appendChild(blk.body);
    const foot=el('div','lessonfoot');foot.appendChild(blk.foot);L.appendChild(foot);
  }
}
/* wynik poziomu (LevelComplete.html); logika XP/gwiazdek/zaliczenia jak dotąd + bonus combo w XP z quizu */
/* świętowanie: duże gwiazdki wpadające po kolei, liczniki nabijane od zera */
const STAR_D=(()=>{let d='';for(let k=0;k<10;k++){const r=k%2?12.5:27,a=-Math.PI/2+k*Math.PI/5;d+=(k?'L':'M')+(30+r*Math.cos(a)).toFixed(1)+' '+(31+r*Math.sin(a)).toFixed(1);}return d+'Z';})();
function bigStar(on,i,delay){return `<div class="lcstar s${i}${on?' on':''}" style="--d:${delay}s"><svg viewBox="0 0 60 64" aria-hidden="true"><path class="sh" d="${STAR_D}" transform="translate(0 4)"/><path class="bd" d="${STAR_D}"/>${on?'<path class="shine" d="M20 20l5-5"/>':''}</svg>${on?'<i></i><i></i><i></i><i></i><i></i><i></i>':''}</div>`;}
function calmMotion(){return document.documentElement.classList.contains('reduce-motion')||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);}
function countUp(root){root.querySelectorAll('[data-count]').forEach(e=>{const to=+e.dataset.count||0,from=+e.dataset.from||0,pre=e.dataset.pre||'',suf=e.dataset.suf||'';
  if(calmMotion()||to===from){e.textContent=pre+to+suf;return;}
  e.textContent=pre+from+suf;const t0=performance.now()+(+e.dataset.delay||0),dur=+e.dataset.dur||900;
  const step=t=>{if(!e.isConnected)return;const k=Math.min(1,Math.max(0,(t-t0)/dur));e.textContent=pre+Math.round(from+(to-from)*(1-Math.pow(1-k,3)))+suf;
    if(k<1)requestAnimationFrame(step);else{e.classList.remove('cbump');void e.offsetWidth;e.classList.add('cbump');}};requestAnimationFrame(step);});}
/* seria jako osobny ekran po pierwszym ukończonym poziomie dnia (raz dziennie: META.streakCeleb) */
function needStreakCeleb(){return streakDisplay()>0&&META.lastDay===todayStr()&&META.streakCeleb!==todayStr();}
function afterLevel(){if(needStreakCeleb())showStreakCeleb(closeLesson);else closeLesson();}
function showStreakCeleb(onDone){
  META.streakCeleb=todayStr();saveMeta();
  const L=document.getElementById('lesson');closeSheet();L.innerHTML='';
  const n=streakDisplay(),best=Math.max(META.best||0,n),m=msToday(n),look=foxLook(n);
  const fresh=m&&META.ms&&META.ms[n]===todayStr(); // nagroda przyznana dziś (pierwszy raz na tym progu)
  const body=el('div','lessonbody done scel'+(m?' ms':''));body.appendChild(confetti(m?30:18));
  const w=el('div','lc');
  const days=weekDots().map((d,i)=>{const ic=d.st==='done'?icon('check',{size:17,stroke:3.6}):d.st==='frozen'?icon('snow',{size:16,stroke:2.8}):(d.st==='todaydone'||d.st==='today')?icon('flame',{size:16}):'';
    return `<div class="day ${d.st}"><div class="dot a-pop" style="animation-delay:${(1.1+i*.07).toFixed(2)}s">${ic}</div><span>${d.lab}</span></div>`;}).join('');
  const rewards=m&&fresh?[m.gems?['+'+m.gems,pl(m.gems,'gem','gemy','gemów'),'cyan']:null,m.freezes?['+'+m.freezes,pl(m.freezes,'zamrożenie','zamrożenia','zamrożeń'),'ice']:null,m.badge?[String(n),'odznaka','gold']:null].filter(Boolean):[];
  w.innerHTML=(m?`<div class="mschip a-pop">KAMIEŃ MILOWY</div>`:'')+
    `<div class="lcfox scfox">${fox(m?'happy':'fire',m?158:168,{emote:m?m.emote:'',acc:look.acc,flame:look.flame})}</div>
    <div class="scnum fl-${look.flame}"><span data-count="${n}" data-from="${Math.max(0,n-1)}" data-delay="450" data-dur="700">${n}</span></div>
    <div class="sct a-up d3">${n===1?'dzień z rzędu!':'dni z rzędu!'}</div>`+
    (m&&m.item?`<div class="msitem a-pop" style="animation-delay:.8s"><div class="ico">${fox('idle',46,{acc:look.acc,flame:look.flame})}</div><div class="grow"><div class="t">Nowe dla lisa: ${m.name}</div><div class="s">zostaje, dopóki trwa seria</div></div></div>`:'')+
    (rewards.length?`<div class="msrw">${rewards.map((r,i)=>`<div class="rc ${r[2]} a-pop" style="animation-delay:${(1+i*.13).toFixed(2)}s"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('')}</div>`:'')+
    (m?'':`<div class="week scweek a-up d4"><div class="days">${days}</div></div>`)+
    `<div class="a-up d5" style="width:100%">${msNextBar(n)}</div>`+
    (m?'':`<p class="scp a-up d5">${n>1&&META.bestWas!=null&&n>META.bestWas?'Nowy rekord. ':''}${n===1?'Seria wystartowała. Wróć jutro, żeby jej nie stracić.':'Wróć jutro i nie przerywaj serii.'}</p>`);
  body.appendChild(w);L.appendChild(body);
  const foot=el('div','lessonfoot col');const b=el('button','pill amber a-glow','DALEJ');b.onclick=onDone;foot.appendChild(b);L.appendChild(foot);
  countUp(w);liveFoxes(w);keyFn=e=>{if(e.key==='Enter')b.click();};
}
function finishLesson(){
  const s=current;const ls=lessonState;const lv=ls.lv;
  ls.done=true;lessonDrop(s.id,lv.id); // P1-11: próba skończona — zapis miejsca znika; ekran wyniku pokazuje zaległe toasty z nagrodami
  const pct=ls.items.length?Math.round(ls.score/ls.items.length*100):100;
  const stars = pct>=90?3:(pct>=70?2:(pct>=50?1:0));
  const passed = ls.items.length?pct>=50:true;
  const st=subjState(s.id);const prev=st.levels[lv.id]||{};
  let bonus=0,gem=0;
  clearInterval(ghostInt);
  if(passed){
    st.levels[lv.id]={done:true,stars:Math.max(stars,prev.stars||0),best:Math.max(pct,prev.best||0)};
    if(!prev.done){bonus=addXP(s.id,15);}
    saveProgress();
    completeDaily(s.id,'lesson',lv.id);
    testDone(s.id,'learn',lv.id); // krok 7: dzień „nauka” w planie do sprawdzianu
    gem=(prev.done?0:GEM.level)+(stars>=3&&(prev.stars|0)<3?GEM.stars3:0);if(gem)addGems(gem); // krok 8: gemy za poziom (+5 za pierwsze 3 gwiazdki), misja „poziom” — powtórka bez nagród
    if(!prev.done){missionEvent('level',1);histAdd('levels',1);} // krok 9: dziennik dnia
  }
  histMax('combo',ls.maxCombo);
  const gh=ghostFinish(ls,passed);if(gh&&gh.xp)bonus+=gh.xp; // krok 8: duch (zapis / pokonany +10 XP / lepszy)
  checkBadges();
  const L=document.getElementById('lesson');closeSheet();
  L.innerHTML='';
  const body=el('div','lessonbody done');
  if(passed)body.appendChild(confetti(22));
  const lc=el('div','lc');
  lc.innerHTML=`<div class="lcstars">${bigStar(stars>=1,0,.15)}${bigStar(stars>=2,1,.35)}${bigStar(stars>=3,2,.55)}</div>
    <div class="lcfox">${fox(passed?'happy':'oops',140)}</div>
    <div class="lctxt"><div class="lct lcpop">${passed?'Poziom zaliczony!':'Poziom niezaliczony'}</div><div class="lcs">${noEmoji(s.name)} · ${noEmoji(lv.title)}</div></div>
    <div class="lcstats"><div class="lcstat a-pop" style="animation-delay:.85s"><div class="k">XP</div><div class="v gold" data-count="${ls.xp+bonus}" data-pre="+" data-delay="950">+${ls.xp+bonus}</div></div>
      <div class="lcstat a-pop" style="animation-delay:.95s"><div class="k">Celność</div><div class="v acid" data-count="${pct}" data-suf="%" data-delay="1050">${pct}%</div></div>
      <div class="lcstat a-pop" style="animation-delay:1.05s"><div class="k">Combo</div><div class="v pink" data-count="${ls.maxCombo}" data-pre="x" data-delay="1150" data-dur="500">x${ls.maxCombo}</div></div></div>
    ${gem||(passed&&prev.done)?`<div class="lcrewards a-up d5">${gem?`<span class="lcreward cyan">${icon('gem',{size:15})}+${gem} ${pl(gem,'gem','gemy','gemów')}</span>`:'<span class="lcreward">powtórka poziomu · bez gemów</span>'}${boostActive()?'<span class="lcreward gold">'+icon('bolt',{size:15})+'podwójne XP</span>':''}</div>`:''}
    ${gh?`<div class="lcghost ${gh.kind} a-up d5"><div class="ico">${icon(gh.kind==='win'?'bolt':'ghost',{size:24})}</div><div class="grow"><div class="t">${gh.t}</div><div class="s">${gh.s}</div></div></div>`:''}
    ${passed?'':'<p class="lcp">Poniżej 50%. Przejdź naukę jeszcze raz i spróbuj ponownie.</p>'}`;
  body.appendChild(lc);L.appendChild(body);countUp(lc);liveFoxes(lc);
  const foot=el('div','lessonfoot col');
  const main=el('button','pill a-glow',passed?'DALEJ':'SPRÓBUJ JESZCZE RAZ');main.id=passed?'lcont':'lretry';
  main.onclick=passed?afterLevel:()=>startLesson(lv);
  const alt=el('button','pill text',passed?'POWTÓRZ POZIOM':'WRÓĆ NA ŚCIEŻKĘ');alt.id=passed?'lretry':'lcont';
  alt.onclick=passed?()=>startLesson(lv):closeLesson;
  foot.appendChild(main);foot.appendChild(alt);L.appendChild(foot);
  keyFn=e=>{if(e.key==='Enter')main.click();};
}

/* ---------- FISZKI (cały przedmiot, filtr po poziomach) ---------- */
/* P1-17: fiszkę ocenia się dopiero po odwróceniu i chwili na przeczytanie odwrotu (RATE_MS). „Umiem / jeszcze nie” albo przesunięcie
   nieodwróconej karty ją odwraca; stuknięcie tuż po odwróceniu czeka, aż minie RATE_MS (bez zgubionego dotyku). Do tego czasu przyciski są
   wyszarzone (.fbtns.wait). Tak liczą się tylko przeczytane karty: SRS, XP, misja, plan dnia i „serce za fiszki”. st = stan karty {flipped, seenAt}. */
const RATE_MS=900;
function cardGate(st,flip,btns,rate){
  const ready=()=>!!st.seenAt&&Date.now()-st.seenAt>=RATE_MS;
  const paint=()=>{const r=ready();btns.classList.toggle('wait',!r);btns.querySelectorAll('.fbtn').forEach(b=>b.setAttribute('aria-disabled',String(!r)));};
  let pend=null;
  const seen=()=>{if(st.seenAt)return;st.seenAt=Date.now();setTimeout(()=>{if(flip.isConnected)paint();},RATE_MS+30);};
  if(st.flipped&&!st.seenAt)st.seenAt=Date.now()-RATE_MS; // karta odwrócona przed przerysowaniem
  const ask=ok=>{
    if(!st.seenAt){if(!st.flipped){st.flipped=true;flip.classList.add('flipped');}seen();return;} // najpierw odwrót
    const wait=st.seenAt+RATE_MS-Date.now();clearTimeout(pend);
    if(wait>0){pend=setTimeout(()=>{if(flip.isConnected)rate(ok);},wait);return;}
    rate(ok);};
  paint();
  return {ask,seen};
}
let fState=null;
function renderFiszki(sc){
  const s=current;
  if(!fState||fState.subj!==s.id)fState={subj:s.id,lvl:'all',idx:0,flipped:false};
  const wrap=el('div','scroll');
  const chips=el('div','chips');
  const mk=(id,name)=>{const c=el('div','chip'+(fState.lvl===id?' active':''),name);c.onclick=()=>{fState.lvl=id;fState.idx=0;fState.res=[];fState.only=null;fState.flipped=false;fState.seenAt=null;renderFiszki(sc);};return c;}; // nowa talia od przodu karty
  chips.appendChild(mk('all','Wszystko'));
  s.levels.filter(l=>(l.flashcards||[]).length).forEach(l=>chips.appendChild(mk(l.id,noEmoji(l.title))));
  wrap.appendChild(chips);
  let list = fState.lvl==='all'?allCards(s):allCards(s).filter(c=>c.lid===fState.lvl); // krok 6: elementy z lid/i (klucz SRS) także po filtrze poziomu
  if(!list.length&&fState.lvl!=='all'){fState.lvl='all';fState.idx=0;return renderFiszki(sc);} // poziom bez fiszek (np. boss) → cała talia, inaczej pusta karta
  if(fState.only)list=list.filter(c=>fState.only.includes(c.lid+':'+c.i)); // POWTÓRZ TE N: tylko „jeszcze nie” z poprzedniej talii
  if(fState.idx>=list.length)fState.idx=0;
  const c=list[fState.idx]||{t:'—',d:'Brak fiszek'};
  const hq=hearts().quest||0;
  wrap.appendChild(el('div','progressrow',`<div class="bar"><i style="width:${list.length?fState.idx/list.length*100:0}%"></i></div><div class="counter">${list.length?fState.idx+1:0}/${list.length}</div>${hq?`<div class="counter red">${icon('heart',{size:12})} za ${hq}</div>`:''}`));
  const flip=el('div','flip'+(fState.flipped?' flipped':''));flip.style.height='calc(100vh - 370px)';flip.style.height='calc(100dvh - 370px)'; // iOS < 15.4 bez dvh: druga wartość jest ignorowana, zostaje vh
  flip.innerHTML=`<div class="flipinner">
    <div class="face front"><span class="tag">${c.lvl||''}</span><div class="term">${c.t}</div><div class="tapomat">dotknij, żeby odwrócić</div></div>
    <div class="face back"><span class="tag">odpowiedź</span><div class="deftxt">${c.d}</div><div class="tapomat">dotknij, żeby wrócić</div></div></div>`;
  let swiped=false,g=null;flip.onclick=()=>{if(swiped){swiped=false;return;}fState.flipped=!fState.flipped;flip.classList.toggle('flipped');if(fState.flipped&&g)g.seen();};
  let x0=null;flip.onpointerdown=e=>{x0=e.clientX;}; // przeciągnięcie jak w Powtórce: w prawo = umiem, w lewo = jeszcze nie
  flip.onpointerup=e=>{if(x0==null)return;const dx=e.clientX-x0;x0=null;if(Math.abs(dx)>80){swiped=true;if(g)g.ask(dx>0);}};
  wrap.appendChild(flip);
  wrap.appendChild(el('div','swipehint3',`<span class="l">${icon('back',{size:16,stroke:2.8,cls:'a-bob'})}w lewo = jeszcze nie</span><span class="r">w prawo = umiem${icon('chevron-right',{size:16,stroke:2.8,cls:'a-bob d2'})}</span>`));
  const btns=el('div','fbtns');
  const no=el('button','fbtn no',icon('refresh',{size:18,stroke:2.8})+' jeszcze nie');const yes=el('button','fbtn yes',icon('check',{size:18,stroke:3.4})+' umiem');
  const next=(known)=>{if(!list.length||!advOk())return; // advOk: double-tap nie ocenia kolejnej, niewidzianej karty
    const pe=srs()[s.id+':'+c.lid+':'+c.i],xp=known&&(!pe||pe.due<=todayStr())?2:0; // XP tylko za kartę do powtórki (jak pudełko w srsTouch)
    srsTouch(s.id,c.lid,c.i,known);if(xp){addXP(s.id,xp);toast('+2 XP','check');}tickDaily(s.id,'review',1);missionEvent('review',1);heartReview();fState.flipped=false;fState.seenAt=null;
    (fState.res=fState.res||[]).push({c,ok:known,xp});
    if(fState.idx+1>=list.length&&!hearts().quest)return fiszkiDone(sc); // „Powtórz 10 fiszek” (Koniec żyć): krótsza talia leci w kółko, aż wróci serce
    fState.idx=(fState.idx+1)%list.length;renderFiszki(sc);};
  g=cardGate(fState,flip,btns,next);
  no.onclick=()=>g.ask(false);yes.onclick=()=>g.ask(true);
  btns.appendChild(no);btns.appendChild(yes);wrap.appendChild(btns);
  sc.innerHTML='';sc.appendChild(wrap);
}
/* koniec talii (FlashcardsDone.html): celność, umiem / do powtórki / XP, lista „wracają dziś”; POWTÓRZ TE N = talia tylko z „jeszcze nie” */
function fiszkiDone(sc){
  const s=current;const all=fState.res||[];const xp=all.reduce((a,r)=>a+r.xp,0);
  const res=[...new Map(all.map(r=>[r.c.lid+':'+r.c.i,r])).values()];const n=res.length,ok=res.filter(r=>r.ok).length; // talia zapętlona → każda karta raz, z ostatnią oceną
  const wrong=res.filter(r=>!r.ok).map(r=>r.c);const pct=n?Math.round(ok/n*100):0;
  const lv=fState.lvl==='all'?null:s.levels.find(l=>l.id===fState.lvl);
  fState.idx=0;fState.res=[];fState.flipped=false;fState.only=null; // powrót do zakładki = talia od nowa
  const R=52,C=Math.round(2*Math.PI*R*10)/10;
  const wrap=el('div','scroll fdone');if(pct>=50)wrap.appendChild(confetti(6));
  const lc=el('div','lc');
  lc.innerHTML=`<div class="rvring a-pop"><svg viewBox="0 0 124 124" aria-hidden="true"><circle class="ring-bg" cx="62" cy="62" r="${R}"/><circle class="ring-fg" cx="62" cy="62" r="${R}" style="stroke-dasharray:${C};stroke-dashoffset:${Math.round(C*(1-pct/100)*10)/10}"/></svg><div class="rvpct"><b>${pct}%</b><span>umiem</span></div></div>
    <div class="lctxt a-up d2"><div class="lct">Talia skończona</div><div class="lcs">${noEmoji(s.name)}${lv?' · '+noEmoji(lv.title):''} · ${n} ${pl(n,'pojęcie','pojęcia','pojęć')}</div></div>
    <div class="lcstats a-up d3"><div class="lcstat acid"><div class="v">${ok}</div><div class="k under">umiem</div></div><div class="lcstat red"><div class="v">${wrong.length}</div><div class="k under">do powtórki</div></div><div class="lcstat gold"><div class="v">+${xp}</div><div class="k under">XP</div></div></div>
    ${wrong.length?'<div class="setcard rvlist a-up d4"><div class="eyebrow sec">Wracają dziś</div>'+wrong.slice(0,3).map(c=>`<div class="setrow"><i class="rdot red"></i><span class="t grow">${c.t}</span><span class="v">${(srs()[s.id+':'+c.lid+':'+c.i]||{}).seen||1}. raz</span></div>`).join('<div class="setsep"></div>')
      +(wrong.length>3?`<div class="setsep"></div><div class="setrow"><span class="t muted">i ${wrong.length-3} ${pl(wrong.length-3,'kolejne','kolejne','kolejnych')}</span></div>`:'')+'</div>':''}`;
  wrap.appendChild(lc);
  const foot=el('div','rvfoot');
  const main=el('button','pill cyan a-glow',wrong.length?`POWTÓRZ TE ${wrong.length}`:'JESZCZE RAZ');main.id='fdmain';
  main.onclick=()=>{fState.only=wrong.length?wrong.map(c=>c.lid+':'+c.i):null;renderFiszki(sc);};
  const alt=el('button','pill text','NA DZIŚ WYSTARCZY');alt.id='fddone';alt.onclick=()=>go('today');
  foot.appendChild(main);foot.appendChild(alt);wrap.appendChild(foot);
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
  const t=testFor(s.id);const nCram=cramBlocks(s).length;
  const wrap=el('div','scroll exstart');
  wrap.innerHTML=`<div class="egspecs a-up">
      <div class="egspec a-pop d1"><b>${N}</b><span>${pl(N,'pytanie','pytania','pytań')}</span></div>
      <div class="egspec a-pop d2"><b>${cfg.lim||'∞'}</b><span>${cfg.lim?pl(cfg.lim,'minuta','minuty','minut'):'bez limitu'}</span></div>
      <div class="egspec a-pop d3"><b class="acid">${pass}%</b><span>próg</span></div></div>
    <div class="egcard a-up d2"><div class="eglbl">Zakres</div>
      <button class="egrow all${allOn?' on':''}" data-lv="all"><span class="box">${allOn?icon('check',{size:14,stroke:4}):''}</span><span class="t">Wszystkie poziomy</span><span class="n">${TOTAL}</span></button>
      ${s.levels.map(l=>{const on=cfg.levels.indexOf(l.id)>=0,n=(l.quiz||[]).length;return `<button class="egrow${on?' on':''}" data-lv="${esc(l.id)}" aria-pressed="${on}"><span class="box">${on?icon('check',{size:14,stroke:4}):''}</span><span class="t">${noEmoji(l.title)}</span><span class="n">${n}</span></button>`;}).join('')}</div>
    <div class="egcard a-up d3"><div class="eglbl">Liczba pytań</div><div class="egchips" id="egn">${nOpts.map(([v,l])=>`<button class="egchip${String(cfg.n)===String(v)||(v==='all'&&N===ALL)?' on':''}" data-n="${v}">${l}</button>`).join('')}</div>
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
    <div class="eglast cram a-up d6" id="excram" role="button" tabindex="0"><div class="ico violet">${icon('moon',{size:22})}</div><div class="grow"><div class="t">Egzamin jutro?</div><div class="s">Noc przed egzaminem — ${nCram} ${pl(nCram,'blok','bloki','bloków')} po 5 minut, potem spać</div></div>${icon('chevron-right',{size:20,cls:'chev'})}</div>`;
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
  // P1-7: bez drugiego tasowania (dawne permQ gubiło pm) — kolejność odpowiedzi z mixQ (qOf), więc przegląd po poprawce rysuje te same pozycje, a wybór (indeks na ekranie) dalej wskazuje tę samą odpowiedź
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
  addXP(s.id,correct*3);if(M-blank>=Math.ceil(M/2)){completeDaily(s.id,'exam');testDone(s.id,'mock');} // pusty egzamin nie zalicza planu
  const rec=examRec(s.id);rec.n=(rec.n|0)+1;if(passed)rec.passed=(rec.passed|0)+1;
  const entry={pct,grade,correct,total:M,date:todayStr()};const newBest=!rec.best||pct>rec.best.pct;rec.last=entry;if(newBest)rec.best=entry;
  if(passed)PROGRESS.examsPassed=(PROGRESS.examsPassed|0)+1;
  // talia błędów: klucze SRS złych odpowiedzi w PROGRESS.examDeck (jedna talia, ostatni egzamin zastępuje); Dziś dostaje wiersz „Powtórz błędy z egzaminu”
  const deck=wrong.map(w=>s.id+':'+w.q.lid+':q'+w.q.qi);
  PROGRESS.examDeck=((PROGRESS.examDeck||[]).filter(k=>k.indexOf(s.id+':')!==0)).concat(deck);if(!PROGRESS.examDeck.length)delete PROGRESS.examDeck;
  const d=daily();if(deck.length&&!d.tasks.some(x=>x.id===s.id+':weak'))d.tasks.push({id:s.id+':weak',done:false});
  else if(!deck.length)d.tasks=d.tasks.filter(x=>x.id!==s.id+':weak'||x.done); // talia pusta → niezrobione „Powtórz błędy” znika z planu
  saveProgress();planCheck(d);checkBadges(); // krok 8
  exState=null;
  renderExamResult({s,pool:ex.pool,correct,blank,wrong,pct,grade,pass,passed,used,M,auto,newBest,deck});
  if(auto)notify('Czas minął — egzamin zakończony','clock');
}
function ringSvg(pct,R){const C=Math.round(2*Math.PI*R*10)/10;return `<svg viewBox="0 0 124 124" aria-hidden="true"><circle class="ring-bg" cx="62" cy="62" r="${R}"/><circle class="ring-fg" cx="62" cy="62" r="${R}" style="stroke-dasharray:${C};stroke-dashoffset:${Math.round(C*(1-Math.max(0,Math.min(100,pct))/100)*10)/10}"/></svg>`;}
function renderExamResult(r){
  const s=r.s;const L=document.getElementById('lesson');if(!L)return;
  L.className='lesson open egres';L.innerHTML='';
  const body=el('div','lessonbody done');if(r.passed)body.appendChild(confetti(6));
  const scale=exScale(s);const [gMain,gRest]=gradeParts(r.grade);
  const nextG=scale.slice().reverse().find(([min])=>min>r.pct);
  const reach=min=>{for(let k=r.correct+1;k<=r.M;k++)if(Math.round(k/r.M*100)>=min)return k-r.correct;return 1;}; // ta sama reguła co ocena (zaokrąglony %)
  const need=nextG?reach(nextG[0]):0;
  const needPass=reach(r.pass);
  const note=(r.auto?'Czas minął. ':'')+(r.passed?(nextG?`Do ${gradeParts(nextG[1])[0]} brakuje ${need} ${pl(need,'pytania','pytań','pytań')}.`:'Najwyższa ocena w siatce.'):`Do progu ${r.pass}% brakuje ${needPass} ${pl(needPass,'pytania','pytań','pytań')}.`)+(r.newBest&&r.correct?' Nowy rekord.':'');
  const nw=r.wrong.length;
  // „Gdzie tracisz punkty” (Exam.html): celność per poziom, od najsłabszego; tylko gdy zakres ma więcej niż jeden poziom
  const byLv={};r.pool.forEach((q,i)=>{const k=q.lid;if(!byLv[k])byLv[k]={t:q.lvl||k,n:0,ok:0};byLv[k].n++;if(!r.wrong.some(w=>w.i===i))byLv[k].ok++;});
  const lvRows=Object.values(byLv).map(x=>({...x,pct:Math.round(x.ok/x.n*100)})).sort((a,b)=>a.pct-b.pct);
  const lvCard=lvRows.length>1?`<div class="egcard a-up d3"><div class="eglbl">Gdzie tracisz punkty</div><div class="eglv">${lvRows.map((x,i)=>`<div class="eglvrow ${x.pct<50?'red':x.pct<75?'gold':'acid'}"><span class="lb">${x.t}</span><div class="bar"><i class="a-grow d${Math.min(6,i+1)}" style="width:${x.pct}%"></i></div><span class="p">${x.pct}%</span></div>`).join('')}</div></div>`:'';
  // krok 9: każde pytanie ma przycisk „Popraw pytanie” (EditContent) i klikalne źródło (SourceView); poprawione = plakietka
  const editBtn=(q,i)=>`<button class="egedit" type="button" data-i="${i}">${icon('edit',{size:14})}<span>${q.edited?'Poprawione · edytuj':'Popraw pytanie'}</span></button>`;
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
    const redraw=()=>{const nq={...q,...qOf(s,lv,q.qi,q.pm||q.a.map((_,k)=>k))};r.pool[i]=nq;const w=r.wrong.find(x=>x.i===i);if(w)w.q=nq;
      // poprawiony klucz liczy się od razu: wynik, ocena, rekord, talia błędów (zaznaczona = w.sel, a przy dobrej = stare q.c)
      const sel=w?w.sel:q.c,ok=sel!=null&&sel===nq.c;
      if(ok===!!w){const k=s.id+':'+nq.lid+':q'+nq.qi;const rec=examRec(s.id);const was=r.passed;
        if(ok){r.wrong=r.wrong.filter(x=>x!==w);r.correct++;PROGRESS.examDeck=(PROGRESS.examDeck||[]).filter(x=>x!==k);}
        else{r.wrong=r.wrong.concat({q:nq,sel,i}).sort((a,b)=>a.i-b.i);r.correct--;PROGRESS.examDeck=(PROGRESS.examDeck||[]).filter(x=>x!==k).concat(k);
          const d=daily();if(!d.tasks.some(x=>x.id===s.id+':weak'))d.tasks.push({id:s.id+':weak',done:false});}
        if(!PROGRESS.examDeck.length)delete PROGRESS.examDeck;
        if(ok&&!deckKeys(s.id).length){const d=daily();d.tasks=d.tasks.filter(x=>x.id!==s.id+':weak'||x.done);planCheck(d);} // talia pusta → „Powtórz błędy” znika z planu (jak w examFinish)
        r.pct=Math.round(r.correct/r.M*100);r.grade=exGrade(s,r.pct);r.passed=r.pct>=r.pass;
        if(r.passed!==was){const dp=r.passed?1:-1;rec.passed=Math.max(0,(rec.passed|0)+dp);PROGRESS.examsPassed=Math.max(0,(PROGRESS.examsPassed|0)+dp);}
        if(rec.last){rec.last={...rec.last,pct:r.pct,grade:r.grade,correct:r.correct};if(r.newBest||!rec.best||r.pct>rec.best.pct){rec.best=rec.last;r.newBest=true;}}
        saveProgress();checkBadges();}
      renderExamResult({...r,quiet:true});};
    const eb=item.querySelector('.egedit');if(eb)eb.onclick=()=>openEditContent(s,lv,q.qi,{onBack:()=>{closeSheet();},onSaved:redraw});
    const sb=item.querySelector('.rsrc');if(sb)sb.onclick=()=>openSourceView(q,{...ctx,onSaved:redraw},()=>closeSheet()); // „Pytanie jest złe” → po zapisie ten sam przelicznik co „Popraw”
  });
  if(r.quiet)return;
  if(r.passed)toast('Zdane, ocena '+txt(gMain),'trophy');else toast('Niezaliczone','x-circle');
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
/* niezaliczone poziomy do zakresu: także wcześniejsze spoza zakresu, bo poziomy odblokowują się po kolei */
function unfinishedLevels(s,levels){const st=subjState(s.id);const last=Math.max(-1,...s.levels.map((l,i)=>levels.indexOf(l.id)>=0?i:-1));return s.levels.slice(0,last+1).map(l=>l.id).filter(id=>!(st.levels[id]||{}).done);}
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
  const mock=date=>({date,kind:'mock',minutes:Math.max(8,Math.min(20,nq)),n:Math.min(20,nq)});
  if(left.length&&N>=2){while(tail.length>1&&N-tail.length<1)tail.shift(); // mało dni, a są poziomy do nauki: nauka kosztem próbnego / słabych punktów, „Noc przed” zostaje
    if(tail[0].kind==='weak'&&!hasDeck(s.id))tail[0]=mock(tail[0].date);}
  else if(N===2&&!hasDeck(s.id)&&(t.plan||[]).some(r=>r.date===tail[0].date&&r.kind==='mock'))tail[0]=mock(tail[0].date); // próbny przesunięty przez naukę nie znika następnego dnia
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
  r.done=true;saveProgress();notify('Plan do sprawdzianu: dzień zaliczony','calendar');return true;
}
function tpTitle(t,r){
  const s=testSubject(t);
  if(r.kind==='learn'){const n=(r.lv||[]).length;if(n===1&&s){const lv=s.levels.find(l=>l.id===r.lv[0]);if(lv)return 'Nauka: '+noEmoji(lv.title);}return `Nauka: ${n} ${pl(n,'poziom','poziomy','poziomów')}`;}
  if(r.kind==='review')return r.short?'Noc przed egzaminem':TP_LABEL.review;
  return own(TP_LABEL,r.kind)?TP_LABEL[r.kind]:''; // nigdy surowy r.kind z zapisu
}
function tpSub(r,t){
  if(r.kind==='learn')return `${r.minutes} min · nowe pojęcia`;
  if(r.kind==='review'){if(!r.short)return `${r.minutes} min`;const s=t&&testSubject(t);const n=s?cramBlocks(s).length:4;return `${n*5} min · ${n} ${pl(n,'blok','bloki','bloków')}, bez nowych rzeczy, potem spać`;}
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
    openSubject(s.id,'path');if(lv){if(levelUnlocked(s,s.levels.indexOf(lv)))startLesson(lv);
      else{const cur=s.levels.find((l,i)=>levelUnlocked(s,i)&&!(st.levels[l.id]||{}).done);toast(cur?'Najpierw: '+txt(noEmoji(cur.title)):'Najpierw zalicz poprzedni poziom','lock');if(cur)startLesson(cur);}}return;}
  if(r.kind==='review'&&r.short){openCram(s.id);return;} // krok 9: ostatni dzień planu = Cram
  if(r.kind==='review'){const items=reviewItemsFor(s,t.levels);if(!items.length){toast('Brak fiszek w tym zakresie','alert');return;}current=null;applyTheme(null);startReview(items);return;}
  if(r.kind==='weak'&&hasDeck(s.id)){startExamDeck(s.id);return;}
  openSubject(s.id,'egzamin',()=>examConfig(s,{levels:t.levels,n:r.n||20})); // mock (i weak bez talii = próbny)
}
/* wiersz planu na Dziś: „Do sprawdzianu: …” (dzień sprawdzianu = powodzenia) */
function testTodayItem(t){
  const s=testSubject(t);if(!s)return null;const today=todayStr();const N=dayDiff(today,t.date);if(N<0)return null;
  const short=sshort(s);
  if(N===0)return {t:{id:'test:'+t.id,done:false},s,kind:'test',info:true,reward:0,icon:'calendar',title:'Sprawdzian dziś — powodzenia',sub:short+' · plan zrobiony, teraz spokojnie',go:()=>openTestPlan(t.id)};
  const r=(t.plan||[]).find(x=>x.date===today);if(!r)return null;
  return {t:{id:'test:'+t.id,done:!!r.done},s,kind:'test',reward:0,icon:TP_ICON[r.kind],title:'Do sprawdzianu — '+tpTitle(t,r),sub:`${short} · ${inDays(N)} · ${tpSub(r,t)}`,go:()=>r.done?openTestPlan(t.id):testAction(t,r)};
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
  sheetBack();document.getElementById('sheetback').onclick=closeSheet;
  const subBox=s.querySelector('#tpsub'),lvBox=s.querySelector('#tplv'),sum=s.querySelector('#tpsum'),inp=s.querySelector('#tpdate'),inEl=s.querySelector('#tpin');
  const draw=()=>{
    const subj=SUBJECTS.find(x=>x.id===sel);const all=subj.levels.map(l=>l.id);const lv=levels||all;
    subBox.innerHTML='';SUBJECTS.forEach(x=>{const c=el('button','tpchip themed'+(x.id===sel?' on':''),mono(initials(x),'solid')+sshort(x));c.style.setProperty('--accent',x.accent);if(x.onAccent)c.style.setProperty('--on-accent',x.onAccent);c.onclick=()=>{sel=x.id;levels=null;draw();};subBox.appendChild(c);});
    lvBox.innerHTML='';
    const allC=el('button','tpchip'+(lv.length===all.length?' on':''),'wszystkie');allC.onclick=()=>{levels=null;draw();};lvBox.appendChild(allC);
    subj.levels.forEach(l=>{const on=lv.indexOf(l.id)>=0;const c=el('button','tpchip'+(on?' on':''),noEmoji(l.title));c.setAttribute('aria-pressed',String(on));
      c.onclick=()=>{const next=on?lv.filter(x=>x!==l.id):all.filter(x=>x===l.id||lv.indexOf(x)>=0);levels=next.length?next:[l.id];if(levels.length===all.length)levels=null;draw();};lvBox.appendChild(c);});
    const N=dayDiff(todayStr(),date);const left=unfinishedLevels(subj,lv).length;const nq=exQuizFor(subj,lv).length;const ex=testFor(sel);
    inEl.textContent=inDays(N);
    sum.innerHTML=icon('bulb',{size:16})+`<span>${N} ${pl(N,'dzień','dni','dni')} · ${N<2?'tylko krótka powtórka przed sprawdzianem':`${left?`${left} ${pl(left,'poziom','poziomy','poziomów')} do nauki`:'wszystko zaliczone, zostają powtórki'} · ${nq} ${pl(nq,'pytanie','pytania','pytań')} na próbny`}${ex?' · zastąpi obecny plan':''}</span>`;
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
    <div class="grow"><div class="s">${noEmoji(s.name)} · ${scope}</div><div class="d">${DAYS[d.getDay()].toLowerCase()}, ${d.getDate()} ${MONTHS_S[d.getMonth()]}</div><div class="in a-blink">${inDays(N)}</div></div>`));
  const rows=el('div','tprows');
  const todayRow=(t.plan||[]).find(r=>r.date===today);
  (t.plan||[]).forEach((r,i)=>{
    const dd=dateOf(r.date);let state=r.date<today?(r.done?'tp-done':'tp-missed'):r.date===today?(r.done?'tp-now tp-done':'tp-now'):'tp-future';if(r.kind==='rest')state+=' tp-rest';
    const row=el('button','tprow '+state+(r.date===today?' a-pop':' a-up d'+Math.min(6,i+1)));
    row.innerHTML=`<div class="dy"><small>${DAYS_S[dd.getDay()]}</small><b>${dd.getDate()}</b></div><div class="ico">${icon(r.done?'check':TP_ICON[r.kind],{size:18,stroke:r.done?3.4:2.4})}</div>
      <div class="grow"><div class="t">${tpTitle(t,r)}</div><div class="s">${r.date<today&&!r.done?'pominięte — plan przeliczony':tpSub(r,t)}</div></div>${r.date===today?'<span class="badge2'+(r.done?'':' a-blink')+'">'+(r.done?'zrobione':'dziś')+'</span>':''}`;
    row.setAttribute('aria-label',`${fmtDate(r.date)}: ${txt(tpTitle(t,r))}`);
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
  const del=el('button','pill text','Usuń plan');del.id='tpdel';del.onclick=async()=>{if(!await ask({title:'Usunąć plan do sprawdzianu?',text:'Wyniki i zaliczone poziomy zostają.',ok:'Usuń',danger:true}))return;removeTest(t.id);toast('Plan usunięty','close');go('today');};
  foot.appendChild(del);scroll.appendChild(foot);
}

/* ---------- INFO (SubjectInfo.html, krok 9) ----------
   Bloki .zbox z pola info → kafle z ikoną dobraną po nagłówku (tabela .gradetbl z danych jest pomijana — zastępuje ją siatka z grading.scale
   z podświetlonym wierszem ostatniego wyniku egzaminu); do tego podsumowanie egzaminu i „Mam sprawdzian”. Info bez .zbox = surowy HTML jak dotąd. */
const INFO_ICON=[[/cheat|najwa|priorytet|klucz|motyw/i,'bolt','hot'],[/ocen|zalicz|punkt/i,'target','pink'],[/zakres|unit|materia/i,'book','cyan'],[/egzamin|test|kolokw|termin|deadline|homework|zadanie/i,'calendar','gold'],[/regulac|prawo|kontekst/i,'file','violet'],[/powt/i,'refresh','cyan'],[/gramat|słow|slow/i,'edit','gold']];
function infoBlocks(s){
  const tmp=el('div','',s.info||'');const boxes=[...tmp.querySelectorAll('.zbox')];if(!boxes.length)return null;
  return boxes.map(b=>{const h=b.querySelector('h3');const raw=h?noEmoji(h.textContent):'';if(h)h.remove();const grade=!!b.querySelector('.gradetbl'); // raw = zdekodowany tekst: tylko do dopasowania ikony
    const m=INFO_ICON.find(([re])=>re.test(raw))||[null,'info',''];return {title:esc(raw),html:b.innerHTML.trim(),grade,icon:m[1],tone:m[2]};}).filter(x=>!x.grade&&(x.title||x.html));
}
function scaleRows(s){const sc=exScale(s).slice().sort((a,b)=>b[0]-a[0]);const rows=[];for(let i=sc.length-1;i>=0;i--){const min=sc[i][0],max=i>0?sc[i-1][0]-1:100;rows.push({min,max,lab:gradeParts(sc[i][1])[0]});}return rows;}
function renderInfo(sc){
  const s=current;const wrap=el('div','scroll info');
  const rec=examRec(s.id);const last=rec.last;const t=testFor(s.id);
  wrap.appendChild(el('div','infhead a-up',`<div class="eyebrow">Zasady zaliczenia</div><h2>${noEmoji(s.name)}</h2>${s.tagline?`<p>${s.tagline}</p>`:''}`));
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
  const foot=el('div','inffoot');const b=el('button','pill a-glow','WRÓĆ DO NAUKI');b.id='inf-back';b.onclick=()=>{curTab='path';renderSubject();};foot.appendChild(b);wrap.appendChild(foot);
  sc.innerHTML='';sc.appendChild(wrap);
}

/* ================= ĆWICZENIA (wpisywanie, klocki, pary, speed) ================= */
let cw=null, cwInt=null;
function exNorm(str){return String(str||'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/(^|\s)(the|a|an|to|el|la|los|las|un|una|unos|unas)(?=\s|$)/g,' ').replace(/\s+/g,' ').trim();} // \p{L}: cyrylica, greka itd. nie znikają (inaczej każda odpowiedź byłaby „dobra”)
function exClean(str){return (str||'').replace(/\([^)]*\)/g,'').replace(/…|\.\.\./g,'').replace(/\s+/g,' ').trim();}
function exPrompt(str,ans){const aw=exNorm(ans).split(' ').filter(w=>w.length>=4);return (str||'').replace(/\([^)]*\)/g,m=>aw.some(w=>exNorm(txt(m)).split(' ').includes(w))?'':m).replace(/…|\.\.\./g,'').replace(/\s+/g,' ').trim();} // podpowiedź: nawiasy zostają, bo często odróżniają karty („dzień dobry (rano)”), chyba że zdradzają odpowiedź
// ans = surowy tekst hasła (fiszka t jest escapowana): porównanie z wpisanym tekstem; do HTML wraca przez esc(). prompt = HTML definicji (d po clean())
function typePool(s){return allCards(s).map(c=>{const t=txt(c.t);return {prompt:exPrompt(c.d,t),ans:exClean(t),lvl:c.lvl};}).filter(c=>c.prompt&&c.ans&&c.ans.length<=30&&!/\//.test(c.ans));}
function tilePool(s){return typePool(s).filter(c=>c.ans.replace(/\s/g,'').length<=18);}
function matchPool(s){return allCards(s).map(c=>{const t=txt(c.t);return {a:exClean(t),b:txt(exPrompt(c.d,t)).replace(/\s+/g,' ').trim()};}).filter(c=>c.a&&c.b);} // oba surowe — do HTML przez esc()

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
    if(!wrap.isConnected||!cw||cw.list[cw.idx]!==it)return; // zadanie już opuszczone (zakładka / wstecz)
    const next=()=>{cw.idx++;cwRenderTasks(sc);};
    if(ok){cw.score++;if(it.type==='tf'&&it.seconds)missionEvent('tftime',1);addXP(current.id,4);wrap.appendChild(confetti(4));sheetOk(fb,{xp:4,mult:1,combo:0,onNext:next});}
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
function exSubj(s){return {...s,levels:(s.levels||[]).map(l=>({...l,flashcards:(l.flashcards||[]).filter(c=>!c.noEx)}))};} // Wpisywanie/Klocki bez fiszek-notatek (noEx:true = reguła, nie słówko do wpisania)
function cwStartTyping(sc){const pool=shuffle(typePool(exSubj(current))).slice(0,12);
  if(!pool.length){toast('Brak danych do wpisywania');return renderCwicz(sc);}
  cw={type:'typing',list:pool,idx:0,score:0};cwRenderTyping(sc);}
function cwRenderTyping(sc){
  const it=cw.list[cw.idx];
  if(!it)return cwResult(sc,(cw.score/cw.list.length>=0.8)?'gold':'ok',cw.score,cw.list.length,()=>cwStartTyping(sc));
  const wrap=el('div','scroll');
  wrap.appendChild(el('div','progressrow',`<div class="bar"><i style="width:${cw.idx/cw.list.length*100}%"></i></div><div class="counter">${cw.idx+1}/${cw.list.length}</div>`));
  const card=el('div','qcard');
  card.innerHTML=`<span class="tag">${it.lvl||''}</span><div class="exprompt">${current&&current.lang?'Przetłumacz albo wpisz':'Wpisz pojęcie'}</div><div class="exq">${it.prompt}</div>
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
    const want=exNorm(it.ans);const ok=inp.value.trim()!==''&&!!want&&exNorm(inp.value)===want;
    inp.classList.add(ok?'ok':'bad');inp.disabled=true;
    if(ok){cw.score++;addXP(current.id,4);toast('Dobrze: +4 XP','check');fb.className='exfb ok show';fb.innerHTML=icon('check',{size:16,stroke:3.4,cls:'ic-acid'})+' Dobrze: <b>'+esc(it.ans)+'</b>';}
    else{toast('Nie tym razem','close');fb.className='exfb bad show';fb.innerHTML='Poprawnie: <b>'+esc(it.ans)+'</b>';}
    btn.innerHTML=(cw.idx+1>=cw.list.length)?LBL.result:LBL.next;
  };
  btn.onclick=check;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')check();});
}
/* --- TILES --- */
function cwStartTiles(sc){const pool=shuffle(tilePool(exSubj(current))).slice(0,10);
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
  cw.build.forEach((ti,pos)=>{const b=el('button','tile',esc(cw.tiles[ti].ch));b.onclick=()=>{if(cw.checked)return;cw.tiles[ti].used=false;cw.build.splice(pos,1);cwRenderTiles(sc);};buildEl.appendChild(b);});
  cw.tiles.forEach((tl,ti)=>{const b=el('button','tile'+(tl.used?' used':''),esc(tl.ch));b.onclick=()=>{if(cw.checked||tl.used)return;tl.used=true;cw.build.push(ti);cwRenderTiles(sc);};bankEl.appendChild(b);});
  btn.onclick=()=>{
    if(cw.checked){cw.idx++;cwRenderTiles(sc);return;}
    const got=cw.build.map(i=>cw.tiles[i].ch).join(sep);
    const want=exNorm(it.ans);const ok=!!want&&exNorm(got)===want;cw.checked=true;
    if(ok){cw.score++;addXP(current.id,4);toast('Dobrze: +4 XP','check');fb.className='exfb ok show';fb.innerHTML=icon('check',{size:16,stroke:3.4,cls:'ic-acid'})+' <b>'+esc(it.ans)+'</b>';}
    else{toast('Nie tak','close');fb.className='exfb bad show';fb.innerHTML='Poprawnie: <b>'+esc(it.ans)+'</b>';}
    btn.innerHTML=(cw.idx+1>=cw.list.length)?LBL.result:LBL.next;
  };
}
/* --- MATCH --- */
function cwStartMatch(sc){const pool=shuffle(matchPool(current)).slice(0,5);
  if(pool.length<2){toast('Za mało danych');return renderCwicz(sc);}
  cw={type:'match',pairs:pool,left:shuffle(pool.map((p,i)=>({i,t:p.a}))),right:shuffle(pool.map((p,i)=>({i,t:p.b}))),selL:null,selR:null,done:0,matched:new Set(),missed:new Set()};
  cwRenderMatch(sc);}
function cwRenderMatch(sc){
  if(cw.done>=cw.pairs.length){const ok=cw.pairs.length-cw.missed.size;return cwResult(sc,ok===cw.pairs.length?'gold':'ok',ok,cw.pairs.length,()=>cwStartMatch(sc));} // wynik = pary trafione za pierwszym razem
  const wrap=el('div','scroll');
  wrap.appendChild(el('div','exprompt','Połącz w pary (wybierz z lewej, potem z prawej)'));
  const mw=el('div','matchwrap');const lc=el('div','mcol'),rc=el('div','mcol');
  const trunc=t=>t.length>64?t.slice(0,62)+'…':t;
  cw.left.forEach(o=>{const it=el('div','mitem'+(cw.matched.has('L'+o.i)?' done':'')+(cw.selL===o.i?' sel':''),esc(o.t));it.onclick=()=>{if(cw.matched.has('L'+o.i))return;cw.selL=o.i;tryMatch(sc);};lc.appendChild(it);});
  cw.right.forEach(o=>{const it=el('div','mitem'+(cw.matched.has('R'+o.i)?' done':'')+(cw.selR===o.i?' sel':''),esc(trunc(o.t)));it.onclick=()=>{if(cw.matched.has('R'+o.i))return;cw.selR=o.i;tryMatch(sc);};rc.appendChild(it);});
  mw.appendChild(lc);mw.appendChild(rc);wrap.appendChild(mw);
  const f=el('div');f.style.cssText='margin-top:14px';f.appendChild(cwBackBtn(sc));wrap.appendChild(f);
  sc.innerHTML='';sc.appendChild(wrap);
}
function tryMatch(sc){
  if(cw.selL==null||cw.selR==null){cwRenderMatch(sc);return;}
  const P=cw.pairs;if(cw.selL===cw.selR||P[cw.selL].a===P[cw.selR].a||P[cw.selL].b===P[cw.selR].b){cw.matched.add('L'+cw.selL);cw.matched.add('R'+cw.selR);cw.done++;cw.selL=null;cw.selR=null;addXP(current.id,3);toast('Para: +3 XP','check');cwRenderMatch(sc);} // ten sam napis po obu stronach nie do odróżnienia → też para
  else{cw.missed.add(cw.selL);toast('To nie ta para','close');cw.selL=null;cw.selR=null;cwRenderMatch(sc);}
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
    const run=cw;run.idx++;setTimeout(()=>{if(cw!==run||run.left<=0||!sc.isConnected)return;cwRenderSpeed(sc);},450); // koniec czasu / nowa runda / inna zakładka → nie rysuj
  });
}

/* ============================================================ KROK 8: GAMIFIKACJA (DESIGN.md §4.5, §6 pkt 8) — wszystko offline, ten sam klucz nauka_progress_v1
   PROGRESS.gems (int) · PROGRESS.missions={date, run, daily:[{id,progress,target,reward,done}], weekly:{week,id,progress,target,reward,done}}
   PROGRESS.album={"<sid>:<lid>:<idx>":{rarity:"common"|"rare"|"epic", at}} · PROGRESS.ghost={"<sid>:<lid>":[{t,correct}]} (najlepszy przebieg poziomu)
   PROGRESS.boost={until} · PROGRESS.themes=[id…], PROGRESS.theme · PROGRESS.badges={id:date} · PROGRESS.stats={missions,maxCombo,planDays,bosses}
   PROGRESS[sid].chests={"<after>":true} · PROGRESS[sid].boss={done,n,at} · META.freezes (0–2), META.frozenDays, META.comebackShown (seria zostaje w nauka_meta_v1).
   Gemy: poziom +10 (+5 za 3 gwiazdki), skrzynia +10, misja +20…30 / tygodniowa +100, plan dnia +5, boss +25. addXP = jedyny lejek XP (podwaja przy boostcie). */
const GEM={level:10,stars3:5,chest:10,plan:5,boss:25};
function gems(){if(typeof PROGRESS.gems!=='number'||!isFinite(PROGRESS.gems))PROGRESS.gems=0;return PROGRESS.gems;}
function addGems(n,why){gems();PROGRESS.gems=Math.max(0,PROGRESS.gems+n);saveProgress();updateGems();
  if(why)notify((n>0?'+':'')+n+' '+pl(Math.abs(n),'gem','gemy','gemów')+(why===true?'':' · '+why),'gem','a-pop');}
function updateGems(){document.querySelectorAll('[id="gemNum"]').forEach(e=>{e.textContent=fmtNum(gems());e.classList.remove('a-pop');void e.offsetWidth;e.classList.add('a-pop');});}
function gemPill(o){o=o||{};const b=el('button','streak gems'+(o.cls?' '+o.cls:''),icon('gem',{size:16,cls:'ic-cyan'})+`<span id="gemNum">${fmtNum(gems())}</span>`);b.setAttribute('aria-label','Gemy: '+gems()+'. Otwórz plecak');b.onclick=()=>go('shop');return b;}
function stats(){const s=PROGRESS.stats;if(!s||typeof s!=='object')PROGRESS.stats={missions:0,maxCombo:0,planDays:0,bosses:0};return PROGRESS.stats;}
/* podwójne XP: znacznik czasu w PROGRESS.boost.until */
function boostActive(){const b=PROGRESS.boost;return !!(b&&b.until&&b.until>Date.now());}
function boostLeft(){return boostActive()?PROGRESS.boost.until-Date.now():0;}
/* plan dnia zrobiony w całości: +5 gemów, misja „plan”, licznik do odznaki (raz dziennie) */
function planCheck(d){
  d=d||daily();const ts=d.tasks.filter(t=>taskInfo(t)); // tylko widoczne: bez zadań przedmiotów z innego pliku i pustej talii błędów
  if(d.planDone||!ts.length||!ts.every(t=>t.done))return false;
  d.planDone=true;stats().planDays++;saveProgress();addGems(GEM.plan);missionEvent('plan',1);
  notify('Plan dnia zrobiony: +'+GEM.plan+' gemów','gem');checkBadges();return true;
}

/* ---------- PLECAK (Shop.html): zamrożenie serii, uzupełnienie serc, podwójne XP, motyw ---------- */
// motyw = kolor okularów lisa (tło bez kół); limonka za darmo, reszta z plecaka. Stare zapisy z ['violet'] dostają limonkę w gratisie
const THEMES=[['acid','Limonka'],['violet','Fiolet'],['cyan','Cyjan'],['pink','Róż'],['gold','Złoto'],['amber','Bursztyn']];
const GLASSES={acid:'#B4FF3A',violet:'#A855F7',cyan:'#22D3EE',pink:'#FF2E93',gold:'#FFC043',amber:'#FFA023'};
function themes(){if(!Array.isArray(PROGRESS.themes))PROGRESS.themes=[];if(PROGRESS.themes.indexOf('acid')<0)PROGRESS.themes.unshift('acid');return PROGRESS.themes;}
function foxGlasses(){return GLASSES[PROGRESS.theme]||GLASSES.acid;}
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
  {id:'theme',name:'Okulary lisa',price:150,icon:'palette',tone:'violet',anim:'',
    sub:()=>{const o=themes();return o.length>=THEMES.length?'wszystkie kolory odblokowane':`${o.length} z ${THEMES.length} kolorów · okulary lisa`;},
    can:()=>themes().length<THEMES.length,buy:()=>{const o=themes();const nx=THEMES.find(t=>o.indexOf(t[0])<0);if(!nx)return 'Masz już wszystkie kolory';o.push(nx[0]);PROGRESS.theme=nx[0];saveProgress();return 'Nowe okulary: '+nx[1];}}
];
function renderShop(){
  const scroll=shell(null,{cls:'shop',title:'Plecak',pills:false,back:()=>goBack('today'),right:gemPill({cls:'a-pop'})});
  const g=gems();
  SHOP.forEach((it,i)=>{
    const can=it.can(),afford=g>=it.price;
    const row=el('div',`shoprow ${it.tone} a-up d${i+1}`);row.id='shop-'+it.id;
    row.innerHTML=`<div class="ico ${it.anim}">${icon(it.icon,{size:28,stroke:2.6})}</div><div class="grow"><div class="t">${it.name}</div><div class="s">${it.sub()}</div></div>`;
    const b=el('button','buy'+(can?(afford?'':' short'):' owned'),can?icon('gem',{size:14})+`<span>${it.price}</span>`:icon('check',{size:16,stroke:3.4}));
    b.setAttribute('aria-label',can?`Wymień ${it.price} gemów na: ${it.name}`:it.name+': masz komplet');
    b.onclick=()=>{ // stan z chwili tapu, nie z renderu (ekran przerysowuje się dopiero po 700 ms)
      if(!it.can())return toast('Masz już komplet','check');
      const g=gems();if(g<it.price){const br=it.price-g;return toast(`Brakuje ${br} ${pl(br,'gema','gemów','gemów')}`,'gem');}
      const msg=it.buy();addGems(-it.price);row.classList.remove('a-up');row.classList.add('a-pop');toast(msg,it.icon==='heart'?'heart':it.icon,'a-pop');checkBadges();setTimeout(()=>{if(view==='shop'&&!current)renderShop();},700);};
    row.appendChild(b);scroll.appendChild(row);
    if(it.id==='theme'&&themes().length>1){ // posiadane zestawy: tap = aktywuj
      const chips=el('div','themechips a-up d5');const cur=PROGRESS.theme||'acid';
      THEMES.filter(t=>themes().indexOf(t[0])>=0).forEach(([id,name])=>{const c=el('button','themechip'+(id===cur?' on':''),`<i></i>${name}`);c.style.setProperty('--sw','var(--'+id+')');c.setAttribute('aria-pressed',String(id===cur));
        c.onclick=()=>{PROGRESS.theme=id;saveProgress();toast('Okulary: '+name,'palette');renderShop();};chips.appendChild(c);});
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
    const hasTF=SUBJECTS.some(s=>s.levels.some(l=>(l.tasks||[]).some(k=>k&&k.type==='tf'&&k.seconds))); // tftime tylko, gdy jest jakieś prawda/fałsz na czas
    const ids=Object.keys(MISSION_POOL).filter(id=>id!=='tftime'||hasTF).map(id=>[hashStr(t+':'+id),id]).sort((a,b)=>a[0]-b[0]).slice(0,3);
    m.daily=ids.map(([h,id])=>{const P=MISSION_POOL[id];const target=id==='xp'?Math.max(10,Math.round(goalXP()*[0.6,1,1.5][h%3]/10)*10):P.targets[h%P.targets.length];return {id,progress:0,target,reward:P.reward,done:false};}); // krok 9: misja XP liczona z celu dziennego
    m.date=t;m.run=0;ch=true;
  }
  const wk=weekKey();
  if(!m.weekly||m.weekly.week!==wk||!WEEKLY_POOL[m.weekly.id]){const ids=Object.keys(WEEKLY_POOL);const id=ids[hashStr('w'+wk)%ids.length];const P=WEEKLY_POOL[id];m.weekly={week:wk,id,progress:0,target:P.target,reward:P.reward,done:false};ch=true;}
  if(ch)saveProgress();
  return m;
}
/* zdarzenie postępu: xp (n), streakok (licznik z okRun, max), review (1), level (1), tftime (1), plan (1), day (1 — z touchStreak) */
function missionEvent(kind,n){
  const m=missions();let ch=false;const ready=[];
  const bump=(x,P)=>{if(x.done||x.progress>=x.target)return;x.progress=P.max?Math.max(x.progress,n):Math.min(x.target,x.progress+n);ch=true;if(x.progress>=x.target)ready.push(x);};
  m.daily.forEach(x=>{if(x.id===kind&&MISSION_POOL[x.id])bump(x,MISSION_POOL[x.id]);});
  const W=WEEKLY_POOL[m.weekly.id];if(W&&W.ev===kind)bump(m.weekly,W);
  if(ch)saveProgress();
  if(ready.length)notify('Misja gotowa — odbierz nagrodę','star','a-pop',{go:()=>go('missions')});
  const tile=document.getElementById('missionTile');if(tile)tile.textContent=missionLabel();
}
/* „N poprawnych bez pomyłki”: dzienny licznik z rzędu w PROGRESS.missions.run, przechodzi między lekcjami; błąd zeruje */
function okRun(ok){const m=missions();m.run=ok?(m.run|0)+1:0;saveProgress();if(ok)missionEvent('streakok',m.run);}
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
  const scroll=shell(null,{cls:'missions',title:'Misje',pills:false,back:()=>goBack('today'),right:gemPill()}); // wstecz tam, skąd przyszedł (np. z toastu „Misja gotowa”)
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
  notify(missed===1?'Zamrożenie uratowało serię':`Zamrożenia uratowały serię (${missed})`,'snow','a-pop');
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
  if(!META.lastDay)return go('today'); // bez daty (np. uszkodzony stan z synchronizacji) nie ma czego pokazać
  META.comebackShown=todayStr();saveMeta();
  app.innerHTML='';const sc=el('div','screen active');
  const scroll=el('div','scroll comeback');
  const d=dayDiff(META.lastDay,todayStr());const old=META.streak|0;
  const due=srsDue();const bySub=SUBJECTS.map(s=>({s,n:due.filter(x=>x.s.id===s.id).length})).filter(x=>x.n).sort((a,b)=>b.n-a.n).slice(0,3);
  const first=daily().tasks.map(taskInfo).filter(Boolean).find(x=>!x.t.done);
  scroll.innerHTML=`<div class="cbfox">${fox('sleep',140)}</div>
    <div class="cbtxt a-up d1"><h1>Nie było cię ${d} ${pl(d,'dzień','dni','dni')}</h1><p>Bez dramatu — wracamy od małego kroku. Pięć minut dziś znaczy więcej niż godzina kiedyś.</p></div>`;
  if(old>0)scroll.appendChild(el('div','cbstreak a-up d2',icon('flame',{size:42})+`<div class="grow"><div class="t">Seria zaczyna się od nowa</div><div class="nums"><span class="old">${old}</span>${icon('chevron-right',{size:16,stroke:2.8})}<span class="new a-pop d3">0</span></div></div>`));
  const box=el('div','cbdue a-up d3');
  if(bySub.length){const max=bySub[0].n;box.innerHTML=`<div class="hd"><span class="eyebrow sec">Czeka na powtórkę</span><b>${due.length} ${pl(due.length,'pojęcie','pojęcia','pojęć')}</b></div>`+bySub.map((x,i)=>`<div class="row r${i+1}"><span class="lb">${sshort(x.s)}</span><div class="bar"><i class="a-grow d${i+2}" style="width:${Math.round(x.n/max*100)}%"></i></div><span class="n">${x.n}</span></div>`).join('');}
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
  const r=srsResolve(k);notify('Do albumu: '+(r?txt(r.c.t):'nowe pojęcie'),'cards','a-pop',{go:()=>go('album')});
  checkBadges();
}
function albumCount(sid){const A=album();let n=0,m=0;SUBJECTS.forEach(s=>{if(sid&&s.id!==sid)return;const cards=allCards(s);m+=cards.length;cards.forEach(c=>{if(A[s.id+':'+c.lid+':'+c.i])n++;});});return {n,m};}
let albumFilter='all';
function renderAlbum(){
  const scroll=shell(null,{cls:'album',title:'Album pojęć',pills:false,back:()=>goBack('profile')});
  const A=album();const tot=albumCount();const t=todayStr();
  if(albumFilter!=='all'&&!SUBJECTS.some(s=>s.id===albumFilter))albumFilter='all';
  scroll.appendChild(el('div','albhead a-up',`<div class="sechdr msh"><span class="eyebrow">${tot.n} z ${tot.m} zebrane</span><span class="albpct">${tot.m?Math.round(tot.n/tot.m*100):0}%</span></div><div class="bar"><i class="a-grow" style="width:${tot.m?tot.n/tot.m*100:0}%"></i></div>`));
  const chips=el('div','albchips a-up d1');
  const mk=(id,name,s)=>{const c=el('button','albchip'+(albumFilter===id?' on':'')+(s?' themed':''),name);if(s){c.style.setProperty('--accent',s.accent);if(s.onAccent)c.style.setProperty('--on-accent',s.onAccent);}c.setAttribute('aria-pressed',String(albumFilter===id));c.onclick=()=>{albumFilter=id;renderAlbum();};return c;};
  chips.appendChild(mk('all','Wszystkie'));
  SUBJECTS.forEach(s=>{const c=albumCount(s.id);chips.appendChild(mk(s.id,sshort(s)+(c.n?' · '+c.n:''),s));});
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
    tile.setAttribute('aria-label',txt(x.c.t)+' — '+(x.e.rarity==='epic'?'mistrzowska':x.e.rarity==='rare'?'trudna':'zwykła')+', dotknij, żeby zobaczyć definicję');
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
function bossName(s){return s.boss||'Szop Zapominalski';}
/* potwór jako inline SVG w kolorze przedmiotu (klasy b1…b6 → tokeny w styles.css) */
function bossSvg(size,cls){return raccoon(cls&&RC_EYES[cls]?cls:'idle',size);} // szop zamiast sześciokąta
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
  hero.innerHTML=`<div class="bossav" id="bossav">${raccoon(bs.hp<=Math.ceil(bs.max*.3)?'angry':'idle',124)}</div><div class="bossname">${bossName(s)}</div>
    <div class="bosshp"><div class="bar"><i id="bosshp" style="width:${bs.hp/bs.max*100}%"></i></div><span id="bosshpn">${bs.hp} / ${bs.max}</span></div>`;
  L.appendChild(hero);
  const body=el('div','lessonbody');L.appendChild(body);
  const timed=it.kind==='quiz';
  const qrow=el('div','bossq',`<span class="eyebrow">Cios ${bs.n}</span>${timed?`<span class="bosstime" id="bosstime">${icon('clock',{size:14,stroke:2.8})}<b>${fmt(BOSS_SEC)}</b></span>`:''}`);
  let answered=false;
  const onAnswer=(ok,fb)=>{
    if(answered||!bossState)return;answered=true;clearInterval(bossInt);taskCleanup();keyFn=null;
    if(ok){bs.hp--;bs.hits++;const av=L.querySelector('#bossav');if(av){av.innerHTML=raccoon('hit',124);av.appendChild(el('span','bosshit a-pop','−1'));}
      const bar=L.querySelector('#bosshp'),n=L.querySelector('#bosshpn');if(bar)bar.style.width=(bs.hp/bs.max*100)+'%';if(n)n.textContent=bs.hp+' / '+bs.max;
      addXP(s.id,QUIZ_XP);body.appendChild(confetti(3));}
    else{bs.miss++;loseHeart();const av=L.querySelector('#bossav');if(av)av.innerHTML=raccoon('laugh',124);const hp=L.querySelector('.hearts');if(hp){hp.classList.add('a-beat');hp.appendChild(el('span','minus a-blink','−1'));}
      if(fb&&(fb.e||fb.sub))body.appendChild(el('div','bossexp a-up',`<b>Zapamiętaj:</b> ${fb.sub?fb.sub+(fb.e?'. ':''):''}${fb.e||''}`));}
    setTimeout(()=>{if(!bossState)return;bs.idx++;renderBoss();},ok?900:(fb&&(fb.e||fb.sub)?2300:1100));
  };
  const o={n:bs.n,total:bs.max,combo:0,broken:false,tag:it.kind==='quiz'?(it.q.lvl||''):(it.task.lvl||'')};
  const blk=it.kind==='task'?taskBlock(it.task,{...o,onAnswer}):quizBlock(it.q,{...o,onAnswer:(i,ok)=>onAnswer(ok,it.q)});
  blk.body.insertBefore(qrow,blk.body.firstChild);
  body.appendChild(blk.body);
  const foot=el('div','lessonfoot');foot.appendChild(blk.foot);foot.appendChild(el('div','bossnote',`Dobra odpowiedź = cios. Zła = tracisz serce. Boss ma ${bs.max} ${pl(bs.max,'życie','życia','żyć')}.`));L.appendChild(foot);
  if(timed){let left=BOSS_SEC;bossInt=setInterval(()=>{if(!bossState||answered)return clearInterval(bossInt);left--;const t=L.querySelector('#bosstime');if(t){t.querySelector('b').textContent=fmt(Math.max(0,left));t.classList.toggle('warn',left<=5);t.classList.toggle('a-blink',left<=5);}
    // P2-12: treść dobrej odpowiedzi zamiast litery (litery na ekranie są przetasowane; w trybie prawda/fałsz nie ma kafla z tą odpowiedzią)
    if(left<=0){clearInterval(bossInt);blk.body.querySelectorAll('.qopt').forEach(b=>{b.disabled=true;if(b.dataset.i!=null&&+b.dataset.i===it.q.c)b.classList.add('correct','a-glow');else b.classList.add('dim');});blk.foot.classList.add('hide');keyFn=null;onAnswer(false,{e:it.q.e,sub:'Czas minął. Dobra odpowiedź: '+it.q.a[it.q.c]});}},1000);}
}
function finishBoss(win){
  clearInterval(bossInt);closeSheet();keyFn=null;taskCleanup();
  const s=current;const bs=bossState;if(!s||!bs)return;bs.done=true;bossState=null;
  const rec=bossRec(s.id);const first=win&&!rec.done;const used=Math.round((Date.now()-bs.t0)/1000);
  let xp=0;
  if(win){rec.done=true;rec.n=(rec.n|0)+1;rec.at=todayStr();if(first){stats().bosses++;xp=addXP(s.id,50);addGems(GEM.boss);}else{xp=addXP(s.id,15);}if(!rec.best||used<rec.best)rec.best=used;saveProgress();checkBadges();}
  const L=document.getElementById('lesson');L.className='lesson open bossres';L.innerHTML='';
  const body=el('div','lessonbody done');if(win)body.appendChild(confetti(20));
  const lc=el('div','lc');
  lc.innerHTML=`<div class="lcfox">${raccoon(win?'dizzy':'win',150)}</div>
    <div class="lctxt"><div class="lct a-up d2">${win?'Boss pokonany':'Boss wygrał tym razem'}</div><div class="lcs">${bossName(s)} · ${noEmoji(s.name)}</div></div>
    <div class="lcstats"><div class="lcstat a-up d3"><div class="k">Ciosy</div><div class="v acid">${bs.hits}</div></div><div class="lcstat a-up d4"><div class="k">Pudła</div><div class="v ${bs.miss?'pink':'acid'}">${bs.miss}</div></div><div class="lcstat a-up d5"><div class="k">Czas</div><div class="v gold">${fmt(used)}</div></div></div>
    ${win?`<div class="lcrewards a-up d5">${xp?`<span class="lcreward gold">${icon('bolt',{size:15})}+${xp} XP</span>`:''}${first?`<span class="lcreward cyan">${icon('gem',{size:15})}+${GEM.boss} gemów</span><span class="lcreward violet">${icon('boss',{size:16})}odznaka</span>`:'<span class="lcreward">powtórka walki · bez gemów</span>'}</div>`
        :`<p class="lcp">${hearts().n<=0?'Skończyły się życia. Odzyskaj je (powtórka fiszek albo plecak) i spróbuj ponownie.':'Bossowi '+pl(bs.hp,'zostało','zostały','zostało')+' '+bs.hp+' '+pl(bs.hp,'życie','życia','żyć')+'. Przejrzyj fiszki z tego przedmiotu i wróć.'}</p>`}`;
  body.appendChild(lc);L.appendChild(body);
  const foot=el('div','lessonfoot col');
  const main=el('button','pill a-glow',win?'WRACAM NA ŚCIEŻKĘ':'SPRÓBUJ PONOWNIE');main.id='bossmain';
  main.onclick=win?closeLesson:()=>{if(hearts().n<=0)showNoHearts({inLesson:false});else startBoss();};
  const alt=el('button','pill text',win?'JESZCZE RAZ':'WRÓĆ NA ŚCIEŻKĘ');alt.id='bossalt';alt.onclick=win?startBoss:closeLesson;
  foot.appendChild(main);foot.appendChild(alt);L.appendChild(foot);
  keyFn=e=>{if(e.key==='Enter')main.click();};
  if(win)notify(first?'Boss pokonany: +'+GEM.boss+' gemów':'Boss pokonany ponownie','boss','a-pop');
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
  let msg,lead=you>gi;
  if(you>gi){const dt=ls.ghost[you-1]&&ls.run[you-1]?Math.round((ls.ghost[you-1].t-ls.run[you-1].t)/100)/10:0;msg=`Prowadzisz${dt>0?' o '+String(dt).replace('.',',')+' s':''}${ls.ghost[you]&&!ls.ghost[you].correct?' — duch pomylił się tu na pytaniu '+(you+1)+'.':'.'}`;}
  else if(you<gi){const gt=ls.ghost[you]?ls.ghost[you].t:0;msg=`Duch prowadzi — odpowiedział na to pytanie w ${fmt(Math.round(gt/1000))}.`;}
  else msg='Łeb w łeb. Odpowiedz, zanim duch ruszy dalej.';
  note.className='ghnote'+(lead?' lead':'');note.innerHTML=icon(lead?'bolt':'ghost',{size:16})+'<span>'+msg+'</span>';
}
/* wynik: zapis najlepszego przebiegu (tylko zaliczone), porównanie z duchem; +10 XP za pokonanie ducha */
function ghostFinish(ls,passed){
  const s=current;const lv=ls.lv;const run=ls.run||[];if(!run.length||!ls.items.length)return null;
  const G=ghosts();const k=ghostKey(lv);const old=G[k];
  if(!old){if(!passed)return null;G[k]={run,at:todayStr()};saveProgress();return {kind:'saved',t:'Przebieg zapisany jako duch',s:'Następnym razem ścigasz się ze sobą — z '+ls.score+' z '+ls.items.length+' w '+fmt(Math.round(runTime(run)/1000))+'.'};}
  const oldRun=Array.isArray(old)?old:old.run;
  if(ghostBetter(run,oldRun)){G[k]={run,at:todayStr()};saveProgress();const gx=addXP(s.id,10);return {kind:'win',xp:gx,t:'Pokonany duch: +'+gx+' XP',s:`${ls.score} z ${ls.items.length} w ${fmt(Math.round(runTime(run)/1000))} — poprzednio ${runScore(oldRun)} w ${fmt(Math.round(runTime(oldRun)/1000))}. Ten przebieg jest nowym duchem.`};}
  const dt=Math.round((runTime(run)-runTime(oldRun))/1000);
  return {kind:'lose',t:'Duch był lepszy tym razem',s:runScore(oldRun)>ls.score?`Duch miał ${runScore(oldRun)} z ${ls.items.length}, ty ${ls.score}.`:`Duch był szybszy o ${Math.max(1,dt)} s. Spróbuj jeszcze raz.`};
}

/* ---------- ODZNAKI (Profile.html): sprawdzane po każdym istotnym zdarzeniu, toast .a-pop przy odblokowaniu ---------- */
const BADGES=[
  {id:'first',name:'Pierwszy poziom',icon:'check',tone:'acid',test:()=>SUBJECTS.some(s=>Object.values((PROGRESS[s.id]||{}).levels||{}).some(l=>l&&l.done))},
  {id:'streak7',name:'7 dni serii',icon:'flame',tone:'amber',test:()=>Math.max(META.best|0,streakDisplay())>=7},
  {id:'streak30',name:'30 dni serii',icon:'flame',tone:'amber',test:()=>Math.max(META.best|0,streakDisplay())>=30},
  {id:'streak50',name:'50 dni serii',icon:'flame',tone:'amber',test:()=>Math.max(META.best|0,streakDisplay())>=50},
  {id:'streak100',name:'100 dni serii',icon:'star',tone:'gold',test:()=>Math.max(META.best|0,streakDisplay())>=100},
  {id:'streak365',name:'Rok z Cramfoxem',icon:'trophy',tone:'gold',test:()=>Math.max(META.best|0,streakDisplay())>=365},
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
  saveProgress();fresh.forEach(b=>notify('Odznaka: '+b.name,b.icon,'a-pop'));
  const g=document.getElementById('badgegrid');if(g)g.replaceWith(badgeGrid());
}
function badgeGrid(){
  const B=badges();const g=el('div','badgegrid a-up d3');g.id='badgegrid';
  BADGES.forEach((b,i)=>{const on=!!B[b.id];const t=el('div','badge '+(on?b.tone:'lock'),icon(on?b.icon:'lock',{size:26,stroke:2.4,fill:on&&['flame','star','bolt','boss'].indexOf(b.icon)>=0})+'<span>'+b.name+'</span>');t.setAttribute('aria-label',b.name+(on?': zdobyta '+fmtDate(B[b.id]):': zablokowana'));g.appendChild(t);});
  return g;
}

/* ============================================================ KROK 9: PIERWSZE URUCHOMIENIE (LevelPick.html → Onboarding.html)
   META.level ("liceum"|"studia"|"inne"; stare "podstawowka" = w wyborze jak "inne", apka jest 16+) i META.goal ("sprawdziany"|"matura-p"|"matura-r"|"olimpiada"|"sesja"|"wlasny") w nauka_meta_v1;
   cel dzienny w PROGRESS.goal (+ PROGRESS.daily.goal). Oba ekrany wracają z Ustawień (obFrom='settings') i z paska celu na Dziś. */
const LEVELS=[['liceum','Liceum lub technikum','klasy 1–5','book','acid'],['studia','Studia','licencjat, magisterka','cap','pink'],['inne','Coś innego','kursy, certyfikaty, nauka na własną rękę','globe','cyan']];
const GOALS=[['sprawdziany','Kartkówki i sprawdziany',['liceum','inne']],['matura-p','Matura podstawowa',['liceum']],['matura-r','Matura rozszerzona',['liceum']],['olimpiada','Olimpiada',['liceum']],['sesja','Sesja i kolokwia',['studia']],['wlasny','Własny cel',['liceum','studia','inne']]];
const GOAL_DEFAULT={podstawowka:'sprawdziany',liceum:'matura-r',studia:'sesja',inne:'wlasny'};
let obFrom='first';
function openLevelPick(from){obFrom=from||'first';go('levelpick');}
function openOnboarding(from){obFrom=from||'first';go('onboarding');}
function obShell(step,cls){
  app.innerHTML='';const sc=el('div','screen active');
  const scroll=el('div','scroll ob '+(cls||''));
  const dots=el('div','obdots');dots.setAttribute('aria-label',`Krok ${step} z 3`);
  for(let i=1;i<=3;i++)dots.appendChild(el('i',i<step?'on':i===step?'cur a-blink':''));
  scroll.appendChild(dots);sc.appendChild(scroll);app.appendChild(sc);app.appendChild(el('div','toast',''));app.lastChild.id='toast';
  return scroll;
}
function renderLevelPick(){
  const scroll=obShell(1,'levelpick');
  let level=META.level==='podstawowka'?'inne':LEVELS.some(l=>l[0]===META.level)?META.level:null,goal=GOALS.some(g=>g[0]===META.goal)?META.goal:null; // stara „podstawówka” = „coś innego”; nieznany cel = brak celu
  if(level&&goal&&!GOALS.find(g=>g[0]===goal)[2].includes(level))goal=GOAL_DEFAULT[level]; // cel spoza etapu (np. olimpiada po zmianie etapu) → domyślny
  scroll.appendChild(el('div','obhead a-up','<h1>Na jakim etapie jesteś?</h1><p>Dopasujemy poziom trudności i język wyjaśnień.</p>'));
  const opts=el('div','obopts');scroll.appendChild(opts);
  scroll.appendChild(el('div','eyebrow sec obeye','Do czego się przygotowujesz?'));
  const chips=el('div','obchips');scroll.appendChild(chips);
  const foot=el('div','obfoot');const next=el('button','pill a-glow',obFrom==='first'?'DALEJ':'ZAPISZ');next.id='ob-next';foot.appendChild(next);
  if(obFrom!=='first'){const back=el('button','pill text','Wróć bez zmian');back.id='ob-back';back.onclick=()=>go('settings');foot.appendChild(back);}
  scroll.appendChild(foot);
  // karty etapów budowane raz — klik zmienia tylko zaznaczenie (pełne przerysowanie odtwarzało animacje i karta „skakała”)
  const optBtns=LEVELS.map(([id,t,s,ic,tone],i)=>{
    const b=el('button','obopt '+tone+' a-up d'+(i+1),`<div class="ico">${icon(ic,{size:24,stroke:2.6})}</div><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div><span class="ck"></span>`);
    b.dataset.level=id;b.onclick=()=>{if(level===id)return;level=id;const gg=GOALS.find(g=>g[0]===goal);if(!gg||!gg[2].includes(id))goal=GOAL_DEFAULT[id];draw(b);};opts.appendChild(b);return b;});
  let chipsFor;
  const draw=popped=>{
    optBtns.forEach(b=>{const on=level===b.dataset.level;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));b.querySelector('.ck').innerHTML=on?icon('check',{size:16,stroke:4}):'';
      if(b===popped){b.classList.remove('a-up','a-sel');void b.offsetWidth;b.classList.add('a-sel');}});
    if(chipsFor!==level){ // chipy przebudowane tylko przy zmianie etapu (inny zestaw celów)
      const firstDraw=chipsFor===undefined;chipsFor=level;chips.innerHTML='';
      GOALS.filter(g=>!level||g[2].includes(level)).forEach(([id,t],i)=>{const c=el('button','obchip'+(firstDraw?' a-up d'+Math.min(6,i+3):''),t);c.dataset.goal=id;c.onclick=()=>{goal=id;draw();};chips.appendChild(c);});
    }
    chips.querySelectorAll('.obchip').forEach(c=>{const on=goal===c.dataset.goal;c.classList.toggle('on',on);c.setAttribute('aria-pressed',String(on));});
    next.disabled=!level;
  };
  next.onclick=()=>{if(!level)return;META.level=level;META.goal=goal||GOAL_DEFAULT[level];saveMeta();if(obFrom==='first')openOnboarding('first');else{toast('Zapisane: '+LEVEL_NAME[level],'check');go('settings');}};
  keyFn=e=>{if(e.key==='Enter')next.click();};
  draw();
}
function renderOnboarding(){
  const scroll=obShell(2,'onboarding');
  let goal=goalXP();
  scroll.appendChild(el('div','obhead a-up','<h1>Ile czasu dziennie?</h1><p>Cel możesz zmienić w każdej chwili. Lepiej zacząć niżej i utrzymać serię.</p>'));
  const opts=el('div','obopts');scroll.appendChild(opts);
  let first=true;
  const draw=()=>{opts.innerHTML='';GOALS_XP.forEach(([xp,t,mins],i)=>{const on=goal===xp;
    const b=el('button','obopt goal'+(on?' on'+(first?'':' a-sel'):first?' a-up d'+(i+1):''),`<i class="obbar"></i><div class="grow"><div class="t">${t}</div><div class="s">${mins} · ${xp} XP</div></div><span class="ck">${on?icon('check',{size:16,stroke:4}):''}</span>`);
    b.dataset.goal=xp;b.setAttribute('aria-pressed',String(on));b.onclick=()=>{goal=xp;draw();};opts.appendChild(b);});first=false;};
  draw();
  scroll.appendChild(el('div','obnote a-up d5',icon('flame',{size:20,cls:'ic-flame'})+'<span>Seria rośnie każdego dnia, w którym się uczysz.</span>'));
  const foot=el('div','obfoot');const next=el('button','pill a-glow',obFrom==='first'?'USTAW CEL':'ZAPISZ CEL');next.id='ob-next';
  next.onclick=()=>{setGoal(goal);
    if(obFrom==='first'){go('today');setTimeout(()=>toast('Cel dzienny: '+goal+' XP','bolt'),500);}else{toast('Cel dzienny: '+goal+' XP','bolt');go(obFrom==='today'?'today':'settings');}};
  foot.appendChild(next);
  if(obFrom!=='first'){const back=el('button','pill text','Wróć bez zmian');back.id='ob-back';back.onclick=()=>go(obFrom==='today'?'today':'settings');foot.appendChild(back);}
  scroll.appendChild(foot);
  keyFn=e=>{if(e.key==='Enter')next.click();};
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
  app.innerHTML='';const sc=el('div','screen active weekly');
  const scroll=el('div','scroll wk');sc.appendChild(scroll);app.appendChild(sc);app.appendChild(el('div','toast',''));app.lastChild.id='toast';
  // P2-27: bez udawanego paska „relacji” (5 segmentów przy jednym ekranie)
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
  if(navigator.share){const sh=el('button','pill text dark',icon('upload',{size:16})+' Udostępnij');sh.onclick=()=>{navigator.share({title:'Cramfox — mój tydzień',text:`${cur.xp} XP, ${cur.days} ${pl(cur.days,'dzień','dni','dni')} nauki, ${cur.levels} ${pl(cur.levels,'poziom','poziomy','poziomów')} — Cramfox`}).catch(()=>{});};foot.appendChild(sh);}
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
  const pool=shuffle(allCards(s).filter(c=>scope.indexOf(c.lid)>=0)).map(c=>({s,lv:lvOf(c.lid),kind:'card',c,idx:c.i,key:s.id+':'+c.lid+':'+c.i}));
  const weakItems=weak.length?weak:pool.slice(0,8);const used=new Set(weakItems.map(x=>x.key)); // blok 2 bez fiszek z bloku 1
  const cards=pool.filter(x=>!used.has(x.key)).slice(0,12);
  const qs=shuffle(exQuizFor(s,scope)).slice(0,10).map(q=>({s,lv:lvOf(q.lid),kind:'quiz',q,idx:q.qi,key:s.id+':'+q.lid+':q'+q.qi}));
  const deck=deckKeys(s.id).map(srsResolve).filter(Boolean);
  const errs=deck.length?deck.slice(0,10):mine.filter(x=>x.kind==='quiz'&&(x.e.box|0)===0).slice(0,10);
  const lvNames=scope.map(id=>{const l=lvOf(id);return l?noEmoji(l.title):'';}).filter(Boolean);
  const scopeTxt=scope.length===s.levels.length?'cały przedmiot':lvNames.slice(0,2).join(', ')+(lvNames.length>2?' +'+(lvNames.length-2):'');
  return [
    {id:'weak',t:'Najsłabsze pojęcia',s:weak.length?`${weak.length} ${pl(weak.length,'pojęcie, które','pojęcia, które','pojęć, które')} najczęściej mylisz`:'bez historii pomyłek — biorę fiszki z zakresu',items:weakItems},
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
  scroll.appendChild(el('div','cramhero a-up',`${icon('moon',{size:64,cls:'ic-moon'})}<div class="eyebrow">${sshort(s)} · ${t?'sprawdzian '+inDays(dayDiff(todayStr(),t.date)):'ostatnia powtórka przed egzaminem'}</div><div class="cramtime a-blink">${total} min</div><div class="crams">do północy ${etaText(toMid)} — potem sen utrwala to, co dziś powtórzysz</div>`));
  scroll.appendChild(el('div','eyebrow sec','Plan na '+total+' minut'));
  const list=el('div','cramrows');
  blocks.forEach((b,i)=>list.appendChild(el('div',`cramrow ${CRAM_TONE[b.id]} a-up d${i+1}`,`<div class="num"><span>${i+1}</span></div><div class="grow"><div class="t">${b.t}</div><div class="s">${b.s}</div></div><span class="min">5 min</span>`)));
  if(!blocks.length)list.appendChild(el('div','sp','Brak fiszek i pytań w tym przedmiocie.'));
  scroll.appendChild(list);
  scroll.appendChild(el('div','cramnote a-up d5',icon('info',{size:18,stroke:2.4})+'<span>Blok kończy się po 5 minutach albo gdy przejrzysz wszystko. Potem idź spać — sen utrwala to, czego się właśnie uczysz.</span>'));
  const foot=el('div','cramfoot');const b=el('button','pill violet a-glow','ZACZYNAM');b.id='cram-start';b.disabled=!blocks.length;
  b.onclick=()=>{cramState={s,blocks,bi:0,ii:0,left:CRAM_BLOCK,ok:0,bad:0,xp:0,flipped:false,marks:[],t0:Date.now()};cramTimer();cramRender();};
  foot.appendChild(b);scroll.appendChild(foot);
  keyFn=e=>{if(e.key==='Enter')b.click();};
}
function cramTimer(){clearInterval(cramInt);cramInt=setInterval(()=>{const cs=cramState;if(!cs||cs.done)return clearInterval(cramInt);cs.left--;
  const t=document.getElementById('cramleft');if(t){t.textContent=fmt(Math.max(0,cs.left));t.parentElement.classList.toggle('warn',cs.left<=30);t.parentElement.classList.toggle('a-blink',cs.left<=30);}
  const bar=document.getElementById('cramdrain');if(bar)bar.style.width=Math.max(0,cs.left/CRAM_BLOCK*100)+'%';
  if(cs.left<=0)cramNextBlock('Czas na ten blok minął');},1000);}
function cramNextBlock(msg){const cs=cramState;if(!cs)return;closeSheet();cs.bi++;cs.ii=0;cs.left=CRAM_BLOCK;cs.marks=[];cs.flipped=false;cs.seenAt=null;
  if(cs.bi>=cs.blocks.length)return cramFinish();cramRender();toast(msg||'Blok gotowy','check');}
function cramAnswer(it,ok,xp){const cs=cramState;cs.marks[cs.ii]=ok?'on':'bad';srsTouch(it.s.id,it.lv.id,it.kind==='quiz'?'q'+it.idx:String(it.idx),ok);
  if(ok){cs.ok++;if(xp){cs.xp+=addXP(it.s.id,xp);}}else cs.bad++;missionEvent('review',1);}
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
  const body=el('div','lessonbody');L.appendChild(body);
  const next=()=>{cs.ii++;cramRender();};
  if(it.kind==='card'){
    const c=it.c;
    const flip=el('div','flip themed a-up'+(cs.flipped?' flipped':''));flip.style.setProperty('--accent',it.s.accent);if(it.s.onAccent)flip.style.setProperty('--on-accent',it.s.onAccent);
    flip.innerHTML=`<div class="flipinner"><div class="face front"><span class="tag accent">${noEmoji(it.lv.title)}</span><div class="term">${c.t}</div><div class="tapomat">dotknij, żeby odwrócić</div></div>
      <div class="face back"><span class="tag">odpowiedź</span><div class="deftxt">${c.d}</div><div class="tapomat">dotknij, żeby wrócić</div></div></div>`;
    let swiped=false,g=null;flip.onclick=()=>{if(swiped){swiped=false;return;}cs.flipped=!cs.flipped;flip.classList.toggle('flipped');if(cs.flipped&&g)g.seen();};body.appendChild(flip);
    const foot=el('div','lessonfoot');const btns=el('div','fbtns');
    const no=el('button','fbtn no',icon('refresh',{size:18,stroke:2.8})+' jeszcze nie'),yes=el('button','fbtn yes',icon('check',{size:18,stroke:3.4})+' umiem');no.id='rvno';yes.id='rvyes';
    const ans=ok=>{if(cramState!==cs||!advOk())return;cramAnswer(it,ok,ok?2:0);cs.flipped=false;cs.seenAt=null;next();};
    g=cardGate(cs,flip,btns,ans);
    no.onclick=()=>g.ask(false);yes.onclick=()=>g.ask(true);
    let x0=null;flip.onpointerdown=e=>{x0=e.clientX;};flip.onpointerup=e=>{if(x0==null)return;const dx=e.clientX-x0;x0=null;if(Math.abs(dx)>80){swiped=true;g.ask(dx>0);}};
    btns.appendChild(no);btns.appendChild(yes);foot.appendChild(btns);L.appendChild(foot);
    keyFn=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();flip.click();}else if(e.key==='ArrowLeft'||e.key==='1')g.ask(false);else if(e.key==='ArrowRight'||e.key==='2')g.ask(true);};
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
  const body=el('div','lessonbody done');if(pct>=50)body.appendChild(confetti(5));
  const lc=el('div','lc');
  lc.innerHTML=`<div class="lcbig moon a-pop">${icon('moon',{size:64})}</div>
    <div class="lctxt a-up d2"><div class="lct">Idź spać</div><div class="lcs">${noEmoji(s.name)} · ${cs.bi+(cs.ii>0?1:0)>cs.blocks.length?cs.blocks.length:Math.min(cs.blocks.length,cs.bi+(cs.ii>0?1:0))} z ${cs.blocks.length} ${pl(cs.blocks.length,'bloku','bloków','bloków')} · ${fmt(Math.round((Date.now()-cs.t0)/1000))}</div></div>
    <div class="lcstats a-up d3"><div class="lcstat acid"><div class="v">${cs.ok}</div><div class="k under">umiem</div></div><div class="lcstat red"><div class="v">${cs.bad}</div><div class="k under">do rana</div></div><div class="lcstat gold"><div class="v">+${cs.xp}</div><div class="k under">XP</div></div></div>`;
  const card=el('div','setcard rvlist a-up d4');
  card.innerHTML='<div class="eyebrow sec">Plan na jutro</div>'+[['clock','Rano: 5 minut',cs.bad?cs.bad+' '+pl(cs.bad,'pojęcie, które','pojęcia, które','pojęć, które')+' dziś nie weszło — wracają w powtórce':'tylko fiszki z najsłabszych, bez nowych rzeczy'],['close','Przed egzaminem: nic nowego','przejrzyj notatki, nie ucz się nowych rzeczy'],t?['calendar','Sprawdzian: '+fmtDate(t.date),inDays(dayDiff(todayStr(),t.date))+' · powodzenia']:['moon','Teraz sen','7–8 godzin robi więcej niż kolejna godzina nauki']].map(([ic,tt,ss])=>`<div class="setrow">${icon(ic,{size:18,stroke:2.6})}<div class="grow"><div class="t">${tt}</div><div class="s">${ss}</div></div></div>`).join('<div class="setsep"></div>');
  lc.appendChild(card);body.appendChild(lc);L.appendChild(body);
  const foot=el('div','lessonfoot col');const main=el('button','pill violet a-glow','DOBRANOC');main.id='cram-done';main.onclick=()=>go('today');
  const alt=el('button','pill text','WRÓĆ DO EGZAMINU');alt.id='cram-alt';alt.onclick=()=>openSubject(s.id,'egzamin');foot.appendChild(main);foot.appendChild(alt);L.appendChild(foot);
  cramState=null;keyFn=e=>{if(e.key==='Enter')main.click();};
  notify('Powtórka zapisana — dobranoc','moon');
}

/* ============================================================ KROK 9: POPRAW PYTANIE (EditContent.html) — arkusz; PROGRESS.overrides["sid:lid:qi"]={q,a,c,e}
   Nakładane przez qOf() wszędzie: lekcja, zakładka Quiz, egzamin, boss, powtórka, cram. „Przywróć oryginał” kasuje nadpisanie. */
function openEditContent(s,lv,qi,o){
  o=o||{};const base=(lv.quiz||[])[qi];if(!base)return;
  // pola formularza = surowy tekst: pytanie z danych jest escapowane → txt(); poprawka już jest surowa. Do HTML (textarea, value) zawsze przez esc()
  const B={q:txt(base.q).trim(),a:base.a.map(x=>txt(x).trim()),c:base.c,e:txt(base.e||'').trim()};
  const ovRaw=overrides()[ovKey(s.id,lv.id,qi)];const ov=ovOk(ovRaw)?ovRaw:null;const cur=ov?{q:ov.q,a:ov.a.slice(),c:ov.c,e:ov.e||''}:{q:B.q,a:B.a.slice(),c:B.c,e:B.e};
  let c=cur.c;
  const sh=openSheet('edit',`<div class="shandle"></div>
    <div class="shead"><div><div class="st2">Popraw pytanie</div><div class="ssub">${noEmoji(s.name)} · ${noEmoji(lv.title)} · pytanie ${qi+1} z ${(lv.quiz||[]).length}</div></div><button class="backbtn sclose" id="edclose" aria-label="Zamknij">${icon('close',{size:18,stroke:3})}</button></div>
    <div class="infobox a-up">${icon('edit',{size:18})}<span>${ov?'To pytanie ma już Twoją poprawkę.':'Poprawka zapisze się razem z Twoimi postępami.'} Zastąpi pytanie w lekcji, quizie, egzaminie i powtórce.</span></div>
    <label class="edlbl a-up d1" for="edq">Treść pytania</label><textarea class="edta" id="edq" rows="2">${esc(cur.q)}</textarea>
    <div class="edlbl a-up d2">Odpowiedzi — zaznacz poprawną</div>
    <div class="edopts a-up d2">${cur.a.map((a,i)=>`<div class="edopt${i===c?' on':''}"><button class="edradio" type="button" data-i="${i}" role="radio" aria-checked="${i===c}" aria-label="Poprawna: ${keys[i]}"><i></i></button><span class="k">${keys[i]}</span><input class="edin" type="text" data-i="${i}" value="${esc(a)}" aria-label="Odpowiedź ${keys[i]}"></div>`).join('')}</div>
    <label class="edlbl a-up d3" for="ede">Wyjaśnienie</label><textarea class="edta" id="ede" rows="2">${esc(cur.e||'')}</textarea>
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
    const same=q===B.q&&e===B.e&&c===B.c&&a.length===B.a.length&&a.every((x,i)=>x===B.a[i]); // surowy tekst vs zdekodowany oryginał
    const O=overrides();if(same)delete O[ovKey(s.id,lv.id,qi)];else O[ovKey(s.id,lv.id,qi)]={q,a,c,e,at:todayStr()};saveProgress();
    closeSheet();toast(same?'Bez zmian — oryginał':'Poprawka zapisana','check');if(o.onSaved)o.onSaved(qOf(s,lv,qi));
  };
  const rs=sh.querySelector('#edreset');if(rs)rs.onclick=()=>{delete overrides()[ovKey(s.id,lv.id,qi)];saveProgress();closeSheet();toast('Przywrócono oryginał','refresh');if(o.onSaved)o.onSaved(qOf(s,lv,qi));};
  keyFn=null;setTimeout(()=>{try{sh.querySelector('#edq').focus();}catch(e){}},80);
  return sh;
}

/* ============================================================ KROK 9: ŹRÓDŁO PYTANIA (SourceView.html) — materiał, strona, cytat */
function openSourceView(q,ctx,onBack){
  const src=q.src||{};ctx=ctx||{};
  const sub=[src.material?'materiał '+src.material:'',src.page?'strona '+src.page:''].filter(Boolean).join(' · ')||'materiał źródłowy';
  const sh=openSheet('source',`<div class="shandle"></div>
    <div class="shead"><div><div class="st2">Skąd to pytanie?</div><div class="ssub">${sub}</div></div><button class="backbtn sclose" id="srcclose" aria-label="Zamknij">${icon('close',{size:18,stroke:3})}</button></div>
    <div class="srcpage a-up d1"><div class="pg"><i class="h"></i>${[70,58,72,46,64,60].map(w=>`<i style="width:${w}%"></i>`).join('')}<i class="hl a-glow" style="width:54%"></i>${[66,52,62,50].map(w=>`<i style="width:${w}%"></i>`).join('')}</div></div>
    <div class="srcquote a-up d2"><div class="eyebrow">Zaznaczony fragment</div><div class="qt">${src.quote?'„'+src.quote+'”':'Brak cytatu w danych — jest tylko odnośnik do materiału.'}</div></div>
    <div class="sbtns">${ctx.s&&ctx.lv&&ctx.qi!=null?'<button class="pill ghost" id="srcbad">Pytanie jest złe</button>':''}<button class="pill gold" id="srcok" data-primary>WRACAM</button></div>`);
  sheetBack();
  const back=()=>{closeSheet();if(onBack)onBack();};
  sh.querySelector('#srcclose').onclick=back;sh.querySelector('#srcok').onclick=back;document.getElementById('sheetback').onclick=back;
  const bad=sh.querySelector('#srcbad');if(bad)bad.onclick=()=>openEditContent(ctx.s,ctx.lv,ctx.qi,{onBack:onBack,onSaved:typeof ctx.onSaved==='function'?ctx.onSaved:onBack});
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
  top.appendChild(el('div','logo ttl',o.head||'Cramfox'));app.appendChild(top);
  const sc=el('div','screen active');const scroll=el('div','scroll errv');sc.appendChild(scroll);app.appendChild(sc);
  scroll.appendChild(el('div','errart',o.calm?`<div class="errico calm">${icon(o.icon||'info',{size:44,stroke:2.4})}</div>`:`<div class="errico a-shake">${icon(o.icon||'file',{size:44,stroke:2.4})}<b>!</b></div>`)); // calm: spodziewany stan (np. limit lekcji), nie awaria
  scroll.appendChild(el('div','errtxt',`<h1 class="a-up d1">${o.title}</h1>${o.reason?`<p>${o.reason}</p>`:''}`));
  if(o.rows&&o.rows.length){const card=el('div','errlist a-up d2');o.rows.forEach(([ic,t,s,ok])=>card.appendChild(el('div','errrow'+(ok?' ok':' bad'),icon(ic,{size:18,stroke:2.4})+`<div class="grow"><div class="t">${t}</div>${s?`<div class="s">${s}</div>`:''}</div>`)));scroll.appendChild(card);}
  if(o.can&&o.can.length){const card=el('div','errcan a-up d3','<div class="eyebrow sec">Co możesz zrobić</div>');o.can.forEach(([ic,t])=>card.appendChild(el('div','r',icon(ic,{size:18,stroke:2.4})+`<span>${t}</span>`)));scroll.appendChild(card);}
  const foot=el('div','errfoot');
  (o.actions||[]).forEach((a,i)=>{const b=el('button','pill'+(a.primary?' a-glow':a.text?' text':' ghost'),a.label);b.id='err-'+i;b.onclick=a.go;foot.appendChild(b);});
  scroll.appendChild(foot);
  app.appendChild(el('div','toast',''));app.lastChild.id='toast';
  keyFn=e=>{if(e.key==='Enter'){const p=foot.querySelector('.a-glow');if(p)p.click();}};
}
/* pasek „Brak sieci” nad aplikacją (poza #app — nie kasuje go żaden render); navigator.onLine + zdarzenia offline/online.
   P1-9: pasek jest w przepływie — #app zjeżdża o jego wysokość (barLayout), więc nie zasłania „Wróć” ani pigułek; jedna linia przy 375 px.
   Dopóki jest offline, stan sprawdzany co 5 s (iOS nie zawsze wysyła „online”); po powrocie sieci pasek znika i krótki toast. */
let netInt=null,netWas=false;
function netbar(){
  let b=document.getElementById('netbar');
  if(!b){b=el('div','netbar',icon('wifi',{size:16})+'<span class="grow">'+(STORE.volatile===true?'Brak sieci — nauka działa dalej':'Brak sieci — postępy wyślą się później')+'</span>');b.id='netbar';b.setAttribute('role','status');document.body.insertBefore(b,document.body.firstChild);}
  const off=navigator.onLine===false;b.classList.toggle('on',off);b.classList.toggle('a-up',off);
  if(off&&!netInt)netInt=setInterval(netbar,5000);else if(!off&&netInt){clearInterval(netInt);netInt=null;}
  if(netWas&&!off)toast('Sieć wróciła','wifi');netWas=off;
  barLayout();
}
/* wysokość widocznego paska (sieć albo pamięć) → --barh na <html> i body.bar-on: styles.css przesuwa #app w dół o tyle samo */
function barLayout(){
  let h=0;document.querySelectorAll('.netbar').forEach(x=>{if(getComputedStyle(x).display!=='none')h=Math.max(h,x.offsetHeight);});
  document.documentElement.style.setProperty('--barh',h+'px');document.body.classList.toggle('bar-on',h>0);
  const p=document.querySelector('.path');if(p)requestAnimationFrame(()=>drawTrail(p));
}
/* storage niedostępny (STORE w pamięci: iOS file://, zablokowane dane witryn) → pasek ostrzeżenia; ===true, bo na prawdziwym localStorage .volatile to ewentualny wpis (tekst).
   P1-9: zwinięty do jednej linii; „Więcej” rozwija wyjaśnienie, krzyżyk zamyka. */
function storebar(){
  if(STORE.volatile!==true||document.getElementById('storebar'))return;
  const why=NATIVE?'Uruchom aplikację ponownie — zwykle to wystarcza.':'Przeglądarka blokuje zapis (tryb prywatny albo podgląd pliku). Otwórz stronę w Safari lub Chrome.';
  const b=el('div','netbar storebar on a-up',icon('alert',{size:16})+`<span class="grow"><b>Postępy się nie zapisują</b><span class="sbwhy">Postępy nie zapisują się na tym urządzeniu. ${why}</span></span>`);
  b.id='storebar';b.setAttribute('role','status');
  const more=el('button','sbm','Więcej');more.type='button';more.setAttribute('aria-expanded','false');
  more.onclick=()=>{const o=b.classList.toggle('open');more.textContent=o?'Mniej':'Więcej';more.setAttribute('aria-expanded',String(o));barLayout();};
  const x=el('button','sbx',icon('close',{size:14,stroke:3}));x.setAttribute('aria-label','Zamknij ostrzeżenie');x.onclick=()=>{b.remove();barLayout();};
  b.appendChild(more);b.appendChild(x);
  const nb=document.getElementById('netbar');if(nb&&nb.parentNode)nb.after(b);else document.body.insertBefore(b,document.body.firstChild); // po #netbar: CSS chowa go, gdy pasek sieci jest widoczny
  barLayout();
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded',()=>{
  app=document.getElementById('app');
  applyMotion();
  try{const mq=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)');if(mq&&mq.addEventListener)mq.addEventListener('change',applyMotion);}catch(e){} // P2-9: zmiana w ustawieniach telefonu w trakcie
  netbar();storebar();
  // P1-9: pasek „Brak sieci” — offline/online i ponowne sprawdzenie po powrocie z tła (iOS potrafi wysłać „offline” w tle i nie wysłać „online” po powrocie)
  window.addEventListener('offline',netbar);
  window.addEventListener('online',netbar);
  window.addEventListener('focus',netbar);window.addEventListener('pageshow',netbar);
  window.addEventListener('resize',()=>{const p=document.querySelector('.path');if(p)drawTrail(p);barLayout();});
  // P1-8: powrót z tła (iOS trzyma WebView przez noc) i północ przy otwartej apce → nowy dzień: zamrożenia, plany, misje, ekran główny od nowa
  const back=()=>{netbar();dayCheckSynced();};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')back();});
  document.addEventListener('resume',back);window.addEventListener('focus',dayCheckSynced);
  setInterval(()=>{if(document.visibilityState!=='hidden')dayCheckSynced();},60000);
  // klawiatura (lekcja, quiz, panele): jeden nasłuch, widok podstawia keyFn; pola tekstowe (ćwiczenia) pomijane
  document.addEventListener('keydown',e=>{if(!keyFn)return;const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'))return;keyFn(e);});
  window.NAUKA_BOOT?window.NAUKA_BOOT(start):start(); // cloud-ui.js: logowanie → przedmioty z konta → start
});
/* start silnika: przedmioty są już w SUBJECTS (setSubjects), postępy wczytywane od nowa (mogły przyjść z chmury) */
let booted=false,dayNow=null;
/* P1-8: zmiana dnia bez nowego startu (WebView przeżył noc w tle, nauka przez północ). Dane od razu (zamrożenia przed pierwszym XP, plany do sprawdzianu,
   misje dnia); ekran przerysowany tylko na ekranie głównym i bez otwartej lekcji / arkusza — wtedy też ekran powrotu albo podsumowanie tygodnia. */
const DAY_HOME=/^(today|review|cards|subjects|profile|settings|streak|missions|album|shop|testplan)$/;
function dayCheck(){
  if(!booted)return;const t=todayStr();if(dayNow===t)return;const was=dayNow;dayNow=t;if(!was)return;
  try{applyFreeze();syncTests();missions();}catch(e){}
  if(current||lessonState||rvState||exState||bossState||cramState||document.getElementById('sheet')||!DAY_HOME.test(view))return; // nie przerywamy nauki ani formularza
  if(!META.level)return;
  if(needComeBack())return go('comeback');
  if(needWeekly())return openWeekly('last');
  go(view,true);
}
/* nowy dzień dopiero PO pobraniu zmian z chmury (hook „resume” w cloud-ui.js zwraca obietnicę pull, maks. 5 s czekania): applyFreeze na nieaktualnej
   serii zużywał zamrożenie za dzień, w którym drugie urządzenie się uczyło, a scalenie cofało potem serię na wszystkich urządzeniach.
   Hook woła się tylko przy faktycznej zmianie dnia. reload() po scaleniu ustawia dayNow — przywracamy poprzedni, żeby kroki nowego dnia (misje,
   ekran powrotu, tydzień) i tak się wykonały (applyFreeze jest idempotentne). */
let dayWait=null;
function dayCheckSynced(){
  if(!booted||dayWait||dayNow===todayStr())return;
  let p=null;try{p=hook('resume');}catch(e){}
  if(!p||typeof p.then!=='function')return dayCheck();
  const was=dayNow;
  dayWait=Promise.race([Promise.resolve(p).catch(()=>{}),new Promise(r=>setTimeout(r,5000))]).then(()=>{dayWait=null;dayNow=was;dayCheck();});
}
/* przeładowanie stanu po zmianach z innego urządzenia — bez zmiany ekranu (start() zawsze wraca na Dziś) */
function reload(){PROGRESS=loadProgress();META=loadMeta();try{fixProgress();syncTests();applyFreeze();applyMotion();dayNow=todayStr();}catch(e){return start();}if(!META.level||!booted)return start();go(view,true);}
function start(){
  PROGRESS=loadProgress();META=loadMeta();
  try{
    fixProgress();booted=true;dayNow=todayStr();
    syncTests(); // krok 7: plany do sprawdzianu — usuń po terminie, przelicz od dziś
    applyFreeze(); // krok 8: opuszczone dni pokryte zamrożeniami → seria zostaje
    // krok 9: pierwsze uruchomienie (bez etapu) → LevelPick → Onboarding; poniedziałek → podsumowanie tygodnia (raz); ≥ 3 dni przerwy → ComeBack (krok 8)
    if(!META.level)return openLevelPick('first');
    if(needComeBack())return go('comeback');
    if(needWeekly())return openWeekly('last');
    go('today');
  }catch(e){
    try{console.error('Cramfox: start silnika',e);}catch(x){} // szczegóły tylko w konsoli — na ekranie po polsku
    renderError({head:'Cramfox',icon:'alert',title:'Coś poszło nie tak',reason:'Silnik zatrzymał się przy starcie.'+(STORE.volatile===true?'':' Postępy są zapisane na tym urządzeniu.'),
      can:[['refresh',NATIVE?'Uruchom aplikację ponownie — zwykle to wystarcza':'Odśwież stronę — zwykle to wystarcza'],['check','Jeśli błąd wraca, zachowaj XP, zaliczone poziomy, gemy, motywy, odznaki i album, a resztę (plany, powtórki, misje, wyniki egzaminów) wyzeruj'],['alert','Ostatecznie wyzeruj wszystkie postępy (seria zostaje)']],
      actions:[{label:'ODŚWIEŻ',primary:true,go:()=>location.reload()},
        {label:'Zachowaj XP i poziomy',go:async()=>{if(!await ask({title:'Zachować XP i poziomy?',text:'XP, poziomy, gemy, motywy, odznaki i album zostają. Reszta postępów (plany, powtórki, misje, wyniki egzaminów) zostanie wyzerowana.',ok:'Wyzeruj resztę',danger:true}))return; // zdobyte rzeczy zostają — mają własne strażniki typu (themes(), badges(), album(), bossRec())
          const keep={epoch:Date.now()};SUBJECTS.forEach(s=>{const st=PROGRESS[s.id];if(st&&typeof st==='object'&&!Array.isArray(st))keep[s.id]={xp:+st.xp||0,levels:st.levels&&typeof st.levels==='object'&&!Array.isArray(st.levels)?st.levels:{},boss:st.boss};});
          if(typeof PROGRESS.gems==='number')keep.gems=PROGRESS.gems;['theme','themes','badges','album'].forEach(k=>{if(PROGRESS[k]!=null)keep[k]=PROGRESS[k];});PROGRESS=keep;saveProgress();location.reload();}},
        {label:'Wyzeruj postępy',text:true,go:async()=>{if(await ask({title:'Wyzerować postępy?',text:'Skasuje wszystkie postępy, także na innych urządzeniach z tym kontem. Seria zostaje.',ok:'Wyzeruj',danger:true})){PROGRESS={epoch:Date.now()};saveProgress();location.reload();}}}]});
  }
}
/* API dla warstwy chmury (cloud-ui.js): widoki, arkusze i helpery silnika; przedmioty z konta wstawiane w miejscu (SUBJECTS to stała tablica) */
// po starcie: nowy przedmiot z konta może mieć postępy z synchronizacji, których start() jeszcze nie sprawdził → fixProgress (idempotentne)
function setSubjects(list){SUBJECTS.splice(0,SUBJECTS.length,...(list||[]).filter(s=>s&&s.id&&s.name&&Array.isArray(s.levels)&&s.levels.length));if(booted)try{fixProgress();}catch(e){}}
function upsertSubject(s){if(!s||!s.id||!Array.isArray(s.levels)||!s.levels.length)return;const i=SUBJECTS.findIndex(x=>x.id===s.id);if(i>=0)SUBJECTS[i]=s;else SUBJECTS.push(s);if(booted)try{fixProgress();}catch(e){}}
window.NaukaEngine={_explainFor:explainFor,_viz:{ok:vizOk,html:vizHtml,text:vizPlain,chunks:doseChunks},_notify:notify,_real:doseReal,subjShort:sshort,subjInitials:initials,barLayout,reload,el,icon,fox,liveFoxes,foxAct,toast,notify,openSheet,closeSheet,sheetBack,ask,shell,obShell,go,goBack,openSubject,openLevel,openTestSheet,openQuickAdd,renderError,pl,noEmoji,todayStr,esc,txt,native:NATIVE,
  registerView:(k,fn)=>{VIEWS[k]=fn;},setSubjects,upsertSubject,subjects:()=>SUBJECTS,meta:()=>META,saveMeta,
  get view(){return view;},get current(){return current;}};
})();
