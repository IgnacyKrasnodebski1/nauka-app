/* ============================================================ CRAMFOX — ROLKA (prototyp silnika)
   Pionowa rolka 45–90 s ze scenariusza JSON (storyboards/*.json): lektor + izometryczny „świat”, w którym pojęcia są miejscami,
   a drogi łączą je w opowieść. Kamera, etykiety z liniami, karty, napisy karaoke, lis-przewodnik, przerywniki, pytanie na końcu.
   Zasady:
   - Vanilla JS + SVG/HTML, zero bibliotek i sieci (poza wczytaniem scenariusza z tego samego katalogu) — ma potem wejść do apki.
   - Deterministyczny zegar: render(t) rysuje dokładnie tę samą klatkę dla danego t (bez animacji CSS, bez Math.random w renderze).
     ?sb=nazwa&t=12.5&paused=1 → klatka do zrzutu; ?answer=1 → quiz z wybraną odpowiedzią; ?cover=1 → okładka.
   - Lektor: speechSynthesis (pl-PL), zegar dogania granice słów (boundary); bez głosu — szacowane czasy słów.
   Układ: 1) narzędzia  2) rzut izometryczny i bryły  3) biblioteka rekwizytów  4) świat  5) oś czasu  6) render  7) lis
          8) przerywniki  9) quiz i okładka  10) odtwarzanie i lektor  11) start */
(function(){
'use strict';

/* ============================================================ 1. NARZĘDZIA */
const SW=390, SH=844;                         // scena w punktach CSS
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
const sat=k=>clamp(k,0,1);
const eio=k=>{k=sat(k);return k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;};      // easeInOutCubic
const eout=k=>{k=sat(k);return 1-Math.pow(1-k,3);};
const eback=k=>{k=sat(k);const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(k-1,3)+c1*Math.pow(k-1,2);};
const sstep=(a,b,v)=>{const k=sat((v-a)/(b-a));return k*k*(3-2*k);};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f1=v=>Math.round(v*10)/10;
const own=(o,k)=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(o,k);
function rng(seed){let s=(seed|0)||1;return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hex2rgb(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return[n>>16&255,n>>8&255,n&255];}
function rgb2hex(r){return'#'+r.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');}
function shade(h,k){return rgb2hex(hex2rgb(h).map(v=>v*k));}
function mix(a,b,k){const A=hex2rgb(a),B=hex2rgb(b);return rgb2hex(A.map((v,i)=>v+(B[i]-v)*k));}
function toHsl(h){const[r,g,b]=hex2rgb(h).map(v=>v/255);const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let s=0,hu=0;
  if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);hu=(mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4)/6;}return[hu,s,l];}
function fromHsl(h,s,l){const f=n=>{const k=(n+h*12)%12,a=s*Math.min(l,1-l);return l-a*Math.max(-1,Math.min(k-3,9-k,1));};return rgb2hex([f(0),f(8),f(4)].map(v=>v*255));}
/* tło miasta ma być cichsze od stacji: mniej nasycone (ks) i jaśniejsze (dl) */
function soften(h,ks,dl){const[a,s,l]=toHsl(h);return fromHsl(a,s*ks,clamp(l+dl,0,1));}

/* ============================================================ 2. RZUT IZOMETRYCZNY I BRYŁY
   Świat: x w prawo-w-dół, y w lewo-w-dół, z w górę; 1 jednostka = U px przy zoomie 1. Kierunek patrzenia V=(1,1,1).
   Światło z lewej-góry (−x,+y,+z): góra najjaśniejsza, ściana „lewa” (+y) jaśniejsza, „prawa” (+x) w cieniu.
   Cień rzucany na ziemię: punkt (x,y,z) → (x+K·z, y−K·z), czyli poziomo w prawo na ekranie — zawsze ten sam kierunek. */
const U=32, CX=Math.cos(Math.PI/6), CY=.5;
const P=(x,y,z)=>[(x-y)*CX*U,(x+y)*CY*U-(z||0)*U];
const LIGHT=(()=>{const v=[-.5,.5,1],m=Math.hypot(...v);return v.map(a=>a/m);})();
const SHK=.42;
const VIEW=[1,1,1];
function bright(n){const d=n[0]*LIGHT[0]+n[1]*LIGHT[1]+n[2]*LIGHT[2];return .7+.32*Math.max(0,d);}
function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function newell(pts){let x=0,y=0,z=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];x+=(a[1]-b[1])*(a[2]+b[2]);y+=(a[2]-b[2])*(a[0]+b[0]);z+=(a[0]-b[0])*(a[1]+b[1]);}const m=Math.hypot(x,y,z)||1;return[x/m,y/m,z/m];}
function cen(pts){const c=[0,0,0];pts.forEach(p=>{c[0]+=p[0];c[1]+=p[1];c[2]+=p[2];});return c.map(v=>v/pts.length);}
const ptsStr=a=>a.map(p=>f1(p[0])+','+f1(p[1])).join(' ');
function hull(points){ // monotone chain, punkty 2D
  const p=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(p.length<3)return p;
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lo=[],up=[];
  for(const q of p){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}
  for(let i=p.length-1;i>=0;i--){const q=p[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}
  up.pop();lo.pop();return lo.concat(up);}

/* Bryła wypukła = lista ścian (wielokąty 3D) + kolor. Rysujemy tylko ściany zwrócone do widza — w bryle wypukłej nigdy się nie zasłaniają. */
function solid(faces,col,o){o=o||{};const all=[].concat(...faces);const c=cen(all);
  const F=faces.map(pts=>{let n=newell(pts);const fc=cen(pts);if((fc[0]-c[0])*n[0]+(fc[1]-c[1])*n[1]+(fc[2]-c[2])*n[2]<0)n=n.map(v=>-v);
    return{pts,n,col:(o.faceCol&&o.faceCol(n,pts))||col};});
  return{faces:F,c,verts:all,shadow:o.shadow!==false,op:o.op,cls:o.cls,edge:o.edge};}
function box(x,y,z,w,d,h,col,o){const a=[x,y,z],X=x+w,Y=y+d,Z=z+h;
  return solid([[[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]],[[x,y,z],[X,y,z],[X,Y,z],[x,Y,z]],[[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]],[[x,y,z],[X,y,z],[X,y,Z],[x,y,Z]],
    [[X,y,z],[X,Y,z],[X,Y,Z],[X,y,Z]],[[x,y,z],[x,Y,z],[x,Y,Z],[x,y,Z]]],col,o);}
function cbox(cx,cy,z,w,d,h,col,o){return box(cx-w/2,cy-d/2,z,w,d,h,col,o);}
/* bryła obrotowa: profil [[r,z],…] od dołu, n boków (low-poly), sx/sy — spłaszczenie, rot — obrót */
function lathe(cx,cy,z0,prof,n,col,o){o=o||{};const sx=o.sx||1,sy=o.sy||1,rot=o.rot||0;const rings=prof.map(([r,z])=>{const ring=[];for(let i=0;i<n;i++){const a=rot+i/n*Math.PI*2;ring.push([cx+Math.cos(a)*r*sx,cy+Math.sin(a)*r*sy,z0+z]);}return{r,ring};});
  const faces=[];for(let k=0;k<rings.length-1;k++){const A=rings[k],B=rings[k+1];for(let i=0;i<n;i++){const j=(i+1)%n;const q=[];
    if(A.r>1e-6){q.push(A.ring[i],A.ring[j]);}else q.push(A.ring[i]);
    if(B.r>1e-6){q.push(B.ring[j],B.ring[i]);}else q.push(B.ring[i]);
    if(q.length>=3)faces.push(q);}}
  if(rings[0].r>1e-6)faces.push(rings[0].ring.slice().reverse());const L=rings[rings.length-1];if(L.r>1e-6)faces.push(L.ring.slice());
  return solid(faces,col,o);}
const cyl=(cx,cy,z,r,h,n,col,o)=>lathe(cx,cy,z,[[r,0],[r,h]],n,col,o);
const cone=(cx,cy,z,r,h,n,col,o)=>lathe(cx,cy,z,[[r,0],[0,h]],n,col,o);
const gem=(cx,cy,z,r,h1,h2,n,col,o)=>lathe(cx,cy,z,[[0,0],[r,h1],[r*.62,h1+h2*.55],[0,h1+h2]],n,col,o);
const ball=(cx,cy,z,r,n,col,o)=>lathe(cx,cy,z,[[0,0],[r*.7,r*.3],[r,r],[r*.7,r*1.7],[0,r*2]],n,col,o);
/* dach dwuspadowy (kalenica wzdłuż osi 'x' albo 'y') */
function gable(x,y,z,w,d,h,col,axis,o){const X=x+w,Y=y+d,Z=z+h;
  if(axis==='y'){const m=x+w/2;return solid([[[x,y,z],[x,Y,z],[m,Y,Z],[m,y,Z]],[[X,y,z],[X,Y,z],[m,Y,Z],[m,y,Z]],[[x,Y,z],[X,Y,z],[m,Y,Z]],[[x,y,z],[X,y,z],[m,y,Z]],[[x,y,z],[X,y,z],[X,Y,z],[x,Y,z]]],col,o);}
  const m=y+d/2;return solid([[[x,y,z],[X,y,z],[X,m,Z],[x,m,Z]],[[x,Y,z],[X,Y,z],[X,m,Z],[x,m,Z]],[[X,y,z],[X,Y,z],[X,m,Z]],[[x,y,z],[x,Y,z],[x,m,Z]],[[x,y,z],[X,y,z],[X,Y,z],[x,Y,z]]],col,o);}
function pyr(cx,cy,z,w,d,h,col,o){const x=cx-w/2,y=cy-d/2,X=x+w,Y=y+d,t=[cx,cy,z+h];return solid([[[x,y,z],[X,y,z],t],[[X,y,z],[X,Y,z],t],[[X,Y,z],[x,Y,z],t],[[x,Y,z],[x,y,z],t],[[x,y,z],[X,y,z],[X,Y,z],[x,Y,z]]],col,o);}
/* płaskie przekształcenie bryły (obrót wokół z w punkcie) — wypukłość zostaje */
function rotZ(s,a,px,py){const c=Math.cos(a),si=Math.sin(a);const f=p=>{const dx=p[0]-px,dy=p[1]-py;return[px+dx*c-dy*si,py+dx*si+dy*c,p[2]];};
  const ns=solid(s.faces.map(F=>F.pts.map(f)),'#000',{shadow:s.shadow,op:s.op});ns.faces.forEach((F,i)=>F.col=s.faces[i].col);return ns;}
/* przesunięcie + skala bryły (normalne bez zmian) */
function place(s,cx,cy,k,dz){const m=p=>[cx+p[0]*k,cy+p[1]*k,p[2]*k+(dz||0)];s.faces.forEach(F=>F.pts=F.pts.map(m));s.verts=[].concat(...s.faces.map(F=>F.pts));s.c=m(s.c);return s;}
/* liść: spłaszczona ośmiościenna „łódka” od nasady (z) w kierunku ang */
function leafS(cx,cy,z,ang,L,w,lift,col){const dx=Math.cos(ang),dy=Math.sin(ang),px=-dy,py=dx;const tip=[cx+dx*L,cy+dy*L,z+lift],m=[cx+dx*L*.45,cy+dy*L*.45,z+lift*.55];
  const a=[cx,cy,z],l=[m[0]+px*w,m[1]+py*w,m[2]],r=[m[0]-px*w,m[1]-py*w,m[2]],up=[m[0],m[1],m[2]+w*.28],dn=[m[0],m[1],m[2]-w*.22];
  return solid([[a,l,up],[l,tip,up],[tip,r,up],[r,a,up],[a,l,dn],[l,tip,dn],[tip,r,dn],[r,a,dn]],col);}
/* SVG bryły (ściany widoczne) + jej cień */
function solidSvg(s){let out='';for(const F of s.faces){const n=F.n;if(n[0]*VIEW[0]+n[1]*VIEW[1]+n[2]*VIEW[2]<=1e-4)continue;
  const c=shade(F.col,bright(n));const pts=ptsStr(F.pts.map(p=>P(p[0],p[1],p[2])));
  out+=s.edge?`<polygon points="${pts}" fill="${c}" stroke="${s.edge}" stroke-width="1.1" stroke-linejoin="round"/>`:`<polygon points="${pts}" fill="${c}" stroke="${c}" stroke-width=".6" stroke-linejoin="round"/>`;}
  if(s.op!=null)out=`<g opacity="${s.op}">${out}</g>`;return out;}
function shadowPts(s){if(!s.shadow)return null;const pts=s.verts.map(p=>{const z=Math.max(0,p[2]);return P(p[0]+SHK*z,p[1]-SHK*z,0);});return hull(pts);}
/* wielokąt na ziemi (z=0) */
const groundPoly=(pts,fill,extra)=>`<polygon points="${ptsStr(pts.map(p=>P(p[0],p[1],p[2]||0)))}" fill="${fill}" ${extra||''}/>`;
function circlePts(cx,cy,r,n,z){const a=[];for(let i=0;i<n;i++){const t=i/n*Math.PI*2;a.push([cx+Math.cos(t)*r,cy+Math.sin(t)*r,z||0]);}return a;}
/* tekst na ścianie/ziemi: macierz dla płaszczyzny (oś u, oś v w świecie) */
function planeText(o,u,v,txt,size,fill,weight){const pO=P(...o),pu=P(o[0]+u[0],o[1]+u[1],o[2]+u[2]),pv=P(o[0]+v[0],o[1]+v[1],o[2]+v[2]);
  const a=(pu[0]-pO[0])/U,b=(pu[1]-pO[1])/U,c=(pv[0]-pO[0])/U,d=(pv[1]-pO[1])/U;
  return `<text transform="matrix(${f1(a*100)/100} ${f1(b*100)/100} ${f1(c*100)/100} ${f1(d*100)/100} ${f1(pO[0])} ${f1(pO[1])})" font-family="Bricolage Grotesque, sans-serif" font-weight="${weight||800}" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="middle">${esc(txt)}</text>`;}

/* ============================================================ 3. BIBLIOTEKA REKWIZYTÓW
   Każdy rodzaj (kind) to funkcja rysująca w lokalnych współrzędnych (środek stacji = 0,0, podstawa ~±1.2).
   Kolejność dodawania = kolejność rysowania: od tyłu (mniejsze x+y) do przodu, od dołu do góry.
   Parametry stacji: s (skala), color (główny kolor), z (wysokość dla unoszących się: sun, cloud), text (billboard), colors (flag), h (bar). */
const PAL={wall:'#E7DFD0',wall2:'#DCD1BF',stone:'#D3C8B5',stone2:'#C4B9A6',dark:'#AFA493',grey:'#C9CED4',grey2:'#B7BDC5',slate:'#7F8A9B',roof:'#C9876C',
  gold:'#E6B54E',goldD:'#C8973A',ink:'#454A57',paper:'#F7F3EA',red:'#D2604F',blue:'#6C98CF',navy:'#3E5CA8',green:'#7DAA6B',leaf:'#6CAB59',leafD:'#4F8C45',
  tree:'#5E7D55',trunk:'#7D6B56',water:'#8EC6DA',soil:'#B59A6E',soil2:'#A68A5E',sun:'#FFC54A',cloud:'#F8F7F3',glass:'#CFEADB',white:'#F4F1EA',win:'#8C96A3'};
const PEOPLE=['#6F8FC0','#C97A62','#D9B45E','#7FA26E','#9C86B8','#C9C0AE','#5E7D9E','#B8695A'];
function builder(cx,cy,k){const B={items:[],decor:'',flat:'',top:1,parts:{},cur:null};
  const M=p=>[cx+p[0]*k,cy+p[1]*k,p[2]*k];B.M=M;
  /* części rekwizytu (np. korona nad poduszką, zdrowe/suche zboże): B.part('top') — wszystko dalej trafia do tej części; B.part(null) — z powrotem do bryły głównej.
     Część da się potem osobno przesuwać, chować i pokazywać (akcje strike+fall, state). hidden = na starcie niewidoczna. */
  const T=()=>B.cur?B.parts[B.cur]:B;
  B.part=(name,hidden)=>{if(name==null){B.cur=null;return;}if(!B.parts[name])B.parts[name]={items:[],decor:'',flat:'',hidden:!!hidden};B.cur=name;};
  const add=s=>{place(s,cx,cy,k);T().items.push(s);return s;};B.add=add;
  B.box=(...a)=>add(box(...a));B.cbox=(...a)=>add(cbox(...a));B.cyl=(...a)=>add(cyl(...a));B.cone=(...a)=>add(cone(...a));B.gem=(...a)=>add(gem(...a));
  B.ball=(...a)=>add(ball(...a));B.gable=(...a)=>add(gable(...a));B.pyr=(...a)=>add(pyr(...a));B.lathe=(...a)=>add(lathe(...a));B.leaf=(...a)=>add(leafS(...a));
  B.text=(o,u,v,txt,size,fill,w)=>{T().decor+=planeText(M(o),u,v,txt,size*k,fill,w);};
  B.flatPoly=(pts,fill,extra)=>{T().flat+=groundPoly(pts.map(M),fill,extra);};
  B.ring=(x,y,z,r,stroke,sw,extra)=>{const pts=circlePts(x,y,r,28,z).map(M).map(p=>P(...p));T().flat+=`<polygon points="${ptsStr(pts)}" fill="none" stroke="${stroke}" stroke-width="${sw}" ${extra||''}/>`;};
  B.disc=(x,y,z,r,fill,extra)=>{const pts=circlePts(x,y,r,28,z).map(M).map(p=>P(...p));T().flat+=`<polygon points="${ptsStr(pts)}" fill="${fill}" ${extra||''}/>`;};
  B.line=(pts,stroke,sw,extra)=>{T().flat+=`<polyline points="${ptsStr(pts.map(M).map(p=>P(...p)))}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${extra||''}/>`;};
  B.screen=(p,svg)=>{const q=P(...M(p));T().decor+=svg(q[0],q[1],k);};
  /* okrąg w płaszczyźnie ściany +y (oś x, z) — np. tarcza zegara */
  B.faceDisc=(x,y,z,r,fill,o)=>{const pts=[];for(let i=0;i<24;i++){const a=i/24*Math.PI*2;pts.push(P(...M([x+Math.cos(a)*r,y,z+Math.sin(a)*r])));}T().decor+=`<polygon points="${ptsStr(pts)}" fill="${fill}" ${o||''}/>`;};
  /* okrąg w dowolnej płaszczyźnie (osie a, b w świecie) — np. kokarda na kapeluszu */
  B.planeDisc=(c,a,b,r,fill,o)=>{const pts=[];for(let i=0;i<20;i++){const t=i/20*Math.PI*2,ca=Math.cos(t)*r,sb=Math.sin(t)*r;pts.push(P(...M([c[0]+a[0]*ca+b[0]*sb,c[1]+a[1]*ca+b[1]*sb,c[2]+a[2]*ca+b[2]*sb])));}T().decor+=`<polygon points="${ptsStr(pts)}" fill="${fill}" ${o||''}/>`;};
  B.faceLine=(a,b,stroke,sw)=>{const p=P(...M(a)),q=P(...M(b));T().decor+=`<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}" stroke="${stroke}" stroke-width="${sw*k}" stroke-linecap="round"/>`;};
  B.polyline=(pts,stroke,sw)=>{T().decor+=`<polyline points="${ptsStr(pts.map(M).map(p=>P(...p)))}" fill="none" stroke="${stroke}" stroke-width="${sw*k}" stroke-linecap="round" stroke-linejoin="round"/>`;};
  return B;}
/* trójkątny proporczyk (graniastosłup) w płaszczyźnie x–z: maszt w (x,y), od z1 w dół o h, długość L w stronę +x */
function pennant(B,x,y,z1,h,L,col){const lo=[[x,y-.02,z1],[x,y-.02,z1-h],[x+L,y-.02,z1-h*.62]],hi=lo.map(p=>[p[0],p[1]+.05,p[2]]);
  B.add(solid([lo,hi,[lo[0],lo[1],hi[1],hi[0]],[lo[1],lo[2],hi[2],hi[1]],[lo[2],lo[0],hi[0],hi[2]]],col));}
/* czapka frygijska: przekrzywiony stożek (czubek pochylony do przodu) na opasce */
function phrygian(B,x,y,z,r,col){const n=9,base=[],band=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;base.push([x+Math.cos(a)*r,y+Math.sin(a)*r,z]);band.push([x+Math.cos(a)*r,y+Math.sin(a)*r,z+r*.32]);}
  const sides=[];for(let i=0;i<n;i++){const j=(i+1)%n;sides.push([base[i],base[j],band[j],band[i]]);}B.add(solid([base.slice().reverse(),band].concat(sides),shade(col,.85)));
  const tip=[x+r*.95,y+r*.95,z+r*2.4],F=[band.slice().reverse()];for(let i=0;i<n;i++)F.push([band[i],band[(i+1)%n],tip]);B.add(solid(F,col));}
/* okna: rząd małych ciemnych prostokątów na ścianie +y (y=Y) i +x (x=X) */
function winsY(B,x0,x1,Y,z,n,h,col){const w=(x1-x0)/n;for(let i=0;i<n;i++)B.box(x0+i*w+w*.22,Y,z,w*.56,.025,h,col||PAL.win);}
function winsX(B,y0,y1,X,z,n,h,col){const w=(y1-y0)/n;for(let i=0;i<n;i++)B.box(X,y0+i*w+w*.22,z,.025,w*.56,h,col||PAL.win);}

