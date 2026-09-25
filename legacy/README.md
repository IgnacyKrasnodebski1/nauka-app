# 📚 NAUKA — wieloprzedmiotowa apka do nauki (gen-z)

Platforma do nauki w stylu Duolingo: wybierasz przedmiot, przechodzisz **poziomy** (odblokowują się po kolei), a w każdym masz **roladkę** (mikro-dawki wiedzy), **fiszki**, **quiz** i **symulację egzaminu**. Postępy (XP, gwiazdki, zaliczone poziomy) zapisują się w przeglądarce.

Zbudowana z prezentacji z zajęć. Aktualne przedmioty:
- **📊 Makro** — Polityka makroekonomiczna dla zrównoważonego rozwoju (7 części + 43 pytania z prezentacji grup = ~40% testu).
- **₿ Krypto** — Wprowadzenie do kryptowalut i NFT / blockchain dla banku (8 prezentacji).

---

## 🚀 Jak odpalić

### Wersja jednoplikowa (najłatwiej, też na telefon)
W folderze `build/` masz gotowe pliki — **otwórz dowolny w przeglądarce** albo wrzuć na telefon (AirDrop / Pliki / Dysk):
- `build/nauka-all.html` — wszystkie przedmioty razem (ekran wyboru).
- `build/makro.html` — tylko Makro.
- `build/krypto.html` — tylko Krypto.

Działa offline, bez internetu i bez serwera.

### Wersja edytowalna (projekt)
`index.html` ładuje `styles.css`, `engine.js` i pliki z `data/`. Otwórz `index.html` w przeglądarce (lokalnie też działa — dane ładują się przez `<script>`, nie przez `fetch`, więc nie ma problemu z CORS na `file://`).

---

## ➕ Jak dodać nowy przedmiot

1. Skopiuj `data/makro.js` na np. `data/historia.js`.
2. Zmień zawartość obiektu (patrz schemat niżej). **Musi** zaczynać się od:
   ```js
   window.SUBJECTS = window.SUBJECTS || [];
   window.SUBJECTS.push({ /* ... */ });
   ```
3. Dodaj `<script src="data/historia.js"></script>` w `index.html` (przed `engine.js`).
4. Przebuduj jednoplikowe wersje: `node build.js`.

Przedmiot pojawi się automatycznie na ekranie wyboru.

### Schemat danych przedmiotu
```js
{
  id: "historia",                 // unikalny, bez spacji (klucz postępów)
  name: "Historia XX wieku",
  short: "Historia",              // krótka nazwa w nagłówku
  emoji: "📜",
  tagline: "Krótki opis pod tytułem.",
  accent: "linear-gradient(135deg,#...,#...)",  // motyw kolorystyczny
  accent2: "#...",                // kolor akcentu (paski, ramki)
  grading: {
    pass: 50,                     // próg zaliczenia egzaminu (%)
    examMin: 20,                  // limit czasu egzaminu (minuty)
    scale: [[90,"5"],[70,"4"],[50,"3"]],  // [próg %, ocena] MALEJĄCO
    failLabel: "2 — niezaliczone"
  },
  info: `<div class="zbox"><h3>Nagłówek</h3><p>HTML do zakładki Info...</p></div>`,
  levels: [
    {
      id: "l1",                   // unikalny w obrębie przedmiotu
      title: "Nazwa poziomu",
      emoji: "🧩",
      feed: [                     // roladka (mikro-dawki) — pokazywana na początku lekcji
        { title:"...", body:"... <b>HTML</b> ...", real:"tłumaczenie po ludzku (opc.)", mnemo:"mnemotechnika (opc.)" }
      ],
      flashcards: [               // fiszki termin → definicja
        { t:"Termin", d:"Definicja (może mieć <b>HTML</b>)" }
      ],
      quiz: [                     // pytania ABCD
        { q:"Pytanie?", a:["A","B","C","D"], c:1, e:"Wyjaśnienie poprawnej odpowiedzi" }
        // c = indeks poprawnej odpowiedzi (0 = A, 1 = B, ...)
      ]
    }
    // kolejne poziomy...
  ]
}
```

