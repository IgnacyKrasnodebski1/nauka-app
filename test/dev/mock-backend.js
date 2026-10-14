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
     gen=ok|slow[:s]|demo|err:KOD[:used]|drop[:s]|dropfail[:s]|html504
                              /api/generate: sukces (1,5 s) | wolno (domyślnie 25 s) | tryb demo | błąd z kodem serwera |
                              zerwane połączenie po wysłaniu (temat powstaje po s sekundach) | j.w., ale generowanie się nie udaje | 504 bez JSON (Vercel)
     genfx=makro|viz|xss|krypto  z czego powstaje temat (domyślnie makro: 4 poziomy z topic-makro.json + schematy w czacie)
     plan=free|pro, used=N    /api/me: plan i zużycie w tym miesiącu (free: 3 / mies.)
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
     trial=N                  seeded: okres próbny kończy się za N dni (ujemne = już minął)
     weekly=1                 seeded: podsumowanie tygodnia jeszcze niepokazane (w poniedziałek pojawi się na starcie)
     log=1                    każde żądanie w console.debug
   Konto testowe (tylko atrapa): test@cramfox.test / cramfox-test-1.
   W konsoli: MOCK.cfg, MOCK.db(), MOCK.log (ostatnie żądania), MOCK.reset('seeded'), MOCK.set('gen','err:limit_reached'). */
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
  mock:/^(fresh|seeded)$/.test(P.get('mock')||'')?P.get('mock'):'fresh',
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
  weekly:P.get('weekly')==='1',
  log:P.get('log')==='1'
};
const MB=1048576;
const TEST_USER={id:'0c0ffee0-0000-4000-8000-000000000001',email:'test@cramfox.test',password:'cramfox-test-1'};
const IDS={sMakro:'5b000001-0000-4000-8000-000000000001',tMakro:'7c000001-0000-4000-8000-000000000001',
  sKrypto:'5b000002-0000-4000-8000-000000000002',tKrypto:'7c000002-0000-4000-8000-000000000002',
  sViz:'5b000003-0000-4000-8000-000000000003',tViz:'7c000003-0000-4000-8000-000000000003',
  sXss:'5b000004-0000-4000-8000-000000000004',tXss:'7c000004-0000-4000-8000-000000000004'};
const PLANS={free:{label:'Free',generationsPerMonth:3,filesPerGeneration:5,maxFileMb:50,maxSubjects:5,priceMonthlyPln:0,priceYearlyPln:0},
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
const sleep=(ms,signal)=>new Promise((res,rej)=>{if(signal&&signal.aborted)return rej(abortErr());const t=setTimeout(()=>{if(signal)signal.removeEventListener('abort',on);res();},ms);const on=()=>{clearTimeout(t);rej(abortErr());};if(signal)signal.addEventListener('abort',on,{once:true});});
const abortErr=()=>new DOMException('The user aborted a request.','AbortError');
const levelId=(topicId,l)=>'t'+String(topicId).replace(/-/g,'').slice(0,8)+'_'+String(l).replace(/[^A-Za-z0-9_-]/g,'_'); // jak mapLevel() w cloud.js

/* ---------- stan „serwera” ---------- */
const DBK='mockbe:db';
let DB=null;
function load(){try{const v=JSON.parse(localStorage.getItem(DBK)||'null');return v&&v.v===1?v:null;}catch(e){return null;}}
function save(){try{localStorage.setItem(DBK,JSON.stringify(DB));}catch(e){console.error('[mock] zapis stanu atrapy się nie udał',e);}}
function emptyDb(scenario){return {v:1,scenario,createdAt:iso(),seeded:false,users:[],tokens:{access:{},refresh:{}},
  t:{subjects:[],topics:[],materials:[],generations:[],app_state:[],profiles:[],usage:[],subscriptions:[]},objects:{},tus:{}};}
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
  const cf=(meta||{}).client==='cramfox'; // trigger handle_new_user: Cramfox = pro na 30 dni
  DB.t.profiles.push({id,email,display_name:email.split('@')[0],plan:cf?'pro':'free',trial_until:cf?iso(now()+30*86400000):null,created_at:iso()});
  return u;
}

