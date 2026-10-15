# Recall — wdrożenie (od zera do sprzedaży)

## Stan na 2026-09-11 (zrobione z tej sesji)
| Co | Status | Identyfikator |
|---|---|---|
| Supabase projekt `nauka` (eu-central-1) | utworzony, schemat v1 wgrany | ref `zhgxhdsnizujzygpcyfl` |
| Supabase schemat v2 (przedmioty → tematy) | wgrany (`supabase/dev_upgrade_v1_to_v2.sql`) | |
| Supabase auth | email (auto-confirm), site URL `https://nauka-jet.vercel.app`, redirecty localhost / `*.vercel.app` / `recall://` | Google: do włączenia ręcznie (pkt 1.4) |
| Stripe (test) produkt „Recall Pro” | utworzony | `prod_VEwoeIrg8evsMf` |
| Stripe ceny | 29 zł/mies `price_1UESvFRsoBaIQwwLY3S0hjrd`, 199 zł/rok `price_1UESvGRsoBaIQwwL8c0rRt0s` | |
| Stripe Customer Portal | skonfigurowany | `bpc_1UESvGRsoBaIQwwL6jxvaNG3` |
| Stripe webhook | `https://nauka-jet.vercel.app/api/stripe/webhook`, secret w env Vercela | `we_1UETG1RsoBaIQwwLW8dYAsaZ` |
| Vercel projekt `nauka` | utworzony, podpięty do repo (root `apps/web`), wszystkie env ustawione | `prj_Fxj3EGxACbjEJdjzAbPWSXex2KHS`, domena `nauka-jet.vercel.app` |
| Vercel produkcja | **wdrożona** z brancha `claude/peaceful-hamilton-jy11e3` → https://nauka-jet.vercel.app. Auto-deploy prod działa z `main` → zmerguj branch do `main` | |
| Anthropic key | ustawiony na Vercelu (generacja na produkcji przetestowana: 112 s, 2 poziomy) | |
| Migracja 0002 (gamifikacja: serca, klejnoty, questy, odznaki, ranking) | wgrana na projekt dev | |
| Rebrand Recall | Supabase redirect `recall://**` dodany, produkt Stripe „Recall Pro” | mobile: nowy slug/scheme → `eas init` od nowa |

Zostało: merge do `main`, Google OAuth (1.4), przełączenie Stripe z test na live (klucze `sk_live`, nowy webhook), własna domena.

## Build 7: bezpieczniki kosztów generacji (AUDYT §6.1 A) — kolejność wdrożenia

Zmiany: rezerwacja limitu w jednej transakcji (`reserve_generation`, P0-1), **plan free = 2 generacje na zawsze** liczone po skrócie adresu e-mail (przeżywa usunięcie konta), **bez triala dla nowych kont**, limit globalny i limit darmowych generacji w tabeli `app_config` (domyślnie 30/dobę i 2; decyzja właściciela z 2026-10-15, AUDYT D3 / P0-2), `/api/tutor` wyłączony w produkcji (P1-1), `levels` z klienta ignorowane i `count_tokens` przed naliczeniem (P1-29), rozłożony start wywołań, żeby cache promptu był czytany (P1-2), kolumny kosztu i jakości (P1-3), termin 270 s, sprzątacz w pg_cron i zapis tematu z `done` w jednym RPC (P1-4), limity Storage i bazy na konto (P1-5). Kontrakt API dla buildu 6 bez zmian (szczegóły i nowe kody: `docs/API.md`). Migracje leżą w `nauka-app/backend/` (gałąź apki), nie w `supabase/migrations/` tego repo.

**Kolejność** (każdy krok sprawdzić, zanim przejdziesz dalej):

