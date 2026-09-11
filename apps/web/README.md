# @nauka/web — NAUKA (Next.js 16)

Landing, logowanie, apka do nauki (przedmioty → tematy) i API (generowanie tematów z AI, tutor, Stripe). Logowanie jest wymagane — bez konfiguracji Supabase strony pod `/app` pokazują stan „Brak konfiguracji Supabase” zamiast się wywalać, a API zwraca 503 z czytelnym JSON-em.

## Model
- **Przedmiot** (`subjects`) — kontener użytkownika (Matematyka, Biologia…) z emoji, kolorem (`paletteFor`), etapem i opcjonalną datą sprawdzianu. Wybierany w onboardingu z `CURRICULUM[stage]` albo wpisany ręcznie.
- **Temat** (`topics`) — jednostka wygenerowana przez AI w obrębie przedmiotu (`TopicContent`: poziomy → feed, fiszki, mini-gry, quiz). Źródło: `materials` (zdjęcia/PDF/tekst) albo `prompt` (samo hasło wg podstawy programowej).
- **Postępy** per temat: `progress` (xp, poziomy, `weak` = pytania, które nie weszły), `srs_cards`, `user_meta` (streak), `activity` (RPC `log_activity`).

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
| `npm run icons` | regeneruje `public/icons/*` (SVG + PNG, bez zależności) |

## Env (`apps/web/.env.local`)

| zmienna | rola |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | auth, RLS, storage z przeglądarki. Brak = apka wyłączona (landing działa). |
| `SUPABASE_SERVICE_ROLE_KEY` | tylko API: pobieranie plików z bucketa `materials`, `generations`, `usage` (RPC `increment_usage`), webhook Stripe. |
| `ANTHROPIC_API_KEY`, `NAUKA_AI_MODEL` | generowanie i tutor przez `@nauka/ai`. Brak klucza = tryb demo (przykładowy temat z `hint`, tagline „DEMO”). |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | Pro (29 zł/mies., 199 zł/rok). Brak = przyciski zwracają 503. |
| `NEXT_PUBLIC_APP_URL` | absolutny URL (success/cancel URL Stripe). |

Supabase: `supabase db push` (migracja `supabase/migrations/0001_init.sql`). W Auth → URL configuration dodaj `https://twoja-domena/auth/callback`. Google OAuth włącz w Auth → Providers.

Stripe: webhook na `POST /api/stripe/webhook` z eventami `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`. Włącz BLIK w Payment methods.

## Ekrany (`src/app`)

```
/                         landing (hero, 3 kroki, etapy, „Mam sprawdzian” + „Dziś”, cennik, FAQ)
/login, /auth/callback    magic link + Google + hasło; wymiana code → sesja (cookies, @supabase/ssr)
/app                      onboarding (etap → przedmioty z CURRICULUM + własny), karta „Dziś” (buildDailySession),
                          siatka przedmiotów z badge sprawdzianu, „+ przedmiot”
/app/s/[subjectId]        sprawdzian (data + plan z buildExamPlan), tematy, „📸 Z materiałów” / „✍️ Z hasła”,
                          Fiszki i Egzamin z całego przedmiotu, usuń przedmiot
/app/s/[subjectId]/new    ?mode=materials|prompt → POST /api/generate → /app/t/[topicId]
/app/t/[topicId]          Ścieżka / Fiszki (SRS) / Quiz / Egzamin / Info
/app/t/[topicId]/l/[lvl]  lekcja: feed → fiszki → mini-gry (pary, luka, prawda/fałsz, kolejność) → quiz → wynik
                          (applyQuizResult + markWeak → progress.weak + log_activity + touchStreak); tutor 🤖
/app/today                sesja: fiszki SRS (review) → słabe pytania (weak) → link do nowego poziomu
/app/account              etap, nazwa, plan + zużycie (/api/me), Pro (Stripe), portal, wyloguj
/api/*                    generate (POST+GET), tutor, stripe/{checkout,portal,webhook}, me — zgodnie z docs/API.md
```

`src/proxy.ts` (Next 16 „proxy” = dawne middleware) odświeża sesję i przekierowuje niezalogowanych z `/app*` do `/login?next=…`.

## Struktura kodu

```
src/lib/
  supabase/{client,server,admin}.ts   klienci (leniwe, null bez env)
  auth.ts                getUserFromRequest: Bearer albo cookie
  data.ts                serwerowe czytanie subjects/topics (RLS)
  plan.ts                limity z PLANS + RPC increment_usage
  stripe.ts, env.ts, types.ts (mapowanie wierszy → Subject/Topic), ai.ts (→ @nauka/ai)
  store/progress-store.ts  ProgressStore: progress (+weak), srs_cards, user_meta, profiles.stage, log_activity
  store/app-context.tsx    AppProvider/useApp (użytkownik, store, XP/streak, toasty)
src/components/
  app/       chrome (TopBar, nav, NoConfig), home, onboarding (SubjectPicker), subject-card
  subject/   subject-page, exam-plan
  topic/     shell, path, flashcards (wiele tematów), quiz, exam (wiele tematów), info, question, theme
  lesson/    lesson, games/{match,cloze,truefalse,order}, confetti
  today/     session
  upload/    new-topic
  tutor/, account/, auth/, landing/
```

## Deploy na Vercel

1. Import repo, **Root Directory: `apps/web`**. Build command: `cd ../.. && npm run build:shared && npm run build -w @nauka/web`.
2. Dodaj env z tabeli wyżej (Production + Preview).
3. `vercel.json` ustawia `maxDuration` 300 s dla `/api/generate` (plan Pro Vercel; na Hobby limit to 60 s).
4. Po deployu ustaw webhook Stripe i redirect URL w Supabase na domenę produkcyjną.
