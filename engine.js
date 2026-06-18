/* ============================================================
   NAUKA — silnik wieloprzedmiotowej platformy do nauki
   Dane przedmiotów rejestrują się w window.SUBJECTS (patrz data/*.js)
   Tryby: Ścieżka (Duolingo) + Fiszki + Quiz + Egzamin + Info
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
function todayStr(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
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

function toast(t){let el=document.getElementById('toast');el.textContent=t;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),1500);}
function addXP(id,n){const s=subjState(id);s.xp+=n;saveProgress();const ext=touchStreak();updateXP();updateStreakUI();if(ext&&META.streak>1)setTimeout(()=>toast('🔥 seria '+META.streak+' dni z rzędu!'),1600);}
function updateXP(){const x=document.getElementById('xpNum');if(x&&current)x.textContent=subjState(current.id).xp;}
function updateStreakUI(){const n=streakDisplay();document.querySelectorAll('[id="streakNum"]').forEach(e=>e.textContent=n);}

/* pula wszystkich elementów danego przedmiotu (ze wszystkich poziomów) */
function allCards(s){return s.levels.flatMap(l=>(l.flashcards||[]).map(c=>({...c,lvl:l.title})));}
function allQuiz(s){return s.levels.flatMap(l=>(l.quiz||[]).map(q=>({...q,lvl:l.title})));}
function allFeed(s){return s.levels.flatMap(l=>(l.feed||[]).map(f=>({...f,lvl:l.title})));}

function applyTheme(s){
  const r=document.documentElement.style;
  r.setProperty('--accent', s.accent || 'linear-gradient(135deg,#ff2d95,#a855f7,#22d3ee)');
  r.setProperty('--accent2', s.accent2 || '#22d3ee');
}

/* ============================================================ HOME */
function renderHome(){
  current=null;
  document.documentElement.style.setProperty('--accent','linear-gradient(135deg,#ff2d95,#a855f7,#22d3ee)');
  document.documentElement.style.setProperty('--accent2','#22d3ee');
  app.innerHTML='';
  const top=el('div','topbar');
  top.appendChild(el('div','logo','📚 <span class="g">NAUKA</span>'));
  let totXP=Object.values(PROGRESS).reduce((a,s)=>a+(s.xp||0),0);
  const pills=el('div','pills');
  pills.appendChild(el('div','streak',`🔥 <span id="streakNum">${streakDisplay()}</span> <small>dni</small>`));
  pills.appendChild(el('div','streak',`⚡ <span>${totXP}</span> <small>xp</small>`));
  top.appendChild(pills);
  app.appendChild(top);

  const sc=el('div','screen active');const scroll=el('div','scroll');
  const hero=el('div','hero');
  hero.innerHTML='<h1>Wybierz przedmiot 👇</h1><p>Ucz się w stylu gen-z: poziomy jak w Duolingo, fiszki, quizy i symulacja egzaminu. Wszystko z prezek z zajęć.</p>';
  scroll.appendChild(hero);

  SUBJECTS.forEach(s=>{
    const st=subjState(s.id);
    const total=s.levels.length;
    const done=s.levels.filter(l=>st.levels[l.id]&&st.levels[l.id].done).length;
    const pct=total?Math.round(done/total*100):0;
    const card=el('div','subjcard');
    card.style.setProperty('--sa', s.accent);
    card.innerHTML=`<div class="subjemoji">${s.emoji}</div>
      <div class="subjmeta">
        <h3>${s.name}</h3>
        <div class="sub">${s.tagline||''}</div>
        <div class="subjprog"><div class="bar"><i style="width:${pct}%"></i></div><small>${done}/${total} poziomów</small></div>
      </div><div class="chev">›</div>`;
    card.onclick=()=>openSubject(s.id);
    scroll.appendChild(card);
  });
  const add=el('div','addcard');
  add.innerHTML='<div class="subjemoji">＋</div><div>Kolejny przedmiot?<br><span style="font-size:12.5px;font-weight:600">Dodaj plik w <b>data/</b> (patrz README) i pojawi się tutaj.</span></div>';
  scroll.appendChild(add);
  sc.appendChild(scroll);app.appendChild(sc);
}

