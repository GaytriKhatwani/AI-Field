import type { Mission, Competency } from "../missions/types";
import {
  Band,
  Profile,
  scoreToBand,
  COMPETENCY_ORDER,
  gapCompetency,
} from "../competencies";
import { MISSIONS } from "../missions";

// A MOCKED examiner. Stands in for the server-side judge + deterministic
// progression code (lib/progression/*). It reads real signals from the session
// so a strong attempt and a weak one produce visibly different reads — the whole
// point of the product. Not a real LLM; the judge tuning + gate are deferred.

export type SessionMessage = { id: string; role: "user" | "ai"; text: string };

export type Session = {
  mission: Mission;
  givenResourceIds: string[];
  messages: SessionMessage[];
  deliverable: {
    lists: Record<string, string[]>;
    tables: Record<string, Record<string, string>[]>;
  };
};

export type EvidenceMoment = {
  turnId: string;
  who: "you" | "the AI";
  text: string;
  note: string;
  tone: "good" | "gap" | "neutral";
};

export type CompetencyMove = {
  competency: Competency;
  before: Band;
  after: Band;
  moved: boolean;
  why: string;
};

export type Debrief = {
  headline: string;
  sessionLine: EvidenceMoment[];
  worked: string;
  missed: string;
  expert: string;
  moves: CompetencyMove[];
  practice: Competency;
  nextMissionId: string;
  newProfile: Profile;
};

const BAND_TARGET: Record<Band, number> = {
  not_shown: 0,
  emerging: 25,
  developing: 45,
  proficient: 68,
  strong: 88,
};

function userTurns(s: Session) {
  return s.messages.filter((m) => m.role === "user");
}

/** Illustrative deterministic signals — real discrimination is tuned at the gate. */
function bandFor(comp: Competency, s: Session): { band: Band; why: string } {
  const users = userTurns(s);
  const allUser = users.map((m) => m.text.toLowerCase()).join(" ");
  const gave = s.givenResourceIds.length > 0;
  const tables = s.deliverable.tables ?? {};
  const lists = s.deliverable.lists ?? {};
  const deliverableFilled =
    Object.values(lists).some((v) => v.length > 0) ||
    Object.values(tables).some((v) => v.length > 0);

  switch (comp) {
    case "context": {
      if (!gave)
        return {
          band: "not_shown",
          why: "You never gave the AI the mission's material, so it worked from nothing.",
        };
      if (s.givenResourceIds.length >= 2)
        return {
          band: "developing",
          why: "You gave the AI source material — including a resource that wasn't strictly needed.",
        };
      return {
        band: "proficient",
        why: "You recognised the AI needed the raw notes and gave it exactly those.",
      };
    }
    case "direction": {
      const specifiedShape = /decision|owner|due|date|action|question|format|structure/.test(
        allUser,
      );
      if (users.length === 0) return { band: "not_shown", why: "No instruction was given." };
      if (specifiedShape)
        return {
          band: "proficient",
          why: "You told the AI the exact output you wanted — decisions, owners, due dates.",
        };
      return {
        band: "emerging",
        why: "Your instruction was broad; the AI had to guess the shape of the output.",
      };
    }
    case "iteration": {
      if (users.length >= 3)
        return {
          band: "developing",
          why: "You pushed past the first answer and refined it across several turns.",
        };
      if (users.length === 2)
        return { band: "emerging", why: "You made one round of refinement." };
      return {
        band: "not_shown",
        why: "You accepted the AI's first answer without pushing it further.",
      };
    }
    case "verification": {
      const checked = /check|verify|source|wrong|didn'?t say|not in|invent|made up|no date/.test(
        allUser,
      );
      const caughtInDeliverable = (lists.caught ?? []).length > 0;
      // Did an invented Sept date survive into the deliverable un-caught?
      const keptInventedDate = (tables.actions ?? []).some((r) =>
        /sept|due/i.test(r.due ?? ""),
      );
      if (checked || caughtInDeliverable)
        return {
          band: "developing",
          why: "You questioned what the AI produced and checked it against the source.",
        };
      if (keptInventedDate)
        return {
          band: "not_shown",
          why: "The AI invented due dates the notes never stated, and they went into your deliverable unchallenged.",
        };
      return {
        band: "emerging",
        why: "You mostly took the AI's output at face value.",
      };
    }
    case "synthesis": {
      if (!deliverableFilled)
        return { band: "not_shown", why: "You didn't build a deliverable to hand in." };
      const full =
        Object.keys(lists).length + Object.keys(tables).length >= 2;
      return full
        ? {
            band: "proficient",
            why: "You curated the AI's output into a complete, usable summary — not a dump of the chat.",
          }
        : {
            band: "developing",
            why: "You shaped some of the output into a deliverable, though parts stayed thin.",
          };
    }
  }
}

function blend(prev: number, target: number, weight: number): number {
  const k = 0.4 + 0.5 * weight; // heavier missions move a bar more
  return Math.round(Math.max(0, Math.min(100, prev + (target - prev) * k)));
}

