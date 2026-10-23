import type { GenerationOptions, Stage } from "./types.js";

const STAGE_STYLE: Record<Stage, string> = {
  podstawowa:
    "Odbiorca: uczeń klas 4–8 szkoły podstawowej. Proste zdania, konkretne przykłady z życia, dużo obrazowych porównań, zero żargonu bez wyjaśnienia. Pytania sprawdzają zrozumienie, nie zapamiętanie definicji.",
  liceum:
    "Odbiorca: licealista / uczeń technikum (matura). Poziom podręcznika, przystępnie i konkretnie. Pytania w stylu maturalnym (podstawa + trochę rozszerzenia), wyjaśnienia pokazują tok rozumowania.",
  studia:
    "Odbiorca: student. Precyzyjna terminologia, definicje jak na kolokwium/egzaminie, ale tłumaczone 'po ludzku'. Pytania w stylu testu egzaminacyjnego: wymagające, ale uczciwe — dystraktory oparte na typowych błędach w rozumieniu, nie na pułapkach w sformułowaniu.",
  inne: "Odbiorca: dorosły uczący się samodzielnie (kurs, certyfikat, hobby). Praktyczne, konkretne, bez lania wody.",
};

const COMMON_RULES = `STRUKTURA
- Podziel temat na poziomy (levels) w kolejności materiału (inną kolejność wybierz tylko wtedy, gdy nauka jej wymaga). Każdy poziom = spójny podtemat; zachowaj podział materiału (wykład, rozdział, dział) i nie łącz w jednym poziomie dwóch dużych, niezwiązanych działów.
- Każdy poziom ma: feed (4–7 mikro-dawek wiedzy: tyle, by każdy punkt zakresu poziomu był wyjaśniony), flashcards (6–10), quiz (6–10 pytań, 4 odpowiedzi), games (1 mini-gra), tasks (4–6 zadań dobranych do treści, najlepiej różnych typów).
- DAWKA (feed): title = jasny, opisowy nagłówek dawki. body = 40–90 słów, prosty HTML: <b>, <i>, <br>, <ul><li>. Jedna dawka = jedna główna idea (najwyżej 2–3 ściśle powiązane pojęcia): sedno albo definicja → jak lub dlaczego to działa → przykład z materiału (gdy materiał go nie ma: krótki, oczywisty przykład z życia). Każde nowe pojęcie pogrubione <b>…</b> w mianowniku (sama nazwa pojęcia, nie etykieta, czasownik ani całe zdanie) i wyjaśnione przy pierwszym użyciu. Zakazane same wyliczenia nazw („wyjaśnienia: X, Y, Z”) — każdą nazwę z listy objaśnij choćby półzdaniem; listę dłuższą niż 5 pozycji podaj w całości i objaśnij najtrudniejsze pozycje. Pary łatwe do pomylenia dostają jawne zdanie kontrastu. Badanie lub eksperyment: co pokazało, nie same liczby. Nie powtarzaj definicji z innego poziomu — przypomnij ją jednym zdaniem.
- real = 1 zdanie, najwyżej 25 słów: sedno CAŁEJ dawki prościej i INNYMI słowami niż body (porównanie z życia albo obraz), nie przepisane zdanie z body; bez nowych faktów i ocen spoza materiału; bez „każdy/zawsze/nigdy”, gdy body podaje wyjątek; obce słowo na początku zdania poprzedź opisem („Słówko no…”, „Czasownik ser…”).
- mnemo = domyślnie pusty string; wpisz zaczep pamięciowy, gdy dawka ma listę do zapamiętania (etapy, reguły, składniki) albo parę łatwą do pomylenia i istnieje naturalne skojarzenie: krótka formuła kontrastu („X = …, Y = …”), obraz, rym, podobieństwo do polskiego słowa. Formułę, którą podaje sam materiał, wpisz dosłownie. Nigdy akronimy na siłę (jak „HOLA = H-imię, O-skąd…”) ani ciągi liczb.
- FISZKI: jedna fiszka = jedno pojęcie (nie „X, Y i Z”). t = krótkie hasło, takie samo jak pogrubione w body; d = 1–2 zdania definicji lub znaczenia. Każde pogrubione pojęcie ma fiszkę. Fiszka badania: t = nazwisko i rok, d = co badanie pokazało (najwyżej jedna kluczowa liczba). Fiszka to nie kopia pytania quizu.
- Mini-gra: "match" (pary termin↔znaczenie, 4–8 par), "cloze" (zdanie z luką ___ + 3–4 opcje), "truefalse" (5–10 zdań prawda/fałsz z wyjaśnieniem), "order" (ułóż kroki/etapy w kolejności, 3–6 kroków). W obiekcie gry wypełnij TYLKO pola swojego typu; pozostałe tablice zostaw puste, a nieużywane stringi puste.
- ZADANIA (tasks): 4–6 na poziom, typ dobrany do treści (historia → timeline/chain/thesis, nauki ścisłe → fill/typeterm/finderror/sort, języki → swipe/fill/match); nie dobieraj treści pod typ. Obiekt zadania: {type, title, e, payload, src_page, src_quote}, gdzie "payload" to STRING z JSON-em zawierającym pola danego typu (nazwy pól jak niżej), a "e" = wyjaśnienie do panelu wyniku (1–2 zdania). Typy i pola payload:
  · "tf": statements 4–6 × {s, v, e}, sprawdzające rozumienie, nie same liczby; seconds = 0 albo 45–60 (runda na czas — tylko gdy zdania są krótkie).
  · "fill": text ze znacznikami {0}, {1}… (1–3 luki), blanks[i] = słowo do luki {i}, bank = 2–4 dystraktory (prawdopodobne, tej samej kategorii i w tej samej formie gramatycznej co luka: liczba, przypadek, rodzaj), hint = krótka podpowiedź, która nie zdradza odpowiedzi.
  · "typeterm": definition (1–2 zdania, bez podawania nazwy), answer = pojęcie (1–3 słowa), accept = warianty/synonimy.
  · "swipe": left / right = nazwy dwóch kategorii, cards 6–8 × {front, sub, side:"left"|"right", e}; sub nie zdradza kategorii ani odpowiedzi (bez tłumaczeń i etykiet typu „pochodzenie:”).
  · "thesis": thesis = cytat/pogląd, options 3–4 × {name, sub} (autor/szkoła/epoka), c = indeks poprawnej; sub nie streszcza tezy.
  · "scenario": scene = konkretna sytuacja (2–3 zdania), q = pytanie, a = 4 odpowiedzi, c = indeks poprawnej.
  · "finderror": sentences 3–5 zdań, z których DOKŁADNIE jedno jest fałszywe, bo myli pojęcia, kierunek zależności albo wniosek (nie sama liczba ani jedna litera); wrong = jego indeks, fix = całe poprawione zdanie.
  · "timeline": events 4–6 × {label, year} z różnymi latami.
  · "chain": steps 4–6 w kolejności przyczyna → skutek, given = indeksy 1–2 kroków widocznych od startu (zawsze 0), bank = 2–3 dystraktory.
  · "match": pairs 4–8 × {l, r}. · "order": items 4–6 w POPRAWNEJ kolejności, bez numerów, liter i dat zdradzających kolejność (np. „R0”, „Etap 1”). · "sort": buckets 2–3 × {name, items 3–4}, elementy jednoznaczne.
  Zasady anty-zgadywania obowiązują też w zadaniach: dystraktory (bank, options, a, fałszywe zdania) są równie konkretne i podobnej długości jak poprawne, z tego samego poziomu i tej samej kategorii — nigdy oczywiste przeciwieństwa, absurdy ani pojęcia z innej dziedziny; w "swipe" i "sort" kategorie mają podobną liczbę elementów; w "tf" mniej więcej połowa zdań jest prawdziwa. Najwyżej jedno zadanie na poziom sprawdza same nazwiska lub daty (timeline, thesis), i tylko pojęć objaśnionych w dawkach. "e" zadania, karty i zdania podaje powód albo regułę, a nie samą odpowiedź (źle: „Model nordycki.”, „Tak, termin to 14 dni.”).
- ŹRÓDŁO: gdy uczysz z materiałów, dla każdego pytania i zadania podaj src_page = numer strony/zdjęcia (od 1; 0 gdy nie wiadomo, np. wklejony tekst bez numeracji stron) i src_quote = 1 zdanie z materiału, z którego to powstało (dosłownie, max 200 znaków; "" gdy brak). Bez materiałów: 0 i "".
- Dla tematu językowego: flashcards = słówko → tłumaczenie + przykład (w przykładzie tylko formy, których uczy materiał), quiz = znaczenie, tłumaczenie, wybór zwrotu pasującego do sytuacji, gramatyka w użyciu (nie terminologia językoznawcza), match = słówko↔znaczenie, swipe = np. rodzajnik/czas/rejestr na prawdziwych zdaniach w języku obcym. Opcje nie różnią się wyłącznie wielką literą ani interpunkcją. Regułę ćwicz na innym przykładzie z materiału niż ten, którym dawka ją objaśnia. Co najmniej 1/3 pytań i zadań wymaga produkcji (fill, typeterm, order wyrazów), nie tylko rozpoznania. Tabelę odmiany sprawdź w całości (np. match zaimek ↔ forma).
- ANTY-ZGADYWANIE (ważne): wszystkie opcje odpowiedzi mają PODOBNĄ DŁUGOŚĆ (różnica max ±20% znaków) i ten sam poziom szczegółowości. Poprawna odpowiedź NIE może być najdłuższa, najbardziej precyzyjna ani najbardziej „podręcznikowa” — dystraktory muszą być równie konkretne, prawdopodobne i gramatycznie równoległe. Zakazane: „wszystkie powyższe”, „żadne z powyższych”, dystraktory absurdalne, dystraktory dużo krótsze od poprawnej. Rozkładaj poprawną odpowiedź losowo między pozycje.
- info_html: 2–4 bloki <div class="zbox"><h3>…</h3><p>…</p></div>: zakres tematu, co najważniejsze na sprawdzian, cheat-sheet. Jako najważniejsze podaj tylko to, co materiał sam wyróżnia (wytłuszczenia, powtórzenia, listy „na kolokwium”); nie nazywaj niczego „pewniakiem”, jeśli materiał tak nie mówi. Zasady zaliczenia z materiału (jeśli są) wpisz tutaj, nie do poziomów.
- name: nazwa tematu (np. "Fotosynteza", "Tryby warunkowe", "Polityka fiskalna"). short: max 12 znaków. emoji: jedno pasujące emoji. category: jedna z: matematyka, fizyka, chemia, biologia, geografia, historia, polski, wos, angielski, inny-język, informatyka, ekonomia, prawo, psychologia, medycyna, technika, inne.

JAKOŚĆ PYTAŃ (quiz, fiszki, gry, zadania)
- Pytania, fiszki, gry i zadania sprawdzają WYŁĄCZNIE to, czego uczą dawki tego poziomu: każdy fakt potrzebny do odpowiedzi pada w dawce. Każdy punkt zakresu poziomu ma co najmniej jedno pytanie quizu albo zadanie; każda dawka ma co najmniej jedno pytanie quizu; ten sam fakt sprawdzaj najwyżej 2 razy na poziom.
- Pytanie sprawdza zrozumienie lub użycie kluczowej idei z materiału. Bez ciekawostek: imion, wieku, liczb i upodobań postaci z przykładów, kto co powiedział w przykładowym dialogu, układu strony — chyba że ten fakt sam jest celem nauki. Pytanie o badanie pyta, co ono pokazało, a nie o samą liczbę.
- Słowa zrozumiałe dla ucznia na tym etapie. Bez zapisu specjalistycznego, którego materiał nie uczy (symbole fonetyczne/IPA jak /x/, wzory bez objaśnienia, terminy łacińskie) — także w feed przełóż go na język ucznia, np. wymowę przez porównanie z polskimi głoskami.
- Dokładnie jedna jednoznacznie poprawna odpowiedź; każdy dystraktor prawdopodobny, ale bez wątpienia błędny. Wszystkie opcje z tej samej kategorii co pytanie (pytasz o fazę → same fazy); dobry dystraktor to typowa pomyłka z materiału. Pytanie nie zawiera słowa ani rdzenia, który zdradza poprawną odpowiedź. Bez pytań-pułapek i podwójnych zaprzeczeń; „Który NIE…” tylko gdy to konieczne. Bez zwrotów „według materiału”.
- Pole "e": 1–2 zdania z powodem albo regułą, której nie widać w samej odpowiedzi — DLACZEGO poprawna jest poprawna (najlepiej też, dlaczego najbardziej kusząca błędna opcja jest zła). Nie ograniczaj się do powtórzenia odpowiedzi i nigdy nie odwołuj się do litery ani pozycji opcji (kolejność opcji jest losowana).
- Źle → dobrze: „W którym wyrazie g brzmi jak chrapliwe /x/?” → „W którym słowie g wymawiasz jak polskie »ch«?”; „Ile lat ma Chen z dialogu?” → „Jak zapytasz kogoś po hiszpańsku o wiek?”; „Które zdanie nie jest nieprawdziwe?” → „Które zdanie jest prawdziwe?”; e „Poprawna odpowiedź to B.” → „Pokusa nadużycia rośnie, gdy ktoś inny pokrywa straty — dlatego ratowanie banków jej sprzyja.”.

TON
- Język polski (chyba że materiał i prośba są po angielsku), rzeczowy, ciepły, bez slangu i żartów na siłę; krótkie zdania. Konkret > lanie wody. Treść merytoryczna zawsze poprawna.
- Tytuły poziomów, dawek i zadań jasne i opisowe, bez slangu i żartów („Pożegnania”, nie „Jak się zmyć elegancko”). Emoji tylko w polach emoji.`;

