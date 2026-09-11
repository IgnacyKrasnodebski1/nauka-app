import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/** OAuth / magic-link callback: exchanges `code` for a session cookie and redirects to `next`. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextPath = url.searchParams.get("next") || "/app";
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/app";
  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.redirect(new URL("/login?error=config", url.origin));
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
}
