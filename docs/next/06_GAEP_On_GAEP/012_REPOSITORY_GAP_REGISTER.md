---
id: GAEP-SELF-012
title: GAEP Repository Gap Register
document_type: workspace-record
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Specification Steward
scope: Structural, product, semantic, trust, adoption, legal, readiness, and migration gaps in the GAEP Next candidate
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-CORE-007
informative_references:
  - 001_INITIATIVE_PROFILE.md
  - 002_APPLICABILITY_AND_SCOPE.md
  - 003_DECISION_REGISTER.md
  - 004_RISK_REGISTER.md
  - 005_ASSURANCE_CASE.md
  - 007_PLATFORM_THREAT_MODEL.md
  - 008_DATA_AI_AND_OPERATIONAL_ASSESSMENT.md
  - 009_STAKEHOLDER_AND_ROLE_ASSIGNMENT.md
  - 010_VALUE_BURDEN_AND_TRUST_SCORECARD.md
  - 011_PRODUCT_DECISION_CROSSWALK.md
  - ../08_Roadmap_and_Adoption/001_PRE_IMPLEMENTATION_ROADMAP.md
  - ../08_Roadmap_and_Adoption/003_IMPLEMENTATION_READINESS_GATE.md
  - ../08_Roadmap_and_Adoption/004_LEGACY_MIGRATION_MAP.md
  - ../08_Roadmap_and_Adoption/005_PILOT_READINESS_GATE.md
  - ../08_Roadmap_and_Adoption/006_CANDIDATE_BASELINE_APPROVAL_GATE.md
  - ../08_Roadmap_and_Adoption/007_IMPLEMENTATION_AUTHORIZATION_PROCESS.md
  - ../08_Roadmap_and_Adoption/008_COMPLEXITY_AND_SUBTRACTION_GATE.md
supersedes: []
---

# GAEP Repository Gap Register

## Status and interpretation

This register consolidates gaps found during the pre-implementation repository analysis. It describes the Proposed candidate on 2026-07-19; it does not claim approval, conformance, product validation, pilot readiness, baseline readiness, implementation readiness, or implementation authorization.

`Severity` is editorial triage (`blocker`, `high`, or `medium`), not a Core Risk Tier or Risk Assessment. All accountable identities and authorities are unassigned unless an approved assignment record later says otherwise.

Current-status values mean:

- `resolved-by-candidate-structure`: the missing structural home or boundary now exists in the Proposed candidate; evidence, approval, and operational effectiveness may still be absent;
- `open-needs-decision`: one or more Decision Outcomes remain unresolved;
- `open-needs-evidence`: required empirical, review, or assurance evidence is absent;
- `open-needs-assignment`: accountable identity, appointing authority, capacity, or delegation is absent;
- `open-needs-validation`: a candidate contract exists but required integration, scenario, or deterministic validation has not established the claim;
- `open-blocker`: the missing condition prevents the named gate from legitimately passing.

## Structural gaps

