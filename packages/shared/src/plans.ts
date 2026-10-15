import type { Plan } from "./types.js";

/**
 * How a plan's generation limit is counted (owner decision 2026-10-15, AUDYT D3):
 * - `lifetime` — free plan: a fixed number of generations for the life of the e-mail address, never renewed; it survives
 *   deleting the account (the database counts them per e-mail hash, `free_generation_ledger` in backend/0007);
 * - `month` — pro plan (and accounts still on their old 30-day trial): per calendar month in UTC ({@link monthKey}).
 */
export type GenerationScope = "lifetime" | "month";

/** Plan limits — used by the API (enforced) and the UI (displayed). */
export const PLANS: Record<
  Plan,
  {
    label: string;
    /**
     * AI generations per calendar month (pro). The free plan has no monthly allowance — its value only mirrors
     * `generationsLifetime` for older clients that show "X of Y this month" (a free account can never make more).
     */
    generationsPerMonth: number;
    /**
     * Free plan only: generations for the life of the e-mail address, never renewed. The live value is in the database
     * (`app_config.free_lifetime_generations`, read by `reserve_generation` / `generation_quota`); this is its default.
     */
    generationsLifetime?: number;
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
    generationsPerMonth: 2,
    generationsLifetime: 2,
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

/** The scope of a plan's generation limit: free → `lifetime`, pro → `month`. */
export function generationScope(plan: Plan): GenerationScope {
  return plan === "pro" ? "month" : "lifetime";
}

/** An account's generation limit right now (RPC `generation_quota`, backend/0007) — `quota` in `GET /api/me`. */
export interface GenerationQuota {
  plan: Plan;
  scope: GenerationScope;
  /** generations counted toward the limit: for the life of the e-mail address (`lifetime`) or this month (`month`) */
  used: number;
  limit: number;
  remaining: number;
  /** end of the 30-day trial of accounts created before 2026-10-15 (ISO), otherwise null */
  trialUntil: string | null;
  /** the free plan's generations for life (`app_config`) — what a trial account gets after `trialUntil`; absent from older databases */
  freeLimit?: number;
  /**
   * false = the server's daily cap (or, for free accounts, the free plan's share of it) is full right now, so a generation
   * would be refused with the 1999999 sentinel; absent (treat as open) from older databases
   */
  globalOpen?: boolean;
}

const nonNegInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

/** Validates the RPC's answer (`{plan, scope, used, limit, remaining, trial_until, free_limit?, global_open?}`); null when it is not a quota. */
export function parseGenerationQuota(raw: unknown): GenerationQuota | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const scope = r.scope === "lifetime" || r.scope === "month" ? r.scope : null;
  const used = nonNegInt(r.used);
  const limit = nonNegInt(r.limit);
  if (!scope || used === null || limit === null) return null;
  const t = r.trial_until ?? r.trialUntil;
  const freeLimit = nonNegInt(r.free_limit ?? r.freeLimit);
  const open = r.global_open ?? r.globalOpen;
  return {
    plan: r.plan === "pro" ? "pro" : "free",
    scope,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    trialUntil: typeof t === "string" && t ? t : null,
    ...(freeLimit !== null ? { freeLimit } : {}),
    ...(typeof open === "boolean" ? { globalOpen: open } : {}),
  };
}

/**
 * The legacy fields of `GET /api/me` (`usage.generations`, `limits`) for a quota. Older clients (Cramfox build 6 and 7,
 * the Recall web) only know "X of `limits.generationsPerMonth`": for a `lifetime` quota both numbers carry the lifetime
 * counter, so they block at the right moment ("2 of 2") instead of letting the user upload and then failing with 402.
 * A `month` quota, or none (database without backend/0007), keeps the monthly values as before.
 */
export function legacyQuotaFields(plan: Plan, monthlyGenerations: number, quota: GenerationQuota | null): { generations: number; limits: (typeof PLANS)[Plan] } {
  if (!quota || quota.scope !== "lifetime") return { generations: monthlyGenerations, limits: PLANS[plan] };
  return { generations: quota.used, limits: { ...PLANS.free, generationsPerMonth: quota.limit, generationsLifetime: quota.limit } };
}