0. Bez kodu, jeśli jeszcze nie ma: miesięczny limit wydatków i alerty w workspace Anthropic (AUDYT 6.0).
1. **Migracja 0007** (addytywna, plus od razu: nowe konta bez triala i limit globalny 30/dobę z `app_config`), przed wdrożeniem backendu:
   ```bash
   cd /Users/ignacykrasnodebski/nauka-app
   supabase db query --linked -f backend/0007_generation_guards.sql
   ```
   Sprawdzenie (tylko odczyt): `select proname from pg_proc where proname in ('reserve_generation','finish_generation','sweep_stale_generations','materials_bucket_stats','generation_quota','backfill_free_generation_ledger','reset_free_generations','generations_last_day','free_generations_last_day');` (9 wierszy), `select key, value from app_config;` (`generation_global_daily_cap` = 30, `free_lifetime_generations` = 2, `free_global_daily_cap` = 20), `select count(*) from free_generation_ledger;` (historia kont free policzona przez backfill; generacje z triala się nie liczą), `select prosrc like '%''free''::public.plan, null%' from pg_proc where proname = 'handle_new_user';` (`true` — nowe konta bez triala), `select to_regclass('public.generation_ledger');` (nie null; licznik do limitu globalnego, przeżywa usunięcie konta; Supabase sam przeładowuje schemat PostgREST — gdyby API zgłaszało `PGRST202`, `notify pgrst, 'reload schema';`) i `select jobname, schedule from cron.job;` (`cramfox-sweep-generations` `*/5 * * * *` obok `cramfox-end-trials`). Build 6 i obecny backend działają z 0007 (nowe kolumny puste, nowe RPC nieużywane, sprzątacz zamyka tylko wiersze starsze niż 8 min). Od razu działają: brak triala dla nowych kont (stary backend da im swoje free 3/mies. do wdrożenia) i limit globalny z `app_config` w `increment_usage` (30 zamiast 300).
2. **Wdrożenie backendu** (z kopii bez gita, BIBLIA §9.2). Nowych zmiennych nie trzeba; `TUTOR_ENABLED` **nie ustawiać** (tutor ma odpowiadać 410). Backend wdrożony bez 0007 odpowiada na każdą generację 500 `reserve_failed` (bez naliczenia) — dlatego 0007 najpierw.
3. **Sprawdzenie na produkcji** (konto testowe, jedna płatna generacja z krótkiego tekstu; nowe konto testowe jest free, więc zużywa 1 z 2 darmowych — `GET /api/me` ma `quota: {scope: "lifetime", used: 1, limit: 2}`, a w `free_generation_ledger` jest jego wiersz): wiersz w `generations` ma `status = 'done'`, `cost_usd`, `opus_*`, `review_*` i `quality`; przy ≥ 2 poziomach `opus_cache_read > 0` (cache czytany). `POST /api/tutor` → 410 `tutor_disabled`. W logach funkcji `[generate] coverage`.
4. **Migracja 0008 (zaostrzająca)** — dopiero gdy build 6 tworzy lekcje na nowym backendzie:
   ```bash
   supabase db query --linked -f backend/0008_account_limits.sql
   ```
   Na początku woła drugi raz `backfill_free_generation_ledger()` (idempotentne): dolicza generacje kont free zrobione przez stary backend między 0007 a wdrożeniem.
   Sprawdzenie **wszystkich czterech sekcji** (tylko odczyt), potem build 6 wysyła zdjęcie, tworzy przedmiot i lekcję (odzyskiwanie czyta `generations` przez nowe uprawnienia kolumn):
   - `select conname, convalidated from pg_constraint where conname = 'topics_content_size';` → 1 wiersz, `false` (NOT VALID);
   - `select tgrelid::regclass, tgname from pg_trigger where tgname = 'cap_owner_rows';` → 3 wiersze (`subjects`, `materials`, `topics`);
   - `select has_column_privilege('authenticated', 'public.generations', 'cost_usd', 'select') as koszt, has_column_privilege('authenticated', 'public.generations', 'status', 'select') as status;` → `false`, `true`;
   - `select polname, polpermissive from pg_policy where polrelid = 'storage.objects'::regclass;` → `materials upload daily cap` z `polpermissive = false`;
   - właściciel funkcji limitu widzi pliki: `select has_table_privilege(proowner::regrole::text, 'storage.objects', 'select') from pg_proc where proname = 'materials_upload_allowed';` → `true`.

   Polityka na `storage.objects` jest ostatnią sekcją pliku. Gdyby CLI jej odmówiło (`must be owner of table objects`), wklej **cały** plik w SQL Editor panelu (jest idempotentny; CLI mogło cofnąć wcześniejsze sekcje razem z błędem) i powtórz wszystkie sprawdzenia powyżej.