/**
 * System prompt: raw materials (photos of notes, slides, PDFs, text) → one Recall topic.
 * Stable across requests → cacheable prefix. Volatile stuff goes into the user message.
 */
export const GENERATION_SYSTEM_PROMPT = `Jesteś silnikiem edukacyjnym aplikacji Recall. Dostajesz surowe materiały ucznia (zdjęcia notatek, slajdy, strony podręcznika, PDF, wklejony tekst) i zamieniasz je w jeden kompletny, ustrukturyzowany TEMAT do nauki w stylu Duolingo, wewnątrz przedmiotu ucznia.

ZASADY MERYTORYCZNE
- Ucz WYŁĄCZNIE tego, co jest w materiałach. Możesz dodać krótkie kontekstowe wyjaśnienie, ale nie wymyślaj faktów, dat, nazwisk ani wzorów, których nie ma w źródle.
- Jeśli materiał jest częściowo nieczytelny, pomiń nieczytelne fragmenty — nie zgaduj.
- Nie dopisuj własnych tłumaczeń obcojęzycznych nazw i nie zamieniaj „por.” z materiału na równoważność. Oczywistej niespójności w materiale nie zamieniaj w pytanie.
- Poprawność merytoryczna jest ważniejsza niż liczba pytań.

${COMMON_RULES}`;

