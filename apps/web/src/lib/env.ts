/** Lazy, guarded env access — nothing here throws at import time so `next build` works without secrets. */

export const env = {
  get supabaseUrl() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  },
  get supabaseAnonKey() {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  },
  get supabaseServiceKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  },
  get anthropicKey() {
    return process.env.ANTHROPIC_API_KEY || "";
  },
  get stripeSecret() {
    return process.env.STRIPE_SECRET_KEY || "";
  },
  get stripeWebhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET || "";
  },
  get stripePriceMonthly() {
    return process.env.STRIPE_PRICE_MONTHLY || "";
  },
  get stripePriceYearly() {
    return process.env.STRIPE_PRICE_YEARLY || "";
  },
  get appUrl() {
    return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  },
};

export function hasSupabaseEnv(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
export function hasServiceRole(): boolean {
  return hasSupabaseEnv() && Boolean(env.supabaseServiceKey);
}
export function hasStripeEnv(): boolean {
  return Boolean(env.stripeSecret);
}
