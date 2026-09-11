import { PLANS, monthKey, type Plan } from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const TUTOR_FREE_PER_DAY = 30;

export interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  stage: "podstawowa" | "liceum" | "studia" | "inne";
  plan: Plan;
  stripe_customer_id: string | null;
}

export async function getProfile(supabase: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data } = await supabase.from("profiles").select("id,email,display_name,stage,plan,stripe_customer_id").eq("id", userId).maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export async function getPlan(supabase: SupabaseClient, userId: string): Promise<Plan> {
  const p = await getProfile(supabase, userId);
  return p?.plan === "pro" ? "pro" : "free";
}

export interface UsageRow {
  month: string;
  generations: number;
  tutor_messages: number;
}

export async function getUsage(supabase: SupabaseClient, userId: string, month = monthKey()): Promise<UsageRow> {
  const { data } = await supabase.from("usage").select("month,generations,tutor_messages").eq("user_id", userId).eq("month", month).maybeSingle();
  return (data as UsageRow | null) ?? { month, generations: 0, tutor_messages: 0 };
}

/**
 * Atomically counts a generation via the `increment_usage` RPC (service role) and checks the plan limit.
 * Returns { ok:false } when over the limit. Failures after the increment are just logged (see docs).
 */
export async function reserveGeneration(userId: string, plan: Plan): Promise<{ ok: true; used: number; limit: number } | { ok: false; used: number; limit: number }> {
  const admin = getAdminSupabase();
  const limit = PLANS[plan].generationsPerMonth;
  if (!admin) throw new Error("Brak SUPABASE_SERVICE_ROLE_KEY");
  const { data, error } = await admin.rpc("increment_usage", { p_user: userId, p_month: monthKey(), p_field: "generations" });
  if (error) throw new Error(`increment_usage: ${error.message}`);
  const used = Number(data ?? 0);
  if (used > limit) return { ok: false, used, limit };
  return { ok: true, used, limit };
}

export async function reserveTutorMessage(userId: string, plan: Plan): Promise<{ ok: boolean; used: number; limit: number | null }> {
  const admin = getAdminSupabase();
  if (!admin) throw new Error("Brak SUPABASE_SERVICE_ROLE_KEY");
  const { data, error } = await admin.rpc("increment_usage", { p_user: userId, p_month: monthKey(), p_field: "tutor_messages" });
  if (error) throw new Error(`increment_usage: ${error.message}`);
  const used = Number(data ?? 0);
  if (plan === "pro") return { ok: true, used, limit: null };
  // Free: 30/day; usage is bucketed per month, so we approximate the daily cap as 30 × days elapsed this month.
  const day = new Date().getUTCDate();
  const limit = TUTOR_FREE_PER_DAY * day;
  return { ok: used <= limit, used, limit: TUTOR_FREE_PER_DAY };
}

export async function countOwnSubjects(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count } = await supabase.from("subjects").select("id", { count: "exact", head: true }).eq("owner_id", userId);
  return count ?? 0;
}