const PROPS={
house(B,st){const c=st.color||PAL.wall;B.box(-.8,-.7,0,1.6,1.4,.95,c);B.box(.25,-.45,1.05,.24,.24,.62,PAL.stone2);B.gable(-.92,-.82,.95,1.84,1.64,.62,PAL.roof,'x');
  B.box(-.16,.7,0,.32,.03,.55,PAL.ink);winsY(B,-.7,-.25,.7,.42,1,.28);winsY(B,.25,.7,.7,.42,1,.28);winsX(B,-.55,.55,.8,.42,2,.28);B.top=1.6;},
tower(B,st){const c=st.color||PAL.grey;B.box(-.55,-.55,0,1.1,1.1,2.7,c);for(let i=0;i<4;i++){winsY(B,-.5,.5,.55,.45+i*.55,3,.2,shade(c,.62));winsX(B,-.5,.5,.55,.45+i*.55,3,.2,shade(c,.62));}
  B.box(-.36,-.36,2.7,.72,.72,.26,shade(c,.92));B.box(-.04,-.04,2.96,.08,.08,.95,PAL.ink);B.top=3.9;},
hall(B,st){const c=st.color||PAL.wall,dk=!!st.dark,col=dk?shade(c,1.18):PAL.white,roof=dk?'#4B4952':PAL.slate;B.box(-1.38,-1.02,0,2.76,2.04,.2,dk?shade(c,.9):PAL.stone2);B.box(-1.15,-.85,.2,2.3,1.48,.86,c);winsX(B,-.75,.55,1.15,.42,3,.36,dk?'#3E3B44':PAL.win);
  for(let i=0;i<6;i++)B.cyl(-1.0+i*.4,.86,.2,.085,.86,6,col);B.box(-1.26,-.96,1.06,2.52,1.96,.17,dk?shade(c,.94):PAL.stone);B.gable(-1.26,-.96,1.23,2.52,1.96,.46,roof,'x');B.top=1.75;
  // st.cap: maszt z ciemnoczerwonym proporcem i czapką frygijską (symbol jakobinów)
  if(st.cap){const cc=typeof st.cap==='string'?st.cap:'#8E2A2A';B.cyl(.55,-.2,1.5,.035,1.25,5,PAL.ink);pennant(B,.59,-.2,2.62,.36,.62,cc);phrygian(B,.55,-.2,2.75,.13,cc);B.top=3.1;}},
palace(B,st){const c=st.color||PAL.wall;const W2=shade(c,.97);B.box(-1.45,-.62,0,.9,1.24,.92,c);B.box(-1.5,-.67,.92,1.0,1.34,.1,PAL.slate);
  B.box(-.55,-.78,0,1.1,1.56,1.38,W2);winsY(B,-.45,.45,.78,.85,3,.32);B.box(-.2,.78,0,.4,.03,.55,PAL.ink);
  B.lathe(0,0,1.38,[[.5,0],[.5,.14],[.42,.46],[.24,.66],[0,.74]],12,PAL.gold);B.cyl(0,0,2.1,.04,.36,5,PAL.goldD);
  B.box(.55,-.62,0,.9,1.24,.92,c);winsY(B,.62,1.38,.62,.42,2,.3);winsX(B,-.5,.5,1.45,.42,3,.3);B.box(.5,-.67,.92,1.0,1.34,.1,PAL.slate);B.top=2.5;},
fortress(B,st){const c=st.color||'#BDB2A0',d=shade(c,.93);const T=(x,y)=>{B.cyl(x,y,0,.42,1.55,8,d);B.cyl(x,y,1.55,.5,.16,8,shade(c,1.04));};
  T(-1,-1);B.box(-1,-1,0,2,2,1.12,c);for(let i=0;i<5;i++){B.box(-.85+i*.38,.86,1.12,.2,.14,.16,c);B.box(.86,-.85+i*.38,1.12,.14,.2,.16,c);}
  B.box(-.3,1.0,0,.6,.03,.62,'#5A5248');B.box(1.0,-.5,.55,.03,.2,.22,'#5A5248');B.box(1.0,.25,.55,.03,.2,.22,'#5A5248');
  T(1,-1);T(-1,1);T(1,1);B.top=1.85;},
factory(B,st){const c=st.color||'#D4CDC1';B.box(-1.1,-.8,0,2.2,1.6,.9,c);B.cyl(.62,-.45,.0,.17,2.5,8,PAL.roof);B.cyl(.62,-.45,2.5,.21,.12,8,shade(PAL.roof,.9));
  for(let i=0;i<3;i++)B.gable(-1.1+i*.733,-.8,.9,.733,1.6,.38,i%2?PAL.slate:shade(PAL.slate,1.08),'y');winsY(B,-1.0,1.0,.8,.3,5,.3);B.top=2.7;},
school(B,st){const c=st.color||'#E6D7C2';B.box(-1.15,-.7,0,2.3,1.4,1.0,c);B.gable(-1.27,-.82,1.0,2.54,1.64,.6,PAL.roof,'x');
  B.box(-.22,-.22,1.3,.44,.44,.5,PAL.wall);B.pyr(0,0,1.8,.56,.56,.42,PAL.slate);winsY(B,-1.05,1.05,.7,.4,5,.36);B.box(-.18,.7,0,.36,.03,.6,PAL.ink);B.top=2.25;},
server(B,st){for(let i=0;i<4;i++){const z=i*.47;B.box(-.6,-.6,z,1.2,1.2,.43,PAL.grey);B.box(-.5,.6,z+.1,.8,.03,.22,'#3E4350');B.box(.38,.6,z+.16,.1,.035,.1,'#5DD39E');}B.top=1.95;},
crowd(B,st){const n=st.n||12,cols=Math.ceil(Math.sqrt(n*1.3)),R=rng(st.seed||n*7+3);const pos=[];
  for(let i=0;i<n;i++){const r=Math.floor(i/cols),q=i%cols;pos.push([-1+q*(2/(cols-1||1))+(R()-.5)*.18,-.8+r*(1.6/Math.max(1,Math.ceil(n/cols)-1))+(R()-.5)*.18,PEOPLE[Math.floor(R()*PEOPLE.length)]]);}
  pos.sort((a,b)=>(a[0]+a[1])-(b[0]+b[1])).forEach(([x,y,col])=>{B.lathe(x,y,0,[[.17,0],[.15,.3],[.08,.38]],6,col);B.ball(x,y,.36,.12,6,'#E9CDB0');});B.top=.75;},
person(B,st){const col=st.color||PEOPLE[0];B.cyl(0,0,0,.6,.1,10,PAL.stone2);B.lathe(0,0,.1,[[.42,0],[.36,.8],[.18,1.0]],8,col);B.ball(0,0,.98,.3,8,'#E9CDB0');B.top=1.7;},
/* dwie małe postacie: duchowny (ciemna sutanna) i szlachcic (niebieski kaftan, peruka) — np. „I i II stan” */
pair(B,st){B.cyl(0,0,0,.95,.1,12,PAL.stone2);[[-.38,.1,'#4A3F5E','#E9CDB0'],[.36,-.12,'#3E5CA8','#EEE8DA']].sort((a,b)=>(a[0]+a[1])-(b[0]+b[1])).forEach(([x,y,col,head])=>{
  B.lathe(x,y,.1,[[.28,0],[.24,.55],[.12,.68]],8,col);B.ball(x,y,.66,.19,8,'#E9CDB0');if(head!=='#E9CDB0')B.ball(x-.02,y-.02,.78,.15,8,head);});
  B.box(.3,.06,.5,.12,.02,.06,PAL.gold);B.box(-.44,.37,.48,.12,.02,.12,PAL.white);B.top=1.25;},
document(B,st){B.box(-.72,-.28,0,1.44,.56,.16,PAL.stone2);B.box(-.56,-.07,.16,1.12,.14,1.5,PAL.paper);
  B.box(-.42,.07,1.36,.84,.02,.1,PAL.ink);for(let i=0;i<4;i++)B.box(-.42,.07,1.12-i*.2,i===3?.5:.84,.02,.06,'#A3A9B3');B.cyl(.3,.12,.3,.13,.03,10,PAL.red);B.top=1.75;},
crown(B,st){B.cyl(0,0,0,.72,.36,10,PAL.stone2);B.box(-.5,-.5,.36,1,1,.2,PAL.red);
  B.part('top'); // sama korona — przewraca się osobno, poduszka zostaje (strike + fall)
  const sp=[];for(let i=0;i<6;i++){const a=i/6*Math.PI*2+.26;sp.push([Math.cos(a)*.4,Math.sin(a)*.4]);}sp.sort((a,b)=>(a[0]+a[1])-(b[0]+b[1]));
  sp.filter(p=>p[0]+p[1]<0).forEach(([x,y])=>B.pyr(x,y,.84,.2,.2,.32,PAL.gold));B.cyl(0,0,.56,.44,.3,12,PAL.gold);
  sp.filter(p=>p[0]+p[1]>=0).forEach(([x,y])=>{B.pyr(x,y,.84,.2,.2,.32,PAL.gold);});B.ball(.3,.3,.66,.06,6,PAL.red);B.ball(-.12,.42,.66,.06,6,'#4FA3D9');B.part(null);B.top=1.35;},
scales(B,st){B.cyl(0,0,0,.5,.12,8,PAL.stone2);B.cyl(-.8,0,.95,.32,.06,10,PAL.gold);B.box(-.82,-.01,1.0,.03,.03,.55,PAL.ink);
  B.box(-.06,-.06,.12,.12,.12,1.48,PAL.ink);B.box(-.92,-.05,1.55,1.84,.1,.08,PAL.goldD);B.ball(0,0,1.56,.1,6,PAL.gold);
  B.box(.79,-.01,1.0,.03,.03,.55,PAL.ink);B.cyl(.8,0,.95,.32,.06,10,PAL.gold);B.top=1.8;},
clock(B,st){const c=st.color||PAL.stone;B.box(-.55,-.55,0,1.1,1.1,2.4,c);B.pyr(0,0,2.4,1.24,1.24,.85,PAL.slate);winsX(B,-.4,.4,.55,.4,2,.4);
  B.faceDisc(0,.56,1.78,.36,'#FBF8F0','stroke="#454A57" stroke-width="2"');B.faceLine([0,.57,1.78],[0,.57,2.02],PAL.ink,2.6);B.faceLine([0,.57,1.78],[.17,.57,1.72],PAL.ink,2.6);B.top=3.3;},
globe(B,st){B.cyl(0,0,0,.42,.12,8,PAL.ink);B.box(-.05,-.05,.12,.1,.1,.4,PAL.ink);
  B.ball(0,0,.45,.62,10,PAL.blue,{faceCol:(n)=>{const v=Math.sin(n[0]*5.1+1.3)*Math.cos(n[1]*4.3-.4)+n[2]*.6;return v>.35?PAL.green:null;}});B.top=1.75;},
book(B,st){const cols=[PAL.navy,PAL.red,'#5E8C6A'];const L=[[-.82,-.62,0,1.64,1.24,.26],[-.74,-.5,.26,1.5,1.1,.24],[-.7,-.62,.5,1.44,1.18,.22]];
  L.forEach((b,i)=>{B.box(...b,cols[i]);B.box(b[0]+.08,b[1]+b[4],b[2]+.05,b[3]-.16,.02,b[5]-.1,PAL.paper);B.box(b[0]+b[3],b[1]+.08,b[2]+.05,.02,b[4]-.16,b[5]-.1,PAL.paper);});
  if(st.bulb){B.cyl(0,0,.72,.16,.2,8,'#9AA0AA');B.lathe(0,0,.92,[[.14,0],[.3,.24],[.36,.44],[.28,.66],[0,.78]],10,'#FFE38A');B.screen([0,0,1.35],(x,y,k)=>`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(30*k)}" fill="#FFE38A" opacity=".28"/>`);B.top=1.75;}else B.top=.9;},
trees(B,st){const R=rng(st.seed||11);const T=[];for(let i=0;i<(st.n||5);i++)T.push([(R()-.5)*1.9,(R()-.5)*1.9,.75+R()*.5]);T.sort((a,b)=>a[0]+a[1]-b[0]-b[1]);
  T.forEach(([x,y,s])=>{B.cyl(x,y,0,.06*s,.3*s,5,PAL.trunk);B.gem(x,y,.22*s,.36*s,.3*s,.62*s,6,PAL.tree);});B.top=1.3;},
tree(B,st){B.cyl(0,0,0,.16,1.0,7,PAL.trunk);B.gem(0,0,.75,1.05,.7,1.1,8,st.color||PAL.leafD);B.gem(.1,.1,1.5,.75,.5,.9,8,shade(st.color||PAL.leafD,1.08));B.top=3.0;},
flag(B,st){const cs=st.colors||[PAL.navy,PAL.white,PAL.red];B.box(-.32,-.32,0,.64,.64,.2,PAL.stone2);B.cyl(0,0,.2,.05,2.65,6,PAL.ink);
  cs.forEach((c,i)=>B.box(.06+i*(1.2/cs.length),-.02,1.95,1.2/cs.length,.04,.78,c));B.ball(0,0,2.85,.08,6,PAL.gold);B.top=3.0;},
cell(B,st){B.lathe(0,0,0,[[1.3,0],[1.3,.16]],16,PAL.stone2,{sx:1.25});
  [[-.55,-.25],[.25,-.45],[.65,.25],[-.1,.35]].sort((a,b)=>a[0]+a[1]-b[0]-b[1]).forEach(([x,y])=>{for(let j=0;j<4;j++)B.cyl(x,y,.16+j*.12,.24,.08,10,j%2?PAL.leaf:PAL.leafD);});
  B.lathe(0,0,.16,[[1.18,0],[1.08,.42],[.84,.78],[.48,1.0],[0,1.08]],16,PAL.glass,{sx:1.25,op:.55,shadow:false});B.top=1.35;},
sun(B,st){const z=st.z==null?5.5:st.z;B.screen([0,0,z+.8],(x,y,k)=>{let r='';for(let i=0;i<12;i++){const a=i/12*Math.PI*2;r+=`<line x1="${f1(x+Math.cos(a)*44*k)}" y1="${f1(y+Math.sin(a)*44*k)}" x2="${f1(x+Math.cos(a)*60*k)}" y2="${f1(y+Math.sin(a)*60*k)}" stroke="#F2B53A" stroke-width="${f1(5*k)}" stroke-linecap="round"/>`;}return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(70*k)}" fill="#FFD66B" opacity=".22"/>`+r;});
  B.ball(0,0,z,.8,12,PAL.sun,{shadow:false});B.disc(0,0,0,.7,'rgba(233,170,60,.18)');B.top=z+1.7;},
plant(B,st){B.lathe(0,0,0,[[.36,0],[.48,.52],[.44,.56]],8,PAL.roof);B.cyl(0,0,.5,.42,.04,8,PAL.soil2);B.cyl(0,0,.5,.055,1.7,6,'#5E8C47');
  const Lf=[[.85,-2.2,.9,.4],[1.2,.9,.85,.45],[1.55,-.6,.75,.3],[1.9,2.4,.6,.35]];Lf.forEach(([z,a,L,lift])=>B.leaf(0,0,z,a,L,.28,lift,PAL.leaf));B.top=2.4;},
water(B,st){B.flatPoly(circlePts(0,0,1.25,24).map(p=>[p[0]*1.25,p[1]*.95,.01]),PAL.water);B.ring(.1,0,.02,.55,'rgba(255,255,255,.75)',1.6);B.ring(-.35,.25,.02,.25,'rgba(255,255,255,.6)',1.4);
  [[-1.3,-.6],[1.35,.4],[-.5,1.05],[1.0,-.85]].forEach(([x,y],i)=>B.gem(x,y,0,.16+i%2*.06,.06,.14,6,'#A9A397'));[[-1.2,.5],[-1.05,.75],[.9,.95]].forEach(([x,y])=>B.cone(x,y,0,.05,.5,4,'#6E9A55'));B.top=.6;},
vault(B,st){const c=st.color||PAL.wall;B.box(-1.05,-.85,0,2.1,1.85,.12,PAL.stone2);B.box(-.9,-.75,.12,1.8,1.4,.95,c);
  for(let i=0;i<4;i++)B.cyl(-.72+i*.48,.84,.12,.09,.95,6,PAL.white);B.box(-.98,-.8,1.07,1.96,1.75,.14,PAL.stone);B.gable(-.98,-.8,1.21,1.96,1.75,.42,PAL.slate,'y');
  B.box(-.24,.66,.12,.48,.03,.62,'#4A4136');B.cyl(1.25,.95,0,.2,.1,10,PAL.goldD);B.cyl(1.25,.95,.1,.2,.05,10,PAL.gold);B.top=1.75;},
field(B,st){for(let i=0;i<5;i++)B.flatPoly([[-1.4+i*.56,-1.1,.01],[-1.4+i*.56+.5,-1.1,.01],[-1.4+i*.56+.5,1.1,.01],[-1.4+i*.56,1.1,.01]],i%2?PAL.soil:PAL.soil2);
  // stan „dry” (nieurodzaj): spękana, wypłowiała ziemia i rzadkie, niskie, brązowe kikuty; akcja state przełącza ok → dry
  B.part('dry',true);B.flatPoly([[-1.42,-1.12,.012],[1.42,-1.12,.012],[1.42,1.12,.012],[-1.42,1.12,.012]],'#CDB48C');
  [[[-1.2,-.8],[-.7,-.5],[-.8,.1],[-.3,.5]],[[-.2,-1.0],[.1,-.4],[.6,-.3],[.9,.2]],[[.3,.9],[.0,.4],[-.5,.6]],[[1.2,.7],[.8,.5],[.9,1.0]],[[-1.3,.6],[-.9,.9]]].forEach(L=>B.line(L.map(([x,y])=>[x,y,.015]),'#8C6E44',1.5));
  const D=rng(15);for(let i=0;i<7;i++){const x=-1.2+(i%4)*.68+D()*.2,y=-.75+Math.floor(i/4)*1.0+D()*.4;B.cone(x,y,0,.05,.12+D()*.1,4,'#8E7048');}
  B.part('ok');const R=rng(5);for(let i=0;i<9;i++){const x=-1.25+(i%5)*.56+R()*.2,y=-.9+Math.floor(i/5)*1.1+R()*.5;B.cone(x,y,0,.07,.42+R()*.2,4,'#D6B35C');}
  B.part(null);B.box(.55,-1.3,0,.75,.6,.5,'#C98B6A');B.gable(.5,-1.36,.5,.85,.72,.32,PAL.slate,'x');B.top=1.0;},
cloud(B,st){const z=st.z==null?3:st.z;[[-.55,-.1,.42],[0,-.35,.55],[.5,0,.45],[0,.3,.4]].sort((a,b)=>a[0]+a[1]-b[0]-b[1]).forEach(([x,y,r])=>B.ball(x,y,z-r,r,8,PAL.cloud,{shadow:false}));
  B.disc(0,0,0,.9,'rgba(120,110,90,.10)');B.top=z+.8;},
crate(B,st){B.box(-.85,-.85,0,1.7,1.7,.14,'#B8956F');const C=[];for(let z=0;z<3;z++){const n=3-z;for(let i=0;i<n;i++)for(let j=0;j<n;j++)C.push([-.75+i*.5+z*.25,-.75+j*.5+z*.25,.14+z*.46]);}
  C.sort((a,b)=>a[2]-b[2]||(a[0]+a[1])-(b[0]+b[1])).forEach(([x,y,z])=>B.box(x,y,z,.46,.46,.44,'#FBF9F3'));B.top=1.6;},
bubbles(B,st){B.cone(0,0,0,.35,.25,8,PAL.stone2);const R=rng(9);const bs=[];for(let i=0;i<9;i++)bs.push([(R()-.5)*1.2,(R()-.5)*1.2,.5+i*.32,.12+R()*.16]);
  bs.forEach(([x,y,z,r])=>B.ball(x,y,z,r,8,'#BFE6F2',{shadow:false,op:.9}));B.top=3.6;},
billboard(B,st){B.box(-.9,-.06,0,.12,.12,1.0,PAL.ink);B.box(.78,-.06,0,.12,.12,1.0,PAL.ink);B.box(-1.15,-.06,1.0,2.3,.12,1.15,PAL.white);B.box(-1.05,.06,1.1,2.1,.02,.95,st.color||'#FFFFFF');
  B.text([0,.09,1.58],[1,0,0],[0,0,-1],st.text||'',st.size||26,PAL.ink,800);B.top=2.3;},
bar(B,st){const h=st.h||1.5;B.box(-.5,-.5,0,1,1,h,st.color||PAL.grey);B.top=h+.1;},
node(B,st){B.cyl(0,0,0,.8,.22,12,PAL.stone2);B.cyl(0,0,.22,.55,.36,12,st.color||PAL.green);B.cyl(0,0,.58,.3,.12,12,shade(st.color||PAL.green,1.1));B.top=.9;},
/* koło zębate leżące na cokole (+ mniejsze nad nim): maszyneria, mechanizm, „wiązanie” */
gear(B,st){const c=st.color||'#8E9AA8';B.cyl(0,0,0,1.0,.14,14,PAL.stone2);
  const cog=(cx,cy,z,R,n,h,col,rot)=>{const T=[];for(let i=0;i<n;i++){const a=rot+i/n*Math.PI*2,x=cx+Math.cos(a)*R,y=cy+Math.sin(a)*R;T.push({x,y,s:rotZ(box(x-.12,y-.11,z,.24,.22,h,col),a,x,y)});}
    T.filter(o=>o.x+o.y<cx+cy).forEach(o=>B.add(o.s));B.cyl(cx,cy,z,R*.9,h,16,col);T.filter(o=>o.x+o.y>=cx+cy).forEach(o=>B.add(o.s));B.cyl(cx,cy,z+h,R*.32,.06,10,shade(col,.8));};
  cog(0,0,.14,.74,11,.3,c,.1);cog(.08,.08,.5,.42,8,.26,shade(c,1.1),.3);B.cyl(.08,.08,.5,.1,.5,6,PAL.ink);B.top=1.1;},
/* trzy strzałki w kole na cokole: obieg, odnowa, regeneracja */
recycle(B,st){const c=st.color||PAL.green;B.cyl(0,0,0,1.0,.14,14,PAL.stone2);const parts=[],R=.74,z=.14,h=.26;
  for(let k=0;k<3;k++){const a0=k*Math.PI*2/3+.35;
    for(let j=0;j<3;j++){const a=a0+.25+j*.42,x=Math.cos(a)*R,y=Math.sin(a)*R;parts.push(rotZ(box(x-.1,y-.23,z,.2,.46,h,c),a,x,y));}
    const a=a0+1.5,cx=Math.cos(a)*R,cy=Math.sin(a)*R,nx=Math.cos(a),ny=Math.sin(a),tx=-Math.sin(a),ty=Math.cos(a);
    const b1=[cx-nx*.27,cy-ny*.27],b2=[cx+nx*.27,cy+ny*.27],tp=[cx+tx*.4,cy+ty*.4];const tri=zz=>[[b1[0],b1[1],zz],[b2[0],b2[1],zz],[tp[0],tp[1],zz]];const lo=tri(z),hi=tri(z+h);
    parts.push(solid([lo,hi,[lo[0],lo[1],hi[1],hi[0]],[lo[1],lo[2],hi[2],hi[1]],[lo[2],lo[0],hi[0],hi[2]]],shade(c,1.06)));}
  parts.sort((a,b)=>(a.c[0]+a.c[1])-(b.c[0]+b.c[1])).forEach(p=>B.add(p));B.cyl(0,0,z,.28,.2,10,PAL.white);B.top=.7;},
};
PROPS.people=PROPS.crowd;PROPS['tree-cluster']=PROPS.trees;
/* dodatki dokładane w trakcie rolki (akcja "prop"): rysowane nad stacją, wchodzą „pop” albo spadają z góry ("drop").
   Współrzędne lokalne stacji; z = wysokość podstawy dodatku. */
const EXTRA={
  flag(B,o){const cs=o.colors||[PAL.navy,PAL.white,PAL.red],z=o.z||0,h=o.h||1.5;B.cyl(0,0,z,.05,h,6,PAL.ink);
    cs.forEach((c,i)=>B.box(.06+i*(.96/cs.length),-.02,z+h-.66,.96/cs.length,.04,.6,c));B.ball(0,0,z+h,.07,6,PAL.gold);return{base:[0,0,z],top:z+h};},
  /* dwurożny kapelusz (bikorn) z profilu: dwa skrzydła (każde wypukłe) z dołem w kształcie V i rogami uniesionymi na końcach, kokarda w trzech kolorach, złota lamówka */
  bicorne(B,o){const z=o.z||0,W=(o.w||2.2)/2,H=o.h||.8,D=.22,u=[.7071,-.7071,0],v=[.7071,.7071,0],col=o.color||'#2A2833';
    const Q=(a,zz,dv)=>[u[0]*a+v[0]*dv,u[1]*a+v[1]*dv,z+zz];
    const wing=sg=>{const prof=[[0,0],[sg*W,.36*H],[sg*W*.78,.7*H],[sg*W*.45,.94*H],[0,H]];const F=prof.map(([a,zz])=>Q(a,zz,D)),K=prof.map(([a,zz])=>Q(a,zz,-D)),faces=[F,K];
      for(let i=0;i<prof.length;i++){const j=(i+1)%prof.length;faces.push([F[i],F[j],K[j],K[i]]);}return solid(faces,col);};
    B.add(wing(-1));B.add(wing(1));
    const tr=[[-W*.93,.4*H],[-W*.74,.7*H],[-W*.43,.9*H],[0,.95*H],[W*.43,.9*H],[W*.74,.7*H],[W*.93,.4*H]].map(([a,zz])=>Q(a,zz,D+.01));B.polyline(tr,PAL.gold,2.8);
    const cc=Q(W*.3,.52*H,D+.012);[[.2,PAL.navy],[.13,'#F4F1EA'],[.065,PAL.red]].forEach(([r,f])=>B.planeDisc(cc,u,[0,0,1],r,f));
    return{base:[0,0,z],top:z+H};}};

/* ============================================================ 4. ŚWIAT
   Stacje (pojęcia) + drogi (relacje) + strefy (obszary) + losowe, ale stałe (seed) miasto-wypełniacz dookoła. */
const FLOATING={sun:1,cloud:1};
const AIRY={sun:1,cloud:1,bubbles:1}; // nad nimi (na ekranie) nie stawiamy wypełniacza: nie mogą „siedzieć na dachach”
/* wypełniacz o ~30% mniej nasycony i ~8% jaśniejszy niż stacje — stacje mają wyskakiwać z tła */
const FILL=['#DCD2C0','#D3CABA','#D7DADD','#CAD0D6','#E0D7C6','#C8BFAF','#E3DDD1','#CFD3CB'].map(c=>soften(c,.7,.05));
/* motywy świata: city (domyślny) i leaf (wnętrze liścia: komórki zamiast domów, jasnozielone „żyłki” zamiast asfaltu) */
/* accent = kolor wyróżnień świata (pierścień highlight, etykieta "accent"): na mieście limonka, na zielonym liściu słoneczna żółć z ciemnym obrysem */
const THEMES={
  city:{ground:'#ECE6D9',fill:FILL,road:'#4E5360',roadEdge:'#F5F1E8',dash:'#A3A8B1',plaza:'#E6DFD1',plazaEdge:'#D9D0BE',gable:'#B9A894',cells:false,
    fg:['#D9D0BF','#CFC6B4','#D6D8D9'],accent:'#B4FF3A',accentD:'#6FAE00'},
  /* liść: ciepłe, jasne tło międzykomórkowe; komórki = niskie sześciokątne płytki z ciemniejszą ścianą i 2–3 chloroplastami; żyłki = ciemne pasy z jasną przerywaną */
  leaf:{ground:'#EEEAD2',fill:['#BFD99F','#B6D394','#C7DEA9','#AFCF8C','#C3DCA3'],cellEdge:'#86AC6A',road:'#3F6F45',roadEdge:'#F6F3E2',dash:'#CBE6B2',plaza:'#F4F1E2',plazaEdge:'#D9D3B5',gable:null,cells:true,
    fg:['#C9DDB0','#BCD5A0','#D2E3BC'],accent:'#E6B54E',accentD:'#5C4410'}};
const ROAD_W=.62;
function distSeg(px,py,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy||1;const k=clamp(((px-a[0])*dx+(py-a[1])*dy)/L,0,1);return Math.hypot(px-(a[0]+dx*k),py-(a[1]+dy*k));}
function buildWorld(sb){
  const W=sb.world||{},ST={},list=[];
  (W.stations||[]).forEach(s0=>{const s=Object.assign({s:1},s0);s.x=+s.x||0;s.y=+s.y||0;const fn=Object.prototype.hasOwnProperty.call(PROPS,s.kind)?PROPS[s.kind]:(console.warn('[rolka] nieznany rodzaj stacji',s.kind),PROPS.house);
    const B=builder(s.x,s.y,s.s);fn(B,s);s.B=B;s.top=B.top*s.s;s.float=Object.prototype.hasOwnProperty.call(FLOATING,s.kind);ST[s.id]=s;list.push(s);});
  const roads=[];(W.roads||[]).forEach(r=>{const o=Array.isArray(r)?{from:r[0],to:r[1]}:Object.assign({},r);const A=ST[o.from],Bs=ST[o.to];if(!A||!Bs)return;
    if(!o.style)o.style=(A.float||Bs.float)?'beam':'road';o.A=A;o.B=Bs;roads.push(o);});
  const zones=(W.zones||[]).map(z=>Object.assign({},z));
  // granice świata: to, co widzi kamera przeglądowa (cały świat) z zapasem — miasto ma wypełniać ekran, nie wisieć jak wyspa
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;list.forEach(s=>{x0=Math.min(x0,s.x);y0=Math.min(y0,s.y);x1=Math.max(x1,s.x);y1=Math.max(y1,s.y);});
  if(!list.length){x0=y0=-5;x1=y1=5;}
  const vis=(()=>{let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;list.forEach(s=>{[P(s.x,s.y,0),P(s.x,s.y,s.top)].forEach(p=>{a=Math.min(a,p[0]);c=Math.max(c,p[0]);b=Math.min(b,p[1]);d=Math.max(d,p[1]);});});
    const z=clamp(Math.min((SW-90)/Math.max(1,c-a+120),(SH*.5)/Math.max(1,d-b+120)),.3,3)*.8;const cx=(a+c)/2,cy=(b+d)/2,hw=SW/2/z,hh=SH/2/z;return[cx-hw,cy-hh,cx+hw,cy+hh];})();
  const inv=(X,Y)=>{const u=X/(CX*U),v=Y/(CY*U);return[(u+v)/2,(v-u)/2];};
  {const cs=[inv(vis[0],vis[1]),inv(vis[2],vis[1]),inv(vis[0],vis[3]),inv(vis[2],vis[3])];x0=Math.min(x0,...cs.map(c=>c[0]));x1=Math.max(x1,...cs.map(c=>c[0]));y0=Math.min(y0,...cs.map(c=>c[1]));y1=Math.max(y1,...cs.map(c=>c[1]));}
  const onScreen=(x,y)=>{const p=P(x,y,0);return p[0]>vis[0]-60&&p[0]<vis[2]+60&&p[1]>vis[1]-40&&p[1]<vis[3]+120;};
  const R=rng(W.seed||7);const TH=Object.prototype.hasOwnProperty.call(THEMES,W.theme)?THEMES[W.theme]:THEMES.city;
  /* --- warstwa ziemi: strefy, drogi, place --- */
  let ground='';
  zones.forEach(z=>{if(z.r){ground+=groundPoly(circlePts(z.x,z.y,z.r,56),z.color||'#DDE7CD','stroke="'+shade(z.color||'#DDE7CD',.9)+'" stroke-width="2" stroke-dasharray="7 6"');return;}const r=Math.min(1.2,z.w/4,z.d/4),pts=[];const c=[[z.x+z.w-r,z.y+r,-Math.PI/2],[z.x+z.w-r,z.y+z.d-r,0],[z.x+r,z.y+z.d-r,Math.PI/2],[z.x+r,z.y+r,Math.PI]];
    c.forEach(([cx,cy,a0])=>{for(let i=0;i<=6;i++){const a=a0+i/6*Math.PI/2;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}});
    ground+=groundPoly(pts,z.color||'#DDE7CD','stroke="'+shade(z.color||'#DDE7CD',.9)+'" stroke-width="2" stroke-dasharray="7 6"');});
  const segs=[];
  roads.filter(r=>r.style!=='beam').forEach(r=>{const a=[r.A.x,r.A.y],b=[r.B.x,r.B.y];segs.push([a,b]);});
  const quad=(a,b,w)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,px=-dy/L*w/2,py=dx/L*w/2;return[[a[0]+px,a[1]+py],[b[0]+px,b[1]+py],[b[0]-px,b[1]-py],[a[0]-px,a[1]-py]];};
  segs.forEach(([a,b])=>{ground+=groundPoly(quad(a,b,ROAD_W+.34),TH.roadEdge);});
  segs.forEach(([a,b])=>{ground+=groundPoly(quad(a,b,ROAD_W),TH.road);});
  segs.forEach(([a,b])=>{const p=P(a[0],a[1],0),q=P(b[0],b[1],0);ground+=`<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}" stroke="${TH.dash}" stroke-width="1.3" stroke-dasharray="7 9"/>`;});
  // place także pod stacjami w powietrzu (słońce, chmura): widać, gdzie „stoją”, i nic tam nie wyrasta
  list.forEach(s=>{const r=(s.float?1.2:1.55)*s.s;ground+=groundPoly(circlePts(s.x,s.y,r+.12,32),TH.plazaEdge)+groundPoly(circlePts(s.x,s.y,r,32),TH.plaza);
    if(s.float)ground+=groundPoly(circlePts(s.x,s.y,r*.62,24),'rgba(90,74,48,.10)');});
  /* --- bryły: stacje + wypełniacz, sortowane od tyłu --- */
  const items=[];
  list.forEach(s=>items.push({key:s.x+s.y+.3,st:s,solids:s.B.items}));
  // stacja „lotna” (słońce, chmura, bąbelki) zajmuje na ekranie słup nad placem: na ziemi to odcinek od (x,y) do (x−h, y−h)
  const airy=list.filter(s=>s.float||Object.prototype.hasOwnProperty.call(AIRY,s.kind)).map(s=>{const h=s.float?(s.kind==='sun'?(s.z==null?5.5:s.z)+.8:(s.z==null?3:s.z)+.6)*s.s:s.top*.9;return{s,a:[s.x,s.y],b:[s.x-h,s.y-h]};});
  const near=(x,y,pad)=>list.some(s=>!s.float&&Math.hypot(x-s.x,y-s.y)<2.15*s.s+pad)||airy.some(o=>distSeg(x,y,o.a,o.b)<1.8*o.s.s+pad)||segs.some(([a,b])=>distSeg(x,y,a,b)<.95+pad)||
    zones.some(z=>z.r?Math.hypot(x-z.x,y-z.y)<z.r+.5:(x>z.x-.6&&x<z.x+z.w+.6&&y>z.y-.6&&y<z.y+z.d+.6));
  const G=1.75;
  const damp=(x,y)=>{let m=1;list.forEach(s=>{if(s.float)return;const d=Math.hypot(x-s.x,y-s.y),front=(x+y)>(s.x+s.y)-.5;m=Math.min(m,front?clamp((d-2.3*s.s)/4.5,.2,1):clamp((d-2.3*s.s)/3,.45,1));});return m;};
  const capH=(x,y)=>list.some(s=>!s.float&&Math.hypot(x-s.x,y-s.y)<4*s.s)?.6:9; // w promieniu 4 jednostek od stacji tło jest niskie
  for(let gx=Math.floor(x0/G)*G;gx<x1;gx+=G)for(let gy=Math.floor(y0/G)*G;gy<y1;gy+=G){
    const r=R(),cx=gx+G/2+(R()-.5)*.5,cy=gy+G/2+(R()-.5)*.5;if(!onScreen(cx,cy))continue;
    if(r<.6){const w=.7+R()*.62,d=.7+R()*.62,far=Math.min(1,Math.hypot(cx-(x0+x1)/2,cy-(y0+y1)/2)/14);let h=(.3+Math.pow(R(),1.6)*(1.1+far*1.2))*damp(cx,cy);
      if(near(cx,cy,Math.max(w,d)/2))continue;const col=TH.fill[Math.floor(R()*TH.fill.length)];const q=R();
      if(TH.cells){const r=.62+R()*.2,hh=.1+R()*.14,rot=R()*.6;const sol=[lathe(cx,cy,0,[[r,0],[r,hh]],6,col,{rot,edge:TH.cellEdge})];
        // 2–3 chloroplasty na wierzchu komórki (jak w przybliżeniu: zielone owale z ciemnym brzegiem i jasną kreską)
        let after='';const nc=2+(q<.5?1:0);for(let j=0;j<nc;j++){const a=rot+j*2.2+R()*.5,dd=r*(.3+R()*.22),ox=cx+Math.cos(a)*dd,oy=cy+Math.sin(a)*dd,ang=R()*Math.PI,rx=.17,ry=.085;
          const pts=[];for(let k=0;k<12;k++){const th=k/12*Math.PI*2,ex=Math.cos(th)*rx,ey=Math.sin(th)*ry;pts.push(P(ox+ex*Math.cos(ang)-ey*Math.sin(ang),oy+ex*Math.sin(ang)+ey*Math.cos(ang),hh+.005));}
          const l1=P(ox-Math.cos(ang)*rx*.55,oy-Math.sin(ang)*rx*.55,hh+.006),l2=P(ox+Math.cos(ang)*rx*.55,oy+Math.sin(ang)*rx*.55,hh+.006);
          after+=`<polygon points="${ptsStr(pts)}" fill="#4F9A45" stroke="#2F6B2B" stroke-width=".9"/><line x1="${f1(l1[0])}" y1="${f1(l1[1])}" x2="${f1(l2[0])}" y2="${f1(l2[1])}" stroke="#A6D88C" stroke-width=".9"/>`;}
        items.push({key:cx+cy,solids:sol,after});continue;}
      h=Math.min(h,capH(cx,cy));const sol=[box(cx-w/2,cy-d/2,0,w,d,h,col)];
      if(q<.22){const w2=w*(.35+R()*.3),d2=d*(.35+R()*.3);sol.push(box(cx-w2/2+(R()-.5)*.2,cy-d2/2+(R()-.5)*.2,h,w2,d2,.14+R()*.25,shade(col,.96)));}
      else if(q<.32&&TH.gable){sol.push(gable(cx-w/2-.05,cy-d/2-.05,h,w+.1,d+.1,.35,TH.gable,R()<.5?'x':'y'));}
      items.push({key:cx+cy,solids:sol});}
    else if(r<.8){const n=1+Math.floor(R()*3);const T=[];for(let i=0;i<n;i++){const x=cx+(R()-.5)*1.1,y=cy+(R()-.5)*1.1;if(near(x,y,.2))continue;const s=.55+R()*.4;
        T.push([x,y,s]);}
      if(TH.cells)T.forEach(([x,y,s])=>items.push({key:x+y,solids:[ball(x,y,0,.1*s+.03,5,R()<.5?'#D9E7C2':'#CFE0B6')]}));
      else T.forEach(([x,y,s])=>items.push({key:x+y,solids:[cyl(x,y,0,.05*s,.25*s,5,PAL.trunk),gem(x,y,.18*s,.32*s,.26*s,.55*s,6,R()<.5?PAL.tree:'#6C8A5F')]}));}
  }
  items.sort((a,b)=>a.key-b.key);
  let shadows='',solids='';
  items.forEach(it=>{let g='';it.solids.forEach(s=>{const sh=shadowPts(s);if(sh)shadows+=`<polygon points="${ptsStr(sh)}"/>`;g+=solidSvg(s);});
    if(it.st){const s=it.st;let pf='',ps='';
      // części: płaskie (ziemia) pod bryłami stacji, bryły i ozdoby nad nimi; cienie części osobno, żeby znikały razem z częścią
      Object.keys(s.B.parts).forEach(name=>{const pt=s.B.parts[name],hid=pt.hidden?' style="display:none"':'',at=`data-part="${esc(s.id)}|${esc(name)}"`;let pg='',psh='';
        pt.items.forEach(q=>{const sh=shadowPts(q);if(sh)psh+=`<polygon points="${ptsStr(sh)}"/>`;pg+=solidSvg(q);});
        if(pt.flat)pf+=`<g ${at}${hid}>${pt.flat}</g>`;ps+=`<g ${at} data-top="1"${hid}>${pg}${pt.decor}</g>`;if(psh)shadows+=`<g ${at}${hid}>${psh}</g>`;});
      solids+=`<g data-st="${esc(s.id)}">${s.B.flat}${pf}${g}${s.B.decor}${ps}</g>`;}else solids+=g+(it.after||'');});
  /* --- promienie (drogi „beam” do stacji w powietrzu) --- */
  let beams='';
  const beamLine=(p,q,col)=>`<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}" stroke="${col}" stroke-width="14" stroke-linecap="round" opacity=".22"/><line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}" stroke="${col}" stroke-width="2.4" stroke-dasharray="2 8" stroke-linecap="round"/>`;
  roads.filter(r=>r.style==='beam').forEach(r=>{const a=anchorOf(r.A,.5),b=anchorOf(r.B,.55);const p=P(...a),q=P(...b);const col=r.color||(r.A.kind==='sun'||r.B.kind==='sun'?'#F2B53A':'#9AA9BC');
    r.mid=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];r.ends=[a,b];
    // wersja szara (akcja strike z "road": „ta faza nie korzysta ze światła”) — przenikanie kolor ↔ szarość
    beams+=`<g data-beam="${esc(r.A.id)}|${esc(r.B.id)}"><g class="bOn">${beamLine(p,q,col)}</g><g class="bOff" opacity="0">${beamLine(p,q,'#9C9A92')}</g></g>`;});
  // graf dróg
  const adj={};list.forEach(s=>adj[s.id]=[]);roads.forEach(r=>{adj[r.A.id].push({to:r.B.id,r});adj[r.B.id].push({to:r.A.id,r});});
  const svg=`<defs id="gDefs"></defs><g id="cam"><g id="gGround">${ground}</g><g id="gShadow" fill="#5A4A30" opacity=".15">${shadows}</g><g id="gHi"></g><g id="gBeam">${beams}</g><g id="gSolid">${solids}</g><g id="gExtra"></g><g id="gFx"></g></g>`;
  /* pierwszy plan (paralaksa): kilka dużych, miękkich brył „bliżej kamery” — rysowane w skali ×1,4 kamery, widoczne tylko w przelotach */
  const fg=[];{const Rf=rng((W.seed||7)*31+5),S=10;const fx0=Math.floor(x0/S)*S,fy0=Math.floor(y0/S)*S,B=[];
    for(let gx=fx0;gx<x1+S;gx+=S)for(let gy=fy0;gy<y1+S;gy+=S){const cx=gx+Rf()*S*.6,cy=gy+Rf()*S*.6,w=1.3+Rf()*.9,d=1.3+Rf()*.9,h=1.4+Rf()*1.8;
      B.push({k:cx+cy,s:box(cx-w/2,cy-d/2,0,w,d,h,TH.fg[Math.floor(Rf()*TH.fg.length)])});}
    B.sort((a,b)=>a.k-b.k).forEach(o=>fg.push({p:P(o.s.c[0],o.s.c[1],0),svg:solidSvg(o.s)}));}
  return{ST,list,roads,zones,adj,svg,fg,theme:TH,bounds:[x0,y0,x1,y1]};}
