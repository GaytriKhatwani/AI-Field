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

// The turn text is raw model/operator content — often markdown — and the notes
// are shown inline (newlines collapse to spaces), so strip formatting to plain,
// scannable prose before display.
function plainText(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // heading markers at line start
    .replace(/#{2,}\s*/g, "") // stray ## left after newline-collapse
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/(?<!\w)[*_]([^*_]+)[*_](?!\w)/g, "$1") // italic
    .replace(/^\s*[-*+]\s+/gm, "") // bullet markers
    .replace(/^\s*\d+[.)]\s+/gm, "") // numbered markers
    .replace(/\s+/g, " ")
    .trim();
}

// The judge cites evidence by internal turn id in evidence_turn_ids, but it also
// leaks those ids into its prose ("msg_03 gives…", "via attachment (evt_01)").
// Scrub them so the reader never sees an internal reference.
function scrubTurnIds(s: string): string {
  const out = s
    .replace(/\s*\((?:msg|evt)_\d+(?:\s*,\s*(?:msg|evt)_\d+)*\)/gi, "") // "(evt_01)", "(msg_02, msg_03)"
    .replace(/\b(?:msg|evt)_\d+\b/gi, "that turn")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}

// Truncate on a word boundary so a snippet never ends mid-word ("submitte…").
function truncate(s: string, n = 150): string {
  const t = s.trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > n * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
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
      // Both cleaners run on both fields: turn text can carry an id and a note
      // can carry markdown, so neither field is safe with only one pass.
      text: truncate(scrubTurnIds(plainText(resolved.text)), 120),
      note: truncate(plainText(scrubTurnIds(ev.why)), 170),
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
