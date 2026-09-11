import type Anthropic from "@anthropic-ai/sdk";
import { isAcceptedMime } from "@nauka/shared";

export interface MaterialInput {
  mime: string;
  /** file bytes: Buffer/Uint8Array or base64 string */
  data: Uint8Array | string;
  name?: string;
}

type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

function toBase64(d: Uint8Array | string): string {
  if (typeof d === "string") return d.replace(/\s+/g, "");
  return Buffer.from(d).toString("base64");
}

function toText(d: Uint8Array | string): string {
  if (typeof d === "string") return Buffer.from(d, "base64").toString("utf8");
  return Buffer.from(d).toString("utf8");
}

/** Convert uploaded materials + pasted text into Messages API content blocks. */
export function materialsToBlocks(materials: MaterialInput[], text?: string): { blocks: Anthropic.Beta.BetaContentBlockParam[]; summary: string } {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  let images = 0,
    pdfs = 0,
    texts = 0;
  materials.forEach((m, i) => {
    if (!isAcceptedMime(m.mime)) throw new Error(`Nieobsługiwany typ pliku: ${m.mime}`);
    const label = m.name ? `${m.name}` : `plik ${i + 1}`;
    if (m.mime.startsWith("image/")) {
      images++;
      blocks.push({ type: "text", text: `[Materiał ${i + 1}: zdjęcie — ${label}]` });
      blocks.push({ type: "image", source: { type: "base64", media_type: m.mime as ImageMime, data: toBase64(m.data) } });
    } else if (m.mime === "application/pdf") {
      pdfs++;
      blocks.push({ type: "text", text: `[Materiał ${i + 1}: PDF — ${label}]` });
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(m.data) }, title: label });
    } else {
      texts++;
      blocks.push({ type: "document", source: { type: "text", media_type: "text/plain", data: toText(m.data) }, title: label });
    }
  });
  if (text && text.trim()) {
    texts++;
    blocks.push({ type: "document", source: { type: "text", media_type: "text/plain", data: text.trim() }, title: "Wklejony tekst" });
  }
  const parts = [];
  if (images) parts.push(`${images} zdj.`);
  if (pdfs) parts.push(`${pdfs} PDF`);
  if (texts) parts.push(`${texts} tekst.`);
  return { blocks, summary: parts.join(", ") || "brak" };
}
