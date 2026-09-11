import { emptyMeta, emptyProgress, type SrsCard, type Stage, type SubjectProgress, type UserMeta, type WeakMap } from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SrsMap = Record<string, SrsCard>;

const clampStars = (n: number) => Math.max(0, Math.min(3, Math.round(n || 0))) as 0 | 1 | 2 | 3;

export function normaliseProgress(p: Partial<SubjectProgress> | null | undefined): SubjectProgress {
  const levels: SubjectProgress["levels"] = {};
  for (const [id, l] of Object.entries(p?.levels ?? {})) {
    const lv = l as Partial<SubjectProgress["levels"][string]>;
    levels[id] = { done: !!lv.done, best: Number(lv.best ?? 0), stars: clampStars(Number(lv.stars ?? 0)), attempts: Number(lv.attempts ?? (lv.done ? 1 : 0)) };
  }
  return { xp: Number(p?.xp ?? 0), levels, bestExam: p?.bestExam };
}

interface ProgressRow {
  topic_id: string;
  xp: number;
  levels: SubjectProgress["levels"];
  weak: Record<string, number[]> | null;
  best_exam: number | null;
}

/**
 * Learning state for the logged-in user, keyed by topic id. Reads are synchronous from an in-memory cache
 * hydrated by `load()`; writes go to Supabase in the background (serialised queue).
 */
export class ProgressStore {
  private progress: Record<string, SubjectProgress> = {};
  private weak: WeakMap = {};
  private meta: UserMeta = emptyMeta();
  private srs: Record<string, SrsMap> = {};
  private stage: Stage | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private sb: SupabaseClient,
    private userId: string,
  ) {}

  private enqueue(fn: () => PromiseLike<unknown>) {
    this.queue = this.queue.then(() => fn()).catch((e) => console.warn("[store] write failed", e));
  }

  async load() {
    const [{ data: prog }, { data: meta }, { data: srs }, { data: prof }] = await Promise.all([
      this.sb.from("progress").select("topic_id,xp,levels,weak,best_exam").eq("user_id", this.userId),
      this.sb.from("user_meta").select("streak,best,last_day").eq("user_id", this.userId).maybeSingle(),
      this.sb.from("srs_cards").select("topic_id,card_key,state").eq("user_id", this.userId),
      this.sb.from("profiles").select("stage").eq("id", this.userId).maybeSingle(),
    ]);
    this.progress = {};
    this.weak = {};
    for (const r of (prog ?? []) as ProgressRow[]) {
      this.progress[r.topic_id] = normaliseProgress({ xp: r.xp, levels: r.levels, bestExam: r.best_exam ?? undefined });
      if (r.weak && Object.keys(r.weak).length) this.weak[r.topic_id] = r.weak;
    }
    const m = meta as { streak: number; best: number; last_day: string | null } | null;
    this.meta = m ? { streak: m.streak, best: m.best, lastDay: m.last_day } : emptyMeta();
    this.srs = {};
    for (const r of (srs ?? []) as { topic_id: string; card_key: string; state: SrsCard }[]) (this.srs[r.topic_id] ??= {})[r.card_key] = r.state;
    this.stage = ((prof as { stage: Stage } | null)?.stage as Stage | undefined) ?? null;
  }

  allProgress() {
    return this.progress;
  }
  getProgress(topicId: string) {
    return this.progress[topicId] ?? emptyProgress();
  }
  setProgress(topicId: string, p: SubjectProgress) {
    this.progress = { ...this.progress, [topicId]: p };
    this.enqueue(() => this.sb.from("progress").upsert({ user_id: this.userId, topic_id: topicId, xp: p.xp, levels: p.levels, best_exam: p.bestExam ?? null }, { onConflict: "user_id,topic_id" }));
  }
  getWeak(): WeakMap {
    return this.weak;
  }
  setWeak(next: WeakMap, topicId: string) {
    this.weak = next;
    const levels = next[topicId] ?? {};
    const p = this.getProgress(topicId);
    this.enqueue(() =>
      this.sb.from("progress").upsert({ user_id: this.userId, topic_id: topicId, xp: p.xp, levels: p.levels, weak: levels }, { onConflict: "user_id,topic_id" }),
    );
  }
  getMeta() {
    return this.meta;
  }
  setMeta(m: UserMeta) {
    this.meta = m;
    this.enqueue(() => this.sb.from("user_meta").upsert({ user_id: this.userId, streak: m.streak, best: m.best, last_day: m.lastDay, total_xp: this.totalXp() }, { onConflict: "user_id" }));
  }
  allSrs() {
    return this.srs;
  }
  getSrs(topicId: string) {
    return this.srs[topicId] ?? {};
  }
  setSrs(topicId: string, cards: SrsMap) {
    const prev = this.srs[topicId] ?? {};
    this.srs = { ...this.srs, [topicId]: cards };
    const changed = Object.entries(cards).filter(([k, v]) => prev[k] !== v);
    if (!changed.length) return;
    this.enqueue(() =>
      this.sb.from("srs_cards").upsert(
        changed.map(([card_key, state]) => ({ user_id: this.userId, topic_id: topicId, card_key, state, due: state.due })),
        { onConflict: "user_id,topic_id,card_key" },
      ),
    );
  }
  getStage() {
    return this.stage;
  }
  setStage(s: Stage) {
    this.stage = s;
    this.enqueue(() => this.sb.from("profiles").update({ stage: s }).eq("id", this.userId));
  }
  /** `activity` table via RPC (daily xp + minutes). */
  logActivity(xp: number, minutes: number) {
    if (!xp && !minutes) return;
    this.enqueue(() => this.sb.rpc("log_activity", { p_xp: Math.round(xp), p_minutes: Math.round(minutes) }));
  }
  totalXp() {
    return Object.values(this.progress).reduce((a, p) => a + (p.xp || 0), 0);
  }
}
