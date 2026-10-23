# Cramfox — dev bez backendu (atrapa) i zrzuty ekranów

`test/dev/index.html` to ta sama apka co `/index.html` (5 skryptów: cloud-config → cloud → engine → media → cloud-ui, `styles.css` + `media.css`), ale z **atrapą backendu** ładowaną na początku (`mock-backend.js`). Atrapa podmienia `fetch` i udaje Supabase (konto, baza, pliki, TUS, tabela i bucket `media`) oraz API (`/api/me`, `/api/generate` — temat z `test/fixtures/*.json`, `/api/media/reels|podcast|podcast/chapter`, `/api/fox`). **Nic nie idzie do produkcji** i nic nie kosztuje. Stan „serwera” trzyma w `localStorage` (`mockbe:*`), więc przeładowanie zachowuje się jak prawdziwy backend.

## Uruchomienie

```sh
# z katalogu głównego repo
python3 -m http.server 8765
```

Otwórz w przeglądarce (najlepiej w trybie urządzenia mobilnego w DevTools):

- http://localhost:8765/test/dev/?mock=fresh&reset=1 — nowe konto od zera (rejestracja → etap → cel → pusty „Dziś”)
- http://localhost:8765/test/dev/?mock=seeded&reset=1 — konto testowe z 2 przedmiotami i postępami, od razu zalogowane
- http://localhost:8765/test/dev/?mock=seeded&reset=1&gen=slow:30 — generowanie trwa 30 s
- http://localhost:8765/test/dev/?mock=seeded&reset=1&gen=err:limit_reached — błąd limitu przy tworzeniu lekcji (konto z okresem startowym: limit miesięczny)
- http://localhost:8765/test/dev/?mock=seeded&reset=1&trial=-2&used=2 — plan free po okresie startowym: obie darmowe lekcje wykorzystane (backend/0007: 2 na zawsze, bez odnawiania; `plan=free&used=N` to samo bez zmiany profilu)
- http://localhost:8765/test/dev/?mock=seeded&reset=1&plan=free&global=full — limit serwera na dobę pełny (`quota.globalOpen=false`): komunikat „Spróbuj później” przed aparatem
- http://localhost:8765/test/dev/?mock=seeded&reset=1&gen=err:lost:ai_timeout — kody backendu Build 7 (`err:KOD[:reason]`: `busy`, `too_long`, `lost:ai_timeout`, `reserve_failed:ai_upload`, `download_failed:slow_intake`)
- http://localhost:8765/test/dev/?mock=seeded&reset=1&cap=storage — limity konta z `backend/0008` (`cap=storage|materials|subjects`)
- http://localhost:8765/test/dev/?mock=seeded&reset=1&gen=err:ai_unavailable — AI nie działa po naszej stronie, limit zwrócony (`backend/0009`, incydent 2026-10-16; `:charged` — naliczenie zostaje, `:precharge` — przed naliczeniem; `gen=droprelease` — to samo przy odzyskiwaniu; `gen=err:api:material|401|400` — kształty błędu `api`; `oldbe=1` — backend sprzed 0009, bez pola `charged`)

### Centrum przedmiotu, rolki, podcast, rozmowa z lisem (docs/plan-media.md, spec docs/design-centrum.md)

Konto `mock=msgip` ma jeden przedmiot jak w makietach (spec §3): „Międzynarodowe stosunki gospodarcze i polityczne”, 3 materiały z `test/fixtures/topic-msgip*.json` (z `keyPoints`), postępy dające materiał 01 = U 6 · W 2 · R 2 · N 3, przedmiot = 27 punktów (8/4/2/13), Powtórkę 12 na dziś, próbny 64% i gotowość 40%. Dzień makiet to czwartek 22 października 2026 — `clock=2026-10-22` daje dokładnie te daty.