| Gap ID | Severity | Gap | Evidence/source | Consequence if unresolved | Disposition path | Candidate owner role and gate | Current status |
|---|---|---|---|---|---|---|---|
| GAEP-GAP-001 | high | Legacy material mixed product strategy, universal semantics, profiles, realizations, adapters, and roadmap concerns without a single candidate authority stack. | `GAEP-SELF-001`; `GAEP-RM-004` | reviewers cannot tell which layer owns meaning | retain layered `docs/next` candidate; approve exact authority order and migration before supersession | GAEP Specification Steward; Candidate Baseline Gate | resolved-by-candidate-structure |
| GAEP-GAP-002 | high | Product strategy and constitutional constraints lacked explicit candidate homes. | `GAEP-STR-001` through `GAEP-STR-008`; `GAEP-CST-001` through `GAEP-CST-003` | implementation assumptions could masquerade as durable law | review, decide, and version-bind Product Strategy and Constitution separately | GAEP Product Owner and GAEP Constitutional Owner; Candidate Baseline Gate | resolved-by-candidate-structure |
| GAEP-GAP-003 | high | Product Strategy contained 59 open decisions with no complete workspace crosswalk. | `GAEP-SELF-003`; `GAEP-SELF-011` | open questions could be omitted or mistaken for recommendations already selected | maintain complete ID-to-Decision mapping and require Core decision records | GAEP Decision and Authorization Steward; Candidate Baseline Gate | resolved-by-candidate-structure |
| GAEP-GAP-004 | medium | Repository gaps were distributed across documents without one durable disposition register. | this register | repairs could hide open evidence and authority gaps | maintain this register with exact sources, owners, gates, and status transitions | GAEP Specification Steward; Candidate Baseline Gate | resolved-by-candidate-structure |
| GAEP-GAP-005 | high | Static metadata, ID, dependency, link, and requirement integrity require repeatable validation; static checks cannot prove semantic correctness. | `scripts/validate_next_docs.rb`; 2026-07-19 working-tree run passed for 79 documents and 955 requirement definitions with zero warnings; 44 legacy documents mapped; 59 Product Strategy decisions crosswalked; 70 Core Open Decisions registered; `GAEP-CLAIM-011` | broken references or duplicated IDs may enter a candidate package; a green check may be overstated | retain exact-revision validator evidence and add independent semantic review | GAEP Specification Steward and GAEP Assurance Authority; Candidate Baseline Gate | open-needs-validation |
| GAEP-GAP-046 | high | A controlled owner-role vocabulary and metadata resolution home was missing. | `GAEP-REG-008`; `GAEP-SELF-009`; `GAEP-DEC-018`; 2026-07-19 validator result | aliases and metadata owners could not be validated against one controlled vocabulary | maintain the registry and decide proposed alias mappings; keep every human and organizational assignment explicitly unassigned until a valid Authority Assignment exists | GAEP Identity and Authority Steward and GAEP Specification Steward; Candidate Baseline Gate | resolved-by-candidate-structure |

## Product and economic gaps

| Gap ID | Severity | Gap | Evidence/source | Consequence if unresolved | Disposition path | Candidate owner role and gate | Current status |
|---|---|---|---|---|---|---|---|
| GAEP-GAP-006 | blocker | Initial target segment and anti-segment remain hypotheses. | `GAEP-STR-001`; `GAEP-DEC-011` | GAEP may optimize for an invented audience | conduct interviews and historical-case research; record Decision Outcome | GAEP Product Research Owner and GAEP Product Owner; Pilot Readiness Gate | open-needs-evidence |
| GAEP-GAP-007 | blocker | First daily operator and first governed workflow are not selected from observed work. | `GAEP-STR-003`; `GAEP-DEC-002` | scope, profiles, experience, and measures have no validated anchor | compare candidate workflows and run independent comprehension tests | GAEP Product Owner; Pilot Readiness Gate | open-needs-decision |
| GAEP-GAP-008 | high | First-horizon product form and distribution mode are unresolved. | `GAEP-DEC-001`; `GAEP-DEC-010`; `GAEP-STR-008` | ownership, support, legal, packaging, and economics cannot be bounded | decide internal/public/service/product/hybrid form with alternatives and legal evidence | GAEP Product Owner and GAEP Distribution and Ecosystem Owner; Candidate Baseline Gate | open-needs-decision |
| GAEP-GAP-009 | blocker | The problem theory is based mainly on corpus inspection and author hypotheses rather than external product evidence. | `GAEP-STR-002`; `GAEP-CLAIM-001` | specification completeness may be mistaken for product value | collect independent problem, alternative, and incumbent-workflow evidence | GAEP Product Research Owner; Pilot Readiness Gate | open-needs-evidence |
| GAEP-GAP-010 | blocker | Primary outcomes, baselines, burden budgets, thresholds, and economic treatment are unset. | `GAEP-STR-006`; `GAEP-SELF-010`; `GAEP-DEC-017` | no accountable proceed, narrow, pivot, pause, or stop decision can use measured evidence | approve metric contracts only after baseline observation and privacy review | GAEP Product Owner and GAEP Metric Integrity Owner; Pilot and Implementation Readiness Gates | open-needs-evidence |
| GAEP-GAP-011 | blocker | Sponsor, funding, operating capacity, and stop-investment authority are absent. | `GAEP-STR-007`; `GAEP-DEC-012`; `GAEP-SELF-009` | stewardship and support may be unfunded or silently volunteered | assign organization, sponsor, capacity, funding, succession, and stop authority | GAEP Investment Sponsor; Candidate Baseline Gate | open-needs-assignment |

