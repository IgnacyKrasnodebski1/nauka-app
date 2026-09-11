/**
 * Service-role client. SERVER ONLY — never import from client components.
 * Bypasses RLS; used for: reading materials from Storage, writing generations/usage/subscriptions/profiles.plan.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasServiceRole } from "@/lib/env";

let cached: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient | null {
  if (!hasServiceRole()) return null;
  if (!cached) {
    cached = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