/* ============================================================ SUBJECT shell */
function openSubject(id){
  current=SUBJECTS.find(s=>s.id===id);
  if(!current)return renderHome();
  applyTheme(current);
  curTab='path';
  renderSubject();
}
function renderSubject(){
  const s=current;
  app.innerHTML='';
  const top=el('div','topbar');
  const back=el('button','backbtn','‹');back.onclick=renderHome;
  top.appendChild(back);
  top.appendChild(el('div','logo',`${s.emoji} <span class="g">${s.short||s.name}</span>`));
  const pills=el('div','pills');
  pills.appendChild(el('div','streak',`🔥 <span id="streakNum">${streakDisplay()}</span> <small>dni</small>`));
  pills.appendChild(el('div','streak',`⚡ <span id="xpNum">${subjState(s.id).xp}</span> <small>xp</small>`));
  top.appendChild(pills);
  app.appendChild(top);

  const tabs=el('div','subtabs');
  [['path','🗺️ Ścieżka'],['fiszki','🎴 Fiszki'],['quiz','🧠 Quiz'],['egzamin','🎯 Egzamin'],['info','📋 Info']].forEach(([k,lab])=>{
    const b=el('div','subtab'+(curTab===k?' active':''),lab);
    b.onclick=()=>{curTab=k;renderSubject();};
    tabs.appendChild(b);
  });
  app.appendChild(tabs);

  const sc=el('div','screen active');sc.id='subjscreen';
  app.appendChild(sc);
  if(curTab==='path')renderPath(sc);
  else if(curTab==='fiszki')renderFiszki(sc);
  else if(curTab==='quiz')renderQuiz(sc);
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
    const btn=el('button','nodebtn '+cls, done?'✓':(unlocked?(lv.emoji||'📘'):'🔒'));
    if(done){btn.innerHTML+=`<span class="stars">${'⭐'.repeat(stars)}${'·'.repeat(Math.max(0,3-stars))}</span>`;}
    if(unlocked){btn.onclick=()=>startLesson(lv);}else{btn.onclick=()=>toast('Najpierw zalicz poprzedni poziom 🔒');}
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
  const x=el('button','x','✕');x.onclick=closeLesson;head.appendChild(x);
  head.appendChild(el('div','bar',`<i style="width:${progPct}%"></i>`));
  L.appendChild(head);
  const body=el('div','lessonbody');L.appendChild(body);

  if(ls.phase==='feed'){
    const f=lv.feed[ls.feedIdx];
    const fw=el('div');fw.style.cssText='flex:1;display:flex;flex-direction:column;justify-content:center;overflow-y:auto';
    const card=el('div','fcard');
    card.innerHTML=`<span class="tag">${lv.title} · ${ls.feedIdx+1}/${totalFeed}</span>
      <div class="ftitle">${f.title}</div><div class="fbody">${f.body}</div>
      ${f.real?`<div class="real"><span class="lbl">po ludzku 🗣️</span>${f.real}</div>`:''}
      ${f.mnemo?`<div class="mnemo"><span class="lbl">zapamiętaj 🧠</span>${f.mnemo}</div>`:''}`;
    fw.appendChild(card);body.appendChild(fw);
    const foot=el('div','lessonfoot');
    const b=el('button','pill', ls.feedIdx+1<totalFeed?'dalej →':(ls.quiz.length?'lecimy z quizem 🧠':'zakończ ✅'));
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
    const nb=el('button','pill qnext','dalej →');nb.id='lnext';
    nb.onclick=()=>{ls.qIdx++;renderLesson();};
    foot.appendChild(nb);L.appendChild(foot);
    qc.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{
      if(ls.answered)return;ls.answered=true;const i=+o.dataset.i;
      qc.querySelectorAll('.opt').forEach(x=>{const xi=+x.dataset.i;if(xi===q.c)x.classList.add('correct');else if(xi===i)x.classList.add('wrong');else x.classList.add('dim');});
      if(i===q.c){ls.score++;addXP(s.id,5);toast('GIT +5xp 🟢');}else{toast('mid, czytaj wyjaśnienie 👇');}
      document.getElementById('lexp').classList.add('show');
      const nx=document.getElementById('lnext');nx.classList.add('show');nx.textContent=(ls.qIdx+1>=ls.quiz.length)?'zobacz wynik 🏁':'dalej →';
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
  }
  const L=document.getElementById('lesson');
  const emoji = !passed?'😵':(pct>=90?'👑':pct>=70?'🔥':'✅');
  const verdict = !passed?'Poniżej 50% — poziom niezaliczony. Przejedź feed jeszcze raz i spróbuj ponownie, dasz radę.':
    (pct>=90?'Mistrzostwo. Trzy gwiazdki, profesor by płakał ze szczęścia.':pct>=70?'Solidnie! Poziom zaliczony, lecimy dalej.':'Zaliczone na styk — wróć kiedyś po więcej gwiazdek.');
  L.innerHTML=`<div class="lessonhead"><button class="x" id="lx">✕</button><div class="bar"><i style="width:100%"></i></div></div>
   <div class="lessonbody"><div class="result">
     <div class="big">${emoji}</div>
     <h2>${lv.title}</h2>
     ${ls.quiz.length?`<div class="score">Trafione <b>${ls.score}/${ls.quiz.length}</b> (${pct}%) ${passed?'· '+'⭐'.repeat(stars):''}</div>`:''}
     <p>${verdict}</p>
   </div></div>
   <div class="lessonfoot">${passed?'<button class="pill" id="lcont">dalej na ścieżkę 🗺️</button>':'<button class="pill" id="lretry">spróbuj jeszcze raz 🔁</button>'}</div>`;
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
  chips.appendChild(mk('all','Wszystko 🌀'));
  s.levels.forEach(l=>chips.appendChild(mk(l.id,l.title)));
  wrap.appendChild(chips);
  const list = fState.lvl==='all'?allCards(s):(s.levels.find(l=>l.id===fState.lvl).flashcards||[]).map(c=>({...c,lvl:s.levels.find(l=>l.id===fState.lvl).title}));
  if(fState.idx>=list.length)fState.idx=0;
  const c=list[fState.idx]||{t:'—',d:'Brak fiszek'};
  wrap.appendChild(el('div','progressrow',`<div class="bar"><i style="width:${list.length?fState.idx/list.length*100:0}%"></i></div><div class="counter">${list.length?fState.idx+1:0}/${list.length}</div>`));
  const flip=el('div','flip'+(fState.flipped?' flipped':''));flip.style.height='calc(100dvh - 320px)';
  flip.innerHTML=`<div class="flipinner">
    <div class="face front"><span class="tag">${c.lvl||''}</span><div class="term">${c.t}</div><div class="tapomat">tapnij = odpowiedź 👀</div></div>
    <div class="face back"><span class="tag">odpowiedź ✅</span><div class="deftxt">${c.d}</div><div class="tapomat">tapnij = wróć ↩</div></div></div>`;
  flip.onclick=()=>{fState.flipped=!fState.flipped;flip.classList.toggle('flipped');};
  wrap.appendChild(flip);
  const btns=el('div','fbtns');
  const no=el('button','fbtn no','jeszcze nie 😵');const yes=el('button','fbtn yes','umiem 💪');
  const next=(known)=>{if(known){addXP(s.id,2);toast('+2xp 💪');}fState.flipped=false;fState.idx=(fState.idx+1)%Math.max(1,list.length);renderFiszki(sc);};
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
  chips.appendChild(mk('all','Wszystko 🌀'));
  s.levels.forEach(l=>chips.appendChild(mk(l.id,l.title)));
  wrap.appendChild(chips);
  wrap.appendChild(el('div','progressrow',`<div class="bar"><i style="width:${qState.list.length?qState.idx/qState.list.length*100:0}%"></i></div><div class="counter">${Math.min(qState.idx+1,qState.list.length)}/${qState.list.length}</div>`));
  const card=el('div','qcard');
  if(qState.idx>=qState.list.length){
    const pct=qState.list.length?Math.round(qState.score/qState.list.length*100):0;
    card.innerHTML=`<div class="result"><div class="big">${pct>=70?'🔥':pct>=50?'😎':'💀'}</div><h2>Wynik</h2>
      <div class="score">Trafione <b>${qState.score}/${qState.list.length}</b> (${pct}%)</div>
      <p>${pct>=70?'Solidnie ogarniasz ten przedmiot.':pct>=50?'Spoko, ale przejedź jeszcze fiszki.':'Wróć do fiszek i ścieżki, potem tu wróć.'}</p>
      <button class="pill" id="qre">jeszcze raz 🔁</button></div>`;
    wrap.appendChild(card);sc.innerHTML='';sc.appendChild(wrap);
    document.getElementById('qre').onclick=()=>{qState.list=null;renderQuiz(sc);};
    return;
  }
  const q=qState.list[qState.idx];qState.answered=false;
  card.innerHTML=`<span class="tag">${q.lvl||''}</span><div class="qq">${q.q}</div>
    <div class="opts">${q.a.map((o,i)=>`<button class="opt" data-i="${i}"><span class="k">${keys[i]}</span><span>${o}</span></button>`).join('')}</div>
    <div class="explain" id="qexp"><b>czemu:</b> ${q.e||''}</div>
    <button class="pill qnext" id="qnext" style="margin-top:14px">dalej →</button>`;
  wrap.appendChild(card);sc.innerHTML='';sc.appendChild(wrap);
  card.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{
    if(qState.answered)return;qState.answered=true;const i=+o.dataset.i;
    card.querySelectorAll('.opt').forEach(x=>{const xi=+x.dataset.i;if(xi===q.c)x.classList.add('correct');else if(xi===i)x.classList.add('wrong');else x.classList.add('dim');});
    if(i===q.c){qState.score++;addXP(s.id,3);toast('GIT +3xp 🟢');}else toast('mid 👇');
    document.getElementById('qexp').classList.add('show');
    const n=document.getElementById('qnext');n.classList.add('show');n.textContent=(qState.idx+1>=qState.list.length)?'wynik 🏁':'dalej →';
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
  const N=Math.min(20,allQuiz(s).length);
  const lim=(s.grading&&s.grading.examMin)||20;
  wrap.innerHTML=`<div class="result"><div class="big">🎯</div><h2>Symulacja egzaminu</h2>
    <div class="specs"><div class="spec">${N}<small>pytań losowo</small></div><div class="spec">${lim}:00<small>na czas</small></div><div class="spec">${(s.grading&&s.grading.pass)||50}%<small>żeby zaliczyć</small></div></div>
    <p>Losuję ${N} pytań z całego przedmiotu, bez podpowiedzi w trakcie. Na końcu % i ocena wg siatki + przegląd błędów.</p>
    <button class="pill" id="exstart">start egzaminu 🚀</button></div>`;
  sc.innerHTML='';sc.appendChild(wrap);
  document.getElementById('exstart').onclick=()=>beginExam(sc,N,lim*60);
}
function beginExam(sc,N,limit){
  const s=current;
  exState={pool:shuffle(allQuiz(s)).slice(0,N),idx:0,pick:[],left:limit};
  exState.pick=new Array(exState.pool.length).fill(null);
  clearInterval(exInt);
  exInt=setInterval(()=>{exState.left--;const t=document.getElementById('extimer');if(t){t.textContent='⏱ '+fmt(exState.left);t.classList.toggle('warn',exState.left<=60);}if(exState.left<=0){clearInterval(exInt);examFinish(sc);}},1000);
  renderExamQ(sc);
}
function renderExamQ(sc){
  const s=current;const ex=exState;
  if(ex.idx>=ex.pool.length)return examFinish(sc);
  const q=ex.pool[ex.idx];const sel=ex.pick[ex.idx];const last=ex.idx+1>=ex.pool.length;
  const wrap=el('div','scroll');
  wrap.innerHTML=`<div class="examhead"><div class="counter">Pytanie ${ex.idx+1}/${ex.pool.length}</div><div class="timer" id="extimer">⏱ ${fmt(ex.left)}</div></div>
    <div class="progressrow"><div class="bar"><i style="width:${ex.idx/ex.pool.length*100}%"></i></div></div>
    <div class="qcard"><span class="tag">${q.lvl||''}</span><div class="qq">${q.q}</div>
      <div class="opts">${q.a.map((o,i)=>`<button class="opt${sel===i?' sel':''}" data-i="${i}"><span class="k">${keys[i]}</span><span>${o}</span></button>`).join('')}</div>
      <div style="display:flex;gap:10px;margin-top:16px">
        ${ex.idx>0?'<button class="pill ghost" style="flex:1" id="exprev">← wstecz</button>':''}
        <button class="pill" style="flex:2" id="exnext">${last?'zakończ i sprawdź 🏁':'dalej →'}</button></div></div>`;
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
  const emoji=pct>=90?'👑':pct>=70?'🔥':pct>=pass?'😮‍💨':'💀';
  addXP(s.id,correct*3);
  const rev = wrong.length? wrong.map(w=>`<div class="ritem"><div class="rq">${w.q.q}</div>
      <div class="rbad">Twoja: ${w.sel==null?'— (brak)':keys[w.sel]+'. '+w.q.a[w.sel]}</div>
      <div class="rgood">Dobra: ${keys[w.q.c]}. ${w.q.a[w.q.c]}</div>
      <div class="rsrc">${w.q.lvl||''} · ${w.q.e||''}</div></div>`).join('') : '<div class="ritem rgood">Zero błędów. Clean sweep 🧼</div>';
  const wrap=el('div','scroll');
  wrap.innerHTML=`<div class="result"><div class="big">${emoji}</div><h2>Ocena: ${grade}</h2>
    <div class="score">Trafione <b>${correct}/${ex.pool.length}</b> (${pct}%)</div>
    <p>${pct>=pass?'Zdane! 🎉':'Poniżej progu — wróć do ścieżki i fiszek.'}</p>
    <button class="pill" id="exagain">jeszcze raz 🔁</button></div>
    <div class="review"><h3>Przegląd błędów (${wrong.length})</h3>${rev}</div>`;
  sc.innerHTML='';sc.appendChild(wrap);
  document.getElementById('exagain').onclick=()=>renderEgzamin(sc);
  toast(pct>=pass?'zdane! ocena '+grade+' 🎉':'niezaliczone 💀');
}

/* ---------- INFO ---------- */
function renderInfo(sc){
  const s=current;const wrap=el('div','scroll');
  wrap.innerHTML=`<div class="hero" style="padding-bottom:8px"><h1>${s.emoji} ${s.name}</h1><p>${s.tagline||''}</p></div>${s.info||'<div class="zbox"><p>Brak dodatkowych informacji.</p></div>'}`;
  sc.innerHTML='';sc.appendChild(wrap);
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded',()=>{
  app=document.getElementById('app');
  if(!SUBJECTS.length){app.innerHTML='<div class="topbar"><div class="logo">📚 NAUKA</div></div><div class="scroll"><div class="zbox"><p>Brak załadowanych przedmiotów. Dodaj plik danych w <b>data/</b> (np. data/makro.js).</p></div></div>';return;}
  renderHome();
});
})();
