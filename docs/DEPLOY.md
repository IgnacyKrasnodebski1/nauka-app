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
6. Storage: bucket `materials` tworzy migracja (prywatny, 25 MB, tylko obrazy/PDF/txt).
7. Settings → API → skopiuj `anon` i `service_role` (do env Vercela, pkt 4).

## 2. Anthropic (AI)
1. https://console.anthropic.com → API Keys → Create key → `ANTHROPIC_API_KEY`.
2. Model domyślny: `claude-opus-5` (zmiana: `RECALL_AI_MODEL`). Koszt orientacyjny jednej generacji (5 zdjęć, 4 poziomy): ok. 0,15–0,40 USD. Plan Pro za 29 zł/mies. z limitem 150 generacji jest bezpieczny przy typowym użyciu (kilka–kilkanaście generacji/mies.); limity zmienisz w `packages/shared/src/plans.ts`.
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
ANTHROPIC_API_KEY, RECALL_AI_MODEL (opcjonalnie),
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
