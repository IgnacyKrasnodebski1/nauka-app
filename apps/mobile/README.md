# @nauka/mobile — NAUKA na iOS / Android

Expo SDK 57 + expo-router, TypeScript strict, czysty `StyleSheet` (bez UI-kitów). Ten sam kontrakt danych (`@nauka/shared`), te same seedy (`@nauka/content`) i to samo API (`apps/web`) co wersja webowa.

## Szybki start (Expo Go)

```bash
# z ROOTA monorepo — workspaces muszą się zlinkować
npm install
npm run build:shared            # packages/shared/dist (raz, albo po zmianach w shared)

cd apps/mobile
cp .env.example .env            # uzupełnij (patrz niżej) — bez env apka działa jako gość na seedach
npm run start                   # QR → Expo Go (iOS/Android) albo `i` / `a` na symulator
```

Skrypty: `start`, `ios`, `android`, `web`, `typecheck` (`tsc --noEmit`), `lint` (`expo lint`), `icons` (regeneruje PNG w `assets/`), `export:web`.

> Uwaga: w tym monorepo `npx expo …` czasem nie znajduje `@expo/cli` (npx bierze inny bin). Skrypty npm (`npm run start`) działają zawsze; alternatywnie `node ../../node_modules/expo/bin/cli start`.

## Env

| zmienna | co to |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL projektu Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon key (RLS chroni dane; **nigdy** service role) |
| `EXPO_PUBLIC_API_URL` | adres weba (`apps/web`), np. `https://nauka.pl` — tam żyje `/api/generate`, `/api/tutor`, `/api/me`, `/api/stripe/*` |
| `EAS_PROJECT_ID` | opcjonalnie, po `eas init` |

Bez Supabase: tylko tryb gościa (7 seedów, postępy w AsyncStorage). Bez API: brak generowania, tutora i planów — reszta działa.

W Supabase Auth → URL Configuration dodaj redirecty: `nauka://auth/callback` (build), `exp://…/--/auth/callback` (Expo Go; adres wypisze `REDIRECT_URI` w `src/lib/auth.tsx`). Google OAuth: włącz providera w Supabase, client id/secret z Google Cloud.

## Co gdzie

```
app/                       trasy expo-router (typed routes)
  _layout.tsx              providery (Auth → App), Stack, toast, splash
  (auth)/login.tsx         magic link / hasło / rejestracja / Google, „pomiń = gość”
  (tabs)/index.tsx         Home: 🔥 streak, ⚡ XP, CTA „📸 Dodaj materiały”, własne + biblioteka, onboarding (STAGES)
  (tabs)/library.tsx       publiczne seedy (Supabase `subjects.is_public` → fallback SEED), „+ dodaj”
  (tabs)/profile.tsx       etap, plan + usage (GET /api/me), Pro → Stripe Checkout w przeglądarce, wyloguj
  new.tsx                  capture: aparat / galeria (multi) / PDF+txt / wklejony tekst, etap, hint, poziomy 2–8, język → upload → POST /api/generate
  s/[id]/index.tsx         przedmiot: Ścieżka · Fiszki · Quiz · Egzamin · Info
  s/[id]/l/[levelId].tsx   lekcja: feed → fiszki → mini-gry → quiz → wynik (+ 🤖 tutor)
  auth/callback.tsx        landing deep linku
src/lib/
  supabase.ts              klient (AsyncStorage, PKCE) — `null` bez env
  auth.tsx                 AuthProvider: sesja, magic link, hasło, Google (expo-web-browser), obsługa `code`/tokenów z URL
  app-state.tsx            AppProvider: ProgressStore per user, przedmioty (+cache offline), biblioteka, XP/streak, toast
  store/progress-store.ts  ProgressStore: LocalProgressStore (AsyncStorage) / SupabaseProgressStore (progress, user_meta, srs_cards, profiles.stage)
  store/merge.ts           jednorazowe scalenie gościa → konto (slug → uuid dla seedów)
  subjects.ts              rowToSubject / seedy / cache / progressKey
  api.ts                   /api/me, /api/generate, /api/tutor (stream albo pełny tekst), /api/stripe/*
  upload.ts                Storage `materials/{uid}/{uuid}.{ext}` (File.base64 → ArrayBuffer) + wiersz `materials`
  html.ts                  mini HTML → bloki tekstu (b/i/br/p/h3/ul/li/table, div.zbox) — bez WebView
  games.ts                 shuffle, fallback „dopasuj pary” z fiszek, etykiety gier
  theme.ts                 kolory z legacy/styles.css, `parseAccent()` (CSS gradient → expo-linear-gradient)
src/components/            ui (TopBar, StatPill, PillButton, Chips…), SubjectCard, LevelPath, FeedCard, Flashcard (flip), QuizCard,
                           games/{Match,Cloze,TrueFalse,Order}, TutorModal, Onboarding, ResultView, HtmlText, Accent
src/screens/subject/       PathTab, FlashcardsTab (SRS), QuizTab, ExamTab (timer, gradeFor), InfoTab
scripts/make-icons.mjs     generator PNG (własny enkoder, zero natywnych zależności)
```

