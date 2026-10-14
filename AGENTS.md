# AGENTS.md — kontekst projektu dla Codex

## Czym jest ten projekt
**Cramfox** (repo `nauka-app`) — apka do nauki w stylu Duolingo z lisem-maskotką. Użytkownik zakłada konto, startuje z pustą listą i **sam tworzy przedmioty z własnych materiałów** (zdjęcia stron, PDF, wklejony tekst) — backend z AI (Claude) zamienia je w poziomy, roladkę, fiszki, quizy i zadania. Tryby: ścieżka poziomów, fiszki, quiz, egzamin, powtórka SRS, plan do sprawdzianu, gamifikacja (seria, kamienie milowe, gemy, misje, boss — Szop Zapominalski).

**Vanilla JS, bez frameworków i bundlera.** Buduje się do jednego pliku `build/nauka-all.html`, który Capacitor pakuje jako apkę iOS (`native/`).

## Struktura
```
cloud-config.js  # URL Supabase, publiczny klucz anon, URL API (wartości publiczne)
cloud.js         # chmura bez UI: sesja, REST do Supabase, Storage, API (CapacitorHttp), cache, mapper, sanitizer, sync, generowanie
engine.js        # silnik (jedno IIFE): router, Dziś, ścieżka, lekcja, zadania, fiszki, egzamin, gamifikacja, lis, szop
cloud-ui.js      # UI chmury: start z konta, logowanie, karta „Konto”, dodawanie materiału, generowanie, „przedmiot gotowy”
styles.css       # style (tokeny z design/tokens.css), bez gradientów i kół w tle
index.html       # wersja dev — ładuje 4 skrypty przez <script src> (kolejność ma znaczenie)
build.js         # `node build.js` → build/nauka-all.html (+ CSP z hashami skryptów)
backend/         # migracje SQL do Supabase (wgrywane przez CLI)
native/          # Capacitor iOS: `npm run sync` kopiuje build do Xcode
design/          # handoff designu 2.0 (DESIGN.md, tokens.css, makiety)
test/fixtures/   # tematy w formacie backendu do testów (w tym próby XSS)
docs/            # BIBLIA.md = pełna dokumentacja projektu (czytaj przed większą zmianą); plan-wyklady.md = plan Etapu 2
```

## Backend (istniejący, z gałęzi `origin/claude/peaceful-hamilton-jy11e3`)
- **Supabase** `zhgxhdsnizujzygpcyfl` (eu-central-1): konta e-mail + hasło (bez potwierdzania maila), tabele `subjects`, `topics` (JSONB `TopicContent`), `materials`, `generations`, `profiles`, `usage`; bucket `materials` (`{uid}/{uuid}.ext`). Tabela `app_state` (postępy Cramfoxa jako jeden blob) i RPC `delete_my_account()` — z `backend/0004_cramfox.sql`.
- **API** `https://nauka-jet.vercel.app`: `POST /api/generate` (synchronicznie ~2 min), `GET /api/me`. **API nie ma CORS** — na iOS wołamy je natywnie przez `Capacitor.Plugins.CapacitorHttp` (tylko `readTimeout`, bez `connectTimeout`!), w przeglądarce przez lokalne proxy.
- Nowe konto: 30 dni planu Pro (trigger `handle_new_user`), potem free: 3 generacje/mies. Globalny bezpiecznik: 300 generacji/dobę.

## Jak to działa (ważne reguły)
- Kolejność skryptów: `cloud-config` → `cloud` (ustawia `window.NAUKA_UID`) → `engine` → `cloud-ui` (`window.NAUKA_BOOT` startuje silnik po wczytaniu przedmiotów z konta).
- Postępy w localStorage **per konto**: `nauka_progress_v1:<uid>` i `nauka_meta_v1:<uid>`; synchronizowane do `app_state` (debounce, scalanie tak, żeby XP i seria nie spadały; nigdy push przed pierwszym pull na urządzeniu).
- Przedmioty z konta: cache w IndexedDB (fallback localStorage), mapowane w `cloud.js → toEngine()`: przedmiot = przedmiot z bazy, poziomy = poziomy wszystkich jego tematów po kolei, id poziomu `t<8 znaków topicId>_<levelId>` (bez `:` — klucze SRS/album/override dzielą się na `:`), pierwszy poziom każdego kolejnego tematu ma `chapter:true` (odblokowany od razu).
- **Każdy string treści z bazy przechodzi przez `clean()`** (sanitizer w `cloud.js`) — treść z AI trafia do `innerHTML` w WebView z mostkiem do natywnych pluginów. Nie omijaj tego. Nie usuwaj elementów z tablic quiz/feed/tasks (indeksy są kluczami postępów) — nieobsługiwane zadania dostają `type:'_skip'`.
- Silnik wystawia `window.NaukaEngine` (helpery, `registerView`, `setSubjects`, `upsertSubject`) i woła `window.NAUKA_HOOKS` (`saved`, `settingsTop`, `profileSub`, `addPhoto`, `addFile`, `addText`).

## Workflow przy zmianach
1. Edytuj pliki źródłowe (nie `build/`).
2. `node build.js`, potem `cd native && npm run sync` (iOS).
3. Testy: jsdom z atrapą backendu (patrz README → Testy); symulator iOS na prawdziwym backendzie.
4. Migracje: nowy plik `backend/000N_*.sql` (idempotentny), wgrywany przez Supabase CLI.

## Konwencje
- Język UI: polski, rzeczowy i ciepły, bez młodzieżowego slangu (apka ma pasować 16-latkowi i studentowi). Zero emoji w UI.
- Nowe pola danych opcjonalne; stare zapisy muszą dalej działać.
- Indeks `c` w quizie liczony od 0; zawsze pole `e` (wyjaśnienie).

## Czego NIE robić
- Nie dodawać frameworków ani bundlera (jeden plik HTML dla Capacitora).
- Nie zmieniać nazw kluczy localStorage bez migracji (utrata postępów).
- Nie wstawiać treści z bazy do DOM bez `clean()` / `esc()`.
- Nie ponawiać automatycznie `POST /api/generate` (każde wywołanie zjada limit użytkownika).
- Nie wspominać w UI o płatnościach ani planie Pro (App Store 3.1.1) — zakupy w aplikacji dojdą osobno.