function init(){
  DB=load();
  const need=cfg.reset||!DB||DB.scenario!==cfg.mock;
  if(need){
    wipeApp();DB=emptyDb(cfg.mock);
    if(cfg.mock==='seeded'){
      addUser(TEST_USER.id,TEST_USER.email,TEST_USER.password,{age16:true,client:'cramfox'});
      const pr=DB.t.profiles.find(p=>p.id===TEST_USER.id);pr.trial_until=iso(now()+cfg.trial*86400000);if(cfg.trial<=0)pr.plan='free';pr.created_at=iso(now()-7*86400000);
      DB.t.usage.push({user_id:TEST_USER.id,month:monthKey(),generations:2,tutor_messages:0});
      if(cfg.login){const s=newSession(TEST_USER.id);
        localStorage.setItem('cf_session',JSON.stringify({access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at,user:{id:s.user.id,email:s.user.email}}));}
    }
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
  if(DB.scenario!=='seeded'||DB.seeded)return;
  const uid=TEST_USER.id,t0=now()-6*86400000;
  const makro=await fixture('topic-makro'),krypto=await fixture('topic-krypto');
  const subj=(id,name,stage,accent,pos)=>DB.t.subjects.push({id,owner_id:uid,name,emoji:'📘',stage,accent,accent2:accent,exam_date:null,exam_label:null,position:pos,created_at:iso(t0+pos*1000)});
  subj(IDS.sMakro,'Polityka makroekonomiczna','studia','#B4FF3A',0);insertTopic(IDS.sMakro,uid,makro,IDS.tMakro,null,t0);
  subj(IDS.sKrypto,'Krypto i NFT','studia','#22D3EE',1);insertTopic(IDS.sKrypto,uid,krypto,IDS.tKrypto,null,t0+1000);
  if(cfg.extra.includes('viz')){subj(IDS.sViz,'Wizualizacje — test','studia','#FFC043',2);const v=await fixture('topic-viz');if(cfg.lang)v.lang=true;insertTopic(IDS.sViz,uid,v,IDS.tViz,null,t0+2000);}
  if(cfg.extra.includes('xss')){subj(IDS.sXss,'Test<img src=x onerror="window.__pwned=1">','liceum','#FF2E93',3);insertTopic(IDS.sXss,uid,await fixture('topic-xss'),IDS.tXss,null,t0+3000);}
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
const OWNER={subjects:'owner_id',topics:'owner_id',materials:'owner_id',generations:'owner_id',app_state:'user_id',profiles:'id',usage:'user_id',subscriptions:'user_id'};
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
  if(!DB.t[table])return perr(404,'PGRST205',"Could not find the table 'public."+table+"' in the schema cache");
  if(table==='generations')lazyGenerations();
  const own=OWNER[table],rep=/return=representation/.test(prefer);
  if(m==='GET'||m==='HEAD')return res(200,pick(query(table,uid,sp),sp.get('select')));
  if(!(CLIENT_WRITE[table]||[]).includes(m))return perr(403,'42501','permission denied for table '+table);
  if(m==='POST'){
    let d=bodyJson(b);if(d===undefined)return perr(400,'PGRST102','Empty or invalid json');const list=Array.isArray(d)?d:[d];const out=[];
    for(const raw of list){
      const row=Object.assign({},raw);
      if(row[own]!==uid)return perr(403,'42501','new row violates row-level security policy for table "'+table+'"');
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
    if(table==='subjects'){const sids=new Set(rows.map(r=>r.id));DB.t.topics=DB.t.topics.filter(t=>!sids.has(t.subject_id));} // FK on delete cascade
    save();return rep?res(200,clone(rows)):res(204);
  }
  return perr(405,'PGRST117','Unsupported HTTP method');
}
function stateTooBig(r){return JSON.stringify(r.progress||{}).length+JSON.stringify(r.meta||{}).length>=2000000;}
function rpc(fn,uid,args){
  if(fn!=='delete_my_account')return perr(404,'PGRST202','Could not find the function public.'+fn+' in the schema cache');
  if(cfg.del==='active_subscription')return perr(400,'P0001','active_subscription');
  if(args.p_dry_run)return res(204);
  if(cfg.del==='files_remaining'||Object.keys(DB.objects).some(p=>p.startsWith(uid+'/')))return perr(400,'P0001','files_remaining');
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
    if(!owns(path))return serr(403,'Unauthorized','new row violates row-level security policy');
    if(size>50*MB)return serr(413,'Payload too large','The object exceeded the maximum allowed size');
    if(!BUCKET_MIME.test(mime))return serr(415,'invalid_mime_type','mime type '+mime+' is not supported');
    if(DB.objects[path]&&h.get('x-upsert')!=='true')return serr(409,'Duplicate','The resource already exists');
    DB.objects[path]={id:uuid(),size,mime,at:iso()};save();return res(200,{Key:'materials/'+path,Id:DB.objects[path].id});
  }
  if(p==='upload/resumable'&&m==='POST'){
    const len=+h.get('Upload-Length'),meta={};String(h.get('Upload-Metadata')||'').split(',').forEach(kv=>{const [k,v]=kv.trim().split(' ');if(k)meta[k]=v?decodeURIComponent(escape(atob(v))):'';});
    if(cfg.upload==='413'||len>50*MB)return serr(413,'Payload too large','The object exceeded the maximum allowed size');
    if(cfg.upload==='500')return serr(500,'internal','Internal Server Error');
    if(meta.bucketName!=='materials'||!owns(meta.objectName||''))return serr(403,'Unauthorized','new row violates row-level security policy');
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
  return serr(404,'not_found','mock: brak trasy '+m+' '+p);
}

/* ---------- API (Vercel) ---------- */
const aerr=(status,code,error,extra)=>res(status,Object.assign({error:error||code,code},extra||{}));
const planOf=uid=>{if(cfg.plan==='free'||cfg.plan==='pro')return cfg.plan;const p=DB.t.profiles.find(x=>x.id===uid);return p&&p.plan==='pro'?'pro':'free';};
function usageRow(uid){let u=DB.t.usage.find(x=>x.user_id===uid&&x.month===monthKey());if(!u){u={user_id:uid,month:monthKey(),generations:0,tutor_messages:0};DB.t.usage.push(u);}return u;}
const usedOf=uid=>cfg.used!=null&&cfg.used!==''?+cfg.used||0:usageRow(uid).generations; // used=N tylko nadpisuje odczyt (nie zmienia zapisanego licznika)
async function api(u,m,h,b,signal){
  const p=u.pathname;
  const uid=userOf(h);
  if(p==='/api/me'&&m==='GET'){
    if(!uid)return aerr(401,'unauthorized','Wymagane logowanie');
    const plan=planOf(uid),us=usageRow(uid),prof=DB.t.profiles.find(x=>x.id===uid)||null;
    return res(200,{profile:prof&&{...prof,plan},plan,usage:{month:us.month,generations:usedOf(uid),tutorMessages:us.tutor_messages},limits:PLANS[plan],subscription:null});
  }
  if(p==='/api/generate'&&m==='POST')return generate(uid,bodyJson(b),signal);
  return aerr(404,'not_found','mock: brak trasy '+m+' '+p);
}
const ERRS={ // kod → [status, czy liczy się do limitu (generationId), dodatkowe pola]
  limit_reached:[402,false],too_many_files:[400,false],file_too_big:[400,false],too_much_material:[400,false,{maxMb:150}],bad_materials:[400,false],
  bad_pptx:[400,false],pptx_protected:[400,false],pptx_empty:[400,false],download_failed:[500,false],reserve_failed:[500,false],
  no_input:[400,true],too_long:[400,true],generation_failed:[500,true],refusal:[500,true],invalid_output:[500,true],api:[500,true],
  not_found:[404,false],unauthorized:[401,false],no_config:[503,false],bad_request:[400,false]};
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
  const us=usageRow(uid);
  const g=String(cfg.gen||'ok'),[mode,arg,arg2]=g.split(':');
  if(mode==='err'){ // wymuszony błąd serwera — z generationId, gdy prawdziwy serwer pobrałby już limit
    const code=arg||'generation_failed',e=ERRS[code]||[500,true];const extra=Object.assign({},e[2]||{});
    if(code==='limit_reached'){extra.used=arg2!=null?+arg2:Math.max(usedOf(uid),lim.generationsPerMonth);extra.limit=lim.generationsPerMonth;}
    if(/^(file_too_big|bad_pptx|pptx_protected|pptx_empty|bad_materials)$/.test(code))extra.name=(mats[0]&&mats[0].name)||'notatki.pdf';
    if(code==='file_too_big')extra.maxMb=lim.maxFileMb;
    if(code==='too_many_files')extra.max=lim.filesPerGeneration;
    if(e[1]){us.generations++;const gid=uuid();DB.t.generations.push({id:gid,owner_id:uid,subject_id:subj.id,status:'failed',error:'mock: '+code,material_ids:ids,stage:o.stage||null,options:o,created_at:iso(),finished_at:iso()});extra.generationId=gid;save();}
    await sleep(code==='api'||code==='generation_failed'?2500:600,signal);
    return aerr(e[0],code,code==='api'?'AI: 529 overloaded':'mock: '+code,extra);
  }
  if(mode==='html504'){us.generations++;DB.t.generations.push({id:uuid(),owner_id:uid,subject_id:subj.id,status:'running',error:null,material_ids:ids,created_at:iso()});save();
    await sleep(3000,signal);return res(504,'<!DOCTYPE html><html><body>An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT</body></html>',{'Content-Type':'text/html'});}
  // limit: miesięczny (plan) i dobowy (20 / konto) — jak increment_usage
  if(usedOf(uid)>=lim.generationsPerMonth)return aerr(402,'limit_reached',`Wykorzystano ${usedOf(uid)}/${lim.generationsPerMonth} generacji w tym miesiącu`,{used:usedOf(uid),limit:lim.generationsPerMonth});
  if(DB.t.generations.filter(x=>x.owner_id===uid&&Date.parse(x.created_at)>now()-86400000).length>=20)return aerr(402,'limit_reached','Dzienny limit',{used:999999,limit:lim.generationsPerMonth});
  us.generations++;
  const gid=uuid(),gen={id:gid,owner_id:uid,subject_id:subj.id,status:'running',error:null,topic_id:null,material_ids:ids,stage:o.stage||null,options:o,hint:o.hint||null,created_at:iso(),finished_at:null};
  DB.t.generations.push(gen);save();
  const content=await topicContent(cfg.genfx);
  if(mode==='drop'||mode==='dropfail'){ // odpowiedź ginie po drodze, serwer kończy sam (klient odzyskuje przez tabelę generations)
    gen._finishAt=now()+(+arg>0?+arg:20)*1000;gen._outcome=mode==='dropfail'?'fail':'ok';gen._content=content;save();
    await sleep(1500,signal);throw new TypeError('Failed to fetch');
  }
  await sleep(mode==='slow'?(+arg>0?+arg:25)*1000:1500,signal);
  const t=insertTopic(subj.id,uid,content,null,gid);gen.status='done';gen.topic_id=t.id;gen.model=mode==='demo'?'demo':'claude-opus-5';gen.finished_at=iso();save();
  return res(200,{generationId:gid,topicId:t.id,topic:{id:t.id,subjectId:t.subject_id,name:t.name,content:t.content},demo:mode==='demo'});
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

window.MOCK={cfg,log:LOG,db:()=>DB,ready:()=>ready,save,TEST_USER:{email:TEST_USER.email},IDS,
  reset(scenario){const q=new URLSearchParams(location.search);q.set('mock',scenario||cfg.mock);q.set('reset','1');location.search=q.toString();},
  set(k,v){const q=new URLSearchParams(location.search);if(v==null||v==='')q.delete(k);else q.set(k,v);cfg[k]=v;history.replaceState(history.state,'',location.pathname+'?'+q.toString());}};
console.info('[mock] atrapa backendu: scenariusz '+cfg.mock+(cfg.gen!=='ok'?', gen='+cfg.gen:'')+' — żadne żądanie do Supabase/API nie wychodzi z przeglądarki');
})();
