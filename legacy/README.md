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
        { q:"Pytanie?", a:["A","B","C","D"], c:1, e:"Wyjaśnienie poprawnej odpowiedzi",
          src:{ material:"cz1", page:12, quote:"zdanie z materiału" } }   // src opcjonalne — „Źródło” w przeglądzie po egzaminie (krok 7)
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
- **Egzamin** = pytania quizu z wybranego zakresu (10 / 20 / wszystkie) na czas (`grading.examMin`, do zmiany chipami), ocena wg `grading.scale`, przegląd błędów i talia błędów (krok 7).

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

## Nauka 2.0 — krok 5b: pozostałe typy zadań (design/DESIGN.md §4.1, 16 typów)

- **Rejestr `TASKS` ma komplet 15 typów z `tasks`** (16. to fiszki): do `tf | fill | match | order | sort` doszły `typeterm | swipe | thesis | scenario | finderror | timeline | chain | chart | mathsteps | hotspot`. Ta sama rama: `render(task, api)` buduje treść w `api.body`, przyciski w `api.foot`, kończy `api.finish(ok, {e, sub})`; `taskBlock`, `sessionChips`, `sheetOk/sheetBad`, serca (−1 raz na zadanie, tylko w lekcji), combo i XP (`TASK_XP` × mnożnik) bez zmian. Nieznane `type` nadal są pomijane, `src` przepuszczane. Kolejność kart w Ćwiczeniach = kolejność kluczy `TASK_META` (proste → przeciągane → chart/mathsteps/hotspot).
- **Kształty danych (wszystko opcjonalne, jak w DESIGN.md §4.1)**:
  - `{type:"typeterm", definition, answer, accept:[…warianty], typo:1, title?, e?}` — porównanie po `fold()` (bez wielkości liter, ogonków i interpunkcji), `typo` = dopuszczalna odległość edycyjna (`lev()`).
  - `{type:"swipe", left, right, cards:[{front, sub?, side:"left"|"right", e?}], title?, e?}`.
  - `{type:"thesis", thesis, q?, options:[{name, sub?}], c, e?}`.
  - `{type:"scenario", scene, q, a:[…], c, e?}`.
  - `{type:"finderror", sentences:[…], wrong:<index>, fix:"poprawne słowo", title?, e?}`.
  - `{type:"timeline", title?, events:[{label, year}], e?}` — silnik miesza wydarzenia, sprawdza po roku (równe lata są zamienne).
  - `{type:"chain", title?, steps:[…w kolejności], given:[<indeksy widoczne od startu>], bank:[…dystraktory], e?}`.
  - `{type:"chart", chart:{kind:"bar"|"line", label, x:[…], y:[…]}, q, a:[…], c, e?}` — jedna seria, wartości ≥ 0.
  - `{type:"mathsteps", title?, start, steps:[{expr, note, options:[…], c}], e?}` — `expr` = wyrażenie po kroku, `note` = wyjaśnienie przekształcenia.
  - `{type:"hotspot", title?, image:"<svg …>"|"ścieżka.png", alt?, targets:[{name, x, y, r}], e?}` — `x`, `y` = środek w % obrazka, `r` = promień w % szerokości obrazka; cele pytane po kolei.
