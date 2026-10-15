# Recall — API (apps/web, Next.js route handlers)

Wszystkie endpointy poza webhookiem wymagają nagłówka `Authorization: Bearer <supabase access_token>`.
Błędy: JSON `{ error: string, code?: string, ...extra }` z odpowiednim statusem (401, 402 limit planu, 400, 409 `busy`, 410 `tutor_disabled`, 500). Nowe pola są tylko dodawane (np. `reason`, `tokens`); istniejące kody i kształty się nie zmieniają.

## POST /api/generate
Tworzy **temat** w przedmiocie użytkownika. Body:
```json
{ "subjectId": "uuid", "materialIds": ["uuid"], "text": "opcjonalny wklejony tekst",
  "options": { "stage": "liceum", "subjectName": "Biologia", "mode": "materials" | "prompt", "hint": "fotosynteza, klasa 7", "levels": 4, "lang": false, "viz": true, "aiConsentV": 1 } }
```
`mode=materials` wymaga `materialIds.length > 0 || text`; `mode=prompt` wymaga `options.hint`. `options.aiConsentV` (opcjonalne, liczba całkowita 1–999) to wersja tekstu zgody na AI zaakceptowanej w Cramfoxie (build 7+); trafia tylko do `generations.options`, a zła wartość jest pomijana bez błędu. **`options.levels` jest ignorowane** (AUDYT P1-29): serwer zawsze prosi o 4 poziomy (w trybie `materials` do 6 przy obszernym materiale); pole zostaje w schemacie, żeby stare klienty dalej przechodziły walidację. API sprawdza, że `subjects.owner_id = user`. Limity z `PLANS[plan]` (`maxFileMb` na plik → 400 `file_too_big`, `{ name, maxMb }`) plus łącznie max 150 MB materiałów na jedną generację (→ 400 `too_much_material`, `{ maxMb }`). `materials.size_bytes` zapisuje klient, więc służy tylko do wczesnego odrzucenia — oba limity są sprawdzane ponownie na prawdziwym rozmiarze pobranych plików (pobieranie po 3 pliki naraz, przerwane po przekroczeniu sumy). PDF-y (oraz zdjęcia, gdy razem mają > 15 MB) `@nauka/ai` wgrywa raz na generację do Anthropic Files API (`expires_in_seconds: 7200`) **przed naliczeniem** (wgranie i `count_tokens` są darmowe), w wywołaniach Messages odwołuje się do nich przez `file_id` i usuwa je po zakończeniu (także gdy limit odmówi); błąd wgrywania → 500 `reserve_failed` z `reason: "ai_upload"`, bez naliczenia. Synchroniczne (`maxDuration = 300`). Całą sekwencję prowadzi `handleGenerationRequest()` z `@nauka/ai` (`packages/ai/src/pipeline.ts`); trasa wstrzykuje tylko dostęp do bazy. Temat zapisuje RPC `finish_generation` (position = max(position) + 1 w przedmiocie, czyli liczba tematów, dopóki żadnego nie usunięto; `source` = mode, `generation_id`) w tej samej transakcji co status `done`.
Odpowiedź 200: `{ "generationId": "uuid", "topicId": "uuid", "topic": Topic, "demo": boolean }` (bez zmian).
402: `{ error, code: "limit_reached", used, limit }` (bez zmian, także wartości `used` 999999 / 1999999).

