/* ============================================================ CRAMFOX — CHMURA: UI
   Start z konta (NAUKA_BOOT), logowanie / rejestracja (16+), karta „Konto” w ustawieniach (wyloguj, usuń konto, Twoje dane),
   dodawanie materiału (zdjęcie / plik / tekst) → zgoda na AI → „Gdzie dodać?” → generowanie (~2 min, można w tle) → przedmiot gotowy.
   Wszystko, co pochodzi od użytkownika albo z serwera, trafia do DOM przez textContent albo esc(). */
(function(){
'use strict';
const C=window.NAUKA_CLOUD,E=()=>window.NaukaEngine;
if(!C)return;
const $=(sel,root)=>(root||document).querySelector(sel);
const esc=C.esc;
const appEl=()=>document.getElementById('app');
const MAIN=new Set(['today','review','cards','profile','subjects','settings']);
const MB=1048576,MAX_FILE_MB=50,MAX_TOTAL_MB=150; // plik do 50 MB (bucket „materials”), razem do 150 MB na lekcję; duże pliki backend wysyła do AI raz, przez Files API
const mbTxt=(b,up,ref)=>{const r=(ref==null?b:ref)/MB>=10?1:10;return String((up?Math.ceil:Math.round)(b/MB*r)/r).replace('.',',');}; // „12”, „2,4” — dziesiąte części tylko przy małych plikach; ref: dokładność jak dla drugiej liczby
let started=false,startFn=null;
const ask=o=>E()&&E().ask?E().ask(o):Promise.resolve(window.confirm(o.text||o.title));
const note=t=>{try{sessionStorage.setItem('cf_notice',t);}catch(e){}};

/* ---------- start ---------- */
window.NAUKA_BOOT=async function(start){
  startFn=start;registerViews();
  if(!C.signedIn())return renderAuth();
  C.bindEngine(()=>safeToRerender(),()=>{if(started)E().reload();}); // zmiany z innego urządzenia: przeładowanie bez zmiany ekranu
  const hasCache=await withTimeout(C.loadCache(),3000).catch(()=>false);
  const fresh=!C.hasLocalState(); // nowe urządzenie albo pierwsze logowanie: postępy z konta muszą być, zanim silnik zapyta o poziom i cel
  if(!hasCache||fresh)splash(hasCache?'Wczytuję Twoje postępy…':'Wczytuję Twoje przedmioty…');
  if(!hasCache){try{await withTimeout(C.fetchAll(),30000);}catch(e){if(e&&e.status===401)return renderAuth();return firstRunOffline(e);}}
  try{await withTimeout(C.pull(fresh?()=>true:()=>!started,null),fresh?20000:3000);} // spóźniony pull nie przepada: zmiany czekają i wejdą w bezpiecznym momencie
  catch(e){if(e&&e.status===401)return renderAuth();if(fresh)return syncFailed(e);}
  boot();
  refreshInBackground();
};
function boot(){E().setSubjects(C.toEngine());started=true;startFn();}
function withTimeout(p,ms){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new C.CloudError(0,'timeout','timeout')),ms))]);}
function safeToRerender(){const e=E();return !!e&&MAIN.has(e.view)&&!e.current&&!document.getElementById('sheet')&&!document.querySelector('.lesson.open');}
async function refreshInBackground(){
  try{await C.fetchAll();E().setSubjects(C.toEngine());if(safeToRerender())E().go(E().view);}catch(e){}
  if(C.job()&&!genRun)recover(false);
}
setInterval(()=>{if(started&&C.hasPending()&&safeToRerender())C.applyPending().catch(()=>{});},3000); // zmiany z innego urządzenia, które przyszły w trakcie lekcji
C.on('signedout',()=>{toastSafe('Sesja wygasła — zaloguj się ponownie');setTimeout(()=>location.reload(),1500);});
document.addEventListener('resume',onResume);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')onResume();});
window.addEventListener('online',()=>{if(!started)return;C.pull().catch(()=>{});if(C.job()&&(!genRun||genRun.phase==='offline'))recover(E().view==='cfgen');});
C.on('job',x=>{if(!genRun)return;if(x.state==='offline')genRun.phase='offline';else if(x.state==='running'&&genRun.phase==='offline')genRun.phase='recover';paintGen();});
let lastResume=0;
async function onResume(){
  if(!started||Date.now()-lastResume<5000)return;lastResume=Date.now();
  try{await C.pull();}catch(e){}
  if(C.job()&&(!genRun||genRun.phase==='offline'))recover(E().view==='cfgen');
}
function toastSafe(t,ic){try{E().toast(t,ic||'info');}catch(e){}}

function splash(t){const a=appEl();a.innerHTML='';const w=document.createElement('div');w.className='cfsplash';w.innerHTML=E().fox('idle',150)+'<div class="logo brand">Cramfox<span class="g">.</span></div><div class="s"></div>';$('.s',w).textContent=t;a.appendChild(w);E().liveFoxes(w);}
function firstRunOffline(e){
  const net=!e||e.code==='network'||e.code==='timeout';
  E().renderError({head:'Cramfox',icon:net?'wifi':'alert',title:net?'Potrzebuję internetu przy pierwszym uruchomieniu':'Serwer chwilowo nie odpowiada',
    reason:net?'Na tym urządzeniu nie ma jeszcze Twoich przedmiotów. Pobiorę je raz — potem nauka działa też bez sieci.':'Nie udało się pobrać Twoich przedmiotów. Spróbuj za chwilę.',
    can:net?[['wifi','Włącz Wi-Fi albo dane komórkowe'],['refresh','Spróbuj ponownie']]:[['refresh','Spróbuj ponownie za minutę']],
    actions:[{label:'SPRÓBUJ PONOWNIE',primary:true,go:()=>location.reload()},{label:'Wyloguj',text:true,go:logout}]});
}
function syncFailed(e){
  const net=!e||e.code==='network'||e.code==='timeout';
  E().renderError({head:'Cramfox',icon:net?'wifi':'alert',title:'Nie mogę pobrać Twoich postępów',
    reason:net?'Sprawdź połączenie z internetem. Bez tego zacząłbyś od zera, a to nadpisałoby postępy z konta.':'Serwer chwilowo nie odpowiada. Spróbuj za chwilę.',
    actions:[{label:'SPRÓBUJ PONOWNIE',primary:true,go:()=>location.reload()},{label:'Wyloguj',text:true,go:()=>C.signOut({force:true})}]});
}

