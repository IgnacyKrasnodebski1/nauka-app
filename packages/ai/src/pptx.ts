import { createHash } from "node:crypto";
import { unzipSync, strFromU8, type UnzipFileInfo } from "fflate";

/**
 * PowerPoint (.pptx) → slide text (with speaker notes) + slide images, without native dependencies.
 *
 * A .pptx is a ZIP of XML parts. We unpack only the parts we need (fflate), read the XML with a small
 * `indexOf` tokenizer (the subset we touch is flat and well known; no backtracking regexes over a whole part, so
 * malformed XML costs linear time), and pick images by reading their headers — no `sharp`.
 *
 * Zip-bomb guards: entry count, the declared uncompressed size of all entries together, and per extracted entry.
 * fflate allocates exactly the declared size for each inflated entry and never grows it, so a lying header
 * cannot make an entry use more memory than declared. A {@link PptxBudget} shared by all decks of one generation
 * caps what is unpacked, read and kept across decks (memory does not grow with the number of decks).
 */

const MB = 1024 * 1024;

export const PPTX_LIMITS = {
  /** ZIP entries in one file. */
  maxEntries: 3000,
  /** Declared uncompressed size of all entries together. */
  maxTotalBytes: 200 * MB,
  /** Declared uncompressed size of one entry we unpack (XML parts; images have their own, lower cap). */
  maxEntryBytes: 5 * MB,
  /** Slides read from one deck (the rest is skipped). */
  maxSlides: 300,
  /** Characters of slide text + notes kept from one deck. */
  maxChars: 400_000,
  /** Smaller images are icons, bullets or lines. */
  minImageBytes: 15 * 1024,
  /** Claude's per-image limit. */
  maxImageBytes: 5 * MB,
  /** Longest side; with more than 20 images in one request Claude rejects anything bigger. */
  maxImagePx: 2000,
  /** An image on more than this share of slides is a logo or a background, not content. */
  logoShare: 0.4,
  /** ...but only when it appears on at least this many slides. */
  logoMinSlides: 3,
  /** Longest opening tag we read; a longer one is treated as broken XML (stops reading that part). */
  maxTagChars: 16 * 1024,
} as const;

/** Per-generation limits shared by every deck of one request (see {@link newPptxBudget}). */
export const PPTX_BUDGET = {
  /** Declared size of the XML parts we unpack, all decks together (over it → `bad_pptx`). */
  unpackedBytes: 100 * MB,
  /** Declared size of the images we unpack, all decks together (over it, further images are skipped). */
  mediaBytes: 200 * MB,
  /** XML characters read, all decks together (a notes / diagram part shared by many slides is read once). */
  xmlChars: 200_000_000,
  /** Bytes of slide images kept in memory after parsing, all decks together. */
  imageBytes: 80 * MB,
  /** Wall-clock budget for parsing all decks. */
  ms: 30_000,
} as const;

/** Mutable budget shared by all decks of one generation; every {@link extractPptx} call spends from it. */
export interface PptxBudget {
  unpackedBytes: number;
  mediaBytes: number;
  xmlChars: number;
  imageBytes: number;
  /** Date.now() after which parsing stops with `bad_pptx`. */
  deadline: number;
}

export function newPptxBudget(over: Partial<Omit<PptxBudget, "deadline">> & { ms?: number } = {}): PptxBudget {
  return {
    unpackedBytes: over.unpackedBytes ?? PPTX_BUDGET.unpackedBytes,
    mediaBytes: over.mediaBytes ?? PPTX_BUDGET.mediaBytes,
    xmlChars: over.xmlChars ?? PPTX_BUDGET.xmlChars,
    imageBytes: over.imageBytes ?? PPTX_BUDGET.imageBytes,
    deadline: Date.now() + (over.ms ?? PPTX_BUDGET.ms),
  };
}

/** `k` indexes spread evenly over `0..n-1` (all of them when k ≥ n). */
export function spread(n: number, k: number): number[] {
  if (k >= n) return Array.from({ length: n }, (_, i) => i);
  if (k <= 0) return [];
  return Array.from({ length: k }, (_, i) => Math.floor(((i + 0.5) * n) / k));
}

export type PptxErrorCode = "bad_pptx" | "pptx_protected" | "pptx_empty";

