import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { finalizeGenerated, finalizeGeneratedWithStats, levelTextForViz, parseViz, vizText } from "./finalize.js";
import { levelInstructions, VIZ_RULES } from "./prompts.js";
import { buildReviewUserPrompt } from "./review.js";
import { FeedItemSchema, GenerationOptionsSchema, LevelCoreGenSchema, LevelCoreGenVizSchema, TopicContentSchema, VizSchema, VIZ_GEN_TYPES, type GeneratedTopic } from "./schema.js";
import { VIZ_TYPES, type Viz } from "./types.js";

// ---------- fixture: one level about the French Revolution (labels come from the doses / flashcards / quiz) ----------

const DOSES = [
  {
    title: "Przyczyny rewolucji",
    body: "<b>Kryzys finansowy</b> i susza w 1788 roku doprowadziły do nieurodzaju, a cena chleba wzrosła o 88%.",
    real: "Głód i długi państwa podgrzały nastroje.",
    mnemo: "",
  },
  {
    title: "Stany Generalne",
    body: "W <b>1789</b> król zwołał Stany Generalne. 14 lipca 1789 lud zdobył Bastylię, a 26 sierpnia 1789 ogłoszono Deklarację praw człowieka.",
    real: "Rok 1789 zmienił Francję.",
    mnemo: "",
  },
  {
    title: "Trzy stany",
    body: "<b>Stan trzeci</b> stanowił 98% ludności, duchowieństwo 0,5%, a szlachta 1,5%. Liczył ok. 25 mln osób.",
    real: "Większość płaciła podatki, mniejszość miała przywileje.",
    mnemo: "",
  },
  {
    title: "Monarchia a republika",
    body: "<b>Monarchia konstytucyjna</b> zostawiała króla z ograniczoną władzą, <b>republika</b> oddała władzę Konwentowi.",
    real: "Najpierw ograniczono króla, potem go obalono.",
    mnemo: "",
  },
];
const CARDS = [
  { t: "Konwent", d: "parlament republiki, wybrany w 1792" },
  { t: "Ancien régime", d: "stary porządek: duchowieństwo, szlachta, mieszczaństwo i chłopi" },
];
const QUIZ = [{ q: "Kto zdobył Bastylię?", a: ["lud Paryża", "armia króla", "szlachta", "duchowni"], c: 0, e: "Bastylię zdobył lud Paryża." }];

const LEVEL_TEXT = levelTextForViz({ feed: DOSES, flashcards: CARDS, quiz: QUIZ });
const ctx = (i: number) => ({ levelText: LEVEL_TEXT, doseText: `${DOSES[i]!.body}\n${DOSES[i]!.real}` });

const GOOD: Record<Viz["type"], { dose: number; raw: unknown }> = {
  timeline: {
    dose: 1,
    raw: { caption: "Rok 1789", items: [{ when: "1789", label: "Zwołanie Stanów Generalnych" }, { when: "14.07.1789", label: "Zdobycie Bastylii" }, { when: "26 sierpnia 1789", label: "Deklaracja praw człowieka" }] },
  },
  compare: {
    dose: 3,
    raw: { a: "Monarchia konstytucyjna", b: "Republika", rows: [{ k: "Władza", a: "król ograniczony", b: "Konwent" }, { k: "Król", a: "zostaje", b: "obalony" }] },
  },
  cycle: { dose: 0, raw: { steps: ["Susza", "Nieurodzaj", "Drożejący chleb", "Głód"] } },
  flow: { dose: 0, raw: { kind: "cause", steps: ["Kryzys finansowy", "Susza", "Nieurodzaj", "Wzrost ceny chleba"] } },
  tree: { dose: 2, raw: { root: "Ancien régime", groups: [{ name: "Uprzywilejowani", items: ["duchowieństwo", "szlachta"] }, { name: "Stan trzeci", items: ["mieszczaństwo", "chłopi"] }] } },
  bars: { dose: 2, raw: { unit: "%", items: [{ label: "Stan trzeci", value: 98 }, { label: "Duchowieństwo", value: 0.5 }, { label: "Szlachta", value: "1,5" }] } },
  numbers: { dose: 2, raw: { items: [{ value: "98%", label: "ludności to stan trzeci" }, { value: "25 mln", label: "osób w stanie trzecim" }] } },
};

const parse = (type: string, raw: unknown, dose = 0, c = ctx(dose)) => parseViz(type, typeof raw === "string" ? raw : JSON.stringify(raw), c);

