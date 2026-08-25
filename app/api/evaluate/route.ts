import { NextResponse } from "next/server";
import { createClient, requireUserId, UnauthenticatedError } from "@/lib/supabase/server";
import { getMission, missionVersion } from "@/lib/missions";
import { rowsToProfile, profileToScores } from "@/lib/progression/profile";
import { updateProfile } from "@/lib/progression/update";
import { recommendNext } from "@/lib/progression/recommend";
import { buildJudgePrompt, weightedCompetencies } from "@/lib/judge/prompt";
import type { TimelineMessage, TimelineEvent, SubmittedDeliverable } from "@/lib/judge/prompt";
import { runJudge } from "@/lib/ai/provider";
import { buildDebrief } from "@/lib/debrief/build";
import { JUDGE_PROMPT_VERSION, JUDGE_SCHEMA_VERSION } from "@/lib/judge/types";
import type { JudgeOutput } from "@/lib/judge/types";
import type { CompetencyMove } from "@/lib/progression/update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const STALE_LEASE_SECONDS = 90;

// Pull the whole session for an attempt, ID'd for the judge and the debrief.
async function loadTimeline(supabase: SupabaseServer, attemptId: string) {
  const [{ data: msgs }, { data: evts }] = await Promise.all([
    supabase
      .from("workbench_messages")
      .select("seq, role, content")
      .eq("attempt_id", attemptId)
      .order("seq", { ascending: true }),
    supabase
      .from("attempt_events")
      .select("seq, kind, detail")
      .eq("attempt_id", attemptId)
      .order("seq", { ascending: true }),
  ]);

  const messages: TimelineMessage[] = (msgs ?? []).map((m) => ({
    turnId: `msg_${String(m.seq).padStart(2, "0")}`,
    role: m.role as "user" | "ai",
    text: m.content as string,
  }));
  const events: TimelineEvent[] = (evts ?? []).map((e) => ({
    turnId: `evt_${String(e.seq).padStart(2, "0")}`,
    kind: e.kind as string,
    detail:
      typeof e.detail === "object" && e.detail
        ? (e.detail as { label?: string }).label ?? JSON.stringify(e.detail)
        : String(e.detail ?? ""),
  }));
  return { messages, events };
}

async function loadProfile(supabase: SupabaseServer, userId: string) {
  const { data } = await supabase
    .from("user_competencies")
    .select("competency, score")
    .eq("user_id", userId);
  return rowsToProfile((data ?? []) as { competency: string; score: number }[]);
}

async function completedMissionIds(supabase: SupabaseServer, userId: string) {
  const { data } = await supabase
    .from("challenge_attempts")
    .select("mission_id")
    .eq("user_id", userId)
    .eq("status", "evaluated");
  return Array.from(new Set((data ?? []).map((r) => r.mission_id as string)));
}

// Reassemble the debrief the UI renders from a (possibly already-stored) judge
// output + moves. Deterministic: recomputes profile, next mission, and the
// evidence line from current state — used for both fresh and repeat calls.
async function assembleDebrief(
  supabase: SupabaseServer,
  userId: string,
  attemptId: string,
  missionId: string,
  judge: JudgeOutput,
  moves: CompetencyMove[],
) {
  const [{ messages, events }, newProfile, completed] = await Promise.all([
    loadTimeline(supabase, attemptId),
    loadProfile(supabase, userId),
    completedMissionIds(supabase, userId),
  ]);
  const withThis = Array.from(new Set([...completed, missionId]));
  const nextMissionId = recommendNext(judge.practice_competency, withThis);
  return buildDebrief({ judge, moves, newProfile, nextMissionId, messages, events });
}

