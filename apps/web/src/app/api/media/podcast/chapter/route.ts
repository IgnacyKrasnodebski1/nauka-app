import { handleChapterRequest } from "@nauka/ai";
import { mediaRequestEnv } from "@/lib/media";

export const dynamic = "force-dynamic";
// synchronous: the chapter's audio is synthesized within request start + 110 s (CHAPTER_DEADLINE_MS)
export const maxDuration = 120;

/** POST /api/media/podcast/chapter — audio of one podcast chapter (cached forever after the first time). */
export async function POST(req: Request) {
  const startedAt = Date.now();
  const res = await handleChapterRequest(await mediaRequestEnv(req, startedAt));
  return Response.json(res.body, { status: res.status });
}