## Semantic and scope gaps

| Gap ID | Severity | Gap | Evidence/source | Consequence if unresolved | Disposition path | Candidate owner role and gate | Current status |
|---|---|---|---|---|---|---|---|
| GAEP-GAP-012 | high | Managed Asset, Engineering Initiative, Change, Work Item, Implementation Unit, and Workspace were previously conflated. | `GAEP-CORE-001`; `GAEP-SELF-001` | lifetime, ownership, cardinality, and authority become ambiguous | retain separate Core entities and exact self-scope bindings | GAEP Core Subject Owner; Candidate Baseline Gate | resolved-by-candidate-structure |
| GAEP-GAP-013 | high | Cross-Core state, approval, authorization, evidence, profile, and effect semantics have not passed independent integration scenarios. | `GAEP-CORE-004` through `GAEP-CORE-011`; `GAEP-GUIDE-001` | individually plausible contracts may contradict in a complete workflow | execute positive, negative, stale, revoked, concurrent, and recovery scenarios | GAEP Assurance Authority and GAEP Specification Steward; Candidate Baseline Gate | open-needs-validation |
| GAEP-GAP-014 | high | The Effective Profile Manifest is `unresolved`; no profile is effective. | `GAEP-SELF-002`; `GAEP-CORE-009` | file presence may be mistaken for applicability or obligation | assign selection authority and resolve exact revisions, triggers, conflicts, exclusions, and approval | GAEP Profile Owners and GAEP Initiative Owner; Pilot Readiness Gate | open-blocker |
| GAEP-GAP-015 | high | External authority, multi-repository identity, mapping loss, and no-double-entry behavior are unvalidated. | `GAEP-CLAIM-009`; reference scenarios S07, S12, S13 | trace may fail or GAEP may create a second unowned truth | run federation, inaccessible-source, round-trip-loss, and provider-exit scenarios | GAEP Workspace Steward; Candidate Baseline Gate | open-needs-evidence |
| GAEP-GAP-016 | high | Net-new structure previously lacked a gate requiring subtraction, simpler alternatives, total burden, ownership, and retirement. | `GAEP-RM-008`; `GAEP-PRN-018`; `GAEP-PRN-034` | GAEP may become more complex than the work it replaces | evaluate each material addition and bind result to a separate scope Decision | GAEP Product Owner; Complexity and Subtraction Gate | resolved-by-candidate-structure |
| GAEP-GAP-017 | medium | Deferred capability labels are recommendations but their actual dispositions remain undecided. | `GAEP-STR-005`; `GAEP-SELF-002`; `GAEP-DEC-016` | readers may mistake “deferred” for funded roadmap scope | decide add/compose/defer/remove with prerequisites and no-commitment language | GAEP Product Owner and GAEP Investment Sponsor; Complexity and Subtraction Gate | open-needs-decision |
| GAEP-GAP-047 | high | Profile repair increased the original 15 Profiles from 121 to 192 requirements (+71, +58.7%); two new conditional Profiles add 32 for 224 total, including 68 repeated structural rows (four across each of 17 Profiles). | 2026-07-19 Profile requirement count; `GAEP-RM-008`; `GAEP-CORE-009` | repeated invariants increase review burden and drift risk while hiding domain-specific deltas | evaluate `GAEP-REC-SUB-001`: a shared machine-validated Profile Contract schema in Core 009, with Profiles retaining field values and domain deltas; regenerate counts after changes | GAEP Specification Steward and GAEP Profile Owners; Complexity and Subtraction Gate | open-needs-decision |
| GAEP-GAP-048 | blocker | The proposed “thin” Core currently contains 12 contracts and 353 requirements, exceeds the candidate budgets of 8 contracts and 160 requirements, has a 38-requirement maximum contract against a budget of 24, leaves its entity inventory open, and has 13 unresolved extraction/defer rows. | `GAEP-REG-010`; `GAEP-REG-009`; 2026-07-19 exact working-tree count | provider-, AI-, workflow-, retry-, marketplace-, adapter-, and federation-specific mechanics may harden into universal semantics and impose disproportionate adoption, compatibility, and implementation burden | execute the exact Core admission test; extract every registered mechanic while preserving minimal invariants and requirement history; close or validly defer all boundary decisions; recompute budgets from the exact Candidate Revision Set | GAEP Core Specification Steward and affected Profile/Realization owners; Complexity and Subtraction and Candidate Baseline Gates | open-blocker |

