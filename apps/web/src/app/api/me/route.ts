import { PLANS } from "@nauka/shared";
import { getUserFromRequest, jsonError, NO_SUPABASE } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { getProfile, getUsage } from "@/lib/plan";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!hasSupabaseEnv()) return jsonError(NO_SUPABASE, 503, { code: "no_config" });
  const ctx = await getUserFromRequest(req);
  if (!ctx) return jsonError("Wymagane logowanie", 401, { code: "unauthorized" });
  const [profile, usage, { data: sub }] = await Promise.all([
    getProfile(ctx.supabase, ctx.user.id),
    getUsage(ctx.supabase, ctx.user.id),
    ctx.supabase.from("subscriptions").select("status,interval,current_period_end,cancel_at_period_end,price_id").eq("user_id", ctx.user.id).maybeSingle(),
  ]);
  const plan = profile?.plan === "pro" ? "pro" : "free";
  return Response.json({
    profile,
    plan,
    usage: { month: usage.month, generations: usage.generations, tutorMessages: usage.tutor_messages },
    limits: PLANS[plan],
    subscription: sub ?? null,
  });
}
