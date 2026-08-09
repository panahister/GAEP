/**
 * Canonical current-runtime Product Journey contract.
 *
 * This is executable product metadata, not a documentation mirror. Product
 * Studio, Chat/adoption, exports, the Guideline, RACI and sequence projections
 * all derive checkpoint identity, order, labels, roles and execution semantics
 * from this contract.
 */

export const productJourneyRoleArchetypeIds = [
  "governing-body", "executive-sponsor", "product-leadership", "product-manager", "product-owner",
  "initiative-lead", "business-owner", "domain-expert", "business-architect", "enterprise-architect",
  "solution-architect", "data-ai-architect", "security-architect", "privacy-specialist",
  "legal-regulatory-specialist", "risk-compliance-specialist", "product-design-research",
  "engineering-leadership", "software-engineering", "data-ai-engineering", "platform-devops",
  "quality-engineering", "ai-evaluation-tevv", "release-change-management", "service-management",
  "sre-operations", "incident-recovery-leadership", "internal-audit-independent-assurance",
  "affected-user-stakeholder",
] as const

export type ProductJourneyRoleArchetypeId = typeof productJourneyRoleArchetypeIds[number]

export const productJourneyCompetencyProfileIds = [
  "lifecycle-literacy", "product-initiative-reasoning", "domain-business-analysis", "evidence-provenance",
  "source-governance", "candidate-accept-commit", "architecture-ddd", "product-design",
  "backlog-requirements-quality", "testing-assurance", "ai-literacy-limitations", "prompt-context-governance",
  "security", "privacy", "risk-compliance", "repository-governance", "delivery-release",
  "operations-resilience", "auditability", "challenge-escalation",
] as const

export type ProductJourneyCompetencyProfileId = typeof productJourneyCompetencyProfileIds[number]

export const productJourneyPrimaryStatePresentation = {
  complete: {
    label: "Recorded", marker: "✓", meaning: "A governed checkpoint revision is recorded for the current Product context.",
    contentAuthority: "governed", userAction: "Review the recorded values and revise them when evidence or context changes.",
    progression: "possible-subject-to-downstream-prerequisites", persists: "The governed revision, evidence bindings, and audit history persist.",
    doesNotAuthorize: "Recording does not grant approval, publication, readiness, rollout, release, or production authority.",
  },
  "candidate-ready": {
    label: "Candidate ready for review", marker: "◆", meaning: "A bounded proposal exists, but it has not become governed state.",
    contentAuthority: "candidate", userAction: "Inspect the exact candidate, challenge it, and either revise, reject, or explicitly accept it.",
    progression: "review-required", persists: "Only candidate metadata and evidence bindings persist until an explicit governed commit.",
    doesNotAuthorize: "A candidate does not approve itself and does not authorize downstream execution.",
  },
  "needs-decisions": {
    label: "Needs decisions", marker: "!", meaning: "A candidate is incomplete because one or more accountable human decisions remain open.",
    contentAuthority: "candidate", userAction: "Resolve the named decisions or record them explicitly as unresolved with an owner.",
    progression: "bounded-work-may-continue-when-runtime-allows", persists: "The candidate, missing-decision list, and evidence digests persist.",
    doesNotAuthorize: "An unresolved decision is not an implied approval or waiver.",
  },
  "blocked-by-prerequisite": {
    label: "Waiting for prerequisite", marker: "⏸", meaning: "The checkpoint cannot validly progress until a named governed prerequisite is satisfied.",
    contentAuthority: "candidate-or-empty", userAction: "Open the prerequisite checkpoint and complete or explicitly resolve its required work.",
    progression: "not-possible", persists: "Any bounded candidate and the exact prerequisite reason persist.",
    doesNotAuthorize: "A blocked checkpoint cannot be treated as complete, approved, or ready.",
  },
  current: {
    label: "Current", marker: "●", meaning: "This is the first currently actionable checkpoint in the live runtime projection.",
    contentAuthority: "not-yet-governed", userAction: "Use the displayed next valid action to start or resume the checkpoint.",
    progression: "possible", persists: "No governed checkpoint content persists until its workflow is explicitly committed.",
    doesNotAuthorize: "Being current is navigation state, not approval or readiness.",
  },
  next: {
    label: "Next", marker: "→", meaning: "This is the next valid checkpoint selected by the live Product Journey projection.",
    contentAuthority: "not-yet-governed", userAction: "Use the displayed CTA when you are ready to continue.",
    progression: "possible", persists: "The navigation projection is recomputed from governed and candidate state.",
    doesNotAuthorize: "Next does not mean approved, ready, or mandatory.",
  },
  "not-started": {
    label: "Not started", marker: "○", meaning: "No governed revision or reviewable candidate exists for this checkpoint in the current context.",
    contentAuthority: "none", userAction: "Complete earlier prerequisites, then start the checkpoint when it becomes the next valid action.",
    progression: "not-currently-actionable", persists: "No checkpoint content is created merely by displaying this state.",
    doesNotAuthorize: "Absence of work is not a negative finding, rejection, or waiver.",
  },
} as const

