import {
  GEMS,
  GEM_COSTS,
  XP,
  applyQuestEvent,
  buildDailySession,
  canStartLesson,
  claimQuest as claimQuestPure,
  claimTrophy as claimTrophyPure,
  dailyGoalPct,
  emptyMeta,
  emptyProgress,
  evaluateAchievements,
  gainHeart as gainHeartPure,
  heartsNow,
  loseHeart as loseHeartPure,
  normalizeHearts,
  openChest as openChestPure,
  questsForToday,
  rankChanged,
  rankFor,
  refillHearts as refillHeartsPure,
  spendGems as spendGemsPure,
  streakAtRisk,
  streakDisplay,
  todayStr,
  todayXp as todayXpOf,
  touchStreak,
  weekStrip,
  type Achievement,
  type DailyGoal,
  type DailySession,
  type HeartsView,
  type LeaderboardRow,
  type Plan,
  type Quest,
  type QuestEvent,
  type Rank,
  type Stage,
  type Subject,
  type SubjectProgress,
  type Topic,
  type UserMeta,
  type UserStats,
  type WeakMap,
} from "@nauka/shared";
import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState as RNAppState } from "react-native";
import { useAuth } from "./auth";
import { fetchTopic, fetchUserData, insertSubjects, readCache, writeCache, type SrsMap, type SubjectInput } from "./data";
import { Emitter, type AppEvent } from "./events";
import { play, setSfxEnabled } from "./sfx";
import { KEYS, setJson } from "./storage";
import { ProgressStore } from "./store/progress-store";
import { supabase } from "./supabase";

export interface AppState {
  /** dane załadowane (z sieci albo z cache) */
  ready: boolean;
  /** brak danych i brak sieci */
  offline: boolean;
  refreshing: boolean;
  refresh(): Promise<void>;
  store: ProgressStore | null;
  subjects: Subject[];
  topics: Topic[];
  topicsOf(subjectId: string): Topic[];
  findSubject(id: string): Subject | undefined;
  findTopic(id: string): Topic | undefined;
  /** temat: z pamięci, a gdy brak — z Supabase (np. świeżo wygenerowany) */
  getTopic(id: string): Promise<Topic | null>;
  registerTopic(t: Topic): void;
  createSubjects(inputs: SubjectInput[]): Promise<Subject[]>;
  updateSubject(id: string, patch: { examDate?: string | null; examLabel?: string | null; name?: string; emoji?: string }): Promise<void>;
  deleteSubject(id: string): Promise<void>;
  /* progress (per topic) */
  progress: Record<string, SubjectProgress>;
  progressFor(topicId: string): SubjectProgress;
  /** `gainedXp` — ile XP przybyło w tej zmianie (idzie przez lejek: questy → cel dzienny → ranga). */
  setProgressFor(topicId: string, p: SubjectProgress, gainedXp?: number): void;
  /** jeden lejek XP: progress → seria → quest xp → bonus celu dziennego (raz dziennie) → zmiana rangi → emit */
  addXp(topicId: string, n: number): void;
  srs: Record<string, SrsMap>;
  srsFor(topicId: string): SrsMap;
  setSrsFor(topicId: string, m: SrsMap): void;
  weak: WeakMap;
  setWeak(topicId: string, levelId: string, wrongIdx: number[], rightIdx: number[]): void;
  logActivity(xp: number, minutes: number): void;
  meta: UserMeta;
  streak: number;
  streakAtRisk: boolean;
  totalXp: number;
  stage: Stage | null;
  setStage(st: Stage): void;
  /** onboarding zrobiony = jest etap i ≥1 przedmiot */
  onboarded: boolean;
  daily: DailySession;
  /* gamifikacja v2 */
  plan: Plan;
  /** serca (regeneracja liczona co 30 s i po powrocie z tła); Pro = ∞ */
  hearts: HeartsView;
  canStartLesson: boolean;
  loseHeart(): void;
  gainHeart(): void;
  /** 150 💎 → pełne serca; false = za mało klejnotów */
  refillHearts(): boolean;
  buyStreakFreeze(): boolean;
  spendGems(cost: number): boolean;
  /** +n klejnotów (nagroda) — dźwięk `gem` + zdarzenie */
  addGems(n: number): void;
  gems: number;
  dailyGoal: DailyGoal;
  setDailyGoal(g: DailyGoal): void;
  todayXp: number;
  goalPct: number;
  goalMet: boolean;
  week: ReturnType<typeof weekStrip>;
  quests: Quest[];
  questEvent(ev: QuestEvent): void;
  claimQuest(id: string): void;
  achievements: Set<string>;
  /** kolejka świeżo odblokowanych odznak (overlay pokazuje po jednej) */
  unlockedQueue: Achievement[];
  popUnlocked(): void;
  /** kolejka awansów rangi */
  levelUpQueue: Rank[];
  popLevelUp(): void;
  rank: Rank;
  soundOn: boolean;
  setSoundOn(v: boolean): void;
  showOnLeaderboard: boolean;
  setShowOnLeaderboard(v: boolean): void;
  displayName: string | null;
  setDisplayName(name: string): void;
  bumpStats(patch: Partial<UserStats> | ((s: UserStats) => Partial<UserStats>)): void;
  openChest(topicId: string, chestIdx: number): number;
  claimTrophy(topicId: string): number;
  fetchLeaderboard(limit?: number): Promise<LeaderboardRow[]>;
  myWeeklyRank(): Promise<{ rank: number; xp: number; total: number } | null>;
  /** zdarzenia (dźwięki, maskotka, overlay) */
  on(fn: (e: AppEvent) => void): () => void;
  /* toast */
  toast: string | null;
  showToast(t: string): void;
  tick: number;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const [store, setStore] = useState<ProgressStore | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const [toast, setToast] = useState<string | null>(null);
  const [unlockedQueue, setUnlockedQueue] = useState<Achievement[]>([]);
  const [levelUpQueue, setLevelUpQueue] = useState<Rank[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitter = useRef(new Emitter()).current;
  const latest = useRef<{ subjects: Subject[]; topics: Topic[] }>({ subjects: [], topics: [] });
  useEffect(() => {
    latest.current = { subjects, topics };
  }, [subjects, topics]);

  const showToast = useCallback((t: string) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }, []);

