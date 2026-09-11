import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { env, hasSupabaseEnv } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase/server";

export interface AuthContext {
  user: User;
  /** user-scoped client (RLS applies) */
  supabase: SupabaseClient;
  accessToken: string | null;
}

/**
 * Resolves the caller: `Authorization: Bearer <access_token>` (mobile / fetch from the web app)
 * or the cookie session (@supabase/ssr). Returns null when unauthenticated or in demo mode.
 */
export async function getUserFromRequest(req: Request): Promise<AuthContext | null> {
  if (!hasSupabaseEnv()) return null;
  const header = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (m && m[1]) {
    const token = m[1].trim();
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { user: data.user, supabase, accessToken: token };
  }
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: sess } = await supabase.auth.getSession();
  return { user: data.user, supabase, accessToken: sess.session?.access_token ?? null };
}

export function jsonError(error: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status });
}

export const NO_SUPABASE = "Brak konfiguracji Supabase";
