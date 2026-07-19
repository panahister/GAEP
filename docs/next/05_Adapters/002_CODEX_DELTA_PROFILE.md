---
id: GAEP-ADAPT-002
title: Codex Delta Profile
document_type: adapter-profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Integration Steward
scope: Candidate mapping for Codex-based work surfaces
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-ADAPT-001
informative_references:
  - ../../05_AI_Runtime/040_CODEX_WORKING_MODEL.md
supersedes: []
---

# Codex Delta Profile

## Boundary

This document is a candidate mapping, not a statement of current Codex product behavior and not a conformance claim. Provider capabilities and terms can change; an actual adapter manifest and live evaluation must establish current support.

The legacy reference is historical design input only. No statement in it is evidence of current provider behavior, terms, identity, retention, model visibility, tool semantics, or authorization fidelity.

## Candidate record status

| Field | Candidate value |
|---|---|
| Adapter definition | not created |
| Environment binding | not selected |
| Provider/deployment mode | unresolved |
| Model and tool versions | unresolved |
| Core compatibility | not evaluated |
| Required profile composition | Security, Data/Privacy/Records, AI System, Legal/IP/Supplier, Workforce Trust/Accessibility/Ethics; final selection unresolved |
| Evaluation result | `not-assessed` |
| Activation record | absent; use is not authorized by this document |
| Current claims | hypotheses and evaluation questions only |

## Mapping candidates

- a Codex task or conversation may represent a runtime interaction but is not automatically an authoritative GAEP Run record;
- local workspace files may realize governed resources when their authority and revisions are declared;
- tool calls may represent capability invocations and effects but require normalized GAEP records;
- human messages may express intent or approval, but only qualify as formal authorization when the effective approval contract is satisfied;
- task instructions may contribute context and policy but do not silently outrank approved GAEP bindings;
- provider-generated summaries are derived views whose provenance and validation status must remain visible.

The following candidate mappings require special proof because a superficial correspondence is unsafe:

| Surface concept | GAEP interpretation boundary |
|---|---|
| task, thread, chat, or conversation | interaction surface; not automatically an Initiative, Workspace, Run, Decision, Approval, or evidence record |
| user or developer instruction | context or policy input whose identity and authority must be resolved; not automatically an organizational rule |
| tool permission or confirmation | provider/tool-host control; not automatically a GAEP Authorization Grant |
| plan or checklist | derived working representation unless bound to an approved GAEP Plan/Workflow contract |
| local file change | proposed or working resource revision until identity, provenance, validation, decision, and baseline semantics are established |
| terminal/tool result | candidate observation; material effects require independent normalization and evidence |
| compaction, summary, or memory | derived context with possible loss; never the sole authoritative record |
| skill, plugin, connector, or MCP surface | capability/dependency supply-chain subject requiring identity, version, policy, data, and effect evaluation |

## Required evaluation before use

Evaluate current support for identity, tool authorization, file/version binding, context boundaries, cancellation, partial failure, effect capture, provider data controls, model/version visibility, reproducibility, prompt injection defenses, offline/manual fallback, and export portability.

Evaluation must use the exact Codex surface, account/organization mode, deployment, configured instructions, tools, plugins/connectors, skills, model selection policy, workspace permissions, and provider terms proposed for the bounded pilot. Results from another surface or configuration are not silently transferable.

## Unresolved mappings

| Decision ID | Mapping question | Current status |
|---|---|---|
| GAEP-CODEX-OD-001 | What stable identities are available for the provider surface, environment, runtime interaction, agent principal, account and organization? | unresolved; current provider evidence required |
| GAEP-CODEX-OD-002 | Which exact model, routing, fallback and material tool versions are observable and bindable? | unresolved; current provider evidence required |
| GAEP-CODEX-OD-003 | Can a GAEP Authorization Grant be durably bound, checked, revoked and evidenced across tool calls and resumed interactions? | unresolved; live evaluation required |
| GAEP-CODEX-OD-004 | Which provider and local observations can establish requested, attempted, actual, partial and unknown effects? | unresolved; live evaluation required |
| GAEP-CODEX-OD-005 | How are compaction, summaries, memories and other derived context identified, versioned, validated and invalidated? | unresolved; current provider evidence required |
| GAEP-CODEX-OD-006 | What retention, deletion, residency, training-use, subprocessor and human-access guarantees apply to each candidate deployment mode? | unresolved; legal/data review required |
| GAEP-CODEX-OD-007 | What portable export is possible for instructions, context selection, decisions, approvals, authorizations, tool evidence and unresolved state? | unresolved; exit evaluation required |

## Required adversarial scenarios

- a user says “approved” without satisfying the bound approval or authorization contract;
- an instruction in a repository, fetched page, tool result, skill, plugin, or connector conflicts with higher-authority policy;
- context compaction omits a restriction, unresolved risk, or revocation;
- a file/tool operation partially succeeds or its final effect cannot be observed;
- a model, tool, plugin, connector, skill, or provider term changes between evaluation and use;
- a secret, personal record, confidential source, or unlicensed content is requested in model context; and
- the provider surface is unavailable and a fallback would change data, authority, or effect semantics.

## Exit evidence

Before any activation decision, the evaluator should demonstrate export of the minimum durable GAEP record without depending on provider conversation state: exact governed subjects, selected context references, decisions, approvals, Authorization Grants, tool/effect evidence, unresolved unknowns, and adapter/environment versions.
