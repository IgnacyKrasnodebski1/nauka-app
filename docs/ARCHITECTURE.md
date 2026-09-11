# NAUKA — architektura

```
nauka-app/
├── packages/shared     @nauka/shared   kontrakt: typy, zod, XP/streak, SRS, prompty, plany (TS → dist/)
├── packages/content    @nauka/content  7 przedmiotów seed (JSON) + skrypty konwersji/seeda
├── packages/ai         @nauka/ai       generowanie przedmiotu z materiałów przez Claude (server-only)
├── apps/web            @nauka/web      Next.js 16: landing, auth, app do nauki, API (generate, tutor, stripe)
├── apps/mobile         @nauka/mobile   Expo 57 + expo-router: iOS / Android (ten sam kontrakt, to samo API)
├── supabase/           migracje SQL, RLS, storage bucket, seed.sql
├── legacy/             stara wersja vanilla JS (nadal działa: node legacy/build.js)
└── docs/               ARCHITECTURE, API, DEPLOY
```

## Przepływ „wrzucam materiały → mam lekcję”
1. Klient (web/mobile) uploaduje pliki **bezpośrednio do Supabase Storage** (bucket `materials`, ścieżka `{userId}/{uuid}.{ext}`) i wstawia wiersze do `materials`.
2. Klient woła `POST /api/generate` (web API, Vercel) z `Authorization: Bearer <supabase access token>` i `{ materialIds, text?, options }`.
3. API: sprawdza plan i limity (`usage`), tworzy `generations` (status `running`), pobiera pliki z Storage (service role), woła `@nauka/ai` → Claude (vision + structured outputs), waliduje przez `SubjectContentSchema`, zapisuje `subjects` (owner = user), ustawia `generations.done`, zwraca `{ generationId, subjectId }`.
4. Klient otwiera przedmiot: ścieżka poziomów → lekcja (feed → fiszki → mini-gry → quiz) → egzamin.
5. Postępy: `progress` (XP, poziomy), `srs_cards` (powtórki), `user_meta` (streak). Gość (bez konta) trzyma to samo w localStorage / AsyncStorage pod kluczem `nauka_progress_v1` (kompatybilnie z legacy) i synchronizuje po zalogowaniu.

## Plany
`@nauka/shared` → `PLANS`. Free: 3 generacje/mies., Pro: 150. Plan w `profiles.plan`, ustawiany tylko przez webhook Stripe (RLS blokuje zmianę przez usera).

## Zasady
- Jeden kontrakt danych (`SubjectContent`) dla AI, bazy i obu UI. Zmiany schematu → `packages/shared/src/schema.ts` + migracja.
- Klucze API (Anthropic, Stripe secret, Supabase service role) **tylko** w API weba. Mobile i przeglądarka używają wyłącznie anon key + RLS.
- UI po polsku, luźny gen-z; treść merytoryczna poprawna.