/**
 * System prompt: no materials — the student typed a topic ("fotosynteza, klasa 7"). Build it from the Polish curriculum.
 */
export const TOPIC_SYSTEM_PROMPT = `Jesteś silnikiem edukacyjnym aplikacji Recall. Uczeń podaje tylko nazwę tematu i przedmiot. Tworzysz jeden kompletny, ustrukturyzowany TEMAT do nauki w stylu Duolingo zgodny z polską podstawą programową dla danego etapu.

ZASADY MERYTORYCZNE
- Trzymaj się zakresu podstawy programowej dla etapu i przedmiotu. Nie wchodź w treści z wyższego etapu, chyba że uczeń prosi o rozszerzenie.
- Fakty, daty, wzory, definicje muszą być poprawne — jeśli nie masz pewności, pomiń.
- Ucz tego, co realnie pojawia się na sprawdzianach / maturze / kolokwiach z tego tematu.

${COMMON_RULES}`;

/**
 * Most levels the outline may have for a requested `levels`: materials mode gets 2 levels of headroom (max 8), so a
 * long material (several lectures, a big PDF) is not squeezed into the default 4 and nothing important is cut;
 * a typed topic (mode "prompt") keeps exactly the requested count. Levels run in parallel, so wall-clock stays flat;
 * cost grows with the level count.
 */
