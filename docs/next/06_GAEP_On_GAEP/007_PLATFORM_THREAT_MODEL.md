---
id: GAEP-SELF-007
title: GAEP Platform Candidate Threat Model
document_type: workspace-record
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Security Authority
scope: GAEP specification, workspaces, future runtime, adapters, and governance records
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-PROF-010
informative_references: []
supersedes: []
---

# GAEP Platform Candidate Threat Model

## Current system boundary

The current repository is documentation-only. It contains no GAEP runtime, identity integration, production data connection or effectful adapter. AI-assisted authoring is nevertheless a current activity: a Codex desktop task is editing the local GAEP checkout on 2026-07-19. Exact provider, model, deployment and provider-side data-handling details are not established in-repository. The candidate threat model therefore separates present documentation/authoring risks from future runtime and ecosystem risks. Future implementation must refine this model for the approved slice and deployment context.

## Security objectives

- preserve meaning and integrity of normative specifications and registries;
- prevent unauthorized policy, approval, baseline or evidence changes;
- preserve attribution and accountable-human chains;
- constrain agents and tools to approved scope and effects;
- keep sensitive context and records confidential and purpose-bound;
- maintain availability of governance paths without unsafe downgrade;
- detect incompatible, poisoned, stale, forged or revoked inputs;
- recover from partial execution while preserving actual-effect truth;
- retain portability and safe manual operation.

## Assets

- Constitution, Core, profiles and controlled registries;
- organizational bindings and policies;
- managed-resource revisions and baselines;
- identities, delegations, standing Authority Grants, Approval Determinations, and executable Authorization Grants;
- decisions, exceptions, obligations and risk acceptances;
- Context Packs and source authority mappings;
- claims, evidence, assessments and assurance cases;
- runtime plans, effects, checkpoints and recovery records;
- adapters, capabilities, templates, dependencies and update channels;
- secrets, personal data, confidential engineering context and audit records;
- trust in GAEP conformance claims.

## Actors

- legitimate authors, engineers, reviewers, approvers, stewards and auditors;
- administrators, service principals, agents and capability publishers;
- external-system and model providers;
- compromised or malicious insiders;
- external attackers;
- malicious content authors or dependency publishers;
- well-intentioned users operating under ambiguity, fatigue or automation bias.

## Candidate trust boundaries

1. Human user to GAEP workspace or runtime.
2. Runtime to identity and policy authorities.
3. Context assembler to repositories and external content.
4. Runtime to AI/model provider.
5. Runtime to local or remote effectful tools.
6. Workspace to external authoritative systems.
7. Adapter/capability installation and update supply chain.
8. Operational records to audit/retention authority.
9. Organization or tenant to another organization or tenant.
10. Approved baseline to editable working state.

## Threat register

