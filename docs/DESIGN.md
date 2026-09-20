# Recall — design system „Duolingo in dark”

Tokeny: `packages/shared/src/theme.ts` (`COLORS` tła/tekst, `PLAY` kolory zabawy z odcieniami `*Deep`, `HARD_EDGE`, `SUBJECT_HUES` z `deep`, `hueFromColor()`, `RADIUS`, `SPACE`, `TYPE`, `MOTION`, `cssVars()`). Maskotka: `mascot.ts`. Logo: `logo.ts`. Ścieżka: `path-layout.ts`. Dźwięki: `sfx.ts` + `packages/assets/sfx`. Web i mobile używają tych samych wartości.

## Idea
Ciemne, warstwowe tło (bg0→bg4) zostaje, ale wszystko na nim jest **grube, kolorowe i żywe**: nasycone kolory `PLAY` (zielony `#58CC02`, niebieski `#1CB0F6`, fiolet, pomarańcz, czerwień, żółty), przyciski i kafle z **twardą krawędzią 3D** (4 px ciemniejszego odcienia pod spodem, wciśnięcie = przesunięcie w dół), wijąca się ścieżka z dużymi węzłami, skrzynki i trofea, serca, klejnoty, płomień serii, maskotka **Rec** reagująca na wszystko, krótkie dźwięki. Każdy ekran jest wypełniony: nagłówek z liczbami, karta akcji, lista/siatka, zajawka kolejnej rzeczy. Zero pustych połaci.

## Kolor
- Tła: `bg0` strona, `bg1` shell, `bg2` karty, `bg3` uniesione/inputy, `bg4` hover. Hairline `line`.
- **Akcje**: zielony = główne CTA (Start, Dalej, Kontynuuj), niebieski = drugorzędne/informacje, fiolet = AI/generowanie, pomarańcz = seria, czerwony = błąd/serca, żółty = XP/gwiazdki/trofea, `gem` błękit = klejnoty.
- Kolor przedmiotu (`hueFromColor(subject.accent2)`): kafle przedmiotu, węzły ścieżki, pasek postępu lekcji, baner jednostki. Zawsze para `color` + `deep`.
- Semantyka: `success`=zielony, `danger`=czerwony, `info`=niebieski, `streak`=pomarańcz. Wersje `*Soft` jako tła chipów i arkuszy feedbacku.
- Złoto `accent` zostaje tylko dla XP i rangi.

## Typografia
- Display: **Bricolage Grotesque** 700–800 (nagłówki, liczby XP/klejnotów, tytuły lekcji, napisy na przyciskach 3D uppercase 700, `letter-spacing 0.04em`).
- Body: **Manrope** 400–700, 15–16 px. Etykiety 12 px uppercase `letter-spacing 0.12em`. Liczby `tabular-nums`.

