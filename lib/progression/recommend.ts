import type { Competency, Mission } from "../missions/types";
import { MISSIONS } from "../missions";

// DETERMINISTIC next-mission recommendation. The judge NAMES the competency to
// practise next (practice_competency); the app picks the mission id. The LLM
// never picks a mission — this keeps recommendation auditable and content-safe.

/**
 * Pick the next mission: the not-yet-completed mission that most emphasises the
 * target competency. Ties fall to catalog order. If everything is done, re-serve
 * the strongest mission for that competency so there is always a next rep.
 *
 * @param practice     the competency the judge said to work on next
 * @param completedIds mission ids the operator has already completed
 * @param missions     catalog (defaults to the real MISSIONS; injectable for tests)
 */
export function recommendNext(
  practice: Competency,
  completedIds: string[],
  missions: Mission[] = MISSIONS,
): string {
  const emphasis = (m: Mission) => m.competencyWeights[practice] ?? 0;

  const fresh = missions
    .filter((m) => !completedIds.includes(m.id))
    .sort((a, b) => emphasis(b) - emphasis(a));

  if (fresh.length > 0) return fresh[0].id;

  // Everything completed — still hand back a rep aimed at the gap.
  const anyByEmphasis = [...missions].sort((a, b) => emphasis(b) - emphasis(a));
  return (anyByEmphasis[0] ?? missions[0]).id;
}
