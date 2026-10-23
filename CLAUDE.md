# CLAUDE.md — kontekst projektu dla Claude Code

## Czym jest ten projekt
**Cramfox** (repo `nauka-app`) — apka do nauki w stylu Duolingo z lisem-maskotką. Użytkownik zakłada konto, startuje z pustą listą i **sam tworzy przedmioty z własnych materiałów** (zdjęcia stron, PDF, wklejony tekst) — backend z AI (Claude) zamienia je w poziomy, roladkę, fiszki, quizy i zadania. Tryby: centrum przedmiotu (kluczowe punkty z opanowaniem, „NA TERAZ”, materiały jako rozdziały 01/02/03 — zastąpiło ścieżkę poziomów), lekcje, fiszki, quiz, egzamin, powtórka SRS, plan do sprawdzianu, rolki (seria krótkich filmów z lektorem z jednego materiału), podcast „Lis i Szop”, rozmowa z lisem (3 tryby tekstowe), gamifikacja (seria, kamienie milowe, gemy, misje, boss — Szop Zapominalski). Spec: `docs/design-centrum.md`, kontrakty: `docs/plan-media.md`.

**Vanilla JS, bez frameworków i bundlera.** Buduje się do jednego pliku `build/nauka-all.html`, który Capacitor pakuje jako apkę iOS (`native/`).

## Struktura
```
cloud-config.js  # URL Supabase, publiczny klucz anon, URL API (wartości publiczne)
cloud.js         # chmura bez UI: sesja, REST do Supabase, Storage, API (CapacitorHttp), cache, mapper, sanitizer, sync, generowanie
engine.js        # silnik (jedno IIFE): router, Dziś, centrum przedmiotu i materiału, punkty/opanowanie, lekcja, zadania, fiszki, egzamin, gamifikacja, lis, szop
media.js         # rolki (odtwarzacz z prototypu test/proto/rolka), podcast „Lis i Szop”, rozmowa z lisem, arkusz „Przygotuj” — window.NaukaMedia; bez własnego fetch (tylko NAUKA_CLOUD)
cloud-ui.js      # UI chmury: start z konta, logowanie, karta „Konto”, dodawanie materiału, generowanie, „przedmiot gotowy”, rejestr mediów i toasty „gotowe”
styles.css       # style (tokeny z design/tokens.css), bez gradientów i kół w tle; media.css — style media.js (.mx-*, .reel)
fonts/           # wbudowane fonty (TTF, OFL) + fonts.css — bez Google Fonts; build.js wkleja je jako WOFF w data:
index.html       # wersja dev — ładuje fonts/fonts.css, styles.css, media.css i 5 skryptów przez <script src> (kolejność ma znaczenie)
build.js         # `node build.js` → build/nauka-all.html (+ CSP z hashami skryptów, fonty w data:)
backend/         # migracje SQL do Supabase (wgrywane przez CLI); 0010_media.sql = media, czat z lisem, bucket `media`
native/          # Capacitor iOS: `npm run sync` kopiuje build do Xcode
design/          # handoff designu 2.0 (DESIGN.md, tokens.css, makiety)
test/fixtures/   # tematy w formacie backendu do testów (w tym próby XSS)
test/dev/        # atrapa backendu (też media i /api/fox), shoot.mjs (zrzuty wszystkich ekranów) i checks/ (Build 7 + hub/keypoints/media/fox) — patrz test/dev/README.md
docs/            # BIBLIA.md = pełna dokumentacja projektu (czytaj przed większą zmianą); design-centrum.md = spec centrum i mediów; plan-media.md = kontrakty; plan-wyklady.md = plan Etapu 2
```

