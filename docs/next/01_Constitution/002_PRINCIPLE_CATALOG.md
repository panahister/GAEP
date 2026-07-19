---
id: GAEP-CST-002
title: GAEP Principle Catalog
document_type: principle-catalog
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Specification Steward
scope: Interpretation and design evaluation principles for GAEP product, specifications, profiles, workspaces, realizations, adapters, and adoption
normative_level: normative
classification: internal
provenance: GAEP pre-implementation constitutional restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-001
  - GAEP-CST-003
informative_references:
  - ../../01_Foundation/003_PLATFORM_PHILOSOPHY.md
  - ../../01_Foundation/004_CORE_PRINCIPLES.md
  - ../../01_Foundation/005_DESIGN_PRINCIPLES.md
  - ../../01_Foundation/006_ADAPTIVE_ENGINEERING_PRINCIPLES.md
supersedes: []
---

# GAEP Principle Catalog

## Proposed status and purpose

This catalog is Proposed and not approved. It consolidates candidate interpretation and design principles beneath the Proposed Constitution. It does not supersede the legacy principle documents, authorize implementation, or resolve the open product and constitutional decisions.

The Constitution owns durable law. This catalog gives reviewers addressable principles for evaluating a product decision, Core requirement, profile, workspace, realization, adapter, workflow, or adoption proposal. A principle cannot weaken or amend a constitutional requirement.

## How to use the catalog

For a material proposal:

1. identify applicable constitutional requirements;
2. select the principles materially affected;
3. record how the proposal supports or trades against them;
4. identify evidence, uncertainty, affected people, and alternatives;
5. resolve any conflict at the authority appropriate to the governing requirements;
6. retain deviations, dissent, conditions, and review triggers.

Checking every principle mechanically is not the intended outcome. Omitting a materially applicable principle without rationale is also not acceptable.

## Principle precedence and tension

Principles are not ranked as a universal list. Context may create tension, such as minimum context versus decision completeness, local autonomy versus shared semantics, or reversibility versus urgent protection. Resolution follows applicable law and rights, the Constitution, approved policy, legitimate authority, and evidence proportionate to consequence.

The following are never valid tradeoff techniques:

- treating a lower-authority preference as an override;
- hiding an affected principle;
- claiming that speed, AI capability, cost, or popularity ends the analysis;
- converting an unresolved conflict into silent permission;
- using a principle slogan without examining its operational consequence.

## A. Purpose, authority, and people

| Principle ID | Principle | Constitutional basis | Verification prompt |
|---|---|---|---|
| GAEP-PRN-001 | **Accountability remains attributable.** Consequential decisions and effects SHALL retain identifiable human or legally recognized organizational accountability. | GAEP-CST-REQ-001, GAEP-CST-REQ-005, GAEP-CST-REQ-006, GAEP-CST-REQ-007, GAEP-CST-REQ-008 | Who remains accountable after delegation or automation? |
| GAEP-PRN-002 | **Authority before capability.** Ability to read, generate, write, execute, fund, or merge SHALL NOT be treated as permission to decide or act. | GAEP-CST-REQ-005, GAEP-CST-REQ-006, GAEP-CST-REQ-007, GAEP-CST-REQ-008, GAEP-CST-REQ-009, GAEP-CST-REQ-048 | What establishes legitimate authority for this exact subject and effect? |
| GAEP-PRN-003 | **Meaningful human agency.** Human review SHALL provide sufficient information, competence, time, independence, contestability, and real decision options. | GAEP-CST-REQ-009, GAEP-CST-REQ-013 | Could the human reasonably understand, challenge, condition, reject, or stop? |
| GAEP-PRN-004 | **Dignity and rights by design.** GAEP-supported work SHALL account for affected people, accessibility, privacy, nondiscrimination, labor, consultation, and due process as applicable. | GAEP-CST-REQ-010, GAEP-CST-REQ-011, GAEP-CST-REQ-012 | Who bears the consequence, and what recourse and protection exist? |
| GAEP-PRN-005 | **No surveillance by convenience.** Evidence and telemetry SHALL be purpose-limited and SHALL NOT drift silently into individual productivity or disciplinary monitoring. | GAEP-CST-REQ-011, GAEP-CST-REQ-038 | Could this evidence be used against a person beyond the declared purpose? |

