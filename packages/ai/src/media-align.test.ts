import { test } from "node:test";
import assert from "node:assert/strict";
import { alignToWords, type Alignment } from "./media/align.js";
import { evenAlignment } from "./media-fixtures.test-helper.js";

const align = (chars: string, starts: number[], ends?: number[]): Alignment => ({
  characters: [...chars],
  character_start_times_seconds: starts,
  character_end_times_seconds: ends ?? starts.map((s) => s + 0.05),
});

test("exact alignment: each word takes its first and last character's times; tags are words with tag: true", () => {
  const text = "[excited] Nie, nie, NIE! [laughs softly] Serio.";
  const a = evenAlignment(text, 4.7);
  const w = alignToWords(text, a, null, 5);
  assert.deepEqual(
    w.words.map((x) => x.w),
    ["[excited]", "Nie,", "nie,", "NIE!", "[laughs", "softly]", "Serio."],
  );
  assert.deepEqual(
    w.words.map((x) => !!x.tag),
    [true, false, false, false, true, true, false],
  );
  const nie = w.words[1]!;
  assert.equal(nie.start, a.character_start_times_seconds[text.indexOf("Nie,")]);
  assert.equal(nie.end, a.character_end_times_seconds[text.indexOf("Nie,") + 3]);
  assert.equal(w.duration, 5);
  assert.equal(w.v, 1);
});

test("alignment that differs from the text (tags left out): letters matched in order; tags take no time", () => {
  const text = "[excited] Łódź, żółć! Koniec.";
  const spoken = "łódź żółć koniec";
  const a = align(spoken, [...spoken].map((_, i) => i * 0.1));
  const w = alignToWords(text, a, null, 2);
  const by = Object.fromEntries(w.words.map((x) => [x.w, x]));
  assert.equal(by["Łódź,"]!.start, 0, "case and diacritics");
  assert.equal(by["żółć!"]!.start, 0.5);
  assert.equal(by["Koniec."]!.start, 1);
  assert.equal(by["[excited]"]!.tag, true);
  assert.equal(by["[excited]"]!.start, by["[excited]"]!.end, "no duration");
});

test("normalized_alignment fallback: a number read as words shares the gap between its matched neighbours", () => {
  const text = "W 1788 roku król.";
  const norm = "W tysiąc siedemset osiemdziesiątym ósmym roku król.";
  const a = align(norm, [...norm].map((_, i) => i * 0.05));
  const w = alignToWords(text, null, a, 3);
  const [W, year, roku, krol] = w.words;
  assert.equal(W!.start, 0);
  assert.ok(Math.abs(roku!.start - norm.indexOf("roku") * 0.05) < 1e-6);
  assert.ok(year!.start >= W!.end && year!.end <= roku!.start + 1e-9, "the number fills the gap");
  assert.ok(year!.end > year!.start);
  assert.equal(krol!.w, "król.");
});

test("no alignment at all: words spread over the duration by length, monotonic", () => {
  const w = alignToWords("Ala ma kota i psa.", null, null, 4);
  for (let i = 1; i < w.words.length; i++) assert.ok(w.words[i]!.start >= w.words[i - 1]!.start);
  assert.equal(w.words[0]!.start, 0);
  assert.ok(Math.abs(w.words[w.words.length - 1]!.end - 4) < 0.01);
});

test("a broken alignment (lengths differ) is ignored", () => {
  const w = alignToWords("Raz dwa", { characters: ["R"], character_start_times_seconds: [], character_end_times_seconds: [] }, null, 1);
  assert.equal(w.words.length, 2);
});
