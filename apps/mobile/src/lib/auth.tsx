import type { Session, User } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

/** Deep link, na który wraca OAuth / magic link: `nauka://auth/callback` (w Expo Go: exp://.../--/auth/callback). */
export const REDIRECT_URI = makeRedirectUri({ scheme: "nauka", path: "auth/callback" });

export interface AuthState {
  session: Session | null;
  user: User | null;
  /** true dopóki nie wiemy, czy jest sesja */
  loading: boolean;
  /** Supabase skonfigurowany? Bez env logowanie (a więc i apka) nie zadziała. */
  enabled: boolean;
  signInPassword(email: string, password: string): Promise<void>;
  signUpPassword(email: string, password: string): Promise<{ needsConfirm: boolean }>;
  signInMagicLink(email: string): Promise<void>;
  signInGoogle(): Promise<void>;
  signOut(): Promise<void>;
  /** obsługa linku zwrotnego (code → sesja; albo tokeny z fragmentu) */
  handleAuthUrl(url: string): Promise<boolean>;
  accessToken(): Promise<string | null>;
}

const Ctx = createContext<AuthState | null>(null);

function parseAuthUrl(url: string): { code?: string; access_token?: string; refresh_token?: string; error?: string; error_description?: string } {
  const out: Record<string, string> = {};
  const grab = (part: string) => {
    for (const kv of part.split("&")) {
      const [k, v] = kv.split("=");
      if (k) out[decodeURIComponent(k)] = decodeURIComponent((v ?? "").replace(/\+/g, " "));
    }
  };
  const hashIdx = url.indexOf("#");
  const qIdx = url.indexOf("?");
  if (qIdx >= 0) grab(url.slice(qIdx + 1, hashIdx >= 0 ? hashIdx : undefined));
  if (hashIdx >= 0) grab(url.slice(hashIdx + 1));
  return out;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const handled = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSession(data.session);
      })
      .finally(() => alive && setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (alive) setSession(s);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleAuthUrl = useCallback(async (url: string): Promise<boolean> => {
    if (!supabase || handled.current.has(url)) return false;
    const p = parseAuthUrl(url);
    if (p.error) throw new Error(p.error_description ?? p.error);
    if (p.code) {
      handled.current.add(url);
      const { error } = await supabase.auth.exchangeCodeForSession(p.code);
      if (error) throw error;
      return true;
    }
    if (p.access_token && p.refresh_token) {
      handled.current.add(url);
      const { error } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
      if (error) throw error;
      return true;
    }
    return false;
  }, []);

  // linki zwrotne (magic link z maila, OAuth gdy przeglądarka nie zwróci wyniku)
  const incoming = Linking.useLinkingURL();
  useEffect(() => {
    if (incoming && /auth\/callback|access_token=|code=/.test(incoming)) handleAuthUrl(incoming).catch((e) => console.warn("[auth] link", e));
  }, [incoming, handleAuthUrl]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      enabled: !!supabase,
      async signInPassword(email, password) {
        if (!supabase) throw new Error("Logowanie niedostępne — brak konfiguracji Supabase.");
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      async signUpPassword(email, password) {
        if (!supabase) throw new Error("Rejestracja niedostępna — brak konfiguracji Supabase.");
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: REDIRECT_URI } });
        if (error) throw error;
        return { needsConfirm: !data.session };
      },
      async signInMagicLink(email) {
        if (!supabase) throw new Error("Logowanie niedostępne — brak konfiguracji Supabase.");
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: REDIRECT_URI } });
        if (error) throw error;
      },
      async signInGoogle() {
        if (!supabase) throw new Error("Logowanie niedostępne — brak konfiguracji Supabase.");
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: REDIRECT_URI, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
        });
        if (error) throw error;
        if (!data.url) throw new Error("Brak URL logowania Google.");
        const res = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI, { preferEphemeralSession: false });
        if (res.type === "success" && res.url) await handleAuthUrl(res.url);
        else if (res.type === "cancel" || res.type === "dismiss") throw new Error("Logowanie anulowane.");
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
      handleAuthUrl,
      async accessToken() {
        if (!supabase) return null;
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      },
    }),
    [session, loading, handleAuthUrl],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth poza AuthProvider");
  return v;
}
