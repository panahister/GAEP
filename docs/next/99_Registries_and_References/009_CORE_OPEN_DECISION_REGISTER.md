---
id: GAEP-REG-009
title: Core Open Decision Register
document_type: registry
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Specification Steward
scope: Machine- and audit-readable register of every open decision declared by GAEP Core 001 through 012
normative_level: normative
classification: internal
provenance: GAEP pre-implementation structural repair
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-REG-008
  - GAEP-CORE-001
  - GAEP-CORE-002
  - GAEP-CORE-003
  - GAEP-CORE-004
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-CORE-008
  - GAEP-CORE-009
  - GAEP-CORE-010
  - GAEP-CORE-011
  - GAEP-CORE-012
informative_references: []
supersedes: []
---

# Core Open Decision Register

## Status vocabulary

- `open`: no approved Decision Record closes the question;
- `open-conflicts-with-current-contract`: the question remains open but current normative text already assumes an answer and must be reconciled;
- `deferred`: an approved Decision Record postpones the decision with owner, trigger, and expiry;
- `decided`: an exact approved Decision Record and resulting contract revisions close the question.

The owning-document question is copied exactly. `Closure evidence` states the minimum package, not evidence that closure already occurred. All concrete owner-role assignments remain `unassigned` under GAEP-REG-008.

## Register