### Jak działają poziomy
- Poziomy odblokowują się **po kolei** — następny po zaliczeniu poprzedniego (quiz ≥ 50%).
- Gwiazdki: ≥90% = ⭐⭐⭐, ≥70% = ⭐⭐, ≥50% = ⭐.
- Zakładki **Fiszki / Quiz / Egzamin** działają na całym przedmiocie (filtr po poziomach).
- **Egzamin** = 20 losowych pytań na czas, ocena wg `grading.scale`.

---

## 🗂️ Struktura
```
nauka-app/
├── index.html        # wersja edytowalna (ładuje pliki poniżej)
├── styles.css        # style (motyw per przedmiot przez --accent)
├── engine.js         # cała logika (router, poziomy, tryby)
├── data/
│   ├── makro.js      # przedmiot: makroekonomia
│   └── krypto.js     # przedmiot: krypto
├── build.js          # generuje jednoplikowe wersje
├── build/            # gotowe pliki do odpalenia / na telefon
└── README.md
```

## 🛠️ Pomysły na rozbudowę (do Claude Code)
- Tryb powtórek (spaced repetition) na bazie tego, które fiszki oznaczasz „jeszcze nie".
- Liczba potwierdzeń/streak dzienny.
- Import pytań z CSV → generator `data/*.js`.
- Tryb „pojedynek" / dzielenie wyniku egzaminu.

---

## Nauka 2.0 — krok 2: ikony zamiast emoji (design/DESIGN.md §5.2)

- **Zero emoji w UI silnika.** Wszystkie ikony to inline SVG (24×24, `stroke:currentColor` 2.4–3.4, zaokrąglone końce; glify pełne — płomień, błyskawica, gwiazdka, serce, klejnot — `fill:currentColor`). Ścieżki skopiowane z `design/preview/*.html`.
- Nowe helpery w `engine.js` (w IIFE, obok helpers):
  - `icon(name,{size,stroke,fill,cls})` → string `<svg class="ic …" aria-hidden="true">`. Mapa `ICONS`: back, close, check, lock, bolt, flame, gem, heart, star, book, cards, brain, target, info, list, clock, chevron-right, plus, refresh, trophy, chest, home, calendar, settings, user, search, x-circle, alert, bulb, bookmark, file, question, edit, link, map, grid, flag. Nieznana nazwa → `alert`.
  - `initial(str)` + `mono(txt,cls)` — monogram (pierwsza litera/cyfra nazwy) w kafelku `.mono` w kolorze `--accent` na tincie; `.mono.sm` = 34 px (topbar, Info).
  - `starRow(n,size)` — 3 gwiazdki (zdobyte złote pełne, reszta kontur), `bigTile(kind,icon)` — duży okrągły kafel wyniku (`ok|gold|hot|fail|''`), `LBL` — gotowe etykiety przycisków z ikoną, `toast(text, iconName)` — toast z ikoną (drugi argument opcjonalny).
- **Emoji z danych nie są już renderowane** (pola `emoji` w `data/*.js` zostają, są ignorowane): karta przedmiotu / topbar / Info → monogram z `short||name`; węzeł ścieżki → `check` (zaliczony) / `bolt` (otwarty) / `lock` (zamknięty), gwiazdki pod węzłem jako ikony w pigułce.
- `applyTheme(s)` ustawia inline `--accent`, `--accent2` oraz opcjonalne `--accent-dark` / `--on-accent` z `accentDark` / `onAccent` w danych (brak → `color-mix` z `styles.css`). Na ekranie startowym właściwości są zdejmowane, więc obowiązuje domyślny `--acid` — koniec z gradientem z engine.
- `styles.css`: tylko dopisany blok „KROK 2" (`svg.ic`, `.ic-*` kolory z tokenów, flex+gap w przyciskach z ikoną, `.mono`, `.nodebtn .stars`, `.starrow`, `.result .big.*`), zero literałów kolorów.
- HTML w danych (`info`, `title` poziomu, `body` roladki) nadal może zawierać emoji — to treść, nie UI; do wyczyszczenia razem z krokiem 4.4 (kafle Info).

## Nauka 2.0 — krok 3: ekran „Dziś”, kafle przedmiotów, dolna nawigacja (design/DESIGN.md §5.3)

