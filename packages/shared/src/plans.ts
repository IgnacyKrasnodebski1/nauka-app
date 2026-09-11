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
    maxFileMb: 10,
    maxSubjects: 5,
    priceMonthlyPln: 0,
    priceYearlyPln: 0,
  },
  pro: {
    label: "Pro",
    generationsPerMonth: 150,
    filesPerGeneration: 20,
    maxFileMb: 25,
    maxSubjects: 1000,
    priceMonthlyPln: 29,
    priceYearlyPln: 199,
  },
};

export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain", "text/markdown"] as const;
export type AcceptedMime = (typeof ACCEPTED_MIME)[number];

export function isAcceptedMime(m: string): m is AcceptedMime {
  return (ACCEPTED_MIME as readonly string[]).includes(m);
}

/** YYYY-MM for usage buckets */
export function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