/* punkt zaczepienia etykiety: nad stacją (frac=1 → szczyt) */
function anchorOf(s,frac){if(s.float)return[s.x,s.y,(s.kind==='sun'?(s.z==null?5.5:s.z)+.8:(s.z==null?3:s.z)+.1)*s.s*(frac>=1?1:1)];return[s.x,s.y,s.top*(frac==null?1:frac)];}
/* trasa po grafie (BFS) → łamana 3D; końce przycięte do krawędzi placów */
function route(Wd,a,b){if(a===b)return null;const prev={[a]:null},q=[a];while(q.length){const u=q.shift();if(u===b)break;for(const e of Wd.adj[u]||[])if(!(e.to in prev)){prev[e.to]={u,r:e.r};q.push(e.to);}}
  if(!(b in prev))return null;const ids=[];let c=b;while(c!=null){ids.unshift(c);c=prev[c]?prev[c].u:null;}
  const pts=[];for(let i=0;i<ids.length;i++){const s=Wd.ST[ids[i]];const beamIn=i>0&&prev[ids[i]].r.style==='beam',beamOut=i<ids.length-1&&prev[ids[i+1]].r.style==='beam';
    if(s.float||beamIn||beamOut){pts.push(anchorOf(s,s.float?1:.6));}else pts.push([s.x,s.y,.22]);}
  const trim=(p,q,d)=>{const L=Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])||1;const k=Math.min(d/L,.45);return[p[0]+(q[0]-p[0])*k,p[1]+(q[1]-p[1])*k,p[2]+(q[2]-p[2])*k];};
  const sA=Wd.ST[ids[0]],sB=Wd.ST[ids[ids.length-1]];
  if(!sA.float&&pts[0][2]<.3)pts[0]=trim(pts[0],pts[1],1.25*sA.s);const n=pts.length-1;if(!sB.float&&pts[n][2]<.3)pts[n]=trim(pts[n],pts[n-1],1.25*sB.s);
  const L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]));
  return{pts,L,len:L[L.length-1],ids};}
function routeVia(Wd,ids,untrim){let out=null;const ends=[];for(let i=1;i<ids.length;i++){const r=route(Wd,ids[i-1],ids[i]);if(!r)return null;
    if(untrim){[[0,ids[i-1]],[r.pts.length-1,ids[i]]].filter(([k],q)=>untrim===true||(untrim==='from'&&i===1&&q===0)||(untrim==='to'&&i===ids.length-1&&q===1)).forEach(([k,id])=>{const s=Wd.ST[id];if(!s.float)r.pts[k]=[s.x,s.y,.22];});}
    if(!out){out={pts:r.pts.slice(),ids:r.ids.slice()};}else{out.pts.push(...r.pts);out.ids.push(...r.ids.slice(1));}ends.push(out.pts.length-1);}
  if(!out)return null;const L=[0];for(let i=1;i<out.pts.length;i++){const a=out.pts[i-1],b=out.pts[i];L.push(L[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]));}out.L=L;out.len=L[L.length-1];
  out.legEnd=ends.map(k=>L[k]);out.legIds=ids.slice(1);return out;}
/* łamana przez środki stacji (bez przycinania do placów) — pas „klamry” wzdłuż drogi w podsumowaniu */
function centerPath(Wd,a,b){const r=route(Wd,a,b);if(!r)return null;const pts=r.ids.map(id=>{const s=Wd.ST[id];return[s.x,s.y,0];});const L=[0];
  for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));return{pts,L,len:L[L.length-1],ids:r.ids};}
function along(R,u){const d=sat(u)*R.len;let i=1;while(i<R.L.length-1&&R.L[i]<d)i++;const a=R.pts[i-1],b=R.pts[i],seg=(R.L[i]-R.L[i-1])||1,k=(d-R.L[i-1])/seg;return[lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k)];}
/* tunel: pierścienie wokół trasy */
function tunnelGeo(Rt,color){const rings=[];const r=.52;const A0=Rt.pts[0],Z0=Rt.pts[Rt.pts.length-1];for(let i=1;i<Rt.pts.length;i++){const a=Rt.pts[i-1],b=Rt.pts[i];const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;
    const sx=-dy/L,sy=dx/L;const n=Math.max(2,Math.round(L/.62));for(let j=0;j<n;j++){if(i>1&&j===0)continue;const k=j/(n-1);const c=[lerp(a[0],b[0],k),lerp(a[1],b[1],k),r+.04];
      if(Math.hypot(c[0]-A0[0],c[1]-A0[1])<.45||Math.hypot(c[0]-Z0[0],c[1]-Z0[1])<.45)continue;
      const pts=[];for(let q=0;q<18;q++){const t=q/18*Math.PI*2;pts.push(P(c[0]+sx*r*Math.cos(t),c[1]+sy*r*Math.cos(t),c[2]+r*Math.sin(t)));}rings.push({pts,seg:i});}}
  return{rings,color:color||'#2E9E6B'};}

/* ============================================================ 5. OŚ CZASU
   Narracja → słowa z szacowanym czasem (zastępowanym na żywo przez granice słów z lektora).
   Zapis {ATP|a te pe} = na ekranie „ATP”, lektor czyta „a te pe”. Akcje: on (słowo) | w (indeks słowa) | t (s od początku sceny). */
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9]+/g,'');
/* narracja na ekranie bez znaczników lektora: [excited], [laughs softly]… należą tylko do pola tts */
function parseSay(say){const out=[];const re=/\{([^}|]*)\|([^}]*)\}(\S*)|(\S+)/g;let m;const src=String(say||'').replace(/\[[^\]]*\]/g,' ');
  while((m=re.exec(src))){if(m[4]!=null)out.push({d:m[4],s:m[4]});else out.push({d:m[1]+m[3],s:m[2]+m[3]});}return out;}
function wordDur(w,rate){const sp=w.s;const letters=(sp.match(/[\p{L}]/gu)||[]).length+(sp.match(/\d/g)||[]).length*3.2;let d=Math.max(.2,.09+.053*letters);
  const e=w.d.slice(-1);const pause=/[.!?…]/.test(e)?.36:/[,;]/.test(e)?.17:/[:—–]/.test(e)?.24:0;return{d:d/rate,pause:pause/rate};}
/* sylaby (do proporcji czasu): liczby czytane słownie są długie — rok to ~12 sylab */
function sylls(s){const n=norm(s);if(/\d/.test(n))return(n.match(/\d/g)||[]).length*3+(/%/.test(s)?2:0);return Math.max(1,(n.match(/[aeiouy]+/g)||[]).length);}
function lev(a,b){if(a===b)return 0;const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let p=new Array(n+1),q=new Array(n+1);for(let j=0;j<=n;j++)p[j]=j;
  for(let i=1;i<=m;i++){q[0]=i;for(let j=1;j<=n;j++)q[j]=Math.min(p[j]+1,q[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));[p,q]=[q,p];}return p[n];}
/* ---- nagranie lektora (ElevenLabs) → czasy słów ----
   doc.words = [{w, start, end, tag?}] (transkrypcja nagrania). Napisy (say) dopasowujemy do transkrypcji globalnym wyrównaniem
   sekwencji (Needleman–Wunsch, podobieństwo = 1 − Levenshtein/długość). Słowa bez pary (liczby czytane słownie, skróty) dostają
   czas niedopasowanych słów transkrypcji między sąsiadami albo przerwy między nimi, proporcjonalnie do sylab. */
function alignAudio(scenes,doc){
  const tw=(doc.words||[]).filter(x=>x&&!x.tag&&!/^\[|\]$/.test(String(x.w))).map(x=>({raw:String(x.w),n:norm(x.w),s:+x.start,e:+x.end})).filter(x=>x.n&&isFinite(x.s)&&isFinite(x.e)&&x.e>=x.s);
  let fixed=0; // wyrównanie TTS bywa złe przy liczbach: „1788” dostaje 0,2 s, a następne słowo połyka resztę roku
  for(let i=0;i<tw.length-1;i++){const a=tw[i],b=tw[i+1];if(!/\d/.test(a.n)||/[.!?…:;]$/.test(a.raw))continue;const Ea=sylls(a.raw)*.16,Eb=sylls(b.raw)*.16;
    if(a.e-a.s<.8*Ea&&b.e-b.s>1.8*Eb){const cut=a.s+(b.e-a.s)*Ea/(Ea+Eb);a.e=cut-.02;b.s=cut;fixed++;}}
  const words=[];scenes.forEach(S=>S.words.forEach(w=>{w._m=[];words.push(w);}));
  const cap=[];words.forEach((w,wi)=>String(w.s).split(/\s+/).forEach(p=>{const n=norm(p);if(n)cap.push({wi,n});}));
  const N=cap.length,M=tw.length,W=M+1,H=new Float64Array((N+1)*W),B=new Uint8Array((N+1)*W),GAP=-.45;
  const sim=(a,b)=>a===b?1:1-lev(a,b)/Math.max(a.length,b.length);
  for(let i=1;i<=N;i++){H[i*W]=i*GAP;B[i*W]=1;}for(let k=1;k<=M;k++){H[k]=k*GAP;B[k]=2;}
  for(let i=1;i<=N;i++)for(let k=1;k<=M;k++){const s=sim(cap[i-1].n,tw[k-1].n),d=H[(i-1)*W+k-1]+(s>=.6?1+s:-1),u=H[(i-1)*W+k]+GAP,l=H[i*W+k-1]+GAP;
    if(d>=u&&d>=l){H[i*W+k]=d;B[i*W+k]=0;}else if(u>=l){H[i*W+k]=u;B[i*W+k]=1;}else{H[i*W+k]=l;B[i*W+k]=2;}}
  let i=N,k=M,matched=0;while(i>0||k>0){const b=i>0&&k>0?B[i*W+k]:(i>0?1:2);
    if(b===0){if(sim(cap[i-1].n,tw[k-1].n)>=.6){words[cap[i-1].wi]._m.push(k-1);matched++;}i--;k--;}else if(b===1)i--;else k--;}
  words.forEach(w=>{if(w._m.length){w.t0=Math.min(...w._m.map(k=>tw[k].s));w.t1=Math.max(...w._m.map(k=>tw[k].e));w.k0=Math.min(...w._m);w.k1=Math.max(...w._m);}});
  for(let a=0;a<words.length;a++){if(words[a]._m.length)continue;let b=a;while(b+1<words.length&&!words[b+1]._m.length)b++;
    const pv=words[a-1],nx=words[b+1];const kA=pv?pv.k1+1:0,kB=nx?nx.k0-1:M-1;let s,e;
    if(kA<=kB&&M){s=tw[kA].s;e=tw[kB].e;}else{s=pv?pv.t1:0;e=nx?nx.t0:s+.4*(b-a+1);}
    if(e-s<.12*(b-a+1))e=s+.12*(b-a+1);const run=words.slice(a,b+1),tot=run.reduce((x,w)=>x+sylls(w.s),0)||1;let c=s;
    run.forEach(w=>{const d=(e-s)*sylls(w.s)/tot;w.t0=c;w.t1=c+d*.92;c+=d;w.k0=kA;w.k1=kB;});a=b;}
  words.forEach(w=>{delete w._m;});
  return{matched,tokens:N,transcript:M,fixed};}
/* słowa-uderzenia w napisach: WIELKIE LITERY w tts (akcent lektora) albo „!” na końcu słowa w napisie. Skróty pisane wielkimi
   także w napisie (USA, ATP, XIX) nie są uderzeniem. tts dopasowujemy do napisów po kolei (okno 4 słów), bo wymowa bywa inna („Russo”). */
const isCaps=x=>{const L=String(x).replace(/[^\p{L}]/gu,'');return L.length>=2&&L===L.toUpperCase()&&L!==L.toLowerCase();};
function markPower(S){const tts=String(S.src.tts||'').replace(/\[[^\]]*\]/g,' ').split(/\s+/).filter(Boolean).map(x=>({n:norm(x),caps:isCaps(x)}));let p=0;
  S.words.forEach(w=>{const sp=String(w.s).split(/\s+/).filter(Boolean),n=norm(sp[0]);let hit=-1;for(let k=p;k<Math.min(tts.length,p+6);k++)if(tts[k].n===n){hit=k;break;}
    w.pw=false;if(hit>=0){w.pw=tts[hit].caps&&!isCaps(w.d);p=hit+sp.length;}if(/!$/.test(w.d))w.pw=true;});}
/* napisy: kawałki 1–3 słów (rytm rolki), łamane po interpunkcji i na pauzach lektora */
const SHORTW=/^(w|z|i|a|o|u|że|do|na|po|od|za|ze|we|to)$/i; // nie zostawiamy ich na końcu kawałka („czemu to w / ogóle”)
function chunkWords(words){const ch=[];let cur=[],len=0;const flush=()=>{if(cur.length)ch.push(cur);cur=[];len=0;};
  words.forEach((w,j)=>{const L=w.d.length;
    if(w.pw){flush();ch.push([j]);return;} // słowo-uderzenie idzie samo
    if(cur.length&&(cur.length>=3||len+L>16||w.t0-words[j-1].t1>.45)){const last=cur[cur.length-1];
      if(cur.length>1&&SHORTW.test(words[last].d)&&w.t0-words[last].t1<.45){cur.pop();flush();cur=[last];len=words[last].d.length+1;}else flush();}
    cur.push(j);len+=L+1;if(/[.!?…:;,—]$/.test(w.d))flush();});flush();return ch;}
const DEF_END={label:'scene',card:'scene',highlight:'scene',packet:'scene',cutaway:'scene',strike:'keep',tunnel:'keep',chapter:'chapter',fox:'dur',cam:'scene',impact:'scene',
  prop:'keep',state:'keep',burst:'burst',tone:'scene',tint:'scene',badge:'scene',recap:'scene'};
