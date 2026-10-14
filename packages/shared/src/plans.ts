import type { Plan } from "./types.js";

/** Plan limits — used by the API (enforced) and the UI (displayed). */
export const PLANS: Record<
  Plan,
  {
    label: string;
    /** AI generations per calendar month */
    generationsPerMonth: number;
    /** max files per single generation */
    filesPerGeneration: number;
    /** max size of a single upload in MB */
    maxFileMb: number;
    /** max own subjects */
    maxSubjects: number;
    priceMonthlyPln: number;
    priceYearlyPln: number;
  }
> = {
  free: {
    label: "Free",
    generationsPerMonth: 3,
    filesPerGeneration: 5,
    maxFileMb: 50,
    maxSubjects: 5,
    priceMonthlyPln: 0,
    priceYearlyPln: 0,
  },
  pro: {
    label: "Pro",
    generationsPerMonth: 150,
    filesPerGeneration: 20,
    maxFileMb: 50,
    maxSubjects: 1000,
    priceMonthlyPln: 29,
    priceYearlyPln: 199,
  },
};

/** Types the AI reads directly (sent to Claude as image / PDF / text blocks). */
export const AI_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain", "text/markdown"] as const;
export type AiMime = (typeof AI_MIME)[number];

/** PowerPoint (OOXML). Never sent to the AI as-is: the server unpacks it into slide text + images first. */
export const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation" as const;

/** Everything the API accepts as a material (`materials.mime`) for generation. */
export const UPLOAD_MIME = [...AI_MIME, PPTX_MIME] as const;
export type UploadMime = (typeof UPLOAD_MIME)[number];

/** @deprecated kept for older clients (Recall web/mobile pickers) — same list as {@link AI_MIME}. */
export const ACCEPTED_MIME = AI_MIME;
export type AcceptedMime = AiMime;

export function isAiMime(m: string): m is AiMime {
  return (AI_MIME as readonly string[]).includes(m);
}

export function isPptx(m: string): m is typeof PPTX_MIME {
  return m === PPTX_MIME;
}

export function isUploadMime(m: string): m is UploadMime {
  return (UPLOAD_MIME as readonly string[]).includes(m);
}

/** @deprecated use {@link isAiMime} (or {@link isUploadMime} for what the API accepts). */
export function isAcceptedMime(m: string): m is AcceptedMime {
  return isAiMime(m);
}

/** YYYY-MM for usage buckets */
export function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