5. Build 7 apki (mapowanie nowych kodów: `docs/API.md` → „Mapowanie dla klienta”).

**Wycofanie.** Backend: w Vercelu „Promote” poprzedniego wdrożenia — stary kod działa z 0007 i 0008 (`increment_usage` zostało; limit globalny bierze z `app_config`). Stary kod nie zna darmowych generacji na zawsze: konta free mają wtedy jego 3 na miesiąc, a te generacje dolicza `select public.backfill_free_generation_ledger();` po ponownym wdrożeniu. 0008: `drop policy "materials upload daily cap" on storage.objects; drop trigger cap_owner_rows on public.subjects; drop trigger cap_owner_rows on public.materials; drop trigger cap_owner_rows on public.topics; alter table public.topics drop constraint topics_content_size; grant select on public.generations to authenticated;`. 0007 nie trzeba cofać; sam sprzątacz wyłącza `select cron.unschedule('cramfox-sweep-generations');`.

**Konfiguracja bez migracji** (`app_config`, tylko serwer; SQL Editor jako właściciel, działa od następnej rezerwacji):
- limit globalny na dobę: `update app_config set value = '50' where key = 'generation_global_daily_cap';` (`0` wstrzymuje tworzenie lekcji wszystkim; zła wartość albo brak wiersza = 30);
- darmowe generacje na zawsze: `update app_config set value = '3' where key = 'free_lifetime_generations';` (dotyczy też istniejących kont; zła wartość albo brak wiersza = 2);
- pula free w limicie globalnym: `update app_config set value = '30' where key = 'free_global_daily_cap';` (domyślnie 20 z 30 — reszta doby zostaje dla pro i kont z trialem; wartość ≥ limitu globalnego = bez osobnej puli; zła wartość albo brak wiersza = 20);
- reset darmowych generacji jednego adresu (tester, wyjątek): `select public.reset_free_generations('adres@example.com');` — unieważnia wiersze (`voided_at`), nie kasuje ich. **Nie kasuj** wierszy `free_generation_ledger` ręcznie: ponowne wgranie 0007/0008 (backfill) dopisałoby je z powrotem;
- start wszystkich kont free od zera (bez liczenia historii): przed wgraniem usuń **oba** wywołania `select public.backfill_free_generation_ledger();` — ostatnią linię sekcji 2d w 0007 i sekcję 0 w 0008 (i nie wołaj go przy wycofaniu);
- ponowne wgranie 0007 nie nadpisuje zmienionych wartości. Ponowne wgranie **0004** przywraca trial dla nowych kont i limit 300 w `increment_usage` — po nim zawsze wgraj ponownie 0007.

**Limity z 0008** (zmiana = nowa migracja): Storage `materials` ≤ 100 nowych plików i ≤ 500 MB na konto w kroczącej dobie (polityka RESTRICTIVE); `materials` ≤ 100 wierszy, `topics` ≤ 50 wierszy na konto na dobę; `subjects` ≤ 200 na konto (bezpiecznik, nie limit planu); `topics.content` < 1 MB (`NOT VALID`); kolumny kosztu, jakości, modelu i tokenów w `generations` niewidoczne dla kluczy użytkowników (klienci czytają tylko `id, status, topic_id, error, created_at` i filtrują po `subject_id`, `material_ids`).

**Monitoring (SQL Editor, tylko odczyt):**
- dzienny koszt: `select * from generation_cost_daily order by day desc limit 14;` (mediana i p90 kosztu: `percentile_cont` na `generations.cost_usd`);
- bucket: `select * from materials_bucket_stats();` — na planie Free (1 GB) reaguj, gdy `bytes` przekroczy ok. 800 MB;
- wiszące generacje: `select count(*) from generations where status = 'running' and created_at < now() - interval '10 minutes';` (powinno być 0 — sprzątacz);
- przed `alter table public.topics validate constraint topics_content_size;` sprawdź `select max(pg_column_size(content)) from topics;` (< 1 000 000).