async function returnExisting(
  supabase: SupabaseServer,
  userId: string,
  attemptId: string,
  missionId: string,
) {
  const { data: evalRow } = await supabase
    .from("evaluations")
    .select("raw_evaluation, competency_results")
    .eq("attempt_id", attemptId)
    .single();
  if (!evalRow) return null;
  const judge = evalRow.raw_evaluation as JudgeOutput;
  const moves = evalRow.competency_results as CompetencyMove[];
  return assembleDebrief(supabase, userId, attemptId, missionId, judge, moves);
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

  const body = (await req.json().catch(() => ({}))) as { attemptId?: string };
  const attemptId = body.attemptId;
  if (!attemptId)
    return NextResponse.json({ error: "attemptId required" }, { status: 400 });
  console.log(`[evaluate] POST attempt=${attemptId} user=${userId}`);

  // Load the attempt (RLS ensures it's the caller's own).
  const { data: attempt } = await supabase
    .from("challenge_attempts")
    .select("id, mission_id, mission_version, status, submitted_deliverable")
    .eq("id", attemptId)
    .single();
  if (!attempt)
    return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });

  const mission = getMission(attempt.mission_id);
  if (!mission)
    return NextResponse.json({ error: "mission_not_found" }, { status: 404 });

  // Atomically claim, or find out why we can't.
  const { data: claimRows, error: claimErr } = await supabase.rpc(
    "claim_attempt_for_evaluation",
    { p_attempt_id: attemptId, p_stale_seconds: STALE_LEASE_SECONDS },
  );
  if (claimErr)
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });

  const action = (claimRows as { action: string }[] | null)?.[0]?.action;
  console.log(`[evaluate] claim action=${action} (attempt status=${attempt.status})`);

  if (action === "return_existing") {
    const debrief = await returnExisting(supabase, userId, attemptId, attempt.mission_id);
    if (!debrief)
      return NextResponse.json({ error: "evaluation_missing" }, { status: 500 });
    // deliverable + missionId let a later "review this rep" view render what was
    // submitted without a second round-trip. Harmless extra fields for the live flow.
    return NextResponse.json({
      status: "evaluated",
      debrief,
      missionId: attempt.mission_id,
      deliverable: attempt.submitted_deliverable ?? { lists: {}, tables: {} },
    });
  }
  if (action === "in_progress") {
    // A fresh lease is held elsewhere (double-click / retry) — tell the client to poll.
    return NextResponse.json({ status: "evaluating" }, { status: 202 });
  }
  if (action !== "run") {
    return NextResponse.json({ error: "not_submitted" }, { status: 409 });
  }

  // ---- We hold the lease. Run the judge. ----
  const { messages, events } = await loadTimeline(supabase, attemptId);
  const prevProfile = await loadProfile(supabase, userId);
  const deliverable = (attempt.submitted_deliverable ?? {
    lists: {},
    tables: {},
  }) as SubmittedDeliverable;

  // The operator's stated AI experience pitches the debrief TONE only — never the
  // standard (the judge is told not to lower the bar). Same standard for everyone.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("ai_usage")
    .eq("user_id", userId)
    .maybeSingle();

  const prompt = buildJudgePrompt({
    mission,
    messages,
    events,
    deliverable,
    operatorExperience: profileRow?.ai_usage ?? undefined,
  });

  let judge: JudgeOutput;
  let modelId: string;
  try {
    const t0 = Date.now();
    const result = await runJudge(prompt);
    console.log(`[evaluate] judge returned in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    judge = result.output;
    modelId = result.modelId;
    // Guard: the judge must score every competency the mission weighted.
    const need = new Set(weightedCompetencies(mission));
    for (const ev of judge.competency_evidence) need.delete(ev.competency);
    if (need.size > 0)
      throw new Error(`Judge omitted required competencies: ${[...need].join(", ")}`);
  } catch (err) {
    // Judge failed before anything was persisted — release the lease for retry.
    console.error("[evaluate] judge_failed:", err instanceof Error ? err.message : err);
    await supabase.rpc("reset_attempt_to_submitted", { p_attempt_id: attemptId });
    return NextResponse.json({ error: "judge_failed" }, { status: 502 });
  }

  // Deterministic profile update + recommendation (the LLM does neither).
  const { profile: newProfile, moves } = updateProfile(
    prevProfile,
    judge.competency_evidence,
    mission.competencyWeights,
  );
  const completed = await completedMissionIds(supabase, userId);
  const withThis = Array.from(new Set([...completed, attempt.mission_id]));
  const nextMissionId = recommendNext(judge.practice_competency, withThis);

  // Persist atomically. UNIQUE(attempt_id) is the duplicate-write backstop.
  const { error: finalizeErr } = await supabase.rpc("finalize_evaluation", {
    p_attempt_id: attemptId,
    p_raw_evaluation: judge,
    p_competency_results: moves,
    p_new_scores: profileToScores(newProfile),
    p_model_id: modelId,
    p_judge_prompt_version: JUDGE_PROMPT_VERSION,
    p_judge_schema_version: JUDGE_SCHEMA_VERSION,
  });

  if (finalizeErr) {
    console.error("[evaluate] finalize error:", finalizeErr.message);
    // Most likely a concurrent finalize won the unique(attempt_id) race — return
    // the canonical evaluation rather than erroring or double-counting.
    const debrief = await returnExisting(supabase, userId, attemptId, attempt.mission_id);
    if (debrief) return NextResponse.json({ status: "evaluated", debrief });
    return NextResponse.json({ error: "finalize_failed" }, { status: 500 });
  }
  console.log(`[evaluate] finalized attempt=${attemptId} -> evaluated`);

  const debrief = buildDebrief({
    judge,
    moves,
    newProfile,
    nextMissionId,
    messages,
    events,
  });
  return NextResponse.json({ status: "evaluated", debrief });
}
