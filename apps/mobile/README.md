# @nauka/mobile — Recall na iOS / Android (design 2.0)

Expo SDK 57 + expo-router, TypeScript strict, czysty `StyleSheet` (bez UI-kitów). Ten sam kontrakt danych (`@nauka/shared`) i to samo API (`apps/web`) co wersja webowa. Model produktu: **przedmiot** (kontener użytkownika) → **tematy** generowane przez AI (ze zdjęć / PDF / tekstu albo z samego hasła) → poziomy: roladka → pytania i zadania → boss rozdziału; do tego fiszki (SRS), powtórka, egzamin próbny, plan do sprawdzianu, tryb nocny, misje, plecak, album pojęć. Logowanie wymagane — brak trybu gościa (patrz `docs/PRODUCT.md`).

Wygląd i mechanika: `design/DESIGN.md`, `design/tokens.css`, `design/preview/*.html` (prawda wizualna, 390×844) oraz `docs/PORT-2.0.md`. Silnik referencyjny: `legacy/engine.js` — zachowania przeniesione 1:1, tam gdzie brakowało ich w `@nauka/shared` (plan dnia, plan do sprawdzianu, cram) leżą w `src/lib/{plan,tests}.ts` jako kopie logiki weba.

## Szybki start (Expo Go)

```bash
# z ROOTA monorepo — workspaces muszą się zlinkować
npm install
npm run build:shared            # packages/shared/dist (raz, albo po zmianach w shared)

cd apps/mobile
cp .env.example .env            # uzupełnij Supabase + URL API (bez tego nie da się zalogować)
npm run start                   # QR → Expo Go (iOS/Android) albo `i` / `a` na symulator
```

Skrypty: `start`, `ios`, `android`, `web`, `typecheck` (`tsc --noEmit`), `lint` (`expo lint`), `icons` (regeneruje PNG w `assets/`), `export:web`.

> W tym monorepo `npx expo …` czasem nie znajduje `@expo/cli`. Skrypty npm działają zawsze; alternatywnie `node ../../node_modules/expo/bin/cli start` / `… export --platform web`.

## Env

| zmienna | co to |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL projektu Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon key (RLS chroni dane; **nigdy** service role) |
| `EXPO_PUBLIC_API_URL` | adres weba (`apps/web`) — tam żyje `/api/generate`, `/api/tutor`, `/api/me`, `/api/stripe/*` |
| `EAS_PROJECT_ID` | opcjonalnie, po `eas init` |

W Supabase Auth → URL Configuration dodaj redirecty: `recall://auth/callback` (build), `exp://…/--/auth/callback` (Expo Go; adres wypisze `REDIRECT_URI` w `src/lib/auth.tsx`). Baza: `supabase/migrations/0001_init.sql` + `0002_gamification.sql` + `0003_recall2.sql` (kolumny 2.0: `profiles.goal`, `user_meta.themes/boost_until/album/overrides/tests/weekly_quest/history/daily/reduce_motion/reminder/exams`, `progress.boss/ghost`). Bez migracji 0003 apka działa dalej — `fetchUserData` wraca do selectów v1 i pola 2.0 żyją tylko w sesji.

## Ekrany (`app/`)

Nawigacja: dolny pasek **Dziś · Powtórka · [+] · Fiszki · Profil** (plus = arkusz „Dodaj materiał”). Bramka w `app/_layout.tsx`: brak sesji → login; bez etapu → `onboarding` (LevelPick) → `goal`; z etapem bez przedmiotów → `empty`; ≥ 3 dni przerwy → `comeback` (raz dziennie); poniedziałek → `weekly?mode=last` (raz). `?preview=1` wyłącza przekierowania (zrzuty).