/* słowo w scenie: „on” = początek słowa (bez ogonków i wielkości liter); „sześć#2” = drugie wystąpienie */
function findWord(S,on){let s=String(on==null?'':on),nth=1;const m=/#(\d+)$/.exec(s);if(m){nth=+m[1];s=s.slice(0,m.index);}const n=norm(s);if(!n)return -1;
  let c=0;for(let j=0;j<S.words.length;j++)if(norm(S.words[j].d).startsWith(n)&&++c===nth)return j;return -1;}
function wordT(S,on,fb){const j=findWord(S,on);if(j<0){console.warn('[rolka] nie ma słowa',on,'w scenie',S.i);return fb;}return S.words[j].t0;}
/* czas pod-elementu (linijka karty, wiersz telefonu, klocek, krok przybliżenia): {on} albo {w}; brak = null */
function subT(S,x,WT){if(!x||typeof x!=='object')return null;if(x.on!=null)return(WT||wordT)(S,x.on,null);if(x.w!=null&&S.words[x.w])return S.words[x.w].t0;return null;}
/* odwołanie do słowa z innej sceny: "Dzięki@+1" = słowo „Dzięki” w następnej scenie (np. bateria parkuje do sceny 6, plakietka zapala się na „Jeden”) */
function refScene(scenes,S,ref){const s=String(ref==null?'':ref),m=/@([+-]?\d+)$/.exec(s);if(!m)return{S,w:s};return{S:scenes[clamp(S.i+(+m[1]),0,scenes.length-1)],w:s.slice(0,m.index)};}
function compile(sb,Wd,aud){
  const scenes=[];let t=0;const rate=clamp(+sb.rate||1,.5,2);
  (sb.scenes||[]).forEach((sc,i)=>{const words=parseSay(sc.say);const S={i,src:sc,words,start:t};let c=t+(i===0?.45:.2);
    words.forEach(w=>{const{d,pause}=wordDur(w,rate);w.t0=c;w.t1=c+d;c+=d+pause;w.pause=pause;});
    S.speechEnd=c;S.end=c+.3+(+sc.hold||0);
    // tekst dla lektora przeglądarki + mapowanie znaków na słowa
    let txt='';S.charAt=[];words.forEach((w,j)=>{S.charAt.push(txt.length);txt+=(j?' ':'')+w.s;if(j)S.charAt[j]+=1;});S.speak=txt;
    scenes.push(S);t=S.end;});
  let align=null;
  if(aud&&scenes.some(S=>S.words.length)){align=alignAudio(scenes,aud);const dur=+aud.duration||0;const n=scenes.length;
    // scena zaczyna się z pierwszym słowem (z małym wyprzedzeniem, żeby kamera ruszała na akcent), kończy z początkiem następnej
    scenes.forEach((S,i)=>{S.speechEnd=S.words.length?S.words[S.words.length-1].t1:null;});
    scenes.forEach((S,i)=>{if(i===0){S.start=0;return;}const pe=scenes[i-1].speechEnd!=null?scenes[i-1].speechEnd:scenes[i-1].start;
      const f=S.words.length?S.words[0].t0:pe+.3;S.start=Math.max(scenes[i-1].start+.2,f-Math.min(.12,Math.max(0,(f-pe)*.6)));if(S.speechEnd==null)S.speechEnd=S.start;});
    scenes.forEach((S,i)=>{S.end=i<n-1?scenes[i+1].start:Math.max(S.speechEnd+.3,dur)+(+S.src.hold||0);});
    t=scenes[n-1].end;}
  scenes.forEach(S=>{markPower(S);S.chunks=chunkWords(S.words);});
  const T=t;
  const WT=(S,ref,fb)=>{const r=refScene(scenes,S,ref);return wordT(r.S,r.w,fb);}; // słowo, także "słowo@+1" (następna scena)
  // akcje
  const acts=[];let chapters=[];
  scenes.forEach(S=>{(S.src.actions||[]).forEach((a0,k)=>{const a=Object.assign({},a0);a.scene=S.i;a.key=S.i+'_'+k;
    let t0=S.start+.55;if(a.t!=null)t0=S.start+(+a.t);else if(a.w!=null&&S.words[a.w])t0=S.words[a.w].t0;else if(a.on!=null)t0=WT(S,a.on,t0);
    a.t0=t0;const kind=DEF_END[a.type]||'scene';
    if(a.dur!=null)a.t1=t0+(+a.dur);else if(a.keep)a.t1=1e9;else if(a.scenes)a.t1=scenes[Math.min(scenes.length-1,S.i+(+a.scenes)-1)].end;
    else if(kind==='keep')a.t1=1e9;else if(kind==='dur')a.t1=t0+3.4;else if(kind==='burst')a.t1=t0+.9;else a.t1=S.end;
    if(a.off!=null)a.t1=WT(S,a.off,a.t1); // koniec na słowo (np. przerywnik znika na „Ups.”)
    // pod-elementy na słowa: linijki karty, wiersze telefonu, klocki wzoru, kroki przybliżenia; licznik kropek kończy na słowie „land”
    if(a.lines)a.lineT=a.lines.map(l=>subT(S,l,WT));
    if(a.rows)a.rowT=a.rows.map(r=>subT(S,r,WT));
    if(a.steps)a.stepT=a.steps.map(r=>subT(S,r,WT));
    if(a.tiles){const raw=a.tiles.map(x=>x&&x.br?null:subT(S,x,WT));
      if(raw.some(v=>v!=null))a.tiles.forEach((x,i)=>{if(raw[i]!=null||(x&&x.br))return;let j=i+1;while(j<raw.length&&raw[j]==null)j++;if(j<raw.length)raw[i]=raw[j]-.1;else{j=i-1;while(j>=0&&raw[j]==null)j--;raw[i]=j>=0?raw[j]+.1:null;}});
      a.tileT=raw;}
    if(a.land!=null)a.landT=WT(S,a.land,null);
    if(a.lit!=null)a.litT=WT(S,a.lit,null);          // plakietka: zapala się na słowo (np. „Jeden@+1”)
    if(a.charge!=null)a.chargeT=WT(S,a.charge,null);  // bateria: ładuje się na słowo
    if(a.type==='packet'&&Array.isArray(a.path)&&a.path.length>1){const pts=a.path.map(p=>[+p[0]||0,+p[1]||0,p[2]==null?.22:+p[2]]),L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]));
      a.R={pts,L,len:L[L.length-1],ids:[],legEnd:[],legIds:[]};} // paczka po własnej łamanej w świecie (np. tłum biegnie pod bramę)
    else if(a.type==='packet'||a.type==='tunnel'){a.R=routeVia(Wd,[a.from].concat(a.via||[],[a.to]),a.untrim);if(!a.R)console.warn('[rolka] brak drogi',a.from,'→',a.to);}
    /* paczka w dwóch odcinkach: jedzie do "stop" (stacja z via albo ułamek trasy), czeka do słowa "go", jedzie dalej.
       "arrive": słowo, na które paczka ma DOJECHAĆ (do stop albo do końca) — start liczony wstecz. "morph": w punkcie stop zmienia tekst/kolor (z błyskiem). */
    if(a.type==='packet'&&a.R){const spd=+a.speed||4.2;
      if(a.stop!=null){const k=a.R.legIds.indexOf(a.stop);a.stopD=typeof a.stop==='number'?clamp(a.stop,0,1)*a.R.len:(k>=0?a.R.legEnd[k]:a.R.len*.5);}
      const L1=a.stopD!=null?a.stopD:a.R.len;a.d1=a.dur!=null&&a.stopD==null?+a.dur:(a.d1!=null?+a.d1:Math.max(a.stopD!=null?.5:1.4,L1/spd));
      if(a.arrive!=null){const r=WT(S,a.arrive,null);if(r!=null){const dt=r-a.d1-a.t0;a.t0+=dt;if(a.dur!=null&&a.off==null)a.t1+=dt;}}
      if(a.stopD!=null){a.arrT=a.t0+a.d1;a.goT=Math.max(a.arrT,a.go!=null?WT(S,a.go,a.arrT+.3):a.arrT+(+a.wait||.3));a.d2=a.d2!=null?+a.d2:Math.max(.5,(a.R.len-a.stopD)/spd);
        if(a.off==null&&!a.keep)a.t1=a.goT+a.d2+(a.drain?.6:.2);}
      if(a.hold&&a.loop===false&&a.off==null)a.t1=Math.max(a.t1,a.t0+a.d1*(1+((a.n||1)-1)*(a.gap||.2))+(+a.hold)+.2);}
    if(a.type==='tunnel'&&a.R)a.geo=tunnelGeo(a.R,a.color);
    if(a.type==='recap'){a.path=centerPath(Wd,a.from,a.to);if(!a.path)console.warn('[rolka] recap: brak drogi',a.from,'→',a.to);
      else a.stT=a.path.ids.map((id,i)=>a.t0+(a.delay==null?.35:+a.delay)+i*(a.step==null?.15:+a.step));}
    if((a.type==='strike'&&a.road)||a.type==='tint'){const rd=a.road;if(rd&&!Wd.roads.some(r=>(r.A.id===rd[0]&&r.B.id===rd[1])||(r.A.id===rd[1]&&r.B.id===rd[0])))console.warn('[rolka] nie ma drogi',rd);}
    acts.push(a);if(a.type==='chapter')chapters.push(a);});});
  chapters.sort((a,b)=>a.t0-b.t0);chapters.forEach((c,i)=>{c.t1=i<chapters.length-1?chapters[i+1].t0:T;});
  // kamera: klatki kluczowe = cam sceny (start sceny) + akcje "cam" (na słowo); przelot domyślnie 0,95 s (sb.camDur)
  const cd=sb.camDur==null?.95:clamp(+sb.camDur,.3,3);const keys=[];
  scenes.forEach(S=>{const src=S.src.cam;if(src==='keep'||(src&&src.keep))return;const C=camFor(src||{},Wd,cd,false);keys.push({t:S.start,dur:C.dur,C,ease:'io',scene:S.i});
    if(C.pan)keys.push({t:S.start+C.dur*.7,dur:Math.max(.5,S.end-S.start-C.dur*.7),C:C.pan,ease:'io'});});
  acts.filter(a=>a.type==='cam').forEach(a=>{const S=scenes[a.scene],C=camFor(a,Wd,cd,true),lead=a.lead==null?.12:+a.lead,dur=Math.max(.04,a.dur==null?.5:+a.dur);
    keys.push({t:Math.max(a.t0-lead,S.start+.001),dur,C,ease:a.ease||'io',punch:!!a.punch,act:a,cut:dur<.12});});
  keys.sort((a,b)=>a.t-b.t);if(!keys.length)keys.push({t:0,dur:.01,C:camFor({},Wd,cd,false),ease:'io'});keys[0].t=Math.min(keys[0].t,0);
  prepCam(keys);
  /* etykieta albo karta przy stacji schodzi, gdy kamera rusza w inne miejsce (nie przy samym najeździe na tę samą stację); "stay": true wyłącza */
  acts.filter(a=>(a.type==='label'||a.type==='card')&&a.at!=null&&!a.stay&&!a.keep).forEach(a=>{const k=keys.find(k=>k.t>a.t0+.15&&k.t<a.t1&&k.dist>60);if(k)a.t1=k.t;});
  /* najwyżej 2 etykiety świata naraz (etykiety + karty przy stacjach): nowa wypycha najstarszą, chyba że ta ma keep */
  const maxOv=sb.maxLabels==null?2:Math.max(1,+sb.maxLabels|0);
  const ovl=acts.filter(a=>a.type==='label'||(a.type==='card'&&a.at!=null)).sort((a,b)=>a.t0-b.t0);
  ovl.forEach((o,i)=>{const on=ovl.slice(0,i).filter(p=>p.t1>o.t0+.05);let need=on.length-maxOv+1;
    on.filter(p=>!p.keep&&p.t1<1e8).forEach(p=>{if(need-->0)p.t1=Math.max(p.t0+.4,o.t0);});});
  const punches=keys.filter(k=>k.punch).map(k=>({t:k.t+k.dur,flash:k.act.flash!==false})).concat(acts.filter(a=>a.type==='impact').map(a=>({t:a.t0,flash:a.flash!==false})));
  const TL={scenes,acts,T,camKeys:keys,punches,align};TL.sfx=sfxEvents(TL);return TL;}
/* cel kamery: id stacji, lista id, [x,y(,z)] albo "all"; w akcji "cam" brak to/zoom/y = zostaje jak było */
function camFor(c,Wd,cd,isAct){const to=c.to==null?(isAct?null:'all'):c.to;let pts=[],st=null;
  const stPts=s=>{const a=P(s.x,s.y,0),b=P(...anchorOf(s,1));return[a,b];};
  if(to==null){}
  else if(to==='all')Wd.list.forEach(s=>pts.push(...stPts(s)));
  else if(Array.isArray(to)&&typeof to[0]==='string')to.forEach(id=>{const s=Wd.ST[id];if(s)pts.push(...stPts(s));});
  else if(Array.isArray(to))pts.push(P(+to[0],+to[1],+(to[2]||0)));
  else{const s=Wd.ST[to];if(s){st=s.id;const a=anchorOf(s,1);const z=s.float?a[2]-.6:Math.min(a[2]*.45,1.4);pts.push(P(s.x,s.y,z));}else pts.push([0,0]);}
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;pts.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);});
  const fit=c.zoom==='fit';let zoom=fit?null:c.zoom;if(zoom==null&&(!isAct||fit)){if(pts.length>1){zoom=Math.min((SW-80)/Math.max(1,x1-x0+110),(SH*.5)/Math.max(1,y1-y0+110));}else zoom=1.3;}
  if(zoom!=null)zoom=clamp(+zoom,.22,3.2);
  const C={x:pts.length?(x0+x1)/2+(+c.dx||0):0,y:pts.length?(y0+y1)/2+(+c.dy||0):0,zoom,fy:c.y==null?(isAct?null:.43):+c.y,dur:c.dur==null?(cd||1.5):+c.dur,st,keepPos:!pts.length};
  if(c.pan){const p=camFor(Object.assign({zoom:c.pan.zoom==null?zoom:c.pan.zoom,y:C.fy},c.pan),Wd,cd,false);C.pan=p;}
  return C;}
const EASE={io:eio,out:eout,lin:sat,linear:sat,in:k=>{k=sat(k);return k*k*k;}};
/* stan po klatce kluczowej k w chwili t: przejście from→to (przy długich przelotach lekkie oddalenie), potem powolny najazd */
function evalKey(k,t){const u=sat((t-k.t)/k.dur),e=(own(EASE,k.ease)?EASE[k.ease]:eio)(u),f=k.from,o=k.to;const dip=1-.32*Math.sin(Math.PI*e)*sat(k.dist/700);
  let z=Math.exp(lerp(Math.log(f.z),Math.log(o.z),e))*dip;const hold=t-(k.t+k.dur);if(hold>0)z*=1+.035*sat(hold/4);
  return{x:lerp(f.x,o.x,e),y:lerp(f.y,o.y,e),z,fy:lerp(f.fy,o.fy,e)};}
function prepCam(K){let st=null;K.forEach((k,j)=>{const C=k.C;
  if(j===0){k.to={x:C.x,y:C.y,z:C.zoom==null?1.3:C.zoom,fy:C.fy==null?.43:C.fy};k.from=k.to;k.dist=0;}
  else{const f=evalKey(K[j-1],k.t);k.from=f;k.to={x:C.keepPos?f.x:C.x,y:C.keepPos?f.y:C.y,z:C.zoom==null?f.z:C.zoom,fy:C.fy==null?f.fy:C.fy};k.dist=Math.hypot(k.to.x-f.x,k.to.y-f.y);}
  if(C.st)st=C.st;else if(!C.keepPos)st=null;k.st=st;});}
/* kamera w chwili t: klatki kluczowe + „uderzenia” (punch: szybki najazd o ~9% i drgnięcie 6 px) + delikatny dryf */
function keyAt(K,t){let j=0;for(let i=1;i<K.length;i++){if(K[i].t<=t)j=i;else break;}return j;}
function camBase(TL,t){return evalKey(TL.camKeys[keyAt(TL.camKeys,t)],t);}
function camAt(TL,t){const K=TL.camKeys,j=keyAt(K,t),s=evalKey(K[j],t);
  let z=s.z,sx=0,sy=0;for(const p of TL.punches){const u=t-p.t;if(u<0||u>.7)continue;const pulse=u<.06?eout(u/.06):Math.exp(-(u-.06)*11);z*=1+.09*pulse;
    const amp=6*Math.exp(-u*8);sx+=amp*Math.sin(u*97);sy+=amp*.75*Math.cos(u*83);}
  const dx=Math.sin(t*.41+.6)*7+Math.sin(t*.17)*5+sx,dy=Math.sin(t*.33+2.1)*5+sy;
  return{x:s.x+dx/z,y:s.y+dy/z,z,fy:s.fy,st:K[j].st};}
function flashAt(TL,t){let v=0;for(const p of TL.punches){if(!p.flash)continue;const u=t-p.t;if(u<0||u>.3)continue;v=Math.max(v,u<.04?.62:.62*Math.exp(-(u-.04)*26));}return v;}

/* ============================================================ 7. LIS — przewodnik
   Kształty z maskotki apki (engine.js → fox()), ale ruch liczony z zegara rolki (deterministycznie), nie z CSS.
   Gesty: point (wskazuje), shrug (wzrusza ramionami), thumbs (kciuk w górę), celebrate (radość), wave (macha), think (myśli). */
const FXC={o:'#FF7A2F',d:'#B8431A',k:'#7A2A10',c:'#FFF1E6',ink:'#0E0C1C',g:'#B4FF3A'};
function foxSvg(){const arm=(id,x)=>`<g id="${id}"><rect x="${x+2}" y="118" width="13" height="34" rx="6.5" fill="${FXC.d}"/><rect x="${x}" y="116" width="13" height="34" rx="6.5" fill="${FXC.o}"/><ellipse cx="${x+6.5}" cy="148" rx="7.5" ry="5" fill="${FXC.k}"/>
  <g class="thumb" display="none"><rect x="${x+3}" y="150" width="7" height="13" rx="3.5" fill="${FXC.k}"/></g></g>`;
  const star=(x,y,r)=>`<path d="M${x} ${y-r}L${x+r*.28} ${y-r*.28}L${x+r} ${y}L${x+r*.28} ${y+r*.28}L${x} ${y+r}L${x-r*.28} ${y+r*.28}L${x-r} ${y}L${x-r*.28} ${y-r*.28}Z"/>`;
  return `<svg viewBox="0 0 160 170" width="160" height="170" aria-hidden="true">
<ellipse id="fGround" cx="80" cy="162" rx="42" ry="5" fill="#3A3226" opacity=".22"/>
<g id="fAll"><g id="fSway">
<g id="fTail"><path d="M100 152 C132 162 156 136 148 106 C144 90 128 88 124 98 C134 112 126 132 102 134 Z" transform="translate(0 4)" fill="${FXC.d}"/><path d="M100 152 C132 162 156 136 148 106 C144 90 128 88 124 98 C134 112 126 132 102 134 Z" fill="${FXC.o}"/><path d="M148 106 C144 90 128 88 124 98 C132 100 140 102 148 106 Z" fill="${FXC.c}"/></g>
<path d="M50 158 Q46 116 80 106 Q114 116 110 158 Z" transform="translate(0 4)" fill="${FXC.d}"/>
<path d="M50 158 Q46 116 80 106 Q114 116 110 158 Z" fill="${FXC.o}"/>
<path d="M64 158 Q62 128 80 120 Q98 128 96 158 Z" fill="${FXC.c}"/>
<ellipse cx="68" cy="158" rx="10" ry="5" fill="${FXC.k}"/><ellipse cx="92" cy="158" rx="10" ry="5" fill="${FXC.k}"/>
<g transform="translate(80 72) scale(.82)"><g id="fHead">
<g id="fEarL"><polygon points="-44,-16 -32,-64 -8,-34" fill="${FXC.o}"/><polygon points="-36,-25 -31,-50 -17,-33" fill="${FXC.k}"/></g>
<g id="fEarR"><polygon points="44,-16 32,-64 8,-34" fill="${FXC.o}"/><polygon points="36,-25 31,-50 17,-33" fill="${FXC.k}"/></g>
<path d="M-52 -12 Q-48 -42 0 -42 Q48 -42 52 -12 L22 30 Q0 44 -22 30 Z" transform="translate(0 6)" fill="${FXC.d}"/>
<path d="M-52 -12 Q-48 -42 0 -42 Q48 -42 52 -12 L22 30 Q0 44 -22 30 Z" fill="${FXC.o}"/>
<path d="M-52 -12 Q-30 -8 -12 10 L0 30 L12 10 Q30 -8 52 -12 L22 30 Q0 44 -22 30 Z" fill="${FXC.c}"/>
<path d="M-6 23 Q0 20 6 23 L0 29 Z" fill="${FXC.ink}"/>
<g id="fEyesO"><g id="fPup"><ellipse cx="-19" cy="-13" rx="4.5" ry="6" fill="${FXC.ink}"/><ellipse cx="19" cy="-13" rx="4.5" ry="6" fill="${FXC.ink}"/><circle cx="-17.5" cy="-15.5" r="1.6" fill="#fff"/><circle cx="20.5" cy="-15.5" r="1.6" fill="#fff"/></g></g>
<g id="fEyesH" display="none" fill="none" stroke="${FXC.ink}" stroke-width="3.5" stroke-linecap="round"><path d="M-25 -11 Q-19 -20 -13 -11"/><path d="M13 -11 Q19 -20 25 -11"/></g>
<g id="fEyesC" display="none" fill="none" stroke="${FXC.ink}" stroke-width="3.2" stroke-linecap="round"><path d="M-25 -13 Q-19 -8 -13 -13"/><path d="M13 -13 Q19 -8 25 -13"/></g>
<g id="fMouthI"><path d="M-5 32 Q-2.5 35 0 32 Q2.5 35 5 32" fill="none" stroke="${FXC.ink}" stroke-width="2" stroke-linecap="round"/></g>
<g id="fMouthO" display="none"><ellipse cx="0" cy="34" rx="4" ry="5" fill="${FXC.ink}"/></g>
<g id="fMouthG" display="none"><path d="M-8 30 Q0 42 8 30 Z" fill="${FXC.ink}"/><path d="M-4 35 Q0 39.5 4 35 Z" fill="#FF6B8B"/></g>
<g id="fMouthW" display="none"><path d="M-7.5 34 Q-5 31 -2.5 34 Q0 37 2.5 34 Q5 31 7.5 34" fill="none" stroke="${FXC.ink}" stroke-width="2" stroke-linecap="round"/></g>
<g fill="none" stroke="${FXC.g}" stroke-width="4"><circle cx="-19" cy="-13" r="13"/><circle cx="19" cy="-13" r="13"/><line x1="-6" y1="-14" x2="6" y2="-14"/></g>
<g id="fBrowQ" display="none" stroke="${FXC.k}" stroke-width="3.5" stroke-linecap="round"><line x1="-27" y1="-31" x2="-12" y2="-34"/><line x1="12" y1="-38" x2="27" y2="-33"/></g>
</g></g>
${arm('fArmL',47)}${arm('fArmR',100)}
</g></g>
<g id="fSpark" display="none" fill="${FXC.g}" stroke="#14210A" stroke-width="1.2">${star(18,40,9)}${star(142,26,7)}${star(148,80,6)}${star(10,94,5)}</g>
<g id="fDots" display="none" fill="#fff" stroke="#3B3846" stroke-width="2"><circle cx="122" cy="40" r="4"/><circle cx="134" cy="26" r="5.5"/><circle cx="150" cy="8" r="8"/></g>
</svg>`;}
/* poza w chwili u (s od początku gestu): zwraca kąty i stany części */
function foxPose(g,u,side,talk){const s=Math.sin,P0={hop:0,sway:s(u*1.9)*2.2,head:s(u*1.3)*3,armL:4+s(u*2)*3,armR:-4-s(u*2)*3,tail:s(u*3.2)*14,eyes:'o',mouth:'i',brow:0,thumb:0,spark:0,dots:0,look:0,earL:0,earR:0};
  const e=sstep(0,.35,u);const toward=side==='left'?1:-1; // wskazuje w stronę środka ekranu
  if(g==='point'){if(toward>0){P0.armR=lerp(P0.armR,-108+s(u*5)*4,e);}else{P0.armL=lerp(P0.armL,108+s(u*5)*4,e);}P0.head=lerp(P0.head,toward*9,e);P0.look=toward*3.5*e;}
  else if(g==='shrug'){const w=s(u*4.2)*7;P0.armL=lerp(P0.armL,58+w,e);P0.armR=lerp(P0.armR,-58-w,e);P0.head=lerp(P0.head,s(u*2.2)*10,e);P0.brow=1;P0.mouth='w';P0.hop=-Math.abs(s(u*4.2))*3*e;P0.earL=-10*e;P0.earR=10*e;}
  else if(g==='thumbs'){P0.armR=lerp(P0.armR,-150+s(u*4)*5,e);P0.thumb=u>.25?1:0;P0.eyes='h';P0.mouth='g';P0.hop=-Math.abs(s(u*3.4))*6*e;P0.head=lerp(P0.head,-6,e);}
  else if(g==='celebrate'){const w=s(u*11)*14;P0.armL=lerp(P0.armL,150+w,e);P0.armR=lerp(P0.armR,-150-w,e);P0.hop=-Math.abs(s(u*5.5))*22*e;P0.eyes='h';P0.mouth='g';P0.spark=e;P0.tail=s(u*14)*18;P0.head=s(u*11)*6;}
  else if(g==='wave'){P0.armR=lerp(P0.armR,-150+s(u*9)*16,e);P0.head=lerp(P0.head,8,e);P0.mouth='g';}
  else if(g==='think'){P0.armL=lerp(P0.armL,-128+s(u*3)*3,e);P0.head=lerp(P0.head,-10,e);P0.look=-3*e;P0.dots=e;P0.brow=1;}
  else if(g==='startle'){const j=u<.42?Math.sin(Math.PI*u/.42):u<.67?.22*Math.sin(Math.PI*(u-.42)/.25):0,a=sstep(0,.12,u);
    P0.hop=-30*j;P0.armL=lerp(P0.armL,128+s(u*16)*8*Math.exp(-u*3),a);P0.armR=lerp(P0.armR,-128-s(u*16)*8*Math.exp(-u*3),a);P0.sway=s(u*34)*4*Math.exp(-u*3);
    P0.mouth='o';P0.brow=1;P0.earL=9*a;P0.earR=-9*a;P0.tail=s(u*22)*24*Math.exp(-u*1.5);P0.head=s(u*18)*4*Math.exp(-u*3);}
  if(talk&&P0.mouth!=='g'&&P0.mouth!=='w')P0.mouth='o';
  return P0;}
