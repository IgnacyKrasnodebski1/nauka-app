import type { GenerationOptions, Stage } from "./types.js";

const STAGE_STYLE: Record<Stage, string> = {
  podstawowa:
    "Odbiorca: uczeń klas 4–8 szkoły podstawowej. Proste zdania, konkretne przykłady z życia, dużo obrazowych porównań, zero żargonu bez wyjaśnienia. Pytania sprawdzają zrozumienie, nie zapamiętanie definicji.",
  liceum:
    "Odbiorca: licealista / uczeń technikum (matura). Poziom podręcznika, ale luźny, gen-z ton. Pytania w stylu maturalnym (podstawa + trochę rozszerzenia), wyjaśnienia pokazują tok rozumowania.",
  studia:
    "Odbiorca: student. Precyzyjna terminologia, definicje jak na kolokwium/egzaminie, ale tłumaczone 'po ludzku'. Pytania w stylu testu egzaminacyjnego z podchwytliwymi dystraktorami.",
  inne: "Odbiorca: dorosły uczący się samodzielnie (kurs, certyfikat, hobby). Praktyczne, konkretne, bez lania wody.",
};

const COMMON_RULES = `STRUKTURA
- Podziel temat na poziomy (levels) w logicznej kolejności nauki: od podstaw do rzeczy trudniejszych. Każdy poziom = spójny podtemat.
- Każdy poziom ma: feed (4–6 mikro-dawek wiedzy), flashcards (6–10), quiz (6–10 pytań, 4 odpowiedzi), games (2 mini-gry różnych typów), tasks (4–6 zadań RÓŻNYCH typów).
- feed.body może zawierać prosty HTML: <b>, <i>, <br>, <ul><li>. feed.real = to samo 'po ludzku' w 1 zdaniu. feed.mnemo = mnemotechnika albo pusty string.
- Mini-gry: "match" (pary termin↔znaczenie, 4–8 par), "cloze" (zdanie z luką ___ + 3–4 opcje), "truefalse" (5–10 zdań prawda/fałsz z wyjaśnieniem), "order" (ułóż kroki/etapy w kolejności, 3–6 kroków). W obiekcie gry wypełnij TYLKO pola swojego typu; pozostałe tablice zostaw puste, a nieużywane stringi puste.
- ZADANIA (tasks): 4–6 na poziom, każde innego typu, dobrane do treści (historia → timeline/chain/thesis, nauki ścisłe → fill/typeterm/finderror/sort, języki → swipe/fill/match). Obiekt zadania: {type, title, e, payload, src_page, src_quote}, gdzie "payload" to STRING z JSON-em zawierającym pola danego typu (nazwy pól jak niżej), a "e" = wyjaśnienie do panelu wyniku (1–2 zdania). Typy i pola payload:
  · "tf": statements 5–8 × {s, v, e}; seconds = 0 albo 45–60 (runda na czas — tylko gdy zdania są krótkie).
  · "fill": text ze znacznikami {0}, {1}… (1–3 luki), blanks[i] = słowo do luki {i}, bank = 2–4 dystraktory (prawdopodobne, tej samej kategorii), hint = krótka podpowiedź.
  · "typeterm": definition (1–2 zdania, bez podawania nazwy), answer = pojęcie (1–3 słowa), accept = warianty/synonimy.
  · "swipe": left / right = nazwy dwóch kategorii, cards 6–10 × {front, sub, side:"left"|"right", e}.
  · "thesis": thesis = cytat/pogląd, options 3–4 × {name, sub} (autor/szkoła/epoka), c = indeks poprawnej.
  · "scenario": scene = konkretna sytuacja (2–3 zdania), q = pytanie, a = 4 odpowiedzi, c = indeks poprawnej.
  · "finderror": sentences 3–5 zdań, z których DOKŁADNIE jedno jest fałszywe (subtelnie, jedno słowo/liczba), wrong = jego indeks, fix = poprawne słowo/wartość.
  · "timeline": events 4–6 × {label, year} z różnymi latami.
  · "chain": steps 4–6 w kolejności przyczyna → skutek, given = indeksy 1–2 kroków widocznych od startu (zawsze 0), bank = 2–3 dystraktory.
  · "match": pairs 4–8 × {l, r}. · "order": items 4–6 w POPRAWNEJ kolejności. · "sort": buckets 2–3 × {name, items 3–5}, elementy jednoznaczne.
  Zasady anty-zgadywania obowiązują też w zadaniach: dystraktory (bank, options, a, fałszywe zdania) są równie konkretne i podobnej długości jak poprawne; w "swipe" i "sort" kategorie mają podobną liczbę elementów; w "tf" mniej więcej połowa zdań jest prawdziwa.
- ŹRÓDŁO: gdy uczysz z materiałów, dla każdego pytania i zadania podaj src_page = numer strony/zdjęcia (od 1; 0 gdy nie wiadomo) i src_quote = 1 zdanie z materiału, z którego to powstało (dosłownie, max 200 znaków; "" gdy brak). Bez materiałów: 0 i "".
- Dla tematu językowego: flashcards = słówko → tłumaczenie + przykład, quiz = tłumaczenia/gramatyka, match = słówko↔znaczenie, swipe = np. rodzajnik/czas/rejestr.
- Każde pytanie ma dokładnie jedną poprawną odpowiedź i sensowne, nie-oczywiste dystraktory. Pole "e" (wyjaśnienie) zawsze tłumaczy DLACZEGO odpowiedź jest poprawna, w 1–2 zdaniach.
- ANTY-ZGADYWANIE (ważne): wszystkie opcje odpowiedzi mają PODOBNĄ DŁUGOŚĆ (różnica max ±20% znaków) i ten sam poziom szczegółowości. Poprawna odpowiedź NIE może być najdłuższa, najbardziej precyzyjna ani najbardziej „podręcznikowa” — dystraktory muszą być równie konkretne, prawdopodobne i gramatycznie równoległe. Zakazane: „wszystkie powyższe”, „żadne z powyższych”, dystraktory absurdalne, dystraktory dużo krótsze od poprawnej. Rozkładaj poprawną odpowiedź losowo między pozycje.
- info_html: 2–4 bloki <div class="zbox"><h3>…</h3><p>…</p></div>: zakres tematu, co najważniejsze na sprawdzian, cheat-sheet.
- name: nazwa tematu (np. "Fotosynteza", "Tryby warunkowe", "Polityka fiskalna"). short: max 12 znaków. emoji: jedno pasujące emoji. category: jedna z: matematyka, fizyka, chemia, biologia, geografia, historia, polski, wos, angielski, inny-język, informatyka, ekonomia, prawo, psychologia, medycyna, technika, inne.

TON
- Język polski (chyba że materiał i prośba są po angielsku), luźny, gen-z, bez cringe'u. Krótkie zdania. Konkret > lanie wody. Treść merytoryczna zawsze poprawna.`;

