# Nauka 2.0 — przewodnik wdrożenia designu

Ten katalog to handoff z projektu wizualnego. Czytaj go razem z `../CLAUDE.md` —
reguły projektu (vanilla JS, brak bundlera, brak `fetch`, `file://`) **obowiązują dalej**.

- `preview/index.html` — galeria wszystkich 36 ekranów. Otwórz w przeglądarce, ekrany są klikalne między sobą.
- `preview/<Ekran>.html` — pojedynczy ekran, 390×844, samodzielny plik.
- `tokens.css` — zmienne motywu, keyframes i przepisy na komponenty. To jest źródło prawdy dla kolorów i ruchu.

Podglądy są **referencją wizualną**, nie kodem do wklejenia: mają style inline
i zero logiki. Do `styles.css` przenieś tokeny i klasy z `tokens.css`, resztę
odtwórz w istniejących klasach silnika.

---

## 1. Kierunek wizualny

Płaskie, nasycone kolory zamiast gradientów. Pod każdym klikalnym elementem
gruby cień (4–7 px, bez rozmycia) — to on daje wrażenie fizycznego klocka,
a wciśnięcie zjeżdża w dół o tyle samo pikseli.

- Tło `#0E0C1C`, karta `#1B1836`, obramowanie `#2C2850`.
- Akcja: kwaśna limonka `#B4FF3A`. Makro różowy, Krypto pomarańczowy, seria ogień, błąd czerwień, XP złoto.
- Display **Bricolage Grotesque 800**, treść **Plus Jakarta Sans** 500–800. Oba z Google Fonts.
  Przy `file://` fonty z sieci nie wczytają się offline — zostaw sensowny fallback systemowy.
- **Zero emoji w UI.** Wszystkie ikony to inline SVG ze stroke 2.4–3.4. Emoji z `data/*.js`
  (`emoji` przedmiotu, `emoji` poziomu) zastąp monogramem w kolorowym kafelku albo ikoną.
- Cel dotyku minimum 44 px. Kontrast tekstu 4.5:1, dużego 3:1.

Motyw przedmiotu: ustaw `--accent`, `--accent-dark`, `--on-accent` na kontenerze
przedmiotu. Pole `accent` w `data/*.js` jest dziś gradientem — zamień na
pojedynczy hex i dodaj `accentDark` oraz `onAccent` (kolor tekstu na akcencie).

---

## 2. Ruch

Wszystkie keyframes i klasy są w `tokens.css`. Reguły:

| gdzie | klasa |
|---|---|
| paski postępu (przy wejściu na ekran) | `.a-grow` + `.d1…d6` kaskadowo |
| aktywny węzeł ścieżki | `.a-pulse`, dymek „ZACZNIJ" `.a-bob` |
| serduszka, płomień serii | `.a-beat` |
| panel dobrze/źle/koniec żyć | `.a-rise` |
| zła odpowiedź | `.a-shake` |
| dobra odpowiedź, odznaki, liczniki | `.a-pop` |
| konfetti | `.a-fall` z różnym `animation-delay` na każdym kawałku |
| karty i listy wchodzące | `.a-up` + `.d1…d6` |
| tło (rozmyte koła) | `.a-float` |
| przyciski główne | `.a-glow` |
| licznik czasu, „zostało X" | `.a-blink` |

`prefers-reduced-motion: reduce` wyłącza wszystko jedną regułą — jest już w `tokens.css`.
W ustawieniach jest też własny przełącznik; niech ustawia klasę na `<html>`.

---

## 3. Ekrany → nawigacja

Router dostaje więcej widoków. Proponowana mapa (nazwa podglądu → trasa):

**Wejście i materiały**
`EmptyState` brak przedmiotów · `Onboarding` cel dzienny · `AddSubject` źródło materiałów ·
`ErrorState` plik nie do odczytania + pasek braku sieci

**Przedmiot**
`Generating` budowanie · `SubjectReady` nazwa, kolor, lista poziomów z przełącznikami ·
`EditContent` poprawa pytania · `SubjectInfo` zasady zaliczenia i siatka ocen

**Codzienne**
`Main` plan na dziś (to jest nowy ekran startowy) · `Missions` misje · `League` liga ·
`Friends` znajomi · `Shop` plecak · `ComeBack` powrót po przerwie · `Streak` seria · `Settings`

**Nauka**
`Path` ścieżka · `Lesson` roladka · `Quiz` / `QuizCorrect` / `QuizWrong` ·
`NoHearts` koniec żyć · `Flashcards` / `FlashcardsDone` · `Review` powtórka dnia ·
`LevelComplete` · `Profile`

**Egzamin**
`ExamStart` zakres i warunki · `ExamRun` pytanie z siatką numerów · `Exam` wynik

**Nowe typy zadań**
`TaskMatch` pary · `TaskFill` luka · `TaskOrder` kolejność · `TaskSort` kategorie · `TaskTrueFalse` prawda/fałsz

---

## 4. Rozszerzenie kontraktu danych

Kontrakt z `CLAUDE.md` zostaje bez zmian. Dochodzą **opcjonalne** pola, więc
stare `data/makro.js` i `data/krypto.js` działają dalej bez ruszania.

### 4.1 Nowe typy zadań w poziomie

