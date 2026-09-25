# Recall — design system 2.0

**Źródło prawdy: `design/DESIGN.md` (59 ekranów, handoff) + `design/tokens.css` (zmienne, keyframes, przepisy na komponenty) + `design/preview/*.html` (referencja wizualna, 390×844).** Ten plik tylko mówi, jak system jest wpięty do monorepo. Mapa portu dla agentów UI: `docs/PORT-2.0.md`.

## Tokeny w kodzie — `packages/shared/src/theme.ts`
- `TOKENS` — płaski obiekt 1:1 z każdą zmienną `--*` z `tokens.css` (klucz = nazwa bez `--`, np. `TOKENS["acid-dark"]`, `TOKENS.surface`). `token(name)` dla RN.
- `TOKENS_CSS` — dokładna treść `design/tokens.css` jako string. **Web wstrzykuje ją raz, dosłownie** (globalny `<style>`), razem z `FONT_LINK` (Google Fonts: Bricolage Grotesque 700/800 + Plus Jakarta Sans 500–800). Test pilnuje, że string = plik.
- `MOTION_CLASSES` (`a-float … a-shake`, `d1…d6`) + `MOTION_USAGE` (gdzie która klasa, wg design/DESIGN.md §2). Mobile odtwarza te same ruchy w Reanimated; `prefers-reduced-motion` / Reduce Motion = zero animacji.
- Stare nazwy zostają i wskazują na nową paletę: `COLORS` (`bg0`=bg, `bg1`/`bg3`=surface-2, `bg2`=surface, `bg4`=line-2, `line`, `text`/`textSoft`/`muted`/`faint`, `accent`=acid, `xp`=gold, `streak`=flame, `danger`=red, `info`=cyan), `PLAY` (`green`→acid, `blue`→cyan, `purple`→violet, `orange`→amber, `red`, `yellow`→gold, `pink`, `gem`=cyan; `*Deep` = `*-dark`, `*Soft` = `tint-*`), `SUBJECT_HUES` = 6 akcentów przedmiotów (acid, pink, amber, cyan, gold, violet) z `color/deep/soft/on/softLine`, `hueFromColor()`, `accentVars()` (`--accent`, `--accent-dark`, `--on-accent` na kontenerze przedmiotu), `HARD_EDGE`=4 + `DROP` {card 4, btn 5, node 6}, `RADIUS` (13/18/22/28/999), `SHADOW` (twarde cienie), `TYPE` (display Bricolage 800, body Plus Jakarta Sans), `cssVars()` (stare `--play-*`, `--bg*` + wszystkie tokeny 2.0).

## Zasady (skrót z design/DESIGN.md §1)
- Płaskie, nasycone kolory, **bez gradientów**. Pod każdym klikalnym elementem gruby cień bez rozmycia (4–7 px); wciśnięcie zjeżdża o tyle samo (`.btn`, `.card`, `.node` w tokens.css).
- Tło `#0E0C1C`, karta `#1B1836`, obramowanie `#2C2850`. Akcja = limonka `#B4FF3A` (`--on-acid` na tekście). Kolor przedmiotu przez `--accent`. Seria = `--flame`, błąd = `--red`, XP = `--gold`, klejnoty = `--cyan`.
- **Zero emoji w UI**: ikony inline SVG (stroke 2.4–3.4); emoji z danych → monogram w kolorowym kafelku.
- Cel dotyku ≥ 44 px, kontrast 4.5:1 (duży tekst 3:1). Ton rzeczowy i ciepły, bez slangu — od 12-latka do studenta.
- Ruch tylko z klas/keyframes tokenów; lista „gdzie co” w §2 handoffu.

## Ekrany
Lista 59 ekranów, ich trasy i grupy: design/DESIGN.md §3. Które funkcje shared i który `render…` z `legacy/engine.js` je implementuje: `docs/PORT-2.0.md`.

## Czego nie robić
Gradienty i rozmyte cienie na elementach. Emoji jako ikony. Płaskie przyciski bez krawędzi. Literały kolorów poza `theme.ts` / `tokens.css`. Puste ekrany z jedną kartą.