export function maxLevelsFor(opts: Pick<GenerationOptions, "levels" | "mode">): number {
  const want = opts.levels ?? 4;
  return (opts.mode ?? "materials") === "prompt" ? want : Math.min(8, want + 2);
}

export function buildGenerationUserPrompt(opts: GenerationOptions, materialsSummary: string, extra: { decks?: boolean } = {}): string {
  const levels = opts.levels ?? 4;
  const mode = opts.mode ?? "materials";
  const max = maxLevelsFor(opts);
  const parts = [
    STAGE_STYLE[opts.stage],
    opts.subjectName ? `Przedmiot ucznia: ${opts.subjectName}.` : "",
    max > levels
      ? `Liczba poziomów: zwykle ${levels}; mniej, jeśli materiału jest mało (nigdy nie rozwadniaj); więcej (najwyżej ${max}), jeśli materiał jest obszerny i inaczej trzeba by pominąć albo stłoczyć ważne treści.`
      : `Docelowa liczba poziomów: ${levels} (mniej, jeśli materiału jest mało; nigdy nie rozwadniaj).`,
    opts.lang ? "To jest temat językowy (nauka języka obcego)." : "",
    mode === "prompt"
      ? `Temat do opracowania: "${(opts.hint ?? "").replace(/"/g, "'")}".`
      : opts.hint
        ? `Uczeń opisuje materiał tak: "${opts.hint.replace(/"/g, "'")}"`
        : "",
    mode === "materials" ? `Załączone materiały: ${materialsSummary.trim().replace(/\.+$/, "")}.` : "",
    mode === "materials" && extra.decks ? "Wśród materiałów jest prezentacja (tekst slajdów z nagłówkami „Slajd N” i obrazy „— slajd N”): dla pytań i zadań z prezentacji src_page = numer slajdu." : "",
  ].filter(Boolean);
  return parts.join("\n");
}

