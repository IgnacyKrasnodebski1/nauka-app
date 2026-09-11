/** Server-side data access (cookie session, RLS). Every helper returns empty/null when Supabase is not configured. */
import type { Subject, Topic } from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { isUuid, rowToSubject, rowToTopic, SUBJECT_SELECT, TOPIC_SELECT, type SubjectRow, type TopicRow } from "@/lib/types";

export async function getSessionUser(): Promise<{ sb: SupabaseClient; userId: string } | null> {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  return { sb, userId: data.user.id };
}

export async function listSubjects(sb: SupabaseClient, userId: string): Promise<Subject[]> {
  const { data } = await sb.from("subjects").select(SUBJECT_SELECT).eq("owner_id", userId).order("position").order("created_at");
  return ((data ?? []) as SubjectRow[]).map(rowToSubject);
}

export async function getSubject(sb: SupabaseClient, id: string): Promise<Subject | null> {
  if (!isUuid(id)) return null;
  const { data } = await sb.from("subjects").select(SUBJECT_SELECT).eq("id", id).maybeSingle();
  return data ? rowToSubject(data as SubjectRow) : null;
}

export async function listTopics(sb: SupabaseClient, opts: { subjectId?: string; userId?: string }): Promise<Topic[]> {
  let q = sb.from("topics").select(TOPIC_SELECT).order("position").order("created_at");
  if (opts.subjectId) q = q.eq("subject_id", opts.subjectId);
  if (opts.userId) q = q.eq("owner_id", opts.userId);
  const { data } = await q;
  return ((data ?? []) as TopicRow[]).map(rowToTopic);
}

export async function getTopic(sb: SupabaseClient, id: string): Promise<Topic | null> {
  if (!isUuid(id)) return null;
  const { data } = await sb.from("topics").select(TOPIC_SELECT).eq("id", id).maybeSingle();
  return data ? rowToTopic(data as TopicRow) : null;
}

/** Count of topics per subject (for the home grid). */
export async function topicCounts(sb: SupabaseClient, userId: string): Promise<Record<string, number>> {
  const { data } = await sb.from("topics").select("subject_id").eq("owner_id", userId);
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { subject_id: string }[]) out[r.subject_id] = (out[r.subject_id] ?? 0) + 1;
  return out;
}