// ---------- each type ----------

test("parseViz: every type parses into a valid stored visual", () => {
  assert.deepEqual(Object.keys(GOOD).sort(), [...VIZ_TYPES].sort());
  for (const [type, { dose, raw }] of Object.entries(GOOD)) {
    const r = parse(type, raw, dose);
    assert.ok(r.viz, `${type}: ${r.drop}`);
    assert.equal(r.viz!.type, type);
    assert.ok(VizSchema.safeParse(r.viz).success, type);
    assert.ok(FeedItemSchema.safeParse({ title: "t", body: "b", viz: r.viz }).success, type);
    assert.ok(vizText(r.viz!).length > 0);
  }
  const bars = parse("bars", GOOD.bars.raw, 2).viz as Extract<Viz, { type: "bars" }>;
  assert.deepEqual(bars.items.map((i) => i.value), [98, 0.5, 1.5], "numeric string \"1,5\" accepted as 1.5");
  const flow = parse("flow", { steps: ["Susza", "Nieurodzaj"] }, 0).viz as Extract<Viz, { type: "flow" }>;
  assert.equal(flow.kind, "process", "missing kind defaults to process");
  assert.equal(parse("timeline", GOOD.timeline.raw, 1).viz!.caption, "Rok 1789");
});

test("parseViz: none / missing type is not a drop", () => {
  assert.deepEqual(parseViz("none", "", ctx(0)), {});
  assert.deepEqual(parseViz(undefined, undefined, ctx(0)), {});
  assert.deepEqual(parseViz("", "{}", ctx(0)), {});
});

// ---------- garbage → schema drop ----------

test("parseViz drops garbage JSON, unknown types and bad values (never throws)", () => {
  const bad: [string, string, unknown][] = [
    ["garbage JSON", "timeline", "{items: [nope"],
    ["empty string", "cycle", ""],
    ["JSON array", "cycle", "[\"a\",\"b\",\"c\"]"],
    ["JSON null", "cycle", "null"],
    ["unknown type", "pie", { items: [{ label: "a", value: 1 }] }],
    ["__proto__ type", "__proto__", {}],
    ["negative bar", "bars", { unit: "%", items: [{ label: "Stan trzeci", value: 98 }, { label: "Szlachta", value: -1.5 }] }],
    ["NaN bar (string)", "bars", { unit: "%", items: [{ label: "Stan trzeci", value: 98 }, { label: "Szlachta", value: "abc" }] }],
    ["Infinity bar", "bars", "{\"unit\":\"%\",\"items\":[{\"label\":\"Stan trzeci\",\"value\":98},{\"label\":\"Szlachta\",\"value\":1e999}]}"],
    ["null bar", "bars", { unit: "%", items: [{ label: "Stan trzeci", value: 98 }, { label: "Szlachta", value: null }] }],
    ["all-zero bars", "bars", { unit: "%", items: [{ label: "Stan trzeci", value: 0 }, { label: "Szlachta", value: 0 }] }],
    ["too few timeline items", "timeline", { items: [{ when: "1789", label: "Bastylia" }, { when: "1789", label: "Deklaracja" }] }],
    ["too few cycle steps", "cycle", { steps: ["Susza", "Głód"] }],
    ["one tree group", "tree", { root: "Ancien régime", groups: [{ name: "Stan trzeci", items: ["chłopi"] }] }],
    ["empty tree group", "tree", { root: "Ancien régime", groups: [{ name: "Stan trzeci", items: [] }, { name: "Szlachta", items: ["szlachta"] }] }],
    ["empty label", "numbers", { items: [{ value: "98%", label: "" }] }],
    ["label is an object", "numbers", { items: [{ value: "98%", label: { x: 1 } }] }],
    ["compare without b", "compare", { a: "Monarchia", rows: [{ k: "Król", a: "jest", b: "nie" }, { k: "Władza", a: "król", b: "Konwent" }] }],
    ["only tags", "cycle", { steps: ["<b></b>", "<i></i>", "<br>"] }],
  ];
  for (const [name, type, raw] of bad) {
    let r;
    assert.doesNotThrow(() => (r = parse(type, raw, 2)), name);
    assert.deepEqual(r, { drop: "schema" }, name);
  }
});

// ---------- truncation and sanitizing ----------

