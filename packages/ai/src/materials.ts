import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { isAcceptedMime, isAiMime, isPptx } from "@nauka/shared";
import { extractPptx, imageInfo, newPptxBudget, pptxToText, PptxError, PPTX_LIMITS, spread, type PptxBudget, type PptxErrorCode, type PptxResult } from "./pptx.js";

export interface MaterialInput {
  mime: string;
  /** file bytes: Buffer/Uint8Array or base64 string */
  data: Uint8Array | string;
  name?: string;
}

type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

/**
 * Images are sent inline (base64) while their combined raw size stays at or below this; above it they go through
 * the Files API too. 15 MB raw ≈ 20 MB base64, which keeps every Messages request under the 32 MB limit.
 */
export const INLINE_IMAGES_MAX_BYTES = 15 * 1024 * 1024;

/** Safety net: uploaded files expire on their own after an hour even if the cleanup in `finally` never runs. */
export const UPLOAD_TTL_SECONDS = 7200; // 2 h (dokumentacja: 3600–7776000) — zapas nad dolną granicą; pliki i tak kasujemy po generowaniu

function toBase64(d: Uint8Array | string): string {
  if (typeof d === "string") return d.replace(/\s+/g, "");
  return Buffer.from(d).toString("base64");
}

function toBytes(d: Uint8Array | string): Uint8Array {
  if (typeof d === "string") return Buffer.from(d.replace(/\s+/g, ""), "base64");
  return d;
}

function toText(d: Uint8Array | string): string {
  if (typeof d === "string") return Buffer.from(d, "base64").toString("utf8");
  return Buffer.from(d).toString("utf8");
}

/** Raw (decoded) size of a material in bytes. */
export function materialBytes(m: MaterialInput): number {
  return typeof m.data === "string" ? Buffer.byteLength(m.data.replace(/\s+/g, ""), "base64") : m.data.byteLength;
}

function labelOf(m: MaterialInput, i: number): string {
  return m.name ? `${m.name}` : `plik ${i + 1}`;
}

/**
 * Indexes of the materials that go through the Files API instead of inline base64:
 * every PDF, plus every image when all images together exceed {@link INLINE_IMAGES_MAX_BYTES}.
 * Text files always stay inline; unsupported types are left for materialsToBlocks to reject.
 */
export function materialsToUpload(materials: MaterialInput[]): number[] {
  const isImage = (m: MaterialInput) => isAcceptedMime(m.mime) && m.mime.startsWith("image/");
  const imageBytes = materials.reduce((sum, m) => (isImage(m) ? sum + materialBytes(m) : sum), 0);
  const uploadImages = imageBytes > INLINE_IMAGES_MAX_BYTES;
  const out: number[] = [];
  materials.forEach((m, i) => {
    if (m.mime === "application/pdf" || (uploadImages && isImage(m))) out.push(i);
  });
  return out;
}

/** Minimal slice of the Anthropic client used for uploads (lets tests pass a mock). */
export interface FilesClient {
  files: {
    upload(params: Anthropic.FileUploadParams, options?: { signal?: AbortSignal; maxRetries?: number; timeout?: number }): PromiseLike<{ id: string }>;
    delete(fileId: string, params?: Anthropic.FileDeleteParams | null, options?: { timeout?: number; maxRetries?: number }): PromiseLike<unknown>;
  };
}

/**
 * Per-request bound for cleanup deletes. The shared client allows 10 min × 3 attempts; cleanup runs in a `finally`
 * before generateTopic returns, so a stalled DELETE must not push a finished generation past the 300 s function limit.
 */
export const DELETE_TIMEOUT_MS = 10_000;

/** Thrown by {@link uploadMaterials} (the SDK error as `cause`); generate.ts maps it to a GenerationError — "ai_unavailable" when the cause is on our side (401/403/429/5xx/network), else "api". */
export class MaterialUploadError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "MaterialUploadError";
  }
}

function uploadFilename(m: MaterialInput, i: number): string {
  const ext = m.mime === "application/pdf" ? ".pdf" : `.${m.mime.slice(m.mime.indexOf("/") + 1).replace("jpeg", "jpg")}`;
  const base = (m.name ?? "")
    .split(/[\\/]/)
    .pop()!
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.[^.]*$/, "")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 80);
  return `${base || `material-${i + 1}`}${ext}`;
}

