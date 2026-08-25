import type { Profile } from "../competencies";
import type { JudgeOutput } from "../judge/types";
import type { CompetencyMove } from "../progression/update";
import type { TimelineMessage, TimelineEvent } from "../judge/prompt";
import type { Debrief, EvidenceMoment } from "./types";

// Turns the judge's output + the deterministic moves into the debrief the UI
// renders. The "session line" is grounded in real turns: each scored competency
// contributes one moment, resolved from the judge's evidence_turn_ids back to the
// actual turn text — never invented.

const GOOD_BANDS = new Set(["proficient", "strong"]);
const GAP_BANDS = new Set(["not_shown", "emerging"]);

function truncate(s: string, n = 160): string {
  const t = s.trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

export function buildDebrief(args: {
  judge: JudgeOutput;
  moves: CompetencyMove[];
  newProfile: Profile;
  nextMissionId: string;
  messages: TimelineMessage[];
  events: TimelineEvent[];
}): Debrief {
  const { judge, moves, newProfile, nextMissionId, messages, events } = args;

  const turnText = new Map<string, { who: "you" | "the AI"; text: string }>();
  for (const e of events)
    turnText.set(e.turnId, { who: "you", text: `${e.kind}: ${e.detail}` });
  for (const m of messages)
    turnText.set(m.turnId, {
      who: m.role === "user" ? "you" : "the AI",
      text: m.text,
    });

  // One evidence moment per scored competency, in the order the judge returned,
  // resolved to the first cited turn. Skip competencies the judge didn't cite.
  const seenTurns = new Set<string>();
  const sessionLine: EvidenceMoment[] = [];
  for (const ev of judge.competency_evidence) {
    const firstId = ev.evidence_turn_ids.find((id) => turnText.has(id));
    if (!firstId || seenTurns.has(firstId)) continue;
    seenTurns.add(firstId);
    const resolved = turnText.get(firstId)!;
    const tone: EvidenceMoment["tone"] = GOOD_BANDS.has(ev.band)
      ? "good"
      : GAP_BANDS.has(ev.band)
        ? "gap"
        : "neutral";
    sessionLine.push({
      turnId: firstId,
      who: resolved.who,
      text: truncate(resolved.text),
      note: truncate(ev.why, 180),
      tone,
    });
  }

  return {
    headline: judge.headline,
    sessionLine,
    worked: judge.coaching.worked,
    missed: judge.coaching.missed,
    expert: judge.coaching.expert,
    moves,
    practice: judge.practice_competency,
    nextMissionId,
    newProfile,
  };
}
