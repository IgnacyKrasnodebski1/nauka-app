/* ============================================================ CRAMFOX — CHMURA (bez UI)
   Sesja (Supabase GoTrue), dane (PostgREST), pliki (Storage; powyżej 6 MB wysyłka wznawialna TUS), API generowania (Vercel — na iOS przez natywne CapacitorHttp, bo API nie ma CORS),
   cache przedmiotów per konto, mapper TopicContent → przedmiot silnika, sanitizer HTML, synchronizacja postępów (tabela app_state),
   dziennik generacji z odzyskiwaniem po przerwaniu. Ładuje się PRZED engine.js i ustawia window.NAUKA_UID — silnik trzyma postępy pod kluczami per konto.
   Treść z bazy: pola HTML (feed body/real/mnemo, fiszka d, info) przez clean(), cała reszta to zwykły tekst przez esc() — trafia do innerHTML
   w WebView z mostkiem do natywnych pluginów. */
(function(){
'use strict';
const CFG=window.CRAMFOX_CONFIG||{};

/* ---------- storage (iOS potrafi rzucać) ---------- */
const LS=(()=>{try{const s=globalThis['localStorage'];s.setItem('__cf','1');s.removeItem('__cf');return s;}catch(e){const m={};return {getItem:k=>k in m?m[k]:null,setItem:(k,v)=>{m[k]=String(v);},removeItem:k=>{delete m[k];},key:i=>Object.keys(m)[i]||null,get length(){return Object.keys(m).length;}};}})();
const jget=(k,d)=>{try{const v=LS.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}};
const jset=(k,v)=>{try{LS.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}};
const lset=(k,v)=>{try{LS.setItem(k,String(v));}catch(e){}};
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- sesja: znana synchronicznie, zanim silnik wczyta postępy ---------- */
const SKEY='cf_session';
let session=jget(SKEY,null);
if(!session||!session.user||!session.user.id||!session.refresh_token)session=null;
const UID=session?String(session.user.id):'';
window.NAUKA_UID=UID;
// jednorazowo: postępy z czasów wbudowanych przedmiotów (bez konta) nie mają już do czego się odnosić
if(!LS.getItem('cf_legacy_cleared')){try{LS.removeItem('nauka_progress_v1');LS.removeItem('nauka_meta_v1');LS.setItem('cf_legacy_cleared','1');}catch(e){}}

class CloudError extends Error{constructor(status,code,msg,data){super(msg||code||('HTTP '+status));this.status=status;this.code=code||'';this.data=data;}}
const listeners={};
function on(ev,fn){(listeners[ev]=listeners[ev]||[]).push(fn);}
function emit(ev,x){(listeners[ev]||[]).forEach(fn=>{try{fn(x);}catch(e){}});}

/* ---------- HTTP ---------- */
async function http(url,o){
  o=o||{};let res;const ac=typeof AbortController==='function'?new AbortController():null;const tm=ac&&setTimeout(()=>ac.abort(),o.timeout||20000); // zawieszone połączenie nie blokuje wylogowania ani startu
  try{res=await fetch(url,{method:o.method||'GET',headers:o.headers||{},body:o.raw!==undefined?o.raw:(o.body!==undefined?JSON.stringify(o.body):undefined),signal:ac?ac.signal:undefined});}
  catch(e){throw new CloudError(0,'network','Brak połączenia z internetem');}
  finally{if(tm)clearTimeout(tm);}
  const txt=await res.text();let data=null;
  try{data=txt?JSON.parse(txt):null;}catch(e){data=txt;}
  return {status:res.status,data};
}
function errOf(r){const d=obj(r.data);return new CloudError(r.status,String(d.error_code||d.code||d.error||''),String(d.msg||d.error_description||d.message||d.error||''),d);}
const isNative=()=>!!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform());
const apiBase=()=>(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(location.origin)&&!CFG.apiDirect)?location.origin:CFG.apiUrl;

/* ---------- auth (GoTrue) ---------- */
async function authPost(path,body,tok){
  const h={apikey:CFG.anonKey,'Content-Type':'application/json'};if(tok)h.Authorization='Bearer '+tok;
  const r=await http(CFG.supabaseUrl+'/auth/v1'+path,{method:'POST',headers:h,body});
  if(r.status>=400)throw errOf(r);return r.data;
}
function saveSession(d){
  if(!d||!d.access_token||!d.user)throw new CloudError(0,'no_session','Serwer nie zwrócił sesji');
  session={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:d.expires_at||Math.floor(Date.now()/1000)+(d.expires_in||3600),user:{id:d.user.id,email:d.user.email||''}};
  jset(SKEY,session);return session;
}
async function signUp(email,password){
  const d=await authPost('/signup',{email,password,data:{age16:true,client:'cramfox'}}); // client → okres próbny tylko dla kont z Cramfoxa (trigger handle_new_user)
  if(!d||!d.access_token)throw new CloudError(0,'needs_confirm','Konto wymaga potwierdzenia e-maila');
  return saveSession(d);
}
async function signIn(email,password){return saveSession(await authPost('/token?grant_type=password',{email,password}));}
let refreshing=null;
async function refresh(force){
  if(!session)throw new CloudError(401,'no_session','Zaloguj się');
  if(!force&&session.expires_at-60>Date.now()/1000)return session.access_token;
  if(!refreshing)refreshing=(async()=>{
    try{saveSession(await authPost('/token?grant_type=refresh_token',{refresh_token:session.refresh_token}));}
    catch(e){if(e.status===400||e.status===401){session=null;LS.removeItem(SKEY);emit('signedout',e);}throw e;} // sesja odwołana → logowanie (dane lokalne zostają); brak sieci → działamy dalej na starym tokenie
    finally{refreshing=null;}
    return session.access_token;})();
  try{return await refreshing;}catch(e){if(e.code==='network'&&session)return session.access_token;throw e;}
}
const token=()=>refresh(false);
async function wipeLocal(uid){
  const keys=[];for(let i=0;i<LS.length;i++){const k=LS.key(i);if(k&&(k.endsWith(':'+uid)||k===SKEY))keys.push(k);}
  keys.forEach(k=>LS.removeItem(k));await idbDel('data:'+uid);await idbDel('base:'+uid);
}
async function signOut(o){ // o.force: wyloguj mimo niewysłanych postępów (UI pyta wcześniej)
  o=o||{};clearTimeout(pushT);
  if(!o.force){
    for(let i=0;i<2&&!syncOff&&LS.getItem(DIRTYK);i++){try{if(pending)await applyPending(()=>true);else if(!pulled)await pull(()=>true);await push();}catch(e){break;}} // druga próba: po konflikcie push scala i wysyła jeszcze raz
    if(LS.getItem(DIRTYK))throw new CloudError(0,'unsynced','Część postępów nie jest jeszcze zapisana na koncie',{reason:syncOff?'off':'network'});
  }
  const tok=session&&session.access_token;
  if(tok){try{await authPost('/logout?scope=local',{},tok);}catch(e){}} // tylko to urządzenie — inne zostają zalogowane
  await wipeLocal(UID);location.reload();
}

/* ---------- PostgREST + Storage ---------- */
async function rest(path,o){
  o=o||{};const h={apikey:CFG.anonKey,'Content-Type':'application/json',Authorization:'Bearer '+await token()};
  if(o.prefer)h.Prefer=o.prefer;
  let r=await http(CFG.supabaseUrl+'/rest/v1/'+path,{method:o.method||'GET',headers:h,body:o.body});
  if(r.status===401){h.Authorization='Bearer '+await refresh(true);r=await http(CFG.supabaseUrl+'/rest/v1/'+path,{method:o.method||'GET',headers:h,body:o.body});}
  if(r.status>=400)throw errOf(r);return r.data;
}
const jwtFail=r=>r.status===401||((r.status===400||r.status===403)&&/jwt|exp|token/i.test(JSON.stringify(r.data||'')));
async function storage(path,o){
  o=o||{};const send=async tok=>{const h={apikey:CFG.anonKey,Authorization:'Bearer '+tok};Object.assign(h,o.headers||{});return http(CFG.supabaseUrl+'/storage/v1/'+path,{method:o.method||'GET',headers:h,body:o.body,raw:o.raw,timeout:o.raw!==undefined?180000:20000});};
  let r=await send(await token());if(jwtFail(r))r=await send(await refresh(true));
  if(r.status>=400)throw errOf(r);return r.data;
}
const storageUpload=(p,blob,mime)=>storage('object/materials/'+p,{method:'POST',raw:blob,headers:{'Content-Type':mime,'x-upsert':'false'}});

/* ---------- duże pliki: wysyłka wznawialna (TUS 1.0.0 w Supabase Storage) ----------
   Kawałki po dokładnie 6 MB (wymóg Supabase), ostatni mniejszy. Nieudany kawałek: do 3 ponowień z przerwą, przed każdym HEAD mówi,
   ile serwer już ma (odpowiedź mogła zginąć po zapisaniu kawałka) — stamtąd dalej. Obiekt w buckecie powstaje dopiero po ostatnim kawałku. */
const TUS_CHUNK=6*1048576,TUS_WAIT=[1000,3000,7000];
async function rawHttp(url,o){ // jak http(), ale z nagłówkami odpowiedzi (Location, Upload-Offset); treść czytana tylko przy błędzie
  const ac=typeof AbortController==='function'?new AbortController():null;const tm=ac&&setTimeout(()=>ac.abort(),o.timeout||20000);let res;
  try{res=await fetch(url,{method:o.method,headers:o.headers,body:o.body,signal:ac?ac.signal:undefined});}
  catch(e){if(tm)clearTimeout(tm);throw new CloudError(0,'network','Brak połączenia z internetem');}
  let data=null;
  try{if(res.status>=400){const t=await res.text();try{data=t?JSON.parse(t):null;}catch(e){data=t;}}}catch(e){}finally{if(tm)clearTimeout(tm);}
  return {status:res.status,data,head:k=>{try{return res.headers.get(k);}catch(e){return null;}}};
}
const b64utf8=s=>btoa(unescape(encodeURIComponent(String(s)))); // base64 z UTF-8 (wartości Upload-Metadata)
function tusUrl(loc){ // adres wysyłki zawsze w domenie Supabase z konfiguracji — token nie trafia nigdzie indziej (też gdy serwer poda http:// albo inny host)
  const base=new URL(CFG.supabaseUrl);let u;try{u=new URL(String(loc||''),base.origin+'/storage/v1/upload/resumable');}catch(e){return null;}
  if(!loc||(u.host!==base.host&&!/^\/storage\/v1\/upload\/resumable\/./.test(u.pathname)))return null;
  return base.origin+u.pathname+u.search;
}
const retryable=s=>s===0||s===408||s===409||s===423||s===429||s>=500; // 409: serwer ma inny offset — HEAD i dalej
async function tusUpload(path,blob,mime,onProgress){
  const size=blob.size,prog=n=>{if(onProgress)try{onProgress(n,size);}catch(e){}};
  const send=async(url,o)=>{const go=async tok=>rawHttp(url,{...o,headers:Object.assign({apikey:CFG.anonKey,Authorization:'Bearer '+tok,'Tus-Resumable':'1.0.0'},o.headers)});
    let r=await go(await token());if(jwtFail(r))r=await go(await refresh(true));return r;}; // 401 → odśwież token raz
  const meta={bucketName:'materials',objectName:path,contentType:mime,cacheControl:'3600'};
  const c=await send(CFG.supabaseUrl+'/storage/v1/upload/resumable',{method:'POST',headers:{'Upload-Length':String(size),'Upload-Metadata':Object.keys(meta).map(k=>k+' '+b64utf8(meta[k])).join(','),'x-upsert':'false'}});
  if(c.status<200||c.status>=300)throw errOf(c); // 413: plik większy niż limit bucketu
  const url=tusUrl(c.head('Location'));if(!url)throw new CloudError(0,'upload_failed','Serwer nie podał adresu wysyłki');
  let off=0,fails=0;prog(0);
  while(off<size){
    const end=Math.min(size,off+TUS_CHUNK);let r=null,err=null;
    try{r=await send(url,{method:'PATCH',headers:{'Upload-Offset':String(off),'Content-Type':'application/offset+octet-stream'},body:blob.slice(off,end),timeout:180000});}
    catch(e){if(e.code!=='network')throw e;err=e;}
    if(r&&r.status>=200&&r.status<300){const h=r.head('Upload-Offset'),n=h==null?end:+h; // bez nagłówka: 204 znaczy, że kawałek przyjęty
      if(n>off&&n<=size){off=n;fails=0;prog(off);continue;}}
    else if(r&&!retryable(r.status))throw errOf(r); // odmowa (rozmiar, typ, uprawnienia) — ponawianie nic nie da
    if(++fails>3)throw err||(r&&r.status>=300?errOf(r):new CloudError(0,'upload_failed','Wysyłka pliku się nie powiodła'));
    await sleep(TUS_WAIT[fails-1]);
    try{const h=await send(url,{method:'HEAD'});
      if(h.status===404||h.status===410)throw new CloudError(h.status,'upload_failed','Wysyłka wygasła');
      const v=h.head('Upload-Offset'),n=+v;if(h.status<300&&v!=null&&v!==''&&n>=0&&n<=size){off=n;prog(off);}}
    catch(e){if(e.code!=='network')throw e;} // HEAD bez sieci: następna próba PATCH; zły offset → 409 → znów HEAD
  }
}
async function storageListAll(prefix){const out=[];for(let off=0;off<10000;off+=100){const page=await storage('object/list/materials',{method:'POST',headers:{'Content-Type':'application/json'},body:{prefix,limit:100,offset:off}});if(!Array.isArray(page)||!page.length)break;page.forEach(f=>{if(f&&f.name)out.push(prefix+'/'+f.name);});if(page.length<100)break;}return out;}
async function storageRemove(paths){for(let i=0;i<paths.length;i+=100)await storage('object/materials',{method:'DELETE',headers:{'Content-Type':'application/json'},body:{prefixes:paths.slice(i,i+100)}});}

/* ---------- API na Vercelu: natywnie (bez CORS), w przeglądarce przez lokalne proxy; 401 → odśwież token i ponów raz (serwer sprawdza sesję przed limitem) ---------- */
async function api(path,o){
  o=o||{};const url=apiBase()+path;
  const H=isNative()&&window.Capacitor.Plugins&&window.Capacitor.Plugins.CapacitorHttp;
  const send=async tok=>{const headers={Authorization:'Bearer '+tok,'Content-Type':'application/json'};
    if(!H)return http(url,{method:o.method||'GET',headers,body:o.body,timeout:310000});
    let r;try{r=await H.request({url,method:o.method||'GET',headers,data:o.body,readTimeout:310000});} // tylko readTimeout: connectTimeout zabiłby 2-minutowe generowanie
    catch(e){throw new CloudError(0,'network','Brak połączenia z serwerem');}
    let d=r.data;if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){}}
    return {status:r.status,data:d};};
  let r=await send(await token());if(r.status===401)r=await send(await refresh(true));
  return r;
}
function uuid(){const b=new Uint8Array(16);(window.crypto||{}).getRandomValues?crypto.getRandomValues(b):b.forEach((_,i)=>b[i]=Math.random()*256|0);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}