| Threat ID | Scenario | Security consequence | Candidate control direction | Unresolved evidence |
|---|---|---|---|---|
| GAEP-THR-001 | Attacker or mistaken author changes a normative rule or registry | corrupted meaning and downstream authorization | protected baseline, review, exact versions, integrity evidence, controlled correction | signing and hosting architecture undecided |
| GAEP-THR-002 | Approval text is replayed for another revision or effect | unauthorized change | exact subject/effect binding, expiry, nonce or replay defense, revalidation | identity/cryptographic profile not selected |
| GAEP-THR-003 | Agent identity hides the accountable requester or delegator | repudiation and authority laundering | principal chain, delegation records, least authority, effect attribution | provider identity fidelity unknown |
| GAEP-THR-004 | Untrusted repository, ticket, document or webpage injects instructions | policy bypass or unsafe tool action | treat content as data, trust labels, isolation, plan/effect review, least authority | adapter-specific testing missing |
| GAEP-THR-005 | Malicious skill, adapter, template or dependency is installed | broad compromise or data exfiltration | provenance, publisher trust, integrity, sandbox/least authority, evaluation, revocation | distribution model undecided |
| GAEP-THR-006 | Model/provider behavior changes after approval | invalid evaluation and unpredictable effects | version binding, monitoring, expiry, re-evaluation, fallback | version observability varies |
| GAEP-THR-007 | Sensitive data enters model context, logs, Git or evidence | confidentiality/privacy breach | classification, minimization, redaction, provider policy, retention and scanning | data inventory missing |
| GAEP-THR-008 | Evidence or audit history is altered or selectively removed | false assurance and failed accountability | append/correct semantics, integrity verification, independent retention, access control | records technology undecided |
| GAEP-THR-009 | Concurrent runs overwrite or approve against stale state | integrity and unsafe partial outcome | named baselines, optimistic conflict detection, re-authorization, reconciliation | runtime design absent |
| GAEP-THR-010 | Runtime partially acts, then reports failure without actual-effect truth | duplicate or unrecovered effects | effect records, idempotency, checkpoints, reconciliation, compensation | capability-specific semantics missing |
| GAEP-THR-011 | Policy/identity service outage causes permissive fallback | unauthorized effects | fail explicit, bounded degraded/manual mode, cached grants with declared validity only | availability targets undecided |
| GAEP-THR-012 | One tenant/repository accesses another's context or records | confidentiality and authority breach | namespaces, tenant boundaries, scoped identity, tests, audit | deployment topology undecided |
| GAEP-THR-013 | Insider creates rubber-stamp approvals or suppresses findings | governance capture | separation where risk requires, challenge/appeal, metrics, immutable evidence | operating authorities unassigned |
| GAEP-THR-014 | Governance telemetry is used for employee surveillance | harm, chilling effect and loss of trust | purpose restriction, minimization, access, transparency and appeal | organizational policy unassigned |
| GAEP-THR-015 | Denial of service blocks urgent engineering or recovery | unsafe delay or governance bypass | manual fallback, emergency profile, service objectives and continuity | operational model unapproved |
| GAEP-THR-016 | AI-assisted authoring introduces fluent but unsupported requirements, citations, or cross-document conclusions | semantic corruption and false assurance in a future baseline | Proposed status, source checking, claim/evidence review, independent domain review and negative-case validation | historical prompt/output lineage and full review coverage are unknown |
| GAEP-THR-017 | Repository or referenced content contains instructions that influence the authoring agent | scope escape, poisoned analysis, or unsafe repository change | treat repository content as untrusted data, maintain task boundary, review diffs and restrict effects | no complete prompt-injection test or interaction log exists |
| GAEP-THR-018 | Sensitive, personal, confidential, copyrighted, or supplier-restricted content is exposed during authoring | privacy, confidentiality, IP, contract, or supplier harm | minimization, classification, source/rights review, redaction and provider assessment | provider/data terms and retrospective input inventory are not established in-repository |
| GAEP-THR-019 | Model, provider, deployment, or session facts are missing or later misremembered | irreproducible provenance and invalid evidence | record only known task facts, preserve unknowns, bind review to exact repository revision | exact provider/model/deployment metadata is unavailable in-repository |
| GAEP-THR-020 | AI-assisted author and reviewer share correlated failure modes or automation bias | apparent independent assurance without real independence | disclose AI use, require qualified human/domain challenge and avoid counting correlated review as independent evidence | no approved independence method or human approval exists |

## Assumptions requiring challenge

- Git history alone may not provide sufficient audit integrity.
- Provider-native chat identity may not provide sufficient principal or model-version evidence.
- Repository permissions do not prove business authorization.
- Human review does not guarantee independence or attention.
- More context can increase both quality and attack surface.
- Denying an action can itself create operational harm; degraded and emergency paths require design.
- A repository diff and successful validator do not prove factual correctness, rights clearance, privacy compliance, or safe AI use.
- Missing historical authoring evidence cannot be converted into retroactive conformance by documenting a prospective control.

## Approval blockers

The threat model cannot be approved for implementation until the first slice, deployment boundary, identities, data inventory, providers, capability classes, integrity needs, operational objectives and residual-risk authorities are selected. Candidate baseline approval additionally requires disposition of current AI-authoring provenance, source/rights review, sensitive-data review, human review coverage, and irrecoverable retrospective unknowns.