/* ---------- logowanie / rejestracja ---------- */
function renderAuth(mode){
  mode=mode||'signup';const a=appEl();a.innerHTML='';
  let notice='';try{notice=sessionStorage.getItem('cf_notice')||'';sessionStorage.removeItem('cf_notice');}catch(e){}
  const sc=document.createElement('div');sc.className='screen active';
  const w=document.createElement('div');w.className='scroll cfauth';
  w.innerHTML=`<div class="cfauth-top"><div class="authfox">${E().fox('idle',132)}</div><div class="logo brand">Cramfox<span class="g">.</span></div>
    <p class="cfauth-lead">Ucz się z własnych notatek. Zdjęcie strony → lekcja, fiszki i quiz.</p></div>
    <div class="cfnotice" id="cf-notice" role="status"></div>
    <div class="cftabs" role="tablist"><button class="cftab" data-m="signup" role="tab">Załóż konto</button><button class="cftab" data-m="signin" role="tab">Zaloguj się</button></div>
    <form class="cfform" novalidate>
      <label class="edlbl" for="cf-email">E-mail</label><input class="cfin" id="cf-email" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" required>
      <label class="edlbl" for="cf-pass">Hasło</label><input class="cfin" id="cf-pass" type="password" autocomplete="new-password" minlength="6" required>
      <label class="cfcheck" id="cf-agebox"><input type="checkbox" id="cf-age"><span>Mam ukończone 16 lat</span></label>
      <button class="linkbtn" type="button" id="cf-privacy">Jak przetwarzamy Twoje dane</button>
      <div class="cferr" id="cf-err" role="alert"></div>
      <button class="pill a-glow" id="cf-go" type="submit"></button>
    </form>`;
  sc.appendChild(w);a.appendChild(sc);E().liveFoxes(w);
  const nb=$('#cf-notice',w);nb.textContent=notice;nb.style.display=notice?'':'none';
  $('#cf-privacy',w).onclick=openPrivacy;
  const set=m=>{mode=m;w.querySelectorAll('.cftab').forEach(t=>{const on=t.dataset.m===m;t.classList.toggle('on',on);t.setAttribute('aria-selected',String(on));});
    $('#cf-agebox',w).style.display=m==='signup'?'':'none';$('#cf-go',w).textContent=m==='signup'?'ZAŁÓŻ KONTO':'ZALOGUJ SIĘ';
    $('#cf-pass',w).setAttribute('autocomplete',m==='signup'?'new-password':'current-password');$('#cf-err',w).textContent='';};
  w.querySelectorAll('.cftab').forEach(t=>t.onclick=()=>set(t.dataset.m));set(mode);
  $('.cfform',w).onsubmit=async ev=>{
    ev.preventDefault();const err=$('#cf-err',w),btn=$('#cf-go',w);if(btn.disabled)return;err.textContent='';
    const email=$('#cf-email',w).value.trim(),pass=$('#cf-pass',w).value;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return err.textContent='Wpisz poprawny adres e-mail.';
    if(pass.length<6)return err.textContent='Hasło musi mieć co najmniej 6 znaków.';
    if(mode==='signup'&&!$('#cf-age',w).checked)return err.textContent='Cramfox jest na razie dla osób od 16 lat — zaznacz potwierdzenie.';
    btn.disabled=true;btn.textContent=mode==='signup'?'ZAKŁADAM KONTO…':'LOGUJĘ…';
    try{if(mode==='signup')await C.signUp(email,pass);else await C.signIn(email,pass);location.reload();}
    catch(e){err.textContent=authMsg(e,mode);btn.disabled=false;btn.textContent=mode==='signup'?'ZAŁÓŻ KONTO':'ZALOGUJ SIĘ';}
  };
}
function authMsg(e,mode){
  const c=String(e.code||''),m=String(e.message||'');
  if(c==='network')return 'Brak połączenia z internetem.';
  if(c==='invalid_credentials'||/invalid login/i.test(m))return 'Zły e-mail albo hasło.';
  if(c==='user_already_exists'||c==='email_exists'||/already registered/i.test(m))return 'To konto już istnieje — zaloguj się.';
  if(c==='weak_password'||/password/i.test(m)&&mode==='signup')return 'Hasło jest za słabe — użyj co najmniej 6 znaków, najlepiej liter i cyfr.';
  if(c==='over_request_rate_limit'||c==='over_email_send_rate_limit'||e.status===429)return 'Za dużo prób — odczekaj chwilę i spróbuj ponownie.';
  if(c==='email_address_invalid'||/email.*invalid/i.test(m))return 'Ten adres e-mail nie jest akceptowany.';
  if(c==='needs_confirm')return 'Konto wymaga potwierdzenia e-maila — ta wersja jeszcze tego nie obsługuje.';
  if(c==='signup_disabled')return 'Rejestracja jest chwilowo wyłączona.';
  if(e.status>=500)return 'Serwer chwilowo nie odpowiada. Spróbuj za chwilę.';
  return 'Nie udało się. Spróbuj ponownie.';
}
function openPrivacy(){
  const sh=E().openSheet('cfpriv',`<div class="shandle"></div><div class="shead"><div class="st2">Twoje dane w Cramfox</div><button class="backbtn sclose" id="cfp-x" aria-label="Zamknij">${E().icon('close',{size:18,stroke:3})}</button></div>
    <ul class="cfdel-list cfpriv-list">
      <li><b>Konto.</b> Adres e-mail i hasło. Logowanie obsługuje Supabase (serwery w UE, Frankfurt).</li>
      <li><b>Materiały.</b> Zdjęcia, pliki i teksty, które dodajesz, są przechowywane na Twoim koncie w Supabase. Dostęp masz tylko Ty.</li>
      <li><b>AI.</b> Żeby zrobić lekcję, materiał trafia przez nasz serwer (Vercel) do modelu Claude firmy Anthropic. Pytasz o zgodę przed pierwszym wysłaniem.</li>
      <li><b>Postępy.</b> XP, serię i wyniki zapisujemy na koncie, żeby działały na kilku urządzeniach.</li>
      <li><b>Usunięcie.</b> Ustawienia → Usuń konto kasuje konto, przedmioty, pliki i postępy.</li>
      <li><b>Czcionki.</b> Pobieramy je z Google Fonts — Google widzi wtedy adres IP urządzenia.</li>
      <li><b>Wiek.</b> Cramfox jest dla osób od 16 lat.</li>
    </ul>
    <button class="pill" id="cfp-ok" data-primary>OK</button>`);
  E().sheetBack();const close=()=>E().closeSheet();
  $('#cfp-x',sh).onclick=close;$('#cfp-ok',sh).onclick=close;const bk=document.getElementById('sheetback');if(bk)bk.onclick=close;
}

