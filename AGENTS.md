# AGENTS.md — kontekst projektu dla Codex

## Czym jest ten projekt
**nauka-app** — wieloprzedmiotowa apka do nauki w stylu Duolingo (poziomy odblokowywane po kolei) + tryby: roladka (feed), fiszki, quiz, symulacja egzaminu. **Vanilla JS, bez frameworków, bez bundlera.** Działa offline, otwierana wprost z pliku.

Powstała z prezentacji z zajęć. Przedmioty: Makro (polityka makroekonomiczna) i Krypto (blockchain/kryptowaluty).

## Struktura
```
index.html      # wersja edytowalna — ładuje styles.css, engine.js, data/*.js przez <script>
engine.js       # CAŁA logika: router, ekran wyboru, ścieżka poziomów, fiszki, quiz, egzamin
styles.css      # style; motyw każdego przedmiotu przez zmienną CSS --accent / --accent2
data/
  makro.js      # przedmiot — robi window.SUBJECTS.push({...})
  krypto.js     # przedmiot
build.js        # `node build.js` → skleja jednoplikowe wersje do build/
build/          # gotowe pliki jednoplikowe (na telefon / do odpalenia bez serwera)
README.md       # pełny schemat danych + instrukcja dodawania przedmiotu
```

## Jak to działa (ważne reguły)
- Dane ładują się przez `<script src>` (NIE przez `fetch`), więc apka działa też z `file://` (bez serwera, bez CORS). **Nie zamieniaj na fetch/JSON.**
- Każdy plik w `data/` zaczyna się od `window.SUBJECTS = window.SUBJECTS || [];` i `window.SUBJECTS.push({...})`.
- Silnik (`engine.js`) jest jednym IIFE; czyta `window.SUBJECTS` na `DOMContentLoaded`.
- Postępy (XP, gwiazdki, zaliczone poziomy) trzymane w `localStorage` przez bezpieczny wrapper `STORE` (łapie wyjątki na iOS file://). Klucz: `nauka_progress_v1`.

## Kontrakt danych (NIE psuć)
```js
{
  id, name, short, emoji, tagline,
  accent, accent2,                       // kolory motywu
  grading: { pass, examMin, scale:[[próg,"ocena"],...], failLabel },
  info: `<div class="zbox">...HTML...</div>`,
  levels: [
    { id, title, emoji,
      feed:[{title, body, real?, mnemo?}],   // mikro-dawki (HTML w body)
      flashcards:[{t, d}],                    // termin / definicja
      quiz:[{q, a:[...], c, e}]               // c = INDEKS poprawnej odpowiedzi (0=A)
    }
  ]
}
```
Poziomy odblokowują się po kolei (quiz w lekcji ≥ 50% zalicza poziom). Zakładki Fiszki/Quiz/Egzamin działają na całym przedmiocie.

## Workflow przy zmianach
1. Edytuj `data/*.js` (treść), `engine.js` (logika) lub `styles.css` (wygląd).
2. Po zmianie danych/silnika odpal `node build.js` (regeneruje `build/`).
3. Sprawdź w przeglądarce `index.html` (dev) albo `build/nauka-all.html` (build).
4. Test sanity (opcjonalnie): `npm i jsdom` i prosty skrypt klikający `.subjcard` → węzeł ścieżki → lekcja → egzamin; sprawdź brak błędów JS w `window.onerror`.

## Konwencje
- Język UI: polski, luźny gen-z, ale treść merytoryczna ma być poprawna.
- Dodając przedmiot: skopiuj `data/makro.js`, zmień `id` (unikalny, bez spacji) i treść, dopisz `<script src="data/twoj.js">` w `index.html`, odpal `node build.js`.
- Indeks `c` w quizie liczony od 0. Zawsze dawaj pole `e` (wyjaśnienie).

## Czego NIE robić
- Nie dodawać frameworków/bundlerów (ma zostać jednoplikowo-odpalalne).
- Nie używać `fetch` do danych.
- Nie zmieniać klucza `localStorage` bez migracji (utrata postępów użytkownika).
