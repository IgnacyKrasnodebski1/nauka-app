# NAUKA — logika produktu (v2)

## Model
- **Przedmiot** (`subjects`) = kontener użytkownika: „Matematyka”, „Biologia”, „Makroekonomia”. Wybierany w onboardingu z `CURRICULUM[stage]` (shared) albo wpisany ręcznie. Ma emoji, kolor (`paletteFor(name)`), etap, opcjonalną datę sprawdzianu (`exam_date`, `exam_label`). Startuje pusty.
- **Temat** (`topics`) = jednostka wygenerowana przez AI w obrębie przedmiotu (np. Biologia → „Fotosynteza”). `content` = `TopicContent` (levels → feed, flashcards, games, quiz, grading, info). Źródło: `materials` (zdjęcia/PDF/tekst) albo `prompt` (samo hasło, AI robi wg podstawy programowej).
- **Postępy** per temat: `progress(user_id, topic_id)` (xp, levels, weak, best_exam), `srs_cards(user_id, topic_id, card_key)`, `user_meta` (streak), `activity(user_id, day)` (xp, minuty) przez RPC `log_activity`.
- Brak trybu gościa i cudzej biblioteki. Logowanie wymagane (magic link / Google / hasło).

## Ekrany (web `/app/...`, mobile analogicznie)
1. **Onboarding** (po pierwszym logowaniu): etap → wybór przedmiotów (chipsy z `CURRICULUM[stage]` + „własny”) → tworzy `subjects`. Zapis `profiles.stage`.
2. **Home `/app`**: karta **„Dziś”** (z `buildDailySession`: N fiszek do powtórki, M słabych pytań, 1 nowy poziom, ~X min, przycisk Start → `/app/today`), streak 🔥 / XP ⚡, siatka przedmiotów (emoji, nazwa, liczba tematów, % poziomów, badge „sprawdzian za 3 dni” gdy `exam_date`), „+ przedmiot”.
3. **Przedmiot `/app/s/[subjectId]`**: nagłówek w kolorze przedmiotu; sekcja **Sprawdzian** („Mam sprawdzian” → data + nazwa → plan z `buildExamPlan`: lista dni z zadaniami, odliczanie); lista **tematów** (karta: emoji, nazwa, poziomy zrobione/wszystkie, gwiazdki, źródło); CTA **„📸 Z materiałów”** i **„✍️ Z hasła”** → `/app/s/[subjectId]/new?mode=materials|prompt`; **Fiszki** (wszystkie tematy, SRS) i **Egzamin** z całego przedmiotu (`pickExam` po wszystkich tematach); usuń przedmiot.
4. **Nowy temat `/app/s/[subjectId]/new`**: tryb `materials` (upload jak dotąd + opis) lub `prompt` (pole „np. fotosynteza, klasa 7”), liczba poziomów 2–6, przełącznik „język obcy”. `POST /api/generate` → `{ topicId }` → `/app/t/[topicId]`.
5. **Temat `/app/t/[topicId]`**: dotychczasowy „subject shell”: Ścieżka / Fiszki / Quiz / Egzamin / Info — działa na temacie.
6. **Lekcja `/app/t/[topicId]/l/[levelId]`**: feed → fiszki → mini-gry → quiz → wynik. Po quizie: `applyQuizResult`, `markWeak` (zapis `progress.weak`), `log_activity(xp, minutes)`, `touchStreak`.
7. **Dzisiejsza sesja `/app/today`**: przechodzi po `DailySession.items`: fiszki (ocena 0–3 → `review()` → `srs_cards`), słabe pytania (odpowiedź → aktualizacja `weak`), na końcu link do nowego poziomu. Ekran końcowy z XP.
8. **Konto `/app/account`**: etap, plan + zużycie (`/api/me`), Pro (Stripe), portal, wyloguj.

## Landing
Hero: „Wrzucasz notatki albo wpisujesz temat — AI robi z tego lekcje jak w Duolingo”. 3 kroki: wybierz przedmioty → dodaj temat (zdjęcia/PDF/hasło) → ucz się 10 min dziennie. Sekcje: etapy (`STAGES`), „Mam sprawdzian” (plan), Dzisiejsza sesja, cennik (`PLANS`), FAQ. CTA → `/login`. Bez „wypróbuj bez konta” i bez cudzych przedmiotów.
