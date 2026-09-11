import { z } from "zod";
import { GenerationOptionsSchema, PLANS, SubjectContentSchema } from "@nauka/shared";
import { generateSubject } from "@/lib/ai";
import { getUserFromRequest, jsonError, NO_SUPABASE } from "@/lib/auth";
import { hasServiceRole, hasSupabaseEnv } from "@/lib/env";
import { countOwnSubjects, getPlan, reserveGeneration } from "@/lib/plan";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { rowToSubject, type SubjectRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BodySchema = z
  .object({
    materialIds: z.array(z.string().uuid()).max(50).default([]),
    text: z.string().max(200_000).optional(),
    options: GenerationOptionsSchema,
  })
  .refine((b) => b.materialIds.length > 0 || (b.text && b.text.trim().length > 0), { message: "Podaj materiały (materialIds) albo tekst." });

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

  const plan = await getPlan(ctx.supabase, ctx.user.id);
  const limits = PLANS[plan];
  if (body.materialIds.length > limits.filesPerGeneration) return jsonError(`Max ${limits.filesPerGeneration} plików w planie ${limits.label}`, 400, { code: "too_many_files" });
  const ownCount = await countOwnSubjects(ctx.supabase, ctx.user.id);
  if (ownCount >= limits.maxSubjects) return jsonError(`Limit ${limits.maxSubjects} przedmiotów w planie ${limits.label}. Usuń któryś albo przejdź na Pro.`, 402, { code: "limit_reached", used: ownCount, limit: limits.maxSubjects });

  // materials must belong to the caller (RLS on the user-scoped client enforces that)
  let materials: MaterialRow[] = [];
  if (body.materialIds.length) {
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

  const { data: gen, error: genErr } = await admin
    .from("generations")
    .insert({ owner_id: ctx.user.id, status: "running", stage: body.options.stage, hint: body.options.hint ?? null, options: body.options, material_ids: body.materialIds })
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
    const out = await generateSubject({ materials: files, text: body.text, options: body.options });
    const content = SubjectContentSchema.parse(out.content);
    if (out.demo && !content.tagline.includes("DEMO")) content.tagline = `DEMO · ${content.tagline}`.slice(0, 300);

    const { data: subj, error: subErr } = await admin
      .from("subjects")
      .insert({ owner_id: ctx.user.id, name: content.name, stage: body.options.stage, category: out.category, is_public: false, content, generation_id: generationId })
      .select("id,slug,owner_id,name,stage,category,is_public,content,created_at,updated_at")
      .single();
    if (subErr || !subj) throw new Error(`Zapis przedmiotu: ${subErr?.message}`);
    const row = subj as SubjectRow;

    await admin
      .from("generations")
      .update({ status: "done", subject_id: row.id, model: out.model, input_tokens: out.usage.input, output_tokens: out.usage.output, finished_at: new Date().toISOString() })
      .eq("id", generationId);

    return Response.json({ generationId, subjectId: row.id, subject: rowToSubject(row), demo: out.demo });
  } catch (e) {
    const msg = (e as Error).message || "Generowanie nie powiodło się";
    console.error("[generate] failed", generationId, msg);
    await admin.from("generations").update({ status: "failed", error: msg.slice(0, 2000), finished_at: new Date().toISOString() }).eq("id", generationId);
    // usage was already incremented — intentionally not decremented (see docs/API.md)
    return jsonError(msg, 500, { code: "generation_failed", generationId });
  }
}

export async function GET(req: Request) {
  if (!hasSupabaseEnv()) return jsonError(NO_SUPABASE, 503, { code: "no_config" });
  const ctx = await getUserFromRequest(req);
  if (!ctx) return jsonError("Wymagane logowanie", 401, { code: "unauthorized" });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError("Brak ?id", 400);
  const { data } = await ctx.supabase.from("generations").select("status,subject_id,error").eq("id", id).maybeSingle();
  if (!data) return jsonError("Nie znaleziono", 404);
  const g = data as { status: string; subject_id: string | null; error: string | null };
  return Response.json({ status: g.status, subjectId: g.subject_id ?? undefined, error: g.error ?? undefined });
}
