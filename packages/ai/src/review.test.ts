import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { REVIEW_QUESTIONS_PROMPT, TopicContentSchema } from "@nauka/shared";
import { applyReview, reviewLevel, sameCorrectAnswer, REVIEW_MAX_TOKENS, type ReviewOutput } from "./review.js";
import { generateTopic } from "./generate.js";
import { setClientForTests } from "./client.js";

// ---------- fixtures (the cases testers reported) ----------

const IPA_Q = { q: "W którym wyrazie g brzmi jak chrapliwe /x/?", a: ["gente", "gato", "gorro", "lago"], c: 0, e: "Przed e oraz i g to /x/.", src_page: 2, src_quote: "g se pronuncia /x/ en ge, gi" };
const GOOD_Q = { q: "Co znaczy „encantado”?", a: ["miło mi", "do jutra", "dzięki", "na razie"], c: 0, e: "Encantado mówisz przy poznaniu kogoś: miło mi.", src_page: 3, src_quote: "" };
const FIXED_IPA = { keep: false, drop: false, q: "W którym słowie g wymawiasz jak polskie „ch”?", a: ["gente", "gato", "gorro", "lago"], c: 0, e: "Przed e oraz i hiszpańskie g brzmi jak polskie ch, więc gente czytamy „chente”." };
const KEEP = { keep: true, drop: false, q: "", a: [] as string[], c: 0, e: "" };
const FLAGS_KEEP = { keep_mnemo: true, keep_real: true };

function level() {
  return {
    feed: [
      { title: "Wymowa g", body: "<b>g</b> przed e oraz i czytamy jak polskie <i>ch</i>: gente, girar.<br>W innych miejscach g jest twarde.", real: "Przed e i i g brzmi jak ch.", mnemo: "" },
      {
        title: "Powitania",
        body: "<ul><li>hola</li><li>encantado</li><li>adiós</li></ul>",
        real: "Natalia 20 i turystyka, Chen 23 i filologia, Luiz 27 i taniec — plus kot",
        mnemo: "HOLA = H-imię, O-skąd, L-lubię cię poznać (encantado), A-adiós",
      },
    ],
    flashcards: [{ t: "hola", d: "cześć" }],
    quiz: [{ ...IPA_Q, a: [...IPA_Q.a] }, { ...GOOD_Q, a: [...GOOD_Q.a] }],
    games: [],
  };
}

const out = (questions: ReviewOutput["questions"], feed: ReviewOutput["feed"] = [FLAGS_KEEP, FLAGS_KEEP]): ReviewOutput => ({ questions, feed });

// ---------- applyReview (pure) ----------

test("applyReview applies a valid rewrite, keeps src fields and never mutates the input", () => {
  const lv = level();
  const before = JSON.stringify(lv);
  const { level: next, stats } = applyReview(lv, out([FIXED_IPA, KEEP]));
  assert.equal(next.quiz[0]!.q, FIXED_IPA.q);
  assert.equal(next.quiz[0]!.e, FIXED_IPA.e);
  assert.deepEqual(next.quiz[0]!.a, IPA_Q.a);
  assert.equal(next.quiz[0]!.c, 0);
  assert.equal(next.quiz[0]!.src_page, 2, "src fields survive the rewrite");
  assert.equal(next.quiz[0]!.src_quote, IPA_Q.src_quote);
  assert.equal(next.quiz[1], lv.quiz[1], "kept question is the same object");
  assert.equal(next.flashcards, lv.flashcards, "other level fields untouched");
  assert.deepEqual(stats, { questionsRewritten: 1, questionsDropped: 0, rewritesRejected: 0, mnemoCleared: 0, realCleared: 0, vizCleared: 0, tasksDropped: 0 });
  assert.equal(JSON.stringify(lv), before);
});

test("applyReview lets the review fix length bias by rewriting distractors", () => {
  const lv = level();
  lv.quiz[1] = { ...GOOD_Q, a: ["miło mi cię poznać, gdy kogoś poznajesz", "do jutra", "dzięki", "na razie"] };
  const fix = { keep: false, drop: false, q: GOOD_Q.q, a: ["miło mi cię poznać, gdy kogoś poznajesz", "do zobaczenia jutro, gdy się żegnasz", "dziękuję bardzo, gdy ktoś ci pomoże", "przepraszam, gdy na kogoś wpadniesz"], c: 0, e: GOOD_Q.e };
  const { level: next, stats } = applyReview(lv, out([KEEP, fix]));
  assert.deepEqual(next.quiz[1]!.a, fix.a);
  assert.equal(stats.questionsRewritten, 1);
});