**Typy materiałów** (`materials.mime`, `UPLOAD_MIME` w `@nauka/shared/plans`): zdjęcia jpg/png/webp/gif, PDF, txt/md (`AI_MIME`, idą do AI bez zmian) oraz PowerPoint `.pptx` (`PPTX_MIME` = `application/vnd.openxmlformats-officedocument.presentationml.presentation`). Stare `.ppt`, Keynote i Word nie są obsługiwane.
PPTX `@nauka/ai` (`prepareMaterials` → `extractPptx`, bez natywnych zależności, `fflate`) zamienia na materiał tekstowy „Slajd N: tytuł / treść / tabele / SmartArt / Notatki prowadzącego: …” (kolejność z `presentation.xml`, slajdy ukryte pomijane, stopki i numery slajdów pomijane) plus obrazy ze slajdów jako osobne zdjęcia z etykietą „<plik> — slajd N”. Obrazy: tylko png/jpg/gif/webp, 15 kB–5 MB, ≤ 2000 px (wymiary z nagłówka pliku), deduplikacja po SHA-1, obraz na > 40% slajdów (min. 3) to logo/tło i jest pomijany; EMF/WMF/TIFF/SVG pomijane. Łącznie maks. 40 obrazów na generację razem ze zdjęciami (zdjęcia mają pierwszeństwo, obrazy ze slajdów wybierane równomiernie z całej prezentacji); gdy któreś zdjęcie ma > 2000 px — maks. 20. Limity bezpieczeństwa: 3000 elementów ZIP, 200 MB po rozpakowaniu (deklarowane, na prezentację), 5 MB na rozpakowywany element XML, 300 slajdów, 400 tys. znaków tekstu (reszta pomijana z adnotacją). XML czytany liniowym tokenizerem (`indexOf`, bez regexów z cofaniem po całej części), znacznik otwierający max 16 kB. Wspólny budżet wszystkich prezentacji jednej generacji (`PPTX_BUDGET`): 100 MB rozpakowanego XML, 200 mln znaków XML, 30 s parsowania (przekroczenie → 400 `bad_pptx`) oraz 200 MB rozpakowanych obrazów i 80 MB zachowanych obrazów ze slajdów (ponad to dalsze obrazy są pomijane, tekst zostaje). Limit 40 obrazów stosowany już przy rozpakowaniu (każda prezentacja dostaje część tego, co zostało). Gdy wśród materiałów jest prezentacja, prompt prosi o `src_page` = numer slajdu.

**Kolejność** (nic nie jest naliczane, jeśli materiały są złe albo nie da się zacząć): walidacja body → przedmiot → limity plików (`too_many_files`, `bad_materials`, `file_too_big`, `too_much_material`) → typ każdego materiału z `UPLOAD_MIME` (inaczej 400 `bad_materials`) → tylko-do-odczytu sprawdzenie limitu (`usage.generations` ≥ limit planu albo ≥ 20 generacji konta w 24 h → 402 `limit_reached`; trwająca generacja konta → 409 `busy`; zanim cokolwiek zostanie pobrane) → pobranie plików z Storage (błąd → 500 `download_failed`; prawdziwy rozmiar → 400 `file_too_big` / `too_much_material`) → rozpakowanie PPTX (błędy 400 poniżej) → budżet tekstu: znaki tekstu prezentacji + plików tekstowych + wklejonego tekstu > 1,5 mln (`MAX_TEXT_CHARS_PER_GENERATION`) → 400 `too_long` → **przygotowanie dla AI**: wgranie PDF-ów (i dużych zestawów zdjęć) do Files API i policzenie promptu (`count_tokens`, tylko gdy są pliki; sam wklejony tekst ma limit 200 tys. znaków) → powyżej `MAX_INPUT_TOKENS` = 150 000 tokenów 400 `too_long` z `tokens`, `maxTokens` → **naliczenie**, tylko w ciągu 75 s od startu żądania (`CHARGE_BY_MS`, sprawdzane przed wgraniem do Files API i drugi raz tuż przed naliczeniem; później → 500 `download_failed` z `reason: "slow_intake"` bez naliczenia — Cramfox uznaje brak wiersza po 90 s za „generowanie nie ruszyło”): RPC `reserve_generation` (backend/0007) w jednej transakcji z blokadami doradczymi konta i serwera: `busy` → limit dzienny 20 → globalny 300 (większa z liczb: wiersze `generations` z doby albo `generation_ledger` — licznik bez powiązania z kontem, więc usuwanie kont go nie zeruje) → miesięczny planu, wszystkie sprawdzane **przed** podbiciem licznika; potem wiersz `generations` (`running`), wpis w `generation_ledger` i `usage + 1` (odmowa niczego nie zmienia) → AI → RPC `finish_generation` (temat + `done` + koszt w jednej transakcji). Gdy `finish_generation` się zatwierdzi, a zginie tylko jego odpowiedź, trasa sprawdza wiersz `generations` i odpowiada 200 z tematem (zamiast 500 dla opłaconej lekcji). Sprzątanie Files API i oznaczanie porażki dostają tylko czas do startu + 285 s (`RESPOND_BY_MS`), żeby JSON zawsze wyszedł przed 300 s. Błąd po naliczeniu (AI, zapis) nie zwraca generacji (zwroty czekają na decyzję D4, AUDYT P1-33); wiersz dostaje `failed`, błąd i koszt tego, co zużyto.

