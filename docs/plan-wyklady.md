# PLAN: schematy w czacie, PPTX i nagrywanie wykładów (Etap 2)

> **To jest PLAN, nie opis działającego kodu.** Stan na 2026-10-14:
> - **Etap 1a (schematy) i 1b (PPTX)** są zaimplementowane w niezacommitowanych drzewach roboczych (apka i backend), ale wdrożenie na produkcję i migracja `0006_pptx.sql` są **niepotwierdzone**.
> - **Etap 2 (nagrywanie wykładów)** nie jest rozpoczęty: nie ma kodu wykładów ani `CfRecorder` (jedyne „lectures” to komentarz w `packages/shared/src/prompts.ts:79`), a skrypt spike'a `scripts/stt-spike.mjs` też jeszcze nie istnieje.
>
> Źródło: przegląd planu z 29 poprawkami (C1–C29) i plan poprawiony, zapisane w scratchpadzie sesji (`plan_lecture.md`). Ten plik to polskie, skrócone tłumaczenie z zachowaniem wszystkich decyzji, kontraktów, limitów, kosztów i kroków dla właściciela. Część obserwacji z przeglądu („tylko `ACCEPTED_MIME`”, „błąd z nieznanym MIME po pobraniu limitu”) opisuje stan sprzed implementacji Etapu 1 i może być już nieaktualna w drzewie roboczym; na produkcji: do sprawdzenia.
>
> Kontekst całego systemu: [`docs/BIBLIA.md`](BIBLIA.md).

## Spis treści