export class PptxError extends Error {
  constructor(
    public readonly code: PptxErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PptxError";
  }
}

export type ImageMime = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export interface PptxImage {
  /** 1-based slide number (position in the deck, hidden slides included). */
  slide: number;
  mime: ImageMime;
  data: Uint8Array;
  width: number;
  height: number;
  sha1: string;
}

export interface PptxSlide {
  /** 1-based position in the deck. */
  n: number;
  title: string;
  /** Body text: one paragraph per line, table rows as `a | b | c`. */
  body: string;
  /** Speaker notes. */
  notes: string;
}

export interface PptxStats {
  /** Slides in the deck. */
  slides: number;
  /** Hidden slides skipped. */
  hidden: number;
  /** True when the deck had more than {@link PPTX_LIMITS.maxSlides} slides. */
  slidesTruncated: boolean;
  /** True when the text hit {@link PPTX_LIMITS.maxChars}. */
  charsTruncated: boolean;
  images: {
    kept: number;
    duplicate: number;
    logo: number;
    small: number;
    big: number;
    oversizePx: number;
    unsupported: number;
    broken: number;
    /** left out by the per-generation image cap (count or bytes) */
    capped: number;
  };
}

export interface PptxResult {
  /** Slides that have text or kept images, in deck order. */
  slides: PptxSlide[];
  /** Kept images in deck order (deduplicated, logos dropped). */
  images: PptxImage[];
  /** Characters of title + body + notes. */
  chars: number;
  stats: PptxStats;
}

// ---------- binary sniffing ----------

const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** OLE compound file: an old binary .ppt, or an OOXML file encrypted with a password. */
export function isCfb(d: Uint8Array): boolean {
  return d.length >= 8 && CFB_MAGIC.every((b, i) => d[i] === b);
}

function isZip(d: Uint8Array): boolean {
  return d.length >= 4 && d[0] === 0x50 && d[1] === 0x4b && (d[2] === 3 || d[2] === 5 || d[2] === 7) && (d[3] === 4 || d[3] === 6 || d[3] === 8);
}

const be16 = (d: Uint8Array, i: number) => (d[i]! << 8) | d[i + 1]!;
const le16 = (d: Uint8Array, i: number) => d[i]! | (d[i + 1]! << 8);
const be32 = (d: Uint8Array, i: number) => ((d[i]! << 24) >>> 0) + (d[i + 1]! << 16) + (d[i + 2]! << 8) + d[i + 3]!;
const le24 = (d: Uint8Array, i: number) => d[i]! | (d[i + 1]! << 8) | (d[i + 2]! << 16);
const ascii = (d: Uint8Array, i: number, n: number) => String.fromCharCode(...d.subarray(i, i + n));

/**
 * Type and pixel size of a PNG/JPEG/GIF/WebP read from its header. `null` for anything else
 * (EMF, WMF, TIFF, SVG, BMP…) or a header we cannot read.
 */
export function imageInfo(d: Uint8Array): { mime: ImageMime; width: number; height: number } | null {
  if (d.length < 12) return null;
  // PNG: signature, then IHDR
  if (d[0] === 0x89 && ascii(d, 1, 3) === "PNG") {
    if (d.length < 24 || ascii(d, 12, 4) !== "IHDR") return null;
    return ok("image/png", be32(d, 16), be32(d, 20));
  }
  // GIF
  if (ascii(d, 0, 4) === "GIF8") return ok("image/gif", le16(d, 6), le16(d, 8));
  // WebP
  if (ascii(d, 0, 4) === "RIFF" && ascii(d, 8, 4) === "WEBP" && d.length >= 30) {
    const chunk = ascii(d, 12, 4);
    if (chunk === "VP8 ") return ok("image/webp", le16(d, 26) & 0x3fff, le16(d, 28) & 0x3fff);
    if (chunk === "VP8L") {
      const b0 = d[21]!,
        b1 = d[22]!,
        b2 = d[23]!,
        b3 = d[24]!;
      return ok("image/webp", 1 + (((b1 & 0x3f) << 8) | b0), 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)));
    }
    if (chunk === "VP8X") return ok("image/webp", 1 + le24(d, 24), 1 + le24(d, 27));
    return null;
  }
  // JPEG: walk the markers up to the first SOFn
  if (d[0] === 0xff && d[1] === 0xd8) {
    let i = 2;
    while (i + 3 < d.length) {
      if (d[i] !== 0xff) return null;
      let m = d[i + 1]!;
      while (m === 0xff && i + 2 < d.length) m = d[++i + 1]!; // fill bytes
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        i += 2;
        continue;
      }
      if (m === 0xd9 || m === 0xda) return null; // end / start of scan before any frame header
      const len = be16(d, i + 2);
      if (len < 2) return null;
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        if (i + 8 >= d.length) return null;
        return ok("image/jpeg", be16(d, i + 7), be16(d, i + 5));
      }
      i += 2 + len;
    }
    return null;
  }
  return null;

  function ok(mime: ImageMime, width: number, height: number) {
    return width > 0 && height > 0 ? { mime, width, height } : null;
  }
}

