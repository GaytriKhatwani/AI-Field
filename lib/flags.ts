// Feature flags (NEXT_PUBLIC_* → inlined, readable on client and server).
//
// Account linking (Google sign-in + in-place anonymous→permanent upgrade) is the
// highest-risk new behavior and depends on external setup (Supabase Google
// provider + manual linking, a Google OAuth client). It ships behind this flag,
// OFF by default: with the flag off, the anonymous first-mission loop is fully
// intact and every account-conversion affordance (landing "Sign in", the
// first-debrief Save moment, the Field save line) is simply hidden. Turn it on
// only once the Google setup is verified — set NEXT_PUBLIC_ENABLE_ACCOUNT_LINKING=true.
export const ACCOUNT_LINKING_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_ACCOUNT_LINKING === "true";
