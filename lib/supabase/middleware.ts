import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "./env";

// Session refresh ONLY. Per SPEC, middleware never creates the anonymous user —
// it just keeps the existing session cookie fresh and propagated. The explicit
// anonymous sign-in happens in the app bootstrap (lib/supabase/bootstrap).
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  // If Supabase isn't configured yet, do nothing (app still renders).
  if (!supabaseConfigured()) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touch the session so an expired token is refreshed and the cookie rewritten.
  await supabase.auth.getUser();

  return response;
}