// ---------- XML helpers ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (all, e: string) => {
    if (e[0] !== "#") return ENTITIES[e] ?? all;
    const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
  });
}

/** A tag name ends here: whitespace, `>` or `/` (like `\b` after the name, but `<a:p` never matches `<a:pPr`). */
function nameEnds(xml: string, i: number): boolean {
  const c = xml.charCodeAt(i);
  return c === 0x3e /* > */ || c === 0x2f /* / */ || c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;
}

interface OpenTag {
  start: number;
  /** index just past `>` */
  end: number;
  tag: string;
  selfClosing: boolean;
}

/**
 * First opening tag `<name …>` at or after `from`. `null` when there is none, or when it is broken (no `>`, or longer
 * than {@link PPTX_LIMITS.maxTagChars}) — callers stop reading the part there. Linear in the scanned text.
 */
function openTag(xml: string, name: string, from = 0): OpenTag | null {
  const needle = `<${name}`;
  let i = xml.indexOf(needle, from);
  while (i >= 0 && !nameEnds(xml, i + needle.length)) i = xml.indexOf(needle, i + 1);
  if (i < 0) return null;
  const gt = xml.indexOf(">", i + needle.length);
  if (gt < 0 || gt - i > PPTX_LIMITS.maxTagChars) return null;
  return { start: i, end: gt + 1, tag: xml.slice(i, gt + 1), selfClosing: xml.charCodeAt(gt - 1) === 0x2f };
}

/** Every opening tag `<name …>` in order (stops at the first broken one). */
function* openTags(xml: string, name: string): Generator<string> {
  let from = 0;
  for (;;) {
    const t = openTag(xml, name, from);
    if (!t) return;
    yield t.tag;
    from = t.end;
  }
}

interface Element {
  start: number;
  /** index just past the closing tag */
  end: number;
  /** the opening tag */
  tag: string;
  /** text between the opening and the closing tag ("" for `<x/>`) */
  inner: string;
}

/** First element `<name …>…</name>` (or `<name/>`) at or after `from`; `null` when none or unclosed. Not nesting-aware (the parts we read never nest a tag in itself). */
function element(xml: string, name: string, from = 0): Element | null {
  const t = openTag(xml, name, from);
  if (!t) return null;
  if (t.selfClosing) return { start: t.start, end: t.end, tag: t.tag, inner: "" };
  const close = `</${name}>`;
  const c = xml.indexOf(close, t.end);
  if (c < 0) return null;
  return { start: t.start, end: c + close.length, tag: t.tag, inner: xml.slice(t.end, c) };
}

/** Every element `<name>…</name>` in order (stops at the first unclosed one). */
function* elements(xml: string, name: string): Generator<Element> {
  let from = 0;
  for (;;) {
    const e = element(xml, name, from);
    if (!e) return;
    yield e;
    from = e.end;
  }
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name.replace(":", "\\:")}="([^"]*)"`).exec(tag);
  return m ? decodeXml(m[1]!) : undefined;
}

interface Rel {
  type: string;
  target: string;
  external: boolean;
}

function parseRels(xml: string | undefined): Map<string, Rel> {
  const out = new Map<string, Rel>();
  if (!xml) return out;
  for (const tag of openTags(xml, "Relationship")) {
    const id = attr(tag, "Id"),
      target = attr(tag, "Target");
    if (!id || !target) continue;
    out.set(id, { type: attr(tag, "Type") ?? "", target, external: attr(tag, "TargetMode") === "External" });
  }
  return out;
}