/* lis w chwili t: która akcja, gest, strona, skala (big ≈ 200 px), skrzynka na ekranie — z tego liczy się też odsunięcie kamery */
function activeFox(t){let best=null;for(const a of R.TL.acts)if(a.type==='fox'&&t>=a.t0&&t<=a.t1+.25&&(!best||a.t0>best.t0))best=a;return best;}
function foxState(t){const quiz=R.quizAt!=null&&t>=R.quizAt;let a=activeFox(t),g,u,side='right',k=0,big=false,ex=0;
  if(quiz){const ans=R.answer;g=ans==null?'think':(ans===R.sb.quiz.c?'celebrate':'shrug');u=t-(ans==null?R.quizAt:R.answerAt);k=eback((t-R.quizAt-.25)/.45);}
  else if(a){g=a.pose||a.do||'point';u=t-a.t0;side=a.side||'right';if(t<=a.t1)k=eback(u/.45);else{ex=sat((t-a.t1)/.25);k=1-eio(ex);}big=a.size==='big';}
  if(ex>=1)return null;
  if(k<=.001&&!ex)return null;
  const sc=quiz?.94:big?1.25:.94,fw=160*sc,fh=170*sc;let x=side==='left'?6:SW-fw-6,y=SH-fh-176;
  if(quiz){const q=EL.qCard;y=(q?q.offsetTop:SH*.45)-fh+18;x=SW-fw-4;}
  return{a,g,u,side,k,quiz,big,sc,x,y,fw,fh,ex};}

/* ============================================================ 8. PRZERYWNIKI (cutaway) — pełnoekranowe wstawki: phone, dots, arc, tiles, calendar */
const ICON_OK='<svg viewBox="0 0 24 24" fill="none" stroke="#14210A" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function buildCut(a){const el=document.createElement('div');el.className='cut';el.style.display='none';const k=a.kind,dm=a.dim!=null?clamp(+a.dim,0,1):(k==='zoomin'?.97:null);let h=dm!=null?`<div class="dim" style="background:rgb(var(--gr) / ${dm})"></div>`:'<div class="dim"></div>';
  if(k==='phone'){h+=`<div class="phone"><div class="scr"><div class="notch"></div><div class="ph">${esc(a.app||'Cramfox')}</div><div class="pt">${esc(a.title||'')}</div>${a.sub?`<div class="psub">${esc(a.sub)}</div>`:''}
    ${(a.rows||[]).map((r,i)=>`<div class="row" data-i="${i}"><i>${ICON_OK}</i><span>${esc(typeof r==='string'?r:r.t)}</span></div>`).join('')}</div></div>`;}
  else if(k==='dots'){const tot=a.total||100,cols=10,rows=Math.ceil(tot/cols);let d='';for(let i=0;i<tot;i++){const x=i%cols,y=Math.floor(i/cols);d+=`<circle data-i="${i}" cx="${16+x*31}" cy="${16+y*24}" r="9"/>`;}
    h+=`<div class="panel"><div class="ph">${esc(a.head||'')}</div><div class="big"><span class="cnt">0</span><small>${esc(a.unit||'%')}</small></div><div class="note" style="margin:6px 0 14px">${esc(a.label||'')}</div>
      <svg viewBox="0 0 310 ${rows*24+8}" class="dg">${d}</svg>${a.note?`<div class="note">${esc(a.note)}</div>`:''}</div>`;}
  else if(k==='arc'){const A=a.from||{},B=a.to||{};const ax=A.x==null?.78:A.x,ay=A.y==null?.62:A.y,bx=B.x==null?.2:B.x,by=B.y==null?.66:B.y;const W=390,Hh=520;
    const blob=(cx,cy,r,seed)=>{const R=rng(seed),pt=[];for(let i=0;i<16;i++){const t=i/16*Math.PI*2,rr=r*(.78+R()*.34);pt.push([cx+Math.cos(t)*rr*1.3,cy+Math.sin(t)*rr*.86]);}
      const m=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];let p='M'+m(pt[15],pt[0]).map(f1).join(' ');pt.forEach((q,i)=>{const n=m(q,pt[(i+1)%16]);p+=`Q${f1(q[0])} ${f1(q[1])} ${f1(n[0])} ${f1(n[1])}`;});
      return `<path d="${p}Z" fill="#DCD2BC" stroke="#C7BA9F" stroke-width="2.5"/>`;};
    const p1=[ax*W,ay*Hh+160],p2=[bx*W,by*Hh+160],mid=[(p1[0]+p2[0])/2,Math.min(p1[1],p2[1])-150];
    h+=`<div class="map"><svg viewBox="0 0 390 844" style="position:absolute;inset:0;width:100%;height:100%"><rect x="0" y="0" width="390" height="844" fill="#E4ECEE"/>${[0,1,2,3,4,5,6].map(i=>`<path d="M0 ${200+i*90} Q195 ${170+i*90} 390 ${200+i*90}" fill="none" stroke="#D3DFE3" stroke-width="1.5"/>`).join('')}
      ${blob(p1[0]+10,p1[1]+20,70,3)}${blob(p2[0]-10,p2[1]+30,95,8)}${(a.extra||[]).map((e,i)=>blob(e.x*W,e.y*Hh+160,e.r||50,20+i)).join('')}
      <path class="arcp" d="M${f1(p1[0])} ${f1(p1[1])} Q${f1(mid[0])} ${f1(mid[1])} ${f1(p2[0])} ${f1(p2[1])}" fill="none" stroke="${a.color||'#2F6BFF'}" stroke-width="4" stroke-linecap="round"/>
      <g class="coins"></g>
      <circle cx="${f1(p1[0])}" cy="${f1(p1[1])}" r="10" fill="${a.color||'#2F6BFF'}" stroke="#fff" stroke-width="3"/><circle cx="${f1(p2[0])}" cy="${f1(p2[1])}" r="10" fill="#1F8A5B" stroke="#fff" stroke-width="3"/></svg>
      <div class="lbl" style="transform:translate(${f1(p1[0]-30)}px,${f1(p1[1]+22)}px)">${esc(A.label||'')}</div><div class="lbl" style="transform:translate(${f1(p2[0]-40)}px,${f1(p2[1]+22)}px)">${esc(B.label||'')}</div>
      <div class="map-h">${esc(a.title||'')}</div></div>`;a._arc={p1,p2,mid};}
  else if(k==='tiles'){h+=`<div class="tiles-h">${esc(a.title||'')}</div><div class="tiles">${(a.tiles||[]).map((x,i)=>x.br?'<div class="tbr"></div>':x.op?`<div class="tile op" data-i="${i}"><div class="blk">${esc(x.op)}</div>${x.c?`<div class="tc op">${esc(x.c)}</div>`:''}</div>`:`<div class="tile" data-i="${i}"><div class="blk">${x.k?`<span class="k">${esc(x.k)}</span>`:''}${esc(x.t)}</div>${x.c?`<div class="tc">${esc(x.c)}</div>`:''}</div>`).join('')}</div>${a.note?`<div class="tiles-n">${esc(a.note)}</div>`:''}`;}
  else if(k==='calendar'){h+=`<div class="panel" style="top:170px;text-align:center"><div class="ph">${esc(a.head||'Data')}</div><div class="big" style="font-size:54px">${esc(a.date||'')}</div><div class="note" style="font-size:18px">${esc(a.text||'')}</div></div>`;}
  else if(k==='zoomin'){const S=a.steps||[];
    h+=`<div class="crumbs">${S.map((s,i)=>`<span data-i="${i}">${esc(s.label||'')}</span>`).join('<i>›</i>')}</div>`+
      S.map((s,i)=>`<div class="zstep" data-i="${i}"><svg viewBox="0 0 300 300">${own(ZICON,s.icon)?ZICON[s.icon]:ZICON.cell}</svg></div><div class="zlab" data-i="${i}">${esc(s.label||'')}</div>`).join('');}
  el.innerHTML=h;return el;}
/* ikony przybliżenia (płaskie, w barwach świata): drzewo → liść → komórka → chloroplast; f = punkt, w który „wjeżdża” kamera (0–1) */
const ZF={tree:[.69,.3],leaf:[.6,.47],cell:[.73,.29],chloroplast:[.5,.5]};
const ZMARK=(x,y,s)=>`<rect x="${x-s/2}" y="${y-s/2}" width="${s}" height="${s}" rx="6" fill="none" stroke="#17151F" stroke-width="6"/><rect x="${x-s/2}" y="${y-s/2}" width="${s}" height="${s}" rx="6" fill="none" stroke="#B4FF3A" stroke-width="3.2"/>`;
const ZICON={
  tree:`<ellipse cx="150" cy="272" rx="84" ry="12" fill="#3A3226" opacity=".14"/><rect x="138" y="176" width="24" height="96" rx="7" fill="#7D6B56"/>
    <circle cx="104" cy="156" r="52" fill="#4F8C45"/><circle cx="198" cy="152" r="54" fill="#4F8C45"/><circle cx="150" cy="112" r="76" fill="#6CAB59"/><circle cx="126" cy="86" r="30" fill="#7DBA68"/>${ZMARK(207,90,30)}`,
  leaf:`<path d="M44 252 C52 132 150 52 266 40 C262 154 192 246 44 252 Z" fill="#6CAB59" stroke="#4F8C45" stroke-width="5" stroke-linejoin="round"/>
    <path d="M44 252 Q148 160 266 40" fill="none" stroke="#4F8C45" stroke-width="5" stroke-linecap="round"/><path d="M28 272 L46 250" stroke="#4F8C45" stroke-width="7" stroke-linecap="round"/>
    ${[[96,206,92,150],[128,178,138,110],[160,148,184,84],[194,116,224,62],[110,192,170,224],[146,162,210,182],[182,130,236,128]].map(([a,b,c,d])=>`<path d="M${a} ${b} Q${(a+c)/2+6} ${(b+d)/2-6} ${c} ${d}" fill="none" stroke="#4F8C45" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`).join('')}${ZMARK(180,141,32)}`,
  cell:`<rect x="34" y="52" width="232" height="196" rx="28" fill="#DDEFC9" stroke="#6E9A55" stroke-width="8"/><rect x="49" y="67" width="202" height="166" rx="18" fill="none" stroke="#9CC27F" stroke-width="2.5"/>
    <rect x="102" y="104" width="112" height="84" rx="38" fill="#F1F8E8" stroke="#B8D69E" stroke-width="2.5"/><circle cx="84" cy="196" r="21" fill="#C9B9DF" stroke="#8C77AE" stroke-width="3"/><circle cx="88" cy="192" r="7" fill="#8C77AE"/>
    ${[[219,86],[80,96],[150,82],[232,152],[226,208],[150,214],[70,146]].map(([x,y],i)=>`<g transform="rotate(${(i*37)%70-30} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="19" ry="10" fill="#4F9A45" stroke="#2F6B2B" stroke-width="2"/><line x1="${x-10}" y1="${y}" x2="${x+10}" y2="${y}" stroke="#A6D88C" stroke-width="2"/></g>`).join('')}${ZMARK(219,86,46)}`,
  chloroplast:`<ellipse cx="150" cy="150" rx="132" ry="84" fill="#C7E5A8" stroke="#3F7F3A" stroke-width="7"/><ellipse cx="150" cy="150" rx="119" ry="72" fill="none" stroke="#7DB862" stroke-width="2.5"/>
    <path d="M62 150 H238 M96 128 Q150 112 206 128 M96 172 Q150 188 206 172" fill="none" stroke="#5E9E4E" stroke-width="3"/>
    ${[[78,150,4],[118,128,5],[118,174,4],[164,150,6],[206,128,4],[206,174,5]].map(([x,y,n])=>Array.from({length:n},(_,j)=>`<rect x="${x-17}" y="${f1(y-n*5+j*10)}" width="34" height="8" rx="4" fill="#2F7A35" stroke="#1F5A26" stroke-width="1.5"/>`).join('')).join('')}`};
function renderCut(a,el,lt,t){ // lt = czas od wejścia przerywnika, t = czas rolki (pod-elementy na słowa)
  const k=a.kind;
  if(k==='phone')el.querySelectorAll('.row').forEach((r,i)=>{const t0=a.rowT&&a.rowT[i]!=null?a.rowT[i]-a.t0:.55+i*.42;const e=eout((lt-t0)/.3);r.style.opacity=e;r.style.transform=`translateY(${f1((1-e)*10)}px)`;r.classList.toggle('ok',lt>t0+.22);});
  else if(k==='dots'){const tot=a.total||100,hit=a.hit||0,st=a.landT!=null?.12:.4,dur=a.landT!=null?Math.max(.3,a.landT-a.t0-st):1.6,p=eout((lt-st)/dur),n=Math.round(p*tot);
    el.querySelectorAll('.dg circle').forEach((c,i)=>{const on=i<n;c.setAttribute('fill',on?(i<hit?(a.color||'#E9A23B'):'#454A57'):'#E6E0D3');});
    const cnt=Math.round(p*(a.value==null?hit:a.value));const ce=el.querySelector('.cnt');if(ce.textContent!==String(cnt))ce.textContent=cnt;
    const big=el.querySelector('.big');const pop=lt>=st+dur?1+.14*Math.exp(-(lt-st-dur)*7)*Math.sin(Math.min(Math.PI,(lt-st-dur)*14)):1;big.style.transform=pop!==1?`scale(${pop.toFixed(3)})`:'';}
  else if(k==='zoomin'){const S=a.steps||[],n=S.length;if(!n)return;const T=S.map((s,i)=>a.stepT&&a.stepT[i]!=null?a.stepT[i]:a.t0+i*((a.step==null?.5:+a.step)));const X=.3;
    const box=[45,245,300,300];// x, y, w, h ikony na ekranie
    el.querySelectorAll('.zstep').forEach((z,i)=>{const pin=i===0?1:sat((t-(T[i]-X))/X),pout=i<n-1?sat((t-(T[i+1]-X))/X):0;
      if(pin<=0||pout>=1){z.style.display='none';return;}z.style.display='block';const f=own(ZF,S[i].icon)?ZF[S[i].icon]:[.5,.5];let tr='';
      if(pout>0){const sc=1+7*Math.pow(eio(pout),1.6);z.style.transformOrigin=`${f[0]*100}% ${f[1]*100}%`;tr=`scale(${sc.toFixed(3)})`;z.style.opacity=(1-sat((pout-.45)/.55)).toFixed(2);}
      else{const pf=i>0&&own(ZF,S[i-1].icon)?ZF[S[i-1].icon]:[.5,.5],e=eout(pin);const ox=(pf[0]-.5)*box[2]*(1-e),oy=(pf[1]-.5)*box[3]*(1-e);z.style.transformOrigin='50% 50%';
        tr=`translate(${f1(ox)}px,${f1(oy)}px) scale(${(.14+.86*e).toFixed(3)})`;z.style.opacity=sat(pin*2.2).toFixed(2);}
      z.style.transform=tr;});
    let cur=0;T.forEach((x,i)=>{if(t>=x-.05)cur=i;});
    el.querySelectorAll('.zlab').forEach((z,i)=>{const on=i===cur;z.style.opacity=on?sat((t-T[i]+.05)/.2).toFixed(2):'0';z.style.transform=on?`translateX(-50%) scale(${(.85+.15*eback(sat((t-T[i]+.05)/.3))).toFixed(3)})`:'translateX(-50%)';});
    el.querySelectorAll('.crumbs span').forEach((z,i)=>{z.className=i===cur?'on':i<cur?'done':'';});}
  else if(k==='arc'){const A=a._arc,path=el.querySelector('.arcp');const L=path.getTotalLength?path.getTotalLength():400;const e=eio((lt-.3)/1.1);
    path.style.strokeDasharray=L;path.style.strokeDashoffset=f1(L*(1-e));let c='';const B=(u)=>{const v=1-u;return[v*v*A.p1[0]+2*v*u*A.mid[0]+u*u*A.p2[0],v*v*A.p1[1]+2*v*u*A.mid[1]+u*u*A.p2[1]];};
    if(lt>1.2)for(let i=0;i<4;i++){const u=((lt-1.2)*.45+i*.25)%1;const p=B(u);c+=`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="8" fill="#E6B54E" stroke="#B3820E" stroke-width="2.5"/>`;}el.querySelector('.coins').innerHTML=c;}
  else if(k==='tiles')el.querySelectorAll('.tile').forEach((x,j)=>{const i=+x.getAttribute('data-i');const t0=a.tileT&&a.tileT[i]!=null?a.tileT[i]-a.t0:.35+j*.22;
    const e=eback((lt-t0)/.4);x.style.opacity=sat((lt-t0)/.15);x.style.transform=`translateY(${f1((1-e)*26)}px) scale(${(.6+.4*e).toFixed(3)})`;
    // współczynnik „6” podskakuje na swoje „sześć” i przez chwilę świeci na limonkowo
    const kk=x.querySelector('.k');if(kk){const v=lt-t0;kk.style.transform=v>0?`scale(${(1+.6*(1-eout(sat(v/.45)))).toFixed(3)})`:'';kk.style.background=v>0&&v<.9?`rgba(180,255,58,${f1((1-sat((v-.35)/.55))*100)/100})`:'';}});
}

/* ============================================================ 6. RENDER — klatka dla danego t (czysta funkcja stanu) */
const $=id=>document.getElementById(id);
const R={sb:null,Wd:null,TL:null,t:0,playing:false,answer:null,answerAt:0,quizAt:null,shot:false};
const EL={};
/* scenariusz pochodzi z AI: tekst zawsze idzie przez esc()/textContent, a kolory (trafiają do atrybutów SVG) muszą być #hex — inne wartości usuwamy */
function sanitizeSB(o){const HEX=/^#[0-9a-f]{3,8}$/i;const walk=v=>{if(Array.isArray(v)){v.forEach(walk);return;}if(!v||typeof v!=='object')return;
    Object.keys(v).forEach(k=>{if((k==='color'||k==='ink')&&!(typeof v[k]==='string'&&HEX.test(v[k])))delete v[k];else if(k==='colors')v[k]=Array.isArray(v[k])?v[k].filter(c=>typeof c==='string'&&HEX.test(c)):undefined;else walk(v[k]);});};walk(o);return o;}
/* karta nie może wylewać się za ramkę: najpierw zmniejszamy czcionkę linijki (do 15 px), dopiero potem pozwalamy jej się złamać */
function fitCard(el){const prevD=el.style.display,prevT=el.style.transform;el.style.display='block';el.style.visibility='hidden';el.style.transform='none';
  const ls=[...el.querySelectorAll('.cl')],hid=ls.filter(l=>l.style.display==='none');hid.forEach(l=>l.style.display='block');
  ls.forEach(l=>{if(l.classList.contains('small'))return;let fs=parseFloat(getComputedStyle(l).fontSize)||19,n=0;
    while(l.scrollWidth>l.clientWidth+.5&&fs>15&&n++<24){fs-=1;l.style.fontSize=fs+'px';}
    if(l.scrollWidth>l.clientWidth+.5){l.style.whiteSpace='normal';l.style.textWrap='balance';}});
  hid.forEach(l=>l.style.display='none');el.style.visibility='';el.style.display=prevD;el.style.transform=prevT;}
/* data w jednym stylu: rzymski miesiąc w osobnym <span class="r"> z wąską twardą spacją (U+202F) — „21 I 1793” nie czyta się jak „21 | 1793” */
function dateHTML(d){const tk=String(d||'').trim().split(/\s+/);const rom=tk.some(x=>/^[IVXLC]+$/.test(x));
  return tk.map(x=>/^[IVXLC]+$/.test(x)?`<span class="r">${esc(x)}</span>`:esc(x)).join(rom?' ':' ');}
/* chip z datą (etykieta zdarzenia i chip podsumowania wyglądają tak samo): ciemna część z datą + biała z nazwą */
function dchipHTML(date,name){return `<span class="d">${dateHTML(date)}</span>${name?`<span class="n">${esc(name)}</span>`:''}`;}
const ICON_BREAD='<svg class="ic" viewBox="0 0 24 18" aria-hidden="true"><path d="M3 11c0-5 4-8 9-8s9 3 9 8v3.5c0 1.4-1.1 2.5-2.5 2.5h-13C4.1 17 3 15.9 3 14.5z" fill="#E2A65A" stroke="#7A4A1C" stroke-width="1.6"/><path d="M8 6.5l-1.5 3M12.5 5.8l-1.5 3.4M17 6.5l-1.5 3" stroke="#7A4A1C" stroke-width="1.5" stroke-linecap="round"/></svg>';
const ICON_UP='<svg viewBox="0 0 12 16" aria-hidden="true"><path d="M6 15V3M1.5 7L6 2.5 10.5 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/* macierz koloru: przenikanie oryginału do odcienia koloru col (luminancja × kolor) w stopniu k */
function tintMatrix(col,k){const c=hex2rgb(col).map(v=>v/255*1.55),L=[.3,.59,.11],I=[[1,0,0],[0,1,0],[0,0,1]];const rows=[0,1,2].map(r=>[0,1,2].map(j=>f1(((1-k)*I[r][j]+k*c[r]*L[j])*1000)/1000).concat([0,0]).join(' '));
  return rows.join(' ')+' 0 0 0 1 0';}
function setup(sb){
  sanitizeSB(sb);R.sb=sb;const Wd=R.Wd=buildWorld(sb);const TL=R.TL=compile(sb,Wd,AU.doc);
  const stage=$('stage'),TH=Wd.theme;stage.style.setProperty('--ground',TH.ground);stage.style.setProperty('--gr',hex2rgb(TH.ground).join(' '));
  stage.classList.toggle('th-leaf',TH===THEMES.leaf);
  $('world').innerHTML=Wd.svg;EL.cam=$('cam');EL.hi=$('gHi');EL.fx=$('gFx');EL.stG={};document.querySelectorAll('#gSolid [data-st]').forEach(g=>EL.stG[g.getAttribute('data-st')]=g);
  // części rekwizytów (data-part="stacja|część"): ziemia, bryły i cień każdej części
  EL.parts={};document.querySelectorAll('#world [data-part]').forEach(g=>{const k=g.getAttribute('data-part');(EL.parts[k]=EL.parts[k]||{els:[],tops:[],def:g.style.display==='none'?0:1,v:-1}).els.push(g);if(g.getAttribute('data-top'))EL.parts[k].tops.push(g);});
  EL.beams={};document.querySelectorAll('#gBeam [data-beam]').forEach(g=>{const k=g.getAttribute('data-beam'),r=Wd.roads.find(r=>r.A.id+'|'+r.B.id===k);EL.beams[k]={on:g.querySelector('.bOn'),off:g.querySelector('.bOff'),mid:r&&r.mid,ends:r&&r.ends,a:r&&r.A.id,k:-1};});
  $('fg').innerHTML='<g id="fgCam"></g>';EL.fg=$('fg');EL.fgCam=$('fgCam');EL.fgKey='';EL.vig=document.querySelector('.vig');EL.flash=$('flash');EL.toneKey='';
  const hud=$('hud'),chap=$('chap'),cut=$('cut');hud.innerHTML='';chap.innerHTML='';cut.innerHTML='';
  const cards={};let xs='',defs='';
  TL.acts.forEach((a,ai)=>{
    if(a.type==='label'){const s=Wd.ST[a.at];const el=document.createElement('div');const txt=a.text||(s&&s.label)||'';
      const isD=typeof a.date==='string'&&a.date;el.className='lbl'+(isD?' dl':'')+(a.style==='dark'||a.style==='accent'?' '+a.style:'')+(a.trend?' tr':'');
      if(isD)el.innerHTML=dchipHTML(a.date,txt);
      else el.innerHTML=(a.icon==='bread'?ICON_BREAD:'')+`<span class="tx">${esc(txt)}</span>`+(a.trend==='up'?`<i class="up">${ICON_UP}</i>`:a.trend==='down'?`<i class="up dn">${ICON_UP}</i>`:'');
      el.style.display='none';el.style.transformOrigin='50% 100%';hud.appendChild(el);a.el=el;a.upEl=el.querySelector('.up');}
    else if(a.type==='card'){const el=document.createElement('div');el.className='card'+(a.at!=null?'':' big');el.style.display='none';el.style.transformOrigin=a.at!=null?'50% 100%':'50% 0';
      const head=typeof a.date==='string'&&a.date?`<div class="ct dt"><span class="d">${dateHTML(a.date)}</span></div>`:(a.title?`<div class="ct">${esc(a.title)}</div>`:'');
      el.innerHTML=head+(a.lines||[]).map(l=>{const s=typeof l==='string'?l:String((l&&l.t)||'');return `<div class="cl${s.length>24?' small':''}"><span class="tx">${esc(s)}</span></div>`;}).join('');
      hud.appendChild(el);a.el=el;a.lineEls=[...el.querySelectorAll('.cl')];if(a.id)cards[a.id]=a;}
    else if(a.type==='chapter'){const el=document.createElement('div');el.className='chip';el.innerHTML=`<b>${esc(a.n==null?'':a.n)}</b><span>${esc(a.text||'')}</span>`;el.style.display='none';chap.appendChild(el);a.el=el;}
    else if(a.type==='cutaway'){const el=buildCut(a);cut.appendChild(el);a.el=el;}
    else if(a.type==='recap'&&a.path){
      // chipy podsumowania: stacje na trasie, które mają datę (date + dateName), naprzemiennie po bokach zygzaka, z linią do stacji
      a.chips=[];a.path.ids.forEach((id,i)=>{const s=Wd.ST[id];if(!s||!s.date||a.dates===false)return;const el=document.createElement('div');el.className='lbl dl rc';el.innerHTML=dchipHTML(s.date,s.dateName||'');
        el.style.display='none';hud.appendChild(el);a.chips.push({s,el,i});});
      if(a.label){const el=document.createElement('div');el.className='lbl accent span';el.textContent=a.label;el.style.display='none';hud.appendChild(el);a.lblEl=el;}}
    else if(a.type==='prop'){const s=Wd.ST[a.at],fn=own(EXTRA,a.kind)?EXTRA[a.kind]:null;if(!s||!fn){console.warn('[rolka] prop: brak stacji albo rodzaju',a.at,a.kind);return;}
      const k=s.s*(+a.scale||1),B=builder(s.x+(+a.x||0),s.y+(+a.y||0),k),info=fn(B,a);let g='';B.items.forEach(q=>g+=solidSvg(q));
      a.baseW=[s.x+(+a.x||0),s.y+(+a.y||0),info.base[2]*k];a.dropPx=(a.h==null?3.4:+a.h)*U;xs+=`<g data-x="${ai}" style="display:none">${g}${B.decor}</g>`;}
    else if(a.type==='tint'){a.fid='tint'+ai;defs+=`<filter id="${a.fid}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${tintMatrix(a.color||'#8E2A2A',0)}"/></filter>`;}});
  $('gExtra').innerHTML=xs;$('gDefs').innerHTML=defs;
  TL.acts.forEach((a,ai)=>{if(a.type==='prop')a.xEl=document.querySelector(`#gExtra [data-x="${ai}"]`);if(a.type==='tint'){a.fm=document.querySelector('#'+a.fid+' feColorMatrix');a.g=EL.stG[a.at]||null;}});
  TL.acts.filter(a=>a.type==='strike'&&a.card).forEach(a=>{const c=cards[a.card];if(!c)return console.warn('[rolka] strike: brak karty',a.card);a.target=c;
    const lines=c.el.querySelectorAll('.cl');a.lineEl=lines[a.line||0];if(a.text){const n=document.createElement('div');n.className='cl new';n.innerHTML=`<span class="tx">${esc(a.text)}</span>`;n.style.display='none';
      if(a.lineEl&&a.lineEl.nextSibling)c.el.insertBefore(n,a.lineEl.nextSibling);else c.el.appendChild(n);a.newEl=n;}});
  TL.acts.filter(a=>a.type==='card').forEach(a=>fitCard(a.el));
  TL.ovlActs=TL.acts.filter(a=>a.type==='label'||a.type==='card').map((a,i)=>[a,i]).sort((p,q)=>p[0].t0-q[0].t0||p[1]-q[1]).map(p=>p[0]);
  // lis
  $('fox').innerHTML=foxSvg();const F=$('fox').firstElementChild;EL.fox=F;['fAll','fSway','fHead','fArmL','fArmR','fTail','fEarL','fEarR','fPup','fEyesO','fEyesH','fEyesC','fMouthI','fMouthO','fMouthG','fMouthW','fBrowQ','fSpark','fDots','fGround'].forEach(id=>EL[id]=F.querySelector('#'+id));
  EL.thumbR=EL.fArmR.querySelector('.thumb');
  // napisy, paski
  $('cap').innerHTML='<div class="box" style="display:none"></div>';EL.cap=$('cap').firstElementChild;EL.capKey='';
  $('bars').innerHTML=TL.scenes.map(()=>'<i><b></b></i>').join('');EL.bars=[...$('bars').querySelectorAll('b')];
  $('ttl').textContent=sb.title||'';buildQuiz();buildCover();}
