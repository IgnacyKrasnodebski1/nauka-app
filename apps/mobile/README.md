# @nauka/mobile — NAUKA na iOS / Android

Expo SDK 57 + expo-router, TypeScript strict, czysty `StyleSheet` (bez UI-kitów). Ten sam kontrakt danych (`@nauka/shared`) i to samo API (`apps/web`) co wersja webowa. Model produktu: **przedmiot** (kontener użytkownika) → **tematy** generowane przez AI (ze zdjęć/PDF/tekstu albo z samego hasła) → poziomy: feed, fiszki, mini-gry, quiz, egzamin. Logowanie wymagane — brak trybu gościa i cudzej biblioteki (patrz `docs/PRODUCT.md`).

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

> Uwaga: w tym monorepo `npx expo …` czasem nie znajduje `@expo/cli` (npx bierze inny bin). Skrypty npm (`npm run start`) działają zawsze; alternatywnie `node ../../node_modules/expo/bin/cli start`.

## Env

| zmienna | co to |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL projektu Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon key (RLS chroni dane; **nigdy** service role) |
| `EXPO_PUBLIC_API_URL` | adres weba (`apps/web`), np. `https://nauka.pl` — tam żyje `/api/generate`, `/api/tutor`, `/api/me`, `/api/stripe/*` |
| `EAS_PROJECT_ID` | opcjonalnie, po `eas init` |

W Supabase Auth → URL Configuration dodaj redirecty: `nauka://auth/callback` (build), `exp://…/--/auth/callback` (Expo Go; adres wypisze `REDIRECT_URI` w `src/lib/auth.tsx`). Google OAuth: włącz providera w Supabase, client id/secret z Google Cloud. Baza: `supabase/migrations/0001_init.sql` (tabele `subjects`, `topics`, `progress`, `srs_cards`, `user_meta`, `activity`, RPC `log_activity`).

## Ekrany (`app/`)

| trasa | co robi |
| --- | --- |
| `(auth)/login` | magic link / hasło / rejestracja / Google. Bez „pomiń”. |
| `onboarding` | po pierwszym logowaniu: etap (`STAGES`) → chipsy przedmiotów z `CURRICULUM[stage]` + własne → insert `subjects` (kolor z `paletteFor(name)`), `profiles.stage`. |
| `onboarding-add` | „+ przedmiot” z Home (te same chipsy, już dodane wyszarzone). |
| `(tabs)/today` **Dziś** | dzienna sesja z `buildDailySession` po wszystkich tematach: fiszki do powtórki (ocena 0–3 → `review()` → `srs_cards`), słabe pytania (→ `progress.weak`), na końcu link do nowego poziomu; ekran końcowy z XP + `log_activity`. |
| `(tabs)/index` **Przedmioty** | 🔥 streak / ⚡ XP, karta „Dziś” (ile fiszek/słabych/nowy poziom, ~min, Start), siatka przedmiotów (emoji, nazwa, tematy, % poziomów, badge „sprawdzian za N dni”), „+ przedmiot”. |
| `(tabs)/profile` **Profil** | etap, plan + zużycie z `GET /api/me`, Pro → Stripe Checkout (`platform: "mobile"`) w przeglądarce, portal, wyloguj. |
| `s/[subjectId]` | nagłówek w kolorze przedmiotu; **Sprawdzian**: „Mam sprawdzian” → data `RRRR-MM-DD` + nazwa → `exam_date/exam_label` → plan z `buildExamPlan` (dni z zadaniami, odliczanie); lista **tematów** (emoji, nazwa, poziomy, gwiazdki, źródło); CTA „📸 Z materiałów” / „✍️ Z hasła”; **Fiszki** i **Egzamin** z całego przedmiotu; usuń przedmiot. |
| `s/[subjectId]/new?mode=materials\|prompt` | `materials`: aparat / galeria (multi) / PDF+txt / wklejony tekst + opis; `prompt`: pole „np. fotosynteza, klasa 7”. Poziomy 2–6, „język obcy”. Upload do Storage `materials/{uid}/{uuid}.{ext}` + wiersze `materials`, potem `POST /api/generate` `{ subjectId, materialIds?, text?, options: { stage, subjectName, mode, hint, levels, lang } }` → `{ topicId }` → `t/[topicId]`. |
| `s/[subjectId]/cards`, `s/[subjectId]/exam` | fiszki (SRS) i egzamin (losowanie po wszystkich tematach) z całego przedmiotu. |
| `t/[topicId]` | temat: Ścieżka (odblokowywanie z shared) · Fiszki (flip + SRS) · Quiz · Egzamin (timer z `grading.examMin`, `gradeFor`, przegląd błędów) · Info (HTML → tekst, bez WebView). |
| `t/[topicId]/l/[levelId]` | lekcja: feed → fiszki → mini-gry (match/cloze/truefalse/order) → quiz → wynik. Po quizie: `applyQuizResult`, `markWeak` → `progress.weak`, `log_activity(xp, minuty)`, `touchStreak`. Przycisk 🤖 wytłumacz → tutor (`POST /api/tutor` z `topicId`, streaming jeśli RN fetch to umie). |

