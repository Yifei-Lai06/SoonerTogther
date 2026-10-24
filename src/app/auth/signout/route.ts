import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Ends the server-side session (auth cookies). Called by the client sign-out helper,
// and still works as a plain form POST.
export async function POST(request: NextRequest) {
  const supabase = await getServerSupabase();
  await supabase?.auth.signOut();
  const response = NextResponse.redirect(new URL("/login?signedOut=1", request.nextUrl.origin), { status: 303 });
  // Belt and braces: expire any Supabase auth cookie still present.
  for (const c of request.cookies.getAll()) {
    if (c.name.startsWith("sb-")) response.cookies.set(c.name, "", { path: "/", maxAge: 0 });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
