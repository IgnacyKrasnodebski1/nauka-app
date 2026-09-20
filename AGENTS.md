# AGENTS.md — kontekst projektu dla agentów (Codex itd.)

## Czym jest ten projekt
**Recall** — apka do nauki (web + mobile) w stylu Duolingo. Użytkownik ma **przedmioty** (kontenery: Matematyka, Biologia…), a w nich **tematy** generowane przez AI (Claude) z materiałów (zdjęcia, PDF, tekst) albo z samego hasła wg podstawy programowej. Temat = poziomy: roladka → fiszki (SRS) → mini-gry → quiz → egzamin. Do tego „Dzisiejsza sesja” i plan do sprawdzianu. Podstawówka, liceum, studia. Freemium przez Stripe. Pełna logika: docs/PRODUCT.md.

## Struktura (monorepo, npm workspaces)
```
packages/shared   @nauka/shared  KONTRAKT: typy + zod (schema.ts), gamification.ts (XP/gwiazdki/streak), srs.ts, prompts.ts, plans.ts, finalize.ts. Build: tsc → dist/
packages/ai       @nauka/ai      server-only. generateSubject() (Claude vision+PDF+structured outputs, tryb demo bez klucza), tutorStream()
apps/web          @nauka/web     Next.js 16 App Router + Tailwind 4: landing, auth (Supabase), /app, API routes (docs/API.md)
apps/mobile       @nauka/mobile  Expo + expo-router, RN StyleSheet, to samo API i kontrakt
supabase/         migrations/0001_init.sql (tabele, RLS, storage bucket, RPC), config.toml, dev_upgrade_v1_to_v2.sql (jednorazowy)
legacy/           stara wersja vanilla JS (nadal działa: node legacy/build.js) — nie rozwijać, tylko nie psuć
docs/             ARCHITECTURE.md, API.md, DEPLOY.md
```

## Komendy
- `npm install` (root), `npm run build:shared`, `npm run build -w @nauka/ai`
- `npm test` (shared + ai, node:test), `npm run typecheck` (shared, web, mobile)
- `npm run web` / `npm run web:build`, `npm run mobile`

## Reguły (NIE psuć)
- **Jeden kontrakt danych**: `TopicContent` w `packages/shared/src/schema.ts`. AI, baza (`topics.content` JSONB) i oba UI używają tego samego. Zmiana = zod + migracja + oba UI. `Subject` = kontener (bez treści).
- Quiz: `c` = indeks poprawnej odpowiedzi od 0, `e` zawsze obecne. Mini-gry: `match | cloze | truefalse | order`.
- Klucze (Anthropic, Stripe secret, Supabase service role) **tylko** w API weba (`apps/web` server). Przeglądarka i mobile: anon key + RLS.
- Plan usera (`profiles.plan`) zmienia tylko webhook Stripe (RLS blokuje update przez usera). Limity w `PLANS` (shared).
- Model AI: `claude-opus-5` domyślnie (`RECALL_AI_MODEL`), adaptive thinking, structured outputs przez `betaZodOutputFormat(GeneratedTopicSchema)`, fallbacks `"default"`. Bez klucza = tryb demo (nie crashować).
- Build weba i typecheck mobile muszą przechodzić **bez** żadnych env (klienci tworzone leniwie).
- UI po polsku, luźny gen-z; treść merytoryczna poprawna. Bez dodatkowych UI-kitów.

## Workflow przy zmianach
1. Zmiana kontraktu → `packages/shared` → `npm run build:shared` → dostosuj web i mobile.
2. Logika lekcji/gier: web `apps/web/src/components`, mobile `apps/mobile/src`. Trzymaj mechanikę identyczną (używaj funkcji z shared: `applyQuizResult`, `touchStreak`, `review`, `pickExam`, `unlockedIndex`).
3. Przed commitem: `npm test && npm run typecheck && npm run build -w @nauka/web`.
