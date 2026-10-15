/* ============================================================ CRAMFOX — CHMURA: UI
   Start z konta (NAUKA_BOOT), logowanie / rejestracja (16+), karta „Konto” w ustawieniach (wyloguj, usuń konto, Twoje dane, zgoda na AI),
   „Pomoc i informacje” (kontakt, polityka prywatności, regulamin, licencje — adresy z cloud-config.js, puste = ukryte),
   dodawanie materiału (zdjęcie / plik / tekst) → zgoda na AI → „Gdzie dodać?” (z limitem widocznym przed wysyłką) →
   generowanie (~2 min, można w tle; wiersz „Tworzę lekcję…” na Dziś) → przedmiot gotowy → poziom 1.
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
const L=C.links||{}; // {privacy, terms, email} — puste = wiersze i linki ukryte
const CONSENT_V=1; // wersja tekstu zgody na AI (META.aiConsentV; brak = 1, więc stare zgody zostają ważne). Tekst, który wymaga ponownej zgody (np. nagrania) → podbić.
const MONTHS=['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];

/* ---------- start ---------- */
const authGone=e=>!C.signedIn()||!!(e&&e.status===401); // sesja odwołana (odświeżenie 400/401) albo serwer nie przyjmuje tokenu → logowanie, bez ekranu „serwer nie odpowiada”
window.NAUKA_BOOT=async function(start){
  startFn=start;registerViews();
  if(!C.signedIn())return renderAuth();
  C.bindEngine(()=>safeToRerender(),()=>{if(started)E().reload();}); // zmiany z innego urządzenia: przeładowanie bez zmiany ekranu
  const hasCache=await withTimeout(C.loadCache(),3000).catch(()=>false);
  const fresh=!C.hasLocalState(); // nowe urządzenie albo pierwsze logowanie: postępy z konta muszą być, zanim silnik zapyta o poziom i cel
  if(!hasCache||fresh)splash(hasCache?'Wczytuję Twoje postępy…':'Wczytuję Twoje przedmioty…');
  if(!hasCache){try{await withTimeout(C.fetchAll(),30000);}catch(e){if(authGone(e))return renderAuth();return firstRunOffline(e);}}
  try{await withTimeout(C.pull(fresh?()=>true:()=>!started,null),fresh?20000:3000);} // spóźniony pull nie przepada: zmiany czekają i wejdą w bezpiecznym momencie
  catch(e){if(authGone(e))return renderAuth();if(e&&e.code==='storage_full')return storageFailed();if(fresh)return syncFailed(e);}
  if(!C.signedIn())return renderAuth();
  boot();
  refreshInBackground();
};
function boot(){E().setSubjects(C.toEngine());started=true;startFn();if(C.storeFull())storeBar(true);}
function withTimeout(p,ms){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new C.CloudError(0,'timeout','timeout')),ms))]);}
function safeToRerender(){const e=E();return !!e&&MAIN.has(e.view)&&!e.current&&!document.getElementById('sheet')&&!document.querySelector('.lesson.open');}
async function refreshInBackground(){
  try{await C.fetchAll();E().setSubjects(C.toEngine());if(safeToRerender())E().go(E().view);}catch(e){}
  if(C.job()&&!genRun)recover(false);
  refreshQuota(); // limit znany, zanim ktoś stuknie „Zrób zdjęcie” (aparat musi się otworzyć w tym samym dotknięciu)
}
setInterval(()=>{if(started&&C.hasPending()&&safeToRerender())C.applyPending().catch(()=>{});},3000); // zmiany z innego urządzenia, które przyszły w trakcie lekcji
C.on('signedout',()=>{note('Sesja wygasła — zaloguj się ponownie.');if(started)location.reload();}); // przed startem NAUKA_BOOT sam pokaże logowanie (zakładka „Zaloguj się”, dane lokalne zostają)
C.on('store',x=>storeBar(!!(x&&x.full)));
document.addEventListener('resume',onResume);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')onResume();});
window.addEventListener('online',()=>{if(!started)return;C.pull().catch(()=>{});if(C.job()&&(!genRun||genRun.phase==='offline'))recover(E().view==='cfgen');});
C.on('job',x=>{if(!genRun)return;if(x.state==='offline')genRun.phase='offline';else if(x.state==='running'&&genRun.phase==='offline')genRun.phase='recover';paintGen();});
let lastResume=0,resumeP=null;
function onResume(){ // powrót z tła: najpierw zmiany z chmury; silnik czeka na tę obietnicę przed zmianą dnia (hook „resume” → zamrożenia na aktualnej serii)
  if(!started)return Promise.resolve();
  if(resumeP&&Date.now()-lastResume<5000)return resumeP;lastResume=Date.now();
  resumeP=(async()=>{
    try{await C.pull();}catch(e){}
    refreshQuota();
    if(C.job()&&(!genRun||genRun.phase==='offline'))recover(E().view==='cfgen');
  })();
  return resumeP;
}
function toastSafe(t,ic){try{E().toast(t,ic||'info');}catch(e){}}
function actionToast(t,ic,fn){ // klikalny komunikat o zdarzeniu w tle: kolejka silnika (notify — czeka, gdy trwa lekcja albo jest otwarty arkusz), toast z akcją albo własny element w tym samym stylu
  const e=E();if(!e)return;
  if(typeof e.notify==='function'){try{e.notify(t,ic,undefined,{go:fn});return;}catch(x){}}
  if(typeof e.toast==='function'&&e.toast.length>=4){try{e.toast(t,ic,undefined,{go:fn});return;}catch(x){}}
  const a=appEl();if(!a)return;const old=document.getElementById('cf-toast');if(old)old.remove();
  const b=document.createElement('div');b.id='cf-toast';b.className='toast show';b.setAttribute('role','button');b.tabIndex=0;
  b.style.pointerEvents='auto';b.style.cursor='pointer';b.style.zIndex='95';
  b.innerHTML=e.icon(ic,{size:16,cls:ic==='alert'?'ic-red':'ic-acid'});const s=document.createElement('span');s.textContent=t;b.appendChild(s);
  const go=()=>{b.remove();fn();};b.onclick=go;b.onkeydown=k=>{if(k.key==='Enter'||k.key===' '){k.preventDefault();go();}};
  a.appendChild(b);setTimeout(()=>{b.classList.remove('show');setTimeout(()=>b.remove(),400);},6000);
}
function storeBar(on){ // pełna pamięć aplikacji: postępy z konta nie zapisują się tu (i nic nie wysyłamy) — jak pasek pamięci silnika: jedna linia, „Więcej”, #app pod paskiem
  let b=document.getElementById('cf-storebar');const lay=()=>{try{E().barLayout();}catch(e){}};
  if(!on){if(b){b.remove();lay();}return;}
  if(b)return;
  b=document.createElement('div');b.id='cf-storebar';b.className='netbar storebar on a-up';b.setAttribute('role','status');
  b.innerHTML=E().icon('alert',{size:16})+'<span class="grow"><b>Postępy się nie zapisują</b><span class="sbwhy"></span></span>';
  $('.sbwhy',b).textContent='Pamięć aplikacji na tym urządzeniu jest pełna, więc nie zapisuję tu postępów z konta i nic nie wysyłam. Na koncie są bezpieczne. Uruchom aplikację ponownie — jeśli to nie pomoże, wyloguj się i zaloguj jeszcze raz.';
  const more=document.createElement('button');more.type='button';more.className='sbm';more.textContent='Więcej';more.setAttribute('aria-expanded','false');
  more.onclick=()=>{const o=b.classList.toggle('open');more.textContent=o?'Mniej':'Więcej';more.setAttribute('aria-expanded',String(o));lay();};
  const x=document.createElement('button');x.type='button';x.className='sbx';x.setAttribute('aria-label','Zamknij ostrzeżenie');x.innerHTML=E().icon('close',{size:14,stroke:3});x.onclick=()=>{b.remove();lay();};
  b.appendChild(more);b.appendChild(x);
  const nb=document.getElementById('netbar');if(nb&&nb.parentNode)nb.after(b);else document.body.insertBefore(b,document.body.firstChild); // po #netbar: offline ma pierwszeństwo (styles.css)
  lay();
}

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
    reason:net?'Sprawdź połączenie z internetem. Bez tego apka zaczęłaby od zera, a to nadpisałoby postępy z konta.':'Serwer chwilowo nie odpowiada. Spróbuj za chwilę.',
    actions:[{label:'SPRÓBUJ PONOWNIE',primary:true,go:()=>location.reload()},{label:'Wyloguj',text:true,go:()=>C.signOut({force:true})}]});
}
function storageFailed(){ // świeże urządzenie, a postępy z konta się nie zapisały: start od zera nadpisałby konto — blokada zamiast tego
  E().renderError({head:'Cramfox',icon:'alert',title:'Brak miejsca na Twoje postępy',
    reason:'Pamięć aplikacji na tym urządzeniu jest pełna, więc nie mogę zapisać tu postępów z konta. Na koncie są bezpieczne — nic nie zostało nadpisane.',
    can:[['refresh','Uruchom aplikację ponownie'],['user','Jeśli to nie pomoże, wyloguj się i zaloguj jeszcze raz']],
    actions:[{label:'SPRÓBUJ PONOWNIE',primary:true,go:()=>location.reload()},{label:'Wyloguj',text:true,go:()=>C.signOut({force:true})}]});
}