/* pas u góry (pasek, tytuł, chip rozdziału) i pas napisów na dole są zarezerwowane — etykiety tam nie wchodzą */
const TOP_SAFE=140,BOT_SAFE=176,CHIP_Y=152;
function hits(placed,x,y,w,h,m){for(const r of placed)if(x<r[2]+m&&x+w>r[0]-m&&y<r[3]+m&&y+h>r[1]-m)return r;return null;}
/* najbliższe wolne miejsce wokół preferowanego: najpierw pion „od kotwicy”, potem w drugą stronę i w bok (koszt = przesunięcie) */
function placeBox(placed,x,y,w,h,dir){const minX=8,maxX=Math.max(8,SW-8-w),minY=TOP_SAFE,maxY=Math.max(TOP_SAFE,SH-BOT_SAFE-h);
  const ok=(X,Y)=>Y>=minY-.5&&Y<=maxY+.5&&!hits(placed,X,Y,w,h,6);x=clamp(x,minX,maxX);const y0=clamp(y,minY,maxY);if(ok(x,y0))return[x,y0];
  let best=null,bc=1e9;for(let i=0;i<=16;i++)for(const sg of [dir,-dir])for(const dk of [0,-1,1,-2,2,-3,3]){if(!i&&!dk)continue;const X=clamp(x+dk*44,minX,maxX),Y=y0+sg*i*13;
    const cost=i*13*(sg===dir?1:1.7)+Math.abs(X-x)*1.3;if(cost<bc&&ok(X,Y)){bc=cost;best=[X,Y];}}
  return best||[x,y0];}
function sToScreen(c,p){return[(p[0]-c.x)*c.z+SW/2,(p[1]-c.y)*c.z+SH*c.fy];}
const camTf=(c,k)=>`translate(${f1(SW/2)} ${f1(SH*c.fy)}) scale(${(c.z*k).toFixed(4)}) translate(${f1(-c.x)} ${f1(-c.y)})`;
function life(a,t,inD,outD){if(t<a.t0||t>a.t1+(outD||.3))return 0;const i=sat((t-a.t0)/(inD||.35)),o=a.t1>=1e8?1:sat((a.t1+(outD||.3)-t)/(outD||.3));return Math.min(i,o)>0?{i,o}:0;}
function zoneOf(id){return R.Wd.zones.find(z=>z.id===id)||null;}
function zoneC(z){return z.r?[z.x,z.y,z.r]:[z.x+z.w/2,z.y+z.d/2,Math.min(z.w,z.d)/2];}
/* kotwica etykiety: stacja (af = ułamek wysokości, domyślnie szczyt), strefa (brzeg pod kątem ang), punkt [x,y,z]; adx/ady = przesunięcie w px (×zoom) */
function anchorScreen(c,a){const W=R.Wd;let p;
  if(Array.isArray(a.at))p=sToScreen(c,P(+a.at[0],+a.at[1],+(a.at[2]||0)));
  else{const s=W.ST[a.at];if(s){const an=anchorOf(s,a.af==null?1:+a.af);p=sToScreen(c,P(an[0],an[1],an[2]+(+a.z||0)));}
    else{const z=zoneOf(a.at);if(z){const[cx,cy,r]=zoneC(z),ang=a.ang==null?-2.36:+a.ang;p=sToScreen(c,P(cx+Math.cos(ang)*r,cy+Math.sin(ang)*r,0));}else p=[SW/2,SH*.4];}}
  return[p[0]+(+a.adx||0)*c.z,p[1]+(+a.ady||0)*c.z];}
/* szerokość tekstu w pigułce paczki (Plus Jakarta Sans 800) */
const TWC={};function textW(s,size){const k=size+'|'+s;if(TWC[k]!=null)return TWC[k];let w=s.length*size*.64;
  try{const cv=textW.c||(textW.c=document.createElement('canvas').getContext('2d'));cv.font=`800 ${size}px "Plus Jakarta Sans", sans-serif`;w=cv.measureText(s).width;}catch(e){}return TWC[k]=w;}
/* pierwszy plan: widoczny tylko, gdy kamera naprawdę leci (prędkość kadru), przesuwa się 1,4× szybciej niż świat */
function renderFg(t,c){if(R.TL.camKeys.some(k=>k.cut&&t>=k.t-.01&&t<k.t+k.dur+.08)){if(EL.fg.style.display!=='none')EL.fg.style.display='none';return;} // cięcie: bez rozmytego pierwszego planu
  const a=camBase(R.TL,t),b=camBase(R.TL,t-.05);const sp=Math.hypot((a.x-b.x)*a.z,(a.y-b.y)*a.z);const op=sstep(8,26,sp)*.75;
  if(op<.02){if(EL.fg.style.display!=='none')EL.fg.style.display='none';return;}EL.fg.style.display='block';EL.fg.style.opacity=op.toFixed(2);EL.fgCam.setAttribute('transform',camTf(c,1.4));
  // tylko bryły przy krawędziach kadru (ramują obraz jak w filmie), środek zostaje czysty
  const k=c.z*1.4,on=R.Wd.fg.map((b,i)=>{const x=(b.p[0]-c.x)*k+SW/2;return Math.abs(x-SW/2)>SW*.27?i:-1;}).filter(i=>i>=0),key=on.join(',');
  if(key!==EL.fgKey){EL.fgKey=key;EL.fgCam.innerHTML=on.map(i=>R.Wd.fg[i].svg).join('');}}
/* bezpieczny obszar kotwic: kotwica etykiety poza nim = etykieta znika od razu (bez półprzezroczystych „duchów” i linii za kadr) */
const anchorSafe=(x,y)=>x>=6&&x<=SW-6&&y>=92&&y<=SH-BOT_SAFE+30;
function render(t){
  const TL=R.TL,W=R.Wd,TH=W.theme;if(!TL)return;R.t=t;
  if(R.sb.quiz&&t>=TL.T+.15){if(R.quizAt==null)R.quizAt=TL.T+.15;$('quiz').classList.add('on');} // karta quizu musi mieć układ, zanim lis się do niej przymierzy
  const fs=foxState(t);
  const c=camAt(TL,t);const shift=fs&&!fs.quiz?(fs.side==='left'?1:-1)*(fs.big?84:70)*eio(sat(fs.k)):0;c.x-=shift/c.z; // lis zabiera kawałek kadru: świat odsuwa się w drugą stronę
  EL.cam.setAttribute('transform',camTf(c,1));renderFg(t,c);
  EL.vig.style.setProperty('--vx',f1(50+shift/SW*100)+'%');EL.vig.style.setProperty('--vy',f1(c.fy*100)+'%');
  const fl=flashAt(TL,t);EL.flash.style.opacity=fl>.005?fl.toFixed(2):'0';
  // nastrój: odbarwienie świata (tone) — np. scena straty króla, cicha i szara
  let satv=1;for(const a of TL.acts){if(a.type!=='tone')continue;const L=life(a,t,.5,.5);if(!L)continue;satv=Math.min(satv,lerp(1,a.sat==null?.7:+a.sat,Math.min(L.i,L.o)));}
  const fk=satv<.995?`saturate(${satv.toFixed(3)})`:'';if(EL.toneKey!==fk){EL.toneKey=fk;$('world').style.filter=fk;$('fg').style.filter=fk?'blur(2.2px) '+fk:'';}
  // części rekwizytów: stan domyślny, potem akcje "state" po kolei (przenikanie 0,25 s)
  const pv={};Object.keys(EL.parts).forEach(k=>pv[k]=EL.parts[k].def);
  for(const a of TL.acts){if(a.type!=='state'||t<a.t0)continue;const e=sat((t-a.t0)/.25),one=v=>[].concat(v||[]).map(n=>a.at+'|'+n);
    one(a.show).forEach(k=>{if(k in pv)pv[k]=lerp(pv[k],1,e);});one(a.hide).forEach(k=>{if(k in pv)pv[k]=lerp(pv[k],0,e);});}
  Object.keys(pv).forEach(k=>{const P_=EL.parts[k],v=Math.round(pv[k]*100)/100;if(P_.v===v)return;P_.v=v;P_.els.forEach(g=>{g.style.display=v<=.01?'none':'';g.style.opacity=v>=.99?'':String(v);});});
  // promienie przekreślone (strike z "road"): kolor → szarość
  const bk={};for(const a of TL.acts){if(a.type!=='strike'||!a.road)continue;const L=life(a,t,.35,.3);if(!L)continue;const key=EL.beams[a.road.join('|')]?a.road.join('|'):a.road.slice().reverse().join('|');bk[key]=Math.max(bk[key]||0,Math.min(L.i,L.o));}
  Object.keys(EL.beams).forEach(k=>{const B=EL.beams[k],v=Math.round((bk[k]||0)*100)/100;if(B.k===v)return;B.k=v;B.on.setAttribute('opacity',(1-.85*v).toFixed(2));B.off.setAttribute('opacity',v.toFixed(2));});
  let ovl='',hi='',fx='',chapNow=null;const placed=[];
  const lead=(ax,ay,bx,by)=>{const d=Math.abs(bx-ax)<6?`M${f1(ax)} ${f1(by)}L${f1(ax)} ${f1(ay)}`:`M${f1(bx)} ${f1(by)}L${f1(bx)} ${f1(ay)}L${f1(ax)} ${f1(ay)}`;
    return `<path d="${d}" fill="none" stroke="#17151F" stroke-width="1.6"/><circle cx="${f1(ax)}" cy="${f1(ay)}" r="5" fill="#fff" stroke="#17151F" stroke-width="1.8"/><circle cx="${f1(ax)}" cy="${f1(ay)}" r="1.8" fill="#17151F"/>`;};
  const leadH=(ax,ay,bx,by)=>`<path d="M${f1(ax)} ${f1(ay)}L${f1(bx)} ${f1(by)}" fill="none" stroke="#17151F" stroke-width="1.6"/><circle cx="${f1(ax)}" cy="${f1(ay)}" r="4.5" fill="#fff" stroke="#17151F" stroke-width="1.8"/><circle cx="${f1(ax)}" cy="${f1(ay)}" r="1.6" fill="#17151F"/>`;
  // 1) to, co zmienia wymiary kart: nowa linijka po przekreśleniu i linijki wchodzące na słowo (klatka z ?t= ma być taka jak w odtwarzaniu)
  for(const a of TL.acts){if(a.type==='strike'&&a.newEl)a.newEl.style.display=t>=a.t0+.32?'block':'none';
    else if(a.type==='card'&&a.lineT&&a.lineEls)a.lineT.forEach((lt,i)=>{const el=a.lineEls[i];if(!el)return;const v=lt==null||t>=lt;el.style.display=v?'':'none';
      if(lt!=null&&v){const e=sat((t-lt)/.2);el.style.opacity=e<1?e.toFixed(2):'';el.style.transform=e<1?`translateY(${f1((1-eout(e))*6)}px)`:'';}});}
  // 2) przeszkody dla etykiet: lis, chip rozdziału, stacja w kadrze
  if(fs&&!fs.quiz&&fs.k>.3)placed.push([fs.x+fs.fw*.12,fs.y+fs.fh*.1,fs.x+fs.fw*.88,fs.y+fs.fh]);
  /* rozdział: duży chip na środku, po "hold" odjeżdża w górę i gaśnie w 0,3 s — dopiero potem numer i nazwa pojawiają się w pasku (bez dubla) */
  for(const a of TL.acts){if(a.type!=='chapter')continue;const CH=a.hold==null?2.6:+a.hold;if(t>=a.t0+CH+.3&&t<a.t1)chapNow=a;const L=life(a,t,.35,.2);
    if(!L||t>=a.t0+CH+.3){a.el.style.display='none';continue;}a.el.style.display='flex';const u=t-a.t0,w=a.el.offsetWidth,h=a.el.offsetHeight,m=eio((u-CH)/.3);
    const k=lerp(Math.max(.01,eback(u/.4)),.8,m),y=lerp(CHIP_Y,96,m);a.el.style.transform=`translate(${f1(SW/2-w/2)}px,${f1(y-h/2)}px) scale(${k.toFixed(3)})`;
    a.el.style.opacity=Math.min(sat(u/.12),1-m,L.o).toFixed(2);if(m<.5)placed.push([SW/2-w/2,y-h/2,SW/2+w/2,y+h/2]);}
  if(c.st&&W.ST[c.st]){const s=W.ST[c.st],g=sToScreen(c,P(s.x,s.y,0)),tp=sToScreen(c,P(...anchorOf(s,1))),rx=1.1*s.s*1.414*CX*U*c.z,ry=1.1*s.s*1.414*CY*U*c.z;
    placed.push([g[0]-rx,Math.min(tp[1],g[1]-ry),g[0]+rx,g[1]+ry]);}
  // plakietki z numerem (przyczyny 1–4): ciemne, zapalają się na limonkowo na swoje słowo
  for(const a of TL.acts){if(a.type!=='badge')continue;const L=life(a,t,.3,.2),s=W.ST[a.at];if(!L||!s)continue;const[bx,by]=sToScreen(c,P(s.x+1.18*s.s,s.y+1.18*s.s,0));
    if(!anchorSafe(bx,by))continue;const lit=a.litT!=null&&t>=a.litT,pe=lit?eback(sat((t-a.litT)/.35)):1,k=eback(L.i)*Math.max(0,L.o),r=clamp(10*c.z,14,18),sc=(lit?.75+.25*pe+.18*Math.max(0,1-(t-a.litT)/.35):1)*k;
    const op=L.o;if(op<.05)continue;placed.push([bx-r-3,by-r-3,bx+r+3,by+r+3]);
    if(lit){const ph=((t-a.litT)%1.4)/1.4;ovl+=`<circle cx="${f1(bx)}" cy="${f1(by)}" r="${f1(r*(1+ph*.9))}" fill="none" stroke="${TH.accent}" stroke-width="3" opacity="${f1((1-ph)*op*10)/10}"/>`;}
    ovl+=`<g transform="translate(${f1(bx)} ${f1(by)}) scale(${sc.toFixed(3)})" opacity="${op.toFixed(2)}"><circle r="${f1(r)}" fill="${lit?TH.accent:'#17151F'}" stroke="${lit?'#14210A':'#fff'}" stroke-width="2.6"/>`+
      `<text y="1" text-anchor="middle" dominant-baseline="middle" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="${f1(r*1.15)}" fill="${lit?'#14210A':'#fff'}">${esc(a.n)}</text></g>`;}
  // duże karty (bez stacji) mają stałe miejsce — etykiety je omijają
  const vis=[];
  for(const a of TL.ovlActs){const L=life(a,t,.3,.2);if(!L){a.el.style.display='none';continue;}a.el.style.display='block';vis.push([a,L]);}
  vis.forEach(([a,L])=>{if(a.at!=null)return;const k=eback(L.i)*L.o,op=Math.min(sat(L.i*3),L.o),w=a.el.offsetWidth,h=a.el.offsetHeight;
    const x=clamp(SW/2+(+a.dx||0)-w/2,8,SW-8-w),y=SH*(a.y==null?.2:+a.y);if(op>.3)placed.push([x,y,x+w,y+h]);
    a.el.style.transform=`translate(${f1(x)}px,${f1(y+(1-k)*14)}px) scale(${(.85+.15*k).toFixed(3)})`;a.el.style.opacity=op;});
  // podsumowanie osi czasu (recap): pas wzdłuż drogi, stacje zapalają się po kolei, chipy z datami po obu stronach zygzaka (bez wygaszania przy kolizji)
  for(const a of TL.acts){if(a.type!=='recap'||!a.path)continue;const L=life(a,t,.15,.15);
    if(!L){(a.chips||[]).forEach(ch=>ch.el.style.display='none');if(a.lblEl)a.lblEl.style.display='none';continue;}
    const n=a.stT.length,tA=a.stT[0]-.12,tB=a.stT[n-1],g=eio((t-tA)/Math.max(.1,tB-tA)),op=L.o;
    if(g>0){const D=g*a.path.len,pts=[a.path.pts[0]];for(let i=1;i<a.path.pts.length;i++){const p=a.path.pts[i-1],q=a.path.pts[i],l0=a.path.L[i-1],l1=a.path.L[i];if(D>=l1){pts.push(q);continue;}const k=(D-l0)/((l1-l0)||1);pts.push([lerp(p[0],q[0],k),lerp(p[1],q[1],k),0]);break;}
      hi+=`<polyline points="${ptsStr(pts.map(p=>P(p[0],p[1],0)))}" fill="none" stroke="${TH.accent}" stroke-width="${f1(ROAD_W*U*1.3)}" stroke-linecap="round" stroke-linejoin="round" opacity="${f1(.62*op*100)/100}"/>`;}
    a.path.ids.forEach((id,i)=>{if(t<a.stT[i])return;const s=W.ST[id],e=eback(sat((t-a.stT[i])/.3)),R0=1.55*s.s*e;
      hi+=`<polygon points="${ptsStr(circlePts(s.x,s.y,R0,40).map(p=>P(...p)))}" fill="${TH.accent}" fill-opacity="${f1(.42*op*100)/100}" stroke="${TH.accentD}" stroke-width="3" vector-effect="non-scaling-stroke" opacity="${op.toFixed(2)}"/>`;});
    // chipy: strona wg położenia stacji względem środka zygzaka; na każdej stronie od góry, bez nakładania (przesuwamy w dół)
    const scr=a.path.ids.map(id=>{const s=W.ST[id];return sToScreen(c,P(...anchorOf(s,.75)));}),mx=scr.reduce((q,p)=>q+p[0],0)/scr.length;
    const sides={'-1':[],'1':[]};(a.chips||[]).forEach(ch=>{if(t<a.stT[ch.i]){ch.el.style.display='none';return;}ch.el.style.display='block';const[ax,ay]=scr[ch.i],side=ax>=mx?1:-1,w=ch.el.offsetWidth,h=ch.el.offsetHeight;
      const X=side>0?clamp(ax+26,8,SW-8-w):clamp(ax-26-w,8,SW-8-w);sides[side].push({ch,ax,ay,X,Y:ay-h/2,w,h,side});});
    Object.values(sides).forEach(L2=>{L2.sort((p,q)=>p.Y-q.Y);for(let i=0;i<L2.length;i++){const o=L2[i];o.Y=clamp(o.Y,TOP_SAFE-34,SH-BOT_SAFE-o.h);if(i)o.Y=Math.max(o.Y,L2[i-1].Y+L2[i-1].h+5);}
      L2.forEach(o=>{const e=sat((t-a.stT[o.ch.i])/.22),k=.6+.4*eback(e);o.ch.el.style.transformOrigin=o.side>0?'0 50%':'100% 50%';
        o.ch.el.style.transform=`translate(${f1(o.X)}px,${f1(o.Y)}px) scale(${k.toFixed(3)})`;o.ch.el.style.opacity=Math.min(1,e*4,op).toFixed(2);placed.push([o.X,o.Y,o.X+o.w,o.Y+o.h]);
        const ex=o.side>0?o.X:o.X+o.w;if(e>.3)ovl+=`<g opacity="${op.toFixed(2)}">${leadH(o.ax,o.ay,ex,o.Y+o.h/2)}</g>`;});});
    if(a.lblEl){const tl=a.stT[n-1]+.05;if(t<tl){a.lblEl.style.display='none';}else{const el=a.lblEl;el.style.display='block';const w=el.offsetWidth,h=el.offsetHeight,[fx0,fy0]=scr[0];
      const X=clamp(fx0-w/2,8,SW-8-w),Y=clamp(fy0-74,TOP_SAFE-30,SH);const e=sat((t-tl)/.22);el.style.transform=`translate(${f1(X)}px,${f1(Y)}px) scale(${(.7+.3*eback(e)).toFixed(3)})`;el.style.opacity=Math.min(1,e*4,op).toFixed(2);placed.push([X,Y,X+w,Y+h]);}}}
  // 3) karty i etykiety przy stacjach — starsze pierwsze, nowe je omijają (i omijają kotwice innych)
  const anch=new Map();vis.forEach(([a])=>{if(a.at==null)return;const p=anchorScreen(c,a);anch.set(a,p);if(anchorSafe(p[0],p[1]))placed.push([p[0]-7,p[1]-7,p[0]+7,p[1]+7]);});
  vis.forEach(([a,L])=>{if(a.at==null)return;const[ax,ay]=anch.get(a);
    // kotwica poza bezpiecznym obszarem (kamera odjechała): etykieta znika od razu
    if(!anchorSafe(ax,ay)){a.el.style.display='none';return;}
    const k=eback(L.i)*L.o,op=Math.min(sat(L.i*3),L.o),w=a.el.offsetWidth,h=a.el.offsetHeight;
    const dx=a.dx==null?0:+a.dx,dy=a.dy==null?(a.type==='card'?-58:-48):+a.dy;let top,dir;if(dy<=0){top=ay+dy-h;dir=-1;}else{top=ay+dy;dir=1;}
    if(dir<0&&top<TOP_SAFE&&ay+Math.abs(dy)+h<SH-BOT_SAFE){top=ay+Math.max(28,Math.abs(dy));dir=1;}
    const[X,Y]=placeBox(placed,ax+dx-w/2,top,w,h,dir);placed.push([X,Y,X+w,Y+h]);const below=Y>ay,att=below?Y:Y+h,bx=clamp(ax,X+16,X+w-16);
    a.el.style.transformOrigin=below?'50% 0':'50% 100%';a.el.style.transform=`translate(${f1(X)}px,${f1(Y)}px) scale(${(.7+.3*k).toFixed(3)})`;a.el.style.opacity=op;
    if(a.upEl){const u=((t-a.t0)%.9)/.9;a.upEl.style.transform=`translateY(${f1(3-u*7)}px)`;a.upEl.style.opacity=(u<.75?1:1-(u-.75)/.25).toFixed(2);}
    if(op>.02)ovl+=`<g opacity="${op.toFixed(2)}">${lead(ax,ay,bx,att)}</g>`;});
  // 4) reszta akcji
  for(const a of TL.acts){
    if(a.type==='strike'){
      if(a.target){const on=t>=a.t0;if(a.lineEl){a.lineEl.classList.toggle('struck',on);a.lineEl.style.setProperty('--sw',on?eout((t-a.t0)/.4).toFixed(3):'0');}
        if(a.newEl){const v=t>=a.t0+.32;a.newEl.style.display=v?'block':'none';a.newEl.style.opacity=sat((t-a.t0-.32)/.25);}}
      else if(a.road){const L=life(a,t,.35,.3);if(!L)continue;const B=EL.beams[a.road.join('|')]||EL.beams[a.road.slice().reverse().join('|')];if(!B||!B.mid)continue;
        // pos: miejsce znaku na promieniu, ułamek od pierwszej stacji z "road" (domyślnie środek)
        const f=a.pos==null?.5:clamp(+a.pos,0,1),E=B.ends,q=E?(B.a===a.road[0]?[E[0],E[1]]:[E[1],E[0]]):null,pt=q?[lerp(q[0][0],q[1][0],f),lerp(q[0][1],q[1][1],f),lerp(q[0][2],q[1][2],f)]:B.mid;
        const[ax,ay]=sToScreen(c,P(...pt)),r=11,e1=eout(L.i),op=L.o;if(op<.05)continue;
        ovl+=`<g opacity="${op.toFixed(2)}" transform="translate(${f1(ax)} ${f1(ay)}) scale(${e1.toFixed(3)})"><circle r="${r+8}" fill="#fff" stroke="#17151F" stroke-width="1.6"/><path d="M${-r/1.6} ${-r/1.6}L${r/1.6} ${r/1.6}M${r/1.6} ${-r/1.6}L${-r/1.6} ${r/1.6}" stroke="#E0483F" stroke-width="4.2" stroke-linecap="round"/></g>`;}
      else if(a.at&&W.ST[a.at]){const s=W.ST[a.at],g=EL.stG[a.at];const u=t-a.t0,part=EL.parts[a.at+'|'+(a.part||'top')];
        if(a.fall&&part){/* tylko część (korona) przewraca się przez krawędź poduszki, spada na plac, toczy się i zostaje — w pełni nieprzezroczysta */
          const pv=P(s.x+.31*s.s,s.y-.31*s.s,.56*s.s),drop=.56*s.s*U;let ang=0,dx=0,dy=0;
          if(u>0){if(u<.5){const k=u/.5;ang=92*k*k;}else{const v=u-.5,fall=Math.min(1,Math.pow(v/.3,2)),roll=eout(v/.9);ang=92+26*roll;dx=(6*fall+9*roll)*s.s;
            const bo=v>.3?3.5*Math.abs(Math.sin((v-.3)*13))*Math.exp(-(v-.3)*6):0;dy=drop*fall-bo;}}
          const tf=u>0?`translate(${f1(dx)} ${f1(dy)}) rotate(${f1(ang)} ${f1(pv[0])} ${f1(pv[1])})`:'';part.tops.forEach(el=>{if(tf)el.setAttribute('transform',tf);else el.removeAttribute('transform');});
          part.els.forEach(el=>{if(el.parentNode&&el.parentNode.id==='gShadow')el.style.opacity=u>0?String(f1((1-sat(u/.4))*100)/100):'';});
          if(u>.5){const k=sat((u-.5)/.35);hi+=`<ellipse cx="${f1(pv[0]+dx+10*s.s)}" cy="${f1(pv[1]+drop+3)}" rx="${f1(19*s.s)}" ry="${f1(7*s.s)}" fill="#5A4A30" opacity="${f1(.2*k*100)/100}"/>`;}}
        else if(a.fall&&g){if(u>0){const e=eout(u/.9),bounce=u>.9?Math.sin((u-.9)*9)*Math.exp(-(u-.9)*5)*4:0;const pv=P(s.x+1.05*s.s,s.y-1.05*s.s,0);g.setAttribute('transform',`rotate(${f1(e*74+bounce)} ${f1(pv[0])} ${f1(pv[1])})`);}
          else g.removeAttribute('transform');}
        if(u>0&&!a.noX){const[ax,ay]=anchorScreen(c,{at:a.at,z:-s.top*.45});const r=24,e1=eout(u/.25),e2=eout((u-.18)/.25);
          const ln=(x1,y1,x2,y2,e)=>e>0?`<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(lerp(x1,x2,e))}" y2="${f1(lerp(y1,y2,e))}" stroke="#fff" stroke-width="12" stroke-linecap="round"/><line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(lerp(x1,x2,e))}" y2="${f1(lerp(y1,y2,e))}" stroke="#E0483F" stroke-width="7" stroke-linecap="round"/>`:'';
          ovl+=ln(ax-r,ay-r,ax+r,ay+r,e1)+ln(ax+r,ay-r,ax-r,ay+r,e2);}}
      continue;}
    if(a.type==='prop'){const el=a.xEl;if(!el)continue;const L=life(a,t,.01,.25);if(!L){el.style.display='none';continue;}el.style.display='';const u=t-a.t0,b=P(...a.baseW);
      if(a.drop){const k=sat(u/.3),v=u-.3,bo=v>0?-7*Math.abs(Math.sin(v*13))*Math.exp(-v*6.5):0,sq=v>0&&v<.12?1-.12*Math.sin(Math.PI*v/.12):1;
        el.setAttribute('transform',`translate(0 ${f1(-a.dropPx*(1-k*k)+bo)}) translate(${f1(b[0])} ${f1(b[1])}) scale(${(2-sq).toFixed(3)} ${sq.toFixed(3)}) translate(${f1(-b[0])} ${f1(-b[1])})`);}
      else{const e=Math.max(.01,eback(sat(u/.35)));el.setAttribute('transform',`translate(${f1(b[0])} ${f1(b[1])}) scale(${e.toFixed(3)}) translate(${f1(-b[0])} ${f1(-b[1])})`);}
      el.setAttribute('opacity',L.o<.999?L.o.toFixed(2):'1');continue;}
    if(a.type==='tint'){const L=life(a,t,.4,.4);if(!L){if(a.g&&a.on){a.g.removeAttribute('filter');a.on=false;}continue;}const k=Math.min(L.i,L.o),pulse=.5+.5*Math.sin((t-a.t0)*Math.PI*2/1.8),col=a.color||'#8E2A2A',rgb=hex2rgb(col).join(',');
      if(a.g&&a.fm){a.fm.setAttribute('values',tintMatrix(col,k*(.5+.22*pulse)));if(!a.on){a.g.setAttribute('filter',`url(#${a.fid})`);a.on=true;}}
      const s=W.ST[a.at];if(s)hi+=`<polygon points="${ptsStr(circlePts(s.x,s.y,1.55*s.s,40).map(p=>P(...p)))}" fill="rgba(${rgb},${f1((.2+.14*pulse)*k*100)/100})"/>`;
      if(a.road){const A=W.ST[a.road[0]],B2=W.ST[a.road[1]];if(A&&B2){const dx=B2.x-A.x,dy=B2.y-A.y,Ln=Math.hypot(dx,dy)||1,px=-dy/Ln*(ROAD_W+.12)/2,py=dx/Ln*(ROAD_W+.12)/2;
        hi+=groundPoly([[A.x+px,A.y+py],[B2.x+px,B2.y+py],[B2.x-px,B2.y-py],[A.x-px,A.y-py]],`rgba(${rgb},${f1((.5+.25*pulse)*k*100)/100})`);}}continue;}
    if(a.type==='burst'){const u=t-a.t0;if(u<0||u>.9)continue;const s=W.ST[a.at];if(!s)continue;const e=eout(u/.9),op=1-sat((u-.25)/.65);
      if(a.kind==='dust'){for(let i=0;i<(a.n||7);i++){const ang=i/(a.n||7)*Math.PI*2+.4,rr=(1.25+e*1.25)*s.s,[x,y]=sToScreen(c,P(s.x+Math.cos(ang)*rr,s.y+Math.sin(ang)*rr,.2+e*.5));
          const r=(7+13*e)*Math.min(1.6,c.z*.7);ovl+=`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="#DCD3C2" stroke="#B9AD97" stroke-width="1.5" opacity="${f1(.9*op*100)/100}"/>`;}}
      else{const an=anchorOf(s,a.af==null?1:+a.af),[x,y]=sToScreen(c,P(...an)),col=a.color||TH.accent,k=Math.min(1.5,c.z*.75);let r='';
        if(a.flash&&u<.35)ovl+=`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1((40+50*eout(u/.35))*k)}" fill="#FFFBEA" opacity="${f1(.85*(1-u/.35)*100)/100}"/>`;
        for(let i=0;i<12;i++){const ang=i/12*Math.PI*2,r1=(12+40*e)*k,r2=(22+70*e)*k;r+=`<line x1="${f1(x+Math.cos(ang)*r1)}" y1="${f1(y+Math.sin(ang)*r1)}" x2="${f1(x+Math.cos(ang)*r2)}" y2="${f1(y+Math.sin(ang)*r2)}" stroke="${col}" stroke-width="4.5" stroke-linecap="round"/>`;}
        ovl+=`<g opacity="${op.toFixed(2)}"><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1((10+64*e)*k)}" fill="none" stroke="${col}" stroke-width="3"/>${r}</g>`;}continue;}
    const L=life(a,t,a.type==='packet'?.2:.35,a.type==='packet'?.2:.3);
    if(a.type==='highlight'){if(!L)continue;let cx,cy,R0,zn=null;const s=W.ST[a.at];if(s){cx=s.x;cy=s.y;R0=(a.r||1.8)*s.s;}else{zn=zoneOf(a.at);if(!zn)continue;[cx,cy,R0]=zoneC(zn);if(a.r)R0=+a.r;}
      const k=eback(L.i)*L.o,col=a.color||TH.accent,rgb=hex2rgb(col).join(','),dark=a.color?shade(a.color,.72):TH.accentD;
      if(a.style==='tint'){const e=Math.min(L.i,L.o);hi+=`<polygon points="${ptsStr(circlePts(cx,cy,R0,64).map(p=>P(...p)))}" fill="rgba(${rgb},${f1(.5*e*100)/100})" stroke="${dark}" stroke-width="2.5" stroke-dasharray="8 6" vector-effect="non-scaling-stroke" opacity="${e.toFixed(2)}"/>`;continue;}
      const ring=(r,fill,stroke,sw,op)=>`<polygon points="${ptsStr(circlePts(cx,cy,r,48).map(p=>P(...p)))}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" vector-effect="non-scaling-stroke" opacity="${op.toFixed(2)}"/>`;
      const ph=((t-a.t0)%1.6)/1.6;hi+=ring(R0*k,`rgba(${rgb},.30)`,dark,3,L.o)+ring(R0*(1+ph*.5),'none',col,3.5,(1-ph)*L.o);continue;}
    if(a.type==='packet'){if(!L||!a.R)continue;ovl+=renderPacket(a,t,c,L);continue;}
    if(a.type==='tunnel'){if(t<a.t0||!a.geo)continue;const G=a.geo,n=Math.round(eout((t-a.t0)/(.6+G.rings.length*.035))*G.rings.length);if(!n)continue;
      const segs={};G.rings.slice(0,n).forEach(r=>{(segs[r.seg]=segs[r.seg]||[]).push(...r.pts);});
      Object.values(segs).forEach(pts=>{fx+=`<polygon points="${ptsStr(hull(pts))}" fill="${G.color}" opacity=".16"/>`;});
      G.rings.slice(0,n).forEach(r=>{fx+=`<polygon points="${ptsStr(r.pts)}" fill="none" stroke="${G.color}" stroke-width="3.2" stroke-linejoin="round" opacity=".92"/>`;});continue;}
    if(a.type==='cutaway'){if(!L){a.el.style.display='none';continue;}a.el.style.display='block';const e=eout(L.i);a.el.style.opacity=Math.min(sat(L.i*1.6),L.o);
      a.el.style.transform=`translateY(${f1((1-e)*36+(1-L.o)*24)}px)`;renderCut(a,a.el,t-a.t0,t);continue;}
  }
  $('ovl').innerHTML=ovl;EL.hi.innerHTML=hi;EL.fx.innerHTML=fx;
  const tt=chapNow?`<b>${esc(chapNow.n==null?'':chapNow.n)}</b>${esc(chapNow.text||'')}`:esc(R.sb.title||'');if(EL.ttlKey!==tt){EL.ttlKey=tt;$('ttl').innerHTML=tt;$('ttl').classList.toggle('ch',!!chapNow);}
  renderCaptions(t);renderFox(t,fs);
  // paski postępu
  TL.scenes.forEach((S,i)=>{const k=sat((t-S.start)/(S.end-S.start));EL.bars[i].style.transform=`scaleX(${k.toFixed(3)})`;});
  renderQuiz(t);}