## Trust, security, data, AI, assurance, audit, and incident gaps

| Gap ID | Severity | Gap | Evidence/source | Consequence if unresolved | Disposition path | Candidate owner role and gate | Current status |
|---|---|---|---|---|---|---|---|
| GAEP-GAP-018 | blocker | No accountable Organization Scope or Authority Namespace issuer is assigned. | `GAEP-SELF-001`; `GAEP-SCOPE-REQ-003`; `GAEP-SCOPE-REQ-014` | ownership and authority resolution remain synthetic placeholders | assign accountable organization and namespace authority through valid records | GAEP Identity and Authority Steward; Candidate Baseline Gate | open-needs-assignment |
| GAEP-GAP-019 | blocker | Product, constitutional, specification, profile, assurance, security, data, AI, audit, incident, operational, legal, adoption, and decision authorities are unassigned. | `GAEP-SELF-009`; `GAEP-DEC-018` | no gate, approval, risk acceptance, or baseline designation has legitimate authority | assign identities, appointing sources, scopes, validity, delegation, conflicts, backups, and succession | GAEP Identity and Authority Steward; all gates | open-needs-assignment |
| GAEP-GAP-020 | high | A current and future threat-model home was missing. | `GAEP-SELF-007`; `GAEP-PROF-010` | current authoring and future runtime threats could be mixed or ignored | maintain separate present/future boundaries and refine for exact slice | GAEP Security Authority; Candidate Baseline and Implementation Readiness Gates | resolved-by-candidate-structure |
| GAEP-GAP-021 | blocker | Current AI-assisted authoring lacks complete provider/model/deployment, input/output, source-rights, and data-handling evidence. | `GAEP-SELF-008`; threats GAEP-THR-016 through GAEP-THR-020 | candidate text cannot claim retroactive Data/AI/security/supplier conformance | retain known Codex desktop task/date facts, preserve unknowns, review exact revision, sources, rights, sensitive data, and human coverage | GAEP AI System Authority, GAEP Data, Privacy, and Records Authority, and GAEP Legal, IP, and Supplier Authority; Candidate Baseline Gate | open-blocker |
| GAEP-GAP-022 | blocker | No approved data inventory, classification binding, retention/deletion model, jurisdiction, or provider/supplier assessment exists. | `GAEP-SELF-008`; `GAEP-PROF-011`; `GAEP-PROF-014` | sensitive or restricted content may be used without legitimate controls | perform data, records, privacy, legal, and supplier assessments for exact pilot/slice | GAEP Data, Privacy, and Records Authority; Pilot and Candidate Baseline Gates | open-needs-evidence |
| GAEP-GAP-023 | high | AI use case, autonomy, evaluation, human oversight, and no-AI continuity remain recommendations. | `GAEP-REC-AI-001`; `GAEP-DEC-009`; `GAEP-DEC-015` | an implementation could overreach the evidence or become provider-dependent | decide exact use case and autonomy only after risk, value, provider, evaluation, and continuity evidence | GAEP AI System Authority; Pilot and Implementation Readiness Gates | open-needs-decision |
| GAEP-GAP-024 | blocker | Every Assurance Claim is `not-assessed`; no accountable evaluator has assessed an exact revision. | `GAEP-SELF-005`; `GAEP-CORE-007` | readiness may be inferred from document presence | complete evidence inventory, method, independent evaluation, adverse evidence, expiry, and Gate Evaluations | GAEP Assurance Authority; Candidate Baseline and Implementation Readiness Gates | open-needs-evidence |
| GAEP-GAP-025 | high | Audit Integrity/Accountability applicability, coverage, integrity method, correction, and independent challenge are unresolved. | `GAEP-PROF-016`; `GAEP-SELF-002`; `GAEP-RISK-009` | event history may be incomplete or treated as stronger proof than it is | select the profile only when triggers apply; define exact event classes, integrity, reconstruction, privacy, and challenge | GAEP Audit Authority; Pilot, Candidate Baseline, or Implementation Readiness Gate as triggered | open-needs-decision |
| GAEP-GAP-026 | high | Incident Response/Continuity applicability, declaration authority, custody, communication, recovery, closure, and reopening are unresolved. | `GAEP-PROF-017`; `GAEP-SELF-002`; `GAEP-RISK-017` | material incidents may lack coordinated response or decision invalidation | select the profile only when triggers apply and test incident/continuity scenarios for the exact scope | GAEP Incident and Continuity Authority; Pilot or Implementation Readiness Gate as triggered | open-needs-decision |

