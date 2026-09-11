import {
  buildDailySession,
  emptyMeta,
  emptyProgress,
  streakDisplay,
  touchStreak,
  type DailySession,
  type Stage,
  type Subject,
  type SubjectProgress,
  type Topic,
  type UserMeta,
  type WeakMap,
} from "@nauka/shared";
import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { fetchTopic, fetchUserData, insertSubjects, readCache, writeCache, type SrsMap, type SubjectInput, type UserData } from "./data";
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
  setProgressFor(topicId: string, p: SubjectProgress): void;
  addXp(topicId: string, n: number): void;
  srs: Record<string, SrsMap>;
  srsFor(topicId: string): SrsMap;
  setSrsFor(topicId: string, m: SrsMap): void;
  weak: WeakMap;
  setWeak(topicId: string, levelId: string, wrongIdx: number[], rightIdx: number[]): void;
  logActivity(xp: number, minutes: number): void;
  meta: UserMeta;
  streak: number;
  totalXp: number;
  stage: Stage | null;
  setStage(st: Stage): void;
  /** onboarding zrobiony = jest etap i ≥1 przedmiot */
  onboarded: boolean;
  daily: DailySession;
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
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ subjects: Subject[]; topics: Topic[] }>({ subjects: [], topics: [] });
  latest.current = { subjects, topics };

  const showToast = useCallback((t: string) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1700);
  }, []);

  /** snapshot całości do AsyncStorage — używany przez store po każdym zapisie */
  const attachSnapshot = useCallback((s: ProgressStore) => {
    s.snapshot = () => ({ subjects: latest.current.subjects, topics: latest.current.topics, progress: s.progress, srs: s.srs, weak: s.weak, meta: s.meta, stage: s.stage });
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
        showToast("📴 Brak sieci — pokazuję zapisane dane");
      } finally {
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

  const registerTopic = useCallback((t: Topic) => {
    setTopics((cur) => {
      const next = cur.some((x) => x.id === t.id) ? cur.map((x) => (x.id === t.id ? t : x)) : [...cur, t];
      latest.current = { ...latest.current, topics: next };
      if (store?.snapshot && userId) void writeCache(userId, store.snapshot());
      return next;
    });
  }, [store, userId]);

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

  const updateSubject = useCallback(
    async (id: string, patch: { examDate?: string | null; examLabel?: string | null; name?: string; emoji?: string }) => {
      if (!supabase) return;
      const row: Record<string, unknown> = {};
      if ("examDate" in patch) row.exam_date = patch.examDate ?? null;
      if ("examLabel" in patch) row.exam_label = patch.examLabel ?? null;
      if (patch.name) row.name = patch.name;
      if (patch.emoji) row.emoji = patch.emoji;
      setSubjects((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      const { error } = await supabase.from("subjects").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    },
    [],
  );

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

  /* ---------- progress ---------- */
  const touch = useCallback(() => {
    if (!store) return;
    const { meta, extended } = touchStreak(store.getMeta());
    if (extended) {
      store.setMeta(meta);
      if (meta.streak > 1) setTimeout(() => showToast(`🔥 seria ${meta.streak} dni z rzędu!`), 1500);
    }
  }, [store, showToast]);

  const progressFor = useCallback((id: string) => store?.getProgress(id) ?? emptyProgress(), [store]);
  const setProgressFor = useCallback(
    (id: string, p: SubjectProgress) => {
      store?.setProgress(id, p);
      touch();
      bump();
    },
    [store, touch, bump],
  );
  const addXp = useCallback(
    (id: string, n: number) => {
      if (!store || n <= 0) return;
      const p = store.getProgress(id);
      store.setProgress(id, { ...p, xp: p.xp + n });
      touch();
      bump();
    },
    [store, touch, bump],
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
  const logActivity = useCallback((xp: number, minutes: number) => store?.logActivity(xp, minutes), [store]);
  const setStage = useCallback(
    (st: Stage) => {
      store?.setStage(st);
      void setJson(KEYS.stage, st);
      bump();
    },
    [store, bump],
  );

  /* eslint-disable react-hooks/exhaustive-deps -- `tick` wymusza odczyt po zapisach w mutowalnym store */
  const meta = useMemo(() => store?.getMeta() ?? emptyMeta(), [store, tick]);
  const totalXp = useMemo(() => store?.totalXp() ?? 0, [store, tick]);
  const stage = useMemo(() => store?.stage ?? null, [store, tick]);
  const progress = useMemo(() => store?.progress ?? {}, [store, tick]);
  const srs = useMemo(() => store?.srs ?? {}, [store, tick]);
  const weak = useMemo(() => store?.weak ?? {}, [store, tick]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const daily = useMemo(() => buildDailySession(topics, progress, srs, weak), [topics, progress, srs, weak]);
  const onboarded = !!stage && subjects.length > 0;

  const value = useMemo<AppState>(
    () => ({
      ready, offline, refreshing, refresh, store, subjects, topics, topicsOf, findSubject, findTopic, getTopic, registerTopic, createSubjects, updateSubject, deleteSubject,
      progress, progressFor, setProgressFor, addXp, srs, srsFor, setSrsFor, weak, setWeak, logActivity,
      meta, streak: streakDisplay(meta), totalXp, stage, setStage, onboarded, daily, toast, showToast, tick,
    }),
    [ready, offline, refreshing, refresh, store, subjects, topics, topicsOf, findSubject, findTopic, getTopic, registerTopic, createSubjects, updateSubject, deleteSubject, progress, progressFor, setProgressFor, addXp, srs, srsFor, setSrsFor, weak, setWeak, logActivity, meta, totalXp, stage, setStage, onboarded, daily, toast, showToast, tick],
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
