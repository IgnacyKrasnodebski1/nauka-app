// Ikona i splash Cramfox: głowa lisa na limonkowym kafelku (ikona) i cały lis na ciemnym tle (splash)
const { Resvg } = require('@resvg/resvg-js');const fs=require('fs');
const {fox}=require('../fox/fox.js');
const O='#FF7A2F',D='#B8431A',K='#7A2A10',C='#FFF1E6',INK='#0E0C1C';
const head=`<polygon points="-44,-16 -32,-64 -8,-34" fill="${O}"/><polygon points="-36,-25 -31,-50 -17,-33" fill="${K}"/>
<polygon points="44,-16 32,-64 8,-34" fill="${O}"/><polygon points="36,-25 31,-50 17,-33" fill="${K}"/>
<path d="M-52 -12 Q-48 -42 0 -42 Q48 -42 52 -12 L22 30 Q0 44 -22 30 Z" transform="translate(0 6)" fill="${D}"/>
<path d="M-52 -12 Q-48 -42 0 -42 Q48 -42 52 -12 L22 30 Q0 44 -22 30 Z" fill="${O}"/>
<path d="M-52 -12 Q-30 -8 -12 10 L0 30 L12 10 Q30 -8 52 -12 L22 30 Q0 44 -22 30 Z" fill="${C}"/>
<path d="M-6 23 Q0 20 6 23 L0 29 Z" fill="${INK}"/>
<ellipse cx="-19" cy="-13" rx="4.5" ry="6" fill="${INK}"/><ellipse cx="19" cy="-13" rx="4.5" ry="6" fill="${INK}"/><circle cx="-17.5" cy="-15.5" r="1.6" fill="#fff"/><circle cx="20.5" cy="-15.5" r="1.6" fill="#fff"/>
<path d="M-5 32 Q-2.5 35 0 32 Q2.5 35 5 32" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
<g fill="none" stroke="${INK}" stroke-width="4"><circle cx="-19" cy="-13" r="13"/><circle cx="19" cy="-13" r="13"/><line x1="-6" y1="-14" x2="6" y2="-14"/></g>`;
const icon=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<rect width="1024" height="1024" fill="${INK}"/><circle cx="880" cy="140" r="300" fill="#2A1240"/>
<rect x="172" y="212" width="680" height="680" rx="170" fill="#6FA800"/><rect x="172" y="172" width="680" height="680" rx="170" fill="#B4FF3A"/>
<g transform="translate(512 568) scale(5.2)">${head}</g></svg>`;
const S=2732,fw=1000;
const body=fox('idle',fw).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
const splash=`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" fill="${INK}"/>
<g transform="translate(${(S-fw)/2} ${(S-fw*170/160)/2}) scale(${fw/160})">${body}</g></svg>`;
fs.writeFileSync('icon/icon2.svg',icon);
fs.writeFileSync('icon/icon2-rgba.png',new Resvg(icon,{background:INK}).render().asPng());
fs.writeFileSync('icon/splash2-rgba.png',new Resvg(splash,{background:INK}).render().asPng());
console.log('ok');