## Adoption and human-system gaps

| Gap ID | Severity | Gap | Evidence/source | Consequence if unresolved | Disposition path | Candidate owner role and gate | Current status |
|---|---|---|---|---|---|---|---|
| GAEP-GAP-027 | blocker | No independent Product or non-Product manual pilot has run. | `GAEP-SELF-006`; `GAEP-CLAIM-002` | product value, usability, burden, and transfer claims remain unsupported | pass Pilot Readiness Gate, obtain separate permissions, run bounded pilots, retain negative results | GAEP Product Research Owner; Pilot Readiness Gate | open-needs-evidence |
| GAEP-GAP-028 | blocker | Author, reviewer, approver, steward, facilitator, support, and affected-person burden budgets are unset. | `GAEP-STR-006`; `GAEP-RM-002`; `GAEP-SELF-010` | governance may consume more work than it replaces | establish incumbent baselines and candidate/time-bounded budgets before collection | GAEP Product Owner and GAEP Metric Integrity Owner; Pilot and Complexity Gates | open-needs-evidence |
| GAEP-GAP-029 | high | Accessibility, localization, workforce consultation, power, consent/notice, withdrawal, and appeal protocols are absent. | `GAEP-PROF-015`; `GAEP-STR-USR-DEC-005`; `GAEP-STR-USR-DEC-007` | pilots may exclude or harm affected people and produce invalid evidence | complete affected-participant and accessibility review before recruitment | GAEP Organizational Trust Authority; Pilot Readiness Gate | open-needs-evidence |
| GAEP-GAP-030 | high | Training, support, response targets, facilitator competence, incident escalation, and ongoing capacity are unassigned. | `GAEP-STR-007`; `GAEP-RM-002`; `GAEP-DEC-012` | pilot success may depend on hidden expert labor and cannot scale safely | assign funded adoption/support model and measure facilitation as cost | GAEP Adoption Owner and GAEP Operational Authority; Pilot and Candidate Baseline Gates | open-needs-assignment |
| GAEP-GAP-031 | high | Manual continuity, export, provider substitution, and organizational exit are untested. | `GAEP-CLAIM-008`; scenario S11; `GAEP-DEC-009` | authoritative history may become trapped in a provider or realization | run no-AI/manual and provider-loss scenarios with interpretation and recovery checks | GAEP Workspace Steward; Candidate Baseline Gate | open-needs-evidence |

