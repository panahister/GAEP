---
id: GAEP-ADAPT-003
title: Claude Delta Profile
document_type: adapter-profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Integration Steward
scope: Candidate mapping for Claude-based work surfaces
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
  - ../../05_AI_Runtime/041_CLAUDE_WORKING_MODEL.md
supersedes: []
---

# Claude Delta Profile

## Boundary

This document is a candidate mapping, not a statement of current Claude product behavior and not a conformance claim. Current provider documentation, deployment terms, configured tools, and live evaluation must be used before approving an adapter.

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

- a Claude interaction may help execute a GAEP workflow but does not itself define the GAEP workflow contract;
- provider project instructions, memory, artifacts, skills, tools, and context mechanisms are inputs or capabilities whose authority must be resolved by GAEP policy;
- generated artifacts are working revisions until independently validated and approved where required;
- tool and external-system actions require explicit effect normalization and authorization binding;
- provider-native context or memory cannot be the only copy of authoritative governance state.

The following candidate mappings require special proof because a superficial correspondence is unsafe:

| Surface concept | GAEP interpretation boundary |
|---|---|
| chat, project, session, or interaction | interaction surface; not automatically an Initiative, Workspace, Run, Decision, Approval, or evidence record |
| project instruction, memory, or system context | context or policy input whose source, freshness, identity, and authority must be resolved |
| tool permission or confirmation | provider/tool-host control; not automatically a GAEP Authorization Grant |
| artifact or generated file | proposed or working revision until governed identity, provenance, validation, decision, and baseline semantics are established |
| plan, task list, or agent delegation | derived working representation unless bound to an approved GAEP Workflow/Plan contract |
| tool or connector result | candidate observation; material effects require independent normalization and evidence |
| summary or memory | derived context with possible loss; never the sole authoritative record |
| skill, integration, connector, or external tool | capability/dependency supply-chain subject requiring identity, version, policy, data, and effect evaluation |

## Required evaluation before use

Evaluate identity, model/version visibility, tool authorization, project and memory scope, context isolation, data-use terms, cancellation, retries, partial effects, evidence export, prompt injection defenses, reproducibility, portability and degraded/manual operation.

Evaluation must use the exact Claude surface, account/organization mode, deployment, configured instructions, projects/memory, tools, skills/integrations, model selection policy, workspace permissions, and provider terms proposed for the bounded pilot. Results from another surface or configuration are not silently transferable.

## Unresolved mappings

| Decision ID | Mapping question | Current status |
|---|---|---|
| GAEP-CLAUDE-OD-001 | What stable identities are available for the provider surface, environment, runtime interaction, agent principal, account and organization? | unresolved; current provider evidence required |
| GAEP-CLAUDE-OD-002 | Which exact model, routing, fallback and material tool versions are observable and bindable? | unresolved; current provider evidence required |
| GAEP-CLAUDE-OD-003 | How do provider-native artifacts, projects and files map to governed resource lineages and immutable revisions? | unresolved; mapping evaluation required |
| GAEP-CLAUDE-OD-004 | Can a GAEP Authorization Grant be durably bound, checked, revoked and evidenced across tools and resumed interactions? | unresolved; live evaluation required |
| GAEP-CLAUDE-OD-005 | Which provider and external-tool observations establish requested, attempted, actual, partial and unknown effects? | unresolved; live evaluation required |
| GAEP-CLAUDE-OD-006 | What retention, deletion, residency, training-use, subprocessor and human-access guarantees apply to each candidate deployment mode? | unresolved; legal/data review required |
| GAEP-CLAUDE-OD-007 | What portable export is possible for instructions, context selection, decisions, approvals, authorizations, tool evidence and unresolved state? | unresolved; exit evaluation required |

## Required adversarial scenarios

- a user or project instruction says “approved” without satisfying the bound approval or authorization contract;
- an instruction in a repository, fetched source, tool result, skill, connector, memory, or artifact conflicts with higher-authority policy;
- project memory or summarization omits a restriction, unresolved risk, or revocation;
- a file/tool operation partially succeeds or its final effect cannot be observed;
- a model, tool, skill, connector, memory mode, or provider term changes between evaluation and use;
- a secret, personal record, confidential source, or unlicensed content is requested in model context; and
- the provider surface is unavailable and a fallback would change data, authority, or effect semantics.

## Exit evidence

Before any activation decision, the evaluator should demonstrate export of the minimum durable GAEP record without depending on provider conversation or project state: exact governed subjects, selected context references, decisions, approvals, Authorization Grants, tool/effect evidence, unresolved unknowns, and adapter/environment versions.