function recommendNext(practice: Competency, completedIds: string[]): string {
  // Deterministic: the mission that most emphasises the gap and isn't done yet.
  const ranked = [...MISSIONS]
    .filter((m) => !completedIds.includes(m.id))
    .sort((a, b) => b.competencyWeights[practice] - a.competencyWeights[practice]);
  return (ranked[0] ?? MISSIONS[0]).id;
}

export function examine(
  session: Session,
  prevProfile: Profile,
  completedIds: string[],
): Debrief {
  const { mission } = session;
  const weights = mission.competencyWeights;
  const users = userTurns(session);

  const newProfile: Profile = { ...prevProfile };
  const moves: CompetencyMove[] = [];

  for (const comp of COMPETENCY_ORDER) {
    const weight = weights[comp] ?? 0;
    const before = scoreToBand(prevProfile[comp]);
    if (weight <= 0) {
      // Not exercised by this mission — stays put (bars don't all inflate).
      moves.push({ competency: comp, before, after: before, moved: false, why: "This mission didn't call for it." });
      continue;
    }
    const { band, why } = bandFor(comp, session);
    const next = blend(prevProfile[comp], BAND_TARGET[band], weight);
    newProfile[comp] = next;
    const after = scoreToBand(next);
    moves.push({ competency: comp, before, after, moved: after !== before, why });
  }

  // The verification trap, if present — a specific, demonstrated miss.
  const inventedDate = (session.deliverable.tables?.actions ?? []).find((r) =>
    /sept/i.test(r.due ?? ""),
  );
  const caught = (session.deliverable.lists?.caught ?? []).length > 0 ||
    users.some((m) => /check|verify|didn'?t say|not in|invent/.test(m.text.toLowerCase()));

  // The named gap is normally the lowest capability. But a specific, demonstrated
  // miss is a stronger, more honest signal than a merely-underexercised skill: if
  // the operator let an invented fact through, Verification IS the gap — and the
  // debrief's "what you missed" then resolves straight into the next rep.
  const trapSurvived = !!inventedDate && !caught && weights.verification > 0;
  const practice: Competency = trapSurvived ? "verification" : gapCompetency(newProfile);
  const nextMissionId = recommendNext(practice, [...completedIds, mission.id]);

  // Build the session/evidence line from real moments.
  const sessionLine: EvidenceMoment[] = [];
  const gaveContext = session.givenResourceIds.length > 0;
  const givenLabels = session.givenResourceIds
    .map((id) => mission.resources.find((r) => r.id === id)?.label ?? id)
    .join(", ");
  sessionLine.push({
    turnId: "evt_01",
    who: "you",
    text: gaveContext
      ? `Gave the AI: ${givenLabels.toLowerCase()}`
      : "Started without giving the AI any material",
    note: gaveContext
      ? "Recognising what the AI needed was the first move."
      : "The AI had nothing to work from.",
    tone: gaveContext ? "good" : "gap",
  });
  const firstUser = users[0];
  if (firstUser) {
    const specific = /decision|owner|due|action|question/.test(firstUser.text.toLowerCase());
    sessionLine.push({
      turnId: firstUser.id,
      who: "you",
      text: firstUser.text,
      note: specific
        ? "You named the output you wanted."
        : "A broad opening — the AI had to guess the shape.",
      tone: specific ? "good" : "neutral",
    });
  }
  if (inventedDate && !caught) {
    sessionLine.push({
      turnId: "evt_trap",
      who: "the AI",
      text: `"${inventedDate.owner} — ${inventedDate.task} — ${inventedDate.due}"`,
      note: "The notes never gave this date. It reached your deliverable unchallenged.",
      tone: "gap",
    });
  } else if (caught) {
    sessionLine.push({
      turnId: "evt_trap",
      who: "you",
      text: "Questioned the dates the AI produced",
      note: "You caught that the notes didn't support them.",
      tone: "good",
    });
  }

  // Coaching, honest and specific — no grade, no praise clichés.
  const contextMove = moves.find((m) => m.competency === "context")!;
  const verifMove = moves.find((m) => m.competency === "verification")!;
  const worked = gaveContext
    ? "You gave the AI the raw notes and told it the shape you wanted. That's most of directing well — the AI had what it needed and knew what to produce."
    : "You moved quickly and got a draft out. But you asked the AI to work before giving it anything to work from.";
  const missed =
    inventedDate && !caught
      ? "The AI filled in due dates the notes never contained, and they went into your summary as if they were real. A summary your manager acts on can't carry invented dates."
      : caught
        ? "Little slipped past you here. The next stretch is doing this faster — catching it in fewer turns."
        : "You accepted the first draft without pressure-testing it. The first answer is rarely the one worth sending.";
  const expert =
    "A strong operator hands over the notes, asks for the summary in the exact shape needed, and then reads the AI's output against the source line by line — flagging every date and owner the notes don't actually support instead of letting them through.";

  const headline = !gaveContext
    ? "The AI worked blind."
    : trapSurvived
      ? "One invented detail slipped through."
      : "Directed, and verified.";

  return {
    headline,
    sessionLine,
    worked,
    missed,
    expert,
    moves,
    practice,
    nextMissionId,
    newProfile,
  };
}