- **Nowy ekran startowy `today`** (`renderToday`, referencja `design/preview/Main.html`): nagłówek z datą po polsku, „Plan na dziś” z paskiem `X z N`, mini-kafle **Misje** (zrobione/wszystkie zadania planu — właściwe misje dojdą w kroku 8) i **Seria X dni** (→ widok serii), karta planu, sekcja „Twoje przedmioty” (max 3 kafle: najpierw z postępem) + kafel „Dodaj przedmiot” (pokazuje dotychczasową podpowiedź `.addcard`; kreator dojdzie w kroku 9).
- **Router widoków głównych**: `go(view)` → `today` (domyślny) · `subjects` (dawny wybór przedmiotu jako siatka 2 kolumn `renderSubjects`) · `profile` · `settings` · `streak`. `renderHome` został jako alias `go('today')`. Wspólna skorupa `shell(active,{title,back,pills,right,blob,cls})` buduje topbar, ekran, `.nav` i `#toast`. **Dolna nawigacja** (`renderNav`): Dziś / Przedmioty / Profil / Ustawienia — tylko w widokach głównych; w przedmiocie, lekcji i egzaminie jej nie ma (przycisk wstecz w topbarze wraca do „Dziś”). `openSubject(id, tab?, setup?)` pozwala wejść od razu w zakładkę (fiszki/quiz/egzamin).
- **Plan dnia w `nauka_progress_v1`** (ten sam klucz, nowe pole): `daily:{date:"yyyy-mm-dd", goal:100, xp:0, tasks:[{id, done, need?, prog?}]}`. `daily()` przebudowuje plan, gdy zmieni się data. Zadania (`buildDailyTasks`): dla każdego przedmiotu z postępem (bez postępu → pierwszy przedmiot), po XP malejąco, do 4 pozycji: `sid:lesson:<lvl>` „Roladka — <następny otwarty poziom>” (+15), `sid:review` „Powtórka — N fiszek” (N = min(12, liczba fiszek), +20), `sid:quiz:<lvl>` „Quiz — <ostatni zaliczony poziom>” (+25), `sid:exam` „Egzamin próbny” (+40). Etykiety liczą się z danych w `taskInfo(t)`. Stan wiersza: zrobione (przekreślenie + check), bieżące (pierwsze niezrobione — tint przedmiotu, pulsujący kafel, chevron), późniejsze (wyciszone). Tap prowadzi do ścieżki / Fiszek / Quizu (z filtrem poziomu) / Egzaminu.
- **Zaliczanie**: `completeDaily(sid, kind, lvId?)` (zaliczona lekcja z `finishLesson`, ekran wyniku w `renderQuiz`, `examFinish`) i `tickDaily(sid,'review',1)` z przycisków fiszek (`need` przejrzanych → done). Nagroda idzie przez `addXP` (jedyny lejek XP), toast „plan dnia: +N xp” po 3,2 s. `addXP` dolicza też `daily.xp` (pod cel dzienny z kroku 8). `totalXP()` sumuje po `SUBJECTS` (nie `Object.values(PROGRESS)` — `daily` też ma `xp`).
- **Profil** (`renderProfile`, placeholder pod krok 8–9): awatar, pasek `lvl` (100 XP = poziom), kafle Seria (rekord z `nauka_meta_v1`), XP łącznie (+dzisiaj), Poziomy zaliczone, Przedmioty zaczęte, lista XP per przedmiot.
- **Ustawienia** (`renderSettings`): cel dzienny (odczyt), **„Ogranicz animacje”** — własny przełącznik z DESIGN.md §2: `META.reduceMotion` w `nauka_meta_v1`, klasa `reduce-motion` na `<html>` (`applyMotion()` przy starcie), lista przedmiotów (→ ścieżka), „Dodaj przedmiot” (podpowiedź), **„Wyzeruj postępy”** (`confirm` → `PROGRESS={}`; seria zostaje).
- **Seria** (`renderStreak`, `Streak.html`): płomień, licznik, tekst o rekordzie, karta „Ten tydzień” z kropkami Pn–Nd liczonymi z `META.lastDay`/`META.streak` (`weekDots()`: done / dziś / dziś-zaliczone / przyszłe / pominięte), przycisk „wracam do nauki”. Wejście: pigułka serii w topbarze, mini-kafel, kafel „Seria” w profilu.
- **Pusty stan** (`renderEmpty`, `EmptyState.html`): gdy `window.SUBJECTS` jest puste — ilustracja, 3 kroki, „dodaj przedmiot” (podpowiedź o `data/`).
- Nowe helpery: `dstr(d)`, `dateHeader()`, `pl(n,one,few,many)` (liczebniki PL), `fmtNum`, `hasProgress(s)`, `subjectGrid(list,withAdd)`, `renderPlan(items)`, ikona `upload`.
- `styles.css`: blok „KROK 3” (`.themed` — pochodne motywu liczone lokalnie z `--accent` przez `color-mix`, `.blob`, `.today/.subjects/.profile/.settings`, `.eyebrow`, `.planbar`, `.minitile`, `.plan`/`.plan-row`/`.plan-tile`/`.plan-sep`, `.grid2`, `.subjtile` (+`.add`), `.mono.solid`/`.mono.xs`, `.nav` doszlifowany, `.prof`/`.avatar`/`.stat`, `.setcard`/`.setrow`/`.toggle`/`.pill.danger`, `.streakbg`/`.streakview`/`.week`/`.day`/`.dot`, `.empty`/`.art-*`/`.step`, `html.reduce-motion`). Nowe tokeny w bloku aliasów `:root`: `--ink`, `--line-dash`, `--accent-shadow`. Stare klasy (`.subjcard`, `.addcard`, `.hero`) zostają.
- Dane w `data/*.js` bez zmian (nadal opcjonalne `accentDark`/`onAccent`).

