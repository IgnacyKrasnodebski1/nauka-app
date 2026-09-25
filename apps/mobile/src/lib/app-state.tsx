import {
  BOOST_MS,
  FREEZE_MAX,
  GEMS,
  GEM_COSTS,
  THEMES,
  XP,
  albumCheck,
  albumKey,
  applyBoost,
  applyQuestEvent,
  boostActive as boostActivePure,
  buildDailySession,
  canStartLesson,
  claimQuest as claimQuestPure,
  claimTrophy as claimTrophyPure,
  dailyGoalPct,
  dayDiff,
  emptyMeta,
  emptyProgress,
  evaluateAchievements,
  gainHeart as gainHeartPure,
  heartsNow,
  isDue,
  levelProgress,
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
  weeklyQuestFor,
  type Achievement,
  type AlbumMap,
  type BossRecord,
  type DailyGoal,
  type DailySession,
  type GhostRecord,
  type HeartsView,
  type LeaderboardRow,
  type Plan,
  type Quest,
  type QuestEvent,
  type QuizQuestion,
  type Rank,
  type SrsCard,
  type Stage,
  type Subject,
  type SubjectProgress,
  type Topic,
  type UserMeta,
  type UserStats,
  type WeakMap,
} from "@nauka/shared";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState as RNAppState } from "react-native";
import { useAuth } from "./auth";
import { fetchTopic, fetchUserData, insertSubjects, readCache, writeCache, type SrsMap, type SubjectInput } from "./data";
import { Emitter, type AppEvent } from "./events";
import { emptyHist, hideKey, ovKey, type ExamEntry, type ExamRec, type Extra, type Goal, type HistDay, type Reminder } from "./extra";
import { haptic } from "./haptic";
import { setUserReduceMotion } from "./motion";
import { buildDailyTasks, ensureDaily, taskInfo, type PlanInfo, type PlanKind } from "./plan";
import { play, setSfxEnabled } from "./sfx";
import { KEYS, setJson } from "./storage";
import { ProgressStore } from "./store/progress-store";
import { supabase } from "./supabase";
import { createTest as createTestPure, syncTests, testDone as testDonePure, type PlanKind as TestKind, type TestPlan } from "./tests";

export { haptic };


