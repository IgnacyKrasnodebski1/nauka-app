import {
  emptyMeta,
  emptyProgress,
  normalizeMeta,
  questsForToday,
  todayStr,
  type ActivityMap,
  type LeaderboardRow,
  type Plan,
  type Quest,
  type SrsCard,
  type Stage,
  type SubjectProgress,
  type UserMeta,
  type WeakMap,
} from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SrsMap = Record<string, SrsCard>;

const clampStars = (n: number) => Math.max(0, Math.min(3, Math.round(n || 0))) as 0 | 1 | 2 | 3;

export function normaliseProgress(p: Partial<SubjectProgress> | null | undefined): SubjectProgress {
  const levels: SubjectProgress["levels"] = {};
  for (const [id, l] of Object.entries(p?.levels ?? {})) {
    const lv = l as Partial<SubjectProgress["levels"][string]>;
    levels[id] = { done: !!lv.done, best: Number(lv.best ?? 0), stars: clampStars(Number(lv.stars ?? 0)), attempts: Number(lv.attempts ?? (lv.done ? 1 : 0)) };
  }
  return { xp: Number(p?.xp ?? 0), levels, bestExam: p?.bestExam, chests: Array.isArray(p?.chests) ? p!.chests!.map(Number) : [] };
}

interface ProgressRow {
  topic_id: string;
  xp: number;
  levels: SubjectProgress["levels"];
  weak: Record<string, number[]> | null;
  best_exam: number | null;
  chests: number[] | null;
}

interface MetaRow {
  streak: number;
  best: number;
  last_day: string | null;
  gems: number | null;
  hearts: number | null;
  hearts_updated_at: string | null;
  daily_goal: number | null;
  streak_freezes: number | null;
  sound_on: boolean | null;
  stats: Partial<UserMeta["stats"]> | null;
}

interface ProfileRow {
  stage: Stage | null;
  plan: Plan | null;
  show_on_leaderboard: boolean | null;
  display_name: string | null;
}

export interface MyRank {
  rank: number;
  xp: number;
  total: number;
}