## Nauka 2.0 — krok 4: ścieżka, roladka, quiz, życia, combo (design/DESIGN.md §5.4)

- **Pas nagłówka przedmiotu** (`renderSubject`, `Path.html`): `.band` w `--surface-2` — wstecz, monogram + nazwa, pasek „zaliczone/wszystkie · XP” (`#xpNum` nadal aktualizowany przez `addXP`), przycisk **info** (→ zakładka Info, podświetlony gdy aktywna) i **pigułka serc** (`heartsPill()`; tap = toast „Kolejne życie za N minut”). Chipy zakładek: Ścieżka / Fiszki / Quiz / Ćwiczenia / Egzamin (Info tylko przez przycisk). Pigułki serii/XP z topbara zostały w widokach głównych.
- **Ścieżka** (`renderPath`): karta „Rozdział N · tytuł bieżącego poziomu” (`.chapter`, tint przedmiotu), potem wężyk: każdy węzeł i łącznik dostaje inline `--x` (cykl `PATH_OFF=[-104,8,96,-28]`, łącznik w połowie drogi między sąsiadami) — stary `.pathzig:nth-child` liczył też łączniki i psuł naprzemienność. Łącznik w `--accent`, gdy poprzedni element zaliczony. Stany: zaliczony (akcent, check, pigułka 3 gwiazdek), bieżący (88 px, limonka, błyskawica, `.a-pulse`, dymek `.bubble.a-bob` „ZACZNIJ”), zablokowany (surface + kłódka). **Skrzynia** (`.node-chest.a-sway`, złota ramka) po każdym 3. poziomie — na razie tylko toast („otworzy się po zaliczeniu poziomu N” / „klejnoty dojdą w kroku 8”). Auto-scroll do bieżącego węzła po renderze. Tytuły poziomów bez emoji z danych (`noEmoji()`), także w chipach Fiszek/Quizu i planie dnia.
- **Życia** w `nauka_progress_v1` (ten sam klucz, nowe pole): `hearts:{n:5, refillAt:<ts>|null, quest?:<int>}`. `hearts()` liczy regenerację przy odczycie (1 życie / 30 min od `refillAt`, kolejne co 30 min, przy 5 `refillAt=null`), `loseHeart()` (−1 tylko za błąd w quizie **lekcji**; zakładka Quiz, egzamin i ćwiczenia nie ruszają serc), `gainHeart()`, `heartEta()`. Stare zapisy bez `hearts` startują z 5.
- **Roladka** (`startLesson`/`renderLesson`, `Lesson.html`): pełny ekran; nagłówek = zamknij ×, **pasek segmentowy** `.segbar` (segment = dawka albo pytanie; zaliczone limonka, błędne czerwone), serca. Karta `.fcard` z paskiem akcentu, chip „Mikro-dawka i/N”, tytuł, treść, `.real` („po ludzku”) i `.mnemo` („zapamiętaj”) jak w kroku 2. Stopka: podpowiedź „przesuń w górę…” + **KONTYNUUJ** (limonka, `.a-glow`). Dalej: przycisk, **swipe w górę** (gdy karta przewinięta do końca; w dół = wstecz), klawisze Enter / → / ←. Poziom bez `feed` zaczyna od quizu; `startLesson` przy 0 serc pokazuje panel Koniec żyć zamiast lekcji.
- **Quiz w lekcji** (`quizBlock`, `Quiz*.html`): chipy (combo / „Pytanie N z M”), pytanie, **kafle 3D z literą** (`.qopt`), wybór podświetla kafel i odblokowuje **SPRAWDŹ** (jak w podglądzie; klawisze 1–5 / A–E, Enter). Po sprawdzeniu kafle: `.correct` (`.a-pop`, przy błędzie `.a-glow`), `.wrong.a-shake`, reszta `.dim`; pytanie szarzeje. **Panel od dołu** `.sheet.a-rise` (`openSheet/closeSheet`, jeden na raz, Enter = `[data-primary]`, ochrona przed podwójnym „dalej” `advOk()`):
  - `.sheet.ok` (`sheetOk`): „Dobrze!”, podpis combo („Czwarta poprawna z rzędu”), chip **+XP** z mnożnikiem („+10 XP ×2”), „Dlaczego” = `e`, DALEJ + 4 kawałki konfetti;
  - `.sheet.bad` (`sheetBad`): „Nie tym razem”, „Poprawna: odpowiedź B”, „Zapamiętaj” = `e`, **DO FISZEK** (fiszki tego poziomu, lekcja przerwana) + DALEJ; pigułka serc `.a-beat` z „−1” `.a-blink`.