export interface AppState {
  ready: boolean;
  offline: boolean;
  refreshing: boolean;
  refresh(): Promise<void>;
  store: ProgressStore | null;
  userId: string | null;
  subjects: Subject[];
  topics: Topic[];
  topicsOf(subjectId: string): Topic[];
  findSubject(id: string): Subject | undefined;
  findTopic(id: string): Topic | undefined;
  getTopic(id: string): Promise<Topic | null>;
  registerTopic(t: Topic): void;
  createSubjects(inputs: SubjectInput[]): Promise<Subject[]>;
  updateSubject(id: string, patch: { examDate?: string | null; examLabel?: string | null; name?: string; emoji?: string; accent2?: string; accent?: string }): Promise<void>;
  deleteSubject(id: string): Promise<void>;
  /* progress */
  progress: Record<string, SubjectProgress>;
  progressFor(topicId: string): SubjectProgress;
  setProgressFor(topicId: string, p: SubjectProgress, gainedXp?: number): void;
  /** jedyny lejek XP (tu `applyBoost`): progress → seria → misje → cel dzienny → ranga */
  addXp(topicId: string, n: number): number;
  srs: Record<string, SrsMap>;
  srsFor(topicId: string): SrsMap;
  setSrsFor(topicId: string, m: SrsMap): void;
  /** zapis powtórki fiszki + album (po `review()`); zwraca nową kartę i ewentualny wpis do albumu */
  reviewCard(topicId: string, levelId: string, cardIndex: number, key: string, card: SrsCard, term: string): { added: boolean };
  weak: WeakMap;
  setWeak(topicId: string, levelId: string, wrongIdx: number[], rightIdx: number[]): void;
  logActivity(xp: number, minutes: number): void;
  meta: UserMeta;
  streak: number;
  streakAtRisk: boolean;
  totalXp: number;
  stage: Stage | null;
  setStage(st: Stage): void;
  onboarded: boolean;
  daily: DailySession;
  /* gamifikacja */
  plan: Plan;
  hearts: HeartsView;
  canStartLesson: boolean;
  loseHeart(): void;
  gainHeart(n?: number): void;
  refillHearts(): boolean;
  buyStreakFreeze(): boolean;
  spendGems(cost: number): boolean;
  addGems(n: number): void;
  gems: number;
  dailyGoal: DailyGoal;
  setDailyGoal(g: DailyGoal): void;
  todayXp: number;
  goalPct: number;
  goalMet: boolean;
  week: ReturnType<typeof weekStrip>;
  quests: Quest[];
  weeklyQuest: Quest;
  questEvent(ev: QuestEvent): void;
  claimQuest(id: string): void;
  achievements: Set<string>;
  unlockedQueue: Achievement[];
  popUnlocked(): void;
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
  on(fn: (e: AppEvent) => void): () => void;
  /* 2.0 */
  extra: Extra;
  setGoal(g: Goal | null): void;
  setReminder(r: Reminder): void;
  reduceMotion: boolean;
  setReduceMotion(v: boolean): void;
  boostActive: boolean;
  buyBoost(): boolean;
  buyTheme(): boolean;
  setTheme(id: string): void;
  setOverride(topicId: string, levelId: string, qi: number, q: QuizQuestion | null): void;
  hideLevel(topicId: string, levelId: string, hidden: boolean): void;
  album: AlbumMap;
  tests: TestPlan[];
  testFor(subjectId: string): TestPlan | null;
  createTestPlan(subjectId: string, date: string, levels: string[]): TestPlan;
  removeTestPlan(id: string): void;
  markTestDone(subjectId: string, kind: TestKind): void;
  /** plan dnia (Main): wiersze z etykietami */
  planItems: PlanInfo[];
  completeDaily(subjectId: string, kind: PlanKind, levelId?: string): boolean;
  tickDaily(subjectId: string, kind: PlanKind, n?: number): void;
  histAdd(key: keyof HistDay, n?: number): void;
  histMax(key: keyof HistDay, n: number): void;
  setBoss(topicId: string, rec: BossRecord): void;
  setGhost(topicId: string, levelId: string, rec: GhostRecord): void;
  /** rekord egzaminu tematu (user_meta.exams) */
  examRec(topicId: string): ExamRec;
  /** zapis podejścia: n/passed/last/best (+ stats.examsPassed, bestExamPct) */
  recordExam(topicId: string, entry: ExamEntry, passed: boolean): void;
  /** ile fiszek/pytań SRS czeka dziś w przedmiocie */
  dueCount(subjectId?: string): number;
  /* toast */
  toast: string | null;
  toastIcon: string | null;
  showToast(t: string, icon?: string): void;
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
  const [toastIcon, setToastIcon] = useState<string | null>(null);
  const [unlockedQueue, setUnlockedQueue] = useState<Achievement[]>([]);
  const [levelUpQueue, setLevelUpQueue] = useState<Rank[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitter = useRef(new Emitter()).current;
  const latest = useRef<{ subjects: Subject[]; topics: Topic[] }>({ subjects: [], topics: [] });
  useEffect(() => {
    latest.current = { subjects, topics };
  }, [subjects, topics]);

  const showToast = useCallback((t: string, icon?: string) => {
    setToast(t);
    setToastIcon(icon ?? null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  }, []);

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
      extra: s.extra,
    });
  }, []);

  const applyPrefs = useCallback((s: ProgressStore) => {
    setSfxEnabled(s.meta.soundOn);
    setUserReduceMotion(s.extra.reduceMotion);
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
        showToast("Brak sieci — pokazuję zapisane dane", "wifi");
      } finally {
        applyPrefs(s);
        setRefreshing(false);
        bump();
      }
    },
    [bump, showToast, applyPrefs],
  );

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
      const c = await readCache(userId);
      if (c && alive) {
        s.hydrate(c);
        setSubjects(c.subjects);
        setTopics(c.topics);
        latest.current = { subjects: c.subjects, topics: c.topics };
        applyPrefs(s);
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
  }, [userId, auth.loading, load, attachSnapshot, applyPrefs]);

  const refresh = useCallback(async () => {
    if (userId && store) await load(userId, store, false);
  }, [userId, store, load]);

  const topicsOf = useCallback((subjectId: string) => topics.filter((t) => t.subjectId === subjectId), [topics]);
  const findSubject = useCallback((id: string) => subjects.find((s) => s.id === id), [subjects]);
  const findTopic = useCallback((id: string) => topics.find((t) => t.id === id), [topics]);
  const emit = useCallback((e: AppEvent) => emitter.emit(e), [emitter]);

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

  const updateSubject = useCallback(async (id: string, patch: { examDate?: string | null; examLabel?: string | null; name?: string; emoji?: string; accent2?: string; accent?: string }) => {
    if (!supabase) return;
    const row: Record<string, unknown> = {};
    if ("examDate" in patch) row.exam_date = patch.examDate ?? null;
    if ("examLabel" in patch) row.exam_label = patch.examLabel ?? null;
    if (patch.name) row.name = patch.name;
    if (patch.emoji) row.emoji = patch.emoji;
    if (patch.accent2) row.accent2 = patch.accent2;
    if (patch.accent) row.accent = patch.accent;
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

  /* ---------- extra helpers ---------- */
  const setExtra = useCallback(
    (patch: Partial<Extra>) => {
      if (!store) return;
      store.setExtra(patch);
      bump();
    },
    [store, bump],
  );
  const histAdd = useCallback(
    (key: keyof HistDay, n = 1) => {
      if (!store) return;
      const d = todayStr();
      const H = { ...store.extra.history };
      const h = { ...(H[d] ?? emptyHist()) };
      h[key] = (h[key] | 0) + n;
      H[d] = h;
      const ks = Object.keys(H).sort();
      if (ks.length > 120) for (const k of ks.slice(0, ks.length - 120)) delete H[k];
      store.setExtra({ history: H });
    },
    [store],
  );
  const histMax = useCallback(
    (key: keyof HistDay, n: number) => {
      if (!store) return;
      const d = todayStr();
      const h = store.extra.history[d] ?? emptyHist();
      if (n > (h[key] | 0)) store.setExtra({ history: { ...store.extra.history, [d]: { ...h, [key]: n } } });
    },
    [store],
  );

  /* ---------- questy (dzienne + tygodniowa) ---------- */
  const questsNow = useCallback((s: ProgressStore) => questsForToday(s.quests, userId ?? "anon", todayStr(), s.meta.dailyGoal), [userId]);
  const weeklyNow = useCallback((s: ProgressStore) => weeklyQuestFor(s.extra.weekly, userId ?? "anon", todayStr()), [userId]);

  const applyQuests = useCallback(
    (s: ProgressStore, ev: QuestEvent, quiet = false) => {
      const daily = questsNow(s);
      const weekly = weeklyNow(s);
      const after = applyQuestEvent([...daily, weekly], ev);
      const dailyAfter = after.filter((q) => !q.id.startsWith("w:"));
      const weeklyAfter = after.find((q) => q.id.startsWith("w:")) ?? weekly;
      const changed = after.some((q, i) => q.progress !== [...daily, weekly][i]?.progress || q.done !== [...daily, weekly][i]?.done);
      if (s.quests !== daily || changed) s.setQuests(dailyAfter);
      if (s.extra.weekly !== weekly || changed) s.setExtra({ weekly: weeklyAfter });
      if (!changed) return;
      const before = [...daily, weekly];
      const newlyDone = after.filter((q, i) => q.done && !before[i]?.done);
      if (newlyDone.length && !quiet) setTimeout(() => showToast("Misja gotowa — odbierz nagrodę", "star"), 2400);
    },
    [questsNow, weeklyNow, showToast],
  );

  const questEvent = useCallback(
    (ev: QuestEvent) => {
      if (!store) return;
      applyQuests(store, ev);
      bump();
    },
    [store, applyQuests, bump],
  );

  const claimQuest = useCallback(
    (id: string) => {
      if (!store) return;
      const weekly = weeklyNow(store);
      const list = [...questsNow(store), weekly];
      const r = claimQuestPure(list, id);
      if (!r) return;
      store.setQuests(r.quests.filter((q) => !q.id.startsWith("w:")));
      store.setExtra({ weekly: r.quests.find((q) => q.id.startsWith("w:")) ?? weekly });
      const m = store.meta;
      store.setMeta({ ...m, gems: m.gems + r.gems, stats: { ...m.stats, questsDone: m.stats.questsDone + 1 } });
      histAdd("missions", 1);
      emit({ type: "gem", delta: r.gems, gems: m.gems + r.gems });
      play("gem");
      haptic.ok();
      showToast(`+${r.gems} gemów · misja`, "gem");
      checkAchievements(store);
      bump();
    },
    [store, questsNow, weeklyNow, emit, checkAchievements, bump, histAdd, showToast],
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
            showToast(usedFreeze ? `Zamrożenie uratowało serię: ${meta.streak} dni` : `Seria: ${meta.streak} dni z rzędu`, "flame");
          }, 1600);
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
      applyQuests(s, { type: "xp", amount: n });
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
          showToast(`Cel dzienny zrobiony: +${XP.dailyGoalBonus} XP i +${GEMS.dailyGoal} gemów`, "bolt");
        }, 900);
      }
      const h = new Date().getHours();
      if (h >= 23 && !m.stats.nightOwl) m = { ...m, stats: { ...m.stats, nightOwl: true } };
      if (h < 7 && !m.stats.earlyBird) m = { ...m, stats: { ...m.stats, earlyBird: true } };
      if (m !== s.meta) s.setMeta(m);
      const r = rankChanged(prevTotal, s.totalXp());
      if (r) {
        setLevelUpQueue((q) => [...q, r]);
        emit({ type: "levelup", rank: r });
      }
      emit({ type: "xp", amount: n, topicId });
      checkAchievements(s);
    },
    [touch, applyQuests, emit, showToast, checkAchievements],
  );

  const progressFor = useCallback((id: string) => store?.getProgress(id) ?? emptyProgress(), [store]);
  const setProgressFor = useCallback(
    (id: string, p: SubjectProgress, gainedXp?: number) => {
      if (!store) return;
      const prevTotal = store.totalXp();
      const boosted = gainedXp && gainedXp > 0 ? applyBoost(gainedXp, store.extra.boostUntil) : 0;
      const extraXp = boosted - (gainedXp ?? 0);
      store.setProgress(id, extraXp > 0 ? { ...p, xp: p.xp + extraXp } : p);
      if (boosted > 0) afterXp(store, id, boosted, prevTotal);
      else touch(store);
      bump();
    },
    [store, afterXp, touch, bump],
  );
  const addXp = useCallback(
    (id: string, n: number) => {
      if (!store || n === 0) return 0;
      const prevTotal = store.totalXp();
      const p = store.getProgress(id);
      const amount = n > 0 ? applyBoost(n, store.extra.boostUntil) : n;
      store.setProgress(id, { ...p, xp: Math.max(0, p.xp + amount) });
      if (amount > 0) afterXp(store, id, amount, prevTotal);
      bump();
      return amount;
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
  const reviewCard = useCallback(
    (topicId: string, levelId: string, cardIndex: number, key: string, card: SrsCard, term: string) => {
      if (!store) return { added: false };
      store.setSrs(topicId, { ...store.getSrs(topicId), [key]: card });
      histAdd("reviews", 1);
      const lp = levelProgress(store.getProgress(topicId), levelId);
      const r = albumCheck(store.extra.album, albumKey(topicId, levelId, cardIndex), card, lp, todayStr());
      if (r.added) {
        store.setExtra({ album: r.album });
        store.setMeta({ ...store.meta, stats: { ...store.meta.stats, albumCount: Object.keys(r.album).length } });
        histAdd("cards", 1);
        setTimeout(() => showToast("Do albumu: " + term, "cards"), 1000);
        checkAchievements(store);
      }
      bump();
      return { added: !!r.added };
    },
    [store, bump, histAdd, showToast, checkAchievements],
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
      if (minutes > 0) applyQuests(store, { type: "minutes", n: minutes });
      bump();
    },
    [store, applyQuests, bump],
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
  const gainHeart = useCallback(
    (n = 1) => {
      if (!store) return;
      let m = store.meta;
      for (let i = 0; i < n; i++) m = gainHeartPure(m);
      store.setMeta(m);
      emit({ type: "heart", delta: n, hearts: m.hearts });
      bump();
    },
    [store, emit, bump],
  );
  const spendGems = useCallback(
    (cost: number) => {
      if (!store) return false;
      const m = spendGemsPure(store.meta, cost);
      if (!m) {
        showToast(`Brakuje ${cost - store.meta.gems} gemów`, "gem");
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
      showToast(`Brakuje ${GEM_COSTS.heartRefill - store.meta.gems} gemów`, "gem");
      return false;
    }
    const r = refillHeartsPure(m);
    store.setMeta(r);
    play("gem");
    emit({ type: "gem", delta: -GEM_COSTS.heartRefill, gems: r.gems });
    emit({ type: "heart", delta: 5, hearts: r.hearts });
    showToast(`Życia uzupełnione: −${GEM_COSTS.heartRefill} gemów`, "heart");
    bump();
    return true;
  }, [store, emit, showToast, bump]);
  const buyStreakFreeze = useCallback(() => {
    if (!store) return false;
    if (store.meta.streakFreezes >= FREEZE_MAX) {
      showToast("Masz już komplet", "check");
      return false;
    }
    const m = spendGemsPure(store.meta, GEM_COSTS.streakFreeze);
    if (!m) {
      showToast(`Brakuje ${GEM_COSTS.streakFreeze - store.meta.gems} gemów`, "gem");
      return false;
    }
    store.setMeta({ ...m, streakFreezes: m.streakFreezes + 1 });
    play("gem");
    emit({ type: "gem", delta: -GEM_COSTS.streakFreeze, gems: m.gems });
    showToast("Zamrożenie w plecaku", "snow");
    bump();
    return true;
  }, [store, emit, showToast, bump]);
  const buyBoost = useCallback(() => {
    if (!store) return false;
    if (boostActivePure(store.extra.boostUntil)) {
      showToast("Podwójne XP już działa", "bolt");
      return false;
    }
    const m = spendGemsPure(store.meta, GEM_COSTS.xpBoost);
    if (!m) {
      showToast(`Brakuje ${GEM_COSTS.xpBoost - store.meta.gems} gemów`, "gem");
      return false;
    }
    store.setMeta(m);
    store.setExtra({ boostUntil: Date.now() + BOOST_MS });
    play("gem");
    emit({ type: "gem", delta: -GEM_COSTS.xpBoost, gems: m.gems });
    showToast("Podwójne XP przez 15 minut", "bolt");
    bump();
    return true;
  }, [store, emit, showToast, bump]);
  const buyTheme = useCallback(() => {
    if (!store) return false;
    const owned = store.extra.themes.owned;
    const next = THEMES.find((t) => !owned.includes(t.id));
    if (!next) {
      showToast("Wszystkie zestawy odblokowane", "check");
      return false;
    }
    const m = spendGemsPure(store.meta, GEM_COSTS.theme);
    if (!m) {
      showToast(`Brakuje ${GEM_COSTS.theme - store.meta.gems} gemów`, "gem");
      return false;
    }
    store.setMeta(m);
    store.setExtra({ themes: { owned: [...owned, next.id], active: next.id } });
    play("gem");
    emit({ type: "gem", delta: -GEM_COSTS.theme, gems: m.gems });
    showToast("Nowy motyw: " + next.name, "palette");
    bump();
    return true;
  }, [store, emit, showToast, bump]);
  const setTheme = useCallback(
    (id: string) => {
      if (!store || !store.extra.themes.owned.includes(id)) return;
      store.setExtra({ themes: { ...store.extra.themes, active: id } });
      bump();
    },
    [store, bump],
  );

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
  const setReduceMotion = useCallback(
    (v: boolean) => {
      setUserReduceMotion(v);
      setExtra({ reduceMotion: v });
    },
    [setExtra],
  );
  const setGoal = useCallback((g: Goal | null) => setExtra({ goal: g }), [setExtra]);
  const setReminder = useCallback((r: Reminder) => setExtra({ reminder: r }), [setExtra]);
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

  /* ---------- 2.0: poprawki, boss, duch, plany, plan dnia ---------- */
  const setOverride = useCallback(
    (topicId: string, levelId: string, qi: number, q: QuizQuestion | null) => {
      if (!store) return;
      const O = { ...store.extra.overrides };
      const k = ovKey(topicId, levelId, qi);
      if (q) O[k] = { q: q.q, a: [...q.a], c: q.c, e: q.e, src: q.src, at: todayStr() };
      else delete O[k];
      store.setExtra({ overrides: O });
      bump();
    },
    [store, bump],
  );
  const hideLevel = useCallback(
    (topicId: string, levelId: string, hidden: boolean) => {
      if (!store) return;
      const O = { ...store.extra.overrides };
      if (hidden) O[hideKey(topicId, levelId)] = true;
      else delete O[hideKey(topicId, levelId)];
      store.setExtra({ overrides: O });
      bump();
    },
    [store, bump],
  );
  const setBoss = useCallback(
    (topicId: string, rec: BossRecord) => {
      if (!store) return;
      store.setProgress(topicId, { ...store.getProgress(topicId), boss: rec });
      bump();
    },
    [store, bump],
  );
  const setGhost = useCallback(
    (topicId: string, levelId: string, rec: GhostRecord) => {
      if (!store) return;
      const p = store.getProgress(topicId);
      store.setProgress(topicId, { ...p, ghost: { ...(p.ghost ?? {}), [levelId]: rec } });
      bump();
    },
    [store, bump],
  );
  const examRec = useCallback((topicId: string): ExamRec => store?.extra.exams[topicId] ?? { n: 0, passed: 0 }, [store]);
  const recordExam = useCallback(
    (topicId: string, entry: ExamEntry, passed: boolean) => {
      if (!store) return;
      const prev = store.extra.exams[topicId] ?? { n: 0, passed: 0 };
      const best = !prev.best || entry.pct > prev.best.pct ? entry : prev.best;
      store.setExtra({ exams: { ...store.extra.exams, [topicId]: { n: prev.n + 1, passed: prev.passed + (passed ? 1 : 0), best, last: entry } } });
      const st = store.meta.stats;
      store.setMeta({ ...store.meta, stats: { ...st, examsPassed: st.examsPassed + (passed ? 1 : 0), bestExamPct: Math.max(st.bestExamPct ?? 0, entry.pct) } });
      checkAchievements(store);
      bump();
    },
    [store, checkAchievements, bump],
  );

  /* eslint-disable react-hooks/exhaustive-deps -- `tick` wymusza odczyt po zapisach w mutowalnym store */
  const meta = useMemo(() => (store ? normalizeHearts(store.getMeta(), now) : emptyMeta()), [store, tick, now]);
  const totalXp = useMemo(() => store?.totalXp() ?? 0, [store, tick]);
  const stage = useMemo(() => store?.stage ?? null, [store, tick]);
  const progress = useMemo(() => store?.progress ?? {}, [store, tick]);
  const srs = useMemo(() => store?.srs ?? {}, [store, tick]);
  const weak = useMemo(() => store?.weak ?? {}, [store, tick]);
  const plan = useMemo<Plan>(() => store?.plan ?? "free", [store, tick]);
  const quests = useMemo(() => (store ? questsNow(store) : []), [store, tick, questsNow]);
  const weeklyQuest = useMemo(() => (store ? weeklyNow(store) : weeklyQuestFor(null, "anon", todayStr())), [store, tick, weeklyNow]);
  const achievements = useMemo(() => store?.achievements ?? new Set<string>(), [store, tick]);
  const activity = useMemo(() => store?.activity ?? {}, [store, tick]);
  const showOnLeaderboard = useMemo(() => store?.showOnLeaderboard ?? true, [store, tick]);
  const displayName = useMemo(() => store?.displayName ?? null, [store, tick]);
  const extra = useMemo(() => store?.extra ?? ({ goal: null, themes: { owned: ["violet"], active: "violet" }, boostUntil: null, album: {}, overrides: {}, tests: [], weekly: null, history: {}, daily: null, reduceMotion: false, reminder: null, exams: {} } as Extra), [store, tick]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const hearts = useMemo(() => heartsNow(meta, now, plan === "pro"), [meta, now, plan]);
  const daily = useMemo(() => buildDailySession(topics, progress, srs, weak), [topics, progress, srs, weak]);
  const week = useMemo(() => weekStrip(activity), [activity]);
  const todayXp = useMemo(() => todayXpOf(activity), [activity]);
  const rank = useMemo(() => rankFor(totalXp), [totalXp]);
  const onboarded = !!stage && subjects.length > 0;
  const boostActive = boostActivePure(extra.boostUntil, now);

  const dueCount = useCallback(
    (subjectId?: string) => {
      const list = subjectId ? topics.filter((t) => t.subjectId === subjectId) : topics;
      const d = new Date();
      let n = 0;
      for (const t of list) for (const c of Object.values(srs[t.id] ?? {})) if (isDue(c, d)) n++;
      return n;
    },
    [topics, srs],
  );

  /* plany do sprawdzianu: raz dziennie przeliczenie (syncTests) */
  const tests = useMemo(() => {
    const synced = syncTests(extra.tests, topicsOf, progress, weak);
    return synced;
  }, [extra.tests, topicsOf, progress, weak]);
  useEffect(() => {
    if (store && tests !== extra.tests) store.setExtra({ tests });
  }, [store, tests, extra.tests]);
  const testFor = useCallback((subjectId: string) => tests.find((t) => t.subjectId === subjectId) ?? null, [tests]);
  const createTestPlan = useCallback(
    (subjectId: string, date: string, levels: string[]) => {
      const r = createTestPure(tests, subjectId, date, levels, topicsOf(subjectId), progress, weak);
      setExtra({ tests: r.tests });
      void updateSubject(subjectId, { examDate: date });
      return r.test;
    },
    [tests, topicsOf, progress, weak, setExtra, updateSubject],
  );
  const removeTestPlan = useCallback(
    (id: string) => {
      const t = tests.find((x) => x.id === id);
      setExtra({ tests: tests.filter((x) => x.id !== id) });
      if (t) void updateSubject(t.subjectId, { examDate: null });
    },
    [tests, setExtra, updateSubject],
  );
  const markTestDone = useCallback(
    (subjectId: string, kind: TestKind) => {
      const r = testDonePure(tests, subjectId, kind, progress);
      if (!r) return;
      setExtra({ tests: r });
      if (store) {
        const st = store.meta.stats;
        store.setMeta({ ...store.meta, stats: { ...st, planDays: (st.planDays ?? 0) + 1 } });
      }
      setTimeout(() => showToast("Plan do sprawdzianu: dzień zaliczony", "calendar"), 4400);
    },
    [tests, progress, setExtra, showToast, store],
  );

  /* plan dnia */
  const dailyPlan = useMemo(() => ensureDaily(extra.daily, () => buildDailyTasks(subjects, topicsOf, progress, weak)), [extra.daily, subjects, topicsOf, progress, weak]);
  useEffect(() => {
    if (store && ready && dailyPlan !== extra.daily) store.setExtra({ daily: dailyPlan });
  }, [store, ready, dailyPlan, extra.daily]);
  const planItems = useMemo(() => dailyPlan.tasks.map((t) => taskInfo(t, subjects, topicsOf, weak, dueCount)).filter((x): x is PlanInfo => !!x), [dailyPlan, subjects, topicsOf, weak, dueCount]);

  const planCheck = useCallback(
    (d: Extra["daily"]) => {
      if (!store || !d || d.planDone || !d.tasks.length || !d.tasks.every((t) => t.done)) return;
      store.setExtra({ daily: { ...d, planDone: true } });
      const st = store.meta.stats;
      store.setMeta({ ...store.meta, gems: store.meta.gems + GEMS.dailyGoal, stats: { ...st, planDays: (st.planDays ?? 0) + 1 } });
      emit({ type: "gem", delta: GEMS.dailyGoal, gems: store.meta.gems });
      setTimeout(() => showToast(`Plan dnia zrobiony: +${GEMS.dailyGoal} gemów`, "gem"), 4800);
      checkAchievements(store);
    },
    [store, emit, showToast, checkAchievements],
  );
  const completeDaily = useCallback(
    (subjectId: string, kind: PlanKind, levelId?: string) => {
      if (!store) return false;
      const d = ensureDaily(store.extra.daily, () => buildDailyTasks(latest.current.subjects, (sid) => latest.current.topics.filter((t) => t.subjectId === sid), store.progress, store.weak));
      const pre = `${subjectId}:${kind}`;
      const t = d.tasks.find((x) => !x.done && (levelId ? x.id.startsWith(pre + ":") && x.id.endsWith(":" + levelId) : x.id === pre || x.id.startsWith(pre + ":")));
      if (!t) return false;
      const next = { ...d, tasks: d.tasks.map((x) => (x === t ? { ...x, done: true } : x)) };
      store.setExtra({ daily: next });
      const [sid] = t.id.split(":");
      const topic = latest.current.topics.find((x) => x.subjectId === sid);
      const reward = { lesson: 15, review: 20, quiz: 25, exam: 40, weak: 20 }[kind];
      if (reward && topic) addXp(topic.id, reward);
      setTimeout(() => showToast(`Plan dnia: +${reward} XP`, "bolt"), 3200);
      planCheck(next);
      bump();
      return true;
    },
    [store, addXp, showToast, planCheck, bump],
  );
  const tickDaily = useCallback(
    (subjectId: string, kind: PlanKind, n = 1) => {
      if (!store) return;
      const d = store.extra.daily;
      if (!d) return;
      const t = d.tasks.find((x) => !x.done && x.id === `${subjectId}:${kind}`);
      if (!t) return;
      const prog = (t.prog ?? 0) + n;
      if (prog >= (t.need ?? 1)) completeDaily(subjectId, kind);
      else {
        store.setExtra({ daily: { ...d, tasks: d.tasks.map((x) => (x === t ? { ...x, prog } : x)) } });
        bump();
      }
    },
    [store, completeDaily, bump],
  );

  const fetchLeaderboard = useCallback((limit = 50) => (store ? store.fetchLeaderboard(limit) : Promise.resolve([])), [store]);
  const myWeeklyRank = useCallback(() => (store ? store.myWeeklyRank() : Promise.resolve(null)), [store]);
  const popUnlocked = useCallback(() => setUnlockedQueue((q) => q.slice(1)), []);
  const popLevelUp = useCallback(() => setLevelUpQueue((q) => q.slice(1)), []);
  const on = useCallback((fn: (e: AppEvent) => void) => emitter.on(fn), [emitter]);

  const value = useMemo<AppState>(
    () => ({
      ready, offline, refreshing, refresh, store, userId, subjects, topics, topicsOf, findSubject, findTopic, getTopic, registerTopic, createSubjects, updateSubject, deleteSubject,
      progress, progressFor, setProgressFor, addXp, srs, srsFor, setSrsFor, reviewCard, weak, setWeak, logActivity,
      meta, streak: streakDisplay(meta), streakAtRisk: streakAtRisk(meta), totalXp, stage, setStage, onboarded, daily,
      plan, hearts, canStartLesson: canStartLesson(meta, plan === "pro", now), loseHeart, gainHeart, refillHearts, buyStreakFreeze, spendGems, addGems,
      gems: meta.gems, dailyGoal: meta.dailyGoal, setDailyGoal, todayXp, goalPct: dailyGoalPct(todayXp, meta.dailyGoal), goalMet: todayXp >= meta.dailyGoal, week,
      quests, weeklyQuest, questEvent, claimQuest, achievements, unlockedQueue, popUnlocked, levelUpQueue, popLevelUp, rank,
      soundOn: meta.soundOn, setSoundOn, showOnLeaderboard, setShowOnLeaderboard, displayName, setDisplayName, bumpStats, openChest, claimTrophy, fetchLeaderboard, myWeeklyRank, on,
      extra, setGoal, setReminder, reduceMotion: extra.reduceMotion, setReduceMotion, boostActive, buyBoost, buyTheme, setTheme, setOverride, hideLevel, album: extra.album,
      tests, testFor, createTestPlan, removeTestPlan, markTestDone, planItems, completeDaily, tickDaily, histAdd, histMax, setBoss, setGhost, examRec, recordExam, dueCount,
      toast, toastIcon, showToast, tick,
    }),
    [
      ready, offline, refreshing, refresh, store, userId, subjects, topics, topicsOf, findSubject, findTopic, getTopic, registerTopic, createSubjects, updateSubject, deleteSubject,
      progress, progressFor, setProgressFor, addXp, srs, srsFor, setSrsFor, reviewCard, weak, setWeak, logActivity, meta, totalXp, stage, setStage, onboarded, daily,
      plan, hearts, now, loseHeart, gainHeart, refillHearts, buyStreakFreeze, spendGems, addGems, setDailyGoal, todayXp, week, quests, weeklyQuest, questEvent, claimQuest, achievements, unlockedQueue, popUnlocked,
      levelUpQueue, popLevelUp, rank, setSoundOn, showOnLeaderboard, setShowOnLeaderboard, displayName, setDisplayName, bumpStats, openChest, claimTrophy, fetchLeaderboard, myWeeklyRank, on,
      extra, setGoal, setReminder, setReduceMotion, boostActive, buyBoost, buyTheme, setTheme, setOverride, hideLevel, tests, testFor, createTestPlan, removeTestPlan, markTestDone, planItems, completeDaily, tickDaily, histAdd, histMax, setBoss, setGhost, examRec, recordExam, dueCount,
      toast, toastIcon, showToast, tick,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp poza AppProvider");
  return v;
}

/** „Nie było cię N dni” — ComeBack (legacy needComeBack): ≥ 3 dni przerwy, raz dziennie. */
export function comebackDays(meta: UserMeta): number {
  if (!meta.lastDay) return 0;
  return dayDiff(meta.lastDay, todayStr());
}
