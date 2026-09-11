import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env, hasSupabaseEnv } from "@/lib/env";

/**
 * Server-side Supabase client bound to the request cookies (Server Components, Route Handlers, Server Actions).
 * Returns null in demo mode (no env).
 */
export async function getServerSupabase(): Promise<SupabaseClient | null> {
  if (!hasSupabaseEnv()) return null;
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — cookies are refreshed by proxy.ts instead.
        }
      },
    },
  });
}
