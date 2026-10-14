import { test } from "node:test";
import assert from "node:assert/strict";
import { answerHintInQuestion, resolveOptionLetters, sameOptions, tidyPunctuation, weakExplanation } from "./quiz-quality.js";
import { blankGenTask, convertTask, finalizeGenerated, realRepeatsBody, stripOrderEnumerators } from "./finalize.js";
import { scopeCoverage } from "./coverage.js";
import { GENERATION_SYSTEM_PROMPT, OUTLINE_INSTRUCTIONS, buildGenerationUserPrompt, levelInstructions, maxLevelsFor, VIZ_RULES } from "./prompts.js";
import { buildReviewUserPrompt, REVIEW_QUESTIONS_PROMPT, taskForReview } from "./review.js";
import type { GeneratedTopic } from "./schema.js";

/* ---------- explanations and options (audit: "dumb answers") ---------- */

test("weakExplanation: restating the answer, option letters and very short e are flagged; a real reason is not", () => {
  const q = { q: "Kto ponosi koszt deficytu dziś finansowanego długiem?", a: ["przyszłe pokolenia", "banki centralne", "eksporterzy", "samorządy"], c: 0 };
  assert.equal(weakExplanation({ ...q, e: "Poprawna odpowiedź to B." }), true, "letter reference");
  assert.equal(weakExplanation({ ...q, e: "Przyszłe pokolenia." }), true, "only the answer");
  assert.equal(weakExplanation({ ...q, e: "Koszt ponoszą przyszłe pokolenia, które spłacą dług." }), true, "fewer than 3 new content words");
  assert.equal(
    weakExplanation({ ...q, e: "Politycy zyskują głosy na wydatkach dziś, a rachunek z odsetkami spłacają podatnicy w przyszłości." }),
    false,
  );
  assert.equal(weakExplanation({ ...q, e: "Pierwsza odpowiedź jest dobra, bo dług spłacają kolejne roczniki podatników." }), true, "position reference");
});

test("answerHintInQuestion: a word shared only by the question and the correct answer", () => {
  const q = { q: "Jak nazywa się faza, w której toczą się spory o to, kto za co odpowiada?", a: ["Kryzys odpowiedzialności", "Faza orientacji", "Faza różnicowania", "Faza współpracy"], c: 0 };
  assert.equal(answerHintInQuestion(q), true);
  assert.equal(answerHintInQuestion({ ...q, q: "Jak nazywa się faza sporów o podział obowiązków?" }), false);
  // the word is in every option → no hint
  assert.equal(answerHintInQuestion({ q: "Która faza…?", a: ["Faza kryzysu", "Faza orientacji", "Faza różnicowania"], c: 0 }), false);
});

test("sameOptions: options that differ only by case or punctuation", () => {
  assert.equal(sameOptions({ a: ["Soy polaca.", "Soy Polaca.", "Soy de Polonia.", "Estoy polaca."] }), true);
  assert.equal(sameOptions({ a: ["Soy polaca.", "Soy polaco.", "Es polaca.", "Estoy polaca."] }), false);
});

test("resolveOptionLetters + tidyPunctuation: a letter becomes the option text; '?.' loses the period", () => {
  const a = ["zwiększa ryzyko", "zmniejsza ryzyko", "nie zmienia ryzyka", "przenosi ryzyko"];
  assert.equal(resolveOptionLetters("Odpowiedź B jest błędna, bo pomoc zachęca do ryzyka.", a), "Odpowiedź „zmniejsza ryzyko” jest błędna, bo pomoc zachęca do ryzyka.");
  assert.equal(resolveOptionLetters("A) Gwarancja ratunku zachęca do ryzyka.", a), "„zwiększa ryzyko” — Gwarancja ratunku zachęca do ryzyka.");
  assert.equal(resolveOptionLetters("Witamina A wspiera wzrok.", a), "Witamina A wspiera wzrok.", "a plain letter is not an option reference");
  assert.equal(tidyPunctuation("Pytasz: ¿cómo te llamas?."), "Pytasz: ¿cómo te llamas?");
  assert.equal(tidyPunctuation("Koniec.. I dalej..."), "Koniec. I dalej...");
});

