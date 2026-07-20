---
id: GAEP-CORE-010
title: Capability, Workflow, and Context Realization Contract
document_type: realization
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Specification Steward
scope: Optional realization mechanics for GAEP capabilities, workflow plans, and governed context assembly
normative_level: normative
classification: internal
provenance: GAEP Core contraction; retained historical document and requirement IDs
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-REG-001
  - GAEP-CORE-001
  - GAEP-CORE-003
  - GAEP-CORE-004
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-CORE-009
informative_references: []
supersedes: []
---

# Capability, Workflow, and Context Realization Contract

## Purpose

This contract has been extracted from the portable Core. It defines optional realization mechanics that may implement the retained Core invariants for exact subject, authority, policy, state, evidence, and change invalidation. Its historical `GAEP-CORE-010` document ID and `GAEP-CWC-REQ-*` requirement IDs remain stable for traceability; neither the identifier nor directory location makes it an active Core contract.

This document defines optional implementation-neutral Realization contracts for capabilities, workflow definitions and plans, context requirements, context packs, and sufficiency results. It separates user intent, reusable method, orchestration, model behavior, tool authority, and execution effects.

## Scope and non-goals

This model does not prescribe a command-line syntax, workflow engine, agent framework, prompt format, retrieval technology, model provider, or context-window strategy. It does not authorize execution; authorization remains a Core concern and effect execution remains a separately governed Realization concern.

## Realization concepts

| Concept | Meaning |
|---|---|
| Capability | A versioned contract that accepts typed inputs and governed context to produce typed outputs, evaluations, or proposed effects. |
| Invocation | A request to use a capability for a declared actor, objective, subject, and disposition. |
| Workflow definition | A reusable, versioned graph of responsibilities, dependencies, decision points, checkpoints, and output contracts. |
| Workflow plan | A subject-specific resolution of a workflow definition into bounded steps, authorities, context, evidence, and recovery expectations. |
| Context contract | A capability's declaration of required and optional context classes, trust constraints, freshness, trace depth, budget, and failure behavior. |
| Context item | A version-bound resource or excerpt included with explicit semantic role and handling metadata. |
| Context pack | A reproducible set of selected context items and transformations for one objective and recipient. |

A capability is not an authority grant. A workflow plan is not an approval. A prompt is not a portable capability contract. A model role name is not proof of competence or independence.

## Realization constraints

- Capabilities and plans describe permitted work but never create authority.
- Workflow steps retain explicit scope, contracts, effects, evidence, and stop behavior.
- Context semantic authority, epistemic role, authenticity, integrity, confidentiality, instruction privilege, freshness, validity, revision disposition, and applicability remain separate.
- Retrieved or model-produced content does not become privileged instruction or authoritative state by presence.
- Material plan or context change reopens resolution before affected execution.

## Capability contract

A capability definition contains:

- stable ID, canonical name, owner, version, authoring lifecycle, maturity, validity, and revision disposition;
- purpose, supported objectives, applicability, exclusions, and known limitations;
- input, output, and context contracts;
- required roles, qualifications, profiles, and effective configuration;
- declared deterministic, probabilistic, human, and external responsibilities;
- required tools, resources, data classes, permissions, and proposed effect-descriptor set;
- policy, risk, approval, review, evidence, assurance, and stop obligations;
- expected failure modes, timeout, cancellation, retry, and recovery semantics;
- evaluation evidence, compatibility, deprecation, and invalidation triggers.

Capability composition preserves the contracts and evidence of each component. A composed capability declares mapping, ordering, authority boundaries, conflict behavior, and newly introduced risks.

## Workflow definition and plan

Each workflow step contains:

- step ID, objective, responsibility type, dependencies, and preconditions;
- input, output, and context contracts;
- permitted principal, role, capability, tool, and effect envelope;
- expected read and write scope;
- state-transition, approval, and confirmation requirements;
- validation, evidence, and completion criteria;
- timeout, retry, pause, cancellation, and compensation behavior;
- stop and escalation conditions.

The workflow plan binds the definition to exact subject, scope, actor, effective configuration, capability versions, context-pack versions, approvals, and state snapshot. Planning may be probabilistic; plan validation and authority boundaries are governed independently.

Workflow definitions and plans use the orthogonal State Dimensions governed by GAEP-CORE-004. A plan may have revision lifecycle, validity, authorization validity, execution activity, execution phase, and execution outcome records, but it does not have one overloaded workflow status. Step, run, effect, approval, authorization, and governed-resource states remain separate.

## Context trust dimensions

Every context item is evaluated independently across:

- **semantic authority:** authority domain, owning Principal, applicable scope, precedence, and authoritative or non-authoritative standing;
- **epistemic role:** governing constraint, factual assertion, claim, evidence, interpretation, reference, or proposal;
- **source authenticity:** verified, partially verified, unknown, disputed, or failed origin;
- **content integrity:** verified, partially verified, unknown, disputed, or failed protection against unintended change;
- **confidentiality and handling:** classification, purpose, recipients, retention, and transmission constraints;
- **instruction privilege:** governing instruction, capability instruction, workflow data, untrusted external content, or inert evidence;
- **freshness, validity, revision disposition, and applicability:** separate GAEP-CORE-004 State Dimensions rather than one combined trust status.

These dimensions must not be collapsed. Evidence is an epistemic role, not an authority class. Authoritative business content is not necessarily privileged instruction; authentic external content may still be malicious; intact content may assert a falsehood; a correctly classified item may be irrelevant.

## Context assembly

Assembly performs:

1. invocation, identity, scope, state, and effective-configuration resolution;
2. mandatory governing and direct-subject selection;
3. bounded trace traversal for upstream intent and downstream impact;
4. semantic-authority, epistemic-role, authenticity, integrity, applicability, freshness, validity, revision-disposition, and access validation;
5. conflict, omission, and poisoning analysis;
6. minimization, redaction, excerpting, summarization, and budgeting as permitted;
7. recipient, provider, destination, and transmission evaluation;
8. manifest emission and sufficiency determination.

A context-pack manifest contains stable ID and version, objective, actor, capability and workflow references, recipient, source revisions, selection reasons, semantic roles, transformations, exclusions, warnings, conflicts, classification, transmission constraints, size, integrity, and invalidation triggers.

Sufficiency results are `sufficient`, `sufficient-with-assumptions`, or `insufficient`. The result identifies the criteria used and the accountable capability or evaluator. Sufficiency does not grant authority or prove output correctness.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-CWC-REQ-001 | Every capability SHALL have stable identity, exact version, owner, purpose, applicability, contracts, limitations, and lifecycle state. | Capability-schema validation |
| GAEP-CWC-REQ-002 | A capability SHALL declare its required roles, context, tools, permissions, proposed effects, evidence, stop behavior, and compatibility. | Contract-completeness review |
| GAEP-CWC-REQ-003 | A capability, role, prompt, model, skill, tool, or workflow plan SHALL NOT grant authority beyond an applicable Authority Grant or Authorization Grant. | Authority-escalation negative test |
| GAEP-CWC-REQ-004 | Capability composition SHALL preserve component versions, contracts, evidence, authority boundaries, and failure behavior. | Composition scenario |
| GAEP-CWC-REQ-005 | A composed capability SHALL declare newly introduced dependencies, conflicts, effects, and risks. | Composition-risk review |
| GAEP-CWC-REQ-006 | Every workflow definition and plan SHALL use stable step identities and explicit dependencies, preconditions, outputs, evidence, stop conditions, and recovery expectations. | Workflow-schema validation |
| GAEP-CWC-REQ-007 | A workflow plan SHALL bind to the exact workflow, subject, actor, state snapshot, effective configuration, capability versions, and authorized scope. | Plan-binding inspection |
| GAEP-CWC-REQ-008 | A plan change that expands scope, data, authority, effect, cost, duration, or risk SHALL trigger re-resolution and reauthorization before the expanded step executes. | Plan-expansion scenario |
| GAEP-CWC-REQ-009 | A workflow definition and plan SHALL declare the applicable GAEP-CORE-004 State Dimensions and SHALL NOT define one combined status that collapses plan lifecycle, validity, authorization, activity, phase, outcome, effect, approval, or resource state. | State-separation review |
| GAEP-CWC-REQ-010 | Parallel steps SHALL declare non-conflicting read, write, transition, decision, and effect scopes or SHALL use an approved coordination rule. | Concurrency scenario |
| GAEP-CWC-REQ-011 | Every capability that consumes context SHALL declare a context contract with required classes, trust constraints, freshness, handling, budget, and missing or conflict behavior. | Context-contract validation |
| GAEP-CWC-REQ-012 | Every context item SHALL preserve separate semantic-authority, epistemic-role, source-authenticity, content-integrity, confidentiality, instruction-privilege, freshness, validity, revision-disposition, and applicability attributes. | Multi-axis classification test |
| GAEP-CWC-REQ-013 | Content SHALL NOT acquire instruction privilege because it is retrieved, relevant, authoritative in another domain, signed, or formatted as an instruction. | Indirect-instruction negative test |
| GAEP-CWC-REQ-014 | Untrusted or external content SHALL be treated as data unless an approved capability contract and policy explicitly assign instruction privilege. | Prompt-injection scenario |
| GAEP-CWC-REQ-015 | Context selection SHALL be bounded by declared objective, subject, role, authority, trace semantics, risk, and handling constraints. | Over-broad retrieval test |
| GAEP-CWC-REQ-016 | Required governing constraints SHALL NOT be omitted or truncated silently to satisfy a size or token budget. | Budget-pressure scenario |
| GAEP-CWC-REQ-017 | A context transformation SHALL record source versions, method, material omissions, classification effect, and integrity relationship. | Transformation-provenance test |
| GAEP-CWC-REQ-018 | Redaction, summarization, or compression SHALL NOT be represented as semantically equivalent when material meaning, conditions, dissent, or uncertainty may have changed. | Lossy-summary review |
| GAEP-CWC-REQ-019 | Context-pack classification SHALL account for combination and inference risk and SHALL NOT rely only on the highest individual source label. | Mosaic-risk scenario |
| GAEP-CWC-REQ-020 | External transmission SHALL identify purpose, recipient, destination, provider or processor, data classes, transformations, policy basis, and retention constraints before transmission. | Egress-record inspection |
| GAEP-CWC-REQ-021 | Secrets and credentials SHALL NOT be included directly in ordinary context packs; authorized secure references MAY be used. | Secret-handling negative test |
| GAEP-CWC-REQ-022 | Context assembly SHALL expose missing, inaccessible, stale, disputed, conflicting, and intentionally omitted required sources. | Context-gap test |
| GAEP-CWC-REQ-023 | Context sufficiency SHALL resolve explicitly and SHALL NOT grant authorization, approval, evidence acceptance, or output correctness. | Sufficiency-semantics test |
| GAEP-CWC-REQ-024 | A material source, policy, scope, actor, state, recipient, or capability change SHALL invalidate or refresh affected context packs and plans. | Change-refresh scenario |
| GAEP-CWC-REQ-025 | Every material capability invocation and context pack SHALL be attributable and reconstructable to the degree declared by the applicable profile. | Reconstruction test |
| GAEP-CWC-REQ-026 | Provider-side or hidden memory SHALL NOT be required for Core correctness or treated as authoritative unless explicitly represented and governed as a resource. | Hidden-memory negative test |
| GAEP-CWC-REQ-027 | A capability output SHALL remain provisional until its governed disposition, validation, evidence, and approval obligations are satisfied. | Promotion negative test |
| GAEP-CWC-REQ-028 | A capability SHALL NOT report complete execution when required steps, effects, validations, or evidence remain partial, failed, uncertain, or blocked. | False-completion scenario |