## B. Knowledge, claims, and context

| Principle ID | Principle | Constitutional basis | Verification prompt |
|---|---|---|---|
| GAEP-PRN-006 | **Evidence before confidence.** Claims of correctness, safety, compliance, readiness, or outcome SHALL rely on proportionate evidence rather than fluency, confidence, approval, or successful execution alone. | GAEP-CST-REQ-014, GAEP-CST-REQ-015, GAEP-CST-REQ-016, GAEP-CST-REQ-017, GAEP-CST-REQ-018 | What evidence warrants the claim, and what does it not prove? |
| GAEP-PRN-007 | **Uncertainty remains visible.** Material assumptions, unknowns, conflicts, omissions, limitations, and disconfirming evidence SHALL be disclosed rather than smoothed into one confident answer. | GAEP-CST-REQ-014, GAEP-CST-REQ-016, GAEP-CST-REQ-018 | What could change this conclusion? |
| GAEP-PRN-008 | **Authority-aware source federation.** GAEP SHALL preserve authority, ownership, version, state, and access across GAEP-native and external sources without centralizing all truth by default. | GAEP-CST-REQ-019, GAEP-CST-REQ-020, GAEP-CST-REQ-021, GAEP-CST-REQ-022, GAEP-CST-REQ-023 | Where is the truth owned, and how is that authority resolved? |
| GAEP-PRN-009 | **Minimum sufficient context.** Context SHALL be no broader than required for the approved purpose and no narrower than required to preserve governing constraints and material evidence. | GAEP-CST-REQ-021, GAEP-CST-REQ-022, GAEP-CST-REQ-037, GAEP-CST-REQ-038 | What can be excluded safely, and which omission must remain visible? |
| GAEP-PRN-010 | **Provenance over conversational memory.** Material context and outcomes SHALL remain attributable to durable sources; temporary conversation or provider memory SHALL NOT become authority silently. | GAEP-CST-REQ-014, GAEP-CST-REQ-019, GAEP-CST-REQ-023, GAEP-CST-REQ-029 | Can another authorized reviewer recover the source and transformation? |

## C. State, trace, decision, and change

| Principle ID | Principle | Constitutional basis | Verification prompt |
|---|---|---|---|
| GAEP-PRN-011 | **Explicit multidimensional state.** Lifecycle, approval, freshness, applicability, validity, conformance, execution, and retention SHALL remain distinguishable and transition explicitly. | GAEP-CST-REQ-024, GAEP-CST-REQ-025, GAEP-CST-REQ-026, GAEP-CST-REQ-027 | Which state dimension changed, under what precondition and authority? |
| GAEP-PRN-012 | **Version-bound decisions.** Approval, authorization, exception, and conformance SHALL bind to exact subjects and SHALL be reconsidered when declared invalidation conditions occur. | GAEP-CST-REQ-005, GAEP-CST-REQ-025, GAEP-CST-REQ-057, GAEP-CST-REQ-060 | What exact revision was decided, and when does the decision cease to apply? |
| GAEP-PRN-013 | **Trace for a purpose.** Trace SHALL support a declared impact, evidence, decision, navigation, conformance, or learning job; link volume SHALL NOT be an outcome. | GAEP-CST-REQ-028, GAEP-CST-REQ-029, GAEP-CST-REQ-030, GAEP-CST-REQ-031 | What question becomes answerable because this relationship exists? |
| GAEP-PRN-014 | **Change triggers bounded re-evaluation.** Material change SHALL identify actually affected decisions, evidence, profiles, authorities, and downstream obligations rather than regenerate everything or ignore impact. | GAEP-CST-REQ-025, GAEP-CST-REQ-065, GAEP-CST-REQ-070 | What became stale, invalid, unaffected, or newly required? |
| GAEP-PRN-015 | **History is not silently rewritten.** Identity, decisions, supersession, invalidation, and migration SHALL preserve enough history for applicable reconstruction and accountability. | GAEP-CST-REQ-031, GAEP-CST-REQ-066, GAEP-CST-REQ-067 | Can the prior valid interpretation and transition still be explained? |

