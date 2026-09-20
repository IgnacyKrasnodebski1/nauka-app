# Recall — design system „Premium dark”

Tokeny: `packages/shared/src/theme.ts` (`COLORS`, `SUBJECT_HUES`, `RADIUS`, `SPACE`, `TYPE`, `SHADOW`, `MOTION`, `cssVars()`, `subjectHue()`). Web i mobile używają **tych samych wartości**. Nic nie hardkodujemy w komponentach.

## Idea
Ciemny, cichy, drogi. Jak dobry hardware'owy dashboard, nie jak neon w klubie. Głębia przez **warstwy** (bg0 → bg4), **szkło** (półprzezroczyste powierzchnie + 1px hairline + 1px górny highlight), **jeden ciepły akcent** (złoto `#F2C14E`) na chłodnym tle, i **kolor przedmiotu** jako drugi, spokojny kolor. Zero tęczowych gradientów, zero różowo-fioletowo-cyjanowych pasów.

## Kolor
- Tło strony `bg0 #07080C`, sekcje `bg1`, karty `bg2`, karty uniesione / inputy `bg3`, hover `bg4`. Nigdy czysta czerń.
- Szkło: `glass` + `line` + `highlight` (inset top). Hover: `glassHover` + `lineStrong`.
- Tekst: `text` (nagłówki, wartości), `textSoft` (body), `muted` (opisy, etykiety), `faint` (placeholdery, disabled).
- Akcent **złoty** tylko na: primary CTA, XP, aktywnej zakładce, kluczowej liczbie. Maksymalnie jeden złoty element w polu widzenia poza XP.
- Kolor przedmiotu (`SUBJECT_HUES`, `subjectHue(name)`): ring ikonki, pasek postępu, poświata nagłówka przedmiotu, aktywny node ścieżki. Nasycenie niskie, jasność wysoka — czytelne na ciemnym.
- Semantyka: `success` mięta, `danger` łosoś, `info` błękit, `streak` pomarańcz. Zawsze z wariantem `*Soft` jako tło chipa.
- Poświaty: `radial-gradient` 0.10–0.18 alpha w kolorze przedmiotu za nagłówkiem/hero, rozmyte, nigdy ostre.

## Typografia
- Display: **Bricolage Grotesque** 600–800 (nagłówki, liczby XP, tytuły lekcji). `letter-spacing: -0.02em`, `text-wrap: balance`.
- Body: **Manrope** 400–700. 15px base na mobile, 15–16 na web, `line-height 1.5–1.65`.
- Etykiety (eyebrow): 12px, 600, uppercase, `letter-spacing 0.12em`, kolor `muted`.
- Liczby: `font-variant-numeric: tabular-nums`.
- Web: Google Fonts link. Mobile: `@expo-google-fonts/bricolage-grotesque` + `@expo-google-fonts/manrope` (ładowane w root layout, splash do czasu załadowania).

## Kształt i przestrzeń
- Promienie: karty 22 (`lg`), przyciski 16 (`md`), chipy pill, inputy 14–16, telefon: sekcje 24–28 (`xl`).
- Gap zamiast marginesów; siatka 8px. Padding kart 20–24. Gutter 16 mobile / 24–48 web.
- Karta = jeden obiekt: te same krawędzie, ta sama pozycja ikony, ta sama linia bazowa tytułu.

## Komponenty (oba UI mają wyglądać identycznie)
- **Przycisk primary**: tło złoty gradient (`accentStrong → accent`), tekst `accentInk` 700, `shadow.glow`, hover: jaśniej + uniesienie 1px; active: scale 0.98. Wysokość 48 (mobile) / 44 (web).
- **Przycisk secondary**: szkło (`glass` + `line`), tekst `text`. **Ghost**: sam tekst `textSoft`.
- **Karta**: `bg2`, `line`, `shadow.card`, top highlight; hover (web): `lineStrong`, przesunięcie −2px. Nie każda rzecz to karta — listy w sekcji rozdziela hairline, nie ramki.
- **Ikona przedmiotu**: 52px kwadrat r16, tło `hue.soft`, ring 1px `hue.color` 40%, emoji 26px na środku. Kolor przedmiotu też w pasku postępu.
- **Pills (streak / XP)**: szkło, ikona + liczba display 600 + etykieta muted. XP w złocie, streak w pomarańczu.
- **Ścieżka poziomów**: pionowa oś z hairline; węzły 64px: zrobione = wypełnione kolorem przedmiotu + ✓, aktywny = pulsująca poświata w kolorze przedmiotu + złoty ring, zablokowany = `bg3` + kłódka `faint`. Gwiazdki małe, złote, pod węzłem.
- **Lekcja**: pasek postępu u góry (kolor przedmiotu na `bg3`), etap jako eyebrow. Karty treści (feed) `bg2` z dużym tytułem display. Odpowiedzi quizu: pełnej szerokości, `bg3`, hover `bg4`; wybrana: ring złoty; poprawna: `successSoft` + `success` ring; błędna: `dangerSoft`. Wyjaśnienie w bloku `info`.
- **Fiszka**: 3D flip (perspective), front `bg3` z display, tył `bg2`; oceny 0–3 jako 4 chipy.
- **Mini-gry**: te same powierzchnie; dopasowane pary znikają z animacją skali; luka podświetlona ringiem przedmiotu.
- **Wynik lekcji**: duża liczba XP display 48 w złocie (licznik animowany), gwiazdki wpadające springiem, jedno subtelne „confetti” w kolorze przedmiotu i złocie (max 40 cząstek, 1.2 s).
- **Dziś**: karta hero z `bg2`, poświata przedmiotu z sesji, tytuł display, 3 metryki (powtórki / słabe / nowy) jako mini-pills, CTA złote.
- **Nawigacja**: web — górny pasek szkło + blur z logo i pills; mobile — tab bar szkło + blur, aktywna ikona złota, etykieta 11px.
- **Puste stany**: ikona w tinted tile, jedno zdanie, jeden przycisk. Bez ścian tekstu.
- **Toast**: dół, szkło, 2.2 s.

## Ruch
- Przejścia 140–220 ms `ease` z tokenów. Hover/press tylko transform + kolor. `prefers-reduced-motion` → bez animacji.
- Spring (`MOTION.spring`) do XP, gwiazdek, flipa fiszki. Nie animować layoutu list.

## Czego nie robić
- Tęczowe gradienty, neony, `#ff2d95/#a855f7/#22d3ee`. Emoji jako nagłówki sekcji. Wszystko wyśrodkowane. Cień na każdym elemencie. Karty w kartach w kartach.
