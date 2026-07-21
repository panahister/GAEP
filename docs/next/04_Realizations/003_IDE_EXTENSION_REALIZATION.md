---
id: GAEP-REAL-003
title: IDE Extension Realization
document_type: realization
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Runtime Steward
scope: Local IDE-hosted GAEP product design and governed agent execution
normative_level: normative
classification: internal
provenance: Founder-approved IDE platform direction
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-CORE-001
  - GAEP-CORE-004
  - GAEP-CORE-006
  - GAEP-CORE-009
  - GAEP-CORE-010
  - GAEP-CORE-011
  - GAEP-CORE-012
  - GAEP-REAL-001
  - GAEP-REAL-002
  - GAEP-ADAPT-001
informative_references:
  - ../../02_Platform/015_SKILL_MODEL.md
  - ../../02_Platform/016_AGENT_MODEL.md
  - ../../02_Platform/017_RUNTIME_MODEL.md
  - ../../05_AI_Runtime/042_AGENT_EXECUTION_FLOW.md
supersedes: []
---

# IDE Extension Realization

## Purpose

This realization maps GAEP to a local, IDE-native product-design and agent-orchestration platform. Visual Studio Code is the first host. JetBrains Rider and Microsoft Visual Studio are additional hosts of the same engine and contracts, not independent GAEP implementations.

The IDE surface is a control and presentation boundary. It does not own Product identity, policy meaning, approval semantics, authorization, evidence sufficiency, or agent truth.

## Deployment model

The realization has five replaceable layers:

1. Git-friendly `.gaep` governed records are the portable source of truth;
2. a platform-independent local engine validates records and advances workflows;
3. agent adapters discover and invoke installed agent runtimes through supported interfaces;
4. IDE host adapters map native commands, views, files, tasks, and notifications to the engine;
5. an optional future collaboration service may synchronize authorized records without becoming required for local use.

An embedded index or cache may accelerate queries. It is derived state and cannot be the only representation of authoritative Product records.

## Agent and model selection

The local engine distinguishes IDE host, agent runtime, model, agent configuration, GAEP profile, tool permission, governance authorization, session, and run. Selecting one does not imply or silently select another.

An adapter discovers installed runtimes, records the observed executable identity and version, declares its capability and mapping truth classes, and exposes only verified or explicitly user-supplied model and setting values. Provider aliases such as `latest` remain aliases and are not represented as immutable model revisions.

## Switching protocol

Agent or model switching is a governed transition:

1. stop new work and record the requested switch;
2. checkpoint the current run, workspace baseline, changes, decisions, evidence, unresolved matters, and actual effects;
3. resolve the new adapter, runtime, model, configuration, data boundary, tools, and permissions;
4. compare capabilities and disclose losses, fallbacks, changed costs, changed data handling, and unsupported semantics;
5. produce a versioned handoff package with provenance;
6. start a distinct run and retain links to the prior session and accountable principal;
7. require fresh authorization whenever a bound subject, scope, actor, effect, policy, profile, capability, or environment changed materially.

No adapter, model, tool, region, or provider fallback is silent.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-IDE-REQ-001 | The realization SHALL use one platform-independent engine and versioned host contracts for VS Code, Rider, and Visual Studio. | Host conformance tests |
| GAEP-IDE-REQ-002 | Canonical Product records SHALL remain portable, human-readable, versioned, and usable without a running service or AI provider. | Offline and export scenario |
| GAEP-IDE-REQ-003 | The engine SHALL distinguish agent, model, configuration, tool permission, GAEP authority, session, run, and IDE host identities. | Identity-separation tests |
| GAEP-IDE-REQ-004 | An adapter SHALL expose only observed, provider-declared, configured, inferred, or unknown capabilities with the applicable truth class. | Adapter manifest review |
| GAEP-IDE-REQ-005 | Agent or model switching SHALL checkpoint the prior run and create a traceable handoff before the new run begins. | Switch and recovery scenario |
| GAEP-IDE-REQ-006 | A switch SHALL disclose capability, data-boundary, permission, cost, evidence, and semantic differences and SHALL NOT silently substitute a fallback. | Adverse switch tests |
| GAEP-IDE-REQ-007 | IDE or provider-native permissions SHALL remain distinct from a GAEP Approval Determination or Authorization Grant. | Authorization negative test |
| GAEP-IDE-REQ-008 | The extension SHALL require explicit confirmation before commit, push, deployment, deletion, external communication, spend, privilege change, or another governed high-impact effect unless an exact current Authorization Grant permits it. | Effect-boundary tests |
| GAEP-IDE-REQ-009 | The local engine SHALL recover from IDE restart without reporting an interrupted or unknown run as successful. | Crash and restart test |
| GAEP-IDE-REQ-010 | Secrets SHALL remain in an authorized credential store or provider runtime and SHALL NOT be copied into `.gaep`, prompts, logs, evidence, or handoffs. | Secret-redaction tests |
| GAEP-IDE-REQ-011 | Host adapters SHALL meet equivalent workflow, accessibility, state, error, and evidence contracts while preserving native IDE interaction patterns. | Cross-host conformance suite |
| GAEP-IDE-REQ-012 | Unsupported provider discovery, resume, cancellation, evidence, or model-catalog semantics SHALL remain explicit and fail closed for dependent operations. | Degraded-mode tests |

## Initial delivery sequence

The initial release implements the shared contracts and local engine, a deterministic fake adapter, Codex and Claude Code CLI adapters, and the VS Code host. Rider and Visual Studio hosts follow against the frozen host contract. Experimental provider interfaces may improve discovery but cannot be the only execution path.

## Non-goals

- A browser application is not the primary Founder Edition host.
- PostgreSQL or a cloud account is not required for local use.
- GAEP does not replace, modify, or extract credentials from installed agent extensions.
- The extension does not claim independent review, legal acceptance, participant consent, or external evidence that did not occur.
