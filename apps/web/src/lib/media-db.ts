/**
 * Database and Storage access of the media and fox endpoints (backend/0010). SERVER ONLY.
 * Ownership checks go through the user-scoped client (RLS); every write and every RPC through the service role.
 * A missing RPC / table (database without 0010) throws RpcMissingError → 503 `media_unavailable`.
 */
import { RpcMissingError, type ChapterClaim, type MediaDb, type MediaReject, type MediaStats, type ReserveChatResult, type ReserveMediaResult } from "@nauka/ai";
import { MEDIA_BUCKET, MEDIA_COLUMNS, monthKey, parseChatQuota, type ChatQuota, type MediaKind, type MediaRow, type PodcastChapter } from "@nauka/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

/** `p_pro_limit` of reserve_media / media_quota when app_config has no `pro_media_month` (owner decision: 30 a month). */
export const PRO_MEDIA_MONTH = 30;

type PgError = { code?: string; message: string } | null;

/** PGRST202 / PGRST205: function / table not in PostgREST's schema cache; 42883 / 42P01: undefined function / table. */
function dbError(what: string, error: NonNullable<PgError>): Error {
  const missing = ["PGRST202", "PGRST205", "42883", "42P01"].includes(error.code ?? "") || /could not find the (function|table)|does not exist/i.test(error.message);
  return missing ? new RpcMissingError(`${what}: ${error.message}`) : new Error(`${what}: ${error.message}`);
}

const REJECTS: readonly string[] = ["busy", "lifetime", "month", "daily", "global", "conflict", "not_found"] satisfies MediaReject[];
const CLAIMS: readonly string[] = ["claimed", "ready", "busy", "not_found", "not_ready", "failing"] satisfies ChapterClaim[];

const toBuffer = (body: Uint8Array | string) => (typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body.buffer, body.byteOffset, body.byteLength));

export async function mediaQuotaRpc(admin: SupabaseClient, userId: string): Promise<unknown> {
  const { data, error } = await admin.rpc("media_quota", { p_user: userId, p_month: monthKey(), p_pro_limit: PRO_MEDIA_MONTH });
  if (error) throw dbError("media_quota", error);
  return data;
}

export async function chatQuotaRpc(admin: SupabaseClient, userId: string): Promise<unknown> {
  const { data, error } = await admin.rpc("chat_quota", { p_user: userId });
  if (error) throw dbError("chat_quota", error);
  return data;
}

