import {
  emptyMeta,
  emptyProgress,
  normalizeMeta,
  questsForToday,
  todayStr,
  weeklyQuestFor,
  type ActivityMap,
  type AlbumMap,
  type BossRecord,
  type GhostRecord,
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
import { emptyExtra, type DailyPlan, type ExamRec, type Extra, type Goal, type History, type Overrides, type Reminder, type Themes } from "@/lib/store/extra";
import type { TestPlan } from "@/lib/tests";

export type SrsMap = Record<string, SrsCard>;

const clampStars = (n: number) => Math.max(0, Math.min(3, Math.round(n || 0))) as 0 | 1 | 2 | 3;

export function normaliseProgress(p: Partial<SubjectProgress> | null | undefined): SubjectProgress {
  const levels: SubjectProgress["levels"] = {};
  for (const [id, l] of Object.entries(p?.levels ?? {})) {
    const lv = l as Partial<SubjectProgress["levels"][string]>;
    levels[id] = { done: !!lv.done, best: Number(lv.best ?? 0), stars: clampStars(Number(lv.stars ?? 0)), attempts: Number(lv.attempts ?? (lv.done ? 1 : 0)) };
  }
  return {
    xp: Number(p?.xp ?? 0),
    levels,
    bestExam: p?.bestExam,
    chests: Array.isArray(p?.chests) ? p!.chests!.map(Number) : [],
    boss: p?.boss && typeof p.boss === "object" ? p.boss : undefined,
    ghost: p?.ghost && typeof p.ghost === "object" ? p.ghost : {},
  };
}

interface ProgressRow {
  topic_id: string;
  xp: number;
  levels: SubjectProgress["levels"];
  weak: Record<string, number[]> | null;
  best_exam: number | null;
  chests: number[] | null;
  boss: BossRecord | null;
  ghost: Record<string, GhostRecord> | null;
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
  themes: Themes | null;
  boost_until: string | null;
  album: AlbumMap | null;
  overrides: Overrides | null;
  tests: TestPlan[] | null;
  weekly_quest: Quest | null;
  history: History | null;
  daily: DailyPlan | null;
  reduce_motion: boolean | null;
  reminder: Reminder | null;
  exams: Record<string, ExamRec> | null;
}

interface ProfileRow {
  stage: Stage | null;
  plan: Plan | null;
  show_on_leaderboard: boolean | null;
  display_name: string | null;
  goal: Goal | null;
}

export interface MyRank {
  rank: number;
  xp: number;
  total: number;
}

/** How many days of activity we keep in memory (profile heatmap = 8 weeks). */
const ACTIVITY_DAYS = 63;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayStr(d);
}

const META_SELECT = "streak,best,last_day,gems,hearts,hearts_updated_at,daily_goal,streak_freezes,sound_on,stats,themes,boost_until,album,overrides,tests,weekly_quest,history,daily,reduce_motion,reminder,exams";

/**
 * Learning state for the logged-in user, keyed by topic id. Reads are synchronous from an in-memory cache
 * hydrated by `load()`; writes go to Supabase in the background (serialised queue).
 */
