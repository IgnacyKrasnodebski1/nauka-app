/* ============================================================ CRAMFOX — ATRAPA BACKENDU (tylko dev / testy, nigdy w build/)
   Ładowana PRZED cloud-config.js (test/dev/index.html). Podmienia window.fetch i odpowiada jak:
   - Supabase GoTrue  (/auth/v1: signup, token?grant_type=password|refresh_token, logout, user),
   - PostgREST        (/rest/v1: subjects, topics, materials, generations, profiles, app_state z rev CAS, rpc/delete_my_account),
   - Storage          (/storage/v1: upload, list, delete, TUS /upload/resumable: POST / PATCH / HEAD),
   - API na Vercelu   (/api/me, /api/generate — temat z test/fixtures/*.json).
   Żadne żądanie do Supabase ani do API nie wychodzi do sieci: nieobsłużony adres = 501 z atrapy. Fonty i pliki z localhost idą normalnie.
   Stan „serwera” jest w localStorage pod kluczami mockbe:* — przeładowanie strony zachowuje się jak prawdziwy backend.

   Parametry adresu (wszystkie opcjonalne):
     mock=fresh|seeded        scenariusz (zmiana scenariusza = czysty stan); fresh: pusta baza; seeded: konto testowe z 2 przedmiotami i postępami
     reset=1                  wyczyść stan atrapy i apki (localStorage, sessionStorage, IndexedDB) — jednorazowo, parametr znika z adresu
     login=0|1                seeded: od razu zalogowany (domyślnie 1)
     away=N                   seeded: ostatnia nauka N dni temu (ekran powrotu przy N ≥ 3)
     extra=viz,xss,krypto4    seeded: dodatkowe przedmioty z fixtures (viz = wszystkie schematy + próby XSS, xss = topic-xss.json)
     gen=ok|slow[:s]|demo|err:KOD[:used|:reason]|drop[:s]|dropfail[:s]|droprelease[:s]|html504
                              /api/generate: sukces (1,5 s) | wolno (domyślnie 25 s) | tryb demo | błąd z kodem serwera |
                              zerwane połączenie po wysłaniu (temat powstaje po s sekundach) | j.w., ale generowanie się nie udaje |
                              j.w., ale AI nie działa po naszej stronie i serwer zwraca limit (backend/0009: error „released:ai_unavailable …”) | 504 bez JSON (Vercel)
                              err:limit_reached:N → used=N (scope według planu: free → lifetime, pro → month); przy innych kodach trzeci człon to `reason` jak w backendzie Build 7:
                              err:lost:ai_timeout (termin 270 s, po naliczeniu), err:reserve_failed:ai_upload, err:download_failed:slow_intake.
                              err:busy = 409 (generacja w toku); err:too_long = 400 przed naliczeniem z tokens/maxTokens.
                              err:ai_unavailable (backend/0009, incydent 2026-10-16: AI nie działa po naszej stronie — klucz, 429, 529, 5xx, sieć)
                              = 503 z charged:false, refunded:true i generationId (naliczone, potem zwrócone: limit bez zmian);
                              err:ai_unavailable:charged = 503 z charged:true (AI zdążyło coś wyprodukować — naliczenie zostaje);
                              err:ai_unavailable:precharge = 503 z charged:false bez generationId (przed naliczeniem: wgranie PDF-u do Files API
                              odrzucone po naszej stronie, np. nieważny klucz, albo count_tokens 401).
                              err:api = „AI: 529 overloaded” (stary backend); err:api:material = 400 o PDF z hasłem (+ reason material);
                              err:api:401 = „AI: 401 … invalid x-api-key” (incydent na starym backendzie); err:api:400 = 400 o naszym zapytaniu.
     oldbe=1                  backend sprzed 0009 (Build 7): odpowiedzi bez pól charged / refunded / reason material
                              Bez err: 409 busy, gdy konto ma generację running młodszą niż 7 min (np. po gen=drop) — jak RPC reserve_generation.
     cap=storage|materials|subjects  limity konta z backend/0008: Storage odmawia (RLS „row-level security”, 403), wiersz materials
                              albo przedmiot → 23514 materials_daily_limit / subject_limit. Bez cap limity liczą się naprawdę (100 plików i 500 MB na dobę,
                              100 wierszy materials na dobę, 200 przedmiotów).
     genfx=makro|viz|xss|krypto  z czego powstaje temat (domyślnie makro: 4 poziomy z topic-makro.json + schematy w czacie)
     plan=free|pro, used=N    plan konta i zużycie (nadpisuje odczyt): free — darmowe lekcje NA ZAWSZE (domyślnie 2, licznik po adresie
                              e-mail, przeżywa usunięcie konta), pro — w tym miesiącu (150). Jak backend/0007: /api/me ma quota
                              {plan, scope:'lifetime'|'month', used, limit, remaining, trialUntil}, 402 limit_reached ma scope.
     freecap=N                limit darmowych lekcji na zawsze (app_config.free_lifetime_generations, domyślnie 2)
     global=full              limit serwera na dobę pełny (app_config): /api/me ma quota.globalOpen=false, /api/generate → 402 used=1999999
     upload=slow|413|500      Storage: wolna wysyłka (1,2 s na żądanie / kawałek TUS) albo błąd
     net=off                  każde żądanie do backendu = brak sieci (też gdy navigator.onLine === false)
     sync=missing|fail        app_state: brak tabeli (PGRST205) albo 500
     fail=tabela,tabela       PostgREST: 500 dla tych tabel (np. fail=app_state, fail=subjects)
     auth=revoked             każdy token odrzucony (401), odświeżenie = 400 → „Sesja wygasła”
     ttl=N                    czas życia access tokenu w sekundach (domyślnie 3600)
     del=active_subscription|files_remaining   rpc/delete_my_account zwraca ten błąd
     signup=confirm|disabled  rejestracja wymaga potwierdzenia e-maila albo jest wyłączona
     lat=ms                   opóźnienie każdej odpowiedzi (domyślnie 60)
     native=1                 udawany Capacitor (isNativePlatform + CapacitorHttp) — ścieżka API jak na iOS
     clock=RRRR-MM-DD         przesunięty zegar przeglądarki (Date) na ten dzień — np. poniedziałek = podsumowanie tygodnia
     nostore=1                localStorage odrzuca zapisy apki (jak tryb prywatny) — pasek ostrzeżenia, brak sesji
     lang=1                   tematy z flagą lang (gry językowe w Ćwiczeniach; produkcja jej dziś nie ustawia)
     trial=N                  seeded: okres próbny (konto sprzed 0007, plan pro) kończy się za N dni (ujemne = już minął → free);
                              nowe konta (rejestracja) są od razu free, bez okresu próbnego
     weekly=1                 seeded: podsumowanie tygodnia jeszcze niepokazane (w poniedziałek pojawi się na starcie)
     log=1                    każde żądanie w console.debug

   Centrum przedmiotu, rolki, podcast, rozmowa z lisem (docs/plan-media.md §2, §6.5; spec docs/design-centrum.md §3):
     mock=msgip               konto testowe z przedmiotem „Międzynarodowe stosunki gospodarcze i polityczne” (MSGiP), plan free,
                              materiały 01–03 z test/fixtures/topic-msgip*.json (keyPoints), postępy jak w spec §3 (materiał 01: U 6 · W 2 · R 2 · N 3,
                              przedmiot: 27 punktów U 8 · W 4 · R 2 · N 13, Powtórka 12 na dziś, próbny 64%, gotowość 40%, seria 5, 1 240 XP, 85 gemów)
     msgip=mid|new|known      mid (domyślnie): Main — lekcja 4 przerwana (część 2 z 4), sprawdzian za 6 dni, rolki 01 gotowe (2/5 obejrzane),
                              podcast 01 gotowy (rozdziały 1–2 nagrane), rolki 02 w przygotowaniu; new: Centrum-Nowy (tylko materiał 01, zero postępów,
                              bez daty, bez mediów); known: wszystkie punkty „Umiem”, wszystkie lekcje zrobione (NA TERAZ = egzamin ustny)
     exam=N|none              sprawdzian za N dni (0 = dziś → rozgrzewka, 1 = jutro → noc przed sprawdzianem); none = bez daty
     lsave=0                  mid: bez przerwanej lekcji (NA TERAZ = „Odzyskaj 2 punkty od Szopa”)
     media=none|ready|running|failed  wiersze tabeli media na starcie (msgip): ready = rolki + podcast materiału 01; running = ready + rolki 02
                              w toku (krok „voice” 2/5; domyślnie dla mid); failed = ready + nieudane rolki 02 (zwrócone, charged:false)
     mrun=N                   rolki 02 z media=running kończą się po ok. N s (domyślnie stoją w miejscu)
     mediagen=fast|slow:N|fail:KOD[:N]  POST /api/media/reels|podcast: 202 od razu, potem wiersz idzie plan → script → voice → save → ready
                              w ok. 4 s (fast) albo N s; fail:KOD = na końcu status failed z error „KOD:…” (zwrot tworzenia; refusal — bez zwrotu)
     mediaerr=KOD[:x]         wymuszona odpowiedź POST mediów: busy · limit_reached:lifetime|month|daily|global · tts_unavailable ·
                              voices_missing · ai_unavailable · media_unavailable · reserve_failed · no_quiz · bad_point ·
                              unknown (wiersz powstaje, odpowiedź ginie — brak sieci) · unknown:html (504 bez JSON). Zawsze charged:false.
     mediafx=xss              rolki i podcast z próbami XSS (test/fixtures/media/xss/*)
     mq=N, mplan=free|pro     ile tworzeń rolek/podcastu zostało (free: 3 na zawsze, pro: 30 w miesiącu — app_config free_media_lifetime / pro_media_month)
     reels=0                  backend bez ELEVENLABS_API_KEY: features.reels/podcast = false, POST mediów → 503 tts_unavailable
     voices=0                 brak ELEVENLABS_VOICE_FOX/SZOP: features.podcast = false, podcast i rozdział → 503 voices_missing
     fox=0                    rozmowa z lisem wyłączona: features.fox = false, /api/fox → 503 ai_unavailable
     chat=N                   ile wiadomości do lisa zostało dziś (free 30, pro 200 — app_config free_chat_daily / pro_chat_daily)
     foxerr=KOD               wymuszona odpowiedź /api/fox: ai_unavailable · fox_failed · limit_reached:chat_daily|chat_global · bad_request ·
                              not_found · unknown (brak sieci po wysłaniu)
     foxfx=xss                odpowiedzi lisa z próbami XSS i emoji (test/fixtures/media/xss/fox-xss.json)
     chapter=busy|err:KOD|slow:N   POST /api/media/podcast/chapter: 409 chapter_busy (rozdział gotowy w wierszu po 5 s) | błąd
                              (tts_unavailable, synth_failed, tts_budget, chapter_failing, voices_missing, not_ready, not_found) | synteza trwa N s (domyślnie 1,5 s)
     nomedia=1                backend bez migracji 0010: /api/me media:null, chat:null, features wyłączone; tabela media nie istnieje;
                              POST mediów i /api/fox → 503 media_unavailable
     extra=kp                 (seeded, msgip) przedmiot „Punkty — test” z topic-kp-edge.json i topic-kp-few.json (przypadki brzegowe keyPoints)
   Konto testowe (tylko atrapa): test@cramfox.test / cramfox-test-1.
   W konsoli: MOCK.cfg, MOCK.db(), MOCK.log (ostatnie żądania), MOCK.reset('seeded'), MOCK.set('gen','err:limit_reached'),
   MOCK.posts('reels'|'podcast'|'chapter'|'fox'|'generate') — liczba POST-ów, MOCK.media() — wiersze media, MOCK.mobjects() — pliki w buckecie media. */
(function(){
'use strict';
const P=new URLSearchParams(location.search);
/* zegar: przesunięcie Date (cała strona — silnik, chmura i atrapa liczą „dziś” od tego samego zegara) */
if(/^\d{4}-\d{2}-\d{2}$/.test(P.get('clock')||'')){
  const RD=Date,[y,m,d]=P.get('clock').split('-').map(Number),n=new RD(),t=new RD(y,m-1,d,n.getHours(),n.getMinutes(),n.getSeconds()),off=t.getTime()-n.getTime();
  class D extends RD{constructor(...a){if(a.length)super(...a);else super(RD.now()+off);}static now(){return RD.now()+off;}}
  window.Date=D;
}
/* tryb prywatny: zapisy apki do localStorage rzucają QuotaExceededError (stan atrapy działa dalej) */
if(P.get('nostore')==='1'){const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===window.localStorage&&!String(k).startsWith('mockbe:'))throw new DOMException('mock: zapis zablokowany','QuotaExceededError');return set.call(this,k,v);};}
const realFetch=window.fetch.bind(window);
const SCRIPT=document.currentScript&&document.currentScript.src||location.href;
const FIXTURES=new URL('../fixtures/',SCRIPT).href;
const cfg={
  mock:/^(fresh|seeded|msgip)$/.test(P.get('mock')||'')?P.get('mock'):'fresh',
  reset:P.get('reset')==='1'||P.get('reset')==='true',
  login:P.get('login')!=='0',
  away:Math.max(0,+P.get('away')||0),
  extra:(P.get('extra')||'').split(',').map(s=>s.trim()).filter(Boolean),
  gen:P.get('gen')||'ok',
  genfx:P.get('genfx')||'makro',
  plan:P.get('plan')||'',
  used:P.get('used'),
  upload:P.get('upload')||'',
  net:P.get('net')||'',
  sync:P.get('sync')||'',
  fail:(P.get('fail')||'').split(',').map(s=>s.trim()).filter(Boolean),
  auth:P.get('auth')||'',
  ttl:Math.max(5,+P.get('ttl')||3600),
  del:P.get('del')||'',
  signup:P.get('signup')||'',
  lat:P.has('lat')?Math.max(0,+P.get('lat')||0):60,
  native:P.get('native')==='1',
  lang:P.get('lang')==='1',
  trial:P.has('trial')?+P.get('trial'):23,
  freecap:P.has('freecap')?Math.max(0,Math.floor(+P.get('freecap')||0)):2,
  global:P.get('global')||'',
  weekly:P.get('weekly')==='1',
  cap:P.get('cap')||'',
  oldbe:P.get('oldbe')==='1',
  log:P.get('log')==='1',
  // centrum przedmiotu i media (docs/plan-media.md)
  msgip:/^(mid|new|known)$/.test(P.get('msgip')||'')?P.get('msgip'):'mid',
  exam:P.has('exam')?P.get('exam'):null,
  lsave:P.get('lsave')!=='0',
  media:/^(none|ready|running|failed)$/.test(P.get('media')||'')?P.get('media'):null,
  mrun:Math.max(0,+P.get('mrun')||0),
  mediagen:P.get('mediagen')||'fast',
  mediaerr:P.get('mediaerr')||'',
  mediafx:P.get('mediafx')||'',
  mq:P.has('mq')?Math.max(0,Math.floor(+P.get('mq')||0)):null,
  mplan:P.get('mplan')||'',
  reels:P.get('reels')!=='0',
  voices:P.get('voices')!=='0',
  fox:P.get('fox')!=='0',
  chat:P.has('chat')?Math.max(0,Math.floor(+P.get('chat')||0)):null,
  foxerr:P.get('foxerr')||'',
  foxfx:P.get('foxfx')||'',
  chapter:P.get('chapter')||'',
  nomedia:P.get('nomedia')==='1'
};
const MB=1048576;
/* app_config z backend/0010 (docs/plan-media.md §3.1) — liczby tworzeń mediów i wiadomości do lisa */
const MEDIA_CFG={free_media_lifetime:3,pro_media_month:30,media_daily_per_user:5,free_chat_daily:30,pro_chat_daily:200};
function mediaPlan(uid){if(cfg.mplan==='free'||cfg.mplan==='pro')return cfg.mplan;const p=DB&&DB.t.profiles.find(x=>x.id===uid);return p&&p.plan==='pro'&&(!p.trial_until||Date.parse(p.trial_until)>Date.now())?'pro':'free';}
function mediaLimit(uid){return mediaPlan(uid)==='pro'?MEDIA_CFG.pro_media_month:MEDIA_CFG.free_media_lifetime;}
function chatLimit(uid){return mediaPlan(uid)==='pro'?MEDIA_CFG.pro_chat_daily:MEDIA_CFG.free_chat_daily;}
function applyQuotaParams(uid){ // mq=N / chat=N: „zostało N” — przeliczone na licznik serwera (dalsze tworzenia i wiadomości liczą się normalnie)
  if(cfg.mq!=null)DB.mused[uid]=Math.max(0,mediaLimit(uid)-cfg.mq);
  if(cfg.chat!=null){const d=new Date();DB.chat[uid]={day:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),used:Math.max(0,chatLimit(uid)-cfg.chat)};}
}
const TEST_USER={id:'0c0ffee0-0000-4000-8000-000000000001',email:'test@cramfox.test',password:'cramfox-test-1'};
const IDS={sMakro:'5b000001-0000-4000-8000-000000000001',tMakro:'7c000001-0000-4000-8000-000000000001',
  sKrypto:'5b000002-0000-4000-8000-000000000002',tKrypto:'7c000002-0000-4000-8000-000000000002',
  sViz:'5b000003-0000-4000-8000-000000000003',tViz:'7c000003-0000-4000-8000-000000000003',
  sXss:'5b000004-0000-4000-8000-000000000004',tXss:'7c000004-0000-4000-8000-000000000004',
  sKp:'5b000005-0000-4000-8000-000000000005',tKpEdge:'7c000005-0000-4000-8000-000000000005',tKpFew:'7c000006-0000-4000-8000-000000000006',
  // MSGiP (mock=msgip): pierwsze 8 znaków id tematów różne — od nich zależy id poziomu w silniku (t7c000011_l1 …)
  sMsgip:'5b000011-0000-4000-8000-000000000011',tMsgip1:'7c000011-0000-4000-8000-000000000011',tMsgip2:'7c000012-0000-4000-8000-000000000012',tMsgip3:'7c000013-0000-4000-8000-000000000013',
  mReels1:'ae000001-0000-4000-8000-000000000001',mPod1:'ae000002-0000-4000-8000-000000000002',mReels2:'ae000003-0000-4000-8000-000000000003'};