/**
 * Upload the materials picked by {@link materialsToUpload} to the Files API, all in parallel.
 * Returns an array aligned with `materials`: a file id, or undefined when the material is sent inline.
 *
 * Every successful upload is pushed to `uploaded` as soon as it finishes, so the caller can delete them in a
 * `finally` even when a sibling upload (or anything later) fails. Waits for all uploads to settle before throwing,
 * so nothing is still in flight when the caller cleans up.
 */
export async function uploadMaterials(
  client: FilesClient,
  materials: MaterialInput[],
  uploaded: string[],
  /** request options for every upload (the generation deadline's signal and retry budget) */
  requestOptions?: { signal?: AbortSignal; maxRetries?: number; timeout?: number },
): Promise<(string | undefined)[]> {
  const fileIds: (string | undefined)[] = new Array(materials.length).fill(undefined);
  const picked = materialsToUpload(materials);
  if (!picked.length) return fileIds;
  const results = await Promise.allSettled(
    picked.map(async (i) => {
      const m = materials[i]!;
      const file = await toFile(toBytes(m.data), uploadFilename(m, i), { type: m.mime });
      const meta = requestOptions ? await client.files.upload({ file, expires_in_seconds: UPLOAD_TTL_SECONDS }, requestOptions) : await client.files.upload({ file, expires_in_seconds: UPLOAD_TTL_SECONDS });
      uploaded.push(meta.id);
      fileIds[i] = meta.id;
    }),
  );
  const failedAt = results.findIndex((r) => r.status === "rejected");
  if (failedAt >= 0) {
    const i = picked[failedAt]!;
    const label = labelOf(materials[i]!, i);
    const reason = (results[failedAt] as PromiseRejectedResult).reason;
    const status = reason instanceof Anthropic.APIError && reason.status ? ` (${reason.status})` : "";
    console.error("[ai] files upload failed:", label, reason);
    throw new MaterialUploadError(`Nie udało się przesłać materiału „${label}” do AI${status}. Spróbuj ponownie za chwilę.`, reason);
  }
  return fileIds;
}

/** Best-effort cleanup of uploaded files. Never throws. */
export async function deleteUploadedFiles(client: FilesClient, fileIds: readonly string[]): Promise<void> {
  if (!fileIds.length) return;
  try {
    const results = await Promise.allSettled(fileIds.map(async (id) => client.files.delete(id, {}, { timeout: DELETE_TIMEOUT_MS, maxRetries: 1 })));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed) console.warn(`[ai] could not delete ${failed}/${fileIds.length} uploaded files (they expire after ${UPLOAD_TTL_SECONDS}s anyway)`);
  } catch {
    /* cleanup must never mask the real result */
  }
}

/**
 * Convert uploaded materials + pasted text into Messages API content blocks.
 * `fileIds[i]` (from {@link uploadMaterials}) turns material `i` into a Files API reference instead of inline base64.
 */