test("parseViz truncates long strings before validating, strips tags, emoji and unknown keys", () => {
  const long = "Zwołanie Stanów Generalnych " + "bardzo ".repeat(80);
  const r = parse(
    "timeline",
    {
      type: "bars",
      caption: "Rok 1789 " + "x".repeat(300),
      evil: "<script>alert(1)</script>",
      items: [
        { when: "1789 (rok przełomu, od którego wszystko się zaczęło)", label: long, onclick: "x" },
        { when: "14.07.1789", label: "<img src=x onerror=alert(1)>Zdobycie <b>Bastylii</b> 🔥" },
        { when: "26 sierpnia 1789", label: "Deklaracja praw człowieka" },
        { when: "1789", label: "Stany Generalne" },
        { when: "1789", label: "Stany Generalne" },
        { when: "1789", label: "Stany Generalne" },
        { when: "1789", label: "Stany Generalne" },
        { when: "1789", label: "Stany Generalne (ósmy, ponad limit)" },
      ],
    },
    1,
  );
  assert.ok(r.viz, r.drop);
  const v = r.viz as Extract<Viz, { type: "timeline" }>;
  assert.equal(v.type, "timeline", "type comes from viz_type, not from the payload");
  assert.equal(v.items.length, 7, "over-long list cut to the max");
  assert.ok(v.items[0]!.label.length <= 80 && v.items[0]!.label.endsWith("…"));
  assert.ok(v.items[0]!.when.length <= 24 && v.items[0]!.when.endsWith("…"));
  assert.ok(v.caption!.length <= 120);
  assert.equal(v.items[1]!.label, "Zdobycie Bastylii");
  const json = JSON.stringify(v);
  assert.ok(!/[<>]/.test(json), "no angle brackets survive");
  assert.ok(!/evil|onclick|script/.test(json), "unknown keys are dropped");
  assert.ok(!/\p{Extended_Pictographic}/u.test(json), "no emoji");
});

// ---------- grounding (level scope) ----------

test("parseViz grounds labels against the whole level, not only the dose", () => {
  // the tree labels come from the flashcards and other doses, the dose itself mentions none of them
  const onlyDose = { levelText: LEVEL_TEXT, doseText: "Krótko o podziale społeczeństwa." };
  assert.ok(parse("tree", GOOD.tree.raw, 0, onlyDose).viz, "labels found elsewhere in the level are grounded");
  const invented = { root: "Kosmos", groups: [{ name: "Planety", items: ["Mars", "Wenus"] }, { name: "Gwiazdy", items: ["Syriusz", "Wega"] }] };
  assert.deepEqual(parse("tree", invented, 2), { drop: "grounding" });
  // one stray label out of many is tolerated (3 of 4 must be grounded)
  const mostly = { steps: ["Susza", "Nieurodzaj", "Drożejący chleb", "Głód", "Inflacja"] };
  assert.ok(parse("cycle", mostly, 0).viz);
});

test("parseViz: numbers and dates must appear in THIS dose's body or real (normalized)", () => {
  // 1788 is in dose 0, not in dose 1
  const t = { items: [{ when: "1788", label: "Susza" }, { when: "1789", label: "Stany Generalne" }, { when: "1789", label: "Bastylia" }] };
  assert.ok(parse("timeline", t, 0).viz === undefined);
  assert.deepEqual(parse("timeline", t, 1), { drop: "grounding" });
  assert.deepEqual(parse("timeline", { items: [{ when: "1790", label: "Stany Generalne" }, ...t.items.slice(1)] }, 1), { drop: "grounding" });
  // invented bar value
  assert.deepEqual(parse("bars", { unit: "%", items: [{ label: "Stan trzeci", value: 97 }, { label: "Szlachta", value: 1.5 }] }, 2), { drop: "grounding" });
  // invented number inside a label
  assert.deepEqual(parse("numbers", { items: [{ value: "98%", label: "ludności, czyli 31 mln osób" }] }, 2), { drop: "grounding" });

  const n = (body: string) => ({ levelText: `${LEVEL_TEXT}\n${body}`, doseText: body });
  const cases: [string, unknown, string][] = [
    ["thousands with NBSP", { items: [{ value: "1000", label: "Stan trzeci" }] }, "Stan trzeci: 1 000 osób."],
    ["thousands with space", { items: [{ value: "12 500", label: "Stan trzeci" }] }, "Stan trzeci: 12500 osób."],
    ["decimal comma vs dot", { items: [{ value: "12.5%", label: "Stan trzeci" }] }, "Stan trzeci to 12,5 % ludności."],
    ["tys.", { items: [{ value: "3000", label: "Stan trzeci" }] }, "Stan trzeci: 3 tys. osób."],
    ["mln", { items: [{ value: "25 mln", label: "Stan trzeci" }] }, "Stan trzeci liczył 25 000 000 osób."],
    ["percent sign", { items: [{ value: "98 %", label: "Stan trzeci" }] }, "Stan trzeci to 98% ludności."],
  ];
  for (const [name, raw, body] of cases) assert.ok(parse("numbers", raw, 0, n(body)).viz, name);
  // bars value 25 000 000 against "25 mln"
  assert.ok(parse("bars", { unit: "osób", items: [{ label: "Stan trzeci", value: 25000000 }, { label: "Szlachta", value: 400000 }] }, 0, n("Stan trzeci: 25 mln, szlachta: 400 tys.")).viz);
  // CO2 is not the number 2
  assert.ok(parse("flow", { kind: "process", steps: ["CO2 z powietrza", "Cukier"] }, 0, n("Roślina pobiera <b>CO2</b> i robi cukier.")).viz);
});

