# Nauka 2.0 — przewodnik wdrożenia designu

Handoff z projektu wizualnego: **59 ekranów + zestaw stylów**. Czytaj razem z `../CLAUDE.md`.

- `preview/index.html` — galeria wszystkich ekranów pogrupowana tak jak na canvasie. Ekrany są klikalne między sobą.
- `preview/<Ekran>.html` — pojedynczy ekran 390×844, samodzielny plik.
- `tokens.css` — zmienne motywu, keyframes i przepisy na komponenty. Źródło prawdy dla kolorów i ruchu.

Podglądy są **referencją wizualną**, nie kodem do wklejenia — style inline, zero logiki.

---

## 0. Rdzeń produktu

Każdy uczeń i student ma inne podręczniki i inne materiały. Dlatego **tworzenie lekcji
z własnego materiału jest główną funkcją, nie dodatkiem**:

- plus na środku dolnej nawigacji otwiera „Dodaj materiał" z każdego ekranu;
- domyślna droga to **zdjęcie strony z podręcznika** (skaner z wykrywaniem rogów i wieloma stronami);
- AI rozpoznaje przedmiot, dział i poziom — użytkownik tylko potwierdza;
- nowy materiał domyślnie dokleja się jako **nowy poziom** do istniejącego przedmiotu;
- pierwsze pytania są gotowe po kilkunastu sekundach, reszta generuje się w tle;
- każde pytanie wskazuje fragment źródła, z którego powstało, i da się je poprawić;
- katalog gotowych przedmiotów jest dodatkiem, nie główną ścieżką.

Grupa docelowa: od podstawówki (kl. 4–8) przez liceum/technikum po studia.

---

## 1. Kierunek wizualny

Płaskie, nasycone kolory zamiast gradientów. Pod każdym klikalnym elementem gruby cień
(4–7 px, bez rozmycia) — wciśnięcie zjeżdża w dół o tyle samo pikseli.

- Tło `#0E0C1C`, karta `#1B1836`, obramowanie `#2C2850`.
- Akcja: limonka `#B4FF3A`. Kolory przedmiotów, seria ogień, błąd czerwień, XP złoto — wszystko w `tokens.css`.
- Display **Bricolage Grotesque 800**, treść **Plus Jakarta Sans** 500–800.
- **Zero emoji w UI.** Ikony to inline SVG, stroke 2.4–3.4. Emoji z danych zastąp monogramem w kolorowym kafelku.
- Cel dotyku min. 44 px. Kontrast tekstu 4.5:1, dużego 3:1.
- Ton: rzeczowy i ciepły, bez młodzieżowego slangu — apka ma pasować zarówno 12-latkowi, jak i studentowi.

Motyw przedmiotu: `--accent`, `--accent-dark`, `--on-accent` na kontenerze przedmiotu.

---

## 2. Ruch

Keyframes i klasy w `tokens.css`.

| gdzie | klasa |
|---|---|
| paski postępu przy wejściu | `.a-grow` + `.d1…d6` kaskadowo |
| aktywny węzeł ścieżki, plus w nawigacji | `.a-pulse` |
| dymek „ZACZNIJ", przeciągany element | `.a-bob` |
| serduszka, płomień serii | `.a-beat` |
| panele od dołu (dobrze/źle/źródło/wyjaśnienie/dodaj) | `.a-rise` |
| zła odpowiedź, trafiony boss | `.a-shake` |
| dobra odpowiedź, odznaki, liczniki | `.a-pop` |
| konfetti | `.a-fall` z różnymi opóźnieniami |
| listy i karty wchodzące | `.a-up` + `.d1…d6` |
| tło, rozmyte koła | `.a-float` |
| przyciski główne | `.a-glow` |
| timery, pole docelowe, „zostało X" | `.a-blink` |
| timer „na czas" | `.a-drain` |

`prefers-reduced-motion: reduce` wyłącza wszystko. Własny przełącznik w Ustawieniach ustawia klasę na `<html>`.

---

## 3. Ekrany

Nazwa podglądu = proponowana trasa.

**Pierwsze uruchomienie** — `EmptyState` · `LevelPick` (etap nauki + cel: sprawdziany/matura/olimpiada) · `Onboarding` (cel dzienny) · `Catalog` (gotowe przedmioty)

