import { z } from "zod";
import { getUserFromRequest, jsonError, NO_SUPABASE } from "@/lib/auth";
import { env, hasServiceRole, hasSupabaseEnv } from "@/lib/env";
import { getProfile } from "@/lib/plan";
import { getStripe, NO_STRIPE, priceFor } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ interval: z.enum(["month", "year"]).default("month"), platform: z.enum(["web", "mobile"]).default("web") });

export async function POST(req: Request) {
  if (!hasSupabaseEnv() || !hasServiceRole()) return jsonError(NO_SUPABASE, 503, { code: "no_config" });
  const stripe = getStripe();
  if (!stripe) return jsonError(NO_STRIPE, 503, { code: "no_config" });
  const ctx = await getUserFromRequest(req);
  if (!ctx) return jsonError("Wymagane logowanie", 401, { code: "unauthorized" });
  const body = BodySchema.parse(await req.json().catch(() => ({})));
  const price = priceFor(body.interval);
  if (!price) return jsonError("Brak STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY", 503, { code: "no_config" });

  const admin = getAdminSupabase()!;
  const profile = await getProfile(ctx.supabase, ctx.user.id);
  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const c = await stripe.customers.create({ email: ctx.user.email ?? undefined, name: profile?.display_name ?? undefined, metadata: { user_id: ctx.user.id } });
    customerId = c.id;
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", ctx.user.id);
  }

  const base = env.appUrl;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    payment_method_types: ["card", "blik"],
    locale: "pl",
    allow_promotion_codes: true,
    success_url: body.platform === "mobile" ? `${base}/billing/success` : `${base}/app?upgraded=1`,
    cancel_url: `${base}/billing/cancel`,
    client_reference_id: ctx.user.id,
    subscription_data: { metadata: { user_id: ctx.user.id } },
    metadata: { user_id: ctx.user.id, interval: body.interval, platform: body.platform },
  });
  return Response.json({ url: session.url });
}
