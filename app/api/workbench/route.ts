import { NextResponse } from "next/server";
import { createClient, requireUserId, UnauthenticatedError } from "@/lib/supabase/server";
import { getMission, missionVersion } from "@/lib/missions";
import { streamWorkbench, type ChatTurn } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const HARD_CEILING = 12; // user messages per attempt (SPEC safety cap)
const RATE_LIMIT = 30; // messages
const RATE_WINDOW_SECONDS = 60;

type Body = {
  attemptId?: string;
  missionId: string;
  message: string;
  givenResourceIds?: string[];
};

async function nextSeq(supabase: SupabaseServer, table: string, attemptId: string) {
  const { data } = await supabase
    .from(table)
    .select("seq")
    .eq("attempt_id", attemptId)
    .order("seq", { ascending: false })
    .limit(1);
  return ((data?.[0]?.seq as number | undefined) ?? 0) + 1;
}

export async function POST(req: Request) {
  let supabase: SupabaseServer;
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
  if (!body?.missionId || !body?.message?.trim())
    return NextResponse.json({ error: "missionId and message required" }, { status: 400 });

  const mission = getMission(body.missionId);
  if (!mission) return NextResponse.json({ error: "mission_not_found" }, { status: 404 });

  const givenIds = (body.givenResourceIds ?? []).filter((id) =>
    mission.resources.some((r) => r.id === id),
  );

  // Ensure an attempt (create on first message).
  let attemptId = body.attemptId;
  if (attemptId) {
    const { data: existing } = await supabase
      .from("challenge_attempts")
      .select("id, status")
      .eq("id", attemptId)
      .single();
    if (!existing) return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
    if (existing.status !== "in_progress")
      return NextResponse.json({ error: "attempt_closed" }, { status: 409 });
  } else {
    const { data: created, error } = await supabase
      .from("challenge_attempts")
      .insert({
        user_id: userId,
        mission_id: mission.id,
        mission_version: missionVersion(mission),
        status: "in_progress",
      })
      .select("id")
      .single();
    if (error || !created)
      return NextResponse.json({ error: "attempt_create_failed" }, { status: 500 });
    attemptId = created.id as string;
  }

  // Hard ceiling on user messages (turn count never affects any score).
  const { count: userMsgCount } = await supabase
    .from("workbench_messages")
    .select("id", { count: "exact", head: true })
    .eq("attempt_id", attemptId)
    .eq("role", "user");
  if ((userMsgCount ?? 0) >= HARD_CEILING)
    return NextResponse.json({ error: "ceiling_reached" }, { status: 429 });

  // Per-user rate limit.
  const { data: allowed } = await supabase.rpc("consume_rate_limit", {
    p_bucket_key: "workbench",
    p_limit: RATE_LIMIT,
    p_window_seconds: RATE_WINDOW_SECONDS,
  });
  if (allowed === false)
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  // Record any newly-given resources as attempt_events (the Context signal).
  const { data: priorEvents } = await supabase
    .from("attempt_events")
    .select("detail")
    .eq("attempt_id", attemptId)
    .eq("kind", "attach_resource");
  const alreadyAttached = new Set(
    (priorEvents ?? []).map((e) => (e.detail as { resourceId?: string }).resourceId),
  );
  const newlyAttached = givenIds.filter((id) => !alreadyAttached.has(id));
  if (newlyAttached.length > 0) {
    let seq = await nextSeq(supabase, "attempt_events", attemptId);
    const rows = newlyAttached.map((id) => {
      const r = mission.resources.find((x) => x.id === id)!;
      return {
        attempt_id: attemptId!,
        user_id: userId,
        seq: seq++,
        kind: "attach_resource",
        detail: { resourceId: id, label: `Shared "${r.label}" with the AI` },
      };
    });
    await supabase.from("attempt_events").insert(rows);
  }

  // Load prior messages to build the conversation history.
  const { data: prior } = await supabase
    .from("workbench_messages")
    .select("seq, role, content")
    .eq("attempt_id", attemptId)
    .order("seq", { ascending: true });

  // Persist the user's message.
  const userSeq = await nextSeq(supabase, "workbench_messages", attemptId);
  await supabase.from("workbench_messages").insert({
    attempt_id: attemptId,
    user_id: userId,
    seq: userSeq,
    role: "user",
    content: body.message.trim(),
  });

  // Build history: the ONLY materials the AI sees are the ones the user gave.
  const history: ChatTurn[] = [];
  if (givenIds.length > 0) {
    const materials = givenIds
      .map((id) => {
        const r = mission.resources.find((x) => x.id === id)!;
        return `--- ${r.label} ---\n${r.content}`;
      })
      .join("\n\n");
    history.push({
      role: "user",
      text: `Here is the material I am giving you to work from. Use only this:\n\n${materials}`,
    });
  }
  for (const m of prior ?? []) {
    history.push({
      role: m.role === "user" ? "user" : "assistant",
      text: m.content as string,
    });
  }
  history.push({ role: "user", text: body.message.trim() });

  // Stream the reply; persist the full AI message when the stream closes.
  const encoder = new TextEncoder();
  const capturedAttemptId = attemptId;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const chunk of streamWorkbench(mission.workbenchSystemContext, history)) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch {
        const msg = "\n[The AI could not respond. Try again.]";
        full += msg;
        controller.enqueue(encoder.encode(msg));
      }
      const aiSeq = await nextSeq(supabase, "workbench_messages", capturedAttemptId);
      await supabase.from("workbench_messages").insert({
        attempt_id: capturedAttemptId,
        user_id: userId,
        seq: aiSeq,
        role: "ai",
        content: full,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Attempt-Id": capturedAttemptId,
    },
  });
}
