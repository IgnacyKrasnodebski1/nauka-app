import { emptyMeta, type SubjectProgress, type UserMeta } from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LS, lsGet, lsJson, lsSet } from "@/lib/store/local";
import { normaliseProgress, type SrsMap } from "@/lib/store/progress-store";
import { isUuid } from "@/lib/types";

function mergeProgress(a: SubjectProgress, b: SubjectProgress): SubjectProgress {
  const levels = { ...a.levels };
  for (const [id, l] of Object.entries(b.levels)) {
    const p = levels[id];
    levels[id] = p
      ? { done: p.done || l.done, best: Math.max(p.best, l.best), stars: Math.max(p.stars, l.stars) as 0 | 1 | 2 | 3, attempts: p.attempts + l.attempts }
      : l;
  }
  return { xp: Math.max(a.xp, b.xp), levels, bestExam: Math.max(a.bestExam ?? 0, b.bestExam ?? 0) || undefined };
}

/**
 * One-time merge of guest localStorage state into Supabase after login.
 * Seed subjects are keyed by slug locally → mapped to their DB uuid.
 */
export async function mergeLocalIntoSupabase(sb: SupabaseClient, userId: string): Promise<boolean> {
  const flagKey = `${LS.merged}:${userId}`;
  if (lsGet(flagKey)) return false;
  const local = lsJson<Record<string, Partial<SubjectProgress>>>(LS.progress, {});
  const localMeta = lsJson<Partial<UserMeta>>(LS.meta, {});
  const localSrs = lsJson<Record<string, SrsMap>>(LS.srs, {});
  const keys = Object.keys(local);
  if (!keys.length && !localMeta.lastDay && !Object.keys(localSrs).length) {
    lsSet(flagKey, "1");
    return false;
  }
  const slugs = [...new Set([...keys, ...Object.keys(localSrs)])].filter((k) => !isUuid(k));
  const map: Record<string, string> = {};
  if (slugs.length) {
    const { data } = await sb.from("subjects").select("id,slug").in("slug", slugs).is("owner_id", null);
    for (const r of (data ?? []) as { id: string; slug: string }[]) map[r.slug] = r.id;
  }
  const resolve = (k: string) => (isUuid(k) ? k : map[k]);

  const ids = keys.map(resolve).filter((x): x is string => !!x);
  const { data: existing } = ids.length ? await sb.from("progress").select("subject_id,xp,levels,best_exam").eq("user_id", userId).in("subject_id", ids) : { data: [] };
  const remote: Record<string, SubjectProgress> = {};
  for (const r of (existing ?? []) as { subject_id: string; xp: number; levels: SubjectProgress["levels"]; best_exam: number | null }[]) {
    remote[r.subject_id] = normaliseProgress({ xp: r.xp, levels: r.levels, bestExam: r.best_exam ?? undefined });
  }
  const rows = keys
    .map((k) => {
      const id = resolve(k);
      if (!id) return null;
      const merged = mergeProgress(remote[id] ?? { xp: 0, levels: {} }, normaliseProgress(local[k]));
      return { user_id: userId, subject_id: id, xp: merged.xp, levels: merged.levels, best_exam: merged.bestExam ?? null };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length) await sb.from("progress").upsert(rows, { onConflict: "user_id,subject_id" });

  const { data: rm } = await sb.from("user_meta").select("streak,best,last_day").eq("user_id", userId).maybeSingle();
  const r = (rm as { streak: number; best: number; last_day: string | null } | null) ?? { ...emptyMeta(), last_day: null };
  const lm: UserMeta = { streak: Number(localMeta.streak ?? 0), best: Number(localMeta.best ?? 0), lastDay: localMeta.lastDay ?? null };
  const newer = (lm.lastDay ?? "") > (r.last_day ?? "") ? lm : { streak: r.streak, best: r.best, lastDay: r.last_day };
  await sb.from("user_meta").upsert({ user_id: userId, streak: newer.streak, best: Math.max(r.best, lm.best), last_day: newer.lastDay }, { onConflict: "user_id" });

  const srsRows = Object.entries(localSrs).flatMap(([k, cards]) => {
    const id = resolve(k);
    return id ? Object.entries(cards).map(([card_key, state]) => ({ user_id: userId, subject_id: id, card_key, state, due: state.due })) : [];
  });
  if (srsRows.length) await sb.from("srs_cards").upsert(srsRows, { onConflict: "user_id,subject_id,card_key", ignoreDuplicates: true });

  lsSet(flagKey, "1");
  return true;
}