- **Combo** (`lessonState.combo/maxCombo`, `comboMult()`): kolejne poprawne w lekcji; chip „Combo xN” od 2 (`.a-pop` przy zmianie), po błędzie „Combo zerwane” (jeśli było ≥2). XP za poprawną = 5 × mnożnik (×2 od 5, ×3 od 10). `addXP` pozostaje jedynym lejkiem XP.
- **Koniec żyć** (`showNoHearts`, `NoHearts.html`): `.sheet.nohearts` z tłem `#sheetback`, 5 pustych serc, licznik do następnego życia (`.a-blink`, odświeżany co sekundę; gdy życie wróci — panel się zamyka), karta **„Powtórz 10 fiszek”** (ustawia `hearts.quest=10`, otwiera Fiszki z filtrem poziomu; licznik „serce za N” przy pasku; po 10 przejrzanych `gainHeart()` + toast) i „WRÓĆ PÓŹNIEJ”. Z lekcji: quiz przerwany = poziom **niezaliczony**. Karta „Uzupełnij wszystkie za gemy” dojdzie w kroku 8.
- **LevelComplete** (`finishLesson`, `LevelComplete.html`): 3 gwiazdki `.a-pop` (`d1`/bez/`d3`, zdobyte złote), duży kafel 132 px (limonka + check; niezaliczony: czerwony + ×), tytuł, „Przedmiot · poziom”, kafle **XP** (suma z quizu z combo + 15 za pierwsze zaliczenie), **Celność**, **Combo** (max), karta serii z planem dnia (→ widok serii), 7 kawałków konfetti `.a-fall` z różnym opóźnieniem. Przyciski: DALEJ (`#lcont`) + POWTÓRZ POZIOM (`#lretry`); niezaliczony: SPRÓBUJ JESZCZE RAZ + WRÓĆ NA ŚCIEŻKĘ. Progi gwiazdek/zaliczenia i `completeDaily(sid,'lesson',lvId)` bez zmian.
- **Zakładka Quiz** (`renderQuiz`): ten sam `quizBlock` + panele dobrze/źle (+3 XP), bez serc, combo i „DO FISZEK”; ekran wyniku jak dotąd.
- Nowe helpery: `hearts/loseHeart/gainHeart/heartEta/etaText/heartReview/heartsPill/updateHearts`, `comboMult/comboText`, `openSheet/closeSheet/sheetBack/sheetOk/sheetBad/showNoHearts`, `goCards(lv)`, `quizBlock`, `confetti(n)`, `lessonHead`, `noEmoji`, ikona `arrow-up`; jeden globalny nasłuch `keydown` → `keyFn` podstawiany przez widok.
- `styles.css`: blok „KROK 4” (`.band/.brow/.bname/.bprog/.infobtn`, `.hearts` (+`.zero`), `.chapter`, `.pathnode/.connector` z `--x`, `.node-chest`, `.bubble`, `.segbar`, `.lesson .fcard/.fin`, `.tag.accent`, `.swipehint2`, `.pill.text/.red/.ghost.red`, `.quiz/.qchips/.combo/.qopts/.qopt(.sel/.correct/.wrong/.dim)`, `.sheet(.ok/.bad/.nohearts)/.srow/.sico/.xpchip/.sbox/.sbtns`, `.sheetback`, `.nhh/.nht/.nhcard`, `.confetti`, `.lc/.lcstars/.lcbig/.lct/.lcs/.lcstats/.lcstat/.lcstreak`, `.blob.mid/.cyan/.red`). Nowe tokeny pochodne w `:root`: `--red-soft`, `--acid-soft` (color-mix z tokenów). Akcja w lekcji i w panelu „dobrze” zawsze w limonce (`--acid`), nie w kolorze przedmiotu.
- Dane w `data/*.js` bez zmian.

