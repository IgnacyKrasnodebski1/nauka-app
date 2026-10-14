import { z } from "zod";
import { GenerationOptionsSchema, PLANS, TopicContentSchema } from "@nauka/shared";
import { generateTopic, GenerationError, intakeMaterials, type IntakeFailure, type IntakeRow } from "@/lib/ai";
import { getUserFromRequest, jsonError, NO_SUPABASE } from "@/lib/auth";
import { hasServiceRole, hasSupabaseEnv } from "@/lib/env";
import { getPlan, getUsage, reserveGeneration } from "@/lib/plan";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { rowToTopic, TOPIC_SELECT, type TopicRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cap on all materials of one generation together (they are held in memory and uploaded to the Files API). */
const MAX_TOTAL_MATERIALS_MB = 150;
/** Mirrors the per-account daily cap inside `increment_usage` (backend/0004_cramfox.sql); used only by the read-only pre-check. */
const DAILY_GENERATIONS_PER_USER = 20;
/** What `increment_usage` reports (minus 1) when that daily cap is hit; Cramfox reads `used: 999999` as the daily limit. */
const DAILY_CAP_SENTINEL = 999_999;

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

type MaterialRow = IntakeRow;

const limitError = (used: number, limit: number): IntakeFailure => ({
  ok: false,
  status: 402,
  code: "limit_reached",
  message: `Wykorzystano ${used}/${limit} generacji w tym miesiącu`,
  extra: { used, limit },
});

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
    // early, cheap checks on the sizes the client declared; intake re-checks the real sizes while downloading
    const tooBig = materials.find((m) => m.size_bytes > limits.maxFileMb * 1024 * 1024);
    if (tooBig) return jsonError(`Plik „${tooBig.name ?? tooBig.id}” przekracza ${limits.maxFileMb} MB`, 400, { code: "file_too_big", name: tooBig.name ?? undefined, maxMb: limits.maxFileMb });
    const totalBytes = materials.reduce((sum, m) => sum + (Number(m.size_bytes) || 0), 0);
    if (totalBytes > MAX_TOTAL_MATERIALS_MB * 1024 * 1024)
      return jsonError(`Materiały do jednego tematu mogą mieć razem najwyżej ${MAX_TOTAL_MATERIALS_MB} MB (teraz ${Math.ceil(totalBytes / (1024 * 1024))} MB). Podziel je na kilka tematów.`, 400, { code: "too_much_material", maxMb: MAX_TOTAL_MATERIALS_MB });
  }

  // MIME allow-list → read-only quota pre-check → download (real sizes) → PPTX unpacking → text budget → charge.
  // A request that fails because of the materials themselves is never charged (see docs/API.md).
  const intake = await intakeMaterials(materials, {
    maxFileMb: limits.maxFileMb,
    maxTotalMb: MAX_TOTAL_MATERIALS_MB,
    pastedChars: mode === "materials" ? (body.text?.trim().length ?? 0) : 0,
    precheck: async () => {
      const usage = await getUsage(ctx.supabase, ctx.user.id);
      if (usage.generations >= limits.generationsPerMonth) return limitError(usage.generations, limits.generationsPerMonth);
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count } = await admin.from("generations").select("id", { count: "exact", head: true }).eq("owner_id", ctx.user.id).gt("created_at", since);
      if ((count ?? 0) >= DAILY_GENERATIONS_PER_USER) return limitError(DAILY_CAP_SENTINEL, limits.generationsPerMonth);
      return null;
    },
    download: async (m) => {
      const { data, error } = await admin.storage.from("materials").download(m.storage_path);
      if (error || !data) throw new Error(`Nie mogę pobrać „${m.name ?? m.id}”: ${error?.message ?? "brak pliku"}`);
      return new Uint8Array(await data.arrayBuffer());
    },
    // monthly quota (atomic) — the charge
    reserve: async () => {
      try {
        const r = await reserveGeneration(ctx.user.id, plan);
        return r.ok ? { ok: true as const, value: r } : limitError(r.used - 1, r.limit);
      } catch (e) {
        return { ok: false as const, status: 500, code: "reserve_failed", message: (e as Error).message };
      }
    },
  });
  if (!intake.ok) return jsonError(intake.message, intake.status, { code: intake.code, ...intake.extra });
  if (intake.stats.decks) console.info("[generate] pptx", ctx.user.id, intake.stats);

  const options = { ...body.options, mode, subjectName: body.options.subjectName ?? subject.name };
  const { data: gen, error: genErr } = await admin
    .from("generations")
    .insert({ owner_id: ctx.user.id, status: "running", stage: options.stage, hint: options.hint ?? null, options, material_ids: body.materialIds, subject_id: subject.id })
    .select("id")
    .single();
  if (genErr || !gen) return jsonError(`Nie udało się utworzyć zadania: ${genErr?.message}`, 500);
  const generationId = (gen as { id: string }).id;

  try {
    const out = await generateTopic({ materials: intake.materials, text: mode === "materials" ? body.text : undefined, options, decks: intake.stats.decks });
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
    return jsonError(msg, code === "no_input" || code === "too_long" ? 400 : 500, { code, generationId });
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
