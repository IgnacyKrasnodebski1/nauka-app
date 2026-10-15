#!/usr/bin/env node
/* Kontrola P1-6: świeże urządzenie z pełną pamięcią i uszkodzony lokalny stan nie mogą wyzerować postępów konta w chmurze.
   1) strażnik lostLocal (jednostkowo), 2) pełny localStorage, ale cache cf_data do zwolnienia → start normalny,
   3) brak miejsca nawet po zwolnieniu → blokada, zero zapisów app_state, 4) uszkodzony nauka_progress_v1 → zamiast pusha scalenie „sumą”.
   Użycie (z test/): node dev/checks/cloud-sync.mjs [--out KATALOG] */
import {start,page,close,check,section,done,shot,waitFor,has,text,view,sleep} from './cloud-lib.mjs';

const UID='0c0ffee0-0000-4000-8000-000000000001',PK='nauka_progress_v1:'+UID;
const QUOTA=quota=>`(()=>{const Q=${quota};const set=Storage.prototype.setItem; // atrapa limitu localStorage (bez kluczy atrapy backendu mockbe:*)
  Storage.prototype.setItem=function(k,v){if(this===window.localStorage&&!String(k).startsWith('mockbe:')){let n=0;for(let i=0;i<this.length;i++){const x=this.key(i);if(x&&!x.startsWith('mockbe:')&&x!==k)n+=x.length+(this.getItem(x)||'').length;}
    if(n+String(k).length+String(v).length>Q)throw new DOMException('atrapa: pełna pamięć','QuotaExceededError');}return set.call(this,k,v);};})();`;
const cloudRow=r=>r.pg.evaluate(()=>{const row=window.MOCK.db().t.app_state[0];return row?{rev:row.rev,xp:Object.values(row.progress||{}).reduce((a,v)=>a+(v&&typeof v==='object'&&typeof v.xp==='number'?v.xp:0),0),keys:Object.keys(row.progress||{}).length,streak:(row.meta||{}).streak}:null;});
const appStateWrites=async r=>(await r.pg.evaluate(()=>window.MOCK.log.filter(e=>/app_state/.test(e.path)&&e.method!=='GET').length));

await start();

section('strażnik lostLocal');
{const r=await page('mock=seeded&reset=1',{settle:2500});
  const u=await r.pg.evaluate(()=>{const L=window.NAUKA_CLOUD._lostLocal;
    const base={progress:{a:{xp:400},b:{xp:300},gems:5,srs:{},album:{},history:{},daily:{}},meta:{level:'studia',streak:3}};
    return {empty:L(base,{progress:{daily:{}},meta:{}}),reset:L(base,{progress:{epoch:5,daily:{}},meta:{}}),same:L(base,base),
      xpDrop:L(base,{progress:{a:{xp:10},b:{xp:20},gems:5,srs:{},album:{},history:{}},meta:{level:'studia',streak:3}}),
      small:L({progress:{a:{xp:10}},meta:{}},{progress:{},meta:{}}),grow:L(base,{progress:{...base.progress,c:{xp:1}},meta:base.meta})};});
  check(u.empty===true,'pusty lokalny stan przy tym samym epoch → strażnik');
  check(u.reset===false,'reset (inny epoch) → bez strażnika');
  check(u.same===false&&u.grow===false,'zwykły stan → bez strażnika');
  check(u.xpDrop===true,'XP spadło o ponad połowę → strażnik');
  check(u.small===false,'mały stan bazowy (nowe konto) → bez strażnika');
  // przegląd Build 7: epoch zgubiony lokalnie (konto po „Wyzeruj postępy”) i utrata samej META
  const v=await r.pg.evaluate(()=>{const L=window.NAUKA_CLOUD._lostLocal;
    const meta={level:'studia',streak:6,best:12,freezes:2,lastDay:'2026-10-12',aiConsent:'2026-10-01',aiConsentV:1,goal:'sesja'};
    const base={progress:{epoch:1700000000000,a:{xp:400},b:{xp:300},gems:5,srs:{},album:{},history:{},daily:{}},meta};
    const {aiConsent,aiConsentV,...noConsent}=meta;
    return {epochLost:L(base,{progress:{daily:{}},meta}),epochNewer:L(base,{progress:{epoch:1800000000000,daily:{}},meta}),
      metaLost:L(base,{progress:base.progress,meta:{level:'studia'}}),consentOff:L(base,{progress:base.progress,meta:noConsent})};});
  check(v.epochLost===true,'epoch zgubiony lokalnie (był w bazie) → strażnik',JSON.stringify(v));
  check(v.epochNewer===false,'nowszy epoch lokalnie (reset na tym urządzeniu) → bez strażnika');
  check(v.metaLost===true,'zniknęła większość kluczy META przy pełnych postępach → strażnik');
  check(v.consentOff===false,'wycofanie zgody na AI (2 klucze META) → bez strażnika');
  // scalanie serii: zamrożony dzień jednego urządzenia nie kasuje dnia nauki na drugim
  const m=await r.pg.evaluate(()=>{const M=window.NAUKA_CLOUD._merge3;
    const b={progress:{},meta:{lastDay:'2026-10-12',streak:5,best:5,freezes:1}};
    const tablet={progress:{},meta:{lastDay:'2026-10-13',streak:5,best:5,freezes:0,frozenDays:['2026-10-13']}}; // zamrożenie po nocy w tle
    const phone={progress:{},meta:{lastDay:'2026-10-13',streak:6,best:6,freezes:1}}; // nauka 10-13
    return M(b,tablet,phone).meta;});
  check(m.lastDay==='2026-10-13'&&m.streak===6,'seria po scaleniu: dzień nauki 10-13 liczy się mimo zamrożenia na drugim urządzeniu',JSON.stringify(m));
  await close(r);}