// ---------- finalize: cap, stats, explicit copy ----------

type GenDose = { title: string; body: string; real: string; mnemo: string; viz_type?: string; viz?: string };
function topic(feed: GenDose[]): GeneratedTopic {
  return {
    name: "Rewolucja francuska",
    short: "Rewolucja",
    emoji: "🇫🇷",
    tagline: "",
    category: "historia",
    info_html: "",
    levels: [{ title: "Początki", emoji: "🏰", summary: "", feed: feed as GeneratedTopic["levels"][number]["feed"], flashcards: CARDS, quiz: QUIZ, games: [] }],
  };
}

test("finalizeGenerated keeps at most ceil(feed/2) visuals per level and reports why the rest were dropped", () => {
  const feed = [
    { ...DOSES[0]!, viz_type: "flow", viz: JSON.stringify(GOOD.flow.raw) },
    { ...DOSES[1]!, viz_type: "timeline", viz: JSON.stringify(GOOD.timeline.raw) },
    { ...DOSES[2]!, viz_type: "bars", viz: JSON.stringify(GOOD.bars.raw) },
    { ...DOSES[3]!, viz_type: "compare", viz: JSON.stringify(GOOD.compare.raw) },
    { title: "Śmieci", body: "<b>Tekst</b> bez sensu.", real: "", mnemo: "", viz_type: "cycle", viz: "{oops" },
    { title: "Kosmos", body: "<b>Mars</b> to planeta.", real: "", mnemo: "", viz_type: "tree", viz: JSON.stringify({ root: "Galaktyka", groups: [{ name: "Gwiazdy", items: ["Syriusz"] }, { name: "Mgławice", items: ["Oriona"] }] }) },
    { title: "Bez wizualizacji", body: "<b>Konwent</b> rządził.", real: "", mnemo: "", viz_type: "none", viz: "" },
  ];
  const { content, vizKept, vizDropped } = finalizeGeneratedWithStats(topic(feed), "liceum", { viz: true });
  assert.ok(TopicContentSchema.safeParse(content).success);
  const f = content.levels[0]!.feed;
  assert.equal(f.length, 7, "doses are never removed");
  assert.deepEqual(f.map((d) => d.viz?.type ?? null), ["flow", "timeline", "bars", "compare", null, null, null], "ceil(7/2) = 4 kept in order");
  assert.equal(vizKept, 4);
  assert.deepEqual(vizDropped, { schema: 1, grounding: 1, cap: 0 });

  const crowded = [0, 1, 2, 3].map((i) => ({ ...DOSES[i]!, viz_type: "cycle", viz: JSON.stringify(GOOD.cycle.raw) }));
  const r2 = finalizeGeneratedWithStats(topic(crowded), "liceum", { viz: true });
  assert.equal(r2.vizKept, 2, "ceil(4/2) = 2");
  assert.deepEqual(r2.vizDropped, { schema: 0, grounding: 0, cap: 2 });
  assert.deepEqual(r2.content.levels[0]!.feed.map((d) => !!d.viz), [true, true, false, false]);
});

