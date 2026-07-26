# GAEP Pre-Implementation Change Reports

**Governed AI Engineering Platform (GAEP)**
**Purpose:** Control record for every proposed implementation change set, produced during **Stage A (read-only assessment)** and approved by the Product Owner before **Stage B (implementation)** begins.

This folder is the durable, phase-by-phase log of *what should be done next and why*. Each report is a governed proposal that must be explicitly approved before any source, configuration, dependency, artifact, or delivery-tracker change is made.

These reports do **not** replace or override:

- the [GAEP Feature Delivery Tracker](../054_GAEP_FEATURE_DELIVERY_TRACKER.md) — the authority for delivery **status**;
- the [Platform and Product Identity Manifest](../../GAEP_PLATFORM_PRODUCT_IDENTITY_MANIFEST.md) — the authority for product **identity and scope**.

A change report proposes work. The tracker records its status. The Manifest governs whether it is in scope.

## Two-stage protocol (summary)

| Stage | Activity | Output |
|---|---|---|
| **Stage A** | Read-only assessment: read governing docs, inspect the codebase and working tree, verify feature state, propose the smallest coherent change set. | A Pre-Implementation Change Report in this folder, ending in `AWAITING PRODUCT OWNER APPROVAL`. |
| **Approval** | Product Owner reviews and explicitly approves an exact Change Set ID. | The report's `Status` is set to `Approved`, with the approval statement recorded. |
| **Stage B** | Implement only the approved file changes, add tests, build artifacts, update **only the touched Feature IDs** in the tracker (max `🧪 Ready for Test`), add a Change Log row. | A Change Set Handoff (recorded below and/or appended to the report). |

No feature may be set to `✅ Done` until the Product Owner tests and explicitly accepts it.

## One-pass report standard

The Pre-Implementation Change Report is the complete implementation and acceptance contract, not an iterative design conversation. Before requesting approval, the author must resolve every discoverable ambiguity and include:

- frozen behavioral invariants and explicit non-goals;
- a complete success / executed-failure / not-executed / stale / invalid-evidence state model where applicable;
- exact file and artifact paths with no wildcards or ellipses;
- trust, integrity, authenticity, sanitization, and evidence-freshness boundaries;
- positive, negative, tampering, failure-path, and environment-unavailable tests;
- exact commands, expected outputs, tracker transitions, and the Definition of Ready for Test.

After approval, an implementation defect already inside the frozen scope is corrected directly and returned in the implementation handoff; it does not require another planning-report cycle. A revised report and new approval are required only when product scope, trust boundaries, public contracts, artifacts, compatibility, or acceptance criteria materially change.

Reviewers must evaluate the implementation against the frozen contract. Non-blocking improvements discovered later belong in the backlog or a later Change Set; they do not move the current goalposts.

### Fast path for implementation and CI corrections

An implementation defect, packaging defect, CI portability failure, or environment-discovery error inside an approved Change Set is corrected directly under that Change Set. It must not create a new report, report revision, approval request, or broad re-audit. The correction response should state only the defect, changed files, focused regression test, affected gate result, and any genuine blocker.

Use one consolidated stabilization pass instead of serial correction reports. Platform corrections must preserve one shared Product implementation and remain inside thin launch, path, process, native-host, packaging, or CI adapters. A green result on one operating system is evidence for that lane only; the same source revision must be validated by the canonical matrix in the Manifest and Feature Delivery Tracker.

## Naming convention

```
PHASE_<N>_<CHANGE-SET-ID>_PRE_IMPLEMENTATION_CHANGE_REPORT.md
```

- `<N>` — Roadmap phase (`0`, `1`, `2`, `3A`, `3B`, `4`).
- `<CHANGE-SET-ID>` — `GAEP-P<phase>-CS<nn>` (e.g. `GAEP-P0-CS01`, `GAEP-P1-CS03`).
- One report per change set. If scope is revised before approval, edit the same file and re-request approval (do not fork).
- A superseded report keeps its file but is marked `Status: Superseded by <ID>`.

Use [`_TEMPLATE_PHASE_N_PRE_IMPLEMENTATION_CHANGE_REPORT.md`](_TEMPLATE_PHASE_N_PRE_IMPLEMENTATION_CHANGE_REPORT.md) as the starting point for every new report.

## Required report sections

Every report must contain, in order:

1. Executive Summary
2. Repository and Baseline State
3. Evidence-Based Feature Assessment (for the phase's Feature IDs)
4. Proposed Change Set (with a `GAEP-P<phase>-CS<nn>` ID), including frozen invariants, state/failure model, and trust boundary
5. Exact Planned File Changes (Create / Modify / Move / Delete)
6. Expected Product Output (incl. the four-IDE and artifact/evidence tables)
7. Architecture, Compatibility, and Recovery Impact
8. Dashboard Impact
9. Validation and Acceptance Plan (positive, negative, failure-path, exact commands, Definition of Ready for Test)
10. Risks, Blockers, and Decisions Required
11. Tracker Impact Preview (proposed status transitions, not applied)
12. Approval Request (ends with `AWAITING PRODUCT OWNER APPROVAL`)

## Change Set Register

Newest first. Update this table whenever a report is created, approved, implemented, or superseded.

| Change Set ID | Phase | Title | Report | Status | Approved on | Handoff |
|---|---|---|---|---|---|---|
| GAEP-P0-CS02 | 0 | First Installable Four-IDE Provider/Model Read-Only Vertical Slice | [report](PHASE_0_GAEP-P0-CS02_PRE_IMPLEMENTATION_CHANGE_REPORT.md) | In Implementation | 2026-07-26 | Defect-correction pass complete for all locally-executable work (real v3 RPC example, cancel/timeout mutation guard, atomic host lock + persistent VS Code client, real Node/SEA digests, Rider/VS Tool Window source). Only external-lane executions remain: Rider (JDK 21), Visual Studio (Windows + VS 2022), and a `completed` Claude run (authenticated runtime; currently `auth-unavailable`). |
| GAEP-P0-CS01-C1 | 0 | Correction Set: contract rigor, evidence integrity, governance reconciliation, boundary strictness, VS Code evidence | [report](PHASE_0_GAEP-P0-CS01-C1_PRE_IMPLEMENTATION_CHANGE_REPORT.md) | Accepted | 2026-07-24 | Product Owner installed the VSIX and accepted the manual Platform Readiness result; PLT-28 is `✅ Done`, while PLT-27/29 and Phase 0 remain open |
| GAEP-P0-CS01 | 0 | Platform Readiness Contract, Conformance Harness Skeleton, and Readiness Example | [report](PHASE_0_GAEP-P0-CS01_PRE_IMPLEMENTATION_CHANGE_REPORT.md) | Implemented — Ready for Test | 2026-07-24 | PLT-27/28/29 advanced; see tracker Change Log |

### Status values

- `Awaiting Approval` — Stage A complete; not yet approved.
- `Approved` — Product Owner approved the exact Change Set ID; Stage B may begin.
- `In Implementation` — Stage B in progress.
- `Implemented — Ready for Test` — Stage B complete; awaiting Product Owner test/acceptance.
- `Accepted` — Product Owner accepted; touched Feature IDs may move to `✅ Done`.
- `Superseded by <ID>` — replaced before or after approval.
- `Withdrawn` — proposal abandoned; reason recorded in the report.
