---
id: GAEP-ADAPT-001
title: Agent Adapter Conformance
document_type: adapter-profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Integration Steward
scope: AI agent and tool adapters
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-CORE-002
  - GAEP-CORE-010
  - GAEP-CORE-011
  - GAEP-CORE-012
  - GAEP-REAL-002
informative_references: []
supersedes: []
---

# Agent Adapter Conformance

## Purpose

An adapter translates between GAEP contracts and a particular agent, model provider, tool host, or execution surface. It declares only capability and semantic deltas. It does not redefine GAEP Core behavior.

An adapter is therefore a boundary contract, not a trust shortcut. Provider availability, a successful demonstration, a persuasive model response, or a user's conversational consent does not establish identity, policy compliance, approval, or executable authorization.

## Adapter package boundary

An adapter package contains four separately versioned subjects:

1. an **adapter definition**, which describes the mapping and its implementation-neutral contract;
2. an **environment binding**, which identifies the configured provider, model, tools, policies, data boundary, and deployment mode;
3. an **evaluation result**, which records what was demonstrated for an exact definition and environment binding; and
4. an **activation record**, which records whether an authorized runtime may select that evaluated binding for a bounded scope.

Changing one subject does not silently update the others. Activation is invalid when its bound adapter definition, environment, required evaluation, policy, authority, or dependency validity no longer holds.

## Capability declaration

An adapter manifest identifies:

- adapter lineage ID, immutable revision identity or digest, semantic version, schema version, publisher and integrity reference;
- supported GAEP Core, profile, realization and adapter-contract version ranges;
- exact dependency bindings used by the evaluated environment;
- agent, provider, deployment mode, model, tool host, skill, extension and tool identities and versions where observable;
- supported capabilities, commands, input/output types and canonical Core effect descriptors;
- authorization and human-interaction mechanisms;
- context limits, redaction support and data-use constraints;
- determinism and reproducibility limitations;
- checkpoint, cancellation, retry and recovery behavior;
- telemetry and evidence capabilities;
- unsupported requirements, degraded modes and known mapping losses;
- dependency, supply-chain, lifecycle and retirement information.

Unknown or provider-hidden attributes remain explicitly unknown. A convenient label such as `latest`, a marketing family name, or an unverified provider claim is not an immutable version binding.

## Mapping truth classes

Every material manifest statement is classified as one of:

- **observed** — demonstrated by retained evaluation evidence for the bound environment;
- **provider-declared** — supported by a dated, versioned authoritative provider source;
- **configured** — established by configuration under the adopter's control;
- **inferred** — reasoned from other evidence but not directly demonstrated; or
- **unknown** — not established.

Only observed or otherwise explicitly accepted evidence may support a conformance or authorization decision. Classification does not by itself establish sufficiency.

## Semantic mapping table

For every supported capability or effect, the adapter definition records:

| Field | Meaning |
|---|---|
| GAEP subject | canonical capability, input, output, event, state, evidence, or effect term |
| provider subject | exact provider/tool surface and version |
| direction | inbound, outbound, or bidirectional |
| fidelity | exact, narrowed, extended, lossy, or unsupported |
| preconditions | identity, policy, context, data, authorization, and environment requirements |
| failure semantics | refusal, timeout, cancellation, partial result, partial effect, unknown result, and recovery behavior |
| evidence | what proves request, actual behavior, and resulting effect |
| invalidation | changes or observations that end reliance on the mapping |

