# Recall — API (apps/web, Next.js route handlers)

Wszystkie endpointy poza webhookiem wymagają nagłówka `Authorization: Bearer <supabase access_token>`.
Błędy: JSON `{ error: string, code?: string }` z odpowiednim statusem (401, 402 limit planu, 400, 500).

## POST /api/generate
Tworzy **temat** w przedmiocie użytkownika. Body:
```json
{ "subjectId": "uuid", "materialIds": ["uuid"], "text": "opcjonalny wklejony tekst",
  "options": { "stage": "liceum", "subjectName": "Biologia", "mode": "materials" | "prompt", "hint": "fotosynteza, klasa 7", "levels": 4, "lang": false, "viz": true } }
```
`mode=materials` wymaga `materialIds.length > 0 || text`; `mode=prompt` wymaga `options.hint`. API sprawdza, że `subjects.owner_id = user`. Limity z `PLANS[plan]` (`maxFileMb` na plik → 400 `file_too_big`, `{ name, maxMb }`) plus łącznie max 150 MB materiałów na jedną generację (→ 400 `too_much_material`, `{ maxMb }`). `materials.size_bytes` zapisuje klient, więc służy tylko do wczesnego odrzucenia — oba limity są sprawdzane ponownie na prawdziwym rozmiarze pobranych plików (pobieranie po 3 pliki naraz, przerwane po przekroczeniu sumy). PDF-y (oraz zdjęcia, gdy razem mają > 15 MB) `@nauka/ai` wgrywa raz na generację do Anthropic Files API (`expires_in_seconds: 3600`), w wywołaniach Messages odwołuje się do nich przez `file_id` i usuwa je po zakończeniu; błąd wgrywania → 500 `code: "api"`. Synchroniczne (`maxDuration = 300`). Wywołuje `generateTopic()` z `@nauka/ai`, wstawia `topics` (position = liczba tematów w przedmiocie, `source` = mode, `generation_id`).
Odpowiedź 200: `{ "generationId": "uuid", "topicId": "uuid", "topic": Topic }`.
402: `{ error, code: "limit_reached", used, limit }`.

**Typy materiałów** (`materials.mime`, `UPLOAD_MIME` w `@nauka/shared/plans`): zdjęcia jpg/png/webp/gif, PDF, txt/md (`AI_MIME`, idą do AI bez zmian) oraz PowerPoint `.pptx` (`PPTX_MIME` = `application/vnd.openxmlformats-officedocument.presentationml.presentation`). Stare `.ppt`, Keynote i Word nie są obsługiwane.
PPTX `@nauka/ai` (`prepareMaterials` → `extractPptx`, bez natywnych zależności, `fflate`) zamienia na materiał tekstowy „Slajd N: tytuł / treść / tabele / SmartArt / Notatki prowadzącego: …” (kolejność z `presentation.xml`, slajdy ukryte pomijane, stopki i numery slajdów pomijane) plus obrazy ze slajdów jako osobne zdjęcia z etykietą „<plik> — slajd N”. Obrazy: tylko png/jpg/gif/webp, 15 kB–5 MB, ≤ 2000 px (wymiary z nagłówka pliku), deduplikacja po SHA-1, obraz na > 40% slajdów (min. 3) to logo/tło i jest pomijany; EMF/WMF/TIFF/SVG pomijane. Łącznie maks. 40 obrazów na generację razem ze zdjęciami (zdjęcia mają pierwszeństwo, obrazy ze slajdów wybierane równomiernie z całej prezentacji); gdy któreś zdjęcie ma > 2000 px — maks. 20. Limity bezpieczeństwa: 3000 elementów ZIP, 200 MB po rozpakowaniu (deklarowane, na prezentację), 5 MB na rozpakowywany element XML, 300 slajdów, 400 tys. znaków tekstu (reszta pomijana z adnotacją). XML czytany liniowym tokenizerem (`indexOf`, bez regexów z cofaniem po całej części), znacznik otwierający max 16 kB. Wspólny budżet wszystkich prezentacji jednej generacji (`PPTX_BUDGET`): 100 MB rozpakowanego XML, 200 mln znaków XML, 30 s parsowania (przekroczenie → 400 `bad_pptx`) oraz 200 MB rozpakowanych obrazów i 80 MB zachowanych obrazów ze slajdów (ponad to dalsze obrazy są pomijane, tekst zostaje). Limit 40 obrazów stosowany już przy rozpakowaniu (każda prezentacja dostaje część tego, co zostało). Gdy wśród materiałów jest prezentacja, prompt prosi o `src_page` = numer slajdu.