- **Renderery** (podglądy `TypeTerm / Swipe / WhoSaid / Scenario / FindError / Timeline / CauseChain / ChartRead / MathSteps / Hotspot.html`):
  - `typeterm`: karta „Definicja”, pole w limonkowej ramce (Bricolage), kreski = litery odpowiedzi zapalające się w trakcie pisania, „N liter · literówka w jednym miejscu jest akceptowana”, **„Pierwsza litera · −2 XP”** (wpisuje pierwszą literę; −2 XP przez `addXP`, tylko gdy jest z czego odjąć) i **„Nie pamiętam”** (= źle, pokazuje odpowiedź). Enter w polu = SPRAWDŹ.
  - `swipe`: strefy po bokach (czerwona lewa, cyjanowa prawa), stos kart; **przeciąganie karty** (pointer events, przechył `dx/14°`, stempel z nazwą strefy od 30 px, odpowiedź od 80 px, karta odlatuje `.fly-l/.fly-r`), dwa przyciski 3D pod spodem, klawisze ←/→. Kropki = wynik kolejnych kart; zaliczone = wszystkie trafione, w panelu „źle” lista nietrafionych.
  - `thesis`: karta z cudzysłowem, siatka 2 kolumn `{name, sub}`, wybrana = fiolet; `scenario` i `chart`: kafle A–D jak w quizie (`.qopt.sm`). Wszystkie trzy przez wspólny `chooser(api, btns, c, fb)` (SPRAWDŹ, klawisze 1-5 / A-E, Enter; po sprawdzeniu `.correct/.wrong.a-shake/.dim`).
  - `finderror`: zdania jako kafelki w karcie (wybrane = czerwień); po SPRAWDŹ fałszywe zdanie przekreślone + ramka „Poprawnie: **fix**”, chybiony wybór = bursztynowa ramka (to zdanie było prawdziwe).
  - `timeline`: oś pionowa z latami rosnąco (kropki), wydarzenia w puli `.wordtile`; tap kafelek (fiolet + `a-bob`) → tap slot, tap przypięte = wraca, **przeciąganie na slot** przez wspólny `tileDrag()`; pierwszy pusty slot mruga („upuść tutaj”). Po sprawdzeniu limonka/czerwień, w panelu poprawna oś.
  - `chain`: kolumna kroków ze strzałkami, `given` jako zwykłe karty, sloty „co dalej?”; tap kafelek → pierwszy wolny slot, przeciąganie na konkretny slot (`tileDrag`), tap wstawiony = wraca. Bank = brakujące kroki + dystraktory.
  - `chart`: `chartSvg(kind, x, y)` — inline SVG 330×178 (słupki fiolet z zaokrągleniem, linia cyjan z punktami), wartości nad znacznikami (przecinek dziesiętny), siatka kreskowana, `aria-label` z danymi; kolory tylko przez klasy `.cbar/.cline/.cval/.clab`.
  - `mathsteps`: karta z wyrażeniem startowym i historią kroków; wybór z siatki 2 kolumn (Bricolage, wymieszane) + SPRAWDŹ. Dobrze → limonkowy wiersz z `note`; źle → czerwony, przekreślony wiersz „nie tak” + złota ramka z `note` (wyjaśnienie), zła opcja gaśnie, wybierasz dalej. Zaliczone = całość bez pomyłek („N pomyłek po drodze” w panelu).
  - `hotspot`: obraz w karcie (`<svg>` inline z `style='fill:var(--…)'` albo `<img>`), warstwa dotyku `.hotlayer`; tytuł „Dotknij: …” zmienia się po każdym trafieniu, chipy „Kolejne: …”. Trafienie = limonkowy pierścień + etykieta, chybienie = czerwony punkt + `a-shake` karty; **„POKAŻ, GDZIE TO JEST”** = pomyłka + bursztynowe podświetlenie celu. Zaliczone = wszystkie cele bez pomyłek.
