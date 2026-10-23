import type { Stage } from "./types.js";

/**
 * Post-generation question review (one cheap call per level, run by @nauka/ai after the levels are generated).
 * Input: the level's feed (plain text) + quiz; output: per-question keep/rewrite and per-dose keep flags for
 * `mnemo` / `real`. The hard constraints (same shape, same `c`, same meaning of the correct answer, `e` present)
 * are enforced in code by `applyReview()` in packages/ai — the prompt only asks for them.
 */
export const REVIEW_QUESTIONS_PROMPT = `Jesteś redaktorem jakości w aplikacji do nauki Recall. Dostajesz JSON jednego poziomu lekcji: etap ucznia, dawki wiedzy (feed: title, body, real, mnemo), pytania quizowe (questions: q, a[], c, e oraz flagi length_bias, weak_e, answer_hint, same_options) i zadania (tasks). Uczeń najpierw czyta dawki, potem odpowiada na pytania i robi zadania. Oceń każde pytanie, zadanie i dawkę według kryteriów poniżej. Dobre rzeczy zostawiasz, złe poprawiasz.

KRYTERIA PYTANIA
1. Zrozumiałe dla ucznia z podanego etapu, który przeczytał dawki: jednoznaczne polecenie, bez żargonu, którego dawki nie wyjaśniają.
2. Bez niewyjaśnionej notacji specjalistycznej. Zapis fonetyczny (IPA, np. /x/, /θ/, [ʎ]), symbole i skróty przepisane z materiału zamień na opis zrozumiały dla Polaka, np. /x/ → „jak polskie ch”, /θ/ → „jak angielskie th w think”. Notację zostaw tylko wtedy, gdy dawki ją wprost objaśniają.
3. Sprawdza sedno poziomu (pojęcie, regułę, słówko, zależność), a nie ciekawostki z przykładów: imiona, wiek, zawody czy hobby postaci z przykładowego dialogu, przypadkowe liczby, kolejność akapitów. Takie pytanie przeformułuj tak, żeby pytało o regułę albo słownictwo, które przykład ilustruje, przy tej samej poprawnej odpowiedzi. Jeśli się nie da, usuń je (drop: true).
4. Bez podchwytliwych sformułowań: żadnych podwójnych przeczeń, pułapek słownych ani pytań o drobny szczegół sformułowania zamiast o sens. Pytanie z „NIE” tylko wtedy, gdy to słowo jest wyraźnie zaznaczone wielkimi literami.
5. Dokładnie jedna poprawna odpowiedź: a[c]. Żaden dystraktor nie może być również poprawny ani poprawny „zależnie od interpretacji”.
6. Dystraktory prawdopodobne (typowe błędy ucznia, ta sama kategoria), równie konkretne i równoległe gramatycznie. Wszystkie opcje mają podobną długość (różnica do ok. 20% znaków), a poprawna nie wyróżnia się długością ani precyzją. length_bias = true oznacza, że poprawna odpowiedź już się wyróżnia długością — wyrównaj to, najlepiej przepisując dystraktory. Zakazane: „wszystkie powyższe”, „żadne z powyższych”, opcje absurdalne.
7. Wyjaśnienie e: 1–2 zdania, mówi, DLACZEGO a[c] jest poprawne — podaje powód albo regułę z dawek, której nie widać w samej odpowiedzi (najlepiej też, dlaczego najbardziej kusząca błędna opcja jest zła); bez notacji z punktu 2. Nie może tylko powtarzać odpowiedzi ani pytania i nigdy nie odwołuje się do litery ani pozycji opcji (kolejność opcji jest losowana). weak_e = true oznacza, że e prawdopodobnie tego nie robi — napisz nowe e (q i opcje mogą zostać bez zmian).
8. Ton rzeczowy i ciepły, bez slangu i młodzieżowych zwrotów, bez emoji. Bez zwrotów „według materiału”, „materiał podaje”.
9. Odpowiedź wynika z dawek tego poziomu: uczeń, który uważnie przeczytał dawki, zna poprawną odpowiedź. Pytanie o coś, czego dawki nie uczą, przeformułuj na to, czego uczą (przy tej samej poprawnej odpowiedzi), a jeśli się nie da — usuń (drop: true).
10. Nic poza wiedzą nie zdradza odpowiedzi: pytanie nie zawiera słowa ani rdzenia poprawnej odpowiedzi, którego nie mają dystraktory (answer_hint = true — przeformułuj pytanie albo dystraktory); wszystkie opcje są z tej samej kategorii co pytanie (pytasz o fazę → same fazy); opcje nie różnią się wyłącznie wielką literą ani interpunkcją (same_options = true — popraw dystraktor tak, by różnił się treścią).

JAK ODPOWIADAĆ
- Pytanie spełnia kryteria → keep: true, drop: false, q: "", a: [], e: "", c przepisane bez zmian.
- Pytanie łamie którekolwiek kryterium → keep: false, drop: false i całe poprawione pytanie: q, wszystkie opcje a (tyle samo co w oryginale), c, e.
- Pytanie o ciekawostkę z przykładu, którego nie da się poprawić przy tej samej poprawnej odpowiedzi, albo pytanie bez jednej poprawnej odpowiedzi → keep: false, drop: true, pozostałe pola puste (q: "", a: [], e: "", c przepisane). Usuwaj najwyżej 3 pytania na poziom; dobre pytania zostają.
- Poprawna odpowiedź zostaje na tej samej pozycji (c bez zmian) i zachowuje sens. Jej tekst zmieniaj tylko wtedy, gdy zawiera niewyjaśnioną notację albo trzeba go skrócić (wyłącznie usuwając zbędne słowa, bez synonimów). Nie zmieniaj faktów, liczb ani słówek.
- Nie odwracaj pytania („Który NIE…” → „Który…”, „fałszywe” → „prawdziwe”): c się nie zmienia, więc poprawna stałaby się inna opcja.
- Nie dodawaj faktów spoza dawek. Poprawiaj minimalnie i nie przepisuj dobrych pytań dla samego stylu.
- Pisz w języku oryginału (zwykle po polsku); słówka i zdania w języku obcym zostaw w tym języku.
- questions ma tyle elementów co na wejściu, w tej samej kolejności.

ZADANIA (tasks)
Dla każdego zadania zwróć tylko keep (true/false) — zadań nie przepisujesz; tasks ma tyle elementów co na wejściu, w tej samej kolejności. keep = false, gdy zadanie:
- sprawdza coś, czego dawki tego poziomu nie uczą (fakt, nazwisko, przykład, mechanizm spoza dawek);
- ma więcej niż jedną obronioną odpowiedź albo błąd merytoryczny;
- da się rozwiązać bez wiedzy: etykiety, numery, podpisy (sub) albo forma gramatyczna zdradzają odpowiedź, dystraktory są absurdalne albo z innej kategorii;
- jest samą ciekawostką (same daty, nazwiska, liczby z przykładów) albo powtarza fakt, który już sprawdza pytanie quizu.
Dobre zadanie zostaje (true). Lepiej mniej zadań niż zadanie błędne.

MNEMOTECHNIKI I „PO LUDZKU” (feed)
Dla każdej dawki zwróć keep_mnemo i keep_real — feed ma tyle elementów co na wejściu, w tej samej kolejności.
- keep_mnemo = false, gdy mnemo jest: wymuszonym akronimem albo akrostychem, w którym litery nic nie znaczą; łańcuchem liczb lub imion z przykładu; skojarzeniem niezwiązanym z sednem dawki; czymś trudniejszym do zapamiętania niż sama treść; błędem merytorycznym. Trafna mnemotechnika zostaje (true). Pusty mnemo → true.
- keep_real = false, gdy real: streszcza ciekawostki z przykładu (imiona, wiek, hobby postaci, przypadkowe liczby) zamiast sedna dawki; jest sprzeczne z body (np. „każdy”, gdy body podaje wyjątek); dodaje fakty, których nie ma w dawce; prawie dosłownie powtarza zdanie z body; jest mętne albo mylące. Pusty real → true.
- Lepiej brak mnemotechniki niż mnemotechnika wymuszona.

PRZYKŁADY
1) Hiszpański dla początkujących, dawka: „g przed e oraz i czytamy jak polskie ch: gente, girar”.
Źle: {"q": "W którym wyrazie g brzmi jak chrapliwe /x/?", "a": ["gente", "gato", "gorro", "lago"], "c": 0, "e": "Przed e oraz i g to /x/."}
Dobrze: {"keep": false, "q": "W którym słowie g wymawiasz jak polskie „ch”?", "a": ["gente", "gato", "gorro", "lago"], "c": 0, "e": "Przed e oraz i hiszpańskie g brzmi jak polskie ch, więc gente czytamy „chente”."}
2) Dawka o powitaniach: hola, encantado, adiós.
Źle: mnemo „HOLA = H-imię, O-skąd, L-lubię cię poznać (encantado), A-adiós” — litery nic nie znaczą, skojarzenia są naciągane, a całość trudniej zapamiętać niż trzy słówka.
Dobrze: keep_mnemo = false.`;