**Własny materiał** — `QuickAdd` (arkusz „Dodaj materiał") · `Scanner` (aparat, wiele stron) · `Detected` (AI rozpoznaje przedmiot i dział, gdzie dodać) · `Generating` (budowanie + „pierwsze 8 pytań gotowe")

**Zanim zaczniesz się uczyć** — `SubjectReady` (nazwa, kolor, poziomy) · `EditContent` (poprawa pytania) · `SourceView` (fragment zdjęcia, z którego powstało pytanie) · `ShareClass` (kod dla klasy)

**Sprawdziany i inne źródła** — `TestPlan` (plan dzień po dniu do daty sprawdzianu) · `SubjectInfo` (zasady zaliczenia, siatka ocen) · `AddSubject` (pliki i tekst) · `ErrorState` (plik nie do odczytania, brak sieci)

**Codzienne** — `Main` (plan na dziś + plus w nawigacji) · `Missions` · `League` · `Friends` · `Shop` · `ComeBack` · `Streak` · `Settings`

**Nauka** — `Path` · `Lesson` · `Quiz` / `QuizCorrect` / `QuizWrong` · `NoHearts` · `Flashcards` / `FlashcardsDone` · `Review` · `LevelComplete` · `Profile`

**Typy zadań (16)** — `Quiz` wybór · `TaskMatch` pary · `TaskFill` luka · `TaskOrder` kolejność · `TaskSort` kategorie · `TaskTrueFalse` prawda/fałsz na czas · `Flashcards` fiszki · `Timeline` oś czasu · `FindError` znajdź błąd · `WhoSaid` czyja teza · `CauseChain` łańcuch przyczyn · `Scenario` scenariusz · `Swipe` dwie kategorie · `TypeTerm` wpisz pojęcie · `ChartRead` wykres · `MathSteps` równanie krok po kroku · `Hotspot` wskaż na schemacie

**Walka i zaangażowanie** — `Boss` (koniec rozdziału, pasek życia bossa) · `Ghost` (pojedynek z własnym wcześniejszym wynikiem) · `Cram` (noc przed egzaminem, plan 20 min) · `Album` (kolekcja pojęć) · `Explain` (wyjaśnij inaczej) · `WeeklyStory` (podsumowanie tygodnia)

**Egzamin** — `ExamStart` · `ExamRun` (siatka pytań, flagowanie) · `Exam` (wynik)

---

## 4. Kontrakt danych — rozszerzenie

Kontrakt z `CLAUDE.md` zostaje. Wszystkie nowe pola są **opcjonalne**.

### 4.1 Zadania w poziomie

```js
tasks:[
  { type:"match",    title, pairs:[[lewa, prawa], ...] },
  { type:"fill",     text:"... {0} ... {1} ...", blanks:[...], bank:[...dystraktory], hint },
  { type:"order",    title, items:[...w POPRAWNEJ kolejności — silnik miesza] },
  { type:"sort",     title, buckets:[{name, items:[...]}, ...] },
  { type:"tf",       seconds:60, statements:[{s, v:true|false, e}] },
  { type:"timeline", title, events:[{label, year}] },
  { type:"finderror",sentences:[...], wrong:<index>, fix:"poprawne słowo", e },
  { type:"thesis",   thesis:"...", options:[{name, sub}], c:<index>, e },   // teza → szkoła/autor
  { type:"chain",    steps:[...w kolejności], given:[<indexy widoczne od startu>], bank:[...dystraktory] },
  { type:"scenario", scene:"...", q, a:[...], c, e },
  { type:"swipe",    left:"Kwas", right:"Zasada", cards:[{front, sub, side:"left"|"right"}] },
  { type:"typeterm", definition, answer, accept:[...warianty], typo:1 },
  { type:"chart",    chart:{kind:"bar", label, x:[...], y:[...]}, q, a:[...], c, e },
  { type:"mathsteps",start:"3x + 7 = 22", steps:[{expr, note, options:[...], c}] },
  { type:"hotspot",  image:"<ścieżka lub svg>", targets:[{name, x, y, r}] }
]
```

Każde pytanie i zadanie może mieć **źródło**: `src:{ material:<id>, page:<n>, quote:"zdanie z materiału" }`.
Z tego korzysta `SourceView`.

### 4.2 Materiały i przedmioty użytkownika

