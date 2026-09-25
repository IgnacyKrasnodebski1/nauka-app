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
