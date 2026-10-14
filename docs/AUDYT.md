# Cramfox: pełny audyt (2026-10-14)

Ten dokument zbiera wyniki pełnego audytu apki i backendu: co działa, co jest zepsute, co trzeba zdecydować i w jakiej kolejności to naprawiać. Podstawą jest [`docs/BIBLIA.md`](BIBLIA.md). Rzeczy już tam opisane powtarzam tylko wtedy, gdy audyt dodał coś nowego (nowy skutek, pełną poprawkę albo korektę).

**Jak powstał.** Dziewięć niezależnych spojrzeń („soczewek”), każde z dowodami `plik:linia`:

| Soczewka | Co sprawdzała |
|---|---|
| `setup` | uruchomienie całej apki na atrapie backendu: 228 zrzutów w 10 scenariuszach, automatyczne kontrole (emoji, przepełnienie, XSS, liczba `POST /api/generate`, sprzątanie po wylogowaniu) |
| `ux` | przejście apki oczami licealisty i studenta przed kolokwium |
| `wygląd` | spójność z designem 2.0, kontrast, 360 px, safe area |
| `nauka` | czy mechanika wspiera trwałe uczenie się (SRS, pytania, nagrody) |
| `silnik` | `engine.js` w całości, z uprzężą jsdom |
| `chmura` | `cloud.js` i `cloud-ui.js`, synchronizacja na atrapie PostgREST z CAS |
| `backend` | `nauka-backend` (HEAD `5a8097b`), migracje, koszty |
| `sklep` | App Store, RODO, prawo polskie i unijne |
| `produkt` | sens produktu, konkurencja, kolejność prac |

Ustalenia silnika, chmury i backendu przeszły drugą, krytyczną weryfikację. Żadne nie okazało się fałszywe, ale kilka dostało niższy priorytet. Tu stosuję priorytet z weryfikacji. Nic nie zostało wdrożone, nic nie dotknęło produkcji (atrapa podmienia `fetch`, przeglądarka blokowała wszystko poza localhostem).

**Priorytety:**
- **P0**: blokuje wydanie albo grozi utratą danych, pieniędzy lub bezpieczeństwa;
- **P1**: wyraźnie szkodzi użytkownikom albo właścicielowi;
- **P2**: dopracowanie.

**Wysiłek:** S = do pół dnia, M = 1–3 dni, L = tydzień i więcej (praca z agentem plus test w symulatorze).

