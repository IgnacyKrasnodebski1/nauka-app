import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8, type Zippable } from "fflate";
import { PPTX_MIME } from "@nauka/shared";
import { extractPptx, imageInfo, newPptxBudget, pptxToText, PptxError, PPTX_LIMITS } from "./pptx.js";
import { prepareMaterials, MaterialError, MAX_IMAGES_ANY_SIZE, type MaterialInput } from "./materials.js";
import { intakeMaterials, type IntakeRow } from "./intake.js";

// ---------- fixture builders (everything is built in memory; no binary fixtures in the repo) ----------

const MB = 1024 * 1024;
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** Deterministic filler so different `seed`s give different SHA-1s. */
function filler(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  let x = (seed * 2654435761) >>> 0 || 1;
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    out[i] = x & 0xff;
  }
  return out;
}

function png(w: number, h: number, bytes = 20_000, seed = 1): Uint8Array {
  const d = filler(Math.max(bytes, 33), seed);
  d.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13], 0);
  d.set(strToU8("IHDR"), 12);
  new DataView(d.buffer).setUint32(16, w);
  new DataView(d.buffer).setUint32(20, h);
  return d;
}

function jpeg(w: number, h: number, bytes = 20_000, seed = 2): Uint8Array {
  const d = filler(Math.max(bytes, 40), seed);
  // SOI, APP0 (len 16), SOF0 (len 17: precision, height, width, …)
  d.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0], 0);
  d.set([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 3], 20);
  return d;
}

function gif(w: number, h: number): Uint8Array {
  const d = filler(20_000, 3);
  d.set(strToU8("GIF89a"), 0);
  d.set([w & 0xff, w >> 8, h & 0xff, h >> 8], 6);
  return d;
}

function webpVp8x(w: number, h: number): Uint8Array {
  const d = filler(20_000, 4);
  d.set(strToU8("RIFF"), 0);
  d.set(strToU8("WEBP"), 8);
  d.set(strToU8("VP8X"), 12);
  const W = w - 1,
    H = h - 1;
  d.set([W & 0xff, (W >> 8) & 0xff, (W >> 16) & 0xff, H & 0xff, (H >> 8) & 0xff, (H >> 16) & 0xff], 24);
  return d;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (s: string) => `<a:p><a:r><a:rPr lang="pl-PL"/><a:t>${esc(s)}</a:t></a:r></a:p>`;
const shape = (ph: string, paras: string[]) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="x"/><p:cNvSpPr/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>${paras.map(para).join("")}</p:txBody></p:sp>`;

interface SlideSpec {
  title?: string;
  body?: string[];
  notes?: string;
  /** media file names (in ppt/media/) placed on the slide */
  images?: string[];
  table?: string[][];
  hidden?: boolean;
  smartArt?: string[];
}

function slideXml(s: SlideSpec, n: number): string {
  const parts: string[] = [];
  if (s.title !== undefined) parts.push(shape('<p:ph type="title"/>', [s.title]));
  if (s.body) parts.push(shape('<p:ph idx="1"/>', s.body));
  parts.push(shape('<p:ph type="sldNum" idx="12"/>', [String(n)]));
  parts.push(shape('<p:ph type="ftr" idx="11"/>', ["Wydział Biologii — stopka"]));
  if (s.table)
    parts.push(
      `<p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tblGrid/>${s.table
        .map((row) => `<a:tr h="1">${row.map((c) => `<a:tc><a:txBody><a:bodyPr/>${para(c)}</a:txBody></a:tc>`).join("")}</a:tr>`)
        .join("")}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`,
    );
  (s.images ?? []).forEach((_, i) => parts.push(`<p:pic><p:blipFill><a:blip r:embed="rIdImg${i}"/></p:blipFill></p:pic>`));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${NS}${s.hidden ? ' show="0"' : ""}><p:cSld><p:spTree>${parts.join("")}</p:spTree></p:cSld></p:sld>`;
}

