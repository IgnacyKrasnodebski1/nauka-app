"use client";
import {
  addGems,
  applyQuestEvent,
  claimQuest as claimQuestPure,
  claimTrophy as claimTrophyPure,
  dailyGoalPct,
  evaluateAchievements,
  gainHeart as gainHeartPure,
  GEM_COSTS,
  GEMS,
  heartsNow,
  loseHeart as loseHeartPure,
  openChest as openChestPure,
  rankChanged,
  rankFor,
  refillHearts as refillHeartsPure,
  spendGems as spendGemsPure,
  streakDisplay,
  todayStr,
  todayXp as todayXpOf,
  touchStreak,
  weekStrip,
  XP,
  type Achievement,
  type ActivityMap,
  type DailyGoal,
  type HeartsView,
  type LeaderboardRow,
  type Plan,
  type Quest,
  type QuestEvent,
  type Rank,
  type Stage,
  type SubjectProgress,
  type UserMeta,
  type UserStats,
  type WeakMap,
} from "@nauka/shared";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { ProgressStore, type MyRank, type SrsMap } from "@/lib/store/progress-store";
import { Emitter, type AppEvent, type AppEventType } from "@/lib/store/events";
import { useSfx } from "@/lib/sfx";

export interface Toast {
  id: number;
  text: string;
  kind?: "xp" | "gem" | "heart" | "info";
}

export interface AppUser {
  id: string;
  email: string | null;
  name: string | null;
}

export type WeekStrip = ReturnType<typeof weekStrip>;

interface AppState {
  /** store hydrated */
  ready: boolean;
  user: AppUser;
  session: Session | null;
  /** bearer token for /api calls (falls back to cookie session server-side) */
  authHeaders(): Record<string, string>;
  supabase: SupabaseClient;
  store: ProgressStore | null;
  progressOf(topicId: string): SubjectProgress;
  allProgress(): Record<string, SubjectProgress>;
  setProgress(topicId: string, p: SubjectProgress): void;
  /** The single XP funnel: topic XP → activity → quests → daily goal bonus → rank change. */
  addXp(topicId: string, n: number): void;
  weak: WeakMap;
  setWeak(next: WeakMap, topicId: string): void;
  srsOf(topicId: string): SrsMap;
  allSrs(): Record<string, SrsMap>;
  setSrs(topicId: string, cards: SrsMap): void;
  /** Minutes (and optionally extra XP already added elsewhere) to today's activity row. */
  logActivity(xp: number, minutes: number): void;
  meta: UserMeta;
  streak: number;
  totalXp: number;
  stage: Stage | null;
  setStage(st: Stage): void;
  plan: Plan;
  unlimitedHearts: boolean;
  hearts: HeartsView;
  gems: number;
  dailyGoal: DailyGoal;
  todayXp: number;
  goalPct: number;
  goalMet: boolean;
  activity: ActivityMap;
  week: WeekStrip;
  quests: Quest[];
  questEvent(ev: QuestEvent): void;
  claimQuest(id: string): void;
  achievements: ReadonlySet<string>;
  unlockedQueue: Achievement[];
  popUnlocked(): void;
  levelUpQueue: Rank[];
  popLevelUp(): void;
  rank: Rank;
  soundOn: boolean;
  setSoundOn(v: boolean): void;
  setDailyGoal(g: DailyGoal): void;
  showOnLeaderboard: boolean;
  setShowOnLeaderboard(v: boolean): void;
  displayName: string | null;
  setDisplayName(v: string | null): void;
  /** wallet credit (level pass, session, exam…) */
  addGems(n: number): void;
  /** false when not enough gems */
  spendGems(cost: number): boolean;
  refillHearts(): boolean;
  buyStreakFreeze(): boolean;
  loseHeart(): HeartsView;
  gainHeart(): void;
  bumpStats(patch: Partial<UserStats> | ((s: UserStats) => Partial<UserStats>)): void;
  openChest(topicId: string, chestIdx: number): number;
  claimTrophy(topicId: string): number;
  fetchLeaderboard(limit?: number): Promise<LeaderboardRow[]>;
  myWeeklyRank(): Promise<MyRank | null>;
  on<T extends AppEventType>(type: T, fn: (e: Extract<AppEvent, { type: T }>) => void): () => void;
  toast(text: string, kind?: Toast["kind"]): void;
  toasts: Toast[];
  signOut(): Promise<void>;
  version: number;
}

const Ctx = createContext<AppState | null>(null);

