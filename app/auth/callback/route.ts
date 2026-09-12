import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth return for Google account-linking (and returning-user sign-in). Exchanges
// the code for a session on the SAME anonymous user (linkIdentity keeps the id),
// then lands them on `next`. On failure (e.g. that Google email already belongs to
// another account — Supabase won't merge), fall back to the Field with a flag the
// UI can surface quietly; the anonymous session and its data are untouched.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only a same-origin path may be the landing target ("@evil.com", "//evil.com"
  // and absolute URLs would otherwise redirect off-site after a real sign-in).
  const raw = searchParams.get("next") ?? "/field";
  const next = /^\/(?![\/\\])[^@\s]*$/.test(raw) ? raw : "/field";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/field?link=error`);
}