test("finalize: an option letter in e is resolved BEFORE the answers are shuffled", () => {
  const gen: GeneratedTopic = {
    name: "T", short: "T", emoji: "📘", tagline: "", category: "inne", info_html: "",
    levels: [{
      title: "L", emoji: "📘", summary: "",
      feed: [{ title: "D", body: "<b>Pokusa nadużycia</b>: kto wie, że ktoś pokryje straty, ryzykuje bardziej.", real: "Kto ma ubezpieczenie od błędów, mniej uważa?.", mnemo: "" }],
      flashcards: [], games: [],
      quiz: [{ q: "Co robi gwarancja ratunku?", a: ["zwiększa ryzyko", "zmniejsza ryzyko", "nie zmienia ryzyka", "przenosi ryzyko"], c: 0, e: "Odpowiedź A, bo ktoś inny pokrywa straty.", src_page: 0, src_quote: "" }],
    }],
  };
  for (let i = 0; i < 10; i++) {
    const c = finalizeGenerated(gen, "studia");
    const q = c.levels[0]!.quiz[0]!;
    assert.equal(q.e, "Odpowiedź „zwiększa ryzyko”, bo ktoś inny pokrywa straty.");
    assert.equal(q.a[q.c], "zwiększa ryzyko");
    assert.equal(c.levels[0]!.feed[0]!.real, "Kto ma ubezpieczenie od błędów, mniej uważa?");
  }
});

test("realRepeatsBody: a copy of the body is cleared, a real paraphrase is kept", () => {
  const body = "<b>Schemat</b> to uporządkowana wiedza o świecie, która pomaga szybko interpretować nowe informacje.";
  assert.equal(realRepeatsBody("Schemat to uporządkowana wiedza, która pomaga interpretować informacje.", body), true);
  assert.equal(realRepeatsBody("Schemat to gotowa szuflada w głowie, do której wkładasz to, co widzisz.", body), false);
  assert.equal(realRepeatsBody("Schemat porządkuje wiedzę.", body), false, "too short to judge");
});

/* ---------- task giveaways ---------- */

test("order: enumerators that give the order away are stripped; years stay", () => {
  assert.deepEqual(stripOrderEnumerators(["R0 Refuse", "R3 Reuse", "R8 Recycle", "R9 Recover"]), ["Refuse", "Reuse", "Recycle", "Recover"]);
  assert.deepEqual(stripOrderEnumerators(["Etap 1: plan", "Etap 2: wdrożenie", "Etap 3: ocena"]), ["plan", "wdrożenie", "ocena"]);
  assert.deepEqual(stripOrderEnumerators(["1789 zburzenie Bastylii", "1792 republika", "1793 terror"]), ["1789 zburzenie Bastylii", "1792 republika", "1793 terror"]);
  assert.deepEqual(stripOrderEnumerators(["Planowanie", "Etap 2: wdrożenie"]), ["Planowanie", "Etap 2: wdrożenie"], "only when every item is numbered");
  const t = convertTask(blankGenTask({ type: "order", items: ["R0 Refuse", "R3 Reuse", "R8 Recycle"] }));
  assert.ok(t && t.type === "order");
  assert.deepEqual(t.items, ["Refuse", "Reuse", "Recycle"]);
});

test("swipe: a sub naming the category is removed; a card e without a reason is left out", () => {
  const t = convertTask(blankGenTask({
    type: "swipe", left: "Model nordycki", right: "Model liberalny",
    cards: [
      { front: "Szwecja", sub: "model nordycki", side: "left", e: "Model nordycki." },
      { front: "USA", sub: "kraj w Ameryce Północnej", side: "right", e: "Świadczenia są niskie i zależą od testu dochodów, więc rynek gra główną rolę." },
    ],
  }));
  assert.ok(t && t.type === "swipe");
  assert.equal(t.cards[0]!.sub, undefined);
  assert.equal(t.cards[0]!.e, undefined);
  assert.equal(t.cards[1]!.sub, "kraj w Ameryce Północnej");
  assert.ok(t.cards[1]!.e);
});

test("thesis: subs are removed when only the correct one restates the thesis", () => {
  const t = convertTask(blankGenTask({
    type: "thesis", thesis: "Państwo powinno być jak najmniejsze i nie wtrącać się w gospodarkę.",
    options: [{ name: "Neoliberalizm", sub: "małe państwo, deregulacja" }, { name: "Ordoliberalizm", sub: "reguły i konkurencja" }, { name: "Keynesizm", sub: "popyt i interwencja" }],
    c: 0,
  }));
  assert.ok(t && t.type === "thesis");
  assert.ok(t.options.every((o) => o.sub === undefined));
});

test("finderror: a whole corrected sentence fits in fix", () => {
  const fix = "Ordoliberałowie uważali, że państwo ma pilnować reguł konkurencji, a nie kierować gospodarką ani ratować upadających firm.";
  const t = convertTask(blankGenTask({ type: "finderror", sentences: ["a", "b", "c"], wrong: 1, fix: fix + " " + fix }));
  assert.ok(t && t.type === "finderror");
});

/* ---------- coverage ---------- */