- **Wspólne helpery** (krok 5b): `fold`, `lev`, `leftText`, `chooser`, `tileDrag` (wydzielone z `sort` — sort, timeline i chain używają jednego kodu przeciągania; przy krawędzi przewijanego kontenera auto-przewijanie, kafelek zostaje pod palcem), `chartSvg`; ikony `quote`, `arrow-down`, `chart`, `calc`, `keyboard`, `swipe`, `pointer`.
- **Zakładka Ćwiczenia**: sekcja „Zadania z poziomów” dostaje karty nowych typów automatycznie (`TASK_META`); dawne ćwiczenie „Wpisz pojęcie” (z fiszek, przedmioty niejęzykowe) nazywa się teraz **„Pojęcie z fiszek”**, żeby nie myliło się z zadaniem `typeterm`.
- **Dane**: `data/makro.js` — l1 `typeterm`, `scenario`; l2 `thesis`, `swipe`; l3 `finderror`, `chain`, `chart` (CPI Polska 2019–2024, GUS), `mathsteps`; l4 `timeline`. `data/krypto.js` — k1 `timeline`, `typeterm`, `hotspot` (schemat trzech bloków jako inline SVG); k2 `chain`, `chart` (halving, linia); k3 `swipe`, `thesis`, `scenario`, `finderror`, `mathsteps`. Pozostałe przedmioty bez zmian.
- `styles.css`: blok „KROK 5b” (`.tchip.red/.violet`, `.trow/.tcount`, `.qopt.sm`, `.defcard/.termbox/.terminput/.letters/.termmeta/.termbtns/.hintbtn`, `.swipestage/.szone/.scard/.stamp/.swbtns/.swbtn`, `.thcard/.thtext/.thgrid/.thopt`, `.scenecard/.scenetext`, `.errcard/.errsent/.errfix/.notebox`, `.tl/.tlaxis/.tlrow/.tlyear/.tldot/.tlslot/.tlev`, `.chain/.chstep/.charrow/.chslot`, `.chartcard/.chartlbl/svg.chart/.cgrid/.caxis/.cbar/.cval/.clab/.cline/.cdot`, `.mathcard/.mrow/.mexpr/.mnote/.mexp/.mgrid/.mopt`, `.hotcard/.hotimg/.hotlayer/.hotpin/.hotring/.hottag/.hotchips/.hotchip`, `.lesson .pill.ghost`). Zero nowych tokenów i zero literałów kolorów.

## Nauka 2.0 — krok 6: handoff 2.0 (nawigacja z plusem, „Dodaj materiał”, „Wyjaśnij inaczej”) + powtórka SRS (design/DESIGN.md §0, §4.4, §6)

