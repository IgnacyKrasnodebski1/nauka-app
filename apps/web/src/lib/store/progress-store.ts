import { emptyMeta, emptyProgress, type SrsCard, type Stage, type SubjectProgress, type UserMeta } from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LS, lsJson, lsSet } from "@/lib/store/local";

export type SrsMap = Record<string, SrsCard>;

/**
 * Persistence abstraction for learning state. Reads are synchronous from an in-memory cache
 * (hydrated by `load()`), writes are persisted in the background.
 */
export interface ProgressStore {
  readonly kind: "local" | "supabase";
  load(): Promise<void>;
  allProgress(): Record<string, SubjectProgress>;
  getProgress(key: string): SubjectProgress;
  setProgress(key: string, p: SubjectProgress): void;
  getMeta(): UserMeta;
  setMeta(m: UserMeta): void;
  getSrs(key: string): SrsMap;
  setSrs(key: string, cards: SrsMap): void;
  getStage(): Stage | null;
  setStage(s: Stage): void;
  totalXp(): number;
}

const clampStars = (n: number) => Math.max(0, Math.min(3, Math.round(n || 0))) as 0 | 1 | 2 | 3;

/** Normalise a possibly-legacy progress object (legacy rows lack `attempts`). */
export function normaliseProgress(p: Partial<SubjectProgress> | null | undefined): SubjectProgress {
  const levels: SubjectProgress["levels"] = {};
  for (const [id, l] of Object.entries(p?.levels ?? {})) {
    const lv = l as Partial<SubjectProgress["levels"][string]>;
    levels[id] = { done: !!lv.done, best: Number(lv.best ?? 0), stars: clampStars(Number(lv.stars ?? 0)), attempts: Number(lv.attempts ?? (lv.done ? 1 : 0)) };
  }
  return { xp: Number(p?.xp ?? 0), levels, bestExam: p?.bestExam };
}

/* ------------------------------------------------------------------ local */
export class LocalProgressStore implements ProgressStore {
  readonly kind = "local" as const;
  private progress: Record<string, SubjectProgress> = {};
  private meta: UserMeta = emptyMeta();
  private srs: Record<string, SrsMap> = {};
  private stage: Stage | null = null;

  async load() {
    const raw = lsJson<Record<string, Partial<SubjectProgress>>>(LS.progress, {});
    this.progress = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, normaliseProgress(v)]));
    const m = lsJson<Partial<UserMeta>>(LS.meta, {});
    this.meta = { streak: Number(m.streak ?? 0), best: Number(m.best ?? 0), lastDay: m.lastDay ?? null };
    this.srs = lsJson(LS.srs, {});
    this.stage = lsJson<Stage | null>(LS.stage, null);
  }
  allProgress() {
    return this.progress;
  }
  getProgress(key: string) {
    return this.progress[key] ?? emptyProgress();
  }
  setProgress(key: string, p: SubjectProgress) {
    this.progress = { ...this.progress, [key]: p };
    lsSet(LS.progress, JSON.stringify(this.progress));
  }
  getMeta() {
    return this.meta;
  }
  setMeta(m: UserMeta) {
    this.meta = m;
    lsSet(LS.meta, JSON.stringify(m));
  }
  getSrs(key: string) {
    return this.srs[key] ?? {};
  }
  setSrs(key: string, cards: SrsMap) {
    this.srs = { ...this.srs, [key]: cards };
    lsSet(LS.srs, JSON.stringify(this.srs));
  }
  getStage() {
    return this.stage;
  }
  setStage(s: Stage) {
    this.stage = s;
    lsSet(LS.stage, JSON.stringify(s));
  }
  totalXp() {
    return Object.values(this.progress).reduce((a, p) => a + (p.xp || 0), 0);
  }
}

/* --------------------------------------------------------------- supabase */
export class SupabaseProgressStore implements ProgressStore {
  readonly kind = "supabase" as const;
  private progress: Record<string, SubjectProgress> = {};
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
      this.sb.from("progress").select("subject_id,xp,levels,best_exam").eq("user_id", this.userId),
      this.sb.from("user_meta").select("streak,best,last_day").eq("user_id", this.userId).maybeSingle(),
      this.sb.from("srs_cards").select("subject_id,card_key,state").eq("user_id", this.userId),
      this.sb.from("profiles").select("stage").eq("id", this.userId).maybeSingle(),
    ]);
    this.progress = {};
    for (const r of (prog ?? []) as { subject_id: string; xp: number; levels: SubjectProgress["levels"]; best_exam: number | null }[]) {
      this.progress[r.subject_id] = normaliseProgress({ xp: r.xp, levels: r.levels, bestExam: r.best_exam ?? undefined });
    }
    const m = meta as { streak: number; best: number; last_day: string | null } | null;
    this.meta = m ? { streak: m.streak, best: m.best, lastDay: m.last_day } : emptyMeta();
    this.srs = {};
    for (const r of (srs ?? []) as { subject_id: string; card_key: string; state: SrsCard }[]) {
      (this.srs[r.subject_id] ??= {})[r.card_key] = r.state;
    }
    this.stage = ((prof as { stage: Stage } | null)?.stage as Stage | undefined) ?? null;
  }
  allProgress() {
    return this.progress;
  }
  getProgress(key: string) {
    return this.progress[key] ?? emptyProgress();
  }
  setProgress(key: string, p: SubjectProgress) {
    this.progress = { ...this.progress, [key]: p };
    this.enqueue(() =>
      this.sb.from("progress").upsert({ user_id: this.userId, subject_id: key, xp: p.xp, levels: p.levels, best_exam: p.bestExam ?? null }, { onConflict: "user_id,subject_id" }),
    );
  }
  getMeta() {
    return this.meta;
  }
  setMeta(m: UserMeta) {
    this.meta = m;
    this.enqueue(() => this.sb.from("user_meta").upsert({ user_id: this.userId, streak: m.streak, best: m.best, last_day: m.lastDay, total_xp: this.totalXp() }, { onConflict: "user_id" }));
  }
  getSrs(key: string) {
    return this.srs[key] ?? {};
  }
  setSrs(key: string, cards: SrsMap) {
    const prev = this.srs[key] ?? {};
    this.srs = { ...this.srs, [key]: cards };
    const changed = Object.entries(cards).filter(([k, v]) => prev[k] !== v);
    if (!changed.length) return;
    this.enqueue(() =>
      this.sb.from("srs_cards").upsert(
        changed.map(([card_key, state]) => ({ user_id: this.userId, subject_id: key, card_key, state, due: state.due })),
        { onConflict: "user_id,subject_id,card_key" },
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
  totalXp() {
    return Object.values(this.progress).reduce((a, p) => a + (p.xp || 0), 0);
  }
}