test("applyReview falls back to the original question on every shape / meaning violation", () => {
  const bad: [string, ReviewOutput["questions"][number]][] = [
    ["c changed", { ...FIXED_IPA, a: ["gato", "gente", "gorro", "lago"], c: 1 }],
    ["c not an integer", { ...FIXED_IPA, c: 0.5 }],
    ["c out of range", { ...FIXED_IPA, c: 7 }],
    ["3 answers", { ...FIXED_IPA, a: ["gente", "gato", "gorro"] }],
    ["5 answers", { ...FIXED_IPA, a: ["gente", "gato", "gorro", "lago", "gol"] }],
    ["correct answer replaced", { ...FIXED_IPA, a: ["girar", "gato", "gorro", "lago"] }],
    ["duplicate answers", { ...FIXED_IPA, a: ["gente", "gato", "Gato", "lago"] }],
    ["empty answer", { ...FIXED_IPA, a: ["gente", "gato", " ", "lago"] }],
    ["empty explanation", { ...FIXED_IPA, e: "  " }],
    ["empty question", { ...FIXED_IPA, q: "" }],
    ["question too long", { ...FIXED_IPA, q: "x".repeat(1001) }],
    ["new length bias", { ...FIXED_IPA, a: ["gente", "ga", "go", "la"] }],
  ];
  for (const [name, cand] of bad) {
    const lv = level();
    const { level: next, stats } = applyReview(lv, out([cand, KEEP]));
    assert.equal(next.quiz[0], lv.quiz[0], `${name}: original kept`);
    assert.equal(stats.questionsRewritten, 0, name);
    assert.equal(stats.rewritesRejected, 1, name);
  }
});

test("applyReview keeps every question when the model changes the array length", () => {
  const lv = level();
  const { level: next, stats } = applyReview(lv, out([FIXED_IPA]));
  assert.deepEqual(next.quiz, lv.quiz);
  assert.equal(stats.questionsRewritten, 0);
  assert.equal(stats.rewritesRejected, 1);
});

test("applyReview: a 'rewrite' identical to the original is not counted", () => {
  const lv = level();
  const { level: next, stats } = applyReview(lv, out([{ keep: false, drop: false, ...IPA_Q }, KEEP]));
  assert.equal(next, lv);
  assert.equal(stats.questionsRewritten, 0);
  assert.equal(stats.rewritesRejected, 0);
});

test("sameCorrectAnswer: shortening and notation removal pass, other facts fail", () => {
  assert.ok(sameCorrectAnswer("gente", " Gente. "));
  assert.ok(sameCorrectAnswer("jak /x/", "jak polskie ch"));
  assert.ok(sameCorrectAnswer("g przed e oraz i czytamy /x/", "g przed e oraz i czytamy jak polskie ch"));
  assert.ok(sameCorrectAnswer("Bo enzymy obniżają energię aktywacji reakcji chemicznej", "Obniżają energię aktywacji reakcji"));
  assert.ok(!sameCorrectAnswer("gente", "gato"));
  assert.ok(!sameCorrectAnswer("w 1918 roku", "w 1920 roku"));
  assert.ok(!sameCorrectAnswer("mitochondrium", "chloroplast"));
  assert.ok(!sameCorrectAnswer("/x/", "jak polskie ch"), "nothing left to compare → not provably the same");
  // look-alike swaps that change the fact or the grammar form
  const swaps: [string, string][] = [
    ["hablo", "habla"],
    ["es", "está"],
    ["esta", "está"],
    ["soy", "son"],
    ["prokarioty", "eukarioty"],
    ["Present Perfect", "Past Perfect"],
    ["Byłem w kinie", "Byłam w kinie"],
    ["Rośliny wytwarzają tlen", "Rośliny wytwarzają azot"],
    ["Nie zmienia się wcale", "Zmienia się wcale"],
    ["Tylko w komórkach roślinnych", "W komórkach roślinnych"],
    ["Mitochondrium w komórce zwierzęcej", "komórce"],
  ];
  for (const [a, b] of swaps) assert.ok(!sameCorrectAnswer(a, b), `${a} → ${b}`);
});