**Testy migracji lokalnie** (tymczasowy Postgres, nigdy produkcja): `npm run test:db` (wymaga `initdb`/`pg_ctl`/`psql`, np. `brew install postgresql@16`; bez nich test się pomija). Sprawdza m.in. wyścig 12 równoległych sesji o jedną rezerwację, 40 kont naraz przy limicie globalnym 30, pulę free (25 kont free → 20, pro dostaje pozostałe 10), reset darmowych generacji (unieważnienie przeżywa ponowne wgranie 0007/0008), blokadę adresu e-mail, darmowe 2 na zawsze (3. odmowa, usunięcie konta i ponowna rejestracja tym samym adresem, zmiana adresu, dwa konta z tym samym adresem naraz), trial starych kont, zmianę `app_config` bez migracji, limit globalny po usunięciu kont (`generation_ledger`), okno `busy` 5,5 min, limity Storage, uprawnienia kolumn `generations` i funkcje SECURITY DEFINER pod właścicielem bez superusera (jak `postgres` w Supabase).

## 0. Wymagania
- Node 22+, npm 10+, konto GitHub (repo już jest), Supabase, Vercel, Stripe, Anthropic Console, Expo (EAS).

## 1. Supabase (baza, auth, pliki)
1. https://supabase.com → New project (region: `eu-central-1` Frankfurt). Zapisz **hasło DB**.
2. Settings → API: skopiuj `Project URL`, `anon public`, `service_role` (ten drugi TYLKO do API weba).
3. SQL: otwórz SQL Editor → wklej `supabase/migrations/0001_init.sql` → Run.
   Alternatywnie CLI: `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`.
   (Istniejący projekt `zhgxhdsnizujzygpcyfl` ma schemat v1 → wklej `supabase/dev_upgrade_v1_to_v2.sql`.)
4. Authentication → Providers:
   - Email: włącz. „Confirm email” zostaw wg uznania (dla szybkiego startu: wyłącz).
   - Google: utwórz OAuth Client w Google Cloud (typ Web), Authorized redirect URI = `https://<ref>.supabase.co/auth/v1/callback`; wklej Client ID/Secret.
5. Authentication → URL Configuration:
   - Site URL: `https://twoja-domena.pl`
   - Redirect URLs: `https://twoja-domena.pl/auth/callback`, `http://localhost:3000/auth/callback`, `recall://auth/callback`, `exp://**`
6. Storage: bucket `materials` tworzy migracja (prywatny, 50 MB (maksimum darmowego planu Supabase), tylko obrazy/PDF/txt).
7. Settings → API → skopiuj `anon` i `service_role` (do env Vercela, pkt 4).

## 2. Anthropic (AI)
1. https://console.anthropic.com → API Keys → Create key → `ANTHROPIC_API_KEY`.
2. Model domyślny: `claude-opus-5` (zmiana: `RECALL_AI_MODEL`; review: `RECALL_AI_FIX_MODEL`, domyślnie `claude-sonnet-5`). **Koszt:** dawna liczba 0,15–0,40 USD za generację jest według audytu (P1-29) zaniżona ok. dziesięciokrotnie (szacunek $2–3 za 5 zdjęć, $20–35 za 100-stronicowy PDF przed poprawkami z Build 7). Od Build 7 prawdziwy koszt każdej generacji jest w `generations.cost_usd` (widok `generation_cost_daily`) — limity i ceny (decyzja D4) opieraj na tych liczbach. Limity zmienisz w `packages/shared/src/plans.ts`; limity dobowe (20 na konto, 300 na serwer) są w `reserve_generation` (migracja 0007).
3. Bez klucza apka działa w **trybie demo** (generuje przykładowy przedmiot) — dobre do testów UI.