Numery zrzutów („zrzut 187”) odnoszą się do listy z załącznika ([7.1](#71-zrzuty-ekranu)).

---

## Spis treści

1. [Werdykt w 10 zdaniach](#1-werdykt-w-10-zdaniach)
2. [P0: do naprawy przed szerszym gronem i App Store](#2-p0-do-naprawy-przed-szerszym-gronem-i-app-store)
3. [P1 i P2](#3-p1-i-p2)
4. [Decyzje dla właściciela](#4-decyzje-dla-właściciela)
5. [Co działa dobrze i trzeba zachować](#5-co-działa-dobrze-i-trzeba-zachować)
6. [Rekomendowany plan](#6-rekomendowany-plan)
7. [Załącznik](#7-załącznik)

---

## 1. Werdykt w 10 zdaniach

1. Tak, Cramfox ma sens: „z Twoich notatek do zaliczonego sprawdzianu” (własny materiał, plan do daty, noc przed egzaminem, egzamin próbny w polskiej skali ocen) to coś, czego nie robią ani Quizlet, ani Knowt, ani Gizmo.
2. Rdzeń działa: pełny przebieg na atrapie backendu (228 zrzutów, 10 scenariuszy) przeszedł bez żadnego błędu w konsoli, bez wykonania skryptu z danych XSS i z dokładnie jednym `POST /api/generate` na próbę.
3. Dydaktyka jest wyraźnie lepsza niż w typowych apkach „AI-fiszki”: pytania bez podglądu treści, „Dlaczego” przy każdej odpowiedzi, SRS z blokadą przed zawyżaniem, talia błędów z egzaminu, źródło z cytatem i poprawianie pytań przez ucznia.
4. Inżynieria jest staranna: sanitizer i CSP bez `unsafe-inline`, synchronizacja z CAS na `rev`, dziennik generacji z odzyskiwaniem i porządne usuwanie konta.
5. Największe ryzyko jest finansowe: konto bez potwierdzania maila dostaje 150 generacji na Opusie, równoległe żądania omijają limit dzienny i globalny, a generacja kosztuje według szacunku ok. $2–3, czyli mniej więcej dziesięć razy więcej, niż podaje DEPLOY.md.
6. Drugi blok to formalności, bez których App Store nie przyjmie apki: publiczna polityka prywatności, kontakt i Support URL, status DSA, konto demo dla recenzji, a zaraz potem regulamin.
7. Po stronie danych użytkownika są dwa realne błędy: świeże urządzenie z zapchaną pamięcią może wyzerować postępy w chmurze, a zapisanie pytania w przeglądzie egzaminu (nawet bez zmian) potrafi przeliczyć dobrą odpowiedź na złą i zapisać to w wynikach.
8. Produktowo apka nosi kostium Duolingo, który dziś działa przeciwko uczniowi: życia przerywają lekcję z własnego materiału wieczorem przed sprawdzianem, plan dnia ignoruje wybrany czas, a kilkanaście systemów nagród płaci więcej za powtarzanie znanego niż za naukę.
9. Brakuje warstwy „po utworzeniu”: przedmiotu ani materiału nie da się usunąć ani przemianować, nowy materiał ląduje bez nagłówka na końcu ścieżki, a krótkie nazwy przedmiotów się zlewają.
10. Rekomendacja: najpierw „Build 7” (bezpieczniki kosztów na backendzie, naprawy danych, najboleśniejsze UX) równolegle z formalnościami, potem decyzje produktowe (życia, trial i ceny, egzamin w centrum, Android), a nagrywanie wykładów dopiero po nich.

---

## 2. P0: do naprawy przed szerszym gronem i App Store

Klient nie ma żadnego P0: wszystkie sześć dotyczy pieniędzy na backendzie albo formalności sklepu. Pełna, uporządkowana lista kroków przed zgłoszeniem do App Store jest w [6.2](#62-formalności-przed-zgłoszeniem-do-app-store-równolegle-z-buildem-7).

| # | Problem | Gdzie | Skutek dla użytkownika | Poprawka | Wysiłek |
|---|---|---|---|---|---|
| P0-1 | **Wyścig w rezerwacji limitu** omija limit dzienny (20) i globalny (300). [backend; znany w BIBLIA §8.7#2, nowe: obejście limitu globalnego] | `backend/0004_cramfox.sql:103-111` (`increment_usage` liczy wiersze `generations` z 24 h), wiersz wstawiany dopiero później w `route.ts:115`; `plan.ts:48` (limit miesięczny sprawdzany po podbiciu) | Skrypt wysyła 150 równoległych żądań z jednego konta trialowego: wszystkie widzą licznik 0 i wszystkie ruszają (rzędu $300–400). 2N+1 strumieni Opusa na każde żądanie wyczerpuje limit organizacji w Anthropic, więc generacje prawdziwych użytkowników padają z 429, już po pobraniu ich limitu. | Jedno RPC `reserve_generation` (security definer, `search_path ''`, odebrane rolom klienta). W jednej transakcji: blokada doradcza na użytkownika i globalna; `busy`, gdy użytkownik ma generację `queued`/`running` młodszą niż 7 min; sprawdzenie limitów dziennego, globalnego i miesięcznego **przed** podbiciem licznika; wstawienie wiersza `generations` i podbicie `usage`. Route używa zwróconego id i nie wstawia własnego wiersza. | M |
| P0-2 | **Farmienie triali** [backend, chmura, sklep; znane w BIBLIA §8.7#1, nowe: skala kosztu i blokada wszystkich] | `0004_cramfox.sql:62-73` (`handle_new_user`: `client:'cramfox'` z metadanych wysłanych przez klienta daje 30 dni pro); `cloud.js:59`; potwierdzanie maila wyłączone (`nauka-backend/supabase/config.toml:19`) | Wystarczy publiczny klucz anon i curl: każde konto to 150 generacji (20/dobę). 15 takich kont zjada globalne 300/dobę, co kosztuje właściciela rzędu $600–900 dziennie, a wszyscy prawdziwi użytkownicy przez 24 h widzą „Serwer ma dziś bardzo dużo pracy”. Usunięcie konta i ponowna rejestracja tym samym mailem daje nowy trial. | **Dziś, bez kodu:** miesięczny limit wydatków i alerty w workspace Anthropic. Potem: tabela `trial_ledger(email_hash)` sprawdzana w `handle_new_user` (trial raz na adres, przeżywa usunięcie konta); osobna pula globalna dla triali (np. 100/dobę), żeby nie głodziły pozostałych; CAPTCHA w Supabase Auth. Wielkość triala i potwierdzanie maila: [D3](#d3). | M (L z App Attest) |
| P0-3 | **Brak publicznej polityki prywatności**; arkusz „Twoje dane” jest niepełny i w jednym punkcie nieprawdziwy [sklep; BIBLIA §8.5, §11.2#3] | App Store Connect (pole wymagane); `cloud-ui.js:118-132` (`openPrivacy`), `:122` „Dostęp masz tylko Ty”; `nauka-backend/apps/web/vercel.json` (brak `regions`) | Nie da się wysłać do recenzji. Arkusz nie spełnia art. 13 RODO: brak administratora, podstaw prawnych, retencji, praw i skargi do UODO. Nie mówi o transferze do USA (Anthropic, a funkcja Vercela najpewniej działa w `iad1`). Zdanie o dostępie jest nieprawdziwe, bo serwer pobiera pliki kluczem service role. | Polityka po polsku pod stałym URL: administrator i kontakt; zbierane dane (e-mail, materiały, wygenerowane lekcje, blob postępów, poprawki pytań, flaga 16+, data zgody, IP w logach); cele i podstawy (art. 6 ust. 1 lit. b, f); procesorzy (Supabase Frankfurt, Vercel, Anthropic USA); transfery (SCC/DPF); retencja ([D9](#d9)); prawa; 16+. Link na ekranie logowania i w Ustawieniach → O aplikacji (`window.open`, Capacitor odda go Safari). Poprawić tekst arkusza: „Dostęp do nich masz Ty; nasz serwer pobiera je tylko, żeby utworzyć lekcję”. Kto jest administratorem: [D1](#d1). | M |
| P0-4 | **Brak kontaktu i Support URL** [sklep] | grep: ani `mailto:`, ani adresu w `engine.js` i `cloud-ui.js`; pole Support URL w App Store Connect | Pole wymagane (wytyczna 1.5). Użytkownik, który zapomniał hasła, nie ma gdzie napisać i nie może nawet usunąć konta, bo usuwanie wymaga sesji. Wymóg UŚUDE art. 5 i DSA art. 12 (punkt kontaktowy). | Skrzynka (np. `pomoc@<domena>`) i strona pomocy z krótkim FAQ (limity, usuwanie konta, zapomniane hasło, eksport danych). W apce wiersze „Pomoc i kontakt”, „Polityka prywatności”, „Regulamin” w Ustawieniach → O aplikacji i te same linki w stopce logowania. Gdzie hostować: [D2](#d2). | S |
| P0-5 | **Status sprzedawcy DSA niezadeklarowany** [sklep] | App Store Connect → Business → Trader status | Od 17.02.2025 Apple nie publikuje w UE apek bez tej deklaracji, czyli Cramfox nie wyjdzie w Polsce. Deklaracja „trader” publikuje adres, telefon i e-mail. | Na 1.0 (darmowa, bez IAP i reklam) „non-trader” jest do obrony; zmiana na „trader” przed zakupami w aplikacji. [D1](#d1). | S |
| P0-6 | **Brak konta demo i notatek dla recenzji** [sklep; BIBLIA §11.2#5] | `cloud-ui.js:20-32` (logowanie przed czymkolwiek), puste konto na starcie; trial z `0004` | Odrzucenie z 2.1. Recenzent czeka ok. 2 min na generację albo zdjęcie przypadkowego przedmiotu kończy się „AI nie dało rady”. Konto starsze niż 30 dni trafia na limit 3/mies. Recenzenci często testują „Usuń konto” na koncie demo, więc kolejne zgłoszenie pada na „cannot sign in”. | Konto `review@<domena>` z `profiles.plan='pro'` i `trial_until NULL` (`end_trials` je pomija), 2 gotowe przedmioty z postępem i serią. Notatki po angielsku: co robi apka, UI tylko po polsku, AI = Claude przez nasz serwer ze zgodą przed pierwszym wysłaniem, generacja ok. 2 min, brak płatności i IAP, gemy tylko zdobywane, ścieżka usuwania konta z prośbą o test na własnym koncie, gotowy polski tekst ok. 300 słów do wklejenia. Sprawdzać konto przed każdym zgłoszeniem. | S |

---

## 3. P1 i P2

### 3.1 P1 bez decyzji (wchodzą do Build 7)

**Backend i koszty**

| # | Problem | Gdzie | Skutek dla użytkownika | Poprawka | Wysiłek |
|---|---|---|---|---|---|
| P1-1 | **`/api/tutor` to otwarty proxy do Opusa** [backend; weryfikacja obniżyła z P0] | `apps/web/src/app/api/tutor/route.ts:11-16`; `packages/ai/src/tutor.ts:33` (8 ostatnich wiadomości z rolami wybranymi przez klienta, więc można podrobić odpowiedzi „asystenta”); `apps/web/src/lib/plan.ts:58` (pro bez limitu); `0004_cramfox.sql:112-120` (brak limitu globalnego) | Cramfox go nie używa (używa go stary web, `components/lesson/sheets.tsx:129`), a każde konto może w pętli wołać Opusa po ok. $0,06–0,10 za wiadomość: do ok. $90 na konto trialowe w miesiącu, bez sufitu dla pro i bez sufitu łącznego. | W produkcji zwracać 410, gdy `TUTOR_ENABLED !== '1'`, albo usunąć trasę i wpis w `vercel.json`. | S |
| P1-2 | **Cache promptu tylko kosztuje** [backend] | `packages/ai/src/generate.ts:191-199` (punkty cache), `:254`, `:276-277` (inny format wyjścia w każdej fazie), `:273-286` (wszystkie poziomy startują naraz) | Każde z 2N+1 wywołań Opusa płaci 1,25× za zapis prefiksu z materiałem, a żadne go nie czyta: zmiana formatu wyjścia psuje cache, a wpis jest czytelny dopiero od pierwszego strumienia. Cache kosztuje więc 25% więcej niż jego brak; przy 100-stronicowym PDF-ie to ok. $21 wejścia zamiast ok. $6. | Wystartować core i tasks poziomu 0, poczekać na pierwsze zdarzenie strumienia każdego z nich, dopiero potem poziomy 1..N-1. Wejście spada z ok. 13,75× do ok. 4,5× prefiksu. Logować `cache_read_input_tokens` i `cache_creation_input_tokens` osobno. Bez `cache_control` w wywołaniu outline (nikt go nie czyta). Zarezerwować kilka sekund w budżecie czasu. | S |
| P1-3 | **Kosztu nie da się zmierzyć** [backend; rozszerza BIBLIA §7.8#3] | `generate.ts:133-138` (wejście Opusa, zapis i odczyt cache oraz review Sonneta zsumowane w jedną liczbę); `review.ts:326-331` (przerwany review zapisuje 0); `route.ts:147` (porażka bez tokenów) | Właściciel nie wie z bazy, czy generacja kosztowała $0,50, czy $25, nie potwierdzi trafień cache i nie zbuduje limitu kwotowego. Od tej liczby zależą decyzje o cenach i limitach ([D4](#d4)). | Migracja: kolumny `opus_input`, `opus_cache_write`, `opus_cache_read`, `opus_output`, `review_input`, `review_output`, `cost_usd numeric(8,4)`, `quality jsonb`. Koszt z tabeli cen w `@nauka/ai`, sumowany z `usage.iterations`, gdy jest. Zapisywać także przy `failed`. Widok dziennego kosztu. | S |
| P1-4 | **Zabicie funkcji po 300 s** zostawia `running`, pobrany limit i czasem kasuje opłacony temat [backend, chmura; znane w BIBLIA §7.8#1 i §5.6, nowe: pełna poprawka i wyścig z `discard`] | `packages/ai/src/client.ts:12` (10 min × 3 próby); `generate.ts:114` (budżet tylko dla review); `route.ts:11,129-142`; `cloud.js:476`; `cloud-ui.js:302` | Limit pobrany, wiersz na zawsze `running`, klient dostaje stronę HTML 504, kasuje dziennik i nie odzyskuje. Gdy temat zapisze się tuż przed zabiciem, `discard()` usuwa nowy przedmiot, a kaskada usuwa opłacony temat. | Jeden termin: start + 270 s, przekazany jako `signal` i `maxRetries` (1, gdy zostało >120 s, inaczej 0) do każdego `stream`. Przy przekroczeniu kod `lost` albo nowy `ai_timeout` z mapowaniem w kliencie. Uwaga: **nie** `timeout`, bo klient pokazuje wtedy „Materiał nie został wysłany” (`cloud-ui.js:344`), co po pobraniu limitu jest nieprawdą. Sweeper w pg_cron co 5 min (`running` starsze niż 8 min → `failed`). Klient: odpowiedź ≥500 bez JSON-a = wynik nieznany, zostaw dziennik i uruchom `recoverJob`. Zapis tematu i statusu `done` w jednym RPC. | M |
| P1-5 | **Brak limitów na Storage i bazę dla jednego konta** [backend, chmura] | `supabase/migrations/0001_init.sql:199-205,226-229` (polityki FOR ALL bez limitów); `0005` (50 MB na plik); `maxSubjects` nieegzekwowane (`plan.ts:65`) | Jedno konto skryptem zapełnia 1 GB bucketu (wysyłka pada wszystkim) albo 500 MB bazy (Supabase przełącza ją w tryb tylko do odczytu, staje synchronizacja wszystkich). Nie trzeba do tego dotykać API ani limitu generacji. | Polityka INSERT na `storage.objects` jako **RESTRICTIVE** (zwykła PERMISSIVE sumuje się z FOR ALL i nic nie ogranicza), liczenie przez funkcję security definer. Limit **dzienny** (np. ≤60 obiektów i ≤500 MB na 24 h), a nie łączny, bo dopóki pliki zostają na zawsze ([D9](#d9)), aktywny uczeń przekroczyłby limit łączny. `CHECK (pg_column_size(content) < 1000000)` na `topics` jako NOT VALID albo po sprawdzeniu maksimum. Trigger z limitem przedmiotów i wierszy `materials` na właściciela. Alert rozmiaru bucketu. | M |

**Dane i synchronizacja**

| # | Problem | Gdzie | Skutek dla użytkownika | Poprawka | Wysiłek |
|---|---|---|---|---|---|
| P1-6 | **Świeże urządzenie może wyzerować postępy konta w chmurze** [chmura; potwierdzone uprzężą] | `cloud.js:398-400` (gałąź świeżego urządzenia ignoruje wynik `jset(PK)` i `jset(MK)`, choć `applyRow` w `:407` go sprawdza); `cloud.js:310-315` (push bez warunku) | Gdy localStorage nowego urządzenia nie przyjmie bloba (zalegający `cf_data` do 1,5 mln znaków, dane innego konta po wygaśnięciu sesji), silnik startuje z `{}`, zapisuje `{daily}`, a push z poprawnym `rev` nadpisuje cały postęp konta na wszystkich urządzeniach. Rzadkie, ale nieodwracalne. | Sprawdzać `jset` i `setBase`; przy błędzie `pulled=false`, pasek pamięci, zero pushy. W `push()` strażnik: jeśli lokalny stan stracił większość kluczy albo XP względem bazy przy tym samym `epoch`, nie wysyłać, tylko pobrać i scalić. Ten sam strażnik obsłuży uszkodzony `PK`. | S |
| P1-7 | **Zapisanie pytania w przeglądzie egzaminu psuje wynik** [silnik; potwierdzone] | `engine.js:1167` (`permQ` tasuje drugi raz i nie aktualizuje `pm`); `:2527`; `:2667-2672` (porównanie w innej kolejności); `:2643`; `:3689` (`onSaved` także bez zmian) | „Zgłoś / popraw” → ZAPISZ ZMIANY bez żadnej edycji: przy 4 odpowiedziach w ok. 75% przypadków dobra odpowiedź staje się zła. Spada ocena, nadpisuje się `rec.best`, pytanie trafia do talii błędów i do planu dnia, a „Twoja:” pokazuje inną odpowiedź niż wybrana. | Usunąć `permQ` (`mixQ` już tasuje) albo składać `pm` (`o.map(i => q.pm[i])`). Test regresji: zapis bez zmian nie zmienia `r.correct`. | S |
| P1-8 | **Zamrożenie serii nie działa po powrocie z tła** [silnik; potwierdzone] | `engine.js:3221` (`applyFreeze` tylko w `reload` `:3760` i `start` `:3766`); `touchStreak` `:108-117`; `cloud-ui.js:46-50` (`onResume` tylko `pull`) | WebView przeżył w tle dzień przerwy (częste na iOS): pierwsze XP ustawia serię na 1, a zamrożenie kupione za gemy zostaje niewykorzystane. Do tego Dziś pokazuje wczorajszy plan i nie pojawia się ekran powrotu ani podsumowanie tygodnia. | `applyFreeze()` na początku `touchStreak`. Handler `visibilitychange`/`resume` w silniku: przy zmianie dnia `applyFreeze`, `syncTests`, misje i `go(view, true)` na ekranie głównym (albo `start()`, żeby pokazać powrót lub tydzień), gdy nie trwa lekcja i nie ma otwartego arkusza. | S |

**Nauka i UX**

| # | Problem | Gdzie | Skutek dla użytkownika | Poprawka | Wysiłek |
|---|---|---|---|---|---|
| P1-9 | **Pasek „Brak sieci” nie znika i zasłania górny pasek** [setup #1, wygląd-04; znane w BIBLIA §3.15#1, nowe: zasłanianie] | `engine.js:3752` (nasłuchy `online` i `resize` wpadły do komentarza); `styles.css:1773` (`position:fixed; top:0; z-index:120`), `:2068` | Po powrocie sieci pasek zostaje, a w trakcie zasłania „Wróć” i pigułki (zrzuty 187–189). Storebar przy zablokowanej pamięci zasłania logo (204–205). | Przenieść kod za komentarzem do nowej linii. Pasek w przepływie (pierwsze dziecko `#app` albo `padding-top` przy `body.bar-on`), jedna linia przy 375 px („Brak sieci — postępy wyślą się później”). Storebar zwinięty do jednej linii z „Więcej”. | S |
| P1-10 | **„Wyjaśnij inaczej” pokazuje niezwiązaną fiszkę** [setup #2] | `engine.js:1106` (karta przechodzi przy `hit/tw.length >= .5`), `:1107-1113` (+2 dla fragmentu z hasłem tej karty) | Zaraz po złej odpowiedzi apka pokazuje „z Twoich materiałów” coś o innym pojęciu, bo dwuwyrazowe hasło z jednym ogólnym słowem („polityka”, „społeczna”) wygrywa (zrzuty 39, 122). Podważa to zaufanie do całej funkcji. | Dla haseł z ≤2 słowami kluczowymi wymagać wszystkich, dla dłuższych ≥2 trafień i ≥2/3 pokrycia. Pomijać rdzenie obecne w ponad ok. 25% haseł przedmiotu. Bonus tylko dla karty, która przeszła. Ukryć przycisk, gdy nic nie pasuje. Na pierwszym miejscu pokazać pole `real` najlepiej pasującej dawki (zatwierdzone „Powiedz prościej”, BIBLIA §10.3). | S |
| P1-11 | **Lekcję traci się jednym dotknięciem i nie da się do niej wrócić** [ux-01, nauka-16, nauka-17, silnik] | `engine.js:2214` (X → `closeLesson` bez pytania); `:1125` i `:1149-1152` („Do fiszek” w arkuszu wyjaśnienia i przy braku żyć zamyka lekcję bez wyniku); `:1143`; `:2203` (start zawsze od czatu) | Uczeń na pytaniu 8 z 11 po ok. 10 minutach dotyka „Do fiszek”, które wygląda jak pomoc, albo X: lekcja znika bez pytania, utracone życie zostaje utracone, powrót zaczyna się od „Część 1 z 6”. Powtórka i cram zapisują stan, lekcja jako jedyna nie. | `ask({title:'Przerwać lekcję?', text:'Postęp tej próby przepadnie.', ok:'Przerwij', cancel:'Zostaję'})` przy X, gdy `feedIdx > 0` albo faza pytań. Fiszki z lekcji jako nakładka z „Wróć do lekcji” (minimum: usunąć „Do fiszek” z arkuszy w lekcji). Zapis `lessonState` (faza, indeksy, kolejność, wynik, znaczniki) w sessionStorage lub PROGRESS i „Wróć do pytań” na węźle. Przy powtórce zaliczonego poziomu start od pytań z „Przeczytaj jeszcze raz”. | M |
| P1-12 | **Limit widać dopiero po przygotowaniu materiału, a szkic przepada** [ux-03, chmura] | `cloud-ui.js:244-274` (brak licznika na ekranie dodawania), `:280-286` (`draft=null` przed `C.me()` i sprawdzeniem liczby plików), `:353` (przy `limit_reached` brak „WRÓĆ DO MATERIAŁU”), `:156-158` (licznik tylko w Ustawieniach) | Po trialu licealista robi 5 zdjęć, pisze wskazówkę, dotyka TWÓRZ i dostaje „Limit na ten miesiąc wykorzystany — 3 z 3” z samym WRÓĆ (zrzut 202). Zdjęcia i wskazówka przepadają (`lastDraft` istnieje, ale nie jest proponowany). Szóste zdjęcie na free też odpada dopiero po TWÓRZ. | `C.me()` przy otwarciu arkusza dodawania (cache ok. 60 s). Na arkuszu i ekranie: „Zostały 2 z 3 nowe materiały w tym miesiącu · do 5 plików”. Przy 0 blokada przed aparatem z datą odnowienia. Licznik „x/5” nad miniaturami. Przy `limit_reached` zachować szkic i przycisk „WRÓĆ DO MATERIAŁU”. Tekst bez cen i „Pro” (3.1.1). | S |
| P1-13 | **Przedmiotu i materiału nie da się usunąć ani przemianować** [ux-04, chmura, produkt] | `cloud.js:441-444` (tylko `createSubject`/`updateSubject`); `cloud-ui.js:399-421` (nazwa i kolor tylko na jednorazowym ekranie „gotowe”), `:266` („pusty przedmiot” w „Gdzie dodać?”); `engine.js:894-899` | Zły PDF, rozmazane zdjęcie albo pusty „Poziom 1” zostają na zawsze w planie dnia, powtórce, fiszkach, albumie, egzaminie i u bossa. Zdjęcia z cudzym nazwiskiem nie da się usunąć. Jedyne wyjście to „Usuń konto”. Na koniec semestru nie da się niczego posprzątać. | Menu przedmiotu (⋯ w nagłówku): Zmień nazwę, Kolor, Materiały (lista tematów z datą; „Usuń ten materiał” = wiersz `topics` plus `materials` i pliki przez istniejące `discard`), Usuń przedmiot (potwierdzenie „danger”; tematy kaskadą, pliki, klucze postępów z prefiksem `sid`, `merge3` przeniesie usunięcie). Ostrzec, że przesuną się skrzynie (BIBLIA §3.15#4), i od teraz kluczować skrzynie po id poziomu. Puste przedmioty ukryć w „Gdzie dodać?” albo zaproponować ich usunięcie. RLS już pozwala właścicielowi usuwać. | M |
| P1-14 | **Nowy materiał ginie na ścieżce; „Rozdział N” to numer poziomu** [ux-05, wygląd-03] | `engine.js:1926` (`Rozdział ${curIdx+1}`); `:1957-1959` (każdy odblokowany, niezaliczony węzeł dostaje dymek ZACZNIJ i lisa); `:1898-1900`; `:1955`, `:3329` („Boss rozdziału” na końcu całego przedmiotu); `cloud-ui.js:418` | Po dodaniu „Wykładu 4” do przedmiotu w połowie: dwa „ZACZNIJ”, dwa lisy, żadnego znaku, gdzie zaczyna się nowy materiał. „ZACZNIJ NAUKĘ” przewija do starego poziomu (zrzut 160). Plan na kolokwium z wykładów 3–5 to zgadywanie, które tytuły z którego wgrania. | Jeden bieżący węzeł (pierwszy odblokowany, niezaliczony w kolejności ścieżki); inne początki rozdziałów tylko jako `.node-open`. Nagłówek przed pierwszym poziomem każdego tematu (styl `.chapter`, nazwa z `s.topics[k].name`, liczba poziomów). Górna karta: „<materiał> · Poziom n z m”. Po „gotowe” przewinąć do pierwszego poziomu nowego tematu. „Boss przedmiotu”. W planie sprawdzianu chipy zakresu pogrupowane po materiale. | M |
| P1-15 | **Krótkie nazwy przedmiotów się zlewają** [ux-06] | `cloud.js:211` (`shortOf`: pierwsze słowo, gdy nazwa ma ponad 14 znaków), używane w `engine.js:730` (kafelki), `:1864` (nagłówek), `:638` (plan), w powtórce, fiszkach i albumie | „Prawo cywilne” i „Prawo karne” to oba „Prawo” z tym samym monogramem; podobnie „Polityka…” i „Historia…” (zrzuty 88, 107). Student w sesji nie odróżni przedmiotów. | Pełna nazwa z obcięciem do 2 linii (CSS `line-clamp`) w kafelkach i wierszach. Tam, gdzie skrót jest konieczny, odciąć tylko wspólny prefiks w grupie kolizji („P. cywilne” / „P. karne”). Monogram z pierwszych liter dwóch pierwszych słów. | S |
| P1-16 | **Plan dnia ignoruje wybrany czas, a „opcjonalny” egzamin jest obowiązkowy** [ux-07, setup #16, nauka-12, produkt, wygląd-15] | `engine.js:615-631` (`buildDailyTasks`: 2 przedmioty × lekcja, powtórka, quiz, egzamin, słabe), `:649` („opcjonalnie”), `:3090-3092` (`planCheck` wymaga wszystkich), `:127` (cele 5/10/20 min) | Przy „Spokojnie 5 minut” plan to 7–8 wierszy, ok. 35–50 minut, w tym dwa identyczne „Powtórka — 12 fiszek” (zrzut 87). Bonus planu i misja „Wykonaj cały plan” wymagają codziennie 20-pytaniowego egzaminu oznaczonego jako opcjonalny. Plan jest praktycznie niewykonalny, więc apka codziennie mówi uczniowi, że zawiódł. Pierwszego dnia każe powtarzać fiszki, których jeszcze nie uczył. | Budżet według minut celu (lekcja 10, powtórka `ceil(n/4)`, quiz 2, egzamin 15, słabe 3). Kolejność: wiersz z planu sprawdzianu → zaległa powtórka (`min(due, 20)`, ukryta przy 0) → lekcja → quiz. Reszta pod „Jeśli masz czas”, poza licznikiem „x z y” i poza `planCheck`. Egzamin poza `planCheck` (albo tylko w dniu D-3 planu). Jeden scalony wiersz powtórki. Bez ukończonego poziomu tylko lekcja. Na Dziś maks. 4 wiersze i „Pokaż cały plan”. Format id zadań bez zmian. | M |
| P1-17 | **Fiszkę można ocenić „umiem” bez odwrócenia** [nauka-03; łączy się z silnik xp-farming] | `engine.js:2374-2376` (`next()` nie sprawdza `fState.flipped`), `:1770-1773` (to samo w powtórce), `:1678`, `:1680` (album od pudełka 3), `:1003` | 40 przesunięć w 15 s: +80 XP, zaliczona powtórka w planie i misja. Po czterech terminach wszystkie karty są „Utrwalone” i w albumie, choć odwrotu nikt nie przeczytał. 10 ślepych przesunięć oddaje życie. SRS, „Stan pamięci” i album przestają mówić cokolwiek o pamięci. | Ocena dostępna dopiero po odwróceniu (przesunięcie nieodwróconej karty ją odwraca, ocena ok. 1 s później). Zadanie serca, misja i plan liczą tylko odwrócone karty. Opcjonalnie od pudełka 2 tryb wpisywania (`typePool`, `lev()` z Ćwiczeń) i trzecia ocena „trudne” (pudełko bez zmian, termin +1). | S |
| P1-18 | **SRS nie zna daty sprawdzianu** [nauka-04] | `engine.js:1672-1679` (stałe interwały 0/1/3/7/21 dni); `:2772-2777` (`reviewItemsFor` zwraca tylko zaległe, jeśli są jakiekolwiek); `:2726-2730` (etykieta „Powtórka + zadania”) | Uczeń z planem na 10 dni: dni powtórki trwają 20 sekund, a dobrze opanowany materiał (pudełko 3–4, termin za 21 dni) nie wraca ani razu przed sprawdzianem. Etykieta obiecuje zadania, których nie ma. | Dla przedmiotu z testem w `srsTouch`: `due = min(normalny termin, data testu − 2)`. Dzień powtórki = zaległe plus najdawniej widziane z zakresu, łącznie 15–20, plus 2–3 zadania z poziomów. Po dacie testu normalne interwały. | M |
| P1-19 | **Brak przypomnień** [produkt, ux-08] | `native/package.json` (tylko `@capacitor/core` i `ios`); `cloud-ui.js:373` („dokończę w tle i dam znać”); `engine.js:976` | SRS, seria i plan do sprawdzianu działają tylko wtedy, gdy uczeń sam otworzy apkę. Seria pęka po cichu. „Dam znać” jest nieprawdą: po przejściu do innej apki nic nie przychodzi. | `@capacitor/local-notifications` (bez backendu). Prośba o zgodę po pierwszej ukończonej lekcji albo przy tworzeniu planu sprawdzianu, nie przy starcie. Przy każdym `pause` zaplanować 7 dni: jedno dzienne o wybranej porze z treścią wyliczoną przy planowaniu („12 fiszek do powtórki · seria 5 dni”), „seria zagrożona” ok. 20:30 tylko bez XP tego dnia, wieczór przed sprawdzianem. Przy „DZIAŁAJ W TLE” powiadomienie po 180 s, anulowane w `finishGen`/`failGen`. Przełącznik i godzina w Ustawieniach; maks. 1 dziennie poza wieczorem przed testem. | M |
| P1-20 | **Tarcie przy dodawaniu materiału** [produkt, ux-21] | `cloud-ui.js:222` (odrzuca `.doc`/`.docx`), `:205` (aparat: jedno zdjęcie na otwarcie), `:233` i `styles.css:1981` (pole tekstu 56 px, błąd nie znika przy pisaniu, zrzut 14), `:262-267` (z Dziś domyślnie „Nowy przedmiot”) | Notatki studenta w `.docx` są odrzucane (konwersja do PDF na iPhonie to trik z drukowaniem). Rozdział z 9 stron to 9 otwarć aparatu. Wklejonego tekstu nie widać. „Wykład 2” dodany z Dziś tworzy nowy przedmiot, stąd duplikaty nazw (zrzut 185). | DOCX po stronie serwera: `word/document.xml` z limitami ZIP z `pptx.ts`, MIME przez nową idempotentną migrację wgraną **po** wdrożeniu backendu. Pętla aparatu „Zrób kolejne / Gotowe” albo wybór wielu zdjęć z biblioteki. Pole tekstu na ok. 40% wysokości z licznikiem znaków, czyszczenie błędu przy pisaniu. Domyślnie ostatnio używany przedmiot albo pytanie „Pasuje do: Makro?”. Podniesienie limitu zdjęć na free: [D4](#d4). | M |
| P1-21 | **Hasło: część tymczasowa bez decyzji** [ux-10, chmura, sklep, produkt; pełny reset to [D8](#d8)] | `cloud-ui.js:70-104`, `:71` (domyślnie zakładka „Załóż konto”, także po wygaśnięciu sesji), `:108` | Zapomniane hasło = utrata wszystkiego bez możliwości kontaktu (zrzut 196). Użytkownik po wygaśnięciu sesji ląduje na „Załóż konto”. | Pod błędem logowania „Nie pamiętasz hasła? Napisz do nas” (mailto z P0-4). Przełącznik pokazywania hasła. Przed założeniem konta „Sprawdź adres: x@y”. Zakładka logowania jako domyślna, gdy na urządzeniu jest jakikolwiek `nauka_progress_v1:*`. | S |
| P1-22 | **Czas do pierwszego pytania 8–10 min: część bez decyzji** [ux-08, produkt, chmura; zmiany większe to [D14](#d14)] | `cloud-ui.js:368-395` (kroki co 24 s, pasek stoi przy ok. 95%), `:373-375` („dam znać”, „DZIAŁAJ W TLE”), `:310` i `styles.css:342` (toast „Lekcja gotowa” nieklikalny), `:418` (Gotowe → ścieżka, nie lekcja) | Ok. 12 dotknięć, 2–2,5 min czekania bez zajęcia, potem ścieżka i 6 części czatu przed pierwszym pytaniem. Generacja ponad 3 min wygląda na zawieszoną. W trakcie wysyłki plików „możesz wyjść” prowadzi do zerwania wysyłki i odrzucenia całości. | Tekst: „Możesz zamknąć ten ekran — lekcja pojawi się na Dziś”, przycisk „WRÓĆ DO DZIŚ”, w fazie wysyłki „Nie zamykaj aplikacji, dopóki pliki się wysyłają” (wyjście w tło dopiero w fazie AI). Po 150 s „Duży materiał — jeszcze chwila” i upływający czas. Klikalny toast „Lekcja gotowa”. Wiersz „Tworzę lekcję…” na Dziś prowadzący do ekranu postępu; [+] w tym czasie otwiera ten ekran zamiast toastu. „ZACZNIJ NAUKĘ” od razu otwiera poziom 1. | S |

**Wygląd**

| # | Problem | Gdzie | Skutek dla użytkownika | Poprawka | Wysiłek |
|---|---|---|---|---|---|
| P1-23 | **Toasty: ucięte, za krótkie, zasłaniają nagłówki i arkusze** [wygląd-01, setup #6, ux-22; znane w BIBLIA §3.15#9, nowe: ucinanie i kolejka] | `styles.css:342-343` (`white-space:nowrap`, `top:64px`, `absolute`); `engine.js:550` (1500 ms); toasty z opóźnieniem `engine.js:3440`, `:661`, `:3185`, `:3094`; długie wywołania `cloud-ui.js:168,210,223,315,416` | Komunikat o odrzuconym pliku ma 559 px przy ekranie 375 px (ucięty z obu stron) i znika po 1,5 s, więc nie wiadomo, czemu plik odpadł. „Odznaka…” wyskakuje w Ustawieniach albo nad błędem limitu, „Misja gotowa” nad arkuszem wyjaśnienia po złej odpowiedzi (zrzuty 39–40, 98, 202). | `white-space:normal; width:max-content; max-width:calc(100% - 32px); text-align:center`. Czas 1500 ms + 40 ms na znak, maks. 5 s. Pozycja nad dolnym paskiem (`bottom: calc(96px + env(safe-area-inset-bottom))`) albo nad arkuszem, gdy jest otwarty. Kolejka zamiast nadpisywania; nagrody pokazywane na najbliższym ekranie wyniku, a nie na timerach; cisza w lekcji i przy otwartym arkuszu. Toasty z akcją klikalne. Błędy plików i sieci w treści ekranu „Dodaj materiał”. | S |
| P1-24 | **Teksty pomocnicze nie spełniają kontrastu 4,5:1** [wygląd-02] | `styles.css:30-31` (`--muted-2 #6E67A8` ma 3,4–3,8:1, `--muted-3 #4E4778` ma 2,0–2,3:1), `:222` przebija zamierzone `:646`, `:338` (etykiety nawigacji 10,5 px), `:1923` (2,6:1) | Nazwy zablokowanych poziomów, przyszłe dni serii, zablokowane odznaki, etykiety dolnego paska i linia wersji są nieczytelne w słońcu. Sprzeczne z własną zasadą DESIGN.md. | `--muted-2: #8680BE` (4,75–5,37:1, nadal słabszy niż `--muted`). `--muted-3` tylko do ramek, kresek i ikon; usunąć regułę `:222` albo przepiąć na `--muted-2`. Etykiety nawigacji 11,5 px. `.wkstat span` w `--on-violet`. Token `--accent-ink: color-mix(in srgb, var(--accent) 70%, var(--txt))` do małego tekstu w kolorze przedmiotu. Sprawdzanie kontrastu w `test/dev/shoot.mjs`. | S |

**Sklep i prawo (części bez decyzji)**

| # | Problem | Gdzie | Skutek dla użytkownika | Poprawka | Wysiłek |
|---|---|---|---|---|---|
| P1-25 | **Komunikat o subskrypcji „kupionej poza aplikacją” przy usuwaniu konta** [sklep; znane w BIBLIA §8.6, §11.2#6] | `cloud-ui.js:184`; `0004_cramfox.sql:40-42` (wyjątek `active_subscription`); `engine.js:3126` (aria „Kup:”) | Jedyne naruszenie 3.1.1 w całym buildzie; do tego usunięcie konta jest wtedy niemożliwe w apce (5.1.1(v)). | „Nie możemy teraz usunąć tego konta automatycznie. Napisz do nas: <e-mail> — usuniemy je ręcznie.” Aria przycisku gemów: „Wymień 100 gemów na …”. Wyrażenie z BIBLIA §12.1 jako kontrola przed archiwum. Docelowo RPC anulujące subskrypcję i usuwające konto, gdy Stripe zostanie ([D5](#d5)). | S |
| P1-26 | **Zgoda na AI bez wersji i bez wycofania, bez wzmianki o USA** [sklep] | `cloud-ui.js:193-202` (zgoda), `:197` (tekst), `:201` (`M.aiConsent = todayStr()`) | RODO art. 7(3): wycofanie ma być tak proste jak udzielenie. Bez wersji nie da się wykazać, który tekst zaakceptowano (ważne przed zgodą v2 dla nagrań). Zgoda żyje tylko w blobie klienta. | Pole `META.aiConsentV = 1` (brak = 1, stare zapisy działają). Wersja wysyłana w body `/api/generate` i zapisywana w `generations.options`. Wiersz w Ustawieniach → Konto: „Zgoda na AI: udzielona <data> · Wycofaj” (czyści zgodę, arkusz wraca przy następnym materiale). Nowy tekst: „…trafią przez nasz serwer do modelu AI Claude firmy Anthropic (USA)…”; okres retencji i brak trenowania sprawdzić w aktualnych warunkach Anthropic przed publikacją. | S |
| P1-27 | **Google Fonts dostaje IP przy każdym starcie** [sklep, chmura, wygląd-25] | `engine.js:22` (loader); `build.js:27-28` (CSP); `cloud-ui.js:126` | IP i user agent do Google (USA) przed jakąkolwiek zgodą (LG München I, 3 O 17493/20). Pierwsze uruchomienie offline w zastępczym foncie i przeskok układu. | Woff2 (latin i latin-ext, tylko używane grubości: Bricolage 700/800, Plus Jakarta 500–800) jako `@font-face` z `data:` w `build.js` (CSP już pozwala na `font-src data:`). Usunąć loader, domeny Google z CSP i punkt „Czcionki” z arkusza. Licencja OFL w „Licencje”. Ok. 150–250 KB więcej w buildzie. | S |
| P1-28 | **Etykiety prywatności App Store** [sklep; BIBLIA §11.2#4] | App Store Connect → App Privacy | Pole wymagane; pominięcie zdjęć albo tekstu wysyłanego do Anthropic grozi odrzuceniem albo zdjęciem apki. | Tracking: No. Powiązane z użytkownikiem, cel „App Functionality”: Email Address; Photos or Videos; Other User Content (PDF, PPTX, tekst, wskazówka, nazwy, lekcje, poprawki pytań); User ID; Product Interaction (XP, seria, SRS). Niezbierane: lokalizacja, kontakty, diagnostyka, zakupy. Przy nagraniach dojdzie Audio Data. | S |

### 3.2 P1 wymagające decyzji

Te problemy są realne, ale poprawka zależy od wyboru właściciela. Opcje i rekomendacje są w rozdziale 4.

| # | Problem | Gdzie | Skutek dla użytkownika | Poprawka | Wysiłek |
|---|---|---|---|---|---|
| P1-29 | **Koszt generacji ok. 10× wyższy niż w dokumentacji**; limity i ceny do niego nie pasują [backend, produkt; weryfikacja obniżyła z P0, bo to szacunek] | `generate.ts:254,273-286` (2N+1 wywołań Opusa), `schema.ts:491` (`levels` od klienta do 8 → do 17 wywołań), `prompts.ts:83-86`, `plans.ts:20-37`, `nauka-backend/docs/DEPLOY.md:41` ($0,15–0,40) | Szacunek: $2–3 za typowe 5 zdjęć, $20–35 za 100-stronicowy PDF. Trial 150 generacji to do ok. $400 na konto; Pro za 29 zł (ok. $5 netto po VAT i prowizji) traci po 2–3 generacjach. Liczby do potwierdzenia pomiarem (P1-3). | Bez decyzji i od razu (w Build 7): ignorować `levels` z klienta (Cramfox i tak wysyła 4; maks. 6), `messages.countTokens` przed rezerwacją i odrzucenie powyżej ok. 150k tokenów jako `too_long` bez opłaty. Reszta: [D4](#d4). | M |
| P1-30 | **Stripe w trybie testowym na domenie produkcyjnej** [backend; weryfikacja obniżyła z P0] | `nauka-backend/docs/DEPLOY.md:9-19`; `api/stripe/checkout/route.ts:12-44`; `webhook/route.ts:30,43`; `0004_cramfox.sql:40,80,113-114` | Do sprawdzenia w panelu Vercela, czy `STRIPE_SECRET_KEY` jest testowy. Jeśli tak: przez stary web karta testowa 4242 daje trwałe pro (tutor bez limitu, brak końca triala), a takie konto nie da się usunąć w apce. | [D5](#d5). Rekomendacja: usunąć `STRIPE_*` z env Production (checkout, portal i webhook zwrócą 503), w webhooku odrzucać `livemode === false` na produkcji, anulować testowe subskrypcje prawdziwych kont. | S |
| P1-31 | **Pliki źródłowe trzymane na zawsze** [backend, chmura, sklep] | `route.ts:123-142` (brak sprzątania po sukcesie); `cloud.js:459-462` (sprzątanie tylko przy porażce); `cloud-ui.js:197` („możesz je usunąć razem z kontem”) | RODO art. 5 ust. 1 lit. c i e (minimalizacja, ograniczenie przechowywania). Darmowy 1 GB zapełni się po kilkudziesięciu PDF-ach i wtedy wysyłka pada wszystkim. Nic nie czyta tych plików po udanej generacji. | Po `done`: `admin.storage.from('materials').remove(...)` i usunięcie wierszy `materials` (`recoverJob` korzysta z `generations.material_ids`, które zostają); codzienny purge sierot starszych niż 24 h; `generations.hint` i `error` czyszczone po 90 dniach. Okres: [D9](#d9). | S |
| P1-32 | **Produkcja na darmowych planach** [backend] | BIBLIA §2.1 i §7.6; `0005_materials_50mb.sql:1-4`; `DEPLOY.md:63` | Supabase Free: brak kopii zapasowych do odtworzenia (utrata `app_state` i opłaconych tematów bez odzysku), 1 GB plików, 5 GB transferu, 500 MB bazy. Vercel Hobby: tylko użytek niekomercyjny (blokuje jakikolwiek przychód), 300 s. | [D10](#d10). | S |
| P1-33 | **Użytkownik płaci za awarie po naszej stronie** [backend; znane w BIBLIA §7.8#2, nowe: konkretne przypadki] | `generate.ts:221-229,254` (outline `max_tokens` 8000 z myśleniem adaptacyjnym); `route.ts:143-149`; `materials.ts:209` (liczba stron PDF tylko podpowiedzią) | 429/529 od Anthropic (często przez nasze własne równoległe wywołania), zabicie po 300 s, ucięty outline przy dużym PDF-ie („Materiał za duży”), PDF ponad 600 stron: użytkownik free traci 1/3 miesięcznego limitu. | Zwrot przez RPC przy `api` 429/5xx/529, przekroczeniu czasu i błędzie zapisu wiersza lub tematu (`generations.refunded`); bez zwrotu przy odmowie i za długim materiale. Outline `max_tokens` ok. 16k. Przed rezerwacją: magic bytes zgodne z MIME, strony PDF. Zasada zwrotów: [D4](#d4). | M |
| P1-34 | **Brak resetu hasła i potwierdzania maila: blokada konta i zajmowanie cudzych adresów** [ux-10, chmura, sklep, produkt; BIBLIA §4.1, §11.2#1-2] | `cloud.js:58-63` (rejestracja od razu z sesją), `:60` (`needs_confirm` rzuca „ta wersja jeszcze tego nie obsługuje”); `cloud-ui.js:70-104` | Zapomniane hasło = utrata przedmiotów i postępów, a bez sesji nie da się nawet usunąć konta. Literówka w mailu = konto nie do odzyskania. Ktoś może zarejestrować adres kolegi, a prawdziwy właściciel zobaczy tylko „To konto już istnieje”. Włączenie potwierdzania dziś zepsułoby rejestrację we wszystkich wydanych buildach. | [D8](#d8). Część tymczasowa jest w P1-21. | M |
| P1-35 | **Życia blokują naukę z własnego materiału** [ux-02, nauka-02, produkt] | `engine.js:2202` (bez życia nie zaczniesz), `:2256` (piąty błąd przerywa lekcję), `:988` (5 żyć, 30 min), `:1132-1146`; zadania wieloczęściowe zaliczane tylko bez błędu `:1335`, `:1392`, `:1506`, `:1633`, `:1657`; `:1475` („Nie pamiętam” = utrata życia) | Student o 23:00 przed kolokwium robi 5 błędów w trudnym materiale: „Koniec żyć”, lekcja przerwana, do 2,5 h przerwy. Ekran „Poziom niezaliczony” jest praktycznie nieosiągalny, bo piąty błąd przychodzi wcześniej. Przy 2 życiach realny próg to „najwyżej 1 błąd”, a nie 50%. Jedna pomyłka na 8 par kosztuje całe życie. | [D6](#d6). | M |
| P1-36 | **Ekonomia XP płaci za powtarzanie znanego, zgadywanie i szybkość** [nauka-01, silnik xp-farming, produkt, ux-15] | `engine.js:2248` (XP × combo), `:2311` (powtórki poziomu płacą pełne XP), `:2442` (Quiz +3 bez limitu), `:3054-3069` (szybki quiz +2 bez wyjaśnień i SRS), `:2610` (egzamin +40 przy ≥50% zaznaczonych), `:2375-2376`, `:3189`, `:1475` (podpowiedź kosztuje XP) | Idealna powtórka zaliczonego poziomu daje ok. 127 XP, a powtórka 20 zaległych elementów (to, co naprawdę buduje pamięć) maks. 50 XP. Losowe stukanie w szybkim quizie to 16 XP na 20 s, bez końca. Cel dzienny, misje i seria najtaniej osiąga się powtarzaniem znanego. | [D7](#d7). | M |
| P1-37 | **Wymyślona skala ocen jako „Zasady zaliczenia”; gotowość zawyżona** [ux-09, nauka-05] | `engine.js` `renderInfo` („Zasady zaliczenia”, „Siatka ocen”, „tu jesteś”), `:1866`; `:2837` (gotowość = 0,6 × poziomy + 0,4 × najlepszy wynik egzaminu z dowolnego zakresu); `:2612`; `cloud.js:279-280` (próg liceum 30%); `:2628`, `:2685` (konfetti i „Zdane, ocena 2”) | Licealista z 32% dostaje „Zdane, ocena 2” z pucharem. Student widzi „70–79% TU JESTEŚ 4”, choć jego kolokwium może mieć inne progi. Egzamin z jednego poziomu na 100% daje „gotowość 100%” do testu z czterech, i po dwóch tygodniach nadal 100%. Najcenniejsza treść dla ucznia przed testem (ściąga od AI) jest schowana pod małym (i). | [D13](#d13). | M |
| P1-38 | **Czas do pierwszej wartości: zmiany większe** [ux-08, produkt] | `cloud-ui.js:279-305`, `cloud.js:470-480` (synchroniczny POST czeka na cały temat); `engine.js:3466-3514` (2 ekrany onboardingu przed czymkolwiek); `design/DESIGN.md` §0 („pierwsze pytania po kilkunastu sekundach”) | Pierwsza sesja to miejsce największego odpływu, a tu ok. 12 dotknięć i 2–5 minut bez niczego do zrobienia. | [D14](#d14). Część bez decyzji: P1-22. | L |
| P1-39 | **Brak regulaminu i akceptacji przy rejestracji** [sklep] | `cloud-ui.js:79-86` (tylko checkbox 16+ i link do arkusza prywatności) | UŚUDE art. 8; brak podstawy dla limitów, zasad dotyczących treści (strony podręcznika tylko do użytku osobistego), zastrzeżenia „AI może się mylić”, reklamacji i obowiązków DSA (Cramfox przechowuje materiały, czyli jest usługą hostingu). | Regulamin: usługodawca, konto i 16+, darmowe limity (mogą się zmienić), licencja do treści tylko w celu świadczenia usługi, oświadczenie o prawie do materiałów, zakazane treści, AI może się mylić, dostępność, reklamacje e-mailem w 14 dni, usuwanie konta, punkt kontaktowy DSA i zgłoszenia, zmiany. Pod ZAŁÓŻ KONTO: „Zakładając konto, akceptujesz Regulamin. Zasady przetwarzania danych: Polityka prywatności.” Wersja w `data:{age16:true, tos:'2026-10'}` (`cloud.js:59`). Zależy od [D1](#d1) i [D2](#d2). | M |
| P1-40 | **16+ kontra „Liceum lub technikum · klasy 1–5”** [sklep, produkt] | `engine.js:3452` (LEVELS), `cloud-ui.js:82,99,127`; `design/DESIGN.md` §0–1 | Pierwszoklasiści mają zwykle 15 lat: apka ich zaprasza, a rejestracja wyklucza, więc albo odchodzą, albo zaznaczają nieprawdę. Wyliczona kategoria wiekowa w sklepie wyjdzie ok. 4+, czyli sklep pokaże apkę dzieciom, które ona sama wyklucza. | [D12](#d12). | S |
| P1-41 | **Wyróżnik (data sprawdzianu → plan → cram → egzamin w polskiej skali) jest schowany; cel z onboardingu nieużywany** [produkt, ux-20] | `engine.js:3452-3453` (cele matura/olimpiada/sesja zapisywane w `META.goal`, tylko wyświetlane `:876`); `openTestSheet` `:2799` osiągalne tylko z arkusza [+] i z ekranu „gotowe”; `subjects.exam_date` pobierane (`cloud.js:180`), nieużywane; `cloud.js:474` (wysyła tylko etap) | Licealista wybiera „Matura rozszerzona” i widzi ten sam ogólny plan co wszyscy. Na „notatki → fiszki” Cramfox nie wygra z Quizletem ani Knowtem; na „sprawdzian za 5 dni w polskiej skali ocen” nie ma konkurencji. | [D15](#d15). | M |
| P1-42 | **„Klif” po trialu** [produkt] | `apps/web/src/lib/plan.ts:41-50` (miesięczne użycie z triala liczy się do limitu free); `0004_cramfox.sql` (`handle_new_user`, `end_trials`); `cloud-ui.js:156-158` (trial tylko w Ustawieniach, liczba ucięta przez `min()`), `:323` | Rejestracja 20.10, koniec triala 19.11; 12 lekcji w listopadzie. Od 20.11 każdy nowy materiał kończy się „Wykorzystano 3 z 3” (prawdziwe 12 ukryte) na 11 dni, bez uprzedzenia i bez drzwi w tej ścianie. | [D3](#d3). | S |
| P1-43 | **Brak przychodu w apce** [produkt, sklep] | `native/package.json` (brak IAP); `plans.ts:20-37` (29/199 zł) | Przychód dziś to zero, a każdy aktywny użytkownik kosztuje. Pro przez Stripe na webie odblokowałby apkę bez IAP (3.1.3(b)). | [D4](#d4) (StoreKit przez RevenueCat, paywall zgodny z 3.1.2(c), Omnibus, status DSA „trader”). | L |
| P1-44 | **Tylko iOS przy ok. 69% Androida w Polsce** [produkt] | `native/package.json` (tylko `@capacitor/ios`); StatCounter, Polska, 08.2026 | W klasie 30 osób ok. 20 nie zainstaluje Cramfoxa. Polecenie przez nauczyciela i każda funkcja klasowa giną na pierwszym Androidzie. | [D19](#d19). | M |

### 3.3 P2 (lista zwarta)

**Silnik i nauka**
1. **typeterm akceptuje inne krótkie hasło** (ATP→ADP, DNA→RNA, PIT→CIT) [silnik; weryfikacja obniżyła z P1] `engine.js:1465,1480`, `finalize.ts:210` (zawsze `typo:1`). Tolerancja 0 do 4 znaków, 1 do 8, nigdy przy zmianie cyfry; „Prawie — poprawnie: X”. S
2. **Pusty albo samofiszkowy poziom zalicza się z 3 gwiazdkami i gemami** [silnik] `engine.js:2203,2233,2303-2315`; `finalize.ts:546`. Poziom z fiszkami → talia, zaliczenie po przejściu; pusty → komunikat bez nagród; backend bez pustego „Poziom 1”. S
3. **Luka bez `{n}` połyka kafelek** [silnik] `engine.js:1350-1369`; schemat `FillTaskSchema`. Sloty z obecnych placeholderów, nadmiarowe luki jako dystraktory; refine w backendzie. S
4. **match/order/sort oceniają po indeksie**, więc identyczne teksty liczą się jako błąd [silnik] `engine.js:1391,1426,1454`. Porównanie znormalizowanego tekstu, jak już w Ćwiczeniach (`:3050`). S
5. **Data planu sprawdzianu bez maksimum** (rok 2099 → 26,7 tys. wierszy, 1,34 MB postępu) [silnik] `engine.js:2805,2822,2726-2730`. `max` = dziś + 365, limit dni w `buildTestPlan`. S
6. **Podwójne dotknięcie przechodzi przez zmianę ekranu** (pominięte wyjaśnienie albo restart poziomu) [silnik] `engine.js:1020,1178-1187,2337-2340`. `lastAdv` w `openSheet`, `renderLesson`, `finishLesson`, `renderBoss`; `advOk()` w przyciskach stopek. S
7. **Sesja powtórki bez limitu** (150–300 elementów po tygodniu, pasek z kropek nieczytelny) [silnik, nauka-11] `engine.js:1691,1726,1752`. 20–25 na rundę i „Jeszcze N czeka”. S
8. **Timery liczą tyknięcia, nie czas**; stary timeout bossa po ucieczce [silnik] `engine.js:2529,2608,3352,1342,3597-3600,3345`. `endsAt` i `visibilitychange`; `bossState === bs`. M
9. **Konfetti przy ograniczonym ruchu zostaje jako kolorowe kwadraty** na pytaniach i tytułach [silnik, wygląd-07] `engine.js:1024-1027`; `styles.css:100,440`. Pusty fragment przy `calmMotion()`, `.confetti{display:none}` w obu wariantach, `applyMotion` respektuje `prefers-reduced-motion`, przenikanie zamiast obrotu 3D. S
10. **Kropki tygodnia i mapa aktywności gubią historię** po zamrożeniu i po przerwie [silnik, ux-25] `engine.js:840-855,940-942,3226`. Liczyć z `PROGRESS.history` i `META.frozenDays`. S
11. **Wstecz z przedmiotu i z powtórki zawsze do Dziś** [silnik, ux-12] `engine.js:1863,1698`. `goBack('today')`. S
12. **Zła litera u bossa po upływie czasu** [BIBLIA §3.15#2, nadal otwarte] `engine.js:3353`. Pokazać treść odpowiedzi jak `sheetBad`. S
13. **Luka w czacie da się przepisać z ekranu; licznik pojęć sam sobie przeczy** [nauka-08, ux-16] `engine.js:1996-2004,2165-2179,2146-2152,2196`. Zwinąć dawkę przed pytaniem albo pytać o poprzednią dawkę; dotknięcie pojęcia tylko pokazuje znaczenie. S
14. **Błędnie odpowiedziane pytania nie wracają w lekcji** [nauka-09] `engine.js:2251-2256`. Na końcu raz jeszcze, bez życia i bez wpływu na wynik. S
15. **6 losowych pytań bez pokrycia dawek; fiszki ze ścieżki nie trafiają do SRS** [nauka-10] `engine.js:1296,2260`. ≥1 pytanie na dawkę; po zaliczeniu poziomu fiszki i niezadane pytania do SRS z terminem na jutro. M
16. **SRS: zadania produkcyjne poza SRS, prawda/fałsz awansuje przy zgadywaniu, grupowanie po poziomie, copy „tuż przed zapomnieniem”** [nauka-11, setup #17] `engine.js:1166-1169,1675-1679,1691,1702`. T/F bez awansu, tasowanie w obrębie dnia, pierwszy błąd nie jest „lapsem”, interwały 45/90 dni, uczciwe copy; częstość T/F naprawić w finalizacji backendu (AI robi najdłuższą odpowiedź poprawną). M
17. **Boss i duch nagradzają szybkość zamiast czytania** [nauka-13] `engine.js:3306,3345,3333-3346,2242`. Czas zależny od długości, wyjaśnienie do DALEJ, błędy bossa do SRS lub talii błędów, duch bez czasu na arkuszach. S
18. **Lekcja za długa na telefon** (do 7 dawek i ok. 12 elementów) [nauka-17] `prompts.ts:15`, `engine.js:1297,2726-2729`. Maks. 3 zadania w lekcji, reszta w Ćwiczeniach; minuty planu z liczby dawek i elementów. M
19. **`games` generowane i nigdy niepokazywane** [nauka-07] `prompts.ts:15,20`, `schema.ts:473`, `cloud.js:269`. Usunąć z promptu dla nowych generacji (pole zostaje opcjonalne dla starych). S
20. **Ekrany wyniku nie mówią, co dalej** [ux-17] `engine.js:2318-2336,2636-2639`. „Do powtórki: 1 pytanie · 7 pojęć”; pasek straconych punktów zamiast celności; wiersze klikalne. S
21. **„Ten tydzień” porównuje część tygodnia z całym** („o 61% mniej” w środę) [setup #9] `engine.js:3527,3533`. Ten sam zakres dni; ikona trendu według znaku. S
22. **Cram liczy pominięte bloki** („4 z 4” przy 0 odpowiedzi) [setup #14] `engine.js:3651`. S
23. **Plan sprawdzianu zaniża czas i dubluje wiersze na Dziś** [ux-26] `engine.js:2726`. Ok. 10 min na poziom, nazwy poziomów w wierszach, bez lekcji dla tego samego poziomu w planie dnia. S
24. **Puste stany odbijają między pustymi ekranami** [ux-24] `engine.js:1830-1845,1724-1726,715,685-692`. Wspólny pusty stan z lisem i „Dodaj materiał”; „Mam sprawdzian” dopiero przy istniejącym przedmiocie; pigułki XP i gemów od pierwszego XP. S
25. **Onboarding pyta o rzeczy nieużywane** („Krok x z 3” przy 2 krokach, „10 minut” na sztywno) [ux-20] `engine.js:3453,3461-3462,976`. Zależnie od [D15](#d15): użyć celu albo go usunąć. S
26. **Ustawienia: changelog wersji, których nikt nie miał, „Cramfox 3.0” przy 1.0 w sklepie, brak pomocy i licencji** [ux-18, sklep] `engine.js:122,860-864,867-928`. Sekcje Konto / Nauka / Przedmioty / Pomoc / O aplikacji; wersja z `CFBundleShortVersionString`; zamiast changelogu „1.0 — pierwsze wydanie”; „Licencje” (Capacitor MIT, fonty OFL). S
27. **Teksty: obietnice bez pokrycia i błędy językowe** [ux-19, produkt, sklep, setup #10, #13]: „Pytasz o zgodę” → „Pytamy” (`cloud-ui.js:123`); „możesz wszystko poprawić przed startem” → „pytania poprawisz w trakcie nauki” (`engine.js:976`); „Zgłoś / popraw” → „Popraw pytanie” (`:1077`, `:2641`); „Przetłumacz albo wpisz” na przedmiocie niejęzykowym (`:2981`); „PRAWDA CZY FAŁSZ” nad Tak/Nie (`:1197`); „dodaj wyraźniejsze zdjęcia” po wklejonym tekście (`cloud-ui.js:336`); formy tylko męskie (`cloud-ui.js:65,182`, `engine.js:3591`); „Boss został z 3 życia” (`:3368`), „z sobą” (`:3412`), „twój rekord” (`:956`); udawane segmenty historii w podsumowaniu tygodnia (`:3530`); „Coś innego — języki” (`:3452`); „ta wersja jeszcze tego nie obsługuje” (`cloud-ui.js:113,169`). S
28. **Emoji z treści AI trafiają do UI** (wbrew zasadzie „zero emoji”) [setup #5, sklep] `cloud.js:198` (czat, info, fiszki), `:271` (`noEmoji` tylko w tytułach), `:468` (nazwa przedmiotu z AI bez `noEmoji`). `noEmoji` w węzłach tekstowych w `ser()` i przy zmianie nazwy; to samo w finalizacji backendu. S
29. **Treść AI nieoznaczona** (AI Act art. 50 ust. 2, od 2.08.2026) [sklep] `cloud-ui.js:404`, `engine.js:2191`. „Lekcje tworzy AI (Claude) z Twojego materiału. Może się mylić — sprawdzaj w źródle i poprawiaj pytania.” na ekranie „gotowe” i w info; znacznik `ai:{model, generatedAt}` w `topics.content`. S
30. **Brak widoku „Notatka”** do przeczytania poziomu bez czatu [produkt] czat `engine.js:2188`, blokada `:1898`. Arkusz z tytułami i treścią dawek, schematami i `real`, bez blokady ścieżki. S
31. **Brak pomiaru aktywacji, retencji i jakości** [produkt] Najpierw SQL tylko do odczytu na istniejących tabelach (aktywacja, kohorty D1/D7/D30 z `app_state.progress->'history'`, sukces i czas generacji, liczba poprawek pytań); potem tabela `reports` zapisywana przez „Popraw pytanie” (z informacją w polityce). S

**Chmura i iOS**
32. **Zgubiona odpowiedź na push liczy XP podwójnie** (100→130 zamiast 120) [chmura; weryfikacja obniżyła z P1] `cloud.js:311-319,396,333`. Przy istniejącym `cf_sent` najpierw pull; nie nadpisywać i nie usuwać `cf_sent` przed potwierdzeniem; `deviceId` w `client_ts`. M
33. **Postęp trzymany 3× w localStorage; ciche błędy zapisu i cichy stop przy 2 MB** [chmura] `cloud.js:173,303,312`; `engine.js:42,101`; `0004_cramfox.sql:14`. `cf_base`/`cf_sent` do IndexedDB, usuwać `cf_data` po udanym zapisie, pasek pamięci przy błędzie zapisu, obsługa 23514/413. M
34. **Synchronizacja przesyła całe bloby** [chmura] `cloud.js:306,314-315,391,178-182,478`. `select=rev,client_ts` przy PATCH, pull dwuetapowy, pobieranie tylko zmienionych tematów, użycie `d.topic` z odpowiedzi POST. M
35. **Nieaktualny start zużywa zamrożenia, których drugie urządzenie nie potrzebowało** [chmura] `cloud-ui.js:28`, `engine.js:3761-3767`. `applyFreeze` i ekran powrotu dopiero po pierwszym pull. S
36. **Oczekujące zmiany z chmury blokują każdy push** [chmura] `cloud.js:308-309`; `cloud-ui.js:35`. Przy `flush` zastosować `pending`, gdy nie trwa lekcja; ponownie uzbroić debounce. S
37. **Krawędzie `merge3`** (XP nowego przedmiotu z dwóch urządzeń, poprawki pytań jako zbiór, `epoch` z zegara urządzenia) [chmura] `cloud.js:333,344,346-350,378`. S
38. **`fetchAll` podmienia `DATA` w trakcie tworzenia przedmiotu; pierwszy start pobiera wszystko dwa razy** [chmura, setup #8] `cloud.js:182`; `cloud-ui.js:27,31,37`. Scalanie po id; pominąć pobranie w tle tuż po pobraniu startowym. S
39. **IndexedDB może zawisnąć; stary `cf_data` zostaje** [chmura] `cloud.js:170-177`; `cloud-ui.js:24-27`. `onabort`, limit czasu, `navigator.storage.persist()`. S
40. **Sieroty po zabiciu apki w trakcie wysyłki** [chmura] `cloud-ui.js:292-296`; `cloud.js:459-463,472`. Dziennik `phase:'upload'` przed `createSubject`, kolejka `cf_trash:<uid>`. S
41. **Porażka generacji w tle to ogólny toast i utrata szkicu** [chmura, setup #7] `cloud-ui.js:210,315`. Karta na Dziś z konkretnym tekstem błędu i „WRÓĆ DO MATERIAŁU”. S
42. **Heurystyka `not_started` po 90 s może skasować przedmiot, który serwer jeszcze przetwarza** [chmura; BIBLIA §5.2] `cloud.js:493`; `route.ts:115`. Wiersz `queued` na początku żądania (enum już to wspiera). M
43. **Odwołana sesja: 1,5 s „Serwer chwilowo nie odpowiada”; zgubiona odpowiedź odświeżenia wylogowuje** [setup #3, chmura] `cloud.js:68-73`; `cloud-ui.js:27,29`. 400 z `refresh_token` → ekran logowania; 1–2 ponowienia w oknie 10 s. S
44. **Pętla logowania przy zablokowanym localStorage** [setup #4] `cloud.js:56`; `cloud-ui.js:101` (zrzuty 204–205). Sprawdzić wynik zapisu i pokazać komunikat zamiast przeładowania. S
45. **`/api/me` z limitem czasu 310 s** [chmura] `cloud.js:159`. 15 s dla `/api/me`, 310 s tylko dla generacji. S
46. **Dane zostają na innych urządzeniach po usunięciu konta** [chmura] `cloud.js:505,70`. Czyścić klucze danego uid, gdy odświeżenie pokaże, że konta już nie ma; dopisać do tekstu usuwania. S
47. **Podwójne klucze storyboardu w Info.plist** [chmura, sklep; BIBLIA §3.2] Na iOS 26.5 tylko jeden WebView, iOS 16/17 niesprawdzone. Usunąć `UIMainStoryboardFile` i `UISceneStoryboardFile`, test na iOS 16.4; dopisać do CLAUDE.md zakaz zmiany `iosScheme`, `hostname` i `appId` bez migracji danych. S
48. **Klawiatura przesuwa cały WebView pod pasek stanu** [chmura] `native/capacitor.config.json` (`scrollEnabled:false`). `@capacitor/keyboard` albo `scrollTo(0,0)` przy `focusout`; test logowania i arkusza tekstu. S

**Backend**
49. **Nieudane żądania są darmowe i bez limitu** (każde pobiera do 150 MB i parsuje PPTX do 30 s) [backend; weryfikacja obniżyła z P1] `intake.ts:72-89`; `route.ts:88-100`. Limit prób na godzinę i dobę przed pobraniem. S
50. **Klient może pisać do `topics`** [backend; weryfikacja obniżyła z P1] `0001_init.sql:199-200`. Tylko SELECT (i DELETE dla P1-13); uwaga na stary web (`new-topic.tsx:265`). S
51. **Dane osobowe w logach i w `generations.error`** (fragmenty notatek, nazwy plików) [backend] `generate.ts:296,345-348`; `route.ts:112,146-147`. S
52. **Surowe błędy bazy i AI do klienta, 500 bez kodu** [backend; BIBLIA §7.8#13] `route.ts:71,107,120,144-149`; `tutor/route.ts:36,47`. S
53. **`search_path = public` w funkcjach security definer** [backend] `0004_cramfox.sql:63,75,99`; `0002_gamification.sql:51,69`. Migracja z `ALTER FUNCTION … SET search_path = ''` (bez ponownego uruchamiania 0001/0002). S
54. **Otwarte przekierowania** w `proxy.ts:39`, `auth/callback/route.ts:9` (`/\evil.com`, także z tabulatorem) i `login-form.tsx:12` [backend; rozszerza BIBLIA §8.7#4]. Parsować `new URL(n, origin)` i wymagać tego samego `origin`. S

**Wygląd**
55. **Nagłówek przedmiotu: „Po…”, 2 z 5 zakładek poza ekranem, ok. 25% ekranu** [setup #12, wygląd-05, ux-13] `engine.js:1864-1879`; `styles.css:204-207,607-622` (zrzuty 116, 222). Nazwa w 2 liniach, zakładki jako siatka 5 kolumn (ikona nad etykietą 11 px), zwinięty nagłówek w trakcie zadania; Quiz jako pierwsza karta Ćwiczeń z wyborem 10/20/wszystko. Gemy i serca w nagłówku: [D23](#d23). M
56. **Natywne kontrolki w jasnym stylu** (chipy na „Dodaj materiał”, biały checkbox 16+, autofill) [wygląd-06] `styles.css:126,2430,2412`; `build.js:35-38`. `color-scheme: dark`, `theme-color`, własny checkbox, style autofill, `textarea{resize:none}`. S
57. **Kolizja klasy `.cram`** psuje kartę „Egzamin jutro?” [wygląd-08] `styles.css:1930`; `engine.js:2505` (zrzut 126). Zawęzić do `.scroll.cram` albo zmienić modyfikator. S
58. **Etykiety węzłów leżą na trasie ścieżki** (ok. 1,1:1) [wygląd-09] `styles.css:220,644`. Płaski chip z tłem. S
59. **Licznik w nagłówku czatu poza ekranem przy 360 px** [wygląd-10] `styles.css:2619-2623`. `.chattop .grow{flex:1; min-width:0}`. S
60. **Długie teksty AI rozpychają stałe pojemniki** (skala ocen, album, pary, wpisywanie) [wygląd-11] `styles.css:1873-1875,1637,375,356`. S
61. **Schematy: słowa łamane w środku, drzewo bez łączników, słaby kontrast akcentu** [wygląd-12, setup #11] `styles.css:2425,2729,2737,2763-2766`. `overflow-wrap:break-word; hyphens:auto`, łącznik dla każdej grupy, `--accent-ink`. S
62. **Lis wychylający się z arkusza zasłania czytaną treść** [wygląd-13] `styles.css:2165`; `engine.js:1059,1073`. Lis w nagłówku arkusza. S
63. **Nagłówek Dziś: lis na liczniku, dwa podobne paski bez etykiet** [wygląd-15, setup #15] `styles.css:2166-2167,463-466,1763-1766`. S
64. **Ćwiczenia na komponentach 1.0** (inne pary, szybki quiz, przycisk sprawdzania z ptaszkiem w treści ekranu) [wygląd-16] `styles.css:274-288,356-379`; `engine.js:542,2943-2956`. Gry na `quizBlock`/`taskBlock` w pełnoekranowej powłoce lekcji. M
65. **Przyciski różnią się wielkością liter, miejscem i kolorem** (wylogowanie w limonce) [wygląd-17] `engine.js:980,1049,2165`. S
66. **Cele dotyku poniżej 44 px** (usuwanie miniatury 28 px, pojęcia w czacie 22 px) [wygląd-18]. S
67. **Ikony o złym znaczeniu** (celownik zamiast okularów, „wstecz” przy wylogowaniu, strzałka w górę przy spadku) [wygląd-19] `engine.js:207,880,3114,3537`; `cloud-ui.js:153`. S
68. **Pełnokolorowe ekrany a safe area** (paski pod Dynamic Island) [wygląd-20] `styles.css:1895,560,2066-2067`. Do sprawdzenia w symulatorze. S
69. **Postęp lekcji jako 16–17 kropek** [wygląd-22] `engine.js:2215`. Ciągły pasek. S
70. **Stopki ucinają treść ekranów wyniku bez sygnału** [wygląd-23] `styles.css:756,2436`. S
71. **`styles.css` warstwowy i częściowo martwy** (zdublowane selektory, martwe `.blob*` sprzeczne z „bez kół w tle”) [wygląd-24]. Konsolidacja i kontrola duplikatów przy `build.js`. M
72. **Zablokowany zoom i brak Dynamic Type** [sklep] `build.js:38`. Skalowanie tokenem `--fs` albo `-apple-system-body`. M

---

## 4. Decyzje dla właściciela

Każda pozycja: czego dotyczy, opcje i moja rekomendacja. Pozycje D1–D11 dotyczą wydania i pieniędzy (warto je podjąć teraz), D12–D25 kształtu produktu.

<a id="d1"></a>
**D1. Kto jest administratorem danych i sprzedawcą; status DSA** (P0-3, P0-5, P1-39)
- Opcje: osoba fizyczna jako „non-trader”; działalność nierejestrowana; JDG.
- Rekomendacja: na 1.0 (darmowa, bez IAP i reklam) osoba fizyczna i „non-trader”, ta sama tożsamość w polityce i regulaminie. Przed zakupami w aplikacji JDG albo działalność nierejestrowana, status „trader” i adres korespondencyjny lub wirtualne biuro (żeby nie publikować adresu domowego). Jedna konsultacja z prawnikiem przy polityce i regulaminie się opłaci.

<a id="d2"></a>
**D2. Gdzie hostować politykę, regulamin i pomoc; skrzynka kontaktowa** (P0-3, P0-4, P1-39)
- Opcje: własna domena; strona na Vercelu pod obecnym adresem; GitHub Pages lub Notion.
- Rekomendacja: własna domena z adresem `pomoc@`. Ta sama domena będzie potrzebna do SMTP ([D8](#d8)) i do metadanych sklepu.

<a id="d3"></a>
**D3. Trial: wielkość, farmienie i „klif”** (P0-2, P1-42)
- Opcje: (a) zostawić 30 dni i 150 generacji; (b) mniejszy trial, np. 10 generacji łącznie i 3 na dobę, plus `trial_ledger` i osobna pula globalna; (c) trial dopiero po potwierdzeniu maila, CAPTCHA albo App Attest.
- Rekomendacja: (b) od razu, (c) gdy będzie SMTP. Klif: po końcu triala limit free liczyć tylko z generacji po `trial_until`, baner na Dziś 3 dni przed końcem i w dniu końca („Od jutra 3 nowe materiały w miesiącu”), konkretny tekst błędu tuż po trialu. Bez cen i „Pro” do czasu IAP.

<a id="d4"></a>
**D4. Koszt, model, limity, zwroty i ceny** (P1-29, P1-33, P1-43, część P1-20)
- Opcje modelu: zostać przy Opus 5; Opus 5.5 ($4/$20, odczyt cache 0,05×, ok. −20%); wywołanie zadań na Sonnet 5.5 ($2/$10). Limity: Pro 150/mies. albo 30–40/mies. Ceny: 29 zł/mies. albo 39–49 zł/mies. lub plan tygodniowy. Zwroty: brak albo przy awariach po naszej stronie.
- Rekomendacja: najpierw pomiar (P1-3 i SQL tylko do odczytu na `generations`), potem eval Opus 5.5 i Sonnet 5.5 dla zadań na zestawie prawdziwych materiałów. Zwrot przy 429/5xx/529, przekroczeniu czasu i błędzie zapisu; bez zwrotu przy odmowie i za długim materiale. Pro najwyżej 30–40 generacji w miesiącu. Ceny ustalić dopiero razem z IAP (StoreKit przez RevenueCat, mapowany na `profiles.plan`; paywall z ceną, okresem, odnawianiem i linkami; gemy tylko do zdobycia). Limit zdjęć na free można podnieść do ok. 10, bo zdjęcia są tanie w porównaniu z tokenami wyjścia.

<a id="d5"></a>
**D5. Stripe na webie** (P1-30, P1-25)
- Opcje: zostawić test; wyłączyć; przejść na live.
- Rekomendacja: wyłączyć teraz (usunąć `STRIPE_*` z Production). Web Pro odblokowujący apkę łamie 3.1.3(b), a tryb testowy daje darmowe trwałe pro. Gdyby sprzedaż na webie miała wrócić: deduplikacja zdarzeń po `event.id`, kolejność zdarzeń, jedna subskrypcja na użytkownika.

<a id="d6"></a>
**D6. Życia** (P1-35)
- Opcje: (a) zostawić; (b) bez żyć w lekcjach (przy 0 tryb treningowy bez combo, zawsze ekran wyniku), życia tylko u bossa; (c) 15 żyć i 10 min odnowienia; (d) bez żyć przy aktywnym planie sprawdzianu i 48 h przed testem.
- Rekomendacja: (b), razem z częściowym zaliczaniem zadań wieloczęściowych (zaliczone od 80% części, życie tylko poniżej 50%), ponownym zadaniem błędnych pytań na końcu lekcji i „Nie pamiętam” bez kary. W Duolingo życia sprzedają subskrypcję; w Cramfoxie są czystym tarciem na materiale, za który uczeń zapłacił limitem. Klucz `PROGRESS.hearts` zostaje w danych bez zmian.

<a id="d7"></a>
**D7. Zakres grywalizacji i ekonomia XP** (P1-36; soczewki ux-15, ux-23, nauka-01, silnik, produkt)
- Opcje: (a) zostawić wszystkie ok. 18 systemów; (b) rdzeń plus stopniowe odsłanianie; (c) twarde cięcie gemów, sklepu, misji, albumu, ducha i skrzyń.
- Rekomendacja: (b). Rdzeń: seria z zamrożeniami, jeden plan dnia (wchłania cel XP i misje), powtórka, boss jako „Test przedmiotu”, ciche odznaki w profilu, podsumowanie tygodnia. Reszta odsłaniana później z jednozdaniowym wyjaśnieniem przy pierwszym kontakcie (misje od 3. dnia, sklep po pierwszych gemach, duch tylko przy powtórkach). XP: pełne tylko za pierwsze przejście, zaległe powtórki i odzyskane błędy; powtórka poziomu 1 XP bez combo z dziennym limitem; combo zastąpić premią za celność na koniec; szybki quiz XP raz dziennie przy ≥60%; egzamin +40 przy ≥80% odpowiedzi i najwyżej raz na 3 dni; misje odbierane automatycznie; podpowiedź bez kosztu. Ukrywanie UI nie wymaga migracji kluczy.

<a id="d8"></a>
**D8. Konto: reset hasła, potwierdzanie maila, logowanie** (P1-34)
- Opcje: SMTP i reset kodem OTP (bez deep linków); strona resetu z deep linkiem; Sign in with Apple; włączenie potwierdzania.
- Rekomendacja: SMTP (Resend albo Postmark na własnej domenie, SPF/DKIM, polskie szablony) i reset 6-cyfrowym kodem OTP w następnym buildzie po 7, razem z Sign in with Apple (bez hasła, naturalne dla apki tylko na iOS). Obsługa `needs_confirm` („Sprawdź skrzynkę”, „Wyślij ponownie”) w tym samym buildzie; samo potwierdzanie włączyć dopiero, gdy większość ma ten build. Do tego czasu ręczne resety przez skrzynkę z P0-4.

<a id="d9"></a>
**D9. Retencja materiałów źródłowych** (P1-31)
- Opcje: usuwać zaraz po udanej generacji; po 7 dniach; po 30 dniach; trzymać do usunięcia przedmiotu.
- Rekomendacja: zaraz po udanej generacji plus codzienne sprzątanie sierot starszych niż 24 h. Nikt nie czyta tych plików po sukcesie. Zapisać tę zasadę w polityce i w tekście zgody. Gdyby kiedyś doszło „Otwórz plik” albo „Wygeneruj ponownie”, wtedy 30 dni.

<a id="d10"></a>
**D10. Plany Supabase i Vercel** (P1-32)
- Opcje: zostać na darmowych; Supabase Pro ($25/mies.); Vercel Pro ($20/mies.).
- Rekomendacja: Supabase Pro przed publicznym wydaniem (kopie zapasowe, 100 GB plików, 250 GB transferu). Vercel Pro przed jakimkolwiek przychodem (Hobby jest tylko do użytku niekomercyjnego). `maxDuration` podnosić dopiero razem z `readTimeout` klienta (310 s) i progami dziennika (330 s); do tego czasu wewnętrzny termin 270 s z P1-4.

<a id="d11"></a>
**D11. Region funkcji na Vercelu**
- Opcje: zostawić domyślny (najpewniej `iad1`, USA); przypiąć `fra1`.
- Rekomendacja: sprawdzić w panelu i przypiąć `fra1` (`preferredRegion` albo `regions` w `vercel.json`). Krótsza droga do Supabase we Frankfurcie, a jedynym przystankiem w USA zostaje Anthropic, co trzeba opisać w polityce.

<a id="d12"></a>
**D12. Wiek: 16+ kontra „klasy 1–5”** (P1-40)
- Opcje: zostać przy 16+ i poprawić etykietę na „matura, sprawdziany”; zejść do 13+ ze zgodą rodzica.
- Rekomendacja: 16+. Etykieta bez zakresu klas, poprawka w DESIGN.md, uczciwy kwestionariusz wieku w App Store Connect (bez „Made for Kids”), podstawa przetwarzania przez AI z art. 6 ust. 1 lit. b, a arkusz zgody jako krok przejrzystości. 13+ wymaga zgody rodzica i opinii prawnika: nie w wersji 1.

<a id="d13"></a>
**D13. Skala ocen i „gotowość”** (P1-37)
- Opcje: zostawić; skala „przykładowa” z edytorem progów; ukryć oceny i pokazywać tylko procent.
- Rekomendacja: ekran info przemianować na „Ściąga” i pokazać nad ścieżką (to najcenniejsza treść przed testem). Skalę opisać „Przykładowa skala — ustaw progi z sylabusu”, z edytorem progów na przedmiot; do czasu ustawienia „Wynik 72% · próg 50%”. Nigdy „Zdane” z konfetti poniżej 50%. Gotowość = najnowszy pełny egzamin (pierwsze podejście dnia, spadek ok. 10% na tydzień) + udział elementów z zakresu w pudełku ≥2 i niezaległych + udział zaliczonych poziomów. Wyniki egzaminu zapisywane z zakresem.

<a id="d14"></a>
**D14. Czas do pierwszej wartości** (P1-38)
- Opcje: przykładowa lekcja wbudowana w build (S); generacja „najpierw poziom 1” (outline i poziom 1 synchronicznie, reszta w `after()`, L); pytanie o cel dzienny dopiero po pierwszej lekcji (S); w czasie czekania pytanie „Kiedy masz z tego sprawdzian?” i 3 karty „Jak działa lekcja” (S).
- Rekomendacja: wszystkie, w kolejności: przykładowa lekcja (pomoże też recenzji), pytanie o datę w czasie czekania, cel po pierwszej lekcji, a podział generacji po Build 7.

<a id="d15"></a>
**D15. Egzamin w centrum produktu** (P1-41, P2 25)
- Opcje: zostawić plan sprawdzianu jako funkcję poboczną; zrobić z daty sprawdzianu główny obiekt.
- Rekomendacja: główny obiekt. Onboarding pyta „Kiedy masz najbliższy sprawdzian albo kolokwium?” (data i przedmiot, do pominięcia), pierwszy materiał trafia do tego testu, plan tworzy się sam, na Dziś odliczanie („Biologia · za 4 dni · gotowość 62%”), `META.goal` idzie do backendu jako wskazówka, data zapisywana też w `subjects.exam_date`. Opisy w sklepie od „Masz sprawdzian? Zrób zdjęcie notatek…”.

<a id="d16"></a>
**D16. Dolna nawigacja**
- Opcje: zostawić Dziś · Powtórka · + · Fiszki · Profil; zmienić na Dziś · Przedmioty · + · Powtórka · Profil.
- Rekomendacja: zmienić. Przedmioty to główny obiekt apki z własnymi materiałami, a Powtórka i hub Fiszek dublują tę samą kolejkę. Fiszki zostają zakładką w przedmiocie i filtrem w Powtórce.

<a id="d17"></a>
**D17. Blokada ścieżki i próg zaliczenia**
- Opcje: zostawić liniową blokadę i 50%; „Przeskocz tutaj” z potwierdzeniem; test „Sprawdź, czy już umiesz” (8 pytań, ≥85%); wszystko otwarte dla studiów lub przy aktywnym planie; próg 70%.
- Rekomendacja: „Sprawdź, czy już umiesz” i „Przeskocz tutaj” (gwiazdki dopiero po wcześniejszych poziomach); blokada zostaje dla skrzyń i bossa. Próg 70% dopiero razem z częściowym zaliczaniem z [D6](#d6).

<a id="d18"></a>
**D18. Słownik pojęć w UI**
- Opcje: (a) Przedmiot → Materiał → Lekcja → Część; (b) Przedmiot → Materiał → Poziom → Część.
- Rekomendacja: (a), bo „lekcja” uczeń już zna z przycisku. Jedno wgranie to „materiał” („Nowe materiały: 1 z 3 w tym miesiącu”, „Materiał gotowy”), na ścieżce „Lekcja 3 z 9”, w czacie „Część 2 z 6”, „Boss przedmiotu”. Znikają „Roladka”, „dawki” i „Rozdział N”. Przy limicie dziennym „Spróbuj za kilka godzin” (okno jest kroczące 24 h).

<a id="d19"></a>
**D19. Android**
- Rekomendacja: tak, przez `@capacitor/android` z tym samym jednym plikiem HTML (M): przycisk wstecz → `goBack`, wybór plików, pasek stanu, Google Play Billing przez tę samą warstwę co IAP. Kolejność: po Build 7 i IAP, przed funkcjami klasowymi.

<a id="d20"></a>
**D20. Etap 2: nagrywanie wykładów**
- Rekomendacja: odłożyć za powiadomienia, pierwszą wartość, IAP z naprawą klifu i kontrolę nad treścią. To parytet z StudyFetch i Kiwi, głównie dla studentów, a nagrywanie nauczycieli w liceum jest wrażliwe. Tani test popytu: wgrywanie pliku `.m4a` z Dyktafonu istniejącą ścieżką materiałów, za flagą dla etapu „studia”.

<a id="d21"></a>
**D21. Jakość pytań: przenoszenie wiedzy, zestaw egzaminacyjny, przedmioty ścisłe, języki**
- Rekomendacja: od razu (S) `content.lang` ustawiane w backendzie z kategorii materiału (ożyją gry językowe, które silnik już ma). W prompcie co najmniej 1/3 pytań na nowym przykładzie i poluzowane kryterium 9 review. Później osobny zestaw `exam` (8–12 pytań przekrojowych, nigdy w lekcjach) dla egzaminu i bossa (L) oraz `mathsteps` dla matematyki, fizyki i chemii (M).

<a id="d22"></a>
**D22. Pole `mnemo`** (pole `real` jest już zatwierdzone jako „Powiedz prościej”, BIBLIA §10.3)
- Opcje: pokazywać jako „Zaczep pamięciowy”; usunąć z promptu i review.
- Rekomendacja: pokazywać, gdy niepuste. Koszt zerowy, a treść przeszła już kontrolę jakości.

<a id="d23"></a>
**D23. Drobne decyzje wizualne**
- Lis na ekranach błędów i zakończeń (nastrój „oops” przy błędach, „sleep” offline i po cramie, „happy” na wynikach) i lis z akcesoriami jako awatar w profilu. Limonka tylko dla jednej głównej akcji na ekranie (zaznaczenia jako jasne tło z ramką). Nagłówek przedmiotu bez gemów, serca tylko na Ścieżce.
- Rekomendacja: tak dla wszystkich trzech; niskie ryzyko, wyraźny zysk.

<a id="d24"></a>
**D24. Udostępnianie przedmiotu klasie**
- Rekomendacja: tak, ale po Androidzie (L): tabela `subject_shares` z kodem i RPC security definer kopiujące tylko `topics.content`, bez wywołania AI i bez limitu; zdjęcia podręcznika nigdy nie są udostępniane.

<a id="d25"></a>
**D25. Metadane App Store**
- Rekomendacja: nazwa „Cramfox” (po sprawdzeniu w UPRP/EUIPO), podtytuł np. „Lekcje i fiszki z notatek”, bez „Duolingo”, „Claude” i „Anthropic” w nazwie, podtytule i słowach kluczowych, kategoria Edukacja, na start tylko Polska, zrzuty z prawdziwej apki (iPhone 6,9”).

---

## 5. Co działa dobrze i trzeba zachować

**Produkt**
- Trafny rdzeń: konto startuje puste, [+] jest na środku nawigacji na każdym ekranie, nowy materiał dopisuje się do przedmiotu jako odblokowany rozdział. To pasuje do polskich uczniów, z których każdy ma inny podręcznik.
- Plan do sprawdzianu (dzień po dniu, przeliczany codziennie, z egzaminem próbnym w D-3, słabymi punktami w D-2 i cramem w D-1), cram „Noc przed egzaminem” z „Idź spać” i egzamin próbny w polskiej skali z talią błędów. Tego nie ma żaden zagraniczny konkurent.
- Ludzka seria: zamrożenia, ekran powrotu („Bez dramatu… 5 minut”), podsumowanie tygodnia.
- W UI nie zostało nic z ery wbudowanych przedmiotów (katalog, liga, znajomi, „Wkrótce”). Tak ma zostać: nie budować ligi ani znajomych.

**Nauka**
- Pytania bez podglądu treści: faza pytań zastępuje czat (`engine.js:2229-2262`).
- „Dlaczego” przy dobrej i złej odpowiedzi; prompt wymaga powodu i wyjaśnienia kuszącego dystraktora.
- Blokada SRS przed awansem za wczesne „umiem” (`engine.js:1677`), album dopiero od pudełka 3.
- Egzamin z flagami, siatką pytań, potwierdzeniem z listą pustych i oflagowanych, wyjaśnieniami na końcu i talią błędów, która wraca do powtórki.
- Ekran końca powtórki z dokładną listą, co wróci dziś, i wyborem „POWTÓRZ TE 3” albo „NA DZIŚ WYSTARCZY”.
- Czat dzieli wiedzę na krótkie, oznaczone porcje; ukończone części zwijają się do nagłówków; schematy są budowane z danych, ugruntowane i czytelne przy 360 px.
- Źródło ze stroną i cytatem oraz poprawianie pytań przez ucznia (działa w lekcji, quizie, egzaminie i powtórce).
- Boss to jedyne przekrojowe sprawdzenie wszystkich poziomów; warto zachować tę rolę.

**Bezpieczeństwo, dane i chmura**
- Sanitizer `clean()` z listą dozwolonych tagów i CSP z hashami skryptów bez `unsafe-inline`; z danymi `topic-xss` żaden skrypt się nie wykonał.
- Synchronizacja z CAS na `rev` nadawanym przez serwer, zasada „nigdy push przed pierwszym pull”, rozpoznawanie własnego zapisu po `client_ts`, `epoch` dla resetu.
- `fixProgress` i `fixMeta` traktują zsynchronizowany stan jako niezaufany; teksty pokazywane z postępów pochodzą ze słowników, nie z zapisu.
- Dziennik generacji z odzyskiwaniem, zero automatycznych ponowień `POST /api/generate` (15 na 15 prób w scenariuszu błędów), nieudana generacja sprząta przedmiot, wiersze i pliki.
- Wysyłka TUS w kawałkach po 6 MB, wznawiana od HEAD, z przypiętym hostem Supabase.
- Wylogowanie czyści dane danego uid; usuwanie konta w dobrej kolejności (próba na sucho, pliki, RPC, kaskada).
- Daty odporne na zmianę czasu (DST) i północ; tasowanie Fishera–Yatesa; indeksy zadań stabilne dzięki `_skip`.

**Backend**
- Każda trasa sprawdza uwierzytelnienie przed pracą; brak IDOR (odczyty przez klienta z RLS, pobieranie plików ograniczone `materials_path_owner`).
- Kolejność przyjmowania materiałów: lista MIME → wstępne sprawdzenie → prawdziwy rozmiar → rozpakowanie PPTX → budżet tekstu → dopiero opłata. Za zły plik się nie płaci.
- Solidna obrona przed zip-bombami w PPTX; atomowy licznik miesięczny; klient nie podniesie sobie planu ani `trial_until`; poprawne `delete_my_account`; webhook Stripe weryfikuje podpis; brak sekretów w repo.

**Wygląd i ton**
- Płaska ciemna paleta z grubymi cieniami zgodna z `tokens.css`, bez gradientów; czytelne kodowanie kolorem trybów (fiolet egzamin, bursztyn seria, cyjan powtórka).
- 14 typów zadań zgodnych z makietami 2.0; sukces i błąd pokazane kolorem, ramką i ikoną naraz.
- Lis wpleciony w całą apkę bez emoji; spójne arkusze potwierdzeń zamiast systemowych okien.
- Safe area obsłużona tam, gdzie trzeba; układ trzyma się przy 360 px bez poziomego przewijania.
- Polszczyzna: poprawne znaki diakrytyczne w ok. 600 tekstach, ciepły i rzeczowy ton, liczba mnoga przez `pl()`, uczciwe komunikaty o limicie („Limit się nie zmienił” kontra „Ta próba liczy się do limitu”).

**Sklep**
- Usuwanie konta w apce (5.1.1(v)), zgoda na AI z nazwą dostawcy przed pierwszym wysłaniem i bez obejścia (5.1.2(i)), brak SDK śledzących, poprawne `ITSAppUsesNonExemptEncryption`, zdjęcia zmniejszane do 1568 px bez EXIF, dane w UE (Frankfurt).

**Narzędzia testowe (nowe)**
- Atrapa backendu `test/dev/mock-backend.js` i sterownik zrzutów `test/dev/shoot.mjs` pozwalają w ok. 400 s przejść całą apkę bez dotykania produkcji. Dziś są nieśledzone w gicie: warto je zacommitować i dopisać do BIBLIA §9.5.

---

## 6. Rekomendowany plan

### 6.0 Dziś, bez kodu (ok. 1 godzina, właściciel)

1. Miesięczny limit wydatków i alerty w workspace Anthropic, w którym jest klucz produkcji (najtańszy bezpiecznik dla P0-1, P0-2 i P1-1).
2. W panelu Vercela: czy `STRIPE_SECRET_KEY` jest testowy (bez `vercel env pull`); jeśli tak i zgadzasz się z [D5](#d5), usunąć `STRIPE_*` z Production.
3. W panelu Vercela: region funkcji ([D11](#d11)).
4. Zapytanie tylko do odczytu w Supabase: mediana i p90 `input_tokens` i `output_tokens` z `generations` od 2026-10-07 (z zastrzeżeniem z P1-3), żeby oprzeć [D4](#d4) na liczbach.

### 6.1 Build 7

Build 7 to wszystkie P0 i P1 bez decyzji o wysiłku S lub M, plus zatwierdzone już „Powiedz prościej”. Kolejność wdrożeń: **migracje addytywne (nowe RPC, kolumny) → backend, który ich używa → zaostrzenia polityk w bazie (po sprawdzeniu, że build 6 dalej działa) → build apki.** Szacunek: S ≈ pół dnia, M ≈ 2 dni.

**A. Backend (najpierw)**
1. P0-1 `reserve_generation` w jednej transakcji (M, migracja).
2. P1-1 wyłączenie `/api/tutor` w produkcji (S).
3. P1-29, część bez decyzji: `levels` z klienta ignorowane (4, maks. 6), `countTokens` przed rezerwacją (S).
4. P1-2 rozłożenie startu wywołań, żeby cache był czytany (S).
5. P1-3 kolumny kosztu i jakości (S, migracja).
6. P1-4 termin 270 s, `maxRetries`, sweeper w pg_cron, zapis tematu i `done` w jednym RPC (M, migracja).
7. P1-5 limity dzienne na Storage (polityka RESTRICTIVE), `CHECK` na `topics`, limit przedmiotów (M, migracja zaostrzająca, wgrać po wdrożeniu).

**B. Apka: dane użytkownika**

8. P1-6 strażnik przed wyzerowaniem postępów (S).
9. P1-7 edycja pytania w przeglądzie egzaminu (S).
10. P1-8 zamrożenie i zmiana dnia po powrocie z tła (S).
11. P1-4, część kliencka: odpowiedź ≥500 bez JSON-a = wynik nieznany, odzyskiwanie zamiast `discard` (S).

**C. Apka: najboleśniejsze UX i formalności w kodzie**

12. P1-9 pasek „Brak sieci” (S).
13. P1-23 toasty (S).
14. P1-24 kontrast (S).
15. P1-10 „Wyjaśnij inaczej” plus pole `real` jako „Powiedz prościej” (S).
16. P1-11 przerwanie i wznowienie lekcji (M).
17. P1-17 fiszka dopiero po odwróceniu (S).
18. P1-12 limit widoczny przed przygotowaniem materiału, szkic zachowany (S).
19. P1-15 pełne nazwy przedmiotów (S).
20. P1-22 ekran tworzenia lekcji: teksty, faza wysyłki, klikalny toast, wiersz „Tworzę lekcję…”, „ZACZNIJ NAUKĘ” do poziomu 1 (S).
21. P1-21 hasło, część tymczasowa (S).
22. P1-25 komunikat przy usuwaniu konta (S).
23. P1-26 wersja i wycofanie zgody na AI (S).
24. P1-27 fonty w buildzie (S).
25. P0-3 i P0-4 w apce: linki „Polityka prywatności”, „Regulamin”, „Pomoc i kontakt” w Ustawieniach i na ekranie logowania (S; adresy z [D2](#d2)).

**Kreska minimum.** Jeśli trzeba wydać szybciej, A + B + C to minimum przed szerszym TestFlightem i zgłoszeniem do App Store; D może wyjść jako build 7.1.

**D. Apka: warstwa „po utworzeniu” i nauka**

26. P1-13 usuwanie i zmiana nazwy przedmiotu i materiału (M).
27. P1-14 nagłówki materiałów na ścieżce i jeden bieżący węzeł (M).
28. P1-16 plan dnia według celu (M).
29. P1-18 SRS a data sprawdzianu (M).
30. P1-19 lokalne przypomnienia (M; nowy plugin, `npm run sync`, test na urządzeniu).
31. P1-20 DOCX, wiele zdjęć, większe pole tekstu (M; migracja MIME po wdrożeniu backendu).

**Przy okazji (P2 po kilka minut, warto dorzucić do C):** kolizja `.cram` (P2 57), nagłówek czatu przy 360 px (59), konfetti przy ograniczonym ruchu (9), „Pytamy o zgodę” i inne poprawki tekstów (27), `color-scheme: dark` (56), litera u bossa (12), 400 przy odświeżeniu → logowanie (43), klucze storyboardu (47).

**Szacunek:** A ok. 7–8 dni, B ok. 2 dni, C ok. 7 dni, D ok. 12 dni. Do kreski ok. 3 tygodnie pracy jednej osoby, całość ok. 5–6 tygodni. Z agentami piszącymi kod wąskim gardłem będą przegląd zmian, testy w symulatorze i wdrożenia.

**Weryfikacja Build 7:** `node test/dev/shoot.mjs` (wszystkie scenariusze, zero błędów konsoli, jeden POST na próbę, pasek offline znika), test regresji dla P1-7 i P1-6 (uprzęże z audytu), smoke test na urządzeniu według BIBLIA §9.5, kontrola regexem z BIBLIA §12.1 na `build/nauka-all.html`, otagowanie commita jako build 7.

### 6.2 Formalności przed zgłoszeniem do App Store (równolegle z Buildem 7)

1. [D1](#d1): kto jest administratorem i sprzedawcą.
2. [D2](#d2): domena, skrzynka `pomoc@`, strona pomocy.
3. Polityka prywatności (P0-3) i regulamin (P1-39) po polsku pod stałymi adresami.
4. App Store Connect: status DSA (P0-5), Privacy Policy URL, Support URL, linia copyright.
5. Etykiety prywatności (P1-28); Tracking: No.
6. Kwestionariusz wieku zgodnie z [D12](#d12); bez „Made for Kids”; kategoria Edukacja.
7. Szyfrowanie: zadeklarowane w plist, sprawdzić, że nie ma pytania.
8. Dostępność: Polska, cena darmowa, bez IAP.
9. Metadane według [D25](#d25), zrzuty z prawdziwej apki.
10. Konto demo i notatki dla recenzji (P0-6); na produkcji sprawdzić, że klucz Anthropic jest ustawiony (bez banera „tryb demo”).
11. Smoke test na urządzeniu: świeża instalacja → rejestracja → zgoda → wklejony tekst → lekcja; aparat; tryb samolotowy; wylogowanie i logowanie; usunięcie konta od początku do końca; iPad w trybie zgodności.
12. Otagować commit, który staje się buildem 7.

### 6.3 Dalsze kroki (po Build 7)

| Kolejność | Krok | Decyzje | Wysiłek |
|---|---|---|---|
| 1 | Trial (mniejszy, `trial_ledger`, osobna pula) i naprawa klifu po trialu | [D3](#d3) | M |
| 2 | Reset hasła kodem OTP, SMTP, Sign in with Apple, obsługa `needs_confirm` | [D8](#d8) | M |
| 3 | Supabase Pro przed publicznym wydaniem; sprzątanie plików po generacji | [D10](#d10), [D9](#d9) | S |
| 4 | Życia, ekonomia XP i zakres grywalizacji; słownik pojęć | [D6](#d6), [D7](#d7), [D18](#d18) | M |
| 5 | Egzamin w centrum, przykładowa lekcja, skala ocen jako „Ściąga” | [D15](#d15), [D14](#d14), [D13](#d13) | M |
| 6 | Pomiar kosztów, wybór modelu, zwroty, potem IAP z paywallem i Vercel Pro; status DSA „trader” | [D4](#d4), [D1](#d1) | L |
| 7 | Nawigacja z zakładką Przedmioty, blokada ścieżki z testem „czy już umiesz” | [D16](#d16), [D17](#d17) | M |
| 8 | Widok „Notatka”, pomiar retencji (P2 30, 31) | – | S |
| 9 | Generacja „najpierw poziom 1” | [D14](#d14) | L |
| 10 | Android | [D19](#d19) | M |
| 11 | Etap 2: nagrywanie wykładów (najpierw test popytu przez `.m4a`) | [D20](#d20) | L |
| 12 | Udostępnianie przedmiotu klasie | [D24](#d24) | L |

Pozostałe P2 warto zbierać partiami po kilka do każdego kolejnego buildu, zaczynając od błędów silnika (P2 1–8) i chmury (P2 32–37).

---

## 7. Załącznik

### 7.1 Zrzuty ekranu

- **Lista:** `/private/tmp/claude-501/-Users-ignacykrasnodebski-nauka-app/d748e67f-76ff-44ab-be43-822bd37cb883/scratchpad/audit-shots/INDEX.md` (228 zrzutów, ok. 25 MB; plik → stan → jak do niego dojść; numery użyte w tym dokumencie).
- **Dodatkowe zrzuty z soczewki wyglądu:** `…/scratchpad/audit-shots-extra/` (43 pliki, m.in. ucięty toast `extra-visual-toast-375-1.png` i ścieżka z drugim materiałem `extra-visual-chapter-open-0.png`).
- **Uwaga: to katalog tymczasowy** w `/private/tmp`, który zniknie po restarcie albo sprzątaniu. Żeby zachować zrzuty, skopiuj je poza `/private/tmp`. Odtworzenie zajmuje ok. 400 s:

```bash
cd /Users/ignacykrasnodebski/nauka-app/test && npm install
node dev/shoot.mjs --out <katalog>                 # wszystkie scenariusze
node dev/shoot.mjs --only fresh,errors --out <katalog>   # wybrane
# ręcznie: python3 -m http.server 8765 w katalogu repo,
# potem http://localhost:8765/test/dev/?mock=seeded&reset=1
```

- **Czego zrzuty nie pokazują:** ekranu awarii silnika przy starcie, zadania hotspot (celowo `_skip`), gier językowych (produkcja nie ustawia `lang`), odzyskiwania `not_started` i `lost`, rzeczy natywnych (aparat, Pliki, safe area, HEIC na iOS 16), kamieni milowych innych niż 7 dni i synchronizacji dwóch urządzeń.

### 7.2 Korekty do BIBLII (do następnej aktualizacji)

- „Najważniejsze na dziś” pkt 1 i §10.2 są nieaktualne: kod jest zacommitowany (apka `3cd366b` i `8f65ec3`, backend `5a8097b`).
- §5.5: koszt generacji jest zaniżony mniej więcej dziesięciokrotnie (szacunek do potwierdzenia pomiarem). Ponowienie przy błędzie gramatyki nie jest płatne podwójnie: pierwsza próba kończy się 400, a odpowiedzi 4xx nie są rozliczane.
- §3.2: podwójny WebView nie wystąpił na iOS 26.5 (jeden „Loading app”); iOS 16 i 17 niesprawdzone.
- §3.15: dopisać P1-7, P1-8, P1-10 oraz P2 1–12.
- §8.7: dopisać tutor (P1-1), Stripe w trybie testowym (P1-30), brak limitów Storage (P1-5) i drugie otwarte przekierowanie w `auth/callback` (P2 54).
- §11.2: dopisać regulamin, status DSA, Support URL, Google Fonts i zgodę na AI z wersją.
- §9.5: dopisać atrapę backendu i `shoot.mjs` (po zacommitowaniu `test/dev/`, `test/package.json`, `test/package-lock.json`, `test/.gitignore`).

### 7.3 Weryfikacja ustaleń

Ustalenia silnika, chmury i backendu przeszły osobną weryfikację; żadne nie zostało odrzucone. Zmiany priorytetu po weryfikacji:

| Ustalenie | Soczewka | Było | Jest |
|---|---|---|---|
| Stripe w trybie testowym (P1-30) | backend | P0 | P1 |
| Otwarty `/api/tutor` (P1-1) | backend | P0 | P1 |
| Koszt generacji (P1-29) | backend | P0 | P1 |
| Pętla nieudanych żądań (P2 49) | backend | P1 | P2 |
| Zapis do `topics` przez klienta (P2 50) | backend | P1 | P2 |
| Podwójne liczenie XP przy zgubionej odpowiedzi (P2 32) | chmura | P1 | P2 |
| Tolerancja literówki w typeterm (P2 1) | silnik | P1 | P2 |

Weryfikacja poprawiła też trzy proponowane poprawki: kod błędu przy przekroczeniu czasu nie może być `timeout` (P1-4), polityka limitu na Storage musi być RESTRICTIVE (P1-5), a filtr przekierowań musi odrzucać też znaki sterujące (P2 54). Przed spisaniem tego dokumentu kluczowe odwołania (`engine.js:3752`, `:1106`, `:1167`, `:2527`, `:108-117`, `cloud.js:396-401`, `cloud-ui.js:184`, `styles.css:342`, `:1930`, `0004_cramfox.sql:99-120`, `route.ts:115`) zostały ponownie sprawdzone w kodzie.