test("applyReview rejects a rewrite that flips the question while c stays", () => {
  const orig = { q: "Które słowo NIE jest powitaniem?", a: ["adiós", "hola", "buenos días", "buenas"], c: 0, e: "Adiós to pożegnanie." };
  const feed = level().feed;
  const flipped = { keep: false, drop: false, q: "Które słowo jest powitaniem?", a: orig.a, c: 0, e: "Hola to powitanie." };
  const r1 = applyReview({ feed, quiz: [orig] }, out([flipped]));
  assert.equal(r1.level.quiz[0], orig);
  assert.equal(r1.stats.rewritesRejected, 1);
  // lower-case "nie" → "NIE" keeps the meaning and passes
  const lower = { ...orig, q: "Które słowo nie jest powitaniem?" };
  assert.equal(applyReview({ feed, quiz: [lower] }, out([{ keep: false, drop: false, ...orig }])).stats.questionsRewritten, 1);
  // removing a double negation keeps the parity and passes
  const dbl = { q: "Które zdanie nie jest nieprawdziwe?", a: ["Hola to powitanie", "Adiós to powitanie", "Chao to powitanie", "Gracias to powitanie"], c: 0, e: "Hola służy do witania się." };
  const fixedDbl = { keep: false, drop: false, q: "Które zdanie jest prawdziwe?", a: dbl.a, c: 0, e: dbl.e };
  assert.equal(applyReview({ feed, quiz: [dbl] }, out([fixedDbl])).stats.questionsRewritten, 1);
  // "fałszywe" → "prawdziwe" flips it
  const neg = { ...dbl, q: "Które zdanie jest fałszywe?", c: 1 };
  assert.equal(applyReview({ feed, quiz: [neg] }, out([{ ...fixedDbl, c: 1 }])).stats.rewritesRejected, 1);
});

test("applyReview survives an original question whose c is out of range", () => {
  const broken = { q: "Co znaczy hola?", a: ["cześć", "pa", "dzięki", "proszę"], c: 4, e: "Hola = cześć." };
  const lv = { feed: level().feed, quiz: [broken, { ...GOOD_Q, a: [...GOOD_Q.a] }] };
  const { level: next, stats } = applyReview(lv, out([{ keep: false, drop: false, q: "Co znaczy „hola”?", a: broken.a, c: 4, e: "Hola to cześć." }, KEEP]));
  assert.equal(next.quiz[0], broken);
  assert.equal(stats.rewritesRejected, 1);
});

test("applyReview clears forced mnemo and trivia real only where flagged", () => {
  const lv = level();
  const { level: next, stats } = applyReview(lv, out([KEEP, KEEP], [{ keep_mnemo: false, keep_real: true }, { keep_mnemo: false, keep_real: false }]));
  assert.deepEqual(next.feed[0], lv.feed[0], "empty mnemo flagged false is not counted / changed");
  assert.equal(next.feed[1]!.mnemo, "");
  assert.equal(next.feed[1]!.real, "");
  assert.equal(next.feed[1]!.body, lv.feed[1]!.body);
  assert.deepEqual(next.quiz, lv.quiz);
  assert.deepEqual(stats, { questionsRewritten: 0, questionsDropped: 0, rewritesRejected: 0, mnemoCleared: 1, realCleared: 1, vizCleared: 0, tasksDropped: 0 });
});

test("applyReview ignores feed flags when the feed length differs", () => {
  const lv = level();
  const { level: next, stats } = applyReview(lv, out([KEEP, KEEP], [{ keep_mnemo: false, keep_real: false }]));
  assert.equal(next, lv);
  assert.equal(stats.mnemoCleared, 0);
});

// ---------- reviewLevel (mocked client, no network) ----------

type StreamCall = { params: Anthropic.Beta.MessageCreateParams; options?: { signal?: AbortSignal; maxRetries?: number } };

function message(parsed: unknown, extra: Record<string, unknown> = {}) {
  return {
    id: "msg_review",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(parsed) }],
    usage: { input_tokens: 1200, output_tokens: 300 },
    parsed_output: parsed,
    ...extra,
  };
}