```js
materials:[{ id, kind:"photo"|"pdf"|"pptx"|"docx"|"text"|"audio"|"link", pages, status:"ok"|"failed", reason }]
subject.level:"podstawowka"|"liceum"|"studia"|"inne"
subject.goal:"sprawdziany"|"matura-p"|"matura-r"|"olimpiada"|...
level.fromMaterial:<id>          // poziom powstały z konkretnego materiału
```

### 4.3 Plan do sprawdzianu

```js
tests:[{ id, subjectId, levels:[...], date:"yyyy-mm-dd", plan:[{date, kind:"learn"|"review"|"mock"|"weak"|"rest", minutes}] }]
```
Plan przelicza się, gdy dzień zostanie opuszczony. Ostatni dzień przed sprawdzianem: tylko krótka powtórka.

### 4.4 Powtórka na interwałach (bez zmiany klucza `nauka_progress_v1`)

```js
srs:{ "<subjectId>:<levelId>:<itemId>":{ box:0..4, due, seen, lapses } }   // 0 → 1 → 3 → 7 → 21 dni
```

### 4.5 Gamifikacja

```js
hearts:{n, refillAt}, gems, streak:{n, last, freezes, best},
daily:{goal, xp, date, tasks}, missions:{daily, weekly},
album:{ "<itemId>": {rarity:"common"|"rare"|"epic", at} },
ghost:{ "<levelId>": [{t, correct}] }          // przebieg najlepszego podejścia
```

---

## 5. Decyzje przed kodowaniem

Te rzeczy wykraczają poza obecny model „vanilla JS z pliku, offline":

- **AI** — rozpoznawanie zdjęć (OCR), generowanie lekcji, „wyjaśnij inaczej" i rozpoznanie przedmiotu wymagają serwera z modelem. Bez tego rdzeń produktu nie działa.
- **Backend i konta** — synchronizacja między urządzeniami, udostępnianie klasie, liga, znajomi.
- **Użytkownicy poniżej 16 lat** — zgoda rodzica na przetwarzanie danych (RODO) i przemyślenie funkcji społecznościowych dla nieletnich.
- **Prawa autorskie** — zdjęcia podręczników do własnej nauki są OK; udostępnianie klasie obejmuje tylko wygenerowane pytania i fiszki, **nigdy skany stron**. Warto to potwierdzić z prawnikiem.
- **Jakość treści** — AI się myli, dlatego każde pytanie ma źródło i ścieżkę poprawki. Katalog gotowych przedmiotów wymaga weryfikacji merytorycznej.

---

## 6. Kolejność wdrożenia

1. **Skóra.** `tokens.css` do `styles.css`, klasy na zmienne, bez gradientów. Silnik bez zmian.
2. **Ikony SVG** zamiast emoji, helper `icon(name)`.
3. **Ekran „Dziś"** z planem dnia, kafle przedmiotów, dolna nawigacja z plusem.
4. **Ścieżka, roladka, quiz** w nowym wyglądzie, panele dobrze/źle, życia, combo.
5. **Typy zadań** z pola `tasks` — najpierw proste (`tf`, `fill`, `typeterm`, `swipe`, `thesis`, `scenario`), potem przeciągane (`match`, `order`, `sort`, `timeline`, `chain` — pointer events, nie HTML5 drag), na końcu `chart`, `mathsteps`, `hotspot`.
6. **Powtórka SRS**, `Review`, `FlashcardsDone`.
7. **Egzamin** i **plan do sprawdzianu**.
8. **Gamifikacja** — życia, gemy, misje, seria, album, boss, duch.
9. **Własne materiały** — po decyzji o backendzie i AI: `QuickAdd`, `Scanner`, `Detected`, `Generating`, `SourceView`, `EditContent`.
10. **Społeczność** — `ShareClass`, `League`, `Friends`.

Kroki 1–8 da się zrobić w obecnej architekturze. Po każdym kroku: `node build.js` i test `build/nauka-all.html` na telefonie.

## 7. Czego nie ruszać (dopóki nie zapadnie decyzja o backendzie)

- Ładowanie danych przez `<script src>`, nie `fetch`.
- Klucz `localStorage` `nauka_progress_v1` bez migracji.
- Brak frameworków i bundlerów.
- Nowe pola w danych są opcjonalne — stare przedmioty działają bez zmian.
