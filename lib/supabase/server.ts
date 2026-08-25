import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseUrl, supabasePublishableKey } from "./env";

// Server Supabase client, bound to the request's cookies so it acts AS the
// signed-in (anonymous) user — RLS therefore applies to everything the API
// routes do. Uses the publishable key; the secret key is never needed here
// because every row is the caller's own.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — safe to ignore; middleware
          // refreshes the session cookie on the next request.
        }
      },
    },
  });
}

/** Resolve the current user's id or throw 401-worthy error. Routes call this first. */
export async function requireUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthenticatedError();
  return user.id;
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("No authenticated user.");
    this.name = "UnauthenticatedError";
  }
}
