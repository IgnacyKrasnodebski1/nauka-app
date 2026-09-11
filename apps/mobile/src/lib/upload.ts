import { isAcceptedMime, PLANS, type Plan } from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decode } from "base64-arraybuffer";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";

export interface PickedFile {
  uri: string;
  name: string;
  mime: string;
  size?: number;
  /** obrazki mają miniaturę = uri */
  kind: "image" | "pdf" | "text";
}

export interface UploadedMaterial {
  id: string;
  storagePath: string;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf", "text/plain": "txt", "text/markdown": "md" };

export function guessMime(name: string, fallback = "application/octet-stream"): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/jpeg", pdf: "application/pdf", txt: "text/plain", md: "text/markdown" };
  return map[ext] ?? fallback;
}

/**
 * Upload jednego pliku do Storage `materials/{userId}/{uuid}.{ext}` + wiersz w `materials`.
 * RN: czytamy plik jako base64 (expo-file-system `File.base64()`), dekodujemy do ArrayBuffer (base64-arraybuffer)
 * i wysyłamy ArrayBuffer z contentType — supabase-js w RN nie umie wysłać `Blob` z file:// URI.
 */
export async function uploadMaterial(sb: SupabaseClient, userId: string, f: PickedFile, plan: Plan = "free"): Promise<UploadedMaterial> {
  const mime = isAcceptedMime(f.mime) ? f.mime : guessMime(f.name);
  if (!isAcceptedMime(mime)) throw new Error(`Nieobsługiwany typ pliku: ${f.mime || f.name}`);
  const maxBytes = PLANS[plan].maxFileMb * 1024 * 1024;

  const file = new File(f.uri);
  const size = f.size ?? file.size ?? 0;
  if (size > maxBytes) throw new Error(`${f.name}: plik za duży (max ${PLANS[plan].maxFileMb} MB na planie ${PLANS[plan].label}).`);
  const base64 = await file.base64();
  const body = decode(base64);
  if (body.byteLength > maxBytes) throw new Error(`${f.name}: plik za duży (max ${PLANS[plan].maxFileMb} MB).`);

  const ext = EXT[mime] ?? "bin";
  const storagePath = `${userId}/${Crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await sb.storage.from("materials").upload(storagePath, body, { contentType: mime, upsert: false });
  if (upErr) throw new Error(`Upload ${f.name} nie wyszedł: ${upErr.message}`);

  const { data, error } = await sb
    .from("materials")
    .insert({ owner_id: userId, storage_path: storagePath, mime, size_bytes: body.byteLength, name: f.name })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Nie udało się zapisać materiału ${f.name}: ${error?.message ?? "?"}`);
  return { id: (data as { id: string }).id, storagePath };
}