function reviewClient(finalMessage: (call: StreamCall) => Promise<unknown>) {
  const calls: StreamCall[] = [];
  const client = {
    beta: {
      messages: {
        stream(params: Anthropic.Beta.MessageCreateParams, options?: StreamCall["options"]) {
          const call = { params, options };
          calls.push(call);
          return { finalMessage: () => finalMessage(call) };
        },
      },
    },
  };
  return { client: client as unknown as Anthropic, calls };
}

afterEach(() => {
  delete process.env.RECALL_AI_FIX_MODEL;
  delete process.env.ANTHROPIC_API_KEY;
  setClientForTests(null);
});

test("reviewLevel sends one cheap structured call with plain feed text and applies the answer", async () => {
  const lv = level();
  lv.quiz[1] = { ...GOOD_Q, a: ["miło mi cię poznać, gdy kogoś poznajesz", "do jutra", "dzięki", "na razie"] };
  const m = reviewClient(async () => message(out([FIXED_IPA, KEEP], [FLAGS_KEEP, { keep_mnemo: false, keep_real: false }])));
  const r = await reviewLevel(m.client, lv, { stage: "liceum", lang: true, title: "Wymowa i powitania" });

  assert.equal(m.calls.length, 1);
  const { params, options } = m.calls[0]!;
  assert.equal(params.model, "claude-sonnet-5");
  assert.equal(params.max_tokens, REVIEW_MAX_TOKENS);
  assert.deepEqual(params.thinking, { type: "adaptive" });
  assert.equal(params.output_config?.effort, "low");
  assert.equal(params.output_config?.format?.type, "json_schema");
  assert.equal((params as { fallbacks?: unknown }).fallbacks, undefined, "no unverified server-side fallbacks on the review model");
  assert.equal(params.system, REVIEW_QUESTIONS_PROMPT);
  assert.ok(options?.signal instanceof AbortSignal);
  assert.equal(options?.maxRetries, 1);
  const user = params.messages[0]!.content as string;
  assert.match(user, /Etap ucznia: licealista/);
  assert.match(user, /Temat językowy/);
  assert.match(user, /Poziom: „Wymowa i powitania”/);
  assert.ok(!/<b>|<li>|<br>/.test(user), "feed HTML is flattened to plain text");
  const sent = JSON.parse(user.slice(user.indexOf("{"))) as { feed: { body: string; mnemo: string }[]; questions: { q: string; length_bias: boolean }[] };
  assert.equal(sent.feed.length, 2);
  assert.match(sent.feed[1]!.body, /- hola\n- encantado\n- adiós/);
  assert.match(sent.feed[1]!.mnemo, /^HOLA/);
  assert.deepEqual(sent.questions.map((q) => q.length_bias), [false, true], "length-biased question is flagged for the reviewer");

  assert.equal(r.reviewed, true);
  assert.equal(r.level.quiz[0]!.q, FIXED_IPA.q);
  assert.equal(r.level.feed[1]!.mnemo, "");
  assert.equal(r.level.feed[1]!.real, "");
  assert.deepEqual(r.stats, { questionsRewritten: 1, questionsDropped: 0, rewritesRejected: 0, mnemoCleared: 1, realCleared: 1, vizCleared: 0, tasksDropped: 0 });
  assert.deepEqual(r.usage, { input: 1200, output: 300 });
});

test("reviewLevel honours RECALL_AI_FIX_MODEL and parses JSON from text when parsed_output is missing", async () => {
  process.env.RECALL_AI_FIX_MODEL = "claude-haiku-4-5";
  const m = reviewClient(async () => ({ ...message(null), parsed_output: undefined, content: [{ type: "text", text: `Oto wynik: ${JSON.stringify(out([FIXED_IPA, KEEP]))}` }] }));
  const r = await reviewLevel(m.client, level(), { stage: "podstawowa" });
  assert.equal(m.calls[0]!.params.model, "claude-haiku-4-5");
  assert.equal(r.reviewed, true);
  assert.equal(r.level.quiz[0]!.q, FIXED_IPA.q);
});

