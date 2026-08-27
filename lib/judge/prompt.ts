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
    const actor = m.role === "user" ? "PERSON" : "AI";
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

  return `You are the reviewer in AI Field, a practice environment where people practise working with an AI on realistic tasks. You are NOT grading the AI's output for its own sake. You are grading HOW WELL THE PERSON worked with the AI to reach the scenario's goal.

# The scenario
Title: ${mission.title}
Situation: ${mission.briefing.scenario}
Task: ${mission.briefing.objective}
What matters:
${mission.briefing.constraints.map((c) => `- ${c}`).join("\n")}

# What this scenario tests (only these capabilities are scored)
${competencyBlock}

# What a strong approach looks like on this scenario
${mission.judgeGuidance}

# The person's full session (reference evidence by turn id — NEVER quote text)
${renderTimeline(input)}

# What the person produced as their deliverable
${renderDeliverable(input.deliverable)}

# Your review — rules
- Judge only the capabilities listed above. Do not score any capability not listed.
- Address the person directly as "you" in the headline and all coaching. Never call them "the operator" or refer to them in the third person.
- Apply the SAME standard to everyone. ${
    input.operatorExperience
      ? `Pitch your TONE for someone who describes their AI experience as "${input.operatorExperience}", but do not lower the bar.`
      : "Keep the tone plain and direct."
  }
- Message count is NOT a measure of skill. Do not reward or penalise the number of messages. Judge the substance of how they worked.
- For each scored capability, choose exactly one band: not_shown, emerging, developing, proficient, strong. Justify it in "why" and list the turn ids that support it in "evidence_turn_ids". Never quote the text — reference ids only.
- Be specific and honest. If you let the AI invent facts the source material never contained (e.g. dates or owners the notes never stated) and did not catch it, that is a verification miss — say so plainly.
- Coaching must be plain, specific, and actionable, written to "you": what worked, what to improve next, how a stronger approach would handle it, one thing you did well, and one capability to practise next. Describe stronger actions directly — never compare the person to an "expert", a "strong operator", or any undefined ideal.
- Keep the stronger-approach guidance specific to the session evidence and concise: prefer short sentences over long ones with several dashes or nested qualifications.
- In each "why", lead with the observed action, then its effect (what it helped or what it missed). Never expose internal turn/event identifiers or telemetry labels in the prose.
- The headline is short, specific, candid, and developmental — never accusatory. Describe the behaviour, not a personal failing: no numeric score, no praise clichés. Prefer forms like "Clear direction. The output needed more checking." Never write "you stopped working", "you failed to…", "you did nothing", "you blindly accepted…", or "the operator…".
- practice_competency is the single capability the next scenario should target — normally your weakest demonstration, but a concrete demonstrated miss (like letting an invented fact through) outranks a merely under-exercised capability.

Return ONLY the structured JSON object required by the schema.`;
}
