import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CLOUD_ENABLED, DEMO_COOKIE, SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/supabase/config";

// Runs before every page request:
//  • refreshes the Supabase session cookie (so people stay signed in across refreshes);
//  • signed-out visitors: first time → the welcome introduction, afterwards → Log In;
//  • private pages are sent with no-store so Back after sign-out can't show cached content.
// This is an optimistic gate; API routes and the database verify the user again.

const PUBLIC_PREFIXES = ["/login", "/welcome", "/auth", "/demo", "/api", "/privacy"];
const INTRO_COOKIE = "st_intro";

export async function proxy(request: NextRequest) {
  if (!CLOUD_ENABLED) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;
  const path = request.nextUrl.pathname;
  const sawIntro = request.cookies.get(INTRO_COOKIE)?.value === "1";
  const isDemo = request.cookies.get(DEMO_COOKIE)?.value === "1";

  if (path === "/login" && !signedIn && !sawIntro) {
    const url = new URL("/welcome", request.url);
    const next = request.nextUrl.searchParams.get("next");
    if (next) url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  if ((path === "/login" || path === "/welcome") && signedIn && !request.nextUrl.searchParams.has("replay")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (path === "/" || PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return response;

  if (!signedIn && !isDemo) {
    const url = new URL(sawIntro ? "/login" : "/welcome", request.url);
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
