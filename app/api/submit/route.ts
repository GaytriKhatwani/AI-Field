import { NextResponse } from "next/server";
import { createClient, requireUserId, UnauthenticatedError } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  attemptId: string;
  deliverable: {
    lists: Record<string, string[]>;
    tables: Record<string, Record<string, string>[]>;
  };
};

// Finalise the deliverable and move the attempt to 'submitted', ready for
// /api/evaluate. Submitting is the operator's decision (SPEC user story 27).
export async function POST(req: Request) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  try {
    supabase = await createClient();
    userId = await requireUserId(supabase);
  } catch (e) {
    if (e instanceof UnauthenticatedError)
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.attemptId || !body?.deliverable)
    return NextResponse.json({ error: "attemptId and deliverable required" }, { status: 400 });

  const { data: attempt } = await supabase
    .from("challenge_attempts")
    .select("id, status")
    .eq("id", body.attemptId)
    .single();
  if (!attempt) return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });

  // Idempotent: only an in-progress attempt can be submitted. A re-submit of an
  // already-submitted/evaluating/evaluated attempt is a no-op success.
  if (attempt.status !== "in_progress")
    return NextResponse.json({ status: attempt.status, attemptId: attempt.id });

  const { error } = await supabase
    .from("challenge_attempts")
    .update({
      submitted_deliverable: body.deliverable,
      submitted_at: new Date().toISOString(),
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.attemptId)
    .eq("user_id", userId)
    .eq("status", "in_progress");
  if (error) return NextResponse.json({ error: "submit_failed" }, { status: 500 });

  return NextResponse.json({ status: "submitted", attemptId: body.attemptId });
}
