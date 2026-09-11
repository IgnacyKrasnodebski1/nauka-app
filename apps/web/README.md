# @nauka/web — NAUKA (Next.js 16)

Landing, logowanie, apka do nauki i API (generowanie z AI, tutor, Stripe). Działa też **bez żadnych env** (tryb demo: biblioteka z `@nauka/content`, postępy w `localStorage`, API zwraca 503 z czytelnym JSON-em).

## Uruchomienie

```bash
# z ROOTA monorepo
npm install
npm run build:shared          # @nauka/shared → dist
cp apps/web/.env.example apps/web/.env.local   # uzupełnij co masz
npm run web                   # http://localhost:3000
```

Skrypty w `apps/web`:

| skrypt | co robi |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | `next build` (przechodzi bez env) |
| `npm run start` | serwer produkcyjny |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `eslint .` |
| `npm run smoke` | po `build`: startuje `next start`, odpytuje `/`, `/login`, `/app`, `/app/s/makro`, `/api/me` itd. |
| `npm run icons` | regeneruje `public/icons/*` (SVG + PNG, bez zależności) |

## Env (`apps/web/.env.local`)

| zmienna | rola |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | auth, RLS, storage z przeglądarki. Brak = tryb demo (gość, biblioteka z seedów). |
| `SUPABASE_SERVICE_ROLE_KEY` | tylko API: pobieranie plików z bucketa `materials`, `generations`, `usage` (RPC `increment_usage`), webhook Stripe. |
| `ANTHROPIC_API_KEY`, `NAUKA_AI_MODEL` | generowanie i tutor przez `@nauka/ai`. Brak klucza = tryb demo (przedmiot z `text`/`hint`, tagline „DEMO”). |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | Pro (29 zł/mies., 199 zł/rok). Brak = przyciski zwracają 503. |
| `NEXT_PUBLIC_APP_URL` | absolutny URL (success/cancel URL Stripe, metadata). |

Supabase: `supabase db push` (migracja `supabase/migrations/0001_init.sql`) + `supabase db seed` (`supabase/seed.sql` = publiczne przedmioty). W Auth → URL configuration dodaj `https://twoja-domena/auth/callback`. Google OAuth włącz w Auth → Providers.

Stripe: webhook na `POST /api/stripe/webhook` z eventami `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`. Włącz BLIK w Payment methods.

## Struktura

```
src/app/                 App Router
  page.tsx               landing (hero, jak to działa, etapy, demo, cennik, FAQ)
  login/                 magic link + Google + hasło
  auth/callback/         wymiana code → sesja (cookies, @supabase/ssr)
  app/                   apka: home, new (upload), s/[id] (przedmiot), s/[id]/l/[levelId] (lekcja), account
  api/                   generate, tutor, stripe/{checkout,portal,webhook}, me — zgodnie z docs/API.md
  billing/, regulamin/, prywatnosc/
src/proxy.ts             odświeżanie sesji Supabase (Next 16 „proxy” = dawne middleware)
src/lib/
  supabase/{client,server,admin}.ts   klienci (leniwe, null bez env)
  auth.ts                getUserFromRequest: Bearer albo cookie
  plan.ts                limity z PLANS + RPC increment_usage
  stripe.ts, env.ts, subjects.ts (ładowanie z DB albo seedów), types.ts
  ai.ts → ai-stub.ts     wejście do @nauka/ai (patrz niżej)
  store/                 ProgressStore: LocalProgressStore (gość, klucze nauka_progress_v1 / nauka_meta_v1 jak legacy)
                         i SupabaseProgressStore (progress, user_meta, srs_cards); merge.ts scala gościa po zalogowaniu
src/components/          app (chrome, home), subject (ścieżka, fiszki+SRS, quiz, egzamin, info), lesson (feed→fiszki→gry→quiz→wynik), tutor, upload, account
public/                  manifest.webmanifest, icons/
scripts/                 icons.mjs, smoke.mjs
```

## Deploy na Vercel

1. Import repo, **Root Directory: `apps/web`**, framework Next.js. Build command: `cd ../.. && npm run build:shared && npm run build -w @nauka/web` (albo zostaw domyślne, jeśli `packages/shared/dist` jest w repo).
2. Dodaj env z tabeli wyżej (Production + Preview).
3. `vercel.json` ustawia `maxDuration` 300 s dla `/api/generate` (wymaga planu Pro Vercel; na Hobby limit to 60 s — wtedy generuj z mniejszą liczbą plików).
4. Po deployu ustaw webhook Stripe i redirect URL w Supabase na domenę produkcyjną.

## @nauka/ai

`src/lib/ai.ts` re-eksportuje `generateSubject` i `tutorStream`. Domyślnie z lokalnego stuba (`ai-stub.ts`, zawsze tryb demo). Gdy `packages/ai/dist` istnieje, zamień import na `"@nauka/ai"` (ta sama sygnatura).
