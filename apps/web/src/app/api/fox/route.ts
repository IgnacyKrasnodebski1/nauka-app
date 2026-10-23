import { handleFoxRequest } from "@nauka/ai";
import { mediaRequestEnv } from "@/lib/media";

export const dynamic = "force-dynamic";
// synchronous: one fox turn within request start + 50 s (FOX_DEADLINE_MS)
export const maxDuration = 60;

/** POST /api/fox — one turn of „Rozmowa z lisem” (explain / quiz / exam). docs/API.md „Media i rozmowa z lisem”. */
export async function POST(req: Request) {
  const startedAt = Date.now();
  const res = await handleFoxRequest(await mediaRequestEnv(req, startedAt));
  return Response.json(res.body, { status: res.status });
}