- http://localhost:8765/test/dev/?mock=msgip&reset=1 — Main: lekcja 4 przerwana, sprawdzian za 6 dni, rolki 01 gotowe (2/5 obejrzane), podcast 01 (rozdziały 1–2 nagrane), rolki 02 w przygotowaniu
- `…&msgip=new` — Centrum-Nowy (tylko materiał 01, zero postępów); `…&msgip=known&exam=none` — wszystko „Umiem” (NA TERAZ = egzamin ustny)
- `…&exam=0` / `exam=1` / `exam=none` — sprawdzian dziś (rozgrzewka) / jutro (noc przed) / bez daty; `…&lsave=0` — bez przerwanej lekcji (NA TERAZ = Szop)
- `…&media=ready` — tylko gotowe media materiału 01 (można przygotować rolki dla 02 i 03); `media=none|running|failed`; `mrun=20` — rolki 02 kończą się po ok. 20 s
- `…&media=ready&mediagen=slow:30` — przygotowanie trwa 30 s (kroki plan → script → voice → save); `mediagen=fail:invalid_output` — porażka po naszej stronie (zwrot), `fail:refusal` — z naliczeniem
- `…&mediaerr=busy|limit_reached:lifetime|month|daily|global|tts_unavailable|voices_missing|ai_unavailable|unknown` — odpowiedzi POST mediów; `unknown` = wiersz powstaje, odpowiedź ginie
- `…&mq=0` — zero tworzeń rolek/podcastu (zaproszenia znikają); `mplan=pro` — 30 w miesiącu; `voices=0` — podcast „wkrótce”; `reels=0` — bez ElevenLabs; `fox=0` — bez rozmowy z lisem
- `…&chat=5` / `chat=0` — ile wiadomości do lisa zostało dziś; `foxerr=ai_unavailable|fox_failed|limit_reached:chat_daily|unknown`; `chapter=busy|err:synth_failed|err:chapter_failing|slow:20` — nagrywanie rozdziału
- `…&nomedia=1` — backend bez migracji 0010 (`/api/me` media/chat = null, tabela media nie istnieje)
- `…&mediafx=xss&media=ready&foxfx=xss` — manifesty, scenariusze rolek, skrypt podcastu i odpowiedzi lisa z próbami XSS i emoji; `mock=seeded&extra=kp` — przypadki brzegowe `keyPoints`

Atrapa udaje backend z 0010: tabelę `media` (RLS, SELECT tylko na kolumny z planu §2.5 — `select=*` = 42501), prywatny bucket `media` (`object/authenticated/media/<uid>/<id>/<plik>`, usuwanie własnych plików, zapis tylko „serwer”), `POST /api/media/reels|podcast` (idempotencja po `requestId`, busy, limity, 202 i praca „w tle”, zwrot przy porażce), `POST /api/media/podcast/chapter` (nagranie na żądanie, pamięć podręczna, `chapter_busy`) i `POST /api/fox` (tury liczone przez serwer — kopia `foxPlan()` z `nauka-backend/packages/ai/src/media/fox.ts`: chip „Podpowiedz” nie jest odpowiedzią, „Nie wiem” jest; `too_many_turns` / `bad_step` / `bad_point` przed naliczeniem; licznik wiadomości, zwrot przy błędzie AI). Punkty tematu liczy kopia `topicPoints()` z `@nauka/shared media.ts`, więc surowe id (`p3`, `Ll2`) są te same co w apce (`keypoints.mjs` to sprawdza). Rolki dowolnego materiału dostają manifest z jego punktów i pytań; pliki rolek to dwa krótkie scenariusze (`test/fixtures/media/sb-a.json`, `sb-b.json`) z ciszą MP3 i czasami słów. Fixture'y odtwarza `node test/fixtures/make-msgip.mjs` i `node test/fixtures/media/make-media.mjs` (bez sieci, bez ElevenLabs). Manifest rolek ma długości z makiet (4:31), ale nagrania są krótkie (ok. 15 s); rozdziały podcastu 1–2 trwają 36 s i 32 s, więc długość podcastu w apce to 21:13, nie 26:40 z makiety.

