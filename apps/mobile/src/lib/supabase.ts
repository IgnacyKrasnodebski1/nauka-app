import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { ENV, hasSupabase } from "./env";

/**
 * Klient Supabase (anon key + RLS). `null` gdy brak env — apka działa wtedy w trybie gościa na seedach.
 * Sesja trzymana w AsyncStorage; PKCE, bo logowanie OAuth/magic link wraca deep linkiem `recall://auth/callback`.
 */
export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    })
  : null;

// Odświeżanie tokenu tylko gdy apka jest na wierzchu (zalecenie Supabase dla RN).
if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}
