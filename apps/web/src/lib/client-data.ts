"use client";
/** Client-side reads (anon key + RLS) for global sheets that open on any screen (QuickAdd → TestPlan). */
import type { Subject, Topic } from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rowToSubject, rowToTopic, slimTopic, SUBJECT_SELECT, TOPIC_SELECT, type SubjectRow, type TopicRow } from "@/lib/types";

let cache: { at: number; subjects: Subject[]; topics: Topic[] } | null = null;

export async function loadLibrary(sb: SupabaseClient, userId: string, force = false): Promise<{ subjects: Subject[]; topics: Topic[] }> {
  if (!force && cache && Date.now() - cache.at < 30_000) return cache;
  const [{ data: s }, { data: t }] = await Promise.all([
    sb.from("subjects").select(SUBJECT_SELECT).eq("owner_id", userId).order("position").order("created_at"),
    sb.from("topics").select(TOPIC_SELECT).eq("owner_id", userId).order("position").order("created_at"),
  ]);
  cache = { at: Date.now(), subjects: ((s ?? []) as SubjectRow[]).map(rowToSubject), topics: ((t ?? []) as TopicRow[]).map(rowToTopic).map(slimTopic) };
  return cache;
}
export function invalidateLibrary() {
  cache = null;
}
