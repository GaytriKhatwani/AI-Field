import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Landing } from "@/components/Landing";

// Public entry gate. This route lives OUTSIDE the app/(app) group, so it never
// mounts FieldProvider and never mints an anonymous user just for a visit.
//
//   no session      → render the Landing (the anon user is created on Start)
//   session found   → skip the landing/FTUE and go straight in
//                     (onboarded → /field, otherwise resume /onboarding)
//
// Reading cookies makes this dynamic; force-dynamic keeps it from being cached.
export const dynamic = "force-dynamic";

export default async function Entry() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("user_id", user.id)
      .maybeSingle();
    redirect(profile?.onboarded ? "/field" : "/onboarding");
  }

  return <Landing />;
}