/* ---------- linki: polityka, regulamin, kontakt (adresy z cloud-config.js; Capacitor oddaje je Safari / Poczcie) ---------- */
function openUrl(u){if(!u)return;try{const w=window.open(u,'_blank');if(w)try{w.opener=null;}catch(e){}}catch(e){}}
function mailTo(subject){if(!L.email)return;const a=document.createElement('a');a.href='mailto:'+L.email+'?subject='+encodeURIComponent(subject||'Cramfox');a.rel='noopener';document.body.appendChild(a);a.click();a.remove();}
function legalLinks(){ // [etykieta, akcja] — tylko skonfigurowane
  const out=[];
  if(L.privacy)out.push(['lock','Polityka prywatności',()=>openUrl(L.privacy)]);
  if(L.terms)out.push(['file','Regulamin',()=>openUrl(L.terms)]);
  if(L.email)out.push(['question','Pomoc i kontakt',()=>mailTo('Cramfox — pomoc')]);
  return out;
}

/* ---------- logowanie / rejestracja ---------- */
function renderAuth(mode){
  mode=mode||(C.knownDevice()?'signin':'signup'); // ktoś już tu się logował (albo sesja wygasła) → „Zaloguj się”
  const a=appEl();a.innerHTML='';
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
      <button class="linkbtn" type="button" id="cf-show" aria-controls="cf-pass" aria-pressed="false">Pokaż hasło</button>
      <label class="cfcheck" id="cf-agebox"><input type="checkbox" id="cf-age"><span>Mam ukończone 16 lat</span></label>
      <button class="linkbtn" type="button" id="cf-privacy">Jak przetwarzamy Twoje dane</button>
      <div class="cferr" id="cf-err" role="alert"></div>
      <button class="linkbtn" type="button" id="cf-forgot" style="display:none">Nie pamiętasz hasła? Napisz do nas</button>
      <button class="pill a-glow" id="cf-go" type="submit"></button>
    </form>
    <div class="cfmore" id="cf-legal"></div>`;
  sc.appendChild(w);a.appendChild(sc);E().liveFoxes(w);
  const nb=$('#cf-notice',w);nb.textContent=notice;nb.style.display=notice?'':'none';
  $('#cf-privacy',w).onclick=openPrivacy;
  const pass=$('#cf-pass',w),show=$('#cf-show',w),forgot=$('#cf-forgot',w);
  show.onclick=()=>{const on=pass.type==='password';pass.type=on?'text':'password';show.textContent=on?'Ukryj hasło':'Pokaż hasło';show.setAttribute('aria-pressed',String(on));};
  forgot.onclick=()=>mailTo('Cramfox — nie pamiętam hasła');
  const legal=$('#cf-legal',w);legalLinks().forEach(([,t,fn])=>{const b=document.createElement('button');b.className='linkbtn';b.type='button';b.textContent=t;b.onclick=fn;legal.appendChild(b);});
  if(!legal.children.length)legal.remove();
  const set=m=>{mode=m;w.querySelectorAll('.cftab').forEach(t=>{const on=t.dataset.m===m;t.classList.toggle('on',on);t.setAttribute('aria-selected',String(on));});
    $('#cf-agebox',w).style.display=m==='signup'?'':'none';$('#cf-go',w).textContent=m==='signup'?'ZAŁÓŻ KONTO':'ZALOGUJ SIĘ';
    pass.setAttribute('autocomplete',m==='signup'?'new-password':'current-password');$('#cf-err',w).textContent='';forgot.style.display='none';};
  w.querySelectorAll('.cftab').forEach(t=>t.onclick=()=>set(t.dataset.m));set(mode);
  let busy=false;
  $('.cfform',w).onsubmit=async ev=>{
    ev.preventDefault();const err=$('#cf-err',w),btn=$('#cf-go',w);if(busy||btn.disabled)return;err.textContent='';forgot.style.display='none';
    const email=$('#cf-email',w).value.trim(),pw=pass.value;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return err.textContent='Wpisz poprawny adres e-mail.';
    if(pw.length<6)return err.textContent='Hasło musi mieć co najmniej 6 znaków.';
    if(mode==='signup'&&!$('#cf-age',w).checked)return err.textContent='Cramfox jest na razie dla osób od 16 lat — zaznacz potwierdzenie.';
    if(C.storageVolatile())return err.textContent=E().native?'Nie mogę zapisać logowania na tym urządzeniu. Uruchom aplikację ponownie.':'Ta przeglądarka nie pozwala zapisać logowania (tryb prywatny albo zablokowane dane witryn). Otwórz Cramfox w zwykłym oknie.'; // bez tego logowanie kończy się przeładowaniem i powrotem tutaj (AUDYT P2-44)
    if(mode==='signup'){busy=true; // bez potwierdzania maila literówki w adresie nie da się później naprawić — ostatnie spojrzenie przed założeniem konta
      const ok=await ask({title:'Sprawdź adres e-mail',text:`Konto będzie przypisane do adresu: ${email}. Sprawdź, czy nie ma w nim literówki — tego adresu użyjesz przy każdym logowaniu.`,ok:'Załóż konto',cancel:'Popraw adres'});
      busy=false;if(!ok){$('#cf-email',w).focus();return;}}
    btn.disabled=true;btn.textContent=mode==='signup'?'ZAKŁADAM KONTO…':'LOGUJĘ…';
    try{if(mode==='signup')await C.signUp(email,pw);else await C.signIn(email,pw);location.reload();}
    catch(e){err.textContent=authMsg(e,mode);btn.disabled=false;btn.textContent=mode==='signup'?'ZAŁÓŻ KONTO':'ZALOGUJ SIĘ';
      if(mode==='signin'&&L.email&&/^Zły e-mail/.test(err.textContent))forgot.style.display='';}
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
  if(c==='needs_confirm')return 'To konto wymaga potwierdzenia adresu e-mail. Zaktualizuj aplikację do najnowszej wersji i zaloguj się ponownie.';
  if(c==='signup_disabled')return 'Rejestracja jest chwilowo wyłączona.';
  if(e.status>=500)return 'Serwer chwilowo nie odpowiada. Spróbuj za chwilę.';
  return 'Nie udało się. Spróbuj ponownie.';
}
function openPrivacy(){
  const sh=E().openSheet('cfpriv',`<div class="shandle"></div><div class="shead"><div class="st2">Twoje dane w Cramfox</div><button class="backbtn sclose" id="cfp-x" aria-label="Zamknij">${E().icon('close',{size:18,stroke:3})}</button></div>
    <ul class="cfdel-list cfpriv-list">
      <li><b>Konto.</b> Adres e-mail i hasło. Logowanie obsługuje Supabase (serwery w UE, Frankfurt).</li>
      <li><b>Materiały.</b> Zdjęcia, pliki i teksty, które dodajesz, są przechowywane na Twoim koncie w Supabase. Dostęp do nich masz Ty; nasz serwer pobiera je tylko, żeby utworzyć lekcję.</li>
      <li><b>AI.</b> Żeby zrobić lekcję, materiał trafia przez nasz serwer (Vercel) do modelu Claude firmy Anthropic (USA). Pytamy o zgodę przed pierwszym wysłaniem, a wycofasz ją w Ustawieniach.</li>
      <li><b>Postępy.</b> XP, serię i wyniki zapisujemy na koncie, żeby działały na kilku urządzeniach.</li>
      <li><b>Usunięcie.</b> Ustawienia → Usuń konto kasuje konto, przedmioty, pliki i postępy.</li>
      <li><b>Wiek.</b> Cramfox jest dla osób od 16 lat.</li>
    </ul>
    <div class="cfmore" id="cfp-links"></div>
    <button class="pill" id="cfp-ok" data-primary>OK</button>`);
  E().sheetBack();const close=()=>E().closeSheet();
  const links=$('#cfp-links',sh);if(L.privacy){const b=document.createElement('button');b.className='linkbtn';b.type='button';b.textContent='Pełna polityka prywatności';b.onclick=()=>openUrl(L.privacy);links.appendChild(b);}
  if(L.email){const b=document.createElement('button');b.className='linkbtn';b.type='button';b.textContent='Pytania o dane: '+L.email;b.onclick=()=>mailTo('Cramfox — moje dane');links.appendChild(b);}
  if(!links.children.length)links.remove();
  $('#cfp-x',sh).onclick=close;$('#cfp-ok',sh).onclick=close;const bk=document.getElementById('sheetback');if(bk)bk.onclick=close;
}
function openLicenses(){
  const sh=E().openSheet('cfpriv',`<div class="shandle"></div><div class="shead"><div class="st2">Licencje</div><button class="backbtn sclose" id="cfl-x" aria-label="Zamknij">${E().icon('close',{size:18,stroke:3})}</button></div>
    <ul class="cfdel-list cfpriv-list">
      <li><b>Bricolage Grotesque.</b> Copyright 2022 The Bricolage Grotesque Project Authors. Licencja SIL Open Font License 1.1.</li>
      <li><b>Plus Jakarta Sans.</b> Copyright 2020 The Plus Jakarta Sans Project Authors. Licencja SIL Open Font License 1.1.</li>
      <li><b>Capacitor.</b> Copyright 2017–dziś Drifty Co. Licencja MIT.</li>
    </ul>
    <p class="sp">Czcionki są wbudowane w aplikację — nic nie pobieramy z zewnętrznych serwerów.</p>
    <button class="pill" id="cfl-ok" data-primary>OK</button>`);
  E().sheetBack();const close=()=>E().closeSheet();
  $('#cfl-x',sh).onclick=close;$('#cfl-ok',sh).onclick=close;const bk=document.getElementById('sheetback');if(bk)bk.onclick=close;
}

/* ---------- hooki silnika ---------- */
window.NAUKA_HOOKS={
  saved:()=>C.dirty(),
  profileSub:()=>esc(C.email()||'Twoje konto'),
  settingsTop:scroll=>settingsAccount(scroll),
  settingsAbout:card=>settingsAbout(card), // „Ustawienia → O aplikacji”: pomoc, polityka, regulamin, licencje (gdy silnik woła ten hook)
  todayTop:scroll=>todayCard(scroll),      // „Dziś”: wiersz „Tworzę lekcję…” albo karta nieudanej generacji (gdy silnik woła ten hook)
  addOpen:into=>addOpen(into),             // [+]: w trakcie tworzenia lekcji → ekran postępu zamiast arkusza (true = obsłużone)
  addSheet:sh=>addSheet(sh),               // arkusz „Dodaj materiał”: ile lekcji zostało w tym miesiącu
  addPhoto:into=>startAdd('photo',into),
  addFile:into=>startAdd('file',into),
  addText:into=>startAdd('text',into),
  resume:()=>onResume()                    // zmiana dnia po powrocie z tła: silnik czeka na pull (maks. 5 s), zanim zużyje zamrożenie serii
};

/* ---------- ustawienia: konto, zgoda na AI, pomoc ---------- */
const setRow=(ic,t,s,id,cls)=>{const r=document.createElement(id?'button':'div');r.className='setrow'+(cls?' '+cls:'');if(id)r.id=id;r.innerHTML=E().icon(ic,{size:20,stroke:2.4})+'<div class="grow"><div class="t"></div><div class="s"></div></div>';$('.t',r).textContent=t;$('.s',r).textContent=s||'';return r;};
const setSep=()=>{const d=document.createElement('div');d.className='setsep';return d;};
const fmtDay=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))?String(d).split('-').reverse().join('.'):'';
function consentText(){const M=E().meta();return hasConsent(M)?['udzielona',fmtDay(M.aiConsent),'· dotknij, żeby wycofać'].filter(Boolean).join(' '):'nieudzielona — zapytamy przy pierwszym materiale';}
let aboutInEngine=false;
function settingsAccount(scroll){
  const eb=document.createElement('div');eb.className='eyebrow sec';eb.textContent='Konto';scroll.appendChild(eb);
  const card=document.createElement('div');card.className='setcard a-up';
  card.appendChild(setRow('user',C.email()||'Konto',C.syncAvailable()?'postępy zapisują się na koncie':'zalogowano'));card.appendChild(setSep());
  const plan=setRow('bolt','Nowe lekcje','sprawdzam limit…');plan.id='set-plan';card.appendChild(plan);card.appendChild(setSep());
  const cons=setRow('brain','Zgoda na AI',consentText(),'set-consent');cons.onclick=()=>consentToggle(cons);card.appendChild(cons);card.appendChild(setSep());
  const priv=setRow('lock','Twoje dane','co przechowujemy i gdzie','set-privacy');priv.onclick=openPrivacy;card.appendChild(priv);card.appendChild(setSep());
  const out=setRow('back','Wyloguj','przedmioty i postępy zostają na koncie','set-logout');out.onclick=logout;card.appendChild(out);card.appendChild(setSep());
  const del=setRow('trash','Usuń konto','konto, przedmioty, materiały i postępy — na zawsze','set-delete','danger');del.onclick=openDeleteSheet;card.appendChild(del);
  scroll.appendChild(card);
  if(!aboutInEngine){ // dopóki silnik nie woła settingsAbout: osobna karta pod „Kontem”
    const eh=document.createElement('div');eh.className='eyebrow sec';eh.id='cf-help-eb';eh.textContent='Pomoc i informacje';scroll.appendChild(eh);
    const hc=document.createElement('div');hc.className='setcard a-up';hc.id='cf-help';helpRows(hc,false);scroll.appendChild(hc);}
  C.me({maxAge:60000}).then(m=>{const s=$('.s',plan);if(!s)return;const q=quotaOf(m);if(!q){s.textContent='limit sprawdzisz po połączeniu z internetem';return;}
    const trial=m.trialUntil&&new Date(m.trialUntil)>new Date()?Math.max(1,Math.ceil((new Date(m.trialUntil)-new Date())/86400000)):0;
    s.textContent=`${q.used} z ${q.limit} w tym miesiącu`+(trial?` · na start większy limit, jeszcze ${trial} ${E().pl(trial,'dzień','dni','dni')}`:` · odnawia się ${q.renew}`);})
    .catch(()=>{const s=$('.s',plan);if(s)s.textContent='limit sprawdzisz po połączeniu z internetem';});
}
function helpRows(card,lead){ // lead: przed pierwszym wierszem separator (wiersze dokładane do cudzej karty)
  const rows=legalLinks().map(([ic,t,fn])=>{const r=setRow(ic,t,t==='Pomoc i kontakt'?L.email:t==='Regulamin'?'zasady korzystania z Cramfoxa':'jak przetwarzamy Twoje dane');r.onclick=fn;return r;});
  const lic=setRow('list','Licencje','czcionki i biblioteki','set-licenses');lic.onclick=openLicenses;rows.push(lic);
  rows.forEach((r,i)=>{if(i||lead)card.appendChild(setSep());card.appendChild(r);});
}
function settingsAbout(card){
  if(!card||typeof card.appendChild!=='function')return;aboutInEngine=true;
  const eb=document.getElementById('cf-help-eb'),hc=document.getElementById('cf-help');if(eb)eb.remove();if(hc)hc.remove();
  helpRows(card,true);
}
const hasConsent=M=>!!(M&&M.aiConsent)&&(+M.aiConsentV||1)>=CONSENT_V;
async function consentToggle(row){
  const M=E().meta();const upd=()=>{const s=$('.s',row);if(s)s.textContent=consentText();};
  if(!hasConsent(M)){consent(()=>{upd();toastSafe('Zgoda zapisana','check');});return;}
  if(!await ask({title:'Wycofać zgodę na AI?',text:'Nowych materiałów nie wyślemy do AI, dopóki znowu się nie zgodzisz — zapytamy przy następnym dodawaniu. Gotowe lekcje zostają.',ok:'Wycofaj zgodę',cancel:'Zostaw'}))return;
  delete M.aiConsent;delete M.aiConsentV;E().saveMeta();upd();toastSafe('Zgoda wycofana','check');
}
let loggingOut=false;
async function logout(){
  if(loggingOut)return;
  if(!await ask({title:'Wylogować się?',text:'Przedmioty i postępy zostają na koncie — zobaczysz je po ponownym zalogowaniu.',ok:'Wyloguj'}))return;
  loggingOut=true;const b=document.getElementById('set-logout');const bs=b&&$('.s',b);if(b)b.disabled=true;if(bs)bs.textContent='zapisuję postępy i wylogowuję…';
  try{await C.signOut();}
  catch(e){loggingOut=false;if(b)b.disabled=false;if(bs)bs.textContent='przedmioty i postępy zostają na koncie';
    if(e.code!=='unsynced')return toastSafe('Nie udało się wylogować — spróbuj ponownie','alert');
    const r=e.data&&e.data.reason;const why=r==='off'?'Zapisywanie postępów na koncie jest chwilowo niedostępne.':r==='full'?'Pamięć aplikacji na tym urządzeniu jest pełna.':'Nie udało się połączyć z serwerem.';
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
    try{await C.deleteAccount();note('Konto zostało usunięte. Dziękujemy za naukę z Cramfoxem.');location.reload();}
    catch(e){busy=false;b.disabled=false;b.textContent='USUŃ KONTO NA ZAWSZE';const m=String(e.message||'')+' '+String(e.code||'');
      err.textContent=/active_subscription/.test(m)?(L.email?`Nie możemy teraz usunąć tego konta automatycznie. Napisz do nas: ${L.email} — usuniemy je ręcznie.`:'Nie możemy teraz usunąć tego konta automatycznie. Spróbuj ponownie później.') // App Store 3.1.1, AUDYT P1-25
        :e.code==='network'?'Brak internetu — usunięcie konta wymaga połączenia.'
        :/files_remaining/.test(m)?'Nie udało się usunąć wszystkich plików. Spróbuj ponownie za chwilę.'
        :'Nie udało się usunąć konta. Spróbuj ponownie za chwilę.';}
  };
}

/* ---------- limit nowych lekcji (z /api/me, cache ok. 60 s) — widoczny, zanim cokolwiek się przygotuje albo wyśle ---------- */
const monthNow=()=>{const d=new Date();return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');}; // jak monthKey w backendzie (miesiąc UTC)
function renewText(){const d=new Date();return '1 '+MONTHS[(d.getUTCMonth()+1)%12];}
function quotaOf(m){ // {limit, used, left, files, maxMb, renew} albo null (brak danych)
  if(!m||!m.limits)return null;const limit=+m.limits.generationsPerMonth||0;if(!(limit>0))return null;
  const mk=String(m.usage&&m.usage.month||''),fresh=!mk||mk===monthNow(); // odpowiedź z poprzedniego miesiąca → licznik już się odnowił
  const used=fresh?Math.max(0,+(m.usage&&m.usage.generations)||0):0;
  return {limit,used:Math.min(used,limit),left:Math.max(0,limit-used),files:+m.limits.filesPerGeneration||0,maxMb:+m.limits.maxFileMb||0,renew:renewText()};
}
const quotaNow=()=>quotaOf(C.meCached(600000)); // do blokady przed aparatem tylko świeży odczyt (≤ 10 min); starszy = sprawdzi TWÓRZ i serwer
const refreshQuota=()=>C.me({maxAge:60000}).then(quotaOf).catch(()=>null);
function quotaLine(q){
  if(!q)return '';
  if(q.left<=0)return `Limit nowych lekcji na ten miesiąc jest wykorzystany (${q.used} z ${q.limit}). Odnowi się ${q.renew}.`;
  return `Możesz utworzyć jeszcze ${q.left} z ${q.limit} lekcji w tym miesiącu`+(q.files?` · do ${q.files} ${q.files===1?'pliku':'plików'} naraz`:'');
}
function limitSheet(q){ // limit wyczerpany: zanim ktoś zrobi zdjęcia, które i tak by przepadły
  const sh=E().openSheet('cfpriv',`<div class="shandle"></div><div class="shead"><div class="st2">Limit na ten miesiąc wykorzystany</div><button class="backbtn sclose" id="cflim-x" aria-label="Zamknij">${E().icon('close',{size:18,stroke:3})}</button></div>
    <p class="sp" id="cflim-t"></p><button class="pill" id="cflim-ok" data-primary>OK</button>`);
  $('#cflim-t',sh).textContent=`Utworzono ${q.used} z ${q.limit} lekcji w tym miesiącu. Nowe materiały dodasz od ${q.renew}. Gotowe lekcje, fiszki i powtórki działają bez zmian.`;
  E().sheetBack();const close=()=>E().closeSheet();
  $('#cflim-x',sh).onclick=close;$('#cflim-ok',sh).onclick=close;const bk=document.getElementById('sheetback');if(bk)bk.onclick=close;
}
function addOpen(){if(genRun||C.job()){busyGen();return true;}refreshQuota();return false;}
function addSheet(sh){
  if(!sh||!sh.appendChild)return;const p=document.createElement('p');p.className='sp';p.id='cf-qa-quota';
  const fill=q=>{p.textContent=quotaLine(q);p.style.display=q?'':'none';
    const off=!!q&&q.left<=0; // limit wykorzystany: „Zrób zdjęcie” i kafle przygaszone, pod aparatem data odnowienia (dotknięcie pokaże arkusz limitu); „Mam sprawdzian” działa
    ['#qa-photo','#qa-file','#qa-text'].forEach(id=>{const b=sh.querySelector(id);if(!b)return;b.classList.toggle('off',off);if(off)b.setAttribute('aria-disabled','true');else b.removeAttribute('aria-disabled');});
    const bs=sh.querySelector('#qa-photo .s');if(bs){if(!bs.dataset.t)bs.dataset.t=bs.textContent;bs.textContent=off?`Nowe lekcje od ${q.renew}`:bs.dataset.t;}
    p.classList.toggle('cfq-off',off);};
  const head=sh.querySelector('.shead');if(head&&head.nextSibling)sh.insertBefore(p,head.nextSibling);else sh.appendChild(p);
  fill(quotaNow());refreshQuota().then(q=>{if(p.isConnected&&q)fill(q);});
}

/* ---------- dodawanie materiału ---------- */
let draft=null,lastDraft=null; // {files:[File], text, into, name, hint, stage, warn}
function consent(then){
  const M=E().meta();if(hasConsent(M)){then();return;}
  const sh=E().openSheet('cfconsent',`<div class="shandle"></div><div class="shead"><div class="st2">Zanim zaczniemy</div></div>
    <div class="cfconsent-fox">${E().fox('idle',96)}</div>
    <p class="sp">Żeby zrobić z materiału lekcję, Twoje zdjęcia, pliki i teksty trafią przez nasz serwer do modelu AI <b>Claude firmy Anthropic (USA)</b>. Nie wysyłamy ich nikomu innemu i możesz je usunąć razem z kontem. Zgodę wycofasz w Ustawieniach.</p>
    <button class="pill" id="cfc-ok" data-primary>ZGADZAM SIĘ</button><button class="pill text" id="cfc-more">Jak przetwarzamy dane</button><button class="pill text" id="cfc-no">Nie teraz</button>`);
  E().sheetBack();E().liveFoxes(sh);
  $('#cfc-no',sh).onclick=()=>E().closeSheet();$('#cfc-more',sh).onclick=openPrivacy;const bk=document.getElementById('sheetback');if(bk)bk.onclick=()=>E().closeSheet();
  $('#cfc-ok',sh).onclick=()=>{M.aiConsent=E().todayStr();M.aiConsentV=CONSENT_V;E().saveMeta();E().closeSheet();then();};
}
function pick(kind,onFiles){
  const inp=document.createElement('input');inp.type='file';inp.style.display='none';
  if(kind==='photo'){inp.accept='image/*';inp.setAttribute('capture','environment');}
  else{inp.accept='image/*,application/pdf,.pdf,text/plain,.txt,.md,.pptx,'+C.PPTX_MIME;inp.multiple=true;}
  inp.onchange=()=>{const fs=[...(inp.files||[])];inp.remove();if(fs.length)onFiles(fs);};
  document.body.appendChild(inp);inp.click();
}
function busyGen(){ // trwa tworzenie lekcji → ekran postępu (po restarcie apki najpierw odzyskiwanie z dziennika)
  if(!genRun&&!C.job())return false;
  if(!genRun&&C.job()&&!recovering)recover(true);
  try{E().closeSheet();}catch(e){}E().go('cfgen');return true;
}
function startAdd(kind,into){
  if(busyGen())return;
  const q=quotaNow();if(q&&q.left<=0){limitSheet(q);refreshQuota();return;} // limit znany z ostatniego sprawdzenia: bez aparatu
  refreshQuota();
  consent(()=>{
    const lv=E().meta().level;draft={files:[],text:'',into:into||null,name:'',hint:'',stage:lv==='podstawowka'?'inne':lv||'inne'};
    if(kind==='text')return openTextSheet(()=>E().go('cfadd'));
    pick(kind,fs=>{addFiles(fs);E().go('cfadd');});
  });
}
function addFiles(fs){
  const warn=[];const q=quotaNow(),max=q&&q.files||0;let skipped=0;
  fs.forEach(f=>{const t=C.mimeOf(f);const nm=String(f.name||'');
    const old=(nm.match(/\.(docx?|ppt|xlsx?|odt|pages|key)$/i)||[])[1]; // formaty, których AI nie czyta — z podpowiedzią, jak je zapisać
    if(old){const e=old.toLowerCase();const m=`„${nm.slice(0,40)}”: `+(e==='ppt'||e==='key'?'prezentacja w starym formacie albo Keynote — zapisz jako PPTX lub PDF.':/^doc/.test(e)?'dokument Word — zapisz jako PDF.':/^xls/.test(e)?'arkusz kalkulacyjny — zapisz jako PDF.':'zapisz ten dokument jako PDF.');warn.push(m);return;}
    if(!(/^image\//.test(t)||C.OK_MIME.test(t))){const m='Nieobsługiwany format: '+(f.name||t||'plik').slice(0,40)+'. Dodaj zdjęcie, PDF, prezentację PPTX albo plik tekstowy.';warn.push(m);return;}
    if(!/^image\//.test(t)&&(+f.size||0)>MAX_FILE_MB*MB){ // zdjęcia zmniejszamy później, więc ich nie odrzucamy po surowym rozmiarze
      const m=`„${String(f.name||'plik').slice(0,40)}” ma ${mbTxt(f.size,true)} MB — maksymalnie ${MAX_FILE_MB} MB na plik. `+(t===C.PPTX_MIME?'Prezentacje z filmami bywają duże — usuń filmy albo zapisz jako PDF.':'Podziel go na mniejsze części.');
      warn.push(m);return;}
    if(max&&draft.files.length>=max){skipped++;return;} // ponad limit plików na lekcję — od razu, nie dopiero po TWÓRZ
    draft.files.push(f);});
  if(skipped)warn.push(`Maksymalnie ${max} ${max===1?'plik':E().pl(max,'plik','pliki','plików')} w jednej lekcji — ${skipped===1?'pominąłem 1 plik':'pominąłem '+skipped+' '+E().pl(skipped,'plik','pliki','plików')}. Resztę dodasz jako kolejny materiał.`);
  draft.warn=warn.join(' '); // w treści ekranu „Dodaj materiał” (renderAdd), nie w znikającym toaście
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
  const ql=document.createElement('p');ql.className='sp';ql.id='cfadd-quota';box.appendChild(ql);
  const showQ=q=>{ql.textContent=quotaLine(q);ql.style.display=q?'':'none';};showQ(quotaNow());
  refreshQuota().then(q=>{if(q&&ql.isConnected){showQ(q);const c=document.getElementById('cfadd-count');if(c&&q.files&&draft)c.textContent=countText(q);}});
  const countText=q=>'Materiał'+(q&&q.files&&draft.files.length?` · ${draft.files.length}/${q.files}`:'');
  const mt=eb(countText(quotaNow()));mt.id='cfadd-count';box.appendChild(mt);
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
  const opt=(id,t,s,sub)=>{const b=document.createElement('button');b.className='obopt'+(draft.into===id?' on':'')+(sub?' themed':'');b.setAttribute('aria-pressed',String(draft.into===id));
    if(sub){b.style.setProperty('--accent',sub.accent);if(sub.onAccent)b.style.setProperty('--on-accent',sub.onAccent);} // monogram jak na kafelkach przedmiotów (P1-15)
    const ini=sub&&typeof E().subjInitials==='function'?E().subjInitials({name:esc(sub.name)}):''; // inicjały escapowane przez silnik
    b.innerHTML=(ini?'<div class="mono solid xs" aria-hidden="true">'+ini+'</div>':'')+'<div class="grow"><div class="t nm"></div><div class="s"></div></div><span class="ck">'+(draft.into===id?E().icon('check',{size:16,stroke:4}):'')+'</span>';$('.t',b).textContent=t;$('.s',b).textContent=s;
    b.onclick=()=>{draft.into=id;renderAdd();};return b;};
  subs.forEach(s=>list.appendChild(opt(s.id,s.name,s.topics?'jako nowe poziomy na końcu ścieżki':'pusty przedmiot',s)));
  list.appendChild(opt(null,'Nowy przedmiot','nazwę podpowie AI, możesz ją zmienić'));
  if(draft.into===null){const nm=document.createElement('input');nm.className='cfin';nm.placeholder='Nazwa (opcjonalnie), np. Biologia';nm.maxLength=60;nm.value=draft.name||'';nm.oninput=()=>{draft.name=nm.value;};box.appendChild(nm);}
  box.appendChild(eb('Na czym się skupić? (opcjonalnie)'));
  const hint=document.createElement('input');hint.className='cfin';hint.placeholder='np. tylko rozdział o fotosyntezie';hint.maxLength=300;hint.value=draft.hint||'';hint.oninput=()=>{draft.hint=hint.value;};box.appendChild(hint);
  const err=document.createElement('div');err.className='cferr';err.id='cfadd-err';err.setAttribute('role','alert');err.textContent=draft.warn||'';const warned=!!draft.warn;draft.warn='';box.appendChild(err);if(warned)setTimeout(()=>{try{err.scrollIntoView({block:'center'});}catch(x){}},50);
  const go=document.createElement('button');go.className='pill a-glow';go.id='cfadd-go';go.textContent='TWÓRZ LEKCJĘ';footer(scroll).appendChild(go);
  const say=t=>{err.textContent=t;try{err.scrollIntoView({block:'center',behavior:'smooth'});}catch(x){}}; // komunikat pod formularzem bywa poza ekranem
  go.onclick=async()=>{
    if(go.disabled)return;
    if(!draft.files.length&&!draft.text){say('Dodaj zdjęcie, plik albo tekst.');return;}
    if(!hasConsent(E().meta())){consent(()=>{if(E().view==='cfadd'&&document.getElementById('cfadd-go'))document.getElementById('cfadd-go').click();});return;} // zgoda wycofana po porażce w tle → najpierw zgoda
    if(genRun||C.job()){say('Poprzednia lekcja jeszcze się tworzy — poczekaj chwilę.');return;}
    const d=draft;go.disabled=true;go.textContent='SPRAWDZAM LIMIT…';err.textContent='';
    let m=null,fail=null;try{m=await C.me();}catch(e){fail=e;} // świeży limit w chwili decyzji (wcześniej był na ekranie z cache ~60 s), przed przygotowaniem i wysyłką — szkic zostaje, gdy coś blokuje
    go.disabled=false;go.textContent='TWÓRZ LEKCJĘ';
    if(draft!==d||E().view!=='cfadd')return; // ktoś w tym czasie wyszedł z ekranu
    if(fail&&fail.code==='network'){say('Brak połączenia z internetem — tworzenie lekcji wymaga sieci. Materiał zostaje tutaj.');return;}
    if(fail&&(fail.status===401||!C.signedIn())){say('Sesja wygasła — zaloguj się ponownie.');return;}
    const q=quotaOf(m);showQ(q);
    if(q&&q.left<=0){say(`Limit nowych lekcji na ten miesiąc jest wykorzystany (${q.used} z ${q.limit}). Odnowi się ${q.renew}.`);return;}
    if(q&&q.files&&d.files.length>q.files){const n=d.files.length-q.files;say(`Maksymalnie ${q.files} plików w jednej lekcji — usuń ${n} ${E().pl(n,'plik','pliki','plików')} albo podziel materiał na dwie lekcje.`);return;}
    runGeneration(m&&m.limits||null); // bez /api/me (inny błąd) limity sprawdzi serwer
  };
}

/* ---------- generowanie ---------- */
let genRun=null,recovering=false,lastFail=null; // genRun: {subjectId, created, uploaded:[{id,path}], phase, done, total (pliki), bytes, sent (bajty), startedAt, aiAt, limits}; lastFail: nieudana próba poza ekranem postępu
const STEPS=['Czytam materiał','Wyciągam najważniejsze pojęcia','Układam poziomy','Piszę pytania i fiszki','Dodaję zadania i sprawdzam pytania'];
async function runGeneration(lim){
  const d=draft;draft=null;lastDraft=d;lastFail=null;
  const g=genRun={phase:'prep',done:0,total:d.files.length,startedAt:Date.now(),subjectId:d.into,created:null,uploaded:[],limits:lim||null};E().go('cfgen');
  try{
    if(lim&&+lim.filesPerGeneration>0&&d.files.length>lim.filesPerGeneration)throw new C.CloudError(400,'too_many_files','',{max:lim.filesPerGeneration});
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
    const r=await C.generate({subjectId:g.subjectId,materialIds:ids,text:d.text,hint:d.hint.trim(),stage:d.stage,subjectName:d.into===null?d.name.trim():undefined,created:g.created,materials:g.uploaded,consentV:hasConsent(E().meta())?(+E().meta().aiConsentV||1):undefined});
    finishGen(r.topic,r.demo);
  }catch(e){
    // połączenie zerwane po wysłaniu albo odpowiedź bez JSON-a (np. 504 po zabiciu funkcji): serwer mógł skończyć — sprawdzamy w tabeli generations, dziennik zostaje
    if(g.phase==='ai'&&/^(network|network_after_post|unknown_outcome)$/.test(e.code)&&C.job()){recover(true);return;}
    if(e.code!=='unknown_outcome'&&(g.created||g.uploaded.length))C.discard({subjectId:g.created,materials:g.uploaded}).catch(()=>{}); // generowanie nie ruszyło albo zakończyło się błędem — bez pustych przedmiotów i osieroconych plików
    failGen(e);
  }
}
function finishGen(topic,demo){
  genRun=null;lastDraft=null;lastFail=null;
  E().setSubjects(C.toEngine());
  readyState={sid:topic.subject_id,topicId:topic.id,demo};refreshQuota();
  if(E().view==='cfgen'){E().go('cfready');return;}
  if(safeToRerender())E().go(E().view); // wiersz „Tworzę lekcję…” znika z Dziś
  actionToast('Lekcja gotowa — dotknij, żeby zobaczyć','check',()=>{if(readyState&&readyState.topicId===topic.id)E().go('cfready');});
}
const COUNTS=' Ta próba liczy się do miesięcznego limitu.';
function failGen(e){
  const was=genRun;genRun=null;
  lastFail={e,limits:(was&&was.limits)||{}};refreshQuota();
  if(E().view!=='cfgen'){ // poza ekranem postępu: klikalny komunikat i karta na Dziś — szkic czeka w lastDraft
    if(safeToRerender())E().go(E().view);
    actionToast('Nie udało się utworzyć lekcji — dotknij, żeby zobaczyć','alert',showFail);return;}
  showFail();
}
function failText(e,lim){
  const d=e.data||{},c=e.code;lim=lim||{};const used=+d.used||0;
  const fname=d.name?`„${esc(String(d.name).slice(0,40))}”: `:''; // serwer podaje plik przy błędach PPTX, typu i rozmiaru
  const withName=s=>fname?fname+s.charAt(0).toLowerCase()+s.slice(1):s;
  const charged=!!d.generationId; // błąd po naliczeniu ma generationId; odrzucenie przed naliczeniem — nie
  const CH=d.refunded?' Limit się nie zmienił.':COUNTS; // gdyby serwer zwrócił limit (pole refunded)
  const over=+d.tokens>0&&+d.maxTokens>0?+d.tokens/+d.maxTokens:0,parts=over>1?Math.min(20,Math.ceil(over)):0; // too_long: ile razy za dużo
  const ld=lastDraft,img=!!(ld&&ld.files.some(f=>/^image\//.test(C.mimeOf(f)))),onlyText=!!(ld&&!ld.files.length&&ld.text);
  const retryTip=img?'Spróbuj jeszcze raz albo dodaj wyraźniejsze zdjęcia.':onlyText?'Spróbuj jeszcze raz albo wklej inny, dłuższy fragment notatek.':'Spróbuj jeszcze raz albo z innym fragmentem materiału.';
  const map={
    limit_reached:used>=1999999?['Serwer ma dziś bardzo dużo pracy','Nowe lekcje będzie można tworzyć jutro. Twój limit się nie zmienił.']
      :used>=999999?['Na dziś wystarczy','Dzienny limit nowych lekcji jest wykorzystany. Spróbuj jutro.']
      :['Limit na ten miesiąc wykorzystany',`Wykorzystano ${Math.min(used,+d.limit||used)} z ${+d.limit||0} lekcji w tym miesiącu. Limit odnowi się ${renewText()}. Twój materiał zostaje — możesz do niego wrócić.`],
    busy:['Tworzę już inną lekcję','Poczekaj, aż skończę — zwykle ok. 2 minuty (mogła zacząć się na innym urządzeniu). Potem wróć do materiału i spróbuj ponownie. Limit się nie zmienił.'], // 409: serwer ma generację w toku (P0-1)
    too_many_files:['Za dużo plików naraz',`Maksymalnie ${+d.max||+lim.filesPerGeneration||5} plików w jednej lekcji. Podziel materiał na dwie części.`],
    file_too_big:['Plik jest za duży',withName(`Maksymalny rozmiar pliku to ${+d.maxMb||+lim.maxFileMb||MAX_FILE_MB} MB. Podziel PDF na mniejsze części albo wgraj zdjęcia stron.`)],
    too_much_material:['Za dużo materiału naraz',`Pliki w jednej lekcji mogą mieć razem do ${+d.maxMb||MAX_TOTAL_MB} MB. Podziel materiał na mniejsze części — np. po jednym rozdziale na lekcję.`],
    upload_failed:['Nie udało się wysłać pliku','Serwer nie przyjął pliku. Limit się nie zmienił — spróbuj ponownie za chwilę.'],
    upload_daily_limit:['Na dziś wysłano już dużo plików','To konto osiągnęło dzienny limit wysyłania plików. Spróbuj jutro albo dodaj mniej plików naraz. Limit lekcji się nie zmienił.'], // backend/0008: Storage i wiersze materials na dobę
    subject_limit:['Za dużo przedmiotów na koncie','Dodaj ten materiał do jednego z istniejących przedmiotów. Limit lekcji się nie zmienił.'], // backend/0008: trigger na subjects
    bad_materials:['Nie mogę odczytać materiału','Któryś plik jest uszkodzony albo w nieobsługiwanym formacie.'],
    no_input:['Brak materiału','Dodaj zdjęcie, plik albo tekst.'],
    bad_type:['Nieobsługiwany format',(d.name?`„${esc(String(d.name).slice(0,40))}”: `:'')+'wgraj zdjęcia (JPG, PNG), PDF, prezentację PPTX albo plik tekstowy.'],
    bad_pptx:['Nie mogę otworzyć prezentacji',withName('Plik jest uszkodzony albo za duży. Zapisz go ponownie jako PPTX albo PDF. Limit się nie zmienił.')], // błędy PPTX wychodzą przed naliczeniem limitu
    pptx_protected:['Prezentacja jest zabezpieczona albo w starym formacie',withName('Usuń hasło i zapisz jako PPTX albo PDF. Limit się nie zmienił.')],
    pptx_empty:['Prezentacja nie ma treści',withName('Nie znalazłem tekstu ani obrazów na slajdach. Limit się nie zmienił.')],
    download_failed:['Nie udało się odczytać plików','Serwer nie pobrał materiału. Limit się nie zmienił — spróbuj ponownie za chwilę.'], // przed naliczeniem
    reserve_failed:['Serwer chwilowo nie działa','Limit się nie zmienił — spróbuj za kilka minut.'], // naliczenie się nie udało
    generation_failed:['AI nie dało rady z tym materiałem',retryTip+CH],
    refusal:['AI nie przetworzy tego materiału','Spróbuj z innym materiałem.'+CH],
    invalid_output:['Nie dało się ułożyć lekcji',(onlyText?'Spróbuj z krótszym tekstem albo podziel go na części.':img?'Spróbuj z mniejszą ilością materiału albo wyraźniejszymi zdjęciami.':'Spróbuj z mniejszą ilością materiału, np. jednym rozdziałem.')+CH],
    api:['Serwer AI jest przeciążony','Spróbuj za kilka minut.'+CH],
    not_started:['Lekcja nie zaczęła się tworzyć','Połączenie przerwało się przed wysłaniem materiału. Limit się nie zmienił — spróbuj ponownie.'],
    too_long:['Za dużo materiału na jedną lekcję',(parts>=2?(over>=1.5?`To ok. ${Math.round(over)} razy więcej, niż zmieści jedna lekcja. `:'Materiał jest trochę za duży na jedną lekcję. ')+`Podziel materiał na ${parts} ${E().pl(parts,'część','części','części')}, np. po jednym rozdziale.`:'Plik ma za dużo stron albo tekstu naraz. Podziel go na mniejsze części, np. po jednym rozdziale.')+(charged?CH:' Limit się nie zmienił.')], // 400 przed naliczeniem: serwer policzył tokeny (tokens, maxTokens)
    lost:['Tworzenie lekcji się nie zakończyło','Serwer przerwał pracę. Spróbuj jeszcze raz z mniejszą ilością materiału.'+CH],
    ai_timeout:['Tworzenie lekcji trwało za długo','Serwer przerwał pracę, zanim lekcja była gotowa. Spróbuj z mniejszą ilością materiału, np. jednym rozdziałem.'+(charged?CH:' Limit się nie zmienił.')],
    storage_full:['Pełna pamięć aplikacji','Nie mogę bezpiecznie zapisać na tym urządzeniu postępu tworzenia lekcji, więc niczego nie wysłałem. Limit się nie zmienił. Uruchom aplikację ponownie i spróbuj jeszcze raz.'], // dziennik generowania się nie zapisał (cloud.js generate) — POST nie wyszedł
    unknown_outcome:['Nie wiem, czy lekcja powstała','Połączenie z serwerem przerwało się w trakcie. Za chwilę sprawdź Dziś — jeśli lekcji nie będzie, spróbuj ponownie.'],
    network:['Brak połączenia','Tworzenie lekcji wymaga internetu. Materiał nie został wysłany.'],
    timeout:['Brak połączenia','Serwer nie odpowiada. Materiał nie został wysłany.'],
    not_found:['Nie ma już tego przedmiotu','Wybierz inny przedmiot i spróbuj ponownie.'],
    unauthorized:['Sesja wygasła','Zaloguj się ponownie.'],
    no_session:['Sesja wygasła','Zaloguj się ponownie.'],
    no_config:['Serwer chwilowo nie działa','Spróbuj za kilka minut.']};
  if(c==='api'&&/^AI: 4(?!29)\d\d/.test(String(e.message||'')))map.api=['Tego materiału nie da się przetworzyć','Plik jest za duży albo zabezpieczony (np. PDF ponad 600 stron albo z hasłem). Podziel materiał na mniejsze części.'+CH];
  if(c==='bad_type'&&d.heic)map.bad_type=['Zdjęcie w formacie HEIC','Ten iPhone nie przerobi go w aplikacji. Wybierz zdjęcie z Biblioteki zdjęć (zamiast z Plików) albo zapisz je jako JPG.'];
  if(c==='lost'&&d.reason==='ai_timeout')map.lost=map.ai_timeout; // backend z terminem 270 s: kod lost (zgodny ze starszymi buildami) + powód
  if(c==='reserve_failed'&&d.reason==='ai_upload')map.reserve_failed=['Nie udało się przekazać materiału do AI','Serwer nie zdążył przesłać plików dalej. Limit się nie zmienił — spróbuj ponownie za chwilę.'];
  if(c==='download_failed'&&d.reason==='slow_intake')map.download_failed=['Przygotowanie materiału trwało za długo','Serwer nie zdążył przygotować plików. Limit się nie zmienił — spróbuj ponownie albo z mniejszą ilością materiału.'];
  if(map[c])return map[c];
  // nieznany kod (np. nowy z backendu): bezpieczny tekst według statusu, „liczy się do limitu” tylko, gdy serwer potwierdził naliczenie (generationId)
  if(e.status===402)return ['Limit wykorzystany',`Teraz nie da się utworzyć nowej lekcji. Limit odnowi się ${renewText()}. Gotowe lekcje działają bez zmian.`];
  if(e.status===429)return ['Za dużo prób naraz','Odczekaj chwilę i spróbuj ponownie.'+(charged?CH:' Limit się nie zmienił.')];
  if(e.status>=500)return ['Coś poszło nie tak po stronie serwera','Nie udało się utworzyć lekcji.'+(charged?CH:' Spróbuj ponownie za kilka minut.')];
  return ['Coś poszło nie tak','Nie udało się utworzyć lekcji. Spróbuj ponownie.'];
}
function showFail(){
  const f=lastFail;if(!f)return E().go('today');
  const e=f.e,c=e.code;const [title,reason]=failText(e,f.limits);
  const back={label:'Wróć',text:true,go:()=>{lastFail=null;E().go('today');}};
  const retry=lastDraft&&c!=='unauthorized'&&c!=='no_session'&&c!=='unknown_outcome'?[{label:'WRÓĆ DO MATERIAŁU',primary:true,go:()=>{draft=lastDraft;lastDraft=null;lastFail=null;E().go('cfadd');}}]:[];
  E().renderError({head:'Dodaj materiał',icon:/network|timeout/.test(c)?'wifi':'alert',title,reason,actions:retry.concat([retry.length?back:{...back,label:'WRÓĆ',primary:true,text:false}]),back:()=>{lastFail=null;E().go('today');}});
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
    if(/^(generation_failed|lost|not_started)$/.test(e.code))C.discard({subjectId:j.created,materials:j.materials||[]}).catch(()=>{}); // pusty nowy przedmiot i pliki z nieudanej próby (discard sprawdza, czy temat jednak nie powstał)
    failGen(e);}
}
const mmss=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
function renderGen(){
  if(!genRun&&C.job()&&!recovering)recover(true); // np. [+] albo wiersz na Dziś po ponownym uruchomieniu apki
  const scroll=E().shell(null,{cls:'cfgen',title:'Tworzę lekcję',pills:false,back:()=>E().go('today')});
  const box=document.createElement('div');box.className='cfgen-body';box.id='cfgen-root';
  box.innerHTML=`<div class="cfgen-fox">${E().fox('think',150)}</div><h1 class="cfgen-t">Buduję Twoją lekcję</h1><p class="cfgen-s" id="cfgen-s"></p>
    <div class="bar cfgen-bar"><i id="cfgen-bar" style="width:4%"></i></div><div class="cfsteps" id="cfgen-steps"></div>
    <p class="cfgen-note" id="cfgen-note"></p>`;
  scroll.appendChild(box);E().liveFoxes(box);
  const foot=footer(scroll);foot.id='cfgen-foot';
  const bg=document.createElement('button');bg.className='pill ghost';bg.id='cfgen-bg';bg.textContent='WRÓĆ DO DZIŚ';bg.onclick=()=>E().go('today');foot.appendChild(bg);
  if(!genRun&&!C.job())return E().go('today');
  paintGen();
  const tick=setInterval(()=>{if(!document.getElementById('cfgen-root'))return clearInterval(tick);paintGen();},900);
}
function paintGen(){
  const row=document.querySelector('#cf-today-genrow .s');if(row&&genRun)row.textContent=genRowSub(); // wiersz na Dziś: faza się zmienia także, gdy ekran postępu jest zamknięty
  const root=document.getElementById('cfgen-root');if(!root||!genRun)return;
  const g=genRun,s=$('#cfgen-s',root),bar=$('#cfgen-bar',root),st=$('#cfgen-steps',root),nt=$('#cfgen-note',root),foot=document.getElementById('cfgen-foot');
  const upl=g.phase==='prep'||g.phase==='upload';
  let pct=4,active=0;
  if(g.phase==='prep'){s.textContent='Przygotowuję materiał…';}
  else if(g.phase==='upload'){
    if(g.bytes){const sent=Math.min(g.sent||0,g.bytes);s.textContent=`${g.total===1?'Wysyłam plik':'Wysyłam pliki'}: ${mbTxt(sent,false,g.bytes)} z ${mbTxt(g.bytes)} MB`;pct=4+Math.round(16*sent/g.bytes);}
    else{s.textContent=`Wysyłam pliki ${g.done} z ${g.total}`;pct=4+Math.round(16*(g.total?g.done/g.total:1));}}
  else{const t=(Date.now()-(g.aiAt||g.startedAt))/1000;pct=20+Math.round(75*(1-Math.exp(-t/60)));active=Math.min(STEPS.length-1,Math.floor(t/24));
    s.textContent=g.phase==='offline'?'Brak internetu. Lekcja mogła już powstać — sprawdzę, gdy wróci połączenie. Nie dodawaj materiału ponownie.'
      :g.phase==='recover'?'Sprawdzam, czy lekcja powstała…'
      :t>=150?`Duży materiał — jeszcze chwila · ${mmss(t)}`:'AI czyta i układa poziomy';}
  bar.style.width=pct+'%';
  // wyjście w tło dopiero, gdy pliki są na serwerze: iOS wstrzymuje apkę w tle i zerwana wysyłka przepada
  if(nt)nt.textContent=upl?'Nie zamykaj aplikacji, dopóki pliki się wysyłają.':'To trwa zwykle ok. 2 minuty. Możesz zamknąć ten ekran — lekcja pojawi się na Dziś.';
  if(foot)foot.style.display=upl?'none':'';
  const on=g.phase==='ai'||g.phase==='recover'||g.phase==='offline'; // nowy etap generowania = lis wpada na pomysł (żarówka)
  if(on&&g.lastAct!=null&&active>g.lastAct){const sv=root.querySelector('svg.fx');if(sv&&E().foxAct)E().foxAct(sv,'idea');}if(on)g.lastAct=active;
  st.innerHTML='';STEPS.forEach((t,i)=>{const r=document.createElement('div');r.className='cfstep'+(on&&i<active?' done':on&&i===active?' cur':'');
    r.innerHTML=(on&&i<active?E().icon('check',{size:16,stroke:3.4}):'<i></i>')+'<span></span>';$('span',r).textContent=t;st.appendChild(r);});
}

/* ---------- Dziś: trwające, nieudane albo gotowe tworzenie lekcji (hook todayTop) ---------- */
function genRowSub(){ // podpis wiersza na Dziś — aktualizowany też w trakcie (paintGen), nie tylko przy rysowaniu Dziś
  const upl=genRun&&(genRun.phase==='prep'||genRun.phase==='upload');
  return upl?'wysyłam pliki — nie zamykaj aplikacji':genRun&&genRun.phase==='offline'?'czekam na internet, żeby sprawdzić wynik':'zwykle ok. 2 minuty · dotknij, żeby zobaczyć postęp';
}
function todayCard(scroll){
  if(!scroll||!scroll.appendChild)return;
  const busy=!!(genRun||C.job()),ready=!busy&&!lastFail&&!!readyState&&!readyState.seen&&!!E().subjects().find(x=>x.id===readyState.sid);
  if(!busy&&!lastFail&&!ready)return;
  const card=document.createElement('div');card.className='setcard a-up';card.id='cf-today-gen';
  let r;
  if(busy){r=setRow('clock','Tworzę lekcję…',genRowSub(),'cf-today-genrow');r.onclick=()=>busyGen();}
  else if(ready){r=setRow('check','Lekcja gotowa',(C.subjectName(readyState.sid)||'Nowy materiał')+' · dotknij, żeby zacząć','cf-today-genrow');r.onclick=()=>E().go('cfready');} // toast „Lekcja gotowa” znika po kilku sekundach — wiersz zostaje, dopóki ekran gotowej lekcji nie zostanie otwarty
  else{r=setRow('alert','Nie udało się utworzyć lekcji','dotknij, żeby zobaczyć, co poszło nie tak','cf-today-genrow','danger');r.onclick=showFail;}
  r.insertAdjacentHTML('beforeend',E().icon('chevron-right',{size:18,cls:'chev'}));
  card.appendChild(r);scroll.appendChild(card);
}

/* ---------- przedmiot gotowy ---------- */
let readyState=null;
function startFirstLevel(sid,lv){ // „ZACZNIJ NAUKĘ”: od razu pierwszy poziom nowego materiału
  const e=E();
  if(lv&&typeof e.openLevel==='function'){try{e.openLevel(sid,lv.id);return;}catch(x){}}
  e.openSubject(sid,'path');if(!lv)return;
  try{ // bez API silnika: przycisk węzła tego poziomu na ścieżce (etykieta „Zacznij: …”); przy kilku poziomach o tym samym tytule — ten na tej samej pozycji
    const s=e.subjects().find(x=>x.id===sid);const name=l=>e.txt(e.noEmoji(l.title));const want=name(lv);
    const k=s?s.levels.filter(l=>name(l)===want).indexOf(lv):0;
    const btns=[...document.querySelectorAll('.nodebtn')].filter(b=>/: /.test(b.getAttribute('aria-label')||'')&&(b.getAttribute('aria-label')||'').split(': ').slice(1).join(': ')===want);
    const b=btns[Math.max(0,k)];if(b&&!/node-lock/.test(b.className))b.click();
  }catch(x){}
}
function renderReady(){
  const rs=readyState;const s=rs&&E().subjects().find(x=>x.id===rs.sid);if(!s)return E().go('today');
  rs.seen=true; // wiersz „Lekcja gotowa” na Dziś już niepotrzebny
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
  const go=document.createElement('button');go.className='pill a-glow';go.textContent='ZACZNIJ NAUKĘ';go.onclick=()=>{const fresh=E().subjects().find(x=>x.id===s.id)||s;startFirstLevel(s.id,fresh.levels.find(l=>l.topicId===rs.topicId)||lv[0]);};
  const test=document.createElement('button');test.className='pill text';test.textContent='Mam z tego sprawdzian';test.onclick=()=>E().openTestSheet(s.id);
  foot.appendChild(go);foot.appendChild(test);
}

function registerViews(){const R=E().registerView;R('cfadd',renderAdd);R('cfgen',renderGen);R('cfready',renderReady);}
})();