function buildPptx(slides: SlideSpec[], opts: { media?: Record<string, Uint8Array>; order?: number[]; extra?: Zippable; noPresentation?: boolean } = {}): Uint8Array {
  const files: Zippable = { "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types/>') };
  const order = opts.order ?? slides.map((_, i) => i);
  if (!opts.noPresentation) {
    files["ppt/presentation.xml"] = strToU8(`<?xml version="1.0"?><p:presentation ${NS}><p:sldIdLst>${order.map((i) => `<p:sldId id="${256 + i}" r:id="rIdS${i}"/>`).join("")}</p:sldIdLst></p:presentation>`);
    files["ppt/_rels/presentation.xml.rels"] = strToU8(
      `<?xml version="1.0"?><Relationships>${slides.map((_, i) => `<Relationship Id="rIdS${i}" Type="${REL}/slide" Target="slides/slide${i + 1}.xml"/>`).join("")}<Relationship Id="rIdM" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>`,
    );
  }
  slides.forEach((s, i) => {
    const n = i + 1;
    files[`ppt/slides/slide${n}.xml`] = strToU8(slideXml(s, n));
    const rels: string[] = [`<Relationship Id="rIdL" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`];
    (s.images ?? []).forEach((m, k) => rels.push(`<Relationship Id="rIdImg${k}" Type="${REL}/image" Target="../media/${m}"/>`));
    if (s.notes !== undefined) {
      rels.push(`<Relationship Id="rIdN" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/>`);
      files[`ppt/notesSlides/notesSlide${n}.xml`] = strToU8(
        `<?xml version="1.0"?><p:notes ${NS}><p:cSld><p:spTree>${shape('<p:ph type="sldImg"/>', [])}${shape('<p:ph type="body" idx="1"/>', [s.notes])}${shape('<p:ph type="sldNum" idx="5"/>', [String(n)])}</p:spTree></p:cSld></p:notes>`,
      );
    }
    if (s.smartArt) {
      rels.push(`<Relationship Id="rIdD" Type="${REL}/diagramData" Target="../diagrams/data${n}.xml"/>`);
      files[`ppt/diagrams/data${n}.xml`] = strToU8(`<?xml version="1.0"?><dgm:dataModel><dgm:ptLst>${s.smartArt.map((t) => `<dgm:pt><dgm:t><a:bodyPr/>${para(t)}</dgm:t></dgm:pt>`).join("")}</dgm:ptLst></dgm:dataModel>`);
    }
    files[`ppt/slides/_rels/slide${n}.xml.rels`] = strToU8(`<?xml version="1.0"?><Relationships>${rels.join("")}</Relationships>`);
  });
  for (const [name, data] of Object.entries(opts.media ?? {})) files[`ppt/media/${name}`] = data;
  Object.assign(files, opts.extra ?? {});
  return zipSync(files, { level: 6 });
}

/** Overwrite the declared uncompressed size of `name` in the ZIP central directory (and the local header). */
function patchDeclaredSize(zip: Uint8Array, name: string, size: number): Uint8Array {
  const out = zip.slice();
  const dv = new DataView(out.buffer);
  const enc = strToU8(name);
  for (let i = 0; i + 46 < out.length; i++) {
    const sig = dv.getUint32(i, true);
    if (sig === 0x02014b50) {
      const nl = dv.getUint16(i + 28, true);
      if (nl === enc.length && enc.every((b, k) => out[i + 46 + k] === b)) dv.setUint32(i + 24, size, true);
    } else if (sig === 0x04034b50) {
      const nl = dv.getUint16(i + 26, true);
      if (nl === enc.length && enc.every((b, k) => out[i + 30 + k] === b)) dv.setUint32(i + 22, size, true);
    }
  }
  return out;
}

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof PptxError || e instanceof MaterialError) return e.code;
    throw e;
  }
  return undefined;
}

// ---------- imageInfo ----------

test("imageInfo reads dimensions from PNG, JPEG, GIF and WebP headers; rejects other formats", () => {
  assert.deepEqual(imageInfo(png(640, 480)), { mime: "image/png", width: 640, height: 480 });
  assert.deepEqual(imageInfo(jpeg(1024, 768)), { mime: "image/jpeg", width: 1024, height: 768 });
  assert.deepEqual(imageInfo(gif(32, 16)), { mime: "image/gif", width: 32, height: 16 });
  assert.deepEqual(imageInfo(webpVp8x(3000, 1200)), { mime: "image/webp", width: 3000, height: 1200 });
  const emf = filler(20_000, 9);
  emf.set([1, 0, 0, 0], 0);
  assert.equal(imageInfo(emf), null);
  assert.equal(imageInfo(strToU8('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')), null);
  assert.equal(imageInfo(strToU8("II*\0 tiff header")), null);
});