## Design system „Premium dark”

Tokeny wyłącznie z `@nauka/shared` (`COLORS`, `SUBJECT_HUES`, `RADIUS`, `SPACE`, `TYPE`, `SHADOW`, `MOTION`, `subjectHue`) — patrz `docs/DESIGN.md`. W apce nic nie jest hardkodowane poza wariantami alfa tokenów.

- `src/lib/theme.ts` — re-eksport tokenów, nazwy fontów (`FONT.display700` = `BricolageGrotesque_700Bold`, `FONT.body500` = `Manrope_500Medium`…), `hueFrom(subject.accent2)` → `{ color, soft, ring, glow }`, cienie (`shadowCard`, `shadowGlow`), `tabular`.
- Fonty: `@expo-google-fonts/bricolage-grotesque` (600/700/800) + `@expo-google-fonts/manrope` (400–700) ładowane w `app/_layout.tsx` przez `expo-font`; splash trzymany do czasu załadowania.
- `src/components/Text.tsx` — `Display` (Bricolage, −0.02em), `Title`, `Body`, `Muted`, `Label` (eyebrow 12px, letter-spacing 1.4, uppercase), `Num` (tabular-nums).
- `src/components/ui.tsx` — `Button` (primary = złoty gradient accentStrong→accent, tekst accentInk, glow; secondary = szkło; ghost; danger), `Touch` (press scale 0.98 na Reanimated, respektuje Reduce Motion), `Card` (bg2 + hairline + 1px highlight + shadow.card), `IconTile` (hue.soft + ring 40%), `StatPill` (streak pomarańcz / XP złoto), `MiniPill`, `Chip(s)`, `ProgressBar` (w kolorze przedmiotu), `Input`, `Empty`, `Toast` (dół, szkło).
- `src/components/Accent.tsx` — `HueProvider`/`useHue()` (kolor przedmiotu dla poddrzewa) i `Glow` (miękka pseudo-radialna poświata 0.10–0.18 alfa: 14 koncentrycznych kół, bez ostrych krawędzi).
- Ruch: `useReduceMotion()` (`AccessibilityInfo.isReduceMotionEnabled`) wyłącza puls aktywnego węzła ścieżki, licznik XP, gwiazdki, confetti (max 40 cząstek, 1.2 s, plain `Animated`), flip fiszki (spring z `MOTION.spring`).
- Tab bar: `expo-blur` (`BlurView tint="dark"`) + szkło, aktywna ikona i etykieta złote (11px).
- Lekcja ma opcjonalny param `?phase=feed|cards|games|quiz` (deep link / podgląd — start od danego etapu).

Podgląd (Playwright, 390×844 @2x, web export): `scratchpad/shots-mobile.mjs` — loguje się kontem testowym i robi zrzuty login → home → przedmiot → temat → quiz → wynik → Dziś → profil → fiszki.

## Kod

```
src/lib/
  supabase.ts              klient (AsyncStorage, PKCE) — `null` bez env
  auth.tsx                 AuthProvider: sesja, magic link, hasło, Google (expo-web-browser), obsługa `code`/tokenów z deep linku
  app-state.tsx            AppProvider: ProgressStore, subjects + topics, daily session (buildDailySession), CRUD przedmiotów, XP/streak, toast
  data.ts                  mapowanie wierszy (`rowToSubject`, `rowToTopic`), `fetchUserData`, `insertSubjects` (paletteFor), cache offline
  store/progress-store.ts  Supabase-only: `progress` (xp, levels, weak, best_exam) po topic_id, `srs_cards`, `user_meta`, `profiles.stage`, RPC `log_activity`;
                           po każdym zapisie snapshot do AsyncStorage (`nauka_cache_v2:<uid>`)
  api.ts                   /api/me, /api/generate (→ topicId), /api/tutor (topicId; stream albo pełny tekst), /api/stripe/*
  upload.ts                Storage upload (File.base64 → ArrayBuffer) + `materials`
  html.ts                  mini HTML → bloki tekstu (b/i/br/p/h3/ul/li/table, div.zbox)
  games.ts                 fallback „dopasuj pary” z fiszek gdy poziom nie ma `games`, etykiety gier, `minutesSince`
  theme.ts                 tokeny z @nauka/shared + fonty + `hueFrom()`; plural.ts — polska liczba mnoga
src/components/            Text, ui, Accent (HueProvider, Glow), SubjectCard, TopicCard, ExamPlanView, LevelPath (pulsujący węzeł), FeedCard,
                           Flashcard (3D flip), QuizCard, games/*, TutorModal, Onboarding (StagePicker, SubjectChips), ResultView (XP counter, gwiazdki, confetti), HtmlText
src/screens/topic/         PathTab, FlashcardsTab (1 temat albo cały przedmiot), QuizTab, ExamTab (1 temat albo cały przedmiot), InfoTab
```