**Termin (AUDYT P1-4).** Każde wywołanie AI (Files API, `count_tokens`, plan, poziomy, review) dostaje ten sam `AbortSignal`, który odpala się o starcie żądania + 270 s (`GENERATION_DEADLINE_MS`), i `maxRetries` 1, gdy do terminu zostało > 120 s, inaczej 0. Poziom przerwany terminem jest pomijany jak inny nieudany poziom (gotowe poziomy zostają, review dostaje tylko pozostały czas); gdy nie zostało nic, odpowiedź to 500 `lost` z `reason: "ai_timeout"` i `generationId`. Kod celowo **nie** jest `timeout` (klient pokazałby „Materiał nie został wysłany”, co po naliczeniu jest nieprawdą). Jeśli pobieranie, rozpakowanie, wgranie do Files API albo `count_tokens` trwały dłużej niż 75 s od startu żądania (zostało < 195 s = `MIN_AI_TIME_MS`), serwer kończy przed naliczeniem: 500 `download_failed` z `reason: "slow_intake"` (sprawdzane przed wgraniem i tuż przed naliczeniem). Wiersze `queued`/`running` starsze niż 8 min zamyka sprzątacz w pg_cron (`cramfox-sweep-generations`, co 5 min) jako `failed`.

**Pamięć podręczna promptu (AUDYT P1-2).** Wywołanie planu nie ma `cache_control` (inny format wyjścia, nikt nie czyta jego wpisu). Poziom 1 startuje pierwszy; pozostałe poziomy startują, gdy oba wywołania poziomu 1 (rdzeń i zadania) zaczną strumieniować (wpis w cache jest wtedy czytelny), najdłużej po `WARM_UP_CAP_MS` = 30 s. Wejście spada z ok. 13–16× do ok. 4,5× prefiksu z materiałem. Gdy poziom 1 od razu padnie z błędem kończącym generację (odmowa, za długi materiał), pozostałe poziomy w ogóle nie startują.

**Koszt (AUDYT P1-3).** Kolumny `generations` (backend/0007): `opus_input`, `opus_cache_write`, `opus_cache_read`, `opus_output` (model generujący: plan i poziomy), `review_input`, `review_output`, `cost_usd numeric(8,4)` i `quality jsonb` (statystyki jakości, `warmupMs`, `durationMs`, `inputTokensCounted`, `calls`, `partialCalls`, przy błędzie `failedPhase`). Koszt liczy `@nauka/ai` (`cost.ts`, tabela `MODEL_PRICES`) według modelu, który faktycznie odpowiedział (przy server-side fallback z `usage.iterations`). Wywołania przerwane terminem są liczone z ostatniego stanu strumienia. Zapisywane także przy `failed`. Stare `input_tokens` / `output_tokens` dalej są wypełniane (suma wszystkich tokenów). Dzienne sumy: widok `generation_cost_daily` (tylko service role / SQL Editor).

| Status | `code` | Kiedy | Naliczone? |
|---|---|---|---|
| 400 | `bad_materials` | typ pliku spoza `UPLOAD_MIME` albo materiał nie należy do użytkownika | nie |
| 400 | `bad_pptx` | plik nie jest czytelnym PPTX (uszkodzony ZIP, to nie prezentacja, przekroczone limity bezpieczeństwa); `name` = plik | nie |
| 400 | `pptx_protected` | prezentacja zabezpieczona hasłem albo stary binarny `.ppt` (nagłówek OLE/CFB) | nie |
| 400 | `pptx_empty` | brak tekstu i użytecznych obrazów na slajdach; `name` = plik (też przy `pptx_protected`) | nie |
| 400 | `file_too_big` / `too_much_material` | prawdziwy rozmiar pliku / wszystkich plików ponad limit | nie |
| 400 | `too_long` | za dużo tekstu (znaki) albo za dużo tokenów (`count_tokens` > 150 000, wtedy `tokens`, `maxTokens`), bez `generationId`; ten sam kod z `generationId`, gdy AI odrzuci zbyt długi materiał już po naliczeniu | bez `generationId`: nie |
| 402 | `limit_reached` | `used` = liczba w miesiącu (limit planu), `999999` (20 na konto w 24 h), `1999999` (300 na serwer w 24 h) | nie |
| 409 | `busy` | **nowy.** Konto ma już generację `queued`/`running` młodszą niż 5,5 min (330 s — tyle, ile czeka Cramfox przed werdyktem `lost`; żądanie żyje najwyżej 300 s; sprawdzane w pre-checku i w RPC) | nie |
| 500 | `download_failed` | nie udało się pobrać pliku z Storage albo odczytać wierszy `materials`; z `reason: "slow_intake"`, gdy przygotowanie trwało za długo | nie |
| 500 | `reserve_failed` | błąd RPC `reserve_generation`; z `reason: "ai_upload"`, gdy nie udało się wgrać materiałów do Files API (to też dzieje się teraz przed naliczeniem) | nie |
| 500 | `refusal` / `invalid_output` / `api` / `generation_failed` | błąd AI albo zapisu po naliczeniu, z `generationId`; przy błędzie zapisu tekst jest ogólny („Nie udało się zapisać lekcji.”), szczegóły tylko w `generations.error` | tak |
| 500 | `lost` + `reason: "ai_timeout"` | **nowa przyczyna.** Wewnętrzny termin 270 s minął po naliczeniu, z `generationId` | tak |
| 410 | `tutor_disabled` | **nowy**, `/api/tutor` w produkcji bez `TUTOR_ENABLED=1` | — |