/* paczka: kropka, pigułka z tekstem, moneta, ludzik, iskra światła albo bateria (poziom naładowania); jedna albo dwa odcinki (stop → go) z przemianą (morph) */
const PK_SP={coin:.3,people:.28,dot:.8,light:.8,pill:2.2,battery:2.4};
function renderPacket(a,t,c,L){const st=a.style||(a.text?'pill':'dot'),two=a.stopD!=null,len=a.R.len;let out='';
  const loop=!two&&a.loop!==false,big=st==='pill'||st==='battery',n=two?1:(loop?Math.max(1,Math.min(a.n||3,Math.floor(len/(PK_SP[st]||.8)))):(a.n||(big?1:3))),dur=a.d1,gap=a.gap||(loop?1/n:.2);
  for(let i=0;i<n;i++){let u,fade;
    if(two){let d;if(t<a.arrT)d=a.stopD*eout((t-a.t0)/a.d1);else if(t<a.goT)d=a.stopD;else d=a.stopD+(len-a.stopD)*eio((t-a.goT)/a.d2);u=d/len;
      const end=a.goT+a.d2+(a.drain?.4:0);fade=Math.min(sat((t-a.t0)/.12),t>end?1-sat((t-end)/.2):1)*L.o;}
    else{u=(t-a.t0)/dur-i*gap;if(u<0)continue;
      if(loop){u=u%1;fade=Math.min(sat(u/.08),sat((1-u)/.1))*L.o;}
      else if(a.hold){const over=(u-1)*dur;if(over>+a.hold+.2)continue;u=Math.min(u,1);fade=Math.min(sat(u/.08),1-sat((over-a.hold)/.2))*L.o;} // "hold": po dojechaniu zostaje (np. tłum pod bramą)
      else{if(u>1)continue;fade=Math.min(sat(u/.08),sat((1-u)/.1))*L.o;}}
    if(fade<.02)continue;
    const p3=along(a.R,u);let[x,y]=sToScreen(c,P(...p3));const[gx0,gy0]=sToScreen(c,P(p3[0],p3[1],0));let gx=gx0,gy=gy0;
    const ln=+a.lane||0;y+=ln;gy+=ln;if(st==='people'){const pk=clamp(c.z*.85,1,2.2),jx=((i*53)%9-4)*4.2*pk,jy=((i*31)%7-3)*2.6*pk;x+=jx;y+=jy;gx+=jx;gy+=jy;}
    const mo=a.morph&&two&&t>=a.arrT,txt=String(mo&&a.morph.text!=null?a.morph.text:(a.text||'')),col=(mo&&a.morph.color)||a.color||(st==='coin'?'#F2C14E':'#2F6BFF'),ink=(mo&&a.morph.ink)||a.ink||'#fff';
    const zk=big?clamp(c.z*.8,1,1.45):1,fz=(st==='battery'?11.5:10.5)*zk,pw=big?Math.max(22,textW(txt,f1(fz))+(st==='battery'?22:14)*zk):13,ph=(st==='battery'?22:big?20:13)*zk;
    out+=`<g opacity="${fade.toFixed(2)}"><ellipse cx="${f1(gx+2)}" cy="${f1(gy+3)}" rx="${f1((st==='people'?9:pw)*.52)}" ry="${f1(ph*.42)}" fill="#3A3226" opacity=".2"/>`;
    if(st==='pill')out+=`<rect x="${f1(x-pw/2)}" y="${f1(y-ph/2)}" width="${f1(pw)}" height="${f1(ph)}" rx="${f1(ph/2)}" fill="${col}" stroke="#fff" stroke-width="2.4"/><text x="${f1(x)}" y="${f1(y+.6)}" text-anchor="middle" dominant-baseline="middle" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="${f1(fz)}" fill="${ink}">${esc(txt)}</text>`;
    else if(st==='battery'){let lv=.16;if(a.chargeT!=null&&t>=a.chargeT)lv=lerp(.16,1,eout((t-a.chargeT)/.5));
      if(a.drain&&two&&t>a.goT){const k=sat(((t-a.goT)/a.d2-.55)/.45);lv*=1-k;}
      const bw=pw,bx=x-bw/2,by=y-ph/2,iw=(bw-6)*lv;
      out+=`<rect x="${f1(bx)}" y="${f1(by)}" width="${f1(bw)}" height="${f1(ph)}" rx="${f1(6*zk)}" fill="#fff" stroke="#17151F" stroke-width="2.2"/><rect x="${f1(bx+bw)}" y="${f1(y-4.5*zk)}" width="${f1(4*zk)}" height="${f1(9*zk)}" rx="1.5" fill="#17151F"/>`+
        (iw>.5?`<rect x="${f1(bx+3)}" y="${f1(by+3)}" width="${f1(iw)}" height="${f1(ph-6)}" rx="${f1(3.5*zk)}" fill="${lv<.3?'#F0A15A':col}"/>`:'')+
        `<text x="${f1(x)}" y="${f1(y+.6)}" text-anchor="middle" dominant-baseline="middle" font-family="Plus Jakarta Sans, sans-serif" font-weight="800" font-size="${f1(fz)}" fill="#14210A">${esc(txt)}</text>`;}
    else if(st==='coin')out+=`<circle cx="${f1(x)}" cy="${f1(y)}" r="6.5" fill="${col}" stroke="#9A6B12" stroke-width="2"/><circle cx="${f1(x)}" cy="${f1(y)}" r="3.1" fill="none" stroke="#C8973A" stroke-width="1.4"/>`;
    else if(st==='people'){const pc=PEOPLE[(i*3)%PEOPLE.length],k=clamp(c.z*.85,1,2.2),hy=y-Math.abs(Math.sin((t-a.t0)*17+i*1.3))*3*k;
      out+=`<rect x="${f1(x-4.8*k)}" y="${f1(hy-5*k)}" width="${f1(9.6*k)}" height="${f1(12*k)}" rx="${f1(4.5*k)}" fill="${pc}" stroke="#fff" stroke-width="1.6"/><circle cx="${f1(x)}" cy="${f1(hy-8.6*k)}" r="${f1(4*k)}" fill="#E9CDB0" stroke="#fff" stroke-width="1.4"/>`;}
    else if(st==='light')out+=`<circle cx="${f1(x)}" cy="${f1(y)}" r="13" fill="#FFD24A" opacity=".35"/><circle cx="${f1(x)}" cy="${f1(y)}" r="6.5" fill="#FFE38A" stroke="#E9A23B" stroke-width="2.2"/>`;
    else out+=`<circle cx="${f1(x)}" cy="${f1(y)}" r="6.5" fill="${col}" stroke="#fff" stroke-width="2.6"/>`;
    out+='</g>';
    // przemiana w punkcie stop: pierścień i iskry (np. H₂O rozbija się, wychodzi O₂)
    if(a.morph&&two&&t>=a.arrT&&t<a.arrT+.5){const e=eout((t-a.arrT)/.5),op=1-e,mc=a.morph.color||col;let r='';
      for(let j=0;j<8;j++){const an=j/8*Math.PI*2+.2;r+=`<line x1="${f1(x+Math.cos(an)*(10+14*e))}" y1="${f1(y+Math.sin(an)*(10+14*e))}" x2="${f1(x+Math.cos(an)*(16+26*e))}" y2="${f1(y+Math.sin(an)*(16+26*e))}" stroke="${mc}" stroke-width="3" stroke-linecap="round"/>`;}
      out+=`<g opacity="${op.toFixed(2)}"><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(12+28*e)}" fill="none" stroke="#fff" stroke-width="4"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(12+28*e)}" fill="none" stroke="${mc}" stroke-width="2.2"/>${r}</g>`;}}
  return out;}
function sceneAt(t){const S=R.TL.scenes;for(let i=S.length-1;i>=0;i--)if(t>=S[i].start)return S[i];return S[0];}
function renderCaptions(t){const S=sceneAt(t),box=EL.cap;
  if(!S||!S.words.length||t<S.words[0].t0-.12||t>S.speechEnd+.3||t>=R.TL.T){box.style.display='none';return;}
  let j=S.i===0?0:-1;for(let k=0;k<S.words.length;k++)if(S.words[k].t0<=t)j=k; // klatka 0 rolki: pierwsze słowo już świeci (okładka nie jest „szara”)
  let ci=0;S.chunks.forEach((ch,i)=>{if(j>=ch[0])ci=i;});const ch=S.chunks[ci],key=S.i+':'+ci;
  const pw=ch.length===1&&S.words[ch[0]].pw; // słowo-uderzenie: samo, 1,3× większe, limonkowa ramka, ciemny tekst
  if(EL.capKey!==key){EL.capKey=key;box.className='box'+(pw?' pw':'');box.innerHTML=ch.map(k=>`<span class="w" data-k="${k}">${esc(S.words[k].d)}</span>`).join('');}
  box.style.display='block';
  if(pw){const u=t-S.words[ch[0]].t0;const sc=u<.12?lerp(.78,1.14,eout(u/.12)):1+.14*Math.exp(-(u-.12)*16);const sh=u>0&&u<.6?2*Math.sin(u*95)*Math.exp(-u*6):0;
    box.style.transform=`translateX(calc(-50% + ${f1(sh)}px)) scale(${sc.toFixed(3)})`;box.firstElementChild.className='w now';box.firstElementChild.style.transform='';return;}
  // wejście kawałka: krótki „pop” całej ramki; bieżące słowo: limonkowe, podskakuje (do +9%, 3–4 px w górę) przez 0,2 s od swojego początku
  const c0=S.words[ch[0]].t0,e=eback((t-c0+.12)/.2);box.style.transform=`translateX(-50%) scale(${(.84+.16*e).toFixed(3)})`;
  box.querySelectorAll('.w').forEach(sp=>{const k=+sp.getAttribute('data-k');sp.className='w'+(k<j?' on':k===j?' now':'');
    const pop=k===j?1+.09*Math.sin(Math.PI*sat((t-S.words[k].t0)/.2)):1;sp.style.transform=pop>1.001?`translateY(${f1(-(pop-1)*40)}px) scale(${pop.toFixed(3)})`:'';});}
/* lis wchodzi „pop” (skala), a schodzi zsuwając się 40 px w dół i gasnąc w 0,25 s — bez kurczenia do kropki */
function renderFox(t,fs){const F=EL.fox;if(!fs){F.style.display='none';return;}F.style.display='block';const{g,u,side,k,quiz,sc,x,y,ex}=fs;
  const S=sceneAt(t);let talk=false;if(!quiz&&S)for(const w of S.words)if(t>=w.t0&&t<w.t1){talk=((t-w.t0)/(w.t1-w.t0))<.55;break;}
  const p=foxPose(g,u,side,talk);
  F.style.transformOrigin='50% 100%';F.style.width='160px';F.style.height='170px';
  if(ex>0){F.style.transform=`translate(${f1(x)}px,${f1(y+40*eio(ex))}px) scale(${sc.toFixed(3)})`;F.style.opacity=(1-ex).toFixed(2);}
  else{F.style.transform=`translate(${f1(x)}px,${f1(y+(1-k)*30)}px) scale(${(sc*k).toFixed(3)})`;F.style.opacity='';}
  EL.fAll.setAttribute('transform',`translate(0 ${f1(p.hop)})`);EL.fSway.setAttribute('transform',`rotate(${f1(p.sway)} 80 160)`);EL.fHead.setAttribute('transform',`rotate(${f1(p.head)} 0 30)`);
  EL.fArmL.setAttribute('transform',`rotate(${f1(p.armL)} 53.5 121)`);EL.fArmR.setAttribute('transform',`rotate(${f1(p.armR)} 106.5 121)`);EL.fTail.setAttribute('transform',`rotate(${f1(p.tail)} 104 146)`);
  EL.fEarL.setAttribute('transform',`rotate(${f1(p.earL)} -20 -20)`);EL.fEarR.setAttribute('transform',`rotate(${f1(p.earR)} 20 -20)`);EL.fPup.setAttribute('transform',`translate(${f1(p.look)} 0)`);
  const show=(el,v)=>el.setAttribute('display',v?'inline':'none');
  const blink=((t*1000)%3900)<120;show(EL.fEyesO,p.eyes==='o'&&!blink);show(EL.fEyesC,p.eyes==='o'&&blink);show(EL.fEyesH,p.eyes==='h');
  show(EL.fMouthI,p.mouth==='i');show(EL.fMouthO,p.mouth==='o');show(EL.fMouthG,p.mouth==='g');show(EL.fMouthW,p.mouth==='w');show(EL.fBrowQ,p.brow);show(EL.thumbR,p.thumb);
  show(EL.fSpark,p.spark>0);if(p.spark>0)EL.fSpark.setAttribute('opacity',(.6+.4*Math.abs(Math.sin(u*6))).toFixed(2));show(EL.fDots,p.dots>0);if(p.dots)EL.fDots.setAttribute('opacity',p.dots.toFixed(2));
  EL.fGround.setAttribute('opacity',quiz?'0':'.22');}

/* ============================================================ 9. QUIZ I OKŁADKA */
const ICON_PLAY='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
const ICON_SND='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11"/></svg>';
const ICON_MUTE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function buildQuiz(){const Q=R.sb.quiz,box=$('quiz');if(!Q){box.innerHTML='';EL.qCard=null;return;}
  box.innerHTML=`<div class="dim"></div><div class="q"><div class="qk">Sprawdź się</div><div class="qq">${esc(Q.q)}</div>
    ${(Q.a||[]).map((x,i)=>`<button class="a" type="button" data-i="${i}"><b>${'ABCD'[i]}</b><span>${esc(x)}</span></button>`).join('')}
    <div class="fb"></div><button class="btn ghost again" type="button">Obejrzyj jeszcze raz</button></div>`;
  EL.qCard=box.querySelector('.q');box.querySelectorAll('.a').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();answer(+b.getAttribute('data-i'));}));
  box.querySelector('.again').addEventListener('click',e=>{e.stopPropagation();restart(true);});box.addEventListener('click',e=>e.stopPropagation());}
function answer(i){const Q=R.sb.quiz;if(!Q||R.answer!=null)return;R.answer=i;R.answerAt=R.t;paintQuiz();sfxNow(i===Q.c?'ding':'buzz');if(!R.playing&&!R.shot){R.playing=true;R.mode='timer';tick.last=0;}render(R.t);}
function paintQuiz(){const Q=R.sb.quiz,box=$('quiz');if(!Q)return;const ans=R.answer;
  box.querySelectorAll('.a').forEach((b,i)=>{b.className='a'+(ans==null?'':i===Q.c?' ok':i===ans?' bad':' dis');b.disabled=ans!=null;});
  const fb=box.querySelector('.fb');if(ans==null){fb.className='fb';fb.innerHTML='';}else{const ok=ans===Q.c;fb.className='fb on '+(ok?'ok':'bad');
    fb.innerHTML=`<strong>${ok?'Dobrze!':'Nie tym razem'}</strong>${ok?'':'Poprawna odpowiedź: '+esc(Q.a[Q.c])+'. '}${esc(Q.e||'')}`;}
  box.querySelector('.again').classList.toggle('on',ans!=null);}