An extension remains namespaced. It cannot be represented as a canonical Core capability merely because the provider exposes a similar feature.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-ADAPT-REQ-001 | An adapter SHALL publish a versioned capability declaration before use in a governed run. | Manifest review |
| GAEP-ADAPT-REQ-002 | An adapter SHALL NOT claim a capability it cannot demonstrate under the declared environment and provider version. | Conformance scenario |
| GAEP-ADAPT-REQ-003 | Unsupported or lossy semantic mappings SHALL be explicit and SHALL influence conformance and authorization decisions. | Mapping review |
| GAEP-ADAPT-REQ-004 | Adapter defaults SHALL NOT weaken policy, classification, authorization, evidence, or retention requirements. | Negative configuration test |
| GAEP-ADAPT-REQ-005 | The adapter SHALL preserve requested versus actual effects and normalize failures without disguising partial execution. | Failure scenario |
| GAEP-ADAPT-REQ-006 | Provider, model, adapter, skill, prompt policy, or material tool-version changes SHALL trigger declared compatibility and evaluation consequences. | Upgrade scenario |
| GAEP-ADAPT-REQ-007 | The adapter SHALL expose provider-side data handling, storage, training-use, residency, and deletion constraints known to it. | Data contract review |
| GAEP-ADAPT-REQ-008 | Agent-originated actions SHALL remain attributable to an agent/service principal and an accountable human or organizational authority chain. | Trace review |
| GAEP-ADAPT-REQ-009 | Adapter installation and update SHALL be treated as a capability supply-chain change with provenance and integrity evidence proportionate to risk. | Supply-chain review |
| GAEP-ADAPT-REQ-010 | A runtime SHALL be able to refuse or disable an adapter whose integrity, compatibility, evaluation, authorization, or policy status is invalid. | Revocation scenario |
| GAEP-ADAPT-REQ-011 | Adapter definition, environment binding, evaluation result, and activation record SHALL be separate version-bound subjects. | Record-schema review |
| GAEP-ADAPT-REQ-012 | Every material mapping claim SHALL declare its truth class and evidence reference; unknowns SHALL remain explicit. | Manifest and evidence review |
| GAEP-ADAPT-REQ-013 | A conversational statement, provider-native approval control, or tool-host permission SHALL NOT be treated as a GAEP Approval Determination or Authorization Grant unless an approved mapping proves all required semantics and bindings. | Adversarial authorization scenario |
| GAEP-ADAPT-REQ-014 | Every effect mapping SHALL preserve the canonical Core effect descriptor and SHALL identify requested, attempted, observed, committed, failed, compensated, and unknown outcomes without collapsing them. | Partial-effect scenario |
| GAEP-ADAPT-REQ-015 | Secrets SHALL be referenced through an authorized credential mechanism and SHALL NOT be placed in prompts, manifests, traces, or evidence unless an explicit higher-authority rule permits that exact disclosure. | Secret-exposure negative test |
| GAEP-ADAPT-REQ-016 | Context assembly SHALL preserve source, authority, classification, freshness, transformation, and selection provenance and SHALL treat provider memory or summaries as derived context. | Context-provenance scenario |
| GAEP-ADAPT-REQ-017 | An adapter SHALL declare model/provider data-use, retention, deletion, residency, human-access, training-use, subprocessors, and isolation facts as observed, provider-declared, configured, inferred, or unknown. | Data-boundary review |
| GAEP-ADAPT-REQ-018 | Unsupported identity, revocation, evidence, data, or effect semantics SHALL fail closed for the affected operation unless an approved, scoped policy exception explicitly permits a safe alternative. | Degraded-mode negative test |
| GAEP-ADAPT-REQ-019 | Evaluation validity SHALL identify the exact subject, environment, scenarios, evidence, evaluator, time, limitations, expiry or review trigger, and invalidating changes. | Evaluation-record review |
| GAEP-ADAPT-REQ-020 | Activation SHALL bind an evaluated adapter environment to an allowed scope, capabilities, data classes, applicable effect-descriptor sets, principals, validity interval, and revocation conditions. | Activation-boundary test |
| GAEP-ADAPT-REQ-021 | Provider, model, tool, prompt-policy, extension, or environment fallback SHALL NOT occur silently when the fallback changes authority, data handling, semantics, assurance, cost, or effect behavior. | Fallback scenario |
| GAEP-ADAPT-REQ-022 | Adapter retirement SHALL preserve interpretable records, provide migration or export guidance, revoke future selection, and identify residual retention or deletion obligations. | Retirement exercise |

## Evaluation dimensions

Evaluation covers semantic fidelity, identity and authorization fidelity, effect reporting, failure normalization, context isolation, data handling, injection resistance, evidence completeness, cancellation, recovery, portability, accessibility, human comprehension, cost and latency. It includes positive, negative, partial-effect, revocation, degraded-mode, provider-outage, context-poisoning, replay, and version-change scenarios.

Passing one model, prompt, deployment mode, or provider version does not establish indefinite adapter validity. A passing adapter evaluation also does not establish that the containing GAEP product, profile selection, workflow, or use case is conformant.

## Minimum conformance statement

An adapter conformance statement identifies the exact adapter definition and environment binding, the GAEP contract versions evaluated, supported and unsupported mappings, applicable profiles, evaluation result and limitations, open risks, validity interval or review trigger, and the authority that accepted the bounded result. Partial conformance uses an explicitly named class; it is never reported as full conformance.

## Required negative cases

At minimum, evaluation demonstrates refusal or safe handling when:

- a provider-native permission is mistaken for a GAEP Authorization Grant;
- model, tool, deployment, or policy identity is missing or changed;
- context includes malicious instructions, stale authority, secrets, or incompatible classification;
- a tool reports success after a partial or unknown external effect;
- cancellation arrives after an effect has begun;
- evidence export is incomplete or provider telemetry is unavailable;
- a provider changes retention, training-use, residency, or subprocessor terms;
- an adapter or dependency is revoked, compromised, expired, or unsupported; and
- a fallback model, tool, region, or manual path would change governed semantics.

## Open design decisions

| Decision ID | Question | Current status |
|---|---|---|
| GAEP-ADAPT-OD-001 | What are the minimum adapter conformance classes and canonical names? | unresolved |
| GAEP-ADAPT-OD-002 | What evidence is acceptable for provider-hidden model or infrastructure attributes? | unresolved |
| GAEP-ADAPT-OD-003 | What is the maximum evaluation-validity period when provider behavior can change without a pinned version? | unresolved |
| GAEP-ADAPT-OD-004 | Which provider-side claims require independent testing before activation? | unresolved |
| GAEP-ADAPT-OD-005 | What portable export package is required for provider exit and later audit reconstruction? | unresolved |
| GAEP-ADAPT-OD-006 | Which adapter changes require re-evaluation, a new activation, or both? | unresolved |