## Backend (istniejący, z gałęzi `origin/claude/peaceful-hamilton-jy11e3`)
- **Supabase** `zhgxhdsnizujzygpcyfl` (eu-central-1): konta e-mail + hasło (bez potwierdzania maila), tabele `subjects`, `topics` (JSONB `TopicContent`), `materials`, `generations`, `profiles`, `usage`; bucket `materials` (`{uid}/{uuid}.ext`). Tabela `app_state` (postępy Cramfoxa jako jeden blob) i RPC `delete_my_account()` — z `backend/0004_cramfox.sql`.
- **API** `https://nauka-jet.vercel.app`: `POST /api/generate` (synchronicznie ~2 min), `GET /api/me`. **API nie ma CORS** — na iOS wołamy je natywnie przez `Capacitor.Plugins.CapacitorHttp` (tylko `readTimeout`, bez `connectTimeout`!), w przeglądarce przez lokalne proxy.
- Plany (od migracji 0007, decyzja z 2026-10-15): **nowe konto = free bez triala: 2 tworzenia lekcji NA ZAWSZE** (bez odnawiania; liczy się każde naliczenie, także nieudane; licznik w `free_generation_ledger` po skrócie sha256 adresu e-mail — przeżywa usunięcie konta, ponowna rejestracja tym samym adresem nie daje nowych). Konta sprzed 0007 z trialem w toku zostają na pro do `trial_until`, potem free z pełnymi 2 (generacje z triala się nie liczą). Pro bez zmian: 150/mies. (przyszłe pakiety IAP z wyższymi limitami → `pro`). Do 0007 było: 30 dni pro dla nowych kont Cramfoxa, free 3/mies., 300/dobę globalnie.
- Bezpieczniki: 20 generacji/dobę na konto, globalnie **30/dobę** (z tego konta free najwyżej **20**), jedna generacja naraz (409 `busy`). Limit globalny, pula free i darmowe 2 są w tabeli `app_config` (zmiana bez migracji, SQL Editor; `docs/BIBLIA.md` §7.5). Reset jednego adresu: `select public.reset_free_generations('adres')` (nie kasować wierszy ledgera ręcznie).
- `/api/me` ma `quota: {plan, scope:'lifetime'|'month', used, limit, remaining, trialUntil, freeLimit, globalOpen}`; 402 `limit_reached` dla free ma `scope:'lifetime'`. UI: „Darmowe tworzenie lekcji: zostało 1 z 2”, „Wykorzystano obie darmowe lekcje” + „Możesz dalej uczyć się z przedmiotów, które masz.” — nigdy słowa o zakupie.
- Build 7 (niewdrożony): RPC `reserve_generation` / `finish_generation` i sweeper (`backend/0007_generation_guards.sql`), limity konta na Storage i wiersze (`backend/0008_account_limits.sql`). Kolejność: 0007 → backend → 0008 → apka.
- Centrum i media (niewdrożone, `backend/0010_media.sql`): tabela `media` (klient czyta dokładnie kolumny `MEDIA_SEL` z `cloud.js`, nigdy `select=*`), prywatny bucket **`media`** (`{uid}/{mediaId}/{plik}`, właściciel czyta i usuwa, pisze tylko serwer), trasy `POST /api/media/reels|podcast|podcast/chapter` i `POST /api/fox`, w `/api/me` pola `media`, `chat`, `features`. **Osobna pula tworzeń rolek i podcastu** (nigdy nie zużywa 2 darmowych lekcji): free `free_media_lifetime` = 3 na zawsze (po skrócie adresu e-mail, jak lekcje), pro `pro_media_month` = 30/mies.; 5 prób na konto/dobę, globalnie 60 tworzeń i 150 prób/dobę; jedno tworzenie naraz, zwrot przy błędzie po naszej stronie. Wszystkie liczniki z `media_ledger` (przeżywa usunięcie materiału i konta; wiersz `media` znika kaskadą z tematem). Podcast: scenariusz raz na materiał (`eleven_flash_v2_5`), audio rozdziału nagrywane dopiero gdy użytkownik go włączy (bez naliczenia; 3 nieudane nagrania rozdziału w dobie → 429 `chapter_failing`); rolki `eleven_v4`, budżet znaków `tts_budget` przed każdą rolką. Rozmowa z lisem: `free_chat_daily` = 30, `pro_chat_daily` = 200 wiadomości/dobę (Europe/Warsaw). Zmienne (tylko nazwy): `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_REEL` (domyślnie „Dawid”), `ELEVENLABS_VOICE_FOX`, `ELEVENLABS_VOICE_SZOP` (bez nich podcast „wkrótce”, 503 `voices_missing`). `delete_my_account` z 0010 sprawdza też bucket `media` (apka kasuje pliki przed wywołaniem). Pozycja podcastu w postępach: `PROGRESS.media[id].cp = "<rozdział>:<sekunda>"` (jedna wartość przy scalaniu). Kluczowe punkty (`content.keyPoints`) powstają w tej samej generacji lekcji; stare tematy = punkt na poziom (id `L<levelId>`), ta sama logika w `cloud.js mapPoints()` i backendowym `topicPoints()`. Kolejność: 0010 → backend (z kluczami ElevenLabs i głosami) → apka (`nauka-backend/docs/DEPLOY.md`). Tryb głosowy później: żadnego UI mikrofonu.

