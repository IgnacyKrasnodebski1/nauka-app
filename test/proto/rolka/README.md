# Rolka — prototyp (Cramfox)

**Rolka** to pionowa (9:16) opowieść na 45–90 s, zrobiona z materiału ucznia: lektor czyta krótką narrację, a w izometrycznym „świecie” pojęcia są miejscami (stacjami) połączonymi drogami. Kamera przelatuje między stacjami, pojawiają się etykiety z liniami, karty z faktami, napisy karaoke, numerowane rozdziały, przerywniki (telefon, mapa z łukiem, kropki proporcji, klocki-wzór). Lis Cramfox jest przewodnikiem: wskakuje z gestami (wskazuje, wzrusza ramionami, myśli, kciuk w górę, cieszy się). Na końcu jest jedno pytanie sprawdzające.

To prototyp w `test/proto/rolka/`. Nie wchodzi do `build/` ani do apki. Jest napisany tak, żeby dało się go potem wkleić do jednego pliku HTML dla Capacitora: zwykły JS, SVG i HTML, bez bibliotek i bez sieci. Fonty bierze z `fonts/` w repo.

## Pliki

| plik | co robi |
|---|---|
| `index.html` | scena 390×844 i warstwy: świat (SVG), linie (SVG), etykiety, rozdziały, przerywniki, lis, napisy, pasek, quiz, okładka |
| `engine.js` | cały silnik w jednym IIFE: rzut izometryczny, bryły, biblioteka rekwizytów, świat, oś czasu, render(t), lis, przerywniki, quiz, lektor |
| `styles.css` | wygląd warstw HTML (bez animacji CSS: ruch liczy silnik) |
| `storyboards/rewolucja.json` | rewolucja francuska z notatek (`~/.cramfox-simtest/notatki.html`), z nagranym lektorem |
| `audio/rewolucja.mp3` | lektor „Dawid” (ElevenLabs, model `eleven_v4`), cała rolka jednym nagraniem, 104 s |
| `audio/rewolucja.words.json` | czasy słów nagrania (`{w, start, end, tag?}`) z transkrypcji w tym samym Flow ElevenLabs |
| `storyboards/fotosynteza.json` | fotosynteza (biologia, liceum): dowód, że silnik jest ogólny |
| `private/` | prywatne scenariusze właściciela z nagraniem (poza gitem, `test/.gitignore`); `storyboards/msgip.json` to dowiązanie do jednego z nich |
| `shoot.mjs` | zrzuty klatek obu rolek w Chrome (390×844 @2x) + paski ruchu i arkusze; w każdej klatce sprawdza, czy tekst nie wylewa się z ramki i czy etykiety/karty/daty nie wychodzą poza ekran |
| `check-speech.mjs` | test synchronizacji napisów z lektorem na atrapie syntezy (lektor szybszy i wolniejszy niż szacunek); każde tempo w osobnym Chrome, bo trzecia karta w jednym Chrome bywa dławiona i udaje zacięty zegar |
| `check-audio.mjs` | test nagrania: tabela wyrównania słów i prawdziwe odtwarzanie mp3 w Chrome (zegar rolki vs `audio.currentTime`), plus raport efektów dźwiękowych (ile zaplanowano, z jakim wyprzedzeniem); Chrome dostaje atrapę wyjścia audio (`--disable-audio-output`), bo przy uśpionych głośnikach Maca nagranie stało na 0 s |

## Jak uruchomić

Scenariusz wczytuje się przez `fetch`, więc rolka potrzebuje serwera. Nie działa z `file://`. Serwer Pythona nie obsługuje nagłówka `Range`, więc silnik pobiera nagranie lektora w całości (blob) i dopiero wtedy przewijanie (strzałki, `Rolka.seekPlay`) działa — także w Safari, które bez `Range` nie przewija mediów.

```bash
cd ~/nauka-app && python3 -m http.server 8765
# http://localhost:8765/test/proto/rolka/?sb=rewolucja
# http://localhost:8765/test/proto/rolka/?sb=fotosynteza
```

Parametry URL:

- `sb=nazwa` wybiera scenariusz z `storyboards/nazwa.json`. Domyślnie `rewolucja`.
- `t=12.5` pokazuje dokładną klatkę dla tej chwili. Razem z `paused=1` daje stopklatkę do zrzutu, bez okładki i ikony pauzy.
- `answer=1` (razem z `t` po końcu narracji) pokazuje quiz z wybraną odpowiedzią.
- `mute=1` wyłącza lektora. Przy nagraniu zegar dalej idzie za nagraniem (wyciszonym), bez nagrania czasy słów są szacowane.
- `rate=1.3` zmienia tempo nagrania (domyślnie `audio.rate` ze scenariusza; wysokość głosu zostaje).
- `cover=0` pomija okładkę.

Sterowanie:

- stuknięcie w ekran: pauza i wznowienie;
- przycisk głośnika: lektor włączony lub wyłączony;
- przycisk strzałki: od początku;
- na komputerze: spacja to pauza, strzałki przewijają o ±2 s, `r` zaczyna od nowa.

W konsoli dostępne jest `Rolka.state()` (czas, tryb, głos, sceny) i `Rolka.seek(t)`.

Zrzuty i testy:

```bash
node test/proto/rolka/shoot.mjs --round 0              # wszystkie klatki → <scratchpad>/rolka-shots/0/<sb>-<t>.png
node test/proto/rolka/shoot.mjs --sb fotosynteza --t 5,12.4,30 --round x
node test/proto/rolka/check-speech.mjs                 # napisy vs lektor przy tempie ×0.7, ×1, ×1.4
node test/proto/rolka/check-audio.mjs --table          # nagranie: wyrównanie słów + odtwarzanie od 0 s i od 58 s
node test/proto/rolka/shoot.mjs --round voice --sb rewolucja --around Bastylia,1788,Ludwik   # klatki 0,06 s przed i po początku słowa
node test/proto/rolka/shoot.mjs --round x --sb rewolucja --series 74:87:1 --sheet scena9      # cała scena co 1 s + arkusz _sheet-rewolucja-scena9.png
```

