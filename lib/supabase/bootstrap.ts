"use client";

import { createClient } from "./client";

// Explicit anonymous-auth bootstrap (SPEC: created by the app, not in middleware).
// Signs the visitor in anonymously on first load and ensures their profile row
// exists. Idempotent — safe to call on every mount.
export async function ensureAnonymousUser() {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    // Create the profile row once; ignore if it already exists.
    await supabase
      .from("profiles")
      .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  }

  return { supabase, user };
}
