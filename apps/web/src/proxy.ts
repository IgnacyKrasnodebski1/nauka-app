import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 proxy (formerly middleware): refreshes the Supabase session cookie on every request
 * so Server Components / Route Handlers see a valid session. No-op in demo mode (no env).
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Touching the user refreshes an expired access token and rewrites the cookies.
  let user = null;
  try {
    user = (await supabase.auth.getUser()).data.user;
  } catch (e) {
    console.warn("[proxy] session refresh failed", (e as Error).message);
  }
  const path = request.nextUrl.pathname;
  if (!user && (path === "/app" || path.startsWith("/app/"))) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  if (user && path === "/login") return NextResponse.redirect(new URL(request.nextUrl.searchParams.get("next") || "/app", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