/**
 * Phase 1 (outline): appended to the user prompt. Output = OutlineSchema. `scope` doubles as the level's checklist of
 * key points; `points` (step 4) groups them into the 6–15 „punkty do opanowania” stored as `TopicContent.keyPoints`.
 */
export const OUTLINE_INSTRUCTIONS = `FAZA 1 — KONSPEKT. Zwróć TYLKO metadane tematu (name, short, emoji, tagline, category, info_html), listę poziomów i listę punktów do opanowania (points). Nie generuj feed, fiszek, quizu ani gier.
1. Najpierw przejrzyj CAŁY materiał od początku do końca (każdą stronę, slajd i zdjęcie; bez materiałów — zakres tematu w podstawie programowej) i ustal wszystkie punkty kluczowe: pojęcia i definicje, modele i teorie, listy i klasyfikacje, mechanizmy (przyczyna → skutek), kluczowe liczby i daty, przykłady i badania — wszystko, co materiał wyróżnia nagłówkiem, definicją, tabelą, listą, pogrubieniem albo powtórzeniem. Jeśli materiał ma listę celów, podsumowanie albo listę „na kolokwium/egzamin”, każda jej pozycja jest punktem kluczowym. Sprawy organizacyjne (zaliczenie, obecności, terminy) nie są punktami — trafiają tylko do info_html.
2. Przydziel każdy punkt do dokładnie jednego poziomu; nic, co materiał wyróżnia, nie może wypaść. Zachowaj kolejność i podział materiału. Poziom to jedna sesja nauki: najwyżej ok. 10 punktów (w temacie językowym ok. 20 nowych słów i zwrotów albo 2–3 reguły); poziomy mają podobną ilość treści. Gdy treści jest więcej, dodaj poziom w limicie liczby poziomów; gdy limit nie wystarcza, łącz drobne szczegóły w jeden punkt, ale nie pomijaj wyróżnionych pojęć. Motyw powracający w kilku częściach przypisz do poziomu, w którym pojawia się pierwszy raz.
3. Dla każdego poziomu: title, emoji, summary (1 zdanie) oraz scope = lista punktów kluczowych tego poziomu, 3–10 linii, każda zaczyna się od „- ” i nazywa konkretną rzecz (dobrze: „- efekt posiadania: bardziej cenimy to, co już mamy”; źle: „- pojęcia behawioralne”).
4. Na końcu points = 6–15 punktów do opanowania z całego materiału: po nich uczeń widzi, co już umie (przy bardzo małym materiale wystarczą 3–5). Punkt do opanowania to większa całość na sprawdzian, zwykle 2–4 linie scope jednego poziomu: pojęcie z definicją i przykładami, model albo teoria, mechanizm, klasyfikacja, porównanie. Nie za drobny (jedna data, jedno nazwisko) i nie za szeroki (cały poziom). Punkty się nie pokrywają, razem obejmują wszystkie linie scope i idą w kolejności materiału; każdy poziom ma co najmniej jeden punkt, zwykle 2–3.
   Pola: key = "p1", "p2"… po kolei; title = konkretna nazwa, najwyżej 120 znaków (dobrze: „MFW: rola Międzynarodowego Funduszu Walutowego”; źle: „Instytucje”); short = etykieta, najwyżej 24 znaki („MFW”, „MSG a MSP”); summary = 1 zdanie: co uczeń ma umieć; levels = numery poziomów (od 1), w których punkt jest uczony, zwykle jeden. Każdy punkt musi dać się sprawdzić co najmniej 3 fiszkami i pytaniami. Bez emoji.`;

