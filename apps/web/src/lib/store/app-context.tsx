"use client";
import { streakDisplay, touchStreak, type Stage, type SubjectProgress, type UserMeta } from "@nauka/shared";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { LS, lsGet, lsSet } from "@/lib/store/local";
import { mergeLocalIntoSupabase } from "@/lib/store/merge";
import { LocalProgressStore, SupabaseProgressStore, type ProgressStore, type SrsMap } from "@/lib/store/progress-store";
import { localKeyFor, type AppSubject } from "@/lib/types";

export interface Toast {
  id: number;
  text: string;
}

interface AppState {
  ready: boolean;
  user: User | null;
  session: Session | null;
  supabase: SupabaseClient | null;
  store: ProgressStore;
  /** Storage key for a subject in the current store (slug for guests, uuid for logged users). */
  keyFor(s: Pick<AppSubject, "id" | "slug">): string;
  progressOf(s: Pick<AppSubject, "id" | "slug">): SubjectProgress;
  setProgress(s: Pick<AppSubject, "id" | "slug">, p: SubjectProgress): void;
  /** Add XP to a subject and register today's activity. */
  addXp(s: Pick<AppSubject, "id" | "slug">, n: number): void;
  meta: UserMeta;
  streak: number;
  totalXp: number;
  stage: Stage | null;
  setStage(st: Stage): void;
  srsOf(s: Pick<AppSubject, "id" | "slug">): SrsMap;
  setSrs(s: Pick<AppSubject, "id" | "slug">, cards: SrsMap): void;
  toast(text: string): void;
  toasts: Toast[];
  signOut(): Promise<void>;
  onboarded: boolean;
  setOnboarded(): void;
  version: number;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => (typeof window === "undefined" ? null : getBrowserSupabase()), []);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState<ProgressStore>(() => new LocalProgressStore());
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [onboarded, setOnb] = useState(true);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const loadedFor = useRef<string | null>(null);

  // auth bootstrap
  useEffect(() => {
    let alive = true;
    if (!supabase) {
      const local = new LocalProgressStore();
      local.load().then(() => {
        if (!alive) return;
        setStore(local);
        setOnb(!!lsGet(LS.onboarded) || !!local.getStage());
        setReady(true);
      });
      return () => {
        alive = false;
      };
    }
    supabase.auth.getSession().then(({ data }) => alive && setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // pick store for the current user
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const uid = session?.user.id ?? null;
    if (loadedFor.current === uid && ready) return;
    loadedFor.current = uid;
    setReady(false);
    (async () => {
      if (uid) {
        try {
          await mergeLocalIntoSupabase(supabase, uid);
        } catch (e) {
          console.warn("[merge] failed", e);
        }
        const s = new SupabaseProgressStore(supabase, uid);
        try {
          await s.load();
        } catch (e) {
          console.warn("[store] load failed", e);
        }
        if (!alive) return;
        setStore(s);
        setOnb(!!s.getStage() || !!lsGet(LS.onboarded));
      } else {
        const s = new LocalProgressStore();
        await s.load();
        if (!alive) return;
        setStore(s);
        setOnb(!!lsGet(LS.onboarded) || !!s.getStage());
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, session, ready]);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1700);
  }, []);

  const keyFor = useCallback((s: Pick<AppSubject, "id" | "slug">) => (store.kind === "supabase" ? s.id : localKeyFor(s)), [store]);

  const value = useMemo<AppState>(() => {
    const meta = store.getMeta();
    return {
      ready,
      user: session?.user ?? null,
      session,
      supabase,
      store,
      keyFor,
      progressOf: (s) => store.getProgress(keyFor(s)),
      setProgress: (s, p) => {
        store.setProgress(keyFor(s), p);
        bump();
      },
      addXp: (s, n) => {
        const k = keyFor(s);
        const p = store.getProgress(k);
        store.setProgress(k, { ...p, xp: p.xp + n });
        const { meta: m, extended } = touchStreak(store.getMeta());
        if (extended) {
          store.setMeta(m);
          if (m.streak > 1) setTimeout(() => toast(`🔥 seria ${m.streak} dni z rzędu!`), 1200);
        }
        bump();
      },
      meta,
      streak: streakDisplay(meta),
      totalXp: store.totalXp(),
      stage: store.getStage(),
      setStage: (st) => {
        store.setStage(st);
        bump();
      },
      srsOf: (s) => store.getSrs(keyFor(s)),
      setSrs: (s, cards) => {
        store.setSrs(keyFor(s), cards);
        bump();
      },
      toast,
      toasts,
      signOut: async () => {
        await supabase?.auth.signOut();
        loadedFor.current = null;
        setSession(null);
      },
      onboarded,
      setOnboarded: () => {
        lsSet(LS.onboarded, "1");
        setOnb(true);
      },
      version,
    };
  }, [ready, session, supabase, store, keyFor, toasts, onboarded, version, bump, toast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}
