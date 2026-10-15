import { monthKey, type Plan } from "@nauka/shared";
import type { FailInput, FinishInput, ReserveOutcome } from "@nauka/ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { TopicRow } from "@/lib/types";

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
 * How long a `queued`/`running` generation keeps its account busy (mirrors the 5.5 min in reserve_generation, backend/0007).
 * A request lives at most 300 s (Vercel maxDuration) and its row is created after the request starts, so 330 s from the
 * row's created_at still covers the whole request — and ends close to Cramfox's 330 s `lost` verdict, after which the
 * user may retry. Rows left `running` by a killed function are closed by the 8-minute sweeper.
 */
export const ACTIVE_GENERATION_WINDOW_MS = 5.5 * 60 * 1000;

/**
 * The charge (AUDYT P0-1): RPC `reserve_generation` (backend/0007) checks, in ONE transaction under advisory locks,
 * that the account has no generation running (busy), the daily (20/24 h per account) and global (300/24 h) caps and
 * the monthly plan limit — all BEFORE counting — then inserts the `generations` row (status `running`) and counts the
 * generation in `usage`. Service role only.
 */
export async function reserveGenerationSlot(
  admin: SupabaseClient,
  a: { userId: string; monthlyLimit: number; subjectId: string; stage: string; hint: string | null; options: unknown; materialIds: string[] },
): Promise<ReserveOutcome> {
  const { data, error } = await admin.rpc("reserve_generation", {
    p_user: a.userId,
    p_month: monthKey(),
    p_monthly_limit: a.monthlyLimit,
    p_subject_id: a.subjectId,
    p_stage: a.stage,
    p_hint: a.hint,
    p_options: a.options,
    p_material_ids: a.materialIds,
  });
  if (error) throw new Error(`reserve_generation: ${error.message}`);
  const r = data as { ok?: boolean; generation_id?: string; reason?: string; used?: number; limit?: number } | null;
  if (r?.ok && r.generation_id) return { ok: true, generationId: r.generation_id, used: r.used, limit: r.limit };
  if (r && r.ok === false && (r.reason === "busy" || r.reason === "daily" || r.reason === "global" || r.reason === "monthly")) return { ok: false, reason: r.reason, used: r.used, limit: r.limit };
  throw new Error(`reserve_generation: unexpected answer ${JSON.stringify(r)}`);
}

/** RPC `finish_generation` (backend/0007): topic row + generation `done` + cost columns in one transaction; returns the topic row. */
export async function finishGeneration(admin: SupabaseClient, generationId: string, out: FinishInput): Promise<TopicRow> {
  const { data, error } = await admin.rpc("finish_generation", {
    p_generation_id: generationId,
    p_topic: { name: out.name, emoji: out.emoji, source: out.source, content: out.content },
    p_stats: { model: out.model, ...out.cost, quality: out.quality },
  });
  if (error) throw new Error(`finish_generation: ${error.message}`);
  const row = data as TopicRow | null;
  if (!row?.id) throw new Error("finish_generation: no topic row");
  return row;
}

/** Marks a running generation `failed`, with the error and the cost of whatever was spent (columns from backend/0007). */
export async function failGeneration(admin: SupabaseClient, generationId: string, info: FailInput): Promise<void> {
  const { error } = await admin
    .from("generations")
    .update({ status: "failed", error: info.error.slice(0, 2000), finished_at: new Date().toISOString(), ...info.cost, quality: info.quality })
    .eq("id", generationId)
    .in("status", ["queued", "running"]);
  if (error) throw new Error(`generations update: ${error.message}`);
}

/**
 * After finish_generation threw: the topic row of the generation when the transaction did commit (status `done`), else null.
 * Lets the route answer 200 when only the RPC's reply was lost.
 */
export async function findFinishedTopic(admin: SupabaseClient, generationId: string): Promise<TopicRow | null> {
  const { data, error } = await admin.from("generations").select("status,topic_id").eq("id", generationId).maybeSingle();
  if (error) throw new Error(`generations read: ${error.message}`);
  const g = data as { status: string; topic_id: string | null } | null;
  if (!g || g.status !== "done" || !g.topic_id) return null;
  const { data: t, error: te } = await admin.from("topics").select("*").eq("id", g.topic_id).maybeSingle();
  if (te) throw new Error(`topics read: ${te.message}`);
  return (t as TopicRow | null) ?? null;
}

/** Read-only: does the account have a generation that is still running (the RPC would answer `busy`)? */
export async function hasActiveGeneration(admin: SupabaseClient, userId: string): Promise<boolean> {
  const since = new Date(Date.now() - ACTIVE_GENERATION_WINDOW_MS).toISOString();
  const { count } = await admin.from("generations").select("id", { count: "exact", head: true }).eq("owner_id", userId).in("status", ["queued", "running"]).gt("created_at", since);
  return (count ?? 0) > 0;
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
