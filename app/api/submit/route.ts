import { NextResponse } from "next/server";
import { createClient, requireUserId, UnauthenticatedError } from "@/lib/supabase/server";
import { getMission, missionVersion, type Mission } from "@/lib/missions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Deliverable = {
  lists: Record<string, string[]>;
  tables: Record<string, Record<string, string>[]>;
};

type Body = {
  attemptId?: string;
  missionId?: string;
  deliverable: Deliverable;
};

// The deliverable goes straight into the judge prompt, so it must be the shape
// this mission's template defines (the client only ever sends that) and small
// enough that the judge can actually read it.
const MAX_CELL_CHARS = 4000;
const MAX_ITEMS_PER_FIELD = 100;
const MAX_DELIVERABLE_BYTES = 64_000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateDeliverable(raw: unknown, mission: Mission): Deliverable | null {
  if (!isRecord(raw)) return null;
  const listsRaw = raw.lists ?? {};
  const tablesRaw = raw.tables ?? {};
  if (!isRecord(listsRaw) || !isRecord(tablesRaw)) return null;

  const lists: Deliverable["lists"] = {};
  for (const [id, items] of Object.entries(listsRaw)) {
    const field = mission.deliverable.fields.find((f) => f.id === id && f.kind === "list");
    if (!field || !Array.isArray(items) || items.length > MAX_ITEMS_PER_FIELD) return null;
    if (!items.every((it) => typeof it === "string" && it.length <= MAX_CELL_CHARS)) return null;
    lists[id] = items as string[];
  }

  const tables: Deliverable["tables"] = {};
  for (const [id, rows] of Object.entries(tablesRaw)) {
    const field = mission.deliverable.fields.find((f) => f.id === id && f.kind === "table");
    if (!field || field.kind !== "table") return null;
    if (!Array.isArray(rows) || rows.length > MAX_ITEMS_PER_FIELD) return null;
    const columnIds = new Set(field.columns.map((c) => c.id));
    const out: Record<string, string>[] = [];
    for (const row of rows) {
      if (!isRecord(row)) return null;
      const cells: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!columnIds.has(k) || typeof v !== "string" || v.length > MAX_CELL_CHARS) return null;
        cells[k] = v;
      }
      out.push(cells);
    }
    tables[id] = out;
  }

  const clean = { lists, tables };
  if (JSON.stringify(clean).length > MAX_DELIVERABLE_BYTES) return null;
  return clean;
}

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

  const body = (await req.json().catch(() => null)) as Partial<Body> | null;
  if (!body?.deliverable)
    return NextResponse.json({ error: "deliverable required" }, { status: 400 });

  // Resolve the attempt: use the given one, or create it (covers a deliverable
  // built without ever chatting to the AI — a fair, if empty, session to judge).
  // null/undefined = no attempt yet (a no-chat submit sends null).
  if (body.attemptId != null && typeof body.attemptId !== "string")
    return NextResponse.json({ error: "attemptId must be a string" }, { status: 400 });
  let attemptId = body.attemptId ?? undefined;
  type AttemptRow = { id: string; status: string; mission_id: string };
  let attempt: AttemptRow | null = null;
  if (attemptId) {
    const { data } = await supabase
      .from("challenge_attempts")
      .select("id, status, mission_id")
      .eq("id", attemptId)
      .single();
    attempt = (data as AttemptRow | null) ?? null;
    if (!attempt) return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
  } else {
    const mission = typeof body.missionId === "string" ? getMission(body.missionId) : undefined;
    if (!mission)
      return NextResponse.json({ error: "attemptId or missionId required" }, { status: 400 });
    // Validate before creating anything so a bad payload leaves no orphan attempt.
    if (!validateDeliverable(body.deliverable, mission))
      return NextResponse.json({ error: "invalid_deliverable" }, { status: 400 });
    // Reuse an open attempt on this mission before creating one, so a double
    // submit from a no-chat session doesn't create two attempts.
    const { data: open } = await supabase
      .from("challenge_attempts")
      .select("id, status, mission_id")
      .eq("mission_id", mission.id)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1);
    if (open?.[0]) {
      attempt = open[0] as AttemptRow;
    } else {
      const { data: created, error } = await supabase
        .from("challenge_attempts")
        .insert({
          user_id: userId,
          mission_id: mission.id,
          mission_version: missionVersion(mission),
          status: "in_progress",
        })
        .select("id, status, mission_id")
        .single();
      if (error || !created)
        return NextResponse.json({ error: "attempt_create_failed" }, { status: 500 });
      attempt = created as AttemptRow;
    }
    attemptId = attempt!.id;
  }

  // Idempotent: only an in-progress attempt can be submitted. A re-submit of an
  // already-submitted/evaluating/evaluated attempt is a no-op success.
  if (attempt!.status !== "in_progress")
    return NextResponse.json({ status: attempt!.status, attemptId: attempt!.id });

  const mission = getMission(attempt!.mission_id);
  if (!mission) return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
  const deliverable = validateDeliverable(body.deliverable, mission);
  if (!deliverable)
    return NextResponse.json({ error: "invalid_deliverable" }, { status: 400 });

  const { error } = await supabase
    .from("challenge_attempts")
    .update({
      submitted_deliverable: deliverable,
      submitted_at: new Date().toISOString(),
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .eq("user_id", userId)
    .eq("status", "in_progress");
  if (error) return NextResponse.json({ error: "submit_failed" }, { status: 500 });

  return NextResponse.json({ status: "submitted", attemptId });
}