## 3. Stripe (płatności, karty + Apple/Google Pay)
1. https://dashboard.stripe.com → aktywuj konto (dane firmy/JDG, IBAN). Do testów działa tryb testowy.
2. Products → Add product „Recall Pro”: dwie ceny recurring — **29 zł / miesiąc** i **199 zł / rok**. Skopiuj `price_...` → `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`.
3. Settings → Payment methods: karty + Apple Pay / Google Pay. **BLIK i Przelewy24 nie działają w trybie subskrypcji** (tylko płatności jednorazowe) — jeśli chcesz BLIK, trzeba dodać plan „Pro na rok” jako zakup jednorazowy.
4. Settings → Customer portal: włącz (anulowanie, zmiana planu, faktury).
5. Developers → Webhooks → Add endpoint: `https://twoja-domena.pl/api/stripe/webhook`, eventy: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Skopiuj `whsec_...` → `STRIPE_WEBHOOK_SECRET`.
6. Developers → API keys → `sk_live_...` → `STRIPE_SECRET_KEY` (na start `sk_test_...`).
7. Lokalny test webhooka: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## 4. Web na Vercel
1. https://vercel.com → Add New Project → import repo → **Root Directory: `apps/web`**, Framework: Next.js.
2. Build Command: `cd ../.. && npm run web:build` — Install Command: `cd ../.. && npm install`. (Alternatywa: zostaw domyślne i dodaj w `apps/web/package.json` skrypt `prebuild` budujący `@nauka/shared` i `@nauka/ai` — sprawdź README weba.)
3. Environment Variables (Production + Preview):
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
ANTHROPIC_API_KEY, RECALL_AI_MODEL (opcjonalnie), RECALL_AI_FIX_MODEL (opcjonalnie),
TUTOR_ENABLED (NIE ustawiać w Production: bez niej /api/tutor odpowiada 410),
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY,
NEXT_PUBLIC_APP_URL=https://twoja-domena.pl
```
4. Deploy. Podepnij domenę (Settings → Domains). Funkcja `/api/generate` ma `maxDuration = 300` — na planie Hobby Vercel limit to 300 s z Fluid Compute (domyślnie włączone w nowych projektach).
5. Po deployu: zaktualizuj Site URL / Redirect URLs w Supabase i endpoint webhooka w Stripe na produkcyjną domenę.

## 5. Mobile (Expo / EAS)
1. `cd apps/mobile && cp .env.example .env` → uzupełnij `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL=https://twoja-domena.pl`.
2. Dev: `npx expo start` → skanuj w Expo Go.
3. Build: `npm i -g eas-cli && eas login && eas build:configure` → `eas build -p android --profile preview` (APK do testów) / `eas build -p ios --profile production` (wymaga Apple Developer 99 USD/rok). `eas submit` wysyła do sklepów.
4. **Sklepy a płatności:** Apple i Google wymagają zakupów in-app dla subskrypcji cyfrowych. Na TestFlight / beta / web działa Stripe. Przed publicznym releasem w App Store dodaj RevenueCat (`react-native-purchases`) i mapuj zakupy na `profiles.plan` przez webhook RevenueCat → to samo pole co Stripe. Web + PWA (`apps/web`) sprzedaje przez Stripe bez prowizji sklepów — to Twój główny kanał sprzedaży od jutra.

## 6. Prawne minimum (PL)
- Regulamin i polityka prywatności (RODO): szkielety w `apps/web/src/app/regulamin` i `/prywatnosc` — uzupełnij dane firmy, adres, NIP.
- Stripe wystawia faktury/paragony za Ciebie (Customer Portal). Dla JDG rozlicz przychód wg wybranej formy.
- Materiały użytkowników trafiają do Anthropic API (przetwarzanie danych — wpisz w polityce; Anthropic API nie trenuje na danych klientów).

## 7. Checklist „sprzedaję od jutra”
- [ ] Supabase: upgrade SQL v2 + Google OAuth
- [ ] Anthropic key wpisany na Vercel
- [x] Stripe: produkt, 2 ceny, webhook, portal
- [ ] Vercel: env + domena + test płatności testową kartą `4242 4242 4242 4242`
- [ ] Regulamin/prywatność uzupełnione
- [ ] Mobile: `eas build` preview APK dla beta-testerów; App Store po dodaniu IAP
