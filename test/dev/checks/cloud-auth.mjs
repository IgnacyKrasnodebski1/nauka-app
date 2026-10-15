#!/usr/bin/env node
/* Kontrole: P1-21 (hasło — część tymczasowa), P2-43 (odwołana sesja → czyste logowanie), P0-3/P0-4 w apce (linki prawne i kontakt z cloud-config),
   P1-25 (usuwanie konta bez słowa o płatnościach), P1-26 (wersja i wycofanie zgody na AI), P2-27 (teksty arkusza „Twoje dane”).
   Atrapa backendu, nic nie wychodzi poza localhost.  Użycie (z test/): node dev/checks/cloud-auth.mjs [--out KATALOG] */
import {start,page,close,check,section,done,shot,tap,fill,waitFor,has,text,view,sleep,TEST_CONFIG} from './cloud-lib.mjs';

const PAY=/\bPro\b|płat|subskryp|premium|zakup/i; // BIBLIA §12.1
await start();

section('rejestracja: domyślna zakładka, pokaż hasło, sprawdzenie adresu');
{const r=await page('mock=fresh&reset=1');
  await waitFor(r,'#cf-go');
  check(await r.pg.evaluate(()=>document.querySelector('.cftab.on')?.dataset.m)==='signup','nowe urządzenie → „Załóż konto”');
  check(!(await has(r,'#cf-legal')),'bez adresów w cloud-config stopka z linkami ukryta');
  check(!(await has(r,'#cf-forgot')),'„Nie pamiętasz hasła?” ukryte na starcie');
  await tap(r,'#cf-show');check(await r.pg.evaluate(()=>document.getElementById('cf-pass').type)==='text','„Pokaż hasło” odsłania hasło');
  check(await r.pg.evaluate(()=>document.getElementById('cf-show').textContent)==='Ukryj hasło','przycisk zmienia się na „Ukryj hasło”');
  await tap(r,'#cf-show');check(await r.pg.evaluate(()=>document.getElementById('cf-pass').type)==='password','„Ukryj hasło” chowa hasło');
  await fill(r,'#cf-email','nowy.uczen@example.test');await fill(r,'#cf-pass','haslo-testowe-1');await tap(r,'#cf-age');
  await tap(r,'#cf-go');await waitFor(r,'#sheet','Sprawdź adres e-mail');
  check((await text(r)).includes('nowy.uczen@example.test'),'arkusz pokazuje wpisany adres');
  await shot(r,'auth-signup-confirm');
  await tap(r,'#askno');
  check(await r.pg.evaluate(()=>window.MOCK.db().users.length)===0,'„Popraw adres” nie zakłada konta');
  await tap(r,'#cf-go');await waitFor(r,'#sheet','Sprawdź adres e-mail');await tap(r,'#askok',null,{settle:2500});
  check(await r.pg.evaluate(()=>window.MOCK.db().users.length)===1,'„Załóż konto” zakłada konto');
  await close(r);}