W konsoli: `MOCK.posts('reels'|'podcast'|'chapter'|'fox'|'generate')` (ile POST-ów), `MOCK.media()`, `MOCK.mobjects()`, `MOCK.set('mediaerr','busy')`, `MOCK.set('mq','0')`.

`reset=1` czyści stan atrapy i apki (raz — parametr znika z adresu). Bez `reset` stan zostaje między przeładowaniami. Wszystkie parametry (`gen`, `genfx`, `upload`, `cap`, `net`, `sync`, `fail`, `auth`, `plan`, `used`, `trial`, `freecap`, `global`, `clock`, `nostore`, `native`, `lang`, `extra`, `away`, `weekly`, `lat`, `log` oraz centrum i media: `msgip`, `exam`, `lsave`, `media`, `mrun`, `mediagen`, `mediaerr`, `mediafx`, `mq`, `mplan`, `reels`, `voices`, `fox`, `chat`, `foxerr`, `foxfx`, `chapter`, `nomedia`) są opisane na początku `mock-backend.js`.

Konto testowe (tylko w atrapie): `test@cramfox.test` / `cramfox-test-1` (`?mock=seeded&reset=1&login=0` — logowanie ręczne).

W konsoli przeglądarki: `MOCK.db()` (stan serwera), `MOCK.log` (ostatnie żądania), `MOCK.set('gen','err:api')` (zmiana bez przeładowania), `MOCK.reset('seeded')`.

## Zrzuty ekranów (wszystkie ekrany i stany)

```sh
cd test
npm install                      # puppeteer-core (bez pobierania Chrome — używa /Applications/Google Chrome.app)
node dev/shoot.mjs --out /ścieżka/na/zrzuty
node dev/shoot.mjs --only fresh,errors     # wybrane scenariusze
```

Skrypt sam stawia serwer plików (port 8790), przechodzi przez scenariusze `fresh, seeded, comeback, monday, errors, boot, nostore, xss, narrow, native` oraz centrum i media `hub, today, reels, podcast, fox, limits, narrowhub` (ostatni: centrum, materiał 02, Dziś, Lis-Tryby, pauza podcastu i dzień sprawdzianu w 360×780) w rozmiarze iPhone'a (375×812 @2x, dotyk, ograniczone animacje; część 360×780) i zapisuje `NN-nazwa.png` oraz `INDEX.md` (plik → stan → jak dojść) z listą problemów wykrytych automatycznie: błędy w konsoli, emoji w UI, poziome przewijanie, XSS (`window.__pwned`), liczba wywołań `/api/generate` (dokładnie jedno na próbę), pasek offline po powrocie sieci, żądania do Google Fonts (fonty są wbudowane). Chrome blokuje każde żądanie poza localhost. Całość trwa ok. 10 minut.

## Kontrole Build 7 (`test/dev/checks/`)

```sh
cd test
node dev/checks/build7-engine.mjs --out /ścieżka   # silnik: egzamin, zmiana dnia, pasek offline, toasty, kontrast, wyjaśnienia, wznowienie lekcji (też X przy panelu odpowiedzi), fiszki, nazwy
node dev/checks/cloud-auth.mjs                     # logowanie, „Sprawdź adres e-mail”, linki prawne, usuwanie konta
node dev/checks/cloud-sync.mjs                     # strażnik przed wyzerowaniem postępów (P1-6, też zgubiony epoch i META), scalanie serii, zmiana dnia po pull
node dev/checks/cloud-gen.mjs                      # generowanie: limit przed aparatem (darmowe na zawsze i miesięczny), okres startowy, nowe konto bez triala, 504 → odzyskiwanie, kody Build 7, ai_unavailable i pole charged (0009), ekran postępu, wiersz na Dziś, zgoda przy TWÓRZ, dziennik przed POST
node dev/checks/cloud-hooks.mjs                    # hooki silnika: todayTop, addOpen, addSheet, settingsAbout
node dev/checks/cloud-fonts.mjs                    # fonty w buildzie (WOFF w data:), CSP bez Google
node dev/checks/cloud-content.mjs                  # emoji z treści AI, limity konta z backend/0008 → kody klienta, aiConsentV w options
```

