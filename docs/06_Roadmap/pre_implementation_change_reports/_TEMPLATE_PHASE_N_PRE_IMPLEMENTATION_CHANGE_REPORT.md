# GAEP Phase &lt;N&gt; Pre-Implementation Change Report

| Field | Value |
|---|---|
| **Report ID** | GAEP-P&lt;N&gt;-CS&lt;nn&gt; |
| **Roadmap phase** | Phase &lt;N&gt; (internal milestone: …) |
| **Change Set ID** | GAEP-P&lt;N&gt;-CS&lt;nn&gt; |
| **Scope (Feature IDs audited)** | e.g. PLT-01…PLT-35 |
| **Status** | Awaiting Approval |
| **Revision** | R1 |
| **Date** | YYYY-MM-DD |
| **Author** | Codex / Claude Code |
| **Supersedes / Superseded by** | — |

> **Stage A is read-only.** Creating this report and its Register row is allowed; do not modify source, config, dependencies, lockfiles, generated acceptance artifacts, or the delivery tracker before explicit Product Owner approval of the exact Change Set ID.

> **One-pass standard.** This report is the complete implementation and acceptance contract, not a discussion draft. Resolve every discoverable ambiguity before requesting approval. Use `N/A — reason` where a field does not apply; do not use unexplained `TBD`, wildcards, ellipses, or implicit design choices.

## 1. Executive Summary

- Verified current condition and the user-visible problem.
- Smallest coherent vertical increment proposed now.
- Why this change must precede later work.
- Expected user-visible and machine-verifiable outcome.
- Explicit statement of what will remain incomplete.

### Acceptance summary

| Outcome | Acceptance evidence | Maximum tracker status |
|---|---|---|
|  |  | `🟡 In Progress` / `🧪 Ready for Test` |

## 2. Repository and Baseline State

- Current branch and commit/worktree basis:
- Pre-existing modified/untracked files that must remain untouched:
- Relevant implementation paths inspected:
- Existing behavior verified from source:
- Baseline commands and exact results:
- OS/tooling constraints:
- Visual Studio / Rider / Kiro test environments available? (yes/no per host)
- Codex / Claude Code executables available? (yes/no per provider)
- Provider authentication readiness safely determinable? (yes/no — never expose secrets)
- Facts that are observed vs configured vs provider-declared vs not observed:

## 3. Evidence-Based Feature Assessment

| Feature ID | Tracker status | Evidence found | Verified gap | Recommended action | Proposed status after this CS |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

Report tracker/reality discrepancies here; do **not** edit the tracker before approval.

## 4. Proposed Change Set — GAEP-P&lt;N&gt;-CS&lt;nn&gt;

- Title:
- Implemented now:
- Remaining for later change sets:
- Explicitly out of scope:
- No behavior or architecture fork introduced:

### Frozen implementation contract

List every invariant that implementation and review must enforce. Approval freezes these criteria; implementation may not silently reinterpret them.

| ID | Invariant / rule | Input or trigger | Required behavior | Forbidden behavior |
|---|---|---|---|---|
| INV-01 |  |  |  |  |

### State and failure model

Cover success, executed failure, not executed/environment unavailable, missing evidence, invalid evidence, stale evidence, retry, and rollback where applicable.

| Preconditions / event | Executed? | Required state | Required artifact or UI result | Retry / rollback behavior |
|---|---:|---|---|---|
|  | yes/no |  |  |  |

### Trust and authority boundary

- Trusted inputs and their authority:
- Untrusted/caller-controlled inputs:
- Runtime validation required:
- Integrity/provenance guarantees:
- Authenticity guarantees explicitly **not** claimed:
- Secret/path/log sanitization rules:

## 5. Exact Planned File Changes

Use exact repository-relative paths and filenames. No `*`, `...`, placeholder directory, or unnamed generated artifact is permitted.

| Path | Action | Feature IDs / invariants | Exact planned change | Expected result |
|---|---|---|---|---|
|  | Create/Modify/Move/Delete |  |  |  |

For every generated artifact, state who creates it, when it is created, whether it is tracked, and how it is verified. Any **Delete** requires separate explicit approval.

### Allowed implementation deviations

- A handoff may record a smaller internal implementation variation only when all frozen invariants, paths, outputs, compatibility rules, and acceptance tests remain unchanged.
- A deviation that changes product behavior, trust boundaries, artifacts, public contracts, Feature scope, or acceptance criteria requires a revised report and new approval.

## 6. Expected Product Output