export function materialsToBlocks(
  materials: MaterialInput[],
  text?: string,
  fileIds: readonly (string | null | undefined)[] = [],
): { blocks: Anthropic.Beta.BetaContentBlockParam[]; summary: string } {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  let images = 0,
    pdfs = 0,
    texts = 0,
    pdfPages = 0,
    textWords = 0;
  materials.forEach((m, i) => {
    if (!isAcceptedMime(m.mime)) throw new Error(`Nieobsługiwany typ pliku: ${m.mime}`);
    const label = labelOf(m, i);
    const fileId = fileIds[i] || undefined;
    if (m.mime.startsWith("image/")) {
      images++;
      blocks.push({ type: "text", text: `[Materiał ${i + 1}: zdjęcie — ${label}]` });
      blocks.push({
        type: "image",
        source: fileId ? { type: "file", file_id: fileId } : { type: "base64", media_type: m.mime as ImageMime, data: toBase64(m.data) },
      });
    } else if (m.mime === "application/pdf") {
      pdfs++;
      pdfPages += pdfPageCount(toBytes(m.data));
      blocks.push({ type: "text", text: `[Materiał ${i + 1}: PDF — ${label}]` });
      blocks.push({
        type: "document",
        source: fileId ? { type: "file", file_id: fileId } : { type: "base64", media_type: "application/pdf", data: toBase64(m.data) },
        title: label,
      });
    } else {
      texts++;
      const body = toText(m.data);
      textWords += wordCount(body);
      blocks.push({ type: "document", source: { type: "text", media_type: "text/plain", data: body }, title: label });
    }
  });
  if (text && text.trim()) {
    texts++;
    textWords += wordCount(text);
    blocks.push({ type: "document", source: { type: "text", media_type: "text/plain", data: text.trim() }, title: "Wklejony tekst" });
  }
  const parts = [];
  if (images) parts.push(`${images} zdj.`);
  if (pdfs) parts.push(`${pdfs} PDF`);
  if (texts) parts.push(`${texts} tekst.`);
  // size signal for the outline (how many levels the material needs); only when it says something
  const size = [pdfPages ? `ok. ${pdfPages} str. PDF` : "", textWords >= 200 ? `ok. ${roundWords(textWords)} słów tekstu` : ""].filter(Boolean);
  const summary = parts.join(", ") || "brak";
  return { blocks, summary: size.length ? `${summary}; objętość: ${size.join(", ")}` : summary };
}

function wordCount(s: string): number {
  return s.match(/\S+/g)?.length ?? 0;
}
const roundWords = (n: number) => (n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10);

/**
 * Best-effort page count of a PDF from its raw bytes: page objects ("/Type /Page", not "/Pages"); 0 when they sit in
 * compressed object streams and cannot be counted this way. Only a hint for the prompt — never used for limits.
 */
export function pdfPageCount(bytes: Uint8Array): number {
  try {
    const raw = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
    return raw.match(/\/Type\s*\/Page(?![A-Za-z])/g)?.length ?? 0;
  } catch {
    return 0;
  }
}

// ---------- preparation (PPTX → text + images), before anything is charged ----------

/** Images in one generation, user photos and slide images together. */
export const MAX_IMAGES_PER_GENERATION = 40;
/** Above this many images in one request Claude rejects any image over 2000 px. */
export const MAX_IMAGES_ANY_SIZE = 20;
/**
 * Characters of text material in one generation (deck text + text files + pasted text). Well inside the model's
 * context (Polish ≈ 3 characters per token) with room for PDFs and images; above it the request would fail with
 * `too_long` only after it was charged, so intake rejects it first.
 */
export const MAX_TEXT_CHARS_PER_GENERATION = 1_500_000;

export type MaterialErrorCode = "bad_materials" | PptxErrorCode;

/** A material the API cannot use. Always a client error (400) and never charged. */
export class MaterialError extends Error {
  constructor(
    public readonly code: MaterialErrorCode,
    message: string,
    /** name of the file the error is about (sent to the client as `name`) */
    public readonly file?: string,
  ) {
    super(message);
    this.name = "MaterialError";
  }
}

export interface PreparedStats {
  decks: number;
  slides: number;
  /** Images found in decks after their own filters (dedupe, logos, size). */
  deckImages: number;
  /** Deck images left out by the per-generation image cap. */
  deckImagesCapped: number;
  photos: number;
  /** Final number of images sent to the AI. */
  images: number;
  /** Characters of text material: deck text (as sent to the AI) and text files. Pasted text is not included. */
  textChars: number;
}

export interface PreparedMaterials {
  /** Only types the AI reads directly (AI_MIME); each deck becomes a text material followed by its images. */
  materials: MaterialInput[];
  stats: PreparedStats;
}

function pptxMessage(code: PptxErrorCode, label: string): string {
  if (code === "pptx_protected") return `Prezentacja „${label}” jest zabezpieczona hasłem albo zapisana w starym formacie. Usuń hasło i zapisz ją jako PPTX albo PDF.`;
  if (code === "pptx_empty") return `Prezentacja „${label}” nie ma treści — nie znalazłem tekstu ani obrazów na slajdach.`;
  return `Nie mogę otworzyć prezentacji „${label}”. Plik jest uszkodzony albo za duży — zapisz go ponownie jako PPTX albo PDF.`;
}