test("finalizeGenerated without viz mode stores exactly the pre-viz dose shape (even if the model sent viz fields)", () => {
  const withStray = DOSES.map((d) => ({ ...d, viz_type: "cycle", viz: JSON.stringify(GOOD.cycle.raw) }));
  const stray = finalizeGeneratedWithStats(topic(withStray), "liceum");
  assert.equal(stray.vizKept, 0);
  assert.deepEqual(stray.vizDropped, { schema: 0, grounding: 0, cap: 0 });
  for (const content of [finalizeGenerated(topic(DOSES.map((d) => ({ ...d }))), "liceum"), stray.content]) {
    for (const d of content.levels[0]!.feed) {
      assert.ok(!("viz" in d), "no viz key at all");
      assert.deepEqual(Object.keys(d).filter((k) => (d as unknown as Record<string, unknown>)[k] !== undefined).sort(), ["body", "real", "title"]);
    }
  }
});

test("FeedItemSchema rejects a malformed stored visual", () => {
  assert.equal(FeedItemSchema.safeParse({ title: "t", body: "b", viz: { type: "bars", unit: "%", items: [{ label: "a", value: -1 }, { label: "b", value: 2 }] } }).success, false);
  assert.equal(FeedItemSchema.safeParse({ title: "t", body: "b", viz: { type: "pie" } }).success, false);
  assert.equal(FeedItemSchema.safeParse({ title: "t", body: "b", viz: { type: "numbers", items: [{ value: "x".repeat(17), label: "a" }] } }).success, false);
});

// ---------- prompts and schemas gated by options.viz ----------

test("options.viz is accepted by GenerationOptionsSchema", () => {
  assert.equal(GenerationOptionsSchema.parse({ stage: "liceum", viz: true }).viz, true);
  assert.equal(GenerationOptionsSchema.safeParse({ stage: "liceum", viz: "yes" }).success, false);
});

test("viz grammar adds only viz_type (enum) and viz (string) to each dose", () => {
  const off = z.toJSONSchema(LevelCoreGenSchema) as unknown as { properties: { feed: { items: { properties: Record<string, unknown>; required: string[] } } } };
  const on = z.toJSONSchema(LevelCoreGenVizSchema) as unknown as typeof off;
  const offDose = off.properties.feed.items;
  const onDose = on.properties.feed.items;
  assert.deepEqual(Object.keys(onDose.properties), [...Object.keys(offDose.properties), "viz_type", "viz"]);
  assert.deepEqual(onDose.properties.viz_type, { type: "string", enum: [...VIZ_GEN_TYPES] });
  assert.deepEqual(onDose.properties.viz, { type: "string" });
  assert.deepEqual(onDose.required, [...offDose.required, "viz_type", "viz"]);
  assert.ok(JSON.stringify(on).length - JSON.stringify(off).length < 300, "grammar grows by two flat fields only");
});

test("level prompt carries the viz rules only in viz mode and only for the dose call", () => {
  const outline = { name: "Rewolucja", levels: [{ title: "Początki", scope: "- 1789" }] };
  for (const part of ["core", "tasks", "all"] as const) {
    const off = levelInstructions(outline, 0, part);
    assert.equal(levelInstructions(outline, 0, part, {}), off);
    assert.equal(levelInstructions(outline, 0, part, { viz: false }), off);
    assert.ok(!off.includes("WIZUALIZACJE"));
    const on = levelInstructions(outline, 0, part, { viz: true });
    if (part === "tasks") assert.equal(on, off);
    else assert.equal(on, `${off}\n\n${VIZ_RULES}`);
  }
  assert.match(VIZ_RULES, /viz_type = "none"/);
  assert.match(VIZ_RULES, /połowa dawek/);
  assert.match(VIZ_RULES, /WYŁĄCZNIE z materiału/);
  assert.match(VIZ_RULES, /pogrubiony termin/);
  assert.match(VIZ_RULES, /w body albo real/);
  for (const t of VIZ_TYPES) assert.ok(VIZ_RULES.includes(`"${t}"`), t);
  assert.doesNotMatch(VIZ_RULES, /\p{Extended_Pictographic}/u);
  assert.doesNotMatch(VIZ_RULES, /\bPro\b|płat|subskryp|premium/i);
});

test("review prompt shows visuals only in viz mode", () => {
  const input = {
    stage: "liceum" as const,
    feed: [
      { ...DOSES[0]!, viz_type: "flow", viz: JSON.stringify(GOOD.flow.raw) },
      { ...DOSES[1]!, viz_type: "none", viz: "" },
      { ...DOSES[2]!, viz_type: "bars", viz: "{broken" },
    ],
    questions: [],
  };
  const off = buildReviewUserPrompt(input);
  assert.ok(!off.includes("viz"), "no viz without viz mode");
  const on = buildReviewUserPrompt({ ...input, viz: true });
  const data = JSON.parse(on.slice(on.indexOf("{"))) as { feed: { viz?: { type: string; steps?: string[]; raw?: string } }[] };
  assert.equal(data.feed[0]!.viz!.type, "flow");
  assert.deepEqual(data.feed[0]!.viz!.steps, (GOOD.flow.raw as { steps: string[] }).steps);
  assert.equal(data.feed[1]!.viz, undefined);
  assert.deepEqual(data.feed[2]!.viz, { type: "bars", raw: "{broken" });
});