export class ProgressStore {
  private progress: Record<string, SubjectProgress> = {};
  private weak: WeakMap = {};
  private meta: UserMeta = emptyMeta();
  private extra: Extra = emptyExtra();
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
  private metaTimer: ReturnType<typeof setTimeout> | null = null;

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
      this.sb.from("progress").select("topic_id,xp,levels,weak,best_exam,chests,boss,ghost").eq("user_id", this.userId),
      this.sb.from("user_meta").select(META_SELECT).eq("user_id", this.userId).maybeSingle(),
      this.sb.from("srs_cards").select("topic_id,card_key,state").eq("user_id", this.userId),
      this.sb.from("profiles").select("stage,plan,show_on_leaderboard,display_name,goal").eq("id", this.userId).maybeSingle(),
      this.sb.from("quests_daily").select("quests").eq("user_id", this.userId).eq("day", today).maybeSingle(),
      this.sb.from("achievements").select("key").eq("user_id", this.userId),
      this.sb.from("activity").select("day,xp,minutes").eq("user_id", this.userId).gte("day", daysAgo(ACTIVITY_DAYS)),
      this.sb.from("topics").select("id", { count: "exact", head: true }).eq("owner_id", this.userId),
    ]);
    this.progress = {};
    this.weak = {};
    for (const r of (prog ?? []) as ProgressRow[]) {
      this.progress[r.topic_id] = normaliseProgress({ xp: r.xp, levels: r.levels, bestExam: r.best_exam ?? undefined, chests: r.chests ?? [], boss: r.boss ?? undefined, ghost: r.ghost ?? {} });
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
    const p = prof as ProfileRow | null;
    const e = emptyExtra();
    this.extra = {
      goal: p?.goal ?? null,
      themes: m?.themes && Array.isArray(m.themes.owned) ? m.themes : e.themes,
      boostUntil: m?.boost_until ? new Date(m.boost_until).getTime() : null,
      album: m?.album && typeof m.album === "object" ? m.album : {},
      overrides: m?.overrides && typeof m.overrides === "object" ? m.overrides : {},
      tests: Array.isArray(m?.tests) ? m!.tests! : [],
      weekly: m?.weekly_quest ?? null,
      history: m?.history && typeof m.history === "object" ? m.history : {},
      daily: m?.daily && typeof m.daily === "object" ? m.daily : null,
      reduceMotion: !!m?.reduce_motion,
      reminder: m?.reminder ?? null,
      exams: m?.exams && typeof m.exams === "object" ? m.exams : {},
    };
    this.srs = {};
    for (const r of (srs ?? []) as { topic_id: string; card_key: string; state: SrsCard }[]) (this.srs[r.topic_id] ??= {})[r.card_key] = r.state;
    this.stage = p?.stage ?? null;
    this.plan = p?.plan === "pro" ? "pro" : "free";
    this.showOnLeaderboard = p?.show_on_leaderboard ?? true;
    this.displayName = p?.display_name ?? null;
    const stored = (quests as { quests: Quest[] } | null)?.quests ?? null;
    this.quests = questsForToday(stored, this.userId, today, this.meta.dailyGoal);
    if (!stored) this.persistQuests();
    const wk = weeklyQuestFor(this.extra.weekly, this.userId, today);
    if (wk !== this.extra.weekly) this.setExtra({ weekly: wk });
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
  private progressRow(topicId: string, p: SubjectProgress) {
    return { user_id: this.userId, topic_id: topicId, xp: p.xp, levels: p.levels, best_exam: p.bestExam ?? null, chests: p.chests ?? [], boss: p.boss ?? null, ghost: p.ghost ?? {} };
  }
  setProgress(topicId: string, p: SubjectProgress) {
    this.progress = { ...this.progress, [topicId]: p };
    this.enqueue(() => this.sb.from("progress").upsert(this.progressRow(topicId, p), { onConflict: "user_id,topic_id" }));
  }
  getWeak(): WeakMap {
    return this.weak;
  }
  setWeak(next: WeakMap, topicId: string) {
    this.weak = next;
    const levels = next[topicId] ?? {};
    const p = this.getProgress(topicId);
    this.enqueue(() => this.sb.from("progress").upsert({ ...this.progressRow(topicId, p), weak: levels }, { onConflict: "user_id,topic_id" }));
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

  /* ---------------- meta (streak, wallet, settings, stats) + 2.0 extras ---------------- */
  getMeta() {
    return this.meta;
  }
  getExtra() {
    return this.extra;
  }
  setMeta(m: UserMeta) {
    this.meta = m;
    this.persistMeta();
  }
  setExtra(patch: Partial<Extra>) {
    this.extra = { ...this.extra, ...patch };
    if ("goal" in patch) this.enqueue(() => this.sb.from("profiles").update({ goal: patch.goal ?? null }).eq("id", this.userId));
    this.persistMeta();
  }
  /** Coalesced (~300 ms): several fields change in one interaction (xp → streak → stats). */
  private persistMeta() {
    if (this.metaTimer) clearTimeout(this.metaTimer);
    this.metaTimer = setTimeout(() => {
      this.metaTimer = null;
      const m = this.meta, e = this.extra;
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
            themes: e.themes,
            boost_until: e.boostUntil ? new Date(e.boostUntil).toISOString() : null,
            album: e.album,
            overrides: e.overrides,
            tests: e.tests,
            weekly_quest: e.weekly,
            history: e.history,
            daily: e.daily,
            reduce_motion: e.reduceMotion,
            reminder: e.reminder,
            exams: e.exams,
          },
          { onConflict: "user_id" },
        ),
      );
    }, 300);
  }
  flushMeta() {
    if (this.metaTimer) {
      clearTimeout(this.metaTimer);
      this.metaTimer = null;
      this.persistMeta();
      if (this.metaTimer) {
        clearTimeout(this.metaTimer);
        this.metaTimer = null;
      }
    }
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

  /* ---------------- quests (daily in quests_daily, weekly in user_meta.weekly_quest) ---------------- */
  /** Daily quests + the weekly one (last). */
  getQuests(): Quest[] {
    return this.extra.weekly ? [...this.quests, this.extra.weekly] : this.quests;
  }
  setQuests(q: Quest[]) {
    const weekly = q.find((x) => x.weekly || x.id.startsWith("w:")) ?? null;
    this.quests = q.filter((x) => !x.weekly && !x.id.startsWith("w:"));
    this.persistQuests();
    if (weekly !== this.extra.weekly) this.setExtra({ weekly });
  }
  private questTimer: ReturnType<typeof setTimeout> | null = null;
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

  /* ---------------- reset (Settings → Wyzeruj postępy; streak stays like legacy) ---------------- */
  async resetProgress() {
    this.progress = {};
    this.weak = {};
    this.srs = {};
    this.quests = [];
    this.achievements = new Set();
    const m = this.meta;
    this.meta = { ...emptyMeta(), streak: m.streak, best: m.best, lastDay: m.lastDay, soundOn: m.soundOn, dailyGoal: m.dailyGoal };
    this.extra = { ...emptyExtra(), goal: this.extra.goal, reduceMotion: this.extra.reduceMotion, reminder: this.extra.reminder };
    await Promise.all([
      this.sb.from("progress").delete().eq("user_id", this.userId),
      this.sb.from("srs_cards").delete().eq("user_id", this.userId),
      this.sb.from("quests_daily").delete().eq("user_id", this.userId),
      this.sb.from("achievements").delete().eq("user_id", this.userId),
    ]);
    this.persistMeta();
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