/* ---------- hooki silnika ---------- */
window.NAUKA_HOOKS={
  saved:()=>C.dirty(),
  profileSub:()=>esc(C.email()||'Twoje konto'),
  settingsTop:scroll=>settingsAccount(scroll),
  addPhoto:into=>startAdd('photo',into),
  addFile:into=>startAdd('file',into),
  addText:into=>startAdd('text',into)
};

/* ---------- ustawienia: konto ---------- */
function settingsAccount(scroll){
  const eb=document.createElement('div');eb.className='eyebrow sec';eb.textContent='Konto';scroll.appendChild(eb);
  const card=document.createElement('div');card.className='setcard a-up';
  const row=(ic,t,s,id,cls)=>{const r=document.createElement(id?'button':'div');r.className='setrow'+(cls?' '+cls:'');if(id)r.id=id;r.innerHTML=E().icon(ic,{size:20,stroke:2.4})+'<div class="grow"><div class="t"></div><div class="s"></div></div>';$('.t',r).textContent=t;$('.s',r).textContent=s||'';return r;};
  const sep=()=>{const d=document.createElement('div');d.className='setsep';return d;};
  card.appendChild(row('user',C.email()||'Konto',C.syncAvailable()?'postępy zapisują się na koncie':'zalogowano'));card.appendChild(sep());
  const plan=row('bolt','Nowe lekcje','sprawdzam limit…');plan.id='set-plan';card.appendChild(plan);card.appendChild(sep());
  const priv=row('lock','Twoje dane','co przechowujemy i gdzie','set-privacy');priv.onclick=openPrivacy;card.appendChild(priv);card.appendChild(sep());
  const out=row('back','Wyloguj','przedmioty i postępy zostają na koncie','set-logout');out.onclick=logout;card.appendChild(out);card.appendChild(sep());
  const del=row('trash','Usuń konto','konto, przedmioty, materiały i postępy — na zawsze','set-delete','danger');del.onclick=openDeleteSheet;card.appendChild(del);
  scroll.appendChild(card);
  C.me().then(m=>{const s=$('.s',plan);if(!s)return;const lim=+(m.limits&&m.limits.generationsPerMonth)||0,used=Math.min(+(m.usage&&m.usage.generations)||0,lim);
    const trial=m.trialUntil&&new Date(m.trialUntil)>new Date()?Math.max(1,Math.ceil((new Date(m.trialUntil)-new Date())/86400000)):0;
    s.textContent=`${used} z ${lim} w tym miesiącu`+(trial?` · na start większy limit, jeszcze ${trial} ${E().pl(trial,'dzień','dni','dni')}`:' · odnawia się 1. dnia miesiąca');})
    .catch(()=>{const s=$('.s',plan);if(s)s.textContent='limit sprawdzisz po połączeniu z internetem';});
}
let loggingOut=false;
async function logout(){
  if(loggingOut)return;
  if(!await ask({title:'Wylogować się?',text:'Przedmioty i postępy zostają na koncie — zobaczysz je po ponownym zalogowaniu.',ok:'Wyloguj'}))return;
  loggingOut=true;const b=document.getElementById('set-logout');const bs=b&&$('.s',b);if(b)b.disabled=true;if(bs)bs.textContent='zapisuję postępy i wylogowuję…';
  try{await C.signOut();}
  catch(e){loggingOut=false;if(b)b.disabled=false;if(bs)bs.textContent='przedmioty i postępy zostają na koncie';
    if(e.code!=='unsynced')return toastSafe('Nie udało się wylogować — spróbuj ponownie','alert');
    const why=e.data&&e.data.reason==='off'?'Ten serwer jeszcze nie zapisuje postępów na koncie.':'Nie udało się połączyć z serwerem.';
    if(await ask({title:'Postępy nie są zapisane na koncie',text:why+' Postępy z tego urządzenia po wylogowaniu przepadną.',ok:'Wyloguj mimo to',cancel:'Zostaję',danger:true})){loggingOut=true;C.signOut({force:true});}}
}
function openDeleteSheet(){
  const sh=E().openSheet('cfdel',`<div class="shandle"></div><div class="shead"><div class="st2">Usunąć konto?</div><button class="backbtn sclose" id="cfdel-x" aria-label="Zamknij">${E().icon('close',{size:18,stroke:3})}</button></div>
    <p class="sp">Tego nie da się cofnąć. Usuniemy na zawsze:</p>
    <ul class="cfdel-list"><li>konto i adres e-mail</li><li>wszystkie przedmioty i lekcje</li><li>wgrane zdjęcia i pliki</li><li>postępy, serię, gemy i odznaki</li></ul>
    <div class="cferr" id="cfdel-err" role="alert"></div>
    <button class="pill red" id="cfdel-go">USUŃ KONTO NA ZAWSZE</button><button class="pill text" id="cfdel-no" data-primary>Zostawiam konto</button>`);
  E().sheetBack();let busy=false;const close=()=>{if(!busy)E().closeSheet();};
  $('#cfdel-x',sh).onclick=close;$('#cfdel-no',sh).onclick=close;const bk=document.getElementById('sheetback');if(bk)bk.onclick=close;
  $('#cfdel-go',sh).onclick=async()=>{
    const b=$('#cfdel-go',sh),err=$('#cfdel-err',sh);if(busy)return;busy=true;b.disabled=true;b.textContent='USUWAM…';err.textContent='';
    try{await C.deleteAccount();note('Konto zostało usunięte. Dziękujemy, że uczyłeś się z Cramfoxem.');location.reload();}
    catch(e){busy=false;b.disabled=false;b.textContent='USUŃ KONTO NA ZAWSZE';const m=String(e.message||'')+' '+String(e.code||'');
      err.textContent=/active_subscription/.test(m)?'Masz aktywną subskrypcję kupioną poza aplikacją — najpierw ją anuluj, potem usuń konto.'
        :e.code==='network'?'Brak internetu — usunięcie konta wymaga połączenia.'
        :/files_remaining/.test(m)?'Nie udało się usunąć wszystkich plików. Spróbuj ponownie za chwilę.'
        :'Nie udało się usunąć konta. Spróbuj ponownie za chwilę.';}
  };
}