## Nauka 2.0 — krok 5: nowe typy zadań (design/DESIGN.md §4.1 / §5.5)

- **Nowe pole danych `tasks`** w poziomie — opcjonalne, stare przedmioty działają bez zmian. Kształty jak w DESIGN.md §4.1:
  - `{type:"tf", seconds?, statements:[{s, v:true|false, e}]}` — seria zdań prawda/fałsz, opcjonalnie na czas (cała runda);
  - `{type:"fill", text:"… {0} … {1} …", blanks:[…], bank:[…dystraktory], hint?, e?}` — luki jako sloty, bank = `blanks` + `bank` wymieszane;
  - `{type:"match", title, pairs:[[lewa, prawa], …], e?}` — dwie wymieszane kolumny, tap-tap;
  - `{type:"order", title, items:[…w POPRAWNEJ kolejności], e?}` — silnik miesza na starcie (nigdy nie zaczyna od poprawnej);
  - `{type:"sort", title, buckets:[{name, items:[…]}, …], e?}` — 2–4 koszyki + pula kafelków.
  - Każde zadanie może mieć `e` (wyjaśnienie do panelu) i `src:{material, page, quote}` — na razie tylko przepuszczane (SourceView później). Nieznane `type` są pomijane.
- **Sesja poziomu** (`levelSession(lv)`): do 6 losowych pytań quizu i wszystkie zadania w jednym strumieniu — pierwsze zawsze pytanie, zadania rozłożone równo między resztę. `lessonState.items` zastąpiło `lessonState.quiz`; pasek segmentowy, celność, gwiazdki i próg zaliczenia liczą się z wszystkich elementów (zadanie = jeden element).
- **Rejestr `TASKS`** (`tf | fill | match | order | sort`): `render(task, api)` buduje treść w `api.body`, przyciski w `api.foot` i kończy `api.finish(ok, {e, sub})`. Wspólna rama `taskBlock(task, o)` → `{body, foot}` jak `quizBlock`: chip typu (`.tchip`), combo / „Zadanie N z M” (`sessionChips`), a wynik idzie tym samym `o.onAnswer(ok, fb)` co quiz → `sheetOk` / `sheetBad` (nowa opcja `o.sub` — podpis w panelu „źle” zamiast litery odpowiedzi), serca (−1 raz na zadanie, tylko w lekcji), combo. XP: pytanie 5 × mnożnik (`QUIZ_XP`), zadanie 8 × mnożnik (`TASK_XP`).
- **Renderery** (`TaskTrueFalse/Fill/Match/Order/Sort.html`):
  - `tf`: karta zdania na cały ekran, PRAWDA / FAŁSZ (3D, limonka / czerwień), kropki postępu, po każdej odpowiedzi tint karty + wyjaśnienie `e` pod spodem; `seconds` → pasek „Runda na czas” (`.timerbar`, płomień, licznik `a-blink` pod 10 s); koniec czasu = reszta zdań źle. Zaliczone = wszystkie trafione; w panelu „źle” lista nietrafionych zdań z wyjaśnieniami. Klawisze: P/1/← prawda, F/2/→ fałsz.
  - `fill`: zdanie z lukami `{n}` jako `.slot` (pierwsza pusta mruga), bank kafelków `.wordtile`; tap kafelek → pierwsza wolna luka, tap luka → kafelek wraca; podpowiedź `hint` w złotej ramce; SPRAWDŹ (Enter) porównuje po kolei (bez wielkości liter); po sprawdzeniu sloty limonka/czerwień, w panelu poprawne zdanie.
  - `match`: kolumny `.mbtn` (wybrany = cyjan + puls, para = limonka + check, chybienie = czerwień + `a-shake`), podpis „Zostały N pary z M”; koniec po połączeniu wszystkich; pomyłki po drodze = jedno „źle”.
  - `order`: wiersze `.orderitem` (numer, tekst, ▲▼ `.ud`, uchwyt `.handle`); przeciąganie za uchwyt przez **pointer events** (`setPointerCapture`, pozycja docelowa wg środka wiersza, `touch-action:none` tylko na uchwycie, wiersz w trakcie = fiolet); po sprawdzeniu numery limonka (dobra pozycja) / czerwień.
  - `sort`: siatka `.bucket` (2 kolumny) ze strefą „upuść tutaj”, pula `.bank.pool`; tap kafelek (fiolet + `a-bob`) → tap koszyk; tap kafelek w koszyku = wraca; przeciąganie kafelka na koszyk przez pointer events (`elementFromPoint`, koszyk pod palcem = `.over`); SPRAWDŹ dopiero, gdy pula pusta.