## Komponenty (identyczne w obu UI)
- **Przycisk 3D** (`.btn3d` / `Button3D`): tło = kolor, `box-shadow: 0 4px 0 deep`, radius 16, wysokość 52 (mobile) / 48 (web), tekst uppercase 700; `:active` = `translateY(4px)` + cień 0; warianty green/blue/purple/gold/red/ghost (ghost = `bg3` + krawędź `surfaceDeep` + hairline). Dźwięk `tap`.
- **Kafel 3D** (`.card3d`): to samo z krawędzią w `deep` koloru kafla; używany dla przedmiotów, CTA „Z materiałów / Z hasła”, kart statystyk.
- **Karta** (`.card`): `bg2` + hairline; bez krawędzi 3D (dla treści, list).
- **Węzeł ścieżki** (`.node3d`): 76 px koło, krawędź 3D 6 px; done = kolor przedmiotu + biały ✓ + 3 gwiazdki pod spodem; aktywny = kolor + biały ring 4 px + pulsująca poświata + dymek „START” skaczący nad węzłem; zablokowany = `bg3` + krawędź `surfaceDeep` + kłódka `faint`; skrzynka = kafel 64 px z ikoną skrzyni (szara zamknięta / złota trzęsąca się gdy otwieralna); trofeum = złoty puchar na końcu. Ścieżka SVG z `layoutPath()`: kreskowana hairline, wypełniona kolorem przedmiotu do aktywnego węzła.
- **Ring postępu** (SVG): cel dzienny (pomarańcz/zielony), celność, postęp przedmiotu.
- **Pills**: seria (płomień + liczba, pomarańcz), klejnoty (błękit), serca (5 serc lub ∞ dla Pro), XP (złoto). Szkło `bg3` + hairline.
- **Pasek segmentowy** lekcji: jeden segment na krok, wypełnienie zielone z animacją; serca i badge combo w nagłówku.
- **Arkusz feedbacku**: wjeżdża z dołu, zielony (`successSoft`, ramka `success`) lub czerwony; maskotka happy/sad 56 px, tytuł „Dobrze!” / „Nie tym razem”, wyjaśnienie, chip „+5 XP ×2”, przycisk 3D DALEJ (zielony/czerwony).
- **Combo badge**: pojawia się od 2 z rzędu, licznik, przy 5 → „×2” (niebieski), 10 → „×3” (fiolet) z pulsem i dźwiękiem `combo`.
- **Karta statystyki** wyniku: kafel 3D z ikoną, etykietą i dużą liczbą (licznik animowany); 4 karty: XP (złoto), celność (ring), czas, klejnoty.
- **Karta questów**: 3 wiersze (ikona, tytuł, pasek, nagroda „+10 💎”), przycisk „Odbierz” 3D gdy done; po odbiorze animacja klejnotów do pilla.
- **Kafle przedmiotów**: 2 kolumny, tło `hue.soft`, krawędź `hue.deep`, emoji 40 px, nazwa, „3 tematy”, mini-ring %, badge sprawdzianu.
- **Ranking**: podium top 3, wiersze (ranga, imię, XP), Twój wiersz przypięty.
- **Odznaki**: siatka 3–4 kolumn, kafel z ikoną; zablokowane w skali szarości + „?”.
- **Maskotka**: Home (idle / sleep gdy seria zagrożona / cheer gdy cel zrobiony), arkusz feedbacku, wynik, onboarding, login, puste stany, modal braku serc. Dymek z linią z `MASCOT_LINES`.
- **Tab bar**: 4 zakładki (Start, Dziś, Ranking, Konto) z ikonami SVG, aktywna ikona zielona + pill pod spodem; mobile z blurem.
- **Modale**: level-up rangi, odblokowana odznaka, brak serc (czekaj / 150 💎 / Pro), streak (płomień + liczba dni).

## Ruch
- Springi (web `motion`, mobile Reanimated): wejścia kart z opóźnieniem 60 ms na element, skok maskotki, gwiazdki, liczniki XP/klejnotów, badge combo.
- Przejścia faz lekcji: slide + fade (`AnimatePresence`). Arkusz feedbacku: slide z dołu 260 ms.
- Ścieżka: auto-scroll do aktywnego węzła; dymek START bounce 1.2 s w pętli; skrzynka „shake” co 3 s gdy otwieralna.
- Confetti: przy zaliczonym poziomie, skrzynce, level-upie; kolory przedmiotu + złoto + zielony; ≤ 80 cząstek.
- `prefers-reduced-motion` / Reduce Motion → bez pętli i skoków, zostają fade.

## Dźwięk
`tap`, `correct`, `wrong`, `combo`, `levelup`, `streak`, `chest`, `gem`. Toggle w ustawieniach (`user_meta.sound_on`) i ikona mute w lekcji. Web odtwarza po pierwszym geście; mobile przez `expo-audio` (cichy tryb telefonu = cisza).

## Czego nie robić
Puste ekrany z jedną kartą. Emoji zamiast ikon w nawigacji. Płaskie przyciski bez krawędzi 3D. Neonowe gradienty na tle. Animacje bez celu (ruch ma nagradzać lub prowadzić).