| trasa | podgląd | co robi |
| --- | --- | --- |
| `(auth)/login` | — | hasło / link na maila / rejestracja / Google, marka Recall |
| `onboarding`, `goal` | LevelPick, Onboarding | etap (`STAGES`) + cel (`profiles.goal`), cel dzienny XP (`DAILY_GOALS`) + przypomnienie; `?from=settings` wraca do ustawień |
| `empty`, `catalog` | EmptyState, Catalog | pierwszy start; katalog `CURRICULUM` wg etapu, multi-wybór → `createSubjects` |
| `(tabs)/index` | Main | plan na dziś (`src/lib/plan.ts` + wiersze planu do sprawdzianu), pasek celu, kafle Misje / Seria / Album, siatka przedmiotów |
| `(tabs)/review` | Review | zaległe SRS per przedmiot, stan pamięci (`srsBox`), start powtórki |
| `(tabs)/cards` | — | hub fiszek: przedmioty z liczbą fiszek i zaległych |
| `(tabs)/profile` | Profile | ranga (`rankFor`), statystyki, heatmapa, odznaki, liga / znajomi |
| `quick-add` | QuickAdd | arkusz: zdjęcie / plik / tekst / hasło / katalog / „Mam sprawdzian” |
| `add?mode=photo\|file\|text\|prompt&subjectId=` | AddSubject, Scanner, Detected, Generating, SubjectReady, ErrorState | pętla aparatu (wiele stron), pliki, tekst, hasło → upload do Storage → `POST /api/generate` → nazwa i kolor przedmiotu, wyłączanie poziomów (`overrides["hide:…"]`) |
| `s/[subjectId]` | SubjectReady/Path (pas) | przedmiot: pas w kolorze, chip „Sprawdzian za N dni”, tematy jako rozdziały, skróty Fiszki / Egzamin / Powtórka, usuń |
| `s/[subjectId]/info` | SubjectInfo | bloki `info` tematu jako kafle, siatka ocen z `grading.scale` (podświetlony ostatni wynik), egzamin, plan, udostępnianie |
| `s/[subjectId]/cards?topicId&levelId&heal=1` | Flashcards, FlashcardsDone | talia (tap = obrót, swipe = odpowiedź) → SRS (`reviewCard` + album), +2 XP; `heal=1`: 5 fiszek = +1 życie |
| `s/[subjectId]/exam` | ExamStart | zakres poziomów (wszystkie tematy), liczba pytań, limit (`grading.examMin`), siatka, ostatnie podejście (`user_meta.exams`) |
| `exam-run?subjectId&levels&n&lim` | ExamRun, Exam | egzamin: timer, siatka pytań (skok), flagi, „Zakończ” z podsumowaniem; wynik: ocena (`gradeFor`), „Gdzie tracisz punkty”, talia błędów (`weak`), przegląd z poprawką i źródłem |
| `t/[topicId]?tab=path\|quiz\|tasks` | Path, Quiz | ścieżka (węzły 74/88 px, skrzynie `chestIndexes`, boss `bossNodeState`), zakładki Fiszki / Quiz / Ćwiczenia (`TASK_META`) / Egzamin / Klasa |
| `t/[topicId]/l/[levelId]` | Lesson, Quiz, QuizCorrect/Wrong, Ghost, NoHearts, LevelComplete | roladka (swipe w górę) → `levelSession` (pytania + 15 typów zadań), serca, combo (`comboXp`), duch (`ghost.ts`), panele dobrze/źle z „Wyjaśnij inaczej” (tutor AI / offline) i „Zgłoś/popraw”; wynik: `applyQuizResult`, gemy `levelGems`, plan dnia, plan do sprawdzianu, misje |
| `t/[topicId]/boss` | Boss | walka: `startBoss/bossNext/bossAnswer/finishBoss`, 20 s na pytanie, pasek życia, wynik |
| `review-run?subjectId&deck=1&limit` | Flashcards, FlashcardsDone | sesja powtórki (fiszki + pytania z talii błędów), bez serc; plan dnia „review”/„weak” |
| `cram?subjectId` | Cram | noc przed egzaminem: 4 bloki po 5 min (najsłabsze, fiszki z zakresu, 10 pytań, błędy), „Idź spać” |
| `test-new`, `test-plan?subjectId` | TestPlan | „Mam sprawdzian” (przedmiot, data, zakres) → `createTestPlan` (`src/lib/tests.ts` = algorytm weba) → plan dzień po dniu, gotowość, usuń |
| `missions`, `shop`, `streak`, `comeback`, `album`, `weekly` | Missions, Shop, Streak, ComeBack, Album, WeeklyStory | misje (`questsForToday`, `weeklyQuestFor`, `claimQuest`), plecak (`SHOP_ITEMS`, boost, motywy), seria, powrót, album (`albumTiles`), tydzień (`activity` + `history`) |
| `edit-question?topicId&levelId&qi` | EditContent | poprawka pytania → `user_meta.overrides` (nakładana przez `qOf` w lekcji, quizie, egzaminie, bossie, powtórce, cramie) |
| `league`, `friends`, `share` | League, Friends, ShareClass | liga = prawdziwy ranking (`weekly_leaderboard`); znajomi i klasa = kod gotowy, reszta „wkrótce” |
| `settings` | Settings | profil, etap i cel, motyw, ranking, dźwięk, ogranicz animacje (`reduce_motion`), przypomnienie, przedmioty, plan Pro (Stripe), eksport / import JSON (`expo-sharing`, `expo-document-picker`), wyloguj |

