import { legacyQuotaFields, PLANS, type GenerationQuota } from "@nauka/shared";
import { getUserFromRequest, jsonError, NO_SUPABASE } from "@/lib/auth";
import { hasServiceRole, hasSupabaseEnv } from "@/lib/env";
import { getGenerationQuota, getProfile, getUsage } from "@/lib/plan";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * `{ profile, plan, usage, limits, quota, subscription }`. `quota` (additive, backend/0007) is the generation limit as the
 * charge sees it: `{ plan, scope: "lifetime" | "month", used, limit, remaining, trialUntil, freeLimit, globalOpen }` — free
 * accounts have generations for the life of their e-mail address, pro (and accounts still on their old trial) a monthly
 * limit; `globalOpen: false` = the server's daily cap (or the free plan's share of it) is full right now.
 * When `quota` is present, `plan` follows it (the database's view, the same one the charge uses).
 * For a `lifetime` quota `usage.generations` and `limits.generationsPerMonth` carry the same numbers, so older clients
 * (Cramfox build 6, Recall web) block at "2 of 2". `quota` is null when it cannot be read (no service role key, database
 * without 0007) — then the other fields are exactly as before.
 */
export async function GET(req: Request) {
  if (!hasSupabaseEnv()) return jsonError(NO_SUPABASE, 503, { code: "no_config" });
  const ctx = await getUserFromRequest(req);
  if (!ctx) return jsonError("Wymagane logowanie", 401, { code: "unauthorized" });
  const [profile, usage, { data: sub }] = await Promise.all([
    getProfile(ctx.supabase, ctx.user.id),
    getUsage(ctx.supabase, ctx.user.id),
    ctx.supabase.from("subscriptions").select("status,interval,current_period_end,cancel_at_period_end,price_id").eq("user_id", ctx.user.id).maybeSingle(),
  ]);
  const admin = hasServiceRole() ? getAdminSupabase() : null;
  let quota: GenerationQuota | null = null;
  if (admin) {
    try {
      // the RPC reads the plan itself; the pro monthly limit applies only to pro (free ignores it) — see generate/route.ts
      quota = await getGenerationQuota(admin, ctx.user.id, PLANS.pro.generationsPerMonth);
    } catch (e) {
      console.warn("[me] quota unavailable:", (e as Error)?.message ?? e);
    }
  }
  const plan = quota?.plan ?? (profile?.plan === "pro" ? "pro" : "free");
  const legacy = legacyQuotaFields(plan, usage.generations, quota);
  return Response.json({
    profile,
    plan,
    usage: { month: usage.month, generations: legacy.generations, tutorMessages: usage.tutor_messages },
    limits: legacy.limits,
    quota,
    subscription: sub ?? null,
  });
}
