#!/usr/bin/env node
/* Kontrola P1-27: fonty wbudowane w build (WOFF w data:), CSP bez Google Fonts, wszystkie grubości ładują się w Chrome (OTS), także polskie znaki.
   Buduje kopię źródeł w katalogu tymczasowym (nie rusza śledzonego build/nauka-all.html).  Użycie (z test/): node dev/checks/cloud-fonts.mjs */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {start,page,close,check,section,done,shot,ROOT,sleep} from './cloud-lib.mjs';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cramfox-build-'));
for(const f of ['build.js','cloud-config.js','cloud.js','engine.js','cloud-ui.js','styles.css'])fs.copyFileSync(path.join(ROOT,f),path.join(tmp,f));
fs.cpSync(path.join(ROOT,'fonts'),path.join(tmp,'fonts'),{recursive:true});
execFileSync(process.execPath,['build.js'],{cwd:tmp,stdio:'pipe'});
const out=path.join(tmp,'build','nauka-all.html');const html=fs.readFileSync(out,'utf8');

section('build');
const csp=(html.match(/Content-Security-Policy" content="([^"]*)"/)||[])[1]||'';
check(/font-src data:(;|$)/.test(csp),'CSP font-src tylko data:',csp.replace(/'sha256-[^']*'/g,'…'));
check(!/googleapis|gstatic/.test(csp),'CSP bez domen Google');
check(/style-src 'unsafe-inline'(;|$)/.test(csp),'CSP style-src bez zewnętrznych arkuszy');
const faces=html.match(/@font-face\{[^}]*\}/g)||[];
check(faces.length===6,'6 × @font-face w buildzie',faces.length);
check(faces.every(f=>/url\(data:font\/woff;base64,[A-Za-z0-9+/=]+\) format\('woff'\)/.test(f)),'każdy @font-face to WOFF w data:');
check(!/url\(['"]?[^)]*\.ttf/.test(html),'żadnego odwołania do pliku .ttf w buildzie');
const kb=Math.round(html.length/1024);check(kb<1600,`rozmiar buildu ${kb} KB (< 1600 KB)`);

await start();
section('Chrome: ładowanie fontów z buildu');
const r=await page(null,{url:'file://'+out,csp:true,settle:1500});
const st=await r.pg.evaluate(async()=>{
  await document.fonts.ready;
  const want=[['Bricolage Grotesque',700],['Bricolage Grotesque',800],['Plus Jakarta Sans',500],['Plus Jakarta Sans',600],['Plus Jakarta Sans',700],['Plus Jakarta Sans',800]];
  const loaded=[];for(const [f,w] of want){try{const fs=await document.fonts.load(`${w} 20px "${f}"`,'Zażółć gęślą jaźń');loaded.push({f,w,n:fs.length,ok:fs.length>0&&fs.every(x=>x.status==='loaded')});}catch(e){loaded.push({f,w,n:0,ok:false,err:String(e)});}}
  const all=[...document.fonts].map(x=>x.family.replace(/"/g,'')+' '+x.weight+' '+x.status);
  const h=document.querySelector('.logo');const ff=h?getComputedStyle(h).fontFamily:'';
  return {loaded,all,ff,csp:window.__csp||[]};});
st.loaded.forEach(x=>check(x.ok,`${x.f} ${x.w} załadowany`,JSON.stringify(x)));
check(!st.all.some(x=>/error/.test(x)),'żaden font w stanie error',st.all.join(', '));
check(/Bricolage Grotesque/.test(st.ff),'logo w Bricolage Grotesque',st.ff);
check(!st.csp.length,'zero naruszeń CSP (silnik nie dokłada już arkusza Google Fonts)',st.csp.join(' | '));
check(!r.blocked.length,'żadnych żądań poza plik/data: (także do Google Fonts)',r.blocked.join(' '));
await shot(r,'fonts-build-auth');
await close(r);
section('dev: fonts/fonts.css (to samo, co ładuje index.html) z plikami TTF');
{const d=await page('mock=fresh&reset=1',{settle:800});
  const st2=await d.pg.evaluate(async()=>{const l=document.createElement('link');l.rel='stylesheet';l.href='/fonts/fonts.css';document.head.appendChild(l);
    await new Promise(r=>{l.onload=r;l.onerror=r;});const out=[];
    for(const [f,w] of [['Bricolage Grotesque',800],['Plus Jakarta Sans',500],['Plus Jakarta Sans',800]]){const fs=await document.fonts.load(`${w} 20px "${f}"`,'ąęłńóśźż');out.push(fs.length>0&&fs.every(x=>x.status==='loaded'));}
    return out;});
  check(st2.every(Boolean),'fonts.css: TTF ładują się lokalnie (Google zablokowany w teście)',JSON.stringify(st2));
  check(await d.pg.evaluate(()=>!!document.querySelector('link[href="../../fonts/fonts.css"]')&&!document.querySelector('link[href*="googleapis"]')),'test/dev/index.html: <link> do fonts/fonts.css, bez Google Fonts');
  await close(d);}
fs.rmSync(tmp,{recursive:true,force:true});
await done();