const PLANS={free:{label:'Free',generationsPerMonth:2,generationsLifetime:2,filesPerGeneration:5,maxFileMb:50,maxSubjects:5,priceMonthlyPln:0,priceYearlyPln:0}, // jak packages/shared/src/plans.ts
  pro:{label:'Pro',generationsPerMonth:150,filesPerGeneration:20,maxFileMb:50,maxSubjects:1000,priceMonthlyPln:29,priceYearlyPln:199}};
const BUCKET_MIME=/^(image\/(jpeg|png|webp|gif)|application\/pdf|text\/(plain|markdown)|application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation)$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ---------- pomocnicze ---------- */
const now=()=>Date.now();
const iso=t=>new Date(t==null?now():t).toISOString();
const pad=n=>String(n).padStart(2,'0');
const ymd=off=>{const d=new Date();d.setDate(d.getDate()+(off||0));return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}; // jak dstr() w silniku (czas lokalny)
const monday=()=>{const d=new Date();const dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
const monthKey=()=>{const d=new Date();return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1);}; // jak plans.ts: miesiąc UTC
const uuid=()=>{const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};
const rnd=()=>Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
const clone=v=>JSON.parse(JSON.stringify(v));
const arr=v=>Array.isArray(v)?v:[];
const sleep=(ms,signal)=>new Promise((res,rej)=>{if(signal&&signal.aborted)return rej(abortErr());const t=setTimeout(()=>{if(signal)signal.removeEventListener('abort',on);res();},ms);const on=()=>{clearTimeout(t);rej(abortErr());};if(signal)signal.addEventListener('abort',on,{once:true});});
const abortErr=()=>new DOMException('The user aborted a request.','AbortError');
const levelId=(topicId,l)=>'t'+String(topicId).replace(/-/g,'').slice(0,8)+'_'+String(l).replace(/[^A-Za-z0-9_-]/g,'_'); // jak mapLevel() w cloud.js

/* ---------- stan „serwera” ---------- */
const DBK='mockbe:db';
let DB=null;
function load(){try{const v=JSON.parse(localStorage.getItem(DBK)||'null');if(v&&v.v===1){if(!v.free)v.free={};if(!v.t.media)v.t.media=[];if(!v.mobjects)v.mobjects={};if(!v.mused)v.mused={};if(!v.chat)v.chat={};}return v&&v.v===1?v:null;}catch(e){return null;}}
function save(){try{localStorage.setItem(DBK,JSON.stringify(DB));}catch(e){console.error('[mock] zapis stanu atrapy się nie udał',e);}}
function emptyDb(scenario){return {v:1,scenario,createdAt:iso(),seeded:false,users:[],tokens:{access:{},refresh:{}},
  t:{subjects:[],topics:[],materials:[],generations:[],app_state:[],profiles:[],usage:[],subscriptions:[],media:[]},objects:{},tus:{},
  free:{}, // free: znormalizowany adres e-mail → darmowe lekcje (jak free_generation_ledger w backend/0007 — przeżywa usunięcie konta)
  mobjects:{}, // bucket „media”: "uid/mediaId/plik" → {fx: plik z test/fixtures, reel?: n} albo {data: JSON}; mime z rozszerzenia
  mused:{}, // uid → wykorzystane tworzenia rolek/podcastu (media_ledger z 0010: niezwrócone rezerwacje)
  chat:{}};} // uid → {day, used} (fox_usage z 0010, doba Europe/Warsaw — w atrapie doba lokalna)
function wipeApp(){ // dane apki na tym „urządzeniu”: postępy, sesja, cache — atrapa zostaje osobno (mockbe:*)
  const ks=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&!k.startsWith('mockbe:'))ks.push(k);}
  ks.forEach(k=>localStorage.removeItem(k));try{sessionStorage.clear();}catch(e){}
  try{indexedDB.deleteDatabase('cramfox');}catch(e){} // kolejka IDB: usunięcie wykona się przed otwarciem bazy przez cloud.js
}
function newSession(uid){
  const at='mock-at.'+uid+'.'+rnd(),rt='mock-rt.'+rnd(),exp=Math.floor(now()/1000)+cfg.ttl;
  DB.tokens.access[at]={uid,exp};DB.tokens.refresh[rt]={uid,at};save();
  const u=DB.users.find(x=>x.id===uid);
  return {access_token:at,token_type:'bearer',expires_in:cfg.ttl,expires_at:exp,refresh_token:rt,user:publicUser(u)};
}
function publicUser(u){return {id:u.id,aud:'authenticated',role:'authenticated',email:u.email,email_confirmed_at:u.created_at,phone:'',
  app_metadata:{provider:'email',providers:['email']},user_metadata:u.meta||{},created_at:u.created_at,updated_at:u.created_at};}
function addUser(id,email,password,meta){
  const u={id,email,password,meta:meta||{},created_at:iso()};DB.users.push(u);
  // trigger handle_new_user od backend/0007: każde nowe konto jest free, bez okresu próbnego (seeded nadpisuje to niżej: konto sprzed zmiany)
  DB.t.profiles.push({id,email,display_name:email.split('@')[0],plan:'free',trial_until:null,created_at:iso()});
  return u;
}

function init(){
  DB=load();
  const need=cfg.reset||!DB||DB.scenario!==cfg.mock;
  if(need){
    wipeApp();DB=emptyDb(cfg.mock);
    if(cfg.mock==='seeded'){
      addUser(TEST_USER.id,TEST_USER.email,TEST_USER.password,{age16:true,client:'cramfox'});
      const pr=DB.t.profiles.find(p=>p.id===TEST_USER.id);pr.trial_until=iso(now()+cfg.trial*86400000);pr.plan=cfg.trial>0?'pro':'free';pr.created_at=iso(now()-7*86400000);
      DB.t.usage.push({user_id:TEST_USER.id,month:monthKey(),generations:2,tutor_messages:0});
      if(cfg.login){const s=newSession(TEST_USER.id);
        localStorage.setItem('cf_session',JSON.stringify({access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at,user:{id:s.user.id,email:s.user.email}}));}
    }
    if(cfg.mock==='msgip'){ // konto po 0007: free, bez okresu próbnego; darmowe lekcje: new — 1 z 2 zużyta, reszta — obie
      addUser(TEST_USER.id,TEST_USER.email,TEST_USER.password,{age16:true,client:'cramfox'});
      const pr=DB.t.profiles.find(p=>p.id===TEST_USER.id);pr.created_at=iso(now()-30*86400000);
      DB.free[TEST_USER.email]=cfg.msgip==='new'?1:2;
      DB.mused[TEST_USER.id]=cfg.msgip==='new'?0:1; // spec §3: „Zostało: 2 z 3”
      if(cfg.login){const s=newSession(TEST_USER.id);
        localStorage.setItem('cf_session',JSON.stringify({access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at,user:{id:s.user.id,email:s.user.email}}));}
    }
    if(DB.users.length)applyQuotaParams(DB.users[0].id);
    save();
  }
  if(cfg.reset){P.delete('reset');try{history.replaceState(history.state,'',location.pathname+(P.toString()?'?'+P.toString():'')+location.hash);}catch(e){}} // location.reload() po logowaniu nie wyczyści stanu drugi raz
}
init();

/* ---------- fixtures i tematy ---------- */
const fxCache={};
async function fixture(name){if(!fxCache[name]){const r=await realFetch(FIXTURES+name+'.json');if(!r.ok)throw new Error('[mock] brak fixture '+name);fxCache[name]=await r.json();}return clone(fxCache[name]);}
const VIZ_MAKRO={ // schematy dopisane do poziomu 1 (dane jak z serwera z options.viz: same dane, HTML robi apka)
  0:{type:'compare',caption:'Dwie polityki państwa',a:'Makroekonomiczna',b:'Społeczna',rows:[{k:'Czym się zajmuje',a:'cała gospodarka państwa',b:'warunki życia ludzi'},{k:'Narzędzia',a:'dług, stopy procentowe',b:'pomoc i kapitał ludzki'},{k:'Cel',a:'wiarygodność fiskalna',b:'mniejsze nierówności'}]},
  3:{type:'flow',kind:'process',caption:'Cykl polityki społecznej',steps:['Diagnoza','Analiza przyczyn','Propozycje','Decyzja i legislacja','Wdrożenie','Ewaluacja']},
  4:{type:'tree',root:'Narzędzia polityki społecznej',groups:[{name:'Ekonomiczne',items:['podatki','zasiłki','dotacje']},{name:'Prawne',items:['Kodeks pracy','ustawy']},{name:'Informacyjne',items:['kampanie','poradnictwo']},{name:'Kadrowe',items:['pracownicy socjalni','urzędnicy']}]}
};
const VIZ_MAKRO_L3={0:{type:'numbers',caption:'Magiczny czworokąt w liczbach',items:[{value:'4',label:'klasyczne cele polityki makro'},{value:'~2–2,5%',label:'cel inflacyjny (stabilność cen)'}]},
  2:{type:'bars',unit:'% PKB',caption:'Limity Paktu Stabilności',items:[{label:'Deficyt',value:3},{label:'Dług publiczny',value:60}]}};
async function topicContent(kind){const c=await topicContent0(kind);if(cfg.lang)c.lang=true;return c;}
async function topicContent0(kind){
  if(kind==='viz')return fixture('topic-viz');
  if(kind==='xss')return fixture('topic-xss');
  if(kind==='krypto'){const k=await fixture('topic-krypto');k.levels=k.levels.slice(0,4);return k;}
  const m=await fixture('topic-makro');m.levels=m.levels.slice(0,4);
  m.levels[0].feed.forEach((f,i)=>{if(VIZ_MAKRO[i])f.viz=clone(VIZ_MAKRO[i]);});
  m.levels[2].feed.forEach((f,i)=>{if(VIZ_MAKRO_L3[i])f.viz=clone(VIZ_MAKRO_L3[i]);});
  return m;
}
function insertTopic(subjectId,owner,content,id,genId,at){
  const t={id:id||uuid(),subject_id:subjectId,owner_id:owner,name:String(content.name||'Temat').slice(0,120),emoji:content.emoji||'📘',source:'materials',content,
    generation_id:genId||null,position:DB.t.topics.filter(x=>x.subject_id===subjectId).length,created_at:iso(at)};
  DB.t.topics.push(t);return t;
}

/* ---------- konto testowe: przedmioty i postępy (seeded) ---------- */
let ready=Promise.resolve();
async function seedContent(){
  if(DB.seeded||(DB.scenario!=='seeded'&&DB.scenario!=='msgip'))return;
  if(DB.scenario==='msgip')return seedMsgip();
  const uid=TEST_USER.id,t0=now()-6*86400000;
  const makro=await fixture('topic-makro'),krypto=await fixture('topic-krypto');
  const subj=(id,name,stage,accent,pos)=>DB.t.subjects.push({id,owner_id:uid,name,emoji:'📘',stage,accent,accent2:accent,exam_date:null,exam_label:null,position:pos,created_at:iso(t0+pos*1000)});
  subj(IDS.sMakro,'Polityka makroekonomiczna','studia','#B4FF3A',0);insertTopic(IDS.sMakro,uid,makro,IDS.tMakro,null,t0);
  subj(IDS.sKrypto,'Krypto i NFT','studia','#22D3EE',1);insertTopic(IDS.sKrypto,uid,krypto,IDS.tKrypto,null,t0+1000);
  if(cfg.extra.includes('viz')){subj(IDS.sViz,'Wizualizacje — test','studia','#FFC043',2);const v=await fixture('topic-viz');if(cfg.lang)v.lang=true;insertTopic(IDS.sViz,uid,v,IDS.tViz,null,t0+2000);}
  if(cfg.extra.includes('xss')){subj(IDS.sXss,'Test<img src=x onerror="window.__pwned=1">','liceum','#FF2E93',3);insertTopic(IDS.sXss,uid,await fixture('topic-xss'),IDS.tXss,null,t0+3000);}
  if(cfg.extra.includes('kp'))await seedKp(uid,t0,4);
  DB.t.app_state.push({user_id:uid,...seedState(makro,krypto),client_ts:null,rev:1,updated_at:iso(t0)});
  DB.seeded=true;save();
}
function seedState(makro,krypto){
  const M=l=>levelId(IDS.tMakro,l),K=l=>levelId(IDS.tKrypto,l),sM=IDS.sMakro,sK=IDS.sKrypto;
  const away=cfg.away,last=ymd(away?-away:-1);
  const srs={},album={};
  const card=(sid,lid,i,box,due,lapses)=>{srs[sid+':'+lid+':'+i]={box,due,seen:box+1+(lapses|0),lapses:lapses|0};};
  // makro poziom 1: dwie do powtórki dziś, dwie utrwalone (album), jedna świeża; pytania z pomyłkami
  card(sM,M('l1'),0,1,ymd(-1),0);card(sM,M('l1'),1,0,ymd(0),2);card(sM,M('l1'),2,3,ymd(4),0);card(sM,M('l1'),3,4,ymd(12),1);card(sM,M('l1'),4,2,ymd(-2),1);
  card(sM,M('l2'),0,1,ymd(0),0);card(sM,M('l2'),1,3,ymd(2),0);card(sM,M('l3'),0,0,ymd(-1),1);
  srs[sM+':'+M('l1')+':q0']={box:0,due:ymd(-1),seen:2,lapses:2};srs[sM+':'+M('l2')+':q1']={box:1,due:ymd(0),seen:2,lapses:1};
  card(sK,K('k1'),0,4,ymd(9),0);card(sK,K('k1'),1,3,ymd(3),0);card(sK,K('k2'),0,3,ymd(5),1);card(sK,K('k1'),2,1,ymd(0),0);
  album[sM+':'+M('l1')+':2']={rarity:'epic',at:ymd(-3)};album[sM+':'+M('l1')+':3']={rarity:'common',at:ymd(-2)};album[sM+':'+M('l2')+':1']={rarity:'rare',at:ymd(-1)};
  album[sK+':'+K('k1')+':0']={rarity:'epic',at:ymd(-5)};album[sK+':'+K('k1')+':1']={rarity:'rare',at:ymd(-4)};album[sK+':'+K('k2')+':0']={rarity:'common',at:ymd(-4)};
  const kLevels={};krypto.levels.forEach((l,i)=>{kLevels[K(l.id)]={done:true,stars:i%3===1?2:3,best:i%3===1?80:100};});
  const history={};const xpOf=[0,95,60,120,40,80,110,0,0,45,70,0,0,0,90,0,30,0,0,55,0];
  xpOf.forEach((x,i)=>{if(!i||!x)return;const d=ymd(-i-(away?away-1:0));history[d]={xp:x,levels:i%3===0?1:0,cards:i%4===0?1:0,reviews:Math.round(x/10),combo:Math.min(9,Math.round(x/15)),missions:i%5===0?1:0};});
  const exam={pct:72,grade:'4',correct:13,total:18,date:ymd(-3)};
  const progress={
    [sM]:{xp:420,levels:{[M('l1')]:{done:true,stars:3,best:100},[M('l2')]:{done:true,stars:2,best:80},[M('l3')]:{done:true,stars:1,best:60}},exam:{n:1,passed:1,best:exam,last:exam},chests:{}},
    [sK]:{xp:310,levels:kLevels,boss:{}},
    gems:260,goal:100,examsPassed:1,hearts:{n:5,refillAt:null},srs,album,
    badges:{first:ymd(-6),streak7:ymd(-20)},stats:{missions:4,maxCombo:7,planDays:2,bosses:0},theme:'acid',themes:['acid','violet'],
    history,examDeck:[sM+':'+M('l2')+':q0',sM+':'+M('l3')+':q2']
  };
  const meta={level:'studia',goal:'sesja',streak:6,best:12,bestWas:12,lastDay:last,freezes:1,frozenDays:[],ms:{'3':ymd(-4)},aiConsent:ymd(-7),streakCeleb:last,weeklyShown:cfg.weekly?ymd(-7):monday(),reduceMotion:false};
  return {progress,meta};
}
async function seedKp(uid,at,pos){ // extra=kp: przypadki brzegowe keyPoints (test/fixtures/make-msgip.mjs: kpEdge, kpFew)
  DB.t.subjects.push({id:IDS.sKp,owner_id:uid,name:'Punkty — test',emoji:'📘',stage:'liceum',accent:'#A855F7',accent2:'#A855F7',exam_date:null,exam_label:null,position:pos,created_at:iso(at)});
  insertTopic(IDS.sKp,uid,await fixture('topic-kp-edge'),IDS.tKpEdge,null,at);
  insertTopic(IDS.sKp,uid,await fixture('topic-kp-few'),IDS.tKpFew,null,at+1000);
}

