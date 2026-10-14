# Cramfox: biblia projektu

Stan na **2026-10-14**. Dokument opisuje to, co jest w drzewach roboczych na tym laptopie (`/Users/ignacykrasnodebski/nauka-app` i `/Users/ignacykrasnodebski/nauka-backend`), także w plikach, które nie są jeszcze zacommitowane.

Dla kogo:
- **dla właściciela**: żeby w jednym miejscu było „co to jest, jak działa, co jest zepsute i co dalej”;
- **dla agentów AI**: żeby przed zmianą w kodzie wiedziały, gdzie co leży, czego nie wolno ruszać i jak sprawdzić efekt.

Jak czytać:
- każda sekcja zaczyna się od krótkiego „W skrócie” po ludzku, potem są szczegóły;
- odwołania `plik:linia` dotyczą stanu z 2026-10-14 i z czasem się przesuną; szukaj wtedy po nazwie funkcji;
- **„do sprawdzenia”** oznacza, że tego nie dało się potwierdzić bez sieci albo bez dostępu do produkcji;
- w dokumencie nie ma żadnych sekretów (kluczy, haseł, tokenów). Są tylko nazwy zmiennych.

Plan nagrywania wykładów (Etap 2) jest osobno: [`docs/plan-wyklady.md`](plan-wyklady.md).

---

## Najważniejsze na dziś (przeczytaj najpierw)