- **Dolna nawigacja** (Main.html): `Dziś · Powtórka · [+] · Fiszki · Profil`. Plus to uniesiony (−34 px) limonkowy przycisk 62 px (`.navplus.a-pulse`, `aria-label="Dodaj materiał"`), dostępny z każdego widoku głównego. Zakładka **Przedmioty** zniknęła z paska — siatka jest pod „Wszystkie ›” na Dziś i w Profilu, w Ustawieniach („Wszystkie przedmioty”) i w arkuszu dodawania („gotowy przedmiot z katalogu”). **Ustawienia** przez kółko zębate w Profilu.
- **Arkusz „Dodaj materiał”** (`openQuickAdd`, QuickAdd.html): zrób zdjęcie / wgraj plik / wklej tekst / gotowy przedmiot. Otwierany z plusa, kafla „Dodaj materiał” na Dziś i w siatce, z Ustawień. Ta wersja działa offline bez AI (DESIGN.md §5), więc zdjęcie, plik i tekst prowadzą do **arkusza informacyjnego** `openAddInfo(kind)` (AddSubject.html przerobiony): co dzieje się w wersji online, ramka „offline”, 3 kroki dodania przedmiotu przez `data/*.js` + przycisk „Gotowe przedmioty”. Pusty stan (brak `data/`) otwiera ten sam arkusz. Dawne `addHint/toggleAddHint` usunięte.
- **Panel „źle” (QuizWrong.html)**: drugi przycisk to **„WYJAŚNIJ INACZEJ”** (`openExplain`, Explain.html) — offline pokazuje wyjaśnienia, które już są w danych: poprawną odpowiedź, **fiszkę** z poziomu i **„prościej” / „zapamiętaj”** z roladki dobrane po wspólnych słowach z pytaniem (`words/stem/overlap/explainFor`, najpierw poziom pytania, potem cały przedmiot), a gdy nic nie pasuje — `e` „innymi słowy”. Notka: świeże wyjaśnienie AI wymaga wersji online. „Do fiszek” zostało jako ghost w tym arkuszu; „ROZUMIEM” wraca do panelu „źle”. `sheetBad(q, o)` przyjmuje dodatkowo `o.subj` i `o.lv` (kontekst do doboru wyjaśnień); przycisk pojawia się tylko dla pytań (`q.q`).
- **Powtórka SRS** (DESIGN.md §4.4, ten sam klucz `nauka_progress_v1`): `PROGRESS.srs["<subjectId>:<levelId>:<itemId>"] = {box:0..4, due:"yyyy-mm-dd", seen, lapses}`; `itemId` = indeks fiszki albo `q`+indeks pytania. Interwały pudełek `SRS_INT=[0,1,3,7,21]` dni; dobra odpowiedź podnosi pudełko (max 4), zła zrzuca do 0 i zwiększa `lapses` (`srsTouch`). Zapis: fiszki w zakładce przedmiotu (umiem / jeszcze nie), pytania w lekcji, zakładka Quiz, sesja powtórki. Egzamin i ćwiczenia nie zapisują. `allCards/allQuiz` niosą teraz `lid` i `i`/`qi`; sesja poziomu `levelSession` niesie `qi`. Wpisy po nieistniejących przedmiotach/poziomach są pomijane (`srsResolve`).
- **Ekran Powtórka** (`renderReview`, Review.html): licznik pojęć na dziś (`srsDue`: fiszki najpierw, potem pytania), „Z czego” (wiersze przedmiotów z tytułami poziomów i liczbą; tap = powtórka tylko z tego przedmiotu), „Stan pamięci” (`srsStats`: świeże = pudełko 0, w trakcie = 1–2, utrwalone = 3–4), „ZACZNIJ POWTÓRKĘ”. Przy 0 na dziś: najbliższy termin (`nextDueText`) i link do fiszek.
- **Sesja powtórki** (`startReview/renderReviewSession`): pełny ekran jak lekcja, ale bez serc i combo — licznik „N z M” i pasek segmentowy; fiszki w kolorze przedmiotu (tap = odwróć, przeciągnięcie w lewo/prawo albo przyciski „jeszcze nie / umiem”, +2 XP za umiem), potem pytania z kaflami i panelami dobrze/źle (+3 XP). Zamknięcie w trakcie pokazuje ekran końca z tym, co przejrzane.
- **Ekran końca** (`finishReview`, FlashcardsDone.html): pierścień celności (SVG, bez gradientu), „Powtórka skończona”, kafle umiem / do powtórki / +XP, lista „Wracają dziś” (nietrafione, `N. raz` = `seen`) albo najbliższy termin, karta serii z planem dnia i następną powtórką, „POWTÓRZ TE N” (sesja tylko z nietrafionych) / „GOTOWE”, „NA DZIŚ WYSTARCZY”.
- **Plan dnia**: wiersz „Powtórka — N fiszek” otwiera ekran Powtórka (ikona `refresh`; w opisie liczba pojęć do powtórki dziś). Zakończona sesja zalicza wiersze przedmiotów z sesji, a gdy żaden nie pasuje (plan układa się raz dziennie), pierwszy oczekujący wiersz Powtórki. Fiszki w zakładce przedmiotu nadal tickują `prog`.
- **Zakładka „Fiszki”** w nawigacji (`renderCardsHub`): liczba pojęć, wiersz „Powtórka na dziś”, lista przedmiotów z liczbą fiszek i pojęć do powtórki → zakładka Fiszki przedmiotu.
- **Profil** (Profile.html): kafle Seria / XP łącznie / **Utrwalone** (pudełko ≥ 3, „z N pojęć w powtórce”) / Poziomy; nagłówki sekcji z „Wszystkie ›”: **Aktywność — 8 tygodni** (kostki z serii w `nauka_meta_v1`, → Seria), **Odznaki** (placeholder: „100 pojęć” po 100 wpisach SRS, „7 dni” po rekordzie ≥ 7, „Egzamin 90%” zablokowana do kroku 8), **XP w przedmiotach** (→ siatka przedmiotów).
- **Ton** (DESIGN.md §1): teksty silnika bez młodzieżowego slangu — etykiety przycisków z wielkiej litery, toasty „+4 XP”, „Nie tym razem”, „To nie ta para”, „Dobrze znasz ten materiał”, „dotknij, żeby odwrócić”, „prościej” zamiast „po ludzku” itd. Treść w `data/*.js` bez zmian.
- `styles.css`: blok „KROK 6” (`.navplus`, `.shandle/.shead/.sclose`, `.sheet.quickadd/.addinfo/.explain`, `.qabig/.qagrid/.qatile/.qalink`, `.sp/.infobox`, `.exhead/.exchips/.exchip/.exbox/.exsep/.exnote`, `.pill.cyan`, `.review/.cards`, `.rvhero/.rvn/.rvt/.rvs/.rvrows/.rvrow`, `.memcard/.memrow/.memnote`, `.rvfoot`, `.rvcount/.rvrun`, `.rvring/.ring-bg/.ring-fg/.rvpct`, `.lcstat.acid/.red/.gold`, `.rvlist/.rdot`, `.heat`, `.badges/.badge`, `.swipehint3`). Ikony `camera`, `wifi`. Zero nowych tokenów i zero literałów kolorów.