/** Resolve a relationship target against the folder of the part that owns the .rels file. */
function resolvePart(baseDir: string, target: string): string {
  const parts = target.startsWith("/") ? [] : baseDir.split("/").filter(Boolean);
  for (const seg of target.replace(/^\/+/, "").split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

function relsPathOf(part: string): string {
  const i = part.lastIndexOf("/");
  return `${part.slice(0, i)}/_rels/${part.slice(i + 1)}.rels`;
}

function dirOf(part: string): string {
  return part.slice(0, part.lastIndexOf("/"));
}

const norm = (s: string) => s.replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").trim();

/** Text of one paragraph's inner XML: `<a:t>` runs, `<a:br/>` → new line, `<a:tab/>` → space. */
function runsText(inner: string): string {
  let s = "";
  let pos = 0;
  for (;;) {
    const i = inner.indexOf("<a:", pos);
    if (i < 0) break;
    if (inner.startsWith("<a:t", i) && nameEnds(inner, i + 4)) {
      const gt = inner.indexOf(">", i + 4);
      if (gt < 0) break;
      if (inner.charCodeAt(gt - 1) === 0x2f) {
        pos = gt + 1; // <a:t/>
        continue;
      }
      const c = inner.indexOf("</a:t>", gt + 1);
      if (c < 0) break;
      s += decodeXml(inner.slice(gt + 1, c));
      pos = c + 6;
    } else if ((inner.startsWith("<a:br", i) && nameEnds(inner, i + 5)) || (inner.startsWith("<a:tab", i) && nameEnds(inner, i + 6))) {
      const gt = inner.indexOf(">", i);
      if (gt < 0) break;
      s += inner.startsWith("<a:br", i) ? "\n" : " ";
      pos = gt + 1;
    } else pos = i + 3;
  }
  return s;
}

/** Text of every `<a:p>` in an XML fragment, one string per non-empty paragraph. */
function paragraphs(xml: string): string[] {
  const out: string[] = [];
  for (const p of elements(xml, "a:p")) {
    if (!p.inner) continue;
    const s = norm(runsText(p.inner));
    if (s) out.push(s);
  }
  return out;
}

/** Placeholders whose text is chrome (slide number, date, footer) or a picture of the slide (notes pages). */
const SKIP_PLACEHOLDERS = new Set(["sldNum", "dt", "ftr", "hdr", "sldImg"]);
const TITLE_PLACEHOLDERS = new Set(["title", "ctrTitle"]);

/** Shape text and tables of a slide (or notes) part, in document order. */
function readShapes(xml: string): { title: string[]; body: string[] } {
  const title: string[] = [];
  const body: string[] = [];
  let from = 0;
  // next shape / table at or after `from`; recomputed only when the cursor has passed it (keeps the scan linear)
  let sp: Element | null | undefined;
  let tbl: Element | null | undefined;
  for (;;) {
    if (sp !== null && (!sp || sp.start < from)) sp = element(xml, "p:sp", from);
    if (tbl !== null && (!tbl || tbl.start < from)) tbl = element(xml, "a:tbl", from);
    const next = sp && (!tbl || sp.start < tbl.start) ? sp : tbl;
    if (!next) break;
    from = next.end;
    if (next === tbl) {
      for (const row of elements(next.inner, "a:tr")) {
        const cells = [...elements(row.inner, "a:tc")].map((c) => paragraphs(c.inner).join(" ")).filter(Boolean);
        if (cells.length) body.push(cells.join(" | "));
      }
      continue;
    }
    const ph = openTag(next.inner, "p:ph")?.tag;
    const phType = ph ? (attr(ph, "type") ?? "body") : undefined;
    if (phType && SKIP_PLACEHOLDERS.has(phType)) continue;
    const ps = paragraphs(next.inner);
    if (phType && TITLE_PLACEHOLDERS.has(phType)) title.push(...ps);
    else body.push(...ps);
  }
  return { title, body };
}

// ---------- main ----------

const IMAGE_EXT = /\.(png|jpe?g|jpe|gif|webp)$/i;
const REL_IMAGE = /\/image$/;
const REL_NOTES = /\/notesSlide$/;
const REL_DIAGRAM_DATA = /\/diagramData$/;
const REL_SLIDE = /\/slide$/;

function wanted(name: string): boolean {
  return (
    name === "[Content_Types].xml" ||
    name === "ppt/presentation.xml" ||
    name === "ppt/_rels/presentation.xml.rels" ||
    /^ppt\/slides\/(_rels\/)?slide\d+\.xml(\.rels)?$/.test(name) ||
    /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name) ||
    /^ppt\/diagrams\/data\d+\.xml$/.test(name)
  );
}

function isMedia(name: string): boolean {
  return /^ppt\/media\//.test(name);
}

/**
 * Unpack a .pptx into slide text (title, body, tables, SmartArt, speaker notes) and content images.
 * Throws {@link PptxError}: `pptx_protected` (password / old binary .ppt), `bad_pptx` (not a readable deck,
 * or over the zip-bomb limits / the shared budget), `pptx_empty` (no text and no usable image).
 *
 * `opts.budget` is shared by all decks of one generation and spent by this call (unpacked bytes, XML characters,
 * kept image bytes, time). `opts.maxImages` caps the images kept from this deck (spread evenly over the deck).
 */
export function extractPptx(data: Uint8Array, opts: { budget?: PptxBudget; maxImages?: number } = {}): PptxResult {
  const budget = opts.budget ?? newPptxBudget();
  if (isCfb(data)) throw new PptxError("pptx_protected", "Prezentacja jest zabezpieczona hasłem albo zapisana w starym formacie (.ppt).");
  if (!isZip(data)) throw new PptxError("bad_pptx", "To nie jest plik PPTX.");

  const L = PPTX_LIMITS;
  let entries = 0;
  let total = 0;
  /** media parts we did not unpack, with the reason (counted when a slide references them) */
  const mediaSkipped = new Map<string, "small" | "big" | "unsupported" | "capped">();
  /** fflate allocates the declared size of every entry it inflates: charge it to the generation's budget first */
  const unpack = (size: number): true => {
    budget.unpackedBytes -= Math.max(0, size);
    if (budget.unpackedBytes < 0) throw new PptxError("bad_pptx", "Prezentacje po rozpakowaniu są za duże.");
    return true;
  };
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, {
      filter(f: UnzipFileInfo) {
        if (++entries > L.maxEntries) throw new PptxError("bad_pptx", `Prezentacja ma za dużo elementów (ponad ${L.maxEntries}).`);
        total += Math.max(0, f.originalSize);
        if (total > L.maxTotalBytes) throw new PptxError("bad_pptx", "Prezentacja po rozpakowaniu jest za duża.");
        if (isMedia(f.name)) {
          if (!IMAGE_EXT.test(f.name)) {
            mediaSkipped.set(f.name, "unsupported");
            return false;
          }
          if (f.originalSize > L.maxImageBytes) {
            mediaSkipped.set(f.name, "big");
            return false;
          }
          if (f.originalSize < L.minImageBytes) {
            mediaSkipped.set(f.name, "small");
            return false;
          }
          if (f.originalSize > budget.mediaBytes) {
            mediaSkipped.set(f.name, "capped"); // images are optional: past the generation's budget they are skipped, not an error
            return false;
          }
          budget.mediaBytes -= f.originalSize;
          return true;
        }
        if (!wanted(f.name)) return false;
        if (f.originalSize > L.maxEntryBytes) throw new PptxError("bad_pptx", "Prezentacja zawiera za duży element.");
        return unpack(f.originalSize);
      },
    });
  } catch (e) {
    if (e instanceof PptxError) throw e;
    throw new PptxError("bad_pptx", "Plik prezentacji jest uszkodzony.");
  }

  const text = (name: string): string | undefined => {
    const f = files[name];
    if (!f) return undefined;
    if (Date.now() > budget.deadline) throw new PptxError("bad_pptx", "Odczyt prezentacji trwa za długo.");
    let s: string;
    try {
      s = strFromU8(f);
    } catch {
      return undefined;
    }
    budget.xmlChars -= s.length;
    if (budget.xmlChars < 0) throw new PptxError("bad_pptx", "Prezentacja ma za dużo treści do odczytania.");
    return s;
  };
  /** notes / SmartArt parts already read (a part shared by many slides is read once) */
  const readParts = new Set<string>();

  // slide order: presentation.xml → sldIdLst → rels; fallback: slideN.xml by N
  let slideParts: string[] = [];
  const pres = text("ppt/presentation.xml");
  if (pres) {
    const rels = parseRels(text("ppt/_rels/presentation.xml.rels"));
    const lst = element(pres, "p:sldIdLst")?.inner ?? "";
    for (const tag of openTags(lst, "p:sldId")) {
      const rid = attr(tag, "r:id");
      const rel = rid ? rels.get(rid) : undefined;
      if (rel && !rel.external && REL_SLIDE.test(rel.type)) slideParts.push(resolvePart("ppt", rel.target));
    }
  }
  if (!slideParts.length) {
    slideParts = Object.keys(files)
      .map((n) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(n))
      .filter((m): m is RegExpExecArray => !!m)
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .map((m) => m[0]);
  }
  if (!pres && !slideParts.length) throw new PptxError("bad_pptx", "To nie jest prezentacja PowerPoint.");

  const stats: PptxStats = {
    slides: slideParts.length,
    hidden: 0,
    slidesTruncated: slideParts.length > L.maxSlides,
    charsTruncated: false,
    images: { kept: 0, duplicate: 0, logo: 0, small: 0, big: 0, oversizePx: 0, unsupported: 0, broken: 0, capped: 0 },
  };

  interface Candidate {
    slide: number;
    part: string;
  }
  const slides: PptxSlide[] = [];
  const candidates: Candidate[] = [];
  let chars = 0;
  let visible = 0;

  for (let i = 0; i < Math.min(slideParts.length, L.maxSlides); i++) {
    if (chars >= L.maxChars) {
      stats.charsTruncated = true;
      break;
    }
    const n = i + 1;
    const part = slideParts[i]!;
    const xml = text(part);
    if (!xml) continue;
    const sld = openTag(xml, "p:sld")?.tag ?? "";
    if (attr(sld, "show") === "0") {
      stats.hidden++;
      continue;
    }
    visible++;
    const rels = parseRels(text(relsPathOf(part)));
    const { title, body } = readShapes(xml);
    let notes = "";
    for (const rel of rels.values()) {
      if (rel.external) continue;
      const target = resolvePart(dirOf(part), rel.target);
      if (REL_IMAGE.test(rel.type)) candidates.push({ slide: n, part: target });
      else if (readParts.has(target)) continue;
      else if (REL_NOTES.test(rel.type)) {
        readParts.add(target);
        const nx = text(target);
        if (nx) {
          const ns = readShapes(nx);
          notes = [...ns.title, ...ns.body].join("\n");
        }
      } else if (REL_DIAGRAM_DATA.test(rel.type)) {
        readParts.add(target);
        const dx = text(target);
        if (dx) body.push(...paragraphs(dx));
      }
    }
    const slide: PptxSlide = { n, title: title.join(" — "), body: body.join("\n"), notes };
    let size = slide.title.length + slide.body.length + slide.notes.length;
    if (chars + size > L.maxChars) {
      // cut this slide to what is left, then stop
      let left = L.maxChars - chars;
      const cut = (s: string) => {
        const out = s.slice(0, Math.max(0, left));
        left -= out.length;
        return out;
      };
      slide.title = cut(slide.title);
      slide.body = cut(slide.body);
      slide.notes = cut(slide.notes);
      size = slide.title.length + slide.body.length + slide.notes.length;
      stats.charsTruncated = true;
    }
    chars += size;
    slides.push(slide);
  }

  // images: one occurrence per (slide, part); count slides per content hash for the logo rule
  type Info = { mime: ImageMime; width: number; height: number; sha1: string; data: Uint8Array } | { skip: keyof PptxStats["images"] };
  const byPart = new Map<string, Info>();
  const seenOnSlide = new Set<string>();
  const occurrences: { slide: number; info: Info }[] = [];
  for (const c of candidates) {
    let info = byPart.get(c.part);
    if (!info) {
      const skipped = mediaSkipped.get(c.part);
      const d = files[c.part];
      if (skipped) info = { skip: skipped };
      else if (!d) info = { skip: isMedia(c.part) ? "broken" : "unsupported" };
      else {
        const meta = imageInfo(d);
        if (!meta) info = { skip: "unsupported" };
        else if (d.byteLength < L.minImageBytes) info = { skip: "small" };
        else if (d.byteLength > L.maxImageBytes) info = { skip: "big" };
        else if (meta.width > L.maxImagePx || meta.height > L.maxImagePx) info = { skip: "oversizePx" };
        else info = { ...meta, data: d, sha1: createHash("sha1").update(d).digest("hex") };
      }
      byPart.set(c.part, info);
    }
    const key = `${c.slide}:${"sha1" in info ? info.sha1 : c.part}`;
    if (seenOnSlide.has(key)) continue; // same picture twice on one slide
    seenOnSlide.add(key);
    occurrences.push({ slide: c.slide, info });
  }
  const slidesPerHash = new Map<string, number>();
  for (const o of occurrences) if ("sha1" in o.info) slidesPerHash.set(o.info.sha1, (slidesPerHash.get(o.info.sha1) ?? 0) + 1);
  const isLogo = (h: string) => {
    const k = slidesPerHash.get(h) ?? 0;
    return k >= L.logoMinSlides && visible > 0 && k / visible > L.logoShare;
  };

  const found: PptxImage[] = [];
  const kept = new Set<string>();
  const countedSkip = new Set<string>();
  for (const o of occurrences) {
    const info = o.info;
    if ("skip" in info) {
      stats.images[info.skip]++;
      continue;
    }
    if (isLogo(info.sha1)) {
      if (!countedSkip.has(info.sha1)) stats.images.logo++;
      countedSkip.add(info.sha1);
      continue;
    }
    if (kept.has(info.sha1)) {
      stats.images.duplicate++;
      continue;
    }
    kept.add(info.sha1);
    found.push({ slide: o.slide, mime: info.mime, data: info.data, width: info.width, height: info.height, sha1: info.sha1 });
  }
  // per-deck image cap (spread over the deck), then the generation's byte budget for kept images
  const images: PptxImage[] = [];
  for (const i of spread(found.length, opts.maxImages ?? found.length)) {
    const img = found[i]!;
    if (img.data.byteLength > budget.imageBytes) continue;
    budget.imageBytes -= img.data.byteLength;
    images.push(img);
  }
  stats.images.capped += found.length - images.length;
  stats.images.kept = images.length;

  const imageSlides = new Set(images.map((im) => im.slide));
  const withContent = slides.filter((s) => s.title || s.body || s.notes || imageSlides.has(s.n));
  if (!chars && !found.length) throw new PptxError("pptx_empty", "Na slajdach nie ma tekstu ani obrazów.");
  return { slides: withContent, images, chars, stats };
}