0. [Decyzje](#0-decyzje)
1. [Co musi zrobić właściciel](#1-co-musi-zrobić-właściciel)
2. [Kontrakty danych](#2-kontrakty-danych)
3. [Endpointy](#3-endpointy)
4. [Przebieg nagrania od początku do końca](#4-przebieg-nagrania-od-początku-do-końca)
5. [Migracje](#5-migracje)
6. [Pliki backendu](#6-pliki-backendu)
7. [iOS (natywnie)](#7-ios-natywnie)
8. [Klient](#8-klient)
9. [Czyszczenie danych (sanityzacja)](#9-czyszczenie-danych-sanityzacja)
10. [Limity, koszt, komunikaty](#10-limity-koszt-komunikaty)
11. [Testy](#11-testy)
12. [Kolejność wdrażania](#12-kolejność-wdrażania)
13. [Otwarte ryzyka](#13-otwarte-ryzyka)
14. [Poprawki z przeglądu (C1–C29)](#14-poprawki-z-przeglądu-c1c29)
15. [Fakty sprawdzone w przeglądzie](#15-fakty-sprawdzone-w-przeglądzie)

---

## 0. Decyzje

**W skrócie:** Nagranie wykładu robi natywny plugin na iPhonie, plik idzie do Supabase, a serwer zleca transkrypcję w ElevenLabs. Z transkryptu powstaje najpierw notatka, potem zwykły temat z poziomami. Serwer sam sprawdza długość nagrania i nie ufa liczbom z telefonu.

| Temat | Decyzja |
|---|---|
| Rozpoznawanie mowy (STT) | ElevenLabs Scribe v2 za interfejsem `SttProvider`; Soniox jako zapas |
| Pobieranie transkryptu | **Tryb A** (domyślny, jeśli spike pokaże `transcription_id` w odpowiedzi 202): `webhook=true` + odpytywanie GET. **Tryb B** (gdy brak id albo odpytywanie nie działa, a synchroniczna transkrypcja 120 min trwa ok. 240 s lub krócej): synchroniczny `convert` w `after()`. **W przeciwnym razie:** Soniox. Wybiera spike. |
| Wejście audio | `source_url` = podpisany URL Supabase ważny **1 h**, nigdy nie logowany |
| Kontrola długości | **sonda serwera**: prawdziwy rozmiar ze Storage i nagłówek MP4 `mvhd`; nigdy liczby z klienta |
| Generowanie | dwie fazy (`note`, potem `topic`), każda w osobnym wywołaniu funkcji z własnym CAS (porównaj i zamień). Uruchamia je odpytywanie, webhook albo sweep z pg_cron. Klient nigdy sam nie startuje generowania. |
| Pobieranie limitu | jedna generacja przy `POST /api/lecture`; zwrot, gdy STT padnie przed jakimkolwiek wywołaniem LLM; jedno darmowe ponowienie po `lost` |
| Sprzątanie w tle | pg_cron co 5 min woła `/api/cron/lecture-sweep` przez `pg_net` z `CRON_SECRET` z Vault |
| Schematy | włączane przez `options.viz === true`, wysyłane tylko przez nowego klienta |
| Nagrywarka | `Capacitor.Plugins.CfRecorder`: segmenty 300 s, AAC-LC mono 16 kHz / 32 kbps (zapas 22,05 kHz), maks. 120 min |
| Retencja | transkrypt w ElevenLabs kasowany zaraz po pobraniu; nasze audio kasowane przy statusie `transcribed`; nasz transkrypt zostaje na koncie |
| Migracje | `0006_pptx.sql` (Etap 1b) i `0007_lectures.sql` (Etap 2b) |

---

## 1. Co musi zrobić właściciel

**W skrócie:** Przed kodowaniem Etapu 2 trzeba założyć i skonfigurować ElevenLabs, zrobić tani test (spike) na 2–3 prawdziwych wykładach i przygotować zmienne środowiskowe. Po stronie Apple dochodzą: tryb audio w tle, opis mikrofonu, etykieta prywatności i aktualizacja polityki prywatności.

### Etap 1
**Kolejność: najpierw backend, potem 0006, na końcu build 6.** Zacommitowany backend (`512e5c8`) pobiera limit przed pobraniem plików (`route.ts:72` w tym commicie) i dopiero potem rzuca błąd przy nieznanym MIME (`materials.ts:30`). Gdyby 0006 weszła przed nowym backendem, PPTX przeszedłby przez Storage, a stary backend zjadłby limit i padł. Bez 0006 bucket odrzuca PPTX już przy wysyłce, więc nikt nie traci limitu.

1. Wdrożyć backend (procedura bez gita: `docs/BIBLIA.md`, sekcja 9.2).
2. Wgrać `backend/0006_pptx.sql` (CLI z Homebrew wprost, nie przez `npx`; wymaga `supabase login`):

   ```bash
   cd /Users/ignacykrasnodebski/nauka-app
   supabase db query --linked -f backend/0006_pptx.sql
   ```

3. Wysłać build 6 do TestFlight.

### Etap 2
1. **ElevenLabs:**
   - konto z rozliczeniem za użycie i **miesięcznym limitem wydatków**;
   - klucz API ograniczony do Speech to Text;
   - webhook STT na `https://nauka-jet.vercel.app/api/lecture/webhook`; skopiować jego sekret;
   - podpisać DPA (umowę powierzenia danych).
2. **Spike** (`scripts/stt-spike.mjs`, koszt poniżej $1, 2–3 prawdziwe wykłady). **Skryptu jeszcze nie ma** w żadnym z katalogów; trzeba go napisać, zanim właściciel go uruchomi. Zapisać odpowiedzi:
   - (a) czy odpowiedź 202 zawiera `transcription_id`;
   - (b) co zwraca GET, gdy zadanie jeszcze trwa;
   - (c) ile trwa synchroniczny `convert` dla 60 i 120 min;
   - (d) kształt i rozmiar treści webhooka;
   - (e) czy DELETE działa;
   - (f) jak szybko po zleceniu ElevenLabs pobiera `source_url`;
   - (g) czy można pominąć `timestamps_granularity`;
   - (h) jakość polskiego przy terminach łacińskich i angielskich;
   - (i) kody błędów dla ciszy i uszkodzonego audio.

   Odpowiedzi rozstrzygają tryb A albo B (sekcja 0).
3. **Zmienne na Vercelu** (tylko nazwy i wartości niejawne; sekrety wpisuje się w panelu):
   - `STT_PROVIDER=elevenlabs`
   - `ELEVENLABS_API_KEY` (sekret)
   - `ELEVENLABS_WEBHOOK_SECRET` (sekret)
   - `ELEVENLABS_BASE_URL=https://api.elevenlabs.io`
   - `STT_MODE` = `webhook` albo `sync`
   - `LECTURE_MAX_MIN=120`, `LECTURE_DAY_MIN=240`, `LECTURE_MONTH_MIN=900`, `LECTURE_GLOBAL_DAY_MIN=6000` (SQL nie czyta zmiennych Vercela, więc trasa musi przekazać te limity do RPC `start_lecture` jako parametry)
   - `RECALL_AI_NOTE_MODEL=claude-sonnet-5`
   - `LECTURE_TOPIC_MAX_TOKENS=24000`
   - `CRON_SECRET` (sekret)
   - na Vercel Pro: `maxDuration` tras wykładów podnieść do 800 (w `route.ts` i w `apps/web/vercel.json`).
4. **Wgrać `backend/0007_lectures.sql`.** Wcześniej wpisać `CRON_SECRET` do Supabase Vault pod ustaloną nazwą (migracja czyta go stamtąd dla pg_cron); migracja musi też włączyć rozszerzenie `pg_net`.
5. **Xcode:**
   - Signing & Capabilities → Background Modes → Audio;
   - dodać nowe pliki Swift do targetu App;
   - usunąć `UISceneStoryboardFile` i `UIMainStoryboardFile` z `Info.plist`;
   - dodać `NSMicrophoneUsageDescription`.
6. **App Store Connect:**
   - App Privacy: „Audio Data” (powiązane z użytkownikiem, funkcjonalność apki);
   - notatka dla recenzji o nagrywaniu przy zablokowanym ekranie;
   - ujawnienie AI firm trzecich (5.1.2(i)).
7. **Polityka prywatności:**
   - ElevenLabs jako podmiot przetwarzający, dane do USA na podstawie DPA/SCC;
   - nasze audio kasowane po transkrypcji, transkrypt w ElevenLabs kasowany zaraz po pobraniu;
   - transkrypt zostaje na koncie, dopóki użytkownik go nie usunie;
   - zgoda prowadzącego na nagranie to odpowiedzialność użytkownika.

---

## 2. Kontrakty danych

Pakiet `packages/shared` w backendzie.

### Schematy (Etap 1a)

Pola w gramatyce (tylko gdy `options.viz`) dla każdej dawki `GenFeed`:
- `viz_type`: `"none"`, `"timeline"`, `"compare"`, `"cycle"`, `"flow"`, `"tree"`, `"bars"`, `"numbers"`;
- `viz`: tekst JSON (`""`, gdy brak).

Zapisany `VizSchema` to unia rozróżniana po `type`. **Każda gałąź ma `caption?` (≤120).**

| Typ | Kształt |
|---|---|
| `timeline` | `{when, label}` ×3–7 |
| `compare` | `{a, b, rows: {k, a, b} ×2–5}` |
| `cycle` | `steps` ×3–6 |
| `flow` | `{kind: cause albo process, steps ×2–6}` |
| `tree` | `{root, groups ×2–4 {name, items ×1–5}}` |
| `bars` | `{unit ≤12, items ×2–7 {label, value: skończona liczba ≥0}}` |
| `numbers` | `{value ≤16, label}` ×1–4 |

`FeedItemSchema.viz` jest opcjonalne. `GenerationOptionsSchema` dostaje `viz?: boolean` (zrobione w Etapie 1a, `schema.ts:486–496`) i `source?: "materials" | "lecture"` (**jeszcze nie ma**; dochodzi w Etapie 2).

### Notatka (Etap 2)

- `LectureNoteGenSchema` i `LectureNoteSchema`, `durationSec` 0..7500.
- `TopicContentSchema` dostaje `note?` i `origin?: {kind:"lecture", lectureId, durationSec}`.
- `LectureStatus`: `uploaded`, `transcribing`, `transcribed`, `noting`, `generating`, `done`, `failed`. `lost` **nie jest statusem**, tylko kodem (`code`) przy statusie `failed`.

### Typy plików (`plans.ts`)

| Nazwa | Zawartość |
|---|---|
| `AI_MIME` | dotychczasowe typy (zdjęcia, PDF, tekst, markdown) |
| `PPTX_MIME` | typ PPTX |
| `AUDIO_MIME` | `audio/mp4`, `audio/x-m4a`, `audio/m4a`, `audio/aac` (bez `audio/mpeg`, bo sonda czyta tylko MP4) |
| `UPLOAD_MIME` | suma powyższych |

Plus `isAiMime`, `isPptx`, `isAudioMime`.

---

## 3. Endpointy

Wszystkie z Bearer auth. Błędy jako `{error, code, …}`.

**`maxDuration` ustawia się per plik trasy, nie per metoda.** POST i GET `/api/lecture` są w jednym `api/lecture/route.ts`, więc mają wspólny limit: **300 s dla całej trasy** (800 na Pro), w `route.ts` i w `apps/web/vercel.json`. Dotyczy to też trybu B: praca w `after()` jest ograniczona tym samym `maxDuration` funkcji, więc przy 60 s `syncTranscribe` (do 280 s) zostałby ucięty.

### `POST /api/lecture` (`maxDuration` 300, na Pro 800)

Treść: `{clientId, subjectId, materialId, slideIds (≤ filesPerGeneration − 1), durationSec 30..7200, recordedAt?, options:{stage, subjectName?, hint?, viz?}}`.

Kroki, po kolei:
1. sprawdzenie właściciela przez RLS i prefiksu ścieżki `uid/`;
2. typy MIME;
3. prawdziwy rozmiar ze `storage.objects`, ≤40 MB;
4. podpisany URL (1 h), potem sonda MP4;
5. RPC `start_lecture(probedSec, limity minut z env)`;
6. czyszczenie keyterms;
7. zlecenie (tryb A) albo `after(syncTranscribe)` (tryb B);
8. zapis `provider_job_id`.

Odpowiedzi: `202` (nowe) albo `200` (ten sam `clientId`, idempotentnie).

| Status | Kod | Dodatkowo |
|---|---|---|
| 400 | `bad_request` | |
| 400 | `bad_audio_type` | |
| 400 | `bad_materials` | |
| 400 | `audio_too_long` | `{maxMin}` |
| 400 | `file_too_big` | |
| 404 | `not_found` | |
| 402 | `limit_reached` | |
| 402 | `lecture_limit` | `{scope, limitMin}`, scope: day, month albo server |
| 503 | `stt_unavailable` / `no_config` | |
| 502 | `stt_failed` | limit już zwrócony |

### `GET /api/lecture?id=` (ten sam plik trasy, więc ten sam `maxDuration`)

- Czyta przez RLS.
- Zwraca `{lectureId, status, durationSec, note?, topicId?, topic?, code?, error?}`.
- Efekty uboczne przez `advanceLecture`, ograniczone CAS na `polled_at` (co najmniej co 20 s).

### `POST /api/lecture/webhook`

- Surowa treść; HMAC z `t.body` porównywany w stałym czasie; `t` nie starszy niż 30 min.
- Szuka wykładu po `provider_job_id`.
- Zawsze 200 (401 przy złym podpisie), potem `after(advanceLecture)`.

### `POST /api/cron/lecture-sweep` (Bearer `CRON_SECRET`, pg_cron co 5 min)

- Popycha zawieszone wykłady w stanach `transcribing`, `transcribed`, `noting`.
- Wykłady w stanie `generating` starsze niż 330 s (na Pro 830 s) dostają status `failed` z kodem `lost`.
- Ponawia `provider.remove`.
- Kasuje audio (obiekt i wiersz `materials`) wykładów po `transcribed`.
- Kasuje osierocone audio starsze niż 48 h.

### `POST /api/generate` (zmiana)

- Nowe pole `lectureId?`: transkrypt ładowany na serwerze, reguła „pliki albo tekst” pomijana.
- Sprawdzenie właściciela. `409 lecture_state`, chyba że wykład jest `failed` albo `transcribed`.
- Po `lost`: jedno darmowe ponowne użycie wiersza `generations`.
- Odpowiedź dostaje `note?`.

---

## 4. Przebieg nagrania od początku do końca

1. **Nagrywanie.**
   - Szybkie dodawanie „Nagraj wykład” → **zgoda v2** (wymagana nawet po zaakceptowaniu v1) → uprawnienie do mikrofonu → widok `cfrec`.
   - `CfRecorder.start({maxSeconds:7200, segmentSeconds:300, clientId})`. Ekran można zablokować.
   - Toast przy 115 min, automatyczny stop przy 120.
   - **Pauza** dezaktywuje sesję audio.
2. **Stop.**
   - `stop()` skleja segmenty eksportem passthrough (`shouldOptimizeForNetworkUse=true`).
   - Sesja audio dezaktywowana, poprzednia kategoria przywrócona.
   - Potem `cfadd` w trybie wykładu, z „+ Prezentacja” i „+ Zdjęcie tablicy”.
3. **Wysyłka.**
   - Utworzenie przedmiotu, jeśli trzeba.
   - Audio **zawsze przez TUS** (`fileSource` z Range, koniec przycięty), z postępem.
   - Wysyłka slajdów.
   - `CfRecorder.markUploaded({id, materialId})`.
   - Zapis `cf_lecture:<uid> = {clientId, materialId, subjectId, phase:'posting'}`.
4. **`POST /api/lecture`.**
   - 2xx: zapis `lectureId`, `CfRecorder.discard`, `cfgen` (kroki wykładu).
   - Błąd sieci: dziennik zostaje; stuknięcie użytkownika ponawia POST z tym samym `clientId`, bez ponownej wysyłki pliku.
5. **Transkrypcja.**
   - Tryb A: odpytywanie (co 5 s na pierwszym planie i przy `visibilitychange`), webhook albo sweep pobiera transkrypt.
   - Tryb B: `syncTranscribe` w `after()`.
   - Serwer: formatuje transkrypt (nowy akapit po pauzie >1,5 s, `[hh:mm:ss]` mniej więcej co 60 s), zapisuje, ustawia `audio_sec` i koryguje `reserved_sec`, status `transcribed`.
   - Potem kasuje **transkrypt w ElevenLabs i nasze audio** (obiekt i wiersz `materials`).
   - `no_speech` albo `bad_audio`: `failed`, zwrot limitu, skasowanie.
6. **Faza notatki.**
   - CAS z `transcribed` na `noting`; `after(generateLectureNote)` z `maxRetries:0` i limitem 90 s.
   - Zapis `lectures.note` (albo null przy błędzie), status `generating`.
   - Klient pokazuje „ZOBACZ NOTATKĘ”, gdy tylko notatka istnieje.
7. **Faza tematu.**
   - Uruchamia ją kolejne „popchnięcie”: CAS na `topic_started_at`, potem `after(generateTopic)`.
   - Wejście: `text` = transkrypt przycięty do `LECTURE_TOPIC_MAX_TOKENS` po sekcjach plus kluczowe punkty notatki jako przewodnik; `materials` = przygotowane slajdy; `options` = `{…, source:'lecture', viz:true}`.
   - Zapis tematu z `content.note` i `content.origin`; status `done`.
   - Błąd: `failed` z kodem `generation_failed` albo `lost`; notatka zostaje.
8. **Klient przy `done`:** `upsertSubject` → `openNote(fresh)` (widok `cfnote`) → „ZACZNIJ NAUKĘ” → usunięcie `cf_lecture`.
9. **Odzyskiwanie przy starcie:**
   - `cf_lecture` z `lectureId`: tylko odpytywanie GET;
   - `cf_lecture` w fazie `posting`: arkusz, stuknięcie ponawia POST;
   - `listPending()` z elementem oznaczonym jako wysłany: ten sam arkusz;
   - `listPending()` z elementem niewysłanym: arkusz „Masz niedokończone nagranie (N min)” z WYŚLIJ albo Usuń;
   - `status()` wciąż nagrywa: powrót do `cfrec`;
   - wykład `failed`: „UTWÓRZ LEKCJĘ PONOWNIE” wysyła `POST /api/generate {lectureId}`, tylko po stuknięciu.

---

## 5. Migracje

Obie idempotentne.

### `0006_pptx.sql` (Etap 1b, plik istnieje)
- `allowed_mime_types` = obecna lista ∪ PPTX.
- Limit rozmiaru bucketu bez zmian.

### `0007_lectures.sql` (Etap 2b, do napisania)
- **Bucket:** dodać `AUDIO_MIME`.
- **Enum** `lecture_status`.
- **Tabela `lectures`:**
  - kolumny: `id`, `owner_id` (FK `auth.users`, `on delete cascade`), `subject_id` (`on delete set null`), `client_id`, `material_id` (**unique**), `slide_ids`, `generation_id`, `provider`, `provider_job_id`, `status`, `declared_sec` 30..7200, `probed_sec`, `reserved_sec`, `audio_sec`, `transcript text`, `note jsonb`, `topic_id`, `code`, `error`, `polled_at`, `note_started_at`, `topic_started_at`, `provider_deleted_at`, `audio_deleted_at`, `refunded_at`, `retry_used bool`, znaczniki czasu;
  - `unique(owner_id, client_id)`;
  - `unique(provider, provider_job_id)`.
- **RLS:** właściciel tylko SELECT; zapis tylko przez service role.
- **`usage.lecture_seconds`.**
- **RPC `start_lecture`** (security definer, advisory lock): limity minut (doba, miesiąc, globalnie) dostaje **jako parametry** od trasy, bo SQL nie widzi zmiennych Vercela; kody `exists`, `audio_too_long`, `lecture_limit_day`, `lecture_limit_month`, `lecture_busy`; potem `increment_usage` z obsługą sentinel (1000000 / 2000000); potem wstawienie wiersza `generations` (`queued`, `source='lecture'`) i `lectures`.
- **RPC `refund_lecture`:** raz, tylko gdy żadna faza LLM się nie zaczęła. Zmniejsza `usage.generations`, oznacza wiersz `generations` jako `failed` / `'refunded'`. **Uwaga:** zwrócona próba nadal liczy się do limitu 20/dobę (liczone są wiersze).
- Odebrać oba RPC rolom `public`, `anon`, `authenticated`.
- **`create extension if not exists pg_net`** (dla `net.http_post`).
- **pg_cron `cramfox-lecture-sweep`** (`*/5 * * * *`): `net.http_post` do sweepu z sekretem odczytanym z Vault po nazwie (sekret trzeba dodać przed migracją).

---

## 6. Pliki backendu

### Etap 1a: schematy (zrobione w drzewie roboczym)
- `schema.ts` / `types.ts`: jak w sekcji 2, **bez** `source` (to Etap 2); gramatyka dostaje pola viz tylko przy `options.viz`.
- `finalize.ts` → `parseViz`:
  - nigdy nie rzuca;
  - `JSON.parse`, usunięcie tagów, **przycięcie**, potem `safeParse`;
  - ugruntowanie: etykiety względem tekstu całego poziomu; liczby i daty względem `body`/`real` tej dawki, po normalizacji;
  - limit `ceil(feed/2)` na poziom;
  - `finalizeGenerated` kopiuje `viz` wprost;
  - statystyki `vizDropped{schema, grounding, cap}`.
- `prompts.ts`: reguła viz i opis pól; reguła krótszego `body` z zachowaniem co najmniej jednego pogrubionego pojęcia i sedna; wszystko tylko przy `options.viz`.
- `review.ts` (shared i ai): `keep_viz` (tylko w trybie viz), `vizCleared`; skrót „nothing to review” uwzględnia `viz` i zadania (dziś `packages/ai/src/review.ts:289`).

### Etap 1b: PPTX (zrobione w drzewie roboczym)
- `plans.ts`: typy z sekcji 2.
- `packages/ai/src/pptx.ts`:
  - `fflate` i XML przez wyrażenia regularne;
  - kolejność slajdów, akapity `<a:t>`, notatki prowadzącego;
  - obrazy png/jpg/gif/webp, ≥15 kB, deduplikacja SHA-1, odrzucanie logo (na >40% slajdów), ≤5 MB, ≤2000 px (z nagłówka), **bez `sharp`**;
  - limity przeciw „bombom ZIP” (`PPTX_LIMITS`, `pptx.ts:19–42`): 3000 wpisów, 200 MB, 5 MB na plik XML (plan mówił o 30 MB na wpis). Limity 300 slajdów i 400k znaków **przycinają** (reszta pominięta z notką), a nie odrzucają (`pptx.ts:554`, `:568`);
  - wspólny budżet na generację (`PPTX_BUDGET`, `pptx.ts:45–56`): 100 MB rozpakowanego XML, 200 mln znaków XML, 30 s parsowania (przekroczenie = `bad_pptx`), 200 MB mediów i 80 MB zachowanych obrazów (przekroczenie = pomijanie obrazów);
  - błędy: `bad_pptx`, `pptx_protected` (nagłówek CFB), `pptx_empty`.
- `materials.ts` → `prepareMaterials`: każda prezentacja = tekst i obrazy „slajd N”; globalnie ok. 40 obrazów na generację, razem ze zdjęciami.
- `generate/route.ts` + `packages/ai/src/intake.ts:65–90`, kolejność: walidacja → lista MIME (`400 bad_materials`) → tanie wstępne sprawdzenie limitu (tylko gdy są pliki) → pobranie → `prepareMaterials` (błędy PPTX to 400 bez pobrania limitu) → budżet tekstu (`too_long`) → `reserveGeneration` → wiersz generacji → `generateTopic`.
- Testy: `pptx.test`; testy viz w `finalize` (każdy typ, ugruntowanie na poziomie, limit, śmieciowy JSON, przycinanie); review `keep_viz`; snapshot promptu z viz i bez (**bez viz musi być identyczny z dotychczasowym**); trasa nie pobiera limitu przy błędzie PPTX ani złym MIME.

### Etap 2 (do zrobienia)
- `schema.ts`: notatka, `origin`, status.
- `finalize.ts` → `finalizeNote`: przycięcie, deduplikacja; skrót zostaje, jeśli `short` jest w transkrypcie lub slajdach **albo** słowa `full` są w transkrypcie; `null`, gdy `summary` albo `key_points` puste.
- `prompts.ts`: `NOTE_*` i `LECTURE_RULES` dla źródła „wykład”.
- `packages/ai/src/note.ts`: wymuszony format, `{maxRetries:0, timeout:90_000}`.
- `packages/ai/src/stt/`:
  - `index.ts`, `elevenlabs.ts`, później `soniox.ts`;
  - `SttProvider` z `submit`, `fetch`, `syncTranscribe?`, `verifyWebhook` i **obowiązkowym `remove`**;
  - `cleanKeyterms()`;
  - `probeMp4(url)`: Range GET 64 KB, odczyt `mvhd`/`mdhd`/`mp4a`.
- `apps/web/src/lib/lecture.ts`: `advanceLecture` (maszyna stanów z CAS na każdym kroku), `runNotePhase`, `runTopicPhase`, `formatTranscript`, `collectKeyterms`, `cutTranscript`.
- Trasy: `api/lecture` (POST, GET), `api/lecture/webhook`, `api/cron/lecture-sweep`.
- `proxy.ts`: matcher pomija `api/lecture/webhook` i `api/cron`.
- `apps/web/vercel.json` (sekcja `functions`, wpis per plik, dziś: generate 300, tutor 60) i `export const maxDuration` w każdym `route.ts`: 300 (na Pro 800) dla `api/lecture/route.ts`, webhooka i sweepu.
- Dokumentacja: `API.md`, `DEPLOY.md`.
- Testy:
  - `stt/elevenlabs`: form-data, czyszczenie keyterms, odpowiedź 202 z `transcription_id` i bez, HMAC poprawny / przeterminowany / podrobiony;
  - `probeMp4`: dobry plik, za długi, zły kodek, `moov` na końcu;
  - `lecture.test`: szczęśliwa ścieżka w obu trybach; odpytywanie, webhook i sweep naraz dają dokładnie jedno uruchomienie notatki i jedno tematu; błąd STT zwraca limit raz; kłamstwo o rozmiarze lub długości odrzucone; idempotentny `clientId`; `unique(material_id)`; notatka pada, a temat powstaje; temat pada, a notatka zostaje; `lost` daje jedno darmowe ponowienie; `remove` jest wołane; audio i wiersz `materials` kasowane przy `transcribed`;
  - `finalizeNote`;
  - kody limitów SQL na lokalnym Supabase.

---

## 7. iOS (natywnie)

- **`AppBridgeViewController.swift`:** nadpisuje `capacitorDidLoad()` i woła `bridge?.registerPluginInstance(CfRecorderPlugin())`.
- **`SceneDelegate.swift`:** `rootViewController = AppBridgeViewController()`.
- **`Info.plist`:** usunąć `UISceneStoryboardFile` (w konfiguracji sceny) i `UIMainStoryboardFile` (poziom główny; oba wskazują `Main`, a `Main.storyboard:14` tworzy `CAPBridgeViewController`), dodać `NSMicrophoneUsageDescription` i `UIBackgroundModes = [audio]`.
- **`CfRecorderPlugin.swift`:**
  - **metody:** `checkPermissions`, `requestPermissions`, `start`, `pause` (dezaktywuje sesję), `resume` (tylko na pierwszym planie), `stop`, `cancel`, `status`, `listPending`, `markUploaded`, `finalize`, `discard`, `discardAll`;
  - **zdarzenia:** `level` (10 Hz, tylko na pierwszym planie), `state` (z `retainUntilConsumed`), `limit`;
  - **sesja audio:** `.record`, wbudowany mikrofon, `setPrefersNoInterruptionsFromSystemAlerts`; po stopie przywrócenie poprzedniej kategorii i dezaktywacja z `.notifyOthersOnDeactivation`;
  - **koder:** AAC 16 kHz mono 32 kbps, zapas 22,05 kHz;
  - **pliki:** `Application Support/Recordings/<uuid>/seg-NNN.m4a` i `manifest.json` (`clientId`, `materialId?`); wyłączone z kopii zapasowej; ochrona `completeUntilFirstUserAuthentication`;
  - **dysk:** co najmniej 200 MB wolnego na start; stop przy 100 MB;
  - **rotacja i przerwania:** zmiana segmentu co 300 s (dopuszczalna przerwa ok. 0,2 s albo `AVAudioEngine` + `AVAudioFile`, jeśli spike pokaże utratę słów); przy przerwaniu (np. połączenie) zamknięcie segmentu, wznowienie albo stan `interrupted` i „Wznów” w UI; przy `willTerminate` zamknięcie segmentu i zapis manifestu;
  - **odzyskiwanie:** w `load()` skan manifestów, czytelne segmenty zostają;
  - **stop:** `AVMutableComposition` i eksport passthrough z `shouldOptimizeForNetworkUse=true` w `beginBackgroundTask`; przy błędzie zwraca `segments`.

---

## 8. Klient

### Etap 1 (zrobione w drzewie roboczym)
- `cloud.js`:
  - `vs()` (tekst albo liczba, `noEmoji`, trim, przycięcie, **potem** `esc`);
  - `mapViz` (lista dozwolonych typów, limity na surowej wartości, `Number`/`isFinite`/`≥0`, same zera w słupkach → `null`, za mało elementów → `null`, `flow.kind` domyślnie `process`);
  - `mapLevel` ustawia `viz: mapViz(f.viz)` po `deepEsc`;
  - `vizText()` (tekst zastępczy, escapowany);
  - `OK_MIME`, `EXT_MIME.pptx`, mapowanie rozszerzeń;
  - `generate()` wysyła `options.viz: true`.
- `engine.js`:
  - `vizOk` i renderer: siatka HTML/CSS; szerokości słupków tylko z liczb; SVG tylko na strzałki i łuki;
  - `chatDose`: puste kawałki pomijane, potem `chatViz`, potem `chatOffer`;
  - podsumowanie z dawek i `termDef` czytają też `vizText`;
  - podpis szybkiego dodawania „PDF, prezentacja albo zdjęcia”.
- `cloud-ui.js`: wybór plików przyjmuje `.pptx` i jego MIME; odrzucanie `/\.(docx?|ppt|xlsx?|odt|pages|key)$/` z osobnymi komunikatami; ikona miniatury PPTX; teksty `failGen`.
- `styles.css`: `.cviz`, `.vz-*`, `vzDraw`; container query (iOS 16.4); tylko tokeny, bez gradientów; ograniczone animacje obsłużone globalnie.

### Etap 2 (do zrobienia)
- `cloud.js`:
  - opakowanie `rec`;
  - `fileSource(uri, size)` z Range, koniec przycięty do `size-1`, akceptuje 206;
  - `tusUpload` czyta przez `blob.read`, gdy jest;
  - audio zawsze przez TUS; `audio/mp4` → `m4a`; audio nie ma w wyborze plików;
  - `startLecture` (POST, bez automatycznego ponawiania);
  - `lectureStatus` (GET);
  - dziennik `cf_lecture` (fazy `posting`, `posted`) i `recoverLecture`;
  - `mapNote`;
  - tematy w `toEngine` dostają `{source, note}`;
  - `signOut` i `deleteAccount` wołają `rec.discardAll()`.
- `cloud-ui.js`:
  - hooki `addRecord`, `canRecord`, `openNote`;
  - zgoda v2 (`M.aiConsentV=2`) wymagana tylko do nagrywania; aktualizacja `openPrivacy`;
  - `cfrec`, tryb wykładu w `cfadd`, gałąź wykładu w `runGeneration`;
  - `STEPS_LECTURE` z fazami `uploaded`, `transcribing`, `noting`, `generating`;
  - `cfnote`, `shareNote` (zwykły tekst; share, a bez niego schowek);
  - `finishGen` prowadzi do `cfnote`, gdy temat ma notatkę;
  - `.cfnote-card`; arkusze odzyskiwania.
- `engine.js`: ikony `mic`, `pause`, `play`, `stop`; wiersz `#qa-rec` tylko gdy `canRecord`; `.bandnote`; eksport `calmMotion`.
- `styles.css`: klasy nagrywania i notatki.

---

## 9. Czyszczenie danych (sanityzacja)

1. **Serwer:** `parseViz` i `finalizeNote` usuwają tagi, przycinają i walidują zodem. Transkrypt zapisany jako czysty tekst. Keyterms czyszczone.
2. **`cloud.js`:** przycięcie, potem `esc` dla tekstów schematów i notatki; `clean()` dla HTML dawek; `deepEsc` dla tytułów.
3. **Silnik:** `vizOk` odrzuca surowe `<`, `>`, `"` i złe liczności. Zero HTML i SVG od AI. Liczby tylko przez `Number`. Teksty już escapowane nie są escapowane drugi raz.
4. **`shareNote`:** tylko zwykły tekst.
5. **Transkrypt:** jeśli kiedyś pokazywany, to tylko przez `esc`.

---

## 10. Limity, koszt, komunikaty

### Limity
- Nagranie: 120 min w pluginie; serwer: sondowana długość ≤7260 s i prawdziwy rozmiar ≤40 MB.
- Ok. 14,4 MB/h, czyli ok. 29 MB za 120 min.
- Minuty: 240 na dobę, 900 na miesiąc, 6000 na dobę na cały serwer (zmienne środowiskowe).
- Jedna generacja na wykład plus jedno darmowe ponowienie po `lost`.
- Plan Hobby Vercela: 300 s na wywołanie; Pro: do 800 s.

### Koszt
- STT: $0,22/h (Scribe v2) + 20% za keyterms = **$0,264/h**. Cena bazowa pochodzi z omówienia, nie z cennika ElevenLabs: **do potwierdzenia** przed spike'iem.
- **90 min ≈ $0,40** plus jedna generacja.
- Limit globalny 6000 min/dobę ≈ **$26/dobę**.
- Bez automatycznego ponawiania zlecenia STT ani `/api/generate`.

### Komunikaty (po polsku, bez emoji, bez płatności i „Pro”)

| Kod | Tytuł | Treść |
|---|---|---|
| `bad_audio_type` | Nieobsługiwany format nagrania | Nagraj wykład w aplikacji. |
| `audio_too_long` | Nagranie jest za długie | Jedno nagranie może mieć do ${maxMin} min. Podziel wykład na części. |
| `lecture_limit` (day) | Na dziś wystarczy nagrań | Dzienny limit minut nagrań jest wykorzystany. Spróbuj jutro. |
| `lecture_limit` (month) | Limit nagrań w tym miesiącu wykorzystany | Limit odnowi się 1. dnia miesiąca. |
| `lecture_limit` (server) | Serwer ma dziś bardzo dużo pracy | Nagranie jest zapisane w telefonie. Spróbuj jutro. |
| `stt_unavailable` | Rozpoznawanie mowy chwilowo nie działa | Spróbuj za kilka minut. Limit się nie zmienił. |
| `stt_failed` | Nie udało się odczytać nagrania | Limit się nie zmienił. Spróbuj ponownie. |
| `no_speech` | W nagraniu nie słychać wykładu | Nagranie jest za ciche albo puste. Połóż telefon bliżej prowadzącego. |
| `bad_audio` | Nagranie jest uszkodzone | Nie da się go odtworzyć. Spróbuj nagrać ponownie. |
| `lecture_state` | Ta lekcja już się tworzy | Poczekaj na wynik. |
| `lost` | Generowanie się nie dokończyło | Notatka i transkrypcja są zapisane. Możesz utworzyć lekcję ponownie. |
| `bad_pptx` | Nie mogę otworzyć prezentacji | Plik jest uszkodzony. Zapisz go ponownie jako PPTX albo PDF. |
| `pptx_protected` | Prezentacja jest zabezpieczona albo w starym formacie | Usuń hasło i zapisz jako PPTX albo PDF. |
| `pptx_empty` | Prezentacja nie ma treści | Nie znalazłem tekstu ani obrazów na slajdach. |

`lost` pokazujemy dopiero, gdy istnieje darmowe ponowienie. `lecture_busy` → wiersz `lecture_limit` (server).

Inne teksty:
- **Wybór plików, stare formaty:** `.ppt`/`.key`: „Prezentacja w starym formacie albo Keynote — zapisz jako PPTX lub PDF.” Word: „Dokument Word: zapisz jako PDF.” PPTX >50 MB: „Prezentacje z filmami bywają duże — usuń filmy albo zapisz jako PDF.”
- **Brak dostępu do mikrofonu:** „Brak dostępu do mikrofonu. Włącz go w Ustawieniach iPhone'a → Cramfox.”
- **Ekran nagrywania:**
  - „Połóż telefon blisko prowadzącego. Możesz zablokować ekran — nagrywam dalej.”
  - „Nagrywaj tylko za zgodą prowadzącego. Nagranie służy wyłącznie do Twojej nauki.”
  - „Nagrywanie wstrzymane (połączenie) — stuknij Wznów.”
- **Zgoda v2:** „…zdjęcia, pliki i tekst przetwarza Claude (Anthropic), a nagrania wykładów zamienia na tekst ElevenLabs (serwery w USA). Nagranie usuwamy z serwera zaraz po przepisaniu, a ElevenLabs nie przechowuje transkrypcji.”

---

## 11. Testy

**Backend:** sekcja 6.

**jsdom:** harness trzeba zbudować od zera w `test/` (jsdom jako devDependency w `test/package.json`, atrapa backendu, atrapy `CapacitorHttp` i `CfRecorder`). Dodać `test/fixtures/topic-lecture.json`: wszystkie 7 typów schematów, próby XSS, emoji, teksty po 500 znaków, `value:"abc"`, wartości ujemne, nieznany typ, dodatkowe klucze.

| Grupa | Test | Co sprawdza |
|---|---|---|
| Schematy | V1 | fixture XSS nie zostawia `<` w tekstach schematów, żadnych `on*`/`script`, żadnego SVG poza `.vz-arc`/`.fx`/`.ic` |
| | V2 | każdy typ rysuje właściwą liczbę elementów |
| | V3 | błędne przypadki nie dają `.cviz`, a „Dalej” nadal jest |
| | V4 | przycinanie bez uciętego `&am` |
| | V5 | kolejność: tekst, `.cviz`, „Dalej”; lis dostaje `act-idea` |
| | V6 | przy ograniczonych animacjach wszystko od razu |
| | V7 | `.cdose.done` chowa schemat |
| | V8 | stary temat daje tyle samo dymków co wcześniej |
| | V9 | pusta treść ze schematem nie daje pustego dymka |
| | V10 | `vizText` trafia do podsumowania i `termDef` |
| | V11 | `generate()` wysyła `viz: true` |
| PPTX | P1 | lista `accept` zawiera `.pptx`; plik z pustym `type` dostaje właściwy MIME i `.pptx` |
| | P2 | toasty dla `.ppt`/`.key`/`.docx`, komunikat >50 MB, tekst `bad_pptx` |
| Notatka | N1 | `mapNote` escapuje, przycina, zwraca `null` dla pustej |
| | N2 | wykład `done` prowadzi do `cfnote` z sekcjami; `.bandnote` otwiera `cfnote`, wstecz wraca do przedmiotu |
| | N3 | tekst do udostępnienia bez `&amp;`; bez API share: schowek i toast |
| | N4 | bez notatki nie ma `.bandnote` |
| Nagrywanie | R1 | od `#qa-rec` do `cfnote`: dokładnie 1 `POST /api/lecture`, 0 `POST /api/generate`, jeden `discard`, **TUS nawet dla pliku 3 MB** |
| | R2 | odmowa uprawnienia |
| | R3 | przerwanie pokazuje baner |
| | R4 | przeładowanie WebView w trakcie nagrywania wraca do `cfrec` z dobrym czasem |
| | R5 | zabicie apki w trakcie nagrywania → arkusz `listPending` |
| | R6 | zabicie po stopie: brak POST do stuknięcia |
| | R7 | zabicie po `POST /api/lecture`: odzyskiwanie tylko przez GET |
| | R8 | `failed` zachowuje notatkę; ponowienie wysyła 1 `POST /api/generate {lectureId}` po stuknięciu |
| | R9 | wylogowanie woła `discardAll` |
| | R10 | przy 120 min automatyczny stop, nic >50 MB nie idzie na serwer |
| | R11 | brak pluginu chowa `#qa-rec` |
| | R12 | wyrażenie z C21 nie znajduje nic w żadnym `textContent` |
| | R13 | utracona odpowiedź POST → po stuknięciu ponowny POST z tym samym `clientId`, bez ponownej wysyłki |
| | R14 | sama zgoda v1 nadal pokazuje v2 przed nagrywaniem |

**Symulator i urządzenie:** dziewięć pierwotnych sprawdzeń (Range zwraca 206 przez `_capacitor_file_`, AAC 16 kHz / 32 kbps, eksport passthrough, 60 min przy zablokowanym ekranie na urządzeniu, połączenie przy zablokowanym ekranie, odzyskiwanie po zabiciu apki, pełny 10-minutowy przebieg z PPTX, tryb samolotowy w trakcie wysyłki, schematy przy 360 i 430 pt) oraz nowe: po eksporcie `moov` w pierwszych 64 KB; tylko jedna instancja storyboardu/mostu.

---

## 12. Kolejność wdrażania

| Etap | Zawartość | Kiedy gotowe | Stan 2026-10-14 |
|---|---|---|---|
| **1a: schematy** | włączane przez `options.viz`, bez migracji | testy backendu i V1–V11 przechodzą, snapshot promptu bez viz = dotychczasowy, 3 prawdziwe tematy ze schematami po ugruntowaniu | kod w drzewie roboczym; wdrożenie do sprawdzenia; harness jsdom nie istnieje |
| **1b: PPTX** | `0006_pptx.sql`, `pptx.ts`, nowa kolejność w trasie, wybór plików i teksty | P1–P2 i `pptx.test`, plus prawdziwa prezentacja 40 slajdów | kod w drzewie roboczym; 0006 i wdrożenie do sprawdzenia. Kolejność: backend → 0006 → build 6 |
| **2a: spike STT** | lokalnie, z kluczem właściciela | wybrany tryb A albo B | nie zaczęte |
| **2b: backend wykładów** | `0007_lectures.sql`, `stt`, `lecture.ts`, endpointy, sweep, notatka, sonda | testy jednostkowe i 2 prawdziwe wykłady od początku do końca przez curl | nie zaczęte |
| **2c: nagrywarka iOS** | plugin Swift, naprawa mostu (oba wpisy storyboardu), `Info.plist`, capability | sprawdzenia w symulatorze | nie zaczęte |
| **2d: przepływ w apce** | zgoda v2, `cfrec`, tryb wykładu w `cfadd`, odpytywanie, `cfnote`, odzyskiwanie | N1–N4 i R1–R14 oraz test na urządzeniu; potem zgłoszenie do App Store z etykietą prywatności i nową polityką | nie zaczęte |
| **2e (opcjonalnie)** | Soniox; natywna wysyłka w tle (`URLSession`) | tylko gdy ElevenLabs zawiedzie jakością albo niezawodnością | nie zaczęte |

---

## 13. Otwarte ryzyka

1. **Wyniki spike'a:** `transcription_id` w 202, czas synchronicznej transkrypcji, kształt webhooka.
2. **Budżet czasu:** 300 s na Hobby nawet przy dwóch fazach; przycięcie transkryptu może zgubić treść 2-godzinnych wykładów. Vercel Pro daje 800 s.
3. **Wysyłka w tle:** zatrzymuje się po zablokowaniu ekranu (TUS wznowi później). Naprawa: natywna wysyłka w tle (2e).
4. **Nagrywanie w tle:** wznowienie po połączeniu w tle może się nie udać, dlatego potrzebna ścieżka „Wznów”.
5. **Jakość schematów:** po 1a trzeba będzie stroić prompt według statystyk `vizDropped`.
6. **Miejsce w Storage:** ok. 1 GB na planie free. Łagodzi to kasowanie audio przy `transcribed` i sweep co 5 min.
7. **Prawo:** nagrywanie osób trzecich, transfer do USA, zgoda niepełnoletnich. Polityka i regulamin muszą być zaktualizowane przed 2d.
8. **Starsze buildy:** nigdy nie proszą o `viz` i ignorują `note`/`origin`, więc działają dalej. Tematy z wykładów są dla nich zwykłymi tematami.

---

## 14. Poprawki z przeglądu (C1–C29)

| # | Waga | Problem | Rozwiązanie |
|---|---|---|---|
| C1 | wysoka (nadużycie kosztów) | Kontrola długości ufała klientowi (`durationSec`, `size_bytes`); 50 MB HE-AAC 8 kbps to ok. 14 h, a ElevenLabs liczy prawdziwą długość | Przed STT: prawdziwy rozmiar ze `storage.objects` ≤40 MB; Range 64 KB i parsowanie MP4 (`ftyp`, `moov/mvhd`, `mdhd`, kodek `mp4a`, ≤24 kHz); odrzucić >7260 s, odchyłkę >5% albo nie-ISO-BMFF (`bad_audio_type` / `audio_too_long`); rezerwacja minut wg **sondy**. Eksport z `shouldOptimizeForNetworkUse=true`; brak `moov` w 64 KB → odrzucenie |
| C2 | wysoka | Starsze buildy (i web Recall) nie rysują `viz`, a nowy prompt skraca `body` | `GenerationOptions.viz?`, wysyłane tylko przez nowego klienta; bez niego prompt i gramatyka bajt w bajt jak dotąd |
| C3 | wysoka | Ugruntowanie sprzeczne z promptem (etykiety szukane tylko w tej dawce) | Etykiety względem całego poziomu (dawki, fiszki, quiz); liczby i daty nadal w `body`/`real` tej dawki; normalizacja spacji, NBSP, `,`/`.`, `%`, „tys./mln”; statystyki `vizDropped` |
| C4 | wysoka | Notatka i temat w jednym `after()` nie zmieszczą się w 300 s; 120 min to 45–60k tokenów | Dwie fazy w osobnych wywołaniach z CAS; transkrypt do tematu ok. 24k tokenów po sekcjach `[hh:mm:ss]` + punkty notatki; na Pro 800 s; ponowienie po `lost` raz za darmo na tym samym wierszu |
| C5 | wysoka | Odpytywanie wymaga `transcription_id`, które dokumentacja oznacza jako opcjonalne | Pytanie go/no-go w spike'u; bez id: synchroniczny `convert` w `after()` (280 s); powyżej ok. 240 s na 120 min: Soniox |
| C6 | wysoka (prywatność) | Kasowanie transkryptów było opcjonalne | `provider.remove(jobId)` obowiązkowe zaraz po zapisie i przy usuwaniu konta; `provider_deleted_at`, sweep ponawia |
| C7 | średnio-wysoka | Crony Hobby raz dziennie ±59 min | pg_cron + `pg_net` co 5 min z `CRON_SECRET` w Vault; ewentualnie dzienny cron Vercela jako drugi zapas |
| C8 | średnia | Krótkie nagrania (≤6 MB, ok. 25 min) szły zwykłym uploadem, który wymaga Bloba | Audio zawsze przez TUS (albo `fetch().blob()` dla małych) |
| C9 | średnia (IDOR) | Brak sprawdzeń właściciela | Klient z RLS; w kodzie `storage_path.startsWith(uid + '/')`; MIME audio i slajdów; `unique(material_id)`; GET przez RLS; webhook szuka po `(provider, provider_job_id)`; `/api/generate {lectureId}` sprawdza właściciela |
| C10 | średnia | Podpisany URL ważny 6 h to za długo | 1 h, nigdy logowany; audio i wiersz `materials` kasowane przy `transcribed` |
| C11 | średnia | Złe keyterms psują żądanie; zły szacunek kosztu | Czyszczenie (bez tagów i interpunkcji, <50 znaków, ≤5 słów, bez duplikatów, ≤100); koszt $0,264/h, 90 min ≈ $0,40, 6000 min/dobę ≈ $26 |
| C12 | średnia | Notatka po cichu ponawiana przez wspólny klient (`maxRetries: 2`) | `{maxRetries: 0, timeout: 90_000, signal}` |
| C13 | średnia | Szczegóły webhooka | `req.text()`; HMAC-SHA256 z `${t}.${raw}` w stałym czasie; `t` ≤30 min; szybkie 200 i praca w `after()`; webhook i `/api/cron/*` poza matcherem `proxy.ts`; kształt z spike'a; uwaga na auto-wyłączenie (10 błędów z rzędu bez sukcesu przez 7 dni) |
| C14 | średnia | Limity obrazów przy PPTX; `sharp` to natywna binarka | ok. 40 obrazów na generację łącznie; wymiary z nagłówków, ≤5 MB, ≤2000 px, bez EMF/WMF/TIFF/SVG; `fflate` w `packages/ai` |
| C15 | średnia | Zła kolejność w trasie: nieznany MIME pobierał limit | MIME przed pobraniem limitu; tanie wstępne sprawdzenie limitu przed pobraniem do 150 MB |
| C16 | średnia | Wiedza tylko ze schematu niewidoczna dla innych trybów | `vizText(viz)` dla podsumowania, `termDef`, `doseCheck`, tutora; w `body` zostaje co najmniej jedno pogrubione pojęcie i sedno |
| C17 | średnia | `/api/generate` odrzuci `{subjectId, lectureId}`; `recoverJob` nie pasuje do wykładów | `lectureId` w `BodySchema`; odzyskiwanie wykładów tylko przez `cf_lecture` i GET |
| C18 | średnia (App Store / RODO) | Zgoda, transfer, bezczynna sesja audio | zgoda v2 z ElevenLabs przed pierwszym nagraniem nawet po v1; polityka: procesor, DPA/SCC, kasowanie; pauza dezaktywuje sesję, wznowienie tylko na pierwszym planie (2.5.4) |
| C19 | nisko-średnia | Utracona odpowiedź 202 wymuszała ponowną wysyłkę pliku | `markUploaded` w manifeście, `cf_lecture` przed POST, ponowny POST po stuknięciu, idempotentny `clientId` |
| C20 | niska | Niezgodne granice `declared_sec` | wszędzie 30..7200; `lecture_busy` → `lecture_limit{scope:"server"}` |
| C21 | niska | Test R12 sam się wywali (`Pro` łapie „Prezentacja”) | `/\bPro\b\|płat\|subskryp\|premium\|zakup/i` plus `\p{Extended_Pictographic}` |
| C22 | niska | Harness jsdom nie istnieje | zbudować od zera w `test/` (jsdom w `test/package.json`, poza `build.js`) |
| C23 | niska | CSP i Range | `connect-src 'self'` obejmuje `capacitor://localhost/_capacitor_file_`; klient przycina koniec zakresu; `media-src 'self' blob:` tylko przy odtwarzaniu |
| C24 | niska | Dwa mosty dziś | usunąć `UISceneStoryboardFile` i `UIMainStoryboardFile`, `SceneDelegate` tworzy `AppBridgeViewController()`; storyboard dopasować albo usunąć |
| C25 | niska | Skutki uboczne audio iOS | kategoria `.record` wycisza dźwięki apki → przywrócić po stopie; rotacja gubi ok. 0,1–0,3 s co 5 min → zaakceptować albo `AVAudioEngine` (decyduje spike) |
| C26 | niska | Budowa schematu zod | `caption` w każdej gałęzi; `parseViz` najpierw przycina, potem waliduje |
| C27 | niska | Review pomijałby dawki tylko ze schematem | skrót w `review.ts` uwzględnia `viz` (zrobione; dziś `packages/ai/src/review.ts:289`) |
| C28 | niska | Szczegóły zwrotu | `refund_lecture` zmniejsza `usage.generations`, wiersz `failed` / `'refunded'`; nadal liczy się do 20/dobę |
| C29 | niska | Osierocone audio | sweep kasuje niepowiązane audio (obiekt i wiersz) po 48 h |

---

## 15. Fakty sprawdzone w przeglądzie

Stan w chwili przeglądu (przed implementacją Etapu 1). **Część punktów jest już nieaktualna w drzewie roboczym:** dziś kolejność w trasie to MIME → wstępne sprawdzenie limitu → pobranie → PPTX → budżet tekstu → pobranie limitu (`intake.ts:65–90`), więc ani „limit przed pobraniem materiałów”, ani „błąd MIME po pobraniu limitu” już nie zachodzą (ale zachodzą w zacommitowanym `512e5c8`, który może być na produkcji). Skrót review jest dziś w `review.ts:289`.

**W kodzie:**
- backend: `reserveGeneration` przed pobraniem materiałów; `materialsToBlocks` rzucał przy nieznanym MIME po pobraniu limitu; `BodySchema.superRefine` wymaga plików albo tekstu; klient Anthropic z `maxRetries: 2`; poziomy równolegle po planie, cache promptu włączony; review pomijane, gdy poziom nie ma quizu ani `mnemo`/`real` (`review.ts:235`); `finalize.ts:205` buduje dawkę jako `{title, body, real, mnemo}`; `proxy.ts` woła `getUser` przy każdym `/api/*`; wiersz `materials` pisze klient;
- apka: limity 20/300 liczą wiersze `generations`; `materials_path_owner` NOT VALID; pg_cron włączony; pliki ≤6 MB zwykłym uploadem; `CapacitorHttp` nie podmienia `fetch`; CSP `connect-src 'self'` bez `media-src`;
- Capacitor iOS 8.5.2: `WebViewAssetHandler` odpowiada 206 na Range dla `_capacitor_file_`, ale nie przycina końca; `capacitorDidLoad()` i `registerPluginInstance` istnieją;
- `native/ios/App/App`: podwójny most (storyboard przez `UISceneStoryboardFile` i `UIMainStoryboardFile` oraz `SceneDelegate`);
- `test/`: tylko fixtures.

**W sieci (dokumentacja dostawców):**
- ElevenLabs STT: `source_url` zastępuje przestarzałe `cloud_storage_url`; z `webhook=true` szybkie 202, w którym `transcription_id` jest opcjonalne, a `request_id` i `message` wymagane; keyterms <50 znaków, ≤5 słów, +20% ceny; `timestamps_granularity` tylko `word` i `character`; istnieje `DELETE /v1/speech-to-text/transcripts/{id}`; brak opisu odpowiedzi GET w trakcie przetwarzania.
- Webhooki ElevenLabs: nagłówek `ElevenLabs-Signature: t=…,v0=hex(HMAC-SHA256(t.body))`; auto-wyłączenie po 10 błędach z rzędu bez sukcesu przez 7 dni.
- Cena: Scribe v2 batch $0,22/h (z omówienia, nie z cennika; do potwierdzenia).
- Vercel: Hobby 300 s, Pro do 800 s; body żądania 4,5 MB; crony Hobby raz dziennie ±59 min.
