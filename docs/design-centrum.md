# Centrum przedmiotu i media (rolki, podcast, rozmowa z lisem) — specyfikacja designu

Źródło: workflow designu z 2026-10-22. Makiety: design/centrum/*.dc.html (tablica: https://claude.ai/artifact/NZnBjUcEACibdkiUuJCskx).
Zmiana po decyzji właściciela (2026-10-22): podcast ma 20–30 min (makiety: 26:40, 8 rozdziałów, 8 pauz).

# Centrum przedmiotu: final direction and artboard spec (lead product design)

Sources: the three concepts, `docs/BIBLIA.md` §1–3, `design/DESIGN.md`, `design/tokens.css`, and the owner's reel prototype in `test/proto/rolka/`. The prototype has a light isometric world, a karaoke caption box, numbered chapter chips and a question card at the end.

Writing convention: everything inside „…” is final Polish UI copy. `[placeholder]` marks a number that real data will replace. Draw the placeholder value as normal text.

---

## 1. Verdict on the three concepts (scores 1–5, where 5 is best; for build effort, 5 means cheapest)

| | Clarity | Learning value | Not Duolingo | Scales to many materials | Build effort (vanilla JS) |
|---|---|---|---|---|---|
| exam-cockpit | 4 | 5 | 5 | 3 | 2 |
| media-shelf | 3 | 2 | 4 | 2 | 2 |
| knowledge-map | 4 | 4 | 5 | 5 | 4 |

**exam-cockpit**
- Strengths:
  - One „CO TERAZ” card that always gives its reason.
  - Weakest points first.
  - The Szop stands for forgetting (overdue points), not a boss at the end of a path.
  - „Popraw ten punkt” runs only on existing items, with no AI call.
  - „Jeszcze nie wiem” is shown instead of a fake 0%.
- Weaknesses:
  - Built around the exam date, so without a date it loses its purpose.
  - Four cards come before any content.
  - The 24-row point list grows with every material.
  - Six state words are too many.
  - It needs new evidence fields.

**media-shelf**
- Strengths:
  - Reels and podcast finally look like real media: 9:16 thumbnails and a play button.
  - The end of a series leads to „Przepytaj mnie z tego”.
  - Mini-player.
  - Questions can be moved to the end for listening with the screen locked.
  - One merged „Dodatki” invitation instead of one per shelf.
- Weaknesses:
  - Encourages passive scrolling.
  - The season/episode metaphor feels childish to students.
  - Shelves × seasons do not scale.
  - The per-season boss lock is a Duolingo habit.
  - Many „Zrób…” cards make it look like a shop window.

**knowledge-map**
- Strengths:
  - Materials become numbered chapters 01/02/03, which scales best.
  - Four states, coded by shape as well as colour.
  - Mastery is a pure function of the existing SRS keys: no new storage keys, no migration.
  - The limit counter appears only in the confirm sheet.
  - Invitations are hidden when nothing can be created.
- Weaknesses:
  - The accordion makes the hub long and fiddly on a phone.
  - Reels and podcast are reduced to small tiles.
  - The 13-chip grid on the hub is dense.

## 2. Final direction: „Zeszyt z jedną kartą na teraz”

The hub is a calm notebook:
- A header shows mastery: „Umiesz 8 z 27 punktów”.
- An exam card follows (only when a date is set).
- Then exactly one action card, „NA TERAZ”, with its reason.
- Then the Szop strip, only when something is being forgotten.
- Then numbered material cards, each a single compact row with no accordion.
- Last, a tool grid for the whole subject.

Each material opens its own screen (Centrum-Material). That screen holds:
- the key points,
- the lessons,
- a real reel strip and podcast card,
- conversation and practice tools,
- the source file.

Lessons stay the core. Reels, podcast and conversation are ways to understand and check the same key points. They never replace the lessons.

**Taken from each concept**
- From knowledge-map:
  - chapters 01/02/03;
  - four mastery states computed from SRS;
  - „Umiesz X z Y”;
  - counter only in the confirm sheet;
  - invitations hidden when no creations are left;
  - no lesson locks.
- From exam-cockpit:
  - „NA TERAZ” with a reason line and „Inna propozycja”;
  - exam card with a readiness ring and a 7-day strip;
  - Szop = forgetting, with „ODZYSKAJ”;
  - „Jeszcze nie wiem” instead of 0%;
  - the same top action feeds Dziś.
- From media-shelf:
  - 9:16 reel strip and podcast card with play, inside the material screen;
  - series end leads to „Przepytaj mnie”;
  - mini-player;
  - questions-at-end toggle;
  - one merged „Dodatki” invitation.

**Dropped**
- the path, chests and lesson locks;
- seasons and episodes;
- the per-season boss;
- XP, gem and heart pills on the hub;
- horizontal shelves on the hub;
- the 6-word state scale;
- a long point list on the hub.

**Global decisions (apply to every artboard)**
- **D1. Mastery states** (exactly four):
  - **Umiem**: at least 70% of the point's flashcards and questions are in box ≥2 and none is more than 2 days overdue.
  - **W trakcie**: practised but not yet Umiem.
  - **Do odświeżenia**: practised, and at least ⅓ of its items are more than 2 days overdue. This is the Szop's work.
  - **Nowe**: none of its items practised yet.
  - XP and streak never change a state.
- **D2. Reels and podcast questions:** the end-of-reel question and the podcast pauses are existing quiz items, referenced by index. Answering them writes to SRS like any quiz answer. Watching alone moves nothing.
- **D3. Gotowość:** 70% × share of in-scope points at Umiem + 30% × best mock exam. With no mock exam yet, it equals the Umiem share. Below 10 answers in the subject it shows „?”. The TestPlan screen uses the same number.
- **D4. Generating reels or a podcast:**
  - per material;
  - one explicit tap plus a confirm sheet;
  - never automatic, never retried automatically;
  - one generation at a time;
  - the counter appears only in the confirm sheet;
  - with 0 creations left, every „PRZYGOTUJ” invitation disappears and only ready formats show.
  - No word about payment, prices, Pro or buying.
- **D5. „NA TERAZ” priority** (first match wins; „Inna propozycja” cycles through the next matches):
  1. Exam today: „Rozgrzewka · 5 min”. Exam tomorrow: „Noc przed sprawdzianem · 20 min” (the existing cram).
  2. Interrupted lesson (`lessonSave`).
  3. At least 2 points in Do odświeżenia: „Odzyskaj N punktów od Szopa”. The Szop strip is then hidden.
  4. Unfinished item from today's plan.
  5. Next new lesson, in material order.
  6. From D−3 with no mock exam yet: „Egzamin próbny”.
  7. All points at Umiem: „Egzamin ustny z lisem”. If that was done today: „Na dziś wystarczy” with fox sleep.

  A reel or podcast is never the main action. They appear only as „Inna propozycja” alternatives.
- **D6. Navigation:**
  - Bottom nav becomes „Dziś” · „Przedmioty” · [+] · „Powtórka” · „Profil”. The Fiszki tab goes: flashcards live in each hub, and daily review lives in Powtórka.
  - Hub and material screens are router views with the nav visible and „Przedmioty” active. Back works through `navHist`.
  - Players, lessons, conversation, exam, series list and mode picker are full-screen with no nav.
- **D7. Copy:**
  - Gender-neutral: no past-tense gendered verbs.
  - Polish decimal comma: „1,25×”, „3,5”.
  - Quotation marks „…”.
  - No emoji.
  - Any text below 16px uses txt-2 #D6D2F0. Muted #9B95C9 only at 16px or larger.
- **D8. Primary button:** 58px high, radius **18** (as `.btn` in `tokens.css` and the shipped `styles.css`; this is deliberately not a pill, so the new screens match the app).

## 3. Shared example data (keep consistent across artboards)

- **Today:** „czwartek, 22 października”. Exam: „środa, 28 października” (in 6 days).
- **Subject:** „Międzynarodowe stosunki gospodarcze i polityczne”, short „MSGiP”, monogram „MS”, accent pink, level studia.
  - Grade scale: 2 / 3 / 3,5 / 4 / 4,5 / 5; pass from 50%.
- **Material 01:** „Wykład 1–2: pojęcia i podmioty MSGiP” · PDF · 24 strony · dodany 14 października.
  - 13 points, in this order (U = Umiem, W = W trakcie, R = Do odświeżenia, N = Nowe):
    1. „MSG a MSP” W
    2. „MSGiP a nauki społeczne” U
    3. „Globalizacja” U
    4. „Handel i inwestycje” U
    5. „Zarządzanie kryzysami” R
    6. „Państwo narodowe” U
    7. „ONZ” U
    8. „WTO” W
    9. „MFW” R
    10. „Bank Światowy” U
    11. „Korporacje transnarodowe” N
    12. „Unia Europejska” N
    13. „NGO” N
  - Result: U 6 · W 2 · R 2 · N 3.
  - Lessons:
    - L1 „Czym są MSGiP: MSG a MSP”: done, 3 stars, 5 części
    - L2 „Globalizacja, handel i kryzysy”: done, 2 stars, 6 części
    - L3 „Państwa i organizacje międzynarodowe”: done, 2 stars, 6 części
    - L4 „Korporacje, UE i NGO”: interrupted at part 2 of 4, about 4 min left
  - Reels: series „Kto rządzi światową gospodarką?”, 5 reels, 4:31 total:
    1. CZYM TO JEST „MSG i MSP w minutę” 0:52: watched, question wrong
    2. KTO JEST KIM „ONZ, WTO, MFW i Bank Światowy” 0:58: watched, question right
    3. MIT CZY FAKT „Globalizacja to tylko handel?” 0:47: next
    4. PORÓWNANIE „Korporacja kontra państwo” 0:55
    5. NA SPRAWDZIAN „5 rzeczy na sprawdzian” 0:59
  - Podcast: „Kto naprawdę rządzi gospodarką świata?”, 8:20, 4 chapters (the lesson titles) at 0:00 / 1:55 / 4:05 / 6:30.
    - Question pauses at 1:40 / 3:40 / 5:50.
    - Listened up to 3:10, so 5:10 left.
  - Content counts: 46 fiszek, 36 pytań, 14 zadań.
- **Material 02:** „Wykład 3: teorie integracji” · Zdjęcia · 9 stron.
  - 8 points [placeholder names]: „Funkcjonalizm” U, „Neofunkcjonalizm” W, „Efekt spillover” N, „Międzyrządowość” N, „Etapy integracji” U, „Unia celna” W, „Wspólny rynek” N, „Federalizm” N.
  - Lessons 1 of 4 done. Reels being created.
- **Material 03:** „Prezentacja: polityka handlowa UE” · PPTX · 31 slajdów. 6 points, all N. Lessons 0 of 3.
- **Subject totals:**
  - 27 points: U 8 · W 4 · R 2 · N 13
  - 11 lessons, 4 done
  - 112 flashcards, Powtórka 12 due today
  - best mock exam 64% (3,5)
  - readiness 40%
  - streak 5 days · 1 240 XP · 85 gems
  - creations for reels and podcast: „Zostało: 2 z 3” [placeholder]

## 4. Shared components and tokens

**Mascot sources** (use `<img src>` verbatim; aspect 160:170, so height = width × 1.0625):

| Name | Source |
|---|---|
| fox-idle | `/_blob/4d3d811e2173d4e42b784d877da27b15` |
| fox-happy | `/_blob/17e742b7c9d55bad70843ae68348a5fb` |
| fox-think | `/_blob/7a7d5258891d9777990593221c505a2b` |
| fox-sleep | `/_blob/bd6c3e0738ebeb7c621c248955696844` |
| szop-idle | `/_blob/cde1a13de89da8a324b0a6001dd22d4a` |
| szop-laugh | `/_blob/e0e4145f1910c230f71edc3cbd6e866f` |
| szop-dizzy | `/_blob/c1ad258ccb6769069e6501b14e963fbb` |
| szop-win | `/_blob/c3c630701182b890153e7ddc9f7d4cdf` |

**App frame**
- Background #0E0C1C.
- Screen padding x 16. Section gap 24. Card gap 12.
- A top safe area of 44px (empty background, no fake status bar).
- Fonts: Bricolage Grotesque 800 for display, Plus Jakarta Sans 500–800 for body.

**Components**
- **TopBar** (h 56):
  - left: back chevron icon 20, stroke 3, #F4F2FF, 44×44 hit area;
  - centre: title Bricolage 800 20 #F4F2FF;
  - right: „…” icon, 44×44.
  - Background = screen background. No pills.
- **SectionLabel:**
  - 11px / 800, uppercase, letter-spacing 1.4px, #D6D2F0;
  - optional right link 13/800 in the accent colour.
- **Card:**
  - background #1B1836, border 2px #2C2850, radius 22, shadow 0 4px 0 #14122A, padding 16.
- **PrimaryButton:**
  - height 58, full width, radius 18;
  - fill = accent (pink #FF2E93), text #200410, 15/800 uppercase, letter-spacing 1.2px;
  - shadow 0 5px 0 #B01460.
  - Disabled: background #201C3E, text #5C568F, no shadow.
- **GhostButton:**
  - background #1B1836, border 2px #2C2850, text #D6D2F0, shadow 0 5px 0 #14122A.
  - Small variant: height 44, radius 13, 13/800 uppercase, letter-spacing 1px.
- **Chip:**
  - 10.5/800 uppercase, letter-spacing 1.2, radius 999, padding 6 12.
  - Tinted variants: text colour on tint background with tint-line border.
- **MasteryMarker** (22px, radius 7):

  | State | Look |
  |---|---|
  | Umiem | accent fill + check #200410 |
  | W trakcie | 2px accent border, left half filled with accent |
  | Do odświeżenia | 2px #FFA023 border, background #2A1C10, refresh glyph #FFA023 |
  | Nowe | 2px #6E67A8 border, empty |

- **MasterySquare:** 12px, radius 3, gap 4. Umiem #FF2E93, W trakcie #B01460, Do odświeżenia #FFA023, Nowe #241F45 with 1.5px #2C2850 border.
- **MasteryBar:**
  - height 12, radius 999;
  - segments in order Umiem → W trakcie → Do odświeżenia → Nowe, using the square colours;
  - 2px gaps between segments;
  - `.a-grow` on entry.
- **Legend:** 10px squares + 13/700 #D6D2F0.
- **FormatPill:**
  - height 32, radius 999, background #15122B, border 1.5px #2C2850, padding 0 10;
  - icon 14 (stroke 2.6) + 12/800 #D6D2F0.
  - Icon colours: lessons = book #FF2E93, reels = reel #FFA023, podcast = headphones #22D3EE.
- **ToolTile:**
  - 114 × 112 (3 per row, gap 8, row gap 10), radius 18, Card colours, padding 10;
  - icon tile 28, radius 9, tinted;
  - title 14/800 #F4F2FF (up to 2 lines);
  - sub 12/700 #D6D2F0.
- **ChapterCard** (Card, h 148, whole card tappable):
  - Row 1: number Bricolage 800 26 accent (column 40px) · title 17/800 #F4F2FF (2 lines, line-height 22) · chevron-right 20 #D6D2F0.
  - Row 2 (10px below): MasterySquares + right-aligned 13/800 #F4F2FF.
  - Row 3 (12px below): FormatPills.
- **Sheet:**
  - scrim rgba(14,12,28,.72);
  - background #1B1836, top radius 28, top border 2px #2C2850;
  - handle 36×5 #2C2850 with 10px top margin;
  - padding 20;
  - `.a-rise`.
- **BottomNav** (h 84 = 50 + 34 safe area):
  - background #15122B, top border 2px #2C2850;
  - items „Dziś” (home), „Przedmioty” (grid), [+], „Powtórka” (refresh), „Profil” (user);
  - labels 11/700;
  - inactive #D6D2F0, active #B4FF3A (icon and label);
  - [+] is a 56px circle #B4FF3A with a plus #14210A (stroke 3.4) and shadow 0 5px 0 #7FC400, raised 12px; aria „Dodaj materiał”.
- **Tints** (background / border):

  | Tint | Background | Border |
  |---|---|---|
  | acid | #1F2A12 | #4E6B24 |
  | pink | #241536 | #46216B |
  | amber | #2A1C10 | #5C3812 |
  | cyan | #0E2430 | #1A4C5E |
  | gold | #2A2110 | #574319 |
  | red | #2A1017 | #5C1F2E |

- **Reel type chips** (text / background / border), 10/800 uppercase:

  | Type | Text | Background | Border |
  |---|---|---|---|
  | „CZYM TO JEST” | #22D3EE | #0E2430 | #1A4C5E |
  | „KTO JEST KIM” | #FF2E93 | #241536 | #46216B |
  | „MIT CZY FAKT” | #FFA023 | #2A1C10 | #5C3812 |
  | „PORÓWNANIE” | #FFC043 | #2A2110 | #574319 |
  | „PUŁAPKI NA EGZAMINIE” | #FF4767 | #2A1017 | #5C1F2E |
  | „NA SPRAWDZIAN” | #B4FF3A | #1F2A12 | #4E6B24 |

- **Reel world palette** (from the prototype; used only inside a reel):
  - ground #ECE6D9, ink #17151F, ink-2 #3B3846, paper #FFFFFF;
  - accent #B4FF3A, on-accent #14210A, accent-dark #7FC400;
  - station blue #2F6BFF / #2456CC / #1B3F99 (top / left / right face);
  - station green #1F8A5B / #19704A / #12553A;
  - station amber #E9A23B / #C9852A / #A1681D;
  - station red #E0483F;
  - filler blocks #E4DCCD / #D6CDBB / #C9BFAB;
  - road #DDD5C5 with a dashed centre line #FFFFFF;
  - correct answer: green #1F8A5B, background #E5F5EC, shadow #9CD3B6;
  - **no gradients, no vignette, no text glow** (the prototype's gradient top plate becomes a solid rgba(236,230,217,.92) plate).
- **Icons:** inline SVG, stroke 2.6, round caps. Names: back, chevron-right, chevron-down, dots, book, reel (rounded rectangle with play), headphones, refresh, cards, timer, chat, lightbulb, help-bubble, info, plus, check, play, pause, rewind-15, forward-15, mic, send, keyboard, bookmark, skip-down, speaker, close, file, moon, clipboard, target, stop.

---

## 5. Artboards

### 1. Main.dc.html (Centrum przedmiotu, mid-way): 390×2030

**Purpose:** the subject hub that replaces the path. It shows, in order:
1. how much is mastered;
2. the exam countdown;
3. one next action;
4. what is being forgotten;
5. the materials;
6. the subject-wide tools.

**Why:** A notebook with chapters and one action card is calm for students and clear for 16-year-olds, and there are no nodes or locks to read as Duolingo. Its length grows by only one 148px card per material.

Layout, top to bottom:
1. **Safe area:** 0–44.
2. **TopBar:**
   - Title „MSGiP”.
   - The „…” menu (sheet, not drawn): „Plan do sprawdzianu”, „Zasady zaliczenia i skala ocen”, „Zmień nazwę i kolor”, „Usuń przedmiot”.
3. **Header** (h 116):
   - eyebrow „PRZEDMIOT · STUDIA” (11/800 caps, #FF2E93);
   - H1 „Międzynarodowe stosunki gospodarcze i polityczne” (Bricolage 800 28/32, #F4F2FF, 2 lines);
   - meta „3 materiały · 27 kluczowych punktów · 11 lekcji” (15/600, #D6D2F0).
4. **Mastery** (h 78, no card):
   - Headline: „Umiesz ” + „8” (Bricolage 800 22, #FF2E93) + „ z 27 punktów” (17/800, #F4F2FF).
   - Right link: „Jak to liczę?” (opens HowSheet, §6).
   - MasteryBar with segments 8 / 4 / 2 / 13.
   - Legend: „4 w trakcie · 2 do odświeżenia · 13 nowych”.
5. **Exam card** (Card, h 218):
   - Left column:
     - „SPRAWDZIAN” (SectionLabel style);
     - „za ” (Bricolage 20) + „6” (Bricolage 44) + „ dni” (Bricolage 20), all #F4F2FF;
     - „środa, 28 października” (15/600, #D6D2F0).
   - Right column:
     - ring 64px, stroke 7, track #241F45, arc #FF2E93 at 40% starting from 12 o'clock, round caps;
     - centre „40%” (Bricolage 17);
     - under the ring „GOTOWOŚĆ” (10.5/800 caps, #D6D2F0).
   - Day strip: 7 cells, each 42×60, gap 5, radius 13, background #15122B, border 2px #241F45.
     - Each cell: weekday 10/800 caps #D6D2F0, date Bricolage 16 #F4F2FF, glyph 14 #D6D2F0.
     - The cells:

       | Cell | Glyph |
       |---|---|
       | „CZ 22” | book. Today: border #FF2E93, weekday in pink |
       | „PT 23” | book |
       | „SO 24” | moon |
       | „ND 25” | clipboard |
       | „PN 26” | target |
       | „WT 27” | refresh |
       | „ŚR 28” | fill #FF2E93; weekday and date #200410; glyph replaced by „SPR” (9/800) |

   - Footer: „Dziś: lekcja, rolka i 2 punkty od Szopa · ok. 10 min” (14/700, #D6D2F0), with the right link „Plan ›”.
6. **NA TERAZ** (h 278):
   - Card styling: background #241536, border 2px #46216B, radius 22, shadow 0 4px 0 #14122A, padding 18.
   - fox-think, 80×85, positioned top −16, right 14 (it overlaps the top edge).
   - Contents:
     - „NA TERAZ” (11/800 caps, #FF2E93);
     - title „Dokończ lekcję 4 z Wykładu 1–2” (Bricolage 22/26, max width 240);
     - body „Korporacje, UE i NGO · część 2 z 4. Przerwane wczoraj, zostały ok. 4 minuty.” (15/600, #D6D2F0);
     - PrimaryButton „DOKOŃCZ LEKCJĘ”;
     - centred text button (44px) with a refresh icon: „Inna propozycja” (14/800, #D6D2F0).
7. **Szop strip** (h 140):
   - Card styling: background #2A1C10, border 2px #5C3812, radius 22, padding 14.
   - szop-laugh 64×68 on the left.
   - Contents:
     - title „Szop podkrada 2 punkty” (16/800, #F4F2FF; aria „Szop Zapominalski podkrada 2 punkty”);
     - text „MFW i Zarządzanie kryzysami. Od ostatniej powtórki minęły 4 dni.” (14/600, #D6D2F0);
     - small button (h 40, radius 13, fill #FFA023, text #201202, 13/800 caps, shadow 0 4px 0 #B36A08): „ODZYSKAJ · 3 MIN”.
8. **„MATERIAŁY” section:**
   - SectionLabel „MATERIAŁY”, right link „+ Dodaj”.
   - **01**: „01” · „Wykład 1–2: pojęcia i podmioty MSGiP”
     - squares W U U U R U U W R U N N N;
     - right text „Umiesz 6 z 13”;
     - pills „Lekcje 3/4” · „Rolki 2/5” · „Podcast 3:10/8:20”.
   - **02**: „02” · „Wykład 3: teorie integracji”
     - squares U W N N U W N N;
     - right text „Umiesz 2 z 8”;
     - pills „Lekcje 1/4” plus a generating pill: background #241536, dashed 1.5px #46216B, an 8px #FF2E93 dot with `.a-blink`, text „Rolki · przygotowuję”.
   - **03**: „03” · „Prezentacja: polityka handlowa UE”
     - 6 × N squares;
     - right text „6 nowych”;
     - pill „Lekcje 0/3”.
9. **Add-material row** (h 80):
   - radius 22, dashed 2px #2C2850, no fill;
   - icon tile 44 on #241536 with a #FF2E93 plus;
   - title „Dodaj materiał do MSGiP” (16/800);
   - sub „Następny wykład, notatki albo prezentacja. Zostanie rozdziałem 04.” (13/600, #D6D2F0).
10. **„CAŁY PRZEDMIOT”** — ToolTiles in a 3×2 grid:

    | Tile | Sub | Icon |
    |---|---|---|
    | „Powtórka” | „12 na dziś” | refresh, cyan tint |
    | „Fiszki” | „112 z 3 materiałów” | cards, gold tint |
    | „Egzamin próbny” | „ostatnio 64% (3,5)” | timer, pink tint |
    | „Rozmowa z lisem” | „3 tryby” | chat, acid tint |
    | „Pojedynek z Szopem” | „4 z 11 lekcji” | szop-idle 28×30 on #15122B |
    | „Zasady i oceny” | „zaliczenie od 50%” | info, #15122B |

11. **BottomNav** with „Przedmioty” active.

**States shown:** interrupted lesson, 2 overdue points, reels being created for 02, untouched 03.

**Mascots:** fox-think, szop-laugh, szop-idle.

### 2. Centrum-Material.dc.html (material 01 detail): 390×2010

**Purpose:** everything for one material:
- its key points with mastery;
- the lessons;
- reels, podcast and conversation for this material;
- practice tools;
- the source file.

**Why:** Keeping these in a separate screen holds the hub short no matter how many materials there are. It also gives reels and the podcast real visual weight next to the lessons.

Layout:
1. **TopBar:**
   - Title „Wykład 1–2”; back to MSGiP.
   - „…” menu: „Zmień nazwę”, „Plik źródłowy”, „Usuń materiał”.
2. **Header** (h 110):
   - eyebrow „MSGiP · ROZDZIAŁ 01” (#FF2E93);
   - H1 „Wykład 1–2: pojęcia i podmioty MSGiP” (Bricolage 26/30, 2 lines);
   - meta „PDF · 24 strony · dodany 14 października”.
3. **Mastery** (h 78):
   - „Umiesz 6 z 13 punktów” (6 in pink, Bricolage 22);
   - link „Jak to liczę?”;
   - bar with segments 6 / 2 / 2 / 3;
   - legend „2 w trakcie · 2 do odświeżenia · 3 nowe”.
4. **Key points:**
   - SectionLabel „KLUCZOWE PUNKTY” with a segmented control on the right: h 36, radius 13, background #15122B, border 2px #2C2850.
     - „Wszystkie” is selected (background #2C2850, text #F4F2FF).
     - „Słabe · 4” is unselected (#D6D2F0).
   - Point chips in a 2-column grid:
     - min height 48, radius 13, background #15122B, border 2px #241F45, padding 8 10;
     - MasteryMarker + label 14/700 #F4F2FF, up to 2 lines;
     - row gap 8.
   - Chips (left | right):
     - W „MSG a MSP” | U „MSGiP a nauki społeczne”
     - U „Globalizacja” | U „Handel i inwestycje”
     - R „Zarządzanie kryzysami” | U „Państwo narodowe”
     - U „ONZ” | W „WTO”
     - R „MFW” | U „Bank Światowy”
     - N „Korporacje transnarodowe” | N „Unia Europejska”
     - N „NGO”
   - Tapping a chip opens PointSheet (§6).
5. **„LEKCJE Z LISEM”** (right text „3 z 4”) — Card holding 4 rows of 64, separated by 2px #241F45 lines:
   - **Row layout:**
     - number tile 36, radius 11: done = #1F2A12 with #4E6B24 border and #B4FF3A check; in progress = #FF2E93 fill with the digit in #200410;
     - title 16/800;
     - sub 13/700 #D6D2F0;
     - right side: 3 stars, 14px (#FFC043 filled, #2C2850 empty).
   - **The 4 lessons:**
     1. „Czym są MSGiP: MSG a MSP” · „zrobiona · 5 części” · ★★★
     2. „Globalizacja, handel i kryzysy” · „zrobiona · 6 części” · ★★☆
     3. „Państwa i organizacje międzynarodowe” · „zrobiona · 6 części” · ★★☆
     4. „Korporacje, UE i NGO” · „część 2 z 4 · ok. 4 min” · small pink button (h 40, radius 13) „DOKOŃCZ”
   - No locks anywhere.
6. **„ROLKI”** (right link „Cała seria ›”):
   - series title „Kto rządzi światową gospodarką?” (17/800);
   - meta „5 rolek · 4:31 · obejrzane 2 z 5” (13/700, #D6D2F0).
   - A row of 5 thumbnails, each 64×114, radius 12, border 2px #2C2850, gap 9:
     - ground #ECE6D9 with one small isometric block in the station colour (blue, green, amber, red, blue+green);
     - number badge: 20px circle #17151F with the digit Bricolage 11 #B4FF3A, top-left at 6,6;
     - watched (1 and 2): a 4px #17151F bar along the bottom and a 20px #B4FF3A check badge top-right;
     - next (3): 2px #FF2E93 outline.
7. **Podcast card** (Card, h 112):
   - left tile 72×72, radius 18, #241536, with fox-idle 40×43 and szop-idle 40×43 side by side;
   - eyebrow „PODCAST” (10.5/800 caps, #22D3EE);
   - title „Kto naprawdę rządzi gospodarką świata?” (15/800, 2 lines);
   - meta „8:20 · zostało 5:10”;
   - 6px bar, #FF2E93 at 38%;
   - right: 48px play circle #FF2E93 with the icon in #200410, shadow 0 4px 0 #B01460.
8. **„SPRAWDŹ SIĘ”** — ToolTiles in a 3×2 grid:

   | Tile | Sub | Icon |
   |---|---|---|
   | „Wytłumacz mi” | „ostatnio 2 luki” | lightbulb, acid tint |
   | „Przepytaj mnie” | „ostatnio 4 z 6” | help-bubble, cyan tint |
   | „Egzamin ustny” | „jeszcze nie było” | mic, gold tint |
   | „Fiszki” | „46 · 6 na dziś” | cards, pink tint |
   | „Quiz” | „36 pytań” | check, #15122B with #A855F7 icon |
   | „Zadania” | „14 zadań” | clipboard, amber tint |

9. **„ŹRÓDŁO”** — Card row (h 72):
   - file tile 40 on #0E2430 with „PDF” (11/800, #22D3EE);
   - „wyklad-1-2-msgip.pdf” (15/800);
   - „24 strony · każde pytanie wskazuje swoją stronę” (13/600, #D6D2F0);
   - chevron (opens SourceView).
10. **BottomNav** with „Przedmioty” active.

**States shown:** mixed point states, an interrupted lesson, reels partly watched, podcast partly heard.

**Mascots:** fox-idle and szop-idle in the podcast tile.

### 3. Centrum-Nowy.dc.html (hub right after creating a subject): 390×1820

**Purpose:** the first visit, when only lessons, flashcards, questions and tasks exist. It shows:
- a single clear start;
- the date prompt;
- one invitation for reels and podcast.

**Why:** A brand-new hub must not look like a row of locked doors or a shop window. One action and one merged invitation are enough.

Entry: on „Przedmiot gotowy”, the „ZACZNIJ NAUKĘ” button opens lesson 1 directly, and the link „Zobacz przedmiot” opens this screen.

Layout:
1. **TopBar:** title „MSGiP”.
2. **Header:**
   - eyebrow „NOWY PRZEDMIOT · STUDIA” (#FF2E93);
   - H1 with the full subject name;
   - meta „1 materiał · 13 kluczowych punktów · 4 lekcje”.
3. **Mastery** (h 98):
   - „13 punktów przed Tobą” (17/800);
   - empty bar (track #241F45);
   - text „Pasek zapełni się, gdy zaczniesz odpowiadać. Punkt jest Twój, gdy umiesz go w dwa różne dni.” (14/600, #D6D2F0);
   - link „Jak to liczę?”.
4. **NA TERAZ** (same styling as in Main, h 230):
   - fox-happy 80×85 overlapping the top edge;
   - eyebrow „NA START”;
   - title „Zacznij od lekcji 1”;
   - body „Czym są MSGiP: MSG a MSP · 5 części i kilka pytań · ok. 7 min”;
   - PrimaryButton „ZACZNIJ LEKCJĘ 1”;
   - no „Inna propozycja”.
5. **Date card** (h 148):
   - radius 22, dashed 2px #2C2850, background #15122B;
   - title „Masz sprawdzian z tego przedmiotu?” (16/800);
   - sub „Podaj datę, a rozłożę naukę na dni.” (14/600, #D6D2F0);
   - chips, 44px high, radius 999, background #1B1836, border 2px #2C2850, 14/800 #F4F2FF: „Za tydzień” · „Za 2 tygodnie” · „Wybierz datę”.
6. **„MATERIAŁ”** — ChapterCard 01:
   - 13 × N squares;
   - right text „13 nowych”;
   - pill „Lekcje 0/4”.
7. **Dodatki card** (h 332):
   - radius 22, dashed 2px #2C2850, background #15122B, padding 16;
   - eyebrow „DODATKI DO WYKŁADU 1–2” (#FF2E93);
   - title „Rolki i podcast z tego materiału” (Bricolage 20);
   - sub „Przygotuję je, gdy zechcesz. Najlepiej po pierwszej lekcji — wtedy utrwalają to, co już znasz.” (14/600, #D6D2F0).
   - Two option rows (h 92 each, Card styling):
     - **Reels:** three mini 9:16 tiles (30×53, #ECE6D9, overlapping by 8, each with a tiny coloured block);
       - „Seria rolek” (15/800);
       - „4–6 rolek po minucie, każda o czymś innym. Na końcu każdej jedno pytanie.” (13/600, #D6D2F0);
       - small GhostButton „PRZYGOTUJ” with a #FF2E93 border and text.
     - **Podcast:** fox-idle 36 + szop-idle 36;
       - „Podcast z lisem i szopem”;
       - „6–9 minut rozmowy. Szop się myli, lis poprawia, a Ty odpowiadasz w pauzach.”;
       - „PRZYGOTUJ”.
   - No counter on this card.
8. **Add-material row:**
   - „Dodaj następny materiał” / „Kolejny wykład, notatki albo prezentacja. Zostanie rozdziałem 02.”;
   - under it, on the free plan only: „Darmowe tworzenie lekcji: zostało 1 z 2” (13/600, #D6D2F0; existing copy).
9. **„CAŁY PRZEDMIOT”** — 3×2 grid:

   | Tile | Sub | Note |
   |---|---|---|
   | „Powtórka” | „po pierwszej lekcji” | inactive look: #15122B icon tile, icon #D6D2F0 |
   | „Fiszki” | „46 nowych” | |
   | „Egzamin próbny” | „najlepiej po kilku lekcjach” | |
   | „Rozmowa z lisem” | „3 tryby” | |
   | „Pojedynek z Szopem” | „0 z 4 lekcji” | szop-idle |
   | „Zasady i oceny” | „zaliczenie od 50%” | |

10. **BottomNav.**

**Not shown here:** the exam card (no date yet), the Szop strip, the legend.

### 4. Rolki-Seria.dc.html (one reel series): 390×844, no nav

**Purpose:** the series for one material, with:
- the type of each reel;
- watched states and the result of each reel's question;
- total time and how much of the material it covers.

**Why:** A vertical list with type chips makes it clear that each reel covers a different angle and that, together, they cover the whole material.

Layout:
1. **Safe area.**
2. **TopBar:**
   - back (aria „Wróć do: Wykład 1–2”); title „Rolki”;
   - „…” menu: „Przepytaj mnie z tej serii”, „Zgłoś błąd w rolce”.
3. **Header** (y 108–262):
   - eyebrow „WYKŁAD 1–2 · SERIA ROLEK” (#FF2E93);
   - H1 „Kto rządzi światową gospodarką?” (Bricolage 26/30, 2 lines);
   - meta „5 rolek · 4:31 · obejrzane 2 z 5” (15/600, #D6D2F0);
   - series bar of 5 segments (h 8, gap 4, radius 999): 1–2 #FF2E93; 3 #15122B with a 2px #FF2E93 border; 4–5 #241F45;
   - „Razem obejmują wszystkie 13 punktów z wykładu” (13/700, #D6D2F0).
4. **List** (y 276–728): 5 rows, each h 84, gap 8.
   - **Row styling:** Card, radius 18, padding 8.
   - **Thumbnail:** 45×80, radius 10, as in Material; watched reels get a 3px #17151F bar at the bottom.
   - **Right side:** type chip, title 15/800 on one line, state line 13/700.
   - **The 5 rows:**
     1. „CZYM TO JEST” · „MSG i MSP w minutę” · check icon 16 #B4FF3A + „Obejrzana · 0:52 · pytanie: ” + „do poprawy” in #FF4767.
     2. „KTO JEST KIM” · „ONZ, WTO, MFW i Bank Światowy” · check + „Obejrzana · 0:58 · pytanie: ” + „dobrze” in #B4FF3A.
     3. Highlighted row (background #241536, border 2px #FF2E93): „MIT CZY FAKT” · „Globalizacja to tylko handel?” · play icon in #FF2E93 + „Następna · 0:47” (13/800, #FF2E93).
     4. „PORÓWNANIE” · „Korporacja kontra państwo” · „Nie obejrzana · 0:55”.
     5. „NA SPRAWDZIAN” · „5 rzeczy na sprawdzian” · „Nie obejrzana · 0:59”.
5. **Sticky bottom bar** (y 735–844):
   - background #0E0C1C, top border 2px #241F45, padding 12 16 34;
   - PrimaryButton „OGLĄDAJ DALEJ · ROLKA 3”.

**Mascots:** none (the thumbnails carry the screen).

### 5. Rolki-Odtwarzacz.dc.html (full-screen vertical player): 390×844

**Purpose:** a playing reel, number 2 of 5 („KTO JEST KIM”), at the moment the narrator says „pożycza”.

**Why:** This is the owner's prototype language: a light isometric world, numbered chapters and karaoke captions. It is framed by thin controls, so it feels like TikTok but every action leads back to learning.

Layout (positions are ±10px):
1. **Background:** full-bleed #ECE6D9.
2. **World** (flat SVG, isometric 2:1):
   - Two roads crossing at about (200, 470): bands 30px wide in #DDD5C5 with a dashed centre line (#FFFFFF, 2px, dashes 10/8).
   - Three stations, each an isometric block (top rhombus, left face, right face):
     - MFW: centre (110, 420), width 76, height 70, blue faces;
     - Bank Światowy: centre (250, 520), width 84, height 54, green faces;
     - WTO: centre (150, 610), width 64, height 40, amber faces.
   - Each station sits on a plaza rhombus #E2DACB.
   - 8 filler blocks (width 30–44, height 12–36, filler colours) in the empty areas around (40, 300), (330, 330), (60, 720) and so on. Nothing under the HUD or the caption.
3. **Top plate:** 0–104, solid rgba(236,230,217,.92).
   - Segments at y 50, x 14–376: 5 flex segments, gap 3, h 4, radius 3, track rgba(23,21,31,.16), fill #17151F. Fill levels: 100% / 40% / 0 / 0 / 0.
   - Row at y 62–98:
     - close button, 36×36, background rgba(255,255,255,.82), radius 12, X icon #17151F (aria „Zamknij”);
     - counter chip „2/5”: background #17151F, Bricolage 800 13 #B4FF3A, h 24, radius 999;
     - title „Kto jest kim: ONZ, WTO, MFW i Bank Światowy” (13/800, #17151F, ellipsis);
     - speaker button 36×36 on the right (aria „Wycisz lektora”).
4. **Chapter chip** at (16, 124):
   - pill #FFFFFF, border 2px #17151F, shadow 0 4px 0 rgba(23,21,31,.14);
   - circle 30px #17151F holding „2” (Bricolage 16, #B4FF3A);
   - text „Kto pożycza w kryzysie” (Bricolage 18, #17151F).
5. **Info card** at (150, 186), width 216:
   - #FFFFFF, border 1.5px #17151F, radius 14, padding 11 14 12;
   - „KTO CO ROBI” (13.5/800 caps);
   - „MFW: ratunek w kryzysie” and „Bank Światowy: rozwój” (both Bricolage 17, #17151F).
6. **World labels:** pills 15/700, padding 8 13 9, each with an 18px leader line (1.5px #17151F) to its roof.
   - „MFW”: #B4FF3A fill, 1.5px #14210A border, text #14210A;
   - „Bank Światowy” and „WTO”: #FFFFFF with a #17151F border.
7. **Fox:** fox-idle 104×110 at (8, 556).
8. **Side actions** (x 322, starting at y 400, 480 and 560):
   - each is a 52px circle #17151F with a 24px #FFFFFF icon and a label 12/800 #17151F beneath;
   - „Do powtórki” (bookmark), „Wyjaśnij” (help-bubble), „Następna” (skip-down).
9. **Karaoke caption:**
   - box centred, bottom edge at y 722;
   - background rgba(23,21,31,.94), radius 16, padding 7 16 10, Bricolage 800 31;
   - words: „MFW” (#FFFFFF, already spoken) „pożycza” (#B4FF3A, current) „państwom” (rgba(255,255,255,.46), upcoming).
10. **Pause hint** (first use only):
    - pill centred at y 752, h 34, background rgba(23,21,31,.82);
    - pause icon 14 + „Stuknij, żeby zatrzymać · w górę: następna rolka” (13/700, #FFFFFF).

**Behaviour** (not drawn):
- Tap pauses: an 84px rgba(23,21,31,.82) disk with a white play triangle appears in the centre, over a rgba(23,21,31,.18) overlay. The caption freezes; the side actions stay.
- Swipe up = next reel, swipe down = previous.
- „Wyjaśnij” pauses and opens a sheet with the matching lesson chunk (existing data, no AI) plus „Przeczytaj w lekcji 3, część 2”.
- „Do powtórki” makes the point's items due today and shows the toast „Dodano do powtórki: MFW”.

### 6. Rolki-Pytanie.dc.html (end-of-reel question, answered correctly): 390×844

**Purpose:** the end-of-reel question, which turns watching into evidence for a point, plus the way on to the next reel.

**Why:** A reel moves a point only through an answer. This card makes that visible and shows where the answer was stored.

Layout:
1. **Background:** the reel 2 world frozen, without labels or caption, under a full rgba(236,230,217,.72) overlay.
2. **Top plate:** same as artboard 5, but segments 100 / 100 / 0 / 0 / 0, counter „2/5” and the same title.
3. **Fox:** fox-happy 120×128 at (250, 128), overlapping the card top by 20.
4. **Question card** (x 16–374, y 236–806):
   - #FFFFFF, border 2px #17151F, radius 26, padding 20 18 18, shadow 0 5px 0 rgba(23,21,31,.15).
   - Chip „PYTANIE”: #B4FF3A, 1.5px #14210A border, text #14210A 12/800 caps.
   - Question „Kraj ma kryzys płatniczy. Do kogo idzie po pożyczkę?” (Bricolage 800 23/27, #17151F, 2 lines).
   - Four answers, each h 48, gap 9:
     - background #FBF9F4, border 2px #D9D2C3, radius 16, shadow 0 3px 0 #E4DDCF;
     - letter tile 28 (#FFFFFF, border #CFC7B6) + text 16/700 #17151F.
     - The options:
       - A „Do Banku Światowego” (opacity .55)
       - **B „Do MFW”**: border #1F8A5B, background #E5F5EC, shadow #9CD3B6, tile #1F8A5B with a white „B”, check icon 20 #1F8A5B on the right
       - C „Do WTO” (.55)
       - D „Do ONZ” (.55)
   - „Dobrze!” (Bricolage 18, #1F8A5B).
   - „MFW ratuje w kryzysie płatniczym. Bank Światowy finansuje rozwój: drogi, szkoły.” (15/700, #3B3846).
   - Bookmark icon 14 + „Zapisane do punktu „MFW” · wróci jutro w powtórce” (13/700, #3B3846).
   - Button (reel style): h 58, radius 18, #B4FF3A fill, 2px #14210A border, text #14210A 17/800 caps, shadow 0 5px 0 #7FC400: „NASTĘPNA ROLKA · 3/5”.

### 7. Rolki-Przygotuj.dc.html (confirm sheet and creation in progress): 390×1688, two stacked frames

The two 844px frames are separated by a 2px #2C2850 line at y 844.

**Purpose:** choose which reel types to make, see the cost in time and the remaining creations, then watch the creation in progress without being blocked.

**Why:**
- The count is the number of chosen types, so there is one control, not two.
- The neutral counter appears only here.
- During creation you can go back to learning.

**Frame A (0–844)**
- **Background:** the material screen for 02, simplified: TopBar „Wykład 3”, eyebrow „MSGiP · ROZDZIAŁ 02”, H1 „Wykład 3: teorie integracji”, headline „Umiesz 2 z 8 punktów”, all under the scrim.
- **Sheet** (from y 196):
  - eyebrow „ROLKI · WYKŁAD 3”;
  - title „Przygotuj serię rolek” (Bricolage 26);
  - body „Z materiału „Wykład 3: teorie integracji”. Każda rolka trwa ok. minuty, mówi o jednej rzeczy i kończy się pytaniem. Razem obejmą wszystkie 8 punktów.” (15/600, #D6D2F0);
  - SectionLabel „JAKIE ROLKI”, with „5 wybranych” on the right (13/700).
- **Type chips** in a 2-column grid, each h 44, radius 13, gap 8:
  - Selected: background #241536, border 2px #FF2E93, check 16 #FF2E93, text 14/800 #F4F2FF.
  - Unselected: background #15122B, border 2px #2C2850, plus icon #D6D2F0, text 14/700 #D6D2F0.
  - Selected: „Czym to jest”, „Kto jest kim”, „Mit czy fakt”, „Porównanie”, „Na sprawdzian”. Unselected: „Pułapki na egzaminie”.
- Helper text: „Rolek będzie tyle, ile rodzajów wybierzesz: od 3 do 6.” (13/600, #D6D2F0).
- **Summary box** (background #15122B, border 2px #241F45, radius 18, padding 14), three rows with 18px icons:
  - reel icon #FFA023: „5 rolek · ok. 5 min oglądania”
  - timer icon #22D3EE: „Gotowe za ok. 3 min [placeholder]. W tym czasie ucz się dalej.”
  - info icon #D6D2F0: „To jedno tworzenie rolek lub podcastu. Zostało: 2 z 3 [placeholder].”
- PrimaryButton „PRZYGOTUJ ROLKI”, then a text button „Nie teraz” (15/800, #D6D2F0, 44px).

**Frame B (844–1688)**
- Same background; the sheet starts at y 1144.
- Title „Przygotowuję rolki” (Bricolage 26) + 8px #FF2E93 `.a-blink` dot.
- fox-think 72×77 on the right.
- Bar 10px, #FF2E93 at 45%, with „zwykle ok. 3 min” on the right (13/700).
- Steps (rows of 36):
  - #B4FF3A check circle: „Piszę scenariusze”
  - #FF2E93 blinking dot: „Nagrywam lektora · 2 z 5” (15/800)
  - 2px #6E67A8 ring: „Składam rolki” (#D6D2F0)
- Five skeleton tiles, 54×96, radius 10, #241F45, with `.a-blink` and `.d1`–`.d5`. Tiles 1–2 are #2C2850 with a 16px #B4FF3A check. Reels cannot be played before the whole series is ready.
- „Możesz zamknąć ten ekran. Dam znać, gdy rolki będą gotowe — znajdziesz je w „Wykład 3”.” (15/600, #D6D2F0).
- GhostButton (58px) „UCZ SIĘ DALEJ”.

### 8. Podcast-Odtwarzacz.dc.html (podcast player): 390×844, no nav

**Purpose:** listening to „Lis i Szop”, with chapters (= lessons), a scrubber showing the question pauses, speed, and a live transcript.

**Why:** The two-speaker stage makes the Szop's typical mistake the hook. The transcript and chapters keep it tied to the material.

Layout:
1. **Safe area.**
2. **Top bar** (44–92):
   - chevron-down (aria „Zwiń”);
   - centre: „PODCAST Z LISEM” (11/800 caps, #D6D2F0) above „Wykład 1–2” (15/800);
   - „…” menu: „Pytania: w trakcie / na końcu”, „Zgłoś błąd w odcinku”.
3. **Stage** (y 100–228):
   - background #241536, border 2px #46216B, radius 28, shadow 0 4px 0 #14122A;
   - fox-idle 96×102 on the left at opacity .6, with chip „LIS” (background #1B1836, text #B4FF3A) under it;
   - szop-laugh 96×102 on the right at full opacity, with chip „SZOP MÓWI” (fill #22D3EE, text #04232B) and three static bars beside it (4×12, #22D3EE).
4. **Title:** „Kto naprawdę rządzi gospodarką świata?” (Bricolage 22/25, 2 lines, y 240–290).
5. **Meta:** „8:20 · 4 rozdziały · 3 pauzy na pytanie” (13/700, #D6D2F0).
6. **Transcript card** (Card, y 324–436):
   - top row: „NA ŻYWO” (10.5/800, #FF2E93, with a 6px blinking dot) and the link „Cały tekst” on the right.
   - Previous line: „LIS” (11/800, #B4FF3A) + „Kryzys bilansu płatniczego to sytuacja, gdy kraj nie ma czym zapłacić za import ani za długi.” (14/600, #D6D2F0).
   - Current line: „SZOP” (11/800, #22D3EE) + „Aha, to wtedy dzwoni do Banku Światowego po szybką pożyczkę!” (15/700, #F4F2FF), with „Banku Światowego” in #FF2E93.
7. **Scrubber** (y 448–490):
   - track 6px #241F45 with 2px gaps at 1:55, 4:05 and 6:30;
   - fill #FF2E93 up to 3:10;
   - knob: 18px #FF2E93 with a 3px #0E0C1C ring;
   - pause markers above the track: 8px diamonds #FFA023 at 1:40, 3:40 and 5:50;
   - times „3:10” on the left and „-5:10” on the right (13/700).
8. **Controls** (y 500–568):
   - centre: 68px #FF2E93 circle with a pause icon in #200410, shadow 0 5px 0 #B01460;
   - left: 52px ghost circle „−15 s” (rewind-15);
   - right: 52px ghost circle „+15 s” (forward-15).
9. **Speed and pauses row** (y 580–624):
   - segmented control, w 200, h 44, radius 13, background #15122B, border 2px #2C2850, with „1,0×” „1,25×” „1,5×”; „1,25×” is selected (#FF2E93 fill, text #200410);
   - on the right: „Pauzy na pytania” (13/700) + a 44×26 switch, on (track #FF2E93, knob #FFFFFF).
10. **„ROZDZIAŁY” card** (Card, y 636–806), rows of 34:
    - check icon #B4FF3A + „Czym są MSGiP: MSG a MSP” … „0:00” (#D6D2F0);
    - current row (background #241536, radius 10, small #FF2E93 bars icon): „Globalizacja, handel i kryzysy” (14/800) … „1:55”;
    - „Państwa i organizacje międzynarodowe” … „4:05”;
    - „Korporacje, UE i NGO” … „6:30”.

**Behaviour:**
- Collapsing the player shows a mini-player (64px, #15122B) above the nav on every tab: a fox+szop tile 40, „Lis i Szop · Rozdział 2 z 4”, play/pause 44, X 44.
- With „Pauzy na pytania” off, the questions are collected at the end of the episode.

### 9. Podcast-Pauza.dc.html (question pause): 390×844

**Purpose:** playback stops and the fox asks about the mistake the Szop just made. The answer is recorded for a point.

**Why:** It turns listening into retrieval at the exact moment of confusion, and the user can still skip.

Layout:
1. **Top bar** as in artboard 8.
2. **Stage** (100–228), with roles reversed:
   - fox-think 96×102 at full opacity, chip „LIS PYTA” (fill #B4FF3A, text #14210A);
   - szop-idle at .6 opacity.
3. **Scrubber row** at y 240:
   - knob at 3:40;
   - the active marker is a 12px #FFA023 diamond with `.a-blink`;
   - times „3:40” / „-4:40”;
   - chip „PAUZA” (#2A1C10 background, #FFA023 text).
4. **Question sheet** (y 300–844; background #1B1836, top radius 28, top border 2px #5C3812, `.a-rise`):
   - chip „PAUZA NA PYTANIE” (background #2A1C10, border #5C3812, text #FFA023, pause icon 12);
   - top-right text button „Pomiń” (15/800, #D6D2F0);
   - question „Szop twierdzi, że w kryzysie płatniczym pomaga Bank Światowy. Kogo powinien był wymienić?” (Bricolage 22/27);
   - „Odpowiedź zapisze się do punktu „MFW”.” (13/600, #D6D2F0);
   - three answers, each h 52, gap 8: background #15122B, border 2px #2C2850, radius 18, shadow 0 4px 0 #14122A, letter tile 28 + 16/800 text: „A WTO”, „B MFW”, „C ONZ”;
   - divider: „albo” (13/700) between two #241F45 lines;
   - GhostButton (h 52) with a #FF2E93 mic icon: „POWIEDZ ODPOWIEDŹ”;
   - PrimaryButton, disabled until there is an answer: „SŁUCHAJ DALEJ”.

**Answered state** (not drawn):
- The chosen answer turns #1F2A12 with a #4E6B24 border, or #2A1017 with #5C1F2E when wrong.
- One line from the fox appears.
- „SŁUCHAJ DALEJ” becomes active.

### 10. Lis-Tryby.dc.html (Rozmowa z lisem, mode picker): 390×844, no nav

**Purpose:** pick a scope and one of three modes, with a plain description of each.

**Why:** All three modes test recall in the student's own words, which is the strongest proof of understanding. Weak points are offered first.

Layout:
1. **TopBar:** title „Rozmowa z lisem”.
2. **Intro** (y 112–202):
   - fox-happy 72×77 on the left;
   - speech bubble: Card, radius 18 with the top-left corner at 6;
   - text: „Wybierz, jak chcesz ćwiczyć. Odpowiadasz własnymi słowami — tak najlepiej widać, co naprawdę umiesz.” (15/600).
3. **„Z CZEGO?”** — one horizontally scrolling row of chips (h 40, radius 999); the last chip is cut by the edge:
   - „Cały przedmiot”
   - selected „Wykład 1–2” (#FF2E93 fill, text #200410, check)
   - „Wykład 3”
   - „Prezentacja”
   - „Słabe punkty · 6”
4. **„TRYB”** — 3 cards, each about 92 high, gap 10:
   - Each card: icon tile 44 + title 17/800 + description 14/600 #D6D2F0 + meta 12/800 caps; radio 24 on the right (selected = #FF2E93 fill with a #200410 check; unselected = 2px #6E67A8 ring).
   - The three modes:
     - **„Wytłumacz mi”** (lightbulb, acid tint), *selected*: border #FF2E93, background #241536.
       - „Tłumaczysz punkt własnymi słowami. Lis dopytuje i pokazuje, czego zabrakło.”
       - „OK. 5 MIN · JEDEN PUNKT”
     - **„Przepytaj mnie”** (help-bubble, cyan tint):
       - „Lis zadaje pytania otwarte i ocenia każdą odpowiedź.”
       - „OK. 8 MIN · 5 PYTAŃ”
     - **„Egzamin ustny”** (mic, gold tint):
       - „Pytanie, dopytanie i ocena w skali 2–5, jak przy komisji.”
       - „OK. 10 MIN · 3 PYTANIA”
5. **„KTÓRY PUNKT?”** (shown only for Wytłumacz mi), with „najpierw słabe” on the right (12/700):
   - scrolling chips (h 44, radius 13, each with a MasteryMarker);
   - R „MFW” is selected (border #FF2E93, background #241536);
   - then R „Zarządzanie kryzysami”, W „MSG a MSP”, W „WTO”, U „Globalizacja”.
6. **Note:** „Odpowiadasz, pisząc. Możesz też mówić — stuknij mikrofon w rozmowie.” (13/600, #D6D2F0, centred).
7. **PrimaryButton:** „ZACZNIJ ROZMOWĘ”.

If the backend later adds a per-day cap, this line is added above the button: „Dziś możesz odbyć jeszcze 3 rozmowy.” When none are left: „Na dziś to wszystkie rozmowy. Jutro możesz znowu.”

### 11. Lis-Wytlumacz.dc.html (Wytłumacz mi chat): 390×844, no nav

**Purpose:**
- the student explains a point;
- the fox marks what was right, the gap and the misconception;
- links to the source;
- asks a follow-up question.

**Why:** Structured feedback, with the three labels in three colours, makes the Feynman technique easy to read. The source link sends the student back to the lesson, not to the AI.

Layout:
1. **Top bar:**
   - X on the left;
   - centre: „Wytłumacz mi” (17/800) above „MFW · Wykład 1–2” (12/700, #D6D2F0);
   - right text button „Zakończ” (14/800, #FF2E93).
2. **Fox message** (from y 112): fox-think avatar 32×34; bubble Card, radius 18 with the top-left at 6:
   - „Wytłumacz mi własnymi słowami, czym zajmuje się MFW. Wyobraź sobie, że mówisz to komuś z pierwszego roku.”
3. **User message** (right-aligned; background #241536, border 2px #46216B, radius 18 with the top-right at 6):
   - „MFW to organizacja, która pożycza pieniądze krajom w kryzysie i pilnuje kursów walut. Finansuje też drogi i szkoły w biednych krajach.”
4. **Fox feedback card:** fox-think avatar; Card with padding 12; three blocks separated by 1.5px #241F45 lines.
   - **Dobrze:** chip „DOBRZE” (acid tint) + „Pożyczki dla państw w kryzysie i dbanie o stabilne waluty — to sedno MFW.” (14/600)
   - **Luka:** chip „LUKA” (amber tint) + „Nie padło, skąd MFW ma pieniądze: z wpłat państw członkowskich.”
   - **Pomyłka:** chip „POMYŁKA” (red tint) + „Drogi i szkoły finansuje Bank Światowy, nie MFW. To częsta pułapka na sprawdzianie.”
   - **Footer:** book icon #FF2E93 + „Przeczytaj w lekcji 3, część 2” (13/800, #FF2E93) + chevron.
5. **Fox follow-up:** „Dopytam: państwo dostaje pożyczkę z MFW. Czego MFW zwykle oczekuje w zamian?”
6. **Quick chips** (h 36, radius 999, background #15122B, border 2px #2C2850, 13/800 #D6D2F0): „Podpowiedz”, „Nie wiem”.
7. **Input bar** (background #15122B, top border 2px #2C2850, padding 10 12 34):
   - mic button: 48px circle, #241536 with a #46216B border, #FF2E93 mic icon;
   - text field: h 48, radius 24, background #1B1836, border #2C2850, placeholder „Napisz odpowiedź…” (16/600, #9B95C9);
   - send button: 48px circle, disabled (#201C3E, icon #5C568F).

If the messages overflow, reduce the gap between messages to 8.

### 12. Lis-Egzamin.dc.html (oral exam result): 390×844, no nav

**Purpose:**
- the grade on the Polish scale;
- feedback per question;
- gaps, each with an action to fix it.

**Why:** It ends on concrete repair steps:
- if a reel already covers the gap, its button plays that reel;
- only if none does is a new reel offered (it uses a creation).

Layout:
1. **Top bar:** X, title „Egzamin ustny”, right text button „Jeszcze raz” (14/800, #D6D2F0).
2. **Result card** (y 108–250; background #241536, border #46216B, radius 28, padding 18):
   - eyebrow „EGZAMIN USTNY · WYKŁAD 1–2”;
   - „4” (Bricolage 64) + „dobry” (Bricolage 22) + „3 pytania z dopytaniem · 11 min” (13/700, #D6D2F0);
   - fox-happy 96×102 on the right;
   - scale strip: 6 cells, 48×32, gap 6, radius 10, background #15122B, border #241F45, 14/800 #D6D2F0: „2” „3” „3,5” „4” „4,5” „5”. The „4” cell is #FF2E93 with text #200410.
3. **„PYTANIA”** — Card with 3 rows of 56:
   - Each row: number tile 28 + question (14/800, one line) + feedback (13/600, #D6D2F0) + a chip on the right.
   - Rows:
     1. „Czym różnią się MSG od MSP?” · „Jasna definicja i dobry przykład.” · „DOBRZE” (acid tint)
     2. „Jaką rolę w kryzysach pełni MFW?” · „Przy dopytaniu pomylone z Bankiem Światowym.” · „PRAWIE” (amber tint)
     3. „Czy korporacja jest podmiotem MSGiP?” · „Dobry argument, zabrakło przykładu.” · „DOBRZE”
4. **„DO POPRAWY”** — 2 cards, about 110 each (Card, radius 18, padding 12), each with a title, a source line and two pill buttons (h 36, 12/800 caps):
   - **Card 1:** „MFW a Bank Światowy: kto co robi” / „Lekcja 3, część 2”
     - „W POWTÓRCE” — done state: acid tint with a check;
     - „OBEJRZYJ ROLKĘ 2/5” — #15122B with a #2C2850 border and a #FFA023 reel icon.
   - **Card 2:** „Przykład korporacji jako podmiotu” / „Lekcja 4, część 1”
     - „DODAJ DO POWTÓRKI” (plus icon);
     - „ZRÓB ROLKĘ Z TEGO” (reel icon #FFA023) — opens the Przygotuj sheet in single-reel mode, with the counter line there.
5. **PrimaryButton:** „GOTOWE” (back to the hub).

### 13. Lis-Glos.dc.html (voice mode): 390×844, no nav

**Purpose:** answering out loud, with push-to-talk and a live transcript.

**Why:** This is a later phase, so the screen is a target design. It reuses the oral-exam flow, and a big fox makes speaking to the app feel natural.

Layout:
1. **Top bar:**
   - X;
   - centre: „Egzamin ustny” (17/800) above „Pytanie 2 z 3” (12/700, #D6D2F0);
   - right: keyboard icon + „Pisz” (14/800, #D6D2F0).
2. **Question card** (Card, y 112–196):
   - „LIS PYTA” (10.5/800, #B4FF3A);
   - „Jaką rolę w kryzysach pełni MFW? Podaj przykład.” (Bricolage 20/25).
3. **Fox:** fox-idle 200×213, centred, y 220–433.
4. **Listening indicator:** 7 bars, width 6, gap 6, heights 12/24/40/28/44/20/14, colour #B4FF3A, radius 3, centred at y 445–489. Under them: „Słucham…” (15/800, #B4FF3A, `.a-blink`).
5. **Transcript card** (y 532–676; background #15122B, border 2px #2C2850, radius 22, padding 14):
   - „TWOJA ODPOWIEDŹ” (10.5/800 caps, #D6D2F0);
   - final text (17/600, #F4F2FF): „MFW pożycza państwom w kryzysie bilansu płatniczego, na przykład Grecji po 2010 roku. W zamian”;
   - interim words (17/600, #9B95C9): „wymaga reform i cięcia”.
6. **Controls:**
   - left: 56px ghost circle with a replay icon, label „Powtórz pytanie” (12/800, #D6D2F0);
   - centre: push-to-talk, an 88px #FF2E93 circle with a 34px #200410 mic icon, drawn *pressed* (moved down 4px, shadow 0 2px 0 #B01460), label „Puść, gdy skończysz” (13/800, #F4F2FF);
   - right: 56px ghost circle with a #FF4767 stop icon, label „Zakończ”.

### 14. Dzis.dc.html (Today with the new formats): 390×1340

**Purpose:** the daily plan, where each row opens its format directly. It adds:
- a reel-series continuation;
- a podcast suggestion before the exam;
- a „przepytaj się” suggestion.

**Why:** The plan is built from each subject's NA TERAZ, so Dziś and the hub never disagree. Extras sit in one section, „POZA PLANEM”, so the screen does not get cluttered.

Layout:
1. **Safe area.**
2. **Top bar:**
   - logo „Cramfox” (Bricolage 22) with a „.” in #B4FF3A;
   - pills (h 34, background #1B1836, border 2px #2C2850, radius 999):
     - flame #FF7A1A + „5” (15/800) „dni” (11/700, #D6D2F0);
     - bolt #FFC043 + „1 240” „xp”;
     - gem #A855F7 + „85”.
3. **Header:**
   - eyebrow „CZWARTEK, 22 PAŹDZIERNIKA”;
   - H1 „Plan na dziś” (Bricolage 30);
   - fox-idle 66×70 on the right.
4. **Plan bar:** 10px, #B4FF3A at 25%, with „1 z 4” on the right (13/800).
5. **Mini tiles** (3 × 110×40, radius 13, Card colours, shadow 0 3px 0 #14122A):
   - star #FFC043 „Misje 1/3”;
   - flame „Seria 5”;
   - cards #22D3EE „Album 24”.
6. **Exam card** (h 76; background #241536, border #46216B, radius 22):
   - monogram tile 44, #FF2E93, „MS” (Bricolage 16, #200410);
   - „Sprawdzian z MSGiP za 6 dni” (16/800);
   - „Gotowość 40% · plan na dziś: ok. 10 min” (13/700, #D6D2F0);
   - chevron (opens the hub).
7. **„PLAN DNIA”** (with „zostało ok. 10 min” on the right) — Card with 4 rows of 68, separated by #241F45 lines:
   - Each row: icon tile 44 + title (16/800, ellipsis) + sub (13/700, #D6D2F0) + right element.
   - Rows:
     1. **Done:** tile #B4FF3A with a #14210A check; „Powtórka” (#D6D2F0); „12 fiszek i pytań”; chip „ZROBIONE” (acid tint).
     2. Book on pink tint: „Lekcja — Korporacje, UE i NGO” / „MSGiP · dokończ, ok. 4 min” / chip „+15 XP” (#FFC043 on #2A2110).
     3. Reel on amber tint: „Rolki — Kto rządzi światową gospodarką?” / „MSGiP · 3 z 5 · ok. 3 min” / „+15 XP”.
     4. szop-idle 40×43 on #15122B: „Odzyskaj 2 punkty od Szopa” / „MSGiP · MFW, Zarządzanie kryzysami” / „+20 XP”.
8. **„POZA PLANEM”:**
   - **Podcast card** (Card, h 88):
     - tile 64×56, #241536, with fox-idle 30 + szop-idle 30;
     - „Podcast — Lis i Szop o Wykładzie 1–2” (15/800);
     - „Zostało 5:10 · dobry na drogę przed sprawdzianem” (13/700, #D6D2F0);
     - 48px #FF2E93 play circle.
   - **Suggestion card** (Card, h 132):
     - fox-think 72×77 on the right;
     - „PROPOZYCJA LISA” (11/800, #B4FF3A);
     - „Przepytaj się z Wykładu 1–2” (Bricolage 20);
     - „Lekcje masz prawie za sobą. 5 pytań otwartych pokaże, co już się trzyma.” (15/600, #D6D2F0);
     - small GhostButton „PRZEPYTAJ MNIE · 8 MIN”.
9. **„TWOJE PRZEDMIOTY”** (with „Wszystkie ›” on the right):
   - **Subject card** (Card, h 96):
     - monogram 48, #FF2E93, „MS”;
     - „MSGiP” (17/800);
     - „Umiesz 8 z 27 · sprawdzian za 6 dni” (13/700, #D6D2F0);
     - mini MasteryBar 6px (8 / 4 / 2 / 13);
     - chevron.
   - **Add tile** (h 64, dashed 2px #2C2850): plus icon #B4FF3A + „Dodaj materiał”.
10. **BottomNav** with „Dziś” active.

---

## 6. Sheets and behaviour without an artboard (for implementation)

- **HowSheet „Jak liczę, co umiesz”:**
  - „Każdy materiał dzielę na kluczowe punkty. Do każdego punktu należą fiszki i pytania z lekcji.”
  - One row per marker:
    - „Umiem — większość fiszek i pytań o tym punkcie masz dobrze w co najmniej dwa różne dni.”
    - „W trakcie — punkt już ćwiczony, ale jeszcze nieutrwalony.”
    - „Do odświeżenia — minął termin powtórki. To robota Szopa Zapominalskiego: odzyskasz punkt jedną krótką powtórką.”
    - „Nowe — jeszcze nie ćwiczone.”
  - Closing lines:
    - „Rolki i podcast pomagają, ale punkt rośnie dopiero po dobrej odpowiedzi — na końcu rolki, w pauzie podcastu, w lekcji, fiszkach albo rozmowie z lisem.”
    - „Gotowość do sprawdzianu: 70% to punkty, które umiesz, 30% to najlepszy egzamin próbny.”
    - „XP i seria nie zmieniają tych kwadratów.”
  - Button „ROZUMIEM”.
- **PointSheet** (example: MFW):
  - „WYKŁAD 1–2 · PUNKT 9 Z 13” / „MFW: rola Międzynarodowego Funduszu Walutowego” / chip „DO ODŚWIEŻENIA” / „Termin powtórki minął 4 dni temu. Ostatnio: 4 z 5 dobrze.”
  - The primary button depends on the state:
    - Do odświeżenia: „ODŚWIEŻ TEN PUNKT · 2 MIN”
    - W trakcie: „PRZEĆWICZ TEN PUNKT · 2 MIN”
    - Nowe: „ZACZNIJ OD LEKCJI 3”
    - Umiem: no primary button, only the row „Sprawdź się jeszcze raz”
  - Rows: „Przeczytaj w lekcji 3, część 2”, „Obejrzyj rolkę 2/5: ONZ, WTO, MFW i Bank Światowy”, „Wytłumacz to lisowi”, „Źródło: strona 11”.
  - Footer: „To nie jest punkt z mojego materiału”.
  - The refresh/practice session uses only existing data, with no AI call:
    1. the lesson chunk as a reminder;
    2. up to 4 linked questions;
    3. 3 linked flashcards;
    4. result „MFW: Do odświeżenia → W trakcie”.
  - No hearts.
- **„Inna propozycja”** on Main, cycling:
  - „Odzyskaj 2 punkty od Szopa · ok. 3 min”
  - „Obejrzyj rolkę 3/5: Globalizacja to tylko handel? · 0:47”
  - „Zacznij Wykład 3, lekcja 2 · ok. 7 min”
- **Limit and status copy:**

  | Situation | Copy |
  |---|---|
  | Busy | „Przygotowuję już coś innego (Wykład 3). Gdy skończę, możesz zlecić kolejne.” |
  | Nothing left (replaces the invitations in Material) | „Rolek i podcastów na razie nie przygotujesz. Wszystko, co masz w tym przedmiocie, działa bez ograniczeń.” |
  | Daily cap | „Na dziś to wszystko, co mogę przygotować. Jutro możesz znowu.” |
  | Global cap | „Dziś przygotowuję bardzo dużo materiałów. Spróbuj jutro — nic nie zostało zużyte.” |
  | Failed, not charged | „Nie udało się przygotować rolek. To błąd po naszej stronie i nie zużył tworzenia.” + a manual „SPRÓBUJ PONOWNIE” |
  | Failed, charged (only if the backend reports a charge) | „Nie udało się przygotować rolek. Ta próba zużyła jedno tworzenie.” |
  | Ready (toast) | „Rolki z „Wykład 3” są gotowe. Stuknij, żeby obejrzeć.” |

- **Engine and data notes** (all fields optional; nothing is renamed or reordered):
  - `TopicContent.points[] {id, t≤120, s≤24, lv[], fc[[lid,idx]], q[[lid,idx]]}`, passed through `clean()`. Old topics fall back to one point per level title.
  - Mastery is a pure function over `PROGRESS.srs`.
  - `PROGRESS.media` holds watched reels and the podcast position. `PROGRESS.oral` holds conversation grades per point.
  - The hub replaces `renderPath`/`drawTrail` and the subject tabs. `levelUnlocked` always passes in the hub; the boss unlock rule stays.
  - The podcast needs `UIBackgroundModes: audio` in `Info.plist`.

## 7. Canvas layout

- Canvas background #0A0916. Artboards are 390 wide, with 80px horizontal gaps (x = 0, 470, 940, 1410).
- Row label: Bricolage 28 #F4F2FF, 60px above each row.
- Each artboard has its file name as a caption above it (13/700, #9B95C9).

| Row | Label | y | Artboards (x) |
|---|---|---|---|
| 1 | „CENTRUM PRZEDMIOTU” | label 0, boards 60 | Main (0, h 2030) · Centrum-Material (470, h 2010) · Centrum-Nowy (940, h 1820) |
| 2 | „ROLKI” | label 2250, boards 2310 | Rolki-Seria (0) · Rolki-Odtwarzacz (470) · Rolki-Pytanie (940) · Rolki-Przygotuj (1410, h 1688) |
| 3 | „PODCAST” | label 4158, boards 4218 | Podcast-Odtwarzacz (0) · Podcast-Pauza (470) |
| 4 | „ROZMOWA Z LISEM” | label 5222, boards 5282 | Lis-Tryby (0) · Lis-Wytlumacz (470) · Lis-Egzamin (940) · Lis-Glos (1410) |
| 5 | „DZIŚ” | label 6286, boards 6346 | Dzis (0, h 1340) |

Heights: 844 for single screens. The three hub screens, Dzis and the two-frame Rolki-Przygotuj are taller because they are scrolling captures. They run slightly past 1900 because there are 3 materials; do not compress them.

## 8. Open owner decisions (the artboards assume the first option)

1. **A separate creation pool for reels and podcast** (recommended), so they never use up the 2 free lesson creations. The real numbers come from `/api/me`.
2. **A per-day cap on Rozmowa z lisem.** Without one, live AI calls are unbounded. The copy for a cap is ready in artboard 10.
3. **Key-point extraction in the same lesson generation call,** with server validation:
   - 6–15 points per material;
   - at least 3 items per point;
   - each item in exactly one point.

   Old subjects stay at one point per lesson unless they are regenerated.
4. **Voice mode (artboard 13) is a later phase.** The text mode ships first.