## Postępy i offline

- Źródło prawdy: Supabase (`progress` kluczowane `topic_id`, `srs_cards`, `user_meta`, `activity` przez RPC). Cała logika XP / gwiazdek / odblokowań / streaka / SRS / sesji / planu pochodzi z `@nauka/shared`.
- AsyncStorage to **tylko cache do odczytu**: po każdym `fetchUserData` i każdym zapisie store zrzuca snapshot (`subjects`, `topics`, `progress`, `srs`, `weak`, `meta`, `stage`) pod `nauka_cache_v2:<uid>`. Bez sieci apka startuje z cache (toast „📴”), tematy i lekcje działają; zapisy kolejkują się w pamięci i lecą przy następnej okazji w tej sesji (po restarcie bez sieci przepadną — świadome uproszczenie).
- Bramka w `app/_layout.tsx`: brak sesji → login; sesja bez etapu/przedmiotów (i online) → onboarding.

## Build / EAS

```bash
npm i -g eas-cli && eas login
eas init                                   # zapisze projectId → EAS_PROJECT_ID w .env
eas build --profile development --platform ios     # dev client
eas build --profile preview --platform android     # APK do testów
eas build --profile production --platform all
eas submit --platform ios                          # uzupełnij ascAppId w eas.json
```

Profile w `eas.json`: `development`, `preview` (APK), `production` (autoIncrement). Zmienne `EXPO_PUBLIC_*` ustaw w EAS (`eas env:create`). Bundle id `pl.nauka.app`, scheme `nauka`. Ikony: `npm run icons` — podmień na finalne przed publikacją.

## Sklepy — WAŻNE (TODO IAP)

`profile.tsx` → „Przejdź na Pro” otwiera **Stripe Checkout** (`POST /api/stripe/checkout`, `platform: "mobile"`) w `expo-web-browser`. OK dla **TestFlight / bety wewnętrznej** i dystrybucji poza sklepami (EU/DMA), ale **App Store odrzuci build sprzedający subskrypcję cyfrową bez StoreKit (IAP)**, Google Play analogicznie wymaga Play Billing. Przed publikacją: RevenueCat (`react-native-purchases`, produkty `nauka_pro_month` / `nauka_pro_year`) + webhook ustawiający `profiles.plan` (jak dziś webhook Stripe). Miejsce w kodzie: komentarz `TODO(store)` w `app/(tabs)/profile.tsx`.

## Uwagi techniczne

- **Monorepo / Metro**: `apps/web` pinuje `react@19.3.0`, a RN 0.86 wymaga `react@19.2.3`, więc npm zagnieżdża `react`/`react-dom` w `apps/mobile/node_modules`. `metro.config.js` ma resolver, który dla pakietów obecnych lokalnie zawsze bierze lokalną kopię — w bundlu jest jeden React (sprawdzone w `expo export`). `expo-doctor` zgłasza ten duplikat — skutek pinów weba.
- **Upload w RN**: `supabase.storage.upload()` nie przyjmuje `Blob` z `file://`, dlatego plik jest czytany przez `expo-file-system` `File.base64()`, dekodowany `base64-arraybuffer` i wysyłany jako `ArrayBuffer`.
- **Typed routes**: `experiments.typedRoutes` — typy generują się do `.expo/types` przy `expo start`; `tsc` przechodzi też bez nich.
- **TypeScript 6** (wymagany przez Expo 57): `tsconfig.json` bez `baseUrl`, `paths` względne do tsconfig.
- **Data sprawdzianu**: prosty input `RRRR-MM-DD` (bez natywnego date pickera — zero dodatkowych natywnych zależności).
