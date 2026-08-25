"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabasePublishableKey } from "./env";

// Browser Supabase client. Uses the PUBLISHABLE key (safe to ship). The session
// lives in cookies so the server client can read it on API routes.
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}