/* ---------- dodawanie materiału ---------- */
let draft=null,lastDraft=null; // {files:[File], text, into, name, hint, stage, warn}
function consent(then){
  const M=E().meta();if(M.aiConsent){then();return;}
  const sh=E().openSheet('cfconsent',`<div class="shandle"></div><div class="shead"><div class="st2">Zanim zaczniemy</div></div>
    <div class="cfconsent-fox">${E().fox('idle',96)}</div>
    <p class="sp">Żeby zrobić z materiału lekcję, Twoje zdjęcia, pliki i teksty trafią przez nasz serwer do modelu AI <b>Claude (Anthropic)</b>. Nie wysyłamy ich nikomu innemu i możesz je usunąć razem z kontem.</p>
    <button class="pill" id="cfc-ok" data-primary>ZGADZAM SIĘ</button><button class="pill text" id="cfc-more">Jak przetwarzamy dane</button><button class="pill text" id="cfc-no">Nie teraz</button>`);
  E().sheetBack();E().liveFoxes(sh);
  $('#cfc-no',sh).onclick=()=>E().closeSheet();$('#cfc-more',sh).onclick=openPrivacy;const bk=document.getElementById('sheetback');if(bk)bk.onclick=()=>E().closeSheet();
  $('#cfc-ok',sh).onclick=()=>{M.aiConsent=E().todayStr();E().saveMeta();E().closeSheet();then();};
}
function pick(kind,onFiles){
  const inp=document.createElement('input');inp.type='file';inp.style.display='none';
  if(kind==='photo'){inp.accept='image/*';inp.setAttribute('capture','environment');}
  else{inp.accept='image/*,application/pdf,.pdf,text/plain,.txt,.md,.pptx,'+C.PPTX_MIME;inp.multiple=true;}
  inp.onchange=()=>{const fs=[...(inp.files||[])];inp.remove();if(fs.length)onFiles(fs);};
  document.body.appendChild(inp);inp.click();
}
function busyGen(){if(genRun||C.job()){toastSafe('Poprzednia lekcja jeszcze się tworzy — poczekaj chwilę','alert');return true;}return false;}
function startAdd(kind,into){
  if(busyGen())return;
  consent(()=>{
    const lv=E().meta().level;draft={files:[],text:'',into:into||null,name:'',hint:'',stage:lv==='podstawowka'?'inne':lv||'inne'};
    if(kind==='text')return openTextSheet(()=>E().go('cfadd'));
    pick(kind,fs=>{addFiles(fs);E().go('cfadd');});
  });
}
function addFiles(fs){
  const warn=[];
  fs.forEach(f=>{const t=C.mimeOf(f);const nm=String(f.name||'');
    const old=(nm.match(/\.(docx?|ppt|xlsx?|odt|pages|key)$/i)||[])[1]; // formaty, których AI nie czyta — z podpowiedzią, jak je zapisać
    if(old){const e=old.toLowerCase();toastSafe(e==='ppt'||e==='key'?'Prezentacja w starym formacie albo Keynote — zapisz jako PPTX lub PDF.':/^doc/.test(e)?'Dokument Word: zapisz jako PDF.':/^xls/.test(e)?'Arkusz kalkulacyjny: zapisz jako PDF.':'Ten dokument zapisz jako PDF.','alert');return;}
    if(!(/^image\//.test(t)||C.OK_MIME.test(t))){toastSafe('Nieobsługiwany format: '+(f.name||t||'plik'),'alert');return;}
    if(!/^image\//.test(t)&&(+f.size||0)>MAX_FILE_MB*MB){ // zdjęcia zmniejszamy później, więc ich nie odrzucamy po surowym rozmiarze
      const m=`„${String(f.name||'plik').slice(0,40)}” ma ${mbTxt(f.size,true)} MB — maksymalnie ${MAX_FILE_MB} MB na plik. `+(t===C.PPTX_MIME?'Prezentacje z filmami bywają duże — usuń filmy albo zapisz jako PDF.':'Podziel go na mniejsze części.');
      toastSafe(m,'alert');warn.push(m);return;}
    draft.files.push(f);});
  draft.warn=warn.join(' '); // zostaje też pod materiałem — toast znika po chwili
}
function openTextSheet(after){
  const sh=E().openSheet('cftext',`<div class="shandle"></div><div class="shead"><div class="st2">Wklej tekst</div><button class="backbtn sclose" id="cft-x" aria-label="Zamknij">${E().icon('close',{size:18,stroke:3})}</button></div>
    <textarea class="edta cftext" id="cft-in" maxlength="200000" placeholder="Notatki, konspekt, zagadnienia na sprawdzian…"></textarea>
    <div class="cferr" id="cft-err"></div><button class="pill" id="cft-ok" data-primary>DALEJ</button>`);
  E().sheetBack();const ta=$('#cft-in',sh);ta.value=draft.text||'';
  $('#cft-x',sh).onclick=()=>E().closeSheet();
  $('#cft-ok',sh).onclick=()=>{const v=ta.value.trim();if(v.length<40){$('#cft-err',sh).textContent='Wklej trochę więcej — przynajmniej kilka zdań.';return;}draft.text=v;E().closeSheet();after();};
}
function footer(scroll,cls){const foot=document.createElement('div');foot.className='cfadd-foot'+(cls?' '+cls:'');(scroll.parentNode||scroll).appendChild(foot);return foot;} // stopka w .screen, nie w przewijanej treści
async function leaveAdd(){
  if(draft&&(draft.text||draft.files.length)&&!await ask({title:'Porzucić materiał?',text:'Dodane zdjęcia, pliki i tekst nie zostaną zapisane.',ok:'Porzuć',cancel:'Zostaję',danger:true}))return;
  draft=null;E().go('today');
}
function renderAdd(){
  if(!draft)return E().go('today');
  const scroll=E().shell(null,{cls:'cfadd',title:'Dodaj materiał',pills:false,back:leaveAdd});
  const box=document.createElement('div');box.className='cfadd-body';scroll.appendChild(box);
  const eb=(t)=>{const d=document.createElement('div');d.className='eyebrow sec';d.textContent=t;return d;};
  box.appendChild(eb('Materiał'));
  const grid=document.createElement('div');grid.className='cfthumbs';box.appendChild(grid);
  draft.files.forEach((f,i)=>{const t=document.createElement('div');t.className='cfthumb a-pop';
    if(/^image\//.test(C.mimeOf(f))){const img=document.createElement('img');img.alt='';const u=URL.createObjectURL(f);img.onload=img.onerror=()=>URL.revokeObjectURL(u);img.src=u;t.appendChild(img);}
    else{t.innerHTML=E().icon(C.mimeOf(f)===C.PPTX_MIME?'slides':'file',{size:26})+'<span></span>';$('span',t).textContent=(f.name||'plik').slice(0,24);}
    const x=document.createElement('button');x.className='cfthumb-x';x.setAttribute('aria-label','Usuń');x.innerHTML=E().icon('close',{size:14,stroke:3.4});x.onclick=()=>{draft.files.splice(i,1);renderAdd();};t.appendChild(x);grid.appendChild(t);});
  if(draft.text){const t=document.createElement('button');t.className='cfthumb text a-pop';t.innerHTML=E().icon('list',{size:22})+'<span></span>';$('span',t).textContent=draft.text.slice(0,60)+'…';t.onclick=()=>openTextSheet(renderAdd);grid.appendChild(t);}
  const more=document.createElement('div');more.className='cfmore';
  [['camera','+ Zdjęcie','photo'],['upload','+ Plik','file'],['list',draft.text?'Edytuj tekst':'+ Tekst','text']].forEach(([ic,l,k])=>{const b=document.createElement('button');b.className='chip';b.innerHTML=E().icon(ic,{size:15})+'<span></span>';$('span',b).textContent=l;
    b.onclick=()=>k==='text'?openTextSheet(renderAdd):pick(k,fs=>{addFiles(fs);renderAdd();});more.appendChild(b);});
  box.appendChild(more);
  box.appendChild(eb('Gdzie dodać?'));
  const list=document.createElement('div');list.className='cfwhere';box.appendChild(list);
  const subs=C.pickable();if(draft.into&&!subs.some(s=>s.id===draft.into))draft.into=null;
  const opt=(id,t,s)=>{const b=document.createElement('button');b.className='obopt'+(draft.into===id?' on':'');b.setAttribute('aria-pressed',String(draft.into===id));
    b.innerHTML='<div class="grow"><div class="t"></div><div class="s"></div></div><span class="ck">'+(draft.into===id?E().icon('check',{size:16,stroke:4}):'')+'</span>';$('.t',b).textContent=t;$('.s',b).textContent=s;
    b.onclick=()=>{draft.into=id;renderAdd();};return b;};
  subs.forEach(s=>list.appendChild(opt(s.id,s.name,s.topics?'jako nowe poziomy na końcu ścieżki':'pusty przedmiot')));
  list.appendChild(opt(null,'Nowy przedmiot','nazwę podpowie AI, możesz ją zmienić'));
  if(draft.into===null){const nm=document.createElement('input');nm.className='cfin';nm.placeholder='Nazwa (opcjonalnie), np. Biologia';nm.maxLength=60;nm.value=draft.name||'';nm.oninput=()=>{draft.name=nm.value;};box.appendChild(nm);}
  box.appendChild(eb('Na czym się skupić? (opcjonalnie)'));
  const hint=document.createElement('input');hint.className='cfin';hint.placeholder='np. tylko rozdział o fotosyntezie';hint.maxLength=300;hint.value=draft.hint||'';hint.oninput=()=>{draft.hint=hint.value;};box.appendChild(hint);
  const err=document.createElement('div');err.className='cferr';err.id='cfadd-err';err.textContent=draft.warn||'';draft.warn='';box.appendChild(err);
  const go=document.createElement('button');go.className='pill a-glow';go.id='cfadd-go';go.textContent='TWÓRZ LEKCJĘ';footer(scroll).appendChild(go);
  go.onclick=()=>{if(!draft.files.length&&!draft.text){err.textContent='Dodaj zdjęcie, plik albo tekst.';return;}if(genRun||C.job()){err.textContent='Poprzednia lekcja jeszcze się tworzy — poczekaj chwilę.';return;}runGeneration();};
}

/* ---------- generowanie ---------- */
let genRun=null,recovering=false; // genRun: {subjectId, created, uploaded:[{id,path}], phase, done, total (pliki), bytes, sent (bajty), startedAt, limits}
const STEPS=['Czytam materiał','Wyciągam najważniejsze pojęcia','Układam poziomy','Piszę pytania i fiszki','Dodaję zadania i sprawdzam pytania'];
async function runGeneration(){
  const d=draft;draft=null;lastDraft=d;
  const g=genRun={phase:'prep',done:0,total:d.files.length,startedAt:Date.now(),subjectId:d.into,created:null,uploaded:[],limits:null};E().go('cfgen');
  try{
    let m=null;try{m=await C.me();}catch(e){if(e.status===401)throw e;} // bez /api/me limity sprawdzi serwer
    const lim=g.limits=m&&m.limits||null;
    if(m&&lim&&m.usage&&(+m.usage.generations||0)>=+lim.generationsPerMonth)throw new C.CloudError(402,'limit_reached','',{used:+m.usage.generations,limit:+lim.generationsPerMonth});
    if(lim&&d.files.length>lim.filesPerGeneration)throw new C.CloudError(400,'too_many_files','',{max:lim.filesPerGeneration});
    const files=await C.prepareFiles(d.files); // zdjęcia → JPEG 1568 px; zły format wychodzi tu, zanim cokolwiek zapiszemy
    const maxMb=lim&&+lim.maxFileMb||MAX_FILE_MB;
    if(files.some(f=>f.size>maxMb*MB))throw new C.CloudError(400,'file_too_big','',{maxMb});
    const bytes=files.reduce((a,f)=>a+f.size,0);
    if(bytes+(d.text||'').length>MAX_TOTAL_MB*MB)throw new C.CloudError(400,'too_much_material','',{maxMb:MAX_TOTAL_MB});
    if(!g.subjectId){const s=await C.createSubject({name:d.name.trim()||'Nowy przedmiot',stage:d.stage,color:C.pickable().length%C.PALETTE.length});g.subjectId=g.created=s.id;}
    g.phase='upload';g.bytes=bytes;g.sent=0;paintGen();
    const ids=[];let before=0;
    for(const f of files){const up=await C.uploadMaterial(f,s=>{g.sent=before+Math.min(+s||0,f.size);paintGen();}); // postęp w bajtach przez wszystkie pliki
      before+=f.size;g.sent=before;g.uploaded.push(up);ids.push(up.id);g.done++;paintGen();}
    g.phase='ai';g.aiAt=Date.now();paintGen();
    const r=await C.generate({subjectId:g.subjectId,materialIds:ids,text:d.text,hint:d.hint.trim(),stage:d.stage,subjectName:d.into===null?d.name.trim():undefined,created:g.created,materials:g.uploaded});
    finishGen(r.topic,r.demo);
  }catch(e){
    if(g.phase==='ai'&&(e.code==='network'||e.code==='network_after_post')&&C.job()){recover(true);return;} // połączenie zerwane po wysłaniu: serwer i tak kończy — sprawdzamy w tabeli generations
    if(g.created||g.uploaded.length)C.discard({subjectId:g.created,materials:g.uploaded}).catch(()=>{}); // generowanie nie ruszyło albo zakończyło się błędem — bez pustych przedmiotów i osieroconych plików
    failGen(e);
  }
}
function finishGen(topic,demo){
  genRun=null;lastDraft=null;
  E().setSubjects(C.toEngine());
  if(E().view==='cfgen'){readyState={sid:topic.subject_id,topicId:topic.id,demo};E().go('cfready');}
  else{toastSafe('Lekcja gotowa: '+String(topic.name||'nowy materiał'),'check');if(safeToRerender())E().go(E().view);}
}
const COUNTS=' Ta próba liczy się do miesięcznego limitu.';
function failGen(e){
  const was=genRun;genRun=null;
  if(E().view!=='cfgen'){toastSafe('Nie udało się utworzyć lekcji — spróbuj ponownie','alert');return;}
  const d=e.data||{},c=e.code,lim=(was&&was.limits)||{};const used=+d.used||0;
  const fname=d.name?`„${esc(String(d.name).slice(0,40))}”: `:''; // serwer podaje plik przy błędach PPTX, typu i rozmiaru
  const withName=s=>fname?fname+s.charAt(0).toLowerCase()+s.slice(1):s;
  const charged=!!d.generationId; // błąd po naliczeniu ma generationId; odrzucenie przed naliczeniem — nie
  const map={
    limit_reached:used>=1999999?['Serwer ma dziś bardzo dużo pracy','Nowe lekcje będzie można tworzyć jutro. Twój limit się nie zmienił.']
      :used>=999999?['Na dziś wystarczy','Dzienny limit nowych lekcji jest wykorzystany. Spróbuj jutro.']
      :['Limit na ten miesiąc wykorzystany',`Wykorzystano ${Math.min(used,+d.limit||used)} z ${+d.limit||0} lekcji w tym miesiącu. Limit odnowi się 1. dnia miesiąca.`],
    too_many_files:['Za dużo plików naraz',`Maksymalnie ${+d.max||+lim.filesPerGeneration||5} plików w jednej lekcji. Podziel materiał na dwie części.`],
    file_too_big:['Plik jest za duży',withName(`Maksymalny rozmiar pliku to ${+d.maxMb||+lim.maxFileMb||MAX_FILE_MB} MB. Podziel PDF na mniejsze części albo wgraj zdjęcia stron.`)],
    too_much_material:['Za dużo materiału naraz',`Pliki w jednej lekcji mogą mieć razem do ${+d.maxMb||MAX_TOTAL_MB} MB. Podziel materiał na mniejsze części — np. po jednym rozdziale na lekcję.`],
    upload_failed:['Nie udało się wysłać pliku','Serwer nie przyjął pliku. Limit się nie zmienił — spróbuj ponownie za chwilę.'],
    bad_materials:['Nie mogę odczytać materiału','Któryś plik jest uszkodzony albo w nieobsługiwanym formacie.'],
    no_input:['Brak materiału','Dodaj zdjęcie, plik albo tekst.'],
    bad_type:['Nieobsługiwany format',(d.name?`„${esc(String(d.name).slice(0,40))}”: `:'')+'wgraj zdjęcia (JPG, PNG), PDF, prezentację PPTX albo plik tekstowy.'],
    bad_pptx:['Nie mogę otworzyć prezentacji',withName('Plik jest uszkodzony albo za duży. Zapisz go ponownie jako PPTX albo PDF. Limit się nie zmienił.')], // błędy PPTX wychodzą przed naliczeniem limitu
    pptx_protected:['Prezentacja jest zabezpieczona albo w starym formacie',withName('Usuń hasło i zapisz jako PPTX albo PDF. Limit się nie zmienił.')],
    pptx_empty:['Prezentacja nie ma treści',withName('Nie znalazłem tekstu ani obrazów na slajdach. Limit się nie zmienił.')],
    download_failed:['Nie udało się odczytać plików','Serwer nie pobrał materiału. Limit się nie zmienił — spróbuj ponownie za chwilę.'], // przed naliczeniem
    reserve_failed:['Serwer chwilowo nie działa','Limit się nie zmienił — spróbuj za kilka minut.'], // naliczenie się nie udało
    generation_failed:['AI nie dało rady z tym materiałem','Spróbuj jeszcze raz albo dodaj wyraźniejsze zdjęcia.'+COUNTS],
    refusal:['AI nie przetworzy tego materiału','Spróbuj z innym materiałem.'+COUNTS],
    invalid_output:['Nie dało się ułożyć lekcji','Spróbuj z mniejszą ilością materiału albo wyraźniejszymi zdjęciami.'+COUNTS],
    api:['Serwer AI jest przeciążony','Spróbuj za kilka minut.'+COUNTS],
    not_started:['Lekcja nie zaczęła się tworzyć','Połączenie przerwało się przed wysłaniem materiału. Limit się nie zmienił — spróbuj ponownie.'],
    too_long:['Za dużo materiału na jedną lekcję','Plik ma za dużo stron albo tekstu naraz. Podziel go na mniejsze części, np. po jednym rozdziale.'+(charged?COUNTS:' Limit się nie zmienił.')],
    lost:['Generowanie się nie dokończyło','Serwer przerwał pracę. Spróbuj jeszcze raz z mniejszą ilością materiału.'+COUNTS],
    network:['Brak połączenia','Tworzenie lekcji wymaga internetu. Materiał nie został wysłany.'],
    timeout:['Brak połączenia','Serwer nie odpowiada. Materiał nie został wysłany.'],
    not_found:['Nie ma już tego przedmiotu','Wybierz inny przedmiot i spróbuj ponownie.'],
    unauthorized:['Sesja wygasła','Zaloguj się ponownie.'],
    no_session:['Sesja wygasła','Zaloguj się ponownie.'],
    no_config:['Serwer chwilowo nie działa','Spróbuj za kilka minut.']};
  if(c==='api'&&/^AI: 4(?!29)\d\d/.test(String(e.message||'')))map.api=['Tego materiału nie da się przetworzyć','Plik jest za duży albo zabezpieczony (np. PDF ponad 600 stron albo z hasłem). Podziel materiał na mniejsze części.'+COUNTS];
  if(c==='bad_type'&&d.heic)map.bad_type=['Zdjęcie w formacie HEIC','Ten iPhone nie przerobi go w aplikacji. Wybierz zdjęcie z Biblioteki zdjęć (zamiast z Plików) albo zapisz je jako JPG.'];
  const [title,reason]=map[c]||(e.status>=500?['Coś poszło nie tak po stronie serwera','Nie udało się utworzyć lekcji.'+COUNTS]:['Coś poszło nie tak','Nie udało się utworzyć lekcji. Spróbuj ponownie.']);
  const back={label:'Wróć',text:true,go:()=>E().go('today')};
  const retry=lastDraft&&c!=='limit_reached'&&c!=='unauthorized'&&c!=='no_session'?[{label:'WRÓĆ DO MATERIAŁU',primary:true,go:()=>{draft=lastDraft;lastDraft=null;E().go('cfadd');}}]:[];
  E().renderError({head:'Dodaj materiał',icon:/network|timeout/.test(c)?'wifi':'alert',title,reason,actions:retry.concat([retry.length?back:{...back,label:'WRÓĆ',primary:true,text:false}]),back:()=>E().go('today')});
}
async function recover(inView){
  const j=C.job();if(!j||recovering)return;recovering=true;
  if(!genRun)genRun={phase:'recover',done:0,total:0,startedAt:j.startedAt||Date.now(),subjectId:j.subjectId,created:null,uploaded:[]};
  genRun.phase='recover';paintGen();
  try{const t=await C.recoverJob();recovering=false;
    if(t)finishGen(t,false);
    else{genRun=null;if(E().view==='cfgen'){try{await C.fetchAll();}catch(e){}E().setSubjects(C.toEngine());E().go('today');}}}
  catch(e){recovering=false;
    if(e.code==='network'){if(genRun){genRun.phase='offline';paintGen();}return;} // dziennik zostaje — sprawdzimy, gdy wróci internet
    if(/^(generation_failed|lost|not_started)$/.test(e.code))C.discard({subjectId:j.created,materials:j.materials||[]}).catch(()=>{}); // pusty nowy przedmiot i pliki z nieudanej próby
    failGen(e);}
}
function renderGen(){
  const scroll=E().shell(null,{cls:'cfgen',title:'Tworzę lekcję',pills:false,back:()=>E().go('today')});
  const box=document.createElement('div');box.className='cfgen-body';box.id='cfgen-root';
  box.innerHTML=`<div class="cfgen-fox">${E().fox('think',150)}</div><h1 class="cfgen-t">Buduję Twoją lekcję</h1><p class="cfgen-s" id="cfgen-s"></p>
    <div class="bar cfgen-bar"><i id="cfgen-bar" style="width:4%"></i></div><div class="cfsteps" id="cfgen-steps"></div>
    <p class="cfgen-note">To trwa ok. 2 minuty. Możesz wyjść — dokończę w tle i dam znać.</p>`;
  scroll.appendChild(box);E().liveFoxes(box);
  const bg=document.createElement('button');bg.className='pill ghost';bg.textContent='DZIAŁAJ W TLE';bg.onclick=()=>E().go('today');footer(scroll).appendChild(bg);
  if(!genRun&&!C.job())return E().go('today');
  paintGen();
  const tick=setInterval(()=>{if(!document.getElementById('cfgen-root'))return clearInterval(tick);paintGen();},900);
}
function paintGen(){
  const root=document.getElementById('cfgen-root');if(!root||!genRun)return;
  const g=genRun,s=$('#cfgen-s',root),bar=$('#cfgen-bar',root),st=$('#cfgen-steps',root);
  let pct=4,active=0;
  if(g.phase==='prep'){s.textContent='Przygotowuję materiał…';}
  else if(g.phase==='upload'){
    if(g.bytes){const sent=Math.min(g.sent||0,g.bytes);s.textContent=`${g.total===1?'Wysyłam plik':'Wysyłam pliki'}: ${mbTxt(sent,false,g.bytes)} z ${mbTxt(g.bytes)} MB`;pct=4+Math.round(16*sent/g.bytes);}
    else{s.textContent=`Wysyłam pliki ${g.done} z ${g.total}`;pct=4+Math.round(16*(g.total?g.done/g.total:1));}}
  else{const t=(Date.now()-(g.aiAt||g.startedAt))/1000;pct=20+Math.round(75*(1-Math.exp(-t/60)));active=Math.min(STEPS.length-1,Math.floor(t/24));
    s.textContent=g.phase==='offline'?'Brak internetu. Lekcja mogła już powstać — sprawdzę, gdy wróci połączenie. Nie dodawaj materiału ponownie.':g.phase==='recover'?'Sprawdzam, czy lekcja powstała…':'AI czyta i układa poziomy';}
  bar.style.width=pct+'%';
  const on=g.phase==='ai'||g.phase==='recover'||g.phase==='offline'; // nowy etap generowania = lis wpada na pomysł (żarówka)
  if(on&&g.lastAct!=null&&active>g.lastAct){const sv=root.querySelector('svg.fx');if(sv&&E().foxAct)E().foxAct(sv,'idea');}if(on)g.lastAct=active;
  st.innerHTML='';STEPS.forEach((t,i)=>{const r=document.createElement('div');const on=g.phase==='ai'||g.phase==='recover'||g.phase==='offline';r.className='cfstep'+(on&&i<active?' done':on&&i===active?' cur':'');
    r.innerHTML=(on&&i<active?E().icon('check',{size:16,stroke:3.4}):'<i></i>')+'<span></span>';$('span',r).textContent=t;st.appendChild(r);});
}

/* ---------- przedmiot gotowy ---------- */
let readyState=null;
function renderReady(){
  const rs=readyState;const s=rs&&E().subjects().find(x=>x.id===rs.sid);if(!s)return E().go('today');
  const scroll=E().shell(null,{cls:'cfready',title:'Lekcja gotowa',pills:false,back:()=>E().go('today')});
  const lv=s.levels.filter(l=>l.topicId===rs.topicId);
  const box=document.createElement('div');box.className='cfready-body';
  box.innerHTML=`<div class="lcfox">${E().fox('happy',140)}</div><h1 class="cfgen-t">Gotowe!</h1>${rs.demo?'<div class="cferr">Serwer działa w trybie demo — to przykładowa lekcja, nie z Twojego materiału.</div>':''}
    <div class="eyebrow sec">Nazwa przedmiotu</div><input class="cfin" id="cfr-name" maxlength="60">
    <div class="eyebrow sec">Kolor</div><div class="cfcolors" id="cfr-col"></div>
    <div class="eyebrow sec">Nowe poziomy</div><div class="setcard" id="cfr-lv"></div>`;
  scroll.appendChild(box);E().liveFoxes(box);
  const nm=$('#cfr-name',box);nm.value=C.subjectName(s.id)||'';
  const cur=Math.max(0,C.PALETTE.findIndex(p=>p[0]===s.accent));
  C.PALETTE.forEach((p,i)=>{const b=document.createElement('button');b.className='cfcolor'+(i===cur?' on':'');b.style.background=p[0];b.setAttribute('aria-label','Kolor '+(i+1));
    b.onclick=()=>{box.querySelectorAll('.cfcolor').forEach(x=>x.classList.remove('on'));b.classList.add('on');save({color:i});};$('#cfr-col',box).appendChild(b);});
  lv.forEach((l,i)=>{const r=document.createElement('div');r.className='setrow';r.innerHTML='<div class="num">'+(i+1)+'</div><div class="grow"><div class="t"></div><div class="s"></div></div>';
    $('.t',r).innerHTML=l.title;$('.s',r).textContent=`${l.feed.length} ${E().pl(l.feed.length,'dawka','dawki','dawek')} · ${l.flashcards.length} ${E().pl(l.flashcards.length,'fiszka','fiszki','fiszek')} · ${l.quiz.length} ${E().pl(l.quiz.length,'pytanie','pytania','pytań')}`;$('#cfr-lv',box).appendChild(r);});
  let t=null;nm.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{const v=nm.value.trim();if(v)save({name:v});},700);};
  async function save(p){try{await C.updateSubject(s.id,p);E().setSubjects(C.toEngine());}catch(e){toastSafe('Nie udało się zapisać zmiany — sprawdź połączenie','wifi');}}
  const foot=footer(scroll,'col');
  const go=document.createElement('button');go.className='pill a-glow';go.textContent='ZACZNIJ NAUKĘ';go.onclick=()=>E().openSubject(s.id);
  const test=document.createElement('button');test.className='pill text';test.textContent='Mam z tego sprawdzian';test.onclick=()=>E().openTestSheet(s.id);
  foot.appendChild(go);foot.appendChild(test);
}

function registerViews(){const R=E().registerView;R('cfadd',renderAdd);R('cfgen',renderGen);R('cfready',renderReady);}
})();