test("reviewLevel keeps the original level on API error, refusal, truncation and invalid output", async () => {
  const cases: [string, () => Promise<unknown>, RegExp][] = [
    ["error", async () => { throw new Error("529 overloaded"); }, /overloaded/],
    ["refusal", async () => message(null, { stop_reason: "refusal", content: [] }), /refusal/],
    ["max_tokens", async () => message(out([FIXED_IPA, KEEP]), { stop_reason: "max_tokens" }), /max_tokens/],
    ["invalid", async () => message({ questions: "nope" }), /invalid output/],
    ["garbage text", async () => ({ ...message(null), parsed_output: null, content: [{ type: "text", text: "nie umiem" }] }), /invalid output/],
  ];
  for (const [name, fm, err] of cases) {
    const lv = level();
    const m = reviewClient(fm);
    const r = await reviewLevel(m.client, lv, { stage: "studia" });
    assert.equal(r.level, lv, `${name}: same level object`);
    assert.equal(r.reviewed, false, name);
    assert.match(r.error ?? "", err, name);
    assert.deepEqual(r.stats, { questionsRewritten: 0, questionsDropped: 0, rewritesRejected: 0, mnemoCleared: 0, realCleared: 0, vizCleared: 0, tasksDropped: 0 }, name);
  }
});

test("reviewLevel keeps the original level when a synchronous throw happens in the client", async () => {
  const lv = level();
  const client = { beta: { messages: { stream() { throw new Error("bad params"); } } } } as unknown as Anthropic;
  const r = await reviewLevel(client, lv, { stage: "liceum" });
  assert.equal(r.level, lv);
  assert.match(r.error ?? "", /bad params/);
});

test("reviewLevel times out, aborts the request and keeps the original level", async () => {
  const lv = level();
  let signal: AbortSignal | undefined;
  const m = reviewClient(
    (call) =>
      new Promise((_, reject) => {
        signal = call.options?.signal;
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }),
  );
  const t0 = Date.now();
  const r = await reviewLevel(m.client, lv, { stage: "liceum", timeoutMs: 30 });
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(r.level, lv);
  assert.match(r.error ?? "", /timeout/);
  assert.equal(signal?.aborted, true);
});

test("reviewLevel makes no call when there is nothing to review or no time left", async () => {
  const m = reviewClient(async () => message(out([])));
  const empty = { feed: [{ title: "a", body: "b", real: "", mnemo: "" }], quiz: [] };
  const r1 = await reviewLevel(m.client, empty, { stage: "liceum" });
  assert.equal(r1.error, "nothing to review");
  const r2 = await reviewLevel(m.client, level(), { stage: "liceum", timeoutMs: 0 });
  assert.equal(r2.error, "no time left");
  assert.equal(m.calls.length, 0);
});

// ---------- generateTopic end to end (mocked client) ----------

