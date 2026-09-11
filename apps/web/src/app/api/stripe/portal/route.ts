import { getUserFromRequest, jsonError, NO_SUPABASE } from "@/lib/auth";
import { env, hasSupabaseEnv } from "@/lib/env";
import { getProfile } from "@/lib/plan";
import { getStripe, NO_STRIPE } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!hasSupabaseEnv()) return jsonError(NO_SUPABASE, 503, { code: "no_config" });
  const stripe = getStripe();
  if (!stripe) return jsonError(NO_STRIPE, 503, { code: "no_config" });
  const ctx = await getUserFromRequest(req);
  if (!ctx) return jsonError("Wymagane logowanie", 401, { code: "unauthorized" });
  const profile = await getProfile(ctx.supabase, ctx.user.id);
  if (!profile?.stripe_customer_id) return jsonError("Brak subskrypcji do zarządzania", 400, { code: "no_customer" });
  const session = await stripe.billingPortal.sessions.create({ customer: profile.stripe_customer_id, return_url: `${env.appUrl}/app/account`, locale: "pl" });
  return Response.json({ url: session.url });
}