/**
 * Appended to REVIEW_QUESTIONS_PROMPT only in viz mode (`options.viz`): the reviewer also judges each dose's visual
 * and answers `keep_viz` per dose. Without viz mode the review prompt and output grammar are unchanged.
 */
export const REVIEW_VIZ_RULES = `WIZUALIZACJE (feed[].viz)
Niektóre dawki mają pole viz: wizualizację pokazywaną pod tekstem dawki (type: timeline, compare, cycle, flow, tree, bars, numbers). Dla każdej dawki zwróć też keep_viz.
- keep_viz = false, gdy wizualizacja: zawiera fakt, nazwę, datę lub liczbę, której nie ma w dawkach; jest sprzeczna z body; nic nie wnosi (ozdobnik, powtórzenie jednego zdania); ma zły typ do treści (np. cycle dla zwykłej listy, timeline bez kolejności w czasie); jest nieczytelna albo myląca.
- Trafna wizualizacja zostaje (true). Dawka bez viz → true.
- Lepiej brak wizualizacji niż wizualizacja błędna.`;

const REVIEW_STAGE: Record<Stage, string> = {
  podstawowa: "uczeń klas 4–8 szkoły podstawowej",
  liceum: "licealista / uczeń technikum",
  studia: "student",
  inne: "dorosły uczący się samodzielnie",
};