`shoot.mjs` sam serwuje repo, używa `puppeteer-core` z `test/node_modules` i Chrome z `/Applications`. Domyślnie robi:

- środek każdej sceny;
- serie po 5 klatek co 0,2 s przy przejściach kamery, zebrane też w pasek `_ruch-<sb>.png`;
- quiz przed odpowiedzią, po złej i po dobrej;
- okładkę.

## Zegar i lektor

Są trzy tryby, wybierane w tej kolejności:

1. **Nagranie (`audio`)**, gdy scenariusz ma `audio` i da się wczytać czasy słów. Zegar rolki to `audio.currentTime`, czyli czas nagrania. Kamera, akcje, napisy i usta lisa liczą się z niego, więc nic się nie rozjeżdża przy pauzie, przewijaniu ani zacięciu sieci. Między klatkami czas jest dociągany zegarem przeglądarki, maksymalnie o 0,25 s. Po końcu nagrania zegar idzie sam do quizu. `audio.rate` przyspiesza nagranie przez `playbackRate`, a wysokość głosu zostaje bez zmian. Oś czasu jest w sekundach nagrania, więc `?t=` się nie zmienia.
2. **Lektor przeglądarki (`speech`)**, czyli opis niżej.
3. **Szacunek (`timer`)**.

Czasy słów z nagrania:

- Transkrypcja (`audio/*.words.json`) ma słowa z `start` i `end`. Znaczniki typu `[excited]` mają `tag: true` i są pomijane.
- Silnik dopasowuje napisy (`say`, a przy zapisie `{a|b}` część mówioną) do transkrypcji globalnym wyrównaniem sekwencji (Needleman–Wunsch, podobieństwo słów z odległości Levenshteina). Słowo bez pary, np. liczba przeczytana słownie albo skrót, dostaje czas niesparowanych słów transkrypcji między sąsiadami, proporcjonalnie do sylab.
- Poprawka liczb: wyrównanie TTS potrafi dać „1788” 0,24 s, a następne słowo („roku”) połyka resztę roku. Gdy liczba jest dużo za krótka, a następne słowo dużo za długie, silnik dzieli ich wspólny odcinek według sylab. W rewolucji poprawił tak „1788” i „97%”.
- Scena zaczyna się 0,1 s przed swoim pierwszym słowem i kończy się początkiem następnej. `hold` liczy się tylko w ostatniej scenie. Akcje z `on` startują dokładnie z początkiem słowa.
- Ten sam rachunek działa w `?t=…&paused=1`, bez odtwarzania. Zrzuty pokazują więc dokładnie te klatki, które widać przy nagraniu. Sprawdzone 17.10: dwa świeże wczytania tej samej chwili dają identyczne piksele (15 chwil z obu rolek), a przejście klatka po klatce (30 kl./s) do tej chwili — też. Po dużych skokach `Rolka.seek` w jednej karcie różni się tylko wygładzanie tekstu napisów (pamięć rastra Chrome przy `will-change`), czego nie widać gołym okiem.
- Rewolucja: dopasowane 200 z 200 słów, poprawione 2 liczby. Przy odtwarzaniu w Chrome (×1,2, od 0 s, 40 s i 88 s; przebieg z 17.10) zegar rolki różni się od `audio.currentTime` średnio o 10–11 ms, maksymalnie o 26 ms. Podświetlone słowo zgadza się z mową w 274 z 276 próbek, a różnice wypadają na granicy słów. W przebiegu od 88 s maksimum 0,7 s pochodzi z próbek po końcu nagrania (104 s), gdy zegar idzie już sam do quizu. Podczas przewijania (`seeking`) zegar stoi i nie wyprzedza nagrania.

Lektor przeglądarki (bez nagrania):

- Silnik ma jedną funkcję `render(t)`. Każdy ruch jest liczony z `t`: kamera, dryf, etykiety, paczki, tunel, lis, przerywniki. Ta sama chwila daje więc tę samą klatkę. Nie ma tu `Math.random` w renderze ani animacji CSS.
- Narracja jest dzielona na słowa z szacowanym czasem: `0,09 s + 0,053 s` na literę, z pauzą po przecinku i kropce. Szacunek sprawdziłem na macOS (`say -v Zosia`, tempo 1): narracja rewolucji (200 słów) trwa 110,0 s przy szacunku 107,5 s, a fotosyntezy (165 słów mówionych) 75,9 s przy szacunku 78,5 s.
- **Z lektorem** (`speechSynthesis`, głos `pl-PL`, najpierw lokalny, np. Zosia) każda scena to osobna wypowiedź. Zegar biegnie, ale nie wyprzedza następnego słowa, dopóki lektor go nie powie (zdarzenie `boundary`). Gdy lektor jest szybszy, zegar przeskakuje do jego słowa. Jeśli głos nie wysyła granic słów, zegar czeka na koniec wypowiedzi. Strażnik kończy scenę, gdyby zdarzenie `end` nie przyszło.
- **Bez lektora** (brak polskiego głosu, wyciszenie, błąd syntezy) rolka idzie według szacowanych czasów.
- Na iOS pierwsze `speak()` musi paść w geście użytkownika, dlatego przycisk „Odtwórz rolkę” od razu startuje pierwszą scenę.
- Pauza przerywa syntezę. Wznowienie czyta scenę od bieżącego słowa.

## Scenariusz — co musi wygenerować AI

Jeden obiekt JSON. Wszystkie teksty są po polsku i bez emoji. Silnik wstawia tekst przez `esc()` lub `textContent`. Kolory muszą mieć postać `#hex`, inne wartości silnik usuwa.