- User-visible behavior:
- IDE commands, panels, dashboards, and settings:
- Provider/model behavior:
- Generated packages/artifacts and exact paths:
- Realistic example path and exact run command:
- Expected reports, digests, and evidence:

| IDE | Expected package | Install method | Test method | Expected user-visible result | Truth state if not executed |
|---|---|---|---|---|---|
| VS Code |  |  |  |  |  |
| Visual Studio |  |  |  |  |  |
| Rider |  |  |  |  |  |
| Kiro |  |  |  |  |  |

For host-facing work, map the same source revision to the canonical operating-system matrix in the Manifest and Feature Delivery Tracker. Do not propose separate Product implementations per operating system. Put OS-specific behavior only in thin launch, path, process, native-host, packaging, or CI adapters.

> Do not claim four-IDE support when a host only has a scaffold or was not executed.

### Artifact and evidence contract

| Artifact | Exact schema/fields | Producer | Consumer/verifier | Tracked? | Freshness/staleness rule |
|---|---|---|---|---:|---|
|  |  |  |  | yes/no |  |

Define exact artifact membership, unique identifiers, digest algorithm/input bytes, path-containment rules, current-attempt behavior, and invalid/tampered/missing-artifact behavior.

## 7. Architecture, Compatibility, and Recovery Impact

- Shared-engine and host-adapter boundaries:
- Public/runtime contract changes:
- Portable `.gaep` impact:
- Provider-adapter impact:
- Backward/forward compatibility:
- Migration requirements:
- Security/permission impact:
- Failure containment and fail-closed behavior:
- Rollback/recovery procedure and preserved evidence:

## 8. Dashboard Impact

| Dashboard/view | New or changed information | Authoritative data source | Truth/freshness cue | Empty/error/not-run state |
|---|---|---|---|---|
|  |  |  |  |  |

Include Platform/Host Readiness, Change/Impact, Agent/Model, and phase-specific dashboards where relevant. State `N/A — reason` when unchanged.

## 9. Validation and Acceptance Plan

Every acceptance criterion must map to an exact command/test and expected result. Include positive, negative, tampering, failure-before-output, not-executed, stale-evidence, and rollback tests whenever the feature has those states.

| ID | Criterion / invariant | Exact test or command | Expected result | Environment | Evidence path |
|---|---|---|---|---|---|
| AC-01 |  |  |  | current / external / Product Owner |  |

### Required command set

- Typecheck:
- Unit/integration tests:
- Documentation/lifecycle validation:
- Host packaging/install test per applicable IDE:
- Realistic example:
- Evidence/digest verification:
- Product Owner manual test:

### Definition of Ready for Test

- [ ] Every approved file change is present; no unapproved scope expansion.
- [ ] Pre-existing user changes are preserved.
- [ ] All applicable positive and negative tests pass.
- [ ] Generated artifacts are present, sanitized, tracked/ignored as specified, and digest-verified.
- [ ] Unavailable environments remain explicitly `not-run`/`pending-environment`; no inferred pass.
- [ ] Tracker counts, touched Feature rows, Change Log, report status, and Register status agree.
- [ ] No Feature is set to `✅ Done` before explicit Product Owner acceptance.
- [ ] Handoff lists deviations, final commands/results, exact artifact paths/digests, known gaps, and manual acceptance steps.

## 10. Risks, Blockers, and Decisions Required

| ID | Type | Description | Impact | Required decision / mitigation | Owner | Must resolve before approval? |
|---|---|---|---|---|---|---:|
|  |  |  |  |  |  | yes/no |

All decisions that materially change implementation must be resolved in this report before approval. A genuine external blocker may remain explicit; an implicit assumption may not.

## 11. Tracker Impact Preview

- PLT-XX / P&lt;n&gt;-XX: current status → expected post-implementation status
  - Reason:
  - Required evidence:
- Status Summary delta:
- Change Log entry to add:

> Implementation may advance a Feature only to `🧪 Ready for Test`. Never to `✅ Done` before Product Owner acceptance.

## 12. Approval Request

By approving, the Product Owner freezes the Scope, Frozen Implementation Contract, Exact Planned File Changes, Acceptance Plan, and Tracker Impact Preview above.

After approval:

1. implement only the approved contract;
2. do not create another planning report for an implementation defect already inside the approved scope—fix it directly and return a concise handoff;
3. stop and request revised approval only for a real scope, trust-boundary, public-contract, artifact, or acceptance-criteria change;
4. return an implementation handoff, not another Stage A narrative.

Proposed approval command:

`APPROVE GAEP-P<N>-CS<nn> EXACTLY AS PROPOSED`

AWAITING PRODUCT OWNER APPROVAL
