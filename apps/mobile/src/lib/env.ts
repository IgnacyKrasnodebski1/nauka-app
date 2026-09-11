/** Publiczne zmienne środowiskowe (inlinowane przez Expo w czasie bundlowania). */
export const ENV = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, ""),
} as const;

export const hasSupabase = !!(ENV.supabaseUrl && ENV.supabaseAnonKey);
export const hasApi = !!ENV.apiUrl;