## Jak to działa (ważne reguły)
- Kolejność skryptów: `cloud-config` → `cloud` (ustawia `window.NAUKA_UID`) → `engine` → `media` (rejestruje widoki `reelseries`, `reelplay`, `podcast`, `foxmodes`, `foxchat`, `foxresult`) → `cloud-ui` (`window.NAUKA_BOOT` startuje silnik po wczytaniu przedmiotów z konta). Ta sama kolejność w `index.html`, `build.js` i `test/dev/index.html`; CSP ma `media-src blob:` (audio z Storage jako Blob).
- Postępy w localStorage **per konto**: `nauka_progress_v1:<uid>` i `nauka_meta_v1:<uid>`; synchronizowane do `app_state` (debounce, scalanie tak, żeby XP i seria nie spadały; nigdy push przed pierwszym pull na urządzeniu).
- Przedmioty z konta: cache w IndexedDB (fallback localStorage), mapowane w `cloud.js → toEngine()`: przedmiot = przedmiot z bazy, poziomy = poziomy wszystkich jego tematów po kolei, id poziomu `t<8 znaków topicId>_<levelId>` (bez `:` — klucze SRS/album/override dzielą się na `:`), pierwszy poziom każdego kolejnego tematu ma `chapter:true` (odblokowany od razu).
- **Każdy string treści z bazy przechodzi przez `clean()`** (sanitizer w `cloud.js`) — treść z AI trafia do `innerHTML` w WebView z mostkiem do natywnych pluginów. Nie omijaj tego. Nie usuwaj elementów z tablic quiz/feed/tasks (indeksy są kluczami postępów) — nieobsługiwane zadania dostają `type:'_skip'`.
- Silnik wystawia `window.NaukaEngine` (helpery, `registerView`, `setSubjects`, `upsertSubject`) i woła `window.NAUKA_HOOKS` (`saved`, `settingsTop`, `profileSub`, `addPhoto`, `addFile`, `addText`).

## Workflow przy zmianach
1. Edytuj pliki źródłowe (nie `build/`).
2. `node build.js`, potem `cd native && npm run sync` (iOS).
3. Testy: atrapa backendu w przeglądarce (`cd test && node dev/shoot.mjs`, `node dev/checks/*.mjs` — patrz test/dev/README.md); symulator iOS na prawdziwym backendzie.
4. Migracje: nowy plik `backend/000N_*.sql` (idempotentny), wgrywany przez Supabase CLI.

## Konwencje
- Język UI: polski, rzeczowy i ciepły, bez młodzieżowego slangu (apka ma pasować 16-latkowi i studentowi). Zero emoji w UI.
- Nowe pola danych opcjonalne; stare zapisy muszą dalej działać.
- Indeks `c` w quizie liczony od 0; zawsze pole `e` (wyjaśnienie).

## Czego NIE robić
- Nie dodawać frameworków ani bundlera (jeden plik HTML dla Capacitora).
- Nie zmieniać nazw kluczy localStorage bez migracji (utrata postępów).
- Nie ustawiać ani nie zmieniać `server.iosScheme`, `server.hostname` ani `appId` w `native/capacitor.config.json` bez migracji danych (dziś domyślne: `capacitor://localhost`): to origin WebView, a localStorage i IndexedDB są przypisane do originu — zmiana = utrata postępów i sesji na telefonach.
- Nie ładować niczego z zewnątrz w apce (fonty, skrypty, style) — CSP pozwala tylko na nasze skrypty, Supabase, API i `data:`.
- Nie wstawiać treści z bazy do DOM bez `clean()` / `esc()` (`clean()` i mapper w `cloud.js` usuwają też emoji z treści AI).
- Nie ponawiać automatycznie `POST /api/generate`, `/api/media/reels`, `/api/media/podcast` ani `/api/fox` (każde wywołanie zjada limit użytkownika) — ponowienie tylko po stuknięciu, z nowym `requestId`.
- Nie wspominać w UI o płatnościach ani planie Pro (App Store 3.1.1) — zakupy w aplikacji dojdą osobno.