// ---------- review fixes ----------

const tl = (when: string[]) => JSON.stringify({ items: when.map((w, i) => ({ when: w, label: ["Zburzenie Bastylii", "Republika", "Terror"][i] ?? "Republika" })) });
const lvl = "Zburzenie Bastylii, republika i terror w czasie rewolucji. Niepodległość.";

test("parseViz: dotted dates in the dose body ground timeline years and dotted dates", () => {
  const body = "Bastylię zburzono 14.07.1789, republika 1792, terror 1793.";
  assert.equal(parseViz("timeline", tl(["1789", "1792", "1793"]), { levelText: `${lvl}\n${body}`, doseText: body }).viz?.type, "timeline");
  const b2 = "Niepodległość 11.11.1918, republika 1919, terror 1920.";
  assert.equal(parseViz("timeline", tl(["11.11.1918", "1919", "1920"]), { levelText: `${lvl}\n${b2}`, doseText: b2 }).viz?.type, "timeline");
  const b3 = "Rozdział 3 1789 to zburzenie Bastylii, potem 1792 i 1793.";
  assert.equal(parseViz("timeline", tl(["1789", "1792", "1793"]), { levelText: `${lvl}\n${b3}`, doseText: b3 }).viz?.type, "timeline");
  // still strict: a year that is not in the dose is dropped
  assert.equal(parseViz("timeline", tl(["1789", "1792", "1794"]), { levelText: `${lvl}\n${body}`, doseText: body }).drop, "grounding");
  // thousands groups keep working
  const b4 = "Armia liczyła 1 000 000 żołnierzy.";
  assert.equal(parseViz("numbers", JSON.stringify({ items: [{ value: "1000000", label: "żołnierzy w armii" }] }), { levelText: b4, doseText: b4 }).viz?.type, "numbers");
});

test("parseViz: generic comparison cells (tak / brak) and 3-letter words do not fail the label check", () => {
  const level = "Kapitalizm opiera się na własności prywatnej i rynku. Socjalizm ogranicza rynek i planuje gospodarkę centralnie.";
  const cmp = JSON.stringify({ a: "Kapitalizm", b: "Socjalizm", rows: [{ k: "Własność prywatna", a: "tak", b: "ograniczona" }, { k: "Wolny rynek", a: "tak", b: "brak" }, { k: "Planowanie", a: "nie", b: "centralne" }] });
  assert.equal(parseViz("compare", cmp, { levelText: level, doseText: level }).viz?.type, "compare");
  const kot = "Kota trzymano w domu, a psa na podwórzu.";
  assert.equal(parseViz("tree", JSON.stringify({ root: "Zwierzęta domowe", groups: [{ name: "Dom", items: ["kot"] }, { name: "Podwórze", items: ["pies"] }] }), { levelText: `${kot} Zwierzęta domowe.`, doseText: kot }).viz?.type, "tree");
});

test("parseViz: a cut never leaves half of a surrogate pair (jsonb rejects it)", () => {
  const label = `${"a".repeat(78)}𝑥𝑥𝑥 Zburzenie Bastylii`;
  const body = "W 1789 zburzono Bastylię, w 1792 republika, w 1793 terror.";
  const r = parseViz("timeline", JSON.stringify({ items: [{ when: "1789", label }, { when: "1792", label: "Republika" }, { when: "1793", label: "Terror" }] }), { levelText: `${lvl} aaaa ${"a".repeat(78)}`, doseText: body });
  const out = r.viz?.type === "timeline" ? r.viz.items[0]!.label : JSON.stringify(r);
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out), `lone surrogate in ${JSON.stringify(out)}`);
  assert.ok(out.length <= 80);
});

test("viz prompt: dates and numbers stay in body/real; numbers/bars are not for repeating one sentence", () => {
  assert.ok(!VIZ_RULES.includes("kolejne daty"));
  assert.match(VIZ_RULES, /Wszystkie daty i liczby z wizualizacji zostają w body albo real/);
  assert.match(VIZ_RULES, /nie do powtórzenia jednego zdania/);
});