## D. Adaptivity, risk, and governance

| Principle ID | Principle | Constitutional basis | Verification prompt |
|---|---|---|---|
| GAEP-PRN-016 | **Applicability before ceremony.** A supported activity, artifact, profile, or tool SHALL be required only when an approved obligation or user outcome makes it applicable. | GAEP-CST-REQ-003, GAEP-CST-REQ-032, GAEP-CST-REQ-033, GAEP-CST-REQ-034, GAEP-CST-REQ-035, GAEP-CST-REQ-036, GAEP-CST-REQ-061 | Why does this scope require this work? |
| GAEP-PRN-017 | **Risk-proportionate governance.** Control depth SHALL reflect consequence, sensitivity, blast radius, reversibility, uncertainty, and cost of failure without silently omitting mandatory protection. | GAEP-CST-REQ-032, GAEP-CST-REQ-033, GAEP-CST-REQ-034, GAEP-CST-REQ-035, GAEP-CST-REQ-036, GAEP-CST-REQ-063 | What makes this control proportionate, and what risk remains? |
| GAEP-PRN-018 | **Governance must earn its burden.** Mandatory fields, artifacts, reviews, gates, and maintenance SHALL have a declared purpose and measured participant burden. | GAEP-CST-REQ-061, GAEP-CST-REQ-062, GAEP-CST-REQ-063, GAEP-CST-REQ-064 | What work does this replace or what material failure does it prevent? |
| GAEP-PRN-019 | **Fail explicitly, not optimistically.** Missing authority, mandatory context, valid state, safety condition, or recovery SHALL produce a visible block, denial, narrowing, or escalation. | GAEP-CST-REQ-008, GAEP-CST-REQ-027, GAEP-CST-REQ-036, GAEP-CST-REQ-049 | What happens when the required condition is absent or conflicted? |
| GAEP-PRN-020 | **Exceptions remain exceptional.** A deviation SHALL be scoped, owned, evidence-backed, time- or condition-bounded, compensated where needed, reviewable, and closed. | GAEP-CST-REQ-035, GAEP-CST-REQ-036 | When does this exception expire, and what prevents normalization? |
| GAEP-PRN-021 | **Federation with bounded autonomy.** Shared Core meaning SHALL coexist with organizational and initiative-local authority; neither central control nor local preference SHALL create silent semantic divergence. | GAEP-CST-REQ-002, GAEP-CST-REQ-003, GAEP-CST-REQ-034, GAEP-CST-REQ-054 | Which decision belongs centrally, locally, or to an external authority? |

## E. Security, architecture, assurance, and execution

| Principle ID | Principle | Constitutional basis | Verification prompt |
|---|---|---|---|
| GAEP-PRN-022 | **Least data and least authority.** Actors and capabilities SHALL receive only the information, permissions, duration, and environment required for the approved purpose. | GAEP-CST-REQ-037, GAEP-CST-REQ-038, GAEP-CST-REQ-039, GAEP-CST-REQ-040, GAEP-CST-REQ-041 | What is the smallest safe access and authority envelope? |
| GAEP-PRN-023 | **Intentional boundaries before consequential encoding.** Applicable responsibility, trust, identity, data, interface, failure, and recovery decisions SHALL be resolved before they are embedded accidentally in material implementation or effect. | GAEP-CST-REQ-043, GAEP-CST-REQ-044 | Which unresolved boundary would become expensive or unsafe if encoded now? |
| GAEP-PRN-024 | **Assurance is designed with the claim.** Acceptance, methods, evidence, and residual-risk authority SHALL be selected before the gate or claim they support. | GAEP-CST-REQ-045, GAEP-CST-REQ-046, GAEP-CST-REQ-047 | What would demonstrate sufficient confidence for this specific claim? |
| GAEP-PRN-025 | **Deterministic controls around probabilistic reasoning.** Machine-checkable identity, state, policy, authority, and effect boundaries SHOULD constrain probabilistic analysis where doing so materially improves safety or reproducibility. | GAEP-CST-REQ-024, GAEP-CST-REQ-025, GAEP-CST-REQ-026, GAEP-CST-REQ-027, GAEP-CST-REQ-048, GAEP-CST-REQ-049, GAEP-CST-REQ-050, GAEP-CST-REQ-051, GAEP-CST-REQ-052 | Which decision can be validated deterministically, and which still requires judgment? |
| GAEP-PRN-026 | **Small, bounded, recoverable effects.** Work SHOULD proceed through coherent increments that are previewable, independently reviewable, observable, and reversible where practical. | GAEP-CST-REQ-044, GAEP-CST-REQ-048, GAEP-CST-REQ-049, GAEP-CST-REQ-050, GAEP-CST-REQ-051, GAEP-CST-REQ-052 | What is the smallest effect that produces useful evidence and can be recovered? |
| GAEP-PRN-027 | **Stop is a valid outcome.** A workflow SHALL preserve safe pause, denial, rollback, manual fallback, and escalation rather than treating completion as mandatory. | GAEP-CST-REQ-049, GAEP-CST-REQ-050, GAEP-CST-REQ-051, GAEP-CST-REQ-052, GAEP-CST-REQ-075 | Can participants stop safely without inventing progress or losing required state? |