## Skin 2.0

Tokeny wyłącznie z `@nauka/shared` (`TOKENS` = `design/tokens.css`). Nic nie jest hardkodowane poza kolorami z podglądów (tinty tekstu).

- `src/lib/theme.ts` — `T` (aliasy tokenów), `TONES` (acid / pink / amber / cyan / gold / red / violet: kolor, ciemna krawędź, tusz, tint, linia tintu), `accentOf(accent2, seed)` (motyw przedmiotu), fonty `FONT.*` (Bricolage Grotesque 700/800, Plus Jakarta Sans 500–800), `UI` (gutter 18, przycisk 58, węzeł 74/88).
- `src/lib/motion.ts` — `useReduceMotion()` = ustawienie systemu **lub** przełącznik w ustawieniach.
- `src/components/Motion.tsx` — odpowiedniki klas `.a-*` na Reanimated: float, bob, pulse, beat, spin, rise, pop, fall, blink, sway, glow, up, shake (+ `Bar` = `.a-grow`, `Confetti` = `.a-fall`).
- `src/components/Icon.tsx` — port `ICONS` z legacy do `react-native-svg` (te same nazwy, bez emoji w chrome), `StarRow`.
- `src/components/ui.tsx` — `Press` (twarda krawędź `DROP.*`, wciśnięcie o N px), `Btn`, `RoundBtn`, `TopBar`, `Card` / `AccentCard` / `ListCard` / `Row`, `Chip`, `Tag`, `Mono` (monogram zamiast emoji), `IconTile`, `Toggle`, `Pill`, `Ring`, `SegBar`, `Dots`, `Sheet` (panel od dołu `.a-rise`), `Toast`, `Note`, `Empty`.
- `src/components/QuizBlock.tsx`, `Sheets.tsx` (SheetOk / SheetBad / ExplainSheet / SourceSheet / NoHeartsSheet), `Flip.tsx` (fiszka 3D + swipe), `PathView.tsx`, `BossSvg.tsx`, `ChartSvg.tsx`, `HtmlText.tsx`, `TopicTabs.tsx` (Quiz / Ćwiczenia), `tasks/*` (16 rendererów zadań; drag przez gesture-handler z tap-to-place jako alternatywą).

## Kod