export function mediaDb(a: { admin: SupabaseClient; user: SupabaseClient; userId: string }): MediaDb {
  const { admin, user, userId } = a;
  const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await admin.rpc(name, args);
    if (error) throw dbError(name, error);
    return data as T;
  };
  const storage = () => admin.storage.from(MEDIA_BUCKET);
  const stats = (s: MediaStats) => ({ model: s.model, cost_usd: s.cost_usd, tts_chars: s.tts_chars, tts_logged: s.tts_logged });

  return {
    async findMedia(id) {
      const { data, error } = await admin.from("media").select(MEDIA_COLUMNS).eq("id", id).maybeSingle();
      if (error) throw dbError("media read", error);
      return (data as MediaRow | null) ?? null;
    },

    async loadTopic(topicId) {
      const { data: t, error } = await user.from("topics").select("id,subject_id,name,content").eq("id", topicId).maybeSingle();
      if (error) throw dbError("topic read", error);
      const topic = t as { id: string; subject_id: string; name: string; content: unknown } | null;
      if (!topic) return null;
      const { data: s, error: se } = await user.from("subjects").select("id,stage").eq("id", topic.subject_id).maybeSingle();
      if (se) throw dbError("subject read", se);
      const subject = s as { id: string; stage: string } | null;
      if (!subject) return null;
      return { id: topic.id, subjectId: subject.id, name: topic.name, stage: subject.stage, content: topic.content };
    },

    async reserve(r): Promise<ReserveMediaResult> {
      const data = await rpc<Record<string, unknown> | null>("reserve_media", {
        p_id: r.id,
        p_user: userId,
        p_subject: r.subjectId,
        p_topic: r.topicId,
        p_kind: r.kind,
        p_spec: { ...r.spec, progress: r.progress },
        p_month: monthKey(),
        p_pro_limit: PRO_MEDIA_MONTH,
      });
      if (data?.ok === true && data.media && typeof data.media === "object") return { ok: true, media: data.media as MediaRow, existing: data.existing === true };
      if (data?.ok === false && typeof data.reason === "string" && REJECTS.includes(data.reason)) {
        const num = (v: unknown) => (typeof v === "number" ? v : undefined);
        const b = data.busy as { id?: unknown; kind?: unknown; topicId?: unknown } | null | undefined;
        // topicId is null when the running creation's material was deleted (the reservation still holds, backend/0010)
        const busy =
          b && typeof b.id === "string" && (b.kind === "reels" || b.kind === "podcast")
            ? { id: b.id, kind: b.kind as MediaKind, topicId: typeof b.topicId === "string" ? b.topicId : null }
            : null;
        return { ok: false, reason: data.reason as MediaReject, busy, used: num(data.used), limit: num(data.limit) };
      }
      throw new Error(`reserve_media: unexpected answer ${JSON.stringify(data)}`);
    },

    async progress(id, p) {
      const { error } = await admin.from("media").update({ progress: p, phase: p.step }).eq("id", id).eq("status", "running");
      if (error) throw dbError("media progress", error);
    },

    async finish(id, manifest, s) {
      const data = await rpc<{ ok?: boolean; reason?: string } | null>("finish_media", { p_id: id, p_manifest: manifest, p_stats: stats(s) });
      if (data?.ok !== true) console.warn("[media] finish_media refused", id, data?.reason);
      return data?.ok === true;
    },

    async release(id, reason, s) {
      const data = await rpc<{ ok?: boolean; reason?: string } | null>("release_media", { p_id: id, p_reason: reason.slice(0, 200), p_stats: stats(s) });
      if (data?.ok !== true) console.warn("[media] release_media refused", id, data?.reason);
      return data?.ok === true;
    },

    async fail(id, reason, s) {
      await rpc("fail_media", { p_id: id, p_reason: reason.slice(0, 220), p_stats: stats(s) });
    },

    async upload(path, body, contentType) {
      const { error } = await storage().upload(path, toBuffer(body), { contentType, upsert: true });
      if (error) throw new Error(`storage upload ${path}: ${error.message}`);
    },

    async download(path) {
      const { data, error } = await storage().download(path);
      if (error || !data) throw new Error(`storage download ${path}: ${error?.message ?? "no file"}`);
      return new Uint8Array(await data.arrayBuffer());
    },

    async remove(paths) {
      if (!paths.length) return;
      const { error } = await storage().remove(paths);
      if (error) throw new Error(`storage remove: ${error.message}`);
    },

    async claimChapter(mediaId, n) {
      const data = await rpc<string>("claim_podcast_chapter", { p_media: mediaId, p_user: userId, p_n: n });
      if (typeof data !== "string" || !CLAIMS.includes(data)) throw new Error(`claim_podcast_chapter: unexpected answer ${JSON.stringify(data)}`);
      return data as ChapterClaim;
    },

    async setChapter(mediaId, n, patch) {
      return (await rpc<PodcastChapter | null>("set_podcast_chapter", { p_media: mediaId, p_n: n, p_patch: patch })) ?? null;
    },

    async releaseChapter(mediaId, n, failed) {
      await rpc("release_podcast_chapter", { p_media: mediaId, p_n: n, p_failed: failed });
    },

    async ttsBudget(chars, mediaId, kind) {
      return (await rpc<boolean>("tts_budget", { p_chars: chars, p_media: mediaId, p_kind: kind })) === true;
    },

    async ttsRefund(chars, mediaId, kind) {
      await rpc("tts_refund", { p_chars: chars, p_media: mediaId, p_kind: kind });
    },

    async loadSubjectTopics(subjectId, topicIds) {
      const { data: s, error } = await user.from("subjects").select("id,stage").eq("id", subjectId).maybeSingle();
      if (error) throw dbError("subject read", error);
      if (!s) return null;
      const { data: rows, error: te } = await user.from("topics").select("id,name,content").eq("subject_id", subjectId).in("id", topicIds);
      if (te) throw dbError("topics read", te);
      const topics = (rows ?? []) as { id: string; name: string; content: unknown }[];
      if (topics.length !== new Set(topicIds.map((t) => t.toLowerCase())).size) return null;
      return { stage: (s as { stage: string }).stage, topics };
    },

    async reserveChat(): Promise<ReserveChatResult> {
      const data = await rpc<Record<string, unknown> | null>("reserve_chat", { p_user: userId });
      if (data?.ok === true) {
        const quota = parseChatQuota(data);
        if (quota) return { ok: true, quota };
      }
      if (data?.ok === false && (data.reason === "chat_daily" || data.reason === "chat_global"))
        return { ok: false, reason: data.reason, used: Number(data.used) || 0, limit: Number(data.limit) || 0 };
      throw new Error(`reserve_chat: unexpected answer ${JSON.stringify(data)}`);
    },

    async releaseChat(day) {
      await rpc("release_chat", { p_user: userId, p_day: day });
    },

    async chatQuota(): Promise<ChatQuota | null> {
      return parseChatQuota(await chatQuotaRpc(admin, userId));
    },
  };
}