```jsonc
{
  "title": "Fotosynteza",                         // krótki tytuł (pasek u góry)
  "cover": { "title": "Drzewo NIE je ziemi", "sub": "Fotosynteza w {s} s · pytanie na końcu" },  // okładka: hak zamiast spisu treści; {s} = długość w s
  "maxLabels": 2,                                 // opcjonalnie: ile etykiet świata naraz (domyślnie 2)
  "audio": { "src": "audio/x.mp3", "words": "audio/x.words.json", "rate": 1.2 },  // opcjonalnie: nagranie lektora + czasy słów (ścieżki względne)
  "voice": { "provider": "elevenlabs", "model": "eleven_v4", "voice_id": "…", "name": "Dawid" },  // opcjonalnie: czym nagrano (informacyjnie)
  "camDur": 0.95,                                 // opcjonalnie: domyślny czas przelotu kamery (s)
  "subject": "Biologia",                          // opcjonalnie, na okładce
  "intro": "Skąd roślina bierze budulec…",        // opcjonalnie, podtytuł okładki
  "rate": 1,                                      // opcjonalnie, tempo lektora
  "world": {
    "seed": 23,                                   // stałe miasto-wypełniacz (ten sam seed = to samo miasto)
    "theme": "leaf",                              // opcjonalnie: "city" (domyślnie) albo "leaf" (wnętrze liścia: komórki, zielone żyłki zamiast dróg)
    "stations": [ { "id": "jasna", "kind": "cell", "label": "Tylakoidy", "x": -1, "y": -1,
                    "s": 1, "color": "#…", "date": "5 V", "dateName": "Stany Gen.", "z": 5, "text": "…", "colors": ["#…"], "h": 2, "n": 12, "bulb": true } ],
    "roads": [ ["woda", "jasna"], { "from": "slonce", "to": "jasna", "style": "beam", "color": "#F2B53A" } ],
    "zones": [ { "id": "chloroplast", "x": 2, "y": 2, "r": 5.8, "color": "#DCE8CB" } ]   // obszar: koło (r) albo prostokąt (w, d)
  },
  "scenes": [
    { "say": "Faza jasna, w tylakoidach. Światło rozbija cząsteczki wody i… uwalnia się tlen!",
      "tts": "[dramatically] Faza jasna, w tylakoidach. Światło rozbija cząsteczki wody i… [excited] uwalnia się TLEN!",
      "cam": { "to": "jasna", "zoom": 2.0, "y": 0.56 },
      "hold": 0.4,                                // opcjonalnie: dodatkowe sekundy po narracji
      "actions": [ { "type": "label", "at": "jasna", "text": "tylakoidy", "on": "tylakoidach", "style": "accent" },
                   { "type": "cam", "on": "uwalnia", "to": "tlen", "zoom": 2.0, "dur": 0.5 },
                   { "type": "cam", "on": "tlen", "to": "tlen", "zoom": 2.3, "dur": 0.2, "punch": true } ] }
  ],
  "quiz": { "q": "Skąd pochodzi tlen…?", "a": ["Z dwutlenku węgla", "Z wody", "Z glukozy", "Z gleby"], "c": 1, "e": "Tlen powstaje…" }
}
```

### Świat

- `x`, `y` to siatka mapy. Na ekranie pion to `x + y` (w dół), poziom to `x − y` (w prawo). Ekran jest wąski, więc stacje trzymaj blisko przekątnej: `|x − y| ≤ ~8`, a opowieść prowadź „w dół” (rosnące `x + y`). Sprawdza się zygzak: krok `+4.2` po `x`, potem `+4.2` po `y`. To jest oś czasu rewolucji.
- Stacje mają być co najmniej ~3,5 jednostki od siebie. Plac ma promień 1,55·`s`.
- Drogi to relacje (przyczyna → skutek, kolejność, przepływ). Do stacji w powietrzu (`sun`, `cloud`) silnik sam rysuje promień (`beam`).
- Dookoła silnik dorysowuje stałe miasto. Jest o ~30% mniej nasycone i jaśniejsze niż stacje, żeby stacje wyskakiwały z tła. W promieniu 4 jednostek od stacji budynki mają najwyżej 0,6 wysokości, a na drogach i w strefach nie ma ich wcale.
- Nad stacjami „lotnymi” (`sun`, `cloud`) i nad `bubbles` silnik nie stawia wypełniacza w całym słupie, który zajmują na ekranie, a pod nimi rysuje plac z cieniem. Słońce nie siedzi więc na dachach.
- `theme: "leaf"` zamienia miasto na tkankę liścia: niskie, płaskie sześciokątne płytki-komórki (wysokość ≤ 0,25) z ciemniejszą ścianą i 2–3 chloroplastami na wierzchu (jak w przybliżeniu), drobne pęcherzyki zamiast drzew, ciemne żyłki `#3F6F45` z jasną przerywaną zamiast asfaltu, ciepłe jasne tło `#EEEAD2`. Kolor tła sceny i winiety idzie za motywem.
- Kolor wyróżnień zależy od motywu (`accent`): na mieście limonka, na liściu słoneczna żółć `#E6B54E` z ciemnym obrysem (pierścień `highlight`, pas `recap`, etykieta `accent`, zapalona plakietka). Limonka ginęła na zielonym tle.
- Rekwizyt może mieć **części** (`B.part('top')` w bibliotece): korona nad poduszką (`crown` → `top`), zdrowe i suche zboże (`field` → `ok` i ukryte `dry`). Część przesuwa się osobno (`strike` z `fall`) albo przełącza (`state`), razem ze swoim cieniem.
- Pierwszy plan: kilka dużych, rozmytych brył rysowanych w skali ×1,4 kamery. Widać je tylko przy krawędziach kadru i tylko wtedy, gdy kamera naprawdę leci (paralaksa w przelotach). W spoczynku znikają.

