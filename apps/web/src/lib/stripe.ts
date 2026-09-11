import Stripe from "stripe";
import { env, hasStripeEnv } from "@/lib/env";

let cached: Stripe | null = null;

/** Lazy Stripe client — null when STRIPE_SECRET_KEY is missing. */
export function getStripe(): Stripe | null {
  if (!hasStripeEnv()) return null;
  if (!cached) cached = new Stripe(env.stripeSecret, { typescript: true });
  return cached;
}

export function priceFor(interval: "month" | "year"): string {
  return interval === "year" ? env.stripePriceYearly : env.stripePriceMonthly;
}

export const NO_STRIPE = "Brak konfiguracji Stripe";
