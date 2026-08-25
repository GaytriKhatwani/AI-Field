"use client";

import { createClient } from "./client";

// Explicit anonymous-auth bootstrap (SPEC: created by the app, not in middleware).
// Signs the visitor in anonymously on first load and ensures their profile row
// exists. Idempotent — safe to call on every mount.
export async function ensureAnonymousUser() {
  const supabase = createClient();

  // getSession() is local (no network). For a returning visitor that's the whole
  // cost — we trust the local session's user client-side; RLS on the server is the
  // real guard, and middleware keeps the token fresh. This avoids a getUser()
  // round-trip and a redundant profile upsert on every load.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) return { supabase, user: session.user };

  // First visit: create the anonymous user and their profile row once.
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  const user = data.user;
  if (user) {
    await supabase
      .from("profiles")
      .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  }

  return { supabase, user };
}