| Decision ID | Owning document | Exact decision question | Affected contracts / gates | Owner role | Status | Closure evidence required |
|---|---|---|---|---|---|---|
| GAEP-SCOPE-OD-001 | GAEP-CORE-001 | Should Portfolio be a Core entity or a profile-defined grouping type? | GAEP-CORE-001; GAEP-REG-010 boundary gate; candidate-baseline gate | GAEP Core Specification Steward | open-conflicts-with-current-contract | Approved Decision Record; reconciled Core entity/relationship revisions; two-profile necessity scenarios; complexity-budget disposition |
| GAEP-SCOPE-OD-002 | GAEP-CORE-001 | May a Managed Asset have joint accountable organizations, or must federation always name one lead organization? | GAEP-CORE-001; GAEP-CORE-012; federation and baseline gates | GAEP Core Specification Steward | open-conflicts-with-current-contract | Approved Decision Record; cardinality and federation-contract revisions; joint-accountability scenarios |
| GAEP-SCOPE-OD-003 | GAEP-CORE-001 | Which canonical Implementation Unit type facets belong in Core registries? | GAEP-CORE-001; GAEP-REG-005/006; conformance gate | GAEP Core Specification Steward | open | Approved Decision Record; exact registry revisions; portability scenarios |
| GAEP-SCOPE-OD-004 | GAEP-CORE-001 | Should emergency operational work always create an Initiative, or may a profile use a pre-authorized standing Initiative? | GAEP-CORE-001/006/011; emergency-authorization gate | GAEP Core Specification Steward | open | Approved Decision Record; exact workflow/authorization revisions; emergency negative scenarios |
| GAEP-SCOPE-OD-005 | GAEP-CORE-001 | What historical valid-time precision is required for the first conformance class? | GAEP-CORE-001/004; conformance and replay gates | GAEP Core Specification Steward | open | Approved Decision Record; state/time registry revision; temporal replay evidence |
| GAEP-IDAUTH-OD-001 | GAEP-CORE-002 | Which identity-assurance vocabulary belongs in Core rather than profiles? | GAEP-CORE-002/009; GAEP-REG-010 boundary gate | GAEP Identity and Authority Steward | open | Approved Decision Record; exact identity/profile registry revisions; cross-profile scenarios |
| GAEP-IDAUTH-OD-002 | GAEP-CORE-002 | May a privacy-preserving or pseudonymous human identity provide accountable approval in defined contexts? | GAEP-CORE-002/006; privacy and approval gates | GAEP Identity and Authority Steward | open | Approved Decision Record; assurance and approval contract revisions; privacy/accountability evidence |
| GAEP-IDAUTH-OD-003 | GAEP-CORE-002 | How are team or committee decisions represented when accountability is intentionally collective? | GAEP-CORE-002/006; quorum gate | GAEP Identity and Authority Steward | open | Approved Decision Record; role/cardinality revisions; committee decision scenarios |
| GAEP-IDAUTH-OD-004 | GAEP-CORE-002 | Which authority-chain integrity mechanisms are required by each conformance class? | GAEP-CORE-002/007/008; conformance gate | GAEP Identity and Authority Steward | open | Approved Decision Record; conformance-profile revision; integrity verification evidence |
| GAEP-IDAUTH-OD-005 | GAEP-CORE-002 | Should standing automation authority have a maximum Core validity interval? | GAEP-CORE-002/006/011; authorization gate | GAEP Identity and Authority Steward | open | Approved Decision Record; grant-validity profile revision; expiry/revocation scenarios |
| GAEP-RESVER-OD-001 | GAEP-CORE-003 | What canonical identifier syntax or URI form will provide global namespace portability? | GAEP-CORE-003/008/012; federation gate | GAEP Resource and Version Steward | open | Approved Decision Record; identifier registry revision; collision and portability tests |
| GAEP-RESVER-OD-002 | GAEP-CORE-003 | Which canonicalization and digest profiles are required for text, structured data, diagrams, and external snapshots? | GAEP-CORE-003/007/008; integrity gate | GAEP Resource and Version Steward | open | Approved Decision Record; digest-profile revisions; reproducible canonicalization vectors |
| GAEP-RESVER-OD-003 | GAEP-CORE-003 | Which Resource Types require Semantic Version rather than revision identity alone? | GAEP-CORE-003; metadata and compatibility gates | GAEP Resource and Version Steward | open | Approved Decision Record; Resource Type registry revision; compatibility scenarios |
| GAEP-RESVER-OD-004 | GAEP-CORE-003 | How are parallel candidate branches and merge ancestry represented without coupling Core to source control? | GAEP-CORE-003; Candidate Revision Set and baseline gates | GAEP Resource and Version Steward | open | Approved Decision Record; ancestry relationship revision; concurrent candidate scenarios |
| GAEP-RESVER-OD-005 | GAEP-CORE-003 | What minimum tombstone information is required after authorized disposal? | GAEP-CORE-003/004/005; retention gate | GAEP Resource and Version Steward | open | Approved Decision Record; retention/tombstone schema revision; privacy and audit scenarios |
| GAEP-RESVER-OD-006 | GAEP-CORE-003 | Which external-source limitations are acceptable for each conformance class? | GAEP-CORE-003/007; GAEP-REG-002/003; conformance gate | GAEP Resource and Version Steward | open | Approved Decision Record; reference/conformance profile revisions; unavailable-source evidence |
| GAEP-STATE-OD-001 | GAEP-CORE-004 | Which State Dimension and Event Type registries belong in the first Core conformance release? | GAEP-CORE-004; GAEP-REG-007/010; conformance gate | GAEP State and Event Steward | open | Approved Decision Record; exact state/event registry revisions; complexity-budget disposition |
| GAEP-STATE-OD-002 | GAEP-CORE-004 | Which Transition Records require integrity protection beyond ordinary resource provenance? | GAEP-CORE-004/007/008; integrity gate | GAEP State and Event Steward | open | Approved Decision Record; integrity profile revision; tamper scenarios |
| GAEP-STATE-OD-003 | GAEP-CORE-004 | What minimum ordering guarantee is required for a conforming runtime or workspace? | GAEP-CORE-004/011; replay and conformance gates | GAEP State and Event Steward | open | Approved Decision Record; ordering contract revision; out-of-order replay evidence |
| GAEP-STATE-OD-004 | GAEP-CORE-004 | How are retroactively effective transitions represented when valid time differs from recorded time? | GAEP-CORE-004/008; temporal-audit gate | GAEP State and Event Steward | open | Approved Decision Record; bitemporal schema revision; correction/replay scenarios |
| GAEP-STATE-OD-005 | GAEP-CORE-004 | Which uncertain external-effect states are universal versus adapter-specific? | GAEP-CORE-004/011; GAEP-REG-007/010; recovery gate | GAEP State and Event Steward | open | Approved Decision Record; state and extraction revisions; uncertain-effect scenarios |
| GAEP-STATE-OD-006 | GAEP-CORE-004 | Should Core define a common corrective-event relationship or leave correction entirely to type registries? | GAEP-CORE-004/008; GAEP-REG-006; audit gate | GAEP State and Event Steward | open | Approved Decision Record; relationship/event registry revision; correction scenarios |
| GAEP-POLICY-OD-001 | GAEP-CORE-005 | Which combining algorithms are standardized in Core and which remain profile-defined? | GAEP-CORE-005/009; policy-resolution gate | GAEP Policy and Risk Steward | open | Approved Decision Record; algorithm/profile registry revisions; conflict decision tables |
| GAEP-POLICY-OD-002 | GAEP-CORE-005 | What minimum action and resource vocabularies belong in Core registries? | GAEP-CORE-003/005; GAEP-REG-010 boundary gate | GAEP Policy and Risk Steward | open | Approved Decision Record; action/resource registry revisions; cross-profile scenarios |
| GAEP-POLICY-OD-003 | GAEP-CORE-005 | Should Core define a default deny result for every material effect or allow profiles to define domain defaults? | GAEP-CORE-005/009/011; authorization gate | GAEP Policy and Risk Steward | open | Approved Decision Record; policy/default profile revisions; missing-policy negative tests |
| GAEP-POLICY-OD-004 | GAEP-CORE-005 | Which risk dimensions and uncertainty vocabulary are universal? | GAEP-CORE-005; GAEP-REG-010 boundary gate | GAEP Policy and Risk Steward | open | Approved Decision Record; risk registry revision; cross-domain calibration evidence |
| GAEP-POLICY-OD-005 | GAEP-CORE-005 | Can continuing Obligations remain satisfied through continuous evidence, or are periodic evaluations always separate records? | GAEP-CORE-005/007; obligation/evidence gate | GAEP Policy and Risk Steward | open | Approved Decision Record; obligation/evaluation revisions; freshness scenarios |
| GAEP-POLICY-OD-006 | GAEP-CORE-005 | How are legal or contractual rules represented when interpretation cannot be reduced to deterministic policy? | GAEP-CORE-005/006/007; legal-review gate | GAEP Policy and Risk Steward | open | Approved Decision Record; qualified-review contract revision; indeterminate-policy scenarios |
| GAEP-POLICY-OD-007 | GAEP-CORE-005 | Which repeated-exception thresholds trigger mandatory policy review? | GAEP-CORE-005/009; exception-renewal gate | GAEP Policy and Risk Steward | open | Approved Decision Record; profile threshold revision; renewal/escalation evidence |
| GAEP-DRAA-OD-001 | GAEP-CORE-006 | Which Approval aggregation rules and quorum semantics belong in Core? | GAEP-CORE-006; approval and complexity-budget gates | GAEP Decision and Authorization Steward | open | Approved Decision Record; aggregation registry revision; quorum decision tables |
| GAEP-DRAA-OD-002 | GAEP-CORE-006 | Is Approval Response always restricted to a Human Principal, while deterministic organizational authorization uses only Authorization Grant? | GAEP-CORE-002/006; approval gate | GAEP Decision and Authorization Steward | open-conflicts-with-current-contract | Approved Decision Record; reconciled requirement/entity revisions; human/non-human negative scenarios |
| GAEP-DRAA-OD-003 | GAEP-CORE-006 | Which integrity evidence is mandatory for offline or cross-organization Approval? | GAEP-CORE-006/007/012; federation-approval gate | GAEP Decision and Authorization Steward | open | Approved Decision Record; integrity profile revision; offline/cross-org verification evidence |
| GAEP-DRAA-OD-004 | GAEP-CORE-006 | Should Authorization Grant support standing role selectors in Core or require resolved Principal lists at use time? | GAEP-CORE-002/006; action-time authorization gate | GAEP Decision and Authorization Steward | open | Approved Decision Record; grant schema revision; historical-resolution scenarios |
| GAEP-DRAA-OD-005 | GAEP-CORE-006 | Which Review Finding severity and disposition values are Core versus profile registries? | GAEP-CORE-006/007; GAEP-REG-007/010 | GAEP Decision and Authorization Steward | open | Approved Decision Record; finding/state registry revisions; cross-profile mappings |
| GAEP-DRAA-OD-006 | GAEP-CORE-006 | How should abstention, recusal, veto, and dissent be represented in multi-party Approval Cases? | GAEP-CORE-006; approval aggregation gate | GAEP Decision and Authorization Steward | open | Approved Decision Record; response/outcome schema revision; multi-party scenarios |
| GAEP-DRAA-OD-007 | GAEP-CORE-006 | Which material changes automatically reopen Approval versus requiring profile-declared impact analysis? | GAEP-CORE-003/004/006/008; approval-reopen gate | GAEP Decision and Authorization Steward | open | Approved Decision Record; invalidation/impact revisions; material-change matrix |
| GAEP-CAE-OD-001 | GAEP-CORE-007 | What is the minimum assurance-case schema, and are structured argument patterns required? | GAEP-CORE-007; assurance conformance gate | GAEP Specification Steward | open | Approved Decision Record; assurance schema revision; minimum valid/invalid cases |
| GAEP-CAE-OD-002 | GAEP-CORE-007 | Which evidence-quality and evaluator-independence levels are controlled Core values? | GAEP-CORE-007; GAEP-REG-007/010; assurance gate | GAEP Specification Steward | open | Approved Decision Record; evidence/profile registry revisions; independence scenarios |
| GAEP-CAE-OD-003 | GAEP-CORE-007 | Which claim classes require integrity protection beyond ordinary resource provenance? | GAEP-CORE-003/007/008; integrity gate | GAEP Specification Steward | open | Approved Decision Record; claim/integrity profile revision; tamper evidence |
| GAEP-CAE-OD-004 | GAEP-CORE-007 | What freshness and retention defaults apply to each evidence class? | GAEP-CORE-004/005/007; evidence-validity gate | GAEP Specification Steward | open | Approved Decision Record; evidence profile revision; expiry/retention scenarios |
| GAEP-CAE-OD-005 | GAEP-CORE-007 | Is partial conformance permitted for individual Core requirement groups? | GAEP-CST-003; GAEP-CORE-007; conformance and baseline gates | GAEP Specification Steward | open | Approved Decision Record; conformance contract revision; claim-label and evidence rules |
| GAEP-TPS-OD-001 | GAEP-CORE-008 | Which relationship, resource-type, state, and authority registries are included in the first Core release? | GAEP-CORE-008; GAEP-REG-005/006/007/008/010; baseline gate | GAEP Specification Steward | open | Approved Decision Record; exact registry set revisions; complexity-budget disposition |
| GAEP-TPS-OD-002 | GAEP-CORE-008 | How are global, organizational, and extension namespaces allocated and collisions resolved? | GAEP-CORE-003/008/012; federation gate | GAEP Specification Steward | open | Approved Decision Record; namespace registry revision; collision tests |
| GAEP-TPS-OD-003 | GAEP-CORE-008 | Which relationships require materialized inverses rather than derived indexes? | GAEP-CORE-008; GAEP-REG-006; trace-conformance gate | GAEP Specification Steward | open | Approved Decision Record; relationship registry revision; consistency/rebuild evidence |
| GAEP-TPS-OD-004 | GAEP-CORE-008 | Which integrity and trusted-time requirements apply by risk profile? | GAEP-CORE-007/008/011/012; integrity gate | GAEP Specification Steward | open | Approved Decision Record; risk-profile revisions; integrity/time verification evidence |
| GAEP-TPS-OD-005 | GAEP-CORE-008 | What are the minimum cross-repository and offline reference-resolution semantics? | GAEP-CORE-003/008/012; offline/federation gate | GAEP Specification Steward | open | Approved Decision Record; resolver contract revision; disconnected replay scenarios |
| GAEP-PCR-OD-001 | GAEP-CORE-009 | Which Core variation points and non-waivable requirements belong in the initial registry? | GAEP-CORE-005/009; GAEP-REG-010; conformance gate | GAEP Specification Steward | open | Approved Decision Record; variation-point registry revision; non-weakening tests |
| GAEP-PCR-OD-002 | GAEP-CORE-009 | Which combining rule applies by policy family: deny-overrides, most-specific, or another governed rule? | GAEP-CORE-005/009; resolution gate | GAEP Specification Steward | open | Approved Decision Record; policy-family algorithm mapping; decision-table evidence |
| GAEP-PCR-OD-003 | GAEP-CORE-009 | How are profile namespaces owned and made portable across organizations? | GAEP-CORE-008/009/012; federation gate | GAEP Specification Steward | open | Approved Decision Record; namespace/ownership revision; cross-org scenarios |
| GAEP-PCR-OD-004 | GAEP-CORE-009 | What maximum renewal and escalation defaults apply to exceptions? | GAEP-CORE-005/009; exception-renewal gate | GAEP Specification Steward | open | Approved Decision Record; profile defaults; renewal/escalation evidence |
| GAEP-PCR-OD-005 | GAEP-CORE-009 | What offline resolution, trusted-time, and historical replay guarantees are required? | GAEP-CORE-004/008/009; offline conformance gate | GAEP Specification Steward | open | Approved Decision Record; resolver profile revision; replay/time evidence |
| GAEP-CWC-OD-001 | GAEP-CORE-010 | Which capability, workflow, and responsibility types belong in the first Core registries? | GAEP-CORE-010; GAEP-REG-010 boundary gate | GAEP Specification Steward | open | Approved Decision Record; exact type registry revisions; two-profile necessity evidence |
| GAEP-CWC-OD-002 | GAEP-CORE-010 | What is the minimum portable context-pack, capability, workflow-definition, and plan schema? | GAEP-CORE-010; workspace/runtime conformance gates | GAEP Specification Steward | open | Approved Decision Record; minimal schema revisions; portability fixtures |
| GAEP-CWC-OD-003 | GAEP-CORE-010 | Which instruction-privilege assignment and isolation rules belong in Core versus profiles? | GAEP-CORE-002/005/010; GAEP-REG-010 boundary gate | GAEP Specification Steward | open | Approved Decision Record; extraction/profile revisions; indirect-instruction tests |
| GAEP-CWC-OD-004 | GAEP-CORE-010 | How are context combination risk, declassification, and redaction authority represented? | GAEP-CORE-005/006/010; privacy/security gates | GAEP Specification Steward | open | Approved Decision Record; context/data profile revisions; combination-risk scenarios |
| GAEP-CWC-OD-005 | GAEP-CORE-010 | What reproducibility evidence is required for probabilistic capabilities? | GAEP-CORE-007/010/011; assurance gate | GAEP Specification Steward | open | Approved Decision Record; evidence profile revision; reproducibility fixtures |
| GAEP-CWC-OD-006 | GAEP-CORE-010 | Which autonomy, interaction, and proposed-effect descriptors are portable Core semantics? | GAEP-CORE-010/011; GAEP-REG-010 boundary gate | GAEP Specification Steward | open | Approved Decision Record; descriptor registry revision; cross-runtime scenarios |
| GAEP-EER-OD-001 | GAEP-CORE-011 | Which effect, execution-risk, and autonomy classifications belong in Core registries? | GAEP-CORE-011; GAEP-REG-007/010; runtime conformance gate | GAEP Specification Steward | open-conflicts-with-current-contract | Approved Decision Record; reconciled descriptor/registry revisions; complexity-budget disposition |
| GAEP-EER-OD-002 | GAEP-CORE-011 | What action-time confirmation and multi-party authorization profiles are required? | GAEP-CORE-006/011; effect-commit gate | GAEP Specification Steward | open | Approved Decision Record; confirmation/authorization profile revisions; high-effect tests |
| GAEP-EER-OD-003 | GAEP-CORE-011 | Which trusted-time, event-ordering, and offline execution guarantees are required? | GAEP-CORE-004/008/011; offline/recovery gate | GAEP Specification Steward | open | Approved Decision Record; runtime profile revisions; replay/reconciliation evidence |
| GAEP-EER-OD-004 | GAEP-CORE-011 | Which cumulative resource, duration, data, and cost budget dimensions are mandatory? | GAEP-CORE-005/011; resource-budget gate | GAEP Specification Steward | open | Approved Decision Record; budget registry/profile revision; split-action tests |
| GAEP-EER-OD-005 | GAEP-CORE-011 | What quarantine, emergency stop, break-glass, and manual-reconciliation semantics belong in Core versus profiles? | GAEP-CORE-002/004/011; GAEP-REG-010 boundary gate | GAEP Specification Steward | open | Approved Decision Record; extraction/state/profile revisions; incident scenarios |
| GAEP-EER-OD-006 | GAEP-CORE-011 | Which effect classes require logically separated preparation and commitment? | GAEP-CORE-006/011; effect-commit gate | GAEP Specification Steward | open | Approved Decision Record; effect profile revision; irreversible-effect tests |
| GAEP-ECF-OD-001 | GAEP-CORE-012 | How are extension namespaces governed, and which publisher-trust levels are portable? | GAEP-CORE-008/012; extension admission gate | GAEP Specification Steward | open | Approved Decision Record; namespace/trust registry revisions; publisher scenarios |
| GAEP-ECF-OD-002 | GAEP-CORE-012 | What minimum evaluation, permission, integrity, and revocation profiles apply to extensions? | GAEP-CORE-006/007/012; extension admission gate | GAEP Specification Steward | open | Approved Decision Record; extension-assurance profile revisions; revoke/compromise tests |
| GAEP-ECF-OD-003 | GAEP-CORE-012 | Who owns Core compatibility and conformance suites, and how are they versioned? | GAEP-CST-003; GAEP-CORE-012; conformance gate | GAEP Specification Steward | open | Approved Decision Record; owner assignment; suite version contract; reproducible fixtures |
| GAEP-ECF-OD-004 | GAEP-CORE-012 | How are version ranges and behavioral changes handled when providers expose mutable aliases? | GAEP-CORE-003/012; compatibility gate | GAEP Specification Steward | open | Approved Decision Record; compatibility/resolution revisions; alias-mutation tests |
| GAEP-ECF-OD-005 | GAEP-CORE-012 | Which identity-assurance, conflict-resolution, and trusted-time profiles govern federation? | GAEP-CORE-002/004/009/012; federation gate | GAEP Specification Steward | open | Approved Decision Record; federation profile revisions; cross-domain scenarios |
| GAEP-ECF-OD-006 | GAEP-CORE-012 | What portability minimums and lossy translation classes are acceptable? | GAEP-CORE-008/012; portability/conformance gate | GAEP Specification Steward | open | Approved Decision Record; translation-class registry revision; round-trip evidence |
| GAEP-ECF-OD-007 | GAEP-CORE-012 | What are the boundaries of marketplace governance, certification, transparency, and third-party attestation? | GAEP-CORE-012; GAEP-REG-010 extraction gate; ecosystem release gate | GAEP Specification Steward | open | Approved Decision Record; extraction/deferred-scope disposition; liability and attestation scenarios |

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-OPEN-REQ-001 | Every Open Decision ID declared by GAEP-CORE-001 through GAEP-CORE-012 SHALL appear exactly once in this register, and no register ID may be absent from its owning document. | Bidirectional ID reconciliation |
| GAEP-OPEN-REQ-002 | Owning document, exact question text, owner role, status, affected contracts or gates, and closure evidence SHALL be populated for every row. | Row completeness validation |
| GAEP-OPEN-REQ-003 | `decided` SHALL require an approved exact Decision Record, exact resulting contract or registry revisions, and the named verification evidence; discussion or edited prose alone SHALL NOT close a row. | Decision-closure audit |
| GAEP-OPEN-REQ-004 | `deferred` SHALL require an approved Decision Record identifying responsible owner assignment, rationale, trigger, expiry or review condition, affected risks, and prohibited reliance while deferred. | Deferral audit |
| GAEP-OPEN-REQ-005 | Candidate-baseline and conformance gates SHALL enumerate every `open` or `open-conflicts-with-current-contract` row that blocks the claimed scope and every explicitly approved non-blocking deferral. | Gate-open-decision crosswalk |
| GAEP-OPEN-REQ-006 | A removed, merged, or renumbered Open Decision ID SHALL remain reserved with a replacement or disposition reference; IDs SHALL NOT be silently reused. | Registry history review |

## Current audit summary

- Registered Core Open Decisions: 70.
- Open: 66.
- Open and conflicting with current normative text: 4.
- Deferred: 0.
- Decided with closure evidence: 0.

The counts are a candidate snapshot and SHALL be recomputed from the rows before any approval or baseline gate.