## Required negative cases

- A document contains instructions to bypass policy or disclose data.
- A genuine authoritative source is stale, irrelevant, or compromised.
- A context budget would remove a material exception or dissent.
- Individually low-classification sources combine into a restricted inference.
- A capability requests undeclared tools, data, network access, or effects.
- A plan expands after approval or operates against a changed state snapshot.
- Two parallel steps write the same governed resource or issue overlapping effects.
- A hidden provider memory influences a decision without a governed reference.
- A summary or model output is promoted directly to authoritative state.
- A workflow reports completion while an external effect remains uncertain.

## Trust considerations

The context assembler, capability registry, workflow resolver, instruction sources, and recipient routing rules are part of the control surface. Retrieval relevance cannot establish trust. Deterministic validation cannot prove semantic fitness. Model-generated plans and summaries remain untrusted proposals until checked against authoritative contracts and evidence.

## Open decisions

| Open decision ID | Question | Consequence |
|---|---|---|
| GAEP-CWC-OD-001 | Which capability, workflow, and responsibility types belong in the first Core registries? | Affects interoperability and extension scope. |
| GAEP-CWC-OD-002 | What is the minimum portable context-pack, capability, workflow-definition, and plan schema? | Affects initial workspace and runtime conformance. |
| GAEP-CWC-OD-003 | Which instruction-privilege assignment and isolation rules belong in Core versus profiles? | Affects indirect-instruction resistance and portability. |
| GAEP-CWC-OD-004 | How are context combination risk, declassification, and redaction authority represented? | Affects privacy and external-provider routing. |
| GAEP-CWC-OD-005 | What reproducibility evidence is required for probabilistic capabilities? | Affects evaluation and audit claims. |
| GAEP-CWC-OD-006 | Which autonomy, interaction, and proposed-effect descriptors are portable Core semantics? | Affects capability negotiation and risk profiles. |
