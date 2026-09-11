import { z } from "zod";
import { tutorStream } from "@/lib/ai";
import { getUserFromRequest, jsonError, NO_SUPABASE } from "@/lib/auth";
import { hasServiceRole, hasSupabaseEnv } from "@/lib/env";
import { getPlan, reserveTutorMessage } from "@/lib/plan";
import { getTopic } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({
  topicId: z.string().uuid(),
  levelId: z.string().min(1),
  question: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(20).default([]),
});

export async function POST(req: Request) {
  if (!hasSupabaseEnv() || !hasServiceRole()) return jsonError(NO_SUPABASE, 503, { code: "no_config" });
  const ctx = await getUserFromRequest(req);
  if (!ctx) return jsonError("Wymagane logowanie", 401, { code: "unauthorized" });
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return jsonError("Nieprawidłowe body", 400, { code: "bad_request" });
  }
  const topic = await getTopic(ctx.supabase, body.topicId);
  if (!topic) return jsonError("Nie znaleziono tematu", 404);

  const plan = await getPlan(ctx.supabase, ctx.user.id);
  try {
    const r = await reserveTutorMessage(ctx.user.id, plan);
    if (!r.ok) return jsonError(`Limit ${r.limit} wiadomości dziennie w planie Free. Pro = bez limitu.`, 402, { code: "limit_reached", used: r.used, limit: r.limit });
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of tutorStream({ subject: topic, levelId: body.levelId, question: body.question, history: body.history })) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n[błąd tutora: ${(e as Error).message}]`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache", "x-accel-buffering": "no" } });
}