## Kontrole centrum przedmiotu i mediów (plan-media §6.5)

```sh
cd test
node dev/checks/hub.mjs                   # nawigacja D6, Main (kolejność sekcji, opanowanie 6/2/2/3 i 8/4/2/13, gotowość 40%), PointSheet, HowSheet, Material, NA TERAZ (D5: dziś/jutro/przerwana lekcja/Szop/lekcja 1/egzamin ustny), „?” < 10 odpowiedzi, Nowy, zaproszenia przy mq=0, podcast „wkrótce”, fox=0, nomedia, stare tematy = punkt na poziom, Dziś; poprawki z przeglądu 2026-10-23 (zajrzenie do zrobionej lekcji bez zapisu, plan dnia = NA TERAZ: egzamin ustny, Szop ≥ 2, krok planu, bez nowych rzeczy w dniu/przeddzień sprawdzianu, cofanie ukrycia punktu, pasek dni, nazwy punktów bez łamania w środku słowa)
node dev/checks/keypoints.mjs             # keyPoints → punkty silnika, przypadki brzegowe (XSS, złe/zdublowane odwołania, scalanie, punkt zastępczy, < 3 punkty), treść mediów z XSS, CSP media-src blob:, kolejność skryptów
node dev/checks/media.mjs [--only A|B]    # A: kontrakt atrapy (bez UI); B: przygotowanie (1 POST na stuknięcie, bez ponowień, copy limitów), seria → pytanie → SRS, przewijanie, podcast (rozdział na żądanie, pauza → SRS, pozycja, mini), usunięcie konta
node dev/checks/fox.mjs [--only A|B]      # A: kontrakt /api/fox; B: Lis-Tryby (limit), Wytłumacz mi (feedback, źródło, oral, bez SRS), błędy, Egzamin ustny (ocena w skali, luki, ZRÓB ROLKĘ)
```

Od centrum przedmiotu (D6) nie ma ścieżki z zakładkami: `build7-engine.mjs` i stare scenariusze `shoot.mjs` otwierają narzędzia przez `NaukaEngine.openSubject(sid, 'fiszki'|'quiz'|'cwicz'|'egzamin'|'info')`, lekcję przez `openLevel(sid, lid)` (pierwsza niezaliczona = dawny węzeł „ZACZNIJ”), przerwaną lekcję przez kartę NA TERAZ („DOKOŃCZ LEKCJĘ”), bossa przez kafel „Pojedynek z Szopem”, a wyjście do Dziś przez `go('today')`. Skrzynie zniknęły razem ze ścieżką (spec §2).

Każdy ekran jest sprawdzany też pod kątem: emoji, słów o płatnościach / cenie / planie Pro / kupowaniu (App Store 3.1.1; w `shoot.mjs` bez treści materiału użytkownika — lekcji, zadań, quizu i paneli z wyjaśnieniem, bo np. ekonomia mówi o „cenach”), wykonanego XSS (`window.__pwned`), poziomego przewijania, przycisków mikrofonu (tryb głosowy jest na później), błędów w konsoli i żądań poza localhost. Zrzuty z kontroli: `test/dev/shots/checks/`. Strażnik czasu: `--timeout MIN` (domyślnie 20).

Zrzuty do porównania z makietami `design/centrum/*.dc.html` (390×844, mock=msgip, `clock=2026-10-22`):

```sh
node dev/shoot.mjs --only hub,today,reels,podcast,fox,limits --out /ścieżka
```

Każdy skrypt stawia własny serwer (losowy port), blokuje wszystko poza localhost i kończy się kodem 1, gdy któraś kontrola nie przeszła.

Atrapa i skrypt nie wchodzą do `build/` ani do apki na iOS.