// ---------- text ----------

test("slide text follows presentation order, keeps titles, bullets, tables, SmartArt and speaker notes; drops footer and slide numbers", () => {
  const deck = buildPptx(
    [
      { title: "Fotosynteza", body: ["Zachodzi w chloroplastach", "Produkty: glukoza & tlen"], notes: "Powiedzieć o fazie jasnej i ciemnej." },
      { title: "Ukryty slajd", body: ["Tego nie ma"], hidden: true },
      { title: "Porównanie", table: [["Faza", "Gdzie"], ["jasna", "tylakoidy"]], smartArt: ["Światło", "ATP"] },
    ],
    { order: [2, 0, 1] },
  );
  const r = extractPptx(deck);
  assert.equal(r.stats.slides, 3);
  assert.equal(r.stats.hidden, 1);
  assert.deepEqual(
    r.slides.map((s) => s.title),
    ["Porównanie", "Fotosynteza"],
  );
  assert.equal(r.slides[0]!.n, 1); // slide3.xml is first in the deck
  assert.equal(r.slides[0]!.body, "Faza | Gdzie\njasna | tylakoidy\nŚwiatło\nATP");
  assert.equal(r.slides[1]!.body, "Zachodzi w chloroplastach\nProdukty: glukoza & tlen");
  assert.equal(r.slides[1]!.notes, "Powiedzieć o fazie jasnej i ciemnej.");

  const text = pptxToText("Bio.pptx", r);
  assert.match(text, /^Prezentacja „Bio\.pptx”, slajdów: 3\./);
  assert.ok(text.indexOf("Slajd 1: Porównanie") < text.indexOf("Slajd 2: Fotosynteza"));
  assert.match(text, /Notatki prowadzącego: Powiedzieć o fazie jasnej i ciemnej\./);
  assert.doesNotMatch(text, /stopka|Tego nie ma/);
  assert.doesNotMatch(text, /^\d+$/m, "slide-number placeholders are not text");
});

test("falls back to slideN.xml order when presentation.xml is missing", () => {
  const r = extractPptx(buildPptx([{ title: "A" }, { title: "B" }, { title: "C" }], { noPresentation: true }));
  assert.deepEqual(
    r.slides.map((s) => s.title),
    ["A", "B", "C"],
  );
});

test("text is capped at maxChars and slides at maxSlides", () => {
  const long = "x".repeat(250_000);
  const r = extractPptx(buildPptx([{ title: "1", body: [long] }, { title: "2", body: [long] }, { title: "3", body: ["dalej"] }]));
  assert.equal(r.chars, PPTX_LIMITS.maxChars);
  assert.equal(r.stats.charsTruncated, true);
  assert.equal(r.slides.length, 2);
  assert.match(pptxToText("d", r), /za dużo tekstu/);

  const many = extractPptx(buildPptx(Array.from({ length: PPTX_LIMITS.maxSlides + 5 }, (_, i) => ({ title: `S${i + 1}` }))));
  assert.equal(many.stats.slidesTruncated, true);
  assert.equal(many.slides.length, PPTX_LIMITS.maxSlides);
  assert.match(pptxToText("d", many), /Dalsze slajdy pominięte/);
});

// ---------- images ----------

