import type { Competency, Mission } from "../missions/types";
import { COMPETENCY_META, COMPETENCY_ORDER } from "../competencies";

// Builds the judge prompt: a unified, ID'd timeline of the whole session +
// the submitted deliverable + the mission's allowed competencies/weights/
// judgeGuidance. Every turn carries an id (msg_04, evt_02) so the judge cites
// evidence by reference, never by quoting.

export type TimelineMessage = {
  turnId: string; // msg_01, msg_02, …
  role: "user" | "ai";
  text: string;
};

export type TimelineEvent = {
  turnId: string; // evt_01, evt_02, …
  kind: string; // e.g. "attach_resource"
  detail: string; // human-readable, e.g. 'Gave the AI: "Raw meeting notes"'
};

export type SubmittedDeliverable = {
  lists: Record<string, string[]>;
  tables: Record<string, Record<string, string>[]>;
};

export type JudgeInput = {
  mission: Mission;
  messages: TimelineMessage[];
  events: TimelineEvent[];
  deliverable: SubmittedDeliverable;
  /** operator's stated experience — pitches TONE only, never the standard */
  operatorExperience?: string;
};

/** Competencies this mission actually exercises (weight > 0), in canonical order. */
export function weightedCompetencies(mission: Mission): Competency[] {
  return COMPETENCY_ORDER.filter((c) => (mission.competencyWeights[c] ?? 0) > 0);
}

/** Interleave messages and events into one chronological, ID'd transcript. */
function renderTimeline(input: JudgeInput): string {
  // Events are anchored to the start (attaches happen before/around messages);
  // for the MVP we list events first, then the message exchange in order. Each
  // line is "id  actor: text" so the judge can reference any turn by id.
  const lines: string[] = [];
  for (const e of input.events) {
    lines.push(`${e.turnId}  [event] ${e.kind}: ${e.detail}`);
  }
  for (const m of input.messages) {
    const actor = m.role === "user" ? "OPERATOR" : "AI";
    lines.push(`${m.turnId}  ${actor}: ${m.text}`);
  }
  return lines.join("\n");
}

function renderDeliverable(d: SubmittedDeliverable): string {
  const parts: string[] = [];
  for (const [key, items] of Object.entries(d.lists ?? {})) {
    if (!items.length) continue;
    parts.push(`${key}:`);
    for (const it of items) parts.push(`  - ${it}`);
  }
  for (const [key, rows] of Object.entries(d.tables ?? {})) {
    if (!rows.length) continue;
    parts.push(`${key}:`);
    for (const row of rows) {
      parts.push(
        "  - " +
          Object.entries(row)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | "),
      );
    }
  }
  return parts.length ? parts.join("\n") : "(nothing submitted)";
}

export function buildJudgePrompt(input: JudgeInput): string {
  const { mission } = input;
  const comps = weightedCompetencies(mission);

  const competencyBlock = comps
    .map((c) => {
      const w = mission.competencyWeights[c];
      return `- ${COMPETENCY_META[c].label} (id: ${c}, weight ${w}): ${COMPETENCY_META[c].question}`;
    })
    .join("\n");

  return `You are the examiner in AI Field, a practice environment where people learn to DIRECT an AI. You are NOT grading the AI's output for its own sake. You are grading HOW WELL THE OPERATOR DIRECTED THE AI to reach the mission's goal.

# The mission
Title: ${mission.title}
Scenario: ${mission.briefing.scenario}
Objective: ${mission.briefing.objective}
Constraints:
${mission.briefing.constraints.map((c) => `- ${c}`).join("\n")}

# What this mission tests (only these competencies are scored)
${competencyBlock}

# How an expert directs on this mission
${mission.judgeGuidance}

# The operator's full session (reference evidence by turn id — NEVER quote text)
${renderTimeline(input)}

# What the operator submitted as their deliverable
${renderDeliverable(input.deliverable)}

# Your judgement — rules
- Judge only the competencies listed above. Do not score any competency not listed.
- Apply the SAME standard to everyone. ${
    input.operatorExperience
      ? `Pitch your TONE for someone who describes their AI experience as "${input.operatorExperience}", but do not lower the bar.`
      : "Keep the tone plain and direct."
  }
- Turn count is NOT a measure of skill. Do not reward or penalise the number of exchanges. Judge the substance of the direction.
- For each scored competency, choose exactly one band: not_shown, emerging, developing, proficient, strong. Justify it in "why" and list the turn ids that support it in "evidence_turn_ids". Never quote the text — reference ids only.
- Be specific and honest. If the operator let the AI invent facts the source material never contained (e.g. dates or owners the notes never stated) and did not catch it, that is a verification miss — say so plainly.
- Coaching must be plain and actionable: what worked, what they missed, how an expert would have approached it, one skill they showed, one skill to practise next.
- The headline is short and honest — no numeric score, no praise clichés.
- practice_competency is the single competency the next rep should target — normally their weakest demonstration, but a concrete demonstrated miss (like letting an invented fact through) outranks a merely under-exercised skill.

Return ONLY the structured JSON object required by the schema.`;
}