## Nauka 2.0 — krok 7: egzamin i plan do sprawdzianu (design/DESIGN.md §4.3, §6 pkt 7)

- **ExamStart** (zakładka „Egzamin” przedmiotu, `renderEgzamin`; też wiersz „Egzamin próbny” na Dziś): trzy kafle (pytań · minut · próg), **Zakres** (wiersze poziomów z liczbą pytań, „Wszystkie poziomy” — tap na zaznaczonych „wszystkich” zostawia tylko pierwszy poziom), **Liczba pytań** (10 / 20 / wszystkie), **Limit czasu** (chipy z `grading.examMin`: połowa, domyślny, podwójny, bez limitu), **Siatka ocen** (chipy „5 od 90%…” + ocena niezaliczona), ramka „Warunki jak na prawdziwym”, karta **Ostatnie podejście** (data · % · ocena · najlepiej) i karta „Mam sprawdzian” / „Sprawdzian za N dni” (→ arkusz albo ekran planu). Start w przypiętej stopce. Ustawienia trzymane per przedmiot na czas sesji (`exCfg`, `examConfig(s, {levels, n, lim})`).
- **ExamRun** (`beginExam/renderExamQ`, pełny ekran `#lesson.egrun`): nagłówek z zamknięciem, „Pytanie N z M” + pasek (fiolet), **timer** (bursztyn; pod 2 min czerwień + `.a-blink`, opadający pasek `.egdrain`, „bez limitu” = „—”), przycisk **siatki pytań** (`openExamGrid`: arkusz 7 kolumn, stany z odpowiedzią / do wrócenia / bieżące / puste, tap = skok), **flaga** przy pytaniu (`ex.flags`, chip „Do wrócenia”), kafle jak w quizie bez oceny w trakcie (ponowny tap odznacza), wstecz / DALEJ (ostatnie = ZAKOŃCZ). Zamknięcie i ZAKOŃCZ otwierają arkusz **„Zakończyć egzamin?”** (`confirmExamFinish`: bez odpowiedzi / do wrócenia / z odpowiedzią, „DO PUSTYCH” skacze do pierwszego pustego, „Przerwij bez wyniku”). **Koniec czasu = automatyczne zakończenie** (`examFinish(true)`, toast „Czas minął”). Klawisze: 1–5 / A–E, ←/→, F = flaga, Enter = dalej. Egzamin = tylko pytania quizu (bez zadań), bez serc, combo i zapisu SRS — jak dotąd.
- **Wynik** (`examFinish/renderExamResult`, Exam.html, `#lesson.egres`): karta z **pierścieniem** (limonka = zdane, czerwień = nie), ocena z siatki (część po „/” lub „—” jako dopisek), notka „Do 4,5 brakuje N pytań” / „Do progu…” / „Nowy rekord”, kafle poprawne · błędne · puste · czas, **„Gdzie tracisz punkty”** (celność per poziom, gdy zakres > 1 poziomu), **Siatka ocen** z podświetlonym wierszem (DESIGN.md §4.4 ze starego handoffu), karta „N błędów do powtórki”, **Przegląd pytań** — błędy najpierw (Twoja / Dobra / wyjaśnienie `e` / linia **Źródło** z `src` — materiał, strona, cytat), potem trafione. Przyciski: **„TALIA BŁĘDÓW · N”** i „WRÓĆ DO EGZAMINU” (bez błędów: GOTOWE / JESZCZE RAZ). Bez udostępniania.
- **Zapis** (ten sam klucz `nauka_progress_v1`): XP jak dotąd (3 za poprawne) + `completeDaily(sid,'exam')`; `PROGRESS[sid].exam = {n, passed, last:{pct,grade,correct,total,date}, best:{…}}`; `PROGRESS.examsPassed` (licznik zdanych — odznaki w kroku 8; odznaka „Egzamin 90%” w Profilu świeci już od najlepszego wyniku ≥ 90%); `PROGRESS.examDeck = ["<sid>:<lid>:q<idx>", …]` — klucze SRS błędnych odpowiedzi (jedna talia na przedmiot, ostatni egzamin zastępuje; zapisywana od razu po egzaminie, żeby Dziś i plan do sprawdzianu widziały błędy).
- **Talia błędów** (`startExamDeck(sid)`): sesja powtórki (`startReview`, `rvState.deck=sid`) tylko z pytań z talii; trafione **wypadają z talii** w `finishReview`, „POWTÓRZ TE N” zostaje w trybie talii. Zalicza wiersz Dziś **„Powtórz błędy z egzaminu”** (`sid:weak`, +20 XP, `REWARD.weak`) — wiersz dochodzi do planu dnia po egzaminie i przy układaniu nowego dnia, dopóki talia nie jest pusta.
- **Plan do sprawdzianu** (DESIGN.md §4.3): `PROGRESS.tests = [{id, subjectId, levels:[id…], date, plan:[{date, kind:"learn"|"review"|"mock"|"weak"|"rest", minutes, lv?:[id…], n?, short?, done?}], built}]`, jeden plan na przedmiot (`createTest` zastępuje). Układ (`buildTestPlan`): końcówka = **próbny sprawdzian** (−3 dni, `n` = min(20, pytania z zakresu)), **tylko słabe punkty** (−2; przy < 3 dniach bez próbnego i bez talii — powtórka), **krótka powtórka** (−1, 5 min, `short`); wcześniejsze dni = **nauka** niezaliczonych poziomów (równo po `ceil(L/D)` poziomów, `lv`) albo, gdy poziomów jest mniej niż dni, nauka w równych odstępach, między nimi **powtórka** i co trzeci wolny dzień **wolne**. **Przeliczenie raz dziennie** (`syncTests`: start apki, nowy dzień w `daily()`, wejście na Dziś/plan): plany po terminie znikają, dni sprzed dziś zostają w historii (zrobione / „pominięte — plan przeliczony”), dni od dziś układają się na nowo z aktualnie niezaliczonych poziomów — opuszczony dzień nauki rozkłada się sam.
- **Zaliczanie dnia** (`testDone(sid, kind, lvId)`): nauka — gdy wszystkie poziomy z `lv` są zaliczone (`finishLesson`), powtórka — koniec sesji powtórki z tym przedmiotem, próbny — koniec egzaminu, słabe punkty — koniec sesji z talii. Toast „Plan do sprawdzianu: dzień zaliczony”.
- **Arkusz „Mam sprawdzian”** (`openTestSheet(sid?)`): chipy przedmiotów (monogram), **natywne pole daty** (`<input type=date>`, min jutro, domyślnie +7; podpis „za N dni”), chipy zakresu (wszystkie / poziomy, wielokrotny wybór), podsumowanie (dni · poziomy do nauki · pytania na próbny · „zastąpi obecny plan”), **UŁÓŻ PLAN** → ekran planu. Wejścia: wiersz **„Mam sprawdzian — ułóż mi plan”** w arkuszu „Dodaj materiał” (QuickAdd.html, `.qatest`), karta na dole ExamStart.
- **Ekran TestPlan** (`openTestPlan(id, from)`, widok `testplan`, `renderTestPlan`): karta z pierścieniem **gotowości** (60% zaliczone poziomy z zakresu + 40% najlepszy wynik egzaminu), przedmiot · zakres, data („czwartek, 1 paź”), „za N dni” (`.a-blink`); wiersze dni (skrót dnia + numer, ikona rodzaju, tytuł, minuty; stany `tp-now` (limonka, plakietka DZIŚ / ZROBIONE), `tp-done`, `tp-missed`, `tp-future`, `tp-rest` (kreskowany), `tp-exam` (czerwony wiersz sprawdzianu)); tap = właściwa akcja (`testAction`: nauka → ścieżka i start pierwszego niezaliczonego poziomu z wiersza, powtórka → sesja z zakresu (`reviewItemsFor`: zaległe SRS → wpisy SRS → fiszki poziomów, max 15), próbny → ExamStart z zakresem i liczbą pytań, słabe punkty → talia błędów (bez talii → próbny), wolne → toast); „ZACZNIJ DZISIEJSZE” / „NA DZIŚ WSZYSTKO” / „POWODZENIA”, „Usuń plan”. Wstecz wraca tam, skąd przyszedł (Dziś albo zakładka Egzamin).
- **Dziś**: gdy istnieje plan, na górze karty planu wiersz **„Do sprawdzianu — …”** (`testTodayItem`: tytuł dnia, przedmiot · za N dni · minuty; zrobiony = przekreślony bez nagrody; w dniu sprawdzianu „Sprawdzian dziś — powodzenia”). Wiersz liczy się do paska „N z M”.
- **Pas przedmiotu**: chip **„Sprawdzian za N dni · dziś: …”** (`.bandtest`) pod nazwą → ekran planu.
- `styles.css`: blok „KROK 7” (`.exstart`, `.egspecs/.egspec`, `.egcard/.eglbl/.egrow/.egchips/.egchip/.egscale`, `.egwarn`, `.eglast`, `.egfoot` (przypięta), `.egrun .eghead/.egtop/.egn/.egtimer/.eggridbtn/.egdrain`, `.egqrow/.egflag`, `.egnav`, `.pill.violet`, `.sheet.eggrid/.egconfirm/.testplan`, `.egsquares/.egsq/.eglegend`, `.egsum/.egsumtile`, `.egres/.egl/.eghero/.eggrade/.egnote/.egstats/.egstat`, `.eglv/.eglvrow`, `.egscalelist/.egsrow(.on/.fail)`, `.egdeck`, `.egrev/.egitem`, `.tplan/.tphero/.tprows/.tprow(.tp-*)/.badge2/.tpnote/.tpfoot`, `.tpchips/.tpchip/.tpdate/.tpsum`, `.qatest`, `.bandtest`). Zero nowych tokenów i zero literałów kolorów. Dane: przykładowe `src` w dwóch pytaniach quizu Makro (poziom Podstawy).