section('przegląd Build 7: uszkodzone postępy na koncie z epoch → chmura nietknięta');
{const r=await page('mock=seeded&reset=1',{settle:3000});
  await r.pg.evaluate((k,uid)=>{const p=JSON.parse(localStorage.getItem(k));p.epoch=1700000000000;localStorage.setItem(k,JSON.stringify(p));localStorage.setItem('cf_dirty:'+uid,'1');},PK,UID);
  await r.pg.reload({waitUntil:'load'});await sleep(3000);
  await r.pg.evaluate(()=>window.NAUKA_CLOUD.flush());await sleep(1500);
  const b1=await cloudRow(r);
  await r.pg.evaluate(k=>localStorage.setItem(k,'{uszkodzony'),PK);
  await r.pg.reload({waitUntil:'load'});
  for(let i=0;i<20;i++){await sleep(500);const a=await cloudRow(r);if(a&&a.rev!==b1.rev)break;}
  await sleep(2500);const after=await cloudRow(r);
  check(after.xp>=b1.xp&&after.keys>=b1.keys,'XP i klucze w chmurze nie spadły (epoch z chmury wygrywa)',JSON.stringify({b1,after}));
  await close(r);}

section('przegląd Build 7: uszkodzona sama META → seria w chmurze zostaje');
{const r=await page('mock=seeded&reset=1',{settle:3000});
  const MK='nauka_meta_v1:'+UID;
  const b=await r.pg.evaluate(()=>window.MOCK.db().t.app_state[0].meta);
  await r.pg.evaluate(k=>localStorage.setItem(k,'{uszkodzony'),MK);
  await r.pg.reload({waitUntil:'load'});await sleep(2500);
  await r.pg.evaluate(()=>{const M=window.NaukaEngine.meta();M.level='studia';window.NaukaEngine.saveMeta();}); // jak ponowny wybór etapu
  await sleep(6000);
  const a=await r.pg.evaluate(()=>window.MOCK.db().t.app_state[0].meta);
  check(a.streak===b.streak&&a.best===b.best&&Object.keys(a).length>=Object.keys(b).length,'META w chmurze bez strat',JSON.stringify({before:Object.keys(b).length,after:Object.keys(a)}));
  await close(r);}

section('przegląd Build 7: powrót z tła następnego dnia — najpierw chmura, potem zamrożenie');
{const r=await page('mock=seeded&reset=1&clock=2026-10-12',{settle:3000});
  await r.pg.evaluate(()=>{const M=NaukaEngine.meta();M.lastDay='2026-10-12';M.streak=5;M.best=Math.max(M.best||0,5);M.freezes=1;delete M.frozenDays;NaukaEngine.saveMeta();});
  await r.pg.evaluate(()=>NAUKA_CLOUD.flush());await sleep(1500);
  await r.pg.evaluate(()=>{const row=MOCK.db().t.app_state[0];row.meta={...row.meta,lastDay:'2026-10-13',streak:6,best:Math.max(row.meta.best||0,6)};row.rev++;row.client_ts=Date.now()*1000+7;MOCK.save();}); // telefon uczył się 10-13
  await r.pg.evaluate(()=>{const RD=Date;const off=2*86400000;class D extends RD{constructor(...a){if(a.length)super(...a);else super(RD.now()+off);}static now(){return RD.now()+off;}}window.Date=D;}); // tablet wraca 10-14
  await sleep(5200);
  await r.pg.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await sleep(7000);
  const out=await r.pg.evaluate(()=>{const M=NaukaEngine.meta();const row=MOCK.db().t.app_state[0];return {local:{lastDay:M.lastDay,streak:M.streak,freezes:M.freezes},shown:(document.getElementById('streakNum')||{}).textContent,cloud:{lastDay:row.meta.lastDay,streak:row.meta.streak,freezes:row.meta.freezes}};});
  check(out.local.lastDay==='2026-10-13'&&out.local.streak===6,'seria z telefonu zostaje (lastDay 10-13, 6 dni)',JSON.stringify(out));
  check(out.local.freezes===1,'zamrożenie nie zostało zużyte (nie było potrzebne)',JSON.stringify(out));
  check(out.shown==='6','licznik serii na ekranie: 6',out.shown);
  await close(r);}