```
src/lib/
  supabase.ts, auth.tsx      klient + sesja (PKCE, magic link, Google)
  app-state.tsx              AppProvider: store, przedmioty/tematy, XP (jedyny lejek: addXp + applyBoost), serca, gemy, misje,
                             odznaki, plan dnia, plany do sprawdzianu, album, poprawki, boss/duch, egzaminy, toast
  data.ts                    mapowanie wierszy, fetchUserData (fallback do selectów v1 bez migracji 0003), cache offline
  store/progress-store.ts    Supabase: progress (+ boss/ghost), srs_cards, user_meta (+ pola 2.0, zapisy scalane 300 ms), activity
  extra.ts                   kształty 2.0 (Extra) = apps/web/src/lib/store/extra.ts
  plan.ts, tests.ts          plan dnia i plan do sprawdzianu (kopie algorytmów weba)
  topic-view.ts              poziomy bez wyłączonych, pula pytań/fiszek z poprawkami (qOf)
  srs-view.ts                wpisy SRS (zaległe / wszystkie)
  api.ts, upload.ts          /api/*, upload do Storage
  format.ts                  daty, liczba mnoga, noEmoji, nowMs (czas poza renderem)
```

## Postępy i offline

- Źródło prawdy: Supabase. Cała mechanika (XP, gwiazdki, odblokowania, seria, SRS, combo, serca, gemy, misje, boss, duch, album) pochodzi z `@nauka/shared`.
- AsyncStorage = cache do odczytu (`recall_cache_v3:<uid>`, ze snapshotem `extra`) + flagi UI (ComeBack / tydzień). Bez sieci apka startuje z cache, zapisy kolejkują się w pamięci sesji.
- `setExtra` scala zapisy `user_meta.*` (300 ms); `flush()` przy zamknięciu / w tle zapisuje od razu.

## Podgląd / zrzuty

`scratchpad/shots5-mobile.mjs` (Playwright, 390×844 @2x) loguje się kontem testowym na eksport webowy (`expo export --platform web` + `static5.mjs`) i robi zrzuty wszystkich ekranów do `shots5/mobile-*.png`, obok podglądów z `design/preview`.

## Build / EAS

```bash
npm i -g eas-cli && eas login
eas init                                   # zapisze projectId → EAS_PROJECT_ID w .env
eas build --profile development --platform ios
eas build --profile preview --platform android
eas build --profile production --platform all
```

Profile w `eas.json`: `development`, `preview` (APK), `production`. Zmienne `EXPO_PUBLIC_*` ustaw w EAS. Bundle id `app.recall.study`, scheme `recall`. Ikony: `npm run icons`.

## Sklepy — WAŻNE (TODO IAP)

`settings` → „Przejdź na Pro” otwiera **Stripe Checkout** (`POST /api/stripe/checkout`, `platform: "mobile"`) w `expo-web-browser`. OK dla TestFlight / bety, ale App Store i Google Play wymagają IAP (RevenueCat + webhook ustawiający `profiles.plan`) przed publikacją.

## Uwagi techniczne

- **Monorepo / Metro**: `metro.config.js` bierze lokalną kopię pakietów obecnych w `apps/mobile/node_modules` (jeden React w bundlu). `expo-doctor` zgłasza duplikat `react` — skutek pinów weba.
- **Upload w RN**: plik czytany przez `expo-file-system` `File.base64()` → `ArrayBuffer` → `supabase.storage.upload`.
- **Typed routes**: `.expo/types/router.d.ts` generuje `expo start`; ręcznie: `EXPO_ROUTER_APP_ROOT=$PWD/app node -e "require('@expo/router-server/build/typed-routes').regenerateDeclarations(require('path').resolve('.expo/types'), {})"`.
- **Lint**: reguły React Compiler (`react-hooks/refs`, `purity`, `set-state-in-effect`) — czas bierzemy przez `nowMs()`/`todayIso()` z `format.ts`, losowe talie budujemy w inicjalizatorach `useState`, gesty z refami mają punktowe `eslint-disable` (callbacki gestu nie działają w renderze).
- **Data sprawdzianu**: stepper dni + szybkie chipy (bez natywnego date pickera).