/* ---------- IndexedDB per konto (cache przedmiotów, baza synchronizacji); zawieszona baza nie blokuje startu ---------- */
let idbP=null;
function idb(){if(!idbP)idbP=new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('idb timeout')),2500);try{if(!window.indexedDB)throw new Error('no idb');const r=indexedDB.open('cramfox',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{clearTimeout(t);res(r.result);};r.onerror=()=>{clearTimeout(t);rej(r.error);};}catch(e){clearTimeout(t);rej(e);}}).catch(e=>{idbP=null;throw e;});return idbP;}
async function idbGet(k){try{const db=await idb();return await new Promise((res,rej)=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}catch(e){idbP=null;return jget('cf_'+k,null);}}
async function idbPut(k,v,lsFallback){try{const db=await idb();await new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error);});}
  catch(e){idbP=null;if(lsFallback){const s=JSON.stringify(v);if(s.length<1500000)lset('cf_'+k,s);}}} // większy cache nie trafia do localStorage — zapchałby miejsce na postępy
async function idbDel(k){try{LS.removeItem('cf_'+k);const db=await idb();await new Promise(res=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=res;t.onerror=res;});}catch(e){idbP=null;}}
let DATA={subjects:[],topics:[]};
async function loadCache(){const d=await idbGet('data:'+UID);if(d&&Array.isArray(d.subjects)&&Array.isArray(d.topics))DATA=d;return !!(d&&d.at);}
async function saveCache(){DATA.at=Date.now();await idbPut('data:'+UID,DATA,true);}
async function fetchAll(){
  const [subjects,topics]=await Promise.all([
    rest('subjects?select=id,name,emoji,stage,accent,accent2,exam_date,exam_label,position,created_at&order=position.asc,created_at.asc'),
    rest('topics?select=id,subject_id,name,position,created_at,content&order=position.asc,created_at.asc')]);
  DATA={subjects:Array.isArray(subjects)?subjects:[],topics:Array.isArray(topics)?topics:[]};await saveCache();emit('subjects');return DATA;
}

