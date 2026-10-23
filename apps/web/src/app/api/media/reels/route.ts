import { handleReelsRequest } from "@nauka/ai";
import { mediaRequestEnv } from "@/lib/media";

export const dynamic = "force-dynamic";
// The answer (202) leaves in a few seconds; the series is written in `after()`, bounded by request start + 270 s
// (REEL_DEADLINE_MS), so the job ends before Vercel's 300 s. A job killed anyway is refunded by the sweeper (8 min).
export const maxDuration = 300;

/** POST /api/media/reels — a reel series (or one reel) of a material. docs/API.md „Media i rozmowa z lisem”. */
export async function POST(req: Request) {
  const startedAt = Date.now();
  const res = await handleReelsRequest(await mediaRequestEnv(req, startedAt));
  return Response.json(res.body, { status: res.status });
}