export interface ReviewPromptInput {
  stage: Stage;
  /** language-learning topic */
  lang?: boolean;
  /** level title (what the level is about) */
  title?: string;
  feed: { title: string; body: string; real: string; mnemo: string; viz_type?: string; viz?: string }[];
  /**
   * Flags computed in code: `length_bias` = the correct option stands out by length; `weak_e` = the explanation only
   * restates the answer / refers to an option letter; `answer_hint` = the question shares a word with the correct
   * answer only; `same_options` = two options differ only by case or punctuation.
   */
  questions: { q: string; a: string[]; c: number; e: string; length_bias: boolean; weak_e?: boolean; answer_hint?: boolean; same_options?: boolean }[];
  /** the level's tasks (keep/drop verdict only): compact view with the type's non-empty fields */
  tasks?: Record<string, unknown>[];
  /** viz mode: doses with a visual get a `viz` field (the visual as JSON with its `type`) */
  viz?: boolean;
}

/** The dose's visual as the reviewer sees it: `{type, ...fields}`, or the raw string when it is not a JSON object; null = none. */
function reviewViz(type: string | undefined, raw: string | undefined): unknown {
  if (!type || type === "none") return null;
  try {
    const v = JSON.parse(raw ?? "");
    if (v && typeof v === "object" && !Array.isArray(v)) return { ...(v as object), type };
  } catch {
    /* fall through */
  }
  return { type, raw: (raw ?? "").slice(0, 2000) };
}

/** Feed bodies may hold simple HTML (b, i, br, ul/li) — the reviewer gets plain text. Also used by viz grounding. */
export function plainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/**
 * A generated task as the reviewer sees it: type, title, e and the type's non-empty payload fields (empty strings and
 * arrays of the flat shape, source fields, the key-point tag `p` and unused zero indexes left out). The review only
 * keeps or drops tasks, so the tag travels with the kept task untouched (`applyReview()` filters the original objects).
 */
export function taskForReview(t: Record<string, unknown> & { type: string }): Record<string, unknown> {
  // numeric fields that mean something for the type (the flat shape has every field, unused ones are 0)
  const numeric: Record<string, string[]> = { scenario: ["c"], thesis: ["c"], finderror: ["wrong"], tf: ["seconds"] };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(t)) {
    if (k === "src_page" || k === "src_quote" || k === "p") continue;
    if (typeof v === "number") {
      if ((numeric[t.type] ?? []).includes(k) && (k !== "seconds" || v > 0)) out[k] = v;
      continue;
    }
    if ((typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length) || v == null) continue;
    if (k === "given" && t.type !== "chain") continue;
    out[k] = v;
  }
  return out;
}

/** User message for the review call: short context lines + the level as JSON. */
export function buildReviewUserPrompt(input: ReviewPromptInput): string {
  const data = {
    feed: input.feed.map((f) => {
      const dose: Record<string, unknown> = { title: plainText(f.title), body: plainText(f.body), real: plainText(f.real), mnemo: plainText(f.mnemo) };
      const viz = input.viz === true ? reviewViz(f.viz_type, f.viz) : null;
      if (viz) dose.viz = viz;
      return dose;
    }),
    questions: input.questions.map((q) => ({ q: q.q, a: q.a, c: q.c, e: q.e, length_bias: q.length_bias, weak_e: !!q.weak_e, answer_hint: !!q.answer_hint, same_options: !!q.same_options })),
    tasks: input.tasks ?? [],
  };
  return [
    `Etap ucznia: ${REVIEW_STAGE[input.stage]}.`,
    input.lang ? "Temat językowy (nauka języka obcego): uczeń nie zna zapisu fonetycznego (IPA), chyba że dawki go uczą." : "",
    input.title ? `Poziom: „${input.title}”.` : "",
    "Poziom do sprawdzenia (JSON):",
    JSON.stringify(data),
  ]
    .filter(Boolean)
    .join("\n");
}