### Kamera (`cam` sceny i akcje `cam`)

Kamera sceny (`cam`) ustawia kadr na początku sceny. **Akcje `cam`** to uderzenia kamery na konkretne słowa — rolka nie może trzymać jednego kadru przez 7 s. Każde zdanie z nowym podmiotem ma dostać swój ruch.

- `to` przyjmuje id stacji, listę id (kadr obejmie wszystkie), `[x, y]` albo `"all"`. W akcji `cam` brak `to` = zostaje w miejscu (sam najazd).
- `zoom`: zbliżenie 1,9–2,6, kadr 2–3 stacji ~1,3–1,6, odjazd na całą oś ~0,7. `"fit"` = dopasuj kadr do listy stacji. W akcji `cam` brak `zoom` = bez zmiany.
- `y` to miejsce celu na ekranie, domyślnie 0,43 wysokości (przy etykietach nad stacją lepiej 0,52–0,56).
- `dx`, `dy` przesuwają cel (px przy zoomie 1), np. na przewróconą koronę obok placu.
- `dur` to czas ruchu: przelot sceny domyślnie 0,95 s (`camDur` scenariusza), akcja `cam` 0,5 s. Długi `dur` (np. 6 s) daje powolny najazd.
- `ease`: `io` (domyślnie), `out`, `in`, `lin`.
- Akcja `cam` rusza 0,12 s przed słowem (`lead`), żeby kadr dojechał razem z akcentem.
- `punch: true` — uderzenie na końcu ruchu: najazd o ~9% w 0,06 s, drgnięcie do 6 px, jednoklatkowy biały błysk (`flash: false` wyłącza błysk) i dźwięk „thud”. To samo bez ruchu kamery daje akcja `impact`.
- `"cam": "keep"` w scenie = bez przelotu na początku sceny (zostaje kadr z poprzedniej).
- `pan` (stare) — powolny przejazd przez całą scenę; lepiej użyć akcji `cam` na słowo.
- Przy długich przelotach kamera lekko się oddala. Zawsze ma delikatny dryf i powolny najazd (+3,5% w 4 s po dojechaniu).
- Gdy pojawia się lis, świat odsuwa się o ~70 px (84 px przy dużym lisie) w drugą stronę, żeby lis nie zasłaniał tematu. Winieta (rozjaśnienie środka) idzie za celem kamery.

### Narracja (`say` i `tts`)

- Rejestr rolki (decyzja właściciela z 17.10.2026) to TikTok: hak w pierwszych 2 s, który obala mit; otwarta pętla („Zostań do końca, bo finał? Kompletny odlot.”) domknięta później; krótkie, mocne zdania; pytania retoryczne; zaskoczenia; humor. Lekki potoczny język jest dozwolony, ale bez wulgaryzmów i bez żenady. Fakty muszą się zgadzać co do joty.
- **Słowa-uderzenia w napisach:** słowo pisane WIELKIMI w `tts` (o ile w `say` nie jest skrótem pisanym wielkimi, jak USA, ATP, XIX) albo zakończone „!” w `say`. Idzie samo w ramce, 1,3× większe, wielkimi literami, na limonce z ciemnym tekstem, z przeskokiem skali w 120 ms i drgnięciem o 2 px. Rewolucja ma ich 12 (NIE!, DZIESIĘĆ, CZTERY, PUSTY, WSZYSTKIE, SZALONY, PIŁKĘ!, BUM!, TAKI, ODLOT!, RÓWNOŚĆ, WZÓR), fotosynteza 9. Nie przesadzaj: jedno, najwyżej dwa na scenę.
- `say` to czysty tekst napisów, bez znaczników. `tts` to te same słowa dla ElevenLabs `eleven_v4`: znaczniki `[excited]`, `[whispers]`, `[laughs softly]`, `[sarcastic]`, `[dramatically]`, `[short pause]` stoją przed słowami, które kolorują. WIELKIE LITERY to akcent, oszczędnie. Lata zapisuj cyframi („w 1788 roku”). Rzymskie liczby i obce nazwiska zapisuj tak, jak mają brzmieć („Ludwik Szesnasty”, „Russo”, „Robespjer”). Silnik wyświetla `say` i dopasowuje go do transkrypcji, więc oba teksty muszą mieć te same słowa.
- Nagranie robimy raz dla całej rolki: sceny `tts` sklejone znakiem nowej linii, `generations_count: 1`, najpierw `estimate_only`. Potem w tym samym Flow transkrypcja (`eleven_scribe_v1`, `connect_from` = węzeł mowy), z której zapisujemy `words.json`.
- **Długość przy tym głosie:** „Dawid” mówi z emocjami i śmiechem około 1,9 słowa na sekundę. 200 słów dało 104 s, a nie 70. Rolka na 60–75 s to około 120–140 słów, a przy liczbach czytanych słownie jeszcze mniej.
- Mów krótkimi zdaniami, naturalnym językiem mówionym.
- Zapis `{pokaz|wymowa}` rozdziela napis od tego, co czyta lektor: `{1789:|tysiąc siedemset osiemdziesiątego dziewiątego:}`, `{ATP|a te pe}`, `{Rousseau:|Russo:}`, `{97%|dziewięćdziesiąt siedem procent}`. Interpunkcję daj w obu częściach.
- Długość dla lektora przeglądarki (Zosia): 110–150 słów, czyli około 60–75 s. Fotosynteza ma 165 słów, `rate: 1.12` i około 72 s szacunku. Każda scena ma 1–3 krótkie zdania.
- Hak na początku obala popularny mit: karta „Popularny mit” i `strike`.
- Bez faktów spoza materiału ucznia. Trudne momenty pokazuj symbolicznie, np. stracenie króla to spadająca z poduszki korona w odbarwionym świecie (`tone`) — bez lisa i bez efektów.
- Lata w `tts` lepiej pisać słownie i we właściwym przypadku („w tysiąc siedemset osiemdziesiątym ósmym roku”), a w `say` cyframi przez `{1788|…}`. Inaczej nie wiadomo, w jakim przypadku lektor przeczyta liczbę.
- Pytanie końcowe nie może dotyczyć tego, co hak pokazuje od pierwszej klatki. Najlepiej sprawdza rozróżnienie w obrębie tego, czego rolka uczy (np. cztery daty z 1789). Liczby w checkliście mają się zgadzać z narracją („cztery powody” + „trzy przyczyny na sprawdzian” → „3 z 4 przyczyn”).

