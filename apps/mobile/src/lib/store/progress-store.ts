import { addActivity, emptyMeta, emptyProgress, markWeak, todayStr, type ActivityMap, type LeaderboardRow, type Plan, type Quest, type Stage, type SubjectProgress, type UserMeta, type WeakMap } from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normaliseProgress, writeCache, type SrsMap, type UserData } from "../data";

/**
 * Postępy zalogowanego usera — Supabase jest źródłem prawdy (`progress` po topic_id, `srs_cards`, `user_meta`,
 * `profiles.stage/show_on_leaderboard/display_name`, `quests_daily`, `achievements`, RPC `log_activity`).
 * Odczyty są synchroniczne z pamięci, zapisy lecą kolejką w tle i po każdej zmianie odświeżany jest snapshot
 * w AsyncStorage (żeby offline dało się otworzyć temat).
 */
export class ProgressStore {
  progress: Record<string, SubjectProgress> = {};
  srs: Record<string, SrsMap> = {};
  weak: WeakMap = {};
  meta: UserMeta = emptyMeta();
  stage: Stage | null = null;
  plan: Plan = "free";
  showOnLeaderboard = true;
  displayName: string | null = null;
  quests: Quest[] | null = null;
  achievements = new Set<string>();
  activity: ActivityMap = {};
  private queue: Promise<unknown> = Promise.resolve();
  /** ustawiane przez AppProvider — snapshot całości do cache */
  snapshot: (() => UserData) | null = null;

  constructor(
    private sb: SupabaseClient,
    private userId: string,
  ) {}

  hydrate(d: Omit<UserData, "subjects" | "topics">) {
    this.progress = d.progress;
    this.srs = d.srs;
    this.weak = d.weak;
    this.meta = d.meta;
    this.stage = d.stage;
    this.plan = d.plan;
    this.showOnLeaderboard = d.showOnLeaderboard;
    this.displayName = d.displayName;
    this.quests = d.quests;
    this.achievements = new Set(d.achievements);
    this.activity = d.activity;
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
      this.sb.from("progress").upsert({ user_id: this.userId, topic_id: topicId, xp: p.xp, levels: p.levels, weak, best_exam: p.bestExam ?? null, chests: p.chests ?? [] }, { onConflict: "user_id,topic_id" }),
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
  /** Wszystkie kolumny `user_meta` (streak, portfel, serca, ustawienia, stats). */
  setMeta(m: UserMeta) {
    this.meta = m;
    this.enqueue(() =>
      this.sb.from("user_meta").upsert(
        {
          user_id: this.userId,
          streak: m.streak,
          best: m.best,
          last_day: m.lastDay,
          total_xp: this.totalXp(),
          gems: Math.max(0, Math.round(m.gems)),
          hearts: Math.max(0, Math.min(5, Math.round(m.hearts))),
          hearts_updated_at: m.heartsUpdatedAt,
          daily_goal: m.dailyGoal,
          streak_freezes: Math.max(0, Math.min(5, m.streakFreezes)),
          sound_on: m.soundOn,
          stats: m.stats,
        },
        { onConflict: "user_id" },
      ),
    );
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
  setShowOnLeaderboard(v: boolean) {
    this.showOnLeaderboard = v;
    this.enqueue(() => this.sb.from("profiles").update({ show_on_leaderboard: v }).eq("id", this.userId));
  }
  setDisplayName(name: string | null) {
    this.displayName = name;
    this.enqueue(() => this.sb.from("profiles").update({ display_name: name }).eq("id", this.userId));
  }

  /** Questy dnia — upsert całej listy (`quests_daily`). */
  setQuests(qs: Quest[], day = todayStr()) {
    this.quests = qs;
    this.enqueue(() => this.sb.from("quests_daily").upsert({ user_id: this.userId, day, quests: qs }, { onConflict: "user_id,day" }));
  }

  addAchievements(keys: string[]) {
    const fresh = keys.filter((k) => !this.achievements.has(k));
    if (!fresh.length) return;
    this.achievements = new Set([...this.achievements, ...fresh]);
    this.enqueue(() => this.sb.from("achievements").upsert(fresh.map((key) => ({ user_id: this.userId, key })), { onConflict: "user_id,key", ignoreDuplicates: true }));
  }

  /** Lokalny licznik XP dnia (ring celu dziennego) — serwer dostaje sumę przez `logActivity`. */
  addTodayXp(xp: number, day = todayStr()) {
    if (xp <= 0) return;
    this.activity = addActivity(this.activity, day, xp, 0);
  }

  /** RPC `log_activity(p_xp, p_minutes, p_day)` — dzienny log (kalendarz, ranking, statystyki). Dzień = lokalny. */
  logActivity(xp: number, minutes: number) {
    const day = todayStr();
    this.activity = addActivity(this.activity, day, 0, Math.max(0, Math.round(minutes)));
    this.enqueue(() => this.sb.rpc("log_activity", { p_xp: Math.max(0, Math.round(xp)), p_minutes: Math.max(0, Math.round(minutes)), p_day: day }));
  }

  async fetchLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
    const { data, error } = await this.sb.rpc("weekly_leaderboard", { p_limit: limit });
    if (error) throw new Error(error.message);
    return ((data ?? []) as { rank: number; display_name: string; xp: number; is_me: boolean }[]).map((r) => ({ rank: Number(r.rank), displayName: r.display_name ?? "Anonim", xp: Number(r.xp ?? 0), isMe: !!r.is_me }));
  }
  async myWeeklyRank(): Promise<{ rank: number; xp: number; total: number } | null> {
    const { data, error } = await this.sb.rpc("my_weekly_rank");
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as { rank: number; xp: number; total: number } | null | undefined;
    return row ? { rank: Number(row.rank), xp: Number(row.xp), total: Number(row.total) } : null;
  }

  totalXp() {
    return Object.values(this.progress).reduce((a, p) => a + (p.xp || 0), 0);
  }
  async flush() {
    await this.queue;
  }
}