/* ---------- sanitizer: tylko bezpieczne tagi, jedyny atrybut to class zbox/gradetbl; teksty escapowane także z cudzysłowem ---------- */
const OK_TAGS=new Set(['b','i','em','strong','u','s','br','p','ul','ol','li','div','span','h3','h4','table','thead','tbody','tr','th','td','code','sup','sub','small','mark','blockquote','hr']);
const DROP_TAGS=new Set(['script','style','iframe','object','embed','svg','math','img','video','audio','source','link','meta','base','form','input','button','textarea','select','option','template','noscript','frame','frameset','canvas','picture','track','applet']);
const VOID=new Set(['br','hr']);
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function ser(node){let out='';node.childNodes.forEach(n=>{
  if(n.nodeType===3){out+=esc(n.nodeValue);return;}
  if(n.nodeType!==1)return;
  const t=n.localName;if(DROP_TAGS.has(t))return;
  if(!OK_TAGS.has(t)){out+=ser(n);return;} // nieznany tag: zostaje sam tekst
  const cls=(n.getAttribute('class')||'').split(/\s+/).filter(c=>c==='zbox'||c==='gradetbl').join(' ');
  out+='<'+t+(cls?' class="'+cls+'"':'')+'>'+(VOID.has(t)?'':ser(n)+'</'+t+'>');});return out;}