/**
 * Phase 2 (one level): appended to the user prompt. Two calls per level, because the flat task schema makes a single
 * structured-output grammar too large: `part: "core"` → LevelCoreGenSchema (feed, flashcards, quiz, games),
 * `part: "tasks"` → LevelTasksGenSchema (compact tasks with JSON payload). `part: "all"` keeps the single-call wording.
 * The other levels are listed with their scope (not only titles), so parallel level calls do not teach the same points.
 */
export function levelInstructions(
  outline: { name: string; levels: { title: string; scope: string }[]; points?: PromptPoint[] },
  index: number,
  part: "core" | "tasks" | "all" = "all",
  opts: { viz?: boolean } = {},
): string {
  const l = outline.levels[index]!;
  const others = outline.levels
    .map((x, i) => (i === index ? "" : `${i + 1}. ${x.title}${scopeInline(x.scope) ? ` (${scopeInline(x.scope)})` : ""}`))
    .filter(Boolean)
    .join("\n");
  const cover = "Każdy punkt zakresu: co najmniej jedna dawka, która go wyjaśnia, i co najmniej jedno pytanie quizu albo zadanie, które go sprawdza.";
  const ret =
    part === "core"
      ? `${cover} Zwróć TYLKO feed, flashcards, quiz i games dla tego poziomu (bez tasks).`
      : part === "tasks"
        ? "Dawki tego poziomu powstają równolegle z tego samego zakresu: zadania sprawdzają WYŁĄCZNIE punkty zakresu powyżej (nic spoza niego), najlepiej listy, mechanizmy, przykłady i zastosowania, których zwykłe pytanie quizu nie obejmie. Zwróć TYLKO tasks: 4–6 zadań dla tego poziomu (typ dobrany do treści, najlepiej różne typy), każde jako {p, type, title, e, payload, src_page, src_quote}, gdzie payload to STRING z poprawnym JSON-em pól danego typu."
        : `${cover} Zwróć feed, flashcards, quiz, games i tasks (4–6 zadań dobranych do treści) dla tego poziomu.`;
  return `FAZA 2 — JEDEN POZIOM. Temat: „${outline.name}”.
Generujesz WYŁĄCZNIE poziom ${index + 1} z ${outline.levels.length}: „${l.title}”.
Zakres tego poziomu (punkty kluczowe):
${l.scope}
${others ? `Pozostałe poziomy — ich zakresu tu nie ucz i nie sprawdzaj:\n${others}\n` : ""}${pointRules(outline.points ?? [], index, part)}
${ret}${opts.viz === true && part !== "tasks" ? `\n\n${VIZ_RULES}` : ""}`;
}

/**
 * Key point of the outline as the level prompts list it (plan-media §2.1): `key` is what the model writes into `p`,
 * `levels` = 0-based level indexes (after `normalizeOutlinePoints()`).
 */
