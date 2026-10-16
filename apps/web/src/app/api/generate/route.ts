import { z } from "zod";
import { GenerationOptionsSchema, PLANS } from "@nauka/shared";
import { handleGenerationRequest, reserveRejection, type IntakeRow } from "@/lib/ai";
import { getUserFromRequest, jsonError, NO_SUPABASE } from "@/lib/auth";
import { hasServiceRole, hasSupabaseEnv } from "@/lib/env";
import { failGeneration, findFinishedTopic, finishGeneration, getGenerationQuota, getPlan, hasActiveGeneration, releaseGeneration, reserveGenerationSlot } from "@/lib/plan";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { rowToTopic } from "@/lib/types";

export const dynamic = "force-dynamic";
// Vercel kills the function at 300 s; @nauka/ai aborts every AI request at request start + 270 s (GENERATION_DEADLINE_MS),
// so a slow generation still ends with a JSON answer and a `failed` row instead of a 504 and a row stuck in `running`.
export const maxDuration = 300;

/** Cap on all materials of one generation together (they are held in memory and uploaded to the Files API). */
const MAX_TOTAL_MATERIALS_MB = 150;
/** Mirrors the per-account daily cap inside `reserve_generation` (backend/0007); used only by the read-only pre-check. */
const DAILY_GENERATIONS_PER_USER = 20;
/**
 * `p_monthly_limit` for `reserve_generation` / `generation_quota`: the RPCs read the account's plan from `profiles.plan`
 * themselves and apply this only on the pro plan (free ignores it — its limit is for life, from `app_config`). Always the
 * pro value, so a failed profile read here (`getPlan` → "free") never gives a pro / trial account the free plan's 2 a month.
 */
const PRO_MONTHLY_LIMIT = PLANS.pro.generationsPerMonth;

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

export async function POST(req: Request) {
  const startedAt = Date.now();
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
    if (error) {
      console.error("[generate] materials query failed", error.message);
      return jsonError("Nie udało się odczytać materiałów. Limit się nie zmienił — spróbuj ponownie za chwilę.", 500, { code: "download_failed" });
    }
    materials = (data ?? []) as MaterialRow[];
    if (materials.length !== body.materialIds.length) return jsonError("Część materiałów nie istnieje albo nie należy do Ciebie", 400, { code: "bad_materials" });
    // early, cheap checks on the sizes the client declared; intake re-checks the real sizes while downloading
    const tooBig = materials.find((m) => m.size_bytes > limits.maxFileMb * 1024 * 1024);
    if (tooBig) return jsonError(`Plik „${tooBig.name ?? tooBig.id}” przekracza ${limits.maxFileMb} MB`, 400, { code: "file_too_big", name: tooBig.name ?? undefined, maxMb: limits.maxFileMb });
    const totalBytes = materials.reduce((sum, m) => sum + (Number(m.size_bytes) || 0), 0);
    if (totalBytes > MAX_TOTAL_MATERIALS_MB * 1024 * 1024)
      return jsonError(`Materiały do jednego tematu mogą mieć razem najwyżej ${MAX_TOTAL_MATERIALS_MB} MB (teraz ${Math.ceil(totalBytes / (1024 * 1024))} MB). Podziel je na kilka tematów.`, 400, { code: "too_much_material", maxMb: MAX_TOTAL_MATERIALS_MB });
  }

  // MIME allow-list → read-only quota pre-check → download (real sizes) → PPTX unpacking → text budget → Files API
  // upload + token count → charge (one transaction) → AI (deadline: start + 270 s) → topic + `done` (one transaction).
  // A request that fails before the charge is never charged; `ai_unavailable` before any AI output is refunded (docs/API.md).
  const res = await handleGenerationRequest({
    rows: materials,
    text: body.text,
    options: { ...body.options, mode, subjectName: body.options.subjectName ?? subject.name },
    startedAt,
    maxFileMb: limits.maxFileMb,
    maxTotalMb: MAX_TOTAL_MATERIALS_MB,
    monthlyLimit: limits.generationsPerMonth,
    precheck: async () => {
      // plan limit (free: generations for life of the e-mail address, pro: this month) — the same RPC logic as the charge
      try {
        const q = await getGenerationQuota(admin, ctx.user.id, PRO_MONTHLY_LIMIT);
        if (q.used >= q.limit) return reserveRejection({ reason: q.scope === "lifetime" ? "lifetime" : "monthly", used: q.used, limit: q.limit }, limits.generationsPerMonth);
      } catch (e) {
        // only an early exit: reserve_generation checks the same limit in its transaction
        console.warn("[generate] quota pre-check skipped:", (e as Error)?.message ?? e);
      }
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count } = await admin.from("generations").select("id", { count: "exact", head: true }).eq("owner_id", ctx.user.id).gt("created_at", since);
      if ((count ?? 0) >= DAILY_GENERATIONS_PER_USER) return reserveRejection({ reason: "daily" }, limits.generationsPerMonth);
      if (await hasActiveGeneration(admin, ctx.user.id)) return reserveRejection({ reason: "busy" }, limits.generationsPerMonth);
      return null;
    },
    download: async (m) => {
      const { data, error } = await admin.storage.from("materials").download(m.storage_path);
      if (error || !data) throw new Error(`Nie mogę pobrać „${m.name ?? m.id}”: ${error?.message ?? "brak pliku"}`);
      return new Uint8Array(await data.arrayBuffer());
    },
    reserve: (options) =>
      reserveGenerationSlot(admin, {
        userId: ctx.user.id,
        monthlyLimit: PRO_MONTHLY_LIMIT,
        subjectId: subject.id,
        stage: options.stage,
        hint: options.hint ?? null,
        options,
        materialIds: body.materialIds,
      }),
    finish: async (generationId, out) => {
      const row = await finishGeneration(admin, generationId, out);
      return { topicId: row.id, topic: rowToTopic(row) };
    },
    fail: (generationId, info) => failGeneration(admin, generationId, info),
    // the AI unavailable on our side before any output (key, permissions, billing, 429, 529, 5xx, network): the attempt
    // is given back in one transaction (backend/0009) and the answer says `charged: false`
    release: (generationId, reason) => releaseGeneration(admin, generationId, reason),
    // finish_generation committed but its reply was lost (network): the lesson exists and is paid — answer it, do not report a failure
    lookup: async (generationId) => {
      const row = await findFinishedTopic(admin, generationId);
      return row ? { topicId: row.id, topic: rowToTopic(row) } : null;
    },
  });
  return Response.json(res.body, { status: res.status });
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
