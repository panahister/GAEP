export const productJourneyPrimaryStatePresentation = {
  complete: {
    label: "Recorded", marker: "✓",
    meaning: "A governed checkpoint revision is recorded for the current Product context.",
    contentAuthority: "governed",
    userAction: "Review the recorded values and revise them when evidence or context changes.",
    progression: "possible-subject-to-downstream-prerequisites",
    persists: "The governed revision, evidence bindings, and audit history persist.",
    doesNotAuthorize: "Recording does not grant approval, publication, readiness, rollout, release, or production authority.",
  },
  "candidate-ready": {
    label: "Candidate ready for review", marker: "◆",
    meaning: "A bounded proposal exists, but it has not become governed state.",
    contentAuthority: "candidate",
    userAction: "Inspect the exact candidate, challenge it, and either revise, reject, or explicitly accept it.",
    progression: "review-required",
    persists: "Only candidate metadata and evidence bindings persist until an explicit governed commit.",
    doesNotAuthorize: "A candidate does not approve itself and does not authorize downstream execution.",
  },
  "needs-decisions": {
    label: "Needs decisions", marker: "!",
    meaning: "A candidate is incomplete because one or more accountable human decisions remain open.",
    contentAuthority: "candidate",
    userAction: "Resolve the named decisions or record them explicitly as unresolved with an owner.",
    progression: "bounded-work-may-continue-when-runtime-allows",
    persists: "The candidate, missing-decision list, and evidence digests persist.",
    doesNotAuthorize: "An unresolved decision is not an implied approval or waiver.",
  },
  "blocked-by-prerequisite": {
    label: "Waiting for prerequisite", marker: "⏸",
    meaning: "The checkpoint cannot validly progress until a named governed prerequisite is satisfied.",
    contentAuthority: "candidate-or-empty",
    userAction: "Open the prerequisite checkpoint and complete or explicitly resolve its required work.",
    progression: "not-possible",
    persists: "Any bounded candidate and the exact prerequisite reason persist.",
    doesNotAuthorize: "A blocked checkpoint cannot be treated as complete, approved, or ready.",
  },
  current: {
    label: "Current", marker: "●",
    meaning: "This is the first currently actionable checkpoint in the live runtime projection.",
    contentAuthority: "not-yet-governed",
    userAction: "Use the displayed next valid action to start or resume the checkpoint.",
    progression: "possible",
    persists: "No governed checkpoint content persists until its workflow is explicitly committed.",
    doesNotAuthorize: "Being current is navigation state, not approval or readiness.",
  },
  next: {
    label: "Next", marker: "→",
    meaning: "This is the next valid checkpoint selected by the live Product Journey projection.",
    contentAuthority: "not-yet-governed",
    userAction: "Use the displayed CTA when you are ready to continue.",
    progression: "possible",
    persists: "The navigation projection is recomputed from governed and candidate state.",
    doesNotAuthorize: "Next does not mean approved, ready, or mandatory.",
  },
  "not-started": {
    label: "Not started", marker: "○",
    meaning: "No governed revision or reviewable candidate exists for this checkpoint in the current context.",
    contentAuthority: "none",
    userAction: "Complete earlier prerequisites, then start the checkpoint when it becomes the next valid action.",
    progression: "not-currently-actionable",
    persists: "No checkpoint content is created merely by displaying this state.",
    doesNotAuthorize: "Absence of work is not a negative finding, rejection, or waiver.",
  },
} as const

export type ProductJourneyPrimaryState = keyof typeof productJourneyPrimaryStatePresentation

