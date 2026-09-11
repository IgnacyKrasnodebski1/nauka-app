import { emptyMeta, emptyProgress, markWeak, type Stage, type SubjectProgress, type UserMeta, type WeakMap } from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normaliseProgress, writeCache, type SrsMap, type UserData } from "../data";

/**
 * Postępy zalogowanego usera — Supabase jest źródłem prawdy (`progress` po topic_id, `srs_cards`, `user_meta`,
 * `profiles.stage`, RPC `log_activity`). Odczyty są synchroniczne z pamięci, zapisy lecą kolejką w tle
 * i po każdej zmianie odświeżany jest snapshot w AsyncStorage (żeby offline dało się otworzyć temat).
 */
export class ProgressStore {
  progress: Record<string, SubjectProgress> = {};
  srs: Record<string, SrsMap> = {};
  weak: WeakMap = {};
  meta: UserMeta = emptyMeta();
  stage: Stage | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  /** ustawiane przez AppProvider — snapshot całości do cache */
  snapshot: (() => UserData) | null = null;

  constructor(
    private sb: SupabaseClient,
    private userId: string,
  ) {}

  hydrate(d: Pick<UserData, "progress" | "srs" | "weak" | "meta" | "stage">) {
    this.progress = d.progress;
    this.srs = d.srs;
    this.weak = d.weak;
    this.meta = d.meta;
    this.stage = d.stage;
  }

  private enqueue(fn: () => PromiseLike<unknown>) {
    this.queue = this.queue.then(fn).catch((e) => console.warn("[store] write failed", e));
    if (this.snapshot) void writeCache(this.userId, this.snapshot());
  }

  getProgress(topicId: string): SubjectProgress {
    return this.progress[topicId] ?? emptyProgress();
  }
  private upsertProgress(topicId: string) {
    const p = this.progress[topicId] ?? emptyProgress();
    const weak = this.weak[topicId] ?? {};
    this.enqueue(() =>
      this.sb.from("progress").upsert({ user_id: this.userId, topic_id: topicId, xp: p.xp, levels: p.levels, weak, best_exam: p.bestExam ?? null }, { onConflict: "user_id,topic_id" }),
    );
  }
  setProgress(topicId: string, p: SubjectProgress) {
    this.progress = { ...this.progress, [topicId]: normaliseProgress(p) };
    this.upsertProgress(topicId);
  }
  /** zapisuje błędne/poprawne pytania (shared `markWeak`) i utrwala `progress.weak` */
  setWeak(topicId: string, levelId: string, wrongIdx: number[], rightIdx: number[]) {
    this.weak = markWeak(this.weak, topicId, levelId, wrongIdx, rightIdx);
    this.upsertProgress(topicId);
  }

  getMeta() {
    return this.meta;
  }
  setMeta(m: UserMeta) {
    this.meta = m;
    this.enqueue(() => this.sb.from("user_meta").upsert({ user_id: this.userId, streak: m.streak, best: m.best, last_day: m.lastDay, total_xp: this.totalXp() }, { onConflict: "user_id" }));
  }

  getSrs(topicId: string): SrsMap {
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

  setStage(s: Stage) {
    this.stage = s;
    this.enqueue(() => this.sb.from("profiles").update({ stage: s }).eq("id", this.userId));
  }

  /** RPC `log_activity(p_xp, p_minutes)` — dzienny log (kalendarz, statystyki). */
  logActivity(xp: number, minutes: number) {
    this.enqueue(() => this.sb.rpc("log_activity", { p_xp: Math.max(0, Math.round(xp)), p_minutes: Math.max(0, Math.round(minutes)) }));
  }

  totalXp() {
    return Object.values(this.progress).reduce((a, p) => a + (p.xp || 0), 0);
  }
  async flush() {
    await this.queue;
  }
}