**Mapowanie dla klienta (Cramfox).** Build 6 obsługuje to bez zmian: `busy` → „Coś poszło nie tak / Spróbuj ponownie” (ogólny 4xx); `lost` → „Generowanie się nie dokończyło … liczy się do limitu” (prawda); `reserve_failed` i `download_failed` → „… Limit się nie zmienił” (prawda); `too_long` bez `generationId` → „… Limit się nie zmienił” (prawda). Build 7 może dodać: `busy` → „Tworzę już inną lekcję — poczekaj, aż skończę” (+ przejście do ekranu postępu); `lost` z `reason: "ai_timeout"` → „Tworzenie lekcji trwało za długo … Spróbuj z mniejszą ilością materiału” (+ limit); `too_long` z `tokens` → „Materiał ma ok. N stron tekstu za dużo na jedną lekcję — podziel go”; `reserve_failed` z `reason: "ai_upload"` → „Serwer AI chwilowo nie przyjmuje plików”. Odrzucenia z limitów konta (backend/0008): wysyłka do Storage → 403/400 „new row violates row-level security policy” (dzienny limit 100 plików / 500 MB), zapis do `subjects` / `materials` → PostgREST 400 z kodem `23514` i komunikatem `subject_limit` / `materials_daily_limit`; build 6 pokazuje wtedy ogólny błąd wysyłki.

**Liczba poziomów.** Serwer używa zawsze `levels = 4` (`GENERATION_LEVELS`; wartość z żądania jest ignorowana). To liczba typowa, nie sztywna. W trybie `materials` konspekt dobiera liczbę poziomów do objętości materiału: mniej przy krótkim, więcej przy obszernym — najwyżej `levels + 2`, czyli 6. W trybie `prompt` limitem jest 4. Nadmiar poziomów jest obcinany z ostrzeżeniem w logu. Poziomy generują się równolegle, więc czas prawie się nie zmienia; koszt rośnie z liczbą poziomów. Jeśli generowanie jednego poziomu się nie uda (ucięta albo nieprawidłowa odpowiedź, błąd API, termin 270 s), ten poziom jest pomijany, a reszta tematu zostaje zapisana. Odmowa AI, za duży materiał albo niepowodzenie wszystkich poziomów nadal kończą się błędem.

**Kontrola jakości.** Konspekt wypisuje w `scope` każdego poziomu punkty kluczowe z całego materiału. Każdy poziom dostaje swoje punkty i zakresy pozostałych poziomów. Przegląd (Sonnet, jedno wywołanie na poziom) poprawia pytania quizu i wyjaśnienia `e`, a zadaniom wystawia tylko werdykt zostaw/usuń, przy czym na poziomie zostają co najmniej 2 zadania. Przed zapisem kod usuwa jeszcze typowe podpowiedzi w zadaniach i odwołania do liter opcji w `e`, a także czyści `real`, jeśli tylko powtarza `body`. Pokrycie punktów kluczowych trafia do logu jako `[generate] coverage {...}`.

**Wizualizacje dawek (`options.viz`).** Opcjonalne; wysyła je tylko klient, który umie je wyświetlić (Cramfox). Bez `options.viz: true` prompt i gramatyka są bajt w bajt takie jak przed wizualizacjami, a odpowiedź nie zawiera pola `viz`. Z `options.viz: true` każda dawka (`levels[].feed[]`) może mieć opcjonalne pole `viz` — unia po `type` (każda gałąź może mieć `caption` ≤ 120 znaków):

