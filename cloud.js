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
const LS=(()=>{try{const s=globalThis['localStorage'];s.setItem('__cf','1');s.removeItem('__cf');return s;}catch(e){const m={};return {volatile:true,getItem:k=>k in m?m[k]:null,setItem:(k,v)=>{m[k]=String(v);},removeItem:k=>{delete m[k];},key:i=>Object.keys(m)[i]||null,get length(){return Object.keys(m).length;}};}})();
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
async function authPost(path,body,tok,timeout){
  const h={apikey:CFG.anonKey,'Content-Type':'application/json'};if(tok)h.Authorization='Bearer '+tok;
  const r=await http(CFG.supabaseUrl+'/auth/v1'+path,{method:'POST',headers:h,body,timeout});
  if(r.status>=400)throw errOf(r);return r.data;
}
const SEENK='cf_seen'; // na tym urządzeniu ktoś już się logował — ekran logowania otwiera się na „Zaloguj się” (bez danych konta)
function saveSession(d){
  if(!d||!d.access_token||!d.user)throw new CloudError(0,'no_session','Serwer nie zwrócił sesji');
  session={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:d.expires_at||Math.floor(Date.now()/1000)+(d.expires_in||3600),user:{id:d.user.id,email:d.user.email||''}};
  jset(SKEY,session);lset(SEENK,'1');return session;
}
if(session)lset(SEENK,'1'); // zalogowani w starszych wersjach też (po wylogowaniu albo wygaśnięciu sesji: zakładka „Zaloguj się”)
const knownDevice=()=>{try{if(LS.getItem(SEENK))return true;for(let i=0;i<LS.length;i++){const k=LS.key(i);if(k&&k.startsWith('nauka_progress_v1:'))return true;}}catch(e){}return false;};
async function signUp(email,password){
  const d=await authPost('/signup',{email,password,data:{age16:true,client:'cramfox'}}); // client: skąd konto (od backend/0007 nie daje okresu próbnego — nowe konta są free: 2 darmowe lekcje na zawsze)
  if(!d||!d.access_token)throw new CloudError(0,'needs_confirm','Konto wymaga potwierdzenia e-maila');
  return saveSession(d);
}
async function signIn(email,password){return saveSession(await authPost('/token?grant_type=password',{email,password}));}
let refreshing=null;
async function refresh(force){
  if(!session)throw new CloudError(401,'no_session','Zaloguj się');
  if(!force&&session.expires_at-60>Date.now()/1000)return session.access_token;
  if(!refreshing)refreshing=(async()=>{
    const t0=Date.now();
    try{for(let i=0;;i++){ // zgubiona odpowiedź: serwer mógł już wymienić token — stary działa jeszcze ok. 10 s (reuse interval GoTrue), więc 1–2 ponowienia w tym oknie
      try{saveSession(await authPost('/token?grant_type=refresh_token',{refresh_token:session.refresh_token},null,8000));break;}
      catch(e){if(e.code!=='network'||i>=2||Date.now()-t0>6000||!session||navigator.onLine===false)throw e;await sleep(1200);}}}
    catch(e){if(e.status===400||e.status===401){session=null;LS.removeItem(SKEY);emit('signedout',e);}throw e;} // sesja odwołana → logowanie (dane lokalne zostają); brak sieci → działamy dalej na starym tokenie
    finally{refreshing=null;}
    return session.access_token;})();
  try{return await refreshing;}catch(e){if(e.code==='network'&&session)return session.access_token;throw e;}
}
const token=()=>refresh(false);
async function wipeLocal(uid){
  const keys=[];for(let i=0;i<LS.length;i++){const k=LS.key(i);if(k&&(k.endsWith(':'+uid)||k===SKEY))keys.push(k);}
  keys.forEach(k=>LS.removeItem(k));await idbDel('data:'+uid);await idbDel('base:'+uid);
  await idbDelPrefix('m:'+uid+':');await idbDel('mi:'+uid); // pliki rolek i podcastu z pamięci podręcznej (plan-media §4.6)
}
async function signOut(o){ // o.force: wyloguj mimo niewysłanych postępów (UI pyta wcześniej)
  o=o||{};clearTimeout(pushT);
  if(!o.force){
    for(let i=0;i<2&&!syncOff&&LS.getItem(DIRTYK);i++){try{if(pending)await applyPending(()=>true);else if(!pulled)await pull(()=>true);await push();}catch(e){break;}} // druga próba: po konflikcie push scala i wysyła jeszcze raz
    if(LS.getItem(DIRTYK))throw new CloudError(0,'unsynced','Część postępów nie jest jeszcze zapisana na koncie',{reason:syncOff?'off':storeFull?'full':'network'});
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
async function storageListAll(prefix,bucket){bucket=bucket||'materials';const out=[];for(let off=0;off<10000;off+=100){const page=await storage('object/list/'+bucket,{method:'POST',headers:{'Content-Type':'application/json'},body:{prefix,limit:100,offset:off}});if(!Array.isArray(page)||!page.length)break;page.forEach(f=>{if(f&&f.name&&f.id!==null)out.push(prefix+'/'+f.name);});if(page.length<100)break;}return out;}
async function storageRemove(paths,bucket){bucket=bucket||'materials';for(let i=0;i<paths.length;i+=100)await storage('object/'+bucket,{method:'DELETE',headers:{'Content-Type':'application/json'},body:{prefixes:paths.slice(i,i+100)}});}

/* ---------- API na Vercelu: natywnie (bez CORS), w przeglądarce przez lokalne proxy; 401 → odśwież token i ponów raz (serwer sprawdza sesję przed limitem) ---------- */
async function api(path,o){
  o=o||{};const url=apiBase()+path,tmo=o.timeout||310000; // 310 s tylko dla generowania; /api/me krócej
  const H=isNative()&&window.Capacitor.Plugins&&window.Capacitor.Plugins.CapacitorHttp;
  const send=async tok=>{const headers={Authorization:'Bearer '+tok,'Content-Type':'application/json'};
    if(!H)return http(url,{method:o.method||'GET',headers,body:o.body,timeout:tmo});
    let r;try{r=await H.request({url,method:o.method||'GET',headers,data:o.body,readTimeout:tmo});} // tylko readTimeout: connectTimeout zabiłby 2-minutowe generowanie
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
async function idbDelPrefix(pre){try{const db=await idb();await new Promise(res=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').delete(IDBKeyRange.bound(pre,pre+'\uffff'));t.oncomplete=res;t.onerror=res;});}catch(e){idbP=null;}}
async function idbGetRaw(k){try{const db=await idb();return await new Promise((res,rej)=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}catch(e){idbP=null;return undefined;}} // bez zapasu w localStorage (dane binarne)
async function idbPutRaw(k,v){try{const db=await idb();await new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error);});return true;}catch(e){idbP=null;return false;}}
async function idbDel(k){try{LS.removeItem('cf_'+k);const db=await idb();await new Promise(res=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=res;t.onerror=res;});}catch(e){idbP=null;}}
let DATA={subjects:[],topics:[]};
async function loadCache(){const d=await idbGet('data:'+UID);if(d&&Array.isArray(d.subjects)&&Array.isArray(d.topics))DATA=d;return !!(d&&d.at);}
async function saveCache(){DATA.at=Date.now();await idbPut('data:'+UID,DATA,true);}
const topicsSel=g=>'topics?select=id,subject_id,name,position,created_at,'+(g?'generation_id,':'')+'content&order=position.asc,created_at.asc';
async function fetchAll(){
  const [subjects,topics]=await Promise.all([
    rest('subjects?select=id,name,emoji,stage,accent,accent2,exam_date,exam_label,position,created_at&order=position.asc,created_at.asc'),
    rest(topicsSel(true)).catch(e=>e&&e.status===400?rest(topicsSel(false)):Promise.reject(e))]); // starsza baza bez topics.generation_id — bez źródła materiału, reszta działa
  // źródło materiału (plan-media §4.6): generacja tematu → jej pliki; błąd = bez źródła (nic nie blokuje)
  let gens=Array.isArray(DATA.gens)?DATA.gens:[],mats=Array.isArray(DATA.mats)?DATA.mats:[];
  try{const [g,m]=await Promise.all([rest('generations?select=id,material_ids&status=eq.done'),rest('materials?select=id,name,mime,created_at')]);
    if(Array.isArray(g))gens=g.map(x=>({id:String(obj(x).id||''),material_ids:arr(obj(x).material_ids).map(String)}));
    if(Array.isArray(m))mats=m.map(x=>({id:String(obj(x).id||''),name:String(obj(x).name||'').slice(0,160),mime:String(obj(x).mime||'').slice(0,120),created_at:String(obj(x).created_at||'')}));}catch(e){}
  DATA={subjects:Array.isArray(subjects)?subjects:[],topics:Array.isArray(topics)?topics:[],gens,mats,media:arr(DATA.media)};await saveCache();emit('subjects');return DATA;
}

/* ---------- sanitizer: tylko bezpieczne tagi, jedyny atrybut to class zbox/gradetbl; teksty escapowane także z cudzysłowem ---------- */
const OK_TAGS=new Set(['b','i','em','strong','u','s','br','p','ul','ol','li','div','span','h3','h4','table','thead','tbody','tr','th','td','code','sup','sub','small','mark','blockquote','hr']);
const DROP_TAGS=new Set(['script','style','iframe','object','embed','svg','math','img','video','audio','source','link','meta','base','form','input','button','textarea','select','option','template','noscript','frame','frameset','canvas','picture','track','applet']);
const VOID=new Set(['br','hr']);
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
/* emoji z treści AI (AUDYT P2-28, zasada „zero emoji w UI”): wszystko z bloku piktogramów U+1F000–1FAFF, znaki z domyślną prezentacją emoji
   i znaki z wariantem emoji (FE0F), razem z łącznikami sekwencji. Zostają zwykłe symbole tekstowe (↔, ©, ™, ▶), które w treści coś znaczą. */
const EMOJI_RE=/(?:[\u{1F000}-\u{1FAFF}]|\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)[\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]*|[\uFE0F\u20E3]/gu;
function stripEmoji(s,tidy){ // tidy: zwykły tekst (nie węzeł HTML) — bez podwójnych spacji i spacji na brzegach po usunięciu
  s=String(s);if(!EMOJI_RE.test(s))return s;EMOJI_RE.lastIndex=0;
  let t=s.replace(EMOJI_RE,'');if(tidy)t=t.replace(/[ \t]{2,}/g,' ').trim();
  return t.trim()?t:s; // napis z samych emoji zostaje (np. jedyna odpowiedź) — lepiej niż pusty element
}
function ser(node){let out='';node.childNodes.forEach(n=>{
  if(n.nodeType===3){out+=esc(stripEmoji(n.nodeValue));return;}
  if(n.nodeType!==1)return;
  const t=n.localName;if(DROP_TAGS.has(t))return;
  if(!OK_TAGS.has(t)){out+=ser(n);return;} // nieznany tag: zostaje sam tekst
  const cls=(n.getAttribute('class')||'').split(/\s+/).filter(c=>c==='zbox'||c==='gradetbl').join(' ');
  out+='<'+t+(cls?' class="'+cls+'"':'')+'>'+(VOID.has(t)?'':ser(n)+'</'+t+'>');});return out;}
const TAG_RE=new RegExp('<(?!/?(?:'+[...OK_TAGS].join('|')+')(?:\\s+class\\s*=\\s*"[^"<>]*")?\\s*/?>)','gi'); // „<” niebędące dozwolonym znacznikiem (np. x1<x2) to tekst, nie początek tagu
function clean(s){if(s==null)return '';s=stripEmoji(String(s));if(!/[<>&"']/.test(s))return s;const tp=document.createElement('template');tp.innerHTML=s.replace(TAG_RE,'&lt;');return ser(tp.content);} // pola HTML
const plain=s=>esc(s==null?'':stripEmoji(s,true)); // pola tekstowe: bez interpretacji HTML — "a<b" zostaje "a<b", a nie znacznikiem; bez emoji (nazwy z AI)
function deepEsc(v){if(typeof v==='string')return esc(stripEmoji(v,true));if(Array.isArray(v))return v.map(deepEsc);if(v&&typeof v==='object'){const o={};for(const k in v)o[k]=deepEsc(v[k]);return o;}return v;}
const noEmoji=s=>String(s).replace(/[\p{Extended_Pictographic}️‍]/gu,'').replace(/\s+/g,' ').trim();

/* ---------- mapper: przedmiot z bazy + jego tematy → przedmiot silnika ---------- */
const PALETTE=[['#B4FF3A','#7FC400','#14210A'],['#FF2E93','#B01460','#200410'],['#22D3EE','#108CA1','#04232B'],['#FFC043','#B3820E','#241800'],['#FFA023','#B36A08','#201202'],['#A855F7','#6B2AA8','#1A0A2A']];
const STAGE_TO_DB={podstawowka:'podstawowa',liceum:'liceum',studia:'studia',inne:'inne'};
const STAGE_FROM_DB={podstawowa:'podstawowka',liceum:'liceum',studia:'studia',inne:'inne'};
const hash=s=>{let h=0;for(const ch of String(s))h=(h*31+ch.charCodeAt(0))|0;return Math.abs(h);};
function paletteFor(sub){const a=String(sub.accent||'').toUpperCase();const i=PALETTE.findIndex(p=>p[0]===a);return PALETTE[i>=0?i:hash(sub.id)%PALETTE.length];}
const TASK_OK=new Set(['match','fill','order','sort','tf','timeline','finderror','thesis','chain','scenario','swipe','typeterm','chart','mathsteps']); // hotspot: obraz z AI to ryzyko XSS — zostaje w tablicy (indeksy!), ale do pominięcia
const arr=v=>Array.isArray(v)?v:[];
/* krótka nazwa przedmiotu (TopBar centrum, Dziś, „Sprawdzian z …”): do 14 znaków bez zmian; długa nazwa z 3–6 słów treści → skrót z pierwszych liter
   (spójniki małą literą, jak „Międzynarodowe stosunki gospodarcze i polityczne” → „MSGiP”, spec §3); inaczej pierwsze słowo */
const SHORT_SMALL=new Set(['i','a','w','z','o','u','na','do','od','po','we','ze','oraz','dla','of','and','in','the','for','to']);
function shortOf(name){name=String(name||'').replace(/\s+/g,' ').trim();if(name.length<=14)return name;
  const ws=name.split(' '),content=ws.filter(w=>!SHORT_SMALL.has(w.toLowerCase()));
  if(name.length>=30&&content.length>=3&&content.length<=6&&ws.every(w=>/^\p{L}/u.test(w)))return ws.map(w=>SHORT_SMALL.has(w.toLowerCase())?w[0].toLowerCase():w[0].toUpperCase()).join('');
  const w=ws[0];return w.length<=14?w:w.slice(0,13)+'…';}
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
  const raw=String(l&&l.id||('l'+(i+1))).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,40),base='t'+String(topicId).replace(/-/g,'').slice(0,8)+'_'+raw;
  let id=base,n=2;while(used.has(id))id=base+'_'+(n++);used.add(id);
  const L=obj(l);
  const feed=arr(L.feed).map(f=>{f=obj(f);const o={...deepEsc(f),body:clean(f.body),real:clean(f.real),mnemo:clean(f.mnemo)};delete o.viz;const v=mapViz(f.viz);if(v)o.viz=v;return o;}); // viz: osobny mapper (deepEsc przepuściłby liczby i nieznane pola)
  const flashcards=arr(L.flashcards).map(c=>{c=obj(c);return {...deepEsc(c),d:clean(c.d)};});
  const quiz=arr(L.quiz).map(q=>{q=deepEsc(obj(q));const a=arr(q.a).map(x=>typeof x==='string'?x:esc(x));let c=+q.c;if(!(Number.isInteger(c)&&c>=0&&c<a.length))c=0;return {...q,q:String(q.q||''),a,c,e:String(q.e||'')};});
  const own=arr(L.tasks);const src=own.some(t=>t&&TASK_OK.has(t.type))?own:gamesAsTasks(L.games);
  const tasks=src.map(t=>t&&TASK_OK.has(t.type)?deepEsc(t):{type:'_skip'});
  return {id,raw,title:esc(noEmoji(L.title||'')||('Lekcja '+(i+1))),topicId,chapter:!!first,feed,flashcards,quiz,tasks};
}
/* ---------- kluczowe punkty (plan-media §1.1–1.2): TopicContent.keyPoints → punkty silnika; stare tematy (albo złe dane) — jeden punkt na lekcję ----------
   Odnośniki {kind, level, index} sprawdzane względem zmapowanych tablic (zły poziom / indeks / duplikat wypada, pierwszy punkt wygrywa); pytania i fiszki
   bez punktu trafiają do punktu zastępczego swojej lekcji; punkt z < 3 elementami albo < 2 pytaniami i fiszkami łączy się z następnym (ostatni z poprzednim);
   mniej niż 3 punkty = cały temat zastępczo. Napisy przez plain() z limitami schematu. Id bez ':' (klucze postępów dzielą się po ':'). */
const PT_RAW=/^p\d{1,2}$/;
const ptxt=(v,n)=>typeof v==='string'?esc(cut(stripEmoji(v,true).replace(/\s+/g,' ').trim(),n)):'';
function mapPoints(content,topicId,levels,titles){
  const C=obj(content),pre='t'+String(topicId).replace(/-/g,'').slice(0,8)+'_',byRaw={};
  levels.forEach(l=>{if(!byRaw[l.raw])byRaw[l.raw]=l;});
  const lvIdx=l=>levels.indexOf(l);
  const okTask=(l,i)=>l.tasks[i]&&l.tasks[i].type!=='_skip';
  const fbOf=(l,j,pts)=>{const raw='L'+l.raw,t=String(titles[j]||'').trim()||('Lekcja '+(j+1));let p=pts.find(x=>x.raw===raw);
    if(!p){p={raw,t:ptxt(t,120),s:ptxt(t,24),sum:'',fc:[],q:[],tk:[],fb:true,lvHint:l.id};pts.push(p);}return p;};
  // lekcja bez fiszek i pytań nie daje punktu: nie ma czego „umieć” (stan na zawsze „Nowe”, Umiem X z Y nie doszłoby do Y)
  const fallback=()=>{const pts=[];levels.forEach((l,j)=>{if(!l.flashcards.length&&!l.quiz.length)return;const p=fbOf(l,j,pts);l.flashcards.forEach((_,i)=>p.fc.push([l.id,i]));l.quiz.forEach((_,i)=>p.q.push([l.id,i]));l.tasks.forEach((_,i)=>{if(okTask(l,i))p.tk.push([l.id,i]);});});return pts;};
  let pts=[];
  const kps=arr(C.keyPoints);
  if(kps.length){
    const seen=new Set();
    const vis=v=>typeof v==='string'?stripEmoji(v,true).replace(/[<>]/g,'').trim():''; // jak cleanText na serwerze: tytuł z samych emoji / znaczników = brak tytułu
    kps.forEach(kp=>{kp=obj(kp);const raw=String(kp.id||'');if(!PT_RAW.test(raw)||pts.some(p=>p.raw===raw))return;
      const t=vis(kp.title)?kp.title:vis(kp.short)?kp.short:'',sh=vis(kp.short)?kp.short:t;if(!t)return; // bez tytułu punkt wypada (jego elementy idą do punktu lekcji) — tak samo jak topicPoints() na serwerze
      const p={raw,t:ptxt(t,120),s:ptxt(sh,24),sum:ptxt(kp.summary,300),fc:[],q:[],tk:[],sk:0,fb:false};
      arr(kp.items).forEach(it=>{it=obj(it);const l=byRaw[String(it.level||'').replace(/[^A-Za-z0-9_-]/g,'_')],i=it.index;if(!l||!Number.isInteger(i)||i<0)return;
        const k=it.kind+':'+l.id+':'+i;if(seen.has(k))return;
        if(it.kind==='quiz'&&i<l.quiz.length)p.q.push([l.id,i]);else if(it.kind==='flashcard'&&i<l.flashcards.length)p.fc.push([l.id,i]);
        else if(it.kind==='task'&&i<l.tasks.length){if(okTask(l,i))p.tk.push([l.id,i]);else p.sk++;} // nieobsługiwane zadanie (_skip): nie w punkcie, ale liczy się do jego wielkości jak na serwerze
        else return;
        seen.add(k);});
      pts.push(p);});
    levels.forEach((l,j)=>{l.flashcards.forEach((_,i)=>{if(!seen.has('flashcard:'+l.id+':'+i))fbOf(l,j,pts).fc.push([l.id,i]);});l.quiz.forEach((_,i)=>{if(!seen.has('quiz:'+l.id+':'+i))fbOf(l,j,pts).q.push([l.id,i]);});});
    const weak=p=>p.fc.length+p.q.length+p.tk.length+(p.sk||0)<3||p.fc.length+p.q.length<2;
    for(let g=0;g<100&&pts.length>1;g++){const k=pts.findIndex(weak);if(k<0)break;const into=pts[k+1<pts.length?k+1:k-1];
      ['fc','q','tk'].forEach(f=>{into[f]=into[f].concat(pts[k][f]);});into.sk=(into.sk||0)+(pts[k].sk||0);pts.splice(k,1);}
    if(pts.length<3||pts.some(weak))pts=fallback();
  }else pts=fallback();
  return pts.map((p,n)=>{const order=(a,b)=>(lvIdx(levels.find(l=>l.id===a[0]))-lvIdx(levels.find(l=>l.id===b[0])))||(a[1]-b[1]);
    ['fc','q','tk'].forEach(f=>p[f].sort(order));
    const lv=[...new Set(p.fc.concat(p.q,p.tk).map(x=>x[0]))].sort((a,b)=>lvIdx(levels.find(l=>l.id===a))-lvIdx(levels.find(l=>l.id===b)));
    return {id:pre+p.raw,raw:p.raw,topicId,t:p.t,s:p.s||p.t,sum:p.sum,lv:lv.length?lv:[p.lvHint||(levels[0]&&levels[0].id)].filter(Boolean),fc:p.fc,q:p.q,tk:p.tk,fb:!!p.fb,n:n+1};});
}
/* źródło materiału: pliki generacji tematu (PDF / zdjęcia / prezentacja / tekst); nazwy przez plain() */
function sourceOf(t){
  const g=t.generation_id&&arr(DATA.gens).find(x=>x.id===t.generation_id);if(!g)return null;
  const mats=arr(g.material_ids).map(id=>arr(DATA.mats).find(m=>m.id===id)).filter(Boolean);if(!mats.length)return null;
  const kindOf=m=>/^image\//.test(m.mime)?'photos':m.mime==='application/pdf'?'pdf':m.mime===PPTX_MIME?'pptx':/^text\//.test(m.mime)?'text':'mixed';
  const ks=[...new Set(mats.map(kindOf))];
  return {kind:ks.length===1?ks[0]:'mixed',files:mats.map(m=>({name:plain(String(m.name||'').slice(0,120)),mime:String(m.mime||'').replace(/[^a-z0-9.+\/-]/gi,'').slice(0,100)})),addedAt:String(t.created_at||'').slice(0,40)};
}
function toEngine(){
  const bySub={};DATA.topics.forEach(t=>{(bySub[t.subject_id]=bySub[t.subject_id]||[]).push(t);});
  return DATA.subjects.filter(s=>(bySub[s.id]||[]).length).map(s=>{
    const tps=bySub[s.id];const c0=obj(tps[0]&&tps[0].content);const pal=paletteFor(s);const used=new Set();
    const levels=[],points=[],tmeta=[];
    tps.forEach((t,ti)=>{const raw=arr(obj(t.content).levels),mine=raw.map((l,li)=>mapLevel(l,t.id,li,ti>0&&li===0,used));mine.forEach(l=>levels.push(l));
      const pts=mine.length?mapPoints(t.content,t.id,mine,raw.map(l=>noEmoji(obj(l).title||''))):[];pts.forEach(p=>points.push(p));
      tmeta.push({id:t.id,name:plain(t.name),createdAt:t.created_at,n:ti+1,points:pts.map(p=>p.id),source:sourceOf(t)});});
    const g=obj(c0.grading);let scale=arr(g.scale).filter(x=>Array.isArray(x)&&x.length===2&&isFinite(+x[0])).map(x=>[+x[0],plain(noEmoji(x[1]))]).filter(x=>x[1]);
    let grading;if(scale.length){scale.sort((a,b)=>b[0]-a[0]);const low=scale[scale.length-1][0]; // każdy próg ze skali to ocena pozytywna — zaliczenie od najniższego
      grading={pass:Math.min(+g.pass||50,low),examMin:Math.max(1,+g.examMin||10),scale,failLabel:plain(noEmoji(g.failLabel||'')||'niezaliczone')};}
    return {id:s.id,name:plain(s.name||c0.name||'Przedmiot'),short:plain(shortOf(s.name||c0.short||c0.name)),tagline:plain(c0.tagline||''),
      accent:pal[0],accent2:pal[0],accentDark:pal[1],onAccent:pal[2],level:STAGE_FROM_DB[s.stage]||'inne',lang:tps.some(t=>obj(t.content).lang),
      grading,info:tps.map(t=>clean(obj(t.content).info||'')).join(''),levels,points,topics:tmeta};
  });
}
const pickable=()=>DATA.subjects.map(s=>{const p=paletteFor(s);return {id:s.id,name:String(s.name||''),stage:STAGE_FROM_DB[s.stage]||'inne',topics:DATA.topics.filter(t=>t.subject_id===s.id).length,accent:p[0],onAccent:p[2]};}); // surowe nazwy — UI wstawia je przez textContent
const subjectName=id=>{const s=DATA.subjects.find(x=>x.id===id);return s?String(s.name||''):'';};

/* ---------- synchronizacja postępów (app_state) ----------
   Serwer numeruje zapisy (rev, trigger). Urządzenie pamięta ostatni wspólny stan (base, localStorage) i jego rev.
   pull: nic nowego w chmurze → wysyłamy swoje; nowe w chmurze → scalenie trójstronne (base, lokalny, chmura) i od razu przeładowanie silnika.
   push: PATCH tylko gdy rev się zgadza — inaczej ktoś zapisał w międzyczasie → pull i ponowne scalenie. Bez pierwszego pull nic nie wysyłamy.
   Własny zapis, którego odpowiedź zginęła (sieć), rozpoznajemy po client_ts — nie liczymy go drugi raz.
   Gdy silnik jest w trakcie lekcji, zmiany z chmury czekają (pending) do bezpiecznego momentu. */
const PK='nauka_progress_v1:'+UID,MK='nauka_meta_v1:'+UID,DIRTYK='cf_dirty:'+UID,REVK='cf_rev:'+UID,BASEK='cf_base:'+UID,SENTK='cf_sent:'+UID;
let pulled=false,syncOff=false,pending=null,pendingUnion=false,base=null,pushT=null,pushing=null,dseq=0,storeFull=false;
let hooks={canApply:()=>true,apply:null};
function bindEngine(canApply,apply){hooks={canApply:canApply||(()=>true),apply:apply||null};}
const hasLocalState=()=>!!(LS.getItem(PK)||LS.getItem(MK));
const localState=()=>({progress:obj(jget(PK,{})),meta:obj(jget(MK,{}))});
const clone=v=>JSON.parse(JSON.stringify(v));
/* pełny localStorage (np. zalegający cache cf_data albo dane innego konta): najpierw zwalniamy cache treści (da się pobrać ponownie), potem drugi zapis.
   Nieudany zapis postępów z chmury = pulled=false i zero wysyłek — inaczej silnik ruszyłby od zera i nadpisał postępy konta na wszystkich urządzeniach. */
function freeSpace(){const ks=[];try{for(let i=0;i<LS.length;i++){const k=LS.key(i);if(k&&k.startsWith('cf_data:'))ks.push(k);}}catch(e){}ks.forEach(k=>{try{LS.removeItem(k);}catch(e){}});return ks.length>0;}
const jsetHard=(k,v)=>jset(k,v)||(freeSpace()&&jset(k,v));
function setFull(v){if(storeFull!==v){storeFull=v;emit('store',{full:v});}}
function loadBase(){if(!base){const b=jget(BASEK,null);if(b&&typeof b==='object')base={progress:obj(b.progress),meta:obj(b.meta)};}return base||{progress:{},meta:{}};}
function setBase(b){base={progress:obj(b.progress),meta:obj(b.meta)};if(jsetHard(BASEK,base))return true;try{LS.removeItem(BASEK);}catch(e){}return false;} // nieaktualna baza w pamięci telefonu byłaby gorsza niż żadna (bez bazy scalanie działa jak suma — nic nie ginie)
/* strażnik: lokalny stan „zgubił” postępy względem ostatniego wspólnego stanu (uszkodzony albo niezapisany localStorage, silnik ruszył od zera).
   Reset („Wyzeruj postępy”, „Zachowaj XP i poziomy”) zawsze PODNOSI epoch — więc wyższy lokalny epoch = zamierzony reset, a niższy (albo brak,
   gdy baza ma epoch) = zgubiony stan. Taki stan nie trafia do chmury; zamiast tego pobieramy ją i scalamy jak sumę (nowszy epoch z chmury wygrywa). */
const xpOf=p=>{let n=0;for(const k in p){const v=p[k];if(isObj(v)&&typeof v.xp==='number'&&v.xp>0)n+=v.xp;}return n;};
function lostLocal(b,l){
  const bp=obj(b.progress),lp=obj(l.progress),bm=obj(b.meta),lm=obj(l.meta);
  const be=+bp.epoch||0,le=+lp.epoch||0;
  if(le>be)return false; // reset na tym urządzeniu
  if(le<be)return true; // epoch zniknął: lokalne postępy zgubione (np. uszkodzony nauka_progress_v1 na koncie, które kiedyś zerowało postępy)
  const keys=(p,m)=>Object.keys(p).filter(k=>k!=='daily'&&k!=='epoch').concat(Object.keys(m).map(k=>'m:'+k));
  const bk=keys(bp,bm),lk=new Set(keys(lp,lm));
  const gone=bk.filter(k=>!lk.has(k)).length;
  if(bk.length>=6&&gone*2>bk.length)return true; // zniknęła większość kluczy
  const mk=Object.keys(bm),mg=mk.filter(k=>!(k in lm)).length; // sama META (seria, rekord, zamrożenia, zgoda) — przy wielu kluczach postępów jej utrata ginęła w sumie;
  if(mk.length>=4&&mg*2>mk.length)return true; // wycofanie zgody usuwa 2 klucze, więc nigdy ponad połowę z ≥ 4
  const bx=xpOf(bp);return bx>=50&&xpOf(lp)*2<bx; // albo ponad połowa XP
}
const missing=e=>e&&(e.status===404||e.code==='PGRST205'||e.code==='42P01'||e.code==='PGRST202'); // brak tabeli/funkcji — migracja 0004 jeszcze niewgrana
function markDirty(){lset(DIRTYK,Date.now()+'.'+(++dseq));}
function dirty(){if(!UID)return;markDirty();clearTimeout(pushT);pushT=setTimeout(()=>(pulled?push():pull()).catch(()=>{}),4000);} // przed pierwszym pobraniem najpierw pull (on potem wyśle)
async function push(){
  if(!UID||!pulled||syncOff||pending||!LS.getItem(DIRTYK))return;
  if(pushing)return pushing;
  if(lostLocal(loadBase(),localState())){emit('sync',{guard:true});return repairLost();}
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
  // dni aktywne każdej strony liczone z JEJ zamrożeniami: zamrożenie na jednym urządzeniu (np. tablet po nocy w tle) nie kasuje dnia, w którym
  // na drugim była nauka — inaczej seria cofała się do dnia sprzed zamrożenia i gasła na wszystkich urządzeniach
  const fr=m=>new Set(arr(m&&m.frozenDays).filter(d=>DAY.test(d)));
  const lf=fr(lm),cf=fr(cm),frozen=new Set([...lf,...cf]);
  const days=new Set([...streakDays(lm,lf),...streakDays(cm,cf)]);if(!days.size)return;
  const last=[...days].sort().pop();let n=0,d=last;
  for(let i=0;i<4000;i++){if(days.has(d))n++;else if(!frozen.has(d))break;d=dplus(d,-1);}
  const end=[last,lm&&lm.lastDay,cm&&cm.lastDay].filter(x=>DAY.test(String(x||''))).sort().pop(); // lastDay = ostatni dzień objęty serią (aktywny albo zamrożony)
  out.lastDay=end;out.streak=n;out.best=Math.max(+out.best||0,n);
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
  if(!hasLocalState()){ // świeże urządzenie: stan z chmury wprost — tylko gdy na pewno się zapisał (inaczej silnik ruszyłby od zera, a push nadpisałby konto)
    const st={progress:obj(row.progress),meta:obj(row.meta)};
    if(!jsetHard(PK,st.progress)||!jsetHard(MK,st.meta)){try{LS.removeItem(PK);LS.removeItem(MK);}catch(e){}pulled=false;setFull(true);
      throw new CloudError(0,'storage_full','Brak miejsca na postępy w pamięci aplikacji');}
    setBase(st);lset(REVK,row.rev);setFull(false);
    pulled=true;pending=null;if(apply)try{apply();}catch(e){}return true;}
  return applyRow(row,canApply,apply);
}
function applyRow(row,canApply,apply,union){ // synchronicznie: sprawdzenie, zapis i przeładowanie silnika w jednym kroku — silnik nie zdąży nadpisać scalonego stanu
  if(canApply&&!canApply()){pending=row;pendingUnion=!!union;return false;}
  const cl={progress:obj(row.progress),meta:obj(row.meta)},loc=localState();
  if(!union&&lostLocal(loadBase(),loc)){union=true;emit('sync',{guard:true});} // brak klucza lokalnie ≠ usunięcie: bez bazy (suma), żeby zgubiony stan nie skasował postępów z chmury
  const m=merge3(union?{progress:{},meta:{}}:loadBase(),loc,cl);
  if(!jsetHard(PK,m.progress)||!jsetHard(MK,m.meta)){pulled=false;setFull(true);return false;} // bez zapisu: żadnej wysyłki, aż się uda (dirty() → pull)
  lset(REVK,row.rev);setBase(cl);setFull(false);pulled=true;pending=null;pendingUnion=false;LS.removeItem(SENTK);
  if(same(m,cl))LS.removeItem(DIRTYK);else markDirty(); // przed apply(): zapisy silnika przy przeładowaniu oznaczą stan na nowo
  if(apply)try{apply();}catch(e){}
  if(LS.getItem(DIRTYK))setTimeout(()=>push().catch(()=>{}),0);
  return true;
}
async function repairLost(){ // push zatrzymany przez strażnika: pobierz chmurę i scal jak sumę (potem zwykły push scalonego stanu)
  let rows;try{rows=await rest('app_state?select=progress,meta,rev,client_ts&user_id=eq.'+UID);}
  catch(e){if(missing(e)){syncOff=true;emit('sync',{off:true});return;}throw e;}
  const row=Array.isArray(rows)&&rows[0]||null;
  if(!row){setBase(localState());return push();} // w chmurze nic nie ma — nie ma czego chronić
  applyRow(row,hooks.canApply,hooks.apply,true);
}
async function applyPending(canApply,apply){if(!pending)return false;return applyRow(pending,canApply||hooks.canApply,apply===undefined?hooks.apply:apply,pendingUnion);}
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
const capHit=(e,name)=>!!e&&String(e.code)==='23514'&&new RegExp(name).test(String(e.message||'')+' '+JSON.stringify(e.data||'')); // trigger enforce_owner_caps (backend/0008)
async function createSubject(o){const pal=PALETTE[o.color|0]||PALETTE[0];let rows;
  try{rows=await rest('subjects',{method:'POST',prefer:'return=representation',body:{owner_id:UID,name:String(o.name||'Nowy przedmiot').slice(0,60),emoji:'📘',stage:STAGE_TO_DB[o.stage]||'inne',accent:pal[0],accent2:pal[0],position:DATA.subjects.length}});}
  catch(e){if(capHit(e,'subject_limit'))throw new CloudError(e.status||400,'subject_limit','Za dużo przedmiotów na koncie',{});throw e;}
  const s=rows[0];DATA.subjects.push(s);await saveCache();return s;}
async function updateSubject(id,patch){const body={};if(patch.name!=null)body.name=String(patch.name).slice(0,60);if(patch.color!=null&&PALETTE[patch.color]){body.accent=PALETTE[patch.color][0];body.accent2=PALETTE[patch.color][0];}
  const rows=await rest('subjects?id=eq.'+id,{method:'PATCH',prefer:'return=representation',body});const s=DATA.subjects.find(x=>x.id===id);if(s&&rows&&rows[0])Object.assign(s,rows[0]);await saveCache();emit('subjects');}
function upFail(e){ // błąd wysyłki → kod dla UI; limit generacji jeszcze nietknięty
  if(e.code==='network'||e.code==='file_too_big'||e.status===401||/^(no_session|upload_failed|upload_daily_limit)$/.test(e.code))return e;
  // dzienny limit wysyłki na konto (backend/0008): Storage odmawia przez politykę RESTRICTIVE (403 „row-level security”; klient pisze zawsze do własnego folderu,
  // więc inna przyczyna nie wchodzi w grę), a wiersz materiału — triggerem 23514 materials_daily_limit
  if((e.status===400||e.status===403)&&/row-level security|row level security/i.test(String(e.message||'')+' '+JSON.stringify(e.data||''))||capHit(e,'materials_daily_limit'))
    return new CloudError(429,'upload_daily_limit','Dzienny limit wysyłania plików',{});
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
  if(o.subjectId&&!DATA.topics.some(t=>t.subject_id===o.subjectId)){try{
    const t=await rest('topics?select=id&subject_id=eq.'+o.subjectId+'&limit=1');if(Array.isArray(t)&&t.length)return; // temat jednak powstał na serwerze (zapis tuż przed przerwaniem) — kaskada skasowałaby opłacony temat
    await rest('subjects?id=eq.'+o.subjectId,{method:'DELETE'});DATA.subjects=DATA.subjects.filter(s=>s.id!==o.subjectId);await saveCache();emit('subjects');}catch(e){}} // bez odpowiedzi serwera nic nie kasujemy
}
const JOBK='cf_job:'+UID;
const job=()=>jget(JOBK,null);
async function addTopic(topicId){const rows=await rest('topics?select=id,subject_id,name,position,created_at,content&id=eq.'+topicId);const t=rows&&rows[0];if(!t)throw new CloudError(404,'not_found','Nie znaleziono lekcji');
  if(!DATA.topics.some(x=>x.id===t.id))DATA.topics.push(t);const s=DATA.subjects.find(x=>x.id===t.subject_id);
  const aiName=t.content&&t.content.name?noEmoji(t.content.name):'';
  if(s&&/^Nowy przedmiot$/.test(s.name)&&aiName){try{await updateSubject(s.id,{name:aiName});}catch(e){}} // nazwa z AI (bez emoji), gdy nie podano własnej
  await saveCache();emit('subjects');return t;}
async function generate(o){ // o={subjectId, materialIds, text, hint, stage, subjectName, consentV}; bez automatycznego ponawiania — każde wywołanie zjada limit
  meC=null; // licznik limitu zaraz się zmieni
  let prev=null,prevOk=false;try{const g=await rest('generations?select=id,created_at&subject_id=eq.'+o.subjectId+'&order=created_at.desc&limit=1');prevOk=true;if(g&&g[0])prev=g[0].created_at;}catch(e){if(e.code==='network')throw e;}
  // dziennik MUSI się zapisać przed POST: bez niego zerwane połączenie skończyłoby się discard() w trakcie generowania (opłacona próba bez przedmiotu)
  const known=DATA.topics.filter(t=>t.subject_id===o.subjectId).map(t=>t.id); // tematy sprzed tej próby (odzyskiwanie nie weźmie ich za nowy)
  if(!jsetHard(JOBK,{subjectId:o.subjectId,startedAt:Date.now(),materialIds:o.materialIds||[],prevAt:prev||null,prevOk,created:o.created||null,materials:arr(o.materials),known})) // created/materials: do posprzątania, gdy odzyskanie skończy się błędem
    throw new CloudError(0,'storage_full','Brak miejsca w pamięci aplikacji na dziennik generowania',{});
  const r=await api('/api/generate',{method:'POST',body:{subjectId:o.subjectId,materialIds:o.materialIds||[],text:o.text||undefined,
    options:{stage:STAGE_TO_DB[o.stage]||'inne',subjectName:o.subjectName==null?undefined:String(o.subjectName).slice(0,80),mode:'materials',levels:4,locale:'pl',hint:o.hint||undefined,viz:true,
      aiConsentV:+o.consentV>0?+o.consentV:undefined}}}); // viz: ta wersja rysuje wizualizacje w czacie (starsze buildy go nie wysyłają → serwer daje stary format); aiConsentV: wersja zaakceptowanej zgody (do generations.options); sieć: dziennik zostaje → recoverJob
  const d=obj(r.data),isJson=!!r.data&&typeof r.data==='object';
  if(r.status>=400||!d.topicId){
    // ≥500 bez JSON-a (HTML 504 Vercela po zabiciu funkcji, ucięta odpowiedź) albo 2xx bez tematu = wynik nieznany: serwer mógł już pobrać limit i zapisać temat.
    // Dziennik zostaje, UI uruchamia recoverJob (sprawdza tabelę generations) — nigdy discard() na ślepo.
    if(r.status<400||(r.status>=500&&!isJson))throw new CloudError(r.status,'unknown_outcome','Nie wiadomo, czy lekcja powstała',{});
    LS.removeItem(JOBK);throw new CloudError(r.status,String(d.code||(r.status>=500?'generation_failed':'bad_request')),String(d.error||''),d);}
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
    if(g&&g.status==='failed'){LS.removeItem(JOBK);emit('job',{state:'failed',error:g.error});const er=String(g.error||'');
      // backend/0009: awaria AI po naszej stronie — „released:” = serwer zwrócił limit (release_generation), „ai_unavailable:” = bez zwrotu
      if(/^released:ai_unavailable\b/.test(er))throw new CloudError(503,'ai_unavailable','',{charged:false,refunded:true});
      if(/^ai_unavailable\b/.test(er))throw new CloudError(503,'ai_unavailable','',{charged:true});
      throw new CloudError(500,'generation_failed','',/^released:/.test(er)?{charged:false,refunded:true}:{});}
    if(!g&&age>90){LS.removeItem(JOBK);emit('job',{state:'lost'});throw new CloudError(0,'not_started','Generowanie nie ruszyło',{});} // POST nie dotarł do serwera — limit bez zmian
    if(age>330){ // wiersz wisi jako running (funkcja zabita): temat mógł się jednak zapisać tuż przed przerwaniem — wtedy go bierzemy, zamiast zgłaszać porażkę
      // tylko temat TEJ generacji (topics.generation_id, ustawiane przez serwer) — nie poprzedni materiał dodany do tego samego przedmiotu chwilę wcześniej
      const skip=arr(j.known).filter(x=>/^[0-9a-f-]{36}$/i.test(String(x)));
      let t=null;try{const rows=await rest('topics?select=id&subject_id=eq.'+j.subjectId+'&generation_id=eq.'+encodeURIComponent(g.id)+(skip.length?'&id=not.in.('+skip.join(',')+')':'')+'&order=created_at.desc&limit=1');t=rows&&rows[0]||null;}
      catch(e){if(e.code==='network'&&age<900){emit('job',{state:'offline',age});await sleep(8000);continue;}}
      if(t){jset(JOBK,{...j,topicId:t.id});const tt=await addTopic(t.id);LS.removeItem(JOBK);emit('job',{state:'done',topic:tt});return tt;}
      LS.removeItem(JOBK);emit('job',{state:'lost'});throw new CloudError(504,'lost','Generowanie nie dokończyło się');}
    emit('job',{state:'running',age});await sleep(8000);
  }
}
let meC=null; // ostatnia odpowiedź /api/me (limit przed dodaniem materiału) — {at, v}
async function me(o){ // v.quota (backend/0007): {scope:'lifetime'|'month', used, limit, remaining, trialUntil}; starszy backend — bez quota
  o=o||{};if(meC&&o.maxAge!=null&&Date.now()-meC.at<o.maxAge)return meC.v;
  const r=await api('/api/me',{timeout:15000});if(r.status>=400)throw errOf(r);const d=obj(r.data),q=d.quota&&typeof d.quota==='object'?d.quota:null;let trial=null;
  if(q)trial=typeof q.trialUntil==='string'&&q.trialUntil||null; // koniec okresu startowego podaje serwer razem z limitem
  else{try{const p=await rest('profiles?select=trial_until&id=eq.'+UID);trial=p&&p[0]&&p[0].trial_until||null;}catch(e){}}
  const v={...d,trialUntil:trial,media:quotaObj(d.media),chat:quotaObj(d.chat),features:featuresOf(d.features)};meC={at:Date.now(),v};return v;}
/* plan-media §2.7: bloki media / chat / features z /api/me — tylko liczby, daty i flagi (starszy backend albo bez 0010: null i wszystko wyłączone) */
function quotaObj(q){if(!q||typeof q!=='object'||Array.isArray(q))return null;const o={};
  ['used','limit','remaining','dailyLeft'].forEach(k=>{if(typeof q[k]==='number'&&isFinite(q[k]))o[k]=q[k];});
  ['plan','scope','day'].forEach(k=>{if(typeof q[k]==='string'&&/^[a-z0-9-]{1,20}$/i.test(q[k]))o[k]=q[k];});
  if(typeof q.globalOpen==='boolean')o.globalOpen=q.globalOpen;
  const b=q.busy;if(b&&typeof b==='object'&&/^[0-9a-f-]{36}$/i.test(String(b.id||'')))o.busy={id:String(b.id),kind:b.kind==='podcast'?'podcast':'reels',topicId:/^[0-9a-f-]{36}$/i.test(String(b.topicId||''))?String(b.topicId):''};else o.busy=null;
  return o;}
function featuresOf(f){f=obj(f);return {reels:f.reels===true,podcast:f.podcast===true,fox:f.fox===true};}
const meCached=maxAge=>meC&&(maxAge==null||Date.now()-meC.at<maxAge)?meC.v:null;

/* ---------- media: rolki i podcast (plan-media §2.2–2.5, §4.6) ----------
   Wiersze `media` czytane przez PostgREST (RLS: właściciel), pliki z prywatnego bucketu `media` (Bearer) jako Blob, z pamięcią podręczną w IndexedDB (LRU ≤ 150 MB).
   Tworzenie: dziennik cf_media_job:<uid> zapisany PRZED POST (requestId = klucz idempotencji = media.id); nigdy automatycznego ponawiania POST.
   Każdy napis z wiersza i manifestu → plain(); nieznane klucze wypadają; nazwy plików /^[a-z0-9.]+$/, odnośniki {level, index} sprawdzone. */
const MEDIA_SEL='id,owner_id,subject_id,topic_id,kind,status,phase,progress,title,spec,manifest,error,charged,created_at,finished_at';
const MJOBK='cf_media_job:'+UID;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,FILE_RE=/^[a-z0-9.]{1,40}$/,REF_LV=/^[A-Za-z0-9_-]{1,40}$/,PID_RE=/^(p\d{1,2}|L[A-Za-z0-9_-]{1,40})$/;
const REEL_TYPES=new Set(['czym','kto','mit','porownanie','pulapki','sprawdzian']);
const THUMBS=new Set(['#2F6BFF','#1F8A5B','#E9A23B','#E0483F']);
const mstr=(v,n)=>typeof v==='string'?esc(cut(stripEmoji(v,true).replace(/\s+/g,' ').trim(),n)):'';
const mnum=(v,lo,hi)=>typeof v==='number'&&isFinite(v)?Math.max(lo,Math.min(hi,v)):null;
const mint=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi?v:null;
const mref=r=>{r=obj(r);const l=String(r.level==null?'':r.level),i=r.index;return REF_LV.test(l)&&Number.isInteger(i)&&i>=0&&i<=59?{level:l,index:i}:null;};
const mfile=f=>typeof f==='string'&&FILE_RE.test(f)&&!/\.\./.test(f)?f:null;
const mpids=a=>arr(a).filter(x=>typeof x==='string'&&PID_RE.test(x)).slice(0,30);
const muuid=v=>UUID_RE.test(String(v||''))?String(v):'';
function cleanReels(m){m=obj(m);const cv=obj(m.coverage);
  const reels=arr(m.reels).slice(0,6).map(r=>{r=obj(r);const n=mint(r.n,1,20);if(n==null)return null;const fs=obj(r.files);
    return {n,type:REEL_TYPES.has(r.type)?r.type:'czym',title:mstr(r.title,80),durSec:mnum(r.durSec,0,600)||0,pointIds:mpids(r.pointIds),quizRef:mref(r.quizRef),feedRef:r.feedRef?mref(r.feedRef):null,
      files:{storyboard:mfile(fs.storyboard),audio:mfile(fs.audio),words:mfile(fs.words)},rate:mnum(r.rate,.5,2)||1,thumb:THUMBS.has(String(r.thumb||'').toUpperCase())?String(r.thumb).toUpperCase():'#2F6BFF'};}).filter(Boolean);
  return {v:1,kind:'reels',title:mstr(m.title,120),topicId:muuid(m.topicId),coverage:{points:mint(cv.points,0,99)||0,covered:mint(cv.covered,0,99)||0},reels};}
function cleanChapter(c){c=obj(c);const n=mint(c.n,1,20);if(n==null)return null;const f=c.files&&typeof c.files==='object'?{audio:mfile(c.files.audio),timing:mfile(c.files.timing)}:null;
  return {n,title:mstr(c.title,120),pointIds:mpids(c.pointIds),levelIds:arr(c.levelIds).filter(x=>typeof x==='string'&&REF_LV.test(x)).slice(0,30),estSec:mnum(c.estSec,0,7200)||0,durSec:mnum(c.durSec,0,7200),
    status:['script','synth','ready'].indexOf(c.status)>=0?c.status:'script',
    pauses:arr(c.pauses).slice(0,8).map(p=>{p=obj(p);const q=mref(p.quizRef),a=mint(p.afterLine,0,400);return q&&a!=null?{afterLine:a,quizRef:q,pointId:typeof p.pointId==='string'&&PID_RE.test(p.pointId)?p.pointId:null,lead:mstr(p.lead,200)}:null;}).filter(Boolean),
    files:f&&(f.audio||f.timing)?f:null};}
function cleanPodcast(m){m=obj(m);const fs=obj(m.files);
  return {v:1,kind:'podcast',title:mstr(m.title,120),topicId:muuid(m.topicId),estSec:mnum(m.estSec,0,7200)||0,files:{script:mfile(fs.script)},chapters:arr(m.chapters).slice(0,12).map(cleanChapter).filter(Boolean)};}
function cleanMediaRow(r){r=obj(r);if(!UUID_RE.test(String(r.id||''))||(r.kind!=='reels'&&r.kind!=='podcast'))return null;
  const pg=obj(r.progress),sp=obj(r.spec);
  return {id:String(r.id),owner_id:muuid(r.owner_id),subject_id:muuid(r.subject_id),topic_id:muuid(r.topic_id),kind:r.kind,status:['running','ready','failed'].indexOf(r.status)>=0?r.status:'failed',
    phase:mstr(r.phase,20),progress:{step:['plan','script','voice','save'].indexOf(pg.step)>=0?pg.step:'plan',done:mint(pg.done,0,99)||0,total:mint(pg.total,0,99)||0},
    title:mstr(r.title,120),spec:{types:arr(sp.types).filter(x=>REEL_TYPES.has(x)).slice(0,6),focusPointId:typeof sp.focusPointId==='string'&&PID_RE.test(sp.focusPointId)?sp.focusPointId:null},
    manifest:r.manifest&&typeof r.manifest==='object'&&!Array.isArray(r.manifest)?(r.kind==='reels'?cleanReels(r.manifest):cleanPodcast(r.manifest)):null,
    error:mstr(r.error,240),charged:r.charged!==false,created_at:String(r.created_at||'').slice(0,40),finished_at:r.finished_at?String(r.finished_at).slice(0,40):null};}
let MROWS=null; // oczyszczone wiersze (z surowych DATA.media — surowe zostają w pamięci podręcznej, żeby nie escapować dwa razy)
const mediaCached=()=>{if(!MROWS)MROWS=arr(DATA.media).map(cleanMediaRow).filter(Boolean);return MROWS.slice();};
function upsertRaw(raw){const row=cleanMediaRow(raw);if(!row)return null;if(!Array.isArray(DATA.media))DATA.media=[];
  const i=DATA.media.findIndex(x=>x&&x.id===row.id);if(i>=0)DATA.media[i]=raw;else DATA.media.push(raw);
  mediaCached();const k=MROWS.findIndex(x=>x.id===row.id);if(k>=0)MROWS[k]=row;else MROWS.push(row);return row;}
async function mediaList(){
  let rows;try{rows=await rest('media?select='+MEDIA_SEL+'&order=created_at.asc');}catch(e){if(missing(e)){DATA.media=[];MROWS=[];return [];}throw e;} // bez migracji 0010: brak mediów
  DATA.media=arr(rows).filter(r=>r&&typeof r==='object');MROWS=null;saveCache().catch(()=>{});emit('media',null);return mediaCached();
}
async function mediaGet(id){if(!UUID_RE.test(String(id||'')))return null;
  const rows=await rest('media?select='+MEDIA_SEL+'&id=eq.'+id);const raw=arr(rows)[0];return raw?upsertRaw(raw):null;}
const mediaJob=()=>{const j=jget(MJOBK,null);return j&&UUID_RE.test(String(j.id||''))?{id:j.id,kind:j.kind==='podcast'?'podcast':'reels',topicId:muuid(j.topicId),at:+j.at||0}:null;};
async function mediaCreate(kind,body){
  if(kind!=='reels'&&kind!=='podcast')throw new CloudError(400,'bad_request','');
  const b=obj(body),requestId=uuid();
  if(!jsetHard(MJOBK,{id:requestId,kind,topicId:muuid(b.topicId),at:Date.now()}))throw new CloudError(0,'storage_full','Brak miejsca w pamięci aplikacji',{}); // dziennik przed POST
  meC=null; // licznik tworzeń zaraz się zmieni
  let r;
  try{r=await api('/api/media/'+kind,{method:'POST',body:{...b,requestId},timeout:30000});}
  catch(e){if(e&&(e.status===401||e.code==='no_session')){LS.removeItem(MJOBK);throw e;} // bez sesji żądanie nie wyszło
    mediaWatch();throw new CloudError(0,'unknown_outcome','Nie wiadomo, czy przygotowanie ruszyło',{requestId});}
  const d=r.data,isJson=!!d&&typeof d==='object'&&!Array.isArray(d);
  if((r.status===202||r.status===200)&&isJson&&d.media){const row=upsertRaw(d.media);LS.removeItem(MJOBK);saveCache().catch(()=>{});if(row)emit('media',row);mediaWatch();return {media:row};}
  if(r.status>=400&&isJson&&d.code){LS.removeItem(MJOBK);throw new CloudError(r.status,String(d.code),String(d.error||''),d);}
  mediaWatch();throw new CloudError(r.status,'unknown_outcome','Nie wiadomo, czy przygotowanie ruszyło',{requestId}); // HTML 504, ucięta odpowiedź — wynik sprawdza odpytywanie
}
function patchChapter(id,ch){const raw=arr(DATA.media).find(x=>x&&x.id===id);if(!raw||!raw.manifest||!Array.isArray(raw.manifest.chapters))return;
  const i=raw.manifest.chapters.findIndex(c=>c&&c.n===ch.n);if(i<0)return;raw.manifest.chapters[i]={...raw.manifest.chapters[i],...ch};const row=upsertRaw(raw);saveCache().catch(()=>{});if(row)emit('media',row);}
async function mediaChapter(mediaId,n){ // rozdział podcastu: synteza na żądanie (nie zużywa tworzenia); 409 chapter_busy → czekam na wiersz co 3 s do 120 s
  if(!UUID_RE.test(String(mediaId||''))||!Number.isInteger(n))throw new CloudError(400,'bad_request','');
  const r=await api('/api/media/podcast/chapter',{method:'POST',body:{mediaId,chapter:n},timeout:130000});
  const d=obj(r.data);
  if(r.status===200&&d.chapter&&typeof d.chapter==='object'){const ch=cleanChapter(d.chapter);if(ch)patchChapter(mediaId,d.chapter);return {chapter:ch};}
  if(r.status===409&&d.code==='chapter_busy'){const t0=Date.now();
    while(Date.now()-t0<120000){await sleep(3000);const row=await mediaGet(mediaId).catch(()=>null);const c=row&&row.manifest&&row.manifest.chapters.find(x=>x.n===n);
      if(c&&c.status==='ready'){emit('media',row);return {chapter:c};}}
    throw new CloudError(409,'chapter_busy','',d);}
  throw new CloudError(r.status,String(d.code||(r.status>=500?'synth_failed':'bad_request')),String(d.error||''),d);
}
/* pliki: Blob z bucketu media (Bearer, 401/wygasły token → odświeżenie raz); pamięć podręczna IndexedDB 'm:<uid>:<id>/<plik>' + indeks LRU 'mi:<uid>' */
const MEDIA_CACHE_MAX=150*1048576;
/* indeks LRU zmieniany po kolei (jedna kolejka obietnic): rolka wczytuje storyboard, słowa i dźwięk naraz — równoległe odczyt-zmiana-zapis gubiłyby wpisy,
   a zgubiony wpis nigdy nie liczyłby się do limitu 150 MB */
let lruQ=Promise.resolve();
function lruTouch(key,size){const run=()=>lruTouch1(key,size);const p=lruQ.then(run,run);lruQ=p.catch(()=>{});return p;}
async function lruTouch1(key,size){const k='mi:'+UID;let ix=await idbGetRaw(k);if(!ix||typeof ix!=='object'||!ix.e)ix={e:{}};
  if(size!=null)ix.e[key]=[size,Date.now()];else if(ix.e[key])ix.e[key][1]=Date.now();else return;
  let total=Object.values(ix.e).reduce((a,x)=>a+(+x[0]||0),0);
  const old=Object.keys(ix.e).sort((a,b)=>ix.e[a][1]-ix.e[b][1]);
  for(const o of old){if(total<=MEDIA_CACHE_MAX)break;if(o===key)continue;total-=+ix.e[o][0]||0;delete ix.e[o];await idbDel(o);}
  await idbPutRaw(k,ix);}
async function mediaBlob(owner,id,file){
  if(!UUID_RE.test(String(owner||''))||!UUID_RE.test(String(id||''))||!mfile(file))throw new CloudError(400,'bad_request','Zły adres pliku');
  const key='m:'+UID+':'+id+'/'+file,type=/\.mp3$/.test(file)?'audio/mpeg':'application/json';
  const hit=await idbGetRaw(key);if(hit&&hit.buf){lruTouch(key).catch(()=>{});return new Blob([hit.buf],{type:hit.type||type});}
  const url=CFG.supabaseUrl+'/storage/v1/object/authenticated/media/'+owner+'/'+id+'/'+file;
  const get=async tok=>{const ac=typeof AbortController==='function'?new AbortController():null,tm=ac&&setTimeout(()=>ac.abort(),90000);
    try{return await fetch(url,{headers:{apikey:CFG.anonKey,Authorization:'Bearer '+tok},signal:ac?ac.signal:undefined});}catch(e){throw new CloudError(0,'network','Brak połączenia z internetem');}finally{if(tm)clearTimeout(tm);}};
  let res=await get(await token());
  if(!res.ok){let t='';try{t=await res.text();}catch(e){}
    if(res.status===401||((res.status===400||res.status===403)&&/jwt|exp|token/i.test(t))){res=await get(await refresh(true));if(!res.ok)try{t=await res.text();}catch(e){}}
    if(!res.ok)throw new CloudError(res.status,res.status===404||res.status===400?'not_found':'storage_failed','Nie udało się pobrać pliku',{});}
  const buf=await res.arrayBuffer();
  if(await idbPutRaw(key,{buf,type,size:buf.byteLength,at:Date.now()}))lruTouch(key,buf.byteLength).catch(()=>{});
  return new Blob([buf],{type});
}
async function mediaJson(owner,id,file){const b=await mediaBlob(owner,id,file);const t=typeof b.text==='function'?await b.text():await new Response(b).text();
  try{return JSON.parse(t);}catch(e){throw new CloudError(0,'bad_file','Uszkodzony plik',{});}}
/* odpytywanie wierszy w toku (i dziennika z niepewnym wynikiem): co 4 s przy widocznej apce, co 15 s w tle, wiersz najwyżej 9 min (serwer zamyka go po 8) */
let mwT=null;const mwSeen={};
function mediaWatch(){
  clearTimeout(mwT);mwT=null;if(!UID)return;
  const job=mediaJob(),now=Date.now();
  const run=mediaCached().filter(r=>r.status==='running');run.forEach(r=>{if(!mwSeen[r.id])mwSeen[r.id]=now;});
  if(!job&&!run.some(r=>now-mwSeen[r.id]<540000))return;
  mwT=setTimeout(mediaPoll,document.visibilityState==='hidden'?15000:4000);
}
async function mediaPoll(){
  mwT=null;
  try{
    const job=mediaJob(),now=Date.now();
    const ids=mediaCached().filter(r=>r.status==='running'&&now-(mwSeen[r.id]||now)<540000).map(r=>r.id);
    if(job&&ids.indexOf(job.id)<0)ids.push(job.id);
    if(ids.length){
      const rows=arr(await rest('media?select='+MEDIA_SEL+'&id=in.('+ids.join(',')+')'));
      rows.forEach(raw=>{const before=mediaCached().find(x=>x.id===raw.id),row=upsertRaw(raw);if(!row)return;
        const fromJob=job&&row.id===job.id;if(fromJob)LS.removeItem(MJOBK);
        if(!before||before.status!==row.status||before.phase!==row.phase||JSON.stringify(before.progress)!==JSON.stringify(row.progress))emit('media',row);
        if(row.status==='ready'&&((before&&before.status==='running')||(!before&&fromJob)))emit('mediaReady',row);
        if(row.status==='failed'&&((before&&before.status==='running')||(!before&&fromJob)))emit('mediaFailed',row);});
      if(job&&!rows.some(x=>x&&x.id===job.id)&&now-job.at>120000){LS.removeItem(MJOBK);emit('mediaLost',job);} // POST nie dotarł: nic nie ruszyło, tworzenie nietknięte
      saveCache().catch(()=>{});
    }
  }catch(e){}
  mediaWatch();
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&mwT){clearTimeout(mwT);mwT=null;mediaPoll();}});
/* rozmowa z lisem: POST /api/fox (60 s), bez ponawiania; napisy w odpowiedzi NIE są escapowane — media.js escapuje przy wstawianiu */
async function fox(body){
  const r=await api('/api/fox',{method:'POST',body:obj(body),timeout:60000});
  const d=r.data;
  if(r.status===200&&d&&typeof d==='object'&&!Array.isArray(d)){if(d.quota&&meC&&meC.v)meC.v={...meC.v,chat:quotaObj(d.quota)};return d;}
  const o=obj(d);throw new CloudError(r.status,String(o.code||(r.status>=500?'fox_failed':'bad_request')),String(o.error||''),o);
}
/* pliki rolek i podcastu z bucketu media (przed usunięciem wierszy — kaskada w bazie nie rusza Storage); lista folderu, a bez niej nazwy z manifestu */
function manifestFiles(r){const m=r.manifest,out=[];if(!m)return out;
  if(r.kind==='reels')m.reels.forEach(x=>['storyboard','audio','words'].forEach(k=>{if(x.files[k])out.push(x.files[k]);}));
  else{if(m.files.script)out.push(m.files.script);m.chapters.forEach(c=>{out.push('c'+c.n+'.mp3','c'+c.n+'.json');});}
  return out;}
/* pliki mediów wybranych wierszy: najpierw sama lista (nic nie kasuje), potem — PO usunięciu wierszy w bazie — mediaDropFiles. Odwrotna kolejność
   przy zerwanym DELETE zostawiała wiersze „gotowe” bez plików (rolka się nie wczytuje, rozdział 404 na zawsze). */
async function mediaFilesWhere(pred){
  const rows=(await mediaList()).filter(pred);const paths=[];
  for(const r of rows){if(!r.owner_id)continue;const pre=r.owner_id+'/'+r.id;let files=[];
    try{files=await storageListAll(pre,'media');}catch(e){files=manifestFiles(r).map(f=>pre+'/'+f);}
    if(!files.length)files=manifestFiles(r).map(f=>pre+'/'+f);files.forEach(f=>paths.push(f));}
  return {ids:rows.map(r=>r.id),paths};
}
async function mediaDropFiles(plan){ // najlepiej jak się da: błąd niczego nie blokuje (pliki bez wiersza i tak znikną z kontem — deleteAccount)
  for(const id of plan.ids)await idbDelPrefix('m:'+UID+':'+id+'/');
  if(plan.paths.length)try{await storageRemove(plan.paths,'media');}catch(e){}
}
/* wszystkie pliki konta w buckecie media ({uid}/{mediaId}/{plik}) — także bez wiersza w bazie (przerwane sprzątanie): katalogi mają id null */
async function mediaFilesAll(){const out=[];
  for(let off=0;off<10000;off+=100){const page=await storage('object/list/media',{method:'POST',headers:{'Content-Type':'application/json'},body:{prefix:UID,limit:100,offset:off}});
    if(!Array.isArray(page)||!page.length)break;
    for(const f of page){if(!f||!f.name)continue;if(f.id!==null&&f.id!==undefined)out.push(UID+'/'+f.name);else if(UUID_RE.test(f.name))(await storageListAll(UID+'/'+f.name,'media')).forEach(x=>out.push(x));}
    if(page.length<100)break;}
  return out;}
/* pliki materiałów generacji tematów (sprzątanie po usunięciu przedmiotu / materiału; błąd niczego nie blokuje) */
async function materialsOfTopics(tps){const gids=tps.map(t=>t.generation_id).filter(x=>UUID_RE.test(String(x||'')));if(!gids.length)return [];
  try{const g=arr(await rest('generations?select=material_ids&id=in.('+gids.join(',')+')'));const ids=[...new Set(g.flatMap(x=>arr(obj(x).material_ids)).filter(x=>UUID_RE.test(String(x))))];if(!ids.length)return [];
    return arr(await rest('materials?select=id,storage_path&id=in.('+ids.join(',')+')')).map(m=>({id:m.id,path:m.storage_path})).filter(m=>m.id&&m.path);}catch(e){return [];}}
async function dropMaterials(ms){if(!ms.length)return;try{await rest('materials?id=in.('+ms.map(m=>m.id).join(',')+')',{method:'DELETE'});}catch(e){}try{await storageRemove(ms.map(m=>m.path));}catch(e){}}
async function deleteSubject(id){
  if(!UUID_RE.test(String(id||'')))throw new CloudError(400,'bad_request','');
  const tps=DATA.topics.filter(t=>t.subject_id===id),ms=await materialsOfTopics(tps);
  const mf=await mediaFilesWhere(r=>r.subject_id===id); // lista plików przed usunięciem (bez sieci: błąd tu, nic nie skasowane)
  await rest('subjects?id=eq.'+id,{method:'DELETE'}); // tematy i media znikają kaskadą (RLS: tylko własne)
  DATA.subjects=DATA.subjects.filter(s=>s.id!==id);DATA.topics=DATA.topics.filter(t=>t.subject_id!==id);DATA.media=arr(DATA.media).filter(r=>r&&r.subject_id!==id);MROWS=null;
  await saveCache();emit('subjects');emit('media',null);
  mediaDropFiles(mf);dropMaterials(ms);
}
async function renameTopic(id,name){
  const nm=String(name||'').replace(/\s+/g,' ').trim().slice(0,120);if(!UUID_RE.test(String(id||''))||!nm)throw new CloudError(400,'bad_request','');
  const rows=await rest('topics?id=eq.'+id,{method:'PATCH',prefer:'return=representation',body:{name:nm}});
  const t=DATA.topics.find(x=>x.id===id);if(t)t.name=rows&&rows[0]&&rows[0].name||nm;await saveCache();emit('subjects');
}
async function deleteTopic(id){
  if(!UUID_RE.test(String(id||'')))throw new CloudError(400,'bad_request','');
  const t=DATA.topics.find(x=>x.id===id);const sid=t&&t.subject_id;const ms=t?await materialsOfTopics([t]):[];
  if(sid&&!DATA.topics.some(x=>x.subject_id===sid&&x.id!==id))return deleteSubject(sid); // ostatni materiał = cały przedmiot
  const mf=await mediaFilesWhere(r=>r.topic_id===id);
  await rest('topics?id=eq.'+id,{method:'DELETE'});
  DATA.topics=DATA.topics.filter(x=>x.id!==id);DATA.media=arr(DATA.media).filter(r=>r&&r.topic_id!==id);MROWS=null;
  await saveCache();emit('subjects');emit('media',null);
  mediaDropFiles(mf);dropMaterials(ms);
}

/* ---------- usunięcie konta: sprawdzenie na serwerze → pliki → RPC (kaskada w bazie) → dane lokalne ---------- */
async function deleteAccount(){
  await rest('rpc/delete_my_account',{method:'POST',body:{p_dry_run:true}}); // odmowa serwera (AUDYT P1-25) albo brak funkcji → nic jeszcze nie skasowaliśmy
  const files=await storageListAll(UID);if(files.length)await storageRemove(files);
  // pliki rolek i podcastu (bucket media; delete_my_account z 0010 odmawia, gdy zostały): z wierszy media i wszystko pod {uid}/ (także osierocone)
  const mf=await mediaFilesWhere(()=>true);let more=[];try{more=await mediaFilesAll();}catch(e){}
  const all=[...new Set(mf.paths.concat(more))];if(all.length)await storageRemove(all,'media');
  await rest('rpc/delete_my_account',{method:'POST',body:{p_dry_run:false}});
  clearTimeout(pushT);syncOff=true;await wipeLocal(UID);try{LS.removeItem(SEENK);}catch(e){}
}

/* linki prawne i kontakt z cloud-config.js: tylko https:// i poprawny adres e-mail; puste = wiersze ukryte */
const httpsUrl=u=>{try{const x=new URL(String(u||''));return x.protocol==='https:'?x.href:'';}catch(e){return '';}};
const LINKS=Object.freeze({privacy:httpsUrl(CFG.privacyUrl),terms:httpsUrl(CFG.termsUrl),
  email:/^[^\s@<>"'?&#%/\\]+@[^\s@<>"'?&#%/\\]+\.[a-z]{2,}$/i.test(String(CFG.supportEmail||''))?String(CFG.supportEmail):''});

window.NAUKA_CLOUD={CloudError,on,uid:UID,email:()=>session&&session.user.email||'',signedIn:()=>!!session,knownDevice,links:LINKS,storageVolatile:()=>LS.volatile===true,
  signUp,signIn,signOut,token,loadCache,fetchAll,toEngine,pickable,subjectName,clean,plain,esc,
  dirty,flush,pull,bindEngine,hasLocalState,hasPending:()=>!!pending,applyPending,syncAvailable:()=>!syncOff,storeFull:()=>storeFull,
  prepareFiles,createSubject,updateSubject,uploadMaterial,discard,generate,job,recoverJob,me,meCached,deleteAccount,PALETTE,OK_MIME,PPTX_MIME,mimeOf,vizText,
  api,mediaList,mediaGet,mediaCreate,mediaChapter,mediaBlob,mediaJson,mediaWatch,mediaCached,mediaJob,fox,deleteSubject,renameTopic,deleteTopic, // plan-media §4.6
  _merge3:merge3,_mapViz:mapViz,_lostLocal:lostLocal,_stripEmoji:stripEmoji,_upFail:upFail};
})();