## F. Portability, conformance, reuse, and stewardship

| Principle ID | Principle | Constitutional basis | Verification prompt |
|---|---|---|---|
| GAEP-PRN-028 | **Stable semantics, replaceable realizations.** Core meaning SHALL remain independent of provider, technology, runtime, repository, and interface choices. | GAEP-CST-REQ-053, GAEP-CST-REQ-054, GAEP-CST-REQ-055, GAEP-CST-REQ-056 | Can a different realization preserve the governed meaning? |
| GAEP-PRN-029 | **Honest conformance.** Claims SHALL identify exact classes, versions, profiles, bindings, evidence, unsupported requirements, and deviations. | GAEP-CST-REQ-057, GAEP-CST-REQ-058, GAEP-CST-REQ-059, GAEP-CST-REQ-060 | What exactly conforms, to what, and with which declared loss? |
| GAEP-PRN-030 | **Profiles specialize; they do not erode.** Profiles SHALL add or select within declared variation points and SHALL NOT silently weaken Core prohibitions or invariants. | GAEP-CST-REQ-002, GAEP-CST-REQ-003, GAEP-CST-REQ-034 | Is this a legitimate specialization or a hidden override? |
| GAEP-PRN-031 | **Reuse requires contextual fitness.** Reused assets SHALL retain provenance, version, authority, applicability, compatibility, evidence, and local decision ownership. | GAEP-CST-REQ-068, GAEP-CST-REQ-069 | Why is this asset fit here, and who accepts its consequences? |
| GAEP-PRN-032 | **Portability includes exit.** A supported realization or adapter SHALL make migration, fallback, deprecation, and loss visible before dependency expands. | GAEP-CST-REQ-055, GAEP-CST-REQ-056, GAEP-CST-REQ-075 | What remains usable if this provider or realization disappears? |
| GAEP-PRN-033 | **Evolution preserves interpretable history.** Normative change SHALL preserve identifiers, compatibility decisions, migration, evidence, and affected-user communication. | GAEP-CST-REQ-065, GAEP-CST-REQ-066, GAEP-CST-REQ-067, GAEP-CST-REQ-068, GAEP-CST-REQ-069, GAEP-CST-REQ-070 | How will existing workspaces and claims remain interpretable? |

## G. Product discipline and implementation boundary

