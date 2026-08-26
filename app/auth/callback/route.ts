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
  const next = searchParams.get("next") ?? "/field";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/field?link=error`);
}