section('logowanie: znane urządzenie, zły login, kontakt, linki prawne');
{const r=await page('mock=seeded&reset=1',{config:TEST_CONFIG,settle:2500});
  await r.pg.evaluate(()=>window.NaukaEngine.go('settings'));await sleep(500);
  for(const t of ['Zgoda na AI','Pomoc i kontakt','Polityka prywatności','Regulamin','Licencje'])check(await has(r,'.setrow',t),`Ustawienia: wiersz „${t}”`);
  check((await text(r)).includes('pomoc@example.test'),'Ustawienia: adres pomocy widoczny');
  await shot(r,'settings-account-help');
  // arkusz „Twoje dane”
  await tap(r,'#set-privacy');const pt=await text(r);
  check(pt.includes('Dostęp do nich masz Ty; nasz serwer pobiera je tylko, żeby utworzyć lekcję'),'„Twoje dane”: poprawione zdanie o dostępie');
  check(!/Dostęp masz tylko Ty/.test(pt),'„Twoje dane”: bez nieprawdziwego „Dostęp masz tylko Ty”');
  check(/Pytamy o zgodę/.test(pt)&&!/Pytasz o zgodę/.test(pt),'„Pytamy o zgodę” (P2-27)');
  check(!/Google/.test(pt),'„Twoje dane”: bez punktu o Google Fonts (fonty wbudowane)');
  check(/Anthropic \(USA\)/.test(pt),'„Twoje dane”: wzmianka o USA');
  check(await has(r,'#cfp-links .linkbtn','Pełna polityka prywatności'),'„Twoje dane”: link do pełnej polityki');
  await shot(r,'settings-privacy-sheet');await tap(r,'#cfp-ok');
  // zgoda na AI: wycofanie i ponowne udzielenie
  const cons0=await r.pg.evaluate(()=>document.querySelector('#set-consent .s').textContent);
  check(/^udzielona \d\d\.\d\d\.\d{4} · dotknij, żeby wycofać$/.test(cons0),'zgoda: data udzielenia',cons0);
  await tap(r,'#set-consent');await waitFor(r,'#sheet','Wycofać zgodę');await tap(r,'#askok');
  const m1=await r.pg.evaluate(()=>({c:window.NaukaEngine.meta().aiConsent,v:window.NaukaEngine.meta().aiConsentV,s:document.querySelector('#set-consent .s').textContent}));
  check(!m1.c&&!m1.v,'wycofanie czyści META.aiConsent i aiConsentV',JSON.stringify(m1));
  check(/nieudzielona/.test(m1.s),'wiersz pokazuje „nieudzielona”',m1.s);
  await tap(r,'#set-consent');await waitFor(r,'#sheet','Zanim zaczniemy');
  check(/Claude firmy Anthropic \(USA\)/.test(await text(r)),'tekst zgody z USA');
  check(/wycofasz w Ustawieniach/.test(await text(r)),'tekst zgody mówi, gdzie ją wycofać');
  await shot(r,'consent-sheet');
  await tap(r,'#cfc-ok');
  const m2=await r.pg.evaluate(()=>({c:window.NaukaEngine.meta().aiConsent,v:window.NaukaEngine.meta().aiConsentV}));
  check(!!m2.c&&m2.v===1,'ponowna zgoda zapisuje datę i wersję 1',JSON.stringify(m2));
  // licencje
  await tap(r,'#set-licenses');check(/SIL Open Font License 1\.1/.test(await text(r)),'„Licencje”: OFL dla fontów');await tap(r,'#cfl-ok');
  // wylogowanie → logowanie na zakładce „Zaloguj się”
  await tap(r,'#set-logout');await waitFor(r,'#sheet','Wylogować');await tap(r,'#askok',null,{settle:3000});
  await waitFor(r,'#cf-go',null,10000);
  check(await r.pg.evaluate(()=>document.querySelector('.cftab.on')?.dataset.m)==='signin','po wylogowaniu → zakładka „Zaloguj się”');
  check(await r.pg.evaluate(()=>[...document.querySelectorAll('#cf-legal .linkbtn')].map(b=>b.textContent).join('|'))==='Polityka prywatności|Regulamin|Pomoc i kontakt','stopka logowania: trzy linki');
  await fill(r,'#cf-email','test@cramfox.test');await fill(r,'#cf-pass','zle-haslo');await tap(r,'#cf-go',null,{settle:1200});
  check((await text(r)).includes('Zły e-mail albo hasło.'),'zły login → komunikat');
  check(await has(r,'#cf-forgot','Nie pamiętasz hasła'),'po złym logowaniu: „Nie pamiętasz hasła? Napisz do nas”');
  await shot(r,'auth-signin-forgot');
  check(!PAY.test(await text(r)),'bez słów o płatnościach');
  await close(r);}

section('odwołana sesja (auth=revoked) → logowanie bez „Serwer chwilowo nie odpowiada”');
{const r=await page('mock=seeded&reset=1&auth=revoked',{settle:100});
  const seen=[];for(let i=0;i<30;i++){seen.push(await text(r).catch(()=>''));if(await has(r,'#cf-go'))break;await sleep(150);}
  check(await has(r,'#cf-go'),'ekran logowania');
  check(!seen.some(t=>/Serwer chwilowo nie odpowiada/.test(t)),'ani przez chwilę „Serwer chwilowo nie odpowiada”');
  check((await text(r)).includes('Sesja wygasła — zaloguj się ponownie.'),'komunikat o wygasłej sesji');
  check(await r.pg.evaluate(()=>document.querySelector('.cftab.on')?.dataset.m)==='signin','zakładka „Zaloguj się”');
  await shot(r,'auth-revoked');
  await close(r);}

section('usuwanie konta z aktywną subskrypcją (del=active_subscription)');
{const r=await page('mock=seeded&reset=1&del=active_subscription',{config:TEST_CONFIG,settle:2500});
  await r.pg.evaluate(()=>window.NaukaEngine.go('settings'));await sleep(400);
  await tap(r,'#set-delete');await tap(r,'#cfdel-go',null,{settle:1500});
  const t=await r.pg.evaluate(()=>document.getElementById('cfdel-err').textContent);
  check(t==='Nie możemy teraz usunąć tego konta automatycznie. Napisz do nas: pomoc@example.test — usuniemy je ręcznie.','komunikat P1-25 z adresem',t);
  check(!PAY.test(t),'bez słów o płatnościach',t);
  await shot(r,'delete-active-subscription');
  await close(r);}

section('bez adresów w cloud-config: wiersze ukryte, „Licencje” zostaje');
{const r=await page('mock=seeded&reset=1',{settle:2500});
  await r.pg.evaluate(()=>window.NaukaEngine.go('settings'));await sleep(400);
  for(const t of ['Pomoc i kontakt','Polityka prywatności','Regulamin'])check(!(await has(r,'.setrow',t)),`brak wiersza „${t}”`);
  check(await has(r,'.setrow','Licencje'),'wiersz „Licencje”');
  check(r.errors.length===0,'bez błędów w konsoli',r.errors.join(' | '));
  await close(r);}

await done();
