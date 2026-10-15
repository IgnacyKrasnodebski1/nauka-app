import { isUploadMime } from "@nauka/shared";
import { MAX_TEXT_CHARS_PER_GENERATION, MaterialError, prepareMaterials, type MaterialInput, type PreparedStats } from "./materials.js";
import { newPptxBudget } from "./pptx.js";

/** A `materials` row as the generate route reads it. */
export interface IntakeRow {
  id: string;
  storage_path: string;
  mime: string;
  /** declared by the client when it registered the upload — never trusted for limits; the downloaded size is */
  size_bytes: number;
  name: string | null;
}

export interface IntakeFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
  extra?: Record<string, unknown>;
}

export type ReserveResult<R> = { ok: true; value: R } | IntakeFailure;

export interface IntakeDeps<R> {
  /** Cheap read-only quota check, run before downloading anything. Return a failure to stop. */
  precheck?: () => Promise<IntakeFailure | null>;
  /** Download one material's bytes. */
  download: (row: IntakeRow) => Promise<Uint8Array>;
  /**
   * Last check before the charge, with the prepared materials (the generate route uploads them to the Files API and
   * counts their tokens here). Return a failure to stop; nothing is charged.
   */
  measure?: (materials: MaterialInput[], stats: PreparedStats) => Promise<IntakeFailure | null>;
  /** Charge the generation. Runs only once every material is downloaded and readable. */
  reserve: () => Promise<ReserveResult<R>>;
  /** Override of the per-generation image cap (tests). */
  maxImages?: number;
  /** Real (downloaded) size limit of one file, in MB. */
  maxFileMb?: number;
  /** Real (downloaded) size limit of all files together, in MB. */
  maxTotalMb?: number;
  /** Characters of pasted text sent with the files (counted against the text budget). */
  pastedChars?: number;
  /** Override of {@link MAX_TEXT_CHARS_PER_GENERATION} (tests). */
  maxTextChars?: number;
}

export type IntakeResult<R> = { ok: true; materials: MaterialInput[]; stats: PreparedStats; reserved: R } | IntakeFailure;

const fail = (status: number, code: string, message: string, extra?: Record<string, unknown>): IntakeFailure => ({ ok: false, status, code, message, extra });

/** Downloads running at once: bounds memory to roughly the total cap plus this many files. */
const DOWNLOAD_CONCURRENCY = 3;
const MB = 1024 * 1024;

export const TOO_LONG_MESSAGE = "Materiał jest za duży na jedną lekcję (za dużo stron albo tekstu). Podziel go na mniejsze części, np. po rozdziale.";

/**
 * Everything the generate route does with materials before calling the AI, in an order that never charges for
 * a request that cannot succeed:
 *   1. MIME allow-list (400 `bad_materials`);
 *   2. read-only quota pre-check (so we don't download 150 MB for a user over the limit);
 *   3. download, a few files at a time, checking the REAL size of each file and of all together
 *      (400 `file_too_big` / `too_much_material`; the `size_bytes` column is written by the client);
 *   4. {@link prepareMaterials} — PPTX → text + images (400 `bad_pptx` / `pptx_protected` / `pptx_empty`);
 *   5. text budget (400 `too_long`) — would otherwise fail at the AI after the charge;
 *   6. `measure` (optional): Files API upload + token count (400 `too_long` above the token budget);
 *   7. reserve (charge) the generation.
 */
export async function intakeMaterials<R>(rows: IntakeRow[], deps: IntakeDeps<R>): Promise<IntakeResult<R>> {
  const bad = rows.find((r) => !isUploadMime(r.mime));
  if (bad) return fail(400, "bad_materials", `Nieobsługiwany typ pliku „${bad.name ?? bad.id}” (${bad.mime || "brak typu"}). Dodaj zdjęcie, PDF, prezentację PPTX albo tekst.`, { name: bad.name ?? undefined });

  let materials: MaterialInput[] = [];
  let stats: PreparedStats = { decks: 0, slides: 0, deckImages: 0, deckImagesCapped: 0, photos: 0, images: 0, textChars: 0 };
  if (rows.length) {
    if (deps.precheck) {
      const stop = await deps.precheck();
      if (stop) return stop;
    }
    const files = await downloadAll(rows, deps);
    if (!Array.isArray(files)) return files;
    try {
      ({ materials, stats } = prepareMaterials(files, { maxImages: deps.maxImages, budget: newPptxBudget() }));
    } catch (e) {
      if (e instanceof MaterialError) return fail(400, e.code, e.message, e.file ? { name: e.file } : undefined);
      return fail(400, "bad_materials", "Nie udało się odczytać materiałów.");
    }
  }

  if (stats.textChars + (deps.pastedChars ?? 0) > (deps.maxTextChars ?? MAX_TEXT_CHARS_PER_GENERATION)) return fail(400, "too_long", TOO_LONG_MESSAGE);

  if (deps.measure) {
    const stop = await deps.measure(materials, stats);
    if (stop) return stop;
  }

  const reserved = await deps.reserve();
  if (!reserved.ok) return reserved;
  return { ok: true, materials, stats, reserved: reserved.value };
}

async function downloadAll<R>(rows: IntakeRow[], deps: IntakeDeps<R>): Promise<MaterialInput[] | IntakeFailure> {
  const files: MaterialInput[] = new Array(rows.length);
  const maxFile = deps.maxFileMb ? deps.maxFileMb * MB : Infinity;
  const maxTotal = deps.maxTotalMb ? deps.maxTotalMb * MB : Infinity;
  let total = 0;
  let next = 0;
  let stop: IntakeFailure | null = null;
  async function worker() {
    while (!stop && next < rows.length) {
      const i = next++;
      const r = rows[i]!;
      let data: Uint8Array;
      try {
        data = await deps.download(r);
      } catch (e) {
        stop ??= fail(500, "download_failed", (e as Error).message || "Nie udało się pobrać materiałów. Spróbuj ponownie.");
        return;
      }
      if (stop) return;
      const name = r.name ?? r.id;
      if (data.byteLength > maxFile) {
        stop = fail(400, "file_too_big", `Plik „${name}” przekracza ${deps.maxFileMb} MB`, { name, maxMb: deps.maxFileMb });
        return;
      }
      total += data.byteLength;
      if (total > maxTotal) {
        stop = fail(400, "too_much_material", `Materiały do jednego tematu mogą mieć razem najwyżej ${deps.maxTotalMb} MB. Podziel je na kilka tematów.`, { maxMb: deps.maxTotalMb });
        return;
      }
      files[i] = { mime: r.mime, data, name: r.name ?? undefined };
    }
  }
  await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, rows.length) }, worker));
  return stop ?? files;
}