- **Zakładka Ćwiczenia** (`renderCwicz`): dotychczasowe ćwiczenia zostają (dawne „Połącz w pary” z fiszek nazywa się teraz „Pary z fiszek” / „Pary słówek”), a pod nimi sekcja **„Zadania z poziomów”** — po jednej karcie na typ obecny w przedmiocie (`allTasks(s)`), z liczbą zadań. Run (`cwStartTasks` / `cwRenderTasks`) używa tego samego `taskBlock` i paneli, bez serc i combo, +4 XP za zadanie, na końcu ekran wyniku jak w innych ćwiczeniach.
- **Dane**: `data/makro.js` — `tasks` w poziomach l1 (fill, order, sort, tf 45 s), l2 (match, fill), l3 (tf 60 s, sort); `data/krypto.js` — k1 (tf 60 s, match), k2 (sort, fill, order). Przykłady z DESIGN.md §4.1. Plan dnia w opisie roladki pokazuje też liczbę zadań.
- Nowe helpery: `levelSession`, `taskBlock`, `sessionChips`, `allTasks`, `taskCleanup` (licznik rundy czyszczony przy `go`, `renderSubject`, `renderLesson`, `closeLesson`, `renderCwicz`), `norm`, `listBox`, ikony `chevron-up`, `chevron-down`, `grip`.
- `styles.css`: blok „KROK 5” (`.task`, `.tchip`, `.ttitle/.tsub/.tfoot/.tflist/.tsep`, `.timerbar/.ttime`, `.tfcard/.tfq/.tfmeta/.dots/.tfexp/.tfbtns/.tfbtn`, `.fillcard/.filltxt/.slot/.bank/.wordtile/.hintbox`, `.matchcols/.mbtn`, `.orderlist/.orderitem/.onum/.otxt/.ud/.handle`, `.buckets/.bucket/.bhead/.bitem/.bdrop`). Nowe tokeny pochodne w `:root`: `--amber-soft`, `--violet-soft`, `--violet-shadow` (color-mix z tokenów).