test("images: deduplicated by content, logos and tiny/huge/vector images dropped, slide numbers kept", () => {
  const logo = png(300, 100, 16_000, 77);
  const photo = jpeg(1600, 1200, 40_000, 5);
  const media = {
    "logo1.png": logo,
    "logo2.png": logo.slice(), // same bytes, different part → same hash
    "photo.jpeg": photo,
    "photo-copy.jpeg": photo.slice(),
    "chart.png": png(800, 600, 30_000, 6),
    "icon.png": png(16, 16, 2_000, 7),
    "huge.png": png(2600, 1800, 60_000, 8),
    "vector.emf": filler(30_000, 10),
    "heavy.jpg": jpeg(1000, 1000, PPTX_LIMITS.maxImageBytes + 10, 11),
  };
  const deck = buildPptx(
    [
      { title: "1", images: ["logo1.png", "photo.jpeg", "icon.png"] },
      { title: "2", images: ["logo2.png", "chart.png", "vector.emf"] },
      { title: "3", images: ["logo1.png", "photo-copy.jpeg", "huge.png"] },
      { title: "4", images: ["logo1.png", "heavy.jpg"] },
      { title: "5" },
    ],
    { media },
  );
  const r = extractPptx(deck);
  assert.deepEqual(
    r.images.map((i) => [i.slide, i.mime, i.width]),
    [
      [1, "image/jpeg", 1600],
      [2, "image/png", 800],
    ],
  );
  assert.equal(r.stats.images.kept, 2);
  assert.equal(r.stats.images.logo, 1);
  assert.equal(r.stats.images.duplicate, 1);
  assert.equal(r.stats.images.small, 1);
  assert.equal(r.stats.images.oversizePx, 1);
  assert.equal(r.stats.images.unsupported, 1);
  assert.equal(r.stats.images.big, 1);
});

// ---------- errors ----------

test("protected / old binary files → pptx_protected; garbage → bad_pptx", () => {
  const cfb = new Uint8Array(4096);
  cfb.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  assert.equal(code(() => extractPptx(cfb)), "pptx_protected");
  assert.equal(code(() => extractPptx(strToU8("%PDF-1.7 not a deck"))), "bad_pptx");
  const broken = buildPptx([{ title: "A" }]).slice(0, 200);
  assert.equal(code(() => extractPptx(broken)), "bad_pptx");
  // a valid ZIP that is not a presentation (e.g. a renamed .docx)
  assert.equal(code(() => extractPptx(zipSync({ "word/document.xml": strToU8("<w:document/>") }))), "bad_pptx");
});

test("deck without text or usable images → pptx_empty", () => {
  assert.equal(code(() => extractPptx(buildPptx([{}, { body: ["   "] }]))), "pptx_empty");
  assert.equal(code(() => extractPptx(buildPptx([{ images: ["i.png"] }], { media: { "i.png": png(10, 10, 500) } }))), "pptx_empty");
  assert.equal(code(() => extractPptx(buildPptx([]))), "pptx_empty");
});

test("zip-bomb guards: entry count, total declared size, size of one unpacked entry", () => {
  const extra: Zippable = {};
  for (let i = 0; i < PPTX_LIMITS.maxEntries; i++) extra[`ppt/junk/${i}.bin`] = new Uint8Array(1);
  assert.equal(code(() => extractPptx(buildPptx([{ title: "A" }], { extra }))), "bad_pptx");

  // declared sizes are checked before anything is inflated
  const base = buildPptx([{ title: "A" }], { extra: { "ppt/embeddings/video.mp4": new Uint8Array(10) } });
  assert.equal(code(() => extractPptx(patchDeclaredSize(base, "ppt/embeddings/video.mp4", PPTX_LIMITS.maxTotalBytes + 1))), "bad_pptx");
  assert.equal(code(() => extractPptx(patchDeclaredSize(base, "ppt/slides/slide1.xml", PPTX_LIMITS.maxEntryBytes + 1))), "bad_pptx");

  // a real highly compressible entry: 31 MB of zeros in a slide part
  const bomb = buildPptx([{ title: "A" }], { extra: { "ppt/slides/slide2.xml": new Uint8Array(PPTX_LIMITS.maxEntryBytes + MB) } });
  assert.ok(bomb.length < 200_000);
  assert.equal(code(() => extractPptx(bomb)), "bad_pptx");

  // a big entry we never unpack (a video) is fine as long as the total stays in bounds
  const withVideo = patchDeclaredSize(base, "ppt/embeddings/video.mp4", 40 * MB);
  assert.equal(extractPptx(withVideo).slides[0]!.title, "A");
});

// ---------- prepareMaterials ----------

const asMaterial = (data: Uint8Array, name = "Wykład 3.pptx"): MaterialInput => ({ mime: PPTX_MIME, data, name });