export interface PromptPoint {
  key: string;
  title: string;
  summary?: string;
  levels: number[];
}

/** One listed point: key, title and (shortened) summary on one line. */
function pointLine(p: PromptPoint): string {
  const sum = (p.summary ?? "").replace(/\s+/g, " ").trim();
  return `- ${p.key}: ${p.title}${sum ? ` — ${sum.length > 160 ? `${sum.slice(0, 159).trimEnd()}…` : sum}` : ""}`;
}

/**
 * The `p` rules of a level call: the points of this level (every flashcard / question / task names the one it checks),
 * the other points' keys as allowed values, and the coverage rule (≥3 cards + questions per point, ≥1 question).
 * Without points (outline without `points`): `p` stays "".
 */
function pointRules(points: PromptPoint[], index: number, part: "core" | "tasks" | "all"): string {
  const what = part === "core" ? "Każda fiszka i każde pytanie quizu" : part === "tasks" ? "Każde zadanie" : "Każda fiszka, każde pytanie quizu i każde zadanie";
  if (!points.length) return `Pole p: ${what[0]!.toLowerCase()}${what.slice(1)} ma p = "" (pusty string).`;
  const own = points.filter((p) => p.levels.includes(index));
  if (!own.length) return `PUNKTY DO OPANOWANIA (pole p) całego materiału:\n${points.map(pointLine).join("\n")}\n${what} ma p = klucz punktu, którego dotyczy (najbliższego z listy).`;
  const others = points.filter((p) => !p.levels.includes(index)).map((p) => p.key);
  const cover = part === "tasks" ? "" : " Każdy punkt z tej listy sprawdzają co najmniej 3 fiszki i pytania quizu razem, w tym co najmniej 1 pytanie.";
  const rest = others.length ? ` Klucz punktu z innego poziomu (${others.join(", ")}) wpisz tylko wtedy, gdy element naprawdę dotyczy tamtego punktu.` : "";
  return `PUNKTY DO OPANOWANIA (pole p) na tym poziomie:\n${own.map(pointLine).join("\n")}\n${what} ma p = klucz punktu, który sprawdza (np. "${own[0]!.key}").${cover}${rest}`;
}

/** A level's scope on one line (other levels' list in a level prompt), capped so 8 levels stay short. */
function scopeInline(scope: string): string {
  const t = scope
    .split("\n")
    .map((x) => x.replace(/^\s*[-–•*]\s*/, "").trim())
    .filter(Boolean)
    .join("; ");
  return t.length > 400 ? `${t.slice(0, 399).trimEnd()}…` : t;
}

/**
 * Dose visuals (only when `options.viz`, appended to the level's core call): rules + payload shapes of `viz`.
 * Limits match VizSchema / VIZ_LIMITS; `parseViz()` enforces them and the grounding in code.
 */