1. **Kod produkcji nie jest w żadnym commicie.** Cała apka 3.0 (chmura, iOS, migracje 0004–0006, schematy, PPTX) i cały nowy backend (Files API, PPTX, review, viz) istnieją tylko jako niezacommitowane zmiany na tym laptopie. Utrata dysku albo jeden zły `git checkout` lub `git clean` oznacza utratę produkcji. Zobacz [9.6](#96-zabezpieczenie-kodu-zrób-to-jako-pierwsze).
2. **Oba katalogi to jedno repo git** (dwa worktree, wspólny `.git`). Operacja gita w jednym dotyka też drugiego.
3. **Build 6 czeka na wysłanie do TestFlight** (Xcode → Organizer → Distribute App; wysyłka z CLI padła na „Failed to Use Accounts”, czyli wygasłe logowanie Apple ID w Xcode). Backend z viz, PPTX i poprawkami jakości jest wdrożony (2026-10-07, Vercel `dpl_5QrNpisiG54A42B1dnjsLutQuBET`), a migracja `0006_pptx.sql` wgrana tego samego dnia, więc build 6 można rozesłać. Zasada na przyszłość: **najpierw backend, potem migracja, na końcu build apki** (stary backend pobierał limit, zanim sprawdził typ pliku).
4. **Wylogowanie kasuje lokalne postępy z telefonu** (po próbie synchronizacji). To celowe, ale warto o tym pamiętać przy testach.
5. **Nieudana generacja nadal zjada limit.** Nie ponawiaj `POST /api/generate` automatycznie.

---

## Spis treści

1. [Czym jest Cramfox](#1-czym-jest-cramfox)
2. [Mapa systemu i repozytoria](#2-mapa-systemu-i-repozytoria)
3. [Apka (klient)](#3-apka-klient)
4. [Konto, chmura i synchronizacja](#4-konto-chmura-i-synchronizacja)
5. [Tworzenie przedmiotu krok po kroku](#5-tworzenie-przedmiotu-krok-po-kroku)
6. [Format danych przedmiotu](#6-format-danych-przedmiotu)
7. [Backend](#7-backend)
8. [Bezpieczeństwo i prywatność](#8-bezpieczeństwo-i-prywatność)
9. [Jak pracować](#9-jak-pracować)
10. [Stan na dziś (2026-10-14)](#10-stan-na-dziś-2026-10-14)
11. [Plan i znane ograniczenia](#11-plan-i-znane-ograniczenia)
12. [Zasady i konwencje](#12-zasady-i-konwencje)
13. [Słowniczek](#13-słowniczek)

---

## 1. Czym jest Cramfox

**W skrócie:** Cramfox to apka na iPhone'a do nauki w stylu Duolingo, z lisem jako maskotką. Użytkownik zakłada konto, wrzuca własne materiały (zdjęcia stron, PDF, prezentację PPTX albo wklejony tekst), a AI (Claude) robi z nich poziomy z krótkimi porcjami wiedzy, fiszkami, quizem i zadaniami. Do tego jest powtórka na interwałach, egzamin próbny, plan do sprawdzianu i sporo grywalizacji.

### 1.1 Produkt

- **Nazwa:** Cramfox (repo nazywa się `nauka-app`; backend historycznie nazywa się „Recall”, a starsza wersja apki „NAUKA”).
- **Platforma:** iOS (iPhone, tylko pion), od iOS 16.4. Apka to jedna strona HTML w Capacitorze.
- **Wersja:** w App Store Connect `1.0` (numer builda rośnie: ostatni archiwalny to 6). W silniku `VERSION='3.0'` (`engine.js:122`), w ustawieniach jest rozwijany changelog 3.0 / 2.0 / 1.0.
- **Start:** nowe konto jest puste. Nie ma wbudowanych przedmiotów ani katalogu (stare `data/*.js` zostały usunięte w 3.0).
- **Język:** polski.

### 1.2 Dla kogo

- Od **16 lat**: licealiści i studenci. Rejestracja wymaga zaznaczenia „mam 16 lat”.
- Etapy w apce: `liceum`, `studia`, `inne`. Stary etap `podstawowka` silnik zamienia na `inne` (`engine.js:90`).
- **Niespójność:** `design/DESIGN.md` §0 i §1 mówi o grupie „od podstawówki” i „12-latku”. Obowiązuje 16+ (CLAUDE.md i kod).

### 1.3 Tryby nauki

| Tryb | Co to jest | Gdzie w kodzie |
|---|---|---|
| Ścieżka poziomów | Wężyk poziomów przedmiotu. Poziom = lekcja: najpierw czat z lisem (porcje wiedzy, czyli „dawki”), potem pytania i zadania. Co 3 poziomy skrzynia, na końcu boss. | `renderPath`, `engine.js:1919`; `startLesson`, `:2201` |
| Fiszki | Talia kart z przedmiotu, przesuwanie w lewo i w prawo, zapis do SRS. | `renderFiszki`, `:2347` |
| Quiz | Pytania z wybranego poziomu, bez serc i combo. | `renderQuiz`, `:2410` |
| Ćwiczenia | Zadania z poziomów oraz gry z fiszek (pary, szybki quiz 60 s, pojęcie z fiszek). Gry językowe (wpisywanie, klocki) tylko dla przedmiotów z `lang`, których Cramfox dziś nie tworzy (patrz [3.7](#37-zadania)). | `renderCwicz`, `:2907` |
| Egzamin próbny | Pytania na czas, ocena według skali przedmiotu, talia błędów. | `:2450–2690` |
| Powtórka (SRS) | Codzienna porcja fiszek i pytań, którym minął termin. | `renderReview`, `:1697` |
| Plan do sprawdzianu | Użytkownik podaje datę i zakres, apka rozkłada naukę na dni. | `:2697–2860` |
| Cram, noc przed egzaminem | 4 bloki po 5 minut: najsłabsze, fiszki, pytania, błędy z egzaminu. | `:3553–3664` |
| Info przedmiotu | Kafle z informacjami o przedmiocie i skala ocen. | `renderInfo`, `:2873` |

### 1.4 Grywalizacja (przegląd)

- **XP** za prawie każdą aktywność, z mnożnikiem combo (×2 od 5 trafień z rzędu, ×3 od 10) i boostem „Podwójne XP”.
- **Seria** (dni z rzędu z XP), **zamrożenia** serii (maks. 2) i **kamienie milowe** (3, 7, 14, 30, 50, 100, 365 dni) z gemami, akcesoriami lisa i odznakami.
- **Życia (serca):** 5, jedno wraca co 30 min. Tracisz je tylko za błąd w lekcji i u bossa.
- **Gemy** i **sklep** (zamrożenie, uzupełnienie serc, podwójne XP, okulary lisa).
- **Misje:** 3 dzienne i 1 tygodniowa.
- **Plan dnia** na ekranie Dziś.
- **Boss Szop Zapominalski** na końcu ścieżki.
- **Duch:** wyścig z własnym najlepszym przejściem poziomu.
- **Album** utrwalonych fiszek (zwykłe, rzadkie, epickie) i **13 odznak**.
- **Podsumowanie tygodnia.**

Szczegóły i liczby są w [3.9](#39-grywalizacja-liczby).

### 1.5 Lis i szop

- **Lis Cramfox** to rysowana w SVG maskotka z okularami. Ma nastroje (idle, happy, oops, fire, sleep, think), mruga, rozgląda się, nudzi się i zasypia, reaguje na dotyk (nos, głowa, ogon), zasłania oczy przy wpisywaniu hasła. Z serią dostaje akcesoria (opaska, szalik, medal, korona, peleryna). Kolor okularów kupuje się w sklepie.
- **Szop Zapominalski** to boss na końcu ścieżki przedmiotu. Ma nastroje: idle, hit, laugh, angry, dizzy, win. Silnik ma furtkę na własną nazwę bossa (`s.boss` w `bossName`, `engine.js:3308`), ale `toEngine()` nigdy tego pola nie ustawia, więc w Cramfoxie szop zawsze nazywa się „Szop Zapominalski”.

---

## 2. Mapa systemu i repozytoria

**W skrócie:** Apka na iPhonie rozmawia bezpośrednio z Supabase (konto, baza, pliki) i z jednym serwerem na Vercelu, który woła Claude'a. Serwer jest potrzebny tylko do tworzenia lekcji z materiałów i do odczytu limitów. Kod apki i kod serwera leżą w dwóch katalogach, które są dwoma „worktree” tego samego repo git.

### 2.1 Diagram

```
+------------------------------ iPhone (iOS 16.4+) -------------------------------+
|  Cramfox.app = Capacitor 8.5.2 (WKWebView), appId com.ignacykrasnodebski.nauka |
|  www/index.html = build/nauka-all.html (jeden plik, CSP z hashami)             |
|    cloud-config.js -> cloud.js -> engine.js -> cloud-ui.js                      |
|  localStorage: sesja, postępy, metadane  |  IndexedDB "cramfox": cache treści   |
+-----------+---------------------------------------------+----------------------+
            | fetch (HTTPS)                               | CapacitorHttp (natywnie,
            | Auth, REST (PostgREST), Storage, TUS        | bo API nie ma CORS)
            |                                             | POST /api/generate
            v                                             | GET  /api/me
+-------------------------------+                         v
| Supabase "nauka"              |          +----------------------------------------+
| ref zhgxhdsnizujzygpcyfl      |  service | Vercel, projekt "nauka"                 |
| eu-central-1 (Frankfurt)      |<---------| https://nauka-jet.vercel.app            |
| Auth: e-mail + hasło          |   role   | Next.js (apps/web), plan Hobby (300 s)  |
| Postgres + RLS + RPC          |          | route.ts -> intake -> reserve ->        |
| Storage: bucket "materials"   |          | generateTopic -> zapis tematu           |
| pg_cron: cramfox-end-trials   |          +--------------------+-------------------+
+-------------------------------+                               |
                                                                v
                                           +----------------------------------------+
                                           | Anthropic API                           |
                                           | claude-opus-5: plan i poziomy           |
                                           | claude-sonnet-5: review                 |
                                           | Files API: PDF i duże zestawy zdjęć     |
                                           +----------------------------------------+

Dodatkowo: telefon pobiera fonty z Google Fonts (Google widzi IP urządzenia).
```

### 2.2 Kto z kim rozmawia

| Od | Do | Jak | Po co |
|---|---|---|---|
| Apka | Supabase Auth (`/auth/v1`) | `fetch` | rejestracja, logowanie, odświeżanie tokenu, wylogowanie |
| Apka | Supabase REST (`/rest/v1`) | `fetch` z kluczem anon i tokenem użytkownika; RLS pilnuje dostępu | przedmioty, tematy, materiały, `app_state`, `generations`, RPC |
| Apka | Supabase Storage (`/storage/v1`) | `fetch`; pliki >6 MB przez TUS | wysyłanie materiałów, kasowanie plików przy usuwaniu konta |
| Apka | API na Vercelu | `Capacitor.Plugins.CapacitorHttp` (iOS); w przeglądarce `fetch` (na `http://localhost` przez lokalne proxy, którego nie ma; gdzie indziej wprost, co blokuje brak CORS) | tylko `POST /api/generate` i `GET /api/me` (`cloud.js:473`, `:498`) |
| API | Supabase | klucz service role i klient z tokenem użytkownika | sprawdzanie właściciela, limity, pobieranie plików, zapis tematu |
| API | Anthropic | SDK, streaming | generowanie i review |

### 2.3 Repozytoria i gałęzie

Oba katalogi to **dwa worktree jednego repo** `github.com/IgnacyKrasnodebski1/nauka-app`. Wspólny `.git` jest w `/Users/ignacykrasnodebski/nauka-app/.git`.

| Katalog | Gałąź | HEAD | Uwagi |
|---|---|---|---|
| `/Users/ignacykrasnodebski/nauka-app` | `design/nauka-2-0` | `36b7dc3` „Ignoruj .vercel i pliki .env” (2026-09-25) | o 1 commit przed `origin/design/nauka-2-0` (niewypchnięty); cała apka 3.0 niezacommitowana |
| `/Users/ignacykrasnodebski/nauka-backend` | `backend/files-api-50mb` | `512e5c8` (= `origin/claude/peaceful-hamilton-jy11e3`) | autor commita: „Claude”; nowy backend niezacommitowany |
| (bez worktree) | `main` | `618036d` | 2 commity za `origin/main` (tam `e523575` „Update index.html”) |

Ważne:
- Według `nauka-backend/docs/DEPLOY.md:13–14` projekt Vercela jest podpięty do tego repo (root `apps/web`) i „Auto-deploy prod działa z `main`”. Czy integracja z Gitem jest nadal włączona: **do sprawdzenia**, ale **zakładaj, że tak**: push do `main` = wdrożenie produkcji, a push każdej innej gałęzi = deployment Preview (gałąź apki nie ma `apps/web`, więc jej preview najpewniej się nie zbuduje; to szum, nie szkoda). Merge starej gałęzi backendu do `main` nadpisałby produkcję kodem bez Files API, PPTX i viz.
- CI (`nauka-backend/.github/workflows/ci.yml`) uruchamia się tylko przy pushu do `main` i przy PR. Obecne gałęzie nie mają CI.
- W backendzie są też: stara apka webowa Recall (`apps/web` poza API), stara apka mobilna Expo (`apps/mobile`) i Stripe. Cramfox z nich nie korzysta.

---

## 3. Apka (klient)

**W skrócie:** Apka to czysty JavaScript bez frameworka, w czterech plikach sklejanych w jeden HTML. `engine.js` to cała nauka i grywalizacja (działa offline), `cloud.js` to komunikacja z serwerem bez interfejsu, a `cloud-ui.js` to ekrany konta i dodawania materiału. Postępy są w localStorage pod kluczami z identyfikatorem konta i synchronizują się do chmury.

### 3.1 Pliki

| Plik | Rozmiar | Rola |
|---|---|---|
| `cloud-config.js` | 7 linii | `window.CRAMFOX_CONFIG = {supabaseUrl, anonKey, apiUrl}`. Wartości publiczne. Opcjonalna flaga `apiDirect` jest czytana w `cloud.js:45`, ale nieustawiona. |
| `cloud.js` | 513 linii | Jedno IIFE bez UI: sesja, REST, Storage, TUS, API, cache, mapowanie, sanitizer, synchronizacja, generowanie. Wystawia `window.NAUKA_CLOUD` (`:508–512`) i ustawia `window.NAUKA_UID` (`:24`). |
| `engine.js` | 3790 linii, 367 KB | Jedno IIFE, `"use strict"`: router, wszystkie ekrany nauki, zadania, grywalizacja, lis, szop. Wystawia `window.NaukaEngine`. |
| `cloud-ui.js` | 424 linie | Ustawia `window.NAUKA_BOOT` (`:20`) i `window.NAUKA_HOOKS` (`:135`), rejestruje widoki `cfadd`, `cfgen`, `cfready` (`:423`). Logowanie, karta „Konto”, dodawanie materiału, ekran generowania, „przedmiot gotowy”. |
| `styles.css` | 2795 linii | Style. Kopia tokenów z `design/tokens.css` w `:12–137` (nie całkiem 1:1, patrz [3.14](#314-pasek-offline-ekran-błędu-design)). |
| `index.html` | 17 linii | Wersja deweloperska: `<link>` do `styles.css` i 4 skrypty w kolejności (`:12–15`). **Bez CSP.** |
| `build.js` | 52 linie | `node build.js` → `build/nauka-all.html` (wszystko wklejone, CSP z hashami). |
| `backend/` | | Migracje `0004_cramfox.sql`, `0005_materials_50mb.sql`, `0006_pptx.sql`. |
| `native/` | | Projekt Capacitor iOS. |
| `design/` | | `DESIGN.md` (189 linii), `tokens.css` (126 linii), `preview/` (61 plików: 60 ekranów i index). |
| `test/fixtures/` | | `topic-viz.json`, `topic-makro.json`, `topic-krypto.json`, `topic-xss.json`. |
| `supabase/.temp/` | | Link Supabase CLI do projektu (nieśledzony, niezignorowany). |
| `.claude/launch.json` | | Podgląd `nauka-build` (serwer HTTP na porcie 8765 z katalogu `build/`). |

### 3.2 Powłoka iOS (`native/`)

| Element | Wartość |
|---|---|
| Capacitor | `@capacitor/core`, `@capacitor/ios`, `@capacitor/cli` 8.5.2 |
| Zależności iOS | Swift Package Manager (`ios/App/CapApp-SPM/Package.swift`, `capacitor-swift-pm` 8.5.2), bez CocoaPods |
| `capacitor.config.json` | `appId com.ignacykrasnodebski.nauka`, `appName Cramfox`, `webDir www`, `backgroundColor #0E0C1C`, `ios.scrollEnabled false`, `ios.contentInset never` |
| Plugin `CapacitorHttp` | nieskonfigurowany, więc `fetch` nie jest podmieniany; apka woła `Capacitor.Plugins.CapacitorHttp` wprost tylko dla API |
| Xcode | bundle `com.ignacykrasnodebski.nauka`, `IPHONEOS_DEPLOYMENT_TARGET 16.4`, tylko iPhone (`TARGETED_DEVICE_FAMILY 1`), `MARKETING_VERSION 1.0`, `CURRENT_PROJECT_VERSION 1` (numer builda podaje się przy archiwizacji), Swift 5.0, `CODE_SIGN_STYLE Automatic` |
| Zespół podpisujący | **brak `DEVELOPMENT_TEAM` w projekcie**; archiwa są podpisane zespołem `H9QDV2Z2G3` |
| Schematy | `App` (aplikacja) i `CapApp-SPM` |
| `Info.plist` | region `pl`, nazwa `Cramfox`, `ITSAppUsesNonExemptEncryption=false`, opisy dostępu do aparatu i zdjęć (po polsku), tylko pion, `UIUserInterfaceStyle Dark`, `UIStatusBarStyle LightContent`, `UIMainStoryboardFile=Main` (poziom główny) i `UISceneStoryboardFile=Main` (w konfiguracji sceny). **Brak** `NSMicrophoneUsageDescription` i `UIBackgroundModes`. |
| Ikona | `native/resources/icon.svg` i `make-icon.js` |

Skrypty w `native/package.json`:

| Skrypt | Co robi |
|---|---|
| `npm run web` | `node ../build.js`, potem kopia `build/nauka-all.html` do `www/index.html` |
| `npm run sync` | `web` i `npx cap sync ios` (sam buduje apkę, osobne `node build.js` nie jest potrzebne) |
| `npm run open` | `npx cap open ios` |

**Znany problem: podwójny most** (wniosek z kodu, niepotwierdzony w działającej apce). `Info.plist` ma `UISceneStoryboardFile=Main` i `UIMainStoryboardFile=Main` (storyboard z `CAPBridgeViewController`, `Main.storyboard:14`), a `SceneDelegate.swift:11` tworzy drugi `CAPBridgeViewController()`. Plan wykładów (C24) każe usunąć wpisy storyboardu.

### 3.3 Kolejność skryptów i start

Kolejność jest ważna: `cloud-config.js` → `cloud.js` → `engine.js` → `cloud-ui.js` (`index.html:12–15`, `build.js:16`).

1. `cloud.js` przy wczytaniu czyta sesję z `cf_session` i ustawia `window.NAUKA_UID` (stały na czas życia strony). Raz kasuje stare klucze bez uid (`:26`, flaga `cf_legacy_cleared`).
2. `engine.js` dokłada w tle fonty Google (`<link media=print>`, potem `all`, `:22`), ustawia `NATIVE` (`:24`) i przygotowuje `STORE` (`:36`, localStorage z testem zapisu; przy błędzie pamięć i pasek ostrzeżenia).
3. Na `DOMContentLoaded` (`engine.js:3749`): `#app`, `applyMotion()`, `netbar()`, `storebar()`, globalny nasłuch klawiszy, a potem `window.NAUKA_BOOT(start)`.
4. `NAUKA_BOOT` (`cloud-ui.js:20–32`):
   1. rejestruje widoki `cfadd`, `cfgen`, `cfready`;
   2. bez sesji pokazuje logowanie (`renderAuth`) i kończy;
   3. `bindEngine` (łączy synchronizację z silnikiem);
   4. `loadCache()` z limitem 3 s;
   5. `fresh = !hasLocalState()` (czy na tym urządzeniu są już postępy);
   6. bez cache albo przy `fresh` pokazuje ekran „Wczytuję Twoje przedmioty…” albo „…postępy…”;
   7. bez cache: `fetchAll()` z limitem 30 s; 401 → logowanie; inny błąd → `firstRunOffline`;
   8. `pull()`: przy `fresh` czeka do 20 s i może od razu nadpisać stan; inaczej czeka 3 s. Spóźniony wynik nie przepada: trafia do `pending` i zostaje zastosowany później. **Błąd albo przekroczenie czasu przy `fresh`** (401 → logowanie) kończy się blokującym ekranem `syncFailed` „Nie mogę pobrać Twoich postępów” (`cloud-ui.js:62–67`) z „SPRÓBUJ PONOWNIE” i „Wyloguj”. Ten „Wyloguj” woła `signOut({force:true})`, czyli kasuje dane lokalne bez próby wysłania. Bez `fresh` błąd `pull` jest ignorowany i apka startuje;
   9. `boot()`: `setSubjects(toEngine())` i `start()` silnika;
   10. `refreshInBackground()`: świeże dane z serwera, ponowne rysowanie, jeśli bezpieczne, i odzyskanie przerwanej generacji.
5. `start()` silnika (`engine.js:3761`): wczytuje `PROGRESS` i `META`, woła `fixProgress`, `syncTests`, `applyFreeze`, a potem wybiera ekran:
   - brak `META.level` → wybór etapu (`openLevelPick('first')`);
   - przerwa w nauce → `comeback`;
   - poniedziałek po aktywnym tygodniu → podsumowanie tygodnia;
   - w pozostałych przypadkach → `today`.
6. Wyjątek przy starcie pokazuje ekran błędu z trzema akcjami: **ODŚWIEŻ**, **Zachowaj XP i poziomy** (zostają `xp`, `levels`, `boss` każdego przedmiotu oraz gemy, motyw, odznaki, album) i **Wyzeruj postępy**.

### 3.4 Router i ekrany

- `VIEWS` (`engine.js:574`):
  - główne: `today`, `review`, `cards`, `subjects`, `profile`, `settings`, `streak`, `testplan`, `shop`, `missions`, `album`, `comeback`;
  - pierwsze uruchomienie i dodatki: `levelpick`, `onboarding`, `weekly`, `cram`, `error`;
  - z `cloud-ui.js`: `cfadd`, `cfgen`, `cfready`.
- `go(v, back)` (`:578`): stos `navHist` (maks. 20), czyszczenie interwałów i stanów lekcji, egzaminu, bossa, cramu. Nieznana nazwa → `today`.
- **Przedmiot nie jest w `VIEWS`.** Otwiera go `openSubject(id, tab)` (`:1847`). Zakładki: `path`, `fiszki`, `quiz`, `cwicz`, `egzamin`, plus `info` pod przyciskiem (i). „Wstecz” z przedmiotu zawsze prowadzi do `today`.
- `shell()` (`:681`) rysuje górny pasek, przewijaną treść, dolną nawigację i `#toast`. Dolna nawigacja: **Dziś · Powtórka · [+] Dodaj materiał · Fiszki · Profil** (`:677`).
- Arkusze: `openSheet` (jeden naraz), `closeSheet`, `ask({...})` → `Promise<bool>` zamiast `confirm`/`alert` (`:1043`).
- Ochrona przed podwójnym „Dalej”: `advOk()`, 350 ms (`:1020`).
- `applyTheme(s)` (`:562`) ustawia kolor przedmiotu w zmiennych CSS.

| Ekran | Funkcja | Co pokazuje |
|---|---|---|
| Dziś | `renderToday`, `:764` | Bez przedmiotów: 3 kroki i „Dodaj materiał” (`renderEmpty`, `:974`). Z przedmiotami: data i lis, pasek planu, pasek celu XP, mini-kafle Misje / Seria / Album, plan dnia, 3 kafle przedmiotów i „Dodaj”. |
| Przedmioty | `renderSubjects` | Siatka wszystkich przedmiotów. |
| Profil | `renderProfile`, `:802` | Poziom konta `floor(XP/100)+1`, statystyki, mapa aktywności 8×7 (tylko dni bieżącej serii), odznaki, XP w przedmiotach. |
| Ustawienia | `renderSettings`, `:867` | Karta „Konto”, etap i cel, cel dzienny, okulary lisa, „Ogranicz animacje”, przedmioty, „Wyzeruj postępy”, wersja i changelog. |
| Seria | `renderStreak`, `:947` | Lis z płomieniem, licznik, rekord, następny kamień milowy, tydzień, zamrożenia. |
| Powtórka | `renderReview`, `:1697` | Ile na dziś, z których przedmiotów, stan pamięci (Świeże / W trakcie / Utrwalone). |
| Fiszki (hub) | `renderCardsHub`, `:1830` | „Powtórka na dziś” i lista przedmiotów. |
| Ścieżka | `renderPath`, `:1919` | Węzły poziomów, skrzynie, boss, krzywa SVG (`drawTrail`). |
| Info przedmiotu | `renderInfo`, `:2873` | Kafle z `s.info`, skala ocen z „tu jesteś”. |
| Plecak, Misje, Album, ComeBack, LevelPick, Onboarding, Tydzień, Cram, Błąd | | Opisane w kolejnych podrozdziałach. |
| Dodaj materiał, Generowanie, Gotowe | `cloud-ui.js` | Opisane w [5](#5-tworzenie-przedmiotu-krok-po-kroku). |

**Odblokowanie poziomów** (`levelUnlocked`, `:1898`): pierwszy poziom przedmiotu, każdy poziom z `chapter:true` (pierwszy poziom każdego kolejnego tematu) albo poziom, którego poprzednik jest zaliczony.

**Plan dnia** (`buildDailyTasks`, `:615`): bierze 2 przedmioty z największym XP **spośród tych, w których są już postępy**. Bez żadnych postępów bierze 1 przedmiot: pierwszy z etapu użytkownika (albo pierwszy w ogóle) (`:616–618`). Zadania mają id `sid:kind[:lid]`:

| Zadanie | Kiedy | Nagroda |
|---|---|---|
| `lesson` | pierwszy odblokowany, niezaliczony poziom | 15 XP |
| `review` | `need = min(12, liczba fiszek)` | 20 XP |
| `quiz` | ostatni zaliczony poziom albo pierwszy | 25 XP |
| `exam` | tylko główny przedmiot z ≥5 pytaniami | 40 XP |
| `weak` | gdy jest talia błędów z egzaminu | 20 XP |

Cały plan dnia zrobiony: +5 gemów raz dziennie (`planCheck`, `:3090`).

### 3.5 Lekcja: czat z lisem, potem pytania

**`startLesson(lv)`** (`:2201`). Bez serc lekcja się nie zaczyna. Najpierw faza `feed` (czat), potem `quiz` (pytania i zadania). Bez `feed` czat jest pomijany.

**Skład pytań** (`levelSession`, `:1295`): najwyżej 6 losowych pytań quizu oraz wszystkie obsługiwane zadania, potasowane. Pierwsze zawsze jest pytanie, zadania są rozłożone równo.

**Czat** (`startChat`, `:2188`):
- Każda dawka to sekcja „Część i z n”. Tekst dawki jest dzielony na kawałki (`feedChunks`, `:1981`): akapity, punkty list, zdania. Krótkie kawałki są doklejane do poprzednich.
- Każdy kawałek ma swój wygląd (`chunkView`, `:2085`):
  - podtytuł (kończy się „:”, ≤70 znaków);
  - dymek z etykietą „ETYKIETA: …”, czasem z chipsami;
  - lista słówek „X — Y” (kafelki do stuknięcia);
  - zwykły dymek.
- **Rytm „lis pisze…”** (`chatSay`, `:2112`): czekanie `min(1500, 380 + długość·10)` ms. Stuknięcie albo Enter przyspiesza. Przy ograniczonych animacjach nie ma czekania.
- **Pojęcia:** pogrubione słowa (3–40 znaków) są klikalne. Licznik pokazuje zebrane / wszystkie. Dymek ze znaczeniem bierze je z fiszki albo z tekstu (`termDef`, `:2138`).
- **Sprawdzenie dawki** (`doseCheck`, `:1996`): zdanie z luką w miejscu pogrubionego pojęcia i 2 dystraktory. Dobrze: +2 XP. Źle: bez kary.
- Po dawce: schemat (jeśli jest i przechodzi `vizOk`), potem przycisk „Dalej”. Po ostatniej dawce: „CZAS NA PYTANIA” albo „ZAKOŃCZ”.

**Pytania** (`renderLesson`, `:2221`):
- Dobrze: combo +1, XP = 5 za pytanie albo 8 za zadanie, razy mnożnik (×2 od 5, ×3 od 10, `comboMult`, `:1014`).
- Źle: combo = 0, −1 serce, czerwony segment paska. Przy 0 sercach po „Dalej” wyskakuje ekran braku serc.
- Każde pytanie quizu zapisuje się do SRS (`srsTouch`, wywołanie w `:2260`). Zadania nie.

**Koniec** (`finishLesson`, `:2301`):
- Wynik ≥90% = 3 gwiazdki, ≥70% = 2, ≥50% = 1. **Zaliczenie od 50%.** Poziom bez pytań zalicza się zawsze.
- Pierwsze zaliczenie: +15 XP, +10 gemów. Pierwsze 3 gwiazdki: +5 gemów.
- Raz dziennie pojawia się świętowanie serii (`showStreakCeleb`).

### 3.6 Quiz, panele „dobrze / źle”, „Wyjaśnij inaczej”, poprawki

- **Tasowanie:** odpowiedzi są tasowane w danych (`mixQ`, Fisher–Yates, `qOf`, `:133`) i jeszcze raz na ekranie (`quizBlock`, `:1168`). `data-i` to indeks w danych, litera to pozycja na ekranie.
- **Tryb prawda/fałsz** (`quizTf`): gdy pytanie ma co najmniej 3 odpowiedzi, a poprawna wyraźnie odstaje długością (`lengthCue`, `:1166`; warunek w `:1169`), pytanie pokazuje jedną propozycję (50% szans, że poprawną) z przyciskami Tak/Nie. Chroni to przed zgadywaniem „najdłuższa jest dobra”. Flaga `noTf` jest martwa (nikt jej nie ustawia).
- **Klawiatura:** 1–5 albo A–E wybiera, Enter sprawdza.
- **„Dobrze!”** (`sheetOk`, `:1058`): combo, XP, „Dlaczego” (pole `e`), źródło.
- **„Nie tym razem”** (`sheetBad`, `:1070`): treść poprawnej odpowiedzi, „Dlaczego”, przycisk **WYJAŚNIJ INACZEJ** (tylko gdy jest co pokazać) i „Zgłoś / popraw pytanie”.
- **„Wyjaśnij inaczej”** (`explainFor`, `:1098`; `openExplain`, `:1116`): działa offline, bez AI. Szuka fiszki, której hasło pasuje do poprawnej odpowiedzi, i fragmentu dawki z bieżącego poziomu. Odrzuca fragmenty zawierające słowa z błędnych odpowiedzi, przeciwieństwa i niepasujące przeczenia. Notka: „To wyjaśnienia z Twoich materiałów”.
- **Poprawki użytkownika** (`openEditContent`, `:3664`): użytkownik może poprawić pytanie (2–5 odpowiedzi, wybór poprawnej, wyjaśnienie). Zapis w `PROGRESS.overrides["sid:lid:qi"]`. „Przywróć oryginał” usuwa poprawkę.
- **Źródło** (`openSourceView`, `:3697`): strona i cytat z `src`, przycisk „Pytanie jest złe”. Pole `src.material` jest zawsze puste (backend go nie wypełnia).

### 3.7 Zadania

Zadanie dostaje `render(task, api)` i kończy się `api.finish(ok, {e, sub})` (`taskBlock`, `:1306`). Kolejność w Ćwiczeniach: `TASK_META`, `:1221`.

| Typ | Na czym polega | Zaliczone, gdy |
|---|---|---|
| `tf` | prawda/fałsz, opcjonalnie na czas (`seconds`) | wszystkie zdania trafione |
| `fill` | luki `{0}`, `{1}` i bank kafelków | każda luka zgodna (wielkość liter i spacje bez znaczenia, ogonki się liczą) |
| `match` | łączenie par | wszystkie pary bez pomyłki |
| `order` | ułóż w kolejności (przeciąganie albo strzałki) | dokładna kolejność |
| `sort` | rozłóż do koszyków (maks. 4) | każdy element w swoim koszyku |
| `typeterm` | wpisz pojęcie do definicji, tolerancja literówek `typo` (brak pola = 0, `task.typo\|0`; zadania od AI mają zawsze `typo:1`) | zgodne z odpowiedzią albo wariantem; „Pierwsza litera” kosztuje 2 XP (tylko gdy w przedmiocie i dziś są już ≥2 XP) |
| `swipe` | karty w lewo lub w prawo | wszystkie trafione |
| `thesis` | wybierz argument do tezy | wybór = `c` |
| `scenario` | sytuacja i pytanie | wybór = `c` |
| `finderror` | znajdź zdanie z błędem | wybór = `wrong`; pokazuje poprawkę |
| `timeline` | ułóż wydarzenia według lat | rok zgodny ze slotem |
| `chain` | uzupełnij łańcuch kroków | każdy slot zgodny |
| `chart` | pytanie do wykresu (SVG rysowany przez apkę) | wybór = `c` |
| `mathsteps` | rozwiązywanie krok po kroku | bez pomyłek |
| `hotspot` | wskaż miejsce na obrazku | **z chmury zawsze wyłączony** (`_skip`), bo obrazek to ryzyko XSS |

Gdzie występują: lekcja (serce za błąd, 8 XP × combo), boss, Ćwiczenia → „Zadania z poziomów” (+4 XP, bez serc).

**Ćwiczenia** poza zadaniami: dla przedmiotów językowych (`s.lang`) Wpisywanie (12), Klocki (10), Pary (5) (`engine.js:2912–2914`); dla pozostałych Pary z fiszek, Szybki quiz 60 s (+2 za trafienie), Pojęcie z fiszek. Wpisywanie i Klocki +4 XP, para +3 XP. Fiszki z `noEx:true` są wykluczone.

**W Cramfoxie `s.lang` jest zawsze fałszywe**, więc gry językowe się nie pokazują. Klient nie wysyła `options.lang` (`cloud.js:474`), a serwer zapisuje `content.lang` tylko z `options.lang` (`generate.ts:260–262`, `:360`; `finalize.ts:543`). Kategoria „językowa” wykryta przez AI zmienia tylko prompty poziomów i review, nie zapisaną flagę. Żeby włączyć te gry, trzeba by wysyłać `lang` albo zapisywać wykrytą kategorię.

### 3.8 Fiszki, SRS, powtórka, egzamin, plan do sprawdzianu, cram

**SRS** (`:1672–1695`):
- Klucz `PROGRESS.srs["sid:lid:item"] = {box 0..4, due, seen, lapses}`, gdzie `item` to indeks fiszki albo `q<indeks pytania>`.
- Interwały `SRS_INT = [0, 1, 3, 7, 21]` dni. Dobrze: pudełko +1 i nowy termin, **ale tylko gdy termin minął** (albo karta jest nowa). Dobra odpowiedź przed terminem zwiększa tylko `seen`, więc pudełko rośnie najwyżej raz na termin (flaga `early`, `:1677–1679`). Źle: pudełko 0 i `lapses` +1 (zawsze).
- Do SRS zapisują: zakładka fiszek, pytania w lekcji, zakładka Quiz, powtórka i cram. Egzamin i boss nie zapisują.

**Fiszki** (`renderFiszki`, `:2347`): przeciągnięcie ±80 px albo przyciski. +2 XP tylko za „umiem” przy karcie z terminem na dziś lub wcześniej **albo jeszcze nigdy niewidzianej** (`:2375`). Zadanie „10 fiszek = +1 serce” (`heartReview`).

**Powtórka** (`:1729–1837`): bez serc i combo, fiszka +2 XP, pytanie +3 XP. Tryb talii błędów usuwa z `examDeck` trafione pytania.

**Egzamin** (`:2450–2690`):
- Ustawienia: poziomy, liczba pytań (10, 20, wszystkie), limit czasu (`max(5, round(examMin/2))`, examMin, 2·examMin, bez limitu; `:2484`).
- Skala domyślna w silniku (gdy przedmiot nie ma `grading`): `[[90,'5'],[70,'4'],[50,'3']]`, zaliczenie 50, `examMin` 20 min, ocena negatywna „2 — niezaliczone” (`:2458–2462`). Przedmioty z chmury prawie zawsze mają własne `grading` z pierwszego tematu, a wtedy **zaliczenie liczy się od najniższego progu skali**: dla `liceum` i `podstawowa` to **30%** (ocena „2”, dopuszczająca, jest pozytywna; patrz [6.2](#62-topiccontent-schemats278289) i [6.6](#66-mapowanie-do-silnika-toengine)).
- W trakcie: tylko pytania quizu, bez serc, SRS i wyjaśnień; flagi i siatka pytań.
- Wynik: +3 XP za trafienie, talia błędów do `PROGRESS.examDeck`, „Gdzie tracisz punkty” per poziom. Edycja pytania w przeglądzie przelicza wynik.

**Plan do sprawdzianu** (`:2697–2860`):
- Jeden plan na przedmiot w `PROGRESS.tests`.
- Ostatnie dni: D−1 powtórka „Noc przed egzaminem” 20 min, D−2 błędy albo powtórka 8 min, D−3 egzamin próbny.
- Wcześniej: nauka niezaliczonych poziomów, co 3. wolny dzień odpoczynek, inne wolne dni powtórka 10 min.
- Gotowość = 60% · poziomy zaliczone + 40% · najlepszy wynik egzaminu.
- `syncTests` raz dziennie usuwa stare plany i przelicza od dziś.

**Cram** (`:3553–3664`): 4 bloki po 300 s: najsłabsze (top 10), fiszki z zakresu (12), pytania (10), błędy z egzaminu. Puste bloki są pomijane.

### 3.9 Grywalizacja: liczby

**XP.** Jedyna droga to `addXP(id, n)` (`:551`). Przy aktywnym boostcie dodatnie XP się podwaja. `addXP` przedłuża też serię (`touchStreak()` przy każdym wywołaniu, także z 0 albo ujemnym XP).

| Za co | XP |
|---|---|
| Pytanie w lekcji | 5 × combo |
| Zadanie w lekcji | 8 × combo |
| Sprawdzenie dawki w czacie | 2 |
| Pierwsze zaliczenie poziomu | 15 (+10 gemów) |
| Zakładka Quiz, pytanie | 3 |
| Fiszka z terminem albo nowa („umiem”) | 2 |
| Powtórka / cram: fiszka, pytanie | 2 / 3 |
| Egzamin, trafienie | 3 |
| Ćwiczenia: zadanie / wpisywanie, klocki / para / szybki quiz | 4 / 4 / 3 / 2 |
| Boss: trafienie, pierwsze zwycięstwo, kolejne | 5, 50 (+25 gemów), 15 |
| Pokonanie ducha | 10 |
| Zadania planu dnia | 15–40 (tabela w [3.4](#34-router-i-ekrany)) |
| Podpowiedź w `typeterm` | −2 |

**Życia** (`:988`): `HEARTS_MAX=5`, +1 co 30 min, +1 za 10 fiszek, pełne za 50 gemów.

**Seria** (`META`): przedłuża ją pierwsze XP dnia (różnica 1 dnia). Przerwa ustawia 1. Zamrożenia (maks. 2) są zużywane przy starcie, jeśli pokryją opuszczone dni. Ekran powrotu po ≥3 dniach przerwy.

**Kamienie milowe** (`STREAK_MS`, `:510`):

| Dni | Gemy | Zamrożenia | Dodatek lisa | Płomień | Odznaka |
|---|---|---|---|---|---|
| 3 | 20 | | | | |
| 7 | 50 | | | złoty | tak |
| 14 | 75 | | opaska | | |
| 30 | 150 | +1 | szalik | niebieski | tak |
| 50 | 250 | | medal | | tak |
| 100 | 500 | +2 | korona | fioletowy | tak |
| 365 | | | peleryna i złote okulary | magenta | tak |

**Gemy** (`GEM`, `:3079`): poziom 10, 3 gwiazdki 5, skrzynia 10, plan dnia 5, boss 25, misje 20–30, misja tygodniowa 100, kamienie milowe.

**Sklep** (`SHOP`, `:3104`):

| Przedmiot | Cena (gemy) | Działanie |
|---|---|---|
| Zamrożenie | 100 | maks. 2 |
| Uzupełnienie serc | 50 | do pełna |
| Podwójne XP | 80 | 15 min |
| Okulary lisa | 150 | kolejny kolor: acid (darmowy), violet, cyan, pink, gold, amber |

**Misje** (`MISSION_POOL`, `:3149`): 3 dzienne wybierane deterministycznie z puli, nagroda odbierana ręcznie, przepadają o północy.

| Misja | Nagroda | Cel |
|---|---|---|
| `xp` | 20 | z celu dziennego |
| `streakok` (poprawne bez pomyłki) | 30 | 8 / 10 / 15 |
| `review` | 25 | 10 / 15 / 20 |
| `level` | 25 | 1 |
| `tftime` (tylko gdy jest zadanie tf na czas) | 30 | 1 |
| `plan` | 30 | 1 |
| tygodniowa: `wlevels` 5 / `wxp` 300 / `wdays` 5 | 100 | |

**Boss** (`:3305–3380`): odblokowany po zaliczeniu wszystkich poziomów. HP = min(10, pula pytań i zadań). 20 s na pytanie quizu (zadania nie mają zegara, `:3335`). Trafienie: −1 HP szopa i +5 XP. Pudło: −1 serce. 0 serc = przegrana.

**Duch** (`:3381–3415`): zapis najlepszego przejścia poziomu (`PROGRESS.ghost["sid:lid"]`), podgląd co 400 ms, pokonanie +10 XP.

**Album** (`albumCheck`, `:3265`): fiszka z pudełkiem ≥3 trafia do albumu. Epicka = poziom na 3 gwiazdki, rzadka = bez pomyłek, inaczej zwykła.

**Odznaki** (`BADGES`, `:3420`, 13 sztuk): first, streak7, streak30, streak50, streak100, streak365, album100, exam90, boss, missions10, combo3 (nazwa „Combo ×3”, warunek maxCombo ≥10), plan5, subject.

**Podsumowanie tygodnia** (`openWeekly`, `:3520`; `renderWeekly`, `:3525`): w poniedziałek raz, gdy zeszły tydzień był aktywny. Udostępnianie przez `navigator.share`.

### 3.10 Schematy (viz) w czacie

Schemat to mały obrazek wiedzy pod dawką: oś czasu, porównanie, cykl, przepływ, drzewo, słupki albo liczby. AI zwraca same dane, a HTML buduje apka.

| Typ | Ile elementów |
|---|---|
| `timeline` | 3–7 |
| `compare` | 2–5 wierszy |
| `cycle` | 3–6 |
| `flow` (`kind`: cause / process) | 2–6 |
| `tree` | 2–4 grupy po 1–5 elementów |
| `bars` | 2–7, wartości ≥0, co najmniej jedna >0 |
| `numbers` | 1–4 |

- `vizOk` (`engine.js:2017–2074`) odrzuca puste teksty, teksty >800 znaków i teksty z `<`, `>`, `"`.
- `vizHtml` składa wyłącznie własny HTML. Szerokość słupka = wartość/max, minimum 2%.
- Tekst schematu (`NAUKA_CLOUD.vizText`) trafia też do „Wyjaśnij inaczej”, znaczeń pojęć i luk, żeby wiedza ze schematu nie znikała w innych trybach.
- Limity pól po stronie klienta: [6.6](#66-mapowanie-do-silnika-toengine).

### 3.11 Lis i ograniczone animacje

- `fox(mood, size)` (`:298`): SVG 160×170, nastroje idle, happy, oops, fire, sleep, think. Akcesoria z serii (`foxLook`), kolor okularów z `PROGRESS.theme`.
- „Mózg” lisa (`:322–483`): wspólny zegar co 200 ms, mruganie co 2,2–5,6 s, wzrok co 0,7–2,6 s, akcja co 5–11 s, senność po 40 s (w nocy po 20 s), drzemka po 80 s (w nocy 45 s), powitanie raz na 10 min.
- Akcje (`FX_A`, wywoływane przez `foxAct`): hop, wave, stretch, look, tilt, yawn, scratch, glasses, sniff, sneeze, hum, wiggle, blep, nod, wink, giggle, startle, angry, pet, dizzy, idea, think, sigh, tailpeek.
- Dotyk: nos → kichnięcie albo blep, głowa → głaskanie, ogon → tailpeek, ≥5 zaczepek → złość, ≥8 → zawroty głowy.
- Pole hasła: lis zasłania oczy i co jakiś czas podgląda.
- **Ograniczone animacje:** przełącznik w Ustawieniach (`META.reduceMotion` → `html.reduce-motion`, wyłącza wszystkie animacje) i systemowe `prefers-reduced-motion`. JS sprawdza oba (`fxRM`, `calmMotion`): lis bez akcji, czat bez czekania, liczniki od razu.

### 3.12 Dane lokalne i klucze

Wszystkie klucze z postępami mają sufiks `:<uid>` (identyfikator konta). Bez konta (tylko w testach) sufiksu nie ma. **Nie zmieniaj nazw kluczy bez migracji**: użytkownicy stracą postępy.

| Klucz | Gdzie | Co trzyma |
|---|---|---|
| `nauka_progress_v1:<uid>` | localStorage, `engine.js:39` | `PROGRESS`: XP, poziomy, SRS, egzaminy, misje, album, odznaki, poprawki, historia itd. |
| `nauka_meta_v1:<uid>` | localStorage, `engine.js:84` | `META`: etap, cel, seria, zamrożenia, kamienie milowe, zgoda AI, ograniczone animacje |
| `__nk_t` | localStorage | test zapisu |
| `cf_session` | localStorage | sesja Supabase: `{access_token, refresh_token, expires_at, user:{id,email}}` |
| `cf_legacy_cleared` | localStorage | znacznik jednorazowego sprzątania starych kluczy |
| `cf_notice` | sessionStorage | komunikat po usunięciu konta |
| `cf_dirty:<uid>` | localStorage | są zmiany do wysłania |
| `cf_rev:<uid>` | localStorage | ostatnia znana wersja `app_state.rev` |
| `cf_base:<uid>` | localStorage | ostatni wspólny stan (do scalania) |
| `cf_sent:<uid>` | localStorage | `{ts, st}` ostatniego wysłania |
| `cf_job:<uid>` | localStorage | dziennik trwającej generacji |
| `cf_data:<uid>` | localStorage | zapasowy cache treści, gdy IndexedDB nie działa (tylko poniżej 1,5 mln znaków) |
| `data:<uid>` | IndexedDB `cramfox` v1, magazyn `kv` | cache przedmiotów i tematów `{subjects, topics, at}` |

**Kształt `PROGRESS`** (naprawiany przez `fixProgress`, `:46`):
- `[subjectId]: {xp, levels:{[lid]:{done, stars, best}}, exam, boss, chests:{"<indeks>":true}}`
- `epoch` (znacznik resetu), `goal`, `gems`, `examsPassed`
- `daily`, `hearts`, `srs`, `tests`, `missions`, `album`, `badges`, `ghost`, `stats`, `boost`, `theme`, `themes`
- `history: {"rrrr-mm-dd": {xp, levels, cards, reviews, combo, missions}}`, maks. 120 dni
- `overrides: {"sid:lid:qi": {q, a, c, e, at}}`
- `examDeck: ["sid:lid:q<qi>"]`

**Kształt `META`** (`fixMeta`, `:89`): `level`, `goal`, `streak`, `best`, `bestWas`, `lastDay`, `streakCeleb`, `freezes`, `frozenDays` (maks. 14), `ms`, `comebackShown`, `weeklyShown`, `reduceMotion`, `aiConsent`.

### 3.13 NaukaEngine i NAUKA_HOOKS

**`window.NaukaEngine`** (`engine.js:3787`):

| Grupa | Funkcje |
|---|---|
| Stan | `reload`, `setSubjects`, `upsertSubject`, `subjects()`, `meta()`, `saveMeta`, gettery `view` i `current` |
| DOM i UI | `el`, `icon`, `fox`, `liveFoxes`, `foxAct`, `toast`, `openSheet`, `closeSheet`, `sheetBack`, `ask`, `shell`, `obShell`, `renderError` |
| Nawigacja | `go`, `goBack`, `openSubject`, `openTestSheet`, `openQuickAdd`, `registerView(k, fn)` |
| Pomocnicze | `pl`, `noEmoji`, `todayStr`, `esc`, `txt`, `native` |
| Testy | `_explainFor`, `_viz{ok, html, text, chunks}` |

- `setSubjects(list)` i `upsertSubject(s)` (`:3785–3786`) podmieniają zawartość tablicy przedmiotów w miejscu. Wpisy bez `id`, `name` albo z pustym `levels` odpadają.
- `reload()` (`:3760`) przeładowuje stan po zmianach z innego urządzenia. `cloud-ui` woła go tylko wtedy, gdy jest bezpiecznie (`safeToRerender`, `cloud-ui.js:35`: ekran główny, bez otwartego przedmiotu, arkusza i lekcji).

**`window.NAUKA_HOOKS`** (ustawia `cloud-ui.js:135`, woła `hook()` w `engine.js:33`):

| Hook | Kiedy |
|---|---|
| `saved()` | po każdym zapisie postępów i metadanych; `cloud-ui` woła wtedy `dirty()` (synchronizacja z opóźnieniem) |
| `settingsTop(scroll)` | karta „Konto” na górze Ustawień |
| `profileSub()` | podpis w Profilu; zwraca HTML, więc dostawca musi escapować (robi to `esc(email)`) |
| `addPhoto(into)`, `addFile(into)`, `addText(into)` | z arkusza „Dodaj materiał”; `into` = id otwartego przedmiotu albo `null` |

Inne globalne: `window.NAUKA_UID`, `window.NAUKA_BOOT(start)`, `window.NAUKA_CLOUD` (w tym `vizText`), `window.SUBJECTS` (pozostałość, tylko w testach).

### 3.14 Pasek offline, ekran błędu, design

- `netbar()` (`:3734`): pasek „Brak sieci — nauka działa dalej, postępy trafią na konto…”, wstawiony poza `#app`.
- `storebar()`: ostrzeżenie, gdy zapis w localStorage nie działa.
- `renderError(o)`: wspólny ekran błędu dla startu silnika i `cloud-ui`.
- **Design** (szczegóły w `design/DESIGN.md` i `design/tokens.css`):
  - tylko ciemny motyw (brak `prefers-color-scheme`);
  - tło `#0E0C1C`, karta `#1B1836`, kolor akcji `--acid #B4FF3A`;
  - promienie 13 / 18 / 22 / 28 px, cienie pod spodem 4 / 5 / 6 px;
  - fonty Bricolage Grotesque 800 i Plus Jakarta Sans 500–800;
  - kolory pochodne przez `color-mix()` z zapasem dla iOS <16,2 (`styles.css:433`);
  - **zero emoji** (`noEmoji()` czyści tytuły, `initial()` robi monogram), ikony to inline SVG (`ICONS`, `:151`);
  - bez gradientów i kół w tle.
- Sekcje `styles.css`: tokeny (`:12`), ikony (`:382`), Dziś (`:426`), ścieżka i quiz (`:602`), zadania (`:784`, `:896`), SRS (`:1092`), egzamin (`:1230`), grywalizacja (`:1493`), domknięcie (`:1745`), lis i szop (ok. `:2071`, `:2314`, `:2458`), czat (`:2617`), schematy (`:2705`).

### 3.15 Znane błędy i niespójności w silniku

| # | Co | Gdzie | Skutek |
|---|---|---|---|
| 1 | **Dwa nasłuchy wpadły do komentarza** (brak nowej linii po komentarzu o iOS) | `engine.js:3752` | Martwe `resize → drawTrail` i `online → netbar(); toast('Sieć wróciła')`. Pasek „Brak sieci” nie znika po powrocie sieci, dopóki nie przyjdzie `visibilitychange` lub `resume`; ścieżka nie przerysowuje się po zmianie rozmiaru. Naprawa: przenieść kod do nowej linii. |
| 2 | **Zła litera u bossa po upływie czasu** | `engine.js:3353` | Komunikat „Poprawna: odpowiedź X” liczy literę z indeksu w danych, a opcje są tasowane na ekranie. W trybie prawda/fałsz żadna opcja nie dostaje podświetlenia. Lepiej pokazać treść odpowiedzi, jak `sheetBad`. |
| 3 | Seria liczy się tylko przez `addXP` | `:551` | `addXP` woła `touchStreak()` zawsze, także przy 0 albo ujemnym XP. Aktywność bez wywołania `addXP` (np. fiszka „jeszcze nie”) nie przedłuża serii; egzamin z 0 trafień przedłuża. |
| 4 | Klucz skrzyń zależy od pozycji poziomu w przedmiocie | `:1937–1953` | Usunięcie tematu albo zmiana kolejności przesuwa skrzynie. |
| 5 | Różne domyślne `examMin` | `engine.js:2457` (20) i `cloud.js:280` (10, gdy jest skala) | Niespójne limity czasu egzaminu. |
| 6 | Osierocone postępy | `fixProgress`, `:51` | Dane usuniętego przedmiotu zostają w zapisie na zawsze (nie psują działania). |
| 7 | Pola `real` i `mnemo` nie są wyświetlane | czat | AI je generuje, `cloud.js` je czyści, silnik ich nie pokazuje. Przy tym kontrola ugruntowania schematów przyjmuje liczby, które są tylko w `real` (`finalize.ts:394`), więc schemat może opierać się na tekście, którego użytkownik nie widzi. |
| 8 | Martwa opcja `noTf` | `:1169` | Tryb prawda/fałsz może się pojawić wszędzie poza egzaminem. |
| 9 | Toasty się nadpisują | `:550` | Jeden `#toast` na 1500 ms; komunikaty z opóźnieniem (2400–4800 ms) zastępują poprzednie. |
| 10 | Licznik „dni nauki” w misji tygodniowej | `wdays` | Liczy tylko dni z XP. |
| 11 | Kopia tokenów w `styles.css` nie jest 1:1 | `styles.css:12–137` | Różnią się fallbacki fontów. |
| 12 | `DESIGN.md` nie zgadza się z kodem | | Wiek (12 lat / podstawówka), nieistniejąca klasa `.a-drain`, „rozmyte koła w tle”, kształty grywalizacji, 59 vs 60 ekranów. |
| 13 | Martwe furtki silnika | `s.lang`, `s.boss` | Gry językowe i własna nazwa bossa istnieją w silniku, ale w danych z chmury nigdy nie są włączone: `toEngine()` nie ustawia `boss`, a `lang` nie przychodzi z serwera ([1.5](#15-lis-i-szop), [3.7](#37-zadania)). |

---

## 4. Konto, chmura i synchronizacja

**W skrócie:** Konto to e-mail i hasło w Supabase, bez potwierdzania maila i bez resetu hasła w apce. Przedmioty i tematy są w bazie i w cache na telefonie, a postępy w localStorage i jako jeden „blob” w tabeli `app_state`. Synchronizacja scala zmiany z kilku urządzeń tak, żeby XP i seria nie spadały.

### 4.1 Rejestracja, logowanie, sesja

- **Rejestracja** (`cloud.js:59`): `POST /auth/v1/signup` z `{email, password, data:{age16:true, client:'cramfox'}}`. Wartość `client:'cramfox'` sprawia, że trigger `handle_new_user` daje 30 dni planu pro (trial). Brak `access_token` w odpowiedzi → błąd `needs_confirm` („ta wersja jeszcze tego nie obsługuje”).
- **Logowanie** (`:63`): `POST /auth/v1/token?grant_type=password`.
- **Walidacja w UI** (`renderAuth`, `cloud-ui.js:70–104`): e-mail `^[^\s@]+@[^\s@]+\.[^\s@]+$`, hasło ≥6 znaków, przy rejestracji wymagany checkbox 16+. Domyślnie otwiera się zakładka rejestracji. Po sukcesie `location.reload()`.
- **Komunikaty** (`authMsg`, `:105–117`) dla kodów: `network`, `invalid_credentials`, `user_already_exists` / `email_exists`, `weak_password`, `over_request_rate_limit` / `over_email_send_rate_limit` / 429, `email_address_invalid`, `needs_confirm`, `signup_disabled`, ≥500 i domyślny.
- **Odświeżanie tokenu** (`refresh`, `:65–74`): 60 s przed wygaśnięciem; równoległe wywołania czekają na jedno. 400/401 przy odświeżaniu → sesja usunięta, zdarzenie `signedout`, toast „Sesja wygasła — zaloguj się ponownie”, przeładowanie po 1,5 s. **Lokalne postępy zostają.** Przy błędzie sieci używany jest stary token.
- **Brakuje:** resetu hasła („Nie pamiętam hasła”, `/auth/v1/recover`) i potwierdzania maila (`enable_confirmations = false`).

### 4.2 Wylogowanie i usunięcie konta

**Wylogowanie** (`signOut`, `cloud.js:80–89`; UI `cloud-ui.js:162–171`):
1. Do 2 prób dociągnięcia i wysłania zmian.
2. Jeśli zmiany nadal nie wyszły → błąd `unsynced`; UI pyta „Wyloguj mimo to”.
3. `POST /auth/v1/logout?scope=local` (inne urządzenia zostają zalogowane).
4. `wipeLocal(uid)`: **kasuje z telefonu wszystkie klucze `:<uid>`**, `cf_session` i cache IndexedDB tego konta.
5. Przeładowanie.

**Usunięcie konta** (`deleteAccount`, `cloud.js:501–506`; UI `cloud-ui.js:172–189`):
1. `rpc/delete_my_account {p_dry_run:true}` (sprawdza, czy można).
2. Lista i usunięcie wszystkich plików `<uid>/` w Storage (do ok. 10 000 plików, strony po 100).
3. `rpc/delete_my_account {p_dry_run:false}` (kasuje użytkownika, reszta kaskadowo).
4. Wyłączenie synchronizacji i `wipeLocal`.
5. Komunikat z podziękowaniem (`cf_notice`) i przeładowanie.

Błędy: `active_subscription` (aktywna subskrypcja Stripe z weba), `network`, `files_remaining`, ogólny.

**Uwaga (App Store 3.1.1):** komunikat dla `active_subscription` (`cloud-ui.js:184`) brzmi „Masz aktywną subskrypcję kupioną poza aplikacją — najpierw ją anuluj, potem usuń konto.” To **jedyne miejsce w UI ze słowem o płatnościach**. Widać je tylko przy usuwaniu konta z aktywną subskrypcją z weba, ale test R12 (wyrażenie z [12.1](#121-język-i-ton)) je złapie, a recenzent może je odczytać jako odesłanie do zakupu poza apką. Warto przeredagować przed zgłoszeniem do App Store.

### 4.3 Karta „Konto” i prywatność

**Karta „Konto”** (`settingsAccount`, `cloud-ui.js:145–160`):
1. E-mail z dopiskiem „postępy zapisują się na koncie” (albo „zalogowano”, gdy synchronizacja jest wyłączona).
2. „Nowe lekcje”: „X z Y w tym miesiącu” i dopisek „· na start większy limit, jeszcze N dni” (trial) albo „· odnawia się 1. dnia miesiąca”. **Bez słowa o planie Pro i płatnościach.**
3. Twoje dane.
4. Wyloguj.
5. Usuń konto.

**Arkusz „Twoje dane”** (`openPrivacy`, `cloud-ui.js:118–132`), 7 punktów:
1. konto: e-mail i hasło w Supabase EU (Frankfurt);
2. materiały: w Supabase, dostęp tylko dla właściciela;
3. AI: materiał idzie przez Vercel do Claude (Anthropic), po zgodzie;
4. postępy: synchronizowane z kontem;
5. usuwanie: Ustawienia → Usuń konto;
6. fonty: Google Fonts widzi IP urządzenia;
7. wiek: 16+.

### 4.4 Komunikacja z serwerem

| Warstwa | Szczegóły |
|---|---|
| `http()` (`cloud.js:34–42`) | limit 20 s (`AbortController`). Każdy błąd fetch, także przekroczenie czasu, to `CloudError(0, 'network', 'Brak połączenia z internetem')`. Offline i wolny serwer wyglądają tak samo. |
| `rest()` | `/rest/v1/` z nagłówkami `apikey` i Bearer. 401 → odśwież token i spróbuj raz. |
| `storage()` | `/storage/v1/`. Błąd JWT → odśwież i raz ponów. Limit 180 s przy wysyłaniu treści, inaczej 20 s. |
| Wysyłka pliku ≤6 MB | `POST object/materials/<ścieżka>` z `x-upsert:false` |
| Wysyłka pliku >6 MB (TUS 1.0.0) | `POST /storage/v1/upload/resumable`, kawałki po dokładnie 6 MB (`PATCH`, 180 s), do 3 ponowień po 1 / 3 / 7 s, przed ponowieniem `HEAD` po offset. Ponawiane: 0, 408, 409, 423, 429, 5xx. Adres z `Location` jest wymuszany na domenę Supabase (token nie wycieknie). |
| API (iOS) | `CapacitorHttp.request` z samym `readTimeout: 310000`, **bez `connectTimeout`**. Błąd → `'Brak połączenia z serwerem'`. 401 → odśwież i raz ponów. |
| API (przeglądarka) | `fetch` 310 s. Na `location.origin` (lokalne proxy) **tylko** gdy strona działa z `http://localhost` albo `http://127.0.0.1` i nie ustawiono `apiDirect` (`cloud.js:45`); każdy inny adres woła `apiUrl` wprost, co blokuje brak CORS. **Proxy nie istnieje** (`cloud-config.js:2` wspomina `node dev/proxy.js`, katalogu `dev/` nie ma), więc generowanie w przeglądarce nie działa. |
| `me()` (`:498`) | `GET /api/me` i osobno `profiles?select=trial_until`. UI używa `limits.generationsPerMonth`, `limits.filesPerGeneration`, `limits.maxFileMb`, `usage.generations`. Licznik w karcie „Konto” jest przycinany do limitu (`min(used, lim)`, `cloud-ui.js:156`), bo serwer potrafi zapisać np. 4/3 ([7.5](#75-plany-i-limity)). |

Cramfox woła tylko dwa endpointy API (`/api/generate` i `/api/me`) i jedno RPC (`rpc/delete_my_account`); resztę robi przez REST i Storage Supabase.

### 4.5 Cache przedmiotów

- IndexedDB `cramfox` v1, magazyn `kv`, klucz `data:<uid>`. Otwarcie z limitem 2,5 s.
- `fetchAll()` pobiera równolegle wszystkie `subjects` i `topics` (z pełnym `content`), zapisuje cache i emituje `subjects`.
- **Brak stronicowania:** obowiązuje domyślny limit wierszy PostgREST, a pełna treść wszystkich tematów jest pobierana przy każdym odświeżeniu w tle.

### 4.6 Synchronizacja postępów

**Zasada:** każdy zapis w silniku oznacza stan jako „brudny”. Po 4 s ciszy apka wysyła cały `PROGRESS` i `META` do `app_state` (to debounce: każdy kolejny zapis liczy 4 s od nowa, więc w trakcie lekcji wysyłka czeka na przerwę). Serwer nadaje kolejny numer `rev`. Jeśli ktoś inny zdążył zapisać, apka pobiera stan z chmury, scala i wysyła ponownie.

| Krok | Co się dzieje |
|---|---|
| `dirty()` (`:306`) | znacznik `Date.now()+'.'+seq` w `cf_dirty`, `clearTimeout` i nowe opóźnienie 4000 ms, potem `push()`, a jeśli na tym urządzeniu nie było jeszcze `pull` → najpierw `pull()` |
| `push()` (`:307–323`) | wymaga: było `pull`, synchronizacja włączona, brak `pending`, stan brudny. Najpierw zapisuje `cf_sent`. Z `rev`: `PATCH app_state?user_id=eq.<uid>&rev=eq.<rev>` (porównaj i zamień). Bez `rev`: `POST ... on_conflict=user_id` z `ignore-duplicates`. Pusta odpowiedź = konflikt → `pull()`. |
| `pull()` (`:387–402`) | czyta `app_state`. Brak wiersza → wyślij lokalny. `client_ts` = nasz zapis z utraconą odpowiedzią → przyjmij. Ten sam `rev` → nic nowego. Brak lokalnego stanu → skopiuj z chmury. Inaczej `applyRow`. |
| `applyRow` (`:403–413`) | gdy nie jest bezpiecznie przerysować (trwa lekcja, otwarty arkusz) → zapis do `pending`, poller co 3 s (`cloud-ui.js:40`) zastosuje później. Inaczej scalenie, zapis, `reload()` silnika, ewentualnie push. |
| Wyzwalacze wysłania | `visibilitychange` na ukryte, `pagehide`, Capacitor `pause` → `flush()` (`:324`) |
| Brak tabeli | 404, `PGRST205`, `42P01`, `PGRST202` → synchronizacja wyłączona (`missing`, `:304`) |
| Limit rozmiaru | CHECK `app_state_size`: `progress` + `meta` < 2 000 000 B (`0004_cramfox.sql:14`). Po przekroczeniu każdy push dostaje 400, synchronizacja **cicho staje**, a `cf_dirty` zostaje ustawione. Wylogowanie powie wtedy „Nie udało się połączyć z serwerem” (`cloud.js:84`, `cloud-ui.js:169`), co jest mylące. |

**Reguły scalania `merge3(base, local, cloud)`** (`:326–386`):

| Dane | Reguła |
|---|---|
| Liczniki `xp, gems, examsPassed, levels, cards, reviews, missions, planDays, bosses` | chmura + (lokalnie − baza), nigdy poniżej 0 |
| Zmiana tylko po jednej stronie | ta strona wygrywa |
| Obiekty | scalane klucz po kluczu; dzień w `history` stworzony na obu urządzeniach liczony od zera |
| Inne liczby | maksimum |
| Wartości logiczne | OR |
| Tablice prostych wartości | zbiór, z uwzględnieniem usunięć |
| Tablice obiektów z `id` | scalane po `id` |
| Teksty | lokalny wygrywa |
| `progress.epoch` (reset) | wyższy wygrywa **cały** `progress` |
| `daily` tego samego nowego dnia na obu urządzeniach | liczone od zera |
| Seria | przeliczana (`mergeStreak`, suma aktywnych dni) tylko, gdy zmieniła się po obu stronach |

**Ryzyko teoretyczne (dziś niemożliwe):** gdyby `PATCH` zwrócił `[]` przy niezmienionym `rev` na serwerze, `push` wołałby `pull`, który widzi ten sam `rev` i woła `push`: nieskończona pętla zapytań (`:318` ↔ `:397`). Dziś to nie zachodzi, bo jedna polityka `"app_state own"` jest `FOR ALL` (`0004_cramfox.sql:19`): `PATCH` nie może zwrócić `[]`, gdy `SELECT` widzi ten sam `rev`. Pętla wróciłaby, gdyby ktoś rozdzielił polityki i zapomniał o UPDATE.

**Drobny wyścig (nieszkodliwy):** `push()` zeruje `pushing` przed `await pull()` (`:318`), a zewnętrzne `finally` (`:321`) zeruje je drugi raz, więc dwa wysłania mogą się na chwilę nałożyć. Łapie to porównanie `rev` (CAS).

---

## 5. Tworzenie przedmiotu krok po kroku

**W skrócie:** Użytkownik stuka „+”, wybiera zdjęcia, pliki albo tekst, zgadza się raz na przetwarzanie przez AI i stuka „TWÓRZ LEKCJĘ”. Apka wysyła pliki do Supabase, a potem wywołuje serwer, który przez ok. 2 minuty układa z nich temat z poziomami. Limit jest pobierany dopiero wtedy, gdy materiał na pewno da się przetworzyć, ale nieudana generacja po pobraniu limitu i tak się liczy.

### 5.1 Przebieg

**Na telefonie**

1. **Wejście.** Przycisk „+” w dolnej nawigacji albo „Dodaj materiał” → arkusz z trzema drogami: zdjęcie, plik, tekst. Hooki `addPhoto`, `addFile`, `addText` wołają `startAdd` (`cloud-ui.js:191–274`).
2. **Blokada równoległej pracy.** Jeśli trwa inna generacja (`busyGen()`), nowa się nie zaczyna.
3. **Zgoda na AI** (`consent`, `:193–202`): tylko gdy `META.aiConsent` jest puste. Akceptacja zapisuje datę w `META` (więc synchronizuje się z kontem).
4. **Wybór plików** (`:203–209`):
   - zdjęcie: `accept=image/*`, `capture=environment`, jedno;
   - plik: wiele, `image/*`, PDF, `.txt`, `.md`, `.pptx`;
   - tekst: pole do 200 000 znaków, minimum 40 („Wklej trochę więcej…”).
5. **Wstępne odrzucenia** (`addFiles`, `:219–230`):
   - stare i biurowe formaty (`doc, docx, ppt, xls, xlsx, odt, pages, key`) → toast: dla `.ppt`/`.key` „zapisz jako PPTX lub PDF”, dla Worda, arkuszy i reszty tylko „zapisz jako PDF” (`cloud-ui.js:223`);
   - typ spoza listy → odrzucony;
   - plik (nie zdjęcie) >50 MB → toast i ostrzeżenie pod materiałem.
6. **Ekran „Dodaj”** (`renderAdd`): miniatury, „+ Zdjęcie / + Plik / + Tekst”, „Gdzie dodać?” (istniejący przedmiot albo „Nowy przedmiot” z nazwą do 60 znaków), wskazówka do 300 znaków, przycisk **TWÓRZ LEKCJĘ**. Wyjście z niezapisanym materiałem pyta o potwierdzenie.
7. **`runGeneration`** (`:279–305`):
   1. `me()` (401 przerywa, inne błędy są ignorowane);
   2. sprawdzenie limitu miesięcznego i liczby plików lokalnie;
   3. `prepareFiles`: zdjęcia zmniejszane do 1568 px, JPEG 0,82, na białym tle (usuwa EXIF); HEIC zamienia na JPEG **tylko tam, gdzie WebKit umie go zdekodować** (komentarz w kodzie: iOS 17+, `cloud.js:435`). Apka celuje w iOS 16.4, więc na iOS 16 `downscale()` zwraca `null` i plik HEIC kończy się `bad_type` z komunikatem „Zdjęcie w formacie HEIC” (`cloud.js:436`, `cloud-ui.js:350`). Zdjęcie nadal >5 MB → `file_too_big`;
   4. każdy plik ≤ `maxFileMb` (50 MB), razem ≤150 MB (tekst liczony w znakach);
   5. nowy przedmiot: `createSubject` (nazwa „Nowy przedmiot”, w bazie domyślne emoji książki, którego apka nie pokazuje; kolor = liczba przedmiotów % 6). Etap: `META.level`, ale `podstawowka` jest wysyłana jako `inne` (`:214`);
   6. wysyłka plików po kolei z postępem w bajtach (`uploadMaterial`, `cloud.js:450–458`): ścieżka `<uid>/<uuid>.<ext>`, TUS powyżej 6 MB, potem wiersz w `materials`. Gdy wiersz się nie zapisze, plik jest usuwany;
   7. `generate()`;
   8. **sprzątanie po błędzie:** każdy błąd poza zerwaniem połączenia po wysłaniu `POST` woła `discard()` (`cloud.js:459–463`, wywołanie w `cloud-ui.js:302`): usuwa wiersze `materials`, pliki ze Storage i nowo utworzony przedmiot, jeśli nie ma tematów.
8. **`generate()`** (`cloud.js:470–480`; `recoverJob` to `:481–497`):
   1. odczyt ostatniej generacji tego przedmiotu (do odzyskiwania);
   2. **dziennik** `cf_job:<uid>` = `{subjectId, startedAt, materialIds, prevAt, prevOk, created, materials}`;
   3. `POST /api/generate` z `{subjectId, materialIds, text?, options:{stage, subjectName?, mode:'materials', levels:4, locale:'pl', hint?, viz:true}}`;
   4. błąd HTTP albo brak `topicId` → dziennik usunięty, błąd z kodem; odpowiedź bez `code` (np. HTML 504 Vercela) przy statusie ≥500 staje się `generation_failed`, inaczej `bad_request`;
   5. sukces → `topicId` do dziennika, `addTopic` (pobiera temat; jeśli przedmiot nazywa się dokładnie „Nowy przedmiot”, dostaje nazwę od AI);
   6. **bez automatycznego ponawiania.**

**Na serwerze** (`nauka-backend/apps/web/src/app/api/generate/route.ts`)

9. **Sprawdzenia przed kosztem** (route.ts i `packages/ai/src/intake.ts:54–91`), kolejno:
   1. konfiguracja → 503 `no_config`;
   2. sesja → 401 `unauthorized`;
   3. treść żądania (zod) → 400 `bad_request`;
   4. przedmiot należy do użytkownika → 404 `not_found`;
   5. liczba plików wg planu → 400 `too_many_files`;
   6. wiersze `materials` przez RLS (niezgodna liczba, także duplikaty id) → 400 `bad_materials`; zadeklarowany rozmiar → `file_too_big`, `too_much_material`;
   7. typ MIME spoza listy → 400 `bad_materials`;
   8. **wstępne sprawdzenie limitu (tylko odczyt, tylko gdy są pliki):** limit miesięczny albo ≥20 generacji w 24 h → 402 `limit_reached`;
   9. pobranie plików z bucketu (po 3 naraz), prawdziwe rozmiary → `file_too_big` / `too_much_material`, błąd → 500 `download_failed`;
   10. rozpakowanie PPTX → `bad_pptx` / `pptx_protected` / `pptx_empty`;
   11. tekst łącznie >1 500 000 znaków → 400 `too_long`;
   12. **pobranie limitu** (`increment_usage`) → 402 `limit_reached` albo 500 `reserve_failed`.
10. **Wiersz `generations`** ze statusem `running`.
11. **AI** (`packages/ai/src/generate.ts`):
    1. **Faza 0, pliki:** PDF zawsze przez Files API, zdjęcia przez Files API tylko, gdy razem >15 MB, tekst inline. Pliki w Anthropic wygasają po 2 h i są kasowane po generacji.
    2. **Faza 1, plan (outline):** jedno wywołanie, maks. 8000 tokenów. Model dzieli materiał na poziomy (w trybie materiałów maks. `min(8, levels+2)`, czyli domyślnie 6) i każdemu przypisuje zakres (`scope`).
    3. **Faza 2, poziomy:** wszystkie równolegle, po 2 wywołania na poziom: rdzeń (dawki, fiszki, quiz, gry; maks. 20 000 tokenów) i zadania (maks. 12 000). Nieudane zadania → `tasks: []`.
    4. **Faza 3, review:** jedno wywołanie na poziom, równolegle, model `claude-sonnet-5`, 45 s, 8000 tokenów. Poprawia albo usuwa słabe pytania. Nigdy nie psuje generacji: przy błędzie zostaje oryginał.
    5. **Faza 4, jakość:** statystyki pokrycia i jakości trafiają **tylko do logów**.
    6. **Faza 5, finalizacja:** id poziomów `l1..lN`, czyszczenie, tasowanie odpowiedzi, odrzucanie wadliwych elementów, schematy z kontrolą „ugruntowania” w tekście.
12. **Zapis:** `TopicContentSchema.parse`, temat do `topics` (pozycja = liczba tematów przedmiotu), `generations` → `done` z modelem i tokenami. Odpowiedź `{generationId, topicId, topic, demo}`.

**Znowu na telefonie**

13. **Ekran postępu** (`renderGen` / `paintGen`, `cloud-ui.js:368–395`): pasek 4→20% w czasie wysyłki, potem `20 + 75·(1 − e^(−t/60))`; 5 etykiet kroków zmienianych co 24 s; odświeżanie co 900 ms; przycisk **DZIAŁAJ W TLE** wraca do Dziś.
14. **Gotowe** (`renderReady`, `:399–421`): zmiana nazwy (z opóźnieniem 700 ms), 6 kolorów, lista nowych poziomów, **ZACZNIJ NAUKĘ** i „Mam z tego sprawdzian”. Przy trybie demo ostrzeżenie „tryb demo”.
15. **Nowy temat w istniejącym przedmiocie** dokleja poziomy na końcu ścieżki. Pierwszy z nich ma `chapter:true`, więc jest od razu odblokowany.

### 5.2 Odzyskiwanie przerwanej generacji

Gdy apka straci połączenie w trakcie albo zostanie zamknięta, dziennik `cf_job:<uid>` zostaje. `recoverJob()` (`cloud.js:481–497`):
- dziennik starszy niż 24 h albo bez `subjectId` → usunięty;
- dziennik z `topicId` → tylko `addTopic`;
- inaczej co 8 s pyta tabelę `generations` o wiersz z tymi `material_ids` i nowszy niż poprzednia generacja:
  - `done` z `topic_id` → `addTopic`, gotowe;
  - `failed` → `generation_failed`;
  - brak wiersza po 90 s → `not_started`;
  - wiek >330 s → `lost`;
  - błędy sieci są tolerowane do 330 s (stan `offline`).

Wyzwalacze: odświeżenie w tle, powrót do apki (`resume`, `visibilitychange`, maks. raz na 5 s), `online`.

Po `generation_failed`, `lost` i `not_started` z odzyskiwania UI woła `discard()` (`cloud-ui.js:365`): kasuje materiały, pliki i pusty nowy przedmiot. Cramfox nie używa `GET /api/generate?id=` (odzyskuje przez REST na tabeli `generations`).

**Wyścig przy odzyskiwaniu:** jeśli odpowiedź `POST` przepadła, a serwer po 90 s nadal jest w fazie przyjmowania materiałów (pobieranie do 150 MB, parsowanie PPTX do 30 s), `recoverJob` zgłosi `not_started` (`cloud.js:493`), a `discard()` usunie przedmiot, choć serwer może jeszcze pobrać limit i generować. Zapis tematu wtedy padnie (klucz obcy `topics.subject_id → subjects`, `0001_init.sql:62`), a limit będzie już pobrany. (Jeśli serwer jeszcze pobiera pliki, skończy się `download_failed` bez pobrania limitu, bo `discard()` kasuje też pliki.)

### 5.3 Limity

| Limit | Wartość | Gdzie |
|---|---|---|
| Generacje na miesiąc | free 3, pro 150 (trial: pro przez 30 dni). Miesiąc kalendarzowy **UTC** (`monthKey`, `plans.ts:73–75`), więc odnawia się 1. dnia o 01:00 albo 02:00 czasu polskiego | `packages/shared/src/plans.ts:19–38`; RPC `increment_usage` |
| Generacje na dobę, konto | 20 w **kroczącym oknie 24 h** (także dla pro; liczą się też nieudane), choć UI mówi „Spróbuj jutro” | `0004_cramfox.sql:103`; pre-check w route.ts:16 |
| Generacje na dobę, cały serwer | 300 (też kroczące 24 h) | `0004_cramfox.sql:106` |
| Pliki na generację | free 5, pro 20 | plan; klient i route.ts:65 |
| `materialIds` w żądaniu | ≤50 | route.ts:23 (martwe, bo plan daje maks. 20) |
| Rozmiar pliku | 50 MB | bucket (0005), plan, `MAX_FILE_MB` w `cloud-ui.js:13` |
| Zdjęcie po zmniejszeniu | ≤5 MB, bok ≤1568 px | `cloud.js:425–437` |
| Materiał łącznie | 150 MB | `MAX_TOTAL_MB` w kliencie, `MAX_TOTAL_MATERIALS_MB` w route.ts:14 |
| Wklejony tekst | 40 – 200 000 znaków | klient; serwer ≤200 000 |
| Tekst łącznie (pliki + wklejony) | 1 500 000 znaków | `materials.ts:229` |
| Obrazy na generację | 40 (20, gdy któreś zdjęcie >2000 px albo rozmiar nieznany), najpierw zdjęcia użytkownika | `materials.ts:221–223` |
| Zdjęcia inline | do 15 MB razem; powyżej przez Files API | `materials.ts:18` |
| PDF | >600 stron albo z hasłem → błąd API 4xx | komunikat w `failGen` |
| Poziomy | klient prosi o 4; w trybie materiałów maks. `min(8, levels+2)` = 6 | `prompts.ts:83–86` |
| Przedmioty | free 5 — **nigdzie nieegzekwowane** | `plans.ts`; `countOwnSubjects` nieużywane |

**PPTX** (`packages/ai/src/pptx.ts`, `PPTX_LIMITS`, `:19–42`):

| Limit | Wartość |
|---|---|
| Wpisy w ZIP | 3000 |
| Zadeklarowany rozmiar po rozpakowaniu | 200 MB |
| Jeden plik XML | 5 MB |
| Czytane slajdy | 300 (reszta pominięta z notką) |
| Zachowany tekst | 400 000 znaków (reszta pominięta z notką) |
| Obraz | 15 kB – 5 MB, bok ≤2000 px (**większe są pomijane, nie zmniejszane**) |
| Logo / tło | obraz na >40% widocznych slajdów i ≥3 slajdach → odrzucony |
| Budżet na generację (przekroczenie = `bad_pptx`) | XML rozpakowany 100 MB, XML przeczytany 200 mln znaków, parsowanie 30 s |
| Budżet obrazów (przekroczenie = pominięcie) | media rozpakowane 200 MB, obrazy zachowane 80 MB |

Ukryte slajdy są pomijane. Obrazy są deduplikowane (SHA-1). Czytane są tylko png, jpeg, gif, webp (EMF, WMF, TIFF, SVG nie). Każda prezentacja staje się tekstem („Slajd N: tytuł”, treść, „Notatki prowadzącego: …”) i obrazami „<prezentacja> — slajd N”.

### 5.4 Czasy

| Co | Ile |
|---|---|
| Typowa generacja | ok. 2 min, synchronicznie |
| Maks. czas funkcji `generate` na Vercelu | 300 s (`maxDuration`) |
| Budżet całej generacji | `GENERATION_BUDGET_MS = 250 000` (**ogranicza tylko review**) |
| Review jednego poziomu | 45 s |
| Klient czeka na odpowiedź API | 310 s (`readTimeout`) |
| Klient Anthropic | timeout 10 min na próbę, `maxRetries: 2` (domyślne ponawianie SDK: 408, 409, 429, 5xx i błędy połączenia; `client.ts:12`). Jedno wywołanie może więc trwać dużo dłużej niż 300 s Vercela |
| Pliki w Files API | wygasają po 7200 s |
| Kasowanie plików z Files API | 10 s, 1 ponowienie |
| Wysyłka do Storage | 180 s na żądanie albo kawałek TUS |
| Odzyskiwanie | co 8 s; `not_started` po 90 s; `lost` po 330 s; dziennik ważny 24 h |

### 5.5 Modele i koszty

| Zadanie | Model | Zmienna |
|---|---|---|
| Plan i poziomy | `claude-opus-5` | `RECALL_AI_MODEL` (stara nazwa `NAUKA_AI_MODEL`) |
| Review | `claude-sonnet-5` | `RECALL_AI_FIX_MODEL` (musi obsługiwać adaptive thinking i `effort`; Haiku 4.5 nie obsługuje i wtedy każde review cicho się nie uda) |
| Tutor (Cramfox go nie używa) | jak generowanie | |

Parametry generowania (`callOnce`, `generate.ts:206–237`): beta `server-side-fallback-2026-07-01` z `fallbacks:"default"`, adaptive thinking, `effort:"medium"`, wymuszony format JSON (zod), streaming, cache promptu (system i ostatni blok materiału). Gdy API odrzuci gramatykę, jest jedno płatne ponowienie bez formatu i z ręcznym parsowaniem. Zapisywany `servedModel` to model, który faktycznie odpowiedział.

**Liczba wywołań:** 1 + 3N (plan + rdzeń, zadania i review na poziom), czyli 13 przy 4 poziomach, 19 przy 6, 25 przy 8.

**Koszt:** jedyna liczba w dokumentach to **ok. $0,15–0,40 za generację** (`nauka-backend/docs/DEPLOY.md:41`, 5 zdjęć, 4 poziomy). Pochodzi sprzed dwóch wywołań na poziom, review i większych limitów tokenów, więc jest **prawdopodobnie zaniżona — do sprawdzenia** w konsoli Anthropic. Kolumna `generations.input_tokens` sumuje tokeny z cache bez wag, więc nie nadaje się wprost do liczenia kosztu.

**Tryb demo:** gdy na serwerze nie ma `ANTHROPIC_API_KEY` ani `ANTHROPIC_AUTH_TOKEN`, powstaje temat demo (model `"demo"`, `tagline` zaczyna się od „DEMO —”, `packages/ai/src/demo.ts:95`). Prefiks „DEMO · ” z `route.ts:126` dokleja się tylko, gdy w `tagline` nie ma „DEMO”, więc w praktyce się nie pojawia. Użytkownik widzi baner trybu demo na ekranie „Gotowe” (pole `demo`, `cloud-ui.js:404`). **Limit i tak jest pobierany.**

### 5.6 Co psuje generację, a co tylko ją zubaża

| Psuje generację (limit już pobrany) | Tylko zubaża |
|---|---|
| zabicie funkcji przez Vercel po 300 s (patrz niżej) | wszystkie poziomy wyszły puste po finalizacji: zapisuje się temat z jednym pustym „Poziom 1” (`finalize.ts:546`), który zalicza się sam (`engine.js:2304`). Limit zjedzony za pusty przedmiot |
| odmowa modelu (`refusal`) w planie albo poziomie | błąd `invalid_output` / `api` jednego poziomu: poziom znika (tylko `console.warn`, użytkownik nie wie) |
| `too_long` | nieudane wywołanie zadań: `tasks: []` |
| jakikolwiek błąd planu | błąd review: zostaje oryginalny poziom |
| wszystkie poziomy nieudane | wadliwe pytania, gry, zadania, schematy: odrzucone w finalizacji |
| wyjątek spoza API w poziomie | nieudane kasowanie plików z Files API: tylko ostrzeżenie |
| błąd wysyłki do Files API | |
| błąd `TopicContentSchema.parse` albo zapisu tematu | |

**Nigdy nie pobierają limitu:** wszystkie błędy z etapu sprawdzeń (punkt 9 w [5.1](#51-przebieg)).

**Nieudana generacja nie jest zwracana** (route.ts:148, celowo).

**Twarde zabicie po 300 s.** `GENERATION_BUDGET_MS` ogranicza tylko review (`generate.ts:304`); plan i poziomy nie mają zegara. Gdy Vercel zabije funkcję:
- wiersz `generations` zostaje na zawsze `running`;
- pliki w Files API nie są kasowane (wygasną po 2 h);
- klient dostaje 504 bez JSON-a, zamienia go na `generation_failed` i **usuwa dziennik** (`cloud.js:476`), więc odzyskiwanie się nie uruchomi;
- limit jest pobrany.

**Dwie ścieżki błędu 500 bez `code`** (klient pokazuje je jako `generation_failed` z dopiskiem „Ta próba liczy się do miesięcznego limitu”):
- `route.ts:71`: błąd zapytania o `materials`, **przed** pobraniem limitu, więc dopisek jest tu nieprawdziwy;
- `route.ts:120`: błąd wstawienia wiersza `generations`, **po** pobraniu limitu.

### 5.7 Kody błędów i co widzi użytkownik

Komunikaty są w `failGen` (`cloud-ui.js:313–355`). „+limit” oznacza dopisek: „Ta próba liczy się do miesięcznego limitu.” Jeśli użytkownik nie jest na ekranie generowania, dostaje tylko toast „Nie udało się utworzyć lekcji — spróbuj ponownie”. Przycisk **WRÓĆ DO MATERIAŁU** jest wszędzie poza `limit_reached`, `unauthorized` i `no_session`.

| Kod | Skąd | Limit pobrany? | Tytuł w apce | Uwagi |
|---|---|---|---|---|
| `limit_reached` (`used` ≥1999999) | serwer 402 | nie | Serwer ma dziś bardzo dużo pracy | „Nowe lekcje będzie można tworzyć jutro. Twój limit się nie zmienił.” (globalne 300/dobę) |
| `limit_reached` (`used` ≥999999) | serwer 402 | nie | Na dziś wystarczy | „Dzienny limit nowych lekcji jest wykorzystany. Spróbuj jutro.” (20/dobę na konto) |
| `limit_reached` (inne) | klient albo serwer 402 | nie | Limit na ten miesiąc wykorzystany | „Wykorzystano X z Y lekcji w tym miesiącu. Limit odnowi się 1. dnia miesiąca.” |
| `too_many_files` | klient albo serwer 400 | nie | Za dużo plików naraz | „Maksymalnie N plików…” (domyślnie 5) |
| `file_too_big` | klient, Storage 413, serwer 400 | nie | Plik jest za duży | z nazwą pliku i limitem MB |
| `too_much_material` | klient albo serwer 400 | nie | Za dużo materiału naraz | „…do N MB…” (domyślnie 150) |
| `upload_failed` | klient (Storage) | nie | Nie udało się wysłać pliku | |
| `bad_type` | klient | nie | Nieobsługiwany format | wariant HEIC: „Zdjęcie w formacie HEIC” |
| `bad_materials` | serwer 400 | nie | Nie mogę odczytać materiału | |
| `no_input` | serwer 400 | tak (błąd z generowania) | Brak materiału | |
| `bad_pptx` | serwer 400 | nie | Nie mogę otworzyć prezentacji | |
| `pptx_protected` | serwer 400 | nie | Prezentacja jest zabezpieczona albo w starym formacie | |
| `pptx_empty` | serwer 400 | nie | Prezentacja nie ma treści | |
| `download_failed` | serwer 500 | nie | Nie udało się odczytać plików | |
| `reserve_failed` | serwer 500 | nie | Serwer chwilowo nie działa | |
| `too_long` | serwer 400 | zależy | Za dużo materiału na jedną lekcję | +limit, gdy odpowiedź ma `generationId`; inaczej „Limit się nie zmienił.” |
| `generation_failed` | serwer 500 albo odzyskiwanie | tak | AI nie dało rady z tym materiałem | +limit |
| `refusal` | serwer 500 | tak | AI nie przetworzy tego materiału | +limit |
| `invalid_output` | serwer 500 | tak | Nie dało się ułożyć lekcji | +limit |
| `api` | serwer 500 | tak | Serwer AI jest przeciążony | +limit. Przy „AI: 4xx” (poza 429): „Tego materiału nie da się przetworzyć” (PDF >600 stron albo z hasłem) |
| `not_started` | klient (odzyskiwanie) | nie (wyjątki niżej) | Lekcja nie zaczęła się tworzyć | Wiersz `generations` powstaje zaraz po pobraniu limitu (`route.ts:115`), więc brak wiersza zwykle znaczy, że limitu nie pobrano, i tekst „Limit się nie zmienił” (`cloud-ui.js:340`) jest prawdziwy. Wyjątki: nieudane wstawienie wiersza (`route.ts:120`, po pobraniu) i wyścig z [5.2](#52-odzyskiwanie-przerwanej-generacji) |
| `lost` | klient (odzyskiwanie) | tak | Generowanie się nie dokończyło | +limit |
| `network`, `timeout` | klient | zależy od momentu | Brak połączenia | przy błędzie w trakcie `POST` dziennik zostaje i rusza odzyskiwanie |
| `network_after_post` | klient | tak | | temat powstał, ale apka go nie pobrała; dziennik zostaje i odzyskiwanie go dociąga |
| `not_found` | serwer 404 | nie | Nie ma już tego przedmiotu | |
| `unauthorized`, `no_session` | serwer 401 / klient | nie | Sesja wygasła | |
| `no_config` | serwer 503 | nie | Serwer chwilowo nie działa | |
| `bad_request` | serwer 400 | nie | (domyślny) Coś poszło nie tak | |
| nieznany, status ≥500 | | prawdopodobnie | Coś poszło nie tak po stronie serwera | +limit |
| nieznany, inny | | | Coś poszło nie tak | |

**Ukryty kontrakt:** apka rozpoznaje limit dzienny i globalny po wartościach `used` (999999 i 1999999). Zmiana tych liczb w backendzie wymaga zmiany w `cloud-ui.js:321–322`.

---

## 6. Format danych przedmiotu

**W skrócie:** Serwer zapisuje każdy temat jako jeden obiekt JSON (`TopicContent`) w kolumnie `topics.content`. Apka skleja wszystkie tematy przedmiotu w jedną ścieżkę poziomów i po drodze wszystko czyści. Indeksy w tablicach (fiszki, pytania) są kluczami postępów, więc elementów nie wolno usuwać ani przestawiać.

Źródło prawdy: zod w `nauka-backend/packages/shared/src/schema.ts` (lustro TS w `types.ts`).

### 6.1 Hierarchia

```
Przedmiot (tabela subjects)          np. „Biologia”
  └── Temat (tabela topics, content = TopicContent)   jeden na każdą generację
        └── Poziom (levels[])        l1, l2, ...
              ├── feed[]            dawki (porcje wiedzy w czacie), opcjonalnie viz
              ├── flashcards[]      fiszki {t, d}
              ├── quiz[]            pytania {q, a[], c, e, src?}
              ├── games[]           stare minigry (zamieniane na zadania)
              └── tasks[]           zadania 2.0
```

### 6.2 TopicContent (`schema.ts:278–289`)

| Pole | Reguła |
|---|---|
| `name` | 1–120 |
| `short` | 1–30 |
| `emoji` | 1–8 znaków, wymagane (apka nie pokazuje emoji) |
| `tagline` | ≤300 |
| `accent`, `accent2` | 1–200 / 1–40 |
| `lang?` | bool (przedmiot językowy) |
| `grading` | `pass` 0–100, `examMin` 1–240, `scale` [[próg, etykieta]…] ≥1, `failLabel` |
| `info` | HTML ≤20 000 |
| `levels` | 1–30 |

Skala zapisywana według etapu (`GRADING_BY_STAGE`, `finalize.ts:30–35`; AI jej nie wybiera):

| Etap | `pass` | `examMin` | Progi | `failLabel` |
|---|---|---|---|---|
| `podstawowa` | 50 | 15 | 95 „6”, 85 „5”, 70 „4”, 50 „3”, **30 „2”** | „1 — spróbuj jeszcze raz” |
| `liceum` | 50 | 20 | jak wyżej | jak wyżej |
| `studia` | 50 | 20 | `DEFAULT_GRADING` (`finalize.ts:17–28`): 90 „5”, 80 „4,5”, 70 „4”, 60 „3,5”, 50 „3” | „2 — niezaliczone” |
| `inne` | 60 | 20 | 90 „mistrz”, 75 „solidnie”, 60 „zaliczone” | „jeszcze nie” |

- **Etykiety dla `inne` mają emoji** (puchar, biceps, ptaszek, krzyżyk), więc apka musi je czyścić.
- Klient liczy zaliczenie od najniższego progu (`pass = min(pass, najniższy próg)`, `cloud.js:279–280`), więc **dla `liceum` i `podstawowa` egzamin zalicza się od 30%** (ocena „2” jest pozytywna). Dla `studia` i `inne` próg się nie zmienia (50 i 60).

### 6.3 Poziom i jego elementy

| Element | Pola i limity |
|---|---|
| Level (`:258–269`) | `id` 1–40 (`l1`…), `title` 1–120, `emoji` 1–8, `summary?` ≤300, `feed` ≤30, `flashcards` ≤60, `quiz` ≤60, `games?` ≤6, `tasks?` ≤20, `fromMaterial?` ≤80 (nigdy niewypełniane) |
| FeedItem (`:57`) | `title` 1–200, `body` 1–4000 (prosty HTML: b, i, br, ul/li), `real?` ≤1000, `mnemo?` ≤1000, `viz?` |
| Flashcard (`:65`) | `t` 1–300, `d` 1–2000 |
| QuizQuestion (`:77–85`) | `q` 1–1000, `a` 2–5 odpowiedzi po 1–500, `c` ≥0 i < liczby odpowiedzi (**indeks od 0**), `e` 1–2000 **wymagane**, `src?` |
| TaskSource (`:71`) | `material?` ≤80 (nigdy niewypełniane), `page?` ≥0, `quote?` ≤600 |

Co AI ma wygenerować na poziom (tylko w prompcie, **schemat tego nie wymusza**): 4–7 dawek po 40–90 słów, 6–10 fiszek, 6–10 pytań z 4 odpowiedziami, 1 gra, 4–6 zadań.

Kod nie wymusza minimalnych liczności:
- `MIN_QUIZ = 5` i `MIN_TASKS = 2` istnieją **tylko w review** (`packages/ai/src/review.ts:98`, `:100`): poniżej tych progów review nie usuwa pytań ani zadań. Nie dodaje brakujących.
- Finalizacja nie ma minimów: odrzuca wadliwe elementy i zostawia poziom, jeśli ma cokolwiek w quizie, fiszkach albo dawkach (`finalize.ts:534`). Gdy nie zostanie żaden poziom, zapisuje pusty „Poziom 1” (`finalize.ts:546`).

### 6.4 Schematy (viz) (`schema.ts:10–55`)

Każdy typ może mieć `caption?` ≤120. Nieznane klucze są usuwane.

| Typ | Pola |
|---|---|
| `timeline` | `items[{when ≤24, label ≤80}]`, 3–7 |
| `compare` | `a ≤40`, `b ≤40`, `rows[{k ≤40, a ≤80, b ≤80}]`, 2–5 |
| `cycle` | `steps[≤60]`, 3–6 |
| `flow` | `kind`: cause albo process, `steps[≤60]`, 2–6 |
| `tree` | `root ≤60`, `groups[{name ≤40, items[≤50] 1–5}]`, 2–4 |
| `bars` | `unit ≤12`, `items[{label ≤40, value ≥0}]`, 2–7 |
| `numbers` | `items[{value ≤16 (tekst), label ≤80}]`, 1–4 |

Schematy powstają tylko przy `options.viz: true` (wysyła je nowy klient). Serwer zostawia maks. `ceil(liczba dawek / 2)` na poziom i sprawdza ugruntowanie:
- ≥75% etykiet musi dzielić 4-literowy rdzeń z tekstem całego poziomu;
- każda liczba w polach danych (`when`, `value`) musi wystąpić w treści **tej** dawki (`body` albo `real`; uwaga: `real` nie jest wyświetlane, więc liczba może być tylko w niewidocznym tekście);
- liczby w etykietach też, poza liczbami całkowitymi 0–10 obecnymi gdziekolwiek w poziomie.

### 6.5 Zadania (`schema.ts:124–256`)

Wspólne pola: `title?` ≤200, `e?` ≤2000, `src?`. AI może tworzyć 12 typów (`AI_TASK_TYPES`, `types.ts:275`): `tf, fill, typeterm, swipe, thesis, scenario, finderror, timeline, chain, match, order, sort`. Nie tworzy `chart`, `mathsteps`, `hotspot`.

| Typ | Dane |
|---|---|
| `match` | `pairs: [l ≤300, r ≤300][]` (pary jako tablice), 2–10 |
| `fill` | `text` ≤1500 z `{n}`, `blanks[≤120]` 1–6, `bank[≤120]` ≤10, `hint?` ≤300 |
| `order` | `items[≤300]` 2–8 w poprawnej kolejności |
| `sort` | `buckets[{name ≤80, items[≤200] 1–8}]`, 2–4 |
| `tf` | `seconds?` 10–600, `statements[{s ≤600, v, e?}]` 1–15 |
| `timeline` | `events[{label ≤200, year}]`, 2–8 |
| `finderror` | `sentences[≤400]` 2–6, `wrong` (indeks), `fix` ≤400 |
| `thesis` | `thesis` ≤800, `q?`, `options[{name ≤120, sub? ≤200}]` 2–6, `c` |
| `chain` | `steps[≤300]` 2–8, `given` (indeksy), `bank[≤300]` ≤8 |
| `scenario` | `scene` ≤1500, `q` ≤400, `a[≤400]` 2–5, `c` |
| `swipe` | `left`, `right` ≤60, `cards[{front ≤200, sub?, side, e?}]` 2–12 |
| `typeterm` | `definition` ≤800, `answer` ≤80, `accept?[≤80]` ≤8, `typo?` 0–3 (schemat bez wartości domyślnej, `schema.ts:204`; finalizacja wpisuje zadaniom od AI `typo:1`, `finalize.ts:210`; klient traktuje brak jako 0) |
| `chart` | `chart{kind, label?, x[] 2–12, y[≥0] 2–12}` (`kind`: bar albo line), `q`, `a[]` 2–5, `c` |
| `mathsteps` | `start` ≤200, `steps[{expr, note?, options[] 2–6, c}]` 1–8 |
| `hotspot` | `image` ≤20 000, `alt?`, `targets[{name, x, y, r}]` 1–10 |

**Stare minigry** (`games`, `:87–122`): `match` (3–10 par `{l, r}`), `cloze` (2–12 zdań z luką `___`), `truefalse` (3–15), `order` (3–8 kroków i polecenie). Apka zamienia je na zadania, gdy poziom nie ma obsługiwanych `tasks`.

### 6.6 Mapowanie do silnika (`toEngine`)

`cloud.js:203–285` (`toEngine`, `:273`).

| Pole silnika | Skąd |
|---|---|
| przedmiot | przedmiot z bazy; przedmioty bez tematów są pomijane |
| `id` | uuid przedmiotu |
| `levels` | poziomy wszystkich tematów po kolei (według `position`, potem `created_at`) |
| `levels[].id` | `'t' + pierwsze 8 znaków topicId bez myślników + '_' + id poziomu`, znaki spoza `[A-Za-z0-9_-]` → `_`; przy kolizji `_2`, `_3`… **Bez `:`**, bo klucze SRS dzielą się po `:` |
| `levels[].chapter` | `true` dla pierwszego poziomu każdego tematu po pierwszym (odblokowany od razu) |
| `accent`, `accentDark`, `onAccent` | z palety 6 kolorów (`PALETTE`, `:204`): dopasowanie do `accent` z bazy albo `hash(id) % 6`; `accent2` = `accent` |
| `level` | z `stage` (`podstawowa` ↔ `podstawowka`, reszta bez zmian) |
| `lang` | `true`, jeśli którykolwiek temat ma `lang`. **W praktyce zawsze fałsz**: klient nie wysyła `options.lang`, a serwer zapisuje `content.lang` tylko z niego ([3.7](#37-zadania)) |
| `grading` | **tylko z pierwszego tematu**, i tylko gdy jest niepusta skala: skala malejąco, `pass` = mniejsze z (`pass`, domyślnie 50) i najniższego progu (dla `liceum`/`podstawowa` wychodzi 30), `examMin` = co najmniej 1, domyślnie 10, `failLabel` domyślnie „niezaliczone”. Bez skali `grading` jest puste i silnik bierze własne domyślne (20 min, „2 — niezaliczone”) |
| `info` | `clean()` każdego `info`, sklejone |
| `topics` | `[{id, name, createdAt}]` |
| `short` | cała nazwa, gdy ma ≤14 znaków; inaczej pierwsze słowo, jeśli ma ≤14 znaków; dłuższe pierwsze słowo przycięte do 13 znaków + „…” (`cloud.js:211`) |

`mapLevel` (`:262–272`), czyszczenie pól:

| Element | Jak |
|---|---|
| `feed` | wszystko `deepEsc`; `body`, `real`, `mnemo` przez `clean()`; `viz` przez `mapViz` |
| `flashcards` | `deepEsc`, a `d` przez `clean()` |
| `quiz` | `deepEsc`; zły `c` → 0; `q` i `e` na tekst |
| `tasks` | obsługiwane typy (`TASK_OK`, 14: `match, fill, order, sort, tf, timeline, finderror, thesis, chain, scenario, swipe, typeterm, chart, mathsteps`) zostają; **każdy inny, także `hotspot`, staje się `{type:'_skip'}`**, żeby nie przesunąć indeksów. Bez obsługiwanych zadań: `gamesAsTasks` (match, cloze → fill po 4, truefalse → tf, order) |
| `title` | `esc(noEmoji(title))`, domyślnie „Poziom N” |

`mapViz` (`:234–248`) przycina teksty do limitów z [6.4](#64-schematy-viz-schemats1055), usuwa tagi i emoji, na końcu `esc`. Za mało poprawnych elementów → `null` (schematu nie ma). `vizText(v)` (`:250–261`) zamienia schemat na zwykłe zdania (do „Wyjaśnij inaczej”, znaczeń pojęć i luk).

### 6.7 Indeksy jako klucze postępów

| Tablica | Klucze, które od niej zależą |
|---|---|
| `flashcards[i]` | SRS i album `sid:lid:i`, `fState.only` `lid:i`, pozycje w cramie i powtórce |
| `quiz[qi]` | SRS `sid:lid:q<qi>`, poprawki `sid:lid:qi`, talia błędów `examDeck` |
| `s.levels[idx]` (pozycja w przedmiocie) | skrzynie `chests["<idx>"]` |
| `tasks[]`, `feed[]` | silnik nie trzyma po nich kluczy, ale kontrakt (CLAUDE.md) i tak zabrania usuwania; nieobsługiwane zadania dostają `_skip` |
| id zadań planu dnia | zależą od `subjectId` i `levelId`, nie od indeksów |

Wniosek: **nie usuwaj, nie przestawiaj i nie wstawiaj w środek** elementów `flashcards`, `quiz`, `tasks`, `feed` istniejących tematów. Nowe pola dodawaj jako opcjonalne.

---

## 7. Backend

**W skrócie:** Backend to Supabase (baza, konta, pliki, zadania cron) i jedna apka Next.js na Vercelu z kilkoma endpointami. Cramfox używa tylko `POST /api/generate` i `GET /api/me`; reszta (tutor, Stripe) służy starej apce webowej Recall. Bezpieczeństwo danych opiera się na RLS: każdy widzi tylko swoje wiersze.

### 7.1 Gdzie co leży

| Co | Gdzie |
|---|---|
| API (Next.js route handlers) | `nauka-backend/apps/web/src/app/api/*/route.ts` |
| Logika AI | `nauka-backend/packages/ai/src/` (`generate.ts`, `intake.ts`, `materials.ts`, `pptx.ts`, `review.ts`, `client.ts`, `tutor.ts`) |
| Schematy, prompty, plany, finalizacja | `nauka-backend/packages/shared/src/` (`schema.ts`, `types.ts`, `prompts.ts`, `plans.ts`, `finalize.ts`, `quiz-quality.ts`, `coverage.ts`, `review.ts`) |
| Migracje 0001–0003 | `nauka-backend/supabase/migrations/` |
| Migracje 0004–0006 (Cramfox) | **`nauka-app/backend/`** |
| Skrypty tylko dla deweloperskiej bazy | `nauka-backend/supabase/reset_dev.sql` (kasuje wszystko, **nigdy na produkcji**), `dev_upgrade_v1_to_v2.sql` |
| Dokumentacja (częściowo nieaktualna) | `nauka-backend/docs/API.md`, `DEPLOY.md` i inne |

Prompty nazywają apkę „Recall”, nie „Cramfox”.

### 7.2 Endpointy

Wspólne: autoryzacja `Authorization: Bearer <access_token z Supabase>` albo cookie; błędy jako `{error, code?, ...extra}`; **brak nagłówków CORS**; brak konfiguracji Supabase → 503 `no_config`.

`maxDuration` ustawia się **per plik trasy**: w `export const maxDuration` w `route.ts` i w `apps/web/vercel.json` (`functions`: generate 300, tutor 60). Nowe długie trasy (np. wykłady) trzeba dopisać w obu miejscach.

| Endpoint | Kto używa | maxDuration | Opis |
|---|---|---|---|
| `POST /api/generate` | Cramfox | 300 s | materiały → temat (sekcja [5](#5-tworzenie-przedmiotu-krok-po-kroku)) |
| `GET /api/generate?id=` | (Cramfox odzyskuje inaczej, przez REST) | | `{status, topicId, error}`; 400 „Brak ?id”, 404 „Nie znaleziono” |
| `GET /api/me` | Cramfox | | `{profile, plan, usage:{month, generations, tutorMessages}, limits, subscription}`. **`limits` zawiera ceny w PLN** — apka nie może ich pokazywać. `profile` (`lib/plan.ts:17`) ma `id, email, display_name, stage, plan, stripe_customer_id`, bez `trial_until`. |
| `POST /api/tutor` | stary web | 60 s | czat z tutorem; limit free 30/dzień (jako 30 × dzień miesiąca). Konto na trialu przy limicie dostaje **500** zamiast 402 (wyjątek `tutor_cap`). Pobiera limit przed odpowiedzią, nie zwraca. |
| `POST /api/stripe/checkout` | stary web | | sesja Stripe Checkout; zły body → 500 zamiast 400 |
| `POST /api/stripe/portal` | stary web | | portal rozliczeń; 400 `no_customer` |
| `POST /api/stripe/webhook` | Stripe | | aktualizuje `subscriptions` i `profiles.plan`. Usunięcie subskrypcji konta na trialu od razu ustawia `free`. |

**Treść `POST /api/generate`** (route.ts:20–31): `subjectId` (uuid), `materialIds` (≤50 uuid, domyślnie `[]`), `text?` (≤200 000), `options` (`stage` wymagane; `subjectName?` ≤80; `mode?` `materials|prompt`; `hint?` ≤2000; `levels?` 1–8; `lang?`; `locale?` `pl|en`; `viz?`). Tryb `materials` wymaga plików albo tekstu, tryb `prompt` wymaga `hint`.

**Odpowiedź 200:** `{generationId, topicId, topic, demo}`. **Błąd po pobraniu limitu:** `{error, code, generationId}`, HTTP 400 dla `no_input` i `too_long`, inaczej 500; wiersz `generations` dostaje `failed` z opisem do 2000 znaków.

`proxy.ts` (middleware Next) odświeża cookie Supabase przy każdym żądaniu, także do API. Ma **otwarte przekierowanie** w `proxy.ts:39` (`/login?next=https://…`), ale dotyczy tylko weba.

### 7.3 Tabele

Projekt Supabase `zhgxhdsnizujzygpcyfl` („nauka”), eu-central-1. Typy: `stage` (podstawowa, liceum, studia, inne), `plan` (free, pro), `generation_status` (queued, running, done, failed).

| Tabela | Najważniejsze kolumny | RLS |
|---|---|---|
| `profiles` | id → auth.users, email, display_name, stage, plan, stripe_customer_id, show_on_leaderboard, goal, **trial_until** (0004) | SELECT swoje; UPDATE swoje, ale bez zmiany `plan`, `stripe_customer_id`, `trial_until`; brak INSERT i DELETE |
| `subjects` | owner_id, name, emoji, category, stage, accent, accent2, exam_date, exam_label, position | wszystko na swoich |
| `topics` | subject_id (kaskada), owner_id, name, emoji, source (`materials`/`prompt`), **content jsonb**, generation_id, position | wszystko na swoich. **Klient może zapisać dowolny `content` bez walidacji**, dlatego `clean()` w apce jest obowiązkowe |
| `materials` | owner_id, storage_path, mime, size_bytes (pisane przez klienta, niezaufane), name | wszystko na swoich; constraint `materials_path_owner` (`^<owner_id>/<uuid>.<ext>$`) jest **NOT VALID** (stare wiersze niesprawdzone) |
| `generations` | owner_id, status, stage, hint, options, material_ids, subject_id, topic_id, error, model, input/output_tokens, created_at, finished_at | tylko SELECT swoich; pisze service role |
| `usage` | (user_id, month `RRRR-MM`) PK, generations, tutor_messages | tylko SELECT; pisze tylko RPC `increment_usage` |
| `app_state` (0004) | user_id PK, progress jsonb, meta jsonb, client_ts, rev, updated_at; CHECK rozmiar progress+meta < 2 000 000 B | wszystko na swoim (także DELETE) |
| `subscriptions` | user_id PK, stripe_subscription_id, status, price_id, interval, current_period_end, cancel_at_period_end | SELECT swoje; pisze webhook |
| `progress`, `srs_cards`, `activity`, `user_meta`, `quests_daily`, `achievements` | postępy starej apki Recall | wszystko na swoich |

### 7.4 Triggery, RPC, cron

**Triggery:**
- `on_auth_user_created` → `handle_new_user()`: tworzy `profiles` i `user_meta`. Od 0004: gdy `raw_user_meta_data.client = 'cramfox'` → `plan = 'pro'`, `trial_until = now() + 30 dni`; inaczej `free`.
- `touch_<tabela>` → `touch_updated_at()` na profiles, subjects, topics, progress, user_meta, subscriptions.
- `bump_app_state` (BEFORE INSERT OR UPDATE): przy INSERT `rev = 1`, przy UPDATE `rev = stary + 1`, `updated_at = now()`. **`rev` nadaje serwer.**

**RPC:**

| RPC | Działanie | Dostęp |
|---|---|---|
| `increment_usage(p_user, p_month, p_field)` | `generations`: najpierw limity dobowe (≥20 wierszy `generations` konta w 24 h → zwraca **1000000**; ≥300 globalnie → **2000000**; licznik bez zmian), potem +1 i zwraca sumę miesięczną. Inne pole (tutor): na trialu bez subskrypcji przy ≥30 × dzień miesiąca → wyjątek `tutor_cap` | tylko service role |
| `delete_my_account(p_dry_run)` | `not_authenticated`; `active_subscription` (active / trialing / past_due, także na próbę); `files_remaining` (pliki w `materials/<uid>/`, tylko na serio); potem `delete from auth.users` z kaskadą | tylko zalogowani |
| `end_trials()` | pro → free po końcu `trial_until`, jeśli brak subskrypcji | nikt (tylko cron) |
| `my_total_xp()`, `log_activity(...)`, `weekly_leaderboard(...)`, `my_weekly_rank()` | stara apka Recall | |

**Wartości „sentinel”:** API zwraca 402 `limit_reached` z `used = wynik − 1`, czyli **999999** (limit konta) albo **1999999** (limit serwera). Apka rozpoznaje je po tych liczbach.

**pg_cron:** jedno zadanie `cramfox-end-trials`, `15 * * * *` (co godzinę o :15), `select public.end_trials()`. Trial może więc trwać do ok. godziny dłużej.

### 7.5 Plany i limity

| | free | pro |
|---|---|---|
| Generacje / miesiąc | 3 | 150 |
| Pliki / generacja | 5 | 20 |
| Maks. plik | 50 MB | 50 MB |
| Materiał łącznie na generację | 150 MB | 150 MB (`route.ts:14`) |
| Obrazy na generację (zdjęcia + slajdy) | 40 (20, gdy któreś zdjęcie >2000 px) | jak free (`materials.ts:221`) |
| Przedmioty (`maxSubjects`) | 5 (nieegzekwowane) | 1000 |
| Ceny w `plans.ts` | 0 | 29 / 199 PLN |

- Miesiąc (`monthKey()`) to `RRRR-MM` w UTC.
- Trial: 30 dni pro dla nowych kont Cramfoxa. W UI opisany jako „na start większy limit”.
- Limity dobowe (20 na konto, 300 globalnie) dotyczą też pro i liczą nieudane próby.
- **Wyścig:** limity dobowe liczą wiersze `generations`, które powstają dopiero po pobraniu limitu. Równoległe żądania mogą przejść razem.
- **Limit miesięczny sprawdzany po podbiciu licznika:** `increment_usage` najpierw dodaje 1 (`0004_cramfox.sql:109–111`), a dopiero potem `reserveGeneration` porównuje `used > limit` (`lib/plan.ts:48`). Odrzucone żądanie i tak zostawia licznik ponad limitem (np. 4/3). Wstępne sprawdzenie tylko do odczytu działa tylko w trybie materiałów **z plikami** (`intake.ts:71–75`), więc żądania z samym tekstem i tryb `prompt` zawsze idą tą drogą. UI ukrywa to przez `min(used, lim)` (`cloud-ui.js:156`).
- **Okna limitów:** dobowe to kroczące 24 h (nie doba kalendarzowa, choć UI mówi „Spróbuj jutro”); miesięczne to miesiąc UTC; koniec triala przez cron o :15 co godzinę (do ok. 1 h spóźnienia).
- CLAUDE.md i README wymieniają tylko 300/dobę globalnie; **brakuje tam limitu 20/dobę na konto**.

### 7.6 Bucket `materials`

- Prywatny, limit 52 428 800 B (50 MB, maksimum planu free Supabase; migracja 0005).
- Dozwolone typy: image/jpeg, image/png, image/webp, image/gif, application/pdf, text/plain, text/markdown oraz PPTX (`application/vnd.openxmlformats-officedocument.presentationml.presentation`, migracja 0006; dopisuje tylko, jeśli lista nie jest NULL).
- Polityka `materials storage own`: pierwszy segment ścieżki = `auth.uid()`. Format `{uid}/{uuid}.ext`.
- Plan free Supabase: ok. 1 GB przestrzeni.

### 7.7 Zmienne środowiskowe (tylko nazwy)

| Zmienna | Kto czyta | Uwagi |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | publiczny z założenia |
| `SUPABASE_SERVICE_ROLE_KEY` | web | wymagany dla generate, tutor, checkout, webhook; **tajny** |
| `ANTHROPIC_API_KEY` albo `ANTHROPIC_AUTH_TOKEN` | `@nauka/ai` | bez obu: tryb demo |
| `RECALL_AI_MODEL` (stara nazwa `NAUKA_AI_MODEL`) | `@nauka/ai` | domyślnie `claude-opus-5` |
| `RECALL_AI_FIX_MODEL` | `@nauka/ai` | domyślnie `claude-sonnet-5`; brak w `.env.example`, API.md i DEPLOY.md |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | web | Stripe w trybie testowym (wg DEPLOY.md) |
| `NEXT_PUBLIC_APP_URL` | web | domyślnie `http://localhost:3000` |
| `EXPO_PUBLIC_*` | stara apka Expo | nie dotyczy Cramfoxa |

Po stronie apki: `cloud-config.js` (URL Supabase, klucz anon, URL API; wszystko publiczne).

### 7.8 Znane problemy backendu

1. **Brak zegara na planie i poziomach.** `GENERATION_BUDGET_MS` ogranicza tylko review, a SDK pozwala na 10 min na próbę i 2 ponowienia (także przy 408, 409 i błędach połączenia). Wolny plan albo poziom przekroczy 300 s Vercela: funkcja zostaje zabita, `finally` się nie wykona (pliki w Files API czekają 2 h), wiersz `generations` zostaje na zawsze `running`, a limit jest pobrany. Klient dostaje 504 bez JSON-a, kasuje dziennik i nie odzyskuje ([5.6](#56-co-psuje-generację-a-co-tylko-ją-zubaża)).
2. Limit pobierany przed pracą, bez zwrotu (także w trybie demo).
3. `quality` liczone, ale niezapisywane (tylko logi).
4. `src.material` i `fromMaterial` nigdy niewypełniane.
5. Komentarz o TTL plików mówi 1 h, wartość to 2 h; API.md mówi 3600.
6. Branding „Recall” i emoji w etykietach ocen `inne`.
7. Liczności (dawki, pytania) tylko w prompcie.
8. Nieudany poziom znika po cichu.
9. Review z modelem Haiku cicho się wyłączy.
10. Limit 3 usunięć pytań na poziom tylko w prompcie.
11. Martwy kod: `FIX_DISTRACTORS_PROMPT` (`prompts.ts:184`), `needsLengthFix` (`quiz-quality.ts:46`).
12. Tutor: odpowiedź demo z emoji, prompt „luźno” (sprzeczne z tonem). Cramfox tutora nie używa.
13. Dwie ścieżki 500 bez `code` (`route.ts:71` przed pobraniem limitu, `:120` po) i limit miesięczny sprawdzany po podbiciu licznika ([5.6](#56-co-psuje-generację-a-co-tylko-ją-zubaża), [7.5](#75-plany-i-limity)).

---

## 8. Bezpieczeństwo i prywatność

**W skrócie:** Najważniejsze zagrożenie to treść od AI (albo spreparowana w bazie), która trafia do `innerHTML` w WebView z mostkiem do natywnych pluginów. Dlatego każdy tekst z bazy przechodzi przez sanitizer, a build ma ścisłe CSP. Dostęp do danych w bazie pilnuje RLS, sekrety są tylko na Vercelu, a przed pierwszym wysłaniem materiału apka pyta o zgodę na AI.

### 8.1 Sanitizer (`cloud.js:185–201`)

| Element | Zasada |
|---|---|
| Dozwolone tagi (`OK_TAGS`) | `b i em strong u s br p ul ol li div span h3 h4 table thead tbody tr th td code sup sub small mark blockquote hr` |
| Usuwane z treścią (`DROP_TAGS`) | `script style iframe object embed svg math img video audio source link meta base form input button textarea select option template noscript frame frameset canvas picture track applet` |
| Nieznane tagi | rozpakowane (zostaje tekst); komentarze usunięte |
| Atrybuty | tylko `class`, i tylko wartości `zbox` i/lub `gradetbl` |
| `clean(s)` | bez `<>&"'` → bez zmian; inaczej każdy `<`, który nie zaczyna dozwolonego tagu, jest escapowany, potem parsowanie w `<template>` i ponowna serializacja |
| `esc` / `plain` | escapuje `& < > " '` |
| `deepEsc` | `esc` rekurencyjnie w tablicach i obiektach |
| `noEmoji` | usuwa `\p{Extended_Pictographic}`, VS16, ZWJ |

Dodatkowo:
- schematy są budowane z własnego HTML apki; AI nie dostarcza ani HTML, ani SVG;
- zadanie `hotspot` (obrazek) jest zawsze wyłączane w danych z chmury;
- `cloud-ui.js` używa `textContent`, poza `renderReady` (`:414`), gdzie tytuł jest już escapowany;
- toasty silnika używają `textContent` (`engine.js:550`);
- `renderError` używa `innerHTML`, więc dane wejściowe muszą być escapowane (`failGen` to robi).

**Zasada:** nic z bazy nie trafia do DOM bez `clean()` albo `esc()`.

### 8.2 CSP (`build.js:24–32`)

| Dyrektywa | Wartość |
|---|---|
| `default-src` | `'none'` |
| `script-src` | hashe sha256 czterech skryptów, **bez `unsafe-inline`** |
| `style-src` | `'unsafe-inline' https://fonts.googleapis.com` |
| `font-src` | `https://fonts.gstatic.com data:` |
| `img-src` | `'self' data: blob:` |
| `connect-src` | `'self'`, domena Supabase, domena API |
| `base-uri`, `form-action`, `object-src` | `'none'` |

`index.html` (wersja deweloperska) **nie ma CSP**.

### 8.3 RLS, IDOR i zaufanie

- Klucz anon jest publiczny; dostęp ogranicza RLS (każda tabela: tylko swoje wiersze). Wyjątek poza tabelami: stare RPC `weekly_leaderboard()` (Recall) jest `security definer` i pokazuje `display_name` i XP innych użytkowników, ale tylko tych z włączonym `show_on_leaderboard` (`0002_gamification.sql:49–65`).
- `profiles`: użytkownik nie może sam zmienić `plan`, `stripe_customer_id` ani `trial_until` (polityka z 0004). **Ponowne uruchomienie 0001 albo 0002 na produkcji odtworzy politykę bez `trial_until`** ([9.4](#94-migracje-bazy)).
- `usage`, `generations`: zapis tylko przez serwer.
- `topics.content` można zapisać z klienta bez walidacji → ochroną jest `clean()`.
- `materials.size_bytes` i `mime` pisze klient → serwer sprawdza prawdziwe rozmiary po pobraniu.
- `materials_path_owner` jest NOT VALID, a API pobiera pliki kluczem service role. Plan wykładów (C9) zaleca dodatkowo sprawdzać w kodzie, że ścieżka zaczyna się od `uid/`.
- Tokeny sesji są w zwykłym localStorage (`cf_session`). Chroni je tylko sanitizer i CSP.

### 8.4 Klucze i sekrety

- **Publiczne** (mogą być w repo): URL Supabase, klucz anon, URL API (`cloud-config.js`).
- **Tajne** (tylko w zmiennych Vercela): `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_*`.
- **Nigdy** nie uruchamiaj `vercel pull` ani `vercel env pull` (ściągają sekrety do plików `.env`).
- **Lokalne logowania CLI to w praktyce dostęp administratora produkcji:** token Vercel CLI (`~/Library/Application Support/com.vercel.cli/auth.json`) pozwala wdrażać i czytać zmienne projektu, a token Supabase CLI (`supabase login`, potrzebny do `db query --linked`) daje dostęp do bazy przez Management API. Nie udostępniaj tych plików i wyloguj CLI na obcym komputerze.
- `.gitignore` w obu worktree ignoruje `.env*` i `.vercel`. `supabase/.temp/` (m.in. `linked-project.json` z identyfikatorem organizacji) i `.claude/` w apce **nie** są ignorowane, więc `git add -A` by je dodał.

### 8.5 Zgody i wiek

- **16+:** checkbox przy rejestracji, wysyłane jako `age16:true`.
- **Zgoda na AI (v1):** arkusz przed pierwszym materiałem, zapis daty w `META.aiConsent` (`cloud-ui.js:194–201`); wymienia Claude (Anthropic). Dla nagrań wykładów potrzebna będzie wersja 2 (ElevenLabs, USA).
- **Polityka prywatności:** tylko arkusz w apce, **brak publicznego URL** (potrzebny do App Store).

### 8.6 App Store

| Wytyczna | Co to znaczy dla nas | Stan |
|---|---|---|
| 3.1.1 (zakupy w aplikacji) | W UI nie może być płatności, cen ani słowa „Pro”. Stripe zostaje na webie. Trial opisany jako „na start większy limit”. `/api/me` zwraca ceny, apka ich nie pokazuje. Zakupy w aplikacji trzeba dodać osobno (DEPLOY.md §5 sugeruje RevenueCat mapowany na `profiles.plan`). | prawie: jeden wyjątek, komunikat o „subskrypcji kupionej poza aplikacją” przy usuwaniu konta (`cloud-ui.js:184`, [4.2](#42-wylogowanie-i-usunięcie-konta)); IAP do zrobienia |
| 5.1.1(v) (usuwanie konta) | Usuwanie konta w apce | jest |
| 5.1.2(i) (dane do AI firm trzecich) | Zgoda przed pierwszym wysłaniem, z nazwą dostawcy | v1 jest; dla nagrań potrzebna v2 |
| Etykiety prywatności | e-mail, treści użytkownika (zdjęcia, pliki, tekst), postępy; później „Audio Data”; powiązane z użytkownikiem, cel „funkcjonalność”, bez śledzenia | do wypełnienia |

### 8.7 Znane ryzyka bezpieczeństwa

1. **Farmienie triali:** `client:'cramfox'` w metadanych rejestracji plus brak potwierdzania maila daje dowolną liczbę kont z 30 dniami pro. Hamują tylko limity 20 i 300 na dobę (i te da się obejść wyścigiem).
2. **Wyścig limitów dobowych** (patrz [7.5](#75-plany-i-limity)).
3. **Tokeny w localStorage.**
4. **Otwarte przekierowanie** w `proxy.ts:39` (tylko web).
5. **Brak walidacji `topics.content`** po stronie bazy.

---

## 9. Jak pracować

**W skrócie:** Zmiana w apce to: edycja plików źródłowych, `node build.js`, `npm run sync`, test w symulatorze, archiwum z kolejnym numerem builda i wysyłka do TestFlight. Zmiana w backendzie to: edycja w `nauka-backend`, testy, a potem wdrożenie z kopii bez gita (bo wdrożenie z repo jest blokowane). Migracje bazy to nowe, idempotentne pliki SQL wgrywane przez Supabase CLI.

### 9.1 Zmiana w apce

1. Edytuj pliki źródłowe w `/Users/ignacykrasnodebski/nauka-app` (`engine.js`, `cloud.js`, `cloud-ui.js`, `styles.css`), **nigdy** `build/`.
2. Zbuduj:

   ```bash
   cd /Users/ignacykrasnodebski/nauka-app
   node build.js
   ```

   Build ostrzega (ale nie przerywa), gdy brakuje klucza anon. Wynik: `build/nauka-all.html` (ok. 707 KB na dysku; build wypisuje ok. 685 KB, bo liczy znaki, nie bajty, `build.js:51`). Przed iOS ten krok jest opcjonalny, bo `npm run sync` sam uruchamia build.
3. Szybki podgląd w przeglądarce (logowanie działa, generowanie nie):

   ```bash
   cd /Users/ignacykrasnodebski/nauka-app
   python3 -m http.server 8765 --directory build
   # otwórz http://localhost:8765/nauka-all.html
   ```

4. Skopiuj do projektu iOS i otwórz Xcode:

   ```bash
   cd /Users/ignacykrasnodebski/nauka-app/native
   npm run sync
   npm run open
   ```

5. W Xcode: schemat **App**, wybierz symulator, Run. Testuj na prawdziwym backendzie (konto testowe z aliasem `+test`).
6. Kiedy działa: archiwum i TestFlight ([9.3](#93-testflight)).

### 9.2 Zmiana w backendzie

Kod: `/Users/ignacykrasnodebski/nauka-backend` (gałąź `backend/files-api-50mb`).

1. Testy i typy:

   ```bash
   cd /Users/ignacykrasnodebski/nauka-backend
   npm test                      # build paczek + node --test w @nauka/shared i @nauka/ai
   npm run typecheck             # sprawdza też stary @nauka/mobile
   npm run web:build             # potrzebne przed smoke (next start wymaga .next)
   npm run smoke -w @nauka/web   # scripts/smoke.mjs: next start w trybie demo
   ```

   Pliki testów: w `packages/ai` (`generate`, `generation-quality`, `materials`, `pptx`, `review`, `viz`, `viz-snapshot`) i w `packages/shared` (`gamification`, `gamification-v2`, `generation-quality`, `prompts`, `prompts-snapshot`, `quiz-quality`, `tasks`, `viz`). Większość nowych jest nieśledzona przez gita.
2. **Wdrożenie na Vercel (z kopii bez gita).** Wdrożenie z CLI z repo jest blokowane (`TEAM_ACCESS_REQUIRED`), bo autorem ostatniego commita jest „Claude”. Obejście: kopia katalogu bez `.git`, z linkiem `.vercel/project.json` do projektu „nauka”. Przykład (sprawdź przed użyciem; katalog docelowy dowolny, poza gitem):

   ```bash
   DEPLOY=/private/tmp/cramfox-backend-deploy
   rm -rf "$DEPLOY" && mkdir -p "$DEPLOY"
   rsync -a \
     --exclude .git --exclude node_modules --exclude '.env*' \
     --exclude .next --exclude dist \
     /Users/ignacykrasnodebski/nauka-backend/ "$DEPLOY"/
   test -f "$DEPLOY/.vercel/project.json" || echo "BRAK linku .vercel, nie wdrażaj"
   cd "$DEPLOY"
   vercel deploy --prod --yes --archive=tgz
   ```

   `rsync` kopiuje też `.vercel/` (link do projektu), więc osobne kopiowanie `project.json` nie jest potrzebne. `--exclude '.env*'` pomija też `.env.example` (bez znaczenia dla wdrożenia).

3. **Pułapki wdrożenia:**
   - w wyjściu musi być „Deploying …/nauka”; brak linku `.vercel` raz utworzył osobny, przypadkowy projekt;
   - **nigdy** `vercel pull` ani `vercel env pull`;
   - stara kopia w scratchpadzie (`scratchpad/backend-deploy/`) jest pusta od 2026-10-12, więc kopię trzeba odtworzyć;
   - nie merguj starej gałęzi do `main`: według DEPLOY.md push do `main` = wdrożenie produkcji, a push innych gałęzi = deployment Preview ([2.3](#23-repozytoria-i-gałęzie));
   - limity czasu tras są w dwóch miejscach: `export const maxDuration` w `route.ts` i `apps/web/vercel.json`;
   - plan Hobby: funkcja maks. 300 s, body żądania maks. 4,5 MB.
4. Sprawdź produkcję po wdrożeniu: jedna generacja z tekstu na koncie testowym, potem logi funkcji na Vercelu (`[generate] coverage`, `[generate] viz`, `[generate] pptx`).

### 9.3 TestFlight

Numer builda podaje się przy archiwizacji (w projekcie zostaje `1`, `project.pbxproj:303,325`). Ostatni archiwalny to 6, **następny wolny: 7**.

Wariant ręczny (README): **najpierw podbij numer builda** (Xcode → target App → General → Build = 7, czyli `CURRENT_PROJECT_VERSION`), potem Product → Archive → Distribute App → App Store Connect. Bez podbicia archiwum dostanie build 1, który App Store Connect odrzuci jako duplikat.

Wariant z terminala (przykład; zespół nie jest zapisany w projekcie, więc trzeba go podać):

```bash
cd /Users/ignacykrasnodebski/nauka-app/native
npm run sync          # sam uruchamia node ../build.js
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$HOME/Library/Developer/Xcode/Archives/$(date +%F)/Cramfox 1.0 (7).xcarchive" \
  CURRENT_PROJECT_VERSION=7 DEVELOPMENT_TEAM=H9QDV2Z2G3 \
  -allowProvisioningUpdates archive
```

Potem: Xcode → Window → Organizer → archiwum → Distribute App. Zapisz, który commit odpowiada któremu buildowi.

**Build 6** (`~/Library/Developer/Xcode/Archives/2026-10-07/Cramfox 1.0 (6).xcarchive`) czeka w Organizerze na wysłanie.

### 9.4 Migracje bazy

- Nowy plik `backend/000N_opis.sql` w `nauka-app`, **idempotentny** (można uruchomić drugi raz bez szkody).
- Wgrywanie przez Supabase CLI (link w `nauka-app/supabase/.temp/`). Zainstalowane jest CLI 2.119.0 z Homebrew, a w katalogu głównym nie ma `node_modules`, więc `npx supabase` mógłby pobrać własną kopię. Bezpieczniej wołać `supabase` wprost. Komenda wymaga wcześniejszego `supabase login` (Management API):

  ```bash
  cd /Users/ignacykrasnodebski/nauka-app
  supabase db query --linked -f backend/0006_pptx.sql
  ```

- Pułapki:
  - migracje są w dwóch worktree (dwóch gałęziach) jednego repo: 0001–0003 w `nauka-backend/supabase/migrations/`, 0004–0006 w `nauka-app/backend/`. `supabase db push` z backendu **nie** da schematu Cramfoxa;
  - **nigdy nie uruchamiaj 0001–0003 ani `supabase db push` z `nauka-backend` na produkcji.** 0001 i 0002 odtwarzają politykę `"profiles self update"` bez sprawdzenia `trial_until` (`0001_init.sql:193–195`, `0002_gamification.sql:36–38`), więc użytkownik mógłby sam ustawić sobie trial do 2099 i zostać na pro. 0001 przywraca też `increment_usage` bez limitów 20/300 i bez `tutor_cap` (`0001_init.sql:233–249`) oraz `handle_new_user` bez triala. Po takim błędzie trzeba od razu wgrać ponownie 0004;
  - `0001_init.sql` został zmieniony na miejscu (limit 50 MB, PPTX). Baza, która już go wykonała, tego nie widzi; właściwą drogą są 0005 i 0006;
  - `reset_dev.sql` kasuje wszystko. **Nigdy na produkcji.**
- Sprawdzenie stanu produkcji (tylko odczyt, np. w edytorze SQL w panelu Supabase):

  ```sql
  select id, file_size_limit, allowed_mime_types from storage.buckets where id = 'materials';
  select to_regclass('public.app_state');
  select jobname, schedule from cron.job;
  ```

### 9.5 Testy klienta

- **Harness jsdom opisany w README („Testy”) nie istnieje** (nigdzie w repo; jsdom był tylko w `node_modules` scratchpadu jednej sesji). Brak `harness.js`, `mockcloud.js`, `mkbuild.js`, brak `package.json` w katalogu głównym. W `test/` są tylko fixtures: `topic-viz.json`, `topic-makro.json`, `topic-krypto.json`, `topic-xss.json`. Opis w README jest historyczny.
- Plan (C22 w planie wykładów): zbudować harness od zera w `test/`, z jsdom jako devDependency w `test/package.json`, poza `build.js`, z atrapą backendu i `CapacitorHttp`.
- Do tego czasu: ręczne testy w symulatorze na prawdziwym backendzie. Lista z README:
  - rejestracja na alias `+test`;
  - generowanie z tekstu i ze zdjęć;
  - wyjście z apki w trakcie generowania (odzyskiwanie);
  - tryb samolotowy;
  - wylogowanie i ponowne logowanie;
  - usunięcie konta.
- Warto dodać: PPTX, schematy w czacie (`test/fixtures/topic-viz.json`), synchronizacja między dwoma urządzeniami, `test/fixtures/topic-xss.json` (brak `on*`, `<script>`, `javascript:` w DOM).

### 9.6 Zabezpieczenie kodu (zrób to jako pierwsze)

Kod produkcji jest tylko na tym laptopie. Proponowana kolejność (przejrzyj `git status` przed każdym `git add`):

```bash
# 1. Apka
cd /Users/ignacykrasnodebski/nauka-app
git status
git add -A          # sprawdź wcześniej: bez .env, bez supabase/.temp, bez .claude
git commit -m "Cramfox 3.0: chmura, iOS, migracje 0004-0006, schematy, PPTX"
git push origin design/nauka-2-0

# 2. Backend (nowa gałąź)
cd /Users/ignacykrasnodebski/nauka-backend
git status
git switch -c backend/cramfox-prod
git add -A
git commit -m "Backend Cramfox: Files API, PPTX, review, schematy"
git push -u origin backend/cramfox-prod
```

Uwagi:
- commituj jako Ignacy (commity autora „Claude” blokują wdrożenie z CLI);
- `supabase/.temp/` i `.claude/` warto dopisać do `.gitignore` przed `git add -A` (inaczej trafi do repo m.in. `supabase/.temp/linked-project.json` z identyfikatorem organizacji);
- pamiętaj, że oba katalogi dzielą jeden `.git`: nie rób `git clean` ani `git checkout` „na ślepo”;
- **push tych gałęzi uruchomi deploymenty Preview na Vercelu** (jeśli integracja z Gitem nadal działa, patrz [2.3](#23-repozytoria-i-gałęzie)). To nie rusza produkcji; preview gałęzi apki najpewniej się nie zbuduje, bo nie ma `apps/web`. Produkcję rusza dopiero push do `main`;
- potem zdecyduj, co z `main` (2 commity za `origin/main`) i z auto-wdrożeniem Vercela.

---

## 10. Stan na dziś (2026-10-14)

**W skrócie:** Apka 3.0 jest zbudowana i zarchiwizowana jako build 6, ale nie wysłana. Backend na produkcji to najnowsza wersja z drzewa roboczego (wdrożona 2026-10-07). Cały nowy kod (apka i backend) jest niezacommitowany, co jest dziś największym ryzykiem.

**Pełny audyt z 2026-10-14** (P0/P1/P2, decyzje dla właściciela, plan Build 7): [`docs/AUDYT.md`](AUDYT.md).

### 10.1 Co jest wdrożone

| Element | Stan |
|---|---|
| TestFlight | buildy 1–4 wysłane (2026-09-28 i 10-02); build 5 (10-02): zarchiwizowany, **nie wysłany** (zastąpiony przez 6); build 6 (2026-10-07): **niewysłany** — do wysłania ręcznie z Organizera |
| Zawartość builda 6 | źródła z 2026-10-06, build z 2026-10-07 07:57; zawiera klienta ze schematami i PPTX (`options.viz:true`, wybór `.pptx`) |
| Build w repo | aktualny: `build/nauka-all.html`, `native/www/index.html` i `native/ios/App/App/public/index.html` są identyczne i zawierają obecne źródła |
| Backend (Vercel) | wdrożony z kopii bez gita 2026-10-07 (`dpl_5QrNpisiG54A42B1dnjsLutQuBET`, alias `nauka-jet.vercel.app`): Files API i pliki do 50 MB, review pytań, viz, PPTX, poprawki z audytu generowania (więcej poziomów dla długich materiałów, kontrola zadań, wyjaśnień i „Wyjaśnij inaczej”). Pierwsza prawdziwa generacja po tej zmianie jeszcze nie była oglądana. |
| Supabase 0004 | używana przez apkę (`app_state`, trial, limity dobowe) |
| Supabase 0005 | wgrana (bucket `materials`: `file_size_limit = 52428800`, sprawdzone 2026-10-07) |
| Supabase 0006 (PPTX) | wgrana 2026-10-07 (typ PPTX jest w `allowed_mime_types`) |

### 10.2 Co jest niezacommitowane (ryzyko)

**Apka** (od `36b7dc3`; 21 plików, +13 780 / −9 638):
- zmienione: `AGENTS.md`, `CLAUDE.md`, `README.md`, `build.js`, `build/nauka-all.html`, `design/DESIGN.md`, `engine.js`, `index.html`, `styles.css`;
- usunięte: `data/{angielski,hiszpanski,krypto,makro,makrokolos,psychologia}.js` i ich `build/*.html`;
- nowe: `cloud.js`, `cloud-ui.js`, `cloud-config.js`, `backend/` (0004–0006), `native/`, `supabase/.temp/`, `test/`, `.claude/launch.json`.

**Backend** (od `512e5c8`):
- zmienione: `.gitignore`, `package-lock.json`, `docs/API.md`, `docs/DEPLOY.md`, `apps/web/src/app/api/generate/route.ts`, `apps/web/src/lib/ai.ts`, `packages/ai/{package.json, client, generate, index, materials, tutor}`, `packages/shared/{finalize, index, plans, prompts, quiz-quality, schema, types}`, `supabase/migrations/0001_init.sql`;
- nowe: `packages/ai/src/{intake, pptx, review}.ts` z testami, `packages/shared/src/{coverage, review}.ts` z testami, katalogi `__snapshots__/`.

Dodatkowo `design/nauka-2-0` ma 1 niewypchnięty commit.

### 10.3 Co czeka

| Zadanie | Uwagi |
|---|---|
| Zabezpieczyć kod (commit i push obu worktree) | [9.6](#96-zabezpieczenie-kodu-zrób-to-jako-pierwsze) |
| Wysłać build 6 do TestFlight | Organizer → Distribute App (najpierw Xcode → Settings → Accounts: zalogować Apple ID ponownie) |
| Obejrzeć pierwszą prawdziwą generację po zmianach | schematy w czacie, liczba poziomów przy długim PDF-ie, jakość pytań i „Dlaczego” |
| „Powiedz prościej” | **zatwierdzone przez właściciela, do zrobienia w buildzie 7:** pokazywać pole `real` (do 25 słów, innymi słowami niż dawka, bez nowych faktów) jako mały tekst do rozwinięcia pod dawką w czacie — nie jako osobny przycisk (stare przyciski „Prościej, proszę” / „Jak to zapamiętać?” zostały usunięte, bo irytowały). Przy okazji rozwiązuje to problem schematów opartych na liczbach tylko z `real` ([3.15](#315-znane-błędy-i-niespójności-w-silniku), pkt 7). |
| Etap 2: nagrywanie wykładów | tylko plan, nic nie zaczęte ([11.1](#111-etap-2-nagrywanie-wykładów)) |
| Naprawić błędy silnika | zwłaszcza `engine.js:3752` i `:3353` ([3.15](#315-znane-błędy-i-niespójności-w-silniku)) |

### 10.4 Dokumenty, które są nieaktualne

| Dokument | Co jest nie tak |
|---|---|
| `README.md` | historia „Nauka 2.0 — krok 2..9” opisuje `data/*.js`, wbudowane przedmioty i katalog (np. linie ok. 115, 129, 132, 169, 199, 205, 257); sekcja „Testy” opisuje nieistniejący harness; README mówi o 16 typach zadań |
| `CLAUDE.md` i `AGENTS.md` | identyczne poza nagłówkiem (trzeba je zmieniać razem; oba wskazują już na tę biblię); brak limitu 20/dobę na konto |
| `cloud-config.js:2` | wspomina nieistniejące `node dev/proxy.js` |
| `design/DESIGN.md` | wiek użytkownika, `.a-drain`, „koła w tle”, liczba ekranów |
| `nauka-backend/docs/DEPLOY.md` | stan na 2026-09-11, branding Recall, Expo, brak migracji 0004–0006 i pg_cron, brak procedury wdrożenia bez gita, opis bucketu „tylko obrazy/PDF/txt” |
| `nauka-backend/docs/API.md` | brak pola `demo` w odpowiedzi 200 (`:13`; sam tryb demo jest opisany w `:49`), brak sentinel 999999 / 1999999, `tutor_cap` → 500 oraz kodów `not_found`, `generation_failed`, `no_config` (`too_many_files` jest, `:19`); TTL Files API 3600 zamiast 7200 |

---

## 11. Plan i znane ograniczenia

**W skrócie:** Następny duży krok to nagrywanie wykładów w apce i robienie z nich notatki oraz lekcji (Etap 2, tylko plan). Przed publicznym wydaniem trzeba domknąć kilka rzeczy formalnych: politykę prywatności pod adresem URL, reset hasła, konto demo dla recenzji, etykiety prywatności. Poniżej jest też lista znanych ograniczeń.

### 11.1 Etap 2: nagrywanie wykładów

Pełny plan: [`docs/plan-wyklady.md`](plan-wyklady.md). **To plan, nie kod.** Nie ma żadnego kodu wykładów: `CfRecorder` ma 0 wystąpień, a jedyne trafienie „lecture” to słowo „lectures” w komentarzu (`packages/shared/src/prompts.ts:79`).

Najważniejsze decyzje:

| Temat | Decyzja |
|---|---|
| Rozpoznawanie mowy | ElevenLabs Scribe v2 za interfejsem `SttProvider`; zapasowo Soniox |
| Tryb | A: webhook + odpytywanie po `transcription_id`; B: synchroniczny `convert` w `after()` (280 s). Wybiera test („spike”) |
| Nagrywanie | natywny plugin `CfRecorder`: segmenty 300 s, AAC-LC mono 16 kHz / 32 kbps, maks. 120 min |
| Kontrola długości | serwer sam sprawdza rozmiar (≤40 MB) i nagłówek MP4 (≤7260 s); liczbom z telefonu nie ufamy |
| Generowanie | dwie fazy (`note`, potem `topic`), każda w osobnym wywołaniu; transkrypt do lekcji przycięty do ok. 24k tokenów |
| Limity | 120 min na nagranie; 240 min/dzień, 900 min/mies., 6000 min/dzień globalnie; 1 generacja na wykład + 1 darmowe ponowienie po `lost` |
| Koszt | $0,264/h z keyterms, **90 min ≈ $0,40** + jedna generacja; limit globalny ≈ $26/dzień (cena bazowa $0,22/h pochodzi z omówienia, nie z cennika: do potwierdzenia) |
| Retencja | transkrypt w ElevenLabs kasowany od razu; nasze audio kasowane po transkrypcji; transkrypt zostaje na koncie |
| Baza | migracja `0007_lectures.sql`: tabela `lectures`, `usage.lecture_seconds`, RPC `start_lecture` i `refund_lecture`, pg_cron co 5 min |

Co musi zrobić właściciel (skrót):
1. **Etap 1:** wdrożyć backend, **potem** wgrać `0006_pptx.sql` (odwrotna kolejność może zjeść limit przy PPTX, patrz „Najważniejsze na dziś”, pkt 3).
2. **ElevenLabs:** konto z rozliczeniem za użycie i miesięcznym limitem wydatków, klucz tylko do STT, webhook `https://nauka-jet.vercel.app/api/lecture/webhook`, podpisana umowa DPA.
3. Uruchomić spike (poniżej $1, 2–3 prawdziwe wykłady). Skryptu `scripts/stt-spike.mjs` **jeszcze nie ma** w żadnym katalogu: trzeba go najpierw napisać.
4. Ustawić zmienne na Vercelu (lista w planie).
5. Wgrać `0007` i dodać `CRON_SECRET` do Supabase Vault.
6. Xcode: Background Modes → Audio, nowe pliki Swift, usunąć `UISceneStoryboardFile` i `UIMainStoryboardFile`, dodać opis mikrofonu.
7. App Store Connect: „Audio Data”, notatka dla recenzji, ujawnienie AI firm trzecich.
8. Polityka prywatności: ElevenLabs jako procesor, transfer do USA, usuwanie, zgoda prowadzącego.

Kolejność: 1a schematy → 1b PPTX → 2a spike → 2b backend → 2c nagrywarka iOS → 2d flow w apce → 2e (opcjonalnie) Soniox i natywna wysyłka w tle. Etapy 1a i 1b są zrobione w drzewach roboczych, ale nie są potwierdzone na produkcji.

### 11.2 Lista przed publicznym wydaniem

1. **SMTP:** własny serwer poczty w Supabase (np. Resend). Domyślny mailer ma ostre limity, a jest potrzebny do resetu hasła.
2. **Reset hasła:** ekran i przepływ w apce, adres przekierowania, deep link.
3. **Polityka prywatności i regulamin pod publicznym URL:** Supabase EU, Vercel, Anthropic (później ElevenLabs i USA); URL w App Store Connect.
4. **Etykiety prywatności App Store:** e-mail, treści użytkownika, postępy (później audio); powiązane z użytkownikiem; cel „funkcjonalność”; bez śledzenia.
5. **Konto demo dla App Review:** login i hasło w notatkach, z gotowym przedmiotem (żeby recenzent nie czekał 2 min i nie zużywał limitu).
6. **Zakupy w aplikacji (3.1.1):** w UI zero płatności i słowa „Pro” (przeredagować komunikat o subskrypcji w `cloud-ui.js:184`); Stripe zostaje na webie; IAP osobno (np. RevenueCat → `profiles.plan`).
7. **AI firm trzecich (5.1.2(i)):** zgoda v1 jest; dla nagrań v2.
8. **Usuwanie konta (5.1.1(v)):** jest.
9. **Info.plist:** usunąć podwójny most; dla nagrań mikrofon i audio w tle.
10. **Bezpieczniki kosztów:** 20/dobę na konto i 300/dobę globalnie (Anthropic); dla STT limity w env i limit wydatków w ElevenLabs.
11. **Zacommitować i otagować** kod produkcji (apka i backend) i zapisać, który commit to który build.
12. **Opcjonalnie:** płatny plan Supabase (limit pliku, ok. 1 GB na free, usypianie projektu), Vercel Pro (800 s), własna domena zamiast `nauka-jet.vercel.app`.

### 11.3 Znane ograniczenia

- Generowanie nie działa w przeglądarce (brak CORS i proxy).
- Brak resetu hasła i potwierdzania maila.
- Wylogowanie kasuje lokalne postępy; wygaśnięcie sesji je zostawia.
- Brak offline i wolnego serwera nie da się odróżnić (oba to „Brak połączenia”).
- `fetchAll` bez stronicowania; przy usuwaniu konta znajdzie się maks. ok. 10 000 plików.
- Teoretyczna pętla push/pull, dziś zablokowana przez politykę `FOR ALL` ([4.6](#46-synchronizacja-postępów)); synchronizacja cicho staje, gdy postępy przekroczą 2 MB.
- Etap `podstawowka` jest wysyłany do AI jako `inne`. To decyzja, nie błąd: apka jest dla 16+ (`cloud-ui.js:214`, `engine.js:90`).
- Gry językowe (Wpisywanie, Klocki) nigdy się nie pokazują, bo `lang` nie przychodzi z serwera ([3.7](#37-zadania)).
- HEIC działa tylko tam, gdzie WebKit go dekoduje (iOS 17+); na iOS 16 kończy się komunikatem „Zdjęcie w formacie HEIC”.
- Egzamin w przedmiotach `liceum`/`podstawowa` zalicza się od 30% ([6.2](#62-topiccontent-schemats278289)).
- Nieudany poziom znika bez informacji dla użytkownika.
- Generacja może przekroczyć 300 s i zostać zabita (limit pobrany, wiersz `running` na zawsze, klient nie odzyskuje).
- `maxSubjects` nieegzekwowane.
- Stara apka Recall pokaże „999999/150” przy limicie dobowym; tutor na trialu zwróci 500.
- Usunięcie konta jest zablokowane przy aktywnej subskrypcji Stripe (konta z weba).
- Tylko ciemny motyw, tylko iPhone, tylko pion.

---

## 12. Zasady i konwencje

**W skrócie:** Apka mówi po polsku, rzeczowo i ciepło, bez slangu i bez emoji. Nigdzie nie wspominamy o płatnościach ani planie Pro. Dane z bazy zawsze przechodzą przez sanitizer, a klucze i indeksy postępów są nietykalne.

### 12.1 Język i ton

- UI po polsku, rzeczowy i ciepły, bez młodzieżowego slangu. Ma pasować i 16-latkowi, i studentowi.
- **Zero emoji w UI.** Emoji z AI są usuwane (`noEmoji`).
- Przyciski główne wersalikami („TWÓRZ LEKCJĘ”, „ZACZNIJ NAUKĘ”), toasty krótkie („+4 XP”, „Nie tym razem”).
- **Żadnych wzmianek o płatnościach, cenach, subskrypcji, „Pro”, „premium”, „zakupie”** (App Store 3.1.1). Trial to „na start większy limit”. Dziś jest jeden wyjątek do poprawy: komunikat o subskrypcji przy usuwaniu konta (`cloud-ui.js:184`, [4.2](#42-wylogowanie-i-usunięcie-konta)). Przy testach automatycznych użyj wyrażenia `/\bPro\b|płat|subskryp|premium|zakup/i` (proste `/Pro/` łapie „Prezentacja” i „prowadzącego”).

### 12.2 Dane

- Nowe pola danych zawsze opcjonalne; stare zapisy muszą działać.
- W quizie `c` liczone od 0; zawsze pole `e` (wyjaśnienie, dlaczego).
- Nie usuwaj elementów z `quiz`, `feed`, `tasks`, `flashcards`; nieobsługiwane zadania dostają `type:'_skip'`.
- Id poziomu bez `:`.
- Nie zmieniaj nazw kluczy localStorage bez migracji.

### 12.3 Kod

- Vanilla JS, bez frameworków i bundlera. Jeden plik HTML dla Capacitora.
- Edytuj źródła, nie `build/`.
- Kolejność skryptów: config → cloud → engine → cloud-ui.
- Treść z bazy do DOM tylko przez `clean()` albo `esc()`.
- Migracje: nowy plik `backend/000N_*.sql`, idempotentny.
- `CLAUDE.md` i `AGENTS.md` zmieniaj razem.

### 12.4 Czego NIE robić

- Nie dodawać frameworków ani bundlera.
- Nie zmieniać kluczy localStorage bez migracji.
- Nie wstawiać treści z bazy do DOM bez `clean()` / `esc()`.
- **Nie ponawiać automatycznie `POST /api/generate`** (każde wywołanie zjada limit).
- Nie wspominać w UI o płatnościach ani planie Pro.
- Nie uruchamiać `vercel pull` ani `vercel env pull`.
- Nie uruchamiać `reset_dev.sql` na produkcji.
- Nie uruchamiać migracji 0001–0003 ani `supabase db push` z `nauka-backend` na produkcji (cofają zabezpieczenia z 0004, [9.4](#94-migracje-bazy)).
- Nie robić `git clean`, `git checkout` ani `git reset --hard` w żadnym worktree, dopóki kod nie jest zacommitowany.
- Nie mergować starej gałęzi backendu do `main` bez decyzji o auto-wdrożeniu (push do `main` = wdrożenie produkcji według DEPLOY.md).
- Nie wgrywać `0006_pptx.sql` przed wdrożeniem nowego backendu.
- Nie wpisywać sekretów do repo ani do dokumentacji.
- Nie podawać modelu Haiku jako `RECALL_AI_FIX_MODEL`.

---

## 13. Słowniczek

| Pojęcie | Znaczenie |
|---|---|
| **Przedmiot** | Najwyższy poziom organizacji (np. „Biologia”). Wiersz w `subjects`. |
| **Temat** | Wynik jednej generacji z materiału. Wiersz w `topics` z `content` (`TopicContent`). Przedmiot ma wiele tematów. |
| **Poziom** | Jedna lekcja na ścieżce. Temat ma kilka poziomów (`l1`…); w apce mają id `t<8 znaków>_<id>`. |
| **Rozdział (`chapter`)** | Pierwszy poziom każdego kolejnego tematu; odblokowany od razu. |
| **Ścieżka** | Wężyk poziomów przedmiotu z skrzyniami i bossem. |
| **Dawka** | Jedna porcja wiedzy w czacie z lisem (`feed[]`): tytuł, treść, opcjonalnie `real`, `mnemo`, `viz`. |
| **Roladka** | Starsza nazwa `feed` (przewijany ciąg dawek). |
| **`real`** | Jedno zdanie „sedno dawki prościej, innymi słowami”. Generowane, ale niewyświetlane. |
| **`mnemo`** | Opcjonalna podpowiedź do zapamiętania. Generowana rzadko, niewyświetlana. |
| **Schemat (viz)** | Mały obrazek wiedzy pod dawką (oś czasu, porównanie, cykl, przepływ, drzewo, słupki, liczby). AI daje dane, apka rysuje. |
| **Ugruntowanie (grounding)** | Kontrola, czy etykiety i liczby schematu naprawdę są w tekście lekcji. |
| **Fiszka** | Karta `{t, d}`: hasło i definicja. |
| **SRS** | Powtórki w odstępach (spaced repetition). Pudełka 0–4, interwały 0 / 1 / 3 / 7 / 21 dni. |
| **Pudełko (`box`)**, **termin (`due`)**, **`lapses`** | Poziom utrwalenia, data następnej powtórki, liczba pomyłek. |
| **Talia błędów (`examDeck`)** | Pytania źle rozwiązane na egzaminie, do poprawki. |
| **Poprawka (`override`)** | Pytanie poprawione przez użytkownika, nakładane na oryginał. |
| **Combo** | Trafienia z rzędu; mnożnik XP ×2 od 5, ×3 od 10. |
| **Boost** | „Podwójne XP” na 15 min ze sklepu. |
| **Zamrożenie** | Chroni serię przed jednym opuszczonym dniem (maks. 2). |
| **Kamień milowy** | Próg serii (3, 7, 14, 30, 50, 100, 365 dni) z nagrodą. |
| **Duch** | Zapis najlepszego przejścia poziomu, z którym się ścigasz. |
| **Boss / Szop Zapominalski** | Ostatni węzeł ścieżki: pytania na czas, HP szopa. |
| **Cram** | Tryb „noc przed egzaminem”, 4 bloki po 5 minut. |
| **Gotowość** | 60% poziomów zaliczonych + 40% najlepszego egzaminu, w planie do sprawdzianu. |
| **`_skip`** | Zadanie, którego apka nie obsługuje; zostaje w tablicy, żeby nie przesunąć indeksów. |
| **`epoch`** | Znacznik resetu postępów; przy scalaniu wyższy wygrywa cały `progress`. |
| **Outline (plan)** | Pierwsza faza generowania: podział materiału na poziomy. |
| **Scope (zakres)** | Lista 3–10 punktów, których ma uczyć dany poziom. Dzięki temu równoległe poziomy się nie dublują. |
| **Review pass (review)** | Druga lektura poziomu przez tańszy model (`claude-sonnet-5`): poprawia albo usuwa słabe pytania. Nigdy nie psuje generacji. |
| **Finalizacja** | Ostatnie czyszczenie tematu w kodzie: id, tasowanie odpowiedzi, odrzucanie wadliwych elementów. |
| **Intake** | Etap przyjęcia materiałów przed pobraniem limitu: typy, wstępne sprawdzenie limitu (tylko z plikami), pobranie, PPTX, budżet tekstu. |
| **Pre-check** | Wstępne sprawdzenie limitu tylko do odczytu (bez pobierania). |
| **Reserve (pobranie limitu)** | Wywołanie `increment_usage`; od tej chwili próba się liczy. |
| **Sentinel** | Umowna wartość: `used` = 999999 (limit dobowy konta) albo 1999999 (limit serwera). |
| **Trial** | 30 dni planu pro dla nowego konta Cramfoxa; kończy go cron `cramfox-end-trials`. |
| **Tryb demo** | Generowanie bez klucza Anthropic; przykładowy temat z `tagline` „DEMO — …” i banerem trybu demo na ekranie „Gotowe”. Limit i tak schodzi. |
| **Dziennik (`cf_job`)** | Zapis trwającej generacji w telefonie, do odzyskania po utracie połączenia. |
| **Odzyskiwanie (recovery)** | Dociąganie wyniku generacji po przerwie (`recoverJob`). |
| **`app_state`** | Tabela z postępami jako jednym JSON-em na konto. |
| **`rev`**, **CAS** | Numer wersji `app_state` nadawany przez serwer; zapis „porównaj i zamień” tylko przy zgodnym `rev`. |
| **Baza (`cf_base`)**, **merge3** | Ostatni wspólny stan i scalanie trójstronne (baza, telefon, chmura). |
| **Dirty**, **pending** | Są zmiany do wysłania; stan z chmury czeka, aż będzie bezpiecznie go zastosować. |
| **RLS** | Row Level Security w Postgresie: każdy widzi tylko swoje wiersze. |
| **IDOR** | Błąd, w którym ktoś dostaje cudzy zasób, podając jego id. |
| **Klucz anon** | Publiczny klucz Supabase; bezpieczny dzięki RLS. |
| **Service role** | Tajny klucz Supabase z pełnym dostępem; tylko na Vercelu. |
| **CSP** | Content Security Policy: lista, skąd strona może ładować skrypty i z czym się łączyć. |
| **`clean()` / `esc()` / `deepEsc()`** | Sanitizer HTML / escapowanie tekstu / escapowanie rekurencyjne. |
| **Files API** | Usługa Anthropic do wysyłania dużych plików (PDF, dużo zdjęć) przed wywołaniem modelu. |
| **TUS** | Protokół wysyłki dużych plików w kawałkach z wznawianiem (pliki >6 MB). |
| **Capacitor** | Opakowanie strony HTML w natywną apkę iOS. |
| **CapacitorHttp** | Natywne zapytania HTTP z Capacitora; omijają CORS. |
| **Worktree** | Drugi katalog roboczy tego samego repo git (tu: `nauka-app` i `nauka-backend`). |
| **Wdrożenie bez gita** | Kopia backendu bez `.git`, z której `vercel deploy` działa mimo blokady autora commita. |
| **Numer builda** | `CURRENT_PROJECT_VERSION`; musi rosnąć przy każdym wysłaniu do TestFlight. |
| **Spike** | Krótki, tani eksperyment przed decyzją (tu: test ElevenLabs przed Etapem 2). |
| **Zgoda v1 / v2** | Zgoda na przetwarzanie przez AI: v1 dla materiałów (Claude), v2 dla nagrań (ElevenLabs, USA). |
| **Recall**, **NAUKA** | Starsze nazwy: backend i apka webowa (Recall), pierwsza wersja apki (NAUKA). |