/** How many days of activity we keep in memory (streak calendar = 5 weeks). */
const ACTIVITY_DAYS = 35;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayStr(d);
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
  private plan: Plan = "free";
  private showOnLeaderboard = true;
  private displayName: string | null = null;
  private quests: Quest[] = [];
  private achievements = new Set<string>();
  private activity: ActivityMap = {};
  private topicsCount = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private pendingXp = 0;
  private pendingMin = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private sb: SupabaseClient,
    private userId: string,
  ) {}

  private enqueue(fn: () => PromiseLike<unknown>) {
    this.queue = this.queue.then(() => fn()).catch((e) => console.warn("[store] write failed", e));
  }

  async load() {
    const today = todayStr();
    const [{ data: prog }, { data: meta }, { data: srs }, { data: prof }, { data: quests }, { data: ach }, { data: act }, { count }] = await Promise.all([
      this.sb.from("progress").select("topic_id,xp,levels,weak,best_exam,chests").eq("user_id", this.userId),
      this.sb.from("user_meta").select("streak,best,last_day,gems,hearts,hearts_updated_at,daily_goal,streak_freezes,sound_on,stats").eq("user_id", this.userId).maybeSingle(),
      this.sb.from("srs_cards").select("topic_id,card_key,state").eq("user_id", this.userId),
      this.sb.from("profiles").select("stage,plan,show_on_leaderboard,display_name").eq("id", this.userId).maybeSingle(),
      this.sb.from("quests_daily").select("quests").eq("user_id", this.userId).eq("day", today).maybeSingle(),
      this.sb.from("achievements").select("key").eq("user_id", this.userId),
      this.sb.from("activity").select("day,xp,minutes").eq("user_id", this.userId).gte("day", daysAgo(ACTIVITY_DAYS)),
      this.sb.from("topics").select("id", { count: "exact", head: true }).eq("owner_id", this.userId),
    ]);
    this.progress = {};
    this.weak = {};
    for (const r of (prog ?? []) as ProgressRow[]) {
      this.progress[r.topic_id] = normaliseProgress({ xp: r.xp, levels: r.levels, bestExam: r.best_exam ?? undefined, chests: r.chests ?? [] });
      if (r.weak && Object.keys(r.weak).length) this.weak[r.topic_id] = r.weak;
    }
    const m = meta as MetaRow | null;
    this.meta = m
      ? normalizeMeta({
          streak: m.streak,
          best: m.best,
          lastDay: m.last_day,
          gems: m.gems ?? 0,
          hearts: m.hearts ?? 5,
          heartsUpdatedAt: m.hearts_updated_at ?? new Date().toISOString(),
          dailyGoal: (m.daily_goal ?? 50) as UserMeta["dailyGoal"],
          streakFreezes: m.streak_freezes ?? 0,
          soundOn: m.sound_on ?? true,
          stats: m.stats ?? {},
        } as Partial<UserMeta>)
      : emptyMeta();
    this.srs = {};
    for (const r of (srs ?? []) as { topic_id: string; card_key: string; state: SrsCard }[]) (this.srs[r.topic_id] ??= {})[r.card_key] = r.state;
    const p = prof as ProfileRow | null;
    this.stage = p?.stage ?? null;
    this.plan = p?.plan === "pro" ? "pro" : "free";
    this.showOnLeaderboard = p?.show_on_leaderboard ?? true;
    this.displayName = p?.display_name ?? null;
    const stored = (quests as { quests: Quest[] } | null)?.quests ?? null;
    this.quests = questsForToday(stored, this.userId, today);
    if (!stored) this.persistQuests();
    this.achievements = new Set(((ach ?? []) as { key: string }[]).map((a) => a.key));
    this.activity = {};
    for (const a of (act ?? []) as { day: string; xp: number; minutes: number }[]) this.activity[a.day] = { day: a.day, xp: a.xp, minutes: a.minutes };
    this.topicsCount = count ?? 0;
  }

  /* ---------------- progress ---------------- */
  allProgress() {
    return this.progress;
  }
  getProgress(topicId: string) {
    return this.progress[topicId] ?? emptyProgress();
  }
  setProgress(topicId: string, p: SubjectProgress) {
    this.progress = { ...this.progress, [topicId]: p };
    this.enqueue(() =>
      this.sb
        .from("progress")
        .upsert({ user_id: this.userId, topic_id: topicId, xp: p.xp, levels: p.levels, best_exam: p.bestExam ?? null, chests: p.chests ?? [] }, { onConflict: "user_id,topic_id" }),
    );
  }
  getWeak(): WeakMap {
    return this.weak;
  }
  setWeak(next: WeakMap, topicId: string) {
    this.weak = next;
    const levels = next[topicId] ?? {};
    const p = this.getProgress(topicId);
    this.enqueue(() =>
      this.sb
        .from("progress")
        .upsert({ user_id: this.userId, topic_id: topicId, xp: p.xp, levels: p.levels, weak: levels, chests: p.chests ?? [] }, { onConflict: "user_id,topic_id" }),
    );
  }
  totalXp() {
    return Object.values(this.progress).reduce((a, p) => a + (p.xp || 0), 0);
  }
  getTopicsCount() {
    return this.topicsCount;
  }
  setTopicsCount(n: number) {
    this.topicsCount = n;
  }

  /* ---------------- meta (streak, wallet, settings, stats) ---------------- */
  getMeta() {
    return this.meta;
  }
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

  /* ---------------- srs ---------------- */
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

  /* ---------------- profile ---------------- */
  getStage() {
    return this.stage;
  }
  setStage(s: Stage) {
    this.stage = s;
    this.enqueue(() => this.sb.from("profiles").update({ stage: s }).eq("id", this.userId));
  }
  getPlan() {
    return this.plan;
  }
  getShowOnLeaderboard() {
    return this.showOnLeaderboard;
  }
  setShowOnLeaderboard(v: boolean) {
    this.showOnLeaderboard = v;
    this.enqueue(() => this.sb.from("profiles").update({ show_on_leaderboard: v }).eq("id", this.userId));
  }
  getDisplayName() {
    return this.displayName;
  }
  setDisplayName(v: string | null) {
    this.displayName = v;
    this.enqueue(() => this.sb.from("profiles").update({ display_name: v }).eq("id", this.userId));
  }

  /* ---------------- quests ---------------- */
  getQuests() {
    return this.quests;
  }
  setQuests(q: Quest[]) {
    this.quests = q;
    this.persistQuests();
  }
  private questTimer: ReturnType<typeof setTimeout> | null = null;
  /** Coalesced (~800 ms): answer events come in bursts. */
  private persistQuests() {
    if (this.questTimer) clearTimeout(this.questTimer);
    this.questTimer = setTimeout(() => {
      this.questTimer = null;
      const q = this.quests;
      this.enqueue(() => this.sb.from("quests_daily").upsert({ user_id: this.userId, day: todayStr(), quests: q, updated_at: new Date().toISOString() }, { onConflict: "user_id,day" }));
    }, 800);
  }

  /* ---------------- achievements ---------------- */
  getAchievements(): ReadonlySet<string> {
    return this.achievements;
  }
  addAchievements(keys: string[]) {
    const fresh = keys.filter((k) => !this.achievements.has(k));
    if (!fresh.length) return;
    const next = new Set(this.achievements);
    for (const k of fresh) next.add(k);
    this.achievements = next;
    this.enqueue(() => this.sb.from("achievements").upsert(fresh.map((key) => ({ user_id: this.userId, key })), { onConflict: "user_id,key", ignoreDuplicates: true }));
  }

  /* ---------------- activity (daily xp + minutes) ---------------- */
  getActivity(): ActivityMap {
    return this.activity;
  }
  /** Adds to today's row in memory immediately and to the DB via `log_activity` (coalesced, ~1.5 s). */
  logActivity(xp: number, minutes: number) {
    xp = Math.max(0, Math.round(xp));
    minutes = Math.max(0, Math.round(minutes));
    if (!xp && !minutes) return;
    const day = todayStr();
    const cur = this.activity[day] ?? { day, xp: 0, minutes: 0 };
    this.activity = { ...this.activity, [day]: { day, xp: cur.xp + xp, minutes: cur.minutes + minutes } };
    this.pendingXp += xp;
    this.pendingMin += minutes;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flushActivity(), 1500);
  }
  flushActivity() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    const xp = this.pendingXp, minutes = this.pendingMin;
    this.pendingXp = 0;
    this.pendingMin = 0;
    if (!xp && !minutes) return;
    const p_day = todayStr();
    this.enqueue(() => this.sb.rpc("log_activity", { p_xp: xp, p_minutes: minutes, p_day }));
  }

  /* ---------------- leaderboard ---------------- */
  async fetchLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
    const { data, error } = await this.sb.rpc("weekly_leaderboard", { p_limit: limit });
    if (error) {
      console.warn("[store] leaderboard", error.message);
      return [];
    }
    return ((data ?? []) as { rank: number; display_name: string; xp: number; is_me: boolean }[]).map((r) => ({ rank: r.rank, displayName: r.display_name, xp: r.xp, isMe: r.is_me }));
  }
  async myWeeklyRank(): Promise<MyRank | null> {
    const { data, error } = await this.sb.rpc("my_weekly_rank");
    if (error) {
      console.warn("[store] my rank", error.message);
      return null;
    }
    const row = (Array.isArray(data) ? data[0] : data) as { rank: number; xp: number; total: number } | null | undefined;
    return row ? { rank: row.rank, xp: row.xp, total: row.total } : null;
  }
}
