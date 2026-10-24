import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, safeNext } from "@/lib/supabase/config";
import { getServerSupabase } from "@/lib/supabase/server";

// OAuth / magic-link landing: trade the one-time code for a session cookie.
// Works on localhost, Vercel previews and production because it uses the
// request's own origin (each must be listed in Supabase → Auth → URL config).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const supabase = await getServerSupabase();

  if (!supabase || !code) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(searchParams.get("error_description") ?? "missing_code")}`, origin));
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, origin));
  }
  const response = NextResponse.redirect(new URL(next, origin));
  response.cookies.delete(DEMO_COOKIE);
  return response;
}