  /* serca: ticker 30 s + powrót z tła */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    const sub = RNAppState.addEventListener("change", (st) => {
      if (st === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);

  /** snapshot całości do AsyncStorage — używany przez store po każdym zapisie */
  const attachSnapshot = useCallback((s: ProgressStore) => {
    s.snapshot = () => ({
      subjects: latest.current.subjects,
      topics: latest.current.topics,
      progress: s.progress,
      srs: s.srs,
      weak: s.weak,
      meta: s.meta,
      stage: s.stage,
      plan: s.plan,
      showOnLeaderboard: s.showOnLeaderboard,
      displayName: s.displayName,
      quests: s.quests,
      achievements: [...s.achievements],
      activity: s.activity,
    });
  }, []);

  const load = useCallback(
    async (uid: string, s: ProgressStore, silent: boolean) => {
      if (!supabase) return;
      if (!silent) setRefreshing(true);
      try {
        const d = await fetchUserData(supabase, uid);
        s.hydrate(d);
        setSubjects(d.subjects);
        setTopics(d.topics);
        latest.current = { subjects: d.subjects, topics: d.topics };
        setOffline(false);
        void writeCache(uid, d);
        if (d.stage) void setJson(KEYS.stage, d.stage);
      } catch (e) {
        console.warn("[app] load failed → cache", e);
        const c = await readCache(uid);
        if (c) {
          s.hydrate(c);
          setSubjects(c.subjects);
          setTopics(c.topics);
          latest.current = { subjects: c.subjects, topics: c.topics };
        }
        setOffline(true);
        showToast("Brak sieci — pokazuję zapisane dane");
      } finally {
        setSfxEnabled(s.meta.soundOn);
        setRefreshing(false);
        bump();
      }
    },
    [bump, showToast],
  );

  /* ---------- store per user ---------- */
  useEffect(() => {
    if (auth.loading) return;
    let alive = true;
    (async () => {
      setReady(false);
      if (!userId || !supabase) {
        setStore(null);
        setSubjects([]);
        setTopics([]);
        setReady(true);
        return;
      }
      const s = new ProgressStore(supabase, userId);
      attachSnapshot(s);
      // najpierw cache (natychmiast), potem sieć
      const c = await readCache(userId);
      if (c && alive) {
        s.hydrate(c);
        setSubjects(c.subjects);
        setTopics(c.topics);
        latest.current = { subjects: c.subjects, topics: c.topics };
        setStore(s);
        setReady(true);
      }
      await load(userId, s, !!c);
      if (!alive) return;
      setStore(s);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [userId, auth.loading, load, attachSnapshot]);

  const refresh = useCallback(async () => {
    if (userId && store) await load(userId, store, false);
  }, [userId, store, load]);

  /* ---------- subjects / topics ---------- */
  const topicsOf = useCallback((subjectId: string) => topics.filter((t) => t.subjectId === subjectId), [topics]);
  const findSubject = useCallback((id: string) => subjects.find((s) => s.id === id), [subjects]);
  const findTopic = useCallback((id: string) => topics.find((t) => t.id === id), [topics]);

  /* ---------- meta helpers (mutable store + tick) ---------- */
  const emit = useCallback((e: AppEvent) => emitter.emit(e), [emitter]);

  /** odznaki: po każdej zmianie liczników / XP / serii */
  const checkAchievements = useCallback(
    (s: ProgressStore) => {
      const fresh = evaluateAchievements({ meta: s.meta, topicsCount: latest.current.topics.length, totalXp: s.totalXp(), streak: streakDisplay(s.meta) }, s.achievements);
      if (!fresh.length) return;
      s.addAchievements(fresh.map((a) => a.key));
      const gems = fresh.reduce((a, x) => a + x.gems, 0);
      if (gems) s.setMeta({ ...s.meta, gems: s.meta.gems + gems });
      setUnlockedQueue((q) => [...q, ...fresh]);
      for (const a of fresh) emit({ type: "achievement", achievement: a });
    },
    [emit],
  );

  const registerTopic = useCallback(
    (t: Topic) => {
      setTopics((cur) => {
        const next = cur.some((x) => x.id === t.id) ? cur.map((x) => (x.id === t.id ? t : x)) : [...cur, t];
        latest.current = { ...latest.current, topics: next };
        if (store?.snapshot && userId) void writeCache(userId, store.snapshot());
        return next;
      });
      if (store) setTimeout(() => checkAchievements(store), 0);
    },
    [store, userId, checkAchievements],
  );

  const getTopic = useCallback(
    async (id: string) => {
      const local = findTopic(id);
      if (local) return local;
      if (!supabase) return null;
      try {
        const t = await fetchTopic(supabase, id);
        if (t) registerTopic(t);
        return t;
      } catch {
        return null;
      }
    },
    [findTopic, registerTopic],
  );

  const createSubjects = useCallback(
    async (inputs: SubjectInput[]) => {
      if (!supabase || !userId) throw new Error("Zaloguj się.");
      const created = await insertSubjects(supabase, userId, inputs, subjects.length);
      setSubjects((cur) => {
        const next = [...cur, ...created];
        latest.current = { ...latest.current, subjects: next };
        return next;
      });
      bump();
      return created;
    },
    [subjects.length, userId, bump],
  );

  const updateSubject = useCallback(async (id: string, patch: { examDate?: string | null; examLabel?: string | null; name?: string; emoji?: string }) => {
    if (!supabase) return;
    const row: Record<string, unknown> = {};
    if ("examDate" in patch) row.exam_date = patch.examDate ?? null;
    if ("examLabel" in patch) row.exam_label = patch.examLabel ?? null;
    if (patch.name) row.name = patch.name;
    if (patch.emoji) row.emoji = patch.emoji;
    setSubjects((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from("subjects").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  }, []);

  const deleteSubject = useCallback(
    async (id: string) => {
      if (!supabase) return;
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setSubjects((cur) => cur.filter((s) => s.id !== id));
      setTopics((cur) => cur.filter((t) => t.subjectId !== id));
      bump();
    },
    [bump],
  );

  /* ---------- questy ---------- */
  const questsNow = useCallback((s: ProgressStore) => questsForToday(s.quests, userId ?? "anon", todayStr()), [userId]);

  const questEvent = useCallback(
    (ev: QuestEvent) => {
      if (!store) return;
      const before = questsNow(store);
      const after = applyQuestEvent(before, ev);
      if (after === before || after.every((q, i) => q.progress === before[i]?.progress && q.done === before[i]?.done)) {
        if (store.quests !== before) store.setQuests(after);
        return;
      }
      store.setQuests(after);
      const newlyDone = after.filter((q, i) => q.done && !before[i]?.done);
      if (newlyDone.length) setTimeout(() => showToast(`Misja ukończona: ${newlyDone[0]!.title}`), 600);
      bump();
    },
    [store, questsNow, showToast, bump],
  );

  const claimQuest = useCallback(
    (id: string) => {
      if (!store) return;
      const r = claimQuestPure(questsNow(store), id);
      if (!r) return;
      store.setQuests(r.quests);
      const m = store.meta;
      store.setMeta({ ...m, gems: m.gems + r.gems, stats: { ...m.stats, questsDone: m.stats.questsDone + 1 } });
      emit({ type: "gem", delta: r.gems, gems: m.gems + r.gems });
      play("gem");
      haptic.ok();
      checkAchievements(store);
      bump();
    },
    [store, questsNow, emit, checkAchievements, bump],
  );

  /* ---------- streak ---------- */
  const touch = useCallback(
    (s: ProgressStore) => {
      const { meta, extended, usedFreeze } = touchStreak(s.getMeta());
      if (extended) {
        s.setMeta(meta);
        emit({ type: "streak", days: meta.streak, usedFreeze });
        if (meta.streak > 1) {
          setTimeout(() => {
            play("streak");
            showToast(usedFreeze ? `Zamrożenie uratowało serię: ${meta.streak} dni` : `Seria ${meta.streak} dni z rzędu!`);
          }, 1200);
        }
      }
    },
    [emit, showToast],
  );

  /* ---------- XP funnel ---------- */
  const afterXp = useCallback(
    (s: ProgressStore, topicId: string, n: number, prevTotal: number) => {
      if (n <= 0) return;
      const day = todayStr();
      s.addTodayXp(n, day);
      touch(s);
      // quest: xp
      const q1 = applyQuestEvent(questsNow(s), { type: "xp", amount: n });
      s.setQuests(q1);
      // cel dzienny — bonus raz dziennie
      let m = s.meta;
      const goal = m.dailyGoal;
      const today = todayXpOf(s.activity, day);
      if (today >= goal && m.stats.goalBonusDay !== day) {
        m = { ...m, gems: m.gems + GEMS.dailyGoal, stats: { ...m.stats, goalBonusDay: day } };
        const p = s.getProgress(topicId);
        s.setProgress(topicId, { ...p, xp: p.xp + XP.dailyGoalBonus });
        s.addTodayXp(XP.dailyGoalBonus, day);
        emit({ type: "goal", xp: today });
        setTimeout(() => {
          play("levelup");
          showToast(`Cel dzienny zrobiony! +${XP.dailyGoalBonus} XP i +${GEMS.dailyGoal} klejnotów`);
        }, 900);
      }
      // nocny marek / ranny ptaszek
      const h = new Date().getHours();
      if (h >= 23 && !m.stats.nightOwl) m = { ...m, stats: { ...m.stats, nightOwl: true } };
      if (h < 7 && !m.stats.earlyBird) m = { ...m, stats: { ...m.stats, earlyBird: true } };
      if (m !== s.meta) s.setMeta(m);
      // ranga
      const r = rankChanged(prevTotal, s.totalXp());
      if (r) {
        setLevelUpQueue((q) => [...q, r]);
        emit({ type: "levelup", rank: r });
      }
      emit({ type: "xp", amount: n, topicId });
      checkAchievements(s);
    },
    [touch, questsNow, emit, showToast, checkAchievements],
  );

  const progressFor = useCallback((id: string) => store?.getProgress(id) ?? emptyProgress(), [store]);
  const setProgressFor = useCallback(
    (id: string, p: SubjectProgress, gainedXp?: number) => {
      if (!store) return;
      const prevTotal = store.totalXp();
      store.setProgress(id, p);
      if (gainedXp && gainedXp > 0) afterXp(store, id, gainedXp, prevTotal);
      else touch(store);
      bump();
    },
    [store, afterXp, touch, bump],
  );
  const addXp = useCallback(
    (id: string, n: number) => {
      if (!store || n <= 0) return;
      const prevTotal = store.totalXp();
      const p = store.getProgress(id);
      store.setProgress(id, { ...p, xp: p.xp + n });
      afterXp(store, id, n, prevTotal);
      bump();
    },
    [store, afterXp, bump],
  );
  const srsFor = useCallback((id: string) => store?.getSrs(id) ?? {}, [store]);
  const setSrsFor = useCallback(
    (id: string, m: SrsMap) => {
      store?.setSrs(id, m);
      bump();
    },
    [store, bump],
  );
  const setWeak = useCallback(
    (topicId: string, levelId: string, wrong: number[], right: number[]) => {
      store?.setWeak(topicId, levelId, wrong, right);
      bump();
    },
    [store, bump],
  );
  const logActivity = useCallback(
    (xp: number, minutes: number) => {
      if (!store) return;
      store.logActivity(xp, minutes);
      if (minutes > 0) questEvent({ type: "minutes", n: minutes });
      bump();
    },
    [store, questEvent, bump],
  );
  const setStage = useCallback(
    (st: Stage) => {
      store?.setStage(st);
      void setJson(KEYS.stage, st);
      bump();
    },
    [store, bump],
  );

  /* ---------- serca / klejnoty ---------- */
  const unlimited = (store?.plan ?? "free") === "pro";
  const loseHeart = useCallback(() => {
    if (!store) return;
    const m = loseHeartPure(store.meta, Date.now(), unlimited);
    if (m === store.meta) return;
    store.setMeta(m);
    emit({ type: "heart", delta: -1, hearts: m.hearts });
    bump();
  }, [store, unlimited, emit, bump]);
  const gainHeart = useCallback(() => {
    if (!store) return;
    const m = gainHeartPure(store.meta);
    store.setMeta(m);
    emit({ type: "heart", delta: 1, hearts: m.hearts });
    bump();
  }, [store, emit, bump]);
  const spendGems = useCallback(
    (cost: number) => {
      if (!store) return false;
      const m = spendGemsPure(store.meta, cost);
      if (!m) {
        showToast("Za mało klejnotów");
        return false;
      }
      store.setMeta(m);
      emit({ type: "gem", delta: -cost, gems: m.gems });
      bump();
      return true;
    },
    [store, emit, showToast, bump],
  );
  const addGems = useCallback(
    (n: number) => {
      if (!store || n <= 0) return;
      const m = { ...store.meta, gems: store.meta.gems + n };
      store.setMeta(m);
      play("gem");
      emit({ type: "gem", delta: n, gems: m.gems });
      bump();
    },
    [store, emit, bump],
  );
  const refillHearts = useCallback(() => {
    if (!store) return false;
    const m = spendGemsPure(store.meta, GEM_COSTS.heartRefill);
    if (!m) {
      showToast("Za mało klejnotów");
      return false;
    }
    const r = refillHeartsPure(m);
    store.setMeta(r);
    play("gem");
    emit({ type: "gem", delta: -GEM_COSTS.heartRefill, gems: r.gems });
    emit({ type: "heart", delta: 5, hearts: r.hearts });
    showToast("Serca pełne!");
    bump();
    return true;
  }, [store, emit, showToast, bump]);
  const buyStreakFreeze = useCallback(() => {
    if (!store) return false;
    if (store.meta.streakFreezes >= 2) {
      showToast("Masz już maksimum zamrożeń (2)");
      return false;
    }
    const m = spendGemsPure(store.meta, GEM_COSTS.streakFreeze);
    if (!m) {
      showToast("Za mało klejnotów");
      return false;
    }
    store.setMeta({ ...m, streakFreezes: m.streakFreezes + 1 });
    play("gem");
    emit({ type: "gem", delta: -GEM_COSTS.streakFreeze, gems: m.gems });
    showToast("Zamrożenie serii kupione");
    bump();
    return true;
  }, [store, emit, showToast, bump]);

  const setDailyGoal = useCallback(
    (g: DailyGoal) => {
      if (!store) return;
      store.setMeta({ ...store.meta, dailyGoal: g });
      bump();
    },
    [store, bump],
  );
  const setSoundOn = useCallback(
    (v: boolean) => {
      if (!store) return;
      setSfxEnabled(v);
      store.setMeta({ ...store.meta, soundOn: v });
      bump();
    },
    [store, bump],
  );
  const setShowOnLeaderboard = useCallback(
    (v: boolean) => {
      store?.setShowOnLeaderboard(v);
      bump();
    },
    [store, bump],
  );
  const setDisplayName = useCallback(
    (name: string) => {
      store?.setDisplayName(name.trim() || null);
      bump();
    },
    [store, bump],
  );
  const bumpStats = useCallback(
    (patch: Partial<UserStats> | ((s: UserStats) => Partial<UserStats>)) => {
      if (!store) return;
      const cur = store.meta.stats;
      const p = typeof patch === "function" ? patch(cur) : patch;
      store.setMeta({ ...store.meta, stats: { ...cur, ...p } });
      checkAchievements(store);
      bump();
    },
    [store, checkAchievements, bump],
  );

  /* ---------- skrzynki / trofeum ---------- */
  const openChest = useCallback(
    (topicId: string, chestIdx: number) => {
      if (!store) return 0;
      const r = openChestPure(store.getProgress(topicId), chestIdx);
      if (!r) return 0;
      store.setProgress(topicId, r.progress);
      const m = store.meta;
      store.setMeta({ ...m, gems: m.gems + r.gems, stats: { ...m.stats, chestsOpened: m.stats.chestsOpened + 1 } });
      play("chest");
      haptic.heavy();
      emit({ type: "gem", delta: r.gems, gems: m.gems + r.gems });
      checkAchievements(store);
      bump();
      return r.gems;
    },
    [store, emit, checkAchievements, bump],
  );
  const claimTrophy = useCallback(
    (topicId: string) => {
      if (!store) return 0;
      const r = claimTrophyPure(store.getProgress(topicId));
      if (!r) return 0;
      store.setProgress(topicId, r.progress);
      const m = store.meta;
      store.setMeta({ ...m, gems: m.gems + r.gems });
      play("levelup");
      haptic.heavy();
      emit({ type: "gem", delta: r.gems, gems: m.gems + r.gems });
      bump();
      return r.gems;
    },
    [store, emit, bump],
  );

  const fetchLeaderboard = useCallback((limit = 50) => (store ? store.fetchLeaderboard(limit) : Promise.resolve([])), [store]);
  const myWeeklyRank = useCallback(() => (store ? store.myWeeklyRank() : Promise.resolve(null)), [store]);
  const popUnlocked = useCallback(() => setUnlockedQueue((q) => q.slice(1)), []);
  const popLevelUp = useCallback(() => setLevelUpQueue((q) => q.slice(1)), []);
  const on = useCallback((fn: (e: AppEvent) => void) => emitter.on(fn), [emitter]);

  /* eslint-disable react-hooks/exhaustive-deps -- `tick` wymusza odczyt po zapisach w mutowalnym store */
  const meta = useMemo(() => (store ? normalizeHearts(store.getMeta(), now) : emptyMeta()), [store, tick, now]);
  const totalXp = useMemo(() => store?.totalXp() ?? 0, [store, tick]);
  const stage = useMemo(() => store?.stage ?? null, [store, tick]);
  const progress = useMemo(() => store?.progress ?? {}, [store, tick]);
  const srs = useMemo(() => store?.srs ?? {}, [store, tick]);
  const weak = useMemo(() => store?.weak ?? {}, [store, tick]);
  const plan = useMemo<Plan>(() => store?.plan ?? "free", [store, tick]);
  const quests = useMemo(() => (store ? questsNow(store) : []), [store, tick, questsNow]);
  const achievements = useMemo(() => store?.achievements ?? new Set<string>(), [store, tick]);
  const activity = useMemo(() => store?.activity ?? {}, [store, tick]);
  const showOnLeaderboard = useMemo(() => store?.showOnLeaderboard ?? true, [store, tick]);
  const displayName = useMemo(() => store?.displayName ?? null, [store, tick]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const hearts = useMemo(() => heartsNow(meta, now, plan === "pro"), [meta, now, plan]);
  const daily = useMemo(() => buildDailySession(topics, progress, srs, weak), [topics, progress, srs, weak]);
  const week = useMemo(() => weekStrip(activity), [activity]);
  const todayXp = useMemo(() => todayXpOf(activity), [activity]);
  const rank = useMemo(() => rankFor(totalXp), [totalXp]);
  const onboarded = !!stage && subjects.length > 0;

  const value = useMemo<AppState>(
    () => ({
      ready, offline, refreshing, refresh, store, subjects, topics, topicsOf, findSubject, findTopic, getTopic, registerTopic, createSubjects, updateSubject, deleteSubject,
      progress, progressFor, setProgressFor, addXp, srs, srsFor, setSrsFor, weak, setWeak, logActivity,
      meta, streak: streakDisplay(meta), streakAtRisk: streakAtRisk(meta), totalXp, stage, setStage, onboarded, daily,
      plan, hearts, canStartLesson: canStartLesson(meta, plan === "pro", now), loseHeart, gainHeart, refillHearts, buyStreakFreeze, spendGems, addGems,
      gems: meta.gems, dailyGoal: meta.dailyGoal, setDailyGoal, todayXp, goalPct: dailyGoalPct(todayXp, meta.dailyGoal), goalMet: todayXp >= meta.dailyGoal, week,
      quests, questEvent, claimQuest, achievements, unlockedQueue, popUnlocked, levelUpQueue, popLevelUp, rank,
      soundOn: meta.soundOn, setSoundOn, showOnLeaderboard, setShowOnLeaderboard, displayName, setDisplayName, bumpStats, openChest, claimTrophy, fetchLeaderboard, myWeeklyRank, on,
      toast, showToast, tick,
    }),
    [
      ready, offline, refreshing, refresh, store, subjects, topics, topicsOf, findSubject, findTopic, getTopic, registerTopic, createSubjects, updateSubject, deleteSubject,
      progress, progressFor, setProgressFor, addXp, srs, srsFor, setSrsFor, weak, setWeak, logActivity, meta, totalXp, stage, setStage, onboarded, daily,
      plan, hearts, now, loseHeart, gainHeart, refillHearts, buyStreakFreeze, spendGems, addGems, setDailyGoal, todayXp, week, quests, questEvent, claimQuest, achievements, unlockedQueue, popUnlocked,
      levelUpQueue, popLevelUp, rank, setSoundOn, showOnLeaderboard, setShowOnLeaderboard, displayName, setDisplayName, bumpStats, openChest, claimTrophy, fetchLeaderboard, myWeeklyRank, on, toast, showToast, tick,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp poza AppProvider");
  return v;
}

/** Haptyka bez wywalania się na webie/emulatorze. */
export const haptic = {
  ok: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  bad: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
};