export const productJourneyAttentionIndicatorPresentation = {
  "needs-attention": {
    label: "Needs attention", marker: "!",
    meaning: "Recorded or candidate content has a stale, incomplete, conflicting, or otherwise reviewable condition.",
    userAction: "Use the enabled resolution action and preserve the prior revision until a replacement is committed.",
    progression: "depends-on-the-named-condition",
    persists: "The prior state and the attention reason persist.",
    doesNotAuthorize: "Attention is not approval, rejection, or automatic invalidation.",
  },
  blocked: {
    label: "Blocked", marker: "⛔",
    meaning: "A blocker prevents the named progression even if a candidate or earlier governed revision exists.",
    userAction: "Resolve the explicit blocker or record a scoped human decision; do not bypass it by relabeling state.",
    progression: "not-possible",
    persists: "The blocker, affected checkpoint identity, and any prior revision persist.",
    doesNotAuthorize: "Blocked work cannot be represented as ready, released, or complete.",
  },
  "open-questions": {
    label: "Unresolved / Open questions", marker: "?",
    meaning: "One or more questions lack a reviewed answer or accountable disposition.",
    userAction: "Answer, defer with an owner and trigger, or explicitly exclude each question within scope.",
    progression: "depends-on-question-materiality",
    persists: "Question text, owner, evidence basis, and disposition persist when recorded.",
    doesNotAuthorize: "Silence, missing evidence, or an unresolved question never becomes consent or approval.",
  },
} as const

export type ProductJourneyAttentionIndicator = keyof typeof productJourneyAttentionIndicatorPresentation

export const productJourneyRuntimeStatePresentation = {
  complete: { primaryState: "complete", indicatorIds: [] },
  "attention-required": { primaryState: "complete", indicatorIds: ["needs-attention"] },
  "candidate-ready": { primaryState: "candidate-ready", indicatorIds: [] },
  "needs-decisions": { primaryState: "needs-decisions", indicatorIds: ["open-questions"] },
  "blocked-by-prerequisite": { primaryState: "blocked-by-prerequisite", indicatorIds: ["blocked"] },
  current: { primaryState: "current", indicatorIds: [] },
  next: { primaryState: "next", indicatorIds: [] },
  "not-started": { primaryState: "not-started", indicatorIds: [] },
} as const satisfies Readonly<Record<string, {
  primaryState: ProductJourneyPrimaryState
  indicatorIds: readonly ProductJourneyAttentionIndicator[]
}>>

export type ProductJourneyRuntimeState = keyof typeof productJourneyRuntimeStatePresentation

