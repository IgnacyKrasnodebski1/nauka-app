/** Server-side subject loading with seed fallback (works with zero env). */
import { SEED_SUBJECTS } from "@nauka/content";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { isUuid, rowToSubject, seedToSubject, type AppSubject, type SeedSubject, type SubjectRow } from "@/lib/types";

const SELECT = "id,slug,owner_id,name,stage,category,is_public,content,created_at,updated_at";

export function seedSubjects(): AppSubject[] {
  return (SEED_SUBJECTS as unknown as SeedSubject[]).map(seedToSubject);
}

/** Public library: Supabase `subjects where is_public`, or seeds when Supabase is not configured / empty. */
export async function listPublicSubjects(supabase?: SupabaseClient | null): Promise<AppSubject[]> {
  const sb = supabase === undefined ? await getServerSupabase() : supabase;
  if (!sb) return seedSubjects();
  const { data, error } = await sb.from("subjects").select(SELECT).eq("is_public", true).order("created_at", { ascending: true });
  if (error || !data || data.length === 0) return seedSubjects();
  return (data as SubjectRow[]).map(rowToSubject);
}

export async function listOwnSubjects(sb: SupabaseClient, userId: string): Promise<AppSubject[]> {
  const { data } = await sb.from("subjects").select(SELECT).eq("owner_id", userId).order("created_at", { ascending: false });
  return ((data ?? []) as SubjectRow[]).map(rowToSubject);
}

/** Resolve by uuid (DB) or slug (DB public row, else seed). */
export async function getSubject(idOrSlug: string, supabase?: SupabaseClient | null): Promise<AppSubject | null> {
  const sb = supabase === undefined ? await getServerSupabase() : supabase;
  if (sb) {
    const q = isUuid(idOrSlug) ? sb.from("subjects").select(SELECT).eq("id", idOrSlug) : sb.from("subjects").select(SELECT).eq("slug", idOrSlug).is("owner_id", null);
    const { data } = await q.maybeSingle();
    if (data) return rowToSubject(data as SubjectRow);
  }
  const seed = seedSubjects().find((s) => s.slug === idOrSlug || s.id === idOrSlug);
  return seed ?? null;
}