## Legal, IP, supplier, and distribution gaps

| Gap ID | Severity | Gap | Evidence/source | Consequence if unresolved | Disposition path | Candidate owner role and gate | Current status |
|---|---|---|---|---|---|---|---|
| GAEP-GAP-032 | blocker | Ownership of the specification, name, marks, candidate assets, and contributions is not established. | `GAEP-STR-DST-DEC-002`; `LICENSE_STATUS.md` | no legitimate public distribution or licensing decision can be made | complete ownership/provenance inventory and obtain authorized decisions | GAEP Legal, IP, and Supplier Authority; Candidate Baseline Gate | open-needs-decision |
| GAEP-GAP-033 | high | External standards, references, examples, and AI-assisted passages lack complete rights/provenance review. | `GAEP-DEC-014`; `GAEP-BASE-READY-REQ-007` | redistribution or baseline approval may carry copyright or attribution risk | record exact sources/versions, use, license/permission, transformation, and unresolved rights | GAEP Legal, IP, and Supplier Authority; Candidate Baseline Gate | open-needs-evidence |
| GAEP-GAP-034 | blocker | AI provider and other supplier terms, retention, training use, residency, security, subprocessors, and exit are not established in-repository. | `GAEP-SELF-008`; `GAEP-STR-DST-DEC-010` | supplier use may violate policy, law, contract, or portability goals | perform supplier assessment for each exact authorized use or retain a no-provider path | GAEP Legal, IP, and Supplier Authority and GAEP Data, Privacy, and Records Authority; Pilot and Implementation Readiness Gates | open-needs-evidence |
| GAEP-GAP-035 | blocker | Applicable legal, procurement, tax, export, sanctions, labor, accessibility, and jurisdictional obligations are unknown. | `GAEP-STR-DST-DEC-010`; `GAEP-PROF-014`; `GAEP-PROF-015` | product form, pilot, distribution, or implementation may be impermissible | identify jurisdictions and activities; obtain qualified review and explicit blockers | GAEP Legal, IP, and Supplier Authority; Pilot, Candidate Baseline, and Implementation Readiness Gates | open-needs-evidence |

## Baseline and implementation-readiness gaps

