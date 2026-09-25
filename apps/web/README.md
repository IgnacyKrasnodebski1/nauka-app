# @nauka/web — Recall (Next.js 16)

Landing, logowanie, apka do nauki (przedmioty → tematy) i API (generowanie tematów z AI, tutor, Stripe). Logowanie jest wymagane — bez konfiguracji Supabase strony pod `/app` pokazują stan „Brak konfiguracji Supabase” zamiast się wywalać, a API zwraca 503 z czytelnym JSON-em.

## Model
- **Przedmiot** (`subjects`) — kontener użytkownika (Matematyka, Biologia…) z emoji, kolorem (`paletteFor`), etapem i opcjonalną datą sprawdzianu. Wybierany w onboardingu z `CURRICULUM[stage]` albo wpisany ręcznie.
- **Temat** (`topics`) — jednostka wygenerowana przez AI w obrębie przedmiotu (`TopicContent`: poziomy → feed, fiszki, mini-gry, quiz). Źródło: `materials` (zdjęcia/PDF/tekst) albo `prompt` (samo hasło wg podstawy programowej).
- **Postępy** per temat: `progress` (xp, poziomy, `weak` = talia błędów, `boss`, `ghost`), `srs_cards`, `user_meta` (seria, gemy, życia, plany, album…), `activity` (RPC `log_activity`).

## Uruchomienie

```bash
# z ROOTA monorepo
npm install
npm run build:shared          # @nauka/shared → dist (i @nauka/ai, jeśli nie zbudowany)
cp apps/web/.env.example apps/web/.env.local   # uzupełnij
npm run web                   # http://localhost:3000
```

Skrypty w `apps/web`:

| skrypt | co robi |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | `next build` (przechodzi bez env; **uwaga:** `NEXT_PUBLIC_*` są wklejane do bundla w czasie builda, więc build „bez env” = build bez `.env.local`) |
| `npm run start` | serwer produkcyjny |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `eslint .` |
| `npm run smoke` | po `build`: startuje `next start`, odpytuje `/`, `/login`, `/app*`, `/api/*` — działa w obu trybach (bez env: „Brak konfiguracji”, z env: przekierowanie do `/login`, API 401) |
| `NEXT_PUBLIC_DEV_UI=1 npm run build` | build z galerią komponentów pod `/dev/ui` (bez tej zmiennej galeria zwraca 404 w produkcji) |
| `npm run icons` | regeneruje `public/icons/*` (SVG + PNG, bez zależności) |

## Env (`apps/web/.env.local`)

| zmienna | rola |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | auth, RLS, storage z przeglądarki. Brak = apka wyłączona (landing działa). |
| `SUPABASE_SERVICE_ROLE_KEY` | tylko API: pobieranie plików z bucketa `materials`, `generations`, `usage` (RPC `increment_usage`), webhook Stripe. |
| `ANTHROPIC_API_KEY`, `RECALL_AI_MODEL` | generowanie i tutor przez `@nauka/ai`. Brak klucza = tryb demo (przykładowy temat z `hint`, tagline „DEMO”). |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | Pro (29 zł/mies., 199 zł/rok). Brak = przyciski zwracają 503. |
| `NEXT_PUBLIC_APP_URL` | absolutny URL (success/cancel URL Stripe). |

Supabase: `supabase db push` (migracje `supabase/migrations/0001_init.sql`, `0002_gamification.sql`, `0003_recall2.sql`). W Auth → URL configuration dodaj `https://twoja-domena/auth/callback`. Google OAuth włącz w Auth → Providers.

Stripe: webhook na `POST /api/stripe/webhook` z eventami `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`. Włącz BLIK w Payment methods.

## Ekrany (`src/app`) — Recall 2.0

Wygląd wg `design/DESIGN.md` i podglądów `design/preview/*.html` (kolumna 560 px na desktopie, 390 px na telefonie). Tokeny motywu wstrzykuje `TOKENS_CSS` z `@nauka/shared` (root layout), klasy ekranów siedzą w `src/app/globals.css` (port `legacy/styles.css` + warstwa weba). Ikony: `components/ui/icons.tsx` (te same nazwy co legacy `ICONS`). Kolor przedmiotu: `themeStyle(accent2)` → `accentVars`.

