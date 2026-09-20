# Recall — logika produktu (v2)

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

## Gamifikacja v2 (`packages/shared`: combo, hearts, gems, daily, quests, achievements, rank)
- **Combo** (`combo.ts`): kolejne poprawne odpowiedzi w lekcji (gry + quiz). Od 5 → XP ×2, od 10 → ×3. Badge w nagłówku lekcji, dźwięk przy progu. `stats.comboBest`.
- **Serca** (`hearts.ts`): 5, −1 za błędną odpowiedź w quizie lekcji (nie w grach, egzaminie ani w „Dziś”). 0 serc = quiz kończy się jako niezaliczony; start lekcji przy 0 sercach blokuje modal (czekaj / 150 💎 / Pro). Regeneracja 1 serce / 30 min (`heartsUpdatedAt`). „Dziś” przywraca +1. **Pro = ∞ serc** (hook monetyzacyjny).
- **Klejnoty** (`gems.ts`): +5 poziom, +10 perfect, +20 skrzynka, +50 trofeum, +25 egzamin, +5 sesja, +10 cel dzienny, + nagrody z questów i odznak. Wydatki: refill serc 150, streak freeze 100.
- **Skrzynki i trofeum**: skrzynka po każdym 3. poziomie (`chestIndexes`), otwieralna gdy poziomy do niej są zaliczone; trofeum na końcu ścieżki. Zapis w `progress.chests`.
- **Cel dzienny** (`daily.ts`): 20/50/100 XP (`user_meta.daily_goal`), ring na Home, bonus 10 XP raz dziennie (`stats.goalBonusDay`). Dziennik `activity(user_id, day)` przez `log_activity(xp, minutes, day)`.
- **Misje dzienne** (`quests.ts`): 3 dziennie, deterministyczne z hash(userId, dzień), zapis w `quests_daily`. Zdarzenia: xp, answer, review, level, game, minutes. Odbiór nagrody ręczny.
- **Odznaki** (`achievements.ts`): 16 kluczy (pierwszy temat, seria 3/7/30, 100/500 fiszek, perfect, combo 10, 1k/10k XP, egzamin, 10 misji, 5 skrzynek, nocny marek, ranny ptaszek). Zapis w `achievements`.
- **Rangi** (`rank.ts`): z total XP: Nowicjusz 0 → Uczeń 250 → Ogarniacz 750 → Mózg 1500 → Ekspert 3000 → Mistrz 6000 → Legenda 12000 → Recall 25000. Modal level-up przy zmianie.
- **Ranking tygodniowy**: RPC `weekly_leaderboard(limit)` / `my_weekly_rank()` (security definer, tylko display_name + XP, opt-out `profiles.show_on_leaderboard`). Zakładka Ranking w obu apkach.
- **Streak freeze**: 1 dzień przerwy nie zeruje serii, gdy user ma freeze (`touchStreak` → `usedFreeze`).
- **Maskotka Rec** (`mascot.ts`) i **dźwięki** (`sfx.ts`, `user_meta.sound_on`).