test("prepareMaterials: a deck becomes slide text plus images labelled with their slide", () => {
  const deck = buildPptx(
    [
      { title: "Komórka", body: ["Błona, cytoplazma"], notes: "Na kolokwium!" },
      { title: "Mitochondrium", images: ["m.png"] },
    ],
    { media: { "m.png": png(900, 700, 25_000, 21) } },
  );
  const photo: MaterialInput = { mime: "image/jpeg", data: jpeg(1200, 900), name: "notatki.jpg" };
  const { materials, stats } = prepareMaterials([photo, asMaterial(deck)]);
  assert.deepEqual(
    materials.map((m) => [m.mime, m.name]),
    [
      ["image/jpeg", "notatki.jpg"],
      ["text/plain", "Wykład 3.pptx"],
      ["image/png", "Wykład 3.pptx — slajd 2"],
    ],
  );
  const text = Buffer.from(materials[1]!.data as Uint8Array).toString("utf8");
  assert.match(text, /Slajd 1: Komórka\nBłona, cytoplazma\nNotatki prowadzącego: Na kolokwium!/);
  assert.match(text, /Slajd 2: Mitochondrium\n\[Obraz ze slajdu 2 dołączony osobno jako „Wykład 3\.pptx — slajd 2”\]/);
  assert.deepEqual(stats, { decks: 1, slides: 2, deckImages: 1, deckImagesCapped: 0, photos: 1, images: 2, textChars: text.length });
});

test("prepareMaterials: global image cap counts photos first and spreads slide images over the deck", () => {
  const media: Record<string, Uint8Array> = {};
  const slides: SlideSpec[] = [];
  for (let i = 0; i < 30; i++) {
    media[`p${i}.png`] = png(800, 600, 20_000, 100 + i);
    slides.push({ title: `S${i + 1}`, images: [`p${i}.png`] });
  }
  const deck = asMaterial(buildPptx(slides, { media }));
  const photos = Array.from({ length: 4 }, (_, i): MaterialInput => ({ mime: "image/png", data: png(1000, 1000, 20_000, 500 + i), name: `f${i}.png` }));
  const { materials, stats } = prepareMaterials([...photos, deck], { maxImages: 10 });
  const slideImgs = materials.filter((m) => m.name?.includes("— slajd"));
  assert.equal(slideImgs.length, 6);
  assert.equal(stats.deckImagesCapped, 24);
  assert.equal(stats.images, 10);
  const nums = slideImgs.map((m) => Number(/slajd (\d+)/.exec(m.name!)![1]));
  assert.ok(nums[0]! <= 5 && nums.at(-1)! >= 26, `spread over the deck: ${nums}`);
  const text = Buffer.from(materials.find((m) => m.mime === "text/plain")!.data as Uint8Array).toString("utf8");
  assert.equal((text.match(/dołączony osobno/g) ?? []).length, 6);
});

test("prepareMaterials: a photo over 2000 px keeps the whole request at 20 images", () => {
  const media: Record<string, Uint8Array> = {};
  const slides: SlideSpec[] = [];
  for (let i = 0; i < 30; i++) {
    media[`p${i}.png`] = png(800, 600, 20_000, 200 + i);
    slides.push({ title: `S${i + 1}`, images: [`p${i}.png`] });
  }
  const big: MaterialInput = { mime: "image/jpeg", data: jpeg(4032, 3024), name: "tablica.jpg" };
  const { stats } = prepareMaterials([big, asMaterial(buildPptx(slides, { media }))]);
  assert.equal(stats.images, MAX_IMAGES_ANY_SIZE);
  const small: MaterialInput = { mime: "image/jpeg", data: jpeg(1600, 1200), name: "tablica.jpg" };
  assert.equal(prepareMaterials([small, asMaterial(buildPptx(slides, { media }))]).stats.images, 31);
});

test("prepareMaterials: unsupported type and broken decks throw MaterialError with the API code", () => {
  assert.equal(code(() => prepareMaterials([{ mime: "application/msword", data: new Uint8Array(10), name: "a.doc" }])), "bad_materials");
  const cfb = new Uint8Array(512);
  cfb.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  assert.equal(code(() => prepareMaterials([asMaterial(cfb)])), "pptx_protected");
  assert.equal(code(() => prepareMaterials([asMaterial(strToU8("nope"))])), "bad_pptx");
  assert.equal(code(() => prepareMaterials([asMaterial(buildPptx([{}]))])), "pptx_empty");
  // non-PPTX materials pass through untouched
  const pdf: MaterialInput = { mime: "application/pdf", data: strToU8("%PDF"), name: "a.pdf" };
  assert.deepEqual(prepareMaterials([pdf]).materials, [pdf]);
});

