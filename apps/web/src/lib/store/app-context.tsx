"use client";
import { streakDisplay, touchStreak, type Stage, type SubjectProgress, type UserMeta, type WeakMap } from "@nauka/shared";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { ProgressStore, type SrsMap } from "@/lib/store/progress-store";

export interface Toast {
  id: number;
  text: string;
}

export interface AppUser {
  id: string;
  email: string | null;
  name: string | null;
}

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
  /** Add XP to a topic and register today's activity (streak). */
  addXp(topicId: string, n: number): void;
  weak: WeakMap;
  setWeak(next: WeakMap, topicId: string): void;
  srsOf(topicId: string): SrsMap;
  allSrs(): Record<string, SrsMap>;
  setSrs(topicId: string, cards: SrsMap): void;
  logActivity(xp: number, minutes: number): void;
  meta: UserMeta;
  streak: number;
  totalXp: number;
  stage: Stage | null;
  setStage(st: Stage): void;
  toast(text: string): void;
  toasts: Toast[];
  signOut(): Promise<void>;
  version: number;
}

const Ctx = createContext<AppState | null>(null);
const EMPTY: SubjectProgress = { xp: 0, levels: {} };

export function AppProvider({ user, children }: { user: AppUser; children: ReactNode }) {
  const supabase = useMemo(() => getBrowserSupabase()!, []);
  const [session, setSession] = useState<Session | null>(null);
  const [store, setStore] = useState<ProgressStore | null>(null);
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
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
    };
  }, [supabase, user.id]);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1700);
  }, []);

  const value = useMemo<AppState>(() => {
    const meta = store?.getMeta() ?? { streak: 0, best: 0, lastDay: null };
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
      addXp: (id, n) => {
        if (!store) return;
        const p = store.getProgress(id);
        if (n) store.setProgress(id, { ...p, xp: p.xp + n });
        const { meta: m, extended } = touchStreak(store.getMeta());
        if (extended) {
          store.setMeta(m);
          if (m.streak > 1) setTimeout(() => toast(`🔥 seria ${m.streak} dni z rzędu!`), 1200);
        }
        bump();
      },
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
      logActivity: (xp, minutes) => store?.logActivity(xp, minutes),
      meta,
      streak: streakDisplay(meta),
      totalXp: store?.totalXp() ?? 0,
      stage: store?.getStage() ?? null,
      setStage: (st) => {
        store?.setStage(st);
        bump();
      },
      toast,
      toasts,
      signOut: async () => {
        await supabase.auth.signOut();
      },
      version,
    };
  }, [user, session, supabase, store, toasts, version, bump, toast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}
