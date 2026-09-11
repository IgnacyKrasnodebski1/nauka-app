import { z } from "zod";
import { GenerationOptionsSchema, PLANS, TopicContentSchema } from "@nauka/shared";
import { generateTopic, GenerationError } from "@/lib/ai";
import { getUserFromRequest, jsonError, NO_SUPABASE } from "@/lib/auth";
import { hasServiceRole, hasSupabaseEnv } from "@/lib/env";
import { getPlan, reserveGeneration } from "@/lib/plan";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { rowToTopic, TOPIC_SELECT, type TopicRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BodySchema = z
  .object({
    subjectId: z.string().uuid(),
    materialIds: z.array(z.string().uuid()).max(50).default([]),
    text: z.string().max(200_000).optional(),
    options: GenerationOptionsSchema,
  })
  .superRefine((b, ctx) => {
    const mode = b.options.mode ?? "materials";
    if (mode === "materials" && !b.materialIds.length && !b.text?.trim()) ctx.addIssue({ code: "custom", message: "Tryb „materials” wymaga plików (materialIds) albo tekstu." });
    if (mode === "prompt" && !b.options.hint?.trim()) ctx.addIssue({ code: "custom", message: "Tryb „prompt” wymaga options.hint (temat)." });
  });

interface MaterialRow {
  id: string;
  storage_path: string;
  mime: string;
  size_bytes: number;
  name: string | null;
}

export async function POST(req: Request) {
  if (!hasSupabaseEnv()) return jsonError(NO_SUPABASE, 503, { code: "no_config" });
  if (!hasServiceRole()) return jsonError("Brak SUPABASE_SERVICE_ROLE_KEY po stronie serwera", 503, { code: "no_config" });
  const ctx = await getUserFromRequest(req);
  if (!ctx) return jsonError("Wymagane logowanie", 401, { code: "unauthorized" });
  const admin = getAdminSupabase()!;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return jsonError(e instanceof z.ZodError ? e.issues.map((i) => i.message).join("; ") : "Nieprawidłowe body", 400, { code: "bad_request" });
  }
  const mode = body.options.mode ?? "materials";

  // subject must belong to the caller
  const { data: subj } = await ctx.supabase.from("subjects").select("id,name,stage,owner_id").eq("id", body.subjectId).maybeSingle();
  const subject = subj as { id: string; name: string; stage: string; owner_id: string } | null;
  if (!subject || subject.owner_id !== ctx.user.id) return jsonError("Nie znaleziono przedmiotu", 404, { code: "not_found" });

  const plan = await getPlan(ctx.supabase, ctx.user.id);
  const limits = PLANS[plan];
  if (body.materialIds.length > limits.filesPerGeneration) return jsonError(`Max ${limits.filesPerGeneration} plików w planie ${limits.label}`, 400, { code: "too_many_files" });

  // materials must belong to the caller (RLS on the user-scoped client enforces that)
  let materials: MaterialRow[] = [];
  if (mode === "materials" && body.materialIds.length) {
    const { data, error } = await ctx.supabase.from("materials").select("id,storage_path,mime,size_bytes,name").in("id", body.materialIds);
    if (error) return jsonError(error.message, 500);
    materials = (data ?? []) as MaterialRow[];
    if (materials.length !== body.materialIds.length) return jsonError("Część materiałów nie istnieje albo nie należy do Ciebie", 400, { code: "bad_materials" });
    const tooBig = materials.find((m) => m.size_bytes > limits.maxFileMb * 1024 * 1024);
    if (tooBig) return jsonError(`Plik „${tooBig.name ?? tooBig.id}” przekracza ${limits.maxFileMb} MB`, 400, { code: "file_too_big" });
  }

  // monthly quota (atomic)
  let reserved: Awaited<ReturnType<typeof reserveGeneration>>;
  try {
    reserved = await reserveGeneration(ctx.user.id, plan);
  } catch (e) {
    return jsonError((e as Error).message, 500);
  }
  if (!reserved.ok) return jsonError(`Wykorzystano ${reserved.used - 1}/${reserved.limit} generacji w tym miesiącu`, 402, { code: "limit_reached", used: reserved.used - 1, limit: reserved.limit });

  const options = { ...body.options, mode, subjectName: body.options.subjectName ?? subject.name };
  const { data: gen, error: genErr } = await admin
    .from("generations")
    .insert({ owner_id: ctx.user.id, status: "running", stage: options.stage, hint: options.hint ?? null, options, material_ids: body.materialIds, subject_id: subject.id })
    .select("id")
    .single();
  if (genErr || !gen) return jsonError(`Nie udało się utworzyć zadania: ${genErr?.message}`, 500);
  const generationId = (gen as { id: string }).id;

  try {
    const files = await Promise.all(
      materials.map(async (m) => {
        const { data, error } = await admin.storage.from("materials").download(m.storage_path);
        if (error || !data) throw new Error(`Nie mogę pobrać „${m.name ?? m.id}”: ${error?.message ?? "brak pliku"}`);
        return { mime: m.mime, data: Buffer.from(await data.arrayBuffer()), name: m.name ?? undefined };
      }),
    );
    const out = await generateTopic({ materials: files, text: mode === "materials" ? body.text : undefined, options });
    const content = TopicContentSchema.parse(out.content);
    if (out.demo && !content.tagline.includes("DEMO")) content.tagline = `DEMO · ${content.tagline}`.slice(0, 300);

    const { count } = await admin.from("topics").select("id", { count: "exact", head: true }).eq("subject_id", subject.id);
    const { data: row, error: topErr } = await admin
      .from("topics")
      .insert({ subject_id: subject.id, owner_id: ctx.user.id, name: content.name, emoji: content.emoji, source: mode, content, generation_id: generationId, position: count ?? 0 })
      .select(TOPIC_SELECT)
      .single();
    if (topErr || !row) throw new Error(`Zapis tematu: ${topErr?.message}`);
    const topic = rowToTopic(row as TopicRow);

    await admin
      .from("generations")
      .update({ status: "done", topic_id: topic.id, model: out.model, input_tokens: out.usage.input, output_tokens: out.usage.output, finished_at: new Date().toISOString() })
      .eq("id", generationId);

    return Response.json({ generationId, topicId: topic.id, topic, demo: out.demo });
  } catch (e) {
    const msg = (e as Error).message || "Generowanie nie powiodło się";
    const code = e instanceof GenerationError ? e.code : "generation_failed";
    console.error("[generate] failed", generationId, msg);
    await admin.from("generations").update({ status: "failed", error: msg.slice(0, 2000), finished_at: new Date().toISOString() }).eq("id", generationId);
    // usage was already incremented — intentionally not decremented (see docs/API.md)
    return jsonError(msg, code === "no_input" ? 400 : 500, { code, generationId });
  }
}

export async function GET(req: Request) {
  if (!hasSupabaseEnv()) return jsonError(NO_SUPABASE, 503, { code: "no_config" });
  const ctx = await getUserFromRequest(req);
  if (!ctx) return jsonError("Wymagane logowanie", 401, { code: "unauthorized" });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError("Brak ?id", 400);
  const { data } = await ctx.supabase.from("generations").select("status,topic_id,error").eq("id", id).maybeSingle();
  if (!data) return jsonError("Nie znaleziono", 404);
  const g = data as { status: string; topic_id: string | null; error: string | null };
  return Response.json({ status: g.status, topicId: g.topic_id ?? undefined, error: g.error ?? undefined });
}