/**
 * Turn the user's materials into what the AI reads: PPTX decks are unpacked into slide text (with speaker notes)
 * plus the slide images, labelled with their slide number. Images of all materials together are capped at
 * {@link MAX_IMAGES_PER_GENERATION} (photos first, then slide images spread evenly over the decks), or at
 * {@link MAX_IMAGES_ANY_SIZE} when a user photo is larger than 2000 px (or its size is unknown).
 *
 * Throws {@link MaterialError} for an unsupported type or an unreadable / protected / empty deck.
 * Pure and synchronous: run it before the generation is charged.
 */
export function prepareMaterials(materials: MaterialInput[], opts: { maxImages?: number; budget?: PptxBudget } = {}): PreparedMaterials {
  const maxImages = opts.maxImages ?? MAX_IMAGES_PER_GENERATION;
  const budget = opts.budget ?? newPptxBudget();
  // photos first (cheap header reads): they count against the image cap before any slide image
  let photos = 0;
  let bigPhoto = false;
  materials.forEach((m, i) => {
    if (isPptx(m.mime)) return;
    if (!isAiMime(m.mime)) throw new MaterialError("bad_materials", `Nieobsługiwany typ pliku „${labelOf(m, i)}” (${m.mime || "brak typu"}). Dodaj zdjęcie, PDF, prezentację PPTX albo tekst.`, labelOf(m, i));
    if (m.mime.startsWith("image/")) {
      photos++;
      const info = imageInfo(toBytes(m.data));
      if (!info || info.width > PPTX_LIMITS.maxImagePx || info.height > PPTX_LIMITS.maxImagePx) bigPhoto = true;
    }
  });
  // with a photo over 2000 px the whole request must stay at ≤ 20 images
  const cap = bigPhoto ? Math.min(maxImages, MAX_IMAGES_ANY_SIZE) : maxImages;
  let slideImagesLeft = Math.max(0, cap - photos);

  // decks: the image cap is applied while unpacking (each deck gets a fair share of what is left), and one budget
  // (unpacked bytes, XML read, kept image bytes, time) is shared by all decks, so memory does not grow with their number
  const decks = new Map<number, { name: string; deck: PptxResult }>();
  let decksLeft = materials.filter((m) => isPptx(m.mime)).length;
  let deckImagesFound = 0;
  materials.forEach((m, i) => {
    if (!isPptx(m.mime)) return;
    const label = labelOf(m, i);
    let deck: PptxResult;
    try {
      deck = extractPptx(toBytes(m.data), { budget, maxImages: Math.ceil(slideImagesLeft / decksLeft) });
    } catch (e) {
      if (e instanceof PptxError) throw new MaterialError(e.code, pptxMessage(e.code, label), label);
      throw new MaterialError("bad_pptx", pptxMessage("bad_pptx", label), label);
    }
    decksLeft--;
    slideImagesLeft -= deck.images.length;
    deckImagesFound += deck.images.length + deck.stats.images.capped;
    decks.set(i, { name: m.name || `prezentacja ${i + 1}`, deck });
  });

  const all = [...decks.values()].flatMap((d) => d.deck.images);
  const keep = new Set(spread(all.length, Math.max(0, cap - photos)).map((i) => all[i]!));

  const out: MaterialInput[] = [];
  let slides = 0;
  let textChars = 0;
  materials.forEach((m, i) => {
    const d = decks.get(i);
    if (!d) {
      if (!m.mime.startsWith("image/") && m.mime !== "application/pdf") textChars += materialBytes(m); // text files: bytes ≥ characters
      out.push(m);
      return;
    }
    slides += d.deck.stats.slides;
    const imgs = d.deck.images.filter((img) => keep.has(img));
    const text = pptxToText(d.name, d.deck, new Set(imgs.map((x) => x.slide)));
    textChars += text.length;
    out.push({ mime: "text/plain", name: d.name, data: Buffer.from(text, "utf8") });
    for (const img of imgs) out.push({ mime: img.mime, name: `${d.name} — slajd ${img.slide}`, data: img.data });
  });

  return {
    materials: out,
    stats: { decks: decks.size, slides, deckImages: deckImagesFound, deckImagesCapped: deckImagesFound - keep.size, photos, images: photos + keep.size, textChars },
  };
}