| Gap ID | Severity | Gap | Evidence/source | Consequence if unresolved | Disposition path | Candidate owner role and gate | Current status |
|---|---|---|---|---|---|---|---|
| GAEP-GAP-036 | high | Pilot, Candidate Baseline, Implementation Readiness, authorization-process, and complexity/subtraction boundaries were previously incomplete or conflated. | `GAEP-RM-003`; `GAEP-RM-005` through `GAEP-RM-008` | a gate pass could be mistaken for a decision, approval, or permission | keep Gate Evaluation, Decision Outcome, Approval Determination, Authorization Grant, and effect records separate | GAEP Decision and Authorization Steward and GAEP Assurance Authority; all gates | resolved-by-candidate-structure |
| GAEP-GAP-037 | blocker | No Candidate Baseline Gate Evaluation, Approval Case, Approval Determination, or Baseline Set exists. | `GAEP-RM-006`; `GAEP-SELF-001` | Proposed files may be mistaken for an approved or superseding release | assemble exact versions/digests, close or expose blockers, evaluate, then seek separate approval | GAEP Assurance Authority and unassigned baseline approving authority; Candidate Baseline Gate | open-blocker |
| GAEP-GAP-038 | blocker | No smallest valuable implementation-slice charter, exclusions, build/buy/compose decision, architecture, evidence plan, or kill criteria exists. | `GAEP-READY-REQ-019`; roadmap Stage 7 | readiness cannot be evaluated against a bounded subject | define the slice only after product, pilot, baseline, risk, and ownership evidence | GAEP Product Owner and GAEP Specification Steward; Implementation Readiness Gate | open-needs-decision |
| GAEP-GAP-039 | blocker | No Implementation Readiness Gate Evaluation exists; the gate must use only Core Gate Result values. | `GAEP-RM-003`; `GAEP-CORE-007` | readiness could be claimed without evaluated criteria and evidence | assign evaluator and evaluate exact slice/baseline without encoding downstream permission | GAEP Assurance Authority; Implementation Readiness Gate | open-blocker |
| GAEP-GAP-040 | blocker | No Implementation Approval Case, Approval Determination, or activity-specific Authorization Grant exists. | `GAEP-RM-007` | any implementation, integration, release, deployment, data use, or production effect remains unauthorized | complete separate Decision/Approval process and issue only exact, bounded, expiring grants | GAEP Decision and Authorization Steward plus unassigned authorizing authority; post-readiness authorization process | open-blocker |
| GAEP-GAP-041 | high | Technology, topology, identity provider, data stores, runtime operations, adapters, and deployment choices are intentionally unselected. | `GAEP-SELF-008`; `GAEP-DEC-004`; `GAEP-DEC-016` | premature implementation would hard-code unapproved product and trust assumptions | retain as open decisions; evaluate only for an approved bounded slice after readiness prerequisites | GAEP Product Owner, GAEP Operational Authority, and domain authorities; Implementation Readiness Gate | open-needs-decision |

## Migration and legacy-disposition gaps

| Gap ID | Severity | Gap | Evidence/source | Consequence if unresolved | Disposition path | Candidate owner role and gate | Current status |
|---|---|---|---|---|---|---|---|
| GAEP-GAP-042 | high | Legacy Draft files lacked a non-destructive candidate migration map. | `GAEP-RM-004`; `GAEP-DEC-003` | candidate work could silently erase or supersede history | retain legacy corpus and map dispositions before exact approval | GAEP Specification Steward; Candidate Baseline Gate | resolved-by-candidate-structure |
| GAEP-GAP-043 | blocker | Exact legacy revisions, candidate revisions/digests, compatibility, redirects, and supersession records are absent. | `GAEP-RM-004`; `GAEP-BASE-READY-REQ-001`; `GAEP-BASE-READY-REQ-010` | users cannot know which source is authoritative or migrate reproducibly | create exact baseline manifest and file-level migration/supersession records | GAEP Specification Steward; Candidate Baseline Gate | open-needs-evidence |
| GAEP-GAP-044 | blocker | No approved decision authorizes legacy archival, removal, or replacement. | `GAEP-DEC-003`; `GAEP-RM-004` | destructive cleanup could remove active authority or recovery history | obtain version-bound Approval Determination and separate authorized, recoverable Change | GAEP Specification Steward and unassigned baseline approving authority; Candidate Baseline Gate | open-needs-decision |
| GAEP-GAP-045 | high | Migration rollback, archive recovery, external-reference preservation, and consumer communication are untested. | `GAEP-RM-004`; `GAEP-CLAIM-009` | supersession may break links, evidence, or historical interpretation | run migration rehearsal, rollback/recovery, link, federation, and communication review | GAEP Workspace Steward; Candidate Baseline Gate | open-needs-evidence |

## Closure rule

A gap may move to `resolved-by-candidate-structure` only when the missing structural home or boundary exists and its source is cited. It may close as an evidence, decision, assignment, validation, or authorization gap only through the corresponding Core record and exact gate evidence. Editing prose, adding a checklist, or passing a static validator cannot by itself close a product, trust, authority, legal, pilot, baseline, or implementation-readiness gap.