| `type` | Pola |
|---|---|
| `timeline` | `items: [{ when ≤ 24, label ≤ 80 }]` × 3–7 |
| `compare` | `a ≤ 40`, `b ≤ 40`, `rows: [{ k ≤ 40, a ≤ 80, b ≤ 80 }]` × 2–5 |
| `cycle` | `steps: string ≤ 60` × 3–6 |
| `flow` | `kind: "cause" \| "process"`, `steps: string ≤ 60` × 2–6 |
| `tree` | `root ≤ 60`, `groups: [{ name ≤ 40, items: string ≤ 50 × 1–5 }]` × 2–4 |
| `bars` | `unit ≤ 12` (może być ""), `items: [{ label ≤ 40, value: liczba skończona ≥ 0 }]` × 2–7 |
| `numbers` | `items: [{ value ≤ 16, label ≤ 80 }]` × 1–4 |

Teksty są zwykłym tekstem (bez HTML i emoji), ale klient i tak musi je escapować. Serwer (`parseViz`) przycina teksty do limitów, waliduje (`VizSchema`), sprawdza ugruntowanie (etykiety w tekście poziomu, liczby i daty w `body`/`real` tej dawki) i zostawia najwyżej ceil(liczba dawek / 2) wizualizacji na poziom; reszta jest odrzucana bez błędu. Statystyki trafiają do logu jako jedna linia `[generate] viz {"kept",…,"schema","grounding","cap","cleared","doses"}`. Starsze tematy i klienci bez obsługi `viz` działają bez zmian (pole jest opcjonalne; `vizText()` daje wersję tekstową, której używa m.in. korepetytor).
Gdy brak `ANTHROPIC_API_KEY` → tryb demo (przykładowy temat, `tagline` „DEMO”).

## GET /api/generate?id=<generationId>
Status joba: `{ status, topicId?, error? }`.

## POST /api/tutor
**Wyłączony w produkcji** (AUDYT P1-1): w buildzie produkcyjnym (`NODE_ENV=production`, czyli Vercel Production i Preview oraz `next start`) odpowiada 410 `{ error, code: "tutor_disabled" }` przed jakimkolwiek innym sprawdzeniem, chyba że ustawiono `TUTOR_ENABLED=1`. `next dev` ma go włączonego. Cramfox go nie używa; stary web (Recall) dostanie 410.
Body: `{ "topicId": "uuid", "levelId": "l1", "question": "…", "history": [{ "role": "user"|"assistant", "content": "…" }] }`
Odpowiedź: `text/plain` streamowany (chunked). Limit: 30 wiadomości/dzień free (liczone w `usage.tutor_messages`), Pro bez limitu.

## POST /api/stripe/checkout
Body: `{ "interval": "month" | "year", "platform": "web" | "mobile" }` → `{ "url": "https://checkout.stripe.com/..." }`
Tworzy/odczytuje `stripe_customer_id`, Checkout Session (mode=subscription, metody z ustawień Stripe — karta, Link, Apple/Google Pay; BLIK nie obsługuje subskrypcji, locale pl). success_url: web → `/app?upgraded=1`, mobile → `/billing/success` (strona mówi „wróć do apki”).

## POST /api/stripe/portal
→ `{ "url" }` (Stripe Customer Portal).

## POST /api/stripe/webhook
Stripe → weryfikacja podpisu `STRIPE_WEBHOOK_SECRET`. Obsługa: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_failed`. Ustawia `profiles.plan` (pro gdy status in active/trialing, inaczej free) i `subscriptions`.

## GET /api/me
→ `{ profile, plan, usage: { month, generations, tutorMessages }, limits: PLANS[plan], subscription }`.

## Dane bezpośrednio przez Supabase (RLS)
- `subjects` (kontenery), `topics` (treść), `progress`, `srs_cards`, `user_meta`, `activity`, `materials`: tylko własne (`owner_id`/`user_id = auth.uid()`).
- `quests_daily`, `achievements`: tylko własne.
- RPC: `log_activity(p_xp int, p_minutes int, p_day date)`, `my_total_xp()`, `weekly_leaderboard(p_limit int)` → `(rank, display_name, xp, is_me)`, `my_weekly_rank()` → `(rank, xp, total)` (dwa ostatnie: `security definer`, tylko dla `authenticated`).
- Storage `materials/{uid}/...`: tylko własne.

## Env (apps/web/.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=            # brak = tryb demo
RECALL_AI_MODEL=claude-opus-5   # (alias: NAUKA_AI_MODEL)  # opcjonalnie
RECALL_AI_FIX_MODEL=claude-sonnet-5  # model review; opcjonalnie
TUTOR_ENABLED=                # 1 = /api/tutor działa w produkcji (domyślnie 410)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
Mobile (apps/mobile/.env): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL` (URL weba).