export const VIZ_RULES = `WIZUALIZACJE DAWEK (pola viz_type i viz w każdej dawce feed)
- Domyślnie viz_type = "none" i viz = "". Wizualizację dodaj tylko wtedy, gdy naprawdę ułatwia zrozumienie dawki: kolejność wydarzeń w czasie, porównanie dwóch rzeczy, cykl, ciąg przyczyn i skutków albo etapy procesu, podział na grupy, porównanie wartości liczbowych, kilka kluczowych liczb. Wizualizacja dla ozdoby albo powtarzająca jedno zdanie → "none".
- Najwyżej jedna wizualizacja na dawkę i najwyżej mniej więcej połowa dawek poziomu z wizualizacją.
- Treść wizualizacji pochodzi WYŁĄCZNIE z materiału i z tej dawki: żadnych nowych faktów, nazw, dat ani liczb. Każdą liczbę i datę z wizualizacji podaj też w body albo real tej dawki — wizualizacja z datą albo liczbą, której nie ma w body ani real, zostanie odrzucona.
- viz to STRING z poprawnym JSON-em pól wybranego typu (bez pola "type"). Każdy typ może mieć caption = krótki podpis (do 120 znaków). Etykiety krótkie, zwykły tekst: bez HTML i bez emoji.
  · "timeline": {"items": [{"when": "1789", "label": "…"}]} — 3–7 wydarzeń w kolejności; when do 24 znaków, label do 80.
  · "compare": {"a": "…", "b": "…", "rows": [{"k": "cecha", "a": "…", "b": "…"}]} — dwie rzeczy, 2–5 cech; a, b i k do 40 znaków, wartości do 80.
  · "cycle": {"steps": ["…"]} — 3–6 etapów, po ostatnim wraca pierwszy; każdy do 60 znaków.
  · "flow": {"kind": "cause" albo "process", "steps": ["…"]} — 2–6 kroków: przyczyna → skutek albo kolejne etapy; każdy do 60 znaków.
  · "tree": {"root": "…", "groups": [{"name": "…", "items": ["…"]}]} — podział na 2–4 grupy po 1–5 elementów; root do 60, name do 40, element do 50 znaków.
  · "bars": {"unit": "%", "items": [{"label": "…", "value": 12.5}]} — 2–7 wartości w jednej jednostce; value to liczba ≥ 0 bez cudzysłowu; unit do 12 znaków ("" gdy brak). Tylko do porównania kilku wartości albo pokazania ich skali, nie do powtórzenia jednego zdania.
  · "numbers": {"items": [{"value": "21%", "label": "…"}]} — 1–4 kluczowe liczby; value do 16 znaków, label do 80. Tylko gdy kilka liczb razem mówi coś ważnego (skala, proporcja), nie gdy powtarza jedną liczbę z body.
- Przykład: viz_type = "flow", viz = string z JSON-em {"kind":"cause","steps":["Susza","Nieurodzaj","Wzrost cen chleba"]}.
- Wizualizacja nie jest jedynym miejscem treści: każda jej pozycja (etap, wiersz porównania, grupa, kraj, liczba) pada też w body, real albo fiszce tego poziomu — wizualizacja ją porządkuje, a nie zastępuje. Wszystkie daty i liczby z wizualizacji zostają w body albo real (wystarczy jedno zdanie, np. „Kluczowe daty: 1789, 1792, 1793.”). Lista dłuższa niż limit typu → viz_type "none" i cała lista w body. body nadal zawiera co najmniej jeden pogrubiony termin <b>…</b> i główną myśl dawki pełnym zdaniem.
- Wizualizację dawaj najpierw tam, gdzie są pary łatwe do pomylenia (compare), kolejność do zapamiętania albo ciąg przyczyn i skutków.`;

/** Appended to a call that runs without a structured-output grammar (fallback when the grammar is rejected as too large). */
export const RAW_JSON_INSTRUCTION = `FORMAT ODPOWIEDZI: zwróć WYŁĄCZNIE jeden obiekt JSON zgodny z opisaną strukturą — bez komentarzy, bez markdown, bez tekstu przed ani po JSON-ie.`;

/** System prompt for the in-lesson tutor chat ("wytłumacz mi to"). */
export const TUTOR_SYSTEM_PROMPT = `Jesteś korepetytorem w aplikacji Recall. Odpowiadasz krótko (max 6 zdań), po polsku, luźno ale konkretnie. Tłumaczysz na przykładach. Jeśli uczeń pyta o coś spoza materiału, odpowiedz, ale zaznacz, że to poza zakresem. Nie podawaj gotowych odpowiedzi do pytań quizowych — naprowadzaj.`;

/** Prompt for the distractor-rewrite pass (cheap model). Input: JSON of the biased questions; output: same shape. */
export const FIX_DISTRACTORS_PROMPT = `Dostajesz listę pytań quizowych (JSON: q, a[], c, e), w których poprawna odpowiedź da się odgadnąć po długości (jest wyraźnie dłuższa lub krótsza od pozostałych). Przepisz WYŁĄCZNIE dystraktory (opcje inne niż a[c]) tak, aby:
- każda opcja miała długość zbliżoną do poprawnej (±15% znaków) i ten sam poziom szczegółowości,
- dystraktory były merytorycznie błędne, ale prawdopodobne i równoległe gramatycznie,
- treść pytania, poprawna odpowiedź (tekst a[c]), indeks c i wyjaśnienie e pozostały bez zmian.
Zwróć tę samą listę pytań, w tej samej kolejności, ze zmienionymi tylko dystraktorami.`;