```
/                         landing (hero z mockupem, 3 kroki, gra, etapy, cennik, FAQ)
/login, /auth/callback    magic link + Google + hasło; wymiana code → sesja (cookies, @supabase/ssr)
/app                      Dziś (Main): data, pasek planu, cel dzienny, Misje/Seria/Album, wiersze planu dnia (+ plan do sprawdzianu),
                          kafle przedmiotów; pierwsze uruchomienie → /app/levelpick → /app/onboarding → /app/catalog?add=1
                          ≥ 3 dni przerwy → /app/comeback; poniedziałek → /app/weekly?mode=last; brak przedmiotów → EmptyState
/app/levelpick, /app/onboarding   etap + cel (profiles.stage, profiles.goal), cel dzienny + przypomnienie
/app/catalog              Odkrywaj: twoje przedmioty + CURRICULUM wg etapu; ?add=1 → po wyborze przedmiotu od razu upload
/app/s/[subjectId]        przedmiot: pas z postępem, „Mam sprawdzian”, tematy, dodaj temat (zdjęcie / plik / hasło), usuń
/app/s/[subjectId]/new    AddSubject → Scanner (capture="environment") → Detected → Generating → SubjectReady (kolor, poziomy on/off)
/app/t/[topicId]          pas tematu + zakładki: Ścieżka (skrzynie, boss), Fiszki (SRS + album + quest serc), Quiz, Ćwiczenia
                          (pary, speed, wpisywanie, klocki + 15 typów zadań), Egzamin (ExamStart → ExamRun → wynik + talia błędów),
                          Info (zasady zaliczenia, siatka ocen); ?tab=…&lvl=…
/app/t/[topicId]/l/[lvl]  lekcja: roladka → pytania i zadania (levelSession), życia, combo, duch, panele dobrze/źle
                          („Wyjaśnij inaczej” z tutorem AI, „Zgłoś/popraw” → overrides), NoHearts, LevelComplete
/app/t/[topicId]/boss     boss rozdziału (pula pytań + zadań, 20 s na pytanie, HP)
/app/review               Powtórka (SRS: fiszki + pytania), ?topic= ?levels= ?deck= (talia błędów z egzaminu) ?start=1 ?n=
/app/cards                hub fiszek (tematy per przedmiot, ile do powtórki)
/app/testplan/[id]        plan do sprawdzianu dzień po dniu (user_meta.tests), /app/cram/[topicId] — noc przed egzaminem
/app/missions, /app/shop, /app/streak, /app/album, /app/weekly, /app/comeback, /app/profile, /app/settings
/app/league               tygodniowy ranking XP (RPC), dywizje „wkrótce”; /app/friends, /app/share/[topicId] — uczciwe „wkrótce”
/app/today → /app/review, /app/account → /app/settings, /app/leaderboard → /app/league   (przekierowania z 1.x)
/dev/ui                   galeria komponentów 2.0 (NEXT_PUBLIC_DEV_UI=1 poza dev)
/api/*                    generate (POST+GET), tutor, stripe/{checkout,portal,webhook}, me — zgodnie z docs/API.md
```

`src/proxy.ts` (Next 16 „proxy” = dawne middleware) odświeża sesję i przekierowuje niezalogowanych z `/app*` do `/login?next=…`.

### Dane 2.0 (migracja `supabase/migrations/0003_recall2.sql`)

- `profiles.goal` — cel nauki (sprawdziany / matura / olimpiada / sesja / własny).
- `user_meta`: `themes`, `boost_until`, `album`, `overrides` (poprawki pytań `"<topicId>:<levelId>:<qi>"` i `"hide:<topicId>:<levelId>"`), `tests` (plany do sprawdzianów — JSONB, jeden na przedmiot), `weekly_quest`, `history` (dziennik dnia pod podsumowanie tygodnia), `daily` (plan dnia), `reduce_motion`, `reminder`, `exams` (wyniki egzaminów per temat).
- `progress`: `boss`, `ghost` (najlepszy przebieg poziomu). Talia błędów z egzaminu = `progress.weak`.
- SRS w `srs_cards`: klucze `"<levelId>:<idx>"` (fiszki) i `"<levelId>:q<qi>"` (pytania).

## Struktura kodu

```
src/lib/
  supabase/{client,server,admin}.ts   klienci (leniwe, null bez env)
  auth.ts                getUserFromRequest: Bearer albo cookie
  data.ts                serwerowe czytanie subjects/topics (RLS); client-data.ts — cache biblioteki w przeglądarce
  plan.ts                limity z PLANS + RPC increment_usage
  stripe.ts, env.ts, types.ts (mapowanie wierszy → Subject/Topic), ai.ts (→ @nauka/ai)
  dates.ts, tests.ts (plan do sprawdzianu), daily-plan.ts (plan dnia), review.ts (SRS: wpisy, due, talia błędów)
  store/progress-store.ts  ProgressStore: progress (+weak, boss, ghost), srs_cards, user_meta (+2.0), profiles, log_activity
  store/app-context.tsx    AppProvider/useApp (użytkownik, store, XP/streak/gemy/misje/album/overrides/testy, toasty)
src/components/
  app/       chrome (AppChrome, Shell, BottomNav, pigułki, Toggle, NoConfig, pasek offline)
  screens/   main, empty, onboarding (LevelPick + Onboarding), subject, review, cards-hub, profile, settings, streak, shop,
             missions, album, comeback, weekly, catalog, testplan, cram, social (League/Friends/Share), error
  topic/     shell (pas + zakładki), path, cards, quiz, practice, exam, info
  lesson/    lesson (+LevelComplete), boss, quiz-block, sheets (ok/bad, Explain, SourceView, EditContent, NoHearts), ghost-card
  tasks/     16 rendererów zadań (tf, fill, typeterm, swipe, thesis, scenario, finderror, match, order, sort, timeline, chain,
             chart, mathsteps, hotspot) + common (drag, klawiatura, stopka)
  review/    session (sesja powtórki + FlashcardsDone)
  flow/      new-topic (AddSubject → Scanner → Detected → Generating → SubjectReady)
  sheets/    quick-add, test-plan
  ui/        icons, sheet, confetti, mono, logo
  dev/       gallery (/dev/ui)
  auth/, landing/
```

## Deploy na Vercel

1. Import repo, **Root Directory: `apps/web`**. Build command: `cd ../.. && npm run build:shared && npm run build -w @nauka/web`.
2. Dodaj env z tabeli wyżej (Production + Preview).
3. `vercel.json` ustawia `maxDuration` 300 s dla `/api/generate` (plan Pro Vercel; na Hobby limit to 60 s).
4. Po deployu ustaw webhook Stripe i redirect URL w Supabase na domenę produkcyjną.