### Akcje

Czas akcji ustala:

- `on: "słowo"` — pierwsze słowo sceny zaczynające się od tego tekstu, bez polskich znaków i wielkości liter;
- `w` — indeks słowa;
- `t` — sekundy od początku sceny.

Bez żadnego z nich akcja startuje 0,55 s po początku sceny.

Koniec akcji ustala:

- `dur` (sekundy);
- `scenes: n` — trwa n scen;
- `keep: true` — do końca rolki.

- `off: "słowo"` — koniec na początku słowa (np. przerywnik znika na „Ups.”).

Każde odwołanie do słowa (`on`, `off`, `lit`, `go`, `arrive`, `charge`, `on` linijek i klocków) może sięgnąć do innej sceny: `"Jeden@+1"` to słowo „Jeden” w następnej scenie, `"Dzięki@+1"` — w następnej itd. Tak plakietka z przyczyną zapala się, gdy lektor dojdzie do jej numeru, a bateria czeka do sceny, w której jest zużywana.

Domyślny koniec to koniec sceny. Wyjątki: `tunnel`, `strike`, `prop` i `state` trwają do końca, `fox` trwa 3,4 s, `burst` 0,9 s, a `chapter` do następnego rozdziału.

`on` szuka pierwszego słowa sceny, które zaczyna się od podanego tekstu; `"piłkę#2"` to drugie takie słowo. `t` może być ujemne: `"t": -0.6` w pierwszej scenie daje kartę w pełni widoczną już w klatce 0 (okładka i miniatura). Każde `on` warto stawiać na słowie, które mówi o tym samym co obraz: licznik ma dojść do 97 dokładnie na „97%”, klocek z glukozą ma wejść na „glukozę”.

Porządek na ekranie (silnik pilnuje sam):

- Najwyżej 2 etykiety świata naraz (`label` i `card` przy stacji). Nowa wypycha najstarszą, chyba że ta ma `keep`.
- Etykiety omijają: pas u góry (do 140 px: pasek, tytuł, chip rozdziału), pas napisów na dole, lisa, plakietki, chipy podsumowania, stację w kadrze, duże karty i kotwice innych etykiet. Szukają najbliższego wolnego miejsca w pionie i w bok.
- **Bez „duchów”:** każda nakładka jest albo w pełni widoczna (≥ 90%), albo znika w ≤ 0,25 s. Etykieta, której kotwica wyjdzie z bezpiecznego obszaru (pod pasek, pod napisy, za krawędź), znika od razu. Etykieta albo karta przy stacji schodzi, gdy rusza następny przelot kamery w inne miejsce (sam najazd na tę samą stację jej nie zabiera; `stay: true` wyłącza tę regułę). Chip rozdziału na środku gaśnie całkiem, zanim numer pojawi się w pasku. Lis schodzi, zsuwając się 40 px w dół i gasnąc, a nie kurcząc do kropki. `shoot.mjs` zgłasza każdą nakładkę z przezroczystością 0,05–0,9 — w raporcie zostają tylko klatki trafiające w przejście.
- Dwie rzeczy o jednej stacji: połącz w jedną kartę (linijki mogą wchodzić na słowa) albo daj drugiej inną kotwicę (`af`, `adx`).
- Tekst w karcie nie wylewa się z ramki: silnik zmniejsza czcionkę linijki (do 15 px), a dopiero potem ją łamie.