| Principle ID | Principle | Constitutional basis | Verification prompt |
|---|---|---|---|
| GAEP-PRN-034 | **Product evidence before platform expansion.** Capability growth SHALL trace to validated user work, a constitutional need, conformance evidence, or a bounded experiment. | GAEP-CST-REQ-071, GAEP-CST-REQ-072, GAEP-CST-REQ-073, GAEP-CST-REQ-074, GAEP-CST-REQ-075 | What evidence justifies this scope now? |
| GAEP-PRN-035 | **Conceptual completeness is not readiness.** A comprehensive specification, prototype, merge, or approval SHALL NOT be treated as implementation authorization without the separate readiness gate. | GAEP-CST-REQ-073, GAEP-CST-REQ-074 | What exact authority permits implementation or effect? |
| GAEP-PRN-036 | **Measure value and total burden together.** Product decisions SHALL consider user outcome, engineering quality, risk, trust, portability, support, maintenance, and total cost. | GAEP-CST-REQ-062, GAEP-CST-REQ-063, GAEP-CST-REQ-072 | Which benefit survives after all participant and operating costs are counted? |
| GAEP-PRN-037 | **Negative evidence changes direction.** Failed scenarios, counterevidence, incidents, and excessive burden SHALL be retained and SHALL be able to narrow, pivot, pause, or stop the product. | GAEP-CST-REQ-070, GAEP-CST-REQ-071, GAEP-CST-REQ-072, GAEP-CST-REQ-075 | What evidence would cause us not to proceed? |

## Principle application record

For a material proposal, a principle application record should contain:

- proposal and exact subject version;
- applicable constitutional requirements;
- selected principle IDs and rationale;
- supported and adversely affected principles;
- evidence and uncertainty;
- alternatives, including simpler action and no action;
- affected people and authorities;
- risk, burden, compatibility, and exit;
- decision, conditions, dissent, and review trigger.

The record is not a scorecard in which a majority of principles defeats a constitutional prohibition.

## Common misuse

- invoking “vendor neutrality” to avoid choosing a fit technology at the appropriate lower layer;
- invoking “repository as memory” to copy every external authority into files;
- invoking “human approval” after making approval incomprehensible or inevitable;
- invoking “risk proportionate” to omit required security or evidence;
- invoking “architecture before implementation” to demand exhaustive upfront design;
- invoking “adaptivity” to avoid consistent Core meaning;
- invoking “traceability” to maximize links without a user question;
- invoking “explainability” to produce long rationale without usable evidence;
- invoking “automation” to hide delegated authority or side effects;
- invoking “reuse” to impose a contextually unfit organizational asset;
- invoking “open” or “conforming” without approved rights or evidence;
- invoking “future extensibility” to justify untested complexity.

## Catalog governance requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-PRN-CAT-REQ-001 | Every normative principle SHALL have a stable unique ID and SHALL trace to one or more constitutional requirements. | Catalog validation |
| GAEP-PRN-CAT-REQ-002 | A proposal SHALL identify materially applicable principles and SHALL record unresolved principle tensions when they could change the decision. | Application-record review |
| GAEP-PRN-CAT-REQ-003 | A principle SHALL NOT be used to weaken, bypass, or implicitly amend a constitutional requirement. | Authority-conflict review |
| GAEP-PRN-CAT-REQ-004 | Retired principle IDs SHALL remain reserved and SHALL identify replacement or retirement rationale. | Registry review |
| GAEP-PRN-CAT-REQ-005 | A new principle SHALL identify the recurring decision problem it resolves, constitutional basis, non-duplication analysis, expected verification, and downstream effect. | Principle-proposal review |
| GAEP-PRN-CAT-REQ-006 | Editorial restatement SHALL NOT create a second altered normative version of an existing principle. | Requirement-ownership review |

## Assumptions and open decisions

The catalog assumes that a smaller addressable set will be more usable than the overlapping legacy Philosophy, Core Principles, Design Principles, and Adaptive Engineering Principles. That assumption requires review with real proposals.

| Decision ID | Open decision |
|---|---|
| GAEP-PRN-DEC-001 | Is the catalog small enough for consistent application, or should some principles become guidance? |
| GAEP-PRN-DEC-002 | Which principles require dedicated conformance scenarios? |
| GAEP-PRN-DEC-003 | Are any principle statements duplicative of Core requirements rather than constitutional interpretation? |
| GAEP-PRN-DEC-004 | What authority approves additions, retirement, or semantic change to principles? |
| GAEP-PRN-DEC-005 | What exact legacy principle versions would an approved catalog supersede? |
| GAEP-PRN-DEC-006 | How will users record principle application without creating checklist theater? |

No legacy principle is superseded until the catalog and migration disposition receive version-bound approval.
