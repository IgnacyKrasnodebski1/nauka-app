import { type SubjectProgress, type UserMeta } from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KEYS, getJson, setJson } from "../storage";
import { isUuid } from "../supabase";
import { normaliseMeta, normaliseProgress, type SrsMap } from "./progress-store";

export function mergeProgress(a: SubjectProgress, b: SubjectProgress): SubjectProgress {
  const levels = { ...a.levels };
  for (const [id, l] of Object.entries(b.levels)) {
    const p = levels[id];
    levels[id] = p
      ? { done: p.done || l.done, best: Math.max(p.best, l.best), stars: Math.max(p.stars, l.stars) as 0 | 1 | 2 | 3, attempts: p.attempts + l.attempts }
      : l;
  }
  const out: SubjectProgress = { xp: Math.max(a.xp, b.xp), levels };
  const be = Math.max(a.bestExam ?? 0, b.bestExam ?? 0);
  if (be) out.bestExam = be;
  return out;
}

/**
 * Jednorazowe scalenie stanu gościa (AsyncStorage) z Supabase po zalogowaniu.
 * Seedy są lokalnie kluczowane slugiem → mapujemy na uuid z DB. Zwraca true, gdy coś scalono.
 */
export async function mergeLocalIntoSupabase(sb: SupabaseClient, userId: string): Promise<boolean> {
  const flagKey = `${KEYS.merged}:${userId}`;
  if (await getJson<boolean>(flagKey, false)) return false;

  const [local, localMeta, localSrs] = await Promise.all([
    getJson<Record<string, Partial<SubjectProgress>>>(KEYS.progress, {}),
    getJson<Partial<UserMeta>>(KEYS.meta, {}),
    getJson<Record<string, SrsMap>>(KEYS.srs, {}),
  ]);
  const keys = Object.keys(local);
  if (!keys.length && !localMeta.lastDay && !Object.keys(localSrs).length) {
    await setJson(flagKey, true);
    return false;
  }

  const slugs = [...new Set([...keys, ...Object.keys(localSrs)])].filter((k) => !isUuid(k));
  const map: Record<string, string> = {};
  if (slugs.length) {
    const { data } = await sb.from("subjects").select("id,slug").in("slug", slugs).is("owner_id", null);
    for (const r of (data ?? []) as { id: string; slug: string }[]) map[r.slug] = r.id;
  }
  const resolve = (k: string) => (isUuid(k) ? k : map[k]);

  // progress
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

  // meta (streak) — wygrywa nowsza data
  const { data: rm } = await sb.from("user_meta").select("streak,best,last_day").eq("user_id", userId).maybeSingle();
  const r = (rm as { streak: number; best: number; last_day: string | null } | null) ?? { streak: 0, best: 0, last_day: null };
  const lm = normaliseMeta(localMeta);
  const newer: UserMeta = (lm.lastDay ?? "") > (r.last_day ?? "") ? lm : { streak: r.streak, best: r.best, lastDay: r.last_day };
  await sb.from("user_meta").upsert({ user_id: userId, streak: newer.streak, best: Math.max(newer.best, lm.best, r.best), last_day: newer.lastDay }, { onConflict: "user_id" });

  // srs — lokalne karty tylko tam, gdzie zdalnych brak
  const srsRows: { user_id: string; subject_id: string; card_key: string; state: SrsMap[string]; due: string }[] = [];
  for (const [k, cards] of Object.entries(localSrs)) {
    const id = resolve(k);
    if (!id) continue;
    for (const [card_key, state] of Object.entries(cards)) srsRows.push({ user_id: userId, subject_id: id, card_key, state, due: state.due });
  }
  if (srsRows.length) await sb.from("srs_cards").upsert(srsRows, { onConflict: "user_id,subject_id,card_key", ignoreDuplicates: true });

  await setJson(flagKey, true);
  return rows.length > 0 || srsRows.length > 0;
}