**Kolejność** (nic nie jest naliczane, jeśli materiały są złe): walidacja body → przedmiot → limity plików (`too_many_files`, `bad_materials`, `file_too_big`, `too_much_material`) → typ każdego materiału z `UPLOAD_MIME` (inaczej 400 `bad_materials`) → tylko-do-odczytu sprawdzenie limitu (`usage.generations` ≥ limit planu albo ≥ 20 generacji konta w 24 h → 402 `limit_reached`, zanim cokolwiek zostanie pobrane) → pobranie plików z Storage (błąd → 500 `download_failed`; prawdziwy rozmiar → 400 `file_too_big` / `too_much_material`) → rozpakowanie PPTX (błędy 400 poniżej) → budżet tekstu: znaki tekstu prezentacji + plików tekstowych + wklejonego tekstu > 1,5 mln (`MAX_TEXT_CHARS_PER_GENERATION`) → 400 `too_long` → **naliczenie** (`increment_usage`; 402 `limit_reached`, błąd RPC → 500 `reserve_failed`) → wiersz `generations` → `generateTopic()`. Błąd po naliczeniu (AI, zapis) nie zwraca generacji.

| Status | `code` | Kiedy |
|---|---|---|
| 400 | `bad_materials` | typ pliku spoza `UPLOAD_MIME` albo materiał nie należy do użytkownika |
| 400 | `bad_pptx` | plik nie jest czytelnym PPTX (uszkodzony ZIP, to nie prezentacja, przekroczone limity bezpieczeństwa); `name` = plik |
| 400 | `pptx_protected` | prezentacja zabezpieczona hasłem albo stary binarny `.ppt` (nagłówek OLE/CFB) |
| 400 | `pptx_empty` | brak tekstu i użytecznych obrazów na slajdach; `name` = plik (też przy `pptx_protected`) |
| 400 | `file_too_big` / `too_much_material` | prawdziwy rozmiar pliku / wszystkich plików ponad limit (bez naliczenia) |
| 400 | `too_long` | za dużo tekstu na jedną generację (przed naliczeniem); ten sam kod po naliczeniu, gdy AI odrzuci zbyt długi materiał |
| 500 | `download_failed` | nie udało się pobrać pliku z Storage (bez naliczenia) |
| 500 | `reserve_failed` | błąd RPC `increment_usage` (bez naliczenia) |

**Liczba poziomów (`options.levels`).** To liczba typowa, nie sztywna. W trybie `materials` konspekt dobiera liczbę poziomów do objętości materiału: mniej przy krótkim, więcej przy obszernym — najwyżej `levels + 2` (maks. 8), więc domyślne 4 daje do 6 poziomów. W trybie `prompt` limitem jest `levels`. Nadmiar poziomów jest obcinany z ostrzeżeniem w logu. Poziomy generują się równolegle, więc czas prawie się nie zmienia; koszt rośnie z liczbą poziomów. Jeśli generowanie jednego poziomu się nie uda (ucięta albo nieprawidłowa odpowiedź, błąd API), ten poziom jest pomijany, a reszta tematu zostaje zapisana. Odmowa AI, za duży materiał albo niepowodzenie wszystkich poziomów nadal kończą się błędem.

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
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
Mobile (apps/mobile/.env): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL` (URL weba).