/**
 * Plain text of a deck for the AI. `attached` = slide numbers whose images are sent as separate materials.
 * Format: a header line, then per slide "Slajd N: title", body lines, "Notatki prowadzącego: …".
 */
export function pptxToText(name: string, deck: PptxResult, attached: ReadonlySet<number> = new Set()): string {
  const lines: string[] = [`Prezentacja „${name}”, slajdów: ${deck.stats.slides}. Tekst ze slajdów i notatki prowadzącego.`];
  for (const s of deck.slides) {
    if (!s.title && !s.body && !s.notes && !attached.has(s.n)) continue;
    lines.push("");
    lines.push(s.title ? `Slajd ${s.n}: ${s.title}` : `Slajd ${s.n}:`);
    if (s.body) lines.push(s.body);
    if (s.notes) lines.push(`Notatki prowadzącego: ${s.notes}`);
    if (attached.has(s.n)) lines.push(`[Obraz ze slajdu ${s.n} dołączony osobno jako „${name} — slajd ${s.n}”]`);
  }
  if (deck.stats.slidesTruncated) lines.push("", `[Dalsze slajdy pominięte — czytamy najwyżej ${PPTX_LIMITS.maxSlides}.]`);
  else if (deck.stats.charsTruncated) lines.push("", "[Dalsza część prezentacji pominięta — za dużo tekstu.]");
  return lines.join("\n");
}
