import { handlePodcastRequest } from "@nauka/ai";
import { mediaRequestEnv } from "@/lib/media";

export const dynamic = "force-dynamic";
// 202 right away; the script is written in `after()` (request start + 270 s). Audio is made per chapter on demand.
export const maxDuration = 300;

/** POST /api/media/podcast — the Lis + Szop podcast script of a material. docs/API.md „Media i rozmowa z lisem”. */
export async function POST(req: Request) {
  const startedAt = Date.now();
  const res = await handlePodcastRequest(await mediaRequestEnv(req, startedAt));
  return Response.json(res.body, { status: res.status });
}
