import type Stripe from "stripe";
import { jsonError } from "@/lib/auth";
import { env, hasServiceRole } from "@/lib/env";
import { getStripe, NO_STRIPE } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ACTIVE = new Set(["active", "trialing"]);

async function userIdForCustomer(customerId: string, stripe: Stripe): Promise<string | null> {
  const admin = getAdminSupabase()!;
  const { data } = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  if (data) return (data as { id: string }).id;
  const c = await stripe.customers.retrieve(customerId);
  if (!c.deleted && c.metadata?.user_id) return c.metadata.user_id;
  return null;
}

async function applySubscription(sub: Stripe.Subscription, stripe: Stripe) {
  const admin = getAdminSupabase()!;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = sub.metadata?.user_id || (await userIdForCustomer(customerId, stripe));
  if (!userId) {
    console.warn("[stripe] no user for customer", customerId);
    return;
  }
  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end ?? null;
  const plan = ACTIVE.has(sub.status) ? "pro" : "free";
  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      status: sub.status,
      price_id: item?.price.id ?? null,
      interval: item?.price.recurring?.interval ?? null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
    },
    { onConflict: "user_id" },
  );
  await admin.from("profiles").update({ plan, stripe_customer_id: customerId }).eq("id", userId);
}

/** Stripe → Recall. Raw body + signature verification; must not be parsed by any middleware. */
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe || !env.stripeWebhookSecret) return jsonError(NO_STRIPE, 503, { code: "no_config" });
  if (!hasServiceRole()) return jsonError("Brak SUPABASE_SERVICE_ROLE_KEY", 503, { code: "no_config" });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return jsonError("Brak podpisu", 400);
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, env.stripeWebhookSecret);
  } catch (e) {
    return jsonError(`Nieprawidłowy podpis: ${(e as Error).message}`, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        if (s.mode === "subscription" && s.subscription) {
          const sub = await stripe.subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
          if (s.client_reference_id && !sub.metadata?.user_id) sub.metadata = { ...sub.metadata, user_id: s.client_reference_id };
          await applySubscription(sub, stripe);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription(event.data.object, stripe);
        break;
      case "invoice.payment_failed": {
        const inv = event.data.object;
        const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        if (customerId) {
          const userId = await userIdForCustomer(customerId, stripe);
          if (userId) await getAdminSupabase()!.from("subscriptions").update({ status: "past_due" }).eq("user_id", userId);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("[stripe webhook]", event.type, e);
    return jsonError("Błąd przetwarzania", 500);
  }
  return Response.json({ received: true });
}