test("scopeCoverage: key points missing from the doses or from every question are reported", () => {
  const scope = "- efekt posiadania: bardziej cenimy to, co mamy\n- awersja do straty: strata boli bardziej niż zysk cieszy\n- status quo: zostajemy przy opcji domyślnej";
  const level = {
    feed: [{ title: "Efekt posiadania", body: "<b>Efekt posiadania</b> to…" }, { title: "Awersja do straty", body: "<b>Awersja do straty</b>…" }],
    quiz: [{ q: "Co opisuje efekt posiadania?", a: ["x", "y"], e: "…" }],
    tasks: [],
  };
  const cov = scopeCoverage(scope, level);
  assert.equal(cov.points, 3);
  assert.deepEqual(cov.untaught, ["status quo: zostajemy przy opcji domyślnej"]);
  assert.deepEqual(cov.unchecked, ["awersja do straty: strata boli bardziej niż zysk cieszy", "status quo: zostajemy przy opcji domyślnej"]);
});

/* ---------- prompts ---------- */

test("level count: materials may grow by 2 levels (max 8), a typed topic keeps the count", () => {
  assert.equal(maxLevelsFor({ levels: 4 }), 6);
  assert.equal(maxLevelsFor({}), 6);
  assert.equal(maxLevelsFor({ levels: 8 }), 8);
  assert.equal(maxLevelsFor({ levels: 4, mode: "prompt" }), 4);
  const p = buildGenerationUserPrompt({ stage: "studia", levels: 4 }, "1 PDF; objętość: ok. 60 str. PDF.");
  assert.match(p, /zwykle 4; .*najwyżej 6/);
  assert.match(p, /Załączone materiały: 1 PDF; objętość: ok\. 60 str\. PDF\.$/m, "no double period");
  assert.doesNotMatch(p, /Zwróć kompletny temat/, "the phase prompts say what to return");
  assert.match(buildGenerationUserPrompt({ stage: "studia", mode: "prompt", hint: "x", levels: 3 }, "brak"), /Docelowa liczba poziomów: 3/);
});

test("outline asks for the whole material, its order, and a checklist of key points per level", () => {
  assert.match(OUTLINE_INSTRUCTIONS, /CAŁY materiał/);
  assert.match(OUTLINE_INSTRUCTIONS, /na kolokwium\/egzamin/);
  assert.match(OUTLINE_INSTRUCTIONS, /kolejność i podział materiału/);
  assert.match(OUTLINE_INSTRUCTIONS, /scope = lista punktów kluczowych/);
});

test("level prompts list the other levels with their scope and tie questions to the doses", () => {
  const outline = { name: "Makro", levels: [{ title: "Wstęp", scope: "- trzy sfery\n- instrumenty" }, { title: "Ordoliberalizm", scope: "- zasady Euckena" }] };
  const core = levelInstructions(outline, 0, "core");
  assert.match(core, /2\. Ordoliberalizm \(zasady Euckena\)/);
  assert.doesNotMatch(core, /1\. Wstęp \(/, "own level is not in the 'others' list");
  assert.match(core, /co najmniej jedna dawka, która go wyjaśnia/);
  const tasks = levelInstructions(outline, 0, "tasks");
  assert.match(tasks, /WYŁĄCZNIE punkty zakresu/);
  assert.match(GENERATION_SYSTEM_PROMPT, /WYŁĄCZNIE to, czego uczą dawki/);
  assert.match(GENERATION_SYSTEM_PROMPT, /nigdy nie odwołuj się do litery ani pozycji opcji/);
  assert.match(GENERATION_SYSTEM_PROMPT, /INNYMI słowami niż body/);
  assert.doesNotMatch(GENERATION_SYSTEM_PROMPT, /subtelnie/, "find-the-error is no longer a one-word trap");
  assert.doesNotMatch(VIZ_RULES, /body może pominąć/, "a visual is never the only place of content");
});

test("review prompt: tasks get keep/drop, questions get the new flags and the 'taught in the doses' criterion", () => {
  assert.match(REVIEW_QUESTIONS_PROMPT, /ZADANIA \(tasks\)/);
  assert.match(REVIEW_QUESTIONS_PROMPT, /Odpowiedź wynika z dawek/);
  assert.match(REVIEW_QUESTIONS_PROMPT, /weak_e = true/);
  const t = taskForReview(blankGenTask({ type: "scenario", scene: "S", q: "Q", a: ["a", "b"], c: 0, src_quote: "x" }) as unknown as Record<string, unknown> & { type: string });
  assert.deepEqual(t, { type: "scenario", scene: "S", q: "Q", a: ["a", "b"], c: 0 });
  const user = buildReviewUserPrompt({ stage: "studia", feed: [], questions: [{ q: "q", a: ["a", "b"], c: 0, e: "e", length_bias: false, weak_e: true }], tasks: [t] });
  const data = JSON.parse(user.slice(user.indexOf("{"))) as { questions: { weak_e: boolean; answer_hint: boolean }[]; tasks: unknown[] };
  assert.equal(data.questions[0]!.weak_e, true);
  assert.equal(data.questions[0]!.answer_hint, false);
  assert.equal(data.tasks.length, 1);
});