export const currentProductJourneyCheckpointPresentation = [
  { checkpointId: "product-definition", order: 10, label: "Product definition", phase: { id: "foundation", label: "Product & Initiative foundation", order: 10 }, prerequisites: [], implementedCtas: ["@gaep /initialize", "@gaep /adopt", "Edit Product definition"], limitations: "Records a Product boundary; it does not establish market need or approve investment.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", compatibilityAliases: [] },
  { checkpointId: "initiative-definition", order: 20, label: "Initiative definition", phase: { id: "foundation", label: "Product & Initiative foundation", order: 10 }, prerequisites: ["product-definition"], implementedCtas: ["@gaep /continue", "Edit Initiative definition"], limitations: "Bounds a change; it does not authorize execution or funding.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", compatibilityAliases: [] },
  { checkpointId: "initiative-classification", order: 30, label: "Initiative classification", phase: { id: "foundation", label: "Product & Initiative foundation", order: 10 }, prerequisites: ["initiative-definition"], implementedCtas: ["@gaep /classification", "Resolve open questions"], limitations: "Classification is scoped evidence, not an approval or risk waiver.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", compatibilityAliases: [] },
  { checkpointId: "initiative-applicability", order: 40, label: "Initiative applicability", phase: { id: "foundation", label: "Product & Initiative foundation", order: 10 }, prerequisites: ["initiative-classification"], implementedCtas: ["@gaep /applicability", "Resolve pending decisions"], limitations: "Applicability records scoped decisions; it does not grant approval, readiness, or execution authority.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", compatibilityAliases: [] },
  { checkpointId: "source-intake", order: 50, label: "Source intake", phase: { id: "trusted-sources", label: "Trusted sources", order: 20 }, prerequisites: ["initiative-definition"], implementedCtas: ["@gaep /intake", "@gaep /record", "Bind reviewed Sources to Initiative"], limitations: "Attachment and extraction do not establish Source correctness, authority, or Baseline membership.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", compatibilityAliases: [] },
  { checkpointId: "source-baseline", order: 60, label: "Source baseline", phase: { id: "trusted-sources", label: "Trusted sources", order: 20 }, prerequisites: ["source-intake"], implementedCtas: ["@gaep /baseline"], limitations: "A Baseline freezes membership and revisions; it does not approve content or establish precedence.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", compatibilityAliases: [] },
  { checkpointId: "source-provenance", order: 70, label: "Source provenance", phase: { id: "trusted-sources", label: "Trusted sources", order: 20 }, prerequisites: ["source-intake"], implementedCtas: ["@gaep /provenance"], limitations: "Provenance records lineage and limitations; it does not establish correctness, authority, or Baseline membership.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", compatibilityAliases: [] },
  { checkpointId: "product-discovery", order: 80, label: "Product discovery", phase: { id: "product-discovery", label: "Product discovery", order: 30 }, prerequisites: ["initiative-applicability", "source-intake"], implementedCtas: ["@gaep /author", "Review Product discovery"], limitations: "Projects bounded discovery records; it does not prove user demand or business viability.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", compatibilityAliases: [] },
  { checkpointId: "business-architecture", order: 90, label: "Business architecture", phase: { id: "business-architecture", label: "Business architecture", order: 40 }, prerequisites: ["product-discovery"], implementedCtas: ["@gaep /author", "Review Business architecture"], limitations: "Recorded models remain bounded by evidence and do not certify organizational design.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", compatibilityAliases: [] },
  { checkpointId: "solution-security-architecture", order: 100, label: "Solution and security architecture", phase: { id: "solution-security-architecture", label: "Solution & security architecture", order: 50 }, prerequisites: ["business-architecture"], implementedCtas: ["@gaep /author", "Review Solution and security architecture"], limitations: "Architecture records do not create security, compliance, or deployment approval.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", compatibilityAliases: [] },
  { checkpointId: "detailed-design-assurance", order: 110, label: "Detailed design and assurance", phase: { id: "detailed-design-assurance", label: "Detailed design & assurance", order: 60 }, prerequisites: ["solution-security-architecture"], implementedCtas: ["@gaep /author", "Review Detailed design and assurance"], limitations: "Models and assurance evidence do not establish release, production, security, or compliance readiness.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", compatibilityAliases: [] },
  { checkpointId: "p0-p4-readiness", order: 120, label: "P0–P4 readiness and P5 handoff", guideLabel: "Design and implementation handoff", phase: { id: "pre-figma-handoff", label: "Pre-Figma readiness & handoff", order: 70 }, prerequisites: ["detailed-design-assurance"], implementedCtas: ["@gaep /author", "Review P0–P4 readiness and P5 handoff"], limitations: "Legacy runtime wording remains implemented. Product Design is the target tool-neutral abstraction; migration is not implemented.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", compatibilityAliases: ["design-implementation-handoff"], compatibilityNote: "Current runtime compatibility only: the legacy Pre-Figma/P0–P4 wording has not yet migrated to the target Product Design abstraction." },
] as const

export type ProductJourneyCheckpointId = typeof currentProductJourneyCheckpointPresentation[number]["checkpointId"]

export const currentProductJourneyCheckpointIds = currentProductJourneyCheckpointPresentation
  .slice().sort((left, right) => left.order - right.order)
  .map((entry) => entry.checkpointId) as readonly ProductJourneyCheckpointId[]

export const currentProductJourneyCheckpointLabels = Object.fromEntries(
  currentProductJourneyCheckpointPresentation.map((entry) => [entry.checkpointId, entry.label]),
) as Readonly<Record<ProductJourneyCheckpointId, string>>