/** Wall clock in 30 s steps (hearts regenerate on it), refreshed when the tab becomes visible. */
const CLOCK_STEP = 30_000;
const clockSubscribe = (cb: () => void) => {
  const t = setInterval(cb, CLOCK_STEP);
  const vis = () => document.visibilityState === "visible" && cb();
  document.addEventListener("visibilitychange", vis);
  return () => {
    clearInterval(t);
    document.removeEventListener("visibilitychange", vis);
  };
};
const clockNow = () => Math.floor(Date.now() / CLOCK_STEP) * CLOCK_STEP;
const clockServer = () => 0;
const EMPTY: SubjectProgress = { xp: 0, levels: {}, chests: [] };
const NO_HEARTS: HeartsView = { hearts: 5, unlimited: false, nextInMs: null };

export function AppProvider({ user, children }: { user: AppUser; children: ReactNode }) {
  const supabase = useMemo(() => getBrowserSupabase()!, []);
  const [session, setSession] = useState<Session | null>(null);
  const [store, setStore] = useState<ProgressStore | null>(null);
  const [version, setVersion] = useState(0);
  const now = useSyncExternalStore(clockSubscribe, clockNow, clockServer);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unlockedQueue, setUnlocked] = useState<Achievement[]>([]);
  const [levelUpQueue, setLevelUps] = useState<Rank[]>([]);
  const emitter = useRef(new Emitter()).current;
  const sfx = useSfx();
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const s = new ProgressStore(supabase, user.id);
    s.load()
      .catch((e) => console.warn("[store] load failed", e))
      .then(() => alive && setStore(s));
    return () => {
      alive = false;
      s.flushActivity();
    };
  }, [supabase, user.id]);

  // flush coalesced activity writes when the page is hidden / unloaded
  useEffect(() => {
    const flush = () => store?.flushActivity();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [store]);

  // sound setting → sfx layer
  useEffect(() => {
    if (store) sfx.setEnabled(store.getMeta().soundOn);
  }, [store, version, sfx]);

  const toast = useCallback((text: string, kind?: Toast["kind"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1900);
  }, []);

  const value = useMemo<AppState>(() => {
    const meta = store?.getMeta() ?? { streak: 0, best: 0, lastDay: null, gems: 0, hearts: 5, heartsUpdatedAt: new Date(0).toISOString(), dailyGoal: 50 as DailyGoal, streakFreezes: 0, soundOn: true, stats: { cardsReviewed: 0, levelsDone: 0, perfectLevels: 0, examsPassed: 0, comboBest: 0, questsDone: 0, chestsOpened: 0, nightOwl: false, earlyBird: false } };
    const plan = store?.getPlan() ?? "free";
    const unlimited = plan === "pro";
    const hearts = store ? heartsNow(meta, now, unlimited) : NO_HEARTS;
    const activity = store?.getActivity() ?? {};
    const today = todayStr();
    const tXp = todayXpOf(activity, today);
    const totalXp = store?.totalXp() ?? 0;
    const achievements = store?.getAchievements() ?? new Set<string>();

    const emit = (e: AppEvent) => emitter.emit(e);

    /** Re-evaluate achievements after any stats / xp / streak change. */
    const checkAchievements = (m: UserMeta) => {
      if (!store) return m;
      const fresh = evaluateAchievements({ meta: m, topicsCount: store.getTopicsCount(), totalXp: store.totalXp(), streak: streakDisplay(m) }, store.getAchievements());
      if (!fresh.length) return m;
      store.addAchievements(fresh.map((a) => a.key));
      const bonus = fresh.reduce((a, x) => a + x.gems, 0);
      m = addGems(m, bonus);
      setUnlocked((q) => [...q, ...fresh]);
      for (const a of fresh) emit({ type: "achievement", achievement: a });
      if (bonus) emit({ type: "gem", delta: bonus, gems: m.gems });
      return m;
    };

    const writeMeta = (m: UserMeta, evaluate = true) => {
      if (!store) return;
      store.setMeta(evaluate ? checkAchievements(m) : m);
      bump();
    };

    const applyQuest = (ev: QuestEvent) => {
      if (!store) return;
      const before = store.getQuests();
      const after = applyQuestEvent(before, ev);
      if (after.every((q, i) => q.progress === before[i]?.progress && q.done === before[i]?.done)) return;
      store.setQuests(after);
      after.forEach((q, i) => {
        if (q.done && !before[i]?.done) setTimeout(() => toast(`Misja gotowa: ${q.title}`, "gem"), 400);
      });
    };

    const addXp = (topicId: string, n: number) => {
      if (!store) return;
      const prevTotal = store.totalXp();
      let m = store.getMeta();
      if (n > 0) {
        const p = store.getProgress(topicId);
        store.setProgress(topicId, { ...p, xp: p.xp + n });
        store.logActivity(n, 0);
        emit({ type: "xp", amount: n, topicId });
        applyQuest({ type: "xp", amount: n });
      }
      // streak
      const t = touchStreak(m);
      m = t.meta;
      if (t.extended) {
        emit({ type: "streak", days: m.streak, usedFreeze: t.usedFreeze });
        if (m.streak > 1) setTimeout(() => toast(t.usedFreeze ? `Seria uratowana: ${m.streak} dni (zużyto zamrożenie)` : `Seria ${m.streak} dni z rzędu!`, "info"), 900);
      }
      // time-of-day badges
      const h = new Date().getHours();
      if (n > 0 && ((h >= 23 && !m.stats.nightOwl) || (h < 7 && !m.stats.earlyBird))) m = { ...m, stats: { ...m.stats, nightOwl: m.stats.nightOwl || h >= 23, earlyBird: m.stats.earlyBird || h < 7 } };
      // daily goal bonus (once per day)
      const xpNow = todayXpOf(store.getActivity(), today);
      if (n > 0 && xpNow >= m.dailyGoal && m.stats.goalBonusDay !== today) {
        m = addGems({ ...m, stats: { ...m.stats, goalBonusDay: today } }, GEMS.dailyGoal);
        const p = store.getProgress(topicId);
        store.setProgress(topicId, { ...p, xp: p.xp + XP.dailyGoalBonus });
        store.logActivity(XP.dailyGoalBonus, 0);
        emit({ type: "goal", xp: xpNow, goal: m.dailyGoal });
        emit({ type: "gem", delta: GEMS.dailyGoal, gems: m.gems });
        setTimeout(() => toast(`Cel dzienny zrobiony! +${XP.dailyGoalBonus} XP, +${GEMS.dailyGoal} klejnotów`, "gem"), 600);
      }
      if (m !== store.getMeta()) writeMeta(m);
      else {
        // xp alone can unlock xp_1000 etc.
        const checked = checkAchievements(m);
        if (checked !== m) store.setMeta(checked);
        bump();
      }
      const r = rankChanged(prevTotal, store.totalXp());
      if (r) {
        setLevelUps((q) => [...q, r]);
        emit({ type: "levelup", rank: r });
      }
    };

    const spend = (cost: number) => {
      if (!store) return false;
      const next = spendGemsPure(store.getMeta(), cost);
      if (!next) return false;
      writeMeta(next, false);
      emit({ type: "gem", delta: -cost, gems: next.gems });
      return true;
    };

    return {
      ready: !!store,
      user,
      session,
      authHeaders: (): Record<string, string> => (session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
      supabase,
      store,
      progressOf: (id) => store?.getProgress(id) ?? EMPTY,
      allProgress: () => store?.allProgress() ?? {},
      setProgress: (id, p) => {
        store?.setProgress(id, p);
        bump();
      },
      addXp,
      weak: store?.getWeak() ?? {},
      setWeak: (next, topicId) => {
        store?.setWeak(next, topicId);
        bump();
      },
      srsOf: (id) => store?.getSrs(id) ?? {},
      allSrs: () => store?.allSrs() ?? {},
      setSrs: (id, cards) => {
        store?.setSrs(id, cards);
        bump();
      },
      logActivity: (xp, minutes) => {
        store?.logActivity(xp, minutes);
        if (minutes > 0) applyQuest({ type: "minutes", n: minutes });
        bump();
      },
      meta,
      streak: streakDisplay(meta),
      totalXp,
      stage: store?.getStage() ?? null,
      setStage: (st) => {
        store?.setStage(st);
        bump();
      },
      plan,
      unlimitedHearts: unlimited,
      hearts,
      gems: meta.gems,
      dailyGoal: meta.dailyGoal,
      todayXp: tXp,
      goalPct: dailyGoalPct(tXp, meta.dailyGoal),
      goalMet: tXp >= meta.dailyGoal,
      activity,
      week: weekStrip(activity, today),
      quests: store?.getQuests() ?? [],
      questEvent: (ev) => {
        applyQuest(ev);
        bump();
      },
      claimQuest: (id) => {
        if (!store) return;
        const r = claimQuestPure(store.getQuests(), id);
        if (!r) return;
        store.setQuests(r.quests);
        let m = addGems(store.getMeta(), r.gems);
        m = { ...m, stats: { ...m.stats, questsDone: m.stats.questsDone + 1 } };
        writeMeta(m);
        emit({ type: "gem", delta: r.gems, gems: m.gems });
      },
      achievements,
      unlockedQueue,
      popUnlocked: () => setUnlocked((q) => q.slice(1)),
      levelUpQueue,
      popLevelUp: () => setLevelUps((q) => q.slice(1)),
      rank: rankFor(totalXp),
      soundOn: meta.soundOn,
      setSoundOn: (v) => {
        sfx.setEnabled(v);
        writeMeta({ ...meta, soundOn: v }, false);
      },
      setDailyGoal: (g) => writeMeta({ ...meta, dailyGoal: g }, false),
      showOnLeaderboard: store?.getShowOnLeaderboard() ?? true,
      setShowOnLeaderboard: (v) => {
        store?.setShowOnLeaderboard(v);
        bump();
      },
      displayName: store?.getDisplayName() ?? null,
      setDisplayName: (v) => {
        store?.setDisplayName(v);
        bump();
      },
      addGems: (n) => {
        if (!store || n <= 0) return;
        const m = addGems(store.getMeta(), n);
        writeMeta(m);
        emit({ type: "gem", delta: n, gems: m.gems });
      },
      spendGems: spend,
      refillHearts: () => {
        if (!store) return false;
        if (!spend(GEM_COSTS.heartRefill)) return false;
        const m = refillHeartsPure(store.getMeta());
        writeMeta(m, false);
        emit({ type: "heart", delta: 5, hearts: 5 });
        return true;
      },
      buyStreakFreeze: () => {
        if (!store) return false;
        if (store.getMeta().streakFreezes >= 5) return false;
        if (!spend(GEM_COSTS.streakFreeze)) return false;
        const m = store.getMeta();
        writeMeta({ ...m, streakFreezes: m.streakFreezes + 1 }, false);
        return true;
      },
      loseHeart: () => {
        if (!store) return hearts;
        const m = loseHeartPure(store.getMeta(), Date.now(), unlimited);
        writeMeta(m, false);
        const v = heartsNow(m, Date.now(), unlimited);
        emit({ type: "heart", delta: -1, hearts: v.hearts });
        return v;
      },
      gainHeart: () => {
        if (!store) return;
        const m = gainHeartPure(store.getMeta());
        writeMeta(m, false);
        emit({ type: "heart", delta: 1, hearts: m.hearts });
      },
      bumpStats: (patch) => {
        if (!store) return;
        const m = store.getMeta();
        const p = typeof patch === "function" ? patch(m.stats) : patch;
        writeMeta({ ...m, stats: { ...m.stats, ...p } });
      },
      openChest: (topicId, idx) => {
        if (!store) return 0;
        const r = openChestPure(store.getProgress(topicId), idx);
        if (!r) return 0;
        store.setProgress(topicId, r.progress);
        let m = addGems(store.getMeta(), r.gems);
        m = { ...m, stats: { ...m.stats, chestsOpened: m.stats.chestsOpened + 1 } };
        writeMeta(m);
        emit({ type: "gem", delta: r.gems, gems: m.gems });
        return r.gems;
      },
      claimTrophy: (topicId) => {
        if (!store) return 0;
        const r = claimTrophyPure(store.getProgress(topicId));
        if (!r) return 0;
        store.setProgress(topicId, r.progress);
        const m = addGems(store.getMeta(), r.gems);
        writeMeta(m);
        emit({ type: "gem", delta: r.gems, gems: m.gems });
        return r.gems;
      },
      fetchLeaderboard: (limit) => store?.fetchLeaderboard(limit) ?? Promise.resolve([]),
      myWeeklyRank: () => store?.myWeeklyRank() ?? Promise.resolve(null),
      on: (type, fn) => emitter.on(type, fn),
      toast,
      toasts,
      signOut: async () => {
        store?.flushActivity();
        await supabase.auth.signOut();
      },
      version,
    };
  }, [user, session, supabase, store, toasts, version, now, bump, toast, emitter, sfx, unlockedQueue, levelUpQueue]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}

/** Subscribe to a gamification event for the component's lifetime. */
export function useAppEvent<T extends AppEventType>(type: T, fn: (e: Extract<AppEvent, { type: T }>) => void) {
  const { on } = useApp();
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => on(type, (e) => ref.current(e)), [on, type]);
}