| type | pola | wygląd |
|---|---|---|
| `label` | `at` (id stacji, id strefy albo `[x,y,z]`), `text` (domyślnie `label` stacji), `dx`, `dy` (przesunięcie pigułki od kotwicy, domyślnie 0/−48), `style`: `dark` / `accent`, `af` (kotwica na ułamku wysokości rekwizytu, domyślnie 1 = szczyt), `z` (podniesienie kotwicy, np. nad dołożoną flagą), `adx`/`ady` (przesunięcie kotwicy w px przy zoomie 1), `ang` (dla strefy: kąt punktu na brzegu), `date: "21 stycznia 1793"` (chip z datą: ciemna część z datą + biała z `text`), `icon: "bread"`, `trend: "up"` / `"down"` (czerwona strzałka „pnie się” w pętli), `stay` | biała pigułka z linią w kształcie L i kółkiem na stacji |
| `card` | `id`, `title` albo `date` (ciemna pigułka z datą zamiast tytułu), `lines: ["tekst" \| {"t": "tekst", "on": "słowo"}]`, `at` (bez `at` = duża karta na środku, `y` 0–1), `dx`, `dy`, `af`, `adx`, `ady`, `stay` | karta z faktem; linijki z `on` wchodzą na swoje słowo |
| `strike` | `card` (id karty), `line` (indeks), `text` (nowa wartość) | stara wartość przekreślona na czerwono, nowa zielona |
| `strike` | `at` (stacja), `fall: true`, `part` (domyślnie `top`), `noX: true` | gdy rekwizyt ma część `top` (korona): tylko ona przewraca się przez krawędź poduszki, spada na plac, toczy się i zostaje — w pełni widoczna, cokół stoi; bez części przewraca się cały; bez `noX` pojawia się czerwony X |
| `strike` | `road: [a, b]` (promień do stacji w powietrzu), `pos` (0–1 od `a`) | promień szarzeje, na nim mały czerwony X (np. „ta faza nie korzysta bezpośrednio ze światła”) |
| `packet` | `from`, `to`, `via: []` albo `path: [[x,y],…]` (własna łamana), `n`, `color`, `text`, `ink`, `loop` (domyślnie tak), `dur`, `speed`, `gap`, `style`, `lane` (px w pionie), `untrim` (`true` / `"from"` / `"to"`: start lub koniec w środku stacji zamiast na brzegu placu), `hold` (s: po dojechaniu zostaje), `stop` + `go` + `arrive` + `morph` + `charge` + `drain` (niżej) | kropki jadące po drogach (trasa BFS po grafie dróg). `style`: `dot`, `pill` (z `text`, szerokość na tekst; rośnie z zoomem), `coin` (moneta), `people` (biegnące ludziki), `light` (iskra światła), `battery` (bateria z poziomem). Dwa odcinki: `stop` (stacja z `via` albo ułamek) — paczka dojeżdża pod plac tej stacji, czeka do słowa `go` i jedzie dalej; `arrive: "słowo"` liczy start wstecz, żeby paczka dojechała dokładnie na to słowo; `morph: {text, color, ink}` zmienia ją w punkcie `stop` z błyskiem i „pop” (H₂O → O₂); `charge: "słowo"` ładuje baterię, `drain` rozładowuje ją na końcu drogi |
| `badge` | `at`, `n`, `lit: "słowo@+k"` | numerowana plakietka na przodzie placu: ciemna, na swoje słowo zapala się w kolorze wyróżnienia i pulsuje (przyczyny 1–4) |
| `prop` | `at`, `kind`: `flag` / `bicorne`, `x`, `y`, `z` (wysokość podstawy), `h`, `w`, `scale`, `colors`, `drop: true` | dodatek dokładany w trakcie: domyślnie „pop” ze skali, z `drop` spada z góry z odbiciem i łupnięciem (bikorn na kopule pałacu); zostaje do końca |
| `state` | `at`, `show`, `hide` (nazwy części) | przełącza części rekwizytu z przenikaniem 0,25 s (pole: `ok` → `dry`) |
| `burst` | `at`, `kind`: `dust` / `spark`, `n`, `color`, `af`, `flash` | kłęby kurzu wokół podstawy albo iskry i pierścień przy szczycie (0,9 s); `flash` dodaje miękki błysk |
| `tone` | `sat` (domyślnie 0,7) | odbarwia cały świat na czas akcji (wejście i wyjście 0,5 s) |
| `tint` | `at`, `road: [a, b]`, `color` | stacja (filtr koloru), jej plac i odcinek drogi barwią się na kolor z wolnym pulsem (terror) |
| `recap` | `from`, `to`, `delay`, `step` (s między stacjami, domyślnie 0,15), `label`, `dates: false` | podsumowanie osi czasu: pas wzdłuż drogi rośnie od `from` do `to`, stacje zapalają się po kolei, przy każdej stacji z `date` wskakuje chip `date · dateName` z linią, naprzemiennie po obu stronach zygzaka, bez wygaszania przy kolizji; `label` (np. „1789–1799 · 10 lat”) nad pierwszą stacją |
| `tunnel` | `from`, `to`, `color` | zielony tunel z pierścieni rosnący wzdłuż drogi |
| `highlight` | `at` (stacja albo strefa), `r`, `color`, `style: "tint"` | pulsujący pierścień na placu (domyślnie w kolorze wyróżnienia; np. `#E0483F` na „robi się gorąco”); `tint` zamiast pierścienia zabarwia całą strefę (stroma) |
| `cam` | `to`, `zoom`, `y`, `dx`, `dy`, `dur`, `ease`, `lead`, `punch`, `flash` | ruch kamery na słowo (patrz „Kamera”); `dur` < 0,12 s = twarde cięcie (bez rozmytego pierwszego planu), np. powrót do kapelusza na „TAKI” |
| `impact` | `flash` | uderzenie bez ruchu kamery: drgnięcie, błysk, „thud” |
| `chapter` | `n`, `text`, `hold` (domyślnie 2,6 s) | duży numerowany chip, który po `hold` odjeżdża w górę i gaśnie w 0,3 s; dopiero potem numer i nazwa rozdziału są w pasku u góry |
| `fox` | `pose`: `point` / `shrug` / `think` / `thumbs` / `celebrate` / `wave` / `startle`, `side`: `left` / `right`, `size: "big"` (~200 px zamiast 150), `dur` | lis wskakuje w rogu, gestykuluje i rusza pyskiem, gdy lektor mówi; `startle` = podskok z przestrachu (na „BUM”); schodzi zsuwając się w dół (0,25 s) |
| `cutaway` | `kind`, `dim` (krycie tła 0–1; domyślnie 0,78, w `zoomin` 0,97) i pola niżej | wstawka nad światem |

Każda akcja może mieć `sfx`: rodzaj efektu (`pop`, `pop2`, `whoosh`, `thud`, `scratch`, `chime`, `tick`) albo `"none"`.

Rodzaje przerywników (`cutaway`):