const TAG_RE=new RegExp('<(?!/?(?:'+[...OK_TAGS].join('|')+')(?:\\s+class\\s*=\\s*"[^"<>]*")?\\s*/?>)','gi'); // „<” niebędące dozwolonym znacznikiem (np. x1<x2) to tekst, nie początek tagu
function clean(s){if(s==null)return '';s=String(s);if(!/[<>&"']/.test(s))return s;const tp=document.createElement('template');tp.innerHTML=s.replace(TAG_RE,'&lt;');return ser(tp.content);} // pola HTML
const plain=s=>esc(s==null?'':s); // pola tekstowe: bez interpretacji HTML — "a<b" zostaje "a<b", a nie znacznikiem
function deepEsc(v){if(typeof v==='string')return esc(v);if(Array.isArray(v))return v.map(deepEsc);if(v&&typeof v==='object'){const o={};for(const k in v)o[k]=deepEsc(v[k]);return o;}return v;}
const noEmoji=s=>String(s).replace(/[\p{Extended_Pictographic}️‍]/gu,'').replace(/\s+/g,' ').trim();

/* ---------- mapper: przedmiot z bazy + jego tematy → przedmiot silnika ---------- */
const PALETTE=[['#B4FF3A','#7FC400','#14210A'],['#FF2E93','#B01460','#200410'],['#22D3EE','#108CA1','#04232B'],['#FFC043','#B3820E','#241800'],['#FFA023','#B36A08','#201202'],['#A855F7','#6B2AA8','#1A0A2A']];
const STAGE_TO_DB={podstawowka:'podstawowa',liceum:'liceum',studia:'studia',inne:'inne'};
const STAGE_FROM_DB={podstawowa:'podstawowka',liceum:'liceum',studia:'studia',inne:'inne'};
const hash=s=>{let h=0;for(const ch of String(s))h=(h*31+ch.charCodeAt(0))|0;return Math.abs(h);};
function paletteFor(sub){const a=String(sub.accent||'').toUpperCase();const i=PALETTE.findIndex(p=>p[0]===a);return PALETTE[i>=0?i:hash(sub.id)%PALETTE.length];}
const TASK_OK=new Set(['match','fill','order','sort','tf','timeline','finderror','thesis','chain','scenario','swipe','typeterm','chart','mathsteps']); // hotspot: obraz z AI to ryzyko XSS — zostaje w tablicy (indeksy!), ale do pominięcia
const arr=v=>Array.isArray(v)?v:[];
function shortOf(name){name=String(name||'');if(name.length<=14)return name;const w=name.split(/\s+/)[0];return w.length<=14?w:w.slice(0,13)+'…';}
const fold=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
function gamesAsTasks(games){ // starsze tematy mają `games` zamiast `tasks` — ta sama konwersja co w backendzie (packages/shared/src/tasks.ts)
  const out=[];arr(games).forEach(g=>{if(!g||typeof g!=='object')return;
    if(g.type==='match'&&arr(g.pairs).length>=2)out.push({type:'match',title:g.title,pairs:g.pairs.map(p=>[obj(p).l,obj(p).r])});
    else if(g.type==='cloze'){const items=arr(g.items).filter(i=>i&&String(i.s||'').includes('___'));
      for(let k=0;k<items.length;k+=4){const ch=items.slice(k,k+4),blanks=ch.map(i=>i.answer);
        const bank=[...new Set(ch.flatMap(i=>arr(i.options)).filter(o=>!blanks.some(b=>fold(b)===fold(o))))];
        out.push({type:'fill',title:g.title,text:ch.map((i,x)=>String(i.s).replace('___','{'+x+'}')).join('\n'),blanks,bank,e:ch.map(i=>i.e).filter(Boolean).join(' ')||undefined});}}
    else if(g.type==='truefalse'&&arr(g.items).length)out.push({type:'tf',title:g.title,statements:g.items.map(i=>({s:obj(i).s,v:obj(i).v,e:obj(i).e}))});
    else if(g.type==='order'&&arr(g.steps).length>=2)out.push({type:'order',title:g.title||g.prompt,items:[...g.steps]});});
  return out;
}
/* ---------- wizualizacje w czacie: feed[].viz (opcjonalne) ----------
   Unia po polu type: timeline / compare / cycle / flow / tree / bars / numbers, każda gałąź może mieć caption (do 120 znaków).
   Tylko znane typy i pola (dodatkowe klucze przepadają). Każdy tekst: String → bez emoji → trim → przycięcie do limitu (na surowym tekście) → esc().
   Liczby tylko przez Number (skończone, ≥ 0). Za mało elementów albo same zera na wykresie → null (silnik nie pokaże nic, tekst dawki zostaje). */
const VIZ_TYPES=new Set(['timeline','compare','cycle','flow','tree','bars','numbers']);
const cut=(s,n)=>{const a=[...s];return a.length>n?a.slice(0,n-1).join('').trimEnd()+'…':s;}; // po znakach (nie bajtach) — przed esc(), więc encja nigdy się nie urwie
const TAGLIKE=/<\/?[a-zA-Z][\w-]*(?:\s[^<>]*)?\/?>/g; // znaczniki w tekście wizualizacji (serwer je usuwa; tu na wypadek starszego API) — samotne „<” (x<y) zostaje jako tekst
function vs(v,n){if(typeof v==='number'&&isFinite(v))v=String(v);if(typeof v!=='string')return '';return esc(cut(noEmoji(v.replace(TAGLIKE,' ')).replace(/ ([,.;:!?)])/g,'$1'),n));}
function vnum(v){const x=typeof v==='number'?v:typeof v==='string'&&/^\s*-?\d+(?:[.,]\d+)?\s*$/.test(v)?Number(v.replace(',','.')):NaN;return isFinite(x)&&x>=0?x:null;}
function vlist(v,min,max,fn){const out=arr(v).slice(0,max*3).map(fn).filter(Boolean).slice(0,max);return out.length>=min?out:null;} // puste/złe elementy odpadają, potem limit liczby
function mapViz(v){
  if(!v||typeof v!=='object'||Array.isArray(v)||!VIZ_TYPES.has(v.type))return null;
  const t=v.type,o={type:t},cap=vs(v.caption,120);if(cap)o.caption=cap;
  if(t==='timeline'){o.items=vlist(v.items,3,7,x=>{x=obj(x);const w=vs(x.when,24),l=vs(x.label,80);return w&&l?{when:w,label:l}:null;});if(!o.items)return null;}
  else if(t==='compare'){o.a=vs(v.a,40);o.b=vs(v.b,40);if(!o.a||!o.b)return null;
    o.rows=vlist(v.rows,2,5,x=>{x=obj(x);const k=vs(x.k,40),a=vs(x.a,80),b=vs(x.b,80);return k&&a&&b?{k,a,b}:null;});if(!o.rows)return null;}
  else if(t==='cycle'){o.steps=vlist(v.steps,3,6,x=>vs(x,60)||null);if(!o.steps)return null;}
  else if(t==='flow'){o.kind=v.kind==='cause'?'cause':'process';o.steps=vlist(v.steps,2,6,x=>vs(x,60)||null);if(!o.steps)return null;}
  else if(t==='tree'){o.root=vs(v.root,60);if(!o.root)return null;
    o.groups=vlist(v.groups,2,4,g=>{g=obj(g);const name=vs(g.name,40),items=vlist(g.items,1,5,x=>vs(x,50)||null);return name&&items?{name,items}:null;});if(!o.groups)return null;}
  else if(t==='bars'){o.unit=vs(v.unit,12);o.items=vlist(v.items,2,7,x=>{x=obj(x);const label=vs(x.label,40),value=vnum(x.value);return label&&value!=null?{label,value}:null;});
    if(!o.items||!o.items.some(x=>x.value>0))return null;}
  else if(t==='numbers'){o.items=vlist(v.items,1,4,x=>{x=obj(x);const value=vs(x.value,16),label=vs(x.label,80);return value&&label?{value,label}:null;});if(!o.items)return null;}
  return o;
}
const numPl=x=>String(Math.round(x*100)/100).replace('.',',');
function vizText(v){ // zwykły tekst (już escapowany) z wizualizacji — dla trybów, które czytają tylko tekst dawki (wyjaśnij inaczej, znaczenie pojęcia, sprawdzian z luką)
  if(!v||typeof v!=='object')return '';const S=[],dot=s=>/[.!?…]$/.test(s)?s:s+'.';
  if(v.caption)S.push(dot(v.caption));
  if(v.type==='timeline')arr(v.items).forEach(x=>S.push(dot(x.when+' — '+x.label)));
  else if(v.type==='compare')arr(v.rows).forEach(x=>S.push(dot(x.k+' — '+v.a+': '+x.a+'; '+v.b+': '+x.b)));
  else if(v.type==='cycle')S.push(dot(arr(v.steps).concat(arr(v.steps).slice(0,1)).join(' → ')));
  else if(v.type==='flow')S.push(dot(arr(v.steps).join(' → ')));
  else if(v.type==='tree'){S.push(dot(v.root));arr(v.groups).forEach(g=>S.push(dot(g.name+' — '+arr(g.items).join(', '))));}
  else if(v.type==='bars')arr(v.items).forEach(x=>S.push(dot(x.label+' — '+numPl(x.value)+(v.unit?' '+v.unit:''))));
  else if(v.type==='numbers')arr(v.items).forEach(x=>S.push(dot(x.value+' — '+x.label)));
  return S.join(' ');
}
function mapLevel(l,topicId,i,first,used){
  const base='t'+String(topicId).replace(/-/g,'').slice(0,8)+'_'+String(l&&l.id||('l'+(i+1))).replace(/[^A-Za-z0-9_-]/g,'_');
  let id=base,n=2;while(used.has(id))id=base+'_'+(n++);used.add(id);
  const L=obj(l);
  const feed=arr(L.feed).map(f=>{f=obj(f);const o={...deepEsc(f),body:clean(f.body),real:clean(f.real),mnemo:clean(f.mnemo)};delete o.viz;const v=mapViz(f.viz);if(v)o.viz=v;return o;}); // viz: osobny mapper (deepEsc przepuściłby liczby i nieznane pola)
  const flashcards=arr(L.flashcards).map(c=>{c=obj(c);return {...deepEsc(c),d:clean(c.d)};});
  const quiz=arr(L.quiz).map(q=>{q=deepEsc(obj(q));const a=arr(q.a).map(x=>typeof x==='string'?x:esc(x));let c=+q.c;if(!(Number.isInteger(c)&&c>=0&&c<a.length))c=0;return {...q,q:String(q.q||''),a,c,e:String(q.e||'')};});
  const own=arr(L.tasks);const src=own.some(t=>t&&TASK_OK.has(t.type))?own:gamesAsTasks(L.games);
  const tasks=src.map(t=>t&&TASK_OK.has(t.type)?deepEsc(t):{type:'_skip'});
  return {id,title:esc(noEmoji(L.title||'')||('Poziom '+(i+1))),topicId,chapter:!!first,feed,flashcards,quiz,tasks};
}
function toEngine(){
  const bySub={};DATA.topics.forEach(t=>{(bySub[t.subject_id]=bySub[t.subject_id]||[]).push(t);});
  return DATA.subjects.filter(s=>(bySub[s.id]||[]).length).map(s=>{
    const tps=bySub[s.id];const c0=obj(tps[0]&&tps[0].content);const pal=paletteFor(s);const used=new Set();
    const levels=[];tps.forEach((t,ti)=>arr(obj(t.content).levels).forEach((l,li)=>levels.push(mapLevel(l,t.id,li,ti>0&&li===0,used))));
    const g=obj(c0.grading);let scale=arr(g.scale).filter(x=>Array.isArray(x)&&x.length===2&&isFinite(+x[0])).map(x=>[+x[0],plain(noEmoji(x[1]))]).filter(x=>x[1]);
    let grading;if(scale.length){scale.sort((a,b)=>b[0]-a[0]);const low=scale[scale.length-1][0]; // każdy próg ze skali to ocena pozytywna — zaliczenie od najniższego
      grading={pass:Math.min(+g.pass||50,low),examMin:Math.max(1,+g.examMin||10),scale,failLabel:plain(noEmoji(g.failLabel||'')||'niezaliczone')};}
    return {id:s.id,name:plain(s.name||c0.name||'Przedmiot'),short:plain(shortOf(s.name||c0.short||c0.name)),tagline:plain(c0.tagline||''),
      accent:pal[0],accent2:pal[0],accentDark:pal[1],onAccent:pal[2],level:STAGE_FROM_DB[s.stage]||'inne',lang:tps.some(t=>obj(t.content).lang),
      grading,info:tps.map(t=>clean(obj(t.content).info||'')).join(''),levels,topics:tps.map(t=>({id:t.id,name:plain(t.name),createdAt:t.created_at}))};
  });
}
const pickable=()=>DATA.subjects.map(s=>({id:s.id,name:String(s.name||''),stage:STAGE_FROM_DB[s.stage]||'inne',topics:DATA.topics.filter(t=>t.subject_id===s.id).length})); // surowe nazwy — UI wstawia je przez textContent
const subjectName=id=>{const s=DATA.subjects.find(x=>x.id===id);return s?String(s.name||''):'';};

/* ---------- synchronizacja postępów (app_state) ----------
   Serwer numeruje zapisy (rev, trigger). Urządzenie pamięta ostatni wspólny stan (base, localStorage) i jego rev.
   pull: nic nowego w chmurze → wysyłamy swoje; nowe w chmurze → scalenie trójstronne (base, lokalny, chmura) i od razu przeładowanie silnika.
   push: PATCH tylko gdy rev się zgadza — inaczej ktoś zapisał w międzyczasie → pull i ponowne scalenie. Bez pierwszego pull nic nie wysyłamy.
   Własny zapis, którego odpowiedź zginęła (sieć), rozpoznajemy po client_ts — nie liczymy go drugi raz.
   Gdy silnik jest w trakcie lekcji, zmiany z chmury czekają (pending) do bezpiecznego momentu. */
const PK='nauka_progress_v1:'+UID,MK='nauka_meta_v1:'+UID,DIRTYK='cf_dirty:'+UID,REVK='cf_rev:'+UID,BASEK='cf_base:'+UID,SENTK='cf_sent:'+UID;
let pulled=false,syncOff=false,pending=null,base=null,pushT=null,pushing=null,dseq=0;
let hooks={canApply:()=>true,apply:null};
function bindEngine(canApply,apply){hooks={canApply:canApply||(()=>true),apply:apply||null};}
const hasLocalState=()=>!!(LS.getItem(PK)||LS.getItem(MK));
const localState=()=>({progress:obj(jget(PK,{})),meta:obj(jget(MK,{}))});
const clone=v=>JSON.parse(JSON.stringify(v));
function loadBase(){if(!base){const b=jget(BASEK,null);if(b&&typeof b==='object')base={progress:obj(b.progress),meta:obj(b.meta)};}return base||{progress:{},meta:{}};}
function setBase(b){base={progress:obj(b.progress),meta:obj(b.meta)};jset(BASEK,base);}
const missing=e=>e&&(e.status===404||e.code==='PGRST205'||e.code==='42P01'||e.code==='PGRST202'); // brak tabeli/funkcji — migracja 0004 jeszcze niewgrana
function markDirty(){lset(DIRTYK,Date.now()+'.'+(++dseq));}
function dirty(){if(!UID)return;markDirty();clearTimeout(pushT);pushT=setTimeout(()=>(pulled?push():pull()).catch(()=>{}),4000);} // przed pierwszym pobraniem najpierw pull (on potem wyśle)
async function push(){
  if(!UID||!pulled||syncOff||pending||!LS.getItem(DIRTYK))return;
  if(pushing)return pushing;
  pushing=(async()=>{try{
    const mark=LS.getItem(DIRTYK),st=localState(),rev=+LS.getItem(REVK)||0,ts=Date.now()*1000+(dseq%1000),body={progress:st.progress,meta:st.meta,client_ts:ts};
    jset(SENTK,{ts,st});
    let rows;
    try{rows=rev?await rest('app_state?user_id=eq.'+UID+'&rev=eq.'+rev,{method:'PATCH',prefer:'return=representation',body})
      :await rest('app_state?on_conflict=user_id',{method:'POST',prefer:'resolution=ignore-duplicates,return=representation',body:{user_id:UID,...body}});}
    catch(e){if(missing(e))syncOff=true;throw e;}
    const row=Array.isArray(rows)&&rows[0];
    if(!row){LS.removeItem(SENTK);pushing=null;await pull();return;} // w chmurze jest nowszy zapis → scal i wyślij jeszcze raz (pull sam wywoła push)
    LS.removeItem(SENTK);lset(REVK,row.rev);setBase(st);
    if(LS.getItem(DIRTYK)===mark)LS.removeItem(DIRTYK);
  }finally{pushing=null;}})();
  return pushing;
}
async function flush(){clearTimeout(pushT);return pulled?push():pull().then(()=>{});}

/* scalanie trójstronne: gdzie zmieniła się tylko jedna strona — ta wygrywa; gdzie obie — liczniki sumują zmiany, reszta wg typu */
const same=(a,b)=>a===b||JSON.stringify(a)===JSON.stringify(b);
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const ADD=new Set(['xp','gems','examsPassed','levels','cards','reviews','missions','planDays','bosses']); // liczniki (też dzienne w history i w stats): zdobyte i wydane na obu urządzeniach się sumują; reszta liczb (rekordy, terminy SRS, zamrożenia) — maksimum
const ZERO={}; // znacznik: obie strony utworzyły ten obiekt niezależnie (nowy dzień w history/daily) — liczniki liczymy od zera
const byId=a=>Array.isArray(a)&&a.every(x=>isObj(x)&&(typeof x.id==='string'||typeof x.id==='number')); // też pusta lista (wszystko usunięte po jednej stronie)
function m3(b,l,c,k){
  if(ADD.has(k)&&typeof l==='number'&&typeof c==='number'){const bb=b===ZERO?0:b;if(typeof bb==='number')return Math.max(0,c+(l-bb));}
  if(same(l,c))return l;
  if(b!==ZERO){if(same(l,b))return c;if(same(c,b))return l;}
  if(l===undefined)return c;if(c===undefined)return l;
  if(isObj(l)&&isObj(c)){
    const o={},bb=isObj(b)?b:{};
    new Set([...Object.keys(c),...Object.keys(l)]).forEach(x=>{
      let bx=b===ZERO?ZERO:bb[x];
      if(k==='history'&&bx===undefined&&isObj(l[x])&&isObj(c[x]))bx=ZERO; // ten sam dzień zaczęty na dwóch urządzeniach
      const v=m3(bx,l[x],c[x],x);if(v!==undefined)o[x]=v;});
    return o;}
  if(typeof l==='number'&&typeof c==='number')return Math.max(l,c);
  if(typeof l==='boolean'&&typeof c==='boolean')return l||c;
  if(Array.isArray(l)&&Array.isArray(c)){
    const ba=Array.isArray(b)?b:[];
    if(l.concat(c).every(x=>x===null||typeof x!=='object')){ // zbiór: zostaje to, co jest po obu stronach, albo nowe po jednej; usunięte po jednej stronie znika
      const inB=x=>ba.some(y=>y===x),inL=x=>l.some(y=>y===x),inC=x=>c.some(y=>y===x);
      return [...new Set(c.concat(l))].filter(x=>(inL(x)&&inC(x))||!inB(x));}
    if(byId(l)&&byId(c)){ // np. plany do sprawdzianu: scalanie po id
      const bi=new Map((byId(ba)?ba:[]).map(x=>[String(x.id),x])),li=new Map(l.map(x=>[String(x.id),x])),out=[];
      const ids=[...new Set(c.map(x=>String(x.id)).concat(l.map(x=>String(x.id))))];
      ids.forEach(id=>{const L=li.get(id),Cc=c.find(x=>String(x.id)===id),B=bi.get(id);
        if(L&&Cc){out.push(m3(B,L,Cc,''));return;}
        const one=L||Cc;if(!B||!same(one,B))out.push(one);}); // nowy albo zmieniony po tej stronie → zostaje; nietknięty, a usunięty po drugiej → znika
      return out;}
  }
  return l; // tekst, ustawienie: wygrywa urządzenie, na którym się uczysz
}
const dplus=(d,n)=>{const p=String(d).split('-').map(Number);const x=new Date(Date.UTC(p[0],p[1]-1,p[2]+n));return x.getUTCFullYear()+'-'+String(x.getUTCMonth()+1).padStart(2,'0')+'-'+String(x.getUTCDate()).padStart(2,'0');};
const DAY=/^\d{4}-\d{2}-\d{2}$/;
function streakDays(m,frozen){ // dni aktywne serii (bez dni pokrytych zamrożeniem)
  const out=new Set();if(!m||!DAY.test(m.lastDay||'')||!(+m.streak>0))return out;
  let d=m.lastDay,left=+m.streak;for(let i=0;left>0&&i<2000;i++){if(!frozen.has(d)){out.add(d);left--;}d=dplus(d,-1);}return out;
}
function mergeStreak(lm,cm,out){ // seria z obu urządzeń: suma dni aktywnych; liczymy wstecz od ostatniego dnia, zamrożone dni przechodzą bez liczenia
  const frozen=new Set([].concat(arr(lm&&lm.frozenDays),arr(cm&&cm.frozenDays)).filter(d=>DAY.test(d)));
  const days=new Set([...streakDays(lm,frozen),...streakDays(cm,frozen)]);if(!days.size)return;
  const last=[...days].sort().pop();let n=0,d=last;
  for(let i=0;i<4000;i++){if(days.has(d))n++;else if(!frozen.has(d))break;d=dplus(d,-1);}
  out.lastDay=last;out.streak=n;out.best=Math.max(+out.best||0,n);
}
function merge3(b,l,c){
  b=b||{progress:{},meta:{}};
  const le=+obj(l.progress).epoch||0,ce=+obj(c.progress).epoch||0; // „Wyzeruj postępy” ustawia epoch — nowszy reset wygrywa w całości
  let progress;
  if(le!==ce)progress=le>ce?l.progress:c.progress;
  else{const bp={...obj(b.progress)},ld=obj(l.progress.daily),cd=obj(c.progress.daily);
    if(ld.date&&ld.date===cd.date&&ld.date!==obj(bp.daily).date)bp.daily=ZERO; // nowy dzień na obu urządzeniach: dzienny plan liczymy od zera, nie od wczoraj
    progress=m3(bp,l.progress,c.progress,'');}
  const meta=clone(obj(m3(b.meta,l.meta,c.meta,'')));
  const bm=obj(b.meta),ch=m=>!same(obj(m).streak,bm.streak)||!same(obj(m).lastDay,bm.lastDay);
  if(ch(l.meta)&&ch(c.meta))mergeStreak(l.meta,c.meta,meta); // tylko gdy seria zmieniła się na obu urządzeniach
  return {progress:clone(obj(progress)),meta};
}
async function pull(canApply,apply){ // zwraca true, gdy lokalny stan się zmienił (i apply() już przeładował silnik)
  if(!UID||syncOff)return false;
  if(pushing)await pushing.catch(()=>{}); // własny zapis w locie: najpierw jego wynik, inaczej wzięlibyśmy go za cudzy
  canApply=canApply||hooks.canApply;if(apply===undefined)apply=hooks.apply;
  let rows;try{rows=await rest('app_state?select=progress,meta,rev,client_ts&user_id=eq.'+UID);}
  catch(e){if(missing(e)){syncOff=true;emit('sync',{off:true});return false;}throw e;}
  loadBase();
  const row=Array.isArray(rows)&&rows[0]||null,rev=+LS.getItem(REVK)||0,sent=jget(SENTK,null);
  if(!row){pulled=true;pending=null;if(rev)LS.removeItem(REVK);if(hasLocalState()){markDirty();push().catch(()=>{});}return false;}
  if(sent&&+row.client_ts===+sent.ts){LS.removeItem(SENTK);lset(REVK,row.rev);setBase(sent.st);pulled=true;pending=null;if(LS.getItem(DIRTYK))push().catch(()=>{});return false;} // to nasz zapis (odpowiedź zginęła)
  if(+row.rev===rev){pulled=true;pending=null;if(LS.getItem(DIRTYK))push().catch(()=>{});return false;}
  if(!hasLocalState()){ // świeże urządzenie: stan z chmury wprost
    const st={progress:obj(row.progress),meta:obj(row.meta)};jset(PK,st.progress);jset(MK,st.meta);lset(REVK,row.rev);setBase(st);
    pulled=true;pending=null;if(apply)try{apply();}catch(e){}return true;}
  return applyRow(row,canApply,apply);
}
function applyRow(row,canApply,apply){ // synchronicznie: sprawdzenie, zapis i przeładowanie silnika w jednym kroku — silnik nie zdąży nadpisać scalonego stanu
  if(canApply&&!canApply()){pending=row;return false;}
  const cl={progress:obj(row.progress),meta:obj(row.meta)};
  const m=merge3(loadBase(),localState(),cl);
  if(!jset(PK,m.progress)||!jset(MK,m.meta))return false;
  lset(REVK,row.rev);setBase(cl);pulled=true;pending=null;LS.removeItem(SENTK);
  if(same(m,cl))LS.removeItem(DIRTYK);else markDirty(); // przed apply(): zapisy silnika przy przeładowaniu oznaczą stan na nowo
  if(apply)try{apply();}catch(e){}
  if(LS.getItem(DIRTYK))setTimeout(()=>push().catch(()=>{}),0);
  return true;
}
async function applyPending(canApply,apply){if(!pending)return false;return applyRow(pending,canApply||hooks.canApply,apply===undefined?hooks.apply:apply);}
['visibilitychange','pagehide','pause'].forEach(ev=>document.addEventListener(ev,()=>{if(ev!=='visibilitychange'||document.visibilityState==='hidden')flush().catch(()=>{});}));

/* ---------- materiały i generowanie ---------- */
const PPTX_MIME='application/vnd.openxmlformats-officedocument.presentationml.presentation';
const OK_MIME=/^(image\/(jpeg|png|webp|gif)|application\/pdf|text\/(plain|markdown)|application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation)$/; // to samo co bucket „materials” (HEIC zamieniamy na JPEG w downscale; PPTX od migracji 0006)
const EXT_MIME={pdf:'application/pdf',txt:'text/plain',md:'text/markdown',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',heic:'image/heic',heif:'image/heif',pptx:PPTX_MIME};
const MIME_EXT={'application/pdf':'pdf','text/markdown':'md','text/plain':'txt','image/png':'png','image/webp':'webp','image/gif':'gif','image/jpeg':'jpg',[PPTX_MIME]:'pptx'};
const extOf=f=>(String(f&&f.name||'').toLowerCase().match(/\.(\w+)$/)||[])[1]||'';
const mimeOf=f=>{const t=String(f&&f.type||'').toLowerCase(),e=EXT_MIME[extOf(f)]; // pusty albo ogólny typ (Pliki na iOS potrafią podać octet-stream/zip dla .pptx) → po rozszerzeniu
  return (!t||((t==='application/octet-stream'||t==='application/zip'||t==='application/x-zip-compressed')&&e))?(e||''):t;};
async function downscale(file){ // maks. 1568 px, JPEG — mniejszy upload, bez EXIF (GPS), HEIC → JPEG, przezroczystość na białym tle
  const url=URL.createObjectURL(file);
  try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url;});
    const k=Math.min(1,1568/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*k));c.height=Math.max(1,Math.round(img.naturalHeight*k));
    const ctx=c.getContext('2d');if(!ctx)return null;ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
    return await new Promise(res=>c.toBlob(res,'image/jpeg',.82));}
  catch(e){return null;}finally{URL.revokeObjectURL(url);}
}
async function prepareFiles(files){ // przed utworzeniem przedmiotu: format i rozmiar znane, zanim cokolwiek zapiszemy
  const out=[];for(const f of files){let mime=mimeOf(f),blob=f;
    if(/^image\//.test(mime)){const j=await downscale(f);if(j){blob=j;mime='image/jpeg';}} // GIF też (pierwsza klatka); HEIC dekoduje dopiero WebKit z iOS 17
    if(!OK_MIME.test(mime))throw new CloudError(400,'bad_type','Ten format nie jest obsługiwany',{name:f.name||'',heic:/hei[cf]/.test(mime)});
    if(/^image\//.test(mime)&&blob.size>5*1048576)throw new CloudError(400,'file_too_big','Zdjęcie jest za duże',{maxMb:5}); // limit AI na obraz
    out.push({blob,mime,name:String(f.name||'').slice(0,120),size:blob.size||0});}
  return out;
}
async function createSubject(o){const pal=PALETTE[o.color|0]||PALETTE[0];const rows=await rest('subjects',{method:'POST',prefer:'return=representation',body:{owner_id:UID,name:String(o.name||'Nowy przedmiot').slice(0,60),emoji:'📘',stage:STAGE_TO_DB[o.stage]||'inne',accent:pal[0],accent2:pal[0],position:DATA.subjects.length}});
  const s=rows[0];DATA.subjects.push(s);await saveCache();return s;}
async function updateSubject(id,patch){const body={};if(patch.name!=null)body.name=String(patch.name).slice(0,60);if(patch.color!=null&&PALETTE[patch.color]){body.accent=PALETTE[patch.color][0];body.accent2=PALETTE[patch.color][0];}
  const rows=await rest('subjects?id=eq.'+id,{method:'PATCH',prefer:'return=representation',body});const s=DATA.subjects.find(x=>x.id===id);if(s&&rows&&rows[0])Object.assign(s,rows[0]);await saveCache();emit('subjects');}
function upFail(e){ // błąd wysyłki → kod dla UI; limit generacji jeszcze nietknięty
  if(e.code==='network'||e.code==='file_too_big'||e.status===401||/^(no_session|upload_failed)$/.test(e.code))return e;
  if(e.status===413||/maximum (allowed )?size|too large|entity_too_large/i.test(String(e.message||'')+' '+String(e.code||'')))return new CloudError(413,'file_too_big','Plik jest za duży',{});
  return new CloudError(e.status||0,'upload_failed',e.message,e.data);
}
async function uploadMaterial(p,onProgress){ // p z prepareFiles; onProgress(wysłane bajty, wszystkie) — duże pliki kawałkami, małe jednym żądaniem
  const ext=MIME_EXT[p.mime]||(/^text/.test(p.mime)?'txt':'jpg');
  const path=UID+'/'+uuid()+'.'+ext,size=p.blob.size;
  try{if(size>TUS_CHUNK)await tusUpload(path,p.blob,p.mime,onProgress);
    else{await storageUpload(path,p.blob,p.mime);if(onProgress)try{onProgress(size,size);}catch(e){}}}
  catch(e){throw upFail(e);}
  try{const rows=await rest('materials',{method:'POST',prefer:'return=representation',body:{owner_id:UID,storage_path:path,mime:p.mime,size_bytes:p.size,name:p.name||null}});return {id:rows[0].id,path};}
  catch(e){storageRemove([path]).catch(()=>{});throw upFail(e);} // wiersz materiału nie powstał — generowanie nie ruszyło, limit nietknięty
}
async function discard(o){ // sprzątanie po nieudanej próbie (generowanie na pewno nie ruszyło albo skończyło się błędem): pliki, wiersze materiałów, pusty nowy przedmiot
  const ms=arr(o.materials);
  if(ms.length){try{await rest('materials?id=in.('+ms.map(m=>m.id).join(',')+')',{method:'DELETE'});}catch(e){}try{await storageRemove(ms.map(m=>m.path));}catch(e){}}
  if(o.subjectId&&!DATA.topics.some(t=>t.subject_id===o.subjectId)){try{await rest('subjects?id=eq.'+o.subjectId,{method:'DELETE'});DATA.subjects=DATA.subjects.filter(s=>s.id!==o.subjectId);await saveCache();emit('subjects');}catch(e){}}
}
const JOBK='cf_job:'+UID;
const job=()=>jget(JOBK,null);
async function addTopic(topicId){const rows=await rest('topics?select=id,subject_id,name,position,created_at,content&id=eq.'+topicId);const t=rows&&rows[0];if(!t)throw new CloudError(404,'not_found','Nie znaleziono lekcji');
  if(!DATA.topics.some(x=>x.id===t.id))DATA.topics.push(t);const s=DATA.subjects.find(x=>x.id===t.subject_id);
  if(s&&/^Nowy przedmiot$/.test(s.name)&&t.content&&t.content.name){try{await updateSubject(s.id,{name:t.content.name});}catch(e){}} // nazwa z AI, gdy nie podano własnej
  await saveCache();emit('subjects');return t;}
async function generate(o){ // o={subjectId, materialIds, text, hint, stage, subjectName}; bez automatycznego ponawiania — każde wywołanie zjada limit
  let prev=null,prevOk=false;try{const g=await rest('generations?select=id,created_at&subject_id=eq.'+o.subjectId+'&order=created_at.desc&limit=1');prevOk=true;if(g&&g[0])prev=g[0].created_at;}catch(e){if(e.code==='network')throw e;}
  jset(JOBK,{subjectId:o.subjectId,startedAt:Date.now(),materialIds:o.materialIds||[],prevAt:prev||null,prevOk,created:o.created||null,materials:arr(o.materials)}); // created/materials: do posprzątania, gdy odzyskanie skończy się błędem
  const r=await api('/api/generate',{method:'POST',body:{subjectId:o.subjectId,materialIds:o.materialIds||[],text:o.text||undefined,
    options:{stage:STAGE_TO_DB[o.stage]||'inne',subjectName:o.subjectName==null?undefined:String(o.subjectName).slice(0,80),mode:'materials',levels:4,locale:'pl',hint:o.hint||undefined,viz:true}}}); // viz: ta wersja rysuje wizualizacje w czacie (starsze buildy go nie wysyłają → serwer daje stary format); sieć: dziennik zostaje → recoverJob
  const d=obj(r.data);
  if(r.status>=400||!d.topicId){LS.removeItem(JOBK);throw new CloudError(r.status,String(d.code||(r.status>=500?'generation_failed':'bad_request')),String(d.error||''),d);}
  jset(JOBK,{...job(),topicId:d.topicId});
  let t;try{t=await addTopic(d.topicId);}catch(e){throw new CloudError(0,'network_after_post',e.message);} // temat jest na serwerze — dziennik zostaje, recoverJob go dociągnie
  LS.removeItem(JOBK);return {topic:t,demo:!!d.demo};
}
async function recoverJob(){ // po powrocie apki / starcie: czy przerwana generacja jednak się udała; chwilowy brak sieci nie przerywa sprawdzania
  const j=job();if(!j)return null;
  if(!j.subjectId||!(Date.now()-(+j.startedAt||0)<86400000)){LS.removeItem(JOBK);return null;} // stary albo uszkodzony dziennik nie blokuje dodawania
  if(j.topicId){let t;try{t=await addTopic(j.topicId);}catch(e){if(e.status>=400&&e.status<500&&e.status!==401)LS.removeItem(JOBK);throw e;}LS.removeItem(JOBK);emit('job',{state:'done',topic:t});return t;}
  const since=j.prevAt?'&created_at=gt.'+encodeURIComponent(j.prevAt):j.prevOk?'':'&created_at=gte.'+encodeURIComponent(new Date(j.startedAt-120000).toISOString()); // bez zegara urządzenia, gdy wiemy, że wcześniej nic nie było
  const ids='&material_ids=eq.'+encodeURIComponent('{'+arr(j.materialIds).join(',')+'}');
  for(;;){
    const age=(Date.now()-j.startedAt)/1000;let g=null;
    try{const rows=await rest('generations?select=id,status,topic_id,error,created_at&subject_id=eq.'+j.subjectId+ids+since+'&order=created_at.desc&limit=1');g=rows&&rows[0]||null;}
    catch(e){if(e.code!=='network'||age>330)throw e;emit('job',{state:'offline',age});await sleep(8000);continue;}
    if(g&&g.status==='done'&&g.topic_id){jset(JOBK,{...j,topicId:g.topic_id});const t=await addTopic(g.topic_id);LS.removeItem(JOBK);emit('job',{state:'done',topic:t});return t;}
    if(g&&g.status==='failed'){LS.removeItem(JOBK);emit('job',{state:'failed',error:g.error});throw new CloudError(500,'generation_failed','',{});}
    if(!g&&age>90){LS.removeItem(JOBK);emit('job',{state:'lost'});throw new CloudError(0,'not_started','Generowanie nie ruszyło',{});} // POST nie dotarł do serwera — limit bez zmian
    if(age>330){LS.removeItem(JOBK);emit('job',{state:'lost'});throw new CloudError(504,'lost','Generowanie nie dokończyło się');}
    emit('job',{state:'running',age});await sleep(8000);
  }
}
async function me(){const r=await api('/api/me');if(r.status>=400)throw errOf(r);let trial=null;try{const p=await rest('profiles?select=trial_until&id=eq.'+UID);trial=p&&p[0]&&p[0].trial_until||null;}catch(e){}return {...obj(r.data),trialUntil:trial};}

/* ---------- usunięcie konta: sprawdzenie na serwerze → pliki → RPC (kaskada w bazie) → dane lokalne ---------- */
async function deleteAccount(){
  await rest('rpc/delete_my_account',{method:'POST',body:{p_dry_run:true}}); // odmowa (np. aktywna subskrypcja) albo brak funkcji → nic jeszcze nie skasowaliśmy
  const files=await storageListAll(UID);if(files.length)await storageRemove(files);
  await rest('rpc/delete_my_account',{method:'POST',body:{p_dry_run:false}});
  clearTimeout(pushT);syncOff=true;await wipeLocal(UID);
}

window.NAUKA_CLOUD={CloudError,on,uid:UID,email:()=>session&&session.user.email||'',signedIn:()=>!!session,
  signUp,signIn,signOut,token,loadCache,fetchAll,toEngine,pickable,subjectName,clean,plain,esc,
  dirty,flush,pull,bindEngine,hasLocalState,hasPending:()=>!!pending,applyPending,syncAvailable:()=>!syncOff,
  prepareFiles,createSubject,updateSubject,uploadMaterial,discard,generate,job,recoverJob,me,deleteAccount,PALETTE,OK_MIME,PPTX_MIME,mimeOf,vizText,
  _merge3:merge3,_mapViz:mapViz};
})();