/**
 * System prompt: raw materials (photos of notes, slides, PDFs, text) → one Recall topic.
 * Stable across requests → cacheable prefix. Volatile stuff goes into the user message.
 */
export const GENERATION_SYSTEM_PROMPT = `Jesteś silnikiem edukacyjnym aplikacji Recall. Dostajesz surowe materiały ucznia (zdjęcia notatek, slajdy, strony podręcznika, PDF, wklejony tekst) i zamieniasz je w jeden kompletny, ustrukturyzowany TEMAT do nauki w stylu Duolingo, wewnątrz przedmiotu ucznia.

ZASADY MERYTORYCZNE
- Ucz WYŁĄCZNIE tego, co jest w materiałach. Możesz dodać krótkie kontekstowe wyjaśnienie, ale nie wymyślaj faktów, dat, nazwisk ani wzorów, których nie ma w źródle.
- Jeśli materiał jest częściowo nieczytelny, pomiń nieczytelne fragmenty — nie zgaduj.
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

export function buildGenerationUserPrompt(opts: GenerationOptions, materialsSummary: string): string {
  const levels = opts.levels ?? 4;
  const mode = opts.mode ?? "materials";
  const parts = [
    STAGE_STYLE[opts.stage],
    opts.subjectName ? `Przedmiot ucznia: ${opts.subjectName}.` : "",
    `Docelowa liczba poziomów: ${levels} (mniej, jeśli materiału jest mało; nigdy nie rozwadniaj).`,
    opts.lang ? "To jest temat językowy (nauka języka obcego)." : "",
    mode === "prompt"
      ? `Temat do opracowania: "${(opts.hint ?? "").replace(/"/g, "'")}".`
      : opts.hint
        ? `Uczeń opisuje materiał tak: "${opts.hint.replace(/"/g, "'")}"`
        : "",
    mode === "materials" ? `Załączone materiały: ${materialsSummary}.` : "",
    "Zwróć kompletny temat zgodnie ze schematem.",
  ].filter(Boolean);
  return parts.join("\n");
}

/** Phase 1 (outline): appended to the user prompt. Output = OutlineSchema. */
export const OUTLINE_INSTRUCTIONS = `FAZA 1 — KONSPEKT. Zwróć TYLKO metadane tematu (name, short, emoji, tagline, category, info_html) i listę poziomów. Dla każdego poziomu: title, emoji, summary (1 zdanie) oraz scope = 3–6 punktów (tekst z myślnikami) mówiących DOKŁADNIE, jakie pojęcia/fakty/umiejętności wchodzą w ten poziom, tak by poziomy się nie powtarzały. Nie generuj feed, fiszek, quizu ani gier.`;

/**
 * Phase 2 (one level): appended to the user prompt. Two calls per level, because the flat task schema makes a single
 * structured-output grammar too large: `part: "core"` → LevelCoreGenSchema (feed, flashcards, quiz, games),
 * `part: "tasks"` → LevelTasksGenSchema (compact tasks with JSON payload). `part: "all"` keeps the single-call wording.
 */
export function levelInstructions(outline: { name: string; levels: { title: string; scope: string }[] }, index: number, part: "core" | "tasks" | "all" = "all"): string {
  const l = outline.levels[index]!;
  const others = outline.levels
    .map((x, i) => `${i + 1}. ${x.title}`)
    .join("; ");
  const ret =
    part === "core"
      ? "Zwróć TYLKO feed, flashcards, quiz i games dla tego poziomu (bez tasks)."
      : part === "tasks"
        ? "Zwróć TYLKO tasks: 4–6 zadań RÓŻNYCH typów dla tego poziomu, każde jako {type, title, e, payload, src_page, src_quote}, gdzie payload to STRING z poprawnym JSON-em pól danego typu."
        : "Zwróć feed, flashcards, quiz, games i tasks (4–6 zadań różnych typów) dla tego poziomu.";
  return `FAZA 2 — JEDEN POZIOM. Temat: „${outline.name}”. Wszystkie poziomy: ${others}.
Generujesz WYŁĄCZNIE poziom ${index + 1}: „${l.title}”.
Zakres tego poziomu:
${l.scope}
Nie wchodź w zakres pozostałych poziomów. ${ret}`;
}

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
