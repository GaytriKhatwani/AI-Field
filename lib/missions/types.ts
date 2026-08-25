// Mission content schema — hand-authored in the repo (no CMS), mirroring
// plan.md's Mission type. The judge/rubric never lives here.

export type Competency =
  | "context"
  | "direction"
  | "iteration"
  | "verification"
  | "synthesis";

export type ResourceKind = "notes" | "document" | "email" | "data";

export type Resource = {
  id: string;
  label: string;
  kind: ResourceKind;
  /** what the operator sees when they open it; also what the AI receives if given */
  content: string;
  /** one-line description shown before opening */
  summary: string;
};

/** A field group the deliverable UI renders. Mission-specific by design. */
export type DeliverableField =
  | { id: string; kind: "list"; label: string; placeholder: string }
  | {
      id: string;
      kind: "table";
      label: string;
      columns: { id: string; label: string; placeholder: string }[];
    };

export type DeliverableSpec = {
  title: string;
  fields: DeliverableField[];
};

export type Mission = {
  id: string;
  /** content version — stamped onto attempts so two evaluations are comparable */
  version?: string;
  title: string;
  tagline: string;
  premise: string;
  domain: string;
  effortMinutes: number;
  briefing: {
    scenario: string;
    objective: string;
    constraints: string[];
    deliverableDescription: string;
  };
  resources: Resource[];
  /** neutral mission framing for the literal-tool AI — NOT the rubric */
  workbenchSystemContext: string;
  deliverable: DeliverableSpec;
  competencyWeights: Record<Competency, number>;
  judgeGuidance: string;
  /** availability on The Field for the MVP slice */
  availability: "recommended" | "available" | "later";
};