- `phone`: `app`, `title`, `sub`, `rows: ["tekst" | {"t": "tekst", "on": "słowo"}]` — telefon z listą odhaczaną po kolei; wiersz z `on` odhacza się na swoje słowo.
- `dots`: `head`, `total`, `hit`, `value`, `unit`, `label`, `note`, `color`, `land: "słowo"` — siatka kropek i licznik („97% to stan trzeci”); z `land` licznik kończy dokładnie na początku tego słowa i lekko „puka”.
- `arc`: `title`, `from{label,x,y}`, `to{label,x,y}` (x, y 0–1), `extra[]` — mapa z łukiem i monetami.
- `tiles`: `title`, `tiles: [{t,k,c,on} | {op,c,on} | {br:true}]`, `note` — klocki, np. wzór sumaryczny; każdy klocek wchodzi na swoje słowo (`on`), znak bez `on` wchodzi tuż przed następnym klockiem. `k` to współczynnik („6”): podskakuje i świeci na limonkowo, gdy klocek wchodzi (warto dać `on` na „sześć”, „sześć#2”…). Strzałka między rzędami to „↓”, jej podpis (`c`) ma 15 px.
- `zoomin`: `steps: [{icon, label, on}]`, `step` (s między krokami bez `on`, domyślnie 0,5) — skok skali: kamera „wjeżdża” w zaznaczony kwadrat i pojawia się następny poziom; u góry okruszki (drzewo › liść › komórka › chloroplast). Ikony: `tree`, `leaf`, `cell`, `chloroplast`.
- `calendar`: `date`, `text` — duża data.

Lis ma się pojawić co najmniej 3 razy, przerywnik co najmniej raz. Quiz ma 3–4 odpowiedzi, `c` liczone od 0 i zawsze pole `e` z wyjaśnieniem.

### Biblioteka rekwizytów (`kind`)

Każdy rekwizyt jest rysowany proceduralnie z brył wypukłych (prostopadłościany, graniastosłupy, low-poly bryły obrotowe), w jednym kierunku światła (z lewej-góry) i z cieniem rzucanym w prawo.

| kind | wygląd / parametry |
|---|---|
| `house` | domek z dwuspadowym dachem |
| `tower` | wieżowiec z oknami i anteną (`color`) |
| `hall` | gmach z kolumnadą (sejm, sąd, parlament); `dark: true` — ciemny wariant, `cap: true` — maszt z ciemnoczerwonym proporcem i czapką frygijską (jakobini) |
| `palace` | pałac ze złotą kopułą i skrzydłami |
| `fortress` | twierdza z czterema basztami (Bastylia, zamek) |
| `factory` | fabryka z dachem shedowym i kominem |
| `school` | szkoła z wieżyczką |
| `server` | szafa serwerowa z diodami |
| `crowd` / `people` | tłum pionków (`n`) |
| `person` | jedna duża postać (`color`) |
| `pair` | dwie małe postacie: duchowny i szlachcic („I i II stan”) |
| `document` | stojący dokument z pieczęcią (ustawa, deklaracja) |
| `crown` | korona na poduszce (władza, monarchia); korona to część `top` (może spaść) |
| `scales` | waga (prawo, równość) |
| `clock` | wieża zegarowa |
| `globe` | globus (świat, wpływ) |
| `book` | stos książek, `bulb: true` dodaje żarówkę (idee, oświecenie) |
| `trees` / `tree-cluster` | kępa drzew (`n`) |
| `tree` | jedno duże drzewo |
| `flag` | maszt z flagą w pasy (`colors`) |
| `cell` | szklana kopuła z zielonymi stosami (komórka, chloroplast) |
| `sun` | słońce w powietrzu (`z`) z promieniami |
| `plant` | roślina w doniczce |
| `water` | staw z falami i trzciną |
| `vault` | skarbiec z frontonem i monetami |
| `field` | pole z zaoranymi bruzdami i stodołą (rolnictwo); części `ok` (złote kłosy) i ukryta `dry` (spękana ziemia, rzadkie brązowe kikuty) — nieurodzaj przez `state` |
| `cloud` | chmura w powietrzu (`z`) (powietrze, gaz) |
| `crate` | paleta z kostkami (produkt, cukier, towar) |
| `bubbles` | bąbelki unoszące się z kopczyka (gaz, tlen) |
| `billboard` | billboard z tekstem w perspektywie (`text`, `size`) (liczby, hasła) |
| `bar` | słupek o wysokości `h` (wykres w mieście) |
| `node` | okrągła platforma (węzeł cyklu, etap) |
| `gear` | koła zębate na cokole (mechanizm, wiązanie, przetwarzanie) |
| `recycle` | trzy strzałki w kole (obieg, odnowa, regeneracja) |

Nieznany `kind` rysuje się jako `house`, a w konsoli pojawia się ostrzeżenie.

### Nasze typy wizualizacji → świat

| viz w apce | w rolce |
|---|---|
| timeline | droga-zygzak ze stacjami z `date` + `dateName`; etykiety zdarzeń z datą słownie; na koniec `recap` (pas, zapalanie stacji, wszystkie chipy z datami) |
| flow / cause | stacje przyczyn → drogi → stacja skutku, `packet` po każdej drodze (rewolucja: 4 przyczyny → wybuch) |
| compare | dwie stacje obok siebie (`cam.to: [a,b]`) i dwie `card` z `dx` w przeciwne strony |
| bars | rząd stacji `bar` o różnych `h` (panorama) + `label` |
| cycle | stacje w trójkącie lub kole połączone drogami w pętlę, `packet` z `via`; każdy etap ma inny rekwizyt (cykl Calvina: `gear` → `factory` → `recycle`) |
| tree | stacja-piasta i stacje-liście promieniście (hub-and-spoke) |
| numbers | `card` z liczbą, `billboard`, przerywnik `dots` albo `tiles` |

## Daty na osi czasu

- Jeden styl: chip z datą to pigułka z ciemną częścią z datą i białą z nazwą. Tak wyglądają i etykiety zdarzeń, i chipy podsumowania. Karta z datą ma ją w ciemnej pigułce zamiast tytułu.
- W scenie data jest słownie, tak jak mówi lektor i quiz: „21 stycznia 1793 · stracenie Ludwika XVI”, „14 lipca 1789 · zdobycie Bastylii”.
- Podsumowanie (`recap`) pokazuje datę z tabeli w notatkach (rzymski miesiąc) i krótką nazwę ze stacji: `date: "21 I 1793"`, `dateName: "król"`. Rzymska liczba ma własny `<span class="r">` z odstępem 0,12 em i wąską twardą spacją (U+202F), więc „21 I 1793” nie wygląda jak „21 | 1793”.
- Stałych chipów przy stacjach już nie ma: pokazywały się szare, półprzezroczyste i dublowały etykiety. Daty zbiera dopiero `recap`.

## Efekty dźwiękowe

Bez plików i bez sieci: WebAudio syntetyzuje krótkie dźwięki. Silnik wylicza je z akcji przy kompilacji: `pop` na etykietę, kartę, linijkę i klocek; `chime` na rozdział; `scratch` na przekreślenie; `whoosh` na przelot kamery (dłuższy niż ~150 px albo zmiana zoomu o ~50%) i przerywnik; `thud` na `punch` i `impact`; `pop2` na lisa; `ding` i `buzz` na odpowiedź w quizie. Są planowane 0,15 s naprzód na zegarze rolki (przy nagraniu: zegar nagrania z jego tempem). Gdy lektor mówi, efekt jest cichszy (~−18 dB), w przerwach ~−10 dB. Przycisk wyciszenia wycisza też efekty. `AudioContext` powstaje przy stuknięciu „Odtwórz rolkę” (wymóg iOS). W stopklatkach (`?t=`) efektów nie ma. Stracenie króla jest bez efektów (`sfx: "none"`).

## Wnioski z prototypu

- Rekwizyty, kamera, etykiety i lis są ogólne: obie rolki robi ten sam silnik, różni je tylko JSON.
- Napisy idą po 1–3 słowa (łamane na interpunkcji i pauzach lektora; krótkie słowa typu „w”, „i”, „do” nie zostają na końcu kawałka). Bieżące słowo jest limonkowe i podskakuje przez 0,2 s, a cały kawałek wskakuje z lekkim „popem”.
- Lektor pl-PL czyta około 2 słowa na sekundę, ale daty czytane słownie są bardzo długie. „Tysiąc siedemset osiemdziesiątego dziewiątego” to około 2,5 s. Lepiej mówić „W styczniu 1793” niż pełną datę, a pełna data niech będzie na chipie i karcie.

## Znane braki

- Fotosynteza nie ma jeszcze nagrania. Skrypt jest gotowy (pole `tts`, 1310 znaków, 165 słów), wycena ElevenLabs: 1310 kredytów (około 0,13 USD) za jedną generację głosem „Dawid” (`eleven_v4`, `gBomWqQijp5IiOPF7hkJ`). Przy ~1,9 słowa/s nagranie wyjdzie około 85–90 s, czyli około 72 s przy `rate: 1.2`. Po nagraniu: `audio/fotosynteza.mp3` + `audio/fotosynteza.words.json` (transkrypcja `eleven_scribe_v1` z tego samego Flow) i pole `"audio": {"src": …, "words": …, "rate": 1.2}` w scenariuszu — silnik robi resztę tak jak w rewolucji.
- Lektora sprawdziłem na atrapie syntezy (`check-speech.mjs`) i czasem `say -v Zosia`. Na prawdziwym iPhonie (WKWebView, Zosia) nie było testu. W Chrome głosy sieciowe nie wysyłają `boundary`, więc wtedy podświetlanie słów idzie według szacunku.
- Głębię rysuje malarz według środka (x+y). Przy dużych, sąsiadujących bryłach mogą się zdarzyć drobne błędy przesłaniania. Tunel i paczki leżą zawsze nad budynkami.
- Miasto-wypełniacz to kilkaset brył w jednym SVG: rewolucja ma około 12 tys. kształtów, fotosynteza około 8 tys. (komórki z chloroplastami). Sam `render(t)` liczy się w ~1 ms (p95 ~3 ms); resztę zjada malowanie SVG. Kamera zmienia transformację całej grupy. Na komputerze w Chrome klatka mieści się w 16 ms. Na starszym telefonie może trzeba będzie zrasteryzować tło do `<canvas>` albo obrazka.
- Mapa w przerywniku `arc` to umowne plamy lądu, nie prawdziwe kontury.
- Brak eksportu do wideo i brak muzyki w tle. Efekty dźwiękowe są, ale nikt ich nie odsłuchał: harmonogram sprawdza `check-audio.mjs`, brzmienie i głośność względem lektora trzeba ocenić uchem.
- Pierwszy plan (paralaksa) ma rozmycie CSS `blur`. Na komputerze jest płynnie, na iPhonie trzeba sprawdzić.
- Nagranie rewolucji ma 104 s, czyli więcej niż zakładane 60–80 s, bo skrypt był za długi dla tego głosu. Gra z `rate: 1.2`, czyli około 88 s. Przyspieszenia z zachowaniem wysokości głosu nie odsłuchałem. Gdyby brzmiało źle, `?rate=1` przywraca naturalne tempo. Lepiej skrócić skrypt do około 130 słów i nagrać jeszcze raz (około 1100–1200 kredytów).
- Transkrypcja z Flow zwróciła dokładnie tekst z promptu (ze znacznikami), czyli wyrównanie syntezy, a nie niezależne rozpoznanie mowy. Czasy słów są dobre poza liczbami, które poprawia silnik. Jeśli lektor przeczyta coś inaczej niż w tekście, transkrypcja tego nie pokaże.
- Wejście do apki wymaga jeszcze: generowania JSON w backendzie (prompt i walidacja schematu), przepuszczenia tekstów przez `clean()` z `cloud.js` i wklejenia silnika do `build.js`.