const appBytes=r=>r.pg.evaluate(()=>{let n=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k.startsWith('mockbe:'))n+=k.length+localStorage.getItem(k).length;}return n;});
const forgetDevice=r=>r.pg.evaluate(uid=>{['nauka_progress_v1:','nauka_meta_v1:','cf_base:','cf_rev:','cf_dirty:','cf_sent:'].forEach(k=>localStorage.removeItem(k+uid));},UID); // jak świeże urządzenie: sesja jest, postępów nie ma

section('pełna pamięć, ale zalegający cache cf_data → zwolnienie i normalny start');
{const r=await page('mock=seeded&reset=1',{settle:3000});
  const need=await appBytes(r);await forgetDevice(r);
  await r.pg.evaluate(()=>localStorage.setItem('cf_data:inne-konto','x'.repeat(60000)));
  await r.pg.evaluateOnNewDocument(QUOTA(60000+Math.floor(need*0.6))); // cache mieści się, ale razem z postępami i bazą już nie — dopiero po jego usunięciu
  await r.pg.reload({waitUntil:'load'});await sleep(3000);
  const st=await r.pg.evaluate(k=>({pk:!!localStorage.getItem(k),cfData:!!localStorage.getItem('cf_data:inne-konto'),view:window.NaukaEngine.view}),PK);
  check(st.view==='today','apka startuje normalnie',JSON.stringify(st));
  check(st.pk,'postępy z konta zapisane lokalnie');
  check(!st.cfData,'zalegający cache cf_data usunięty, żeby zrobić miejsce');
  await close(r);}

section('brak miejsca nawet po zwolnieniu → blokada, chmura nietknięta');
{const r=await page('mock=seeded&reset=1',{settle:3000});
  await forgetDevice(r);const before=await cloudRow(r);
  await r.pg.evaluateOnNewDocument(QUOTA(3000));
  await r.pg.reload({waitUntil:'load'});
  await sleep(6000); // po 4 s byłby push
  const after=await cloudRow(r),w=await appStateWrites(r),t=await text(r),v=await view(r);
  check(/Brak miejsca na Twoje postępy/.test(t),'ekran „Brak miejsca na Twoje postępy”',t.slice(0,200));
  check(v.view==='error','silnik nie wystartował od zera',JSON.stringify(v));
  check(w===0,'zero zapisów do app_state',w);
  check(after&&before&&after.rev===before.rev&&after.xp===before.xp&&after.xp===730,'wiersz app_state bez zmian (rev, XP 730)',JSON.stringify({before,after}));
  check(!(await r.pg.evaluate(k=>localStorage.getItem(k),PK)),'bez częściowego zapisu postępów (następny start znów jak świeże urządzenie)');
  await shot(r,'sync-storage-full');
  await close(r);}

section('uszkodzony lokalny stan → zamiast pusha scalenie z chmurą');
{const r=await page('mock=seeded&reset=1',{settle:3000});
  const before=await cloudRow(r);
  await r.pg.evaluate(k=>localStorage.setItem(k,'{uszkodzony'),PK);
  await r.pg.reload({waitUntil:'load'});
  let after=null;for(let i=0;i<40;i++){await sleep(500);after=await cloudRow(r);if(after&&after.rev!==before.rev)break;}
  await sleep(2500);after=await cloudRow(r);
  const local=await r.pg.evaluate(k=>{try{const p=JSON.parse(localStorage.getItem(k)||'{}');return Object.values(p).reduce((a,v)=>a+(v&&typeof v==='object'&&typeof v.xp==='number'?v.xp:0),0);}catch(e){return -1;}},PK);
  check(after.xp>=before.xp,'XP w chmurze nie spadło',JSON.stringify({before,after}));
  check(after.keys>=before.keys,'klucze postępów w chmurze zostały',JSON.stringify({before,after}));
  check(local>=before.xp,'lokalny stan odtworzony z chmury',local);
  const ui=await r.pg.evaluate(()=>document.querySelector('.pills')?.innerText||'');
  check(/730/.test(ui.replace(/\s/g,'')),'górny pasek pokazuje XP z konta',ui);
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await shot(r,'sync-corrupt-restored');
  await close(r);}

await done();