```js
{ id, title, emoji,
  feed:[...], flashcards:[...], quiz:[...],   // bez zmian

  tasks:[                                      // NOWE, opcjonalne
    { type:"match", title:"Doktryna i jej sedno",
      pairs:[ ["Ordoliberalizm","państwo ustala reguły gry"], ... ] },

    { type:"fill", text:"Polityka społeczna ma cztery instrumenty: ekonomiczne, {0}, informacyjne oraz {1}.",
      blanks:["prawne","kadrowe"],
      bank:["militarne","cyfrowe","fiskalne","medialne"],   // dystraktory; blanks doklejane i mieszane
      hint:"KASA · PRAWO · GADANIE · LUDZIE" },

    { type:"order", title:"Etapy polityki społecznej",
      items:["Diagnoza","Analiza przyczyn","Propozycje","Decyzja","Legislacja","Wdrożenie","Ewaluacja"] },
      // items są w POPRAWNEJ kolejności, silnik miesza przy starcie

    { type:"sort", title:"Który to instrument?",
      buckets:[ {name:"Ekonomiczne", items:["zasiłki","ulga podatkowa"]},
                {name:"Prawne", items:["Kodeks pracy"]},
                {name:"Informacyjne", items:["kampania społeczna"]},
                {name:"Kadrowe", items:["pracownik socjalny"]} ] },

    { type:"tf", seconds:60,
      statements:[ {s:"Biała księga Bitcoina powstała w 2008 roku.", v:true, e:"2008 — white paper, 2009 — start sieci."}, ... ] }
  ]
}
```

Zasady wspólne: każde zadanie ma wyjaśnienie (`e`) tam, gdzie da się pomylić;
`c` w quizie dalej liczone od 0; zadania są mieszane z pytaniami quizu w jednej sesji poziomu.

### 4.2 Powtórka na interwałach

Nowy stan per pojęcie, trzymany w tym samym kluczu `nauka_progress_v1`
(**nie zmieniaj klucza** — patrz CLAUDE.md):

```js
srs: { "<subjectId>:<levelId>:<cardIndex>": { box:0..4, due:<timestamp>, seen:<n>, lapses:<n> } }
```

Interwały pudełek w dniach: `0 → 1 → 3 → 7 → 21`. Dobra odpowiedź podnosi
pudełko, zła zbija do 0 i zwiększa `lapses`. Ekran `Review` pokazuje liczbę
zaległych na dziś i rozbicie świeże / w trakcie / utrwalone.

### 4.3 Gamifikacja (wszystko lokalnie)

```js
hearts:{ n:5, refillAt:<timestamp> },      // -1 za błąd, regeneracja 1/30 min
gems:<int>,
streak:{ n:<int>, last:<yyyy-mm-dd>, freezes:<int>, best:<int> },
daily:{ goal:100, xp:0, date:"<yyyy-mm-dd>", tasks:[...] },
missions:{ daily:[{id,progress,target,reward,done}], weekly:{...} }
```

`Missions`, `Shop`, `NoHearts`, `Streak`, `ComeBack` działają w całości offline.
**`League` i `Friends` wymagają backendu** — bez niego zostaw je za flagą albo wytnij.

### 4.4 Ekran zasad

`SubjectInfo` nie potrzebuje nowych danych: `info` (HTML w `.zbox`) i `grading.scale`
już są w `data/*.js`. Przerób render `info` na kafle z podglądu zamiast surowych `.zbox`,
a `grading.scale` na listę progów z podświetleniem wiersza, w którym mieści się ostatni wynik.

---

## 5. Kolejność wdrożenia

1. **Tokeny i skóra.** Wklej `tokens.css` na początek `styles.css`, przepisz istniejące
   klasy na zmienne, wywal gradienty. Nic w `engine.js` się nie zmienia — apka ma po tym
   kroku wyglądać po nowemu i dalej działać.
2. **Ikony.** Zamień emoji na inline SVG. Dodaj mały helper `icon(name)` zwracający string SVG.
3. **Ekran „Dziś".** Nowy widok startowy z planem dnia, kafle przedmiotów, dolna nawigacja.
   Dotychczasowy wybór przedmiotu schodzi do kafli.
4. **Ścieżka, roladka, quiz.** Nowy wygląd + stany dobrze/źle jako panel wjeżdżający od dołu,
   życia, combo.
5. **Nowe typy zadań.** Pole `tasks` + renderery. Najpierw `tf` i `fill` (najprostsze),
   potem `match`, `order`, `sort` (przeciąganie — na telefonie pointer events, nie HTML5 drag).
6. **Powtórka SRS.** Stan `srs`, ekran `Review`, `FlashcardsDone`.
7. **Egzamin.** `ExamStart` z wyborem zakresu, `ExamRun` z siatką i flagowaniem, wynik jak dziś
   plus talia błędów.
8. **Gamifikacja.** Życia, gemy, misje, plecak, seria.
9. **Reszta.** Ustawienia, pusty stan, błąd pliku, powrót po przerwie, edycja treści.

Po każdym kroku: `node build.js` i sprawdzenie `build/nauka-all.html` na telefonie.

## 6. Czego nie ruszać

- Ładowanie danych przez `<script src>` — **nie** `fetch`, bo apka ma działać z `file://`.
- Klucz `localStorage` `nauka_progress_v1` bez migracji.
- Brak frameworków i bundlerów, dalej jednoplikowy build.
- Nowe pola w danych muszą być opcjonalne — stare przedmioty mają działać bez zmian.