export type ProductJourneyPrimaryState = keyof typeof productJourneyPrimaryStatePresentation

export const productJourneyAttentionIndicatorPresentation = {
  "needs-attention": {
    label: "Needs attention", marker: "!", meaning: "Recorded or candidate content has a stale, incomplete, conflicting, or otherwise reviewable condition.",
    userAction: "Use the enabled resolution action and preserve the prior revision until a replacement is committed.", progression: "depends-on-the-named-condition",
    persists: "The prior state and the attention reason persist.", doesNotAuthorize: "Attention is not approval, rejection, or automatic invalidation.",
  },
  blocked: {
    label: "Blocked", marker: "⛔", meaning: "A blocker prevents the named progression even if a candidate or earlier governed revision exists.",
    userAction: "Resolve the explicit blocker or record a scoped human decision; do not bypass it by relabeling state.", progression: "not-possible",
    persists: "The blocker, affected checkpoint identity, and any prior revision persist.", doesNotAuthorize: "Blocked work cannot be represented as ready, released, or complete.",
  },
  "open-questions": {
    label: "Unresolved / Open questions", marker: "?", meaning: "One or more questions lack a reviewed answer or accountable disposition.",
    userAction: "Answer, defer with an owner and trigger, or explicitly exclude each question within scope.", progression: "depends-on-question-materiality",
    persists: "Question text, owner, evidence basis, and disposition persist when recorded.", doesNotAuthorize: "Silence, missing evidence, or an unresolved question never becomes consent or approval.",
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
} as const satisfies Readonly<Record<string, { primaryState: ProductJourneyPrimaryState; indicatorIds: readonly ProductJourneyAttentionIndicator[] }>>

export type ProductJourneyRuntimeState = keyof typeof productJourneyRuntimeStatePresentation

export type ProductJourneyCurrentAction = Readonly<{
  kind: "chat-command" | "studio-action"
  value: string
  label: string
}>

export type ProductJourneyExecutionStep = Readonly<{
  stepId: string
  order: number
  purpose: string
  interactionType: "inspect" | "human-decision" | "ai-assisted-candidate" | "governed-commit"
  responsibleRoleIds: readonly ProductJourneyRoleArchetypeId[]
  accountableRoleId: ProductJourneyRoleArchetypeId | null
  consultedRoleIds: readonly ProductJourneyRoleArchetypeId[]
  informedRoleIds: readonly ProductJourneyRoleArchetypeId[]
  independentAssuranceRoleIds: readonly ProductJourneyRoleArchetypeId[]
  inputContractIds: readonly string[]
  currentAction: ProductJourneyCurrentAction | null
  outputContractIds: readonly string[]
  evidenceProduced: readonly string[]
  evidenceConsumed: readonly string[]
  reviewCriteria: readonly string[]
  stateBefore: string
  stateAfter: string
  recordEffect: "none" | "candidate" | "governed"
  authorityEffect: string
  failureConditions: readonly string[]
  blockerBehavior: string
  retryRevisionPath: string
  auditEventEffect: string
  maturity: "current" | "partial" | "unavailable" | "target-only"
}>

export type ProductJourneyCheckpointContract = Readonly<{
  checkpointId: string
  compatibilityAliases: readonly string[]
  compatibilityNote?: string
  stableTitle: string
  label: string
  guideLabel?: string
  /** Compatibility grouping used by the current canonical-record export. */
  recordGroup?: string
  purpose: string
  whyItExists: string
  phase: Readonly<{ id: string; label: string; order: number }>
  order: number
  terminal: boolean
  entryConditions: readonly string[]
  prerequisites: readonly string[]
  requiredRoleArchetypeIds: readonly ProductJourneyRoleArchetypeId[]
  requiredCompetencyProfileIds: readonly ProductJourneyCompetencyProfileId[]
  requiredInputContractIds: readonly string[]
  prominentQuestions: readonly string[]
  executionSubsteps: readonly ProductJourneyExecutionStep[]
  candidateOutputContractIds: readonly string[]
  governedOutputContractIds: readonly string[]
  decisionRecordContractIds: readonly string[]
  evidenceRequirements: readonly string[]
  blockers: readonly string[]
  exceptionPath: string
  escalationPath: string
  exitCriteria: readonly string[]
  nextValidTransitions: readonly string[]
  implementedCtas: readonly string[]
  limitations: string
  implementationMaturity: "implemented-awaiting-product-owner-acceptance" | "partial" | "planned-deferred-coming-soon"
  authorityEffects: readonly string[]
  transitionType: "retained" | "expanded" | "split" | "replaced-by-tool-neutral-abstraction"
  targetEvolution: string
}>

type CheckpointSeed = Omit<ProductJourneyCheckpointContract, "stableTitle" | "label" | "executionSubsteps" | "candidateOutputContractIds" | "governedOutputContractIds" | "decisionRecordContractIds" | "evidenceRequirements" | "blockers" | "exceptionPath" | "escalationPath" | "exitCriteria" | "authorityEffects"> & {
  title: string
  accountableRoleId: ProductJourneyRoleArchetypeId
  responsibleRoleIds: readonly ProductJourneyRoleArchetypeId[]
  assuranceRoleIds?: readonly ProductJourneyRoleArchetypeId[]
  currentAction: ProductJourneyCurrentAction
  outputContractId: string
  evidenceFocus: string
}

function checkpoint<const Seed extends CheckpointSeed>(seed: Seed): ProductJourneyCheckpointContract & { readonly checkpointId: Seed["checkpointId"] } {
  const candidateId = `${seed.outputContractId}-candidate`
  const contractFields: Record<string, unknown> = { ...seed }
  for (const seedOnlyField of ["title", "accountableRoleId", "responsibleRoleIds", "assuranceRoleIds", "currentAction", "outputContractId", "evidenceFocus"]) delete contractFields[seedOnlyField]
  return {
    ...contractFields,
    stableTitle: seed.title,
    label: seed.title,
    candidateOutputContractIds: [candidateId],
    governedOutputContractIds: [seed.outputContractId],
    decisionRecordContractIds: [`${seed.checkpointId}-acceptance-decision`],
    evidenceRequirements: [seed.evidenceFocus, "Exact input identities, revisions, digests, freshness, provenance, and declared limitations"],
    blockers: ["A named prerequisite is absent or stale", "Required evidence is unavailable or contradictory", "The accountable role or required independent assurance is absent"],
    exceptionPath: "Preserve prior governed records, mark the exception and scope explicitly, and continue only where the runtime and accountable authority permit bounded work.",
    escalationPath: `Escalate unresolved material decisions to ${seed.accountableRoleId}; use independent assurance when the role/risk profile requires it.`,
    exitCriteria: [`The exact ${seed.title} candidate is reviewed against declared evidence and limitations`, "Open material decisions have an accountable disposition", `The ${seed.outputContractId} record is explicitly committed or the checkpoint remains visibly unresolved`],
    authorityEffects: ["Acceptance applies only to the exact candidate", "Commit creates governed state; it does not grant implementation, release, operational, security, privacy, compliance, or certification authority"],
    executionSubsteps: [
      {
        stepId: `${seed.checkpointId}-inspect`, order: 10,
        purpose: `Inspect the exact inputs for ${seed.title}; answer the prominent questions and identify stale, missing, conflicting, or unprovenanced evidence before proposal generation.`,
        interactionType: "inspect", responsibleRoleIds: seed.responsibleRoleIds, accountableRoleId: null,
        consultedRoleIds: seed.requiredRoleArchetypeIds.filter(role => !seed.responsibleRoleIds.includes(role)), informedRoleIds: [], independentAssuranceRoleIds: [],
        inputContractIds: seed.requiredInputContractIds, currentAction: null, outputContractIds: [`${seed.checkpointId}-review-context`],
        evidenceProduced: ["Bounded review context, named gaps, conflicts, assumptions, and freshness observations"], evidenceConsumed: [seed.evidenceFocus],
        reviewCriteria: [...seed.prominentQuestions, "Every material assertion has exact evidence or remains Unknown"],
        stateBefore: "not-started-or-prerequisite-satisfied", stateAfter: "review-context-ready", recordEffect: "none",
        authorityEffect: "Inspection creates no candidate, acceptance, governed state, or execution authority.",
        failureConditions: ["Required input cannot be identified", "Evidence limitation prevents a bounded conclusion"],
        blockerBehavior: "Expose the missing prerequisite/evidence and stop the affected proposal path without discarding prior records.",
        retryRevisionPath: "Supply or revise the bounded input, preserve the prior review context, and inspect again.",
        auditEventEffect: "The current runtime records workflow/audit evidence only when its implemented action executes; this inspection description creates none by itself.", maturity: "current",
      },
      {
        stepId: `${seed.checkpointId}-propose`, order: 20,
        purpose: `Use the implemented ${seed.currentAction.label} route to prepare a bounded ${seed.title} candidate from the reviewed context, preserving Unknowns and limitations.`,
        interactionType: "ai-assisted-candidate", responsibleRoleIds: seed.responsibleRoleIds, accountableRoleId: null,
        consultedRoleIds: seed.requiredRoleArchetypeIds.filter(role => !seed.responsibleRoleIds.includes(role)), informedRoleIds: [], independentAssuranceRoleIds: [],
        inputContractIds: [...seed.requiredInputContractIds, `${seed.checkpointId}-review-context`], currentAction: seed.currentAction, outputContractIds: [candidateId],
        evidenceProduced: [`Exact ${seed.title} candidate, candidate digest, unresolved decisions, and evidence bindings`], evidenceConsumed: [seed.evidenceFocus, "Current governed prerequisite digests"],
        reviewCriteria: ["Candidate is bounded to exact inputs", "AI inference is visible", "No missing evidence is converted to fact"],
        stateBefore: "review-context-ready", stateAfter: "candidate-ready-for-review", recordEffect: "candidate",
        authorityEffect: "AI assistance creates a candidate only; it cannot accept, approve, waive, commit, or authorize work.",
        failureConditions: ["Implemented action is unavailable", "Candidate output is incomplete, stale, or exceeds its evidence"],
        blockerBehavior: "Keep the candidate non-governed, show the failure, and require correction or cancellation.",
        retryRevisionPath: "Challenge or revise exact inputs and rerun the same implemented action; never overwrite prior governed state.",
        auditEventEffect: "The runtime preserves candidate/run diagnostics and exact evidence digests where the implemented workflow supports them.", maturity: "current",
      },
      {
        stepId: `${seed.checkpointId}-decide-commit`, order: 30,
        purpose: `Have ${seed.accountableRoleId} review the exact ${seed.title} candidate against exit criteria, obtain required assurance, accept only that candidate, and explicitly commit the governed record.`,
        interactionType: "governed-commit", responsibleRoleIds: seed.responsibleRoleIds, accountableRoleId: seed.accountableRoleId,
        consultedRoleIds: seed.requiredRoleArchetypeIds.filter(role => role !== seed.accountableRoleId && !seed.responsibleRoleIds.includes(role)), informedRoleIds: ["initiative-lead"], independentAssuranceRoleIds: seed.assuranceRoleIds ?? [],
        inputContractIds: [candidateId], currentAction: { kind: "chat-command", value: "@gaep /commit CONFIRM", label: "accept the exact candidate, then commit with @gaep /commit CONFIRM" }, outputContractIds: [seed.outputContractId, `${seed.checkpointId}-acceptance-decision`],
        evidenceProduced: ["Human acceptance disposition, governed revision, audit event, and retained candidate/input digests"], evidenceConsumed: [`Exact ${seed.title} candidate and limitations`, "Challenge and assurance findings"],
        reviewCriteria: ["Exactly one accountable role is named", "Required assurance findings are resolved or explicitly retained", "The accepted digest equals the committed digest"],
        stateBefore: "candidate-ready-for-review", stateAfter: "recorded-or-needs-decisions", recordEffect: "governed",
        authorityEffect: "Commit governs this bounded record only; separate authorities remain required for risk acceptance, implementation, repository mutation, release, deployment, and operations.",
        failureConditions: ["Accountability is absent", "Candidate changed after review", "Material blocker or assurance finding remains undisposed"],
        blockerBehavior: "Do not commit; preserve the candidate and blocker with an accountable owner and escalation path.",
        retryRevisionPath: "Reject or revise the candidate, regenerate a new digest, repeat review, then accept and commit explicitly.",
        auditEventEffect: "The implemented commit records the exact accepted proposal and actor/context in governed audit history.", maturity: "current",
      },
    ],
  } as unknown as ProductJourneyCheckpointContract & { readonly checkpointId: Seed["checkpointId"] }
}

const foundation = { id: "foundation", label: "Product and Initiative foundation", order: 1 } as const
const sources = { id: "trusted-sources", label: "Trusted sources", order: 2 } as const

export const currentProductJourneyCheckpointPresentation = [
  checkpoint({ checkpointId: "product-definition", compatibilityAliases: [], title: "Product definition", purpose: "Establish the bounded Product, problem, affected users, outcomes, success signals, and exclusions.", whyItExists: "AI-assisted work needs a stable Product boundary so later decisions do not optimize an undefined or shifting object.", phase: foundation, order: 10, terminal: false, entryConditions: ["Trusted Product workspace is open", "Entry-path and source availability are understood"], prerequisites: [], requiredRoleArchetypeIds: ["product-manager", "business-owner", "affected-user-stakeholder"], requiredCompetencyProfileIds: ["lifecycle-literacy", "product-initiative-reasoning", "candidate-accept-commit"], requiredInputContractIds: ["workspace-context", "optional-reviewed-references"], prominentQuestions: ["What Product and problem are in scope?", "Who is affected and what measurable outcome matters?", "What is explicitly excluded?"], responsibleRoleIds: ["product-manager"], accountableRoleId: "business-owner", currentAction: { kind: "chat-command", value: "@gaep /initialize or @gaep /adopt", label: "@gaep /initialize or @gaep /adopt" }, outputContractId: "governed-product-definition", evidenceFocus: "Reviewed Product references and stakeholder evidence", nextValidTransitions: ["initiative-definition"], implementedCtas: ["@gaep /initialize", "@gaep /adopt", "Edit Product definition"], limitations: "Records a Product boundary; it does not establish market need, funding, or investment approval.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", transitionType: "expanded", targetEvolution: "Adds explicit entry assessment, operational-Product entry, and enterprise governance context." }),
  checkpoint({ checkpointId: "initiative-definition", compatibilityAliases: [], title: "Initiative definition", purpose: "Bound the proposed change, outcome, scope, constraints, and relationship to the governed Product.", whyItExists: "A Product can contain many changes; evidence, decisions, and authority must be scoped to one Initiative.", phase: foundation, order: 20, terminal: false, entryConditions: ["Governed Product definition exists"], prerequisites: ["product-definition"], requiredRoleArchetypeIds: ["initiative-lead", "product-manager", "business-owner"], requiredCompetencyProfileIds: ["product-initiative-reasoning", "evidence-provenance", "candidate-accept-commit"], requiredInputContractIds: ["governed-product-definition", "initiative-context"], prominentQuestions: ["What change and outcome are bounded?", "What is included and excluded?", "Which constraints and dependencies apply?"], responsibleRoleIds: ["initiative-lead", "product-manager"], accountableRoleId: "business-owner", currentAction: { kind: "chat-command", value: "@gaep /continue", label: "@gaep /continue" }, outputContractId: "governed-initiative-definition", evidenceFocus: "Reviewed change request, objectives, constraints, and stakeholder context", nextValidTransitions: ["initiative-classification", "source-intake"], implementedCtas: ["@gaep /continue", "Edit Initiative definition"], limitations: "Bounds a change; it does not authorize execution or funding.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", transitionType: "expanded", targetEvolution: "Adds richer entry-point assessment and Initiative topology/applicability metadata." }),
  checkpoint({ checkpointId: "initiative-classification", compatibilityAliases: [], title: "Initiative classification", purpose: "Classify change, risk, data/AI, regulatory, delivery, and assurance characteristics without silently resolving them.", whyItExists: "Classification selects applicable governance and competence requirements before irreversible design choices.", phase: foundation, order: 30, terminal: false, entryConditions: ["Governed Initiative definition exists"], prerequisites: ["initiative-definition"], requiredRoleArchetypeIds: ["initiative-lead", "risk-compliance-specialist", "security-architect", "privacy-specialist"], requiredCompetencyProfileIds: ["risk-compliance", "security", "privacy", "ai-literacy-limitations"], requiredInputContractIds: ["governed-initiative-definition", "classification-evidence"], prominentQuestions: ["Which risk, data, AI, regulatory, and delivery traits apply?", "Which classifications remain Unknown?", "Which assurance roles become mandatory?"], responsibleRoleIds: ["initiative-lead", "risk-compliance-specialist"], accountableRoleId: "business-owner", assuranceRoleIds: ["internal-audit-independent-assurance"], currentAction: { kind: "chat-command", value: "@gaep /classification", label: "@gaep /classification" }, outputContractId: "governed-initiative-classification", evidenceFocus: "Applicable policies, data/AI characteristics, jurisdictions, and risk evidence", nextValidTransitions: ["initiative-applicability"], implementedCtas: ["@gaep /classification", "Resolve open questions"], limitations: "Classification is scoped evidence, not an approval, risk acceptance, or waiver.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", transitionType: "expanded", targetEvolution: "Drives risk-based competency, assurance, and control applicability gateways." }),
  checkpoint({ checkpointId: "initiative-applicability", compatibilityAliases: [], title: "Initiative applicability", purpose: "Decide which governed concerns, methods, controls, and assurance obligations apply to the Initiative.", whyItExists: "Not every control applies equally, but exclusions require evidence and accountable disposition.", phase: foundation, order: 40, terminal: false, entryConditions: ["Current governed classification exists"], prerequisites: ["initiative-classification"], requiredRoleArchetypeIds: ["initiative-lead", "risk-compliance-specialist", "security-architect", "privacy-specialist", "legal-regulatory-specialist"], requiredCompetencyProfileIds: ["risk-compliance", "security", "privacy", "challenge-escalation"], requiredInputContractIds: ["governed-initiative-classification", "applicability-policy-set"], prominentQuestions: ["What applies and why?", "What is excluded and who is accountable?", "Which missing decisions block progression?"], responsibleRoleIds: ["initiative-lead", "risk-compliance-specialist"], accountableRoleId: "business-owner", assuranceRoleIds: ["internal-audit-independent-assurance"], currentAction: { kind: "chat-command", value: "@gaep /applicability", label: "@gaep /applicability" }, outputContractId: "governed-initiative-applicability", evidenceFocus: "Classification, policy, jurisdiction, risk, and explicit inclusion/exclusion rationale", nextValidTransitions: ["source-intake", "product-discovery"], implementedCtas: ["@gaep /applicability", "Resolve pending decisions"], limitations: "Applicability records scoped decisions; it does not grant approval, readiness, or execution authority.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", transitionType: "expanded", targetEvolution: "Connects applicability to competency, control, assurance, and exception requirements." }),
  checkpoint({ checkpointId: "source-intake", compatibilityAliases: [], title: "Source intake", purpose: "Review exact candidate material and record bounded Source identities without treating attachments as truth.", whyItExists: "Downstream candidates require reconstructable evidence rather than untraceable context or link-only claims.", phase: sources, order: 50, terminal: false, entryConditions: ["Product and Initiative exist", "Applicability prerequisites are current for Chat Intake"], prerequisites: ["initiative-definition"], requiredRoleArchetypeIds: ["initiative-lead", "domain-expert", "risk-compliance-specialist"], requiredCompetencyProfileIds: ["source-governance", "evidence-provenance", "candidate-accept-commit"], requiredInputContractIds: ["attachment-review-manifest", "governed-initiative-definition"], prominentQuestions: ["What exact content was reviewed?", "What are its identity, revision, freshness, limitations, and semantic standing?", "What remains link-only or unreadable?"], responsibleRoleIds: ["initiative-lead", "domain-expert"], accountableRoleId: "business-owner", currentAction: { kind: "chat-command", value: "@gaep /intake", label: "@gaep /intake then @gaep /record" }, outputContractId: "governed-source-record-set", evidenceFocus: "Exact selected bytes, extraction report, content digest, locator, and human review", nextValidTransitions: ["source-baseline", "source-provenance", "product-discovery"], implementedCtas: ["@gaep /intake", "@gaep /record", "Bind reviewed Sources to Initiative"], limitations: "Attachment and extraction do not establish Source correctness, authority, rights, or Baseline membership.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", transitionType: "expanded", targetEvolution: "Adds explicit removal, exclusion, supersession, unavailability, and source-change governance; those transitions are not currently executable." }),
  checkpoint({ checkpointId: "source-baseline", compatibilityAliases: [], title: "Source baseline", purpose: "Freeze exact Source identities and revisions for a bounded Initiative context.", whyItExists: "A decision must remain reconstructable even after referenced material changes.", phase: sources, order: 60, terminal: false, entryConditions: ["At least one governed Initiative Source exists"], prerequisites: ["source-intake"], requiredRoleArchetypeIds: ["initiative-lead", "domain-expert", "risk-compliance-specialist"], requiredCompetencyProfileIds: ["source-governance", "evidence-provenance", "auditability"], requiredInputContractIds: ["governed-source-record-set"], prominentQuestions: ["Which exact Source revisions are in scope?", "Is membership complete enough for the bounded decision?", "What changes require revalidation?"], responsibleRoleIds: ["initiative-lead"], accountableRoleId: "business-owner", currentAction: { kind: "chat-command", value: "@gaep /baseline", label: "@gaep /baseline" }, outputContractId: "governed-source-baseline", evidenceFocus: "Exact Source IDs, revisions, record/content digests, membership rationale, and freshness", nextValidTransitions: ["source-provenance", "product-discovery"], implementedCtas: ["@gaep /baseline", "Review details"], limitations: "A Baseline freezes membership; it does not approve content, establish precedence, or make evidence complete.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", transitionType: "retained", targetEvolution: "Adds selective membership change workflow and explicit downstream revalidation graph." }),
  checkpoint({ checkpointId: "source-provenance", compatibilityAliases: [], title: "Source provenance", purpose: "Record exact lineage, locators, transformations, derivations, uncertainty, and limitations.", whyItExists: "Baseline membership cannot explain how a claim or model was derived from a Source.", phase: sources, order: 70, terminal: false, entryConditions: ["Governed Source record exists"], prerequisites: ["source-intake"], requiredRoleArchetypeIds: ["initiative-lead", "domain-expert", "internal-audit-independent-assurance"], requiredCompetencyProfileIds: ["evidence-provenance", "source-governance", "auditability"], requiredInputContractIds: ["governed-source-record-set", "candidate-derivation-targets"], prominentQuestions: ["Which exact Source revision supports which target?", "What transformation or interpretation occurred?", "What uncertainty and limitations remain?"], responsibleRoleIds: ["initiative-lead", "domain-expert"], accountableRoleId: "business-owner", assuranceRoleIds: ["internal-audit-independent-assurance"], currentAction: { kind: "chat-command", value: "@gaep /provenance", label: "@gaep /provenance" }, outputContractId: "governed-source-provenance", evidenceFocus: "Exact Source/target revisions, locators, derivation roles, transformations, and limitations", nextValidTransitions: ["product-discovery"], implementedCtas: ["@gaep /provenance", "Revise Source provenance"], limitations: "Provenance records lineage; it does not establish correctness, authenticity, authority, or approval.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", transitionType: "retained", targetEvolution: "Extends lineage across design, backlog, implementation, release, and operations evidence." }),
  checkpoint({ checkpointId: "product-discovery", compatibilityAliases: [], title: "Product discovery", purpose: "Challenge and record business understanding, stakeholders, outcomes, needs, assumptions, and success measures.", whyItExists: "Architecture and backlog choices need evidence about users, value, viability, and uncertainty.", phase: { id: "product-discovery", label: "Product discovery", order: 3 }, order: 80, terminal: false, entryConditions: ["Initiative applicability and Source foundation are sufficient for bounded discovery"], prerequisites: ["initiative-applicability", "source-intake"], requiredRoleArchetypeIds: ["product-manager", "domain-expert", "product-design-research", "affected-user-stakeholder"], requiredCompetencyProfileIds: ["domain-business-analysis", "product-initiative-reasoning", "evidence-provenance", "product-design"], requiredInputContractIds: ["governed-initiative-applicability", "governed-source-record-set"], prominentQuestions: ["Which user and business problem is evidenced?", "Which outcomes and measures matter?", "What assumptions need testing?"], responsibleRoleIds: ["product-manager", "product-design-research"], accountableRoleId: "business-owner", currentAction: { kind: "chat-command", value: "@gaep /author", label: "@gaep /author" }, outputContractId: "governed-product-discovery", evidenceFocus: "User, stakeholder, business, outcome, and assumption evidence with provenance", nextValidTransitions: ["business-architecture"], implementedCtas: ["@gaep /author", "Review details", "Edit Product discovery"], limitations: "Discovery records remain evidence-bounded; they do not prove demand, viability, desirability, or investment approval.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", transitionType: "expanded", targetEvolution: "Adds iterative experiments, Product Design evidence ingestion, and outcome feedback loops." }),
  checkpoint({ checkpointId: "business-architecture", compatibilityAliases: [], title: "Business architecture", purpose: "Model capabilities, value streams, operating model, business rules, events, domains, and candidate boundaries.", whyItExists: "Solution architecture must trace to how the enterprise creates value and makes decisions.", phase: { id: "business-architecture", label: "Business architecture", order: 4 }, order: 90, terminal: false, entryConditions: ["Bounded Product discovery record exists"], prerequisites: ["product-discovery"], requiredRoleArchetypeIds: ["business-architect", "domain-expert", "enterprise-architect", "affected-user-stakeholder"], requiredCompetencyProfileIds: ["domain-business-analysis", "architecture-ddd", "evidence-provenance"], requiredInputContractIds: ["governed-product-discovery", "governed-source-baseline", "governed-source-provenance"], prominentQuestions: ["Which capabilities and value streams change?", "Which events, rules, domains, and ownership boundaries matter?", "Where are conflicts or unknowns?"], responsibleRoleIds: ["business-architect", "domain-expert"], accountableRoleId: "product-leadership", assuranceRoleIds: ["enterprise-architect"], currentAction: { kind: "chat-command", value: "@gaep /author", label: "@gaep /author" }, outputContractId: "governed-business-architecture", evidenceFocus: "Discovery, business rules, capabilities, value streams, events, domain language, and ownership evidence", nextValidTransitions: ["solution-security-architecture"], implementedCtas: ["@gaep /author", "Review details", "Edit Business architecture"], limitations: "Recorded models do not certify organizational design or force microservices; DDD is a reasoning policy, not a deployment prescription.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", transitionType: "split", targetEvolution: "Separates discovery, Event Storming, DDD strategic design, and business architecture while preserving traceability." }),
  checkpoint({ checkpointId: "solution-security-architecture", compatibilityAliases: [], title: "Solution and security architecture", purpose: "Select and challenge solution, data, AI, integration, security, privacy, and deployment architecture for the affected slice.", whyItExists: "Backlog finalization requires evidence-backed architecture sufficient to constrain the implementation slice.", phase: { id: "solution-security-architecture", label: "Solution and security architecture", order: 5 }, order: 100, terminal: false, entryConditions: ["Business/domain architecture is current enough for the affected slice"], prerequisites: ["business-architecture"], requiredRoleArchetypeIds: ["solution-architect", "data-ai-architect", "security-architect", "privacy-specialist", "platform-devops"], requiredCompetencyProfileIds: ["architecture-ddd", "security", "privacy", "risk-compliance", "repository-governance"], requiredInputContractIds: ["governed-business-architecture", "architecture-constraints", "applicable-control-outcomes"], prominentQuestions: ["Which architecture style fits the evidence and constraints?", "How are security, privacy, data, AI, integration, and deployment risks handled?", "What decisions and alternatives remain?"], responsibleRoleIds: ["solution-architect", "security-architect"], accountableRoleId: "enterprise-architect", assuranceRoleIds: ["risk-compliance-specialist", "internal-audit-independent-assurance"], currentAction: { kind: "chat-command", value: "@gaep /author", label: "@gaep /author" }, outputContractId: "governed-solution-security-architecture", evidenceFocus: "Architecture alternatives, constraints, threats, privacy/data/AI impacts, decisions, and verification evidence", nextValidTransitions: ["detailed-design-assurance"], implementedCtas: ["@gaep /author", "Review details", "Edit solution and security architecture"], limitations: "Architecture records do not create security, privacy, compliance, risk-acceptance, deployment, or implementation authority.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", transitionType: "expanded", targetEvolution: "Adds explicit data/AI, integration, deployment, repository-topology, and independent assurance decisions." }),
  checkpoint({ checkpointId: "detailed-design-assurance", compatibilityAliases: [], title: "Detailed design and assurance", purpose: "Complete process, data, authorization, integration, recovery, decisions, risks, evidence, and traceability for the affected slice.", whyItExists: "Architecture intent must become testable, challengeable, and traceable before architecture-bound backlog finalization.", phase: { id: "detailed-design-assurance", label: "Detailed design and assurance", order: 6 }, order: 110, terminal: false, entryConditions: ["Solution/security architecture decisions exist for the affected slice"], prerequisites: ["solution-security-architecture"], requiredRoleArchetypeIds: ["solution-architect", "security-architect", "quality-engineering", "ai-evaluation-tevv", "engineering-leadership"], requiredCompetencyProfileIds: ["architecture-ddd", "testing-assurance", "security", "risk-compliance", "auditability"], requiredInputContractIds: ["governed-solution-security-architecture", "assurance-criteria"], prominentQuestions: ["Are detailed models mutually consistent and traceable?", "Which tests and assurance evidence are required?", "Which risks, decisions, and recovery paths remain open?"], responsibleRoleIds: ["solution-architect", "quality-engineering"], accountableRoleId: "engineering-leadership", assuranceRoleIds: ["ai-evaluation-tevv", "internal-audit-independent-assurance"], currentAction: { kind: "chat-command", value: "@gaep /author", label: "@gaep /author" }, outputContractId: "governed-detailed-design-assurance", evidenceFocus: "Detailed models, threats, decisions, risks, tests, assurance findings, and end-to-end traceability", nextValidTransitions: ["p0-p4-readiness"], implementedCtas: ["@gaep /author", "Review details", "Edit detailed design and assurance"], limitations: "Models and assurance evidence do not establish release, production, security, privacy, compliance, or operational readiness.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", transitionType: "expanded", targetEvolution: "Separates Product Design, architecture-bound backlog, test design, repository topology, and implementation assurance." }),
  checkpoint({ checkpointId: "p0-p4-readiness", compatibilityAliases: ["design-implementation-handoff"], compatibilityNote: "The adoption alias remains accepted for historical plans; all current-runtime surfaces display one canonical P0–P4 readiness and handoff label.", title: "P0–P4 readiness and handoff", guideLabel: "P0–P4 readiness and handoff", purpose: "Evaluate the exact current records and prepare a bounded handoff without claiming Product Design, implementation, release, or operational execution.", whyItExists: "Downstream teams need a traceable readiness decision and explicit unresolved work before later lifecycle capabilities can activate.", phase: { id: "readiness-handoff", label: "Readiness and handoff", order: 7 }, order: 120, terminal: true, entryConditions: ["Detailed design and assurance records exist for the bounded slice"], prerequisites: ["detailed-design-assurance"], requiredRoleArchetypeIds: ["initiative-lead", "engineering-leadership", "quality-engineering", "release-change-management"], requiredCompetencyProfileIds: ["lifecycle-literacy", "testing-assurance", "delivery-release", "challenge-escalation"], requiredInputContractIds: ["governed-detailed-design-assurance", "p0-p4-readiness-criteria"], prominentQuestions: ["Which P0–P4 evidence is complete, partial, stale, or missing?", "What unresolved work blocks later activation?", "Who owns the bounded handoff and next decision?"], responsibleRoleIds: ["initiative-lead", "quality-engineering"], accountableRoleId: "engineering-leadership", assuranceRoleIds: ["internal-audit-independent-assurance"], currentAction: { kind: "chat-command", value: "@gaep /author", label: "@gaep /author" }, outputContractId: "governed-p0-p4-readiness-handoff", evidenceFocus: "Exact governed P0–P4 records, readiness criteria, challenge findings, unresolved decisions, and handoff contents", nextValidTransitions: [], implementedCtas: ["@gaep /author", "Review details", "Edit handoff inputs"], limitations: "This is the final current-runtime checkpoint. Product Design, backlog, implementation, CI/CD, release, deployment, and operations execution remain target-only.", implementationMaturity: "implemented-awaiting-product-owner-acceptance", transitionType: "replaced-by-tool-neutral-abstraction", targetEvolution: "Expands into tool-neutral Product Design, architecture-bound backlog, implementation allocation, QA, release, deployment, and operations nodes; optional Figma remains an adapter only." }),
] as const satisfies readonly ProductJourneyCheckpointContract[]

export type ProductJourneyCheckpointId = typeof currentProductJourneyCheckpointPresentation[number]["checkpointId"]

export const currentProductJourneyCheckpointIds = currentProductJourneyCheckpointPresentation
  .slice().sort((left, right) => left.order - right.order)
  .map((entry) => entry.checkpointId) as readonly ProductJourneyCheckpointId[]

export const currentProductJourneyCheckpointLabels = Object.fromEntries(
  currentProductJourneyCheckpointPresentation.map((entry) => [entry.checkpointId, entry.label]),
) as Readonly<Record<ProductJourneyCheckpointId, string>>

export function currentProductJourneyCheckpoint(id: ProductJourneyCheckpointId): ProductJourneyCheckpointContract {
  const value = currentProductJourneyCheckpointPresentation.find((entry) => entry.checkpointId === id)
  if (!value) throw new Error(`Unknown Product Journey checkpoint ${id}`)
  return value
}