/* ---------- MSGiP (mock=msgip): przedmiot z 3 materiałami, postępy jak w spec §3 ---------- */
const MSGIP_NAME='Międzynarodowe stosunki gospodarcze i polityczne';
const MSGIP_MAT={ // pliki źródłowe (tabele materials + generations → topic.source w cloud.js, „ŹRÓDŁO” w materiale)
  [IDS.tMsgip1]:[{name:'wyklad-1-2-msgip.pdf',mime:'application/pdf',size:2412000,ext:'pdf'}],
  [IDS.tMsgip2]:Array.from({length:9},(_,i)=>({name:`wyklad-3-strona-${i+1}.jpg`,mime:'image/jpeg',size:640000+i*1000,ext:'jpg'})),
  [IDS.tMsgip3]:[{name:'polityka-handlowa-ue.pptx',mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation',size:5300000,ext:'pptx'}]};
function seedSource(uid,subjectId,topic,at){
  const ids=[];(MSGIP_MAT[topic.id]||[]).forEach((m,i)=>{const id=uuid(),p=uid+'/'+uuid()+'.'+m.ext;
    DB.t.materials.push({id,owner_id:uid,storage_path:p,mime:m.mime,size_bytes:m.size,name:m.name,created_at:iso(at+i)});
    DB.objects[p]={id:uuid(),size:m.size,mime:m.mime,at:iso(at+i)};ids.push(id);});
  const g={id:uuid(),owner_id:uid,subject_id:subjectId,status:'done',error:null,topic_id:topic.id,material_ids:ids,stage:'studia',
    options:{stage:'studia',mode:'materials',levels:4,viz:true,aiConsentV:1},model:'claude-opus-5',created_at:iso(at),finished_at:iso(at+90000)};
  DB.t.generations.push(g);topic.generation_id=g.id;
}
const dayAt=(off,h,m)=>{const d=new Date();d.setDate(d.getDate()+off);d.setHours(h==null?18:h,m==null?20:m,0,0);return d.getTime();};
async function seedMsgip(){
  const uid=TEST_USER.id,v=cfg.msgip,S=IDS.sMsgip;
  const examIn=cfg.exam==null?(v==='new'?null:6):cfg.exam==='none'?null:Math.max(0,Math.floor(+cfg.exam||0));
  const tps=[[IDS.tMsgip1,'topic-msgip',-8],[IDS.tMsgip2,'topic-msgip-2',-5],[IDS.tMsgip3,'topic-msgip-3',-2]].slice(0,v==='new'?1:3);
  const created=v==='new'?now()-120000:dayAt(-8);
  DB.t.subjects.push({id:S,owner_id:uid,name:MSGIP_NAME,emoji:'📘',stage:'studia',accent:'#FF2E93',accent2:'#FF2E93',exam_date:examIn==null?null:ymd(examIn),exam_label:null,position:0,created_at:iso(created-60000)});
  const contents={};
  for(const [id,fx,off] of tps){const c=await fixture(fx);contents[id]=c;const at=v==='new'?created:dayAt(off);seedSource(uid,S,insertTopic(S,uid,c,id,null,at),at-120000);}
  if(cfg.extra.includes('kp'))await seedKp(uid,dayAt(-9),1);
  const md=cfg.media||(v==='mid'?'running':v==='known'?'ready':'none');
  DB.t.app_state.push({user_id:uid,...msgipState(contents,examIn,md!=='none'),client_ts:null,rev:1,updated_at:iso(now()-3600000)});
  if(md!=='none'){
    await seedMedia(uid,S,IDS.tMsgip1,'reels',IDS.mReels1,dayAt(-3));
    await seedMedia(uid,S,IDS.tMsgip1,'podcast',IDS.mPod1,dayAt(-2));
    if(md==='running'&&tps.length>1)seedRunning(uid,S,IDS.tMsgip2,IDS.mReels2);
    if(md==='failed'&&tps.length>1)DB.t.media.push(mediaRow({id:IDS.mReels2,owner_id:uid,subject_id:S,topic_id:IDS.tMsgip2,kind:'reels',status:'failed',phase:'voice',
      progress:{step:'voice',done:1,total:5},spec:{types:['czym','kto','mit','porownanie','sprawdzian']},error:'released:tts_unavailable: 401 mock',charged:false,
      refunded_at:iso(now()-600000),created_at:iso(now()-900000),finished_at:iso(now()-600000)}));
  }
  DB.seeded=true;save();
}
/* postępy MSGiP: stany punktów z kluczy SRS (D1). Wzorzec = znak na każdy element punktu z SRS (fiszki, potem pytania, w kolejności keyPoints):
   k umiem (pudełko 3, termin za 3–8 dni) · f pudełko 2 za 2 dni · L pudełko 1 na dziś · l pudełko 1 na jutro · R pudełko 2, termin minął 4 dni temu ·
   w zła odpowiedź dziś (pudełko 0) · - nie ćwiczone. Materiał 01: p1 W, p2–p4 U, p5 R, p6–p7 U, p8 W, p9 R, p10 U, p11–p13 N; materiał 02: U W N N U W N N. */
function msgipState(C,examIn,withMedia){
  const v=cfg.msgip,S=IDS.sMsgip,t1=IDS.tMsgip1,t2=IDS.tMsgip2,L=(t,l)=>levelId(t,l);
  const srs={};
  const E={k:i=>({box:3,due:ymd(3+i%6),seen:3,lapses:0}),f:()=>({box:2,due:ymd(2),seen:2,lapses:0}),L:()=>({box:1,due:ymd(0),seen:1,lapses:0}),
    l:()=>({box:1,due:ymd(1),seen:1,lapses:0}),R:()=>({box:2,due:ymd(-4),seen:2,lapses:0}),w:()=>({box:0,due:ymd(0),seen:1,lapses:1})};
  let k=0;const put=(t,pid,pat)=>{const c=C[t];if(!c)return;const p=(c.keyPoints||[]).find(x=>x.id===pid);if(!p)return;
    p.items.filter(x=>x.kind!=='task').forEach((x,i)=>{const ch=pat==='k'?'k':pat[i]||'-';if(ch==='-')return;srs[S+':'+L(t,x.level)+':'+(x.kind==='quiz'?'q':'')+x.index]=E[ch](k++);});};
  const levels={},allLv=[];
  Object.keys(C).forEach(t=>C[t].levels.forEach(l=>allLv.push(L(t,l.id))));
  if(v==='mid'){
    [['p1','LLLff-w--'],['p2','k'],['p3','k'],['p4','k'],['p5','RRRRkkk'],['p6','k'],['p7','k'],['p8','Lff--'],['p9','RRRkkk'],['p10','k']].forEach(([p,x])=>put(t1,p,x));
    [['p1','k'],['p2','llf'],['p5','k'],['p6','lf']].forEach(([p,x])=>put(t2,p,x));
    levels[L(t1,'l1')]={done:true,stars:3,best:100};levels[L(t1,'l2')]={done:true,stars:2,best:83};levels[L(t1,'l3')]={done:true,stars:2,best:80};
    if(C[t2])levels[L(t2,'w1')]={done:true,stars:2,best:75};
  }
  if(v==='known'){Object.keys(C).forEach(t=>(C[t].keyPoints||[]).forEach(p=>put(t,p.id,'k')));allLv.forEach(id=>{levels[id]={done:true,stars:3,best:100};});}
  const ex=v==='new'?null:v==='known'?{pct:82,grade:'4,5',correct:20,total:25,date:ymd(-2)}:{pct:64,grade:'3,5',correct:16,total:25,date:ymd(-2)};
  const history={};if(v!=='new')[60,45,80,30,55].forEach((x,i)=>{history[ymd(-1-i)]={xp:x,levels:i%2,cards:1,reviews:6,combo:4,missions:0};});
  const progress={[S]:{xp:v==='new'?0:v==='known'?2100:1240,levels,...(ex?{exam:{n:1,passed:1,best:ex,last:ex}}:{})},
    gems:v==='new'?0:v==='known'?140:85,goal:50,examsPassed:ex?1:0,hearts:{n:5,refillAt:null},srs,album:{},badges:v==='new'?{}:{first:ymd(-30),streak7:ymd(-20)}, // najlepsza seria 9 — odznaka 7 dni już zdobyta (bez toastu „Odznaka” na zrzutach)
    stats:{missions:2,maxCombo:6,planDays:1,bosses:0},history};
  if(examIn!=null)progress.tests=[{id:'tp-msgip',subjectId:S,levels:allLv,date:ymd(examIn),plan:[],built:null}];
  if(v==='mid'&&cfg.lsave)progress.lessonSave=JSON.stringify({[S+':'+L(t1,'l4')]:{v:1,at:dayAt(-1,19,40),sig:'4.8.3',phase:'feed',feedIdx:1,
    items:['q0','q1','q2','q3','q4','q5','t0','t1','t2'],qIdx:0,score:0,combo:0,maxCombo:0,broken:false,xp:4,bad:[],run:[],el:190000,terms:[],replay:false}});
  if(withMedia&&v!=='new')progress.media={[IDS.mReels1]:{w:[1,2],q:{'1':0,'2':1},at:ymd(-1)},[IDS.mPod1]:{ch:2,pos:12,done:[1],at:ymd(-1)}};
  if(v==='mid')progress.fox={[t1]:{explain:{at:ymd(-3),gaps:2},quiz:{at:ymd(-2),ok:4,n:6}}};
  const meta={level:'studia',goal:'sesja',streak:v==='new'?0:5,best:v==='new'?0:9,bestWas:v==='new'?0:9,lastDay:v==='new'?null:ymd(-1),freezes:1,frozenDays:[],ms:{},aiConsent:ymd(-30),aiConsentV:1,
    streakCeleb:v==='new'?null:ymd(-1),weeklyShown:monday(),reduceMotion:false};
  if(!meta.lastDay){delete meta.lastDay;delete meta.streakCeleb;}
  return {progress,meta};
}

/* ---------- media (backend/0010): wiersze, pliki w buckecie, manifesty ---------- */
const MEDIA_COLS=['id','owner_id','subject_id','topic_id','kind','status','phase','progress','title','spec','manifest','error','charged','created_at','finished_at']; // GRANT SELECT (kolumny) dla authenticated
const REEL_TYPES=['czym','kto','mit','porownanie','pulapki','sprawdzian'];
const REEL_LABEL={czym:'Czym to jest',kto:'Kto jest kim',mit:'Mit czy fakt',porownanie:'Porównanie',pulapki:'Pułapki na egzaminie',sprawdzian:'Na sprawdzian'};
const THUMBS=['#2F6BFF','#1F8A5B','#E9A23B','#E0483F'];
const FILE_RE=/^[a-z0-9.]+$/;
const xssFx=()=>cfg.mediafx==='xss';
function mediaRow(o){return Object.assign({id:uuid(),owner_id:null,subject_id:null,topic_id:null,kind:'reels',status:'running',phase:'plan',progress:{step:'plan',done:0,total:1},title:null,
  spec:{},manifest:null,error:null,charged:true,refunded_at:null,model:null,cost_usd:null,tts_chars:0,created_at:iso(),finished_at:null,updated_at:iso()},o);}
const publicRow=r=>{const o={};MEDIA_COLS.forEach(c=>{o[c]=noInternal(clone(r[c]===undefined?null:r[c]));});return o;}; // pola _* to stan atrapy, nie kolumny
function setMobj(uid,mid,file,v){if(FILE_RE.test(String(file)))DB.mobjects[uid+'/'+mid+'/'+file]=v;}
function reelFiles(uid,mid,reels){ // rolki nieparzyste = sb-a, parzyste = sb-b (xss: sb-xss); atrapa podaje te same pliki pod rN.*
  reels.forEach(r=>{const n=+r.n||1,f=r.files||{},base=xssFx()?'media/xss/sb-xss':(n%2?'media/sb-a':'media/sb-b');
    setMobj(uid,mid,f.storyboard,{fx:base+'.json',reel:n});setMobj(uid,mid,f.audio,{fx:base+'.mp3'});setMobj(uid,mid,f.words,{fx:base+'.words.json'});});
}
async function seedMedia(uid,S,topicId,kind,id,at){ // gotowe rolki / podcast materiału 01 z fixture'ów (topicId podmieniony na prawdziwy)
  const man=await fixture(xssFx()?(kind==='reels'?'media/xss/reels-xss':'media/xss/podcast-xss'):(kind==='reels'?'media/reels-msgip':'media/podcast-msgip'));
  man.topicId=topicId;
  const row=mediaRow({id,owner_id:uid,subject_id:S,topic_id:topicId,kind,status:'ready',phase:'save',progress:{step:'save',done:1,total:1},title:man.title,
    spec:kind==='reels'?{types:(man.reels||[]).map(r=>r.type)}:{},manifest:man,model:'claude-sonnet-5',cost_usd:kind==='reels'?0.38:0.21,tts_chars:kind==='reels'?3900:5200,
    created_at:iso(at),finished_at:iso(at+150000),updated_at:iso(at+150000)});
  DB.t.media.push(row);
  if(kind==='reels')reelFiles(uid,id,arr(man.reels));
  else{setMobj(uid,id,'script.json',{fx:xssFx()?'media/xss/script-xss.json':'media/podcast-script.json'});
    arr(man.chapters).forEach(c=>{if(c&&c.status==='ready'&&c.files)chapterFiles(uid,id,c.n);});}
}
function chapterFiles(uid,mid,n,data){ // nagrany rozdział: mp3 = c1/c2 z fixture'ów (na zmianę), czasy z fixture'u albo policzone (data)
  const base=xssFx()?'media/xss/c-xss':'media/c'+(n%2?1:2);
  setMobj(uid,mid,'c'+n+'.mp3',{fx:base+'.mp3'});setMobj(uid,mid,'c'+n+'.json',data?{data}:{fx:base+'.json'});
}
function seedRunning(uid,S,topicId,id){ // rolki 02 „przygotowuję”: krok voice 2/5, stoją (albo kończą się po mrun s)
  const dur=cfg.mrun?cfg.mrun*1000/0.45:3600000; // start w 55% drogi (krok voice 2/5) — z mrun koniec po ok. mrun s
  DB.t.media.push(mediaRow({id,owner_id:uid,subject_id:S,topic_id:topicId,kind:'reels',status:'running',phase:'voice',progress:{step:'voice',done:2,total:5},
    spec:{types:['czym','kto','mit','porownanie','sprawdzian']},created_at:iso(now()-60000),
    _walk:{t0:now()-0.55*dur,dur,n:5,outcome:'ok',types:['czym','kto','mit','porownanie','sprawdzian'],frozen:!cfg.mrun}}));
}
ready=seedContent().catch(e=>console.error('[mock] seed',e));

/* ---------- HTTP: odpowiedzi ---------- */
function res(status,body,headers){
  const h=new Headers(headers||{});const noBody=status===204||status===205||status===304||body===undefined;
  if(!noBody&&typeof body!=='string'&&!h.has('Content-Type'))h.set('Content-Type','application/json; charset=utf-8');
  return new Response(noBody?null:(typeof body==='string'?body:JSON.stringify(body)),{status,headers:h});
}
const LOG=[];
function bearer(h){const a=h.get('Authorization')||'';const m=/^Bearer\s+(.+)$/i.exec(a);return m?m[1]:'';}
function userOf(h){ // uid z tokenu albo null (nieważny, wygasły, odwołany, konto usunięte)
  if(cfg.auth==='revoked')return null;
  const t=DB.tokens.access[bearer(h)];if(!t||t.exp*1000<=now())return null;
  return DB.users.some(u=>u.id===t.uid)?t.uid:null;
}
function bodyJson(b){if(b==null||b==='')return null;if(typeof b==='string'){try{return JSON.parse(b);}catch(e){return undefined;}}return undefined;}
function bodySize(b){if(b==null)return 0;if(typeof b==='string')return new Blob([b]).size;if(typeof b.size==='number')return b.size;if(typeof b.byteLength==='number')return b.byteLength;return 0;}

/* ---------- GoTrue ---------- */
const gerr=(status,code,msg)=>res(status,{code:status,error_code:code,msg});
async function auth(u,m,h,b){
  const p=u.pathname.replace(/^\/auth\/v1/,'');
  if(!h.get('apikey'))return res(401,{message:'No API key found in request'});
  if(p==='/signup'&&m==='POST'){
    if(cfg.signup==='disabled')return gerr(422,'signup_disabled','Signups not allowed for this instance');
    const d=bodyJson(b)||{},email=String(d.email||'').trim().toLowerCase(),pw=String(d.password||'');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return gerr(400,'email_address_invalid','Unable to validate email address: invalid format');
    if(pw.length<6)return gerr(422,'weak_password','Password should be at least 6 characters.');
    if(DB.users.some(x=>x.email===email))return gerr(422,'user_already_exists','User already registered');
    const usr=addUser(uuid(),email,pw,d.data||{});save();
    if(cfg.signup==='confirm')return res(200,publicUser(usr)); // bez sesji → klient: needs_confirm
    return res(200,newSession(usr.id));
  }
  if(p==='/token'&&m==='POST'){
    const gt=u.searchParams.get('grant_type'),d=bodyJson(b)||{};
    if(gt==='password'){const email=String(d.email||'').trim().toLowerCase();const usr=DB.users.find(x=>x.email===email&&x.password===String(d.password||''));
      if(!usr)return gerr(400,'invalid_credentials','Invalid login credentials');return res(200,newSession(usr.id));}
    if(gt==='refresh_token'){const r=DB.tokens.refresh[String(d.refresh_token||'')];
      if(cfg.auth==='revoked'||!r||!DB.users.some(x=>x.id===r.uid))return gerr(400,'refresh_token_not_found','Invalid Refresh Token: Refresh Token Not Found');
      delete DB.tokens.refresh[d.refresh_token];delete DB.tokens.access[r.at];return res(200,newSession(r.uid));}
    return gerr(400,'validation_failed','Unsupported grant type');
  }
  if(p==='/logout'&&m==='POST'){const t=bearer(h);const a=DB.tokens.access[t];if(!a)return gerr(401,'bad_jwt','invalid JWT');
    delete DB.tokens.access[t];Object.keys(DB.tokens.refresh).forEach(k=>{if(DB.tokens.refresh[k].at===t)delete DB.tokens.refresh[k];});save();return res(204);}
  if(p==='/user'&&m==='GET'){const uid=userOf(h);if(!uid)return gerr(401,'bad_jwt','invalid JWT');return res(200,publicUser(DB.users.find(x=>x.id===uid)));}
  return gerr(404,'not_found','mock: brak trasy '+m+' '+p);
}

/* ---------- PostgREST ---------- */
const OWNER={subjects:'owner_id',topics:'owner_id',materials:'owner_id',generations:'owner_id',app_state:'user_id',profiles:'id',usage:'user_id',subscriptions:'user_id',media:'owner_id'};
const CLIENT_WRITE={subjects:['POST','PATCH','DELETE'],materials:['POST','DELETE'],app_state:['POST','PATCH'],profiles:['PATCH'],topics:['PATCH','DELETE']}; // RLS: generations/usage tylko serwer
const perr=(status,code,message,extra)=>res(status,Object.assign({code,details:null,hint:null,message},extra||{}));
function parseVal(v){if(/^\{.*\}$/.test(v))return v.slice(1,-1).split(',').filter(Boolean);return v;}
function match(row,col,expr){
  const i=expr.indexOf('.');if(i<0)return true;let op=expr.slice(0,i),val=expr.slice(i+1),neg=false;
  if(op==='not'){neg=true;const j=val.indexOf('.');op=val.slice(0,j);val=val.slice(j+1);}
  const x=row[col];let ok;
  const cmp=(a,b)=>typeof a==='number'?a-(+b):String(a)<String(b)?-1:String(a)>String(b)?1:0;
  if(op==='eq'){const pv=parseVal(val);ok=Array.isArray(pv)?Array.isArray(x)&&x.length===pv.length&&x.every((y,k)=>String(y)===pv[k]):x!=null&&String(x)===val;}
  else if(op==='neq')ok=x==null||String(x)!==val;
  else if(op==='gt')ok=x!=null&&cmp(x,val)>0;else if(op==='gte')ok=x!=null&&cmp(x,val)>=0;
  else if(op==='lt')ok=x!=null&&cmp(x,val)<0;else if(op==='lte')ok=x!=null&&cmp(x,val)<=0;
  else if(op==='in'){const list=val.replace(/^\(|\)$/g,'').split(',').map(s=>s.replace(/^"|"$/g,''));ok=x!=null&&list.includes(String(x));}
  else if(op==='is')ok=val==='null'?x==null:val==='true'?x===true:val==='false'?x===false:false;
  else ok=true;
  return neg?!ok:ok;
}
const RESERVED=new Set(['select','order','limit','offset','on_conflict','columns']);
function query(table,uid,sp){
  const own=OWNER[table];let rows=DB.t[table].filter(r=>r[own]===uid); // RLS: tylko swoje wiersze
  sp.forEach((v,k)=>{if(!RESERVED.has(k))rows=rows.filter(r=>match(r,k,v));});
  const ord=sp.get('order');if(ord){const keys=ord.split(',').map(s=>{const [c,dir,nl]=s.split('.');return {c,desc:dir==='desc'};});
    rows=rows.slice().sort((a,b)=>{for(const k of keys){const x=a[k.c],y=b[k.c];if(x===y)continue;if(x==null)return 1;if(y==null)return -1;const d=(typeof x==='number'&&typeof y==='number')?x-y:String(x)<String(y)?-1:1;return k.desc?-d:d;}return 0;});}
  const off=+sp.get('offset')||0,lim=sp.has('limit')?+sp.get('limit'):Infinity;
  return rows.slice(off,off+lim);
}
function pick(rows,sel){if(!sel||sel==='*')return rows.map(clone);const cols=sel.split(',').map(s=>s.trim().split(':').pop()).filter(Boolean);return rows.map(r=>{const o={};cols.forEach(c=>{if(c in r)o[c]=clone(r[c]);});return o;});}
function lazyGenerations(){ // gen=drop: generowanie kończy się „w tle” — wynik widać przy następnym odczycie tabeli
  let ch=false;DB.t.generations.forEach(g=>{if(g.status!=='running'||!g._finishAt||g._finishAt>now())return;ch=true;
    if(g._outcome==='fail'){g.status='failed';g.error='mock: AI nie dało rady';g.finished_at=iso();return;}
    if(g._outcome==='release'){refund(g);g.status='failed';g.error='released:ai_unavailable: 401 authentication_error [req_mock]: invalid x-api-key';g.refunded_at=iso();g.finished_at=iso();return;} // backend/0009
    const t=insertTopic(g.subject_id,g.owner_id,g._content,null,g.id);g.status='done';g.topic_id=t.id;g.finished_at=iso();delete g._content;});
  if(ch)save();
}
async function rest(u,m,h,b){
  if(!h.get('apikey'))return res(401,{message:'No API key found in request'});
  const path=u.pathname.replace(/^\/rest\/v1\//,''),sp=u.searchParams,prefer=h.get('Prefer')||'';
  const uid=userOf(h);
  if(!uid)return perr(401,'PGRST301','JWT expired');
  if(path.startsWith('rpc/'))return rpc(path.slice(4),uid,bodyJson(b)||{});
  const table=path;
  if(table==='app_state'&&cfg.sync==='missing')return perr(404,'PGRST205',"Could not find the table 'public.app_state' in the schema cache");
  if((table==='app_state'&&cfg.sync==='fail')||cfg.fail.includes(table))return perr(500,'XX000','mock: wymuszony błąd tabeli '+table);
  if(!DB.t[table]||(table==='media'&&cfg.nomedia))return perr(404,'PGRST205',"Could not find the table 'public."+table+"' in the schema cache"); // nomedia: backend bez 0010
  if(table==='generations')lazyGenerations();
  if(table==='media'){lazyMedia(); // 0010: GRANT SELECT tylko na kolumny z MEDIA_COLS — select=* albo inna kolumna = 42501
    const sel=String(sp.get('select')||'*').split(',').map(x=>x.trim().split(':').pop());
    if((m==='GET'||m==='HEAD')&&sel.some(c=>!MEDIA_COLS.includes(c)))return perr(403,'42501','permission denied for table media');}
  const own=OWNER[table],rep=/return=representation/.test(prefer);
  if(m==='GET'||m==='HEAD')return res(200,pick(query(table,uid,sp),sp.get('select')));
  if(!(CLIENT_WRITE[table]||[]).includes(m))return perr(403,'42501','permission denied for table '+table);
  if(m==='POST'){
    let d=bodyJson(b);if(d===undefined)return perr(400,'PGRST102','Empty or invalid json');const list=Array.isArray(d)?d:[d];const out=[];
    for(const raw of list){
      const row=Object.assign({},raw);
      if(row[own]!==uid)return perr(403,'42501','new row violates row-level security policy for table "'+table+'"');
      const cap=capErr(table,uid);if(cap)return cap;
      if(table==='subjects')Object.assign(row,{id:row.id||uuid(),created_at:iso(),exam_date:row.exam_date??null,exam_label:row.exam_label??null,position:row.position??0,emoji:row.emoji??'📘',stage:row.stage||'inne'});
      if(table==='materials'){
        if(!new RegExp('^'+uid+'/[0-9a-f-]{36}\\.[a-z0-9]{1,10}$','i').test(String(row.storage_path||'')))return perr(400,'23514','new row for relation "materials" violates check constraint "materials_path_owner"');
        Object.assign(row,{id:row.id||uuid(),created_at:iso()});}
      if(table==='app_state'){
        if(stateTooBig(row))return perr(400,'23514','new row for relation "app_state" violates check constraint "app_state_size"');
        const ex=DB.t.app_state.find(r=>r.user_id===row.user_id);
        if(ex){if(sp.get('on_conflict')==='user_id'&&/resolution=ignore-duplicates/.test(prefer))continue; // PostgREST: konflikt pominięty → pusta reprezentacja
          return perr(409,'23505','duplicate key value violates unique constraint "app_state_pkey"');}
        Object.assign(row,{rev:1,updated_at:iso(),client_ts:row.client_ts??null,progress:row.progress||{},meta:row.meta||{}});}
      DB.t[table].push(row);out.push(row);
    }
    save();return rep?res(201,clone(out)):res(201);
  }
  if(m==='PATCH'){
    const d=bodyJson(b);if(!d||typeof d!=='object')return perr(400,'PGRST102','Empty or invalid json');
    const rows=query(table,uid,sp);
    if(table==='profiles'&&['plan','trial_until','stripe_customer_id'].some(k=>k in d))return perr(403,'42501','new row violates row-level security policy for table "profiles"');
    for(const r of rows){
      if(table==='app_state'){const nx=Object.assign({},r,d);if(stateTooBig(nx))return perr(400,'23514','new row for relation "app_state" violates check constraint "app_state_size"');}
    }
    rows.forEach(r=>{Object.assign(r,d,{[own]:r[own]});if(table==='app_state'){r.rev=(+r.rev||0)+1;r.updated_at=iso();}}); // trigger bump_app_state
    save();return rep?res(200,clone(rows)):res(204);
  }
  if(m==='DELETE'){
    const rows=query(table,uid,sp);const ids=new Set(rows);
    DB.t[table]=DB.t[table].filter(r=>!ids.has(r));
    if(table==='subjects'){const sids=new Set(rows.map(r=>r.id));DB.t.topics=DB.t.topics.filter(t=>!sids.has(t.subject_id));DB.t.media=DB.t.media.filter(r=>!sids.has(r.subject_id));} // FK on delete cascade (media: 0010)
    if(table==='topics'){const tids=new Set(rows.map(r=>r.id));DB.t.media=DB.t.media.filter(r=>!tids.has(r.topic_id));} // pliki w buckecie media zostają (jak w Supabase) — sprząta klient
    save();return rep?res(200,clone(rows)):res(204);
  }
  return perr(405,'PGRST117','Unsupported HTTP method');
}
const DAY_MS=86400000;
function capErr(table,uid){ // backend/0008: trigger BEFORE INSERT → 23514 z nazwą limitu w message (PostgREST 400)
  const recent=r=>r.owner_id===uid&&Date.parse(r.created_at)>now()-DAY_MS;
  if(table==='subjects'&&(cfg.cap==='subjects'||DB.t.subjects.filter(r=>r.owner_id===uid).length>=200))return perr(400,'23514','subject_limit',{details:'Najwyżej 200 przedmiotów na konto.'});
  if(table==='materials'&&(cfg.cap==='materials'||DB.t.materials.filter(recent).length>=100))return perr(400,'23514','materials_daily_limit',{details:'Najwyżej 100 nowych materiałów na dobę.'});
  return null;
}
function storageCapHit(uid){ // polityka RESTRICTIVE „materials upload daily cap”: obiekty z ostatniej doby, które nadal istnieją
  if(cfg.cap==='storage')return true;
  const mine=Object.keys(DB.objects).filter(k=>k.startsWith(uid+'/')&&Date.parse(DB.objects[k].at)>now()-DAY_MS);
  return mine.length>=100||mine.reduce((a,k)=>a+(+DB.objects[k].size||0),0)>=500*MB;
}
function stateTooBig(r){return JSON.stringify(r.progress||{}).length+JSON.stringify(r.meta||{}).length>=2000000;}
function rpc(fn,uid,args){
  if(fn!=='delete_my_account')return perr(404,'PGRST202','Could not find the function public.'+fn+' in the schema cache');
  if(cfg.del==='active_subscription')return perr(400,'P0001','active_subscription');
  if(args.p_dry_run)return res(204);
  if(cfg.del==='files_remaining'||Object.keys(DB.objects).some(p=>p.startsWith(uid+'/'))||Object.keys(DB.mobjects||{}).some(p=>p.startsWith(uid+'/')))return perr(400,'P0001','files_remaining'); // 0010: także bucket media
  DB.users=DB.users.filter(u=>u.id!==uid);
  Object.keys(DB.t).forEach(t=>{const own=OWNER[t];DB.t[t]=DB.t[t].filter(r=>r[own]!==uid);});
  Object.keys(DB.tokens.access).forEach(k=>{if(DB.tokens.access[k].uid===uid)delete DB.tokens.access[k];});
  Object.keys(DB.tokens.refresh).forEach(k=>{if(DB.tokens.refresh[k].uid===uid)delete DB.tokens.refresh[k];});
  save();return res(204);
}

/* ---------- Storage ---------- */
const serr=(status,error,message)=>res(status===403?400:status,{statusCode:String(status),error,message});
async function storage(u,m,h,b,signal){
  if(!h.get('apikey'))return serr(401,'Unauthorized','No API key found in request');
  const p=u.pathname.replace(/^\/storage\/v1\//,'');
  const uid=userOf(h);if(!uid)return serr(403,'Unauthorized','"exp" claim timestamp check failed'); // jak Supabase: 400 + „exp” → klient odświeża token
  if(cfg.upload==='slow'&&(m==='POST'||m==='PATCH')&&!/^object\/list\//.test(p)&&p!=='object/materials')await sleep(1200,signal);
  const owns=path=>String(path).split('/')[0]===uid;
  if(p==='object/list/materials'&&m==='POST'){const d=bodyJson(b)||{};const pre=String(d.prefix||'').replace(/\/$/,'')+'/';
    const names=Object.keys(DB.objects).filter(k=>k.startsWith(pre)&&!k.slice(pre.length).includes('/')&&owns(k)).sort();
    const off=+d.offset||0,lim=+d.limit||100;
    return res(200,names.slice(off,off+lim).map(k=>({name:k.slice(pre.length),id:DB.objects[k].id,updated_at:DB.objects[k].at,created_at:DB.objects[k].at,last_accessed_at:DB.objects[k].at,metadata:{size:DB.objects[k].size,mimetype:DB.objects[k].mime}})));}
  if(p==='object/materials'&&m==='DELETE'){const d=bodyJson(b)||{};const out=[];
    (d.prefixes||[]).forEach(k=>{if(DB.objects[k]&&owns(k)){out.push({name:k,bucket_id:'materials',id:DB.objects[k].id});delete DB.objects[k];}});save();return res(200,out);}
  let mt=/^object\/materials\/(.+)$/.exec(p);
  if(mt&&m==='POST'){
    const path=decodeURIComponent(mt[1]),size=bodySize(b),mime=(h.get('Content-Type')||'').split(';')[0].trim();
    if(cfg.upload==='413')return serr(413,'Payload too large','The object exceeded the maximum allowed size');
    if(cfg.upload==='500')return serr(500,'internal','Internal Server Error');
    if(!owns(path)||storageCapHit(uid))return serr(403,'Unauthorized','new row violates row-level security policy');
    if(size>50*MB)return serr(413,'Payload too large','The object exceeded the maximum allowed size');
    if(!BUCKET_MIME.test(mime))return serr(415,'invalid_mime_type','mime type '+mime+' is not supported');
    if(DB.objects[path]&&h.get('x-upsert')!=='true')return serr(409,'Duplicate','The resource already exists');
    DB.objects[path]={id:uuid(),size,mime,at:iso()};save();return res(200,{Key:'materials/'+path,Id:DB.objects[path].id});
  }
  if(p==='upload/resumable'&&m==='POST'){
    const len=+h.get('Upload-Length'),meta={};String(h.get('Upload-Metadata')||'').split(',').forEach(kv=>{const [k,v]=kv.trim().split(' ');if(k)meta[k]=v?decodeURIComponent(escape(atob(v))):'';});
    if(cfg.upload==='413'||len>50*MB)return serr(413,'Payload too large','The object exceeded the maximum allowed size');
    if(cfg.upload==='500')return serr(500,'internal','Internal Server Error');
    if(meta.bucketName!=='materials'||!owns(meta.objectName||'')||storageCapHit(uid))return serr(403,'Unauthorized','new row violates row-level security policy');
    if(!BUCKET_MIME.test(meta.contentType||''))return serr(415,'invalid_mime_type','mime type '+meta.contentType+' is not supported');
    if(DB.objects[meta.objectName]&&h.get('x-upsert')!=='true')return serr(409,'Duplicate','The resource already exists');
    const id=rnd();DB.tus[id]={path:meta.objectName,mime:meta.contentType,len,off:0,uid};save();
    return res(201,undefined,{'Location':new URL((window.CRAMFOX_CONFIG||{}).supabaseUrl).origin+'/storage/v1/upload/resumable/'+id,'Tus-Resumable':'1.0.0','Upload-Offset':'0'});
  }
  mt=/^upload\/resumable\/(.+)$/.exec(p);
  if(mt){const up=DB.tus[mt[1]];
    if(!up||up.uid!==uid)return res(404,'Upload not found',{'Tus-Resumable':'1.0.0'});
    if(m==='HEAD')return res(200,undefined,{'Upload-Offset':String(up.off),'Upload-Length':String(up.len),'Tus-Resumable':'1.0.0','Cache-Control':'no-store'});
    if(m==='PATCH'){
      if(+h.get('Upload-Offset')!==up.off)return res(409,'Upload-Offset mismatch',{'Tus-Resumable':'1.0.0'});
      const n=bodySize(b);if(up.off+n>up.len)return res(400,'Upload exceeds Upload-Length',{'Tus-Resumable':'1.0.0'});
      up.off+=n;if(up.off===up.len){DB.objects[up.path]={id:uuid(),size:up.len,mime:up.mime,at:iso()};}save();
      return res(204,undefined,{'Upload-Offset':String(up.off),'Tus-Resumable':'1.0.0'});
    }
  }
  // bucket „media” (0010): odczyt i usuwanie tylko własnego folderu; zapis wyłącznie serwer (service role)
  let mm=/^object\/(?:authenticated\/)?media\/(.+)$/.exec(p);
  if(mm&&(m==='GET'||m==='HEAD')){const key=decodeURIComponent(mm[1]);const out=owns(key)?await mediaObject(key):null;
    return out||serr(404,'not_found','Object not found');} // Supabase: 400 z statusCode 404 (też gdy RLS nie pozwala)
  if(mm&&(m==='POST'||m==='PUT'))return serr(403,'Unauthorized','new row violates row-level security policy');
  if(p==='object/media'&&m==='DELETE'){const d=bodyJson(b)||{};const out=[];
    arr(d.prefixes).forEach(k=>{k=String(k);if(DB.mobjects[k]&&owns(k)){out.push({name:k,bucket_id:'media'});delete DB.mobjects[k];}});save();return res(200,out);}
  if(p==='object/list/media'&&m==='POST'){const d=bodyJson(b)||{};const pre=String(d.prefix||'').replace(/\/$/,'')+'/';if(!owns(pre))return res(200,[]);
    const names=[...new Set(Object.keys(DB.mobjects).filter(k=>k.startsWith(pre)).map(k=>k.slice(pre.length).split('/')[0]))].sort();
    return res(200,names.slice(+d.offset||0,(+d.offset||0)+(+d.limit||100)).map(n=>DB.mobjects[pre+n]?{name:n,id:uuid(),metadata:{mimetype:MEDIA_MIME(n)}}:{name:n,id:null,metadata:null}));}
  return serr(404,'not_found','mock: brak trasy '+m+' '+p);
}

/* ---------- API (Vercel) ---------- */
const aerr=(status,code,error,extra)=>res(status,Object.assign({error:error||code,code},extra||{}));
const planOf=uid=>{if(cfg.plan==='free'||cfg.plan==='pro')return cfg.plan;const p=DB.t.profiles.find(x=>x.id===uid);return p&&p.plan==='pro'?'pro':'free';};
function usageRow(uid){let u=DB.t.usage.find(x=>x.user_id===uid&&x.month===monthKey());if(!u){u={user_id:uid,month:monthKey(),generations:0,tutor_messages:0};DB.t.usage.push(u);}return u;}
const usedOf=uid=>cfg.used!=null&&cfg.used!==''?+cfg.used||0:usageRow(uid).generations; // used=N tylko nadpisuje odczyt (nie zmienia zapisanego licznika)
/* darmowe lekcje na zawsze (backend/0007): licznik po znormalizowanym adresie e-mail, nie po koncie — usunięcie konta go nie zeruje */
const mailKey=uid=>{const u=DB.users.find(x=>x.id===uid);return String(u&&u.email||'').trim().toLowerCase();};
const freeUsedOf=uid=>cfg.used!=null&&cfg.used!==''?+cfg.used||0:+(DB.free[mailKey(uid)]||0);
const bumpFree=uid=>{const k=mailKey(uid);DB.free[k]=(+DB.free[k]||0)+1;};
function quotaOf(uid){ // jak RPC generation_quota (+ freeLimit, globalOpen)
  const plan=planOf(uid),prof=DB.t.profiles.find(x=>x.id===uid)||null,trialUntil=prof&&prof.trial_until||null;
  const freeLimit=Math.max(0,Math.floor(+cfg.freecap||0)),globalOpen=cfg.global!=='full';
  if(plan==='pro'){const used=usedOf(uid),limit=PLANS.pro.generationsPerMonth;return {plan,scope:'month',used,limit,remaining:Math.max(0,limit-used),trialUntil,freeLimit,globalOpen};}
  const used=freeUsedOf(uid),limit=freeLimit;return {plan,scope:'lifetime',used,limit,remaining:Math.max(0,limit-used),trialUntil,freeLimit,globalOpen};
}
const charge=(uid,plan,us)=>{us.generations++;if(plan==='free')bumpFree(uid);}; // naliczenie: miesięczne usage zawsze, darmowe lekcje dla free
function refund(g){ // RPC release_generation (backend/0009): usage − 1 w miesiącu wiersza, darmowa lekcja wraca
  const u=DB.t.usage.find(x=>x.user_id===g.owner_id&&x.month===String(g.created_at||'').slice(0,7));if(u&&u.generations>0)u.generations--;
  if(planOf(g.owner_id)==='free'){const k=mailKey(g.owner_id);if(+DB.free[k]>0)DB.free[k]--;}}
const preCharge=x=>cfg.oldbe?(x||{}):Object.assign({charged:false},x||{}); // backend z 0009: odrzucenie przed naliczeniem mówi charged:false
async function api(u,m,h,b,signal){
  const p=u.pathname;
  const uid=userOf(h);
  if(p==='/api/me'&&m==='GET'){
    if(!uid)return aerr(401,'unauthorized','Wymagane logowanie');
    const plan=planOf(uid),us=usageRow(uid),prof=DB.t.profiles.find(x=>x.id===uid)||null,q=quotaOf(uid);
    const life=q.scope==='lifetime'; // pola dla starszych klientów: przy darmowych na zawsze niosą ten sam licznik („2 z 2”)
    return res(200,{profile:prof&&{...prof,plan},plan,usage:{month:us.month,generations:life?q.used:usedOf(uid),tutorMessages:us.tutor_messages},
      limits:life?{...PLANS.free,generationsPerMonth:q.limit,generationsLifetime:q.limit}:PLANS[plan],quota:q,subscription:null,
      // 0010 (docs/plan-media.md §2.7): bez migracji albo przy błędzie RPC — media:null, chat:null, wszystkie funkcje wyłączone
      media:cfg.nomedia?null:mediaQuota(uid),chat:cfg.nomedia?null:chatQuota(uid),
      features:cfg.nomedia?{reels:false,podcast:false,fox:false}:{reels:cfg.reels,podcast:cfg.reels&&cfg.voices,fox:cfg.fox}});
  }
  if(p==='/api/generate'&&m==='POST')return generate(uid,bodyJson(b),signal);
  if(p==='/api/media/reels'&&m==='POST')return mediaPost('reels',uid,bodyJson(b),signal);
  if(p==='/api/media/podcast'&&m==='POST')return mediaPost('podcast',uid,bodyJson(b),signal);
  if(p==='/api/media/podcast/chapter'&&m==='POST')return chapterPost(uid,bodyJson(b),signal);
  if(p==='/api/fox'&&m==='POST')return foxPost(uid,bodyJson(b),signal);
  return aerr(404,'not_found','mock: brak trasy '+m+' '+p);
}
const ERRS={ // kod → [status, czy liczy się do limitu (generationId), dodatkowe pola] — jak backend Build 7 (packages/ai/src/pipeline.ts)
  limit_reached:[402,false],too_many_files:[400,false],file_too_big:[400,false],too_much_material:[400,false,{maxMb:150}],bad_materials:[400,false],
  bad_pptx:[400,false],pptx_protected:[400,false],pptx_empty:[400,false],download_failed:[500,false],reserve_failed:[500,false],
  busy:[409,false],no_input:[400,false],too_long:[400,false,{tokens:412000,maxTokens:150000}], // przed naliczeniem: count_tokens > 150k
  ai_unavailable:[503,true], // backend/0009: naliczone i zwrócone (domyślnie), naliczone (:charged) albo przed naliczeniem (:precharge)
  generation_failed:[500,true],refusal:[500,true],invalid_output:[500,true],api:[500,true],lost:[500,true],
  not_found:[404,false],unauthorized:[401,false],no_config:[503,false],bad_request:[400,false]};
const BUSY_MS=7*60000; // reserve_generation: generacja queued/running młodsza niż 7 min = busy
async function generate(uid,d,signal){
  if(!uid)return aerr(401,'unauthorized','Wymagane logowanie');
  if(!d||typeof d!=='object'||!UUID.test(String(d.subjectId||''))||!Array.isArray(d.materialIds||[])||(d.materialIds||[]).length>50)return aerr(400,'bad_request','Nieprawidłowe body');
  const ids=d.materialIds||[],text=typeof d.text==='string'?d.text:'',o=d.options||{};
  if(!ids.length&&!text.trim())return aerr(400,'bad_request','Tryb „materials” wymaga plików (materialIds) albo tekstu.');
  if(text.length>200000)return aerr(400,'bad_request','Tekst jest za długi');
  const subj=DB.t.subjects.find(s=>s.id===d.subjectId);if(!subj||subj.owner_id!==uid)return aerr(404,'not_found','Nie znaleziono przedmiotu');
  const plan=planOf(uid),lim=PLANS[plan];
  if(ids.length>lim.filesPerGeneration)return aerr(400,'too_many_files',`Max ${lim.filesPerGeneration} plików w planie ${lim.label}`);
  const mats=DB.t.materials.filter(x=>x.owner_id===uid&&ids.includes(x.id));
  if(mats.length!==ids.length||new Set(ids).size!==ids.length)return aerr(400,'bad_materials','Część materiałów nie istnieje albo nie należy do Ciebie');
  const big=mats.find(x=>(+x.size_bytes||0)>lim.maxFileMb*MB);if(big)return aerr(400,'file_too_big',`Plik „${big.name||big.id}” przekracza ${lim.maxFileMb} MB`,{name:big.name||undefined,maxMb:lim.maxFileMb});
  if(mats.reduce((a,x)=>a+(+x.size_bytes||0),0)>150*MB)return aerr(400,'too_much_material','Za dużo materiału',{maxMb:150});
  const us=usageRow(uid),q=quotaOf(uid);
  const g=String(cfg.gen||'ok'),[mode,arg,arg2]=g.split(':');
  if(mode==='err'){ // wymuszony błąd serwera — z generationId, gdy prawdziwy serwer pobrałby już limit
    const code=arg||'generation_failed',e=ERRS[code]||[500,true];const extra=Object.assign({},e[2]||{});
    if(code==='limit_reached'){extra.used=arg2!=null?+arg2:Math.max(q.used,q.limit);extra.limit=q.limit;if(extra.used<999999)extra.scope=q.scope;}
    if(/^(file_too_big|bad_pptx|pptx_protected|pptx_empty|bad_materials)$/.test(code))extra.name=(mats[0]&&mats[0].name)||'notatki.pdf';
    if(code==='file_too_big')extra.maxMb=lim.maxFileMb;
    if(code==='too_many_files')extra.max=lim.filesPerGeneration;
    let msg=code==='api'?'AI: 529 overloaded':'mock: '+code,rowErr='mock: '+code,counts=e[1],refunded=false;
    if(code==='api'){ // jak backend: „AI: <status> <komunikat API>”; reason material tylko z backendu z 0009
      const A={material:['AI: 400 The PDF specified is password protected.','material'],'401':['AI: 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}'],
        '400':['AI: 400 {"type":"error","error":{"type":"invalid_request_error","message":"thinking: unexpected value"}}']}[arg2];
      if(A){msg=A[0];if(A[1]&&!cfg.oldbe)extra.reason=A[1];}}
    else if(code==='ai_unavailable'){ // backend/0009 (incydent 2026-10-16)
      msg='Tworzenie lekcji chwilowo nie działa. To problem po naszej stronie, nie z Twoim materiałem. '+(arg2==='charged'?'Spróbuj ponownie za kilka minut.':'Limit się nie zmienił — spróbuj ponownie za kilka minut.');
      if(arg2==='precharge')counts=false;
      else if(arg2==='charged')rowErr='ai_unavailable: 529 overloaded_error [req_mock]';
      else{refunded=true;rowErr='released:ai_unavailable: 401 authentication_error [req_mock]: invalid x-api-key';}}
    else if(code!=='limit_reached'&&arg2)extra.reason=arg2; // lost:ai_timeout, reserve_failed:ai_upload, download_failed:slow_intake
    if(counts){charge(uid,plan,us);const gid=uuid(),row={id:gid,owner_id:uid,subject_id:subj.id,status:'failed',error:rowErr,material_ids:ids,stage:o.stage||null,options:o,created_at:iso(),finished_at:iso()};
      DB.t.generations.push(row);extra.generationId=gid;if(refunded){refund(row);row.refunded_at=iso();extra.refunded=true;}save();}
    if(!cfg.oldbe)extra.charged=!!counts&&!refunded; // backend z 0009: każda odpowiedź z błędem mówi, czy próba się liczy
    await sleep(code==='api'||code==='generation_failed'||code==='lost'||code==='ai_unavailable'?2500:600,signal);
    return aerr(e[0],code,msg,extra);
  }
  if(mode==='html504'){charge(uid,plan,us);DB.t.generations.push({id:uuid(),owner_id:uid,subject_id:subj.id,status:'running',error:null,material_ids:ids,created_at:iso()});save();
    await sleep(3000,signal);return res(504,'<!DOCTYPE html><html><body>An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT</body></html>',{'Content-Type':'text/html'});}
  // rezerwacja jak RPC reserve_generation (0007): busy → dobowy (20 / konto) → limit planu (free: na zawsze, pro: miesięczny), wszystko przed podbiciem licznika
  lazyGenerations();
  if(DB.t.generations.some(x=>x.owner_id===uid&&(x.status==='running'||x.status==='queued')&&Date.parse(x.created_at)>now()-BUSY_MS))
    return aerr(409,'busy','Trwa już tworzenie innej lekcji. Poczekaj, aż się skończy, i spróbuj ponownie.',preCharge());
  if(DB.t.generations.filter(x=>x.owner_id===uid&&Date.parse(x.created_at)>now()-86400000).length>=20)return aerr(402,'limit_reached','Dzienny limit',preCharge({used:999999,limit:lim.generationsPerMonth}));
  if(q.used>=q.limit)return q.scope==='lifetime'?aerr(402,'limit_reached',`Wykorzystano ${Math.min(q.used,q.limit)}/${q.limit} darmowych lekcji`,preCharge({used:q.used,limit:q.limit,scope:'lifetime'}))
    :aerr(402,'limit_reached',`Wykorzystano ${q.used}/${q.limit} generacji w tym miesiącu`,preCharge({used:q.used,limit:q.limit,scope:'month'}));
  if(cfg.global==='full')return aerr(402,'limit_reached','Serwer ma teraz bardzo dużo pracy. Spróbuj później.',preCharge({used:1999999,limit:lim.generationsPerMonth})); // limit globalny (i pula free) po limicie planu
  charge(uid,plan,us);
  const gid=uuid(),gen={id:gid,owner_id:uid,subject_id:subj.id,status:'running',error:null,topic_id:null,material_ids:ids,stage:o.stage||null,options:o,hint:o.hint||null,created_at:iso(),finished_at:null};
  DB.t.generations.push(gen);save();
  const content=await topicContent(cfg.genfx);
  if(mode==='drop'||mode==='dropfail'||mode==='droprelease'){ // odpowiedź ginie po drodze, serwer kończy sam (klient odzyskuje przez tabelę generations)
    gen._finishAt=now()+(+arg>0?+arg:20)*1000;gen._outcome=mode==='dropfail'?'fail':mode==='droprelease'?'release':'ok';gen._content=content;save();
    await sleep(1500,signal);throw new TypeError('Failed to fetch');
  }
  await sleep(mode==='slow'?(+arg>0?+arg:25)*1000:1500,signal);
  const t=insertTopic(subj.id,uid,content,null,gid);gen.status='done';gen.topic_id=t.id;gen.model=mode==='demo'?'demo':'claude-opus-5';gen.finished_at=iso();save();
  return res(200,{generationId:gid,topicId:t.id,topic:{id:t.id,subjectId:t.subject_id,name:t.name,content:t.content},demo:mode==='demo'});
}

/* ============================================================ MEDIA I ROZMOWA Z LISEM (docs/plan-media.md §2.2–2.7, backend/0010) */
/* punkty tematu: kopia topicPoints() z nauka-backend packages/shared/src/media.ts (i mapPoints() w cloud.js), żeby surowe id punktów
   (p3, Ll2) zgadzały się z klientem: złe odwołania i duplikaty odpadają; punkt bez tytułu odpada; pytania i fiszki bez punktu → punkt
   zastępczy ich poziomu (doklejony na końcu); punkt z < 3 elementami albo < 2 z SRS łączy się z następnym (ostatni z poprzednim);
   < 3 punkty (licząc zastępcze) → jeden punkt na poziom (id "L"+level.id). */
function topicPoints(c){
  c=c&&typeof c==='object'?c:{};const L=arr(c.levels).filter(l=>l&&typeof l.id==='string'&&l.id);
  const byId=new Map(L.map(l=>[l.id,l])),order=new Map(L.map((l,i)=>[l.id,i]));
  const txt=(v,n)=>{if(typeof v!=='string')return '';let t=v.replace(/[\p{Extended_Pictographic}️‍]/gu,'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim();return t.length>n?t.slice(0,n-1).trimEnd()+'…':t;};
  const listOf=(l,k)=>arr(k==='quiz'?l.quiz:k==='flashcard'?l.flashcards:l.tasks);
  const fallback=()=>L.map(l=>{const id=l.id,t=txt(l.title,120)||id;return {id:'L'+id,title:t,short:t.length>24?t.slice(0,23).trimEnd()+'…':t,fb:true,levels:[id],
    items:[...arr(l.flashcards).map((_,i)=>({kind:'flashcard',level:id,index:i})),...arr(l.quiz).map((_,i)=>({kind:'quiz',level:id,index:i})),...arr(l.tasks).map((_,i)=>({kind:'task',level:id,index:i}))]};});
  const raw=arr(c.keyPoints);if(!raw.length)return fallback();
  const seen=new Set(),ids=new Set();let pts=[];
  for(const rp of raw){const p=rp&&typeof rp==='object'?rp:{},id=typeof p.id==='string'?p.id:'';if(!/^p\d{1,2}$/.test(id)||ids.has(id))continue;
    const title=txt(p.title,120)||txt(p.short,120);if(!title)continue;const items=[];
    for(const it of arr(p.items)){const x=it&&typeof it==='object'?it:{},kind=['quiz','flashcard','task'].includes(x.kind)?x.kind:null,lv=byId.get(x.level);
      if(!kind||!lv||!Number.isInteger(x.index)||x.index<0||x.index>=listOf(lv,kind).length)continue;const k=kind+':'+x.level+':'+x.index;if(seen.has(k))continue;seen.add(k);items.push({kind,level:x.level,index:x.index});}
    ids.add(id);const sh=txt(p.short,60)||title;pts.push({id,title,short:sh.length>24?sh.slice(0,23).trimEnd()+'…':sh,items,levels:[],fb:false});}
  const extra=new Map();
  for(const l of L)for(const kind of ['flashcard','quiz'])listOf(l,kind).forEach((_,index)=>{if(seen.has(kind+':'+l.id+':'+index))return;let p=extra.get(l.id);
    if(!p){const t=txt(l.title,120)||l.id;p={id:'L'+l.id,title:t,short:t.length>24?t.slice(0,23).trimEnd()+'…':t,items:[],levels:[],fb:true};extra.set(l.id,p);}p.items.push({kind,level:l.id,index});});
  pts=pts.concat([...extra.values()]);
  const valid=p=>p.items.length>=3&&p.items.filter(x=>x.kind!=='task').length>=2;
  for(let g=0;g<100;g++){const i=pts.findIndex(p=>!valid(p));if(i<0||pts.length<2)break;const tg=i+1<pts.length?pts[i+1]:pts[i-1];tg.items=tg.items.concat(pts[i].items);pts.splice(i,1);}
  if(pts.length<3||pts.some(p=>!valid(p)))return fallback();
  pts.forEach(p=>{p.items.sort((a,b)=>order.get(a.level)-order.get(b.level));p.levels=[...new Set(p.items.map(x=>x.level))].sort((a,b)=>order.get(a)-order.get(b));});
  return pts;
}
/* manifest rolek dla dowolnego tematu (zamiast AI): punkty po kolei do rolek, pytanie końcowe = pierwsze nieużyte pytanie punktów rolki */
function reelFileList(reels){const out=[];reels.forEach(r=>{const n=+r.n||1,f=r.files||{},base=xssFx()?'media/xss/sb-xss':(n%2?'media/sb-a':'media/sb-b');
  out.push([f.storyboard,{fx:base+'.json',reel:n}],[f.audio,{fx:base+'.mp3'}],[f.words,{fx:base+'.words.json'}]);});return out;}
function buildReels(row,content,types,focus){
  const pts=topicPoints(content),used=new Set(),allQ=pts.flatMap(p=>p.items.filter(x=>x.kind==='quiz'));
  const key=q=>q.level+'#'+q.index;
  const pick=g=>{for(const p of g)for(const q of p.items)if(q.kind==='quiz'&&!used.has(key(q))){used.add(key(q));return q;}
    const q=allQ.find(x=>!used.has(key(x)))||allQ[0];if(q)used.add(key(q));return q;};
  const groups=focus?[[pts.find(p=>p.id===focus)].filter(Boolean)]:types.map(()=>[]);
  if(!focus)pts.forEach((p,i)=>groups[i%groups.length].push(p));
  const reels=groups.map((g,i)=>{const n=i+1,ty=types[i]||'czym',q=pick(g)||{level:'l1',index:0},first=g[0]||pts[0]||{short:'',id:'p1'};
    const lv=arr(content.levels).find(l=>String(l.id)===q.level);
    return {n,type:ty,title:REEL_LABEL[ty]+': '+first.short,durSec:45+((n*7)%15)+0.4,pointIds:g.map(p=>p.id),quizRef:{level:q.level,index:q.index},
      feedRef:lv&&arr(lv.feed).length?{level:q.level,index:0}:null,files:{storyboard:`r${n}.json`,audio:`r${n}.mp3`,words:`r${n}.words.json`},rate:1.15,thumb:THUMBS[i%4]};});
  const name=String(content.short||content.name||'materiał');
  return {v:1,kind:'reels',title:focus&&reels[0]?reels[0].title:'Najważniejsze z „'+name+'”',topicId:row.topic_id,
    coverage:{points:pts.length,covered:new Set(reels.flatMap(r=>r.pointIds)).size},reels};
}
const MSGIP1_NAME='Wykład 1–2: pojęcia i podmioty MSGiP';
async function buildPodcast(row,content){
  if(xssFx()||String(content.name)===MSGIP1_NAME){ // materiał 01 (albo XSS): skrypt i pauzy z fixture'ów, żaden rozdział jeszcze nienagrany
    const man=await fixture(xssFx()?'media/xss/podcast-xss':'media/podcast-msgip');man.topicId=row.topic_id;
    arr(man.chapters).forEach(c=>{c.status='script';c.durSec=null;c.files=null;});
    return {man,script:null,scriptFx:xssFx()?'media/xss/script-xss.json':'media/podcast-script.json'};}
  const pts=topicPoints(content),N=pts.length>=8?8:6,used=new Set(),allQ=pts.flatMap(p=>p.items.filter(x=>x.kind==='quiz'));
  const groups=Array.from({length:N},()=>[]);pts.forEach((p,i)=>groups[i%N].push(p));groups.forEach((g,i)=>{if(!g.length&&pts.length)g.push(pts[i%pts.length]);});
  const chapters=[],sc=[];
  groups.forEach((g,i)=>{const n=i+1;let q=null,pp=g[0];
    for(const p of g){q=p.items.find(x=>x.kind==='quiz'&&!used.has(x.level+'#'+x.index));if(q){pp=p;break;}}
    if(!q)q=allQ.find(x=>!used.has(x.level+'#'+x.index))||null;if(q)used.add(q.level+'#'+q.index);
    sc.push({n,title:pp?pp.short:'Rozdział '+n,lines:podLines(content,g)});
    chapters.push({n,title:pp?pp.short:'Rozdział '+n,pointIds:g.map(p=>p.id),levelIds:[...new Set(g.flatMap(p=>p.levels))],estSec:180+((n*13)%40),durSec:null,status:'script',
      pauses:q&&pp?[{afterLine:1,quizRef:{level:q.level,index:q.index},pointId:pp.id,lead:'Szop pomylił się przy „'+pp.short+'”. Jak jest naprawdę?'}]:[],files:null});});
  const title='Lis i Szop: '+String(content.short||content.name||'materiał');
  return {man:{v:1,kind:'podcast',title,topicId:row.topic_id,estSec:chapters.reduce((a,c)=>a+c.estSec,0),files:{script:'script.json'},chapters},script:{v:1,title,chapters:sc}};
}
function podLines(content,g){ // skrypt bez AI: lis tłumaczy pojęcia z fiszek punktu, szop się myli (linijka 1 = pomyłka przed pauzą)
  const L=new Map(arr(content.levels).map(l=>[String(l.id),l])),strip=s=>String(s==null?'':s).replace(/<[^>]*>/g,'');
  const cards=g.flatMap(p=>p.items.filter(x=>x.kind==='flashcard').map(x=>arr((L.get(x.level)||{}).flashcards)[x.index]).filter(Boolean)).slice(0,3);
  const c0=cards[0]||{t:(g[0]||{}).short||'temat',d:(g[0]||{}).title||''};
  const out=[{s:'lis',t:`Dziś: **${strip(c0.t)}**. ${strip(c0.d)}`},{s:'szop',t:`Czyli ${strip(c0.t)} to nic ważnego, można to pominąć!`},{s:'lis',t:`Nie można. ${strip(c0.d)}`}];
  cards.slice(1).forEach(c=>{out.push({s:'szop',t:`A **${strip(c.t)}**?`},{s:'lis',t:strip(c.d)});});
  return out;
}
/* czasy słów jak w test/fixtures/media/make-media.mjs (szacunek z prototypu), przeskalowane do długości nagrania */
const r3=x=>Math.round(x*1000)/1000,letters=w=>(w.match(/[\p{L}\p{N}]/gu)||[]).length;
function estTokens(text,t0){const out=[];let t=t0;
  for(const m of String(text).matchAll(/\[[^\]]+\]|\S+/g)){const w=m[0];if(w[0]==='['){out.push({w,start:t,end:t+0.05,tag:true});t+=0.06;continue;}
    const d=0.09+0.053*letters(w);out.push({w,start:t,end:t+d*0.92});t+=d;if(/[.?!…]["”]?$/.test(w))t+=0.32;else if(/[,;:—–]$/.test(w))t+=0.18;}
  return {words:out,t};}
function chapterTiming(lines,pauses,dur){
  let t=0.2;const L=lines.map((x,i)=>{const {words,t:t1}=estTokens(String(x&&x.t||'').replace(/\*\*/g,''),t);const o={i,s:x&&x.s,start:t,end:t1,words};t=t1+0.45;return o;});
  const f=dur/(t+0.3),sc=v=>r3(v*f);L.forEach(o=>{o.start=sc(o.start);o.end=sc(o.end);o.words.forEach(w=>{w.start=sc(w.start);w.end=sc(w.end);});});
  return {v:1,duration:dur,lines:L,pauses:pauses.map(p=>({afterLine:p.afterLine,at:L[p.afterLine]?L[p.afterLine].end:dur}))};
}
async function chapterSynth(r,c){ // {data: czasy | null (gotowe czasy z fixture'u), dur}
  const n=c.n,sk=DB.mobjects[r.owner_id+'/'+r.id+'/script.json'],base=xssFx()?'media/xss/c-xss':'media/c'+(n%2?1:2),dur=(await fixture(base)).duration;
  if(sk&&((sk.fx==='media/podcast-script.json'&&n<=2)||(sk.fx==='media/xss/script-xss.json'&&n===1)))return {data:null,dur};
  const script=sk?(sk.data||await fixture(String(sk.fx).replace(/\.json$/,''))):null;const ch=script&&arr(script.chapters).find(x=>x&&x.n===n);
  return {data:chapterTiming(arr(ch&&ch.lines),arr(c.pauses),dur),dur};
}
function readyChapter(r,c){const s=c._synth||{data:null,dur:null};chapterFiles(r.owner_id,r.id,c.n,s.data);
  c.status='ready';c.durSec=s.dur;c.files={audio:'c'+c.n+'.mp3',timing:'c'+c.n+'.json'};delete c.synthAt;delete c._readyAt;delete c._synth;r.updated_at=iso();}
const noInternal=v=>{if(Array.isArray(v))return v.map(noInternal);if(v&&typeof v==='object'){const o={};Object.keys(v).forEach(k=>{if(k[0]!=='_')o[k]=noInternal(v[k]);});return o;}return v;};
/* wiersz w toku: plan → script → voice → save (podcast bez voice) według czasu; frozen = stoi (seed media=running) */
const STEPS={reels:[['plan',0.1],['script',0.35],['voice',0.85],['save',1]],podcast:[['plan',0.15],['script',0.85],['save',1]]};
function finishMedia(r){const w=r._walk||{};
  if(String(w.outcome||'ok').startsWith('fail:')){const code=w.outcome.slice(5);if(code==='refusal')failMedia(r,'refusal: mock');else releaseMedia(r,code+': mock');return;}
  r.status='ready';r.phase='save';r.progress={step:'save',done:1,total:1};r.manifest=r._man||r.manifest;r.title=r.manifest&&r.manifest.title||null;r.finished_at=iso();r.updated_at=iso();
  r.model='claude-sonnet-5';r.tts_chars=r.kind==='reels'?3800:0;arr(r._files).forEach(([f,v])=>setMobj(r.owner_id,r.id,f,v));delete r._walk;delete r._man;delete r._files;}
function releaseMedia(r,reason){if(r.status==='ready'||r.refunded_at)return;r.status='failed';r.charged=false;r.refunded_at=iso();r.error='released:'+String(reason).slice(0,200);r.finished_at=iso();r.updated_at=iso();
  if(r._counted&&DB.mused[r.owner_id]>0)DB.mused[r.owner_id]--;delete r._walk;delete r._man;delete r._files;}
function failMedia(r,reason){r.status='failed';r.error=String(reason).slice(0,200);r.finished_at=iso();r.updated_at=iso();delete r._walk;delete r._man;delete r._files;}
function lazyMedia(){
  let ch=false;const t=now();
  DB.t.media.forEach(r=>{
    if(r.status==='running'&&r._walk){const w=r._walk,f=w.frozen?0.55:Math.min(1,(t-w.t0)/w.dur),st=STEPS[r.kind]||STEPS.reels;
      if(f>=1&&!w.frozen){finishMedia(r);ch=true;}
      else{let prev=0,step='save',done=0,total=1;for(const [name,end] of st){if(f<end){step=name;total=name==='plan'||name==='save'?1:w.n||5;done=Math.max(0,Math.min(total-1,Math.floor((f-prev)/(end-prev)*total)));break;}prev=end;}
        if(r.phase!==step||!r.progress||r.progress.done!==done||r.progress.total!==total){r.phase=step;r.progress={step,done,total};r.updated_at=iso();ch=true;}}}
    if(r.status==='running'&&!(r._walk&&r._walk.frozen)&&Date.parse(r.created_at)<t-8*60000){releaseMedia(r,'timeout:sweeper');ch=true;} // sweep_stale_media
    if(r.kind==='podcast'&&r.manifest)arr(r.manifest.chapters).forEach(c=>{if(c&&c.status==='synth'&&c._readyAt&&c._readyAt<=t){readyChapter(r,c);ch=true;}});
  });
  if(ch)save();
}
function mediaQuota(uid){ // RPC media_quota
  lazyMedia();const plan=mediaPlan(uid),limit=mediaLimit(uid),used=Math.min(DB.mused[uid]|0,limit+999),[fe,fa]=String(cfg.mediaerr||'').split(':');
  const day=DB.t.media.filter(r=>r.owner_id===uid&&Date.parse(r.created_at)>now()-DAY_MS).length;
  const b=DB.t.media.find(r=>r.owner_id===uid&&r.status==='running');
  return {plan,scope:plan==='pro'?'month':'lifetime',used,limit,remaining:Math.max(0,limit-used),dailyLeft:Math.max(0,MEDIA_CFG.media_daily_per_user-day),
    globalOpen:!(fe==='limit_reached'&&fa==='global'),busy:b?{id:b.id,kind:b.kind,topicId:b.topic_id}:null};
}
function chatRow(uid){const day=ymd(0);let c=DB.chat[uid];if(!c||c.day!==day)c=DB.chat[uid]={day,used:0};return c;}
function chatQuota(uid){const c=chatRow(uid),limit=chatLimit(uid),[fe,fa]=String(cfg.foxerr||'').split(':');
  return {day:c.day,used:c.used,limit,remaining:Math.max(0,limit-c.used),globalOpen:!(fe==='limit_reached'&&fa==='chat_global')};}

const MEDIA_ERR={busy:409,conflict:409,limit_reached:402,tts_unavailable:503,voices_missing:503,ai_unavailable:503,no_config:503,media_unavailable:503,reserve_failed:500,
  no_quiz:400,bad_point:400,bad_request:400,not_found:404,unauthorized:401,not_ready:409,chapter_busy:409,chapter_failing:429,tts_budget:429,synth_failed:500,fox_failed:500};
const MEDIA_MSG={busy:'Przygotowuję już coś innego. Gdy skończę, możesz zlecić kolejne.',limit_reached:'Na razie nie przygotuję więcej rolek ani podcastów.',
  tts_unavailable:'Lektor chwilowo nie działa. To problem po naszej stronie.',voices_missing:'Podcast będzie dostępny wkrótce.',ai_unavailable:'AI chwilowo nie działa. To problem po naszej stronie.',
  media_unavailable:'Rolki i podcast nie są jeszcze dostępne.',reserve_failed:'Nie udało się zarezerwować tworzenia.',no_quiz:'Ten materiał nie ma pytań, a każda rolka kończy się pytaniem.',
  bad_point:'Nie ma takiego punktu w tym materiale.',bad_request:'Nieprawidłowe body',not_found:'Nie znaleziono',unauthorized:'Wymagane logowanie',conflict:'To żądanie należy do innego konta.',
  not_ready:'Podcast nie jest jeszcze gotowy.',chapter_busy:'Ten rozdział właśnie się nagrywa.',chapter_failing:'Tego rozdziału dziś nie nagram. Spróbuj jutro.',tts_budget:'Dziś nagrywam już bardzo dużo. Spróbuj jutro.',synth_failed:'Nie udało się nagrać rozdziału.',
  fox_failed:'Lis nie odpowiedział. To błąd po naszej stronie.'};
const merr=(code,extra)=>aerr(MEDIA_ERR[code]||500,code,MEDIA_MSG[code]||('mock: '+code),Object.assign({charged:false},extra||{}));
const cerr=code=>aerr(MEDIA_ERR[code]||500,code,MEDIA_MSG[code]||('mock: '+code)); // błędy /api/media/podcast/chapter: jak na serwerze bez pola charged (rozdział nigdy nie jest naliczany)

/* POST /api/media/reels | /api/media/podcast — kolejność jak w §2.2: przed kosztem ai → tts → (podcast) voices → auth → body → idempotencja (requestId) →
   temat → pytania → punkt → rezerwacja (busy → dzienny → plan → globalny) → 202 i „praca w tle” (wiersz idzie według czasu, mediagen) */
async function mediaPost(kind,uid,d,signal){
  lazyMedia();
  const [fe,fa]=String(cfg.mediaerr||'').split(':');
  if(fe==='no_config')return merr('no_config');
  if(fe==='ai_unavailable')return merr('ai_unavailable');
  if(fe==='tts_unavailable'||!cfg.reels)return merr('tts_unavailable');
  if(kind==='podcast'&&(fe==='voices_missing'||!cfg.voices))return merr('voices_missing');
  if(!uid)return merr('unauthorized');
  if(!d||typeof d!=='object'||!UUID.test(String(d.requestId||''))||!UUID.test(String(d.topicId||'')))return merr('bad_request');
  if(kind==='reels'){const ty=d.types,fp=d.focusPointId;
    if(!Array.isArray(ty)||!ty.length||ty.length>6||new Set(ty).size!==ty.length||!ty.every(x=>REEL_TYPES.includes(x)))return merr('bad_request');
    if(fp!=null&&(typeof fp!=='string'||!/^(p\d{1,2}|L[A-Za-z0-9_-]{1,40})$/.test(fp)||ty.length!==1))return merr('bad_request');
    if(fp==null&&ty.length<3)return merr('bad_request');}
  const ex=DB.t.media.find(r=>r.id===d.requestId);
  if(ex)return ex.owner_id!==uid||ex.kind!==kind?merr('conflict'):res(200,{media:publicRow(ex)}); // to samo requestId (i rodzaj): bez naliczenia; cudze albo inny rodzaj → 409 jak na serwerze
  const tp=DB.t.topics.find(t=>t.id===d.topicId&&t.owner_id===uid);if(!tp)return merr('not_found');
  if(fe==='no_quiz'||!arr(tp.content&&tp.content.levels).some(l=>arr(l.quiz).length))return merr('no_quiz');
  if(kind==='reels'&&(fe==='bad_point'||(d.focusPointId!=null&&!topicPoints(tp.content).some(p=>p.id===d.focusPointId))))return merr('bad_point');
  if(cfg.nomedia||fe==='media_unavailable')return merr('media_unavailable');
  if(fe==='reserve_failed')return merr('reserve_failed');
  const q=mediaQuota(uid),busyRow=DB.t.media.find(r=>r.owner_id===uid&&r.status==='running'&&((r._walk&&r._walk.frozen)||Date.parse(r.created_at)>now()-5.5*60000));
  if(fe==='busy'||busyRow){const b=busyRow||{id:IDS.mReels2,kind:'reels',topic_id:d.topicId};return merr('busy',{busy:{id:b.id,kind:b.kind,topicId:b.topic_id}});}
  if(fe==='limit_reached'){const reason=fa||q.scope;return merr('limit_reached',reason==='daily'||reason==='global'?{reason}:{reason,scope:reason,used:Math.max(q.used,q.limit),limit:q.limit});}
  if(q.dailyLeft<=0)return merr('limit_reached',{reason:'daily'});
  if(q.remaining<=0)return merr('limit_reached',{reason:q.scope,scope:q.scope,used:q.used,limit:q.limit});
  const spec=kind==='reels'?{types:d.types.slice(),...(d.focusPointId?{focusPointId:d.focusPointId}:{})}:{};
  const row=mediaRow({id:d.requestId,owner_id:uid,subject_id:tp.subject_id,topic_id:tp.id,kind,spec,_counted:true});
  const [gm,ga,gb]=String(cfg.mediagen||'fast').split(':');
  const secs=gm==='slow'?(+ga>0?+ga:60):gm==='fail'?(+gb>0?+gb:4):4;
  let man,files;
  if(kind==='reels'){man=buildReels(row,tp.content,d.types,d.focusPointId||null);files=reelFileList(man.reels);}
  else{const b=await buildPodcast(row,tp.content);man=b.man;files=[['script.json',b.script?{data:b.script}:{fx:b.scriptFx}]];}
  row._man=man;row._files=files;row._walk={t0:now(),dur:secs*1000,n:kind==='reels'?man.reels.length:man.chapters.length,outcome:gm==='fail'?'fail:'+(ga||'invalid_output'):'ok'};
  DB.mused[uid]=(DB.mused[uid]|0)+1;DB.t.media.push(row);save();
  if(fe==='unknown'){await sleep(800,signal);if(fa==='html')return res(504,'<!DOCTYPE html><html><body>FUNCTION_INVOCATION_TIMEOUT</body></html>',{'Content-Type':'text/html'});throw new TypeError('Failed to fetch');}
  await sleep(250,signal);
  return res(202,{media:publicRow(row)});
}
/* POST /api/media/podcast/chapter — synchronicznie; rozdział nagrany = mp3 c1/c2 z fixture'ów + czasy (fixture albo policzone ze skryptu) */
async function chapterPost(uid,d,signal){
  lazyMedia();
  const [ce,ca]=String(cfg.chapter||'').split(':');
  if(!cfg.reels)return cerr('tts_unavailable');
  if(!cfg.voices||(ce==='err'&&ca==='voices_missing'))return cerr('voices_missing');
  if(!uid)return cerr('unauthorized');
  if(!d||typeof d!=='object'||!UUID.test(String(d.mediaId||''))||!Number.isInteger(d.chapter)||d.chapter<1||d.chapter>20)return cerr('bad_request');
  const r=DB.t.media.find(x=>x.id===d.mediaId&&x.owner_id===uid);if(!r||r.kind!=='podcast')return cerr('not_found');
  if(ce==='err'&&ca==='not_found')return cerr('not_found');
  if(r.status!=='ready'||!r.manifest||(ce==='err'&&ca==='not_ready'))return cerr('not_ready');
  const c=arr(r.manifest.chapters).find(x=>x&&x.n===d.chapter);if(!c)return cerr('not_found');
  if(c.status==='ready')return res(200,{chapter:noInternal(c)}); // z pamięci podręcznej, bez syntezy
  if(c.status==='synth'&&c.synthAt&&Date.parse(c.synthAt)>now()-180000)return cerr('chapter_busy');
  if(ce==='busy'){c.status='synth';c.synthAt=iso();c._readyAt=now()+5000;c._synth=await chapterSynth(r,c);save();return cerr('chapter_busy');} // nagrywa inne urządzenie
  if(ce==='err'&&ca==='tts_budget')return cerr('tts_budget');
  if(ce==='err'&&ca==='chapter_failing')return cerr('chapter_failing'); // 3 nieudane nagrania tego rozdziału dziś (0010: claim → failing)
  c.status='synth';c.synthAt=iso();save();
  try{await sleep(ce==='slow'?(+ca>0?+ca:10)*1000:1500,signal);}catch(e){c.status='script';delete c.synthAt;save();throw e;}
  if(ce==='err'){c.status='script';delete c.synthAt;save();return cerr(ca==='tts_unavailable'?'tts_unavailable':'synth_failed');}
  c._synth=await chapterSynth(r,c);readyChapter(r,c);save();
  return res(200,{chapter:noInternal(c)});
}

/* POST /api/fox — odpowiedzi z test/fixtures/media/fox-msgip.json (foxfx=xss: xss/fox-xss.json). Tura liczona przez serwer, nie przez model —
   foxPlan() to kopia logiki z nauka-backend packages/ai/src/media/fox.ts: odpowiedź = każda wiadomość „user” poza chipem „Podpowiedz”; chip „Nie wiem”
   jako wiadomość ucznia liczy się jako odpowiedź; step idk bez takiej wiadomości dolicza pominiętą odpowiedź tylko w tym żądaniu. Rozmowa po końcu →
   400 too_many_turns, krok niepasujący do rozmowy → 400 bad_step (przed naliczeniem); finish bez odpowiedzi i finish w „Wytłumacz mi” → koniec bez AI.
   Ocena w atrapie: „nie wiem” albo < 8 znaków = wrong, ≥ 30 znaków = ok, reszta = partial. Egzamin: ok 90, partial 55, wrong 15 na odpowiedź,
   średnia na pytanie, pct = średnia pytań (ocenę liczy klient). */
const FOX_MODES=['explain','quiz','exam'],FOX_STEPS=['start','answer','hint','idk','finish'];
const FOX_MAX={explain:2,quiz:5,exam:6},HINT_CHIP=/^\s*podpowied[zź]\.?\s*$/i,IDK_CHIP=/^\s*nie wiem\.?\s*$/i;
function foxValid(d){
  if(!d||typeof d!=='object'||!UUID.test(String(d.subjectId||''))||!FOX_MODES.includes(d.mode)||!FOX_STEPS.includes(d.step))return false;
  if(!Array.isArray(d.topicIds)||d.topicIds.length<1||d.topicIds.length>8||!d.topicIds.every(x=>UUID.test(String(x)))||new Set(d.topicIds).size!==d.topicIds.length)return false;
  if(d.pointIds!=null&&(!Array.isArray(d.pointIds)||d.pointIds.length>20||!d.pointIds.every(x=>typeof x==='string'&&/^[0-9a-f-]{36}:(p\d{1,2}|L[A-Za-z0-9_-]{1,40})$/i.test(x))))return false;
  if(d.pointIds!=null&&!d.pointIds.every(x=>d.topicIds.map(t=>t.toLowerCase()).includes(x.slice(0,36).toLowerCase())))return false; // punkt spoza wybranych materiałów (zod superRefine)
  if(d.mode==='explain'&&arr(d.pointIds).length!==1)return false;
  const ms=d.messages==null?[]:d.messages;if(!Array.isArray(ms)||ms.length>30||!ms.every(m=>m&&(m.role==='fox'||m.role==='user')&&typeof m.text==='string'&&m.text.length<=1500))return false;
  return true;
}
function foxPlan(mode,step,ms){
  const max=FOX_MAX[mode],answers=ms.filter(m=>m.role==='user'&&!HINT_CHIP.test(m.text)).length,last=ms[ms.length-1];
  const P=(kind,next,o)=>Object.assign({kind,next},o||{});
  if(step==='start')return answers>0?{err:'bad_step'}:P('ask','question',{n:1});
  if(step==='finish'){if(!answers||mode==='explain')return P('local_end','end');return P('result','finish',{turn:answers,graded:false});}
  if(step==='hint'){const p=answers+1;if(p>max)return {err:'too_many_turns'};
    if(mode==='explain')return P('hint',p===2?'followup':'question',{n:1});if(mode==='quiz')return P('hint','question',{n:p});return P('hint',p%2===0?'followup':'question',{n:Math.ceil(p/2)});}
  const idk=step==='idk';
  if(!idk&&(!last||last.role!=='user'||!last.text.trim()||HINT_CHIP.test(last.text)))return {err:'bad_step'};
  const extra=idk&&!(last&&last.role==='user'&&IDK_CHIP.test(last.text)),t=extra?answers+1:answers;
  if(t>max)return {err:'too_many_turns'};
  if(mode==='explain')return idk?P('explain_end','end',{turn:t,idk}):t===1?P('grade_followup','followup',{turn:t}):P('grade_end','end',{turn:t});
  if(mode==='quiz')return t<5?P('grade_next','question',{turn:t,n:t+1,idk,extra}):P('result','finish',{turn:t,graded:true,idk,extra});
  const k=Math.ceil(t/2);
  if(t%2===1)return P('grade_followup','followup',{turn:t,n:k,idk,extra});
  return k<3?P('grade_next','question',{turn:t,n:k+1,idk,extra}):P('result','finish',{turn:t,graded:true,idk,extra});
}
const foxGrade=t=>{t=String(t||'').trim();return /nie wiem/i.test(t)||t.length<8?'wrong':t.length>=30?'ok':'partial';};
const FOX_SCORE={ok:90,partial:55,wrong:15};
const FOX_MSG={too_many_turns:'Ta rozmowa już się skończyła.',bad_step:'Ten krok rozmowy nie pasuje do jej przebiegu.',bad_point:'Nie znaleziono tego punktu w materiale.'};
async function foxPost(uid,d,signal){
  const [fe,fa]=String(cfg.foxerr||'').split(':');
  if(!cfg.fox)return merr('ai_unavailable');
  if(!uid)return merr('unauthorized');
  if(fe==='bad_request'||!foxValid(d))return merr('bad_request');
  const plan=foxPlan(d.mode,d.step,arr(d.messages));
  if(plan.err)return aerr(400,plan.err,FOX_MSG[plan.err],{charged:false});
  const X0=await fixture(cfg.foxfx==='xss'?'media/xss/fox-xss':'media/fox-msgip');
  if(plan.kind==='local_end'){const q=cfg.nomedia?null:(({day,used,limit,remaining})=>({day,used,limit,remaining}))(chatQuota(uid));
    return res(200,{reply:d.mode==='explain'?'Dobrze, kończymy. Wróć do tego punktu, kiedy chcesz.':'Dobrze, kończymy. Możesz wrócić do rozmowy, kiedy chcesz.',next:'end',quota:q});}
  const subj=DB.t.subjects.find(s=>s.id===d.subjectId&&s.owner_id===uid);
  const tps=d.topicIds.map(id=>DB.t.topics.find(t=>t.id===id&&t.owner_id===uid&&t.subject_id===d.subjectId));
  if(fe==='not_found'||!subj||tps.some(t=>!t))return merr('not_found');
  const pts=[];for(const k of arr(d.pointIds)){const i=k.lastIndexOf(':'),tid=k.slice(0,i),raw=k.slice(i+1),t=tps.find(x=>x.id===tid);
    const p=t&&topicPoints(t.content).find(x=>x.id===raw);if(!p)return aerr(400,'bad_point',FOX_MSG.bad_point,{charged:false});pts.push({...p,raw,topicId:tid,key:k});}
  if(cfg.nomedia)return merr('media_unavailable');
  const q=chatQuota(uid);
  if(fe==='limit_reached'){const reason=fa||'chat_daily';return merr('limit_reached',{reason,used:q.used,limit:q.limit});}
  if(q.used>=q.limit)return merr('limit_reached',{reason:'chat_daily',used:q.used,limit:q.limit});
  chatRow(uid).used++;save(); // reserve_chat
  await sleep(600,signal);
  if(fe==='ai_unavailable'||fe==='fox_failed'){chatRow(uid).used=Math.max(0,chatRow(uid).used-1);save();return merr(fe);} // release_chat
  if(fe==='unknown')throw new TypeError('Failed to fetch');
  return res(200,Object.assign(foxReply(X0,d,pts,tps,plan),{quota:(({day,used,limit,remaining})=>({day,used,limit,remaining}))(chatQuota(uid))}));
}
function foxReply(fx,d,pts,tps,plan){
  const P=pts[0]||(()=>{const t=tps[0],p=topicPoints(t.content)[0]||{id:'p1',title:'',short:''};return {...p,raw:p.id,topicId:t.id,key:t.id+':'+p.id};})();
  const sub=s=>String(s==null?'':s).replace(/\{short\}/g,P.short).replace(/\{title\}/g,P.title);
  const ms=arr(d.messages),users=ms.filter(m=>m.role==='user'&&!HINT_CHIP.test(m.text)).map(m=>m.text);
  const last=users[users.length-1],isMsgip=tps.some(t=>String(t.content&&t.content.name)===MSGIP1_NAME),a=plan.kind;
  const grades=users.map(foxGrade).concat(plan.extra?['wrong']:[]);
  const g=plan.idk?'wrong':grades[grades.length-1]||'partial';
  if(d.mode==='explain'){const X=fx.explain,pointId=P.key;
    const fb=(X.feedback[isMsgip&&P.raw]||X.feedback['*']);const src=fb.source?{topicId:P.topicId,level:fb.source.level,feed:fb.source.feed}:null;
    if(a==='ask')return {reply:'',next:'question',question:{n:1,text:sub(X.start)},pointId};
    if(a==='hint')return {reply:sub(X.hint),next:plan.next,pointId};
    if(a==='explain_end')return {reply:sub(X.idk),next:'end',verdict:'wrong',feedback:{good:[],gap:[],wrong:[],...(src?{source:src}:{})},pointId};
    if(a==='grade_end')return {reply:sub(X.end[g]),next:'end',verdict:g,feedback:{good:[],gap:[],wrong:[]},pointId};
    const fl=X.followup[isMsgip&&P.raw]||X.followup['*'];
    const feedback={good:arr(fb.good).map(sub),gap:arr(fb.gap).map(sub),wrong:arr(fb.wrong).map(sub),...(src?{source:src}:{})};
    return {reply:sub(X.react[g]),next:'followup',question:{n:1,text:sub(fl)},verdict:g,feedback,pointId};}
  const t0=tps[0],tp0=topicPoints(t0.content);
  const gapsOf=pct=>pct>=90?[]:isMsgip?arr(fx.exam.gaps).map(x=>{const t=tps.find(y=>String(y.content&&y.content.name)===MSGIP1_NAME)||t0;return {title:x.title,topicId:t.id,level:x.level,feed:x.feed,pointId:t.id+':'+x.point};})
    :tp0.slice(0,2).map(p=>({title:p.title,topicId:t0.id,level:p.levels[0],feed:0,pointId:t0.id+':'+p.id}));
  if(d.mode==='quiz'){const X=fx.quiz,Q=arr(X.questions);
    if(a==='ask')return {reply:X.intro,next:'question',question:{n:1,text:Q[0]}};
    if(a==='hint')return {reply:'Podpowiem: wróć myślami do lekcji o tym punkcie.',next:'question'};
    if(a==='grade_next')return {reply:(plan.idk?'Nic straconego. ':'')+X.comment[g],next:'question',verdict:g,question:{n:plan.n,text:Q[plan.n-1]}};
    const all=grades.slice(0,5),per=all.map((x,i)=>({q:Q[i]||'Pytanie',verdict:{ok:'DOBRZE',partial:'PRAWIE',wrong:'ŹLE'}[x],note:X.comment[x]}));
    const pct=all.length?Math.round(all.reduce((s,x)=>s+FOX_SCORE[x],0)/all.length):0;
    return {reply:sub(X.end),next:'finish',...(plan.graded?{verdict:g}:{}),result:{pct,score:{ok:all.filter(x=>x==='ok').length,total:all.length},perQuestion:per,gaps:gapsOf(pct)}};}
  const X=fx.exam,Q=arr(X.questions);
  if(a==='ask')return {reply:X.intro,next:'question',question:{n:1,text:Q[0].q}};
  if(a==='hint')return {reply:'Podpowiem: zacznij od definicji, potem przykład.',next:plan.next};
  if(a==='grade_followup')return {reply:plan.idk?'Nic straconego.':'Rozumiem.',next:'followup',question:{n:plan.n,text:Q[plan.n-1].follow}};
  if(a==='grade_next')return {reply:plan.idk?'Nic straconego. Dalej.':'Dziękuję. Dalej.',next:'question',question:{n:plan.n,text:Q[plan.n-1].q}};
  const asked=Math.min(3,Math.ceil(grades.length/2)),per=Q.slice(0,asked).map((x,i)=>{const gs=grades.slice(i*2,i*2+2);const sc=gs.length?gs.reduce((s,y)=>s+FOX_SCORE[y],0)/gs.length:0;const key=sc>=80?'ok':sc>=50?'partial':'wrong';
    return {sc,row:{q:x.q,verdict:{ok:'DOBRZE',partial:'PRAWIE',wrong:'ŹLE'}[key],note:x.notes[key]}};});
  const pct=per.length?Math.round(per.reduce((s,x)=>s+x.sc,0)/per.length):0;
  return {reply:X.end,next:'finish',result:{pct,score:{ok:per.filter(x=>x.row.verdict==='DOBRZE').length,total:per.length},perQuestion:per.map(x=>x.row),gaps:gapsOf(pct)}};
}

/* Storage: bucket „media” (prywatny; 0010: SELECT i DELETE własnego folderu, bez INSERT/UPDATE dla użytkownika) */
const MEDIA_MIME=f=>/\.mp3$/.test(f)?'audio/mpeg':'application/json';
async function mediaObject(key){
  const o=DB.mobjects[key];if(!o)return null;const file=key.split('/').pop();
  if(o.data)return new Response(JSON.stringify(o.data),{status:200,headers:{'Content-Type':'application/json'}});
  const r=await realFetch(FIXTURES+o.fx);if(!r.ok)return null;
  if(o.reel){const sb=await r.json();const n=o.reel;if(sb&&typeof sb==='object'&&!xssFx())sb.audio=Object.assign({},sb.audio,{src:`r${n}.mp3`,words:`r${n}.words.json`});
    return new Response(JSON.stringify(sb),{status:200,headers:{'Content-Type':'application/json'}});}
  return new Response(await r.blob(),{status:200,headers:{'Content-Type':MEDIA_MIME(file)}});
}

/* ---------- routing i podmiana fetch ---------- */
function route(url){
  let u;try{u=new URL(url,location.href);}catch(e){return null;}
  const C=window.CRAMFOX_CONFIG||{};let sb=null,ap=null;try{sb=new URL(C.supabaseUrl).origin;}catch(e){}try{ap=new URL(C.apiUrl).origin;}catch(e){}
  if((sb&&u.origin===sb)||/\.supabase\.co$/i.test(u.hostname)){
    if(u.pathname.startsWith('/auth/v1/'))return {u,h:auth};
    if(u.pathname.startsWith('/rest/v1/'))return {u,h:rest};
    if(u.pathname.startsWith('/storage/v1/'))return {u,h:storage};
    return {u,h:async()=>res(501,{error:'mock: nieobsłużony adres Supabase'})};
  }
  if(u.pathname.startsWith('/api/')&&(u.origin===location.origin||(ap&&u.origin===ap)))return {u,h:api};
  if(/vercel\.app$/i.test(u.hostname))return {u,h:async()=>res(501,{error:'mock: nieobsłużony adres API'})}; // nic nie wychodzi na produkcję
  return null;
}
window.fetch=async function(input,init){
  init=init||{};
  const isReq=typeof Request!=='undefined'&&input instanceof Request;
  const url=isReq?input.url:String(input);
  const r=route(url);if(!r)return realFetch(input,init);
  const method=String(init.method||(isReq?input.method:'GET')||'GET').toUpperCase();
  const headers=new Headers(init.headers||(isReq?input.headers:undefined)||{});
  const body=init.body!==undefined?init.body:undefined;const signal=init.signal||(isReq?input.signal:undefined);
  const entry={t:iso(),method,path:r.u.pathname+r.u.search,status:0};LOG.push(entry);if(LOG.length>500)LOG.shift();
  if(method==='POST'&&/^\/api\/media\/(reels|podcast)$/.test(r.u.pathname)){ // plan-media §4.6: dziennik cf_media_job:<uid> zapisany PRZED wysłaniem POST
    try{entry.journal=Object.keys(localStorage).some(k=>k.startsWith('cf_media_job:')&&localStorage.getItem(k));}catch(e){entry.journal=false;}}
  await ready;
  await sleep(cfg.lat,signal);
  if(cfg.net==='off'||navigator.onLine===false){entry.status='network';if(cfg.log)console.debug('[mock]',method,entry.path,'→ brak sieci');throw new TypeError('Failed to fetch');}
  let out;
  try{out=await r.h(r.u,method,headers,body,signal);}
  catch(e){entry.status=e&&e.name==='AbortError'?'abort':'network';if(cfg.log)console.debug('[mock]',method,entry.path,'→',entry.status);throw e;}
  entry.status=out.status;if(cfg.log)console.debug('[mock]',method,entry.path,'→',out.status);
  return out;
};

/* ---------- udawany Capacitor (native=1): ta sama ścieżka co na iOS — CapacitorHttp.request ---------- */
if(cfg.native&&!window.Capacitor){
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'ios',Plugins:{CapacitorHttp:{async request(o){
    const r=await window.fetch(o.url,{method:o.method||'GET',headers:o.headers||{},body:o.data!==undefined?JSON.stringify(o.data):undefined});
    const t=await r.text();let data=t;try{data=t?JSON.parse(t):'';}catch(e){}
    const hs={};r.headers.forEach((v,k)=>{hs[k]=v;});return {status:r.status,data,headers:hs,url:o.url};}}}};
}

const POST_PATH={reels:'/api/media/reels',podcast:'/api/media/podcast',chapter:'/api/media/podcast/chapter',fox:'/api/fox',generate:'/api/generate',me:'/api/me'};
const CFG_PARSE={reels:v=>v!=='0',voices:v=>v!=='0',fox:v=>v!=='0',nomedia:v=>v==='1',lsave:v=>v!=='0',mrun:v=>Math.max(0,+v||0),
  mq:v=>v==null||v===''?null:Math.max(0,Math.floor(+v||0)),chat:v=>v==null||v===''?null:Math.max(0,Math.floor(+v||0))};
window.MOCK={cfg,log:LOG,db:()=>DB,ready:()=>ready,save,TEST_USER:{email:TEST_USER.email,id:TEST_USER.id},IDS,
  reset(scenario){const q=new URLSearchParams(location.search);q.set('mock',scenario||cfg.mock);q.set('reset','1');location.search=q.toString();},
  set(k,v){const q=new URLSearchParams(location.search);if(v==null||v==='')q.delete(k);else q.set(k,v);cfg[k]=CFG_PARSE[k]?CFG_PARSE[k](v==null?v:String(v)):v;
    if((k==='mq'||k==='chat'||k==='mplan')&&DB.users.length){applyQuotaParams(DB.users[0].id);save();}
    history.replaceState(history.state,'',location.pathname+'?'+q.toString());},
  posts:kind=>LOG.filter(e=>e.method==='POST'&&e.path.split('?')[0]===(POST_PATH[kind]||kind)).length, // ile POST-ów (także odrzuconych i zerwanych)
  media:()=>clone(DB.t.media),mobjects:()=>Object.keys(DB.mobjects),
  topicPoints:c=>topicPoints(c)};
console.info('[mock] atrapa backendu: scenariusz '+cfg.mock+(cfg.gen!=='ok'?', gen='+cfg.gen:'')+' — żadne żądanie do Supabase/API nie wychodzi z przeglądarki');
})();