// ---------- route intake order (charge only after the materials are known to be usable) ----------

function intakeHarness(files: Record<string, Uint8Array>, opts: { precheckFails?: boolean; downloadFails?: boolean } = {}) {
  const calls: string[] = [];
  const deps = {
    precheck: async () => {
      calls.push("precheck");
      return opts.precheckFails ? { ok: false as const, status: 402, code: "limit_reached", message: "limit", extra: { used: 3, limit: 3 } } : null;
    },
    download: async (r: IntakeRow) => {
      calls.push(`download:${r.id}`);
      if (opts.downloadFails) throw new Error("storage down");
      return files[r.id]!;
    },
    reserve: async () => {
      calls.push("reserve");
      return { ok: true as const, value: { used: 1, limit: 3 } };
    },
  };
  return { calls, deps };
}

const row = (id: string, mime: string): IntakeRow => ({ id, mime, storage_path: `u/${id}`, size_bytes: 1, name: `${id}` });

test("intake: an unknown MIME is rejected before download and before the charge", async () => {
  const h = intakeHarness({});
  const r = await intakeMaterials([row("a", "image/png"), row("b", "application/vnd.ms-powerpoint")], h.deps);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.code, "bad_materials");
  assert.equal(!r.ok && r.status, 400);
  assert.deepEqual(h.calls, []);
});

test("intake: PPTX errors return 400 with their code and nothing is charged", async () => {
  const cfb = new Uint8Array(512);
  cfb.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  for (const [data, want] of [
    [cfb, "pptx_protected"],
    [strToU8("garbage"), "bad_pptx"],
    [buildPptx([{}]), "pptx_empty"],
  ] as const) {
    const h = intakeHarness({ d: data });
    const r = await intakeMaterials([row("d", PPTX_MIME)], h.deps);
    assert.equal(!r.ok && r.code, want);
    assert.equal(!r.ok && r.status, 400);
    assert.ok(!h.calls.includes("reserve"), `${want}: ${h.calls}`);
  }
});

test("intake: quota pre-check stops before downloading; a failed download is not charged", async () => {
  const pre = intakeHarness({}, { precheckFails: true });
  const r1 = await intakeMaterials([row("a", "application/pdf")], pre.deps);
  assert.equal(!r1.ok && r1.code, "limit_reached");
  assert.deepEqual(pre.calls, ["precheck"]);

  const dl = intakeHarness({}, { downloadFails: true });
  const r2 = await intakeMaterials([row("a", "application/pdf")], dl.deps);
  assert.equal(!r2.ok && r2.code, "download_failed");
  assert.ok(!dl.calls.includes("reserve"));
});

test("intake: valid materials are charged once, after download and unpacking", async () => {
  const deck = buildPptx([{ title: "Temat", body: ["treść"] }]);
  const h = intakeHarness({ d: deck, p: strToU8("%PDF-1.7") });
  const r = await intakeMaterials([row("p", "application/pdf"), row("d", PPTX_MIME)], h.deps);
  assert.ok(r.ok);
  assert.deepEqual(h.calls.slice(0, 1), ["precheck"]);
  assert.deepEqual(h.calls.slice(-1), ["reserve"]);
  assert.equal(h.calls.filter((c) => c === "reserve").length, 1);
  assert.deepEqual(
    r.ok && r.materials.map((m) => m.mime),
    ["application/pdf", "text/plain"],
  );
  assert.deepEqual(r.ok && r.reserved, { used: 1, limit: 3 });

  // text-only / prompt mode: no materials → straight to the charge, no pre-check or download
  const t = intakeHarness({});
  const r3 = await intakeMaterials([], t.deps);
  assert.ok(r3.ok);
  assert.deepEqual(t.calls, ["reserve"]);
});