test("generateTopic runs one review per level in parallel, applies it, and survives a failed review", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
  let inFlight = 0;
  let maxInFlight = 0;
  const reviewCalls: string[] = [];
  const outline = {
    name: "Hiszpański od zera",
    short: "Hiszpański",
    emoji: "🇪🇸",
    tagline: "Pierwsze kroki",
    category: "inny-język",
    info_html: "",
    levels: [
      { title: "Wymowa", emoji: "🗣️", summary: "g i j", scope: "- g przed e/i" },
      { title: "Powitania", emoji: "👋", summary: "hola", scope: "- hola, adiós" },
    ],
  };
  const client = {
    beta: {
      messages: {
        stream(params: Anthropic.Beta.MessageCreateParams) {
          const format = params.output_config?.format as { schema?: { properties?: Record<string, unknown> } } | undefined;
          const props = Object.keys(format?.schema?.properties ?? {});
          const user = JSON.stringify(params.messages);
          return {
            async finalMessage() {
              if (props.includes("questions")) {
                const second = user.includes("Poziom: „Powitania”");
                reviewCalls.push(second ? "Powitania" : "Wymowa");
                inFlight++;
                maxInFlight = Math.max(maxInFlight, inFlight);
                await new Promise((r) => setTimeout(r, 20));
                inFlight--;
                if (second) throw new Error("overloaded");
                return message(out([FIXED_IPA, KEEP], [FLAGS_KEEP, { keep_mnemo: false, keep_real: true }]), { usage: { input_tokens: 10, output_tokens: 5 } });
              }
              const parsed = props.includes("info_html") ? outline : props.includes("feed") ? level() : { tasks: [] };
              return message(parsed, { model: "claude-opus-5", usage: { input_tokens: 100, output_tokens: 50 } });
            },
          };
        },
      },
    },
  };
  setClientForTests(client as unknown as Anthropic);
  const warns: string[] = [];
  const origWarn = console.warn;
  console.warn = (...a: unknown[]) => void warns.push(a.join(" "));
  try {
    const r = await generateTopic({ materials: [], options: { stage: "liceum", mode: "prompt", hint: "hiszpański A1", levels: 2, lang: true } });
    assert.ok(TopicContentSchema.safeParse(r.content).success);
    assert.deepEqual(reviewCalls.sort(), ["Powitania", "Wymowa"]);
    assert.equal(maxInFlight, 2, "reviews run in parallel");

    const [l1, l2] = r.content.levels;
    const q1 = l1!.quiz.find((q) => q.q === FIXED_IPA.q);
    assert.ok(q1, "rewritten question reaches the content");
    assert.equal(q1!.a[q1!.c], "gente", "correct answer intact after the shuffle in finalize");
    assert.ok(!l1!.quiz.some((q) => q.q.includes("/x/")));
    assert.equal(l1!.feed[1]!.mnemo, undefined, "cleared mnemo is dropped by finalize");
    assert.equal(l1!.feed[1]!.real, level().feed[1]!.real);

    assert.ok(l2!.quiz.some((q) => q.q === IPA_Q.q), "failed review keeps the original level");
    assert.equal(l2!.feed[1]!.mnemo, level().feed[1]!.mnemo);

    assert.equal(r.quality.levelsReviewed, 1);
    assert.equal(r.quality.reviewFailed, 1);
    assert.equal(r.quality.levelsFixed, 1);
    assert.equal(r.quality.questionsRewritten, 1);
    assert.equal(r.quality.rewritesRejected, 0);
    assert.equal(r.quality.mnemoCleared, 1);
    assert.equal(r.quality.realCleared, 0);
    // 1 outline + 2 × (core + tasks) main calls, + 1 successful review
    assert.deepEqual(r.usage, { input: 5 * 100 + 10, output: 5 * 50 + 5 });
    assert.equal(r.model, "claude-opus-5");
    assert.ok(warns.some((w) => /poziom 2: overloaded/.test(w)), "failed review is logged");
  } finally {
    console.warn = origWarn;
  }
});

// ---------- drop verdict (trivia that cannot be reworded with the same answer) ----------

test("applyReview drops trivia questions on the reviewer's verdict but never below MIN_QUIZ", () => {
  const trivia = { q: "Ile lat ma Chen z dialogu?", a: ["23", "20", "27", "30"], c: 0, e: "Chen ma 23 lata.", src_page: 1, src_quote: "" };
  const DROP = { keep: false, drop: true, q: "", a: [] as string[], c: 0, e: "" };
  const lv = level();
  lv.quiz = [trivia, GOOD_Q, GOOD_Q, GOOD_Q, GOOD_Q, GOOD_Q, trivia].map((q) => ({ ...q, a: [...q.a] }));
  const { level: next, stats } = applyReview(lv, out([DROP, KEEP, KEEP, KEEP, KEEP, KEEP, DROP]));
  assert.equal(next.quiz.length, 5, "two trivia questions removed (7 → 5)");
  assert.ok(next.quiz.every((q) => q.q === GOOD_Q.q));
  assert.equal(stats.questionsDropped, 2);
  assert.equal(lv.quiz.length, 7, "input not mutated");

  const six = { ...lv, quiz: lv.quiz.slice(0, 6) };
  const r6 = applyReview(six, out([DROP, DROP, KEEP, KEEP, KEEP, KEEP]));
  assert.equal(r6.level.quiz.length, 5, "only one drop fits over the floor of 5");
  assert.equal(r6.level.quiz[0]!.q, GOOD_Q.q, "first drop applied");
  assert.equal(r6.stats.questionsDropped, 1);

  const five = { ...lv, quiz: lv.quiz.slice(1, 6) };
  const r5 = applyReview(five, out([DROP, KEEP, KEEP, KEEP, KEEP]));
  assert.equal(r5.level, five, "at the floor nothing is dropped and the level is unchanged");
  assert.equal(r5.stats.questionsDropped, 0);

  const wrongLen = applyReview(lv, out([DROP, KEEP]));
  assert.equal(wrongLen.level.quiz.length, 7, "drop ignored when the output has a different number of questions");
});
