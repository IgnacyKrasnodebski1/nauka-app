/**
 * Wiring of the media and fox endpoints (plan-media §2): environment, auth, the service-role client, Next's `after()`,
 * the Claude client and the ElevenLabs client → the injected `MediaRequestEnv` of `@nauka/ai` (handlers.ts).
 * Nothing here reads a secret at import time, so `next build` works without any env.
 */
import { after } from "next/server";
import { anthropicMediaAi, elevenLabsTts, mediaConfig, type MediaRequestEnv } from "@nauka/ai";
import { getUserFromRequest } from "@/lib/auth";
import { hasServiceRole, hasSupabaseEnv } from "@/lib/env";
import { mediaDb } from "@/lib/media-db";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function mediaRequestEnv(req: Request, startedAt: number): Promise<MediaRequestEnv> {
  const config = mediaConfig();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  return {
    config,
    serverReady: hasSupabaseEnv() && hasServiceRole(),
    body,
    startedAt,
    authenticate: async () => {
      const ctx = await getUserFromRequest(req);
      const admin = getAdminSupabase();
      if (!ctx || !admin) return null;
      return { userId: ctx.user.id, db: mediaDb({ admin, user: ctx.supabase, userId: ctx.user.id }) };
    },
    after: (job) => after(job),
    makeAi: ({ model, meter }) => anthropicMediaAi({ model, meter }),
    tts: elevenLabsTts({ apiKey: config.elevenKey }),
  };
}
