import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE } from "@/lib/supabase/config";

// Lets signed-out visitors (e.g. hackathon judges) explore the local demo.
// /demo enters it; /demo?exit=1 leaves it.
export function GET(request: NextRequest) {
  const exit = request.nextUrl.searchParams.get("exit") === "1";
  const response = NextResponse.redirect(new URL(exit ? "/login" : "/dashboard", request.nextUrl.origin));
  if (exit) response.cookies.delete(DEMO_COOKIE);
  else response.cookies.set(DEMO_COOKIE, "1", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
