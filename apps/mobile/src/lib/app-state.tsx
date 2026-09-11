import {
  emptyProgress,
  streakDisplay,
  touchStreak,
  type Stage,
  type SubjectProgress,
  type UserMeta,
} from "@nauka/shared";
import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { KEYS, getJson, setJson } from "./storage";
import { mergeLocalIntoSupabase } from "./store/merge";
import { LocalProgressStore, SupabaseProgressStore, type ProgressStore, type SrsMap } from "./store/progress-store";
import {
  fetchLibraryIds,
  fetchOwnSubjects,
  fetchPublicSubjects,
  fetchSubjectById,
  loadSeedSubjects,
  mergeById,
  progressKey,
  readSubjectsCache,
  writeSubjectsCache,
  type AppSubject,
} from "./subjects";
import { isUuid, supabase } from "./supabase";

export interface AppState {
  ready: boolean;
  store: ProgressStore;
  /** wszystkie znane przedmioty (public + własne + cache) */
  subjects: AppSubject[];
  /** publiczne (biblioteka) */
  publicSubjects: AppSubject[];
  /** własne (owner = user) */
  ownSubjects: AppSubject[];
  /** id/slugi dodane „do moich” */
  libraryIds: string[];
  /** przedmioty na ekranie głównym: własne + biblioteka */
  homeSubjects: AppSubject[];
  offline: boolean;
  refreshing: boolean;
  refresh(): Promise<void>;
  getSubject(idOrSlug: string): Promise<AppSubject | null>;
  findSubject(idOrSlug: string): AppSubject | undefined;
  registerSubject(s: AppSubject): void;
  inLibrary(s: AppSubject): boolean;
  toggleLibrary(s: AppSubject): Promise<void>;
  /* progress */
  keyFor(s: AppSubject): string;
  progressFor(s: AppSubject): SubjectProgress;
  setProgressFor(s: AppSubject, p: SubjectProgress): void;
  /** dodaje XP (bez zmiany poziomów) i odnotowuje streak */
  addXp(s: AppSubject, n: number): void;
  srsFor(s: AppSubject): SrsMap;
  setSrsFor(s: AppSubject, m: SrsMap): void;
  meta: UserMeta;
  streak: number;
  totalXp: number;
  stage: Stage | null;
  setStage(st: Stage): void;
  onboarded: boolean;
  setOnboarded(): void;
  /* toast */
  toast: string | null;
  showToast(t: string): void;
  /** licznik zmian — komponenty re-renderują się po zapisach */
  tick: number;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const [store, setStore] = useState<ProgressStore>(() => new LocalProgressStore());
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const [subjects, setSubjects] = useState<AppSubject[]>([]);
  const [libraryIds, setLibraryIds] = useState<string[]>([]);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [onboarded, setOnb] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((t: string) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1700);
  }, []);

  /* ---------- store per użytkownik ---------- */
  useEffect(() => {
    if (auth.loading) return;
    let alive = true;
    (async () => {
      setReady(false);
      let s: ProgressStore;
      if (userId && supabase) {
        s = new SupabaseProgressStore(supabase, userId);
        try {
          const merged = await mergeLocalIntoSupabase(supabase, userId);
          await s.load();
          if (merged) showToast("Postępy gościa scalone z kontem ✅");
        } catch (e) {
          console.warn("[app] supabase store load failed, using cached snapshot", e);
          // brak sieci: snapshot z ostatniego load()
          const snap = await getJson<Record<string, SubjectProgress>>(`${KEYS.progress}:${userId}`, {});
          for (const [k, v] of Object.entries(snap)) s.setProgress(k, v);
        }
      } else {
        s = new LocalProgressStore();
        await s.load();
      }
      const onb = await getJson<boolean>(KEYS.onboarded, false);
      if (!alive) return;
      setOnb(onb || !!s.getStage());
      setStore(s);
      setReady(true);
      bump();
    })();
    return () => {
      alive = false;
    };
  }, [userId, auth.loading, bump, showToast]);

  /* ---------- przedmioty ---------- */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const cached = await readSubjectsCache();
      const seeds = loadSeedSubjects();
      let pub: AppSubject[] | null = null;
      let own: AppSubject[] = [];
      let lib: string[] | null = null;
      if (supabase) {
        try {
          pub = await fetchPublicSubjects(supabase);
          if (userId) {
            own = await fetchOwnSubjects(supabase, userId);
            lib = await fetchLibraryIds(supabase, userId);
          }
          setOffline(false);
        } catch (e) {
          console.warn("[app] subjects fetch failed → cache/seeds", e);
          setOffline(true);
        }
      }
      // gdy Supabase pusty / brak env / offline → seedy (slug jako id)
      const publicList = pub && pub.length ? pub : seeds;
      const all = mergeById(cached.filter((c) => !!c.ownerId), publicList, own);
      setSubjects(all);
      if (lib) setLibraryIds(lib);
      else setLibraryIds(await getJson<string[]>(KEYS.library, []));
      void writeSubjectsCache(all);
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (auth.loading) return;
    // najpierw cache (natychmiast), potem sieć
    (async () => {
      const cached = await readSubjectsCache();
      if (cached.length) setSubjects((cur) => (cur.length ? cur : cached));
      else setSubjects(loadSeedSubjects());
      await refresh();
    })();
  }, [refresh, auth.loading]);

  const findSubject = useCallback((idOrSlug: string) => subjects.find((s) => s.id === idOrSlug || (s.slug && s.slug === idOrSlug)), [subjects]);

  const registerSubject = useCallback((s: AppSubject) => {
    setSubjects((cur) => {
      const next = mergeById(cur, [s]);
      void writeSubjectsCache(next);
      return next;
    });
  }, []);

  const getSubject = useCallback(
    async (idOrSlug: string): Promise<AppSubject | null> => {
      const local = findSubject(idOrSlug);
      if (local) return local;
      if (supabase) {
        try {
          const r = await fetchSubjectById(supabase, idOrSlug, isUuid(idOrSlug));
          if (r) {
            registerSubject(r);
            return r;
          }
        } catch {
          /* offline */
        }
      }
      return loadSeedSubjects().find((s) => s.id === idOrSlug) ?? null;
    },
    [findSubject, registerSubject],
  );

  const publicSubjects = useMemo(() => subjects.filter((s) => s.isPublic && s.ownerId === null), [subjects]);
  const ownSubjects = useMemo(() => (userId ? subjects.filter((s) => s.ownerId === userId) : []), [subjects, userId]);

  const inLibrary = useCallback((s: AppSubject) => libraryIds.includes(s.id) || (!!s.slug && libraryIds.includes(s.slug)), [libraryIds]);

  const toggleLibrary = useCallback(
    async (s: AppSubject) => {
      const has = inLibrary(s);
      const next = has ? libraryIds.filter((x) => x !== s.id && x !== s.slug) : [...libraryIds, s.id];
      setLibraryIds(next);
      if (userId && supabase && isUuid(s.id)) {
        if (has) await supabase.from("library").delete().eq("user_id", userId).eq("subject_id", s.id);
        else await supabase.from("library").upsert({ user_id: userId, subject_id: s.id }, { onConflict: "user_id,subject_id" });
      } else {
        await setJson(KEYS.library, next);
      }
    },
    [inLibrary, libraryIds, userId],
  );

  const homeSubjects = useMemo(() => {
    const lib = publicSubjects.filter(inLibrary);
    return [...ownSubjects, ...lib];
  }, [ownSubjects, publicSubjects, inLibrary]);

  /* ---------- progress helpers ---------- */
  const keyFor = useCallback((s: AppSubject) => progressKey(s, store.kind), [store]);
  const progressFor = useCallback((s: AppSubject) => (ready ? store.getProgress(keyFor(s)) : emptyProgress()), [store, keyFor, ready]);

  const touch = useCallback(() => {
    const { meta, extended } = touchStreak(store.getMeta());
    if (extended) {
      store.setMeta(meta);
      if (meta.streak > 1) setTimeout(() => showToast(`🔥 seria ${meta.streak} dni z rzędu!`), 1500);
    }
  }, [store, showToast]);

  const setProgressFor = useCallback(
    (s: AppSubject, p: SubjectProgress) => {
      store.setProgress(keyFor(s), p);
      touch();
      bump();
    },
    [store, keyFor, touch, bump],
  );

  const addXp = useCallback(
    (s: AppSubject, n: number) => {
      if (n <= 0) return;
      const p = store.getProgress(keyFor(s));
      store.setProgress(keyFor(s), { ...p, xp: p.xp + n });
      touch();
      bump();
    },
    [store, keyFor, touch, bump],
  );

  const srsFor = useCallback((s: AppSubject) => store.getSrs(keyFor(s)), [store, keyFor]);
  const setSrsFor = useCallback(
    (s: AppSubject, m: SrsMap) => {
      store.setSrs(keyFor(s), m);
      bump();
    },
    [store, keyFor, bump],
  );

  const setStage = useCallback(
    (st: Stage) => {
      store.setStage(st);
      bump();
    },
    [store, bump],
  );
  const setOnboarded = useCallback(() => {
    setOnb(true);
    void setJson(KEYS.onboarded, true);
  }, []);

  // tick w deps, żeby meta/xp odświeżały się po zapisach
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const meta = useMemo(() => store.getMeta(), [store, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const totalXp = useMemo(() => store.totalXp(), [store, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stage = useMemo(() => store.getStage(), [store, tick]);

  const value = useMemo<AppState>(
    () => ({
      ready,
      store,
      subjects,
      publicSubjects,
      ownSubjects,
      libraryIds,
      homeSubjects,
      offline,
      refreshing,
      refresh,
      getSubject,
      findSubject,
      registerSubject,
      inLibrary,
      toggleLibrary,
      keyFor,
      progressFor,
      setProgressFor,
      addXp,
      srsFor,
      setSrsFor,
      meta,
      streak: streakDisplay(meta),
      totalXp,
      stage,
      setStage,
      onboarded,
      setOnboarded,
      toast,
      showToast,
      tick,
    }),
    [ready, store, subjects, publicSubjects, ownSubjects, libraryIds, homeSubjects, offline, refreshing, refresh, getSubject, findSubject, registerSubject, inLibrary, toggleLibrary, keyFor, progressFor, setProgressFor, addXp, srsFor, setSrsFor, meta, totalXp, stage, setStage, onboarded, setOnboarded, toast, showToast, tick],
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