test("intake: a refused charge is passed through", async () => {
  const r = await intakeMaterials([], {
    download: async () => new Uint8Array(),
    reserve: async () => ({ ok: false as const, status: 402, code: "limit_reached", message: "Wykorzystano 3/3", extra: { used: 3, limit: 3 } }),
  });
  assert.deepEqual(r, { ok: false, status: 402, code: "limit_reached", message: "Wykorzystano 3/3", extra: { used: 3, limit: 3 } });
});

// ---------- review fixes: linear XML scan, shared budget, real sizes, text budget ----------

test("malformed XML costs linear time (no backtracking over the whole part)", () => {
  const time = (xml: string) => {
    const z = zipSync({ "ppt/slides/slide1.xml": strToU8(xml) });
    const t = performance.now();
    try {
      extractPptx(z);
    } catch {
      /* empty / bad deck is fine — only the time matters */
    }
    return performance.now() - t;
  };
  const n = 400_000; // ~2.4 MB of XML; the old regexes needed minutes for this
  for (const xml of ["<p:sld".repeat(n), "<p:sld>" + "<p:sp ".repeat(n), "<p:sld><p:sp>" + "<a:p>".repeat(n) + "</p:sp>", "<p:sld><p:sp><a:p>" + "<a:t>".repeat(n) + "</a:p></p:sp>", "<p:sld><p:sp><p:ph ".repeat(n / 4)]) {
    const ms = time(xml);
    assert.ok(ms < 1500, `${xml.slice(0, 20)}… took ${Math.round(ms)} ms`);
  }
});

test("tokenizer reads the same text as before: runs, breaks, tabs, tables, placeholders, self-closing paragraphs", () => {
  const slide = `<p:sld ${NS}><p:cSld><p:spTree>
    <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Ty</a:t></a:r><a:r><a:t xml:space="preserve">tuł &amp; co</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:txBody><a:p/><a:p><a:pPr/><a:r><a:t>Linia</a:t></a:r><a:br/><a:r><a:t>druga</a:t></a:r><a:tab/><a:r><a:t>x</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>7</a:t></a:r></a:p></p:txBody></p:sp>
    <p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>A</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>B</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>
  </p:spTree></p:cSld></p:sld>`;
  const r = extractPptx(zipSync({ "ppt/slides/slide1.xml": strToU8(slide) }));
  assert.equal(r.slides[0]!.title, "Tytuł & co");
  assert.equal(r.slides[0]!.body, "Linia\ndruga x\nA | B");
});