function renderQuiz(t){const box=$('quiz');if(!R.sb.quiz)return;const T=R.TL.T;
  if(t<T+.15){box.classList.remove('on');R.quizAt=null;return;}if(R.quizAt==null)R.quizAt=T+.15;
  box.classList.add('on');const e=eout((t-R.quizAt)/.45);EL.qCard.style.transform=`translateY(${f1((1-e)*80)}px)`;box.style.opacity=sat((t-R.quizAt)/.25);
  $('fox').style.zIndex=7;}
function buildCover(){const c=$('cover');const T=Math.round(R.TL.T/(AU.src?AU.rate:1)); // czas w sekundach zegarowych (nagranie może grać szybciej)
  const CV=R.sb.cover&&typeof R.sb.cover==='object'?R.sb.cover:{},sub=String(CV.sub||R.sb.intro||'Krótka historia z Twoich notatek. Na końcu jedno pytanie.').replace(/\{s\}/g,T);
  c.innerHTML=`<div class="fx-cv"></div><div class="kick">Rolka${R.sb.subject?' · '+esc(R.sb.subject):''} · ${T} s</div><h1>${esc(CV.title||R.sb.title||'')}</h1><p>${esc(sub)}</p>
    <button class="btn" type="button" id="bPlay">${ICON_PLAY}<span>Odtwórz rolkę</span></button><div class="hint">${AU.src?'Z lektorem. Włącz dźwięk.':'Lektor czyta po polsku.'} Dotknij ekranu, żeby zatrzymać.</div>`;
  const fv=c.querySelector('.fx-cv');fv.innerHTML=foxSvg();const s=fv.firstElementChild;s.setAttribute('width','150');s.setAttribute('height','160');
  const p=foxPose('wave',.62,'right',false);s.querySelector('#fArmR').setAttribute('transform',`rotate(${f1(p.armR)} 106.5 121)`);s.querySelector('#fHead').setAttribute('transform',`rotate(${f1(p.head)} 0 30)`);
  s.querySelector('#fMouthI').setAttribute('display','none');s.querySelector('#fMouthG').setAttribute('display','inline');
  c.querySelector('#bPlay').addEventListener('click',e=>{e.stopPropagation();c.classList.add('off');start();});}

/* ============================================================ 10. ODTWARZANIE I LEKTOR
   Tryb 'speech': zegar biegnie, ale nie wyprzedza lektora (czeka na granicę słowa / koniec wypowiedzi) i dogania go, gdy lektor jest szybszy.
   Tryb 'timer': szacowane czasy słów (gdy brak polskiego głosu, wyciszenie albo błąd syntezy). */
const SP={ok:false,voice:null,muted:false,scene:-1,from:0,word:-1,got:false,ended:false,startedAt:0,utt:null};
function pickVoice(){if(!('speechSynthesis' in window))return null;const vs=speechSynthesis.getVoices()||[];const pl=vs.filter(v=>/^pl(-|_|$)/i.test(v.lang));
  if(!pl.length)return null;return pl.find(v=>v.localService&&/zosia/i.test(v.name))||pl.find(v=>v.localService)||pl[0];}
function initSpeech(){if(!('speechSynthesis' in window))return;const upd=()=>{SP.voice=pickVoice();SP.ok=!!SP.voice;paintMute();};upd();try{speechSynthesis.addEventListener('voiceschanged',upd);}catch(e){}}
function speechOn(){return SP.ok&&!SP.muted&&R.mode==='speech';}
function stopSpeech(){SP.scene=-1;SP.utt=null;try{if('speechSynthesis' in window)speechSynthesis.cancel();}catch(e){}}
function speakScene(i,from){const S=R.TL.scenes[i];if(!S||!S.words.length)return;stopSpeech();from=clamp(from|0,0,S.words.length-1);
  const off=S.charAt[from],txt=S.speak.slice(off);const u=new SpeechSynthesisUtterance(txt);u.lang='pl-PL';if(SP.voice)u.voice=SP.voice;u.rate=+(R.sb.rate||1);u.pitch=1;
  SP.scene=i;SP.from=from;SP.word=from;SP.got=false;SP.ended=false;SP.startedAt=performance.now();SP.utt=u;
  u.onboundary=e=>{if(SP.utt!==u)return;if(e.name&&e.name!=='word')return;const ci=off+(e.charIndex|0);let j=from;for(let k=from;k<S.words.length;k++)if(S.charAt[k]<=ci)j=k;
    SP.word=j;SP.got=true;const w=S.words[j];if(R.t<w.t0)R.t=w.t0;};
  u.onend=()=>{if(SP.utt!==u)return;SP.ended=true;};
  u.onerror=e=>{if(SP.utt!==u)return;if(e&&(e.error==='interrupted'||e.error==='canceled'))return;console.warn('[rolka] synteza:',e&&e.error);R.mode='timer';SP.ended=true;paintMute();};
  try{speechSynthesis.speak(u);}catch(e){R.mode='timer';}}
function wordAt(S,t){let j=0;for(let k=0;k<S.words.length;k++)if(S.words[k].t0<=t)j=k;return j;}
/* Tryb 'audio': nagranie lektora (ElevenLabs) z czasami słów z transkrypcji — zegar rolki = audio.currentTime (czas nagrania).
   ?t= liczy klatkę z tych samych czasów, bez odtwarzania. Po końcu nagrania zegar idzie dalej sam (pauza przed quizem). */
const AU={el:null,doc:null,src:null,failed:false,rate:1,lastCt:-1,lastAt:0,moving:false,ended:false};
const safeRel=p=>typeof p==='string'&&/^[a-z0-9_-]+(\/[a-z0-9_.-]+)*\.(mp3|m4a|aac|ogg|wav|json)$/i.test(p)&&!/\.\./.test(p)?p:null;
function audioDur(){const a=AU.el;return a&&isFinite(a.duration)&&a.duration>0?a.duration:(+(AU.doc&&AU.doc.duration)||1e9);}
function audioOn(){return R.mode==='audio'&&!!AU.el&&!AU.failed;}
function initAudio(shot){if(!AU.src||!AU.doc)return;const a=new Audio();a.preload=shot?'none':'auto';a.src=AU.src;
  try{a.preservesPitch=true;a.webkitPreservesPitch=true;}catch(e){}
  a.addEventListener('error',()=>{if(AU.failed)return;AU.failed=true;console.warn('[rolka] nagranie lektora niedostępne:',AU.src);
    if(R.mode==='audio'){R.mode=SP.ok&&!SP.muted?'speech':'timer';if(R.playing)setPlaying(true);}paintMute();});
  a.addEventListener('ended',()=>{AU.ended=true;});AU.el=a;
  // nagranie jako blob: przewijanie działa także na serwerze bez nagłówka Range (python3 -m http.server); gdy już gra ze ścieżki, zostaje ścieżka
  if(!shot&&window.fetch&&window.URL&&URL.createObjectURL)fetch(AU.src).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.blob();})
    .then(b=>{if(AU.failed||!a.paused||a.currentTime>0)return;a.src=URL.createObjectURL(b);a.load();}).catch(()=>{});}
function audioPlay(){const a=AU.el;if(!a)return;a.playbackRate=AU.rate;a.defaultPlaybackRate=AU.rate;a.muted=SP.muted;
  if(R.t>=audioDur()-.03){AU.ended=true;return;}AU.ended=false;
  if(Math.abs(a.currentTime-R.t)>.06)try{a.currentTime=R.t;}catch(e){}AU.lastCt=-1;AU.moving=false;
  const pr=a.play();if(pr&&pr.catch)pr.catch(e=>{if(!R.playing||R.mode!=='audio')return;const n=e&&e.name;console.warn('[rolka] audio.play():',n);
    if(n==='NotAllowedError')setPlaying(false); // przeglądarka chce gestu: pokaż „odtwórz”, stuknięcie wznowi z dźwiękiem
    else if(n!=='AbortError'){AU.failed=true;R.mode=SP.ok&&!SP.muted?'speech':'timer';paintMute();}});}
function stepAudio(dt){const a=AU.el,D=audioDur();
  if(AU.ended||a.ended||R.t>=D-.02){AU.ended=true;R.t+=dt*AU.rate;return;}
  if(a.paused||a.seeking)return; // czeka na play() / bufor / przewinięcie
  // dociąganie między odczytami currentTime — dopiero gdy nagranie naprawdę ruszyło (po przewinięciu currentTime stoi, zanim zagra)
  const ct=a.currentTime,now=performance.now();if(ct!==AU.lastCt){AU.moving=AU.lastCt>=0;AU.lastCt=ct;AU.lastAt=now;}
  const est=AU.moving?ct+(now-AU.lastAt)/1000*(a.playbackRate||1):ct,tg=Math.min(est,ct+.25);
  R.t=tg<R.t-.08?tg:Math.max(R.t,tg);} // drobne drgania: zegar nie cofa się; większa rozbieżność: wracamy do nagrania
function step(dt){const TL=R.TL;let t=R.t;
  if(audioOn()){stepAudio(dt);return;}
  if(!speechOn()||t>=TL.T){R.t=t+dt;return;}
  const S=sceneAt(t);if(!S.words.length){R.t=t+dt;return;}
  const first=S.words[0].t0;
  if(SP.scene!==S.i){if(t+dt>=first&&t<S.speechEnd){speakScene(S.i,t<=first?0:wordAt(S,t));R.t=Math.max(t,first);return;}R.t=t+dt;return;}
  if(SP.ended){R.t=Math.max(t,S.speechEnd)+dt;if(R.t>=S.end)SP.scene=-2;return;}
  const est=S.speechEnd-first,el=(performance.now()-SP.startedAt)/1000;
  if(el>est*2.2+4){SP.ended=true;return;} // strażnik: brak zdarzenia końca
  let cap;if(SP.got){const nx=S.words[SP.word+1];cap=nx?nx.t0-.02:S.speechEnd-.02;}else cap=S.speechEnd-.04; // z granicami słów: nie wyprzedzaj następnego słowa
  R.t=Math.min(t+dt,Math.max(t,cap));}
function tick(now){requestAnimationFrame(tick);if(!R.playing){tick.last=0;return;}const dt=tick.last?Math.min(.1,(now-tick.last)/1000):0;tick.last=now;step(dt);sfxPump();render(R.t);}
function setPlaying(v){R.playing=v;$('pause').classList.toggle('on',!v&&!R.shot&&$('cover').classList.contains('off')&&R.t<R.TL.T);
  if(R.mode==='audio'&&AU.el){if(v)audioPlay();else AU.el.pause();return;}
  if(!v)stopSpeech();else if(speechOn()&&R.t<R.TL.T){const S=sceneAt(R.t);if(S.words.length&&R.t>=S.words[0].t0&&R.t<S.speechEnd)speakScene(S.i,wordAt(S,R.t));}}
function pickMode(){return AU.el&&!AU.failed?'audio':(SP.ok&&!SP.muted?'speech':'timer');}
function start(){R.mode=pickMode();R.answer=null;R.quizAt=null;paintQuiz();$('fox').style.zIndex='';sfxInit();sfxReset(0);
  R.t=0;tick.last=0;R.playing=true;$('pause').classList.remove('on');
  if(R.mode==='audio'){try{AU.el.currentTime=0;}catch(e){}audioPlay();} // play() w geście użytkownika (iOS)
  else if(speechOn()){const S=R.TL.scenes[0];speakScene(0,0);R.t=S.words.length?S.words[0].t0:0;} // pierwsze speak() w geście użytkownika (iOS)
  paintMute();render(R.t);}
function restart(play){stopSpeech();if(AU.el){AU.el.pause();try{AU.el.currentTime=0;}catch(e){}}R.answer=null;R.quizAt=null;paintQuiz();$('fox').style.zIndex='';resetStations();R.t=0;if(play)start();else render(0);}
function resetStations(){Object.values(EL.stG||{}).forEach(g=>{g.removeAttribute('transform');g.removeAttribute('opacity');});}
function paintMute(){const b=$('bMute');if(!b)return;const has=!!(AU.el&&!AU.failed)||SP.ok,on=has&&!SP.muted;b.innerHTML=on?ICON_SND:ICON_MUTE;
  b.setAttribute('aria-label',on?'Wycisz lektora':(has?'Włącz lektora':'Brak polskiego głosu — napisy w tempie szacowanym'));b.style.opacity=has?1:.5;}
function toggleMute(){const hasAudio=!!(AU.el&&!AU.failed);if(!hasAudio&&!SP.ok)return;SP.muted=!SP.muted;
  if(R.mode==='audio'||(hasAudio&&R.mode!=='speech'&&R.t<audioDur())){if(AU.el)AU.el.muted=SP.muted;if(R.mode!=='audio'&&!SP.muted&&hasAudio){R.mode='audio';if(R.playing)setPlaying(true);}}
  else if(SP.muted){stopSpeech();R.mode='timer';}else{R.mode='speech';if(R.playing)setPlaying(true);}paintMute();}
function seek(t){t=Math.max(0,t);stopSpeech();resetStations();if(t<R.TL.T+.15){R.quizAt=null;}
  if(AU.el&&R.mode==='audio'){AU.ended=t>=audioDur()-.03;if(!AU.ended)try{AU.el.currentTime=t;}catch(e){}AU.lastCt=-1;AU.moving=false;}
  R.t=t;sfxReset(t);render(t);if(R.playing&&(speechOn()||(R.mode==='audio'&&!AU.ended)))setPlaying(true);}

/* ============================================================ 10b. EFEKTY DŹWIĘKOWE (WebAudio, bez plików)
   Zdarzenia liczone przy kompilacji z akcji (pop: etykieta/karta, chime: rozdział, scratch: przekreślenie, whoosh: przelot kamery i przerywnik,
   thud: punch/impact, pop2: lis), pole "sfx" w akcji zmienia rodzaj albo wyłącza ("none"). Planowane z wyprzedzeniem 0,15 s na zegarze rolki
   (przy nagraniu: zegar nagrania, z jego tempem). Gdy lektor mówi, efekt jest ściszony do ~−18 dB, w przerwach ~−10 dB. Wyciszenie lektora wycisza też efekty. */
const SFX={ctx:null,out:null,noise:null,fired:new Set(),log:[]};
const SFX_KIND={pop:1,pop2:1,whoosh:1,thud:1,scratch:1,chime:1,ding:1,buzz:1,tick:1};
function sfxEvents(TL){const ev=[],add=(t,k)=>{if(isFinite(t)&&t>=0&&own(SFX_KIND,k))ev.push({t,kind:k});};
  const DEF={label:'pop',card:'pop',chapter:'chime',cutaway:'whoosh',fox:'pop2',impact:'thud',prop:'pop2',burst:'pop',badge:'tick'};
  TL.acts.forEach(a=>{if(a.sfx==='none'||a.type==='cam')return;let k=a.sfx||(own(DEF,a.type)?DEF[a.type]:null);if(a.type==='strike'&&!a.sfx)k=a.card?'scratch':null;add(a.t0,k);
    [a.lineT,a.rowT,a.tileT,a.stepT].forEach(L=>{if(L)L.forEach(t=>t!=null&&t>a.t0+.05&&add(t,'pop'));});if(a.landT!=null)add(a.landT,'pop');
    if(a.type==='prop'&&a.drop&&!a.sfx)add(a.t0+.3,'thud');if(a.litT!=null&&a.sfx!=='none')add(a.litT,'pop');if(a.chargeT!=null)add(a.chargeT,'pop');
    if(a.type==='packet'&&a.morph&&a.arrT!=null)add(a.arrT,'pop');if(a.type==='recap'&&a.stT&&a.sfx!=='none')a.stT.forEach(t=>add(t,'tick'));});
  TL.camKeys.forEach((k,j)=>{if(!j||(k.act&&k.act.sfx==='none'))return;const zr=Math.abs(Math.log(k.to.z/k.from.z));if(k.dist>150||zr>.4)add(k.t,k.act&&k.act.sfx&&k.act.sfx!=='none'?k.act.sfx:'whoosh');});
  TL.punches.forEach(p=>add(p.t,'thud'));
  ev.sort((a,b)=>a.t-b.t);const out=[];ev.forEach(e=>{if(out.some(o=>o.kind===e.kind&&e.t-o.t<.09))return;out.push(e);});
  const words=TL.scenes.flatMap(S=>S.words);out.forEach(e=>{e.duck=words.some(w=>e.t>=w.t0-.03&&e.t<w.t1+.05);});return out;}
function sfxInit(){if(SFX.ctx){if(SFX.ctx.state==='suspended')SFX.ctx.resume().catch(()=>{});return;}const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  try{const c=new AC(),comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=3;comp.connect(c.destination);SFX.out=c.createGain();SFX.out.gain.value=1;SFX.out.connect(comp);
    const n=c.createBuffer(1,Math.round(c.sampleRate*1.2),c.sampleRate),d=n.getChannelData(0),r=rng(99);for(let i=0;i<d.length;i++)d[i]=r()*2-1;SFX.noise=n;SFX.ctx=c;
    if(c.state==='suspended')c.resume().catch(()=>{});}catch(e){SFX.ctx=null;}}
function sfxReset(t){SFX.fired=new Set();if(!R.TL||!R.TL.sfx)return;R.TL.sfx.forEach((e,i)=>{if(e.t<t-.02)SFX.fired.add(i);});}
function sfxPump(){if(!SFX.ctx||!R.playing||!R.TL.sfx)return;const L=R.TL.sfx,t=R.t,rate=R.mode==='audio'?AU.rate:1;
  for(let i=0;i<L.length;i++){const e=L[i];if(e.t>t+.15)break;if(SFX.fired.has(i))continue;SFX.fired.add(i);if(e.t<t-.08||SP.muted)continue;
    const when=SFX.ctx.currentTime+Math.max(0,(e.t-t)/rate);sfxPlay(e.kind,when,e.duck?.125:.32);SFX.log.push({t:+e.t.toFixed(3),kind:e.kind,clock:+t.toFixed(3),duck:e.duck});}}
function sfxNow(kind){if(!SFX.ctx||SP.muted||R.shot)return;sfxPlay(kind,SFX.ctx.currentTime+.01,.45);SFX.log.push({t:+R.t.toFixed(3),kind,clock:+R.t.toFixed(3)});}
function sfxPlay(kind,w,g){const C=SFX.ctx;if(!C)return;
  const gain=()=>{const n=C.createGain();n.gain.value=0;n.connect(SFX.out);return n;};
  const env=(n,t0,a,peak,dec)=>{n.gain.setValueAtTime(.0001,t0);n.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),t0+a);n.gain.exponentialRampToValueAtTime(.0001,t0+a+dec);};
  const osc=(type,f0,f1,t0,dur,dst)=>{const o=C.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t0);if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t0+dur);o.connect(dst);o.start(t0);o.stop(t0+dur+.08);return o;};
  const noise=(t0,dur,ftype,f0,f1,q,dst)=>{const s=C.createBufferSource();s.buffer=SFX.noise;const f=C.createBiquadFilter();f.type=ftype;f.Q.value=q;f.frequency.setValueAtTime(f0,t0);
    if(f1&&f1!==f0)f.frequency.exponentialRampToValueAtTime(f1,t0+dur);s.connect(f);f.connect(dst);s.start(t0,Math.random()*.4);s.stop(t0+dur+.05);return f;};
  try{
  if(kind==='pop'){const a=gain();env(a,w,.004,g,.07);osc('sine',540,1150,w,.06,a);const b=gain();env(b,w,.001,g*.35,.025);noise(w,.03,'bandpass',3600,3600,2,b);}
  else if(kind==='pop2'){const a=gain();env(a,w,.006,g*.9,.12);osc('sine',290,760,w,.11,a);const b=gain();env(b,w+.03,.004,g*.35,.08);osc('triangle',600,1250,w+.03,.07,b);}
  else if(kind==='tick'){const a=gain();env(a,w,.002,g*.6,.03);osc('square',1800,1800,w,.03,a);}
  else if(kind==='whoosh'){const d=.46,a=C.createGain();a.connect(SFX.out);a.gain.setValueAtTime(0,w);a.gain.linearRampToValueAtTime(g*.85,w+d*.5);a.gain.linearRampToValueAtTime(0,w+d);
    const f=noise(w,d,'bandpass',320,2600,.9,a);f.frequency.setValueAtTime(320,w);f.frequency.exponentialRampToValueAtTime(2600,w+d*.55);f.frequency.exponentialRampToValueAtTime(700,w+d);}
  else if(kind==='thud'){const a=gain();env(a,w,.004,g*1.6,.32);osc('sine',140,42,w,.28,a);const b=gain();env(b,w,.002,g*.9,.12);noise(w,.14,'lowpass',260,260,.7,b);}
  else if(kind==='scratch'){const a=C.createGain();a.connect(SFX.out);a.gain.setValueAtTime(0,w);[[0,.07],[.09,.16],[.18,.26]].forEach(([s0,s1])=>{a.gain.linearRampToValueAtTime(g*.8,w+s0+.01);a.gain.linearRampToValueAtTime(.0001,w+s1);});
    noise(w,.27,'bandpass',1800,3400,3,a);}
  else if(kind==='chime'){[[784,0],[1175,.07]].forEach(([f,d])=>{const a=gain();env(a,w+d,.005,g*.7,.5);osc('sine',f,f,w+d,.55,a);});}
  else if(kind==='ding'){[[1046.5,0,1],[1568,.09,.8],[2093,.18,.45]].forEach(([f,d,k])=>{const a=gain();env(a,w+d,.004,g*k,.7);osc('sine',f,f,w+d,.75,a);});}
  else if(kind==='buzz'){[[0,.12],[.17,.32]].forEach(([s0,s1])=>{const a=gain();a.gain.setValueAtTime(0,w+s0);a.gain.linearRampToValueAtTime(g*.55,w+s0+.01);a.gain.linearRampToValueAtTime(0,w+s1);
    const lp=C.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;lp.connect(a);osc('square',150,140,w+s0,s1-s0,lp);});}
  }catch(e){}}

/* ============================================================ 11. START */
function fit(){const st=$('stage');const k=Math.min(innerWidth/SW,innerHeight/SH);const desk=innerWidth>SW+40;document.body.classList.toggle('fit',desk);
  const s=desk?Math.min(1.25,(innerHeight-36)/SH,(innerWidth-36)/SW):k;st.style.transform=s!==1?`scale(${s.toFixed(4)})`:'';}
async function boot(){fit();addEventListener('resize',fit);
  const q=new URLSearchParams(location.search);const name=(q.get('sb')||'rewolucja').replace(/[^a-z0-9_-]/gi,'');
  let sb=(window.ROLKA_STORYBOARDS||{})[name];
  if(!sb){try{const r=await fetch('storyboards/'+name+'.json',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);sb=await r.json();}
    catch(e){const er=$('err');er.classList.add('on');er.textContent='Nie udało się wczytać scenariusza „'+name+'” ('+e.message+'). Otwórz przez serwer (README).';return;}}
  // nagranie lektora: czasy słów (transkrypcja) są potrzebne już do osi czasu — także w trybie ?t= bez odtwarzania
  const A=sb.audio&&typeof sb.audio==='object'?sb.audio:null;
  if(A){if(Array.isArray(A.words))AU.doc={words:A.words,duration:+A.duration||0};
    else if(safeRel(A.words)){try{const r=await fetch(A.words,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);AU.doc=await r.json();}catch(e){console.warn('[rolka] brak czasów słów lektora ('+e.message+') — szacuję');}}
    AU.src=AU.doc?safeRel(A.src):null;AU.rate=clamp(+(q.get('rate')||A.rate||1)||1,.5,2);}
  // fonty muszą być gotowe przed pomiarem kart (dopasowanie czcionki) — ukryte elementy same ich nie wczytają
  try{await Promise.all(['800 19px "Bricolage Grotesque"','700 19px "Bricolage Grotesque"','800 15px "Plus Jakarta Sans"','700 15px "Plus Jakarta Sans"','600 15px "Plus Jakarta Sans"'].map(f=>document.fonts.load(f)));await document.fonts.ready;}catch(e){}
  setup(sb);initSpeech();R.shot=q.has('t')&&q.get('paused')==='1';initAudio(R.shot||q.has('t'));
  SP.muted=q.get('mute')==='1';paintMute();
  $('bMute').addEventListener('click',e=>{e.stopPropagation();toggleMute();});
  $('bRestart').addEventListener('click',e=>{e.stopPropagation();$('cover').classList.add('off');restart(true);});
  $('stage').addEventListener('click',()=>{if(!$('cover').classList.contains('off'))return;if(R.t>=R.TL.T)return;setPlaying(!R.playing);});
  addEventListener('keydown',e=>{if(e.key===' '){e.preventDefault();if($('cover').classList.contains('off'))setPlaying(!R.playing);}else if(e.key==='ArrowRight')seek(R.t+2);else if(e.key==='ArrowLeft')seek(R.t-2);else if(e.key==='r')restart(true);});
  requestAnimationFrame(tick);
  if(q.has('t')){R.shot=q.get('paused')==='1';document.body.classList.toggle('shot',R.shot);const t=+q.get('t')||0;
    if(q.has('answer')){R.quizAt=R.TL.T+.15;R.answer=+q.get('answer');R.answerAt=Math.max(R.quizAt,t-1.2);paintQuiz();}
    render(t);if(!R.shot){R.mode='timer';R.playing=true;}}
  else if(q.get('cover')!=='0'){$('cover').classList.remove('off');render(0);}
  else{render(0);}
  window.Rolka={seek:t=>{render(t);return R.t;},seekPlay:t=>{seek(t);return R.t;},duration:R.TL.T,play:()=>start(),pause:()=>setPlaying(false),answer:i=>{R.quizAt=R.quizAt==null?R.TL.T+.15:R.quizAt;R.answer=null;answer(i);},
    state:()=>({t:R.t,playing:R.playing,mode:R.mode,voice:AU.el&&!AU.failed?'nagranie: '+AU.src:(SP.voice?SP.voice.name:null),audioTime:AU.el?AU.el.currentTime:null,rate:AU.rate,align:R.TL.align,scenes:R.TL.scenes.map(S=>({start:+S.start.toFixed(2),end:+S.end.toFixed(2),words:S.words.length}))}),timeline:R.TL,sfx:()=>({events:R.TL.sfx,log:SFX.log.slice(),ctx:SFX.ctx?SFX.ctx.state:null})};
  document.documentElement.dataset.ready='1';}
boot();
})();