## Postępy

Ten sam kształt JSON co legacy/web: `{[subjectKey]: {xp, levels: {[levelId]: {done, best, stars, attempts}}, bestExam?}}`.

- Gość: AsyncStorage, klucze `nauka_progress_v1`, `nauka_meta_v1`, `nauka_srs_v1`, `nauka_stage_v1`. Seedy kluczowane **slugiem** (`makro`, `krypto`…), jak w legacy.
- Zalogowany: Supabase `progress` / `user_meta` / `srs_cards` (klucz = uuid przedmiotu); po pierwszym logowaniu lokalny stan scalany jest do konta raz (`nauka_merged_v1:<uid>`), slug → uuid przez `subjects.slug`.
- Offline: ostatnio załadowane przedmioty w `nauka_subjects_cache_v1`, snapshot postępów zalogowanego w `nauka_progress_v1:<uid>`.

Logika XP / gwiazdek / odblokowań / streaka / SRS pochodzi w 100% z `@nauka/shared` (`applyQuizResult`, `unlockedIndex`, `isLevelUnlocked`, `gradeFor`, `touchStreak`, `review`).

## Mini-gry

Wszystkie 4 typy kontraktu: `match` (tap-tap pary), `cloze` (wybór do luki), `truefalse`, `order` (tap-to-reorder). Gdy poziom nie ma `games` (np. seedy z legacy), lekcja dostaje jedną grę „dopasuj pary” zbudowaną z fiszek poziomu (`gamesForLevel`).

## Build / EAS

```bash
npm i -g eas-cli && eas login
eas init                                   # zapisze projectId → EAS_PROJECT_ID w .env
eas build --profile development --platform ios     # dev client
eas build --profile preview --platform android     # APK do testów
eas build --profile production --platform all
eas submit --platform ios                          # uzupełnij ascAppId w eas.json
```

Profile w `eas.json`: `development` (dev client, internal), `preview` (internal, APK), `production` (autoIncrement). Zmienne `EXPO_PUBLIC_*` ustaw w EAS (`eas env:create`) albo w profilu `env`.

Bundle id: `pl.nauka.app` (iOS i Android), scheme `nauka`. Ikony: `npm run icons` (gradient + „książka”, 1024², adaptive, splash) — podmień na finalne przed publikacją.

## Sklepy — WAŻNE (TODO IAP)

`profile.tsx` → „Przejdź na Pro” otwiera **Stripe Checkout** (`POST /api/stripe/checkout`, `platform: "mobile"`) w `expo-web-browser`. To jest OK dla **TestFlight / bety wewnętrznej** i dla dystrybucji poza sklepami (EU/DMA, web-purchase link), ale **App Store odrzuci build sprzedający subskrypcję cyfrową bez StoreKit (In-App Purchase)**, Google Play analogicznie wymaga Play Billing. Przed publikacją w sklepach:

1. dodać IAP (najprościej RevenueCat: `react-native-purchases`, produkty `nauka_pro_month` / `nauka_pro_year`),
2. webhook RevenueCat → ustawianie `profiles.plan` (tak jak robi to dziś webhook Stripe),
3. w apce pokazywać Stripe tylko tam, gdzie wolno (np. web-purchase link w UE), inaczej IAP.

Miejsce w kodzie: `app/(tabs)/profile.tsx` (komentarz `TODO(store)`).

## Uwagi techniczne

- **Seedy**: Metro nie wspiera `import x from "./a.json" with { type: "json" }` z `packages/content/index.js`, więc `src/lib/subjects.ts` ładuje pliki `@nauka/content/subjects/*.json` przez `require` (lista identyczna z `index.js`). Dodając seed, dopisz go w obu miejscach.
- **Monorepo / Metro**: `apps/web` pinuje `react@19.3.0`, a RN 0.86 wymaga `react@19.2.3`, więc npm zagnieżdża `react`, `react-dom`, `reanimated`, `worklets` w `apps/mobile/node_modules`. `metro.config.js` ma resolver, który dla pakietów obecnych lokalnie zawsze bierze lokalną kopię — w bundlu jest jeden React (sprawdzone w `expo export`). `expo-doctor` zgłasza ten duplikat react/react-dom — to skutek pinów weba, nie błąd mobile.
- **Upload w RN**: `supabase.storage.upload()` nie przyjmuje `Blob` z `file://`, dlatego plik jest czytany przez `expo-file-system` `File.base64()`, dekodowany `base64-arraybuffer` i wysyłany jako `ArrayBuffer` z `contentType`.
- **Tutor streaming**: RN fetch nie zawsze daje `body.getReader()` — `tutorAsk()` streamuje jeśli się da, inaczej czeka na cały tekst. Działa w obu przypadkach.
- **Typed routes**: `experiments.typedRoutes` — typy generują się do `.expo/types` przy `expo start`; `tsc` przechodzi też bez nich.
- **TypeScript 6**: Expo 57 oczekuje `typescript ~6.0` — `tsconfig.json` nie używa `baseUrl` (deprecated w TS 6), `paths` są względne do tsconfig.