test("a notes part shared by every slide is read once", () => {
  const files: Zippable = {};
  for (let i = 1; i <= 50; i++) {
    files[`ppt/slides/slide${i}.xml`] = strToU8(`<p:sld ${NS}><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>S${i}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
    files[`ppt/slides/_rels/slide${i}.xml.rels`] = strToU8(`<Relationships><Relationship Id="rId1" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`);
  }
  files["ppt/notesSlides/notesSlide1.xml"] = strToU8(`<p:notes ${NS}><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${"n".repeat(100_000)}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`);
  const budget = newPptxBudget();
  const r = extractPptx(zipSync(files), { budget });
  assert.equal(r.slides.filter((s) => s.notes).length, 1);
  assert.ok(newPptxBudget().xmlChars - budget.xmlChars < 200_000);
});

test("one budget is shared by all decks of a generation: unpacked bytes, XML read, kept image bytes", () => {
  const media: Record<string, Uint8Array> = {};
  const slides: SlideSpec[] = [];
  for (let i = 0; i < 10; i++) {
    media[`p${i}.png`] = png(800, 600, 1 * MB, 300 + i);
    slides.push({ title: `S${i + 1}`, images: [`p${i}.png`] });
  }
  const deck = buildPptx(slides, { media });
  // kept image bytes: 10 MB of budget keeps the 10 images (1 MB each) of the first deck... and none of the second
  const budget = newPptxBudget({ imageBytes: 10 * MB });
  assert.equal(extractPptx(deck, { budget }).images.length, 10);
  assert.equal(budget.imageBytes, 0);
  const second = extractPptx(deck, { budget });
  assert.equal(second.images.length, 0);
  assert.equal(second.stats.images.capped, 10);
  assert.equal(second.slides.length, 10); // text is still read
  // unpacked images: two decks of ~10 MB of images with a 15 MB budget → the second one keeps its text, skips 5 images uninflated
  const media15 = newPptxBudget({ mediaBytes: 15 * MB });
  assert.equal(extractPptx(deck, { budget: media15 }).images.length, 10);
  const rest = extractPptx(deck, { budget: media15 });
  assert.equal(rest.images.length, 5);
  assert.equal(rest.stats.images.capped, 5);
  assert.equal(rest.slides.length, 10);
  // unpacked XML: over the budget → bad_pptx before anything is inflated
  assert.equal(code(() => extractPptx(deck, { budget: newPptxBudget({ unpackedBytes: 1000 }) })), "bad_pptx");
  // XML characters
  assert.equal(code(() => extractPptx(deck, { budget: newPptxBudget({ xmlChars: 100 }) })), "bad_pptx");
});

test("prepareMaterials: the image cap is applied while unpacking and shared fairly between decks", () => {
  const mk = (seed: number) => {
    const media: Record<string, Uint8Array> = {};
    const slides: SlideSpec[] = [];
    for (let i = 0; i < 30; i++) {
      media[`p${i}.png`] = png(800, 600, 20_000, seed + i);
      slides.push({ title: `S${i + 1}`, images: [`p${i}.png`] });
    }
    return asMaterial(buildPptx(slides, { media }), `d${seed}.pptx`);
  };
  const { materials, stats } = prepareMaterials([mk(1000), mk(2000), mk(3000)]);
  const per = [1000, 2000, 3000].map((s) => materials.filter((m) => m.name?.startsWith(`d${s}.pptx — slajd`)).length);
  assert.deepEqual(per, [14, 13, 13]);
  assert.equal(stats.images, 40);
  assert.equal(stats.deckImages, 90);
  assert.equal(stats.deckImagesCapped, 50);
});

test("MaterialError names the file", () => {
  try {
    prepareMaterials([asMaterial(strToU8("nope"), "Wykład 9.pptx")]);
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e instanceof MaterialError);
    assert.equal(e.file, "Wykład 9.pptx");
  }
});

test("intake: real downloaded sizes are checked (size_bytes is client-written) before the charge", async () => {
  const big = new Uint8Array(3 * MB);
  const h = intakeHarness({ a: big, b: big, c: big, d: big });
  const r = await intakeMaterials([row("a", "application/pdf"), row("b", "application/pdf"), row("c", "application/pdf"), row("d", "application/pdf")], { ...h.deps, maxTotalMb: 7, maxFileMb: 5 });
  assert.equal(!r.ok && r.code, "too_much_material");
  assert.equal(!r.ok && r.status, 400);
  assert.ok(!h.calls.includes("reserve"));
  assert.ok(h.calls.filter((c) => c.startsWith("download")).length <= 4);

  const one = intakeHarness({ a: new Uint8Array(6 * MB) });
  const r2 = await intakeMaterials([row("a", "application/pdf")], { ...one.deps, maxTotalMb: 150, maxFileMb: 5 });
  assert.equal(!r2.ok && r2.code, "file_too_big");
  assert.deepEqual(!r2.ok && r2.extra, { name: "a", maxMb: 5 });
  assert.ok(!one.calls.includes("reserve"));
});

test("intake: too much text is rejected as too_long before the charge", async () => {
  const deck = buildPptx([{ title: "Temat", body: ["x".repeat(5000)] }]);
  const h = intakeHarness({ d: deck });
  const r = await intakeMaterials([row("d", PPTX_MIME)], { ...h.deps, maxTextChars: 4000 });
  assert.equal(!r.ok && r.code, "too_long");
  assert.equal(!r.ok && r.status, 400);
  assert.ok(!h.calls.includes("reserve"));
  // pasted text counts too
  const t = intakeHarness({});
  const r2 = await intakeMaterials([], { ...t.deps, pastedChars: 5000, maxTextChars: 4000 });
  assert.equal(!r2.ok && r2.code, "too_long");
  assert.deepEqual(t.calls, []);
});

test("intake: PPTX errors carry the file name", async () => {
  const h = intakeHarness({ d: strToU8("garbage") });
  const r = await intakeMaterials([row("d", PPTX_MIME)], h.deps);
  assert.equal(!r.ok && r.code, "bad_pptx");
  assert.deepEqual(!r.ok && r.extra, { name: "d" });
});
